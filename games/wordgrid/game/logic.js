/* game/logic.js — чистая логика «Слово-Сетки»: выбор слов темы, размещение их в сетке
   по восьми направлениям, заполнение шумом, свайп-путь и сверка слова.
   Ни DOM, ни Canvas, ни Engine: rng приходит снаружи (E.Rng), поэтому файл
   проверяется в Node без браузера. Math.random здесь запрещён. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;
  var L = {};

  var DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  /* Взвешенные алфавиты: частые буквы встречаются чаще, поэтому шум не выглядит
     мусором из редких «Щ» и «Ъ». Только буквы, допустимые в словах списков. */
  var ALPHA = {
    ru: 'АААААААААААББВВВВВГГДДДЕЕЕЕЕЕЕЖЗЗИИИИИИЙККККЛЛЛЛММММНННННННООООООППППРРРРРССССССТТТТТУУУУФХЦЧЧШШЩЫЭЮЯ',
    en: 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMMWWFFGGYYPPBBVKJXQZ'
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function upper(s) { return String(s).toUpperCase(); }

  L.DIRS = DIRS;
  L.clamp = clamp;
  L.levelCount = function () { return C.levels.length; };

  L.levelCfg = function (n) { return C.levels[clamp(n | 0, 1, C.levels.length) - 1]; };
  L.themeOf = function (n) {
    var cfg = L.levelCfg(n);
    return C.themes[cfg.theme];
  };
  L.timeFor = function (n) { return L.levelCfg(n).time; };
  L.coinsForWord = function (len) { return C.economy.wordBase + C.economy.wordPerLen * len; };
  L.wordScore = function (len) { return len * 10; };
  /* Цена товара растёт с каждой покупкой этого товара (счётчик хранится в сохранении). */
  L.price = function (base, bought) {
    return Math.round(base * Math.pow(C.economy.priceGrowth, Math.max(0, bought | 0)));
  };

  function rndLetter(lang, rng) {
    var a = ALPHA[lang] || ALPHA.ru;
    return a.charAt(rng.int(0, a.length - 1));
  }
  L.rndLetter = rndLetter;

  function shuffleIn(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = rng.int(0, i);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  L.shuffleIn = shuffleIn;

  /* Пул темы: только слова нужной длины под эту сетку, без повторов, заглавными. */
  L.pool = function (level, lang) {
    var cfg = L.levelCfg(level);
    var theme = C.themes[cfg.theme];
    var list = (theme && theme[lang]) ? theme[lang] : ((theme && theme.ru) || []);
    var maxLen = Math.min(C.board.maxLen, cfg.size);
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      var w = upper(list[i]);
      var n = w.length;
      if (n < C.board.minLen || n > maxLen) continue;
      if (seen[w]) continue;
      seen[w] = 1;
      out.push(w);
    }
    return out;
  };

  /* Выбор слов уровня: перемешиваем пул детерминированно и берём N. */
  L.pickWords = function (level, lang, rng) {
    var cfg = L.levelCfg(level);
    var pool = L.pool(level, lang);
    shuffleIn(pool, rng);
    return pool.slice(0, Math.min(cfg.words, pool.length));
  };

  /* Попытка поставить одно слово в пустую/совпадающую сетку. Возвращает массив
     индексов клеток или null. Пересечения разрешены, если буквы совпадают. */
  function placeWord(cells, size, word, rng, tries) {
    for (var t = 0; t < tries; t++) {
      var d = DIRS[rng.int(0, DIRS.length - 1)];
      var sx = rng.int(0, size - 1), sy = rng.int(0, size - 1);
      var ex = sx + d[0] * (word.length - 1), ey = sy + d[1] * (word.length - 1);
      if (ex < 0 || ey < 0 || ex >= size || ey >= size) continue;
      var ok = true, path = [];
      for (var i = 0; i < word.length; i++) {
        var x = sx + d[0] * i, y = sy + d[1] * i;
        var k = y * size + x;
        if (cells[k] && cells[k] !== word.charAt(i)) { ok = false; break; }
        path.push(k);
      }
      if (!ok) continue;
      for (i = 0; i < path.length; i++) cells[path[i]] = word.charAt(i);
      return path;
    }
    return null;
  }

  function blank(size) {
    var a = new Array(size * size);
    for (var i = 0; i < a.length; i++) a[i] = '';
    return a;
  }

  function byLenDesc(a, b) { return b.length - a.length; }

  function build(words, size, lang, rng) {
    var cells = blank(size);
    var placed = [];
    var order = words.slice().sort(byLenDesc);
    for (var wi = 0; wi < order.length; wi++) {
      var path = placeWord(cells, size, order[wi], rng, 700);
      if (!path) return null;
      placed.push({ text: order[wi], path: path, found: false });
    }
    for (var i = 0; i < cells.length; i++) if (!cells[i]) cells[i] = rndLetter(lang, rng);
    var byText = {};
    for (i = 0; i < placed.length; i++) byText[placed[i].text] = placed[i];
    var out = [];
    for (i = 0; i < words.length; i++) out.push(byText[words[i]]);
    return { cells: cells, words: out };
  }

  /* Полная генерация раунда. Детерминирована по rng: один seed — одна сетка.
     Если длинные слова не влезают, порядок списка прокручивается, затем набор
     урезается — раунд никогда не остаётся без слов. */
  L.newRound = function (level, lang, rng) {
    var n = clamp(level | 0, 1, C.levels.length);
    var cfg = L.levelCfg(n);
    var size = cfg.size;
    var words = L.pickWords(n, lang, rng);
    var res = null, attempt;
    for (attempt = 0; attempt < 30 && !res; attempt++) {
      res = build(words, size, lang, rng);
      if (!res && words.length > 1) words.push(words.shift());
    }
    while (!res && words.length > 4) {
      words.pop();
      for (attempt = 0; attempt < 24 && !res; attempt++) {
        res = build(words, size, lang, rng);
        if (!res) words.push(words.shift());
      }
    }
    if (!res) {
      words = L.pool(n, lang).slice(0, 4);
      res = build(words, size, lang, rng) || { cells: blank(size), words: [] };
      for (var i = 0; i < res.cells.length; i++) if (!res.cells[i]) res.cells[i] = rndLetter(lang, rng);
      if (!res.words.length) {
        for (i = 0; i < words.length; i++) {
          var p = [i];
          res.cells[i] = words[i].charAt(0);
          res.words.push({ text: words[i], path: p, found: false });
        }
      }
    }
    return {
      level: n, lang: lang, theme: cfg.theme, size: size,
      cells: res.cells, words: res.words
    };
  };

  /* ---------- работа с путём свайпа ---------- */

  L.idx = function (size, x, y) { return (y | 0) * size + (x | 0); };
  L.xOf = function (size, k) { return k % size; };
  L.yOf = function (size, k) { return Math.floor(k / size); };

  L.adjacent = function (size, a, b) {
    var ax = a % size, ay = Math.floor(a / size);
    var bx = b % size, by = Math.floor(b / size);
    var dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    return dx <= 1 && dy <= 1 && (dx + dy) > 0;
  };

  L.pathText = function (st, path) {
    var s = '';
    for (var i = 0; i < path.length; i++) s += st.cells[path[i]] || '';
    return s;
  };

  /* Ищет ненайденное слово, совпадающее с набранным (в прямом или обратном чтении). */
  L.findWord = function (st, text) {
    var u = upper(text);
    var r = u.split('').reverse().join('');
    for (var i = 0; i < st.words.length; i++) {
      var w = st.words[i];
      if (w.found) continue;
      if (w.text === u || w.text === r) return w;
    }
    return null;
  };

  L.countFound = function (st) {
    var n = 0;
    for (var i = 0; i < st.words.length; i++) if (st.words[i].found) n++;
    return n;
  };
  L.allFound = function (st) { return st.words.length > 0 && L.countFound(st) === st.words.length; };
  L.firstUnfound = function (st) {
    for (var i = 0; i < st.words.length; i++) if (!st.words[i].found) return st.words[i];
    return null;
  };

  /* Карта подсвеченных клеток: индекс -> true. Нужна отрисовке каждый кадр. */
  L.foundMap = function (st) {
    var m = {};
    for (var i = 0; i < st.words.length; i++) {
      var w = st.words[i];
      if (!w.found) continue;
      for (var j = 0; j < w.path.length; j++) m[w.path[j]] = true;
    }
    return m;
  };
  L.wordsOnCell = function (st, idx) {
    var n = 0;
    for (var i = 0; i < st.words.length; i++) {
      var p = st.words[i].path;
      if (st.words[i].found && p.indexOf(idx) >= 0) n++;
    }
    return n;
  };

  /* Перетрясти только свободные буквы (шум). Слова остаются на местах. */
  L.shuffleFiller = function (st, rng) {
    var keep = {};
    for (var i = 0; i < st.words.length; i++) {
      var p = st.words[i].path;
      for (var j = 0; j < p.length; j++) keep[p[j]] = 1;
    }
    for (i = 0; i < st.cells.length; i++) if (!keep[i]) st.cells[i] = rndLetter(st.lang, rng);
  };

  /* Полная перекладка: найденные слова остаются на месте (они «зачёркнуты»),
     ненайденные переезжают в новые места, шум пересыпается. Если разложить
     не удалось — откат к пересыпанию шума. Возвращает true, если доска переложена. */
  L.reshuffle = function (st, rng) {
    var size = st.size, i;
    var unfound = st.words.filter(function (w) { return !w.found; });
    if (!unfound.length) return false;
    for (var attempt = 0; attempt < 14; attempt++) {
      var cells = blank(size);
      var locked = {};
      for (i = 0; i < st.words.length; i++) {
        var w = st.words[i];
        if (!w.found) continue;
        for (var j = 0; j < w.path.length; j++) {
          cells[w.path[j]] = st.cells[w.path[j]];
          locked[w.path[j]] = 1;
        }
      }
      var order = unfound.slice().sort(function (a, b) { return b.text.length - a.text.length; });
      var paths = {}, ok = true;
      for (i = 0; i < order.length; i++) {
        var p = placeWord(cells, size, order[i].text, rng, 600);
        if (!p) { ok = false; break; }
        paths[order[i].text] = p;
      }
      if (!ok) continue;
      for (i = 0; i < cells.length; i++) if (!cells[i]) cells[i] = rndLetter(st.lang, rng);
      st.cells = cells;
      for (i = 0; i < st.words.length; i++) {
        if (!st.words[i].found) st.words[i].path = paths[st.words[i].text];
      }
      return true;
    }
    L.shuffleFiller(st, rng);
    return false;
  };

  G.logic = L;
})(window.GAME);
