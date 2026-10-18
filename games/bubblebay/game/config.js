/* game/config.js — константы и баланс «Бабл-Бухты» (аркада на лопанье пузырей). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'bubblebay';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#04263e',
      bg2: '#0a4a6e',
      sand: '#f7d9a0',
      foam: '#bdefff',
      bubble: '#8fdcff',
      bubbleIn: '#e6faff',
      pearl: '#ffe9f2',
      gold: '#ffd43b',
      crab: '#ff7a59',
      mine: '#4a5568',
      mineSpike: '#ff5d5d',
      heart: '#ff6b9d',
      slow: '#74c0fc',
      x2: '#b197fc',
      jelly: '#c3a3ff',
      pearlCur: '#ffd6ea',
      text: '#eafcff',
      panel: '#083252',
      panelEdge: '#1e6a96',
      dim: '#9fd9ee',
      accent: '#8fdcff',
      star: '#ffd43b',
      dust: '#ffd6ea'
    },
    lives: 3,
    maxLevel: 20,
    // пузырь поднимается снизу вверх; скорость растёт с уровнем
    riseSpeed: function (lv) { return 90 + lv * 18; },
    spawnInterval: function (lv) { return Math.max(0.4, 1.15 - lv * 0.06); },
    // шансы видов пузырей
    chances: function (lv) {
      return {
        mine: Math.min(0.3, 0.06 + lv * 0.012),
        gold: 0.08,
        heart: 0.015,
        slow: 0.02,
        x2: 0.02,
        jelly: 0.02
      };
    },
    score: { bubble: 10, gold: 50, jelly: 150, comboCap: 5 },
    economy: {
      slowPrice: 40, x2Price: 60, netPrice: 80, tidePrice: 130,
      slowDur: 5, x2Dur: 8, netDur: 12, tidePush: 0.3,
      rvPearl: 60
    },
    levelGoal: function (lv) { return 8 + lv * 3; },
    recordMaxRise: 220,
    recordRewardCap: 90
  };
})(window.GAME);
