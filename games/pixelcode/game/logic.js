/* game/logic.js — «Пиксель-Код»: чистая логика нонограммы без DOM.
   Здесь: генерация симметричного пиксельного образа (E.Rng), цифры-подсказки строк
   и столбцов, проверка «решается логикой» (line-solver), состояние клеток и ходы.

   Состояние клетки: 0 пусто, 1 закрашено, 2 крестик, 3 ошибка (закрашено зря).
   Math.random в логике запрещён — весь случайный выбор идёт через переданный Rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var L = {};

  var EMPTY = 0, FILL = 1, CROSS = 2, WRONG = 3;
  L.EMPTY = EMPTY; L.FILL = FILL; L.CROSS = CROSS; L.WRONG = WRONG;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function idx(n, r, c) { return r * n + c; }

  /* ---------------- цифры-подсказки ---------------- */
  /* [1,1,0,1] -> [2,1]; пустая линия -> [] (рисуется как 0). */
  function clueOf(vals) {
    var out = [], run = 0, i;
    for (i = 0; i < vals.length; i++) {
      if (vals[i]) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out;
  }
  L.clueOf = clueOf;

  /* ---------------- сборка пазла ---------------- */
  L.buildPuzzle = function (n, cells, seed) {
    var rows = [], cols = [], r, c, i;
    for (r = 0; r < n; r++) {
      var row = [];
      for (c = 0; c < n; c++) row.push(cells[idx(n, r, c)] ? 1 : 0);
      rows.push(clueOf(row));
    }
    for (c = 0; c < n; c++) {
      var col = [];
      for (r = 0; r < n; r++) col.push(cells[idx(n, r, c)] ? 1 : 0);
      cols.push(clueOf(col));
    }
    var p = { n: n, cells: cells, rows: rows, cols: cols, filled: 0, seed: seed | 0, maxRuns: 0 };
    for (i = 0; i < cells.length; i++) if (cells[i]) p.filled++;
    for (r = 0; r < n; r++) {
      p.maxRuns = Math.max(p.maxRuns, rows[r].length, cols[r].length);
    }
    return p;
  };

  /* ---------------- генерация образа ---------------- */
  /* Симметричный силуэт: ширина строки задаётся квадратичной кривой через три
     опорные точки (верх / самая широкая часть / низ) плюс шум, затем в теле
     пробиваются симметричные «окошки». Всё детерминировано по rng. */
  L.genShape = function (n, rng) {
    var cells = new Uint8Array(n * n);
    var odd = (n & 1) === 1;
    var maxUnits = Math.ceil(n / 2);          // i=0 — центральная клетка (нечёт) или пара (чёт)
    var y0 = rng.chance(0.4) ? 1 : 0;
    var y1 = n - 1 - (rng.chance(0.4) ? 1 : 0);
    var peak = rng.range(0.26, 0.74);
    var topU = rng.int(Math.max(1, Math.round(maxUnits * 0.22)), Math.max(2, Math.round(maxUnits * 0.60)));
    var midU = rng.int(Math.max(2, Math.round(maxUnits * 0.52)), Math.max(3, Math.round(maxUnits * 0.96)));
    var botU = rng.int(Math.max(1, Math.round(maxUnits * 0.24)), Math.max(2, Math.round(maxUnits * 0.80)));

    function unitWidth(t) {
      // квадратичная интерполяция Лагранжа через (0,topU), (peak,midU), (1,botU)
      var l0 = ((t - peak) * (t - 1)) / ((0 - peak) * (0 - 1));
      var l1 = (t * (t - 1)) / (peak * (peak - 1));
      var l2 = (t * (t - peak)) / (1 * (1 - peak));
      return l0 * topU + l1 * midU + l2 * botU;
    }

    var prev = 0;
    for (var y = y0; y <= y1; y++) {
      var t = (y1 === y0) ? 0.5 : (y - y0) / (y1 - y0);
      var w = Math.round(unitWidth(t));
      if (rng.chance(0.42)) w += rng.chance(0.5) ? 1 : -1;
      if (prev) {
        // плавность: ширина меняется не больше чем на 2 единицы за строку
        if (w > prev + 2) w = prev + 2;
        if (w < prev - 2) w = prev - 2;
      }
      w = clamp(w, 1, maxUnits);
      prev = w;
      for (var i = 0; i < w; i++) setUnit(cells, n, odd, y, i);
    }

    // антенна: одинокая пара клеток над макушкой — силуэт читается как существо
    if (y0 > 0 && rng.chance(0.5)) setUnit(cells, n, odd, y0 - 1, 0);
    if (y1 < n - 1 && rng.chance(0.35)) setUnit(cells, n, odd, y1 + 1, 0);

    // окошки: пробиваем симметричные пары клеток — образ становится «лицом»
    var holes = rng.chance(0.7) ? rng.int(1, 2) : 0;
    for (var h = 0; h < holes; h++) {
      var hy = rng.int(y0 + 1, Math.max(y0 + 1, y1 - 1));
      var units = rowUnits(cells, n, odd, hy);
      if (units < 3) continue;
      var hu = rng.int(1, units - 1);
      punchUnit(cells, n, odd, hy, hu);
      // окошко в толщину две клетки, если тело позволяет
      if (rng.chance(0.45) && hu + 1 <= units - 1) punchUnit(cells, n, odd, hy, hu + 1);
    }
    return cells;
  };

  function setUnit(cells, n, odd, y, i) {
    var base = y * n;
    if (odd) {
      var c = (n - 1) >> 1;
      if (i === 0) cells[base + c] = 1;
      else { cells[base + c - i] = 1; cells[base + c + i] = 1; }
    } else {
      cells[base + (n / 2 - 1 - i)] = 1;
      cells[base + (n / 2 + i)] = 1;
    }
  }
  function punchUnit(cells, n, odd, y, i) {
    var base = y * n;
    if (odd) {
      var c = (n - 1) >> 1;
      if (i === 0) { cells[base + c] = 0; return; }
      cells[base + c - i] = 0; cells[base + c + i] = 0;
    } else {
      cells[base + (n / 2 - 1 - i)] = 0;
      cells[base + (n / 2 + i)] = 0;
    }
  }
  function rowUnits(cells, n, odd, y) {
    var units = 0;
    var c0 = odd ? (n - 1) >> 1 : n / 2 - 1;
    for (var i = 0; i < Math.ceil(n / 2); i++) {
      var a = odd && i === 0 ? c0 : c0 - i;
      var b = odd && i === 0 ? c0 : (odd ? c0 + i : c0 + 1 + i);
      if (cells[y * n + a] || cells[y * n + b]) units = i + 1;
    }
    return units;
  }

  /* ---------------- линия: все варианты размещения ---------------- */
  /* Перебирает расстановки блоков по подсказке, совместимые с известными клетками
     (0 неизвестно, 1 закрашено, 2 крестик). Заполняет fillPos/emptyPos: клетка
     закрашена во ВСЕХ вариантах / пуста во ВСЕХ. Возвращает число вариантов. */
  function lineForce(clue, n, known, fillPos, emptyPos, line) {
    var i, t, count = 0;
    for (i = 0; i < n; i++) { fillPos[i] = 0; emptyPos[i] = 0; line[i] = 0; }
    var segs = clue;
    var m = segs.length;
    if (m === 0) {
      for (i = 0; i < n; i++) if (known[i] === 1) return 0;
      for (i = 0; i < n; i++) emptyPos[i] = 1;
      return 1;
    }
    var suffix = new Array(m + 1);
    suffix[m] = 0;
    for (i = m - 1; i >= 0; i--) suffix[i] = segs[i] + (i < m - 1 ? 1 : 0) + suffix[i + 1];

    function rec(k, pos) {
      if (k === m) {
        for (t = pos; t < n; t++) if (known[t] === 1) return;
        count++;
        if (count > 4096) return; // защита: дальше уточнения уже нет (линия заведомо неоднозначна)
        for (t = 0; t < n; t++) { if (line[t]) fillPos[t] = 1; else emptyPos[t] = 1; }
        return;
      }
      var len = segs[k];
      var last = n - suffix[k];
      for (var s = pos; s <= last; s++) {
        var ok = true;
        for (t = pos; t < s; t++) if (known[t] === 1) { ok = false; break; }
        if (!ok) break;
        for (t = s; t < s + len; t++) if (known[t] === 2) { ok = false; break; }
        if (ok && k < m - 1 && known[s + len] === 1) ok = false;
        if (!ok) continue;
        for (t = s; t < s + len; t++) line[t] = 1;
        rec(k + 1, s + len + 1);
        for (t = s; t < s + len; t++) line[t] = 0;
        if (count > 4096) return;
      }
    }
    rec(0, 0);
    return count;
  }
  L.lineForce = lineForce;

  /* ---------------- «решается логикой» ---------------- */
  /* Прогоняет пропагацию по строкам и столбцам. Если все клетки определены —
     образ решается без угадывания (и решение единственное). */
  L.isSolvable = function (p) {
    var n = p.n, N = n * n;
    var known = new Uint8Array(N);
    var line = new Uint8Array(n), place = new Uint8Array(n);
    var fillPos = new Uint8Array(n), emptyPos = new Uint8Array(n);
    var pass, r, c, i, changed, cnt;
    for (pass = 0; pass < 48; pass++) {
      changed = false;
      for (r = 0; r < n; r++) {
        for (i = 0; i < n; i++) line[i] = known[r * n + i];
        cnt = lineForce(p.rows[r], n, line, fillPos, emptyPos, place);
        if (cnt <= 0) return false;
        for (i = 0; i < n; i++) {
          if (!line[i]) {
            if (fillPos[i] && !emptyPos[i]) { known[r * n + i] = 1; changed = true; }
            else if (emptyPos[i] && !fillPos[i]) { known[r * n + i] = 2; changed = true; }
          }
        }
      }
      for (c = 0; c < n; c++) {
        for (i = 0; i < n; i++) line[i] = known[i * n + c];
        cnt = lineForce(p.cols[c], n, line, fillPos, emptyPos, place);
        if (cnt <= 0) return false;
        for (i = 0; i < n; i++) {
          if (!line[i]) {
            if (fillPos[i] && !emptyPos[i]) { known[i * n + c] = 1; changed = true; }
            else if (emptyPos[i] && !fillPos[i]) { known[i * n + c] = 2; changed = true; }
          }
        }
      }
      if (!changed) break;
    }
    for (i = 0; i < N; i++) if (!known[i]) return false;
    return true;
  };

  /* ---------------- пригодность образа ---------------- */
  function components(p) {
    var n = p.n, seen = new Uint8Array(n * n), stack = [], best = 0;
    for (var s = 0; s < n * n; s++) {
      if (!p.cells[s] || seen[s]) continue;
      var size = 0;
      stack.push(s); seen[s] = 1;
      while (stack.length) {
        var cur = stack.pop(); size++;
        var r = (cur / n) | 0, c = cur % n;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            var rr = r + dr, cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
            var ni = rr * n + cc;
            if (p.cells[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
          }
        }
      }
      if (size > best) best = size;
    }
    return best;
  }

  L.shapeOk = function (p) {
    var n = p.n, i, nonEmptyRows = 0, nonEmptyCols = 0;
    var density = p.filled / (n * n);
    if (density < 0.26 || density > 0.55) return false;
    if (p.maxRuns > 3) return false;
    for (i = 0; i < n; i++) { if (p.rows[i].length) nonEmptyRows++; if (p.cols[i].length) nonEmptyCols++; }
    if (nonEmptyRows < Math.ceil(n * 0.7)) return false;
    if (nonEmptyCols < Math.ceil(n * 0.55)) return false;
    if (components(p) < p.filled * 0.85) return false;
    return true;
  };

  /* ---------------- генерация уровня ---------------- */
  /* Ищем seed, при котором образ пригоден и решается чистой логикой.
     Возвращает первый пригодный решаемый пазл; иначе — лучший пригодный;
     иначе — последний образ (игра всё равно рабочая: есть подсказки и ошибки). */
  L.makePuzzle = function (n, seed, maxTries, Rng) {
    var fallback = null, lastP = null;
    maxTries = maxTries || 48;
    for (var k = 0; k < maxTries; k++) {
      var rng = new Rng((seed ^ Math.imul(k + 1, 2654435761)) >>> 0);
      var cells = L.genShape(n, rng);
      var p = L.buildPuzzle(n, cells, seed + k * 131);
      lastP = p;
      if (!L.shapeOk(p)) continue;
      if (!fallback) fallback = p;
      if (L.isSolvable(p)) return p;
    }
    return fallback || lastP || L.buildPuzzle(n, L.genShape(n, new Rng(seed)), seed);
  };

  /* ---------------- состояние партии ---------------- */
  L.newState = function (p, mistakes, extraLives) {
    var n = p.n;
    var st = {
      n: n, p: p,
      cells: new Array(n * n),
      mistakes: (mistakes | 0) + (extraLives | 0),
      maxMistakes: (mistakes | 0) + (extraLives | 0),
      baseMistakes: mistakes | 0,
      wrong: 0, hints: 0, filled: 0,
      solved: false,
      rowDone: new Array(n), colDone: new Array(n)
    };
    for (var i = 0; i < n * n; i++) st.cells[i] = EMPTY;
    for (i = 0; i < n; i++) { st.rowDone[i] = false; st.colDone[i] = false; }
    return st;
  };

  function lineComplete(st, kind, line) {
    var n = st.n, i, r, c;
    for (i = 0; i < n; i++) {
      var v = kind === 'row' ? idx(n, line, i) : idx(n, i, line);
      if (st.p.cells[v]) {
        if (st.cells[v] !== FILL) return false;   // нужная клетка не закрашена
      } else if (st.cells[v] === WRONG) return false; // в линии есть ошибка
    }
    return true;
  }

  /* Пересчёт готовых линий + автокрестики в пустых клетках готовой линии.
     Возвращает массив новых готовых линий: [{kind:'row'|'col', idx, cells:[...]}] */
  L.syncLines = function (st) {
    var n = st.n, i, out = [], r, c;
    for (r = 0; r < n; r++) {
      if (st.rowDone[r]) continue;
      if (!lineComplete(st, 'row', r)) continue;
      st.rowDone[r] = true;
      var crossed = [];
      for (i = 0; i < n; i++) {
        var v = idx(n, r, i);
        if (st.cells[v] === EMPTY) { st.cells[v] = CROSS; crossed.push(v); }
      }
      out.push({ kind: 'row', idx: r, cells: crossed });
    }
    for (c = 0; c < n; c++) {
      if (st.colDone[c]) continue;
      if (!lineComplete(st, 'col', c)) continue;
      st.colDone[c] = true;
      crossed = [];
      for (i = 0; i < n; i++) {
        var v2 = idx(n, i, c);
        if (st.cells[v2] === EMPTY) { st.cells[v2] = CROSS; crossed.push(v2); }
      }
      out.push({ kind: 'col', idx: c, cells: crossed });
    }
    return out;
  };

  function recount(st) {
    var f = 0, w = 0;
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] === FILL) f++;
      else if (st.cells[i] === WRONG) w++;
    }
    st.filled = f; st.wrong = w;
    st.solved = (w === 0 && f === st.p.filled);
    return st.solved;
  }

  /* Ход по клетке. mode: 'fill' | 'cross'.
     Возвращает { changed, mistake, outOfLives, solved, lines }. */
  L.tap = function (st, i, mode) {
    var res = { changed: false, mistake: false, outOfLives: false, solved: false, lines: [] };
    if (st.solved) return res;
    if (i < 0 || i >= st.cells.length) return res;
    var cur = st.cells[i];
    if (mode === 'cross') {
      if (cur === CROSS) st.cells[i] = EMPTY;
      else {
        if (cur === WRONG) st.wrong--;
        st.cells[i] = CROSS;
      }
      res.changed = true;
    } else {
      if (cur === FILL) { st.cells[i] = EMPTY; res.changed = true; }
      else if (cur === WRONG) { st.cells[i] = EMPTY; st.wrong--; res.changed = true; }
      else if (st.p.cells[i]) { st.cells[i] = FILL; res.changed = true; }
      else {
        st.cells[i] = WRONG;
        st.wrong++;
        st.mistakes--;
        res.changed = true; res.mistake = true;
        if (st.mistakes <= 0) { st.mistakes = 0; res.outOfLives = true; }
      }
    }
    if (res.changed && !res.outOfLives) res.lines = L.syncLines(st);
    recount(st);
    res.solved = st.solved;
    return res;
  };

  /* Подсказка: открывает целиком самую «пустую» линию (строка или столбец). */
  L.hintLine = function (st, rng) {
    var n = st.n, bestKind = '', bestIdx = -1, bestScore = -1;
    var r, c, i, v, score;
    for (r = 0; r < n; r++) {
      if (st.rowDone[r]) continue;
      score = 0;
      for (i = 0; i < n; i++) {
        v = idx(n, r, i);
        if (st.cells[v] === EMPTY || st.cells[v] === WRONG) score++;
        if (st.p.cells[v]) score += 2;   // линии с картинкой полезнее и заметнее
      }
      if (score > bestScore) { bestScore = score; bestKind = 'row'; bestIdx = r; }
    }
    for (c = 0; c < n; c++) {
      if (st.colDone[c]) continue;
      score = 0;
      for (i = 0; i < n; i++) {
        v = idx(n, i, c);
        if (st.cells[v] === EMPTY || st.cells[v] === WRONG) score++;
        if (st.p.cells[v]) score += 2;
      }
      if (score > bestScore) { bestScore = score; bestKind = 'col'; bestIdx = c; }
    }
    if (bestIdx < 0) return null;
    var opened = [];
    for (i = 0; i < n; i++) {
      v = bestKind === 'row' ? idx(n, bestIdx, i) : idx(n, i, bestIdx);
      if (st.cells[v] === WRONG) st.wrong--;
      st.cells[v] = st.p.cells[v] ? FILL : CROSS;
      opened.push(v);
    }
    st.hints++;
    var lines = L.syncLines(st);
    recount(st);
    return { kind: bestKind, idx: bestIdx, cells: opened, lines: lines };
  };

  /* Ластик: стирает все ошибочные закраски и возвращает одну ошибку. */
  L.eraseWrong = function (st) {
    var cleared = 0;
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] === WRONG) { st.cells[i] = EMPTY; cleared++; }
    }
    st.wrong = 0;
    if (cleared && st.mistakes < st.maxMistakes) st.mistakes++;
    recount(st);
    return cleared;
  };

  /* +1 ошибка (жизнь). Возвращает новое число ошибок. */
  L.addLife = function (st) {
    st.mistakes++;
    if (st.mistakes > st.maxMistakes) st.maxMistakes = st.mistakes;
    return st.mistakes;
  };

  /* Второй шанс после поражения: стираем ошибки и даём одну жизнь. */
  L.revive = function (st) {
    L.eraseWrong(st);
    st.mistakes = Math.max(1, st.mistakes + 1);
    return st.mistakes;
  };

  /* ---------------- автопилот / capture ---------------- */
  /* Ближайшая по «скану» незакрашенная нужная клетка — автопилот рисует образ
     слева-направо, сверху вниз, поэтому видео читается как проявление картинки. */
  L.nextSolutionCell = function (st) {
    var N = st.cells.length;
    for (var i = 0; i < N; i++) {
      if (st.p.cells[i] && st.cells[i] !== FILL) return i;
    }
    return -1;
  };

  /* Заполнить часть решения (доля 0..1) в порядке скана + проставить крестики
     в чистых клетках тех строк, которые от этого стали готовыми. */
  L.preSolve = function (st, fraction) {
    var need = Math.round(st.p.filled * clamp(fraction, 0, 1));
    var done = 0, N = st.cells.length;
    for (var i = 0; i < N && done < need; i++) {
      if (st.p.cells[i]) { st.cells[i] = FILL; done++; }
    }
    L.syncLines(st);
    recount(st);
    return done;
  };

  L.revealAll = function (st) {
    for (var i = 0; i < st.cells.length; i++) {
      st.cells[i] = st.p.cells[i] ? FILL : CROSS;
    }
    for (var r = 0; r < st.n; r++) st.rowDone[r] = true;
    for (var c = 0; c < st.n; c++) st.colDone[c] = true;
    st.wrong = 0;
    recount(st);
    return st;
  };

  L.countFilled = function (st) {
    var n = 0;
    for (var i = 0; i < st.cells.length; i++) if (st.cells[i] === FILL) n++;
    return n;
  };

  G.logic = L;
})(window.GAME);
