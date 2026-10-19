/* game/art.js — процедурная графика «Слияния 2048»: плитки с цифрами,
   фон-галактика, промо. Standalone: window.GAME.art. */

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

  /* ---------- фон: галактика ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // звёзды
    var rng = mulberry32(42);
    ctx.save();
    ctx.fillStyle = '#fff';
    for (var i = 0; i < 60; i++) {
      var x = rng() * w, y = rng() * h;
      var r = rng() * 1.5 + 0.5;
      var tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.globalAlpha = 0.1 + 0.2 * tw;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- цвет плитки по значению ---------- */
  function tileColor(v) {
    var P = pal();
    var map = {
      2: P.tile2, 4: P.tile4, 8: P.tile8, 16: P.tile16, 32: P.tile32,
      64: P.tile64, 128: P.tile128, 256: P.tile256, 512: P.tile512,
      1024: P.tile1024, 2048: P.tile2048
    };
    return map[v] || P.tile2048;
  }

  /* ---------- плитка ---------- */
  // state: 'idle' | 'new' | 'merged' | 'hint'
  ART.drawTile = function (ctx, x, y, size, value, state, t) {
    if (value === 0) return;
    var P = pal();
    var scale = 1;
    if (state === 'new') scale = 0.5 + 0.5 * Math.min(1, t * 5);
    if (state === 'merged') scale = 1 + 0.3 * Math.sin(t * 10);

    var s = size * scale;
    var cx = x + size / 2, cy = y + size / 2;
    var rx = cx - s / 2, ry = cy - s / 2;

    ctx.save();

    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    roundRect(ctx, rx + 2, ry + 2, s, s, 8);
    ctx.fill();

    // тело
    var grad = ctx.createLinearGradient(rx, ry, rx + s, ry + s);
    var color = tileColor(value);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shadeColor(color, -20));
    ctx.fillStyle = grad;
    ctx.beginPath();
    roundRect(ctx, rx, ry, s, s, 8);
    ctx.fill();

    // рамка
    ctx.lineWidth = 2;
    ctx.strokeStyle = state === 'hint' ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    roundRect(ctx, rx + 1, ry + 1, s - 2, s - 2, 7);
    ctx.stroke();

    // блик
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(rx + s * 0.3, ry + s * 0.25, s * 0.2, s * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // цифра
    var fs = s * (value < 10 ? 0.5 : value < 100 ? 0.4 : value < 1000 ? 0.32 : 0.26);
    ctx.fillStyle = value <= 4 ? '#776e65' : '#f9f6f2';
    ctx.font = '700 ' + fs + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(value), cx, cy);

    // пульсация подсказки
    if (state === 'hint') {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, rx - 3, ry - 3, s + 6, s + 6, 10);
      ctx.stroke();
      ctx.globalAlpha = 1;
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
      ART.drawCover(ctx, w, h, title || 'Слияние 2048',
        lang === 'ru' ? 'Соединяйте плитки до 2048' : 'Merge tiles to reach 2048', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.7);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // плитка 2048 в центре
    var size = s * 0.5;
    ART.drawTile(ctx, s / 2 - size / 2, s / 2 - size / 2, size, 2048, 'idle', 0);

    // мелкие плитки вокруг
    var small = s * 0.18;
    ART.drawTile(ctx, s * 0.15, s * 0.2, small, 2, 'idle', 0);
    ART.drawTile(ctx, s * 0.7, s * 0.15, small, 4, 'idle', 0);
    ART.drawTile(ctx, s * 0.75, s * 0.65, small, 8, 'idle', 0);
    ART.drawTile(ctx, s * 0.1, s * 0.7, small, 16, 'idle', 0);
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);

    // сетка плиток 3×3
    var cx = w / 2, cy = h * 0.4;
    var size = h * 0.16;
    var values = [2, 4, 8, 16, 32, 64, 128, 256, 2048];
    for (var i = 0; i < 9; i++) {
      var col = i % 3, row = Math.floor(i / 3);
      var x = cx + (col - 1) * (size + 8) - size / 2;
      var y = cy + (row - 1) * (size + 8) - size / 2;
      ART.drawTile(ctx, x, y, size, values[i], i === 8 ? 'merged' : 'idle', i * 0.3);
    }

    // заголовок
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var size = Math.round(h * 0.14);
    ctx.font = '800 ' + size + 'px system-ui, sans-serif';
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(15,12,29,0.95)'; ctx.lineJoin = 'round';
    ctx.strokeText(title, cx, h * 0.78);
    var tg = ctx.createLinearGradient(0, h * 0.78 - size / 2, 0, h * 0.78 + size / 2);
    tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, '#d4a94e');
    ctx.fillStyle = tg; ctx.fillText(title, cx, h * 0.78);
    if (subtitle) {
      ctx.font = '600 ' + Math.round(h * 0.045) + 'px system-ui, sans-serif';
      ctx.fillStyle = '#b8a88a';
      ctx.fillText(subtitle, cx, h * 0.78 + size * 0.7);
    }
  };
})(window.GAME);
