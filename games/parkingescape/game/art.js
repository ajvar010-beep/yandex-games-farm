/* game/art.js — процедурная графика «Побег с Парковки»: машины сверху, бетонные блоки,
   снег, эвакуатор, ограждения. Спрайты рисуются один раз в offscreen-canvas (атлас),
   затем только масштабируются/вращаются — дёшево для телефона. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var ART = {};
  var SIZE = 192;

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(c1, c2, k) {
    var a = hex(c1), b = hex(c2);
    return 'rgb(' + ((a[0] + (b[0] - a[0]) * k) | 0) + ',' + ((a[1] + (b[1] - a[1]) * k) | 0) + ',' + ((a[2] + (b[2] - a[2]) * k) | 0) + ')';
  }
  function shade(c, k) { return mix(c, '#000000', k); }
  function tint(c, k) { return mix(c, '#ffffff', k); }

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

  /* ---------- машины: чистый top-down, как в аркадных parking-играх ---------- */
  var STYLES = [
    { id: 'sport',  L: 166, halfW: 47, cabF: 44, cabR: 104, spoiler: 1 },
    { id: 'sedan',  L: 168, halfW: 45, cabF: 42, cabR: 110 },
    { id: 'taxi',   L: 168, halfW: 45, cabF: 42, cabR: 110, taxi: 1 },
    { id: 'suv',    L: 172, halfW: 47, cabF: 38, cabR: 120, rails: 1 },
    { id: 'hatch',  L: 156, halfW: 44, cabF: 42, cabR: 112, hatch: 1 },
    { id: 'van',    L: 174, halfW: 46, cabF: 30, cabR: 132, van: 1 },
    { id: 'pickup', L: 172, halfW: 46, cabF: 38, cabR: 96, pickup: 1 }
  ];

  function glassBand(ctx, pts, c1, c2) {
    var g = ctx.createLinearGradient(0, pts[0][1], 0, pts[2][1]);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(220,242,255,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  function makeCar(color, st) {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var cx = SIZE / 2, y0 = (SIZE - st.L) / 2, y1 = y0 + st.L, halfW = st.halfW;
    var H = st.L;

    // тень
    x.fillStyle = 'rgba(0,0,0,0.30)';
    rr(x, cx - halfW - 2, y0 + 8, halfW * 2 + 4, H, 18); x.fill();

    // колёса — выглядывают по бокам
    x.fillStyle = '#0c0e12';
    rr(x, cx - halfW - 7, y0 + 34, 13, 27, 5); x.fill();
    rr(x, cx + halfW - 6, y0 + 34, 13, 27, 5); x.fill();
    rr(x, cx - halfW - 7, y1 - 61, 13, 27, 5); x.fill();
    rr(x, cx + halfW - 6, y1 - 61, 13, 27, 5); x.fill();
    x.fillStyle = 'rgba(160,170,180,0.8)';
    rr(x, cx - halfW - 3, y0 + 43, 5, 9, 2); x.fill();
    rr(x, cx + halfW + 2, y0 + 43, 5, 9, 2); x.fill();

    // кузов
    var bg = x.createLinearGradient(cx - halfW, y0, cx + halfW, y1);
    bg.addColorStop(0, tint(color, 0.28));
    bg.addColorStop(0.5, color);
    bg.addColorStop(1, shade(color, 0.26));
    rr(x, cx - halfW, y0, halfW * 2, H, 14);
    x.fillStyle = bg; x.fill();
    x.strokeStyle = 'rgba(9,11,15,0.72)'; x.lineWidth = 3; x.stroke();

    // мягкая боковая тень
    x.save(); rr(x, cx - halfW, y0, halfW * 2, H, 14); x.clip();
    var side = x.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    side.addColorStop(0, 'rgba(255,255,255,0.20)');
    side.addColorStop(0.12, 'rgba(255,255,255,0)');
    side.addColorStop(0.86, 'rgba(0,0,0,0.05)');
    side.addColorStop(1, 'rgba(0,0,0,0.24)');
    x.fillStyle = side; x.fillRect(cx - halfW, y0, halfW * 2, H);
    x.restore();

    // капот и багажник
    x.strokeStyle = 'rgba(0,0,0,0.20)'; x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(cx - halfW * 0.62, y0 + 35); x.lineTo(cx + halfW * 0.62, y0 + 35); x.stroke();
    x.beginPath(); x.moveTo(cx - halfW * 0.62, y1 - 30); x.lineTo(cx + halfW * 0.62, y1 - 30); x.stroke();

    // колёсные арки
    x.strokeStyle = 'rgba(0,0,0,0.30)'; x.lineWidth = 2;
    x.beginPath(); x.arc(cx - halfW + 1, y0 + 48, 16, -1.1, 1.1); x.stroke();
    x.beginPath(); x.arc(cx + halfW - 1, y0 + 48, 16, Math.PI - 1.1, Math.PI + 1.1); x.stroke();
    x.beginPath(); x.arc(cx - halfW + 1, y1 - 48, 16, -1.1, 1.1); x.stroke();
    x.beginPath(); x.arc(cx + halfW - 1, y1 - 48, 16, Math.PI - 1.1, Math.PI + 1.1); x.stroke();

    var cabF = y0 + st.cabF, cabR = y0 + st.cabR;
    var wF = halfW * 0.67, wR = halfW * 0.57;

    // лобовое — широкая полоса
    glassBand(x, [[cx - wF, cabF], [cx + wF, cabF], [cx + wR, cabF + 23], [cx - wR, cabF + 23]],
      'rgba(224,244,255,0.96)', 'rgba(70,118,158,0.98)');
    // крыша
    var roof = x.createLinearGradient(0, cabF + 23, 0, cabR - 22);
    roof.addColorStop(0, tint(color, 0.08)); roof.addColorStop(0.5, shade(color, 0.06)); roof.addColorStop(1, shade(color, 0.20));
    rr(x, cx - halfW * 0.72, cabF + 23, halfW * 1.44, Math.max(12, cabR - cabF - 45), 6);
    x.fillStyle = roof; x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1.2; x.stroke();

    // заднее стекло
    glassBand(x, [[cx - wR, cabR - 22], [cx + wR, cabR - 22], [cx + wF, cabR], [cx - wF, cabR]],
      'rgba(60,104,144,0.98)', 'rgba(214,242,255,0.76)');

    // боковые стёкла
    x.fillStyle = 'rgba(58,102,142,0.88)';
    rr(x, cx - halfW + 5, cabF + 27, 5, Math.max(10, cabR - cabF - 50), 2); x.fill();
    rr(x, cx + halfW - 10, cabF + 27, 5, Math.max(10, cabR - cabF - 50), 2); x.fill();

    // зеркала
    x.fillStyle = shade(color, 0.32);
    rr(x, cx - halfW - 7, cabF + 2, 8, 6, 3); x.fill();
    rr(x, cx + halfW - 1, cabF + 2, 8, 6, 3); x.fill();

    // решётка и фары
    x.fillStyle = '#1b2026';
    rr(x, cx - 15, y0 + 4, 30, 7, 3); x.fill();
    x.fillStyle = '#fffbe6';
    rr(x, cx - halfW * 0.70, y0 + 6, 15, 6, 3); x.fill();
    rr(x, cx + halfW * 0.70 - 15, y0 + 6, 15, 6, 3); x.fill();
    // задние фонари
    x.fillStyle = '#ff4d4f';
    rr(x, cx - halfW * 0.70, y1 - 12, 14, 5, 2); x.fill();
    rr(x, cx + halfW * 0.70 - 14, y1 - 12, 14, 5, 2); x.fill();
    // номер
    x.fillStyle = '#f1f3f5';
    rr(x, cx - 10, y1 - 5, 20, 6, 2); x.fill();

    // стили
    if (st.taxi) {
      x.fillStyle = '#1b2026';
      rr(x, cx - 14, cabF + 32, 28, 9, 4); x.fill();
      x.fillStyle = '#ffd43b';
      rr(x, cx - 10, cabF + 34, 20, 5, 2); x.fill();
      for (var ci = 0; ci < 3; ci++) {
        x.fillStyle = ci % 2 ? '#f8f9fa' : '#1b2026';
        x.fillRect(cx - halfW + 4, cabF + 46 + ci * 8, 6, 6);
        x.fillRect(cx + halfW - 10, cabF + 46 + ci * 8, 6, 6);
      }
    }
    if (st.spoiler) {
      x.fillStyle = shade(color, 0.42);
      rr(x, cx - halfW * 0.82, y1 - 2, halfW * 1.64, 6, 3); x.fill();
    }
    if (st.rails) {
      x.strokeStyle = 'rgba(26,32,40,0.85)'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - halfW * 0.58, cabF + 24); x.lineTo(cx - halfW * 0.58, cabR - 22); x.stroke();
      x.beginPath(); x.moveTo(cx + halfW * 0.58, cabF + 24); x.lineTo(cx + halfW * 0.58, cabR - 22); x.stroke();
    }
    if (st.van) {
      x.strokeStyle = 'rgba(0,0,0,0.26)'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(cx + halfW * 0.30, cabF + 24); x.lineTo(cx + halfW * 0.30, cabR - 22); x.stroke();
    }
    if (st.pickup) {
      x.fillStyle = 'rgba(18,22,28,0.84)';
      rr(x, cx - halfW * 0.70, cabR + 4, halfW * 1.40, y1 - cabR - 14, 4); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1.2;
      for (var bi = 1; bi < 4; bi++) {
        var by = cabR + 8 + bi * ((y1 - cabR - 22) / 4);
        x.beginPath(); x.moveTo(cx - halfW * 0.66, by); x.lineTo(cx + halfW * 0.66, by); x.stroke();
      }
    }

    return cv;
  }

  /* эвакуатор: жёлтый тягач с мигалками и крюком */
  function makeTow() {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var bx = 38, by = 16, bw = 116, bh = 160;
    x.fillStyle = 'rgba(0,0,0,0.30)';
    rr(x, bx - 3, by + 9, bw + 6, bh, 24); x.fill();
    x.fillStyle = '#15171b';
    rr(x, 22, 46, 18, 38, 8); x.fill();
    rr(x, 152, 46, 18, 38, 8); x.fill();
    rr(x, 22, 124, 18, 38, 8); x.fill();
    rr(x, 152, 124, 18, 38, 8); x.fill();
    var g = x.createLinearGradient(bx, by, bx + bw, by + bh);
    g.addColorStop(0, '#ffe066'); g.addColorStop(0.55, '#f59f00'); g.addColorStop(1, '#b26b00');
    x.fillStyle = g;
    rr(x, bx, by, bw, bh, 22); x.fill();
    x.strokeStyle = '#6b4300'; x.lineWidth = 4;
    rr(x, bx, by, bw, bh, 22); x.stroke();
    // кабина
    x.fillStyle = '#1c2633';
    rr(x, bx + 14, by + 12, bw - 28, 42, 10); x.fill();
    x.fillStyle = 'rgba(180,220,255,0.72)';
    rr(x, bx + 20, by + 18, bw - 40, 24, 7); x.fill();
    // платформа
    x.fillStyle = '#e9ecef';
    rr(x, bx + 10, by + 62, bw - 20, bh - 84, 8); x.fill();
    // крюк
    x.strokeStyle = '#343a40'; x.lineWidth = 8; x.lineCap = 'round';
    x.beginPath(); x.moveTo(bx + bw / 2, by + bh - 22); x.lineTo(bx + bw / 2, by + bh + 6); x.stroke();
    x.beginPath(); x.arc(bx + bw / 2, by + bh + 8, 9, 0.2, Math.PI * 1.5); x.stroke();
    // мигалки
    x.fillStyle = '#ff4d4f'; rr(x, bx + 22, by + 2, 20, 8, 4); x.fill();
    x.fillStyle = '#4dabf7'; rr(x, bx + bw - 42, by + 2, 20, 8, 4); x.fill();
    // блик
    x.fillStyle = 'rgba(255,255,255,0.28)';
    rr(x, bx + 14, by + 66, bw - 28, 12, 6); x.fill();
    return cv;
  }

  /* бетонный блок-отбойник */
  function makeBlock() {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var bx = 18, by = 44, bw = 156, bh = 104;
    x.fillStyle = 'rgba(0,0,0,0.28)';
    rr(x, bx, by + 8, bw, bh, 14); x.fill();
    var g = x.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, '#d9dde2'); g.addColorStop(0.5, '#aab2bd'); g.addColorStop(1, '#7b8490');
    x.fillStyle = g; rr(x, bx, by, bw, bh, 14); x.fill();
    x.strokeStyle = '#5c6672'; x.lineWidth = 5; rr(x, bx, by, bw, bh, 14); x.stroke();
    // косые оранжевые полосы
    x.save(); rr(x, bx + 4, by + 4, bw - 8, bh - 8, 10); x.clip();
    x.fillStyle = 'rgba(255,145,32,0.85)';
    for (var i = -3; i < 8; i++) {
      x.save(); x.translate(bx + 20 + i * 34, by); x.rotate(-0.5);
      x.fillRect(0, 0, 16, bh + 30); x.restore();
    }
    x.restore();
    // верхняя кромка
    x.fillStyle = 'rgba(255,255,255,0.5)';
    rr(x, bx + 6, by + 5, bw - 12, 12, 6); x.fill();
    return cv;
  }

  /* ограждение: красно-белый столбик */
  function makeWall() {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var bx = 48, by = 22, bw = 96, bh = 148;
    x.fillStyle = 'rgba(0,0,0,0.28)';
    rr(x, bx, by + 8, bw, bh, 14); x.fill();
    x.fillStyle = '#e9ecef'; rr(x, bx, by, bw, bh, 14); x.fill();
    x.save(); rr(x, bx, by, bw, bh, 14); x.clip();
    x.fillStyle = '#e03131';
    for (var i = -2; i < 7; i++) {
      x.save(); x.translate(bx, by + i * 30); x.rotate(-0.35);
      x.fillRect(0, 0, bw + 30, 14); x.restore();
    }
    x.restore();
    x.strokeStyle = '#8b95a1'; x.lineWidth = 5; rr(x, bx, by, bw, bh, 14); x.stroke();
    // верхний маячок
    x.fillStyle = '#ffd43b';
    x.beginPath(); x.arc(bx + bw / 2, by + 8, 10, 0, Math.PI * 2); x.fill();
    return cv;
  }

  ART.init = function () {
    if (ART.tiles) return;
    var cols = G.config.palette.tileColors;
    ART.tiles = [];
    for (var i = 0; i < cols.length; i++) ART.tiles.push(makeCar(cols[i], STYLES[i % STYLES.length]));
    ART.bomb = makeTow();
    ART.wall = makeWall();
    ART.crate = makeBlock();
  };

  /* alpha/scale — для анимаций; машина по умолчанию носом вверх, dir поворачивает */
  ART.drawTile = function (ctx, colorIdx, x, y, size, dir, special, alpha, scale) {
    if (!ART.tiles) ART.init();
    var img = (special === 'bomb') ? ART.bomb : ART.tiles[colorIdx % ART.tiles.length];
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    if (special !== 'bomb') ctx.rotate(dir * Math.PI / 2);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  };

  ART.drawWall = function (ctx, x, y, size) {
    if (!ART.tiles) ART.init();
    ctx.drawImage(ART.wall, x - size / 2, y - size / 2, size, size);
  };

  ART.drawCrate = function (ctx, x, y, size, alpha) {
    if (!ART.tiles) ART.init();
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(ART.crate, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  };

  /* снег поверх машины: белая корка, сугроб и снежинки */
  ART.drawIce = function (ctx, x, y, size, t) {
    var s = size * 0.92, r = s * 0.24;
    ctx.save();
    ctx.globalAlpha = 0.92;
    var g = ctx.createLinearGradient(x, y - s / 2, x, y + s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.55, 'rgba(214,235,255,0.72)');
    g.addColorStop(1, 'rgba(180,214,245,0.55)');
    rr(ctx, x - s / 2, y - s / 2, s, s, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(2, size * 0.02);
    ctx.stroke();
    // снежинки
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    var pts = [[-0.28, -0.24], [0.22, -0.3], [0.3, 0.12], [-0.18, 0.24], [0.02, 0.02], [-0.34, 0.08]];
    for (var i = 0; i < pts.length; i++) {
      var px = x + pts[i][0] * s, py = y + pts[i][1] * s, pr = s * (0.018 + (i % 3) * 0.008);
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
    // блик
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.2 * Math.sin((t || 0) * 3)) + ')';
    ctx.beginPath(); ctx.ellipse(x - s * 0.2, y - s * 0.26, s * 0.17, s * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  ART.drawGlow = function (ctx, x, y, r, color, alpha) {
    var g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalAlpha = alpha == null ? 0.5 : alpha;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  function lotLines(ctx, w, h, alpha) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.lineWidth = 3;
    var step = h / 6;
    for (var y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (var x = w / 8; x < w; x += w / 8) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.restore();
  }

  /* промо: иконка без текста, обложка с названием сверху */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var rf = (typeof rng === 'function') ? rng : function () { return rng.float(); };
    var P = G.config.palette;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a444f'); g.addColorStop(1, '#1d232a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    lotLines(ctx, w, h, 0.10);
    // блики на асфальте
    for (var i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.05 + 0.10 * rf();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(rf() * w, rf() * h, 2 + rf() * 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (kind === 'icon') {
      var s = h * 0.54;
      ART.drawTile(ctx, 0, w * 0.5, h * 0.54, s, 0, 0, 1, 1);
      ART.drawTile(ctx, 1, w * 0.20, h * 0.24, s * 0.34, 1, 0, 0.95, 1);
      ART.drawTile(ctx, 2, w * 0.80, h * 0.26, s * 0.30, 3, 0, 0.95, 1);
      ART.drawTile(ctx, 3, w * 0.78, h * 0.82, s * 0.26, 2, 0, 0.9, 1);
    } else {
      if (title) {
        var size = Math.round(h * 0.18), tx = w / 2, ty = h * 0.26, maxTW = w * 0.88;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 16 && ctx.measureText(title).width > maxTW) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(4, size * 0.13); ctx.strokeStyle = 'rgba(15,18,22,0.92)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, tx, ty);
        var tg = ctx.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
        tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#ffd43b');
        ctx.fillStyle = tg; ctx.fillText(title, tx, ty);
      }
      var dirs = [0, 1, 2, 3, 1, 0, 2];
      var colors = [0, 1, 2, 3, 4, 5, 6];
      for (var k = 0; k < 7; k++) {
        var sx = w * (0.10 + k * 0.133);
        var sy = h * 0.76 + (k % 2) * h * 0.045;
        var ss = h * (k === 3 ? 0.27 : 0.22);
        ART.drawTile(ctx, colors[k], sx, sy, ss, dirs[k], 0, 1, 1);
      }
    }
  };

  G.art = ART;
})(window.GAME);
