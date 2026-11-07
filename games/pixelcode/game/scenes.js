/* game/scenes.js — «Пиксель-Код»: меню, выбор схемы, партия и оверлеи.
   Механика и генерация — в game/logic.js; здесь сессия, ввод, экономика,
   отрисовка, реклама и capture-хуки. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};
  var TOTAL = C.levels.length;

  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function bannerInset() { return (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0); }
  function portraitOf(v) { return v.h > v.w * 1.05; }

  /* ---------------- мета / сохранения ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.economy.startCoins; E.storage.set('coins', c); }
      return Math.max(0, c | 0);
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    addCoins: function (n) {
      var c = Math.max(0, Meta.coins() + Math.round(n));
      Meta.setCoins(c);
      return c;
    },
    level: function () { return clamp((E.storage.get('lvl', 1) | 0) || 1, 1, TOTAL); },
    setLevel: function (n) { E.storage.set('lvl', clamp(n | 0, 1, TOTAL)); },
    done: function () {
      var d = E.storage.get('done', null);
      return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
    },
    isDone: function (n) { return !!Meta.done()[n]; },
    markDone: function (n) { var d = Meta.done(); d[n] = 1; E.storage.set('done', d); },
    best: function () {
      var d = Meta.done(), m = 0;
      for (var k in d) { var n = +k; if (d[k] && n > m) m = n; }
      return m;
    },
    perfect: function () { return Math.max(0, E.storage.get('perf', 0) | 0); },
    addPerfect: function () { E.storage.set('perf', Meta.perfect() + 1); },
    perfects: function () {
      var p = E.storage.get('perfl', null);
      return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
    },
    markPerfect: function (n) { var p = Meta.perfects(); p[n] = 1; E.storage.set('perfl', p); },
    isPerfect: function (n) { return !!Meta.perfects()[n]; },
    shopUse: function () {
      var s = E.storage.get('shopn', null);
      return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
    },
    shopPrice: function (item) {
      var used = Meta.shopUse()[item.id] | 0;
      return item.base + item.step * Math.min(item.maxStep, used);
    },
    shopBought: function (id) {
      var s = Meta.shopUse();
      s[id] = (s[id] | 0) + 1;
      E.storage.set('shopn', s);
    }
  };

  /* ---------------- мелкие хелперы отрисовки ---------------- */
  function wrapText(ctx, str, maxW, size, weight) {
    ctx.font = (weight || 500) + ' ' + Math.round(size) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    var words = String(str).split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var tryLine = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(tryLine).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = tryLine;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function pillText(ctx, str, cx, cy, size, color) {
    ctx.font = '700 ' + Math.round(size) + 'px Consolas, "SFMono-Regular", "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, cx, cy + 1);
  }
  function dim(ctx, W, H, a) {
    ctx.fillStyle = 'rgba(5,3,12,' + a + ')';
    ctx.fillRect(0, 0, W, H);
  }
  function soundButton(x, y, w, h) {
    return new E.ui.Button({
      x: x, y: y, w: w, h: h, bg: 'rgba(16,10,30,0.9)', border: 'rgba(168,85,247,0.35)',
      icon: function (ctx, b) {
        var mm = E.audio.isMuted();
        ctx.font = '700 ' + Math.round(b.h * 0.42) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = mm ? P.dim : P.cyanHi;
        ctx.fillText(mm ? '♪̸' : '♪', b.x + b.w / 2, b.y + b.h / 2 + 1);
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
      this.game = game;
      this.t = 0;
      this.help = false;
      this.levelSel = false;
      this.toast = null;
      this.levelRects = [];
      this.levelButtons = [];
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      E.fx.reset();
      this._lay(game.view);
      this._build(game);
    },
    onResize: function (game) { this._lay(game.view); this._build(game); },

    _lay: function (v) {
      var W = v.w, H = v.h, banner = bannerInset();
      var portrait = portraitOf(v);
      var logo = Math.min(W * (portrait ? 0.34 : 0.20), H * (portrait ? 0.14 : 0.19));
      var logoY = H * (portrait ? 0.15 : 0.17);
      var titleY = H * (portrait ? 0.26 : 0.33);
      var titleSize = Math.min(W * (portrait ? 0.135 : 0.072), H * (portrait ? 0.060 : 0.13));
      var subY = titleY + titleSize * 0.62 + Math.min(W * 0.042, 18) * 0.5 + 12;
      var top = Math.max(subY + 18, H * (portrait ? 0.36 : 0.44));
      var availH = (H - banner) - top - 54;
      var bh = clamp((availH - 16) / 3, 38, 54);
      var bw = Math.min(320, W * 0.78);
      return {
        W: W, H: H, banner: banner, portrait: portrait,
        logo: logo, logoY: logoY,
        titleY: titleY, titleSize: titleSize, subY: subY,
        bw: bw, bh: bh, b0: top, gap: 8
      };
    },

    _build: function (game) {
      var M = this._lay(game.view), W = M.W, that = this;
      var bx = (W - M.bw) / 2;
      var list = [];
      list.push(new E.ui.Button({
        x: bx, y: M.b0, w: M.bw, h: M.bh, text: T('play'),
        bg: '#3b1178', border: P.cyan, fg: P.cyanHi, fontSize: Math.round(M.bh * 0.36),
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: Meta.level() }); }
      }));
      list.push(new E.ui.Button({
        x: bx, y: M.b0 + M.bh + M.gap, w: M.bw, h: M.bh * 0.88, text: T('level_sel'),
        bg: 'rgba(18,10,36,0.9)', border: 'rgba(168,85,247,0.45)', fg: P.text,
        fontSize: Math.round(M.bh * 0.30),
        onTap: function () { E.audio.sfx('click'); that.levelSel = true; that._buildLevels(game); }
      }));
      // реклама за монеты
      var rvH = M.bh;
      list.push(new E.ui.Button({
        x: bx, y: M.b0 + M.bh * 1.88 + M.gap * 2, w: M.bw, h: rvH,
        bg: 'rgba(18,10,36,0.86)', border: 'rgba(94,234,212,0.42)', fg: P.text,
        icon: function (ctx, b) {
          var mid = b.y + b.h / 2;
          A.coin(ctx, b.x + 22, mid, Math.min(11, b.h * 0.22));
          E.ui.text(ctx, T('coins_n', { n: C.economy.rewardedCoins }), b.x + 40, mid - 7, Math.min(14, b.h * 0.28), P.gold, 'left', 700);
          E.ui.text(ctx, T('coins_ad'), b.x + 40, mid + 9, Math.min(11, b.h * 0.22), P.dim, 'left', 500);
          ctx.fillStyle = 'rgba(94,234,212,0.9)';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w - 22, b.y + b.h / 2 - 6);
          ctx.lineTo(b.x + b.w - 12, b.y + b.h / 2);
          ctx.lineTo(b.x + b.w - 22, b.y + b.h / 2 + 6);
          ctx.closePath(); ctx.fill();
        },
        onTap: function () { that._rewardCoins(); }
      }));
      var sz = 44;
      list.push(new E.ui.Button({
        x: W - sz - 10, y: 10, w: sz, h: sz, text: '?', fontSize: 19,
        bg: 'rgba(16,10,30,0.9)', border: 'rgba(168,85,247,0.35)', fg: P.cyanHi,
        onTap: function () { E.audio.sfx('click'); that.help = true; }
      }));
      list.push(soundButton(W - sz * 2 - 16, 10, sz, sz));
      this.buttons = list;
    },

    _rewardCoins: function () {
      var that = this;
      E.sdk.showRewarded({
        onReward: function () {
          Meta.addCoins(C.economy.rewardedCoins);
          E.audio.sfx('coin');
          that.toast = { t: 1.8, text: T('coins_n', { n: C.economy.rewardedCoins }) };
        },
        onDone: function (ok) {
          if (!ok) { E.audio.sfx('deny'); that.toast = { t: 1.8, text: T('ad_fail') }; }
        }
      });
    },

    _levelsGeom: function (v) {
      var W = v.w, H = v.h, banner = bannerInset();
      var cols = v.h > v.w * 1.05 ? 4 : 6;
      var gap = 9;
      var panelW = Math.min(W - 24, cols * 90 + 32);
      var innerW = panelW - 40;
      var cell = Math.min((innerW - (cols - 1) * gap) / cols, (H - banner) * 0.155, 82);
      var rows = Math.ceil(TOTAL / cols);
      var gridW = cols * cell + (cols - 1) * gap;
      var gridH = rows * cell + (rows - 1) * gap;
      var panelH = gridH + 128;
      var px = (W - panelW) / 2;
      var py = clamp(((H - banner) - panelH) / 2, 8, H - panelH - 8);
      return { cols: cols, gap: gap, cell: cell, rows: rows, gridW: gridW, gridH: gridH,
        panelW: panelW, panelH: panelH, px: px, py: py, gx: px + 20, gy: py + 66 };
    },

    _buildLevels: function (game) {
      var v = game.view, Q = this._levelsGeom(v), that = this;
      this.levelRects = [];
      this.levelButtons = [];
      for (var i = 0; i < TOTAL; i++) {
        var r = Math.floor(i / Q.cols), c = i % Q.cols;
        this.levelRects.push({
          x: Q.gx + c * (Q.cell + Q.gap), y: Q.gy + r * (Q.cell + Q.gap),
          w: Q.cell, h: Q.cell, n: i + 1,
          locked: (i + 1) > Meta.level(),
          done: Meta.isDone(i + 1),
          perfect: Meta.isPerfect(i + 1)
        });
      }
      var bm = bannerInset();
      this.levelButtons.push(new E.ui.Button({
        x: game.view.w / 2 - 80, y: Math.min(Q.py + Q.panelH - 56, game.view.h - bm - 60),
        w: 160, h: 44, text: T('back'),
        bg: 'rgba(18,10,36,0.95)', border: 'rgba(168,85,247,0.45)', fg: P.text, fontSize: 17,
        onTap: function () { E.audio.sfx('click'); that.levelSel = false; }
      }));
    },

    _drawLevels: function (ctx, v) {
      var Q = this._levelsGeom(v), W = v.w, H = v.h;
      dim(ctx, W, H, 0.78);
      var panel = { x: Q.px, y: Q.py, w: Q.panelW, h: Q.panelH };
      E.ui.roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 16);
      ctx.fillStyle = '#160d2c'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(168,85,247,0.45)'; ctx.stroke();
      E.ui.text(ctx, T('level_sel_title'), W / 2, Q.py + 32, Math.min(W * 0.06, 24), P.cyanHi, 'center', 800);
      for (var i = 0; i < this.levelRects.length; i++) {
        var r = this.levelRects[i], tint = C.levels[i].tint;
        E.ui.roundRect(ctx, r.x, r.y, r.w, r.h, 10);
        if (r.locked) {
          ctx.fillStyle = 'rgba(30,20,52,0.9)'; ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(143,130,201,0.25)'; ctx.stroke();
          A.shopIcon(ctx, 'lock', r.x + r.w / 2, r.y + r.h / 2, r.w * 0.44, 'rgba(143,130,201,0.5)');
        } else {
          ctx.fillStyle = r.done ? 'rgba(34,211,238,0.12)' : 'rgba(59,17,120,0.55)'; ctx.fill();
          ctx.lineWidth = 1.6; ctx.strokeStyle = r.done ? tint : 'rgba(168,85,247,0.6)'; ctx.stroke();
          E.ui.text(ctx, String(r.n), r.x + r.w / 2, r.y + r.h / 2, Math.round(r.h * 0.4), P.text, 'center', 800);
          if (r.done) A.shopIcon(ctx, 'check', r.x + r.w - 11, r.y + 11, 13, tint);
          if (r.done && r.perfect) E.ui.text(ctx, '★', r.x + 11, r.y + 12, 14, P.gold, 'center', 700);
        }
      }
      E.ui.drawButtons(ctx, this.levelButtons);
    },

    _drawHelp: function (ctx, v) {
      var W = v.w, H = v.h, banner = bannerInset();
      dim(ctx, W, H, 0.82);
      var pw = Math.min(W - 28, 430), ph = Math.min((H - banner) - 40, 380);
      var px = (W - pw) / 2, py = ((H - banner) - ph) / 2;
      E.ui.roundRect(ctx, px, py, pw, ph, 16);
      ctx.fillStyle = '#160d2c'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(168,85,247,0.5)'; ctx.stroke();
      E.ui.text(ctx, T('rules_title'), W / 2, py + 30, Math.min(W * 0.062, 24), P.cyanHi, 'center', 800);
      var size = Math.min(W * 0.036, 15);
      var y = py + 60;
      var ruleKeys = ['rules_1', 'rules_2', 'rules_3', 'rules_4'];
      for (var i = 0; i < ruleKeys.length; i++) {
        var lines = wrapText(ctx, T(ruleKeys[i]), pw - 40, size, 500);
        for (var k = 0; k < lines.length; k++) {
          E.ui.text(ctx, lines[k], px + 20, y, size, 'rgba(239,234,255,0.85)', 'left', 500);
          y += size * 1.45;
        }
        y += 6;
      }
      var bh = 44, by = py + ph - bh - 14;
      var btn = this._helpBtn || (this._helpBtn = new E.ui.Button({
        x: 0, y: 0, w: 0, h: 0, text: T('close'),
        bg: '#3b1178', border: P.cyan, fg: P.cyanHi, fontSize: 17,
        onTap: function () { E.audio.sfx('click'); S.menu.help = false; }
      }));
      btn.x = W / 2 - Math.min(160, pw * 0.5) / 2;
      btn.y = by;
      btn.w = Math.min(160, pw * 0.5);
      btn.h = bh;
      E.ui.drawButtons(ctx, [btn]);
    },

    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      var Ptr = E.input.pointer;
      if (this.levelSel) {
        if (E.input.wasPressed('Escape')) { this.levelSel = false; return; }
        if (Ptr.pressed) {
          if (E.ui.handleTap(this.levelButtons, Ptr.x, Ptr.y)) return;
          for (var i = 0; i < this.levelRects.length; i++) {
            var r = this.levelRects[i];
            if (Ptr.x >= r.x && Ptr.x <= r.x + r.w && Ptr.y >= r.y && Ptr.y <= r.y + r.h) {
              if (r.locked) {
                E.audio.sfx('deny');
                this.toast = { t: 1.6, text: T('locked') };
                return;
              }
              E.audio.sfx('click');
              this.levelSel = false;
              game.setScene('play', { level: r.n });
              return;
            }
          }
        }
        return;
      }
      if (this.help) {
        if (Ptr.pressed) {
          var b = this._helpBtn;
          if (b && Ptr.x >= b.x && Ptr.x <= b.x + b.w && Ptr.y >= b.y && Ptr.y <= b.y + b.h) E.ui.handleTap([b], Ptr.x, Ptr.y);
          else { E.audio.sfx('click'); this.help = false; }
        }
        if (E.input.wasPressed('Escape')) this.help = false;
        return;
      }
      if (Ptr.pressed) E.ui.handleTap(this.buttons, Ptr.x, Ptr.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) {
        game.setScene('play', { level: Meta.level() });
      }
    },

    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h, M = this._lay(v);
      A.bg(ctx, W, H, this.t, P.cyan);
      A.logoMark(ctx, W / 2, M.logoY, M.logo, this.t, P.cyan);

      var ts = E.ui.fit(ctx, T('title'), W * 0.9, M.titleSize, 800);
      ctx.save();
      ctx.shadowColor = 'rgba(168,85,247,0.85)';
      ctx.shadowBlur = ts * 0.4;
      var tg = ctx.createLinearGradient(0, M.titleY - ts * 0.5, 0, M.titleY + ts * 0.5);
      tg.addColorStop(0, '#ffffff');
      tg.addColorStop(0.5, '#ede9fe');
      tg.addColorStop(1, '#a5f3fc');
      ctx.font = '800 ' + Math.round(ts) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = tg;
      ctx.fillText(T('title'), W / 2, M.titleY);
      ctx.restore();
      E.ui.text(ctx, T('subtitle'), W / 2, M.subY, Math.min(W * 0.042, 18), 'rgba(196,181,253,0.8)', 'center', 500);

      // монеты
      var cbw = 100, cbh = 32;
      A.pill(ctx, 12, 12, cbw, cbh, 'rgba(12,7,24,0.72)', 'rgba(255,209,102,0.32)');
      A.coin(ctx, 30, 12 + cbh / 2, 10);
      E.ui.text(ctx, String(Meta.coins()), 46, 12 + cbh / 2 + 1, 16, P.gold, 'left', 700);

      E.ui.drawButtons(ctx, this.buttons);

      var py = H - M.banner - 46;
      E.ui.text(ctx, T('progress_n', { n: Meta.level(), total: TOTAL }) + ' · ' + T('perfect_n', { n: Meta.perfect() }),
        W / 2, py, Math.min(W * 0.034, 14), 'rgba(196,181,253,0.6)', 'center', 600);
      E.ui.text(ctx, T('menu_tip'), W / 2, py + 20, Math.min(W * 0.032, 13), 'rgba(196,181,253,0.4)', 'center', 500);

      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        A.pill(ctx, W / 2 - 110, H * 0.88, 220, 36, 'rgba(10,6,20,0.94)', 'rgba(168,85,247,0.45)');
        E.ui.text(ctx, this.toast.text, W / 2, H * 0.88 + 18, 13, P.text, 'center', 600);
        ctx.globalAlpha = 1;
      }
      if (this.levelSel) this._drawLevels(ctx, v);
      if (this.help) this._drawHelp(ctx, v);
    },

    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================ ПАРТИЯ */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      this.captureMode = !!(E.capture && E.capture.active);
      this.recordSafe = this.autopilot || this.captureMode;
      // первый interstitial — не раньше 60 с от старта сессии (правило площадки)
      if (!E.sdk._lastInterstitial) E.sdk._lastInterstitial = Date.now();
      var lv = parseInt(params.level != null ? params.level : (cp.wave != null ? cp.wave : Meta.level()), 10);
      this.level = clamp(lv || 1, 1, TOTAL);
      var def = C.levels[this.level - 1];
      this.tint = def.tint;
      this.puzzle = L.makePuzzle(def.size, def.seed, C.genTries, E.Rng);
      this.st = L.newState(this.puzzle, C.mistakes, 0);
      L.syncLines(this.st);              // нулевые строки сразу помечаются крестиками
      this.paint = 'fill';
      this.mode = 'running';
      this.t = 0;
      this.autoT = 0;
      this.advT = 0;
      this.autoGap = 0.20;
      this.cellAnim = {};
      this.linePulse = {};
      this.toast = null;
      this.result = null;
      this.reward = 0;
      this.doubled = false;
      this.reviveUsed = false;
      this.madeMistakes = 0;
      this.tipT = (this.level === 1 && !this.captureMode && !this.autopilot && !E.storage.get('tip', 0)) ? 6 : 0;
      this.endButtons = [];
      this.shopButtons = [];
      this.shopCards = [];
      this.panelButtons = [];
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this.layout(game);
      this.buildPanel(game);
      this.buildEnd(game);
      this.buildShop(game);
      if (this.captureMode) this.applyCapture(game);
    },

    exit: function () {
      E.sdk.gameplayStop();
    },

    onResize: function (game) {
      this.layout(game);
      this.buildPanel(game);
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.buildEnd(game);
      if (this.mode === 'shop') this.buildShop(game);
    },

    onBack: function (game) {
      if (this.mode === 'running') this.setPaused(true, game);
      else if (this.mode === 'shop') { this.mode = 'running'; this.buildPanel(game); }
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h, n = this.puzzle.n;
      var banner = bannerInset();
      var portrait = portraitOf(v);
      var hudH = portrait ? 56 : 44;
      var barH = portrait ? 64 : 56;
      var clueW = portrait ? clamp(W * 0.17, 44, 72) : clamp(W * 0.075, 42, 62);
      var clueFont = portrait ? 13 : 12;
      var clueH = clueFont * 3 + (portrait ? 10 : 8);
      var top = hudH + 4;
      var bottom = H - banner - barH - 4;
      var availW = W - 20 - clueW;
      var availH = Math.max(40, bottom - top - clueH - 4);
      var cell = Math.floor(Math.min(availW / n, availH / n));
      cell = Math.max(8, Math.min(cell, 46));
      var boardW = cell * n, boardH = cell * n;
      var blockW = clueW + boardW, blockH = clueH + boardH;
      var ox = (W - blockW) / 2;
      var oy = top + Math.max(0, (bottom - top - blockH) / 2);
      var bx = ox + clueW, by = oy + clueH;
      clueFont = clamp(Math.round(cell * 0.56), 12, 17);
      clueH = clueFont * 3 + (portrait ? 10 : 8);

      this.L = {
        W: W, H: H, banner: banner, portrait: portrait, hudH: hudH, barH: barH,
        clueW: clueW, clueH: clueH, clueFont: clueFont,
        cell: cell, bx: bx, by: by, boardW: boardW, boardH: boardH, n: n
      };
      this.bx = bx; this.by = by; this.boardW = boardW; this.boardH = boardH;
      this.boardX = bx; this.boardY = by;

      var sz = 44;
      this.pauseBtn = new E.ui.Button({
        x: W - sz - 10, y: 8, w: sz, h: sz, id: 'pause',
        bg: 'rgba(12,7,24,0.8)', border: 'rgba(168,85,247,0.4)',
        icon: function (ctx, b) { A.shopIcon(ctx, 'pause', b.x + b.w / 2, b.y + b.h / 2, b.w * 0.6, P.cyanHi); },
        onTap: function () { E.audio.sfx('click'); S.play.setPaused(true, game); }
      });
      this.buttons = [this.pauseBtn];
    },

    buildPanel: function (game) {
      if (!this.L) { this.panelButtons = []; return; }
      var Lg = this.L, W = Lg.W, H = Lg.H, self = this;
      var bw = Lg.portrait ? W - 20 : Math.min(W - 20, 560);
      var x0 = (W - bw) / 2;
      var y = H - Lg.banner - Lg.barH + 8;
      var bh = Math.min(46, Lg.barH - 12);
      var shopW = clamp(bw * 0.32, 96, 160);
      var modeW = bw - shopW - 8;
      var segW = modeW / 2;
      var list = [];
      list.push(new E.ui.Button({
        x: x0, y: y, w: segW - 2, h: bh, text: T('mode_fill'),
        bg: this.paint === 'fill' ? '#3b1178' : 'rgba(16,10,30,0.92)',
        border: this.paint === 'fill' ? P.cyan : 'rgba(168,85,247,0.3)',
        fg: this.paint === 'fill' ? P.cyanHi : P.dim,
        fontSize: Math.min(16, bh * 0.36),
        onTap: function () { E.audio.sfx('click'); self.paint = 'fill'; self.buildPanel(game); }
      }));
      list.push(new E.ui.Button({
        x: x0 + segW + 2, y: y, w: segW - 2, h: bh, text: T('mode_cross'),
        bg: this.paint === 'cross' ? '#3b1178' : 'rgba(16,10,30,0.92)',
        border: this.paint === 'cross' ? P.cyan : 'rgba(168,85,247,0.3)',
        fg: this.paint === 'cross' ? P.cyanHi : P.dim,
        fontSize: Math.min(16, bh * 0.36),
        onTap: function () { E.audio.sfx('click'); self.paint = 'cross'; self.buildPanel(game); }
      }));
      list.push(new E.ui.Button({
        x: x0 + modeW + 8, y: y, w: shopW, h: bh,
        bg: 'rgba(18,10,36,0.94)', border: 'rgba(94,234,212,0.5)',
        icon: function (ctx, b) {
          A.shopIcon(ctx, 'shop', b.x + 18, b.y + b.h / 2, Math.min(20, b.h * 0.44), P.ok);
          E.ui.text(ctx, T('shop'), b.x + 32, b.y + b.h / 2 + 1, Math.min(15, b.h * 0.34), P.text, 'left', 700);
        },
        onTap: function () { E.audio.sfx('click'); self.openShop(game); }
      }));
      this.panelButtons = list;
    },

    /* ---------- оверлеи исхода / паузы ---------- */
    _endDefs: function (game) {
      var self = this, defs = [];
      var last = this.level >= TOTAL;
      if (this.mode === 'paused') {
        defs.push({ text: T('pause_resume'), bg: '#3b1178', border: P.cyan, fg: P.cyanHi, fn: function () { E.audio.sfx('click'); self.setPaused(false, game); } });
        defs.push({ text: T('pause_restart'), bg: 'rgba(24,14,46,0.96)', border: 'rgba(168,85,247,0.45)', fg: P.text, fn: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); } });
        defs.push({
          text: E.audio.isMuted() ? T('sound_off') : T('sound_on'), bg: 'rgba(16,10,30,0.94)', border: 'rgba(168,85,247,0.3)', fg: P.dim, small: true,
          fn: function (b) {
            var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m);
            b.text = m ? T('sound_off') : T('sound_on');
          }
        });
        defs.push({ text: T('pause_menu'), bg: 'rgba(16,10,30,0.94)', border: 'rgba(168,85,247,0.3)', fg: P.dim, fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      } else if (this.mode === 'win') {
        defs.push({ text: last ? T('to_menu') : T('next_level'), bg: '#3b1178', border: P.cyan, fg: P.cyanHi, fn: function () { E.audio.sfx('click'); self.leaveWin(game); } });
        if (!this.captureMode && !this.autopilot && !this.doubled) {
          defs.push({
            text: T('double_reward'), bg: 'rgba(24,14,46,0.96)', border: 'rgba(255,209,102,0.6)', fg: P.gold, small: true,
            fn: function () {
              E.sdk.showRewarded({
                onReward: function () { self.doubled = true; Meta.addCoins(self.reward); E.audio.sfx('coin'); self.buildEnd(game); },
                onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.setToast(T('ad_fail')); } }
              });
            }
          });
        }
        defs.push({ text: T('to_menu'), bg: 'rgba(16,10,30,0.94)', border: 'rgba(168,85,247,0.3)', fg: P.dim, small: true, fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.autopilot && !this.reviveUsed) {
          defs.push({
            text: T('second_chance'), bg: 'rgba(59,17,120,0.96)', border: 'rgba(255,209,102,0.65)', fg: P.text,
            fn: function () {
              E.sdk.showRewarded({
                onReward: function () {
                  self.reviveUsed = true;
                  L.revive(self.st);
                  self.mode = 'running';
                  self.result = null;
                  E.sdk.gameplayStart();
                  E.audio.sfx('revive');
                  self.buildPanel(game);
                  self.buildEnd(game);
                  self.setToast(T('life_done'));
                },
                onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.setToast(T('ad_fail')); } }
              });
            }
          });
        }
        defs.push({ text: T('retry'), bg: '#3b1178', border: P.cyan, fg: P.cyanHi, fn: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); } });
        defs.push({ text: T('to_menu'), bg: 'rgba(16,10,30,0.94)', border: 'rgba(168,85,247,0.3)', fg: P.dim, fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      }
      return defs;
    },

    buildEnd: function (game) {
      if (!this.L) { this.endButtons = []; return; }
      var defs = this._endDefs(game);
      var W = this.L.W, H = this.L.H, banner = this.L.banner;
      var bh = Math.min(50, Math.max(42, H * 0.072));
      var gap = 8;
      var bw = Math.min(300, W * 0.76);
      var n = defs.length;
      var stackH = n * bh + Math.max(0, n - 1) * gap;
      var titleH = this.mode === 'win' ? 132 : (this.mode === 'over' ? 92 : 78);
      var panelH = Math.min((H - banner) - 16, stackH + titleH + 20);
      var panelW = Math.min(W - 24, bw + 44);
      // победа: панель снизу, чтобы собранный образ остался виден; остальное — по центру
      var py = this.mode === 'win'
        ? Math.max(8, (H - banner) - panelH - 8)
        : Math.max(8, ((H - banner) - panelH) / 2);
      var y0 = py + titleH;
      var x = W / 2 - bw / 2;
      var list = [];
      for (var i = 0; i < n; i++) {
        var d = defs[i];
        list.push(new E.ui.Button({
          x: x, y: y0 + i * (bh + gap), w: bw, h: bh, text: d.text,
          bg: d.bg, border: d.border, fg: d.fg,
          fontSize: d.small ? Math.round(bh * 0.32) : Math.round(bh * 0.36),
          onTap: d.fn
        }));
      }
      this.endButtons = list;
      this.endPanel = { x: W / 2 - panelW / 2, y: py, w: panelW, h: panelH };
    },

    setPaused: function (on, game) {
      game = game || this.game;
      if (on && this.mode === 'running') {
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildEnd(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = 'running';
        this.result = null;
        E.sdk.gameplayStart();
        this.buildEnd(game);
      }
    },

    onWin: function (game, capture) {
      if (this.result) return;
      this.mode = 'win';
      this.result = { win: true };
      var perfect = this.madeMistakes === 0;
      var base = C.economy.levelReward + (this.level - 1) * C.economy.levelStep;
      var reward = base + (perfect ? C.economy.perfectBonus : 0);
      if (capture) { this.reward = reward; this.perfect = perfect; }
      else {
        this.reward = reward;
        this.perfect = perfect;
        Meta.addCoins(reward);
        Meta.markDone(this.level);
        Meta.setLevel(Math.max(Meta.level(), Math.min(TOTAL, this.level + 1)));
        if (perfect) { Meta.addPerfect(); Meta.markPerfect(this.level); }
      }
      E.audio.sfx('win');
      E.sdk.gameplayStop();
      this.buildPanel(game);
      this.buildEnd(game);
      // неоновые брызги вокруг поля
      var Lg = this.L;
      for (var i = 0; i < 26; i++) {
        E.fx.spawn(Lg.bx + (this.puzzle.n * Lg.cell) * (0.15 + 0.7 * (i / 26)),
          Lg.by + (this.puzzle.n * Lg.cell) * (0.2 + 0.6 * (this.puzzle.n % 2)),
          { vx: (i % 2 ? 1 : -1) * (20 + i * 3), vy: -60 - i * 4, life: 0.8, size: 2 + (i % 3), color: i % 2 ? this.tint : P.violetHi });
      }
    },

    onLose: function (game) {
      if (this.result) return;
      this.mode = 'over';
      this.result = { win: false };
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      this.buildPanel(game);
      this.buildEnd(game);
    },

    leaveWin: function (game) {
      if (this.level >= TOTAL) { game.setScene('menu', {}); return; }
      var self = this;
      var next = this.level + 1;
      var needAd = !this.captureMode && !this.autopilot && (this.level % C.ads.interstitialEvery === 0);
      if (needAd) E.sdk.showInterstitial(function () { game.setScene('play', { level: next }); });
      else game.setScene('play', { level: next });
    },

    setToast: function (text) { this.toast = { t: 1.9, text: text }; },

    coinsNow: function () { return this.capCoins != null ? this.capCoins : Meta.coins(); },

    /* ---------- лавка ---------- */
    openShop: function (game) {
      game = game || this.game;
      if (this.mode !== 'running' && this.mode !== 'paused') return;
      this.mode = 'shop';
      this.buildShop(game);
    },

    buildShop: function (game) {
      if (!this.L) { this.shopButtons = []; this.shopCards = []; return; }
      var Lg = this.L, W = Lg.W, H = Lg.H, banner = Lg.banner, self = this;
      var portrait = Lg.portrait;
      var pw = Math.min(W - 24, portrait ? 430 : W - 60);
      var titleH = 56, closeH = 44;
      var cardH, ph;
      if (portrait) {
        cardH = clamp(Math.round(H * 0.085), 74, 96);
        ph = titleH + C.shop.length * cardH + (C.shop.length - 1) * 8 + closeH + 30;
      } else {
        cardH = clamp(Math.round(H * 0.42), 108, 168);
        ph = titleH + cardH + closeH + 30;
      }
      ph = Math.min(ph, (H - banner) - 16);
      var px = (W - pw) / 2, py = Math.max(8, ((H - banner) - ph) / 2);
      this.shopPanel = { x: px, y: py, w: pw, h: ph };
      var list = [], i, cw;
      this.shopCards = [];
      if (portrait) {
        cw = pw - 28;
        for (i = 0; i < C.shop.length; i++) {
          this.shopCards.push({ item: C.shop[i], x: px + 14, y: py + titleH + i * (cardH + 8), w: cw, h: cardH, portrait: true });
        }
      } else {
        var n = C.shop.length, gap = 10;
        cw = (pw - 28 - (n - 1) * gap) / n;
        for (i = 0; i < n; i++) {
          this.shopCards.push({ item: C.shop[i], x: px + 14 + i * (cw + gap), y: py + titleH, w: cw, h: cardH, portrait: false });
        }
      }
      var coinsNow = this.coinsNow();
      for (i = 0; i < this.shopCards.length; i++) {
        (function (card) {
          var item = card.item;
          var price = Meta.shopPrice(item);
          var canPay = coinsNow >= price && !(item.id === 'eraser' && self.st.wrong === 0);
          var bh = 40, btnW;
          var bgOn = canPay ? '#3b1178' : 'rgba(30,20,52,0.95)';
          var bdOn = canPay ? P.cyan : 'rgba(143,130,201,0.35)';
          if (card.portrait) {
            btnW = Math.min(128, Math.max(92, card.w * 0.28));
            card.btnW = btnW;
            list.push(new E.ui.Button({
              x: card.x + card.w - btnW - 10, y: card.y + card.h / 2 - bh / 2, w: btnW, h: bh,
              bg: bgOn, border: bdOn, enabled: canPay,
              icon: function (ctx, b) {
                A.coin(ctx, b.x + 18, b.y + b.h / 2, 8);
                E.ui.text(ctx, String(price), b.x + 32, b.y + b.h / 2 + 1, 15, canPay ? P.gold : P.dim, 'left', 700);
              },
              onTap: function () { self.buy(item, game); }
            }));
          } else {
            btnW = card.w - 20;
            card.btnW = btnW;
            list.push(new E.ui.Button({
              x: card.x + 10, y: card.y + card.h - bh - 10, w: btnW, h: bh,
              bg: bgOn, border: bdOn, enabled: canPay,
              icon: function (ctx, b) {
                A.coin(ctx, b.x + b.w / 2 - 26, b.y + b.h / 2, 8);
                E.ui.text(ctx, String(price), b.x + b.w / 2 - 8, b.y + b.h / 2 + 1, 15, canPay ? P.gold : P.dim, 'left', 700);
              },
              onTap: function () { self.buy(item, game); }
            }));
          }
        })(this.shopCards[i]);
      }
      list.push(new E.ui.Button({
        x: W / 2 - 80, y: py + ph - closeH - 10, w: 160, h: closeH, text: T('close'),
        bg: 'rgba(24,14,46,0.98)', border: 'rgba(168,85,247,0.45)', fg: P.text, fontSize: 17,
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
      this.shopButtons = list;
    },

    closeShop: function (game) {
      this.mode = 'running';
      this.buildPanel(game);
      this.buildEnd(game);
    },

    buy: function (item, game) {
      if (this.mode !== 'shop') return;
      var price = Meta.shopPrice(item);
      if (Meta.coins() < price) { this.setToast(T('not_enough')); E.audio.sfx('deny'); return; }
      if (item.id === 'eraser' && this.st.wrong === 0) { this.setToast(T('nothing_wrong')); E.audio.sfx('deny'); return; }
      Meta.addCoins(-price);
      Meta.shopBought(item.id);
      E.audio.sfx('buy');
      if (item.id === 'hint') {
        var h = L.hintLine(this.st, this.puzzle ? new E.Rng(this.level * 7919 + this.st.hints) : null);
        if (h) {
          this.setToast(h.kind === 'row' ? T('hint_row', { n: h.idx + 1 }) : T('hint_col', { n: h.idx + 1 }));
          this.pulseLines(h.lines || []);
          for (var i = 0; i < h.cells.length; i++) this.cellAnim[h.cells[i]] = 0.3;
        }
      } else if (item.id === 'eraser') {
        var erased = L.eraseWrong(this.st);
        this.setToast(T('erase_done', { n: erased }));
      } else if (item.id === 'life') {
        L.addLife(this.st);
        this.setToast(T('life_done'));
      }
      this.buildShop(game);
      this.buildPanel(game);
      if (this.st.solved) this.onWin(game, this.captureMode);
    },

    /* ---------- ввод по полю ---------- */
    cellAt: function (x, y) {
      var Lg = this.L;
      if (x < Lg.bx || y < Lg.by) return -1;
      var c = Math.floor((x - Lg.bx) / Lg.cell);
      var r = Math.floor((y - Lg.by) / Lg.cell);
      if (r < 0 || c < 0 || r >= Lg.n || c >= Lg.n) return -1;
      return r * Lg.n + c;
    },

    tapCell: function (i, game) {
      if (i < 0) return;
      var r = L.tap(this.st, i, this.paint);
      if (!r.changed) return;
      this.cellAnim[i] = 0.32;
      if (this.tipT > 0) { this.tipT = 0; E.storage.set('tip', 1); }
      if (r.mistake) {
        this.madeMistakes++;
        E.audio.sfx('hit');
        E.fx.flash(P.bad, 0.12);
        E.fx.shake(3, 0.16);
      } else {
        E.audio.sfx('tick');
      }
      if (r.lines.length) { this.pulseLines(r.lines); E.audio.sfx('coin'); }
      if (r.outOfLives) { this.onLose(game); return; }
      if (r.solved) this.onWin(game, false);
    },

    pulseLines: function (lines) {
      for (var i = 0; i < lines.length; i++) {
        var key = (lines[i].kind === 'row' ? 'r' : 'c') + lines[i].idx;
        this.linePulse[key] = 0.5;
      }
    },

    /* ---------- автопилот ---------- */
    autoTick: function (dt) {
      if (this.st.solved) return;
      this.autoT += dt;
      var guard = 0;
      while (this.autoT >= this.autoGap && guard < 6) {
        this.autoT -= this.autoGap;
        guard++;
        var i = L.nextSolutionCell(this.st);
        if (i < 0) break;
        var r = L.tap(this.st, i, 'fill');
        this.cellAnim[i] = 0.30;
        if (r.lines.length) this.pulseLines(r.lines);
        if (r.solved) { this.onWin(this.game, true); return; }
      }
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.captureMode = true;
      this.recordSafe = true;
      if (cp.coins != null) {
        var cc = parseInt(cp.coins, 10);
        if (isFinite(cc)) this.capCoins = Math.max(0, cc);
      }
      var mode = cp.mode;
      if (mode === 'win') {
        L.revealAll(this.st);
        this.madeMistakes = 0;
        this.onWin(game, true);
      } else if (mode === 'over') {
        L.preSolve(this.st, 0.55);
        var empties = [];
        for (var i = 0; i < this.st.cells.length && empties.length < 3; i++) {
          if (!this.puzzle.cells[i] && this.st.cells[i] === 0) empties.push(i);
        }
        for (var k = 0; k < empties.length; k++) this.st.cells[empties[k]] = L.WRONG;
        this.st.wrong = empties.length;
        this.st.mistakes = 0;
        this.mode = 'over';
        this.result = { win: false };
        this.madeMistakes = 3;
      } else if (mode === 'shop') {
        L.preSolve(this.st, 0.45);
        this.mode = 'shop';
      } else {
        var frac = cp.t != null ? clamp(parseFloat(cp.t) / 20, 0.15, 0.92) : 0.5;
        L.preSolve(this.st, frac);
        this.mode = 'running';
      }
      this.layout(game);
      this.buildPanel(game);
      this.buildEnd(game);
      this.buildShop(game);
    },

    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'over') {
        this.st.mistakes = 0;
        this.mode = 'over';
        this.result = { win: false };
        this.buildEnd(game);
      } else if (s.mode === 'win') {
        L.revealAll(this.st);
        this.onWin(game, true);
      }
    },

    getCaptureState: function () {
      return { scene: 'play', mode: this.mode, level: this.level };
    },

    /* ---------- шаг ---------- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      var key, i;

      for (key in this.cellAnim) {
        this.cellAnim[key] -= dt * 3;
        if (this.cellAnim[key] <= 0) delete this.cellAnim[key];
      }
      for (key in this.linePulse) {
        this.linePulse[key] -= dt * 2;
        if (this.linePulse[key] <= 0) delete this.linePulse[key];
      }
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.tipT > 0) { this.tipT -= dt; if (this.tipT <= 0) E.storage.set('tip', 1); }

      var Ptr = E.input.pointer;

      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'paused') { this.setPaused(false, game); return; }
        if (this.mode === 'running') { this.setPaused(true, game); return; }
        if (this.mode === 'shop') { this.closeShop(game); return; }
      }

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (Ptr.pressed) E.ui.handleTap(this.endButtons, Ptr.x, Ptr.y);
        if (this.autopilot && this.mode !== 'paused') {
          this.advT += dt;
          if (this.advT > 2.0) {
            this.advT = 0;
            game.setScene('play', { level: this.level >= TOTAL ? 1 : this.level + 1 });
          }
        }
        return;
      }

      if (this.mode === 'shop') {
        if (Ptr.pressed) E.ui.handleTap(this.shopButtons, Ptr.x, Ptr.y);
        return;
      }

      // running
      if (this.autopilot) { this.autoTick(dt); if (this.mode !== 'running') return; }
      if (this.tipT > 0) {
        // подсказка не мешает: просто висит под полем
      }
      if (Ptr.pressed) {
        if (E.ui.handleTap(this.buttons, Ptr.x, Ptr.y)) return;
        if (E.ui.handleTap(this.panelButtons, Ptr.x, Ptr.y)) return;
        var idx = this.cellAt(Ptr.x, Ptr.y);
        if (idx >= 0) this.tapCell(idx, game);
      }
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var Lg = this.L, W = Lg.W, H = Lg.H;
      A.bg(ctx, W, H, this.t, this.tint);
      this.drawBoard(ctx);
      this.drawHud(ctx);
      E.ui.drawButtons(ctx, this.buttons);
      E.ui.drawButtons(ctx, this.panelButtons);
      if (this.tipT > 0 && this.mode === 'running') {
        var ty = Math.min(H - Lg.banner - Lg.barH - 12, Lg.by + Lg.boardH + 18);
        A.pill(ctx, W / 2 - Math.min(180, W * 0.46), ty, Math.min(360, W * 0.92), 30, 'rgba(10,6,20,0.9)', 'rgba(34,211,238,0.4)');
        E.ui.text(ctx, T('menu_tip'), W / 2, ty + 15, 12, P.cyanHi, 'center', 600);
      }
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        var tw = Math.min(W - 32, 300);
        A.pill(ctx, W / 2 - tw / 2, Lg.by + Lg.boardH + 16, tw, 34, 'rgba(10,6,20,0.94)', 'rgba(168,85,247,0.5)');
        E.ui.text(ctx, this.toast.text, W / 2, Lg.by + Lg.boardH + 33, 13, P.text, 'center', 600);
        ctx.globalAlpha = 1;
      }
      A.scanlines(ctx, W, H, 0.45);
      if (this.mode === 'paused') this.drawPause(ctx);
      else if (this.mode === 'win') this.drawWin(ctx);
      else if (this.mode === 'over') this.drawOver(ctx);
      else if (this.mode === 'shop') this.drawShop(ctx);
    },

    drawHud: function (ctx) {
      var Lg = this.L, W = Lg.W;
      E.ui.text(ctx, T('level_n', { n: this.level, total: TOTAL }), 12, 17, 12, P.cyanHi, 'left', 700);
      // жизни-сердца
      var max = Math.min(this.st.maxMistakes, 5), hs = 15, hx = 12;
      for (var i = 0; i < max; i++) {
        A.heart(ctx, hx + i * (hs + 3) + hs / 2, 39, hs, i < this.st.mistakes);
      }
      if (this.st.maxMistakes > 5) {
        E.ui.text(ctx, '+' + (this.st.maxMistakes - 5), hx + max * (hs + 3) + 8, 39, 12, P.dim, 'left', 700);
      }
      // монеты
      var pw = 96, ph = 30;
      var px = W - 12 - 44 - 8 - pw;
      A.pill(ctx, px, 13, pw, ph, 'rgba(12,7,24,0.75)', 'rgba(255,209,102,0.3)');
      A.coin(ctx, px + 17, 13 + ph / 2, 9);
      E.ui.text(ctx, String(this.coinsNow()), px + 31, 13 + ph / 2 + 1, 15, P.gold, 'left', 700);
    },

    drawBoard: function (ctx) {
      var Lg = this.L, n = Lg.n, cell = Lg.cell, bx = Lg.bx, by = Lg.by, cf = Lg.clueFont;
      A.boardBg(ctx, bx, by, cell, n, this.tint);

      var r, c, i, v;
      var numH = cf * 0.98;
      var gapW = cf * 0.30;
      function numW(val, size) { return Math.max(1, String(val).length) * size * 0.62; }
      // подсказки строк справа налево от поля
      for (r = 0; r < n; r++) {
        var rc = this.puzzle.rows[r], sum = 0, filledRow = 0;
        for (i = 0; i < n; i++) { if (this.st.cells[r * n + i] === 1 || this.st.cells[r * n + i] === 3) filledRow++; }
        for (i = 0; i < rc.length; i++) sum += rc[i];
        var over = filledRow > sum;
        var done = this.st.rowDone[r];
        var cy = by + r * cell + cell / 2;
        if (!rc.length) {
          A.clue(ctx, 0, bx - 8 - numW(0, cf) / 2, cy, cf, done ? 'done' : 'normal');
        } else {
          var tw = (rc.length - 1) * gapW, k;
          for (k = 0; k < rc.length; k++) tw += numW(rc[k], cf);
          var cx0 = bx - 8 - tw;
          for (k = 0; k < rc.length; k++) {
            var w0 = numW(rc[k], cf);
            A.clue(ctx, rc[k], cx0 + w0 / 2, cy, cf, over ? 'over' : (done ? 'done' : 'normal'));
            cx0 += w0 + gapW;
          }
        }
        if (this.linePulse['r' + r]) {
          ctx.globalAlpha = this.linePulse['r' + r];
          ctx.fillStyle = this.tint;
          ctx.fillRect(bx, by + r * cell, cell * n, cell);
          ctx.globalAlpha = 1;
        }
      }
      // подсказки столбцов снизу вверх от поля
      for (c = 0; c < n; c++) {
        var cc = this.puzzle.cols[c], sumC = 0, filledCol = 0;
        for (i = 0; i < n; i++) { if (this.st.cells[i * n + c] === 1 || this.st.cells[i * n + c] === 3) filledCol++; }
        for (i = 0; i < cc.length; i++) sumC += cc[i];
        var overC = filledCol > sumC;
        var doneC = this.st.colDone[c];
        var cx = bx + c * cell + cell / 2;
        if (!cc.length) A.clue(ctx, 0, cx, by - 8 - numH / 2, cf, doneC ? 'done' : 'normal');
        for (i = 0; i < cc.length; i++) {
          var segY = by - 8 - (cc.length - 1 - i) * numH - numH / 2;
          A.clue(ctx, cc[i], cx, segY, cf, overC ? 'over' : (doneC ? 'done' : 'normal'));
        }
        if (this.linePulse['c' + c]) {
          ctx.globalAlpha = this.linePulse['c' + c];
          ctx.fillStyle = this.tint;
          ctx.fillRect(bx + c * cell, by, cell, cell * n);
          ctx.globalAlpha = 1;
        }
      }

      for (r = 0; r < n; r++) {
        for (c = 0; c < n; c++) {
          v = r * n + c;
          A.cell(ctx, bx + c * cell, by + r * cell, cell, this.st.cells[v], this.tint, this.cellAnim[v] || 0);
        }
      }
      // рамка поля
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(34,211,238,0.32)';
      ctx.strokeRect(bx - 0.5, by - 0.5, cell * n + 1, cell * n + 1);

      if (this.mode === 'win') {
        var scanY = by + (cell * n) * (0.5 + 0.5 * Math.sin(this.t * 1.4));
        var g = ctx.createLinearGradient(0, scanY - cell, 0, scanY + cell);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(165,243,252,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx, scanY - cell, cell * n, cell * 2);
      }
      E.fx.draw(ctx);
    },

    drawPanelCard: function (ctx, alpha) {
      var p = this.endPanel;
      if (!p) return;
      dim(ctx, this.L.W, this.L.H, alpha);
      E.ui.roundRect(ctx, p.x, p.y, p.w, p.h, 16);
      ctx.fillStyle = '#160d2c'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(168,85,247,0.5)'; ctx.stroke();
    },

    drawPause: function (ctx) {
      var p = this.endPanel, W = this.L.W;
      this.drawPanelCard(ctx, 0.72);
      if (!p) return;
      E.ui.text(ctx, T('pause'), W / 2, p.y + 30, Math.min(W * 0.075, 24), P.cyanHi, 'center', 800);
      E.ui.drawButtons(ctx, this.endButtons);
    },

    drawWin: function (ctx) {
      var Lg = this.L, W = Lg.W, p = this.endPanel;
      this.drawPanelCard(ctx, 0.55);
      if (!p) { E.ui.drawButtons(ctx, this.endButtons); return; }
      var last = this.level >= TOTAL;
      var ts = Math.min(W * 0.072, 26);
      ctx.save();
      ctx.shadowColor = this.tint;
      ctx.shadowBlur = 18;
      E.ui.text(ctx, last ? T('final_title') : T('win_title'), W / 2, p.y + 34, ts, this.tint, 'center', 800);
      ctx.restore();
      var subSize = Math.min(W * 0.038, 15);
      var subY = p.y + 34 + ts * 0.62 + 12;
      E.ui.text(ctx, last ? T('final_sub') : T('win_sub', { n: this.level, total: TOTAL }),
        W / 2, subY, subSize, 'rgba(196,181,253,0.85)', 'center', 500);
      var y = subY + subSize * 0.6 + 20;
      if (this.perfect) {
        E.ui.text(ctx, T('win_perfect'), W / 2, y, 13, P.gold, 'center', 700);
        y += 22;
      }
      if (!this.perfect) y += 4;
      var reward = this.doubled ? this.reward * 2 : this.reward;
      var label = T('win_coins', { n: reward });
      ctx.font = '700 16px system-ui, sans-serif';
      var tw = ctx.measureText(label).width;
      A.coin(ctx, W / 2 - tw / 2 - 6, y, 10);
      E.ui.text(ctx, label, W / 2 - tw / 2 + 10, y + 1, 16, P.gold, 'left', 700);
      E.ui.drawButtons(ctx, this.endButtons);
    },

    drawOver: function (ctx) {
      var Lg = this.L, W = Lg.W, p = this.endPanel;
      this.drawPanelCard(ctx, 0.78);
      if (!p) { E.ui.drawButtons(ctx, this.endButtons); return; }
      var ts = Math.min(W * 0.066, 24);
      E.ui.text(ctx, T('over_title'), W / 2, p.y + 34, ts, P.bad, 'center', 800);
      E.ui.text(ctx, T('over_sub'), W / 2, p.y + 34 + ts * 0.62 + 12, Math.min(W * 0.038, 14), 'rgba(196,181,253,0.8)', 'center', 500);
      E.ui.drawButtons(ctx, this.endButtons);
    },

    drawShop: function (ctx) {
      var Lg = this.L, W = Lg.W, H = Lg.H, p = this.shopPanel;
      dim(ctx, W, H, 0.88);
      if (!p) { E.ui.drawButtons(ctx, this.shopButtons); return; }
      E.ui.roundRect(ctx, p.x, p.y, p.w, p.h, 16);
      ctx.fillStyle = '#160d2c'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(94,234,212,0.45)'; ctx.stroke();
      E.ui.text(ctx, T('shop_title'), p.x + 20, p.y + 28, Math.min(W * 0.062, 22), P.cyanHi, 'left', 800);
      var cw = 100;
      A.pill(ctx, p.x + p.w - cw - 12, p.y + 12, cw, 30, 'rgba(12,7,24,0.8)', 'rgba(255,209,102,0.32)');
      A.coin(ctx, p.x + p.w - cw + 4, p.y + 12 + 15, 8);
      E.ui.text(ctx, String(this.coinsNow()), p.x + p.w - cw + 16, p.y + 12 + 15, 14, P.gold, 'left', 700);

      for (var i = 0; i < this.shopCards.length; i++) {
        var card = this.shopCards[i], item = card.item;
        E.ui.roundRect(ctx, card.x, card.y, card.w, card.h, 12);
        ctx.fillStyle = 'rgba(34,20,64,0.95)'; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(168,85,247,0.35)'; ctx.stroke();
        var tint = item.id === 'life' ? P.bad : (item.id === 'eraser' ? P.violetHi : P.cyanHi);
        if (card.portrait) {
          A.shopIcon(ctx, item.id, card.x + 30, card.y + card.h / 2, Math.min(30, card.h * 0.34), tint);
          E.ui.text(ctx, T(item.name), card.x + 54, card.y + card.h * 0.30, Math.min(16, card.h * 0.19), P.text, 'left', 700);
          var maxW = Math.max(40, card.w - 54 - (card.btnW || 100) - 18);
          var dsz = Math.min(12, card.h * 0.14);
          var descLines = wrapText(ctx, T(item.desc), maxW, dsz, 500);
          for (var k = 0; k < descLines.length && k < 2; k++) {
            E.ui.text(ctx, descLines[k], card.x + 54, card.y + card.h * 0.58 + k * 14, dsz, 'rgba(196,181,253,0.75)', 'left', 500);
          }
        } else {
          A.shopIcon(ctx, item.id, card.x + card.w / 2, card.y + card.h * 0.22, Math.min(38, card.h * 0.2), tint);
          E.ui.text(ctx, T(item.name), card.x + card.w / 2, card.y + card.h * 0.45, Math.min(17, card.h * 0.12), P.text, 'center', 700);
          var dsz2 = Math.min(12, card.h * 0.075);
          var dl = wrapText(ctx, T(item.desc), card.w - 20, dsz2, 500);
          for (var j = 0; j < dl.length && j < 3; j++) {
            E.ui.text(ctx, dl[j], card.x + card.w / 2, card.y + card.h * 0.60 + j * 14, dsz2, 'rgba(196,181,253,0.75)', 'center', 500);
          }
        }
      }
      E.ui.drawButtons(ctx, this.shopButtons);
    }
  };

  G.scenes = S;
})(window.GAME);
