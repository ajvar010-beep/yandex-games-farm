/* game/config.js — настройки «Рыбного Пруда».
   Standalone: пишем в window.GAME.config. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var CONFIG = {
    id: 'fishpond',
    version: '1.0.0',
    palette: {
      bg: '#0a1a2a',
      bg2: '#0f2a3a',
      water: '#1a3a4a',
      waterDeep: '#0d2a3a',
      fish1: '#ff6b6b',
      fish2: '#4ecdc4',
      fish3: '#45b7d1',
      fish4: '#96ceb4',
      fish5: '#ffeaa7',
      bubble: '#a8d8ea',
      coin: '#ffd43b',
      good: '#6dd98a',
      bad: '#ff6b81',
      accent: '#4ecdc4',
      panel: 'rgba(10,26,42,0.95)',
      panelBorder: '#4ecdc4',
      text: '#f0f4f8',
      dim: '#8899aa'
    },
    // Игра бесконечная, нет уровней
    // Рыбки
    fish: {
      count: 6,
      speedBase: 30,
      speedVar: 20,
      sizeBase: 30,
      sizeVar: 15,
      bubbleRate: 0.02, // шанс пузыря в секунду на рыбку
      bubbleValue: 1,
      tapScore: 10,
      tapCoin: 1
    },
    // Экономика — только счёт, без лавки
    economy: {
      startCoins: 0
    }
  };

  G.config = CONFIG;
  G.id = CONFIG.id;
})(window.GAME);
