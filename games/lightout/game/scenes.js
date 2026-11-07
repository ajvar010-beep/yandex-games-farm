/* game/scenes.js — «Свет-Плитки»: меню, поле, магазин, пауза и итоги.
   Вся механика — в game/logic.js; здесь сессия, ввод, экономика, отрисовка и реклама. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};
  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------------- мета / сохранения ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.economy.startCoins; E.storage.set('coins', c); }
      return c | 0;
    },
    addCoins: function (n) {
      var c = Math.max(0, Meta.coins() + (n | 0));
      E.storage.set('coins', c);
      return c;
    },
    level: function () { return clamp(E.storage.get('lvl', 0) | 0, 0, C.levels.length - 1); },
    setLevel: function (n) { E.storage.set('lvl', clamp(n | 0, 0, C.levels.length - 1)); },
    best: function () { return clamp(E.storage.get('best', 0) | 0, 0, C.levels.length); },
    setBest: function (n) { E.storage.set('best', clamp(n | 0, 0, C.levels.length)); },
    runs: function () { return E.storage.get('runs', 0) | 0; },
    bumpRuns: function () { E.storage.set('runs', (Meta.runs() + 1) | 0); },
    charges: function () {
      var c = E.storage.get('charges', null);
      return (c && typeof c === 'object' && !Array.isArray(c)) ? c : {};
    },
    count: function (id) { return Meta.charges()[id] | 0; },
    bought: function (id) {
      var b = E.storage.get('bought', null);
      b = (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
      return b[id] | 0;
    },
    addBought: function (id) {
      var b = E.storage.get('bought', null);
      b = (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
      b[id] = (b[id] | 0) + 1;
      E.storage.set('bought', b);
    },
    addCharge: function (id, n) {
      var c = Meta.charges();
      c[id] = (c[id] | 0) + (n | 0);
      E.storage.set('charges', c);
    },
    useCharge: function (id) {
      var c = Meta.charges();
      if (!(c[id] > 0)) return false;
      c[id]--;
      E.storage.set('charges', c);
      return true;
    }
  };

  // Явные литералы ключей: статический чекер release-check ищет их в коде,
  // а не собирает из строк.
  var SHOP_NAME = { hint: 'shop_hint', undo: 'shop_undo', move: 'shop_move' };
  var SHOP_DESC = { hint: 'shop_hint_desc', undo: 'shop_undo_desc', move: 'shop_move_desc' };
  var SHOP_TOAST = { hint: 'bought_hint', undo: 'bought_undo', move: 'bought_move' };
  var SHOP_GLYPH = { hint: 'hint', undo: 'undo', move: 'move' };

  function shopItem(id) {
    for (var i = 0; i < C.shop.length; i++) if (C.shop[i].id === id) return C.shop[i];
    return null;
  }
  function priceOf(id, st) {
    var it = shopItem(id);
    if (!it) return 0;
    // цена растёт от числа ПОКУПОК, а не от остатка зарядов
    var n = Meta.bought(id);
    // потолок 3x базовой цены: рост не превращает бустер в недоступный
    return Math.min(it.price + it.step * n, it.price * 3);
  }

  /* ---------------- мелкая графика ---------------- */
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function panelBox(ctx, x, y, w, h) {
    var r = Math.min(w, h) * 0.055;
    E.ui.roundRect(ctx, x, y, w, h, r);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(13,21,38,0.97)');
    g.addColorStop(1, 'rgba(6,10,19,0.98)');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(63,227,255,0.45)';
    ctx.stroke();
  }
  function scrim(ctx, W, H, a) {
    ctx.fillStyle = 'rgba(3,6,12,' + a.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  function glowText(ctx, str, x, y, size, color, align, weight, blur, glow) {
    ctx.save();
    ctx.shadowColor = glow || 'rgba(63,227,255,0.7)';
    ctx.shadowBlur = blur == null ? size * 0.5 : blur;
    E.ui.text(ctx, str, x, y, size, color, align, weight);
    ctx.restore();
  }
  function wrapText(ctx, text, x, y, maxW, size, color, lh, weight) {
    ctx.font = (weight || 500) + ' ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    var words = String(text).split(' ');
    var line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    for (var k = 0; k < lines.length; k++) E.ui.text(ctx, lines[k], x, y + k * lh, size, color, 'center', weight || 500);
    return lines.length;
  }
  function coinBadge(ctx, x, y) {
    var h = 34, w = 94;
    pill(ctx, x, y, w, h, 'rgba(6,11,20,0.78)', 'rgba(247,201,92,0.35)');
    A.coin(ctx, x + 18, y + h / 2, 9.5);
    E.ui.text(ctx, String(Meta.coins()), x + 33, y + h / 2 + 1, 16, P.gold, 'left', 700);
    return w;
  }
  function soundButton(x, y, s) {
    return new E.ui.Button({
      x: x, y: y, w: s, h: s, bg: 'rgba(6,11,20,0.78)', border: 'rgba(63,227,255,0.32)',
      icon: function (ctx, b) {
        var mm = E.audio.isMuted();
        E.ui.text(ctx, mm ? '♪̸' : '♪', b.x + b.w / 2, b.y + b.h / 2 + 1, Math.round(b.h * 0.42), mm ? P.dim : P.neonSoft, 'center', 700);
      },
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
  }

  /* ================= МЕНЮ ================= */
  S.menu = {
    name: 'menu',
    enter: function (game) {
      this.game = game; this.t = 0; this.help = false;
      E.audio.music('menu');
      E.sdk.showBanner();
      E.sdk.gameplayStop();
      this.build(game);
    },
    onResize: function (game) { this.build(game); },
    lay: function (v) {
      var W = v.w, H = v.h;
      var compact = H < 560 && W > H * 1.2;
      var pad = clamp(Math.min(W, H) * 0.03, 8, 18);
      var mark = compact ? 0 : Math.min(W * 0.34, H * 0.24, 150);
      var titleSize = compact ? Math.min(W * 0.065, 40) : Math.min(W * 0.13, H * 0.085, 62);
      var titleY = compact ? H * 0.17 : H * 0.40;
      var subY = titleY + (compact ? 26 : Math.max(22, titleSize * 0.52));
      var bw = compact ? Math.min(W * 0.28, 240) : Math.min(W * 0.66, 320);
      var bh = compact ? 48 : Math.max(48, Math.min(58, H * 0.08));
      var y0 = compact ? H * 0.33 : H * 0.55;
      return { W: W, H: H, compact: compact, pad: pad, mark: mark, titleSize: titleSize,
               titleY: titleY, subY: subY, bw: bw, bh: bh, y0: y0 };
    },
    build: function (game) {
      var v = game.view, W = v.w;
      var M = this.lay(v), that = this;
      this.buttons = [];
      var label = Meta.level() > 0 ? T('continue') : T('play');
      this.buttons.push(new E.ui.Button({
        x: M.compact ? W / 2 - M.bw - 8 : W / 2 - M.bw / 2, y: M.y0,
        w: M.bw, h: M.bh, text: label,
        bg: 'rgba(11,44,64,0.95)', border: P.neon, fg: '#dffbff', fontSize: Math.round(M.bh * 0.34),
        onTap: function () { E.audio.sfx('click'); that.goto('play', {}); }
      }));
      this.buttons.push(new E.ui.Button({
        x: M.compact ? W / 2 + 8 : W / 2 - M.bw / 2, y: M.compact ? M.y0 : M.y0 + M.bh + 12,
        w: M.compact ? Math.min(160, W * 0.19) : M.bw, h: M.compact ? M.bh : Math.round(M.bh * 0.82),
        text: T('rules'), bg: 'rgba(8,16,28,0.78)', border: 'rgba(63,227,255,0.42)',
        fg: P.cream, fontSize: Math.round((M.compact ? M.bh : M.bh * 0.82) * 0.31),
        onTap: function () { E.audio.sfx('click'); that.help = true; }
      }));
      this.buttons.push(soundButton(W - M.pad - 44, M.pad + 2, 44));
      this.helpBtn = this.buttons[2];
    },
    goto: function (name, params) {
      this.game.setScene(name, params);
    },
    update: function (game, dt) {
      this.t += dt;
      var ptr = E.input.pointer;
      if (this.help) {
        if (ptr.pressed || E.input.wasPressed('Escape')) { this.help = false; E.audio.sfx('click'); }
        return;
      }
      if (ptr.pressed) E.ui.handleTap(this.buttons, ptr.x, ptr.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) this.goto('play', {});
      if (E.input.wasPressed('Escape') && this.help) this.help = false;
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h, M = this.lay(v);
      A.city(ctx, W, H, this.t, 1);
      var t = Math.min(1, this.t * 1.6);

      if (!M.compact) {
        var bob = Math.sin(this.t * 1.6) * 5;
        ctx.save();
        ctx.globalAlpha = t;
        // подсветка под эмблемой
        var g = ctx.createRadialGradient(W / 2, M.titleY - M.mark * 0.9, 6, W / 2, M.titleY - M.mark * 0.9, M.mark * 1.25);
        g.addColorStop(0, 'rgba(63,227,255,0.20)');
        g.addColorStop(1, 'rgba(63,227,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.translate(0, bob);
        A.mark(ctx, W / 2, M.titleY - M.mark * 0.92, M.mark, this.t);
        ctx.restore();
      }

      glowText(ctx, T('title').toUpperCase(), W / 2, M.titleY, M.titleSize, P.cream, 'center', 800, M.titleSize * 0.55, 'rgba(63,227,255,0.55)');
      E.ui.text(ctx, T('subtitle'), W / 2, M.subY, clamp(W * 0.036, 12, 17), 'rgba(220,240,255,0.72)', 'center', 500);

      coinBadge(ctx, M.pad, M.pad + 2);

      ctx.save();
      ctx.globalAlpha = t;
      E.ui.drawButtons(ctx, this.buttons);
      ctx.restore();

      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var lv = Meta.level();
      E.ui.text(ctx, T('level_n', { n: lv + 1, total: C.levels.length }), W / 2,
        M.compact ? H - 44 - banM : M.y0 + M.bh * 2 + 34, clamp(W * 0.032, 12, 14), P.neonSoft, 'center', 600);
      E.ui.text(ctx, T('tap_hint'), W / 2, H - 22 - banM, clamp(W * 0.03, 12, 13), 'rgba(200,225,245,0.45)', 'center', 500);
      if (Meta.best() > 0) {
        E.ui.text(ctx, T('best_n', { n: Meta.best() }), W / 2, H - 40 - banM - 20,
          clamp(W * 0.03, 12, 13), 'rgba(247,201,92,0.55)', 'center', 500);
      }

      if (this.help) this.drawHelp(ctx, v);
    },
    drawHelp: function (ctx, v) {
      var W = v.w, H = v.h;
      scrim(ctx, W, H, 0.88);
      var pw = Math.min(440, W * 0.88), ph = Math.min(H * 0.82, 400);
      var px = (W - pw) / 2, py = (H - ph) / 2;
      panelBox(ctx, px, py, pw, ph);
      glowText(ctx, T('rules_title'), W / 2, py + 42, Math.min(W * 0.07, 28), P.neonSoft, 'center', 800, 18);
      var size = clamp(W * 0.037, 12, 15);
      var y = py + 92;
      var lines = [T('rules_1'), T('rules_2'), T('rules_3'), T('rules_4')];
      for (var i = 0; i < lines.length; i++) {
        var n = wrapText(ctx, lines[i], W / 2, y, pw - 56, size, P.cream, size * 1.45, 500);
        y += n * size * 1.45 + 12;
      }
      E.ui.text(ctx, T('back'), W / 2, py + ph - 30, 14, 'rgba(220,240,255,0.55)', 'center', 600);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================= ПОЛЕ ================= */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,
    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.captureMode = !!(E.capture && E.capture.active);

      var lv = Meta.level();
      if (params.level != null) lv = (params.level | 0) - 1;
      else if (cp.wave != null) lv = (cp.wave | 0) - 1;
      this.level = clamp(lv, 0, C.levels.length - 1);

      var seed = params.seed;
      if (seed == null && E.capture && E.capture.seed != null) seed = E.capture.seed;
      // кадры съёмки без seed детерминированы по уровню — одинаковое поле в
      // альбомном и портретном кадре, повторяемые скриншоты
      if (seed == null) seed = this.captureMode ? (9001 + this.level * 7919) : (Date.now() % 1000000);
      this.seed = seed;
      var seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      this.st = L.newGame(new E.Rng((seedNum ^ Math.imul(this.level + 1, 2654435761)) >>> 0), this.level);

      this.mode = 'running';
      this.result = null;
      this.reward = 0;
      this.doubled = false;
      this.continueUsed = false;
      this.auto = !!(E.capture && (E.capture.autoplay || E.capture.record > 0));
      this.autoT = 0;
      this.autoRestart = 0;
      this.t = 0;
      this.winT = 0;
      this.shakeT = 0;
      this.toastMsg = null;
      this.toastT = 0;
      this.anim = {};
      this.ripples = [];
      this.endButtons = [];
      this.buttons = [];
      this.pauseBtn = null;
      this.pausePrev = 'running';
      this.autoDone = false;
      this.lastSolLen = this.st.sol.length;

      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this.layout(game);
      this.syncHud(game);
      this.buildEnd(game);

      if (this.captureMode) this.applyCapture(game);
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      this.syncHud(game);
      if (this.mode !== 'running') this.buildEnd(game);
    },
    onBack: function (game) {
      if (this.mode === 'running' || this.mode === 'shop') this.setPaused(true, game);
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var n = this.st.n;
      var banner = 0;
      try { banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0; } catch (e) { banner = 0; }
      var compact = H < 560 && W > H * 1.15;
      var pad = clamp(Math.min(W, H) * 0.028, 8, 18);
      var hudH1 = 44, hudH2 = compact ? 24 : 28;
      var bottomH = compact ? 50 : 56;
      var topH = pad + hudH1 + 6 + hudH2;
      var bottomY = H - banner - pad - bottomH;
      var boardTop = topH + 10;
      var boardBottom = bottomY - 14;
      var availW = W - pad * 2;
      var availH = Math.max(80, boardBottom - boardTop);
      var board = Math.max(120, Math.min(availW, availH));
      var bx = (W - board) / 2;
      var by = boardTop + (availH - board) / 2;
      var Lt = {
        W: W, H: H, n: n, pad: pad, compact: compact, banner: banner,
        hudH1: hudH1, hudH2: hudH2, hudTop: pad, hud2Y: pad + hudH1 + 6,
        bottomY: bottomY, bottomH: bottomH, topH: topH,
        bx: bx, by: by, board: board, pitch: board / n, gap: (board / n) * 0.09
      };
      this.Lt = Lt;
      var ps = 44;
      var self = this;
      this.pauseBtn = new E.ui.Button({
        x: W - pad - ps, y: pad, w: ps, h: ps, text: 'II', fontSize: 15,
        bg: 'rgba(6,11,20,0.78)', border: 'rgba(63,227,255,0.32)', fg: P.cream,
        onTap: function () { E.audio.sfx('click'); self.setPaused(true, game); }
      });
    },

    /* ---------- кнопки ---------- */
    syncHud: function (game) {
      var Lt = this.Lt, W = Lt.W, pad = Lt.pad, self = this;
      var list = [];
      if (this.pauseBtn) list.push(this.pauseBtn);
      var n = 3, gap = 8;
      var bw = (W - pad * 2 - gap * (n - 1)) / n;
      var bh = Lt.bottomH;
      var y = Lt.bottomY;
      var labels = [
        T('hint_n', { n: Meta.count('hint') }),
        T('undo_n', { n: Meta.count('undo') }),
        T('shop')
      ];
      var acts = [function () { self.useHint(game); }, function () { self.useUndo(game); }, function () { self.openShop(game); }];
      for (var i = 0; i < n; i++) {
        (function (idx) {
          list.push(new E.ui.Button({
            x: pad + idx * (bw + gap), y: y, w: bw, h: bh, text: labels[idx],
            bg: idx === 2 ? 'rgba(20,32,54,0.92)' : 'rgba(9,20,36,0.9)',
            border: idx === 2 ? 'rgba(255,84,200,0.42)' : 'rgba(63,227,255,0.38)',
            fg: idx === 2 ? P.pinkSoft : P.cream,
            fontSize: Math.max(12, Math.min(15, Math.round(bw * 0.15))),
            onTap: acts[idx]
          }));
        })(i);
      }
      this.buttons = list;
    },

    buildEnd: function (game) {
      var Lt = this.Lt, W = Lt.W, self = this;
      var list = [];

      if (this.mode === 'shop') {
        var rows = this.shopRows();
        for (var i = 0; i < rows.length; i++) {
          (function (row) {
            list.push(new E.ui.Button({
              x: row.bx, y: row.by, w: row.bw, h: row.bh, text: '',
              bg: 'rgba(12,52,70,0.95)', border: 'rgba(63,227,255,0.55)', fg: '#dffbff',
              icon: function (ctx, b) {
                E.ui.text(ctx, T('buy'), b.x + b.w / 2, b.y + b.h * 0.31, 13, '#dffbff', 'center', 700);
                A.coin(ctx, b.x + b.w / 2 - 15, b.y + b.h * 0.68, 6.5);
                E.ui.text(ctx, String(row.price), b.x + b.w / 2 - 4, b.y + b.h * 0.68 + 1, 12, P.gold, 'left', 700);
              },
              onTap: function () { self.buy(row.id); }
            }));
          })(rows[i]);
        }
        var sh = this.shopLayout();
        list.push(new E.ui.Button({
          x: W / 2 - Math.min(260, sh.pw * 0.8) / 2, y: sh.closeY,
          w: Math.min(260, sh.pw * 0.8), h: 44, text: T('close'), fontSize: 16,
          bg: 'rgba(8,16,28,0.92)', border: 'rgba(220,240,255,0.28)', fg: 'rgba(220,240,255,0.8)',
          onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
        }));
        this.endButtons = list;
        return;
      }

      var defs = [];
      function add(text, bg, border, fg, fs, fn) {
        defs.push({ text: text, bg: bg, border: border, fg: fg, fs: fs, fn: fn });
      }
      if (this.mode === 'paused') {
        add(T('pause_resume'), 'rgba(10,52,64,0.96)', P.neon, '#dffbff', 18, function () { E.audio.sfx('click'); self.setPaused(false, game); });
        add(T('pause_restart'), 'rgba(12,22,38,0.95)', 'rgba(63,227,255,0.4)', P.cream, 16, function () {
          E.audio.sfx('click');
          game.setScene('play', { level: self.level + 1 });
        });
        add(E.audio.isMuted() ? T('sound_off') : T('sound_on'), 'rgba(12,22,38,0.95)', 'rgba(247,201,92,0.32)', P.dim, 14, function (b) {
          var m = !E.audio.isMuted();
          E.audio.setMuted(m);
          E.storage.set('muted', m);
          b.text = m ? T('sound_off') : T('sound_on');
        });
        add(T('pause_menu'), 'rgba(8,16,28,0.92)', 'rgba(220,240,255,0.2)', P.dim, 14, function () {
          E.audio.sfx('click');
          game.setScene('menu', {});
        });
      } else if (this.mode === 'win') {
        var last = this.level >= C.levels.length - 1;
        add(last ? T('to_menu') : T('next_level'), 'rgba(10,52,64,0.96)', P.neon, '#dffbff', 18, function () {
          E.audio.sfx('click');
          self.leaveWin(game, last ? 'menu' : 'next');
        });
        if (!this.captureMode && !this.doubled) {
          add(T('double_coins'), 'rgba(46,38,12,0.95)', P.gold, '#ffeec2', 15, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.doubled = true;
                Meta.addCoins(self.reward);
                E.audio.sfx('coin');
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) self.toast(T('ad_fail')); }
            });
          });
        }
        add(T('to_menu'), 'rgba(8,16,28,0.92)', 'rgba(220,240,255,0.2)', P.dim, 14, function () {
          E.audio.sfx('click');
          self.leaveWin(game, 'menu');
        });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.continueUsed) {
          add(T('second_chance'), 'rgba(46,38,12,0.95)', P.gold, '#ffeec2', 16, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.continueUsed = true;
                self.st.limit += C.ads.continueMoves;
                self.mode = 'running';
                self.result = null;
                E.sdk.gameplayStart();
                E.audio.sfx('revive');
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) self.toast(T('ad_fail')); }
            });
          });
        }
        add(T('retry'), 'rgba(10,52,64,0.96)', P.neon, '#dffbff', 17, function () {
          E.audio.sfx('click');
          game.setScene('play', { level: self.level + 1 });
        });
        add(T('to_menu'), 'rgba(8,16,28,0.92)', 'rgba(220,240,255,0.2)', P.dim, 14, function () {
          E.audio.sfx('click');
          game.setScene('menu', {});
        });
      }

      var el = this.endLayout(defs.length);
      this.el = el;
      for (var k = 0; k < defs.length; k++) {
        var d = defs[k];
        list.push(new E.ui.Button({
          x: el.compact ? el.x0 + k * (el.bw + el.gap) : el.x0,
          y: el.compact ? el.btnY : el.btnY + k * (el.bh + el.gap),
          w: el.bw, h: el.bh, text: d.text, bg: d.bg, border: d.border, fg: d.fg,
          fontSize: d.fs, onTap: d.fn
        }));
      }
      this.endButtons = list;
    },

    /* Раскладка оверлеев: в коротком ландшафте кнопки в строку, в портрете —
       колонкой, а заголовок и награда сидят в одном блоке с кнопками. */
    endLayout: function (cnt) {
      var Lt = this.Lt;
      var compact = !!Lt.compact;
      var gap = 10;
      if (compact) {
        var bh = 44;
        var bw = Math.min(210, (Lt.W - Lt.pad * 2 - gap * (cnt - 1)) / Math.max(1, cnt));
        var total = bw * cnt + gap * (cnt - 1);
        return {
          compact: true, bh: bh, bw: bw, gap: gap, x0: (Lt.W - total) / 2,
          btnY: Lt.H - Lt.banner - Lt.pad - bh, contentY: Lt.topH + 36
        };
      }
      var bh2 = clamp(Lt.H * 0.068, 44, 52);
      var bw2 = Math.min(320, Lt.W * 0.8);
      var buttonsH = cnt * (bh2 + gap) - gap;
      var blockH = 186 + buttonsH;
      var yStart = Math.max(Lt.topH + 8, (Lt.H - Lt.banner - blockH) / 2);
      return {
        compact: false, bh: bh2, bw: bw2, gap: gap, x0: (Lt.W - bw2) / 2,
        btnY: yStart + 186, contentY: yStart + 36
      };
    },

    /* ---------- магазин ---------- */
    shopLayout: function () {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      var pw = clamp(W * 0.9, 280, 430);
      var n = C.shop.length;
      var rowH = clamp(H * 0.125, 62, 92);
      var headH = 56, footH = 58;
      var ph = Math.min(headH + n * (rowH + 10) + footH + 12, H - 30);
      var px = (W - pw) / 2, py = (H - ph) / 2;
      return { px: px, py: py, pw: pw, ph: ph, rowH: rowH, headH: headH,
               closeY: py + ph - footH + 4 };
    },
    shopRows: function () {
      var s = this.shopLayout(), out = [];
      var rowW = s.pw - 24;
      for (var i = 0; i < C.shop.length; i++) {
        var y = s.py + s.headH + i * (s.rowH + 10);
        var it = C.shop[i];
        var bw = Math.min(110, rowW * 0.30);
        out.push({
          id: it.id, x: s.px + 12, y: y, w: rowW, h: s.rowH,
          bx: s.px + 12 + rowW - bw - 10, by: y + s.rowH / 2 - 22, bw: bw, bh: 44,
          price: priceOf(it.id, this.st)
        });
      }
      return out;
    },
    openShop: function (game) {
      if (this.mode !== 'running' && this.mode !== 'paused') return;
      this.shopPrev = this.mode;
      this.mode = 'shop';
      E.sdk.gameplayStop();
      this.buildEnd(game || this.game);
    },
    closeShop: function (game) {
      if (this.mode !== 'shop') return;
      this.mode = this.shopPrev === 'paused' ? 'paused' : 'running';
      if (this.mode === 'running') E.sdk.gameplayStart();
      this.buildEnd(game || this.game);
    },
    buy: function (id) {
      var st = this.st;
      var it = shopItem(id);
      if (!it) return;
      var price = priceOf(id, st);
      if (Meta.coins() < price) { E.audio.sfx('deny'); this.toast(T('not_enough')); return; }
      Meta.addCoins(-price);
      Meta.addBought(id);
      if (id === 'move') {
        st.limit += it.charge;
        st.bought.move = (st.bought.move | 0) + 1;
      } else {
        Meta.addCharge(id, 1);
      }
      E.audio.sfx('buy');
      this.toast(T(SHOP_TOAST[id]));
      this.buildEnd(this.game);
    },

    /* ---------- действия ---------- */
    useHint: function (game) {
      if (this.mode !== 'running') return;
      if (Meta.count('hint') <= 0) { E.audio.sfx('deny'); this.toast(T('no_hint')); this.openShop(game); return; }
      var idx = L.hintIdx(this.st);
      if (idx < 0) return;
      Meta.useCharge('hint');
      this.st.hintUsed++;
      this.press(game, idx, true);
      E.audio.sfx('pulse');
      this.toast(T('hint_used'));
    },
    useUndo: function (game) {
      if (this.mode !== 'running') return;
      if (Meta.count('undo') <= 0) { E.audio.sfx('deny'); this.toast(T('no_undo')); this.openShop(game); return; }
      var r = L.undo(this.st);
      if (!r) { E.audio.sfx('deny'); this.toast(T('no_undo')); return; }
      Meta.useCharge('undo');
      this.markToggled(r.toggled, r.idx);
      E.audio.sfx('click');
      this.syncHud(game);
    },
    press: function (game, idx, free) {
      var toggled = L.press(this.st, idx, free);
      if (!toggled) return;
      this.markToggled(toggled, idx);
      E.audio.sfx('tick');
      this.syncHud(game);
      if (L.won(this.st)) this.onWin(game);
      else if (L.outOfMoves(this.st)) this.onOver(game);
    },
    markToggled: function (toggled, idx) {
      var Lt = this.Lt, n = this.st.n;
      for (var i = 0; i < toggled.length; i++) this.anim[toggled[i]] = this.t;
      var r = (idx / n) | 0, c = idx % n;
      var cx = Lt.bx + c * Lt.pitch + Lt.pitch / 2;
      var cy = Lt.by + r * Lt.pitch + Lt.pitch / 2;
      this.ripples.push({ x: cx, y: cy, t: 0, dur: 0.5, color: P.neonSoft });
      if (this.ripples.length > 12) this.ripples.shift();
      this.shakeT = 0.1;
    },
    tapBoard: function (game, x, y) {
      var Lt = this.Lt, st = this.st;
      if (x < Lt.bx || y < Lt.by || x >= Lt.bx + Lt.board || y >= Lt.by + Lt.board) return;
      var c = Math.floor((x - Lt.bx) / Lt.pitch);
      var r = Math.floor((y - Lt.by) / Lt.pitch);
      if (c < 0 || r < 0 || c >= st.n || r >= st.n) return;
      this.press(game, r * st.n + c, false);
    },

    /* ---------- исходы ---------- */
    onWin: function (game, capture) {
      if (this.result) return;
      this.mode = 'win';
      this.result = { win: true };
      this.reward = L.reward(this.st);
      this.winT = 0;
      if (!capture && !this.captureMode && !this.auto) {
        Meta.addCoins(this.reward);
        Meta.bumpRuns();
        var num = this.level + 1;
        Meta.setBest(Math.max(Meta.best(), num));
        if (this.level < C.levels.length - 1) Meta.setLevel(Math.max(Meta.level(), this.level + 1));
      }
      E.audio.sfx('win');
      E.sdk.gameplayStop();
      this.buildEnd(game);
      if (this.auto) this.autoRestart = 1.9;
    },
    onOver: function (game) {
      if (this.result) return;
      this.mode = 'over';
      this.result = { win: false };
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      this.buildEnd(game);
      if (this.auto) this.autoRestart = 1.3;
    },
    leaveWin: function (game, to) {
      var self = this;
      var go = function () {
        if (to === 'next') game.setScene('play', { level: Math.min(C.levels.length, self.level + 2) });
        else game.setScene('menu', {});
      };
      var every = C.ads.interstitialEvery;
      var need = !this.captureMode && !this.auto && (Meta.runs() % every === 0);
      if (need) E.sdk.showInterstitial(function () { go(); });
      else go();
    },
    setPaused: function (on, game) {
      game = game || this.game;
      if (on) {
        if (this.mode !== 'running') return;
        this.pausePrev = 'running';
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildEnd(game);
      } else if (this.mode === 'paused') {
        this.mode = this.pausePrev === 'shop' ? 'shop' : 'running';
        if (this.mode === 'running') E.sdk.gameplayStart();
        this.buildEnd(game);
      }
    },

    /* ---------- автопилот ---------- */
    autopilot: function (dt) {
      if (this.mode !== 'running') return;
      this.autoT += dt;
      var delay = 0.9;
      if (this.autoT < delay) return;
      this.autoT = 0;
      var idx = L.autoNext(this.st);
      if (idx < 0) { if (L.outOfMoves(this.st)) this.onOver(this.game); return; }
      this.press(this.game, idx, false);
    },

    /* ---------- ввод ---------- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toastT > 0) this.toastT -= dt;
      if (this.shakeT > 0) this.shakeT -= dt;
      if (this.winT < 1) this.winT = Math.min(1, this.winT + dt * 2.2);
      for (var i = this.ripples.length - 1; i >= 0; i--) {
        this.ripples[i].t += dt;
        if (this.ripples[i].t >= this.ripples[i].dur) this.ripples.splice(i, 1);
      }
      if (this.autoRestart > 0) {
        this.autoRestart -= dt;
        if (this.autoRestart <= 0) {
          var nx = this.mode === 'win' ? Math.min(C.levels.length, this.level + 2) : this.level + 1;
          game.setScene('play', { level: nx, seed: (this.seed + 7919) % 1000000 });
          return;
        }
      }

      this.syncHud(game);

      var ptr = E.input.pointer;

      if (this.mode === 'paused' || this.mode === 'shop' || this.mode === 'win' || this.mode === 'over') {
        if (ptr.pressed) E.ui.handleTap(this.endButtons, ptr.x, ptr.y);
        if (E.input.wasPressed('Escape') || E.input.wasPressed('Backspace')) {
          if (this.mode === 'paused') this.setPaused(false, game);
          else if (this.mode === 'shop') this.closeShop(game);
        }
        return;
      }

      if (E.input.wasPressed('Escape') || E.input.wasPressed('Backspace')) { this.setPaused(true, game); return; }
      if (ptr.pressed) {
        if (E.ui.handleTap(this.buttons, ptr.x, ptr.y)) return;
        this.tapBoard(game, ptr.x, ptr.y);
        if (this.mode !== 'running') return;
      }
      if (E.input.wasPressed('KeyH')) this.useHint(game);
      if (E.input.wasPressed('KeyZ')) this.useUndo(game);

      if (this.auto) this.autopilot(dt);
    },

    toast: function (text) { this.toastMsg = text; this.toastT = 1.8; },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      var st = this.st;
      this.captureMode = true;
      if (cp.mode === 'shop') { this.openShop(game); return; }
      if (cp.mode === 'win') { this.forceWin(game); return; }
      if (cp.mode === 'over') {
        st.moves = st.limit;
        this.mode = 'over';
        this.result = { win: false };
        this.buildEnd(game);
        return;
      }
      var t = clamp(parseFloat(cp.t) || 0, 0, 30);
      var steps = Math.round(st.sol.length * 0.4) + Math.floor(t / 2.5);
      steps = clamp(steps, 1, Math.max(1, st.sol.length - 1));
      for (var i = 0; i < steps && i < st.sol.length; i++) L.press(st, st.sol[i], false);
      st.solIdx = Math.min(steps, st.sol.length);
      this.anim = {};
      this.ripples = [];
      this.mode = 'running';
      this.result = null;
      this.syncHud(game);
      this.buildEnd(game);
    },
    forceWin: function (game) {
      var st = this.st;
      for (var i = 0; i < st.cells.length; i++) st.cells[i] = 0;
      this.mode = 'win';
      this.result = { win: true };
      this.reward = L.reward(st);
      this.doubled = false;
      this.winT = 1;
      this.buildEnd(game);
    },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'win') this.forceWin(game);
      else if (s.mode === 'over') {
        this.st.moves = this.st.limit;
        this.mode = 'over';
        this.result = { win: false };
        this.buildEnd(game);
      }
      if (s.level != null) this.level = clamp((s.level | 0) - 1, 0, C.levels.length - 1);
    },
    getCaptureState: function () {
      return {
        scene: 'play', mode: this.mode, level: this.level + 1,
        moves: this.st.moves, limit: this.st.limit, lights: L.countLit(this.st)
      };
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, Lt = this.Lt, st = this.st;
      A.city(ctx, v.w, v.h, this.t, this.level + 1);

      // тень под полем
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#02040a';
      E.ui.roundRect(ctx, Lt.bx - 8, Lt.by + 8, Lt.board + 16, Lt.board + 16, 18);
      ctx.fill();
      ctx.restore();

      A.boardFrame(ctx, Lt.bx - 4, Lt.by - 4, Lt.board + 8, Lt.board + 8, this.shakeT > 0 ? 1 : 0.15);

      var n = st.n, pitch = Lt.pitch, gap = Lt.gap;
      var cell = pitch - gap;
      var pulse = 0.5 + 0.5 * Math.sin(this.t * 1.9);
      for (var i = 0; i < st.N; i++) {
        var r = (i / n) | 0, c = i % n;
        var x = Lt.bx + c * pitch + gap / 2;
        var y = Lt.by + r * pitch + gap / 2;
        var hot = 0;
        if (this.anim[i] != null) {
          var age = this.t - this.anim[i];
          if (age >= 0 && age < 0.32) hot = 1 - age / 0.32;
        }
        A.tile(ctx, x, y, cell, cell, !!st.cells[i], { hot: hot, pulse: st.cells[i] ? pulse : 0 });
      }

      for (var k = 0; k < this.ripples.length; k++) {
        var rp = this.ripples[k], kk = rp.t / rp.dur;
        A.ripple(ctx, rp.x, rp.y, pitch * (0.35 + kk * 0.8), (1 - kk) * 0.8, rp.color);
      }
      A.reflection(ctx, Lt.bx, Lt.by + Lt.board + 6, Lt.board, Math.min(46, Lt.board * 0.14), 0.85);
      var capY = Lt.by + Lt.board + 62;
      if (!Lt.compact && capY < Lt.bottomY - 12) {
        E.ui.text(ctx, T('tap_hint'), v.w / 2, capY, clamp(v.w * 0.032, 12, 13),
          'rgba(200,225,245,0.42)', 'center', 500);
      }

      this.drawHud(ctx, v);
      E.ui.drawButtons(ctx, this.buttons);

      if (this.mode === 'shop') this.drawShop(ctx, v);
      else if (this.mode === 'paused') this.drawPause(ctx, v);
      else if (this.mode === 'win') this.drawWin(ctx, v);
      else if (this.mode === 'over') this.drawOver(ctx, v);
      E.ui.drawButtons(ctx, this.endButtons);

      if (this.toastT > 0) {
        var a = Math.min(1, this.toastT * 2);
        ctx.globalAlpha = a;
        pill(ctx, v.w / 2 - 122, Lt.bottomY - 48, 244, 36, 'rgba(6,14,26,0.94)', 'rgba(63,227,255,0.45)');
        E.ui.text(ctx, this.toastMsg, v.w / 2, Lt.bottomY - 30, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },

    drawHud: function (ctx, v) {
      var Lt = this.Lt;
      var lv = this.level + 1;
      pill(ctx, Lt.pad, Lt.hudTop + 5, 104, 34, 'rgba(6,11,20,0.78)', 'rgba(63,227,255,0.30)');
      E.ui.text(ctx, T('hud_level', { n: lv }), Lt.pad + 12, Lt.hudTop + 22, 13, P.neonSoft, 'left', 700);
      E.ui.text(ctx, '/ ' + C.levels.length, Lt.pad + 92, Lt.hudTop + 22, 12, 'rgba(200,225,245,0.5)', 'right', 600);

      var cbw = 94;
      var cx = Lt.W - Lt.pad - 44 - 8 - cbw;
      pill(ctx, cx, Lt.hudTop + 5, cbw, 34, 'rgba(6,11,20,0.78)', 'rgba(247,201,92,0.30)');
      A.coin(ctx, cx + 18, Lt.hudTop + 22, 9.5);
      E.ui.text(ctx, String(Meta.coins()), cx + 33, Lt.hudTop + 23, 15, P.gold, 'left', 700);

      // ходы
      var st = this.st;
      var left = Math.max(0, st.limit - st.moves);
      var y2 = Lt.hud2Y;
      var col = left === 0 ? P.red : (left <= 2 ? P.gold : P.cream);
      E.ui.text(ctx, T('moves_n', { n: st.moves, max: st.limit }), Lt.pad, y2 + 9, 12.5, col, 'left', 700);
      var barW = Math.min(150, Lt.W * 0.34);
      var frac = st.limit ? clamp(left / st.limit, 0, 1) : 0;
      ctx.fillStyle = 'rgba(120,160,200,0.18)';
      E.ui.roundRect(ctx, Lt.pad, y2 + 19, barW, 5, 2.5); ctx.fill();
      ctx.fillStyle = left === 0 ? P.red : (left <= 2 ? P.gold : P.neon);
      E.ui.roundRect(ctx, Lt.pad, y2 + 19, Math.max(0, barW * frac), 5, 2.5); ctx.fill();

      // огни
      var lit = L.countLit(st);
      var pw = 78;
      var px = Lt.W - Lt.pad - pw;
      pill(ctx, px, y2, pw, 24, 'rgba(6,11,20,0.78)', lit ? 'rgba(63,227,255,0.28)' : 'rgba(99,240,166,0.4)');
      A.bulb(ctx, px + 16, y2 + 12, 5.5, lit > 0);
      E.ui.text(ctx, T('lights_n', { n: lit }), px + 29, y2 + 13, 12, lit ? P.neonSoft : P.green, 'left', 700);
    },

    drawPause: function (ctx, v) {
      scrim(ctx, v.w, v.h, 0.72);
      var cy = (this.el ? this.el.contentY : this.Lt.topH + 36) + 16;
      glowText(ctx, T('pause_title'), v.w / 2, cy, Math.min(v.w * 0.09, 34), P.cream, 'center', 800, 20);
      E.ui.text(ctx, T('level_n', { n: this.level + 1, total: C.levels.length }),
        v.w / 2, cy + 34, 13, P.neonSoft, 'center', 600);
    },
    drawWin: function (ctx, v) {
      var a = 0.66 * easeOut(this.winT);
      scrim(ctx, v.w, v.h, a);
      var cy = (this.el ? this.el.contentY : this.Lt.topH + 36) + 4;
      glowText(ctx, T('win_title'), v.w / 2, cy, Math.min(v.w * 0.09, 36), P.neonSoft, 'center', 800, 22);
      E.ui.text(ctx, T('win_sub'), v.w / 2, cy + 32, 13, 'rgba(220,240,255,0.72)', 'center', 500);
      var pillW = 172;
      pill(ctx, v.w / 2 - pillW / 2, cy + 54, pillW, 38, 'rgba(6,14,26,0.9)', 'rgba(247,201,92,0.4)');
      A.coin(ctx, v.w / 2 - pillW / 2 + 24, cy + 73, 10);
      E.ui.text(ctx, T('won_coins', { n: this.doubled ? this.reward * C.economy.doubleAd : this.reward }),
        v.w / 2 + 8, cy + 74, 16, P.gold, 'center', 700);
      E.ui.text(ctx, T('moves_saved', { n: Math.max(0, this.st.limit - this.st.moves) }),
        v.w / 2, cy + 108, 12, 'rgba(200,225,245,0.6)', 'center', 500);
      if (this.winT < 0.9) {
        var pr = 30 + this.winT * 620, pa = Math.max(0, 1 - this.winT / 0.9);
        ctx.save(); ctx.globalAlpha = pa * 0.55; ctx.lineWidth = 5; ctx.strokeStyle = P.neon;
        ctx.beginPath(); ctx.arc(v.w / 2, cy, pr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    },
    drawOver: function (ctx, v) {
      scrim(ctx, v.w, v.h, 0.74);
      var cy = (this.el ? this.el.contentY : this.Lt.topH + 36) + 4;
      glowText(ctx, T('lose_title'), v.w / 2, cy, Math.min(v.w * 0.09, 34), '#ff9aa5', 'center', 800, 20, 'rgba(255,102,119,0.6)');
      E.ui.text(ctx, T('lose_sub', { n: L.countLit(this.st) }), v.w / 2, cy + 32, 13, 'rgba(220,240,255,0.75)', 'center', 500);
      E.ui.text(ctx, T('level_n', { n: this.level + 1, total: C.levels.length }),
        v.w / 2, cy + 56, 12, 'rgba(200,225,245,0.5)', 'center', 500);
    },
    drawShop: function (ctx, v) {
      scrim(ctx, v.w, v.h, 0.8);
      var s = this.shopLayout(), rows = this.shopRows();
      panelBox(ctx, s.px, s.py, s.pw, s.ph);
      glowText(ctx, T('shop_title'), v.w / 2, s.py + 34, Math.min(v.w * 0.07, 28), P.neonSoft, 'center', 800, 18);
      A.coin(ctx, s.px + s.pw - 76, s.py + 34, 9);
      E.ui.text(ctx, String(Meta.coins()), s.px + s.pw - 62, s.py + 35, 14, P.gold, 'left', 700);

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var it = C.shop[i];
        var owned = it.id === 'move' ? 0 : Meta.count(it.id);
        E.ui.roundRect(ctx, row.x, row.y, row.w, row.h, 12);
        ctx.fillStyle = 'rgba(10,20,36,0.9)'; ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(63,227,255,0.20)'; ctx.stroke();

        A.shopIcon(ctx, row.x + 30, row.y + row.h / 2, 30, SHOP_GLYPH[it.id], P.neonSoft);
        E.ui.text(ctx, T(SHOP_NAME[it.id]), row.x + 58, row.y + row.h * 0.34, 15, P.cream, 'left', 700);
        var descW = row.bx - (row.x + 58) - 10;
        var descSize = E.ui.fit(ctx, T(SHOP_DESC[it.id]), Math.max(40, descW), 12, 500);
        E.ui.text(ctx, T(SHOP_DESC[it.id]), row.x + 58, row.y + row.h * 0.62, descSize, 'rgba(200,225,245,0.6)', 'left', 500);
        if (owned > 0) {
          E.ui.text(ctx, '×' + owned, row.x + 58, row.y + row.h * 0.82, 12, P.gold, 'left', 700);
        }
      }
    }
  };

  G.scenes = S;
})(window.GAME);
