/* game/config.js — настройки «Шарового Залпа».
   Standalone: пишем в window.GAME.config. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var CONFIG = {
    id: 'bubblepop',
    version: '1.0.0',
    palette: {
      bg: '#0a1a2a',
      bg2: '#0f2a3a',
      board: '#0d2a3a',
      ceiling: '#1a3a4a',
      grid: '#2a4a5a',
      cell: '#1c2330',
      cellHot: '#2a3444',
      text: '#f0f4f8',
      dim: '#8899aa',
      accent: '#4ecdc4',
      coin: '#ffd43b',
      good: '#6dd98a',
      bad: '#ff6b81',
      panel: 'rgba(10,26,42,0.95)',
      panelBorder: '#4ecdc4',
      // цвета шариков
      bubble1: '#ff6b6b', // красный
      bubble2: '#4ecdc4', // бирюзовый
      bubble3: '#45b7d1', // голубой
      bubble4: '#96ceb4', // зелёный
      bubble5: '#ffeaa7', // жёлтый
      bubble6: '#dda0dd'  // фиолетовый
    },
    // Физика
    physics: {
      ballSpeed: 400,
      ballRadius: 16,
      ceilingY: 80,
      gravity: 0, // шарики не падают сами
      bounceDamping: 0.8
    },
    // Игра
    game: {
      shotsBase: 20,
      shotsPerLevel: 1,
      colorsBase: 3,
      colorsMax: 6,
      rowsBase: 4,
      rowsMax: 8,
      dropSpeedBase: 0, // скорость опускания потолка (пикселей/сек)
      dropSpeedPerLevel: 2
    },
    // Максимальный уровень
    maxLevel: 20,
    // Экономика
    economy: {
      startCoins: 50,
      winBase: 40,
      winPerLevel: 10,
      rvCoins: 60,
      rainbowPrice: 40,   // шарик-радуга (любой цвет)
      bombPrice: 50,      // шарик-бомба (взрыв 3×3)
      laserPrice: 45,     // шарик-лазер (прямая линия)
      shotsPrice: 35      // +5 выстрелов
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
