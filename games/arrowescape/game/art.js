/* game/art.js — процедурная графика «Побег Стрелок»: глянцевые плитки-стрелки,
   каменные стены, бомбы. Спрайты рисуются один раз в offscreen-canvas (атлас),
   затем только масштабируются/вращаются — дёшево для телефона.
   ART.promo рисует иконку 512×512 и обложку 800×470 из тех же спрайтов. */
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

  /* плитка со стрелкой вверх; цвет — базовый */
  function makeTile(color) {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var m = 10, s = SIZE - m * 2, rad = s * 0.22;
    // тень
    x.fillStyle = 'rgba(0,0,0,0.22)';
    rr(x, m, m + 8, s, s, rad); x.fill();
    // тело
    var g = x.createLinearGradient(0, m, 0, m + s);
    g.addColorStop(0, tint(color, 0.32));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, 0.26));
    x.fillStyle = g;
    rr(x, m, m, s, s, rad); x.fill();
    // верхний глянец
    x.save(); rr(x, m, m, s, s, rad); x.clip();
    var gl = x.createLinearGradient(0, m, 0, m + s * 0.45);
    gl.addColorStop(0, 'rgba(255,255,255,0.34)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gl; x.fillRect(m, m, s, s * 0.5);
    x.restore();
    // внутренняя рамка
    x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 3;
    rr(x, m + 5, m + 5, s - 10, s - 10, rad * 0.8); x.stroke();
    // тёмная окантовка
    x.strokeStyle = shade(color, 0.55); x.lineWidth = 5;
    rr(x, m, m, s, s, rad); x.stroke();

    // стрелка (вверх)
    var cx = SIZE / 2, cy = SIZE / 2 + 4, k = s * 0.30;
    function arrowPath(dx, dy) {
      x.beginPath();
      x.moveTo(cx, cy - k * 1.05 + dy);                    // острие
      x.lineTo(cx + k * 0.86, cy - k * 0.12 + dy);
      x.lineTo(cx + k * 0.32, cy - k * 0.12 + dy);
      x.lineTo(cx + k * 0.32, cy + k * 0.92 + dy);
      x.lineTo(cx - k * 0.32, cy + k * 0.92 + dy);
      x.lineTo(cx - k * 0.32, cy - k * 0.12 + dy);
      x.lineTo(cx - k * 0.86, cy - k * 0.12 + dy);
      x.closePath();
    }
    // тень стрелки
    x.fillStyle = 'rgba(0,0,0,0.22)';
    arrowPath(0, 6); x.fill();
    // сама стрелка
    var ag = x.createLinearGradient(0, cy - k, 0, cy + k);
    ag.addColorStop(0, '#ffffff');
    ag.addColorStop(1, '#e6f1ff');
    x.fillStyle = ag;
    arrowPath(0, 0); x.fill();
    x.strokeStyle = 'rgba(10,20,40,0.25)'; x.lineWidth = 2;
    arrowPath(0, 0); x.stroke();
    return cv;
  }

  function makeBomb() {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var m = 10, s = SIZE - m * 2, rad = s * 0.22;
    x.fillStyle = 'rgba(0,0,0,0.22)';
    rr(x, m, m + 8, s, s, rad); x.fill();
    var g = x.createLinearGradient(0, m, 0, m + s);
    g.addColorStop(0, '#7186b0'); g.addColorStop(0.5, '#4a5a7e'); g.addColorStop(1, '#2c3550');
    x.fillStyle = g; rr(x, m, m, s, s, rad); x.fill();
    x.strokeStyle = '#1a2035'; x.lineWidth = 5; rr(x, m, m, s, s, rad); x.stroke();
    // бомба
    var cx = SIZE / 2, cy = SIZE / 2 + 10, r = s * 0.24;
    x.fillStyle = '#1b2236';
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.5)';
    x.beginPath(); x.arc(cx - r * 0.32, cy - r * 0.36, r * 0.24, 0, Math.PI * 2); x.fill();
    // фитиль
    x.strokeStyle = '#c9b8a0'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx + r * 0.5, cy - r * 0.75); x.quadraticCurveTo(cx + r * 1.1, cy - r * 1.5, cx + r * 0.5, cy - r * 1.7); x.stroke();
    // искра
    x.fillStyle = '#ffd166';
    x.beginPath(); x.arc(cx + r * 0.5, cy - r * 1.75, r * 0.26, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff3bf';
    x.beginPath(); x.arc(cx + r * 0.5, cy - r * 1.75, r * 0.13, 0, Math.PI * 2); x.fill();
    return cv;
  }

  function makeWall() {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var m = 12, s = SIZE - m * 2, rad = s * 0.14;
    x.fillStyle = 'rgba(0,0,0,0.24)';
    rr(x, m, m + 7, s, s, rad); x.fill();
    var g = x.createLinearGradient(0, m, 0, m + s);
    g.addColorStop(0, '#7d8fb4'); g.addColorStop(0.5, '#54648a'); g.addColorStop(1, '#33405e');
    x.fillStyle = g; rr(x, m, m, s, s, rad); x.fill();
    x.strokeStyle = '#26304a'; x.lineWidth = 5; rr(x, m, m, s, s, rad); x.stroke();
    // «кирпичи»
    x.strokeStyle = 'rgba(20,30,50,0.4)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(m + s * 0.5, m); x.lineTo(m + s * 0.5, m + s); x.stroke();
    x.beginPath(); x.moveTo(m, m + s * 0.5); x.lineTo(m + s, m + s * 0.5); x.stroke();
    // блик
    x.fillStyle = 'rgba(255,255,255,0.16)';
    rr(x, m + 8, m + 8, s - 16, s * 0.28, rad * 0.7); x.fill();
    return cv;
  }

  function makeCrate() {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var x = cv.getContext('2d');
    var m = 12, s = SIZE - m * 2, rad = s * 0.10;
    x.fillStyle = 'rgba(0,0,0,0.24)';
    rr(x, m, m + 8, s, s, rad); x.fill();
    var g = x.createLinearGradient(0, m, 0, m + s);
    g.addColorStop(0, '#c98a4b'); g.addColorStop(0.5, '#a86a33'); g.addColorStop(1, '#76451f');
    x.fillStyle = g; rr(x, m, m, s, s, rad); x.fill();
    x.strokeStyle = '#4a2a12'; x.lineWidth = 6; rr(x, m, m, s, s, rad); x.stroke();
    // доски
    x.strokeStyle = 'rgba(74,42,18,0.55)'; x.lineWidth = 4;
    for (var i = 1; i <= 3; i++) {
      x.beginPath(); x.moveTo(m + 4, m + s * i / 4); x.lineTo(m + s - 4, m + s * i / 4); x.stroke();
    }
    // металлические углы
    x.fillStyle = '#d9c7a6';
    var csz = s * 0.16;
    [[m, m], [m + s - csz, m], [m, m + s - csz], [m + s - csz, m + s - csz]].forEach(function (p) {
      x.fillRect(p[0], p[1], csz, csz);
    });
    // крест-распорка
    x.strokeStyle = 'rgba(255,231,190,0.35)'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(m + 10, m + 10); x.lineTo(m + s - 10, m + s - 10); x.stroke();
    x.beginPath(); x.moveTo(m + s - 10, m + 10); x.lineTo(m + 10, m + s - 10); x.stroke();
    return cv;
  }

  ART.init = function () {
    if (ART.tiles) return;
    var cols = G.config.palette.tileColors;
    ART.tiles = [];
    for (var i = 0; i < cols.length; i++) ART.tiles.push(makeTile(cols[i]));
    ART.bomb = makeBomb();
    ART.wall = makeWall();
    ART.crate = makeCrate();
  };

  /* alpha/scale — для анимаций; shadow — лёгкая тень под плиткой */
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

  /* лёд поверх стрелки: полупрозрачная корка, блики и трещины */
  ART.drawIce = function (ctx, x, y, size, t) {
    var s = size * 0.92, r = s * 0.2;
    ctx.save();
    ctx.globalAlpha = 0.9;
    var g = ctx.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
    g.addColorStop(0, 'rgba(200,240,255,0.55)');
    g.addColorStop(0.5, 'rgba(120,200,255,0.28)');
    g.addColorStop(1, 'rgba(235,252,255,0.50)');
    rr(ctx, x - s / 2, y - s / 2, s, s, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(235,252,255,0.85)'; ctx.lineWidth = Math.max(2, size * 0.025);
    ctx.stroke();
    // трещины
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1.5, size * 0.018);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.28, y - s * 0.34);
    ctx.lineTo(x + s * 0.02, y - s * 0.02);
    ctx.lineTo(x - s * 0.16, y + s * 0.30);
    ctx.moveTo(x + s * 0.02, y - s * 0.02);
    ctx.lineTo(x + s * 0.32, y - s * 0.18);
    ctx.stroke();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.2 * Math.sin((t || 0) * 3)) + ')';
    ctx.beginPath(); ctx.ellipse(x - s * 0.2, y - s * 0.26, s * 0.16, s * 0.06, -0.6, 0, Math.PI * 2); ctx.fill();
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

  /* промо: иконка без текста, обложка с названием сверху */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var rf = (typeof rng === 'function') ? rng : function () { return rng.float(); };
    var P = G.config.palette;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // геометрические искры фона
    var cols = ['#4dd4ac', '#5aa9ff', '#ff9f68', '#c77dff', '#ffd166'];
    for (var i = 0; i < 34; i++) {
      ctx.globalAlpha = 0.10 + 0.22 * rf();
      ctx.fillStyle = cols[i % cols.length];
      var rr2 = 2 + rf() * 7;
      ctx.beginPath(); ctx.arc(rf() * w, rf() * h, rr2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (kind === 'icon') {
      var s = h * 0.52;
      ART.drawTile(ctx, 0, w * 0.5, h * 0.54, s, 0, 0, 1, 1);
      ART.drawTile(ctx, 1, w * 0.20, h * 0.22, s * 0.34, 1, 0, 0.95, 1);
      ART.drawTile(ctx, 2, w * 0.80, h * 0.24, s * 0.30, 3, 0, 0.95, 1);
      ART.drawTile(ctx, 3, w * 0.78, h * 0.82, s * 0.26, 2, 0, 0.9, 1);
    } else {
      if (title) {
        var size = Math.round(h * 0.18), tx = w / 2, ty = h * 0.27, maxTW = w * 0.88;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 16 && ctx.measureText(title).width > maxTW) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(4, size * 0.13); ctx.strokeStyle = 'rgba(8,16,32,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, tx, ty);
        var tg = ctx.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
        tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#8ff0d2');
        ctx.fillStyle = tg; ctx.fillText(title, tx, ty);
      }
      // ряд плиток внизу, чередование направлений
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
