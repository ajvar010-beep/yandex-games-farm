/* game/config.js — весь контентный конфиг «Побег Стрелок»: палитра, параметры уровней,
   экономика, бустеры, ежедневная награда. Ядро конвейера этот файл не трогает. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'arrowescape';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#101a2e', bg2: '#1d2f52',
      text: '#f2f7ff', dim: '#9fb3d1',
      panel: 'rgba(14,24,44,0.96)', panelBorder: '#3d5a8a',
      accent: '#4dd4ac', good: '#5fe08a', bad: '#ff6b81', danger: '#ff5d73',
      coin: '#ffd166', wall: '#54648a', wallEdge: '#7186b0',
      tileColors: ['#4dd4ac', '#5aa9ff', '#ff9f68', '#c77dff', '#ffd166', '#ff6b9d', '#63e6be'],
      tileEdge: '#0a1220'
    },
    /* геометрия поля */
    board: { maxWFrac: 0.94, maxHFrac: 0.60, gap: 0.07, radius: 0.18 },
    /* экономика */
    economy: {
      startCoins: 60, rvCoins: 120,
      clearCoins: 8, starCoins: 6, dailyCoins: 80
    },
    /* бустеры: цена зависит от того, сколько раз уже куплен */
    boosters: [
      { id: 'hint',    base: 25, growth: 1.22 },
      { id: 'bomb',    base: 40, growth: 1.30 },
      { id: 'taps',    base: 30, growth: 1.24 }
    ],
    /* параметры уровня: размер поля, плотность, стены, запас ходов */
    levelSpec: function (level) {
      var lv = Math.max(1, level | 0);
      return {
        cols: Math.min(6, 4 + Math.floor((lv - 1) / 4)),
        rows: Math.min(8, 5 + Math.floor((lv - 1) / 3)),
        fill: Math.min(0.88, 0.70 + (lv % 3) * 0.03 + lv * 0.002),
        walls: lv >= 3 ? Math.min(6, Math.floor((lv - 1) / 4)) : 0,
        colors: lv < 5 ? 3 : lv < 10 ? 4 : lv < 18 ? 5 : 6,
        bombs: lv >= 8 ? Math.min(3, 1 + Math.floor((lv - 8) / 5)) : 0,
        slack: lv <= 3 ? 5 : lv <= 8 ? 4 : 3
      };
    },
    boosterCost: function (b, times) {
      return Math.round(b.base * Math.pow(b.growth, times || 0));
    }
  };
})(window.GAME);
