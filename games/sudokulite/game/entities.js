/* game/entities.js — логика «Судоку Лайт»: генерация 6×6, проверка, подсказки.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};
  var SIZE = 6, BLOCK_W = 2, BLOCK_H = 3;

  /* ---------- Генерация полного решения ----------
     ВАЖНО: раньше здесь предварительно заполнялись «диагональные» блоки, но при
     BLOCK_H=3, BLOCK_W=2 цикл `b += BLOCK_H` давал блоки (строки 0-2) и (строки 3-5)
     в ОДНОМ блочном столбце (колонки 0-1). fillBlock клал в каждый независимую
     перестановку, поэтому в колонках 0-1 появлялись дубли, а solve() дозаполнял
     только нули и уже проставленные клетки не перепроверял. Итог: ~94% «решений»
     нарушали правила судоку по колонкам (в стартовых подсказках конфликт был виден
     сразу на ~74% первых уровней), и честный ответ игрока засчитывался как ошибка.
     Теперь решение строится одним solve() по пустой сетке — isValid проверяет
     строки, колонки и блоки для каждой клетки, поэтому решение всегда валидно. */
  function makeSolution(rng) {
    var grid = [];
    for (var y = 0; y < SIZE; y++) grid.push([0, 0, 0, 0, 0, 0]);
    // Пустая сетка решаема всегда; ретрай — страховка на случай false от solve().
    // Раньше возврат solve() игнорировался, и в solution могли остаться нули.
    for (var attempt = 0; attempt < 8 && !solve(grid, rng); attempt++) {
      for (var y2 = 0; y2 < SIZE; y2++) {
        for (var x2 = 0; x2 < SIZE; x2++) grid[y2][x2] = 0;
      }
    }
    return grid;
  }

  /* solve — бэктрекинг. Рандом берётся ИЗ ПЕРЕДАННОГО rng: Math.random здесь
     ломал детерминизм (сцена передаёт seeded rng, а сетка каждый раз выходила
     другой), из-за чего capture по seed= был невоспроизводим. */
  function solve(grid, rng) {
    var rnd = (typeof rng === 'function') ? rng : Math.random;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (grid[y][x] === 0) {
          var nums = [1, 2, 3, 4, 5, 6];
          for (var i = nums.length - 1; i > 0; i--) {
            var j = Math.floor(rnd() * (i + 1));
            var t = nums[i]; nums[i] = nums[j]; nums[j] = t;
          }
          for (var n = 0; n < nums.length; n++) {
            if (isValid(grid, y, x, nums[n])) {
              grid[y][x] = nums[n];
              if (solve(grid, rnd)) return true;
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

  /* ---------- Счётчик решений (с ранним выходом на limit) ----------
     Нужен для гарантии ЕДИНСТВЕННОСТИ пазла: если решений несколько, честный
     ответ игрока не совпадает с сохранённым solution и засчитывается как ошибка. */
  function countSolutions(grid, limit) {
    var g = [];
    for (var y = 0; y < SIZE; y++) g.push(grid[y].slice());
    var found = 0;
    (function rec() {
      if (found >= limit) return;
      for (var y = 0; y < SIZE; y++) {
        for (var x = 0; x < SIZE; x++) {
          if (g[y][x] !== 0) continue;
          for (var n = 1; n <= SIZE; n++) {
            if (isValid(g, y, x, n)) {
              g[y][x] = n;
              rec();
              g[y][x] = 0;
              if (found >= limit) return;
            }
          }
          return;
        }
      }
      found++;
    })();
    return found;
  }
  ENT.countSolutions = countSolutions;

  /* ---------- Генерация уровня: решение + открытые клетки ----------
     Подсказки открываются по одной, и как только их стало не меньше givens,
     проверяется единственность решения. Если пазл неоднозначен — открываем ещё
     одну клетку: лучше чуть более лёгкий уровень, чем тот, где верный ответ
     игрока считается ошибкой. Терминация гарантирована: на полностью открытой
     сетке решение единственно. */
  ENT.makeLevel = function (lv, rng) {
    var solution = makeSolution(rng);
    var givens = G.config.levelGivens(lv);

    // выбираем порядок открытия клеток
    var cells = [];
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) cells.push({ x: x, y: y });
    }
    for (var i = cells.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = cells[i]; cells[i] = cells[j]; cells[j] = t;
    }

    var grid = [];
    for (var y2 = 0; y2 < SIZE; y2++) grid.push([0, 0, 0, 0, 0, 0]);
    var given = [];
    for (var y3 = 0; y3 < SIZE; y3++) given.push([false, false, false, false, false, false]);

    for (var k = 0; k < cells.length; k++) {
      var c = cells[k];
      grid[c.y][c.x] = solution[c.y][c.x];
      given[c.y][c.x] = true;
      if (k + 1 >= givens && countSolutions(grid, 2) === 1) break;
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
    // Берём первую по порядку обхода, а не случайную: Math.random в логике
    // запрещён (ломает детерминизм по seed= при съёмке медиа).
    var c = empty[0];
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
    var e = errors[0]; // детерминированно (см. hint)
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
    var c = empty[0]; // детерминированно (см. hint)
    grid[c.y][c.x] = solution[c.y][c.x];
    return c;
  };
})(window.GAME);
