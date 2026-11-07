/* game/art.js — процедурная графика «Домино-Цепи»: ярмарочное дерево и крем,
   красные точки, гирлянда костяшек. Ни одного внешнего файла и ни одного URL.
   Файл подключается и без движка (pipeline/promo.html), поэтому Engine здесь
   не используется вовсе. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config || { palette: {} };
  var P = C.palette || {};
  var A = {};

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  A.rr = rr;

  /* ---------- стол ---------- */
  /* Тёмное дерево с волокном, затем кремовая скатерть с красными точками. */
  A.table = function (ctx, w, h, seed) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a1a0c');
    g.addColorStop(0.5, '#1f1409');
    g.addColorStop(1, '#150d06');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    var s = seed || 1;
    ctx.strokeStyle = 'rgba(120,80,40,0.10)';
    ctx.lineWidth = Math.max(1, h * 0.002);
    for (var i = 0; i < 22; i++) {
      var y = ((i * 97 + s * 13) % 100) / 100 * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y + 3);
      ctx.stroke();
    }
  };

  /* Кремовая скатерть: полотно, красный горох, мягкая тень по краю. */
  A.cloth = function (ctx, x, y, w, h, seed) {
    var s = seed || 3;
    var rad = Math.min(w, h) * 0.035;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.min(w, h) * 0.05;
    ctx.shadowOffsetY = Math.min(w, h) * 0.015;
    var g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    g.addColorStop(0, '#f7ecd2');
    g.addColorStop(0.55, '#f0e0bf');
    g.addColorStop(1, '#e2cfa9');
    rr(ctx, x, y, w, h, rad);
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, x, y, w, h, rad);
    ctx.clip();
    // горох
    var step = Math.max(26, Math.min(w, h) * 0.075);
    ctx.fillStyle = 'rgba(192,57,43,0.13)';
    for (var gy = y + step * 0.7, ry = 0; gy < y + h + step; gy += step, ry++) {
      for (var gx = x + step * 0.6 + (ry % 2) * step * 0.5, rx = 0; gx < x + w + step; gx += step, rx++) {
        if (((rx * 7 + ry * 3 + s) % 5) === 0) continue;
        ctx.beginPath();
        ctx.arc(gx, gy, step * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // край скатерти — тонкая красная нить
    ctx.strokeStyle = 'rgba(192,57,43,0.28)';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004);
    ctx.beginPath();
    ctx.moveTo(x + step * 0.9, y + 0.5); ctx.lineTo(x + w - step * 0.9, y + 0.5);
    ctx.stroke();
    // затемнение к краям
    var vg = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(60,36,14,0)');
    vg.addColorStop(1, 'rgba(60,36,14,0.20)');
    ctx.fillStyle = vg; ctx.fillRect(x, y, w, h);
    ctx.restore();
    // деревянная окантовка
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.012);
    ctx.strokeStyle = 'rgba(90,56,24,0.85)';
    rr(ctx, x, y, w, h, rad);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004);
    ctx.strokeStyle = 'rgba(255,240,210,0.35)';
    rr(ctx, x + ctx.lineWidth * 1.6, y + ctx.lineWidth * 1.6, w - ctx.lineWidth * 3.2, h - ctx.lineWidth * 3.2, rad * 0.9);
    ctx.stroke();
  };

  /* ---------- гирлянда флажков ---------- */
  A.bunting = function (ctx, w, y, t, seed) {
    var cols = ['#c0392b', '#f0c14b', '#5fae4a', '#e8dcc0', '#3f7fa8'];
    var s = seed || 5;
    ctx.save();
    ctx.strokeStyle = 'rgba(60,36,14,0.55)';
    ctx.lineWidth = Math.max(1.2, w * 0.0022);
    ctx.beginPath();
    for (var x = 0; x <= w; x += 8) {
      var yy = y + Math.sin(x / w * Math.PI * 2 + s) * w * 0.012 + Math.sin(x / w * Math.PI * 5.3) * w * 0.004;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    var n = Math.max(6, Math.round(w / 78));
    var stepX = w / n;
    for (var i = 0; i < n; i++) {
      var fx = stepX * (i + 0.5);
      var fy = y + Math.sin(fx / w * Math.PI * 2 + s) * w * 0.012 + Math.sin(fx / w * Math.PI * 5.3) * w * 0.004;
      var fw = Math.min(stepX * 0.62, 34), fh = fw * 0.95;
      var sway = Math.sin(t * 1.6 + i * 0.7) * fw * 0.05;
      ctx.fillStyle = cols[(i + s) % cols.length];
      ctx.beginPath();
      ctx.moveTo(fx - fw / 2, fy);
      ctx.lineTo(fx + fw / 2, fy);
      ctx.lineTo(fx + sway, fy + fh);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,36,14,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- точки на домино ---------- */
  var PIPS = {
    0: [],
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
  };

  function halfPips(ctx, cx, cy, v, halfW, halfH) {
    var pts = PIPS[v] || [];
    if (!pts.length) return;
    var dx = halfW * 0.60, dy = halfH * 0.28;
    var r = Math.max(1.2, halfH * 0.088);
    for (var i = 0; i < pts.length; i++) {
      var px = cx + pts[i][0] * dx, py = cy + pts[i][1] * dy;
      ctx.beginPath(); ctx.arc(px + r * 0.22, py + r * 0.30, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(90,26,18,0.28)'; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = P.pip || '#c0392b'; ctx.fill();
      ctx.beginPath(); ctx.arc(px - r * 0.30, py - r * 0.34, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,214,190,0.55)'; ctx.fill();
    }
  }

  /* ---------- костяшка ---------- */
  /* a — левая половина, b — правая. angle — поворот вокруг центра. */
  A.domino = function (ctx, cx, cy, len, a, b, angle, opt) {
    opt = opt || {};
    var th = len / 2, hw = len / 2, hh = th / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (angle) ctx.rotate(angle);
    if (opt.scale && opt.scale !== 1) ctx.scale(opt.scale, opt.scale);

    if (opt.shadow !== false) {
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = '#1a0f06';
      rr(ctx, -hw + th * 0.03, -hh + th * 0.07, len, th, th * 0.16);
      ctx.fill();
      ctx.restore();
    }
    var dim = !!opt.dim;
    var g = ctx.createLinearGradient(0, -hh, 0, hh);
    g.addColorStop(0, dim ? '#d9caa9' : '#fff8e6');
    g.addColorStop(0.42, dim ? '#cdbc97' : '#f6e9c9');
    g.addColorStop(1, dim ? '#b6a37e' : '#e3cfa6');
    rr(ctx, -hw, -hh, len, th, th * 0.16);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, th * 0.045);
    ctx.strokeStyle = dim ? 'rgba(77,48,22,0.30)' : 'rgba(77,48,22,0.72)';
    ctx.stroke();

    if (opt.glow) {
      ctx.save();
      ctx.shadowColor = 'rgba(240,193,75,0.95)';
      ctx.shadowBlur = th * 0.55;
      ctx.lineWidth = Math.max(1.6, th * 0.07);
      ctx.strokeStyle = P.gold || '#f0c14b';
      rr(ctx, -hw, -hh, len, th, th * 0.16);
      ctx.stroke();
      ctx.restore();
    }

    // разделитель и «гвоздик» посередине
    ctx.strokeStyle = dim ? 'rgba(77,48,22,0.30)' : 'rgba(77,48,22,0.55)';
    ctx.lineWidth = Math.max(1, th * 0.035);
    ctx.beginPath(); ctx.moveTo(0, -hh * 0.80); ctx.lineTo(0, hh * 0.80); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, th * 0.055, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(77,48,22,0.55)'; ctx.fill();

    halfPips(ctx, -len / 4, 0, a, hw / 2, hh * 2);
    halfPips(ctx, len / 4, 0, b, hw / 2, hh * 2);

    // блик сверху
    ctx.globalAlpha = dim ? 0.10 : 0.35;
    ctx.fillStyle = '#fffdf6';
    rr(ctx, -hw + th * 0.09, -hh + th * 0.07, len - th * 0.18, th * 0.14, th * 0.07);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  /* Рубашка (закрытая кость базара). */
  A.back = function (ctx, cx, cy, len, angle, opt) {
    opt = opt || {};
    var th = len / 2, hw = len / 2, hh = th / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (angle) ctx.rotate(angle);
    if (opt.shadow !== false) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#140b04';
      rr(ctx, -hw + th * 0.05, -hh + th * 0.12, len, th, th * 0.16);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    var g = ctx.createLinearGradient(0, -hh, 0, hh);
    g.addColorStop(0, '#a9713c');
    g.addColorStop(0.5, '#8a5a2e');
    g.addColorStop(1, '#5f3c1c');
    rr(ctx, -hw, -hh, len, th, th * 0.16);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, th * 0.05);
    ctx.strokeStyle = 'rgba(40,22,8,0.8)'; ctx.stroke();
    // крест-накрест красная тесьма
    ctx.strokeStyle = 'rgba(192,57,43,0.75)';
    ctx.lineWidth = Math.max(1.4, th * 0.07);
    ctx.beginPath(); ctx.moveTo(-hw * 0.72, -hh * 0.5); ctx.lineTo(hw * 0.72, hh * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-hw * 0.72, hh * 0.5); ctx.lineTo(hw * 0.72, -hh * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, th * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,193,75,0.9)'; ctx.fill();
    ctx.restore();
  };

  /* ---------- мелочь ---------- */
  A.coin = function (ctx, x, y, r) {
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(0.55, '#f0c14b');
    g.addColorStop(1, '#a8822a');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = 'rgba(120,90,20,0.85)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.52, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,240,190,0.75)'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.stroke();
  };

  A.heart = function (ctx, x, y, s, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.82);
    ctx.bezierCurveTo(-s * 1.45, s * 0.02, -s * 0.68, -s * 1.05, 0, -s * 0.34);
    ctx.bezierCurveTo(s * 0.68, -s * 1.05, s * 1.45, s * 0.02, 0, s * 0.82);
    ctx.closePath();
    if (filled) {
      var g = ctx.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, '#e8604f');
      g.addColorStop(1, '#a82a1f');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = 'rgba(60,30,12,0.35)';
    }
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.strokeStyle = filled ? 'rgba(90,22,14,0.9)' : 'rgba(160,120,80,0.45)';
    ctx.stroke();
    if (filled) {
      ctx.beginPath(); ctx.ellipse(-s * 0.38, -s * 0.30, s * 0.20, s * 0.13, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,200,0.55)'; ctx.fill();
    }
    ctx.restore();
  };

  A.star = function (ctx, x, y, r, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr2 = (i % 2 === 0) ? r : r * 0.45;
      var px = Math.cos(a) * rr2, py = Math.sin(a) * rr2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = col || (P.gold || '#f0c14b');
    ctx.fill();
    ctx.restore();
  };

  /* ---------- путь цепи ---------- */
  function serpentine(rect, rows) {
    var rowH = rect.h / rows;
    var pts = [];
    for (var i = 0; i < rows; i++) {
      var y = rect.y + rowH * (i + 0.5);
      if (i % 2 === 0) { pts.push({ x: rect.x, y: y }); pts.push({ x: rect.x + rect.w, y: y }); }
      else { pts.push({ x: rect.x + rect.w, y: y }); pts.push({ x: rect.x, y: y }); }
    }
    var rad = Math.min(rowH * 0.55, rect.w * 0.10);
    var out = [pts[0]];
    for (var j = 1; j < pts.length - 1; j++) {
      var p0 = pts[j - 1], p1 = pts[j], p2 = pts[j + 1];
      var d1 = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
      var d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      var r = Math.min(rad, d1 / 2, d2 / 2);
      var ax = p1.x + (p0.x - p1.x) / d1 * r, ay = p1.y + (p0.y - p1.y) / d1 * r;
      var bx = p1.x + (p2.x - p1.x) / d2 * r, by = p1.y + (p2.y - p1.y) / d2 * r;
      out.push({ x: ax, y: ay });
      for (var k = 1; k <= 9; k++) {
        var t = k / 9;
        var ix = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * p1.x + t * t * bx;
        var iy = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * p1.y + t * t * by;
        out.push({ x: ix, y: iy });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function pathLength(poly) {
    var cum = [0], total = 0;
    for (var i = 1; i < poly.length; i++) {
      total += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
      cum.push(total);
    }
    return { cum: cum, total: total };
  }

  function sampleAt(poly, cum, at) {
    var j = 1;
    while (j < cum.length - 1 && cum[j] < at) j++;
    var seg = (cum[j] - cum[j - 1]) || 1;
    var k = Math.max(0, Math.min(1, (at - cum[j - 1]) / seg));
    var p = poly[j - 1], q = poly[j];
    return {
      x: p.x + (q.x - p.x) * k,
      y: p.y + (q.y - p.y) * k,
      a: Math.atan2(q.y - p.y, q.x - p.x)
    };
  }

  /* Путь-змейка по столу. Полоса змейки подбирается под длину цепи: n костей
     с нормальным шагом должны заполнить путь, а не висеть в его середине.
     Центр цепи — середина пути, поэтому цепь растёт в обе стороны равномерно. */
  A.chainPath = function (board, n) {
    n = Math.max(1, n);
    var tileTarget = Math.max(56, Math.min(128, Math.min(board.w * 0.155, board.h * 0.30)));
    var pitch = tileTarget * 1.08;
    var needed = n * pitch;
    var rowH = tileTarget * 1.45;
    var rows = Math.max(1, Math.min(6, Math.ceil(needed / Math.max(1, board.w * 0.96))));
    var rowW = Math.max(board.w * 0.55, Math.min(board.w, needed / rows));
    var rh = Math.min(rowH, board.h / rows);
    var rect = {
      x: board.x + (board.w - rowW) / 2,
      y: board.y + Math.max(0, (board.h - rows * rh) / 2),
      w: rowW, h: rows * rh
    };
    var poly = serpentine(rect, rows);
    var pl = pathLength(poly);
    var pitchUse = pl.total / n;
    var tileLen = Math.max(40, Math.min(tileTarget, pitchUse * 0.94));
    // центр цепи — середина «среднего» ряда (при 2 рядах — верхнего),
    // а не середина пути: иначе стартовая кость встала бы на повороте
    var startRow = Math.floor((rows - 1) / 2);
    var anchor = { x: rect.x + rect.w / 2, y: rect.y + rh * (startRow + 0.5) };
    var bestD = Infinity, bestI = 0;
    for (var k = 0; k < poly.length; k++) {
      var dx = poly[k].x - anchor.x, dy = poly[k].y - anchor.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestI = k; }
    }
    var mid = pl.cum[bestI];
    var startIdx = Math.floor((n - 1) / 2);
    var slots = [];
    for (var i = 0; i < n; i++) {
      var at = mid + (i - startIdx) * pitchUse;
      at = Math.max(0.001, Math.min(pl.total - 0.001, at));
      slots.push(sampleAt(poly, pl.cum, at));
    }
    return {
      slots: slots, rows: rows, tileLen: tileLen, tileH: tileLen / 2,
      startIdx: startIdx, poly: poly, total: pl.total, band: rect
    };
  };

  /* Пунктирная «верёвка» под будущую цепь — подсказывает, куда она пойдёт. */
  A.rope = function (ctx, path, alpha) {
    if (!path || !path.poly) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.45 : alpha;
    ctx.strokeStyle = 'rgba(150,100,55,0.45)';
    ctx.lineWidth = Math.max(1.2, path.tileH * 0.055);
    ctx.setLineDash([path.tileH * 0.16, path.tileH * 0.30]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    var poly = path.poly;
    ctx.moveTo(poly[0].x, poly[0].y);
    for (var i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.stroke();
    ctx.restore();
  };

  /* Игрушечный шатёр-навес для меню. */
  A.awning = function (ctx, x, y, w, h, t) {
    var cols = ['#c0392b', '#f2e3c2'];
    var n = 10;
    var sw = w / n;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = h * 0.4;
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = cols[i % 2];
      ctx.beginPath();
      ctx.moveTo(x + i * sw, y);
      ctx.lineTo(x + (i + 1) * sw, y);
      ctx.lineTo(x + (i + 1) * sw, y + h * 0.78);
      ctx.quadraticCurveTo(x + (i + 0.5) * sw, y + h * 1.05, x + i * sw, y + h * 0.78);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // золотая кромка
    ctx.strokeStyle = 'rgba(240,193,75,0.8)';
    ctx.lineWidth = Math.max(1.5, h * 0.09);
    ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + w, y + 1); ctx.stroke();
  };

  /* Декоративная цепь из костяшек для меню (дуга). */
  A.menuChain = function (ctx, x, y, w, h, t) {
    var tiles = [[6, 6], [6, 3], [3, 3], [3, 5], [5, 5], [5, 1], [1, 1], [1, 4]];
    var n = tiles.length;
    var len = Math.min(w / (n * 1.04), h * 0.80);
    var span = Math.min(w, n * len * 1.02);
    var cx = x + w / 2, cy = y + h * 0.62;
    var bend = Math.min(h * 0.42, len * 0.62);
    for (var i = 0; i < n; i++) {
      var k = (i - (n - 1) / 2) / ((n - 1) / 2);
      var px = cx + k * span / 2;
      var py = cy - (1 - k * k) * bend + Math.sin(t * 1.3 + i * 0.55) * 1.6;
      var ang = -k * 0.20 + Math.sin(t * 1.1 + i * 0.4) * 0.02;
      A.domino(ctx, px, py, len * 0.95, tiles[i][0], tiles[i][1], ang, { shadow: true });
    }
  };

  /* ---------- промо ---------- */
  function promoBg(ctx, w, h, rng) {
    var g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, '#3a2410');
    g.addColorStop(0.55, '#241607');
    g.addColorStop(1, '#150c04');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // лучи шатра
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.globalAlpha = 0.07;
    for (var i = 0; i < 14; i++) {
      ctx.rotate(Math.PI * 2 / 14);
      ctx.fillStyle = i % 2 ? '#f0c14b' : '#c0392b';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.max(w, h), -w * 0.06);
      ctx.lineTo(Math.max(w, h), w * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // горох по фону
    var step = Math.min(w, h) * 0.085;
    ctx.fillStyle = 'rgba(242,227,194,0.10)';
    for (var yy = step * 0.5, ry = 0; yy < h; yy += step, ry++) {
      for (var xx = step * 0.5 + (ry % 2) * step * 0.5; xx < w; xx += step) {
        ctx.beginPath(); ctx.arc(xx, yy, step * 0.14, 0, Math.PI * 2); ctx.fill();
      }
    }
    // пушистая тень снизу
    var vg = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.18, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  /* Настоящая связная гирлянда: у соседних костей совпадают точки на стыке.
     Кости ставятся по дуге, угол — по касательной, поэтому цепь читается. */
  function promoGarland(ctx, cx, cy, w, h, rng, count) {
    count = Math.max(3, count);
    var v = [];
    for (var i = 0; i <= count; i++) v.push(1 + Math.floor(rng() * 6));
    var len = Math.min(h * 0.40, w / (count * 1.24));
    var span = count * len * 1.0;
    var bend = Math.min(h * 0.32, len * 0.9);
    for (var k = 0; k < count; k++) {
      var t = (k + 0.5) / count * 2 - 1;
      var px = cx + t * span / 2;
      var py = cy - (1 - t * t) * bend;
      var ang = Math.atan2(2 * t * bend, span / 2);
      A.domino(ctx, px, py, len, v[k], v[k + 1], ang, { shadow: true });
    }
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    var icon = kind === 'icon';
    promoBg(ctx, w, h, rng);
    if (icon) {
      // связная гирлянда внизу + большая кость-герой над ней
      promoGarland(ctx, w * 0.5, h * 0.80, w * 0.99, h * 0.42, rng, 6);
      var len = Math.min(w, h) * 0.56;
      ctx.save();
      ctx.translate(w * 0.5, h * 0.44);
      ctx.rotate(-0.09);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = len * 0.10;
      ctx.shadowOffsetY = len * 0.06;
      A.domino(ctx, 0, 0, len, 6, 3, 0, { shadow: false });
      ctx.restore();
      // красная лента сверху (купол ярмарки)
      ctx.save();
      ctx.translate(w * 0.5, h * 0.12);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(-w * 0.30, h * 0.02);
      ctx.quadraticCurveTo(0, -h * 0.06, w * 0.30, h * 0.02);
      ctx.lineTo(w * 0.30, h * 0.06);
      ctx.quadraticCurveTo(0, -h * 0.02, -w * 0.30, h * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    // обложка: цепь справа, текст слева
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};
    promoGarland(ctx, w * 0.63, h * 0.20, w * 0.70, h * 0.32, rng, 6);
    var tx = w * 0.06;
    var size = h * 0.17;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.round(size) + 'px Georgia, "Times New Roman", serif';
    var name = title || 'Domino Chain';
    while (size > 16 && ctx.measureText(name).width > w * 0.46) {
      size -= 2;
      ctx.font = '800 ' + Math.round(size) + 'px Georgia, "Times New Roman", serif';
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(name, tx + 3, h * 0.44 + 3);
    ctx.fillStyle = P.cloth || '#f2e3c2';
    ctx.fillText(name, tx, h * 0.44);
    // подчёркивание
    ctx.strokeStyle = '#f0c14b';
    ctx.lineWidth = Math.max(3, h * 0.012);
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.525); ctx.lineTo(tx + w * 0.36, h * 0.525);
    ctx.stroke();
    ctx.font = '600 ' + Math.round(h * 0.062) + 'px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f0c14b';
    ctx.fillText(dict['cover_tag'] || '', tx, h * 0.60);
    ctx.font = '500 ' + Math.round(h * 0.048) + 'px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(242,227,194,0.78)';
    ctx.fillText(dict['cover_line'] || '', tx, h * 0.70);
    // три маленькие кости-акцента
    for (var i = 0; i < 3; i++) {
      A.domino(ctx, w * 0.63 + i * h * 0.185, h * 0.74, h * 0.165, [2, 4, 6][i], [5, 2, 3][i], -0.07 + i * 0.07, { shadow: true });
    }
  };

  G.art = A;
})(window.GAME);
