/* game/scenes.js — сцены menu и play «Слияние Суфле» (drop-merge с физикой).
   Контракт с pipeline/capture: ?wave=N (уровень), ?t=SEC (autopilot-прогон),
   ?mode=shop|over, ?freeze=1. Record-safe (?record/?autoplay): автопилот играет сам. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function T(k, v) { return E.i18n.t(k, v); }
  function sweetName(tier) { return (E.i18n.t('sweets') || [])[tier] || ('T' + tier); }

  /* ---------- мета: дейли / офлайн / лидерборд / IAP ---------- */
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function yestStr() { var d = new Date(Date.now() - 86400000); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  var Meta = {
    /* Единая валюта: storage 'coins'. Раньше меню копило в 'menuCoins', а забег стартовал
       с 40 — покупки и RV не доходили до игры. Теперь один баланс на всё. */
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = G.config.economy.startCoins; E.storage.set('coins', c); }
      return Math.max(0, c | 0);
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    canDaily: function () { return E.storage.get('daily_last', '') !== todayStr(); },
    nextStreak: function () {
      var last = E.storage.get('daily_last', '');
      return (last === yestStr()) ? ((E.storage.get('daily_streak', 0) | 0) + 1) : 1;
    },
    claimDaily: function (doubleIt, onDone) {
      if (!this.canDaily()) { if (onDone) onDone(0); return; }
      var last = E.storage.get('daily_last', '');
      var streak = (last === yestStr()) ? (E.storage.get('daily_streak', 0) + 1) : 1;
      E.storage.set('daily_streak', streak); E.storage.set('daily_last', todayStr());
      var base = Math.min(500, 100 + (streak - 1) * 50);
      var grant = function (mult) {
        var n = base * mult;
        var play = E.sdk._game && E.sdk._game.scene;
        if (play && play.coins != null) { play.coins += n; Meta.setCoins(play.coins); }
        else Meta.setCoins(Meta.coins() + n);
        if (onDone) onDone(n);
      };
      if (doubleIt) E.sdk.showRewarded({ onReward: function () { grant(2); }, onDone: function (ok) { if (!ok) grant(1); } });
      else grant(1);
    },
    submitDepth: function (level) { E.sdk.submitScore('sweets_depth', level); },
    iapBuy: function (pid, onOk, onFail) {
      if (pid === 'noads') {
        E.sdk.purchase('no_ads', function () {
          E.storage.set('no_ads', true, true);
          E.sdk.hideBanner();
          if (onOk) onOk();
        }, function () { if (onFail) onFail(); });
      } else if (pid === 'coins_500') {
        E.sdk.purchase('coins_500', function () {
          var play = E.sdk._game && E.sdk._game.scene;
          if (play && play.coins != null) { play.coins += 500; Meta.setCoins(play.coins); play.buildShopButtons(E.sdk._game); }
          else Meta.setCoins(Meta.coins() + 500);
          if (onOk) onOk();
        }, function () { if (onFail) onFail(); });
      } else if (pid === 'coins_1500') {
        E.sdk.purchase('coins_1500', function () {
          var play = E.sdk._game && E.sdk._game.scene;
          if (play && play.coins != null) { play.coins += 1500; Meta.setCoins(play.coins); play.buildShopButtons(E.sdk._game); }
          else Meta.setCoins(Meta.coins() + 1500);
          if (onOk) onOk();
        }, function () { if (onFail) onFail(); });
      }
    }
  };

  /* ---------- фон ---------- */
  function makeBlobs(n, seed) {
    var rng = new E.Rng(seed), s = [];
    for (var i = 0; i < n; i++)
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(0.05, 0.14),
               tw: rng.range(0.2, 0.8), ph: rng.angle(),
               hue: rng.pick(['#5b46a3', '#6d54b8', '#7a4a9a', '#4d3a85']) });
    return s;
  }
  function drawBackground(game, ctx, blobs, t, level) {
    var v = game.view, C = G.config.palette;
    var th = G.config.themeFor(level || 1);
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, th.bg2); grd.addColorStop(1, th.bg);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    for (var i = 0; i < blobs.length; i++) {
      var s = blobs[i], R = s.r * Math.min(v.w, v.h);
      var x = s.x * v.w + Math.sin(t * s.tw + s.ph) * 16;
      var y = s.y * v.h + Math.cos(t * s.tw * 0.8 + s.ph) * 12;
      ctx.globalAlpha = 0.28; ctx.fillStyle = s.hue;
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.5, R, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ========================================================= MENU */
  var MenuScene = {
    consumesInputInUpdate: true,
    enter: function (game) {
      E.audio.music('menu'); E.sdk.gameplayStop();
      if (!E.storage.get('no_ads', false)) E.sdk.showBanner(); else E.sdk.hideBanner();
      E.sdk.initPayments().then(function () {   // дождаться платежей, иначе getPurchases вернёт []
        E.sdk.getPurchases(function (list) {
          for (var i = 0; i < (list || []).length; i++)
            if (list[i] && list[i].productId === 'no_ads') E.storage.set('no_ads', true);
        });
      });
      this.dailyPanel = null; this.lbPanel = null; this.msg = null;
      this.t = 0; this.blobs = makeBlobs(12, 4242);
      var rng = new E.Rng(999); this.parade = [];
      for (var i = 0; i < 5; i++) this.parade.push({ tier: [0, 2, 5, 8, 10][i], ph: rng.range(0, 6.28) });
      this.layout(game);
    },
    exit: function () { E.sdk.hideBanner(); },
    onResize: function (game) { this.layout(game); },
    layout: function (game) {
      var v = game.view, w = v.w, h = v.h, t = E.i18n;
      var inset = E.sdk.bannerInsetPx(), availH = h - inset;
      var k = clamp(availH / 620, 0.66, 1), cx = w / 2;
      var bw = Math.min(320, w * 0.78), bh = Math.round(58 * k);
      var best = E.storage.get('best', 0); this.best = best; this.k = k; this.inset = inset;
      this.titleY = availH * 0.10; this.paradeY = availH * 0.30;
      this.stageH = Math.min(w, availH) * 0.28;
      var contentTop = this.paradeY + this.stageH / 2 + (best > 0 ? 34 * k : 20 * k);
      this.buttons = [];
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: contentTop, w: bw, h: bh, fontSize: Math.max(15, Math.round(26 * k)),
        text: t.t('menu_play'), bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); game.setScene('play', {}); }
      }));
      var sw = Math.floor((bw - 24) / 3), fs = Math.max(12, Math.round(13 * k)), yy = contentTop + bh + 14;
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: yy, w: sw, h: bh * 0.72, fontSize: fs, id: 'snd',
        text: E.audio.isMuted() ? t.t('snd_off') : t.t('snd_on'),
        onTap: function (b) { var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m, true); b.text = m ? t.t('snd_off') : t.t('snd_on'); E.audio.sfx('click'); }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + sw + 12, y: yy, w: sw, h: bh * 0.72, fontSize: fs, id: 'lang',
        text: t.t('lang_btn'),
        onTap: function () { E.audio.sfx('click'); var nl = E.i18n.lang === 'ru' ? 'en' : 'ru'; E.i18n.setLang(nl); E.storage.set('lang', nl, true); document.title = T('title'); MenuScene.layout(game); }
      }));
      var authOn = E.storage.authorized;
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + 2 * (sw + 12), y: yy, w: sw, h: bh * 0.72, fontSize: Math.max(12, Math.round(12 * k)), id: 'auth',
        text: authOn ? '✓' : t.t('login_short'),
        bg: authOn ? '#2f9e44' : '#fc5c7d', border: authOn ? '#237032' : '#c92a4f',
        onTap: function () { if (E.storage.authorized) return; E.audio.sfx('click'); E.storage.authorize().then(function (ok) { if (ok) MenuScene.layout(game); }); }
      }));
      this.hintY = availH - 36; this.hintSize = Math.max(10, Math.round(13 * k));
      // ряд монетизации: RV-монеты + IAP + дейли + лидеры
      var my = yy + bh * 0.72 + 12, mh = Math.round(46 * k), mw = Math.floor((bw - 24) / 2);
      var noAds = E.storage.get('no_ads', false);
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: my, w: mw, h: mh, fontSize: fs + 1, id: 'rvc',
        text: t.t('rv_menu', { n: G.config.economy.rvCoins }), bg: '#7c4dff', border: '#b197fc',
        onTap: function () { E.audio.sfx('click'); E.sdk.showRewarded({ onReward: function () { Meta.setCoins(Meta.coins() + G.config.economy.rvCoins); MenuScene.layout(game); } }); }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + mw + 24, y: my, w: mw, h: mh, fontSize: fs, id: 'noads',
        text: noAds ? t.t('iap_noads_owned') : t.t('iap_noads'),
        bg: noAds ? '#2f9e44' : '#c92a4f', border: noAds ? '#237032' : '#8a1f36',
        onTap: function () { if (E.storage.get('no_ads', false)) return; E.audio.sfx('click'); Meta.iapBuy('noads', function () { MenuScene.layout(game); }); }
      }));
      // дейли + лидеры
      var my2 = my + mh + 10;
      if (Meta.canDaily()) {
        this.buttons.push(new E.ui.Button({
          x: cx - bw / 2, y: my2, w: mw, h: mh, fontSize: fs + 1, id: 'daily',
          text: t.t('daily_title'), bg: '#f08c00', border: '#c47300',
          onTap: function () { E.audio.sfx('click'); MenuScene._openDaily(game); }
        }));
      }
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + (Meta.canDaily() ? mw + 24 : 0), y: my2, w: Meta.canDaily() ? mw : bw, h: mh, fontSize: fs + 1, id: 'lb',
        text: t.t('lb_short'), bg: '#3b2d6e', border: '#9d6bff',
        onTap: function () { E.audio.sfx('click'); MenuScene._openLeaders(game); }
      }));
      // IAP-монеты (маленькие)
      var my3 = my2 + mh + 10;
      var iw = Math.floor((bw - 12) / 2);
      this.buttons.push(new E.ui.Button({ x: cx - bw / 2, y: my3, w: iw, h: mh * 0.8, fontSize: Math.max(12, fs - 1), text: t.t('iap_coins1'), onTap: function () { Meta.iapBuy('coins_500', function () {}, function () { MenuScene.msg = { text: T('iap_fail'), t: 1.6 }; }); } }));
      this.buttons.push(new E.ui.Button({ x: cx - bw / 2 + iw + 12, y: my3, w: iw, h: mh * 0.8, fontSize: Math.max(12, fs - 1), text: t.t('iap_coins2'), onTap: function () { Meta.iapBuy('coins_1500', function () {}, function () { MenuScene.msg = { text: T('iap_fail'), t: 1.6 }; }); } }));
    },
    _openDaily: function (game) {
      // простая панель: забрать или удвоить
      var self = this;
      this.dailyPanel = { t: 0 };
      var v = game.view, bw = Math.min(300, v.w * 0.7), bh = 46, cx = v.w / 2;
      var streak = Meta.nextStreak();
      var base = Math.min(500, 100 + (streak - 1) * 50);
      this.dailyButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: v.h * 0.44, w: bw, h: bh, fontSize: 18, text: T('daily_take', { n: base }), bg: '#3fb950', border: '#2b8a3e', onTap: function () { Meta.claimDaily(false, function () { self.dailyPanel = null; MenuScene.layout(game); }); } }),
        new E.ui.Button({ x: cx - bw / 2, y: v.h * 0.44 + bh + 10, w: bw, h: bh, fontSize: 16, text: T('daily_double'), bg: '#7c4dff', border: '#b197fc', onTap: function () { Meta.claimDaily(true, function () { self.dailyPanel = null; MenuScene.layout(game); }); } }),
        new E.ui.Button({ x: cx - bw / 2, y: v.h * 0.44 + 2 * (bh + 10), w: bw, h: bh, fontSize: 16, text: T('daily_close'), onTap: function () { self.dailyPanel = null; MenuScene.layout(game); } })
      ];
    },
    _openLeaders: function (game) {
      var self = this;
      this.lbPanel = { loading: true, rows: null };
      E.sdk.getLeaderboard('sweets_depth', function (r) {
        if (!self.lbPanel) return;
        self.lbPanel.loading = false;
        self.lbPanel.rows = (r && r.entries) ? r.entries : [];
        self.lbPanel.userRank = r && r.userRank;
      });
      this.lbButtons = [new E.ui.Button({ x: game.view.w / 2 - 80, y: game.view.h * 0.72, w: 160, h: 42, fontSize: 16, text: 'OK', onTap: function () { self.lbPanel = null; } })];
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
      if (E.input.pointer.pressed) {
        if (this.dailyPanel && this.dailyButtons) { if (E.ui.handleTap(this.dailyButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click'); return; }
        if (this.lbPanel && this.lbButtons) { if (E.ui.handleTap(this.lbButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click'); return; }
        E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      }
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', {});
      if (E.input.wasPressed('Escape')) { this.dailyPanel = null; this.lbPanel = null; }
    },
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = E.i18n, cx = v.w / 2, k = this.k || 1;
      drawBackground(game, ctx, this.blobs, this.t, this.level || 1);
      // подиум + витрина эволюции сладостей
      var stageH = this.stageH || 150;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
      ctx.fillStyle = 'rgba(23,15,48,0.55)';
      ctx.beginPath(); ctx.ellipse(cx, this.paradeY + stageH * 0.4, Math.min(v.w * 0.46, 300), stageH * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      var n = this.parade.length, span = Math.min(v.w * 0.9, 560), R = Math.min(v.w, v.h) * 0.10;
      for (var i = 0; i < n; i++) {
        var p = this.parade[i];
        var x = cx - span / 2 + (i + 0.5) * (span / n);
        var rr = R * (0.8 + p.tier * 0.05);
        var y = this.paradeY + stageH * 0.2 - rr * 0.5 + Math.sin(this.t * 2 + p.ph) * rr * 0.1;
        G.art.drawSweet(ctx, p.tier, x, y, rr, this.t, p.ph, 0);
      }
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 54 * k, 800);
      ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(30,16,60,0.85)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px system-ui, sans-serif';
      ctx.strokeText(title, cx, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#fff0f6'); tg.addColorStop(1, '#ff9ad5');
      ctx.fillStyle = tg; ctx.fillText(title, cx, this.titleY);
      if (this.best > 0) E.ui.text(ctx, t.t('menu_best', { n: this.best }), cx, this.titleY + 36 * k, Math.round(18 * k), C.dim);
      // баланс монет — виден в меню, чтобы RV/IAP давали понятный фидбек
      var coinBal = Meta.coins();
      E.ui.text(ctx, '◉ ' + coinBal, v.w - 14, Math.max(14, this.titleY - 22 * k), Math.round(16 * k), C.coin, 'right', 800);
      E.ui.drawButtons(ctx, this.buttons);
      var hs = E.ui.fit(ctx, t.t('menu_hint'), v.w * 0.92, this.hintSize, 400);
      E.ui.text(ctx, t.t('menu_hint'), cx, this.hintY, hs, C.dim, 'center', 400);
      E.ui.text(ctx, 'v' + G.version, 10, (v.h - (this.inset || 0)) - 12, 12, C.dim, 'left', 400);
      // оверлеи мета-панелей (дейли, лидеры)
      if (this.msg) E.ui.text(ctx, this.msg.text, v.w / 2, v.h * 0.80, 16, C.bad, 'center', 700);
      if (this.dailyPanel) this._drawDaily(game, ctx);
      if (this.lbPanel) this._drawLeaders(game, ctx);
    },
    _drawDaily: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(15,10,35,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      var streak = Meta.nextStreak();
      E.ui.text(ctx, t.t('daily_title'), v.w / 2, v.h * 0.34, 32, '#ffd43b', 'center', 800);
      E.ui.text(ctx, t.t('daily_streak', { n: streak }), v.w / 2, v.h * 0.40, 18, C.dim, 'center', 600);
      E.ui.drawButtons(ctx, this.dailyButtons);
    },
    _drawLeaders: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(15,10,35,0.88)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('lb_title'), v.w / 2, v.h * 0.20, 28, '#ffd43b', 'center', 800);
      if (this.lbPanel.loading) E.ui.text(ctx, t.t('lb_loading'), v.w / 2, v.h * 0.46, 20, C.dim, 'center', 600);
      else if (!this.lbPanel.rows || !this.lbPanel.rows.length) E.ui.text(ctx, t.t('lb_empty'), v.w / 2, v.h * 0.46, 20, C.dim, 'center', 600);
      else {
        var maxRows = (v.h < 520) ? 5 : 8;
        var rows = this.lbPanel.rows.slice(0, maxRows);
        for (var i = 0; i < rows.length; i++) {
          var e = rows[i];
          var nm = (e.player && e.player.publicName) ? e.player.publicName : '—';
          var me = (this.lbPanel.userRank === (i + 1));
          E.ui.text(ctx, (i + 1) + '. ' + nm + ' — ' + (e.formattedScore || e.score), v.w / 2, v.h * 0.30 + i * 30, 18, me ? '#ffd43b' : C.text, 'center', me ? 800 : 600);
        }
      }
      if (this.lbPanel.userRank) E.ui.text(ctx, t.t('lb_you', { n: this.lbPanel.userRank }), v.w / 2, v.h * 0.66, 16, '#ffd43b', 'center', 700);
      E.ui.drawButtons(ctx, this.lbButtons);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ========================================================= PLAY */
  var PlayScene = {
    consumesInputInUpdate: true,
    enter: function (game, params) {
      var C = G.config;
      E.sdk.hideBanner(); E.fx.reset(); G.art.init();
      var seed = (params.seed != null) ? params.seed : (E.capture.seed != null) ? E.capture.seed : ((Date.now() % 2147483647) | 0);
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      this.rng = new E.Rng(this.seedNum);
      this.visRng = new E.Rng(this.seedNum ^ 0x9e3779b9);
      this.blobs = makeBlobs(10, 777);
      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.coins = Meta.coins(); this.score = 0; this.merges = 0;
      this.startBest = E.storage.get('best', 0) | 0;
      if (!E.sdk._lastInterstitial) E.sdk._lastInterstitial = Date.now(); // первый interstitial не раньше 60 с
      this.balls = [];
      this.goals = C.makeGoals(this.level, new E.Rng(this.rng.subSeed(this.level)));
      this.spec = C.levelSpec(this.level);
      this.pegNorm = []; this.pegs = [];
      this.rebuildPegs();
      this.nextTier = this.rollDropTier();
      this.queue = [this.rollDropTier(), this.rollDropTier()];
      this.bannerT = (this.autopilot || E.capture.active) ? 0 : 1.8;
      this.aimX = null;             // null → центр; в CSS px
      this.dropCd = 0;
      this.boosterLvl = { bomb: 0, shuffle: 0, rainbow: 0, upgrade: 0 };
      this.rainbowNext = false; this.upgradeNext = false;
      this.floaters = []; this.reviveUsed = false; this.overT = 0; this.overShown = false; this.newBest = false;
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0; this.hudLock = false;
      this.comboN = 0; this.comboT = 0;
      this._simGuard = false;
      this.layout(game);
      this.buildHudButtons(game);
      E.audio.music('play'); E.sdk.gameplayStart();
      this.applyCaptureParams(game, params);
      this.saveGame();
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) { this.layout(game); this.buildHudButtons(game); if (this.mode === 'paused') this.buildPauseButtons(); if (this.mode === 'over') this.buildOverButtons(game); if (this.mode === 'shop') this.buildShopButtons(game); },
    onBack: function () {
      if (this.mode === 'running') this.setPaused(true);
      else if (this.mode === 'paused') this.setPaused(false);
      else if (this.mode === 'shop') this.closeShop(E.sdk._game);
      else if (this.mode === 'over') E.sdk._game.setScene('menu', {});
    },

    rebuildPegs: function () {
      this.spec = G.config.levelSpec(this.level);
      var n = this.spec.pegs;
      var rng = new E.Rng((this.seedNum ^ Math.imul(this.level + 1, 2654435761)) >>> 0);
      this.pegNorm = [];
      for (var i = 0; i < n; i++) {
        for (var t = 0; t < 80; t++) {
          var fx = 0.2 + rng.float() * 0.6, fy = 0.28 + rng.float() * 0.42;
          var ok = true;
          for (var j = 0; j < this.pegNorm.length; j++) {
            var p = this.pegNorm[j];
            if (Math.hypot((fx - p.fx) * 300, (fy - p.fy) * 400) < 72) { ok = false; break; }
          }
          if (ok) { this.pegNorm.push({ fx: fx, fy: fy }); break; }
        }
      }
    },
    updatePegPositions: function () {
      if (!this.cup) { this.pegs = []; return; }
      var cup = this.cup, cupW = cup.right - cup.left, cupH = cup.bottom - cup.top;
      var r = Math.max(7, (this.availH || 720) * 0.018);
      this.pegs = (this.pegNorm || []).map(function (p) {
        return { x: cup.left + cupW * p.fx, y: cup.top + cupH * p.fy, r: r, flash: 0 };
      });
    },
    layout: function (game) {
      var v = game.view, C = G.config;
      var oldCup = this.cup;
      var inset = E.sdk.bannerInsetPx(), availH = v.h - inset;
      // узкие телефоны: два ряда HUD (статус + цели), иначе цели уезжают под монеты
      this.hudH = (v.w < 560) ? Math.max(104, availH * 0.12) : Math.max(46, availH * 0.08);
      this.inset = inset; this.availH = availH;
      // стакан: ширина зависит от уровня (cupW в levelSpec)
      var wf = (this.spec && this.spec.cupW) ? this.spec.cupW : C.cup.wFrac;
      var cupW = Math.min(v.w * wf, availH * wf * 0.9);
      var cupBottom = availH * C.cup.bottomFrac;
      var cupH = availH * C.cup.hFrac;
      this.cup = {
        left: (v.w - cupW) / 2, right: (v.w + cupW) / 2,
        top: cupBottom - cupH, bottom: cupBottom, wall: C.cup.wall
      };
      // линия проигрыша — верх стакана + запас
      this.overY = this.cup.top - availH * 0.01;
      // масштаб радиусов под высоту
      // тиры 9–10 не должны вылезать за стенки: ограничиваем масштаб шириной стакана
      var maxTierR = G.config.tiers[G.config.tiers.length - 1].r;
      this.kRad = Math.min(availH / 720, (cupW * 0.45) / maxTierR);
      // спавн-точка — над стаканом
      this.spawnY = this.cup.top - Math.max(30, availH * 0.05);
      this.updatePegPositions();
      // обновить радиусы существующих шаров + пропорционально перенести позиции
      var oldW = oldCup ? (oldCup.right - oldCup.left) : 0;
      var oldH = oldCup ? (oldCup.bottom - oldCup.top) : 0;
      for (var i = 0; i < this.balls.length; i++) {
        var bb = this.balls[i];
        bb.r = G.entities.tierRadius(bb.tier, this.kRad);
        if (oldCup && oldW > 0 && oldH > 0) {
          var fx = (bb.x - oldCup.left) / oldW;
          var fy = (bb.y - oldCup.top) / oldH;
          bb.x = this.cup.left + fx * (this.cup.right - this.cup.left);
          bb.y = this.cup.top + fy * (this.cup.bottom - this.cup.top);
        }
      }
    },

    /* ---------- capture ---------- */
    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave) {
        var lv = clamp(parseInt(P.wave, 10) || 1, 1, 99);
        for (var l = 1; l < lv; l++) this.grantLevelUp(game, true);
        this.level = lv;
        this.goals = G.config.makeGoals(lv, new E.Rng(this.rng.subSeed(lv)));
      }
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0));
      if (P.mode === 'over') {
        this.simulateCombat(game, tsec > 0 ? tsec : 6);
        this.fillForOver();
        this.gameOver(game, true); this.overT = 1; this.overShown = true;
      } else {
        if (tsec > 0) this.simulateCombat(game, tsec);
        if (P.mode === 'shop') this.openShop(game);
      }
      if (P.coins) this.coins = Math.max(0, parseInt(P.coins, 10) || 0);
      if (P.score) this.score = Math.max(0, parseInt(P.score, 10) || 0);
      if (P.freeze === '1') { game.pause('capture'); game.render(); }
    },
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      this.autopilot = true; this._simGuard = true;
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.update(game, dt);
        if (E.fx) E.fx.update(dt);
        game.time += dt;
      }
      this.autopilot = keepAuto; this._simGuard = false;
    },
    setCaptureState: function (game, s) {
      if (s.seed != null) { this.seedNum = (typeof s.seed === 'string') ? E.seedFromString(s.seed) : (s.seed >>> 0); this.rng = new E.Rng(this.seedNum); }
      if (s.wave) {
        this.level = clamp(s.wave, 1, 99);
        this.goals = G.config.makeGoals(this.level, new E.Rng(this.rng.subSeed(this.level)));
        this.rebuildPegs();
        if (game) this.layout(game);
      }
      if (s.coins != null) this.coins = s.coins;
      if (s.mode === 'shop') this.openShop(game);
      if (s.mode === 'over') { this.fillForOver(); this.gameOver(game, true); this.overT = 1; this.overShown = true; }
    },
    getCaptureState: function (game) {
      return { scene: 'play', mode: this.mode, wave: this.level, coins: this.coins, balls: this.balls.length, score: this.score, fps: game.fps };
    },
    fillForOver: function () {
      // заполняем стакан до линии проигрыша
      var rng = new E.Rng(this.rng.subSeed(9999));
      for (var i = 0; i < 18; i++) {
        var x = this.cup.left + 40 + rng.float() * (this.cup.right - this.cup.left - 80);
        var y = this.cup.bottom - 30 - rng.float() * (this.cup.bottom - this.cup.top - 60);
        var b = G.entities.makeSweet(rng.int(0, 3), x, y, rng);
        b.r = G.entities.tierRadius(b.tier, this.kRad);
        this.balls.push(b);
      }
    },

    /* ---------- экономика ---------- */
    addCoins: function (n, x, y) {
      this.coins += n;
      Meta.setCoins(this.coins);
      if (x != null) this.addFloater(x, y, '+' + n, G.config.palette.coin);
    },
    addFloater: function (x, y, text, color) { this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' }); },
    saveGame: function () {
      // best двигается только на проигрыше/новом уровне — иначе «Новый рекорд!» не показать
      Meta.setCoins(this.coins);
      E.storage.set('level', this.level);
    },

    /* ---------- дроп ---------- */
    rollDropTier: function () {
      var max = Math.min(G.config.maxDropTier, 1 + Math.floor(this.level / 2));
      return this.rng.int(0, Math.max(1, max));
    },
    aimPos: function (game) {
      var x = (this.aimX == null) ? (this.cup.left + this.cup.right) / 2 : this.aimX;
      var r = G.entities.tierRadius(this.nextTier, this.kRad);
      return clamp(x, this.cup.left + r + 2, this.cup.right - r - 2);
    },
    dropBall: function (game, x) {
      if (this.dropCd > 0) return false;
      var tier = this.nextTier;
      if (this.upgradeNext) { tier = Math.min(tier + 1, G.config.tiers.length - 1); this.upgradeNext = false; }
      var rainbow = this.rainbowNext; this.rainbowNext = false;
      var b = G.entities.makeSweet(rainbow ? -1 : tier, x, this.spawnY, this.rng);
      b.born = this._gt || 0;
      b.r = G.entities.tierRadius(Math.max(0, tier), this.kRad);
      if (rainbow) b.tier = -1;
      b.vy = 40;
      this.balls.push(b);
      this.dropCd = (this.spec && this.spec.dropCd) || G.config.drop.cooldown;
      this.nextTier = this.queue && this.queue.length ? this.queue.shift() : this.rollDropTier();
      if (!this.queue) this.queue = [];
      this.queue.push(this.rollDropTier());
      E.audio.sfx('shoot');
      return true;
    },

    /* ---------- мердж / цели ---------- */
    handleMerges: function (merges) {
      for (var i = 0; i < merges.length; i++) {
        var a = merges[i][0], b = merges[i][1];
        var idx = this.balls.indexOf(a); if (idx >= 0) this.balls.splice(idx, 1);
        idx = this.balls.indexOf(b); if (idx >= 0) this.balls.splice(idx, 1);
        var nt = G.entities.mergeTier(a, b);
        var nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2;
        var nb = G.entities.makeSweet(nt, nx, ny, this.rng);
        nb.born = this._gt || 0;
        nb.r = G.entities.tierRadius(nt, this.kRad);
        nb.vx = (a.vx + b.vx) / 2; nb.vy = (a.vy + b.vy) / 2 - 60;
        nb.popT = 0.35;
        this.balls.push(nb);
        this.merges++;
        this.score += G.config.tiers[nt].score;
        this.comboN++; this.comboT = G.config.combo.window;
        var col = G.config.tiers[nt].color;
        E.fx.burst(nx, ny, col, 16, 150, this.visRng);
        E.fx.shake(2 + Math.min(4, nt), 0.16);
        E.audio.sfx('pulse');
        if (this.comboN >= 2) this.addFloater(nx, ny - nb.r, T('combo', { n: this.comboN }), '#ffe066');
        else this.addFloater(nx, ny - nb.r, sweetName(nt) + '!', col);
        this.addCoins(G.config.economy.coinPerTier[nt] || 1, nx, ny);
        // бонус — за достижение вехи серии, а не за каждый мердж (иначе инфляция)
        if (this.comboN === 3) this.addCoins(G.config.combo.at3);
        else if (this.comboN === 5) this.addCoins(G.config.combo.at5);
        else if (this.comboN === 8) this.addCoins(3);
        this.noteTier(nt);
        if (nt === G.config.tiers.length - 1) { // собрали финал
          this.addFloater(nx, ny, T('made_final'), '#ff5d8f');
          E.fx.flash('#ffe066', 0.22); E.audio.sfx('wave');
        }
      }
      if (merges.length) { this.checkGoals(); this.saveGame(); }
    },
    noteTier: function (tier) {
      if (tier < 0) return;
      for (var g = 0; g < this.goals.length; g++) {
        var gl = this.goals[g];
        if (gl.tier === tier && gl.got < gl.need) {
          gl.got++;
          if (gl.got === gl.need) {
            this.addFloater((this.cup.left + this.cup.right) / 2, this.cup.top + 30, T('goal_done'), '#6fe3a5');
            E.audio.sfx('coin');
          }
        }
      }
    },
    checkGoals: function () {
      var done = true;
      for (var g = 0; g < this.goals.length; g++) if (this.goals[g].got < this.goals[g].need) done = false;
      if (done) this.grantLevelUp(null, false);
    },
    grantLevelUp: function (game, silent) {
      var reward = 30 + this.level * 15;
      if (this.recordMode) reward = Math.min(reward, G.config.record.coinCap);
      this.coins += reward; this.level++;
      this.goals = G.config.makeGoals(this.level, new E.Rng(this.rng.subSeed(this.level)));
      this.rebuildPegs();
      if (!silent) this.bannerT = 1.6;
      var gg = game || E.sdk._game;
      if (gg && gg.scene === this) this.layout(gg);
      E.storage.set('best', Math.max(E.storage.get('best', 0), this.level));
      if (!silent) {
        E.audio.sfx('wave'); E.fx.flash('#ffe066', 0.18);
        this.addFloater((this.cup.left + this.cup.right) / 2, this.cup.top - 20, T('levelup', { n: this.level - 1, c: reward }), '#ffe066');
        // interstitial между уровнями: только живой игрок, не в no_ads, не раньше 60 с игры
        if (!this.autopilot && !this._simGuard && !E.storage.get('no_ads', false) && (Date.now() - (E.sdk._lastInterstitial || 0) > 60000))
          E.sdk.showInterstitial(function () {});
      }
      this.saveGame();
    },

    /* ---------- бустеры ---------- */
    boosterCost: function (id) {
      var b = null;
      for (var i = 0; i < G.config.boosters.length; i++) if (G.config.boosters[i].id === id) b = G.config.boosters[i];
      return G.config.boosterCost(b, this.boosterLvl[id] || 0);
    },
    buyBooster: function (game, id) {
      var cost = this.boosterCost(id);
      if (this.coins < cost) { E.audio.sfx('deny'); this.addFloater(this.cup.left + (this.cup.right - this.cup.left) / 2, this.cup.top - 20, T('not_enough'), '#ff6b81'); return; }
      var used = false;
      if (id === 'bomb') used = this.useBomb();
      else if (id === 'shuffle') used = this.useShuffle();
      else if (id === 'rainbow') { this.rainbowNext = true; used = true; }
      else if (id === 'upgrade') { this.upgradeNext = true; used = true; }
      if (!used) { E.audio.sfx('deny'); return; }
      this.coins -= cost; this.boosterLvl[id] = (this.boosterLvl[id] || 0) + 1;
      E.audio.sfx('buy'); this.saveGame(); this.buildShopButtons(game);
    },
    useBomb: function () {  // убирает самый нижний (самый «застрявший») шар
      if (!this.balls.length) return false;
      var bi = 0;
      for (var i = 0; i < this.balls.length; i++) if (this.balls[i].y > this.balls[bi].y) bi = i;
      var b = this.balls.splice(bi, 1)[0];
      E.fx.burst(b.x, b.y, '#adb5bd', 18, 170, this.visRng); E.fx.shake(6, 0.3);
      E.audio.sfx('explode');
      return true;
    },
    useShuffle: function () {  // встряхнуть стакан — случайные горизонтальные импульсы
      if (this.balls.length < 2) return false;
      for (var i = 0; i < this.balls.length; i++) {
        var b = this.balls[i];
        b.vx += this.rng.range(-320, 320); b.vy -= this.rng.range(60, 220);
      }
      E.fx.shake(8, 0.4); E.fx.flash('rgba(116,192,252,0.2)', 0.2); E.audio.sfx('wave');
      return true;
    },

    /* ---------- game over / revive ---------- */
    anyResting: function () {
      for (var i = 0; i < this.balls.length; i++) {
        var b = this.balls[i];
        if (b.y - b.r < this.overY && Math.abs(b.vy) < 40 && (game_time(this) - b.born) > 0.4) return true;
      }
      return false;
      function game_time(s) { return s._gt || 0; }
    },
    gameOver: function (game, byCapture) {
      if (this.mode === 'over') return;
      this.mode = 'over'; E.sdk.gameplayStop(); E.audio.sfx('over');
      var best = E.storage.get('best', 0);
      if (this.level > (this.startBest || 0)) { E.storage.set('best', Math.max(best, this.level)); this.newBest = true; }
      Meta.submitDepth(this.level);   // лидерборд глубины
      if (!byCapture) {
        if (!E.storage.get('no_ads', false)) E.sdk.showBanner(); else E.sdk.hideBanner();
        // interstitial на проигрыше (кулдаун в sdk), только живой игрок и не no_ads
        if (!this.autopilot && !E.storage.get('no_ads', false)) E.sdk.showInterstitial(function () {});
      }
      this.buildOverButtons(game);
    },
    revive: function (game) {
      var self = this;
      E.sdk.showRewarded({
        onReward: function () {
          // «очистить верх»: убираем все шары выше середины стакана
          var midY = (self.cup.top + self.cup.bottom) / 2;
          for (var i = self.balls.length - 1; i >= 0; i--)
            if (self.balls[i].y < midY) self.balls.splice(i, 1);
          self.reviveUsed = true; self.mode = 'running';
          E.sdk.hideBanner(); E.sdk.gameplayStart();
          self.addFloater(self.cup.left + (self.cup.right - self.cup.left) / 2, self.cup.top - 20, T('revive_done'), '#6fe3a5');
          E.audio.sfx('revive');
        },
        onDone: function () {}
      });
    },
    restart: function (game) { E.storage.set('run', null); game.setScene('play', { seed: (Date.now() % 2147483647) | 0 }); },

    /* ---------- пауза ---------- */
    setPaused: function (on) {
      if (on && this.mode === 'running') { this.mode = 'paused'; E.sdk.gameplayStop(); this.buildPauseButtons(); }
      else if (!on && this.mode === 'paused') { this.mode = 'running'; E.sdk.gameplayStart(); }
    },

    /* ---------- update ---------- */
    update: function (game, dt) {
      this._gt = (this._gt || 0) + dt;
      // Тапы оверлеев обрабатываются ТОЛЬКО здесь (в update), не в draw(): иначе на кадре
      // без fixed-step pointer.pressed переживает render и покупка срабатывает дважды.
      if (this.mode === 'paused' && E.input.wasPressed('Escape')) { this.setPaused(false); return; }
      if (this.mode === 'shop' && E.input.wasPressed('Escape')) { this.closeShop(game); return; }
      if (E.input.pointer.pressed) {
        var px = E.input.pointer.x, py = E.input.pointer.y, hit = null;
        if (this.mode === 'paused' && this.pauseButtons) hit = E.ui.handleTap(this.pauseButtons, px, py);
        else if (this.mode === 'shop' && this.shopButtons) hit = E.ui.handleTap(this.shopButtons, px, py);
        else if (this.mode === 'over' && this.overShown && this.overButtons) hit = E.ui.handleTap(this.overButtons, px, py);
        if (hit) { E.audio.sfx('click'); E.input.pointer.pressed = false; return; }
      }
      if (this.mode === 'running') this.updateRunning(game, dt);
      else if (this.mode === 'over') this.updateOver(game, dt);
      for (var i = this.floaters.length - 1; i >= 0; i--) { var f = this.floaters[i]; f.t += dt; if (f.t > 1.2) this.floaters.splice(i, 1); }
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboN = 0; }
      if (this.bannerT > 0) this.bannerT -= dt;
      for (var pi = 0; pi < (this.pegs || []).length; pi++) if (this.pegs[pi].flash > 0) this.pegs[pi].flash -= dt;
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
    },
    updateRunning: function (game, dt) {
      if (this.dropCd > 0) this.dropCd -= dt;
      // autopilot / ввод
      if (this.autopilot) this.driveAutopilot(dt, game); else this.driveInput(game, dt);
      // физика + мерджи
      var merges = G.entities.step(this, dt);
      if (merges.length) this.handleMerges(merges);
      // проигрыш: шар держится выше линии дольше 0.7с — НЕЗАВИСИМО от скорости.
      // Раньше требовалось |vy|<40, а набитый стакан «кипит» и никогда не проигрывал.
      var above = false;
      for (var bi2 = 0; bi2 < this.balls.length; bi2++) {
        var bb = this.balls[bi2];
        // центр шара выше линии (а не касание краем) и держится ~0.9с — честное переполнение
        if (bb.y + bb.r < this.overY) {
          bb.aboveT = (bb.aboveT || 0) + dt;
          if (bb.aboveT > 0.9) above = true;
        } else bb.aboveT = 0;
      }
      if (above) {
        this._overAcc = (this._overAcc || 0) + dt;
        if (this._overAcc > 0.5) { this._overAcc = 0; this.gameOver(game, false); }
      } else this._overAcc = 0;
    },
    updateOver: function (game, dt) {
      this.overT += dt;
      if (this.overT > 0.4 && !this.overShown) { this.overShown = true; this.buildOverButtons(game); }
      if (this.autopilot && this.overT > 1.4) this.restart(game);
    },
    driveInput: function (game, dt) {
      var P = E.input.pointer;
      if (P.pressed) {
        this.hudLock = false;
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) { this.hudLock = true; return; }
        // наведение: палец в зоне стакана
        if (P.y > this.cup.top - 40 && P.y < this.cup.bottom) { this.aimX = P.x; this._aiming = true; }
      }
      if (this._aiming) { this.aimX = P.x; }
      if (P.released && this._aiming) {
        this._aiming = false;
        if (!this.hudLock) this.dropBall(game, this.aimPos(game));
      }
      // клавиатура: стрелки/A-D двигают прицел, Space/↓ — дроп
      if (E.input.down('ArrowLeft') || E.input.down('KeyA')) this.aimX = (this.aimX == null ? (this.cup.left + this.cup.right) / 2 : this.aimX) - G.config.drop.aimSpeed * dt;
      if (E.input.down('ArrowRight') || E.input.down('KeyD')) this.aimX = (this.aimX == null ? (this.cup.left + this.cup.right) / 2 : this.aimX) + G.config.drop.aimSpeed * dt;
      if (E.input.wasPressed('Space') || E.input.wasPressed('ArrowDown') || E.input.wasPressed('KeyS')) this.dropBall(game, this.aimPos(game));
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    driveAutopilot: function (dt, game) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.6;
      // целимся под шар того же тира (для мерджа), иначе в самое глубокое место
      var targetX = (this.cup.left + this.cup.right) / 2;
      for (var i = 0; i < this.balls.length; i++)
        if (this.balls[i].tier === this.nextTier) { targetX = this.balls[i].x; break; }
      this.aimX = targetX;
      this.dropBall(game, this.aimPos(game));
    },

    /* ---------- HUD-кнопки ---------- */
    buildHudButtons: function (game) {
      var v = game.view, self = this;
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      this.hudButtons = [
        new E.ui.Button({ x: v.w - s - 8, y: 8, w: s, h: s, fontSize: 20, text: 'II', id: 'pause',
          onTap: function () { E.audio.sfx('click'); self.setPaused(true); } }),
        new E.ui.Button({ x: v.w - 2 * (s + 8), y: 8, w: s, h: s, fontSize: 18, text: '★', id: 'shop',
          onTap: function () { E.audio.sfx('click'); self.openShop(game); } })
      ];
    },
    buildPauseButtons: function () {
      var t = E.i18n, self = this, game = E.sdk._game;
      var v = game.view;
      var bw = Math.min(260, v.w * 0.7), bh = 48, cx = v.w / 2, y0 = v.h * 0.38;
      this.pauseButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 20, text: t.t('pause_resume'), onTap: function () { E.audio.sfx('click'); self.setPaused(false); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 10, w: bw, h: bh, fontSize: 19, text: t.t('pause_restart'), onTap: function () { E.audio.sfx('click'); self.restart(game); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + 2 * (bh + 10), w: bw, h: bh, fontSize: 19, text: t.t('pause_menu'), onTap: function () { E.audio.sfx('click'); E.sdk.gameplayStop(); game.setScene('menu', {}); } })
      ];
    },
    openShop: function (game) { if (this.mode !== 'running') return; this.mode = 'shop'; E.sdk.gameplayStop(); this.buildShopButtons(game); },
    closeShop: function (game) { this.mode = 'running'; E.sdk.gameplayStart(); },
    buildShopButtons: function (game) {
      var t = E.i18n, self = this, v = game.view;
      var bw = Math.min(320, v.w * 0.82), cx = v.w / 2;
      var rows = G.config.boosters.length + 2;
      var availH = v.h - (this.inset || 0);
      var phS = Math.min(430, Math.max(300, availH * 0.86));
      var bh = Math.max(32, Math.min(48, (phS - 120) / rows));
      var y0 = Math.max(96, (availH - (bh + 8) * rows) / 2 + 16);
      this.shopButtons = [];
      G.config.boosters.forEach(function (b, i) {
        var cost = self.boosterCost(b.id);
        self.shopButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0 + i * (bh + 8), w: bw, h: bh, fontSize: 16,
          text: t.t('boost_' + b.id) + ' — ' + cost + ' ◉',
          onTap: function () { self.buyBooster(game, b.id); }
        }));
      });
      var yr = y0 + G.config.boosters.length * (bh + 8);
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: yr, w: bw, h: bh, fontSize: 16,
        text: t.t('shop_rv', { n: G.config.economy.rvCoins }), bg: '#7c4dff', border: '#b197fc',
        onTap: function () { E.sdk.showRewarded({ onReward: function () { self.addCoins(G.config.economy.rvCoins); self.buildShopButtons(game); } }); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: yr + bh + 8, w: bw, h: bh, fontSize: 18, text: t.t('shop_close'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
    },
    buildOverButtons: function (game) {
      var t = E.i18n, self = this, v = game.view;
      var bw = Math.min(280, v.w * 0.74), bh = 44, cx = v.w / 2;
      var rows = (this.reviveUsed || this.autopilot) ? 2 : 3;
      var availH = v.h - (this.inset || 0);
      var stack = rows * bh + (rows - 1) * 10;
      var y0 = Math.max(96, (availH - stack) / 2 + 24);
      this.overY0 = y0;
      this.overButtons = [];
      if (!this.reviveUsed && !this.autopilot) {
        this.overButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 16, text: t.t('over_revive'),
          bg: '#7c4dff', border: '#b197fc', fg: '#fff',
          onTap: function () { E.audio.sfx('click'); self.revive(game); }
        }));
        y0 += bh + 12;
      }
      this.overButtons.push(new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 18, text: t.t('over_restart'), bg: '#3fb950', border: '#2b8a3e', fg: '#fff', onTap: function () { E.audio.sfx('click'); self.restart(game); } }));
      this.overButtons.push(new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 10, w: bw, h: bh, fontSize: 17, text: t.t('over_menu'), onTap: function () { E.audio.sfx('click'); E.sdk.hideBanner(); game.setScene('menu', {}); } }));
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette;
      drawBackground(game, ctx, this.blobs, game.time, this.level);
      ctx.save(); ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawCup(game, ctx);
      this.drawPegs(game, ctx);
      this.drawBalls(game, ctx);
      this.drawAimer(game, ctx);
      E.fx.draw(ctx); this.drawFloaters(ctx);
      ctx.restore();
      // HUD и цели НЕ трясутся вместе с полем — иначе цифры дёргаются на каждом мерже
      this.drawGoals(game, ctx);
      this.drawHud(game, ctx);
      E.fx.drawFlash(ctx, v.w, v.h);
      if (this.bannerT > 0 && this.mode === 'running' && !this.autopilot) this.drawBanner(game, ctx);
      if (this.comboT > 0 && this.comboN >= 2 && this.mode === 'running') this.drawComboMeter(game, ctx);
      if (this.mode === 'paused') this.drawPause(game, ctx);
      else if (this.mode === 'shop') this.drawShop(game, ctx);
      else if (this.mode === 'over') this.drawOver(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
    },
    drawCup: function (game, ctx) {
      var C = G.config.palette, cup = this.cup;
      // стекло
      ctx.fillStyle = C.glass;
      ctx.fillRect(cup.left, cup.top, cup.right - cup.left, cup.bottom - cup.top);
      // стенки и дно
      ctx.strokeStyle = C.glassEdge; ctx.lineWidth = cup.wall * 0.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cup.left, cup.top); ctx.lineTo(cup.left, cup.bottom);
      ctx.lineTo(cup.right, cup.bottom); ctx.lineTo(cup.right, cup.top);
      ctx.stroke();
      // линия проигрыша (пунктир) + предупреждение, когда до неё близко
      ctx.strokeStyle = 'rgba(255,93,115,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(cup.left, this.overY); ctx.lineTo(cup.right, this.overY); ctx.stroke();
      ctx.setLineDash([]);
      var topMost = cup.bottom;
      for (var wi = 0; wi < this.balls.length; wi++) topMost = Math.min(topMost, this.balls[wi].y - this.balls[wi].r);
      if (topMost < this.overY + (cup.bottom - cup.top) * 0.14) {
        ctx.save();
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(game.time * 8);
        E.ui.text(ctx, T('warn_full'), (cup.left + cup.right) / 2, this.overY - 16, 16, '#ff8a98', 'center', 800);
        ctx.restore();
      }
    },
    drawBalls: function (game, ctx) {
      for (var i = 0; i < this.balls.length; i++) {
        var b = this.balls[i];
        if (b.tier === -1) { this.drawRainbow(ctx, b, game.time); continue; }
        G.art.drawSweet(ctx, b.tier, b.x, b.y, b.r, game.time, b.phase, b.popT > 0 ? b.popT / 0.35 : 0);
      }
    },
    drawRainbow: function (ctx, b, t) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(t * 2);
      var g = ctx.createLinearGradient(-b.r, -b.r, b.r, b.r);
      g.addColorStop(0, '#ff8fa3'); g.addColorStop(0.5, '#ffd43b'); g.addColorStop(1, '#63e6be');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5b3a8e'; ctx.lineWidth = b.r * 0.09; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(-b.r * 0.3, -b.r * 0.35, b.r * 0.28, b.r * 0.15, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    drawAimer: function (game, ctx) {
      if (this.mode !== 'running') return;
      var x = this.aimPos(game);
      var ready = this.dropCd <= 0;
      // направляющая пунктирная линия вниз
      ctx.strokeStyle = ready ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2; ctx.setLineDash([5, 9]);
      ctx.beginPath(); ctx.moveTo(x, this.spawnY + 8); ctx.lineTo(x, this.cup.bottom); ctx.stroke();
      ctx.setLineDash([]);
      // шар на старте: превью учитывает бустеры «радуга» и «плюс»,
      // иначе игрок не видит, что покупка сработала, до самого дропа.
      var t = this.nextTier;
      if (this.upgradeNext) t = Math.min(t + 1, G.config.tiers.length - 1);
      var r = G.entities.tierRadius(t, this.kRad);
      var bob = Math.sin(game.time * 3) * 2;
      if (this.rainbowNext) {
        ctx.globalAlpha = ready ? 1 : 0.4;
        this.drawRainbow(ctx, { x: x, y: this.spawnY + bob, r: r }, game.time);
        ctx.globalAlpha = 1;
      } else if (ready) G.art.drawSweet(ctx, t, x, this.spawnY + bob, r, game.time, 0, 0);
      else { ctx.globalAlpha = 0.4; G.art.drawSweet(ctx, t, x, this.spawnY, r, game.time, 0, 0); ctx.globalAlpha = 1; }
      // очередь следующих двух сладостей — планирование наперёд
      if (this.queue) {
        for (var qi = 0; qi < Math.min(2, this.queue.length); qi++) {
          var qt = this.queue[qi];
          var qr = G.entities.tierRadius(qt, this.kRad) * (qi ? 0.34 : 0.46);
          var qx = Math.max(this.cup.left + qr + 4, x - r - 22 - qi * (qr * 2 + 8));
          ctx.globalAlpha = qi ? 0.55 : 0.75;
          G.art.drawSweet(ctx, qt, qx, this.spawnY, qr, game.time, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
    },
    drawPegs: function (game, ctx) {
      for (var i = 0; i < this.pegs.length; i++) {
        var p = this.pegs[i];
        if (p.flash > 0) {
          ctx.save(); ctx.globalAlpha = 0.5 * (p.flash / 0.18);
          ctx.fillStyle = '#ffe08a';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        var g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.15, p.x, p.y, p.r);
        g.addColorStop(0, '#e8eefc'); g.addColorStop(0.55, '#9fb3d1'); g.addColorStop(1, '#4a5a7e');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(30,40,60,0.8)'; ctx.lineWidth = Math.max(1.5, p.r * 0.18);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    },
    drawBanner: function (game, ctx) {
      var v = game.view;
      var a = Math.min(1, this.bannerT * 1.6);
      var w = Math.min(320, v.w * 0.76), h = 66;
      var x = (v.w - w) / 2, y = this.cup.top + (this.cup.bottom - this.cup.top) * 0.28;
      ctx.save(); ctx.globalAlpha = a;
      E.ui.roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = 'rgba(20,12,40,0.9)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#ff9ad5'; ctx.stroke();
      E.ui.text(ctx, T('banner_level', { n: this.level }), v.w / 2, y + 24, 20, '#ffe0f0', 'center', 800);
      if (this.spec && this.spec.pegs > 0 && this.level === 3) {
        E.ui.text(ctx, T('banner_pegs'), v.w / 2, y + 47, 12, '#c9b8e8', 'center', 600);
      }
      ctx.restore();
    },
    drawComboMeter: function (game, ctx) {
      var v = game.view;
      var a = Math.min(1, this.comboT / 0.3);
      var y = this.cup.top + 24;
      ctx.save(); ctx.globalAlpha = a;
      E.ui.text(ctx, T('combo_label', { n: this.comboN }), v.w / 2, y, 22, '#ffe066', 'center', 800);
      ctx.restore();
    },
    drawGoals: function (game, ctx) {
      var v = game.view;
      var y, h, px, pw;
      if (v.w < 560) {
        // второй ряд на всю ширину: монеты/очки первого ряда не пересекаются с целями
        px = 8; pw = v.w - 16; y = 58; h = this.hudH - 64;
      } else {
        y = 8; h = this.hudH - 12;
        px = 112; pw = Math.min(v.w * 0.55, 380, v.w - 232);
      }
      E.ui.roundRect(ctx, px, y, pw, h, 10);
      ctx.fillStyle = 'rgba(30,22,58,0.7)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(185,138,255,0.5)'; ctx.stroke();
      var slot = (pw - 12) / Math.max(1, this.goals.length);
      for (var i = 0; i < this.goals.length; i++) {
        var gl = this.goals[i];
        var r = Math.min((h - 18) / 2, slot * 0.26, 38);
        var cx = px + 6 + slot * (i + 0.5) - r * 0.7;
        G.art.drawSweet(ctx, gl.tier, cx, y + h / 2, r, game.time, i * 1.7, 0);
        var done = gl.got >= gl.need;
        E.ui.text(ctx, gl.got + '/' + gl.need, cx + r + 3, y + h / 2,
          Math.max(12, Math.min(Math.round(h * 0.28), r * 1.35)), done ? '#6fe3a5' : '#fff6e8', 'left', 800);
      }
    },
    drawHud: function (game, ctx) {
      var C = G.config.palette, t = E.i18n, v = game.view;
      var narrow = v.w < 560;
      var lf = Math.max(12, Math.min(16, this.hudH * 0.2));
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 14, 16, lf, C.dim, 'left', 700);
      var pr = v.w - 54;
      if (this.hudButtons && this.hudButtons.length) {
        pr = this.hudButtons[0].x;
        for (var bi = 1; bi < this.hudButtons.length; bi++) pr = Math.min(pr, this.hudButtons[bi].x);
      }
      E.ui.text(ctx, '◉ ' + this.coins, pr - 12, 16, Math.max(12, Math.min(16, this.hudH * 0.24)), C.coin, 'right', 800);
      E.ui.text(ctx, '★ ' + this.score, pr - 12, narrow ? 34 : 36, Math.max(12, this.hudH * 0.19), C.text, 'right', 700);
      E.ui.drawButtons(ctx, this.hudButtons);
    },
    drawFloaters: function (ctx) {
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i], k = f.t / 1.2;
        ctx.globalAlpha = 1 - k * k;
        ctx.font = '800 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,16,60,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 44);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - k * 44);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(15,10,35,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, v.h * 0.32, 34, C.text, 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = E.i18n;
      ctx.fillStyle = 'rgba(15,10,35,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      var rows = G.config.boosters.length + 2;
      var availH = v.h - (this.inset || 0);
      var phS = Math.min(430, Math.max(300, availH * 0.86));
      var bh = Math.max(32, Math.min(48, (phS - 120) / rows));
      var y0 = Math.max(96, (availH - (bh + 8) * rows) / 2 + 16);
      var pwS = Math.min(360, v.w * 0.84);
      E.ui.roundRect(ctx, v.w / 2 - pwS / 2, y0 - 82, pwS, (bh + 8) * rows + 100, 18);
      ctx.fillStyle = 'rgba(22,15,48,0.96)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(157,107,255,0.6)'; ctx.stroke();
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, y0 - 54, 26, C.text, 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: this.coins }), v.w / 2, y0 - 28, 16, C.coin, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
    },
    drawOver: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = E.i18n;
      if (!this.overShown) return;
      ctx.fillStyle = 'rgba(15,10,35,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      var oy = this.overY0 || Math.max(96, v.h * 0.5 - 70);
      E.ui.text(ctx, t.t('over_title'), v.w / 2, oy - 80, 30, C.text, 'center', 800);
      E.ui.text(ctx, t.t('over_score', { n: this.score }), v.w / 2, oy - 52, 18, C.dim, 'center', 600);
      if (this.newBest) { ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5); E.ui.text(ctx, t.t('over_newbest'), v.w / 2, oy - 28, 18, '#ffd43b', 'center', 800); ctx.globalAlpha = 1; }
      else E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, oy - 28, 16, C.dim, 'center', 600);
      E.ui.drawButtons(ctx, this.overButtons);
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = E.i18n;
      var msg = t.t('drop_hint');
      var y = this.cup.bottom + 10;
      ctx.globalAlpha = 0.92;
      E.ui.roundRect(ctx, v.w / 2 - Math.min(v.w * 0.44, 250), y, Math.min(v.w * 0.88, 500), 34, 17);
      ctx.fillStyle = 'rgba(30,22,58,0.95)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, Math.min(v.w * 0.82, 470), 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 17, size, C.text, 'center', 600);
      if (this.tutT > 8) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
