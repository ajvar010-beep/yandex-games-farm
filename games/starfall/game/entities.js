/* game/entities.js — сущности «Старфолла»: падающие дропы и хит-тесты. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  /* kind: star | gold | meteor | heart | slow | x2 | nova */
  G.entities = {
    makeDrop: function (kind, x, y, vy, rng) {
      var r = kind === 'meteor' ? 26 : (kind === 'gold' ? 22 : (kind === 'nova' ? 24 : 18));
      return { kind: kind, x: x, y: y, vy: vy, r: r, t: 0, phase: rng.angle(), wob: rng.range(0.4, 1.2), wobPh: rng.angle() };
    },

    /* попадание дропа в чашу кометы */
    caughtBy: function (drop, bx, by, bw, bh) {
      return drop.y + drop.r > by - bh * 0.4 && drop.y - drop.r < by + bh &&
             Math.abs(drop.x - bx) < bw / 2 + drop.r * 0.7;
    },

    /* упал за нижний край */
    fellOff: function (drop, h) { return drop.y - drop.r > h; }
  };
})(window.GAME);
