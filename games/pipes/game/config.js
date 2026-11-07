/* game/config.js — данные «Труб»: палитра, 15 уровней, магазин, экономика.
   Здесь только данные, никакой логики и никаких обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'pipes';
  G.version = '1.0.0';

  G.config = {
    /* бирюза и медь: тёмный паровой цех, медные трубы, светящаяся вода */
    palette: {
      bg: '#07161a',
      bg2: '#0c2429',
      bgDeep: '#041013',
      wall: '#0a1e22',
      wallHi: '#12333a',
      copper: '#b87333',
      copperHi: '#e8a86a',
      copperDark: '#5b2f14',
      copperDeep: '#33190a',
      brass: '#d9a441',
      gold: '#f2c14e',
      patina: '#2fb3a8',
      patinaHi: '#6fe6da',
      patinaDark: '#155f5a',
      water: '#46e0d0',
      waterHi: '#c8fff7',
      waterDeep: '#0f7d78',
      steel: '#4a5c63',
      steelHi: '#8fa4ab',
      steelDark: '#22343a',
      plate: '#16292d',
      plateHi: '#1d3438',
      cream: '#e9f5f2',
      dim: '#7d9a9d',
      ice: '#bfefff',
      danger: '#ff6b5e',
      ok: '#6ee07a'
    },

    /* size — сторона сетки, slack — запас ходов сверх минимально нужного,
       sources — число кранов слева (2 = двойная подача и тройники). */
    levels: [
      { n: 1, size: 5, slack: 16, sources: 1, name: 'lv_1_name' },
      { n: 2, size: 5, slack: 15, sources: 1, name: 'lv_2_name' },
      { n: 3, size: 5, slack: 14, sources: 1, name: 'lv_3_name' },
      { n: 4, size: 6, slack: 13, sources: 1, name: 'lv_4_name' },
      { n: 5, size: 6, slack: 12, sources: 1, name: 'lv_5_name' },
      { n: 6, size: 6, slack: 11, sources: 1, name: 'lv_6_name' },
      { n: 7, size: 7, slack: 11, sources: 1, name: 'lv_7_name' },
      { n: 8, size: 7, slack: 10, sources: 1, name: 'lv_8_name' },
      { n: 9, size: 7, slack: 10, sources: 2, name: 'lv_9_name' },
      { n: 10, size: 8, slack: 10, sources: 1, name: 'lv_10_name' },
      { n: 11, size: 8, slack: 9, sources: 2, name: 'lv_11_name' },
      { n: 12, size: 8, slack: 8, sources: 1, name: 'lv_12_name' },
      { n: 13, size: 8, slack: 8, sources: 2, name: 'lv_13_name' },
      { n: 14, size: 8, slack: 7, sources: 1, name: 'lv_14_name' },
      { n: 15, size: 8, slack: 6, sources: 2, name: 'lv_15_name' }
    ],

    economy: {
      startCoins: 120,
      winBase: 40,        // базовая награда за уровень
      perLevel: 6,        // +6 за номер уровня
      perMoveLeft: 3,     // +3 за каждый сэкономленный ход
      perfect: 20         // бонус за уровень без подсказок и доп. ходов
    },

    /* Магазин: цены растут с каждой покупкой внутри уровня. */
    shop: [
      { id: 'hint', name: 'item_hint', desc: 'item_hint_d', base: 60, step: 30, glyph: 'hint' },
      { id: 'moves', name: 'item_moves', desc: 'item_moves_d', base: 80, step: 40, glyph: 'moves' },
      { id: 'freeze', name: 'item_freeze', desc: 'item_freeze_d', base: 70, step: 35, glyph: 'freeze' }
    ],
    extraMoves: 5,
    freezeSeconds: 15,
    secondChanceMoves: 10,

    ads: {
      interstitialEvery: 2,   // между каждым вторым пройденным уровнем
      rewardedCoins: 100
    }
  };
})(window.GAME);
