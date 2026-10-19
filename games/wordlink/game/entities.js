/* game/entities.js — логика «Словарного Моста»: словари RU/EN, генерация
   букв по целям уровня, проверка слов, подсказки. Все правила детерминированны rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;

  /* ---------- словари: частые слова 3–7 букв, без имён/падежей-форм ---------- */
  var WORDS_RU = [
    'дом','лес','мир','сон','час','шар','яма','бок','вес','газ','дух','жар','зал','кит','лук',
    'мёд','нос','пёс','рот','сад','тип','ужин','фон','хлеб','цвет','шум','юмор','ящик','квас',
    'лампа','мост','ночь','парк','река','снег','трава','улица','флаг','хвост','центр','школа',
    'юность','ящер','книга','лимон','машина','небо','окно','письмо','работа','солнце','телефон',
    'утро','фильм','холод','цветок','чашка','шарф','экран','яблоко','ягода','банан','вокзал',
    'город','дерево','журнал','звезда','игрушка','йогурт','картина','ложка','музыка','ножницы',
    'облако','птица','рыбка','собака','торт','учитель','футбол','хоккей','черепаха','шоколад',
    'элемент','юбилей','язык','автор','билет','валюта','герой','диплом','ежик','жёлудь','зонтик',
    'икона','капля','лестница','медведь','невеста','остров','печенье','ресторан','свеча','тюльпан'
  ];
  var WORDS_EN = [
    'cat','dog','sun','map','box','car','day','egg','fox','gem','hat','ice','jam','key','log',
    'moon','nest','owl','pig','rain','star','tree','wind','bird','book','cake','door','fish',
    'gold','home','leaf','milk','note','park','ring','ship','snow','time','wave','apple','beach',
    'cloud','dance','eagle','flame','grape','house','island','juice','knife','light','mouse',
    'night','ocean','piano','queen','river','stone','tiger','uncle','voice','water','youth',
    'zebra','bridge','candle','dream','earth','flower','garden','heart','image','jungle',
    'kitten','lemon','mirror','nature','orange','people','quiet','rocket','silver','temple',
    'unique','valley','window','yellow','breeze','castle','dolphin','emerald','forest','glacier',
    'harbor','inkwell','journey','kingdom','lantern','meadow','notebook','orchard','pyramid'
  ];

  /* веса букв (Scrabble-подобные, для очков и плиток) */
  var W_RU = { 'а':1,'б':3,'в':1,'г':3,'д':2,'е':1,'ё':3,'ж':5,'з':5,'и':1,'й':4,'к':2,'л':2,'м':2,'н':1,'о':1,'п':2,'р':1,'с':1,'т':1,'у':2,'ф':10,'х':5,'ц':5,'ч':5,'ш':8,'щ':10,'ъ':10,'ы':4,'ь':3,'э':8,'ю':8,'я':3 };
  var W_EN = { 'a':1,'b':3,'c':3,'d':2,'e':1,'f':4,'g':2,'h':4,'i':1,'j':8,'k':5,'l':1,'m':3,'n':1,'o':1,'p':3,'q':10,'r':1,'s':1,'t':1,'u':1,'v':4,'w':4,'x':8,'y':4,'z':10 };

  function dict(lang) { return lang === 'ru' ? WORDS_RU : WORDS_EN; }
  function weights(lang) { return lang === 'ru' ? W_RU : W_EN; }
  function alphabet(lang) { return Object.keys(weights(lang)); }

  function wordScore(word, lang) {
    var w = weights(lang), s = 0;
    for (var i = 0; i < word.length; i++) s += w[word[i]] || 1;
    return s * C.score.perLetter + word.length * C.score.lenBonus;
  }

  /* ---------- генерация уровня: берём N целевых слов, выдаём их буквы ---------- */
  // Буквы = объединение целевых слов с учётом кратности (слово «торт» требует 2×'т').
  // Число букв НЕ фиксировано — подстраивается под слова (от count до maxCount).
  function makeLevel(level, lang, rng) {
    var words = dict(lang);
    var need = C.levelWords(level);
    var minLen = C.letters.minLen, maxLen = Math.min(C.letters.maxLen, 3 + Math.floor(level / 3));
    var pool = words.filter(function (w) { return w.length >= minLen && w.length <= maxLen; });
    var maxCount = C.letters.count + 2; // до 9 букв на поздних уровнях
    for (var attempt = 0; attempt < 400; attempt++) {
      var chosen = [];
      for (var k = 0; k < need; k++) {
        var w = pool[Math.floor(rng.float() * pool.length) % pool.length];
        if (chosen.indexOf(w) >= 0) { k--; continue; }
        chosen.push(w);
      }
      // собрать letters как МУЛЬТИМНОЖЕСТВО: максимум кратности каждой буквы по всем словам
      var maxCnt = {};
      for (var wi = 0; wi < chosen.length; wi++) {
        var w = chosen[wi], cnt = {};
        for (var i = 0; i < w.length; i++) cnt[w[i]] = (cnt[w[i]] || 0) + 1;
        for (var ch in cnt) maxCnt[ch] = Math.max(maxCnt[ch] || 0, cnt[ch]);
      }
      var letters = [];
      for (var ch2 in maxCnt) for (var m = 0; m < maxCnt[ch2]; m++) letters.push(ch2);
      if (letters.length > maxCount) continue; // слишком разрозненные слова — перевыбрать
      // добиваем случайными буквами до минимума count (чтобы не было слишком мало)
      var abc = alphabet(lang);
      while (letters.length < C.letters.count) {
        var rc = abc[Math.floor(rng.float() * abc.length) % abc.length];
        letters.push(rc);
      }
      // все слова словаря, которые можно сложить из этих букв (для бонусов)
      var canBuild = words.filter(function (w) {
        if (w.length < minLen || w.length > maxLen) return false;
        return canSpell(w, letters);
      });
      return { letters: shuffleArr(letters, rng), targets: chosen, bonus: canBuild.filter(function (w) { return chosen.indexOf(w) < 0; }) };
    }
    // fallback: первое слово из пула + добивка (гарантированно складывается)
    var fb = pool.slice(0, 1);
    var fset = {};
    fb.forEach(function (w) { for (var i = 0; i < w.length; i++) fset[w[i]] = true; });
    var fl = Object.keys(fset);
    var abc2 = alphabet(lang);
    while (fl.length < C.letters.count) fl.push(abc2[Math.floor(rng.float() * abc2.length) % abc2.length]);
    return { letters: shuffleArr(fl, rng), targets: fb, bonus: [] };
  }

  function shuffleArr(a, rng) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) {
      var j = Math.floor(rng.float() * (i + 1)) % (i + 1);
      var t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }

  function canSpell(word, letters) {
    var cnt = {};
    for (var i = 0; i < letters.length; i++) cnt[letters[i]] = (cnt[letters[i]] || 0) + 1;
    for (var j = 0; j < word.length; j++) {
      if (!cnt[word[j]]) return false;
      cnt[word[j]]--;
    }
    return true;
  }

  /* подсказка: первая неоткрытая буква первого нерешённого целевого слова */
  function hintLetter(targets, found, revealed) {
    for (var t = 0; t < targets.length; t++) {
      var w = targets[t];
      if (found[w]) continue;
      for (var i = 0; i < w.length; i++) {
        var key = w + ':' + i;
        if (!revealed[key]) return { word: w, index: i, letter: w[i], key: key };
      }
    }
    return null;
  }

  G.words = {
    dict: dict, weights: weights, wordScore: wordScore,
    makeLevel: makeLevel, canSpell: canSpell, hintLetter: hintLetter
  };
})(window.GAME);
