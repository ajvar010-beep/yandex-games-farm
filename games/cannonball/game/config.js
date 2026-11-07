/* game/config.js — данные «Ядра»: палитра, физика, пушка, уровни, магазин, экономика.
   Здесь только данные, никакой логики и никаких обращений к Engine.
   Мир уровня — квадрат 1000×1000: так одна и та же баллистика честно работает и в
   портрете, и в ландшафте (арена масштабируется целиком, без искажения кругов). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'cannonball';
  G.version = '1.0.0';

  G.config = {
    /* Закатная пустыня: сиреневое небо, медное солнце, тёплый песок и сталь. */
    palette: {
      bg: '#1a1024',
      bg2: '#2a1732',
      sky1: '#170f26',
      sky2: '#4a2347',
      sky3: '#8f3a45',
      sky4: '#d9704a',
      sun: '#ffd58a',
      sunCore: '#fff2cf',
      cloud: '#6b2f45',
      duneFar: '#6e3345',
      duneMid: '#52243a',
      duneNear: '#38182c',
      sand: '#b4744a',
      sandHi: '#d69a63',
      sandDark: '#8a5334',
      sandLine: 'rgba(60,28,40,0.35)',
      steel: '#76808c',
      steelHi: '#b3bdc9',
      steelDark: '#3b434e',
      steelDeep: '#262c34',
      brass: '#c9903a',
      brassHi: '#f0c764',
      wood: '#8a5a34',
      woodDark: '#553416',
      targetRed: '#d64a3c',
      targetCream: '#f4e7cb',
      targetDark: '#3a2320',
      iron: '#2c3138',
      ironHi: '#8a95a3',
      smoke: 'rgba(226,212,198,0.55)',
      text: '#f8eeda',
      dim: '#c3a58f',
      gold: '#f2c14e',
      accent: '#ffb347',
      good: '#8fd14f',
      bad: '#ff7a68',
      panel: 'rgba(24,14,28,0.82)',
      panelLine: 'rgba(242,193,78,0.34)'
    },

    world: { w: 1000, h: 1000, ground: 950 },

    physics: {
      gravity: 1100,      // units/s²
      ballR: 18,
      restitution: 0.66,  // стены и борта
      friction: 0.97,     // тангенциальное трение при отскоке
      maxTime: 7,         // секунд на полёт одного ядра
      speedMin: 360,
      speedMax: 1150,
      dragMax: 430,       // units от пушки до пальца при полной силе
      muzzle: 92,
      angleMin: -1.535,   // рад, почти вертикально вверх
      angleMax: 0.14      // рад, чуть вниз
    },

    cannon: { x: 150, y: 844, len: 92, baseR: 34 },

    /* Экономика: монеты капают только за пройденный уровень (один кошелёк). */
    economy: { startCoins: 160, base: 30, perLevel: 6, perShotLeft: 12, perfect: 20, replayRate: 0.3 },

    /* Магазин: 3 товара, у каждого до 3 ступеней, цена ступени растёт. */
    shop: [
      { id: 'ammo', name: 'sh_ammo', desc: 'sh_ammo_d', max: 3, base: 140, step: 130 },
      { id: 'preview', name: 'sh_preview', desc: 'sh_preview_d', max: 2, base: 170, step: 190 },
      { id: 'slow', name: 'sh_slow', desc: 'sh_slow_d', max: 3, base: 150, step: 140 }
    ],
    slowBase: 2,          // зарядов замедления на уровень без покупок
    previewShort: 1.15,   // сколько секунд полёта показывает 1-я ступень траектории

    ads: { interstitialEvery: 2, rewardCoins: 150 },

    /* ---------- уровни ----------
       targets: [x, y, r] или объект { x, y, r, mx, my, sp, ph }
         mx/my — амплитуда движения по осям (units), sp — скорость (рад/с), ph — фаза.
       walls: [x, y, w, h] — стальные блоки; y сверху, WORLD.ground снизу.
       shots — выстрелов на уровень (сверх бонусов магазина). */
    levels: [
      { n: 1, name: 'lv_1', shots: 5,
        targets: [{ x: 760, y: 430, r: 48 }], walls: [] },

      { n: 2, name: 'lv_2', shots: 5,
        targets: [{ x: 540, y: 300, r: 42 }, { x: 800, y: 570, r: 46 }], walls: [] },

      { n: 3, name: 'lv_3', shots: 6,
        targets: [{ x: 650, y: 250, r: 42 }, { x: 850, y: 330, r: 44 }],
        walls: [{ x: 460, y: 380, w: 70, h: 570 }] },

      { n: 4, name: 'lv_4', shots: 6,
        targets: [{ x: 890, y: 620, r: 44 }, { x: 600, y: 250, r: 42 }],
        walls: [{ x: 700, y: 470, w: 90, h: 480 }] },

      { n: 5, name: 'lv_5', shots: 6,
        targets: [{ x: 560, y: 200, r: 38 }, { x: 790, y: 470, r: 42 }, { x: 900, y: 770, r: 46 }],
        walls: [{ x: 430, y: 0, w: 60, h: 600 }, { x: 650, y: 380, w: 60, h: 570 }] },

      { n: 6, name: 'lv_6', shots: 7,
        targets: [{ x: 760, y: 300, r: 42 }, { x: 760, y: 620, r: 42 }],
        walls: [{ x: 420, y: 0, w: 80, h: 470 }, { x: 420, y: 715, w: 80, h: 235 }] },

      { n: 7, name: 'lv_7', shots: 7,
        targets: [{ x: 590, y: 400, r: 38 }, { x: 710, y: 290, r: 40 }, { x: 870, y: 650, r: 44 }],
        walls: [{ x: 500, y: 650, w: 70, h: 300 }, { x: 620, y: 500, w: 70, h: 450 },
                { x: 740, y: 350, w: 70, h: 600 }] },

      { n: 8, name: 'lv_8', shots: 7,
        targets: [{ x: 820, y: 380, r: 42 }, { x: 770, y: 770, r: 44 }],
        walls: [{ x: 380, y: 0, w: 620, h: 170 }, { x: 600, y: 600, w: 70, h: 350 }] },

      { n: 9, name: 'lv_9', shots: 6,
        targets: [{ x: 700, y: 420, r: 42, my: 110, sp: 1.1 }, { x: 880, y: 720, r: 46 }],
        walls: [{ x: 500, y: 560, w: 70, h: 390 }] },

      { n: 10, name: 'lv_10', shots: 7,
        targets: [{ x: 800, y: 240, r: 40 }, { x: 800, y: 640, r: 44 }, { x: 470, y: 300, r: 38 }],
        walls: [{ x: 620, y: 0, w: 70, h: 280 }, { x: 620, y: 500, w: 70, h: 450 }] },

      { n: 11, name: 'lv_11', shots: 7,
        targets: [{ x: 600, y: 190, r: 38 }, { x: 830, y: 420, r: 42, my: 90, sp: 1.2 },
                  { x: 830, y: 760, r: 44 }],
        walls: [{ x: 450, y: 420, w: 60, h: 530 }, { x: 700, y: 0, w: 60, h: 300 }] },

      { n: 12, name: 'lv_12', shots: 7,
        targets: [{ x: 520, y: 190, r: 36, my: 60, sp: 1.5 }, { x: 700, y: 720, r: 40 },
                  { x: 900, y: 300, r: 42 }],
        walls: [{ x: 420, y: 300, w: 60, h: 650 },
                { x: 780, y: 520, w: 60, h: 430 }] },

      { n: 13, name: 'lv_13', shots: 6,
        targets: [{ x: 760, y: 240, r: 38, mx: 70, sp: 1.1 }, { x: 880, y: 600, r: 42 },
                  { x: 600, y: 830, r: 40 }],
        walls: [{ x: 500, y: 640, w: 70, h: 310 }, { x: 690, y: 0, w: 60, h: 260 }] },

      { n: 14, name: 'lv_14', shots: 6,
        targets: [{ x: 620, y: 220, r: 38 }, { x: 830, y: 380, r: 40, my: 120, sp: 0.9 },
                  { x: 880, y: 780, r: 44 }],
        walls: [{ x: 480, y: 480, w: 70, h: 470 }, { x: 700, y: 0, w: 60, h: 190 }] },

      { n: 15, name: 'lv_15', shots: 6,
        targets: [{ x: 660, y: 300, r: 38, my: 90, sp: 1.3 }, { x: 860, y: 480, r: 40, my: 110, sp: 1.0 },
                  { x: 800, y: 800, r: 42 }],
        walls: [{ x: 470, y: 0, w: 60, h: 420 }, { x: 600, y: 620, w: 70, h: 330 },
                { x: 760, y: 0, w: 60, h: 240 }] }
    ]
  };
})(window.GAME);
