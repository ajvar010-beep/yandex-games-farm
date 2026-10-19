/* engine/input.js — единый ввод: мышь/тач через Pointer Events + клавиатура по event.code.
   Блокирует скролл, swipe-to-refresh, лонгтап-выделение, контекстное меню, pinch-zoom.
   НЕ трогает системные сочетания (Ctrl/Meta/Alt + ...). */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var I = {
    pointer: { x: 0, y: 0, down: false, pressed: false, released: false, moved: false, downX: 0, downY: 0, downT: 0, type: 'mouse' },
    keys: {}, pressed: {}, released: {},
    anyKeyPressed: false, anyPointerPressed: false,
    _attached: false
  };
  // только клавиши с браузерным дефолтом, который мешает игре (прокрутка)
  var PREVENT_CODES = { Space: 1, ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };

  function pos(e, canvas) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  I.attach = function (canvas) {
    if (I._attached) return; I._attached = true;

    canvas.addEventListener('pointerdown', function (e) {
      var p = pos(e, canvas);
      I.pointer.x = p.x; I.pointer.y = p.y;
      I.pointer.downX = p.x; I.pointer.downY = p.y;
      I.pointer.downT = Date.now();
      I.pointer.down = true; I.pointer.pressed = true;
      I.pointer.type = e.pointerType || 'mouse';
      I.anyPointerPressed = true;
      if (canvas.setPointerCapture && e.pointerId != null) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
      if (e.cancelable) e.preventDefault();
      if (E.audio) E.audio.unlock();
    });
    window.addEventListener('pointermove', function (e) {
      var p = pos(e, canvas);
      if (p.x !== I.pointer.x || p.y !== I.pointer.y) I.pointer.moved = true;
      I.pointer.x = p.x; I.pointer.y = p.y;
    }, { passive: true });
    window.addEventListener('pointerup', function (e) {
      var p = pos(e, canvas);
      I.pointer.x = p.x; I.pointer.y = p.y;
      I.pointer.down = false; I.pointer.released = true;
    });
    window.addEventListener('pointercancel', function () {
      I.pointer.down = false; I.pointer.released = true;
    });

    window.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // системные сочетания — не наши
      if (!e.repeat) { I.keys[e.code] = true; I.pressed[e.code] = true; I.anyKeyPressed = true; }
      if (PREVENT_CODES[e.code] && (e.target === document.body || e.target === canvas)) e.preventDefault();
      if (E.audio) E.audio.unlock();
    });
    window.addEventListener('keyup', function (e) { I.keys[e.code] = false; I.released[e.code] = true; });
    window.addEventListener('blur', function () { I.keys = {}; I.pointer.down = false; });

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { if (e.target === canvas) e.preventDefault(); });
  };

  I.down = function (code) { return !!I.keys[code]; };
  I.wasPressed = function (code) { return !!I.pressed[code]; };
  I.wasReleased = function (code) { return !!I.released[code]; };
  I.postUpdate = function () {
    I.pointer.pressed = false; I.pointer.released = false; I.pointer.moved = false;
    I.pressed = {}; I.released = {};
    I.anyKeyPressed = false; I.anyPointerPressed = false;
  };
  E.input = I;
})(window.Engine);
