/* game/logic.js — правила сдвижной доски (пятнашки).
   Состояние — плоский объект, любые изменения через move()/undo()/reset().
   Детерминизм: перемешивание идёт от E.Rng(seed), Math.random в логике нет.

   Доска: tiles[i] = номер плитки (1..n*n-1), 0 — пустая клетка.
   Перемешивание — N ходов от собранного вида без немедленного отката;
   обратная последовательность хранится как solution.
   solution[k] — это ИНДЕКС КЛЕТКИ, которую надо тапнуть на k-м ходе решения. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var L = {};

  /* ---------- геометрия ---------- */
  L.adj = function (n, i) {
    var r = (i / n) | 0, c = i % n;
    var out = [];
    if (r > 0) out.push(i - n);
    if (c < n - 1) out.push(i + 1);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    return out;
  };

  L.manhattan = function (n, tiles) {
    var d = 0;
    for (var i = 0; i < tiles.length; i++) {
      var v = tiles[i];
      if (!v) continue;
      var want = v - 1;
      d += Math.abs(((i / n) | 0) - ((want / n) | 0)) + Math.abs((i % n) - (want % n));
    }
    return d;
  };

  /* конфликт в линиях: две плитки одной цели в своей строке/столбце, но в обратном порядке */
  L.linearConflict = function (n, tiles) {
    var total = 0, r, c, a, b;
    for (r = 0; r < n; r++) {
      for (a = 0; a < n; a++) {
        var ia = r * n + a, va = tiles[ia];
        if (!va || ((va - 1) / n | 0) !== r) continue;
        for (b = a + 1; b < n; b++) {
          var ib = r * n + b, vb = tiles[ib];
          if (!vb || ((vb - 1) / n | 0) !== r) continue;
          if (va > vb) total += 2;
        }
      }
    }
    for (c = 0; c < n; c++) {
      for (a = 0; a < n; a++) {
        var ja = a * n + c, wa = tiles[ja];
        if (!wa || ((wa - 1) % n) !== c) continue;
        for (b = a + 1; b < n; b++) {
          var jb = b * n + c, wb = tiles[jb];
          if (!wb || ((wb - 1) % n) !== c) continue;
          if (wa > wb) total += 2;
        }
      }
    }
    return total;
  };

  L.heuristic = function (n, tiles) { return L.manhattan(n, tiles) + L.linearConflict(n, tiles); };

  L.keyArr = function (tiles) { return tiles.join(','); };

  L.solvedTiles = function (n, tiles) {
    var total = n * n;
    for (var i = 0; i < total - 1; i++) if (tiles[i] !== i + 1) return false;
    return tiles[total - 1] === 0;
  };

  L.solved = function (st) { return L.solvedTiles(st.n, st.tiles); };

  /* ---------- перемешивание ---------- */
  /* Самонепересекающийся случайный обход: если доска вернулась в уже виденное
     состояние, ход был лишним — такой обход отбрасывается и берётся новый.
     Это гарантирует, что пар равен реальной длине решения. */
  function walk(rng, n, steps) {
    var total = n * n, i;
    var tiles = new Array(total);
    for (i = 0; i < total - 1; i++) tiles[i] = i + 1;
    tiles[total - 1] = 0;
    var empty = total - 1;
    var seq = [];
    var lastFrom = -1;
    var seen = {};
    seen[L.keyArr(tiles)] = 1;
    var guard = 0;
    while (seq.length < steps && guard++ < steps * 60) {
      var opts = L.adj(n, empty), cand = [];
      for (i = 0; i < opts.length; i++) if (opts[i] !== lastFrom) cand.push(opts[i]);
      if (!cand.length) cand = opts;
      var slot = cand[rng.int(0, cand.length - 1)];
      var from = empty;
      tiles[from] = tiles[slot];
      tiles[slot] = 0;
      empty = slot;
      var key = L.keyArr(tiles);
      if (seen[key]) return null;          // замкнули петлю — обход не годится
      seen[key] = 1;
      seq.push({ slot: slot, from: from });
      lastFrom = from;
    }
    if (seq.length < steps) return null;
    var solution = [];
    for (i = seq.length - 1; i >= 0; i--) solution.push(seq[i].from);
    return { tiles: tiles, empty: empty, solution: solution };
  }

  /* аварийный обход, если случайный не сложился: четыре хода по спирали.
     Нужен только ради гарантии, что доска вообще существует. */
  function fixedWalk(n) {
    var tiles = [], i;
    for (i = 0; i < n * n - 1; i++) tiles.push(i + 1);
    tiles.push(0);
    var empty = n * n - 1, seq = [], from;
    var targets = [empty - 1, empty - 1 - n, empty - 2 - n, empty - 2 - 2 * n];
    for (i = 0; i < targets.length; i++) {
      var s = targets[i];
      if (s < 0 || s >= n * n) break;
      if (L.adj(n, empty).indexOf(s) < 0) break;
      from = empty;
      tiles[from] = tiles[s];
      tiles[s] = 0;
      empty = s;
      seq.push({ slot: s, from: from });
    }
    var solution = [];
    for (i = seq.length - 1; i >= 0; i--) solution.push(seq[i].from);
    return { tiles: tiles, empty: empty, solution: solution };
  }

  /* сколько шагов решения реально нужно до собранного вида (должно совпасть с par) */
  function replayLen(n, tiles, empty, solution) {
    var t = tiles.slice(), e = empty;
    for (var k = 0; k < solution.length; k++) {
      var s = solution[k];
      t[e] = t[s];
      t[s] = 0;
      e = s;
      if (L.solvedTiles(n, t)) return k + 1;
    }
    return -1;
  }

  /* Новая доска уровня. cfg = { n, scramble, limit }.
     Качество: доска не «почти собрана» (манхэттен >= порога) и решение
     не приводит к победе раньше пар-хода. */
  L.newPuzzle = function (rng, cfg) {
    var n = cfg.n, total = n * n;
    var minD = Math.min(cfg.scramble, Math.round(total * 0.8));
    var picked = null, fallback = null, attempt, w;
    for (attempt = 0; attempt < 40; attempt++) {
      w = walk(rng, n, cfg.scramble);
      if (!w) continue;
      if (!fallback) fallback = w;
      if (L.manhattan(n, w.tiles) < minD) continue;
      if (replayLen(n, w.tiles, w.empty, w.solution) !== w.solution.length) continue;
      picked = w;
      break;
    }
    if (!picked) picked = fallback || fixedWalk(n);

    var st = {
      n: n,
      tiles: picked.tiles,
      empty: picked.empty,
      moves: 0,
      limit: cfg.limit,
      par: picked.solution.length,
      solution: picked.solution,
      solIdx: 0,
      history: [],
      lastSlot: -1,
      lastFrom: -1,
      initTiles: picked.tiles.slice(),
      initEmpty: picked.empty
    };

    /* карта состояний вдоль решения: ключ -> индекс хода */
    st.pathKeys = [];
    st.pathMap = {};
    var t = st.initTiles.slice(), e = st.initEmpty;
    st.pathKeys.push(L.keyArr(t));
    st.pathMap[L.keyArr(t)] = 0;
    for (var k = 0; k < st.solution.length; k++) {
      var s = st.solution[k];
      t[e] = t[s];
      t[s] = 0;
      e = s;
      var key = L.keyArr(t);
      st.pathKeys.push(key);
      st.pathMap[key] = k + 1;
    }
    return st;
  };

  /* ---------- ходы ---------- */
  L.canMove = function (st, slot) {
    if (slot < 0 || slot >= st.n * st.n) return false;
    var a = L.adj(st.n, st.empty);
    for (var i = 0; i < a.length; i++) if (a[i] === slot) return true;
    return false;
  };

  L.movesLeft = function (st) { return Math.max(0, st.limit - st.moves); };

  L.move = function (st, slot) {
    if (!L.canMove(st, slot)) return false;
    st.history.push({
      tiles: st.tiles.slice(),
      empty: st.empty,
      moves: st.moves,
      solIdx: st.solIdx,
      lastFrom: st.lastFrom,
      lastSlot: st.lastSlot
    });
    if (st.history.length > 160) st.history.shift();
    var from = st.empty;
    st.tiles[from] = st.tiles[slot];
    st.tiles[slot] = 0;
    st.empty = slot;
    st.moves++;
    st.lastSlot = slot;
    st.lastFrom = from;
    /* позиция на сохранённой траектории пересчитывается по состоянию:
       откат или возврат игрока сам восстанавливает solIdx */
    var k = st.pathMap ? st.pathMap[L.keyArr(st.tiles)] : -1;
    st.solIdx = (k == null) ? -1 : k;
    return true;
  };

  L.undo = function (st) {
    if (!st.history.length) return false;
    var h = st.history.pop();
    st.tiles = h.tiles;
    st.empty = h.empty;
    st.moves = h.moves;
    st.solIdx = h.solIdx;
    st.lastFrom = h.lastFrom;
    st.lastSlot = h.lastSlot;
    return true;
  };

  L.reset = function (st) {
    st.tiles = st.initTiles.slice();
    st.empty = st.initEmpty;
    st.moves = 0;
    st.solIdx = 0;
    st.history = [];
    st.lastSlot = -1;
    st.lastFrom = -1;
    return st;
  };

  /* ---------- подсказки ---------- */

  /* Жадный ход по манхэттену + конфликтам линий, без немедленного отката. */
  function greedy(st) {
    var opts = L.adj(st.n, st.empty);
    var best = opts[0], bestD = Infinity;
    for (var i = 0; i < opts.length; i++) {
      var s = opts[i];
      var t = st.tiles.slice();
      t[st.empty] = t[s];
      t[s] = 0;
      var d = L.heuristic(st.n, t);
      if (s === st.lastFrom) d += 0.75;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /* BFS вглубь maxDepth: первый ход кратчайшего пути к ЛЮБОМУ состоянию
     сохранённого решения. Так подсказка никогда не уводит в тупик. */
  L.recoveryMove = function (st, maxDepth) {
    maxDepth = maxDepth || 8;
    var n = st.n;
    var startKey = L.keyArr(st.tiles);
    if (st.pathMap && st.pathMap[startKey] != null) {
      var idx = st.pathMap[startKey];
      return (idx < st.solution.length) ? st.solution[idx] : null;
    }
    if (!st.pathMap) return null;
    var visited = {};
    visited[startKey] = 1;
    var queue = [{ t: st.tiles.slice(), e: st.empty, first: -1, d: 0 }];
    var head = 0;
    while (head < queue.length && head < 22000) {
      var cur = queue[head++];
      if (cur.d >= maxDepth) continue;
      var opts = L.adj(n, cur.e);
      for (var i = 0; i < opts.length; i++) {
        var s = opts[i];
        var nt = cur.t.slice();
        nt[cur.e] = nt[s];
        nt[s] = 0;
        var key = L.keyArr(nt);
        if (visited[key]) continue;
        visited[key] = 1;
        var first = cur.first < 0 ? s : cur.first;
        if (st.pathMap[key] != null) return first;
        queue.push({ t: nt, e: s, first: first, d: cur.d + 1 });
      }
    }
    return null;
  };

  /* Следующий ход: точный шаг решения, иначе — кратчайший возврат на траекторию,
     и только в крайнем случае — жадный по эвристике. */
  L.nextHint = function (st) {
    if (st.solIdx >= 0 && st.solIdx < st.solution.length) return st.solution[st.solIdx];
    var rec = L.recoveryMove(st, 8);
    if (rec != null) return rec;
    return greedy(st);
  };

  L.applyStep = function (st) {
    if (L.solved(st)) return false;
    return L.move(st, L.nextHint(st));
  };

  G.logic = L;
})(window.GAME);
