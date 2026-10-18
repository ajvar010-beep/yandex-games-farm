/* game/art.js — процедурная арт-фабрика «Бабл-Бухты»: пузырьки, мины, жемчуг, краб.
   Ноль внешних ассетов. Standalone: ART.init имеет fallback window.Engine + mulberry32.
   ART.promo(ctx,w,h,kind,rng,title) — иконка/обложка из тех же примитивов (rng — голая
   mulberry32-ФУНКЦИЯ из promo.html, звать только rng()). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var ART = { ready: false };

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

  /* Обычный пузырёк: стеклянная сфера с бликом и каёмкой. */
  ART.drawBubble = function (ctx, cx, cy, r, t, phase, color) {
    var k = 1 + Math.sin(t * 3 + phase) * 0.05;
    var rr = r * k;
    ctx.save();
    ctx.translate(cx, cy);
    // мягкое свечение
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color || '#8fdcff';
    ctx.beginPath(); ctx.arc(0, 0, rr * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // сфера
    var g = ctx.createRadialGradient(-rr * 0.32, -rr * 0.32, rr * 0.08, 0, 0, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, color || '#8fdcff');
    g.addColorStop(1, 'rgba(50,130,180,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    // каёмка
    ctx.strokeStyle = 'rgba(230,250,255,0.85)'; ctx.lineWidth = Math.max(1.5, rr * 0.08);
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.96, 0, Math.PI * 2); ctx.stroke();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(-rr * 0.3, -rr * 0.34, rr * 0.18, rr * 0.11, -0.5, 0, Math.PI * 2); ctx.fill();
    // маленькая искорка внизу справа
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(rr * 0.28, rr * 0.3, rr * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Жемчужина в пузыре — золотой шарик в сфере. */
  ART.drawPearl = function (ctx, cx, cy, r, t, phase) {
    ctx.save();
    // внешний пузырь (полупрозрачный)
    ctx.globalAlpha = 0.45;
    ART.drawBubble(ctx, cx, cy, r * 1.22, t, phase, '#ffe9f2');
    ctx.globalAlpha = 1;
    // жемчужина
    var g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.06, cx, cy, r);
    g.addColorStop(0, '#fff6fa'); g.addColorStop(0.55, '#ffd6ea'); g.addColorStop(1, '#e889b8');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.18, cy - r * 0.2, r * 0.12, r * 0.07, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Морская мина: тёмный шар с шипами и горящим запалом. */
  ART.drawMine = function (ctx, cx, cy, r, t, phase) {
    ctx.save();
    // мягкое красное свечение опасности
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 5 + phase);
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(cx, cy);
    // шипы (8 штук)
    ctx.strokeStyle = '#2b3442'; ctx.lineWidth = Math.max(2.5, r * 0.16); ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 + phase * 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
      ctx.stroke();
    }
    // тело
    var g = ctx.createRadialGradient(-r * 0.28, -r * 0.28, r * 0.1, 0, 0, r * 0.92);
    g.addColorStop(0, '#6b7688'); g.addColorStop(1, '#2b3442');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(180,195,210,0.6)'; ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    // запал — пульсирующая точка
    ctx.fillStyle = '#ff8a5d';
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 8 + phase);
    ctx.beginPath(); ctx.arc(r * 0.26, -r * 0.26, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // блик на корпусе
    ctx.fillStyle = 'rgba(220,232,245,0.5)';
    ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.28, r * 0.14, r * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Сердечко (жизнь). */
  ART.drawHeart = function (ctx, cx, cy, r, t, phase) {
    var k = 1 + Math.sin(t * 4 + phase) * 0.1;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff6b9d';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.75, -r * 1.1, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.75, -r * 1.1, r * 1.5, -r * 0.1, 0, r * 0.9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.3, r * 0.2, r * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Бонус-капсулы: slow (бриз) и x2. */
  ART.drawBonus = function (ctx, kind, cx, cy, r, t, phase) {
    var col = kind === 'slow' ? '#74c0fc' : '#b197fc';
    var k = 1 + Math.sin(t * 2.6 + phase) * 0.07;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.globalAlpha = 0.3; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, r * 0.1); ctx.stroke();
    ctx.fillStyle = '#20244a';
    ctx.font = '800 ' + Math.round(r * 0.95) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'slow' ? '⏱' : '×2', 0, r * 0.06);
    ctx.restore();
  };

  /* Краб — маскот бухты, стоит на песчаной кромке внизу. */
  ART.drawCrab = function (ctx, cx, cy, s, t, invuln) {
    ctx.save();
    if (invuln > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 30);
    ctx.translate(cx, cy);
    var wob = Math.sin(t * 2.2) * 0.04;
    ctx.rotate(wob);
    // ноги: по 3 с каждой стороны
    ctx.strokeStyle = '#d8552f'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var lx = -s * 0.5 - i * s * 0.06;
      var ly = -s * 0.1 + i * s * 0.16;
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, -s * 0.06 + i * s * 0.08);
      ctx.lineTo(lx, ly + Math.sin(t * 3 + i) * s * 0.03);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.28, -s * 0.06 + i * s * 0.08);
      ctx.lineTo(-lx, ly + Math.sin(t * 3 + i + 1) * s * 0.03);
      ctx.stroke();
    }
    // клешни
    function claw(side) {
      ctx.save();
      ctx.translate(side * s * 0.4, -s * 0.22);
      ctx.rotate(side * (0.5 + Math.sin(t * 2.8) * 0.12));
      var g = ctx.createRadialGradient(-s * 0.04, -s * 0.04, s * 0.02, 0, 0, s * 0.24);
      g.addColorStop(0, '#ffb096'); g.addColorStop(1, '#ff7a59');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(side * s * 0.1, -s * 0.04, s * 0.2, s * 0.15, side * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d8552f'; ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.ellipse(side * s * 0.1, -s * 0.04, s * 0.2, s * 0.15, side * 0.3, 0, Math.PI * 2); ctx.stroke();
      // зазубрина клешни
      ctx.fillStyle = '#ff7a59';
      ctx.beginPath();
      ctx.moveTo(side * s * 0.22, -s * 0.14); ctx.lineTo(side * s * 0.3, -s * 0.02); ctx.lineTo(side * s * 0.18, -s * 0.02);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    claw(-1); claw(1);
    // тело
    var g = ctx.createRadialGradient(-s * 0.08, -s * 0.12, s * 0.05, 0, 0, s * 0.5);
    g.addColorStop(0, '#ff9d80'); g.addColorStop(1, '#e8563a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c9472b'; ctx.lineWidth = s * 0.045;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    // глаза на стебельках
    ctx.strokeStyle = '#d8552f'; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(-s * 0.14, -s * 0.28); ctx.lineTo(-s * 0.16, -s * 0.44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.14, -s * 0.28); ctx.lineTo(s * 0.16, -s * 0.44); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.47, s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.47, s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath(); ctx.arc(-s * 0.15, -s * 0.46, s * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.15, -s * 0.46, s * 0.045, 0, Math.PI * 2); ctx.fill();
    // улыбка
    ctx.strokeStyle = 'rgba(120,30,10,0.8)'; ctx.lineWidth = s * 0.035;
    ctx.beginPath(); ctx.arc(0, -s * 0.04, s * 0.14, 0.35, Math.PI - 0.35); ctx.stroke();
    ctx.restore();
  };

  /* Медуза: зонтик с волнистым краем и щупальцами, мягкое свечение. */
  ART.drawJelly = function (ctx, cx, cy, r, t, phase) {
    var pulse = 1 + Math.sin(t * 3.2 + phase) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    // ореол
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#c3a3ff';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // щупальца: три волнистых отростка вниз
    ctx.strokeStyle = '#9d7df0'; ctx.lineWidth = Math.max(2, r * 0.1); ctx.lineCap = 'round';
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.3, r * 0.4);
      for (var seg = 1; seg <= 4; seg++) {
        var p = seg / 4;
        var sway = Math.sin(t * 4 + phase + i * 2.1 + p * 3.0) * r * 0.16;
        ctx.lineTo(i * r * 0.3 + sway, r * 0.4 + p * r * 0.9);
      }
      ctx.stroke();
    }
    // зонтик
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, -r * 0.1, r * 1.05);
    g.addColorStop(0, '#f3ebff'); g.addColorStop(0.5, '#d6c0ff'); g.addColorStop(1, '#a17ee8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * pulse, Math.PI, 0); // верхняя полусфера
    ctx.quadraticCurveTo(r * 0.5 * pulse, r * 0.3, 0, r * 0.18); // волнистый нижний край
    ctx.quadraticCurveTo(-r * 0.5 * pulse, r * 0.3, -r * pulse, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.stroke();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.2, r * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
    // глазки-точки
    ctx.fillStyle = '#3d2a6e';
    ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.12, r * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.18, -r * 0.12, r * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* Промо-хук. */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    function bubblesBg(n) {
      for (var i = 0; i < n; i++) {
        ctx.globalAlpha = 0.12 + rng() * 0.3;
        var r = 3 + rng() * 14;
        ctx.strokeStyle = '#8fdcff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a4a6e'); bg.addColorStop(1, '#04263e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // песок внизу
    ctx.fillStyle = '#f7d9a0';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var x = 0; x <= w; x += w / 8) ctx.lineTo(x, h - 18 - rng() * 22);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    bubblesBg(kind === 'icon' ? 20 : 34);
    if (kind === 'icon') {
      ART.drawBubble(ctx, w * 0.26, h * 0.3, 34, 1.1, 0);
      ART.drawPearl(ctx, w * 0.72, h * 0.24, 28, 0.9, 2);
      ART.drawMine(ctx, w * 0.72, h * 0.56, 26, 1, 1);
      ART.drawBubble(ctx, w * 0.3, h * 0.62, 24, 1.3, 3, '#ffd43b');
      ART.drawCrab(ctx, w / 2, h * 0.68, 150, 1.4, 0);
    } else {
      ART.drawBubble(ctx, w * 0.08, h * 0.24, 30, 1, 0);
      ART.drawPearl(ctx, w * 0.2, h * 0.38, 34, 1.1, 1);
      ART.drawBubble(ctx, w * 0.34, h * 0.2, 24, 0.9, 2, '#ffd43b');
      ART.drawMine(ctx, w * 0.88, h * 0.2, 26, 1, 3);
      ART.drawBonus(ctx, 'x2', w * 0.5, h * 0.32, 22, 1, 2);
      ART.drawJelly(ctx, w * 0.6, h * 0.44, 24, 1.1, 4);
      ART.drawHeart(ctx, w * 0.72, h * 0.28, 20, 1, 1);
      ART.drawCrab(ctx, w * 0.3, h * 0.7, 200, 1.3, 0);
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 58;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.44) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(4,38,62,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.5, h * 0.7);
        var tg = ctx.createLinearGradient(0, h * 0.7 - size / 2, 0, h * 0.7 + size / 2);
        tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.5, h * 0.7);
      }
    }
  };

  G.art = ART;
})(window.GAME);
