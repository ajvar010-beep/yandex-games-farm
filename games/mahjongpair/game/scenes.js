/* game/scenes.js — сцены «Парного Маджонга»: меню, игра, лавка, пауза, fail/revive.
   Механика: тап по свободной плитке → тап по паре → исчезают. Цель: убрать все.
   Бустеры: hint (показать пару), shuffle (перемешать), time (+30 сек), undo (отмена).
   Стрик: ежедневный бонус за возврат. RV-revive на fail, interstitial после победы. */

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
      var w = this.game.view.w, h = this.game.view.h;
      var cx = w / 2;
      var bw = Math.min(280, w * 0.6), bh = 52;
      var y0 = h * 0.42;
      var gap = 14;

      this.buttons = [];
      var hasSave = E.storage.get('mahjongpair_run');
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
      var last = E.storage.get('mahjongpair_last_day');
      var streak = E.storage.get('mahjongpair_streak') || 0;
      var today = new Date().toDateString();
      if (last !== today) {
        var yesterday = new Date(Date.now() - 864e5).toDateString();
        if (last === yesterday) streak++; else streak = 1;
        E.storage.set('mahjongpair_last_day', today);
        E.storage.set('mahjongpair_streak', streak);
        var reward = G.config.streak.rewardBase + (streak - 1) * G.config.streak.rewardPerDay;
        var coins = E.storage.get('mahjongpair_coins') || 0;
        E.storage.set('mahjongpair_coins', coins + reward);
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

      // веер плиток
      var cx = w / 2, cy = h * 0.24;
      var types = [
        { sym: '中', cat: 'dragon', color: '#c84a4a' },
        { sym: '1', cat: 'bamboo', color: '#4a9e4a' },
        { sym: '發', cat: 'dragon', color: '#4a8a4a' }
      ];
      for (var i = 0; i < 3; i++) {
        var bob = Math.sin(this.t * 2 + i) * 4;
        ctx.save();
        ctx.translate(cx + (i - 1) * 60, cy + bob);
        ctx.rotate((i - 1) * 0.1);
        G.art.drawTile(ctx, 0, 0, 50, 65, types[i], i === 1 ? 'sel' : 'idle', this.t);
        ctx.restore();
      }

      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = Math.min(48, w * 0.09);
      ctx.font = '800 ' + size + 'px Georgia, serif';
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(10,23,19,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(E.i18n.t('title'), cx, cy + 90);
      var tg = ctx.createLinearGradient(0, cy + 90 - size / 2, 0, cy + 90 + size / 2);
      tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, P.accent);
      ctx.fillStyle = tg; ctx.fillText(E.i18n.t('title'), cx, cy + 90);

      // стрик
      if (this.streak > 1) {
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillStyle = P.dim;
        ctx.fillText(E.i18n.t('menu_streak') + ': ' + this.streak, cx, cy + 130);
      }
      if (this.streakMsg) {
        ctx.fillStyle = P.coin;
        ctx.fillText(this.streakMsg, cx, cy + 150);
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
        E.storage.remove('mahjongpair_run');
        E.core.setScene(SC.play, { level: 1 });
      } else if (id === 'cont') {
        var run = E.storage.get('mahjongpair_run');
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
      this.coins = opts.coins !== undefined ? opts.coins : (E.storage.get('mahjongpair_coins') || G.config.economy.startCoins);
      this.score = opts.score || 0;
      this.mode = 'running'; // running | shop | over | paused | fail | revive
      this.reviveUsed = false;
      this.t = 0;
      this.selected = null;
      this.hintPair = null;
      this.hintTimer = 0;
      this.history = [];
      this.flashMsg = null;
      this.flashTimer = 0;
      this.tutorialStep = E.storage.get('mahjongpair_tutorial') ? 3 : 0;
      this.tutorialTimer = 0;

      E.audio.music('gameplay');
      E.sdk.gameplayStart();
      E.sdk.hideBanner();

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!opts.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;

      this.startLevel(this.level);
      this.layout(game);
      this.applyCaptureParams(opts);
    },

    startLevel: function (lv) {
      var E = window.Engine;
      this.level = lv;
      this.rng = new E.Rng((E.core.seed || 1) ^ (lv * 7919));
      var level = G.entities.makeLevel(lv, this.rng.float.bind(this.rng));
      this.tiles = level.tiles;
      this.layoutName = level.layout.name;
      this.timeLeft = G.config.levelTime(lv);
      this.timeMax = this.timeLeft;
      this.reviveUsed = false;
      this.selected = null;
      this.hintPair = null;
      this.history = [];
      this.mode = 'running';
      this.updateTileStates();
    },

    layout: function (game) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var hudH = 60;
      var boardTop = hudH + 10;
      var boardH = h - boardTop - 20;
      var boardW = w - 40;

      // вычисляем bounds позиций
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = 0;
      for (var i = 0; i < this.tiles.length; i++) {
        var t = this.tiles[i];
        if (t.removed) continue;
        minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
        minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
        maxZ = Math.max(maxZ, t.z);
      }
      var rangeX = maxX - minX + 1, rangeY = maxY - minY + 1;
      var tileW = Math.min(boardW / (rangeX + maxZ * 0.3), boardH / (rangeY * 1.3 + maxZ * 0.3));
      var tileH = tileW * 1.3;
      var offX = 20 + (boardW - (rangeX + maxZ * 0.3) * tileW) / 2;
      var offY = boardTop + (boardH - (rangeY * 1.3 + maxZ * 0.3) * tileW) / 2;
      var zOff = tileW * 0.15;

      this.tileW = tileW; this.tileH = tileH;
      this.offX = offX; this.offY = offY; this.zOff = zOff;
      this.minX = minX; this.minY = minY;

      this.hudH = hudH;
      this.shopButtons = [];
      this.pauseButtons = [];
    },

    tileScreenPos: function (t) {
      return {
        x: this.offX + (t.x - this.minX) * this.tileW + t.z * this.zOff,
        y: this.offY + (t.y - this.minY) * this.tileH - t.z * this.zOff * 0.7
      };
    },

    updateTileStates: function () {
      for (var i = 0; i < this.tiles.length; i++) {
        var t = this.tiles[i];
        if (t.removed) continue;
        t.free = G.entities.isFree(this.tiles, t);
      }
    },

    update: function (game, dt) {
      this.t += dt;
      var E = window.Engine;
      E.capture.tickRecording(dt);

      if (this.mode === 'running') {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.failLevel();
        }
        if (this.hintTimer > 0) {
          this.hintTimer -= dt;
          if (this.hintTimer <= 0) this.clearHint();
        }
        if (this.tutorialStep < 3) {
          this.tutorialTimer += dt;
          if (this.tutorialTimer > 4) {
            this.tutorialStep++;
            this.tutorialTimer = 0;
            if (this.tutorialStep >= 3) E.storage.set('mahjongpair_tutorial', true);
          }
        }
        // проверка тупика
        if (G.entities.isStuck(this.tiles) && !G.entities.isComplete(this.tiles)) {
          this.showFlash(E.i18n.t('no_moves'));
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
      this._autoT = 0.8;
      if (this.mode !== 'running') return;
      var pair = G.entities.findPair(this.tiles);
      if (pair) {
        this.removePair(pair[0], pair[1]);
      }
    },

    draw: function (game, ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      G.art.drawBackground(ctx, w, h, this.t);

      // HUD
      this.drawHUD(ctx);

      // плитки (сортируем по z, потом по y для правильного перекрытия)
      var sorted = this.tiles.slice().sort(function (a, b) {
        if (a.z !== b.z) return a.z - b.z;
        return a.y - b.y;
      });
      for (var i = 0; i < sorted.length; i++) {
        var t = sorted[i];
        if (t.removed) continue;
        var pos = this.tileScreenPos(t);
        var type = G.entities.typeById(t.typeId);
        var state = 'idle';
        if (this.selected === t) state = 'sel';
        else if (t.hinted) state = 'hint';
        else if (!t.free) state = 'blocked';
        G.art.drawTile(ctx, pos.x, pos.y, this.tileW, this.tileH, type, state, this.t);
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

      // таймер
      var timeColor = this.timeLeft < 15 ? P.bad : P.text;
      ctx.fillStyle = timeColor;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      var mins = Math.floor(this.timeLeft / 60), secs = Math.floor(this.timeLeft % 60);
      ctx.fillText(mins + ':' + (secs < 10 ? '0' : '') + secs, w / 2, 20);

      // монеты
      ctx.fillStyle = P.coin;
      ctx.textAlign = 'right';
      ctx.fillText(this.coins + ' ✨', w - 12, 20);

      // кнопки паузы и лавки
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = P.dim;
      ctx.textAlign = 'left';
      ctx.fillText('⏸', 12, 48);
      ctx.textAlign = 'right';
      ctx.fillText('🛒', w - 12, 48);
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

      var bw = Math.min(340, w - 40), bh = 380;
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
        { id: 'time', name: E.i18n.t('item_time'), desc: E.i18n.t('item_time_desc'), price: C.timePrice },
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
        if (x < 50) { this.mode = 'paused'; E.audio.sfx('click'); return; }
        if (x > window.Engine.core.width - 50) { this.mode = 'shop'; E.audio.sfx('click'); return; }
        return;
      }

      // поиск плитки по координатам (сверху вниз по z)
      var hit = null;
      for (var i = this.tiles.length - 1; i >= 0; i--) {
        var t = this.tiles[i];
        if (t.removed) continue;
        var pos = this.tileScreenPos(t);
        if (x >= pos.x && x <= pos.x + this.tileW && y >= pos.y && y <= pos.y + this.tileH) {
          if (!hit || t.z > hit.z) hit = t;
        }
      }
      if (!hit) {
        if (this.selected) { this.selected.selected = false; this.selected = null; }
        return;
      }

      if (!hit.free) {
        E.audio.sfx('deny');
        return;
      }

      if (this.selected === hit) {
        hit.selected = false;
        this.selected = null;
        return;
      }

      if (this.selected && this.selected.typeId === hit.typeId) {
        // пара!
        this.removePair(this.selected, hit);
      } else {
        if (this.selected) this.selected.selected = false;
        hit.selected = true;
        this.selected = hit;
        E.audio.sfx('click');
      }
    },

    removePair: function (a, b) {
      var E = window.Engine;
      this.history.push({ a: a, b: b });
      a.removed = true;
      b.removed = true;
      a.selected = false;
      this.selected = null;
      this.updateTileStates();

      var pa = this.tileScreenPos(a), pb = this.tileScreenPos(b);
      var cx = (pa.x + pb.x + this.tileW) / 2, cy = (pa.y + pb.y + this.tileH) / 2;
      E.fx.burst(cx, cy, G.config.palette.accent, 12, 100, this.rng || Math.random);
      E.audio.sfx('wave');

      this.score += 10;
      this.coins += 2;

      if (G.entities.isComplete(this.tiles)) {
        this.completeLevel();
      } else if (G.entities.isStuck(this.tiles)) {
        this.showFlash(E.i18n.t('no_moves'));
      }
    },

    completeLevel: function () {
      var E = window.Engine;
      this.mode = 'over';
      var reward = G.config.economy.winBase + (this.level - 1) * G.config.economy.winPerLevel;
      if (E.capture.recordMode) reward = Math.min(reward, 500);
      this.lastReward = reward;
      this.coins += reward;
      E.storage.set('mahjongpair_coins', this.coins);

      var best = E.storage.get('mahjongpair_best') || 0;
      if (this.level > best) E.storage.set('mahjongpair_best', this.level);
      E.storage.set('mahjongpair_run', { level: this.level + 1, coins: this.coins });

      E.audio.sfx('wave');
      E.fx.flash('#6dd98a', 0.3);
      E.fx.burst(this.game.view.w / 2, this.game.view.h / 2, '#6dd98a', 20, 200, this.rng || Math.random);

      if (!E.capture.recordMode && !E.capture.autopilot) {
        E.sdk.showInterstitial();
      }
    },

    failLevel: function () {
      var E = window.Engine;
      if (!this.reviveUsed && !E.capture.recordMode && !E.capture.autopilot) {
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
          self.timeLeft += 30;
          self.reviveUsed = true;
          self.mode = 'running';
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

    clearHint: function () {
      if (this.hintPair) {
        this.hintPair[0].hinted = false;
        this.hintPair[1].hinted = false;
        this.hintPair = null;
      }
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
            E.storage.set('mahjongpair_coins', self.coins);
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
      this.coins -= price;
      E.storage.set('mahjongpair_coins', this.coins);
      E.audio.sfx('buy');

      if (id === 'hint') {
        this.clearHint();
        this.hintPair = G.entities.hint(this.tiles);
        this.hintTimer = 5;
        if (!this.hintPair) this.showFlash(E.i18n.t('no_moves'));
      } else if (id === 'shuffle') {
        var rng = E.rng.mulberry32(Date.now() % 100000);
        G.entities.shuffle(this.tiles, rng);
        this.updateTileStates();
        this.selected = null;
        this.clearHint();
      } else if (id === 'time') {
        this.timeLeft += 30;
      } else if (id === 'undo') {
        var last = this.history.pop();
        if (last) {
          last.a.removed = false;
          last.b.removed = false;
          this.updateTileStates();
        }
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

    /* ---------- capture API ---------- */
    applyCaptureParams: function () {
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
        timeLeft: Math.round(this.timeLeft),
        tilesLeft: this.tiles.filter(function (t) { return !t.removed; }).length
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
