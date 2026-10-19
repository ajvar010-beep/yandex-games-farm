/* game/scenes.js — сцены «Аквалайн»: menu и play.
   Механика: тап по трубке-источнику (поднимается), тап по цели — перелив
   одноцветного верхнего стека. Цель — все трубки одноцветные или пустые.
   Бустеры за монеты: отмена, +трубка, подсказка (решатель), перемешать.
   Контракт с pipeline/capture: wave=N = уровень, t=SEC = прогон autopilot,
   mode=shop|over = форс-экран, freeze/manual — заморозка/покадровость.
   Баннер — ТОЛЬКО вне геймплея (menu/over) (4.6). */
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
      this.stageY = availH * 0.42;
      this.stageH = Math.min(availH * 0.28, 170);

      var rows = [];
      if (savedRun && savedRun.level > 1) rows.push({ h: bh, gap: gap }); // continue
      rows.push({ h: bh, gap: gap });                                       // play
      rows.push({ h: rowH, gap: 0 });                                       // sound/lang/auth
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
        bg: '#2fd6c3', border: '#17a99a', fg: '#04222b',
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
      // сцена: несколько трубок
      var tw = Math.min(v.w, v.h) * 0.11, lh = tw * 0.34;
      var colors = G.config.colors;
      var sets = [[0, 0, 0, 0], [3, 3, 2, 2], [4, 1, 4, 1], []];
      for (var i = 0; i < 4; i++) {
        G.art.drawTube(ctx, v.w * (0.22 + i * 0.19), this.stageY - Math.sin(this.t * 1.4 + i) * 6, tw, lh, sets[i], 0, i === 1, 0);
      }
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 52 * (this.k || 1), 800);
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(4,20,28,0.95)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.strokeText(title, v.w / 2, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#8ff0e2');
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
      this.mode = 'running'; // running | shop | over | paused
      this.coins = C.economy.startCoins;
      this.solvedCount = 0;
      this.hint = null;       // {from,to,t}
      this.pourAnim = null;   // {from,to,color,t,fromPos,toPos}
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0;
      this.undoStack = [];
      this.bought = { undo: 0, tube: 0, hint: 0, shuffle: 0 };
      this.win = false;

      if (params.resume && params.resume.level > 1) {
        this.level = params.resume.level;
        this.coins = params.resume.coins || C.economy.startCoins;
        this.rng = new E.Rng(this.seedNum ^ (this.level * 7919));
      } else {
        this.level = 1;
        this.rng = new E.Rng(this.seedNum);
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
      if (this.mode === 'over') this.buildOverButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    /* ---------- уровень ---------- */
    startLevel: function (level) {
      this.rng = new E.Rng(this.seedNum ^ (level * 7919));
      this.tubes = G.sort.generate(level, this.rng);
      this.moves = 0;
      this.selFrom = -1;
      this.hint = null;
      this.pourAnim = null;
      this.win = false;
      this.undoStack = [];
      // позиции считаются в layout(); если вид уже известен (capture wave=...),
      // перестраиваем сразу — иначе draw/tapAt увидят pos старой длины
      if (this.area) this.layout(E.sdk._game);
    },
    layout: function (game) {
      var v = game.view;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      this.hudH = Math.max(46, availH * 0.09);
      this.inset = inset;
      // поле под HUD
      var area = { x0: 24, y0: this.hudH + 20, x1: v.w - 24, y1: availH - 30 };
      var n = this.tubes ? this.tubes.length : 6;
      var cols = Math.ceil(n / 2);
      var rows = Math.ceil(n / cols);
      var cw = (area.x1 - area.x0) / cols;
      var chh = (area.y1 - area.y0) / rows;
      var tw = Math.min(cw * 0.6, chh * 0.3);
      var layerH = (chh * 0.62) / G.config.capacity;
      this.tubeW = tw; this.layerH = layerH;
      this.pos = [];
      var i = 0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols && i < n; c++, i++) {
          var cx = area.x0 + c * cw + cw / 2;
          var cy = area.y0 + r * chh + 14;
          this.pos.push({ x: cx, y: cy });
        }
      }
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
        this.moves = Math.max(2, Math.floor(lv * 1.5));
        this.solvedCount = Math.floor(G.config.levelColors(lv) / 2);
      }
      if (P.coins) this.coins = Math.max(0, parseInt(P.coins, 10) || 0);
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0));
      if (P.mode === 'over') { this.completeLevel(game); this.overT = 1; }
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
               moves: this.moves, coins: Math.floor(this.coins), fps: game.fps };
    },

    /* ---------- перелив ---------- */
    tryPour: function (game, from, to) {
      var C = G.config, S = G.sort;
      var A = this.tubes[from], B = this.tubes[to];
      var n = S.canPour(A, B);
      if (n <= 0) { this.selFrom = -1; return; }
      this.undoStack.push(G.sort.cloneTubes(this.tubes));
      if (this.undoStack.length > 40) this.undoStack.shift();
      var fromPos = this.pos[from], toPos = this.pos[to];
      var color = G.config.colors[S.topRun(A).color % G.config.colors.length];
      S.pour(A, B, n);
      this.pourAnim = { from: from, to: to, color: color, t: 0, fromPos: fromPos, toPos: toPos };
      this.moves++;
      this.selFrom = -1;
      this.hint = null;
      E.audio.sfx('coin');
      E.fx.burst(toPos.x, toPos.y - 6, color, 10, 90, new E.Rng(this.seedNum ^ this.moves));
      // собранные
      for (var i = 0; i < this.tubes.length; i++) {
        if (G.sort.isSolvedTube(this.tubes[i])) { E.fx.burst(this.pos[i].x, this.pos[i].y, '#59d977', 8, 70, new E.Rng(this.seedNum ^ (i + this.moves))); }
      }
      this.checkWin(game);
      this.saveGame();
    },
    checkWin: function (game) {
      if (!G.sort.allSorted(this.tubes)) return;
      this.win = true;
      var C = G.config;
      var reward = C.economy.solveBase + (this.level - 1) * C.economy.solvePerLevel;
      if (this.recordMode) reward = Math.min(reward, C.record.coinCap);
      this.coins += reward;
      this.reward = reward;
      var best = Math.max(E.storage.get('best', 0), this.level);
      E.storage.set('best', best);
      this.newBest = (this.level === best);
      E.audio.sfx('wave');
      E.fx.flash('#ffe066', 0.2);
      this.mode = 'over';
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.buildOverButtons(game);
      // fullscreen-реклама в логической паузе (уровень пройден), кулдаун 60 с — в sdk.js
      var self = this;
      if (!this.recordMode && !this.autopilot) {
        E.sdk.showInterstitial(function () { self.saveGame(); });
      }
    },
    completeLevel: function (game) { // для capture mode=over без анимации
      this.level = G.config.maxLevel;
      this.win = true; this.reward = 0;
      this.mode = 'over';
      E.sdk.gameplayStop();
      this.buildOverButtons(game);
    },

    /* ---------- бустеры ---------- */
    cost: function (key) { var e = G.config.economy; return G.config.boosterCost(e[key + 'Price'], e[key + 'Growth'], this.bought[key]); },
    buyUndo: function (game) {
      var p = this.cost('undo');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      if (!this.undoStack.length) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.undo++;
      this.tubes = this.undoStack.pop();
      this.moves = Math.max(0, this.moves - 1);
      this.selFrom = -1; this.hint = null;
      E.audio.sfx('buy');
      this.addFloater(this.area.x0 + 40, this.area.y0 + 20, T('undo_done'), '#ffe066');
      this.buildShopButtons(game); this.saveGame();
    },
    buyTube: function (game) {
      var p = this.cost('tube');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.tube++;
      this.undoStack.push(G.sort.cloneTubes(this.tubes));
      this.tubes.push([]);
      this.layout(game);
      E.audio.sfx('buy');
      this.addFloater(this.area.x1 - 40, this.area.y0 + 20, T('tube_done'), '#59d977');
      this.buildShopButtons(game); this.saveGame();
    },
    buyHint: function (game) {
      var p = this.cost('hint');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      var plan = G.sort.solve(this.tubes, 6000);
      if (!plan || !plan.length) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.hint++;
      this.hint = { from: plan[0][0], to: plan[0][1], t: 1.6 };
      E.audio.sfx('buy');
      this.buildShopButtons(game); this.saveGame();
    },
    buyShuffle: function (game) {
      var p = this.cost('shuffle');
      if (this.coins < p) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.shuffle++;
      this.undoStack.push(G.sort.cloneTubes(this.tubes));
      // собираем все слои, тасуем, перераздаём
      var pool = [];
      for (var i = 0; i < this.tubes.length; i++) pool = pool.concat(this.tubes[i]);
      for (var s = pool.length - 1; s > 0; s--) {
        var j = Math.floor(this.rng.float() * (s + 1)) % (s + 1);
        var tmp = pool[s]; pool[s] = pool[j]; pool[j] = tmp;
      }
      var nEmpty = 0;
      var newTubes = [];
      for (var q = 0; q < this.tubes.length; q++) {
        if (this.tubes[q].length === 0) nEmpty++;
      }
      var nFill = this.tubes.length - nEmpty;
      for (var k = 0; k < nFill; k++) newTubes.push(pool.slice(k * G.config.capacity, (k + 1) * G.config.capacity));
      for (var e2 = 0; e2 < nEmpty; e2++) newTubes.push([]);
      this.tubes = newTubes;
      this.selFrom = -1; this.hint = null;
      E.audio.sfx('buy');
      this.addFloater((this.area.x0 + this.area.x1) / 2, this.area.y0 + 20, T('shuffle_done'), '#ffe066');
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
      for (var i = this.floaters ? this.floaters.length - 1 : -1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt;
        if (f.t > 1.2) this.floaters.splice(i, 1);
      }
      if (this.pourAnim) {
        this.pourAnim.t += dt * 4;
        if (this.pourAnim.t >= 1) this.pourAnim = null;
      }
      if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
    },
    updateRunning: function (game, dt) {
      if (this.autopilot) this.driveAutopilot(dt, game);
      else this.driveInput(game);
      // тупик: ни одного хода — показать панель с выходом (не чаще раза в секунду)
      this._stuckT = (this._stuckT || 0) - dt;
      if (!this.win && this.mode === 'running' && this._stuckT <= 0 && !this.pourAnim) {
        this._stuckT = 1.0;
        if (!G.sort.hasMove(this.tubes)) {
          this.mode = 'stuck';
          E.sdk.gameplayStop();
          this.buildStuckButtons(game);
        }
      }
    },
    buildStuckButtons: function (game) {
      var t = E.i18n, self = this;
      var v = game.view;
      var bw = Math.min(280, v.w * 0.76), bh = 48;
      var cx = v.w / 2, y0 = v.h * 0.52;
      var cost = this.cost('shuffle');
      this.stuckButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 18,
          text: t.t('stuck_shuffle') + ' — ' + cost + ' ✨',
          enabled: this.coins >= cost,
          onTap: function () {
            E.audio.sfx('click');
            self.buyShuffle(game);
            self.mode = 'running'; E.sdk.gameplayStart();
          } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 18,
          text: t.t('pause_restart'),
          onTap: function () { E.audio.sfx('click'); self.startLevel(self.level); self.mode = 'running'; E.sdk.gameplayStart(); } })
      ];
    },
    driveInput: function (game) {
      var P = E.input.pointer;
      if (P.pressed) {
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) return;
        this.tapAt(game, P.x, P.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    driveAutopilot: function (dt, game) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.22;
      if (this.mode !== 'running') return;
      var plan = G.sort.solve(this.tubes, 4000);
      if (plan && plan.length) this.tryPour(game, plan[0][0], plan[0][1]);
    },
    tapAt: function (game, px, py) {
      if (this.pourAnim) return; // ждём конца анимации перелива
      // попадание по трубке?
      for (var i = 0; i < this.tubes.length; i++) {
        var p = this.pos[i];
        var w = this.tubeW, h = this.layerH * G.config.capacity + 8;
        var lift = (this.selFrom === i) ? this.layerH * 0.7 : 0;
        if (px >= p.x - w / 2 - 8 && px <= p.x + w / 2 + 8 && py >= p.y - lift - 10 && py <= p.y - lift + h + 8) {
          if (this.selFrom === -1) {
            if (!this.tubes[i].length) return;            // пустая не источник
            this.selFrom = i; E.audio.sfx('click');
          } else if (this.selFrom === i) {
            this.selFrom = -1;                            // снять выбор
          } else {
            this.tryPour(game, this.selFrom, i);
          }
          return;
        }
      }
      this.selFrom = -1; // тап мимо — снять выбор
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
        { key: 'undo', label: t.t('item_undo') + ' — ' + this.cost('undo') + ' ✨' },
        { key: 'tube', label: t.t('item_tube') + ' — ' + this.cost('tube') + ' ✨' },
        { key: 'hint', label: t.t('item_hint') + ' — ' + this.cost('hint') + ' ✨' },
        { key: 'shuffle', label: t.t('item_shuffle') + ' — ' + this.cost('shuffle') + ' ✨' }
      ];
      var rows = items.length + 2; // + RV + «дальше»
      var bh = Math.max(36, Math.min(50, (v.h * 0.52) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      var fns = { undo: 'buyUndo', tube: 'buyTube', hint: 'buyHint', shuffle: 'buyShuffle' };
      for (var i = 0; i < items.length; i++) {
        (function (idx) {
          var key = items[idx].key;
          self.shopButtons.push(new E.ui.Button({
            x: cx - bw / 2, y: y0 + idx * (bh + 8), w: bw, h: bh, fontSize: 15,
            text: items[idx].label,
            enabled: self.coins >= self.cost(key) && !(key === 'undo' && !self.undoStack.length),
            onTap: function () { self[fns[key]](game); }
          }));
        })(i);
      }
      // rewarded-видео: монеты за просмотр (4.5 — по желанию, награда = бонус)
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + items.length * (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('shop_rv', { n: G.config.economy.rvCoins }),
        bg: '#7c4dff', border: '#b197fc', fg: '#fff',
        onTap: function () {
          E.audio.sfx('click');
          E.sdk.showRewarded({ onReward: function () {
            self.coins += G.config.economy.rvCoins;
            self.addFloater(v.w / 2, v.h * 0.4, t.t('rv_done', { n: G.config.economy.rvCoins }), '#b197fc');
            self.buildShopButtons(game);
            self.saveGame();
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
      this.overButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19, text: t.t('over_next'),
          bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
          onTap: function () {
            E.audio.sfx('click');
            E.sdk.hideBanner();
            if (self.level >= G.config.maxLevel) { game.setScene('menu', {}); return; }
            self.level++;
            self.saveGame();
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
      else if (this.mode === 'over') this.drawOver(game, ctx);
      else if (this.mode === 'stuck') this.drawStuck(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
    },
    drawWorld: function (game, ctx) {
      var t = game.time;
      for (var i = 0; i < this.tubes.length; i++) {
        var p = this.pos[i];
        var lift = (this.selFrom === i) ? this.layerH * 0.7 : 0;
        var solvedGlow = G.sort.isSolvedTube(this.tubes[i]) ? 1 : 0;
        var isHintFrom = this.hint && this.hint.from === i;
        var isHintTo = this.hint && this.hint.to === i;
        G.art.drawTube(ctx, p.x, p.y, this.tubeW, this.layerH, this.tubes[i], lift, this.selFrom === i, solvedGlow);
        if (isHintFrom || isHintTo) {
          ctx.save();
          ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
          ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
          var w2 = this.tubeW, h2 = this.layerH * G.config.capacity + 10;
          E.ui.roundRect(ctx, p.x - w2 / 2 - 5, p.y - 8, w2 + 10, h2 + 12, 12); ctx.stroke();
          ctx.restore();
        }
      }
      // струйка перелива
      if (this.pourAnim) {
        var a = this.pourAnim;
        var k = Math.min(1, a.t);
        var x0 = a.fromPos.x, y0 = a.fromPos.y - this.layerH * 0.5;
        var x1 = a.toPos.x, y1 = a.toPos.y - this.layerH * 0.5;
        G.art.drawPourStream(ctx, x0, y0, x1, y1, a.color, k);
      }
    },
    drawHud: function (game, ctx) {
      var P = G.config.palette, t = E.i18n, v = game.view;
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.36), P.text, 'left', 800);
      E.ui.text(ctx, t.t('hud_moves', { n: this.moves }), 12, y + this.hudH * 0.3, Math.round(this.hudH * 0.24), P.dim, 'left', 700);
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
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(4,20,28,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(4,20,28,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('paused_title'), v.w / 2, v.h * 0.3, 34, '#eaf7fc', 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(4,20,28,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 34, 30, '#eaf7fc', 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: Math.floor(this.coins) }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 6, 18, P.coin, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeShop(game);
    },
    drawOver: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(4,20,28,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('over_title'), v.w / 2, v.h * 0.24, 32, '#eaf7fc', 'center', 800);
      E.ui.text(ctx, t.t('over_moves', { n: this.moves }), v.w / 2, v.h * 0.24 + 40, 20, '#93bdcc', 'center', 600);
      if (this.newBest) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
        E.ui.text(ctx, t.t('over_newbest'), v.w / 2, v.h * 0.24 + 70, 20, '#ffd43b', 'center', 800);
        ctx.globalAlpha = 1;
      } else {
        E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, v.h * 0.24 + 70, 18, '#93bdcc', 'center', 600);
      }
      E.ui.text(ctx, t.t('over_coins', { c: this.reward || 0 }), v.w / 2, v.h * 0.24 + 98, 20, P.coin, 'center', 800);
      E.ui.drawButtons(ctx, this.overButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawStuck: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(4,20,28,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('stuck_title'), v.w / 2, v.h * 0.32, 30, '#eaf7fc', 'center', 800);
      E.ui.text(ctx, t.t('stuck_text'), v.w / 2, v.h * 0.32 + 40, 17, '#93bdcc', 'center', 600);
      E.ui.drawButtons(ctx, this.stuckButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.stuckButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      var msgs = [t.t('tut_tap'), t.t('tut_rule'), t.t('tut_goal')];
      var step = Math.min(2, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + 8;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 520);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 36, 18);
      ctx.fillStyle = 'rgba(4,20,28,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = P.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, w - 30, 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 18, size, '#eaf7fc', 'center', 600);
      if (this.tutT > 12) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
