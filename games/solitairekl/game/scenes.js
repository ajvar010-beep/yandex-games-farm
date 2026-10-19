/* game/scenes.js — сцены «Пасьянса Клондайк»: меню, игра, лавка, пауза, fail.
   Механика: тап по карте → выбор, тап по цели → ход. Цель: собрать 4 фундамента.
   Бустеры: hint (показать ход), undo (отменить). Без RV-revive (сложно для пасьянса).
   КРИТИЧНО: диспетчер ввода в update для ВСЕХ режимов. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var SC = {};

  /* ==================== MenuScene ==================== */
  SC.menu = {
    name: 'menu',
    enter: function (game) {
      this.game = game;
      var E = window.Engine;
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.t = 0;
      this.buttons = [];
      this.buildButtons(game);
    },
    buildButtons: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      var cx = w / 2;
      var bw = Math.min(280, w * 0.6), bh = 52;
      var y0 = h * 0.42;
      var gap = 14;

      this.buttons = [];
      var hasSave = E.storage.get('solitairekl_run');
      if (hasSave) {
        this.buttons.push({ id: 'cont', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_cont') });
        y0 += bh + gap;
      }
      this.buttons.push({ id: 'play', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_play') });
      y0 += bh + gap;
      this.buttons.push({ id: 'snd', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_snd') + ': ' + (E.audio.muted ? 'OFF' : 'ON') });
      y0 += bh + gap;
      this.buttons.push({ id: 'lang', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_lang') });
      y0 += bh + gap;
      if (E.sdk.authSupported) {
        this.buttons.push({ id: 'auth', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_auth') });
      }
    },
    update: function (game, dt) {
      this.t += dt;
      var E = window.Engine;
      if (E.input.pointer.pressed) {
        this.handleTap(E.input.pointer.x, E.input.pointer.y);
      }
    },
    handleTap: function (x, y) {
      var E = window.Engine;
      for (var i = 0; i < this.buttons.length; i++) {
        var b = this.buttons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          E.audio.sfx('click');
          this.handleButton(b.id);
          return;
        }
      }
    },
    draw: function (game, ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      G.art.drawBackground(ctx, w, h, this.t);

      // демо-карты
      var cx = w / 2, cy = h * 0.22;
      var size = Math.min(50, w * 0.1);
      var cards = [
        { suit: 0, rank: 1, faceUp: true },
        { suit: 1, rank: 13, faceUp: true },
        { suit: 2, rank: 12, faceUp: true },
        { suit: 3, rank: 11, faceUp: true }
      ];
      for (var i = 0; i < 4; i++) {
        var bob = Math.sin(this.t * 2 + i) * 3;
        G.art.drawCard(ctx, cx + (i - 1.5) * (size + 8), cy + bob, size, size * 1.4, cards[i], 'idle', this.t);
      }

      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = Math.min(40, w * 0.07);
      ctx.font = '800 ' + size + 'px Georgia, serif';
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(13,31,15,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(E.i18n.t('title'), cx, cy + 100);
      var tg = ctx.createLinearGradient(0, cy + 100 - size / 2, 0, cy + 100 + size / 2);
      tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, P.accent);
      ctx.fillStyle = tg; ctx.fillText(E.i18n.t('title'), cx, cy + 100);

      // кнопки
      for (var i = 0; i < this.buttons.length; i++) {
        var b = this.buttons[i];
        this.drawButton(ctx, b);
      }
    },
    drawButton: function (ctx, b) {
      var E = window.Engine;
      var P = G.config.palette;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = P.text;
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2);
    },
    handleButton: function (id) {
      var E = window.Engine;
      if (id === 'play') {
        E.storage.remove('solitairekl_run');
        E.core.setScene(SC.play, { level: 1 });
      } else if (id === 'cont') {
        var run = E.storage.get('solitairekl_run');
        E.core.setScene(SC.play, { level: run ? run.level : 1, coins: run ? run.coins : 0 });
      } else if (id === 'snd') {
        E.audio.toggleMute();
        this.buildButtons(this.game);
      } else if (id === 'lang') {
        E.i18n.setLang(E.i18n.lang === 'ru' ? 'en' : 'ru');
        this.buildButtons(this.game);
      } else if (id === 'auth') {
        E.sdk.auth();
      }
    },
    getCaptureState: function () {
      return { scene: 'menu' };
    }
  };

  /* ==================== PlayScene ==================== */
  SC.play = {
    name: 'play',
    enter: function (game, opts) {
      this.game = game;
      var E = window.Engine;
      opts = opts || {};
      this.level = opts.level || 1;
      this.coins = opts.coins !== undefined ? opts.coins : (E.storage.get('solitairekl_coins') || G.config.economy.startCoins);
      this.score = opts.score || 0;
      this.mode = 'running'; // running | shop | over | paused | fail
      this.t = 0;
      this.history = [];
      this.flashMsg = null;
      this.flashTimer = 0;
      this.tutorialStep = E.storage.get('solitairekl_tutorial') ? 3 : 0;
      this.tutorialTimer = 0;
      this.selected = null; // { from, card, source }
      this.hintMove = null;
      this.hintTimer = 0;

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!opts.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;

      E.audio.music('play');
      E.sdk.gameplayStart();
      E.sdk.hideBanner();

      this.startLevel(this.level);
      this.layout(game);
      this.applyCaptureParams(opts);
    },

    startLevel: function (lv) {
      var E = window.Engine;
      this.level = lv;
      this.rng = new E.Rng((E.core.seed || 1) ^ (lv * 7919));
      var deck = G.entities.makeDeck();
      G.entities.shuffleDeck(deck, this.rng.float.bind(this.rng));
      this.state = G.entities.deal(deck);
      this.score = 0;
      this.history = [];
      this.selected = null;
      this.hintMove = null;
      this.mode = 'running';
    },

    layout: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      var hudH = 60;
      var cardW = Math.min(60, (w - 80) / 8);
      var cardH = cardW * 1.4;
      var gap = 10;

      this.hudH = hudH;
      this.cardW = cardW;
      this.cardH = cardH;
      this.gap = gap;

      // верхний ряд: stock, waste, foundations
      this.stockPos = { x: 20, y: hudH + 10 };
      this.wastePos = { x: 20 + cardW + gap, y: hudH + 10 };
      this.foundationPos = [];
      for (var i = 0; i < 4; i++) {
        this.foundationPos.push({ x: w - 20 - (4 - i) * (cardW + gap), y: hudH + 10 });
      }

      // tableau
      this.tableauPos = [];
      var tableauY = hudH + 20 + cardH;
      for (var i = 0; i < 7; i++) {
        this.tableauPos.push({ x: 20 + i * (cardW + gap), y: tableauY });
      }

      this.shopButtons = [];
      this.pauseButtons = [];
      this.overButtons = [];
      this.failButtons = [];
    },

    /* ---------- диспетчер ввода для ВСЕХ режимов ---------- */
    update: function (game, dt) {
      this.t += dt;
      var E = window.Engine;
      E.capture.tickRecording(dt);

      if (E.input.pointer.pressed) {
        this.handleTap(E.input.pointer.x, E.input.pointer.y);
      }

      if (this.mode === 'running') {
        if (this.hintTimer > 0) {
          this.hintTimer -= dt;
          if (this.hintTimer <= 0) this.hintMove = null;
        }
        if (this.tutorialStep < 3) {
          this.tutorialTimer += dt;
          if (this.tutorialTimer > 4) {
            this.tutorialStep++;
            this.tutorialTimer = 0;
            if (this.tutorialStep >= 3) E.storage.set('sudokulite_tutorial', true);
          }
        }
        // автопилот для записи видео
        if (this.autopilot) this.driveAutopilot(dt);
      }
      if (this.flashTimer > 0) {
        this.flashTimer -= dt;
        if (this.flashTimer <= 0) this.flashMsg = null;
      }
    },

    /* ---------- единый обработчик тапа ---------- */
    handleTap: function (x, y) {
      var E = window.Engine;

      // диспетч по режиму
      if (this.mode === 'shop') { this.handleShopTap(x, y); return; }
      if (this.mode === 'over') { this.handleOverTap(x, y); return; }
      if (this.mode === 'fail') { this.handleFailTap(x, y); return; }
      if (this.mode === 'paused') { this.handlePauseTap(x, y); return; }
      if (this.mode !== 'running') return;

      // HUD: пауза и лавка
      if (y < this.hudH) {
        if (x > this.game.view.w - 70 && x < this.game.view.w - 40) { this.mode = 'paused'; E.audio.sfx('click'); return; }
        if (x > this.game.view.w - 30) { this.mode = 'shop'; E.audio.sfx('click'); return; }
        return;
      }

      // stock → waste
      if (x >= this.stockPos.x && x < this.stockPos.x + this.cardW &&
          y >= this.stockPos.y && y < this.stockPos.y + this.cardH) {
        this.drawFromStock();
        return;
      }

      // waste → выбор
      if (x >= this.wastePos.x && x < this.wastePos.x + this.cardW &&
          y >= this.wastePos.y && y < this.wastePos.y + this.cardH) {
        if (this.state.waste.length > 0) {
          var card = this.state.waste[this.state.waste.length - 1];
          this.selectCard('waste', card);
        }
        return;
      }

      // foundations → выбор или цель
      for (var i = 0; i < 4; i++) {
        var fp = this.foundationPos[i];
        if (x >= fp.x && x < fp.x + this.cardW && y >= fp.y && y < fp.y + this.cardH) {
          if (this.selected) {
            this.tryMoveToFoundation(i);
          }
          return;
        }
      }

      // tableau → выбор или цель
      for (var i = 0; i < 7; i++) {
        var tp = this.tableauPos[i];
        var col = this.state.tableau[i];
        var colH = col.length > 0 ? this.cardH + (col.length - 1) * 20 : this.cardH;
        if (x >= tp.x && x < tp.x + this.cardW && y >= tp.y && y < tp.y + colH) {
          if (this.selected) {
            this.tryMoveToTableau(i);
          } else if (col.length > 0 && col[col.length - 1].faceUp) {
            this.selectCard('tableau_' + i, col[col.length - 1]);
          }
          return;
        }
      }

      // клик в пустоту — снять выбор
      this.selected = null;
    },

    selectCard: function (source, card) {
      this.selected = { source: source, card: card };
      window.Engine.audio.sfx('click');
    },

    drawFromStock: function () {
      var E = window.Engine;
      if (this.state.stock.length === 0) {
        // перевернуть waste обратно в stock
        if (this.state.waste.length > 0) {
          this.state.stock = this.state.waste.reverse();
          this.state.waste = [];
          E.audio.sfx('click');
        }
        return;
      }
      var card = this.state.stock.pop();
      card.faceUp = true;
      this.state.waste.push(card);
      E.audio.sfx('click');

      // проверка тупика
      if (!G.entities.findHint(this.state)) {
        this.showFlash(E.i18n.t('no_moves'));
      }
    },

    tryMoveToFoundation: function (f) {
      var E = window.Engine;
      var card = this.selected.card;
      if (!G.entities.canToFoundation(card, this.state.foundations[f])) {
        E.audio.sfx('deny');
        this.selected = null;
        return;
      }

      // сохраняем историю
      this.history.push(this.snapshot());

      // убираем из источника
      this.removeFromSource(this.selected.source);
      // кладём в фундамент
      this.state.foundations[f].push(card);
      this.selected = null;
      this.score += 10;
      this.coins += 2;
      E.audio.sfx('wave');
      E.fx.flash(G.config.palette.good, 0.2);

      // проверка победы
      if (G.entities.isComplete(this.state.foundations)) {
        this.completeLevel();
      }
    },

    tryMoveToTableau: function (t) {
      var E = window.Engine;
      var card = this.selected.card;
      if (!G.entities.canToTableau(card, this.state.tableau[t])) {
        E.audio.sfx('deny');
        this.selected = null;
        return;
      }

      // сохраняем историю
      this.history.push(this.snapshot());

      // убираем из источника
      var src = this.selected.source;
      this.removeFromSource(src);
      // кладём в tableau
      this.state.tableau[t].push(card);
      this.selected = null;
      this.score += 5;
      E.audio.sfx('click');

      // открываем верхнюю карту источника, если она закрыта
      var srcParts = src.split('_');
      if (srcParts[0] === 'tableau') {
        var srcCol = parseInt(srcParts[1]);
        G.entities.flipTop(this.state.tableau[srcCol]);
      }
    },

    removeFromSource: function (source) {
      if (source === 'waste') {
        this.state.waste.pop();
      } else if (source.indexOf('tableau_') === 0) {
        var col = parseInt(source.split('_')[1]);
        this.state.tableau[col].pop();
      }
    },

    snapshot: function () {
      return {
        stock: this.state.stock.slice(),
        waste: this.state.waste.slice(),
        tableau: this.state.tableau.map(function (col) { return col.slice(); }),
        foundations: this.state.foundations.map(function (f) { return f.slice(); }),
        score: this.score,
        coins: this.coins
      };
    },

    undo: function () {
      if (this.history.length === 0) return false;
      var snap = this.history.pop();
      this.state.stock = snap.stock;
      this.state.waste = snap.waste;
      this.state.tableau = snap.tableau;
      this.state.foundations = snap.foundations;
      this.score = snap.score;
      this.coins = snap.coins;
      return true;
    },

    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.5;
      if (this.mode !== 'running') return;

      var hint = G.entities.findHint(this.state);
      if (!hint) {
        this.failLevel();
        return;
      }

      if (hint.from === 'stock') {
        this.drawFromStock();
      } else if (hint.from === 'waste') {
        this.selectCard('waste', hint.card);
        if (hint.to.indexOf('foundation_') === 0) {
          this.tryMoveToFoundation(parseInt(hint.to.split('_')[1]));
        }
      } else if (hint.from.indexOf('tableau_') === 0) {
        var src = parseInt(hint.from.split('_')[1]);
        this.selectCard('tableau_' + src, hint.card);
        if (hint.to.indexOf('foundation_') === 0) {
          this.tryMoveToFoundation(parseInt(hint.to.split('_')[1]));
        } else if (hint.to.indexOf('tableau_') === 0) {
          this.tryMoveToTableau(parseInt(hint.to.split('_')[1]));
        }
      }
    },

    draw: function (game, ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      G.art.drawBackground(ctx, w, h, this.t);

      // HUD
      this.drawHUD(ctx);

      // stock
      ctx.fillStyle = P.cell;
      ctx.beginPath();
      E.ui.roundRect(ctx, this.stockPos.x, this.stockPos.y, this.cardW, this.cardH, 6);
      ctx.fill();
      if (this.state.stock.length > 0) {
        G.art.drawCard(ctx, this.stockPos.x, this.stockPos.y, this.cardW, this.cardH, null, 'back', this.t);
      }

      // waste
      ctx.fillStyle = P.cell;
      ctx.beginPath();
      E.ui.roundRect(ctx, this.wastePos.x, this.wastePos.y, this.cardW, this.cardH, 6);
      ctx.fill();
      if (this.state.waste.length > 0) {
        var card = this.state.waste[this.state.waste.length - 1];
        var state = (this.selected && this.selected.source === 'waste') ? 'sel' : 'idle';
        G.art.drawCard(ctx, this.wastePos.x, this.wastePos.y, this.cardW, this.cardH, card, state, this.t);
      }

      // foundations
      for (var i = 0; i < 4; i++) {
        var fp = this.foundationPos[i];
        ctx.fillStyle = P.cell;
        ctx.beginPath();
        E.ui.roundRect(ctx, fp.x, fp.y, this.cardW, this.cardH, 6);
        ctx.fill();
        ctx.strokeStyle = P.panelBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (this.state.foundations[i].length > 0) {
          var card = this.state.foundations[i][this.state.foundations[i].length - 1];
          G.art.drawCard(ctx, fp.x, fp.y, this.cardW, this.cardH, card, 'idle', this.t);
        }
      }

      // tableau
      for (var i = 0; i < 7; i++) {
        var tp = this.tableauPos[i];
        var col = this.state.tableau[i];
        for (var j = 0; j < col.length; j++) {
          var card = col[j];
          var y = tp.y + j * 20;
          var state = 'idle';
          if (this.selected && this.selected.source === 'tableau_' + i && j === col.length - 1) state = 'sel';
          if (this.hintMove && this.hintMove.from === 'tableau_' + i && j === col.length - 1) state = 'hint';
          G.art.drawCard(ctx, tp.x, y, this.cardW, this.cardH, card, state, this.t);
        }
      }

      // туториал
      if (this.tutorialStep < 3) {
        this.drawTutorial(ctx);
      }

      // flash-сообщение
      if (this.flashMsg) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.flashTimer * 2);
        ctx.fillStyle = P.bad;
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.flashMsg, w / 2, this.hudH + 40);
        ctx.restore();
      }

      // оверлеи
      if (this.mode === 'shop') this.drawShop(ctx);
      else if (this.mode === 'over') this.drawOver(ctx);
      else if (this.mode === 'paused') this.drawPause(ctx);
      else if (this.mode === 'fail') this.drawFail(ctx);
    },

    drawHUD: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w;
      var P = G.config.palette;

      ctx.fillStyle = P.panel;
      ctx.fillRect(0, 0, w, this.hudH);
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, this.hudH); ctx.lineTo(w, this.hudH); ctx.stroke();

      ctx.textBaseline = 'middle';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = P.text;
      ctx.textAlign = 'left';
      ctx.fillText(E.i18n.t('hud_level', { n: this.level }), 12, 20);

      ctx.fillStyle = P.coin;
      ctx.textAlign = 'right';
      ctx.fillText(this.coins + ' ✨', w - 12, 20);

      // кнопки
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = P.dim;
      ctx.textAlign = 'right';
      ctx.fillText('⏸', w - 60, 44);
      ctx.fillText('🛒', w - 20, 44);
    },

    drawTutorial: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;
      var msgs = [E.i18n.t('tutorial_1'), E.i18n.t('tutorial_2'), E.i18n.t('tutorial_3')];
      var msg = msgs[this.tutorialStep];

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 2;
      var bw = Math.min(360, w - 40), bh = 60;
      var bx = (w - bw) / 2, by = h - bh - 20;
      ctx.beginPath();
      E.ui.roundRect(ctx, bx, by, bw, bh, 12);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.text;
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(msg, w / 2, by + bh / 2);
      ctx.restore();
    },

    drawShop: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;
      var C = G.config.economy;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);

      var bw = Math.min(300, w - 40), bh = 220;
      var bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      E.ui.roundRect(ctx, bx, by, bw, bh, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = P.text;
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(E.i18n.t('shop_title'), w / 2, by + 36);

      var items = [
        { id: 'hint', name: E.i18n.t('item_hint'), desc: E.i18n.t('item_hint_desc'), price: C.hintPrice },
        { id: 'undo', name: E.i18n.t('item_undo'), desc: E.i18n.t('item_undo_desc'), price: C.undoPrice }
      ];

      this.shopButtons = [];
      var iy = by + 70;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var btn = { id: it.id, x: bx + 20, y: iy, w: bw - 40, h: 56, price: it.price };
        this.shopButtons.push(btn);

        ctx.fillStyle = this.coins >= it.price ? P.cell : '#1a2a24';
        ctx.strokeStyle = P.panelBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        E.ui.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = this.coins >= it.price ? P.text : P.dim;
        ctx.font = '600 16px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(it.name, btn.x + 12, btn.y + 20);
        ctx.font = '400 12px system-ui, sans-serif';
        ctx.fillStyle = P.dim;
        ctx.fillText(it.desc, btn.x + 12, btn.y + 40);
        ctx.fillStyle = P.coin;
        ctx.font = '700 16px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(it.price + ' ✨', btn.x + btn.w - 12, btn.y + 28);
        iy += 66;
      }

      // закрыть
      var closeBtn = { id: 'close', x: bx + 20, y: iy + 10, w: bw - 40, h: 44 };
      this.shopButtons.push(closeBtn);
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.dim;
      ctx.beginPath();
      E.ui.roundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.dim;
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText(E.i18n.t('shop_close'), w / 2, closeBtn.y + 22);
    },

    drawOver: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);

      var bw = Math.min(320, w - 40), bh = 240;
      var bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      E.ui.roundRect(ctx, bx, by, bw, bh, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = P.good;
      ctx.font = '700 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(E.i18n.t('win_title'), w / 2, by + 50);

      ctx.fillStyle = P.coin;
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText(E.i18n.t('win_reward', { n: this.lastReward || 0 }), w / 2, by + 100);

      this.overButtons = [
        { id: 'next', x: bx + 20, y: by + 140, w: bw - 40, h: 48, text: E.i18n.t('win_next') },
        { id: 'menu', x: bx + 20, y: by + 198, w: bw - 40, h: 44, text: E.i18n.t('win_menu') }
      ];
      for (var i = 0; i < this.overButtons.length; i++) {
        var b = this.overButtons[i];
        ctx.fillStyle = i === 0 ? P.good : P.panel;
        ctx.strokeStyle = P.panelBorder;
        ctx.beginPath();
        E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 10);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = i === 0 ? '#fff' : P.text;
        ctx.font = '600 18px system-ui, sans-serif';
        ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2);
      }
    },

    drawFail: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, w, h);

      var bw = Math.min(320, w - 40), bh = 200;
      var bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      E.ui.roundRect(ctx, bx, by, bw, bh, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = P.bad;
      ctx.font = '700 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(E.i18n.t('fail_title'), w / 2, by + 50);

      this.failButtons = [
        { id: 'retry', x: bx + 20, y: by + 100, w: bw - 40, h: 48, text: E.i18n.t('fail_retry') },
        { id: 'menu', x: bx + 20, y: by + 158, w: bw - 40, h: 44, text: E.i18n.t('fail_menu') }
      ];
      for (var i = 0; i < this.failButtons.length; i++) {
        var b = this.failButtons[i];
        ctx.fillStyle = i === 0 ? P.bad : P.panel;
        ctx.strokeStyle = P.panelBorder;
        ctx.beginPath();
        E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 10);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = i === 0 ? '#fff' : P.text;
        ctx.font = '600 18px system-ui, sans-serif';
        ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2);
      }
    },

    drawPause: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);

      var bw = Math.min(300, w - 40), bh = 240;
      var bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      E.ui.roundRect(ctx, bx, by, bw, bh, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = P.text;
      ctx.font = '700 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(E.i18n.t('pause_title'), w / 2, by + 50);

      this.pauseButtons = [
        { id: 'resume', x: bx + 20, y: by + 90, w: bw - 40, h: 48, text: E.i18n.t('pause_resume') },
        { id: 'restart', x: bx + 20, y: by + 148, w: bw - 40, h: 44, text: E.i18n.t('pause_restart') },
        { id: 'menu', x: bx + 20, y: by + 200, w: bw - 40, h: 44, text: E.i18n.t('pause_menu') }
      ];
      for (var i = 0; i < this.pauseButtons.length; i++) {
        var b = this.pauseButtons[i];
        ctx.fillStyle = i === 0 ? P.good : P.panel;
        ctx.strokeStyle = P.panelBorder;
        ctx.beginPath();
        E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 10);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = i === 0 ? '#fff' : P.text;
        ctx.font = '600 16px system-ui, sans-serif';
        ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2);
      }
    },

    /* ---------- обработчики оверлеев ---------- */
    handleShopTap: function (x, y) {
      var E = window.Engine;
      for (var i = 0; i < this.shopButtons.length; i++) {
        var b = this.shopButtons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          E.audio.sfx('click');
          this.handleShopButton(b.id);
          return;
        }
      }
    },
    handleShopButton: function (id) {
      var E = window.Engine;
      var C = G.config.economy;
      if (id === 'close') { this.mode = 'running'; return; }
      var price = C[id + 'Price'];

      // проверка применимости ДО списания
      if (id === 'hint') {
        var hint = G.entities.findHint(this.state);
        if (!hint) { this.showFlash(E.i18n.t('no_moves')); E.audio.sfx('deny'); return; }
      } else if (id === 'undo') {
        if (this.history.length === 0) { this.showFlash(E.i18n.t('no_moves')); E.audio.sfx('deny'); return; }
      }

      if (this.coins < price) {
        this.showFlash(E.i18n.t('not_enough'));
        E.audio.sfx('deny');
        return;
      }

      this.coins -= price;
      E.storage.set('solitairekl_coins', this.coins);
      E.audio.sfx('buy');

      if (id === 'hint') {
        this.hintMove = G.entities.findHint(this.state);
        this.hintTimer = 3;
      } else if (id === 'undo') {
        this.undo();
      }
      this.mode = 'running';
    },
    handleOverTap: function (x, y) {
      var E = window.Engine;
      for (var i = 0; i < this.overButtons.length; i++) {
        var b = this.overButtons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          E.audio.sfx('click');
          if (b.id === 'next') {
            this.startLevel(this.level + 1);
          } else {
            E.core.setScene(SC.menu);
          }
          return;
        }
      }
    },
    handleFailTap: function (x, y) {
      var E = window.Engine;
      for (var i = 0; i < this.failButtons.length; i++) {
        var b = this.failButtons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          E.audio.sfx('click');
          if (b.id === 'retry') {
            this.startLevel(this.level);
          } else {
            E.core.setScene(SC.menu);
          }
          return;
        }
      }
    },
    handlePauseTap: function (x, y) {
      var E = window.Engine;
      for (var i = 0; i < this.pauseButtons.length; i++) {
        var b = this.pauseButtons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          E.audio.sfx('click');
          if (b.id === 'resume') {
            this.mode = 'running';
          } else if (b.id === 'restart') {
            this.startLevel(this.level);
          } else {
            E.core.setScene(SC.menu);
          }
          return;
        }
      }
    },

    completeLevel: function () {
      var E = window.Engine;
      this.mode = 'over';
      var reward = G.config.economy.winBase + (this.level - 1) * G.config.economy.winPerLevel;
      if (E.capture.record > 0) reward = Math.min(reward, 500);
      this.lastReward = reward;
      this.coins += reward;
      E.storage.set('solitairekl_coins', this.coins);

      var best = E.storage.get('solitairekl_best') || 0;
      if (this.level > best) E.storage.set('solitairekl_best', this.level);
      E.storage.set('solitairekl_run', { level: this.level + 1, coins: this.coins });

      E.audio.sfx('wave');
      E.fx.flash('#6dd98a', 0.3);
      E.fx.burst(this.game.view.w / 2, this.game.view.h / 2, '#6dd98a', 20, 200, this.rng);

      if (!E.capture.record && !E.capture.autoplay) {
        E.sdk.showInterstitial();
      }
    },

    failLevel: function () {
      var E = window.Engine;
      this.mode = 'fail';
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      E.audio.sfx('over');
    },

    showFlash: function (msg) {
      this.flashMsg = msg;
      this.flashTimer = 2;
    },

    /* ---------- capture API ---------- */
    applyCaptureParams: function (opts) {
      var E = window.Engine;
      var P = E.capture.params;
      if (P.wave) {
        var lv = Math.max(1, Math.min(G.config.maxLevel, parseInt(P.wave, 10) || 1));
        this.startLevel(lv);
        this.coins = 300;
      }
      if (P.coins) this.coins = Math.max(0, parseInt(P.coins, 10) || 0);
      if (P.mode === 'shop') this.mode = 'shop';
      else if (P.mode === 'over') this.completeLevel();
      else if (P.mode === 'fail') { this.mode = 'fail'; E.sdk.gameplayStop(); E.sdk.showBanner(); }
      if (P.freeze === '1' && this.game) { this.game.pause('capture'); this.game.render(); }
    },
    getCaptureState: function () {
      return {
        scene: 'play',
        level: this.level,
        coins: this.coins,
        score: this.score,
        mode: this.mode
      };
    },
    setCaptureState: function (s) {
      if (s.level) this.startLevel(s.level);
      if (s.coins !== undefined) this.coins = s.coins;
      if (s.mode) this.mode = s.mode;
    }
  };

  G.scenes = SC;
})(window.GAME);
