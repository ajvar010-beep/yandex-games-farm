/* game/scenes.js — сцены «Шарового Залпа»: меню, игра, лавка, пауза, fail/revive.
   Механика: drag для прицеливания, отпуск для выстрела. Цель: очистить потолок.
   Бустеры: rainbow (любой цвет), bomb (взрыв 3×3), laser (прямая линия), shots (+5).
   Стрик: ежедневный бонус. RV-revive на fail, interstitial после победы.
   КРИТИЧНО: диспетчер ввода в update для ВСЕХ режимов, анимации, звук на каждом действии. */

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
      var hasSave = E.storage.get('bubblepop_run');
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
      var last = E.storage.get('bubblepop_last_day');
      var streak = E.storage.get('bubblepop_streak') || 0;
      var today = new Date().toDateString();
      if (last !== today) {
        var yesterday = new Date(Date.now() - 864e5).toDateString();
        if (last === yesterday) streak++; else streak = 1;
        E.storage.set('bubblepop_last_day', today);
        E.storage.set('bubblepop_streak', streak);
        var reward = G.config.streak.rewardBase + (streak - 1) * G.config.streak.rewardPerDay;
        var coins = E.storage.get('bubblepop_coins') || 0;
        E.storage.set('bubblepop_coins', coins + reward);
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

      // демо-шарики
      var cx = w / 2, cy = h * 0.25;
      var size = Math.min(40, w * 0.08);
      for (var i = 0; i < 5; i++) {
        var bob = Math.sin(this.t * 2 + i) * 5;
        G.art.drawBubble(ctx, cx + (i - 2) * (size + 10), cy + bob, size, i + 1, 'idle', this.t);
      }

      // маскот
      G.art.drawMascot(ctx, w * 0.15, h * 0.35, Math.min(50, w * 0.1), this.t, 'happy');

      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = Math.min(44, w * 0.08);
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(10,26,42,0.9)'; ctx.lineJoin = 'round';
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

      // рекорд
      var best = E.storage.get('bubblepop_best') || 0;
      if (best > 0) {
        ctx.font = '600 16px system-ui, sans-serif';
        ctx.fillStyle = P.coin;
        ctx.fillText(E.i18n.t('best_score', { n: best }), cx, cy + 160);
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
        E.storage.remove('bubblepop_run');
        E.core.setScene(SC.play, { level: 1 });
      } else if (id === 'cont') {
        var run = E.storage.get('bubblepop_run');
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
      this.coins = opts.coins !== undefined ? opts.coins : (E.storage.get('bubblepop_coins') || G.config.economy.startCoins);
      this.score = opts.score || 0;
      this.mode = 'running'; // running | shop | over | paused | fail | revive
      this.reviveUsed = false;
      this.t = 0;
      this.history = [];
      this.flashMsg = null;
      this.flashTimer = 0;
      this.tutorialStep = E.storage.get('bubblepop_tutorial') ? 3 : 0;
      this.tutorialTimer = 0;

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
      this.colors = level.colors;
      this.shots = G.config.game.shotsBase + (lv - 1) * G.config.game.shotsPerLevel;
      this.currentColor = 1 + Math.floor(this.rng.float() * this.colors);
      this.nextColor = 1 + Math.floor(this.rng.float() * this.colors);
      this.special = null; // текущий спец-шарик
      this.aim = { x: 0, y: 0, active: false };
      this.flying = null; // { x, y, vx, vy, color, special }
      this.combo = 0;
      this.reviveUsed = false;
      this.history = [];
      this.mode = 'running';
    },

    layout: function (game) {
      var E = window.Engine;
      var w = game.view.w, h = game.view.h;
      var hudH = 60;
      var boardTop = hudH + 10;
      var boardH = h - boardTop - 100;
      var boardW = w - 40;

      this.hudH = hudH;
      this.cellSize = Math.min(boardW / G.entities.COLS, boardH / G.entities.ROWS);
      this.boardX = (w - this.cellSize * G.entities.COLS) / 2;
      this.boardY = boardTop;
      this.ceilingY = this.boardY;

      // панель внизу: текущий шарик + следующий + кнопки
      this.panelY = h - 80;
      this.currentX = w / 2 - 60;
      this.nextX = w / 2 + 20;

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

      // drag для прицеливания
      if (E.input.pointer.down && E.input.pointer.moved && this.mode === 'running' && !this.flying) {
        this.aim.x = E.input.pointer.x;
        this.aim.y = E.input.pointer.y;
        this.aim.active = true;
      }
      if (E.input.pointer.released && this.aim.active && this.mode === 'running' && !this.flying) {
        this.shoot();
      }

      if (this.mode === 'running') {
        // обновление летящего шарика
        if (this.flying) {
          this.updateFlying(dt);
        }
        // потолок опускается
        var dropSpeed = G.config.game.dropSpeedBase + (this.level - 1) * G.config.game.dropSpeedPerLevel;
        this.ceilingY += dropSpeed * dt;
        // проверка поражения: потолок достиг панели
        if (this.ceilingY > this.panelY - 50) {
          this.failLevel();
        }
        // туториал
        if (this.tutorialStep < 3) {
          this.tutorialTimer += dt;
          if (this.tutorialTimer > 4) {
            this.tutorialStep++;
            this.tutorialTimer = 0;
            if (this.tutorialStep >= 3) E.storage.set('bubblepop_tutorial', true);
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
    },

    shoot: function () {
      var E = window.Engine;
      if (this.shots <= 0) {
        this.failLevel();
        return;
      }
      var dx = this.aim.x - this.currentX;
      var dy = this.aim.y - this.panelY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 20) return; // слишком короткий drag
      // блокируем стрельбу вниз
      if (dy > 0) return;

      var speed = G.config.physics.ballSpeed;
      var vx = dx / dist * speed;
      var vy = dy / dist * speed;

      this.flying = {
        x: this.currentX, y: this.panelY,
        vx: vx, vy: vy,
        color: this.special ? this.special.color : this.currentColor,
        special: this.special ? this.special.special : null
      };
      this.shots--;
      this.aim.active = false;
      this.special = null;
      E.audio.sfx('shoot');
    },

    updateFlying: function (dt) {
      var E = window.Engine;
      var f = this.flying;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      // отскок от стен
      if (f.x < G.config.physics.ballRadius || f.x > this.game.view.w - G.config.physics.ballRadius) {
        f.vx = -f.vx * G.config.physics.bounceDamping;
        E.audio.sfx('click');
      }

      // попадание в потолок или шарики
      if (f.y <= this.ceilingY) {
        this.landBall(f.x, this.ceilingY);
        return;
      }

      // проверка попадания в существующие шарики
      var hit = G.entities.findHit(this.grid, f.x, f.y, f.color, this.cellSize, this.boardX, this.boardY);
      if (hit) {
        this.landBall(hit.pos.x, hit.pos.y);
        return;
      }

      // выход за экран
      if (f.y > this.game.view.h + 50) {
        this.flying = null;
        this.nextShot();
      }
    },

    landBall: function (x, y) {
      var E = window.Engine;
      var f = this.flying;
      this.flying = null;

      // находим ближайшую свободную клетку
      var bestX = -1, bestY = -1, bestDist = Infinity;
      for (var gy = 0; gy < G.entities.ROWS; gy++) {
        for (var gx = 0; gx < G.entities.COLS; gx++) {
          if (this.grid[gy][gx]) continue;
          var pos = G.entities.gridToScreen(gx, gy, this.cellSize, this.boardX, this.boardY);
          var dx = x - pos.x, dy = y - pos.y;
          var dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            bestX = gx;
            bestY = gy;
          }
        }
      }

      if (bestX < 0) {
        this.nextShot();
        return;
      }

      // ставим шарик
      this.grid[bestY][bestX] = {
        color: f.color,
        special: f.special,
        x: bestX, y: bestY
      };

      // спец-шарик активируется при посадке
      if (f.special) {
        var affected = G.entities.applySpecial(this.grid, bestX, bestY, f.special);
        if (affected.length > 0) {
          G.entities.explode(this.grid, affected);
          var score = affected.length * 15;
          this.score += score;
          this.coins += Math.floor(score / 20);
          E.audio.sfx('explode');
          E.fx.flash(G.config.palette.good, 0.3);
          E.fx.burst(x, y, G.config.palette.good, 20, 200, this.rng);
          this.addFloater(x, y, '+' + score, G.config.palette.good);
          if (G.entities.isClear(this.grid)) {
            this.completeLevel();
            return;
          }
        }
        this.nextShot();
        return;
      }

      // проверка взрыва
      var matches = G.entities.findMatches(this.grid, bestX, bestY);
      if (matches.length >= 3) {
        this.combo++;
        var score = matches.length * 10 * this.combo;
        this.score += score;
        this.coins += Math.floor(score / 20);
        G.entities.explode(this.grid, matches);
        // каскадный отвал: оторванные от потолка кластеры падают
        var orphans = G.entities.dropOrphans(this.grid);
        if (orphans.length > 0) {
          var orphanScore = orphans.length * 5;
          this.score += orphanScore;
          this.coins += Math.floor(orphanScore / 20);
          E.audio.sfx('wave');
          for (var i = 0; i < orphans.length; i++) {
            var o = orphans[i];
            var pos = G.entities.gridToScreen(o.x, o.y, this.cellSize, this.boardX, this.boardY);
            E.fx.burst(pos.x, pos.y, G.config.palette.accent, 5, 80, this.rng);
          }
          this.addFloater(x, y, '+' + orphanScore + ' падение', G.config.palette.accent);
        }
        E.audio.sfx('explode');
        E.fx.flash(G.config.palette.good, 0.3);
        E.fx.burst(x, y, G.config.palette.good, 15, 150, this.rng);
        this.addFloater(x, y, '+' + score + (this.combo > 1 ? ' ×' + this.combo : ''), G.config.palette.good);

        // проверка победы
        if (G.entities.isClear(this.grid)) {
          this.completeLevel();
          return;
        }
      } else {
        this.combo = 0;
        E.audio.sfx('hit');
      }

      // проверка поражения
      if (G.entities.isGameOver(this.grid, 8)) {
        this.failLevel();
        return;
      }

      this.nextShot();
    },

    nextShot: function () {
      this.currentColor = this.nextColor;
      this.nextColor = 1 + Math.floor(this.rng.float() * this.colors);
      if (this.shots <= 0) {
        this.failLevel();
      }
    },

    completeLevel: function () {
      var E = window.Engine;
      this.mode = 'over';
      var reward = G.config.economy.winBase + (this.level - 1) * G.config.economy.winPerLevel;
      if (E.capture.record > 0) reward = Math.min(reward, 500);
      this.lastReward = reward;
      this.coins += reward;
      E.storage.set('bubblepop_coins', this.coins);

      var best = E.storage.get('bubblepop_best') || 0;
      if (this.level > best) E.storage.set('bubblepop_best', this.level);
      E.storage.set('bubblepop_run', { level: this.level + 1, coins: this.coins });

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
          E.audio.sfx('revive');
          self.shots += 5;
          self.reviveUsed = true;
          self.mode = 'running';
          E.sdk.gameplayStart();
          E.sdk.hideBanner();
        },
        onError: function () {
          self.mode = 'fail';
          E.sdk.gameplayStop();
          E.sdk.showBanner();
        }
      });
    },

    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.8;
      if (this.mode !== 'running') return;
      if (this.flying) return;

      // автопилот: целимся в лучший ход
      var best = G.entities.findBestShot(this.grid, this.currentColor, this.cellSize, this.boardX, this.boardY);
      if (best) {
        this.aim.x = best.x;
        this.aim.y = best.y;
        this.aim.active = true;
        this.shoot();
      } else {
        // случайный выстрел вверх
        this.aim.x = this.currentX;
        this.aim.y = this.panelY - 100;
        this.aim.active = true;
        this.shoot();
      }
    },

    addFloater: function (x, y, text, color) {
      if (!this.floaters) this.floaters = [];
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },

    draw: function (game, ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      G.art.drawBackground(ctx, w, h, this.t);

      // HUD
      this.drawHUD(ctx);

      // потолок
      ctx.fillStyle = P.ceiling;
      ctx.fillRect(0, this.ceilingY - 10, w, 10);
      ctx.strokeStyle = P.panelBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, this.ceilingY); ctx.lineTo(w, this.ceilingY); ctx.stroke();

      // шарики на сетке
      for (var y = 0; y < G.entities.ROWS; y++) {
        for (var x = 0; x < G.entities.COLS; x++) {
          var cell = this.grid[y][x];
          if (!cell) continue;
          var pos = G.entities.gridToScreen(x, y, this.cellSize, this.boardX, this.boardY);
          G.art.drawBubble(ctx, pos.x, pos.y, this.cellSize * 0.45, cell.color, 'idle', this.t);
        }
      }

      // прицел
      if (this.aim.active && !this.flying) {
        ctx.save();
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(this.currentX, this.panelY);
        ctx.lineTo(this.aim.x, this.aim.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // летящий шарик
      if (this.flying) {
        G.art.drawBubble(ctx, this.flying.x, this.flying.y, G.config.physics.ballRadius, this.flying.color, 'flying', this.t);
      }

      // панель внизу
      this.drawPanel(ctx);

      // маскот — реагирует на события
      var mood = 'idle';
      if (this.mode === 'over') mood = 'happy';
      else if (this.mode === 'fail') mood = 'sad';
      else if (this.combo > 0) mood = 'happy';
      G.art.drawMascot(ctx, w * 0.1, h * 0.8, Math.min(40, w * 0.08), this.t, mood);

      // флоатеры
      this.drawFloaters(ctx);

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
      ctx.fillText(E.i18n.t('hud_shots', { n: this.shots }), w / 2, 20);

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

    drawPanel: function (ctx) {
      var E = window.Engine;
      var w = this.game.view.w, h = this.game.view.h;
      var P = G.config.palette;

      // фон панели
      ctx.fillStyle = P.panel;
      ctx.fillRect(0, this.panelY - 10, w, h - this.panelY + 10);

      // текущий шарик
      G.art.drawBubble(ctx, this.currentX, this.panelY, G.config.physics.ballRadius, this.currentColor, 'idle', this.t);

      // следующий шарик
      G.art.drawBubble(ctx, this.nextX, this.panelY, G.config.physics.ballRadius * 0.7, this.nextColor, 'idle', this.t);

      // спец-шарик
      if (this.special) {
        var label = this.special.special === 'rainbow' ? '🌈' : this.special.special === 'bomb' ? '💣' : '⚡';
        ctx.fillStyle = P.accent;
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, this.nextX + 50, this.panelY);
      }
    },

    drawFloaters: function (ctx) {
      if (!this.floaters) return;
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i];
        f.t += 1 / 60;
        if (f.t > 1.2) { this.floaters.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = 1 - f.t / 1.2;
        ctx.fillStyle = f.color;
        ctx.font = '700 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y - f.t * 40);
        ctx.restore();
      }
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
        { id: 'rainbow', name: E.i18n.t('item_rainbow'), desc: E.i18n.t('item_rainbow_desc'), price: C.rainbowPrice },
        { id: 'bomb', name: E.i18n.t('item_bomb'), desc: E.i18n.t('item_bomb_desc'), price: C.bombPrice },
        { id: 'laser', name: E.i18n.t('item_laser'), desc: E.i18n.t('item_laser_desc'), price: C.laserPrice },
        { id: 'shots', name: E.i18n.t('item_shots'), desc: E.i18n.t('item_shots_desc'), price: C.shotsPrice }
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
            E.storage.set('bubblepop_coins', self.coins);
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
      E.storage.set('bubblepop_coins', this.coins);
      E.audio.sfx('buy');

      if (id === 'rainbow') {
        this.special = { color: 0, special: 'rainbow' };
      } else if (id === 'bomb') {
        this.special = { color: 0, special: 'bomb' };
      } else if (id === 'laser') {
        this.special = { color: 0, special: 'laser' };
      } else if (id === 'shots') {
        this.shots += 5;
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
        shots: this.shots
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
