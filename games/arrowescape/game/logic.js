/* game/logic.js — правила «Побег Стрелок» и генерация уровней.
   Поле: сетка cols×rows. Клетка — null, стена {t:'wall'} или стрелка {t:'arrow',dir,color,special}.
   Стрелка улетает, если её луч до края свободен; за ней по той же линии цепочкой улетают
   стрелки того же направления. Генерация — ОБРАТНЫМ порядком снятия: каждая новая стрелка
   ставится туда, где её луч свободен от уже поставленных (они снимаются позже), поэтому
   уровень гарантированно решаем. Вся случайность — только из переданного rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 up, 1 right, 2 down, 3 left

  function inB(c, r, cols, rows) { return c >= 0 && r >= 0 && c < cols && r < rows; }
  function cloneGrid(grid) { return grid.map(function (row) { return row.slice(); }); }

  /* луч свободен: ни стены, ни стрелки до самого края (стартовая клетка не в счёте) */
  function rayClear(grid, c, r, dir, cols, rows) {
    var dc = DIRS[dir][0], dr = DIRS[dir][1];
    var x = c + dc, y = r + dr;
    while (inB(x, y, cols, rows)) {
      if (grid[y][x]) return false;
      x += dc; y += dr;
    }
    return true;
  }

  /* луч свободен с учётом уже снятых в этой же цепочке клеток (removedSet) */
  function rayClearExcept(grid, c, r, dir, cols, rows, removedSet) {
    var dc = DIRS[dir][0], dr = DIRS[dir][1];
    var x = c + dc, y = r + dr;
    while (inB(x, y, cols, rows)) {
      if (grid[y][x] && !removedSet[x + ',' + y]) return false;
      x += dc; y += dr;
    }
    return true;
  }

  /* какие клетки улетят, если тапнуть (c,r). null — ход невозможен. */
  function simulateTap(grid, c, r, cols, rows) {
    var cell = grid[r] && grid[r][c];
    if (!cell || cell.t !== 'arrow') return null;
    var out = [{ c: c, r: r, cell: cell, step: 0 }];
    var removedSet = {};
    removedSet[c + ',' + r] = 1;
    if (cell.special === 'bomb') {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var x = c + dx, y = r + dy;
          if (!inB(x, y, cols, rows)) continue;
          var n = grid[y][x];
          if (n && n.t === 'arrow') out.push({ c: x, r: y, cell: n, step: 1 });
        }
      }
      return out;
    }
    if (!rayClear(grid, c, r, cell.dir, cols, rows)) return null;
    // цепочка позади: та же линия, то же направление
    var dc = DIRS[cell.dir][0], dr = DIRS[cell.dir][1];
    var x = c - dc, y = r - dr, step = 1;
    while (inB(x, y, cols, rows)) {
      var b = grid[y][x];
      if (!b || b.t !== 'arrow' || b.special === 'bomb' || b.dir !== cell.dir) break;
      // луч считаем с учётом уже снятых в цепочке клеток: иначе тапнутая плитка
      // сама блокирует стрелку позади, и цепочка не срабатывает НИКОГДА.
      if (!rayClearExcept(grid, x, y, b.dir, cols, rows, removedSet)) break;
      out.push({ c: x, r: y, cell: b, step: step });
      removedSet[x + ',' + y] = 1;
      step++;
      x -= dc; y -= dr;
    }
    return out;
  }

  function applyRemoved(grid, removed) {
    for (var i = 0; i < removed.length; i++) grid[removed[i].r][removed[i].c] = null;
  }

  function countArrows(grid) {
    var n = 0;
    for (var r = 0; r < grid.length; r++)
      for (var c = 0; c < grid[r].length; c++)
        if (grid[r][c] && grid[r][c].t === 'arrow') n++;
    return n;
  }

  /* жадный решатель: всегда берёт ход с самой длинной цепочкой.
     Возвращает {taps, cleared, order[]}. */
  function greedySolve(grid0, cols, rows) {
    var grid = cloneGrid(grid0), taps = 0, order = [];
    var total = countArrows(grid), cleared = 0, guard = cols * rows * 4;
    while (cleared < total && guard-- > 0) {
      var best = null, bestLen = 0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cell = grid[r][c];
          if (!cell || cell.t !== 'arrow') continue;
          var rm = simulateTap(grid, c, r, cols, rows);
          if (!rm) continue;
          if (rm.length > bestLen) { bestLen = rm.length; best = rm; }
        }
      }
      if (!best) break;
      applyRemoved(grid, best);
      cleared += best.length; taps++;
      order.push({ c: best[0].c, r: best[0].r });
    }
    return { taps: taps, cleared: cleared === total, order: order };
  }

  function freeCells(grid, cols, rows) {
    var out = [];
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++) {
        var cell = grid[r][c];
        if (cell && cell.t === 'arrow' && simulateTap(grid, c, r, cols, rows)) out.push({ c: c, r: r });
      }
    return out;
  }

  function bestTap(grid, cols, rows) {
    var best = null, bestLen = 0;
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++) {
        var cell = grid[r][c];
        if (!cell || cell.t !== 'arrow') continue;
        var rm = simulateTap(grid, c, r, cols, rows);
        if (rm && rm.length > bestLen) { bestLen = rm.length; best = { c: c, r: r, removed: rm }; }
      }
    return best;
  }

  /* level: номер, rng: E.Rng. Возвращает {cols, rows, grid, optimal, tapLimit, level}. */
  function generate(level, rng) {
    var spec = G.config.levelSpec(level);
    for (var attempt = 0; attempt < 60; attempt++) {
      var cols = spec.cols, rows = spec.rows;
      var grid = [];
      for (var r = 0; r < rows; r++) { grid.push([]); for (var c = 0; c < cols; c++) grid[r].push(null); }

      // стены
      var wallsLeft = spec.walls, guard = 200;
      while (wallsLeft > 0 && guard-- > 0) {
        var wc = rng.int(0, cols - 1), wr = rng.int(0, rows - 1);
        if (grid[wr][wc]) continue;
        grid[wr][wc] = { t: 'wall' };
        wallsLeft--;
      }

      // стрелки обратным порядком снятия
      var target = Math.max(3, Math.round(cols * rows * spec.fill) - spec.walls);
      var placed = 0, tries = cols * rows * 14;
      while (placed < target && tries-- > 0) {
        var c = rng.int(0, cols - 1), r2 = rng.int(0, rows - 1);
        if (grid[r2][c]) continue;
        // Собираем все свободные направления. Затем с шансом 45% предпочитаем
        // направление, в котором ЗА клеткой уже стоит стрелка того же направления:
        // так на поле появляются линии-«поезда», и цепные сбросы случаются часто,
        // а не только при редком совпадении случайных направлений.
        var freeDirs = [];
        for (var dd0 = 0; dd0 < 4; dd0++) if (rayClear(grid, c, r2, dd0, cols, rows)) freeDirs.push(dd0);
        if (!freeDirs.length) continue;
        var d = freeDirs[rng.int(0, freeDirs.length - 1)];
        if (rng.chance(0.32)) {
          for (var k2 = 0; k2 < freeDirs.length; k2++) {
            var cand = freeDirs[k2];
            var bx = c - DIRS[cand][0], by = r2 - DIRS[cand][1];
            if (inB(bx, by, cols, rows)) {
              var behind = grid[by][bx];
              if (behind && behind.t === 'arrow' && behind.special !== 'bomb' && behind.dir === cand) { d = cand; break; }
            }
          }
        }
        grid[r2][c] = { t: 'arrow', dir: d, color: rng.int(0, spec.colors - 1), special: 0 };
        placed++;
      }

      // бомбы: часть стрелок превращаем в бомбы (они снимаются всегда — уровень остаётся решаемым)
      var bombs = spec.bombs;
      for (var b = 0; b < bombs; b++) {
        for (var t = 0; t < 60; t++) {
          var bc = rng.int(0, cols - 1), br = rng.int(0, rows - 1);
          var cell = grid[br][bc];
          if (cell && cell.t === 'arrow' && cell.special !== 'bomb') { cell.special = 'bomb'; break; }
        }
      }

      var sol = greedySolve(grid, cols, rows);
      if (!sol.cleared) continue;               // нерешаемое — перегенерировать
      // Отсекаем вырожденные поля-«змейки»: если жадный игрок очищает доску за
      // меньше чем arrows*0.45 ходов, это одна гигантская цепь и уровня нет.
      var arrowsNow = countArrows(grid);
      if (sol.taps < Math.ceil(arrowsNow * 0.45)) continue;
      var tapLimit = Math.max(3, sol.taps + spec.slack);
      return {
        level: level, cols: cols, rows: rows, grid: grid,
        optimal: sol.taps, tapLimit: tapLimit, arrows: countArrows(grid)
      };
    }
    // страховка (практически недостижима): маленькое поле из одной стрелки
    var g = [[{ t: 'arrow', dir: 0, color: 0, special: 0 }]];
    return { level: level, cols: 1, rows: 1, grid: g, optimal: 1, tapLimit: 3, arrows: 1 };
  }

  G.logic = {
    DIRS: DIRS, inB: inB, cloneGrid: cloneGrid, rayClear: rayClear,
    simulateTap: simulateTap, applyRemoved: applyRemoved, countArrows: countArrows,
    greedySolve: greedySolve, freeCells: freeCells, bestTap: bestTap, generate: generate
  };
})(window.GAME);
