/* game/entities.js — сущности «Рыжего Побега»: препятствия и монетки. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  /* Препятствие: {type:'box'|'puddle'|'bird', x, y, w, h}. x — левый край (px),
     y — верх (px). Всё в экранных координатах, мир катится влево через scroll. */
  G.makeObstacle = function (type, x, groundY, level, rng) {
    if (type === 'box') {
      var s = 44 + Math.min(26, level * 2);
      return { type: type, x: x, y: groundY - s, w: s, h: s };
    }
    if (type === 'puddle') {
      var pw = 70 + rng.float() * 40;
      return { type: type, x: x, y: groundY - 4, w: pw, h: 8 };
    }
    // bird — на высоте прыжка головы
    var bh = 34;
    return { type: type, x: x, y: groundY - 96 - rng.float() * 30, w: bh * 1.3, h: bh };
  };

  /* Монетка-рыбка: {x, y, r, phase, gold}. gold=true — золотая рыбка (редкий бонус). */
  G.makeFish = function (x, y, r, rng, gold) {
    return { x: x, y: y, r: r, phase: rng.float() * Math.PI * 2, gold: !!gold };
  };

  /* Прямоугольное пересечение (кот — aabb). */
  G.aabb = function (ax, ay, aw, ah, b) {
    return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
  };
  /* Точка в круге (для рыбок). */
  G.hitCircle = function (px, py, c) {
    var dx = px - c.x, dy = py - c.y;
    return dx * dx + dy * dy <= (c.r + 6) * (c.r + 6);
  };
})(window.GAME);
