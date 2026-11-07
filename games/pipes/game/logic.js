/* game/logic.js — головоломка «Трубы»: генерация уровня, повороты, поток воды.
   Чистая логика без DOM и без отрисовки. Детерминизм: весь рандом идёт через
   E.Rng; Math.random в логике запрещён. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;
  var C = G.config;
  var L = {};

  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // 0 верх, 1 право, 2 низ, 3 лево
  var BIT = [1, 2, 4, 8];
  var LEFT = 8, RIGHT = 2;

  L.DIRS = DIRS;
  L.BIT = BIT;
  L.LEFT = LEFT;
  L.RIGHT = RIGHT;

  function opp(d) { return (d + 2) & 3; }
  L.opp = opp;

  function idx(n, r, c) { return r * n + c; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* Поворот маски соединений на rot шагов по часовой стрелке. */
  L.rotMask = function (mask, rot) {
    rot = rot & 3;
    if (!rot) return mask;
    var out = 0;
    for (var d = 0; d < 4; d++) if (mask & BIT[d]) out |= BIT[(d + rot) & 3];
    return out;
  };

  function weighted(opts, rng) {
    var sum = 0, i;
    for (i = 0; i < opts.length; i++) sum += opts[i].w;
    var x = rng.float() * sum;
    for (i = 0; i < opts.length; i++) { x -= opts[i].w; if (x <= 0) return opts[i]; }
    return opts[opts.length - 1];
  }

  /* Случайный самоизбегающий обход сетки из (sr,sc) до первой клетки, где
     done(r,c) истинно. blocked(r,c) — запрещённые клетки, w — веса направлений. */
  function walk(n, sr, sc, done, blocked, w, rng, maxLen) {
    var path = [{ r: sr, c: sc }];
    var seen = {};
    seen[idx(n, sr, sc)] = 1;
    if (done(sr, sc)) return path;
    var cur = path[0];
    for (var step = 0; step < maxLen; step++) {
      var opts = [], d;
      for (d = 0; d < 4; d++) {
        var nr = cur.r + DIRS[d][0], nc = cur.c + DIRS[d][1];
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        if (seen[idx(n, nr, nc)] || blocked(nr, nc)) continue;
        opts.push({ r: nr, c: nc, w: w[d] });
      }
      if (!opts.length) return null;
      var p = weighted(opts, rng);
      seen[idx(n, p.r, p.c)] = 1;
      cur = { r: p.r, c: p.c };
      path.push(cur);
      if (done(cur.r, cur.c)) return path;
    }
    return null;
  }

  function turnsOf(path) {
    var t = 0;
    for (var i = 1; i < path.length - 1; i++) {
      var a = path[i], b = path[i - 1], c = path[i + 1];
      var d1r = a.r - b.r, d1c = a.c - b.c, d2r = c.r - a.r, d2c = c.c - a.c;
      if (d1r !== d2r || d1c !== d2c) t++;
    }
    return t;
  }

  /* Основной маршрут: кран в столбце 0 -> сток в последнем столбце. */
  function buildMain(n, rng, maxLen) {
    var sr = rng.int(0, n - 1);
    var tr = rng.int(0, n - 1);
    /* в последний столбец заходим только на нужной строке — иначе маршрут
       «прилипает» к правому краю и получается скучная прямая */
    var done = function (r, c) { return r === tr && c === n - 1; };
    var path = walk(n, sr, 0, done, function () { return false; }, [1.7, 2.5, 1.7, 0.7], rng, maxLen);
    if (!path) return null;
    return { path: path, src: sr, sink: tr };
  }

  /* Ответвление от второго крана к клетке основного маршрута: тройник/крест. */
  function buildBranch(n, path, rng, maxLen) {
    var onPath = {}, i, d;
    for (i = 0; i < path.length; i++) onPath[idx(n, path[i].r, path[i].c)] = 1;
    var cands = [];
    for (i = 1; i < path.length - 1; i++) {
      var p = path[i];
      if (p.c === 0) continue; // кран-кран соединять нельзя
      for (d = 0; d < 4; d++) {
        var nr = p.r + DIRS[d][0], nc = p.c + DIRS[d][1];
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        if (onPath[idx(n, nr, nc)]) continue;
        // левое ответвление выглядит естественнее: второй кран слева
        cands.push({ cell: i, r: nr, c: nc, d: d, w: d === 3 ? 2.6 : 1.2 });
      }
    }
    if (!cands.length) return null;
    for (var attempt = 0; attempt < 48; attempt++) {
      var pick = weighted(cands, rng);
      var bsrc = rng.int(0, n - 1);
      if (bsrc === path[0].r) continue;
      if (onPath[idx(n, bsrc, 0)]) continue;
      var target = pick;
      var br = walk(n, bsrc, 0,
        function (r, c) { return r === target.r && c === target.c; },
        function (r, c) { return !!onPath[idx(n, r, c)]; },
        [1.2, 2.4, 1.2, 0.8], rng, maxLen);
      if (!br || br.length < 2) continue;
      var j = pick.cell;
      br.push({ r: path[j].r, c: path[j].c });
      return { path: br, join: j, src: bsrc };
    }
    return null;
  }

  /* Маски соединений из клеток маршрута; концы получают вход от крана и выход в сток. */
  function buildTiles(n, path, branch) {
    var tiles = [], i;
    for (i = 0; i < n * n; i++) tiles.push(null);
    function ensure(r, c) {
      var k = idx(n, r, c);
      if (!tiles[k]) tiles[k] = { base: 0, rot: 0, mask: 0, anim: 0 };
      return tiles[k];
    }
    function connect(a, b) {
      var dr = b.r - a.r, dc = b.c - a.c, d;
      if (dr === -1) d = 0; else if (dc === 1) d = 1; else if (dr === 1) d = 2; else d = 3;
      ensure(a.r, a.c).base |= BIT[d];
      ensure(b.r, b.c).base |= BIT[opp(d)];
    }
    for (i = 0; i < path.length - 1; i++) connect(path[i], path[i + 1]);
    var src = path[0], sink = path[path.length - 1];
    ensure(src.r, src.c).base |= LEFT;
    ensure(sink.r, sink.c).base |= RIGHT;
    if (branch) {
      for (i = 0; i < branch.path.length - 1; i++) connect(branch.path[i], branch.path[i + 1]);
      ensure(branch.path[0].r, 0).base |= LEFT;
    }
    for (i = 0; i < tiles.length; i++) if (tiles[i]) tiles[i].mask = tiles[i].base;
    return tiles;
  }

  /* ---------- поток ---------- */
  function bfs(n, tiles, sr, sink) {
    var wet = {}, depth = {}, q = [];
    var res = { wet: wet, depth: depth, reached: false };
    var t0 = tiles[sr * n];
    if (!t0 || !(t0.mask & LEFT)) return res;
    wet[sr * n] = 1; depth[sr * n] = 0; q.push(sr * n);
    for (var qi = 0; qi < q.length; qi++) {
      var cell = q[qi], r = Math.floor(cell / n), c = cell % n, t = tiles[cell];
      for (var d = 0; d < 4; d++) {
        if (!(t.mask & BIT[d])) continue;
        var nr = r + DIRS[d][0], nc = c + DIRS[d][1];
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        var nk = nr * n + nc, nt = tiles[nk];
        if (!nt || !(nt.mask & BIT[opp(d)])) continue;
        if (wet[nk]) continue;
        wet[nk] = 1; depth[nk] = depth[cell] + 1; q.push(nk);
      }
    }
    res.reached = !!wet[sink * n + (n - 1)];
    return res;
  }

  L.analyzeState = function (n, tiles, sources, sink) {
    var out = { wet: {}, depth: {}, win: false, reaches: [], leaks: [] };
    var si, i, k;
    for (si = 0; si < sources.length; si++) {
      var res = bfs(n, tiles, sources[si], sink);
      out.reaches.push(res.reached);
      for (k in res.wet) {
        out.wet[k] = 1;
        if (out.depth[k] == null || res.depth[k] < out.depth[k]) out.depth[k] = res.depth[k];
      }
    }
    var sinkCell = sink * n + (n - 1);
    var stile = tiles[sinkCell];
    out.win = !!out.wet[sinkCell] && !!stile && !!(stile.mask & RIGHT);
    for (i = 0; i < out.reaches.length; i++) if (!out.reaches[i]) out.win = false;
    if (!sources.length) out.win = false;

    // открытые концы мокрых труб, ведущие в никуда: отсюда валит пар
    for (k in out.wet) {
      var cell = +k, r = Math.floor(cell / n), c = cell % n, t = tiles[cell];
      if (!t) continue;
      for (var d = 0; d < 4; d++) {
        if (!(t.mask & BIT[d])) continue;
        var isSrc = (c === 0 && d === 3 && sources.indexOf(r) >= 0);
        var isSink = (c === n - 1 && d === 1 && r === sink);
        if (isSrc || isSink) continue;
        var nr2 = r + DIRS[d][0], nc2 = c + DIRS[d][1];
        var nb = (nr2 >= 0 && nc2 >= 0 && nr2 < n && nc2 < n) ? tiles[nr2 * n + nc2] : null;
        if (nb && (nb.mask & BIT[opp(d)]) && out.wet[nr2 * n + nc2]) continue;
        if (out.leaks.length < 40) out.leaks.push({ cell: cell, d: d });
      }
    }
    return out;
  };

  L.analyze = function (st) {
    return L.analyzeState(st.n, st.tiles, st.sources, st.sink);
  };

  /* ---------- сборка уровня ---------- */
  function fallback(level, n) {
    var sr = 0, tr = n - 1;
    var path = [], r, c;
    for (c = 0; c < n; c++) path.push({ r: sr, c: c });
    for (r = sr + 1; r <= tr; r++) path.push({ r: r, c: n - 1 });
    var tiles = buildTiles(n, path, null);
    var order = [];
    for (var i = 0; i < path.length; i++) order.push(idx(n, path[i].r, path[i].c));
    return { n: n, tiles: tiles, sources: [sr], sink: tr, order: order, fallback: true };
  }

  L.generate = function (level, rng) {
    var cfg = C.levels[clamp(level, 1, C.levels.length) - 1];
    var n = cfg.size;
    var maxLen = n + 4 + Math.floor(level / 2);
    var dual = cfg.sources > 1;
    for (var attempt = 0; attempt < 300; attempt++) {
      var main = buildMain(n, rng, maxLen);
      if (!main) continue;
      if (main.path.length < n + 2) continue;
      if (turnsOf(main.path) < 2) continue;
      var branch = null;
      if (dual) {
        branch = buildBranch(n, main.path, rng, maxLen - 2);
        if (!branch) continue;
      }
      var built = buildTiles(n, main.path, branch);
      var out = { n: n, tiles: built, sources: [main.src], sink: main.sink, order: [] };
      if (branch) out.sources.push(branch.src);
      var i;
      for (i = 0; i < main.path.length; i++) out.order.push(idx(n, main.path[i].r, main.path[i].c));
      if (branch) for (i = 0; i < branch.path.length - 1; i++) out.order.push(idx(n, branch.path[i].r, branch.path[i].c));
      if (L.analyzeState(n, built, out.sources, out.sink).win) return out;
    }
    return fallback(level, n);
  };

  /* ---------- перемешивание ---------- */
  function tapsToBase(base, rot) {
    for (var k = 1; k <= 4; k++) {
      if (L.rotMask(base, (rot + k) & 3) === base) return k;
    }
    return 1;
  }

  L.scramble = function (st, rng) {
    var par = 0;
    for (var i = 0; i < st.tiles.length; i++) {
      var t = st.tiles[i];
      if (!t) continue;
      var straight = (t.base & BIT[0] && t.base & BIT[2]) || (t.base & BIT[1] && t.base & BIT[3]);
      var rot;
      if (straight) {
        rot = rng.chance(0.5) ? 1 : 3;      // прямая: любой поворот читается
      } else {
        rot = rng.chance(0.58) ? 3 : 2;     // угол: 1 или 2 поворота до решения
        if (L.rotMask(t.base, rot) === t.base) rot = 1;
      }
      t.rot = rot;
      t.mask = L.rotMask(t.base, rot);
      t.anim = 0;
      par += tapsToBase(t.base, rot);
    }
    st.par = par;
  };

  L.newState = function (o) {
    o = o || {};
    var level = clamp((o.level | 0) || 1, 1, C.levels.length);
    var cfg = C.levels[level - 1];
    var seed = (o.seed != null) ? o.seed : (level * 7919 + 17);
    var rng = new E.Rng(seed);
    var gen = L.generate(level, rng);
    var st = {
      level: level, n: gen.n, tiles: gen.tiles, sources: gen.sources, sink: gen.sink,
      order: gen.order, fallback: !!gen.fallback,
      par: 0, limit: 0, movesLeft: 0,
      coins: o.coins | 0, bought: {}, hintCell: -1,
      hints: 0, movesBought: 0, frees: 0, freezeT: 0,
      flowT: 0, solved: false, t: 0, rng: rng, events: [], seed: seed,
      flow: null
    };
    L.scramble(st, rng);
    st.limit = st.par + cfg.slack;
    st.movesLeft = st.limit;
    st.flow = L.analyze(st);
    return st;
  };

  /* ---------- ходы ---------- */
  L.rotate = function (st, cell) {
    var t = st.tiles[cell];
    if (!t || st.solved) return false;
    // без ходов повороты запрещены: иначе поражение можно отложить лишними тапами
    if (st.movesLeft <= 0) return false;
    t.rot = (t.rot + 1) & 3;
    t.mask = L.rotMask(t.base, t.rot);
    t.anim = 1;
    if (!(st.freezeT > 0)) st.movesLeft = Math.max(0, st.movesLeft - 1);
    st.flowT = 0;
    st.flow = L.analyze(st);
    st.events.push({ type: 'turn', cell: cell });
    if (st.flow.win) { st.solved = true; st.events.push({ type: 'solved' }); }
    return true;
  };

  L.tick = function (st, dt) {
    st.t += dt;
    st.flowT += dt;
    if (st.freezeT > 0) st.freezeT = Math.max(0, st.freezeT - dt);
    for (var i = 0; i < st.tiles.length; i++) {
      var t = st.tiles[i];
      if (t && t.anim > 0) t.anim = Math.max(0, t.anim - dt * 7);
    }
  };

  L.hint = function (st) {
    if (st.solved) return -1;
    for (var i = 0; i < st.order.length; i++) {
      var cell = st.order[i], t = st.tiles[cell];
      if (t && t.mask !== t.base) {
        t.rot = 0; t.mask = t.base; t.anim = 1;
        st.flowT = 0;
        st.flow = L.analyze(st);
        if (st.flow.win) { st.solved = true; st.events.push({ type: 'solved' }); }
        return cell;
      }
    }
    return -1;
  };

  /* Правильная ориентация для автопилота: первая «не та» труба по маршруту. */
  L.autoStep = function (st) {
    if (st.solved) return -1;
    for (var i = 0; i < st.order.length; i++) {
      var cell = st.order[i], t = st.tiles[cell];
      if (t && t.mask !== t.base) {
        t.rot = 0; t.mask = t.base; t.anim = 1;
        st.flowT = 0;
        st.flow = L.analyze(st);
        if (st.flow.win) { st.solved = true; st.events.push({ type: 'solved' }); }
        return cell;
      }
    }
    return -1;
  };

  L.solvePrefix = function (st, count) {
    for (var i = 0; i < Math.min(count, st.order.length); i++) {
      var cell = st.order[i], t = st.tiles[cell];
      if (t) { t.rot = 0; t.mask = t.base; }
    }
    st.flow = L.analyze(st);
    st.solved = !!st.flow.win;
    return st;
  };

  L.solveAll = function (st) {
    for (var i = 0; i < st.tiles.length; i++) {
      var t = st.tiles[i];
      if (t) { t.rot = 0; t.mask = t.base; }
    }
    st.flow = L.analyze(st);
    st.solved = true;
    return st;
  };

  /* ---------- магазин ---------- */
  L.itemDef = function (id) {
    for (var i = 0; i < C.shop.length; i++) if (C.shop[i].id === id) return C.shop[i];
    return null;
  };

  L.itemPrice = function (st, id) {
    var def = L.itemDef(id);
    if (!def) return 0;
    var n = st.bought[id] | 0;
    return def.base + def.step * n;
  };

  L.buy = function (st, id) {
    var def = L.itemDef(id);
    if (!def) return { ok: false, reason: 'unknown' };
    var price = L.itemPrice(st, id);
    if (st.coins < price) return { ok: false, reason: 'coins', price: price };
    st.coins -= price;
    st.bought[id] = (st.bought[id] | 0) + 1;
    var out = { ok: true, id: id, price: price, cell: -1, solved: false };
    if (id === 'hint') {
      var cell = L.hint(st);
      out.cell = cell;
      out.solved = st.solved;
      if (cell >= 0) st.hints++;
      if (cell >= 0) st.hintCell = cell;
    } else if (id === 'moves') {
      st.movesLeft += C.extraMoves;
      st.movesBought++;
      out.moves = C.extraMoves;
    } else if (id === 'freeze') {
      st.freezeT = C.freezeSeconds;
      st.frees++;
      out.seconds = C.freezeSeconds;
    }
    st.events.push({ type: 'buy', id: id });
    return out;
  };

  L.reward = function (st) {
    var base = C.economy.winBase + st.level * C.economy.perLevel + Math.max(0, st.movesLeft) * C.economy.perMoveLeft;
    var perfect = (st.hints === 0 && st.movesBought === 0) ? C.economy.perfect : 0;
    return { base: base, perfect: perfect, total: base + perfect };
  };

  L.takeEvents = function (st) {
    var e = st.events;
    st.events = [];
    return e;
  };

  G.logic = L;
})(window.GAME);
