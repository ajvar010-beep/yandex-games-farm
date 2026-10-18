/* game/scenes.js — сцены menu и play «Скайблоков».
   Контракт с pipeline/capture-skyblocks.mjs:
   - capture-параметры: wave=N = УРОВЕНЬ, t=SEC = прогон autopilot-симуляции,
     mode=shop|over = форсированный экран, freeze=1 — заморозка кадра.
   - Record-safe (?record/?autoplay): автопилот сам играет, цены капнуты.
   - Стики-баннер — ТОЛЬКО вне геймплея (menu/over), в play его нет (4.6).
   - Тап по облаку даёт кристаллы и анимацию сбора; острова покупаются тапом,
     улучшения — из панели магазина. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function i18n() { return E.i18n; }
  function T(k, v) { return E.i18n.t(k, v); }
  function isleName(i) { return (i18n().t('isles') || [])[i] || ('#' + i); }

  /* ---------- фон: ночное небо с дрейфующими звёздными пятнами ---------- */
  function makeBlobs(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(0.05, 0.16),
               tw: rng.range(0.2, 0.7), ph: rng.angle(), hue: rng.pick(['#2a3a78', '#3b4f9e', '#4a5fc0']) });
    }
    return s;
  }
  function drawBackground(game, ctx, blobs, t) {
    var v = game.view, C = G.config.palette;
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, C.bg2); grd.addColorStop(1, C.bg);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    for (var i = 0; i < blobs.length; i++) {
      var s = blobs[i];
      var R = s.r * Math.min(v.w, v.h);
      var x = s.x * v.w + Math.sin(t * s.tw + s.ph) * 16;
      var y = s.y * v.h + Math.cos(t * s.tw * 0.8 + s.ph) * 10;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = s.hue;
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.6, R, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ========================================================= MENU */
  function makeSparkles(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(1.2, 3),
               tw: rng.range(0.8, 2.2), ph: rng.angle(),
               hue: rng.pick(['#ffd43b', '#8ab4ff', '#7df9ff', '#51cf66', '#e599f7']) });
    }
    return s;
  }
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.t = 0;
      this.blobs = makeBlobs(12, 4242);
      this.sparkles = makeSparkles(24, 777);
      var rng = new E.Rng(999);
      this.parade = [];
      for (var i = 0; i < 5; i++) this.parade.push({ tier: [0, 2, 4, 3, 5][i], ph: rng.range(0, 6.28) });
      this.layout(game);
    },
    exit: function () { E.sdk.hideBanner(); },
    onResize: function (game) { this.layout(game); },
    layout: function (game) {
      var v = game.view, w = v.w, h = v.h;
      var t = i18n();
      var inset = E.sdk.bannerInsetPx();
      var availH = h - inset;
      var k = clamp(availH / 560, 0.68, 1);
      var bw = Math.min(320, w * 0.78), bh = Math.round(58 * k), cx = w / 2;
      var rowH = Math.round(44 * k), rowGap = Math.round(12 * k);
      var best = E.storage.get('best', 0);
      this.best = best; this.k = k; this.inset = inset;

      this.titleY = availH * 0.115;
      this.paradeY = availH * 0.335;
      this.stageH = Math.min(w, availH) * 0.30;
      var contentTop = this.paradeY + this.stageH / 2 + (best > 0 ? 30 * k : 16 * k);
      var hintH = Math.round(24 * k) + 8;
      var stackAvail = Math.max(40, availH - hintH - contentTop);

      var rows = [{ h: bh, gap: rowGap + 2 }, { h: rowH, gap: 0 }];
      var col = E.ui.layoutColumn(rows, stackAvail, { pad: 0, alignTop: true });
      var sc = col.scale;
      this.buttons = [];
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: contentTop + col.ys[0], w: bw, h: rows[0].h * sc,
        fontSize: Math.max(15, Math.round(26 * k * sc)), text: t.t('menu_play'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#ffffff',
        onTap: function () { E.audio.sfx('click'); game.setScene('play', {}); }
      }));
      var sw = Math.floor((bw - 24) / 3), fs = Math.max(10, Math.round(14 * k * sc));
      var yy = contentTop + col.ys[1];
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: yy, w: sw, h: rowH * sc, fontSize: fs, id: 'snd',
        text: E.audio.isMuted() ? t.t('snd_off') : t.t('snd_on'),
        onTap: function (b) {
          var m = !E.audio.isMuted();
          E.audio.setMuted(m); E.storage.set('muted', m, true);
          b.text = m ? t.t('snd_off') : t.t('snd_on');
          E.audio.sfx('click');
        }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + sw + 12, y: yy, w: sw, h: rowH * sc, fontSize: fs, id: 'lang',
        text: t.t('lang_btn'),
        onTap: function () {
          E.audio.sfx('click');
          var nl = E.i18n.lang === 'ru' ? 'en' : 'ru';
          E.i18n.setLang(nl); E.storage.set('lang', nl, true);
          document.title = i18n().t('title');
          MenuScene.layout(game);
        }
      }));
      var authOn = E.storage.authorized;
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + 2 * (sw + 12), y: yy, w: sw, h: rowH * sc,
        fontSize: Math.max(9, Math.round(11.5 * k * sc)), id: 'auth',
        text: authOn ? '' : t.t('menu_auth'),
        bg: authOn ? '#2f9e44' : '#fc5c7d',
        border: authOn ? '#237032' : '#c92a4f',
        icon: authOn ? function (ctx, b) {
          var cy = b.y + b.h / 2 + 1;
          var fs2 = Math.max(9, Math.round(11.5 * k * sc));
          ctx.font = '600 ' + fs2 + 'px system-ui, sans-serif';
          var tw = ctx.measureText(t.t('menu_auth_ok')).width;
          var x0 = b.x + (b.w - tw - fs2 * 0.9) / 2;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, fs2 * 0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(x0 + fs2 * 0.1, cy); ctx.lineTo(x0 + fs2 * 0.35, cy + fs2 * 0.26); ctx.lineTo(x0 + fs2 * 0.8, cy - fs2 * 0.3);
          ctx.stroke();
          E.ui.text(ctx, t.t('menu_auth_ok'), x0 + fs2 * 0.9 + tw / 2, cy, fs2, '#ffffff', 'center', 600);
        } : function (ctx, b) {
          var cy = b.y + b.h / 2 + 1;
          var fs2 = b.fontSize;
          ctx.font = '600 ' + fs2 + 'px system-ui, sans-serif';
          var tw = ctx.measureText(b.text).width;
          var r = fs2 * 0.72;
          var x0 = b.x + (b.w - tw - r * 2 - 5) / 2 + r;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x0, cy, r, 0, Math.PI * 2); ctx.fill();
          E.ui.text(ctx, 'Я', x0, cy + fs2 * 0.06, Math.round(fs2 * 0.9), '#fc5c7d', 'center', 800);
          E.ui.text(ctx, b.text, x0 + r + 5 + tw / 2, cy, fs2, '#ffffff', 'center', 600);
        },
        onTap: function () {
          if (E.storage.authorized) return;
          E.audio.sfx('click');
          E.storage.authorize().then(function (ok) { if (ok) MenuScene.layout(game); });
        }
      }));
      this.hintY = availH - hintH / 2 - 2;
      this.hintSize = Math.max(10, Math.round(13 * k));
    },
    update: function (game, dt) {
      this.t += dt;
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', {});
    },
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      drawBackground(game, ctx, this.blobs, this.t);
      var cx = v.w / 2, k = this.k || 1;
      for (var si = 0; si < this.sparkles.length; si++) {
        var sp = this.sparkles[si];
        ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * sp.tw + sp.ph));
        ctx.fillStyle = sp.hue;
        ctx.beginPath(); ctx.arc(sp.x * v.w, sp.y * v.h, sp.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // витрина островов
      var n = this.parade.length, span = Math.min(v.w * 0.88, 580);
      var R = Math.min(v.w, v.h) * 0.10;
      for (var i = 0; i < n; i++) {
        var p = this.parade[i];
        var x = cx - span / 2 + (i + 0.5) * (span / n);
        var rr = R * (0.8 + i * 0.1);
        var y = this.paradeY + this.stageH * 0.12 + Math.sin(this.t * 1.6 + p.ph) * rr * 0.1;
        G.art.drawIsland(ctx, p.tier, x, y, rr, this.t, p.ph, true);
      }
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 52 * k, 800);
      ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(12,16,42,0.85)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.strokeText(title, cx, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
      ctx.fillStyle = tg; ctx.fillText(title, cx, this.titleY);
      if (this.best > 0) E.ui.text(ctx, t.t('menu_best', { n: this.best }), cx, this.titleY + 34 * k, Math.round(18 * k), C.dim);
      E.ui.drawButtons(ctx, this.buttons);
      var hintSize = E.ui.fit(ctx, t.t('menu_hint'), v.w * 0.92, this.hintSize, 400);
      E.ui.text(ctx, t.t('menu_hint'), cx, this.hintY, hintSize, C.dim, 'center', 400);
      E.ui.text(ctx, 'v' + G.version, 10, (v.h - (this.inset || 0)) - 12, 12, C.dim, 'left', 400);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ========================================================= PLAY */
  var MAX_LEVEL = 20;
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
      this.rng = new E.Rng(this.seedNum);
      this.visRng = new E.Rng(this.seedNum ^ 0x9e3779b9);
      this.blobs = makeBlobs(10, 777);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.crystals = 0; this.taps = 0; this.bought = 0;
      this.tapPower = C.economy.tapPower; this.tapPrice = C.economy.tapPrice;
      this.magnetT = 0; this.stormT = 0; this.harvestBought = 0;
      this.islands = [];
      for (var i = 0; i < C.islands.length; i++) this.islands.push(G.entities.makeIsland(i, this.rng));
      this.clouds = [];
      this.cloudT = 0.6; // первый облако почти сразу
      this.floaters = [];
      this.popT = {}; // islandIx -> таймер
      this.goals = C.makeGoals(this.level, new E.Rng(this.rng.subSeed(this.level)));
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0; this.hudLock = false;
      this.stats = E.storage.get('stats', { games: 0, taps: 0 });
      this.stats.games++;
      E.storage.set('stats', this.stats);
      this._simGuard = false;

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
      E.fx.reset();
      this.blobs = makeBlobs(10, 777);
      this.buildHudButtons(game);
      if (this.mode === 'paused') this.buildPauseButtons();
      if (this.mode === 'over') this.buildOverButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    layout: function (game) {
      var v = game.view, C = G.config;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      var hudH = Math.max(44, availH * 0.075);
      var goalH = Math.max(64, availH * 0.115);
      var padTop = hudH + goalH;
      // острова — две строки по 3
      var cols = C.board.cols, rows = C.board.rows;
      var fieldH = availH - padTop;
      var cw = v.w / cols, ch = fieldH / rows;
      this.islandPos = [];
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < cols; c++) {
          var x = cw * (c + 0.5), y = padTop + ch * (r + 0.52);
          this.islandPos.push({ x: x, y: y, r: Math.min(cw, ch) * 0.33 });
        }
      this.hudH = hudH; this.goalH = goalH; this.inset = inset;
      this.fieldTop = padTop; this.fieldH = fieldH;
    },

    /* ---------- capture ---------- */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      this.autopilot = true;
      this._simGuard = true;
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.update(game, dt);
        if (E.fx) E.fx.update(dt);
        game.time += dt;
      }
      this.autopilot = keepAuto;
      this._simGuard = false;
    },
    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave) {
        var lv = clamp(parseInt(P.wave, 10) || 1, 1, MAX_LEVEL);
        for (var l = 1; l < lv; l++) this.grantLevelUp(game, true);
        this.level = lv;
        this.goals = G.config.makeGoals(lv, new E.Rng(this.rng.subSeed(lv)));
        // заселяем острова под уровень: открыто min(6, 1+lv/2), частично прокачаны
        var open = clamp(1 + Math.floor(lv / 2), 1, G.config.islands.length);
        var rng = new E.Rng(this.rng.subSeed(1000 + lv));
        for (var i = 0; i < open; i++) {
          this.islands[i].unlocked = true;
          this.islands[i].lvl = rng.int(0, Math.min(3, Math.floor(lv / 2)));
        }
        this.bought = open;
        this.crystals = 500 * lv;
      }
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0));
      if (P.mode === 'over') {
        this.level = MAX_LEVEL;
        this.victory(game, true);
        this.overT = 1; this.overShown = true;
      } else {
        if (tsec > 0) this.simulateCombat(game, tsec);
        if (P.mode === 'shop') this.openShop(game);
      }
      if (P.coins) this.crystals = Math.max(0, parseInt(P.coins, 10) || 0);
      if (P.freeze === '1') { game.pause('capture'); game.render(); }
    },
    setCaptureState: function (game, s) {
      if (s.seed != null) {
        this.seedNum = (typeof s.seed === 'string') ? E.seedFromString(s.seed) : (s.seed >>> 0);
        this.rng = new E.Rng(this.seedNum);
      }
      if (s.wave) { this.level = clamp(s.wave, 1, MAX_LEVEL); }
      if (s.coins != null) this.crystals = s.coins;
      if (s.mode === 'shop') this.openShop(game);
      if (s.mode === 'over') { this.victory(game, true); this.overT = 1; this.overShown = true; }
    },
    getCaptureState: function (game) {
      return { scene: 'play', mode: this.mode, wave: this.level, level: this.level,
               coins: Math.floor(this.crystals), monsters: this.bought, fps: game.fps };
    },

    /* ---------- экономика ---------- */
    incomePerSec: function () {
      var sum = 0;
      for (var i = 0; i < this.islands.length; i++) {
        var m = this.islands[i];
        if (m.unlocked) sum += G.config.islands[m.tier].income * (1 + m.lvl * 0.6);
      }
      if (this.stormT > 0) sum *= 3;
      if (this.recordMode) sum = Math.min(sum, 200);
      return sum;
    },
    addCrystals: function (n, x, y) {
      this.crystals += n;
      this.noteGoal('earn', n);
      if (x != null) this.addFloater(x, y, '+' + Math.round(n), G.config.palette.crystal);
      this.checkGoals();
    },
    addFloater: function (x, y, text, color) {
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },
    saveGame: function () {
      var best = Math.max(E.storage.get('best', 0), this.level);
      E.storage.set('best', best);
      E.storage.set('run', { level: this.level, crystals: Math.floor(this.crystals), taps: this.taps });
    },

    /* ---------- облака ---------- */
    spawnCloud: function () {
      var v = E.sdk._game.view;
      var r = Math.min(v.w, this.fieldH) * (0.06 + this.rng.float() * 0.05);
      var x = v.w * (0.1 + this.rng.float() * 0.8);
      var y = this.fieldTop + this.fieldH * (0.08 + this.rng.float() * 0.84);
      // не спавним вплотную к острову
      for (var i = 0; i < this.islandPos.length; i++) {
        var p = this.islandPos[i];
        var dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy < (p.r + r) * (p.r + r)) { x = (x + v.w * 0.3) % v.w; }
      }
      var golden = this.rng.chance(G.config.economy.goldenChance);
      var value = this.tapPower * (1 + this.level * 0.25) * (golden ? G.config.economy.goldenMul : 1);
      this.clouds.push(G.entities.makeCloud(x, y, r * (golden ? 1.25 : 1), value, this.rng, golden));
      if (golden && !this.seenGolden && !this.autopilot) {
        this.seenGolden = true;
        this.addFloater(x, y - r * 1.6, T('tut_golden'), '#ffe066');
      }
    },
    tapCloud: function (ci) {
      var c = this.clouds[ci];
      this.clouds.splice(ci, 1);
      this.taps++;
      this.stats.taps++;
      this.noteGoal('taps', 1);
      this.addCrystals(c.value, c.x, c.y);
      if (c.golden) {
        E.fx.burst(c.x, c.y, '#ffe066', 20, 150, this.visRng);
        E.fx.flash('rgba(255,224,102,0.18)', 0.15);
        E.audio.sfx('buy');
      } else {
        E.fx.burst(c.x, c.y, '#cfe8ff', 12, 100, this.visRng);
        E.audio.sfx('coin');
      }
      this.saveGame();
    },

    /* ---------- острова ---------- */
    tapIsland: function (ii) {
      var isl = this.islands[ii];
      var conf = G.config.islands[ii];
      if (!isl.unlocked) {
        if (this.crystals < conf.price) { E.audio.sfx('deny'); return; }
        this.crystals -= conf.price;
        isl.unlocked = true;
        this.bought++;
        this.popT[ii] = 0.4;
        var p = this.islandPos[ii];
        E.fx.burst(p.x, p.y, '#ffd43b', 18, 140, this.visRng);
        E.fx.shake(3, 0.15);
        E.audio.sfx('buy');
        this.addFloater(p.x, p.y - p.r, T('buy_to', { name: isleName(ii) }), '#ffd43b');
        this.noteGoal('buy', 1);
        this.checkGoals();
        this.saveGame();
      } else {
        // тап по своему острову: небольшой бонус + анимация
        var p = this.islandPos[ii];
        var bonus = Math.round(conf.income * (1 + isl.lvl * 0.6) * 0.5);
        this.addCrystals(bonus, p.x, p.y - p.r * 0.6);
        this.popT[ii] = 0.25;
        E.fx.burst(p.x, p.y - p.r * 0.4, '#a9e34b', 8, 70, this.visRng);
        E.audio.sfx('click');
      }
    },
    upgradeIsland: function (ii) {
      var isl = this.islands[ii];
      if (!isl.unlocked) return false;
      var cost = G.config.upgradeCost(ii, isl.lvl);
      if (this.crystals < cost) { E.audio.sfx('deny'); return false; }
      this.crystals -= cost;
      isl.lvl++;
      this.popT[ii] = 0.4;
      var p = this.islandPos[ii];
      E.fx.burst(p.x, p.y - p.r * 0.5, '#b197fc', 14, 110, this.visRng);
      E.audio.sfx('pulse');
      this.saveGame();
      return true;
    },

    /* ---------- цели / уровни ---------- */
    noteGoal: function (kind, n) {
      for (var g = 0; g < this.goals.length; g++) {
        var tg = this.goals[g];
        if (tg.kind === kind) tg.got = Math.min(tg.need, tg.got + n);
      }
    },
    checkGoals: function () {
      var done = true;
      for (var g = 0; g < this.goals.length; g++)
        if (this.goals[g].got < this.goals[g].need) done = false;
      if (done) this.grantLevelUp(null, false);
    },
    grantLevelUp: function (game, silent) {
      if (this.level >= MAX_LEVEL) { this.victory(game, false); return; }
      var reward = 80 + this.level * 60;
      if (this.recordMode) reward = Math.min(reward, 600);
      this.crystals += reward;
      this.level++;
      this.goals = G.config.makeGoals(this.level, new E.Rng(this.rng.subSeed(this.level)));
      if (!silent) {
        E.audio.sfx('wave');
        E.fx.flash('#ffe066', 0.18);
        var v = E.sdk._game.view;
        this.addFloater(v.w / 2, this.fieldTop - 8, T('levelup', { n: this.level, c: reward }), '#ffe066');
      }
      this.saveGame();
    },
    victory: function (game, byCapture) {
      if (this.mode === 'over') return;
      this.mode = 'over';
      E.sdk.gameplayStop();
      E.audio.sfx('over');
      var best = E.storage.get('best', 0);
      if (this.level > best) { E.storage.set('best', this.level); this.newBest = true; }
      if (!byCapture) E.sdk.showBanner();
      this.buildOverButtons(game);
    },
    restart: function (game) {
      E.storage.set('run', null);
      game.setScene('play', { seed: (Date.now() % 2147483647) | 0 });
    },

    /* ---------- магазин (апгрейды) ---------- */
    openShop: function (game) {
      if (this.mode !== 'running') return;
      this.mode = 'shop';
      E.sdk.gameplayStop();
      this.buildShopButtons(game);
    },
    closeShop: function (game) {
      this.mode = 'running';
      E.sdk.gameplayStart();
    },
    buyPower: function (game) {
      if (this.crystals < this.tapPrice) { E.audio.sfx('deny'); return; }
      this.crystals -= this.tapPrice;
      this.tapPower++;
      this.tapPrice = Math.round(this.tapPrice * G.config.economy.tapGrowth);
      E.audio.sfx('buy');
      this.buildShopButtons(game);
    },
    buyMagnet: function (game) {
      var cost = this.magnetPrice();
      if (this.crystals < cost) { E.audio.sfx('deny'); return; }
      this.crystals -= cost;
      this.magnetT = 20;
      this.magnetBought = (this.magnetBought || 0) + 1;
      E.audio.sfx('buy');
      this.buildShopButtons(game);
    },
    buyStorm: function (game) {
      var cost = this.stormPrice();
      if (this.crystals < cost) { E.audio.sfx('deny'); return; }
      this.crystals -= cost;
      this.stormT = 15;
      this.stormBought = (this.stormBought || 0) + 1;
      E.audio.sfx('buy');
      this.buildShopButtons(game);
    },
    magnetPrice: function () { return Math.round(150 * Math.pow(1.6, this.magnetBought || 0)); },
    stormPrice: function () { return Math.round(260 * Math.pow(1.7, this.stormBought || 0)); },
    harvestPrice: function () { return G.config.economy.harvestPrice(this.harvestBought || 0); },
    buyHarvest: function (game) {
      var cost = this.harvestPrice();
      if (this.crystals < cost) { E.audio.sfx('deny'); return; }
      var inc = this.incomePerSec();
      if (inc <= 0) { E.audio.sfx('deny'); return; }
      this.crystals -= cost;
      this.harvestBought = (this.harvestBought || 0) + 1;
      var gain = Math.max(1, Math.round(inc * G.config.economy.harvestSec));
      this.addCrystals(gain);
      E.fx.flash('rgba(81,207,102,0.22)', 0.25);
      E.fx.shake(4, 0.2);
      var v = game.view;
      this.addFloater(v.w / 2, this.fieldTop + 10, T('harvest_done', { n: gain }), '#51cf66');
      E.audio.sfx('wave');
      this.buildShopButtons(game);
    },

    /* ---------- пауза ---------- */
    setPaused: function (on) {
      if (on && this.mode === 'running') {
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildPauseButtons();
      } else if (!on && this.mode === 'paused') {
        this.mode = 'running';
        E.sdk.gameplayStart();
      }
    },

    /* ---------- ввод ---------- */
    update: function (game, dt) {
      if (this.mode === 'running') this.updateRunning(game, dt);
      else if (this.mode === 'over') this.updateOver(game, dt);
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt;
        if (f.t > 1.1) this.floaters.splice(i, 1);
      }
      for (var k in this.popT) {
        this.popT[k] -= dt;
        if (this.popT[k] <= 0) delete this.popT[k];
      }
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
    },
    updateRunning: function (game, dt) {
      var inc = this.incomePerSec();
      if (inc > 0) {
        this._incAcc = (this._incAcc || 0) + inc * dt;
        if (this._incAcc >= 1) { var whole = Math.floor(this._incAcc); this.addCrystals(whole); this._incAcc -= whole; }
      }
      if (this.magnetT > 0) this.magnetT -= dt;
      if (this.stormT > 0) this.stormT -= dt;
      // спавн облаков
      this.cloudT -= dt;
      if (this.cloudT <= 0 && this.clouds.length < 5) {
        this.cloudT = 1.4 + this.rng.float() * 1.6;
        this.spawnCloud();
      }
      // дрейф облаков
      var v = game.view;
      for (var i = this.clouds.length - 1; i >= 0; i--) {
        var c = this.clouds[i];
        c.t += dt;
        var speed = this.magnetT > 0 ? 2.4 : 1;
        c.x += c.vx * dt * speed;
        c.y += c.vy * dt * speed;
        if (c.x < c.r) c.vx = Math.abs(c.vx);
        if (c.x > v.w - c.r) c.vx = -Math.abs(c.vx);
        if (c.y < this.fieldTop + c.r) c.vy = Math.abs(c.vy);
        if (c.y > v.h - c.r) c.vy = -Math.abs(c.vy);
        if (c.t > 7) { this.clouds.splice(i, 1); continue; }
      }
      if (this.autopilot) this.driveAutopilot(dt, game);
      else this.driveInput(game, dt);
    },
    updateOver: function (game, dt) {
      this.overT = (this.overT || 0) + dt;
      if (this.autopilot && this.overT > 1.5) this.restart(game);
    },
    driveInput: function (game, dt) {
      var P = E.input.pointer;
      if (P.pressed) {
        this.hudLock = false;
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) { this.hudLock = true; return; }
        // тап по облаку
        var ci = G.entities.cloudAt(this, P.x, P.y);
        if (ci >= 0) { this.tapCloud(ci); this.hudLock = true; return; }
        // тап по острову
        var ii = G.entities.islandAt(this, P.x, P.y);
        if (ii >= 0) { this.tapIsland(ii); this.hudLock = true; return; }
      }
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    /* Autopilot: тапает облака, покупает и прокачивает острова. */
    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.5;
      if (this.clouds.length) { this.tapCloud(this.clouds.length - 1); return; }
      // купить первый доступный закрытый остров
      for (var i = 0; i < this.islands.length; i++) {
        if (!this.islands[i].unlocked && this.crystals >= G.config.islands[i].price) { this.tapIsland(i); return; }
      }
      // прокачать самый дешёвый
      var best = -1, bestCost = Infinity;
      for (var j = 0; j < this.islands.length; j++) {
        var m = this.islands[j];
        if (m.unlocked) {
          var c = G.config.upgradeCost(j, m.lvl);
          if (c < bestCost && this.crystals >= c) { bestCost = c; best = j; }
        }
      }
      if (best >= 0) { this.upgradeIsland(best); return; }
      // запасной ход: тап по открытому острову (бонус)
      for (var k = 0; k < this.islands.length; k++) {
        if (this.islands[k].unlocked) { this.tapIsland(k); return; }
      }
    },

    /* ---------- HUD-кнопки ---------- */
    buildHudButtons: function (game) {
      var v = game.view;
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      var self = this;
      this.hudButtons = [
        new E.ui.Button({ x: v.w - s - 8, y: 8, w: s, h: s, fontSize: 20, text: 'II',
          id: 'pause', onTap: function () { E.audio.sfx('click'); self.setPaused(true); } }),
        new E.ui.Button({ x: v.w - 2 * (s + 8), y: 8, w: s, h: s, fontSize: 20, text: '★', id: 'shop',
          onTap: function () { E.audio.sfx('click'); self.openShop(game); } })
      ];
    },
    buildPauseButtons: function () {
      var t = i18n(), self = this;
      var bw = Math.min(260, window.innerWidth * 0.7), bh = 50;
      var cx = window.innerWidth / 2, y0 = window.innerHeight * 0.42;
      var game = E.sdk._game;
      this.pauseButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 20, text: t.t('pause_resume'),
          onTap: function () { E.audio.sfx('click'); self.setPaused(false); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 20, text: t.t('pause_restart'),
          onTap: function () { E.audio.sfx('click'); self.restart(game); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + 2 * (bh + 12), w: bw, h: bh, fontSize: 20, text: t.t('pause_menu'),
          onTap: function () { E.audio.sfx('click'); E.sdk.gameplayStop(); game.setScene('menu', {}); } })
      ];
    },
    buildShopButtons: function (game) {
      var t = i18n(), self = this;
      var v = game.view;
      var bw = Math.min(320, v.w * 0.82);
      var cx = v.w / 2;
      var rows = 7; // power, magnet, storm, harvest, rv, апгрейд-рулетка, далее
      var bh = Math.max(36, Math.min(48, (v.h * 0.56) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 16,
        text: t.t('item_power') + ' — ' + this.tapPrice + ' ◉',
        enabled: this.crystals >= this.tapPrice,
        onTap: function () { self.buyPower(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + (bh + 8), w: bw, h: bh, fontSize: 16,
        text: t.t('item_magnet') + ' — ' + this.magnetPrice() + ' ◉',
        enabled: this.crystals >= this.magnetPrice(),
        onTap: function () { self.buyMagnet(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 2 * (bh + 8), w: bw, h: bh, fontSize: 16,
        text: t.t('item_storm') + ' — ' + this.stormPrice() + ' ◉',
        enabled: this.crystals >= this.stormPrice(),
        onTap: function () { self.buyStorm(game); }
      }));
      // случайный апгрейд острова
      var upIx = -1, upCost = Infinity;
      for (var i = 0; i < this.islands.length; i++) {
        var m = this.islands[i];
        if (m.unlocked) {
          var c = G.config.upgradeCost(i, m.lvl);
          if (c < upCost) { upCost = c; upIx = i; }
        }
      }
      if (upIx >= 0) {
        var ix = upIx;
        this.shopButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0 + 3 * (bh + 8), w: bw, h: bh, fontSize: 16,
          text: isleName(ix) + ' +1 — ' + upCost + ' ◉',
          enabled: this.crystals >= upCost,
          onTap: function () { if (self.upgradeIsland(ix)) self.buildShopButtons(game); }
        }));
      } else {
        this.shopButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0 + 3 * (bh + 8), w: bw, h: bh, fontSize: 16,
          text: '—', enabled: false, onTap: function () {}
        }));
      }
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 4 * (bh + 8), w: bw, h: bh, fontSize: 16,
        text: t.t('item_harvest') + ' — ' + this.harvestPrice() + ' ◉',
        enabled: this.crystals >= this.harvestPrice() && this.incomePerSec() > 0,
        onTap: function () { self.buyHarvest(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 5 * (bh + 8), w: bw, h: bh, fontSize: 16,
        text: t.t('shop_rv', { n: G.config.economy.rvCoins }),
        bg: '#7c4dff', border: '#b197fc',
        onTap: function () {
          E.sdk.showRewarded({ onReward: function () {
            self.addCrystals(G.config.economy.rvCoins);
            self.buildShopButtons(game);
          } });
        }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 6 * (bh + 8), w: bw, h: bh, fontSize: 18, text: t.t('shop_next'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
    },
    buildOverButtons: function (game) {
      var t = i18n(), self = this;
      var v = game.view;
      var bw = Math.min(280, v.w * 0.74), bh = 48;
      var cx = v.w / 2;
      var rows = 2;
      var y0 = v.h * 0.5 - (bh + 12) * rows / 2 + v.h * 0.06;
      this.overButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19, text: t.t('over_restart'),
          bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
          onTap: function () { E.audio.sfx('click'); self.restart(game); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 19, text: t.t('over_menu'),
          onTap: function () { E.audio.sfx('click'); E.sdk.hideBanner(); game.setScene('menu', {}); } })
      ];
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette;
      drawBackground(game, ctx, this.blobs, game.time);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawGoals(game, ctx);
      this.drawIslands(game, ctx);
      this.drawClouds(game, ctx);
      this.drawHud(game, ctx);
      E.fx.draw(ctx);
      this.drawFloaters(ctx);
      ctx.restore();
      E.fx.drawFlash(ctx, v.w, v.h);
      if (this.mode === 'paused') this.drawPause(game, ctx);
      else if (this.mode === 'shop') this.drawShop(game, ctx);
      else if (this.mode === 'over') this.drawOver(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
    },
    drawGoals: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      var y = this.hudH, h = this.goalH;
      E.ui.roundRect(ctx, 8, y + 4, v.w - 16, h - 8, 12);
      ctx.fillStyle = 'rgba(16,22,58,0.72)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(95,124,255,0.5)'; ctx.stroke();
      var label = t.t('goal_title') + ':';
      ctx.font = '700 ' + Math.round(h * 0.22) + 'px system-ui, sans-serif';
      var lw = ctx.measureText(label).width + 14;
      E.ui.text(ctx, label, 20, y + h / 2, Math.round(h * 0.22), C.text, 'left', 700);
      var slotW = (v.w - 40 - lw) / 3;
      for (var i = 0; i < 3; i++) {
        var tg = this.goals[i];
        var x = 20 + lw + i * slotW + slotW / 2;
        var cy = y + h / 2;
        var text, key = 'goal_' + tg.kind;
        if (tg.kind === 'earn') text = T(key, { n: Math.floor(tg.got) + '/' + tg.need });
        else text = T(key, { n: tg.got + '/' + tg.need });
        var done = tg.got >= tg.need;
        var size = E.ui.fit(ctx, text, slotW - 10, Math.round(h * 0.2), 700);
        E.ui.text(ctx, text, x, cy, size, done ? '#69f0ae' : '#fff6e8', 'center', 800);
        if (done) {
          ctx.globalAlpha = 0.2 + 0.12 * Math.sin(game.time * 4);
          ctx.fillStyle = '#51cf66';
          ctx.beginPath(); ctx.arc(x, cy, h * 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    },
    drawIslands: function (game, ctx) {
      for (var i = 0; i < this.islands.length; i++) {
        var m = this.islands[i];
        var p = this.islandPos[i];
        var r = p.r;
        if (this.popT[i]) {
          var k = this.popT[i] / 0.4;
          r *= 1 + Math.sin(k * Math.PI) * 0.3;
        }
        G.art.drawIsland(ctx, i, p.x, p.y, r, game.time, m.phase, m.unlocked);
        // цена или уровень под островом
        var conf = G.config.islands[i];
        if (!m.unlocked) {
          var afford = this.crystals >= conf.price;
          E.ui.text(ctx, conf.price + ' ◉', p.x, p.y + p.r * 1.25, Math.round(p.r * 0.32),
            afford ? '#ffd43b' : 'rgba(169,184,232,0.6)', 'center', 800);
        } else if (m.lvl > 0) {
          E.ui.text(ctx, '★' + m.lvl, p.x, p.y + p.r * 1.2, Math.round(p.r * 0.26), '#ffd43b', 'center', 700);
        }
      }
    },
    drawClouds: function (game, ctx) {
      for (var i = 0; i < this.clouds.length; i++) {
        var c = this.clouds[i];
        var fade = c.t > 5.5 ? Math.max(0, (7 - c.t) / 1.5) : Math.min(1, c.t / 0.5);
        ctx.globalAlpha = fade;
        G.art.drawCloud(ctx, c.x, c.y, c.r, game.time, c.phase, c.golden);
        ctx.globalAlpha = 1;
      }
    },
    drawHud: function (game, ctx) {
      var C = G.config.palette, t = i18n();
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.34), C.text, 'left', 800);
      var inc = this.incomePerSec();
      if (inc > 0) E.ui.text(ctx, t.t('hud_income', { n: Math.floor(inc) }), 12, y + this.hudH * 0.30, Math.round(this.hudH * 0.22), '#7df9ff', 'left', 700);
      // кристаллы справа от кнопок
      var v = game.view;
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      var cxr = v.w - 2 * (s + 8) - 14;
      E.ui.text(ctx, Math.floor(this.crystals) + ' ◉', cxr, y, Math.round(this.hudH * 0.32), C.crystal, 'right', 800);
      if (this.stormT > 0) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(game.time * 8);
        E.ui.text(ctx, '×3', cxr - 70, y, Math.round(this.hudH * 0.3), '#ffe066', 'right', 800);
        ctx.globalAlpha = 1;
      }
      E.ui.drawButtons(ctx, this.hudButtons);
    },
    drawFloaters: function (ctx) {
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        var k = f.t / 1.1;
        ctx.globalAlpha = 1 - k * k;
        var size = 17;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12,16,42,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,32,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, v.h * 0.32, 34, C.text, 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) {
        E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,32,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 34, 30, C.text, 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: Math.floor(this.crystals) }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 6, 18, C.crystal, 'center', 700);
      E.ui.text(ctx, t.t('tap_power', { n: this.tapPower }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 + 18, 14, C.dim, 'center', 600);
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeShop(game);
    },
    drawOver: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      if (!this.overShown) return;
      ctx.fillStyle = 'rgba(8,12,32,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('over_title'), v.w / 2, v.h * 0.26, 32, C.text, 'center', 800);
      E.ui.text(ctx, t.t('over_score', { n: this.level }), v.w / 2, v.h * 0.26 + 40, 20, C.dim, 'center', 600);
      if (this.newBest) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
        E.ui.text(ctx, t.t('over_newbest'), v.w / 2, v.h * 0.26 + 70, 20, '#ffd43b', 'center', 800);
        ctx.globalAlpha = 1;
      } else {
        E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, v.h * 0.26 + 70, 18, C.dim, 'center', 600);
      }
      E.ui.drawButtons(ctx, this.overButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      var msgs = [t.t('tut_tap'), t.t('tut_buy'), t.t('tut_goal')];
      var step = Math.min(2, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + this.goalH + 10;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 500);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 34, 17);
      ctx.fillStyle = 'rgba(16,22,58,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, w - 30, 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 17, size, C.text, 'center', 600);
      if (this.tutT > 13) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
