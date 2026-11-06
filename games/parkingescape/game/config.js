/* game/config.js — контент «Побег с Парковки»: асфальт, машины, блоки, снег, эвакуатор.
   Механика повторяет проверенное ядро «стрелок»: машина уезжает, если выезд свободен,
   и уводит за собой колонну. Меняется только тема и подача. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'parkingescape';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#23282f', bg2: '#343c45',
      text: '#f4f7fb', dim: '#a7b2c0',
      panel: 'rgba(18,22,28,0.96)', panelBorder: '#4a5868',
      accent: '#ffd43b', good: '#51cf66', bad: '#ff6b81', danger: '#ff5d73',
      coin: '#ffd43b', wall: '#6b7480', wallEdge: '#9aa6b2',
      /* цвета машин: красный, синий, жёлтый, зелёный, фиолетовый, розовый, белый */
      tileColors: ['#e03131', '#1c7ed6', '#f59f00', '#37b24d', '#343a40'],
      tileEdge: '#15181c'
    },
    board: { maxWFrac: 0.94, maxHFrac: 0.60, gap: 0.07, radius: 0.12 },
    economy: {
      startCoins: 60, rvCoins: 120,
      clearCoins: 8, starCoins: 6, dailyCoins: 80
    },
    boosters: [
      { id: 'hint',    base: 25, growth: 1.22 },
      { id: 'bomb',    base: 40, growth: 1.30 },  // эвакуатор: увозит 3×3
      { id: 'taps',    base: 30, growth: 1.24 }
    ],
    /* темы: день, закат, ночь, подземный паркинг — каждые 8 уровней */
    themes: [
      { bg: '#23282f', bg2: '#343c45', glow: 'rgba(255,255,255,0.07)' },
      { bg: '#2b1f1a', bg2: '#4a342a', glow: 'rgba(255,170,80,0.12)' },
      { bg: '#0f141a', bg2: '#18232f', glow: 'rgba(120,180,255,0.10)' },
      { bg: '#1b1b1f', bg2: '#2b2b31', glow: 'rgba(255,220,120,0.08)' }
    ],
    themeFor: function (level) { return this.themes[Math.floor((Math.max(1, level | 0) - 1) / 8) % this.themes.length]; },
    /* параметры уровня: поле, плотность, ограждения, блоки, снег, запас ходов */
    levelSpec: function (level) {
      var lv = Math.max(1, level | 0);
      return {
        cols: lv >= 10 ? (5 + (lv % 2)) : Math.min(6, 4 + Math.floor((lv - 1) / 4)),
        rows: lv >= 10 ? (7 + ((lv >> 1) % 2)) : Math.min(8, 5 + Math.floor((lv - 1) / 3)),
        fill: Math.min(0.88, 0.70 + (lv % 3) * 0.03 + lv * 0.002),
        walls: lv >= 3 ? Math.min(6, Math.floor((lv - 1) / 4)) : 0,
        colors: lv < 5 ? 3 : lv < 10 ? 4 : 5,
        bombs: lv >= 8 ? Math.min(3, 1 + Math.floor((lv - 8) / 5)) : 0,
        crates: lv >= 5 ? Math.min(6, 1 + Math.floor((lv - 5) / 3)) : 0,
        frozen: lv >= 10 ? Math.min(5, 1 + Math.floor((lv - 10) / 3)) : 0,
        slack: lv <= 3 ? 5 : lv <= 8 ? 4 : 3
      };
    },
    boosterCost: function (b, times) {
      return Math.round(b.base * Math.pow(b.growth, times || 0));
    }
  };
})(window.GAME);
