/* game/art.js — вся графика процедурная: карты, стол, аватары, промо.
   Ни одного внешнего файла: иконка, обложка и скриншоты рисуются тем же кодом. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var P = G.config.palette;
  var SUIT_GLYPH = { s: '♠', h: '♥', d: '♦', c: '♣' };
  var RANK_LABEL = { 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var A = {};
  A.suitGlyph = function (s) { return SUIT_GLYPH[s] || '?'; };
  A.rankLabel = function (r) { return RANK_LABEL[r] || String(r); };
  A.isRed = function (s) { return !!G.config.suitRed[s]; };

  /* ---------- карта ---------- */
  /* opts: {face:bool, hi:bool, dim:bool, lift:number, trump:bool} */
  A.card = function (ctx, x, y, w, h, card, opts) {
    opts = opts || {};
    // карты в логике — {s, r}; промо рисует {suit, rank}: принимаем оба вида
    var cs = card && (card.s || card.suit);
    var cr = card && (card.r != null ? card.r : card.rank);
    var face = opts.face !== false;
    var lift = opts.lift || 0;
    y -= lift;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 10 + lift * 0.6;
    ctx.shadowOffsetY = 4 + lift * 0.5;
    rr(ctx, x, y, w, h, Math.max(4, w * 0.11));
    ctx.fillStyle = face ? P.paper : '#2b1d3a';
    ctx.fill();
    ctx.restore();

    rr(ctx, x, y, w, h, Math.max(4, w * 0.11));
    ctx.lineWidth = Math.max(1, w * 0.022);
    ctx.strokeStyle = opts.hi ? '#3ecf7a' : 'rgba(20,26,24,0.35)';
    ctx.stroke();

    if (!face) { A.cardBack(ctx, x, y, w, h); return; }

    var red = A.isRed(cs);
    var ink = red ? P.red : P.black;
    var pad = w * 0.12;

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = ink;
    ctx.font = '700 ' + Math.round(h * 0.20) + 'px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(A.rankLabel(cr), x + pad, y + pad * 0.9);

    ctx.font = Math.round(h * 0.155) + 'px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(A.suitGlyph(cs), x + pad, y + pad * 0.9 + h * 0.19);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.92;
    ctx.font = Math.round(h * 0.34) + 'px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(A.suitGlyph(cs), x + w * 0.58, y + h * 0.60);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x + w - pad, y + h - pad);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = ink;
    ctx.font = '700 ' + Math.round(h * 0.15) + 'px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(A.rankLabel(cr), 0, 0);
    ctx.restore();

    if (opts.dim) {
      rr(ctx, x, y, w, h, Math.max(4, w * 0.11));
      ctx.fillStyle = 'rgba(10,20,16,0.45)'; ctx.fill();
    }
    if (opts.trump) {
      rr(ctx, x + w * 0.06, y + h * 0.06, w * 0.88, h * 0.88, Math.max(3, w * 0.07));
      ctx.lineWidth = Math.max(1, w * 0.018);
      ctx.strokeStyle = 'rgba(242,193,78,0.85)'; ctx.stroke();
    }
  };

  A.cardBack = function (ctx, x, y, w, h) {
    ctx.save();
    rr(ctx, x, y, w, h, Math.max(4, w * 0.11));
    ctx.clip();
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#3b2350'); g.addColorStop(0.5, '#5a2c48'); g.addColorStop(1, '#2b1d3a');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(242,193,78,0.30)';
    ctx.lineWidth = Math.max(1, w * 0.016);
    var step = Math.max(6, w * 0.16);
    for (var i = -h; i < w + h; i += step) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke();
    }
    ctx.restore();
    rr(ctx, x + w * 0.09, y + h * 0.06, w * 0.82, h * 0.88, Math.max(3, w * 0.06));
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.strokeStyle = 'rgba(242,193,78,0.55)'; ctx.stroke();
  };

  /* ---------- стол ---------- */
  A.table = function (ctx, w, h) {
    var g = ctx.createRadialGradient(w * 0.5, h * 0.42, Math.min(w, h) * 0.12, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    g.addColorStop(0, P.feltHi);
    g.addColorStop(0.55, P.felt);
    g.addColorStop(1, P.feltDark);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // тканевая фактура: редкая сетка, детерминированная (без Math.random)
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.strokeStyle = '#d8f0e2';
    ctx.lineWidth = 1;
    var step = Math.max(18, Math.round(Math.min(w, h) / 26));
    for (var x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (var y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.restore();

    var v = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  };

  /* ---------- аватар ---------- */
  A.avatar = function (ctx, x, y, r, color, letter, opts) {
    opts = opts || {};
    ctx.save();
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r);
    g.addColorStop(0, '#ffffff22');
    g.addColorStop(0.45, color);
    g.addColorStop(1, '#00000055');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = opts.active ? P.gold : 'rgba(0,0,0,0.35)';
    ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = P.cream;
    ctx.font = '700 ' + Math.round(r * 0.95) + 'px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(letter, x, y + r * 0.04);
    ctx.restore();
  };

  A.coin = function (ctx, x, y, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.6, P.gold); g.addColorStop(1, '#8a6a18');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.14); ctx.strokeStyle = '#6b5210'; ctx.stroke();
    ctx.fillStyle = '#6b5210';
    ctx.font = '700 ' + Math.round(r * 1.05) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', x, y + r * 0.06);
    ctx.restore();
  };

  A.chip = function (ctx, x, y, r, color) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
    ctx.restore();
  };

  /* ---------- промо (иконка 512 и обложка 800×470) ---------- */
  A.promo = function (ctx, w, h, kind, rng, title) {
    var icon = kind === 'icon';
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};

    var bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
    bg.addColorStop(0, '#245c41'); bg.addColorStop(0.55, P.felt); bg.addColorStop(1, '#0b1a13');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    var lg = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.45, Math.max(w, h) * 0.62);
    lg.addColorStop(0, 'rgba(255,240,190,0.20)');
    lg.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);

    var cardW = icon ? w * 0.40 : h * 0.42;
    var cardH = cardW * 1.45;
    var cx = icon ? w * 0.5 : w * 0.235;
    var cy = icon ? h * 0.56 : h * 0.56;

    // золотая корона над веером (с отступом от верхнего края)
    var cw = cardW * 0.60, chh = cw * 0.52;
    var kx = cx - cw / 2, ky = Math.max(h * 0.05, cy - cardH * 0.5 - chh - h * 0.05);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.28);
    A.card(ctx, -cardW / 2, -cardH / 2, cardW, cardH, { suit: 'h', rank: 13 }, {});
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.20);
    A.card(ctx, -cardW / 2, -cardH / 2, cardW, cardH, { suit: 's', rank: 14 }, { trump: true });
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(kx, ky + chh);
    ctx.lineTo(kx, ky + chh * 0.30);
    ctx.lineTo(kx + cw * 0.22, ky + chh * 0.62);
    ctx.lineTo(kx + cw * 0.50, ky);
    ctx.lineTo(kx + cw * 0.78, ky + chh * 0.62);
    ctx.lineTo(kx + cw, ky + chh * 0.30);
    ctx.lineTo(kx + cw, ky + chh);
    ctx.closePath();
    var cg = ctx.createLinearGradient(kx, ky, kx, ky + chh);
    cg.addColorStop(0, '#ffe9a3'); cg.addColorStop(0.6, P.gold); cg.addColorStop(1, '#9c7a1c');
    ctx.fillStyle = cg; ctx.fill();
    ctx.lineWidth = Math.max(2, cw * 0.035); ctx.strokeStyle = '#6b5210'; ctx.stroke();
    ctx.restore();

    if (!icon) {
      var tx = w * 0.46;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.gold;
      ctx.font = '800 ' + Math.round(h * 0.145) + 'px system-ui, "Segoe UI", sans-serif';
      ctx.fillText(title || dict.title || 'Козырь', tx, h * 0.34);
      ctx.fillStyle = P.cream;
      ctx.font = '600 ' + Math.round(h * 0.055) + 'px system-ui, "Segoe UI", sans-serif';
      ctx.fillText(dict['cover_tag'] || '', tx, h * 0.50);
      ctx.font = '500 ' + Math.round(h * 0.044) + 'px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(247,241,227,0.72)';
      ctx.fillText(dict.subtitle || '', tx, h * 0.60);

      for (var i = 0; i < 4; i++) {
        A.chip(ctx, tx + h * 0.03 + i * h * 0.075, h * 0.76, h * 0.034, i % 2 ? '#c0392b' : '#f2f2f2');
      }
    }
  };

  G.art = A;
})(window.GAME);
