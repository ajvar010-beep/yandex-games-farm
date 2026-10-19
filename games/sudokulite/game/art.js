/* game/art.js — процедурная графика «Судоку Лайт»: цифры, сетка, фон.
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

  /* ---------- фон: минималистичный ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // парящие цифры
    var rng = mulberry32(99);
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.font = '700 32px Georgia, serif';
    ctx.fillStyle = '#4ecdc4';
    for (var i = 0; i < 12; i++) {
      var x = rng() * w, y = (rng() * h + t * 8) % (h + 40) - 20;
      ctx.fillText(String(1 + Math.floor(rng() * 6)), x, y);
    }
    ctx.restore();
  };

  /* ---------- цвет цифры ---------- */
  function numColor(n) {
    var P = pal();
    var colors = [P.num1, P.num2, P.num3, P.num4, P.num5, P.num6];
    return colors[(n - 1) % colors.length];
  }

  /* ---------- клетка ---------- */
  // state: 'idle' | 'given' | 'sel' | 'hint' | 'error' | 'good'
  ART.drawCell = function (ctx, x, y, size, value, state, t) {
    var P = pal();
    ctx.save();

    // фон
    var bg = P.cell;
    if (state === 'given') bg = P.cellGiven;
    if (state === 'sel') bg = P.cellHot;
    if (state === 'error') bg = '#4a1a1a';
    if (state === 'good') bg = '#1a4a2a';
    if (state === 'hint') bg = P.cellHot;

    ctx.fillStyle = bg;
    ctx.beginPath();
    roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 4);
    ctx.fill();

    // рамка для выбранной/подсказки
    if (state === 'sel' || state === 'hint') {
      ctx.strokeStyle = state === 'sel' ? P.accent : P.good;
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 4);
      ctx.stroke();
    }

    // цифра
    if (value > 0) {
      var fs = size * 0.55;
      ctx.fillStyle = state === 'given' ? P.text : (state === 'error' ? P.bad : numColor(value));
      ctx.font = '700 ' + fs + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(value), x + size / 2, y + size / 2);
    }

    // пульсация подсказки
    if (state === 'hint') {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, x - 2, y - 2, size + 4, size + 4, 6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  /* ---------- промо-хук для pipeline/promo.html ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    if (kind === 'icon') {
      ART.drawIcon(ctx, w);
    } else {
      var lang = (typeof window !== 'undefined' && window.Engine && window.Engine.i18n && window.Engine.i18n.lang) || 'ru';
      ART.drawCover(ctx, w, h, title || 'Судоку Лайт',
        lang === 'ru' ? 'Заполните сетку цифрами' : 'Fill the grid with numbers', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // сетка 2×2 с цифрами
    var size = s * 0.32;
    var values = [1, 2, 3, 4];
    for (var i = 0; i < 4; i++) {
      var col = i % 2, row = Math.floor(i / 2);
      var x = s * 0.2 + col * (size + 8);
      var y = s * 0.2 + row * (size + 8);
      ART.drawCell(ctx, x, y, size, values[i], 'idle', 0);
    }
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);

    // сетка 6×6 с цифрами
    var cx = w / 2, cy = h * 0.4;
    var size = h * 0.08;
    var values = [
      [1, 2, 3, 4, 5, 6],
      [4, 5, 6, 1, 2, 3],
      [2, 1, 4, 3, 6, 5],
      [3, 6, 5, 2, 1, 4],
      [5, 4, 1, 6, 3, 2],
      [6, 3, 2, 5, 4, 1]
    ];
    for (var y = 0; y < 6; y++) {
      for (var x = 0; x < 6; x++) {
        var px = cx + (x - 2.5) * (size + 4) - size / 2;
        var py = cy + (y - 2.5) * (size + 4) - size / 2;
        var st = (x === 2 && y === 2) ? 'sel' : 'idle';
        ART.drawCell(ctx, px, py, size, values[y][x], st, 0);
      }
    }

    // заголовок
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var size = Math.round(h * 0.14);
    ctx.font = '800 ' + size + 'px system-ui, sans-serif';
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(13,17,23,0.95)'; ctx.lineJoin = 'round';
    ctx.strokeText(title, cx, h * 0.78);
    var tg = ctx.createLinearGradient(0, h * 0.78 - size / 2, 0, h * 0.78 + size / 2);
    tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, '#4ecdc4');
    ctx.fillStyle = tg; ctx.fillText(title, cx, h * 0.78);
    if (subtitle) {
      ctx.font = '600 ' + Math.round(h * 0.045) + 'px system-ui, sans-serif';
      ctx.fillStyle = '#8899aa';
      ctx.fillText(subtitle, cx, h * 0.78 + size * 0.7);
    }
  };
})(window.GAME);
