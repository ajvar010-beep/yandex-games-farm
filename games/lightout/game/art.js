/* game/art.js — вся графика процедурная: ночной город, неоновые плитки, отражения,
   иконки и промо. Ни одного внешнего файла и ни одного обращения к Engine —
   этот же файл рисует иконку 512×512 и обложку 800×470 через pipeline/promo.html. */
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

  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------------- фон: ночной город ---------------- */
  var bgCache = { key: '', canvas: null };

  function drawSky(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h * 0.82);
    g.addColorStop(0, P.sky1);
    g.addColorStop(0.5, P.sky2);
    g.addColorStop(1, '#241a38');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(w * 0.5, h * 0.72, 8, w * 0.5, h * 0.72, Math.max(w, h) * 0.72);
    glow.addColorStop(0, 'rgba(63,227,255,0.16)');
    glow.addColorStop(0.45, 'rgba(63,227,255,0.05)');
    glow.addColorStop(1, 'rgba(63,227,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    var blush = ctx.createRadialGradient(w * 0.18, h * 0.66, 4, w * 0.18, h * 0.66, Math.max(w, h) * 0.44);
    blush.addColorStop(0, 'rgba(255,84,200,0.12)');
    blush.addColorStop(1, 'rgba(255,84,200,0)');
    ctx.fillStyle = blush; ctx.fillRect(0, 0, w, h);

    // звёзды
    for (var i = 0; i < 44; i++) {
      var sx = hash(i * 3.1 + 1) * w;
      var sy = hash(i * 7.7 + 5) * h * 0.52;
      var sa = 0.18 + hash(i * 1.7) * 0.5;
      ctx.fillStyle = 'rgba(205,232,255,' + sa.toFixed(3) + ')';
      var ss = 0.8 + hash(i * 5.3) * 1.8;
      ctx.fillRect(sx, sy, ss, ss);
    }
  }

  function skylineLayer(ctx, w, h, baseY, seed, minH, maxH, body, winA, cols) {
    var bw = Math.max(18, w / (15 + (seed % 5) * 3));
    for (var x = -bw * 0.6, k = 0; x < w + bw; x += bw * (0.72 + hash(seed + k) * 0.5), k++) {
      var bwd = bw * (0.62 + hash(seed + k * 2.3) * 0.7);
      var bh = minH + hash(seed + k * 4.7) * (maxH - minH);
      var by = baseY - bh;
      ctx.fillStyle = body;
      ctx.fillRect(x, by, bwd, bh + 2);
      // крыша-надстройка
      if (hash(seed + k * 9.1) > 0.55) {
        ctx.fillRect(x + bwd * 0.3, by - bh * 0.09, bwd * 0.3, bh * 0.09);
        if (hash(seed + k * 3.2) > 0.5) {
          ctx.fillStyle = 'rgba(255,84,200,0.55)';
          ctx.fillRect(x + bwd * 0.44, by - bh * 0.12, 2, 2);
          ctx.fillStyle = body;
        }
      }
      // окна
      var colsN = Math.max(1, Math.floor(bwd / (bw * 0.26)));
      var rowsN = Math.max(1, Math.floor(bh / (bw * 0.34)));
      for (var cx = 0; cx < colsN; cx++) {
        for (var cy = 0; cy < rowsN; cy++) {
          var hv = hash(seed + k * 13.7 + cx * 3.3 + cy * 7.9);
          if (hv < 0.58) continue;
          var col = cols[(hash(seed + cx * 2.1 + cy * 5.7) * cols.length) | 0];
          ctx.fillStyle = rgba(col, winA * (0.55 + hv * 0.45));
          var wx = x + bwd * 0.12 + cx * (bwd * 0.8 / colsN);
          var wy = by + bh * 0.12 + cy * (bh * 0.78 / rowsN);
          ctx.fillRect(wx, wy, Math.max(1.5, bwd * 0.09), Math.max(1.5, bh * 0.035));
        }
      }
      // неоновая вывеска на части домов
      if (hash(seed + k * 6.6) > 0.66) {
        var signCol = hash(seed + k * 8.8) > 0.5 ? P.neon : P.pink;
        var sx = x + bwd * 0.62, sy = by + bh * 0.18;
        ctx.save();
        ctx.shadowColor = rgba(signCol, 0.9);
        ctx.shadowBlur = bw * 0.34;
        ctx.fillStyle = rgba(signCol, 0.85);
        ctx.fillRect(sx, sy, Math.max(2, bwd * 0.1), bh * 0.30);
        ctx.shadowBlur = bw * 0.7;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(sx + 1, sy + bh * 0.05, Math.max(1, bwd * 0.04), bh * 0.16);
        ctx.restore();
      }
    }
  }

  function drawStreet(ctx, w, h) {
    var sy = h * 0.74;
    var g = ctx.createLinearGradient(0, sy, 0, h);
    g.addColorStop(0, '#0a1120');
    g.addColorStop(0.35, '#070b14');
    g.addColorStop(1, '#04060b');
    ctx.fillStyle = g; ctx.fillRect(0, sy, w, h - sy);

    // мокрые отражения: вертикальные полосы под неоном
    for (var i = 0; i < 16; i++) {
      var x = hash(i * 5.3 + 2) * w;
      var ww = 6 + hash(i * 2.7) * 26;
      var col = i % 3 === 0 ? P.pink : P.neon;
      var rg = ctx.createLinearGradient(0, sy, 0, h);
      rg.addColorStop(0, rgba(col, 0.20));
      rg.addColorStop(0.55, rgba(col, 0.06));
      rg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x + ww, sy);
      ctx.lineTo(x + ww * 1.9, h);
      ctx.lineTo(x - ww * 0.9, h);
      ctx.closePath();
      ctx.fill();
    }
    // блик от воды
    var wet = ctx.createLinearGradient(0, sy, 0, sy + (h - sy) * 0.5);
    wet.addColorStop(0, 'rgba(120,200,255,0.10)');
    wet.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = wet; ctx.fillRect(0, sy, w, (h - sy) * 0.5);

    // бордюр
    ctx.fillStyle = 'rgba(90,130,170,0.16)';
    ctx.fillRect(0, sy - 2, w, 2);
  }

  function buildBg(w, h, level) {
    var dpr = 1;
    try { dpr = Math.min(2, window.devicePixelRatio || 1); } catch (e) { dpr = 1; }
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    drawSky(ctx, w, h);
    var seed = 17 + level * 31;
    // дальние силуэты
    skylineLayer(ctx, w, h, h * 0.755, seed, h * 0.16, h * 0.34, '#0b1324',
      0.5, [P.neonSoft, '#8fb6ff', P.pinkSoft]);
    // средние
    skylineLayer(ctx, w, h, h * 0.76, seed + 101, h * 0.26, h * 0.46, '#080d1a',
      0.62, [P.neon, P.pinkSoft, '#ffe08a']);
    // передние
    skylineLayer(ctx, w, h, h * 0.77, seed + 211, h * 0.34, h * 0.56, '#050810',
      0.72, [P.neonSoft, P.pink, '#ffd166']);
    drawStreet(ctx, w, h);
    // виньетка
    var vg = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.32, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    bgCache = { key: w + 'x' + h + ':' + level + ':' + dpr, canvas: c };
  }

  /* Город: статичный слой кэшируется, поверх — мерцание и дымка. */
  A.city = function (ctx, w, h, t, level) {
    var key = w + 'x' + h + ':' + (level | 0) + ':' + (function () {
      try { return Math.min(2, window.devicePixelRatio || 1); } catch (e) { return 1; }
    })();
    if (!bgCache.canvas || bgCache.key !== key) buildBg(w, h, level | 0);
    ctx.drawImage(bgCache.canvas, 0, 0, w, h);

    // пульс неона у горизонта
    var pulse = 0.5 + 0.5 * Math.sin(t * 1.1);
    var g = ctx.createRadialGradient(w * 0.5, h * 0.75, 10, w * 0.5, h * 0.75, Math.max(w, h) * 0.5);
    g.addColorStop(0, 'rgba(63,227,255,' + (0.05 + pulse * 0.05).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(63,227,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // маяки на крышах
    for (var i = 0; i < 4; i++) {
      var bx = hash(i * 9.3 + 4) * w;
      var by = h * (0.36 + hash(i * 4.1) * 0.22);
      var blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7));
      ctx.fillStyle = 'rgba(255,84,200,' + (blink * 0.8).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  };

  /* ---------------- плитки ---------------- */
  function diamond(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  }

  /* lit — горит; o.hot 0..1 — вспышка только что нажатой; o.dim — приглушить. */
  A.tile = function (ctx, x, y, w, h, lit, o) {
    o = o || {};
    var r = Math.min(w, h) * 0.2;
    var hot = o.hot || 0;
    var pulse = o.pulse || 0;

    if (lit) {
      ctx.save();
      ctx.shadowColor = 'rgba(63,227,255,' + (0.55 + 0.3 * pulse).toFixed(3) + ')';
      ctx.shadowBlur = Math.min(w, h) * (0.5 + 0.55 * hot + 0.2 * pulse);
      rr(ctx, x, y, w, h, r);
      var lg = ctx.createLinearGradient(x, y, x, y + h);
      lg.addColorStop(0, '#e6fdff');
      lg.addColorStop(0.32, P.neonSoft);
      lg.addColorStop(0.72, P.neon);
      lg.addColorStop(1, P.neonDeep);
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.restore();

      // фаска
      rr(ctx, x + w * 0.08, y + h * 0.08, w * 0.84, h * 0.84, r * 0.72);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.42 + 0.35 * hot).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, w * 0.028);
      ctx.stroke();

      // ядро
      ctx.fillStyle = 'rgba(255,255,255,' + (0.62 + 0.35 * hot).toFixed(3) + ')';
      diamond(ctx, x + w / 2, y + h / 2, Math.max(1.5, w * 0.16));
      ctx.fill();

      // «линза» сверху
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      rr(ctx, x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.12, h * 0.06);
      ctx.fill();

      if (hot > 0.02) {
        ctx.globalAlpha = Math.min(0.55, hot * 0.7);
        rr(ctx, x, y, w, h, r);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      rr(ctx, x, y, w, h, r);
      var dg = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
      dg.addColorStop(0, '#111a2d');
      dg.addColorStop(0.55, P.tileOff);
      dg.addColorStop(1, P.tileOff2);
      ctx.fillStyle = dg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(63,227,255,' + (0.10 + 0.22 * hot).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.stroke();

      // верхний блик
      ctx.strokeStyle = 'rgba(150,210,255,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + r * 0.9, y + h * 0.12);
      ctx.lineTo(x + w - r * 0.9, y + h * 0.12);
      ctx.stroke();

      // слабый светодиод
      ctx.fillStyle = 'rgba(63,227,255,0.18)';
      ctx.beginPath();
      ctx.arc(x + w * 0.78, y + h * 0.76, Math.max(1.2, w * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /* Рамка поля: тёмное стекло, неоновая кромка, угловые скобки. */
  A.boardFrame = function (ctx, x, y, w, h, hot) {
    var r = Math.min(w, h) * 0.035;
    ctx.save();
    ctx.shadowColor = 'rgba(63,227,255,0.35)';
    ctx.shadowBlur = Math.max(10, w * 0.03);
    rr(ctx, x, y, w, h, r);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(14,23,41,0.92)');
    g.addColorStop(1, 'rgba(6,10,19,0.94)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = 'rgba(63,227,255,' + (0.22 + 0.35 * (hot || 0)).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.5, w * 0.004);
    ctx.stroke();

    // угловые скобки
    var cl = Math.min(w, h) * 0.06;
    ctx.strokeStyle = 'rgba(63,227,255,0.85)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    var pts = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (var i = 0; i < 4; i++) {
      var p = pts[i];
      ctx.beginPath();
      ctx.moveTo(p[0] + p[2] * cl, p[1]);
      ctx.lineTo(p[0], p[1]);
      ctx.lineTo(p[0], p[1] + p[3] * cl);
      ctx.stroke();
    }
  };

  /* Кольцо от нажатия. */
  A.ripple = function (ctx, cx, cy, rad, alpha, color) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.strokeStyle = color || P.neonSoft;
    ctx.lineWidth = Math.max(1.2, rad * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  /* Отражение поля на «мокром асфальте» под доской. */
  A.reflection = function (ctx, x, y, w, h, alpha) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(63,227,255,' + (0.20 * alpha).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(63,227,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.06, y);
    ctx.lineTo(x + w * 0.94, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
  };

  /* ---------------- мелкие иконки ---------------- */
  A.coin = function (ctx, x, y, r) {
    ctx.save();
    ctx.shadowColor = 'rgba(247,201,92,0.65)';
    ctx.shadowBlur = r * 1.5;
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.55, P.gold);
    g.addColorStop(1, P.goldDim);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,86,20,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    // молния
    ctx.fillStyle = 'rgba(126,88,16,0.85)';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.12, y - r * 0.5);
    ctx.lineTo(x - r * 0.3, y + r * 0.08);
    ctx.lineTo(x - r * 0.02, y + r * 0.08);
    ctx.lineTo(x - r * 0.12, y + r * 0.5);
    ctx.lineTo(x + r * 0.32, y - r * 0.08);
    ctx.lineTo(x + r * 0.04, y - r * 0.08);
    ctx.closePath();
    ctx.fill();
  };

  A.bulb = function (ctx, x, y, r, lit) {
    if (lit) {
      ctx.save();
      ctx.shadowColor = 'rgba(63,227,255,0.9)';
      ctx.shadowBlur = r * 1.8;
      ctx.fillStyle = P.neonSoft;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(120,150,180,0.7)';
      ctx.lineWidth = Math.max(1, r * 0.25);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
  };

  /* Иконки магазина: лампочка-подсказка, стрелка-отмена, песочные часы-ходы. */
  A.shopIcon = function (ctx, x, y, s, kind, color) {
    ctx.save();
    ctx.strokeStyle = color || P.neonSoft;
    ctx.fillStyle = color || P.neonSoft;
    ctx.lineWidth = Math.max(1.6, s * 0.09);
    if (kind === 'hint') {
      ctx.beginPath();
      ctx.arc(x, y - s * 0.12, s * 0.3, Math.PI * 0.15, Math.PI * 0.85 + Math.PI * 0.5, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.16, y + s * 0.12);
      ctx.lineTo(x + s * 0.16, y + s * 0.12);
      ctx.moveTo(x - s * 0.12, y + s * 0.22);
      ctx.lineTo(x + s * 0.12, y + s * 0.22);
      ctx.stroke();
      for (var i = 0; i < 3; i++) {
        var a = -Math.PI * 0.15 + i * Math.PI * 0.15;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * s * 0.36, y - s * 0.12 + Math.sin(a) * s * 0.36);
        ctx.lineTo(x + Math.cos(a) * s * 0.52, y - s * 0.12 + Math.sin(a) * s * 0.52);
        ctx.stroke();
      }
    } else if (kind === 'undo') {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.34, y - s * 0.16);
      ctx.lineTo(x - s * 0.18, y - s * 0.30);
      ctx.lineTo(x - s * 0.10, y - s * 0.10);
      ctx.closePath(); ctx.fill();
    } else {
      // песочные часы
      ctx.beginPath();
      ctx.moveTo(x - s * 0.26, y - s * 0.32);
      ctx.lineTo(x + s * 0.26, y - s * 0.32);
      ctx.lineTo(x, y);
      ctx.lineTo(x + s * 0.26, y + s * 0.32);
      ctx.lineTo(x - s * 0.26, y + s * 0.32);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.12, y + s * 0.24);
      ctx.lineTo(x + s * 0.12, y + s * 0.24);
      ctx.lineTo(x, y + s * 0.1);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  /* Логотип-эмблема: 3×3 плиток, три горят. */
  A.mark = function (ctx, cx, cy, size, t) {
    var gap = size * 0.09;
    var cell = (size - gap * 2) / 3;
    var x0 = cx - size / 2, y0 = cy - size / 2;
    var litMask = [0, 1, 1, 1, 0, 0, 0, 0, 1];
    for (var i = 0; i < 9; i++) {
      var r = (i / 3) | 0, c = i % 3;
      var x = x0 + c * (cell + gap);
      var y = y0 + r * (cell + gap);
      var lit = litMask[i] === 1;
      var pulse = lit ? 0.5 + 0.5 * Math.sin(t * 2.0 + i * 0.9) : 0;
      A.tile(ctx, x, y, cell, cell, lit, { pulse: pulse });
    }
  };

  /* ---------------- промо ---------------- */
  function promoBg(ctx, w, h, level) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05080f');
    g.addColorStop(0.5, '#0f1830');
    g.addColorStop(1, '#241a38');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
    glow.addColorStop(0, 'rgba(63,227,255,0.20)');
    glow.addColorStop(0.5, 'rgba(255,84,200,0.06)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    // звёзды
    for (var i = 0; i < 60; i++) {
      ctx.fillStyle = 'rgba(205,232,255,' + (0.15 + hash(i * 2.7) * 0.5).toFixed(3) + ')';
      var s = 1 + hash(i * 5.1) * 2;
      ctx.fillRect(hash(i * 3.3 + 1) * w, hash(i * 7.1 + 2) * h * 0.6, s, s);
    }
    // силуэты города
    skylineLayer(ctx, w, h, h * 0.86, 61 + level * 13, h * 0.18, h * 0.38, '#080d1a',
      0.7, [P.neonSoft, P.pinkSoft]);
    skylineLayer(ctx, w, h, h * 0.88, 137 + level * 17, h * 0.28, h * 0.5, '#050810',
      0.8, [P.neon, P.pink, '#ffd166']);
    // дорога-отражение
    var sy = h * 0.86;
    var rg = ctx.createLinearGradient(0, sy, 0, h);
    rg.addColorStop(0, 'rgba(63,227,255,0.18)');
    rg.addColorStop(1, 'rgba(63,227,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, sy, w, h - sy);
  }

  function promoGrid(ctx, cx, cy, size, n, rng, icon) {
    var gap = size * 0.05;
    var cell = (size - gap * (n - 1)) / n;
    var x0 = cx - size / 2, y0 = cy - size / 2;
    // тень-подложка
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.05;
    rr(ctx, x0 - size * 0.08, y0 - size * 0.08, size * 1.16, size * 1.16, size * 0.06);
    ctx.fillStyle = 'rgba(5,9,17,0.85)';
    ctx.fill();
    ctx.restore();

    var litCells = {};
    var count = icon ? 3 : Math.max(5, Math.round(n * n * 0.3));
    var guard = 0;
    while (Object.keys(litCells).length < count && guard < 200) {
      guard++;
      // крест: три в ряд + две по бокам — читаемый «ход» игры
      if (!icon) {
        var row = 1 + ((rng() * (n - 2)) | 0);
        var col = 1 + ((rng() * (n - 2)) | 0);
        var cross = [row * n + col, row * n + col - 1, row * n + col + 1, (row - 1) * n + col, (row + 1) * n + col];
        for (var q = 0; q < cross.length; q++) litCells[cross[q]] = 1;
      } else {
        litCells[((rng() * n * n) | 0)] = 1;
      }
    }
    for (var i = 0; i < n * n; i++) {
      var r = (i / n) | 0, c = i % n;
      var x = x0 + c * (cell + gap);
      var y = y0 + r * (cell + gap);
      A.tile(ctx, x, y, cell, cell, !!litCells[i], { pulse: 0.6 });
    }
    // отражение поля
    A.reflection(ctx, x0, y0 + size + gap, size, size * 0.28, 1);
    return { x: x0, y: y0, size: size, cell: cell };
  }

  function promoScene(ctx, w, h, icon, rng, title, dict) {
    promoBg(ctx, w, h, icon ? 3 : 7);
    if (icon) {
      promoGrid(ctx, w * 0.5, h * 0.47, w * 0.62, 3, rng, true);
      // блик по диагонали
      var lg = ctx.createLinearGradient(0, 0, w, h);
      lg.addColorStop(0, 'rgba(255,255,255,0.10)');
      lg.addColorStop(0.4, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
      return;
    }

    promoGrid(ctx, h * 0.52, h * 0.47, h * 0.62, 4, rng, false);

    var tx = w * 0.56;
    var size = h * 0.155;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    while (size > 18 && ctx.measureText(title || 'Light Tiles').width > w * 0.40) {
      size -= 2;
      ctx.font = '800 ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    }
    ctx.save();
    ctx.shadowColor = 'rgba(63,227,255,0.65)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = P.neonSoft;
    ctx.fillText(title || 'Light Tiles', tx, h * 0.34);
    ctx.restore();
    // линия
    ctx.strokeStyle = 'rgba(63,227,255,0.65)';
    ctx.lineWidth = Math.max(2, h * 0.008);
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.44);
    ctx.lineTo(tx + Math.min(w * 0.38, ctx.measureText(title || 'Light Tiles').width + 20), h * 0.44);
    ctx.stroke();

    dict = dict || {};
    ctx.font = '600 ' + Math.round(h * 0.058) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = P.cream;
    ctx.fillText(dict['cover_tag'] || '', tx, h * 0.55);
    ctx.font = '500 ' + Math.round(h * 0.044) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(232,243,255,0.66)';
    ctx.fillText(dict['cover_line'] || '', tx, h * 0.65);
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    if (kind === 'icon') {
      promoScene(ctx, w, h, true, rng, null, null);
      return;
    }
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};
    promoScene(ctx, w, h, false, rng, title || dict.title, dict);
  };

  G.art = A;
})(window.GAME);
