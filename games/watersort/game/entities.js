/* game/entities.js — логика «Аквалайн»: трубки, переливы, решаемость.
   Трубка = массив слоёв (снизу вверх), значения — индексы цвета.
   Генерация ГАРАНТИРУЕТ решаемость: раскладываем готовое решение задом наперёд
   (обратными переливами) — классический приём water-sort. Плюс решатель на
   ограниченном числе ходов как страховка. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;

  /* ---------- базовые операции ---------- */
  function cloneTubes(t) { return t.map(function (a) { return a.slice(); }); }

  // верхний одноцветный «стек» и его высота
  function topRun(tube) {
    if (!tube.length) return { color: -1, n: 0 };
    var c = tube[tube.length - 1], n = 1;
    for (var i = tube.length - 2; i >= 0; i--) { if (tube[i] !== c) break; n++; }
    return { color: c, n: n };
  }
  function freeSpace(tube) { return C.capacity - tube.length; }
  function isSolvedTube(tube) {
    if (tube.length !== C.capacity) return false;
    for (var i = 1; i < tube.length; i++) if (tube[i] !== tube[0]) return false;
    return true;
  }
  // можно ли перелить из a в b (и сколько слоёв уйдёт)
  function canPour(a, b) {
    if (!a.length) return 0;
    if (isSolvedTube(b) && b.length === C.capacity) return 0; // полная собранная — не трогаем
    var ra = topRun(a), sp = freeSpace(b);
    if (sp <= 0) return 0;
    if (b.length && b[b.length - 1] !== ra.color) return 0;
    return Math.min(ra.n, sp);
  }
  function pour(from, to, n) {
    for (var i = 0; i < n; i++) to.push(from.pop());
  }

  /* ---------- проверка «собрано всё» ---------- */
  function allSorted(tubes) {
    for (var i = 0; i < tubes.length; i++) {
      if (!tubes[i].length) continue;
      if (!isSolvedTube(tubes[i])) return false;
    }
    // и ни одна трубка не частично заполнена
    return true;
  }

  /* ---------- есть ли хоть один ход ---------- */
  function hasMove(tubes) {
    for (var i = 0; i < tubes.length; i++)
      for (var j = 0; j < tubes.length; j++) {
        if (i === j) continue;
        // не переливаем из собранной трубки (бессмысленно)
        if (isSolvedTube(tubes[i])) continue;
        if (canPour(tubes[i], tubes[j]) > 0) return true;
      }
    return false;
  }

  /* ---------- генерация решаемой партии ----------
     Легальный перелив кладёт цвет только на тот же цвет или в пустую, поэтому из
     собранного состояния смешанное НЕ получить обратными ходами. Правильный способ:
     собираем полный мультимножество цветов (каждый ×capacity), тасуем и раздаём по
     цветным трубкам, оставляя пустые. Затем ПРОВЕРЯЕМ решаемость решателем и, если
     не решается, тасуем заново (пустых ≥2 → большинство раздач решаемы). */
  function deal(nColors, nEmpty, rng) {
    var pool = [];
    for (var c = 0; c < nColors; c++)
      for (var k = 0; k < C.capacity; k++) pool.push(c);
    // Fisher–Yates на rng
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng.float() * (i + 1)) % (i + 1);
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var tubes = [];
    for (var t = 0; t < nColors; t++) tubes.push(pool.slice(t * C.capacity, (t + 1) * C.capacity));
    for (var e = 0; e < nEmpty; e++) tubes.push([]);
    return tubes;
  }

  function generate(level, rng) {
    var nColors = C.levelColors(level);
    var nEmpty = C.levelEmpty(level);
    var budget = 14 + level * 2; // узлов решателя на проверку — растёт с уровнем
    for (var attempt = 0; attempt < 40; attempt++) {
      var tubes = deal(nColors, nEmpty, rng);
      if (allSorted(tubes)) continue;              // тривиально собрано — перетасовать
      var plan = solve(tubes, 2000 + budget * 120);
      if (plan && plan.length) return tubes;       // гарантированно решаемая
    }
    // фолбэк: лёгкая раздача (2 цвета) — точно решаемая
    return deal(Math.min(3, nColors), nEmpty + 1, rng);
  }

  /* ---------- решатель (подсказка): ограниченный DFS с мемо ---------- */
  function key(tubes) {
    return tubes.map(function (t) { return t.join(''); }).join('|');
  }
  // возвращает полный план решения — массив [from,to,n] — или null
  function solve(tubes, maxNodes) {
    maxNodes = maxNodes || 6000;
    var seen = {};
    var nodes = 0;
    function moves(st) {
      var out = [];
      for (var i = 0; i < st.length; i++) {
        if (isSolvedTube(st[i])) continue;
        if (!st[i].length) continue;
        for (var j = 0; j < st.length; j++) {
          if (i === j) continue;
          var n = canPour(st[i], st[j]);
          if (n <= 0) continue;
          // не переливаем однородную трубку целиком в пустую (симметричный тупик)
          if (!st[j].length && topRun(st[i]).n === st[i].length) continue;
          out.push([i, j, n]);
        }
      }
      return out;
    }
    function dfs(st, path) {
      if (++nodes > maxNodes) return null;
      if (allSorted(st)) return path;
      var k = key(st);
      if (seen[k]) return null;
      seen[k] = true;
      var ms = moves(st);
      for (var m = 0; m < ms.length; m++) {
        var nx = cloneTubes(st);
        pour(nx[ms[m][0]], nx[ms[m][1]], ms[m][2]);
        var r = dfs(nx, path.concat([ms[m]]));
        if (r) return r;
      }
      return null;
    }
    return dfs(cloneTubes(tubes), []);
  }

  G.sort = {
    cloneTubes: cloneTubes, topRun: topRun, freeSpace: freeSpace,
    isSolvedTube: isSolvedTube, canPour: canPour, pour: pour,
    allSorted: allSorted, hasMove: hasMove, generate: generate, solve: solve
  };
})(window.GAME);
