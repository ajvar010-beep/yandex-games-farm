/* game/entities.js — сущности «Бабл-Бухты»: всплывающие пузыри и хит-тест тапа. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  /* kind: bubble | pearl | mine | heart | slow | x2 | jelly */
  G.entities = {
    makeBubble: function (kind, x, y, vy, rng) {
      var r = kind === 'mine' ? 26 : (kind === 'pearl' || kind === 'jelly' ? 24 : (kind === 'bubble' ? 20 : 18));
      return { kind: kind, x: x, y: y, vy: vy, r: r, t: 0, phase: rng.angle(), wob: rng.range(0.5, 1.3), wobPh: rng.angle() };
    },

    /* тап по пузырю — круглый хитбокс */
    hitBy: function (b, px, py) {
      var dx = b.x - px, dy = b.y - py;
      return dx * dx + dy * dy <= (b.r + 8) * (b.r + 8);
    },

    /* уплыл за верхний край */
    floatedOff: function (b) { return b.y + b.r < -10; }
  };
})(window.GAME);
