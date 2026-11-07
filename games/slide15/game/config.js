/* game/config.js — данные «Латунного Порядка»: доски, экономика, магазин, тайминги.
   Здесь только данные и палитра. Никакой логики, никаких обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'slide15';
  G.version = '1.0.0';

  G.config = {
    /* Латунь и крем на тёмном орехе: мастерская, где доску собрали вручную. */
    palette: {
      bg: '#241810',
      bg2: '#2f2015',
      wood: '#3b2819',
      woodHi: '#4e3622',
      woodDark: '#1b110a',
      brass: '#c9a24a',
      brassHi: '#f2dda0',
      brassMid: '#a8863a',
      brassDark: '#70571c',
      brassInk: '#4a3410',
      cream: '#f3e7c9',
      cream2: '#e2d0a8',
      creamDark: '#c8b189',
      ink: '#4a3418',
      inkSoft: '#7a5f36',
      shadow: 'rgba(18,10,5,0.5)',
      slot: '#22160e',
      slotHi: '#3a2718',
      win: '#8fbf5a',
      winDim: '#5c7d38',
      red: '#c0563a',
      dim: '#b9a683',
      text: '#f3e7c9',
      scrim: 'rgba(16,9,4,0.78)'
    },

    /* 12 досок: 3×3 (1–4), 4×4 (5–8), 5×5 (9–12).
       scramble — сколько ходов прокручена доска от собранного вида (= пар).
       limit — лимит ходов: вышел — попытка провалена. */
    levels: [
      { n: 3, scramble: 6, limit: 15 },
      { n: 3, scramble: 10, limit: 20 },
      { n: 3, scramble: 14, limit: 26 },
      { n: 3, scramble: 18, limit: 32 },
      { n: 4, scramble: 20, limit: 40 },
      { n: 4, scramble: 26, limit: 50 },
      { n: 4, scramble: 32, limit: 58 },
      { n: 4, scramble: 38, limit: 68 },
      { n: 5, scramble: 36, limit: 70 },
      { n: 5, scramble: 44, limit: 84 },
      { n: 5, scramble: 52, limit: 98 },
      { n: 5, scramble: 60, limit: 112 }
    ],

    /* Экономика: монеты за собранную доску + бонус за сэкономленные ходы. */
    coins: {
      base: 25,
      perLevel: 8,
      perMove: 1,
      lose: 6
    },

    /* Магазин: три товара, цена растёт с каждой покупкой. */
    shop: [
      { id: 'hint', price: 45, step: 20, pack: 3 },
      { id: 'undo', price: 40, step: 18, pack: 3 },
      { id: 'shuffle', price: 35, step: 14, pack: 1 }
    ],
    shopMaxPrice: 600,

    ads: {
      interstitialEvery: 2,
      continueMoves: 12,
      doubleReward: true
    },

    timing: {
      moveDur: 0.12,
      autoDelay: 0.26,
      hintTime: 2.6,
      resultDelay: 0.36,
      autoNext: 1.5
    }
  };
})(window.GAME);
