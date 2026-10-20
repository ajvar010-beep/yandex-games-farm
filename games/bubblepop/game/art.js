/* game/art.js — процедурная графика «Шарового Залпа»: шарики, фон, маскот, промо.
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

  // Полифилл roundRect для контекстов без engine/ui.js (promo.html)
  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- фон: подводный мир ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // пузыри на фоне
    var rng = mulberry32(77);
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#a8d8ea';
    for (var i = 0; i < 20; i++) {
      var x = rng() * w, y = (rng() * h + t * 20) % (h + 40) - 20;
      var r = 2 + rng() * 6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // световые блики
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
  };

  /* ---------- шарик ---------- */
  // state: 'idle' | 'flying' | 'popped' | 'hint'
  ART.drawBubble = function (ctx, x, y, size, colorId, state, t) {
    var P = pal();
    var colors = [P.bubble1, P.bubble2, P.bubble3, P.bubble4, P.bubble5, P.bubble6];
    // colorId 0 = rainbow — серебристый
    var color = colorId === 0 ? '#e0e0e0' : colors[(colorId - 1) % colors.length];

    ctx.save();
    ctx.translate(x, y);

    var scale = 1;
    if (state === 'popped') scale = 1.2;
    if (state === 'flying') scale = 1 + 0.1 * Math.sin(t * 10);
    ctx.scale(scale, scale);

    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(2, 2, size, 0, Math.PI * 2);
    ctx.fill();

    // тело: радиальный градиент
    var grad = ctx.createRadialGradient(-size * 0.3, -size * 0.3, size * 0.1, 0, 0, size);
    grad.addColorStop(0, shadeColor(color, 30));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, shadeColor(color, -30));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // блик
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.3, size * 0.25, size * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // пульсация подсказки
    if (state === 'hint') {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  /* ---------- маскот: осьминог ---------- */
  ART.drawMascot = function (ctx, x, y, size, t, mood) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);

    // тело
    var grad = ctx.createRadialGradient(0, -size * 0.2, size * 0.1, 0, 0, size);
    grad.addColorStop(0, '#ff9e9e');
    grad.addColorStop(1, '#c84a4a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // глаза
    var eyeY = -size * 0.2;
    var eyeSize = size * 0.15;
    var blink = (Math.sin(t * 3) > 0.9) ? 0.3 : 1; // моргание
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-size * 0.25, eyeY, eyeSize, eyeSize * blink, 0, 0, Math.PI * 2);
    ctx.ellipse(size * 0.25, eyeY, eyeSize, eyeSize * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    var pupilSize = eyeSize * 0.5 * blink;
    ctx.beginPath();
    ctx.arc(-size * 0.25, eyeY, pupilSize, 0, Math.PI * 2);
    ctx.arc(size * 0.25, eyeY, pupilSize, 0, Math.PI * 2);
    ctx.fill();

    // рот
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'happy') {
      ctx.arc(0, size * 0.1, size * 0.3, 0.2, Math.PI - 0.2);
    } else if (mood === 'sad') {
      ctx.arc(0, size * 0.3, size * 0.3, Math.PI + 0.2, Math.PI * 2 - 0.2);
    } else {
      ctx.moveTo(-size * 0.2, size * 0.15);
      ctx.lineTo(size * 0.2, size * 0.15);
    }
    ctx.stroke();

    // щупальца
    ctx.strokeStyle = shadeColor('#c84a4a', -20);
    ctx.lineWidth = size * 0.08;
    for (var i = 0; i < 6; i++) {
      var angle = (i / 6) * Math.PI - Math.PI / 2;
      var wave = Math.sin(t * 4 + i) * 0.2;
      var sx = Math.cos(angle) * size * 0.7;
      var sy = Math.sin(angle) * size * 0.7 + size * 0.5;
      var ex = Math.cos(angle + wave) * size * 1.2;
      var ey = Math.sin(angle + wave) * size * 1.2 + size * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 + wave * size, ex, ey);
      ctx.stroke();
    }

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
      ART.drawCover(ctx, w, h, title || 'Шаровой Залп',
        lang === 'ru' ? 'Стреляйте шариками и очищайте потолок' : 'Shoot bubbles and clear the ceiling', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.7);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // шарики
    var size = s * 0.25;
    ART.drawBubble(ctx, s * 0.35, s * 0.4, size, 1, 'idle', 0);
    ART.drawBubble(ctx, s * 0.65, s * 0.4, size, 2, 'idle', 0);
    ART.drawBubble(ctx, s * 0.5, s * 0.6, size, 3, 'idle', 0);

    // маскот
    ART.drawMascot(ctx, s * 0.5, s * 0.75, s * 0.15, 0, 'happy');
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);

    // шарики на потолке
    var cellSize = h * 0.08;
    var offsetX = w / 2 - 5 * cellSize;
    var offsetY = h * 0.15;
    var colors = [1, 2, 3, 1, 2, 3, 2, 3, 1, 2];
    for (var i = 0; i < 10; i++) {
      var x = offsetX + i * cellSize;
      var y = offsetY + Math.sin(i * 0.5) * cellSize * 0.2;
      ART.drawBubble(ctx, x, y, cellSize * 0.45, colors[i], 'idle', 0);
    }

    // шарик в полёте
    ART.drawBubble(ctx, w / 2, h * 0.5, cellSize * 0.5, 1, 'flying', 0);

    // маскот
    ART.drawMascot(ctx, w * 0.15, h * 0.6, h * 0.12, 0, 'happy');

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
