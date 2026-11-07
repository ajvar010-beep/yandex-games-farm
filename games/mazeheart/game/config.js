/* game/config.js — данные «Сердца Лабиринта»: палитра, уровни, лавка, экономика.
   Здесь только данные, никакой логики и никаких обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'mazeheart';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#0a100d',
      bg2: '#0f1a15',
      bg3: '#16241d',
      stone: '#2c3b34',
      stoneMid: '#3a4c42',
      stoneHi: '#5a7064',
      stoneDark: '#18231e',
      moss: '#5f8f4a',
      mossHi: '#93c46c',
      mossDark: '#2f4a2a',
      torch: '#ffae42',
      torchHot: '#ffe6a8',
      glimmer: '#8fe8ff',
      glimmerDark: '#2f9fc4',
      key: '#f3d264',
      keyDark: '#a67c1e',
      exit: '#7df9c0',
      exitDark: '#2d8f6b',
      guard: '#e8705a',
      guardHi: '#ffb199',
      fog: '#9fc4b2',
      cream: '#e9f2ea',
      dim: '#7d9187',
      gold: '#f2c14e',
      danger: '#d8553f'
    },

    /* 12 лабиринтов: размер сетки, число дозорных, их скорость (клеток/с), доля распутанных
       тупиков (braid — из них берутся замкнутые маршруты патрулей). */
    levels: [
      { c: 7, r: 7, guards: 1, speed: 1.7, braid: 0.34 },
      { c: 7, r: 7, guards: 1, speed: 1.9, braid: 0.34 },
      { c: 8, r: 8, guards: 1, speed: 2.0, braid: 0.36 },
      { c: 8, r: 8, guards: 2, speed: 1.9, braid: 0.36 },
      { c: 9, r: 9, guards: 2, speed: 2.0, braid: 0.38 },
      { c: 9, r: 9, guards: 2, speed: 2.2, braid: 0.38 },
      { c: 10, r: 10, guards: 2, speed: 2.3, braid: 0.40 },
      { c: 10, r: 10, guards: 3, speed: 2.2, braid: 0.40 },
      { c: 11, r: 11, guards: 3, speed: 2.3, braid: 0.42 },
      { c: 11, r: 11, guards: 3, speed: 2.5, braid: 0.42 },
      { c: 12, r: 12, guards: 3, speed: 2.6, braid: 0.44 },
      { c: 12, r: 12, guards: 3, speed: 2.8, braid: 0.46 }
    ],

    keysPerLevel: 3,
    baseLives: 3,
    stepCd: 0.11,        // сек между шагами шара
    stepDur: 0.10,       // сек визуального перехода между клетками
    catchR: 0.60,        // радиус поимки в клетках
    graceStart: 1.0,     // неуязвимость на старте уровня
    graceRespawn: 2.2,   // неуязвимость после потери жизни
    stunAfterHit: 1.0,   // дозорные замирают, пока шар возвращается на чекпоинт
    autoCd: 0.12,        // шаг автопилота

    /* Лавка смотрителя: три постоянных улучшения. Цена растёт с каждым уровнем покупки. */
    shop: [
      { id: 'map', name: 'shop_map', desc: 'shop_map_d', max: 3, base: 120, step: 110 },
      { id: 'shield', name: 'shop_shield', desc: 'shop_shield_d', max: 3, base: 220, step: 170 },
      { id: 'life', name: 'shop_life', desc: 'shop_life_d', max: 3, base: 260, step: 200 }
    ],
    mapSeconds: [5, 8, 11],       // сколько секунд карта открыта (по уровню улучшения)

    economy: {
      startCoins: 160,
      winBase: 30,       // монет за пройденный лабиринт
      perLevel: 10,      // +10 за номер уровня
      perKey: 5,         // +5 за каждый собранный ключ
      losePity: 0
    },

    ads: {
      interstitialEvery: 2   // между забегами, каждый второй пройденный лабиринт
    },

    finalLevel: 12
  };
})(window.GAME);
