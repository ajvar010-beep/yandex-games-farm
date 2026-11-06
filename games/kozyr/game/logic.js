/* game/logic.js — правила подкидного дурака и ИИ соперников.
   Состояние — плоский объект, любые изменения только через act*().
   Детерминизм: колода тасуется E.Rng(seed), Math.random в логике нет. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;
  var L = {};

  function mk(s, r) { return { s: s, r: r }; }
  L.key = function (c) { return c ? c.s + c.r : ''; };
  L.same = function (a, b) { return !!a && !!b && a.s === b.s && a.r === b.r; };

  function lowestTrump(hand, trump) {
    var best = null;
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      if (c.s !== trump) continue;
      if (!best || c.r < best.r) best = c;
    }
    return best;
  }

  function buildDeck(rng) {
    var deck = [];
    for (var si = 0; si < C.suits.length; si++)
      for (var ri = 0; ri < C.ranks.length; ri++)
        deck.push(mk(C.suits[si], C.ranks[ri]));
    for (var i = deck.length - 1; i > 0; i--) {
      var j = rng.int(0, i), t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }

  /* ---------- создание партии ---------- */
  L.newGame = function (rng, rivalIndex, opts) {
    opts = opts || {};
    var deck = buildDeck(rng);
    var st = {
      rng: rng,
      rival: rivalIndex | 0,
      deck: deck,                 // последняя карта массива — верх колоды
      trumpCard: deck[0],         // нижняя карта = козырь, уйдёт последней
      trump: deck[0].s,
      hands: [[], []],
      table: [],                  // [{a: карта атаки, d: карта отбоя|null}]
      attacker: 0,
      turn: 0,
      phase: 'attack',            // 'attack' | 'defend' | 'over'
      winner: -1,                 // -1 идёт, 0 игрок, 1 соперник, 2 ничья
      rounds: 0,
      takenByPlayer: 0,
      played: [],
      lastEvent: '',
      swapped: false,
      peeks: 0
    };
    for (var k = 0; k < C.handLimit; k++) {
      st.hands[0].push(st.deck.pop());
      st.hands[1].push(st.deck.pop());
    }
    var lo0 = lowestTrump(st.hands[0], st.trump);
    var lo1 = lowestTrump(st.hands[1], st.trump);
    st.attacker = (lo0 && lo1) ? (lo0.r <= lo1.r ? 0 : 1) : (lo1 ? 1 : 0);
    if (opts.playerAttacks != null) st.attacker = opts.playerAttacks ? 0 : 1;
    st.turn = st.attacker;
    st.phase = 'attack';
    L.sortHand(st.hands[0], st.trump);
    L.sortHand(st.hands[1], st.trump);
    return st;
  };

  /* ---------- карты ---------- */
  L.beats = function (def, atk, trump) {
    if (!def || !atk) return false;
    if (def.s === atk.s) return def.r > atk.r;
    return def.s === trump && atk.s !== trump;
  };

  L.sortHand = function (hand, trump) {
    hand.sort(function (a, b) {
      var at = trump && a.s === trump ? 1 : 0, bt = trump && b.s === trump ? 1 : 0;
      if (at !== bt) return at - bt;              // козыри всегда справа
      var sa = C.suits.indexOf(a.s), sb = C.suits.indexOf(b.s);
      if (sa !== sb) return sa - sb;
      return a.r - b.r;
    });
    return hand;
  };

  L.pendingIndex = function (st) {
    for (var i = 0; i < st.table.length; i++) if (!st.table[i].d) return i;
    return -1;
  };

  L.tableRanks = function (st) {
    var m = {};
    for (var i = 0; i < st.table.length; i++) {
      m[st.table[i].a.r] = true;
      if (st.table[i].d) m[st.table[i].d.r] = true;
    }
    return m;
  };

  L.undefended = function (st) {
    var n = 0;
    for (var i = 0; i < st.table.length; i++) if (!st.table[i].d) n++;
    return n;
  };

  /* ---------- легальные ходы ---------- */
  L.legalAttack = function (st, p) {
    if (st.phase !== 'attack' || st.turn !== p) return [];
    if (L.pendingIndex(st) >= 0) return [];
    var hand = st.hands[p];
    if (!hand.length) return [];
    if (st.table.length >= C.maxTable) return [];
    // атак не может быть больше, чем карт в руке защищающегося
    if (st.table.length >= st.hands[1 - p].length) return [];
    if (!st.table.length) return hand.slice();
    var ranks = L.tableRanks(st);
    var out = [];
    for (var i = 0; i < hand.length; i++) if (ranks[hand[i].r]) out.push(hand[i]);
    return out;
  };

  L.legalBeat = function (st, p, card) {
    if (st.phase !== 'defend' || st.turn !== p) return false;
    var pi = L.pendingIndex(st);
    if (pi < 0) return false;
    return L.beats(card, st.table[pi].a, st.trump);
  };

  L.canPass = function (st, p) {
    return st.phase === 'attack' && st.turn === p && L.pendingIndex(st) < 0 && st.table.length > 0;
  };
  L.canTake = function (st, p) {
    return st.phase === 'defend' && st.turn === p && L.pendingIndex(st) >= 0;
  };

  /* ---------- действия ---------- */
  function takeFromHand(st, p, card) {
    var hand = st.hands[p];
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].s === card.s && hand[i].r === card.r) { hand.splice(i, 1); return true; }
    }
    return false;
  }

  function refill(st, first) {
    var order = [first, 1 - first];
    for (var k = 0; k < order.length; k++) {
      var p = order[k];
      while (st.hands[p].length < C.handLimit && st.deck.length) {
        st.hands[p].push(st.deck.pop());
      }
      L.sortHand(st.hands[p], st.trump);
    }
  }

  function finishRound(st, taken) {
    st.rounds++;
    if (taken) {
      refill(st, st.attacker);            // атакующий добирает первым и остаётся атакующим
    } else {
      var oldAttacker = st.attacker;
      refill(st, oldAttacker);
      st.attacker = 1 - oldAttacker;      // отбился — значит, атакует следующим
    }
    st.turn = st.attacker;
    st.phase = 'attack';
    L.sortHand(st.hands[0], st.trump); L.sortHand(st.hands[1], st.trump);
    checkOver(st);
  }

  function checkOver(st) {
    if (st.phase === 'over') return true;
    if (st.deck.length > 0) return false;
    var e0 = st.hands[0].length === 0, e1 = st.hands[1].length === 0;
    if (e0 && e1) { st.winner = 2; st.phase = 'over'; return true; }
    if (e0) { st.winner = 0; st.phase = 'over'; return true; }
    if (e1) { st.winner = 1; st.phase = 'over'; return true; }
    if (st.rounds >= C.maxRounds) { st.winner = 0; st.phase = 'over'; return true; }
    return false;
  }
  L.checkOver = checkOver;

  L.attack = function (st, p, card) {
    var legal = L.legalAttack(st, p);
    var ok = false;
    for (var i = 0; i < legal.length; i++) if (L.same(legal[i], card)) ok = true;
    if (!ok) return false;
    if (!takeFromHand(st, p, card)) return false;
    st.table.push({ a: card, d: null });
    st.played.push(card);
    st.lastEvent = 'attack';
    st.phase = 'defend';
    st.turn = 1 - p;
    checkOver(st);
    return true;
  };

  L.defend = function (st, p, card) {
    if (!L.legalBeat(st, p, card)) return false;
    var pi = L.pendingIndex(st);
    if (!takeFromHand(st, p, card)) return false;
    st.table[pi].d = card;
    st.played.push(card);
    st.lastEvent = 'defend';
    st.phase = 'attack';
    st.turn = st.attacker;
    checkOver(st);
    return true;
  };

  L.take = function (st, p) {
    if (!L.canTake(st, p)) return false;
    if (p === 0) st.takenByPlayer++;
    var cards = [];
    for (var i = 0; i < st.table.length; i++) {
      cards.push(st.table[i].a);
      if (st.table[i].d) cards.push(st.table[i].d);
    }
    st.hands[p] = st.hands[p].concat(cards);
    st.table = [];
    st.lastEvent = 'take';
    L.sortHand(st.hands[p], st.trump);
    finishRound(st, true);
    return true;
  };

  L.pass = function (st, p) {
    if (!L.canPass(st, p)) return false;
    st.table = [];
    st.lastEvent = 'pass';
    finishRound(st, false);
    return true;
  };

  /* ---------- ИИ ---------- */
  function cardCost(c, st) {
    var trump = st.trump;
    if (c.s === trump) return 100 + c.r * 3;   // козырь дорог всегда
    return c.r;                                 // младшая карта дешевле старшей
  }

  function lowestFirst(a, b) { return a.r - b.r; }

  function aiDefend(st, p, rv) {
    var pi = L.pendingIndex(st);
    if (pi < 0) return { type: 'pass' };
    var atk = st.table[pi].a;
    var hand = st.hands[p];
    var cands = [];
    for (var i = 0; i < hand.length; i++) if (L.beats(hand[i], atk, st.trump)) cands.push(hand[i]);
    if (!cands.length) return { type: 'take' };
    cands.sort(function (a, b) { return cardCost(a, st) - cardCost(b, st); });
    var best = cands[0];
    var cost = cardCost(best, st);
    // ИИ с высоким take охотнее возьмёт, чем потратит старший козырь
    var risky = best.s === st.trump && best.r >= 11 && st.deck.length > 4;
    var endgame = st.deck.length === 0;
    var threshold = endgame ? 999 : (60 + rv.take * 90 - rv.thrift * 30);
    // smart: к концу колоды не берёт лишнего — карты на руках дороже козыря
    if (risky && cost > threshold && st.rng.float() < 0.5 + rv.take * 0.5) return { type: 'take' };
    if (!endgame && rv.smart > 0.6 && best.s === st.trump && best.r >= 13 && st.hands[p].length > 4) {
      if (st.rng.float() < rv.take) return { type: 'take' };
    }
    return { type: 'defend', card: best };
  }

  function aiAttack(st, p, rv) {
    var legal = L.legalAttack(st, p);
    if (!legal.length) return { type: 'pass' };

    if (!st.table.length) {
      // первая атака: младшая некозырная, козырь — только если других нет
      var plain = [], trumps = [];
      for (var i = 0; i < legal.length; i++) (legal[i].s === st.trump ? trumps : plain).push(legal[i]);
      var pool = plain.length ? plain : trumps;
      pool.sort(lowestFirst);
      var idx = 0;
      if (pool.length > 1 && rv.aggr > 0.7 && pool[0].r < 10) idx = 1; // злой атакует чуть старше
      return { type: 'attack', card: pool[idx] };
    }

    // подкидывание: только то, что не жалко; козыри — лишь когда колода пуста
    var addable = [];
    for (var j = 0; j < legal.length; j++) {
      if (legal[j].s === st.trump && st.deck.length > 0) continue;
      addable.push(legal[j]);
    }
    if (!addable.length) return { type: 'pass' };

    var defenderLeft = st.hands[1 - p].length;
    var eager = st.rng.float() < rv.aggr || defenderLeft <= 2 || st.deck.length === 0;
    if (!eager) return { type: 'pass' };

    addable.sort(lowestFirst);
    return { type: 'attack', card: addable[0] };
  }

  /* Базовый ИИ «среднего игрока»: именно с ним сравнивается соперник, когда сцену
     гоняет автопилот (запись видео и калибровка). Без него сложность не растёт:
     оба игрока играли бы одной манерой и винрейт всегда был бы 50/50. */
  var BASE_AI = { aggr: 0.45, thrift: 0.45, take: 0.40, smart: 0.45 };

  /* Случайный легальный ход — «ошибка» слабого соперника. Ход всё равно по правилам,
     поэтому партия не ломается, но сила игры падает ровно на mistake-процент. */
  function randomLegal(st, p) {
    if (st.phase === 'defend') {
      var pi = L.pendingIndex(st);
      if (pi < 0) return null;
      var atk = st.table[pi].a, can = [];
      for (var i = 0; i < st.hands[p].length; i++)
        if (L.beats(st.hands[p][i], atk, st.trump)) can.push(st.hands[p][i]);
      can.push(null);                                  // null = взять
      var pick = can[Math.floor(st.rng.float() * can.length)];
      return pick ? { type: 'defend', card: pick } : { type: 'take' };
    }
    var legal = L.legalAttack(st, p);
    if (!legal.length) return st.table.length ? { type: 'pass' } : null;
    if (st.table.length && st.rng.float() < 0.35) return { type: 'pass' };
    return { type: 'attack', card: legal[Math.floor(st.rng.float() * legal.length)] };
  }

  L.aiAct = function (st) {
    var p = st.turn;
    var rv = (p === 1) ? (C.rivals[st.rival] || C.rivals[0]) : BASE_AI;
    if (p === 1 && rv.mistake > 0 && st.rng.float() < rv.mistake) {
      var bad = randomLegal(st, p);
      if (bad) return bad;
    }
    if (st.phase === 'defend') return aiDefend(st, p, rv);
    if (st.phase === 'attack') return aiAttack(st, p, rv);
    return { type: 'pass' };
  };

  /* ---------- помощники для сцены ---------- */
  L.hintCards = function (st) {
    // карты, которыми игрок может отбить висящую атаку (для перка «Подсказка»)
    var pi = L.pendingIndex(st);
    if (pi < 0 || st.phase !== 'defend' || st.turn !== 0) return [];
    var atk = st.table[pi].a, out = [];
    for (var i = 0; i < st.hands[0].length; i++)
      if (L.beats(st.hands[0][i], atk, st.trump)) out.push(st.hands[0][i]);
    return out;
  };

  L.legalAttackFor = function (st) { return L.legalAttack(st, 0); };

  L.canPlayerAttack = function (st, card) {
    var legal = L.legalAttackFor(st);
    for (var i = 0; i < legal.length; i++) if (L.same(legal[i], card)) return true;
    return false;
  };

  G.logic = L;
})(window.GAME);
