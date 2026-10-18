/* game/entities.js — сущности «Сладкой Башни»: слой торта и фабрики состояния. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  /* Слой: {x, w, variant, settled} — x это центр в долях ширины поля (0..1), w в долях. */
  G.makeLayer = function (x, w, variant) {
    return { x: x, w: w, variant: variant % 3, settled: false };
  };

  /* Пересечение нового слоя с верхним: возвращает {x, w} уцелевшей части или null. */
  G.overlap = function (prev, cur) {
    var aL = prev.x - prev.w / 2, aR = prev.x + prev.w / 2;
    var bL = cur.x - cur.w / 2, bR = cur.x + cur.w / 2;
    var L = Math.max(aL, bL), R = Math.min(aR, bR);
    if (R <= L) return null;
    return { x: (L + R) / 2, w: R - L };
  };

  /* Идеальное попадание — смещение центров в пределах допуска. */
  G.isPerfect = function (prev, cur, tol) {
    return Math.abs(prev.x - cur.x) <= tol * prev.w;
  };
})(window.GAME);
