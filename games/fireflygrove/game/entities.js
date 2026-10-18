/* game/entities.js — сущности «Лампового Сада»: светлячки и гусеницы. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  /* Светлячок: блуждает по поляне (случайное блуждание + мягкий разворот),
     периодически вспыхивает. lit: 0..1 (сила свечения), glowT — осталось гореть,
     gapT — до следующей вспышки. */
  G.makeBug = function (x, y, area, rng, lv) {
    var a = rng.float() * Math.PI * 2;
    return {
      x: x, y: y,
      vx: Math.cos(a), vy: Math.sin(a),
      turnT: 0.5 + rng.float() * 1.5,
      area: area,                       // {x0,y0,x1,y1} границы поляны
      lit: 0,
      glowT: 0,
      gapT: rng.float() * G.config.glowGap(lv),
      r: 16 + rng.float() * 5,
      phase: rng.float() * Math.PI * 2
    };
  };

  /* Лунный мотылёк: редкий бонус с 5 уровня. Летает широко, светится
     постоянно, поймать трудно (быстрее светлячков), но даёт ×4 очка
     и +8 пыльцы. Живёт в стае как обычный баг — флаг moth. */
  G.makeMoth = function (x, y, area, rng, lv) {
    var b = G.makeBug(x, y, area, rng, lv);
    b.moth = true;
    b.r = 15 + rng.float() * 4;
    b.lit = 1;
    b.glowT = 999;          // не гаснет
    b.gapT = 999;
    return b;
  };

  /* Гусеница: ползёт по нижней части поляны. */
  G.makeCaterpillar = function (x, y, area, rng) {
    var dir = rng.float() < 0.5 ? -1 : 1;
    return { x: x, y: y, dir: dir, speed: 20 + rng.float() * 14, area: area, r: 18 };
  };

  /* Точка в круге с допуском. */
  G.hitCircle = function (px, py, cx, cy, r) {
    var dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  };
})(window.GAME);
