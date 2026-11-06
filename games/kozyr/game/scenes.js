/* game/scenes.js — сцены «Козыря»: menu, play, shop. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine, C = G.config, L = G.logic, P = C.palette;
  var S = {};
  function T(k, v) { return E.i18n.t(k, v); }
  function easeOut(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------- состояние игрока ---------- */
  function coins() { return E.storage.get('coins', 0) | 0; }
  function addCoins(n) { E.storage.set('coins', Math.max(0, coins() + n)); }
  function perks() { var p = E.storage.get('perks', null); return (p && typeof p === 'object') ? p : {}; }
  function hasPerk(id) { return !!perks()[id]; }
  function buyPerk(id) { var p = perks(); p[id] = true; E.storage.set('perks', p); }
  function charges() { var c = E.storage.get('charges', null); return (c && typeof c === 'object') ? c : {}; }
  function addCharges(id, n) { var c = charges(); c[id] = (c[id] | 0) + (n | 0); E.storage.set('charges', c); }
  function useCharge(id) { var c = charges(); if (!(c[id] > 0)) return false; c[id]--; E.storage.set('charges', c); return true; }
  function hasCharges(id) { return (charges()[id] | 0) > 0; }
  function rivalAt(i) { return C.rivals[Math.max(0, Math.min(C.rivals.length - 1, i | 0))]; }

  // Явные литералы ключей: статический чекер release-check ищет их в коде,
  // а не собирает из строк — иначе все имена соперников считаются «мёртвыми».
  var RIVAL_NAME = {
    tihon: 'r_tihon', glasha: 'r_glasha', kuzma: 'r_kuzma', varvara: 'r_varvara',
    frol: 'r_frol', agrafena: 'r_agrafena', savva: 'r_savva', marfa: 'r_marfa',
    erofey: 'r_erofey', pelageya: 'r_pelageya', pahom: 'r_pahom', akim: 'r_akim'
  };
  var RIVAL_TAG = {
    tihon: 't_tihon', glasha: 't_glasha', kuzma: 't_kuzma', varvara: 't_varvara',
    frol: 't_frol', agrafena: 't_agrafena', savva: 't_savva', marfa: 't_marfa',
    erofey: 't_erofey', pelageya: 't_pelageya', pahom: 't_pahom', akim: 't_akim'
  };
  var RIVAL_TAUNT = {
    tihon: 'taunt_tihon', glasha: 'taunt_glasha', kuzma: 'taunt_kuzma', varvara: 'taunt_varvara',
    frol: 'taunt_frol', agrafena: 'taunt_agrafena', savva: 'taunt_savva', marfa: 'taunt_marfa',
    erofey: 'taunt_erofey', pelageya: 'taunt_pelageya', pahom: 'taunt_pahom', akim: 'taunt_akim'
  };
  var PERK_NAME = { hint: 'perk_hint', swap: 'perk_swap', peek: 'perk_peek' };
  var PERK_DESC = { hint: 'perk_hint_desc', swap: 'perk_swap_desc', peek: 'perk_peek_desc' };

  function rivalName(i) { return T(RIVAL_NAME[rivalAt(i).key] || 'rival'); }
  function rivalTag(i) { return T(RIVAL_TAG[rivalAt(i).key] || 'rival'); }
  function curRival() { return Math.min(C.rivals.length - 1, E.storage.get('rival', 0) | 0); }
  function isFinal() { return curRival() >= C.rivals.length - 1; }

  /* ---------- мелкая графика ---------- */
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function coinsBadge(ctx, x, y) {
    var h = 34, w = 106;
    pill(ctx, x, y, w, h, 'rgba(8,20,15,0.55)', 'rgba(242,193,78,0.35)');
    G.art.coin(ctx, x + 19, y + h / 2, 11);
    E.ui.text(ctx, String(coins()), x + 34, y + h / 2 + 1, 18, P.gold, 'left', 700);
  }
  function soundButton(game, x, y) {
    var that = {};
    var b = new E.ui.Button({
      x: x, y: y, w: 44, h: 34, bg: 'rgba(8,20,15,0.55)', border: 'rgba(242,193,78,0.35)',
      icon: function (ctx, btn) {
        var mm = E.audio.isMuted();
        E.ui.text(ctx, mm ? '♪̸' : '♪', btn.x + btn.w / 2, btn.y + btn.h / 2 + 1, 19, mm ? '#7f9c8f' : P.gold, 'center', 700);
      },
      onTap: function () {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m);
        E.storage.set('muted', m);
        E.audio.sfx('click');
      }
    });
    return b;
  }

  /* ---------- МЕНЮ ---------- */
  S.menu = {
    name: 'menu',
    enter: function (game) {
      this.game = game; this.t = 0; this.buttons = []; this.help = false;
      E.audio.music('menu');
      E.sdk.showBanner();
      E.sdk.gameplayStop();
      this._build(game);
    },
    onResize: function (game) { this._build(game); },
    /* единая раскладка меню: эмблема → заголовок → соперник → кнопки */
    _menuLayout: function (v) {
      var W = v.w, H = v.h;
      var compact = H < 560;                       // короткий ландшафт (844×390 и ниже)
      var cw = compact ? 0 : Math.min(W * 0.13, 86), ch = cw * 1.45;
      var cy = compact ? 0 : H * 0.21;
      var titleSize = compact ? Math.min(W * 0.085, H * 0.115, 40) : Math.min(W * 0.13, H * 0.11, 68);
      var titleY = compact ? H * 0.17 : cy + ch * 0.5 + titleSize * 0.66;
      var subY = titleY + (compact ? 26 : Math.max(24, titleSize * 0.44));
      var rpH = compact ? 48 : 66;
      var rpY = subY + (compact ? 14 : 30);
      var bw = Math.min(340, W * 0.74);
      var bh = compact ? 40 : Math.max(50, Math.min(62, H * 0.072));
      var y0 = rpY + rpH + (compact ? 12 : 22);
      return { compact: compact, cw: cw, ch: ch, cy: cy, titleSize: titleSize, titleY: titleY,
               subY: subY, rpY: rpY, rpH: rpH, bw: bw, bh: bh, y0: y0 };
    },
    _build: function (game) {
      var v = game.view, W = v.w;
      var M = this._menuLayout(v);
      var bw = M.bw, bh = M.bh, cx = W / 2, y0 = M.y0;
      var that = this;
      this.buttons = [];
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, text: T('play'),
        bg: '#1d5138', border: P.gold, fg: P.gold, fontSize: Math.round(bh * 0.36),
        onTap: function () { E.audio.sfx('click'); that.goto('play', {}); }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + bh + 14, w: bw, h: bh * 0.82, text: T('shop'),
        bg: 'rgba(12,28,22,0.75)', border: 'rgba(242,193,78,0.45)', fg: P.cream,
        fontSize: Math.round(bh * 0.31),
        onTap: function () { E.audio.sfx('click'); that.goto('shop', {}); }
      }));
      this.buttons.push(soundButton(game, W - 58, 18));
      this.buttons.push(new E.ui.Button({
        x: W - 110, y: 18, w: 44, h: 34, bg: 'rgba(8,20,15,0.55)', border: 'rgba(242,193,78,0.35)',
        text: '?', fontSize: 18, fg: P.gold,
        onTap: function () { E.audio.sfx('click'); that.help = !that.help; }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + bh + 14 + bh * 0.82 + 12, w: bw, h: bh * 0.6,
        text: (E.storage.get('stake', 0) ? T('stake_on') : T('stake_off')) + ' · ' + C.stake.cost,
        bg: 'rgba(12,28,22,0.7)', border: 'rgba(242,193,78,0.3)', fg: P.cream,
        fontSize: Math.max(13, Math.round(bh * 0.28)),
        onTap: function () {
          var on = !E.storage.get('stake', 0);
          if (on && coins() < C.stake.cost) { E.audio.sfx('deny'); return; }
          addCoins(on ? -C.stake.cost : C.stake.cost);
          E.storage.set('stake', on ? 1 : 0);
          E.audio.sfx('click');
          that._build(game);
        }
      }));
    },
    goto: function (name, params) {
      var g = this.game;
      g.setScene(name, params);
      if (name === 'shop') g.scenes.shop.from = 'menu';
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.help) { if (E.input.pointer.pressed) this.help = false; return; }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) this.goto('play', {});
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      G.art.table(ctx, W, H);

      var t = Math.min(1, this.t * 1.4);
      var M = this._menuLayout(v);
      var cy = M.cy, cw = M.cw, ch = M.ch;
      if (!M.compact) {
        var bob = Math.sin(this.t * 1.8) * 4;
        ctx.save();
        ctx.globalAlpha = t;
        ctx.translate(0, bob);
        // эмблема: веер из двух карт за заголовком
        G.art.card(ctx, W / 2 - cw * 1.05, cy - ch * 0.52, cw, ch, { s: 'h', r: 13 }, {});
        G.art.card(ctx, W / 2 + cw * 0.05, cy - ch * 0.52, cw, ch, { s: 's', r: 14 }, { trump: true });
        ctx.restore();
      }

      E.ui.text(ctx, T('title').toUpperCase(), W / 2, M.titleY, M.titleSize, P.gold, 'center', 800);
      E.ui.text(ctx, T('subtitle'), W / 2, M.subY, Math.min(W * 0.042, 20), 'rgba(247,241,227,0.68)', 'center', 500);

      // карточка соперника
      var ri = curRival(), rv = rivalAt(ri);
      var pw = Math.min(340, W * 0.78), ph = M.rpH;
      var px = W / 2 - pw / 2, py = M.rpY;
      pill(ctx, px, py, pw, ph, 'rgba(8,20,15,0.42)', 'rgba(242,193,78,0.22)');
      G.art.avatar(ctx, px + 36, py + ph / 2, 21, rv.color, rivalName(ri).charAt(0), {});
      E.ui.text(ctx, rivalName(ri), px + 66, py + ph / 2 - 10, 17, P.cream, 'left', 700);
      E.ui.text(ctx, rivalTag(ri), px + 66, py + ph / 2 + 10, 13, 'rgba(247,241,227,0.55)', 'left', 500);
      E.ui.text(ctx, T('rival_n', { n: ri + 1, total: C.rivals.length }), px + pw - 14, py + ph / 2, 13, P.gold, 'right', 600);

      coinsBadge(ctx, 18, 18);
      ctx.save(); ctx.globalAlpha = Math.min(1, this.t * 2.2);
      E.ui.drawButtons(ctx, this.buttons);
      ctx.restore();
      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      E.ui.text(ctx, T('best_n', { n: E.storage.get('best', 0) | 0, total: C.rivals.length }), W / 2, H - 46 - banM, Math.max(12, Math.min(W * 0.032, 13)), 'rgba(247,241,227,0.5)', 'center', 600);
      E.ui.text(ctx, T('tavern'), W / 2, H - 24 - banM, Math.min(W * 0.036, 14), 'rgba(247,241,227,0.35)', 'center', 500);
      if (this.help) {
        ctx.fillStyle = 'rgba(6,14,11,0.9)'; ctx.fillRect(0, 0, W, H);
        var hy = H * 0.28;
        E.ui.text(ctx, T('rules_title'), W / 2, hy, Math.min(W * 0.07, 30), P.gold, 'center', 800);
        var lines = [T('rules_1'), T('rules_2'), T('rules_3')];
        for (var k = 0; k < 3; k++) E.ui.text(ctx, lines[k], W / 2, hy + 46 + k * 36, Math.max(13, Math.min(W * 0.036, 16)), P.cream, 'center', 500);
        E.ui.text(ctx, T('back'), W / 2, H * 0.8, 16, 'rgba(247,241,227,0.6)', 'center', 600);
      }
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ---------- МАГАЗИН ---------- */
  S.shop = {
    name: 'shop',
    enter: function (game) {
      this.game = game; this.buttons = []; this.t = 0;
      E.audio.music('menu');
      this._build(game);
    },
    onResize: function (game) { this._build(game); },
    _build: function (game) {
      var v = game.view, W = v.w, H = v.h, that = this;
      var bw = Math.min(280, W * 0.6), bh = 46;
      this.buttons = [];
      var n = C.shop.length;
      var cardH = Math.min(96, (H * 0.46) / n - 8);
      var top = H * 0.24;
      for (var i = 0; i < n; i++) {
        (function (item, idx) {
          var y = top + idx * (cardH + 12);
          var w = Math.min(520, W * 0.9);
          var x = W / 2 - w / 2;
          that.buttons.push(new E.ui.Button({
            x: x + w - 128, y: y + cardH / 2 - 20, w: 116, h: 40,
            text: (item.once && hasPerk(item.id)) ? T('owned') : T('buy'),
            bg: (item.once && hasPerk(item.id)) ? 'rgba(20,40,30,0.9)' : '#1d5138',
            border: (item.once && hasPerk(item.id)) ? 'rgba(247,241,227,0.2)' : P.gold,
            fg: (item.once && hasPerk(item.id)) ? 'rgba(247,241,227,0.4)' : P.gold,
            fontSize: 16,
            enabled: !(item.once && hasPerk(item.id)),
            onTap: function () {
              if (coins() < item.price) { E.audio.sfx('deny'); that.toast = { t: 1.6, text: T('not_enough') }; return; }
              addCoins(-item.price);
              if (item.once) buyPerk(item.id); else addCharges(item.id, item.charge || 1);
              E.audio.sfx('buy');
              that._build(game);
            }
          }));
        })(C.shop[i], i);
      }
      this.buttons.push(new E.ui.Button({
        x: W / 2 - bw / 2, y: H - 78 - (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0), w: bw, h: bh, text: T('back'),
        bg: 'rgba(12,28,22,0.8)', border: 'rgba(242,193,78,0.45)', fg: P.cream, fontSize: 18,
        onTap: function () { E.audio.sfx('click'); that.game.setScene(that.from || 'menu', {}); }
      }));
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Escape')) this.game.setScene(this.from || 'menu', {});
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      G.art.table(ctx, W, H);
      coinsBadge(ctx, 18, 18);
      E.ui.text(ctx, T('shop'), W / 2, H * 0.16, Math.min(W * 0.085, 40), P.gold, 'center', 800);

      var top = H * 0.30, n = C.shop.length;
      var cardH = Math.min(96, (H * 0.46) / n - 8);
      for (var i = 0; i < n; i++) {
        var item = C.shop[i];
        var w = Math.min(520, W * 0.9), x = W / 2 - w / 2, y = top + i * (cardH + 12);
        var owned = item.once && hasPerk(item.id);
        pill(ctx, x, y, w, cardH, owned ? 'rgba(16,36,27,0.75)' : 'rgba(10,26,20,0.62)', owned ? 'rgba(62,207,122,0.35)' : 'rgba(242,193,78,0.22)');
        E.ui.text(ctx, T(PERK_NAME[item.id]), x + 18, y + cardH * 0.38, Math.min(W * 0.045, 20), P.cream, 'left', 700);
        E.ui.text(ctx, T(PERK_DESC[item.id]), x + 18, y + cardH * 0.66, Math.max(12, Math.min(W * 0.033, 13)), 'rgba(247,241,227,0.6)', 'left', 500);
        if (!item.once && hasCharges(item.id)) E.ui.text(ctx, T('charges_n', { n: charges()[item.id] | 0 }), x + 18, y + cardH * 0.88, 13, P.gold, 'left', 700);
        if (!owned) {
          G.art.coin(ctx, x + w - 148, y + cardH / 2, 10);
          E.ui.text(ctx, String(item.price), x + w - 134, y + cardH / 2 + 1, 15, P.gold, 'left', 600);
        }
      }
      E.ui.drawButtons(ctx, this.buttons);
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t);
        pill(ctx, W / 2 - 120, H - 128, 240, 38, 'rgba(120,20,20,0.85)', '#c0392b');
        E.ui.text(ctx, this.toast.text, W / 2, H - 109, 15, '#fff', 'center', 600);
        ctx.globalAlpha = 1;
      }
    },
    getCaptureState: function () { return { scene: 'shop' }; }
  };

  /* ---------- СТОЛ ---------- */
  S.play = {
    name: 'play',
    consumesInputInUpdate: true,
    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.rival = params.rival != null ? (params.rival | 0) : (cp.wave != null ? (cp.wave | 0) : curRival());
      this.rival = Math.max(0, Math.min(C.rivals.length - 1, this.rival));
      this.seed = params.seed != null ? params.seed : (E.capture.seed != null ? E.capture.seed : (Date.now() % 1000000));
      this.st = L.newGame(new E.Rng(this.seed), this.rival, { playerAttacks: params.playerAttacks !== false });
      this.aiTimer = 0; this.denyT = 0; this.hintT = 0; this.peekT = 0;
      this.result = null; this.buttons = []; this.toast = null; this.t = 0;
      this.autoRestart = 0; this.ghosts = []; this.resT = 0;
      this.dealT = 0; this.birth = []; this.aiAnim = this.st.hands[1].length; this.scrimT = 0; this.shakeT = 0;
      this.matches = E.storage.get('matches', 0) | 0;
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      if (params.captureState) this.setCaptureState(game, params.captureState);
    },
    onResize: function () { /* раскладка вычисляется на кадре */ },
    onBack: function (game) { game.setScene('menu', {}); },
    exit: function () { E.sdk.gameplayStop(); },

    /* --- раскладка --- */
    layout: function (v) {
      var W = v.w, H = v.h, banner = 0;
      try { banner = E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0; } catch (e) { banner = 0; }
      var pad = Math.max(10, Math.min(W, H) * 0.028);
      var portrait = H > W * 1.15;
      var cardH = portrait ? Math.min(H * 0.115, W * 0.24, 120) : Math.min(H * 0.155, W * 0.13, 116);
      var cardW = Math.round(cardH * 0.70);
      var handY = H - banner - cardH - pad;
      var btnH = 44;
      var btnY = handY - btnH - 10;
      var tableTop = H * 0.20;
      var tableBottom = btnY - 8;
      return {
        W: W, H: H, pad: pad, cardW: cardW, cardH: cardH,
        handY: handY, btnY: btnY, btnH: btnH, banner: banner,
        tableTop: tableTop, tableBottom: tableBottom, portrait: portrait
      };
    },

    handSlots: function (Lt, n) {
      var avail = Lt.W - Lt.pad * 2;
      var step = n > 1 ? Math.min(Lt.cardW * 0.74, (avail - Lt.cardW) / (n - 1)) : 0;
      var total = Lt.cardW + step * (n - 1);
      var x0 = (Lt.W - total) / 2;
      var out = [];
      for (var i = 0; i < n; i++) out.push({ x: x0 + i * step, y: Lt.handY, w: Lt.cardW, h: Lt.cardH });
      return out;
    },

    /* --- ввод --- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      if (this.result) this.resT += dt;
      for (var gi = this.ghosts.length - 1; gi >= 0; gi--) {
        this.ghosts[gi].t += dt;
        if (this.ghosts[gi].t >= this.ghosts[gi].dur) this.ghosts.splice(gi, 1);
      }
      this.dealT = Math.min(1, this.dealT + dt / 0.5);
      if (this.result) this.scrimT = Math.min(1, this.scrimT + dt / 0.32);
      if (this.shakeT > 0) this.shakeT -= dt;
      var stA = this.st;
      this.aiAnim = lerp(this.aiAnim, stA.hands[1].length, Math.min(1, dt * 9));
      while (this.birth.length < stA.table.length) this.birth.push(this.t);
      if (this.birth.length > stA.table.length) this.birth.length = stA.table.length;
      if (this.denyT > 0) this.denyT -= dt;
      if (this.hintT > 0) this.hintT -= dt;
      if (this.peekT > 0) { this.peekT -= dt; if (this.peekT <= 0 && this.toast) this.toast = null; }
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }

      var st = this.st;
      this._syncButtons(game, dt);

      if (this.autoRestart > 0) {
        this.autoRestart -= dt;
        if (this.autoRestart <= 0) { this._restart(); return; }
      }

      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y)) return;
      }
      if (st.phase === 'over') {
        if (E.input.wasPressed('Escape')) game.setScene('menu', {});
        return;
      }
      if (st.turn === 1 || (E.capture.autoplay && st.turn === 0)) { this._aiTick(dt); return; }
      if (st.turn !== 0) return;

      if (E.input.pointer.pressed) this._tapCard(game, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Space') && L.canPass(st, 0)) { L.pass(st, 0); E.audio.sfx('click'); }
      if (st.phase === 'over') this._finish(0);
    },

    _ghost: function (card, fromX, fromY) {
      var Lt = this.layout(this.game.view);
      this.ghosts.push({
        card: card, x0: fromX, y0: fromY,
        x1: Lt.W / 2 + (this.ghosts.length % 3 - 1) * Lt.cardW * 0.6,
        y1: (Lt.tableTop + Lt.tableBottom) / 2 - Lt.cardH / 2,
        w: Lt.cardW, h: Lt.cardH, t: 0, dur: 0.24
      });
    },
    _tapCard: function (game, mx, my) {
      var st = this.st, Lt = this.layout(game.view);
      var slots = this.handSlots(Lt, st.hands[0].length);
      for (var i = slots.length - 1; i >= 0; i--) {
        var s = slots[i];
        if (mx >= s.x && mx <= s.x + s.w && my >= s.y - 10 && my <= s.y + s.h) {
          var card = st.hands[0][i];
          if (st.phase === 'attack' && L.canPlayerAttack(st, card)) {
            this._ghost(card, s.x, s.y);
            L.attack(st, 0, card); E.audio.sfx('click');
            this.aiTimer = 0;
            if (st.phase === 'over') this._finish(0);
            return;
          }
          if (st.phase === 'defend' && L.legalBeat(st, 0, card)) {
            this._ghost(card, s.x, s.y);
            L.defend(st, 0, card); E.audio.sfx('tick');
            this.aiTimer = 0;
            if (st.phase === 'over') this._finish(0);
            return;
          }
          this.denyT = 0.28; this.shakeT = 0.28; E.audio.sfx('deny');
          return;
        }
      }
    },

    _aiTick: function (dt) {
      var st = this.st;
      var p = st.turn;                         // 1 — соперник, 0 — автопилот (запись видео)
      var person = rivalAt(this.rival);
      var delay = 0.55 + person.smart * 0.30;
      if (p === 0) delay = 0.45;               // автопилот играет ровнее, чтобы видео не «зависало»
      this.aiTimer += dt;
      if (this.aiTimer < delay) return;
      this.aiTimer = 0;
      var Lt0 = this.layout(this.game.view);
      var act = L.aiAct(st);
      if (act.type === 'attack') { this._ghost(act.card, Lt0.W - Lt0.pad - Lt0.cardW, Lt0.pad + 10); L.attack(st, p, act.card); E.audio.sfx('click'); }
      else if (act.type === 'defend') { L.defend(st, p, act.card); E.audio.sfx('tick'); }
      else if (act.type === 'take') { L.take(st, p); E.audio.sfx('hit'); }
      else { L.pass(st, p); E.audio.sfx('click'); }
      if (st.phase === 'over') this._finish(st.winner === 0 ? 0 : 1);
    },

    /* --- кнопки --- */
    _syncButtons: function (game, dt) {
      var st = this.st, Lt = this.layout(game.view), that = this;
      var list = [];
      var bw = 128, bh = Lt.btnH;
      var by = Lt.btnY;
      var cx = Lt.W / 2;

      if (st.phase === 'over') {
        if (!this.result) this._finish(st.winner === 0 ? 0 : 1);
        var r = this.result || { win: true, coins: 0 };
        var y = Math.min(this._resLay(Lt).btn, Lt.handY - bh * 2 - 24);
        list.push(new E.ui.Button({
          x: cx - bw / 2, y: y, w: bw, h: bh,
          text: r.win ? T('next_rival') : T('retry'),
          bg: '#1d5138', border: P.gold, fg: P.gold, fontSize: 18,
          onTap: function () { E.audio.sfx('click'); that._leave(r.win); }
        }));
        if (r.win && !r.doubled) {
          list.push(new E.ui.Button({
            x: cx - bw / 2, y: y + bh + 10, w: bw, h: bh,
            text: T('double_coins'), bg: 'rgba(12,28,22,0.85)', border: 'rgba(242,193,78,0.5)',
            fg: P.cream, fontSize: 17,
            onTap: function () {
              E.sdk.showRewarded({
                onReward: function () { r.doubled = true; addCoins(r.coins); E.audio.sfx('coin'); that._syncButtons(game, dt); },
                onDone: function () {}
              });
            }
          }));
        }
        if (!r.win && !r.redealt) {
          list.push(new E.ui.Button({
            x: cx - bw / 2, y: y + bh + 10, w: bw, h: bh,
            text: T('redeal'), bg: 'rgba(12,28,22,0.85)', border: 'rgba(242,193,78,0.5)',
            fg: P.cream, fontSize: 17,
            onTap: function () {
              E.sdk.showRewarded({
                onReward: function () { r.redealt = true; addCoins(25); E.audio.sfx('coin'); that._restart(); },
                onDone: function () {}
              });
            }
          }));
        }
        if (!r.win) {
          list.push(new E.ui.Button({
            x: cx - bw / 2, y: Math.min(y + (r.redealt ? bh + 10 : bh * 2 + 20), Lt.handY - bh - 8), w: bw, h: bh * 0.8,
            text: T('back'), bg: 'rgba(12,28,22,0.7)', border: 'rgba(247,241,227,0.2)', fg: 'rgba(247,241,227,0.7)',
            fontSize: 15,
            onTap: function () { E.audio.sfx('click'); that._leave(false); }
          }));
        }
        this.buttons = list;
        return;
      }

      var byRow = [];
      if (L.canPass(st, 0)) byRow.push({ text: T('bito'), act: function () { L.pass(st, 0); E.audio.sfx('click'); if (st.phase === 'over') that._finish(0); } });
      if (L.canTake(st, 0)) byRow.push({ text: T('take'), act: function () { L.take(st, 0); E.audio.sfx('hit'); } });
      if (hasCharges('swap') && !st.swapped && !byRow.length) byRow.push({ text: T('use_swap'), act: function () { that._swap(); } });
      if (hasCharges('peek') && st.peeks < 1 && !byRow.length) byRow.push({ text: T('use_peek'), act: function () { that._peek(); } });

      var totalW = byRow.length * bw + Math.max(0, byRow.length - 1) * 10;
      var x0 = cx - totalW / 2;
      for (var i = 0; i < byRow.length; i++) {
        (function (b, idx) {
          list.push(new E.ui.Button({
            x: x0 + idx * (bw + 10), y: by, w: bw, h: bh, text: b.text,
            bg: '#1d5138', border: P.gold, fg: P.gold, fontSize: 17,
            onTap: b.act
          }));
        })(byRow[i], i);
      }
      this.buttons = list;
    },

    /* --- перки --- */
    _swap: function () {
      var st = this.st;
      if (st.swapped || st.deck.length < 2) { this.toast = { t: 1.2, text: T('not_enough') }; E.audio.sfx('deny'); return; }
      if (!useCharge('swap')) { this.toast = { t: 1.4, text: T('not_enough') }; E.audio.sfx('deny'); return; }
      st.swapped = true;
      var take = Math.min(2, st.hands[0].length);
      for (var i = 0; i < take; i++) {
        var c = st.hands[0].shift();
        st.deck.unshift(c);              // в низ колоды
      }
      for (var k = 0; k < take && st.deck.length; k++) st.hands[0].push(st.deck.pop());
      L.sortHand(st.hands[0], st.trump);
      E.audio.sfx('buy');
      this.toast = { t: 1.4, text: T('swap_done') };
    },
    _peek: function () {
      var st = this.st;
      if (!useCharge('peek')) { this.toast = { t: 1.4, text: T('not_enough') }; E.audio.sfx('deny'); return; }
      st.peeks++;
      this.peekT = 3;
      this.toast = { t: 3, text: T('peek_on') };
      E.audio.sfx('pulse');
    },

    /* --- итог --- */
    _finish: function (side) {
      if (this.result) return;
      var st = this.st;
      var win = st.winner === 0 || st.winner === 2;
      var reward = 0;
      if (win) {
        reward = C.coins.win + C.coins.perRivalCard * st.hands[1].length;
        if (st.takenByPlayer === 0) reward += C.coins.dryBonus;
      } else {
        reward = C.coins.lose;
      }
      var staked = (E.storage.get('stake', 0) | 0) === 1;
      if (staked) {
        if (win) reward += C.stake.win;
        E.storage.set('stake', 0);
      }
      addCoins(reward);
      this.result = { win: win, coins: reward, doubled: false, redealt: false };
      this.matches++;
      E.storage.set('matches', this.matches);
      if (win) {
        var next = Math.max(E.storage.get('rival', 0) | 0, Math.min(C.rivals.length - 1, this.rival + 1));
        E.storage.set('rival', next);
        E.storage.set('best', Math.max(E.storage.get('best', 0) | 0, this.rival + 1));
        E.audio.sfx('win');
      } else {
        E.audio.sfx('over');
      }
      E.sdk.gameplayStop();
      this.buttons = [];
      if (E.capture.autoplay || E.capture.record > 0) this.autoRestart = 1.6;
    },
    _restart: function () {
      var g = this.game;
      g.setScene('play', { rival: this.rival, seed: (this.seed + 7919) % 1000000 });
    },
    _leave: function (won) {
      var every = C.ads.interstitialEvery;
      var needAd = won && this.matches % every === 0;
      var that = this;
      if (needAd) {
        E.sdk.showInterstitial(function () { that.game.setScene('menu', {}); });
        return;
      }
      this.game.setScene('menu', {});
    },

    /* --- отрисовка --- */
    draw: function (game, ctx) {
      var v = game.view, Lt = this.layout(v), st = this.st;
      G.art.table(ctx, v.w, v.h);

      // верх: монеты, соперник
      coinsBadge(ctx, Lt.pad, Lt.pad);
      var rv = rivalAt(this.rival);
      var av = Math.max(18, Math.min(Lt.cardW * 0.34, 26));
      var ay = Lt.pad + 42 + av;
      G.art.avatar(ctx, Lt.pad + av, ay, av, rv.color, rivalName(this.rival).charAt(0), { active: st.turn === 1 && st.phase !== 'over' });
      E.ui.text(ctx, rivalName(this.rival), Lt.pad + av * 2 + 10, ay - 8, Math.min(v.w * 0.042, 18), P.cream, 'left', 700);
      E.ui.text(ctx, T('cards_left', { n: st.hands[1].length }), Lt.pad + av * 2 + 10, ay + 12, Math.min(v.w * 0.032, 13), 'rgba(247,241,227,0.6)', 'left', 500);

      // рука соперника — рубашки веером
      var aiN = Math.max(0, Math.round(this.aiAnim));
      if (aiN) {
        var bw = Math.round(Lt.cardW * 0.62), bh = Math.round(Lt.cardH * 0.62);
        var step = Math.min(bw * 0.52, (v.w * 0.5) / Math.max(1, aiN));
        var x0 = v.w - Lt.pad - bw - step * (aiN - 1);
        var frac = this.aiAnim - Math.floor(this.aiAnim);
        for (var i = 0; i < aiN; i++) G.art.card(ctx, x0 + i * step, Lt.pad + 4 - (i === aiN - 1 ? frac * 10 : 0), bw, bh, null, { face: false });
        if (this.peekT > 0) {
          for (var j = 0; j < aiN; j++) {
            G.art.card(ctx, x0 + j * step, Lt.pad + 4, bw, bh, st.hands[1][j], {});
          }
        }
      }

      // колода и козырь
      var dx = v.w - Lt.pad - Lt.cardW, dy = Lt.tableTop + Lt.cardH * 0.2;
      if (st.deck.length) {
        G.art.card(ctx, dx + 4, dy + 4, Lt.cardW * 0.86, Lt.cardH * 0.86, null, { face: false, lift: 0 });
        G.art.card(ctx, dx, dy, Lt.cardW * 0.86, Lt.cardH * 0.86, null, { face: false });
        E.ui.text(ctx, String(st.deck.length), dx + Lt.cardW * 0.43, dy + Lt.cardH * 0.43, 20, P.gold, 'center', 800);
      } else {
        E.ui.text(ctx, T('deck'), dx + Lt.cardW * 0.43, dy + Lt.cardH * 0.43, 13, 'rgba(247,241,227,0.4)', 'center', 600);
      }
      // козырная карта (видна всегда)
      var tcw = Lt.cardW * 0.62, tch = Lt.cardH * 0.62;
      G.art.card(ctx, dx + Lt.cardW * 0.14, dy + Lt.cardH * 0.78, tcw, tch, st.trumpCard, { trump: true });
      E.ui.text(ctx, T('trump'), dx + Lt.cardW * 0.45, dy + Lt.cardH * 1.5, 11, 'rgba(242,193,78,0.8)', 'center', 600);

      // стол
      var n = st.table.length;
      var pairW = Lt.cardW, pairH = Lt.cardH * 1.62;
      var avail = Lt.W - Lt.pad * 2 - (Lt.portrait ? 0 : Lt.cardW * 1.1);
      var step2 = n > 1 ? Math.min(pairW * 1.02, (avail - pairW) / (n - 1)) : 0;
      var tw = pairW + step2 * Math.max(0, n - 1);
      var tx0 = (Lt.W - tw) / 2 - (Lt.portrait ? 0 : Lt.cardW * 0.35);
      var ty = (Lt.tableTop + Lt.tableBottom) / 2 - pairH / 2;
      for (var k = 0; k < n; k++) {
        var px = tx0 + k * step2;
        var bAge = this.birth[k] != null ? this.t - this.birth[k] : 0.3;
        var bk = easeOut(Math.min(1, bAge / 0.17));
        var sc = 0.86 + 0.14 * bk, dw = Lt.cardW * (1 - sc), dh = Lt.cardH * (1 - sc);
        G.art.card(ctx, px + dw / 2, ty + dh / 2, Lt.cardW * sc, Lt.cardH * sc, st.table[k].a, {});
        if (st.table[k].d) G.art.card(ctx, px, ty + Lt.cardH * 0.62, Lt.cardW, Lt.cardH, st.table[k].d, {});
        else {
          ctx.save();
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = 'rgba(242,193,78,0.5)';
          ctx.lineWidth = 2;
          E.ui.roundRect(ctx, px, ty + Lt.cardH * 0.62, Lt.cardW, Lt.cardH, 8);
          ctx.stroke();
          ctx.restore();
        }
      }

      // рука игрока
      var slots = this.handSlots(Lt, st.hands[0].length);
      var hint = hasPerk('hint') ? L.hintCards(st) : [];
      var shake = this.shakeT > 0 ? Math.sin(this.shakeT * 46) * 7 * (this.shakeT / 0.28) : 0;
      for (var q = 0; q < slots.length; q++) {
        var s = slots[q], card = st.hands[0][q];
        var isHint = false;
        for (var h = 0; h < hint.length; h++) if (L.same(hint[h], card)) isHint = true;
        var dk = easeOut(Math.min(1, this.dealT * 1.35 - q * 0.06));
        var dy = (1 - dk) * (Lt.cardH * 0.9);
        G.art.card(ctx, s.x + shake, s.y + dy, s.w, s.h, card, { hi: isHint, lift: isHint ? 6 : 0 });
      }

      if (this.denyT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.denyT * 3.2);
        ctx.lineWidth = 3; ctx.strokeStyle = '#e05a4f';
        E.ui.roundRect(ctx, Lt.pad, Lt.handY - 14, Lt.W - Lt.pad * 2, Lt.cardH + 26, 14);
        ctx.stroke(); ctx.restore();
      }
      // подпись хода (canTake надёжнее, чем phase: в capture фаза может быть сдвинута)
      var cap = T('your_turn');
      if (L.canTake(st, 0) || (st.phase === 'defend' && st.turn === 0)) cap = T('defend');
      if (st.turn === 1) cap = T('rival_turn', { name: rivalName(this.rival) });
      if (st.phase !== 'over') E.ui.text(ctx, cap, Lt.W / 2, Lt.tableTop - 6, Math.min(v.w * 0.038, 15), 'rgba(247,241,227,0.75)', 'center', 600);

      for (var gj = 0; gj < this.ghosts.length; gj++) {
        var gh = this.ghosts[gj], k = Math.min(1, gh.t / gh.dur), e = easeOut(k);
        var gx = gh.x0 + (gh.x1 - gh.x0) * e, gy = gh.y0 + (gh.y1 - gh.y0) * e - Math.sin(e * Math.PI) * 26;
        ctx.globalAlpha = 1 - k * 0.2;
        G.art.card(ctx, gx, gy, gh.w, gh.h, gh.card, {});
        ctx.globalAlpha = 1;
      }
      if (st.phase === 'over' && this.result) this._drawResult(ctx, v, Lt);

      E.ui.drawButtons(ctx, this.buttons);

      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t);
        pill(ctx, v.w / 2 - 120, Lt.btnY - 52, 240, 36, 'rgba(10,26,20,0.9)', 'rgba(242,193,78,0.4)');
        E.ui.text(ctx, this.toast.text, v.w / 2, Lt.btnY - 34, 14, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },

    _resLay: function (Lt) {
      var cy = Lt.H * 0.30, gap = Lt.H < 560 ? 26 : 34;
      return { cy: cy, sub: cy + gap, taunt: cy + gap * 1.8, pill: cy + gap * 2.6, btn: cy + gap * 3.7 };
    },
    _drawResult: function (ctx, v, Lt) {
      var r = this.result;
      var sa = 0.72 * easeInOut(this.scrimT);
      ctx.fillStyle = 'rgba(6,14,11,' + sa.toFixed(3) + ')';
      ctx.fillRect(0, 0, v.w, v.h);
      var RL = this._resLay(Lt), cy = RL.cy;
      E.ui.text(ctx, r.win ? T('win_title') : T('lose_title'), v.w / 2, cy, Math.min(v.w * 0.11, 52), r.win ? P.gold : '#e07070', 'center', 800);
      var sub = r.win ? T('win_sub', { name: rivalName(this.rival) }) : T('lose_sub', { name: rivalName(this.rival) });
      E.ui.text(ctx, sub, v.w / 2, RL.sub, Math.min(v.w * 0.04, 17), 'rgba(247,241,227,0.8)', 'center', 500);
      if (!(this.rival === C.rivals.length - 1 && r.win)) {
        E.ui.text(ctx, T(RIVAL_TAUNT[rivalAt(this.rival).key] || 'rival'), v.w / 2, RL.taunt, Math.max(13, Math.min(v.w * 0.032, 15)), 'rgba(242,193,78,0.85)', 'center', 500);
      }
      if (this.rival === C.rivals.length - 1 && r.win) {
        E.ui.text(ctx, T('final_sub'), v.w / 2, RL.taunt, Math.min(v.w * 0.036, 14), P.gold, 'center', 600);
      }
      var cw = 150;
      pill(ctx, v.w / 2 - cw / 2, RL.pill, cw, 40, 'rgba(8,20,15,0.7)', 'rgba(242,193,78,0.35)');
      G.art.coin(ctx, v.w / 2 - cw / 2 + 22, RL.pill + 20, 11);
      E.ui.text(ctx, T('won_coins', { n: (r.doubled ? r.coins * 2 : r.coins) }), v.w / 2 + 8, RL.pill + 20, 17, P.gold, 'center', 700);
      if (r.win && this.resT < 0.9) {
        var pr = 40 + this.resT * 900, pa = Math.max(0, 1 - this.resT / 0.9);
        ctx.save(); ctx.globalAlpha = pa * 0.6; ctx.lineWidth = 6; ctx.strokeStyle = P.gold;
        ctx.beginPath(); ctx.arc(v.w / 2, cy, pr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    },

    /* --- capture --- */
    setCaptureState: function (game, s) {
      s = s || {};
      var st = this.st;
      if (s.wave != null) this.rival = Math.max(0, Math.min(C.rivals.length - 1, s.wave | 0));
      // красивая детерминированная доска для скриншота
      var mk = function (su, r) { return { s: su, r: r }; };
      // третья атака намеренно не отбита: на кадре видно решение «отбей или возьми»
      var table = [
        { a: mk('h', 8), d: mk('h', 11) },
        { a: mk('d', 8), d: mk('d', 9) },
        { a: mk('c', 8), d: null }
      ];
      var used = {};
      table.forEach(function (p) { used[p.a.s + p.a.r] = 1; if (p.d) used[p.d.s + p.d.r] = 1; });
      st.table = table;
      var clean = function (hand) {
        return hand.filter(function (c) { return !used[c.s + c.r]; });
      };
      st.hands[0] = clean(st.hands[0]).slice(0, 5);
      st.hands[1] = clean(st.hands[1]).slice(0, 4);
      while (st.hands[0].length < 5 && st.deck.length) st.hands[0].push(st.deck.pop());
      while (st.hands[1].length < 4 && st.deck.length) st.hands[1].push(st.deck.pop());
      st.phase = 'defend';
      st.turn = 0;
      st.attacker = 1;
      L.sortHand(st.hands[0], st.trump);
      if (s.mode === 'win') {
        st.phase = 'over'; st.winner = 0; st.takenByPlayer = 0;
        this.result = { win: true, coins: C.coins.win + 12, doubled: false, redealt: false };
      } else if (s.mode === 'over') {
        st.phase = 'over'; st.winner = 1;
        this.result = { win: false, coins: C.coins.lose, doubled: false, redealt: false };
      }
      // в capture update не тикает, поэтому кнопки собираем здесь — иначе на кадре
      // «победа/поражение» не видно, чем продолжать
      this._syncButtons(game, 0);
    },
    getCaptureState: function () {
      var st = this.st;
      var mode = st.phase === 'over' ? (this.result && this.result.win ? 'win' : 'over') : 'running';
      return { scene: 'play', mode: mode, rival: this.rival, cards: st.hands[0].length };
    }
  };

  G.scenes = S;
})(window.GAME);
