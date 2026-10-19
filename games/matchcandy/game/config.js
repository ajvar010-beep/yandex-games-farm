/* game/config.js — контентный конфиг «Сладкий Рай» (три-в-ряд).
   Конвейер меняет config/i18n/art/entities/scenes; ядро (engine/) не трогает. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'matchcandy';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#2b1240', bg2: '#4a1d6e',
      cell: '#3a1e58', cellHot: '#54297c', board: '#1e0f30',
      text: '#fff0fa', dim: '#c9a8e0',
      panel: 'rgba(32,16,50,0.95)', panelBorder: '#ff8fb2',
      accent: '#ff8fb2', coin: '#ffd43b', good: '#59d977', bad: '#ff6b81', hint: '#ffe066'
    },
    board: { cols: 8, rows: 8 },
    kinds: ['berry', 'lemon', 'mint', 'grape', 'orange', 'choco'],   // 6 видов сладостей
    kindsCount: function (lv) { return Math.min(6, 4 + Math.floor(lv / 6)); }, // 4..6 видов по уровню
    levelMoves: function (lv) { return Math.max(14, 24 - Math.floor(lv / 2)); }, // ходов на уровень
    levelTarget: function (lv) { return 600 + lv * 420; },                        // очков до победы
    maxLevel: 20,
    score: { match3: 60, match4: 150, match5: 320, cascade2: 40, cascadeStep: 30 },
    economy: {
      startCoins: 40,
      winBase: 36, winPerLevel: 10,
      rvCoins: 60,
      bombPrice: 35,  bombGrowth: 1.14,
      rowPrice: 30,   rowGrowth: 1.12,
      shufflePrice: 40, shuffleGrowth: 1.12,
      hintPrice: 20,  hintGrowth: 1.10
    },
    record: { coinCap: 500 }
  };
  G.config.boosterCost = function (base, growth, n) { return Math.round(base * Math.pow(growth, n)); };
})(window.GAME);
