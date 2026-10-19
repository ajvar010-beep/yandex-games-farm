/* game/config.js — настройки «Пасьянса Клондайк».
   Standalone: пишем в window.GAME.config. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var CONFIG = {
    id: 'solitairekl',
    version: '1.0.0',
    palette: {
      bg: '#0d1f0f',
      bg2: '#16331a',
      board: '#0a170c',
      cell: '#1a3d1f',
      cellHot: '#2d5a32',
      card: '#f5f0e0',
      cardBack: '#2a4a6a',
      cardBackPattern: '#1a3a5a',
      text: '#f0f4f8',
      dim: '#8899aa',
      accent: '#4ecdc4',
      coin: '#ffd43b',
      good: '#6dd98a',
      bad: '#ff6b81',
      panel: 'rgba(10,23,12,0.95)',
      panelBorder: '#4ecdc4'
    },
    // Максимальный уровень
    maxLevel: 10,
    // Экономика
    economy: {
      startCoins: 50,
      winBase: 40,
      winPerLevel: 10,
      hintPrice: 25,      // показать доступный ход
      undoPrice: 30       // отменить ход
    }
  };

  G.config = CONFIG;
  G.id = CONFIG.id;
})(window.GAME);
