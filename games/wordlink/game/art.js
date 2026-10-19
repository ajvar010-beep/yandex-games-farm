/* game/art.js — процедурная графика «Словарного Моста»: деревянные плитки
   с буквами (стиль по Kenney Letter Tiles, CC0), фон-библиотека, промо.
   Standalone: локальный mulberry32. Буквы рисуются кодом — работают RU и EN. */
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

  /* ---------- фон: тёмная библиотека с полками ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // парящие буквы-пылинки
    var rng = mulberry32(7);
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.font = '700 28px Georgia, serif';
    ctx.fillStyle = '#d4a94e';
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ';
    for (var i = 0; i < 22; i++) {
      var x = rng() * w, y = (rng() * h + t * 10) % (h + 40) - 20;
      var ch = abc[Math.floor(rng() * abc.length)];
      ctx.fillText(ch, x, y);
    }
    ctx.restore();
  };

  /* ---------- плитка-буква (дерево + золотая рамка, стиль Kenney Wood) ---------- */
  ART.drawTile = function (ctx, x, y, size, letter, weight, state, t) {
    // state: 'idle' | 'sel' | 'found' | 'revealed' | 'empty'
    var P = pal();
    var r = size / 2;
    ctx.save();
    ctx.translate(x, y);
    if (state === 'sel') {
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 9);
      ctx.strokeStyle = P.hint; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (state === 'empty') {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    // тело плитки: деревянный градиент
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    if (state === 'found') { g.addColorStop(0, '#8fce7a'); g.addColorStop(0.5, '#4e9e4a'); g.addColorStop(1, '#2e6e2c'); }
    else if (state === 'revealed') { g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.5, '#e8b84a'); g.addColorStop(1, '#b8892e'); }
    else { g.addColorStop(0, '#d9a25e'); g.addColorStop(0.5, P.tile); g.addColorStop(1, P.tileDark); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // золотая рамка
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.strokeStyle = state === 'found' ? '#2e6e2c' : (state === 'revealed' ? '#fff3c4' : P.tileEdge);
    ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth, 0, Math.PI * 2); ctx.stroke();
    // блик
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.42, r * 0.34, r * 0.2, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // буква
    ctx.fillStyle = state === 'found' ? '#f2ffe9' : '#fff7e8';
    ctx.font = '800 ' + Math.round(size * 0.52) + 'px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.05); ctx.strokeStyle = 'rgba(60,32,8,0.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(letter.toUpperCase(), 0, -size * 0.04);
    ctx.fillText(letter.toUpperCase(), 0, -size * 0.04);
    // вес буквы (как в Scrabble) — маленькая цифра в углу
    if (weight > 1) {
      ctx.font = '700 ' + Math.round(size * 0.2) + 'px Georgia, serif';
      ctx.fillStyle = 'rgba(255,244,214,0.85)';
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(String(weight), r * 0.62, r * 0.62);
    }
    ctx.restore();
  };

  /* ---------- промо-хук для pipeline/promo.html ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    if (kind === 'icon') {
      ART.drawIcon(ctx, w);
    } else {
      var lang = (typeof window !== 'undefined' && window.Engine && window.Engine.i18n && window.Engine.i18n.lang) || 'ru';
      ART.drawCover(ctx, w, h, title || 'Словарный Мост',
        lang === 'ru' ? 'Соединяй буквы в слова' : 'Link letters into words', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    // три плитки W-O-W
    var size = s * 0.3, cx = s / 2, cy = s / 2;
    ART.drawTile(ctx, cx - size * 1.05, cy, size, 'W', 4, 'idle', 0);
    ART.drawTile(ctx, cx, cy - size * 0.35, size, 'O', 1, 'revealed', 0);
    ART.drawTile(ctx, cx + size * 1.05, cy, size, 'W', 4, 'found', 0);
    // дуга-связка
    ctx.strokeStyle = P.accent; ctx.lineWidth = s * 0.02; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy + size * 0.1, size * 1.45, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);
    // дуга из плиток
    var cx = w / 2, cy = h * 0.46, R = h * 0.34, n = 7;
    var word = lang === 'ru' ? 'СЛОВАРЬ' : 'LETTERS';
    for (var i = 0; i < n; i++) {
      var a = Math.PI + (i / (n - 1)) * Math.PI;
      var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.62;
      var st = i === 2 ? 'revealed' : (i === 4 ? 'found' : 'idle');
      ART.drawTile(ctx, x, y, h * 0.2, word[i] || 'A', (i % 3) + 1, st, i * 0.4);
    }
    // заголовок
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var size = Math.round(h * 0.16);
    ctx.font = '800 ' + size + 'px Georgia, serif';
    ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(21,13,31,0.95)'; ctx.lineJoin = 'round';
    ctx.strokeText(title, cx, h * 0.82);
    var tg = ctx.createLinearGradient(0, h * 0.82 - size / 2, 0, h * 0.82 + size / 2);
    tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, '#d4a94e');
    ctx.fillStyle = tg; ctx.fillText(title, cx, h * 0.82);
    if (subtitle) {
      ctx.font = '600 ' + Math.round(h * 0.05) + 'px system-ui, sans-serif';
      ctx.fillStyle = '#b79fd0';
      ctx.fillText(subtitle, cx, h * 0.82 + size * 0.75);
    }
  };
})(window.GAME);
