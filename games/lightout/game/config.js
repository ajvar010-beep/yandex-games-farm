/* game/config.js — данные «Свет-Плиток»: палитра, уровни, экономика, магазин.
   Здесь только данные, никакой логики и никаких обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'lightout';
  G.version = '1.0.0';

  G.config = {
    /* Ночной город: тёмный асфальт, мокрое отражение неона, бирюзовые и маджентовые огни. */
    palette: {
      bg: '#060911',
      bg2: '#0b1120',
      sky1: '#05080f',
      sky2: '#131a2e',
      sky3: '#2a1f3d',
      haze: '#26325a',
      neon: '#3fe3ff',
      neonSoft: '#9cf4ff',
      neonDeep: '#0e8fb8',
      pink: '#ff54c8',
      pinkSoft: '#ff9be0',
      tileOff: '#0d1424',
      tileOff2: '#080e1a',
      tileRim: '#17324a',
      gold: '#f7c95c',
      goldDim: '#a8852f',
      cream: '#e8f3ff',
      dim: '#7c8da6',
      red: '#ff6677',
      green: '#63f0a6',
      glass: 'rgba(9,15,27,0.82)'
    },

    /* levels: n — сторона сетки, presses — сколько случайных нажатий из «всё
       выключено» (это и есть сохранённое решение), slack — запас ходов сверх
       решения. 12 уровней: 5×5 → 6×6 → 7×7. */
    levels: [
      { n: 5, presses: 5, slack: 5 },
      { n: 5, presses: 6, slack: 4 },
      { n: 5, presses: 7, slack: 4 },
      { n: 5, presses: 8, slack: 3 },
      { n: 6, presses: 7, slack: 4 },
      { n: 6, presses: 8, slack: 3 },
      { n: 6, presses: 9, slack: 3 },
      { n: 6, presses: 10, slack: 2 },
      { n: 7, presses: 10, slack: 3 },
      { n: 7, presses: 11, slack: 2 },
      { n: 7, presses: 12, slack: 2 },
      { n: 7, presses: 13, slack: 2 }
    ],

    economy: {
      startCoins: 140,
      base: 45,          // базовая награда за уровень
      perLevel: 6,       // + за номер уровня
      perMoveLeft: 7,    // за каждый неиспользованный ход
      cleanBonus: 18,    // бонус, если обошёлся без подсказок и отмен
      doubleAd: 2        // множитель RV «×2»
    },

    /* Магазин из трёх товаров; цена растёт с каждой покупкой за забег. */
    shop: [
      { id: 'hint', price: 55, step: 25, charge: 1 },
      { id: 'undo', price: 40, step: 20, charge: 1 },
      { id: 'move', price: 50, step: 25, charge: 3 }
    ],

    ads: {
      interstitialEvery: 2,   // межуровневая реклама каждый 2-й пройденный уровень
      continueMoves: 5        // RV «продолжить»: +5 ходов
    },

    rules: 4
  };
})(window.GAME);
