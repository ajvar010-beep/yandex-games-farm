/* game/art.js — процедурная графика «Рыбного Пруда»: рыбки, пузыри, вода.
   Standalone: window.GAME.art. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ensureEngine() {
    if (!window.Engine) window.Engine = {};
    var E = window.Engine;
    if (!E.rng) E.rng = { mulberry32: mulberry32 };
    return E;
  }
  var ART = G.art = {};
  ART.init = function () { ensureEngine(); };
  function pal() { return G.config.palette; }

  /* ---------- фон: вода ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.water); g.addColorStop(1, P.waterDeep);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // световые блики на поверхности
    ctx.save();
    ctx.globalAlpha = 0.05 + 0.03 * Math.sin(t * 2);
    ctx.fillStyle = '#fff';
    for (var i = 0; i < 5; i++) {
      var x = (w * 0.2 * i) + Math.sin(t * 0.5 + i) * 30;
      var y = h * 0.1 + Math.sin(t * 0.3 + i) * 10;
      ctx.beginPath();
      ctx.ellipse(x, y, 40, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // водоросли на дне
    var rng = mulberry32(33);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 3;
    for (var i = 0; i < 8; i++) {
      var x = (w / 8) * i + rng() * 20;
      var sway = Math.sin(t * 2 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + sway, h - 20, x + sway * 0.5, h - 40 - rng() * 30);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- рыбка ---------- */
  ART.drawFish = function (ctx, x, y, size, colorId, dir, t) {
    var P = pal();
    var colors = [P.fish1, P.fish2, P.fish3, P.fish4, P.fish5];
    var color = colors[(colorId - 1) % colors.length];

    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);

    // тело
    var grad = ctx.createRadialGradient(-size * 0.2, -size * 0.1, size * 0.1, 0, 0, size * 0.7);
    grad.addColorStop(0, shadeColor(color, 20));
    grad.addColorStop(1, shadeColor(color, -20));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.6, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // хвост
    var tailWag = Math.sin(t * 8) * 0.3;
    ctx.fillStyle = shadeColor(color, -30);
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, 0);
    ctx.quadraticCurveTo(-size * 0.8, -size * 0.2 + tailWag * size, -size * 0.7, -size * 0.4);
    ctx.quadraticCurveTo(-size * 0.9, -size * 0.2, -size * 0.8, 0);
    ctx.quadraticCurveTo(-size * 0.9, size * 0.2, -size * 0.7, size * 0.4);
    ctx.quadraticCurveTo(-size * 0.8, size * 0.2 + tailWag * size, -size * 0.5, 0);
    ctx.fill();

    // плавник
    ctx.fillStyle = shadeColor(color, -10);
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.25);
    ctx.quadraticCurveTo(size * 0.1, -size * 0.45, size * 0.2, -size * 0.3);
    ctx.quadraticCurveTo(size * 0.1, -size * 0.15, -size * 0.1, -size * 0.25);
    ctx.fill();

    // глаз
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(size * 0.3, -size * 0.05, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(size * 0.32, -size * 0.05, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  /* ---------- пузырь ---------- */
  ART.drawBubble = function (ctx, x, y, size, t) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    var grad = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.7, 'rgba(168,216,234,0.3)');
    grad.addColorStop(1, 'rgba(168,216,234,0.1)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  function shadeColor(color, percent) {
    var num = parseInt(color.replace('#', ''), 16);
    var amt = Math.round(2.55 * percent);
    var R = Math.min(255, Math.max(0, (num >> 16) + amt));
    var G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
    var B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /* ---------- промо-хук для pipeline/promo.html ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    if (kind === 'icon') {
      ART.drawIcon(ctx, w);
    } else {
      var lang = (typeof window !== 'undefined' && window.Engine && window.Engine.i18n && window.Engine.i18n.lang) || 'ru';
      ART.drawCover(ctx, w, h, title || 'Рыбный Пруд',
        lang === 'ru' ? 'Ловите рыбок и пузыри' : 'Catch fish and bubbles', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, P.water); g.addColorStop(1, P.waterDeep);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // рыбка в центре
    ART.drawFish(ctx, s / 2, s / 2, s * 0.4, 2, 1, 0);

    // пузыри
    ART.drawBubble(ctx, s * 0.3, s * 0.3, s * 0.06, 0);
    ART.drawBubble(ctx, s * 0.7, s * 0.4, s * 0.04, 0);
    ART.drawBubble(ctx, s * 0.5, s * 0.2, s * 0.05, 0);
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);

    // рыбки
    var fishes = [
      { x: w * 0.3, y: h * 0.3, size: h * 0.15, color: 1, dir: 1 },
      { x: w * 0.6, y: h * 0.4, size: h * 0.12, color: 2, dir: -1 },
      { x: w * 0.5, y: h * 0.5, size: h * 0.18, color: 3, dir: 1 }
    ];
    for (var i = 0; i < fishes.length; i++) {
      var f = fishes[i];
      ART.drawFish(ctx, f.x, f.y, f.size, f.color, f.dir, i * 0.5);
    }

    // пузыри
    for (var i = 0; i < 8; i++) {
      var x = w * 0.1 + (w * 0.8) * (i / 8);
      var y = h * 0.2 + Math.sin(i * 2) * h * 0.1;
      ART.drawBubble(ctx, x, y, h * 0.02 + (i % 3) * h * 0.01, 0);
    }

    // заголовок
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var size = Math.round(h * 0.14);
    ctx.font = '800 ' + size + 'px system-ui, sans-serif';
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(10,26,42,0.95)'; ctx.lineJoin = 'round';
    ctx.strokeText(title, w / 2, h * 0.78);
    var tg = ctx.createLinearGradient(0, h * 0.78 - size / 2, 0, h * 0.78 + size / 2);
    tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, '#4ecdc4');
    ctx.fillStyle = tg; ctx.fillText(title, w / 2, h * 0.78);
    if (subtitle) {
      ctx.font = '600 ' + Math.round(h * 0.045) + 'px system-ui, sans-serif';
      ctx.fillStyle = '#8899aa';
      ctx.fillText(subtitle, w / 2, h * 0.78 + size * 0.7);
    }
  };
})(window.GAME);
