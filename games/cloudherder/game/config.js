/* game/config.js — константы и баланс «Гончего Дождя» (аркада: облачко
   следует за курсором, ловит капельки, уворачивается от градин). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'cloudherder';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#aee3ff',
      bg2: '#7ec8f2',
      cloud: '#ffffff',
      cloudShade: '#dfeefc',
      drop: '#4dabf7',
      dropDark: '#2b8fd4',
      hail: '#9fb3c8',
      hailDark: '#6b8299',
      rainbow: ['#ff6b6b', '#ffb93e', '#ffe873', '#69db7c', '#74c0fc', '#b197fc'],
      heart: '#ff6b9d',
      gold: '#ffd43b',
      star: '#ffd43b',
      umbrella: '#ffa94d',
      calm: '#69db7c',
      bucket: '#b197fc',
      prism: '#e599f7',
      rainbowDrop: '#ff8ce4',
      text: '#1e3a5f',
      panel: '#eaf6ff',
      panelEdge: '#a8d4f0',
      dim: '#5a7a9f',
      accent: '#4dabf7',
      dust: '#4dabf7'
    },
    lives: 2,
    maxLevel: 20,
    cloudSpeed: 7,                          // рывок к курсору (lerp k)
    fallSpeed: function (lv) { return Math.min(440, 160 + lv * 15); }, // px/с падение
    spawnGap: function (lv) { return Math.max(0.42, 1.15 - lv * 0.036); }, // сек между предметами
    hailChance: function (lv) { return lv < 2 ? 0 : Math.min(0.34, 0.1 + lv * 0.012); }, // доля градин
    rainbowChance: 0.06,                    // доля радужных капель (×3)
    levelGoal: function (lv) { return 10 + lv * 3; },  // капелек до уровня
    score: { catch: 10, comboCap: 5, rainbowMult: 3 },
    economy: {
      umbrellaPrice: 50,  // зонтик: гасит одну градину
      calmPrice: 60,      // тишина: медленное падение 8 с
      bucketPrice: 80,    // ведерко: ловля шире ×1.7 на 10 с
      prismPrice: 90,     // двойная радуга: очки ×2 на 10 с
      calmDur: 8, bucketDur: 10, prismDur: 10,
      rvDrop: 60
    },
    recordMaxSpeed: 440,
    recordRewardCap: 90
  };
})(window.GAME);
