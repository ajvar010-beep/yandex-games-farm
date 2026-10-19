/* game/scenes.js — сцены «Слияния 2048»: меню, игра, лавка, пауза, fail/revive.
   Механика: свайп (или стрелки/WASD) — плитки сдвигаются, одинаковые сливаются.
   Цель: создать плитку с целевым значением. Бустеры: hint (лучший ход),
   shuffle (перемешать), undo (отмена), bomb (убрать минимальную).
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
      var hasSave = E.storage.get('merge2048_run');
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
      var last = E.storage.get('merge2048_last_day');
      var streak = E.storage.get('merge2048_streak') || 0;
      var today = new Date().toDateString();
      if (last !== today) {
        var yesterday = new Date(Date.now() - 864e5).toDateString();
        if (last === yesterday) streak++; else streak = 1;
        E.storage.set('merge2048_last_day', today);
        E.storage.set('merge2048_streak', streak);
        var reward = G.config.streak.rewardBase + (streak - 1) * G.config.streak.rewardPerDay;
        var coins = E.storage.get('merge2048_coins') || 0;
        E.storage.set('merge2048_coins', coins + reward);
        this.streakMsg = E.i18n.t('streak_new', { n: streak, c: reward });
      } else {
        this.streakMsg = null;
      }
      this.streak = streak;
    },
    update: function (game, dt) { this.t += dt; },
    draw: function (game, ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      G.art.drawBackground(ctx, w, h, this.t);

      // демо-плитки
      var cx = w / 2, cy = h * 0.22;
      var values = [2, 4, 8, 16, 32, 64, 128, 2048];
      for (var i = 0; i < 8; i++) {
        var bob = Math.sin(this.t * 2 + i) * 3;
        var size = Math.min(50, w * 0.1);
        var x = cx + (i - 3.5) * (size + 6);
        G.art.drawTile(ctx, x, cy + bob, size, values[i], 'idle', this.t);
      }

      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = Math.min(44, w * 0.08);
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(15,12,29,0.9)'; ctx.lineJoin = 'round';
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
    onTap: function (x, y) {
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
    handleButton: function (id) {
      var E = window.Engine;
      if (id === 'play') {
        E.storage.remove('merge2048_run');
        E.core.setScene(SC.play, { level: 1 });
      } else if (id === 'cont') {
        var run = E.storage.get('merge2048_run');
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
      this.coins = opts.coins !== undefined ? opts.coins : (E.storage.get('merge2048_coins') || G.config.economy.startCoins);
      this.score = opts.score || 0;
      this.mode = 'running'; // running | shop | over | paused | fail | revive
      this.reviveUsed = false;
      this.t = 0;
      this.history = [];
      this.flashMsg = null;
      this.flashTimer = 0;
      this.tutorialStep = E.storage.get('merge2048_tutorial') ? 3 : 0;
      this.tutorialTimer = 0;
      this.hintDir = null;
      this.hintTimer = 0;
      this.newTile = null;
      this.newTileT = 0;
      this.mergedTiles = [];

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
      this.score = 0;
      this.movesLeft = -1; // -1 = бесконечно
      this.reviveUsed = false;
      this.history = [];
      this.selected = null;
      this.hintDir = null;
      this.newTile = null;
      this.mergedTiles = [];
      this.mode = 'running';

      // стартовые плитки
      G.entities.spawnTile(this.grid, this.rng.float.bind(this.rng));
      G.entities.spawnTile(this.grid, this.rng.float.bind(this.rng));
    },

    layout: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      var hudH = 60;
      var boardSize = Math.min(w - 40, h - hudH - 40);
      var cellSize = boardSize / 4;
      var boardX = (w - boardSize) / 2;
      var boardY = hudH + 10 + (h - hudH - 10 - boardSize) / 2;

      this.hudH = hudH;
      this.boardX = boardX;
      this.boardY = boardY;
      this.boardSize = boardSize;
      this.cellSize = cellSize;

      this.shopButtons = [];
      this.pauseButtons = [];
      this.overButtons = [];
      this.failButtons = [];
      this.reviveButtons = [];
    },

    tilePos: function (x, y) {
      return {
        x: this.boardX + x * this.cellSize,
        y: this.boardY + y * this.cellSize
      };
    },

    update: function (game, dt) {
      this.t += dt;
      var E = window.Engine;
      E.capture.tickRecording(dt);

      if (this.mode === 'running') {
        if (this.movesLeft > 0) {
          // режим с ограниченными ходами (после revive)
        }
        if (this.hintTimer > 0) {
          this.hintTimer -= dt;
          if (this.hintTimer <= 0) this.hintDir = null;
        }
        if (this.newTileT > 0) {
          this.newTileT -= dt;
          if (this.newTileT <= 0) this.newTile = null;
        }
        if (this.tutorialStep < 3) {
          this.tutorialTimer += dt;
          if (this.tutorialTimer > 4) {
            this.tutorialStep++;
            this.tutorialTimer = 0;
            if (this.tutorialStep >= 3) E.storage.set('merge2048_tutorial', true);
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

    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.5;
      if (this.mode !== 'running') return;
      var best = G.entities.bestMove(this.grid, this.rng.float.bind(this.rng));
      if (best) this.doMove(best);
    },

    doMove: function (dir) {
      var E = window.Engine;
      var result = G.entities.move(this.grid, dir, this.rng.float.bind(this.rng));
      if (!result.moved) {
        E.audio.sfx('deny');
        return false;
      }

      // сохраняем историю для undo
      this.history.push({
        grid: G.entities.cloneGrid(this.grid),
        score: this.score,
        coins: this.coins
      });

      this.grid = result.grid;
      this.score += result.score;
      this.coins += Math.floor(result.score / 10);
      this.newTile = G.entities.spawnTile(this.grid, this.rng.float.bind(this.rng));
      this.newTileT = 0.3;
      this.mergedTiles = result.merges;

      E.audio.sfx('wave');
      E.fx.burst(this.game.view.w / 2, this.game.view.h / 2, G.config.palette.accent, 8, 80, this.rng);

      if (G.entities.hasWon(this.grid, this.target)) {
        this.completeLevel();
      } else if (G.entities.isGameOver(this.grid)) {
        this.failLevel();
      }
      return true;
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
      for (var y = 0; y < 4; y++) {
        for (var x = 0; x < 4; x++) {
          var pos = this.tilePos(x, y);
          ctx.fillStyle = P.cell;
          ctx.beginPath();
          E.ui.roundRect(ctx, pos.x + 2, pos.y + 2, this.cellSize - 4, this.cellSize - 4, 6);
          ctx.fill();
        }
      }

      // плитки
      for (var y = 0; y < 4; y++) {
        for (var x = 0; x < 4; x++) {
          var v = this.grid[y][x];
          if (v === 0) continue;
          var pos = this.tilePos(x, y);
          var state = 'idle';
          if (this.newTile && this.newTile.x === x && this.newTile.y === y) state = 'new';
          for (var m = 0; m < this.mergedTiles.length; m++) {
            // mergedTiles содержит индексы в строке, не координаты — упрощаем
          }
          G.art.drawTile(ctx, pos.x, pos.y, this.cellSize, v, state, this.t);
        }
      }

      // подсказка
      if (this.hintDir) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = P.good;
        ctx.font = '700 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        var arrows = { left: '←', right: '→', up: '↑', down: '↓' };
        ctx.fillText(arrows[this.hintDir] || '?', w / 2, this.boardY - 20);
        ctx.restore();
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

    /* ---------- ввод ---------- */
    onTap: function (x, y) {
      var E = window.Engine;

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
    },

    onSwipe: function (dx, dy) {
      if (this.mode !== 'running') return;
      var dir;
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 'right' : 'left';
      } else {
        dir = dy > 0 ? 'down' : 'up';
      }
      this.doMove(dir);
    },

    onKey: function (key) {
      if (this.mode !== 'running') return;
      var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
                  a: 'left', d: 'right', w: 'up', s: 'down' };
      var dir = map[key];
      if (dir) this.doMove(dir);
    },

    /* ---------- лавка ---------- */
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
            E.storage.set('merge2048_coins', self.coins);
            E.audio.sfx('coin');
          }
        });
        return;
      }
      var price = C[id + 'Price'];
      if (this.coins < price) {
        this.showFlash(E.i18n.t('not_enough'));
        E.audio.sfx('deny');
        return;
      }

      // проверяем, что бустер применим ДО списания
      if (id === 'hint') {
        var best = G.entities.bestMove(this.grid, this.rng.float.bind(this.rng));
        if (!best) { this.showFlash(E.i18n.t('no_moves')); E.audio.sfx('deny'); return; }
      } else if (id === 'undo') {
        if (this.history.length === 0) { this.showFlash(E.i18n.t('no_moves')); E.audio.sfx('deny'); return; }
      } else if (id === 'bomb') {
        if (G.entities.maxTile(this.grid) === 0) { E.audio.sfx('deny'); return; }
      }

      this.coins -= price;
      E.storage.set('merge2048_coins', this.coins);
      E.audio.sfx('buy');

      if (id === 'hint') {
        this.hintDir = G.entities.bestMove(this.grid, this.rng.float.bind(this.rng));
        this.hintTimer = 3;
      } else if (id === 'shuffle') {
        this.grid = G.entities.shuffle(this.grid, this.rng.float.bind(this.rng));
      } else if (id === 'undo') {
        var last = this.history.pop();
        this.grid = last.grid;
        this.score = last.score;
        this.coins = last.coins;
      } else if (id === 'bomb') {
        G.entities.bombSmallest(this.grid);
      }
      this.mode = 'running';
    },

    /* ---------- оверлей победы ---------- */
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

    /* ---------- оверлей fail ---------- */
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

    /* ---------- оверлей revive ---------- */
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

    /* ---------- оверлей паузы ---------- */
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
      E.storage.set('merge2048_coins', this.coins);

      var best = E.storage.get('merge2048_best') || 0;
      if (this.level > best) E.storage.set('merge2048_best', this.level);
      E.storage.set('merge2048_run', { level: this.level + 1, coins: this.coins });

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
          // добавляем 3 плитки 2, чтобы было куда ходить
          for (var i = 0; i < 3; i++) {
            G.entities.spawnTile(self.grid, self.rng.float.bind(self.rng));
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
        target: this.target,
        maxTile: G.entities.maxTile(this.grid)
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
