/* game/scenes.js — «Домино-Цепь»: меню, выбор уровня, стол с цепью.
   Вся механика — в game/logic.js; здесь сессия, ввод, экономика, отрисовка и реклама. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};

  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function lbl(ctx, s, x, y, size, color, align, weight, family) {
    ctx.font = (weight || 700) + ' ' + size + 'px ' + (family || 'Georgia, "Times New Roman", serif');
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function card(ctx, x, y, w, h, r, fill, stroke, lw) {
    E.ui.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  /* ---------------- мета / сохранения ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = 0; E.storage.set('coins', c); }
      return c | 0;
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    level: function () { return clamp((E.storage.get('lvl', 1) | 0) || 1, 1, C.levels.length); },
    setLevel: function (n) { E.storage.set('lvl', clamp(n | 0, 1, C.levels.length)); },
    done: function () {
      var d = E.storage.get('done', null);
      return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
    },
    markDone: function (n) { var d = Meta.done(); d[n] = 1; E.storage.set('done', d); },
    best: function () { return (E.storage.get('best', 0) | 0); },
    setBest: function (n) { if (n > Meta.best()) E.storage.set('best', n | 0); },
    ads: function () { return (E.storage.get('ads', 0) | 0); },
    setAds: function (n) { E.storage.set('ads', n | 0); },
    submit: function () { E.sdk.submitScore('dominochain_score', Meta.best()); }
  };

  function addCoins(n) {
    var c = Math.max(0, Meta.coins() + (n | 0));
    Meta.setCoins(c);
    return c;
  }

  function coinsBadge(ctx, x, y, val) {
    var w = 96, h = 32;
    pill(ctx, x, y, w, h, 'rgba(20,12,5,0.62)', 'rgba(240,193,75,0.38)');
    A.coin(ctx, x + 17, y + h / 2, 9.5);
    E.ui.text(ctx, String(val), x + 31, y + h / 2 + 1, 16, P.gold, 'left', 700);
  }

  function iconButton(x, y, size, drawIcon, onTap, border) {
    return new E.ui.Button({
      x: x, y: y, w: size, h: size,
      bg: 'rgba(20,12,5,0.62)', border: border || 'rgba(240,193,75,0.35)',
      icon: drawIcon, onTap: onTap
    });
  }

  function soundButton(x, y) {
    return iconButton(x, y, 40, function (ctx, b) {
      var mm = E.audio.isMuted();
      E.ui.text(ctx, mm ? '♪̸' : '♪', b.x + b.w / 2, b.y + b.h / 2 + 1, 17, mm ? P.dim : P.gold, 'center', 700);
    }, function () {
      var m = !E.audio.isMuted();
      E.audio.setMuted(m);
      E.storage.set('muted', m);
      E.audio.sfx('click');
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
      var W = v.w, H = v.h;
      var portrait = H > W * 1.05;
      var bh = clamp(H * 0.072, 38, 56);
      var rvH = Math.max(34, bh * 0.66);
      var blockH = bh + 12 + bh * 0.84 + 26 + rvH;
      var b0 = H - 54 - blockH;
      var titleSize = Math.min(W * (portrait ? 0.15 : 0.082), H * (portrait ? 0.075 : 0.105), portrait ? 62 : 74);
      var topY = H * (portrait ? 0.155 : 0.115);
      var y1 = topY + titleSize * 0.60;
      var subY = y1 + titleSize * 1.58;
      var chainTop = subY + 46;
      var chainH = clamp(b0 - chainTop - 12, 0, Math.min(H * 0.20, W * 0.24));
      var bw = Math.min(330, W * 0.72);
      return { W: W, H: H, portrait: portrait, titleSize: titleSize, y1: y1, subY: subY,
               chainTop: chainTop, chainH: chainH, bw: bw, bh: bh, b0: b0, rvH: rvH };
    },
    _build: function (game) {
      var v = game.view, W = v.w, M = this._lay(v), that = this;
      var bx = (W - M.bw) / 2;
      var list = [];
      list.push(new E.ui.Button({
        x: bx, y: M.b0, w: M.bw, h: M.bh, text: T('play'),
        bg: '#7d3f2a', border: P.gold, fg: P.cream, fontSize: Math.round(M.bh * 0.40),
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: Meta.level() }); }
      }));
      list.push(new E.ui.Button({
        x: bx, y: M.b0 + M.bh + 12, w: M.bw, h: M.bh * 0.84, text: T('levels'),
        bg: 'rgba(40,26,12,0.88)', border: 'rgba(240,193,75,0.45)', fg: P.cream,
        fontSize: Math.round(M.bh * 0.33),
        onTap: function () { E.audio.sfx('click'); game.setScene('levels', {}); }
      }));
      var rvW = Math.min(232, W * 0.60), rvH = Math.max(38, M.bh * 0.68);
      list.push(new E.ui.Button({
        x: W / 2 - rvW / 2, y: M.b0 + M.bh * 1.84 + 30, w: rvW, h: rvH,
        bg: 'rgba(40,26,12,0.85)', border: 'rgba(95,174,74,0.5)',
        icon: function (ctx, b) {
          A.coin(ctx, b.x + 20, b.y + b.h / 2, 9);
          E.ui.text(ctx, T('coins_150', { n: C.ads.rvCoins }), b.x + 36, b.y + b.h / 2 - 5, 13, P.gold, 'left', 700);
          E.ui.text(ctx, T('coins_ad'), b.x + 36, b.y + b.h / 2 + 8, 9.5, P.dim, 'left', 500);
          ctx.fillStyle = 'rgba(95,174,74,0.9)';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w - 20, b.y + b.h / 2 - 6);
          ctx.lineTo(b.x + b.w - 10, b.y + b.h / 2);
          ctx.lineTo(b.x + b.w - 20, b.y + b.h / 2 + 6);
          ctx.closePath(); ctx.fill();
        },
        onTap: function () {
          E.sdk.showRewarded({
            onReward: function () {
              addCoins(C.ads.rvCoins);
              E.audio.sfx('coin');
              that.toast = { t: 1.6, text: T('coins_150', { n: C.ads.rvCoins }) };
            },
            onDone: function (ok) { if (!ok) that.toast = { t: 1.8, text: T('ad_fail') }; }
          });
        }
      }));
      var hb = iconButton(W - 56, 14, 40, function (ctx, b) {
        E.ui.text(ctx, '?', b.x + b.w / 2, b.y + b.h / 2 + 1, 19, P.gold, 'center', 800);
      }, function () { E.audio.sfx('click'); that.help = !that.help; });
      list.push(hb);
      list.push(soundButton(W - 56 - 46, 14));
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
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', { level: Meta.level() });
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h, M = this._lay(v);
      A.table(ctx, W, H, 9);
      // шатёр-навес сверху, под ним гирлянда флажков
      A.awning(ctx, 0, 0, W, Math.max(24, H * 0.072), this.t);
      A.bunting(ctx, W, H * 0.095, this.t, 4);
      var a = Math.min(1, this.t * 1.6);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 5;
      lbl(ctx, T('title1'), W / 2, M.y1, M.titleSize, P.cloth, 'center', 800);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      lbl(ctx, T('title2'), W / 2, M.y1 + M.titleSize * 0.92, M.titleSize * 0.92, P.gold, 'center', 800);
      ctx.restore();
      E.ui.text(ctx, T('subtitle'), W / 2, M.subY, Math.min(W * 0.040, 17), 'rgba(242,227,194,0.62)', 'center', 500);

      if (M.chainH > 30) {
        ctx.save();
        ctx.globalAlpha = a;
        A.menuChain(ctx, W * 0.05, M.chainTop, W * 0.90, M.chainH, this.t);
        ctx.restore();
      }

      coinsBadge(ctx, 14, 14, Meta.coins());
      ctx.save();
      ctx.globalAlpha = a;
      E.ui.drawButtons(ctx, this.buttons);
      ctx.restore();

      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      E.ui.text(ctx, T('progress_n', { n: Meta.level(), t: C.levels.length }) + ' · ' + T('best_n', { n: Meta.best() }),
        W / 2, H - 52 - banM, Math.min(W * 0.034, 14), 'rgba(242,227,194,0.55)', 'center', 600);
      E.ui.text(ctx, T('menu_tip'), W / 2, H - 28 - banM, Math.min(W * 0.032, 13), 'rgba(242,227,194,0.35)', 'center', 500);

      if (this.toast) {
        var ta = Math.min(1, this.toast.t * 2);
        ctx.globalAlpha = ta;
        pill(ctx, W / 2 - 112, H * 0.80, 224, 38, 'rgba(20,12,5,0.94)', 'rgba(240,193,75,0.45)');
        E.ui.text(ctx, this.toast.text, W / 2, H * 0.80 + 19, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }

      if (this.help) {
        ctx.fillStyle = 'rgba(18,10,4,0.94)'; ctx.fillRect(0, 0, W, H);
        var hy = H * 0.22;
        lbl(ctx, T('rules_title'), W / 2, hy, Math.min(W * 0.075, 32), P.gold, 'center', 800);
        var lines = [T('rules_1'), T('rules_2'), T('rules_3'), T('rules_4')];
        for (var i = 0; i < lines.length; i++) {
          var s = E.ui.fit(ctx, lines[i], W * 0.84, Math.max(13, Math.min(W * 0.036, 17)), 500);
          E.ui.text(ctx, lines[i], W / 2, hy + 54 + i * (s + 22), s, P.cream, 'center', 500);
        }
        E.ui.text(ctx, T('close'), W / 2, H * 0.84, 16, 'rgba(242,227,194,0.65)', 'center', 600);
      }
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================ УРОВНИ */
  S.levels = {
    name: 'levels',
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
      var portrait = H > W * 1.05;
      var cols = portrait ? 3 : 4;
      var rows = Math.ceil(C.levels.length / cols);
      var pad = Math.max(10, Math.min(W, H) * 0.035);
      var gap = 9;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var top = H * 0.18;
      var bottom = H - banner - pad * 2 - 46;
      var tw = (W - pad * 2 - (cols - 1) * gap) / cols;
      var th = Math.min(tw * 1.16, (bottom - top - (rows - 1) * gap) / rows);
      var totalW = cols * tw + (cols - 1) * gap;
      return { W: W, H: H, portrait: portrait, cols: cols, rows: rows, pad: pad, gap: gap,
               banner: banner, top: top, tw: tw, th: th, x0: (W - totalW) / 2 };
    },
    _build: function (game) {
      var v = game.view, M = this._lay(v), that = this;
      var list = [];
      list.push(new E.ui.Button({
        x: 14, y: M.H - M.banner - 50, w: Math.min(170, M.W * 0.36), h: 40, text: T('back'),
        bg: 'rgba(40,26,12,0.88)', border: 'rgba(240,193,75,0.45)', fg: P.cream, fontSize: 16,
        onTap: function () { E.audio.sfx('click'); game.setScene('menu', {}); }
      }));
      for (var i = 0; i < C.levels.length; i++) {
        (function (idx) {
          var n = idx + 1;
          var col = idx % M.cols, row = Math.floor(idx / M.cols);
          var x = M.x0 + col * (M.tw + M.gap);
          var y = M.top + row * (M.th + M.gap);
          list.push(new E.ui.Button({
            x: x, y: y, w: M.tw, h: M.th,
            bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            icon: function (ctx, b) { that._tile(ctx, b, n); },
            onTap: function () {
              if (n > Meta.level()) { that.toast = { t: 1.5, text: T('not_unlocked') }; E.audio.sfx('deny'); return; }
              E.audio.sfx('click');
              game.setScene('play', { level: n });
            }
          }));
        })(i);
      }
      this.buttons = list;
    },
    _tile: function (ctx, b, n) {
      var x = b.x, y = b.y, w = b.w, h = b.h;
      var locked = n > Meta.level();
      var done = !!Meta.done()[n];
      var cur = n === Meta.level();
      var r = Math.max(7, Math.min(w, h) * 0.09);
      var g = ctx.createLinearGradient(x, y, x, y + h);
      if (locked) { g.addColorStop(0, '#33240f'); g.addColorStop(1, '#22170a'); }
      else { g.addColorStop(0, '#f7ecd2'); g.addColorStop(1, '#dfc9a1'); }
      card(ctx, x, y, w, h, r, g, locked ? 'rgba(90,60,30,0.5)' : (cur ? P.gold : (done ? 'rgba(95,174,74,0.75)' : 'rgba(192,57,43,0.65)')));
      var cx = x + w / 2, cy = y + h / 2;
      lbl(ctx, String(n), cx, cy - h * 0.08, Math.min(h * 0.36, w * 0.42), locked ? 'rgba(160,130,95,0.5)' : P.pipDark, 'center', 800);
      if (locked) {
        // замок
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = P.dim; ctx.lineWidth = Math.max(1.5, w * 0.03);
        ctx.beginPath(); ctx.arc(cx, cy + h * 0.22, w * 0.055, Math.PI, 0); ctx.stroke();
        E.ui.roundRect(ctx, cx - w * 0.085, cy + h * 0.21, w * 0.17, h * 0.13, 3);
        ctx.fillStyle = P.dim; ctx.fill();
        ctx.restore();
      } else if (done) {
        // галочка
        ctx.strokeStyle = 'rgba(75,140,58,0.95)';
        ctx.lineWidth = Math.max(2, w * 0.045);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.075, cy + h * 0.26);
        ctx.lineTo(cx - w * 0.015, cy + h * 0.32);
        ctx.lineTo(cx + w * 0.085, cy + h * 0.17);
        ctx.stroke();
      } else {
        E.ui.text(ctx, (C.levels[n - 1].goal) + '', cx, cy + h * 0.27, Math.min(h * 0.15, 13), 'rgba(80,50,20,0.6)', 'center', 700);
      }
      if (cur && !locked) {
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(this.t * 4) * 0.25;
        E.ui.roundRect(ctx, x - 3, y - 3, w + 6, h + 6, r + 2);
        ctx.strokeStyle = P.gold; ctx.lineWidth = 2.5; ctx.stroke();
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
      A.table(ctx, W, H, 21);
      lbl(ctx, T('levels_title'), W / 2, H * 0.10, Math.min(W * 0.075, 34), P.gold, 'center', 800);
      coinsBadge(ctx, 14, 14, Meta.coins());
      E.ui.drawButtons(ctx, this.buttons);
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        pill(ctx, W / 2 - 118, H - M.banner - 104, 236, 38, 'rgba(20,12,5,0.94)', 'rgba(192,57,43,0.6)');
        E.ui.text(ctx, this.toast.text, W / 2, H - M.banner - 85, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },
    getCaptureState: function () { return { scene: 'levels' }; }
  };

  /* ================================================================ СТОЛ */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.level = clamp(parseInt(params.level || params.chapter || (cp.wave != null ? cp.wave : Meta.level()), 10) || 1, 1, C.levels.length);
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      var seed = (params.seed != null) ? params.seed : (E.capture.seed != null ? E.capture.seed : (Date.now() % 999983));
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);

      this.st = L.newLevel({
        level: this.level,
        rng: new E.Rng(this.seedNum || 1),
        coins: Meta.coins(),
        recordSafe: this.autopilot || (E.capture && E.capture.active)
      });
      this.mode = 'running';      // running | shop | paused | win | over
      this.panel = '';
      this.t = 0; this.autoT = 0; this.clearT = 0;
      this.pending = null; this.pendT = 0;
      this.floaters = []; this.pops = {};
      this.toast = null; this.banner = null;
      this.result = null; this.reward = 0; this.doubled = false;
      this.reviveUsed = false; this.captureMode = false;
      this.shopButtons = []; this.endButtons = [];
      this.pausePrev = 'running';
      this.coinSyncT = 0;
      this.lastHand = this.st.hand.length;
      this.winCount = 0; this.adTick = Meta.ads();
      this.selPulse = 0;

      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();

      this.layout(game);
      this.buildShop(game);
      this.buildEnd(game);
      if (E.capture && E.capture.active) this.applyCapture(game);
    },
    exit: function () {
      this.persist();
      E.sdk.gameplayStop();
    },
    onResize: function (game) {
      this.layout(game);
      this.buildShop(game);
      if (this.mode !== 'running') this.buildEnd(game);
    },
    onBack: function (game) {
      if (this.mode === 'running' || this.mode === 'shop') this.setPaused(true, game);
    },
    persist: function () {
      if (!this.st) return;
      Meta.setCoins(this.st.coins);
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var portrait = H > W * 1.06;
      var hudH = portrait ? clamp(H * 0.072, 52, 72) : clamp(H * 0.125, 44, 60);

      var hn = clamp(this.st.hand.length, 2, 10);
      var gap = clamp(W * 0.012, 4, 12);
      var maxLen = portrait ? Math.min(W * 0.215, 138) : Math.min(H * 0.30, 150);
      var handLen = Math.min((W - 130 - (hn - 1) * gap) / hn, maxLen);
      handLen = Math.max(30, handLen);
      var handTh = handLen / 2;
      var handH = Math.max(56, handTh + clamp(handTh * 0.62, 24, 46));

      var panelTop = H - banner - handH;
      var boardTop = hudH + 6;
      var boardBottom = panelTop - 8;
      var bx = portrait ? 12 : 18;
      var boardRect = { x: bx, y: boardTop, w: W - bx * 2, h: Math.max(90, boardBottom - boardTop) };

      var slots = this.st.goal + 2;
      var path = A.chainPath(boardRect, slots);
      // сколько костей реально влезает на каждую сторону: сумма = goal + 1,
      // поэтому до цели всегда есть куда поставить
      this.caps = { left: path.startIdx, right: path.slots.length - 1 - path.startIdx };
      this.st.caps = { left: this.caps.left, right: this.caps.right };

      // панель HUD
      var ph = Math.min(44, hudH - 10);
      var py = (hudH - ph) / 2 + 2;
      var pauseS = Math.min(ph, 44);
      var pauseBtn = new E.ui.Button({
        x: W - 8 - pauseS, y: py + (ph - pauseS) / 2, w: pauseS, h: pauseS, fontSize: 15, text: 'II',
        bg: 'rgba(20,12,5,0.62)', border: 'rgba(240,193,75,0.4)', fg: P.cream,
        onTap: (function (self) { return function () { E.audio.sfx('click'); self.setPaused(true, self.game); }; })(this)
      });
      var coinsW = Math.min(94, W * 0.25);
      var coinsRect = { x: W - 8 - pauseS - 6 - coinsW, y: py + (ph - 32) / 2, w: coinsW, h: 32 };
      var leftW = Math.min(76, W * 0.21);
      var hearts = { x: 12, y: py + ph - 13, s: 6.4, gap: 17 };
      var goalX = 12 + leftW + 10;
      var goalRight = coinsRect.x - 10;
      var goalRect = { x: goalX, y: py + 4, w: Math.max(56, goalRight - goalX), h: ph - 8 };

      // панель руки
      var shopS = Math.max(44, Math.min(46, handH - 12));
      var shopBtn = new E.ui.Button({
        x: W - 10 - shopS, y: panelTop + (handH - shopS) / 2, w: shopS, h: shopS,
        bg: 'rgba(120,64,32,0.92)', border: P.gold,
        icon: function (ctx, b) {
          var s = b.w * 0.46;
          ctx.save();
          ctx.translate(b.x + b.w / 2, b.y + b.h / 2 - 3);
          ctx.fillStyle = P.cloth;
          ctx.beginPath();
          ctx.moveTo(-s, s * 0.42); ctx.lineTo(s, s * 0.42); ctx.lineTo(s * 0.72, -s * 0.2);
          ctx.lineTo(-s * 0.72, -s * 0.2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#c0392b';
          for (var i = 0; i < 3; i++) { ctx.fillRect(-s + i * s * 0.68, s * 0.1, s * 0.34, s * 0.32); }
          ctx.beginPath(); ctx.arc(0, -s * 0.34, s * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        },
        onTap: (function (self) { return function () { E.audio.sfx('click'); self.openShop(self.game); }; })(this)
      });

      var bzW = Math.min(handTh * 2.0, W * 0.18);
      var bzH = Math.min(handH - 16, bzW * 1.3);
      var bazaar = { x: 10, y: panelTop + (handH - bzH) / 2, w: bzW, h: bzH };

      var handX0 = bazaar.x + bazaar.w + 12;
      var handX1 = shopBtn.x - 8;
      var totalHand = hn * handLen + (hn - 1) * gap;
      var handStart = handX0 + Math.max(0, (handX1 - handX0 - totalHand) / 2);

      var Lt = {
        W: W, H: H, portrait: portrait, banner: banner, hudH: hudH, panelTop: panelTop,
        boardRect: boardRect, path: path, pauseBtn: pauseBtn, coinsRect: coinsRect,
        leftW: leftW, hearts: hearts, goalRect: goalRect,
        handLen: handLen, handTh: handTh, handH: handH, handGap: gap, handStart: handStart,
        shopBtn: shopBtn, bazaar: bazaar
      };
      this.Lt = Lt;
      this.buttons = [pauseBtn, shopBtn];
      this.endZones = this.computeEndZones();
    },

    /* Экранные зоны двух открытых концов — для выбора стороны. */
    computeEndZones: function () {
      var Lt = this.Lt, path = Lt.path, st = this.st;
      var nL = st.left.length, nR = st.right.length;
      var sL = path.startIdx - 1 - nL, sR = path.startIdx + 1 + nR;
      var r = Math.max(26, path.tileLen * 0.72);
      function at(idx) {
        var s = path.slots[clamp(idx, 0, path.slots.length - 1)];
        return { x: s.x - Math.cos(s.a) * path.tileLen * 0.34, y: s.y - Math.sin(s.a) * path.tileLen * 0.34, r: r };
      }
      var zl = at(sL), zr = at(sR);
      zl.full = nL >= (this.caps ? this.caps.left : 99);
      zr.full = nR >= (this.caps ? this.caps.right : 99);
      return { left: zl, right: zr };
    },

    slotPos: function (side, index) {
      // index: 0 — ближайшая к центру кость на этой стороне
      var path = this.Lt.path;
      var s = side === 'left' ? path.slots[path.startIdx - 1 - index] : path.slots[path.startIdx + 1 + index];
      return s || path.slots[path.startIdx];
    },

    handRect: function (i) {
      var Lt = this.Lt;
      var x = Lt.handStart + i * (Lt.handLen + Lt.handGap);
      var lift = (this.mode === 'running' && this.pending != null && this.st.hand[i] && this.st.hand[i].id === this.pending) ? Lt.handTh * 0.22 : 0;
      var y = Lt.panelTop + (Lt.handH - Lt.handTh) / 2 - lift;
      return { x: x, y: y, w: Lt.handLen, h: Lt.handTh };
    },
    handAt: function (x, y) {
      for (var i = 0; i < this.st.hand.length; i++) {
        var r = this.handRect(i);
        if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 14 && y <= r.y + r.h + 10) return i;
      }
      return -1;
    },

    /* ---------- магазин ---------- */
    buildShop: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      var list = [];
      var n = C.shop.length;
      var portrait = Lt.portrait;
      var head = 96;                      // заголовок, подсказка и кошелёк
      var top = Lt.boardRect.y + head;
      var cw = portrait ? Math.min(W * 0.86, 400) : Math.min((W - 60) / n - 14, 240);
      var chh = portrait ? Math.min(132, (Lt.boardRect.h - head) / n - 12) : Math.min(Lt.boardRect.h - head - 16, 160);
      var x0 = portrait ? (W - cw) / 2 : (W - (cw * n + 14 * (n - 1))) / 2;
      var self = this;
      for (var i = 0; i < n; i++) {
        (function (item, idx) {
          var x = portrait ? x0 : x0 + idx * (cw + 14);
          var y = portrait ? top + idx * (chh + 12) : top + 8;
          var price = L.shopPrice(self.st, item.id);
          list.push(new E.ui.Button({
            x: x, y: y, w: cw, h: chh,
            bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            icon: function (ctx, b) { self.drawShopCard(ctx, b, item, price); },
            onTap: function () { self.buy(item.id, game); }
          }));
        })(C.shop[i], i);
      }
      var bw = Math.min(200, W * 0.44);
      list.push(new E.ui.Button({
        x: W / 2 - bw / 2, y: H - Lt.banner - Lt.handH + (Lt.handH - 40) / 2, w: bw, h: 40,
        text: T('close'), bg: 'rgba(40,26,12,0.95)', border: 'rgba(240,193,75,0.55)', fg: P.cream, fontSize: 16,
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
      this.shopButtons = list;
    },
    shopRects: function () {
      var out = [];
      for (var i = 0; i < this.shopButtons.length - 1; i++) out.push(this.shopButtons[i]);
      return out;
    },
    drawShopCard: function (ctx, b, item, price) {
      var st = this.st;
      var afford = st.coins >= price;
      var x = b.x, y = b.y, w = b.w, h = b.h;
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#f7ecd2'); g.addColorStop(1, '#e0c9a2');
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
      card(ctx, x, y, w, h, 14, g, 'rgba(120,60,30,0.85)', 2);
      ctx.restore();
      var pad = Math.min(w, h) * 0.09;
      // иконка
      var ir = Math.min(h * 0.30, 26);
      var icx = x + pad + ir, icy = y + h / 2;
      if (item.id === 'draw') {
        A.back(ctx, icx, icy, ir * 2.2, 0, { shadow: false });
      } else if (item.id === 'shuffle') {
        ctx.save();
        ctx.strokeStyle = P.pipDark; ctx.lineWidth = Math.max(2, ir * 0.20); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(icx, icy, ir * 0.82, -0.6, 3.6); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(icx + ir * 0.78, icy - ir * 0.72); ctx.lineTo(icx + ir * 1.02, icy - ir * 0.30);
        ctx.lineTo(icx + ir * 0.56, icy - ir * 0.22);
        ctx.closePath(); ctx.fillStyle = P.pipDark; ctx.fill();
        ctx.restore();
      } else {
        A.star(ctx, icx, icy, ir * 0.95, P.gold);
        lbl(ctx, '×2', icx, icy + 1, ir * 0.8, P.pipDark, 'center', 800, 'system-ui, sans-serif');
      }
      var tx = x + pad + ir * 2.3;
      var tw = x + w - pad - 74 - tx;
      var ns = E.ui.fit(ctx, T(item.name), tw, Math.min(15, h * 0.17), 700);
      E.ui.text(ctx, T(item.name), tx, y + h * 0.35, ns, P.ink, 'left', 700);
      var ds = E.ui.fit(ctx, T(item.desc), tw, Math.min(11.5, h * 0.125), 500);
      E.ui.text(ctx, T(item.desc), tx, y + h * 0.62, ds, 'rgba(61,39,19,0.72)', 'left', 500);
      // цена
      var bx = x + w - pad - 66, by = y + h / 2 - 16;
      card(ctx, bx, by, 66, 32, 16, afford ? '#7d3f2a' : 'rgba(90,70,50,0.55)', afford ? P.gold : 'rgba(120,100,70,0.5)', 1.5);
      A.coin(ctx, bx + 15, by + 16, 8);
      E.ui.text(ctx, String(price), bx + 42, by + 17, 14, afford ? P.cream : 'rgba(240,230,210,0.55)', 'center', 700);
    },
    openShop: function (game) {
      if (!this.st || this.st.phase !== 'play') return;
      this.pausePrev = this.mode === 'shop' ? this.pausePrev : this.mode;
      this.mode = 'shop';
      this.panel = 'shop';
      this.pending = null;
      E.sdk.gameplayStop();
      this.buildShop(game || this.game);
      this.buildEnd(game || this.game);
    },
    closeShop: function (game) {
      this.mode = 'running';
      this.panel = '';
      E.sdk.gameplayStart();
      this.layout(game || this.game);
    },
    buy: function (id, game) {
      var r = L.buy(this.st, id);
      if (r === 'coins') { this.toast = { t: 1.6, text: T('not_enough') }; E.audio.sfx('deny'); return; }
      if (r !== 'ok') return;
      E.audio.sfx('buy');
      this.syncCoins();
      this.buildShop(game || this.game);
      this.layout(game || this.game);
    },
    syncCoins: function () { Meta.setCoins(this.st.coins); },

    /* ---------- пауза и исходы ---------- */
    setPaused: function (on, game) {
      game = game || this.game;
      if (on && (this.mode === 'running' || this.mode === 'shop')) {
        if (this.mode !== 'paused') this.pausePrev = this.mode;
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildEnd(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = this.pausePrev === 'shop' ? 'shop' : 'running';
        if (this.mode === 'running') E.sdk.gameplayStart();
        this.buildEnd(game);
      }
    },
    onWin: function (game, capture) {
      if (this.result) return;
      this.mode = 'win';
      this.result = { win: true };
      var reward = L.reward(this.st);
      this.reward = reward;
      this.st.coins += reward;
      this.doubled = false;
      if (!capture && !this.autopilot) {
        Meta.setCoins(this.st.coins);
        Meta.markDone(this.level);
        Meta.setLevel(Math.max(Meta.level(), Math.min(C.levels.length, this.level + 1)));
        Meta.setBest(this.st.score);
        Meta.submit();
      }
      E.audio.sfx('win');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },
    onLose: function (game, capture) {
      if (this.result) return;
      this.mode = 'over';
      this.result = { win: false };
      if (!capture && !this.autopilot) {
        Meta.setCoins(this.st.coins);
        Meta.setBest(this.st.score);
        Meta.submit();
      }
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },
    buildEnd: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, self = this;
      var list = [];
      var bw = Math.min(310, W * 0.78), bh = Math.min(52, Math.max(42, Lt.boardRect.h * 0.10));
      var gapY = 10;
      var n = 0;
      if (this.mode === 'paused') n = 4;
      else if (this.mode === 'win') n = 3;
      else if (this.mode === 'over') n = 3;
      if (!n) { this.endButtons = list; return; }
      var cy = (Lt.boardRect.y + Lt.boardRect.y + Lt.boardRect.h) / 2;
      var y0 = Math.min(Lt.boardRect.y + Lt.boardRect.h - 16 - n * (bh + gapY), Math.max(Lt.boardRect.y + 90, cy - n * (bh + gapY) / 2));
      var x = W / 2 - bw / 2;
      var i = 0;
      function add(text, bg, border, fg, fs, fn) {
        list.push(new E.ui.Button({ x: x, y: y0 + i * (bh + gapY), w: bw, h: bh, text: text,
          bg: bg, border: border, fg: fg, fontSize: fs, onTap: fn }));
        i++;
      }
      if (this.mode === 'paused') {
        add(T('pause_resume'), '#4f7a3c', '#8fd06a', '#f2ffe6', 18, function () { E.audio.sfx('click'); self.setPaused(false, game); });
        add(T('pause_restart'), 'rgba(52,34,16,0.95)', 'rgba(240,193,75,0.45)', P.cream, 17, function () {
          E.audio.sfx('click'); self.persist(); game.setScene('play', { level: self.level });
        });
        add(E.audio.isMuted() ? T('sound_off') : T('sound_on'), 'rgba(30,19,8,0.95)', 'rgba(240,193,75,0.28)', P.dim, 15, function (b) {
          var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m);
          b.text = m ? T('sound_off') : T('sound_on');
        });
        add(T('pause_menu'), 'rgba(30,19,8,0.95)', 'rgba(240,193,75,0.28)', P.cream, 16, function () {
          E.audio.sfx('click'); self.persist(); game.setScene('menu', {});
        });
      } else if (this.mode === 'win') {
        var last = this.level >= C.levels.length;
        add(last ? T('to_levels') : T('next_level'), '#4f7a3c', '#8fd06a', '#f2ffe6', 18, function () {
          E.audio.sfx('click');
          self.leaveWin(game, last ? 'levels' : 'next');
        });
        if (!this.captureMode && !this.doubled) {
          add(T('double_reward'), 'rgba(52,34,16,0.95)', P.gold, P.cream, 16, function () {
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
        add(T('to_levels'), 'rgba(30,19,8,0.95)', 'rgba(240,193,75,0.28)', P.dim, 15, function () {
          E.audio.sfx('click'); self.leaveWin(game, 'levels');
        });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.reviveUsed) {
          add(T('second_chance'), '#7d3f2a', P.gold, P.cream, 17, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.reviveUsed = true;
                self.st.hearts = Math.max(2, C.hearts - 1);
                self.st.draws += 4;
                self.st.phase = 'play';
                self.mode = 'running';
                self.result = null;
                E.sdk.gameplayStart();
                E.audio.sfx('revive');
                self.layout(game);
                self.buildEnd(game);
              },
              onDone: function () {}
            });
          });
        }
        add(T('retry'), 'rgba(52,34,16,0.95)', 'rgba(240,193,75,0.45)', P.cream, 17, function () {
          E.audio.sfx('click'); game.setScene('play', { level: self.level });
        });
        add(T('to_levels'), 'rgba(30,19,8,0.95)', 'rgba(240,193,75,0.28)', P.dim, 15, function () {
          E.audio.sfx('click'); self.persist(); game.setScene('levels', {});
        });
      }
      this.endButtons = list;
    },
    leaveWin: function (game, where) {
      this.persist();
      if (where === 'levels') { game.setScene('levels', {}); return; }
      var total = Meta.ads() + 1;
      Meta.setAds(total);
      if (this.captureMode) { game.setScene('play', { level: Math.min(C.levels.length, this.level + 1) }); return; }
      if (total % C.ads.interstitialEvery === 0) {
        E.sdk.showInterstitial(function () {
          game.setScene('play', { level: Math.min(C.levels.length, this.level + 1) });
        });
      } else {
        game.setScene('play', { level: Math.min(C.levels.length, this.level + 1) });
      }
    },

    /* ---------- ход игрока ---------- */
    doPlay: function (tileId, side) {
      var st = this.st;
      var capL = this.caps ? this.caps.left : 99;
      var capR = this.caps ? this.caps.right : 99;
      var len = side === 'left' ? st.left.length : st.right.length;
      var cap = side === 'left' ? capL : capR;
      if (len >= cap) {
        var other = side === 'left' ? 'right' : 'left';
        var otherLen = other === 'left' ? st.left.length : st.right.length;
        var otherCap = other === 'left' ? capL : capR;
        if (otherLen < otherCap) {
          side = other;
          this.toast ? this.toast(T('side_full')) : null;
        } else {
          if (this.toast) this.toast(T('both_full'));
          E.audio.sfx('deny');
          return false;
        }
      }
      var at = this.slotPos(side, side === 'left' ? st.left.length : st.right.length);
      var rec = L.play(st, tileId, side);
      if (!rec) return false;
      var last = side === 'left' ? st.left[0] : st.right[st.right.length - 1];
      this.pops[rec.tile.id] = 0.24;
      this.floaters.push({ x: at.x, y: at.y, t: 0, life: 1.0, text: '+' + rec.pts, color: P.gold, size: Math.max(14, this.Lt.path.tileLen * 0.22) });
      if (rec.double) {
        this.floaters.push({ x: at.x, y: at.y - this.Lt.path.tileH * 0.8, t: 0, life: 1.3, text: T('double_tile'), color: '#8fd06a', size: Math.max(12, this.Lt.path.tileLen * 0.16) });
      }
      if (st.combo >= 3) {
        this.floaters.push({ x: at.x, y: at.y - this.Lt.path.tileH * 1.5, t: 0, life: 1.1, text: T('combo_n', { n: st.combo }), color: '#ffe08a', size: Math.max(11, this.Lt.path.tileLen * 0.15) });
      }
      if (rec.doubled) {
        this.floaters.push({ x: at.x, y: at.y + this.Lt.path.tileH * 0.9, t: 0, life: 1.2, text: '×2', color: '#fff', size: Math.max(12, this.Lt.path.tileLen * 0.18) });
      }
      var sp = this.slotPos(side, side === 'left' ? st.left.length : st.right.length);
      for (var i = 0; i < 8; i++) {
        var ang = st.rng.angle(), spd = 60 + st.rng.float() * 120;
        E.fx.spawn(at.x, at.y, { vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.35 + st.rng.float() * 0.3, size: 2 + st.rng.float() * 2, color: P.gold });
      }
      E.audio.sfx(rec.double ? 'wave' : 'click');
      this.pending = null;
      this.afterMove();
      return true;
    },
    drawTile: function () {
      var st = this.st;
      var res = L.draw(st);
      if (res === 'full') { this.toast = { t: 1.4, text: T('hand_full') }; E.audio.sfx('deny'); return; }
      if (res === 'empty') { this.toast = { t: 1.6, text: T('bazaar_empty') }; E.audio.sfx('deny'); return; }
      E.audio.sfx(res === 'over' ? 'deny' : 'tick');
      this.popBazaar = 0.28;
      this.afterMove();
    },
    afterMove: function () {
      this.syncCoins();
      if (this.st.hand.length !== this.lastHand) {
        this.lastHand = this.st.hand.length;
        this.layout(this.game);
      }
      this.endZones = this.computeEndZones();
      if (this.st.phase === 'win') { this.banner = { t: 1.6, text: T('win_title') }; this.onWin(this.game, false); }
      else if (this.st.phase === 'over') this.onLose(this.game, false);
      this.bannerT = 0;
    },
    tap: function (x, y) {
      var st = this.st;
      if (E.ui.handleTap(this.buttons, x, y)) return;
      if (st.phase !== 'play') return;

      // выбор конца для кости, подходящей к обоим
      if (this.pending != null) {
        var ez = this.endZones;
        if (Math.hypot(x - ez.left.x, y - ez.left.y) < ez.left.r * 1.35) { this.doPlay(this.pending, 'left'); return; }
        if (Math.hypot(x - ez.right.x, y - ez.right.y) < ez.right.r * 1.35) { this.doPlay(this.pending, 'right'); return; }
        var pi = this.handAt(x, y);
        if (pi >= 0 && st.hand[pi] && st.hand[pi].id === this.pending) { this.pending = null; E.audio.sfx('click'); return; }
        this.pending = null;
      }

      // базар
      var bz = this.Lt.bazaar;
      if (x >= bz.x - 4 && x <= bz.x + bz.w + 4 && y >= bz.y - 10 && y <= bz.y + bz.h + 10) { this.drawTile(); return; }

      var i = this.handAt(x, y);
      if (i < 0) return;
      var tile = st.hand[i];
      if (!tile) return;
      var s = L.sides(st, tile);
      if (!s.left && !s.right) {
        L.wrongTap(st, tile.id);
        E.audio.sfx('deny');
        E.fx.shake(7, 0.22);
        var hr = this.handRect(i);
        this.floaters.push({ x: hr.x + hr.w / 2, y: hr.y - 4, t: 0, life: 1.0, text: T('wrong_tap'), color: '#ff8a7a', size: 15 });
        this.pending = null;
        if (st.phase === 'over') this.onLose(this.game, false);
        return;
      }
      // спрашиваем сторону только если концы разные — иначе выбор бессмысленный
      if (s.left && s.right && st.ends.left !== st.ends.right) {
        this.pending = tile.id;
        this.pendT = 0;
        E.audio.sfx('tick');
        return;
      }
      this.doPlay(tile.id, s.left ? 'left' : 'right');
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = (E.capture && E.capture.params) || {};
      this.captureMode = true;
      this.st.recordSafe = true;
      this.st.coins = Math.max(640, this.st.coins);
      var mode = cp.mode;
      // немного ходов, чтобы стол был живым
      var pre = Math.round(this.st.goal * (0.42 + Math.min(0.30, this.level * 0.018)));
      L.simulate(this.st, pre);
      if (this.st.phase !== 'play') this.st.phase = 'play';
      // на кадре рука должна быть «живой» — хотя бы один подсвеченный ход
      for (var g2 = 0; g2 < 5 && this.st.stock.length && !L.playable(this.st).length; g2++) {
        this.st.hand.push(this.st.stock.shift());
      }
      this.st.hearts = this.st.heartsMax;
      this.lastHand = this.st.hand.length;
      this.layout(game);
      if (mode === 'shop') { this.openShop(game); this.buildShop(game); return; }
      if (mode === 'win') { this.st.phase = 'play'; this.onWin(game, true); return; }
      if (mode === 'over') { this.st.phase = 'over'; this.st.hearts = 0; this.onLose(game, true); return; }
      this.mode = 'running';
      E.sdk.gameplayStart();
      this.buildEnd(game);
    },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'over') { this.st.phase = 'over'; this.st.hearts = 0; this.mode = 'over'; this.buildEnd(game); }
      else if (s.mode === 'win') { this.st.phase = 'play'; this.onWin(game, true); }
      if (s.level) { this.level = clamp(s.level, 1, C.levels.length); }
    },
    getCaptureState: function () {
      return {
        scene: 'play',
        mode: this.mode,
        level: this.level,
        phase: this.st ? this.st.phase : '',
        placed: this.st ? this.st.placed : 0,
        goal: this.st ? this.st.goal : 0
      };
    },

    /* ---------- шаг ---------- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      var i;
      for (i = this.floaters.length - 1; i >= 0; i--) {
        this.floaters[i].t += dt;
        if (this.floaters[i].t > this.floaters[i].life) this.floaters.splice(i, 1);
      }
      for (var k in this.pops) { if (this.pops[k] > 0) this.pops[k] -= dt; }
      if (this.popBazaar > 0) this.popBazaar -= dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      if (this.selPulse > 0) this.selPulse -= dt;
      if (this.pendT != null) this.pendT += dt;

      var Ptr = E.input.pointer;

      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'paused') { this.setPaused(false, game); return; }
        if (this.mode === 'shop') { this.closeShop(game); return; }
        if (this.mode === 'running') { this.setPaused(true, game); return; }
      }

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (Ptr.pressed) E.ui.handleTap(this.endButtons, Ptr.x, Ptr.y);
        if (this.autopilot || this.captureMode) {
          if ((this.mode === 'win' || this.mode === 'over')) {
            this.autoT += dt;
            if (this.autoT > 1.3) {
              this.autoT = 0;
              if (this.mode === 'win') game.setScene('play', { level: Math.min(C.levels.length, this.level + 1) });
              else { this.st.phase = 'play'; game.setScene('play', { level: this.level }); }
            }
          }
        }
        return;
      }

      if (this.mode === 'shop') {
        if (Ptr.pressed) E.ui.handleTap(this.shopButtons, Ptr.x, Ptr.y);
        return;
      }

      if (this.autopilot) this.autoTick(dt);

      if (Ptr.pressed) this.tap(Ptr.x, Ptr.y);

      // туториал-подсказка вплывает и уходит
      if (this.st.phase !== 'play') {
        if (this.st.phase === 'win') this.onWin(game, false);
        else this.onLose(game, false);
      }
    },
    autoTick: function (dt) {
      var st = this.st;
      if (st.phase !== 'play') return;
      this.autoT += dt;
      if (this.autoT < 0.42) return;
      this.autoT = 0;
      var m = L.autoMove(st);
      if (m) this.doPlay(m.tileId, m.side);
      else this.drawTile();
    },

    /* ================= отрисовка ================= */
    draw: function (game, ctx) {
      var Lt = this.Lt, st = this.st;
      A.table(ctx, Lt.W, Lt.H, 13);
      A.cloth(ctx, Lt.boardRect.x, Lt.boardRect.y, Lt.boardRect.w, Lt.boardRect.h, 4);
      A.rope(ctx, Lt.path, 0.40);

      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawChain(ctx);
      ctx.restore();

      E.fx.draw(ctx);
      this.drawFloaters(ctx);
      this.drawHud(ctx);
      this.drawHand(ctx);
      if (this.pending != null) this.drawPending(ctx);
      this.drawToast(ctx);
      this.drawEnd(ctx);
      E.fx.drawFlash(ctx, Lt.W, Lt.H);
    },

    drawChain: function (ctx) {
      var Lt = this.Lt, st = this.st, path = Lt.path;
      var len = path.tileLen, th = path.tileH;
      // центральная кость
      var s0 = path.slots[path.startIdx];
      A.domino(ctx, s0.x, s0.y, len, st.start.innerL, st.start.innerR, s0.a, { shadow: true });
      // левая сторона: inner смотрит внутрь (по направлению пути к центру)
      for (var i = st.left.length - 1; i >= 0; i--) {
        var rec = st.left[i];
        var s = path.slots[path.startIdx - 1 - i];
        if (!s) continue;
        var pop = this.pops[rec.tile.id] || 0;
        var sc = pop > 0 ? 1 + easeOut(pop / 0.24) * 0.14 : 1;
        // +x локальной оси смотрит внутрь цепи, значит внутренняя половина — вторая (b)
        A.domino(ctx, s.x, s.y, len, rec.outer, rec.inner, s.a, { shadow: true, scale: sc, glow: rec.doubled });
      }
      // правая сторона: inner смотрит внутрь (против направления пути)
      for (var j = 0; j < st.right.length; j++) {
        var rc = st.right[j];
        var sr = path.slots[path.startIdx + 1 + j];
        if (!sr) continue;
        var pop2 = this.pops[rc.tile.id] || 0;
        var sc2 = pop2 > 0 ? 1 + easeOut(pop2 / 0.24) * 0.14 : 1;
        // справа +x локальной оси смотрит ОТ центра: внутренняя половина — первая (a)
        A.domino(ctx, sr.x, sr.y, len, rc.inner, rc.outer, sr.a, { shadow: true, scale: sc2, glow: rc.doubled });
      }
      // открытые концы: пульсирующие кружки с числом
      var ez = this.endZones;
      var pulse = 1 + Math.sin(this.t * 3.2) * 0.08;
      var self = this;
      function endMark(z, val, sideName, angle) {
        var rr = Math.max(11, th * 0.52) * pulse;
        if (z.full) {
          ctx.save(); ctx.globalAlpha = 0.35;
          A.pipMark(ctx, z.x, z.y, rr, val, sideName, angle);
          ctx.restore();
          ctx.save(); ctx.strokeStyle = 'rgba(224,90,79,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(z.x - rr * 0.55, z.y - rr * 0.55); ctx.lineTo(z.x + rr * 0.55, z.y + rr * 0.55);
          ctx.moveTo(z.x + rr * 0.55, z.y - rr * 0.55); ctx.lineTo(z.x - rr * 0.55, z.y + rr * 0.55);
          ctx.stroke(); ctx.restore();
        } else {
          A.pipMark(ctx, z.x, z.y, rr, val, sideName, angle);
        }
      }
      endMark(ez.left, st.ends.left, 'left', s0.a + Math.PI);
      endMark(ez.right, st.ends.right, 'right', s0.a);
    },

    drawPending: function (ctx) {
      var Lt = this.Lt, st = this.st, ez = this.endZones;
      var t = this.pendT || 0;
      var pul = 0.55 + Math.sin(t * 6) * 0.35;
      ctx.save();
      ctx.globalAlpha = pul;
      ctx.strokeStyle = '#fff6dd';
      ctx.lineWidth = 3;
      [ez.left, ez.right].forEach(function (z) {
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 1.25, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.restore();
      var path = Lt.path;
      var y = path.slots[path.startIdx].y - path.tileLen * 0.95;
      if (y < Lt.boardRect.y + 16) y = path.slots[path.startIdx].y + path.tileLen * 0.95;
      pill(ctx, Lt.W / 2 - 96, y - 15, 192, 30, 'rgba(20,12,5,0.9)', 'rgba(240,193,75,0.5)');
      E.ui.text(ctx, T('pick_end'), Lt.W / 2, y, 13, P.cream, 'center', 700);
      // подписи сторон у самих концов
      var fs = Math.max(10, Math.min(14, Lt.path.tileLen * 0.14));
      E.ui.text(ctx, T('left_end'), ez.left.x, ez.left.y + ez.left.r * 1.8, fs, P.gold, 'center', 700);
      E.ui.text(ctx, T('right_end'), ez.right.x, ez.right.y + ez.right.r * 1.8, fs, P.gold, 'center', 700);
    },

    drawHud: function (ctx) {
      var Lt = this.Lt, st = this.st;
      // левая зона: уровень + сердца
      pill(ctx, 10, Lt.pauseBtn.y, Lt.leftW, Lt.pauseBtn.h, 'rgba(20,12,5,0.62)', 'rgba(240,193,75,0.35)');
      E.ui.text(ctx, T('lvl_short', { n: st.level }), 10 + Lt.leftW / 2, Lt.pauseBtn.y + Lt.pauseBtn.h / 2 + 1,
        Math.min(15, Lt.leftW * 0.24), P.cream, 'center', 700);
      for (var i = 0; i < st.heartsMax; i++) {
        A.heart(ctx, Lt.hearts.x + i * Lt.hearts.gap, Lt.hearts.y, Lt.hearts.s, i < st.hearts);
      }
      // цель
      var gr = Lt.goalRect;
      var fr = clamp(st.placed / st.goal, 0, 1);
      pill(ctx, gr.x, gr.y, gr.w, gr.h, 'rgba(20,12,5,0.62)', 'rgba(240,193,75,0.35)');
      var innerW = Math.max(0, gr.w - 8);
      if (fr > 0) {
        E.ui.roundRect(ctx, gr.x + 4, gr.y + 4, Math.max(4, innerW * fr), gr.h - 8, (gr.h - 8) / 2);
        var gg = ctx.createLinearGradient(gr.x, gr.y, gr.x + gr.w, gr.y);
        gg.addColorStop(0, '#c0392b'); gg.addColorStop(1, P.gold);
        ctx.fillStyle = gg; ctx.fill();
      }
      E.ui.text(ctx, st.placed + '/' + st.goal, gr.x + gr.w / 2, gr.y + gr.h / 2 + 1,
        Math.min(15, gr.h * 0.52), P.cream, 'center', 800);
      // монеты
      var cr = Lt.coinsRect;
      pill(ctx, cr.x, cr.y, cr.w, cr.h, 'rgba(20,12,5,0.62)', 'rgba(240,193,75,0.35)');
      A.coin(ctx, cr.x + 16, cr.y + cr.h / 2, 8.6);
      E.ui.text(ctx, String(st.coins), cr.x + 28, cr.y + cr.h / 2 + 1, 14, P.gold, 'left', 700);
      E.ui.drawButtons(ctx, [Lt.pauseBtn]);

      // купленный «×2 на следующую кость» виден, пока не сработает
      if (st.doubled) {
        var dw = Math.min(186, Lt.W * 0.48);
        var dy = gr.y + gr.h + 5;
        pill(ctx, Lt.W / 2 - dw / 2, dy, dw, 22, 'rgba(240,193,75,0.94)', 'rgba(120,60,26,0.9)');
        E.ui.text(ctx, T('doubled_next'), Lt.W / 2, dy + 11, 11, '#3a2410', 'center', 800);
      }
    },

    drawHand: function (ctx) {
      var Lt = this.Lt, st = this.st;
      // деревянная полоса руки
      ctx.fillStyle = 'rgba(18,10,4,0.55)';
      ctx.fillRect(0, Lt.panelTop - 4, Lt.W, Lt.H - Lt.panelTop + 4);
      ctx.strokeStyle = 'rgba(240,193,75,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, Lt.panelTop - 4); ctx.lineTo(Lt.W, Lt.panelTop - 4); ctx.stroke();

      // базар
      var bz = Lt.bazaar;
      this.drawBazaar(ctx, bz);

      // подсказка новичку на первом уровне
      if (this.level === 1 && st.placed === 0 && !this.captureMode && this.mode === 'running') {
        var hy = Lt.panelTop - 18;
        var tw = Math.min(230, Lt.W * 0.62);
        pill(ctx, Lt.W / 2 - tw / 2, hy - 13, tw, 26, 'rgba(20,12,5,0.92)', 'rgba(240,193,75,0.6)');
        E.ui.text(ctx, T('tut_tap'), Lt.W / 2, hy, 12, P.gold, 'center', 700);
      }

      // рука
      for (var i = 0; i < st.hand.length; i++) {
        var t = st.hand[i];
        var r = this.handRect(i);
        var s = L.sides(st, t);
        var playable = (s.left || s.right) && this.mode === 'running' && st.phase === 'play';
        var sel = this.pending === t.id;
        A.domino(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w, t.a, t.b, 0, {
          shadow: true,
          dim: !playable && !sel,
          glow: playable || sel
        });
        if (playable && !sel) {
          // лёгкое покачивание — «эта подходит»
          var bob = Math.sin(this.t * 4 + i) * 1.2;
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = P.gold;
          E.ui.roundRect(ctx, r.x + 2, r.y + r.h + 2 + bob, r.w - 4, 3, 1.5);
          ctx.fill();
          ctx.restore();
        }
      }

      // магазин
      E.ui.drawButtons(ctx, [Lt.shopBtn]);
      // счётчик доборов рядом с базаром
      E.ui.text(ctx, '×' + st.draws, bz.x + bz.w / 2, bz.y + bz.h + 9, Math.max(11, bz.w * 0.20), P.gold, 'center', 800);
    },

    drawBazaar: function (ctx, bz) {
      var st = this.st;
      var blocked = L.blocked(st) && st.phase === 'play' && this.mode === 'running';
      var pulse = blocked ? (0.5 + Math.sin(this.t * 6) * 0.5) : 0;
      var pop = this.popBazaar > 0 ? this.popBazaar / 0.28 : 0;
      ctx.save();
      if (blocked) {
        ctx.shadowColor = 'rgba(240,193,75,' + (0.35 + pulse * 0.45) + ')';
        ctx.shadowBlur = 18;
      }
      var w = bz.w, h = bz.h;
      var len = Math.min(w * 0.95, h * 1.9);
      var stack = Math.min(4, Math.max(1, Math.ceil(st.stock.length / 6)));
      for (var i = stack - 1; i >= 0; i--) {
        A.back(ctx, bz.x + w / 2 + i * 2.5, bz.y + h * 0.5 - i * 4 - pop * 4, len, -0.06 + i * 0.02);
      }
      ctx.restore();
      // бейдж «Нет хода»
      if (blocked) {
        var ty = bz.y - 12;
        pill(ctx, bz.x + w / 2 - 74, ty - 13, 148, 26, 'rgba(20,12,5,0.92)', 'rgba(240,193,75,0.7)');
        E.ui.text(ctx, T('blocked_hint'), bz.x + w / 2, ty, 11, P.gold, 'center', 700);
      }
    },

    drawFloaters: function (ctx) {
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        var a = 1 - f.t / f.life;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = '800 ' + Math.round(f.size) + 'px system-ui, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,14,4,0.75)';
        ctx.strokeText(f.text, f.x, f.y - f.t * 30);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - f.t * 30);
      }
      ctx.globalAlpha = 1;
    },

    drawToast: function (ctx) {
      if (!this.toast) return;
      var Lt = this.Lt;
      ctx.globalAlpha = Math.min(1, this.toast.t * 2);
      var w = Math.min(260, Lt.W * 0.7);
      pill(ctx, Lt.W / 2 - w / 2, Lt.boardRect.y + Lt.boardRect.h * 0.5, w, 36, 'rgba(20,12,5,0.94)', 'rgba(240,193,75,0.5)');
      E.ui.text(ctx, this.toast.text, Lt.W / 2, Lt.boardRect.y + Lt.boardRect.h * 0.5 + 18, 13, P.cream, 'center', 600);
      ctx.globalAlpha = 1;
    },

    drawEnd: function (ctx) {
      if (this.mode === 'paused') this.drawPause(ctx);
      else if (this.mode === 'win') this.drawWin(ctx);
      else if (this.mode === 'over') this.drawOver(ctx);
      else if (this.mode === 'shop') this.drawShop(ctx);
    },
    _scrim: function (ctx, a) {
      ctx.fillStyle = 'rgba(10,5,2,' + a + ')';
      ctx.fillRect(0, 0, this.Lt.W, this.Lt.H);
    },
    _endPanel: function (ctx, top, bottom) {
      var W = this.Lt.W;
      var w = Math.min(W * 0.90, 400);
      var x = (W - w) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 8;
      card(ctx, x, top, w, bottom - top, 18, 'rgba(30,18,9,0.97)', 'rgba(240,193,75,0.45)', 2);
      ctx.restore();
      return { x: x, y: top, w: w, h: bottom - top };
    },
    _panelGeom: function (headH) {
      var Lt = this.Lt;
      var last = this.endButtons[this.endButtons.length - 1];
      var firstY = this.endButtons[0].y;
      var top = Math.max(Lt.boardRect.y + 6, firstY - headH);
      var bottom = last ? last.y + last.h + 16 : firstY + headH;
      return { top: top, bottom: Math.min(bottom, Lt.boardRect.y + Lt.boardRect.h) };
    },
    drawPause: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      this._scrim(ctx, 0.82);
      if (this.endButtons.length) {
        var gg = this._panelGeom(66);
        this._endPanel(ctx, gg.top, gg.bottom);
        lbl(ctx, T('paused'), W / 2, gg.top + 36, Math.min(W * 0.085, 34), P.gold, 'center', 800);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawWin: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      this._scrim(ctx, 0.84);
      if (this.endButtons.length) {
        var gg = this._panelGeom(152);
        var p = this._endPanel(ctx, gg.top, gg.bottom);
        lbl(ctx, T('win_title'), W / 2, gg.top + 32, Math.min(W * 0.088, 34), '#a8e07a', 'center', 800);
        var winLine = this.level >= C.levels.length ? T('all_done') : T('win_sub');
        var sub = E.ui.fit(ctx, winLine, p.w * 0.9, Math.min(W * 0.034, 14), 500);
        E.ui.text(ctx, winLine, W / 2, gg.top + 60, sub, 'rgba(242,227,194,0.75)', 'center', 500);
        E.ui.text(ctx, T('score_n', { n: this.st.score }), W / 2, gg.top + 86, 14, 'rgba(242,227,194,0.9)', 'center', 700);
        var rw = Math.min(232, p.w * 0.72);
        pill(ctx, W / 2 - rw / 2, gg.top + 102, rw, 34, 'rgba(10,5,2,0.9)', 'rgba(240,193,75,0.5)');
        A.coin(ctx, W / 2 - rw / 2 + 22, gg.top + 119, 9.5);
        E.ui.text(ctx, T('won_coins', { n: this.doubled ? this.reward * 2 : this.reward }), W / 2 + 12, gg.top + 120, 15, P.gold, 'center', 700);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawOver: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      this._scrim(ctx, 0.84);
      if (this.endButtons.length) {
        var gg = this._panelGeom(112);
        var p = this._endPanel(ctx, gg.top, gg.bottom);
        lbl(ctx, T('lose_title'), W / 2, gg.top + 34, Math.min(W * 0.085, 32), '#ff9a86', 'center', 800);
        var sub2 = E.ui.fit(ctx, T('lose_sub'), p.w * 0.9, Math.min(W * 0.034, 14), 500);
        E.ui.text(ctx, T('lose_sub'), W / 2, gg.top + 62, sub2, 'rgba(242,227,194,0.72)', 'center', 500);
        E.ui.text(ctx, T('score_n', { n: this.st.score }), W / 2, gg.top + 86, 14, P.gold, 'center', 700);
        E.ui.text(ctx, T('best_score', { n: Math.max(Meta.best(), this.st.score) }), W / 2, gg.top + 106, 11.5, 'rgba(242,227,194,0.62)', 'center', 600);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawShop: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      ctx.fillStyle = 'rgba(10,5,2,0.93)';
      ctx.fillRect(0, 0, W, Lt.H);
      var top = Lt.boardRect.y;
      lbl(ctx, T('shop_title'), W / 2, top + 24, Math.min(W * 0.062, 27), P.gold, 'center', 800);
      var hs = E.ui.fit(ctx, T('shop_hint'), W * 0.82, Math.min(W * 0.032, 13), 500);
      E.ui.text(ctx, T('shop_hint'), W / 2, top + 48, hs, 'rgba(242,227,194,0.62)', 'center', 500);
      pill(ctx, W / 2 - 64, top + 60, 128, 30, 'rgba(20,12,5,0.92)', 'rgba(240,193,75,0.45)');
      A.coin(ctx, W / 2 - 46, top + 75, 8.5);
      E.ui.text(ctx, String(this.st.coins), W / 2 + 6, top + 76, 15, P.gold, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
    }
  };

  /* маленькая метка открытого конца */
  A.pipMark = function (ctx, x, y, r, value, side, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
    g.addColorStop(0, '#fff7e2');
    g.addColorStop(1, '#e6cf9f');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.6, r * 0.14);
    ctx.strokeStyle = 'rgba(120,60,26,0.85)';
    ctx.stroke();
    ctx.fillStyle = P.pip || '#c0392b';
    var pts = [[0, 0]];
    var PIPS2 = {
      0: [], 1: [[0, 0]], 2: [[-0.5, -0.5], [0.5, 0.5]], 3: [[-0.55, -0.55], [0, 0], [0.55, 0.55]],
      4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
      5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
      6: [[-0.5, -0.55], [-0.5, 0], [-0.5, 0.55], [0.5, -0.55], [0.5, 0], [0.5, 0.55]]
    };
    pts = PIPS2[value] || [];
    var pr = Math.max(1.4, r * 0.16);
    for (var i = 0; i < pts.length; i++) {
      ctx.beginPath();
      ctx.arc(pts[i][0] * r * 1.05, pts[i][1] * r * 1.05, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  G.scenes = S;
})(window.GAME);
