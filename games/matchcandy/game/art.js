/* game/art.js — процедурная графика «Сладкого Рая»: сладости-сущности,
   фон кондитерской, промо (icon/cover). Standalone: локальный mulberry32. */
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

  var KIND_COLORS = { berry: '#ff5d8f', lemon: '#ffd43b', mint: '#69db7c', grape: '#9775fa', orange: '#ff9f43', choco: '#8c5a3b' };
  var KIND_DARK = { berry: '#c2255c', lemon: '#e8a013', mint: '#2f9e44', grape: '#7048e8', orange: '#e8590c', choco: '#5c3a21' };

  /* ---------- сладость (круглая, блестящая) ---------- */
  ART.drawCandy = function (ctx, x, y, r, kind, t, sel) {
    var P = pal();
    var col = KIND_COLORS[kind] || '#fff', dark = KIND_DARK[kind] || '#888';
    ctx.save();
    ctx.translate(x, y);
    if (sel) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 9);
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // тело
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, col);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // форма по виду
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.lineCap = 'round';
    if (kind === 'lemon') { // дольки
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2 + t * 0.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.stroke();
      }
    } else if (kind === 'mint') { // спираль
      ctx.beginPath();
      for (var s = 0; s <= 20; s++) {
        var aa = s * 0.5 + t * 0.5, rr = r * 0.7 * (s / 20);
        var px = Math.cos(aa) * rr, py = Math.sin(aa) * rr;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (kind === 'grape') { // гроздь-точки
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      var pts = [[-0.3, -0.2], [0.3, -0.25], [0, 0.2], [-0.2, 0.35], [0.25, 0.3]];
      for (var p2 = 0; p2 < pts.length; p2++) {
        ctx.beginPath(); ctx.arc(pts[p2][0] * r, pts[p2][1] * r, r * 0.16, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'orange') { // кольцо
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    } else if (kind === 'choco') { // вафельная сетка
      for (var w = -1; w <= 1; w++) {
        ctx.beginPath(); ctx.moveTo(w * r * 0.4, -r * 0.6); ctx.lineTo(w * r * 0.4, r * 0.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.6, w * r * 0.4); ctx.lineTo(r * 0.6, w * r * 0.4); ctx.stroke();
      }
    } // berry — чистая ягода, только блик
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- фон кондитерской ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // плавающие конфетти
    var rng = mulberry32(777);
    for (var i = 0; i < 18; i++) {
      var px = rng() * w, py = rng() * h;
      var sway = Math.sin(t * 0.8 + i * 1.7) * 10;
      ctx.globalAlpha = 0.10 + (i % 3) * 0.04;
      ctx.fillStyle = ['#ff8fb2', '#ffd43b', '#69db7c', '#9775fa'][i % 4];
      ctx.save(); ctx.translate(px + sway, py); ctx.rotate(t * 0.3 + i);
      ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  /* ---------- промо ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    var kinds = G.config.kinds;
    if (kind === 'icon') {
      var r = w * 0.16;
      ART.drawCandy(ctx, w * 0.5, h * 0.4, r, 'berry', 1.4, false);
      ART.drawCandy(ctx, w * 0.3, h * 0.62, r * 0.8, 'lemon', 1.0, false);
      ART.drawCandy(ctx, w * 0.72, h * 0.6, r * 0.85, 'mint', 0.6, false);
      ART.drawCandy(ctx, w * 0.52, h * 0.78, r * 0.6, 'grape', 2.0, false);
    } else {
      var r2 = w * 0.055;
      for (var i = 0; i < 6; i++) {
        ART.drawCandy(ctx, w * (0.12 + i * 0.11), h * (0.4 + (i % 2) * 0.14), r2, kinds[i], i * 0.7, i === 2);
      }
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 60;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.46) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(30,15,48,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.42, h * 0.36);
        var tg = ctx.createLinearGradient(0, h * 0.36 - size / 2, 0, h * 0.36 + size / 2);
        tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#ffb3c9');
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.42, h * 0.36);
      }
    }
  };
})(window.GAME);
