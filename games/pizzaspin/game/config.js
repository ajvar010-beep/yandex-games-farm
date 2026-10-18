/* game/config.js — константы и баланс «Пиццы-Поворота» (поворотная аркада:
   ловим падающие топпинги, поворачивая пиццу тапом). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'pizzaspin';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#fff1e0',
      bg2: '#ffe0c2',
      table: '#e8b48a',
      crust: '#e8a54b',
      crustDark: '#c97f2e',
      cheese: '#ffd873',
      cheeseDark: '#f2b93b',
      pepperoni: '#d64545',
      mushroom: '#c9a98a',
      olive: '#5a7d4f',
      pepper: '#6abf69',
      target: '#ff9436',
      stain: '#8a5a3b',
      sun: '#ffd43b',
      heart: '#ff6b9d',
      gold: '#ffd43b',
      star: '#ffd43b',
      shield: '#69db7c',
      slow: '#74c0fc',
      doubler: '#ffb93e',
      text: '#4a2f18',
      panel: '#fff3df',
      panelEdge: '#e0b285',
      dim: '#a07850',
      accent: '#ff9436',
      dust: '#ffd873'
    },
    lives: 2,
    maxLevel: 20,
    slices: 8,                          // кусков в пицце
    fallSpeed: function (lv) { return Math.min(460, 170 + lv * 26); }, // px/с падение топпинга
    spawnGap: function (lv) { return Math.max(0.55, 1.5 - lv * 0.08); }, // сек между топпингами
    levelGoal: function (lv) { return 12 + lv * 4; },  // поймано топпингов до уровня
    score: { catch: 10, comboCap: 5, golden: 50 },
    goldenChance: 0.06,     // вероятность золотого топпинга при спавне
    goldenFromLevel: 3,
    economy: {
      shieldPrice: 50,   // щит от одного промаха
      slowPrice: 60,     // замедление падения
      doublerPrice: 80,  // ×2 очки
      widePrice: 90,     // золотая зона шире на 1 кусок
      slowDur: 8, doublerDur: 10, wideDur: 10,
      rvCrumb: 60
    },
    recordMaxSpeed: 480,
    recordRewardCap: 90
  };
})(window.GAME);
