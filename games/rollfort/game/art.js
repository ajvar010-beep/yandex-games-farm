/* game/art.js — вся графика процедурная: город, дорога, крепость, блоки, оружие,
   зомби, иконки и промо. Ни одного внешнего файла и ни одного обращения к Engine —
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

  /* ---------- фон: небо, луна, город, дым ---------- */
  A.sky = function (ctx, w, h, t, chapter) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#151220');
    g.addColorStop(0.48, P.sky2);
    g.addColorStop(1, '#2b1d1f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // зарево у горизонта
    var glow = ctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, Math.max(w, h) * 0.6);
    glow.addColorStop(0, 'rgba(224,131,79,0.16)');
    glow.addColorStop(0.5, 'rgba(224,131,79,0.06)');
    glow.addColorStop(1, 'rgba(224,131,79,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    // луна
    var mx = w * 0.79, my = h * 0.13, mr = Math.max(14, Math.min(w, h) * 0.062);
    var mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3.2);
    mg.addColorStop(0, 'rgba(239,227,196,0.38)');
    mg.addColorStop(0.35, 'rgba(239,227,196,0.10)');
    mg.addColorStop(1, 'rgba(239,227,196,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e7dcc0';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(140,126,104,0.28)';
    ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * 0.34, my + mr * 0.28, mr * 0.15, 0, Math.PI * 2); ctx.fill();

    // дым: медленные полупрозрачные полосы, привязанные ко времени
    ctx.save();
    for (var i = 0; i < 5; i++) {
      var sx = ((hash(i * 7 + chapter) + t * 0.006 * (1 + i * 0.2)) % 1.3 - 0.15) * w;
      var sy = h * (0.10 + hash(i * 3 + 9) * 0.22);
      var sw = w * (0.22 + hash(i + 2) * 0.2), sh = h * 0.05;
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = i % 2 ? '#6b5a63' : '#4a3f4a';
      ctx.beginPath(); ctx.ellipse(sx, sy, sw, sh, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- силуэт города ---------- */
  A.skyline = function (ctx, w, h, baseY, seed, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var x = -20;
    var i = 0;
    while (x < w + 30) {
      var bw = 34 + hash(seed + i * 3.1) * 66;
      var bh = 46 + hash(seed + i * 5.7) * Math.min(h * 0.28, 170);
      var bx = x, by = baseY - bh;
      ctx.fillStyle = i % 3 === 0 ? '#121620' : (i % 3 === 1 ? '#161a25' : '#0e1219');
      ctx.fillRect(bx, by, bw, bh);
      // рваная крыша
      if (hash(seed + i * 1.7) > 0.62) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + bw * 0.35, by - 8 - hash(i) * 14);
        ctx.lineTo(bx + bw * 0.6, by + 2);
        ctx.lineTo(bx + bw, by - 4);
        ctx.lineTo(bx + bw, by + 10);
        ctx.lineTo(bx, by + 10);
        ctx.closePath(); ctx.fill();
      }
      // окна
      var cols = Math.max(2, Math.floor(bw / 13));
      var rows = Math.max(2, Math.floor(bh / 17));
      for (var cy = 0; cy < rows; cy++) {
        for (var cx = 0; cx < cols; cx++) {
          if (hash(seed + i * 31 + cy * 7 + cx * 1.3) > 0.66) continue;
          var lit = hash(seed + i * 17 + cy * 3 + cx * 5.1) > 0.72;
          ctx.fillStyle = lit ? 'rgba(240,193,75,0.55)' : 'rgba(90,100,120,0.18)';
          ctx.fillRect(bx + 5 + cx * 12, by + 8 + cy * 15, 5, 7);
        }
      }
      x += bw + 8 + hash(i * 2.3) * 16;
      i++;
    }
    ctx.restore();
  };

  /* вертикальная полоса фасадов по краям улицы (портрет) */
  A.sideCity = function (ctx, x, y, w, h, seed, right) {
    if (w <= 3) return;
    ctx.save();
    var yy = y;
    var i = 0;
    while (yy < y + h) {
      var bh = 80 + hash(seed + i * 3.7) * 140;
      var inset = 4 + hash(seed + i * 1.3) * Math.min(22, w * 0.3);
      ctx.fillStyle = i % 2 ? '#141923' : '#181e28';
      if (right) ctx.fillRect(x + inset, yy, w - inset, bh);
      else ctx.fillRect(x, yy, w - inset, bh);
      var cols = Math.max(1, Math.floor((w - inset - 8) / 14));
      var rows = Math.max(1, Math.floor(bh / 20));
      for (var r2 = 0; r2 < rows; r2++) {
        for (var c2 = 0; c2 < cols; c2++) {
          if (hash(seed + i * 13 + r2 * 5 + c2 * 1.7) > 0.6) continue;
          ctx.fillStyle = hash(seed + i * 7 + r2 * 3 + c2 * 9) > 0.7 ? 'rgba(240,193,75,0.40)' : 'rgba(90,100,120,0.14)';
          ctx.fillRect((right ? x + inset : x) + 6 + c2 * 14, yy + 8 + r2 * 20, 5, 8);
        }
      }
      yy += bh + 4;
      i++;
    }
    ctx.restore();
  };

  /* дорога: полоса асфальта с разметкой, трещинами и мусором.
     x,y,w,h — прямоугольник полосы; vert — ход по вертикали; lanes — массив
     координат разделителей по поперечной оси. */
  A.road = function (ctx, x, y, w, h, vert, lanes, seed) {
    var g = vert ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, P.roadDark);
    g.addColorStop(0.12, P.road);
    g.addColorStop(0.5, P.roadHi);
    g.addColorStop(0.88, P.road);
    g.addColorStop(1, P.roadDark);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

    // трещины и пятна
    ctx.strokeStyle = 'rgba(10,12,16,0.45)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 22; i++) {
      var sx = x + hash(seed + i * 3.3) * w;
      var sy = y + hash(seed + i * 7.1) * h;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      var px = sx, py = sy;
      for (var k = 0; k < 3; k++) {
        px += (hash(seed + i * 9 + k) - 0.5) * 26;
        py += (hash(seed + i * 5 + k) - 0.5) * 26;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    for (var j = 0; j < 10; j++) {
      ctx.fillStyle = 'rgba(12,14,18,0.32)';
      ctx.beginPath();
      ctx.ellipse(x + hash(seed + j * 2.7) * w, y + hash(seed + j * 6.9) * h,
        6 + hash(j) * 18, 4 + hash(j + 4) * 10, hash(j + 8) * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // разметка: пунктир по разделителям линий (тусклая — она не главный герой)
    ctx.strokeStyle = 'rgba(201,169,74,0.26)';
    ctx.lineWidth = Math.max(1.2, Math.min(w, h) * 0.006);
    ctx.setLineDash([14, 22]);
    for (var li = 0; li < lanes.length; li++) {
      var a = lanes[li];
      ctx.beginPath();
      if (vert) { ctx.moveTo(a, y + 4); ctx.lineTo(a, y + h - 4); }
      else { ctx.moveTo(x + 4, a); ctx.lineTo(x + w - 4, a); }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // стрелки «к крепости» и обломки
    ctx.fillStyle = 'rgba(201,169,74,0.20)';
    for (var ai = 0; ai < 6; ai++) {
      var t0 = ai / 6;
      if (vert) {
        var ay = y + t0 * h + 20;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5 - 7, ay);
        ctx.lineTo(x + w * 0.5 + 7, ay);
        ctx.lineTo(x + w * 0.5, ay - 9);
        ctx.closePath(); ctx.fill();
      } else {
        var ax = x + (1 - t0) * w - 20;
        ctx.beginPath();
        ctx.moveTo(ax, y + h * 0.5 - 7);
        ctx.lineTo(ax, y + h * 0.5 + 7);
        ctx.lineTo(ax - 9, y + h * 0.5);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();

    // бордюры
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    if (vert) { ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h); }
    else { ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); }
  };

  /* ---------- уличный реквизит ---------- */
  A.wreck = function (ctx, x, y, s, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    var w = s * 2.2, h = s * 0.82;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, h * 0.52, w * 0.55, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    // корпус
    ctx.fillStyle = '#2b323b';
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.2);
    ctx.lineTo(-w * 0.42, -h * 0.18);
    ctx.lineTo(-w * 0.18, -h * 0.32);
    ctx.lineTo(w * 0.12, -h * 0.36);
    ctx.lineTo(w * 0.34, -h * 0.16);
    ctx.lineTo(w * 0.5, -h * 0.05);
    ctx.lineTo(w * 0.5, h * 0.24);
    ctx.lineTo(-w * 0.5, h * 0.24);
    ctx.closePath(); ctx.fill();
    // кабина
    ctx.fillStyle = '#20262d';
    ctx.beginPath();
    ctx.moveTo(-w * 0.30, -h * 0.14);
    ctx.lineTo(-w * 0.14, -h * 0.28);
    ctx.lineTo(w * 0.10, -h * 0.30);
    ctx.lineTo(w * 0.20, -h * 0.12);
    ctx.closePath(); ctx.fill();
    // блик на крыше
    ctx.strokeStyle = 'rgba(160,172,188,0.25)'; ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath(); ctx.moveTo(w * 0.12, -h * 0.34); ctx.lineTo(w * 0.3, -h * 0.18); ctx.stroke();
    // колёса
    ctx.fillStyle = '#101419';
    ctx.beginPath(); ctx.arc(-w * 0.28, h * 0.24, h * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.28, h * 0.24, h * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a424c';
    ctx.beginPath(); ctx.arc(-w * 0.28, h * 0.24, h * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.28, h * 0.24, h * 0.1, 0, Math.PI * 2); ctx.fill();
    // ржавчина
    ctx.fillStyle = 'rgba(184,90,51,0.4)';
    ctx.fillRect(-w * 0.4, h * 0.05, w * 0.2, h * 0.08);
    ctx.fillRect(w * 0.18, h * 0.02, w * 0.14, h * 0.06);
    ctx.restore();
  };

  A.lamp = function (ctx, x, y, s, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    var hgt = s * 2.6;
    ctx.strokeStyle = '#232a32';
    ctx.lineWidth = Math.max(2, s * 0.10);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -hgt);
    ctx.quadraticCurveTo(0, -hgt - s * 0.35, s * 0.8, -hgt - s * 0.35);
    ctx.stroke();
    // лампа
    ctx.fillStyle = '#3a424c';
    rr(ctx, s * 0.55, -hgt - s * 0.48, s * 0.6, s * 0.22, s * 0.08);
    ctx.fill();
    // тёплый свет
    var g = ctx.createRadialGradient(s * 0.85, -hgt - s * 0.38, 1, s * 0.85, -hgt - s * 0.38, s * 1.5);
    g.addColorStop(0, 'rgba(240,193,75,0.22)');
    g.addColorStop(1, 'rgba(240,193,75,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s * 0.85, -hgt - s * 0.38, s * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  A.barrier = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    var w = s * 1.5, h = s * 0.5;
    ctx.fillStyle = '#3b434e';
    rr(ctx, -w / 2, -h, w, h, 2); ctx.fill();
    ctx.save();
    rr(ctx, -w / 2, -h, w, h, 2); ctx.clip();
    ctx.fillStyle = 'rgba(240,193,75,0.7)';
    for (var i = -h; i < w + h; i += s * 0.42) {
      ctx.fillRect(-w / 2 + i, -h, s * 0.18, h);
    }
    ctx.restore();
    ctx.fillStyle = '#20262d';
    ctx.fillRect(-w * 0.42, 0, w * 0.06, s * 0.32);
    ctx.fillRect(w * 0.36, 0, w * 0.06, s * 0.32);
    ctx.restore();
  };

  A.puddle = function (ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,42,54,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,180,200,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x - w * 0.2, y - h * 0.2, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  /* ---------- гусеницы ---------- */
  A.treads = function (ctx, x, y, w, h, vert, t) {
    var dark = '#1b1f25', mid = '#3a424c', hi = '#5b6672';
    ctx.fillStyle = dark;
    if (vert) { ctx.fillRect(x, y, w, h); }
    else { ctx.fillRect(x, y, w, h); }
    var along = vert ? h : w, across = vert ? w : h;
    var step = Math.max(7, across * 0.9);
    var off = (t * 26) % step;
    ctx.strokeStyle = mid; ctx.lineWidth = Math.max(1.5, across * 0.13);
    for (var d = -step; d < along + step; d += step) {
      var p = d + off;
      ctx.beginPath();
      if (vert) { ctx.moveTo(x + 2, y + p); ctx.lineTo(x + w - 2, y + p); }
      else { ctx.moveTo(x + p, y + 2); ctx.lineTo(x + p, y + h - 2); }
      ctx.stroke();
    }
    ctx.strokeStyle = hi; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // катки
    ctx.fillStyle = '#242a32';
    for (var r = step * 1.5; r < along; r += step * 2.4) {
      ctx.beginPath();
      if (vert) ctx.arc(x + w / 2, y + r, across * 0.22, 0, Math.PI * 2);
      else ctx.arc(x + r, y + h / 2, across * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /* ---------- блок ---------- */
  A.block = function (ctx, x, y, w, h, seed) {
    var inset = Math.max(1, Math.min(w, h) * 0.05);
    var bx = x + inset, by = y + inset, bw = w - inset * 2, bh = h - inset * 2;
    var shade = 0.92 + hash(seed || 0) * 0.14;
    var g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, shade > 1 ? '#697585' : '#5b6674');
    g.addColorStop(0.45, P.steel);
    g.addColorStop(1, P.steelDark);
    rr(ctx, bx, by, bw, bh, Math.max(3, Math.min(bw, bh) * 0.14));
    ctx.fillStyle = g;
    ctx.fill();

    // верхний блик и нижняя тень
    ctx.strokeStyle = 'rgba(226,235,246,0.30)';
    ctx.lineWidth = Math.max(1, Math.min(bw, bh) * 0.05);
    ctx.beginPath(); ctx.moveTo(bx + bw * 0.16, by + 2); ctx.lineTo(bx + bw * 0.84, by + 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath(); ctx.moveTo(bx + bw * 0.14, by + bh - 2); ctx.lineTo(bx + bw * 0.86, by + bh - 2); ctx.stroke();

    // заклёпки
    var rad = Math.max(1.2, Math.min(bw, bh) * 0.055);
    ctx.fillStyle = 'rgba(18,22,28,0.8)';
    var pad2 = Math.max(4, Math.min(bw, bh) * 0.17);
    var pts = [[bx + pad2, by + pad2], [bx + bw - pad2, by + pad2], [bx + pad2, by + bh - pad2], [bx + bw - pad2, by + bh - pad2]];
    for (var i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], rad, 0, Math.PI * 2); ctx.fill();
    }
    // жёлтая риска-уголок
    ctx.fillStyle = 'rgba(240,193,75,0.55)';
    ctx.fillRect(bx + bw * 0.5 - bw * 0.12, by + bh * 0.5 - 1, bw * 0.24, Math.max(1.5, bh * 0.07));
  };

  /* ---------- оружие ---------- */
  /* Рисуется в локальной системе 100×100, дуло смотрит в +x. */
  function weaponShape(ctx, type, t) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (type === 'saw') {
      // станина
      ctx.fillStyle = P.steelDark;
      rr(ctx, -46, -15, 30, 30, 5); ctx.fill();
      // пила
      var r = 33;
      ctx.save();
      ctx.translate(6, 0);
      ctx.rotate(t * 6);
      var g = ctx.createRadialGradient(-8, -8, 3, 0, 0, r);
      g.addColorStop(0, '#eef3f9'); g.addColorStop(0.5, '#aab6c4'); g.addColorStop(1, '#5c6673');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7d8896';
      for (var i = 0; i < 14; i++) {
        var a = (i / 14) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + 0.12) * (r + 9), Math.sin(a + 0.12) * (r + 9));
        ctx.lineTo(Math.cos(a + 0.24) * r, Math.sin(a + 0.24) * r);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#3a424c';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.hazard;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (type === 'shock') {
      ctx.fillStyle = P.steelDark;
      rr(ctx, -44, -14, 26, 28, 5); ctx.fill();
      // катушка
      ctx.strokeStyle = '#6fd3ff';
      ctx.lineWidth = 3;
      for (var c = 0; c < 3; c++) {
        ctx.beginPath(); ctx.ellipse(-12 + c * 11, 0, 5, 19, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // штырь и молния
      ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(38, 0); ctx.stroke();
      ctx.fillStyle = '#c8f2ff';
      ctx.beginPath();
      ctx.moveTo(40, -12); ctx.lineTo(48, -2); ctx.lineTo(43, -1); ctx.lineTo(50, 10);
      ctx.lineTo(38, 0); ctx.lineTo(43, -1); ctx.closePath(); ctx.fill();
    } else if (type === 'flame') {
      // баллон
      ctx.fillStyle = '#4a5562';
      rr(ctx, -46, -17, 32, 34, 9); ctx.fill();
      ctx.fillStyle = P.rust;
      rr(ctx, -43, -13, 26, 26, 7); ctx.fill();
      ctx.fillStyle = '#2b333d';
      rr(ctx, -18, -9, 22, 18, 4); ctx.fill();
      // ствол
      ctx.fillStyle = P.steelDark;
      ctx.beginPath();
      ctx.moveTo(4, -9); ctx.lineTo(34, -13); ctx.lineTo(34, 13); ctx.lineTo(4, 9); ctx.closePath(); ctx.fill();
      // пламя
      for (var f = 0; f < 3; f++) {
        var wob = Math.sin(t * 14 + f * 2) * 4;
        var fg = ctx.createLinearGradient(30, 0, 62, 0);
        fg.addColorStop(0, 'rgba(255,220,120,0.95)');
        fg.addColorStop(0.5, 'rgba(255,138,61,0.8)');
        fg.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(32, -7 + f * 6);
        ctx.quadraticCurveTo(50, -12 + f * 7 + wob, 62, -2 + f * 7 + wob * 0.5);
        ctx.quadraticCurveTo(48, 2 + f * 7 - wob, 32, 1 + f * 6);
        ctx.closePath(); ctx.fill();
      }
    } else if (type === 'laser') {
      ctx.fillStyle = P.steelDark;
      rr(ctx, -46, -12, 24, 24, 5); ctx.fill();
      // радиаторы
      ctx.fillStyle = '#46505c';
      for (var q = 0; q < 3; q++) ctx.fillRect(-30 + q * 8, -18, 4, 36);
      // ствол
      ctx.fillStyle = '#5d6875';
      rr(ctx, -20, -7, 52, 14, 4); ctx.fill();
      ctx.fillStyle = '#7b8796';
      rr(ctx, -18, -7, 46, 4, 2); ctx.fill();
      // линза
      var lg = ctx.createRadialGradient(34, 0, 1, 34, 0, 12);
      lg.addColorStop(0, '#ffe3e9'); lg.addColorStop(0.5, '#ff4d6d'); lg.addColorStop(1, 'rgba(255,77,109,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(34, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(34, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'mg') {
      ctx.fillStyle = P.steelDark;
      rr(ctx, -44, -16, 30, 32, 5); ctx.fill();
      // патронная коробка
      ctx.fillStyle = '#5a5130';
      rr(ctx, -40, 8, 22, 16, 3); ctx.fill();
      ctx.fillStyle = P.hazard;
      ctx.fillRect(-38, 12, 18, 2);
      // стволы
      ctx.fillStyle = '#6b7785';
      rr(ctx, -16, -11, 58, 8, 4); ctx.fill();
      rr(ctx, -16, 3, 58, 8, 4); ctx.fill();
      ctx.fillStyle = '#2b333d';
      rr(ctx, 28, -14, 10, 14, 3); ctx.fill();
      rr(ctx, 28, 0, 10, 14, 3); ctx.fill();
      // лента
      ctx.strokeStyle = '#c9a94a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-30, 6); ctx.quadraticCurveTo(-16, 16, -4, 4);
      ctx.stroke();
    } else if (type === 'grenade') {
      ctx.fillStyle = P.steelDark;
      rr(ctx, -44, -15, 28, 30, 6); ctx.fill();
      // барабан
      ctx.fillStyle = '#51603a';
      ctx.beginPath(); ctx.arc(-22, 4, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6f8048';
      for (var d2 = 0; d2 < 5; d2++) {
        var aa = (d2 / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(-22 + Math.cos(aa) * 9, 4 + Math.sin(aa) * 9, 3, 0, Math.PI * 2); ctx.fill();
      }
      // ствол
      ctx.fillStyle = '#5b6875';
      rr(ctx, -8, -12, 46, 20, 7); ctx.fill();
      ctx.fillStyle = '#2b333d';
      rr(ctx, 32, -10, 14, 16, 5); ctx.fill();
      ctx.fillStyle = P.toxic;
      rr(ctx, 34, -6, 8, 8, 3); ctx.fill();
    }
  }

  A.weapon = function (ctx, type, cx, cy, size, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(cx, cy);
    if (opts.angle) ctx.rotate(opts.angle);
    ctx.scale(size / 100, size / 100);
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    // тень под установкой
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 30, 40, 10, 0, 0, Math.PI * 2); ctx.fill();
    weaponShape(ctx, type, opts.t || 0);
    ctx.restore();

    if (opts.level) {
      // пин-бары уровня — всегда горизонтально
      var n = opts.level, w0 = Math.max(2, size * 0.11), gap = w0 * 0.45;
      var total = n * w0 + (n - 1) * gap;
      var bx0 = cx - total / 2, by0 = cy + size * 0.30;
      for (var i = 0; i < 3; i++) {
        ctx.fillStyle = i < n ? P.hazard : 'rgba(240,193,75,0.20)';
        ctx.fillRect(bx0 + i * (w0 + gap), by0, w0, Math.max(2, size * 0.055));
      }
    }
  };

  /* ---------- зомби ---------- */
  function limb(ctx, x1, y1, x2, y2, w) {
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  A.zombie = function (ctx, type, x, y, size, t, opts) {
    opts = opts || {};
    var deadK = opts.dead ? Math.min(1, (opts.deathT || 0) / 0.35) : 0;
    ctx.save();
    ctx.translate(x, y);
    if (opts.flip) ctx.scale(-1, 1);
    if (deadK > 0) ctx.rotate(deadK * 1.35);
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha * (1 - deadK * 0.55);
    var s = size / 100;
    ctx.scale(s, s);

    var hover = opts.air ? -12 + Math.sin(t * 3) * 3 : 0;
    ctx.translate(0, hover);

    var skin = type === 'brute' ? '#2d2832' : '#262c36';
    var rim = type === 'brute' ? '#8a5a62' : '#5c6a7a';
    var eye = opts.eye || (type === 'brute' ? '#ff5c4d' : type === 'flyer' ? '#a26bff' : type === 'runner' ? '#ffb84d' : '#9ef05c');

    // тень под ногами — силуэт читается на асфальте
    ctx.save();
    ctx.globalAlpha *= opts.air ? 0.30 : 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, opts.air ? 46 - hover : 44, opts.air ? 26 : 20, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ноги: у летуна их нет
    var step = Math.sin(t * (type === 'runner' ? 11 : 6)) * (type === 'runner' ? 0.55 : 0.35);
    ctx.strokeStyle = skin;
    ctx.lineCap = 'round';
    if (type !== 'flyer') {
      var legW = type === 'brute' ? 13 : 8;
      limb(ctx, -4, 20, -9 - step * 9, 45, legW);
      limb(ctx, 4, 20, 9 + step * 9, 45, legW);
    }

    // руки
    ctx.strokeStyle = skin;
    if (type === 'runner') {
      limb(ctx, -8, -8, 18, 8 + step * 5, 7);
      limb(ctx, 8, -8, 26, 16 - step * 5, 7);
    } else if (type === 'brute') {
      limb(ctx, -14, -14, -24, 18, 14);
      limb(ctx, 14, -14, 26, 16, 14);
    } else {
      limb(ctx, -10, -6, -16, 20 + step * 4, 7);
      limb(ctx, 10, -6, 16, 20 - step * 4, 7);
    }

    // корпус
    var bw = type === 'brute' ? 54 : type === 'runner' ? 30 : 38;
    var bh = type === 'brute' ? 54 : type === 'runner' ? 44 : 46;
    var by = -24;
    var g = ctx.createLinearGradient(-bw / 2, by, bw / 2, by + bh);
    g.addColorStop(0, rim);
    g.addColorStop(0.4, skin);
    g.addColorStop(1, '#0d1014');
    rr(ctx, -bw / 2, by, bw, bh, type === 'brute' ? 18 : 13);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(6,8,12,0.9)';
    ctx.stroke();

    // рвань на теле
    ctx.fillStyle = '#0c0f12';
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 4, by + bh * 0.68);
    ctx.lineTo(-bw * 0.1, by + bh * 0.52);
    ctx.lineTo(bw * 0.18, by + bh * 0.75);
    ctx.lineTo(-bw / 2 + 6, by + bh * 0.86);
    ctx.closePath(); ctx.fill();

    // крылья летуна
    if (type === 'flyer') {
      var flap = Math.sin(t * 9) * 0.5;
      ctx.fillStyle = 'rgba(120,80,160,0.55)';
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + 3, by + 8);
      ctx.quadraticCurveTo(-bw / 2 - 30, by - 18 + flap * 18, -bw / 2 - 14, by + 34);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bw / 2 - 3, by + 8);
      ctx.quadraticCurveTo(bw / 2 + 30, by - 18 + flap * 18, bw / 2 + 14, by + 34);
      ctx.closePath(); ctx.fill();
    }

    // голова
    var hr = type === 'brute' ? 15 : type === 'runner' ? 14 : 16;
    var hy = type === 'brute' ? -34 : -36;
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, hy, hr, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(6,8,12,0.9)';
    ctx.beginPath(); ctx.arc(0, hy, hr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, hy, hr, Math.PI * 1.05, Math.PI * 1.8); ctx.stroke();

    // глаза
    var er = type === 'brute' ? 3.2 : 2.6;
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(-hr * 0.38, hy - 1, er, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hr * 0.38, hy - 1, er, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.globalAlpha *= 0.30;
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(-hr * 0.38, hy - 1, er * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hr * 0.38, hy - 1, er * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // босс: детали
    if (opts.boss) {
      if (opts.bossId === 'brute') {
        ctx.fillStyle = '#3a3038';
        rr(ctx, -bw * 0.62, by - 6, bw * 0.26, 24, 6); ctx.fill();
        rr(ctx, bw * 0.36, by - 6, bw * 0.26, 24, 6); ctx.fill();
        ctx.fillStyle = '#ff5c4d';
        rr(ctx, -6, by + 14, 12, 6, 2); ctx.fill();
      } else if (opts.bossId === 'matka') {
        for (var p = 0; p < 4; p++) {
          var pa = (p / 4) * Math.PI * 2 + t * 0.8;
          var px2 = Math.cos(pa) * 20, py2 = by + 18 + Math.sin(pa) * 12;
          var pulse = 4 + Math.sin(t * 4 + p) * 1.4;
          ctx.fillStyle = 'rgba(150,240,92,0.55)';
          ctx.beginPath(); ctx.arc(px2, py2, pulse, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#a26bff';
        rr(ctx, -7, by + 10, 14, 5, 2); ctx.fill();
      } else if (opts.bossId === 'shield') {
        ctx.save();
        ctx.fillStyle = '#5d6875';
        rr(ctx, -bw / 2 - 16, by - 4, 18, bh + 12, 7); ctx.fill();
        ctx.fillStyle = P.hazard;
        ctx.fillRect(-bw / 2 - 13, by + 8, 12, 4);
        ctx.fillRect(-bw / 2 - 13, by + 20, 12, 4);
        ctx.restore();
      }
    }

    if (opts.flash) {
      ctx.save();
      ctx.globalAlpha *= 0.5;
      var fg = ctx.createRadialGradient(0, -12, 2, 0, -12, 44);
      fg.addColorStop(0, 'rgba(255,255,255,0.95)');
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -12, 44, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // полоса HP (в экранных координатах)
    if (opts.hpRatio != null && opts.hpRatio < 1) {
      var bwpx = size * (opts.boss ? 1.4 : 0.8);
      var bx = x - bwpx / 2, byy = y - size * (opts.air ? 1.05 : 0.72);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, byy - 1, bwpx + 2, Math.max(3, size * 0.07) + 2);
      ctx.fillStyle = opts.boss ? '#ff5c4d' : '#9ef05c';
      ctx.fillRect(bx, byy, bwpx * Math.max(0, opts.hpRatio), Math.max(3, size * 0.07));
    }
  };

  /* ---------- иконки ---------- */
  A.coin = function (ctx, x, y, r) {
    ctx.save();
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.55, P.gold); g.addColorStop(1, '#9c7a1c');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16); ctx.strokeStyle = '#6b5210'; ctx.stroke();
    ctx.fillStyle = '#6b5210';
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.48);
    ctx.lineTo(x + r * 0.42, y - r * 0.1);
    ctx.lineTo(x + r * 0.16, y - r * 0.1);
    ctx.lineTo(x + r * 0.22, y + r * 0.48);
    ctx.lineTo(x - r * 0.22, y + r * 0.48);
    ctx.lineTo(x - r * 0.16, y - r * 0.1);
    ctx.lineTo(x - r * 0.42, y - r * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  A.shield = function (ctx, x, y, s, ratio, color) {
    var w = s, h = s * 1.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    shieldPath(ctx, w + 2, h + 2); ctx.fill();
    ctx.fillStyle = color || P.steel;
    shieldPath(ctx, w, h); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    shieldPath(ctx, w, h); ctx.stroke();
    if (ratio != null) {
      ctx.save();
      shieldPath(ctx, w - 4, h - 4); ctx.clip();
      ctx.fillStyle = ratio > 0.5 ? '#6ee07a' : ratio > 0.25 ? P.hazard : '#e05a4f';
      ctx.fillRect(-w / 2, -h / 2 + h * (1 - ratio), w, h * ratio);
      ctx.restore();
    }
    ctx.restore();
  };
  function shieldPath(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w / 2, h * 0.12);
    ctx.quadraticCurveTo(w / 2, h * 0.42, 0, h / 2);
    ctx.quadraticCurveTo(-w / 2, h * 0.42, -w / 2, h * 0.12);
    ctx.closePath();
  }
  A.shieldPath = shieldPath;

  A.skull = function (ctx, x, y, s, color) {
    ctx.save();
    ctx.fillStyle = color || P.cream;
    ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - s * 0.26, y + s * 0.2, s * 0.52, s * 0.28);
    ctx.fillStyle = '#161a21';
    ctx.beginPath(); ctx.arc(x - s * 0.18, y - s * 0.12, s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.18, y - s * 0.12, s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - s * 0.03, y + s * 0.02, s * 0.06, s * 0.12);
    ctx.restore();
  };

  A.wrench = function (ctx, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.7);
    ctx.strokeStyle = color || P.cream;
    ctx.lineWidth = s * 0.22;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, s * 0.4); ctx.lineTo(0, -s * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.34, s * 0.24, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
    ctx.restore();
  };

  A.lock = function (ctx, x, y, s, color) {
    ctx.save();
    ctx.fillStyle = color || P.dim;
    rr(ctx, x - s * 0.34, y - s * 0.05, s * 0.68, s * 0.5, s * 0.1); ctx.fill();
    ctx.strokeStyle = color || P.dim;
    ctx.lineWidth = s * 0.13;
    ctx.beginPath(); ctx.arc(x, y - s * 0.05, s * 0.22, Math.PI, 0); ctx.stroke();
    ctx.restore();
  };

  /* ---------- меню: крепость боком ---------- */
  A.menuFort = function (ctx, x, y, w, h, t) {
    var s = h / 3;
    ctx.save();
    // гусеницы
    A.treads(ctx, x, y - s * 0.22, w, s * 0.22, false, t);
    A.treads(ctx, x, y + h, w, s * 0.22, false, t);
    // корпус
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#5f6a78'); g.addColorStop(0.5, '#414a55'); g.addColorStop(1, '#262d36');
    rr(ctx, x, y, w, h, 6);
    ctx.fillStyle = g; ctx.fill();
    // блоки
    var cols = 4, rows = 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        A.block(ctx, x + c * (w / cols), y + r * (h / rows), w / cols, h / rows, r * cols + c);
      }
    }
    // передний отвал
    ctx.fillStyle = '#3b434e';
    ctx.beginPath();
    ctx.moveTo(x + w, y - s * 0.3);
    ctx.lineTo(x + w + s * 0.5, y + h * 0.2);
    ctx.lineTo(x + w + s * 0.5, y + h * 0.8);
    ctx.lineTo(x + w, y + h + s * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.hazard;
    ctx.beginPath();
    ctx.moveTo(x + w + s * 0.08, y + h * 0.12);
    ctx.lineTo(x + w + s * 0.4, y + h * 0.32);
    ctx.lineTo(x + w + s * 0.4, y + h * 0.42);
    ctx.lineTo(x + w + s * 0.08, y + h * 0.22);
    ctx.closePath(); ctx.fill();
    // выхлопы сзади
    ctx.fillStyle = 'rgba(120,130,145,0.25)';
    for (var p = 0; p < 3; p++) {
      var pk = (t * 0.4 + p * 0.33) % 1;
      ctx.globalAlpha = 0.22 * (1 - pk);
      ctx.beginPath(); ctx.arc(x - s * 0.1 - pk * s * 0.9, y + h * 0.25 - pk * s * 0.5, s * (0.14 + pk * 0.2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- промо ---------- */
  function promoBlock(ctx, x, y, w, h, t) {
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#737f8e'); g.addColorStop(0.45, '#4b5561'); g.addColorStop(1, '#2a313a');
    rr(ctx, x, y, w, h, Math.max(4, w * 0.07));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(240,193,75,0.55)';
    ctx.lineWidth = Math.max(2, w * 0.02);
    rr(ctx, x + w * 0.05, y + h * 0.05, w * 0.9, h * 0.9, Math.max(3, w * 0.05));
    ctx.stroke();
    // заклёпки
    ctx.fillStyle = 'rgba(18,22,28,0.85)';
    var pts = [[x + w * 0.16, y + h * 0.16], [x + w * 0.84, y + h * 0.16], [x + w * 0.16, y + h * 0.84], [x + w * 0.84, y + h * 0.84]];
    for (var i = 0; i < pts.length; i++) {
      ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], Math.max(2, w * 0.045), 0, Math.PI * 2); ctx.fill();
    }
    // жёлтая диагональная полоса
    ctx.save();
    rr(ctx, x, y, w, h, Math.max(4, w * 0.07)); ctx.clip();
    ctx.translate(x + w * 0.5, y + h * 0.5);
    ctx.rotate(-0.6);
    ctx.fillStyle = 'rgba(240,193,75,0.5)';
    for (var b = -h; b < h; b += w * 0.22) ctx.fillRect(-w, b, w * 2, w * 0.07);
    ctx.restore();
  }

  function promoScene(ctx, w, h, icon, rng, title, dict) {
    // фон
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#171320');
    g.addColorStop(0.55, '#2c2024');
    g.addColorStop(1, '#1a1512');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // зарево
    var rg = ctx.createRadialGradient(w * 0.5, h * 0.42, 4, w * 0.5, h * 0.45, Math.max(w, h) * 0.66);
    rg.addColorStop(0, 'rgba(224,131,79,0.30)');
    rg.addColorStop(0.45, 'rgba(224,131,79,0.08)');
    rg.addColorStop(1, 'rgba(224,131,79,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);

    // город
    A.skyline(ctx, w, h, h * 0.72, 7, 0.9);

    // дорога
    A.road(ctx, 0, h * 0.72, w, h * 0.28, false, [], 3);

    // зомби-силуэты на горизонте
    var zs = icon ? 4 : 6;
    for (var i = 0; i < zs; i++) {
      var zx = w * (0.12 + rng() * 0.7);
      if (!icon) zx = w * (0.52 + rng() * 0.42);
      var zy = h * (0.72 + rng() * 0.08);
      var zs2 = Math.min(w, h) * (0.07 + rng() * 0.06);
      A.zombie(ctx, i % 2 ? 'walker' : 'runner', zx, zy, zs2, rng() * 6, { alpha: 0.75, eye: i % 2 ? '#9ef05c' : '#ffb84d' });
    }

    // крепость
    var fw = icon ? w * 0.62 : w * 0.40;
    var fh = icon ? h * 0.34 : h * 0.36;
    var fx = icon ? (w - fw) / 2 : w * 0.06;
    var fy = icon ? h * 0.44 : h * 0.38;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = Math.min(w, h) * 0.04;
    ctx.shadowOffsetY = Math.min(w, h) * 0.02;
    promoBlock(ctx, fx, fy, fw, fh * 0.62, 0);
    ctx.restore();
    // гусеницы
    A.treads(ctx, fx, fy + fh * 0.62, fw, fh * 0.16, false, 0);
    A.treads(ctx, fx, fy - fh * 0.13, fw, fh * 0.13, false, 0);
    // пушка
    var gx = fx + fw * 0.48, gy = fy + fh * 0.28;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.fillStyle = '#3d454f';
    ctx.beginPath(); ctx.arc(0, 0, fw * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c6875';
    rr(ctx, 0, -fw * 0.05, fw * 0.5, fw * 0.1, fw * 0.04); ctx.fill();
    ctx.fillStyle = P.hazard;
    rr(ctx, fw * 0.34, -fw * 0.075, fw * 0.08, fw * 0.15, fw * 0.03); ctx.fill();
    // вспышка
    var fg = ctx.createRadialGradient(fw * 0.56, 0, 1, fw * 0.56, 0, fw * 0.22);
    fg.addColorStop(0, 'rgba(255,240,190,0.95)');
    fg.addColorStop(0.4, 'rgba(255,180,60,0.55)');
    fg.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(fw * 0.56, 0, fw * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (!icon) {
      var tx = w * 0.52;
      var size = h * 0.15;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '800 ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      while (size > 20 && ctx.measureText(title || 'Fortress').width > w * 0.44) {
        size -= 2;
        ctx.font = '800 ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      }
      ctx.fillStyle = P.hazard;
      ctx.fillText(title || 'Fortress', tx, h * 0.34);
      dict = dict || {};
      ctx.font = '600 ' + Math.round(h * 0.055) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = P.cream;
      ctx.fillText(dict['cover_tag'] || '', tx, h * 0.47);
      ctx.font = '500 ' + Math.round(h * 0.042) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'rgba(241,233,216,0.66)';
      ctx.fillText(dict['cover_line'] || '', tx, h * 0.56);
      // три пушки-иконки внизу справа
      var types = ['saw', 'flame', 'mg'];
      for (var k = 0; k < 3; k++) {
        A.weapon(ctx, types[k], tx + h * 0.055 + k * h * 0.115, h * 0.74, h * 0.085, { t: 0.4 });
      }
    }
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
