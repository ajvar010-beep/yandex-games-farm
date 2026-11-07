/* game/art.js — вся графика процедурная: мастерская, сталь, янтарь, искры.
   Ни одного файла: доска, шпильки, шары, чаши, фон и промо рисуются кодом. */
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

  /* ---------- фон мастерской ---------- */
  A.bg = function (ctx, W, H, t) {
    var g = ctx.createLinearGradient(0, 0, W * 0.25, H);
    g.addColorStop(0, '#221a13');
    g.addColorStop(0.55, P.bg);
    g.addColorStop(1, '#100c09');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // тёплая лампа сверху
    var lg = ctx.createRadialGradient(W * 0.5, -H * 0.08, H * 0.02, W * 0.5, -H * 0.08, H * 0.85);
    lg.addColorStop(0, 'rgba(255,190,90,0.22)');
    lg.addColorStop(0.45, 'rgba(255,170,60,0.07)');
    lg.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

    // перфорированная стена: точки-дырочки
    ctx.save();
    ctx.fillStyle = 'rgba(255,220,160,0.045)';
    var step = Math.max(16, Math.round(W / 34));
    for (var y = step; y < H; y += step) {
      for (var x = step * 0.5; x < W; x += step) {
        ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // подвесные инструменты по краям (силуэты)
    var k = Math.min(W, H);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#0c0906';
    toolWrench(ctx, W * 0.055, H * 0.30, k * 0.030);
    toolSaw(ctx, W * 0.945, H * 0.24, k * 0.032);
    toolHammer(ctx, W * 0.075, H * 0.62, k * 0.026);
    ctx.restore();

    // пылинки в луче
    ctx.save();
    for (var i = 0; i < 18; i++) {
      var px = ((i * 137.5 + t * (6 + (i % 5) * 3)) % (W + 40)) - 20;
      var py = (i * 71.3 + t * (9 + (i % 3) * 5)) % (H + 40) - 20;
      ctx.globalAlpha = 0.05 + 0.05 * Math.sin(t * 1.3 + i);
      ctx.fillStyle = '#ffe6a3';
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.restore();
  };

  function toolWrench(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.35);
    ctx.fillRect(-s * 0.1, -s * 1.5, s * 0.2, s * 3);
    ctx.beginPath(); ctx.arc(0, -s * 1.62, s * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * 1.62, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function toolSaw(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18);
    ctx.fillRect(-s * 0.16, -s * 1.7, s * 0.32, s * 1.0);
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s * 0.7);
    ctx.lineTo(s * 0.62, -s * 0.7);
    ctx.lineTo(s * 0.62, s * 1.5);
    for (var i = 0; i < 7; i++) ctx.lineTo(s * 0.62 - (i + 0.5) * s * 0.177, s * 1.2);
    ctx.lineTo(-s * 0.62, s * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function toolHammer(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
    ctx.fillRect(-s * 0.09, -s * 1.9, s * 0.18, s * 3.0);
    rr(ctx, -s * 0.62, -s * 2.05, s * 1.24, s * 0.52, s * 0.1); ctx.fill();
    ctx.restore();
  }

  /* ---------- доска ---------- */
  A.board = function (ctx, x, y, w, h, t) {
    // деревянная рама
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = w * 0.03;
    ctx.shadowOffsetY = w * 0.012;
    rr(ctx, x, y, w, h, w * 0.028);
    ctx.fillStyle = P.woodDark; ctx.fill();
    ctx.restore();
    var fg = ctx.createLinearGradient(x, y, x + w, y + h);
    fg.addColorStop(0, P.woodHi);
    fg.addColorStop(0.5, P.wood);
    fg.addColorStop(1, P.woodDark);
    rr(ctx, x, y, w, h, w * 0.028);
    ctx.fillStyle = fg; ctx.fill();

    // волокна дерева
    ctx.save();
    rr(ctx, x, y, w, h, w * 0.028); ctx.clip();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = '#000';
    for (var i = 0; i < 9; i++) {
      ctx.beginPath();
      var yy = y + h * (i + 0.5) / 9;
      ctx.moveTo(x, yy);
      for (var xx = 0; xx <= w; xx += w / 8) ctx.lineTo(x + xx, yy + Math.sin(xx * 0.03 + i) * h * 0.006);
      ctx.lineWidth = Math.max(1, w * 0.004);
      ctx.stroke();
    }
    ctx.restore();

    // внутренняя стальная панель
    var pad = w * 0.035;
    rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, w * 0.018);
    var sg = ctx.createLinearGradient(x, y + pad, x, y + h - pad);
    sg.addColorStop(0, '#1b2028');
    sg.addColorStop(0.35, '#12161c');
    sg.addColorStop(1, '#0d1014');
    ctx.fillStyle = sg; ctx.fill();
    ctx.lineWidth = Math.max(1.5, w * 0.006);
    ctx.strokeStyle = 'rgba(160,180,205,0.20)';
    ctx.stroke();

    // винты по углам
    var sp = pad * 0.42, sr = Math.max(1.6, w * 0.011);
    var corners = [[x + pad * 0.55, y + pad * 0.55], [x + w - pad * 0.55, y + pad * 0.55],
                   [x + pad * 0.55, y + h - pad * 0.55], [x + w - pad * 0.55, y + h - pad * 0.55]];
    for (var c = 0; c < 4; c++) {
      ctx.beginPath(); ctx.arc(corners[c][0], corners[c][1], sr, 0, Math.PI * 2);
      ctx.fillStyle = P.brass; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(corners[c][0] - sr * 0.65, corners[c][1]);
      ctx.lineTo(corners[c][0] + sr * 0.65, corners[c][1]);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(1, sr * 0.35); ctx.stroke();
    }
    // царапины на панели
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#cfe0f0';
    for (var s = 0; s < 7; s++) {
      var sx = x + pad + ((s * 97.13) % (w - pad * 2));
      var sy = y + pad + ((s * 53.7) % (h - pad * 2));
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + w * 0.05, sy + h * 0.008); ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- бункер-раздатчик ---------- */
  A.hopper = function (ctx, cx, y, w, h, left, total, t) {
    var topW = w, botW = w * 0.34;
    // горловина: янтарное свечение под воронкой
    var sp = ctx.createRadialGradient(cx, y + h, 1, cx, y + h, w * 0.28);
    sp.addColorStop(0, 'rgba(255,190,80,0.34)');
    sp.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = sp;
    ctx.fillRect(cx - w * 0.3, y + h - w * 0.2, w * 0.6, w * 0.45);

    // воронка
    var g = ctx.createLinearGradient(cx - topW / 2, y, cx + topW / 2, y + h);
    g.addColorStop(0, '#e6eef7');
    g.addColorStop(0.30, P.steelHi);
    g.addColorStop(0.62, P.steel);
    g.addColorStop(1, P.steelDark);
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, y);
    ctx.lineTo(cx + topW / 2, y);
    ctx.lineTo(cx + botW / 2, y + h);
    ctx.lineTo(cx - botW / 2, y + h);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.4, w * 0.028);
    ctx.strokeStyle = 'rgba(8,10,14,0.85)'; ctx.stroke();

    // тёмное нутро сверху
    ctx.beginPath();
    ctx.ellipse(cx, y, topW * 0.49, Math.max(2, h * 0.16), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(9,7,5,0.88)'; ctx.fill();
    ctx.lineWidth = Math.max(1.2, w * 0.026);
    ctx.strokeStyle = 'rgba(240,165,43,0.55)'; ctx.stroke();

    // шары, лежащие в бункере
    var n = Math.min(5, total | 0);
    var br = w * 0.085;
    for (var i = 0; i < n; i++) {
      var row = i % 3, col = (i / 3) | 0;
      A.ball(ctx, cx - br * 1.55 + row * br * 1.55, y + h * 0.20 + col * br * 1.5, br, t);
    }

    // блик
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(cx - topW * 0.34, y + h * 0.10);
    ctx.lineTo(cx - topW * 0.20, y + h * 0.10);
    ctx.lineTo(cx - botW * 0.16, y + h * 0.92);
    ctx.lineTo(cx - botW * 0.26, y + h * 0.92);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.restore();
  };

  /* ---------- шпилька ---------- */
  A.pin = function (ctx, x1, y1, x2, y2, sc, glow, hot) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var half = Math.max(1.7, sc * 1.0);
    var ex = Math.max(half * 1.45, sc * 1.45);

    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = 'rgba(255,196,90,' + (0.55 * glow) + ')';
      ctx.shadowBlur = sc * 1.4;
    }
    // тело шпильки
    var g = ctx.createLinearGradient(x1 + nx * half, y1 + ny * half, x1 - nx * half, y1 - ny * half);
    g.addColorStop(0, P.steelDark);
    g.addColorStop(0.42, P.steelHi);
    g.addColorStop(0.62, P.steel);
    g.addColorStop(1, '#2a313a');
    ctx.strokeStyle = g;
    ctx.lineWidth = half * 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();

    // тёмная обводка
    ctx.save();
    ctx.strokeStyle = 'rgba(6,8,11,0.55)';
    ctx.lineWidth = Math.max(1, half * 0.35);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1 + nx * (half * 0.8), y1 + ny * (half * 0.8));
    ctx.lineTo(x2 + nx * (half * 0.8), y2 + ny * (half * 0.8));
    ctx.stroke();
    ctx.restore();

    // наконечники — янтарные шляпки (читаются как «шпилька»)
    for (var i = 0; i < 2; i++) {
      var px = i ? x2 : x1, py = i ? y2 : y1;
      ctx.beginPath(); ctx.arc(px, py, ex * 0.62, 0, Math.PI * 2);
      var ag = ctx.createRadialGradient(px - ex * 0.2, py - ex * 0.22, ex * 0.06, px, py, ex * 0.62);
      ag.addColorStop(0, P.amberHi);
      ag.addColorStop(0.6, P.amber);
      ag.addColorStop(1, P.amberDark);
      ctx.fillStyle = ag; ctx.fill();
      ctx.lineWidth = Math.max(1, ex * 0.14);
      ctx.strokeStyle = 'rgba(50,28,4,0.7)'; ctx.stroke();
    }
    if (hot > 0) {
      ctx.save();
      ctx.globalAlpha = hot;
      ctx.strokeStyle = P.spark;
      ctx.lineWidth = Math.max(1, half * 0.5);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }
  };

  /* ---------- шар ---------- */
  A.ball = function (ctx, x, y, r, t) {
    ctx.save();
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    g.addColorStop(0, '#f2f7fc');
    g.addColorStop(0.30, '#c3d0de');
    g.addColorStop(0.62, '#7d8b9c');
    g.addColorStop(1, '#333b46');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = 'rgba(8,10,14,0.5)';
    ctx.stroke();
    // янтарный блик
    ctx.beginPath();
    ctx.arc(x + r * 0.28, y + r * 0.34, r * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,205,120,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.restore();
  };

  /* ---------- чаша ---------- */
  A.cup = function (ctx, x, y, w, h, need, got, flash, t) {
    var full = got >= need;
    var cx = x + w / 2;
    var bot = y + h;

    // свечение полной чаши
    if (full || flash > 0) {
      var gl = ctx.createRadialGradient(cx, y + h * 0.55, w * 0.10, cx, y + h * 0.55, w * 0.95);
      gl.addColorStop(0, 'rgba(255,196,90,' + (0.32 + (full ? 0.14 : 0) + flash * 0.5) + ')');
      gl.addColorStop(1, 'rgba(255,196,90,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - w * 0.35, y - h * 0.25, w * 1.7, h * 1.55);
    }

    var topIn = w * 0.03, botIn = w * 0.14;
    function bodyPath() {
      ctx.beginPath();
      ctx.moveTo(x + topIn, y + h * 0.07);
      ctx.lineTo(x + w - topIn, y + h * 0.07);
      ctx.lineTo(x + w - botIn, bot - w * 0.05);
      ctx.quadraticCurveTo(x + w - botIn, bot, x + w - botIn - w * 0.10, bot);
      ctx.lineTo(x + botIn + w * 0.10, bot);
      ctx.quadraticCurveTo(x + botIn, bot, x + botIn, bot - w * 0.05);
      ctx.closePath();
    }

    // корпус — латунное ведро
    bodyPath();
    var g = ctx.createLinearGradient(x, y, x + w * 0.15, bot);
    g.addColorStop(0, '#f8e2a6');
    g.addColorStop(0.20, '#dfbb64');
    g.addColorStop(0.58, '#bd9438');
    g.addColorStop(1, '#7a5a1c');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.6, w * 0.045);
    ctx.strokeStyle = 'rgba(44,26,4,0.82)';
    ctx.stroke();

    // окно: видно, сколько шаров внутри
    var wx = x + w * 0.13, wy = y + h * 0.17, ww = w * 0.74, wh = h * 0.64;
    rr(ctx, wx, wy, ww, wh, w * 0.09);
    var wg = ctx.createLinearGradient(0, wy, 0, wy + wh);
    wg.addColorStop(0, full ? 'rgba(255,190,80,0.20)' : 'rgba(16,11,6,0.93)');
    wg.addColorStop(1, 'rgba(7,5,3,0.98)');
    ctx.fillStyle = wg; ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.022);
    ctx.strokeStyle = 'rgba(255,226,160,0.34)';
    ctx.stroke();

    // шары в окне
    var br = Math.min(ww / (need * 2.35), wh * 0.42);
    var baseY = wy + wh - br * 1.25;
    for (var i = 0; i < need; i++) {
      var px = wx + ww / 2 + (i - (need - 1) / 2) * br * 2.2;
      if (i < got) A.ball(ctx, px, baseY, br, t);
      else {
        ctx.save();
        ctx.beginPath(); ctx.arc(px, baseY, br * 0.86, 0, Math.PI * 2);
        ctx.setLineDash([Math.max(2, br * 0.4), Math.max(2, br * 0.4)]);
        ctx.strokeStyle = 'rgba(210,225,245,0.32)';
        ctx.lineWidth = Math.max(1, br * 0.16);
        ctx.stroke();
        ctx.restore();
      }
    }

    // блик на корпусе
    ctx.save();
    bodyPath(); ctx.clip();
    var hg = ctx.createLinearGradient(x, 0, x + w * 0.38, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0.32)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(x, y, w * 0.42, h);
    ctx.restore();

    // обод и тёмное горло
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.07, w * 0.5, w * 0.105, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, w * 0.06);
    ctx.strokeStyle = full ? P.amberHi : '#eccb7e';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.07, w * 0.41, w * 0.072, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(9,6,3,0.86)';
    ctx.fill();
  };

  /* ---------- мелочи ---------- */
  A.coin = function (ctx, x, y, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.6, P.brass); g.addColorStop(1, '#7d5c12');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.14); ctx.strokeStyle = '#5e460e'; ctx.stroke();
    ctx.fillStyle = '#5e460e';
    ctx.font = '700 ' + Math.round(r * 1.0) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', x, y + r * 0.06);
    ctx.restore();
  };

  A.clock = function (ctx, x, y, r, color) {
    ctx.save();
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.strokeStyle = color || P.amberHi;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - r * 0.55);
    ctx.moveTo(x, y); ctx.lineTo(x + r * 0.42, y + r * 0.12);
    ctx.stroke();
    ctx.restore();
  };

  A.pliers = function (ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color || P.steelHi;
    ctx.lineWidth = Math.max(1.5, r * 0.20);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, -r * 0.75); ctx.lineTo(-r * 0.10, r * 0.10);
    ctx.moveTo(r * 0.75, -r * 0.75); ctx.lineTo(r * 0.10, r * 0.10);
    ctx.moveTo(-r * 0.10, r * 0.10); ctx.lineTo(-r * 0.55, r * 0.85);
    ctx.moveTo(r * 0.10, r * 0.10); ctx.lineTo(r * 0.55, r * 0.85);
    ctx.stroke();
    ctx.restore();
  };

  A.wrench = function (ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.65);
    ctx.strokeStyle = color || P.brass;
    ctx.lineWidth = Math.max(1.8, r * 0.24);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.72, r * 0.34, Math.PI * 1.36, Math.PI * 0.52, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, r * 1.02, r * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  A.spark = function (ctx, x, y, r, a, color) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = color || P.spark;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.25, y - r * 0.25);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.25, y + r * 0.25);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.25, y + r * 0.25);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.25, y - r * 0.25);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /* ---------- витрина в меню: широкий кадр мастерской ---------- */
  A.hero = function (ctx, x, y, w, h, t) {
    ctx.save();
    // рама
    rr(ctx, x, y, w, h, Math.min(w, h) * 0.05);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, P.woodHi); g.addColorStop(0.5, P.wood); g.addColorStop(1, P.woodDark);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.010);
    ctx.strokeStyle = 'rgba(201,162,74,0.55)'; ctx.stroke();

    var pad = Math.min(w, h) * 0.045;
    rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, Math.min(w, h) * 0.03);
    var sg = ctx.createLinearGradient(x, y + pad, x, y + h - pad);
    sg.addColorStop(0, '#1c222a'); sg.addColorStop(1, '#0a0d11');
    ctx.fillStyle = sg; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(160,180,205,0.18)'; ctx.stroke();

    var psc = Math.min(w, h) * 0.010;        // толщина шпильки
    var br = Math.min(w, h) * 0.030;         // радиус шара

    // шпильки — в верхней половине
    A.pin(ctx, x + w * 0.26, y + h * 0.24, x + w * 0.62, y + h * 0.32, psc, 0.28, 0);
    A.pin(ctx, x + w * 0.74, y + h * 0.42, x + w * 0.44, y + h * 0.49, psc, 0.28, 0);

    // падающий шар с хвостом
    var ph = (t * 0.5) % 1;
    var bxx = x + w * (0.50 + 0.04 * Math.sin(t * 0.8));
    var byy = y + h * (0.12 + 0.30 * ph);
    for (var i = 3; i >= 1; i--) {
      ctx.globalAlpha = 0.09 * (4 - i) / 3;
      A.ball(ctx, bxx - i * br * 0.35, byy - i * br * 1.5, br * 0.92, t);
    }
    ctx.globalAlpha = 1;
    A.ball(ctx, bxx, byy, br, t);

    // чаши
    var cw = Math.min(w * 0.18, h * 0.22), chh = cw * 0.82;
    var cyy = y + h * 0.72;
    for (var c = 0; c < 3; c++) {
      A.cup(ctx, x + w * 0.5 + (c - 1) * (cw * 1.42) - cw / 2, cyy, cw, chh, 1, c === 1 ? 0 : 1, 0, t);
    }
    ctx.restore();
  };

  /* ---------- промо: иконка 512 и обложка 800×470 ---------- */
  /* Мотив игры: шпилька с янтарной шляпкой, крупный стальной шар и латунная чаша
     с горящими шарами. Один и тот же мотив в двух форматах, без текста на иконке. */
  function promoMotif(ctx, cx, baseY, size, withPin) {
    var cupW = size * 0.92, cupH = size * 0.66;
    // тёплое свечение под чашей
    var gl = ctx.createRadialGradient(cx, baseY - cupH * 0.2, size * 0.06, cx, baseY - cupH * 0.2, size * 1.15);
    gl.addColorStop(0, 'rgba(255,190,80,0.34)');
    gl.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(cx - size * 1.2, baseY - size * 1.4, size * 2.4, size * 2.4);

    // чаша с двумя шарами
    A.cup(ctx, cx - cupW / 2, baseY - cupH, cupW, cupH, 2, 2, 0, 0);

    // падающий шар
    var br = size * 0.24;
    var byy = baseY - cupH - size * 0.52;
    for (var i = 3; i >= 1; i--) {
      ctx.globalAlpha = 0.10 * (4 - i) / 3;
      A.ball(ctx, cx - i * br * 0.18, byy - i * br * 0.95, br * 0.92, 0);
    }
    ctx.globalAlpha = 1;
    A.ball(ctx, cx, byy, br, 0);

    // шпилька со шляпками над шаром
    if (withPin) {
      var py = byy - size * 0.62;
      A.pin(ctx, cx - size * 0.72, py - size * 0.16, cx + size * 0.72, py + size * 0.10, size * 0.085, 0.55, 0);
      A.spark(ctx, cx - size * 0.78, py - size * 0.22, size * 0.12, 0.9);
      A.spark(ctx, cx + size * 0.80, py + size * 0.14, size * 0.09, 0.6);
    }
  }

  function promoBg(ctx, w, h) {
    var g = ctx.createRadialGradient(w * 0.5, h * 0.44, w * 0.05, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    g.addColorStop(0, '#4a3320');
    g.addColorStop(0.45, '#241a12');
    g.addColorStop(1, '#0b0806');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // лучи
    ctx.save();
    ctx.translate(w * 0.5, h * 0.46);
    for (var i = 0; i < 16; i++) {
      var a = (i / 16) * Math.PI * 2 + 0.15;
      ctx.globalAlpha = 0.045 + 0.03 * ((i * 7) % 5);
      ctx.fillStyle = P.amber;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * w, Math.sin(a) * w);
      ctx.lineTo(Math.cos(a + 0.10) * w, Math.sin(a + 0.10) * w);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // доска-подложка
    var pw = w * 0.78, ph = h * 0.84;
    var px = (w - pw) / 2, py = (h - ph) / 2;
    rr(ctx, px, py, pw, ph, Math.min(pw, ph) * 0.06);
    var pg = ctx.createLinearGradient(px, py, px, py + ph);
    pg.addColorStop(0, 'rgba(58,44,30,0.55)');
    pg.addColorStop(1, 'rgba(20,15,11,0.75)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.strokeStyle = 'rgba(201,162,74,0.55)';
    ctx.stroke();
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    var icon = kind === 'icon';
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};

    promoBg(ctx, w, h);

    if (icon) {
      promoMotif(ctx, w * 0.5, h * 0.88, w * 0.40, true);
      return;
    }

    // обложка: текст слева, мотив справа
    promoMotif(ctx, w * 0.735, h * 0.90, h * 0.40, true);

    var tx = w * 0.055;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var name = title || dict.title || 'Гвозди';
    var size = Math.round(h * 0.155);
    ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    while (size > 20 && ctx.measureText(name).width > w * 0.42) {
      size -= 2;
      ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
    ctx.fillStyle = P.amberHi;
    ctx.fillText(name, tx, h * 0.30);
    ctx.restore();
    ctx.fillStyle = P.cream;
    ctx.font = '600 ' + Math.round(h * 0.058) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(dict['cover_tag'] || '', tx, h * 0.48);
    ctx.fillStyle = 'rgba(244,234,214,0.85)';
    ctx.font = '500 ' + Math.round(h * 0.046) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(dict['cover_line'] || '', tx, h * 0.58);

    // три мини-чаши-индикатора под текстом
    for (var c = 0; c < 3; c++) {
      var cw = w * 0.070, chh = cw * 0.72;
      A.cup(ctx, tx + c * w * 0.086, h * 0.72, cw, chh, 1, 1, 0, 0);
    }
  };

  G.art = A;
})(window.GAME);
