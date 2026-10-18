/* game/config.js — «Скайблоки»: idle-кликер про плавучие острова.
   Весь контент здесь: палитра, острова (цена/доход), улучшения, генератор целей.
   Движок не трогаем (5.1.3 — имя в i18n, а не в конфиге). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'skyblocks';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#101a3a', bg2: '#1a2c5e',
      sky1: '#3d6bf0', sky2: '#8ab4ff',
      island: '#8b5e3c', islandTop: '#a97c50', grass: '#51cf66', grassDark: '#2b8a3e',
      crystal: '#7df9ff', coin: '#ffd43b', golden: '#ffe066', text: '#fff6e8', dim: '#a9b8e8',
      panel: 'rgba(16,22,58,0.95)', panelBorder: '#5f7cff',
      accent: '#5f7cff', good: '#51cf66', bad: '#ff5d73', cloud: '#f3f7ff'
    },
    board: { cols: 3, rows: 2 },           // до 6 островов
    /* 6 островов: цена открытия, базовый доход/с, пропсы для art. */
    islands: [
      { price: 0,     income: 1,   prop: 'sprout'  }, // 0 Роща
      { price: 40,    income: 4,   prop: 'tower'   }, // 1 Башня
      { price: 220,   income: 14,  prop: 'mill'    }, // 2 Мельница
      { price: 1200,  income: 55,  prop: 'crystal' }, // 3 Кристальные пики
      { price: 7000,  income: 230, prop: 'ship'    }, // 4 Дирижабль
      { price: 40000, income: 900, prop: 'crown'   }  // 5 Небесный дворец
    ],
    upgradeCost: function (i, lvl) { return Math.round(60 * (i + 1) * Math.pow(1.55, lvl)); },
    economy: {
      tapPower: 1, tapGrowth: 1.30, tapPrice: 35,  // тап по облаку: +N кристаллов
      rvCoins: 120,                                 // rewarded: +N кристаллов
      offlineCap: 3600,                             // секунд офлайн-дохода
      goldenChance: 0.12,                           // шанс золотого облака (×8 кристаллов)
      goldenMul: 8,
      harvestPrice: function (bought) { return Math.round(90 * Math.pow(1.5, bought)); }, // «Урожай»
      harvestSec: 30                                // сколько секунд дохода собирает
    },
    /* цели на уровень: 3 слота — накопить кристаллов / купить островов / прокачать */
    makeGoals: function (level, rng) {
      function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
      var out = [
        { kind: 'earn',   need: Math.round(120 * Math.pow(2.1, level)), got: 0 },
        { kind: 'buy',    need: clamp(1 + Math.floor(level / 2), 1, 6), got: 0 },
        { kind: 'taps',   need: 20 + level * 10, got: 0 }
      ];
      return out;
    }
  };
})(window.GAME);
