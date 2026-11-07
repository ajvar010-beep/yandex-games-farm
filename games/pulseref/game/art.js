/* game/art.js — synthwave-арт «Пульса»: небо, солнце, сетка, дорожки, ноты, промо.
   Ни одного внешнего файла: иконка и обложка рисуются тем же кодом, что и игра. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var P = G.config.palette;
  var A = {};

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
  A.rr = rr;

  /* Детерминированный «шум» для звёзд: Math.random в арте запрещён. */
  function hash(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  A.stars = function (ctx, W, H, t) {
    for (var i = 0; i < 46; i++) {
      var x = hash(i * 3 + 1) * W;
      var y = hash(i * 7 + 2) * H * 0.64;
      var a = 0.16 + 0.5 * Math.abs(Math.sin(t * 0.7 + i * 1.7));
      var s = 1 + hash(i * 11 + 5) * 1.8;
      ctx.fillStyle = 'rgba(215,230,255,' + a.toFixed(3) + ')';
      ctx.fillRect(x, y, s, s);
    }
  };

  A.sun = function (ctx, cx, cy, r, t) {
    var glow = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 2.2);
    glow.addColorStop(0, 'rgba(255,90,180,0.30)');
    glow.addColorStop(0.5, 'rgba(255,45,149,0.10)');
    glow.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);

    var g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, P.sun1);
    g.addColorStop(0.48, '#ff8a5c');
    g.addColorStop(1, P.sun2);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    for (var i = 0; i < 7; i++) {
      var yy = cy + r * (0.02 + i * 0.135);
      ctx.fillStyle = 'rgba(10,6,22,' + (0.52 + i * 0.055).toFixed(3) + ')';
      ctx.fillRect(cx - r, yy, r * 2, Math.max(2, r * (0.018 + i * 0.012)));
    }
    ctx.restore();
  };

  A.horizon = function (ctx, W, hy) {
    var hg = ctx.createLinearGradient(0, hy - 44, 0, hy + 5);
    hg.addColorStop(0, 'rgba(255,45,149,0)');
    hg.addColorStop(0.72, 'rgba(255,45,149,0.20)');
    hg.addColorStop(1, 'rgba(34,232,255,0.32)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, hy - 44, W, 49);
  };

  A.grid = function (ctx, W, H, y0, t) {
    ctx.save();
    ctx.lineWidth = 1;
    var cx = W / 2, i;
    ctx.strokeStyle = 'rgba(255,79,216,0.20)';
    for (i = -10; i <= 10; i++) {
      var bx = cx + i * (W / 9);
      ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(bx, H); ctx.stroke();
    }
    var phase = (t * 0.4) % 1;
    for (i = 0; i < 12; i++) {
      var f = (i + phase) / 12;
      var y = y0 + (H - y0) * f * f;
      ctx.globalAlpha = 0.08 + 0.30 * f;
      ctx.strokeStyle = 'rgba(34,232,255,0.55)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  };

  /* Полный фон сцены. pulse — яркость пульсации на бит (0..1). */
  A.bg = function (ctx, W, H, t, pulse) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#07040f');
    g.addColorStop(0.36, P.bg2);
    g.addColorStop(0.62, P.bg3);
    g.addColorStop(1, '#07040f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    A.stars(ctx, W, H, t);

    var hy = H * 0.66;
    A.sun(ctx, W / 2, hy - Math.min(W, H) * 0.17, Math.min(W, H) * 0.165, t);
    A.horizon(ctx, W, hy);
    A.grid(ctx, W, H, hy, t);

    if (pulse > 0.01) {
      var bg2 = ctx.createRadialGradient(W / 2, H * 0.72, 10, W / 2, H * 0.72, Math.max(W, H) * 0.6);
      bg2.addColorStop(0, 'rgba(255,45,149,' + (0.12 * pulse).toFixed(3) + ')');
      bg2.addColorStop(1, 'rgba(255,45,149,0)');
      ctx.fillStyle = bg2;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = '#000000';
    for (var y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.restore();

    var vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.36, W / 2, H * 0.5, Math.max(W, H) * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  };

  /* Дорожки поля: столбцы, неоновые края, лёгкое свечение на бит. */
  A.lanes = function (ctx, Lt, pulse) {
    var i, x;
    for (i = 0; i < 4; i++) {
      x = Lt.x0 + i * Lt.laneW;
      var g = ctx.createLinearGradient(0, Lt.top, 0, Lt.hitY);
      g.addColorStop(0, 'rgba(22,10,44,0.08)');
      g.addColorStop(0.55, 'rgba(38,12,68,0.32)');
      g.addColorStop(1, 'rgba(64,18,106,0.62)');
      ctx.fillStyle = g;
      ctx.fillRect(x, Lt.top, Lt.laneW, Lt.hitY - Lt.top);
      if (pulse > 0.01) {
        ctx.fillStyle = 'rgba(255,45,149,' + (0.055 * pulse).toFixed(3) + ')';
        ctx.fillRect(x, Lt.top, Lt.laneW, Lt.hitY - Lt.top);
      }
    }
    for (i = 0; i <= 4; i++) {
      x = Lt.x0 + i * Lt.laneW;
      ctx.strokeStyle = (i % 2) ? 'rgba(34,232,255,0.28)' : 'rgba(255,45,149,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, Lt.top);
      ctx.lineTo(x, Lt.hitY + 12);
      ctx.stroke();
    }
  };

  A.hitBar = function (ctx, Lt, pulse, flash) {
    var y = Lt.hitY - 6;
    var bgGrad = ctx.createLinearGradient(0, y, 0, y + 16);
    bgGrad.addColorStop(0, 'rgba(255,45,149,0.16)');
    bgGrad.addColorStop(1, 'rgba(34,232,255,0.08)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(Lt.x0, y, Lt.lanesW, 16);

    var i;
    for (i = 0; i < 4; i++) {
      var x = Lt.x0 + i * Lt.laneW;
      var f = flash ? (flash[i] || 0) : 0;
      var a = Math.min(1, 0.34 + 0.5 * (pulse || 0) + f * 0.9);
      var grad = ctx.createLinearGradient(0, y, 0, y + 13);
      grad.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
      grad.addColorStop(0.45, i % 2
        ? 'rgba(34,232,255,' + a.toFixed(3) + ')'
        : 'rgba(255,45,149,' + a.toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(140,60,255,' + (a * 0.5).toFixed(3) + ')');
      rr(ctx, x + 3, y + 2, Lt.laneW - 6, 11, 5);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(34,232,255,0.9)';
    ctx.shadowBlur = 9 + 16 * (pulse || 0);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(Lt.x0, Lt.hitY - 1, Lt.lanesW, 2);
    ctx.restore();

    for (i = 0; i < 4; i++) {
      var ff = flash ? (flash[i] || 0) : 0;
      if (ff <= 0) continue;
      var cx = Lt.x0 + (i + 0.5) * Lt.laneW;
      ctx.globalAlpha = Math.min(1, ff * 2.2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, Lt.hitY, Lt.laneW * (0.20 + (1 - ff) * 0.55), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  /* Нота: капсула (тап) либо ромб с крестом (фантом). */
  A.note = function (ctx, cx, cy, w, h, ghost, alpha) {
    var a = alpha == null ? 1 : alpha;
    if (ghost) {
      ctx.save();
      ctx.globalAlpha = a * 0.92;
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      rr(ctx, -w * 0.31, -h * 0.31, w * 0.62, h * 0.62, w * 0.09);
      ctx.fillStyle = 'rgba(40,8,40,0.45)';
      ctx.fill();
      ctx.lineWidth = Math.max(2, w * 0.055);
      ctx.strokeStyle = P.magenta;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffd6f2';
      ctx.lineWidth = Math.max(2, w * 0.055);
      ctx.lineCap = 'round';
      var s = w * 0.15;
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = a;
    var g = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
    g.addColorStop(0, '#eaffff');
    g.addColorStop(0.34, P.cyan);
    g.addColorStop(0.78, '#5f7bff');
    g.addColorStop(1, P.violet);
    ctx.shadowColor = 'rgba(34,232,255,0.85)';
    ctx.shadowBlur = Math.min(18, h * 0.75);
    rr(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.45);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    rr(ctx, cx - w * 0.35, cy - h * 0.32, w * 0.70, h * 0.22, h * 0.11);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.restore();
  };

  A.coin = function (ctx, x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.6, P.gold);
    g.addColorStop(1, '#8a6a18');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = '#6b5210';
    ctx.stroke();
    ctx.fillStyle = '#6b5210';
    ctx.font = '700 ' + Math.round(r * 1.05) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', x, y + r * 0.06);
    ctx.restore();
  };

  A.pulseBar = function (ctx, x, y, w, h, ratio, t) {
    var r = ratio < 0 ? 0 : (ratio > 1 ? 1 : ratio);
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(8,4,20,0.72)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(246,233,255,0.18)';
    ctx.stroke();
    if (r > 0.004) {
      var g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, r > 0.35 ? '#7dff9b' : '#ff5a7a');
      g.addColorStop(0.6, r > 0.35 ? '#22e8ff' : '#ff2d95');
      g.addColorStop(1, '#ff2d95');
      rr(ctx, x + 2, y + 2, Math.max(2, (w - 4) * r), h - 4, (h - 4) / 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
    if (r < 0.32) {
      var a = 0.20 + 0.14 * Math.abs(Math.sin(t * 8));
      rr(ctx, x - 1, y - 1, w + 2, h + 2, h / 2);
      ctx.strokeStyle = 'rgba(255,90,122,' + a.toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  A.rankBadge = function (ctx, x, y, size, rank) {
    var col = rank === 'S' ? '#ffd166' : (rank === 'A' ? '#7dff9b' : (rank === 'B' ? '#22e8ff' : '#a294c9'));
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = size * 0.45;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,4,24,0.86)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = col;
    ctx.font = '800 ' + Math.round(size * 0.52) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rank, x, y + size * 0.02);
    ctx.restore();
  };

  A.keyCap = function (ctx, cx, cy, size, label, active) {
    rr(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.22);
    ctx.fillStyle = active ? 'rgba(255,45,149,0.32)' : 'rgba(10,6,22,0.55)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = active ? 'rgba(255,255,255,0.7)' : 'rgba(162,148,201,0.35)';
    ctx.stroke();
    ctx.fillStyle = active ? '#ffffff' : 'rgba(162,148,201,0.78)';
    ctx.font = '700 ' + Math.round(size * 0.42) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 0.5);
  };

  /* ---------- промо-арт: иконка 512 (без текста) и обложка 800×470 ---------- */
  function laneField(ctx, x0, top, width, hitY, seedN) {
    var laneW = width / 4, i, j;
    var back = ctx.createLinearGradient(0, top, 0, hitY);
    back.addColorStop(0, 'rgba(10,4,24,0.30)');
    back.addColorStop(1, 'rgba(34,10,58,0.62)');
    ctx.fillStyle = back;
    ctx.fillRect(x0, top, width, hitY - top);

    for (i = 0; i < 4; i++) {
      var g = ctx.createLinearGradient(0, top, 0, hitY);
      g.addColorStop(0, 'rgba(34,232,255,0.10)');
      g.addColorStop(0.55, 'rgba(138,92,255,0.20)');
      g.addColorStop(1, 'rgba(255,45,149,0.30)');
      ctx.fillStyle = g;
      ctx.fillRect(x0 + i * laneW, top, laneW, hitY - top);
    }
    for (i = 0; i <= 4; i++) {
      ctx.strokeStyle = (i % 2) ? 'rgba(34,232,255,0.78)' : 'rgba(255,45,149,0.78)';
      ctx.lineWidth = Math.max(2, laneW * 0.035);
      ctx.beginPath();
      ctx.moveTo(x0 + i * laneW, top);
      ctx.lineTo(x0 + i * laneW, hitY);
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(34,232,255,0.95)';
    ctx.shadowBlur = Math.max(8, laneW * 0.45);
    for (i = 0; i < 4; i++) {
      rr(ctx, x0 + i * laneW + laneW * 0.08, hitY - Math.max(4, laneW * 0.07),
        laneW * 0.84, Math.max(5, laneW * 0.14), laneW * 0.05);
      ctx.fillStyle = (i % 2) ? '#d8fbff' : '#ffd6ee';
      ctx.fill();
    }
    ctx.restore();

    var noteW = laneW * 0.72, noteH = Math.max(12, laneW * 0.36);
    var ys = [0.14, 0.30, 0.46, 0.62];
    for (j = 0; j < ys.length; j++) {
      var lane = (j * 3 + seedN) % 4;
      A.note(ctx, x0 + (lane + 0.5) * laneW, top + (hitY - top) * ys[j], noteW, noteH, false, 1);
    }
    A.note(ctx, x0 + (((seedN + 1) % 4) + 0.5) * laneW, top + (hitY - top) * 0.54, noteW, noteH, true, 1);
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    var icon = kind === 'icon';
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};
    var seedN = 1;
    try { seedN = Math.abs(Math.round(rng() * 97)) % 4; } catch (e) { seedN = 1; }

    A.bg(ctx, w, h, 2.6, 0.55);

    if (icon) {
      ctx.save();
      ctx.strokeStyle = 'rgba(34,232,255,0.42)';
      ctx.lineWidth = Math.max(3, w * 0.012);
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.44, w * 0.31, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      var iw = w * 0.80;
      laneField(ctx, (w - iw) / 2, h * 0.18, iw, h * 0.84, seedN);
      return;
    }

    laneField(ctx, w * 0.57, h * 0.09, w * 0.39, h * 0.86, seedN);

    var tx = w * 0.055;
    var maxW = w * 0.46;
    var size = Math.round(h * 0.22);
    var t = String(title || dict['title'] || 'Pulse').toUpperCase();
    ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    while (size > 22 && ctx.measureText(t).width > maxW) {
      size -= 2;
      ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(255,45,149,0.8)';
    ctx.shadowBlur = h * 0.06;
    ctx.fillStyle = P.gold;
    ctx.fillText(t, tx, h * 0.36);
    ctx.restore();

    ctx.font = '600 ' + Math.round(h * 0.055) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = P.cream;
    ctx.fillText(dict['cover_tag'] || '', tx, h * 0.54);
    ctx.font = '500 ' + Math.round(h * 0.042) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(214,226,255,0.72)';
    ctx.fillText(dict['cover_line'] || '', tx, h * 0.64);

    for (var k = 0; k < 4; k++) {
      A.note(ctx, tx + h * 0.05 + k * h * 0.10, h * 0.78, h * 0.075, h * 0.034, false, 0.92);
    }
  };

  G.art = A;
})(window.GAME);
