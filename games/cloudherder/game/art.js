/* game/art.js — процедурная графика «Гончего Дождя».
   Облачко (пушистое, с мордочкой), капелька, градина, солнышко,
   дальние облака, радуга, промо (icon/cover).
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

  /* ---------- облачко-герой ---------- */
  ART.drawCloud = function (ctx, x, y, s, t, happy) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2.2) * s * 0.03);
    // тень
    ctx.fillStyle = 'rgba(60,90,120,0.14)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.42, s * 0.8, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    // пушистое тело из кружков
    var puffs = [[-0.5, 0.05, 0.34], [-0.2, -0.12, 0.4], [0.12, -0.16, 0.44], [0.44, 0.02, 0.34], [0, 0.12, 0.5]];
    ctx.fillStyle = P.cloud;
    for (var i = 0; i < puffs.length; i++) {
      var p = puffs[i];
      ctx.beginPath(); ctx.arc(p[0] * s, p[1] * s, p[2] * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = P.cloudShade; ctx.lineWidth = s * 0.03;
    for (var j = 0; j < puffs.length; j++) {
      var q = puffs[j];
      ctx.beginPath(); ctx.arc(q[0] * s, q[1] * s, q[2] * s, 0, Math.PI * 2); ctx.stroke();
    }
    // мордочка
    var blink = (t % 3.4) < 0.12 ? 0.15 : 1;
    ctx.fillStyle = P.text;
    ctx.beginPath(); ctx.ellipse(-s * 0.14, 0, s * 0.045, s * 0.05 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.14, 0, s * 0.045, s * 0.05 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.text; ctx.lineWidth = s * 0.028; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, s * 0.04, s * 0.11, happy ? 0.15 : 0.4, happy ? Math.PI - 0.15 : Math.PI - 0.4); ctx.stroke();
    // румянец
    ctx.fillStyle = 'rgba(255,150,170,0.4)';
    ctx.beginPath(); ctx.arc(-s * 0.3, s * 0.1, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.3, s * 0.1, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- капелька ---------- */
  ART.drawDrop = function (ctx, x, y, r, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = P.drop;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.1, r * 0.62, r * 0.5);
    ctx.quadraticCurveTo(r * 0.3, r * 1.05, 0, r * 1.05);
    ctx.quadraticCurveTo(-r * 0.3, r * 1.05, -r * 0.62, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.1, 0, -r * 1.3);
    ctx.fill();
    ctx.strokeStyle = P.dropDark; ctx.lineWidth = r * 0.1;
    ctx.stroke();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.1, r * 0.16, r * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- радужная капля (редкая, ×3) ---------- */
  ART.drawRainbowDrop = function (ctx, x, y, r, t) {
    var P = pal();
    var R = P.rainbow;
    ctx.save();
    ctx.translate(x, y);
    // мерцающее радужное сияние
    var pulse = 0.8 + 0.2 * Math.sin(t * 6);
    ctx.globalAlpha = 0.35 * pulse;
    for (var i = 0; i < R.length; i++) {
      ctx.strokeStyle = R[i]; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, r * (1.2 + i * 0.14), Math.PI * 0.75, Math.PI * 1.45); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.rainbowDrop;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.1, r * 0.62, r * 0.5);
    ctx.quadraticCurveTo(r * 0.3, r * 1.05, 0, r * 1.05);
    ctx.quadraticCurveTo(-r * 0.3, r * 1.05, -r * 0.62, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.1, 0, -r * 1.3);
    ctx.fill();
    ctx.strokeStyle = '#c2255c'; ctx.lineWidth = r * 0.1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.1, r * 0.16, r * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- градина ---------- */
  ART.drawHail = function (ctx, x, y, r, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 1.6);
    ctx.fillStyle = P.hail;
    // гранёный ледяной шарик
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      var rr = r * (0.85 + (i % 2) * 0.2);
      var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.hailDark; ctx.lineWidth = r * 0.09; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- солнышко ---------- */
  ART.drawSun = function (ctx, x, y, r, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    var g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.2);
    g.addColorStop(0, 'rgba(255,220,120,0.7)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.gold; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
    for (var i = 0; i < 10; i++) {
      var a = (i / 10) * Math.PI * 2 + t * 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1);
      ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
      ctx.stroke();
    }
    ctx.fillStyle = P.gold;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3bf';
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- дальнее облако ---------- */
  ART.drawFarCloud = function (ctx, x, y, s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - s * 0.4, y, s * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.42, y, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- промо ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg); g.addColorStop(1, P.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ART.drawSun(ctx, w * 0.85, h * 0.16, Math.min(w, h) * 0.08, 0);
    // дальние облака
    for (var i = 0; i < 4; i++) {
      ART.drawFarCloud(ctx, (0.12 + i * 0.25) * w, (0.3 + (i % 2) * 0.12) * h, Math.min(w, h) * 0.12, 0.35);
    }
    // дождь слева
    ctx.strokeStyle = 'rgba(77,171,247,0.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var d = 0; d < 24; d++) {
      var dx = rng() * w, dy = rng() * h;
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx - 3, dy + 12); ctx.stroke();
    }
    if (kind === 'icon') {
      ART.drawCloud(ctx, w / 2, h * 0.46, w * 0.34, 1.2, true);
      ART.drawDrop(ctx, w * 0.26, h * 0.72, w * 0.05, 0);
      ART.drawDrop(ctx, w * 0.7, h * 0.78, w * 0.042, 0);
      ART.drawHail(ctx, w * 0.74, h * 0.2, w * 0.05, 0.5);
      ART.drawDrop(ctx, w * 0.34, h * 0.16, w * 0.04, 0);
    } else {
      ART.drawCloud(ctx, w * 0.28, h * 0.5, w * 0.24, 1.4, true);
      ART.drawDrop(ctx, w * 0.14, h * 0.3, w * 0.04, 0);
      ART.drawDrop(ctx, w * 0.44, h * 0.24, w * 0.034, 0);
      ART.drawHail(ctx, w * 0.46, h * 0.74, w * 0.04, 0.3);
      // радуга
      var R = P.rainbow;
      ctx.globalAlpha = 0.5;
      for (var b = 0; b < R.length; b++) {
        ctx.strokeStyle = R[b]; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(w * 0.62, h * 0.95, h * (0.34 + b * 0.025), Math.PI, Math.PI * 1.8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 58;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.42) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(20,50,80,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.5, h * 0.34);
        var tg = ctx.createLinearGradient(0, h * 0.34 - size / 2, 0, h * 0.34 + size / 2);
        tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#bfe8ff');
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.5, h * 0.34);
      }
    }
  };
})(window.GAME);
