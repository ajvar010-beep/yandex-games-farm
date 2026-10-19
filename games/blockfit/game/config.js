/* game/config.js — настройки «Блок-Фита».
   Standalone: пишем в window.GAME.config. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var CONFIG = {
    id: 'blockfit',
    version: '1.0.0',
    palette: {
      bg: '#0d1117',
      bg2: '#161c26',
      board: '#0a0e14',
      cell: '#1c2330',
      cellHot: '#2a3444',
      grid: '#2a3444',
      text: '#f0f4f8',
      dim: '#8899aa',
      accent: '#4ecdc4',
      coin: '#ffd43b',
      good: '#6dd98a',
      bad: '#ff6b81',
      panel: 'rgba(10,14,20,0.95)',
      panelBorder: '#4ecdc4',
      // цвета фигур
      c1: '#ff6b6b', c2: '#4ecdc4', c3: '#45b7d1', c4: '#96ceb4',
      c5: '#ffeaa7', c6: '#dda0dd', c7: '#98d8c8', c8: '#f7dc6f'
    },
    // Размер поля
    grid: { cols: 10, rows: 10 },
    // Очки за линию
    scoreLine: 100,
    scoreCell: 10,
    // Максимальный уровень
    maxLevel: 20,
    // Цель уровня: очки
    levelTarget: function (lv) {
      return 500 + (lv - 1) * 300;
    },
    // Экономика
    economy: {
      startCoins: 50,
      winBase: 40,
      winPerLevel: 10,
      rvCoins: 60,
      hintPrice: 25,      // показать лучшее место
      shufflePrice: 35,   // новые фигуры
      undoPrice: 30,      // отменить размещение
      bombPrice: 45       // убрать случайную заполненную область 3×3
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
