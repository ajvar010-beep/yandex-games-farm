/* game/scenes.js — сцены «Судоку Лайт»: меню, игра, лавка, пауза, fail/revive.
   Механика: тап по клетке → тап по цифре на панели → заполнение.
   Цель: заполнить все клетки правильно. Бустеры: hint (показать цифру),
   erase (стереть ошибку), check (показать ошибки), solve (решить клетку).
   Стрик: ежедневный бонус. RV-revive на fail, interstitial после победы.
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
      this.loadStreak();
    },
    buildButtons: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      var cx = w / 2;
      var bw = Math.min(280, w * 0.6), bh = 52;
      var y0 = h * 0.42;
      var gap = 14;

      this.buttons = [];
      var hasSave = E.storage.get('sudokulite_run');
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
    loadStreak: function () {
      var E = window.Engine;
      var last = E.storage.get('sudokulite_last_day');
      var streak = E.storage.get('sudokulite_streak') || 0;
      var today = new Date().toDateString();
      if (last !== today) {
        var yesterday = new Date(Date.now() - 864e5).toDateString();
        if (last === yesterday) streak++; else streak = 1;
        E.storage.set('sudokulite_last_day', today);
        E.storage.set('sudokulite_streak', streak);
        var reward = G.config.streak.rewardBase + (streak - 1) * G.config.streak.rewardPerDay;
        var coins = E.storage.get('sudokulite_coins') || 0;
        E.storage.set('sudokulite_coins', coins + reward);
        this.streakMsg = E.i18n.t('streak_new', { n: streak, c: reward });
      } else {
        this.streakMsg = null;
      }
      this.streak = streak;
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

      // демо-сетка
      var cx = w / 2, cy = h * 0.22;
      var size = Math.min(36, w * 0.07);
      var demo = [1, 2, 3, 4];
      for (var i = 0; i < 4; i++) {
        var bob = Math.sin(this.t * 2 + i) * 3;
        G.art.drawCell(ctx, cx + (i - 1.5) * (size + 4), cy + bob, size, demo[i], 'idle', this.t);
      }

      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = Math.min(44, w * 0.08);
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(13,17,23,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(E.i18n.t('title'), cx, cy + 80);
      var tg = ctx.createLinearGradient(0, cy + 80 - size / 2, 0, cy + 80 + size / 2);
      tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, P.accent);
      ctx.fillStyle = tg; ctx.fillText(E.i18n.t('title'), cx, cy + 80);

      // стрик
      if (this.streak > 1) {
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillStyle = P.dim;
        ctx.fillText(E.i18n.t('menu_streak') + ': ' + this.streak, cx, cy + 120);
      }
      if (this.streakMsg) {
        ctx.fillStyle = P.coin;
        ctx.fillText(this.streakMsg, cx, cy + 140);
      }

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
        E.storage.remove('sudokulite_run');
        E.core.setScene(SC.play, { level: 1 });
      } else if (id === 'cont') {
        var run = E.storage.get('sudokulite_run');
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
      this.coins = opts.coins !== undefined ? opts.coins : (E.storage.get('sudokulite_coins') || G.config.economy.startCoins);
      this.score = opts.score || 0;
      this.mode = 'running'; // running | shop | over | paused | fail | revive
      this.reviveUsed = false;
      this.t = 0;
      this.history = [];
      this.flashMsg = null;
      this.flashTimer = 0;
      this.tutorialStep = E.storage.get('sudokulite_tutorial') ? 3 : 0;
      this.tutorialTimer = 0;
      this.selected = null; // {x, y}
      this.hintCell = null;
      this.hintTimer = 0;
      this.errors = [];
      this.errorTimer = 0;

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
      var level = G.entities.makeLevel(lv, this.rng.float.bind(this.rng));
      this.grid = level.grid;
      this.solution = level.solution;
      this.given = level.given;
      this.mistakes = 0;
      this.maxMistakes = 3;
      this.reviveUsed = false;
      this.history = [];
      this.selected = null;
      this.hintCell = null;
      this.errors = [];
      this.mode = 'running';
    },

    layout: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      var hudH = 60;
      var boardSize = Math.min(w - 40, h - hudH - 160);
      var cellSize = boardSize / 6;
      var boardX = (w - boardSize) / 2;
      var boardY = hudH + 10;

      this.hudH = hudH;
      this.boardX = boardX;
      this.boardY = boardY;
      this.boardSize = boardSize;
      this.cellSize = cellSize;

      // панель цифр внизу
      this.numPadY = boardY + boardSize + 20;
      this.numPadCellSize = Math.min(50, (w - 60) / 7);
      this.numPadButtons = [];
      var totalW = 6 * this.numPadCellSize + 5 * 10;
      var startX = (w - totalW) / 2;
      for (var i = 0; i < 6; i++) {
        this.numPadButtons.push({
          num: i + 1,
          x: startX + i * (this.numPadCellSize + 10),
          y: this.numPadY,
          w: this.numPadCellSize,
          h: this.numPadCellSize
        });
      }

      this.shopButtons = [];
      this.pauseButtons = [];
      this.overButtons = [];
      this.failButtons = [];
      this.reviveButtons = [];
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
          if (this.hintTimer <= 0) this.hintCell = null;
        }
        if (this.errorTimer > 0) {
          this.errorTimer -= dt;
          if (this.errorTimer <= 0) this.errors = [];
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
      if (this.mode === 'revive') { this.handleReviveTap(x, y); return; }
      if (this.mode === 'paused') { this.handlePauseTap(x, y); return; }
      if (this.mode !== 'running') return;

      // HUD: пауза и лавка
      if (y < this.hudH) {
        if (x > this.game.view.w - 70 && x < this.game.view.w - 40) { this.mode = 'paused'; E.audio.sfx('click'); return; }
        if (x > this.game.view.w - 30) { this.mode = 'shop'; E.audio.sfx('click'); return; }
        return;
      }

      // поле: выбор клетки
      if (x >= this.boardX && x < this.boardX + this.boardSize &&
          y >= this.boardY && y < this.boardY + this.boardSize) {
        var gx = Math.floor((x - this.boardX) / this.cellSize);
        var gy = Math.floor((y - this.boardY) / this.cellSize);
        if (!this.given[gy][gx]) {
          this.selected = { x: gx, y: gy };
          E.audio.sfx('click');
        }
        return;
      }

      // панель цифр
      for (var i = 0; i < this.numPadButtons.length; i++) {
        var b = this.numPadButtons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.placeNumber(b.num);
          return;
        }
      }
    },

    placeNumber: function (num) {
      var E = window.Engine;
      if (!this.selected) return;
      var x = this.selected.x, y = this.selected.y;

      if (this.grid[y][x] === num) {
        // стереть
        this.grid[y][x] = 0;
        E.audio.sfx('click');
        return;
      }

      // сохраняем историю для undo
      this.history.push({
        grid: this.grid.map(function (row) { return row.slice(); }),
        mistakes: this.mistakes,
        score: this.score
      });

      this.grid[y][x] = num;
      E.audio.sfx('click');

      // проверка правильности
      if (this.solution[y][x] !== num) {
        this.mistakes++;
        E.audio.sfx('deny');
        if (this.mistakes >= this.maxMistakes) {
          this.failLevel();
        }
      } else {
        this.score += 10;
        this.coins += 1;
        // проверка победы
        if (G.entities.isComplete(this.grid, this.solution)) {
          this.completeLevel();
        }
      }
      this.selected = null;
    },

    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.5;
      if (this.mode !== 'running') return;

      // находим первую пустую клетку и заполняем правильно
      for (var y = 0; y < 6; y++) {
        for (var x = 0; x < 6; x++) {
          if (this.grid[y][x] === 0 && !this.given[y][x]) {
            this.selected = { x: x, y: y };
            this.placeNumber(this.solution[y][x]);
            return;
          }
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

      // поле
      ctx.fillStyle = P.board;
      ctx.beginPath();
      E.ui.roundRect(ctx, this.boardX - 4, this.boardY - 4, this.boardSize + 8, this.boardSize + 8, 12);
      ctx.fill();
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      // клетки
      for (var y = 0; y < 6; y++) {
        for (var x = 0; x < 6; x++) {
          var px = this.boardX + x * this.cellSize;
          var py = this.boardY + y * this.cellSize;
          var v = this.grid[y][x];
          var state = 'idle';
          if (this.given[y][x]) state = 'given';
          else if (this.selected && this.selected.x === x && this.selected.y === y) state = 'sel';
          else if (this.hintCell && this.hintCell.x === x && this.hintCell.y === y) state = 'hint';
          else if (this.errors.some(function (e) { return e.x === x && e.y === y; })) state = 'error';
          G.art.drawCell(ctx, px, py, this.cellSize, v, state, this.t);
        }
      }

      // толстые линии блоков
      ctx.strokeStyle = P.gridThick;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var i = 2; i < 6; i += 2) {
        ctx.moveTo(this.boardX + i * this.cellSize, this.boardY);
        ctx.lineTo(this.boardX + i * this.cellSize, this.boardY + this.boardSize);
      }
      for (var i = 3; i < 6; i += 3) {
        ctx.moveTo(this.boardX, this.boardY + i * this.cellSize);
        ctx.lineTo(this.boardX + this.boardSize, this.boardY + i * this.cellSize);
      }
      ctx.stroke();

      // панель цифр
      for (var i = 0; i < this.numPadButtons.length; i++) {
        var b = this.numPadButtons[i];
        ctx.fillStyle = P.panel;
        ctx.strokeStyle = P.panelBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = P.text;
        ctx.font = '700 ' + (b.w * 0.5) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(b.num), b.x + b.w / 2, b.y + b.h / 2);
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
      else if (this.mode === 'revive') this.drawRevive(ctx);
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

      // ошибки и кнопки
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = P.dim;
      ctx.textAlign = 'left';
      ctx.fillText('❌ ' + this.mistakes + '/' + this.maxMistakes, 12, 44);
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

      var bw = Math.min(340, w - 40), bh = 420;
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
        { id: 'erase', name: E.i18n.t('item_erase'), desc: E.i18n.t('item_erase_desc'), price: C.erasePrice },
        { id: 'check', name: E.i18n.t('item_check'), desc: E.i18n.t('item_check_desc'), price: C.checkPrice },
        { id: 'solve', name: E.i18n.t('item_solve'), desc: E.i18n.t('item_solve_desc'), price: C.solvePrice }
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

      // RV кнопка
      var rvBtn = { id: 'rv', x: bx + 20, y: iy, w: bw - 40, h: 50 };
      this.shopButtons.push(rvBtn);
      ctx.fillStyle = P.cellHot;
      ctx.strokeStyle = P.coin;
      ctx.lineWidth = 2;
      ctx.beginPath();
      E.ui.roundRect(ctx, rvBtn.x, rvBtn.y, rvBtn.w, rvBtn.h, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.coin;
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(E.i18n.t('shop_rv', { n: G.config.economy.rvCoins }), w / 2, rvBtn.y + 25);

      // закрыть
      var closeBtn = { id: 'close', x: bx + 20, y: iy + 60, w: bw - 40, h: 44 };
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

    drawRevive: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, w, h);

      var bw = Math.min(320, w - 40), bh = 220;
      var bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.coin;
      ctx.lineWidth = 3;
      ctx.beginPath();
      E.ui.roundRect(ctx, bx, by, bw, bh, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = P.text;
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(E.i18n.t('revive_offer'), w / 2, by + 50);

      this.reviveButtons = [
        { id: 'revive', x: bx + 20, y: by + 100, w: bw - 40, h: 50, text: E.i18n.t('revive_btn') },
        { id: 'no', x: bx + 20, y: by + 160, w: bw - 40, h: 44, text: E.i18n.t('revive_no') }
      ];
      for (var i = 0; i < this.reviveButtons.length; i++) {
        var b = this.reviveButtons[i];
        ctx.fillStyle = i === 0 ? P.coin : P.panel;
        ctx.strokeStyle = P.panelBorder;
        ctx.beginPath();
        E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 10);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = i === 0 ? '#1d1426' : P.text;
        ctx.font = '600 16px system-ui, sans-serif';
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
      if (id === 'rv') {
        var self = this;
        E.sdk.showRewarded({
          onReward: function () {
            self.coins += C.rvCoins;
            E.storage.set('sudokulite_coins', self.coins);
            E.audio.sfx('coin');
          }
        });
        return;
      }
      var price = C[id + 'Price'];

      // проверка применимости ДО списания
      if (id === 'hint') {
        var hint = G.entities.hint(this.grid, this.solution, this.given);
        if (!hint) { this.showFlash(E.i18n.t('no_errors')); E.audio.sfx('deny'); return; }
      } else if (id === 'erase') {
        var errors = G.entities.findErrors(this.grid, this.solution);
        if (errors.length === 0) { this.showFlash(E.i18n.t('no_errors')); E.audio.sfx('deny'); return; }
      } else if (id === 'check') {
        var errors = G.entities.findErrors(this.grid, this.solution);
        if (errors.length === 0) { this.showFlash(E.i18n.t('no_errors')); E.audio.sfx('deny'); return; }
      } else if (id === 'solve') {
        var empty = false;
        for (var y = 0; y < 6 && !empty; y++) {
          for (var x = 0; x < 6 && !empty; x++) {
            if (this.grid[y][x] === 0 && !this.given[y][x]) empty = true;
          }
        }
        if (!empty) { E.audio.sfx('deny'); return; }
      }

      if (this.coins < price) {
        this.showFlash(E.i18n.t('not_enough'));
        E.audio.sfx('deny');
        return;
      }

      this.coins -= price;
      E.storage.set('sudokulite_coins', this.coins);
      E.audio.sfx('buy');

      if (id === 'hint') {
        this.hintCell = hint;
        this.hintTimer = 3;
      } else if (id === 'erase') {
        G.entities.eraseError(this.grid, this.solution, this.given);
      } else if (id === 'check') {
        this.errors = G.entities.findErrors(this.grid, this.solution);
        this.errorTimer = 3;
      } else if (id === 'solve') {
        var solved = G.entities.solveCell(this.grid, this.solution, this.given);
        if (solved) {
          this.score += 10;
          if (G.entities.isComplete(this.grid, this.solution)) {
            this.completeLevel();
          }
        }
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
    handleReviveTap: function (x, y) {
      var E = window.Engine;
      for (var i = 0; i < this.reviveButtons.length; i++) {
        var b = this.reviveButtons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (b.id === 'revive') {
            this.doRevive();
          } else {
            this.mode = 'fail';
            E.sdk.gameplayStop();
            E.sdk.showBanner();
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
      E.storage.set('sudokulite_coins', this.coins);

      var best = E.storage.get('sudokulite_best') || 0;
      if (this.level > best) E.storage.set('sudokulite_best', this.level);
      E.storage.set('sudokulite_run', { level: this.level + 1, coins: this.coins });

      E.audio.sfx('wave');
      E.fx.flash('#6dd98a', 0.3);
      E.fx.burst(this.game.view.w / 2, this.game.view.h / 2, '#6dd98a', 20, 200, this.rng);

      if (!E.capture.record && !E.capture.autoplay) {
        E.sdk.showInterstitial();
      }
    },

    failLevel: function () {
      var E = window.Engine;
      if (!this.reviveUsed && !E.capture.record && !E.capture.autoplay) {
        this.mode = 'revive';
      } else {
        this.mode = 'fail';
        E.sdk.gameplayStop();
        E.sdk.showBanner();
      }
      E.audio.sfx('over');
    },

    doRevive: function () {
      var E = window.Engine;
      var self = this;
      E.sdk.showRewarded({
        onReward: function () {
          self.reviveUsed = true;
          self.mode = 'running';
          self.mistakes = 0; // сбрасываем ошибки
          E.audio.sfx('click');
        },
        onError: function () {
          self.mode = 'fail';
          E.sdk.gameplayStop();
          E.sdk.showBanner();
        }
      });
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
        mode: this.mode,
        mistakes: this.mistakes
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
