/* game/config.js — контентный конфиг «Словарный Мост» (слова).
   Конвейер меняет config/i18n/art/entities/scenes; ядро (engine/) не трогает. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'wordlink';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#1d1426', bg2: '#2e1f3d',
      cell: '#3a2a4d', cellHot: '#54406e', board: '#150d1f',
      text: '#f5edff', dim: '#b79fd0',
      panel: 'rgba(21,13,31,0.95)', panelBorder: '#d4a94e',
      accent: '#d4a94e', coin: '#ffd43b', good: '#6dd98a', bad: '#ff6b81', hint: '#ffe066',
      tile: '#8a5a2b', tileDark: '#5c3a1a', tileEdge: '#c8924a'
    },
    letters: { count: 7, minLen: 3, maxLen: 7 },   // букв в круге, длина слов
    levelWords: function (lv) { return Math.min(6, 2 + Math.floor(lv / 4)); },      // слов-целей на уровень 2..6
    levelTime: function (lv) { return Math.max(60, 120 - lv * 2); },                // секунд на уровень 118..80
    maxLevel: 20,
    score: { perLetter: 10, lenBonus: 5, targetMult: 25 },
    economy: {
      startCoins: 50,
      winBase: 40, winPerLevel: 12,
      rvCoins: 60,
      hintPrice: 25,  hintGrowth: 1.12,
      letterPrice: 35, letterGrowth: 1.15,
      shufflePrice: 30, shuffleGrowth: 1.12,
      timePrice: 40,  timeGrowth: 1.14
    },
    record: { coinCap: 500 }
  };
  G.config.boosterCost = function (base, growth, n) { return Math.round(base * Math.pow(growth, n)); };
})(window.GAME);
