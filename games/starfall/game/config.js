/* game/config.js — константы и баланс «Старфолла» (аркада на ловлю звёзд). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'starfall';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#0a0d24', bg2: '#131a3f', sky1: '#1c2b63', sky2: '#2a3f8f',
      star: '#ffd43b', starHot: '#fff3bf', gold: '#ffb300', meteor: '#ff5d5d',
      meteorHot: '#ffa8a8', heart: '#ff6b9d', slow: '#74c0fc', x2: '#b197fc',
      comet: '#7df9ff', cometCore: '#e8fbff', dust: '#9adcff', nova: '#ffa8ff',
      text: '#fff6e8', dim: '#9fb0e8', panel: 'rgba(10,13,36,0.95)',
      panelBorder: '#4d6bff', accent: '#5f7cff', good: '#51cf66', bad: '#ff5d73'
    },
    basket: { w: 96, h: 34, yPad: 64, speed: 900 },
    lives: 3,
    maxLevel: 20,
    // спавн: интервал и скорость падения по уровню
    spawnInterval: function (lv) { return Math.max(0.34, 1.05 - lv * 0.055); },
    fallSpeed: function (lv) { return 130 + lv * 26; },
    // шансы типов дропа (должны в сумме быть <= 1)
    chances: function (lv) {
      return {
        meteor: Math.min(0.30, 0.07 + lv * 0.013),
        gold: 0.075, heart: 0.014, slow: 0.018, x2: 0.018, nova: 0.02
      };
    },
    score: { star: 10, gold: 50, nova: 150, comboCap: 5 },
    economy: {
      slowPrice: 40, x2Price: 60, shieldPrice: 80, magnetPrice: 120, // цены в звёздной пыли ✦
      slowDur: 5, x2Dur: 8, shieldDur: 12, magnetDur: 10, magnetPull: 300, rvDust: 60
    },
    // цель уровня: поймать N звёзд (метеориты не считаются)
    levelGoal: function (lv) { return 8 + lv * 3; }
  };
})(window.GAME);
