/* game/entities.js — параметры, фабрики и отрисовка сущностей.
   Враги хранятся в полярных координатах (angle, r) относительно центра: поворот/resize
   экрана не ломает состояние (1.10, 1.14).
   ВАЖНО: hpMul/spMul (скейлинг волны) сохраняются НА ОБЪЕКТЕ врага — дети сплиттера
   (killEnemy -> makeEnemy('dart', ..., e.hpMul, e.spMul)) наследуют скейлинг родителя.
   Без этих полей дочерние дротики спавнились бы со статами волны 1 на любой волне,
   и нарастающая сложность (2.8) проседала бы именно на поздних волнах. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var ENT = {};

  ENT.TYPES = {
    drifter:  { hp: 1, speed: 42, size: 14, touch: 1, value: 1 },
    dart:     { hp: 1, speed: 95, size: 10, touch: 1, value: 2 },
    splitter: { hp: 3, speed: 48, size: 15, touch: 1, value: 3 },
    tank:     { hp: 6, speed: 26, size: 20, touch: 2, value: 4 },
    warden:   { hp: 30, speed: 22, size: 30, touch: 3, value: 25 },
    lancer:   { hp: 2, speed: 55, size: 12, touch: 1, value: 3, lungeR: 210, lungeMul: 3.4 }
  };

  ENT.makeEnemy = function (type, angle, r, hpMul, spMul) {
    var t = ENT.TYPES[type];
    var hm = hpMul || 1, sm = spMul || 1;
    var hp = Math.max(1, Math.round(t.hp * hm));
    return {
      type: type, angle: angle, r: r,
      hp: hp, maxHp: hp,
      speed: t.speed * sm,
      size: t.size, touch: t.touch, value: t.value,
      spin: 0, hitFlash: 0, lunging: false,
      hpMul: hm, spMul: sm // наследуются дочерними врагами (сплиттер) — см. killEnemy
    };
  };

  ENT.makeBullet = function (x, y, angle, speed, dmg) {
    return { x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
             life: 1.2, dmg: dmg };
  };

  ENT.updateEnemy = function (e, dt, slowFactor) {
    var sp = e.speed;
    if (e.type === 'lancer') {
      // копейщик: дрейфует до lungeR, потом один резкий рывок к ядру
      if (!e.lunging && e.r <= ENT.TYPES.lancer.lungeR) e.lunging = true;
      if (e.lunging) sp *= ENT.TYPES.lancer.lungeMul;
    }
    e.r -= sp * slowFactor * dt;
    e.spin += dt;
    if (e.hitFlash > 0) e.hitFlash -= dt * 6;
  };

  function poly(ctx, x, y, r, n, rot) {
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var a = rot + (i / n) * Math.PI * 2;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  ENT.poly = poly;

  ENT.drawEnemy = function (ctx, e, cx, cy, pal) {
    var x = cx + Math.cos(e.angle) * e.r;
    var y = cy + Math.sin(e.angle) * e.r;
    var col = pal.enemy[e.type] || '#fff';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.angle + Math.PI / 2); // "лицом" к ядру
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    var s = e.size;
    if (e.type === 'drifter') {
      ctx.globalAlpha = 0.9;
      poly(ctx, 0, 0, s, 3, 0); ctx.fill();
    } else if (e.type === 'dart') {
      poly(ctx, 0, 0, s, 4, 0); ctx.fill();
    } else if (e.type === 'splitter') {
      ctx.rotate(Math.sin(e.spin * 2) * 0.4);
      poly(ctx, 0, 0, s, 4, Math.PI / 4); ctx.fill();
    } else if (e.type === 'tank') {
      ctx.globalAlpha = 0.35; poly(ctx, 0, 0, s, 6, 0); ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = 3; poly(ctx, 0, 0, s, 6, 0); ctx.stroke();
    } else if (e.type === 'warden') {
      ctx.globalAlpha = 0.30; poly(ctx, 0, 0, s, 6, 0); ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = 3; poly(ctx, 0, 0, s, 6, 0); ctx.stroke();
      ctx.rotate(e.spin * 1.5);
      poly(ctx, 0, 0, s * 0.45, 3, 0); ctx.stroke();
      ctx.rotate(-e.spin * 1.5);
    } else if (e.type === 'lancer') {
      // вытянутое копьё; в рывке — яркая вспышка и шлейф
      if (e.lunging) {
        ctx.globalAlpha = 0.30;
        poly(ctx, 0, 0, s * 1.5, 3, 0); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.scale(1.7, 0.8);
      poly(ctx, 0, 0, s, 3, 0); ctx.fill();
      ctx.scale(1 / 1.7, 1 / 0.8);
      ctx.fillStyle = '#ffffff';
      poly(ctx, s * 0.9, 0, s * 0.3, 3, 0); ctx.fill();
    }
    if (e.hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, e.hitFlash);
      ctx.fillStyle = '#ffffff';
      poly(ctx, 0, 0, s, 6, 0); ctx.fill();
    }
    ctx.restore();
    // полоска HP для "толстых" врагов
    if (e.maxHp > 1) {
      var w = e.size * 1.6, k = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - w / 2, y - e.size - 9, w, 4);
      ctx.fillStyle = col;
      ctx.fillRect(x - w / 2, y - e.size - 9, w * k, 4);
    }
  };

  ENT.drawCore = function (ctx, cx, cy, core, R, pal, t) {
    // пульсирующее свечение
    var pulse = 1 + Math.sin(t * 2.4) * 0.04;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = core.hitT > 0 ? pal.coreHurt : pal.core;
    poly(ctx, 0, 0, R * 1.5 * pulse, 6, t * 0.2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0e1530';
    poly(ctx, 0, 0, R, 6, Math.PI / 6); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = core.hitT > 0 ? pal.coreHurt : pal.core;
    poly(ctx, 0, 0, R, 6, Math.PI / 6); ctx.stroke();
    // кольцо эгиды: видно, пока щит заряжен (core.aegisLeft > 0 задаёт сцена)
    if (core.aegisLeft > 0) {
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 3.2);
      ctx.strokeStyle = pal.aegis; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R + 15, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // сегменты прочности
    for (var i = 0; i < core.max; i++) {
      if (i >= core.hp) continue;
      var a0 = -Math.PI / 2 + (i / core.max) * Math.PI * 2 + 0.04;
      var a1 = -Math.PI / 2 + ((i + 1) / core.max) * Math.PI * 2 - 0.04;
      ctx.beginPath();
      ctx.arc(0, 0, R + 9, a0, a1);
      ctx.lineWidth = 5;
      ctx.strokeStyle = pal.core;
      ctx.stroke();
    }
    ctx.restore();
  };

  ENT.drawDefender = function (ctx, x, y, aimAngle, pal, ready) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = pal.defender;
    ctx.beginPath(); ctx.arc(0, 0, ready ? 20 : 15, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.defender;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b0e1a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.rotate(aimAngle);
    ctx.strokeStyle = pal.defender; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.restore();
  };

  ENT.drawBullet = function (ctx, b, pal) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = pal.bullet;
    ctx.fillRect(-6, -2, 12, 4);
    ctx.restore();
  };
  G.entities = ENT;
})(window.GAME);
