/* game/config.js — настройки «Слияния 2048».
   Standalone: пишем в window.GAME.config. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var CONFIG = {
    id: 'merge2048',
    version: '1.0.0',
    palette: {
      bg: '#0f0c1d',
      bg2: '#1a1633',
      board: '#151126',
      cell: '#2a2445',
      cellHot: '#3d3560',
      tile: '#f5e6c8',
      tile2: '#eee4da',
      tile4: '#ede0c8',
      tile8: '#f2b179',
      tile16: '#f59563',
      tile32: '#f67c5f',
      tile64: '#f65e3b',
      tile128: '#edcf72',
      tile256: '#edcc61',
      tile512: '#edc850',
      tile1024: '#edc53f',
      tile2048: '#edc22e',
      text: '#f5f0e0',
      dim: '#b8a88a',
      accent: '#d4a94e',
      coin: '#ffd43b',
      good: '#6dd98a',
      bad: '#ff6b81',
      panel: 'rgba(21,17,38,0.95)',
      panelBorder: '#d4a94e'
    },
    // Размер поля
    grid: { size: 4 },
    // Цели уровней: значение плитки, которую нужно создать
    levelTarget: function (lv) {
      var targets = [128, 256, 512, 1024, 2048, 2048, 2048, 2048, 2048, 2048,
                     2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048];
      return targets[Math.min(lv - 1, targets.length - 1)];
    },
    // Максимальный уровень
    maxLevel: 20,
    // Экономика
    economy: {
      startCoins: 50,
      winBase: 40,
      winPerLevel: 10,
      rvCoins: 60,
      hintPrice: 25,      // показать лучший ход
      shufflePrice: 35,   // перемешать поле
      undoPrice: 30,      // отменить ход
      bombPrice: 50       // убрать самую маленькую плитку
    },
    // Стрик
    streak: {
      enabled: true,
      rewardBase: 20,
      rewardPerDay: 5
    }
  };

  G.config = CONFIG;
  G.id = CONFIG.id;
})(window.GAME);
