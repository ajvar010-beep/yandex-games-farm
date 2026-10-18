/* game/config.js — константы и баланс «Сладкой Башни» (стэкер слоёв пирожного). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'sweettower';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#2b1a3d',
      bg2: '#4a2a63',
      sky: '#ffd9ec',
      cream: '#fff3d6',
      choco: '#7a4a2b',
      chocoDark: '#5d3720',
      pink: '#ff8fb3',
      pinkDark: '#e56b93',
      mint: '#9fe8c1',
      berry: '#c74b71',
      gold: '#ffd43b',
      star: '#ffd43b',
      heart: '#ff6b9d',
      cherry: '#ff5d73',
      sparkCur: '✦',
      text: '#fff6fb',
      panel: '#3d2452',
      panelEdge: '#6b4188',
      dim: '#d9b8e6',
      accent: '#ff8fb3',
      dust: '#ffd9ec',
      starCake: '#ffe27a'
    },
    maxLevel: 20,
    // базовая ширина слоя (доля ширины поля) и скорость маятника по уровню
    baseWidth: function () { return 0.62; },
    swingSpeed: function (lv) { return 0.9 + lv * 0.16; },
    swingAmp: function () { return 0.34; }, // размах маятника (доля ширины поля)
    perfectTol: 0.035,      // допуск идеального попадания (доля ширины слоя)
    minLayer: 0.12,         // слой тоньше — конец игры
    levelGoal: function (lv) { return 7 + lv * 2; },  // слоёв на уровень
    score: { layer: 10, perfect: 25, comboCap: 5, star: 150 },
    starChance: 0.04,      // вероятность звёздного слоя вместо обычного
    starFromLevel: 3,      // звёздные слои появляются с 3-го уровня
    economy: {
      guidePrice: 40,    // направляющая линия
      slowPrice: 60,     // медленный маятник
      growPrice: 80,     // расширение текущего слоя
      bouncyPrice: 90,   // упругий крем (слои не срезаются)
      guideDur: 8, slowDur: 8, bouncyDur: 8,
      rvSpark: 60
    },
    recordMaxSpeed: 3.4,
    recordRewardCap: 90
  };
})(window.GAME);
