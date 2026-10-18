/* game/art.js — процедурная арт-фабрика «Сладкой Башни»: слои торта, крем, вишенка.
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

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Один слой торта: бисквит + глазурь сверху + посыпка. variant 0..2 меняет вкус. */
  ART.drawLayer = function (ctx, cx, cy, w, h, variant, t) {
    t = t || 0;
    var tastes = [
      { cake: '#f2c14e', cakeDark: '#d9a437', glaze: '#ff8fb3', glazeDark: '#e56b93' },
      { cake: '#e8b06a', cakeDark: '#c99452', glaze: '#7a4a2b', glazeDark: '#5d3720' },
      { cake: '#ffe9b8', cakeDark: '#efd194', glaze: '#9fe8c1', glazeDark: '#6fd0a0' }
    ];
    var C = tastes[variant % 3];
    ctx.save();
    ctx.translate(cx, cy);
    var x = -w / 2, y = -h / 2;
    // мягкая тень
    ctx.fillStyle = 'rgba(20,8,30,0.35)';
    roundRect(ctx, x + 3, y + 5, w, h, h * 0.18); ctx.fill();
    // бисквит
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, C.cake); g.addColorStop(1, C.cakeDark);
    ctx.fillStyle = g;
    roundRect(ctx, x, y + h * 0.24, w, h * 0.76, h * 0.14); ctx.fill();
    // глазурь с потёками
    var gg = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    gg.addColorStop(0, C.glaze); gg.addColorStop(1, C.glazeDark);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.3);
    var drips = 7;
    for (var i = 0; i <= drips; i++) {
      var dx = x + (w / drips) * i;
      var dd = h * (0.3 + 0.22 * Math.abs(Math.sin(i * 2.7 + variant * 1.3)));
      ctx.quadraticCurveTo(dx - w / drips / 2, y + dd, dx, y + h * 0.24);
    }
    ctx.lineTo(x + w, y); ctx.lineTo(x, y);
    ctx.closePath(); ctx.fill();
    // верхняя кромка глазури
    ctx.fillStyle = C.glaze;
    roundRect(ctx, x, y, w, h * 0.26, h * 0.13); ctx.fill();
    // посыпка
    var sprinkles = ['#fff3d6', '#ff5d73', '#74c0fc', '#ffd43b', '#c74b71'];
    for (var s = 0; s < 12; s++) {
      var px = x + ((s * 37 + variant * 53) % 100) / 100 * (w - 8) + 4;
      var py = y + 3 + ((s * 61 + variant * 29) % 100) / 100 * (h * 0.16);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((s * 0.7 + variant) % 3.14);
      ctx.fillStyle = sprinkles[(s + variant) % sprinkles.length];
      roundRect(ctx, -2.4, -0.9, 4.8, 1.8, 0.9); ctx.fill();
      ctx.restore();
    }
    // блик на глазури
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.22, y + h * 0.08, w * 0.14, h * 0.045, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* Вишенка-маскот с лицом — сидит на вершине башни. */
  ART.drawCherry = function (ctx, cx, cy, r, t) {
    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 2.4) * r * 0.08);
    // свечение
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#ff5d73';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // черенок
    ctx.strokeStyle = '#4a8f3f'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.quadraticCurveTo(r * 0.25, -r * 1.35, r * 0.55, -r * 1.5); ctx.stroke();
    // листик
    ctx.fillStyle = '#5fb054';
    ctx.beginPath(); ctx.ellipse(r * 0.34, -r * 1.28, r * 0.28, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
    // ягода
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ff8a9a'); g.addColorStop(0.6, '#ff5d73'); g.addColorStop(1, '#d93a55');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b02c44'; ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2); ctx.stroke();
    // глаза
    var blink = (Math.sin(t * 1.7) > 0.96) ? 0.15 : 1;
    ctx.fillStyle = '#3d1c26';
    ctx.save(); ctx.translate(-r * 0.32, -r * 0.1); ctx.scale(1, blink);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(r * 0.32, -r * 0.1); ctx.scale(1, blink);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (blink > 0.5) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.16, r * 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.28, -r * 0.16, r * 0.045, 0, Math.PI * 2); ctx.fill();
    }
    // румянец
    ctx.fillStyle = 'rgba(255,150,170,0.7)';
    ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.14, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.55, r * 0.14, r * 0.12, 0, Math.PI * 2); ctx.fill();
    // улыбка
    ctx.strokeStyle = '#3d1c26'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.22, 0.4, Math.PI - 0.4); ctx.stroke();
    ctx.restore();
  };

  /* Звёздный слой — редкий золотой бисквит со звёздной посыпкой (×15 очков). */
  ART.drawStarLayer = function (ctx, cx, cy, w, h, t) {
    t = t || 0;
    ctx.save();
    ctx.translate(cx, cy);
    var x = -w / 2, y = -h / 2;
    // золотое свечение
    ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 5);
    ctx.fillStyle = '#ffd43b';
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, h * 0.24); ctx.fill();
    ctx.globalAlpha = 1;
    // тень
    ctx.fillStyle = 'rgba(20,8,30,0.35)';
    roundRect(ctx, x + 3, y + 5, w, h, h * 0.18); ctx.fill();
    // золотой бисквит
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#f0b429');
    ctx.fillStyle = g;
    roundRect(ctx, x, y + h * 0.24, w, h * 0.76, h * 0.14); ctx.fill();
    // карамельная глазурь с потёками
    var gg = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    gg.addColorStop(0, '#ffb340'); gg.addColorStop(1, '#e8890c');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.3);
    var drips = 7;
    for (var i = 0; i <= drips; i++) {
      var dx = x + (w / drips) * i;
      var dd = h * (0.3 + 0.22 * Math.abs(Math.sin(i * 2.7 + 4.2)));
      ctx.quadraticCurveTo(dx - w / drips / 2, y + dd, dx, y + h * 0.24);
    }
    ctx.lineTo(x + w, y); ctx.lineTo(x, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb340';
    roundRect(ctx, x, y, w, h * 0.26, h * 0.13); ctx.fill();
    // звёздочки-посыпка
    ctx.fillStyle = '#fff9db';
    for (var s = 0; s < 7; s++) {
      var px = x + ((s * 41 + 17) % 100) / 100 * (w - 10) + 5;
      var py = y + 2 + ((s * 53 + 31) % 100) / 100 * (h * 0.18);
      var sr = 2.6, pr = sr * 0.45;
      ctx.beginPath();
      for (var p = 0; p < 10; p++) {
        var a = (p / 10) * Math.PI * 2 - Math.PI / 2;
        var rr = p % 2 ? pr : sr;
        ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    }
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.22, y + h * 0.08, w * 0.14, h * 0.045, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* Звёздная блёстка — валюта. */
  ART.drawSpark = function (ctx, cx, cy, r, t, phase) {
    var k = 1 + Math.sin(t * 3 + (phase || 0)) * 0.12;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate(t * 0.6);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      var rr = i % 2 ? r * 0.42 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3bf';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Падающий сердечко-клубничка (доп. очки). */
  ART.drawBerry = function (ctx, cx, cy, r, t) {
    ctx.save(); ctx.translate(cx, cy + Math.sin(t * 3) * r * 0.1);
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#ff8fb3';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.08, 0, 0, r);
    g.addColorStop(0, '#ffb0c4'); g.addColorStop(1, '#c74b71');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(-r * 1.4, r * 0.1, -r * 0.8, -r, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.8, -r, r * 1.4, r * 0.1, 0, r);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (var i = 0; i < 5; i++) {
      var a = -1.9 + i * 0.75;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.42 + r * 0.18, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* Облако-крем для фона меню. */
  ART.drawCreamCloud = function (ctx, cx, cy, s, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 0.5 : alpha;
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(cx - s * 0.5, cy + s * 0.08, s * 0.42, 0, Math.PI * 2);
    ctx.arc(cx, cy - s * 0.14, s * 0.52, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.5, cy + s * 0.08, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* Промо-хук. rng — голая mulberry32-функция, звать только rng(). */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#ffd9ec'); bg.addColorStop(0.55, '#d99ec9'); bg.addColorStop(1, '#4a2a63');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < (kind === 'icon' ? 3 : 5); i++) {
      ART.drawCreamCloud(ctx, rng() * w, rng() * h * 0.8, 40 + rng() * 60, 0.25 + rng() * 0.3);
    }
    // башня из слоёв
    function tower(cx, baseY, layerW, layerH, n) {
      for (var i = 0; i < n; i++) {
        var ww = layerW * (1 - i * 0.055);
        var x = cx + Math.sin(i * 1.9) * layerW * 0.035;
        ART.drawLayer(ctx, x, baseY - i * layerH * 0.94, ww, layerH, i % 3, i);
      }
      return baseY - (n - 1) * layerH * 0.94;
    }
    if (kind === 'icon') {
      var top = tower(w / 2, h * 0.86, w * 0.6, h * 0.15, 4);
      ART.drawCherry(ctx, w / 2, top - h * 0.13, w * 0.11, 1.3);
      ART.drawSpark(ctx, w * 0.2, h * 0.22, w * 0.045, 1, 0);
      ART.drawSpark(ctx, w * 0.82, h * 0.34, w * 0.035, 1.2, 2);
    } else {
      var topY = tower(w * 0.3, h * 0.92, w * 0.4, h * 0.13, 5);
      ART.drawStarLayer(ctx, w * 0.3 + 6, topY - h * 0.115, w * 0.24, h * 0.13, 1.2);
      ART.drawCherry(ctx, w * 0.3, topY - h * 0.24, w * 0.062, 1.4);
      ART.drawBerry(ctx, w * 0.12, h * 0.3, w * 0.035, 1);
      ART.drawSpark(ctx, w * 0.52, h * 0.2, w * 0.03, 1.1, 1);
      ART.drawSpark(ctx, w * 0.08, h * 0.6, w * 0.026, 0.9, 3);
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 56;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.42) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(43,26,61,0.92)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.5, h * 0.62);
        var tg = ctx.createLinearGradient(0, h * 0.62 - size / 2, 0, h * 0.62 + size / 2);
        tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.5, h * 0.62);
      }
    }
  };

  G.art = ART;
})(window.GAME);
