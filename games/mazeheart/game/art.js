/* game/art.js — вся графика процедурная: камни, мох, факелы, шар, ключи, дозорные, промо.
   Ни одного внешнего файла. Файл грузится и промо-страницей (pipeline/promo.html) без
   движка, поэтому НЕ трогает window.Engine на верхнем уровне и несёт свой мини-RNG. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var P = (G.config && G.config.palette) || {};

  /* Локальный детерминированный RNG (mulberry32) — совместим по API с E.Rng. */
  function mkRng(seed) {
    var a = (seed >>> 0) || 1;
    function next() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      float: next,
      range: function (lo, hi) { return lo + (hi - lo) * next(); },
      int: function (lo, hi) { return Math.floor(lo + (hi - lo + 1) * next()); },
      pick: function (arr) { return arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))]; },
      chance: function (p) { return next() < p; }
    };
  }

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

  function fitFont(ctx, text, maxW, size, weight) {
    var s = size;
    ctx.font = (weight || 800) + ' ' + Math.round(s) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    while (s > 10 && ctx.measureText(text).width > maxW) {
      s -= 2;
      ctx.font = (weight || 800) + ' ' + Math.round(s) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    }
    return s;
  }

  var A = { rng: mkRng };

  /* ================== лабиринт (запекается один раз на уровень) ================== */
  var FLOOR = ['#22382c', '#27402f', '#1f3329', '#243a2e', '#2b4237'];

  A.bakeMaze = function (m, cs, seed) {
    var W = Math.max(1, Math.round(m.w * cs)), H = Math.max(1, Math.round(m.h * cs));
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var rng = mkRng((seed >>> 0) ^ 0x9e3779b9);
    var th = Math.max(3, cs * 0.22);
    var x, y, c;

    /* пол */
    for (y = 0; y < m.h; y++) {
      for (x = 0; x < m.w; x++) {
        var px = x * cs, py = y * cs;
        ctx.fillStyle = FLOOR[rng.int(0, FLOOR.length - 1)];
        ctx.fillRect(px, py, cs + 0.5, cs + 0.5);
        /* плита: лёгкий блик сверху и шов */
        ctx.fillStyle = 'rgba(150,180,160,0.045)';
        ctx.fillRect(px + cs * 0.08, py + cs * 0.08, cs * 0.84, Math.max(1, cs * 0.06));
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(px, py, cs, 1);
        ctx.fillRect(px, py, 1, cs);
        /* трещины */
        if (rng.chance(0.35)) {
          ctx.strokeStyle = 'rgba(6,12,9,0.42)';
          ctx.lineWidth = Math.max(1, cs * 0.028);
          ctx.beginPath();
          var sx = px + rng.range(0.2, 0.8) * cs, sy = py + rng.range(0.2, 0.8) * cs;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + rng.range(-0.3, 0.3) * cs, sy + rng.range(-0.3, 0.3) * cs);
          ctx.lineTo(sx + rng.range(-0.4, 0.4) * cs, sy + rng.range(-0.4, 0.4) * cs);
          ctx.stroke();
        }
        /* мох */
        if (rng.chance(0.5)) {
          var mnum = rng.int(1, 2);
          for (var mi = 0; mi < mnum; mi++) {
            ctx.fillStyle = 'rgba(95,143,74,' + rng.range(0.16, 0.34).toFixed(2) + ')';
            ctx.beginPath();
            ctx.ellipse(px + rng.range(0.12, 0.88) * cs, py + rng.range(0.12, 0.88) * cs,
              cs * rng.range(0.06, 0.17), cs * rng.range(0.05, 0.13), rng.range(0, 3.14), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    /* стены: рисуем только верхнюю (N) и левую (W) стену каждой клетки + низ/право карты,
       поэтому каждая общая стена попадает в рисунок ровно один раз */
    function wallH(px, py) {
      ctx.fillStyle = 'rgba(4,8,6,0.55)';
      rr(ctx, px - th / 2, py - th / 2 + 2, cs + th, th, th * 0.30); ctx.fill();
      ctx.fillStyle = '#41564b';
      rr(ctx, px - th / 2, py - th / 2, cs + th, th * 0.94, th * 0.30); ctx.fill();
      ctx.fillStyle = 'rgba(168,196,176,0.42)';
      rr(ctx, px - th / 2 + 1, py - th / 2 + 1.5, cs + th - 2, th * 0.26, th * 0.14); ctx.fill();
      var hs = Math.max(1, Math.round(cs / (th * 2.2)));
      ctx.fillStyle = 'rgba(8,15,12,0.30)';
      for (var si = 1; si < hs; si++) ctx.fillRect(px + (si * cs) / hs, py - th / 2 + 1, Math.max(1, th * 0.09), th - 2);
      if (rng.chance(0.34)) {
        ctx.fillStyle = 'rgba(105,152,82,0.50)';
        var mn = rng.int(1, 3);
        for (var i = 0; i < mn; i++) {
          ctx.beginPath();
          ctx.ellipse(px + rng.range(0.1, 0.9) * cs, py + th / 2 - th * 0.22,
            cs * rng.range(0.04, 0.11), th * rng.range(0.14, 0.30), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    function wallV(px, py) {
      ctx.fillStyle = 'rgba(4,8,6,0.55)';
      rr(ctx, px - th / 2 + 2, py - th / 2, th, cs + th, th * 0.30); ctx.fill();
      ctx.fillStyle = '#3b5046';
      rr(ctx, px - th / 2, py - th / 2, th * 0.94, cs + th, th * 0.30); ctx.fill();
      ctx.fillStyle = 'rgba(168,196,176,0.30)';
      rr(ctx, px - th / 2 + 1.5, py - th / 2 + 1, th * 0.24, cs + th - 2, th * 0.12); ctx.fill();
      var vs = Math.max(1, Math.round(cs / (th * 2.2)));
      ctx.fillStyle = 'rgba(8,15,12,0.30)';
      for (var vi = 1; vi < vs; vi++) ctx.fillRect(px - th / 2 + 1, py + (vi * cs) / vs, th - 2, Math.max(1, th * 0.09));
      if (rng.chance(0.30)) {
        ctx.fillStyle = 'rgba(105,152,82,0.48)';
        ctx.beginPath();
        ctx.ellipse(px + th / 2 - th * 0.24, py + rng.range(0.15, 0.85) * cs,
          th * rng.range(0.16, 0.30), cs * rng.range(0.05, 0.12), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (y = 0; y < m.h; y++) {
      for (x = 0; x < m.w; x++) {
        c = y * m.w + x;
        if (m.walls[c] & 1) wallH(x * cs, y * cs);
        if (m.walls[c] & 8) wallV(x * cs, y * cs);
        if (y === m.h - 1 && (m.walls[c] & 4)) wallH(x * cs, (y + 1) * cs);
        if (x === m.w - 1 && (m.walls[c] & 2)) wallV((x + 1) * cs, y * cs);
      }
    }

    /* факелы: на случайных стенах, чуть внутрь клетки */
    var torches = [];
    var want = Math.max(3, Math.round(m.w * m.h / 22));
    for (var ti = 0; ti < want * 4 && torches.length < want; ti++) {
      var tc = rng.int(0, m.w * m.h - 1);
      var dirs = [];
      for (var d = 0; d < 4; d++) if (m.walls[tc] & (1 << d)) dirs.push(d);
      if (!dirs.length) continue;
      var td = dirs[rng.int(0, dirs.length - 1)];
      var tx = (tc % m.w) + 0.5, ty = ((tc / m.w) | 0) + 0.5;
      var off = 0.36;
      if (td === 0) ty -= off; else if (td === 1) tx += off; else if (td === 2) ty += off; else tx -= off;
      var okT = true;
      for (var tj = 0; tj < torches.length; tj++) {
        var ddx = torches[tj].gx - tx, ddy = torches[tj].gy - ty;
        if (ddx * ddx + ddy * ddy < 2.2) { okT = false; break; }
      }
      if (!okT) continue;
      torches.push({ gx: tx, gy: ty, px: tx * cs, py: ty * cs, phase: rng.range(0, 6.28) });
      /* кронштейн и чаша — статично, пламя рисуется в живом слое */
      ctx.fillStyle = 'rgba(8,12,10,0.55)';
      rr(ctx, tx * cs - 2, ty * cs + cs * 0.06, Math.max(2, cs * 0.05), cs * 0.22, 2); ctx.fill();
      ctx.fillStyle = '#4a4034';
      ctx.beginPath();
      ctx.moveTo(tx * cs - cs * 0.10, ty * cs + cs * 0.30);
      ctx.lineTo(tx * cs + cs * 0.10, ty * cs + cs * 0.30);
      ctx.lineTo(tx * cs + cs * 0.06, ty * cs + cs * 0.18);
      ctx.lineTo(tx * cs - cs * 0.06, ty * cs + cs * 0.18);
      ctx.closePath(); ctx.fill();
    }

    return { canvas: cv, torches: torches, w: W, h: H };
  };

  /* ================== живые элементы ================== */
  A.light = function (ctx, x, y, r, a, col) {
    if (r <= 0 || a <= 0) return;
    var g = ctx.createRadialGradient(x, y, r * 0.04, x, y, r);
    g.addColorStop(0, 'rgba(255,232,178,' + a + ')');
    g.addColorStop(0.45, 'rgba(' + (col || '255,196,120') + ',' + (a * 0.42) + ')');
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  A.flame = function (ctx, x, y, s, t, phase) {
    var f = 0.86 + 0.14 * Math.sin(t * 9 + phase) + 0.06 * Math.sin(t * 23 + phase * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, 0, x, y, s * 4.4 * f);
    g.addColorStop(0, 'rgba(255,224,170,0.62)');
    g.addColorStop(0.28, 'rgba(255,150,60,0.30)');
    g.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, s * 4.4 * f, 0, Math.PI * 2);
    ctx.fill();
    function tongue(w, h, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.quadraticCurveTo(x + w, y - h * 0.30, x + w * 0.30, y + h * 0.24);
      ctx.quadraticCurveTo(x, y + h * 0.44, x - w * 0.30, y + h * 0.24);
      ctx.quadraticCurveTo(x - w, y - h * 0.30, x, y - h);
      ctx.fill();
    }
    tongue(s * 1.10 * f, s * 2.00 * f, 'rgba(255,124,38,0.80)');
    tongue(s * 0.68 * f, s * 1.42 * f, 'rgba(255,186,86,0.92)');
    tongue(s * 0.30 * f, s * 0.78 * f, 'rgba(255,248,214,0.96)');
    ctx.restore();
  };

  A.orb = function (ctx, x, y, r, t, inv) {
    ctx.save();
    ctx.globalAlpha = (inv && Math.sin(t * 26) > 0) ? 0.45 : 1;
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.1);
    g.addColorStop(0, 'rgba(200,250,255,0.95)');
    g.addColorStop(0.30, 'rgba(143,232,255,0.55)');
    g.addColorStop(1, 'rgba(47,159,196,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    var core = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.55, P.glimmer || '#8fe8ff');
    core.addColorStop(1, P.glimmerDark || '#2f9fc4');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    /* искры на орбите */
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) {
      var a = t * 2.1 + i * 2.094;
      ctx.fillStyle = 'rgba(220,250,255,0.85)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 1.7, y + Math.sin(a * 1.3) * r * 1.5, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  A.key = function (ctx, x, y, s, t, taken) {
    if (taken) return;
    var bob = Math.sin(t * 2.4) * s * 0.10;
    y += bob;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, 0, x, y, s * 2.2);
    g.addColorStop(0, 'rgba(255,232,150,0.55)');
    g.addColorStop(1, 'rgba(243,210,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, s * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.25);
    ctx.strokeStyle = P.key || '#f3d264';
    ctx.fillStyle = P.key || '#f3d264';
    ctx.lineWidth = Math.max(1.4, s * 0.20);
    ctx.lineCap = 'round';
    /* головка */
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.34, 0, Math.PI * 2); ctx.stroke();
    /* стержень */
    ctx.beginPath(); ctx.moveTo(0, -s * 0.10); ctx.lineTo(0, s * 0.72); ctx.stroke();
    /* зубцы */
    ctx.beginPath();
    ctx.moveTo(0, s * 0.44); ctx.lineTo(s * 0.34, s * 0.44);
    ctx.moveTo(0, s * 0.68); ctx.lineTo(s * 0.26, s * 0.68);
    ctx.stroke();
    /* блик */
    ctx.strokeStyle = 'rgba(255,248,210,0.75)';
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.beginPath(); ctx.arc(-s * 0.10, -s * 0.52, s * 0.16, 2.4, 3.6); ctx.stroke();
    ctx.restore();
  };

  A.door = function (ctx, x, y, s, t, open, got, total) {
    var w = s * 1.06, h = s * 1.32;
    got = got == null ? 0 : got;
    total = total || 3;
    ctx.save();
    /* свечение */
    ctx.globalCompositeOperation = 'lighter';
    var gR = s * (open ? 3.2 : 2.3);
    var gr = ctx.createRadialGradient(x, y, 0, x, y, gR);
    gr.addColorStop(0, open ? 'rgba(125,249,192,' + (0.52 + 0.12 * Math.sin(t * 3)).toFixed(2) + ')'
      : 'rgba(104,230,180,' + (0.42 + 0.10 * Math.sin(t * 2.2)).toFixed(2) + ')');
    gr.addColorStop(0.45, open ? 'rgba(60,220,160,0.22)' : 'rgba(45,143,107,0.20)');
    gr.addColorStop(1, 'rgba(45,143,107,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, gR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    /* арка */
    function arch(scale) {
      ctx.beginPath();
      ctx.moveTo(x - w * scale / 2, y + h * scale / 2);
      ctx.lineTo(x - w * scale / 2, y - h * scale / 2 + w * scale * 0.46);
      ctx.quadraticCurveTo(x, y - h * scale / 2 - w * scale * 0.34, x + w * scale / 2, y - h * scale / 2 + w * scale * 0.46);
      ctx.lineTo(x + w * scale / 2, y + h * scale / 2);
      ctx.closePath();
    }
    arch(1);
    var inner = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    if (open) { inner.addColorStop(0, '#3ef0b4'); inner.addColorStop(0.55, '#17a97c'); inner.addColorStop(1, '#0b5f47'); }
    else { inner.addColorStop(0, '#2c4a3b'); inner.addColorStop(1, '#12241c'); }
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.14);
    ctx.strokeStyle = open ? (P.exit || '#7df9c0') : '#7fbfa3';
    ctx.stroke();
    arch(0.74);
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeStyle = open ? 'rgba(12,60,44,0.55)' : 'rgba(140,168,148,0.22)';
    ctx.stroke();
    /* створки */
    ctx.strokeStyle = open ? 'rgba(8,50,38,0.45)' : 'rgba(150,176,158,0.28)';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2 + w * 0.34);
    ctx.lineTo(x, y + h / 2);
    ctx.stroke();
    /* три замочные точки — сколько ключей вставлено */
    if (!open) {
      var dr = Math.max(1.6, s * 0.075);
      for (var i = 0; i < total; i++) {
        var dx = x + (i - (total - 1) / 2) * dr * 3.0;
        ctx.beginPath();
        ctx.arc(dx, y + h * 0.30, dr, 0, Math.PI * 2);
        ctx.fillStyle = i < got ? (P.key || '#f3d264') : 'rgba(120,142,130,0.45)';
        ctx.fill();
      }
      /* замочная скважина */
      ctx.fillStyle = 'rgba(8,14,11,0.85)';
      ctx.beginPath();
      ctx.arc(x, y - s * 0.06, s * 0.10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - s * 0.04, y - s * 0.06, s * 0.08, s * 0.22);
    }
    ctx.restore();
  };

  A.guard = function (ctx, x, y, r, t, alert) {
    var pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    ctx.save();
    /* ореол угрозы */
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * (2.6 + (alert || 0)));
    g.addColorStop(0, 'rgba(232,112,90,' + (0.28 + 0.16 * pulse + (alert || 0) * 0.3).toFixed(2) + ')');
    g.addColorStop(1, 'rgba(232,112,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * (2.6 + (alert || 0)), 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    /* каменный панцирь */
    var body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    body.addColorStop(0, '#4a5f53');
    body.addColorStop(0.65, '#2a3a32');
    body.addColorStop(1, '#131d18');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    /* сколы-грани */
    ctx.strokeStyle = 'rgba(150,175,158,0.30)';
    ctx.lineWidth = Math.max(1, r * 0.10);
    for (var i = 0; i < 5; i++) {
      var a = i * 1.257 + t * 0.6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42);
      ctx.lineTo(x + Math.cos(a + 0.22) * r * 0.94, y + Math.sin(a + 0.22) * r * 0.94);
      ctx.stroke();
    }
    /* глаз */
    ctx.globalCompositeOperation = 'lighter';
    var eg = ctx.createRadialGradient(x, y, 0, x, y, r * 0.62);
    eg.addColorStop(0, 'rgba(255,235,200,0.98)');
    eg.addColorStop(0.35, 'rgba(255,150,110,0.9)');
    eg.addColorStop(1, 'rgba(232,112,90,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffe0c4';
    ctx.beginPath(); ctx.arc(x, y, r * 0.20, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  A.coin = function (ctx, x, y, r) {
    ctx.save();
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.6, P.gold || '#f2c14e');
    g.addColorStop(1, '#8a6a18');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = '#6b5210';
    ctx.stroke();
    ctx.fillStyle = '#6b5210';
    ctx.font = '700 ' + Math.round(r * 1.15) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', x, y + r * 0.06);
    ctx.restore();
  };

  /* ---------- атмосфера ---------- */
  A.vignette = function (ctx, w, h, strength) {
    var g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (strength == null ? 0.55 : strength) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  A.fog = function (ctx, w, h, t, seed, alpha) {
    var rng = mkRng((seed >>> 0) || 7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 5; i++) {
      var bx = rng.float() * w, by = rng.float() * h;
      var sp = rng.range(0.4, 1.1), rad = rng.range(0.22, 0.44) * Math.max(w, h);
      var x = bx + Math.sin(t * 0.16 * sp + i) * w * 0.10;
      var y = by + Math.cos(t * 0.11 * sp + i * 1.7) * h * 0.06;
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(159,196,178,' + ((alpha || 0.05) * 0.9).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(159,196,178,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* рамка-бордюр вокруг поля */
  A.frame = function (ctx, x, y, w, h, cs) {
    var pad = Math.max(4, cs * 0.20);
    ctx.save();
    ctx.fillStyle = 'rgba(14,22,18,0.92)';
    rr(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, pad * 1.4);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, pad * 0.30);
    ctx.strokeStyle = 'rgba(122,150,132,0.35)';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(6,10,8,0.6)';
    rr(ctx, x - pad * 0.5, y - pad * 0.5, w + pad, h + pad, pad);
    ctx.stroke();
    ctx.restore();
  };

  /* ================== промо: иконка 512 и обложка 800×470 ================== */
  function miniMaze(w, h, rng) {
    var walls = [], i;
    for (i = 0; i < w * h; i++) walls.push(15);
    var vis = new Uint8Array(w * h), stack = [0];
    var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], OPP = [2, 3, 0, 1], BIT = [1, 2, 4, 8];
    vis[0] = 1;
    while (stack.length) {
      var c = stack[stack.length - 1], x = c % w, y = (c / w) | 0, opts = [];
      if (y > 0 && !vis[c - w]) opts.push(0);
      if (x < w - 1 && !vis[c + 1]) opts.push(1);
      if (y < h - 1 && !vis[c + w]) opts.push(2);
      if (x > 0 && !vis[c - 1]) opts.push(3);
      if (!opts.length) { stack.pop(); continue; }
      var d = opts[rng.int(0, opts.length - 1)];
      var nc = (y + DY[d]) * w + (x + DX[d]);
      walls[c] &= ~BIT[d];
      walls[nc] &= ~BIT[OPP[d]];
      vis[nc] = 1;
      stack.push(nc);
    }
    return { w: w, h: h, walls: walls };
  }

  function drawMazePanel(ctx, m, x, y, cw, ch, t, rng) {
    var th = Math.max(2, cw * 0.11);
    var cols = m.w, rows = m.h, i, j;
    /* пол */
    ctx.fillStyle = '#15231d';
    ctx.fillRect(x, y, cw * cols + th, ch * rows + th);
    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows; j++) {
        if (rng.chance(0.35)) {
          ctx.fillStyle = 'rgba(95,143,74,0.16)';
          ctx.beginPath();
          ctx.ellipse(x + (i + rng.range(0.2, 0.8)) * cw, y + (j + rng.range(0.2, 0.8)) * ch,
            cw * 0.2, ch * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    /* стены */
    var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    ctx.strokeStyle = '#4b6154';
    ctx.lineWidth = th;
    ctx.lineCap = 'square';
    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows; j++) {
        var c = j * cols + i, px = x + i * cw + cw / 2, py = y + j * ch + ch / 2;
        for (var d = 0; d < 4; d++) {
          if (!(m.walls[c] & (1 << d))) continue;
          if (d === 2 && j < rows - 1) continue;      // низ рисует соседняя клетка
          if (d === 1 && i < cols - 1) continue;      // право — соседняя
          ctx.beginPath();
          ctx.moveTo(px + DX[d] * cw * 0.5, py + DY[d] * ch * 0.5);
          ctx.lineTo(px + DX[d] * cw * 0.5 + (d === 0 || d === 2 ? cw : 0),
            py + DY[d] * ch * 0.5 + (d === 1 || d === 3 ? ch : 0));
          ctx.stroke();
        }
      }
    }
    return { cw: cw, ch: ch, ox: x, oy: y };
  }

  A.promo = function (ctx, w, h, kind, rng, title) {
    var icon = kind === 'icon';
    /* promo.html передаёт rng ФУНКЦИЕЙ; приводим к объектному API движка */
    if (typeof rng === 'function') {
      var f0 = rng;
      rng = {
        float: f0,
        range: function (a, b) { return a + (b - a) * f0(); },
        int: function (a, b) { return Math.floor(a + (b - a + 1) * f0()); },
        chance: function (p) { return f0() < p; }
      };
    }
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};

    var bg = ctx.createLinearGradient(0, 0, w * 0.35, h);
    bg.addColorStop(0, '#16241d');
    bg.addColorStop(0.55, '#0e1a15');
    bg.addColorStop(1, '#080d0b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(w * (icon ? 0.5 : 0.34), h * 0.52, 8, w * (icon ? 0.5 : 0.34), h * 0.52, Math.max(w, h) * 0.62);
    glow.addColorStop(0, 'rgba(143,232,255,0.16)');
    glow.addColorStop(1, 'rgba(143,232,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    A.fog(ctx, w, h, 3.1, icon ? 11 : 29, icon ? 0.07 : 0.06);

    if (icon) {
      /* медальон: каменное кольцо лабиринта + светящееся сердце + три ключа */
      var cx = w * 0.5, cy = h * 0.5, R = w * 0.36;
      ctx.save();
      ctx.lineWidth = w * 0.075;
      ctx.strokeStyle = '#3c5146';
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      /* прорези-коридоры в кольце */
      ctx.lineWidth = w * 0.075;
      ctx.strokeStyle = '#0a100d';
      for (var s = 0; s < 6; s++) {
        var a0 = s * 1.047 + 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy, R, a0, a0 + 0.42);
        ctx.stroke();
      }
      ctx.lineWidth = w * 0.020;
      ctx.strokeStyle = 'rgba(160,190,170,0.35)';
      ctx.beginPath(); ctx.arc(cx, cy, R - w * 0.045, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R + w * 0.045, 0, Math.PI * 2); ctx.stroke();
      /* мох на кольце */
      for (s = 0; s < 10; s++) {
        var ma = rng.float() * Math.PI * 2, mr = R + w * 0.045;
        ctx.fillStyle = 'rgba(95,143,74,' + rng.range(0.25, 0.55).toFixed(2) + ')';
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(ma) * mr, cy + Math.sin(ma) * mr, w * 0.022, w * 0.014, ma, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      A.orb(ctx, cx, cy, w * 0.115, 1.7, false);
      /* три ключа вокруг, через 120° */
      for (var k = 0; k < 3; k++) {
        var ka = -Math.PI / 2 + k * 2.0944;
        A.key(ctx, cx + Math.cos(ka) * R * 0.68, cy + Math.sin(ka) * R * 0.68, w * 0.062, 0.5 + k, false);
      }
      A.vignette(ctx, w, h, 0.30);
      return;
    }

    /* обложка: слева лабиринт, справа название */
    var m = miniMaze(7, 7, mkRng((rng.float() * 1e9) >>> 0));
    var panelW = w * 0.44, panelH = h * 0.74;
    var cw = panelW / 7.9, ch = panelH / 7.9;
    var px0 = w * 0.055, py0 = (h - ch * 7) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,13,0.75)';
    rr(ctx, px0 - h * 0.035, py0 - h * 0.035, cw * 7 + h * 0.07, ch * 7 + h * 0.07, h * 0.04);
    ctx.fill();
    ctx.strokeStyle = 'rgba(122,150,132,0.40)';
    ctx.lineWidth = Math.max(2, h * 0.008);
    ctx.stroke();
    drawMazePanel(ctx, m, px0, py0, cw, ch, 1, mkRng(99));
    /* шар и дозорный в коридорах */
    A.light(ctx, px0 + cw * 1.5, py0 + ch * 5.5, cw * 4.2, 0.30);
    A.orb(ctx, px0 + cw * 1.5, py0 + ch * 5.5, cw * 0.34, 2.2, false);
    A.guard(ctx, px0 + cw * 5.5, py0 + ch * 2.2, cw * 0.36, 1.1, 0.2);
    A.key(ctx, px0 + cw * 3.5, py0 + ch * 1.5, cw * 0.30, 1.4, false);
    A.key(ctx, px0 + cw * 6.5, py0 + ch * 5.5, cw * 0.30, 2.6, false);
    ctx.restore();

    /* текст справа */
    var tx = w * 0.56, tW = w * 0.40;
    var t1 = title || dict.title || 'Maze Heart';
    var size = fitFont(ctx, t1, tW, h * 0.16, 800);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = P.cream || '#e9f2ea';
    ctx.fillText(t1, tx, h * 0.33);
    ctx.strokeStyle = P.key || '#f3d264';
    ctx.lineWidth = Math.max(2, h * 0.010);
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.33 + size * 0.72);
    ctx.lineTo(tx + Math.min(tW, ctx.measureText(t1).width), h * 0.33 + size * 0.72);
    ctx.stroke();

    var tag = dict['cover_tag'] || '';
    fitFont(ctx, tag, tW, h * 0.070, 600);
    ctx.fillStyle = P.key || '#f3d264';
    ctx.fillText(tag, tx, h * 0.51);

    var sub = dict['subtitle'] || '';
    fitFont(ctx, sub, tW, h * 0.052, 500);
    ctx.fillStyle = 'rgba(233,242,234,0.72)';
    ctx.fillText(sub, tx, h * 0.60);

    /* три ключа в ряд — обещание уровня */
    for (var i = 0; i < 3; i++) {
      A.key(ctx, tx + h * 0.045 + i * h * 0.085, h * 0.73, h * 0.048, 0.6 + i, false);
    }
    A.vignette(ctx, w, h, 0.24);
  };

  G.art = A;
})(window.GAME);
