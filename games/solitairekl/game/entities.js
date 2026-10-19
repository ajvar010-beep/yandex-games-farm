/* game/entities.js — логика «Пасьянса Клондайк»: колода, раскладка, ходы.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};

  /* ---------- Карта ---------- */
  // { suit: 0-3 (♠♥♦♣), rank: 1-13 (A-K), faceUp: bool, id: 's_r' }
  ENT.makeDeck = function () {
    var deck = [];
    for (var s = 0; s < 4; s++) {
      for (var r = 1; r <= 13; r++) {
        deck.push({ suit: s, rank: r, faceUp: false, id: s + '_' + r });
      }
    }
    return deck;
  };

  ENT.shuffleDeck = function (deck, rng) {
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  };

  /* ---------- Раскладка ---------- */
  // Возвращает { stock, waste, tableau[7], foundations[4] }
  ENT.deal = function (deck) {
    var stock = [];
    var tableau = [];
    for (var i = 0; i < 7; i++) tableau.push([]);

    // раздаём 28 карт в tableau
    var idx = 0;
    for (var col = 0; col < 7; col++) {
      for (var row = 0; row <= col; row++) {
        var card = deck[idx++];
        card.faceUp = (row === col); // только верхняя открыта
        tableau[col].push(card);
      }
    }

    // остальные в stock
    while (idx < deck.length) {
      stock.push(deck[idx++]);
    }

    return {
      stock: stock,
      waste: [],
      tableau: tableau,
      foundations: [[], [], [], []]
    };
  };

  /* ---------- Проверка хода ---------- */
  // Карта может пойти в фундамент, если rank = foundation.length + 1 и suit совпадает
  ENT.canToFoundation = function (card, foundation) {
    if (foundation.length === 0) return card.rank === 1;
    var top = foundation[foundation.length - 1];
    return card.suit === top.suit && card.rank === top.rank + 1;
  };

  // Карта может пойти на tableau, если rank = top.rank - 1 и цвет противоположный
  ENT.canToTableau = function (card, tableauCol) {
    if (tableauCol.length === 0) return card.rank === 13; // K на пустую колонку
    var top = tableauCol[tableauCol.length - 1];
    if (!top.faceUp) return false;
    var opposite = (card.suit >= 2) !== (top.suit >= 2); // red vs black
    return opposite && card.rank === top.rank - 1;
  };

  /* ---------- Открыть верхнюю карту tableau ---------- */
  ENT.flipTop = function (tableauCol) {
    if (tableauCol.length > 0 && !tableauCol[tableauCol.length - 1].faceUp) {
      tableauCol[tableauCol.length - 1].faceUp = true;
      return true;
    }
    return false;
  };

  /* ---------- Проверка победы ---------- */
  ENT.isComplete = function (foundations) {
    for (var i = 0; i < 4; i++) {
      if (foundations[i].length !== 13) return false;
    }
    return true;
  };

  /* ---------- Подсказка: найти доступный ход ---------- */
  ENT.findHint = function (state) {
    // 1. Из waste в фундамент
    if (state.waste.length > 0) {
      var card = state.waste[state.waste.length - 1];
      for (var f = 0; f < 4; f++) {
        if (ENT.canToFoundation(card, state.foundations[f])) {
          return { from: 'waste', to: 'foundation_' + f, card: card };
        }
      }
    }
    // 2. Из tableau в фундамент
    for (var t = 0; t < 7; t++) {
      var col = state.tableau[t];
      if (col.length > 0) {
        var card = col[col.length - 1];
        if (card.faceUp) {
          for (var f = 0; f < 4; f++) {
            if (ENT.canToFoundation(card, state.foundations[f])) {
              return { from: 'tableau_' + t, to: 'foundation_' + f, card: card };
            }
          }
        }
      }
    }
    // 3. Из tableau в tableau
    for (var t1 = 0; t1 < 7; t1++) {
      var col1 = state.tableau[t1];
      if (col1.length > 0) {
        var card = col1[col1.length - 1];
        if (card.faceUp) {
          for (var t2 = 0; t2 < 7; t2++) {
            if (t1 === t2) continue;
            if (ENT.canToTableau(card, state.tableau[t2])) {
              return { from: 'tableau_' + t1, to: 'tableau_' + t2, card: card };
            }
          }
        }
      }
    }
    // 4. Из stock в waste
    if (state.stock.length > 0) {
      return { from: 'stock', to: 'waste', card: state.stock[state.stock.length - 1] };
    }
    return null;
  };
})(window.GAME);
