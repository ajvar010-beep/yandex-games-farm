/* game/scenes.js — «Трубы»: меню, карта уровней и головоломка.
   Вся механика — в game/logic.js; здесь сессия, ввод, экономика, реклама и отрисовка. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};
  var DIRS = L.DIRS;

  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function bannerInset() { return (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0); }

  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function truncate(ctx, text, maxW, size, weight) {
    ctx.font = A.font(size, weight);
    if (ctx.measureText(text).width <= maxW) return text;
    var t = text;
    while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function coinsBadge(ctx, x, y, val, w, h) {
    w = w || 92; h = h || 44;
    pill(ctx, x, y, w, h, 'rgba(6,20,23,0.72)', 'rgba(242,193,78,0.35)');
    A.coin(ctx, x + h * 0.42, y + h / 2, Math.min(11, h * 0.26));
    E.ui.text(ctx, String(val), x + h * 0.78, y + h / 2 + 1, Math.round(h * 0.36), P.gold, 'left', 700);
  }

  /* ---------------- мета / сохранения ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.economy.startCoins; E.storage.set('coins', c); }
      return Math.max(0, c | 0);
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    addCoins: function (n) { Meta.setCoins(Meta.coins() + (n | 0)); return Meta.coins(); },
    level: function () { return clamp((E.storage.get('level', 1) | 0) || 1, 1, C.levels.length); },
    setLevel: function (n) { E.storage.set('level', clamp(n | 0, 1, C.levels.length)); },
    done: function () {
      var d = E.storage.get('done', null);
      return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
    },
    markDone: function (n) { var d = Meta.done(); d[n] = 1; E.storage.set('done', d); },
    best: function () {
      var d = Meta.done(), m = 0, k, n;
      for (k in d) { n = +k; if (d[k] && n > m) m = n; }
      return m;
    },
    unlocked: function (n) { return n <= 1 || n <= Meta.best() + 1 || n <= Meta.level(); },
    stars: function () {
      var s = E.storage.get('stars', null);
      return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
    },
    star: function (n) { return Meta.stars()[n] | 0; },
    setStar: function (n, v) {
      var s = Meta.stars();
      if ((s[n] | 0) < v) { s[n] = v; E.storage.set('stars', s); }
    }
  };

  /* ---------------- кнопки-иконки ---------------- */
  function iconButton(kind, x, y, s, fn) {
    return new E.ui.Button({
      x: x, y: y, w: s, h: s,
      bg: 'rgba(6,20,23,0.72)', border: 'rgba(242,193,78,0.30)',
      icon: function (ctx, b) {
        A.icon(ctx, kind, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.5, kind === 'shop' || kind === 'sound' ? P.gold : P.cream);
      },
      onTap: fn || function () {}
    });
  }

  function soundButton(x, y, s) {
    return new E.ui.Button({
      x: x, y: y, w: s, h: s, bg: 'rgba(6,20,23,0.72)', border: 'rgba(242,193,78,0.30)',
      icon: function (ctx, b) {
        var mm = E.audio.isMuted();
        A.icon(ctx, 'sound', b.x + b.w / 2, b.y + b.h / 2, b.w * 0.5, mm ? P.dim : P.gold);
        if (mm) {
          ctx.strokeStyle = P.danger; ctx.lineWidth = Math.max(2, b.w * 0.05);
          ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.24, b.y + b.h * 0.76); ctx.lineTo(b.x + b.w * 0.76, b.y + b.h * 0.24); ctx.stroke();
        }
      },
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
  }

  /* ================================================================ МЕНЮ */
  S.menu = {
    name: 'menu',
    consumesInputInUpdate: true,
    enter: function (game) {
      this.game = game; this.t = 0; this.help = false; this.toast = null;
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      E.fx.reset();
      this._build(game);
    },
    onResize: function (game) { this._build(game); },
    _lay: function (v) {
      var W = v.w, H = v.h, banner = bannerInset();
      var portrait = H > W * 1.06;
      var bottom = H - banner;
      if (portrait) {
        var ts = Math.min(W * 0.20, H * 0.086, 74);
        return {
          W: W, H: H, banner: banner, bottom: bottom, portrait: true,
          ts: ts, align: 'center', x: W / 2,
          y1: H * 0.12, y2: H * 0.12 + ts * 0.92, subY: H * 0.12 + ts * 1.52,
          heroX: 0, heroY: H * 0.265, heroW: W, heroH: Math.min(H * 0.23, W * 0.70),
          bw: Math.min(330, W * 0.8), bh: clamp(H * 0.075, 46, 58),
          b0: H * 0.54
        };
      }
      var ts2 = Math.min(W * 0.072, H * 0.115, 56);
      return {
        W: W, H: H, banner: banner, bottom: bottom, portrait: false,
        ts: ts2, align: 'left', x: Math.max(24, W * 0.08),
        y1: H * 0.16, y2: H * 0.16 + ts2 * 0.92, subY: H * 0.16 + ts2 * 1.55,
        heroX: W * 0.47, heroY: H * 0.06, heroW: W * 0.51, heroH: H * 0.88,
        bw: Math.min(300, W * 0.36), bh: clamp(H * 0.115, 44, 50),
        b0: H * 0.42
      };
    },
    _build: function (game) {
      var v = game.view, M = this._lay(v), W = v.w, that = this;
      var list = [];
      var bx = M.portrait ? (W - M.bw) / 2 : M.x;
      list.push(new E.ui.Button({
        x: bx, y: M.b0, w: M.bw, h: M.bh, text: T('play'),
        bg: '#8a4f24', border: P.copperHi, fg: '#fff3e2', fontSize: Math.round(M.bh * 0.40),
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: Meta.level() }); }
      }));
      list.push(new E.ui.Button({
        x: bx, y: M.b0 + M.bh + 9, w: M.bw, h: M.bh * 0.88, text: T('levels'),
        bg: 'rgba(10,34,38,0.9)', border: 'rgba(47,179,168,0.5)', fg: P.cream,
        fontSize: Math.round(M.bh * 0.34),
        onTap: function () { E.audio.sfx('click'); game.setScene('map', {}); }
      }));
      var rvW = Math.min(240, M.portrait ? W * 0.62 : M.bw);
      var rvH = Math.max(40, M.bh * 0.8);
      list.push(new E.ui.Button({
        x: bx + (M.bw - rvW) / 2, y: M.b0 + M.bh * 1.88 + 20, w: rvW, h: rvH,
        bg: 'rgba(10,34,38,0.85)', border: 'rgba(242,193,78,0.38)',
        icon: function (ctx, b) {
          A.coin(ctx, b.x + 22, b.y + b.h / 2, 10);
          E.ui.text(ctx, T('coins_150', { n: C.ads.rewardedCoins }), b.x + 40, b.y + b.h / 2 - 6, 13, P.gold, 'left', 700);
          E.ui.text(ctx, T('coins_ad'), b.x + 40, b.y + b.h / 2 + 9, 12, P.dim, 'left', 500);
          ctx.fillStyle = 'rgba(242,193,78,0.85)';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w - 22, b.y + b.h / 2 - 6);
          ctx.lineTo(b.x + b.w - 12, b.y + b.h / 2);
          ctx.lineTo(b.x + b.w - 22, b.y + b.h / 2 + 6);
          ctx.closePath(); ctx.fill();
        },
        onTap: function () {
          E.sdk.showRewarded({
            onReward: function () { Meta.addCoins(C.ads.rewardedCoins); E.audio.sfx('coin'); that.toast = { t: 1.8, text: T('coins_150', { n: C.ads.rewardedCoins }) }; },
            onDone: function (ok) { if (!ok) that.toast = { t: 1.8, text: T('ad_fail') }; }
          });
        }
      }));
      list.push(soundButton(W - 56, 12, 44));
      list.push(iconButton('help', W - 108, 12, 44, function () {
        E.audio.sfx('click');
        that.help = !that.help;
      }));
      this.buttons = list;
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.help) {
        if (E.input.pointer.pressed || E.input.wasPressed('Escape')) this.help = false;
        return;
      }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) {
        game.setScene('play', { level: Meta.level() });
      }
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      var M = this._lay(v);
      A.plantRoom(ctx, W, H, this.t, 1);
      A.menuHero(ctx, M.heroX, M.heroY, M.heroW, M.heroH, this.t);

      E.ui.text(ctx, T('title1'), M.x, M.y1, M.ts, P.gold, M.align, 800);
      E.ui.text(ctx, T('title2'), M.x, M.y2, M.ts * 0.8, P.cream, M.align, 800);
      E.ui.text(ctx, T('subtitle'), M.x, M.subY, Math.min(W * 0.040, 16), 'rgba(233,245,242,0.62)', M.align, 500);

      coinsBadge(ctx, 12, 12, Meta.coins());
      E.ui.drawButtons(ctx, this.buttons);

      var pr = T('progress_n', { n: Meta.level(), total: C.levels.length }) + ' · ' + T('best_n', { n: Meta.best() });
      var px = M.portrait ? M.W / 2 : M.x;
      E.ui.text(ctx, pr, px, M.bottom - 46, Math.min(W * 0.034, 14), 'rgba(233,245,242,0.62)', M.align, 600);
      E.ui.text(ctx, T('menu_tip'), px, M.bottom - 24, Math.min(W * 0.031, 13), 'rgba(233,245,242,0.36)', M.align, 500);

      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        pill(ctx, W / 2 - 118, M.bottom - 110, 236, 36, 'rgba(6,20,23,0.94)', 'rgba(242,193,78,0.4)');
        E.ui.text(ctx, this.toast.text, W / 2, M.bottom - 92, 12, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }

      if (this.help) {
        ctx.fillStyle = 'rgba(4,16,19,0.95)';
        ctx.fillRect(0, 0, W, H);
        var hy = H * 0.2;
        E.ui.text(ctx, T('rules_title'), W / 2, hy, Math.min(W * 0.075, 30), P.gold, 'center', 800);
        var lines = [T('rules_1'), T('rules_2'), T('rules_3'), T('rules_4')];
        for (var i = 0; i < lines.length; i++) {
          var s = Math.max(12, Math.min(W * 0.036, 16));
          var txt = truncate(ctx, lines[i], W * 0.86, s, 500);
          E.ui.text(ctx, txt, W / 2, hy + 50 + i * (s + 24), s, P.cream, 'center', 500);
        }
        E.ui.text(ctx, T('close'), W / 2, M.bottom - 40, 15, 'rgba(233,245,242,0.62)', 'center', 600);
      }
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================ КАРТА */
  S.map = {
    name: 'map',
    consumesInputInUpdate: true,
    enter: function (game) {
      this.game = game; this.t = 0; this.toast = null;
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this._build(game);
    },
    onResize: function (game) { this._build(game); },
    _lay: function (v) {
      var W = v.w, H = v.h;
      var banner = bannerInset();
      var portrait = H > W * 1.06;
      var cols = portrait ? 3 : 5;
      var rows = Math.ceil(C.levels.length / cols);
      var pad = clamp(Math.min(W, H) * 0.035, 10, 20);
      var gap = 8;
      var top = portrait ? H * 0.175 : H * 0.20;
      var bottom = H - banner - (portrait ? 66 : 46);
      var tw = (W - pad * 2 - (cols - 1) * gap) / cols;
      var th = Math.min((bottom - top - (rows - 1) * gap) / rows, tw * 1.05);
      var x0 = (W - (cols * tw + (cols - 1) * gap)) / 2;
      return { W: W, H: H, portrait: portrait, cols: cols, rows: rows, pad: pad, gap: gap,
               top: top, tw: tw, th: th, x0: x0, banner: banner, bottom: bottom };
    },
    _build: function (game) {
      var v = game.view, M = this._lay(v), that = this, list = [];
      this.levelRects = [];
      for (var i = 0; i < C.levels.length; i++) {
        (function (ch, idx) {
          var col = idx % M.cols, row = Math.floor(idx / M.cols);
          var x = M.x0 + col * (M.tw + M.gap);
          var y = M.top + row * (M.th + M.gap);
          that.levelRects.push({ x: x, y: y, w: M.tw, h: M.th });
          list.push(new E.ui.Button({
            x: x, y: y, w: M.tw, h: M.th, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            icon: function (ctx, b) { that._tile(ctx, b, ch, idx); },
            onTap: function () {
              if (!Meta.unlocked(ch.n)) { E.audio.sfx('deny'); that.toast = { t: 1.4, text: T('locked') }; return; }
              E.audio.sfx('click');
              game.setScene('play', { level: ch.n });
            }
          }));
        })(C.levels[i], i);
      }
      list.push(new E.ui.Button({
        x: 12, y: M.bottom + 10, w: Math.min(170, M.W * 0.36), h: 44, text: T('back'),
        bg: 'rgba(10,34,38,0.9)', border: 'rgba(242,193,78,0.34)', fg: P.cream, fontSize: 15,
        onTap: function () { E.audio.sfx('click'); game.setScene('menu', {}); }
      }));
      this.buttons = list;
    },
    _tile: function (ctx, b, ch, idx) {
      var x = b.x, y = b.y, w = b.w, h = b.h;
      var locked = !Meta.unlocked(ch.n);
      var done = !!Meta.done()[ch.n];
      var current = ch.n === Meta.level() && !done;
      var r = Math.max(5, Math.min(w, h) * 0.13);
      E.ui.roundRect(ctx, x, y, w, h, r);
      var g = ctx.createLinearGradient(x, y, x, y + h);
      if (locked) { g.addColorStop(0, '#152a2e'); g.addColorStop(1, '#0c1e22'); }
      else { g.addColorStop(0, '#1e4247'); g.addColorStop(1, '#0f2a2f'); }
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = locked ? 'rgba(80,110,112,0.45)'
        : (current ? P.patinaHi : (done ? 'rgba(110,224,122,0.55)' : 'rgba(184,115,51,0.6)'));
      ctx.stroke();

      var ns = Math.min(h * 0.32, w * 0.3);
      E.ui.text(ctx, String(ch.n), x + w * 0.12, y + h * 0.28, ns, locked ? 'rgba(130,160,160,0.5)' : P.gold, 'left', 800);

      // мини-труба справа сверху
      A.miniPipe(ctx, x + w * 0.72, y + h * 0.3, Math.min(w, h) * 0.34,
        locked ? 'rgba(90,120,120,0.6)' : P.copper, locked ? 'rgba(90,120,120,0.3)' : P.water);

      var nm = T(ch.name);
      var fs = Math.max(12, Math.min(w * 0.115, h * 0.155));
      var txt = truncate(ctx, nm, w * 0.84, fs, 600);
      E.ui.text(ctx, txt, x + w * 0.1, y + h * 0.72, fs, locked ? 'rgba(130,160,160,0.5)' : 'rgba(233,245,242,0.8)', 'left', 600);

      if (locked) {
        // замочек
        var lx = x + w * 0.84, ly = y + h * 0.74, lr = Math.min(w, h) * 0.09;
        ctx.strokeStyle = 'rgba(150,175,175,0.6)';
        ctx.lineWidth = Math.max(2, lr * 0.3);
        ctx.beginPath();
        ctx.arc(lx, ly - lr * 0.4, lr * 0.6, Math.PI, 0);
        ctx.stroke();
        E.ui.roundRect(ctx, lx - lr * 0.9, ly - lr * 0.4, lr * 1.8, lr * 1.5, lr * 0.25);
        ctx.fillStyle = 'rgba(150,175,175,0.6)';
        ctx.fill();
      } else if (done) {
        // звёзды за экономию ходов
        var stn0 = Meta.star(ch.n);
        for (var si = 0; si < 3; si++) {
          E.ui.text(ctx, '★', x + w * 0.10 + si * w * 0.10, y + h * 0.90,
            Math.max(10, Math.min(w * 0.07, 13)), si < stn0 ? P.gold : 'rgba(130,160,160,0.30)', 'left', 700);
        }
        ctx.save();
        ctx.strokeStyle = P.ok;
        ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.055);
        ctx.lineCap = 'round';
        var ck = Math.min(w, h) * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + w - ck * 2.0, y + h * 0.18);
        ctx.lineTo(x + w - ck * 1.3, y + h * 0.27);
        ctx.lineTo(x + w - ck * 0.3, y + h * 0.10);
        ctx.stroke();
        ctx.restore();
      }
      if (current) {
        ctx.save();
        ctx.globalAlpha = 0.28 + Math.sin(this.t * 3) * 0.14;
        ctx.strokeStyle = P.patinaHi;
        ctx.lineWidth = 3;
        E.ui.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, r + 2);
        ctx.stroke();
        ctx.restore();
      }
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Escape')) game.setScene('menu', {});
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h, M = this._lay(v);
      A.plantRoom(ctx, W, H, this.t, 1);
      ctx.fillStyle = 'rgba(4,16,19,0.45)';
      ctx.fillRect(0, 0, W, H);
      E.ui.text(ctx, T('map_title'), W / 2, M.top * 0.48 + 6, Math.min(W * 0.085, 34), P.gold, 'center', 800);
      E.ui.text(ctx, T('map_hint'), W / 2, M.top * 0.48 + 34, Math.min(W * 0.033, 13), 'rgba(233,245,242,0.55)', 'center', 500);
      coinsBadge(ctx, 12, 12, Meta.coins(), 86, 40);
      E.ui.drawButtons(ctx, this.buttons);
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        pill(ctx, W / 2 - 90, M.bottom + 14, 180, 34, 'rgba(6,20,23,0.94)', 'rgba(242,193,78,0.4)');
        E.ui.text(ctx, this.toast.text, W / 2, M.bottom + 31, 12, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },
    getCaptureState: function () { return { scene: 'map' }; }
  };

  /* ================================================================ ИГРА */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      var raw = params.level != null ? params.level : (cp.wave != null ? cp.wave : Meta.level());
      this.level = clamp(parseInt(raw, 10) || 1, 1, C.levels.length);
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      var seed = null;
      if (E.capture.seed != null) seed = this.level * 7919 + 17 + ((+E.capture.seed | 0) * 131);
      this.st = L.newState({ level: this.level, coins: Meta.coins(), seed: seed });
      this.mode = 'running';
      this.pausePrev = 'running';
      this.t = 0; this.winT = 0; this.loseT = 0; this.autoT = 0;
      this.result = null; this.reward = 0; this.doubled = false; this.reviveUsed = false;
      this.hintT = 0; this.selPulse = 0; this.toast = null;
      this.captureMode = false;
      // первый interstitial — не раньше 60 с от начала сессии (правило площадки)
      if (!E.sdk._lastInterstitial) E.sdk._lastInterstitial = Date.now();
      this.shopCards = []; this.shopButtons = []; this.endButtons = [];
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this.layout(game);
      this.buildUi(game);
      this.buildEnd(game);
      if (E.capture && E.capture.active) this.applyCapture(game);
      this.flow = this.st.flow;
    },
    exit: function () {
      this.persist();
      E.sdk.gameplayStop();
    },
    persist: function () {
      if (this.st && !this.captureMode) Meta.setCoins(this.st.coins);
    },
    onResize: function (game) {
      if (!this.st) return;
      this.layout(game);
      this.buildUi(game);
      this.buildShop(game);
      this.buildEnd(game);
    },
    onBack: function (game) {
      if (this.mode === 'shop') { this.closeShop(game); return; }
      if (this.mode === 'running') this.setPaused(true, game);
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var banner = bannerInset();
      var portrait = H > W * 1.06;
      var n = this.st.n;
      var hudH = portrait ? clamp(H * 0.115, 74, 92) : clamp(H * 0.16, 58, 68);
      var top = hudH + 8;
      var bottom = H - banner - (portrait ? clamp(H * 0.05, 24, 42) : 16);
      var availH = Math.max(120, bottom - top);
      var availW = W - 20;
      var cellW = availW / (n + 1.55);
      var cellH = availH / (n + 0.5);
      var cell = Math.max(15, Math.min(cellW, cellH));
      var gw = cell * n, gh = cell * n;
      var gx = (W - gw) / 2;
      var gy = top + Math.max(0, (availH - gh) / 2);
      this.Lt = {
        W: W, H: H, portrait: portrait, banner: banner, hudH: hudH,
        top: top, bottom: bottom, availH: availH, availW: availW,
        cell: cell, gw: gw, gh: gh, gx: gx, gy: gy, n: n
      };
    },
    cellRect: function (cell) {
      var Lt = this.Lt, n = this.st.n;
      var r = Math.floor(cell / n), c = cell % n;
      return { x: Lt.gx + c * Lt.cell, y: Lt.gy + r * Lt.cell, w: Lt.cell, h: Lt.cell };
    },
    cellAt: function (x, y) {
      var Lt = this.Lt, n = this.st.n;
      if (x < Lt.gx || y < Lt.gy || x >= Lt.gx + Lt.gw || y >= Lt.gy + Lt.gh) return -1;
      var c = Math.floor((x - Lt.gx) / Lt.cell);
      var r = Math.floor((y - Lt.gy) / Lt.cell);
      return clamp(r, 0, n - 1) * n + clamp(c, 0, n - 1);
    },

    /* ---------- HUD / кнопки ---------- */
    buildUi: function (game) {
      var Lt = this.Lt, W = Lt.W, self = this;
      var s = 44;
      var list = [];
      list.push(new E.ui.Button({
        x: W - 12 - s, y: 8, w: s, h: s, bg: 'rgba(6,20,23,0.72)', border: 'rgba(242,193,78,0.3)',
        icon: function (ctx, b) { A.icon(ctx, 'pause', b.x + b.w / 2, b.y + b.h / 2, b.w * 0.44, P.cream); },
        onTap: function () { E.audio.sfx('click'); self.setPaused(true, game); }
      }));
      list.push(new E.ui.Button({
        x: W - 12 - s * 2 - 8, y: 8, w: s, h: s, bg: 'rgba(6,20,23,0.72)', border: 'rgba(242,193,78,0.3)',
        icon: function (ctx, b) { A.icon(ctx, 'shop', b.x + b.w / 2, b.y + b.h / 2, b.w * 0.44, P.gold); },
        onTap: function () { E.audio.sfx('click'); self.openShop(game); }
      }));
      this.buttons = list;
    },
    buildShop: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, self = this;
      if (!Lt) { this.shopButtons = []; return; }
      var list = [];
      this.shopCards = [];
      var cw, ch, x0, y0;
      if (Lt.portrait) {
        cw = Math.min(430, W * 0.92);
        var topY = Lt.top + 46;
        var closeY = H - Lt.banner - 22 - 46;
        ch = clamp((closeY - topY - 24) / 3 - 8, 62, 104);
        x0 = (W - cw) / 2;
        y0 = topY;
      } else {
        var gap = 12;
        cw = Math.min(250, (W - 40 - gap * 2) / 3);
        ch = Math.min(214, (H - Lt.top - 120));
        x0 = (W - (cw * 3 + gap * 2)) / 2;
        y0 = Lt.top + 40;
      }
      for (var i = 0; i < C.shop.length; i++) {
        (function (item, idx) {
          var x, y;
          if (Lt.portrait) { x = x0; y = y0 + idx * (ch + 8); }
          else { x = x0 + idx * (cw + 12); y = y0; }
          self.shopCards.push({ item: item, x: x, y: y, w: cw, h: ch, idx: idx });
          var bw = 96, bh = 46;
          var bx = Lt.portrait ? (x + cw - bw - 8) : (x + cw / 2 - bw / 2);
          var by = Lt.portrait ? (y + ch / 2 - bh / 2) : (y + ch - bh - 10);
          var price = L.itemPrice(self.st, item.id);
          var afford = self.st.coins >= price;
          list.push(new E.ui.Button({
            x: bx, y: by, w: bw, h: bh,
            icon: function (ctx, b) {
              A.coin(ctx, b.x + 16, b.y + b.h / 2, 8);
              E.ui.text(ctx, String(price), b.x + 92, b.y + b.h / 2 + 1, 15, afford ? P.gold : '#c97a6a', 'right', 700);
            },
            bg: afford ? 'rgba(60,86,44,0.9)' : 'rgba(44,36,34,0.9)',
            border: afford ? 'rgba(110,224,122,0.5)' : 'rgba(200,120,100,0.35)',
            onTap: function () { self.buyItem(game, item.id); }
          }));
        })(C.shop[i], i);
      }
      var closeY = H - Lt.banner - 22 - 46;
      list.push(new E.ui.Button({
        x: W / 2 - 90, y: closeY, w: 180, h: 46, text: T('close'),
        bg: 'rgba(10,34,38,0.95)', border: 'rgba(242,193,78,0.4)', fg: P.cream, fontSize: 16,
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
      this.shopButtons = list;
    },

    /* ---------- конец уровня ---------- */
    buildEnd: function (game) {
      var Lt = this.Lt, self = this;
      var list = [];
      if (!Lt) { this.endButtons = list; return; }
      var W = Lt.W, H = Lt.H;
      var bw = Math.min(320, W * 0.82);
      var bh = clamp(H * 0.075, 46, 54);
      var gap = 8;
      var n = this.mode === 'paused' ? 4 : 3;
      var block = n * bh + (n - 1) * gap;
      var cy = (Lt.top + Lt.bottom) / 2;
      var y0 = cy - block / 2 + (this.mode === 'paused' ? 14 : 36);
      var x = W / 2 - bw / 2;
      var i = 0;
      function add(text, bg, border, fg, fs, fn) {
        list.push(new E.ui.Button({ x: x, y: y0 + i * (bh + gap), w: bw, h: bh, text: text,
          bg: bg, border: border, fg: fg, fontSize: fs, onTap: fn }));
        i++;
      }
      if (this.mode === 'paused') {
        add(T('pause_resume'), '#3f5a34', P.ok, '#eaf6dc', 17, function () { E.audio.sfx('click'); self.setPaused(false, game); });
        add(T('pause_restart'), 'rgba(20,46,50,0.94)', 'rgba(242,193,78,0.4)', P.cream, 16, function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); });
        add(E.audio.isMuted() ? T('sound_off') : T('sound_on'), 'rgba(10,34,38,0.9)', 'rgba(242,193,78,0.24)', P.dim, 14, function (b) {
          var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m);
          b.text = m ? T('sound_off') : T('sound_on');
        });
        add(T('pause_menu'), 'rgba(10,34,38,0.9)', 'rgba(242,193,78,0.24)', P.cream, 15, function () {
          E.audio.sfx('click');
          self.persist();
          game.setScene('menu', {});
        });
      } else if (this.mode === 'win') {
        var last = this.level >= C.levels.length;
        add(last ? T('to_levels') : T('next_level'), '#3f5a34', P.ok, '#eaf6dc', 17, function () {
          E.audio.sfx('click');
          self.leaveWin(game, last ? 'map' : 'next');
        });
        if (!this.captureMode && !this.doubled) {
          add(T('double_reward'), 'rgba(20,46,50,0.94)', P.gold, P.cream, 15, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.doubled = true;
                self.st.coins += self.reward;
                Meta.setCoins(self.st.coins);
                E.audio.sfx('coin');
                self.buildEnd(game);
              },
              onDone: function () {}
            });
          });
        }
        add(T('to_levels'), 'rgba(10,34,38,0.9)', 'rgba(242,193,78,0.24)', P.dim, 14, function () {
          E.audio.sfx('click');
          self.leaveWin(game, 'map');
        });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.reviveUsed) {
          add(T('second_chance'), '#4b3a22', P.gold, P.cream, 16, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.reviveUsed = true;
                self.st.movesLeft += C.secondChanceMoves;
                self.st.hints++; // второй шанс не считаем «чистым» уровнем
                self.loseT = 0;
                self.mode = 'running';
                self.result = null;
                E.sdk.gameplayStart();
                E.audio.sfx('revive');
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.toast = { t: 1.8, text: T('ad_fail') }; } }
            });
          });
        }
        add(T('retry'), 'rgba(20,46,50,0.94)', P.gold, P.cream, 17, function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); });
        add(T('to_levels'), 'rgba(10,34,38,0.9)', 'rgba(242,193,78,0.24)', P.dim, 14, function () { E.audio.sfx('click'); self.persist(); game.setScene('map', {}); });
      }
      this.endButtons = list;
    },

    /* ---------- пауза / магазин / исходы ---------- */
    setPaused: function (on, game) {
      game = game || this.game;
      if (on && (this.mode === 'running' || this.mode === 'shop')) {
        this.pausePrev = this.mode;
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildEnd(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = this.pausePrev === 'shop' ? 'shop' : 'running';
        if (!this.st.solved && this.st.movesLeft > 0) E.sdk.gameplayStart();
        if (this.mode === 'shop') this.buildShop(game);
        this.buildEnd(game);
      }
    },
    openShop: function (game) {
      game = game || this.game;
      if (this.mode === 'win' || this.mode === 'over' || this.st.solved) return;
      if (this.mode !== 'paused') this.pausePrev = this.mode;
      this.mode = 'shop';
      E.sdk.gameplayStop();
      this.buildShop(game);
    },
    closeShop: function (game) {
      game = game || this.game;
      this.mode = 'running';
      if (!this.st.solved && this.st.movesLeft > 0) E.sdk.gameplayStart();
      this.buildEnd(game);
    },
    buyItem: function (game, id) {
      var res = L.buy(this.st, id);
      if (!res.ok) {
        E.audio.sfx('deny');
        this.toast = { t: 1.8, text: res.reason === 'nothing' ? T('hint_nothing') : T('not_enough') };
        return;
      }
      E.audio.sfx('buy');
      this.persist();
      if (id === 'hint') {
        this.hintT = 1.8;
        this.toast = { t: 1.8, text: T('hint_used') };
        E.audio.sfx('pulse');
      } else if (id === 'moves') {
        this.toast = { t: 1.8, text: T('moves_added', { n: C.extraMoves }) };
        this.loseT = 0;
      } else if (id === 'freeze') {
        this.toast = { t: 1.8, text: T('freeze_on', { n: C.freezeSeconds }) };
      }
      this.buildShop(game);
      if (res.solved) {
        this.mode = 'running';
        this.winT = 0;
        this.buildEnd(game);
        E.audio.sfx('wave');
      }
    },
    onWin: function (game, capture) {
      if (this.result) return;
      this.st.solved = true;
      this.mode = 'win';
      this.result = { win: true };
      var rw = L.reward(this.st);
      this.reward = rw.total;
      this.perfect = rw.perfect;
      if (!capture && !this.autopilot) {
        this.st.coins += this.reward;
        Meta.setCoins(this.st.coins);
        Meta.markDone(this.level);
        // звёзды за экономию ходов: 3 — осталось ≥40% лимита, 2 — ≥15%, иначе 1
        var lim0 = Math.max(1, this.st.limit || 1), left0 = Math.max(0, this.st.movesLeft | 0);
        var stn = left0 >= Math.ceil(lim0 * 0.40) ? 3 : (left0 >= Math.ceil(lim0 * 0.15) ? 2 : 1);
        this.stars = stn;
        Meta.setStar(this.level, stn);
        Meta.setLevel(Math.max(Meta.level(), Math.min(C.levels.length, this.level + 1)));
      }
      E.audio.sfx('win');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },
    onOver: function (game) {
      if (this.result) return;
      this.mode = 'over';
      this.result = { win: false };
      this.persist();
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },
    leaveWin: function (game, to) {
      this.persist();
      var self = this;
      var go = function () {
        if (to === 'next') game.setScene('play', { level: Math.min(C.levels.length, self.level + 1) });
        else game.setScene('map', {});
      };
      var needAd = !this.captureMode && !this.autopilot && (this.level % C.ads.interstitialEvery === 0);
      if (needAd) E.sdk.showInterstitial(function () { go(); });
      else go();
    },

    /* ---------- ввод / шаг ---------- */
    tapCell: function (cell) {
      if (this.mode !== 'running' || this.st.solved) return;
      var t = this.st.tiles[cell];
      if (!t) { E.audio.sfx('deny'); this.selPulse = 0.25; return; }
      if (!L.rotate(this.st, cell)) return;
      this.st.hintCell = -1;
      this.flow = this.st.flow;
      E.audio.sfx('tick');
      if (this.st.solved) {
        this.winT = 0;
        E.audio.sfx('wave');
        var sink = this.cellRect(this.st.sink * this.st.n + (this.st.n - 1));
        for (var i = 0; i < 14; i++) {
          E.fx.spawn(sink.x + sink.w / 2, sink.y + sink.h / 2, {
            vx: (this.st.rng.float() - 0.5) * 160, vy: -40 - this.st.rng.float() * 140,
            life: 0.5 + this.st.rng.float() * 0.4, size: 2 + this.st.rng.float() * 3,
            color: i % 2 ? P.water : P.waterHi, grav: 260
          });
        }
      } else if (this.st.movesLeft <= 0) {
        this.loseT = 0;
        E.audio.sfx('deny');
      }
    },
    autoTick: function (dt) {
      var st = this.st;
      this.autoT += dt;
      if (st.movesLeft < 4) st.movesLeft += 10;
      if (this.autoT > 0.42) {
        this.autoT = 0;
        if (!st.solved) {
          var cell = L.autoStep(st);
          if (cell >= 0) { this.flow = st.flow; E.audio.sfx('tick'); }
          if (st.solved) { this.winT = 0; E.audio.sfx('wave'); }
        }
      }
    },
    processEvents: function () {
      var ev = L.takeEvents(this.st);
      for (var i = 0; i < ev.length; i++) {
        if (ev[i].type === 'solved') E.audio.sfx('pulse');
        else if (ev[i].type === 'buy') E.audio.sfx('buy');
      }
    },
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.hintT > 0) this.hintT -= dt;
      if (this.selPulse > 0) this.selPulse -= dt;

      var Ptr = E.input.pointer;

      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'shop') { this.closeShop(game); return; }
        if (this.mode === 'paused') { this.setPaused(false, game); return; }
        if (this.mode === 'running') { this.setPaused(true, game); return; }
      }

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (Ptr.pressed) E.ui.handleTap(this.endButtons, Ptr.x, Ptr.y);
        if (this.autopilot || this.captureMode) {
          this.autoT += dt;
          if (this.autoT > 2.0) {
            this.autoT = 0;
            if (this.mode === 'win') {
              game.setScene('play', { level: Math.min(C.levels.length, this.level + 1) });
            } else if (this.mode === 'over') {
              game.setScene('play', { level: this.level });
            }
          }
        }
        return;
      }

      if (this.mode === 'shop') {
        if (Ptr.pressed) E.ui.handleTap(this.shopButtons, Ptr.x, Ptr.y);
        return;
      }

      L.tick(this.st, dt);
      if (this.autopilot) this.autoTick(dt);

      if (this.st.solved) {
        this.winT += dt;
        if (this.winT > 1.25) { this.onWin(game, this.captureMode); return; }
      } else if (this.st.movesLeft <= 0 && !this.autopilot) {
        this.loseT += dt;
        if (this.loseT > 0.7) { this.onOver(game); return; }
      }
      this.flow = this.st.flow;

      if (Ptr.pressed) {
        if (E.ui.handleTap(this.buttons, Ptr.x, Ptr.y)) return;
        var cell = this.cellAt(Ptr.x, Ptr.y);
        if (cell >= 0) this.tapCell(cell);
      }
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.captureMode = true;
      this.st.coins = Math.max(this.st.coins, 340);
      var mode = cp.mode;
      var t = clamp(parseFloat(cp.t) || 5, 1, 24);
      if (mode === 'shop') {
        this.st.flowT = 1.2;
        this.openShop(game);
      } else if (mode === 'over') {
        this.st.movesLeft = 0;
        this.st.flowT = 0.9;
        this.mode = 'over';
        this.result = { win: false };
      } else if (mode === 'win') {
        L.solveAll(this.st);
        this.st.flowT = 3.2;
        this.st.movesLeft = Math.max(3, Math.round(this.st.par * 0.25));
        this.onWin(game, true);
      } else {
        var frac = clamp(0.28 + t / 24, 0.33, 0.86);
        L.solvePrefix(this.st, Math.round(this.st.order.length * frac));
        this.st.flowT = 2.4;
        this.st.movesLeft = Math.max(3, this.st.limit - Math.round(t));
        this.mode = 'running';
      }
      this.flow = this.st.flow;
      this.layout(game);
      this.buildUi(game);
      this.buildShop(game);
      this.buildEnd(game);
    },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.level) this.level = clamp(s.level | 0, 1, C.levels.length);
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'win') {
        L.solveAll(this.st);
        this.st.flowT = 3;
        this.onWin(game, true);
      } else if (s.mode === 'over') {
        this.st.movesLeft = 0;
        this.mode = 'over';
        this.result = { win: false };
        this.buildEnd(game);
      }
    },
    getCaptureState: function () {
      return {
        scene: 'play', mode: this.mode, level: this.level,
        moves: this.st ? this.st.movesLeft : 0,
        solved: this.st ? !!this.st.solved : false,
        tiles: this.st ? this.st.tiles.filter(Boolean).length : 0
      };
    },

    /* ---------- отрисовка ---------- */
    wetAt: function (cell) {
      var f = this.st.flow;
      if (!f || !f.wet[cell]) return 0;
      var d = f.depth[cell] || 0;
      return clamp((this.st.flowT - d * 0.10) / 0.26, 0, 1);
    },
    drawBoard: function (ctx) {
      var Lt = this.Lt, st = this.st, n = st.n, cell = Lt.cell;
      A.frame(ctx, Lt.gx, Lt.gy, Lt.gw, Lt.gh, cell, this.t);

      for (var i = 0; i < st.tiles.length; i++) {
        var t = st.tiles[i];
        var r = Math.floor(i / n), c = i % n;
        var x = Lt.gx + c * cell, y = Lt.gy + r * cell;
        if (!t) { A.plate(ctx, x, y, cell, i); continue; }
        A.plate(ctx, x, y, cell, i);
        var ang = (t.anim || 0) * -Math.PI / 2;
        ctx.save();
        if (ang) {
          ctx.translate(x + cell / 2, y + cell / 2);
          ctx.rotate(ang);
          ctx.translate(-(x + cell / 2), -(y + cell / 2));
          ctx.globalAlpha = 1 - (t.anim || 0) * 0.25;
        }
        A.pipeTile(ctx, x, y, cell, t.mask, { wet: this.wetAt(i) });
        ctx.restore();
      }

      // краны
      for (var s = 0; s < st.sources.length; s++) {
        var row = st.sources[s];
        var srcCell = row * n;
        A.faucet(ctx, Lt.gx, Lt.gy + row * cell + cell / 2, cell, this.wetAt(srcCell) > 0.2, this.t, s === 1);
      }
      // сток
      var sinkCell = st.sink * n + (n - 1);
      A.drain(ctx, Lt.gx + Lt.gw, Lt.gy + st.sink * cell + cell / 2, cell, this.wetAt(sinkCell), this.t);

      // пар из утечек
      var f = st.flow;
      if (f && f.leaks) {
        for (var k = 0; k < f.leaks.length && k < 7; k++) {
          var lk = f.leaks[k];
          if (this.wetAt(lk.cell) < 0.5) continue;
          var lr = Math.floor(lk.cell / n), lc = lk.cell % n;
          var ex = Lt.gx + lc * cell + cell / 2 + DIRS[lk.d][0] * cell * 0.52;
          var ey = Lt.gy + lr * cell + cell / 2 + DIRS[lk.d][1] * cell * 0.52;
          A.steam(ctx, ex, ey, cell * 0.55, (this.t * 0.8 + k * 0.19) % 1);
        }
      }

      // подсветка выбранной/подсказанной клетки
      if (st.hintCell >= 0 && this.hintT > 0) {
        var hr = this.cellRect(st.hintCell);
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(this.t * 9) * 0.22;
        ctx.strokeStyle = P.gold;
        ctx.lineWidth = 3;
        E.ui.roundRect(ctx, hr.x + 2, hr.y + 2, hr.w - 4, hr.h - 4, cell * 0.16);
        ctx.stroke();
        ctx.restore();
      } else if (this.mode === 'running' && !st.solved) {
        var p = E.input.pointer;
        if (p.type === 'mouse' && p.x >= Lt.gx && p.x < Lt.gx + Lt.gw && p.y >= Lt.gy && p.y < Lt.gy + Lt.gh) {
          var hc = this.cellAt(p.x, p.y);
          var hcell = st.tiles[hc];
          if (hcell) {
            var hrt = this.cellRect(hc);
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = P.cream;
            ctx.lineWidth = 2;
            E.ui.roundRect(ctx, hrt.x + 2, hrt.y + 2, hrt.w - 4, hrt.h - 4, cell * 0.16);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    },
    drawHud: function (ctx) {
      var Lt = this.Lt, W = Lt.W, st = this.st;
      var ban = Lt.banner;
      // затемнение сверху
      var g = ctx.createLinearGradient(0, 0, 0, Lt.top + 10);
      g.addColorStop(0, 'rgba(4,16,19,0.55)');
      g.addColorStop(1, 'rgba(4,16,19,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, Lt.top + 10);

      // левый блок: уровень + ходы
      var chipW = 92, chipH = 22;
      pill(ctx, 12, 8, chipW, chipH, 'rgba(6,20,23,0.8)', 'rgba(47,179,168,0.4)');
      E.ui.text(ctx, T('level_n', { n: this.level }), 12 + chipW / 2, 8 + chipH / 2 + 1, 11, P.patinaHi, 'center', 800);

      var mw = 112, mh = 44, my = 30;
      var low = st.movesLeft <= 5;
      var frozen = st.freezeT > 0;
      pill(ctx, 12, my, mw, mh, frozen ? 'rgba(28,74,90,0.92)' : 'rgba(6,20,23,0.82)',
        frozen ? P.ice : (low ? 'rgba(255,107,94,0.62)' : 'rgba(242,193,78,0.4)'));
      A.valve(ctx, 12 + 20, my + mh / 2, 10, frozen ? this.t * 2 : 0, frozen ? P.ice : P.brass);
      E.ui.text(ctx, T('moves'), 12 + 40, my + 14, 11, frozen ? P.ice : P.dim, 'left', 600);
      E.ui.text(ctx, String(st.movesLeft), 12 + 40, my + 31, 18, low ? P.danger : (frozen ? P.ice : P.gold), 'left', 800);
      if (frozen) {
        E.ui.text(ctx, Math.ceil(st.freezeT) + '', 12 + mw + 8, my + mh / 2 + 1, 13, P.ice, 'left', 800);
      }

      // монеты + кнопки справа
      var coinW = 92;
      var bx = W - 12 - 44;
      var sx = bx - 8 - 44;
      coinsBadge(ctx, sx - 8 - coinW, 8, st.coins, coinW, 44);
      E.ui.drawButtons(ctx, this.buttons);

      // подсказка внизу
      var hint = '';
      if (st.solved) hint = T('tut_flow');
      else if (this.level === 1 && st.movesLeft === st.limit) hint = T('tut_tap');
      else hint = T('tut_goal');
      if (hint) E.ui.text(ctx, hint, W / 2, Lt.H - ban - 10, Math.min(W * 0.032, 12), 'rgba(233,245,242,0.42)', 'center', 500);
    },
    drawToast: function (ctx) {
      if (!this.toast) return;
      var Lt = this.Lt, W = Lt.W;
      ctx.globalAlpha = Math.min(1, this.toast.t * 2);
      var tw = Math.min(300, W * 0.86);
      pill(ctx, W / 2 - tw / 2, Lt.bottom - 52, tw, 36, 'rgba(6,20,23,0.95)', 'rgba(242,193,78,0.45)');
      E.ui.text(ctx, this.toast.text, W / 2, Lt.bottom - 34, 12, P.cream, 'center', 600);
      ctx.globalAlpha = 1;
    },
    drawShop: function (ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      ctx.fillStyle = 'rgba(4,14,17,0.9)';
      ctx.fillRect(0, 0, W, H);
      E.ui.text(ctx, T('shop_title'), W / 2, Lt.top + 6, Math.min(W * 0.075, 26), P.gold, 'center', 800);
      E.ui.text(ctx, T('shop_hint'), W / 2, Lt.top + 28, Math.min(W * 0.032, 12), 'rgba(233,245,242,0.55)', 'center', 500);
      coinsBadge(ctx, 12, 12, this.st.coins, 86, 38);

      for (var i = 0; i < this.shopCards.length; i++) {
        var cd = this.shopCards[i], item = cd.item;
        E.ui.roundRect(ctx, cd.x, cd.y, cd.w, cd.h, 12);
        var g = ctx.createLinearGradient(cd.x, cd.y, cd.x, cd.y + cd.h);
        g.addColorStop(0, 'rgba(26,58,62,0.98)');
        g.addColorStop(1, 'rgba(14,36,40,0.98)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(184,115,51,0.45)';
        ctx.stroke();

        var price = L.itemPrice(this.st, item.id);
        var afford = this.st.coins >= price;
        if (Lt.portrait) {
          var ir = Math.min(20, cd.h * 0.26);
          ctx.beginPath(); ctx.arc(cd.x + 30, cd.y + cd.h / 2, ir, 0, Math.PI * 2);
          ctx.fillStyle = item.id === 'freeze' ? 'rgba(80,180,200,0.32)' : 'rgba(242,193,78,0.22)';
          ctx.fill();
          A.icon(ctx, item.glyph, cd.x + 30, cd.y + cd.h / 2, ir * 1.1, item.id === 'freeze' ? P.ice : P.gold);
          E.ui.text(ctx, T(item.name), cd.x + 56, cd.y + cd.h * 0.33, 15, P.cream, 'left', 700);
          var dsc = truncate(ctx, T(item.desc), cd.w - 56 - 118, 12, 500);
          E.ui.text(ctx, dsc, cd.x + 56, cd.y + cd.h * 0.68, 12, 'rgba(233,245,242,0.62)', 'left', 500);
        } else {
          var ir2 = 24;
          var icx = cd.x + cd.w / 2, icy = cd.y + 46;
          ctx.beginPath(); ctx.arc(icx, icy, ir2, 0, Math.PI * 2);
          ctx.fillStyle = item.id === 'freeze' ? 'rgba(80,180,200,0.32)' : 'rgba(242,193,78,0.22)';
          ctx.fill();
          A.icon(ctx, item.glyph, icx, icy, ir2 * 1.05, item.id === 'freeze' ? P.ice : P.gold);
          E.ui.text(ctx, T(item.name), icx, cd.y + 100, 16, P.cream, 'center', 700);
          var d2 = truncate(ctx, T(item.desc), cd.w - 24, 12, 500);
          E.ui.text(ctx, d2, icx, cd.y + 122, 12, 'rgba(233,245,242,0.62)', 'center', 500);
        }
      }
      E.ui.drawButtons(ctx, this.shopButtons);
    },
    drawEnd: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      ctx.fillStyle = 'rgba(4,14,17,0.78)';
      ctx.fillRect(0, 0, W, Lt.H);
      var firstY = this.endButtons.length ? this.endButtons[0].y : Lt.H * 0.4;
      var areaTop = Lt.top + 8;
      var areaBottom = firstY - 10;
      var areaH = Math.max(40, areaBottom - areaTop);
      var k = clamp(areaH / 128, 0.58, 1);
      var stackH = 128 * k;
      var y = Math.max(areaTop, areaBottom - stackH);
      var cx = W / 2;

      if (this.mode === 'win' || this.mode === 'over') {
        var cardTop = y - 14 * k;
        var cardH = Math.max(60, (areaBottom - 2) - cardTop);
        var cardW = Math.min(400, W * 0.9);
        E.ui.roundRect(ctx, cx - cardW / 2, cardTop, cardW, cardH, 16);
        ctx.fillStyle = 'rgba(5,20,23,0.94)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(47,179,168,0.5)'; ctx.stroke();
      }

      if (this.mode === 'paused') {
        E.ui.text(ctx, T('paused'), cx, areaBottom - 30 * k, Math.min(W * 0.085, 32 * k), P.gold, 'center', 800);
      } else if (this.mode === 'win') {
        E.ui.text(ctx, T('win_title'), cx, y + 17 * k, Math.min(W * 0.085, 34 * k), P.patinaHi, 'center', 800);
        E.ui.text(ctx, T('win_sub'), cx, y + 41 * k, Math.min(W * 0.036, 14 * k), 'rgba(233,245,242,0.72)', 'center', 500);
        var rw = Math.min(250, W * 0.68), rh = 34 * k;
        pill(ctx, cx - rw / 2, y + 52 * k, rw, rh, 'rgba(6,20,23,0.85)', 'rgba(242,193,78,0.42)');
        A.coin(ctx, cx - rw / 2 + 22, y + 52 * k + rh / 2, 10 * k);
        E.ui.text(ctx, T('won_coins', { n: this.reward }), cx + 8, y + 52 * k + rh / 2 + 1, 15 * k, P.gold, 'center', 700);
        var stn = this.stars | 0;
        if (!stn) {
          var limS = Math.max(1, this.st.limit || 1), leftS = Math.max(0, this.st.movesLeft | 0);
          stn = leftS >= Math.ceil(limS * 0.40) ? 3 : (leftS >= Math.ceil(limS * 0.15) ? 2 : 1);
        }
        for (var si = 0; si < 3; si++) {
          E.ui.text(ctx, '★', cx + rw / 2 - 58 + si * 13 * k, y + 52 * k + rh / 2,
            13 * k, si < stn ? P.gold : 'rgba(242,193,78,0.22)', 'center', 700);
        }
        var lineY = y + 100 * k;
        if (this.perfect) {
          E.ui.text(ctx, T('perfect_bonus', { n: this.perfect }), cx, lineY, 12 * k, P.ok, 'center', 600);
          lineY += 16 * k;
        }
        E.ui.text(ctx, T('win_moves', { n: this.st.movesLeft }), cx, lineY, 11 * k, 'rgba(233,245,242,0.55)', 'center', 500);
      } else if (this.mode === 'over') {
        E.ui.text(ctx, T('lose_title'), cx, y + 20 * k, Math.min(W * 0.082, 32 * k), P.danger, 'center', 800);
        E.ui.text(ctx, T('lose_sub'), cx, y + 46 * k, Math.min(W * 0.036, 14 * k), 'rgba(233,245,242,0.7)', 'center', 500);
        if (!this.reviveUsed && !this.captureMode) {
          E.ui.text(ctx, T('second_chance_d'), cx, y + 66 * k, 12 * k, 'rgba(233,245,242,0.45)', 'center', 500);
        }
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },
    draw: function (game, ctx) {
      var Lt = this.Lt;
      A.plantRoom(ctx, Lt.W, Lt.H, this.t, this.level);
      this.drawBoard(ctx);
      E.fx.draw(ctx);
      if (this.mode === 'shop') {
        this.drawShop(ctx);
      } else {
        this.drawHud(ctx);
        this.drawToast(ctx);
      }
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.drawEnd(ctx);
      E.fx.drawFlash(ctx, Lt.W, Lt.H);
    }
  };

  G.scenes = S;
})(window.GAME);
