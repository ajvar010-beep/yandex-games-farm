/* game/logic.js — правила «Побег Стрелок» v2 и генерация уровней.
   Поле: сетка cols×rows. Клетка — null, стена {t:'wall'}, ящик {t:'crate'} или
   стрелка {t:'arrow',dir,color,special,frozen}.
   Стрелка улетает, если её луч до края свободен; за ней по той же линии цепочкой
   улетают стрелки того же направления. Если первым в луче стоит ЯЩИК — тап разбивает
   ящик вместе со стрелкой (ящики не делают поле нерешаемым). Замороженная стрелка
   сначала тратит ход на лёд. Генерация — обратным порядком снятия; уровень
   гарантированно решаем. Вся случайность — только из переданного rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 up, 1 right, 2 down, 3 left

  function inB(c, r, cols, rows) { return c >= 0 && r >= 0 && c < cols && r < rows; }
  function cloneGrid(grid) {
    // ВАЖНО: копируем и сами клетки. Иначе applyRemoved('crack') на клоне
    // обнуляет frozen у ОРИГИНАЛА (объекты общие), и лёд исчезает после solver'а.
    return grid.map(function (row) {
      return row.map(function (c) { return c ? Object.assign({}, c) : null; });
    });
  }

  function rayClear(grid, c, r, dir, cols, rows) {
    var dc = DIRS[dir][0], dr = DIRS[dir][1];
    var x = c + dc, y = r + dr;
    while (inB(x, y, cols, rows)) {
      if (grid[y][x]) return false;
      x += dc; y += dr;
    }
    return true;
  }

  function rayClearExcept(grid, c, r, dir, cols, rows, removedSet) {
    var dc = DIRS[dir][0], dr = DIRS[dir][1];
    var x = c + dc, y = r + dr;
    while (inB(x, y, cols, rows)) {
      if (grid[y][x] && !removedSet[x + ',' + y]) return false;
      x += dc; y += dr;
    }
    return true;
  }

  function firstBlocker(grid, c, r, dir, cols, rows) {
    var dc = DIRS[dir][0], dr = DIRS[dir][1];
    var x = c + dc, y = r + dr;
    while (inB(x, y, cols, rows)) {
      if (grid[y][x]) return { c: x, r: y, cell: grid[y][x] };
      x += dc; y += dr;
    }
    return null;
  }

  /* какие клетки изменятся, если тапнуть (c,r). null — ход невозможен.
     kind: exit (улетела), smash (стрелка разбила ящик), crate (ящик), crack (лёд),
     bomb (взрыв), bombArrow (стрелка, снятая взрывом). */
  function simulateTap(grid, c, r, cols, rows) {
    var cell = grid[r] && grid[r][c];
    if (!cell || cell.t !== 'arrow') return null;
    if (cell.frozen > 0) return [{ c: c, r: r, cell: cell, step: 0, kind: 'crack' }];

    if (cell.special === 'bomb') {
      var out = [{ c: c, r: r, cell: cell, step: 0, kind: 'bomb' }];
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var bx = c + dx, by = r + dy;
          if (!inB(bx, by, cols, rows)) continue;
          var n = grid[by][bx];
          if (n && n.t === 'arrow') out.push({ c: bx, r: by, cell: n, step: 1, kind: 'bombArrow' });
          else if (n && n.t === 'crate') out.push({ c: bx, r: by, cell: n, step: 1, kind: 'crate' });
        }
      }
      return out;
    }

    var block = firstBlocker(grid, c, r, cell.dir, cols, rows);
    if (block && block.cell.t === 'crate') {
      // ящик впереди: стрелка бьёт его и разбивается сама — луч открывается
      return [
        { c: c, r: r, cell: cell, step: 0, kind: 'smash' },
        { c: block.c, r: block.r, cell: block.cell, step: 1, kind: 'crate' }
      ];
    }
    if (block) return null; // стена или другая стрелка

    var out2 = [{ c: c, r: r, cell: cell, step: 0, kind: 'exit' }];
    var removedSet = {};
    removedSet[c + ',' + r] = 1;
    var dc = DIRS[cell.dir][0], dr = DIRS[cell.dir][1];
    var x = c - dc, y = r - dr, step = 1;
    while (inB(x, y, cols, rows)) {
      var b = grid[y][x];
      if (!b || b.t !== 'arrow' || b.special === 'bomb' || b.dir !== cell.dir || b.frozen > 0) break;
      if (!rayClearExcept(grid, x, y, b.dir, cols, rows, removedSet)) break;
      out2.push({ c: x, r: y, cell: b, step: step, kind: 'exit' });
      removedSet[x + ',' + y] = 1;
      step++;
      x -= dc; y -= dr;
    }
    return out2;
  }

  function applyRemoved(grid, removed) {
    for (var i = 0; i < removed.length; i++) {
      var e = removed[i], cell = grid[e.r] && grid[e.r][e.c];
      if (!cell) continue;
      if (e.kind === 'crack') { cell.frozen = 0; continue; }
      grid[e.r][e.c] = null;
    }
  }

  function countArrows(grid) {
    var n = 0;
    for (var r = 0; r < grid.length; r++)
      for (var c = 0; c < grid[r].length; c++)
        if (grid[r][c] && grid[r][c].t === 'arrow') n++;
    return n;
  }
  function countCrates(grid) {
    var n = 0;
    for (var r = 0; r < grid.length; r++)
      for (var c = 0; c < grid[r].length; c++)
        if (grid[r][c] && grid[r][c].t === 'crate') n++;
    return n;
  }
  function countFrozen(grid) {
    var n = 0;
    for (var r = 0; r < grid.length; r++)
      for (var c = 0; c < grid[r].length; c++) {
        var x = grid[r][c];
        if (x && x.t === 'arrow' && x.frozen > 0) n++;
      }
    return n;
  }

  function removedArrows(rm) {
    var n = 0;
    for (var i = 0; i < rm.length; i++) {
      var k = rm[i].kind;
      if (k === 'exit' || k === 'smash' || k === 'bomb' || k === 'bombArrow') n++;
    }
    return n;
  }

  /* жадный решатель: приоритет — снять максимум стрелок; лёд колем только если
     других ходов нет. Возвращает {taps, cleared, order[]}. */
  function greedySolve(grid0, cols, rows) {
    var grid = cloneGrid(grid0), taps = 0, order = [];
    var total = countArrows(grid), cleared = 0, guard = cols * rows * 6;
    while (cleared < total && guard-- > 0) {
      var best = null, bestScore = -1e9, bestGain = 0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cell = grid[r][c];
          if (!cell || cell.t !== 'arrow') continue;
          var rm = simulateTap(grid, c, r, cols, rows);
          if (!rm) continue;
          var gain = removedArrows(rm);
          var crack = rm.length === 1 && rm[0].kind === 'crack' ? 1 : 0;
          var score = gain * 100 - (crack ? 60 : 0) + (rm.length > 1 ? 5 : 0);
          if (score > bestScore) { bestScore = score; best = rm; bestGain = gain; }
        }
      }
      if (!best) break;
      applyRemoved(grid, best);
      cleared += bestGain;
      taps++;
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
    var best = null, bestScore = -1e9;
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++) {
        var cell = grid[r][c];
        if (!cell || cell.t !== 'arrow') continue;
        var rm = simulateTap(grid, c, r, cols, rows);
        if (!rm) continue;
        var gain = removedArrows(rm);
        var crack = rm.length === 1 && rm[0].kind === 'crack' ? 1 : 0;
        var score = gain * 100 - (crack ? 60 : 0) + (rm.length > 1 ? 5 : 0);
        if (score > bestScore) { bestScore = score; best = { c: c, r: r, removed: rm }; }
      }
    return best;
  }

  function maxChain(grid, cols, rows) {
    var m = 0;
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++) {
        var cell = grid[r][c];
        if (!cell || cell.t !== 'arrow') continue;
        var rm = simulateTap(grid, c, r, cols, rows);
        if (!rm) continue;
        var exits = 0;
        for (var i = 0; i < rm.length; i++) if (rm[i].kind === 'exit') exits++;
        if (exits > m) m = exits;
      }
    return m;
  }

  function generate(level, rng) {
    var spec = G.config.levelSpec(level);
    for (var attempt = 0; attempt < 80; attempt++) {
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
      var placed = 0, tries = cols * rows * 16;
      while (placed < target && tries-- > 0) {
        var c = rng.int(0, cols - 1), r2 = rng.int(0, rows - 1);
        if (grid[r2][c]) continue;
        var freeDirs = [];
        for (var dd = 0; dd < 4; dd++) if (rayClear(grid, c, r2, dd, cols, rows)) freeDirs.push(dd);
        if (!freeDirs.length) continue;
        var d = freeDirs[rng.int(0, freeDirs.length - 1)];
        if (rng.chance(level <= 2 ? 0.62 : 0.36)) {
          for (var k2 = 0; k2 < freeDirs.length; k2++) {
            var cand = freeDirs[k2];
            var bx = c - DIRS[cand][0], by = r2 - DIRS[cand][1];
            if (!inB(bx, by, cols, rows)) continue;
            var behind = grid[by][bx];
            if (behind && behind.t === 'arrow' && behind.special !== 'bomb' && behind.dir === cand) { d = cand; break; }
          }
        }
        grid[r2][c] = { t: 'arrow', dir: d, color: rng.int(0, spec.colors - 1), special: 0, frozen: 0 };
        placed++;
      }

      // Ящики ставим ТОЛЬКО на луч какой-нибудь стрелки: тогда каждый ящик реально
      // кому-то мешает и может быть разбит, а не лежит декорацией (треть досок раньше).
      var cratesLeft = spec.crates;
      var arrowCells = [];
      for (var ar = 0; ar < rows; ar++)
        for (var ac = 0; ac < cols; ac++)
          if (grid[ar][ac] && grid[ar][ac].t === 'arrow') arrowCells.push({ c: ac, r: ar });
      var cg = 600;
      while (cratesLeft > 0 && cg-- > 0 && arrowCells.length) {
        var a = arrowCells[rng.int(0, arrowCells.length - 1)];
        var acell = grid[a.r][a.c];
        if (!acell || acell.t !== 'arrow') continue;
        var adc = DIRS[acell.dir][0], adr = DIRS[acell.dir][1];
        var cells = [], x = a.c + adc, y = a.r + adr;
        while (inB(x, y, cols, rows) && !grid[y][x]) { cells.push({ c: x, r: y }); x += adc; y += adr; }
        if (!cells.length) continue;
        var spot = cells[rng.int(0, cells.length - 1)];
        grid[spot.r][spot.c] = { t: 'crate' };
        cratesLeft--;
      }

      // бомбы: часть стрелок превращаем в бомбы
      var bombs = spec.bombs;
      for (var b = 0; b < bombs; b++) {
        for (var t = 0; t < 60; t++) {
          var bc = rng.int(0, cols - 1), br = rng.int(0, rows - 1);
          var cell = grid[br][bc];
          if (cell && cell.t === 'arrow' && cell.special !== 'bomb') { cell.special = 'bomb'; break; }
        }
      }

      // лёд: замороженные стрелки (первый тап тратит ход на лёд)
      var frLeft = spec.frozen, fg = 200;
      while (frLeft > 0 && fg-- > 0) {
        var fc = rng.int(0, cols - 1), fr = rng.int(0, rows - 1);
        var fcell = grid[fr][fc];
        if (fcell && fcell.t === 'arrow' && fcell.special !== 'bomb' && !fcell.frozen) { fcell.frozen = 1; frLeft--; }
      }

      var sol = greedySolve(grid, cols, rows);
      if (!sol.cleared) continue;
      var arrowsNow = countArrows(grid);
      if (sol.taps < Math.ceil(arrowsNow * 0.45)) continue; // вырожденные «змейки»
      if (sol.taps > arrowsNow * 2.4) continue;             // слишком нудно
      // первые уровни обязаны показать фирменную цепочку
      if (level <= 2 && maxChain(grid, cols, rows) < 3) continue;
      if (level <= 4 && maxChain(grid, cols, rows) < 2) continue;
      var tapLimit = Math.max(3, sol.taps + spec.slack);
      return {
        level: level, cols: cols, rows: rows, grid: grid,
        optimal: sol.taps, tapLimit: tapLimit, arrows: arrowsNow,
        crates: countCrates(grid), frozen: countFrozen(grid)
      };
    }
    // страховка (практически недостижима): маленькое поле из одной стрелки
    var g = [[{ t: 'arrow', dir: 0, color: 0, special: 0, frozen: 0 }]];
    return { level: level, cols: 1, rows: 1, grid: g, optimal: 1, tapLimit: 3, arrows: 1, crates: 0, frozen: 0 };
  }

  G.logic = {
    DIRS: DIRS, inB: inB, cloneGrid: cloneGrid, rayClear: rayClear,
    simulateTap: simulateTap, applyRemoved: applyRemoved,
    countArrows: countArrows, countCrates: countCrates, countFrozen: countFrozen,
    removedArrows: removedArrows, greedySolve: greedySolve, freeCells: freeCells,
    bestTap: bestTap, maxChain: maxChain, generate: generate
  };
})(window.GAME);
