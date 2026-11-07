/* game/scenes.js — сцены «Слово-Сетки»: menu и play.
   Механика: сетка букв, свайп по соседним клеткам собирает слово; найденные слова
   подсвечиваются «маркером» в списке и на сетке; победа — все слова найдены.
   Магазин на уровне: подсказка, перемешать, +30 секунд. Реклама: баннер в меню,
   interstitial между уровнями (каждый второй), RV «×2» и «продолжить».
   Автопилот для съёмки сам водит пальцем по решению уровня. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;

  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- сохранение: один кошелёк + прогресс + рекорд ---------- */
  var noAdsPrice = '';

  var Save = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.economy.startCoins; E.storage.set('coins', c); }
      return Math.max(0, c | 0);
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    level: function () { return clamp((E.storage.get('lvl', 1) | 0) || 1, 1, C.levels.length); },
    setLevel: function (n) { E.storage.set('lvl', clamp(n | 0, 1, C.levels.length)); },
    best: function () { return Math.max(0, E.storage.get('best', 0) | 0); },
    setBest: function (n) { if ((n | 0) > Save.best()) E.storage.set('best', n | 0); },
    bought: function (key) { return Math.max(0, E.storage.get('buy_' + key, 0) | 0); },
    noAds: function () { return !!E.storage.get('no_ads', false); },
    setNoAds: function () { E.storage.set('no_ads', true); },
    addBought: function (key) { E.storage.set('buy_' + key, Save.bought(key) + 1); }
  };

  var STYLE = {
    primary: { bg: '#2f6b5e', border: '#1f4a41', fg: '#fbf4e3' },
    accent: { bg: '#b4492f', border: '#89341f', fg: '#fbf4e3' },
    plain: { bg: 'rgba(252,246,232,0.96)', border: 'rgba(150,132,100,0.8)', fg: '#2c2a32' },
    dim: { bg: 'rgba(240,231,210,0.96)', border: 'rgba(150,132,100,0.55)', fg: '#5d5866' }
  };

  function mkBtn(x, y, w, h, label, style, onTap, fs) {
    var s = STYLE[style] || STYLE.plain;
    return new E.ui.Button({
      x: x, y: y, w: w, h: h, text: label,
      bg: s.bg, border: s.border, fg: s.fg,
      fontSize: fs || Math.max(13, Math.round(h * 0.34)),
      onTap: onTap
    });
  }

  /* ================================================================ МЕНЮ */
  var menu = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      if (!Save.noAds()) E.sdk.showBanner(); else E.sdk.hideBanner();
      E.sdk.initPayments().then(function () {
        if (E.sdk.getCatalog) E.sdk.getCatalog(function (cat) {
          for (var ci = 0; ci < (cat ? cat.length : 0); ci++) {
            var pr = cat[ci];
            var cid = pr && (pr.productID || pr.id);
            if (cid === 'no_ads' && pr.price) noAdsPrice = String(pr.price);
          }
        });
        E.sdk.getPurchases(function (list) {
          for (var pi = 0; pi < (list ? list.length : 0); pi++) {
            var pid = list[pi] && (list[pi].productID || list[pi].productId);
            if (pid === 'no_ads') { Save.setNoAds(); E.sdk.hideBanner(); break; }
          }
        });
      });
      this.t = 0;
      this.menuLevel = Save.level();
      this.best = Save.best();
      this.layout(game);
    },
    exit: function () { E.sdk.hideBanner(); },
    onResize: function (game) { this.layout(game); },

    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var inset = E.sdk.bannerInsetPx();
      var availH = Math.max(200, H - inset);
      var portrait = H > W * 1.06;
      var k = clamp(Math.min(W / 390, availH / 720), 0.72, 1.3);
      this.inset = inset; this.portrait = portrait; this.k = k;
      var self = this;
      var bw = Math.min(320, W * (portrait ? 0.78 : 0.44));
      var bh = Math.round(clamp(availH * 0.085, 46, 60));
      var rowH = Math.round(clamp(bh * 0.74, 38, 46));
      this.buttons = [];

      var playLabel = this.menuLevel > 1
        ? T('menu_cont') + ' · ' + T('menu_level', { n: this.menuLevel })
        : T('menu_play');

      if (portrait) {
        this.titleY = availH * 0.115;
        this.hintY = this.titleY + 46 * k;
        this.boardCY = availH * 0.42;
        this.boardSize = Math.min(W * 0.66, availH * 0.3);
        var y0 = availH * 0.635;
        this.buttons.push(mkBtn(W / 2 - bw / 2, y0, bw, bh, playLabel, 'accent',
          function () { E.audio.sfx('click'); game.setScene('play', { level: self.menuLevel }); },
          Math.max(15, Math.round(bh * 0.32))));
        var sw = Math.floor((bw - 12) / 2);
        this.buttons.push(mkBtn(W / 2 - bw / 2, y0 + bh + 12, sw, rowH,
          E.audio.isMuted() ? T('snd_off') : T('snd_on'), 'plain',
          function (b) {
            var m = !E.audio.isMuted();
            E.audio.setMuted(m); E.storage.set('muted', m, true);
            b.text = m ? T('snd_off') : T('snd_on');
            E.audio.sfx('click');
          }, Math.max(12, Math.round(rowH * 0.36))));
        this.buttons.push(mkBtn(W / 2 - bw / 2 + sw + 12, y0 + bh + 12, sw, rowH,
          T('lang_btn'), 'plain', function () { self.switchLang(game); },
          Math.max(12, Math.round(rowH * 0.36))));
        this.bestY = availH - 26;
      } else {
        var colX = W * 0.06;
        var blockH = 130 + bh + 12 + rowH;
        var blockY = Math.max(10, (availH - blockH) / 2);
        this.titleY = blockY + 34;
        this.hintY = blockY + 92;
        this.boardCY = availH * 0.5;
        this.boardSize = Math.min(availH * 0.66, W * 0.24);
        var yy = blockY + 130;
        this.buttons.push(mkBtn(colX, yy, bw, bh, playLabel, 'accent',
          function () { E.audio.sfx('click'); game.setScene('play', { level: self.menuLevel }); },
          Math.max(14, Math.round(bh * 0.3))));
        var sw2 = Math.floor((bw - 12) / 2);
        this.buttons.push(mkBtn(colX, yy + bh + 12, sw2, rowH,
          E.audio.isMuted() ? T('snd_off') : T('snd_on'), 'plain',
          function (b) {
            var m = !E.audio.isMuted();
            E.audio.setMuted(m); E.storage.set('muted', m, true);
            b.text = m ? T('snd_off') : T('snd_on');
            E.audio.sfx('click');
          }, Math.max(12, Math.round(rowH * 0.36))));
        this.buttons.push(mkBtn(colX + sw2 + 12, yy + bh + 12, sw2, rowH,
          T('lang_btn'), 'plain', function () { self.switchLang(game); },
          Math.max(12, Math.round(rowH * 0.36))));
        this.bestY = availH - 24;
        this.colX = colX; this.colW = bw;
      }

      // декоративные жетоны «найденных слов» под мини-сеткой
      var boardCx = this.portrait ? W / 2 : W * 0.712;
      var cw3 = Math.min(this.boardSize - 16, 270);
      var chH = Math.round(clamp(this.boardSize * 0.1, 20, 26));
      var chW = Math.floor((cw3 - 16) / 3);
      this.menuChips = [];
      for (var ci = 0; ci < 3; ci++) {
        this.menuChips.push({
          x: boardCx - cw3 / 2 + ci * (chW + 8),
          y: this.boardCY + this.boardSize / 2 + 10,
          w: chW, h: chH
        });
      }
    },

    switchLang: function (game) {
      E.audio.sfx('click');
      var nl = E.i18n.lang === 'ru' ? 'en' : 'ru';
      E.i18n.setLang(nl);
      E.storage.set('lang', nl, true);
      document.title = E.i18n.t('title');
      this.layout(game);
    },

    update: function (game, dt) {
      this.t += dt;
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) {
        game.setScene('play', { level: this.menuLevel });
      }
      if (E.sdk.bannerInsetPx() !== this.inset) this.layout(game);
    },

    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h, k = this.k || 1;
      A.paper(ctx, W, H);
      var title = T('title');

      if (this.portrait) {
        A.titleInk(ctx, title, W / 2, this.titleY, W * 0.9, Math.round(46 * k), P.ink);
      } else {
        A.titleInk(ctx, title, this.colX + this.colW / 2, this.titleY, this.colW * 1.02, Math.round(52 * k), P.ink);
      }

      A.miniBoard(ctx, this.portrait ? W / 2 : W * 0.712, this.boardCY, this.boardSize, 7 + this.t * 0.02, P.accent2);

      var demoWords = (E.i18n.lang === 'ru') ? ['ВОЛНА', 'МАЯК', 'ШТОРМ'] : ['WAVE', 'BEACON', 'STORM'];
      for (var ci = 0; ci < (this.menuChips || []).length; ci++) {
        var cr = this.menuChips[ci];
        A.chip(ctx, cr.x, cr.y, cr.w, cr.h, demoWords[ci], ci < 2, P.accent2, { t: this.t });
      }

      // подсказка под заголовком
      var hint = T('menu_hint');
      var hw = this.portrait ? W * 0.86 : this.colW * 1.02;
      var hx = this.portrait ? W / 2 : this.colX + this.colW / 2;
      var hs2 = E.ui.fit(ctx, hint, hw, Math.max(12, Math.round(14 * k)), 400);
      E.ui.text(ctx, hint, hx, this.hintY, hs2, P.inkSoft, 'center', 400);

      E.ui.drawButtons(ctx, this.buttons);

      // рекорд
      if (this.best > 0) {
        E.ui.text(ctx, T('menu_best', { n: this.best }), W / 2, this.bestY, Math.max(12, Math.round(13 * k)), P.inkFaint, 'center', 500);
      }
      E.ui.text(ctx, 'v' + G.version, 8, H - (this.inset || 0) - 10, 12, 'rgba(93,88,102,0.55)', 'left', 400);
    },

    getCaptureState: function () { return { scene: 'menu', mode: 'menu' }; }
  };

  /* ================================================================ ИГРА */
  var play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      this.game = game;
      E.sdk.hideBanner();
      E.fx.reset();
      G.art = A;
      var seed = (params.seed != null) ? params.seed
        : (E.capture.seed != null) ? E.capture.seed
        : ((Date.now() % 999983) | 0);
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      this.captureMode = !!E.capture.active;
      this.fxRng = new E.Rng((this.seedNum ^ 0x5f3759df) >>> 0);
      this.coins = Save.coins();
      this.t = 0;
      this.panel = '';
      this.tutT = (E.storage.get('tut', 0) || this.autopilot) ? 99 : 0;
      this.endButtons = [];
      this.shopBtns = [];
      this.hudBtns = [];
      this.toast = null;
      this.msg = null; this.msgT = 0;
      this.auto = null; this.autoT = 0;
      this.simLimit = false;

      var lv = params.level != null ? params.level : Save.level();
      this.startLevel(game, lv);
      this.layout(game);
      this.buildHud(game);
      this.buildOver(game);
      if (E.capture && E.capture.active) this.applyCapture(game);
      E.audio.music('play');
      E.sdk.gameplayStart();
    },

    exit: function () {
      E.sdk.gameplayStop();
      E.sdk.hideBanner();
    },

    onResize: function (game) {
      this.layout(game);
      this.buildHud(game);
      this.buildOver(game);
    },

    onBack: function (game) {
      if (this.mode === 'running') this.setPaused(true, game);
    },

    /* ---------- уровень ---------- */
    startLevel: function (game, n) {
      this.level = clamp(n | 0, 1, C.levels.length);
      this.rng = new E.Rng((this.seedNum ^ (this.level * 7919)) >>> 0);
      this.st = L.newRound(this.level, E.i18n.lang, this.rng);
      this.st.timeMax = L.timeFor(this.level);
      this.st.timeLeft = this.st.timeMax;
      this.theme = C.themes[this.st.theme];
      this.n = this.st.size;
      this.score = 0;
      this.sel = [];
      this.dragging = false;
      this.hint = { idx: -1, word: null, t: 0 };
      this.reviveUsed = false;
      this.doubled = false;
      this.reward = 0;
      this.timeBonus = 0;
      this.newBest = false;
      this.mode = 'running';
      this.panel = '';
      this.selSfxT = 0;
      this.buildOver(game);
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
      this.portrait = H > W * 1.06;
      var n = this.n || 8;
      var hudH = clamp(H * 0.082, 46, 66);
      var topY = hudH + 8;
      var bottom = H - banner - 6;
      var cell, gx, gy;

      if (this.portrait) {
        var listH = clamp(H * 0.185, 96, 150);
        var listTop = bottom - listH;
        var availH = Math.max(120, listTop - 12 - topY);
        cell = Math.floor(Math.min((W - 22) / n, availH / n));
        var gw = cell * n;
        gx = Math.round((W - gw) / 2);
        gy = Math.round(topY + (availH - gw) / 2);
        this.listRect = { x: 8, y: listTop, w: W - 16, h: listH };
        this.chipCols = 3;
      } else {
        var listW = clamp(W * 0.23, 166, 250);
        var availH2 = Math.max(120, bottom - topY);
        cell = Math.floor(Math.min((W - listW - 34) / n, availH2 / n));
        var gw2 = cell * n;
        gx = Math.round(10 + ((W - listW - 22) - gw2) / 2);
        gy = Math.round(topY + (availH2 - gw2) / 2);
        this.listRect = { x: W - listW - 10, y: topY, w: listW, h: availH2 };
        this.chipCols = 1;
      }
      this.gx = gx; this.gy = gy; this.cell = cell; this.hudH = hudH;
      this.bannerInset = banner;
      this.portrait2 = this.portrait;
    },

    buildHud: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var self = this;
      var s = 44;
      var y = clamp((this.hudH - s) / 2, 2, 30);
      var pause = new E.ui.Button({
        x: W - 8 - s, y: y, w: s, h: s, id: 'pause',
        bg: 'rgba(252,246,232,0.92)', border: 'rgba(150,132,100,0.8)',
        icon: function (ctx, b) { A.iconPause(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.52, P.ink); },
        onTap: function () { E.audio.sfx('click'); self.setPaused(true, game); }
      });
      var shop = new E.ui.Button({
        x: W - 8 - s * 2 - 8, y: y, w: s, h: s, id: 'shop',
        bg: 'rgba(252,246,232,0.92)', border: 'rgba(150,132,100,0.8)',
        icon: function (ctx, b) { A.iconBag(ctx, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w * 0.6, P.accent); },
        onTap: function () { E.audio.sfx('click'); self.openShop(game); }
      });
      this.pauseBtn = pause;
      this.shopBtn = shop;
      this.hudBtns = [pause, shop];
    },

    /* ---------- оверлеи ---------- */
    buildOver: function (game) {
      if (!this.st) { this.endButtons = []; return; }
      if (this.mode === 'shop') { this.buildShop(game); return; }
      this.endButtons = [];
      this.overCard = null;
      var v = game.view, W = v.w, H = v.h, self = this;
      if (this.mode === 'running') return;
      if (this.mode !== 'paused' && this.mode !== 'win' && this.mode !== 'over') return;

      var banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
      var availH = H - banner;
      var cw = Math.min(W * 0.9, 400);
      var bh = 48, gap = 8;
      var items = [];
      var title = '', lines = [];

      if (this.mode === 'paused') {
        title = T('pause_title');
        items.push({ label: T('pause_resume'), style: 'primary', fn: function () { E.audio.sfx('click'); self.setPaused(false, game); } });
        items.push({ label: T('pause_restart'), style: 'plain', fn: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); } });
        items.push({ label: T('pause_shop'), style: 'accent', fn: function () { E.audio.sfx('click'); self.openShop(game); } });
        items.push({
          label: E.audio.isMuted() ? T('snd_off') : T('snd_on'), style: 'dim',
          fn: function (b) {
            var m = !E.audio.isMuted();
            E.audio.setMuted(m); E.storage.set('muted', m, true);
            b.text = m ? T('snd_off') : T('snd_on');
            E.audio.sfx('click');
          }
        });
        items.push({ label: T('pause_menu'), style: 'dim', fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      } else if (this.mode === 'win') {
        title = T('win_title');
        lines.push({ text: T('win_score', { n: this.score }), size: 15, color: P.inkSoft });
        lines.push({ text: T('win_coins', { n: this.reward }), size: 17, color: P.accent });
        if (this.timeBonus > 0) lines.push({ text: T('win_time_bonus', { n: this.timeBonus }), size: 12, color: P.inkFaint });
        if (this.newBest) lines.push({ text: T('win_best'), size: 13, color: P.accent2 });
        var last = this.level >= C.levels.length;
        items.push({
          label: last ? T('win_final') : T('win_next'), style: 'primary',
          fn: function () { E.audio.sfx('click'); self.goNext(game); }
        });
        if (!this.captureMode && !this.autopilot && !this.doubled) {
          items.push({
            label: T('win_double'), style: 'accent',
            fn: function () {
              E.sdk.showRewarded({
                onReward: function () {
                  self.doubled = true;
                  self.coins += self.reward;
                  self.addScore(self.reward * 2);
                  Save.setCoins(self.coins);
                  Save.setBest(self.score);
                  E.audio.sfx('coin');
                  self.toast = { text: T('toast_rv', { n: self.reward }), t: 1.6, color: P.accent2 };
                  self.buildOver(game);
                },
                onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.toast = { text: T('ad_fail'), t: 1.4, color: P.bad }; } }
              });
            }
          });
        }
        items.push({ label: T('win_menu'), style: 'dim', fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      } else {
        title = T('over_title');
        lines.push({ text: T('over_words', { a: L.countFound(this.st), b: this.st.words.length }), size: 15, color: P.inkSoft });
        if (!this.captureMode && !this.autopilot && !this.reviveUsed) {
          items.push({
            label: T('over_revive'), style: 'accent',
            fn: function () {
              E.sdk.showRewarded({
                onReward: function () {
                  self.reviveUsed = true;
                  self.st.timeLeft = Math.max(self.st.timeLeft, C.economy.timeAdd);
                  self.mode = 'running';
                  E.sdk.gameplayStart();
                  E.audio.sfx('revive');
                  self.toast = { text: T('toast_time', { n: C.economy.timeAdd }), t: 1.6, color: P.accent2 };
                  self.buildOver(game);
                },
                onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.toast = { text: T('ad_fail'), t: 1.4, color: P.bad }; } }
              });
            }
          });
          lines.push({ text: T('over_revive_d'), size: 12, color: P.inkFaint });
        }
        items.push({ label: T('over_retry'), style: 'primary', fn: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); } });
        items.push({ label: T('over_menu'), style: 'dim', fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      }

      var titleH = 46;
      var linesH = lines.length * 21;
      var btnH = Math.min(bh, Math.max(42, (availH - titleH - linesH - 70) / Math.max(1, items.length) - gap));
      var cardH = titleH + linesH + 10 + items.length * (btnH + gap) - gap + 22;
      cardH = Math.min(cardH, availH - 20);
      var cx = (W - cw) / 2;
      var cy = Math.max(10, (availH - cardH) / 2);
      this.overCard = { x: cx, y: cy, w: cw, h: cardH };
      this.overTitle = title;
      this.overLines = lines;

      var by = cy + titleH + linesH + 8;
      var bx = cx + 22, bw = cw - 44;
      for (var i = 0; i < items.length; i++) {
        (function (it, idx) {
          self.endButtons.push(mkBtn(bx, by + idx * (btnH + gap), bw, btnH, it.label, it.style, function (b) {
            it.fn(b);
          }, Math.max(13, Math.round(btnH * 0.34))));
        })(items[i], i);
      }
    },

    /* ---------- магазин ---------- */
    openShop: function (game) {
      this.shopFrom = this.mode === 'paused' ? 'paused' : 'running';
      this.panel = 'shop';
      this.mode = 'shop';
      E.sdk.gameplayStop();
      this.buildOver(game);
    },
    closeShop: function (game) {
      this.mode = this.shopFrom === 'paused' ? 'paused' : 'running';
      this.panel = '';
      if (this.mode === 'running') E.sdk.gameplayStart(); else E.sdk.gameplayStop();
      this.buildOver(game);
    },

    shopItems: function () {
      var items = [
        { id: 'hint', name: T('item_hint'), desc: T('item_hint_d'), price: L.price(C.economy.hintPrice, Save.bought('hint')), icon: 'bulb' },
        { id: 'shuffle', name: T('item_shuffle'), desc: T('item_shuffle_d'), price: L.price(C.economy.shufflePrice, Save.bought('shuffle')), icon: 'shuffle' },
        { id: 'time', name: T('item_time'), desc: T('item_time_d'), price: L.price(C.economy.timePrice, Save.bought('time')), icon: 'clock' }
      ];
      if (!Save.noAds()) {
        items.push({ id: 'no_ads', name: T('item_no_ads'), desc: T('item_no_ads_d'), price: 0, iap: true, icon: 'noAds' });
      }
      return items;
    },

    buildShop: function (game) {
      var v = game.view, W = v.w, H = v.h, self = this;
      var banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
      var availH = H - banner;
      var cw = Math.min(W * 0.92, 420);
      var rowH = clamp(availH * 0.1, 50, 66);
      var gap = 8;
      var items = this.shopItems();
      var titleH = 50;
      var rvH = 44, closeH = 42;
      var cardH = titleH + items.length * (rowH + gap) + rvH + gap + closeH + 20;
      if (cardH > availH - 16) {
        rowH = Math.max(46, rowH - 4);
        cardH = titleH + items.length * (rowH + gap) + rvH + gap + closeH + 20;
      }
      cardH = Math.min(cardH, availH - 12);
      var cx = (W - cw) / 2, cy = Math.max(8, (availH - cardH) / 2);
      this.shopCard = { x: cx, y: cy, w: cw, h: cardH, rowH: rowH };
      this.shopBtns = [];

      var bx = cx + 16, bw = cw - 32;
      var y = cy + titleH;
      for (var i = 0; i < items.length; i++) {
        (function (it, idx) {
          var afford = self.coins >= it.price;
          self.shopBtns.push(new E.ui.Button({
            x: bx, y: y + idx * (rowH + gap), w: bw, h: rowH,
            bg: 'rgba(252,246,232,0.96)',
            border: afford ? 'rgba(47,107,94,0.75)' : 'rgba(150,132,100,0.45)',
            icon: function (ctx, b) {
              var c2 = b.x + b.h / 2 + 2, cy2 = b.y + b.h / 2;
              if (it.icon === 'bulb') A.iconBulb(ctx, c2, cy2, b.h * 0.56, P.ink);
              else if (it.icon === 'shuffle') A.iconShuffle(ctx, c2, cy2 + 2, b.h * 0.56, P.ink);
              else if (it.icon === 'clock') A.iconClock(ctx, c2, cy2, b.h * 0.56, P.ink);
              else {
                ctx.save();
                ctx.strokeStyle = P.ink; ctx.fillStyle = P.ink;
                ctx.lineWidth = Math.max(1.5, b.h * 0.055);
                var aw = b.h * 0.42, ah = b.h * 0.28;
                ctx.strokeRect(c2 - aw / 2, cy2 - ah / 2, aw, ah);
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.font = '700 ' + Math.round(b.h * 0.17) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
                ctx.fillText('AD', c2, cy2 + 1);
                ctx.beginPath();
                ctx.moveTo(c2 - aw * 0.66, cy2 + ah * 0.74);
                ctx.lineTo(c2 + aw * 0.66, cy2 - ah * 0.74);
                ctx.stroke();
                ctx.restore();
              }
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = P.ink;
              ctx.font = '700 ' + Math.round(b.h * 0.28) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
              ctx.fillText(it.name, c2 + b.h * 0.52, cy2 - b.h * 0.14);
              ctx.fillStyle = P.inkSoft;
              ctx.font = '400 ' + Math.max(12, Math.round(b.h * 0.2)) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
              var descW = b.x + b.w - 74 - (c2 + b.h * 0.52);
              E.ui.fit(ctx, it.desc, Math.max(60, descW), Math.max(12, Math.round(b.h * 0.2)), 400);
              ctx.fillText(it.desc, c2 + b.h * 0.52, cy2 + b.h * 0.18);
              // цена
              if (it.iap) {
                ctx.textAlign = 'right';
                ctx.fillStyle = P.accent2;
                ctx.font = '700 ' + Math.round(b.h * 0.23) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(noAdsPrice || T('item_no_ads_price'), b.x + b.w - 14, cy2 + 1);
              } else {
                var pr = String(it.price);
                ctx.font = '700 ' + Math.round(b.h * 0.26) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
                var pw = ctx.measureText(pr).width;
                A.coin(ctx, b.x + b.w - 18 - pw - 12, cy2, b.h * 0.15);
                ctx.textAlign = 'right';
                ctx.fillStyle = afford ? P.accent2 : P.bad;
                ctx.fillText(pr, b.x + b.w - 14, cy2 + 1);
              }
            },
            onTap: function () { self.buy(game, it); }
          }));
        })(items[i], i);
      }

      var rvY = y + items.length * (rowH + gap);
      if (!this.captureMode && !this.autopilot) {
        this.shopBtns.push(mkBtn(bx, rvY, bw, rvH, T('shop_rv', { n: C.economy.rvCoins }), 'accent', function () {
          E.sdk.showRewarded({
            onReward: function () {
              self.coins += C.economy.rvCoins;
              Save.setCoins(self.coins);
              E.audio.sfx('coin');
              self.toast = { text: T('toast_rv', { n: C.economy.rvCoins }), t: 1.6, color: P.accent2 };
              self.buildOver(game);
            },
            onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.toast = { text: T('ad_fail'), t: 1.4, color: P.bad }; } }
          });
        }, 14));
      } else {
        this.shopBtns.push(mkBtn(bx, rvY, bw, rvH, T('shop_rv', { n: C.economy.rvCoins }), 'dim', function () {}, 14));
      }
      this.shopBtns.push(mkBtn(bx, rvY + rvH + gap, bw, closeH, T('shop_close'), 'plain',
        function () { E.audio.sfx('click'); self.closeShop(game); }, 14));
    },

    buy: function (game, it) {
      if (it.id === 'no_ads') {
        var self = this;
        E.sdk.purchase('no_ads', function () {
          Save.setNoAds();
          E.sdk.hideBanner();
          E.audio.sfx('coin');
          self.toast = { text: T('item_no_ads_owned'), t: 1.9, color: P.accent2 };
          self.buildOver(game);
        }, function () {
          E.audio.sfx('deny');
          self.toast = { text: T('iap_fail'), t: 1.6, color: P.bad };
        });
        return;
      }
      if (this.coins < it.price) {
        E.audio.sfx('deny');
        this.toast = { text: T('not_enough'), t: 1.4, color: P.bad };
        return;
      }
      if (it.id === 'hint') {
        var w = L.firstUnfound(this.st);
        if (!w) return;
        this.hint = { idx: w.path[0], word: w.text, t: 4.2 };
        this.toast = { text: T('toast_hint', { w: w.text }), t: 2, color: P.gold };
      } else if (it.id === 'shuffle') {
        L.reshuffle(this.st, this.rng);
        this.hint.idx = -1;
        this.toast = { text: T('toast_shuffle'), t: 1.5, color: P.accent2 };
      } else {
        this.st.timeLeft += C.economy.timeAdd;
        this.toast = { text: T('toast_time', { n: C.economy.timeAdd }), t: 1.5, color: P.accent2 };
      }
      this.coins -= it.price;
      Save.addBought(it.id);
      if (!this.captureMode && !this.autopilot) Save.setCoins(this.coins);
      E.audio.sfx('buy');
      this.sel = [];
      this.buildOver(game);
    },

    /* ---------- пауза / исходы ---------- */
    setPaused: function (on, game) {
      game = game || this.game;
      if (on && this.mode === 'running') {
          this.mode = 'paused';
        E.sdk.gameplayStop();
        this.sel = [];
        this.buildOver(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = 'running';
        E.sdk.gameplayStart();
        this.buildOver(game);
      }
    },

    addScore: function (n) {
      this.score += n;
      var b = Save.best();
      if (this.score > b) this.newBest = true;
    },

    found: function (w) {
      if (this.mode !== 'running') return;
      w.found = true;
      var len = w.text.length;
      var gain = L.coinsForWord(len);
      var pts = L.wordScore(len);
      this.addScore(pts);
      this.coins += gain;
      if (!this.captureMode && !this.autopilot) Save.setCoins(this.coins);
      this.msg = T('toast_found', { n: gain });
      this.msgT = 1.2;
      E.audio.sfx('coin');
      E.fx.flash('#f3d487', 0.08);
      var mid = w.path[Math.floor(w.path.length / 2)];
      var cc = this.boardCenter(mid);
      E.fx.burst(cc.x, cc.y, this.theme.accent, 12, 170, this.fxRng);
      E.fx.burst(cc.x, cc.y, '#d8a33a', 5, 110, this.fxRng);
      if (L.allFound(this.st)) this.completeLevel(this.captureMode);
    },

    completeLevel: function (capture) {
      if (this.mode === 'win') return;
      var eco = C.economy;
      this.timeBonus = Math.round(this.st.timeLeft) * eco.timeBonus;
      this.reward = eco.winBase + (this.level - 1) * eco.winPerLevel + this.timeBonus;
      this.coins += this.reward;
      this.addScore(this.timeBonus * 2);
      if (!capture && !this.autopilot) {
        Save.setCoins(this.coins);
        Save.setBest(this.score);
        if (this.level < C.levels.length) Save.setLevel(Math.max(Save.level(), this.level + 1));
      }
      this.mode = 'win';
      this.sel = [];
      E.audio.sfx('wave');
      E.sdk.gameplayStop();
      this.buildOver(this.game);
    },

    failLevel: function (capture) {
      if (this.mode === 'over') return;
      this.mode = 'over';
      this.sel = [];
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      if (!capture && !this.autopilot) Save.setCoins(this.coins);
      this.buildOver(this.game);
    },

    goNext: function (game) {
      if (this.level >= C.levels.length) { game.setScene('menu', {}); return; }
      var self = this;
      var next = this.level + 1;
      var go = function () { game.setScene('play', { level: next }); };
      if (!this.captureMode && !this.autopilot && !Save.noAds() && this.level % C.ads.interstitialEvery === 0) {
        E.sdk.showInterstitial(function () { go(); });
      } else {
        go();
      }
    },

    /* ---------- ввод ---------- */
    cellAt: function (x, y) {
      var c = this.cell, n = this.n;
      if (!c) return -1;
      var cx = Math.floor((x - this.gx) / c);
      var cy = Math.floor((y - this.gy) / c);
      if (cx < 0 || cy < 0 || cx >= n || cy >= n) return -1;
      return cy * n + cx;
    },
    boardCenter: function (k) {
      var c = this.cell, n = this.n;
      return { x: this.gx + (k % n + 0.5) * c, y: this.gy + (Math.floor(k / n) + 0.5) * c };
    },

    /* Свайп идёт по линии: первая клетка задаёт старт, вторая — направление,
       дальше путь только вытягивается/сжимается вдоль этой линии. Так палец,
       проскочивший по диагонали через соседнюю клетку, не приклеивает лишние
       буквы, а быстрый свайп на 5 клеток сразу добирает всю линию. */
    extendTo: function (target) {
      var n = this.n, sel = this.sel;
      if (!sel.length) { sel.push(target); return; }
      var start = sel[0], last = sel[sel.length - 1];
      if (target === last) return;
      var sx = start % n, sy = Math.floor(start / n);
      var tx = target % n, ty = Math.floor(target / n);
      var vx = tx - sx, vy = ty - sy;
      if (vx === 0 && vy === 0) return;
      var dx, dy;
      if (sel.length === 1) {
        var ax = Math.abs(vx), ay = Math.abs(vy);
        if (ax !== 0 && ay !== 0 && ax !== ay) return; // не линия из восьми направлений
        dx = ax ? vx / ax : 0;
        dy = ay ? vy / ay : 0;
      } else {
        var p1 = sel[1];
        dx = (p1 % n) - sx;
        dy = Math.floor(p1 / n) - sy;
        if (vx * dy - vy * dx !== 0) return; // не на этой линии — игнор
        var back = dx ? vx / dx : (dy ? vy / dy : 0);
        if (back < 0) return;
      }
      var dist = Math.max(Math.abs(vx), Math.abs(vy));
      if (dist <= 0) return;
      var want = dist + 1;
      if (want < sel.length) { // палец вернулся назад — сжимаем путь
        sel.length = want;
        if (this.t - this.selSfxT > 0.05) { this.selSfxT = this.t; E.audio.sfx('tick'); }
        return;
      }
      for (var i = sel.length; i < want; i++) {
        var k = (sy + dy * i) * n + (sx + dx * i);
        if (k < 0 || k >= n * n || sel.indexOf(k) >= 0) break;
        sel.push(k);
        if (this.t - this.selSfxT > 0.045) { this.selSfxT = this.t; E.audio.sfx('tick'); }
      }
    },

    submit: function () {
      var text = L.pathText(this.st, this.sel);
      this.sel = [];
      if (text.length < 2) return;
      var w = L.findWord(this.st, text);
      if (w) { this.found(w); return; }
      var already = false;
      for (var i = 0; i < this.st.words.length; i++) {
        var wt = this.st.words[i];
        if (wt.found && (wt.text === text || wt.text === text.split('').reverse().join(''))) already = true;
      }
      if (already) {
        E.audio.sfx('deny');
        this.msg = T('toast_dup'); this.msgT = 1.1;
      } else if (text.length >= 3) {
        E.audio.sfx('deny');
        this.msg = T('toast_bad'); this.msgT = 1.1;
      }
    },

    handleInput: function (Ptr) {
      if (Ptr.pressed) {
        if (E.ui.handleTap(this.hudBtns, Ptr.x, Ptr.y)) return;
        // старт — по ТОЧКЕ НАЖАТИЯ, а не по текущему курсору: быстрый свайп
        // успевает сдвинуться до ближайшего update, и первая буква иначе теряется
        var c = this.cellAt(Ptr.downX, Ptr.downY);
        if (c >= 0) {
          this.sel = [c];
          this.dragging = true;
          E.audio.sfx('tick');
          this.selSfxT = this.t;
        } else {
          this.sel = [];
          this.dragging = false;
        }
        return;
      }
      if (!this.dragging) return;
      if (Ptr.down) {
        var tgt = this.cellAt(Ptr.x, Ptr.y);
        if (tgt >= 0) this.extendTo(tgt);
      }
      if (Ptr.released) {
        this.dragging = false;
        this.submit();
      }
    },

    /* ---------- автопилот ---------- */
    autoTick: function (dt) {
      var st = this.st;
      if (this.auto) {
        this.auto.t += dt;
        var step = 0.08;
        while (this.auto.t >= step && this.auto.i < this.auto.word.path.length) {
          this.auto.t -= step;
          this.sel.push(this.auto.word.path[this.auto.i]);
          this.auto.i++;
        }
        if (this.auto.i >= this.auto.word.path.length && this.auto.t > 0.22) {
          var w = this.auto.word;
          this.auto = null;
          this.sel = [];
          if (!w.found) this.found(w);
        }
        return;
      }
      if (this.simLimit && L.countFound(st) >= st.words.length - 1) return;
      this.autoT += dt;
      if (this.autoT > 0.8) {
        this.autoT = 0;
        var list = [];
        for (var i = 0; i < st.words.length; i++) if (!st.words[i].found) list.push(st.words[i]);
        if (list.length) this.auto = { word: list[0], i: 0, t: 0 };
      }
    },

    /* Прогон без ввода: для кадров съёмки. Оставляет минимум одно слово не найденным,
       чтобы кадр оставался в режиме running. */
    simulate: function (sec) {
      var steps = Math.round(sec * 60);
      var saveAuto = this.autopilot;
      this.autopilot = true;
      this.simLimit = true;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.t += 1 / 60;
        this.st.timeLeft = Math.max(8, this.st.timeLeft - 1 / 60);
        this.autoTick(1 / 60);
      }
      this.autopilot = saveAuto;
      this.simLimit = false;
      this.auto = null;
      this.sel = [];
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.captureMode = true;
      if (cp.wave != null) this.startLevel(game, parseInt(cp.wave, 10) || 1);
      if (cp.coins != null) this.coins = Math.max(0, parseInt(cp.coins, 10) || 0);
      var mode = cp.mode;
      if (mode === 'shop') {
        this.openShop(game);
      } else if (mode === 'over') {
        this.failLevel(true);
      } else if (mode === 'win') {
        for (var i = 0; i < this.st.words.length; i++) {
          if (!this.st.words[i].found) {
            this.st.words[i].found = true;
            this.score += L.wordScore(this.st.words[i].text.length);
          }
        }
        this.completeLevel(true);
      } else {
        var t = clamp(parseFloat(cp.t) || 0, 0, 40);
        if (t > 0) this.simulate(t);
      }
      this.layout(game);
      this.buildHud(game);
      this.buildOver(game);
    },

    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'over') { this.failLevel(true); }
      else if (s.mode === 'win') {
        for (var i = 0; i < this.st.words.length; i++) this.st.words[i].found = true;
        this.completeLevel(true);
      }
      if (s.level || s.wave) { this.startLevel(game, s.level || s.wave); }
      this.layout(game);
      this.buildHud(game);
      this.buildOver(game);
    },

    getCaptureState: function () {
      return {
        scene: 'play', mode: this.mode, level: this.level,
        found: this.st ? L.countFound(this.st) : 0,
        words: this.st ? this.st.words.length : 0,
        time: this.st ? Math.ceil(this.st.timeLeft) : 0,
        score: this.score || 0,
        coins: Math.round(this.coins || 0)
      };
    },

    /* ---------- главный шаг ---------- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.msgT > 0) this.msgT -= dt;
      // подсказка тикает только в игре: в лавке и на паузе она не должна истечь
      if (this.mode === 'running' && this.hint.t > 0) {
        this.hint.t -= dt;
        if (this.hint.t <= 0) this.hint.idx = -1;
      }
      if (this.tutT < 8) {
        this.tutT += dt;
        if (this.tutT >= 8 && !E.storage.get('tut', 0)) E.storage.set('tut', 1);
      }

      var Ptr = E.input.pointer;
      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'paused') { this.setPaused(false, game); return; }
        if (this.mode === 'running') { this.setPaused(true, game); return; }
        if (this.mode === 'shop') { this.closeShop(game); return; }
      }

      if (this.mode === 'shop') {
        if (Ptr.pressed) E.ui.handleTap(this.shopBtns, Ptr.x, Ptr.y);
        return;
      }
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (Ptr.pressed) E.ui.handleTap(this.endButtons, Ptr.x, Ptr.y);
        if ((this.autopilot || this.captureMode) && this.mode !== 'paused') {
          this.autoT += dt;
          if (this.autoT > 1.5) {
            this.autoT = 0;
            if (this.mode === 'win') this.goNext(game);
            else if (this.mode === 'over') game.setScene('play', { level: this.level });
          }
        }
        return;
      }

      // running
      this.st.timeLeft -= dt;
      if (this.st.timeLeft <= 0) {
        this.st.timeLeft = 0;
        this.failLevel(this.captureMode);
        return;
      }
      if (this.autopilot) {
        if (this.st.timeLeft < 12) this.st.timeLeft += 30;
        this.autoTick(dt);
      }
      this.handleInput(Ptr);
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      A.paper(ctx, W, H);
      this.drawHud(ctx, W);
      this.drawBoard(ctx);
      this.drawList(ctx);
      this.drawToast(ctx, W);
      if (this.tutT < 8 && !this.captureMode && !this.autopilot) this.drawTutorial(ctx, W);

      // кнопки HUD живут только в игре: на оверлеях они не должны «торчать» над затемнением
      if (this.mode === 'running') E.ui.drawButtons(ctx, this.hudBtns);
      if (this.mode === 'shop') this.drawShop(ctx);
      else if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.drawOver(ctx);

      E.fx.draw(ctx);
      E.fx.drawFlash(ctx, W, H);
    },

    drawHud: function (ctx, W) {
      var hudH = this.hudH;
      // полоса таймера
      var frac = clamp(this.st.timeLeft / Math.max(1, this.st.timeMax), 0, 1);
      var barY = hudH - 5;
      ctx.fillStyle = 'rgba(44,42,50,0.10)';
      ctx.fillRect(0, barY, W, 5);
      ctx.fillStyle = frac < 0.22 ? P.bad : (frac < 0.45 ? P.gold : P.accent2);
      ctx.fillRect(0, barY, W * frac, 5);

      // монеты
      var coinX = W - 8 - 44 * 2 - 8 - 14;
      A.coin(ctx, coinX, this.hudH / 2, 9);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      ctx.font = '700 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(String(Math.round(this.coins)), coinX - 13, this.hudH / 2 + 1);

      // табличка уровня: на узком экране — короткая форма «12 · Тема»
      var lvlText = T('hud_level', { n: this.level, t: T(this.theme.name) });
      var maxTagW = Math.min(coinX - 68, W * 0.58);
      ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var tw = ctx.measureText(lvlText).width;
      var tw2 = Math.min(tw + 22, maxTagW);
      var fitPre = E.ui.fit(ctx, lvlText, tw2 - 20, 13, 700);
      if (fitPre < 12) {
        lvlText = String(this.level) + ' · ' + T(this.theme.name);
        ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        tw = ctx.measureText(lvlText).width;
        tw2 = Math.min(tw + 22, maxTagW);
      }
      var tagY = Math.max(4, (hudH - 30) / 2);
      ctx.fillStyle = 'rgba(252,246,232,0.92)';
      A.rr(ctx, 8, tagY, tw2, 30, 8); ctx.fill();
      ctx.strokeStyle = this.theme.accent; ctx.lineWidth = 1.4;
      A.rr(ctx, 8, tagY, tw2, 30, 8); ctx.stroke();
      ctx.save();
      A.rr(ctx, 8, tagY, tw2, 30, 8); ctx.clip();
      ctx.fillStyle = this.theme.accent;
      ctx.fillRect(8, tagY, 4, 30);
      ctx.restore();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var fit = E.ui.fit(ctx, lvlText, tw2 - 20, 13, 700);
      ctx.font = '700 ' + fit + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(lvlText, 18, tagY + 16);
    },

    drawBoard: function (ctx) {
      var foundWords = [];
      for (var i = 0; i < this.st.words.length; i++) if (this.st.words[i].found) foundWords.push(this.st.words[i].path);
      A.drawBoard(ctx, {
        gx: this.gx, gy: this.gy, cell: this.cell, n: this.n,
        cells: this.st.cells,
        found: L.foundMap(this.st),
        foundWords: foundWords,
        sel: this.sel,
        hint: this.hint.idx,
        accent: this.theme.accent,
        seed: this.seedNum % 1000,
        t: this.t
      });
    },

    drawList: function (ctx) {
      var r = this.listRect, cols = this.chipCols || 3;
      var words = this.st.words;
      var rows = Math.ceil(words.length / cols);
      var gap = 6;
      var labelH = 20;
      var chipH = Math.min(34, Math.floor((r.h - labelH - (rows - 1) * gap - 4) / Math.max(1, rows)));
      chipH = Math.max(22, chipH);
      var chipW = Math.floor((r.w - (cols - 1) * gap) / cols);
      var top = r.y + labelH;

      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.inkSoft;
      ctx.font = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(T('hud_words', { a: L.countFound(this.st), b: words.length }), r.x + 2, r.y + 9);

      for (var i = 0; i < words.length; i++) {
        var col = i % cols, row = Math.floor(i / cols);
        var x = r.x + col * (chipW + gap);
        var y = top + row * (chipH + gap);
        var w = words[i];
        var pulse = this.hint.word === w.text && this.hint.t > 0;
        A.chip(ctx, x, y, chipW, chipH, w.text, w.found, this.theme.accent,
          { pulse: pulse, t: this.t });
      }
    },

    drawToast: function (ctx, W) {
      var txt = this.toast ? this.toast.text : (this.msgT > 0 ? this.msg : null);
      var col = this.toast ? this.toast.color : P.accent2;
      if (!txt) {
        // живое слово под пальцем
        if (this.sel.length > 1) {
          var s = L.pathText(this.st, this.sel);
          var y0 = this.gy - 18;
          if (y0 < this.hudH + 14) y0 = this.gy + this.n * this.cell + 16;
          // не даём живому слову уехать за кромку экрана (ландшафт 844×390)
          var Hv = this.game && this.game.view ? this.game.view.h : 720;
          y0 = Math.max(24, Math.min(Hv - 18, y0));
          ctx.font = '700 16px Georgia, "Times New Roman", serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(44,42,50,0.75)';
          ctx.fillText(s, W / 2, y0);
        }
        return;
      }
      var y = this.hudH + 22;
      if (this.portrait) y = Math.max(this.hudH + 20, this.gy - 26);
      ctx.font = '700 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var tw = Math.min(W * 0.86, ctx.measureText(txt).width + 24);
      ctx.fillStyle = 'rgba(252,246,232,0.94)';
      A.rr(ctx, (W - tw) / 2, y - 13, tw, 26, 13); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      A.rr(ctx, (W - tw) / 2, y - 13, tw, 26, 13); ctx.stroke();
      ctx.fillStyle = col;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, W / 2, y + 1);
    },

    drawTutorial: function (ctx, W) {
      var alpha = clamp((8 - this.tutT) / 1.5, 0, 1) * clamp(this.tutT / 0.5, 0, 1);
      ctx.globalAlpha = alpha;
      var bw = Math.min(W * 0.88, 340);
      var bx = (W - bw) / 2;
      // над сеткой, если есть зазор, иначе — по нижнему краю сетки
      var gapTop = this.gy - (this.hudH + 6);
      var by = gapTop >= 46 ? this.hudH + 6 : this.gy + this.n * this.cell - 56;
      ctx.fillStyle = 'rgba(252,246,232,0.94)';
      A.rr(ctx, bx, by, bw, 46, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(150,132,100,0.7)'; ctx.lineWidth = 1.2;
      A.rr(ctx, bx, by, bw, 46, 10); ctx.stroke();
      var s1 = E.ui.fit(ctx, T('tut_swipe'), bw - 24, 12, 600);
      E.ui.text(ctx, T('tut_swipe'), W / 2, by + 15, s1, P.ink, 'center', 600);
      var s2 = E.ui.fit(ctx, T('tut_goal'), bw - 24, 12, 400);
      E.ui.text(ctx, T('tut_goal'), W / 2, by + 32, s2, P.inkSoft, 'center', 400);
      ctx.globalAlpha = 1;
    },

    drawOver: function (ctx) {
      var card = this.overCard;
      if (!card) return;
      var v = this.game.view;
      ctx.fillStyle = P.shade;
      ctx.fillRect(0, 0, v.w, v.h);
      A.card(ctx, card.x, card.y, card.w, card.h, 16);
      // заголовок
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      var ts = E.ui.fit(ctx, this.overTitle, card.w - 40, 24, 800);
      ctx.font = '800 ' + ts + 'px Georgia, "Times New Roman", serif';
      ctx.fillText(this.overTitle, card.x + card.w / 2, card.y + 26);
      if (this.mode === 'win') {
        var bx0 = card.x + card.w - 34, by0 = card.y + 30;
        ctx.fillStyle = P.accent2;
        ctx.globalAlpha = 0.14;
        ctx.beginPath(); ctx.arc(bx0, by0, 16, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = P.accent2;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx0, by0, 16, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx0 - 7, by0 + 1);
        ctx.lineTo(bx0 - 2, by0 + 6);
        ctx.lineTo(bx0 + 8, by0 - 6);
        ctx.stroke();
      }
      var ly = card.y + 56;
      for (var i = 0; i < (this.overLines || []).length; i++) {
        var ln = this.overLines[i];
        ctx.font = '600 ' + ln.size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = ln.color;
        ctx.fillText(ln.text, card.x + card.w / 2, ly);
        ly += 21;
      }
      E.ui.drawButtons(ctx, this.endButtons);
      if (this.toast) {
        var w = v.w;
        ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        var tw = Math.min(w * 0.85, ctx.measureText(this.toast.text).width + 22);
        var yy = card.y + card.h - 16;
        ctx.fillStyle = 'rgba(252,246,232,0.96)';
        A.rr(ctx, (w - tw) / 2, yy - 12, tw, 24, 12); ctx.fill();
        ctx.fillStyle = this.toast.color;
        ctx.fillText(this.toast.text, w / 2, yy + 1);
      }
    },

    drawShop: function (ctx) {
      var card = this.shopCard;
      if (!card) return;
      var v = this.game.view;
      ctx.fillStyle = P.shade;
      ctx.fillRect(0, 0, v.w, v.h);
      A.card(ctx, card.x, card.y, card.w, card.h, 16);

      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      ctx.font = '800 22px Georgia, "Times New Roman", serif';
      ctx.fillText(T('shop_title'), card.x + 18, card.y + 26);

      // монеты
      var co = T('shop_coins', { n: Math.round(this.coins) });
      ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = P.inkSoft;
      ctx.fillText(co, card.x + card.w - 18, card.y + 26);

      E.ui.drawButtons(ctx, this.shopBtns);

      // отклик на покупку — над карточкой, чтобы не спорить с кнопками
      if (this.toast) {
        var v2 = this.game.view;
        ctx.font = '700 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        var tw3 = Math.min(v2.w * 0.8, ctx.measureText(this.toast.text).width + 24);
        var ty3 = Math.max(14, card.y - 20);
        ctx.fillStyle = 'rgba(252,246,232,0.97)';
        A.rr(ctx, (v2.w - tw3) / 2, ty3 - 13, tw3, 26, 13); ctx.fill();
        ctx.strokeStyle = this.toast.color; ctx.lineWidth = 1.2;
        A.rr(ctx, (v2.w - tw3) / 2, ty3 - 13, tw3, 26, 13); ctx.stroke();
        ctx.fillStyle = this.toast.color;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.toast.text, v2.w / 2, ty3 + 1);
      }
    }
  };

  G.scenes = { menu: menu, play: play };
})(window.GAME);
