/* game/config.js — весь контентный конфиг «Слияние Суфле»: тиры, экономика, бустеры, цели.
   Конвейер меняет этот файл + i18n + art/entities/scenes, ядро не трогает. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'mergesweets';
  G.version = '2.0.0';

  G.config = {
    palette: {
      bg: '#2b1a3e', bg2: '#3d2660',
      glass: 'rgba(255,255,255,0.10)', glassEdge: 'rgba(255,220,255,0.5)',
      coin: '#ffd43b', text: '#fff6e8', dim: '#c9b8e8',
      panel: 'rgba(30,20,55,0.96)', panelBorder: '#b98aff',
      accent: '#ff9ad5', good: '#6fe3a5', bad: '#ff6b81', danger: '#ff5d73'
    },
    /* стакан (в долях экрана) */
    cup: { wFrac: 0.7, hFrac: 0.62, bottomFrac: 0.9, wall: 14 },
    /* 11 тиров сладостей: радиус (px на 720px высоты), цвет, блики, счёт. */
    tiers: [
      { r: 26,  color: '#ff8fab', hi: '#ffd0e0', score: 1    }, // 0 конфетка
      { r: 33,  color: '#ffa94d', hi: '#ffe0b8', score: 3   }, // 1 мармелад
      { r: 41,  color: '#ffd43b', hi: '#fff0a8', score: 6   }, // 2 леденец
      { r: 51,  color: '#a9e34b', hi: '#e0ffb0', score: 10  }, // 3 марципан
      { r: 62,  color: '#63e6be', hi: '#c0fff0', score: 15  }, // 4 мята
      { r: 75,  color: '#74c0fc', hi: '#d0eaff', score: 21  }, // 5 блю
      { r: 90,  color: '#b197fc', hi: '#e6dcff', score: 28  }, // 6 слива
      { r: 106, color: '#ff8787', hi: '#ffc9c9', score: 36  }, // 7 ягода
      { r: 124, color: '#e599f7', hi: '#f5d6ff', score: 45  }, // 8 орхидея
      { r: 143, color: '#fab005', hi: '#ffe08a', score: 55  }, // 9 карамель
      { r: 165, color: '#ff5d8f', hi: '#ffc0d8', score: 66  }  // 10 ФИНАЛ «Суфле»
    ],
    maxDropTier: 4,                 // спавн только 0..4
    physics: { gravity: 1900, airDrag: 0.12, rest: 0.12, friction: 0.86, rollFriction: 0.985 },
    drop: { cooldown: 0.42, aimSpeed: 900, startX: 0.5 },
    economy: {
      startCoins: 40, rvCoins: 120, reviveCost: 0,
      coinPerTier: [0, 1, 1, 2, 3, 4, 6, 8, 12, 18, 30]
    },
    boosters: [
      { id: 'bomb',    base: 30, growth: 1.30 },  // взрыв — убрать шар под прицелом
      { id: 'shuffle', base: 45, growth: 1.32 },  // встряхнуть стакан
      { id: 'rainbow', base: 70, growth: 1.40 },  // следующий шар мержится с кем угодно
      { id: 'upgrade', base: 55, growth: 1.35 }   // следующий шар +1 тир
    ],
    goals: { perLevel: 3 },
    record: { coinCap: 500 },
    /* комбо: серия мерджей подряд даёт бонусные монеты */
    combo: { window: 1.3, at3: 1, at5: 2 },
    /* темы фона — меняются каждые 6 уровней */
    themes: [
      { bg: '#2b1a3e', bg2: '#3d2660', glow: 'rgba(255,154,213,0.10)' },
      { bg: '#1d1430', bg2: '#3a2350', glow: 'rgba(177,151,252,0.12)' },
      { bg: '#241a12', bg2: '#4a2f1a', glow: 'rgba(255,212,59,0.10)' },
      { bg: '#101f26', bg2: '#173a45', glow: 'rgba(99,230,190,0.10)' }
    ],
    themeFor: function (level) { return this.themes[Math.floor((Math.max(1, level | 0) - 1) / 6) % this.themes.length]; },
    /* параметры уровня: ширина стакана, физические штыри, темп дропа */
    levelSpec: function (level) {
      var lv = Math.max(1, level | 0);
      return {
        cupW: 0.70 + (lv % 3) * 0.02,
        pegs: lv >= 3 ? Math.min(3, 1 + Math.floor((lv - 3) / 4)) : 0,
        dropCd: Math.max(0.30, 0.44 - lv * 0.004),
        gravity: 1750 + Math.min(320, lv * 16)
      };
    }
  };

  /* цели уровня: сделать N шаров тира T. Детерминированно по level+rng. */
  G.config.makeGoals = function (level, rng) {
    // Тиры целей ограничены 6-м: раньше пул доходил до 10 и уровень требовал
    // 2–7 шаров тира 9–10 (516–1024 базовых конфетки) — цель была недостижима.
    var maxT = level <= 2 ? 3 : Math.min(6, 4 + Math.floor((level - 3) / 4));
    var count = level <= 2 ? 2 : G.config.goals.perLevel;
    var pool = [];
    for (var t0 = 2; t0 <= maxT; t0++) pool.push(t0);
    for (var i = pool.length - 1; i > 0; i--) {
      var j = rng.int(0, i), tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var out = [];
    for (var k = 0; k < count; k++) {
      var tier = pool.length ? pool[k % pool.length] : 2;
      // чем выше тир, тем меньше нужно: тир 6 — 1 штука, тир 5 — до 2, тир 4 — до 3
      var baseNeed = rng.int(2, 3 + Math.min(4, Math.floor(level / 2)));
      var need = Math.max(1, Math.min(baseNeed, 6 - tier));
      if (level <= 5 && tier >= 4) need = Math.min(need, 1);
      out.push({ tier: tier, need: need, got: 0 });
    }
    return out;
  };
  G.config.boosterCost = function (b, lvl) { return Math.round(b.base * Math.pow(b.growth, lvl)); };
})(window.GAME);
