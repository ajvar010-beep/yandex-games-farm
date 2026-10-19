/* game/entities.js — логика «Судоку Лайт»: генерация 6×6, проверка, подсказки.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};
  var SIZE = 6, BLOCK_W = 2, BLOCK_H = 3;

  /* ---------- Генерация полного решения ---------- */
  function makeSolution(rng) {
    var grid = [];
    for (var y = 0; y < SIZE; y++) grid.push([0, 0, 0, 0, 0, 0]);

    // заполняем диагональные блоки
    for (var b = 0; b < SIZE; b += BLOCK_H) {
      fillBlock(grid, b, 0, rng);
    }
    // решаем остальное
    solve(grid);
    return grid;
  }

  function fillBlock(grid, row, col, rng) {
    var nums = [1, 2, 3, 4, 5, 6];
    for (var i = nums.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = nums[i]; nums[i] = nums[j]; nums[j] = t;
    }
    var idx = 0;
    for (var y = 0; y < BLOCK_H; y++) {
      for (var x = 0; x < BLOCK_W; x++) {
        grid[row + y][col + x] = nums[idx++];
      }
    }
  }

  function solve(grid) {
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (grid[y][x] === 0) {
          var nums = [1, 2, 3, 4, 5, 6];
          for (var i = nums.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = nums[i]; nums[i] = nums[j]; nums[j] = t;
          }
          for (var n = 0; n < nums.length; n++) {
            if (isValid(grid, y, x, nums[n])) {
              grid[y][x] = nums[n];
              if (solve(grid)) return true;
              grid[y][x] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function isValid(grid, row, col, num) {
    // строка
    for (var x = 0; x < SIZE; x++) if (grid[row][x] === num) return false;
    // столбец
    for (var y = 0; y < SIZE; y++) if (grid[y][col] === num) return false;
    // блок
    var by = Math.floor(row / BLOCK_H) * BLOCK_H;
    var bx = Math.floor(col / BLOCK_W) * BLOCK_W;
    for (var y = by; y < by + BLOCK_H; y++) {
      for (var x = bx; x < bx + BLOCK_W; x++) {
        if (grid[y][x] === num) return false;
      }
    }
    return true;
  }

  /* ---------- Генерация уровня: решение + открытые клетки ---------- */
  ENT.makeLevel = function (lv, rng) {
    var solution = makeSolution(rng);
    var givens = G.config.levelGivens(lv);

    // выбираем случайные клетки для открытия
    var cells = [];
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) cells.push({ x: x, y: y });
    }
    for (var i = cells.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = cells[i]; cells[i] = cells[j]; cells[j] = t;
    }

    var grid = [];
    for (var y = 0; y < SIZE; y++) grid.push([0, 0, 0, 0, 0, 0]);
    var given = [];
    for (var y = 0; y < SIZE; y++) given.push([false, false, false, false, false, false]);

    for (var i = 0; i < givens; i++) {
      var c = cells[i];
      grid[c.y][c.x] = solution[c.y][c.x];
      given[c.y][c.x] = true;
    }

    return { grid: grid, solution: solution, given: given, level: lv };
  };

  /* ---------- Проверка хода ---------- */
  ENT.isValidMove = function (grid, row, col, num) {
    if (grid[row][col] !== 0) return false;
    return isValid(grid, row, col, num);
  };

  /* ---------- Проверка победы ---------- */
  ENT.isComplete = function (grid, solution) {
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (grid[y][x] !== solution[y][x]) return false;
      }
    }
    return true;
  };

  /* ---------- Подсказка: найти правильную цифру для пустой клетки ---------- */
  ENT.hint = function (grid, solution, given) {
    var empty = [];
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (grid[y][x] === 0 && !given[y][x]) empty.push({ x: x, y: y });
      }
    }
    if (empty.length === 0) return null;
    var c = empty[Math.floor(Math.random() * empty.length)];
    return { x: c.x, y: c.y, value: solution[c.y][c.x] };
  };

  /* ---------- Проверка ошибок ---------- */
  ENT.findErrors = function (grid, solution) {
    var errors = [];
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (grid[y][x] !== 0 && grid[y][x] !== solution[y][x]) {
          errors.push({ x: x, y: y });
        }
      }
    }
    return errors;
  };

  /* ---------- Стереть ошибку ---------- */
  ENT.eraseError = function (grid, solution, given) {
    var errors = ENT.findErrors(grid, solution);
    if (errors.length === 0) return false;
    var e = errors[Math.floor(Math.random() * errors.length)];
    grid[e.y][e.x] = 0;
    return true;
  };

  /* ---------- Решить клетку ---------- */
  ENT.solveCell = function (grid, solution, given) {
    var empty = [];
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (grid[y][x] === 0 && !given[y][x]) empty.push({ x: x, y: y });
      }
    }
    if (empty.length === 0) return null;
    var c = empty[Math.floor(Math.random() * empty.length)];
    grid[c.y][c.x] = solution[c.y][c.x];
    return c;
  };
})(window.GAME);
