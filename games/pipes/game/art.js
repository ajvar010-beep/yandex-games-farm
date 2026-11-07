/* game/art.js — процедурная графика «Труб»: медь, бирюза, пар и блики.
   Ни одного внешнего файла: всё рисуется на canvas. Этот же файл рисует
   иконку 512×512 и обложку 800×470 через pipeline/promo.html. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var A = {};
  var P = G.config.palette;
  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
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

  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function font(size, weight) {
    return (weight || 700) + ' ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }
  A.font = font;

  /* ================================================================ фон */
  /* Тёмный паровой цех: стены, заклёпки, подсветка, боковые стояки. */
  A.plantRoom = function (ctx, w, h, t, level) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2);
    g.addColorStop(0.55, P.bg);
    g.addColorStop(1, P.bgDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // тёплое зарево меди в центре
    var cx = w * 0.5, cy = h * 0.46;
    var rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(w, h) * 0.62);
    rg.addColorStop(0, 'rgba(184,115,51,0.16)');
    rg.addColorStop(0.45, 'rgba(47,179,168,0.06)');
    rg.addColorStop(1, 'rgba(7,22,26,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    // кирпичная кладка еле заметна
    var bh = Math.max(18, h / 18);
    ctx.strokeStyle = 'rgba(120,180,180,0.035)';
    ctx.lineWidth = 1;
    for (var y = -bh; y < h + bh; y += bh) {
      var off = (Math.floor(y / bh) & 1) ? bh * 1.1 : 0;
      line(ctx, 0, y, w, y);
      for (var x = off; x < w; x += bh * 2.2) line(ctx, x, y, x, y + bh);
    }

    // боковые стояки с бликами
    var sw = Math.max(7, w * 0.016);
    for (var side = 0; side < 2; side++) {
      var px = side ? w - sw * 2.2 : sw * 0.9;
      var pg = ctx.createLinearGradient(px, 0, px + sw, 0);
      pg.addColorStop(0, 'rgba(58,29,12,0.85)');
      pg.addColorStop(0.35, 'rgba(150,92,48,0.55)');
      pg.addColorStop(1, 'rgba(40,20,9,0.9)');
      ctx.fillStyle = pg;
      ctx.fillRect(px, 0, sw, h);
      // фланцы
      ctx.fillStyle = 'rgba(28,15,7,0.85)';
      for (var fy = h * 0.08; fy < h; fy += h * 0.19) {
        rr(ctx, px - sw * 0.35, fy, sw * 1.7, Math.max(4, sw * 0.55), 2);
        ctx.fill();
      }
    }

    // лёгкая дымка сверху
    var vg = ctx.createLinearGradient(0, 0, 0, h * 0.3);
    vg.addColorStop(0, 'rgba(4,16,19,0.7)');
    vg.addColorStop(1, 'rgba(4,16,19,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h * 0.3);
  };

  /* ================================================================ рама */
  /* Медная рама доски: внешний каркас, тёмная ванна под плиты, болты. */
  A.frame = function (ctx, x, y, w, h, cell, t) {
    var pad = Math.max(7, cell * 0.30);
    var r = Math.max(6, cell * 0.34);
    // тень
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = pad * 0.9;
    ctx.shadowOffsetY = pad * 0.25;
    rr(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, r);
    ctx.fillStyle = P.copperDark;
    ctx.fill();
    ctx.restore();

    var g = ctx.createLinearGradient(x - pad, y - pad, x + w + pad, y + h + pad);
    g.addColorStop(0, P.copperHi);
    g.addColorStop(0.28, P.copper);
    g.addColorStop(0.6, '#8a4f24');
    g.addColorStop(1, P.copperDark);
    rr(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, pad * 0.12);
    ctx.strokeStyle = 'rgba(255,225,185,0.28)';
    ctx.stroke();

    // внутренняя тёмная ванна
    var inset = pad * 0.18;
    rr(ctx, x - inset, y - inset, w + inset * 2, h + inset * 2, Math.max(4, r * 0.6));
    ctx.fillStyle = 'rgba(5,18,21,0.92)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, pad * 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();

    // болты по углам и посредине сторон
    var br = Math.max(2, cell * 0.055);
    var pts = [
      [x - pad * 0.55, y - pad * 0.55], [x + w + pad * 0.55, y - pad * 0.55],
      [x - pad * 0.55, y + h + pad * 0.55], [x + w + pad * 0.55, y + h + pad * 0.55],
      [x + w / 2, y - pad * 0.55], [x + w / 2, y + h + pad * 0.55],
      [x - pad * 0.55, y + h / 2], [x + w + pad * 0.55, y + h / 2]
    ];
    for (var i = 0; i < pts.length; i++) {
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], br, 0, Math.PI * 2);
      ctx.fillStyle = '#3a1d0c';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pts[i][0] - br * 0.22, pts[i][1] - br * 0.22, br * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,180,0.45)';
      ctx.fill();
    }
  };

  /* ================================================================ плита */
  A.plate = function (ctx, x, y, s, seed) {
    var in0 = s * 0.04;
    rr(ctx, x + in0, y + in0, s - in0 * 2, s - in0 * 2, Math.max(2, s * 0.12));
    ctx.fillStyle = P.plate;
    ctx.fill();
    // вертикальная шлифовка
    ctx.save();
    rr(ctx, x + in0, y + in0, s - in0 * 2, s - in0 * 2, Math.max(2, s * 0.12));
    ctx.clip();
    ctx.strokeStyle = 'rgba(140,200,200,0.045)';
    ctx.lineWidth = Math.max(0.6, s * 0.014);
    for (var i = 0; i < 4; i++) {
      var px = x + s * (0.18 + i * 0.22);
      line(ctx, px, y, px - s * 0.12, y + s);
    }
    ctx.restore();
    // заклёпки
    var dot = Math.max(1, s * 0.035);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    var pts = [[x + s * 0.15, y + s * 0.15], [x + s * 0.85, y + s * 0.15],
               [x + s * 0.15, y + s * 0.85], [x + s * 0.85, y + s * 0.85]];
    for (var k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.arc(pts[k][0], pts[k][1], dot, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,150,150,0.10)';
    ctx.lineWidth = 1;
    rr(ctx, x + in0, y + in0, s - in0 * 2, s - in0 * 2, Math.max(2, s * 0.12));
    ctx.stroke();
  };

  /* ================================================================ труба */
  function pipeSeg(ctx, x1, y1, x2, y2, w, wet) {
    var vert = Math.abs(x2 - x1) < Math.abs(y2 - y1);
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    ctx.lineCap = 'round';

    // тёмный контур
    ctx.strokeStyle = P.copperDeep;
    ctx.lineWidth = w * 1.24;
    line(ctx, x1, y1, x2, y2);

    // тело: цилиндрический градиент поперёк трубы
    var g;
    if (vert) g = ctx.createLinearGradient(x1 - w * 0.55, 0, x1 + w * 0.55, 0);
    else g = ctx.createLinearGradient(0, y1 - w * 0.55, 0, y1 + w * 0.55);
    g.addColorStop(0, '#2a1508');
    g.addColorStop(0.18, '#8a4f24');
    g.addColorStop(0.42, '#d98d4e');
    g.addColorStop(0.68, '#a8632e');
    g.addColorStop(1, '#241205');
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    line(ctx, x1, y1, x2, y2);

    // блик сверху
    ctx.strokeStyle = 'rgba(255,226,186,0.30)';
    ctx.lineWidth = Math.max(1, w * 0.09);
    var o = w * 0.22;
    if (vert) line(ctx, x1 - o, y1, x2 - o, y2);
    else line(ctx, x1, y1 - o, x2, y2 - o);

    // вода внутри — заполняет всё сечение трубы
    if (wet > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(wet, 0, 1);
      ctx.strokeStyle = 'rgba(70,224,208,0.26)';
      ctx.lineWidth = w * 1.0;
      line(ctx, x1, y1, x2, y2);
      ctx.strokeStyle = P.waterDeep;
      ctx.lineWidth = w * 0.72;
      line(ctx, x1, y1, x2, y2);
      ctx.strokeStyle = P.water;
      ctx.lineWidth = w * 0.56;
      line(ctx, x1, y1, x2, y2);
      ctx.strokeStyle = 'rgba(200,255,247,0.62)';
      ctx.lineWidth = Math.max(1, w * 0.2);
      if (vert) line(ctx, x1 - w * 0.07, y1, x2 - w * 0.07, y2);
      else line(ctx, x1, y1 - w * 0.07, x2, y2 - w * 0.07);
      ctx.restore();
    }
  }

  function flange(ctx, ex, ey, d, w, wet) {
    var vert = (d === 0 || d === 2);
    var lw = w * 1.42, lh = Math.max(2, w * 0.20);
    var x = vert ? ex - lw / 2 : ex - lh / 2;
    var y = vert ? ey - lh / 2 : ey - lw / 2;
    var r = Math.min(lh / 2, lw / 2);
    rr(ctx, x, y, vert ? lw : lh, vert ? lh : lw, r);
    var g = ctx.createLinearGradient(x, y, x + (vert ? 0 : lh), y + (vert ? lh : 0));
    g.addColorStop(0, P.copperHi);
    g.addColorStop(0.5, P.brass);
    g.addColorStop(1, P.copperDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,9,0.85)';
    ctx.lineWidth = Math.max(1, w * 0.07);
    ctx.stroke();
    if (wet > 0.3) {
      ctx.globalAlpha = clamp(wet, 0, 1) * 0.5;
      ctx.fillStyle = P.water;
      rr(ctx, x + lh * 0.3, y + lh * 0.3, (vert ? lw : lh) - lh * 0.6, (vert ? lh : lw) - lh * 0.6, r * 0.5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* Плитка-труба: mask — биты верх/право/низ/лево, s — сторона клетки. */
  A.pipeTile = function (ctx, x, y, s, mask, opt) {
    opt = opt || {};
    var cx = x + s / 2, cy = y + s / 2;
    var w = s * 0.30;
    var wet = opt.wet || 0;
    var d, ex, ey;

    for (d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      pipeSeg(ctx, cx, cy, cx + DIRS[d][0] * (s / 2), cy + DIRS[d][1] * (s / 2), w, wet);
    }

    // ступица
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.52, 0, Math.PI * 2);
    var hg = ctx.createLinearGradient(cx - w * 0.5, cy - w * 0.5, cx + w * 0.5, cy + w * 0.5);
    hg.addColorStop(0, '#d98d4e');
    hg.addColorStop(0.55, '#a8632e');
    hg.addColorStop(1, '#2a1508');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.09);
    ctx.strokeStyle = P.copperDeep;
    ctx.stroke();
    if (wet > 0) {
      ctx.globalAlpha = clamp(wet, 0, 1);
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = P.waterDeep;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - w * 0.08, cy - w * 0.08, w * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,255,247,0.6)';
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.arc(cx - w * 0.14, cy - w * 0.14, w * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,232,196,0.30)';
      ctx.fill();
    }

    // фланцы на выходах
    for (d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      ex = cx + DIRS[d][0] * (s / 2);
      ey = cy + DIRS[d][1] * (s / 2);
      flange(ctx, ex, ey, d, w, wet);
    }
  };

  /* ================================================================ кран */
  A.faucet = function (ctx, x, y, s, open, t, hot) {
    var w = s * 0.30;
    var bodyX = x - s * 0.55;
    // подводка к сетке
    pipeSeg(ctx, bodyX, y, x + s * 0.02, y, w, open ? 1 : 0);
    // стояк
    var g = ctx.createLinearGradient(bodyX - w * 0.8, 0, bodyX + w * 0.8, 0);
    g.addColorStop(0, P.copperDark);
    g.addColorStop(0.3, P.copperHi);
    g.addColorStop(1, P.copperDeep);
    ctx.fillStyle = g;
    rr(ctx, bodyX - w * 0.8, y - s * 0.62, w * 1.6, s * 0.7, w * 0.5);
    ctx.fill();
    ctx.strokeStyle = P.copperDeep;
    ctx.lineWidth = Math.max(1, w * 0.1);
    ctx.stroke();
    // вентиль
    A.valve(ctx, bodyX, y - s * 0.62, s * 0.24, open ? t : 0, open ? P.patinaHi : P.brass);
    // капля из носика
    if (open) {
      var rg = ctx.createRadialGradient(x, y, 1, x, y, s * 0.4);
      rg.addColorStop(0, 'rgba(200,255,247,0.7)');
      rg.addColorStop(1, 'rgba(70,224,208,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // тёплый блик у горячего крана
    if (hot) {
      ctx.fillStyle = 'rgba(255,140,90,0.85)';
      ctx.beginPath();
      ctx.arc(bodyX, y + s * 0.16, Math.max(1.4, s * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /* Вентиль-колесо. */
  A.valve = function (ctx, cx, cy, r, t, col) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.3, r * 0.26);
    ctx.strokeStyle = col || P.brass;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,9,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    ctx.stroke();
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2;
      line(ctx, Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
      ctx.strokeStyle = col || P.brass;
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = col || P.brass;
    ctx.fill();
    ctx.restore();
  };

  /* ================================================================ сток */
  A.drain = function (ctx, x, y, s, fill, t) {
    var w = s * 0.30;
    // приёмная воронка
    var rx = x + s * 0.34;
    pipeSeg(ctx, x - s * 0.02, y, rx, y, w, fill);
    // раструб
    ctx.beginPath();
    ctx.moveTo(rx - s * 0.12, y - s * 0.30);
    ctx.lineTo(rx + s * 0.10, y - s * 0.20);
    ctx.lineTo(rx + s * 0.10, y + s * 0.20);
    ctx.lineTo(rx - s * 0.12, y + s * 0.30);
    ctx.closePath();
    var g = ctx.createLinearGradient(rx - s * 0.12, 0, rx + s * 0.10, 0);
    g.addColorStop(0, P.copperDark);
    g.addColorStop(0.45, P.copperHi);
    g.addColorStop(1, P.copperDeep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = P.copperDeep;
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.stroke();

    // прозрачная трубка уровня
    var tx = rx + s * 0.26, ty = y - s * 0.42, th = s * 0.84, tw = s * 0.16;
    rr(ctx, tx, ty, tw, th, tw / 2);
    ctx.fillStyle = 'rgba(9,38,42,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,240,238,0.45)';
    ctx.lineWidth = Math.max(1, s * 0.014);
    ctx.stroke();
    var lvl = clamp(fill, 0, 1);
    if (lvl > 0.02) {
      var hh = (th - tw) * lvl;
      rr(ctx, tx + tw * 0.18, ty + th - tw * 0.5 - hh, tw * 0.64, Math.max(2, hh), tw * 0.32);
      var wg = ctx.createLinearGradient(0, ty + th, 0, ty);
      wg.addColorStop(0, P.waterDeep);
      wg.addColorStop(1, P.waterHi);
      ctx.fillStyle = wg;
      ctx.fill();
    }
    // блик на стекле
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(1, s * 0.012);
    line(ctx, tx + tw * 0.22, ty + th * 0.2, tx + tw * 0.22, ty + th * 0.7);
  };

  /* ================================================================ пар */
  A.steam = function (ctx, x, y, s, k) {
    for (var i = 0; i < 3; i++) {
      var ph = (k + i * 0.33) % 1;
      var a = 0.26 * (1 - ph) * (1 - ph);
      if (a <= 0.01) continue;
      var px = x + Math.sin((k + i) * 7.3) * s * 0.24;
      var py = y - ph * s * 0.8;
      var rad = s * (0.09 + ph * 0.3);
      var sg = ctx.createRadialGradient(px, py, 1, px, py, rad);
      sg.addColorStop(0, 'rgba(226,255,252,' + a.toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(200,240,240,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /* ================================================================ монета */
  A.coin = function (ctx, x, y, r) {
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffe9a6');
    g.addColorStop(0.55, P.gold);
    g.addColorStop(1, '#9c6b12');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = 'rgba(120,80,10,0.75)';
    ctx.stroke();
    // капля воды на монете — фирменная метка
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.52);
    ctx.quadraticCurveTo(x + r * 0.42, y + r * 0.02, x, y + r * 0.44);
    ctx.quadraticCurveTo(x - r * 0.42, y + r * 0.02, x, y - r * 0.52);
    ctx.fillStyle = 'rgba(10,60,62,0.7)';
    ctx.fill();
  };

  /* ================================================================ иконки */
  A.icon = function (ctx, kind, x, y, s, col) {
    ctx.save();
    ctx.strokeStyle = col || P.cream;
    ctx.fillStyle = col || P.cream;
    ctx.lineWidth = Math.max(1.6, s * 0.12);
    ctx.lineCap = 'round';
    if (kind === 'hint') {
      // лампочка
      ctx.beginPath();
      ctx.arc(x, y - s * 0.08, s * 0.28, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
      line(ctx, x - s * 0.14, y + s * 0.22, x + s * 0.14, y + s * 0.22);
      line(ctx, x - s * 0.10, y + s * 0.34, x + s * 0.10, y + s * 0.34);
      for (var i = 0; i < 3; i++) {
        var a = -Math.PI * 0.75 + i * Math.PI * 0.25;
        line(ctx, x + Math.cos(a) * s * 0.42, y - s * 0.08 + Math.sin(a) * s * 0.42,
          x + Math.cos(a) * s * 0.56, y - s * 0.08 + Math.sin(a) * s * 0.56);
      }
    } else if (kind === 'moves') {
      // три стрелки вперёд
      for (var k = 0; k < 3; k++) {
        var yy = y - s * 0.28 + k * s * 0.28;
        line(ctx, x - s * 0.3, yy, x + s * 0.26, yy);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.26, yy);
        ctx.lineTo(x + s * 0.06, yy - s * 0.14);
        ctx.moveTo(x + s * 0.26, yy);
        ctx.lineTo(x + s * 0.06, yy + s * 0.14);
        ctx.stroke();
      }
    } else if (kind === 'freeze') {
      // снежинка
      for (var d = 0; d < 3; d++) {
        var ang = d * Math.PI / 3;
        var dx = Math.cos(ang) * s * 0.46, dy = Math.sin(ang) * s * 0.46;
        line(ctx, x - dx, y - dy, x + dx, y + dy);
        line(ctx, x + dx * 0.55, y + dy * 0.55,
          x + dx * 0.55 + Math.cos(ang + 1.1) * s * 0.18, y + dy * 0.55 + Math.sin(ang + 1.1) * s * 0.18);
        line(ctx, x - dx * 0.55, y - dy * 0.55,
          x - dx * 0.55 - Math.cos(ang + 1.1) * s * 0.18, y - dy * 0.55 - Math.sin(ang + 1.1) * s * 0.18);
      }
    } else if (kind === 'shop') {
      // вентиль-колесо = магазин
      A.valve(ctx, x, y, s * 0.4, 0, col || P.gold);
    } else if (kind === 'pause') {
      ctx.fillStyle = col || P.cream;
      rr(ctx, x - s * 0.22, y - s * 0.34, s * 0.16, s * 0.68, s * 0.05); ctx.fill();
      rr(ctx, x + s * 0.06, y - s * 0.34, s * 0.16, s * 0.68, s * 0.05); ctx.fill();
    } else if (kind === 'sound') {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.38, y - s * 0.1);
      ctx.lineTo(x - s * 0.18, y - s * 0.1);
      ctx.lineTo(x + s * 0.04, y - s * 0.32);
      ctx.lineTo(x + s * 0.04, y + s * 0.32);
      ctx.lineTo(x - s * 0.18, y + s * 0.1);
      ctx.lineTo(x - s * 0.38, y + s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + s * 0.04, y, s * 0.28, -0.8, 0.8);
      ctx.stroke();
    } else if (kind === 'help') {
      ctx.font = font(s * 1.1, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y + s * 0.04);
    }
    ctx.restore();
  };

  /* ================================================================ мини-труба (карта) */
  A.miniPipe = function (ctx, x, y, s, col, wetCol) {
    // маленькая змейка из трёх сегментов
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = col || P.copperDark;
    ctx.lineWidth = s * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.2);
    ctx.lineTo(x, y - s * 0.2);
    ctx.lineTo(x, y + s * 0.2);
    ctx.lineTo(x + s * 0.4, y + s * 0.2);
    ctx.stroke();
    ctx.strokeStyle = wetCol || P.patina;
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.2);
    ctx.lineTo(x, y - s * 0.2);
    ctx.lineTo(x, y + s * 0.2);
    ctx.lineTo(x + s * 0.4, y + s * 0.2);
    ctx.stroke();
    ctx.restore();
  };

  /* ================================================================ меню-герой */
  /* Витрина механики: медная змейка с бегущей водой, вентиль, сток и пар. */
  A.menuHero = function (ctx, x, y, w, h, t) {
    var ww = Math.min(w * 0.98, h * 2.0, 760);
    var hh = Math.min(h * 0.92, ww * 0.50);
    var cx = x + w / 2, cy = y + h / 2;
    var x0 = cx - ww / 2, y0 = cy - hh / 2;
    var pw = hh * 0.23;

    // бирюзовое свечение под трубой
    var rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, ww * 0.52);
    rg.addColorStop(0, 'rgba(70,224,208,0.15)');
    rg.addColorStop(0.6, 'rgba(47,179,168,0.05)');
    rg.addColorStop(1, 'rgba(70,224,208,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x, y, w, h);

    var p0 = [x0, y0 + hh * 0.20];
    var p1 = [x0 + ww * 0.22, y0 + hh * 0.20];
    var p2 = [x0 + ww * 0.22, y0 + hh * 0.80];
    var p3 = [x0 + ww * 0.55, y0 + hh * 0.80];
    var p4 = [x0 + ww * 0.55, y0 + hh * 0.32];
    var p5 = [x0 + ww * 0.84, y0 + hh * 0.32];

    var segs = [[p0, p1], [p1, p2], [p2, p3], [p3, p4], [p4, p5]];
    var phase = (t * 0.46) % 2.4;
    for (var i = 0; i < segs.length; i++) {
      var wet = clamp((phase - i * 0.30) / 0.32, 0, 1);
      if (phase > 1.2) wet = clamp(((2.4 - phase) * 2.2 - i * 0.3) / 0.32, 0, 1);
      pipeSeg(ctx, segs[i][0][0], segs[i][0][1], segs[i][1][0], segs[i][1][1], pw, wet);
    }

    // колена — фланцы с двух сторон
    flange(ctx, p1[0], p1[1], 3, pw, 0);
    flange(ctx, p1[0], p1[1], 2, pw, 0);
    flange(ctx, p2[0], p2[1], 1, pw, 0);
    flange(ctx, p2[0], p2[1], 0, pw, 0);
    flange(ctx, p3[0], p3[1], 3, pw, 0);
    flange(ctx, p3[0], p3[1], 0, pw, 0);
    flange(ctx, p4[0], p4[1], 1, pw, 0);
    flange(ctx, p4[0], p4[1], 2, pw, 0);

    // кран слева: стойка и вентиль
    pipeSeg(ctx, p0[0] - hh * 0.20, p0[1], p0[0], p0[1], pw, phase > 0.4 ? 1 : 0);
    var bx = p0[0] - hh * 0.20;
    var bg2 = ctx.createLinearGradient(bx - pw * 0.8, 0, bx + pw * 0.8, 0);
    bg2.addColorStop(0, '#5b2f14');
    bg2.addColorStop(0.35, '#d98d4e');
    bg2.addColorStop(1, '#2a1508');
    ctx.fillStyle = bg2;
    rr(ctx, bx - pw * 0.7, p0[1] - hh * 0.34, pw * 1.4, hh * 0.36, pw * 0.4);
    ctx.fill();
    A.valve(ctx, bx, p0[1] - hh * 0.36, hh * 0.15, t * 0.5, P.brass);

    // сток справа: раструб и капли
    var rx = p5[0] + hh * 0.10;
    ctx.beginPath();
    ctx.moveTo(p5[0], p5[1] - pw * 0.62);
    ctx.lineTo(rx, p5[1] - pw * 0.95);
    ctx.lineTo(rx, p5[1] + pw * 0.95);
    ctx.lineTo(p5[0], p5[1] + pw * 0.62);
    ctx.closePath();
    var dg = ctx.createLinearGradient(p5[0], 0, rx, 0);
    dg.addColorStop(0, '#a8632e');
    dg.addColorStop(0.5, '#d98d4e');
    dg.addColorStop(1, '#2a1508');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = '#2a1508';
    ctx.lineWidth = Math.max(1, pw * 0.08);
    ctx.stroke();
    if (phase > 1.1) {
      for (var d = 0; d < 3; d++) {
        var dy = ((t * 1.4 + d * 0.33) % 1);
        ctx.globalAlpha = 0.8 * (1 - dy);
        ctx.beginPath();
        ctx.ellipse(rx + pw * 0.2 + d * pw * 0.2, p5[1] + pw * 0.6 + dy * hh * 0.22, pw * 0.11, pw * 0.18, 0, 0, Math.PI * 2);
        ctx.fillStyle = P.water;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // пар над изгибами
    A.steam(ctx, p1[0], p1[1] - hh * 0.12, hh * 0.3, (t * 0.6) % 1);
    A.steam(ctx, p4[0], p4[1] - hh * 0.12, hh * 0.28, (t * 0.45 + 0.5) % 1);
  };

  /* ================================================================ промо */
  function promoPipe(ctx, cx, cy, size, rng, wetAll) {
    var pw = size * 0.19;
    var p0 = [cx - size * 0.5, cy - size * 0.26];
    var p1 = [cx - size * 0.05, cy - size * 0.26];
    var p2 = [cx - size * 0.05, cy + size * 0.16];
    var p3 = [cx + size * 0.42, cy + size * 0.16];
    var segs = [[p0, p1], [p1, p2], [p2, p3]];
    for (var i = 0; i < segs.length; i++) {
      pipeSeg(ctx, segs[i][0][0], segs[i][0][1], segs[i][1][0], segs[i][1][1], pw, wetAll ? 1 : 0);
    }
    flange(ctx, p1[0], p1[1], 0, pw, 0);
    flange(ctx, p1[0] - 1, p1[1], 2, pw, 0);
    flange(ctx, p3[0] - 1, p3[1], 1, pw, 0);
  }

  function rivets(ctx, w, h, n) {
    for (var i = 0; i < n; i++) {
      var x = w * (0.06 + hash(i * 3.1) * 0.88);
      var y = h * (0.06 + hash(i * 7.7) * 0.88);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, Math.min(w, h) * 0.006), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(184,115,51,0.22)';
      ctx.fill();
    }
  }

  function promoBg(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0d2b30');
    g.addColorStop(0.55, P.bg);
    g.addColorStop(1, '#041013');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    var rg = ctx.createRadialGradient(w * 0.36, h * 0.48, 2, w * 0.36, h * 0.5, Math.max(w, h) * 0.6);
    rg.addColorStop(0, 'rgba(47,179,168,0.26)');
    rg.addColorStop(0.45, 'rgba(184,115,51,0.10)');
    rg.addColorStop(1, 'rgba(4,16,19,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    rivets(ctx, w, h, 18);
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};

    promoBg(ctx, w, h);

    function fit(text, size, maxW, weight) {
      var s = size;
      ctx.font = font(s, weight || 700);
      while (s > 11 && ctx.measureText(text).width > maxW) {
        s -= 1;
        ctx.font = font(s, weight || 700);
      }
      return s;
    }

    if (kind === 'icon') {
      // без текста: крупная медная змейка с водой и каплей
      var s = Math.min(w, h);
      var rg = ctx.createRadialGradient(w * 0.5, h * 0.48, 2, w * 0.5, h * 0.5, s * 0.56);
      rg.addColorStop(0, 'rgba(47,179,168,0.30)');
      rg.addColorStop(0.55, 'rgba(47,179,168,0.06)');
      rg.addColorStop(1, 'rgba(4,16,19,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(-0.06);
      promoPipe(ctx, 0, 0, s * 0.96, rng, true);
      ctx.restore();
      // капля справа снизу
      ctx.beginPath();
      ctx.moveTo(w * 0.75, h * 0.70);
      ctx.quadraticCurveTo(w * 0.85, h * 0.79, w * 0.75, h * 0.87);
      ctx.quadraticCurveTo(w * 0.65, h * 0.79, w * 0.75, h * 0.70);
      ctx.fillStyle = 'rgba(200,255,247,0.92)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.76, s * 0.012, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      return;
    }

    // обложка: арт слева, текст справа
    var artS = Math.min(h * 0.9, w * 0.44);
    ctx.save();
    ctx.translate(w * 0.25, h * 0.52);
    ctx.rotate(-0.05);
    promoPipe(ctx, 0, 0, artS * 0.9, rng, true);
    ctx.restore();

    var tx = Math.max(w * 0.44, w * 0.25 + artS * 0.5);
    var maxW = w - tx - h * 0.06;
    var name = title || dict.title || 'Pipe Flow';
    var size = fit(name, h * 0.16, maxW, 800);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = P.gold;
    ctx.font = font(size, 800);
    ctx.fillText(name, tx, h * 0.30);

    // подчёркивание
    ctx.strokeStyle = 'rgba(47,179,168,0.85)';
    ctx.lineWidth = Math.max(2, h * 0.012);
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.40);
    ctx.lineTo(tx + Math.min(maxW, ctx.measureText(name).width + h * 0.08), h * 0.40);
    ctx.stroke();

    var tag = dict.cover_tag || '';
    var ts = fit(tag, h * 0.056, maxW, 600);
    ctx.font = font(ts, 600);
    ctx.fillStyle = P.cream;
    ctx.fillText(tag, tx, h * 0.49);

    var line = dict.cover_line || '';
    var ls = fit(line, h * 0.044, maxW, 500);
    ctx.font = font(ls, 500);
    ctx.fillStyle = 'rgba(233,245,242,0.68)';
    ctx.fillText(line, tx, h * 0.58);

    // три мини-трубы под текстом
    var cs = h * 0.08;
    for (var i = 0; i < 3; i++) {
      var bx = tx + i * cs * 1.3;
      var by = h * 0.69;
      rr(ctx, bx, by, cs, cs, cs * 0.22);
      ctx.fillStyle = 'rgba(10,34,38,0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(184,115,51,0.6)';
      ctx.lineWidth = Math.max(1, cs * 0.06);
      ctx.stroke();
      A.miniPipe(ctx, bx + cs / 2, by + cs / 2, cs * 0.7, P.copper, P.water);
    }
  };

  G.art = A;
})(window.GAME);
