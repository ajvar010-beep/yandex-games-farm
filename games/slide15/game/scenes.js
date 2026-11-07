/* game/scenes.js — сцены «Латунного Порядка»: menu, shop, play.
   В play через mode живут пауза, магазин, победа и поражение —
   capture-контракт ждёт mode = running|shop|win|over. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var E = window.Engine, C = G.config, L = G.logic, P = C.palette;
  var A = G.art;
  var S = {};

  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function banner() { try { return E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0; } catch (e) { return 0; } }

  /* ---------- кошелёк и склад (один кошелёк — storage.coins) ---------- */
  function coins() { return E.storage.get('coins', 0) | 0; }
  function addCoins(n) { E.storage.set('coins', Math.max(0, coins() + (n | 0))); }
  function charges() { var c = E.storage.get('charges', null); return (c && typeof c === 'object') ? c : {}; }
  function chargeOf(id) { return charges()[id] | 0; }
  function addCharges(id, n) { var c = charges(); c[id] = (c[id] | 0) + (n | 0); E.storage.set('charges', c); }
  function useCharge(id) { var c = charges(); if (!(c[id] > 0)) return false; c[id]--; E.storage.set('charges', c); return true; }
  function buys() { var b = E.storage.get('buys', null); return (b && typeof b === 'object') ? b : {}; }
  function levelIndex() { return clamp(E.storage.get('level', 1) | 0, 1, C.levels.length); }
  function maxLevel() { return clamp(E.storage.get('unlocked', 1) | 0, 1, C.levels.length); }
  function setLevel(n) { E.storage.set('level', clamp(n, 1, C.levels.length)); }
  function setMaxLevel(n) { E.storage.set('unlocked', clamp(n, 1, C.levels.length)); }
  function doneMap() { var d = E.storage.get('done', null); return (d && typeof d === 'object') ? d : {}; }
  function doneCount() { var d = doneMap(), n = 0; for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) n++; return n; }
  function runs() { return E.storage.get('runs', 0) | 0; }
  function addRun() { E.storage.set('runs', runs() + 1); }

  /* ---------- мелкие элементы ---------- */
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, Math.min(h / 2, 14));
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function coinBadge(ctx, x, y, fs) {
    fs = fs || 15;
    var h = Math.max(28, fs * 1.9), w = Math.max(78, fs * 5.1);
    pill(ctx, x, y, w, h, 'rgba(28,18,10,0.74)', 'rgba(201,162,74,0.45)');
    A.coin(ctx, x + h * 0.46, y + h / 2, h * 0.3);
    E.ui.text(ctx, String(coins()), x + h * 0.86, y + h / 2 + 1, fs, P.brassHi, 'left', 700);
    return w;
  }

  function soundIcon(ctx, b) {
    var mm = E.audio.isMuted();
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    E.ui.text(ctx, mm ? '♪̸' : '♪', cx, cy + 1, Math.round(b.h * 0.5), mm ? P.dim : P.brassHi, 'center', 700);
  }

  function soundButton(x, y, w, h) {
    return new E.ui.Button({
      x: x, y: y, w: w, h: h,
      bg: 'rgba(28,18,10,0.78)', border: 'rgba(201,162,74,0.45)',
      icon: soundIcon,
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
  }

  function toastDraw(ctx, host, v) {
    if (!host.toast) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, host.toast.t * 2.4);
    var tw = Math.min(320, v.w * 0.84);
    var ty = (v.w > v.h * 1.25) ? 6 : Math.max(74, v.h * 0.155);
    pill(ctx, v.w / 2 - tw / 2, ty, tw, 34, 'rgba(20,12,6,0.95)', 'rgba(201,162,74,0.5)');
    E.ui.text(ctx, host.toast.text, v.w / 2, ty + 18, 13, P.cream, 'center', 600);
    ctx.restore();
  }

  /* ---------- магазин: общий модуль для сцены и оверлея в игре ---------- */
  var SHOP_NAME = { hint: 'shop_hint_name', undo: 'shop_undo_name', shuffle: 'shop_shuffle_name' };
  var SHOP_DESC = { hint: 'shop_hint_desc', undo: 'shop_undo_desc', shuffle: 'shop_shuffle_desc' };

  function shopItem(id) {
    for (var i = 0; i < C.shop.length; i++) if (C.shop[i].id === id) return C.shop[i];
    return C.shop[0];
  }
  function priceOf(id) {
    var it = shopItem(id), b = buys();
    return Math.min(C.shopMaxPrice, it.price + it.step * (b[id] | 0));
  }

  var Shop = {
    geom: function (v) {
      var H = v.h - banner();
      var cw = Math.min(v.w * 0.92, 470);
      var ch = Math.min(H * 0.9, 430);
      var cx = (v.w - cw) / 2, cy = (H - ch) / 2;
      var head = Math.max(42, Math.min(58, ch * 0.14));
      var foot = Math.max(46, Math.min(58, ch * 0.14));
      var rowH = (ch - head - foot) / 3;
      return { cw: cw, ch: ch, cx: cx, cy: cy, head: head, foot: foot, rowH: rowH };
    },
    build: function (host, game, onClose) {
      var v = game.view, g = Shop.geom(v), list = [];
      var bw = Math.min(126, g.cw * 0.34), bh = 44;
      for (var i = 0; i < C.shop.length; i++) {
        (function (item, idx) {
          var ry = g.cy + g.head + idx * g.rowH;
          list.push(new E.ui.Button({
            x: g.cx + g.cw - bw - 12, y: ry + g.rowH / 2 - bh / 2, w: bw, h: bh,
            text: T('buy') + ' · ' + priceOf(item.id),
            bg: 'rgba(64,48,18,0.95)', border: P.brass, fg: P.brassHi, fontSize: 14,
            onTap: function () {
              var price = priceOf(item.id);
              if (coins() < price) { E.audio.sfx('deny'); host.toastT(T('not_enough')); return; }
              addCoins(-price);
              addCharges(item.id, item.pack);
              var b = buys();
              b[item.id] = (b[item.id] | 0) + 1;
              E.storage.set('buys', b);
              E.audio.sfx('buy');
              host.toastT('+' + item.pack + ' · ' + T(SHOP_NAME[item.id]));
              host.refreshShop(game);
            }
          }));
        })(C.shop[i], i);
      }
      list.push(new E.ui.Button({
        x: g.cx + g.cw / 2 - Math.min(170, g.cw * 0.55) / 2,
        y: g.cy + g.ch - g.foot + (g.foot - 44) / 2,
        w: Math.min(170, g.cw * 0.55), h: 44,
        text: T('close'), bg: 'rgba(96,72,28,0.95)', border: 'rgba(201,162,74,0.8)',
        fg: P.cream, fontSize: 16,
        onTap: function () { E.audio.sfx('click'); onClose(); }
      }));
      return list;
    },
    draw: function (ctx, v, host) {
      var g = Shop.geom(v);
      ctx.fillStyle = P.scrim;
      ctx.fillRect(0, 0, v.w, v.h);

      E.ui.roundRect(ctx, g.cx, g.cy, g.cw, g.ch, 16);
      var cg = ctx.createLinearGradient(g.cx, g.cy, g.cx, g.cy + g.ch);
      cg.addColorStop(0, '#3c2b18');
      cg.addColorStop(1, '#241810');
      ctx.fillStyle = cg; ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(201,162,74,0.55)';
      ctx.stroke();
      // латунная кромка
      E.ui.roundRect(ctx, g.cx + 5, g.cy + 5, g.cw - 10, g.ch - 10, 12);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,240,200,0.14)';
      ctx.stroke();

      var headText = host.toast ? host.toast.text : T('shop_title');
      var headColor = host.toast ? P.brass : P.brassHi;
      E.ui.text(ctx, headText, g.cx + g.cw / 2, g.cy + g.head * 0.52, Math.min(g.cw * 0.085, 26), headColor, 'center', 800);
      coinBadge(ctx, g.cx + g.cw - 12 - Math.max(78, 15 * 5.1), g.cy + 10, 14);

      for (var i = 0; i < C.shop.length; i++) {
        var item = C.shop[i];
        var ry = g.cy + g.head + i * g.rowH;
        if (i > 0) {
          ctx.beginPath();
          ctx.moveTo(g.cx + 14, ry);
          ctx.lineTo(g.cx + g.cw - 14, ry);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,240,200,0.09)';
          ctx.stroke();
        }
        var bwd = Math.min(126, g.cw * 0.34);
        var maxW = g.cw - bwd - 46;
        var nameStr = T(SHOP_NAME[item.id]) + '   ×' + chargeOf(item.id);
        var nfs = E.ui.fit(ctx, nameStr, maxW, Math.max(14, Math.min(18, g.cw * 0.05)), 700);
        E.ui.text(ctx, nameStr, g.cx + 16, ry + g.rowH * 0.33, nfs, P.cream, 'left', 700);
        var dStr = T(SHOP_DESC[item.id]);
        var dfs = E.ui.fit(ctx, dStr, maxW, Math.max(12, Math.min(14, g.cw * 0.036)), 500);
        E.ui.text(ctx, dStr, g.cx + 16, ry + g.rowH * 0.66, dfs, 'rgba(243,231,201,0.62)', 'left', 500);
      }
    }
  };

  /* ================================================================
     МЕНЮ
     ================================================================ */
  S.menu = {
    name: 'menu',
    enter: function (game) {
      this.game = game;
      this.t = 0;
      this.help = false;
      this.toast = null;
      this.buttons = [];
      E.audio.music('menu');
      E.sdk.showBanner();
      E.sdk.gameplayStop();
      this._build(game);
    },
    onResize: function (game) { this._build(game); },
    toastT: function (text) { this.toast = { t: 1.8, text: text }; },
    refreshShop: function () { /* в меню магазина нет — заглушка для общего модуля */ },

    _build: function (game) {
      var v = game.view, W = v.w, H = v.h, self = this;
      var wide = W > H * 1.15;
      var list = [];
      var bw, bh, playY;

      if (wide) {
        var pad = Math.max(14, Math.min(W, H) * 0.05);
        var colX = pad + Math.max(0, W * 0.04);
        bw = Math.min(W * 0.30, 300);
        bh = Math.min(58, Math.max(44, H * 0.14));
        playY = H * 0.53;
      } else {
        var pad2 = Math.max(12, Math.min(W, H) * 0.035);
        bw = Math.min(W * 0.80, 300);
        bh = 54;
        playY = H * 0.47;
      }

      // первая кнопка — «Играть» (е2е-гейт жмёт buttons[0])
      list.push(new E.ui.Button({
        x: (wide ? (pad + Math.max(0, W * 0.04)) : (W - bw) / 2), y: playY, w: bw, h: bh,
        text: T('play'), bg: 'rgba(74,58,20,0.96)', border: P.brass, fg: P.brassHi,
        fontSize: Math.round(bh * 0.38),
        onTap: function () {
          E.audio.sfx('click');
          game.setScene('play', { level: levelIndex() });
        }
      }));
      list.push(new E.ui.Button({
        x: (wide ? (pad + Math.max(0, W * 0.04)) : (W - bw) / 2), y: playY + bh + 12, w: bw, h: Math.max(44, bh * 0.82),
        text: T('shop_title'), bg: 'rgba(44,30,14,0.9)', border: 'rgba(201,162,74,0.5)', fg: P.cream,
        fontSize: Math.round(bh * 0.32),
        onTap: function () { E.audio.sfx('click'); game.setScene('shop', {}); }
      }));

      // сетка досок
      var cols = 4, rows = 3, gap = wide ? 10 : 8;
      var gx, gy, cw2, chh;
      if (wide) {
        var gp = Math.max(14, Math.min(W, H) * 0.05);
        var areaX = W * 0.53, areaW = W - areaX - gp;
        cw2 = Math.min(122, (areaW - (cols - 1) * gap) / cols);
        chh = Math.min(64, Math.max(44, (H * 0.5 - (rows - 1) * gap) / rows));
        var gridW = cols * cw2 + (cols - 1) * gap;
        var gridH = rows * chh + (rows - 1) * gap;
        gx = areaX + (areaW - gridW) / 2;
        gy = (H - gridH) / 2;
      } else {
        cw2 = Math.min(76, (W - 2 * 12 - (cols - 1) * gap) / cols);
        chh = Math.max(44, Math.min(56, cw2 * 0.78));
        var gridW2 = cols * cw2 + (cols - 1) * gap;
        gx = (W - gridW2) / 2;
        gy = H * 0.20;
      }
      var maxL = maxLevel(), done = doneMap();
      for (var i = 0; i < C.levels.length; i++) {
        (function (idx) {
          var lv = idx + 1;
          var lx = gx + (idx % cols) * (cw2 + gap);
          var ly = gy + Math.floor(idx / cols) * (chh + gap);
          var locked = lv > maxL;
          var solved = !!done[lv];
          var b = new E.ui.Button({
            x: lx, y: ly, w: cw2, h: chh,
            text: locked ? '' : String(lv),
            bg: locked ? 'rgba(28,18,10,0.7)' : (solved ? 'rgba(64,48,18,0.92)' : 'rgba(52,38,20,0.86)'),
            border: locked ? 'rgba(201,162,74,0.18)' : (solved ? P.brass : 'rgba(201,162,74,0.4)'),
            fg: locked ? 'rgba(243,231,201,0.3)' : P.cream,
            fontSize: Math.round(Math.min(cw2 * 0.44, chh * 0.46)),
            icon: locked ? function (ctx, bb) {
              A.lock(ctx, bb.x + bb.w / 2, bb.y + bb.h / 2, Math.min(bb.w, bb.h) * 0.36, 'rgba(243,231,201,0.3)');
            } : null,
            onTap: function () {
              if (locked) { E.audio.sfx('deny'); self.toastT(T('locked')); return; }
              E.audio.sfx('click');
              game.setScene('play', { level: lv });
            }
          });
          list.push(b);
        })(i);
      }

      // звук и правила в верхнем правом углу
      list.push(soundButton(W - 54, 10, 44, 44));
      list.push(new E.ui.Button({
        x: W - 102, y: 10, w: 44, h: 44, text: '?',
        bg: 'rgba(28,18,10,0.78)', border: 'rgba(201,162,74,0.45)', fg: P.brassHi, fontSize: 20,
        onTap: function () { E.audio.sfx('click'); self.help = !self.help; }
      }));

      this.buttons = list;
      this.wide = wide;
    },

    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.help) {
        if (E.input.pointer.pressed || E.input.wasPressed('Escape')) this.help = false;
        return;
      }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', { level: levelIndex() });
    },

    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      A.wood(ctx, W, H);

      var wide = this.wide;
      var titleSize = wide ? Math.min(W * 0.05, H * 0.095, 52) : Math.min(W * 0.088, H * 0.055, 34);
      var titleY = wide ? H * 0.20 : H * 0.085;
      var titleX = wide ? (Math.max(14, Math.min(W, H) * 0.05) + Math.max(0, W * 0.04)) : W / 2;
      var align = wide ? 'left' : 'center';

      // тёплая латунная рамка под заголовком
      if (wide) {
        E.ui.text(ctx, T('title').toUpperCase(), titleX, titleY, titleSize, P.brassHi, 'left', 800);
        E.ui.text(ctx, T('subtitle'), titleX, titleY + titleSize * 0.86, Math.min(W * 0.02, 18), 'rgba(243,231,201,0.66)', 'left', 500);
        E.ui.text(ctx, T('solved_n', { n: doneCount(), total: C.levels.length }), titleX, titleY + titleSize * 0.86 + 26, 13, P.brass, 'left', 600);
      } else {
        E.ui.text(ctx, T('title').toUpperCase(), W / 2, titleY, titleSize, P.brassHi, 'center', 800);
        E.ui.text(ctx, T('subtitle'), W / 2, titleY + titleSize * 0.82, Math.min(W * 0.04, 15), 'rgba(243,231,201,0.66)', 'center', 500);
        E.ui.text(ctx, T('solved_n', { n: doneCount(), total: C.levels.length }), W / 2, titleY + titleSize * 0.82 + 24, 12, P.brass, 'center', 600);
      }

      coinBadge(ctx, 14, 12, 14);
      E.ui.drawButtons(ctx, this.buttons);
      toastDraw(ctx, this, v);

      var bm = banner();
      E.ui.text(ctx, T('footer'), W / 2, H - 22 - bm, Math.min(W * 0.032, 12), 'rgba(243,231,201,0.36)', 'center', 500);

      if (this.help) {
        ctx.fillStyle = 'rgba(14,8,4,0.94)';
        ctx.fillRect(0, 0, W, H);
        var hy = Math.max(60, H * 0.24);
        E.ui.text(ctx, T('rules_title'), W / 2, hy, Math.min(W * 0.075, 30), P.brassHi, 'center', 800);
        var lines = [T('rules_1'), T('rules_2'), T('rules_3')];
        var lw = Math.min(W * 0.86, 560);
        for (var k = 0; k < 3; k++) {
          var fs = E.ui.fit(ctx, lines[k], lw, Math.max(13, Math.min(W * 0.038, 16)), 500);
          E.ui.text(ctx, lines[k], W / 2, hy + 50 + k * 46, fs, P.cream, 'center', 500);
        }
        E.ui.text(ctx, T('back'), W / 2, Math.min(H - 70, hy + 210), 15, 'rgba(243,231,201,0.6)', 'center', 600);
      }
    },

    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================
     МАГАЗИН (отдельная сцена из меню)
     ================================================================ */
  S.shop = {
    name: 'shop',
    enter: function (game) {
      this.game = game;
      this.t = 0;
      this.toast = null;
      E.audio.music('menu');
      E.sdk.showBanner();
      E.sdk.gameplayStop();
      this.refreshShop(game);
    },
    onResize: function (game) { this.refreshShop(game); },
    toastT: function (text) { this.toast = { t: 1.8, text: text }; },
    refreshShop: function (game) {
      var self = this;
      this.buttons = Shop.build(this, game, function () {
        E.audio.sfx('click');
        game.setScene('menu', {});
      });
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Escape')) game.setScene('menu', {});
    },
    draw: function (game, ctx) {
      A.wood(ctx, game.view.w, game.view.h);
      Shop.draw(ctx, game.view, this);
      E.ui.drawButtons(ctx, this.buttons);
    },
    getCaptureState: function () { return { scene: 'shop' }; }
  };

  /* ================================================================
     ИГРА
     ================================================================ */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.t = 0;
      this.mode = 'running';
      this.pausePrev = 'running';
      this.anim = [];
      this.hint = null;
      this.toast = null;
      this.result = null;
      this.pending = null;
      this.captureMode = false;
      this.reviveUsed = false;
      this.doubled = false;
      this.reward = 0;
      this.autoTimer = 0;
      this.autoNext = 0;
      this.shakeT = 0;
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      this.buttons = [];
      this.endButtons = [];
      this.shopButtons = [];
      this.pauseBtn = null;

      this.level = clamp(params.level != null ? (params.level | 0) : (cp.wave != null ? (cp.wave | 0) : levelIndex()), 1, C.levels.length);
      this.seed = (params.seed != null) ? params.seed : (E.capture.seed != null ? E.capture.seed : (Date.now() % 999983));
      this.rng = new E.Rng((this.seed | 0) + this.level * 7919);
      this.st = L.newPuzzle(this.rng, C.levels[this.level - 1]);

      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this._rebuild(game);
      if (E.capture.active) this.applyCapture(game);
    },


    onResize: function (game) { this._rebuild(game); },
    onBack: function (game) {
      if (this.mode === 'shop') { this._closeShop(game); return; }
      if (this.mode === 'paused') { this._setPaused(false, game); return; }
      if (this.mode === 'running') { this._setPaused(true, game); return; }
      this._leave(game, 'menu', {});
    },
    exit: function () { E.sdk.gameplayStop(); },

    toastT: function (text) { this.toast = { t: 1.8, text: text }; },

    /* ---------- раскладка ---------- */
    layout: function (v) {
      var W = v.w, H = v.h, bm = banner();
      var pad = Math.max(10, Math.min(W, H) * 0.026);
      var wide = W > H * 1.25;
      var n = this.st ? this.st.n : 4;
      if (wide) {
        var avail = H - pad * 2 - bm - 10;
        var size = Math.min(avail, W * 0.56);
        var bx = pad + Math.max(0, (W * 0.54 - size) / 2);
        var by = pad + (H - bm - size) / 2;
        var panelX = bx + size + Math.max(16, W * 0.028);
        return {
          W: W, H: H, pad: pad, banner: bm, wide: true, n: n,
          size: size, bx: bx, by: by,
          panelX: panelX, panelW: Math.max(120, W - panelX - pad),
          cell: size / n
        };
      }
      var topH = 104;
      var botH = 60 + bm;
      var availW = W - pad * 2;
      var availH = H - topH - botH - 14;
      var s2 = Math.min(availW, availH);
      return {
        W: W, H: H, pad: pad, banner: bm, wide: false, n: n,
        size: s2,
        bx: (W - s2) / 2,
        by: topH + (availH - s2) / 2,
        panelX: 0, panelW: 0,
        cell: s2 / n
      };
    },

    boardGeom: function (Lt) {
      var frame = Math.max(5, Lt.size * 0.045);
      var inner = Lt.size - frame * 2;
      return { frame: frame, inner: inner, x0: Lt.bx + frame, y0: Lt.by + frame, cell: inner / this.st.n };
    },

    /* ---------- сборка кнопок ---------- */
    _rebuild: function (game) {
      var self = this, Lt = this.layout(game.view), list = [];
      this.pauseBtn = this._pauseButton(game, Lt);

      if (this.mode === 'paused') {
        this.endButtons = this._endButtons(game, Lt, 'paused');
        this.buttons = this.endButtons;
        return;
      }
      if (this.mode === 'win') {
        this.endButtons = this._endButtons(game, Lt, 'win');
        this.buttons = this.endButtons;
        return;
      }
      if (this.mode === 'over') {
        this.endButtons = this._endButtons(game, Lt, 'over');
        this.buttons = this.endButtons;
        return;
      }
      if (this.mode === 'shop') {
        this.shopButtons = Shop.build(this, game, function () { self._closeShop(game); });
        this.buttons = this.shopButtons;
        return;
      }

      this.endButtons = [];
      list = this._actionButtons(game, Lt);
      list.push(this.pauseBtn);
      this.buttons = list;
    },

    _pauseButton: function (game, Lt) {
      var self = this;
      return new E.ui.Button({
        x: Lt.W - Lt.pad - 44, y: Lt.pad, w: 44, h: 44,
        bg: 'rgba(28,18,10,0.8)', border: 'rgba(201,162,74,0.45)',
        icon: function (ctx, b) {
          var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
          ctx.fillStyle = P.brassHi;
          E.ui.roundRect(ctx, cx - 8, cy - 9, 6, 18, 2); ctx.fill();
          E.ui.roundRect(ctx, cx + 2, cy - 9, 6, 18, 2); ctx.fill();
        },
        onTap: function () { E.audio.sfx('click'); self._setPaused(true, game); }
      });
    },

    _actionButtons: function (game, Lt) {
      var self = this, out = [];
      var defs = [
        { id: 'hint', label: T('hint') },
        { id: 'undo', label: T('undo') },
        { id: 'shuffle', label: T('shuffle') },
        { id: 'shop', label: T('shop_title') }
      ];
      var i, d;
      function iconFor(label, count) {
        return function (ctx, b) {
          var fs = Math.max(12, Math.min(15, b.w * 0.155));
          E.ui.text(ctx, label, b.x + b.w / 2, b.y + b.h / 2, fs,
            count > 0 ? P.cream : 'rgba(243,231,201,0.5)', 'center', 600);
          if (count > 0) {
            var r = Math.max(8, Math.min(11, b.w * 0.105));
            var cx = b.x + b.w - r - 7, cy = b.y + b.h - r - 6;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = P.brass; ctx.fill();
            E.ui.text(ctx, String(count), cx, cy + 1, Math.round(r * 1.25), P.brassInk, 'center', 800);
          }
        };
      }
      function make(d, x, y, w, h) {
        var shop = d.id === 'shop';
        return new E.ui.Button({
          x: x, y: y, w: w, h: h,
          text: shop ? d.label : '',
          icon: shop ? null : iconFor(d.label, chargeOf(d.id)),
          bg: shop ? 'rgba(112,85,32,0.95)' : 'rgba(86,64,28,0.94)',
          border: 'rgba(201,162,74,0.8)',
          fg: P.cream,
          fontSize: Math.max(12, Math.min(15, w * 0.12)),
          onTap: function () { self._action(d.id, game); }
        });
      }
      if (Lt.wide) {
        var bw = Math.min(Lt.panelW, 260), gap = 8;
        // стек центрируется по доступной высоте и гарантированно влезает в экран
        var bh = Math.min(48, Math.max(36, (Lt.H - Lt.pad * 2 - Lt.banner - 40 - gap * (defs.length - 1)) / defs.length));
        var stackH = bh * defs.length + gap * (defs.length - 1);
        var y0 = Lt.pad + Math.max(0, (Lt.H - Lt.banner - Lt.pad * 2 - stackH) / 2);
        for (i = 0; i < defs.length; i++) {
          d = defs[i];
          out.push(make(d, Lt.panelX + (Lt.panelW - bw) / 2, y0 + i * (bh + gap), bw, bh));
        }
      } else {
        var gap2 = 6;
        var bw2 = (Lt.W - Lt.pad * 2 - gap2 * 3) / 4;
        var y2 = Lt.H - Lt.banner - 54;
        for (i = 0; i < defs.length; i++) {
          d = defs[i];
          out.push(make(d, Lt.pad + i * (bw2 + gap2), y2, bw2, 44));
        }
      }
      return out;
    },

    _endButtons: function (game, Lt, kind) {
      var self = this, list = [];
      var bw = Math.min(300, Lt.W * 0.78);
      var bh = Math.min(52, Math.max(44, Lt.H * 0.095));
      var gap = 10;
      var count = kind === 'paused' ? 4 : 3;
      var totalH = count * bh + (count - 1) * gap;
      var y0 = Lt.H * 0.5 - totalH / 2 + Math.min(64, Lt.H * 0.1);
      var x = Lt.W / 2 - bw / 2;
      var i = 0;
      function add(text, bg, border, fg, fs, fn) {
        list.push(new E.ui.Button({ x: x, y: y0 + i * (bh + gap), w: bw, h: bh, text: text,
          bg: bg, border: border, fg: fg, fontSize: fs, onTap: fn }));
        i++;
      }

      if (kind === 'paused') {
        add(T('pause_resume'), 'rgba(64,48,18,0.96)', P.brass, P.brassHi, 17, function () {
          E.audio.sfx('click'); self._setPaused(false, game);
        });
        add(T('pause_restart'), 'rgba(44,30,14,0.92)', 'rgba(201,162,74,0.45)', P.cream, 16, function () {
          E.audio.sfx('click'); game.setScene('play', { level: self.level, seed: self.seed });
        });
        add(T(E.audio.isMuted() ? 'sound_off' : 'sound_on'), 'rgba(36,24,12,0.9)', 'rgba(201,162,74,0.3)', P.dim, 14, function (btn) {
          var m = !E.audio.isMuted();
          E.audio.setMuted(m);
          E.storage.set('muted', m);
          btn.text = T(E.audio.isMuted() ? 'sound_off' : 'sound_on');
        });
        add(T('pause_menu'), 'rgba(30,20,10,0.9)', 'rgba(201,162,74,0.25)', P.cream, 15, function () {
          E.audio.sfx('click'); self._leave(game, 'menu', {});
        });
      } else if (kind === 'win') {
        var last = this.level >= C.levels.length;
        add(last ? T('to_menu') : T('next_level'), 'rgba(64,48,18,0.96)', P.brass, P.brassHi, 17, function () {
          E.audio.sfx('click');
          if (last) self._leave(game, 'menu', {});
          else self._leave(game, 'play', { level: self.level + 1 });
        });
        if (!this.doubled) {
          add(T('double_coins'), 'rgba(44,30,14,0.94)', P.brass, P.cream, 15, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.doubled = true;
                addCoins(self.reward);
                E.audio.sfx('coin');
                self._rebuild(game);
              },
              onDone: function (ok) {
                if (!ok) { E.audio.sfx('deny'); self.toastT(T('ad_fail')); }
              }
            });
          });
        }
        add(T('to_menu'), 'rgba(30,20,10,0.9)', 'rgba(201,162,74,0.25)', P.dim, 14, function () {
          E.audio.sfx('click'); self._leave(game, 'menu', {});
        });
      } else {
        if (!this.reviveUsed) {
          add(T('second_chance'), 'rgba(64,48,18,0.96)', P.brass, P.cream, 16, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.reviveUsed = true;
                self.st.limit += C.ads.continueMoves;
                self.mode = 'running';
                self.result = null;
                E.sdk.gameplayStart();
                E.audio.sfx('revive');
                self.toastT(T('free_moves', { n: C.ads.continueMoves }));
                self._rebuild(game);
              },
              onDone: function (ok) {
                if (!ok) { E.audio.sfx('deny'); self.toastT(T('ad_fail')); }
              }
            });
          });
        }
        add(T('retry'), 'rgba(44,30,14,0.94)', 'rgba(201,162,74,0.45)', P.cream, 16, function () {
          E.audio.sfx('click'); game.setScene('play', { level: self.level, seed: self.seed });
        });
        add(T('to_menu'), 'rgba(30,20,10,0.9)', 'rgba(201,162,74,0.25)', P.dim, 14, function () {
          E.audio.sfx('click'); self._leave(game, 'menu', {});
        });
      }
      return list;
    },

    /* ---------- магазин-оверлей ---------- */
    openShop: function (game) {
      if (this.mode !== 'running' && this.mode !== 'shop') return;
      this.pausePrev = this.mode === 'shop' ? this.pausePrev : this.mode;
      this.mode = 'shop';
      this._rebuild(game);
    },
    _closeShop: function (game) {
      if (this.mode !== 'shop') return;
      this.mode = 'running';
      this._rebuild(game);
    },
    refreshShop: function (game) {
      if (this.mode === 'shop') this._rebuild(game);
    },

    /* ---------- пауза и исходы ---------- */
    _setPaused: function (on, game) {
      if (on) {
        if (this.mode !== 'running' && this.mode !== 'shop') return;
        this.pausePrev = this.mode;
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this._rebuild(game);
      } else if (this.mode === 'paused') {
        this.mode = this.pausePrev === 'shop' ? 'shop' : 'running';
        if (this.mode === 'running') E.sdk.gameplayStart();
        this._rebuild(game);
      }
    },

    _countRun: function () { addRun(); },

    _onWin: function (game, capture) {
      if (this.mode === 'win') return;
      var st = this.st;
      var reward = C.coins.base + this.level * C.coins.perLevel + L.movesLeft(st) * C.coins.perMove;
      this.reward = reward;
      this.doubled = false;
      this.result = { win: true, reward: reward };
      addCoins(reward);
      E.audio.sfx('win');
      this.mode = 'win';
      E.sdk.gameplayStop();
      if (!capture) {
        this._countRun();
        var done = doneMap();
        var prev = done[this.level] | 0;
        if (!prev || st.moves < prev) done[this.level] = st.moves;
        E.storage.set('done', done);
        if (this.level >= maxLevel()) setMaxLevel(Math.min(C.levels.length, this.level + 1));
        if (this.level >= levelIndex()) setLevel(Math.min(C.levels.length, this.level + 1));
      }
      this._rebuild(game);
      if (this.autopilot) this.autoNext = C.timing.autoNext;
    },

    _onOver: function (game, capture) {
      if (this.mode === 'over') return;
      this.result = { win: false };
      this.mode = 'over';
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      if (!capture) this._countRun();
      this._rebuild(game);
      if (this.autopilot) this.autoNext = C.timing.autoNext;
    },

    _leave: function (game, target, params) {
      var needAd = !this.captureMode && !this.autopilot &&
        (runs() % C.ads.interstitialEvery === 0);
      if (needAd) {
        E.sdk.showInterstitial(function () { game.setScene(target, params || {}); });
        return;
      }
      game.setScene(target, params || {});
    },

    /* ---------- действия ---------- */
    _action: function (id, game) {
      if (id === 'shop') { E.audio.sfx('click'); this.openShop(game); return; }
      if (id === 'hint') { this._useHint(game); return; }
      if (id === 'undo') { this._useUndo(game); return; }
      if (id === 'shuffle') { this._useShuffle(game); return; }
    },

    _useShuffle: function (game) {
      if (chargeOf('shuffle') <= 0) {
        E.audio.sfx('deny');
        this.toastT(T('no_charges'));
        this.openShop(game);
        return;
      }
      useCharge('shuffle');
      var seed = this.rng.int(1, 999983);
      this.rng = new E.Rng(seed + this.level * 7919);
      this.st = L.newPuzzle(this.rng, C.levels[this.level - 1]);
      this.anim.length = 0;
      this.hint = null;
      E.audio.sfx('buy');
      this.toastT(T('shuffle_done'));
      this._rebuild(game);
    },

    _useHint: function (game) {
      if (chargeOf('hint') <= 0) {
        E.audio.sfx('deny');
        this.toastT(T('no_charges'));
        this.openShop(game);
        return;
      }
      useCharge('hint');
      var slot = L.nextHint(this.st);
      this.hint = { slot: slot, t: C.timing.hintTime };
      E.audio.sfx('pulse');
      this.toastT(T('hint_on'));
      this._rebuild(game);
    },

    _useUndo: function (game) {
      if (chargeOf('undo') <= 0) {
        E.audio.sfx('deny');
        this.toastT(T('no_charges'));
        this.openShop(game);
        return;
      }
      if (!L.undo(this.st)) { E.audio.sfx('deny'); return; }
      useCharge('undo');
      this.anim.length = 0;
      this.hint = null;
      E.audio.sfx('click');
      this.toastT(T('undo_done'));
      this._rebuild(game);
    },

    /* ---------- ходы ---------- */
    _doMove: function (game, slot, auto) {
      var st = this.st;
      if (this.pending || this.mode !== 'running') return;
      if (!L.canMove(st, slot)) {
        if (!auto) { E.audio.sfx('deny'); this.shakeT = 0.2; }
        return;
      }
      var val = st.tiles[slot];
      var from = st.empty;
      L.move(st, slot);
      this.anim.push({ v: val, a: slot, b: from, t: 0 });
      this.hint = null;
      E.audio.sfx(auto ? 'tick' : 'click');
      if (L.solved(st)) {
        this.pending = { kind: 'win', t: C.timing.resultDelay };
        E.audio.sfx('win');
      } else if (st.moves >= st.limit) {
        this.pending = { kind: 'over', t: C.timing.resultDelay };
      }
      this._rebuild(game);
    },

    _tapBoard: function (game, x, y) {
      var Lt = this.layout(game.view), st = this.st;
      var g = this.boardGeom(Lt);
      if (x < g.x0 || y < g.y0) return;
      var c = Math.floor((x - g.x0) / g.cell);
      var r = Math.floor((y - g.y0) / g.cell);
      if (c < 0 || c >= st.n || r < 0 || r >= st.n) return;
      var slot = r * st.n + c;
      if (st.tiles[slot] === 0) return;
      this._doMove(game, slot, false);
    },

    /* ---------- update ---------- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }
      if (this.shakeT > 0) this.shakeT -= dt;
      for (var ai = this.anim.length - 1; ai >= 0; ai--) {
        this.anim[ai].t += dt;
        if (this.anim[ai].t >= C.timing.moveDur) this.anim.splice(ai, 1);
      }

      if (this.pending) {
        this.pending.t -= dt;
        if (this.pending.t <= 0) {
          var kind = this.pending.kind;
          this.pending = null;
          if (kind === 'win') this._onWin(game, false);
          else this._onOver(game, false);
        }
        return;
      }

      if (this.autoNext > 0) {
        this.autoNext -= dt;
        if (this.autoNext <= 0) {
          var next = this.level < C.levels.length ? this.level + 1 : 1;
          game.setScene('play', { level: next, seed: (this.seed + 7919) % 999983 });
          return;
        }
      }

      var ptr = E.input.pointer;

      if (this.mode === 'running') {
        if (this.autopilot) {
          this.autoTimer += dt;
          if (this.autoTimer >= C.timing.autoDelay) {
            this.autoTimer = 0;
            if (!L.solved(this.st)) this._doMove(game, L.nextHint(this.st), true);
          }
        } else if (ptr.pressed) {
          if (!E.ui.handleTap(this.buttons, ptr.x, ptr.y)) this._tapBoard(game, ptr.x, ptr.y);
        }
        if (E.input.wasPressed('Escape')) this._setPaused(true, game);
        return;
      }

      if (this.mode === 'paused') {
        if (ptr.pressed) E.ui.handleTap(this.buttons, ptr.x, ptr.y);
        if (E.input.wasPressed('Escape')) this._setPaused(false, game);
        return;
      }

      if (this.mode === 'shop') {
        if (ptr.pressed) E.ui.handleTap(this.buttons, ptr.x, ptr.y);
        if (E.input.wasPressed('Escape')) this._closeShop(game);
        return;
      }

      if (this.mode === 'win' || this.mode === 'over') {
        if (ptr.pressed) E.ui.handleTap(this.buttons, ptr.x, ptr.y);
        if (E.input.wasPressed('Escape')) this._leave(game, 'menu', {});
      }
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, Lt = this.layout(v);
      A.wood(ctx, v.w, v.h);
      this._drawBoard(ctx, Lt);

      if (Lt.wide) this._drawPanel(ctx, Lt);
      else this._drawTopHud(ctx, Lt);

      if (this.mode === 'shop') {
        Shop.draw(ctx, v, this);
        E.ui.drawButtons(ctx, this.buttons);
        return;
      }

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        this._drawEnd(ctx, Lt);
        E.ui.drawButtons(ctx, this.buttons);
        return;
      }

      E.ui.drawButtons(ctx, this.buttons);
      toastDraw(ctx, this, v);
    },

    _drawBoard: function (ctx, Lt) {
      var st = this.st, n = st.n;
      var shake = this.shakeT > 0 ? Math.sin(this.shakeT * 60) * 5 * (this.shakeT / 0.2) : 0;
      ctx.save();
      ctx.translate(shake, 0);
      var base = A.boardBase(ctx, Lt.bx, Lt.by, Lt.size);
      var cell = base.inner / n;
      var gap = Math.max(2, cell * 0.06);
      var animTo = {};
      for (var a = 0; a < this.anim.length; a++) animTo[this.anim[a].b] = true;

      function rect(i) {
        var r = (i / n) | 0, c = i % n;
        return {
          x: base.x0 + c * cell + gap / 2,
          y: base.y0 + r * cell + gap / 2,
          w: cell - gap,
          h: cell - gap
        };
      }

      for (var i = 0; i < n * n; i++) {
        var val = st.tiles[i];
        var rc = rect(i);
        if (!val) { A.slot(ctx, rc.x, rc.y, rc.w, rc.h); continue; }
        if (animTo[i]) continue;
        var hintOn = !!(this.hint && this.hint.slot === i);
        A.tile(ctx, rc.x, rc.y, rc.w, rc.h, val, { hint: hintOn, pulse: this.t });
      }

      for (var k = 0; k < this.anim.length; k++) {
        var an = this.anim[k];
        var p = clamp(an.t / C.timing.moveDur, 0, 1);
        var e = easeOut(p);
        var r1 = rect(an.a), r2 = rect(an.b);
        A.tile(ctx, lerp(r1.x, r2.x, e), lerp(r1.y, r2.y, e), r1.w, r1.h, an.v,
          { lift: Math.sin(e * Math.PI) * cell * 0.06 });
      }
      ctx.restore();
    },

    _drawTopHud: function (ctx, Lt) {
      var W = Lt.W, st = this.st;
      E.ui.text(ctx, T('level_n', { n: this.level }), Lt.pad, Lt.pad + 18, Math.min(18, W * 0.05), P.cream, 'left', 700);
      E.ui.text(ctx, T('size_n', { n: st.n }), Lt.pad, Lt.pad + 38, 12, P.dim, 'left', 500);

      var y2 = Lt.pad + 64;
      var low = st.moves >= st.limit - 3;
      var bw = Math.max(78, 15 * 5.1);
      coinBadge(ctx, Lt.pad, y2 - 14, 15);
      E.ui.text(ctx, T('moves_n', { n: st.moves, max: st.limit }), Lt.pad + bw + 12, y2, 13, low ? '#e0915c' : P.cream, 'left', 600);
      E.ui.text(ctx, T('par_n', { n: st.par }), W - Lt.pad, y2, 13, P.dim, 'right', 500);

      // индикатор лимита
      var barW = W - Lt.pad * 2, barY = Lt.pad + 82;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      E.ui.roundRect(ctx, Lt.pad, barY, barW, 4, 2); ctx.fill();
      var k = clamp(st.moves / Math.max(1, st.limit), 0, 1);
      ctx.fillStyle = low ? '#d8794a' : P.brass;
      E.ui.roundRect(ctx, Lt.pad, barY, Math.max(2, barW * k), 4, 2); ctx.fill();
    },

    _drawPanel: function (ctx, Lt) {
      var st = this.st, x = Lt.panelX, w = Lt.panelW;
      var titleSize = Math.min(26, Math.max(16, w * 0.075));
      E.ui.text(ctx, T('level_n', { n: this.level }), x, Lt.by + titleSize * 0.5, titleSize, P.cream, 'left', 800);
      E.ui.text(ctx, T('size_n', { n: st.n }), x, Lt.by + titleSize + 14, 13, P.dim, 'left', 500);

      coinBadge(ctx, x, Lt.by + titleSize + 30, 15);

      var my = Lt.by + titleSize + 92;
      var low = st.moves >= st.limit - 3;
      E.ui.text(ctx, T('moves_n', { n: st.moves, max: st.limit }), x, my, Math.min(18, Math.max(13, w * 0.05)), low ? '#e0915c' : P.cream, 'left', 700);
      E.ui.text(ctx, T('par_n', { n: st.par }), x, my + 24, 13, P.dim, 'left', 500);

      var barW = Math.min(w, 260), barY = my + 42;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      E.ui.roundRect(ctx, x, barY, barW, 5, 2.5); ctx.fill();
      var k = clamp(st.moves / Math.max(1, st.limit), 0, 1);
      ctx.fillStyle = low ? '#d8794a' : P.brass;
      E.ui.roundRect(ctx, x, barY, Math.max(2, barW * k), 5, 2.5); ctx.fill();
    },

    _drawEnd: function (ctx, Lt) {
      ctx.fillStyle = P.scrim;
      ctx.fillRect(0, 0, Lt.W, Lt.H);
      var first = this.endButtons.length ? this.endButtons[0].y : Lt.H * 0.5;
      var titleY = Math.max(Lt.H * 0.13, first - 118);
      var title, sub, color;
      if (this.mode === 'paused') {
        title = T('paused'); sub = ''; color = P.brassHi;
      } else if (this.mode === 'win') {
        title = T('win_title'); sub = T('win_sub', { n: this.st.moves }); color = P.win;
      } else {
        title = T('over_title'); sub = T('over_sub'); color = '#e07a5a';
      }
      var tfs = E.ui.fit(ctx, title, Lt.W * 0.9, Math.min(Lt.W * 0.105, Lt.H * 0.11, 44), 800);
      E.ui.text(ctx, title, Lt.W / 2, titleY, tfs, color, 'center', 800);
      if (sub) {
        var sfs = E.ui.fit(ctx, sub, Lt.W * 0.86, Math.min(Lt.W * 0.04, 16), 500);
        E.ui.text(ctx, sub, Lt.W / 2, titleY + Math.max(28, Lt.W * 0.055), sfs, 'rgba(243,231,201,0.78)', 'center', 500);
      }
      if (this.mode === 'win' && this.result) {
        var pw = 170, py = titleY + Math.max(56, Lt.W * 0.09);
        pill(ctx, Lt.W / 2 - pw / 2, py, pw, 36, 'rgba(24,14,6,0.8)', 'rgba(201,162,74,0.45)');
        A.coin(ctx, Lt.W / 2 - pw / 2 + 22, py + 18, 10);
        E.ui.text(ctx, T('won_coins', { n: this.doubled ? this.result.reward * 2 : this.result.reward }),
          Lt.W / 2 + 8, py + 18, 15, P.brassHi, 'center', 700);
      }
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.captureMode = true;
      if (cp.coins != null && !isNaN(+cp.coins)) E.storage.set('coins', Math.max(0, +cp.coins | 0));
      else E.storage.set('coins', 240);

      var t = parseFloat(cp.t);
      if (t > 0) {
        var steps = Math.min(Math.floor(t / C.timing.autoDelay), Math.max(0, this.st.par - 3));
        for (var i = 0; i < steps; i++) {
          if (!L.applyStep(this.st)) break;
        }
      }

      var mode = cp.mode;
      if (mode === 'shop') {
        this.mode = 'shop';
        this._rebuild(game);
      } else if (mode === 'win') {
        for (var k = 0; k < 200 && !L.solved(this.st); k++) L.applyStep(this.st);
        this._onWin(game, true);
      } else if (mode === 'over') {
        this.st.moves = this.st.limit;
        this.mode = 'over';
        this.result = { win: false };
        this._rebuild(game);
      } else {
        this.mode = 'running';
        this._rebuild(game);
      }
    },

    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') {
        this.mode = 'shop';
        this._rebuild(game);
      } else if (s.mode === 'over') {
        this.st.moves = this.st.limit;
        this.mode = 'over';
        this.result = { win: false };
        this._rebuild(game);
      } else if (s.mode === 'win') {
        for (var k = 0; k < 200 && !L.solved(this.st); k++) L.applyStep(this.st);
        this._onWin(game, true);
      } else if (s.mode === 'running') {
        this.mode = 'running';
        this._rebuild(game);
      }
    },

    getCaptureState: function () {
      return {
        scene: 'play',
        mode: this.mode,
        level: this.level,
        size: this.st ? this.st.n : 0,
        moves: this.st ? this.st.moves : 0,
        par: this.st ? this.st.par : 0
      };
    }
  };

  G.scenes = S;
})(window.GAME);
