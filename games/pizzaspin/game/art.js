/* game/art.js — процедурная графика «Пиццы-Поворота».
   Пицца (корка, сыр, линии кусков, подсветка цели), топпинги 4 видов,
   пятно промаха, поварёнок-маскот, промо (icon/cover).
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

  /* ---------- топпинги ---------- */
  function drawTopping(ctx, type, x, y, r, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    if (type === 'pepperoni') {
      ctx.fillStyle = P.pepperoni;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,20,20,0.5)';
      ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, r * 0.25, r * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.78, -2.4, -1.2); ctx.stroke();
    } else if (type === 'mushroom') {
      ctx.fillStyle = P.mushroom;
      ctx.beginPath(); ctx.arc(0, -r * 0.15, r, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r * 0.32, -r * 0.15, r * 0.64, r * 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.5, r * 0.16, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'olive') {
      ctx.fillStyle = P.olive;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.bg;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, -2.6, -1.4); ctx.stroke();
    } else { // pepper — колечко
      ctx.strokeStyle = P.pepper; ctx.lineWidth = r * 0.34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.62 + Math.sin(t * 3) * r * 0.04, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.62, -2.5, -1.5); ctx.stroke();
    }
    ctx.restore();
  }
  ART.drawTopping = drawTopping;

  /* ---------- золотой топпинг (редкий, ×5 очков) ---------- */
  ART.drawGoldTopping = function (ctx, x, y, r, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y);
    // лучи-ореол
    ctx.save();
    ctx.rotate(t * 1.5);
    ctx.fillStyle = 'rgba(255,212,59,0.35)';
    for (var i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(r * 1.15, -r * 0.14); ctx.lineTo(r * 1.7, 0); ctx.lineTo(r * 1.15, r * 0.14);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // звезда-топпинг
    ctx.fillStyle = P.gold;
    ctx.strokeStyle = '#e8a013'; ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.beginPath();
    for (var s = 0; s < 10; s++) {
      var a = -Math.PI / 2 + s * Math.PI / 5;
      var rr = (s % 2 === 0) ? r : r * 0.46;
      if (s === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.24, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- пицца ----------
     span — ширина золотой зоны в кусках (1 по умолчанию, 2 с «Широким куском»). */
  ART.drawPizza = function (ctx, cx, cy, R, rot, slices, targetIdx, t, span) {
    var P = pal();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, R * 0.09, R * 1.04, R * 1.04, 0, 0, Math.PI * 2); ctx.fill();
    // подсветка целевой зоны (кусок i занимает локальные углы [i*step, (i+1)*step))
    if (targetIdx >= 0) {
      var sp = span || 1;
      var a0 = (targetIdx / slices) * Math.PI * 2;
      var a1 = ((targetIdx + sp) / slices) * Math.PI * 2;
      ctx.fillStyle = 'rgba(255,148,54,0.3)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 1.07, a0, a1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.target; ctx.lineWidth = 3 + Math.sin(t * 6) * 1.2;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.05, a0, a1); ctx.stroke();
    }
    // корка
    ctx.fillStyle = P.crust;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.crustDark; ctx.lineWidth = R * 0.03;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2); ctx.stroke();
    // сыр
    ctx.fillStyle = P.cheese;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.86, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.cheeseDark;
    for (var i = 0; i < 7; i++) {
      var ba = i * 2.39996, br = R * (0.2 + (i % 3) * 0.2);
      ctx.beginPath(); ctx.arc(Math.cos(ba) * br, Math.sin(ba) * br, R * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    // линии кусков
    ctx.strokeStyle = 'rgba(160,90,30,0.5)'; ctx.lineWidth = Math.max(2, R * 0.016);
    for (var s = 0; s < slices; s++) {
      var a = (s / slices) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14);
      ctx.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
      ctx.stroke();
    }
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(-R * 0.3, -R * 0.35, R * 0.42, R * 0.2, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- пятно промаха ---------- */
  ART.drawStain = function (ctx, x, y, r) {
    var P = pal();
    ctx.save();
    ctx.fillStyle = 'rgba(90,50,20,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.stain;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.6, r * 0.34, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- поварёнок-маскот ---------- */
  ART.drawChef = function (ctx, x, y, s, t) {
    var P = pal();
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2.4) * s * 0.04);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, s * 0.25, s * 0.52, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.panelEdge; ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(0, s * 0.25, s * 0.52, s * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    // колпак
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.38, s * 0.34, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-s * 0.34, -s * 0.42, s * 0.68, s * 0.24);
    ctx.strokeStyle = P.panelEdge;
    ctx.strokeRect(-s * 0.34, -s * 0.32, s * 0.68, s * 0.14);
    // глаза
    var blink = (t % 3.7) < 0.12 ? 0.15 : 1;
    ctx.fillStyle = P.text;
    ctx.beginPath(); ctx.ellipse(-s * 0.17, s * 0.12, s * 0.055, s * 0.055 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.17, s * 0.12, s * 0.055, s * 0.055 * blink, 0, 0, Math.PI * 2); ctx.fill();
    // румянец + улыбка
    ctx.fillStyle = 'rgba(255,140,150,0.5)';
    ctx.beginPath(); ctx.arc(-s * 0.3, s * 0.26, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.3, s * 0.26, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.text; ctx.lineWidth = s * 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, s * 0.2, s * 0.14, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.restore();
  };

  /* ---------- промо ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg); g.addColorStop(1, P.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // скатерть-горошек
    ctx.fillStyle = 'rgba(232,180,138,0.35)';
    var step = Math.max(48, w / 12);
    for (var py = step * 0.5; py < h; py += step) {
      for (var px = step * 0.5; px < w; px += step) {
        ctx.beginPath(); ctx.arc(px, py, step * 0.12, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (kind === 'icon') {
      var R = w * 0.36;
      ART.drawPizza(ctx, w / 2, h / 2, R, -0.35, G.config.slices, 1, 2.0);
      drawTopping(ctx, 'pepperoni', w * 0.3, h * 0.3, w * 0.05, 0);
      drawTopping(ctx, 'olive', w * 0.68, h * 0.62, w * 0.05, 0);
      drawTopping(ctx, 'mushroom', w * 0.62, h * 0.28, w * 0.05, 0);
      drawTopping(ctx, 'pepper', w * 0.36, h * 0.66, w * 0.05, 0);
      ctx.fillStyle = P.gold;
      for (var i = 0; i < 8; i++) {
        var a = rng() * Math.PI * 2, rr = w * (0.42 + rng() * 0.08);
        ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr, w * 0.008, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      var R2 = h * 0.36;
      ART.drawPizza(ctx, h * 0.42, h * 0.52, R2, -0.3, G.config.slices, 2, 1.6);
      drawTopping(ctx, 'pepperoni', h * 0.3, h * 0.34, h * 0.055, 0);
      drawTopping(ctx, 'olive', h * 0.56, h * 0.68, h * 0.055, 0);
      ART.drawGoldTopping(ctx, h * 0.44, h * 0.24, h * 0.05, 1.6);
      ART.drawChef(ctx, w * 0.56, h * 0.66, h * 0.16, 1.2);
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 58;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.42) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(90,50,20,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.52, h * 0.34);
        var tg = ctx.createLinearGradient(0, h * 0.34 - size / 2, 0, h * 0.34 + size / 2);
        tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, P.gold);
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.52, h * 0.34);
      }
    }
  };
})(window.GAME);
