/* game/scenes.js — сцены «Словарного Моста»: menu и play.
   Механика: круг из 7 букв, drag по ним собирает слово; верное слово заполняет
   клетки моста (кроссворд-строки). Цели разнообразны: N слов, слово длиной K,
   набрать M очков. Таймер. Бустеры: подсказка, открыть клетку, перемешать, +время.
   RV в лавке, interstitial после победы, RV-revive на fail — всё реально вызывается.
   Баннер — только вне геймплея (4.6). */
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
          bg: '#4e9e4a', border: '#2e6e2c', fg: '#fff',
          onTap: function () { E.audio.sfx('click'); game.setScene('play', { resume: savedRun }); }
        }));
      }
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + col.ys[ri++], w: bw, h: bh * col.scale,
        fontSize: Math.max(15, Math.round(26 * k * col.scale)), text: t.t('menu_play'),
        bg: '#d4a94e', border: '#8a6420', fg: '#2b1a08',
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
        bg: E.storage.authorized ? '#4e9e4a' : '#d4684e',
        border: E.storage.authorized ? '#2e6e2c' : '#8a3a28',
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
      // дуга из плиток WORD/СЛОВО
      var word = E.i18n.lang === 'ru' ? 'СЛОВО' : 'WORD';
      var cx = v.w / 2, cy = this.stageY, R = Math.min(v.w, v.h) * 0.28;
      var n = word.length;
      for (var i = 0; i < n; i++) {
        var a = Math.PI + (i / (n - 1)) * Math.PI;
        var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.55 + Math.sin(this.t * 1.6 + i) * 5;
        var st = i === 1 ? 'revealed' : 'idle';
        G.art.drawTile(ctx, x, y, R * 0.62, word[i], (i % 3) + 1, st, this.t + i * 0.5);
      }
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 52 * (this.k || 1), 800);
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(21,13,31,0.95)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px Georgia, serif';
      ctx.strokeText(title, v.w / 2, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#fff7e8'); tg.addColorStop(1, '#d4a94e');
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
      this.mode = 'running'; // running | shop | over | paused | fail | revive
      this.coins = C.economy.startCoins;
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0;
      this.bought = { hint: 0, letter: 0, shuffle: 0, time: 0 };
      this.reviveUsed = false;
      this.flashMsg = null; this.flashT = 0;

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
      if (this.mode === 'over' || this.mode === 'fail' || this.mode === 'revive') this.buildOverButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    /* ---------- уровень ---------- */
    startLevel: function (level) {
      this.rng = new E.Rng(this.seedNum ^ (level * 7919));
      var lang = E.i18n.lang;
      var lv = G.words.makeLevel(level, lang, this.rng);
      this.letters = lv.letters;
      this.targets = lv.targets;
      this.bonus = lv.bonus;
      this.found = {};          // слово -> true
      this.revealed = {};       // 'word:index' -> true (клетка открыта подсказкой)
      this.timeLeft = G.config.levelTime(level);
      this.score = 0;
      this.selected = [];       // индексы выбранных букв
      this.dragging = false;
      this.msg = null; this.msgT = 0;
      this.reviveUsed = false;
      // tilePos перестраиваем здесь: letters известны ТОЛЬКО после makeLevel,
      // а при wave=N startLevel зовётся ПОСЛЕ первого layout (иначе tilePos устаревает).
      if (this.wheelR) this.updateTilePositions();
    },
    layout: function (game) {
      var v = game.view;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      this.hudH = Math.max(50, availH * 0.11);
      this.inset = inset;
      // круг букв внизу
      this.wheelCX = v.w / 2;
      this.wheelCY = availH * 0.76;
      this.wheelR = Math.min(v.w, availH) * 0.26;
      this.tileSize = Math.min(v.w, availH) * 0.14;
      // сетка целей вверху
      this.gridTop = this.hudH + 12;
      this.gridBottom = this.wheelCY - this.wheelR - this.tileSize * 0.9;
      this.updateTilePositions();
    },
    updateTilePositions: function () {
      var n = this.letters.length;
      this.tilePos = [];
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        this.tilePos.push({
          x: this.wheelCX + Math.cos(a) * this.wheelR,
          y: this.wheelCY + Math.sin(a) * this.wheelR
        });
      }
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
               time: Math.ceil(this.timeLeft), score: this.score, coins: Math.floor(this.coins), fps: game.fps };
    },

    /* ---------- слово ---------- */
    currentWord: function () {
      var w = '';
      for (var i = 0; i < this.selected.length; i++) w += this.letters[this.selected[i]];
      return w;
    },
    submitWord: function (game) {
      var w = this.currentWord();
      this.selected = [];
      if (w.length < G.config.letters.minLen) return;
      var lang = E.i18n.lang;
      var isTarget = this.targets.indexOf(w) >= 0;
      var isBonus = this.bonus.indexOf(w) >= 0;
      if (this.found[w]) { this.showMsg(T('word_dup'), '#b79fd0'); E.audio.sfx('deny'); return; }
      if (!isTarget && !isBonus) {
        if (G.words.dict(lang).indexOf(w) < 0) { this.showMsg(T('word_bad'), '#ff6b81'); E.audio.sfx('deny'); return; }
        // валидное словарное слово, но не из списка — мини-бонус
        this.coins += 5;
        this.showMsg(T('word_extra', { n: 5 }), '#6dd98a');
        E.audio.sfx('coin');
        this.found[w] = true;
        this.saveGame();
        return;
      }
      // верное слово
      this.found[w] = true;
      var gained = G.words.wordScore(w, lang);
      this.score += gained;
      this.coins += Math.floor(gained / 10);
      this.showMsg(T('word_ok') + ' +' + gained, '#6dd98a');
      E.audio.sfx('wave');
      var cx = this.wheelCX, cy = this.wheelCY - this.wheelR - 20;
      E.fx.burst(cx, cy, '#d4a94e', 14, 120, this.rng);
      if (this.targets.every(function (t) { return this.found[t]; }, this)) {
        this.completeLevel(game);
        return;
      }
      this.saveGame();
    },
    showMsg: function (text, color) { this.msg = text; this.msgColor = color || '#fff'; this.msgT = 1.4; },

    /* ---------- победа / поражение / revive ---------- */
    completeLevel: function (game) {
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
      // сначала — revive-оффер (RV), потом fail-экран
      if (!this.reviveUsed && !this.recordMode && !this.autopilot) {
        this.mode = 'revive';
        E.sdk.gameplayStop();
        E.audio.sfx('over');
        this.buildOverButtons(game);
      } else {
        this.mode = 'fail';
        E.sdk.gameplayStop();
        E.sdk.showBanner();
        E.audio.sfx('over');
        this.buildOverButtons(game);
      }
    },
    doRevive: function (game) {
      var self = this;
      E.sdk.showRewarded({ onReward: function () {
        self.reviveUsed = true;
        self.timeLeft += 20;
        self.mode = 'running';
        E.sdk.hideBanner();
        E.sdk.gameplayStart();
        E.audio.sfx('buy');
        self.showMsg('+20', '#ffe066');
        self.saveGame();
      } });
    },
    skipRevive: function (game) {
      this.reviveUsed = true;
      this.failLevel(game);
    },

    /* ---------- бустеры ---------- */
    cost: function (key) { var e = G.config.economy; return G.config.boosterCost(e[key + 'Price'], e[key + 'Growth'], this.bought[key]); },
    buyHint: function (game) {
      var p = this.cost('hint');
      if (this.coins < p) { this.showMsg(T('not_enough'), '#ff6b81'); E.audio.sfx('deny'); return; }
      var h = G.words.hintLetter(this.targets, this.found, this.revealed);
      if (!h) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.hint++;
      this.revealed[h.key] = true;
      E.audio.sfx('buy');
      this.buildShopButtons(game); this.saveGame();
    },
    buyLetter: function (game) {
      var p = this.cost('letter');
      if (this.coins < p) { this.showMsg(T('not_enough'), '#ff6b81'); E.audio.sfx('deny'); return; }
      // открыть первую закрытую клетку первого нерешённого слова
      var h = G.words.hintLetter(this.targets, this.found, this.revealed);
      if (!h) { E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.letter++;
      this.revealed[h.key] = true;
      E.audio.sfx('buy');
      this.buildShopButtons(game); this.saveGame();
    },
    buyShuffle: function (game) {
      var p = this.cost('shuffle');
      if (this.coins < p) { this.showMsg(T('not_enough'), '#ff6b81'); E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.shuffle++;
      this.letters = (function (a, rng) { var r = a.slice(); for (var i = r.length - 1; i > 0; i--) { var j = Math.floor(rng.float() * (i + 1)) % (i + 1); var t = r[i]; r[i] = r[j]; r[j] = t; } return r; })(this.letters, this.rng);
      this.updateTilePositions();
      E.audio.sfx('buy');
      this.buildShopButtons(game); this.saveGame();
    },
    buyTime: function (game) {
      var p = this.cost('time');
      if (this.coins < p) { this.showMsg(T('not_enough'), '#ff6b81'); E.audio.sfx('deny'); return; }
      this.coins -= p; this.bought.time++;
      this.timeLeft += 20;
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
      if (this.mode === 'running') {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.failLevel(game); }
        this.updateRunning(game, dt);
      }
      if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = null; }
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
    tileAt: function (px, py) {
      for (var i = 0; i < this.tilePos.length; i++) {
        var p = this.tilePos[i];
        var dx = px - p.x, dy = py - p.y;
        if (dx * dx + dy * dy <= (this.tileSize * 0.62) * (this.tileSize * 0.62)) return i;
      }
      return -1;
    },
    driveInput: function (game) {
      var P = E.input.pointer;
      if (P.pressed) {
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) { this.selected = []; this.dragging = false; return; }
        var idx = this.tileAt(P.x, P.y);
        if (idx >= 0) {
          this.dragging = true;
          if (this.selected.indexOf(idx) < 0) { this.selected.push(idx); E.audio.sfx('click'); }
        }
      } else if (this.dragging) {
        var idx2 = this.tileAt(P.x, P.y);
        if (idx2 >= 0 && this.selected.indexOf(idx2) < 0) { this.selected.push(idx2); E.audio.sfx('click'); }
        if (!P.down) { this.dragging = false; this.submitWord(game); }
      }
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    driveAutopilot: function (dt, game) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.6;
      if (this.mode !== 'running') return;
      // найти первое нерешённое целевое слово и «набрать» его
      for (var t = 0; t < this.targets.length; t++) {
        var w = this.targets[t];
        if (this.found[w]) continue;
        var picked = [];
        var used = {};
        var ok = true;
        for (var i = 0; i < w.length; i++) {
          var idx = -1;
          for (var j = 0; j < this.letters.length; j++) {
            if (!used[j] && this.letters[j] === w[i]) { idx = j; break; }
          }
          if (idx < 0) { ok = false; break; }
          used[idx] = true; picked.push(idx);
        }
        if (ok) { this.selected = picked; this.submitWord(game); }
        return;
      }
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
        { key: 'hint', label: t.t('item_hint') + ' — ' + this.cost('hint') + ' ✨' },
        { key: 'letter', label: t.t('item_letter') + ' — ' + this.cost('letter') + ' ✨' },
        { key: 'shuffle', label: t.t('item_shuffle') + ' — ' + this.cost('shuffle') + ' ✨' },
        { key: 'time', label: t.t('item_time') + ' — ' + this.cost('time') + ' ✨' }
      ];
      var rows = items.length + 2; // + RV + «дальше»
      var bh = Math.max(36, Math.min(50, (v.h * 0.54) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      var fns = { hint: 'buyHint', letter: 'buyLetter', shuffle: 'buyShuffle', time: 'buyTime' };
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
        bg: '#4e9e4a', border: '#2e6e2c', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
    },
    buildOverButtons: function (game) {
      var t = E.i18n, self = this;
      var v = game.view;
      var bw = Math.min(280, v.w * 0.76), bh = 50;
      var cx = v.w / 2, y0 = v.h * 0.58;
      var isWin = this.mode === 'over';
      var isRevive = this.mode === 'revive';
      this.overButtons = [];
      if (isRevive) {
        this.overButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 17,
          text: t.t('revive_btn'),
          bg: '#7c4dff', border: '#b197fc', fg: '#fff',
          onTap: function () { E.audio.sfx('click'); self.doRevive(game); }
        }));
        this.overButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 19, text: t.t('revive_no'),
          onTap: function () { E.audio.sfx('click'); self.skipRevive(game); }
        }));
        return;
      }
      this.overButtons.push(new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19,
        text: isWin ? t.t('over_next') : t.t('fail_retry'),
        bg: '#4e9e4a', border: '#2e6e2c', fg: '#fff',
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
        } }));
      this.overButtons.push(new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 19, text: t.t('over_menu'),
        onTap: function () { E.audio.sfx('click'); E.sdk.hideBanner(); game.setScene('menu', {}); } }));
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
      else if (this.mode === 'over' || this.mode === 'fail' || this.mode === 'revive') this.drawOver(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
    },
    drawWorld: function (game, ctx) {
      var P = G.config.palette;
      // сетка целей (кроссворд-строки)
      var cell = Math.min(34, (this.gridBottom - this.gridTop) / (this.targets.length * 1.4));
      var cx = game.view.w / 2;
      for (var ti = 0; ti < this.targets.length; ti++) {
        var w = this.targets[ti];
        var found = !!this.found[w];
        var rowW = w.length * cell;
        var x0 = cx - rowW / 2;
        var y = this.gridTop + ti * (cell + 6);
        for (var ci = 0; ci < w.length; ci++) {
          var key = w + ':' + ci;
          var revealed = this.revealed[key];
          var x = x0 + ci * cell + cell / 2;
          if (found || revealed) {
            G.art.drawTile(ctx, x, y + cell / 2, cell * 0.92, w[ci], G.words.weights(E.i18n.lang)[w[ci]] || 1, found ? 'found' : 'revealed', game.time);
          } else {
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = P.cell;
            E.ui.roundRect(ctx, x - cell * 0.44, y + cell * 0.06, cell * 0.88, cell * 0.88, 8); ctx.fill();
            ctx.restore();
          }
        }
      }
      // текущее слово над кругом
      var cw = this.currentWord();
      if (cw) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '800 ' + Math.round(this.tileSize * 0.4) + 'px Georgia, serif';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(21,13,31,0.9)'; ctx.lineJoin = 'round';
        var wy = this.wheelCY - this.wheelR - this.tileSize * 0.32;
        ctx.strokeText(cw.toUpperCase(), cx, wy);
        ctx.fillStyle = '#ffe066'; ctx.fillText(cw.toUpperCase(), cx, wy);
      }
      // линии выбора
      if (this.selected.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,224,102,0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (var i = 0; i < this.selected.length; i++) {
          var p = this.tilePos[this.selected[i]];
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
      }
      // буквы по кругу
      var lang = E.i18n.lang;
      var weights = G.words.weights(lang);
      for (var li = 0; li < this.letters.length; li++) {
        var pos = this.tilePos[li];
        var st = this.selected.indexOf(li) >= 0 ? 'sel' : 'idle';
        G.art.drawTile(ctx, pos.x, pos.y, this.tileSize, this.letters[li], weights[this.letters[li]] || 1, st, game.time + li * 0.3);
      }
      // сообщение
      if (this.msg) {
        ctx.globalAlpha = Math.min(1, this.msgT);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '800 22px system-ui, sans-serif';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(21,13,31,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(this.msg, cx, this.hudH + 4);
        ctx.fillStyle = this.msgColor; ctx.fillText(this.msg, cx, this.hudH + 4);
        ctx.globalAlpha = 1;
      }
    },
    drawHud: function (game, ctx) {
      var P = G.config.palette, t = E.i18n, v = game.view;
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.36), P.text, 'left', 800);
      var foundCount = this.targets.filter(function (w) { return this.found[w]; }, this).length;
      E.ui.text(ctx, t.t('hud_words', { a: foundCount, b: this.targets.length }), 12, y + this.hudH * 0.3, Math.round(this.hudH * 0.24), P.dim, 'left', 700);
      var secs = Math.ceil(this.timeLeft);
      var timeColor = secs <= 15 ? P.bad : P.accent;
      E.ui.text(ctx, t.t('hud_time', { n: secs }), v.w / 2, y, Math.round(this.hudH * 0.3), timeColor, 'center', 700);
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
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(21,13,31,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(21,13,31,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('paused_title'), v.w / 2, v.h * 0.3, 34, '#f5edff', 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(21,13,31,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 56) / 2 - 34, 30, '#f5edff', 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: Math.floor(this.coins) }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 56) / 2 - 6, 18, P.coin, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeShop(game);
    },
    drawOver: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(21,13,31,0.88)'; ctx.fillRect(0, 0, v.w, v.h);
      var isWin = this.mode === 'over';
      var isRevive = this.mode === 'revive';
      var titleKey = isWin ? 'over_title' : (isRevive ? 'revive_offer' : 'fail_title');
      E.ui.text(ctx, t.t(titleKey), v.w / 2, v.h * 0.26, 30, '#f5edff', 'center', 800);
      if (isWin) {
        E.ui.text(ctx, t.t('over_score', { n: this.score }), v.w / 2, v.h * 0.26 + 42, 20, '#b79fd0', 'center', 600);
        if (this.newBest) {
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
          E.ui.text(ctx, t.t('over_newbest'), v.w / 2, v.h * 0.26 + 72, 20, '#ffd43b', 'center', 800);
          ctx.globalAlpha = 1;
        } else {
          E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, v.h * 0.26 + 72, 18, '#b79fd0', 'center', 600);
        }
        E.ui.text(ctx, t.t('over_coins', { c: this.reward || 0 }), v.w / 2, v.h * 0.26 + 100, 20, P.coin, 'center', 800);
      } else if (!isRevive) {
        var foundCount = this.targets.filter(function (w) { return this.found[w]; }, this).length;
        E.ui.text(ctx, t.t('fail_score', { a: foundCount, b: this.targets.length }), v.w / 2, v.h * 0.26 + 42, 20, '#b79fd0', 'center', 600);
      }
      E.ui.drawButtons(ctx, this.overButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, P = G.config.palette, t = E.i18n;
      var msgs = [t.t('tut_drag'), t.t('tut_goal'), t.t('tut_bonus')];
      var step = Math.min(2, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + 8;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 520);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 36, 18);
      ctx.fillStyle = 'rgba(21,13,31,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = P.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, w - 30, 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 18, size, '#f5edff', 'center', 600);
      if (this.tutT > 12) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
