/* game/logic.js — чистая логика «Домино-Цепи»: колода, цепь с двумя открытыми концами,
   рука, базар, очки, магазин. Никакого DOM и никаких таймеров: сцена только рисует и
   превращает события в звук/анимацию. Весь случайный выбор идёт через st.rng (E.Rng). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;
  var L = {};

  L.LEVELS = C.levels.length;

  /* Запасной ГПСЧ только для офлайн-проверок логики в node (в игре всегда E.Rng). */
  function fallbackRng() {
    var a = 1234567;
    return {
      float: function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
    };
  }
  L.fallbackRng = fallbackRng;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  L.levelDef = function (n) {
    return C.levels[clamp((n | 0) || 1, 1, C.levels.length) - 1];
  };

  /* ---------- колода «дубль-шесть» ---------- */
  L.fullDeck = function () {
    var out = [], id = 0;
    for (var a = 0; a <= C.deck.max; a++) {
      for (var b = a; b <= C.deck.max; b++) out.push({ id: ++id, a: a, b: b });
    }
    return out;
  };

  /* Фишер—Йетс на E.Rng — Math.random в логике запрещён. */
  L.shuffle = function (arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng.float() * (i + 1)) % (i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  function sameTile(t, a, b) {
    return (t.a === a && t.b === b) || (t.a === b && t.b === a);
  }

  /* ---------- новый уровень ---------- */
  L.newLevel = function (o) {
    o = o || {};
    var level = clamp((o.level | 0) || 1, 1, C.levels.length);
    var def = L.levelDef(level);
    var rng = o.rng || fallbackRng();
    var deck = L.shuffle(L.fullDeck(), rng);

    // стартовая кость центра цепи — из колоды, с заданной ориентацией
    var sa = def.start[0], sb = def.start[1];
    var si = -1;
    for (var i = 0; i < deck.length; i++) if (sameTile(deck[i], sa, sb)) { si = i; break; }
    var start = si >= 0 ? deck.splice(si, 1)[0] : { id: 99, a: sa, b: sb };
    start.a = sa; start.b = sb; start.innerL = sa; start.innerR = sb;

    var hand = [];
    var nHand = clamp(def.hand, 3, C.hand.max);
    for (i = 0; i < nHand && deck.length; i++) hand.push(deck.shift());

    var st = {
      level: level,
      goal: def.goal,
      handBase: nHand,
      hearts: C.hearts,
      heartsMax: C.hearts,
      draws: def.draws,
      drawsStart: def.draws,
      start: start,
      left: [],               // кости левее центра: [0] — ближайшая к центру
      right: [],              // кости правее центра
      caps: { left: 99, right: 99 }, // ёмкость сторон по слотам пути (ставит сцена)
      ends: { left: sa, right: sb },
      hand: hand,
      stock: deck,            // базар (закрытая стопка)
      placed: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      doubles: 0,
      wrongs: 0,
      coins: (o.coins | 0) || 0,
      doubled: false,
      buys: { draw: 0, shuffle: 0, double: 0 },
      phase: 'play',          // play | win | over
      recordSafe: !!o.recordSafe,
      rng: rng,
      events: [],
      t: 0
    };
    /* Стартовая рука обязана иметь хотя бы один ход: иначе первый экран
       выглядит «мёртвым» и новичок не понимает, что делать. Добираем молча,
       жетоны за это не тратятся. */
    var maxHand = C.hand.max;
    for (var guard = 0; guard < 40; guard++) {
      if (L.playable(st).length || !st.stock.length) break;
      if (st.hand.length < maxHand) {
        st.hand.push(st.stock.shift());
      } else {
        // рука полна: меняем одну кость на подходящую из колоды, иначе уровня не начать
        var swap = -1;
        for (var si2 = 0; si2 < st.stock.length; si2++) {
          var tt = st.stock[si2];
          var sd = L.sides(st, tt);
          if ((sd.left && st.left.length < st.caps.left) || (sd.right && st.right.length < st.caps.right)) { swap = si2; break; }
        }
        if (swap < 0) break;
        var oldT = st.hand[st.hand.length - 1];
        st.hand[st.hand.length - 1] = st.stock.splice(swap, 1)[0];
        st.stock.push(oldT);
      }
    }
    return st;
  };

  /* ---------- совместимость ---------- */
  /* Возвращает {left:bool, right:bool} — к каким концам подходит кость. */
  L.sides = function (st, tile) {
    return {
      left: (tile.a === st.ends.left || tile.b === st.ends.left),
      right: (tile.a === st.ends.right || tile.b === st.ends.right)
    };
  };

  L.canPlay = function (st, tile) {
    var s = L.sides(st, tile);
    return s.left || s.right;
  };

  L.playable = function (st) {
    var out = [];
    for (var i = 0; i < st.hand.length; i++) {
      var s = L.sides(st, st.hand[i]);
      var l = s.left && st.left.length < st.caps.left;
      var r = s.right && st.right.length < st.caps.right;
      if (l || r) out.push({ tile: st.hand[i], index: i, left: l, right: r });
    }
    return out;
  };

  L.blocked = function (st) {
    if (st.phase !== 'play') return false;
    return L.playable(st).length === 0;
  };

  /* Спасение из тупика: рука возвращается в колоду, тасуется и раздаётся заново.
     Бесплатный шанс на уровень; если хода всё равно нет — честное поражение. */
  L.rescue = function (st) {
    if (!st || st.phase !== 'play') return false;
    st.stock = st.stock.concat(st.hand || []);
    st.hand = [];
    L.shuffle(st.stock, st.rng);
    var maxHand = C.hand.max;
    while (st.hand.length < maxHand && st.stock.length) st.hand.push(st.stock.shift());
    for (var guard = 0; guard < 40; guard++) {
      if (L.playable(st).length || !st.stock.length) break;
      if (st.hand.length < maxHand) {
        st.hand.push(st.stock.shift());
      } else {
        var swap = -1;
        for (var si = 0; si < st.stock.length; si++) {
          var sd = L.sides(st, st.stock[si]);
          if ((sd.left && st.left.length < st.caps.left) || (sd.right && st.right.length < st.caps.right)) { swap = si; break; }
        }
        if (swap < 0) break;
        var oldT = st.hand[st.hand.length - 1];
        st.hand[st.hand.length - 1] = st.stock.splice(swap, 1)[0];
        st.stock.push(oldT);
      }
    }
    return L.playable(st).length > 0;
  };

  L.stuck = function (st) {
    return L.blocked(st) && st.stock.length === 0;
  };

  /* ---------- ход ---------- */
  /* side: 'left' | 'right'. Возвращает запись о ходе или null. */
  L.play = function (st, tileId, side) {
    if (st.phase !== 'play') return null;
    var idx = -1;
    for (var i = 0; i < st.hand.length; i++) if (st.hand[i].id === tileId) { idx = i; break; }
    if (idx < 0) return null;
    var tile = st.hand[idx];
    if (side === 'left' && st.left.length >= st.caps.left) return null;
    if (side === 'right' && st.right.length >= st.caps.right) return null;
    var end = st.ends[side];
    if (end == null) return null;
    var inner, outer;
    if (tile.a === end) { inner = tile.a; outer = tile.b; }
    else if (tile.b === end) { inner = tile.b; outer = tile.a; }
    else return null;

    st.hand.splice(idx, 1);
    var rec = { tile: tile, side: side, inner: inner, outer: outer, index: st.placed };
    if (side === 'left') st.left.unshift(rec); else st.right.push(rec);
    st.ends[side] = outer;
    st.placed++;

    var sc = C.scoring;
    var mult = 1 + Math.min(st.combo, sc.comboCap) * sc.comboStep;
    var pts = Math.round((sc.base + tile.a + tile.b) * sc.per * mult);
    var isDouble = (tile.a === tile.b);
    if (isDouble) pts += Math.round(sc.doubleBonus * mult);
    if (st.doubled) { pts *= 2; st.doubled = false; rec.doubled = true; }
    st.score += pts;
    rec.pts = pts;

    var gain = C.economy.perTile + (isDouble ? C.economy.doubleCoin : 0);
    st.coins += gain;
    rec.coin = gain;

    st.combo++;
    if (st.combo > st.bestCombo) st.bestCombo = st.combo;
    if (isDouble) {
      st.doubles++;
      st.draws++;                       // дубль в цепи — бесплатный жетон добора
      rec.draw = true;
    }
    st.events.push({ type: 'place', rec: rec, double: isDouble, gain: gain, pts: pts });
    L.checkEnd(st);
    return rec;
  };

  L.wrongTap = function (st, tileId) {
    if (st.phase !== 'play') return false;
    st.wrongs++;
    st.combo = 0;
    var pen = Math.min(st.score, C.scoring.wrongPenalty);
    st.score -= pen;
    var lost = false;
    if (!st.recordSafe) {
      st.hearts--;
      lost = true;
      if (st.hearts <= 0) { st.hearts = 0; st.phase = 'over'; }
    }
    st.events.push({ type: 'wrong', tileId: tileId, pen: pen, lost: lost });
    if (st.phase === 'over') st.events.push({ type: 'over' });
    return true;
  };

  /* Добор из базара. Жетон тратится, если он есть; без жетонов — цена в сердце. */
  L.draw = function (st) {
    if (st.phase !== 'play') return 'phase';
    if (st.hand.length >= C.hand.max) return 'full';
    if (!st.stock.length) return 'empty';
    var free = st.draws > 0;
    if (free) {
      st.draws--;
    } else if (!st.recordSafe) {
      st.hearts--;
      if (st.hearts <= 0) {
        st.hearts = 0;
        st.phase = 'over';
        st.events.push({ type: 'mercy', free: false });
        st.events.push({ type: 'over' });
        return 'over';
      }
      st.events.push({ type: 'mercy', free: false });
    } else {
      st.events.push({ type: 'mercy', free: true });
    }
    var tile = st.stock.shift();
    st.hand.push(tile);
    st.events.push({ type: 'draw', tile: tile, free: free });
    return 'ok';
  };

  /* Обмен руки: кости возвращаются в базар, базар перемешивается, рука берётся заново. */
  L.reshuffle = function (st) {
    if (st.phase !== 'play') return false;
    var n = st.hand.length;
    for (var i = 0; i < st.hand.length; i++) st.stock.push(st.hand[i]);
    st.hand = [];
    L.shuffle(st.stock, st.rng);
    var take = Math.min(n, st.stock.length);
    for (var j = 0; j < take; j++) st.hand.push(st.stock.shift());
    st.combo = 0;
    st.events.push({ type: 'reshuffle' });
    return true;
  };

  /* ---------- магазин ---------- */
  L.shopItem = function (id) {
    for (var i = 0; i < C.shop.length; i++) if (C.shop[i].id === id) return C.shop[i];
    return null;
  };

  L.shopPrice = function (st, id) {
    var it = L.shopItem(id);
    if (!it) return 0;
    return it.base + it.step * (st.buys[id] | 0);
  };

  L.buy = function (st, id) {
    var it = L.shopItem(id);
    if (!it || st.phase !== 'play') return 'none';
    var price = L.shopPrice(st, id);
    if (st.coins < price) return 'coins';
    st.coins -= price;
    st.buys[id] = (st.buys[id] | 0) + 1;
    if (id === 'draw') st.draws += it.add;
    else if (id === 'shuffle') L.reshuffle(st);
    else if (id === 'double') st.doubled = true;
    st.events.push({ type: 'buy', id: id, price: price });
    return 'ok';
  };

  /* ---------- конец уровня ---------- */
  L.checkEnd = function (st) {
    if (st.phase !== 'play') return;
    if (st.placed >= st.goal || (st.hand.length === 0 && st.stock.length === 0)) {
      st.phase = 'win';
      st.handEmpty = st.hand.length === 0;
      st.events.push({ type: 'win' });
    }
  };

  L.reward = function (st) {
    var e = C.economy;
    var r = e.levelBase + e.levelStep * st.level;
    if (st.handEmpty) r += e.handEmpty;
    return r;
  };

  /* ---------- автопилот / сборка кадра ---------- */
  /* Жадный, но с заглядыванием: очки кости + сколько оставшихся костей поддержат
     новый конец цепи. Так цепь не загоняет себя в тупик. */
  L.autoMove = function (st) {
    var opts = L.playable(st);
    if (!opts.length) return null;
    var best = null;
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i], t = o.tile;
      var sides = [];
      if (o.left) sides.push('left');
      if (o.right) sides.push('right');
      for (var s = 0; s < sides.length; s++) {
        var side = sides[s];
        var end = st.ends[side];
        var outer = (t.a === end) ? t.b : t.a;
        var support = 0;
        for (var j = 0; j < st.hand.length; j++) {
          if (st.hand[j].id === t.id) continue;
          if (st.hand[j].a === outer || st.hand[j].b === outer) support++;
        }
        var val = (t.a + t.b) * 1.0 + support * 1.35 + (t.a === t.b ? 1.5 : 0);
        if (!best || val > best.val) best = { tileId: t.id, side: side, val: val };
      }
    }
    return best;
  };

  /* Быстрый ход целиком (для кадра/видео): ставит кость, иначе добирает. */
  L.autoStep = function (st) {
    if (st.phase !== 'play') return 'phase';
    var m = L.autoMove(st);
    if (m) return L.play(st, m.tileId, m.side) ? 'place' : 'none';
    return L.draw(st);
  };

  L.takeEvents = function (st) {
    var e = st.events;
    st.events = [];
    return e;
  };

  /* Прокрутить n ходов автопилота (кадры freeze / быстрый тест баланса). */
  L.simulate = function (st, n) {
    for (var i = 0; i < n && st.phase === 'play'; i++) L.autoStep(st);
    return st;
  };

  G.logic = L;
})(window.GAME);
