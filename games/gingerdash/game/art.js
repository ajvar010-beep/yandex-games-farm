/* game/art.js — процедурная арт-фабрика «Рыжего Побега»: кот, ящики, рыбки, птицы.
   Ноль внешних ассетов. Standalone: ART.init имеет fallback window.Engine + mulberry32.
   ART.promo(ctx,w,h,kind,rng,title) — иконка/обложка из тех же примитивов (rng — голая
   mulberry32-ФУНКЦИЯ из promo.html, звать только rng()). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var ART = { ready: false };

  function ensureEngine() {
    if (window.Engine && window.Engine.Rng) return;
    window.Engine = window.Engine || {};
    function mulberry32(seed) {
      var a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function Rng(seed) { this.seed = (typeof seed === 'string' ? seedFromString(seed) : seed) >>> 0; this._next = mulberry32(this.seed); }
    function seedFromString(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    Rng.prototype.float = function () { return this._next(); };
    Rng.prototype.range = function (a, b) { return a + (b - a) * this._next(); };
    Rng.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
    Rng.prototype.pick = function (arr) { return arr[Math.floor(this._next() * arr.length) % arr.length]; };
    Rng.prototype.chance = function (p) { return this._next() < p; };
    Rng.prototype.angle = function () { return this._next() * Math.PI * 2; };
    window.Engine.Rng = Rng;
  }
  ART.init = function () { ensureEngine(); ART.ready = true; };

  /* Рыжий кот в прыжке/беге. s — размер (высота тела), air: 0=бежит,1=прыжок. */
  ART.drawCat = function (ctx, cx, cy, s, t, air) {
    ctx.save();
    ctx.translate(cx, cy);
    var wob = air ? 0 : Math.sin(t * 14) * 0.03;
    ctx.rotate(wob - 0.06);
    // хвост
    ctx.strokeStyle = '#e0721f'; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.95, -s * 0.45 + Math.sin(t * 5) * s * 0.08, -s * 0.72, -s * 0.72);
    ctx.stroke();
    // тело
    var g = ctx.createRadialGradient(-s * 0.05, -s * 0.18, s * 0.1, 0, 0, s * 0.75);
    g.addColorStop(0, '#ffb46b'); g.addColorStop(1, '#ff9436');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0721f'; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    // полоски
    ctx.strokeStyle = '#e0721f'; ctx.lineWidth = s * 0.06;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.28 + i * s * 0.22, -s * 0.36);
      ctx.lineTo(-s * 0.24 + i * s * 0.22, -s * 0.16);
      ctx.stroke();
    }
    // голова
    var hx = s * 0.5, hy = -s * 0.42;
    ctx.fillStyle = '#ffb46b';
    ctx.beginPath(); ctx.arc(hx, hy, s * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0721f'; ctx.lineWidth = s * 0.045;
    ctx.beginPath(); ctx.arc(hx, hy, s * 0.34, 0, Math.PI * 2); ctx.stroke();
    // уши
    ctx.fillStyle = '#ff9436';
    ctx.beginPath(); ctx.moveTo(hx - s * 0.26, hy - s * 0.2); ctx.lineTo(hx - s * 0.34, hy - s * 0.52); ctx.lineTo(hx - s * 0.06, hy - s * 0.34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + s * 0.26, hy - s * 0.2); ctx.lineTo(hx + s * 0.34, hy - s * 0.52); ctx.lineTo(hx + s * 0.06, hy - s * 0.34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd6ad';
    ctx.beginPath(); ctx.moveTo(hx - s * 0.24, hy - s * 0.26); ctx.lineTo(hx - s * 0.28, hy - s * 0.42); ctx.lineTo(hx - s * 0.12, hy - s * 0.32); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + s * 0.24, hy - s * 0.26); ctx.lineTo(hx + s * 0.28, hy - s * 0.42); ctx.lineTo(hx + s * 0.12, hy - s * 0.32); ctx.closePath(); ctx.fill();
    // глаза
    var blink = (Math.sin(t * 1.6) > 0.97) ? 0.12 : 1;
    ctx.fillStyle = '#3d2413';
    ctx.save(); ctx.translate(hx - s * 0.13, hy - s * 0.02); ctx.scale(1, blink);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.055, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(hx + s * 0.13, hy - s * 0.02); ctx.scale(1, blink);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.055, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // носик и усы
    ctx.fillStyle = '#e0721f';
    ctx.beginPath(); ctx.arc(hx, hy + s * 0.1, s * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(122,74,43,0.6)'; ctx.lineWidth = s * 0.025;
    for (var wu = -1; wu <= 1; wu++) {
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.12, hy + s * 0.1 + wu * s * 0.05);
      ctx.lineTo(hx - s * 0.4, hy + s * 0.06 + wu * s * 0.09);
      ctx.stroke();
    }
    // лапы (в беге — вразброд, в прыжке — поджаты)
    ctx.strokeStyle = '#e0721f'; ctx.lineWidth = s * 0.11; ctx.lineCap = 'round';
    if (air) {
      ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.3); ctx.lineTo(s * 0.34, s * 0.44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.3); ctx.lineTo(-s * 0.38, s * 0.4); ctx.stroke();
    } else {
      var ph = Math.sin(t * 14);
      ctx.beginPath(); ctx.moveTo(s * 0.14, s * 0.3); ctx.lineTo(s * 0.14 + ph * s * 0.3, s * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.3); ctx.lineTo(-s * 0.14 - ph * s * 0.3, s * 0.55); ctx.stroke();
    }
    ctx.restore();
  };

  /* Ящик-препятствие. */
  ART.drawBox = function (ctx, cx, cy, s, t) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(90,50,20,0.25)';
    ctx.fillRect(-s / 2 + 3, -s / 2 + 5, s, s);
    var g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
    g.addColorStop(0, '#c98f4e'); g.addColorStop(1, '#a9713a');
    ctx.fillStyle = g;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.35)';
    ctx.fillRect(-s / 2, -s / 2, s, s * 0.14);
    ctx.restore();
  };

  /* Лужа: скользкое препятствие вровень с землёй. */
  ART.drawPuddle = function (ctx, cx, cy, w, t) {
    ctx.save(); ctx.translate(cx, cy);
    var k = 1 + Math.sin(t * 3) * 0.04;
    ctx.scale(k, 1);
    var g = ctx.createRadialGradient(-w * 0.15, -3, 2, 0, 0, w * 0.6);
    g.addColorStop(0, '#a5d8ff'); g.addColorStop(1, '#74c0fc');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, w / 2, w * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4dabf7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, w / 2, w * 0.14, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(-w * 0.18, -w * 0.04, w * 0.1, w * 0.035, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Птица-препятствие на высоте головы. */
  ART.drawBird = function (ctx, cx, cy, s, t) {
    ctx.save(); ctx.translate(cx, cy);
    var flap = Math.sin(t * 16) * 0.5;
    // крылья
    ctx.strokeStyle = '#6a4bb8'; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.55, -s * (0.3 + flap * 0.3), -s * 0.6, -s * (0.5 + flap * 0.3));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.05);
    ctx.quadraticCurveTo(s * 0.55, -s * (0.3 + flap * 0.3), s * 0.6, -s * (0.5 + flap * 0.3));
    ctx.stroke();
    // тело
    var g = ctx.createRadialGradient(-s * 0.1, -s * 0.12, s * 0.08, 0, 0, s * 0.5);
    g.addColorStop(0, '#b197fc'); g.addColorStop(1, '#8a63d2');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6a4bb8'; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
    // клюв и глаз
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.06); ctx.lineTo(s * 0.6, 0); ctx.lineTo(s * 0.4, s * 0.06); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b1a3d';
    ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.12, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Рыбка-монета. */
  ART.drawFish = function (ctx, cx, cy, r, t, phase) {
    var bob = Math.sin(t * 3 + (phase || 0)) * r * 0.15;
    ctx.save(); ctx.translate(cx, cy + bob);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#4dabf7';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.08, 0, 0, r);
    g.addColorStop(0, '#c0ebff'); g.addColorStop(1, '#4dabf7');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    // хвост
    ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(-r * 1.4, -r * 0.5); ctx.lineTo(-r * 1.4, r * 0.5); ctx.closePath(); ctx.fill();
    // глаз и жабра
    ctx.fillStyle = '#1b3a5c';
    ctx.beginPath(); ctx.arc(r * 0.42, -r * 0.12, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(27,58,92,0.5)'; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.3, -0.9, 0.9); ctx.stroke();
    ctx.restore();
  };

  /* Золотая рыбка — редкий бонус высоко над трассой (двойной прыжок). */
  ART.drawGoldFish = function (ctx, cx, cy, r, t, phase) {
    var bob = Math.sin(t * 3 + (phase || 0)) * r * 0.15;
    var pulse = 0.85 + 0.15 * Math.sin(t * 5 + (phase || 0));
    ctx.save(); ctx.translate(cx, cy + bob);
    // сияние
    ctx.globalAlpha = 0.45 * pulse;
    var gl = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4);
    gl.addColorStop(0, '#fff3bf'); gl.addColorStop(0.6, 'rgba(255,212,59,0.5)'); gl.addColorStop(1, 'rgba(255,212,59,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // тело
    var g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.08, 0, 0, r);
    g.addColorStop(0, '#fff9db'); g.addColorStop(0.5, '#ffd43b'); g.addColorStop(1, '#f08c00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    // хвост
    ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(-r * 1.4, -r * 0.5); ctx.lineTo(-r * 1.4, r * 0.5); ctx.closePath(); ctx.fill();
    // чешуя-звёздочки
    ctx.fillStyle = '#fff9db';
    for (var i = 0; i < 3; i++) {
      var a = (i / 3) * Math.PI * 2 + t * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.28, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
    // глаз и жабра
    ctx.fillStyle = '#5c3700';
    ctx.beginPath(); ctx.arc(r * 0.42, -r * 0.12, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(92,55,0,0.6)'; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.3, -0.9, 0.9); ctx.stroke();
    ctx.restore();
  };

  /* Солнышко для фона. */
  ART.drawSun = function (ctx, cx, cy, r, t) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.1);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffb93e';
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(r * 1.35, 0, r * 0.24, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    var g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffe29e'); g.addColorStop(1, '#ffb93e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Промо-хук. rng — голая mulberry32-функция, звать только rng(). */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#ffe3ae'); bg.addColorStop(1, '#ffb93e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ART.drawSun(ctx, w * 0.84, h * 0.16, Math.min(w, h) * 0.07, 1);
    // земля
    ctx.fillStyle = '#b87333';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.fillStyle = '#7ab648';
    ctx.fillRect(0, h * 0.82, w, h * 0.035);
    // травяные колоски
    ctx.strokeStyle = '#5c9632'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (var i = 0; i < 24; i++) {
      var gx = rng() * w, gh = 6 + rng() * 10;
      ctx.beginPath(); ctx.moveTo(gx, h * 0.82); ctx.lineTo(gx + (rng() - 0.5) * 6, h * 0.82 - gh); ctx.stroke();
    }
    if (kind === 'icon') {
      ART.drawCat(ctx, w * 0.42, h * 0.56, w * 0.3, 1.2, 1);
      ART.drawFish(ctx, w * 0.76, h * 0.34, w * 0.055, 1, 0);
      ART.drawBox(ctx, w * 0.2, h * 0.76, w * 0.14, 1);
      ART.drawBird(ctx, w * 0.78, h * 0.72, w * 0.1, 1.1);
    } else {
      ART.drawCat(ctx, w * 0.3, h * 0.58, w * 0.26, 1.2, 1);
      ART.drawFish(ctx, w * 0.14, h * 0.36, w * 0.045, 1, 0);
      ART.drawGoldFish(ctx, w * 0.2, h * 0.2, w * 0.05, 1.1, 2);
      ART.drawBox(ctx, w * 0.52, h * 0.74, w * 0.11, 1);
      ART.drawBird(ctx, w * 0.68, h * 0.4, w * 0.08, 1.3);
      ART.drawPuddle(ctx, w * 0.12, h * 0.83, w * 0.14, 1);
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 58;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.42) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(90,50,20,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.52, h * 0.58);
        var tg = ctx.createLinearGradient(0, h * 0.58 - size / 2, 0, h * 0.58 + size / 2);
        tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.52, h * 0.58);
      }
    }
  };

  G.art = ART;
})(window.GAME);
