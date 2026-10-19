/* game/scenes.js — сцены «Сладкого Рая»: menu и play.
   Механика: свап соседних сладостей (тап-тап или свайп); совпадения 3+ очищаются,
   каскады начисляют бонусы. Цель уровня — очки за ограниченные ходы. Бустеры
   за монеты: бомба, гроздь (ряд), перемешать, подсказка; rewarded-монеты в лавке,
   fullscreen после уровня. Баннер — только вне геймплея (4.6). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function T(k, v) { return E.i18n.t(k, v); }

  /* ============================================================ MENU */
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.t = 0;
      this.layout(game);
    },
    exit: function () { E.sdk.hideBanner(); },
    onResize: function (game) { this.layout(game); },
    layout: function (game) {
      var v = game.view, w = v.w, h = v.h;
      var t = E.i18n;
      var inset = E.sdk.bannerInsetPx();
      var availH = h - inset;
      var k = clamp(availH / 560, 0.66, 1);
      var bw = Math.min(320, w * 0.8), bh = Math.round(58 * k), cx = w / 2;
      var rowH = Math.round(44 * k), gap = Math.round(12 * k);
      var best = E.storage.get('best', 0);
      var savedRun = E.storage.get('run', null);
      this.best = best; this.k = k; this.inset = inset;

      this.titleY = availH * 0.12;
      this.stageY = availH * 0.4;
      this.stageH = Math.min(availH * 0.3, 180);

      var rows = [];
      if (savedRun && savedRun.level > 1) rows.push({ h: bh, gap: gap });
      rows.push({ h: bh, gap: gap });
      rows.push({ h: rowH, gap: 0 });
      var col = E.ui.layoutColumn(rows, availH - (this.stageY + this.stageH / 2 + 30) - 10, { alignTop: true });
      var y0 = this.stageY + this.stageH / 2 + 18;
      this.buttons = [];
      var self = this;
      var ri = 0;
      if (savedRun && savedRun.level > 1) {
        this.buttons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0 + col.ys[ri++], w: bw, h: bh * col.scale,
          fontSize: Math.max(15, Math.round(22 * k * col.scale)),
          text: t.t('menu_cont') + ' (' + t.t('hud_level', { n: savedRun.level }) + ')',
          bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
          onTap: function () { E.audio.sfx('click'); game.setScene('play', { resume: savedRun }); }
        }));
      }
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + col.ys[ri++], w: bw, h: bh * col.scale,
        fontSize: Math.max(15, Math.round(26 * k * col.scale)), text: t.t('menu_play'),
        bg: '#ff8fb2', border: '#e5628a', fg: '#2b0a1a',
        onTap: function () { E.audio.sfx('click'); game.setScene('play', {}); }
      }));
      var sw = Math.floor((bw - 24) / 3), fs = Math.max(10, Math.round(14 * k * col.scale));
      var yy = y0 + col.ys[ri];
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: yy, w: sw, h: rowH * col.scale, fontSize: fs, id: 'snd',
        text: E.audio.isMuted() ? t.t('snd_off') : t.t('snd_on'),
        onTap: function (b) {
          var m = !E.audio.isMuted();
          E.audio.setMuted(m); E.storage.set('muted', m, true);
          b.text = m ? t.t('snd_off') : t.t('snd_on');
          E.audio.sfx('click');
        }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + sw + 12, y: yy, w: sw, h: rowH * col.scale, fontSize: fs, id: 'lang',
        text: t.t('lang_btn'),
        onTap: function () {
          E.audio.sfx('click');
          var nl = E.i18n.lang === 'ru' ? 'en' : 'ru';
          E.i18n.setLang(nl); E.storage.set('lang', nl, true);
          document.title = E.i18n.t('title');
          MenuScene.layout(game);
        }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + 2 * (sw + 12), y: yy, w: sw, h: rowH * col.scale,
        fontSize: Math.max(9, Math.round(11 * k * col.scale)), id: 'auth',
        text: E.storage.authorized ? t.t('menu_auth_ok') : t.t('menu_auth'),
        bg: E.storage.authorized ? '#2f9e44' : '#fc5c7d',
        border: E.storage.authorized ? '#237032' : '#c92a4f',
        onTap: function () {
          if (E.storage.authorized) return;
          E.audio.sfx('click');
          E.storage.authorize().then(function (ok) { if (ok) MenuScene.layout(game); });
        }
      }));
    },
    update: function (game, dt) {
      this.t += dt;
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', {});
    },
    draw: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      G.art.drawBackground(ctx, v.w, v.h, this.t);
      var kinds = G.config.kinds;
      var s0 = Math.min(v.w, v.h);
      for (var i = 0; i < 4; i++) {
        G.art.drawCandy(ctx, v.w * (0.24 + i * 0.17), this.stageY + Math.sin(this.t * 1.5 + i * 1.3) * 12, s0 * 0.07, kinds[i], this.t + i * 0.6, i === 1);
      }
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 52 * (this.k || 1), 800);
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(30,15,48,0.95)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.strokeText(title, v.w / 2, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#ffb3c9');
      ctx.fillStyle = tg; ctx.fillText(title, v.w / 2, this.titleY);
      if (this.best > 0) E.ui.text(ctx, t.t('over_best', { n: this.best }), v.w / 2, this.titleY + 32 * (this.k || 1), Math.round(16 * (this.k || 1)), P.dim);
      E.ui.drawButtons(ctx, this.buttons);
      var hintSize = E.ui.fit(ctx, t.t('menu_hint'), v.w * 0.92, Math.max(10, Math.round(13 * (this.k || 1))), 400);
      E.ui.text(ctx, t.t('menu_hint'), v.w / 2, v.h - (this.inset || 0) - 18, hintSize, P.dim, 'center', 400);
      E.ui.text(ctx, 'v' + G.version, 10, v.h - (this.inset || 0) - 12, 12, P.dim, 'left', 400);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ============================================================ PLAY */
  var PlayScene = {
    /* ---------- lifecycle ---------- */
    enter: function (game, params) {
      var C = G.config;
      E.sdk.hideBanner();
      E.fx.reset();
      G.art.init();
      var seed = (params.seed != null) ? params.seed
               : (E.capture.seed != null) ? E.capture.seed
               : ((Date.now() % 2147483647) | 0);
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running'; // running | shop | over | paused | fail
      this.coins = C.economy.startCoins;
      this.hint = null;
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0;
      this.bought = { bomb: 0, row: 0, shuffle: 0, hint: 0 };
      this.win = false;
      this.pendingCascade = 0; this.cascadeLevel = 0;

      if (params.resume && params.resume.level > 1) {
        this.level = params.resume.level;
        this.coins = params.resume.coins || C.economy.startCoins;
      } else {
        this.level = 1;
      }
      this.startLevel(this.level);

      this.layout(game);
      this.buildHudButtons(game);
      E.audio.music('play');
      E.sdk.gameplayStart();

      this.applyCaptureParams(game, params);
      this.saveGame();
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      this.buildHudButtons(game);
      if (this.mode === 'shop') this.buildShopButtons(game);
      if (this.mode === 'over' || this.mode === 'fail') this.buildOverButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    /* ---------- уровень ---------- */
    startLevel: function (level) {
      this.rng = new E.Rng(this.seedNum ^ (level * 7919));
      this.board = G.match.freshBoard(level, this.rng);
      this.moves = G.config.levelMoves(level);
      this.movesMax = this.moves;
      this.score = 0;
      this.target = G.config.levelTarget(level);
      this.sel = null;
      this.hint = null;
      this.win = false;
      this.pendingCascade = 0; this.cascadeLevel = 0;
      this.layoutCells();
    },
    layoutCells: function () { /* позиции считаются в layout() */ },
    layout: function (game) {
      var v = game.view;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      this.hudH = Math.max(46, availH * 0.1);
      this.inset = inset;
      var area = { x0: 16, y0: this.hudH + 16, x1: v.w - 16, y1: availH - 20 };
      var side = Math.min(area.x1 - area.x0, area.y1 - area.y0);
      var cell = side / G.config.board.cols;
      this.cell = cell;
      this.boardX = (v.w - side) / 2;
      this.boardY = area.y0 + Math.max(0, (area.y1 - area.y0 - side) / 2);
      this.area = area;
    },

    /* ---------- capture ---------- */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      this.autopilot = true;
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.update(game, dt);
        if (E.fx) E.fx.update(dt);
        game.time += dt;
      }
      this.autopilot = keepAuto;
    },
    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave) {
        var lv = clamp(parseInt(P.wave, 10) || 1, 1, G.config.maxLevel);
        this.level = lv;
        this.startLevel(lv);
        this.coins = 300;
        this.moves = Math.max(6, Math.floor(this.moves * 0.6));
        this.score = Math.floor(this.target * 0.4);
      }
      if (P.coins) this.coins = Math.max(0, parseInt(P.coins, 10) || 0);
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0));
      if (P.mode === 'over') { this.completeLevel(game); }
      else if (P.mode === 'fail') { this.failLevel(game); }
      else {
        if (tsec > 0) this.simulateCombat(game, tsec);
        if (P.mode === 'shop') this.openShop(game);
      }
      if (P.freeze === '1') { game.pause('capture'); game.render(); }
    },
    setCaptureState: function (game, s) {
      if (s.seed != null) this.seedNum = (typeof s.seed === 'string') ? E.seedFromString(s.seed) : (s.seed >>> 0);
      if (s.wave) { this.level = clamp(s.wave, 1, G.config.maxLevel); this.startLevel(this.level); }
      if (s.coins != null) this.coins = s.coins;
      if (s.mode === 'shop') this.openShop(game);
      if (s.mode === 'over') this.completeLevel(game);
    },
    getCaptureState: function (game) {
      return { scene: 'play', mode: this.mode, wave: this.level, level: this.level,
               moves: this.moves, score: this.score, coins: Math.floor(this.coins), fps: game.fps };
    },

    /* ---------- свап и разрешение ---------- */
    trySwap: function (game, r1, c1, r2, c2) {
      var C = G.config, M = G.match;
      var kinds = C.kindsCount(this.level);
      if (!M.legalSwap(this.board, r1, c1, r2, c2, kinds)) {
        this.sel = null;
        E.audio.sfx('deny');
        return;
      }
      var t = this.board[r1][c1]; this.board[r1][c1] = this.board[r2][c2]; this.board[r2][c2] = t;
      this.moves--;
      this.sel = null;
      this.hint = null;
      E.audio.sfx('click');
      this.resolveBoard(game);
      this.saveGame();
    },
    resolveBoard: function (game) {
      var C = G.config, M = G.match;
      var kinds = C.kindsCount(this.level);
      var cascade = 0;
      for (;;) {
        var step = M.resolveStep(this.board, kinds);
        if (!step) break;
        cascade++;
        var cells = step.cells;
        var base = cells.length >= 5 ? C.score.match5 : cells.length === 4 ? C.score.match4 : C.score.match3;
        var gained = base + (cascade - 1) * C.score.cascadeStep;
        this.score += gained;
        for (var i = 0; i < cells.length; i++) {
          var pr = cells[i].split(',');
          var x = this.boardX + (+pr[1] + 0.5) * this.cell, y = this.boardY + (+pr[0] + 0.5) * this.cell;
          E.fx.burst(x, y, '#ffd43b', 8, 100, new E.Rng(this.seedNum ^ (this.score + i)));
        }
        M.clearAndDrop(this.board, step.cells.reduce(function (o, k) { o[k] = true; return o; }, {}), kinds, this.rng);
        E.audio.sfx(cascade > 1 ? 'coin' : 'coin');
        if (cascade > 1) this.addFloater(this.boardX + G.config.board.cols * this.cell / 2, this.boardY + 20, '+' + gained + ' ×' + cascade, '#ffe066');
      }
      this.pendingCascade = cascade;
      if (this.score >= this.target) { this.completeLevel(game); return; }
      if (this.moves <= 0) { this.failLevel(game); return; }
      if (!M.anyMove(this.board, kinds)) {
        // нет ходов — перемешать бесплатно
        this.shuffleBoard();
      }
    },
    shuffleBoard: function () {
      var kinds = G.config.kindsCount(this.level);
      this.board = G.match.freshBoard(this.level, this.rng);
      this.sel = null; this.hint = null;
    },
    completeLevel: function (game) {
      this.win = true;
      var C = G.config;
      var reward = C.economy.winBase + (this.level - 1) * C.economy.winPerLevel;
      if (this.recordMode) reward = Math.min(reward, C.record.coinCap);
      this.coins += reward;
      this.reward = reward;
      var best = Math.max(E.storage.get('best', 0), this.level);
      this.newBest = (this.level === best);
      E.storage.set('best', best);
      E.audio.sfx('wave');
      E.fx.flash('#ffe066', 0.2);
      this.mode = 'over';
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.buildOverButtons(game);
      var self = this;
      if (!this.recordMode && !this.autopilot) {
        E.sdk.showInterstitial(function () { self.saveGame(); });
      }
    },
    failLevel: function (game) {
      this.mode = 'fail';
      E.sdk.gameplayStop();
      E.audio.sfx('over');
      this.buildOverButtons(game);
    },

    /* ---------- бустеры ---------- */
    cost: function (key) { var e = G.config.economy; return G.config.boosterCost(e[key + 'Price'], e[key + 'Growth'], this.bought[key]); },
    buyBomb: function (game) {
      var p = this.cost('bomb');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.bomb++;
      this.bombMode = true; // следующий тап по клетке очистит её
      E.audio.sfx('buy');
      this.buildShopButtons(game); this.saveGame();
    },
    buyRow: function (game) {
      var p = this.cost('row');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.row++;
      var r = Math.floor(this.rng.float() * G.config.board.rows) % G.config.board.rows;
      var kinds = G.config.kindsCount(this.level);
      var m = {};
      for (var c = 0; c < G.config.board.cols; c++) m[r + ',' + c] = true;
      G.match.clearAndDrop(this.board, m, kinds, this.rng);
      this.score += 40;
      E.audio.sfx('buy');
      this.buildShopButtons(game); this.saveGame();
    },
    buyShuffle: function (game) {
      var p = this.cost('shuffle');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.shuffle++;
      this.shuffleBoard();
      E.audio.sfx('buy');
      this.addFloater((this.area.x0 + this.area.x1) / 2, this.boardY - 10, T('item_shuffle'), '#ffe066');
      this.buildShopButtons(game); this.saveGame();
    },
    buyHint: function (game) {
      var p = this.cost('hint');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      var h = G.match.hintMove(this.board, G.config.kindsCount(this.level));
      if (!h) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.hint++;
      this.hint = h; this.hintT = 2.2;
      E.audio.sfx('buy');
      this.buildShopButtons(game); this.saveGame();
    },

    /* ---------- пауза / магазин ---------- */
    setPaused: function (on) {
      if (on && this.mode === 'running') { this.mode = 'paused'; E.sdk.gameplayStop(); this.buildPauseButtons(); }
      else if (!on && this.mode === 'paused') { this.mode = 'running'; E.sdk.gameplayStart(); }
    },
    openShop: function (game) {
      if (this.mode !== 'running') return;
      this.mode = 'shop'; E.sdk.gameplayStop(); this.buildShopButtons(game);
    },
    closeShop: function (game) { this.mode = 'running'; E.sdk.gameplayStart(); },

    /* ---------- ввод ---------- */
    update: function (game, dt) {
      if (this.mode === 'running') this.updateRunning(game, dt);
      if (this.hint) { this.hintT -= dt; if (this.hintT <= 0) this.hint = null; }
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
      for (var i = this.floaters ? this.floaters.length - 1 : -1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt;
        if (f.t > 1.2) this.floaters.splice(i, 1);
      }
    },
    updateRunning: function (game, dt) {
      if (this.autopilot) this.driveAutopilot(dt, game);
      else this.driveInput(game);
    },
    cellAt: function (px, py) {
      var c = Math.floor((px - this.boardX) / this.cell), r = Math.floor((py - this.boardY) / this.cell);
      if (r < 0 || r >= G.config.board.rows || c < 0 || c >= G.config.board.cols) return null;
      return { r: r, c: c };
    },
    driveInput: function (game) {
      var P = E.input.pointer;
      if (P.pressed) {
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) return;
        var cell = this.cellAt(P.x, P.y);
        if (!cell) { this.sel = null; return; }
        if (this.bombMode) {
          this.bombMode = false;
          var m = {}; m[cell.r + ',' + cell.c] = true;
          var kinds = G.config.kindsCount(this.level);
          G.match.clearAndDrop(this.board, m, kinds, this.rng);
          this.score += 40;
          E.fx.burst(this.boardX + (cell.c + 0.5) * this.cell, this.boardY + (cell.r + 0.5) * this.cell, '#ff6b81', 14, 130, this.rng);
          E.audio.sfx('buy');
          this.resolveBoard(game);
          return;
        }
        if (!this.sel) { this.sel = cell; E.audio.sfx('click'); return; }
        if (this.sel.r === cell.r && this.sel.c === cell.c) { this.sel = null; return; }
        if (Math.abs(this.sel.r - cell.r) + Math.abs(this.sel.c - cell.c) === 1) {
          this.trySwap(game, this.sel.r, this.sel.c, cell.r, cell.c);
        } else {
          this.sel = cell; E.audio.sfx('click');
        }
      }
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    driveAutopilot: function (dt, game) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.5;
      if (this.mode !== 'running') return;
      if (this.pendingCascade > 0) { this.pendingCascade = 0; return; } // кадр затишья после каскада
      var h = G.match.hintMove(this.board, G.config.kindsCount(this.level));
      if (h) this.trySwap(game, h.r1, h.c1, h.r2, h.c2);
    },

    /* ---------- кнопки ---------- */
    buildHudButtons: function (game) {
      var v = game.view;
      var s = Math.max(40, Math.min(48, v.w * 0.11));
      var self = this;
      this.hudButtons = [
        new E.ui.Button({ x: v.w - s - 8, y: 8, w: s, h: s, fontSize: 20, text: 'II', id: 'pause',
          onTap: function () { E.audio.sfx('click'); self.setPaused(true); } }),
        new E.ui.Button({ x: v.w - 2 * (s + 8), y: 8, w: s, h: s, fontSize: 20, text: '★', id: 'shop',
          onTap: function () { E.audio.sfx('click'); self.openShop(game); } })
      ];
    },
    buildPauseButtons: function () {
      var t = E.i18n, self = this;
      var bw = Math.min(260, window.innerWidth * 0.7), bh = 50;
      var cx = window.innerWidth / 2, y0 = window.innerHeight * 0.4;
      var game = E.sdk._game;
      this.pauseButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 20, text: t.t('pause_resume'),
          onTap: function () { E.audio.sfx('click'); self.setPaused(false); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 20, text: t.t('pause_restart'),
          onTap: function () { E.audio.sfx('click'); self.startLevel(self.level); self.setPaused(false); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + 2 * (bh + 12), w: bw, h: bh, fontSize: 20, text: t.t('pause_menu'),
          onTap: function () { E.audio.sfx('click'); E.sdk.gameplayStop(); game.setScene('menu', {}); } })
      ];
    },
    buildShopButtons: function (game) {
      var t = E.i18n, self = this;
      var v = game.view, C = G.config;
      var bw = Math.min(320, v.w * 0.84);
      var cx = v.w / 2;
      var items = [
        { key: 'bomb', label: t.t('item_bomb') + ' — ' + this.cost('bomb') + ' ✨' },
        { key: 'row', label: t.t('item_row') + ' — ' + this.cost('row') + ' ✨' },
        { key: 'shuffle', label: t.t('item_shuffle') + ' — ' + this.cost('shuffle') + ' ✨' },
        { key: 'hint', label: t.t('item_hint') + ' — ' + this.cost('hint') + ' ✨' }
      ];
      var rows = items.length + 2; // + RV + «дальше»
      var bh = Math.max(36, Math.min(50, (v.h * 0.54) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      var fns = { bomb: 'buyBomb', row: 'buyRow', shuffle: 'buyShuffle', hint: 'buyHint' };
      for (var i = 0; i < items.length; i++) {
        (function (idx) {
          var key = items[idx].key;
          self.shopButtons.push(new E.ui.Button({
            x: cx - bw / 2, y: y0 + idx * (bh + 8), w: bw, h: bh, fontSize: 15,
            text: items[idx].label,
            enabled: self.coins >= self.cost(key),
            onTap: function () { self[fns[key]](game); }
          }));
        })(i);
      }
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + items.length * (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('shop_rv', { n: C.economy.rvCoins }),
        bg: '#7c4dff', border: '#b197fc', fg: '#fff',
        onTap: function () {
          E.audio.sfx('click');
          E.sdk.showRewarded({ onReward: function () {
            self.coins += C.economy.rvCoins;
            self.addFloater(v.w / 2, v.h * 0.4, t.t('rv_done', { n: C.economy.rvCoins }), '#b197fc');
            self.buildShopButtons(game); self.saveGame();
          } });
        }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + (items.length + 1) * (bh + 8), w: bw, h: bh, fontSize: 18, text: t.t('shop_next'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
    },
    buildOverButtons: function (game) {
      var t = E.i18n, self = this;
      var v = game.view;
      var bw = Math.min(280, v.w * 0.76), bh = 50;
      var cx = v.w / 2, y0 = v.h * 0.58;
      var isWin = this.mode === 'over';
      this.overButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19,
          text: isWin ? t.t('over_next') : t.t('fail_retry'),
          bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
          onTap: function () {
            E.audio.sfx('click');
            E.sdk.hideBanner();
            if (isWin) {
              if (self.level >= G.config.maxLevel) { game.setScene('menu', {}); return; }
              self.level++;
            }
            self.mode = 'running';
            self.startLevel(self.level);
            E.sdk.gameplayStart();
          } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 19, text: t.t('over_menu'),
          onTap: function () { E.audio.sfx('click'); E.sdk.hideBanner(); game.setScene('menu', {}); } })
      ];
    },

    addFloater: function (x, y, text, color) {
      if (!this.floaters) this.floaters = [];
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },
    saveGame: function () {
      var best = Math.max(E.storage.get('best', 0), this.level);
      E.storage.set('best', best);
      E.storage.set('run', { level: this.level, coins: Math.floor(this.coins) });
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      G.art.drawBackground(ctx, v.w, v.h, game.time);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawWorld(game, ctx);
      this.drawHud(game, ctx);
      E.fx.draw(ctx);
      this.drawFloaters(ctx);
      ctx.restore();
      E.fx.drawFlash(ctx, v.w, v.h);
      if (this.mode === 'paused') this.drawPause(game, ctx);
      else if (this.mode === 'shop') this.drawShop(game, ctx);
      else if (this.mode === 'over' || this.mode === 'fail') this.drawOver(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
    },
    drawWorld: function (game, ctx) {
      var P = G.config.palette;
      var cell = this.cell, bx = this.boardX, by = this.boardY;
      var cols = G.config.board.cols, rows = G.config.board.rows;
      // доска
      ctx.fillStyle = P.board;
      E.ui.roundRect(ctx, bx - 6, by - 6, cols * cell + 12, rows * cell + 12, 14); ctx.fill();
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        ctx.fillStyle = ((r + c) % 2 === 0) ? P.cell : P.cellHot;
        ctx.fillRect(bx + c * cell + 1, by + r * cell + 1, cell - 2, cell - 2);
      }
      // подсказка
      if (this.hint) {
        ctx.save();
        ctx.globalAlpha = 0.45 + 0.25 * Math.sin(game.time * 8);
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
        var cells = [[this.hint.r1, this.hint.c1], [this.hint.r2, this.hint.c2]];
        for (var hi = 0; hi < 2; hi++) {
          var hr = cells[hi][0], hc = cells[hi][1];
          E.ui.roundRect(ctx, bx + hc * cell + 1, by + hr * cell + 1, cell - 2, cell - 2, 8); ctx.stroke();
        }
        ctx.restore();
      }
      // выбор
      if (this.sel) {
        ctx.save();
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
        E.ui.roundRect(ctx, bx + this.sel.c * cell + 1, by + this.sel.r * cell + 1, cell - 2, cell - 2, 8); ctx.stroke();
        ctx.restore();
      }
      // сладости
      for (var rr = 0; rr < rows; rr++) for (var cc = 0; cc < cols; cc++) {
        var kind = this.board[rr][cc];
        if (kind < 0) continue;
        var kname = G.config.kinds[kind % G.config.kinds.length];
        G.art.drawCandy(ctx, bx + (cc + 0.5) * cell, by + (rr + 0.5) * cell, cell * 0.36, kname, game.time + rr + cc, this.sel && this.sel.r === rr && this.sel.c === cc);
      }
    },
    drawHud: function (game, ctx) {
      var P = G.config.palette, t = E.i18n, v = game.view;
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.36), P.text, 'left', 800);
      E.ui.text(ctx, t.t('hud_moves', { n: this.moves }), 12, y + this.hudH * 0.3, Math.round(this.hudH * 0.24), P.dim, 'left', 700);
      var goalText = t.t('hud_goal', { n: this.target }) + '  ' + t.t('hud_score', { n: this.score });
      E.ui.text(ctx, goalText, v.w / 2, y, Math.round(this.hudH * 0.26), P.accent, 'center', 700);
      var s = Math.max(40, Math.min(48, v.w * 0.11));
      var cxr = v.w - 2 * (s + 8) - 14;
      E.ui.text(ctx, '✨' + Math.floor(this.coins), cxr, y, Math.round(this.hudH * 0.32), P.coin, 'right', 800);
      E.ui.drawButtons(ctx, this.hudButtons);
    },
    drawFloaters: function (ctx) {
      if (!this.floaters) return;
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        var k = f.t / 1.2;
        ctx.globalAlpha = 1 - k * k;
        var size = 17;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,15,48,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(30,15,48,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('paused_title'), v.w / 2, v.h * 0.3, 34, '#fff0fa', 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(30,15,48,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 56) / 2 - 34, 30, '#fff0fa', 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: Math.floor(this.coins) }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 56) / 2 - 6, 18, P.coin, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeShop(game);
    },
    drawOver: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(30,15,48,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      var isWin = this.mode === 'over';
      E.ui.text(ctx, t.t(isWin ? 'over_title' : 'fail_title'), v.w / 2, v.h * 0.24, 32, '#fff0fa', 'center', 800);
      E.ui.text(ctx, t.t('over_score', { n: this.score }), v.w / 2, v.h * 0.24 + 40, 20, '#c9a8e0', 'center', 600);
      if (isWin) {
        if (this.newBest) {
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
          E.ui.text(ctx, t.t('over_newbest'), v.w / 2, v.h * 0.24 + 70, 20, '#ffd43b', 'center', 800);
          ctx.globalAlpha = 1;
        } else {
          E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, v.h * 0.24 + 70, 18, '#c9a8e0', 'center', 600);
        }
        E.ui.text(ctx, t.t('over_coins', { c: this.reward || 0 }), v.w / 2, v.h * 0.24 + 98, 20, P.coin, 'center', 800);
      }
      E.ui.drawButtons(ctx, this.overButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      var msgs = [t.t('tut_swap'), t.t('tut_goal'), t.t('tut_combo')];
      var step = Math.min(2, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + 8;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 520);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 36, 18);
      ctx.fillStyle = 'rgba(30,15,48,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = P.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, w - 30, 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 18, size, '#fff0fa', 'center', 600);
      if (this.tutT > 12) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
