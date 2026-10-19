/* game/entities.js — логика «Сладкого Рая»: доска, свапы, совпадения, каскады, refill.
   board[r][c] = индекс вида | -1 пусто. Все правила детерминированны rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;

  function cloneBoard(b) { return b.map(function (r) { return r.slice(); }); }
  function inBoard(r, c) { return r >= 0 && r < C.board.rows && c >= 0 && c < C.board.cols; }

  /* ---------- поиск совпадений: возвращает Set ключей "r,c" ---------- */
  function findMatches(b, kinds) {
    var hit = {};
    var R = C.board.rows, Cc = C.board.cols;
    var r, c, k;
    // горизонтали
    for (r = 0; r < R; r++) {
      c = 0;
      while (c < Cc) {
        var v = b[r][c];
        if (v < 0) { c++; continue; }
        var run = 1;
        while (c + run < Cc && b[r][c + run] === v) run++;
        if (run >= 3) for (k = 0; k < run; k++) hit[r + ',' + (c + k)] = true;
        c += run;
      }
    }
    // вертикали
    for (c = 0; c < Cc; c++) {
      r = 0;
      while (r < R) {
        var vv = b[r][c];
        if (vv < 0) { r++; continue; }
        var run2 = 1;
        while (r + run2 < R && b[r + run2][c] === vv) run2++;
        if (run2 >= 3) for (k = 0; k < run2; k++) hit[(r + k) + ',' + c] = true;
        r += run2;
      }
    }
    return hit;
  }

  /* ---------- есть ли хоть один легальный свап ---------- */
  function anyMove(b, kinds) {
    var R = C.board.rows, Cc = C.board.cols;
    for (var r = 0; r < R; r++) for (var c = 0; c < Cc; c++) {
      if (b[r][c] < 0) continue;
      var dirs = [[0, 1], [1, 0]];
      for (var d = 0; d < 2; d++) {
        var r2 = r + dirs[d][0], c2 = c + dirs[d][1];
        if (!inBoard(r2, c2) || b[r2][c2] < 0) continue;
        if (b[r][c] === b[r2][c2]) continue;
        var t = b[r][c]; b[r][c] = b[r2][c2]; b[r2][c2] = t;
        var m = findMatches(b, kinds);
        var t2 = b[r][c]; b[r][c] = b[r2][c2]; b[r2][c2] = t2; // вернуть
        if (Object.keys(m).length) return true;
      }
    }
    return false;
  }

  /* ---------- новая доска: без стартовых троек, с хотя бы одним ходом ---------- */
  function freshBoard(level, rng) {
    var kinds = C.kindsCount(level);
    var R = C.board.rows, Cc = C.board.cols;
    for (var attempt = 0; attempt < 60; attempt++) {
      var b = [];
      for (var r = 0; r < R; r++) {
        var row = [];
        for (var c = 0; c < Cc; c++) {
          var v;
          var guard = 0;
          do {
            v = Math.floor(rng.float() * kinds) % kinds;
            guard++;
          } while (guard < 24 &&
            ((c >= 2 && row[c - 1] === v && row[c - 2] === v) ||
             (r >= 2 && b[r - 1][c] === v && b[r - 2][c] === v)));
          row.push(v);
        }
        b.push(row);
      }
      if (anyMove(b, kinds)) return b;
    }
    return b; // крайний случай
  }

  /* ---------- свап легален? ---------- */
  function legalSwap(b, r1, c1, r2, c2, kinds) {
    if (!inBoard(r1, c1) || !inBoard(r2, c2)) return false;
    var dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
    if (dr + dc !== 1) return false;
    var t = b[r1][c1]; b[r1][c1] = b[r2][c2]; b[r2][c2] = t;
    var ok = Object.keys(findMatches(b, kinds)).length > 0;
    var t2 = b[r1][c1]; b[r1][c1] = b[r2][c2]; b[r2][c2] = t2;
    return ok;
  }

  /* ---------- удалить совпадения и обрушить (гравитация вниз) ---------- */
  function clearAndDrop(b, matched, kinds, rng) {
    var R = C.board.rows, Cc = C.board.cols;
    for (var key in matched) {
      var parts = key.split(',');
      b[+parts[0]][+parts[1]] = -1;
    }
    for (var c = 0; c < Cc; c++) {
      var stack = [];
      for (var r = R - 1; r >= 0; r--) if (b[r][c] >= 0) stack.push(b[r][c]);
      var idx = 0;
      for (var r2 = R - 1; r2 >= 0; r2--) {
        if (idx < stack.length) b[r2][c] = stack[idx++];
        else b[r2][c] = Math.floor(rng.float() * kinds) % kinds;
      }
    }
  }

  /* ---------- один шаг разрешения: вернуть {cells, count} или null ---------- */
  function resolveStep(b, kinds) {
    var m = findMatches(b, kinds);
    var cells = Object.keys(m);
    if (!cells.length) return null;
    return { cells: cells, count: cells.length };
  }

  /* ---------- подсказка: любой легальный свап ---------- */
  function hintMove(b, kinds) {
    var R = C.board.rows, Cc = C.board.cols;
    for (var r = 0; r < R; r++) for (var c = 0; c < Cc; c++) {
      if (b[r][c] < 0) continue;
      var dirs = [[0, 1], [1, 0]];
      for (var d = 0; d < 2; d++) {
        var r2 = r + dirs[d][0], c2 = c + dirs[d][1];
        if (inBoard(r2, c2) && b[r2][c2] >= 0 && legalSwap(b, r, c, r2, c2, kinds)) {
          return { r1: r, c1: c, r2: r2, c2: c2 };
        }
      }
    }
    return null;
  }

  G.match = {
    cloneBoard: cloneBoard, findMatches: findMatches, anyMove: anyMove,
    freshBoard: freshBoard, legalSwap: legalSwap, clearAndDrop: clearAndDrop,
    resolveStep: resolveStep, hintMove: hintMove
  };
})(window.GAME);
