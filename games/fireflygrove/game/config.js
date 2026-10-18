/* game/config.js — константы и баланс «Лампового Сада» (аркада: тапаем
   по горящим светлячкам, избегаем гусениц). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'fireflygrove';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#0e1428',
      bg2: '#1c2547',
      grass: '#22331e',
      grassHi: '#33502a',
      moon: '#fff3bf',
      glow: '#ffe873',
      glowHot: '#fffbe0',
      bug: '#8a6d3b',
      wing: '#cfe8ff',
      caterpillar: '#e8734a',
      caterpillarDark: '#b44d2c',
      heart: '#ff6b9d',
      gold: '#ffd43b',
      star: '#ffd43b',
      shield: '#69db7c',
      lantern: '#ffd43b',
      net: '#74c0fc',
      moth: '#b197fc',
      mothGlow: '#e5dbff',
      text: '#eef1ff',
      panel: '#232c52',
      panelEdge: '#3d4a80',
      dim: '#8b95c9',
      accent: '#ffe873',
      dust: '#ffe873'
    },
    lives: 2,
    maxLevel: 20,
    bugsCount: function (lv) { return Math.min(9, 3 + ((lv + 1) >> 1)); }, // светлячков на поляне
    glowDur: function (lv) { return Math.max(0.55, 1.5 - lv * 0.045); },    // секунд горит
    glowGap: function (lv) { return Math.max(0.32, 1.3 - lv * 0.045); },    // пауза между вспышками
    bugSpeed: function (lv) { return Math.min(150, 30 + lv * 8); },         // px/с блуждание
    levelGoal: function (lv) { return 8 + lv * 3; },                        // поймано до уровня
    score: { catch: 10, comboCap: 5, moth: 40 },
    mothFromLevel: 5,       // лунный мотылёк появляется с 5 уровня
    mothChance: 0.10,       // вероятность при пополнении стаи
    economy: {
      bubblePrice: 50,    // пузырёк: гасит один укол гусеницы
      lanternPrice: 60,   // фонарь: светлячки горят дольше 8 с
      netPrice: 80,       // сеть: клик ловит в радиусе ×2 на 10 с
      calmPrice: 90,      // настой: гусеницы ползают вдвое медленнее 10 с
      lanternDur: 8, netDur: 10, calmDur: 10,
      rvDust: 60
    },
    recordMaxSpeed: 140,
    recordRewardCap: 90
  };
})(window.GAME);
