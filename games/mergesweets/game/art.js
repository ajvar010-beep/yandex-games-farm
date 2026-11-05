/* game/art.js — процедурные сладости «Слияние Суфле»: глянцевые шары-конфеты с бликом,
   сахарной посыпкой и деталью по тиру. Рисуются на offscreen-canvas один раз (атлас).
   Атлас: G.art.balls[tier] = canvas (квадрат, шар по центру). promo() рисует иконку/обложку. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(c1, c2, k) { var a = hex(c1), b = hex(c2); return 'rgb(' + ((a[0] + (b[0] - a[0]) * k) | 0) + ',' + ((a[1] + (b[1] - a[1]) * k) | 0) + ',' + ((a[2] + (b[2] - a[2]) * k) | 0) + ')'; }
  function shade(c, k) { return mix(c, '#000000', k); }
  function tint(c, k) { return mix(c, '#ffffff', k); }

  var ATLAS_SIZE = 200;

  /* один шар-сладость в центре canvas size×size */
  function drawSweet(ctx, size, tier) {
    var cfg = G.config.tiers[tier];
    var cx = size / 2, cy = size / 2;
    var r = size * 0.46;                                  // базовый радиус в атласе
    var col = cfg.color, hi = cfg.hi;
    var rng = (window.Engine && E.Rng) ? new E.Rng(1000 + tier * 37) : null;
    function rr(a, b) { return rng ? (a + (b - a) * rng.float()) : (a + b) / 2; }

    // тень-ободок (лёгкий)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.06, r, r * 0.98, 0, 0, Math.PI * 2); ctx.fill();

    // тело — радиальный градиент (объём)
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, tint(col, 0.5));
    g.addColorStop(0.45, col);
    g.addColorStop(1, shade(col, 0.32));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // деталь по тиру (полоски/крап/завиток/глазурь)
    drawDetail(ctx, cx, cy, r, tier, col, hi, rr);

    // глянец (большой блик сверху-слева + маленький)
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.34, cy - r * 0.42, r * 0.30, r * 0.17, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(cx + r * 0.28, cy - r * 0.2, r * 0.10, r * 0.06, 0.5, 0, Math.PI * 2); ctx.fill();

    // тонкая тёмная окантовка
    ctx.strokeStyle = shade(col, 0.5); ctx.lineWidth = Math.max(1.5, size * 0.012);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }

  function drawDetail(ctx, cx, cy, r, tier, col, hi, rr) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2); ctx.clip();
    if (tier === 0 || tier === 3 || tier === 6) {          // сахарная посыпка
      ctx.fillStyle = tint(col, 0.7);
      for (var i = 0; i < 14; i++) {
        var a = rr(0, Math.PI * 2), d = rr(0.2, 0.85) * r;
        ctx.save(); ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d); ctx.rotate(rr(0, 3));
        ctx.fillRect(-r * 0.03, -r * 0.008, r * 0.06, r * 0.016); ctx.restore();
      }
    } else if (tier === 1 || tier === 4 || tier === 7) {   // полоски (леденец)
      ctx.strokeStyle = tint(col, 0.6); ctx.lineWidth = r * 0.14;
      for (var k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(cx - r, cy + k * r * 0.5 + r * 0.2);
        ctx.quadraticCurveTo(cx, cy + k * r * 0.5 - r * 0.25, cx + r, cy + k * r * 0.5 + r * 0.2); ctx.stroke();
      }
    } else if (tier === 2 || tier === 8) {                 // спираль-завиток
      ctx.strokeStyle = hi; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
      ctx.beginPath();
      for (var t = 0; t < 3.6; t += 0.1) {
        var rad = (t / 3.6) * r * 0.7, an = t * 2.2;
        var x = cx + Math.cos(an) * rad, y = cy + Math.sin(an) * rad;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (tier === 5 || tier === 9) {                 // точки (ягода)
      ctx.fillStyle = shade(col, 0.25);
      for (var d2 = 0; d2 < 9; d2++) {
        var a2 = rr(0, Math.PI * 2), dd = rr(0.25, 0.8) * r;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * dd, cy + Math.sin(a2) * dd, r * 0.06, 0, Math.PI * 2); ctx.fill();
      }
    } else {                                                // 10 финал: корона-глазурь сверху
      ctx.fillStyle = hi;
      for (var w = 0; w < 5; w++) {
        var xw = cx - r * 0.7 + w * r * 0.35;
        ctx.beginPath(); ctx.moveTo(xw, cy - r * 0.5);
        ctx.lineTo(xw + r * 0.14, cy - r * 0.9); ctx.lineTo(xw + r * 0.28, cy - r * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.5, r * 0.78, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  var ART = { balls: null, coin: null, SIZE: ATLAS_SIZE };

  ART.init = function () {
    if (ART.balls) return;
    if (!window.Engine) window.Engine = {};
    E = window.Engine;
    if (!E.Rng) {
      E.Rng = function (seed) { var a = (seed >>> 0) || 1; return { float: function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }, angle: function () { return this.float() * Math.PI * 2; }, range: function (a, b) { return a + (b - a) * this.float(); }, int: function (a, b) { return a + Math.floor(this.float() * (b - a + 1)); } }; };
    }
    var n = G.config.tiers.length;
    ART.balls = [];
    for (var t = 0; t < n; t++) {
      var c = document.createElement('canvas'); c.width = c.height = ATLAS_SIZE;
      drawSweet(c.getContext('2d'), ATLAS_SIZE, t);
      ART.balls.push(c);
    }
    // монета
    var cc = document.createElement('canvas'); cc.width = cc.height = 64;
    var x = cc.getContext('2d');
    var g2 = x.createLinearGradient(0, 0, 0, 64);
    g2.addColorStop(0, '#ffe066'); g2.addColorStop(1, '#f08c00');
    x.fillStyle = g2; x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#c47300'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#fff3bf'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('◉', 32, 34);
    ART.coin = cc;
  };

  /* рисовать шар тира tier в (x,y) радиуса r; popK — «поп»-масштаб при мердже; breathe — лёгкая пульсация */
  ART.drawSweet = function (ctx, tier, x, y, r, t, phase, popK) {
    if (!ART.balls) return;
    var img = ART.balls[Math.max(0, Math.min(tier, ART.balls.length - 1))];
    var pulse = 1 + Math.sin((t || 0) * 2 + (phase || 0)) * 0.02;
    var sc = pulse * (popK ? 1 + Math.sin(popK * Math.PI) * 0.3 : 1);
    var d = r * 2 / 0.46 * 0.5;   // ATLAS ball r = 0.46*size → масштаб
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.drawImage(img, -d, -d, d * 2, d * 2);
    ctx.restore();
  };

  /* promo: иконка/обложка из тех же спрайтов */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    // promo.html передаёт функцию mulberry32; поддерживаем и объект E.Rng с float().
    var rf = (typeof rng === 'function') ? rng : function () { return rng.float(); };
    // фон-градиент сладкой лаванды
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#4a2c7a'); g.addColorStop(1, '#2b1a3e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // конфетти
    var cols = ['#ff8fab', '#ffd43b', '#63e6be', '#74c0fc', '#e599f7'];
    for (var i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.25 + 0.35 * rf();
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.arc(rf() * w, rf() * h, 2 + rf() * 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (kind === 'icon') {
      // большое СУФЛЕ (финал) по центру + малые
      ART.drawSweet(ctx, 10, w * 0.5, h * 0.55, h * 0.30, 0, 0, 0);
      ART.drawSweet(ctx, 0, w * 0.22, h * 0.30, h * 0.12, 0, 0, 0);
      ART.drawSweet(ctx, 2, w * 0.78, h * 0.28, h * 0.13, 0, 0, 0);
      ART.drawSweet(ctx, 4, w * 0.26, h * 0.78, h * 0.11, 0, 0, 0);
    } else {
      // cover: название сверху по центру (гарантированно влезает) + каскад сладостей снизу
      var maxTW = w * 0.86;
      if (title) {
        var size = Math.round(h * 0.17), tx = w / 2, ty = h * 0.26;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 16 && ctx.measureText(title).width > maxTW) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(4, size * 0.14); ctx.strokeStyle = 'rgba(30,16,60,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, tx, ty);
        var tg = ctx.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
        tg.addColorStop(0, '#fff0f6'); tg.addColorStop(1, '#ff9ad5');
        ctx.fillStyle = tg; ctx.fillText(title, tx, ty);
      }
      // каскад сладостей по нижней дуге — от конфетки к СУФЛЕ
      var tiersC = [0, 2, 4, 6, 8, 10];
      for (var k = 0; k < tiersC.length; k++) {
        var t = tiersC[k];
        var sx = w * (0.14 + k * 0.144);
        var sy = h * (0.72 - Math.sin(k / (tiersC.length - 1) * Math.PI) * 0.13);
        ART.drawSweet(ctx, t, sx, sy, h * (0.075 + k * 0.014), 0, 0, 0);
      }
    }
  };

  G.art = ART;
})(window.GAME);
