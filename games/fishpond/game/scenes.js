/* game/scenes.js — сцены «Рыбного Пруда»: меню, игра, over.
   Механика: тап по рыбке → очки, тап по пузырю → монеты.
   Бесконечная игра, рекорд сохраняется. Без уровней, без бустеров, без RV.
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
      var y0 = h * 0.5;
      var gap = 14;

      this.buttons = [];
      this.buttons.push({ id: 'play', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_play') });
      y0 += bh + gap;
      this.buttons.push({ id: 'snd', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_snd') + ': ' + (E.audio.muted ? 'OFF' : 'ON') });
      y0 += bh + gap;
      this.buttons.push({ id: 'lang', x: cx - bw / 2, y: y0, w: bw, h: bh, text: E.i18n.t('menu_lang') });
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

      // демо-рыбки
      var cx = w / 2, cy = h * 0.25;
      for (var i = 0; i < 3; i++) {
        var bob = Math.sin(this.t * 2 + i) * 5;
        G.art.drawFish(ctx, cx + (i - 1) * 80, cy + bob, 30, i + 1, 1, this.t);
      }

      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = Math.min(44, w * 0.08);
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(10,26,42,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(E.i18n.t('title'), cx, cy + 80);
      var tg = ctx.createLinearGradient(0, cy + 80 - size / 2, 0, cy + 80 + size / 2);
      tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, P.accent);
      ctx.fillStyle = tg; ctx.fillText(E.i18n.t('title'), cx, cy + 80);

      // рекорд
      var best = E.storage.get('fishpond_best') || 0;
      if (best > 0) {
        ctx.font = '600 16px system-ui, sans-serif';
        ctx.fillStyle = P.coin;
        ctx.fillText(E.i18n.t('hud_best') + ': ' + best, cx, cy + 120);
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
        E.core.setScene(SC.play, {});
      } else if (id === 'snd') {
        E.audio.toggleMute();
        this.buildButtons(this.game);
      } else if (id === 'lang') {
        E.i18n.setLang(E.i18n.lang === 'ru' ? 'en' : 'ru');
        this.buildButtons(this.game);
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
      this.score = 0;
      this.coins = 0;
      this.mode = 'running'; // running | over
      this.t = 0;
      this.fishes = [];
      this.bubbles = [];
      this.flashMsg = null;
      this.flashTimer = 0;
      this.tutorialStep = E.storage.get('fishpond_tutorial') ? 2 : 0;
      this.tutorialTimer = 0;
      this.timeLeft = 60; // 60 секунд на сессию

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!opts.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;

      E.audio.music('play');
      E.sdk.gameplayStart();
      E.sdk.hideBanner();

      this.rng = new E.Rng((E.core.seed || 1));
      this.layout(game);
      this.spawnFish();
      this.applyCaptureParams(opts);
    },

    layout: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      this.w = w;
      this.h = h;
      this.hudH = 60;
    },

    spawnFish: function () {
      for (var i = 0; i < G.config.fish.count; i++) {
        this.fishes.push(G.entities.makeFish(this.rng.float.bind(this.rng), this.w, this.h));
      }
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
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.gameOver();
        }

        // обновление рыбок
        for (var i = 0; i < this.fishes.length; i++) {
          var bubble = G.entities.updateFish(this.fishes[i], dt, this.w, this.h, this.rng.float.bind(this.rng));
          if (bubble) this.bubbles.push(bubble);
        }

        // обновление пузырей
        for (var i = this.bubbles.length - 1; i >= 0; i--) {
          if (!G.entities.updateBubble(this.bubbles[i], dt)) {
            this.bubbles.splice(i, 1);
          }
        }

        // туториал
        if (this.tutorialStep < 2) {
          this.tutorialTimer += dt;
          if (this.tutorialTimer > 4) {
            this.tutorialStep++;
            this.tutorialTimer = 0;
            if (this.tutorialStep >= 2) E.storage.set('fishpond_tutorial', true);
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

      if (this.mode === 'over') { this.handleOverTap(x, y); return; }
      if (this.mode !== 'running') return;

      // тап по рыбке
      for (var i = 0; i < this.fishes.length; i++) {
        if (G.entities.hitFish(this.fishes[i], x, y)) {
          this.score += G.config.fish.tapScore;
          this.coins += G.config.fish.tapCoin;
          E.audio.sfx('click');
          E.fx.burst(x, y, G.config.palette.accent, 8, 100, this.rng);
          // рыбка убегает и появляется новая
          this.fishes[i] = G.entities.makeFish(this.rng.float.bind(this.rng), this.w, this.h);
          return;
        }
      }

      // тап по пузырю
      for (var i = this.bubbles.length - 1; i >= 0; i--) {
        if (G.entities.hitBubble(this.bubbles[i], x, y)) {
          this.score += G.config.fish.bubbleValue * 5;
          this.coins += G.config.fish.bubbleValue;
          E.audio.sfx('coin');
          E.fx.burst(x, y, G.config.palette.bubble, 6, 80, this.rng);
          this.bubbles.splice(i, 1);
          return;
        }
      }
    },

    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.5;

      // тап по случайной рыбке
      if (this.fishes.length > 0) {
        var fish = this.fishes[Math.floor(this.rng.float() * this.fishes.length)];
        this.handleTap(fish.x, fish.y);
      }
    },

    gameOver: function () {
      var E = window.Engine;
      this.mode = 'over';
      E.sdk.gameplayStop();
      E.sdk.showBanner();

      var best = E.storage.get('fishpond_best') || 0;
      if (this.score > best) {
        E.storage.set('fishpond_best', this.score);
      }
      E.audio.sfx('over');
    },

    draw: function (game, ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      G.art.drawBackground(ctx, w, h, this.t);

      // пузыри
      for (var i = 0; i < this.bubbles.length; i++) {
        var b = this.bubbles[i];
        G.art.drawBubble(ctx, b.x, b.y, b.size, this.t);
      }

      // рыбки
      for (var i = 0; i < this.fishes.length; i++) {
        var f = this.fishes[i];
        G.art.drawFish(ctx, f.x, f.y, f.size, f.color, f.dir, this.t);
      }

      // HUD
      this.drawHUD(ctx);

      // туториал
      if (this.tutorialStep < 2) {
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

      // оверлей
      if (this.mode === 'over') this.drawOver(ctx);
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
      ctx.fillText(E.i18n.t('hud_score') + ': ' + this.score, 12, 20);

      ctx.fillStyle = P.coin;
      ctx.textAlign = 'right';
      ctx.fillText(this.coins + ' ✨', w - 12, 20);

      // время
      var timeColor = this.timeLeft < 10 ? P.bad : P.text;
      ctx.fillStyle = timeColor;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(this.timeLeft) + 's', w / 2, 20);
    },

    drawTutorial: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;
      var msgs = [E.i18n.t('tutorial_1'), E.i18n.t('tutorial_2')];
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

    drawOver: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);

      var bw = Math.min(320, w - 40), bh = 260;
      var bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.fillStyle = P.panel;
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      E.ui.roundRect(ctx, bx, by, bw, bh, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = P.text;
      ctx.font = '700 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(E.i18n.t('over_title'), w / 2, by + 50);

      ctx.fillStyle = P.coin;
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText(E.i18n.t('over_score', { n: this.score }), w / 2, by + 100);

      var best = E.storage.get('fishpond_best') || 0;
      ctx.fillStyle = P.dim;
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText(E.i18n.t('over_best', { n: best }), w / 2, by + 140);

      this.overButtons = [
        { id: 'retry', x: bx + 20, y: by + 170, w: bw - 40, h: 48, text: E.i18n.t('over_retry') },
        { id: 'menu', x: bx + 20, y: by + 228, w: bw - 40, h: 44, text: E.i18n.t('over_menu') }
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

    handleOverTap: function (x, y) {
      var E = window.Engine;
      for (var i = 0; i < this.overButtons.length; i++) {
        var b = this.overButtons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          E.audio.sfx('click');
          if (b.id === 'retry') {
            E.core.setScene(SC.play, {});
          } else {
            E.core.setScene(SC.menu);
          }
          return;
        }
      }
    },

    /* ---------- capture API ---------- */
    applyCaptureParams: function (opts) {
      var E = window.Engine;
      var P = E.capture.params;
      if (P.t) {
        // симулируем t секунд игры
        var steps = Math.floor(parseFloat(P.t) * 60);
        for (var i = 0; i < steps; i++) {
          this.update(this.game, 1 / 60);
        }
      }
      if (P.mode === 'over') this.gameOver();
      if (P.freeze === '1' && this.game) { this.game.pause('capture'); this.game.render(); }
    },
    getCaptureState: function () {
      return {
        scene: 'play',
        score: this.score,
        coins: this.coins,
        mode: this.mode,
        timeLeft: Math.ceil(this.timeLeft)
      };
    },
    setCaptureState: function (s) {
      if (s.score !== undefined) this.score = s.score;
      if (s.coins !== undefined) this.coins = s.coins;
      if (s.mode) this.mode = s.mode;
    }
  };

  G.scenes = SC;
})(window.GAME);
