/* game/entities.js — острова и облака «Скайблоков».
   Остров: { tier, lvl, unlocked, phase }. Облако: { x, y, r, t, phase, value, vx, vy }. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  G.entities = {
    makeIsland: function (tier, rng) {
      return { tier: tier, lvl: 0, unlocked: tier === 0, phase: rng.float() * Math.PI * 2 };
    },
    makeCloud: function (x, y, r, value, rng, golden) {
      return { x: x, y: y, r: r, t: 0, phase: rng.float() * Math.PI * 2, value: value,
               golden: !!golden,
               vx: rng.range(-8, 8) * (golden ? 1.8 : 1), vy: rng.range(-5, 5) * (golden ? 1.8 : 1) };
    },
    islandAt: function (scene, x, y) {
      for (var i = 0; i < scene.islandPos.length; i++) {
        var p = scene.islandPos[i];
        var dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy <= p.r * p.r) return i;
      }
      return -1;
    },
    cloudAt: function (scene, x, y) {
      for (var i = scene.clouds.length - 1; i >= 0; i--) {
        var c = scene.clouds[i];
        var dx = x - c.x, dy = y - c.y;
        if (dx * dx + dy * dy <= c.r * c.r) return i;
      }
      return -1;
    }
  };
})(window.GAME);
