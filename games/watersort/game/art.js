/* game/art.js — процедурная графика «Аквалайн».
   Трубка (стекло + слои цветной воды + блик), фон-аквариум, пузырики, промо (icon/cover).
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
  function colors() { return G.config.colors; }

  /* ---------- фон: глубина аквариума + пузырики ---------- */
  ART.drawBackground = function (ctx, w, h, t) {
    var P = pal();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // восходящие пузырики (детерминированно по времени)
    ctx.fillStyle = 'rgba(190,232,246,0.10)';
    for (var i = 0; i < 14; i++) {
      var px = ((i * 97) % 100) / 100 * w;
      var sp = 0.05 + (i % 4) * 0.02;
      var py = h - (((t * sp * h) + i * 137) % (h + 60));
      var r = 3 + (i % 3) * 2;
      ctx.beginPath(); ctx.arc(px + Math.sin(t * 0.8 + i) * 8, py, r, 0, Math.PI * 2); ctx.fill();
    }
    // мягкие волны сверху
    ctx.strokeStyle = 'rgba(47,214,195,0.08)'; ctx.lineWidth = 3;
    for (var k = 0; k < 3; k++) {
      ctx.beginPath();
      for (var x = 0; x <= w; x += 16) {
        var y = 20 + k * 14 + Math.sin(x * 0.01 + t * 0.6 + k) * 5;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  /* ---------- трубка ----------
     x,y — центр ВЕРХНЕГО отверстия; w — ширина стекла; layerH — высота одного слоя;
     tube — массив слоёв (снизу вверх); lift — подъём выбранной трубки (0..1);
     sel — подсветка выбора; solvedGlow — свечение собранной. */
  ART.drawTube = function (ctx, x, y, w, layerH, tube, lift, sel, solvedGlow) {
    var P = pal(), C = colors();
    var cap = G.config.capacity;
    var bodyH = layerH * cap + 6;
    var r = w / 2;
    var yy = y - lift;                 // верх трубки с учётом подъёма
    ctx.save();
    // свечение собранной трубки
    if (solvedGlow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28 * solvedGlow;
      ctx.fillStyle = P.good;
      ART._roundTubePath(ctx, x, yy, w, bodyH, r + 6); ctx.fill();
      ctx.restore();
    }
    // стекло (фон)
    ctx.fillStyle = P.tubeGlass;
    ART._roundTubePath(ctx, x, yy, w, bodyH, r); ctx.fill();
    // слои воды (снизу вверх)
    ctx.save();
    ART._roundTubePath(ctx, x, yy, w, bodyH, r); ctx.clip();
    for (var i = 0; i < tube.length; i++) {
      var layerTop = yy + bodyH - (i + 1) * layerH;
      var col = C[tube[i] % C.length];
      ctx.fillStyle = col;
      ctx.fillRect(x - w / 2, layerTop, w, layerH + 1);
      // блик на верхнем слое
      if (i === tube.length - 1 && tube.length > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x - w / 2, layerTop, w, Math.max(2, layerH * 0.18));
      }
    }
    // вертикальный стеклянный блик
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x - w * 0.32, yy + 4, w * 0.16, bodyH - 8);
    ctx.restore();
    // обводка стекла
    ctx.strokeStyle = sel ? P.accent : P.tubeEdge;
    ctx.lineWidth = sel ? 3.5 : 2;
    ART._roundTubePath(ctx, x, yy, w, bodyH, r); ctx.stroke();
    // раструб сверху
    ctx.strokeStyle = sel ? P.accent : P.tubeRim;
    ctx.lineWidth = sel ? 4 : 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r - 3, yy - 2); ctx.lineTo(x + r + 3, yy - 2);
    ctx.stroke();
    ctx.restore();
  };

  // путь трубки: сверху открыта, снизу закруглена
  ART._roundTubePath = function (ctx, x, y, w, h, r) {
    var left = x - w / 2, right = x + w / 2, top = y, bottom = y + h;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom - r);
    ctx.quadraticCurveTo(left, bottom, left + r, bottom);
    ctx.lineTo(right - r, bottom);
    ctx.quadraticCurveTo(right, bottom, right, bottom - r);
    ctx.lineTo(right, top);
    ctx.closePath();
  };

  /* ---------- летящая струйка при переливе ---------- */
  ART.drawPourStream = function (ctx, x0, y0, x1, y1, color, k) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 26, x1, y1);
    ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 26, x1, y1);
    ctx.stroke();
    ctx.restore();
  };

  /* ---------- промо ---------- */
  ART.promo = function (ctx, w, h, kind, rng, title) {
    ART.init();
    var P = pal(), C = colors();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // пузырики
    ctx.fillStyle = 'rgba(190,232,246,0.12)';
    for (var i = 0; i < 26; i++) {
      var px = rng() * w, py = rng() * h, r = 2 + rng() * 6;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    function sampleTube(cx, cy, tw, lh, fills) {
      var cap = G.config.capacity;
      ART._roundTubePath(ctx, cx, cy, tw, lh * cap + 4, tw / 2);
      ctx.fillStyle = 'rgba(190,232,246,0.16)'; ctx.fill();
      ctx.save();
      ART._roundTubePath(ctx, cx, cy, tw, lh * cap + 4, tw / 2); ctx.clip();
      for (var k = 0; k < fills.length; k++) {
        ctx.fillStyle = C[fills[k] % C.length];
        ctx.fillRect(cx - tw / 2, cy + (lh * cap + 4) - (k + 1) * lh, tw, lh + 1);
      }
      ctx.restore();
      ctx.strokeStyle = P.tubeRim; ctx.lineWidth = Math.max(2, tw * 0.08);
      ART._roundTubePath(ctx, cx, cy, tw, lh * cap + 4, tw / 2); ctx.stroke();
    }
    if (kind === 'icon') {
      var tw = w * 0.2, lh = h * 0.075;
      sampleTube(w * 0.3, h * 0.24, tw, lh, [0, 0, 0, 0]);
      sampleTube(w * 0.7, h * 0.24, tw, lh, [3, 3, 3, 3]);
      sampleTube(w * 0.5, h * 0.5, tw, lh, [5, 5, 1, 2]);
    } else {
      var cw = w * 0.075, clh = h * 0.13;
      var tops = [h * 0.34, h * 0.4];
      var sets = [[0,0,0,0],[4,4,4,4],[2,2,2,2],[6,6,6,6],[],[1,1,1,1]];
      for (var s = 0; s < sets.length; s++) {
        sampleTube(w * (0.1 + s * 0.062), tops[s % 2], cw, clh, sets[s]);
      }
      if (title) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var size = 60;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        while (size > 22 && ctx.measureText(title).width > w * 0.42) { size -= 2; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; }
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(4,20,28,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(title, w * 0.52, h * 0.32);
        var tg = ctx.createLinearGradient(0, h * 0.32 - size / 2, 0, h * 0.32 + size / 2);
        tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#8ff0e2');
        ctx.fillStyle = tg; ctx.fillText(title, w * 0.52, h * 0.32);
      }
    }
  };
})(window.GAME);
