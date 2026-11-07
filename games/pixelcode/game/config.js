/* game/config.js — данные «Пиксель-Кода»: палитра, 12 схем, лавка, экономика.
   Здесь только данные: никакой логики и никаких обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'pixelcode';
  G.version = '1.0.0';

  G.config = {
    /* Неон: фиолетово-циановый с розовым акцентом. */
    palette: {
      bg: '#0a0614',
      bg2: '#150b2c',
      bg3: '#241148',
      panel: '#1a1036',
      panelHi: '#241650',
      line: 'rgba(168,85,247,0.20)',
      lineHi: 'rgba(34,211,238,0.34)',
      text: '#efeaff',
      dim: '#8f82c9',
      violet: '#a855f7',
      violetHi: '#d8b4fe',
      violetDark: '#5b21b6',
      cyan: '#22d3ee',
      cyanHi: '#a5f3fc',
      pink: '#f472b6',
      indigo: '#818cf8',
      gold: '#ffd166',
      bad: '#ff5c7a',
      ok: '#5eead4'
    },

    /* 12 схем: 10×10 (1–4), 12×12 (5–8), 15×15 (9–12).
       seed фиксирован — образ детерминирован и одинаков у всех игроков. */
    levels: [
      { size: 10, seed: 3101, tint: '#22d3ee' },
      { size: 10, seed: 4423, tint: '#a855f7' },
      { size: 10, seed: 5507, tint: '#f472b6' },
      { size: 10, seed: 6691, tint: '#818cf8' },
      { size: 12, seed: 7717, tint: '#22d3ee' },
      { size: 12, seed: 8839, tint: '#a855f7' },
      { size: 12, seed: 9953, tint: '#f472b6' },
      { size: 12, seed: 10177, tint: '#818cf8' },
      { size: 15, seed: 11251, tint: '#22d3ee' },
      { size: 15, seed: 12379, tint: '#a855f7' },
      { size: 15, seed: 13591, tint: '#f472b6' },
      { size: 15, seed: 14713, tint: '#818cf8' }
    ],

    mistakes: 3,          // ошибок на схему
    genTries: 60,         // попыток подобрать образ, решаемый логикой

    economy: {
      startCoins: 40,
      levelReward: 25,    // +5 за каждый следующий уровень
      levelStep: 5,
      perfectBonus: 15,   // схема без ошибок
      rewardedCoins: 100
    },

    /* Лавка: цены растут с каждой покупкой (счётчик покупок хранится в сохранении). */
    shop: [
      { id: 'hint', name: 'shop_hint', desc: 'shop_hint_d', base: 45, step: 20, maxStep: 6 },
      { id: 'eraser', name: 'shop_eraser', desc: 'shop_eraser_d', base: 50, step: 20, maxStep: 6 },
      { id: 'life', name: 'shop_life', desc: 'shop_life_d', base: 65, step: 25, maxStep: 6 }
    ],

    ads: {
      interstitialEvery: 2   // полноэкранная реклама после каждой 2-й пройденной схемы
    }
  };
})(window.GAME);
