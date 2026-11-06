/* game/logic.js — бой «Крепости на Колёсах»: сетка 6×3, оружие по рядам, зомби,
   волны и боссы. Детерминизм: весь рандом идёт через st.rng (E.Rng). Никакого DOM. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;
  var L = {};
  var ROWS = C.grid.rows, LANES = C.grid.lanes, N = ROWS * LANES;
  var CONTACT = 0.55;
  var LVL = C.levelMult;
  var WEAP = {};
  for (var wi = 0; wi < C.weapons.length; wi++) WEAP[C.weapons[wi].id] = C.weapons[wi];

  L.N = N;
  L.ROWS = ROWS;
  L.LANES = LANES;
  L.CONTACT = CONTACT;
  L.LVL = LVL;
  L.waveTotal = C.waves + 1;
  L.weapon = function (id) { return WEAP[id] || null; };
  L.rowOf = function (i) { return Math.floor(i / LANES) + 1; };
  L.laneOf = function (i) { return i % LANES; };
  L.idx = function (r, l) { return (r - 1) * LANES + l; };
  L.unlockChapter = function (type) { return WEAP[type] ? WEAP[type].unlock : 99; };
  L.unlocked = function (chapter, type) { return chapter >= L.unlockChapter(type); };

  /* ---------- сетка ---------- */
  L.emptyLayout = function () {
    var a = [];
    for (var i = 0; i < N; i++) a.push(null);
    return a;
  };

  /* В сохранении лежат только k / t / lvl: cd, blocked и прочий мусор отбрасываем. */
  L.sanitize = function (src) {
    var out = [];
    for (var i = 0; i < N; i++) {
      var e = src && src[i];
      if (!e || typeof e !== 'object') { out.push(null); continue; }
      if (e.k === 'b') { out.push({ k: 'b', spent: C.blockCost }); continue; }
      if (e.k === 'w' && WEAP[e.t]) {
        var lvl = Math.max(1, Math.min(3, (e.lvl | 0) || 1));
        var spent = C.weaponPrice;
        for (var u = 1; u < lvl; u++) spent += C.upgradePrice[u - 1];
        out.push({ k: 'w', t: e.t, lvl: lvl, spent: spent });
        continue;
      }
      out.push(null);
    }
    return out;
  };

  L.saveLayout = function (layout) {
    var out = [];
    for (var i = 0; i < N; i++) {
      var e = layout[i];
      if (!e) { out.push(null); continue; }
      out.push(e.k === 'b' ? { k: 'b' } : { k: 'w', t: e.t, lvl: e.lvl });
    }
    return out;
  };

  L.blockCount = function (layout) {
    var n = 0;
    for (var i = 0; i < layout.length; i++) if (layout[i] && layout[i].k === 'b') n++;
    return n;
  };
  L.weaponCount = function (layout) {
    var n = 0;
    for (var i = 0; i < layout.length; i++) if (layout[i] && layout[i].k === 'w') n++;
    return n;
  };
  L.maxHpFor = function (layout) { return C.hp.chassis + L.blockCount(layout) * C.hp.block; };

  /* ---------- старт главы ---------- */
  L.newBattle = function (o) {
    o = o || {};
    var layout = L.sanitize(o.layout);
    var st = {
      chapter: Math.max(1, Math.min(C.chapters.length, (o.chapter | 0) || 1)),
      wave: 0,
      phase: 'build',
      buildT: o.first ? C.firstBuildTime : C.buildTime,
      layout: layout,
      maxHp: 0, hp: 0,
      coins: (o.coins | 0) || 0,
      earned: 0, hits: 0, kills: 0,
      rng: o.rng,
      zombies: [], shots: [], events: [], spawnQueue: [],
      combatT: 0, t: 0, nextId: 1,
      bossRef: null, bossHp: (o.bossHp | 0) || 0, bossKilled: false,
      hpAtWaveStart: 0, clearBonus: 0,
      holdBuild: false, recordSafe: false,
      perks: {}, perkChoices: null,
      bonus: o.bonus || { hull: 0, dmg: 0, rate: 0 }
    };
    st.maxHp = L.maxHpFor(layout) + (st.bonus.hull || 0) * C.hangarStep.hull;
    st.hp = st.maxHp;
    st.hpAtWaveStart = st.hp;
    return st;
  };

  /* ---------- стройка ---------- */
  L.placeBlock = function (st, idx) {
    if (idx < 0 || idx >= N || st.layout[idx]) return false;
    if (st.coins < C.blockCost) return false;
    st.coins -= C.blockCost;
    st.layout[idx] = { k: 'b', spent: C.blockCost };
    st.maxHp += C.hp.block;
    st.hp = Math.min(st.maxHp, st.hp + C.hp.block);
    st.events.push({ type: 'build' });
    return true;
  };

  L.placeWeapon = function (st, idx, type) {
    var def = WEAP[type];
    if (!def || idx < 0 || idx >= N || st.layout[idx]) return false;
    if (st.coins < def.price) return false;
    st.coins -= def.price;
    st.layout[idx] = { k: 'w', t: type, lvl: 1, spent: def.price, cd: 0 };
    st.events.push({ type: 'build' });
    return true;
  };

  L.removeItem = function (st, idx) {
    var it = st.layout[idx];
    if (!it) return 0;
    st.layout[idx] = null;
    st.coins += it.spent;
    if (it.k === 'b') {
      st.maxHp -= C.hp.block;
      if (st.hp > st.maxHp) st.hp = st.maxHp;
    }
    st.events.push({ type: 'remove' });
    return it.spent;
  };

  L.moveItem = function (st, from, to) {
    if (from === to || !st.layout[from] || st.layout[to]) return false;
    st.layout[to] = st.layout[from];
    st.layout[from] = null;
    st.events.push({ type: 'move' });
    return true;
  };

  L.canUpgrade = function (st, idx) {
    var it = st.layout[idx];
    return !!(it && it.k === 'w' && it.lvl < 3);
  };
  L.upgradePriceAt = function (st, idx) {
    var it = st.layout[idx];
    return (it && it.k === 'w' && it.lvl < 3) ? C.upgradePrice[it.lvl - 1] : 0;
  };
  L.upgradeItem = function (st, idx) {
    var it = st.layout[idx];
    if (!it || it.k !== 'w' || it.lvl >= 3) return false;
    var price = C.upgradePrice[it.lvl - 1];
    if (st.coins < price) return false;
    st.coins -= price;
    it.spent += price;
    it.lvl++;
    st.events.push({ type: 'upgrade' });
    return true;
  };

  L.repairCost = function (st) { return Math.ceil((st.maxHp - st.hp) * C.repairRate); };
  L.repair = function (st) {
    var cost = L.repairCost(st);
    if (cost <= 0) return 0;
    if (st.coins < cost) return -1;
    st.coins -= cost;
    st.hp = st.maxHp;
    st.events.push({ type: 'repair' });
    return cost;
  };

  /* ---------- волны ---------- */
  L.isBossWave = function (st) { return st.wave >= C.waves; };
  L.modOf = function (chapter) {
    var ch = C.chapters[Math.max(0, Math.min(C.chapters.length - 1, (chapter | 0) - 1))];
    return (ch && ch.mod) ? ch.mod : '';
  };

  function pickType(st) {
    var c = st.chapter, r = st.rng.float();
    var mod = L.modOf(c);
    var flyer = c >= 7 ? 0.18 : 0;
    var brute = c >= 4 ? 0.16 + Math.min(0.12, (c - 4) * 0.02) : 0;
    var runner = c >= 2 ? 0.30 : 0.10;
    if (mod === 'air') { flyer = 0.34; brute = 0.10; runner = 0.28; }
    else if (mod === 'horde') { flyer = c >= 7 ? 0.12 : 0; brute *= 0.8; runner = 0.32; }
    else if (mod === 'rush') { runner = 0.44; brute = Math.max(brute, 0.14); }
    else if (mod === 'mixed') { flyer = 0.22; brute = 0.22; runner = 0.28; }
    if (r < flyer) return 'flyer';
    if (r < flyer + brute) return 'brute';
    if (r < flyer + brute + runner) return 'runner';
    return 'walker';
  }

  L.previewWave = function (st) {
    var boss = L.isBossWave(st);
    var count = (boss ? 8 + Math.floor(st.chapter * 0.6) : 6 + (st.wave + 1) * 2 + Math.floor(st.chapter * 0.6));
    var mod = L.modOf(st.chapter);
    if (mod === 'horde') count = Math.round(count * 1.35);
    var types = ['walker'];
    if (st.chapter >= 2 || mod === 'mixed') types.push('runner');
    if (st.chapter >= 4 || mod === 'mixed' || mod === 'rush') types.push('brute');
    if (st.chapter >= 7 || mod === 'mixed' || mod === 'air') types.push('flyer');
    return { count: count, types: types, mod: mod, boss: boss };
  };

  L.buildQueue = function (st) {
    var boss = L.isBossWave(st);
    var mod = L.modOf(st.chapter);
    var count = (boss ? 8 + Math.floor(st.chapter * 0.6) : 6 + (st.wave + 1) * 2 + Math.floor(st.chapter * 0.6));
    if (mod === 'horde') count = Math.round(count * 1.35);
    var gap = Math.max(0.38, 1.12 - st.chapter * 0.04 - st.wave * 0.05);
    if (mod === 'rush') gap *= 0.76;
    if (mod === 'horde') gap *= 0.9;
    var at = boss ? 2.4 : 0.3;
    var q = [];
    var laneShift = st.rng.int(0, LANES - 1);
    for (var i = 0; i < count; i++) {
      q.push({ type: pickType(st), lane: (i + laneShift) % LANES, at: at });
      at += gap * st.rng.range(0.8, 1.2);
    }
    return q;
  };

  L.spawnZombie = function (st, type, lane, d) {
    var def = C.zombies[type] || C.zombies.walker;
    var z = {
      id: st.nextId++, type: type, lane: lane, d: d,
      hp: def.hp, maxHp: def.hp, speed: def.speed * (st.perks.slow ? 0.9 : 1), dmg: def.dmg,
      atkCd: def.atkCd, atk: 0.6, air: !!def.air, r: def.r,
      t: st.rng.range(0, 6), dead: false, deathT: 0, boss: false
    };
    st.zombies.push(z);
    return z;
  };

  function spawnBoss(st) {
    var ch = C.chapters[st.chapter - 1];
    // именной босс есть у 4/8/12, у остальных улиц — элита с растущим HP
    var bd = (ch && ch.boss) ? C.bosses[ch.boss] : C.bosses.elite;
    if (!bd) return;
    var full = bd.hp + ((ch && ch.boss) ? 0 : st.chapter * 25);
    var hp = st.bossHp > 0 ? Math.min(st.bossHp, full) : full;
    var z = {
      id: st.nextId++, type: bd.type, lane: bd.lane, d: 7.8,
      hp: hp, maxHp: full, speed: bd.speed * (st.perks.slow ? 0.9 : 1), dmg: bd.dmg,
      atkCd: bd.atkCd, atk: bd.atkCd, air: false, r: bd.r,
      t: 0, dead: false, deathT: 0, boss: true, bossId: bd.id,
      shield: bd.shield || 0, maxShield: bd.shield || 0,
      spawnEvery: bd.spawnEvery || 0, spawnT: bd.spawnEvery || 0
    };
    st.zombies.push(z);
    st.bossRef = z;
    st.events.push({ type: 'boss' });
  }

  L.startWave = function (st) {
    if (st.phase !== 'build') return false;
    st.phase = 'combat';
    st.combatT = 0;
    st.hpAtWaveStart = st.hp;
    if (st.perkChoices && st.perkChoices.length) L.applyPerk(st, st.perkChoices[0]);
    st.spawnQueue = L.buildQueue(st);
    if (L.isBossWave(st)) spawnBoss(st);
    st.events.push({ type: 'wave' });
    return true;
  };

  L.nextWave = function (st) {
    if (st.phase !== 'clear') return false;
    if (st.wave >= C.waves) {
      st.phase = 'win';
      st.events.push({ type: 'win' });
      return true;
    }
    st.wave++;
    st.phase = 'build';
    st.buildT = C.buildTime;
    st.hpAtWaveStart = st.hp;
    L.rollPerks(st);
    st.events.push({ type: 'build' });
    return true;
  };

  /* ---------- улучшения между волнами ---------- */
  L.rollPerks = function (st) {
    var avail = [];
    for (var i = 0; i < C.perks.length; i++) {
      if (!st.perks[C.perks[i].id]) avail.push(C.perks[i].id);
    }
    for (var j = avail.length - 1; j > 0; j--) {
      var k = st.rng.int(0, j), t = avail[j]; avail[j] = avail[k]; avail[k] = t;
    }
    st.perkChoices = avail.slice(0, 3);
    return st.perkChoices;
  };
  L.applyPerk = function (st, id) {
    if (!st.perkChoices || st.perkChoices.indexOf(id) < 0) return false;
    st.perks[id] = 1;
    if (id === 'hull') { st.maxHp += 25; st.hp += 25; }
    if (id === 'repair') st.hp = st.maxHp;
    st.perkChoices = null;
    st.events.push({ type: 'perk', id: id });
    return true;
  };

  /* ---------- урон ---------- */
  function hitZombie(st, z, dmg) {
    if (z.dead) return;
    if (z.shield > 0) {
      z.shield -= dmg;
      if (z.shield < 0) { z.hp += z.shield; z.shield = 0; }
    } else {
      z.hp -= dmg;
    }
    st.hits++;
    var hitCoin = Math.round(C.economy.hit * (st.perks.coin ? 1.5 : 1));
    st.coins += hitCoin;
    st.earned += hitCoin;
    z.flash = 0.10;
    if (z.hp <= 0) {
      z.dead = true;
      z.deathT = 0;
      st.kills++;
      var gain = z.boss ? C.economy.boss : C.economy.kill;
      st.coins += gain;
      st.earned += gain;
      if (z.boss) st.bossKilled = true;
      st.events.push({ type: 'kill', lane: z.lane, d: z.d, boss: !!z.boss, gain: gain });
    }
  }

  function hitFort(st, z) {
    if (st.recordSafe) {
      st.events.push({ type: 'hurt', dmg: 0, boss: !!z.boss, lane: z.lane });
      return;
    }
    st.hp -= z.dmg;
    st.events.push({ type: 'hurt', dmg: z.dmg, boss: !!z.boss, lane: z.lane });
  }

  /* ---------- оружие ---------- */
  function eligible(st, def, lane) {
    var out = [];
    for (var i = 0; i < st.zombies.length; i++) {
      var z = st.zombies[i];
      if (z.dead) continue;
      if (z.air && !def.air) continue;
      if (z.d > def.range || z.d < -0.4) continue;
      if (def.mode === 'saw' || def.mode === 'chain') out.push(z);
      else if (def.mode === 'cone') { if (Math.abs(z.lane - lane) <= 1) out.push(z); }
      else if (z.lane === lane) out.push(z);
    }
    return out;
  }

  function pickTargets(st, def, lane) {
    var cand = eligible(st, def, lane);
    if (!cand.length) return cand;
    cand.sort(function (a, b) { return a.d - b.d; });
    var first = cand[0];
    if (def.mode === 'saw' || def.mode === 'cone' || def.mode === 'line') return cand;
    if (def.mode === 'single') return [first];
    if (def.mode === 'chain') {
      var out = [first], max = def.chain || 2, rest = [];
      for (var i = 1; i < cand.length; i++) {
        var z = cand[i];
        var dist = Math.abs(z.d - first.d) + Math.abs(z.lane - first.lane) * 1.4;
        if (dist <= 3.4) rest.push({ z: z, dist: dist });
      }
      rest.sort(function (a, b) { return a.dist - b.dist; });
      for (var j = 0; j < rest.length && out.length < max; j++) out.push(rest[j].z);
      return out;
    }
    if (def.mode === 'splash') {
      var out2 = [first];
      for (var q = 0; q < st.zombies.length; q++) {
        var zz = st.zombies[q];
        if (zz === first || zz.dead) continue;
        if (zz.air && !def.air) continue;
        var dd = Math.abs(zz.d - first.d) + Math.abs(zz.lane - first.lane) * 1.5;
        if (dd <= 1.8) out2.push(zz);
      }
      return out2;
    }
    return [first];
  }

  function fireAll(st, dt) {
    for (var i = 0; i < N; i++) {
      var it = st.layout[i];
      if (!it || it.k !== 'w') continue;
      var def = WEAP[it.t];
      if (!def) continue;
      var row = L.rowOf(i), lane = L.laneOf(i);
      it.blocked = row < def.rows[0] || row > def.rows[1];
      if (it.blocked) continue;
      it.cd = (it.cd || 0) - dt;
      if (it.cd > 0) continue;
      var targets = pickTargets(st, def, lane);
      if (!targets.length) continue;
      var rateMult = (st.perks.rate ? 0.85 : 1) * (1 - (st.bonus.rate || 0) * C.hangarStep.rate);
      it.cd = def.cd * rateMult;
      var dmgMult = 1 + (st.perks.dmg ? 0.20 : 0) + (st.bonus.dmg || 0) * C.hangarStep.dmg;
      var dmg = def.dmg * LVL[it.lvl - 1] * dmgMult;
      if (st.perks.crit && st.rng.float() < 0.10) dmg *= 2;
      var list = [];
      for (var k = 0; k < targets.length; k++) {
        list.push({ lane: targets[k].lane, d: targets[k].d, air: targets[k].air });
        hitZombie(st, targets[k], dmg);
      }
      if (st.shots.length > 48) st.shots.shift();
      st.shots.push({
        k: def.id, r: row, l: lane, t: 0,
        life: def.id === 'laser' ? 0.16 : 0.12, z: list
      });
      st.events.push({ type: 'shot', k: def.id });
    }
  }

  /* ---------- шаг боя ---------- */
  L.update = function (st, dt) {
    st.t += dt;
    var i;
    for (i = st.shots.length - 1; i >= 0; i--) {
      st.shots[i].t += dt;
      if (st.shots[i].t >= st.shots[i].life) st.shots.splice(i, 1);
    }

    if (st.phase === 'build') {
      if (!st.holdBuild) {
        st.buildT -= dt;
        if (st.buildT <= 0) { st.buildT = 0; L.startWave(st); }
      }
      return;
    }
    if (st.phase !== 'combat') return;

    st.combatT += dt;
    while (st.spawnQueue.length && st.spawnQueue[0].at <= st.combatT) {
      var sp = st.spawnQueue.shift();
      L.spawnZombie(st, sp.type, sp.lane, 8.4);
    }

    for (i = 0; i < st.zombies.length; i++) {
      var z = st.zombies[i];
      z.t += dt;
      if (z.flash > 0) z.flash -= dt;
      if (z.dead) { z.deathT += dt; continue; }
      if (z.d > CONTACT) {
        z.d -= z.speed * dt;
        if (z.d < CONTACT) z.d = CONTACT;
      } else {
        z.atk -= dt;
        if (z.atk <= 0) { z.atk = z.atkCd; hitFort(st, z); }
      }
      if (z.boss && z.spawnEvery) {
        z.spawnT -= dt;
        if (z.spawnT <= 0) {
          z.spawnT = z.spawnEvery;
          var nl = st.rng.int(0, LANES - 1);
          L.spawnZombie(st, 'runner', nl, Math.max(CONTACT + 0.3, z.d - 0.3));
          st.events.push({ type: 'spawn', lane: nl, d: Math.max(CONTACT + 0.3, z.d - 0.3) });
        }
      }
    }

    fireAll(st, dt);

    for (i = st.zombies.length - 1; i >= 0; i--) {
      if (st.zombies[i].dead && st.zombies[i].deathT > 0.7) st.zombies.splice(i, 1);
    }

    if (st.hp <= 0) {
      st.hp = 0;
      st.phase = 'over';
      st.events.push({ type: 'over' });
      return;
    }

    var alive = false;
    for (i = 0; i < st.zombies.length; i++) if (!st.zombies[i].dead) { alive = true; break; }
    if (!alive && !st.spawnQueue.length) {
      st.phase = 'clear';
      st.clearBonus = (st.hp >= st.hpAtWaveStart - 0.01) ? C.economy.noDamage : 0;
      if (st.clearBonus) { st.coins += st.clearBonus; st.earned += st.clearBonus; }
      st.events.push({ type: 'clear', bonus: st.clearBonus, boss: st.bossKilled });
    }
  };

  L.takeEvents = function (st) {
    var e = st.events;
    st.events = [];
    return e;
  };

  L.simulate = function (st, sec) {
    var n = Math.max(0, Math.round(sec * 60));
    for (var i = 0; i < n; i++) if (st.phase === 'combat' || st.phase === 'build') L.update(st, 1 / 60);
    return st;
  };

  /* ---------- сборка для capture / автопилота ---------- */
  L.planFor = function (chapter) {
    var p = [];
    function add(r, l, t, chUnlock) { if (chapter >= chUnlock) p.push({ r: r, l: l, t: t }); }
    p.push({ r: 1, l: 0, t: 'saw' }, { r: 1, l: 2, t: 'saw' }, { r: 2, l: 1, t: 'saw' });
    add(1, 1, 'shock', 2); add(2, 0, 'shock', 2);
    add(3, 0, 'flame', 3); add(3, 2, 'flame', 3); add(2, 2, 'flame', 3);
    add(4, 1, 'laser', 4); add(3, 1, 'laser', 4);
    add(5, 0, 'mg', 5); add(5, 2, 'mg', 5);
    add(6, 1, 'grenade', 6); add(6, 2, 'grenade', 6);
    return p;
  };

  L.autoBuild = function (st, opts) {
    opts = opts || {};
    var plan = L.planFor(st.chapter);
    var i;
    for (i = 0; i < plan.length; i++) {
      var it = plan[i];
      var idx = L.idx(it.r, it.l);
      if (st.layout[idx]) continue;
      if (st.coins < C.weaponPrice) break;
      L.placeWeapon(st, idx, it.t);
    }
    if (opts.level) {
      for (i = 0; i < N; i++) {
        var cell = st.layout[i];
        if (!cell || cell.k !== 'w') continue;
        while (cell.lvl < opts.level && st.coins >= C.upgradePrice[cell.lvl - 1]) L.upgradeItem(st, i);
      }
    }
    if (opts.blocks) {
      var spots = [L.idx(4, 0), L.idx(4, 2), L.idx(5, 1), L.idx(6, 0), L.idx(2, 0), L.idx(6, 1), L.idx(6, 2), L.idx(3, 1)];
      for (i = 0; i < spots.length && i < opts.blocks; i++) {
        if (!st.layout[spots[i]] && st.coins >= C.blockCost) L.placeBlock(st, spots[i]);
      }
    }
  };

  G.logic = L;
})(window.GAME);
