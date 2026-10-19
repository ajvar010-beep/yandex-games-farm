/* game/entities.js — логика «Слияния 2048»: поле 4×4, ходы, слияния.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};

  /* ---------- Создание пустого поля ---------- */
  ENT.makeGrid = function () {
    var g = [];
    for (var y = 0; y < 4; y++) {
      g.push([0, 0, 0, 0]);
    }
    return g;
  };

  /* ---------- Клонирование поля ---------- */
  ENT.cloneGrid = function (g) {
    var out = [];
    for (var y = 0; y < 4; y++) {
      out.push(g[y].slice());
    }
    return out;
  };

  /* ---------- Добавить случайную плитку (2 или 4) ---------- */
  ENT.spawnTile = function (grid, rng) {
    var empty = [];
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (grid[y][x] === 0) empty.push({ x: x, y: y });
      }
    }
    if (empty.length === 0) return null;
    var cell = empty[Math.floor(rng() * empty.length)];
    grid[cell.y][cell.x] = rng() < 0.9 ? 2 : 4;
    return cell;
  };

  /* ---------- Ход влево (базовый) ---------- */
  // Возвращает { grid, moved, score, merges: [{from, to, value}] }
  function slideRow(row, rng) {
    var arr = row.filter(function (v) { return v !== 0; });
    var merges = [];
    var score = 0;
    for (var i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        merges.push({ from: i + 1, to: i, value: arr[i] });
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < 4) arr.push(0);
    return { row: arr, score: score, merges: merges };
  }

  ENT.move = function (grid, dir, rng) {
    var g = ENT.cloneGrid(grid);
    var totalScore = 0;
    var allMerges = [];
    var moved = false;

    function processLine(getLine, setLine) {
      for (var i = 0; i < 4; i++) {
        var line = getLine(i);
        var result = slideRow(line, rng);
        if (result.score > 0) moved = true;
        totalScore += result.score;
        for (var m = 0; m < result.merges.length; m++) {
          allMerges.push(result.merges[m]);
        }
        setLine(i, result.row);
      }
    }

    if (dir === 'left') {
      processLine(
        function (i) { return g[i]; },
        function (i, row) { g[i] = row; }
      );
    } else if (dir === 'right') {
      processLine(
        function (i) { return g[i].slice().reverse(); },
        function (i, row) { g[i] = row.reverse(); }
      );
    } else if (dir === 'up') {
      processLine(
        function (i) { return [g[0][i], g[1][i], g[2][i], g[3][i]]; },
        function (i, col) { for (var y = 0; y < 4; y++) g[y][i] = col[y]; }
      );
    } else if (dir === 'down') {
      processLine(
        function (i) { return [g[3][i], g[2][i], g[1][i], g[0][i]]; },
        function (i, col) { for (var y = 0; y < 4; y++) g[y][i] = col[3 - y]; }
      );
    }

    // проверка, изменилось ли поле
    if (!moved) {
      for (var y = 0; y < 4; y++) {
        for (var x = 0; x < 4; x++) {
          if (g[y][x] !== grid[y][x]) { moved = true; break; }
        }
      }
    }

    return { grid: g, moved: moved, score: totalScore, merges: allMerges };
  };

  /* ---------- Проверка окончания ---------- */
  ENT.isGameOver = function (grid) {
    // есть пустая клетка
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (grid[y][x] === 0) return false;
      }
    }
    // есть соседние одинаковые
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        var v = grid[y][x];
        if (x < 3 && grid[y][x + 1] === v) return false;
        if (y < 3 && grid[y + 1][x] === v) return false;
      }
    }
    return true;
  };

  /* ---------- Проверка победы ---------- */
  ENT.hasWon = function (grid, target) {
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (grid[y][x] >= target) return true;
      }
    }
    return false;
  };

  /* ---------- Максимальная плитка ---------- */
  ENT.maxTile = function (grid) {
    var max = 0;
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (grid[y][x] > max) max = grid[y][x];
      }
    }
    return max;
  };

  /* ---------- Лучший ход (подсказка) ---------- */
  ENT.bestMove = function (grid, rng) {
    var dirs = ['left', 'right', 'up', 'down'];
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < dirs.length; i++) {
      var result = ENT.move(grid, dirs[i], rng);
      if (!result.moved) continue;
      var score = result.score + ENT.maxTile(result.grid) * 2;
      // бонус за пустые клетки
      var empty = 0;
      for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) if (result.grid[y][x] === 0) empty++;
      score += empty * 5;
      if (score > bestScore) {
        bestScore = score;
        best = dirs[i];
      }
    }
    return best;
  };

  /* ---------- Перемешивание поля ---------- */
  ENT.shuffle = function (grid, rng) {
    var tiles = [];
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (grid[y][x] !== 0) tiles.push(grid[y][x]);
      }
    }
    // перемешиваем значения
    for (var i = tiles.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = tiles[i]; tiles[i] = tiles[j]; tiles[j] = t;
    }
    // раскладываем обратно
    var idx = 0;
    var g = ENT.makeGrid();
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (idx < tiles.length && rng() < 0.7) {
          g[y][x] = tiles[idx++];
        }
      }
    }
    // если пусто — добавляем 2
    if (idx === 0) {
      g[0][0] = 2;
    }
    return g;
  };

  /* ---------- Убрать самую маленькую плитку (бомба) ---------- */
  ENT.bombSmallest = function (grid) {
    var min = Infinity;
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (grid[y][x] !== 0 && grid[y][x] < min) min = grid[y][x];
      }
    }
    if (min === Infinity) return false;
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (grid[y][x] === min) {
          grid[y][x] = 0;
          return true;
        }
      }
    }
    return false;
  };
})(window.GAME);
