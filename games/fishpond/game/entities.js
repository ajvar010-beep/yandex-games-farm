/* game/entities.js — логика «Рыбного Пруда»: рыбки, пузыри, движение.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};

  /* ---------- Рыбка ---------- */
  ENT.makeFish = function (rng, w, h) {
    var side = rng() < 0.5 ? -1 : 1;
    var x = side === -1 ? -40 : w + 40;
    var y = h * 0.3 + rng() * h * 0.5;
    var speed = (G.config.fish.speedBase + rng() * G.config.fish.speedVar) * side;
    var size = G.config.fish.sizeBase + rng() * G.config.fish.sizeVar;
    var color = 1 + Math.floor(rng() * 5);
    return {
      x: x, y: y,
      vx: speed, vy: 0,
      size: size,
      color: color,
      dir: side,
      t: rng() * 100,
      bubbleT: 0,
      id: Math.floor(rng() * 1000000)
    };
  };

  /* ---------- Обновление рыбки ---------- */
  ENT.updateFish = function (fish, dt, w, h, rng) {
    fish.t += dt;
    fish.x += fish.vx * dt;
    // покачивание
    fish.y += Math.sin(fish.t * 3) * 5 * dt;

    // выход за край — возврат
    if (fish.vx > 0 && fish.x > w + 50) fish.x = -50;
    if (fish.vx < 0 && fish.x < -50) fish.x = w + 50;

    // пузырь
    fish.bubbleT -= dt;
    if (fish.bubbleT <= 0 && rng() < G.config.fish.bubbleRate) {
      fish.bubbleT = 1 + rng() * 2;
      return {
        x: fish.x, y: fish.y - fish.size * 0.3,
        size: 4 + rng() * 6,
        vy: -30 - rng() * 20,
        t: 0,
        id: Math.floor(rng() * 1000000)
      };
    }
    return null;
  };

  /* ---------- Пузырь ---------- */
  ENT.updateBubble = function (b, dt) {
    b.t += dt;
    b.y += b.vy * dt;
    b.x += Math.sin(b.t * 5) * 10 * dt;
    return b.y > -20;
  };

  /* ---------- Проверка тапа по рыбке ---------- */
  ENT.hitFish = function (fish, x, y) {
    var dx = x - fish.x, dy = y - fish.y;
    return dx * dx + dy * dy < fish.size * fish.size;
  };

  /* ---------- Проверка тапа по пузырю ---------- */
  ENT.hitBubble = function (b, x, y) {
    var dx = x - b.x, dy = y - b.y;
    return dx * dx + dy * dy < b.size * b.size * 2;
  };
})(window.GAME);
