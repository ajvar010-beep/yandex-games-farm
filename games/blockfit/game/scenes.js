/* game/scenes.js — сцены «Блок-Фита»: меню, игра, лавка, пауза, fail/revive.
   Механика: drag фигуры с панели на поле → заполнение линий → очки.
   Цель: набрать целевое количество очков. Бустеры: hint (лучшее место),
   shuffle (новые фигуры), undo (отмена), bomb (убрать 3×3).
   Стрик: ежедневный бонус. RV-revive на fail, interstitial после победы. */

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
      var hasSave = E.storage.get('blockfit_run');
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
      var last = E.storage.get('blockfit_last_day');
      var streak = E.storage.get('blockfit_streak') || 0;
      var today = new Date().toDateString();
      if (last !== today) {
        var yesterday = new Date(Date.now() - 864e5).toDateString();
        if (last === yesterday) streak++; else streak = 1;
        E.storage.set('blockfit_last_day', today);
        E.storage.set('blockfit_streak', streak);
        var reward = G.config.streak.rewardBase + (streak - 1) * G.config.streak.rewardPerDay;
        var coins = E.storage.get('blockfit_coins') || 0;
        E.storage.set('blockfit_coins', coins + reward);
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

      // демо-фигуры
      var cx = w / 2, cy = h * 0.22;
      var cellSize = Math.min(30, w * 0.06);
      var shapes = [
        { cells: [[0,0],[1,0],[0,1],[1,1]], colorId: 2 },
        { cells: [[0,0],[1,0],[2,0],[1,1]], colorId: 3 },
        { cells: [[0,0],[0,1],[0,2],[1,2]], colorId: 1 }
      ];
      for (var i = 0; i < 3; i++) {
        var bob = Math.sin(this.t * 2 + i) * 4;
        G.art.drawShape(ctx, cx + (i - 1) * (cellSize * 4), cy + bob, cellSize, shapes[i], shapes[i].colorId, 'idle', this.t);
      }

      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = Math.min(44, w * 0.08);
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(13,17,23,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(E.i18n.t('title'), cx, cy + 100);
      var tg = ctx.createLinearGradient(0, cy + 100 - size / 2, 0, cy + 100 + size / 2);
      tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, P.accent);
      ctx.fillStyle = tg; ctx.fillText(E.i18n.t('title'), cx, cy + 100);

      // стрик
      if (this.streak > 1) {
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillStyle = P.dim;
        ctx.fillText(E.i18n.t('menu_streak') + ': ' + this.streak, cx, cy + 140);
      }
      if (this.streakMsg) {
        ctx.fillStyle = P.coin;
        ctx.fillText(this.streakMsg, cx, cy + 160);
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
        E.storage.remove('blockfit_run');
        E.core.setScene(SC.play, { level: 1 });
      } else if (id === 'cont') {
        var run = E.storage.get('blockfit_run');
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
      this.coins = opts.coins !== undefined ? opts.coins : (E.storage.get('blockfit_coins') || G.config.economy.startCoins);
      this.score = opts.score || 0;
      this.mode = 'running'; // running | shop | over | paused | fail | revive
      this.reviveUsed = false;
      this.t = 0;
      this.history = [];
      this.flashMsg = null;
      this.flashTimer = 0;
      this.tutorialStep = E.storage.get('blockfit_tutorial') ? 3 : 0;
      this.tutorialTimer = 0;
      this.hintPlace = null;
      this.hintTimer = 0;
      this.dragging = null; // { panelIdx, shape, colorId, x, y }
      this.dragOffset = { x: 0, y: 0 };

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
      this.target = G.config.levelTarget(lv);
      this.rng = new E.Rng((E.core.seed || 1) ^ (lv * 7919));
      this.grid = G.entities.makeGrid();
      this.panel = G.entities.makePanel(this.rng.float.bind(this.rng), 3);
      this.score = 0;
      this.reviveUsed = false;
      this.history = [];
      this.dragging = null;
      this.hintPlace = null;
      this.mode = 'running';
    },

    layout: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      var hudH = 60;
      var boardSize = Math.min(w - 40, h - hudH - 140);
      var cellSize = boardSize / 10;
      var boardX = (w - boardSize) / 2;
      var boardY = hudH + 10;

      this.hudH = hudH;
      this.boardX = boardX;
      this.boardY = boardY;
      this.boardSize = boardSize;
      this.cellSize = cellSize;

      // панель фигур внизу
      this.panelY = boardY + boardSize + 20;
      this.panelCellSize = Math.min(24, (w - 60) / 15);
      this.panelSlots = [];
      var totalW = 3 * (this.panelCellSize * 5) + 2 * 20;
      var startX = (w - totalW) / 2;
      for (var i = 0; i < 3; i++) {
        this.panelSlots.push({
          x: startX + i * (this.panelCellSize * 5 + 20),
          y: this.panelY,
          w: this.panelCellSize * 5,
          h: this.panelCellSize * 5
        });
      }

      this.shopButtons = [];
      this.pauseButtons = [];
      this.overButtons = [];
      this.failButtons = [];
      this.reviveButtons = [];
    },

    /* ---------- ввод: drag-and-drop ---------- */
    update: function (game, dt) {
      this.t += dt;
      var E = window.Engine;
      E.capture.tickRecording(dt);

      if (this.mode === 'running') {
        if (this.hintTimer > 0) {
          this.hintTimer -= dt;
          if (this.hintTimer <= 0) this.hintPlace = null;
        }
        if (this.tutorialStep < 3) {
          this.tutorialTimer += dt;
          if (this.tutorialTimer > 4) {
            this.tutorialStep++;
            this.tutorialTimer = 0;
            if (this.tutorialStep >= 3) E.storage.set('blockfit_tutorial', true);
          }
        }
        // автопилот для записи видео
        if (this.autopilot) this.driveAutopilot(dt);
        // ввод
        this.driveInput(game);
      }
      if (this.flashTimer > 0) {
        this.flashTimer -= dt;
        if (this.flashTimer <= 0) this.flashMsg = null;
      }
    },

    driveInput: function (game) {
      var E = window.Engine;
      var P = E.input.pointer;

      // HUD: пауза и лавка
      if (P.pressed && P.y < this.hudH) {
        if (P.x > this.game.view.w - 70 && P.x < this.game.view.w - 40) { this.mode = 'paused'; E.audio.sfx('click'); return; }
        if (P.x > this.game.view.w - 30) { this.mode = 'shop'; E.audio.sfx('click'); return; }
        return;
      }

      if (this.mode !== 'running') return;

      if (P.pressed && !this.dragging) {
        // начало drag с панели
        for (var i = 0; i < this.panel.length; i++) {
          if (this.panel[i].used) continue;
          var slot = this.panelSlots[i];
          if (P.x >= slot.x && P.x <= slot.x + slot.w && P.y >= slot.y && P.y <= slot.y + slot.h) {
            this.dragging = { panelIdx: i, shape: this.panel[i].shape, colorId: this.panel[i].colorId, x: P.x, y: P.y };
            this.dragOffset.x = P.x - slot.x;
            this.dragOffset.y = P.y - slot.y;
            E.audio.sfx('click');
            return;
          }
        }
      }

      if (this.dragging) {
        this.dragging.x = P.x;
        this.dragging.y = P.y;

        if (!P.down) {
          // отпустили — пробуем разместить
          this.tryPlace();
        }
      }
    },

    tryPlace: function () {
      var E = window.Engine;
      var d = this.dragging;
      if (!d) return;

      // находим клетку поля под курсором
      var gridX = Math.floor((d.x - this.boardX) / this.cellSize);
      var gridY = Math.floor((d.y - this.boardY) / this.cellSize);

      // центрируем фигуру на курсоре
      var shapeW = 0, shapeH = 0;
      for (var i = 0; i < d.shape.cells.length; i++) {
        shapeW = Math.max(shapeW, d.shape.cells[i][0]);
        shapeH = Math.max(shapeH, d.shape.cells[i][1]);
      }
      gridX -= Math.floor(shapeW / 2);
      gridY -= Math.floor(shapeH / 2);

      if (G.entities.canPlace(this.grid, d.shape, gridX, gridY)) {
        // сохраняем историю для undo
        this.history.push({
          grid: G.entities.cloneGrid(this.grid),
          score: this.score,
          panelIdx: d.panelIdx,
          shape: d.shape,
          colorId: d.colorId
        });

        // размещаем
        G.entities.place(this.grid, d.shape, gridX, gridY, d.colorId);
        this.panel[d.panelIdx].used = true;
        this.score += G.config.scoreCell * d.shape.cells.length;

        // проверяем линии
        var lines = G.entities.checkLines(this.grid);
        if (lines.count > 0) {
          G.entities.clearLines(this.grid, lines);
          this.score += G.config.scoreLine * lines.count;
          this.coins += lines.count * 5;
          E.audio.sfx('wave');
          E.fx.flash(G.config.palette.good, 0.2);
          E.fx.burst(this.game.view.w / 2, this.game.view.h / 2, G.config.palette.good, 12, 150, this.rng);
        } else {
          E.audio.sfx('click');
        }

        // если все фигуры использованы — новая панель
        var allUsed = true;
        for (var i = 0; i < this.panel.length; i++) {
          if (!this.panel[i].used) { allUsed = false; break; }
        }
        if (allUsed) {
          this.panel = G.entities.makePanel(this.rng.float.bind(this.rng), 3);
        }

        // проверка победы
        if (this.score >= this.target) {
          this.completeLevel();
        } else if (!G.entities.hasMove(this.grid, this.panel)) {
          this.failLevel();
        }
      } else {
        E.audio.sfx('deny');
      }

      this.dragging = null;
    },

    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.6;
      if (this.mode !== 'running') return;

      // находим первую доступную фигуру и лучшее место
      for (var i = 0; i < this.panel.length; i++) {
        if (this.panel[i].used) continue;
        var best = G.entities.bestPlace(this.grid, this.panel[i].shape);
        if (best) {
          // симулируем размещение
          this.dragging = { panelIdx: i, shape: this.panel[i].shape, colorId: this.panel[i].colorId, x: 0, y: 0 };
          this.dragging.x = this.boardX + best.x * this.cellSize + this.cellSize / 2;
          this.dragging.y = this.boardY + best.y * this.cellSize + this.cellSize / 2;
          this.tryPlace();
          return;
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
      for (var y = 0; y < 10; y++) {
        for (var x = 0; x < 10; x++) {
          ctx.fillStyle = P.cell;
          ctx.beginPath();
          E.ui.roundRect(ctx, this.boardX + x * this.cellSize + 1, this.boardY + y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2, 3);
          ctx.fill();
        }
      }

      // блоки на поле
      for (var y = 0; y < 10; y++) {
        for (var x = 0; x < 10; x++) {
          var v = this.grid[y][x];
          if (v === 0) continue;
          G.art.drawBlock(ctx, this.boardX + x * this.cellSize, this.boardY + y * this.cellSize, this.cellSize, v, 'idle', this.t);
        }
      }

      // подсказка
      if (this.hintPlace && this.hintPlace.panelIdx >= 0) {
        var hp = this.hintPlace;
        var shape = this.panel[hp.panelIdx].shape;
        var colorId = this.panel[hp.panelIdx].colorId;
        for (var i = 0; i < shape.cells.length; i++) {
          var x = this.boardX + (hp.x + shape.cells[i][0]) * this.cellSize;
          var y = this.boardY + (hp.y + shape.cells[i][1]) * this.cellSize;
          G.art.drawBlock(ctx, x, y, this.cellSize, colorId, 'hint', this.t);
        }
      }

      // ghost фигуры при drag
      if (this.dragging) {
        var d = this.dragging;
        var gridX = Math.floor((d.x - this.boardX) / this.cellSize);
        var gridY = Math.floor((d.y - this.boardY) / this.cellSize);
        var shapeW = 0, shapeH = 0;
        for (var i = 0; i < d.shape.cells.length; i++) {
          shapeW = Math.max(shapeW, d.shape.cells[i][0]);
          shapeH = Math.max(shapeH, d.shape.cells[i][1]);
        }
        gridX -= Math.floor(shapeW / 2);
        gridY -= Math.floor(shapeH / 2);
        if (G.entities.canPlace(this.grid, d.shape, gridX, gridY)) {
          for (var i = 0; i < d.shape.cells.length; i++) {
            var x = this.boardX + (gridX + d.shape.cells[i][0]) * this.cellSize;
            var y = this.boardY + (gridY + d.shape.cells[i][1]) * this.cellSize;
            G.art.drawBlock(ctx, x, y, this.cellSize, d.colorId, 'ghost', this.t);
          }
        }
        // фигура на курсоре
        for (var i = 0; i < d.shape.cells.length; i++) {
          var x = d.x - this.dragOffset.x + d.shape.cells[i][0] * this.panelCellSize;
          var y = d.y - this.dragOffset.y + d.shape.cells[i][1] * this.panelCellSize;
          G.art.drawBlock(ctx, x, y, this.panelCellSize, d.colorId, 'idle', this.t);
        }
      }

      // панель фигур
      for (var i = 0; i < this.panel.length; i++) {
        var slot = this.panelSlots[i];
        ctx.fillStyle = P.cell;
        ctx.beginPath();
        E.ui.roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 8);
        ctx.fill();
        ctx.strokeStyle = P.grid;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (!this.panel[i].used && (!this.dragging || this.dragging.panelIdx !== i)) {
          var shape = this.panel[i].shape;
          var sw = 0, sh = 0;
          for (var c = 0; c < shape.cells.length; c++) {
            sw = Math.max(sw, shape.cells[c][0]);
            sh = Math.max(sh, shape.cells[c][1]);
          }
          var offX = slot.x + (slot.w - (sw + 1) * this.panelCellSize) / 2;
          var offY = slot.y + (slot.h - (sh + 1) * this.panelCellSize) / 2;
          G.art.drawShape(ctx, offX, offY, this.panelCellSize, shape, this.panel[i].colorId, 'idle', this.t);
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

      ctx.textAlign = 'center';
      ctx.fillStyle = P.accent;
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillText(E.i18n.t('hud_target', { n: this.target }), w / 2, 20);

      ctx.fillStyle = P.coin;
      ctx.textAlign = 'right';
      ctx.fillText(this.coins + ' ✨', w - 12, 20);

      // очки и кнопки
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = P.dim;
      ctx.textAlign = 'left';
      ctx.fillText(E.i18n.t('hud_score') + ': ' + this.score, 12, 44);
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
        { id: 'shuffle', name: E.i18n.t('item_shuffle'), desc: E.i18n.t('item_shuffle_desc'), price: C.shufflePrice },
        { id: 'undo', name: E.i18n.t('item_undo'), desc: E.i18n.t('item_undo_desc'), price: C.undoPrice },
        { id: 'bomb', name: E.i18n.t('item_bomb'), desc: E.i18n.t('item_bomb_desc'), price: C.bombPrice }
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
            E.storage.set('blockfit_coins', self.coins);
            E.audio.sfx('coin');
          }
        });
        return;
      }
      var price = C[id + 'Price'];

      // проверка применимости ДО списания
      if (id === 'hint') {
        var best = null;
        var bestIdx = -1;
        for (var i = 0; i < this.panel.length; i++) {
          if (this.panel[i].used) continue;
          var b = G.entities.bestPlace(this.grid, this.panel[i].shape);
          if (b && (!best || b.score > best.score)) { best = b; bestIdx = i; }
        }
        if (!best) { this.showFlash(E.i18n.t('no_moves')); E.audio.sfx('deny'); return; }
      } else if (id === 'undo') {
        if (this.history.length === 0) { this.showFlash(E.i18n.t('no_moves')); E.audio.sfx('deny'); return; }
      } else if (id === 'bomb') {
        var hasFilled = false;
        for (var y = 0; y < 10 && !hasFilled; y++) {
          for (var x = 0; x < 10 && !hasFilled; x++) {
            if (this.grid[y][x] !== 0) hasFilled = true;
          }
        }
        if (!hasFilled) { E.audio.sfx('deny'); return; }
      }

      if (this.coins < price) {
        this.showFlash(E.i18n.t('not_enough'));
        E.audio.sfx('deny');
        return;
      }

      this.coins -= price;
      E.storage.set('blockfit_coins', this.coins);
      E.audio.sfx('buy');

      if (id === 'hint') {
        this.hintPlace = { x: best.x, y: best.y, panelIdx: bestIdx };
        this.hintTimer = 3;
      } else if (id === 'shuffle') {
        G.entities.shufflePanel(this.panel, this.rng.float.bind(this.rng));
      } else if (id === 'undo') {
        var last = this.history.pop();
        this.grid = last.grid;
        this.score = last.score;
        // восстанавливаем фигуру на панели
        this.panel[last.panelIdx].used = false;
        this.panel[last.panelIdx].shape = last.shape;
        this.panel[last.panelIdx].colorId = last.colorId;
      } else if (id === 'bomb') {
        G.entities.bombArea(this.grid, this.rng.float.bind(this.rng));
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
      E.storage.set('blockfit_coins', this.coins);

      var best = E.storage.get('blockfit_best') || 0;
      if (this.level > best) E.storage.set('blockfit_best', this.level);
      E.storage.set('blockfit_run', { level: this.level + 1, coins: this.coins });

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
          // добавляем 3 новые фигуры на панель
          for (var i = 0; i < self.panel.length; i++) {
            if (self.panel[i].used) {
              self.panel[i].used = false;
              self.panel[i].shape = G.entities.SHAPES[Math.floor(self.rng.float() * G.entities.SHAPES.length)];
              self.panel[i].colorId = 1 + Math.floor(self.rng.float() * 8);
            }
          }
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
        target: this.target
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
