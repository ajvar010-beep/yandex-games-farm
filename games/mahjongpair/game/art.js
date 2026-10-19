/* game/art.js — процедурная графика «Парного Маджонга»: плитки с бамбуковой
   текстурой, фон-сад с драконом, промо. Standalone: window.GAME.art. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

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

  /* ---------- фон: сад с драконом ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // парящие лепестки
    var rng = mulberry32(13);
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#d4a94e';
    for (var i = 0; i < 18; i++) {
      var x = rng() * w, y = (rng() * h + t * 15) % (h + 30) - 15;
      var r = 2 + rng() * 4;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r * 0.8, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // силуэт дракона в углу
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#d4a94e';
    var dx = w * 0.85, dy = h * 0.15, s = Math.min(w, h) * 0.2;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.quadraticCurveTo(dx + s * 0.5, dy - s * 0.3, dx + s, dy);
    ctx.quadraticCurveTo(dx + s * 0.5, dy + s * 0.2, dx + s * 0.3, dy + s * 0.5);
    ctx.quadraticCurveTo(dx + s * 0.1, dy + s * 0.8, dx, dy + s);
    ctx.quadraticCurveTo(dx - s * 0.2, dy + s * 0.6, dx - s * 0.1, dy + s * 0.2);
    ctx.quadraticCurveTo(dx - s * 0.05, dy - s * 0.1, dx, dy);
    ctx.fill();
    ctx.restore();
  };

  /* ---------- плитка маджонга ---------- */
  // state: 'idle' | 'sel' | 'hint' | 'blocked' | 'removed'
  ART.drawTile = function (ctx, x, y, w, h, type, state, t) {
    var P = pal();
    if (state === 'removed') return;

    ctx.save();
    ctx.translate(x, y);

    // тень
    if (state !== 'removed') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      roundRect(ctx, 3, 3, w, h, 6);
      ctx.fill();
    }

    // тело
    var grad = ctx.createLinearGradient(0, 0, w, h);
    if (state === 'sel') {
      grad.addColorStop(0, '#ffe9a8'); grad.addColorStop(1, '#e8b84a');
    } else if (state === 'hint') {
      grad.addColorStop(0, '#b8f0c8'); grad.addColorStop(1, '#6dd98a');
    } else if (state === 'blocked') {
      grad.addColorStop(0, '#c8b898'); grad.addColorStop(1, '#a89878');
    } else {
      grad.addColorStop(0, P.tile); grad.addColorStop(1, P.tileDark);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    roundRect(ctx, 0, 0, w, h, 6);
    ctx.fill();

    // рамка
    ctx.lineWidth = 2;
    ctx.strokeStyle = state === 'sel' ? '#fff3c4' : (state === 'hint' ? '#fff' : P.tileEdge);
    ctx.beginPath();
    roundRect(ctx, 1, 1, w - 2, h - 2, 5);
    ctx.stroke();

    // блик
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(w * 0.3, h * 0.25, w * 0.25, h * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // символ
    if (type) {
      var cx = w / 2, cy = h / 2;
      var fs = Math.min(w, h) * 0.5;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      if (type.cat === 'bamboo') {
        // бамбук: вертикальные палочки
        var n = parseInt(type.sym);
        ctx.fillStyle = type.color;
        for (var i = 0; i < n; i++) {
          var bx = cx + (i - (n - 1) / 2) * (fs * 0.35);
          ctx.beginPath();
          roundRect(ctx, bx - fs * 0.12, cy - fs * 0.35, fs * 0.24, fs * 0.7, fs * 0.12);
          ctx.fill();
        }
      } else if (type.cat === 'dots') {
        // круги
        var n = parseInt(type.sym);
        ctx.fillStyle = type.color;
        var cols = n <= 3 ? n : (n <= 6 ? 2 : 3);
        var rows = Math.ceil(n / cols);
        for (var i = 0; i < n; i++) {
          var col = i % cols, row = Math.floor(i / cols);
          var bx = cx + (col - (cols - 1) / 2) * (fs * 0.5);
          var by = cy + (row - (rows - 1) / 2) * (fs * 0.5);
          ctx.beginPath();
          ctx.arc(bx, by, fs * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // иероглифы, ветра, драконы, цветы
        ctx.fillStyle = type.color;
        ctx.font = '700 ' + fs + 'px Georgia, "Noto Serif", serif';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeText(type.sym, cx, cy);
        ctx.fillText(type.sym, cx, cy);
      }
    }

    // пульсация подсказки
    if (state === 'hint') {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, -3, -3, w + 6, h + 6, 8);
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
      ART.drawCover(ctx, w, h, title || 'Парный Маджонг',
        lang === 'ru' ? 'Находите пары плиток' : 'Find matching tile pairs', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // две плитки веером
    var size = s * 0.42;
    ctx.save();
    ctx.translate(s * 0.38, s * 0.55);
    ctx.rotate(-0.15);
    ART.drawTile(ctx, 0, 0, size, size * 1.3, { sym: '中', cat: 'dragon', color: '#c84a4a' }, 'idle', 0);
    ctx.restore();

    ctx.save();
    ctx.translate(s * 0.62, s * 0.45);
    ctx.rotate(0.12);
    ART.drawTile(ctx, 0, 0, size, size * 1.3, { sym: '中', cat: 'dragon', color: '#c84a4a' }, 'sel', 0);
    ctx.restore();

    // дуга
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = s * 0.02;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.55, s * 0.38, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);

    // веер из плиток
    var cx = w / 2, cy = h * 0.42, R = h * 0.32, n = 7;
    var types = [
      { sym: '中', cat: 'dragon', color: '#c84a4a' },
      { sym: '1', cat: 'bamboo', color: '#4a9e4a' },
      { sym: '3', cat: 'dots', color: '#4a7ab8' },
      { sym: '發', cat: 'dragon', color: '#4a8a4a' },
      { sym: '5', cat: 'bamboo', color: '#4a9e4a' },
      { sym: '2', cat: 'dots', color: '#4a7ab8' },
      { sym: '白', cat: 'dragon', color: '#4a6a8a' }
    ];
    for (var i = 0; i < n; i++) {
      var a = Math.PI + (i / (n - 1)) * Math.PI;
      var x = cx + Math.cos(a) * R;
      var y = cy + Math.sin(a) * R * 0.55;
      var size = h * 0.18;
      var st = i === 3 ? 'sel' : 'idle';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i - 3) * 0.06);
      ART.drawTile(ctx, 0, 0, size, size * 1.3, types[i], st, i * 0.3);
      ctx.restore();
    }

    // заголовок
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var size = Math.round(h * 0.14);
    ctx.font = '800 ' + size + 'px Georgia, serif';
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(10,23,19,0.95)'; ctx.lineJoin = 'round';
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
