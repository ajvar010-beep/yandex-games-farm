/* game/art.js — процедурная арт-фабрика «Старфолла»: звёзды, метеориты, бонусы, комета.
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

  /* Звезда: пятилучевая с пульсом и бликом. */
  ART.drawStar = function (ctx, cx, cy, r, t, phase, color) {
    var k = 1 + Math.sin(t * 3 + phase) * 0.08;
    var rr = r * k;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(t * 1.4 + phase) * 0.25);
    // свечение
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = color || '#ffd43b';
    ctx.beginPath(); ctx.arc(0, 0, rr * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // лучи
    ctx.fillStyle = color || '#ffd43b';
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      var rad = (i % 2 === 0) ? rr : rr * 0.45;
      var x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    // ядро
    ctx.fillStyle = '#fff9db';
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Золотая звезда — крупнее, с дугой-ореолом. */
  ART.drawGold = function (ctx, cx, cy, r, t, phase) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 5 + phase);
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ART.drawStar(ctx, cx, cy, r * 1.12, t, phase, '#ffb300');
    ctx.restore();
  };

  /* Метеорит: шероховатый камень с трещиной и огненным хвостом. */
  ART.drawMeteor = function (ctx, cx, cy, r, t, phase) {
    ctx.save();
    // хвост
    var len = r * 2.6;
    var g = ctx.createLinearGradient(cx, cy - len, cx, cy);
    g.addColorStop(0, 'rgba(255,109,93,0)'); g.addColorStop(1, 'rgba(255,109,93,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.lineTo(cx, cy - len);
    ctx.closePath(); ctx.fill();
    // камень
    ctx.translate(cx, cy);
    var g2 = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
    g2.addColorStop(0, '#8a4a4a'); g2.addColorStop(1, '#4a2a30');
    ctx.fillStyle = g2;
    ctx.beginPath();
    var n = 9, wob = 0.16;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = r * (1 + Math.sin(phase + i * 2.4) * wob);
      var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,168,168,0.8)'; ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.stroke();
    // трещина
    ctx.strokeStyle = 'rgba(20,8,12,0.85)'; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.5); ctx.lineTo(-r * 0.05, -r * 0.1); ctx.lineTo(-r * 0.3, r * 0.4);
    ctx.stroke();
    // горящее зарево
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 7 + phase);
    ctx.fillStyle = '#ff8787';
    ctx.beginPath(); ctx.arc(r * 0.28, -r * 0.28, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Сердечко (жизнь). */
  ART.drawHeart = function (ctx, cx, cy, r, t, phase) {
    var k = 1 + Math.sin(t * 4 + phase) * 0.1;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff6b9d';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.75, -r * 1.1, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.75, -r * 1.1, r * 1.5, -r * 0.1, 0, r * 0.9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.3, r * 0.2, r * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Сверхновая: редкий дроп, яркая вспышка с кольцом и лучами. */
  ART.drawNova = function (ctx, cx, cy, r, t, phase) {
    var pulse = 1 + Math.sin(t * 4.5 + phase) * 0.12;
    ctx.save();
    ctx.translate(cx, cy);
    // кольцо-ореол
    ctx.globalAlpha = 0.4 + 0.25 * Math.sin(t * 5.5 + phase);
    ctx.strokeStyle = '#ffa8ff'; ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7 * pulse, 0, Math.PI * 2); ctx.stroke();
    // лучи
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffd6ff'; ctx.lineWidth = Math.max(2, r * 0.1); ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 + t * 0.9 + phase;
      var r1 = r * 1.05, r2 = r * (1.35 + 0.12 * Math.sin(t * 6 + i * 1.7));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // тело: светящийся шар
    var g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.08, 0, 0, r * pulse);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#ffc9ff'); g.addColorStop(1, '#c96bd8');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.stroke();
    // ядро-звёздочка
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Бонус-капсулы: slow (часы) и x2. */
  ART.drawBonus = function (ctx, kind, cx, cy, r, t, phase) {
    var col = kind === 'slow' ? '#74c0fc' : '#b197fc';
    var k = 1 + Math.sin(t * 2.6 + phase) * 0.07;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.globalAlpha = 0.3; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, r * 0.1); ctx.stroke();
    ctx.fillStyle = '#20244a';
    ctx.font = '800 ' + Math.round(r * 0.95) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'slow' ? '⏱' : '×2', 0, r * 0.06);
    ctx.restore();
  };

  /* Комета-корзина: чаша с хвостом-шлейфом. */
  ART.drawComet = function (ctx, cx, cy, w, h, t, invuln) {
    ctx.save();
    // шлейф
    for (var i = 0; i < 7; i++) {
      var p = i / 7;
      var xx = cx - Math.sin(t * 9 + i * 1.1) * w * 0.16 * p;
      var yy = cy + h * 0.6 + p * h * 2.1;
      ctx.globalAlpha = (1 - p) * 0.30;
      ctx.fillStyle = '#7df9ff';
      ctx.beginPath(); ctx.arc(xx, yy, (1 - p) * w * 0.2 + 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (invuln > 0) { // мерцание неуязвимости
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 30);
    }
    // тело чаши
    var g = ctx.createLinearGradient(cx, cy - h, cx, cy + h);
    g.addColorStop(0, '#e8fbff'); g.addColorStop(0.5, '#7df9ff'); g.addColorStop(1, '#3d9bd4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h * 0.2);
    ctx.quadraticCurveTo(cx - w * 0.42, cy + h * 0.9, cx, cy + h * 0.95);
    ctx.quadraticCurveTo(cx + w * 0.42, cy + h * 0.9, cx + w / 2, cy - h * 0.2);
    ctx.quadraticCurveTo(cx, cy - h * 0.75, cx - w / 2, cy - h * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(2, h * 0.09); ctx.stroke();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(cx - w * 0.16, cy - h * 0.05, w * 0.12, h * 0.34, -0.35, 0, Math.PI * 2); ctx.fill();
    // глаза-искорки
    ctx.fillStyle = '#13315c';
    ctx.beginPath(); ctx.arc(cx - w * 0.14, cy - h * 0.02, h * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + w * 0.14, cy - h * 0.02, h * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Промо-хук. */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    function stars(n) {
      for (var i = 0; i < n; i++) {
        ctx.globalAlpha = 0.2 + rng() * 0.55;
        ctx.fillStyle = '#cfe8ff';
        var s = 1 + rng() * 2;
        ctx.fillRect(rng() * w, rng() * h, s, s);
      }
      ctx.globalAlpha = 1;
    }
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#131a3f'); bg.addColorStop(1, '#0a0d24');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (kind === 'icon') {
      stars(46);
      ART.drawStar(ctx, w * 0.3, h * 0.24, 30, 1.2, 0);
      ART.drawStar(ctx, w * 0.76, h * 0.36, 22, 0.9, 2);
      ART.drawMeteor(ctx, w * 0.68, h * 0.2, 20, 1, 1);
      ART.drawGold(ctx, w * 0.42, h * 0.42, 26, 1.1, 3);
      ART.drawComet(ctx, w / 2, h * 0.62, 150, 46, 1.5, 0);
    } else {
      stars(70);
      ART.drawStar(ctx, w * 0.1, h * 0.2, 26, 1, 0);
      ART.drawGold(ctx, w * 0.24, h * 0.34, 30, 1.2, 1);
      ART.drawStar(ctx, w * 0.38, h * 0.18, 22, 0.8, 2);
      ART.drawMeteor(ctx, w * 0.86, h * 0.16, 24, 1, 3);
      ART.drawBonus(ctx, 'x2', w * 0.52, h * 0.3, 20, 1, 2);
      ART.drawNova(ctx, w * 0.62, h * 0.42, 22, 1.1, 4);
      ART.drawHeart(ctx, w * 0.72, h * 0.24, 20, 1, 1);
      ART.drawComet(ctx, w * 0.3, h * 0.66, 190, 56, 1.4, 0);
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 58;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.42) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(10,13,36,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.52, h * 0.68);
        var tg = ctx.createLinearGradient(0, h * 0.68 - size / 2, 0, h * 0.68 + size / 2);
        tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.52, h * 0.68);
      }
    }
  };

  G.art = ART;
})(window.GAME);
