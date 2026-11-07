/* game/art.js — вся графика «Ядра» процедурная: закатная пустыня, стальная пушка,
   мишени-круги, блоки, ядро и промо. Ни одного внешнего файла, ни одного обращения к
   Engine: этот же файл рисует иконку 512×512 и обложку 800×470 через pipeline/promo.html.
   Функции сцены работают в ЭКРАННЫХ координатах и получают s — пикселей на юнит мира. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var P = G.config.palette;
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
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ============================ фон ============================ */
  A.sky = function (ctx, w, h, t) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.sky1);
    g.addColorStop(0.42, P.sky2);
    g.addColorStop(0.72, P.sky3);
    g.addColorStop(1, P.sky4);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // солнце
    var sx = w * 0.74, sy = h * 0.30, sr = Math.min(w, h) * 0.16;
    var gl = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 3.4);
    gl.addColorStop(0, 'rgba(255,214,140,0.55)');
    gl.addColorStop(0.35, 'rgba(255,170,100,0.18)');
    gl.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = P.sun;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.sunCore;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 0.72, 0, Math.PI * 2); ctx.fill();
    // «полосы» заката по солнцу
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = P.sky3;
    for (var b = 0; b < 5; b++) {
      var by = sy - sr * 0.6 + b * sr * 0.32;
      ctx.fillRect(sx - sr * 1.4, by, sr * 2.8, sr * 0.055);
    }
    ctx.restore();

    // редкие вытянутые облака
    ctx.save();
    ctx.globalAlpha = 0.20;
    for (var c = 0; c < 6; c++) {
      var cx = hash(c * 3.3) * w + Math.sin(t * 0.04 + c) * 12;
      var cy = h * (0.12 + hash(c * 7.1) * 0.34);
      var cw = w * (0.14 + hash(c * 5.7) * 0.2);
      ctx.fillStyle = P.cloud;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, cw * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  A.dunes = function (ctx, w, h, baseY) {
    var far = [
      [0.00, 0.98], [0.10, 0.72], [0.20, 0.88], [0.32, 0.62], [0.46, 0.82],
      [0.58, 0.68], [0.70, 0.9], [0.82, 0.66], [0.92, 0.86], [1.00, 0.74]
    ];
    function band(col, amp, lift, seed) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (var i = 0; i < far.length; i++) {
        var x = far[i][0] * w, y = baseY - far[i][1] * amp - lift;
        if (i === 0) ctx.lineTo(x, y);
        else {
          var px = far[i - 1][0] * w, py = baseY - far[i - 1][1] * amp - lift;
          ctx.quadraticCurveTo((px + x) / 2, Math.min(py, y) - amp * 0.12, x, y);
        }
      }
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      // гребень подсвечен
      ctx.strokeStyle = 'rgba(255,196,140,0.12)';
      ctx.lineWidth = Math.max(1, h * 0.004);
      ctx.stroke();
    }
    band(P.duneFar, h * 0.18, h * 0.02, 1);
    band(P.duneMid, h * 0.13, 0, 2);
    band(P.duneNear, h * 0.08, -h * 0.02, 3);
  };

  /* Дальние столы-месы на горизонте: заполняют пустое небо, читаются как фон. */
  A.mesas = function (ctx, w, h, baseY, seed) {
    ctx.save();
    ctx.fillStyle = 'rgba(84,34,58,0.55)';
    for (var i = 0; i < 4; i++) {
      var x = w * (0.05 + hash(seed + i * 3.1) * 0.84);
      var bw = w * (0.09 + hash(seed + i * 5.7) * 0.15);
      var bh = h * (0.045 + hash(seed + i * 7.3) * 0.075);
      var y = baseY - bh;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + bw * 0.18, y);
      ctx.lineTo(x + bw * 0.82, y);
      ctx.lineTo(x + bw, baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  A.ground = function (ctx, x0, x1, y, h, seed) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, P.sandHi);
    g.addColorStop(0.12, P.sand);
    g.addColorStop(1, P.sandDark);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, x1 - x0, h);
    // кромка
    ctx.fillStyle = 'rgba(255,214,160,0.35)';
    ctx.fillRect(x0, y, x1 - x0, Math.max(1.5, h * 0.02));
    // песчинки и борозды
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = P.sandDark;
    for (var i = 0; i < 90; i++) {
      var px = x0 + hash(seed + i * 1.7) * (x1 - x0);
      var py = y + h * (0.18 + hash(seed + i * 4.3) * 0.78);
      var pw = Math.max(1, (x1 - x0) * 0.012 * (0.4 + hash(seed + i * 9.1)));
      ctx.fillRect(px, py, pw, Math.max(1, h * 0.008));
    }
    ctx.restore();
  };

  A.cactus = function (ctx, x, y, s, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.fillStyle = '#40202f';
    var hgt = s, wid = s * 0.22;
    rr(ctx, -wid / 2, -hgt, wid, hgt, wid * 0.45); ctx.fill();
    rr(ctx, -wid * 1.9, -hgt * 0.72, wid * 0.8, hgt * 0.42, wid * 0.4); ctx.fill();
    rr(ctx, -wid * 1.9, -hgt * 0.74, wid * 1.9, wid * 0.8, wid * 0.4); ctx.fill();
    rr(ctx, wid * 1.1, -hgt * 0.55, wid * 0.8, hgt * 0.3, wid * 0.4); ctx.fill();
    rr(ctx, wid * 0.1, -hgt * 0.58, wid * 1.8, wid * 0.8, wid * 0.4); ctx.fill();
    ctx.restore();
  };

  A.rock = function (ctx, x, y, s, seed) {
    ctx.save();
    ctx.fillStyle = '#4a2436';
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.7, y - s * 0.9, x - s * 0.1, y - s * 0.62);
    ctx.quadraticCurveTo(x + s * 0.5, y - s * 1.0, x + s * 0.9, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,180,130,0.10)';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y - s * 0.5);
    ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.78, x + s * 0.3, y - s * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /* ============================ пушка ============================ */
  /* cx, cy — ось вращения ствола в экранных координатах, s — px на юнит мира. */
  A.cannon = function (ctx, cx, cy, angle, s, opts) {
    opts = opts || {};
    var recoil = opts.recoil || 0;
    ctx.save();
    ctx.translate(cx, cy);
    // тень
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#25101e';
    ctx.beginPath();
    ctx.ellipse(6 * s, 78 * s, 108 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // лафет
    var wg = ctx.createLinearGradient(0, 0, 0, 84 * s);
    wg.addColorStop(0, P.wood); wg.addColorStop(1, P.woodDark);
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(-96 * s, 82 * s);
    ctx.lineTo(-58 * s, 6 * s);
    ctx.lineTo(52 * s, 6 * s);
    ctx.lineTo(96 * s, 82 * s);
    ctx.closePath(); ctx.fill();

    // колёса
    for (var wi = 0; wi < 2; wi++) {
      var wx = (wi ? 46 : -54) * s, wy = 66 * s, wr = (wi ? 32 : 40) * s;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(opts.t ? opts.t * 0.6 * (opts.roll || 0) : 0);
      ctx.fillStyle = P.woodDark;
      ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.brass; ctx.lineWidth = Math.max(2, wr * 0.13);
      ctx.beginPath(); ctx.arc(0, 0, wr * 0.86, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,199,100,0.55)'; ctx.lineWidth = Math.max(1.2, wr * 0.07);
      for (var sp = 0; sp < 6; sp++) {
        var a = sp * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * wr * 0.2, Math.sin(a) * wr * 0.2);
        ctx.lineTo(Math.cos(a) * wr * 0.84, Math.sin(a) * wr * 0.84);
        ctx.stroke();
      }
      ctx.fillStyle = P.brass;
      ctx.beginPath(); ctx.arc(0, 0, wr * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ствол
    ctx.save();
    ctx.translate(-recoil * s, 0);
    ctx.rotate(angle);
    var L1 = (G.config.cannon.len || 92) * s;
    var bg = ctx.createLinearGradient(0, -18 * s, 0, 18 * s);
    bg.addColorStop(0, P.steelHi);
    bg.addColorStop(0.35, P.steel);
    bg.addColorStop(1, P.steelDeep);
    rr(ctx, -26 * s, -17 * s, L1 + 26 * s, 34 * s, 11 * s);
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = Math.max(1.2, 1.4 * s);
    ctx.strokeStyle = 'rgba(20,14,22,0.55)'; ctx.stroke();
    // дульный срез
    ctx.fillStyle = P.steelDeep;
    rr(ctx, L1 - 4 * s, -14 * s, 12 * s, 28 * s, 5 * s); ctx.fill();
    ctx.fillStyle = '#120c14';
    ctx.beginPath(); ctx.ellipse(L1 + 6 * s, 0, 4.5 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
    // латунные обручи
    ctx.fillStyle = P.brass;
    for (var bi = 0; bi < 3; bi++) {
      var bx = (-14 + bi * 40) * s;
      rr(ctx, bx, -19 * s, 9 * s, 38 * s, 3 * s); ctx.fill();
    }
    // блик
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#ffffff';
    rr(ctx, -18 * s, -13 * s, L1 * 0.8, 5 * s, 3 * s); ctx.fill();
    ctx.restore();
    // цапфы
    ctx.fillStyle = P.steelDark;
    ctx.beginPath(); ctx.arc(0, 0, 15 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.brassHi;
    ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  /* ============================ мишень ============================ */
  A.target = function (ctx, x, y, r, opts) {
    opts = opts || {};
    var dead = !!opts.dead;
    var ht = opts.hitT;       // секунды с момента попадания
    var alpha = 1, scale = 1;
    if (dead) {
      if (ht == null || ht > 0.55) return;
      alpha = 1 - ht / 0.55;
      scale = 1 + ht * 1.6;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // подсветка
    var gl = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.9);
    gl.addColorStop(0, 'rgba(255,170,110,0.16)');
    gl.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2); ctx.fill();

    // железный обод
    ctx.fillStyle = P.steelDark;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.09, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.steel;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.stroke();

    // кольца
    var rings = [[1.0, P.targetCream], [0.78, P.targetRed], [0.56, P.targetCream],
                 [0.34, P.targetRed], [0.15, P.targetDark]];
    for (var i = 0; i < rings.length; i++) {
      ctx.fillStyle = rings[i][1];
      ctx.beginPath(); ctx.arc(0, 0, r * rings[i][0], 0, Math.PI * 2); ctx.fill();
    }
    // тёплый блик сверху-слева
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath(); ctx.arc(-r * 0.24, -r * 0.26, r * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // заклёпки по ободу
    ctx.fillStyle = 'rgba(20,14,22,0.75)';
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4 + 0.2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    // маячок: мишень «живая» и качается
    if (!dead) {
      var blink = 0.45 + 0.55 * Math.abs(Math.sin((opts.t || 0) * (opts.mv ? 5.5 : 2.2)));
      ctx.globalAlpha = alpha * blink;
      ctx.fillStyle = opts.mv ? '#ffb347' : '#8fd14f';
      ctx.beginPath(); ctx.arc(0, -r * 1.22, r * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  };

  /* ============================ стена ============================ */
  A.wall = function (ctx, x, y, w, h, s, seed) {
    ctx.save();
    // основа
    var g = ctx.createLinearGradient(x, y, x + w, y + h * 0.4);
    g.addColorStop(0, '#5a616c');
    g.addColorStop(0.5, P.steel);
    g.addColorStop(1, P.steelDark);
    rr(ctx, x, y, w, h, Math.min(w, h) * 0.12);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.2, 1.6 * s);
    ctx.strokeStyle = 'rgba(18,12,20,0.55)';
    ctx.stroke();

    // тёмная внутренняя панель
    ctx.save();
    rr(ctx, x, y, w, h, Math.min(w, h) * 0.12);
    ctx.clip();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#0d0a12';
    ctx.fillRect(x + w * 0.16, y + h * 0.06, w * 0.68, h * 0.88);
    ctx.globalAlpha = 1;

    // заклёпки по сетке
    ctx.fillStyle = 'rgba(226,232,240,0.30)';
    var step = Math.max(w, 46 * s) * 0.44;
    for (var yy = y + step * 0.6; yy < y + h - 4; yy += step) {
      for (var xx = x + w * 0.2; xx < x + w - 2; xx += w * 0.6) {
        ctx.beginPath(); ctx.arc(xx, yy, Math.max(1.4, 2.2 * s), 0, Math.PI * 2); ctx.fill();
      }
    }
    // предупреждающие косые полосы у верха
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, Math.min(h * 0.13, 16 * s)); ctx.clip();
    ctx.fillStyle = 'rgba(240,199,100,0.55)';
    for (var t2 = -w; t2 < w * 2; t2 += w * 0.42) {
      ctx.beginPath();
      ctx.moveTo(x + t2, y);
      ctx.lineTo(x + t2 + w * 0.16, y);
      ctx.lineTo(x + t2 + w * 0.16 - 8 * s, y + Math.min(h * 0.13, 16 * s));
      ctx.lineTo(x + t2 - 8 * s, y + Math.min(h * 0.13, 16 * s));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.restore();

    // светлая грань сверху
    ctx.fillStyle = 'rgba(255,220,170,0.20)';
    ctx.fillRect(x + w * 0.1, y + 1, w * 0.8, Math.max(1, 2 * s));
    ctx.restore();
  };

  /* ============================ ядро ============================ */
  A.ball = function (ctx, x, y, r, spin) {
    ctx.save();
    // дымный след рисует сцена по trail; тут — само ядро
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    g.addColorStop(0, P.ironHi);
    g.addColorStop(0.45, '#4c5661');
    g.addColorStop(1, P.iron);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(10,8,14,0.7)';
    ctx.lineWidth = Math.max(1, r * 0.10);
    ctx.stroke();
    // блик
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#e8eef6';
    ctx.beginPath(); ctx.arc(x - r * 0.34, y - r * 0.38, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  A.trail = function (ctx, pts, s, ax, ay) {
    for (var i = 0; i < pts.length; i++) {
      var k = i / pts.length;
      var p = pts[i];
      ctx.globalAlpha = 0.42 * k * k;
      ctx.fillStyle = P.smoke;
      ctx.beginPath();
      ctx.arc(ax + p.x * s, ay + p.y * s, Math.max(1.2, (2 + k * 8) * s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  A.muzzleFlash = function (ctx, x, y, angle, s, k) {
    if (k <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = Math.min(1, k);
    var g = ctx.createRadialGradient(0, 0, 1, 0, 0, 42 * s);
    g.addColorStop(0, 'rgba(255,250,220,0.95)');
    g.addColorStop(0.35, 'rgba(255,190,90,0.75)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 42 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,236,190,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -7 * s); ctx.lineTo(54 * s * (0.6 + k * 0.6), 0); ctx.lineTo(0, 7 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /* ============================ прицел ============================ */
  A.aimLine = function (ctx, x0, y0, x1, y1, power, s) {
    ctx.save();
    ctx.setLineDash([Math.max(3, 9 * s), Math.max(3, 9 * s)]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = 'rgba(255,205,140,' + (0.30 + power * 0.45) + ')';
    ctx.lineWidth = Math.max(1.5, 3 * s);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
    // рукоятка силы на конце
    ctx.save();
    ctx.strokeStyle = 'rgba(255,235,190,0.75)';
    ctx.lineWidth = Math.max(1.5, 2.6 * s);
    ctx.beginPath(); ctx.arc(x1, y1, Math.max(4, 10 * s), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,180,80,' + (0.25 + power * 0.5) + ')';
    ctx.beginPath(); ctx.arc(x1, y1, Math.max(2, 6 * s), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  A.previewDots = function (ctx, pts, s, ax, ay, color) {
    ctx.save();
    var n = pts.length;
    var step = Math.max(2, Math.round(n / 26));
    for (var i = 2; i < n; i += step) {
      var k = i / n;
      ctx.globalAlpha = 0.85 - k * 0.55;
      ctx.fillStyle = color || '#ffe0a8';
      var r = Math.max(1.2, 3.4 * s * (1 - k * 0.45));
      ctx.beginPath(); ctx.arc(ax + pts[i].x * s, ay + pts[i].y * s, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* ============================ мелочи UI ============================ */
  A.coin = function (ctx, x, y, r) {
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(0.55, P.gold);
    g.addColorStop(1, '#a8761c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,10,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.14); ctx.stroke();
    ctx.fillStyle = 'rgba(120,80,15,0.55)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill();
  };

  A.shellIcon = function (ctx, x, y, r, filled) {
    ctx.save();
    ctx.fillStyle = filled ? P.iron : 'rgba(255,240,220,0.16)';
    ctx.strokeStyle = filled ? P.ironHi : 'rgba(255,240,220,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (filled) {
      ctx.fillStyle = 'rgba(240,246,255,0.6)';
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  A.targetIcon = function (ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = P.targetCream;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.targetRed;
    ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.targetDark;
    ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  A.slowIcon = function (ctx, x, y, r) {
    ctx.save();
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = Math.max(1.2, r * 0.16);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x, y); ctx.lineTo(x + r * 0.45, y + r * 0.3);
    ctx.stroke();
    ctx.restore();
  };

  A.lock = function (ctx, x, y, s, col) {
    ctx.save();
    ctx.fillStyle = col || 'rgba(230,210,190,0.7)';
    rr(ctx, x - s * 0.42, y - s * 0.05, s * 0.84, s * 0.7, s * 0.12); ctx.fill();
    ctx.strokeStyle = col || 'rgba(230,210,190,0.7)';
    ctx.lineWidth = Math.max(1.5, s * 0.14);
    ctx.beginPath();
    ctx.arc(x, y - s * 0.05, s * 0.26, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  };

  /* ============================ промо ============================ */
  function promoBackdrop(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a1026');
    g.addColorStop(0.42, '#572846');
    g.addColorStop(0.75, '#a8453f');
    g.addColorStop(1, '#e08a52');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    var sx = w * 0.68, sy = h * 0.34, sr = Math.min(w, h) * 0.20;
    var gl = ctx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr * 3.2);
    gl.addColorStop(0, 'rgba(255,214,140,0.55)');
    gl.addColorStop(0.4, 'rgba(255,160,100,0.16)');
    gl.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd58a';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff2cf';
    ctx.beginPath(); ctx.arc(sx, sy, sr * 0.7, 0, Math.PI * 2); ctx.fill();

    // дюны
    function dune(y0, amp, col) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, y0 + amp);
      for (var i = 0; i <= 6; i++) {
        var x = w * i / 6;
        var y = y0 + Math.sin(i * 1.7 + amp) * amp * 0.8;
        if (i === 0) ctx.lineTo(x, y);
        else {
          var px = w * (i - 1) / 6;
          var py = y0 + Math.sin((i - 1) * 1.7 + amp) * amp * 0.8;
          ctx.quadraticCurveTo((px + x) / 2, Math.min(py, y) - amp * 0.35, x, y);
        }
      }
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    }
    dune(h * 0.66, h * 0.06, '#7a3346');
    dune(h * 0.76, h * 0.05, '#54243a');
    dune(h * 0.86, h * 0.035, '#35172a');
  }

  /* Дуга выстрела точками: общий мотив иконки и обложки. */
  function promoArc(ctx, x0, y0, x1, y1, n, col, r0) {
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      var x = x0 + (x1 - x0) * k;
      var y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * Math.abs(y1 - y0) * 0.92;
      var r = r0 * (1 - k * 0.35);
      ctx.globalAlpha = 0.85 - k * 0.35;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function promoTarget(ctx, x, y, r) {
    ctx.fillStyle = '#2b2f36';
    ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, Math.PI * 2); ctx.fill();
    var rings = [[1.0, '#f4e7cb'], [0.76, '#d64a3c'], [0.52, '#f4e7cb'], [0.28, '#d64a3c']];
    for (var i = 0; i < rings.length; i++) {
      ctx.fillStyle = rings[i][1];
      ctx.beginPath(); ctx.arc(x, y, r * rings[i][0], 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#3a2320';
    ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    promoBackdrop(ctx, w, h);
    var dict = {};
    try {
      var lang = 'ru';
      try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e2) {}
      dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};
    } catch (e) {}

    if (kind === 'icon') {
      // иконка 512: пушка слева внизу, дуга, крупная мишень справа сверху. Без текста.
      var s = w / 1000 * 1.2;
      // затемнение под пушкой — силуэт читается на любом фоне (128×128 тоже)
      var vg = ctx.createRadialGradient(w * 0.24, h * 0.82, 8, w * 0.24, h * 0.82, w * 0.55);
      vg.addColorStop(0, 'rgba(24,10,26,0.62)');
      vg.addColorStop(1, 'rgba(24,10,26,0)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
      promoArc(ctx, w * 0.29, h * 0.70, w * 0.63, h * 0.35, 15, '#ffe0a8', w * 0.016);
      promoTarget(ctx, w * 0.70, h * 0.28, w * 0.17);
      A.ball(ctx, w * 0.455, h * 0.355, w * 0.05, 0);
      A.cannon(ctx, w * 0.215, h * 0.815, -0.80, s, { t: 0 });
      var g = ctx.createRadialGradient(w * 0.33, h * 0.665, 1, w * 0.33, h * 0.665, w * 0.19);
      g.addColorStop(0, 'rgba(255,246,214,0.9)');
      g.addColorStop(0.42, 'rgba(255,182,92,0.5)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(w * 0.33, h * 0.665, w * 0.19, 0, Math.PI * 2); ctx.fill();
      return;
    }

    // обложка 800×470: пушка слева, дуга и две мишени справа, название — на тёмной
    // табличке слева сверху, чтобы пунктир никогда не перечёркивал текст (5.6)
    var sc = w / 1000;
    promoArc(ctx, w * 0.255, h * 0.735, w * 0.855, h * 0.285, 22, '#ffe0a8', w * 0.0115);
    promoTarget(ctx, w * 0.865, h * 0.255, w * 0.088);
    promoTarget(ctx, w * 0.735, h * 0.575, w * 0.062);
    A.ball(ctx, w * 0.475, h * 0.245, w * 0.028, 0);
    A.cannon(ctx, w * 0.175, h * 0.795, -0.78, sc * 1.0, { t: 0 });

    // табличка
    var px = w * 0.035, py = h * 0.075, pw = w * 0.445, ph = h * 0.355;
    ctx.save();
    ctx.shadowColor = 'rgba(12,4,16,0.55)';
    ctx.shadowBlur = h * 0.05;
    rr(ctx, px, py, pw, ph, h * 0.035);
    ctx.fillStyle = 'rgba(22,11,26,0.74)'; ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, px, py, pw, ph, h * 0.035);
    ctx.clip();
    var gl = ctx.createLinearGradient(px, py, px + pw, py + ph);
    gl.addColorStop(0, 'rgba(255,179,71,0.16)');
    gl.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = gl; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(px + w * 0.012, py + ph * 0.16, Math.max(3, w * 0.007), ph * 0.68);
    ctx.restore();

    var t = title || 'Ядро';
    var size = h * 0.155;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    while (size > 22 && ctx.measureText(t).width > pw - w * 0.055) {
      size -= 2;
      ctx.font = '800 ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    }
    ctx.fillStyle = '#ffd58a';
    ctx.fillText(t, px + w * 0.032, py + ph * 0.32);
    ctx.font = '600 ' + Math.round(h * 0.052) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f8eeda';
    ctx.fillText(dict['cover_tag'] || '', px + w * 0.032, py + ph * 0.62);
    ctx.font = '500 ' + Math.round(h * 0.040) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(248,238,218,0.70)';
    ctx.fillText(dict['cover_line'] || '', px + w * 0.032, py + ph * 0.82);
  };

  G.art = A;
})(window.GAME);
