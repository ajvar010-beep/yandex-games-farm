/* game/scenes.js — «Гвозди»: меню и доска. Вся механика в game/logic.js;
   здесь сессия, ввод, экономика, отрисовка, магазин и реклама. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};
  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------------- мета / сохранения ---------------- */
  function coins() { return Math.max(0, E.storage.get('coins', 0) | 0); }
  function addCoins(n) { var c = Math.max(0, coins() + (n | 0)); E.storage.set('coins', c); return c; }
  function level() { return clamp(E.storage.get('lvl', 1) | 0 || 1, 1, L.count()); }
  function setLevel(n) { E.storage.set('lvl', clamp(n | 0, 1, L.count())); }
  function doneMap() {
    var d = E.storage.get('done', null);
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  }
  function markDone(n) { var d = doneMap(); d[n] = 1; E.storage.set('done', d); }
  function best() { return clamp(E.storage.get('best', 0) | 0, 0, L.count()); }
  function setBest(n) { if ((n | 0) > best()) E.storage.set('best', n | 0); }
  function shopLv() {
    var s = E.storage.get('shop', null);
    s = (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
    var out = {};
    for (var i = 0; i < C.shop.length; i++) out[C.shop[i].id] = clamp(s[C.shop[i].id] | 0, 0, C.shop[i].max);
    return out;
  }
  function saveShop(s) { E.storage.set('shop', s); }
  function priceOf(item, lv) { return item.base + item.step * lv; }
  function shopItem(id) { for (var i = 0; i < C.shop.length; i++) if (C.shop[i].id === id) return C.shop[i]; return null; }

  /* ---------------- мелкая графика ---------------- */
  function pill(ctx, x, y, w, h, fill, stroke, r) {
    E.ui.roundRect(ctx, x, y, w, h, r == null ? h / 2 : r);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function plaque(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    E.ui.roundRect(ctx, x, y, w, h, 12);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(58,44,30,0.96)');
    g.addColorStop(1, 'rgba(30,23,16,0.96)');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    E.ui.roundRect(ctx, x, y, w, h, 12);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(201,162,74,0.45)'; ctx.stroke();
    // латунные уголки
    var r = Math.min(4, w * 0.02);
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + (i % 2 ? w - 9 : 9), y + (i < 2 ? 9 : h - 9), r, 0, Math.PI * 2);
      ctx.fillStyle = P.brass; ctx.fill();
    }
  }

  function coinsBadge(ctx, x, y, w, h) {
    pill(ctx, x, y, w, h, 'rgba(8,9,12,0.66)', 'rgba(201,162,74,0.40)');
    A.coin(ctx, x + h * 0.52, y + h / 2, h * 0.30);
    E.ui.text(ctx, String(coins()), x + h * 0.92, y + h / 2 + 1, Math.round(h * 0.48), P.amberHi, 'left', 700);
  }
  function soundButton(x, y, s) {
    return new E.ui.Button({
      x: x, y: y, w: s, h: s, bg: 'rgba(8,9,12,0.66)', border: 'rgba(201,162,74,0.40)',
      icon: function (ctx, b) {
        var mm = E.audio.isMuted();
        E.ui.text(ctx, mm ? '♪̸' : '♪', b.x + b.w / 2, b.y + b.h / 2 + 1, Math.round(b.h * 0.46), mm ? P.dim : P.amberHi, 'center', 700);
      },
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
  }
  function pauseButton(x, y, s, onTap) {
    return new E.ui.Button({
      x: x, y: y, w: s, h: s, bg: 'rgba(8,9,12,0.66)', border: 'rgba(201,162,74,0.40)',
      icon: function (ctx, b) {
        ctx.fillStyle = P.cream;
        var w2 = b.w * 0.115, h2 = b.h * 0.34, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        ctx.fillRect(cx - w2 * 2.2, cy - h2 / 2, w2, h2);
        ctx.fillRect(cx + w2 * 1.2, cy - h2 / 2, w2, h2);
      },
      onTap: onTap
    });
  }

  /* ---------------- магазин (общий для меню и доски) ---------------- */
  var Shop = {
    lay: function (v) {
      var W = v.w, H = v.h;
      var ban = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
      var portrait = H > W * 1.05;
      var bw = Math.min(portrait ? W * 0.9 : 560, W * 0.94);
      var top = H * (portrait ? 0.19 : 0.20);
      var availH = (H - ban - 96) - top;
      var n = C.shop.length;
      var bh = Math.min(112, availH / n - 12);
      var gap = Math.min(14, (availH - bh * n) / Math.max(1, n));
      return { W: W, H: H, ban: ban, portrait: portrait, bw: bw, top: top, bh: bh, gap: gap, x: (W - bw) / 2 };
    },
    build: function (sc, game) {
      var M = Shop.lay(game.view);
      var list = [], that = sc;
      sc.shopCards = [];
      for (var i = 0; i < C.shop.length; i++) {
        (function (item, idx) {
          var y = M.top + idx * (M.bh + M.gap);
          sc.shopCards.push({ item: item, x: M.x, y: y, w: M.bw, h: M.bh });
          var sh = shopLv(), lv = sh[item.id] | 0;
          var maxed = lv >= item.max;
          var bw2 = Math.min(132, M.bw * 0.34);
          list.push(new E.ui.Button({
            x: M.x + M.bw - bw2 - 12, y: y + M.bh / 2 - 21, w: bw2, h: 42,
            text: maxed ? T('maxed') : String(priceOf(item, lv)),
            bg: maxed ? 'rgba(38,32,24,0.9)' : '#5a4218',
            border: maxed ? 'rgba(140,120,90,0.35)' : P.amber,
            fg: maxed ? P.dim : P.cream, fontSize: 15,
            enabled: !maxed,
            onTap: function () { Shop.buy(sc, game, item); }
          }));
        })(C.shop[i], i);
      }
      list.push(new E.ui.Button({
        x: M.W / 2 - 80, y: M.H - M.ban - 68, w: 160, h: 46, text: T('back'),
        bg: 'rgba(24,20,15,0.92)', border: 'rgba(201,162,74,0.45)', fg: P.cream, fontSize: 17,
        onTap: function () { E.audio.sfx('click'); that.closeShop(); }
      }));
      sc.shopBtns = list;
    },
    buy: function (sc, game, item) {
      var sh = shopLv(), lv = sh[item.id] | 0;
      if (lv >= item.max) return;
      var price = priceOf(item, lv);
      if (coins() < price) {
        sc.toast = { t: 1.5, text: T('not_enough') };
        E.audio.sfx('deny');
        return;
      }
      addCoins(-price);
      sh[item.id] = lv + 1;
      saveShop(sh);
      E.audio.sfx('buy');
      Shop.build(sc, game);
    },
    draw: function (ctx, sc, game) {
      var M = Shop.lay(game.view), W = M.W, H = M.H;
      ctx.fillStyle = 'rgba(6,6,8,0.90)'; ctx.fillRect(0, 0, W, H);
      E.ui.text(ctx, T('shop_title'), W / 2, M.top - (M.portrait ? 62 : 54), Math.min(W * 0.075, 34), P.amberHi, 'center', 800);
      E.ui.text(ctx, T('shop_hint'), W / 2, M.top - (M.portrait ? 34 : 28), Math.min(W * 0.036, 14), 'rgba(244,234,214,0.6)', 'center', 500);
      coinsBadge(ctx, 12, 12, Math.max(84, W * 0.20), 32);
      soundButton(W - 48, 12, 34).draw(ctx);

      var sh = shopLv();
      for (var i = 0; i < sc.shopCards.length; i++) {
        var c = sc.shopCards[i], item = c.item, lv = sh[item.id] | 0;
        E.ui.roundRect(ctx, c.x, c.y, c.w, c.h, 14);
        var g = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
        g.addColorStop(0, 'rgba(54,42,28,0.96)');
        g.addColorStop(1, 'rgba(30,24,17,0.96)');
        ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = lv >= item.max ? 'rgba(140,120,90,0.35)' : 'rgba(201,162,74,0.45)';
        ctx.stroke();
        // иконка
        var ic = c.h * 0.30, ix = c.x + c.h * 0.42, iy = c.y + c.h * 0.5;
        if (item.id === 'stock') A.ball(ctx, ix, iy, ic * 0.78, sc.t || 0);
        else if (item.id === 'slow') A.clock(ctx, ix, iy, ic * 0.80, P.amberHi);
        else A.pliers(ctx, ix, iy, ic * 0.80, P.steelHi);

        var tx = c.x + c.h * 0.78;
        E.ui.text(ctx, T(item.name), tx, c.y + c.h * 0.30, Math.min(17, c.h * 0.20), P.cream, 'left', 700);
        var dsz = E.ui.fit(ctx, T(item.desc), c.w - (tx - c.x) - Math.min(150, c.w * 0.36), Math.max(11, c.h * 0.13), 500);
        E.ui.text(ctx, T(item.desc), tx, c.y + c.h * 0.56, dsz, 'rgba(244,234,214,0.62)', 'left', 500);
        // уровень
        var pw = Math.max(10, c.w * 0.022), gap = 4;
        E.ui.text(ctx, T('owned_n', { n: lv, max: item.max }), tx, c.y + c.h * 0.80, Math.max(11, Math.min(13, c.h * 0.12)), P.amberHi, 'left', 600);
        for (var p = 0; p < item.max; p++) {
          ctx.fillStyle = p < lv ? P.amber : 'rgba(140,120,90,0.30)';
          E.ui.roundRect(ctx, tx + c.w * 0.16 + p * (pw + gap), c.y + c.h * 0.78, pw, 6, 3); ctx.fill();
        }
      }
      E.ui.drawButtons(ctx, sc.shopBtns);
      if (sc.toast) {
        ctx.globalAlpha = Math.min(1, sc.toast.t * 2);
        pill(ctx, W / 2 - 110, M.H * 0.50, 220, 38, 'rgba(20,14,10,0.94)', 'rgba(210,88,60,0.6)');
        E.ui.text(ctx, sc.toast.text, W / 2, M.H * 0.50 + 19, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    }
  };

  /* ================================================================ МЕНЮ */
  S.menu = {
    name: 'menu',
    consumesInputInUpdate: true,

    enter: function (game) {
      this.game = game; this.t = 0; this.help = false; this.shopOpen = false; this.toast = null;
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      E.fx.reset();
      this.build(game);
    },
    onResize: function (game) {
      this.build(game);
      if (this.shopOpen) Shop.build(this, game);
    },
    closeShop: function () { this.shopOpen = false; },

    lay: function (v) {
      var W = v.w, H = v.h;
      var ban = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
      var portrait = H > W * 1.05;
      var bw = Math.min(portrait ? W * 0.78 : W * 0.34, 360);
      var bh = Math.max(46, Math.min(60, H * 0.082));
      if (portrait) {
        return {
          W: W, H: H, ban: ban, portrait: true,
          titleY: H * 0.13, titleSize: Math.min(W * 0.20, H * 0.085),
          hero: { x: W * 0.07, y: H * 0.235, w: W * 0.86, h: H * 0.255 },
          bx: (W - bw) / 2, bw: bw, bh: bh, by: H * 0.535,
          footY: H - ban - 44
        };
      }
      return {
        W: W, H: H, ban: ban, portrait: false,
        titleY: H * 0.24, titleSize: Math.min(W * 0.105, H * 0.20),
        hero: { x: W * 0.50, y: H * 0.12, w: W * 0.45, h: H * 0.76 },
        bx: W * 0.075, bw: bw, bh: bh, by: H * 0.47,
        footY: H - ban - 40
      };
    },
    build: function (game) {
      var M = this.lay(game.view), that = this;
      var list = [];
      list.push(new E.ui.Button({
        x: M.bx, y: M.by, w: M.bw, h: M.bh, text: T('play'),
        bg: '#6b4d18', border: P.amberHi, fg: P.cream, fontSize: Math.round(M.bh * 0.40),
        onTap: function () {
          E.audio.sfx('click');
          game.setScene('play', { level: level() });
        }
      }));
      list.push(new E.ui.Button({
        x: M.bx, y: M.by + M.bh + 12, w: M.bw, h: M.bh * 0.80, text: T('shop'),
        bg: 'rgba(26,22,16,0.92)', border: 'rgba(201,162,74,0.45)', fg: P.cream,
        fontSize: Math.round(M.bh * 0.32),
        onTap: function () { E.audio.sfx('click'); that.shopOpen = true; Shop.build(that, game); }
      }));
      list.push(soundButton(M.W - 46, 10, 34));
      list.push(new E.ui.Button({
        x: M.W - 88, y: 10, w: 34, h: 34, text: '?', fontSize: 17, fg: P.amberHi,
        bg: 'rgba(8,9,12,0.66)', border: 'rgba(201,162,74,0.40)',
        onTap: function () { E.audio.sfx('click'); that.help = !that.help; }
      }));
      this.buttons = list;
    },
    update: function (game, dt) {
      this.t += dt;
      // запись видео тикает всегда: иначе пауза/победа останавливают таймер рекордера
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (E.input.wasPressed('Escape') && this.help) { this.help = false; return; }
      if (this.shopOpen) {
        if (E.input.wasPressed('Escape')) { this.shopOpen = false; return; }
        if (E.input.pointer.pressed) E.ui.handleTap(this.shopBtns, E.input.pointer.x, E.input.pointer.y);
        return;
      }
      if (this.help) { if (E.input.pointer.pressed) this.help = false; return; }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) {
        game.setScene('play', { level: level() });
      }
    },
    draw: function (game, ctx) {
      var M = this.lay(game.view), W = M.W, H = M.H;
      A.bg(ctx, W, H, this.t);
      A.hero(ctx, M.hero.x, M.hero.y, M.hero.w, M.hero.h, this.t);

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.72)';
      ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
      E.ui.text(ctx, T('title1'), M.portrait ? W / 2 : M.bx + M.bw * 0.5, M.titleY, M.titleSize, P.amberHi, 'center', 800);
      ctx.restore();
      E.ui.text(ctx, T('subtitle'), M.portrait ? W / 2 : M.bx + M.bw * 0.5, M.titleY + M.titleSize * 0.72,
        Math.min(W * 0.042, 18), 'rgba(244,234,214,0.62)', 'center', 500);

      E.ui.drawButtons(ctx, this.buttons);
      coinsBadge(ctx, 12, 10, Math.max(84, W * 0.20), 34);

      var pr = T('progress_n', { n: level(), total: L.count() });
      E.ui.text(ctx, pr, W / 2, M.footY, Math.min(W * 0.036, 14), 'rgba(244,234,214,0.60)', 'center', 600);
      E.ui.text(ctx, T('menu_tip'), W / 2, M.footY + 20, Math.min(W * 0.032, 12), 'rgba(244,234,214,0.38)', 'center', 500);
      var bn = best();
      if (bn > 1) E.ui.text(ctx, T('best_n', { n: bn }), W / 2, M.footY - 20, Math.min(W * 0.032, 12), 'rgba(240,165,43,0.6)', 'center', 500);

      if (this.help) this.drawHelp(ctx, W, H, M);
      if (this.shopOpen) Shop.draw(ctx, this, game);
    },
    drawHelp: function (ctx, W, H, M) {
      ctx.fillStyle = 'rgba(8,7,6,0.94)'; ctx.fillRect(0, 0, W, H);
      var hy = H * 0.22;
      E.ui.text(ctx, T('rules_title'), W / 2, hy, Math.min(W * 0.072, 32), P.amberHi, 'center', 800);
      var lines = [T('rules_1'), T('rules_2'), T('rules_3'), T('rules_4')];
      var maxW = W * 0.86;
      var fs = Math.max(13, Math.min(W * 0.038, 17));
      for (var i = 0; i < lines.length; i++) {
        var s = E.ui.fit(ctx, lines[i], maxW, fs, 500);
        E.ui.text(ctx, lines[i], W / 2, hy + 44 + i * (s + 22), s, P.cream, 'center', 500);
      }
      E.ui.text(ctx, T('close'), W / 2, M.H * 0.84, 16, 'rgba(244,234,214,0.6)', 'center', 600);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================ ДОСКА */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.captureMode = !!(E.capture && E.capture.active);
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      // первый interstitial — не раньше 60 с от старта сессии (правило площадки)
      if (!E.sdk._lastInterstitial) E.sdk._lastInterstitial = Date.now();
      var lv = params.level != null ? params.level : (cp.wave != null ? cp.wave : level());
      this.level = clamp(parseInt(lv, 10) || 1, 1, L.count());
      var sh = shopLv();
      this.st = L.newRun({
        level: this.level,
        extraBalls: sh.stock * 2,
        slow: sh.slow,
        pliers: sh.pliers
      });
      this.mode = 'running';
      this.t = 0;
      this.reward = 0;
      this.floaters = [];
      this.toast = null;
      this.shopOpen = false;
      this.revived = false;
      this.doubled = false;
      this.autoRestartT = 0;
      this.hintT = 0;
      this.vrng = new E.Rng(20261106);
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      E.fx.reset();
      this.layout(game);
      if (this.captureMode) this.applyCapture(game);
      else if (this.autopilot) { /* автопилот включается в update */ }
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      if (this.mode === 'win' || this.mode === 'over' || this.mode === 'paused') this.buildEnd(game);
      if (this.shopOpen) Shop.build(this, game);
    },
    onBack: function (game) {
      if (this.shopOpen) { this.shopOpen = false; return; }
      if (this.mode === 'running') this.setPaused(true, game);
      else if (this.mode === 'paused') this.setPaused(false, game);
      else if (this.mode === 'win' || this.mode === 'over') game.setScene('menu', {});
    },
    closeShop: function () {
      this.shopOpen = false;
      this.mode = this.shopFrom === 'paused' ? 'paused' : 'running';
      if (this.mode === 'running') E.sdk.gameplayStart(); else E.sdk.gameplayStop();
      if (this.mode === 'paused') this.buildEnd(this.game);
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var ban = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
      var portrait = H > W * 1.05;
      var hudH = portrait ? 50 : 0;
      var boostH = portrait ? 66 : 0;
      var top = portrait ? hudH + 4 : 14;
      var bottom = portrait ? H - ban - boostH : H - ban - 14;
      var areaH = Math.max(80, bottom - top);
      var s = Math.min(W * (portrait ? 0.95 : 0.92) / 100, areaH / 150);
      var bw = 100 * s, bh = 150 * s;
      var bx = (W - bw) / 2;
      var by = top + (areaH - bh) / 2;
      var Lt = {
        W: W, H: H, ban: ban, portrait: portrait, hudH: hudH, boostH: boostH,
        s: s, bx: bx, by: by, bw: bw, bh: bh,
        top: top, bottom: bottom,
        boostY: H - ban - boostH + 10
      };
      this.Lt = Lt;
      var self = this;
      var pb = pauseButton(W - 44, 8, 34, function () {
        E.audio.sfx('click');
        self.setPaused(true, game);
      });
      this.pauseBtn = pb;
      this.buttons = [pb];

      // кнопки бустеров: снизу в портрете, столбиком справа в ландшафте
      var bs = portrait ? Math.min(52, (W - 40) / 3.4) : Math.min(56, (H - 240) / 4.2);
      var gap = portrait ? Math.min(18, W * 0.03) : 12;
      var total = bs * (portrait ? 3 : 1) + gap * (portrait ? 2 : 2);
      var x0, byy;
      if (portrait) {
        x0 = (W - (bs * 3 + gap * 2)) / 2;
        byy = Lt.boostY + (boostH - 20 - bs) / 2;
      } else {
        x0 = (bx + bw + W) / 2 - bs / 2;
        byy = Lt.by + Lt.bh * 0.56;
      }
      var mk = function (idx, iconFn, id, label) {
        return new E.ui.Button({
          x: portrait ? x0 + idx * (bs + gap) : x0,
          y: portrait ? byy : byy + idx * (bs + gap),
          w: bs, h: bs,
          bg: 'rgba(20,17,13,0.9)', border: 'rgba(201,162,74,0.40)',
          icon: function (ctx, b) {
            iconFn(ctx, b);
            E.ui.text(ctx, label, b.x + b.w / 2, b.y + b.h - 8, Math.max(12, Math.min(13.5, b.w * 0.25)), 'rgba(243,231,201,0.78)', 'center', 600);
          },
          onTap: function () { self.useBooster(id, game); }
        });
      };
      this.boost = [
        mk(0, function (ctx, b) { A.clock(ctx, b.x + b.w / 2, b.y + b.h / 2 - 6, b.w * 0.24, P.amberHi); countTag(ctx, b, self.st.slowLeft); }, 'slow', T('boost_slow')),
        mk(1, function (ctx, b) { A.pliers(ctx, b.x + b.w / 2, b.y + b.h / 2 - 6, b.w * 0.28, P.steelHi); countTag(ctx, b, self.st.pliersLeft); }, 'pliers', T('boost_pliers')),
        mk(2, function (ctx, b) {
          A.wrench(ctx, b.x + b.w / 2, b.y + b.h / 2 - 6, b.w * 0.24, P.brass);
        }, 'shop', T('boost_shop'))
      ];
      this.buttons = this.buttons.concat(this.boost);
    },
    useBooster: function (id, game) {
      if (this.mode !== 'running') return;
      if (id === 'shop') { this.openShop(game); return; }
      if (id === 'slow') {
        if (L.slow(this.st)) { E.audio.sfx('pulse'); E.fx.flash('#ffd47a', 0.12); }
        else { this.toastT(T('boost_busy')); E.audio.sfx('deny'); }
        return;
      }
      if (id === 'pliers') {
        var i = L.pliers(this.st);
        if (i >= 0) { E.audio.sfx('click'); }
        else { this.toastT(T('boost_busy')); E.audio.sfx('deny'); }
      }
    },

    setPaused: function (on, game) {
      if (on) {
        if (this.mode !== 'running') return;
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildEnd(game || this.game);
      } else {
        if (this.mode !== 'paused') return;
        this.mode = 'running';
        E.sdk.gameplayStart();
      }
    },

    /* ---------- кнопки оверлеев ---------- */
    buildEnd: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, self = this;
      var list = [];
      var pw = Math.min(340, W * 0.78);
      var ph = Math.min(50, Math.max(40, H * 0.072));
      var gapY = 10;
      var items = [];
      if (this.mode === 'paused') {
        items.push({ t: T('pause_resume'), bg: '#3f5a2c', bd: '#9ed36a', fg: '#eef7e2', fs: 18, fn: function () { E.audio.sfx('click'); self.setPaused(false, game); } });
        items.push({ t: T('pause_restart'), bg: '#4b3a22', bd: P.amber, fg: P.cream, fs: 17, fn: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); } });
        items.push({ t: E.audio.isMuted() ? T('sound_off') : T('sound_on'), bg: 'rgba(24,20,15,0.94)', bd: 'rgba(201,162,74,0.28)', fg: P.dim, fs: 15, fn: function (b) {
          var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m);
          b.text = m ? T('sound_off') : T('sound_on');
        } });
        items.push({ t: T('pause_menu'), bg: 'rgba(24,20,15,0.94)', bd: 'rgba(201,162,74,0.28)', fg: P.cream, fs: 16, fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      } else if (this.mode === 'win') {
        var last = this.level >= L.count();
        items.push({ t: last ? T('to_menu') : T('next_level'), bg: '#3f5a2c', bd: '#9ed36a', fg: '#eef7e2', fs: 18, fn: function () {
          E.audio.sfx('click');
          self.leaveWin(game, last ? 'menu' : 'next');
        } });
        if (!this.captureMode && !this.doubled) {
          items.push({ t: T('double_reward'), bg: '#4b3a22', bd: P.amberHi, fg: P.cream, fs: 16, fn: function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.doubled = true;
                addCoins(self.reward);
                E.audio.sfx('coin');
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) self.toast = { t: 1.5, text: T('ad_fail') }; }
            });
          } });
        }
        if (!last) items.push({ t: T('to_menu'), bg: 'rgba(24,20,15,0.94)', bd: 'rgba(201,162,74,0.28)', fg: P.dim, fs: 15, fn: function () { E.audio.sfx('click'); self.leaveWin(game, 'menu'); } });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.revived) {
          items.push({ t: T('second_chance'), bg: '#4b3a22', bd: P.amberHi, fg: P.cream, fs: 17, fn: function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.revived = true;
                L.revive(self.st, C.ads.reviveBalls);
                self.mode = 'running';
                E.sdk.gameplayStart();
                E.audio.sfx('revive');
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) self.toast = { t: 1.5, text: T('ad_fail') }; }
            });
          } });
        }
        items.push({ t: T('retry'), bg: '#4b3a22', bd: P.amber, fg: P.cream, fs: 18, fn: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level }); } });
        items.push({ t: T('to_menu'), bg: 'rgba(24,20,15,0.94)', bd: 'rgba(201,162,74,0.28)', fg: P.dim, fs: 15, fn: function () { E.audio.sfx('click'); game.setScene('menu', {}); } });
      }
      var n = items.length;
      var totalH = n * ph + (n - 1) * gapY;
      var y0 = Math.min(Lt.bottom - 16 - totalH, Math.max(Lt.top + 40, (Lt.top + Lt.bottom) / 2 - totalH / 2 + 26));
      if (y0 < 20) y0 = 20;
      var x = W / 2 - pw / 2;
      for (var i = 0; i < n; i++) {
        (function (it, idx) {
          list.push(new E.ui.Button({
            x: x, y: y0 + idx * (ph + gapY), w: pw, h: ph, text: it.t,
            bg: it.bg, border: it.bd, fg: it.fg, fontSize: it.fs, onTap: it.fn
          }));
        })(items[i], i);
      }
      this.endButtons = list;
      this.endTop = y0;
      this.endH = totalH;
    },

    leaveWin: function (game, to) {
      var self = this;
      var go = function () {
        if (to === 'next') game.setScene('play', { level: Math.min(L.count(), self.level + 1) });
        else game.setScene('menu', {});
      };
      var needAd = !this.captureMode && !this.autopilot && (this.level % C.ads.every === 0);
      if (needAd) E.sdk.showInterstitial(function () { go(); });
      else go();
    },

    openShop: function (game) {
      if (!this.st) return;
      this.shopFrom = this.mode === 'paused' ? 'paused' : 'running';
      this.mode = 'shop';
      this.shopOpen = true;
      E.sdk.gameplayStop();
      Shop.build(this, game || this.game);
    },

    /* ---------- события логики ---------- */
    onWin: function () {
      if (this.mode === 'win' || this.mode === 'over') return;
      this.mode = 'win';
      var spare = L.ballsLeft(this.st);
      var r = C.reward.base + C.reward.perLevel * (this.level - 1) + Math.min(C.reward.maxBallBonus, spare * C.reward.ballBonus);
      this.reward = r;
      if (!this.captureMode) {
        addCoins(r);
        markDone(this.level);
        setBest(Math.max(best(), this.level));
        if (this.level >= level()) setLevel(Math.min(L.count(), this.level + 1));
      }
      this.buildEnd(this.game);
      E.sdk.gameplayStop();
    },
    onLose: function () {
      if (this.mode === 'win' || this.mode === 'over') return;
      this.mode = 'over';
      this.buildEnd(this.game);
      E.sdk.gameplayStop();
    },

    consume: function (silent) {
      var ev = L.takeEvents(this.st), Lt = this.Lt, s = Lt.s;
      for (var i = 0; i < ev.length; i++) {
        var e = ev[i];
        var px = Lt.bx + (e.x || 0) * s, py = Lt.by + (e.y || 0) * s;
        if (e.type === 'spawn') { if (!silent) E.audio.sfx('tick'); }
        else if (e.type === 'pull') {
          if (!silent) {
            E.audio.sfx('click');
            E.fx.burst(px, py, P.spark, 9, 150 * s * 0.25, this.vrng);
            E.fx.burst(px, py, P.amber, 5, 90 * s * 0.25, this.vrng);
          }
        } else if (e.type === 'cup') {
          if (!silent) {
            E.audio.sfx('coin');
            E.fx.burst(px, py, P.amberHi, 10, 120, this.vrng);
          }
        } else if (e.type === 'filled') {
          if (!silent) {
            E.audio.sfx('buy');
            E.fx.flash(P.amberHi, 0.10);
            this.floaters.push({ x: px, y: py, t: 0, text: '+', color: P.amberHi, size: 16 });
          }
        } else if (e.type === 'waste') {
          if (!silent) {
            E.audio.sfx('deny');
            E.fx.burst(px, py, P.danger, 8, 100, this.vrng);
            this.floaters.push({ x: px, y: py, t: 0, text: '×', color: P.danger, size: 16 });
          }
        } else if (e.type === 'lost' || e.type === 'stuck') {
          if (!silent) { E.audio.sfx('over'); E.fx.shake(3, 0.15); }
        } else if (e.type === 'win') {
          if (!silent) E.audio.sfx('win');
          this.onWin();
        } else if (e.type === 'lose') {
          if (!silent) E.audio.sfx('over');
          this.onLose();
        } else if (e.type === 'slow' || e.type === 'revive') {
          if (!silent) E.audio.sfx('pulse');
        }
      }
    },

    /* ---------- шаг ---------- */
    update: function (game, dt) {
      this.t += dt;
      // запись видео тикает всегда: иначе пауза/победа останавливают таймер рекордера
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt;
        if (f.t > 0.9) this.floaters.splice(i, 1);
      }
      if (this.shopOpen) {
        if (E.input.wasPressed('Escape')) { this.closeShop(); return; }
        if (E.input.pointer.pressed) E.ui.handleTap(this.shopBtns, E.input.pointer.x, E.input.pointer.y);
        return;
      }
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (this.mode === 'paused' && E.input.wasPressed('Escape')) { this.setPaused(false, game); return; }
        if (E.input.pointer.pressed) E.ui.handleTap(this.endButtons, E.input.pointer.x, E.input.pointer.y);
        return;
      }
      if (this.mode !== 'running') return;

      if (E.input.wasPressed('Escape')) { this.setPaused(true, game); return; }

      // ввод: бустеры и пауза
      if (E.input.pointer.pressed) {
        var hitB = E.ui.hitTest(this.buttons, E.input.pointer.x, E.input.pointer.y);
        if (hitB) { hitB.tap(); return; }
        var tol = Math.max(4.6, 22 / this.Lt.s);
        var bx = (E.input.pointer.x - this.Lt.bx) / this.Lt.s;
        var by = (E.input.pointer.y - this.Lt.by) / this.Lt.s;
        var idx = L.tap(this.st, bx, by, tol);
        if (idx >= 0) this.hintT = 0;
      }

      if (this.autopilot) L.autopilot(this.st);
      L.update(this.st, dt);
      this.consume(this.captureMode);

      // подсказка на первом уровне
      if (this.level <= 2 && this.st.pulled === 0 && this.st.landed === 0) this.hintT += dt;

      // авто-перезапуск на записи, чтобы видео не стояло на проигрыше
      if (this.autopilot && this.st.phase === 'lose') {
        this.autoRestartT += dt;
        if (this.autoRestartT > 1.3) {
          this.autoRestartT = 0;
          game.setScene('play', { level: this.level });
        }
      }
      if (this.autopilot && this.st.phase === 'win') {
        this.autoRestartT += dt;
        if (this.autoRestartT > 1.15) {
          this.autoRestartT = 0;
          game.setScene('play', { level: this.level >= L.count() ? 1 : this.level + 1 });
        }
      }
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      A.bg(ctx, W, H, this.t);
      this.drawBoard(ctx);
      this.drawHud(ctx);
      this.drawBoosters(ctx);
      if (this.pauseBtn) E.ui.drawButtons(ctx, [this.pauseBtn]);

      // всплывающие цифры
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i], k = 1 - f.t / 0.9;
        ctx.globalAlpha = k;
        E.ui.text(ctx, f.text, f.x, f.y - f.t * 34, f.size, f.color, 'center', 800);
        ctx.globalAlpha = 1;
      }
      E.fx.draw(ctx);
      E.fx.drawFlash(ctx, W, H);

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.drawEnd(ctx);
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        pill(ctx, W / 2 - 104, H * 0.14, 208, 34, 'rgba(14,11,8,0.94)', 'rgba(210,88,60,0.5)');
        E.ui.text(ctx, this.toast.text, W / 2, H * 0.14 + 17, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
      if (this.shopOpen) Shop.draw(ctx, this, game);
    },

    drawBoard: function (ctx) {
      var Lt = this.Lt, st = this.st, t = this.t;
      var s = Lt.s, bx = Lt.bx, by = Lt.by;
      var X = function (v) { return bx + v * s; };
      var Y = function (v) { return by + v * s; };

      ctx.save();
      if (E.fx && E.fx.offsetX) ctx.translate(E.fx.offsetX(t), E.fx.offsetY(t));
      A.board(ctx, bx, by, Lt.bw, Lt.bh, t);

      // сливы между чашами
      var cu = C.cups;
      for (var g = 0; g < 2; g++) {
        var gx1 = cu[g].x2, gx2 = cu[g + 1].x1;
        var gd = ctx.createLinearGradient(0, Y(128), 0, Y(150));
        gd.addColorStop(0, 'rgba(0,0,0,0.55)');
        gd.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = gd;
        ctx.fillRect(X(gx1), Y(128), (gx2 - gx1) * s, 22 * s);
      }

      // чаши
      for (var c = 0; c < 3; c++) {
        var cc = st.cups[c];
        A.cup(ctx, X(cu[c].x1), Y(128), (cu[c].x2 - cu[c].x1) * s, 21 * s, cc.need, cc.got, cc.flash, t);
      }

      // шпильки
      for (var i = 0; i < st.pins.length; i++) {
        var p = st.pins[i];
        if (p.gone) continue;
        var glow = 0;
        if (this.level <= 2 && st.pulled === 0 && st.landed === 0) glow = 0.35 + 0.35 * Math.sin(t * 4);
        A.pin(ctx, X(p.x1), Y(p.y1), X(p.x2), Y(p.y2), s, glow, p.hit);
      }

      // бункеры
      var sp = st.lv.spawn || [50];
      for (var k = 0; k < sp.length; k++) {
        A.hopper(ctx, X(sp[k]), Math.max(Y(-4.5), 2), s * 18, s * 11.5, 0, L.ballsLeft(st), t);
      }

      // шары
      for (var b = 0; b < st.balls.length; b++) {
        var bq = st.balls[b];
        var r = C.phys.r * s;
        for (var tr = 2; tr >= 1; tr--) {
          ctx.globalAlpha = 0.10 * (3 - tr);
          A.ball(ctx, X(bq.x) - bq.vx * s * 0.010 * tr, Y(bq.y) - bq.vy * s * 0.010 * tr, r * (1 - 0.10 * tr), t);
        }
        ctx.globalAlpha = 1;
        A.ball(ctx, X(bq.x), Y(bq.y), r, t);
      }

      // подсказка первых уровней
      if (this.mode === 'running' && this.level <= 2 && this.st.pulled === 0 && this.st.landed === 0) {
        var a = Math.min(1, this.hintT * 1.6);
        var txt = this.hintT > 2.4 ? T('tut_pull') : T('tut_watch');
        ctx.globalAlpha = a * (0.62 + 0.30 * Math.sin(this.t * 3));
        E.ui.text(ctx, txt, Lt.W / 2, Y(117), Math.max(12, Math.min(15, s * 3.6)), P.amberHi, 'center', 600);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },

    drawHud: function (ctx) {
      var Lt = this.Lt, W = Lt.W, st = this.st;
      var left = L.ballsLeft(st);
      if (Lt.portrait) {
        var hh = 32, yy = 9;
        var lvlTxt = T('level_n', { n: this.level });
        var lw = Math.max(76, Math.min(150, W * 0.24));
        pill(ctx, 10, yy, lw, hh, 'rgba(8,9,12,0.66)', 'rgba(201,162,74,0.40)');
        E.ui.text(ctx, lvlTxt, 10 + lw / 2, yy + hh / 2 + 1, Math.max(12, Math.min(14, W * 0.036)), P.cream, 'center', 700);

        var bw = 58, bx = 10 + lw + 6;
        pill(ctx, bx, yy, bw, hh, 'rgba(8,9,12,0.66)', 'rgba(160,180,205,0.30)');
        A.ball(ctx, bx + 15, yy + hh / 2, 7, this.t);
        E.ui.text(ctx, String(left), bx + 28, yy + hh / 2 + 1, 15, left <= 1 ? P.danger : P.cream, 'left', 700);

        var cw = 84, cx = W - 44 - cw - 6;
        coinsBadge(ctx, cx, yy + (hh - 30) / 2, cw, 30);
        return;
      }

      // ландшафт: таблички-вывески по сторонам доски
      var cardW = Math.min(300, Math.max(180, Lt.bx - 48));
      var cy = Lt.by + Lt.bh * 0.10, ch = Math.min(178, Lt.bh * 0.30);
      // левая: уровень и шары
      plaque(ctx, 24, cy, cardW, ch);
      E.ui.text(ctx, T('level_n', { n: this.level }), 24 + cardW / 2, cy + ch * 0.20, Math.min(16, cardW * 0.075), 'rgba(244,234,214,0.55)', 'center', 600);
      E.ui.text(ctx, String(this.level), 24 + cardW / 2, cy + ch * 0.50, Math.min(54, ch * 0.34), P.amberHi, 'center', 800);
      A.ball(ctx, 24 + cardW * 0.26, cy + ch * 0.82, Math.min(11, ch * 0.075), this.t);
      E.ui.text(ctx, String(left), 24 + cardW * 0.26 + 17, cy + ch * 0.82, Math.min(22, ch * 0.14), left <= 1 ? P.danger : P.cream, 'left', 700);
      E.ui.text(ctx, '/ ' + this.st.ballsTotal, 24 + cardW * 0.62, cy + ch * 0.82, Math.min(13, ch * 0.10), 'rgba(244,234,214,0.45)', 'left', 500);

      // правая: монеты
      var rx = W - 24 - cardW;
      plaque(ctx, rx, cy, cardW, Math.min(96, ch * 0.55));
      A.coin(ctx, rx + cardW * 0.26, cy + Math.min(96, ch * 0.55) / 2, Math.min(15, cardW * 0.07));
      E.ui.text(ctx, String(coins()), rx + cardW * 0.26 + 24, cy + Math.min(96, ch * 0.55) / 2, Math.min(26, cardW * 0.11), P.amberHi, 'left', 700);
    },

    drawBoosters: function (ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      if (Lt.portrait) {
        var g = ctx.createLinearGradient(0, Lt.boostY - 10, 0, H - Lt.ban);
        g.addColorStop(0, 'rgba(12,10,8,0)');
        g.addColorStop(0.4, 'rgba(12,10,8,0.55)');
        g.addColorStop(1, 'rgba(12,10,8,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(0, Lt.boostY - 10, W, H - Lt.boostY + 10 - Lt.ban);
      }
      for (var i = 0; i < this.boost.length; i++) {
        var b = this.boost[i];
        var off = false;
        if (i === 0) off = this.st.slowLeft <= 0 && this.st.slowT <= 0;
        if (i === 1) off = this.st.pliersLeft <= 0;
        ctx.globalAlpha = off ? 0.45 : 1;
        b.draw(ctx);
        ctx.globalAlpha = 1;
      }
    },

    drawEnd: function (ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      ctx.fillStyle = 'rgba(6,6,8,0.72)'; ctx.fillRect(0, 0, W, H);
      var pw = Math.min(400, W * 0.9);
      var titleY = this.endTop - 64;
      if (titleY < 40) titleY = 40;
      var px = W / 2 - pw / 2;

      if (this.mode === 'win') {
        E.ui.text(ctx, T('win_title'), W / 2, titleY, Math.min(W * 0.075, 30), P.amberHi, 'center', 800);
        E.ui.text(ctx, T('win_sub'), W / 2, titleY + 24, Math.min(W * 0.038, 14), 'rgba(244,234,214,0.6)', 'center', 500);
        E.ui.text(ctx, T('won_coins', { n: this.reward }), W / 2, this.endTop - 22, Math.min(W * 0.05, 20), P.amberHi, 'center', 800);
      } else if (this.mode === 'over') {
        E.ui.text(ctx, T('lose_title'), W / 2, titleY, Math.min(W * 0.070, 28), P.danger, 'center', 800);
        var got = 0;
        for (var i = 0; i < 3; i++) if (this.st.cups[i].got >= this.st.cups[i].need) got++;
        E.ui.text(ctx, T('cups_now', { a: got, b: 3 }), W / 2, titleY + 24, Math.min(W * 0.038, 14), 'rgba(244,234,214,0.6)', 'center', 500);
      } else {
        E.ui.text(ctx, T('paused'), W / 2, titleY, Math.min(W * 0.075, 30), P.amberHi, 'center', 800);
      }
      ctx.globalAlpha = 1;
      E.ui.drawButtons(ctx, this.endButtons);
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      var mode = cp.mode;
      if (mode === 'shop') { this.openShop(game); return; }
      if (mode === 'win') { this.forceWin(); return; }
      if (mode === 'over') { this.forceOver(); return; }
      var t = clamp(parseFloat(cp.t) || 2.1, 0.1, 24);
      var guard = 0;
      while (this.st.t < t && this.st.phase === 'run' && guard < 4000) {
        L.autopilot(this.st);
        L.update(this.st, 1 / 60);
        this.consume(true);
        guard++;
      }
      this.consume(true);
      if (this.st.phase === 'win') this.forceWin();
      else if (this.st.phase === 'lose') this.forceOver();
    },
    forceWin: function () {
      for (var i = 0; i < 3; i++) { this.st.cups[i].got = this.st.cups[i].need; this.st.cups[i].flash = 0.25; }
      this.st.phase = 'win';
      this.mode = 'win';
      this.reward = C.reward.base + C.reward.perLevel * (this.level - 1) + 5;
      this.buildEnd(this.game);
    },
    forceOver: function () {
      this.st.phase = 'lose';
      for (var i = 0; i < 3; i++) this.st.cups[i].got = Math.min(this.st.cups[i].need, i === 0 ? 1 : 0);
      this.mode = 'over';
      this.buildEnd(this.game);
    },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'win') this.forceWin();
      else if (s.mode === 'over') this.forceOver();
      if (s.level) this.level = clamp(s.level, 1, L.count());
      if (s.wave) this.level = clamp(s.wave, 1, L.count());
    },
    getCaptureState: function () {
      return {
        scene: 'play',
        mode: this.mode,
        level: this.level,
        cups: this.st ? this.st.cups.map(function (c) { return c.got + '/' + c.need; }).join(' ') : ''
      };
    }
  };

  function countTag(ctx, b, n) {
    var s = String(n | 0);
    E.ui.text(ctx, s, b.x + b.w - 6, b.y + 10, 12, n > 0 ? P.amberHi : P.dim, 'right', 700);
  }

  G.scenes = S;
  G.shopUI = Shop;
})(window.GAME);
