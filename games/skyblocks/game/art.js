/* game/art.js — процедурная арт-фабрика «Скайблоков»: плавучие острова и облака.
   Ноль внешних ассетов. Слои острова: тень → скала (blob-конус) → травяная шапка
   → проп (роща/башня/мельница/пики/дирижабль/дворец) → глосс. Облако: blob-пух с
   бликом. ART.promo(ctx,w,h,kind,rng,title) — иконка/обложка из тех же примитивов.
   Standalone: ART.init имеет fallback window.Engine + локальный mulberry32. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var ART = { ready: false };

  /* fallback для standalone (promo.html грузит art.js без engine/rng.js) */
  function ensureEngine() {
    if (window.Engine && window.Engine.Rng) return;
    window.Engine = window.Engine || {};
    function mulberry32(seed) {
      var a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function Rng(seed) { this.seed = (typeof seed === 'string' ? seedFromString(seed) : seed) >>> 0; this._next = mulberry32(this.seed); }
    function seedFromString(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    Rng.prototype.float = function () { return this._next(); };
    Rng.prototype.range = function (a, b) { return a + (b - a) * this._next(); };
    Rng.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
    Rng.prototype.pick = function (arr) { return arr[Math.floor(this._next() * arr.length) % arr.length]; };
    Rng.prototype.chance = function (p) { return this._next() < p; };
    Rng.prototype.angle = function () { return this._next() * Math.PI * 2; };
    window.Engine.Rng = Rng;
  }
  ART.init = function () { ensureEngine(); ART.ready = true; };

  /* ---------- остров: каменный клин + верх из травы + проп по тиру ---------- */
  function drawRock(ctx, cx, cy, r, hue1, hue2, seed) {
    var rng = new (window.Engine.Rng)(seed);
    // тень под островом
    ctx.save();
    ctx.globalAlpha = 0.30; ctx.fillStyle = '#0a0e20';
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.95, r * 0.75, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // скала: конус с неровным низом
    var g = ctx.createLinearGradient(cx, cy - r * 0.2, cx, cy + r);
    g.addColorStop(0, hue1); g.addColorStop(1, hue2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.92, cy);
    var steps = 14;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var x = cx - r * 0.92 + t * r * 1.84;
      var tipY = cy + r * 0.98 - Math.abs(t - 0.5) * r * 0.7 + Math.sin(t * 9 + seed) * r * 0.04;
      ctx.lineTo(x, tipY);
    }
    ctx.closePath();
    ctx.fill();
    // тёмный аутлайн нижней кромки
    ctx.strokeStyle = 'rgba(20,12,40,0.55)'; ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.stroke();
    // верхняя шапка травы — выпуклый эллипс
    var gg = ctx.createLinearGradient(cx, cy - r * 0.34, cx, cy + r * 0.05);
    gg.addColorStop(0, '#63e691'); gg.addColorStop(1, '#2f9e44');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.14, r * 0.94, r * 0.30, 0, 0, Math.PI * 2); ctx.fill();
    // блик на траве
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.28, r * 0.28, r * 0.07, -0.4, 0, Math.PI * 2); ctx.fill();
  }

  function drawProp(ctx, prop, cx, cy, r, t) {
    var sway = Math.sin(t * 1.6) * 0.03;
    ctx.save();
    ctx.translate(cx, cy - r * 0.28);
    ctx.rotate(sway);
    if (prop === 'sprout') { // Роща: 3 дерева
      for (var i = -1; i <= 1; i++) {
        var dx = i * r * 0.34, s = r * (i === 0 ? 0.34 : 0.24);
        ctx.fillStyle = '#8b5e3c';
        ctx.fillRect(dx - s * 0.07, -s * 0.5, s * 0.14, s * 0.62);
        ctx.fillStyle = i === 0 ? '#37b24d' : '#51cf66';
        ctx.beginPath(); ctx.arc(dx, -s * 0.62, s * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(dx - s * 0.16, -s * 0.78, s * 0.14, 0, Math.PI * 2); ctx.fill();
      }
    } else if (prop === 'tower') { // Башня: каменная, с окном и флажком
      ctx.fillStyle = '#adb5bd';
      ctx.fillRect(-r * 0.16, -r * 0.9, r * 0.32, r * 0.9);
      ctx.fillStyle = '#868e96';
      ctx.fillRect(-r * 0.16, -r * 0.9, r * 0.32, r * 0.12);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5b3a8e'; ctx.lineWidth = Math.max(1.5, r * 0.03);
      ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, -r * 1.12); ctx.stroke();
      ctx.fillStyle = '#fc5c7d';
      ctx.beginPath(); ctx.moveTo(0, -r * 1.12); ctx.lineTo(r * 0.2, -r * 1.04); ctx.lineTo(0, -r * 0.96); ctx.closePath(); ctx.fill();
    } else if (prop === 'mill') { // Мельница: корпус + крутящиеся лопасти
      ctx.fillStyle = '#e9d8b4';
      ctx.fillRect(-r * 0.2, -r * 0.7, r * 0.4, r * 0.7);
      ctx.fillStyle = '#c47300';
      ctx.beginPath(); ctx.moveTo(-r * 0.24, -r * 0.7); ctx.lineTo(0, -r * 0.98); ctx.lineTo(r * 0.24, -r * 0.7); ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.translate(0, -r * 0.62);
      ctx.rotate(t * 2.2);
      ctx.fillStyle = '#fff6e8';
      for (var b = 0; b < 4; b++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.5, -r * 0.07); ctx.lineTo(r * 0.5, r * 0.07); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    } else if (prop === 'crystal') { // Пики: 3 кристалла, пульс
      var pulse = 1 + Math.sin(t * 3) * 0.05;
      var cols = ['#7df9ff', '#b197fc', '#ff8fa3'];
      for (var k = -1; k <= 1; k++) {
        var s2 = r * (0.34 + (k === 0 ? 0.14 : 0)) * pulse;
        var x = k * r * 0.3;
        ctx.fillStyle = cols[k + 1];
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x, -s2 * 1.5); ctx.lineTo(x + s2 * 0.5, -s2 * 0.2);
        ctx.lineTo(x, 0); ctx.lineTo(x - s2 * 0.5, -s2 * 0.2);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else if (prop === 'ship') { // Дирижабль над островом
      var bob = Math.sin(t * 1.8) * r * 0.06;
      ctx.save();
      ctx.translate(0, -r * 1.05 + bob);
      var bg = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
      bg.addColorStop(0, '#ffe3a3'); bg.addColorStop(1, '#ffa94d');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b5e3c';
      ctx.beginPath(); ctx.ellipse(0, r * 0.22, r * 0.3, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(-r * 0.18, -r * 0.1, r * 0.16, r * 0.06, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (prop === 'crown') { // Дворец: пьедестал + корона с самоцветами
      ctx.fillStyle = '#e9d8b4';
      ctx.fillRect(-r * 0.3, -r * 0.5, r * 0.6, r * 0.5);
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      var w = r * 0.62, h = r * 0.3, top = -r * 0.78;
      ctx.moveTo(-w / 2, -r * 0.5);
      ctx.lineTo(-w / 2, top); ctx.lineTo(-w * 0.28, top + h * 0.5); ctx.lineTo(0, top - h * 0.3);
      ctx.lineTo(w * 0.28, top + h * 0.5); ctx.lineTo(w / 2, top); ctx.lineTo(w / 2, -r * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c47300'; ctx.lineWidth = Math.max(1.5, r * 0.03); ctx.stroke();
      ctx.fillStyle = '#fc5c7d';
      ctx.beginPath(); ctx.arc(-w * 0.28, top + h * 0.45, r * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5f7cff';
      ctx.beginPath(); ctx.arc(0, top + h * 0.1, r * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#51cf66';
      ctx.beginPath(); ctx.arc(w * 0.28, top + h * 0.45, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* Публичное API: рисовать остров тира i в точке (x,y) с радиусом r. */
  ART.drawIsland = function (ctx, tier, x, y, r, t, phase, unlocked) {
    if (!ART.ready) ART.init();
    var seed = tier * 977 + 13;
    if (unlocked === false) {
      // закрытый остров: приглушённый силуэт
      ctx.save();
      ctx.globalAlpha = 0.35;
      drawRock(ctx, x, y, r, '#4a5170', '#232a4a', seed);
      ctx.restore();
      return;
    }
    drawRock(ctx, x, y, r, '#a97c50', '#6b4426', seed);
    var conf = G.config.islands[tier];
    if (conf) drawProp(ctx, conf.prop, x, y, r, t + (phase || 0));
    // мерцание новых целей
    if (phase != null) {
      ctx.save();
      ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t * 2.4 + phase);
      ctx.fillStyle = '#fff6e8';
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.4, r * 0.6, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  /* Облако-тапалка: пухлый blob с бликом и мордочкой. golden=1 — золотое (×8). */
  ART.drawCloud = function (ctx, x, y, r, t, phase, golden) {
    var bob = Math.sin(t * 1.4 + (phase || 0)) * r * 0.08;
    var cx = x, cy = y + bob;
    ctx.save();
    // тело: 3 слипшихся круга
    var g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    if (golden) { g.addColorStop(0, '#fff3bf'); g.addColorStop(1, '#ffd43b'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8e4ff'); }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx - r * 0.5, cy + r * 0.1, r * 0.52, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.5, cy + r * 0.1, r * 0.52, 0, Math.PI * 2);
    ctx.arc(cx, cy - r * 0.3, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    if (golden) { // золотой ореол
      ctx.globalAlpha = 0.30 + 0.15 * Math.sin(t * 5 + (phase || 0));
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = Math.max(2, r * 0.09);
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.28, cy - r * 0.5, r * 0.3, r * 0.13, -0.4, 0, Math.PI * 2); ctx.fill();
    // мордочка
    ctx.fillStyle = golden ? '#7a4b00' : '#3a2c4f';
    ctx.beginPath(); ctx.arc(cx - r * 0.22, cy - r * 0.1, r * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.22, cy - r * 0.1, r * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = golden ? '#7a4b00' : '#3a2c4f'; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.06, r * 0.16, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.restore();
  };

  /* Промо-хук: иконка и обложка из тех же примитивов. */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    if (kind === 'icon') {
      var bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1a2c5e'); bg.addColorStop(1, '#101a3a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // звёзды (rng — голая mulberry32-функция из promo.html)
      for (var i = 0; i < 40; i++) {
        ctx.globalAlpha = 0.25 + rng() * 0.5;
        ctx.fillStyle = '#cfe8ff';
        var s = 1 + rng() * 2;
        ctx.fillRect(rng() * w, rng() * h, s, s);
      }
      ctx.globalAlpha = 1;
      // центральный остров с короной
      ART.drawIsland(ctx, 5, w / 2, h / 2 + 20, 120, 1.2, 0, true);
      // малые острова по краям
      ART.drawIsland(ctx, 0, w * 0.2, h * 0.72, 46, 0.8, 1, true);
      ART.drawIsland(ctx, 1, w * 0.8, h * 0.7, 52, 0.9, 2, true);
      ART.drawCloud(ctx, w * 0.24, h * 0.3, 34, 1.1, 0);
      ART.drawCloud(ctx, w * 0.78, h * 0.26, 28, 1.3, 2);
    } else {
      var bg2 = ctx.createLinearGradient(0, 0, w, h);
      bg2.addColorStop(0, '#1a2c5e'); bg2.addColorStop(1, '#101a3a');
      ctx.fillStyle = bg2; ctx.fillRect(0, 0, w, h);
      for (var j = 0; j < 60; j++) {
        ctx.globalAlpha = 0.2 + rng() * 0.5;
        ctx.fillStyle = '#cfe8ff';
        var s2 = 1 + rng() * 2;
        ctx.fillRect(rng() * w, rng() * h, s2, s2);
      }
      ctx.globalAlpha = 1;
      // линейка островов слева направо с ростом тира
      var xs = [0.12, 0.3, 0.5, 0.68, 0.84];
      var tiers = [0, 1, 2, 3, 4];
      var rs = [46, 54, 62, 70, 80];
      for (var k = 0; k < xs.length; k++) {
        ART.drawIsland(ctx, tiers[k], w * xs[k], h * 0.56, rs[k], 1 + k * 0.2, k, true);
      }
      ART.drawCloud(ctx, w * 0.2, h * 0.3, 30, 1.2, 1);
      ART.drawCloud(ctx, w * 0.6, h * 0.24, 26, 1.0, 3);
      if (title) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var size = 64;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 20 && ctx.measureText(title).width > w * 0.8) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(12,16,42,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w / 2, h * 0.15);
        var tg = ctx.createLinearGradient(0, h * 0.15 - size / 2, 0, h * 0.15 + size / 2);
        tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
        ctx.fillStyle = tg; ctx.fillText(title, w / 2, h * 0.15);
      }
    }
  };

  G.art = ART;
})(window.GAME);
