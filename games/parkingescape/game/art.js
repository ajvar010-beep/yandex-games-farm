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

  /* ---------- машины: официальный Kenney Racing Pack (CC0) ----------
     5 цветов × 5 кузовов, PNG лежат локально в assets/cars/.
     Спрайты смотрят носом вверх; drawTile поворачивает по dir. */
  var CAR_COLORS = ['red', 'blue', 'yellow', 'green', 'black'];
  var CAR_VARIANTS = 5;

  function carFallback(ctx, color, size) {
    ctx.fillStyle = color;
    rr(ctx, -size * 0.24, -size * 0.46, size * 0.48, size * 0.92, size * 0.10); ctx.fill();
    ctx.fillStyle = 'rgba(160,205,235,0.9)';
    rr(ctx, -size * 0.17, -size * 0.22, size * 0.34, size * 0.16, size * 0.03); ctx.fill();
    rr(ctx, -size * 0.17, size * 0.06, size * 0.34, size * 0.12, size * 0.03); ctx.fill();
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
    if (ART.cars) return;
    ART.cars = []; ART.tiles = [];
    for (var c = 0; c < CAR_COLORS.length; c++) {
      var row = [];
      for (var v = 1; v <= CAR_VARIANTS; v++) {
        var im = new Image();
        im.src = (G.assetBase || '') + 'assets/cars/car_' + CAR_COLORS[c] + '_' + v + '.png';
        row.push(im);
      }
      ART.cars.push(row);
      ART.tiles.push(row[0]);
    }
    ART.bomb = makeTow();
    ART.wall = makeWall();
    ART.crate = makeBlock();
  };

  /* дождаться загрузки всех PNG (для промо и первого кадра) */
  ART.preload = function () {
    ART.init();
    var waits = [];
    for (var c = 0; c < ART.cars.length; c++) {
      for (var v = 0; v < ART.cars[c].length; v++) {
        (function (im) {
          waits.push(new Promise(function (res) {
            if (im.complete && im.naturalWidth) { res(); return; }
            im.onload = res; im.onerror = res;
          }));
        })(ART.cars[c][v]);
      }
    }
    return Promise.all(waits);
  };

  /* alpha/scale — для анимаций; машина по умолчанию носом вверх, dir поворачивает */
  ART.drawTile = function (ctx, colorIdx, x, y, size, dir, special, alpha, scale, variant) {
    if (!ART.cars) ART.init();
    var img = null;
    if (special === 'bomb') img = ART.bomb;
    else {
      var row = ART.cars[colorIdx % ART.cars.length];
      img = row[((variant || 1) - 1) % row.length];
      if (!img || !img.complete || !img.naturalWidth) img = null;
    }
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    if (special !== 'bomb') ctx.rotate(dir * Math.PI / 2);
    if (special === 'bomb') {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else if (img) {
      var hh = size * 0.94;
      var ww = hh * img.naturalWidth / img.naturalHeight;
      ctx.drawImage(img, -ww / 2, -hh / 2, ww, hh);
    } else {
      carFallback(ctx, G.config.palette.tileColors[colorIdx % 5], size);
    }
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
      ART.drawTile(ctx, 0, w * 0.5, h * 0.54, s, 0, 0, 1, 1, 1);
      ART.drawTile(ctx, 1, w * 0.20, h * 0.24, s * 0.34, 1, 0, 0.95, 1, 2);
      ART.drawTile(ctx, 2, w * 0.80, h * 0.26, s * 0.30, 3, 0, 0.95, 1, 3);
      ART.drawTile(ctx, 3, w * 0.78, h * 0.82, s * 0.26, 2, 0, 0.9, 1, 4);
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
      var colors = [0, 1, 2, 3, 4, 0, 1];
      var variants = [1, 2, 3, 4, 5, 2, 4];
      for (var k = 0; k < 7; k++) {
        var sx = w * (0.10 + k * 0.133);
        var sy = h * 0.76 + (k % 2) * h * 0.045;
        var ss = h * (k === 3 ? 0.27 : 0.22);
        ART.drawTile(ctx, colors[k], sx, sy, ss, dirs[k], 0, 1, 1, variants[k]);
      }
    }
  };

  G.art = ART;
})(window.GAME);
