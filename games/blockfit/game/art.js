/* game/art.js — процедурная графика «Блок-Фита»: блоки с глянцем,
   фон-космос, промо. Standalone: window.GAME.art. */

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

  /* ---------- фон: космос ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // звёзды
    var rng = mulberry32(77);
    ctx.save();
    ctx.fillStyle = '#fff';
    for (var i = 0; i < 50; i++) {
      var x = rng() * w, y = rng() * h;
      var r = rng() * 1.5 + 0.5;
      var tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.globalAlpha = 0.08 + 0.15 * tw;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- цвет блока по id ---------- */
  function blockColor(id) {
    var P = pal();
    var colors = [P.c1, P.c2, P.c3, P.c4, P.c5, P.c6, P.c7, P.c8];
    return colors[(id - 1) % colors.length];
  }

  /* ---------- блок ---------- */
  // state: 'idle' | 'ghost' | 'hint' | 'clear'
  ART.drawBlock = function (ctx, x, y, size, colorId, state, t) {
    var P = pal();
    var color = blockColor(colorId);
    var alpha = 1;
    if (state === 'ghost') alpha = 0.4;
    if (state === 'hint') alpha = 0.6 + 0.3 * Math.sin(t * 8);

    ctx.save();
    ctx.globalAlpha = alpha;

    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    roundRect(ctx, x + 2, y + 2, size, size, 4);
    ctx.fill();

    // тело
    var grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shadeColor(color, -25));
    ctx.fillStyle = grad;
    ctx.beginPath();
    roundRect(ctx, x, y, size, size, 4);
    ctx.fill();

    // рамка
    ctx.lineWidth = 2;
    ctx.strokeStyle = state === 'hint' ? '#fff' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 3);
    ctx.stroke();

    // блик
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x + size * 0.3, y + size * 0.25, size * 0.2, size * 0.12, -0.5, 0, Math.PI * 2);
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

  /* ---------- фигура на панели ---------- */
  ART.drawShape = function (ctx, x, y, cellSize, shape, colorId, state, t) {
    for (var i = 0; i < shape.cells.length; i++) {
      var cx = x + shape.cells[i][0] * cellSize;
      var cy = y + shape.cells[i][1] * cellSize;
      ART.drawBlock(ctx, cx, cy, cellSize, colorId, state, t);
    }
  };

  /* ---------- промо-хук для pipeline/promo.html ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    if (kind === 'icon') {
      ART.drawIcon(ctx, w);
    } else {
      var lang = (typeof window !== 'undefined' && window.Engine && window.Engine.i18n && window.Engine.i18n.lang) || 'ru';
      ART.drawCover(ctx, w, h, title || 'Блок-Фит',
        lang === 'ru' ? 'Размещайте фигуры и очищайте линии' : 'Place shapes and clear lines', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.7);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // сетка 3×3 с разноцветными блоками
    var size = s * 0.2;
    var colors = [1, 2, 3, 4, 5, 6, 7, 8, 2];
    for (var i = 0; i < 9; i++) {
      var col = i % 3, row = Math.floor(i / 3);
      var x = s * 0.25 + col * (size + 6);
      var y = s * 0.25 + row * (size + 6);
      ART.drawBlock(ctx, x, y, size, colors[i], 'idle', 0);
    }
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);

    // сетка 4×4 с фигурами
    var cx = w / 2, cy = h * 0.4;
    var cellSize = h * 0.1;
    var shapes = [
      { cells: [[0,0],[1,0],[0,1],[1,1]], color: 2 }, // O
      { cells: [[0,0],[1,0],[2,0],[1,1]], color: 3 }, // T
      { cells: [[0,0],[0,1],[0,2],[1,2]], color: 1 }, // L
      { cells: [[1,0],[2,0],[0,1],[1,1]], color: 5 }, // S
      { cells: [[0,0],[1,0],[1,1],[1,2]], color: 6 }, // J
      { cells: [[0,0],[1,0],[2,0],[0,1]], color: 7 }  // T2
    ];
    for (var i = 0; i < 6; i++) {
      var col = i % 3, row = Math.floor(i / 3);
      var x = cx + (col - 1) * (cellSize * 3.5) - cellSize;
      var y = cy + (row - 1) * (cellSize * 3.5) - cellSize;
      ART.drawShape(ctx, x, y, cellSize, shapes[i], shapes[i].color, 'idle', i * 0.3);
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
