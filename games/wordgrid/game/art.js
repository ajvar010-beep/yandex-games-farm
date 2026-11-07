/* game/art.js — вся графика процедурная: бумага, чернила, рукописная сетка, штампы,
   жетоны слов, иконки лавки и промо (иконка 512×512 и обложка 800×470).
   Ни одного внешнего файла и ни одного обращения к Engine: этот же файл рисует
   промо через pipeline/promo.html, где движка нет. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var P = G.config.palette;
  var A = {};
  var TAU = Math.PI * 2;

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

  function hash(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  A.hash = hash;

  function font(size, weight) {
    return (weight || 600) + ' ' + Math.round(size) + 'px Georgia, "Times New Roman", serif';
  }
  A.font = font;

  /* ---------- бумага ---------- */
  var tex = null;
  function paperTex() {
    if (tex !== null) return tex || null;
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 256;
      var g = c.getContext('2d');
      g.fillStyle = '#f4ead4'; g.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 460; i++) {
        var x = hash(i * 1.73) * 256, y = hash(i * 3.11 + 9) * 256;
        g.globalAlpha = 0.025 + hash(i * 5.9) * 0.055;
        g.fillStyle = hash(i * 7.3) > 0.5 ? '#8b7650' : '#ffffff';
        var s = 1 + hash(i * 2.3) * 2.2;
        g.fillRect(x, y, s, s * 0.7);
      }
      g.globalAlpha = 0.05; g.strokeStyle = '#8b7650'; g.lineWidth = 1;
      for (var y2 = 12; y2 < 256; y2 += 34) {
        if (hash(y2 * 0.21) < 0.35) continue;
        g.beginPath();
        for (var x2 = 0; x2 <= 256; x2 += 32) {
          var yy = y2 + (hash(x2 + y2) - 0.5) * 1.6;
          if (x2 === 0) g.moveTo(x2, yy); else g.lineTo(x2, yy);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      tex = c;
    } catch (e) { tex = false; }
    return tex || null;
  }

  A.paper = function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f8f0dd');
    g.addColorStop(0.45, '#f3e8cf');
    g.addColorStop(1, '#e8d9b8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    var t = paperTex();
    if (t) {
      try {
        var pat = ctx.createPattern(t, 'repeat');
        if (pat) { ctx.globalAlpha = 0.5; ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
      } catch (e) {}
    }
    // тёплые пятна по углам
    var s1 = ctx.createRadialGradient(w * 0.06, h * 0.03, 2, w * 0.06, h * 0.03, Math.max(w, h) * 0.55);
    s1.addColorStop(0, 'rgba(176,132,66,0.10)');
    s1.addColorStop(1, 'rgba(176,132,66,0)');
    ctx.fillStyle = s1; ctx.fillRect(0, 0, w, h);
    var s2 = ctx.createRadialGradient(w * 0.98, h * 0.96, 2, w * 0.98, h * 0.96, Math.max(w, h) * 0.5);
    s2.addColorStop(0, 'rgba(140,96,44,0.10)');
    s2.addColorStop(1, 'rgba(140,96,44,0)');
    ctx.fillStyle = s2; ctx.fillRect(0, 0, w, h);
    var v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.78);
    v.addColorStop(0, 'rgba(86,62,30,0)');
    v.addColorStop(1, 'rgba(86,62,30,0.15)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  };

  /* Рваная чернильная линия: рисует отрезок с лёгким дрожанием. */
  function wobLine(ctx, x1, y1, x2, y2, seed, amp) {
    amp = amp == null ? 0.7 : amp;
    ctx.beginPath();
    var n = 5;
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      var x = x1 + (x2 - x1) * k + (hash(seed + i * 1.7) - 0.5) * amp;
      var y = y1 + (y2 - y1) * k + (hash(seed + i * 2.9 + 3) - 0.5) * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  A.wobLine = wobLine;

  function cellCenter(o, k) {
    var n = o.n;
    return { x: o.gx + (k % n + 0.5) * o.cell, y: o.gy + (Math.floor(k / n) + 0.5) * o.cell };
  }
  A.cellCenter = cellCenter;

  /* ---------- сетка ---------- */
  A.drawBoard = function (ctx, o) {
    var gx = o.gx, gy = o.gy, c = o.cell, n = o.n, W = n * c;
    var accent = o.accent || P.accent;
    var t = o.t || 0;
    var i, j, p, cc;

    // лист под сеткой
    ctx.save();
    ctx.shadowColor = P.shadow;
    ctx.shadowBlur = Math.max(8, c * 0.55);
    ctx.shadowOffsetY = Math.max(3, c * 0.16);
    ctx.fillStyle = '#fdf9ee';
    rr(ctx, gx - 5, gy - 5, W + 10, W + 10, Math.max(8, c * 0.24));
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(176,156,120,0.85)';
    ctx.lineWidth = 1.4;
    rr(ctx, gx - 2, gy - 2, W + 4, W + 4, Math.max(6, c * 0.18));
    ctx.stroke();

    // найденные слова: мягкая заливка клеток + штрих «маркером»
    if (o.foundWords) {
      for (i = 0; i < o.foundWords.length; i++) {
        p = o.foundWords[i];
        if (!p || !p.length) continue;
        for (j = 0; j < p.length; j++) {
          cc = cellCenter(o, p[j]);
          ctx.globalAlpha = 0.10;
          ctx.fillStyle = accent;
          rr(ctx, cc.x - c * 0.42, cc.y - c * 0.42, c * 0.84, c * 0.84, c * 0.18);
          ctx.fill();
        }
        ctx.globalAlpha = 0.17;
        ctx.strokeStyle = accent;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = c * 0.74;
        ctx.beginPath();
        for (j = 0; j < p.length; j++) {
          cc = cellCenter(o, p[j]);
          if (j === 0) ctx.moveTo(cc.x, cc.y); else ctx.lineTo(cc.x, cc.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // подсказка: пульсирующее кольцо на первой букве
    if (o.hint != null && o.hint >= 0) {
      cc = cellCenter(o, o.hint);
      var pul = 0.5 + 0.5 * Math.sin(t * 7.5);
      var r0 = c * (0.40 + 0.05 * pul);
      var gl = ctx.createRadialGradient(cc.x, cc.y, c * 0.1, cc.x, cc.y, c * 0.85);
      gl.addColorStop(0, 'rgba(216,163,58,' + (0.30 + 0.2 * pul) + ')');
      gl.addColorStop(1, 'rgba(216,163,58,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(cc.x, cc.y, c * 0.85, 0, TAU); ctx.fill();
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = Math.max(2, c * 0.075);
      ctx.globalAlpha = 0.55 + 0.45 * pul;
      rr(ctx, cc.x - r0, cc.y - r0, r0 * 2, r0 * 2, r0 * 0.42);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // выбранные клетки
    if (o.sel && o.sel.length) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(224,182,74,0.55)';
      ctx.lineWidth = c * 0.72;
      ctx.beginPath();
      for (i = 0; i < o.sel.length; i++) {
        cc = cellCenter(o, o.sel[i]);
        if (i === 0) ctx.moveTo(cc.x, cc.y); else ctx.lineTo(cc.x, cc.y);
      }
      ctx.stroke();
      for (i = 0; i < o.sel.length; i++) {
        cc = cellCenter(o, o.sel[i]);
        ctx.strokeStyle = 'rgba(196,138,32,0.9)';
        ctx.lineWidth = Math.max(1.5, c * 0.05);
        rr(ctx, cc.x - c * 0.42, cc.y - c * 0.42, c * 0.84, c * 0.84, c * 0.2);
        ctx.stroke();
      }
    }

    // линии сетки
    ctx.strokeStyle = 'rgba(122,104,76,0.40)';
    ctx.lineWidth = Math.max(1, c * 0.028);
    for (i = 0; i <= n; i++) {
      var y = gy + i * c, x = gx + i * c;
      wobLine(ctx, gx, y, gx + W, y, o.seed * 3.1 + i * 1.9, 1.1);
      wobLine(ctx, x, gy, x, gy + W, o.seed * 5.7 + i * 2.3, 1.1);
    }

    // буквы
    var fs = Math.max(12, Math.round(c * 0.5));
    ctx.font = font(fs, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (i = 0; i < o.cells.length; i++) {
      var ch = o.cells[i];
      if (!ch) continue;
      cc = cellCenter(o, i);
      var inSel = o.sel && o.sel.indexOf(i) >= 0;
      var found = o.found && o.found[i];
      ctx.fillStyle = inSel ? '#8a5a12' : (found ? '#8c3a22' : P.ink);
      ctx.globalAlpha = found ? 0.95 : 1;
      ctx.fillText(ch, cc.x, cc.y + c * 0.02);
    }
    ctx.globalAlpha = 1;

    // «нитка» свайпа поверх букв и голова пути
    if (o.sel && o.sel.length > 1) {
      ctx.strokeStyle = 'rgba(200,144,36,0.85)';
      ctx.lineWidth = Math.max(2, c * 0.11);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (i = 0; i < o.sel.length; i++) {
        cc = cellCenter(o, o.sel[i]);
        if (i === 0) ctx.moveTo(cc.x, cc.y); else ctx.lineTo(cc.x, cc.y);
      }
      ctx.stroke();
      cc = cellCenter(o, o.sel[o.sel.length - 1]);
      ctx.fillStyle = '#c49024';
      ctx.beginPath(); ctx.arc(cc.x, cc.y, c * 0.13, 0, TAU); ctx.fill();
    }

  };

  /* ---------- жетон слова ---------- */
  A.chip = function (ctx, x, y, w, h, text, found, accent, opts) {
    opts = opts || {};
    var r = h * 0.34;
    if (found) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.16;
      rr(ctx, x, y, w, h, r); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;
      rr(ctx, x, y, w, h, r); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,252,243,0.72)';
      rr(ctx, x, y, w, h, r); ctx.fill();
      ctx.strokeStyle = opts.pulse ? P.gold : 'rgba(150,132,100,0.62)';
      ctx.lineWidth = opts.pulse ? 2 : 1.2;
      if (opts.pulse) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin((opts.t || 0) * 7);
      }
      ctx.setLineDash([4, 3]);
      rr(ctx, x, y, w, h, r); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    var fs = Math.min(h * 0.56, (w * 0.9) / Math.max(3, text.length) * 1.55);
    fs = Math.max(12, Math.round(fs));
    ctx.font = font(fs, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = found ? accent : P.inkSoft;
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    if (found) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.14, y + h / 2 + 1);
      ctx.lineTo(x + w * 0.86, y + h / 2 + 1);
      ctx.stroke();
    }
  };

  /* ---------- карточка-лист под оверлеи ---------- */
  A.card = function (ctx, x, y, w, h, r) {
    r = r || 16;
    ctx.save();
    ctx.shadowColor = 'rgba(70,50,24,0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fbf4e3';
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(168,146,108,0.95)';
    ctx.lineWidth = 1.6;
    rr(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(168,146,108,0.45)';
    ctx.lineWidth = 1;
    rr(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 4));
    ctx.stroke();
  };

  /* ---------- штамп ---------- */
  A.stamp = function (ctx, cx, cy, r, text, color, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle || 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.4, r * 0.09);
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = color;
    var fs = Math.max(8, Math.min(r * 0.3, (r * 1.5) / Math.max(3, text.length)));
    ctx.font = font(fs, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ---------- монета ---------- */
  A.coin = function (ctx, x, y, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = '#e7b64c'; ctx.fill();
    ctx.strokeStyle = '#a97a22'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU);
    ctx.strokeStyle = 'rgba(122,82,18,0.45)'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
    ctx.fillStyle = '#fbe8ae';
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.36);
    ctx.lineTo(x + r * 0.12, y - r * 0.1);
    ctx.lineTo(x + r * 0.38, y - r * 0.08);
    ctx.lineTo(x + r * 0.17, y + r * 0.1);
    ctx.lineTo(x + r * 0.24, y + r * 0.36);
    ctx.lineTo(x, y + r * 0.2);
    ctx.lineTo(x - r * 0.24, y + r * 0.36);
    ctx.lineTo(x - r * 0.17, y + r * 0.1);
    ctx.lineTo(x - r * 0.38, y - r * 0.08);
    ctx.lineTo(x - r * 0.12, y - r * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /* ---------- иконки (рисуются в квадрате s×s вокруг cx,cy) ---------- */
  A.iconPause = function (ctx, cx, cy, s, color) {
    ctx.fillStyle = color || P.ink;
    rr(ctx, cx - s * 0.26, cy - s * 0.32, s * 0.18, s * 0.64, s * 0.05); ctx.fill();
    rr(ctx, cx + s * 0.08, cy - s * 0.32, s * 0.18, s * 0.64, s * 0.05); ctx.fill();
  };
  A.iconBag = function (ctx, cx, cy, s, color) {
    ctx.strokeStyle = color || P.ink;
    ctx.fillStyle = color || P.ink;
    ctx.lineWidth = s * 0.09;
    rr(ctx, cx - s * 0.3, cy - s * 0.12, s * 0.6, s * 0.46, s * 0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.12, s * 0.17, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#fbf4e3';
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.11, s * 0.07, 0, TAU); ctx.fill();
  };
  A.iconBulb = function (ctx, cx, cy, s, color) {
    var col = color || P.ink;
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.085;
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.06, s * 0.24, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.1, cy + s * 0.16); ctx.lineTo(cx - s * 0.1, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.3); ctx.lineTo(cx + s * 0.1, cy + s * 0.16);
    ctx.stroke();
    ctx.lineWidth = s * 0.06;
    for (var i = 0; i < 4; i++) {
      var a = -Math.PI * 0.75 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.32, cy - s * 0.06 + Math.sin(a) * s * 0.32);
      ctx.lineTo(cx + Math.cos(a) * s * 0.46, cy - s * 0.06 + Math.sin(a) * s * 0.46);
      ctx.stroke();
    }
  };
  A.iconShuffle = function (ctx, cx, cy, s, color) {
    var col = color || P.ink;
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.085; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy - s * 0.18);
    ctx.lineTo(cx + s * 0.05, cy - s * 0.18);
    ctx.lineTo(cx + s * 0.26, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.02, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.28, cy + s * 0.08);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.28, cy + s * 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.06, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.16, cy - s * 0.18);
    ctx.lineTo(cx + s * 0.06, cy - s * 0.06);
    ctx.stroke();
  };
  A.iconClock = function (ctx, cx, cy, s, color) {
    var col = color || P.ink;
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.085;
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.32, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.18); ctx.lineTo(cx, cy); ctx.lineTo(cx + s * 0.16, cy + s * 0.1);
    ctx.stroke();
  };
  A.iconStar = function (ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 4;
      var rad = (i % 2 === 0) ? r : r * 0.38;
      var x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };

  /* ---------- заголовок «чернилами» ---------- */
  A.titleInk = function (ctx, text, x, y, maxW, size, color) {
    var s = size;
    ctx.font = font(s, 800);
    while (s > 15 && ctx.measureText(text).width > maxW) {
      s -= 2;
      ctx.font = font(s, 800);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color || P.ink;
    ctx.fillText(text, x, y);
    var tw = Math.min(maxW, ctx.measureText(text).width);
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = Math.max(2, s * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - tw * 0.5, y + s * 0.6);
    ctx.quadraticCurveTo(x, y + s * 0.72, x + tw * 0.5, y + s * 0.58);
    ctx.stroke();
    return s;
  };

  /* ---------- мини-сетка для меню ---------- */
  A.miniBoard = function (ctx, cx, cy, size, seed, accent) {
    var n = 6, c = size / n;
    var gx = cx - size / 2, gy = cy - size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.035);
    ctx.translate(-cx, -cy);
    ctx.save();
    ctx.shadowColor = P.shadow;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fdf9ee';
    rr(ctx, gx - 6, gy - 6, size + 12, size + 12, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(176,156,120,0.9)';
    ctx.lineWidth = 1.4;
    rr(ctx, gx - 6, gy - 6, size + 12, size + 12, 12);
    ctx.stroke();

    var letters = 'СЛОВОСЕТКА';
    var en = 'WORDGRID';
    var src = (G.i18n && G.i18n.ru && G.i18n.ru.title && /[А-Яа-я]/.test(G.i18n.ru.title)) ? letters : en;
    // в меню язык уже выбран: берём буквы из заголовка языка
    try {
      var t = (window.Engine && window.Engine.i18n) ? window.Engine.i18n.t('title') : (G.i18n.ru.title);
      src = /[А-Яа-я]/.test(t) ? 'СЛОВОСЕТКА' : 'WORDGRID';
    } catch (e) {}

    // найденная «змейка» по диагонали
    var path = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 3], [5, 2]];
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = c * 0.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var i = 0; i < path.length; i++) {
      var px = gx + (path[i][0] + 0.5) * c, py = gy + (path[i][1] + 0.5) * c;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = font(Math.max(10, c * 0.5), 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var k = y * n + x;
        var ch = src.charAt(Math.floor(hash(k * 3.7 + seed) * src.length));
        ctx.fillStyle = 'rgba(44,42,50,0.72)';
        ctx.fillText(ch, gx + (x + 0.5) * c, gy + (y + 0.5) * c + 1);
      }
    }
    ctx.strokeStyle = 'rgba(122,104,76,0.35)';
    ctx.lineWidth = 1;
    for (i = 0; i <= n; i++) {
      wobLine(ctx, gx, gy + i * c, gx + size, gy + i * c, seed + i * 2.1, 0.8);
      wobLine(ctx, gx + i * c, gy, gx + i * c, gy + size, seed + i * 3.3, 0.8);
    }
    ctx.restore();
  };

  /* ---------- промо ---------- */
  function promoPaper(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w * 0.35, h);
    g.addColorStop(0, '#fbf3e1');
    g.addColorStop(0.5, '#f3e7cd');
    g.addColorStop(1, '#e8d7b3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // мягкие волокна: заметны вблизи, не превращаются в грязь в миниатюре
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = '#8b7650';
    for (var i = 0; i < 140; i++) {
      ctx.fillRect(hash(i * 2.1) * w, hash(i * 3.7 + 5) * h, 1 + hash(i * 5.3) * 2, 1);
    }
    ctx.globalAlpha = 1;
    var v = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    v.addColorStop(0, 'rgba(90,64,28,0)');
    v.addColorStop(1, 'rgba(90,64,28,0.16)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  /* Сетка промо: слово по диагонали, жирный «маркер», крупные буквы.
     Пропорции подобраны так, чтобы читалось и в 512×512, и в 128×128. */
  function promoGrid(ctx, gx, gy, cell, n, word, accent, rng, latin) {
    var size = cell * n, i;
    ctx.save();
    ctx.shadowColor = 'rgba(70,50,24,0.28)';
    ctx.shadowBlur = cell * 0.7;
    ctx.shadowOffsetY = cell * 0.18;
    ctx.fillStyle = '#fdf9ec';
    rr(ctx, gx - cell * 0.1, gy - cell * 0.1, size + cell * 0.2, size + cell * 0.2, cell * 0.22);
    ctx.fill();
    ctx.restore();

    // «маркер» по диагонали под буквами
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = cell * 0.72;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx + cell * 0.5, gy + cell * 0.5);
    ctx.lineTo(gx + cell * (n - 0.5), gy + cell * (n - 0.5));
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = font(cell * 0.54, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var letters = latin ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЫЭЮЯ';
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var onWord = (x === y && x < word.length);
        var ch = onWord ? word.charAt(x) : letters.charAt(Math.floor(rng() * letters.length));
        ctx.fillStyle = onWord ? '#5c2414' : 'rgba(44,42,50,0.62)';
        ctx.fillText(ch, gx + (x + 0.5) * cell, gy + (y + 0.5) * cell + cell * 0.03);
      }
    }
    ctx.strokeStyle = 'rgba(92,76,52,0.5)';
    ctx.lineWidth = Math.max(1.5, cell * 0.045);
    for (i = 0; i <= n; i++) {
      wobLine(ctx, gx, gy + i * cell, gx + size, gy + i * cell, 11 + i, cell * 0.035);
      wobLine(ctx, gx + i * cell, gy, gx + i * cell, gy + size, 23 + i, cell * 0.035);
    }
  }

  function promoCheck(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.13);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(4, r * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.44, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.36);
    ctx.lineTo(cx + r * 0.48, cy - r * 0.34);
    ctx.stroke();
    ctx.restore();
  }

  function promoIcon(ctx, rng) {
    var w = 512;
    promoPaper(ctx, w, w);
    // тёплое пятно в центре
    var gg = ctx.createRadialGradient(256, 240, 20, 256, 256, 330);
    gg.addColorStop(0, 'rgba(216,163,58,0.16)');
    gg.addColorStop(1, 'rgba(216,163,58,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, w, w);
    // двойная чернильная рамка
    ctx.strokeStyle = 'rgba(44,42,50,0.9)';
    ctx.lineWidth = 10;
    rr(ctx, 22, 22, 468, 468, 30);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(180,73,47,0.85)';
    ctx.lineWidth = 3;
    rr(ctx, 36, 36, 440, 440, 22);
    ctx.stroke();

    var n = 5, cell = 80, size = n * cell;
    promoGrid(ctx, (512 - size) / 2, (512 - size) / 2 - 4, cell, n, 'СЛОВО', '#c9772c', rng);
    promoCheck(ctx, 420, 424, 52, '#2f6b5e');
  }

  function promoCover(ctx, w, h, rng, title) {
    var lang = 'ru';
    try {
      if (typeof location !== 'undefined' && location.search) {
        lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ru';
      }
    } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};

    promoPaper(ctx, w, h);

    // сетка справа
    var n = 6, cell = 42, size = n * cell;
    var gx = w - size - 56, gy = (h - size) / 2;
    var gl = ctx.createRadialGradient(gx + size / 2, gy + size / 2, 10, gx + size / 2, gy + size / 2, size * 0.95);
    gl.addColorStop(0, 'rgba(47,107,94,0.14)');
    gl.addColorStop(1, 'rgba(47,107,94,0)');
    ctx.fillStyle = gl; ctx.fillRect(gx - 80, gy - 80, size + 160, size + 160);
    promoGrid(ctx, gx, gy, cell, n, lang === 'en' ? 'WORDS' : 'СЛОВО', '#2f6b5e', rng, lang === 'en');

    var tx = 46;
    var maxW = gx - tx - 28;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    var t = title || dict.title || 'Word Grid';
    var size2 = Math.round(h * 0.15);
    ctx.font = font(size2, 800);
    while (size2 > 22 && ctx.measureText(t).width > maxW) {
      size2 -= 2;
      ctx.font = font(size2, 800);
    }
    var ty = h * 0.33;
    ctx.fillStyle = '#2c2a32';
    ctx.fillText(t, tx, ty);
    var tw = ctx.measureText(t).width;
    ctx.strokeStyle = '#b4492f';
    ctx.lineWidth = Math.max(3, size2 * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty + size2 * 0.68);
    ctx.quadraticCurveTo(tx + tw * 0.5, ty + size2 * 0.82, tx + tw, ty + size2 * 0.66);
    ctx.stroke();

    ctx.font = '600 ' + Math.round(h * 0.062) + 'px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#5d5866';
    ctx.fillText(dict['cover_tag'] || '', tx, h * 0.55);
    ctx.font = '500 ' + Math.round(h * 0.044) + 'px Georgia, "Times New Roman", serif';
    ctx.fillStyle = 'rgba(93,88,102,0.82)';
    ctx.fillText(dict['cover_line'] || '', tx, h * 0.635);

    // три жетона найденных слов
    var chips = (lang === 'en') ? ['WATER', 'STORM', 'CORAL'] : ['ВОЛНА', 'ШТОРМ', 'МАЯК'];
    var cw = Math.min(118, (maxW - 20) / 3), chh = 40;
    for (var i = 0; i < 3; i++) {
      A.chip(ctx, tx + i * (cw + 10), h * 0.74, cw, chh, chips[i], i < 2, i === 0 ? '#2f6b5e' : '#b4492f', {});
    }
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    var r = rng || Math.random;
    if (kind === 'icon') { promoIcon(ctx, r); return; }
    promoCover(ctx, w, h, r, title);
  };

  G.art = A;
})(window.GAME);
