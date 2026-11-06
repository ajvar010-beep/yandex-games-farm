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

  /* ---------- машины: 7 разных силуэтов ---------- */
  var STYLES = [
    { id: 'sport',  L: 146, halfW: 55, nose: 44, tail: 50, cabF: 54, cabR: 104, spoiler: 1 },
    { id: 'sedan',  L: 150, halfW: 52, nose: 42, tail: 46, cabF: 52, cabR: 112 },
    { id: 'taxi',   L: 150, halfW: 52, nose: 42, tail: 46, cabF: 52, cabR: 112, taxi: 1 },
    { id: 'suv',    L: 154, halfW: 54, nose: 48, tail: 50, cabF: 44, cabR: 128, rails: 1 },
    { id: 'hatch',  L: 138, halfW: 50, nose: 42, tail: 44, cabF: 48, cabR: 118, hatch: 1 },
    { id: 'van',    L: 158, halfW: 52, nose: 46, tail: 48, cabF: 34, cabR: 140, van: 1 },
    { id: 'pickup', L: 156, halfW: 52, nose: 46, tail: 48, cabF: 40, cabR: 96, pickup: 1 }
  ];

  function carPath(ctx, cx, y0, y1, halfW, nose, tail) {
    ctx.beginPath();
    ctx.moveTo(cx - nose, y0 + 9);
    ctx.quadraticCurveTo(cx - halfW * 0.92, y0, cx - halfW, y0 + 20);
    ctx.lineTo(cx - halfW, y1 - 22);
    ctx.quadraticCurveTo(cx - halfW, y1 - 5, cx - tail, y1);
    ctx.lineTo(cx + tail, y1);
    ctx.quadraticCurveTo(cx + halfW, y1 - 5, cx + halfW, y1 - 22);
    ctx.lineTo(cx + halfW, y0 + 20);
    ctx.quadraticCurveTo(cx + halfW * 0.92, y0, cx + nose, y0 + 9);
    ctx.quadraticCurveTo(cx, y0 - 3, cx - nose, y0 + 9);
    ctx.closePath();
  }

  function glassPoly(ctx, pts, c1, c2) {
    var g = ctx.createLinearGradient(0, pts[0][1], 0, pts[2][1]);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(225,245,255,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  }

  function makeCar(color, st) {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var cx = SIZE / 2, y0 = 16, y1 = y0 + st.L, halfW = st.halfW;
    var nose = st.nose, tail = st.tail;

    x.fillStyle = 'rgba(0,0,0,0.32)';
    x.beginPath(); x.ellipse(cx, y1 - 6, halfW + 6, st.L * 0.47, 0, 0, Math.PI * 2); x.fill();

    var tireW = 16, tireH = 36;
    var wheelY = [y0 + 38, y1 - 54];
    for (var wi = 0; wi < 2; wi++) {
      for (var side = -1; side <= 1; side += 2) {
        var wx = cx + side * (halfW - 5) - (side > 0 ? 0 : tireW);
        var wy = wheelY[wi];
        x.fillStyle = '#111318';
        rr(x, wx, wy, tireW, tireH, 6); x.fill();
        x.fillStyle = '#8a939f';
        rr(x, wx + 4, wy + 8, 8, tireH - 16, 3); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.35)';
        rr(x, wx + 5, wy + 13, 3, tireH - 26, 1.5); x.fill();
      }
    }

    var bg = x.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    bg.addColorStop(0, tint(color, 0.34));
    bg.addColorStop(0.28, tint(color, 0.12));
    bg.addColorStop(0.62, color);
    bg.addColorStop(1, shade(color, 0.34));
    carPath(x, cx, y0, y1, halfW, nose, tail);
    x.fillStyle = bg; x.fill();
    x.strokeStyle = shade(color, 0.55); x.lineWidth = 3; x.stroke();

    x.save(); carPath(x, cx, y0, y1, halfW, nose, tail); x.clip();
    var sideG = x.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    sideG.addColorStop(0, 'rgba(0,0,0,0.18)');
    sideG.addColorStop(0.18, 'rgba(0,0,0,0)');
    sideG.addColorStop(0.82, 'rgba(0,0,0,0)');
    sideG.addColorStop(1, 'rgba(0,0,0,0.26)');
    x.fillStyle = sideG; x.fillRect(cx - halfW, y0, halfW * 2, st.L);
    x.restore();

    x.strokeStyle = 'rgba(15,18,22,0.55)'; x.lineWidth = 2;
    for (var ai = 0; ai < 2; ai++) {
      x.beginPath(); x.arc(cx - halfW + 2, wheelY[ai] + tireH / 2, tireH * 0.52, -1.2, 1.2); x.stroke();
      x.beginPath(); x.arc(cx + halfW - 2, wheelY[ai] + tireH / 2, tireH * 0.52, Math.PI - 1.2, Math.PI + 1.2); x.stroke();
    }

    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(cx - halfW * 0.55, y0 + 26); x.quadraticCurveTo(cx, y0 + 20, cx + halfW * 0.55, y0 + 26); x.stroke();
    x.beginPath(); x.moveTo(cx - halfW * 0.55, y1 - 18); x.quadraticCurveTo(cx, y1 - 24, cx + halfW * 0.55, y1 - 18); x.stroke();

    var cabTop = y0 + st.cabF, cabBot = y0 + st.cabR;
    var wTop = halfW * 0.72, wBot = halfW * 0.60;
    glassPoly(x, [[cx - wTop, cabTop], [cx + wTop, cabTop], [cx + wBot, cabTop + 24], [cx - wBot, cabTop + 24]],
      'rgba(225,246,255,0.92)', 'rgba(38,68,96,0.96)');
    x.save();
    x.beginPath(); x.moveTo(cx - wTop * 0.7, cabTop + 3); x.lineTo(cx - wTop * 0.15, cabTop + 3);
    x.lineTo(cx - wTop * 0.35, cabTop + 20); x.lineTo(cx - wTop * 0.9, cabTop + 20); x.closePath();
    x.fillStyle = 'rgba(255,255,255,0.28)'; x.fill(); x.restore();

    var roofG = x.createLinearGradient(0, cabTop + 24, 0, cabBot - 22);
    roofG.addColorStop(0, tint(color, 0.10));
    roofG.addColorStop(0.5, shade(color, 0.06));
    roofG.addColorStop(1, shade(color, 0.18));
    rr(x, cx - halfW * 0.70, cabTop + 24, halfW * 1.40, cabBot - cabTop - 46, 12);
    x.fillStyle = roofG; x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1.5; x.stroke();

    if (st.id === 'sport' || st.id === 'suv') {
      rr(x, cx - halfW * 0.42, cabTop + 32, halfW * 0.84, Math.max(14, cabBot - cabTop - 62), 7);
      x.fillStyle = 'rgba(26,44,62,0.55)'; x.fill();
      x.strokeStyle = 'rgba(200,235,255,0.35)'; x.lineWidth = 1; x.stroke();
    }

    var sideY = cabTop + 30, sideH = Math.max(16, cabBot - cabTop - 54);
    x.fillStyle = 'rgba(40,70,98,0.75)';
    rr(x, cx - halfW * 0.86, sideY, 7, sideH, 3); x.fill();
    rr(x, cx + halfW * 0.86 - 7, sideY, 7, sideH, 3); x.fill();
    x.fillStyle = shade(color, 0.2);
    x.fillRect(cx - halfW * 0.84, sideY + sideH * 0.5 - 2, 9, 4);
    x.fillRect(cx + halfW * 0.84 - 9, sideY + sideH * 0.5 - 2, 9, 4);

    var rTop = halfW * 0.70, rBot = halfW * 0.52;
    glassPoly(x, [[cx - rTop, cabBot - 22], [cx + rTop, cabBot - 22], [cx + rBot, cabBot], [cx - rBot, cabBot]],
      'rgba(38,68,96,0.96)', 'rgba(210,240,255,0.66)');

    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1.2;
    var seamY = cabTop + 44;
    x.beginPath(); x.moveTo(cx - halfW + 4, seamY); x.lineTo(cx - halfW * 0.55, seamY); x.stroke();
    x.beginPath(); x.moveTo(cx + halfW * 0.55, seamY); x.lineTo(cx + halfW - 4, seamY); x.stroke();
    x.fillStyle = 'rgba(230,240,250,0.65)';
    rr(x, cx - halfW + 5, seamY - 16, 9, 3, 1.5); x.fill();
    rr(x, cx + halfW - 14, seamY - 16, 9, 3, 1.5); x.fill();

    x.fillStyle = shade(color, 0.28);
    rr(x, cx - halfW - 7, cabTop - 2, 10, 7, 3); x.fill();
    rr(x, cx + halfW - 3, cabTop - 2, 10, 7, 3); x.fill();

    x.fillStyle = '#20262e';
    rr(x, cx - 16, y0 + 1, 32, 8, 3); x.fill();
    var hl = x.createLinearGradient(0, y0 + 4, 0, y0 + 14);
    hl.addColorStop(0, '#fffbe6'); hl.addColorStop(1, '#ffe066');
    x.fillStyle = hl;
    rr(x, cx - halfW * 0.78, y0 + 5, 22, 8, 4); x.fill();
    rr(x, cx + halfW * 0.78 - 22, y0 + 5, 22, 8, 4); x.fill();
    x.fillStyle = '#ff4d4f';
    rr(x, cx - halfW * 0.78, y1 - 11, 20, 7, 3); x.fill();
    rr(x, cx + halfW * 0.78 - 20, y1 - 11, 20, 7, 3); x.fill();
    x.fillStyle = '#f1f3f5';
    rr(x, cx - 13, y1 - 6, 26, 8, 2); x.fill();
    x.strokeStyle = '#495057'; x.lineWidth = 1; x.stroke();

    if (st.taxi) {
      // шашечки по бортам (не по стеклу)
      for (var ci = 0; ci < 4; ci++) {
        x.fillStyle = ci % 2 ? '#f8f9fa' : '#212529';
        x.fillRect(cx - halfW + 2, cabTop + 30 + ci * 9, 8, 7);
        x.fillRect(cx + halfW - 10, cabTop + 30 + ci * 9, 8, 7);
      }
      // крышный знак: белая рамка + жёлтый фонарь
      x.fillStyle = '#f8f9fa';
      rr(x, cx - 16, cabTop + 25, 32, 11, 4); x.fill();
      x.strokeStyle = '#212529'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = '#ffd43b';
      rr(x, cx - 12, cabTop + 27, 24, 7, 3); x.fill();
    }
    if (st.spoiler) {
      x.fillStyle = shade(color, 0.35);
      rr(x, cx - halfW * 0.86, y1 - 4, halfW * 1.72, 8, 4); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.2)'; x.lineWidth = 1; x.stroke();
    }
    if (st.rails) {
      x.strokeStyle = 'rgba(210,220,230,0.8)'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - halfW * 0.60, cabTop + 26); x.lineTo(cx - halfW * 0.60, cabBot - 24); x.stroke();
      x.beginPath(); x.moveTo(cx + halfW * 0.60, cabTop + 26); x.lineTo(cx + halfW * 0.60, cabBot - 24); x.stroke();
    }
    if (st.van) {
      x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(cx + halfW * 0.30, cabTop + 26); x.lineTo(cx + halfW * 0.30, cabBot - 26); x.stroke();
      x.fillStyle = '#20262e'; rr(x, cx - halfW * 0.35, cabTop + 32, halfW * 0.7, 12, 4); x.fill();
    }
    if (st.pickup) {
      x.fillStyle = 'rgba(18,22,28,0.78)';
      rr(x, cx - halfW * 0.72, cabBot + 2, halfW * 1.44, y1 - cabBot - 12, 5); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1.5;
      for (var bi = 1; bi < 5; bi++) {
        var by = cabBot + 6 + bi * ((y1 - cabBot - 20) / 5);
        x.beginPath(); x.moveTo(cx - halfW * 0.68, by); x.lineTo(cx + halfW * 0.68, by); x.stroke();
      }
    }

    x.save(); carPath(x, cx, y0, y1, halfW, nose, tail); x.clip();
    var gl = x.createLinearGradient(cx - halfW, y0, cx + halfW, y1);
    gl.addColorStop(0, 'rgba(255,255,255,0.34)');
    gl.addColorStop(0.18, 'rgba(255,255,255,0.10)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    x.fillStyle = gl; x.fillRect(cx - halfW, y0, halfW * 2, st.L);
    x.restore();
    carPath(x, cx, y0, y1, halfW, nose, tail);
    x.strokeStyle = 'rgba(10,12,16,0.35)'; x.lineWidth = 1.5; x.stroke();

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
