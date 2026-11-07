/* game/art.js — вся графика процедурная: орех, латунь, кремовые плитки с гравировкой,
   промо-иконка и обложка. Ни одного внешнего файла и ни одного Math.random. */
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

  /* ---------- фон: тёмный орех мастерской ---------- */
  A.wood = function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w * 0.35, h);
    g.addColorStop(0, P.woodHi);
    g.addColorStop(0.45, P.wood);
    g.addColorStop(1, P.woodDark);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // доски верстака: три вертикальных шва
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#120b06';
    ctx.lineWidth = Math.max(1, w * 0.0022);
    for (var i = 1; i < 4; i++) {
      var px = (w / 4) * i;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
    }
    ctx.restore();

    // волокна дерева — детерминированные синусоиды
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = '#0e0805';
    ctx.lineWidth = 1;
    var step = Math.max(15, Math.min(w, h) / 20);
    for (var y = step * 0.5; y < h; y += step) {
      ctx.beginPath();
      for (var x = -10; x <= w + 10; x += 26) {
        var yy = y + Math.sin(x * 0.013 + y * 0.05) * (step * 0.16) + Math.sin(x * 0.031) * 1.1;
        if (x <= -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // тёплый свет из верхнего левого угла
    var lg = ctx.createRadialGradient(w * 0.24, h * 0.12, 4, w * 0.24, h * 0.12, Math.max(w, h) * 0.72);
    lg.addColorStop(0, 'rgba(255,226,168,0.20)');
    lg.addColorStop(1, 'rgba(255,226,168,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);

    // виньетка
    var v = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.24, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  };

  /* ---------- латунный винт ---------- */
  A.screw = function (ctx, x, y, r) {
    ctx.save();
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    g.addColorStop(0, P.brassHi);
    g.addColorStop(0.55, P.brass);
    g.addColorStop(1, P.brassDark);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.strokeStyle = 'rgba(50,34,8,0.7)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.58, y + r * 0.16);
    ctx.lineTo(x + r * 0.58, y - r * 0.16);
    ctx.lineWidth = Math.max(1, r * 0.26);
    ctx.strokeStyle = 'rgba(50,34,8,0.55)';
    ctx.stroke();
    ctx.restore();
  };

  /* ---------- основание доски: латунная рама + утопленное поле ----------
     Возвращает геометрию сетки: { frame, inner, x0, y0, cell }. */
  A.boardBase = function (ctx, x, y, size) {
    var frame = Math.max(5, size * 0.045);
    var rad = size * 0.05;

    // тень доски
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.07;
    ctx.shadowOffsetY = size * 0.025;
    rr(ctx, x, y, size, size, rad);
    ctx.fillStyle = P.brassDark;
    ctx.fill();
    ctx.restore();

    // латунная плита
    var g = ctx.createLinearGradient(x, y, x + size * 0.8, y + size);
    g.addColorStop(0, P.brassHi);
    g.addColorStop(0.28, P.brass);
    g.addColorStop(0.68, P.brassMid);
    g.addColorStop(1, P.brassDark);
    rr(ctx, x, y, size, size, rad);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, size * 0.006);
    ctx.strokeStyle = 'rgba(52,36,8,0.65)';
    ctx.stroke();

    // блик по верхней кромке
    ctx.save();
    rr(ctx, x, y, size, size, rad);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size, y + size * 0.07);
    ctx.lineTo(x, y + size * 0.13);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,247,214,0.55)';
    ctx.fill();
    // потемнение снизу
    var dg = ctx.createLinearGradient(0, y + size * 0.72, 0, y + size);
    dg.addColorStop(0, 'rgba(60,40,8,0)');
    dg.addColorStop(1, 'rgba(60,40,8,0.4)');
    ctx.fillStyle = dg;
    ctx.fillRect(x, y + size * 0.72, size, size * 0.28);
    ctx.restore();

    // внутреннее утопленное поле
    var inner = size - frame * 2;
    rr(ctx, x + frame, y + frame, inner, inner, size * 0.022);
    ctx.fillStyle = P.slot;
    ctx.fill();
    ctx.save();
    rr(ctx, x + frame, y + frame, inner, inner, size * 0.022);
    ctx.clip();
    var ig = ctx.createLinearGradient(0, y + frame, 0, y + frame + inner);
    ig.addColorStop(0, 'rgba(0,0,0,0.55)');
    ig.addColorStop(0.16, 'rgba(0,0,0,0)');
    ig.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = ig;
    ctx.fillRect(x + frame, y + frame, inner, inner);
    ctx.restore();
    ctx.lineWidth = Math.max(1, size * 0.004);
    ctx.strokeStyle = 'rgba(255,240,200,0.18)';
    rr(ctx, x + frame, y + frame, inner, inner, size * 0.022);
    ctx.stroke();

    // винты по углам рамы
    var rv = Math.max(2.2, size * 0.013);
    var off = frame * 0.5;
    A.screw(ctx, x + off, y + off, rv);
    A.screw(ctx, x + size - off, y + off, rv);
    A.screw(ctx, x + off, y + size - off, rv);
    A.screw(ctx, x + size - off, y + size - off, rv);

    return { frame: frame, inner: inner, x0: x + frame, y0: y + frame, cell: inner / 1 };
  };

  /* ---------- плитка с гравировкой ---------- */
  A.tile = function (ctx, x, y, w, h, value, opts) {
    opts = opts || {};
    var rad = Math.max(3, Math.min(w, h) * 0.11);
    var lift = opts.lift || 0;
    y -= lift;

    ctx.save();
    ctx.shadowColor = 'rgba(10,6,2,0.45)';
    ctx.shadowBlur = w * (0.10 + lift * 0.02);
    ctx.shadowOffsetY = Math.max(1.5, h * 0.035);
    rr(ctx, x, y, w, h, rad);
    ctx.fillStyle = P.creamDark;
    ctx.fill();
    ctx.restore();

    // тело плитки
    var g = ctx.createLinearGradient(x, y, x + w * 0.25, y + h);
    g.addColorStop(0, '#fdf6e2');
    g.addColorStop(0.45, P.cream);
    g.addColorStop(1, P.cream2);
    rr(ctx, x, y, w, h, rad);
    ctx.fillStyle = g;
    ctx.fill();

    // латунная окантовка
    rr(ctx, x + w * 0.012, y + h * 0.014, w * 0.976, h * 0.972, rad * 0.86);
    ctx.lineWidth = Math.max(1, w * 0.018);
    ctx.strokeStyle = 'rgba(140,108,44,0.5)';
    ctx.stroke();

    // верхний блик
    ctx.save();
    rr(ctx, x, y, w, h, rad);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h * 0.16);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.28, x, y + h * 0.14);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    // тень у нижней кромки
    var bg = ctx.createLinearGradient(0, y + h * 0.78, 0, y + h);
    bg.addColorStop(0, 'rgba(120,92,40,0)');
    bg.addColorStop(1, 'rgba(120,92,40,0.22)');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y + h * 0.78, w, h * 0.22);
    ctx.restore();

    if (opts.hint) {
      rr(ctx, x - 1, y - 1, w + 2, h + 2, rad + 1);
      ctx.lineWidth = Math.max(2, w * 0.035);
      ctx.strokeStyle = 'rgba(146,196,92,' + (0.55 + 0.45 * Math.sin((opts.pulse || 0) * 7)).toFixed(3) + ')';
      ctx.stroke();
    }
    if (opts.dim) {
      rr(ctx, x, y, w, h, rad);
      ctx.fillStyle = 'rgba(30,20,8,0.28)';
      ctx.fill();
    }

    // выгравированный номер
    var label = String(value);
    var fs = Math.round(Math.min(w, h) * 0.50);
    ctx.font = '700 ' + fs + 'px Georgia, "Times New Roman", serif';
    while (fs > 8 && ctx.measureText(label).width > w * 0.74) {
      fs--;
      ctx.font = '700 ' + fs + 'px Georgia, "Times New Roman", serif';
    }
    var cx = x + w / 2, cy = y + h * 0.53;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // фаска: светлый оттиск сверху, тёмная гравировка поверх
    ctx.fillStyle = 'rgba(255,252,238,0.9)';
    ctx.fillText(label, cx, cy + Math.max(1, h * 0.018));
    ctx.fillStyle = P.ink;
    ctx.fillText(label, cx, cy - Math.max(1, h * 0.012));
    // глубина буквы
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#2a1c08';
    ctx.fillText(label, cx, cy + Math.max(1, h * 0.005));
    ctx.globalAlpha = 1;

    // тонкая риска-износ внизу
    ctx.beginPath();
    ctx.moveTo(x + w * 0.22, y + h * 0.88);
    ctx.lineTo(x + w * 0.78, y + h * 0.88);
    ctx.lineWidth = Math.max(1, h * 0.006);
    ctx.strokeStyle = 'rgba(120,92,40,0.28)';
    ctx.stroke();
  };

  /* ---------- пустая клетка ---------- */
  A.slot = function (ctx, x, y, w, h) {
    var rad = Math.max(3, Math.min(w, h) * 0.11);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#191008');
    g.addColorStop(1, P.slotHi);
    rr(ctx, x, y, w, h, rad);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    // светлая полоска по нижней кромке углубления
    ctx.beginPath();
    ctx.moveTo(x + w * 0.16, y + h * 0.93);
    ctx.lineTo(x + w * 0.84, y + h * 0.93);
    ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.strokeStyle = 'rgba(242,221,160,0.16)';
    ctx.stroke();
  };

  /* ---------- готовая доска (промо и меню) ---------- */
  A.board = function (ctx, x, y, size, n, values) {
    var base = A.boardBase(ctx, x, y, size);
    var cell = base.inner / n;
    var gap = Math.max(1.5, cell * 0.06);
    for (var i = 0; i < n * n; i++) {
      var r = (i / n) | 0, c = i % n;
      var cx = base.x0 + c * cell + gap / 2;
      var cy = base.y0 + r * cell + gap / 2;
      var cw = cell - gap, ch = cell - gap;
      if (values && values[i]) A.tile(ctx, cx, cy, cw, ch, values[i], {});
      else A.slot(ctx, cx, cy, cw, ch);
    }
    return base;
  };

  /* ---------- монета ---------- */
  A.coin = function (ctx, x, y, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.36, r * 0.12, x, y, r);
    g.addColorStop(0, '#fff5cc');
    g.addColorStop(0.55, P.brass);
    g.addColorStop(1, P.brassDark);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = 'rgba(76,54,14,0.8)';
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.strokeStyle = 'rgba(255,246,206,0.55)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(76,54,14,0.85)';
    ctx.font = '700 ' + Math.round(r * 1.05) + 'px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', x, y + r * 0.06);
    ctx.restore();
  };

  /* ---------- замок закрытого уровня ---------- */
  A.lock = function (ctx, x, y, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.13);
    ctx.beginPath();
    ctx.arc(x, y - s * 0.12, s * 0.28, Math.PI, 0);
    ctx.stroke();
    rr(ctx, x - s * 0.36, y - s * 0.06, s * 0.72, s * 0.56, s * 0.12);
    ctx.fill();
    ctx.restore();
  };

  /* ---------- промо: иконка 512×512 без текста и обложка 800×470 ---------- */
  A.promo = function (ctx, w, h, kind, rng, title) {
    var lang = 'ru';
    try { lang = new URLSearchParams(location.search).get('lang') || 'ru'; } catch (e) {}
    var dict = (G.i18n && (G.i18n[lang] || G.i18n.ru)) || {};
    A.wood(ctx, w, h);

    if (kind === 'icon') {
      var s = Math.round(Math.min(w, h) * 0.78);
      var bx = Math.round((w - s) / 2), by = Math.round((h - s) / 2);
      // тёплое свечение под доской
      var gl = ctx.createRadialGradient(w / 2, h * 0.46, s * 0.2, w / 2, h / 2, s * 0.85);
      gl.addColorStop(0, 'rgba(255,226,150,0.22)');
      gl.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, w, h);
      // 2×2: три плитки и пустая клетка — силуэт пятнашек без текста
      A.board(ctx, bx, by, s, 2, [1, 2, 3, 0]);
      // латунная искра-блик на раме
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(bx + s * 0.2, by + s * 0.16, s * 0.035, 0, Math.PI * 2);
      ctx.fillStyle = '#fffbe8';
      ctx.fill();
      ctx.restore();
      return;
    }

    // обложка: доска слева, текст справа
    var bs = Math.round(Math.min(h * 0.70, w * 0.44));
    var bx2 = Math.round(w * 0.06);
    var by2 = Math.round((h - bs) / 2);
    var gl2 = ctx.createRadialGradient(bx2 + bs * 0.5, by2 + bs * 0.5, bs * 0.24, bx2 + bs * 0.5, by2 + bs * 0.5, bs * 0.9);
    gl2.addColorStop(0, 'rgba(255,226,150,0.20)');
    gl2.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = gl2;
    ctx.fillRect(0, 0, w, h);
    A.board(ctx, bx2, by2, bs, 3, [1, 2, 3, 4, 5, 0, 7, 8, 6]);

    var tx = bx2 + bs + Math.round(w * 0.055);
    var tw = w - tx - Math.round(w * 0.09);
    var name = title || dict.title || 'Brass Order';

    // заголовок: до двух строк, размер подбирается по ширине (без обрезки)
    var words = String(name).split(/\s+/);
    var lines = [name];
    var pref = Math.round(h * 0.135);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 ' + pref + 'px Georgia, "Times New Roman", serif';
    if (ctx.measureText(name).width > tw && words.length > 1) {
      var half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
    }
    var fs = pref, fsMin = pref;
    for (var li = 0; li < lines.length; li++) {
      fs = pref;
      ctx.font = '800 ' + fs + 'px Georgia, "Times New Roman", serif';
      while (fs > 18 && ctx.measureText(lines[li]).width > tw) {
        fs -= 2;
        ctx.font = '800 ' + fs + 'px Georgia, "Times New Roman", serif';
      }
      if (fs < fsMin) fsMin = fs;
    }
    fs = fsMin;
    ctx.font = '800 ' + fs + 'px Georgia, "Times New Roman", serif';
    var lineH = Math.round(fs * 1.12);
    var totalH = lineH * (lines.length - 1);
    var ty = Math.round(h * 0.36) - Math.round(totalH / 2);
    for (var lj = 0; lj < lines.length; lj++) {
      // гравировка: светлый оттиск + тёмная буква + латунный контур
      ctx.fillStyle = 'rgba(255,248,220,0.85)';
      ctx.fillText(lines[lj], tx + 2, ty + lj * lineH + 2);
      ctx.fillStyle = P.cream;
      ctx.fillText(lines[lj], tx, ty + lj * lineH);
      ctx.lineWidth = Math.max(1, fs * 0.03);
      ctx.strokeStyle = 'rgba(201,162,74,0.55)';
      ctx.strokeText(lines[lj], tx, ty + lj * lineH);
    }

    var subY = ty + totalH + Math.round(h * 0.11);
    ctx.fillStyle = P.brass;
    ctx.font = '700 ' + Math.round(h * 0.052) + 'px system-ui, "Segoe UI", sans-serif';
    var tag = dict['cover_tag'] || '';
    var tfs = Math.round(h * 0.052);
    while (tfs > 12 && ctx.measureText(tag).width > tw) {
      tfs--;
      ctx.font = '700 ' + tfs + 'px system-ui, "Segoe UI", sans-serif';
    }
    ctx.fillText(tag, tx, subY);

    ctx.fillStyle = 'rgba(243,231,201,0.74)';
    ctx.font = '500 ' + Math.round(h * 0.043) + 'px system-ui, "Segoe UI", sans-serif';
    var sub = dict['subtitle'] || '';
    var sfs = Math.round(h * 0.043);
    while (sfs > 11 && ctx.measureText(sub).width > tw) {
      sfs--;
      ctx.font = '500 ' + sfs + 'px system-ui, "Segoe UI", sans-serif';
    }
    ctx.fillText(sub, tx, subY + Math.round(h * 0.075));

    // латунная черта под текстом
    ctx.beginPath();
    ctx.moveTo(tx, subY + Math.round(h * 0.125));
    ctx.lineTo(tx + Math.min(tw, w * 0.34), subY + Math.round(h * 0.125));
    ctx.lineWidth = Math.max(2, h * 0.008);
    ctx.strokeStyle = 'rgba(201,162,74,0.6)';
    ctx.stroke();
  };

  G.art = A;
})(window.GAME);
