/* game/art.js — процедурная графика «Пиксель-Кода»: неоновая мозаика, сканлайны,
   клетки-блоки, иконки лавки и промо (иконка 512×512 без текста, обложка 800×470).
   Файл самодостаточен: промо-страница загружает только config.js + i18n.js + art.js,
   поэтому здесь нет обращений к window.Engine и нет ни одного внешнего ассета. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var A = {};
  var C = G.config;
  var P = C.palette;

  /* ---------------- базовые хелперы ---------------- */
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
  function font(size, weight) {
    return (weight || 700) + ' ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }
  function mono(size, weight) {
    return (weight || 700) + ' ' + Math.round(size) + 'px Consolas, "SFMono-Regular", "Courier New", monospace';
  }
  function text(ctx, str, x, y, size, color, align, weight) {
    ctx.font = font(size, weight);
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function fitText(ctx, str, maxW, size, weight) {
    var s = size;
    ctx.font = font(s, weight);
    while (s > 9 && ctx.measureText(str).width > maxW) {
      s -= 1;
      ctx.font = font(s, weight);
    }
    return s;
  }
  /* Простой детерминированный ГПСЧ (mulberry32) — только для декора, не для логики. */
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  A.prng = prng;

  /* ---------------- фон ---------------- */
  var DUST = (function () {
    var r = prng(0x5eed1);
    var out = [];
    for (var i = 0; i < 84; i++) {
      out.push({ x: r(), y: r(), s: 1 + Math.floor(r() * 2), ph: r() * 6.28, sp: 0.4 + r() * 1.4 });
    }
    return out;
  })();
  var scanCanvas = null;

  A.bg = function (ctx, w, h, t, tint) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#120826');
    g.addColorStop(0.55, '#0a0614');
    g.addColorStop(1, '#160a2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var rad = Math.max(w, h);
    var rg = ctx.createRadialGradient(w * 0.16 + Math.sin(t * 0.13) * w * 0.03, h * 0.1, 2, w * 0.16, h * 0.12, rad * 0.8);
    rg.addColorStop(0, 'rgba(168,85,247,0.22)');
    rg.addColorStop(0.5, 'rgba(168,85,247,0.06)');
    rg.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);

    var cg = ctx.createRadialGradient(w * 0.88, h * 0.82, 2, w * 0.88, h * 0.82, rad * 0.7);
    cg.addColorStop(0, 'rgba(34,211,238,0.16)');
    cg.addColorStop(0.55, 'rgba(34,211,238,0.04)');
    cg.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);

    var pg = ctx.createRadialGradient(w * 0.5, h * 1.04, 2, w * 0.5, h * 1.04, rad * 0.55);
    pg.addColorStop(0, 'rgba(244,114,182,0.10)');
    pg.addColorStop(1, 'rgba(244,114,182,0)');
    ctx.fillStyle = pg; ctx.fillRect(0, 0, w, h);

    // пиксельная пыль
    for (var i = 0; i < DUST.length; i++) {
      var d = DUST[i];
      var a = 0.10 + 0.22 * (0.5 + 0.5 * Math.sin(t * d.sp + d.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 5 === 0 ? (tint || P.cyan) : '#c4b5fd';
      ctx.fillRect(Math.round(d.x * w), Math.round(d.y * h), d.s, d.s);
    }
    ctx.globalAlpha = 1;

    var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, rad * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  };

  A.scanlines = function (ctx, w, h, alpha) {
    if (!scanCanvas) {
      scanCanvas = ctx.canvas.ownerDocument.createElement('canvas');
      scanCanvas.width = 4; scanCanvas.height = 3;
      var sc = scanCanvas.getContext('2d');
      sc.fillStyle = 'rgba(255,255,255,0.06)';
      sc.fillRect(0, 0, 4, 1);
    }
    var pat = ctx.createPattern(scanCanvas, 'repeat');
    if (!pat) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  /* ---------------- элементы интерфейса ---------------- */
  A.pill = function (ctx, x, y, w, h, fill, stroke, lw) {
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  };

  A.glowRect = function (ctx, x, y, w, h, r, color, blur, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.5 : alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  };

  A.coin = function (ctx, x, y, r) {
    var g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, '#ffe9a3');
    g.addColorStop(0.55, P.gold);
    g.addColorStop(1, '#b97f16');
    ctx.save();
    ctx.shadowColor = 'rgba(255,209,102,0.55)';
    ctx.shadowBlur = r * 1.3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, r * 0.16); ctx.strokeStyle = 'rgba(120,80,10,0.55)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(x - r * 0.32, y - r * 0.4, r * 0.18, r * 0.18);
  };

  /* Пиксельное сердце (жизни): 7×6 блоков. */
  A.HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  A.heart = function (ctx, x, y, s, on, color) {
    var mask = A.HEART, cols = 7, rows = 6;
    var b = s / 7;
    ctx.save();
    if (on) { ctx.shadowColor = color || P.bad; ctx.shadowBlur = s * 0.35; }
    ctx.fillStyle = on ? (color || P.bad) : 'rgba(143,130,201,0.28)';
    var ox = x - (cols * b) / 2, oy = y - (rows * b) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (mask[r].charAt(c) === '#') ctx.fillRect(ox + c * b, oy + r * b, Math.ceil(b * 0.92), Math.ceil(b * 0.92));
      }
    }
    ctx.restore();
  };

  A.shopIcon = function (ctx, id, x, y, s, color) {
    ctx.save();
    ctx.strokeStyle = color || P.cyanHi;
    ctx.fillStyle = color || P.cyanHi;
    ctx.lineWidth = Math.max(1.6, s * 0.08);
    ctx.lineCap = 'round';
    var u = s / 2;
    if (id === 'hint') {
      ctx.beginPath(); ctx.arc(x, y - u * 0.16, u * 0.46, Math.PI * 0.86, Math.PI * 2.14); ctx.stroke();
      ctx.fillRect(x - u * 0.26, y + u * 0.3, u * 0.52, u * 0.16);
      ctx.fillRect(x - u * 0.18, y + u * 0.5, u * 0.36, u * 0.12);
      for (var i = 0; i < 3; i++) {
        var a = -Math.PI / 2 + (i - 1) * 0.8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * u * 0.72, y - u * 0.16 + Math.sin(a) * u * 0.72);
        ctx.lineTo(x + Math.cos(a) * u * 0.95, y - u * 0.16 + Math.sin(a) * u * 0.95);
        ctx.stroke();
      }
    } else if (id === 'eraser') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.42);
      rr(ctx, -u * 0.62, -u * 0.34, u * 1.24, u * 0.68, u * 0.14); ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-u * 0.62, -u * 0.34, u * 0.46, u * 0.68);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (id === 'life') {
      A.heart(ctx, x, y, s * 0.92, true, color || P.bad);
    } else if (id === 'shop') {
      rr(ctx, x - u * 0.6, y - u * 0.42, u * 1.2, u * 0.9, u * 0.16); ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - u * 0.42, u * 0.3, Math.PI, 0);
      ctx.stroke();
    } else if (id === 'pause') {
      ctx.fillRect(x - u * 0.4, y - u * 0.46, u * 0.26, u * 0.92);
      ctx.fillRect(x + u * 0.14, y - u * 0.46, u * 0.26, u * 0.92);
    } else if (id === 'lock') {
      rr(ctx, x - u * 0.5, y - u * 0.1, u * 1.0, u * 0.72, u * 0.16); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - u * 0.1, u * 0.32, Math.PI, 0); ctx.stroke();
    } else if (id === 'check') {
      ctx.beginPath();
      ctx.moveTo(x - u * 0.5, y);
      ctx.lineTo(x - u * 0.12, y + u * 0.4);
      ctx.lineTo(x + u * 0.54, y - u * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------------- поле нонограммы ---------------- */
  /* Фоновая панель поля: тёмная плита, тонкая сетка, акцентные линии каждые 5 клеток. */
  A.boardBg = function (ctx, x, y, cell, n, tint) {
    var w = cell * n;
    rr(ctx, x - 6, y - 6, w + 12, w + 12, 14);
    ctx.fillStyle = 'rgba(10,6,20,0.72)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(168,85,247,0.34)';
    ctx.stroke();

    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var cx = x + c * cell, cy = y + r * cell;
        ctx.fillStyle = ((r + c) & 1) ? 'rgba(255,255,255,0.028)' : 'rgba(255,255,255,0.012)';
        ctx.fillRect(cx, cy, cell, cell);
      }
    }
    // акцентные линии каждые 5 клеток
    ctx.strokeStyle = (tint ? tint : P.cyan) + '33';
    ctx.lineWidth = 1;
    for (var k = 5; k < n; k += 5) {
      ctx.beginPath(); ctx.moveTo(x + k * cell + 0.5, y); ctx.lineTo(x + k * cell + 0.5, y + w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + k * cell + 0.5); ctx.lineTo(x + w, y + k * cell + 0.5); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(168,85,247,0.12)';
    for (var i = 1; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * cell + 0.5, y); ctx.lineTo(x + i * cell + 0.5, y + w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + i * cell + 0.5); ctx.lineTo(x + w, y + i * cell + 0.5); ctx.stroke();
    }
  };

  /* Клетка. state: 0 пусто, 1 закрашено, 2 крестик, 3 ошибка.
     pulse 0..1 — вспышка только что поставленной клетки. */
  A.cell = function (ctx, x, y, s, state, tint, pulse) {
    var pad = Math.max(1, s * 0.06);
    var ix = x + pad, iy = y + pad, iw = s - pad * 2, ih = s - pad * 2;
    var r = Math.max(1.5, s * 0.14);
    if (state === 1) {
      // мягкое свечение (без shadowBlur — дешёвая имитация)
      ctx.fillStyle = 'rgba(34,211,238,0.10)';
      rr(ctx, ix - s * 0.1, iy - s * 0.1, iw + s * 0.2, ih + s * 0.2, r * 1.6);
      ctx.fill();
      var g = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
      g.addColorStop(0, P.violet);
      g.addColorStop(1, tint || P.cyan);
      rr(ctx, ix, iy, iw, ih, r);
      ctx.fillStyle = g; ctx.fill();
      // верхний блик
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      rr(ctx, ix + iw * 0.14, iy + ih * 0.12, iw * 0.72, ih * 0.14, r * 0.6);
      ctx.fill();
      if (pulse > 0) {
        ctx.globalAlpha = pulse * 0.85;
        ctx.fillStyle = '#ffffff';
        rr(ctx, ix, iy, iw, ih, r); ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (state === 2) {
      ctx.strokeStyle = 'rgba(196,181,253,0.62)';
      ctx.lineWidth = Math.max(1.5, s * 0.10);
      ctx.lineCap = 'round';
      var q = s * 0.30;
      ctx.beginPath();
      ctx.moveTo(x + q, y + q); ctx.lineTo(x + s - q, y + s - q);
      ctx.moveTo(x + s - q, y + q); ctx.lineTo(x + q, y + s - q);
      ctx.stroke();
    } else if (state === 3) {
      rr(ctx, ix, iy, iw, ih, r);
      ctx.fillStyle = 'rgba(255,92,122,0.28)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,92,122,0.95)';
      ctx.lineWidth = Math.max(1.5, s * 0.09);
      var qq = s * 0.30;
      ctx.beginPath();
      ctx.moveTo(x + qq, y + qq); ctx.lineTo(x + s - qq, y + s - qq);
      ctx.moveTo(x + s - qq, y + qq); ctx.lineTo(x + qq, y + s - qq);
      ctx.stroke();
    }
  };

  /* Цифра-подсказка. mode: 'normal' | 'done' | 'over'. */
  A.clue = function (ctx, num, x, y, size, mode) {
    var col = P.text;
    if (mode === 'done') col = 'rgba(143,130,201,0.45)';
    else if (mode === 'over') col = P.bad;
    ctx.font = mono(size, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode !== 'done') {
      ctx.save();
      ctx.shadowColor = mode === 'over' ? 'rgba(255,92,122,0.6)' : 'rgba(34,211,238,0.35)';
      ctx.shadowBlur = size * 0.5;
      ctx.fillStyle = col;
      ctx.fillText(String(num), x, y + 1);
      ctx.restore();
    } else {
      ctx.fillStyle = col;
      ctx.fillText(String(num), x, y + 1);
    }
  };

  /* ---------------- логотип-мозаика ---------------- */
  /* 7×7 пиксельный «квадратный зверь»: закрашенные клетки загораются волной. */
  A.MARK = [
    '..####.',
    '.######',
    '##.##.#',
    '#######',
    '#######',
    '.#.#.#.',
    '.#..#..'
  ];
  A.logoMark = function (ctx, cx, cy, size, t, tint) {
    var n = 7, b = size / n;
    var ox = cx - size / 2, oy = cy - size / 2;
    ctx.save();
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var on = A.MARK[r].charAt(c) === '#';
        var x = ox + c * b, y = oy + r * b;
        if (on) {
          var delay = (r + c) * 0.12;
          var k = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 - delay));
          ctx.globalAlpha = 0.55 + 0.45 * k;
          var g = ctx.createLinearGradient(x, y, x + b, y + b);
          g.addColorStop(0, P.violet);
          g.addColorStop(1, tint || P.cyan);
          ctx.fillStyle = g;
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(168,85,247,0.10)';
        }
        rr(ctx, x + b * 0.06, y + b * 0.06, b * 0.88, b * 0.88, b * 0.16);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // сетка поверх
    ctx.strokeStyle = 'rgba(10,6,20,0.5)';
    ctx.lineWidth = Math.max(1, b * 0.06);
    for (var i = 1; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i * b, oy); ctx.lineTo(ox + i * b, oy + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + i * b); ctx.lineTo(ox + size, oy + i * b); ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------------- промо ---------------- */
  var ICON = [
    '..#####..',
    '.#######.',
    '#########',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
    '.........'
  ];

  function drawCellIcon(ctx, x, y, s, filled, rng) {
    var pad = Math.max(1.5, s * 0.08);
    if (filled) {
      var g = ctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, P.violet);
      g.addColorStop(1, P.cyan);
      ctx.save();
      ctx.shadowColor = 'rgba(34,211,238,0.55)';
      ctx.shadowBlur = s * 0.45;
      rr(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.16);
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      rr(ctx, x + s * 0.2, y + s * 0.18, s * 0.6, s * 0.14, s * 0.07); ctx.fill();
    } else if (rng && rng() < 0.16) {
      ctx.strokeStyle = 'rgba(196,181,253,0.5)';
      ctx.lineWidth = Math.max(1.6, s * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.32, y + s * 0.32); ctx.lineTo(x + s * 0.68, y + s * 0.68);
      ctx.moveTo(x + s * 0.68, y + s * 0.32); ctx.lineTo(x + s * 0.32, y + s * 0.68);
      ctx.stroke();
    }
  }

  function promoIcon(ctx, w, h, rng) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a0b34');
    g.addColorStop(0.6, '#0d0620');
    g.addColorStop(1, '#150a2c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    var rg = ctx.createRadialGradient(w * 0.5, h * 0.46, w * 0.04, w * 0.5, h * 0.5, w * 0.62);
    rg.addColorStop(0, 'rgba(168,85,247,0.45)');
    rg.addColorStop(0.5, 'rgba(34,211,238,0.10)');
    rg.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);

    // сетка 9×9 с сердцем
    var n = 9, cell = w * 0.086, bx = (w - cell * n) / 2, by = (h - cell * n) / 2;
    ctx.save();
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.strokeStyle = 'rgba(168,85,247,0.55)';
    rr(ctx, bx - cell * 0.35, by - cell * 0.35, cell * n + cell * 0.7, cell * n + cell * 0.7, w * 0.06);
    ctx.stroke();
    ctx.restore();
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var on = ICON[r].charAt(c) === '#';
        drawCellIcon(ctx, bx + c * cell, by + r * cell, cell, on, on ? null : rng);
      }
    }
    // уголки-рамка
    ctx.strokeStyle = 'rgba(34,211,238,0.8)';
    ctx.lineWidth = Math.max(2, w * 0.011);
    var L = w * 0.09;
    var corners = [[w * 0.06, w * 0.06, 1, 1], [w * 0.94, w * 0.06, -1, 1], [w * 0.06, h - w * 0.06, 1, -1], [w * 0.94, h - w * 0.06, -1, -1]];
    for (var i = 0; i < corners.length; i++) {
      var cx = corners[i][0], cy = corners[i][1], sx = corners[i][2], sy = corners[i][3];
      ctx.beginPath();
      ctx.moveTo(cx, cy + L * sy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + L * sx, cy);
      ctx.stroke();
    }
    A.scanlines(ctx, w, h, 0.7);
  }

  function maskClues(mask) {
    var n = mask.length, rows = [], cols = [], r, c, i;
    function cl(vals) {
      var out = [], run = 0;
      for (i = 0; i < vals.length; i++) {
        if (vals[i]) run++;
        else if (run) { out.push(run); run = 0; }
      }
      if (run) out.push(run);
      return out;
    }
    for (r = 0; r < n; r++) {
      var row = [];
      for (c = 0; c < n; c++) row.push(mask[r].charAt(c) === '#' ? 1 : 0);
      rows.push(cl(row));
    }
    for (c = 0; c < n; c++) {
      var col = [];
      for (r = 0; r < n; r++) col.push(mask[r].charAt(c) === '#' ? 1 : 0);
      cols.push(cl(col));
    }
    return { rows: rows, cols: cols };
  }

  function promoCover(ctx, w, h, rng, title) {
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#160a2e');
    g.addColorStop(0.55, '#0b0617');
    g.addColorStop(1, '#1c0c33');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    var rg = ctx.createRadialGradient(w * 0.74, h * 0.5, 4, w * 0.74, h * 0.5, w * 0.5);
    rg.addColorStop(0, 'rgba(168,85,247,0.30)');
    rg.addColorStop(0.6, 'rgba(34,211,238,0.06)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);

    // поле справа: недособранная нонограмма с настоящими цифрами этого образа
    var n = 9, gx = w * 0.60;
    var cell = Math.min(h * 0.078, (w - 16 - gx) / n);
    var clueW = cell * 0.95, clueH = cell * 0.95;
    var gy = (h - cell * n) / 2 + cell * 0.30;
    var clues = maskClues(ICON);
    ctx.save();
    ctx.strokeStyle = 'rgba(168,85,247,0.4)';
    ctx.lineWidth = 2;
    rr(ctx, gx - clueW - cell * 0.12, gy - clueH - cell * 0.12, cell * n + clueW + cell * 0.24, cell * n + clueH + cell * 0.24, 14);
    ctx.stroke();
    ctx.restore();
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var on = ICON[r].charAt(c) === '#';
        drawCellIcon(ctx, gx + c * cell, gy + r * cell, cell, on, on ? null : rng);
      }
    }
    // цифры-подсказки: строки справа налево, столбцы снизу вверх
    ctx.save();
    ctx.font = mono(cell * 0.44, 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(196,181,253,0.8)';
    var cw = cell * 0.5;
    for (var i = 0; i < n; i++) {
      var rc2 = clues.rows[i];
      var tw = rc2.length * cw;
      for (var k = 0; k < rc2.length; k++) {
        ctx.fillText(String(rc2[k]), gx - 13 - tw + k * cw + cw / 2, gy + i * cell + cell / 2);
      }
      var cc2 = clues.cols[i];
      for (var j = 0; j < cc2.length; j++) {
        ctx.fillText(String(cc2[j]), gx + i * cell + cell / 2, gy - 12 - (cc2.length - 1 - j) * (cell * 0.46));
      }
    }
    ctx.restore();

    // текст слева
    var x = w * 0.055;
    var size = Math.min(h * 0.22, 92);
    size = fitText(ctx, title || 'Pixel Code', w * 0.50, size, 800);
    ctx.font = font(size, 800);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(168,85,247,0.75)';
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = P.text;
    ctx.fillText(title || 'Pixel Code', x, h * 0.4);
    ctx.restore();
    var tg = ctx.createLinearGradient(x, 0, x + w * 0.45, 0);
    tg.addColorStop(0, P.cyan);
    tg.addColorStop(1, P.violet);
    ctx.fillStyle = tg;
    ctx.fillRect(x, h * 0.4 + size * 0.52, Math.min(w * 0.34, 300), Math.max(3, h * 0.008));

    var dict = {};
    try {
      var lang = 'ru';
      try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
      dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};
    } catch (e) {}
    var tag = dict['cover_tag'] || '';
    var line = dict['cover_line'] || '';
    var s2 = fitText(ctx, tag, w * 0.48, h * 0.075, 700);
    ctx.font = font(s2, 700);
    ctx.fillStyle = P.cyanHi;
    ctx.fillText(tag, x, h * 0.58);
    var s3 = fitText(ctx, line, w * 0.48, h * 0.055, 600);
    ctx.font = font(s3, 600);
    ctx.fillStyle = 'rgba(237,233,254,0.72)';
    ctx.fillText(line, x, h * 0.70);
    A.scanlines(ctx, w, h, 0.55);
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    var r = rng || prng(1);
    if (kind === 'icon') { promoIcon(ctx, w, h, r); return; }
    promoCover(ctx, w, h, r, title);
  };

  G.art = A;
})(window.GAME);
