/* engine/fx.js — пул частиц (cap 320), тряска экрана, вспышка. Детерминированно по времени. */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var MAX = 320;
  var parts = [];
  var shakeAmp = 0, shakeT = 0, shakeDur = 0.001;
  var flashA = 0, flashColor = '#ffffff';
  var FX = {};

  FX.reset = function () { parts.length = 0; shakeAmp = 0; shakeT = 0; flashA = 0; };
  FX.spawn = function (x, y, opt) {
    if (parts.length >= MAX) parts.shift();
    parts.push({
      x: x, y: y, vx: opt.vx || 0, vy: opt.vy || 0,
      life: opt.life || 0.5, t: 0, size: opt.size || 3,
      color: opt.color || '#fff',
      drag: opt.drag == null ? 0.92 : opt.drag,
      grav: opt.grav || 0
    });
  };
  FX.burst = function (x, y, color, n, speed, rng) {
    for (var i = 0; i < n; i++) {
      var a = rng.angle(), s = rng.range(speed * 0.3, speed);
      FX.spawn(x, y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rng.range(0.25, 0.6), size: rng.range(2, 5), color: color
      });
    }
  };
  FX.shake = function (amp, dur) {
    shakeAmp = Math.max(shakeAmp, amp);
    shakeDur = dur || 0.3; shakeT = shakeDur;
  };
  FX.flash = function (color, a) {
    flashColor = color || '#fff';
    flashA = Math.max(flashA, a == null ? 0.25 : a);
  };
  FX.update = function (dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      var d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeAmp = 0; }
    if (flashA > 0) flashA = Math.max(0, flashA - dt * 2.2);
  };
  FX.offsetX = function (t) { return shakeAmp * (shakeT / shakeDur) * Math.sin(t * 91.7); };
  FX.offsetY = function (t) { return shakeAmp * (shakeT / shakeDur) * Math.cos(t * 113.3); };
  FX.draw = function (ctx) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = 1 - p.t / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      var s = p.size * k;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };
  FX.drawFlash = function (ctx, w, h) {
    if (flashA <= 0) return;
    ctx.globalAlpha = Math.min(1, flashA);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  };
  E.fx = FX;
})(window.Engine);
