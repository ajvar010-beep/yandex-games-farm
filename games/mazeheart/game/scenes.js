/* game/scenes.js — сцены «Сердца Лабиринта»: меню и лабиринт.
   Вся механика — в game/logic.js; здесь ввод, экономика, реклама, отрисовка и оверлеи. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};

  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }

  /* ---------------- мета / сохранения ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.economy.startCoins; E.storage.set('coins', c); }
      return c | 0;
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    level: function () { return clamp((E.storage.get('lvl', 1) | 0) || 1, 1, C.finalLevel); },
    setLevel: function (n) { E.storage.set('lvl', clamp(n | 0, 1, C.finalLevel)); },
    best: function () { return clamp(E.storage.get('best', 0) | 0, 0, C.finalLevel); },
    setBest: function (n) { E.storage.set('best', clamp(n | 0, 0, C.finalLevel)); },
    clears: function () { return Math.max(0, E.storage.get('clears', 0) | 0); },
    setClears: function (n) { E.storage.set('clears', Math.max(0, n | 0)); },
    upg: function () {
      var u = E.storage.get('upg', null);
      u = (u && typeof u === 'object' && !Array.isArray(u)) ? u : {};
      var out = {};
      for (var i = 0; i < C.shop.length; i++) {
        var id = C.shop[i].id;
        out[id] = clamp(u[id] | 0, 0, C.shop[i].max);
      }
      return out;
    },
    upgLvl: function (id) { return Meta.upg()[id] | 0; },
    saveUpg: function (u) { E.storage.set('upg', u); },
    cost: function (item, lvl) { return item.base + item.step * lvl; }
  };

  /* ---------------- мелкая графика ---------------- */
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function coinsBadge(ctx, x, y, val) {
    var h = 30, w = 88;
    pill(ctx, x, y, w, h, 'rgba(8,14,11,0.66)', 'rgba(243,210,100,0.35)');
    A.coin(ctx, x + 16, y + h / 2, 9);
    E.ui.text(ctx, String(val), x + 30, y + h / 2 + 1, 15, P.gold, 'left', 700);
  }

  function soundButton(x, y, w, h) {
    return new E.ui.Button({
      x: x, y: y, w: w, h: h, bg: 'rgba(8,14,11,0.66)', border: 'rgba(243,210,100,0.35)',
      icon: function (ctx, b) {
        var m = E.audio.isMuted();
        E.ui.text(ctx, m ? '♪̸' : '♪', b.x + b.w / 2, b.y + b.h / 2 + 1, 18, m ? P.dim : P.gold, 'center', 700);
      },
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
  }

  function langButton(x, y, w, h, onChanged) {
    return new E.ui.Button({
      x: x, y: y, w: w, h: h, bg: 'rgba(8,14,11,0.66)', border: 'rgba(243,210,100,0.35)',
      text: E.i18n.lang === 'ru' ? 'EN' : 'RU', fontSize: 15, fg: P.cream,
      onTap: function () {
        var nl = E.i18n.lang === 'ru' ? 'en' : 'ru';
        E.i18n.setLang(nl);
        E.storage.set('lang', nl);
        E.audio.sfx('click');
        if (onChanged) onChanged();
      }
    });
  }

  function heart(ctx, x, y, s, filled, col) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.62);
    ctx.bezierCurveTo(x - s * 1.15, y - s * 0.25, x - s * 0.55, y - s * 1.02, x, y - s * 0.32);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.02, x + s * 1.15, y - s * 0.25, x, y + s * 0.62);
    ctx.closePath();
    if (filled) { ctx.fillStyle = col; ctx.fill(); }
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = filled ? col : 'rgba(200,222,210,0.30)';
    ctx.stroke();
    ctx.restore();
  }

  function shieldGlyph(ctx, x, y, s, col) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.8, y - s * 0.55);
    ctx.lineTo(x + s * 0.8, y + s * 0.15);
    ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.85, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.7, y + s * 0.85, x - s * 0.8, y + s * 0.15);
    ctx.lineTo(x - s * 0.8, y - s * 0.55);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  }

  function wrapLines(ctx, text, maxW, size, maxLines, weight) {
    ctx.font = (weight || 500) + ' ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    var words = String(text).split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (cur && ctx.measureText(test).width > maxW) {
        lines.push(cur);
        cur = words[i];
        if (lines.length >= maxLines - 1) {
          for (var j = i + 1; j < words.length; j++) cur += ' ' + words[j];
          break;
        }
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  /* каменная панель для оверлеев */
  function panelBg(ctx, r, accent) {
    var g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, '#1d2d25');
    g.addColorStop(0.55, '#14211b');
    g.addColorStop(1, '#0b1310');
    E.ui.roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent || 'rgba(243,210,100,0.50)';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(140,168,148,0.18)';
    E.ui.roundRect(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 12);
    ctx.stroke();
  }

  /* ---------------- МЕНЮ ---------------- */
  S.menu = {
    name: 'menu',
    consumesInputInUpdate: true,

    enter: function (game) {
      this.game = game;
      this.t = 0;
      this.buttons = [];
      this.levelSel = !!(E.capture && E.capture.active && E.capture.params && E.capture.params.levels);
      E.fx.reset();
      E.audio.music('menu');
      E.sdk.showBanner();
      E.sdk.gameplayStop();
      this.build(game);
    },
    exit: function () {},
    onResize: function (game) { this.build(game); },

    menuLayout: function (v) {
      var W = v.w, H = v.h;
      var compact = H < 560;
      var portrait = H > W * 1.06;
      var medR = compact ? 0 : clamp(Math.min(portrait ? W * 0.24 : W * 0.13, H * 0.10, portrait ? 78 : 64), 22, 80);
      var titleSize = clamp(Math.min(W * 0.105, H * 0.052), 22, 44);
      var subSize = clamp(titleSize * 0.40, 13, 19);
      var bh = clamp(H * 0.072, 44, 56);
      var bw = Math.min(330, W * 0.78);
      var headerH = (medR ? medR * 2 + 10 : 0) + titleSize * 1.15 + subSize * 2.0;
      var shopH = Math.round(bh * 0.86);
      var btnsH = bh + 12 + shopH;
      var footerH = 48;
      var gap1 = compact ? 12 : 26;
      var gap2 = compact ? 12 : 24;
      var total = headerH + gap1 + btnsH + gap2 + footerH;
      var y = Math.max(10, (H - total) * 0.42);
      var medY = medR ? y + medR : 0;
      if (medR) y = medY + medR + 10;
      var titleY = y + titleSize * 0.5;
      y = titleY + titleSize * 0.62;
      var subY = y + subSize * 0.5;
      y = subY + subSize * 0.9 + gap1;
      var playY = y;
      var shopY = y + bh + 12;
      y = shopY + shopH + gap2;
      var progY = y;
      var bestY = progY + 20;
      return { compact: compact, medR: medR, medY: medY, titleSize: titleSize, titleY: titleY,
        subSize: subSize, subY: subY, bw: bw, bh: bh, shopH: shopH, playY: playY, shopY: shopY,
        progY: progY, bestY: bestY };
    },

    build: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var M = this.menuLayout(v);
      var that = this;
      var list = [];
      if (this.levelSel) { this.buildLevels(game); return; }
      list.push(new E.ui.Button({
        x: W / 2 - M.bw / 2, y: M.playY, w: M.bw, h: M.bh, text: T('play'),
        bg: '#1f4a36', border: P.gold, fg: P.cream, fontSize: Math.round(M.bh * 0.36),
        onTap: function () {
          E.audio.sfx('click');
          game.setScene('play', { level: Meta.level() });
        }
      }));
      list.push(new E.ui.Button({
        x: W / 2 - M.bw / 2, y: M.shopY, w: M.bw, h: M.shopH, text: T('shop'),
        bg: 'rgba(16,28,22,0.82)', border: 'rgba(243,210,100,0.45)', fg: P.cream,
        fontSize: Math.round(M.bh * 0.30),
        onTap: function () {
          E.audio.sfx('click');
          game.setScene('play', { level: Meta.level(), shop: true });
        }
      }));
      list.push(new E.ui.Button({
        x: W / 2 - 70, y: H - 58 - (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0), w: 140, h: 40,
        text: T('levels'), bg: 'rgba(16,28,22,0.82)', border: 'rgba(243,210,100,0.35)', fg: P.cream,
        fontSize: 15,
        onTap: function () { E.audio.sfx('click'); that.levelSel = true; that.build(game); }
      }));
      list.push(soundButton(W - 54, 12, 42, 40));
      list.push(langButton(W - 102, 12, 42, 40, function () { that.build(game); }));
      this.buttons = list;
      this.M = M;
    },

    buildLevels: function (game) {
      var v = game.view, W = v.w, H = v.h, self = this;
      var M = this.menuLayout(v);
      var cols = W > H * 1.2 ? 6 : 4;
      var rows = Math.ceil(C.finalLevel / cols);
      var bottom = H - 74 - (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var gap = 8;
      var tw = Math.min(96, (Math.min(W, 560) - 40 - (cols - 1) * gap) / cols);
      var availH = bottom - 70;
      var th = Math.min(92, Math.max(52, (availH - (rows - 1) * gap) / rows));
      var blockH = rows * th + (rows - 1) * gap;
      var top = Math.max(70, (bottom + 70 - blockH) / 2);
      var x0 = (W - (cols * tw + (cols - 1) * gap)) / 2;
      var list = [];
      this.levelRects = [];
      for (var i = 0; i < C.finalLevel; i++) {
        (function (n) {
          var c = i % cols, r = Math.floor(i / cols);
          var x = x0 + c * (tw + gap), y = top + r * (th + gap);
          self.levelRects.push({ x: x, y: y, w: tw, h: th, n: n });
          list.push(new E.ui.Button({
            x: x, y: y, w: tw, h: th, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            icon: function (ctx, b) { self._drawLevelTile(ctx, b, n); },
            onTap: function () {
              if (n > Meta.level()) { E.audio.sfx('deny'); return; }
              E.audio.sfx('click');
              game.setScene('play', { level: n });
            }
          }));
        })(i + 1);
      }
      list.push(new E.ui.Button({
        x: W / 2 - 70, y: H - 58 - (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0), w: 140, h: 40,
        text: T('back'), bg: 'rgba(16,28,22,0.86)', border: 'rgba(243,210,100,0.35)', fg: P.cream,
        fontSize: 15,
        onTap: function () { E.audio.sfx('click'); self.levelSel = false; self.build(game); }
      }));
      this.buttons = list;
      this.M = M;
    },
    _drawLevelTile: function (ctx, b, n) {
      var locked = n > Meta.level();
      var done = n <= Meta.best();
      var cur = n === Meta.level();
      E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 12);
      ctx.fillStyle = locked ? 'rgba(16,28,22,0.9)' : (done ? 'rgba(31,74,54,0.95)' : 'rgba(24,40,32,0.92)');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = locked ? 'rgba(120,140,125,0.25)' : (cur ? P.gold : 'rgba(243,210,100,0.35)');
      ctx.stroke();
      E.ui.text(ctx, String(n), b.x + b.w / 2, b.y + b.h * 0.44, Math.min(b.h * 0.42, b.w * 0.5),
        locked ? 'rgba(160,180,165,0.4)' : P.cream, 'center', 800);
      if (locked) {
        ctx.strokeStyle = 'rgba(160,180,165,0.45)'; ctx.lineWidth = 2;
        ctx.strokeRect(b.x + b.w * 0.38, b.y + b.h * 0.64, b.w * 0.24, b.h * 0.17);
        ctx.beginPath(); ctx.arc(b.x + b.w * 0.5, b.y + b.h * 0.64, b.w * 0.09, Math.PI, 0); ctx.stroke();
      } else if (done) {
        E.ui.text(ctx, '★', b.x + b.w * 0.5, b.y + b.h * 0.80, Math.min(14, b.w * 0.2), P.gold, 'center', 700);
      }
    },
    update: function (game, dt) {
      this.t += dt;
      var Ptr = E.input.pointer;
      if (Ptr.pressed) E.ui.handleTap(this.buttons, Ptr.x, Ptr.y);
      if (!this.levelSel && (E.input.wasPressed('Enter') || E.input.wasPressed('Space'))) {
        game.setScene('play', { level: Meta.level() });
      }
    },

    draw: function (game, ctx) {
      var W = game.view.w, H = game.view.h, t = this.t;
      var g = ctx.createLinearGradient(0, 0, W * 0.4, H);
      g.addColorStop(0, '#16251e');
      g.addColorStop(0.5, '#0f1a15');
      g.addColorStop(1, '#070c0a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      A.fog(ctx, W, H, t, 3, 0.05);
      if (this.levelSel) {
        ctx.fillStyle = 'rgba(6,12,9,0.9)'; ctx.fillRect(0, 0, W, H);
        E.ui.text(ctx, T('levels'), W / 2, Math.max(34, H * 0.075), Math.min(W * 0.08, 30), P.gold, 'center', 800);
        E.ui.drawButtons(ctx, this.buttons);
        coinsBadge(ctx, 10, 12, Meta.coins());
        return;
      }

      var M = this.M || this.menuLayout(game.view);
      /* медальон */
      if (M.medR > 0) {
        var cx = W / 2, cy = M.medY, R = M.medR;
        ctx.save();
        ctx.lineWidth = Math.max(6, R * 0.20);
        ctx.strokeStyle = '#3c5146';
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#0a100d';
        for (var s = 0; s < 6; s++) {
          var a0 = s * 1.047 + 0.24 + t * 0.06;
          ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + 0.44); ctx.stroke();
        }
        ctx.lineWidth = Math.max(1, R * 0.05);
        ctx.strokeStyle = 'rgba(160,190,170,0.30)';
        ctx.beginPath(); ctx.arc(cx, cy, R - R * 0.12, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        A.light(ctx, cx, cy, R * 1.5, 0.20);
        ctx.restore();
        A.orb(ctx, cx, cy, R * 0.30, t, false);
        for (var k = 0; k < 3; k++) {
          var ka = -Math.PI / 2 + k * 2.094 + t * 0.30;
          A.key(ctx, cx + Math.cos(ka) * R * 1.42, cy + Math.sin(ka) * R * 1.42, R * 0.20, t + k, false);
        }
      }

      /* заголовок */
      ctx.save();
      var ts = M.titleSize;
      ctx.font = '800 ' + Math.round(ts) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      while (ts > 16 && ctx.measureText(T('title')).width > W * 0.92) {
        ts -= 1;
        ctx.font = '800 ' + Math.round(ts) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(143,232,255,0.35)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = P.cream;
      ctx.fillText(T('title'), W / 2, M.titleY);
      ctx.shadowBlur = 0;
      ctx.fillStyle = P.key;
      ctx.font = '600 ' + Math.round(M.subSize) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(T('subtitle'), W / 2, M.subY);
      ctx.restore();

      /* факелы по краям */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      A.light(ctx, W * 0.09, M.titleY, Math.min(W, H) * 0.22, 0.16);
      A.light(ctx, W * 0.91, M.titleY, Math.min(W, H) * 0.22, 0.16);
      ctx.restore();
      A.flame(ctx, W * 0.09, M.titleY, Math.max(4, Math.min(W, H) * 0.018), t, 0.4);
      A.flame(ctx, W * 0.91, M.titleY, Math.max(4, Math.min(W, H) * 0.018), t, 2.1);

      E.ui.drawButtons(ctx, this.buttons);

      /* прогресс и рекорд */
      var lvl = Meta.level(), best = Meta.best();
      E.ui.text(ctx, T('level_of', { n: lvl, total: C.finalLevel }), W / 2, M.progY, 13, P.dim, 'center', 600);
      var dots = C.finalLevel, gap = Math.min(18, (W - 60) / dots), dx = W / 2 - (dots - 1) * gap / 2;
      for (var i = 0; i < dots; i++) {
        var done = i < best;
        ctx.beginPath();
        ctx.arc(dx + i * gap, M.progY + 15, done ? 4.2 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = done ? P.key : 'rgba(140,168,148,0.30)';
        ctx.fill();
      }
      if (best > 0 && M.bestY < game.view.h - 12) {
        E.ui.text(ctx, T('best_n', { n: best }), W / 2, M.bestY + 14, 13, P.key, 'center', 600);
      }

      coinsBadge(ctx, 10, 12, Meta.coins());
      A.vignette(ctx, W, H, 0.42);
    },

    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ---------------- ЛАБИРИНТ ---------------- */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.captureMode = !!(E.capture && E.capture.active);
      // стартовая метка рекламы: кулдаун 60 с считается от входа в игру
      if (!E.sdk._lastInterstitial) E.sdk._lastInterstitial = Date.now();
      this.autopilot = !!(E.capture.autoplay || (E.capture.record > 0));
      this.seedBase = (E.capture.seed != null) ? E.capture.seed : 31;
      this.mode = 'running';
      this.panel = '';
      this.t = 0;
      this.drag = null;
      this.cd = 0;
      this.autoT = 0;
      this.toast = null;
      this.doubled = false;
      this.reviveUsed = false;
      this.won = false;
      this.reward = 0;
      this.endButtons = [];
      this.shopButtons = [];
      this.backBtn = null;
      this.pauseBtn = null;
      this.hudButtons = [];
      this.shopFromMenu = !!params.shop;
      this.shopReturn = 'running';
      E.fx.reset();
      this.fxRng = new E.Rng((this.seedBase >>> 0) ^ 0x5bf03635);
      var lvl = params.level != null ? params.level : (cp.wave != null ? cp.wave : Meta.level());
      this.coinsVal = (this.captureMode && cp.coins != null)
        ? Math.max(0, parseInt(cp.coins, 10) || 0) : Meta.coins();
      this.startLevel(game, lvl, 0);
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this.layout(game);
      this.buildEnd(game);
      this.buildShop(game);
      if (this.captureMode) this.applyCapture(game);
      if (params.shop) this.openShop(game, true);
    },
    exit: function () {
      if (!this.captureMode) Meta.setCoins(this.coinsVal);
      E.sdk.gameplayStop();
    },
    onResize: function (game) {
      this.layout(game);
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.buildEnd(game);
      if (this.mode === 'shop') this.buildShop(game);
    },
    onBack: function (game) {
      if (this.mode === 'running') this.setPaused(true, game);
      else if (this.mode === 'shop') this.closeShop(game);
    },

    startLevel: function (game, level, bump) {
      var upg = Meta.upg();
      var seed = ((this.seedBase | 0) + level * 7919 + bump * 104729) >>> 0;
      var st = L.newLevel({ level: level, seed: seed });
      st.maxLives = C.baseLives + (upg.life | 0);
      st.lives = st.maxLives;
      st.shields = upg.shield | 0;
      st.recordSafe = this.autopilot || this.captureMode;
      this.st = st;
      this.level = st.level;
      this.cd = 0;
      this.autoT = 0;
      this.mode = 'running';
      this.panel = '';
      this.drag = null;
      this.toast = null;
      this.doubled = false;
      this.reviveUsed = false;
      this.won = false;
      this.result = null;
      this.revealT = upg.map > 0 ? (C.mapSeconds[clamp(upg.map, 1, 3) - 1] || 0) : 0;
      if (this.level === 1 && !this.captureMode && !this.autopilot) this.toastMsg(T('howto_drag'), 2.6);
      if (!this.baked || this.bakedSeed !== seed) {
        this.baked = null;
        this.bakedSeed = seed;
      }
      this.layout(game);
    },

    addCoins: function (n) {
      this.coinsVal = Math.max(0, Math.round(this.coinsVal + n));
      if (!this.captureMode) Meta.setCoins(this.coinsVal);
    },
    toastMsg: function (text, sec) { this.toast = { text: text, t: sec == null ? 1.6 : sec, max: sec == null ? 1.6 : sec }; },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
      var availH = Math.max(120, H - banner);
      var portrait = H > W * 1.06;
      var hudH = portrait ? clamp(H * 0.072, 46, 60) : clamp(availH * 0.14, 38, 52);
      var padX = clamp(W * 0.022, 8, 16);
      var padTop = hudH + 8;
      var padBot = clamp(availH * 0.075, 38, 54);
      var areaW = Math.max(40, W - padX * 2);
      var areaH = Math.max(40, availH - padTop - padBot);
      var cols = this.st.w, rows = this.st.h;
      var cs = Math.floor(Math.min(areaW / cols, areaH / rows));
      if (!isFinite(cs) || cs < 8) cs = 8;
      var bw = cs * cols, bh = cs * rows;
      this.W = W; this.H = H; this.hudH = hudH; this.availH = availH;
      this.padTop = padTop; this.padBot = padBot;
      this.cs = cs;
      this.bx = Math.round((W - bw) / 2);
      this.by = Math.round(padTop + Math.max(0, (areaH - bh) / 2));
      this.boardW = bw;
      this.boardH = bh;
      if (!this.baked || this.bakedCs !== cs) {
        this.baked = A.bakeMaze(this.st.m, cs, this.bakedSeed || 1);
        this.bakedCs = cs;
      }
      var ps = Math.min(44, Math.max(36, hudH - 8));
      this.pauseBtn = new E.ui.Button({
        x: W - 8 - ps, y: Math.round((hudH - ps) / 2), w: ps, h: ps,
        bg: 'rgba(8,14,11,0.66)', border: 'rgba(243,210,100,0.35)',
        icon: function (ctx, b) {
          var cx = b.x + b.w / 2, cy = b.y + b.h / 2, u = b.w * 0.14;
          ctx.fillStyle = P.cream;
          E.ui.roundRect(ctx, cx - u * 1.6, cy - u * 1.7, u * 1.1, u * 3.4, u * 0.4); ctx.fill();
          E.ui.roundRect(ctx, cx + u * 0.5, cy - u * 1.7, u * 1.1, u * 3.4, u * 0.4); ctx.fill();
        },
        onTap: function () { this.setPaused(true, this.game); }.bind(this)
      });
      this.hudButtons = [this.pauseBtn];
      this.hudPos = {
        pause: { x: this.pauseBtn.x, y: this.pauseBtn.y, h: ps },
        coinsX: W - 8 - ps - 10 - 88,
        coinsY: Math.round((hudH - 30) / 2)
      };
    },

    /* ---------- кнопки оверлеев ---------- */
    buildEnd: function (game) {
      var W = this.W || game.view.w;
      var H = this.availH || game.view.h;
      var self = this;
      var defs = [];
      if (this.mode === 'paused') {
        defs.push({ text: T('resume'), bg: '#1f4a36', border: P.exit, fg: P.cream,
          fn: function () { E.audio.sfx('click'); self.setPaused(false, game); } });
        defs.push({ text: T('restart'), bg: 'rgba(28,38,32,0.95)', border: 'rgba(243,210,100,0.35)', fg: P.cream,
          fn: function () { E.audio.sfx('click'); self.restartLevel(game); } });
        defs.push({ text: T('shop'), bg: 'rgba(28,38,32,0.95)', border: 'rgba(243,210,100,0.35)', fg: P.key,
          fn: function () { E.audio.sfx('click'); self.openShop(game); } });
        defs.push({ text: E.audio.isMuted() ? T('sound_off') : T('sound_on'), bg: 'rgba(20,28,24,0.95)',
          border: 'rgba(243,210,100,0.22)', fg: P.dim,
          fn: function (b) {
            var m = !E.audio.isMuted();
            E.audio.setMuted(m); E.storage.set('muted', m); E.audio.sfx('click');
            b.text = m ? T('sound_off') : T('sound_on');
          } });
        defs.push({ text: T('to_menu'), bg: 'rgba(20,28,24,0.95)', border: 'rgba(243,210,100,0.22)', fg: P.cream,
          fn: function () { E.audio.sfx('click'); Meta.setCoins(self.coinsVal); game.setScene('menu', {}); } });
      } else if (this.mode === 'win') {
        var last = this.level >= C.finalLevel;
        defs.push({ text: last ? T('to_menu') : T('next_level'), bg: '#1f4a36', border: P.exit, fg: P.cream,
          fn: function () {
            E.audio.sfx('click');
            if (last) { Meta.setCoins(self.coinsVal); game.setScene('menu', {}); }
            else self.goNext(game);
          } });
        if (!this.captureMode && !this.doubled) {
          defs.push({ text: T('double'), bg: 'rgba(36,44,32,0.95)', border: P.gold, fg: P.key,
            rv: true,
            fn: function () {
              E.sdk.showRewarded({
                onReward: function () {
                  self.doubled = true;
                  self.addCoins(self.reward);
                  E.audio.sfx('coin');
                  self.buildEnd(game);
                },
                onDone: function (ok) { if (!ok) self.toastMsg(T('ad_fail')); }
              });
            } });
        }
        defs.push({ text: T('to_menu'), bg: 'rgba(20,28,24,0.95)', border: 'rgba(243,210,100,0.22)', fg: P.cream,
          fn: function () { E.audio.sfx('click'); Meta.setCoins(self.coinsVal); game.setScene('menu', {}); } });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.reviveUsed) {
          defs.push({ text: T('second_chance'), bg: 'rgba(52,38,24,0.95)', border: P.gold, fg: P.key,
            rv: true,
            fn: function () { self.tryRevive(game); } });
        }
        defs.push({ text: T('retry'), bg: '#1f4a36', border: P.exit, fg: P.cream,
          fn: function () { E.audio.sfx('click'); self.restartLevel(game); } });
        defs.push({ text: T('to_menu'), bg: 'rgba(20,28,24,0.95)', border: 'rgba(243,210,100,0.22)', fg: P.cream,
          fn: function () { E.audio.sfx('click'); Meta.setCoins(self.coinsVal); game.setScene('menu', {}); } });
      }

      if (!defs.length) { this.endButtons = []; return; }
      var n = defs.length;
      var pw = Math.min(W - 24, 360);
      var ph = Math.min(H - 20, 250 + n * 54);
      var px = (W - pw) / 2, py = (H - ph) / 2;
      this.panelRect = { x: px, y: py, w: pw, h: ph };
      var bw = pw - 44;
      var bh = Math.max(44, Math.min(50, (ph - 150) / n - 8));
      var gap = 8;
      var bx = W / 2 - bw / 2;
      var by = py + ph - 16 - (n * bh + (n - 1) * gap);
      var list = [];
      for (var i = 0; i < n; i++) {
        var d = defs[i];
        list.push(new E.ui.Button({
          x: bx, y: by + i * (bh + gap), w: bw, h: bh,
          text: d.text, bg: d.bg, border: d.border, fg: d.fg,
          fontSize: Math.max(14, Math.min(19, Math.round(bh * 0.38))),
          onTap: d.fn
        }));
      }
      this.endButtons = list;
    },

    buildShop: function (game) {
      var W = this.W || game.view.w, H = this.availH || game.view.h;
      var self = this;
      var pw = Math.min(W - 20, 400);
      var rowH = clamp((H - 190) / 3, 52, 76);
      var ph = Math.min(H - 16, 104 + rowH * 3 + 58);
      var px = (W - pw) / 2, py = Math.max(8, (H - ph) / 2);
      this.shopRect = { x: px, y: py, w: pw, h: ph, rowH: rowH };
      var list = [];
      for (var i = 0; i < C.shop.length; i++) {
        (function (idx) {
          list.push(new E.ui.Button({
            x: px + 12, y: py + 54 + idx * (rowH + 6), w: pw - 24, h: rowH,
            bg: 'rgba(20,31,26,0.94)', border: 'rgba(140,168,148,0.28)',
            icon: function (ctx, b) { self.drawShopRow(ctx, b, idx); },
            onTap: function () { self.buy(game, idx); }
          }));
        })(i);
      }
      this.shopButtons = list;
      this.backBtn = new E.ui.Button({
        x: W / 2 - 80, y: py + ph - 50, w: 160, h: 42, text: T('back'),
        bg: 'rgba(28,38,32,0.95)', border: 'rgba(243,210,100,0.35)', fg: P.cream, fontSize: 16,
        onTap: function () { self.closeShop(game); }
      });
      this.shopButtons.push(this.backBtn);
    },

    drawShopRow: function (ctx, b, idx) {
      var item = C.shop[idx], lvl = Meta.upgLvl(item.id), maxed = lvl >= item.max;
      var price = Meta.cost(item, lvl);
      var pad = 12, i;
      var h = b.h;
      var nameSize = Math.max(14, Math.min(17, Math.round(h * 0.24)));
      var nameY = b.y + Math.min(19, h * 0.30);
      var font = '700 ' + nameSize + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var name = T(item.name);

      ctx.font = font;
      var nameW = ctx.measureText(name).width;
      E.ui.text(ctx, name, b.x + pad, nameY, nameSize, P.cream, 'left', 700);

      /* уровень точками — сразу за названием */
      var dotR = 3.4, dgap = 9, dx = b.x + pad + nameW + 12;
      for (i = 0; i < item.max; i++) {
        ctx.beginPath();
        ctx.arc(dx + i * dgap, nameY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = i < lvl ? P.key : 'rgba(140,168,148,0.30)';
        ctx.fill();
      }

      /* цена справа */
      if (maxed) {
        E.ui.text(ctx, T('maxed'), b.x + b.w - pad, nameY, 13, P.dim, 'right', 700);
      } else {
        var priceStr = String(price);
        ctx.font = '700 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        var priceW = ctx.measureText(priceStr).width;
        E.ui.text(ctx, priceStr, b.x + b.w - pad, nameY, 14,
          this.coinsVal >= price ? P.gold : P.danger, 'right', 700);
        A.coin(ctx, b.x + b.w - pad - priceW - 11, nameY, 7.2);
      }

      /* описание — две строки внизу */
      var lines = wrapLines(ctx, T(item.desc), b.w - pad * 2, 12, 2, 500);
      var ly = b.y + h - 9 - (lines.length - 1) * 14;
      for (i = 0; i < lines.length; i++) {
        E.ui.text(ctx, lines[i], b.x + pad, ly + i * 14, 12, P.dim, 'left', 500);
      }
    },

    buy: function (game, idx) {
      var item = C.shop[idx], lvl = Meta.upgLvl(item.id);
      if (lvl >= item.max) { this.toastMsg(T('maxed')); E.audio.sfx('deny'); return; }
      var price = Meta.cost(item, lvl);
      if (this.coinsVal < price) { this.toastMsg(T('not_enough')); E.audio.sfx('deny'); return; }
      if (this.captureMode) { E.audio.sfx('buy'); return; }
      var u = Meta.upg();
      u[item.id] = lvl + 1;
      Meta.saveUpg(u);
      this.addCoins(-price);
      /* покупка сразу применяется к текущему лабиринту */
      if (item.id === 'life') { this.st.maxLives++; this.st.lives++; }
      else if (item.id === 'shield') { this.st.shields = u.shield; }
      else if (item.id === 'map') { this.revealT = C.mapSeconds[clamp(u.map, 1, 3) - 1] || 0; }
      E.audio.sfx('buy');
      this.buildShop(game);
    },

    /* ---------- режимы ---------- */
    setPaused: function (on, game) {
      game = game || this.game;
      if (on && this.mode === 'running') {
        this.mode = 'paused';
        this.panel = 'pause';
        E.sdk.gameplayStop();
        this.buildEnd(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = 'running';
        this.panel = '';
        this.toast = null;
        if (E.sdk.gameplayStart) E.sdk.gameplayStart();
        this.buildEnd(game);
      }
    },
    openShop: function (game, fromMenu) {
      game = game || this.game;
      if (this.mode === 'shop') return;
      if (fromMenu) { this.shopFromMenu = true; this.shopReturn = 'menu'; }
      else if (this.mode === 'paused') { this.shopFromMenu = false; this.shopReturn = 'paused'; }
      else { this.shopFromMenu = false; this.shopReturn = 'running'; }
      this.mode = 'shop';
      this.panel = 'shop';
      E.sdk.gameplayStop();
      this.buildShop(game);
    },
    closeShop: function (game) {
      game = game || this.game;
      if (this.shopFromMenu) {
        E.audio.sfx('click');
        if (!this.captureMode) Meta.setCoins(this.coinsVal);
        game.setScene('menu', {});
        return;
      }
      E.audio.sfx('click');
      if (this.shopReturn === 'paused') {
        this.mode = 'paused';
        this.panel = 'pause';
        this.buildEnd(game);
        return;
      }
      this.mode = 'running';
      this.panel = '';
      if (E.sdk.gameplayStart) E.sdk.gameplayStart();
    },
    restartLevel: function (game) {
      game = game || this.game;
      game.setScene('play', { level: this.level });
    },
    goNext: function (game) {
      var next = Math.min(C.finalLevel, this.level + 1);
      var proceed = function () { game.setScene('play', { level: next }); };
      var clears = Meta.clears();
      if (!this.captureMode && clears > 0 && clears % C.ads.interstitialEvery === 0) {
        E.sdk.showInterstitial(function () { proceed(); });
      } else proceed();
    },
    tryRevive: function (game) {
      var self = this;
      E.sdk.showRewarded({
        onReward: function () {
          self.reviveUsed = true;
          self.st.phase = 'run';
          self.st.lives = Math.max(1, Math.ceil(self.st.maxLives / 2));
          self.st.ball.from = self.st.reviveAt;
          self.st.ball.cell = self.st.reviveAt;
          self.st.ball.k = 1;
          self.st.inv = 2.5;
          self.st.stun = 1.2;
          self.st.events.length = 0;
          self.mode = 'running';
          self.panel = '';
          self.doubled = false;
          E.audio.sfx('revive');
          E.sdk.gameplayStart();
          self.buildEnd(game);
        },
        onDone: function (ok) { if (!ok) self.toastMsg(T('ad_fail')); }
      });
    },

    onWin: function (game) {
      if (this.won) return;
      this.won = true;
      this.mode = 'win';
      this.panel = 'win';
      this.reward = C.economy.winBase + this.level * C.economy.perLevel + this.st.keysTaken * C.economy.perKey;
      if (!this.captureMode) {
        this.addCoins(this.reward);
        Meta.setBest(Math.max(Meta.best(), this.level));
        Meta.setLevel(Math.max(Meta.level(), Math.min(C.finalLevel, this.level + 1)));
        Meta.setClears(Meta.clears() + 1);
      }
      E.audio.sfx('win');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },
    onLose: function (game) {
      if (this.mode === 'over') return;
      this.mode = 'over';
      this.panel = 'over';
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },

    /* ---------- ввод ---------- */
    inBoard: function (x, y) {
      return x >= this.bx && x <= this.bx + this.boardW && y >= this.by && y <= this.by + this.boardH;
    },
    tryMove: function (d) {
      if (this.mode !== 'running' || this.cd > 0) return false;
      var ok = L.move(this.st, d);
      this.cd = C.stepCd;
      if (ok) E.audio.sfx('tick');
      return ok;
    },
    handleMoveInput: function (game) {
      var Ptr = E.input.pointer;
      if (this.autopilot) { this.drag = null; return; }
      if (Ptr.pressed) {
        if (this.pauseBtn && this.pauseBtn.contains(Ptr.x, Ptr.y)) { this.pauseBtn.tap(); return; }
        if (this.inBoard(Ptr.x, Ptr.y)) this.drag = { x: Ptr.x, y: Ptr.y, moved: false };
      }
      if (this.drag && Ptr.down) {
        var dx = Ptr.x - this.drag.x, dy = Ptr.y - this.drag.y;
        var th = Math.max(16, this.cs * 0.46);
        if (Math.abs(dx) > th || Math.abs(dy) > th) {
          var d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
          this.tryMove(d);
          this.drag.moved = true;
          this.drag.x = Ptr.x;
          this.drag.y = Ptr.y;
        }
      }
      // тап по соседней клетке — на телефоне это первое, что пробует игрок
      if (this.drag && Ptr.released && !this.drag.moved) {
        var m = this.st.m;
        var tc = Math.floor((Ptr.x - this.bx) / this.cs), tr = Math.floor((Ptr.y - this.by) / this.cs);
        if (tc >= 0 && tc < m.w && tr >= 0 && tr < m.h) {
          var cur0 = L.cellXY(m, this.st.ball.cell), dc0 = tc - cur0.x, dr0 = tr - cur0.y;
          if (Math.abs(dc0) + Math.abs(dr0) === 1) {
            this.tryMove(dc0 === 1 ? 1 : (dc0 === -1 ? 3 : (dr0 === 1 ? 2 : 0)));
          }
        }
      }
      if (!Ptr.down) this.drag = null;
      var keys = [['ArrowUp', 0], ['KeyW', 0], ['ArrowRight', 1], ['KeyD', 1],
        ['ArrowDown', 2], ['KeyS', 2], ['ArrowLeft', 3], ['KeyA', 3]];
      for (var i = 0; i < keys.length; i++) {
        if (E.input.wasPressed(keys[i][0])) { this.tryMove(keys[i][1]); break; }
      }
    },
    autoTick: function (dt) {
      this.autoT += dt;
      if (this.autoT < 0.10) return;
      this.autoT = 0;
      if (this.cd > 0) return;
      var d = L.autoStep(this.st);
      if (d >= 0) { L.move(this.st, d); this.cd = C.autoCd; }
    },

    processEvents: function (game) {
      var evs = this.st.events;
      if (!evs || !evs.length) return;
      this.st.events = [];
      for (var i = 0; i < evs.length; i++) {
        var ev = evs[i];
        if (ev.t === 'key') {
          E.audio.sfx('coin');
          this.burst(ev.cell, P.key, 12);
          this.toastMsg(T('key_get', { n: ev.n, total: this.st.keys.length }), 1.8);
        } else if (ev.t === 'caught') {
          E.audio.sfx('hit');
          E.audio.sfx('core');
          E.fx.shake(Math.min(14, this.cs * 0.25), 0.35);
          this.burst(ev.cell != null ? ev.cell : this.st.ball.cell, P.danger, 16);
          this.toastMsg(T('caught'), 1.6);
        } else if (ev.t === 'shield') {
          E.audio.sfx('pulse');
          E.fx.flash(P.exit, 0.12);
          this.burst(this.st.ball.cell, P.exit, 16);
          this.toastMsg(T('shield_saved'), 1.5);
        } else if (ev.t === 'over') {
          this.onLose(game);
          return;
        } else if (ev.t === 'win') {
          this.onWin(game);
          return;
        } else if (ev.t === 'bump') {
          E.audio.sfx('tick');
        }
      }
    },
    burst: function (cell, color, n) {
      var p = L.cellCenter(this.st.m, cell);
      E.fx.burst(this.bx + p.x * this.cs, this.by + p.y * this.cs, color, n, this.cs * 3.0, this.fxRng);
    },

    update: function (game, dt) {
      this.game = game;
      this.t += dt;
      var Ptr = E.input.pointer;
      var i;

      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'paused') { this.setPaused(false, game); return; }
        if (this.mode === 'shop') { this.closeShop(game); return; }
        if (this.mode === 'running') { this.setPaused(true, game); return; }
      }

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (Ptr.pressed) E.ui.handleTap(this.endButtons, Ptr.x, Ptr.y);
        if (this.mode === 'win' && (this.autopilot || this.captureMode)) {
          this.autoT += dt;
          if (this.autoT > 1.3) {
            this.autoT = 0;
            if (this.level >= C.finalLevel) this.restartLevel(game);
            else game.setScene('play', { level: Math.min(C.finalLevel, this.level + 1) });
          }
        }
        return;
      }

      if (this.mode === 'shop') {
        if (Ptr.pressed) E.ui.handleTap(this.shopButtons, Ptr.x, Ptr.y);
        return;
      }

      if (this.toast) {
        this.toast.t -= dt;
        if (this.toast.t <= 0) this.toast = null;
      }
      if (this.revealT > 0) this.revealT -= dt;
      if (this.cd > 0) this.cd -= dt;

      this.handleMoveInput(game);
      if (this.autopilot) this.autoTick(dt);
      L.step(this.st, dt);
      this.processEvents(game);
      if (E.capture && E.capture.record > 0 && E.capture.tickRecording) E.capture.tickRecording(dt);
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.st.recordSafe = true;
      var mode = cp.mode;
      if (mode === 'shop') {
        this.openShop(game);
      } else if (mode === 'over') {
        L.simulate(this.st, clamp(parseFloat(cp.t) || 6, 0.5, 20), { keepSafe: true });
        this.st.phase = 'over';
        this.st.lives = 0;
        this.mode = 'over';
        this.panel = 'over';
        this.buildEnd(game);
      } else if (mode === 'win') {
        L.simulate(this.st, clamp(parseFloat(cp.t) || 6, 0.5, 20), { keepSafe: true });
        for (var ki = 0; ki < this.st.keys.length; ki++) this.st.keys[ki].taken = true;
        this.st.keysTaken = this.st.keys.length;
        this.st.ball.cell = this.st.exit;
        this.st.ball.from = this.st.exit;
        this.st.ball.k = 1;
        this.st.phase = 'win';
        this.onWin(game);
      } else {
        var t = clamp(parseFloat(cp.t) || 7, 0.5, 22);
        for (var attempt = 0; attempt < 3; attempt++) {
          L.simulate(this.st, t, { keepSafe: true });
          if (this.st.phase === 'run') break;
          this.startLevel(game, this.level, attempt + 1);
          this.st.recordSafe = true;
          t = t * 0.55;
        }
        if (this.st.phase !== 'run') {
          this.st.phase = 'run';
          this.st.lives = Math.max(1, this.st.lives);
        }
        this.mode = 'running';
        this.panel = '';
      }
      this.layout(game);
      this.buildEnd(game);
      this.buildShop(game);
    },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'over') {
        this.st.phase = 'over'; this.st.lives = 0; this.mode = 'over'; this.panel = 'over'; this.buildEnd(game);
      } else if (s.mode === 'win') {
        this.st.phase = 'win'; this.onWin(game);
      }
      if (s.level) this.level = clamp(s.level | 0, 1, C.finalLevel);
    },
    getCaptureState: function () {
      return {
        scene: 'play',
        mode: this.mode,
        level: this.level || 1,
        keys: this.st ? this.st.keysTaken : 0,
        lives: this.st ? this.st.lives : 0
      };
    },

    /* ---------- отрисовка ---------- */
    drawBackground: function (ctx, W, H) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#14211b');
      g.addColorStop(0.55, '#0b1310');
      g.addColorStop(1, '#060a08');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      A.fog(ctx, W, H, this.t, (this.bakedSeed || 3) >>> 0, 0.030);
      if (W > H * 1.2) {
        /* в ландшафте бока пустые — ставим по факелу, чтобы кадр не был пустым */
        var fy = Math.min(H * 0.45, this.availH * 0.42);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        A.light(ctx, W * 0.06, fy, Math.min(W, H) * 0.24, 0.13);
        A.light(ctx, W * 0.94, fy, Math.min(W, H) * 0.24, 0.13);
        ctx.restore();
        A.flame(ctx, W * 0.06, fy, Math.max(4, Math.min(W, H) * 0.016), this.t, 1.1);
        A.flame(ctx, W * 0.94, fy, Math.max(4, Math.min(W, H) * 0.016), this.t, 3.3);
      }
      A.vignette(ctx, W, H, 0.32);
    },

    drawBoard: function (ctx) {
      var bx = this.bx, by = this.by, cs = this.cs, st = this.st, m = st.m;
      var i;
      A.frame(ctx, bx, by, this.boardW, this.boardH, cs);
      if (!this.baked) return;
      ctx.drawImage(this.baked.canvas, bx, by);

      /* свет от факелов */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < this.baked.torches.length; i++) {
        var tr = this.baked.torches[i];
        var fl = 0.82 + 0.18 * Math.sin(this.t * 7 + tr.phase) + 0.07 * Math.sin(this.t * 17 + tr.phase * 2);
        A.light(ctx, bx + tr.px, by + tr.py, cs * 3.1, (0.21 * fl).toFixed(3));
      }
      ctx.restore();
      for (i = 0; i < this.baked.torches.length; i++) {
        var t2 = this.baked.torches[i];
        A.flame(ctx, bx + t2.px, by + t2.py + cs * 0.01, Math.max(2, cs * 0.095), this.t, t2.phase);
      }

      /* дверь */
      var ex = L.cellCenter(m, st.exit);
      var open = st.keysTaken >= st.keys.length;
      A.door(ctx, bx + ex.x * cs, by + ex.y * cs, cs * 0.44, this.t, open, st.keysTaken, st.keys.length);

      /* ключи */
      for (i = 0; i < st.keys.length; i++) {
        var k = st.keys[i];
        if (k.taken) continue;
        var kp = L.cellCenter(m, k.cell);
        A.key(ctx, bx + kp.x * cs, by + kp.y * cs, cs * 0.26, this.t + i * 0.7, false);
      }

      /* дозорные */
      for (i = 0; i < st.guards.length; i++) {
        var gd = st.guards[i];
        var gp = L.guardPos(gd, m);
        A.guard(ctx, bx + gp.x * cs, by + gp.y * cs, cs * 0.30, this.t + i * 1.9, gd.alert || 0);
      }

      /* шар */
      var bp = L.ballPos(st);
      var px = bx + bp.x * cs, py = by + bp.y * cs;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      A.light(ctx, px, py, cs * 4.2, 0.32);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, this.boardW, this.boardH);
      ctx.clip();
      A.fog(ctx, this.boardW, this.boardH, this.t * 1.3, 71, 0.04);
      ctx.restore();
      A.orb(ctx, px, py, cs * 0.245, this.t, st.inv > 0);

      this.drawReveal(ctx);

      /* рамка поверх, чтобы шар не вылезал за поле */
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx + 1, by + 1, this.boardW - 2, this.boardH - 2);
      ctx.clip();
      var vg = ctx.createRadialGradient(bx + this.boardW / 2, by + this.boardH / 2, Math.min(this.boardW, this.boardH) * 0.34,
        bx + this.boardW / 2, by + this.boardH / 2, Math.max(this.boardW, this.boardH) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = vg;
      ctx.fillRect(bx, by, this.boardW, this.boardH);
      ctx.restore();
    },

    drawReveal: function (ctx) {
      if (this.revealT <= 0) return;
      var bx = this.bx, by = this.by, cs = this.cs, st = this.st, i, j;
      var a = Math.min(1, this.revealT / 0.5);
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.setLineDash([Math.max(3, cs * 0.16), Math.max(3, cs * 0.12)]);
      ctx.lineWidth = Math.max(1.5, cs * 0.075);
      ctx.strokeStyle = 'rgba(232,112,90,0.80)';
      for (i = 0; i < st.guards.length; i++) {
        var route = st.guards[i].route;
        ctx.beginPath();
        for (j = 0; j < route.length; j++) {
          var p = L.cellCenter(st.m, route[j]);
          if (j === 0) ctx.moveTo(bx + p.x * cs, by + p.y * cs);
          else ctx.lineTo(bx + p.x * cs, by + p.y * cs);
        }
        if (st.guards[i].loop) ctx.closePath();
        ctx.stroke();
      }
      /* кольца над ключами */
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(1.2, cs * 0.05);
      ctx.strokeStyle = 'rgba(243,210,100,0.75)';
      for (i = 0; i < st.keys.length; i++) {
        if (st.keys[i].taken) continue;
        var kp = L.cellCenter(st.m, st.keys[i].cell);
        var rr = cs * (0.32 + 0.05 * Math.sin(this.t * 4 + i));
        ctx.beginPath();
        ctx.arc(bx + kp.x * cs, by + kp.y * cs, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      var txt = T('map_on', { n: Math.ceil(this.revealT) });
      ctx.font = '700 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var tw = ctx.measureText(txt).width + 22;
      var lx = bx + this.boardW / 2 - tw / 2, ly = by + Math.max(4, cs * 0.15);
      pill(ctx, lx, ly, tw, 22, 'rgba(8,14,11,0.80)', 'rgba(243,210,100,0.55)');
      E.ui.text(ctx, txt, bx + this.boardW / 2, ly + 11, 12, P.key, 'center', 700);
    },

    drawHud: function (ctx) {
      var W = this.W, hudH = this.hudH;
      var lh = 26, ly = Math.round((hudH - lh) / 2);
      var lw = 54;
      pill(ctx, 8, ly, lw, lh, 'rgba(8,14,11,0.66)', 'rgba(243,210,100,0.30)');
      E.ui.text(ctx, T('lv', { n: this.level }), 8 + lw / 2, ly + lh / 2 + 1, 14, P.cream, 'center', 700);

      var kx = 8 + lw + 6, kw = 78;
      pill(ctx, kx, ly, kw, lh, 'rgba(8,14,11,0.66)', 'rgba(243,210,100,0.30)');
      A.key(ctx, kx + 16, ly + lh / 2, 9, 0.5, false);
      E.ui.text(ctx, T('keys_n', { n: this.st.keysTaken, total: this.st.keys.length }),
        kx + 30, ly + lh / 2 + 1, 14, P.key, 'left', 700);

      if (this.hudPos) coinsBadge(ctx, this.hudPos.coinsX, this.hudPos.coinsY, this.coinsVal);
      if (this.pauseBtn) this.pauseBtn.draw(ctx);
    },

    drawBottom: function (ctx) {
      var W = this.W, y = this.availH - Math.max(16, this.padBot * 0.42);
      var st = this.st, i;
      var hs = 8, hstep = 20;
      var hx = 14 + hs;
      for (i = 0; i < st.maxLives; i++) {
        heart(ctx, hx + i * hstep, y, hs, i < st.lives, P.danger);
      }
      var x2 = hx + st.maxLives * hstep + 8;
      for (i = 0; i < st.shields; i++) shieldGlyph(ctx, x2 + i * 17, y, 7, P.glimmer);

      var obj = st.keysTaken < st.keys.length ? T('objective_keys') : T('objective_exit');
      var objCol = st.keysTaken < st.keys.length ? P.key : P.exit;
      ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var availW = W - (x2 + st.shields * 17) - 20;
      var ofs = E.ui.fit(ctx, obj, Math.max(60, availW), 13, 600);
      E.ui.text(ctx, obj, (x2 + st.shields * 17 + 8 + W - 8) / 2, y, ofs, objCol, 'center', 600);
    },

    drawToast: function (ctx) {
      if (!this.toast) return;
      var W = this.W;
      var y = this.availH - this.padBot - 18;
      ctx.font = '700 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      var tw = Math.min(W - 32, ctx.measureText(this.toast.text).width + 34);
      var a = Math.min(1, this.toast.t / 0.35);
      ctx.save();
      ctx.globalAlpha = a;
      pill(ctx, W / 2 - tw / 2, y - 15, tw, 30, 'rgba(10,17,13,0.88)', 'rgba(243,210,100,0.40)');
      E.ui.text(ctx, this.toast.text, W / 2, y + 1, 14, P.cream, 'center', 700);
      ctx.restore();
    },

    drawEndPanel: function (ctx, kind) {
      var W = this.W, H = this.availH, r = this.panelRect;
      ctx.fillStyle = 'rgba(4,8,6,0.66)';
      ctx.fillRect(0, 0, W, H);
      if (!r) return;
      panelBg(ctx, r);
      var title, sub, col = P.cream;
      if (kind === 'pause') {
        title = T('pause');
        sub = T('level_n', { n: this.level });
      } else if (kind === 'win') {
        var last = this.level >= C.finalLevel;
        title = last ? T('final_title') : T('win_title');
        sub = last ? T('final_sub') : T('win_sub');
        col = P.exit;
      } else {
        title = T('lose_title');
        sub = T('lose_sub');
        col = P.danger;
      }
      var tSize = clamp(r.w * 0.078, 19, 27);
      ctx.font = '800 ' + Math.round(tSize) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      while (tSize > 15 && ctx.measureText(title).width > r.w - 28) {
        tSize -= 1;
        ctx.font = '800 ' + Math.round(tSize) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      }
      E.ui.text(ctx, title, W / 2, r.y + 38, tSize, col, 'center', 800);

      var sSize = clamp(r.w * 0.043, 12, 15);
      ctx.font = '500 ' + Math.round(sSize) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      while (sSize > 11 && ctx.measureText(sub).width > r.w - 32) {
        sSize -= 1;
        ctx.font = '500 ' + Math.round(sSize) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      }
      E.ui.text(ctx, sub, W / 2, r.y + 66, sSize, P.dim, 'center', 500);

      if (kind === 'win') {
        E.ui.text(ctx, T('won_coins', { n: this.reward }), W / 2, r.y + 98, 17, P.key, 'center', 700);
        var kk = this.st.keysTaken;
        for (var i = 0; i < this.st.keys.length; i++) {
          A.key(ctx, W / 2 - (this.st.keys.length - 1) * 11 + i * 22, r.y + 124, 8, 0.6 + i, i >= kk);
        }
      } else if (kind === 'over') {
        E.ui.text(ctx, T('keys_n', { n: this.st.keysTaken, total: this.st.keys.length }),
          W / 2, r.y + 98, 15, P.key, 'center', 700);
      } else {
        E.ui.text(ctx, T('keys_n', { n: this.st.keysTaken, total: this.st.keys.length }),
          W / 2, r.y + 96, 15, P.key, 'center', 700);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },

    drawShopPanel: function (ctx) {
      var W = this.W, H = this.availH, r = this.shopRect;
      ctx.fillStyle = 'rgba(4,8,6,0.76)';
      ctx.fillRect(0, 0, W, H);
      if (!r) return;
      panelBg(ctx, r);
      var tSize = clamp(r.w * 0.062, 15, 20);
      E.ui.text(ctx, T('shop_title'), r.x + 14, r.y + 26, tSize, P.cream, 'left', 800);
      A.coin(ctx, r.x + r.w - 74, r.y + 26, 8);
      E.ui.text(ctx, String(this.coinsVal), r.x + r.w - 14, r.y + 27, 14, P.gold, 'right', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
    },

    draw: function (game, ctx) {
      var W = game.view.w, H = game.view.h;
      this.drawBackground(ctx, W, H);
      if (this.st) {
        ctx.save();
        ctx.translate(E.fx.offsetX(this.t), E.fx.offsetY(this.t));
        this.drawBoard(ctx);
        ctx.restore();
      }
      E.fx.draw(ctx);
      this.drawHud(ctx);
      this.drawBottom(ctx);
      if (this.toast && (this.mode === 'running' || this.mode === 'paused')) this.drawToast(ctx);
      if (this.mode === 'paused') this.drawEndPanel(ctx, 'pause');
      else if (this.mode === 'win') this.drawEndPanel(ctx, 'win');
      else if (this.mode === 'over') this.drawEndPanel(ctx, 'over');
      else if (this.mode === 'shop') this.drawShopPanel(ctx);
      E.fx.drawFlash(ctx, W, H);
    }
  };

  G.scenes = S;
})(window.GAME);
