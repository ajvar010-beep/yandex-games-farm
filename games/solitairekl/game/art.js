/* game/art.js — процедурная графика «Пасьянса Клондайк»: карты, фон, промо.
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

  /* ---------- фон: зелёный стол ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // текстура стола
    var rng = mulberry32(55);
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#fff';
    for (var i = 0; i < 100; i++) {
      var x = rng() * w, y = rng() * h;
      ctx.beginPath();
      ctx.arc(x, y, 1 + rng() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- масть ---------- */
  var SUITS = ['♠', '♥', '♦', '♣'];
  var SUIT_COLORS = ['#2a2a2a', '#c84a4a', '#4a4ac8', '#2a2a2a'];

  /* ---------- ранг ---------- */
  function rankText(r) {
    if (r === 1) return 'A';
    if (r === 11) return 'J';
    if (r === 12) return 'Q';
    if (r === 13) return 'K';
    return String(r);
  }

  /* ---------- карта ---------- */
  // state: 'idle' | 'sel' | 'hint' | 'back'
  ART.drawCard = function (ctx, x, y, w, h, card, state, t) {
    var P = pal();
    ctx.save();

    if (state === 'back' || !card.faceUp) {
      // рубашка
      var grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, P.cardBack);
      grad.addColorStop(1, P.cardBackPattern);
      ctx.fillStyle = grad;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 6);
      ctx.fill();
      // узор
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 4);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // тело
    ctx.fillStyle = P.card;
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // рамка
    ctx.lineWidth = 2;
    ctx.strokeStyle = state === 'sel' ? P.accent : (state === 'hint' ? P.good : '#ccc');
    ctx.beginPath();
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 5);
    ctx.stroke();

    // блик
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.3, y + h * 0.2, w * 0.25, h * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ранг и масть
    var color = SUIT_COLORS[card.suit];
    ctx.fillStyle = color;
    ctx.font = '700 ' + (w * 0.3) + 'px Georgia, serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(rankText(card.rank), x + 6, y + 4);
    ctx.font = (w * 0.35) + 'px Georgia, serif';
    ctx.fillText(SUITS[card.suit], x + 6, y + h * 0.35);

    // центральная масть
    ctx.font = (w * 0.5) + 'px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(SUITS[card.suit], x + w / 2, y + h * 0.55);

    // пульсация подсказки
    if (state === 'hint') {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 8);
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
      ART.drawCover(ctx, w, h, title || 'Пасьянс Клондайк',
        lang === 'ru' ? 'Классический пасьянс' : 'Classic solitaire', lang);
    }
  };

  /* ---------- промо: иконка и обложка ---------- */
  ART.drawIcon = function (ctx, s) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

    // 4 карты веером
    var size = s * 0.35;
    var cards = [
      { suit: 0, rank: 1, faceUp: true },
      { suit: 1, rank: 13, faceUp: true },
      { suit: 2, rank: 12, faceUp: true },
      { suit: 3, rank: 11, faceUp: true }
    ];
    for (var i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate((i - 1.5) * 0.15);
      ART.drawCard(ctx, -size / 2, -size * 0.7, size, size * 1.4, cards[i], 'idle', 0);
      ctx.restore();
    }
  };

  ART.drawCover = function (ctx, w, h, title, subtitle, lang) {
    var P = pal();
    ART.drawBackground(ctx, w, h, 0);

    // 4 карты в ряд
    var cx = w / 2, cy = h * 0.4;
    var size = h * 0.25;
    var cards = [
      { suit: 0, rank: 1, faceUp: true },
      { suit: 1, rank: 13, faceUp: true },
      { suit: 2, rank: 12, faceUp: true },
      { suit: 3, rank: 11, faceUp: true }
    ];
    for (var i = 0; i < 4; i++) {
      var x = cx + (i - 1.5) * (size * 1.1) - size / 2;
      var y = cy - size * 0.7;
      ART.drawCard(ctx, x, y, size, size * 1.4, cards[i], 'idle', 0);
    }

    // заголовок
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var size = Math.round(h * 0.14);
    ctx.font = '800 ' + size + 'px Georgia, serif';
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(13,31,15,0.95)'; ctx.lineJoin = 'round';
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
