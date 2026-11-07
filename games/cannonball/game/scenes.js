/* game/scenes.js — «Ядро»: меню (уровни, арсенал), бой и оверлеи паузы/победы/проигрыша.
   Вся механика — в game/logic.js; здесь ввод, раскладка, экономика, реклама и отрисовка. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette, A = G.art;
  var S = {};
  var WORLD = C.world;
  function T(k, v) { return E.i18n.t(k, v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------------- мета / сохранения (один кошелёк) ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.economy.startCoins; E.storage.set('coins', c); }
      return c | 0;
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    addCoins: function (n) { Meta.setCoins(Meta.coins() + (n | 0)); return Meta.coins(); },
    done: function () {
      var d = E.storage.get('done', null);
      return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
    },
    markDone: function (n) { var d = Meta.done(); d[n] = 1; E.storage.set('done', d); },
    level: function () { return clamp((E.storage.get('lvl', 1) | 0) || 1, 1, C.levels.length); },
    setLevel: function (n) { E.storage.set('lvl', clamp(n | 0, 1, C.levels.length)); },
    upg: function () {
      var u = E.storage.get('upg', null);
      u = (u && typeof u === 'object' && !Array.isArray(u)) ? u : {};
      return {
        ammo: clamp(u.ammo | 0, 0, 3),
        preview: clamp(u.preview | 0, 0, 2),
        slow: clamp(u.slow | 0, 0, 3)
      };
    },
    saveUpg: function (u) { E.storage.set('upg', u); },
    cost: function (item, lvl) { return item.base + item.step * lvl; },
    doneCount: function () {
      var d = Meta.done(), n = 0;
      for (var k in d) if (d[k]) n++;
      return n;
    }
  };
  G.meta = Meta;

  function shopItem(id) {
    for (var i = 0; i < C.shop.length; i++) if (C.shop[i].id === id) return C.shop[i];
    return null;
  }
  function shopLvl(item) { return Meta.upg()[item.id] | 0; }
  function buyUpgrade(item) {
    var lvl = shopLvl(item);
    if (lvl >= item.max) return false;
    var cost = Meta.cost(item, lvl);
    if (Meta.coins() < cost) { E.audio.sfx('deny'); return false; }
    Meta.addCoins(-cost);
    var u = Meta.upg(); u[item.id] = lvl + 1; Meta.saveUpg(u);
    E.audio.sfx('buy');
    return true;
  }

  /* ---------------- мелкая графика ---------------- */
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function coinsBadge(ctx, x, y, w) {
    var h = 34, ww = w || 100;
    pill(ctx, x, y, ww, h, 'rgba(22,12,26,0.72)', P.panelLine);
    A.coin(ctx, x + 18, y + h / 2, 10);
    E.ui.text(ctx, String(Meta.coins()), x + 32, y + h / 2 + 1, 16, P.gold, 'left', 700);
  }
  function soundButton(x, y, w, h) {
    return new E.ui.Button({
      x: x, y: y, w: w, h: h, bg: 'rgba(22,12,26,0.72)', border: P.panelLine,
      icon: function (ctx, b) {
        var mm = E.audio.isMuted();
        E.ui.text(ctx, mm ? '♪̸' : '♪', b.x + b.w / 2, b.y + b.h / 2 + 1, Math.min(20, b.h * 0.46),
          mm ? P.dim : P.gold, 'center', 700);
      },
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
  }
  function pauseButton(x, y, w, h) {
    return new E.ui.Button({
      x: x, y: y, w: w, h: h, bg: 'rgba(22,12,26,0.72)', border: P.panelLine,
      icon: function (ctx, b) {
        ctx.fillStyle = P.text;
        var bw = Math.max(3, b.w * 0.10), bh = Math.max(10, b.h * 0.42);
        E.ui.roundRect(ctx, b.x + b.w * 0.36 - bw / 2, b.y + b.h / 2 - bh / 2, bw, bh, bw * 0.4); ctx.fill();
        E.ui.roundRect(ctx, b.x + b.w * 0.64 - bw / 2, b.y + b.h / 2 - bh / 2, bw, bh, bw * 0.4); ctx.fill();
      }
    });
  }
  function slowButton(x, y, w, h, getCharges) {
    var b = new E.ui.Button({
      x: x, y: y, w: w, h: h, bg: 'rgba(22,12,26,0.72)', border: 'rgba(255,179,71,0.45)',
      icon: function (ctx, bt) {
        A.slowIcon(ctx, bt.x + bt.h * 0.42, bt.y + bt.h / 2, bt.h * 0.26);
        E.ui.text(ctx, T('slow_n', { n: getCharges() }), bt.x + bt.h * 0.78, bt.y + bt.h / 2 + 1,
          Math.max(12, bt.h * 0.30), P.accent, 'left', 700);
      }
    });
    b.id = 'slow';
    return b;
  }

  /* ---------------- общий магазин (меню и бой) ---------------- */
  function shopLayout(v, banner) {
    var W = v.w, H = v.h;
    var top = Math.max(H * 0.16, 108);
    var bottom = H - banner - 70;
    var gap = 10;
    var ch = clamp((bottom - top - gap * 2) / 3, 56, 118);
    var cw = Math.min(560, W * 0.92);
    var x = (W - cw) / 2;
    var block = ch * 3 + gap * 2;
    var y0 = top + Math.max(0, (bottom - top - 40 - block) / 2);
    var cards = [];
    for (var i = 0; i < C.shop.length; i++) cards.push({ item: C.shop[i], x: x, y: y0 + i * (ch + gap), w: cw, h: ch });
    return { cards: cards, close: { x: W / 2 - 90, y: H - banner - 58, w: 180, h: 46 } };
  }
  function drawShop(ctx, v, onBuy, onClose) {
    var W = v.w, H = v.h;
    var banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
    ctx.fillStyle = 'rgba(14,7,20,0.975)';
    ctx.fillRect(0, 0, W, H);
    var Lt = shopLayout(v, banner);
    E.ui.text(ctx, T('shop_title'), W / 2, Math.max(40, H * 0.085), Math.min(W * 0.08, 34), P.gold, 'center', 800);
    E.ui.text(ctx, T('shop_hint'), W / 2, Math.max(58, H * 0.085) + 24, Math.min(W * 0.036, 14), 'rgba(248,238,218,0.6)', 'center', 500);
    coinsBadge(ctx, 12, 10, 104);
    var u = Meta.upg();
    for (var i = 0; i < Lt.cards.length; i++) {
      var c = Lt.cards[i], item = c.item, lvl = u[item.id] | 0;
      var maxed = lvl >= item.max;
      E.ui.roundRect(ctx, c.x, c.y, c.w, c.h, 14);
      ctx.fillStyle = 'rgba(38,22,40,0.94)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = maxed ? 'rgba(190,180,200,0.22)' : P.panelLine; ctx.stroke();
      // иконка
      var ix = c.x + c.h * 0.52, iy = c.y + c.h * 0.5;
      if (item.id === 'ammo') A.shellIcon(ctx, ix, iy, c.h * 0.24, true);
      else if (item.id === 'preview') A.previewDots(ctx,
        [{ x: -30, y: 22 }, { x: -18, y: 6 }, { x: -6, y: -4 }, { x: 6, y: -8 }, { x: 18, y: -4 }, { x: 28, y: 8 }],
        c.h / 150, ix, iy, P.accent);
      else A.slowIcon(ctx, ix, iy, c.h * 0.22);
      // текст
      var tx = c.x + c.h * 0.95;
      var fs = Math.min(17, c.h * 0.24);
      E.ui.text(ctx, T(item.name), tx, c.y + c.h * 0.30, fs, P.text, 'left', 700);
      var ds = E.ui.fit(ctx, T(item.desc), c.w - (tx - c.x) - 120, Math.min(12.5, c.h * 0.16), 500);
      E.ui.text(ctx, T(item.desc), tx, c.y + c.h * 0.58, ds, 'rgba(248,238,218,0.62)', 'left', 500);
      // ступени
      var pw = Math.min(16, c.w * 0.03), ph = 6;
      for (var p = 0; p < item.max; p++) {
        ctx.fillStyle = p < lvl ? P.accent : 'rgba(190,180,200,0.22)';
        E.ui.roundRect(ctx, tx + p * (pw + 5), c.y + c.h * 0.76, pw, ph, 3); ctx.fill();
      }
      // кнопка
      var bw2 = Math.min(112, c.w * 0.24), bh2 = Math.max(40, Math.min(46, c.h * 0.60));
      var bx = c.x + c.w - bw2 - 12, by = c.y + (c.h - bh2) / 2;
      E.ui.roundRect(ctx, bx, by, bw2, bh2, 10);
      ctx.fillStyle = maxed ? 'rgba(60,50,60,0.9)' : 'rgba(74,52,30,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = maxed ? 'rgba(190,180,200,0.25)' : P.gold; ctx.stroke();
      if (maxed) {
        E.ui.text(ctx, T('maxed'), bx + bw2 / 2, by + bh2 / 2 + 1, Math.min(14, bh2 * 0.34), P.dim, 'center', 700);
      } else {
        A.coin(ctx, bx + 16, by + bh2 / 2, 8);
        E.ui.text(ctx, String(Meta.cost(item, lvl)), bx + 28, by + bh2 / 2 + 1, Math.min(16, bh2 * 0.38),
          Meta.coins() >= Meta.cost(item, lvl) ? P.gold : '#c06a5a', 'left', 700);
      }
    }
    // кнопки-хитбоксы строит вызывающий; тут только «Готово»
    var cb = Lt.close;
    E.ui.roundRect(ctx, cb.x, cb.y, cb.w, cb.h, 12);
    ctx.fillStyle = 'rgba(45,28,44,0.95)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = P.panelLine; ctx.stroke();
    E.ui.text(ctx, T('close_shop'), cb.x + cb.w / 2, cb.y + cb.h / 2 + 1, 17, P.text, 'center', 700);
    return Lt;
  }
  function shopButtons(v, onBuy, onClose) {
    var banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0;
    var Lt = shopLayout(v, banner);
    var list = [];
    for (var i = 0; i < Lt.cards.length; i++) {
      (function (c) {
        var item = c.item;
        var bw2 = Math.min(112, c.w * 0.24), bh2 = Math.max(40, Math.min(46, c.h * 0.60));
        list.push(new E.ui.Button({
          x: c.x + c.w - bw2 - 12, y: c.y + (c.h - bh2) / 2, w: bw2, h: bh2,
          bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', id: 'buy_' + item.id,
          onTap: function () { if (buyUpgrade(item)) onBuy(); }
        }));
      })(Lt.cards[i]);
    }
    list.push(new E.ui.Button({
      x: Lt.close.x, y: Lt.close.y, w: Lt.close.w, h: Lt.close.h,
      bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', id: 'shop_close', onTap: onClose
    }));
    return list;
  }

  /* ================================================================ МЕНЮ */
  S.menu = {
    name: 'menu',
    consumesInputInUpdate: true,
    enter: function (game) {
      this.game = game; this.t = 0; this.panel = ''; this.help = false; this.toast = null;
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      E.fx.reset();
      this.buttons = [];
      this.panelButtons = [];
      this._build(game);
    },
    onResize: function (game) { this._build(game); },
    _lay: function (v) {
      var W = v.w, H = v.h;
      var compact = H < 560;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var titleSize = Math.min(W * (compact ? 0.14 : 0.13), H * (compact ? 0.13 : 0.10), compact ? 50 : 74);
      var titleY = compact ? H * 0.19 : H * 0.155;
      var subY = titleY + titleSize * 0.68;
      var bw = Math.min(360, W * 0.76);
      var bh = compact ? 44 : clamp(H * 0.072, 46, 58);
      var gap = compact ? 8 : 12;
      var y0 = compact ? H * 0.44 : H * 0.52;
      var rvH = 44;
      var bh2 = Math.max(44, bh * 0.86);
      var total = bh + bh2 * 2 + rvH + gap * 3;
      var maxY = H - banner - 58;
      if (y0 + total > maxY) y0 = Math.max(subY + 16, maxY - total);
      return { compact: compact, W: W, H: H, banner: banner, titleSize: titleSize, titleY: titleY,
               subY: subY, bw: bw, bh: bh, bh2: bh2, gap: gap, y0: y0, rvH: rvH, total: total };
    },
    _build: function (game) {
      var v = game.view, M = this._lay(v), that = this;
      var bx = (M.W - M.bw) / 2, y = M.y0;
      var list = [];
      // [0] — «Играть»: гейт нажимает именно первую кнопку меню
      list.push(new E.ui.Button({
        x: bx, y: y, w: M.bw, h: M.bh, text: T('play'),
        bg: '#4a2c1c', border: P.gold, fg: '#ffe6b8', fontSize: Math.round(M.bh * 0.40),
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: Meta.level() }); }
      }));
      y += M.bh + M.gap;
      list.push(new E.ui.Button({
        x: bx, y: y, w: M.bw, h: M.bh2, text: T('levels'),
        bg: 'rgba(30,18,34,0.86)', border: 'rgba(242,193,78,0.42)', fg: P.text,
        fontSize: Math.round(M.bh * 0.34),
        onTap: function () { E.audio.sfx('click'); that.panel = that.panel === 'levels' ? '' : 'levels'; that._build(game); }
      }));
      y += M.bh2 + M.gap;
      list.push(new E.ui.Button({
        x: bx, y: y, w: M.bw, h: M.bh2, text: T('shop'),
        bg: 'rgba(30,18,34,0.86)', border: 'rgba(242,193,78,0.42)', fg: P.text,
        fontSize: Math.round(M.bh * 0.34),
        onTap: function () { E.audio.sfx('click'); that.panel = that.panel === 'shop' ? '' : 'shop'; that._build(game); }
      }));
      y += M.bh2 + M.gap;
      // rewarded: монеты за рекламу
      list.push(new E.ui.Button({
        x: bx + M.bw * 0.08, y: y, w: M.bw * 0.84, h: M.rvH,
        bg: 'rgba(28,34,22,0.86)', border: 'rgba(143,209,79,0.45)',
        icon: function (ctx, b) {
          A.coin(ctx, b.x + 22, b.y + b.h / 2, 9);
          E.ui.text(ctx, T('coins_n', { n: C.ads.rewardCoins }), b.x + 38, b.y + b.h / 2 - 5,
            Math.max(12, b.h * 0.33), P.gold, 'left', 700);
          E.ui.text(ctx, T('coins_ad'), b.x + 38, b.y + b.h / 2 + 9, Math.max(11, b.h * 0.23), P.dim, 'left', 500);
          ctx.fillStyle = 'rgba(143,209,79,0.9)';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w - 22, b.y + b.h / 2 - 6);
          ctx.lineTo(b.x + b.w - 10, b.y + b.h / 2);
          ctx.lineTo(b.x + b.w - 22, b.y + b.h / 2 + 6);
          ctx.closePath(); ctx.fill();
        },
        onTap: function () {
          E.sdk.showRewarded({
            onReward: function () {
              Meta.addCoins(C.ads.rewardCoins);
              E.audio.sfx('coin');
              that.toast = { t: 1.8, text: T('coins_n', { n: C.ads.rewardCoins }) };
            },
            onDone: function (ok) { if (!ok) that.toast = { t: 1.8, text: T('ad_fail') }; }
          });
        }
      }));
      this.buttons = list;
      var top = 10;
      this.topButtons = [
        soundButton(M.W - 50, top, 40, 40),
        new E.ui.Button({
          x: M.W - 96, y: top, w: 40, h: 40, text: '?', fontSize: 18, fg: P.gold,
          bg: 'rgba(22,12,26,0.72)', border: P.panelLine,
          onTap: function () { E.audio.sfx('click'); that.help = !that.help; }
        })
      ];
      // панели
      if (this.panel === 'levels') this.panelButtons = this._buildLevels(game);
      else if (this.panel === 'shop') {
        this.panelButtons = shopButtons(v, function () { that._build(game); }, function () { that.panel = ''; that._build(game); });
      } else this.panelButtons = [];
    },
    _buildLevels: function (game) {
      var v = game.view, W = v.w, H = v.h, that = this;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var cols = W > H ? 5 : 3;
      var rows = Math.ceil(C.levels.length / cols);
      var top = Math.max(72, H * 0.16);
      var bottom = H - banner - 64;
      var pad = 12, gap = 8;
      var tw = Math.min(120, (W - pad * 2 - (cols - 1) * gap) / cols);
      var th = Math.min(96, (bottom - top - (rows - 1) * gap) / rows);
      var x0 = (W - (cols * tw + (cols - 1) * gap)) / 2;
      var list = [];
      this.levelRects = [];
      for (var i = 0; i < C.levels.length; i++) {
        (function (def, idx) {
          var col = idx % cols, row = Math.floor(idx / cols);
          var x = x0 + col * (tw + gap), y = top + row * (th + gap);
          that.levelRects.push({ x: x, y: y, w: tw, h: th, n: def.n });
          list.push(new E.ui.Button({
            x: x, y: y, w: tw, h: th, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            icon: function (ctx, b) { that._drawLevelTile(ctx, b, def); },
            onTap: function () {
              if (def.n > Meta.level()) { E.audio.sfx('deny'); that.toast = { t: 1.6, text: T('locked') }; return; }
              E.audio.sfx('click');
              game.setScene('play', { level: def.n });
            }
          }));
        })(C.levels[i], i);
      }
      list.push(new E.ui.Button({
        x: W / 2 - 80, y: H - banner - 56, w: 160, h: 44, text: T('back'),
        bg: 'rgba(30,18,34,0.9)', border: P.panelLine, fg: P.text, fontSize: 17,
        onTap: function () { E.audio.sfx('click'); that.panel = ''; that._build(game); }
      }));
      return list;
    },
    _drawLevelTile: function (ctx, b, def) {
      var locked = def.n > Meta.level();
      var done = !!Meta.done()[def.n];
      var cur = def.n === Meta.level();
      var g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      if (locked) { g.addColorStop(0, '#241a28'); g.addColorStop(1, '#180f1c'); }
      else { g.addColorStop(0, '#4a3040'); g.addColorStop(1, '#2a1828'); }
      E.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = locked ? 'rgba(120,100,120,0.35)' : (cur ? P.accent : 'rgba(242,193,78,0.45)');
      ctx.stroke();
      var ns = Math.min(b.h * 0.36, b.w * 0.44);
      E.ui.text(ctx, String(def.n), b.x + b.w / 2, b.y + b.h * 0.40, ns,
        locked ? 'rgba(180,160,180,0.45)' : P.gold, 'center', 800);
      if (locked) {
        A.lock(ctx, b.x + b.w / 2, b.y + b.h * 0.75, Math.min(b.w, b.h) * 0.24, 'rgba(190,170,190,0.5)');
      } else {
        var nm = T(def.name);
        var nfs = E.ui.fit(ctx, nm, b.w * 0.86, Math.max(8.5, Math.min(11, b.w * 0.11)), 500);
        E.ui.text(ctx, nm, b.x + b.w / 2, b.y + b.h * 0.79, nfs, 'rgba(248,238,218,0.58)', 'center', 500);
        if (done) {
          ctx.save();
          ctx.strokeStyle = P.good; ctx.lineWidth = Math.max(2, b.w * 0.035); ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w - b.w * 0.30, b.y + b.h * 0.16);
          ctx.lineTo(b.x + b.w - b.w * 0.21, b.y + b.h * 0.25);
          ctx.lineTo(b.x + b.w - b.w * 0.06, b.y + b.h * 0.08);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (cur) {
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(this.t * 3) * 0.25;
        ctx.strokeStyle = P.accent; ctx.lineWidth = 2.5;
        E.ui.roundRect(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 12);
        ctx.stroke();
        ctx.restore();
      }
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      var Ptr = E.input.pointer;
      if (this.help) {
        if (Ptr.pressed || E.input.wasPressed('Escape')) this.help = false;
        return;
      }
      if (Ptr.pressed) {
        if (E.ui.handleTap(this.topButtons, Ptr.x, Ptr.y)) return;
        if (this.panel) { E.ui.handleTap(this.panelButtons, Ptr.x, Ptr.y); return; }
        E.ui.handleTap(this.buttons, Ptr.x, Ptr.y);
        return;
      }
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) {
        if (!this.panel) game.setScene('play', { level: Meta.level() });
      }
      if (E.input.wasPressed('Escape') && this.panel) { this.panel = ''; this._build(game); }
    },
    draw: function (game, ctx) {
      var v = game.view, M = this._lay(v), W = M.W, H = M.H;
      var that = this;
      A.sky(ctx, W, H, this.t);
      A.dunes(ctx, W, H, H * 0.95);
      A.ground(ctx, 0, W, H * 0.95, H * 0.05, 7);
      // сцена-виньетка: пушка слева внизу, дуга к качающейся мишени справа сверху
      var s = Math.min(W, H) / 1000;
      var baseY = H * 0.95;
      A.cactus(ctx, W * 0.05, baseY, Math.min(H * 0.20, 140), false);
      A.cactus(ctx, W * 0.96, baseY, Math.min(H * 0.14, 110), true);
      var cannonX = W * 0.14, cannonY = H * 0.83;
      var tgtX = W * 0.86, tgtY = H * 0.27 + Math.sin(this.t * 1.1) * H * 0.015;
      for (var i = 0; i <= 18; i++) {
        var k = i / 18;
        var dx = tgtX - cannonX, dy = tgtY - cannonY;
        var px = cannonX + dx * k;
        var py = cannonY + dy * k - Math.sin(k * Math.PI) * Math.abs(dy) * 0.95;
        ctx.globalAlpha = 0.60 - k * 0.38;
        ctx.fillStyle = '#ffe0a8';
        ctx.beginPath(); ctx.arc(px, py, Math.max(1.4, 4.6 * s), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      A.target(ctx, tgtX, tgtY, Math.min(W, H) * 0.082, { t: this.t, mv: true });
      A.cannon(ctx, cannonX, cannonY, -0.72, s * 0.95, { t: this.t });

      // затемнение под текст
      var gg = ctx.createLinearGradient(0, 0, 0, H * 0.62);
      gg.addColorStop(0, 'rgba(16,8,22,0.55)');
      gg.addColorStop(1, 'rgba(16,8,22,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H * 0.62);

      var alpha = Math.min(1, this.t * 1.8);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(20,8,16,0.7)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      E.ui.text(ctx, T('title1'), W / 2, M.titleY, M.titleSize, '#ffd58a', 'center', 800);
      ctx.restore();
      E.ui.text(ctx, T('subtitle'), W / 2, M.subY, Math.min(W * 0.042, 18), 'rgba(248,238,218,0.66)', 'center', 500);

      coinsBadge(ctx, 12, 12, 104);
      E.ui.drawButtons(ctx, this.topButtons);
      ctx.save();
      ctx.globalAlpha = alpha;
      E.ui.drawButtons(ctx, this.buttons);
      ctx.restore();

      var prog = T('level_n', { n: Meta.level(), total: C.levels.length });
      var by = M.y0 + M.total;
      E.ui.text(ctx, prog, W / 2, Math.min(H - M.banner - 30, by + 20), Math.min(W * 0.036, 14),
        'rgba(248,238,218,0.55)', 'center', 600);
      E.ui.text(ctx, T('menu_tip'), W / 2, Math.min(H - M.banner - 12, by + 40), Math.min(W * 0.032, 13),
        'rgba(248,238,218,0.35)', 'center', 500);

      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        pill(ctx, W / 2 - 110, H * 0.88, 220, 36, 'rgba(18,10,24,0.94)', P.panelLine);
        E.ui.text(ctx, this.toast.text, W / 2, H * 0.88 + 18, 13, P.text, 'center', 600);
        ctx.globalAlpha = 1;
      }

      if (this.help) {
        ctx.fillStyle = 'rgba(14,7,20,0.94)'; ctx.fillRect(0, 0, W, H);
        E.ui.text(ctx, T('rules_title'), W / 2, H * 0.20, Math.min(W * 0.075, 32), P.gold, 'center', 800);
        var lines = [T('rules_1'), T('rules_2'), T('rules_3'), T('rules_4')];
        var y = H * 0.30;
        for (var li = 0; li < lines.length; li++) {
          var fs = E.ui.fit(ctx, lines[li], W * 0.86, Math.max(13, Math.min(W * 0.038, 18)), 500);
          E.ui.text(ctx, lines[li], W / 2, y, fs, P.text, 'center', 500);
          y += fs * 2.1;
        }
        E.ui.text(ctx, T('close'), W / 2, H * 0.86, 16, 'rgba(248,238,218,0.65)', 'center', 600);
        return;
      }
      if (this.panel === 'levels') {
        ctx.fillStyle = 'rgba(14,7,20,0.93)'; ctx.fillRect(0, 0, W, H);
        E.ui.text(ctx, T('levels'), W / 2, Math.max(38, H * 0.085), Math.min(W * 0.09, 34), P.gold, 'center', 800);
        coinsBadge(ctx, 12, 10, 104);
        E.ui.drawButtons(ctx, this.panelButtons);
        if (this.toast) {
          ctx.globalAlpha = Math.min(1, this.toast.t * 2);
          pill(ctx, W / 2 - 110, H * 0.5 - 18, 220, 36, 'rgba(18,10,24,0.94)', P.panelLine);
          E.ui.text(ctx, this.toast.text, W / 2, H * 0.5, 13, P.text, 'center', 600);
          ctx.globalAlpha = 1;
        }
      } else if (this.panel === 'shop') {
        drawShop(ctx, v, function () { that._build(game); }, function () { that.panel = ''; that._build(game); });
        E.ui.drawButtons(ctx, this.panelButtons);
      }
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================ БОЙ */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      var num = params.level || (cp.wave != null ? parseInt(cp.wave, 10) : 0) || Meta.level();
      this.levelNum = clamp(num | 0, 1, C.levels.length);
      this.levelIdx = this.levelNum - 1;
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      this.captureMode = false;
      var upg = Meta.upg();
      this.previewLvl = upg.preview;
      this.st = L.newLevel(this.levelIdx, { extraShots: upg.ammo });
      this.slowCharges = C.slowBase + upg.slow;
      this.slowLeft = this.slowCharges;
      this.slowT = 0;
      this.physAcc = 0;
      this.mode = 'running';
      this.drag = null;
      this.aimAngle = -0.72; this.aimPower = 0.62; this.kbAim = false;
      this.recoil = 0; this.flash = 0; this.t = 0;
      this.bannerT = 0; this.bannerText = ''; this.bannerSub = '';
      this.toast = null; this.floaters = [];
      this.result = null; this.reward = 0; this.doubled = false; this.reviveUsed = false;
      this.perfect = false;
      this.autoT = 0; this.autoSol = null;
      this.lastPhase = this.st.phase;
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this.layout(game);
      this.buildButtons(game);
      this.buildEnd(game);
      this.shopPrev = 'running';
      if (E.capture && E.capture.active) this.applyCapture(game);
    },
    exit: function () {
      E.sdk.gameplayStop();
    },
    onResize: function (game) {
      this.layout(game);
      this.buildButtons(game);
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.buildEnd(game);
    },
    onBack: function (game) {
      if (this.mode === 'running' || this.mode === 'shop') this.setPaused(true, game);
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var portrait = H > W * 1.02;
      var hudH = portrait ? clamp(H * 0.072, 50, 62) : clamp(H * 0.13, 42, 56);
      var deckH = portrait ? clamp(H * 0.13, 86, 116) : 0;
      var top = hudH + 6;
      var bot = H - banner - deckH - 8;
      var side = Math.min(W - 12, bot - top);
      var ax, ay;
      if (portrait) {
        ax = (W - side) / 2;
        ay = top + (bot - top - side) / 2;
      } else {
        ax = W - side - 10;
        ay = top + (bot - top - side) / 2;
      }
      var s = side / WORLD.w;
      this.Lt = {
        W: W, H: H, portrait: portrait, banner: banner, hudH: hudH, deckH: deckH,
        top: top, bot: bot, side: side, ax: ax, ay: ay, s: s,
        groundY: ay + WORLD.ground * s,
        deckY: H - banner - deckH
      };
      return this.Lt;
    },
    sx: function (x) { return this.Lt.ax + x * this.Lt.s; },
    sy: function (y) { return this.Lt.ay + y * this.Lt.s; },
    wx: function (px) { return (px - this.Lt.ax) / this.Lt.s; },
    wy: function (py) { return (py - this.Lt.ay) / this.Lt.s; },

    buildButtons: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, self = this, list = [];
      var bs = Lt.portrait ? 44 : 42;
      var pb = pauseButton(Lt.portrait ? W - bs - 8 : W - bs - 12, Lt.portrait ? 8 : 10, bs, bs);
      pb.id = 'pause';
      pb.onTap = function () { E.audio.sfx('click'); self.setPaused(true, game); };
      this.pauseBtn = pb;
      list.push(pb);
      var sb = slowButton(0, 0, 0, 0, function () { return self.slowLeft; });
      sb.id = 'slow';
      sb.onTap = function () { self.useSlow(game); };
      this.slowBtn = sb;
      list.push(sb);
      this.buttons = list;
      this.placeSlow();
    },
    placeSlow: function () {
      var Lt = this.Lt, b = this.slowBtn;
      if (!b) return;
      if (Lt.portrait) {
        var h = 44, w = 88;
        b.x = Lt.W - w - 10; b.y = Lt.deckY + (Lt.deckH - h) / 2; b.w = w; b.h = h;
      } else {
        var w2 = 96, h2 = 44;
        b.x = 24; b.y = Lt.H - Lt.banner - h2 - 16; b.w = w2; b.h = h2;
      }
      b.visible = this.slowLeft > 0 || this.slowT > 0;
    },

    /* ---------- пауза / исходы ---------- */
    setPaused: function (on, game) {
      game = game || this.game;
      if (on && (this.mode === 'running' || this.mode === 'shop')) {
        this.pausePrev = this.mode;
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildEnd(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = this.pausePrev === 'shop' ? 'running' : 'running';
        E.sdk.gameplayStart();
        this.buildEnd(game);
      }
    },

    onWin: function (game, capture) {
      if (this.result) return;
      this.mode = 'win';
      this.result = { win: true };
      var first = !Meta.done()[this.levelNum];
      this.perfect = this.st.fired <= this.st.targets.length;
      var base = C.economy.base + C.economy.perLevel * this.levelNum +
                 C.economy.perShotLeft * this.st.shots;
      if (this.perfect) base += C.economy.perfect;
      if (!first) base = Math.round(base * C.economy.replayRate);
      this.reward = base;
      if (!capture && !this.autopilot) {
        Meta.addCoins(base);
        Meta.markDone(this.levelNum);
        Meta.setLevel(Math.max(Meta.level(), Math.min(C.levels.length, this.levelNum + 1)));
      }
      E.audio.sfx('win');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },
    onLose: function (game) {
      if (this.result) return;
      this.mode = 'over';
      this.result = { win: false };
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      this.buildEnd(game);
    },
    buildEnd: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, self = this;
      var list = [];
      var bw = Math.min(300, W * 0.72);
      var bh = Math.min(52, Math.max(42, H * 0.078));
      var gapY = 10;
      var cy = (Lt.top + (Lt.portrait ? Lt.deckY : H)) / 2;
      var n = this.mode === 'paused' ? 4 : 3;
      var y0 = clamp(cy - (n * (bh + gapY)) / 2, Lt.top + 26, H - Lt.banner - n * (bh + gapY) - 12);
      var x = W / 2 - bw / 2;
      var i = 0;
      function add(text, bg, border, fg, fs, fn) {
        list.push(new E.ui.Button({ x: x, y: y0 + i * (bh + gapY), w: bw, h: bh, text: text,
          bg: bg, border: border, fg: fg, fontSize: fs, onTap: fn }));
        i++;
      }
      if (this.mode === 'paused') {
        add(T('pause_resume'), '#3f5228', P.good, '#eef7e2', 18, function () { E.audio.sfx('click'); self.setPaused(false, game); });
        add(T('pause_restart'), 'rgba(45,28,44,0.94)', 'rgba(242,193,78,0.45)', P.text, 17, function () {
          E.audio.sfx('click'); game.setScene('play', { level: self.levelNum });
        });
        add(E.audio.isMuted() ? T('sound_off') : T('sound_on'), 'rgba(30,18,34,0.92)', 'rgba(242,193,78,0.25)', P.dim, 15, function (b) {
          var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m);
          b.text = m ? T('sound_off') : T('sound_on');
        });
        add(T('pause_menu'), 'rgba(30,18,34,0.92)', 'rgba(242,193,78,0.25)', P.text, 16, function () {
          E.audio.sfx('click'); game.setScene('menu', {});
        });
      } else if (this.mode === 'win') {
        var last = this.levelNum >= C.levels.length;
        add(last ? T('to_menu') : T('next_level'), '#3f5228', P.good, '#eef7e2', 18, function () {
          E.audio.sfx('click');
          self.leaveWin(game, last ? 'menu' : 'next');
        });
        if (!this.captureMode && !this.autopilot && !this.doubled) {
          add(T('double_reward'), '#4a3418', P.gold, '#ffe6b8', 16, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.doubled = true;
                Meta.addCoins(self.reward);
                E.audio.sfx('coin');
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) E.audio.sfx('deny'); }
            });
          });
        }
        add(T('to_menu'), 'rgba(30,18,34,0.92)', 'rgba(242,193,78,0.25)', P.dim, 15, function () {
          E.audio.sfx('click'); self.leaveWin(game, 'menu');
        });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.autopilot && !this.reviveUsed) {
          add(T('second_chance'), '#4a3418', P.gold, '#ffe6b8', 17, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.reviveUsed = true;
                self.st.shots += 3;
                self.st.phase = 'aim';
                self.mode = 'running';
                self.result = null;
                E.sdk.gameplayStart();
                E.audio.sfx('revive');
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.toast = { t: 1.6, text: T('ad_fail') }; } }
            });
          });
        }
        add(T('retry'), 'rgba(45,28,44,0.94)', 'rgba(242,193,78,0.45)', P.text, 18, function () {
          E.audio.sfx('click'); game.setScene('play', { level: self.levelNum });
        });
        add(T('to_menu'), 'rgba(30,18,34,0.92)', 'rgba(242,193,78,0.25)', P.dim, 15, function () {
          E.audio.sfx('click'); game.setScene('menu', {});
        });
      }
      this.endButtons = list;
    },
    leaveWin: function (game, to) {
      var self = this;
      var needAd = !this.captureMode && !this.autopilot && (this.levelNum % C.ads.interstitialEvery === 0);
      var go = function () {
        if (to === 'next') game.setScene('play', { level: Math.min(C.levels.length, self.levelNum + 1) });
        else game.setScene('menu', {});
      };
      if (needAd) E.sdk.showInterstitial(function () { go(); });
      else go();
    },

    /* ---------- магазин ---------- */
    openShop: function (game) {
      this.shopPrev = this.mode;
      this.mode = 'shop';
      var self = this;
      this.shopButtons = shopButtons(game.view,
        function () { self.buildEnd(game); },
        function () { self.mode = 'running'; self.buildEnd(game); });
    },

    /* ---------- выстрел / ввод ---------- */
    fire: function (game, angle, power) {
      if (!L.fire(this.st, angle, power)) return false;
      this.flash = 0.16;
      this.recoil = 1;
      E.audio.sfx('shoot');
      E.fx.shake(4.5, 0.16);
      return true;
    },
    useSlow: function (game) {
      if (this.slowLeft <= 0) { this.toast = { t: 1.6, text: T('slow_empty') }; E.audio.sfx('deny'); return; }
      if (this.slowT > 0) { this.slowT = 5.0; return; }
      this.slowLeft--;
      this.slowT = 5.0;
      E.audio.sfx('pulse');
      this.toast = { t: 1.2, text: T('slow_on') };
    },

    handleInput: function (game) {
      var Ptr = E.input.pointer, Lt = this.Lt, self = this;
      if (Ptr.pressed) {
        if (E.ui.handleTap(this.buttons, Ptr.x, Ptr.y)) return;
        if (this.st.phase === 'aim' && this.mode === 'running') {
          var a = L.aim(this.wx(Ptr.x), this.wy(Ptr.y));
          if (a) {
            this.drag = { power: a.power, angle: a.angle };
            this.kbAim = false;
          }
        }
      }
      if (this.drag) {
        if (Ptr.down) {
          var a2 = L.aim(this.wx(Ptr.x), this.wy(Ptr.y));
          if (a2) { this.drag.power = a2.power; this.drag.angle = a2.angle; }
        }
        if (Ptr.released) {
          var d = this.drag; this.drag = null;
          if (d.power > 0.07) this.fire(game, d.angle, d.power);
        }
      }
      // клавиатура: стрелки наводят, пробел стреляет
      var changed = false;
      if (E.input.down('ArrowUp') || E.input.wasPressed('ArrowUp')) { this.aimAngle = clamp(this.aimAngle + 0.02, C.physics.angleMin, C.physics.angleMax); changed = true; }
      if (E.input.down('ArrowDown') || E.input.wasPressed('ArrowDown')) { this.aimAngle = clamp(this.aimAngle - 0.02, C.physics.angleMin, C.physics.angleMax); changed = true; }
      if (E.input.down('ArrowRight') || E.input.wasPressed('ArrowRight')) { this.aimPower = clamp(this.aimPower + 0.012, 0.05, 1); changed = true; }
      if (E.input.down('ArrowLeft') || E.input.wasPressed('ArrowLeft')) { this.aimPower = clamp(this.aimPower - 0.012, 0.05, 1); changed = true; }
      if (changed) this.kbAim = true;
      if (E.input.wasPressed('Space') && this.st.phase === 'aim' && this.mode === 'running') {
        this.fire(game, this.aimAngle, this.aimPower);
      }
    },

    /* ---------- главный шаг ---------- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.bannerT > 0) this.bannerT -= dt;
      if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 4.5);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) { this.slowT = 0; this.placeSlow(); } }
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        this.floaters[i].t += dt;
        if (this.floaters[i].t > 1.1) this.floaters.splice(i, 1);
      }
      var Ptr = E.input.pointer;

      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'paused') { this.setPaused(false, game); return; }
        if (this.mode === 'running') { this.setPaused(true, game); return; }
        if (this.mode === 'shop') { this.mode = 'running'; return; }
      }
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (Ptr.pressed) E.ui.handleTap(this.endButtons, Ptr.x, Ptr.y);
        if (this.autopilot) {
          this.autoT += dt;
          if (this.autoT > 1.8) {
            this.autoT = 0;
            if (this.mode === 'win') game.setScene('play', { level: Math.min(C.levels.length, this.levelNum + 1) });
            else if (this.mode === 'over') game.setScene('play', { level: this.levelNum });
          }
        }
        return;
      }
      if (this.mode === 'shop') {
        if (Ptr.pressed) E.ui.handleTap(this.shopButtons, Ptr.x, Ptr.y);
        return;
      }

      // физика с множителем замедления (шаг остаётся 1/60 — баллистика не плывёт)
      this.physAcc += dt;
      var mult = this.slowT > 0 ? 3 : 1;
      var stepDur = mult / 60;
      var guard = 0;
      while (this.physAcc >= stepDur - 1e-9 && guard < 4) {
        L.update(this.st, 1 / 60);
        this.physAcc -= stepDur;
        guard++;
      }
      this.processEvents(game);
      if (this.mode !== 'running') return;

      this.handleInput(game);
      if (this.st.phase !== this.lastPhase) {
        this.lastPhase = this.st.phase;
        this.placeSlow();
      }
      if (this.autopilot) this.autoTick(game, dt);
    },

    autoTick: function (game, dt) {
      if (this.st.phase !== 'aim' || this.mode !== 'running') { this.autoSol = null; return; }
      if (!this.autoSol) {
        this.autoSol = L.solve(this.st);
        this.autoT = 0;
        if (!this.autoSol) {
          // страховка: перебор не нашёл решения — стреляем «в общем направлении»,
          // но кадр никогда не падает и запись не встаёт
          this.autoSol = { angle: -0.72, power: 0.82, count: 0 };
          if (this.st.shots <= 0) this.st.shots = 1;
        }
      }
      this.autoT += dt;
      var a = this.autoSol;
      // показываем наводку, потом стреляем — как живой игрок, кадр не пустует
      this.aimAngle = a.angle; this.aimPower = a.power; this.kbAim = true;
      if (this.autoT >= 0.55) {
        this.autoSol = null;
        this.fire(game, a.angle, a.power);
      }
    },

    processEvents: function (game) {
      var ev = L.takeEvents(this.st);
      for (var i = 0; i < ev.length; i++) {
        var e = ev[i];
        if (e.type === 'fire') {
          this.recoil = 1; this.flash = 0.16;
        } else if (e.type === 'bounce') {
          E.audio.sfx('hit');
          E.fx.burst(this.sx(e.x), this.sy(e.y), '#ffd9a0', 5, 90, this._fxRng());
        } else if (e.type === 'hit') {
          E.audio.sfx('explode');
          E.fx.burst(this.sx(e.x), this.sy(e.y), '#ffb347', 16, 230, this._fxRng());
          E.fx.burst(this.sx(e.x), this.sy(e.y), '#f4e7cb', 8, 150, this._fxRng());
          E.fx.shake(7, 0.22);
          E.fx.flash('#ffd9a0', 0.12);
        } else if (e.type === 'land') {
          E.fx.burst(this.sx(e.x), this.sy(e.y), '#c98a5a', 6, 70, this._fxRng());
        } else if (e.type === 'win') {
          this.onWin(game, this.captureMode);
          return;
        } else if (e.type === 'over') {
          this.onLose(game);
          return;
        }
      }
    },
    _fxRng: function () {
      // искры — тоже детерминированные: свой RNG у сцены, без Math.random
      if (!this._rng) this._rng = new E.Rng(1337 + this.levelNum);
      return this._rng;
    },

    /* ---------- capture ---------- */
    killAll: function () {
      for (var i = 0; i < this.st.targets.length; i++) {
        var tg = this.st.targets[i];
        if (tg.alive) { tg.alive = false; tg.hitT = 9; }
      }
    },
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.captureMode = true;
      this.st.recordSafe = true;
      if (cp.coins != null) {
        var n = parseInt(cp.coins, 10);
        if (!isNaN(n)) Meta.setCoins(n);
      }
      var mode = cp.mode;
      if (mode === 'shop') {
        this.openShop(game);
      } else if (mode === 'win') {
        this.killAll();
        this.onWin(game, true);
      } else if (mode === 'over') {
        this.st.shots = 0;
        this.st.phase = 'over';
        this.mode = 'over';
        this.buildEnd(game);
      } else if (!this.autopilot) {
        var frac = 0.42;
        if (cp.t != null) { var tt = parseFloat(cp.t); if (!isNaN(tt)) frac = clamp(0.18 + tt * 0.02, 0.2, 0.7); }
        var sol = L.demo(this.st, frac);
        if (sol) {
          this.aimAngle = sol.angle;
          this.aimPower = sol.power;
        }
      }
      this.layout(game);
      this.buildButtons(game);
      this.buildEnd(game);
      this.lastPhase = this.st.phase;
    },
    openShopForCapture: function (game) { this.openShop(game); },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'over') {
        this.st.shots = 0; this.st.phase = 'over'; this.mode = 'over';
        this.result = { win: false };
        this.buildEnd(game);
      } else if (s.mode === 'win') {
        this.killAll();
        this.onWin(game, true);
        this.captureMode = true;
        this.buildEnd(game);
      }
      if (s.level) { this.levelNum = clamp(s.level | 0, 1, C.levels.length); }
    },
    getCaptureState: function () {
      return { scene: 'play', mode: this.mode, level: this.levelNum, phase: this.st ? this.st.phase : '' };
    },

    /* ================= отрисовка ================= */
    drawBackground: function (ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      A.sky(ctx, W, H, this.t);
      if (!Lt.portrait) A.mesas(ctx, W, H, Lt.groundY - 4, 13 + this.levelNum);
      A.dunes(ctx, W, H, Lt.groundY);
      A.ground(ctx, 0, W, Lt.groundY, H - Lt.groundY + 4, 11 + this.levelNum);
      // пустынный реквизит за ареной
      var s = Lt.s;
      if (!Lt.portrait) {
        A.cactus(ctx, 60 * s + Lt.ax - 260 * s, Lt.groundY, Math.min(s * 260, 130), false);
      } else {
        A.rock(ctx, Lt.ax + 40 * s, Lt.groundY, s * 46, 3);
        A.rock(ctx, Lt.ax + 950 * s, Lt.groundY, s * 52, 5);
      }
      // «рама» стрельбища: боковые стойки и верхняя балка
      var x0 = Lt.ax, x1 = Lt.ax + WORLD.w * s, yTop = Lt.ay;
      var pw = Math.max(4, 9 * s);
      ctx.fillStyle = 'rgba(70,52,58,0.75)';
      ctx.fillRect(x0 - pw, yTop, pw, WORLD.ground * s);
      ctx.fillRect(x1, yTop, pw, WORLD.ground * s);
      ctx.fillStyle = 'rgba(96,72,72,0.55)';
      ctx.fillRect(x0, yTop - pw * 0.6, x1 - x0, pw * 0.6);
      ctx.fillStyle = 'rgba(240,199,100,0.35)';
      for (var lx = x0 + (x1 - x0) * 0.12; lx < x1; lx += (x1 - x0) * 0.19) {
        ctx.beginPath(); ctx.arc(lx, yTop - pw * 0.6, Math.max(1.5, 2.6 * s), 0, Math.PI * 2); ctx.fill();
      }
    },

    drawWalls: function (ctx) {
      var Lt = this.Lt, walls = this.st.def.walls;
      for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        A.wall(ctx, this.sx(w.x), this.sy(w.y), w.w * Lt.s, w.h * Lt.s, Lt.s, i + this.levelNum);
      }
    },

    drawTargets: function (ctx) {
      var Lt = this.Lt, st = this.st;
      for (var i = 0; i < st.targets.length; i++) {
        var tg = st.targets[i];
        var p = L.tpos(tg, st.t);
        var x = this.sx(p.x), y = this.sy(p.y), r = tg.r * Lt.s;
        // тень на земле
        var sh = Math.max(0, 1 - (WORLD.ground - p.y) / 900);
        if (tg.alive) {
          ctx.save();
          ctx.globalAlpha = 0.22 + sh * 0.18;
          ctx.fillStyle = '#2a1226';
          ctx.beginPath();
          ctx.ellipse(x, Lt.groundY - 2, r * 0.75, r * 0.20, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        A.target(ctx, x, y, r, { t: st.t, dead: !tg.alive, hitT: tg.hitT, mv: tg.mv });
      }
    },

    drawShell: function (ctx) {
      var Lt = this.Lt, st = this.st;
      for (var i = 0; i < st.balls.length; i++) {
        var b = st.balls[i];
        if (b.trail.length > 1) A.trail(ctx, b.trail, Lt.s, Lt.ax, Lt.ay);
        // ядро крупнее геометрии: на 360px арена мелкая, но снаряд должен читаться
        A.ball(ctx, this.sx(b.x), this.sy(b.y), Math.max(6, C.physics.ballR * Lt.s * 1.15), 0);
      }
    },

    aimState: function () {
      if (this.drag) return this.drag;
      if (this.kbAim && this.st.phase === 'aim') return { angle: this.aimAngle, power: this.aimPower };
      if (this.autopilot && this.autoSol) return { angle: this.autoSol.angle, power: this.autoSol.power };
      return null;
    },
    drawAim: function (ctx) {
      var Lt = this.Lt, st = this.st;
      var m = L.muzzle(0);
      var aim = this.aimState();
      var cannonAngle = aim ? aim.angle : (this.autopilot ? -0.7 : this.aimAngle);
      // пушка
      A.cannon(ctx, this.sx(C.cannon.x), this.sy(C.cannon.y), cannonAngle, Lt.s,
        { t: this.t, recoil: this.recoil * 14 });
      if (this.flash > 0) {
        var mm = L.muzzle(cannonAngle);
        A.muzzleFlash(ctx, this.sx(mm.x), this.sy(mm.y), cannonAngle, Lt.s, this.flash / 0.16);
      }
      if (!aim || st.phase !== 'aim') return;
      var mm2 = L.muzzle(aim.angle);
      var cx = this.sx(C.cannon.x), cy = this.sy(C.cannon.y);
      var ex = this.sx(mm2.x + Math.cos(aim.angle) * aim.power * (C.physics.dragMax - 60));
      var ey = this.sy(mm2.y + Math.sin(aim.angle) * aim.power * (C.physics.dragMax - 60));
      A.aimLine(ctx, cx, cy, ex, ey, aim.power, Lt.s);
      if (this.previewLvl > 0) {
        var tr = L.trace(st, aim.angle, aim.power,
          { pts: true, maxT: this.previewLvl >= 2 ? 4.2 : C.previewShort });
        A.previewDots(ctx, tr.pts, Lt.s, Lt.ax, Lt.ay, '#ffe0a8');
      }
    },

    drawFloaters: function (ctx) {
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
        E.ui.text(ctx, f.text, f.x, f.y - f.t * 30, f.size, f.color, 'center', 700);
      }
      ctx.globalAlpha = 1;
    },

    drawHud: function (ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, st = this.st;
      var portrait = Lt.portrait;
      // затемнение сверху, чтобы текст читался на солнце
      var hs = ctx.createLinearGradient(0, 0, 0, Lt.hudH + 20);
      hs.addColorStop(0, 'rgba(16,8,22,0.88)');
      hs.addColorStop(0.7, 'rgba(16,8,22,0.45)');
      hs.addColorStop(1, 'rgba(16,8,22,0)');
      ctx.fillStyle = hs;
      ctx.fillRect(0, 0, W, Lt.hudH + 20);

      coinsBadge(ctx, 10, 10, 104);

      if (portrait) {
        // центр: номер уровня + название (между бейджем монет и паузой)
        var cw = Math.max(110, W - 236);
        E.ui.text(ctx, T('level_n', { n: this.levelNum, total: C.levels.length }),
          W / 2, 22, 12, 'rgba(248,238,218,0.65)', 'center', 600);
        var nm = T('lv_' + this.levelNum);
        var fs = E.ui.fit(ctx, nm, cw, 16, 700);
        E.ui.text(ctx, nm, W / 2, 38, fs, P.text, 'center', 700);
      } else {
        // левая панель: всё ниже бейджа монет, чтобы ничего не пересекалось
        var px = 24;
        E.ui.text(ctx, T('level_n', { n: this.levelNum, total: C.levels.length }),
          px, 78, 13, 'rgba(248,238,218,0.6)', 'left', 600);
        var nm2 = T('lv_' + this.levelNum);
        var fs2 = E.ui.fit(ctx, nm2, Math.max(120, Lt.ax - px - 90), Math.min(26, H * 0.06), 800);
        E.ui.text(ctx, nm2, px, 104, fs2, '#ffd58a', 'left', 800);
        // счётчики
        var cy = 152;
        A.targetIcon(ctx, px + 12, cy, 13);
        E.ui.text(ctx, T('targets') + ' ' + L.aliveCount(st), px + 34, cy + 1, 16, P.text, 'left', 700);
        cy += 42;
        E.ui.text(ctx, T('shots'), px, cy + 2, 12, 'rgba(248,238,218,0.6)', 'left', 600);
        for (var i = 0; i < Math.min(st.maxShots, 10); i++) {
          A.shellIcon(ctx, px + 8 + i * 20, cy + 26, 7, i < st.shots);
        }
        if (st.maxShots > 10) E.ui.text(ctx, '×' + st.shots, px + 8 + 10 * 20 + 6, cy + 26, 13, P.text, 'left', 700);
        // подсказка
        var hint = st.phase === 'aim' ? T('hint_aim') : T('hint_fly');
        var hs2 = Math.min(13, W * 0.02);
        E.ui.text(ctx, this.slowT > 0 ? T('slow_on') : hint, px, H - Lt.banner - 78,
          hs2, this.slowT > 0 ? P.accent : 'rgba(248,238,218,0.5)', 'left', 500);
      }

      if (portrait) {
        // нижняя панель: цели, ядра, замедление
        var dy = Lt.deckY;
        var g = ctx.createLinearGradient(0, dy, 0, H);
        g.addColorStop(0, 'rgba(24,12,28,0.90)');
        g.addColorStop(1, 'rgba(16,8,22,0.96)');
        ctx.fillStyle = g;
        ctx.fillRect(0, dy, W, H - dy);
        ctx.fillStyle = 'rgba(242,193,78,0.22)';
        ctx.fillRect(0, dy, W, 1.5);

        var midY = dy + Lt.deckH * 0.34;
        A.targetIcon(ctx, 22, midY, 12);
        E.ui.text(ctx, String(L.aliveCount(st)), 40, midY + 1, 20, P.text, 'left', 800);
        E.ui.text(ctx, T('targets'), 40, midY + 21, 12, 'rgba(248,238,218,0.55)', 'left', 500);

        var sx0 = Math.min(150, W * 0.38);
        E.ui.text(ctx, T('shots'), sx0, midY - 15, 12, 'rgba(248,238,218,0.55)', 'left', 500);
        for (var j = 0; j < Math.min(st.maxShots, 8); j++) {
          A.shellIcon(ctx, sx0 + 8 + j * 20, midY + 6, 7.5, j < st.shots);
        }
        var hint2 = this.slowT > 0 ? T('slow_on') : (st.phase === 'aim' ? T('hint_aim') : T('hint_fly'));
        var hfs = E.ui.fit(ctx, hint2, W - 110, 12, 500);
        E.ui.text(ctx, hint2, W / 2 - 40, dy + Lt.deckH - 16, hfs,
          this.slowT > 0 ? P.accent : 'rgba(248,238,218,0.45)', 'center', 500);
      }

      E.ui.drawButtons(ctx, this.buttons);
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 1.6);
        var tw = Math.min(300, W * 0.86);
        var ty = this.Lt.portrait ? (Lt.deckY - 54) : (H - 96);
        pill(ctx, W / 2 - tw / 2, ty, tw, 36, 'rgba(18,10,24,0.94)', P.panelLine);
        E.ui.text(ctx, this.toast.text, W / 2, ty + 18, 12.5, P.text, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },

    drawBanner: function (ctx) {
      if (this.bannerT <= 0) return;
      var Lt = this.Lt, W = Lt.W;
      var k = Math.min(1, this.bannerT / 0.4);
      ctx.save();
      ctx.globalAlpha = Math.sin(clamp(k, 0, 1) * Math.PI * 0.5);
      var cy = (Lt.top + Lt.bot) / 2;
      var bw = Math.min(280, W * 0.78);
      ctx.fillStyle = 'rgba(16,8,22,0.6)';
      E.ui.roundRect(ctx, W / 2 - bw / 2, cy - 28, bw, 56, 12);
      ctx.fill();
      E.ui.text(ctx, this.bannerText, W / 2, cy - 4, Math.min(W * 0.06, 24), P.gold, 'center', 800);
      if (this.bannerSub) E.ui.text(ctx, this.bannerSub, W / 2, cy + 17, Math.min(W * 0.038, 13), P.good, 'center', 600);
      ctx.restore();
    },

    drawEnd: function (ctx) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H;
      if (this.mode === 'shop') {
        var self = this;
        drawShop(ctx, this.game.view, function () { self.buildEnd(self.game); },
          function () { self.mode = 'running'; self.buildEnd(self.game); });
        E.ui.drawButtons(ctx, this.shopButtons);
        return;
      }
      if (this.mode !== 'paused' && this.mode !== 'win' && this.mode !== 'over') return;
      ctx.fillStyle = 'rgba(14,7,20,0.74)';
      ctx.fillRect(0, 0, W, H);
      var first = this.endButtons.length ? this.endButtons[0] : null;
      var titleY = first ? Math.max(Lt.top + 34, first.y - 128) : H * 0.3;
      if (this.mode === 'paused') {
        E.ui.text(ctx, T('paused'), W / 2, titleY, Math.min(W * 0.09, 34), P.gold, 'center', 800);
      } else if (this.mode === 'win') {
        E.ui.text(ctx, T('win_title'), W / 2, titleY, Math.min(W * 0.085, 34), P.good, 'center', 800);
        E.ui.text(ctx, T('win_sub'), W / 2, titleY + 28, Math.min(W * 0.038, 14), 'rgba(248,238,218,0.7)', 'center', 500);
        var ry = first ? first.y - 46 : titleY + 60;
        var rw = Math.min(250, W * 0.66);
        pill(ctx, W / 2 - rw / 2, ry - 18, rw, 36, 'rgba(18,10,24,0.85)', P.panelLine);
        A.coin(ctx, W / 2 - rw / 2 + 22, ry, 9);
        E.ui.text(ctx, T('win_reward', { n: this.doubled ? this.reward * 2 : this.reward }),
          W / 2 + 10, ry + 1, 15, P.gold, 'center', 700);
        if (this.perfect) {
          E.ui.text(ctx, T('win_perfect', { n: C.economy.perfect }), W / 2, titleY + 50,
            Math.min(W * 0.034, 12.5), P.accent, 'center', 600);
        }
      } else {
        E.ui.text(ctx, T('over_title'), W / 2, titleY, Math.min(W * 0.08, 32), P.bad, 'center', 800);
        E.ui.text(ctx, T('over_sub'), W / 2, titleY + 28, Math.min(W * 0.034, 13),
          'rgba(248,238,218,0.65)', 'center', 500);
        E.ui.text(ctx, T('over_levels', { n: this.levelNum, total: C.levels.length }),
          W / 2, titleY + 50, Math.min(W * 0.032, 12), 'rgba(248,238,218,0.45)', 'center', 600);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },

    draw: function (game, ctx) {
      var Lt = this.Lt;
      this.drawBackground(ctx);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawWalls(ctx);
      this.drawTargets(ctx);
      this.drawShell(ctx);
      this.drawAim(ctx);
      ctx.restore();
      E.fx.draw(ctx);
      this.drawFloaters(ctx);
      if (this.slowT > 0) {
        var vg = ctx.createRadialGradient(Lt.W / 2, Lt.H / 2, Math.min(Lt.W, Lt.H) * 0.25,
          Lt.W / 2, Lt.H / 2, Math.max(Lt.W, Lt.H) * 0.75);
        vg.addColorStop(0, 'rgba(255,179,71,0)');
        vg.addColorStop(1, 'rgba(255,140,60,0.14)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, Lt.W, Lt.H);
      }
      this.drawBanner(ctx);
      if (this.mode === 'running') this.drawHud(ctx);
      this.drawEnd(ctx);
      E.fx.drawFlash(ctx, Lt.W, Lt.H);
    }
  };

  G.scenes = S;
})(window.GAME);
