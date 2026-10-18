/* game/entities.js — сущности мердж-поля: клетки, монстрики, драг, яйцо-спавнер.
   ВСЯ отрисовка монстриков — через G.art (процедурный атлас). Никакой логики
   рендера тут быть не должно, только данные и hit-test. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var ENT = {};

  /* Монстрик на поле. cellIx — индекс клетки (row*cols+col), tier — 0..11.
     phase — индивидуальный сдвиг дыхания/моргания (детерминирован от спавна). */
  ENT.makeMonster = function (tier, cellIx, rng) {
    return { tier: tier, cellIx: cellIx, phase: rng ? rng.range(0, 6.28) : 0,
             bornT: 0, mergeT: 0, incomeAcc: 0 };
  };

  ENT.cellAt = function (board, x, y) {
    var c = board.cellRect;
    for (var i = 0; i < c.length; i++) {
      var r = c[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  };

  /* Можно ли слить a -> b (b — целевая клетка): одинаковый тир, либо один из них джокер. */
  ENT.canMerge = function (a, b) {
    if (!a || !b || a === b) return false;
    if (a.tier === -1 || b.tier === -1) return true; // джокер
    return a.tier === b.tier && a.tier < G.config.tiers.length - 1;
  };

  /* Тир результата мерджа (джокер повышает цель, пара одинаковых — +1). */
  ENT.mergeResult = function (a, b) {
    if (a.tier === -1) return Math.min(b.tier + 1, G.config.tiers.length - 1);
    if (b.tier === -1) return Math.min(a.tier + 1, G.config.tiers.length - 1);
    return a.tier + 1;
  };

  G.entities = ENT;
})(window.GAME);
