/* game/art.js — процедурная графика «Лампового Сада».
   Светлячок (тельце, крылья, вспышка-свечение), гусеница-угроза, луна,
   трава, маскот-совёнок, промо (icon/cover).
   Standalone для promo.html: локальный mulberry32 + window.Engine fallback. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ensureEngine() {
    if (!window.Engine) window.Engine = {};
    var E = window.Engine;
    if (!E.rng) E.rng = { mulberry32: mulberry32 };
    return E;
  }

  var ART = G.art = {};
  ART.init = function () { ensureEngine(); };

  function pal() { return G.config.palette; }

  /* ---------- светлячок ---------- */
  // lit: 0..1 — сила свечения; t — время (взмахи крыльев)
  ART.drawBug = function (ctx, x, y, s, t, lit) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    // свечение позади
    if (lit > 0.02) {
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.6);
      g.addColorStop(0, 'rgba(255,248,190,' + (0.55 * lit) + ')');
      g.addColorStop(0.4, 'rgba(255,232,115,' + (0.28 * lit) + ')');
      g.addColorStop(1, 'rgba(255,232,115,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s * 2.6, 0, Math.PI * 2); ctx.fill();
    }
    // крылья
    var flap = Math.sin(t * 22) * 0.35;
    ctx.fillStyle = 'rgba(207,232,255,' + (0.5 + 0.3 * lit) + ')';
    ctx.save(); ctx.rotate(-0.5 - flap);
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.34, s * 0.16, s * 0.4, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(0.5 + flap);
    ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 0.34, s * 0.16, s * 0.4, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // тельце
    ctx.fillStyle = P.bug;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    // брюшко-фонарик
    ctx.fillStyle = lit > 0.02 ? P.glowHot : '#5c4a26';
    ctx.beginPath(); ctx.ellipse(0, s * 0.22, s * 0.18, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    // голова и глазки
    ctx.fillStyle = '#3a2d18';
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-s * 0.05, -s * 0.45, s * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.05, -s * 0.45, s * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- лунный мотылёк ---------- */
  // Редкий бонус: лиловые крылья, мягкое постоянное сияние, пылинки вокруг.
  ART.drawMoth = function (ctx, x, y, s, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    // сияние позади (не гаснет, пульсирует)
    var pulse = 0.75 + 0.25 * Math.sin(t * 3.2);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 3.0);
    g.addColorStop(0, 'rgba(229,219,255,' + (0.5 * pulse) + ')');
    g.addColorStop(0.45, 'rgba(177,151,252,' + (0.22 * pulse) + ')');
    g.addColorStop(1, 'rgba(177,151,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, s * 3.0, 0, Math.PI * 2); ctx.fill();
    // пылинки-орбиты
    ctx.fillStyle = 'rgba(229,219,255,0.9)';
    for (var i = 0; i < 3; i++) {
      var a = t * 1.7 + i * (Math.PI * 2 / 3);
      var rr = s * (0.9 + 0.25 * Math.sin(t * 2.1 + i));
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.7, s * 0.07, 0, Math.PI * 2); ctx.fill();
    }
    // крылья (большие, лиловые)
    var flap = Math.sin(t * 16) * 0.3;
    ctx.fillStyle = 'rgba(177,151,252,0.85)';
    ctx.save(); ctx.rotate(-0.55 - flap);
    ctx.beginPath(); ctx.ellipse(-s * 0.3, -s * 0.28, s * 0.3, s * 0.52, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(0.55 + flap);
    ctx.beginPath(); ctx.ellipse(s * 0.3, -s * 0.28, s * 0.3, s * 0.52, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // кружочки на крыльях
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(-s * 0.34, -s * 0.34, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.34, -s * 0.34, s * 0.07, 0, Math.PI * 2); ctx.fill();
    // тельце и голова
    ctx.fillStyle = '#5b4a86';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.26, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3c2f5c';
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.15, 0, Math.PI * 2); ctx.fill();
    // усики
    ctx.strokeStyle = P.mothGlow; ctx.lineWidth = s * 0.04; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.04, -s * 0.5); ctx.quadraticCurveTo(-s * 0.18, -s * 0.72, -s * 0.3, -s * 0.7);
    ctx.moveTo(s * 0.04, -s * 0.5); ctx.quadraticCurveTo(s * 0.18, -s * 0.72, s * 0.3, -s * 0.7);
    ctx.stroke();
    ctx.restore();
  };

  /* ---------- гусеница ---------- */
  ART.drawCaterpillar = function (ctx, x, y, s, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    for (var i = 0; i < 4; i++) {
      var ox = (i - 1.5) * s * 0.42;
      var oy = Math.sin(t * 6 + i * 1.1) * s * 0.06;
      ctx.fillStyle = i % 2 ? P.caterpillar : P.caterpillarDark;
      ctx.beginPath(); ctx.arc(ox, oy, s * 0.26, 0, Math.PI * 2); ctx.fill();
    }
    // головка с глазами и рожками
    ctx.fillStyle = P.caterpillar;
    ctx.beginPath(); ctx.arc(1.9 * s * 0.42, -s * 0.12, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.caterpillarDark; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1.9 * s * 0.42 - s * 0.08, -s * 0.36); ctx.lineTo(1.9 * s * 0.42 - s * 0.16, -s * 0.55);
    ctx.moveTo(1.9 * s * 0.42 + s * 0.08, -s * 0.36); ctx.lineTo(1.9 * s * 0.42 + s * 0.16, -s * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath(); ctx.arc(1.9 * s * 0.42 + s * 0.08, -s * 0.18, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- луна ---------- */
  ART.drawMoon = function (ctx, x, y, r, t) {
    var P = pal();
    var g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    g.addColorStop(0, 'rgba(255,243,191,0.5)');
    g.addColorStop(1, 'rgba(255,243,191,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.moon;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(210,190,140,0.5)';
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.15, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.2, y + r * 0.25, r * 0.12, 0, Math.PI * 2); ctx.fill();
  };

  /* ---------- совёнок-маскот ---------- */
  ART.drawOwl = function (ctx, x, y, s, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.8) * s * 0.03);
    // тело
    ctx.fillStyle = '#8a6d4a';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.44, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // ушки
    ctx.fillStyle = '#6d543a';
    ctx.beginPath(); ctx.moveTo(-s * 0.34, -s * 0.34); ctx.lineTo(-s * 0.18, -s * 0.62); ctx.lineTo(-s * 0.06, -s * 0.4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.34, -s * 0.34); ctx.lineTo(s * 0.18, -s * 0.62); ctx.lineTo(s * 0.06, -s * 0.4); ctx.closePath(); ctx.fill();
    // глаза (моргают)
    var blink = (t % 4.3) < 0.12 ? 0.12 : 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-s * 0.16, -s * 0.14, s * 0.13, s * 0.13 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.16, -s * 0.14, s * 0.13, s * 0.13 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.text === '#eef1ff' ? '#1c1428' : P.text;
    ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.13, s * 0.055, s * 0.055 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.17, -s * 0.13, s * 0.055, s * 0.055 * blink, 0, 0, Math.PI * 2); ctx.fill();
    // клюв и пузико
    ctx.fillStyle = '#ffb93e';
    ctx.beginPath(); ctx.moveTo(0, s * 0.0); ctx.lineTo(-s * 0.06, s * 0.1); ctx.lineTo(s * 0.06, s * 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.5)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.22, s * 0.26, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- промо ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg); g.addColorStop(1, P.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // звёзды
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (var i = 0; i < 40; i++) {
      var sx = rng() * w, sy = rng() * h * 0.6, sr = rng() * 1.6 + 0.4;
      ctx.globalAlpha = 0.25 + rng() * 0.6;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ART.drawMoon(ctx, w * 0.82, h * 0.2, Math.min(w, h) * 0.075, 0);
    // поляна
    ctx.fillStyle = P.grass;
    ctx.beginPath(); ctx.ellipse(w / 2, h * 1.05, w * 0.75, h * 0.3, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = P.grassHi;
    ctx.beginPath(); ctx.ellipse(w / 2, h * 1.02, w * 0.75, h * 0.26, 0, Math.PI, 0); ctx.fill();
    if (kind === 'icon') {
      ART.drawBug(ctx, w * 0.5, h * 0.48, w * 0.16, 1.0, 1);
      ART.drawBug(ctx, w * 0.24, h * 0.66, w * 0.09, 1.4, 0.8);
      ART.drawBug(ctx, w * 0.76, h * 0.62, w * 0.08, 0.6, 0.65);
      ART.drawBug(ctx, w * 0.7, h * 0.32, w * 0.07, 2.0, 0.5);
      ART.drawCaterpillar(ctx, w * 0.28, h * 0.85, w * 0.09, 0.8);
    } else {
      ART.drawBug(ctx, w * 0.24, h * 0.5, w * 0.11, 1.2, 1);
      ART.drawBug(ctx, w * 0.42, h * 0.34, w * 0.06, 0.4, 0.7);
      ART.drawBug(ctx, w * 0.12, h * 0.3, w * 0.05, 1.9, 0.55);
      ART.drawMoth(ctx, w * 0.13, h * 0.62, w * 0.055, 1.5);
      ART.drawCaterpillar(ctx, w * 0.42, h * 0.78, w * 0.07, 0.5);
      ART.drawOwl(ctx, w * 0.62, h * 0.66, w * 0.12, 0.9);
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 58;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.42) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(10,14,30,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.5, h * 0.3);
        var tg = ctx.createLinearGradient(0, h * 0.3 - size / 2, 0, h * 0.3 + size / 2);
        tg.addColorStop(0, '#fffbe0'); tg.addColorStop(1, P.gold);
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.5, h * 0.3);
      }
    }
  };
})(window.GAME);
