/* game/config.js — данные «Домино-Цепи»: уровни, экономика, магазин, палитра.
   Здесь только данные: никакой логики и никаких обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'dominochain';
  G.version = '1.0.0';

  G.config = {
    /* Ярмарочная палитра: тёплое дерево, крем, красные точки. */
    palette: {
      bg: '#1a0f07',
      wood: '#8a5a2e',
      woodDark: '#4d3016',
      woodHi: '#c08a4e',
      cloth: '#f2e3c2',
      cloth2: '#e6d2a9',
      clothDark: '#cbb083',
      cream: '#fbf1d9',
      pip: '#c0392b',
      pipDark: '#8e2b20',
      gold: '#f0c14b',
      goldDark: '#a8822a',
      green: '#5fae4a',
      red: '#d0453c',
      ink: '#3d2713',
      dim: '#a99274',
      shadow: 'rgba(24,12,4,0.55)'
    },

    /* Колода — полный «дубль-шесть»: 28 костей, каждое значение 0..6. */
    deck: { max: 6 },

    hand: { max: 10 },           // больше 10 костей в руке не держим
    hearts: 3,
    chainSlots: 24,              // длина змейки-пути на столе (с запасом)

    scoring: {
      base: 6,                   // очки за кость: (base + a + b) * per
      per: 7,
      doubleBonus: 35,           // бонус за «дубль» (3|3 и т.п.)
      comboStep: 0.08,           // прибавка к множителю за каждую кость серии
      comboCap: 15,              // дальше множитель не растёт
      wrongPenalty: 25           // штраф за неверный тап
    },

    economy: {
      perTile: 1,                // монет за выложенную кость
      doubleCoin: 3,             // дополнительно за дубль
      levelBase: 30,             // награда за уровень
      levelStep: 10,             // +10 за номер уровня
      handEmpty: 25,             // бонус за опустевшую руку
      rvCoins: 120
    },

    /* Магазин посреди уровня: три товара, каждая покупка дороже предыдущей. */
    shop: [
      { id: 'draw', name: 'shop_draw', desc: 'shop_draw_d', base: 55, step: 40, add: 3 },
      { id: 'shuffle', name: 'shop_shuffle', desc: 'shop_shuffle_d', base: 80, step: 55 },
      { id: 'double', name: 'shop_double', desc: 'shop_double_d', base: 65, step: 45 }
    ],

    /* 12 уровней. goal — сколько костей выложить, hand — стартовая рука,
       draws — жетоны добора, start — стартовая кость в центре цепи. */
    levels: [
      { goal: 10, hand: 6, draws: 14, start: [6, 6] },
      { goal: 11, hand: 6, draws: 14, start: [5, 5] },
      { goal: 12, hand: 6, draws: 13, start: [4, 4] },
      { goal: 13, hand: 5, draws: 13, start: [6, 3] },
      { goal: 14, hand: 5, draws: 13, start: [5, 2] },
      { goal: 15, hand: 5, draws: 13, start: [4, 6] },
      { goal: 16, hand: 5, draws: 13, start: [3, 5] },
      { goal: 16, hand: 5, draws: 12, start: [2, 6] },
      { goal: 17, hand: 5, draws: 13, start: [6, 6] },
      { goal: 18, hand: 5, draws: 14, start: [1, 4] },
      { goal: 19, hand: 5, draws: 15, start: [5, 5] },
      { goal: 20, hand: 5, draws: 16, start: [3, 3] }
    ],

    ads: {
      interstitialEvery: 2,      // полноэкранная между забегами, каждый второй
      rvCoins: 120
    }
  };
})(window.GAME);
