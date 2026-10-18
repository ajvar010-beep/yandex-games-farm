/* game/config.js — константы и баланс «Рыжего Побега» (раннер: кот прыгает через препятствия). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'gingerdash';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#fff4d6',
      bg2: '#ffe3ae',
      sky: '#ffd9a0',
      sun: '#ffb93e',
      ground: '#b87333',
      grass: '#7ab648',
      cat: '#ff9436',
      catDark: '#e0721f',
      cream: '#fff3d6',
      box: '#c98f4e',
      boxDark: '#a9713a',
      puddle: '#74c0fc',
      bird: '#8a63d2',
      fish: '#4dabf7',
      heart: '#ff6b9d',
      gold: '#ffd43b',
      star: '#ffd43b',
      shield: '#69db7c',
      magnet: '#b197fc',
      goldfish: '#ffd43b',
      text: '#4a2f18',
      panel: '#ffe9c4',
      panelEdge: '#d9a65e',
      dim: '#a07850',
      accent: '#ff9436',
      dust: '#ffb93e'
    },
    lives: 2,
    maxLevel: 20,
    // скорость бега (px/с) и частота препятствий по уровню
    runSpeed: function (lv) { return Math.min(380, 220 + lv * 14); },
    spawnGap: function (lv) { return Math.max(1.35, 2.1 - lv * 0.07); },
    levelGoal: function (lv) { return 30 + lv * 10; }, // метров до уровня
    gravity: 2100,
    jumpV: -860,
    score: { meter: 2, fish: 10, goldfish: 50, comboCap: 5 },
    goldfishChance: 0.05,   // шанс золотой рыбки вместо обычной
    goldfishFromLevel: 3,   // появляется с 3 уровня
    goldfishMinH: 130,      // минимальная высота над землёй (нужен двойной прыжок)
    economy: {
      magnetPrice: 40,   // магнит рыбок
      shieldPrice: 60,   // щит от одного удара
      slowPrice: 80,     // замедление времени
      heartPrice: 120,   // дополнительная жизнь
      magnetDur: 10, slowDur: 6,
      rvFish: 60
    },
    recordMaxSpeed: 480,
    recordRewardCap: 90
  };
})(window.GAME);
