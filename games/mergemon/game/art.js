/* game/art.js — фабрика «конфетного» арта: монстрики уровня топа Яндекс Игр,
   рисуются ПРОЦЕДУРНО на offscreen-canvas один раз при загрузке (ноль внешних
   ассетов, 1.7). Каждый тир — слои: тень -> пропсы за телом -> blob-тело с
   гармониками -> вертикальный градиент объёма -> тёмная обводка -> глянец ->
   пузо -> щёчки -> ГЛАЗА с бликами -> эмоция рта/бровей -> пропсы спереди.
   Атлас: G.art.mons[tier] = { c: canvas, f: 'closed' | 1 } (f — кадр моргания).
   Хук G.art.promo(ctx, w, h, kind, rng, title) рисует иконку/обложку из тех же
   спрайтов — промо НЕ скриншоты (5.6), но визуально совпадает с игрой. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- цвет ---------- */
  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  function rgb(a) { return 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')'; }
  function rgba(a, al) { return 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al + ')'; }
  function mix(c1, c2, k) {
    var a = hex(c1), b = hex(c2);
    return rgb([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
  }
  function shade(c, k) { return mix(c, '#000000', k); }
  function tint(c, k) { return mix(c, '#ffffff', k); }

  /* ---------- blob-тело: круг, деформированный гармониками (детерминировано тиром) ---------- */
  function blobPath(ctx, cx, cy, r, seed) {
    var rng = new E.Rng(777 + seed * 131);
    var a1 = rng.range(0.03, 0.10), a2 = rng.range(0.02, 0.07), a3 = rng.range(0.0, 0.045);
    var p1 = rng.angle(), p2 = rng.angle(), p3 = rng.angle();
    var squash = rng.range(0.90, 1.0); // милые коротышки чуть приплюснуты
    ctx.beginPath();
    var N = 36;
    for (var i = 0; i <= N; i++) {
      var a = (i / N) * Math.PI * 2;
      var w = 1 + a1 * Math.sin(a * 2 + p1) + a2 * Math.sin(a * 3 + p2) + a3 * Math.sin(a * 5 + p3);
      var x = cx + Math.cos(a) * r * w;
      var y = cy + Math.sin(a) * r * w * squash;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* ---------- пропсы (рисуются относительно центра тела 0,0, радиус r) ---------- */
  var PROPS = {
    sprout: function (ctx, r, c, back) {
      if (back) return;
      ctx.strokeStyle = shade('#51cf66', 0.25); ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.82); ctx.quadraticCurveTo(r * 0.06, -r * 1.02, 0, -r * 1.12); ctx.stroke();
      ctx.fillStyle = '#69db7c';
      ctx.save(); ctx.translate(0, -r * 1.14); ctx.rotate(-0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.20, r * 0.10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#8ce99a';
      ctx.save(); ctx.translate(r * 0.10, -r * 1.10); ctx.rotate(0.6);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.15, r * 0.075, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    stubhorn: function (ctx, r, c, back) {
      if (back) return;
      ctx.fillStyle = '#ffe8cc'; ctx.strokeStyle = shade(c, 0.45); ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.moveTo(-r * 0.06, -r * 0.86); ctx.quadraticCurveTo(0, -r * 1.22, r * 0.10, -r * 0.88); ctx.closePath();
      ctx.fill(); ctx.stroke();
    },
    ears: function (ctx, r, c, back) {
      if (!back) return;
      for (var s = -1; s <= 1; s += 2) {
        ctx.save(); ctx.translate(s * r * 0.42, -r * 0.72); ctx.rotate(s * 0.35);
        ctx.fillStyle = c; ctx.strokeStyle = shade(c, 0.5); ctx.lineWidth = r * 0.06;
        ctx.beginPath(); ctx.moveTo(-r * 0.20, r * 0.10); ctx.lineTo(0, -r * 0.52); ctx.lineTo(r * 0.20, r * 0.10); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = tint(c, 0.45);
        ctx.beginPath(); ctx.moveTo(-r * 0.09, r * 0.02); ctx.lineTo(0, -r * 0.30); ctx.lineTo(r * 0.09, r * 0.02); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },
    horns: function (ctx, r, c, back) {
      if (!back) return;
      for (var s = -1; s <= 1; s += 2) {
        ctx.fillStyle = '#ffd8a8'; ctx.strokeStyle = shade('#ffd8a8', 0.55); ctx.lineWidth = r * 0.05;
        ctx.beginPath();
        ctx.moveTo(s * r * 0.42, -r * 0.62);
        ctx.quadraticCurveTo(s * r * 0.66, -r * 1.02, s * r * 0.30, -r * 1.02);
        ctx.quadraticCurveTo(s * r * 0.44, -r * 0.92, s * r * 0.26, -r * 0.66);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    },
    antenna: function (ctx, r, c, back) {
      if (back) return;
      ctx.strokeStyle = shade(c, 0.4); ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.84); ctx.quadraticCurveTo(-r * 0.10, -r * 1.10, r * 0.05, -r * 1.22); ctx.stroke();
      var g = ctx.createRadialGradient(r * 0.05 - r * 0.04, -r * 1.26, r * 0.02, r * 0.05, -r * 1.26, r * 0.16);
      g.addColorStop(0, '#fff9db'); g.addColorStop(0.5, '#ffe066'); g.addColorStop(1, 'rgba(255,224,102,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r * 0.05, -r * 1.26, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066'; ctx.strokeStyle = shade('#ffe066', 0.5); ctx.lineWidth = r * 0.03;
      ctx.beginPath(); ctx.arc(r * 0.05, -r * 1.26, r * 0.085, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    },
    spikes: function (ctx, r, c, back) {
      if (!back) return;
      ctx.fillStyle = tint(c, 0.25); ctx.strokeStyle = shade(c, 0.5); ctx.lineWidth = r * 0.045;
      for (var i = -2; i <= 2; i++) {
        var a = -Math.PI / 2 + i * 0.36;
        var bx = Math.cos(a) * r * 0.86, by = Math.sin(a) * r * 0.86;
        var tx = Math.cos(a) * r * 1.22, ty = Math.sin(a) * r * 1.22;
        var px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(bx + px * r * 0.11, by + py * r * 0.11);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx - px * r * 0.11, by - py * r * 0.11);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    },
    wings: function (ctx, r, c, back) {
      if (!back) return;
      for (var s = -1; s <= 1; s += 2) {
        ctx.save(); ctx.translate(s * r * 0.78, -r * 0.05); ctx.rotate(s * 0.5);
        var g = ctx.createLinearGradient(0, -r * 0.4, 0, r * 0.4);
        g.addColorStop(0, tint(c, 0.55)); g.addColorStop(1, tint(c, 0.15));
        ctx.fillStyle = g; ctx.strokeStyle = shade(c, 0.35); ctx.lineWidth = r * 0.045;
        ctx.globalAlpha = 0.92;
        ctx.beginPath(); ctx.ellipse(s * r * 0.28, 0, r * 0.42, r * 0.24, s * 0.5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    crown: function (ctx, r, c, back) {
      if (back) return;
      var w = r * 0.62, y = -r * 0.80;
      ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = shade('#ffd43b', 0.45); ctx.lineWidth = r * 0.045;
      ctx.beginPath();
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(-w / 2, y - r * 0.30); ctx.lineTo(-w * 0.22, y - r * 0.12);
      ctx.lineTo(0, y - r * 0.38); ctx.lineTo(w * 0.22, y - r * 0.12);
      ctx.lineTo(w / 2, y - r * 0.30); ctx.lineTo(w / 2, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath(); ctx.arc(0, y - r * 0.10, r * 0.055, 0, Math.PI * 2); ctx.fill();
    },
    halo: function (ctx, r, c, back) {
      if (back) return;
      ctx.save(); ctx.translate(0, -r * 1.12); ctx.scale(1, 0.38);
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = r * 0.10;
      ctx.shadowColor = '#ffe066'; ctx.shadowBlur = r * 0.22;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    },
    /* --- новые пропсы: парадный гардероб монстриков --- */
    bow: function (ctx, r, c, back) { // бантик сбоку на «макушке»
      if (back) return;
      ctx.save(); ctx.translate(r * 0.30, -r * 0.86); ctx.rotate(0.35);
      ctx.fillStyle = '#ff5d8f'; ctx.strokeStyle = shade('#ff5d8f', 0.45); ctx.lineWidth = r * 0.035;
      for (var s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * r * 0.22, -r * 0.20, s * r * 0.34, -r * 0.02);
        ctx.quadraticCurveTo(s * r * 0.30, r * 0.14, 0, r * 0.04);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#ffd0e0';
      ctx.beginPath(); ctx.arc(0, -r * 0.01, r * 0.075, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    mohawk: function (ctx, r, c, back) { // гребень-ирокез из трёх перьев
      if (back) return;
      ctx.fillStyle = tint(c, 0.35); ctx.strokeStyle = shade(c, 0.5); ctx.lineWidth = r * 0.04;
      for (var i = -1; i <= 1; i++) {
        var h = r * (0.34 - Math.abs(i) * 0.10);
        var x = i * r * 0.16;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.09, -r * 0.80);
        ctx.quadraticCurveTo(x, -r * 0.80 - h, x + r * 0.09, -r * 0.80);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    },
    starwand: function (ctx, r, c, back) { // антенна со звёздочкой
      if (back) return;
      ctx.strokeStyle = shade(c, 0.4); ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.84); ctx.quadraticCurveTo(r * 0.12, -r * 1.06, r * 0.02, -r * 1.16); ctx.stroke();
      var sx = r * 0.02, sy = -r * 1.24, sr = r * 0.16;
      ctx.save(); ctx.translate(sx, sy);
      ctx.shadowColor = '#ffe066'; ctx.shadowBlur = r * 0.18;
      ctx.fillStyle = '#ffe066'; ctx.strokeStyle = shade('#ffe066', 0.5); ctx.lineWidth = r * 0.025;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? sr * 0.45 : sr;
        var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); ctx.shadowBlur = 0;
    },
    flame: function (ctx, r, c, back) { // огненный чубчик
      if (back) return;
      ctx.save(); ctx.translate(0, -r * 0.82);
      ctx.shadowColor = '#ffa94d'; ctx.shadowBlur = r * 0.14;
      var g = ctx.createLinearGradient(0, -r * 0.5, 0, 0);
      g.addColorStop(0, '#fff3bf'); g.addColorStop(0.5, '#ffd43b'); g.addColorStop(1, '#f76707');
      ctx.fillStyle = g; ctx.strokeStyle = shade('#f76707', 0.35); ctx.lineWidth = r * 0.035;
      ctx.beginPath();
      ctx.moveTo(-r * 0.16, 0);
      ctx.quadraticCurveTo(-r * 0.30, -r * 0.22, -r * 0.06, -r * 0.34);
      ctx.quadraticCurveTo(-r * 0.02, -r * 0.52, r * 0.12, -r * 0.42);
      ctx.quadraticCurveTo(r * 0.28, -r * 0.30, r * 0.16, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); ctx.shadowBlur = 0;
    },
    gemtop: function (ctx, r, c, back) { // кристалл на макушке
      if (back) return;
      var w = r * 0.30, y = -r * 0.84;
      var g = ctx.createLinearGradient(0, y - r * 0.34, 0, y);
      g.addColorStop(0, '#e7f5ff'); g.addColorStop(0.55, '#74c0fc'); g.addColorStop(1, '#4a7fd4');
      ctx.fillStyle = g; ctx.strokeStyle = shade('#4a7fd4', 0.3); ctx.lineWidth = r * 0.035;
      ctx.beginPath();
      ctx.moveTo(0, y - r * 0.36);
      ctx.lineTo(w / 2, y - r * 0.12); ctx.lineTo(w * 0.3, y); ctx.lineTo(-w * 0.3, y); ctx.lineTo(-w / 2, y - r * 0.12);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = r * 0.02;
      ctx.beginPath(); ctx.moveTo(-w * 0.12, y - r * 0.26); ctx.lineTo(w * 0.06, y - r * 0.10); ctx.stroke();
    },
    puffcloud: function (ctx, r, c, back) { // облачко-пышка над головой
      if (back) return;
      ctx.save(); ctx.translate(0, -r * 1.0);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(180,190,230,0.9)'; ctx.lineWidth = r * 0.03;
      var puffs = [[-0.22, 0.04, 0.16], [0, -0.06, 0.20], [0.22, 0.04, 0.16], [-0.08, 0.10, 0.14], [0.10, 0.10, 0.13]];
      ctx.beginPath();
      for (var i = 0; i < puffs.length; i++)
        ctx.arc(puffs[i][0] * r, puffs[i][1] * r, puffs[i][2] * r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    scarf: function (ctx, r, c, back) { // шарфик поверх пуза
      if (back) return;
      ctx.fillStyle = '#e8590c'; ctx.strokeStyle = shade('#e8590c', 0.4); ctx.lineWidth = r * 0.035;
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, r * 0.28);
      ctx.quadraticCurveTo(0, r * 0.52, r * 0.52, r * 0.28);
      ctx.lineTo(r * 0.46, r * 0.44);
      ctx.quadraticCurveTo(0, r * 0.66, -r * 0.46, r * 0.44);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); // свисающий кончик
      ctx.moveTo(r * 0.30, r * 0.44); ctx.lineTo(r * 0.44, r * 0.82); ctx.lineTo(r * 0.22, r * 0.86); ctx.lineTo(r * 0.12, r * 0.50);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    },
    bigears: function (ctx, r, c, back) { // большие круглые уши по бокам
      if (!back) return;
      for (var s = -1; s <= 1; s += 2) {
        ctx.fillStyle = c; ctx.strokeStyle = shade(c, 0.5); ctx.lineWidth = r * 0.05;
        ctx.beginPath(); ctx.arc(s * r * 0.82, -r * 0.30, r * 0.30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = tint(c, 0.5);
        ctx.beginPath(); ctx.arc(s * r * 0.80, -r * 0.28, r * 0.15, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  /* ---------- узоры на теле: свой принт у каждого тира (клипнуты к силуэту) ---------- */
  var BODY_PATTERNS = ['dots', 'none', 'stripes', 'dots', 'hearts', 'freckles', 'none', 'stars', 'stripes', 'dots', 'stars', 'hearts', 'stars', 'scales', 'hearts', 'scales'];
  function starPath(ctx, x, y, sr) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? sr * 0.45 : sr;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function drawBodyPattern(ctx, cx, cy, r, c, kind) {
    if (kind === 'none') return;
    var i, a, d, x, y;
    if (kind === 'dots' || kind === 'freckles') {
      var n = kind === 'dots' ? 7 : 11, rad = kind === 'dots' ? r * 0.085 : r * 0.05;
      ctx.fillStyle = rgba(hex(shade(c, 0.22)), 0.30);
      for (i = 0; i < n; i++) {
        a = i * 2.399963 + 0.7; d = r * (0.45 + 0.45 * ((i * 37) % 10) / 10); // golden angle
        x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d * 0.85 + r * 0.10;
        if (Math.abs(y - (cy + r * 0.40)) < r * 0.30 && Math.abs(x - cx) < r * 0.45) continue; // не печатаем по пузу
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'stripes') {
      ctx.strokeStyle = rgba(hex(shade(c, 0.30)), 0.32); ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
      for (i = -1; i <= 1; i++) {
        y = cy - r * 0.35 + (i + 1) * r * 0.22;
        ctx.beginPath(); ctx.moveTo(cx - r * 0.75, y);
        ctx.quadraticCurveTo(cx, y + r * 0.14, cx + r * 0.75, y - r * 0.06);
        ctx.stroke();
      }
    } else if (kind === 'stars') {
      ctx.fillStyle = rgba(hex(tint(c, 0.75)), 0.65);
      for (i = 0; i < 5; i++) {
        a = i * 2.399963 + 1.1; d = r * (0.42 + 0.38 * ((i * 53) % 10) / 10);
        starPath(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, r * 0.09);
        ctx.fill();
      }
    } else if (kind === 'hearts') {
      ctx.fillStyle = rgba(hex(tint(c, 0.6)), 0.5);
      for (i = 0; i < 3; i++) {
        a = -2.2 + i * 1.9; d = r * 0.55;
        x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d * 0.7;
        ctx.save(); ctx.translate(x, y); ctx.rotate(0.3 * (i - 1)); ctx.scale(r * 0.16, r * 0.16);
        ctx.beginPath();
        ctx.moveTo(0, 0.55);
        ctx.bezierCurveTo(-0.9, -0.25, -0.42, -0.85, 0, -0.35);
        ctx.bezierCurveTo(0.42, -0.85, 0.9, -0.25, 0, 0.55);
        ctx.fill(); ctx.restore();
      }
    } else if (kind === 'scales') {
      ctx.strokeStyle = rgba(hex(shade(c, 0.28)), 0.30); ctx.lineWidth = r * 0.03;
      for (var row = 0; row < 3; row++) {
        for (var col = -2; col <= 2; col++) {
          x = cx + col * r * 0.30 + (row % 2 ? r * 0.15 : 0);
          y = cy - r * 0.30 + row * r * 0.26;
          ctx.beginPath(); ctx.arc(x, y, r * 0.15, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
        }
      }
    }
  }

  /* ---------- глаза и рты: эмоция тира ---------- */
  function drawEyes(ctx, r, mood, closed) {
    var ex = r * 0.34, ey = -r * 0.06, er = r * (mood === 'angry' ? 0.16 : 0.185);
    for (var s = -1; s <= 1; s += 2) {
      var x = s * ex;
      if (closed) {
        ctx.strokeStyle = '#33241f'; ctx.lineWidth = r * 0.055; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, ey, er * 0.8, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        continue;
      }
      if (mood === 'sleepy') {
        ctx.strokeStyle = '#33241f'; ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, ey, er * 0.85, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
        continue;
      }
      // белок
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(51,36,31,0.55)'; ctx.lineWidth = r * 0.03;
      ctx.beginPath(); ctx.ellipse(x, ey, er, er * 1.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // радужка + зрачок
      ctx.fillStyle = '#5b3a29';
      ctx.beginPath(); ctx.arc(x, ey + er * 0.12, er * 0.58, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26160f';
      ctx.beginPath(); ctx.arc(x, ey + er * 0.14, er * 0.36, 0, Math.PI * 2); ctx.fill();
      // блики — ДВА: большой и малый (живой глянец)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x - er * 0.24, ey - er * 0.18, er * 0.20, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + er * 0.26, ey + er * 0.34, er * 0.10, 0, Math.PI * 2); ctx.fill();
      // реснички у милых мордашек
      if (mood === 'happy' || mood === 'zen') {
        ctx.strokeStyle = '#33241f'; ctx.lineWidth = r * 0.032; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + s * er * 0.72, ey - er * 0.55); ctx.lineTo(x + s * er * 1.05, ey - er * 0.80); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * er * 0.42, ey - er * 0.85); ctx.lineTo(x + s * er * 0.62, ey - er * 1.15); ctx.stroke();
      }
      // брови
      if (mood === 'angry') {
        ctx.strokeStyle = '#33241f'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - s * er * 0.8, ey - er * 1.55); ctx.lineTo(x + s * er * 0.5, ey - er * 1.05); ctx.stroke();
      } else if (mood === 'grumpy' || mood === 'zen') {
        ctx.strokeStyle = 'rgba(51,36,31,0.75)'; ctx.lineWidth = r * 0.045; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - er * 0.7, ey - er * 1.5); ctx.quadraticCurveTo(x, ey - er * 1.75, x + er * 0.7, ey - er * 1.5); ctx.stroke();
      }
    }
  }

  function drawMouth(ctx, r, mood, closed) {
    var my = r * 0.36;
    ctx.strokeStyle = '#33241f'; ctx.lineCap = 'round'; ctx.lineWidth = r * 0.055;
    if (mood === 'grumpy') {
      ctx.beginPath(); ctx.arc(0, my + r * 0.22, r * 0.20, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      return;
    }
    if (mood === 'angry') {
      ctx.fillStyle = '#5c2b2b';
      ctx.beginPath(); ctx.moveTo(-r * 0.20, my);
      for (var i = 0; i < 4; i++) { // зубастая пасть
        ctx.lineTo(-r * 0.20 + (i + 0.5) * (r * 0.10), my + (i % 2 ? 0 : r * 0.10));
      }
      ctx.lineTo(r * 0.20, my);
      ctx.quadraticCurveTo(0, my + r * 0.26, -r * 0.20, my);
      ctx.closePath(); ctx.fill();
      return;
    }
    if (mood === 'sleepy') {
      ctx.fillStyle = '#8a4b3a';
      ctx.beginPath(); ctx.ellipse(0, my + r * 0.04, r * 0.09, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // happy / zen / smile — открытая улыбка с язычком
    var w = mood === 'zen' ? r * 0.16 : r * 0.24;
    ctx.fillStyle = '#7a3b3b';
    ctx.beginPath();
    ctx.moveTo(-w, my - r * 0.04);
    ctx.quadraticCurveTo(0, my + r * 0.30, w, my - r * 0.04);
    ctx.quadraticCurveTo(0, my + r * 0.10, -w, my - r * 0.04);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8fa3'; // язычок
    ctx.beginPath(); ctx.ellipse(0, my + r * 0.12, w * 0.45, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------- один монстрик ---------- */
  function drawMonster(ctx, size, tier, mood) {
    var conf = G.config.tiers[tier];
    var c = conf.color;
    var cx = size / 2, cy = size / 2 + size * 0.03;
    var r = size * 0.335;
    var closed = mood === 'closed';

    // мягкая тень под телом (внутри спрайта — спрайты честно «стоят»)
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#1a0f2e';
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.94, r * 0.82, r * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // пропсы ЗА телом
    for (var i = 0; i < conf.props.length; i++) {
      ctx.save(); ctx.translate(cx, cy);
      PROPS[conf.props[i]](ctx, r, c, true);
      ctx.restore();
    }

    // тело
    ctx.save();
    blobPath(ctx, cx, cy, r, tier);
    var g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, tint(c, 0.28));
    g.addColorStop(0.45, c);
    g.addColorStop(1, shade(c, 0.30));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.022);
    ctx.strokeStyle = shade(c, 0.55);
    ctx.stroke();
    ctx.clip(); // глянец/пузо/щёчки не вылезают за силуэт

    // внутреннее свечение снизу (bounce light)
    var g2 = ctx.createRadialGradient(cx, cy + r * 0.9, r * 0.1, cx, cy + r * 0.9, r * 1.4);
    g2.addColorStop(0, rgba(hex(tint(c, 0.35)), 0.35)); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);

    // глянец — большой эллипс сверху-слева
    var g3 = ctx.createLinearGradient(cx - r * 0.4, cy - r * 0.85, cx + r * 0.2, cy - r * 0.05);
    g3.addColorStop(0, 'rgba(255,255,255,0.55)'); g3.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.18, cy - r * 0.48, r * 0.52, r * 0.30, -0.45, 0, Math.PI * 2);
    ctx.fill();

    // пузо
    ctx.fillStyle = rgba(hex(tint(c, 0.5)), 0.5);
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.42, r * 0.52, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();

    // узор тела (пятна/полосы/звёздочки — фирменный принт тира)
    drawBodyPattern(ctx, cx, cy, r, c, BODY_PATTERNS[tier] || 'none');

    // щёчки
    ctx.fillStyle = 'rgba(255,120,140,0.38)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.58, cy + r * 0.16, r * 0.14, r * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.58, cy + r * 0.16, r * 0.14, r * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // лицо — поверх, в исходных координатах
    ctx.save(); ctx.translate(cx, cy);
    drawEyes(ctx, r, closed ? 'closed' : conf.mood, closed);
    drawMouth(ctx, r, closed ? 'zen' : conf.mood, closed);
    ctx.restore();

    // пропсы ПЕРЕД телом
    for (i = 0; i < conf.props.length; i++) {
      ctx.save(); ctx.translate(cx, cy);
      PROPS[conf.props[i]](ctx, r, c, false);
      ctx.restore();
    }
  }

  /* ---------- атлас ---------- */
  var ATLAS_SIZE = 192;
  function buildAtlas() {
    var n = G.config.tiers.length;
    var c = document.createElement('canvas');
    c.width = ATLAS_SIZE * 2; // 2 кадра: открытые глаза / моргание
    c.height = ATLAS_SIZE * n;
    var ctx = c.getContext('2d');
    for (var t = 0; t < n; t++) {
      ctx.save(); ctx.translate(0, ATLAS_SIZE * t);
      drawMonster(ctx, ATLAS_SIZE, t, 'open');
      ctx.restore();
      ctx.save(); ctx.translate(ATLAS_SIZE, ATLAS_SIZE * t);
      drawMonster(ctx, ATLAS_SIZE, t, 'closed');
      ctx.restore();
    }
    return c;
  }

  var ART = { mons: null, coin: null, SIZE: ATLAS_SIZE };

  /* Монстрик с «дыханием» и морганием. t — секунды, phase — индивидуальный сдвиг. */
  ART.drawMonster = function (ctx, tier, x, y, r, t, phase, squash) {
    if (!ART.mons) return;
    var blink = ((t * 0.9 + phase * 7.31) % 3.7) < 0.12 ? 1 : 0;
    var breathe = 1 + Math.sin(t * 2.2 + phase) * 0.028;
    var sx = ATLAS_SIZE * blink, sy = ATLAS_SIZE * tier;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(breathe * (squash ? 1.12 : 1), breathe * (squash ? 0.88 : 1));
    ctx.drawImage(ART.mons, sx, sy, ATLAS_SIZE, ATLAS_SIZE,
      -r / 0.335 * 0.5, -r / 0.335 * 0.5, r / 0.335, r / 0.335);
    ctx.restore();
  };

  /* Монета — глянцевая золотая с мордочкой-звёздочкой. */
  function drawCoin(ctx, size) {
    var cx = size / 2, cy = size / 2, r = size * 0.40;
    var g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ffd43b'); g.addColorStop(1, '#f08c00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = size * 0.035; ctx.strokeStyle = '#c47300'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = size * 0.02;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    // звезда
    ctx.fillStyle = '#fff3bf'; ctx.strokeStyle = '#e8a200'; ctx.lineWidth = size * 0.018;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.22 : r * 0.46;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  ART.init = function () {
    if (ART.mons) return;
    // promo.html грузит ТОЛЬКО config/i18n/art — БЕЗ engine/. Поэтому здесь
    // window.Engine может вообще не существовать: поднимаем namespace и, если
    // Rng не приехал из engine/rng.js, подкладываем локальный mulberry32.
    if (!window.Engine) window.Engine = {};
    E = window.Engine;
    if (!E.Rng) {
      E.Rng = function (seed) {
        var a = (typeof seed === 'string' ? seed.length * 2654435761 : seed) >>> 0;
        var nx = function () {
          a |= 0; a = (a + 0x6D2B79F5) | 0;
          var t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        this.float = nx;
        this.range = function (x, y) { return x + (y - x) * nx(); };
        this.int = function (x, y) { return Math.floor(this.range(x, y + 1)); };
        this.pick = function (arr) { return arr[Math.floor(nx() * arr.length) % arr.length]; };
        this.chance = function (p) { return nx() < p; };
        this.angle = function () { return nx() * Math.PI * 2; };
      };
    }
    ART.mons = buildAtlas();
    var cc = document.createElement('canvas');
    cc.width = cc.height = 96;
    drawCoin(cc.getContext('2d'), 96);
    ART.coin = cc;
  };

  /* ---------- ПРОМО-ХУК: иконка и обложка из тех же спрайтов ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var tiers = G.config.tiers;
    // фон — закатный градиент с лучами
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3b2d6e'); g.addColorStop(0.55, '#7c3fa0'); g.addColorStop(1, '#e0509b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h * 0.62);
    for (var i = 0; i < 14; i++) {
      ctx.save(); ctx.rotate((i / 14) * Math.PI * 2 + 0.2);
      ctx.globalAlpha = 0.06; ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w * 0.02, -h, w * 0.05, h * 2);
      ctx.restore();
    }
    ctx.restore();
    // облачка-блобы на фоне
    for (i = 0; i < 7; i++) {
      ctx.globalAlpha = 0.10; ctx.fillStyle = '#ffffff';
      var bx = rng() * w, by = rng() * h * 0.5, br = (0.05 + rng() * 0.09) * Math.min(w, h);
      ctx.beginPath(); ctx.ellipse(bx, by, br * 1.8, br, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (kind === 'icon') {
      // большая эволюция: тир 0 снизу слева -> тир 2 -> тир 5 крупно по центру
      ART.drawMonster(ctx, 0, w * 0.24, h * 0.74, w * 0.11, 1.2, 0, false);
      ART.drawMonster(ctx, 2, w * 0.76, h * 0.70, w * 0.13, 2.1, 2, false);
      ART.drawMonster(ctx, 12, w * 0.50, h * 0.46, w * 0.24, 0.4, 4, false);
      // блеск-звёздочки
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (i = 0; i < 6; i++) {
        var sx = rng() * w, sy = rng() * h, ss = 3 + rng() * 5;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(rng() * Math.PI);
        ctx.globalAlpha = 0.5 + rng() * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -ss * 2); ctx.quadraticCurveTo(0, 0, ss * 2, 0);
        ctx.quadraticCurveTo(0, 0, 0, ss * 2); ctx.quadraticCurveTo(0, 0, -ss * 2, 0);
        ctx.quadraticCurveTo(0, 0, 0, -ss * 2); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      return;
    }

    // cover: трио эволюции слева, название справа
    ART.drawMonster(ctx, 1, w * 0.13, h * 0.68, h * 0.14, 0.9, 1, false);
    ART.drawMonster(ctx, 4, w * 0.28, h * 0.60, h * 0.18, 1.7, 3, false);
    ART.drawMonster(ctx, 12, w * 0.44, h * 0.54, h * 0.21, 0.2, 5, false);
    ART.drawMonster(ctx, 13, w * 0.60, h * 0.46, h * 0.25, 1.3, 7, false);
    // стрелочки эволюции
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = h * 0.012; ctx.lineCap = 'round';
    for (i = 0; i < 2; i++) {
      var ax = w * (0.215 + i * 0.16), ay = h * (0.52 - i * 0.05);
      ctx.beginPath(); ctx.moveTo(ax, ay + h * 0.05); ctx.lineTo(ax + w * 0.035, ay);
      ctx.lineTo(ax + w * 0.028, ay + h * 0.008); ctx.moveTo(ax + w * 0.035, ay); ctx.lineTo(ax + w * 0.022, ay - h * 0.018);
      ctx.stroke();
    }
    if (title) {
      var size = Math.round(h * 0.15);
      ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var maxW = w * 0.40;
      while (size > 18 && ctx.measureText(title).width > maxW) {
        size -= 2;
        ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var tx = w * 0.75, ty = h * 0.42;
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(43,20,73,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(title, tx, ty);
      var tg = ctx.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
      tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
      ctx.fillStyle = tg;
      ctx.fillText(title, tx, ty);
    }
  };

  G.art = ART;
})(window.GAME);
