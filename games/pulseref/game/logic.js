/* game/logic.js — «Пульс»: детерминированные ритм-паттерны, окна попадания, комбо,
   пульс-жизнь и награда. Ни DOM, ни Math.random: весь рандом идёт через E.Rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config, L = {};
  var LANES = C.lanes, J = C.judge, PL = C.pulse, SC = C.score, ACC = C.acc;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function newSeedRng(seed) {
    var E = window.Engine;
    if (!E || !E.Rng) throw new Error('Engine.Rng is required');
    if (typeof seed === 'string') return new E.Rng(E.seedFromString(seed) || 1);
    var n = (seed != null ? (seed >>> 0) : 0) || 1;
    return new E.Rng(n);
  }

  /* ---------- этапы и песни ---------- */
  L.stageInfo = function (stage) {
    var s = clamp((stage | 0) || 1, 1, C.stages);
    var song, encore = 0;
    if (s <= C.songs.length) {
      song = C.songs[s - 1];
    } else {
      var k = s - C.songs.length - 1;
      var num = C.encore.songs[clamp(k, 0, C.encore.songs.length - 1)] || 1;
      song = C.songs[num - 1];
      encore = 1;
    }
    var bpm = Math.round(song.bpm * (encore ? C.encore.bpm : 1) * 10) / 10;
    return {
      stage: s, song: song, encore: encore, bpm: bpm, bars: song.bars,
      density: song.density + (encore ? 0.06 : 0), ghost: song.ghost + (encore ? 0.04 : 0),
      beat: 60 / bpm
    };
  };

  /* 0 — легко, 1 — средне, 2 — сложно, 3 — хардкор */
  L.difficultyFor = function (stage) {
    var s = clamp((stage | 0) || 1, 1, C.stages);
    if (s <= 3) return 0;
    if (s <= 6) return 1;
    if (s <= 9) return 2;
    return 3;
  };

  /* ---------- генератор карты ---------- */
  /* Паттерны по фразам из четырёх баров: вступление → разгон → дроп → перебивка.
     Так песня «дышит»: плотные дропы чередуются с разреженными перебивками. */
  function buildChart(info, seed) {
    var rng = newSeedRng(seed);
    var beat = info.beat;
    var lead = C.leadBeats * beat;
    var bars = info.bars;
    var notes = [];
    var stream = { lane: rng.int(0, LANES - 1) };

    function add(t, lane, ghost) {
      notes.push({
        t: Math.round(t * 10000) / 10000,
        lane: clamp(lane | 0, 0, LANES - 1),
        ghost: !!ghost, j: 0, g: ''
      });
    }
    function nextLane() {
      var l = stream.lane;
      if (rng.float() < 0.62) l += (rng.float() < 0.5 ? -1 : 1);
      else l = rng.int(0, LANES - 1);
      l = ((l % LANES) + LANES) % LANES;
      if (l === stream.lane) l = (l + 1) % LANES;
      stream.lane = l;
      return l;
    }
    function pairLane(base) { return (base + 2) % LANES; }

    for (var b = 0; b < bars; b++) {
      var bt = lead + b * 4 * beat;
      var phrase = Math.floor(b / 4) % 4;
      var energy = [0.18, 0.52, 0.95, 0.38][phrase];
      var prog = b / Math.max(1, bars - 1);
      var e = clamp(info.density + energy * 0.55 + prog * 0.2, 0.1, 1);
      var ghostChance = info.ghost * (phrase === 2 ? 1.4 : 0.7);
      var roll = rng.float();
      var kind;

      if (phrase === 0) kind = roll < 0.55 ? 'sparse' : 'quarters';
      else if (phrase === 1) kind = roll < 0.45 ? 'quarters' : (roll < 0.8 ? 'eighths' : 'gallop');
      else if (phrase === 2) kind = roll < 0.34 ? 'eighths' : (roll < 0.62 ? 'gallop' : (roll < 0.85 ? 'sync' : 'zigzag'));
      else kind = roll < 0.5 ? 'quarters' : (roll < 0.78 ? 'sparse' : 'ghostbar');

      var i;
      if (kind === 'sparse') {
        add(bt, nextLane(), false);
        if (rng.float() < 0.8) add(bt + 2 * beat, nextLane(), false);
      } else if (kind === 'quarters') {
        for (i = 0; i < 4; i++) {
          if (i === 0 || rng.float() < 0.55 + e * 0.4) add(bt + i * beat, nextLane(), false);
        }
      } else if (kind === 'eighths') {
        for (i = 0; i < 8; i++) {
          if (rng.float() < 0.38 + e * 0.55) add(bt + i * beat * 0.5, nextLane(), false);
        }
      } else if (kind === 'gallop') {
        for (i = 0; i < 4; i++) {
          add(bt + i * beat, nextLane(), false);
          if (rng.float() < 0.55) add(bt + i * beat + beat * 0.5, nextLane(), false);
          if (rng.float() < 0.30) add(bt + i * beat + beat * 0.75, nextLane(), false);
        }
      } else if (kind === 'sync') {
        var base = nextLane();
        add(bt, base, false); add(bt, pairLane(base), false);
        if (rng.float() < 0.7) {
          var b2 = nextLane();
          add(bt + 2 * beat, b2, false); add(bt + 2 * beat, pairLane(b2), false);
        }
        if (rng.float() < 0.5) add(bt + beat, nextLane(), false);
        if (rng.float() < 0.5) add(bt + 3 * beat, nextLane(), false);
      } else if (kind === 'zigzag') {
        for (i = 0; i < 8; i++) add(bt + i * beat * 0.5, nextLane(), false);
      } else {
        add(bt, nextLane(), false);
        add(bt + 2 * beat, nextLane(), false);
        add(bt + beat, rng.int(0, LANES - 1), true);
        add(bt + 3 * beat, rng.int(0, LANES - 1), true);
      }

      if (ghostChance > 0 && rng.float() < ghostChance) {
        add(bt + (rng.float() < 0.5 ? 0.5 : 2.5) * beat, rng.int(0, LANES - 1), true);
      }
      if (ghostChance > 0 && rng.float() < ghostChance * 0.6) {
        add(bt + 3.25 * beat, rng.int(0, LANES - 1), true);
      }
    }

    var end = lead + bars * 4 * beat;
    var fl = rng.int(0, LANES - 1);
    add(end - beat, fl, false);
    add(end - beat, pairLane(fl), false);

    /* Сортировка и чистка: в одной дорожке не чаще 0.12 с, фантом не садится
       ровно на тап-ноту (иначе нажатие всегда ловило бы одно и то же). */
    notes.sort(function (a, b) { return a.t - b.t || a.lane - b.lane; });
    /* В одной дорожке ноты не ближе окна GOOD (0.17 с): иначе тап не различит
       соседние ноты и вторая станет неберущейся. */
    var minGap = Math.min(0.22, Math.max(0.16, beat * 0.5));
    var out = [], lastByLane = {};
    for (var n = 0; n < notes.length; n++) {
      var note = notes[n];
      var prev = lastByLane[note.lane];
      if (prev != null && note.t - prev < minGap) continue;
      if (note.ghost) {
        var clash = false;
        for (var k = out.length - 1; k >= 0 && out[k].t > note.t - 0.17; k--) {
          if (out[k].lane === note.lane && Math.abs(out[k].t - note.t) < 0.17) { clash = true; break; }
        }
        if (clash) continue;
      }
      out.push(note);
      lastByLane[note.lane] = note.t;
    }
    return { notes: out, endT: end + 1.6 };
  }

  /* ---------- новый забег ---------- */
  L.newRun = function (o) {
    o = o || {};
    var stage = clamp((o.stage | 0) || 1, 1, C.stages);
    var info = L.stageInfo(stage);
    var seed = (o.seed != null) ? o.seed : (o.rng && o.rng.seed != null ? o.rng.seed : 1);
    var chart = buildChart(info, seed);
    var st = {
      stage: stage, info: info, beat: info.beat,
      notes: chart.notes, endT: chart.endT,
      time: 0, clock: 0,
      score: 0, combo: 0, maxCombo: 0,
      pulse: 1, shield: Math.max(0, o.shield | 0), shieldMax: Math.max(0, o.shield | 0),
      slowDur: Math.max(0, +o.slow || 0),
      coinMult: o.coinMult || 1,
      coinsF: 0, coinsEarned: 0, bonus: 0,
      miss: 0, ghostHits: 0, judged: 0, accSum: 0, accuracy: 0,
      perfect: 0, great: 0, good: 0,
      count: 0, ghostCount: 0, rank: 'C',
      phase: 'playing', auto: !!o.auto, recordSafe: false,
      events: [], mi: 0, ai: 0
    };
    for (var i = 0; i < st.notes.length; i++) {
      if (st.notes[i].ghost) st.ghostCount++; else st.count++;
    }
    return st;
  };

  /* ---------- служебное ---------- */
  L.duration = function (st) { return st.endT; };
  L.progress = function (st) { return clamp(st.time / Math.max(0.001, st.endT), 0, 1); };
  L.comboMult = function (st) { return 1 + Math.min(1, st.combo * 0.01); };
  L.takeEvents = function (st) { var e = st.events; st.events = []; return e; };

  /* ---------- судейство ---------- */
  function judge(st, n, grade) {
    n.j = 1; n.g = grade;
    st.judged++;
    if (grade === 'miss') {
      st.miss++;
      st.combo = 0;
      var loss = PL.miss;
      if (st.shield > 0) {
        st.shield--;
        loss = 0;
        st.events.push({ type: 'shield', lane: n.lane });
      }
      st.pulse = Math.max(0, st.pulse + loss);
      if (st.recordSafe && st.pulse < 0.35) st.pulse = 0.35;
      st.events.push({ type: 'miss', lane: n.lane, t: n.t });
      return;
    }
    st.accSum += ACC[grade];
    if (grade === 'perfect') st.perfect++;
    else if (grade === 'great') st.great++;
    else st.good++;
    st.combo++;
    if (st.combo > st.maxCombo) st.maxCombo = st.combo;
    st.pulse = Math.min(1, st.pulse + (PL[grade] || 0));
    var mult = 1 + Math.min(1, st.combo * 0.01);
    st.score += Math.round(SC[grade] * mult);
    st.coinsF += C.coins[grade] * st.coinMult;
    st.coinsEarned = Math.floor(st.coinsF);
    st.events.push({ type: 'hit', grade: grade, lane: n.lane, t: n.t });
    if (st.combo % 25 === 0) st.events.push({ type: 'milestone', combo: st.combo });
  }

  function autoHit(st) {
    while (st.ai < st.notes.length && st.notes[st.ai].t <= st.time) {
      var n = st.notes[st.ai++];
      if (n.j) continue;
      if (n.ghost) { n.j = 1; n.g = 'skip'; continue; }
      judge(st, n, 'perfect');
    }
  }

  function missPassed(st) {
    while (st.mi < st.notes.length && st.notes[st.mi].t + J.good < st.time) {
      var n = st.notes[st.mi++];
      if (n.j) continue;
      if (n.ghost) { n.j = 1; n.g = 'skip'; continue; }
      judge(st, n, 'miss');
    }
  }

  /* ---------- тап по дорожке ---------- */
  L.tap = function (st, lane) {
    if (st.phase !== 'playing') return null;
    lane = clamp(lane | 0, 0, LANES - 1);
    var best = null, bestAbs = 1e9;
    for (var i = 0; i < st.notes.length; i++) {
      var n = st.notes[i];
      if (n.j || n.lane !== lane) continue;
      var d = st.time - n.t;
      if (d < -J.good || d > J.good) continue;
      var ad = d < 0 ? -d : d;
      if (ad < bestAbs) { bestAbs = ad; best = n; }
    }
    if (!best) {
      st.events.push({ type: 'empty', lane: lane });
      return { type: 'empty' };
    }
    if (best.ghost) {
      best.j = 1; best.g = 'ghost';
      st.ghostHits++;
      st.combo = 0;
      st.pulse = Math.max(0, st.pulse + PL.ghost);
      if (st.recordSafe && st.pulse < 0.35) st.pulse = 0.35;
      st.events.push({ type: 'ghost', lane: lane });
      return { type: 'ghost', lane: lane };
    }
    var grade = bestAbs <= J.perfect ? 'perfect' : (bestAbs <= J.great ? 'great' : 'good');
    judge(st, best, grade);
    return { type: 'hit', grade: grade, lane: lane };
  };

  /* ---------- финал ---------- */
  L.finish = function (st, win) {
    if (st.phase !== 'playing') return;
    st.phase = win ? 'win' : 'over';
    var den = win ? st.count : Math.max(1, st.judged);
    st.accuracy = clamp(st.accSum / Math.max(1, den), 0, 1);
    if (win) {
      st.rank = st.accuracy >= 0.95 ? 'S' : (st.accuracy >= 0.85 ? 'A' : (st.accuracy >= 0.7 ? 'B' : 'C'));
      st.bonus = C.coins.clear + st.stage * C.coins.perStage + Math.round(st.accuracy * 60);
      st.coinsF += st.bonus;
      st.coinsEarned = Math.floor(st.coinsF);
    } else {
      st.rank = 'C';
    }
    st.events.push({ type: win ? 'win' : 'over' });
  };

  /* ---------- шаг ---------- */
  L.update = function (st, dt) {
    if (st.phase !== 'playing') return;
    st.clock += dt;
    var slow = st.slowDur > 0 && st.clock < st.slowDur;
    st.time += dt * (slow ? C.slowRate : 1);
    if (st.auto) autoHit(st);
    missPassed(st);
    if (st.phase !== 'playing') return;
    if (st.time >= st.endT) { L.finish(st, true); return; }
    if (st.pulse <= 0.0001 && !st.recordSafe) { st.pulse = 0; L.finish(st, false); }
  };

  L.simulate = function (st, sec) {
    var n = Math.max(0, Math.round(sec * 60));
    for (var i = 0; i < n && st.phase === 'playing'; i++) L.update(st, 1 / 60);
    return st;
  };

  G.logic = L;
})(window.GAME);
