/* game/logic.js — чистая логика «Свет-Плиток»: поле, крест-переключение, генерация
   уровня из «всё выключено», сохранённое решение, отмена, подсказка через решатель
   над GF(2). Никакого DOM, никакого Math.random: весь рандом — переданный E.Rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;
  var L = {};

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* Крест: сама клетка и четыре соседа. Возвращает список переключённых индексов. */
  L.cross = function (idx, n) {
    var out = [idx];
    var r = (idx / n) | 0, c = idx % n;
    if (r > 0) out.push(idx - n);
    if (r < n - 1) out.push(idx + n);
    if (c > 0) out.push(idx - 1);
    if (c < n - 1) out.push(idx + 1);
    return out;
  };

  L.toggleCross = function (cells, n, idx) {
    var list = L.cross(idx, n);
    for (var i = 0; i < list.length; i++) cells[list[i]] = cells[list[i]] ? 0 : 1;
    return list;
  };

  L.countLit = function (st) {
    var n = 0, c = st.cells;
    for (var i = 0; i < c.length; i++) if (c[i]) n++;
    return n;
  };
  L.won = function (st) { return L.countLit(st) === 0; };
  L.outOfMoves = function (st) { return !L.won(st) && st.moves >= st.limit; };

  /* Решатель над GF(2): A·x = b, где A — матрица крестов сетки n×n, b — включённые
     огни. Возвращает набор нажатий, гасящих поле, или null, если решения нет.
     Нужен для подсказки: игрок мог уйти от сохранённого решения. */
  L.solve = function (cells, n) {
    var N = n * n;
    var rows = [];
    for (var i = 0; i < N; i++) {
      var row = new Uint8Array(N + 1);
      var cr = L.cross(i, n);
      for (var j = 0; j < cr.length; j++) row[cr[j]] = 1;
      row[N] = cells[i] ? 1 : 0;
      rows.push(row);
    }
    var where = new Array(N);
    for (var z = 0; z < N; z++) where[z] = -1;
    var rowI = 0;
    for (var col = 0; col < N && rowI < N; col++) {
      var sel = -1;
      for (var r2 = rowI; r2 < N; r2++) if (rows[r2][col]) { sel = r2; break; }
      if (sel < 0) continue;
      var tmp = rows[rowI]; rows[rowI] = rows[sel]; rows[sel] = tmp;
      var pivot = rows[rowI];
      for (var r3 = 0; r3 < N; r3++) {
        if (r3 === rowI) continue;
        var cur = rows[r3];
        if (!cur[col]) continue;
        for (var k = col; k <= N; k++) cur[k] ^= pivot[k];
      }
      where[col] = rowI;
      rowI++;
    }
    for (var rc = rowI; rc < N; rc++) if (rows[rc][N]) return null; // несовместно
    var out = [];
    for (var c2 = 0; c2 < N; c2++) {
      if (where[c2] >= 0 && rows[where[c2]][N]) out.push(c2);
    }
    return out;
  };

  /* Новый уровень: старт «всё выключено», затем cfg.presses случайных РАЗНЫХ
     нажатий. Эта же последовательность — сохранённое решение (нажатия
     коммутируют, поэтому порядок не важен). */
  L.newGame = function (rng, levelIdx) {
    var lv = clamp(levelIdx | 0, 0, C.levels.length - 1);
    var cfg = C.levels[lv];
    var n = cfg.n, N = n * n;
    var cells = new Array(N);
    for (var i = 0; i < N; i++) cells[i] = 0;

    var chosen = {};
    var sol = [];
    var guard = 0;
    while (sol.length < cfg.presses && guard < 900) {
      guard++;
      var idx = rng.int(0, N - 1);
      if (chosen[idx]) continue;
      chosen[idx] = 1;
      sol.push(idx);
      L.toggleCross(cells, n, idx);
    }
    // вырожденный случай: нажатия взаимно погасились и поле пустое — добавим центр
    if (L.countLit({ cells: cells }) === 0) {
      var mid = ((n / 2) | 0) * n + ((n / 2) | 0);
      sol.push(mid);
      L.toggleCross(cells, n, mid);
    }
    // порядок показа решения для автопилота перемешиваем тем же rng
    for (var s = sol.length - 1; s > 0; s--) {
      var j = rng.int(0, s);
      var t = sol[s]; sol[s] = sol[j]; sol[j] = t;
    }

    return {
      level: lv,
      n: n, N: N,
      cells: cells,
      sol: sol.slice(),
      par: sol.length,
      moves: 0,
      limit: sol.length + cfg.slack,
      history: [],
      hintUsed: 0,
      undoUsed: 0,
      bought: { hint: 0, undo: 0, move: 0 },
      last: -1,
      solIdx: 0
    };
  };

  /* Нажатие. free=true — подсказка: не тратит ход и не пишется в отмену как ход. */
  L.press = function (st, idx, free) {
    if (!st || idx < 0 || idx >= st.N) return null;
    var toggled = L.toggleCross(st.cells, st.n, idx);
    st.history.push({ i: idx, free: !!free });
    if (!free) st.moves++;
    st.last = idx;
    return toggled;
  };

  /* Отмена последнего нажатия: поле возвращается, ход — тоже. */
  L.undo = function (st) {
    if (!st || !st.history.length) return null;
    var e = st.history.pop();
    var toggled = L.toggleCross(st.cells, st.n, e.i);
    if (!e.free && st.moves > 0) st.moves--;
    st.undoUsed++;
    st.last = e.i;
    return { idx: e.i, toggled: toggled };
  };

  /* Подсказка: решает ТЕКУЩЕЕ поле и возвращает одно нажатие из решения. */
  L.hintIdx = function (st) {
    if (!st || L.won(st)) return -1;
    var sol = L.solve(st.cells, st.n);
    if (!sol || !sol.length) return -1;
    return sol[0];
  };

  /* Автопилот: следующее нажатие сохранённого решения. Если поле уже ушло от
     сохранённого решения (подсказка/чужая рука) — досчитываем решателем. */
  L.autoNext = function (st) {
    if (!st || L.won(st)) return -1;
    while (st.solIdx < st.sol.length) {
      var idx = st.sol[st.solIdx++];
      var test = st.cells.slice();
      L.toggleCross(test, st.n, idx);
      // сохранённое нажатие обязано быть частью решения текущего поля —
      // проверяем, что после него поле всё ещё решаемо
      if (L.solve(test, st.n)) return idx;
      st.solIdx--; // поле ушло от сохранённого решения — выходим из цикла
      break;
    }
    return L.hintIdx(st);
  };

  /* Награда за уровень: базово + номер + сэкономленные ходы + бонус за чистоту. */
  L.reward = function (st) {
    var e = C.economy;
    var left = Math.max(0, st.limit - st.moves);
    var r = e.base + st.level * e.perLevel + left * e.perMoveLeft;
    if (st.hintUsed === 0 && st.undoUsed === 0) r += e.cleanBonus;
    return r;
  };

  L.priceOf = function (st, item) {
    return item.price + item.step * (st.bought[item.id] | 0);
  };

  G.logic = L;
})(window.GAME);
