/* game/entities.js — логика «Шарового Залпа»: сетка шариков, физика, взрывы.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};
  var COLS = 10; // колонок в сетке
  var ROWS = 12; // строк максимум

  /* ---------- Сетка шариков ---------- */
  // grid[y][x] = { color: 1-6, special: null|'rainbow'|'bomb'|'laser', x, y } или null
  ENT.makeGrid = function () {
    var g = [];
    for (var y = 0; y < ROWS; y++) {
      g.push([]);
      for (var x = 0; x < COLS; x++) g[y].push(null);
    }
    return g;
  };

  /* ---------- Генерация уровня ---------- */
  ENT.makeLevel = function (lv, rng) {
    var grid = ENT.makeGrid();
    var rows = Math.min(G.config.game.rowsMax, G.config.game.rowsBase + Math.floor((lv - 1) / 2));
    var colors = Math.min(G.config.game.colorsMax, G.config.game.colorsBase + Math.floor((lv - 1) / 4));

    // заполняем верхние строки случайными цветами
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < COLS; x++) {
        // пропускаем некоторые клетки для разнообразия
        if (rng() < 0.1) continue;
        grid[y][x] = {
          color: 1 + Math.floor(rng() * colors),
          special: null,
          x: x, y: y
        };
      }
    }

    // гарантируем, что есть хотя бы один ход: проверяем, что есть 2+ одинаковых цвета рядом
    var hasPair = false;
    for (var y = 0; y < rows && !hasPair; y++) {
      for (var x = 0; x < COLS - 1 && !hasPair; x++) {
        if (grid[y][x] && grid[y][x + 1] && grid[y][x].color === grid[y][x + 1].color) {
          hasPair = true;
        }
      }
    }
    if (!hasPair && rows > 0 && COLS > 1) {
      // форсируем пару
      grid[0][0] = { color: 1, special: null, x: 0, y: 0 };
      grid[0][1] = { color: 1, special: null, x: 1, y: 0 };
    }

    return { grid: grid, colors: colors, rows: rows };
  };

  /* ---------- Позиция шарика на экране ---------- */
  ENT.gridToScreen = function (x, y, cellSize, offsetX, offsetY) {
    // шестиугольная сетка: чётные строки сдвинуты вправо
    var hexOffset = (y % 2) * cellSize * 0.5;
    return {
      x: offsetX + x * cellSize + hexOffset,
      y: offsetY + y * cellSize * 0.87 // вертикальный шаг меньше для шестиугольной упаковки
    };
  };

  /* ---------- Проверка попадания ---------- */
  ENT.findHit = function (grid, bx, by, color, cellSize, offsetX, offsetY) {
    var best = null;
    var bestDist = Infinity;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!grid[y][x]) continue;
        var pos = ENT.gridToScreen(x, y, cellSize, offsetX, offsetY);
        var dx = bx - pos.x, dy = by - pos.y;
        var dist = dx * dx + dy * dy;
        if (dist < bestDist && dist < cellSize * cellSize) {
          bestDist = dist;
          best = { x: x, y: y, pos: pos };
        }
      }
    }
    return best;
  };

  /* ---------- Проверка совпадений (3+ одного цвета в контакте) ---------- */
  ENT.findMatches = function (grid, x, y) {
    if (!grid[y] || !grid[y][x]) return [];
    var color = grid[y][x].color;
    var visited = {};
    var queue = [{ x: x, y: y }];
    var match = [];

    while (queue.length > 0) {
      var cur = queue.pop();
      var key = cur.x + ',' + cur.y;
      if (visited[key]) continue;
      visited[key] = true;
      if (!grid[cur.y] || !grid[cur.y][cur.x] || grid[cur.y][cur.x].color !== color) continue;
      match.push(cur);

      // соседи в шестиугольной сетке
      var neighbors = [
        { x: cur.x - 1, y: cur.y }, { x: cur.x + 1, y: cur.y },
        { x: cur.x, y: cur.y - 1 }, { x: cur.x, y: cur.y + 1 }
      ];
      if (cur.y % 2 === 0) {
        neighbors.push({ x: cur.x - 1, y: cur.y - 1 });
        neighbors.push({ x: cur.x - 1, y: cur.y + 1 });
      } else {
        neighbors.push({ x: cur.x + 1, y: cur.y - 1 });
        neighbors.push({ x: cur.x + 1, y: cur.y + 1 });
      }
      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        if (n.x >= 0 && n.x < COLS && n.y >= 0 && n.y < ROWS && !visited[n.x + ',' + n.y]) {
          queue.push(n);
        }
      }
    }
    return match;
  };

  /* ---------- Взрыв ---------- */
  ENT.explode = function (grid, matches) {
    for (var i = 0; i < matches.length; i++) {
      grid[matches[i].y][matches[i].x] = null;
    }
  };

  /* ---------- Проверка победы ---------- */
  ENT.isClear = function (grid) {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (grid[y][x]) return false;
      }
    }
    return true;
  };

  /* ---------- Проверка поражения ---------- */
  ENT.isGameOver = function (grid, maxRows) {
    for (var y = maxRows; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (grid[y][x]) return true;
      }
    }
    return false;
  };

  /* ---------- Подсказка: лучший ход ---------- */
  ENT.findBestShot = function (grid, currentColor, cellSize, offsetX, offsetY) {
    var best = null;
    var bestScore = -1;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!grid[y][x]) continue;
        if (grid[y][x].color !== currentColor) continue;
        var matches = ENT.findMatches(grid, x, y);
        var score = matches.length;
        if (score > bestScore) {
          bestScore = score;
          var pos = ENT.gridToScreen(x, y, cellSize, offsetX, offsetY);
          best = { x: pos.x, y: pos.y, score: score };
        }
      }
    }
    return best;
  };

  /* ---------- Спец-шары ---------- */
  ENT.makeSpecial = function (type, color) {
    return { color: color || 0, special: type, x: -1, y: -1 };
  };

  /* ---------- Применение спец-шара ---------- */
  ENT.applySpecial = function (grid, x, y, type) {
    var affected = [];
    if (type === 'bomb') {
      // 3×3 вокруг
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && grid[ny][nx]) {
            affected.push({ x: nx, y: ny });
          }
        }
      }
    } else if (type === 'laser') {
      // вся строка
      for (var nx = 0; nx < COLS; nx++) {
        if (grid[y][nx]) affected.push({ x: nx, y: y });
      }
    }
    return affected;
  };

  ENT.COLS = COLS;
  ENT.ROWS = ROWS;
})(window.GAME);
