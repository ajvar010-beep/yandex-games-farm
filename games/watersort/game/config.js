/* game/config.js — контентный конфиг «Аквалайн» (сортировка цветной воды по трубкам).
   Конвейер меняет config/i18n/art/entities/scenes; ядро (engine/) не трогает. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'watersort';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#08222e', bg2: '#0e3b4d',
      tubeGlass: 'rgba(190,232,246,0.16)', tubeEdge: '#7fc4dd', tubeRim: '#bde7f5',
      text: '#eaf7fc', dim: '#93bdcc',
      panel: 'rgba(6,26,36,0.94)', panelBorder: '#2fd6c3',
      accent: '#2fd6c3', coin: '#ffd43b', good: '#59d977', bad: '#ff6b81',
      empty: '#123c4e', hint: '#ffe066'
    },
    capacity: 4,                 // слоёв жидкости в трубке
    colors: ['#ff5d73', '#ffa94d', '#ffd43b', '#69db7c', '#22c9c9', '#4dabf7', '#9775fa', '#f783ac', '#b8e24a'],
    levelColors: function (lv) { return Math.min(9, 3 + Math.floor((lv - 1) / 2)); }, // 3..9 цветов
    levelEmpty: function (lv) { return lv <= 2 ? 3 : 2; },                            // пустых трубок
    maxLevel: 20,
    economy: {
      startCoins: 45,
      solveBase: 34, solvePerLevel: 9,   // награда за решённый уровень
      rvCoins: 60,                        // rewarded: +монеты
      undoPrice: 20,    undoGrowth: 1.10,
      tubePrice: 45,    tubeGrowth: 1.14,
      hintPrice: 30,    hintGrowth: 1.10,
      shufflePrice: 40, shuffleGrowth: 1.12
    },
    record: { coinCap: 500 }   // record-safe: экономика не улетает в бесконечность на 28 с
  };
  G.config.boosterCost = function (base, growth, n) { return Math.round(base * Math.pow(growth, n)); };
})(window.GAME);
