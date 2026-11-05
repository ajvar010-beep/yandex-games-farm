/* game/entities.js — сладости-шары: физика (гравитация, круг-круг, стакан), мердж.
   Детерминировано: никакого Math.random в логике — только переданный rng. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;
  var _id = 1;

  function tierRadius(tier, k) { return G.config.tiers[tier].r * k; }

  function makeSweet(tier, x, y, rng) {
    return {
      id: _id++, tier: tier, x: x, y: y, vx: 0, vy: 0,
      angle: rng ? rng.float() * Math.PI * 2 : 0, av: 0,
      r: 0,            // выставляется на layout (tierRadius * k)
      born: 0, merged: false, popT: 0, phase: rng ? rng.float() * 6.28 : 0
    };
  }

  /* ---------- физика ---------- */
  function step(scene, dt) {
    var P = G.config.physics, balls = scene.balls, cup = scene.cup;
    var i, j, a, b;
    // гравитация + интеграция
    for (i = 0; i < balls.length; i++) {
      a = balls[i];
      a.vy += P.gravity * dt;
      a.vx -= a.vx * P.airDrag * dt;
      a.vy -= a.vy * P.airDrag * 0.4 * dt;
      a.x += a.vx * dt; a.y += a.vy * dt;
      a.angle += a.av * dt;
      a.av *= Math.pow(P.rollFriction, dt * 60);
      if (a.popT > 0) a.popT -= dt;
    }
    // стены стакана
    for (i = 0; i < balls.length; i++) {
      a = balls[i];
      if (a.x - a.r < cup.left) { a.x = cup.left + a.r; a.vx = -a.vx * P.rest; }
      if (a.x + a.r > cup.right) { a.x = cup.right - a.r; a.vx = -a.vx * P.rest; }
      if (a.y + a.r > cup.bottom) {
        a.y = cup.bottom - a.r;
        if (Math.abs(a.vy) > 40) E.audio.sfx('tick');
        a.vy = -a.vy * P.rest;
        a.vx *= P.friction;
        a.av = a.vx / Math.max(1, a.r);
      }
    }
    // круг-круг (2 прохода для стабильности) + сбор мерджей
    var merges = [];
    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < balls.length; i++) {
        for (j = i + 1; j < balls.length; j++) {
          a = balls[i]; b = balls[j];
          if (a.merged || b.merged) continue;
          var dx = b.x - a.x, dy = b.y - a.y;
          var dist = Math.hypot(dx, dy), min = a.r + b.r;
          if (dist >= min || dist === 0) continue;
          // мердж: одинаковый тир (или радуга -1)
          if (pass === 0 && canMerge(a, b) && dist < min * 0.94) {
            merges.push([a, b]);
            a.merged = b.merged = true;
            continue;
          }
          // разрешение коллизии (позиционное + импульс)
          var nx = dx / dist, ny = dy / dist, overlap = min - dist;
          var ma = a.r * a.r, mb = b.r * b.r, tm = ma + mb;
          a.x -= nx * overlap * (mb / tm); a.y -= ny * overlap * (mb / tm);
          b.x += nx * overlap * (ma / tm); b.y += ny * overlap * (ma / tm);
          var rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          var vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            var imp = -(1 + P.rest) * vn / (1 / ma + 1 / mb);
            a.vx -= imp * nx / ma; a.vy -= imp * ny / ma;
            b.vx += imp * nx / mb; b.vy += imp * ny / mb;
          }
        }
      }
    }
    return merges;
  }

  function canMerge(a, b) {
    if (a.tier === -1 || b.tier === -1) return true;      // радуга мержится со всеми
    return a.tier === b.tier && a.tier < G.config.tiers.length - 1;
  }
  function mergeTier(a, b) {
    if (a.tier === -1) return Math.min(b.tier + 1, G.config.tiers.length - 1);
    if (b.tier === -1) return Math.min(a.tier + 1, G.config.tiers.length - 1);
    return a.tier + 1;
  }

  G.entities = {
    makeSweet: makeSweet, tierRadius: tierRadius,
    step: step, canMerge: canMerge, mergeTier: mergeTier
  };
})(window.GAME);
