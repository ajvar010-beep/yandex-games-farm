/* game/scenes.js — «Пульс»: меню, выбор песни, сцена игры, магазин, пауза и итоги.
   Вся механика — в game/logic.js; здесь сессия, ввод, экономика, отрисовка и реклама. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};

  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var SONG_NAME = {
    1: 'song_1', 2: 'song_2', 3: 'song_3', 4: 'song_4',
    5: 'song_5', 6: 'song_6', 7: 'song_7', 8: 'song_8',
    9: 'song_9', 10: 'song_10', 11: 'song_11', 12: 'song_12'
  };
  var DIFF_NAME = ['diff_easy', 'diff_normal', 'diff_hard', 'diff_expert'];
  var GRADE_TXT = {
    perfect: 'judge_perfect', great: 'judge_great', good: 'judge_good', miss: 'judge_miss'
  };
  var KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  var ARROWS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
  var DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

  /* ---------------- мета / сохранения ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.coins.start; E.storage.set('coins', c); }
      return c | 0;
    },
    addCoins: function (n) { E.storage.set('coins', Math.max(0, Meta.coins() + (n | 0))); },
    stage: function () { return clamp((E.storage.get('stage', 1) | 0) || 1, 1, C.stages); },
    setStage: function (n) { E.storage.set('stage', clamp(n | 0, 1, C.stages)); },
    best: function () {
      var b = E.storage.get('best', null);
      return (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
    },
    bestFor: function (stage) { return Meta.best()[stage] | 0; },
    setBest: function (stage, score) {
      var b = Meta.best();
      if ((b[stage] | 0) < (score | 0)) { b[stage] = score | 0; E.storage.set('best', b); }
    },
    ranks: function () {
      var r = E.storage.get('ranks', null);
      return (r && typeof r === 'object' && !Array.isArray(r)) ? r : {};
    },
    setRank: function (stage, rank) {
      var r = Meta.ranks();
      var order = { C: 0, B: 1, A: 2, S: 3 };
      if (!r[stage] || (order[rank] || 0) > (order[r[stage]] || 0)) { r[stage] = rank; E.storage.set('ranks', r); }
    },
    shopLevels: function () {
      var s = E.storage.get('shop', null);
      s = (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
      var out = {};
      for (var i = 0; i < C.shop.length; i++) {
        out[C.shop[i].id] = clamp(s[C.shop[i].id] | 0, 0, C.shop[i].max);
      }
      return out;
    },
    saveShop: function (s) { E.storage.set('shop', s); },
    cost: function (item, lvl) { return item.base + item.step * lvl; },
    runs: function () { return E.storage.get('runs', 0) | 0; },
    addRun: function () { E.storage.set('runs', Meta.runs() + 1); },
    submit: function (score) { E.sdk.submitScore('pulseref_score', score); }
  };

  function slowSecs(lv) { return lv > 0 ? 10 + (lv - 1) * C.shopStep.slow : 0; }
  function coinMultOf(lv) { return 1 + lv * C.shopStep.coin; }
  function shopView(item) {
    var lv = Meta.shopLevels()[item.id] | 0;
    var maxed = lv >= item.max;
    var next = maxed ? lv : lv + 1;
    var desc;
    if (item.id === 'shield') desc = T(item.desc, { n: next });
    else if (item.id === 'slow') desc = T(item.desc, { n: slowSecs(next) });
    else desc = T(item.desc, { x: (Math.round(coinMultOf(next) * 10) / 10).toString() });
    return { lv: lv, maxed: maxed, cost: Meta.cost(item, lv), next: next, desc: desc };
  }

  /* ---------------- мелкая графика ---------------- */
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function coinsBadge(ctx, x, y, val) {
    var h = 32, w = 100;
    pill(ctx, x, y, w, h, 'rgba(8,4,20,0.62)', 'rgba(255,209,102,0.35)');
    A.coin(ctx, x + 17, y + h / 2, 9.5);
    E.ui.text(ctx, String(val), x + 31, y + h / 2 + 1, 16, P.gold, 'left', 700);
  }
  function soundButton(x, y) {
    return new E.ui.Button({
      x: x, y: y, w: 44, h: 44, bg: 'rgba(8,4,20,0.62)', border: 'rgba(255,209,102,0.35)',
      icon: function (ctx, b) {
        var mm = E.audio.isMuted();
        E.ui.text(ctx, mm ? '♪̸' : '♪', b.x + b.w / 2, b.y + b.h / 2 + 1, 17, mm ? P.dim : P.gold, 'center', 700);
      },
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
  }

  /* ---------------- магазин (общий для меню и игры) ---------------- */
  function makeShop(game, onClose) {
    var self = {
      game: game, onClose: onClose, buttons: [], cards: [],
      msg: null, msgT: 0
    };
    self.build = function () {
      var v = game.view, W = v.w, H = v.h;
      var pad = Math.max(10, Math.min(W, H) * 0.03);
      var cardW = Math.min(560, W - pad * 2);
      var n = C.shop.length;
      var top = H * 0.235;
      var cardH = clamp((H * 0.58) / n - 10, 58, 116);
      var list = [], i;
      self.cards = [];
      for (i = 0; i < n; i++) {
        (function (item, idx) {
          var x = (W - cardW) / 2, y = top + idx * (cardH + 10);
          var view = shopView(item);
          var bw = Math.min(108, cardW * 0.30), bh = Math.min(46, Math.max(44, cardH - 12));
          var bx = x + cardW - bw - 10;
          self.cards.push({ item: item, x: x, y: y, w: cardW, h: cardH, view: view, btnX: bx, btnW: bw });
          list.push(new E.ui.Button({
            x: bx, y: y + cardH / 2 - bh / 2, w: bw, h: bh,
            text: view.maxed ? T('maxed') : String(view.cost),
            bg: view.maxed ? 'rgba(26,12,40,0.9)' : '#2a1450',
            border: view.maxed ? 'rgba(120,100,160,0.4)' : P.gold,
            fg: view.maxed ? P.dim : P.cream, fontSize: 15,
            enabled: !view.maxed,
            onTap: function () { self.buy(item); }
          }));
        })(C.shop[i], i);
      }
      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      list.push(new E.ui.Button({
        x: W / 2 - 80, y: H - banM - 60, w: 160, h: 46, text: T('back'),
        bg: 'rgba(18,8,32,0.9)', border: 'rgba(162,148,201,0.32)', fg: P.cream, fontSize: 17,
        onTap: function () { E.audio.sfx('click'); self.close(); }
      }));
      self.buttons = list;
    };
    self.close = function () { if (self.onClose) self.onClose(); };
    self.toast = function (text) { self.msg = text; self.msgT = 1.6; };
    self.buy = function (item) {
      var view = shopView(item);
      if (view.maxed) return;
      if (Meta.coins() < view.cost) { E.audio.sfx('deny'); self.toast(T('not_enough')); return; }
      Meta.addCoins(-view.cost);
      var s = Meta.shopLevels();
      s[item.id] = (s[item.id] | 0) + 1;
      Meta.saveShop(s);
      E.audio.sfx('buy');
      self.build();
    };
    self.update = function (dt) {
      if (self.msgT > 0) { self.msgT -= dt; if (self.msgT <= 0) self.msg = null; }
      if (E.input.wasPressed('Escape')) { self.close(); return; }
      if (E.input.pointer.pressed) E.ui.handleTap(self.buttons, E.input.pointer.x, E.input.pointer.y);
    };
    self.draw = function (ctx) {
      var v = game.view, W = v.w, H = v.h, i;
      ctx.fillStyle = 'rgba(6,3,16,0.95)';
      ctx.fillRect(0, 0, W, H);
      E.ui.text(ctx, T('shop_title'), W / 2, H * 0.095, Math.min(W * 0.075, 32), P.gold, 'center', 800);
      E.ui.text(ctx, T('shop_hint'), W / 2, H * 0.095 + 25, Math.min(W * 0.035, 13), 'rgba(246,233,255,0.6)', 'center', 500);
      coinsBadge(ctx, 14, 14, Meta.coins());
      for (i = 0; i < self.cards.length; i++) {
        var c = self.cards[i], it = c.item, view = c.view;
        pill(ctx, c.x, c.y, c.w, c.h, 'rgba(24,10,44,0.95)', 'rgba(255,45,149,0.28)');
        E.ui.text(ctx, T(it.name), c.x + 14, c.y + c.h * 0.30, Math.min(17, Math.max(13, c.h * 0.20)), P.cream, 'left', 700);
        var ds = Math.min(12, Math.max(10, c.h * 0.14));
        var dsz = E.ui.fit(ctx, view.desc, c.btnX - c.x - 34, ds, 500);
        E.ui.text(ctx, view.desc, c.x + 14, c.y + c.h * 0.62, dsz, 'rgba(246,233,255,0.62)', 'left', 500);
        var pw = Math.max(8, Math.min(18, c.w * 0.032)), gap = 5, p;
        for (p = 0; p < it.max; p++) {
          ctx.fillStyle = p < view.lv ? P.cyan : 'rgba(162,148,201,0.26)';
          E.ui.roundRect(ctx, c.x + 14 + p * (pw + gap), c.y + c.h * 0.80, pw, 6, 3);
          ctx.fill();
        }
        E.ui.text(ctx, T('level_n', { n: view.lv, max: it.max }),
          c.x + 14 + it.max * (pw + gap) + 6, c.y + c.h * 0.80,
          Math.max(8, Math.min(9.5, c.h * 0.11)), 'rgba(246,233,255,0.45)', 'left', 500);
        if (!view.maxed) A.coin(ctx, c.btnX - 14, c.y + c.h / 2, 8);
      }
      E.ui.drawButtons(ctx, self.buttons);
      if (self.msg) {
        ctx.globalAlpha = Math.min(1, self.msgT * 2);
        pill(ctx, W / 2 - 120, H - 118, 240, 36, 'rgba(90,16,40,0.92)', 'rgba(255,90,122,0.6)');
        E.ui.text(ctx, self.msg, W / 2, H - 100, 14, '#ffffff', 'center', 600);
        ctx.globalAlpha = 1;
      }
    };
    self.build();
    return self;
  }

  /* ================================================================ МЕНЮ */
  S.menu = {
    name: 'menu',
    consumesInputInUpdate: true,
    enter: function (game) {
      this.game = game;
      this.t = 0; this.help = false; this.toast = null; this.toastT = 0; this.shop = null;
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      E.fx.reset();
      this._build(game);
    },
    onResize: function (game) {
      this._build(game);
      if (this.shop) this.shop.build();
    },
    _lay: function (v) {
      var W = v.w, H = v.h;
      var portrait = H > W * 1.06;
      var titleSize = portrait ? Math.min(W * 0.16, H * 0.085, 76) : Math.min(W * 0.10, H * 0.16, 70);
      var titleY = H * (portrait ? 0.15 : 0.17);
      var subY = titleY + titleSize * 0.66;
      var bw = Math.min(340, W * 0.74);
      var bh = clamp(H * 0.072, 44, 56);
      var b0 = portrait ? H * 0.50 : H * 0.36;
      return { W: W, H: H, portrait: portrait, titleSize: titleSize, titleY: titleY, subY: subY,
               bw: bw, bh: bh, b0: b0 };
    },
    _build: function (game) {
      var v = game.view, W = v.w;
      var M = this._lay(v);
      var that = this, list = [];
      var bx = (W - M.bw) / 2;
      list.push(new E.ui.Button({
        x: bx, y: M.b0, w: M.bw, h: M.bh, text: T('play'),
        bg: '#2a1450', border: P.cyan, fg: '#eaffff', fontSize: Math.round(M.bh * 0.38),
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { stage: Meta.stage() }); }
      }));
      list.push(new E.ui.Button({
        x: bx, y: M.b0 + M.bh + 10, w: M.bw, h: M.bh, text: T('songs'),
        bg: 'rgba(18,8,32,0.86)', border: 'rgba(255,45,149,0.45)', fg: P.cream,
        fontSize: Math.round(M.bh * 0.32),
        onTap: function () { E.audio.sfx('click'); game.setScene('map', {}); }
      }));
      list.push(new E.ui.Button({
        x: bx, y: M.b0 + (M.bh + 10) * 2, w: M.bw, h: M.bh, text: T('shop'),
        bg: 'rgba(18,8,32,0.86)', border: 'rgba(255,209,102,0.45)', fg: P.cream,
        fontSize: Math.round(M.bh * 0.32),
        onTap: function () { E.audio.sfx('click'); that.openShop(game); }
      }));
      var rvW = Math.min(230, W * 0.58), rvH = 44;
      var rvY = M.b0 + (M.bh + 10) * 3 + 4;
      list.push(new E.ui.Button({
        x: W / 2 - rvW / 2, y: rvY, w: rvW, h: rvH,
        bg: 'rgba(18,8,32,0.8)', border: 'rgba(125,255,155,0.4)',
        icon: function (ctx, b) {
          A.coin(ctx, b.x + 18, b.y + b.h / 2, 8.5);
          E.ui.text(ctx, '+' + C.ads.rewardedCoins, b.x + 32, b.y + b.h / 2 - 4, 13, P.gold, 'left', 700);
          E.ui.text(ctx, T('coins_reward'), b.x + 32, b.y + b.h / 2 + 8, 9.5, P.dim, 'left', 500);
          ctx.fillStyle = 'rgba(125,255,155,0.85)';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w - 20, b.y + b.h / 2 - 6);
          ctx.lineTo(b.x + b.w - 10, b.y + b.h / 2);
          ctx.lineTo(b.x + b.w - 20, b.y + b.h / 2 + 6);
          ctx.closePath(); ctx.fill();
        },
        onTap: function () {
          E.sdk.showRewarded({
            onReward: function () { Meta.addCoins(C.ads.rewardedCoins); E.audio.sfx('coin'); that.showToast('+' + C.ads.rewardedCoins); },
            onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); that.showToast(T('ad_fail')); } }
          });
        }
      }));
      list.push(soundButton(W - 60, 12));
      list.push(new E.ui.Button({
        x: W - 112, y: 12, w: 44, h: 44, text: '?', fontSize: 18, fg: P.gold,
        bg: 'rgba(8,4,20,0.62)', border: 'rgba(255,209,102,0.35)',
        onTap: function () { E.audio.sfx('click'); that.help = !that.help; }
      }));
      this.buttons = list;
    },
    openShop: function (game) {
      var that = this;
      this.shop = makeShop(game, function () { that.shop = null; });
    },
    showToast: function (text) { this.toast = text; this.toastT = 1.6; },
    update: function (game, dt) {
      this.t += dt;
      if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast = null; }
      if (this.shop) { this.shop.update(dt); return; }
      if (this.help) {
        if (E.input.pointer.pressed || E.input.wasPressed('Escape')) this.help = false;
        return;
      }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (this.shop) return;
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) {
        game.setScene('play', { stage: Meta.stage() });
      }
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      var M = this._lay(v);
      var pulse = Math.pow(1 - ((this.t * 72 / 60) % 1), 2);
      A.bg(ctx, W, H, this.t, pulse);
      this._deco(ctx, v);
      var a = Math.min(1, this.t * 1.6);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(255,45,149,0.7)';
      ctx.shadowBlur = 22;
      E.ui.text(ctx, T('title'), W / 2, M.titleY, M.titleSize, P.gold, 'center', 800);
      ctx.restore();
      E.ui.text(ctx, T('subtitle'), W / 2, M.subY, Math.min(W * 0.042, 19), 'rgba(246,233,255,0.66)', 'center', 500);
      coinsBadge(ctx, 14, 12, Meta.coins());
      ctx.save();
      ctx.globalAlpha = a;
      E.ui.drawButtons(ctx, this.buttons);
      ctx.restore();
      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      /* На коротком ландшафте (390 px) нижние подписи наехали бы на кнопку RV. */
      if (H >= 520) {
        E.ui.text(ctx, T('progress_n', { n: Meta.stage(), total: C.stages }) + ' · ' + T('best_score', { n: Meta.bestFor(Meta.stage()) }),
          W / 2, H - 50 - banM, Math.min(W * 0.033, 13), 'rgba(246,233,255,0.55)', 'center', 600);
        E.ui.text(ctx, T('menu_tip'), W / 2, H - 28 - banM, Math.min(W * 0.031, 12), 'rgba(246,233,255,0.35)', 'center', 500);
      }
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toastT * 2);
        pill(ctx, W / 2 - 110, H * 0.86, 220, 34, 'rgba(10,4,24,0.92)', 'rgba(255,209,102,0.4)');
        E.ui.text(ctx, this.toast, W / 2, H * 0.86 + 17, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
      if (this.help) this._drawHelp(ctx, v);
      if (this.shop) this.shop.draw(ctx);
    },
    _deco: function (ctx, v) {
      var W = v.w, H = v.h;
      var portrait = H > W * 1.06;
      var lanesW = portrait ? Math.min(W * 0.94, H * 0.46, 660) : Math.min(W * 0.54, 560);
      var laneW = lanesW / C.lanes, x0 = (W - lanesW) / 2;
      var top = H * 0.08, hitY = H * 0.88;
      var Lt = { x0: x0, laneW: laneW, lanesW: lanesW, top: top, hitY: hitY };
      ctx.save();
      ctx.globalAlpha = 0.40;
      A.lanes(ctx, Lt, 0.5);
      A.hitBar(ctx, Lt, 0.5, [0, 0, 0, 0]);
      for (var k = 0; k < 9; k++) {
        var ph = (this.t * 0.36 + k * 0.227) % 1;
        var lane = (k * 3 + 1) % 4;
        var y = top + ph * (hitY - top);
        A.note(ctx, x0 + (lane + 0.5) * laneW, y, laneW * 0.6, Math.max(12, laneW * 0.24), k % 5 === 3, 0.85 * (1 - ph * 0.35));
      }
      ctx.restore();
    },
    _drawHelp: function (ctx, v) {
      var W = v.w, H = v.h;
      ctx.fillStyle = 'rgba(6,3,16,0.94)';
      ctx.fillRect(0, 0, W, H);
      var hy = H * 0.20;
      E.ui.text(ctx, T('rules_title'), W / 2, hy, Math.min(W * 0.07, 30), P.gold, 'center', 800);
      var lines = [T('rules_1'), T('rules_2'), T('rules_3'), T('rules_4')];
      var y = hy + 34;
      for (var i = 0; i < lines.length; i++) {
        var s = Math.max(12, Math.min(W * 0.036, 16));
        var fitS = E.ui.fit(ctx, lines[i], W * 0.86, s, 500);
        E.ui.text(ctx, lines[i], W / 2, y + 12, fitS, P.cream, 'center', 500);
        y += 20 + Math.max(24, fitS * 1.7);
      }
      E.ui.text(ctx, T('close'), W / 2, Math.min(H * 0.84, y + 26), 16, 'rgba(246,233,255,0.6)', 'center', 600);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================ ПЕСНИ */
  S.map = {
    name: 'map',
    consumesInputInUpdate: true,
    enter: function (game) {
      this.game = game; this.t = 0; this.toast = null; this.toastT = 0; this.tiles = [];
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this._build(game);
    },
    onResize: function (game) { this._build(game); },
    _lay: function (v) {
      var W = v.w, H = v.h;
      var portrait = H > W * 1.06;
      var cols = portrait ? 3 : 4;
      var rows = Math.ceil(C.stages / cols);
      var pad = Math.max(8, Math.min(W, H) * 0.025);
      var gap = 8;
      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var top = H * (portrait ? 0.17 : 0.21);
      var bottom = H - banM - (portrait ? 66 : 52);
      var tw = (W - pad * 2 - (cols - 1) * gap) / cols;
      var th = Math.min(tw * 1.05, (bottom - top - (rows - 1) * gap) / rows);
      var totalW = cols * tw + (cols - 1) * gap;
      return { W: W, H: H, portrait: portrait, cols: cols, rows: rows, pad: pad, gap: gap, banM: banM,
               top: top, tw: tw, th: th, x0: (W - totalW) / 2, bottom: bottom };
    },
    _build: function (game) {
      var M = this._lay(game.view), that = this;
      var list = [], i;
      this.tiles = [];
      for (i = 0; i < C.stages; i++) {
        (function (stage, idx) {
          var col = idx % M.cols, row = Math.floor(idx / M.cols);
          var x = M.x0 + col * (M.tw + M.gap);
          var y = M.top + row * (M.th + M.gap);
          that.tiles[idx] = { x: x, y: y, w: M.tw, h: M.th };
          list.push(new E.ui.Button({
            x: x, y: y, w: M.tw, h: M.th, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            icon: function (ctx, b) { that._tile(ctx, b, stage); },
            onTap: function () {
              if (stage > Meta.stage()) { E.audio.sfx('deny'); that.showToast(T('locked')); return; }
              E.audio.sfx('click');
              game.setScene('play', { stage: stage });
            }
          }));
        })(i + 1, i);
      }
      list.push(new E.ui.Button({
        x: M.W / 2 - 80, y: M.H - M.banM - 56, w: 160, h: 44, text: T('back'),
        bg: 'rgba(18,8,32,0.9)', border: 'rgba(162,148,201,0.3)', fg: P.cream, fontSize: 16,
        onTap: function () { E.audio.sfx('click'); game.setScene('menu', {}); }
      }));
      this.buttons = list;
    },
    showToast: function (text) { this.toast = text; this.toastT = 1.4; },
    _tile: function (ctx, b, stage) {
      var x = b.x, y = b.y, w = b.w, h = b.h;
      var locked = stage > Meta.stage();
      var rank = Meta.ranks()[stage];
      var best = Meta.bestFor(stage);
      var cur = stage === Meta.stage();
      var r = Math.max(6, Math.min(w, h) * 0.08);
      var g = ctx.createLinearGradient(x, y, x, y + h);
      if (locked) { g.addColorStop(0, '#1d0f31'); g.addColorStop(1, '#120720'); }
      else if (cur) { g.addColorStop(0, '#3a1a60'); g.addColorStop(1, '#1c0c33'); }
      else { g.addColorStop(0, '#28103f'); g.addColorStop(1, '#150a24'); }
      E.ui.roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = locked ? 'rgba(110,88,148,0.45)' : (cur ? P.cyan : (rank ? 'rgba(125,255,155,0.55)' : 'rgba(255,45,149,0.45)'));
      ctx.stroke();

      var ns = Math.min(h * 0.34, w * 0.30);
      E.ui.text(ctx, String(stage), x + w * 0.12, y + h * 0.26, ns, locked ? 'rgba(162,148,201,0.58)' : P.gold, 'left', 800);
      E.ui.text(ctx, T(DIFF_NAME[L.difficultyFor(stage)]), x + w - 8, y + h * 0.15,
        Math.max(8, Math.min(w * 0.062, 10)), locked ? 'rgba(162,148,201,0.35)' : P.dim, 'right', 600);
      var nameS = E.ui.fit(ctx, T(SONG_NAME[stage]), w * 0.84, Math.max(9, Math.min(w * 0.085, 13)), 600);
      E.ui.text(ctx, T(SONG_NAME[stage]), x + w / 2, y + h * 0.62, nameS,
        locked ? 'rgba(162,148,201,0.55)' : P.cream, 'center', 600);
      if (rank) {
        A.rankBadge(ctx, x + w - h * 0.22, y + h * 0.80, Math.min(h * 0.3, 30), rank);
      } else if (locked) {
        var lx = x + w - h * 0.22, ly = y + h * 0.80, ls = Math.min(h * 0.12, 11);
        ctx.strokeStyle = 'rgba(162,148,201,0.4)';
        ctx.lineWidth = 2;
        E.ui.roundRect(ctx, lx - ls * 0.6, ly - ls * 0.1, ls * 1.2, ls * 0.9, 2);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(lx, ly - ls * 0.2, ls * 0.42, Math.PI, 0); ctx.stroke();
      } else if (best > 0) {
        E.ui.text(ctx, String(best), x + w - 8, y + h * 0.82,
          Math.max(8, Math.min(w * 0.06, 10)), 'rgba(255,209,102,0.72)', 'right', 700);
      }
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast = null; }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Escape')) game.setScene('menu', {});
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      A.bg(ctx, W, H, this.t, 0.35);
      E.ui.text(ctx, T('songs'), W / 2, H * 0.09, Math.min(W * 0.08, 34), P.gold, 'center', 800);
      E.ui.drawButtons(ctx, this.buttons);
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toastT * 2);
        pill(ctx, W / 2 - 100, H * 0.82, 200, 34, 'rgba(10,4,24,0.92)', 'rgba(255,209,102,0.4)');
        E.ui.text(ctx, this.toast, W / 2, H * 0.82 + 17, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },
    getCaptureState: function () { return { scene: 'menu', screen: 'map' }; }
  };

  /* ================================================================ ИГРА */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      var stp = params.stage != null ? params.stage
        : (params.chapter != null ? params.chapter : (cp.wave != null ? cp.wave : Meta.stage()));
      this.stage = clamp(parseInt(stp, 10) || 1, 1, C.stages);
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      var seed = params.seed != null ? params.seed
        : (E.capture.seed != null ? E.capture.seed : (Date.now() % 999983));
      this.seed = seed;
      var sv = Meta.shopLevels();
      this.st = L.newRun({
        stage: this.stage,
        seed: seed,
        shield: sv.shield,
        slow: slowSecs(sv.slow),
        coinMult: coinMultOf(sv.coin),
        auto: this.autopilot
      });
      this.st.recordSafe = this.autopilot || E.capture.active;
      this.mode = 'running';
      this.pausePrev = 'running';
      this.t = 0;
      this.flash = [0, 0, 0, 0];
      this.floats = [];
      this.toast = null; this.toastT = 0;
      this.helpTip = (!E.capture.active && (this.stage === 1 || this.stage === 3)) ? 4.5 : 0;
      this.helpTipText = this.stage === 1 ? T('tut_tap') : T('tut_avoid');
      if (!E.capture.active && this.st.slowDur > 0) {
        this.showToast(T('slow_label'), 2.4);
      }
      this.endButtons = [];
      this.result = null;
      this.reward = 0; this.doubled = false; this.reviveUsed = false;
      this.captureMode = false;
      this.shop = null;
      this.lastBeat = -1;
      this.autoRestart = 0;
      this.prevBest = Meta.bestFor(this.stage);
      this.newBest = false;
      this.fxRng = new E.Rng((E.seedFromString('fx' + String(seed)) || 7) >>> 0);
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this.layout(game);
      this.buildEnd(game);
      if (E.capture && E.capture.active) this.applyCapture(game);
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.buildEnd(game);
      if (this.shop) this.shop.build();
    },
    onBack: function (game) { if (this.mode === 'running') this.setPaused(true, game); },

    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var portrait = H > W * 1.06;
      var hudH = clamp(H * (portrait ? 0.078 : 0.115), 48, 72);
      var top = hudH + 22;
      var bottom = H - banner - (portrait ? 20 : 12);
      var hitY = bottom - clamp(H * 0.072, 30, 72);
      var lanesW = portrait ? Math.min(W * 0.94, H * 0.5, 700) : Math.min(W * 0.62, 680);
      var laneW = lanesW / C.lanes;
      var self = this;
      var s = 44;
      this.Lt = {
        W: W, H: H, portrait: portrait, banner: banner, hudH: hudH, top: top, bottom: bottom,
        hitY: hitY, lanesW: lanesW, laneW: laneW, x0: (W - lanesW) / 2,
        noteH: clamp(laneW * 0.26, 14, 30), noteW: laneW * 0.66
      };
      this.pauseBtn = new E.ui.Button({
        x: W - s - 8, y: 8, w: s, h: s, text: 'II', fontSize: 15,
        bg: 'rgba(8,4,20,0.62)', border: 'rgba(255,45,149,0.4)', fg: P.cream,
        onTap: function () { E.audio.sfx('click'); self.setPaused(true, game); }
      });
      this.buttons = [this.pauseBtn];
    },

    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast = null; }
      var i;
      for (i = 0; i < 4; i++) if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt * 3.2);
      for (i = this.floats.length - 1; i >= 0; i--) {
        this.floats[i].t += dt;
        if (this.floats[i].t >= this.floats[i].life) this.floats.splice(i, 1);
      }
      if (this.autoRestart > 0) {
        this.autoRestart -= dt;
        if (this.autoRestart <= 0) {
          game.setScene('play', { stage: this.stage, seed: (Number(this.seed) + 7) });
          return;
        }
      }
      if (this.helpTip > 0) { this.helpTip -= dt; if (this.helpTip <= 0) this.helpTip = 0; }
      var px = E.input.pointer.x, py = E.input.pointer.y;

      if (this.mode === 'paused') {
        if (E.input.pointer.pressed) E.ui.handleTap(this.endButtons, px, py);
        if (E.input.wasPressed('Escape') || E.input.wasPressed('KeyP')) this.setPaused(false, game);
        return;
      }
      if (this.mode === 'shop') {
        if (this.shop) this.shop.update(dt);
        return;
      }
      if (this.mode === 'win' || this.mode === 'over') {
        if (E.input.pointer.pressed) E.ui.handleTap(this.endButtons, px, py);
        if (E.input.wasPressed('Escape')) this.leave(game, 'menu');
        return;
      }
      if (E.input.pointer.pressed) {
        var hit = E.ui.handleTap(this.buttons, px, py);
        if (!hit) this.tapAt(px, py);
      }
      if (this.mode !== 'running') return;
      var k;
      for (k = 0; k < 4; k++) {
        if (E.input.wasPressed(KEYS[k]) || E.input.wasPressed(ARROWS[k]) || E.input.wasPressed(DIGITS[k])) {
          L.tap(this.st, k);
          this.flash[k] = Math.max(this.flash[k], 0.14);
        }
      }
      if (E.input.wasPressed('Escape') || E.input.wasPressed('KeyP')) { this.setPaused(true, game); return; }

      L.update(this.st, dt);
      this.tickBeat();
      this.drain();
      if (this.st.phase === 'win') this.finish(game, true);
      else if (this.st.phase === 'over') this.finish(game, false);
    },

    tapAt: function (x, y) {
      var Lt = this.Lt;
      if (y < Lt.top - 10 || y > Lt.bottom + 10) return;
      if (x < Lt.x0 - 8 || x > Lt.x0 + Lt.lanesW + 8) return;
      var lane = clamp(Math.floor((x - Lt.x0) / Lt.laneW), 0, C.lanes - 1);
      var res = L.tap(this.st, lane);
      if (res && res.type === 'empty') this.flash[lane] = Math.max(this.flash[lane], 0.16);
    },
    tickBeat: function () {
      var st = this.st;
      if (!st || st.phase !== 'playing' || E.capture.manual) return;
      var bi = Math.floor(st.time / st.beat);
      if (bi === this.lastBeat) return;
      this.lastBeat = bi;
      if (bi >= 0) E.audio.sfx(bi % 4 === 0 ? 'click' : 'tick');
    },
    addFloat: function (x, y, text, color, scale, lane) {
      if (lane != null) {
        for (var i = this.floats.length - 1; i >= 0; i--) {
          if (this.floats[i].lane === lane) this.floats.splice(i, 1);
        }
      }
      this.floats.push({ x: x, y: y, text: text, color: color, sc: scale || 1, t: 0, life: 0.5, lane: lane });
    },
    drain: function () {
      var st = this.st, Lt = this.Lt;
      var evs = L.takeEvents(st);
      for (var i = 0; i < evs.length; i++) {
        var e = evs[i];
        if (e.lane == null) continue;
        var lane = clamp(e.lane | 0, 0, C.lanes - 1);
        var cx = Lt.x0 + (lane + 0.5) * Lt.laneW;
        if (e.type === 'hit') {
          var perfect = e.grade === 'perfect';
          this.flash[lane] = Math.min(1, perfect ? 0.95 : 0.55);
          this.addFloat(cx, Lt.hitY - 34, T(GRADE_TXT[e.grade]),
            perfect ? P.gold : (e.grade === 'great' ? P.cyan : P.dim), perfect ? 1.1 : 0.9, lane);
          E.fx.burst(cx, Lt.hitY - 10, perfect ? '#ffd166' : '#22e8ff', perfect ? 6 : 3, 120, this.fxRng);
          E.audio.sfx(perfect ? 'pulse' : 'tick');
        } else if (e.type === 'miss') {
          this.flash[lane] = 0.28;
          this.addFloat(cx, Lt.hitY - 34, T('judge_miss'), P.red, 0.9, lane);
          E.audio.sfx('deny');
        } else if (e.type === 'ghost') {
          this.flash[lane] = 0.55;
          this.addFloat(cx, Lt.hitY - 34, T('judge_miss'), P.magenta, 1, lane);
          E.fx.shake(4, 0.18);
          E.audio.sfx('hit');
        } else if (e.type === 'shield') {
          this.addFloat(cx, Lt.hitY - 62, T('shield_label'), P.cyan, 0.8, lane);
          E.audio.sfx('coin');
        }
      }
    },
    showToast: function (text, sec) { this.toast = text; this.toastT = sec || 1.5; },

    finish: function (game, win) {
      if (this.result) return;
      var st = this.st;
      this.mode = win ? 'win' : 'over';
      this.result = {
        win: win, score: st.score, rank: st.rank, acc: st.accuracy,
        coins: st.coinsEarned, combo: st.maxCombo
      };
      this.reward = st.coinsEarned;
      this.newBest = st.score > this.prevBest;
      if (!this.captureMode && !E.capture.active) {
        Meta.addCoins(this.reward);
        Meta.setBest(this.stage, st.score);
        Meta.addRun();
        if (win) {
          Meta.setRank(this.stage, st.rank);
          Meta.setStage(Math.max(Meta.stage(), Math.min(C.stages, this.stage + 1)));
          Meta.submit(st.score);
        }
      }
      E.audio.sfx(win ? 'win' : 'over');
      E.sdk.gameplayStop();
      this.shop = null;
      this.buildEnd(game);
      if (this.autopilot || this.captureMode) this.autoRestart = 1.8;
    },
    setPaused: function (on, game) {
      game = game || this.game;
      if (on && this.mode === 'running') {
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildEnd(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = 'running';
        E.sdk.gameplayStart();
        this.buildEnd(game);
      }
    },
    buildEnd: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, self = this;
      var list = [], i = 0;
      if (!Lt) { this.endButtons = list; return; }
      var n = 3;
      var bh = clamp(H * 0.072, 44, 52);
      var gap = 10;
      var bw = Math.min(300, W * 0.72);
      var y0 = H - Lt.banner - 14 - n * (bh + gap) + gap;
      var x = W / 2 - bw / 2;
      function add(text, bg, border, fg, fn, enabled) {
        list.push(new E.ui.Button({
          x: x, y: y0 + i * (bh + gap), w: bw, h: bh, text: text,
          bg: bg, border: border, fg: fg, fontSize: Math.round(bh * 0.36),
          onTap: fn, enabled: enabled !== false
        }));
        i++;
      }
      if (this.mode === 'paused') {
        add(T('pause_resume'), '#2a1450', P.cyan, '#eaffff', function () { E.audio.sfx('click'); self.setPaused(false, game); });
        add(T('pause_restart'), 'rgba(30,12,52,0.92)', 'rgba(255,45,149,0.45)', P.cream, function () {
          E.audio.sfx('click');
          game.setScene('play', { stage: self.stage, seed: (Number(self.seed) + 7) });
        });
        add(T('pause_menu'), 'rgba(18,8,32,0.9)', 'rgba(162,148,201,0.25)', P.dim, function () {
          E.audio.sfx('click');
          self.leave(game, 'menu');
        });
        list.push(soundButton(14, 12));
        // магазин прямо из паузы (код покупок уже был, но был недоступен в игре)
        list.push(new E.ui.Button({
          x: 66, y: 12, w: 44, h: 44,
          bg: 'rgba(18,8,32,0.9)', border: 'rgba(162,148,201,0.35)',
          icon: function (ctx, b) {
            var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
            ctx.strokeStyle = P.cream; ctx.lineWidth = 2;
            E.ui.roundRect(ctx, cx - 9, cy - 3, 18, 13, 3); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy - 3, 5, Math.PI, 0); ctx.stroke();
          },
          onTap: function () { E.audio.sfx('click'); self.openShop(game); }
        }));
      } else if (this.mode === 'win') {
        var last = this.stage >= C.stages;
        add(last ? T('to_map') : T('next_song'), '#2a1450', P.green, '#eaffff', function () {
          E.audio.sfx('click');
          if (last) self.leave(game, 'map');
          else self.leave(game, 'play', { stage: self.stage + 1 });
        });
        add(T('double_reward'), 'rgba(30,12,52,0.92)', P.gold, P.cream, function () {
          E.sdk.showRewarded({
            onReward: function () {
              self.doubled = true;
              if (!self.captureMode && !E.capture.active) Meta.addCoins(self.reward);
              E.audio.sfx('coin');
              self.buildEnd(game);
            },
            onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.showToast(T('ad_fail')); } }
          });
        }, !this.doubled && !this.captureMode);
        add(T('to_map'), 'rgba(18,8,32,0.9)', 'rgba(162,148,201,0.25)', P.dim, function () {
          E.audio.sfx('click');
          self.leave(game, 'map');
        });
      } else if (this.mode === 'over') {
        add(T('second_chance'), '#3a1430', P.gold, P.cream, function () {
          E.sdk.showRewarded({
            onReward: function () {
              self.reviveUsed = true;
              self.st.pulse = 0.62;
              self.st.phase = 'playing';
              self.result = null;
              self.mode = 'running';
              E.sdk.gameplayStart();
              E.audio.sfx('revive');
              self.buildEnd(game);
            },
            onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.showToast(T('ad_fail')); } }
          });
        }, !this.reviveUsed && !this.captureMode);
        add(T('retry'), 'rgba(30,12,52,0.92)', 'rgba(255,45,149,0.45)', P.cream, function () {
          E.audio.sfx('click');
          game.setScene('play', { stage: self.stage, seed: (Number(self.seed) + 7) });
        });
        add(T('to_map'), 'rgba(18,8,32,0.9)', 'rgba(162,148,201,0.25)', P.dim, function () {
          E.audio.sfx('click');
          self.leave(game, 'map');
        });
      }
      this.endButtons = list;
    },
    leave: function (game, to, params) {
      if (E.capture.active || this.autopilot) { game.setScene(to, params || {}); return; }
      var runs = Meta.runs();
      var needAd = to === 'menu' && runs > 0 && runs % C.ads.interstitialEvery === 0;
      if (needAd) { E.sdk.showInterstitial(function () { game.setScene(to, params || {}); }); return; }
      game.setScene(to, params || {});
    },
    openShop: function (game) {
      game = game || this.game;
      this.pausePrev = this.mode === 'paused' ? 'paused' : 'running';
      this.mode = 'shop';
      var self = this;
      this.shop = makeShop(game, function () {
        self.mode = self.pausePrev === 'paused' ? 'paused' : 'running';
        self.shop = null;
        if (self.mode === 'running') E.sdk.gameplayStart();
        self.buildEnd(game);
      });
    },

    /* --- capture --- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.captureMode = true;
      this.st.auto = true;
      this.st.recordSafe = true;
      var st = this.st, mode = cp.mode;
      var t = cp.t != null ? parseFloat(cp.t) : NaN;
      var sim = E.capture.freeze || E.capture.manual;
      var dur = L.duration(st);
      if (mode === 'over') {
        L.simulate(st, clamp(isNaN(t) ? dur * 0.45 : t, 1, dur - 2));
        // Правдоподобный провал для кадра: не 100% и не «0 промахов» при нулевом пульсе.
        st.perfect = 58; st.great = 14; st.good = 9; st.miss = 24;
        st.judged = st.perfect + st.great + st.good + st.miss;
        st.accSum = st.perfect + st.great * C.acc.great + st.good * C.acc.good;
        st.combo = 0; st.maxCombo = 37;
        st.score = 18420;
        st.coinsEarned = 140;
        st.accuracy = clamp(st.accSum / Math.max(1, st.judged), 0, 1);
        st.rank = 'C';
        st.pulse = 0; st.phase = 'over';
        this.finish(game, false);
      } else if (mode === 'win') {
        L.simulate(st, dur + 0.4);
        if (st.phase !== 'win') {
          st.phase = 'win';
          st.accuracy = clamp(st.accSum / Math.max(1, st.count), 0, 1);
          st.rank = st.accuracy >= 0.95 ? 'S' : (st.accuracy >= 0.85 ? 'A' : (st.accuracy >= 0.7 ? 'B' : 'C'));
          st.coinsEarned = Math.floor(st.coinsF) + C.coins.clear + st.stage * C.coins.perStage + Math.round(st.accuracy * 60);
        }
        this.finish(game, true);
      } else if (mode === 'shop') {
        L.simulate(st, clamp(isNaN(t) ? 10 : t, 0, dur - 1));
        this.openShop(game);
      } else if (sim) {
        L.simulate(st, clamp(isNaN(t) ? 9 : t, 0, dur - 0.2));
      }
      this.buildEnd(game);
      if (E.capture.freeze || E.capture.manual) this.seedVisuals();
    },
    seedVisuals: function () {
      var st = this.st, Lt = this.Lt;
      var hits = [];
      for (var i = 0; i < st.notes.length; i++) {
        var n = st.notes[i];
        if (n.j && (n.g === 'perfect' || n.g === 'great' || n.g === 'good')) hits.push(n);
      }
      hits = hits.slice(-1);
      for (var k = 0; k < hits.length; k++) {
        var n2 = hits[k];
        var cx = Lt.x0 + (n2.lane + 0.5) * Lt.laneW;
        this.flash[n2.lane] = 0.7;
        this.addFloat(cx, Lt.hitY - 30, T(GRADE_TXT[n2.g]), n2.g === 'perfect' ? P.gold : P.cyan, 0.95, n2.lane);
        E.fx.burst(cx, Lt.hitY - 10, n2.g === 'perfect' ? '#ffd166' : '#22e8ff', 5, 110, this.fxRng);
      }
    },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'over') { this.st.phase = 'over'; this.finish(game, false); }
      else if (s.mode === 'win') { this.st.phase = 'win'; this.finish(game, true); }
      this.buildEnd(game);
    },
    getCaptureState: function () {
      return {
        scene: 'play', mode: this.mode, level: this.stage, wave: this.stage,
        score: this.st ? this.st.score : 0
      };
    },

    /* --- отрисовка --- */
    beatPulse: function () {
      var st = this.st;
      if (!st) return 0;
      return Math.pow(1 - ((st.time / st.beat) % 1), 2.2);
    },
    draw: function (game, ctx) {
      var Lt = this.Lt, st = this.st;
      var pulse = this.beatPulse();
      A.bg(ctx, Lt.W, Lt.H, this.t, this.mode === 'running' ? pulse : 0.25);
      A.lanes(ctx, Lt, pulse);
      this.drawNotes(ctx);
      A.hitBar(ctx, Lt, pulse, this.flash);
      this.drawKeyCaps(ctx);
      this.drawHud(ctx);
      this.drawFloats(ctx);
      this.drawToast(ctx);
      this.drawTip(ctx);
      if (this.mode === 'running') E.ui.drawButtons(ctx, this.buttons);
      E.fx.draw(ctx);
      if (this.mode === 'paused') this.drawPause(ctx);
      else if (this.mode === 'win') this.drawResult(ctx, true);
      else if (this.mode === 'over') this.drawResult(ctx, false);
      if (this.shop) this.shop.draw(ctx);
      E.fx.drawFlash(ctx, Lt.W, Lt.H);
    },
    drawNotes: function (ctx) {
      var Lt = this.Lt, st = this.st;
      var speed = (Lt.hitY - Lt.top) / C.scroll;
      var span = C.scroll + 0.35;
      ctx.save();
      ctx.beginPath();
      ctx.rect(Lt.x0 - 2, Lt.top, Lt.lanesW + 4, Lt.hitY - Lt.top + 1);
      ctx.clip();
      for (var i = 0; i < st.notes.length; i++) {
        var n = st.notes[i];
        if (n.j) continue;
        var d = n.t - st.time;
        if (d > span || d < -0.25) continue;
        var y = Lt.hitY - Lt.noteH * 0.5 - d * speed;
        var cx = Lt.x0 + (n.lane + 0.5) * Lt.laneW;
        var a = d < 0.1 ? Math.max(0.4, 0.55 + d * 4) : 1;
        A.note(ctx, cx, y, Lt.noteW, Lt.noteH, n.ghost, a);
      }
      ctx.restore();
    },
    drawKeyCaps: function (ctx) {
      var Lt = this.Lt;
      var gap = Lt.bottom - Lt.hitY;
      var size = clamp(Math.min(Lt.laneW * 0.2, gap * 0.62), 14, 24);
      var y = Lt.hitY + gap * 0.56;
      var labels = ['D', 'F', 'J', 'K'];
      for (var i = 0; i < 4; i++) {
        A.keyCap(ctx, Lt.x0 + (i + 0.5) * Lt.laneW, y, size, labels[i], this.flash[i] > 0.2);
      }
    },
    drawHud: function (ctx) {
      var Lt = this.Lt, st = this.st, W = Lt.W;
      var pad = 10;
      E.ui.text(ctx, T('stage_n', { n: this.stage }), pad, 20, Math.min(15, W * 0.04), P.cream, 'left', 700);
      E.ui.text(ctx, T(SONG_NAME[this.stage]), pad, 37, Math.min(11, W * 0.031), P.dim, 'left', 500);
      var scX = W - (this.pauseBtn ? this.pauseBtn.w : 40) - 18;
      E.ui.text(ctx, String(st.score), scX, 20, Math.min(19, W * 0.049), P.gold, 'right', 800);
      E.ui.text(ctx, T('score_label'), scX, 37, 12, P.dim, 'right', 600);

      var p = L.progress(st);
      ctx.fillStyle = 'rgba(246,233,255,0.12)';
      ctx.fillRect(Lt.x0, Lt.hudH + 2, Lt.lanesW, 3);
      if (p > 0) {
        var pg = ctx.createLinearGradient(Lt.x0, 0, Lt.x0 + Lt.lanesW, 0);
        pg.addColorStop(0, P.cyan);
        pg.addColorStop(1, P.magenta);
        ctx.fillStyle = pg;
        ctx.fillRect(Lt.x0, Lt.hudH + 2, Lt.lanesW * p, 3);
      }
      var by = Lt.hudH + 9;
      var labelW = Math.min(48, W * 0.12);
      var rightW = Math.min(62, W * 0.16);
      var bx = Lt.x0 + labelW;
      var bw = Math.max(60, Lt.lanesW - labelW - rightW);
      E.ui.text(ctx, T('pulse_label'), Lt.x0, by + 3, 12, 'rgba(246,233,255,0.58)', 'left', 600);
      A.pulseBar(ctx, bx, by, bw, 6, st.pulse, this.t);
      if (st.shieldMax > 0) {
        E.ui.text(ctx, T('shield_label') + ' ' + st.shield, Lt.x0 + Lt.lanesW, by + 3,
          12, P.cyan, 'right', 700);
      } else if (st.slowDur > 0 && st.clock < st.slowDur) {
        E.ui.text(ctx, T('slow_hud'), Lt.x0 + Lt.lanesW, by + 3,
          12, P.violet, 'right', 700);
      }
      if (st.combo >= 5 && this.mode === 'running') {
        var cy = Lt.top + (Lt.hitY - Lt.top) * 0.22;
        ctx.save();
        ctx.globalAlpha = 0.92;
        E.ui.text(ctx, String(st.combo), W / 2, cy, Math.min(40, Lt.laneW * 0.52), '#ffffff', 'center', 800);
        E.ui.text(ctx, '×' + Math.round(L.comboMult(st) * 10) / 10, W / 2,
          cy + Math.min(24, Lt.laneW * 0.26), Math.min(14, W * 0.035), P.gold, 'center', 700);
        ctx.restore();
      }
    },
    drawFloats: function (ctx) {
      for (var i = 0; i < this.floats.length; i++) {
        var f = this.floats[i];
        var k = f.t / f.life;
        var y = f.y - k * 26;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - k * 0.95);
        var sz = Math.max(10, Math.min(14, this.Lt.laneW * 0.13)) * f.sc;
        E.ui.text(ctx, f.text, f.x, y, sz, f.color, 'center', 700);
        ctx.restore();
      }
    },
    drawTip: function (ctx) {
      if (this.helpTip <= 0 || this.mode !== 'running') return;
      var Lt = this.Lt;
      var text = this.helpTipText || T('tut_tap');
      var w = Math.min(Lt.W * 0.86, 320);
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.helpTip) * 0.92;
      pill(ctx, Lt.W / 2 - w / 2, Lt.top + 18, w, 34, 'rgba(10,4,24,0.9)', 'rgba(125,255,155,0.45)');
      var s = E.ui.fit(ctx, text, w - 20, 12, 600);
      E.ui.text(ctx, text, Lt.W / 2, Lt.top + 35, s, '#eaffff', 'center', 600);
      ctx.restore();
    },
    drawToast: function (ctx) {
      if (!this.toast) return;
      var Lt = this.Lt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.toastT * 2);
      var w = Math.min(Lt.W * 0.8, 300);
      var y = Lt.hitY - 92;
      pill(ctx, Lt.W / 2 - w / 2, y, w, 32, 'rgba(10,4,24,0.92)', 'rgba(255,209,102,0.4)');
      var s = E.ui.fit(ctx, this.toast, w - 16, 12, 600);
      E.ui.text(ctx, this.toast, Lt.W / 2, y + 16, s, P.cream, 'center', 600);
      ctx.restore();
    },
    drawPause: function (ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      ctx.fillStyle = 'rgba(5,2,14,0.74)';
      ctx.fillRect(0, 0, W, H);
      var py = this.endButtons.length ? this.endButtons[0].y - 44 : H * 0.35;
      E.ui.text(ctx, T('paused'), W / 2, Math.max(Lt.hudH + 30, py), Math.min(W * 0.09, 34), P.gold, 'center', 800);
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawResult: function (ctx, win) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, st = this.st, r = this.result || {};
      ctx.fillStyle = 'rgba(5,2,14,0.78)';
      ctx.fillRect(0, 0, W, H);
      var firstY = this.endButtons.length ? this.endButtons[0].y : H * 0.62;
      var top = Lt.hudH + 4;
      var avail = Math.max(100, firstY - top - 8);
      var rows = [
        { h: 32, gap: 3 },
        { h: 16, gap: 8 },
        { h: 60, gap: 6 },
        { h: 28, gap: 6 },
        { h: 18, gap: 6 },
        { h: 30, gap: 0 }
      ];
      var LC = E.ui.layoutColumn(rows, avail, { pad: 2, minScale: 0.5 });
      var s = LC.scale, ys = LC.ys;
      E.ui.text(ctx, win ? T('win_title') : T('lose_title'), W / 2, ys[0] + rows[0].h * s / 2,
        Math.min(W * 0.082, 30 * s), win ? P.green : P.red, 'center', 800);
      E.ui.text(ctx, win ? T('win_sub') : T('lose_sub'), W / 2, ys[1] + rows[1].h * s / 2,
        Math.max(10, Math.min(W * 0.032, 14 * s)), 'rgba(246,233,255,0.7)', 'center', 500);

      var rowCy = ys[2] + rows[2].h * s / 2;
      var rb = Math.min(56 * s, 60);
      var dx = Math.min(W * 0.26, 120);
      A.rankBadge(ctx, W / 2 - dx, rowCy, rb, r.rank || 'C');
      var acc = Math.round((r.acc || 0) * 100);
      E.ui.text(ctx, acc + '%', W / 2, rowCy - 6 * s, Math.min(W * 0.07, 24 * s), P.cream, 'center', 800);
      E.ui.text(ctx, T('stat_acc'), W / 2, rowCy + 12 * s, Math.max(8, Math.min(W * 0.024, 9 * s)), P.dim, 'center', 500);
      E.ui.text(ctx, '×' + (r.combo || 0), W / 2 + dx, rowCy - 4 * s, Math.min(W * 0.06, 22 * s), P.gold, 'center', 800);
      E.ui.text(ctx, T('stat_combo'), W / 2 + dx, rowCy + 14 * s, Math.max(8, Math.min(W * 0.024, 9 * s)), P.dim, 'center', 500);

      var chips = [
        { v: st.perfect, k: 'stat_perfect', c: P.gold },
        { v: st.great, k: 'stat_great', c: P.cyan },
        { v: st.good, k: 'stat_good', c: P.violet },
        { v: st.miss, k: 'stat_miss', c: P.red }
      ];
      var cy2 = ys[3] + rows[3].h * s / 2;
      var cw = Math.min(W * 0.2, 84), i;
      for (i = 0; i < 4; i++) {
        var cx = W / 2 + (i - 1.5) * cw;
        E.ui.text(ctx, String(chips[i].v), cx, cy2 - 4 * s, Math.min(W * 0.045, 15 * s), chips[i].c, 'center', 800);
        E.ui.text(ctx, T(chips[i].k), cx, cy2 + 9 * s, Math.max(8, Math.min(W * 0.023, 9 * s)), P.dim, 'center', 500);
      }

      E.ui.text(ctx, T('score_label') + ' ' + r.score, W / 2, ys[4] + rows[4].h * s / 2,
        Math.max(10, Math.min(W * 0.036, 15 * s)), P.cream, 'center', 700);

      var cyp = ys[5] + rows[5].h * s / 2;
      var shown = this.doubled ? this.reward * 2 : this.reward;
      var pw = Math.min(220, W * 0.62);
      var ph = Math.max(22, 30 * s);
      pill(ctx, W / 2 - pw / 2, cyp - ph / 2, pw, ph, 'rgba(10,4,24,0.8)', 'rgba(255,209,102,0.4)');
      A.coin(ctx, W / 2 - pw / 2 + 18, cyp, Math.min(10, 10 * s));
      E.ui.text(ctx, T('reward_coins', { n: shown }), W / 2 + 6, cyp,
        Math.max(11, Math.min(W * 0.035, 15 * s)), P.gold, 'center', 700);
      if (this.newBest) {
        E.ui.text(ctx, T('new_record'), W / 2, cyp - ph / 2 - 15 * s,
          Math.max(9, Math.min(W * 0.028, 11 * s)), P.gold, 'center', 800);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    }
  };

  G.scenes = S;
})(window.GAME);
