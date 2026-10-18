/* game/art.js — процедурный арт-хук игры (опционален в движке).
   У hexwave весь арт живёт в entities.js (полигональные враги/ядро/страж),
   поэтому промо-хук не нужен: промо-рендерер pipeline/promo.html рисует
   из палитры config.js. Файл существует, чтобы загрузка не давала 404 —
   нулевой console-gate съёмки (capture.mjs) падает на любом requestfailed. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.art = {};
})(window.GAME);
