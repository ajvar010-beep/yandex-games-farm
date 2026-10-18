/* game/entities.js — сущности «Гончего Дождя»: капельки и градины. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  /* Падающий предмет: {kind:'drop'|'hail'|'rainbow', x, y, vy, r, spin, phase}.
     Капельки слегка покачиваются, радужные чуть крупнее, градины падают быстрее и прямо. */
  G.makeFall = function (kind, x, y, vy, rng) {
    return {
      kind: kind,
      x: x, y: y,
      vy: vy * (kind === 'hail' ? 1.25 : 1),
      r: kind === 'hail' ? 13 + rng.float() * 4 : (kind === 'rainbow' ? 13 : 11) + rng.float() * 4,
      wobA: kind === 'hail' ? 0 : 8 + rng.float() * 14,
      wobF: 1 + rng.float() * 1.6,
      phase: rng.float() * Math.PI * 2,
      spin: (rng.float() - 0.5) * 3
    };
  };

  /* Точка в круге. */
  G.hitCircle = function (px, py, cx, cy, r) {
    var dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  };
})(window.GAME);
