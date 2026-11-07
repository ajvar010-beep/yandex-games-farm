/* engine/ui.js — минимальный UI: кнопки, roundRect, текст, fitText. Всё в CSS-пикселях. */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var UI = {};

  UI.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  UI.text = function (ctx, str, x, y, size, color, align, weight) {
    ctx.font = (weight || 600) + ' ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  };

  UI.fit = function (ctx, text, maxW, size, weight) {
    var s = size;
    ctx.font = (weight || 600) + ' ' + s + 'px system-ui, sans-serif';
    while (s > 8 && ctx.measureText(text).width > maxW) {
      s -= 1;
      ctx.font = (weight || 600) + ' ' + s + 'px system-ui, sans-serif';
    }
    return s;
  };

  /* layoutColumn — ГАРАНТИРОВАННО вписывает вертикальный стек элементов в [0..availH].
     rows: массив { h, gap } (gap — пустой промежуток ПОСЛЕ строки; у последней игнорируется).
     Возвращает { scale, top, ys[] } где scale — коэффициент сжатия (1 если всё влезает),
     top — смещение верха стека, ys[i] — верх i-го элемента УЖЕ с учётом scale.
     Вызывающий умножает свои размеры/шрифты на scale и рисует от ys[i]. Это единая
     точка, которая не даёт контенту наложиться на кнопки или уйти под стики-баннер. */
  UI.layoutColumn = function (rows, availH, opts) {
    opts = opts || {};
    var minScale = opts.minScale == null ? 0.55 : opts.minScale;
    var pad = opts.pad == null ? 8 : opts.pad;
    var n = rows.length;
    var gaps = 0, nat = 0;
    for (var i = 0; i < n; i++) { nat += rows[i].h; if (i < n - 1) gaps += (rows[i].gap || 0); }
    var natural = nat + gaps;
    var usable = Math.max(1, availH - pad * 2);
    var scale = natural > usable ? Math.max(minScale, usable / natural) : 1;
    var scaled = natural * scale;
    var top = pad + Math.max(0, (usable - scaled) / 2);
    if (opts.alignTop) top = pad;
    var ys = [], y = top;
    for (i = 0; i < n; i++) {
      ys.push(y);
      y += rows[i].h * scale + (i < n - 1 ? (rows[i].gap || 0) * scale : 0);
    }
    return { scale: scale, top: top, ys: ys, height: scaled };
  };

  function Button(opt) {
    this.x = opt.x; this.y = opt.y; this.w = opt.w; this.h = opt.h;
    this.text = opt.text || '';
    this.onTap = opt.onTap || null;
    this.bg = opt.bg || '#1c2340';
    this.fg = opt.fg || '#e8f6ff';
    this.border = opt.border || '#3d7fe0';
    this.fontSize = opt.fontSize || 20;
    this.enabled = opt.enabled !== false;
    this.visible = opt.visible !== false;
    this.icon = opt.icon || null; // function(ctx, btn) — кастомная отрисовка вместо текста
    this.id = opt.id || '';
  }
  Button.prototype.contains = function (x, y) {
    return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
  };
  Button.prototype.draw = function (ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.globalAlpha = this.enabled ? 1 : 0.45;
    UI.roundRect(ctx, this.x, this.y, this.w, this.h, Math.min(12, this.h / 2));
    ctx.fillStyle = this.bg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = this.border; ctx.stroke();
    if (this.icon) this.icon(ctx, this);
    else UI.text(ctx, this.text, this.x + this.w / 2, this.y + this.h / 2 + 1, this.fontSize, this.fg, 'center', 600);
    ctx.restore();
  };
  Button.prototype.tap = function () { if (this.enabled && this.onTap) this.onTap(this); };
  UI.Button = Button;

  UI.handleTap = function (buttons, x, y) {
    if (!buttons) return null;
    for (var i = buttons.length - 1; i >= 0; i--) {
      var b = buttons[i];
      if (b.visible && b.enabled && b.contains(x, y)) { b.tap(); return b; }
    }
    return null;
  };
  UI.hitTest = function (buttons, x, y) { // как handleTap, но без вызова onTap
    if (!buttons) return null;
    for (var i = buttons.length - 1; i >= 0; i--) {
      var b = buttons[i];
      if (b.visible && b.enabled && b.contains(x, y)) return b;
    }
    return null;
  };
  UI.drawButtons = function (ctx, buttons) {
    if (!buttons) return;
    for (var i = 0; i < buttons.length; i++) buttons[i].draw(ctx);
  };
  E.ui = UI;
})(window.Engine);
