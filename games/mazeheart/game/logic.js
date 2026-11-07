/* game/logic.js — чистая логика «Сердца Лабиринта»: генерация лабиринта DFS + расплетение
   тупиков, маршруты дозорных, шар, ключи, выход, поимка, BFS-автопилот и симуляция.
   Никакого DOM, никакого Math.random: только переданный E.Rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var E = window.Engine, C = G.config;

  /* Направления: 0 — север, 1 — восток, 2 — юг, 3 — запад. */
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var OPP = [2, 3, 0, 1];
  var BIT = [1, 2, 4, 8];

  var L = {};

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  L.stepCell = function (m, c, d) {
    if (m.walls[c] & BIT[d]) return -1;
    var x = (c % m.w) + DX[d], y = ((c / m.w) | 0) + DY[d];
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return -1;
    return y * m.w + x;
  };

  L.dirBetween = function (m, a, b) {
    for (var d = 0; d < 4; d++) if (L.stepCell(m, a, d) === b) return d;
    return -1;
  };

  L.cellXY = function (m, c) { return { x: c % m.w, y: (c / m.w) | 0 }; };
  L.cellCenter = function (m, c) { return { x: (c % m.w) + 0.5, y: ((c / m.w) | 0) + 0.5 }; };

  L.openNeighbors = function (m, c) {
    var out = [];
    for (var d = 0; d < 4; d++) {
      var n = L.stepCell(m, c, d);
      if (n >= 0) out.push(n);
    }
    return out;
  };

  /* ---------- генерация ---------- */
  L.genMaze = function (w, h, rng, braidP) {
    var n = w * h, walls = new Array(n), i;
    for (i = 0; i < n; i++) walls[i] = 15;
    var vis = new Uint8Array(n), stack = [0];
    vis[0] = 1;
    while (stack.length) {
      var c = stack[stack.length - 1], x = c % w, y = (c / w) | 0, opts = [];
      if (y > 0 && !vis[c - w]) opts.push(0);
      if (x < w - 1 && !vis[c + 1]) opts.push(1);
      if (y < h - 1 && !vis[c + w]) opts.push(2);
      if (x > 0 && !vis[c - 1]) opts.push(3);
      if (!opts.length) { stack.pop(); continue; }
      var d = opts[rng.int(0, opts.length - 1)];
      var nx = x + DX[d], ny = y + DY[d], nc = ny * w + nx;
      walls[c] &= ~BIT[d];
      walls[nc] &= ~BIT[OPP[d]];
      vis[nc] = 1;
      stack.push(nc);
    }
    /* Расплетение: часть тупиков открываем — появляются кольца, по которым могут ходить
       дозорные, и у игрока есть куда срезать, а не только назад. */
    for (i = 0; i < n; i++) {
      var deg = 0, dd;
      for (dd = 0; dd < 4; dd++) if (!(walls[i] & BIT[dd])) deg++;
      if (deg !== 1 || !rng.chance(braidP)) continue;
      var closed = [];
      for (dd = 0; dd < 4; dd++) {
        if (!(walls[i] & BIT[dd])) continue;
        var bx = (i % w) + DX[dd], by = ((i / w) | 0) + DY[dd];
        if (bx >= 0 && by >= 0 && bx < w && by < h) closed.push(dd);
      }
      if (!closed.length) continue;
      var od = closed[rng.int(0, closed.length - 1)];
      var ox = (i % w) + DX[od], oy = ((i / w) | 0) + DY[od], oc = oy * w + ox;
      walls[i] &= ~BIT[od];
      walls[oc] &= ~BIT[OPP[od]];
    }
    return { w: w, h: h, walls: walls };
  };

  /* ---------- поиск ---------- */
  L.distMap = function (m, from) {
    var n = m.w * m.h, dist = new Int32Array(n);
    for (var i = 0; i < n; i++) dist[i] = -1;
    var q = [from];
    dist[from] = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi];
      for (var d = 0; d < 4; d++) {
        var nc = L.stepCell(m, c, d);
        if (nc < 0 || dist[nc] >= 0) continue;
        dist[nc] = dist[c] + 1;
        q.push(nc);
      }
    }
    return dist;
  };

  L.bfs = function (m, from, to) {
    if (from === to) return [from];
    var n = m.w * m.h, prev = new Int32Array(n), seen = new Uint8Array(n), i;
    for (i = 0; i < n; i++) prev[i] = -1;
    var q = [from];
    seen[from] = 1;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi];
      for (var d = 0; d < 4; d++) {
        var nc = L.stepCell(m, c, d);
        if (nc < 0 || seen[nc]) continue;
        seen[nc] = 1;
        prev[nc] = c;
        if (nc === to) {
          var path = [nc], p = nc;
          while (p !== from) { p = prev[p]; path.push(p); }
          path.reverse();
          return path;
        }
        q.push(nc);
      }
    }
    return null;
  };

  /* ---------- дозорные ---------- */
  function guardRoute(m, rng, minLen) {
    var total = m.w * m.h;
    for (var attempt = 0; attempt < 60; attempt++) {
      var start = rng.int(0, total - 1);
      var cells = [start], seen = {}, cur = start, closed = -1;
      seen[start] = 0;
      for (var s = 0; s < 400; s++) {
        var nb = L.openNeighbors(m, cur);
        if (!nb.length) break;
        var choices = [], i;
        for (i = 0; i < nb.length; i++) {
          if (cells.length > 1 && nb[i] === cells[cells.length - 2]) continue;
          choices.push(nb[i]);
        }
        if (!choices.length) choices = nb;
        var nxt = choices[rng.int(0, choices.length - 1)];
        var at = seen[nxt];
        if (at != null) {
          if (cells.length - at >= minLen) { closed = at; break; }
          cur = nxt;
          continue;
        }
        seen[nxt] = cells.length;
        cells.push(nxt);
        cur = nxt;
      }
      if (closed >= 0) return { cells: cells.slice(closed), loop: true };
      if (cells.length >= minLen) return { cells: cells, loop: false };
    }
    var fallback = L.bfs(m, 0, total - 1) || [0];
    return { cells: fallback, loop: false };
  }

  function syncGuard(g, m) {
    var len = g.route.length;
    if (len === 1) {
      var only = L.cellCenter(m, g.route[0]);
      g.x = only.x; g.y = only.y;
      return;
    }
    var i0 = Math.floor(g.pos);
    if (i0 < 0) i0 = 0;
    if (i0 > len - 1) i0 = len - 1;
    var f = g.pos - i0;
    if (f < 0) f = 0;
    if (f > 1) f = 1;
    var i1 = i0 + 1;
    if (i1 > len - 1) i1 = g.loop ? 0 : len - 1;
    var a = L.cellCenter(m, g.route[i0]), b = L.cellCenter(m, g.route[i1]);
    g.x = a.x + (b.x - a.x) * f;
    g.y = a.y + (b.y - a.y) * f;
  }

  function advanceGuard(g, dt, m, stunned) {
    if (stunned) { syncGuard(g, m); return; }
    var len = g.route.length;
    if (len < 2) { syncGuard(g, m); return; }
    if (g.loop) {
      g.pos += g.dir * g.speed * dt;
      g.pos = ((g.pos % len) + len) % len;
    } else {
      g.pos += g.dir * g.speed * dt;
      if (g.pos > len - 1) { g.pos = 2 * (len - 1) - g.pos; g.dir = -1; }
      if (g.pos < 0) { g.pos = -g.pos; g.dir = 1; }
      g.pos = clamp(g.pos, 0, len - 1);
    }
    syncGuard(g, m);
  }

  /* ---------- ключи ---------- */
  /* Ключи раскладываем по РАЗНЫМ веткам: считаем не манхэттен, а расстояние по коридорам
     (BFS), и каждый следующий ключ берём максимально далёкий от уже выбранных и от старта.
     Иначе в древесном лабиринте все ключи оказываются на одной длинной коридоре с выходом. */
  function pickKeys(m, start, exit, dist, rng) {
    var n = m.w * m.h, pool = [], i, c;
    var maxD = Math.max(1, dist[exit]);
    for (c = 0; c < n; c++) {
      if (c === start || c === exit) continue;
      if (dist[c] >= Math.max(2, Math.floor(maxD * 0.30))) pool.push(c);
    }
    if (pool.length < C.keysPerLevel) {
      pool = [];
      for (c = 0; c < n; c++) if (c !== start && c !== exit) pool.push(c);
    }
    if (!pool.length) return [{ cell: start, taken: false }];
    var far = pool.slice().sort(function (a, b) { return dist[b] - dist[a]; });
    var topN = Math.max(1, Math.min(far.length, Math.ceil(far.length * 0.4)));
    var chosen = [far[rng.int(0, topN - 1)]];
    var maps = [L.distMap(m, chosen[0]), dist];
    while (chosen.length < C.keysPerLevel) {
      var best = -1, bestScore = -1;
      for (i = 0; i < pool.length; i++) {
        var cand = pool[i];
        if (chosen.indexOf(cand) >= 0) continue;
        var score = 1e9;
        for (var j = 0; j < maps.length; j++) {
          var dd = maps[j][cand];
          if (dd >= 0 && dd < score) score = dd;
        }
        if (score > bestScore) { bestScore = score; best = cand; }
      }
      if (best < 0) break;
      chosen.push(best);
      maps.push(L.distMap(m, best));
    }
    var out = [];
    for (i = 0; i < chosen.length; i++) out.push({ cell: chosen[i], taken: false });
    return out;
  }

  /* ---------- уровень ---------- */
  L.newLevel = function (o) {
    o = o || {};
    var level = clamp(o.level | 0, 1, C.levels.length) || 1;
    var cfg = C.levels[level - 1];
    var seed = (o.seed == null ? 1 : o.seed) >>> 0;
    var rng = new E.Rng(seed);
    var m = L.genMaze(cfg.c, cfg.r, rng, cfg.braid);
    var n = m.w * m.h, i;
    var start = 0;
    var dist = L.distMap(m, start);
    var exit = 0;
    for (i = 1; i < n; i++) if (dist[i] > dist[exit]) exit = i;
    var st = {
      level: level,
      seed: seed,
      w: m.w, h: m.h, m: m,
      start: start,
      exit: exit,
      keys: pickKeys(m, start, exit, dist, rng),
      keysTaken: 0,
      ball: { cell: start, from: start, k: 1 },
      reviveAt: start,
      guards: [],
      maxLives: C.baseLives,
      lives: C.baseLives,
      shields: 0,
      inv: C.graceStart,
      stun: 0,
      time: 0,
      moves: 0,
      phase: 'run',
      recordSafe: false,
      events: [],
      autoCd: 0
    };
    for (var gi = 0; gi < cfg.guards; gi++) {
      var route = guardRoute(m, rng, 6 + gi * 2);
      var bestPos = 0, bestD = -1;
      for (var ri = 0; ri < route.cells.length; ri++) {
        var dd = dist[route.cells[ri]];
        if (dd > bestD) { bestD = dd; bestPos = ri; }
      }
      var g = {
        route: route.cells,
        loop: route.loop,
        pos: bestPos + rng.range(0.05, 0.95),
        dir: rng.chance(0.5) ? 1 : -1,
        speed: cfg.speed * (1 + gi * 0.06),
        x: 0, y: 0,
        alert: 0
      };
      if (!g.loop) g.pos = clamp(g.pos, 0, route.cells.length - 1);
      syncGuard(g, m);
      st.guards.push(g);
    }
    return st;
  };

  L.ballPos = function (st) {
    var a = L.cellCenter(st.m, st.ball.from), b = L.cellCenter(st.m, st.ball.cell);
    var k = st.ball.k;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  L.move = function (st, d) {
    if (!st || st.phase !== 'run') return false;
    var nc = L.stepCell(st.m, st.ball.cell, d);
    if (nc < 0) {
      st.events.push({ t: 'bump' });
      return false;
    }
    st.ball.from = st.ball.cell;
    st.ball.cell = nc;
    st.ball.k = 0;
    st.moves++;
    for (var i = 0; i < st.keys.length; i++) {
      var k = st.keys[i];
      if (!k.taken && k.cell === nc) {
        k.taken = true;
        st.keysTaken++;
        st.reviveAt = nc;
        st.events.push({ t: 'key', n: st.keysTaken, cell: nc });
      }
    }
    if (nc === st.exit && st.keysTaken >= st.keys.length) {
      st.phase = 'win';
      st.events.push({ t: 'win' });
    }
    return true;
  };

  function respawn(st) {
    st.ball.from = st.reviveAt;
    st.ball.cell = st.reviveAt;
    st.ball.k = 1;
    st.inv = C.graceRespawn;
    st.stun = C.stunAfterHit;
  }

  function hit(st, gi) {
    if (st.inv > 0 || st.phase !== 'run' || st.recordSafe) return;
    if (st.shields > 0) {
      st.shields--;
      st.inv = 1.2;
      st.events.push({ t: 'shield', gi: gi, left: st.shields });
      return;
    }
    st.lives--;
    st.guards[gi].alert = 0.6;
    st.events.push({ t: 'caught', gi: gi, lives: st.lives });
    if (st.lives <= 0) {
      st.phase = 'over';
      st.events.push({ t: 'over' });
      return;
    }
    respawn(st);
  }

  L.step = function (st, dt) {
    if (!st) return;
    st.time += dt;
    if (st.phase !== 'run') return;
    var b = st.ball, i;
    if (b.k < 1) {
      b.k += dt / C.stepDur;
      if (b.k >= 1) { b.k = 1; b.from = b.cell; }
    }
    if (st.inv > 0) st.inv -= dt;
    if (st.stun > 0) st.stun -= dt;
    var stunned = st.stun > 0;
    for (i = 0; i < st.guards.length; i++) {
      var g = st.guards[i];
      if (g.alert > 0) g.alert -= dt;
      advanceGuard(g, dt, st.m, stunned);
    }
    if (st.phase !== 'run' || st.inv > 0) return;
    var bp = L.ballPos(st);
    for (i = 0; i < st.guards.length; i++) {
      var gp = st.guards[i], dx = gp.x - bp.x, dy = gp.y - bp.y;
      if (dx * dx + dy * dy < C.catchR * C.catchR) { hit(st, i); break; }
    }
  };

  /* ---------- автопилот (BFS к ближайшему ключу, затем к выходу) ---------- */
  L.autoStep = function (st) {
    if (!st || st.phase !== 'run') return -1;
    var from = st.ball.cell, best = null, i;
    if (st.keysTaken < st.keys.length) {
      for (i = 0; i < st.keys.length; i++) {
        var k = st.keys[i];
        if (k.taken) continue;
        var p = L.bfs(st.m, from, k.cell);
        if (p && (!best || p.length < best.length)) best = p;
      }
    } else {
      best = L.bfs(st.m, from, st.exit);
    }
    if (!best || best.length < 2) return -1;
    return L.dirBetween(st.m, best[0], best[1]);
  };

  L.simulate = function (st, seconds, opt) {
    opt = opt || {};
    var n = Math.max(1, Math.round(seconds * 60));
    var safePrev = st.recordSafe;
    st.recordSafe = true;
    for (var i = 0; i < n; i++) {
      if (st.autoCd > 0) st.autoCd -= 1 / 60;
      else {
        var d = L.autoStep(st);
        if (d >= 0) L.move(st, d);
        st.autoCd = C.autoCd;
      }
      L.step(st, 1 / 60);
      if (st.phase !== 'run') break;
    }
    st.events.length = 0;
    st.recordSafe = opt.keepSafe ? true : safePrev;
    st.ball.k = 1;
    st.ball.from = st.ball.cell;
    st.inv = Math.max(st.inv, 0.4);
    return st;
  };

  L.clamp = clamp;
  L.guardPos = function (g, m) { syncGuard(g, m); return { x: g.x, y: g.y }; };

  G.logic = L;
})(window.GAME);
