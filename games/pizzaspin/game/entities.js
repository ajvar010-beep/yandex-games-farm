/* game/entities.js — сущности «Пиццы-Поворота»: падающие топпинги. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var TYPES = ['pepperoni', 'mushroom', 'olive', 'pepper'];

  /* Падающий топпинг: {type, x, y, r, vy, spin, angle, gold}.
     x — столбец падения (px), y — текущая высота, vy — px/с.
     gold=true — редкий золотой топпинг: ×5 очков, +5 крошек. */
  G.makeTopping = function (x, y, vy, rng, gold) {
    return {
      type: TYPES[(rng.float() * TYPES.length) | 0],
      x: x, y: y,
      r: gold ? 22 : 16 + rng.float() * 6,
      vy: vy,
      wobA: 10 + rng.float() * 22,          // амплитуда покачивания по x (px)
      wobF: 0.8 + rng.float() * 1.4,        // частота покачивания (рад/с)
      phase: rng.float() * Math.PI * 2,
      spin: (rng.float() - 0.5) * 4,
      angle: rng.float() * Math.PI * 2,
      gold: !!gold
    };
  };
  G.TOPPING_TYPES = TYPES;
})(window.GAME);
