/* game/config.js — данные «Пульса»: палитра, окна попадания, песни, этапы, магазин.
   Здесь только данные: ни логики, ни обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'pulseref';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#0a0616',
      bg2: '#160a2c',
      bg3: '#2a0a3e',
      horizon: '#3a1052',
      sun1: '#ffd166',
      sun2: '#ff2d95',
      magenta: '#ff2d95',
      magentaDim: '#a01762',
      cyan: '#22e8ff',
      cyanDim: '#0e7f96',
      violet: '#8a5cff',
      grid: '#ff4fd8',
      gridDim: '#5a1f7a',
      cream: '#f6e9ff',
      dim: '#a294c9',
      gold: '#ffd166',
      green: '#7dff9b',
      red: '#ff5a7a'
    },

    lanes: 4,
    stages: 12,
    leadBeats: 4,

    /* Окна попадания в секундах (по модулю разницы с нотой). */
    judge: { perfect: 0.06, great: 0.11, good: 0.17 },

    /* Сколько секунд нота летит от верха поля до линии удара. */
    scroll: 2.15,
    /* Множитель скорости песни под «Замедлением». */
    slowRate: 0.72,

    score: { perfect: 300, great: 200, good: 100 },
    acc: { perfect: 1, great: 0.7, good: 0.35 },

    /* Пульс — шкала жизни: удары его лечат, промахи ломают. */
    pulse: { perfect: 0.008, great: 0.005, good: 0.002, miss: -0.06, ghost: -0.10 },

    coins: { perfect: 2, great: 1, good: 1, clear: 40, perStage: 12, start: 120 },

    /* Восемь песен. bars — длина без учёта 4-битного отсчёта.
       density — базовая плотность нот, ghost — шанс «фантомов» (их нельзя тапать). */
    songs: [
      { id: 'neon', name: 'song_1', bpm: 96, bars: 24, density: 0.02, ghost: 0.00 },
      { id: 'city', name: 'song_2', bpm: 104, bars: 24, density: 0.06, ghost: 0.00 },
      { id: 'magenta', name: 'song_3', bpm: 112, bars: 24, density: 0.10, ghost: 0.04 },
      { id: 'chrome', name: 'song_4', bpm: 118, bars: 24, density: 0.13, ghost: 0.09 },
      { id: 'glass', name: 'song_5', bpm: 124, bars: 25, density: 0.17, ghost: 0.13 },
      { id: 'midnight', name: 'song_6', bpm: 132, bars: 25, density: 0.21, ghost: 0.17 },
      { id: 'turbo', name: 'song_7', bpm: 140, bars: 26, density: 0.25, ghost: 0.21 },
      { id: 'finale', name: 'song_8', bpm: 148, bars: 26, density: 0.29, ghost: 0.25 }
    ],

    /* Этапы 9–12 — энкоры: те же песни 1/3/6/8, но быстрее и плотнее. */
    encore: { bpm: 1.1, songs: [1, 3, 6, 8] },

    shop: [
      { id: 'shield', name: 'shop_shield', desc: 'shop_shield_d', max: 3, base: 130, step: 150 },
      { id: 'slow', name: 'shop_slow', desc: 'shop_slow_d', max: 3, base: 160, step: 170 },
      { id: 'coin', name: 'shop_coin', desc: 'shop_coin_d', max: 3, base: 190, step: 190 }
    ],
    shopStep: { slow: 4, coin: 0.5 },

    ads: { interstitialEvery: 2, rewardedCoins: 80 }
  };
})(window.GAME);
