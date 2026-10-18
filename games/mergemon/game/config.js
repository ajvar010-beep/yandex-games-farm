/* game/config.js — ВЕСЬ контентный конфиг игры: палитра, тиры монстриков, экономика,
   бустеры, генератор панели «целей». Конвейер меняет этот файл + i18n + art/entities/scenes,
   ядро не трогает. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'mergemon';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#241a3f', bg2: '#3b2d6e',
      field: '#2e2352', fieldCell: '#3a2c63', fieldCellHot: '#4d3a85',
      spawner: '#ffd43b',
      coin: '#ffd43b', text: '#fff6e8', dim: '#b9a8e0',
      panel: 'rgba(30,22,58,0.95)', panelBorder: '#9d6bff',
      accent: '#9d6bff', good: '#51cf66', bad: '#ff5d73'
    },
    board: { cols: 5, rows: 5 },
    /* 14 тиров монстриков: цвет, пропсы, эмоция. names — в i18n (5.1.3). */
    tiers: [
      { color: '#8ce99a', props: ['sprout'],          mood: 'happy'  }, // 0 Ростик
      { color: '#74c0fc', props: ['bow'],             mood: 'happy'  }, // 1 Капля
      { color: '#ffa94d', props: ['stubhorn'],        mood: 'happy'  }, // 2 Рогач
      { color: '#b197fc', props: ['ears'],            mood: 'happy'  }, // 3 Ушко
      { color: '#ff8fa3', props: ['ears', 'bow'],     mood: 'zen'    }, // 4 Пуфик
      { color: '#63e6be', props: ['antenna'],         mood: 'happy'  }, // 5 Лампик
      { color: '#ffd43b', props: ['spikes'],          mood: 'grumpy' }, // 6 Ёжик
      { color: '#ff8787', props: ['horns', 'mohawk'], mood: 'grumpy' }, // 7 Бесёнок
      { color: '#4dd4fa', props: ['bigears', 'wings'], mood: 'happy' }, // 8 Крылик
      { color: '#e599f7', props: ['wings', 'starwand'], mood: 'zen'  }, // 9 Мотылёк
      { color: '#fab005', props: ['crown', 'scarf'],  mood: 'happy'  }, // 10 Король
      { color: '#fff3bf', props: ['halo', 'wings'],   mood: 'zen'    }, // 11 Ангелик
      { color: '#a9e34b', props: ['starwand', 'ears'], mood: 'happy' }, // 12 Светлячок
      { color: '#ff922b', props: ['flame', 'horns'],  mood: 'grumpy' },  // 13 Дракончик
      { color: '#ffe8cc', props: ['puffcloud', 'gemtop'], mood: 'zen' }, // 14 Комочек
      { color: '#e64980', props: ['crown', 'flame', 'horns'], mood: 'grumpy' } // 15 Царь-Змей
    ],
    income: [0, 1, 2, 4, 7, 12, 20, 34, 58, 100, 175, 300, 520, 900, 1600, 2800], // монет/с за тир i
    economy: {
      spawnCost: 8, spawnGrowth: 1.10, // цена нового яйца растёт с каждой покупкой
      startCoins: 30,
      rvCoins: 60,                      // rewarded: +N монет
      spawnTiers: [0, 0, 0, 0, 1, 1]    // из яйца вылупляется тир 0 (чаще) или 1
    },
    boosters: [
      { id: 'gem',   base: 40, growth: 1.35 }, // поднять случайного на +1 тир
      { id: 'wild',  base: 60, growth: 1.40 }, // джокер: мержится с кем угодно
      { id: 'clear', base: 25, growth: 1.30 }, // убрать самого слабого (+монеты)
      { id: 'gust',  base: 50, growth: 1.35 }  // ураган: перемешивает всех по доске
    ],
    record: { coinCap: 400 }, // record-safe режим: экономика не улетает в бесконечность на 28с
    spawnFx: { pop: 0.25 }
  };

  /* Панель «цели»: 3 слота. rng уже под-seeded вызывающим (детерминизм по seed+уровню). */
  G.config.makeTargets = function (level, rng) {
    var base = clamp(Math.floor(level * 0.6), 0, 12);
    var out = [];
    for (var i = 0; i < 3; i++) {
      var tier = clamp(base + rng.int(0, 2), 0, G.config.tiers.length - 1);
      out.push({ tier: tier, need: rng.int(2, 3 + Math.min(3, level)), got: 0 });
    }
    return out;
  };

  G.config.boosterCost = function (b, lvl) {
    return Math.round(b.base * Math.pow(b.growth, lvl));
  };
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
})(window.GAME);
