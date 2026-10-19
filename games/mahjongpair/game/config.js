/* game/config.js — настройки «Парного Маджонга».
   Standalone: пишем в window.GAME.config. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var CONFIG = {
    id: 'mahjongpair',
    version: '1.0.0',
    palette: {
      bg: '#0d1f1a',
      bg2: '#16332a',
      board: '#0a1713',
      cell: '#1a3d32',
      cellHot: '#2d5a4a',
      tile: '#f5e6c8',
      tileDark: '#d4b896',
      tileEdge: '#8a6f4d',
      tileShadow: '#0a0f0c',
      tileSel: '#ffd43b',
      tileHint: '#6dd98a',
      text: '#f5f0e0',
      dim: '#b8a88a',
      accent: '#d4a94e',
      coin: '#ffd43b',
      good: '#6dd98a',
      bad: '#ff6b81',
      panel: 'rgba(10,23,19,0.95)',
      panelBorder: '#d4a94e'
    },
    // Плитки: 4 копии каждого типа. Количество типов растёт с уровнем.
    tiles: {
      typesBase: 8,      // уровень 1: 8 типов × 4 = 32 плитки
      typesPerLevel: 2,  // каждый уровень +2 типа
      typesMax: 24,      // уровень 9+: 24 типа × 4 = 96 плиток
      layersBase: 2,     // уровень 1: 2 слоя
      layersMax: 4       // уровень 7+: 4 слоя
    },
    // Время на уровень (секунды)
    levelTime: function (lv) {
      return Math.max(90, 180 - lv * 3);
    },
    // Максимальный уровень
    maxLevel: 20,
    // Экономика
    economy: {
      startCoins: 60,
      winBase: 50,
      winPerLevel: 15,
      rvCoins: 70,
      hintPrice: 30,      // показать пару
      shufflePrice: 40,   // перемешать оставшиеся
      timePrice: 45,      // +30 секунд
      undoPrice: 35       // отменить последний ход
    },
    // Раскладки: 20 рукописных паттернов (название, сложность)
    layouts: [
      'turtle', 'bridge', 'pyramid', 'fortress', 'dragon',
      'butterfly', 'cathedral', 'arena', 'spiral', 'crown',
      'turtle2', 'bridge2', 'pyramid2', 'fortress2', 'dragon2',
      'butterfly2', 'cathedral2', 'arena2', 'spiral2', 'crown2'
    ],
    // Стрик: возврат на следующий день
    streak: {
      enabled: true,
      rewardBase: 20,     // монеты за день стрика
      rewardPerDay: 5     // +5 за каждый день подряд
    }
  };

  G.config = CONFIG;
  G.id = CONFIG.id;
})(window.GAME);
