/* game/config.js — настройки «Судоку Лайт».
   Standalone: пишем в window.GAME.config. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var CONFIG = {
    id: 'sudokulite',
    version: '1.0.0',
    palette: {
      bg: '#0d1117',
      bg2: '#161c26',
      board: '#0a0e14',
      cell: '#1c2330',
      cellHot: '#2a3444',
      cellGiven: '#2a3444',
      grid: '#2a3444',
      gridThick: '#4ecdc4',
      text: '#f0f4f8',
      dim: '#8899aa',
      accent: '#4ecdc4',
      coin: '#ffd43b',
      good: '#6dd98a',
      bad: '#ff6b81',
      panel: 'rgba(10,14,20,0.95)',
      panelBorder: '#4ecdc4',
      num1: '#ff6b6b', num2: '#4ecdc4', num3: '#45b7d1',
      num4: '#96ceb4', num5: '#ffeaa7', num6: '#dda0dd'
    },
    // Сетка 6×6 (блоки 2×3)
    grid: { size: 6, blockW: 2, blockH: 3 },
    // Максимальный уровень
    maxLevel: 20,
    // Сложность: сколько клеток открыто на старте
    levelGivens: function (lv) {
      return Math.max(10, 24 - lv); // 23 → 10
    },
    // Экономика
    economy: {
      startCoins: 50,
      winBase: 40,
      winPerLevel: 10,
      rvCoins: 60,
      hintPrice: 25,      // показать правильную цифру
      erasePrice: 30,     // стереть ошибку
      checkPrice: 20,     // проверить поле
      solvePrice: 80      // решить клетку
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
