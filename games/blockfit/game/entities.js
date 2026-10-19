/* game/entities.js — логика «Блок-Фита»: поле 10×10, фигуры, линии.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};

  /* ---------- Фигуры: 19 тетромино + пентомино ---------- */
  var SHAPES = [
    // I
    { id: 'i1', cells: [[0,0],[1,0],[2,0],[3,0]] },
    { id: 'i2', cells: [[0,0],[0,1],[0,2],[0,3]] },
    // O
    { id: 'o', cells: [[0,0],[1,0],[0,1],[1,1]] },
    // T
    { id: 't1', cells: [[0,0],[1,0],[2,0],[1,1]] },
    { id: 't2', cells: [[1,0],[0,1],[1,1],[1,2]] },
    { id: 't3', cells: [[1,0],[0,1],[1,1],[2,1]] },
    { id: 't4', cells: [[0,0],[0,1],[1,1],[0,2]] },
    // L
    { id: 'l1', cells: [[0,0],[0,1],[0,2],[1,2]] },
    { id: 'l2', cells: [[0,0],[1,0],[2,0],[0,1]] },
    { id: 'l3', cells: [[0,0],[1,0],[1,1],[1,2]] },
    { id: 'l4', cells: [[2,0],[0,1],[1,1],[2,1]] },
    // S
    { id: 's1', cells: [[1,0],[2,0],[0,1],[1,1]] },
    { id: 's2', cells: [[0,0],[0,1],[1,1],[1,2]] },
    // Z
    { id: 'z1', cells: [[0,0],[1,0],[1,1],[2,1]] },
    { id: 'z2', cells: [[1,0],[0,1],[1,1],[0,2]] },
    // Пентомино
    { id: 'p1', cells: [[0,0],[1,0],[2,0],[0,1],[0,2]] }, // V
    { id: 'p2', cells: [[0,0],[1,0],[2,0],[1,1],[1,2]] }, // T5
    { id: 'p3', cells: [[0,0],[1,0],[0,1],[1,1],[0,2]] }, // P
    { id: 'p4', cells: [[0,0],[1,0],[2,0],[2,1],[2,2]] }, // J5
    { id: 'p5', cells: [[0,0],[1,0],[1,1],[2,1],[2,2]] }  // W
  ];

  ENT.SHAPES = SHAPES;

  /* ---------- Создание пустого поля ---------- */
  ENT.makeGrid = function () {
    var g = [];
    for (var y = 0; y < 10; y++) {
      g.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    return g;
  };

  /* ---------- Клонирование ---------- */
  ENT.cloneGrid = function (g) {
    var out = [];
    for (var y = 0; y < 10; y++) out.push(g[y].slice());
    return out;
  };

  /* ---------- Проверка размещения ---------- */
  ENT.canPlace = function (grid, shape, ox, oy) {
    for (var i = 0; i < shape.cells.length; i++) {
      var x = ox + shape.cells[i][0], y = oy + shape.cells[i][1];
      if (x < 0 || x >= 10 || y < 0 || y >= 10) return false;
      if (grid[y][x] !== 0) return false;
    }
    return true;
  };

  /* ---------- Размещение ---------- */
  ENT.place = function (grid, shape, ox, oy, colorId) {
    for (var i = 0; i < shape.cells.length; i++) {
      var x = ox + shape.cells[i][0], y = oy + shape.cells[i][1];
      grid[y][x] = colorId;
    }
  };

  /* ---------- Проверка линий ---------- */
  // Возвращает { rows: [y], cols: [x], count }
  ENT.checkLines = function (grid) {
    var rows = [], cols = [];
    for (var y = 0; y < 10; y++) {
      var full = true;
      for (var x = 0; x < 10; x++) if (grid[y][x] === 0) { full = false; break; }
      if (full) rows.push(y);
    }
    for (var x = 0; x < 10; x++) {
      var full = true;
      for (var y = 0; y < 10; y++) if (grid[y][x] === 0) { full = false; break; }
      if (full) cols.push(x);
    }
    return { rows: rows, cols: cols, count: rows.length + cols.length };
  };

  /* ---------- Очистка линий ---------- */
  ENT.clearLines = function (grid, lines) {
    for (var i = 0; i < lines.rows.length; i++) {
      var y = lines.rows[i];
      for (var x = 0; x < 10; x++) grid[y][x] = 0;
    }
    for (var i = 0; i < lines.cols.length; i++) {
      var x = lines.cols[i];
      for (var y = 0; y < 10; y++) grid[y][x] = 0;
    }
  };

  /* ---------- Генерация фигур на панель ---------- */
  ENT.makePanel = function (rng, count) {
    count = count || 3;
    var out = [];
    for (var i = 0; i < count; i++) {
      var shape = SHAPES[Math.floor(rng() * SHAPES.length)];
      out.push({
        shape: shape,
        colorId: 1 + Math.floor(rng() * 8),
        used: false
      });
    }
    return out;
  };

  /* ---------- Проверка, есть ли ход ---------- */
  ENT.hasMove = function (grid, panel) {
    for (var p = 0; p < panel.length; p++) {
      if (panel[p].used) continue;
      var shape = panel[p].shape;
      for (var y = 0; y < 10; y++) {
        for (var x = 0; x < 10; x++) {
          if (ENT.canPlace(grid, shape, x, y)) return true;
        }
      }
    }
    return false;
  };

  /* ---------- Лучшее место для фигуры (подсказка) ---------- */
  ENT.bestPlace = function (grid, shape) {
    var best = null;
    var bestScore = -1;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 10; x++) {
        if (!ENT.canPlace(grid, shape, x, y)) continue;
        // эвристика: больше соседей = лучше
        var score = 0;
        for (var i = 0; i < shape.cells.length; i++) {
          var cx = x + shape.cells[i][0], cy = y + shape.cells[i][1];
          if (cx > 0 && grid[cy][cx - 1] !== 0) score++;
          if (cx < 9 && grid[cy][cx + 1] !== 0) score++;
          if (cy > 0 && grid[cy - 1][cx] !== 0) score++;
          if (cy < 9 && grid[cy + 1][cx] !== 0) score++;
        }
        // бонус за линии
        var testGrid = ENT.cloneGrid(grid);
        ENT.place(testGrid, shape, x, y, 1);
        var lines = ENT.checkLines(testGrid);
        score += lines.count * 50;
        if (score > bestScore) {
          bestScore = score;
          best = { x: x, y: y, score: score };
        }
      }
    }
    return best;
  };

  /* ---------- Новые фигуры (shuffle) ---------- */
  ENT.shufflePanel = function (panel, rng) {
    for (var i = 0; i < panel.length; i++) {
      if (!panel[i].used) {
        panel[i].shape = SHAPES[Math.floor(rng() * SHAPES.length)];
        panel[i].colorId = 1 + Math.floor(rng() * 8);
      }
    }
  };

  /* ---------- Бомба: убрать область 3×3 ---------- */
  ENT.bombArea = function (grid, rng) {
    var filled = [];
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 10; x++) {
        if (grid[y][x] !== 0) filled.push({ x: x, y: y });
      }
    }
    if (filled.length === 0) return false;
    var center = filled[Math.floor(rng() * filled.length)];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var x = center.x + dx, y = center.y + dy;
        if (x >= 0 && x < 10 && y >= 0 && y < 10) grid[y][x] = 0;
      }
    }
    return true;
  };
})(window.GAME);
