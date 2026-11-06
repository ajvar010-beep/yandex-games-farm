/* game/scenes.js — меню и игровая сцена «Побег Стрелок».
   Вся логика поля — в game/logic.js; здесь только состояние сессии, ввод, анимации,
   экономика, монетизация и отрисовка. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function T(k, v) { return E.i18n.t(k, v); }
  var hapticArmed = false;
  try { window.addEventListener('pointerdown', function () { hapticArmed = true; }, { once: true }); } catch (e) {}
  function buzz(ms) {
    // Chrome логирует console.error, если vibrate вызван без пользовательского жеста
    // (autopilot/capture). Поэтому вибрируем только после первого реального тапа.
    if (!hapticArmed) return;
    try { if (navigator.vibrate && !E.audio.isMuted()) navigator.vibrate(ms); } catch (e) {}
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  /* ---------------- мета: сохранения, монеты, покупки ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = G.config.economy.startCoins; E.storage.set('coins', c); }
      return c;
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    level: function () { return Math.min(30, Math.max(1, E.storage.get('level', 1) | 0)); },
    saveLevel: function (lvl) {
      // перепрохождение старого уровня не должно откатывать «Продолжить»
      var cur = E.storage.get('level', 1) | 0;
      E.storage.set('level', Math.min(30, Math.max(cur, lvl)));
      E.storage.set('best', Math.max(E.storage.get('best', 0), lvl - 1));
    },
    best: function () { return E.storage.get('best', 0) | 0; },
    stars: function () {
      var s = E.storage.get('stars', {});
      return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
    },
    starFor: function (lvl, n) {
      var s = Meta.stars();
      try {
        if ((s[lvl] | 0) < n) { s[lvl] = n; E.storage.set('stars', s); }
      } catch (e) {}
    },
    inv: function (id) { return E.storage.get('b_' + id, 0) | 0; },
    addInv: function (id, n) { E.storage.set('b_' + id, Math.max(0, Meta.inv(id) + n)); },
    bought: function (id) { return E.storage.get('bb_' + id, 0) | 0; },
    incBought: function (id) { E.storage.set('bb_' + id, Meta.bought(id) + 1); },
    boosterCost: function (id) {
      var b = null, list = G.config.boosters;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) b = list[i];
      return b ? G.config.boosterCost(b, Meta.bought(id)) : 999;
    },
    dailyDone: function () { return E.storage.get('daily_last', '') === todayStr(); },
    markDaily: function () { E.storage.set('daily_last', todayStr()); },
    submit: function (lvl) {
      E.sdk.submitScore('parking_depth', Math.max(lvl, Meta.best(), Meta.level() - 1));
    },
    iapBuy: function (pid, onOk, onFail) {
      if (pid === 'no_ads') {
        E.sdk.purchase('no_ads', function () {
          E.storage.set('no_ads', true); E.sdk.hideBanner(); if (onOk) onOk();
        }, function (err) { if (onFail) onFail(err); });
      }
    }
  };

  /* ---------------- фон ---------------- */
  function makeBlobs(n, seed) {
    var rng = new E.Rng(seed), out = [];
    for (var i = 0; i < n; i++) {
      out.push({
        x: rng.float(), y: rng.float(), s: 0.5 + rng.float(), sp: 0.01 + rng.float() * 0.02,
        color: rng.int(0, G.config.palette.tileColors.length - 1), dir: rng.int(0, 3),
        a: 0.04 + rng.float() * 0.05
      });
    }
    return out;
  }
  function drawBackground(game, ctx, blobs, t, level) {
    var v = game.view, P = G.config.palette;
    var th = G.config.themeFor(level || 1);
    var g = ctx.createLinearGradient(0, 0, 0, v.h);
    g.addColorStop(0, th.bg2); g.addColorStop(1, th.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);
    // мягкое световое пятно (цвет темы)
    var rg = ctx.createRadialGradient(v.w * 0.5, v.h * 0.08, 10, v.w * 0.5, v.h * 0.08, v.h * 0.7);
    rg.addColorStop(0, th.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, v.w, v.h);
    if (!blobs) return;
    // мягкие световые диски, а не крупные плитки: фон не конкурирует с полем
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var x = ((b.x + t * b.sp) % 1.2 - 0.1) * v.w;
      var y = ((b.y + t * b.sp * 0.6) % 1.2 - 0.1) * v.h;
      var size = Math.min(v.w, v.h) * 0.13 * b.s;
      var col = P.tileColors[b.color % P.tileColors.length];
      var rg2 = ctx.createRadialGradient(x, y, 0, x, y, size);
      rg2.addColorStop(0, col); rg2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalAlpha = b.a * 1.8; ctx.fillStyle = rg2;
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  /* =========================================================== MENU */
  var MenuScene = {
    consumesInputInUpdate: true,
    enter: function (game) {
      if (!E.storage.get('no_ads', false)) E.sdk.showBanner(); else E.sdk.hideBanner();
      E.fx.reset(); G.art.init();
      // платежи сначала инициализируем, и только потом читаем покупки (иначе race → [])
      E.sdk.initPayments().then(function () {
        E.sdk.getPurchases(function (list) {
          for (var pi = 0; pi < (list || []).length; pi++) {
            if (list[pi] && list[pi].productId === 'no_ads') E.storage.set('no_ads', true);
          }
        });
      });
      this.blobs = makeBlobs(7, 20261106);
      this.coins = Meta.coins(); this.level = Meta.level(); this.best = Meta.best();
      this.panel = null; this.lbData = null; this.lbLoading = false;
      this.layout(game);
      E.audio.music('menu');
    },
    exit: function () { E.sdk.hideBanner(); },

    layout: function (game) {
      var v = game.view, self = this;
      var inset = E.sdk.bannerInsetPx(), availH = v.h - inset;
      var cx = v.w / 2;
      var bw = Math.min(340, v.w * 0.80);
      var bh = Math.max(48, Math.min(62, availH * 0.082));
      var y0 = availH * 0.40;
      this.buttons = [];

      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh * 1.18, fontSize: Math.round(bh * 0.38),
        text: this.level > 1 ? T('play_continue') : T('play'),
        bg: '#2f9e7a', border: '#5fe08a', fg: '#ffffff',
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: Meta.level() }); }
      }));
      var y1 = y0 + bh * 1.18 + 14;
      var half = (bw - 12) / 2;
      this.dailyRect = { x: cx - bw / 2, y: y1, w: half, h: bh };
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y1, w: half, h: bh, fontSize: Math.round(bh * 0.30),
        text: T('daily_short'), bg: '#1c3150', border: '#5aa9ff',
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { daily: true }); }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + half + 12, y: y1, w: half, h: bh, fontSize: Math.round(bh * 0.30),
        text: T('shop'), bg: '#1c3150', border: '#c77dff',
        onTap: function () { E.audio.sfx('click'); self.openShop(game); }
      }));
      var y2 = y1 + bh + 12;
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: y2, w: half, h: bh, fontSize: Math.round(bh * 0.30),
        text: T('levels'), bg: '#1c3150', border: '#4dd4ac',
        onTap: function () { E.audio.sfx('click'); self.openLevels(game); }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + half + 12, y: y2, w: half, h: bh, fontSize: Math.round(bh * 0.30),
        text: T('leaders'), bg: '#1c3150', border: '#ffd166',
        onTap: function () { E.audio.sfx('click'); self.openLeaders(game); }
      }));

      // нижний ряд: язык / звук
      var sh = 42, sy = availH - sh - 12;
      var sw = Math.min(120, (v.w - 40) / 3);
      this.buttons.push(new E.ui.Button({
        x: 12, y: sy, w: sw, h: sh, fontSize: 14, text: T('lang'),
        bg: 'rgba(14,24,44,0.8)', border: '#3d5a8a',
        onTap: function () {
          E.audio.sfx('click');
          var nl = E.i18n.lang === 'ru' ? 'en' : 'ru';
          E.i18n.setLang(nl); E.storage.set('lang', nl); document.title = T('title');
          MenuScene.layout(game);
        }
      }));
      this.buttons.push(new E.ui.Button({
        x: 12 + sw + 8, y: sy, w: sw, h: sh, fontSize: 14,
        text: E.storage.authorized ? T('login_done') : T('login'),
        enabled: !E.storage.authorized,
        bg: 'rgba(14,24,44,0.8)', border: '#4dd4ac',
        onTap: function () {
          E.audio.sfx('click');
          E.storage.authorize().then(function (ok) { if (ok) MenuScene.layout(E.sdk._game); });
        }
      }));
      var muted = E.audio.isMuted();
      this.buttons.push(new E.ui.Button({
        x: v.w - sw - 12, y: sy, w: sw, h: sh, fontSize: 14,
        text: muted ? T('sound_off') : T('sound_on'),
        bg: 'rgba(14,24,44,0.8)', border: '#3d5a8a',
        onTap: function (b) {
          var m = !E.audio.isMuted();
          E.audio.setMuted(m); E.storage.set('muted', m);
          b.text = m ? T('sound_off') : T('sound_on');
          E.audio.sfx('click');
        }
      }));

      this.panelButtons = [];
      if (this.panel === 'shop') this.buildShopButtons(game);
      else if (this.panel === 'leaders') this.buildLeaderButtons(game);
      else if (this.panel === 'levels') this.buildLevelButtons(game);
    },
    onResize: function (game) { this.layout(game); },

    openShop: function (game) { this.panel = 'shop'; this.layout(game); },
    openLevels: function (game) { this.panel = 'levels'; this.layout(game); },
    openLeaders: function (game) {
      var self = this;
      this.panel = 'leaders'; this.lbLoading = true; this.lbData = null; this.layout(game);
      E.sdk.getLeaderboard('parking_depth', function (r) {
        self.lbData = r; self.lbLoading = false;
        if (self.panel === 'leaders') self.layout(E.sdk._game);
      });
    },
    closePanel: function (game) { this.panel = null; this.layout(game); },

    buildShopButtons: function (game) {
      var v = game.view, self = this, cx = v.w / 2;
      var pw = Math.min(380, v.w * 0.92);
      var ph = Math.min(430, Math.max(300, v.h * 0.72));
      var px = cx - pw / 2, py = Math.max(8, (v.h - ph) / 2);
      var bw = pw - 32;
      var bh = Math.max(36, Math.min(46, (ph - 150) / 5));
      var y = py + 76;
      this.panelRect = { x: px, y: py, w: pw, h: ph };
      this.panelButtons = [];
      for (var i = 0; i < G.config.boosters.length; i++) {
        (function (b) {
          var cost = Meta.boosterCost(b.id);
          self.panelButtons.push(new E.ui.Button({
            x: px + 16, y: y, w: bw, h: bh, fontSize: Math.max(12, bh * 0.34),
            text: T('boost_' + b.id) + '  ×' + Meta.inv(b.id) + '   —   ' + cost + ' ◉',
            bg: '#1a2a46', border: '#3d5a8a',
            onTap: function () {
              if (self.coins >= cost) {
                self.coins -= cost; Meta.setCoins(self.coins);
                Meta.addInv(b.id, 1); Meta.incBought(b.id);
                E.audio.sfx('buy'); self.layout(game);
              } else { E.audio.sfx('deny'); self.flash = { text: T('no_coins'), t: 1.4 }; }
            }
          }));
          y += bh + 6;
        })(G.config.boosters[i]);
      }
      var hw = (bw - 8) / 2;
      this.panelButtons.push(new E.ui.Button({
        x: px + 16, y: y + 2, w: hw, h: bh, fontSize: Math.max(12, bh * 0.30),
        text: T('shop_rv', { n: G.config.economy.rvCoins }),
        bg: '#4b2f8a', border: '#b197fc',
        onTap: function () {
          E.sdk.showRewarded({
            onReward: function () {
              self.coins += G.config.economy.rvCoins; Meta.setCoins(self.coins);
              E.audio.sfx('coin'); self.layout(game);
            },
            onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.flash = { text: T('ad_fail'), t: 1.6 }; } }
          });
        }
      }));
      var noAds = E.storage.get('no_ads', false);
      this.panelButtons.push(new E.ui.Button({
        x: px + 16 + hw + 8, y: y + 2, w: hw, h: bh, fontSize: Math.max(12, bh * 0.30),
        text: noAds ? T('shop_noads_owned') : T('shop_noads'),
        enabled: !noAds,
        bg: noAds ? '#2f9e7a' : '#3a2a58', border: noAds ? '#5fe08a' : '#9d6bff',
        onTap: function () {
          E.audio.sfx('click');
          Meta.iapBuy('no_ads', function () { self.layout(game); }, function () { E.audio.sfx('deny'); self.flash = { text: T('iap_fail'), t: 1.6 }; });
        }
      }));
      this.panelButtons.push(new E.ui.Button({
        x: px + 16, y: y + bh + 10, w: bw, h: bh, fontSize: Math.max(13, bh * 0.36),
        text: T('shop_close'), bg: '#2f9e7a', border: '#5fe08a',
        onTap: function () { E.audio.sfx('click'); self.closePanel(game); }
      }));
    },
    buildLevelButtons: function (game) {
      var v = game.view, self = this, cx = v.w / 2;
      var pw = Math.min(440, v.w * 0.92), ph = Math.min(520, v.h * 0.84);
      var px = cx - pw / 2, py = Math.max(8, (v.h - ph) / 2);
      this.panelRect = { x: px, y: py, w: pw, h: ph };
      this.panelButtons = [];
      this.levelRects = [];
      var cols = v.w < 380 ? 5 : 6, rows = Math.ceil(30 / cols), gx = 8, gy = 8;
      var top = py + 64, bw = (pw - 24 - gx * (cols - 1)) / cols, bh = Math.min(58, (ph - 130) / rows - gy);
      var stars = Meta.stars(), unlocked = Meta.level();
      for (var i = 0; i < 30; i++) {
        (function (lvl) {
          var c = lvl % cols, r = (lvl / cols) | 0;
          var x = px + 12 + c * (bw + gx), y = top + r * (bh + gy);
          self.levelRects.push({ x: x, y: y, w: bw, h: bh, lvl: lvl + 1 });
          self.panelButtons.push(new E.ui.Button({
            x: x, y: y, w: bw, h: bh, fontSize: Math.max(12, Math.min(18, bh * 0.38)),
            text: String(lvl + 1),
            enabled: (lvl + 1) <= unlocked,
            bg: (lvl + 1) <= unlocked ? '#1a2a46' : '#141c2e',
            border: stars[lvl + 1] ? '#ffd166' : '#3d5a8a',
            onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: lvl + 1 }); }
          }));
        })(i);
      }
      this.panelButtons.push(new E.ui.Button({
        x: cx - 80, y: py + ph - 54, w: 160, h: 44, fontSize: 16,
        text: T('shop_close'), bg: '#2f9e7a', border: '#5fe08a',
        onTap: function () { E.audio.sfx('click'); self.closePanel(game); }
      }));
    },
    buildLeaderButtons: function (game) {
      var v = game.view, cx = v.w / 2;
      var pw = Math.min(420, v.w * 0.9), ph = Math.min(460, v.h * 0.68);
      this.panelRect = { x: cx - pw / 2, y: (v.h - ph) / 2, w: pw, h: ph };
      this.panelButtons = [new E.ui.Button({
        x: cx - 80, y: this.panelRect.y + ph - 60, w: 160, h: 46, fontSize: 16,
        text: T('lb_close'), bg: '#2f9e7a', border: '#5fe08a',
        onTap: function () { E.audio.sfx('click'); MenuScene.closePanel(game); }
      })];
    },

    update: function (game, dt) {
      if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
      if (!E.input.pointer.pressed) return;
      var x = E.input.pointer.x, y = E.input.pointer.y;
      if (this.panel) {
        if (E.ui.handleTap(this.panelButtons, x, y)) return;
        var r = this.panelRect;
        if (!r || x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) this.closePanel(game);
        return;
      }
      E.ui.handleTap(this.buttons, x, y);
    },

    draw: function (game, ctx) {
      var v = game.view, P = G.config.palette;
      drawBackground(game, ctx, this.blobs, game.time);

      // заголовок
      var ts = Math.min(v.w * 0.13, v.h * 0.085, 64);
      var ty = v.h * 0.20;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + ts + 'px system-ui, sans-serif';
      var tg = ctx.createLinearGradient(0, ty - ts / 2, 0, ty + ts / 2);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#8ff0d2');
      ctx.lineWidth = Math.max(4, ts * 0.12); ctx.strokeStyle = 'rgba(8,16,32,0.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(T('title'), v.w / 2, ty);
      ctx.fillStyle = tg; ctx.fillText(T('title'), v.w / 2, ty);
      E.ui.text(ctx, T('subtitle'), v.w / 2, ty + ts * 0.82, Math.max(13, Math.min(17, v.w * 0.035)), P.dim, 'center', 600);

      // монеты + прогресс
      var cy = Math.max(28, v.h * 0.055);
      ctx.beginPath(); ctx.arc(v.w - 92, cy, 13, 0, Math.PI * 2); ctx.fillStyle = P.coin; ctx.fill();
      ctx.strokeStyle = '#c99a2e'; ctx.lineWidth = 2; ctx.stroke();
      E.ui.text(ctx, String(this.coins), v.w - 72, cy + 1, 18, P.coin, 'left', 800);
      E.ui.text(ctx, T('hud_best', { n: this.best }), 14, cy, 15, P.dim, 'left', 600);
      var stAll = Meta.stars(), stSum = 0;
      for (var skk in stAll) if (Object.prototype.hasOwnProperty.call(stAll, skk)) stSum += stAll[skk] | 0;
      E.ui.text(ctx, '★ ' + stSum + '/90', 14, cy + 20, 14, P.coin, 'left', 700);

      // ежедневный бейдж — галочка внутри кнопки «Ежедневный вызов»
      if (Meta.dailyDone() && this.dailyRect) {
        var dr = this.dailyRect;
        E.ui.text(ctx, '✓', dr.x + dr.w - 16, dr.y + dr.h / 2, 16, '#5fe08a', 'center', 800);
      }

      E.ui.drawButtons(ctx, this.buttons);
      if (this.panel) this.drawPanel(game, ctx);
      if (this.flash) {
        E.ui.text(ctx, this.flash.text, v.w / 2, v.h * 0.74, 17, P.bad, 'center', 700);
      }
    },
    drawPanel: function (game, ctx) {
      var v = game.view, P = G.config.palette, r = this.panelRect;
      ctx.fillStyle = 'rgba(6,12,24,0.66)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.roundRect(ctx, r.x, r.y, r.w, r.h, 20);
      ctx.fillStyle = P.panel; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = P.panelBorder; ctx.stroke();
      var title = this.panel === 'shop' ? T('shop_title') : (this.panel === 'levels' ? T('levels_title') : T('lb_title'));
      E.ui.text(ctx, title, v.w / 2, r.y + 28, 22, P.text, 'center', 800);
      if (this.panel === 'shop') {
        E.ui.text(ctx, T('shop_coins', { n: this.coins }), v.w / 2, r.y + 54, 14, P.dim, 'center', 600);
      } else if (this.panel === 'levels') {
        var st = Meta.stars(), tot = 0;
        for (var sk in st) if (Object.prototype.hasOwnProperty.call(st, sk)) tot += st[sk] | 0;
        E.ui.text(ctx, T('stars_total', { n: tot, m: 90 }), v.w / 2, r.y + 54, 14, P.dim, 'center', 600);
      } else {
        if (this.lbLoading) E.ui.text(ctx, '…', v.w / 2, r.y + r.h / 2, 22, P.dim, 'center', 700);
        else {
          var rows = (this.lbData && (this.lbData.entries || this.lbData.users)) || [];
          if (!rows.length) E.ui.text(ctx, T('lb_empty'), v.w / 2, r.y + 100, 15, P.dim, 'center', 600);
          else {
            rows = rows.slice(0, Math.max(4, Math.floor((r.h - 120) / 28)));
            for (var i = 0; i < rows.length; i++) {
              var e = rows[i];
              var nm = (e.player && e.player.publicName) ? e.player.publicName : '—';
              E.ui.text(ctx, (i + 1) + '. ' + nm + ' — ' + (e.formattedScore || e.score), v.w / 2, r.y + 92 + i * 28, 16, P.text, 'center', 600);
            }
          }
        }
      }
      E.ui.drawButtons(ctx, this.panelButtons);
      if (this.panel === 'levels' && this.levelRects) {
        var starsM = Meta.stars();
        for (var li = 0; li < this.levelRects.length; li++) {
          var lr = this.levelRects[li], ns = starsM[lr.lvl] | 0;
          if (!ns) continue;
          E.ui.text(ctx, '★'.repeat(ns), lr.x + lr.w / 2, lr.y + lr.h - 8, Math.max(10, lr.h * 0.18), '#ffd166', 'center', 800);
        }
      }
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* =========================================================== PLAY */
  var PlayScene = {
    consumesInputInUpdate: true,
    enter: function (game, params) {
      E.sdk.hideBanner(); E.fx.reset(); G.art.init();
      var seed = (params.seed != null) ? params.seed : (E.capture.seed != null) ? E.capture.seed : null;
      this.daily = !!params.daily;
      // кампания детерминирована: «уровень N» — одна и та же головоломка при ретрае,
      // поэтому звёзды и «лучший ход» воспроизводимы. Дейли — по дате.
      if (seed == null) seed = this.daily ? ('daily-' + todayStr()) : ('level-' + (params.level || 1));
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      this.level = params.level || (this.daily ? (8 + (new Date().getDate() % 8)) : Meta.level());
      this.rng = new E.Rng(this.seedNum ^ Math.imul(this.level + 1, 2654435761));
      this.visRng = new E.Rng(this.seedNum ^ 0x9e3779b9);
      this.blobs = makeBlobs(6, 777);
      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.mode = 'running';
      this.reviveUsed = false;
      this.ghosts = []; this.floaters = [];
      this.shakeCell = null; this.hintCell = null; this.hintT = 0; this.tutT = 0;
      this.bombMode = false; this.tapLock = 0; this.autoT = 0.35; this.endT = 0;
      this.coins = Meta.coins();
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot || E.capture.active) ? 0 : 1;
      this.buildLevel();
      this.layout(game);
      this.buildButtons(game);
      E.audio.music('parking'); E.sdk.gameplayStart();
      if (!E.sdk._lastInterstitial) E.sdk._lastInterstitial = Date.now();
      this.applyCaptureParams(game);
      E.storage.set('tutorialSeen', true);
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) { this.layout(game); this.buildButtons(game); this.rebuildOverlay(game); },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    buildLevel: function () {
      var gen = G.logic.generate(this.level, this.rng);
      this.grid = gen.grid; this.cols = gen.cols; this.rows = gen.rows;
      this.optimal = gen.optimal; this.total = gen.arrows;
      this.crateTotal = gen.crates || 0; this.frozenTotal = gen.frozen || 0;
      this.cleared = 0;
      this.tapLimit = gen.tapLimit;
      if (this.daily) this.tapLimit = Math.max(4, this.optimal + 2);
      this.tapsLeft = this.tapLimit; this.tapsUsed = 0; this.score = 0;
      this.bombMode = false; this.hintCell = null; this.hintT = 0;
      this.comboN = 0; this.comboT = 0;
      this.mechHint = this.level === 5 ? 'crate' : this.level === 8 ? 'bomb' : this.level === 10 ? 'ice' : null;
      this.introT = (!this.autopilot && !E.capture.active && !this.daily) ? 1.8 : 0;
    },

    layout: function (game) {
      var v = game.view;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      this.hudH = Math.max(50, availH * 0.085);
      this.barH = Math.max(68, availH * 0.105);
      var top = this.hudH + 8, bottom = availH - this.barH - 8;
      var areaH = Math.max(80, bottom - top), areaW = v.w * 0.94;
      // широкий ландшафт: слева информационная панель, поле остаётся по центру
      this.wide = (v.w >= 980 && availH >= 560 && v.w > v.h * 1.35);
      var cell = Math.min(areaW / this.cols, areaH / this.rows);
      this.cell = cell;
      this.boardW = cell * this.cols; this.boardH = cell * this.rows;
      this.bx = (v.w - this.boardW) / 2;
      this.by = top + (areaH - this.boardH) / 2;
      this.panelX = 14;
      this.panelW = Math.max(170, Math.min(230, this.bx - 34));
      this.availH = availH;
      if (this.mode === 'paused') this.buildPauseButtons(game);
      if (this.mode === 'win' || this.mode === 'over') this.buildEndButtons(game);
    },

    cellX: function (c) { return this.bx + this.cell * (c + 0.5); },
    cellY: function (r) { return this.by + this.cell * (r + 0.5); },

    buildButtons: function (game) {
      var v = game.view, self = this;
      var s = Math.max(40, Math.min(46, v.w * 0.11));
      this.pauseBtn = new E.ui.Button({
        x: v.w - s - 8, y: 8, w: s, h: s, fontSize: 20, text: 'II', id: 'pause',
        onTap: function () { E.audio.sfx('click'); self.setPaused(true); }
      });
      this.buttons = [this.pauseBtn];
      this.boosterButtons = [];
      var gap = 8, bw = (v.w - 16 - gap * 2) / 3;
      var bh = Math.max(40, this.barH - 16), by = this.availH - this.barH + 8;
      for (var i = 0; i < G.config.boosters.length; i++) {
        (function (b) {
          var btn = new E.ui.Button({
            x: 8 + i * (bw + gap), y: by, w: bw, h: bh, fontSize: Math.max(12, Math.min(15, v.w * 0.034)),
            text: '', bg: '#1a2a46', border: '#3d5a8a', id: 'boost_' + b.id,
            onTap: function () { E.audio.sfx('click'); self.useBooster(b.id, game); }
          });
          self.boosterButtons.push(btn);
          self.buttons.push(btn);
        })(G.config.boosters[i]);
      }
      this.refreshBoosterLabels();
    },
    refreshBoosterLabels: function () {
      if (!this.boosterButtons) return;
      for (var i = 0; i < this.boosterButtons.length; i++) {
        var b = G.config.boosters[i];
        var inv = Meta.inv(b.id);
        this.boosterButtons[i].text = T('boost_' + b.id) + (inv > 0 ? ' ×' + inv : '  ' + Meta.boosterCost(b.id) + '◉');
        this.boosterButtons[i].border = inv > 0 ? '#5fe08a' : '#3d5a8a';
      }
    },
    rebuildOverlay: function (game) {
      if (this.mode === 'paused') this.buildPauseButtons(game);
      else if (this.mode === 'win' || this.mode === 'over') this.buildEndButtons(game);
    },

    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave && !PlayScene._waveApplied) {
        PlayScene._waveApplied = true;
        this.level = clamp(parseInt(P.wave, 10) || 1, 1, 60);
        this.rng = new E.Rng((this.seedNum ^ Math.imul(this.level + 1, 2654435761)) >>> 0);
        this.buildLevel(); this.layout(game); this.buildButtons(game); this.refreshBoosterLabels();
      }
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0));
      if (P.mode === 'over') {
        if (tsec > 0) this.simulate(game, tsec);
        this.tapsLeft = 0; this.gameOver(game, true);
      } else if (P.mode === 'win') {
        if (tsec > 0) this.simulate(game, tsec);
        if (this.mode === 'running') this.win(game, true);
        else this.buildEndButtons(game);
      } else if (tsec > 0) {
        this.simulate(game, tsec);
      }
      if (P.coins) this.coins = Math.max(0, parseInt(P.coins, 10) || 0);
      if (P.freeze === '1') { game.pause('capture'); game.render(); }
    },
    simulate: function (game, tsec) {
      var keep = this.autopilot;
      this.autopilot = true;
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.update(game, dt);
        if (E.fx) E.fx.update(dt);
        game.time += dt;
      }
      this.autopilot = keep;
    },
    setCaptureState: function (game, s) {
      if (s.wave) { this.level = clamp(s.wave, 1, 60); this.buildLevel(); this.layout(game); this.buildButtons(game); }
      if (s.coins != null) this.coins = s.coins;
      if (s.mode === 'over') this.gameOver(game, true);
      if (s.mode === 'win') this.win(game, true);
    },
    getCaptureState: function () {
      return {
        scene: 'play', mode: this.mode, level: this.level, taps: this.tapsLeft,
        arrows: G.logic.countArrows(this.grid), score: this.score
      };
    },

    /* ---------- бустеры ---------- */
    useBooster: function (id, game) {
      if (this.mode !== 'running' || this.tapLock > 0) return;
      var hintBest = null;
      if (id === 'hint') {
        hintBest = G.logic.bestTap(this.grid, this.cols, this.rows);
        if (!hintBest) { this.floatCenter(T('hint_show')); return; } // не списываем впустую
      }
      var inv = Meta.inv(id);
      if (inv <= 0) {
        var cost = Meta.boosterCost(id);
        if (this.coins < cost) { E.audio.sfx('deny'); this.floatCenter(T('no_coins')); return; }
        this.coins -= cost; Meta.setCoins(this.coins); Meta.incBought(id);
      } else Meta.addInv(id, -1);

      if (id === 'hint') {
        var best = hintBest;
        this.hintCell = { c: best.c, r: best.r }; this.hintT = 3.2;
        E.audio.sfx('pulse');
      } else if (id === 'bomb') {
        this.bombMode = true;
        this.floatCenter(T('bomb_hint'));
      } else if (id === 'taps') {
        this.tapsLeft += 5;
        E.audio.sfx('buy');
        this.floatCenter('+5');
      }
      this.refreshBoosterLabels();
    },

    /* ---------- ход ---------- */
    tapCell: function (game, c, r) {
      if (this.mode !== 'running' || this.tapLock > 0) return;
      if (this.tapsLeft <= 0) return;
      var rm = G.logic.simulateTap(this.grid, c, r, this.cols, this.rows);
      if (!rm) {
        this.shakeCell = { c: c, r: r, t: 0.22 };
        E.audio.sfx('deny'); E.fx.shake(2, 0.12); buzz(24);
        return;
      }
      G.logic.applyRemoved(this.grid, rm);
      this.tapsLeft--; this.tapsUsed++;
      this.hintCell = null;
      var self = this, exits = 0, smashed = 0, cracked = 0, boomed = 0, buzzed = false;
      for (var i = 0; i < rm.length; i++) {
        (function (e) {
          var px = self.cellX(e.c), py = self.cellY(e.r);
          if (e.kind === 'crack') {
            cracked++;
            self.score += 2;
            self.floaters.push({ x: px, y: py, t: 0, text: '❄', color: '#bfe9ff' });
            E.fx.burst(px, py, '#bfe9ff', 10, 150, self.visRng);
            return;
          }
          if (e.kind === 'crate') {
            E.fx.burst(px, py, '#c98a4b', 8, 140, self.visRng);
            return;
          }
          if (e.kind === 'smash') {
            smashed++;
            self.score += 15;
            self.floaters.push({ x: px, y: py, t: 0, text: '+15', color: '#ffd166' });
            E.fx.burst(px, py, '#e0b07a', 10, 170, self.visRng);
            return;
          }
          var dir = e.cell.special === 'bomb' ? 0 : e.cell.dir;
          self.ghosts.push({
            x: px, y: py, size: self.cell * 0.92, color: e.cell.color, dir: dir,
            special: e.cell.special, t: -e.step * 0.05, life: 0.5
          });
          var gain = 10 * (e.step + 1);
          self.score += gain;
          if (e.kind === 'exit') exits++;
          if (e.kind === 'bomb') boomed++;
          self.floaters.push({ x: px, y: py, t: 0, text: '+' + gain, color: e.step ? '#ffd166' : '#ffffff' });
          E.fx.burst(px, py, G.config.palette.tileColors[e.cell.color % G.config.palette.tileColors.length],
            e.step ? 5 : 9, 150, self.visRng);
        })(rm[i]);
      }
      if (boomed) {
        E.audio.sfx('tow'); E.fx.shake(6, 0.25); E.fx.flash('#ffd166', 0.18); buzz(30); buzzed = true;
      } else if (cracked) {
        E.audio.sfx('crunch'); buzz(12); buzzed = true;
      } else if (smashed) {
        E.audio.sfx('skid'); E.fx.shake(4, 0.18); buzz(16); buzzed = true;
      } else E.audio.sfx('engine');
      if (exits > 1) {
        this.comboN = exits; this.comboT = 1.3;
        this.floatCenter('×' + exits);
        E.audio.sfx('horn'); buzz(18);
      }
      if (!buzzed) buzz(8);

      if (G.logic.countArrows(this.grid) === 0) this.win(game, false);
      else if (this.tapsLeft <= 0) this.gameOver(game, false);
    },

    explodeAt: function (game, c, r) {
      if (!G.logic.inB(c, r, this.cols, this.rows)) return;
      var cell = this.grid[r][c];
      if (!cell || cell.t !== 'arrow') { E.audio.sfx('deny'); return; }
      this.bombMode = false;
      var removed = [], self = this;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var x = c + dx, y = r + dy;
        if (!G.logic.inB(x, y, this.cols, this.rows)) continue;
        var n = this.grid[y][x];
        if (n && n.t === 'arrow') removed.push({ c: x, r: y, cell: n, kind: 'bomb' });
        else if (n && n.t === 'crate') removed.push({ c: x, r: y, cell: n, kind: 'crate' });
      }
      G.logic.applyRemoved(this.grid, removed);
      for (var i = 0; i < removed.length; i++) {
        (function (e) {
          var px = self.cellX(e.c), py = self.cellY(e.r);
          if (e.kind === 'crate') { E.fx.burst(px, py, '#c98a4b', 8, 140, self.visRng); return; }
          self.ghosts.push({ x: px, y: py, size: self.cell * 0.92, color: e.cell.color, dir: 0, special: 'bomb', t: 0, life: 0.45 });
          self.score += 15;
          E.fx.burst(px, py, '#ffd166', 6, 170, self.visRng);
        })(removed[i]);
      }
      buzz(30);
      E.audio.sfx('tow'); E.fx.shake(7, 0.3); E.fx.flash('#ffd166', 0.2);
      if (G.logic.countArrows(this.grid) === 0) this.win(game, false);
      else if (this.tapsLeft <= 0) this.gameOver(game, false);
    },

    floatCenter: function (text) {
      this.floaters.push({ x: this.bx + this.boardW / 2, y: this.by + this.boardH * 0.4, t: 0, text: text, color: '#ffd166', big: true });
    },

    /* ---------- исходы ---------- */
    win: function (game, silent) {
      if (this.mode !== 'running') return;
      this.mode = 'win'; E.sdk.gameplayStop();
      var stars = this.tapsUsed <= this.optimal ? 3 : (this.tapsUsed <= this.optimal + 2 ? 2 : 1);
      this.stars = stars;
      var reward = G.config.economy.clearCoins + G.config.economy.starCoins * stars + Math.floor(this.score / 100);
      this.chest = 0;
      if (!this.daily && this.level % 5 === 0) {
        this.chest = 25 + this.level * 2;
        reward += this.chest;
        if (!this.autopilot) Meta.addInv('hint', 1);
      }
      if (this.daily && !Meta.dailyDone()) { reward += G.config.economy.dailyCoins; Meta.markDaily(); }
      this.reward = reward; this.coins += reward;
      if (!this.autopilot) {
        Meta.setCoins(this.coins);
        // ежедневный вызов не двигает кампанию и не пишет в лидерборд глубины
        if (!this.daily) { Meta.saveLevel(this.level + 1); Meta.starFor(this.level, stars); Meta.submit(this.level); }
      }
      E.audio.sfx('win'); E.fx.flash('#8ff0d2', 0.22);
      if (!silent) {
        for (var i = 0; i < 48; i++) {
          E.fx.spawn(this.bx + this.visRng.float() * this.boardW, this.by + this.boardH * 0.5,
            { vx: (this.visRng.float() - 0.5) * 380, vy: -120 - this.visRng.float() * 320, life: 0.8 + this.visRng.float() * 0.5, size: 3 + this.visRng.float() * 4, color: G.config.palette.tileColors[i % 7], grav: 700 });
        }
      }
      if (!this.autopilot && !E.storage.get('no_ads', false) && (this.level % 3 === 0) &&
          (Date.now() - (E.sdk._lastInterstitial || 0) > 60000)) E.sdk.showInterstitial(function () {});
      this.buildEndButtons(game);
    },
    gameOver: function (game, silent) {
      if (this.mode !== 'running') return;
      this.mode = 'over'; E.sdk.gameplayStop();
      if (!silent) { E.audio.sfx('over'); E.fx.shake(8, 0.4); }
      this.buildEndButtons(game);
    },

    setPaused: function (on) {
      var game = E.sdk._game;
      // ВАЖНО: не глушим core.pause('manual') — тогда Game.update() перестаёт вызываться,
      // а ввод оверлея обрабатывается в update, и пауза превращается в кирпич
      // (кнопка «Продолжить» не нажимается, Esc не помогает). Останавливаем только
      // геймплей для платформы; сцена в mode='paused' не тикает таймеры.
      if (on && this.mode === 'running') {
        this.mode = 'paused'; E.sdk.gameplayStop();
        this.buildPauseButtons(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = 'running'; E.sdk.gameplayStart();
      }
    },
    buildPauseButtons: function (game) {
      var v = game.view, self = this;
      var bw = Math.min(260, v.w * 0.7), bh = 48, cx = v.w / 2, y0 = v.h * 0.36;
      this.endButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19, text: T('pause_resume'), onTap: function () { E.audio.sfx('click'); self.setPaused(false); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 10, w: bw, h: bh, fontSize: 19, text: T('pause_restart'), onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level, daily: self.daily }); } }),
        new E.ui.Button({
          x: cx - bw / 2, y: y0 + 2 * (bh + 10), w: bw, h: bh, fontSize: 17,
          text: E.audio.isMuted() ? T('sound_off') : T('sound_on'),
          onTap: function (b) { var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m); b.text = m ? T('sound_off') : T('sound_on'); }
        }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + 3 * (bh + 10), w: bw, h: bh, fontSize: 19, text: T('pause_menu'), onTap: function () { E.audio.sfx('click'); game.setScene('menu', {}); } })
      ];
    },
    buildEndButtons: function (game) {
      var v = game.view, self = this;
      var bw = Math.min(280, v.w * 0.74), bh = 48, cx = v.w / 2;
      var list = [];
      if (this.mode === 'over') {
        var phO = 330, pyO = (v.h - phO) / 2;
        var y0 = pyO + 150;
        if (!this.reviveUsed && !this.autopilot) {
          list.push(new E.ui.Button({
            x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 15, text: T('over_revive'),
            bg: '#4b2f8a', border: '#b197fc',
            onTap: function () {
              E.audio.sfx('click');
              E.sdk.showRewarded({
                onReward: function () {
                  self.reviveUsed = true; self.tapsLeft += 5; self.mode = 'running';
                  E.sdk.gameplayStart(); self.buildEndButtons(game);
                },
                onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.floatCenter(T('ad_fail')); } }
              });
            }
          }));
          y0 += bh + 10;
        }
        list.push(new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 18, text: T('over_restart'), bg: '#2f9e7a', border: '#5fe08a', onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level, daily: self.daily }); } }));
        list.push(new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 10, w: bw, h: bh, fontSize: 18, text: T('over_menu'), bg: '#1c3150', border: '#3d5a8a', onTap: function () { E.audio.sfx('click'); game.setScene('menu', {}); } }));
      } else if (this.mode === 'win') {
        var phW = Math.min(420, Math.max(360, v.h - 16)), pyW = (v.h - phW) / 2;
        var yw = pyW + 200;
        if (!this.daily && this.level < 30) {
          list.push(new E.ui.Button({ x: cx - bw / 2, y: yw, w: bw, h: bh, fontSize: 18, text: T('win_next'), bg: '#2f9e7a', border: '#5fe08a', onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level + 1 }); } }));
          yw += bh + 10;
        }
        list.push(new E.ui.Button({ x: cx - bw / 2, y: yw, w: bw, h: bh, fontSize: 18, text: T('win_replay'), bg: '#1c3150', border: '#3d5a8a', onTap: function () { E.audio.sfx('click'); game.setScene('play', { level: self.level, daily: self.daily }); } }));
        list.push(new E.ui.Button({ x: cx - bw / 2, y: yw + bh + 10, w: bw, h: bh, fontSize: 18, text: T('win_menu'), bg: '#1c3150', border: '#3d5a8a', onTap: function () { E.audio.sfx('click'); game.setScene('menu', {}); } }));
      }
      this.endButtons = list;
    },

    /* ---------- update ---------- */
    update: function (game, dt) {
      var i;
      if (E.capture) E.capture.tickRecording(dt);
      // Escape обрабатывается ДО early-return по pointer.pressed, иначе из паузы
      // клавиша не срабатывает без тапа мышью.
      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'running') { this.setPaused(true); return; }
        if (this.mode === 'paused') { this.setPaused(false); return; }
      }
      for (i = this.ghosts.length - 1; i >= 0; i--) {
        var g = this.ghosts[i]; g.t += dt;
        if (g.t > g.life) this.ghosts.splice(i, 1);
      }
      for (i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt;
        if (f.t > 1.1) this.floaters.splice(i, 1);
      }
      if (this.shakeCell) { this.shakeCell.t -= dt; if (this.shakeCell.t <= 0) this.shakeCell = null; }
      if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.hintCell = null; }
      if (this.introT > 0) this.introT -= dt;
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboN = 0; }
      if (this.tutorial > 0) { this.tutT += dt; }
      if (this.tapLock > 0) this.tapLock -= dt;

      if (this.mode === 'win' && this.autopilot) {
        this.endT += dt;
        if (this.endT > 1.1) { this.endT = 0; game.setScene('play', { level: this.level + 1 }); return; }
      }

      if (this.autopilot && this.mode === 'running') {
        this.autoT -= dt;
        if (this.autoT <= 0) {
          this.autoT = 0.24;
          var best = G.logic.bestTap(this.grid, this.cols, this.rows);
          if (best) this.tapCell(game, best.c, best.r);
          else if (G.logic.countArrows(this.grid) === 0) this.win(game, false);
        }
      }

      if (!E.input.pointer.pressed) return;
      var x = E.input.pointer.x, y = E.input.pointer.y;

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (this.mode !== 'win' || !this.autopilot) E.ui.handleTap(this.endButtons, x, y);
        return;
      }
      if (this.mode !== 'running') return;
      if (this.tutorial > 0) { this.tutorial = 0; E.storage.set('tutorialSeen', true); }

      // кнопки (пауза, бустеры)
      if (E.ui.handleTap(this.buttons, x, y)) return;

      // поле
      var c = Math.floor((x - this.bx) / this.cell), r = Math.floor((y - this.by) / this.cell);
      if (!G.logic.inB(c, r, this.cols, this.rows)) return;
      if (this.bombMode) this.explodeAt(game, c, r);
      else this.tapCell(game, c, r);
    },

    /* ---------- draw ---------- */
    draw: function (game, ctx) {
      var v = game.view, P = G.config.palette, self = this;
      drawBackground(game, ctx, this.blobs, game.time, this.level);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));

      // панель поля
      E.ui.roundRect(ctx, this.bx - 10, this.by - 10, this.boardW + 20, this.boardH + 20, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(61,90,138,0.7)'; ctx.stroke();

      // парковочные места: светлая разметка вместо плиток
      var inset = this.cell * 0.08;
      for (var r = 0; r < this.rows; r++) {
        for (var c = 0; c < this.cols; c++) {
          var cx = this.cellX(c), cy = this.cellY(r);
          E.ui.roundRect(ctx, cx - this.cell / 2 + inset, cy - this.cell / 2 + inset, this.cell - inset * 2, this.cell - inset * 2, this.cell * 0.10);
          ctx.fillStyle = ((c + r) % 2) ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.10)';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255,255,255,0.11)';
          ctx.stroke();
          // короткие «усики» разметки по углам
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = 2;
          var x0 = cx - this.cell / 2 + inset, y0 = cy - this.cell / 2 + inset, x1 = cx + this.cell / 2 - inset, y1 = cy + this.cell / 2 - inset;
          var tick = this.cell * 0.10;
          ctx.beginPath(); ctx.moveTo(x0, y0 + tick); ctx.lineTo(x0, y0); ctx.lineTo(x0 + tick, y0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x1 - tick, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - tick); ctx.stroke();
        }
      }

      // стены и плитки
      for (r = 0; r < this.rows; r++) {
        for (c = 0; c < this.cols; c++) {
          var cell = this.grid[r][c];
          if (!cell) continue;
          var x = this.cellX(c), y = this.cellY(r);
          if (this.shakeCell && this.shakeCell.c === c && this.shakeCell.r === r) {
            x += Math.sin(this.shakeCell.t * 90) * 4;
          }
          if (cell.t === 'wall') { G.art.drawWall(ctx, x, y, this.cell * 0.94); continue; }
          if (cell.t === 'crate') { G.art.drawCrate(ctx, x, y, this.cell * 0.9); continue; }
          if (this.hintCell && this.hintCell.c === c && this.hintCell.r === r) {
            G.art.drawGlow(ctx, x, y, this.cell * 0.85, 'rgba(255,209,102,0.55)', 0.55 + 0.35 * Math.sin(game.time * 8));
            ctx.save();
            ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
            E.ui.roundRect(ctx, x - this.cell * 0.47, y - this.cell * 0.47, this.cell * 0.94, this.cell * 0.94, this.cell * 0.18);
            ctx.stroke(); ctx.restore();
          }
          G.art.drawTile(ctx, cell.color, x, y, this.cell * 0.92, cell.dir, cell.special, 1, 1);
          if (cell.frozen > 0) G.art.drawIce(ctx, x, y, this.cell, game.time);
        }
      }

      // улетающие призраки
      for (var i = 0; i < this.ghosts.length; i++) {
        var gh = this.ghosts[i];
        if (gh.t < 0) continue;
        var k = gh.t / gh.life;
        if (k > 1) continue;
        var dist = gh.t * this.cell * (5 + k * 8);
        var dx = G.logic.DIRS[gh.dir || 0][0] * dist, dy = G.logic.DIRS[gh.dir || 0][1] * dist;
        G.art.drawTile(ctx, gh.color, gh.x + dx, gh.y + dy, gh.size * (1 + k * 0.25), gh.dir, gh.special, 1 - k, 1);
      }

      // всплывающие очки
      for (i = 0; i < this.floaters.length; i++) {
        var fl = this.floaters[i], a = 1 - fl.t / 1.1;
        ctx.save(); ctx.globalAlpha = Math.max(0, a);
        E.ui.text(ctx, fl.text, fl.x, fl.y - fl.t * 42, fl.big ? 30 : 17, fl.color, 'center', 800);
        ctx.restore();
      }
      ctx.restore();

      this.drawHud(game, ctx);
      this.drawBoosters(game, ctx);
      E.fx.draw(ctx);
      E.fx.drawFlash(ctx, v.w, v.h);

      if (this.bombMode) {
        E.ui.text(ctx, T('bomb_hint'), v.w / 2, this.by - 22, 15, '#ffd166', 'center', 700);
      }
      if (this.wide) { this.drawSidePanel(game, ctx); this.drawRightPanel(game, ctx); }
      if (this.introT > 0 && this.mode === 'running' && this.tutorial <= 0) this.drawIntro(game, ctx);
      if (this.comboT > 0 && this.comboN > 1 && this.mode === 'running') this.drawCombo(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running') this.drawTutorial(game, ctx);
      if (this.mode === 'paused') this.drawPause(game, ctx);
      else if (this.mode === 'win' && !this.autopilot) this.drawWin(game, ctx);
      else if (this.mode === 'over' && !this.autopilot) this.drawOver(game, ctx);
    },

    drawHud: function (game, ctx) {
      var v = game.view, P = G.config.palette;
      var y = 10;
      // левая колонка: уровень + ходы (панель целей начинается с 116 — нет наложений)
      E.ui.text(ctx, this.daily ? T('hud_daily') : T('hud_level', { n: this.level }), 14, y + 12, Math.max(12, this.hudH * 0.23), P.dim, 'left', 700);
      E.ui.text(ctx, T('hud_taps', { n: this.tapsLeft }), 14, y + this.hudH * 0.56, Math.max(18, this.hudH * 0.38), this.tapsLeft <= 2 ? P.bad : P.text, 'left', 800);
      // правая колонка: монеты и очки — левее кнопки паузы
      var pr = this.pauseBtn ? this.pauseBtn.x : v.w - 54;
      E.ui.text(ctx, '◉ ' + this.coins, pr - 12, y + 12, Math.max(12, this.hudH * 0.23), P.coin, 'right', 800);
      E.ui.text(ctx, '★ ' + this.score, pr - 12, y + this.hudH * 0.56, Math.max(12, this.hudH * 0.23), P.dim, 'right', 700);
      // полоса прогресса
      var done = this.total - G.logic.countArrows(this.grid);
      var pw = v.w - 28, px = 14, py = this.hudH - 4;
      E.ui.roundRect(ctx, px, py, pw, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
      var frac = this.total ? done / this.total : 0;
      if (frac > 0) {
        E.ui.roundRect(ctx, px, py, Math.max(6, pw * frac), 6, 3);
        ctx.fillStyle = P.accent; ctx.fill();
      }
      E.ui.drawButtons(ctx, [this.pauseBtn]);
    },
    drawBoosters: function (game, ctx) {
      var v = game.view;
      var y = this.availH - this.barH;
      ctx.fillStyle = 'rgba(10,18,34,0.72)';
      ctx.fillRect(0, y, v.w, this.barH);
      ctx.strokeStyle = 'rgba(61,90,138,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(v.w, y); ctx.stroke();
      this.refreshBoosterLabels();
      E.ui.drawButtons(ctx, this.boosterButtons);
    },
    drawIntro: function (game, ctx) {
      var v = game.view;
      var w = Math.min(360, v.w * 0.82), h = 76, x = (v.w - w) / 2, y = this.by + this.boardH * 0.16;
      var a = Math.min(1, this.introT * 2.2);
      ctx.save(); ctx.globalAlpha = a;
      E.ui.roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = 'rgba(12,22,40,0.94)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#4dd4ac'; ctx.stroke();
      E.ui.text(ctx, T('intro_level', { n: this.level }), v.w / 2, y + 24, 18, '#8ff0d2', 'center', 800);
      var line = this.mechHint === 'crate' ? T('intro_crate')
        : this.mechHint === 'bomb' ? T('intro_bomb')
        : this.mechHint === 'ice' ? T('intro_ice')
        : T('intro_clear');
      var fs = E.ui.fit(ctx, line, w - 24, 14, 600);
      E.ui.text(ctx, line, v.w / 2, y + 50, fs, '#dbe9ff', 'center', 600);
      ctx.restore();
    },
    drawCombo: function (game, ctx) {
      var v = game.view, k = Math.min(1, this.comboT / 0.25);
      ctx.save(); ctx.globalAlpha = k;
      var y = this.by - 16;
      E.ui.text(ctx, '×' + this.comboN + ' ' + T('combo_word'), v.w / 2, y, 20, '#ffd166', 'center', 800);
      ctx.restore();
    },
    drawRightPanel: function (game, ctx) {
      var v = game.view, P = G.config.palette;
      var w = this.panelW, x = v.w - w - 14, y = this.by, h = this.boardH;
      E.ui.roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = 'rgba(12,22,40,0.55)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,169,255,0.35)'; ctx.stroke();
      var cx = x + w / 2;
      var st = Meta.stars(), tot = 0;
      for (var k in st) if (Object.prototype.hasOwnProperty.call(st, k)) tot += st[k] | 0;
      E.ui.text(ctx, T('side_record', { n: Meta.best() }), cx, y + 34, 14, P.text, 'center', 700);
      E.ui.text(ctx, T('side_stars', { n: tot, m: 90 }), cx, y + 62, 14, P.coin, 'center', 700);
      E.ui.text(ctx, T('side_coins', { n: this.coins }), cx, y + 90, 14, P.coin, 'center', 700);
      E.ui.text(ctx, T('side_daily') + ': ' + (Meta.dailyDone() ? '✓' : '●'), cx, y + 118, 13,
        Meta.dailyDone() ? P.good : P.dim, 'center', 700);
      E.ui.text(ctx, T('side_tip2'), cx, y + h - 26, 12, P.dim, 'center', 500);
    },
    drawSidePanel: function (game, ctx) {
      var v = game.view, P = G.config.palette;
      var x = this.panelX, y = this.by, w = this.panelW, h = this.boardH;
      E.ui.roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = 'rgba(12,22,40,0.55)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,169,255,0.35)'; ctx.stroke();
      var cx = x + w / 2;
      E.ui.text(ctx, T('hud_level', { n: this.level }), cx, y + 30, 18, '#8ff0d2', 'center', 800);
      E.ui.text(ctx, T('side_goal'), cx, y + 58, 13, P.dim, 'center', 600);
      E.ui.text(ctx, T('side_moves', { n: this.tapsLeft }), cx, y + 92, 22, this.tapsLeft <= 2 ? P.bad : P.text, 'center', 800);
      E.ui.text(ctx, T('side_best', { n: this.optimal }), cx, y + 118, 13, P.dim, 'center', 600);
      var ly = y + 156;
      function legend(kind, text) {
        if (kind === 'crate') G.art.drawCrate(ctx, x + 32, ly, 26);
        else if (kind === 'ice') { G.art.drawTile(ctx, 1, x + 32, ly, 26, 0, 0, 1, 1); G.art.drawIce(ctx, x + 32, ly, 28, game.time); }
        else if (kind === 'bomb') G.art.drawTile(ctx, 0, x + 32, ly, 26, 0, 'bomb', 1, 1);
        E.ui.text(ctx, text, x + 52, ly, 12, P.dim, 'left', 600);
        ly += 34;
      }
      if (this.crateTotal > 0) legend('crate', T('legend_crate'));
      if (this.frozenTotal > 0) legend('ice', T('legend_ice'));
      if (G.config.levelSpec(this.level).bombs > 0) legend('bomb', T('legend_bomb'));
      if (ly < y + h - 40) {
        E.ui.text(ctx, T('side_tip'), cx, y + h - 22, 12, P.dim, 'center', 500);
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view;
      var w = Math.min(360, v.w * 0.88), h = 74, x = (v.w - w) / 2, y = this.by + this.boardH * 0.5 - h / 2;
      ctx.save(); ctx.globalAlpha = 0.96;
      E.ui.roundRect(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(12,22,40,0.96)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#4dd4ac'; ctx.stroke();
      var size = E.ui.fit(ctx, T('tutorial'), w - 32, 15, 600);
      ctx.font = '600 ' + size + 'px system-ui, sans-serif';
      ctx.fillStyle = '#f2f7ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // перенос по словам максимум на 3 строки
      var words = T('tutorial').split(' '), lines = [], line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > w - 32 && line) { lines.push(line); line = words[i]; }
        else line = test;
      }
      if (line) lines.push(line);
      lines = lines.slice(0, 3);
      for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], v.w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * (size + 4));
      ctx.restore();
      E.ui.text(ctx, '▼', v.w / 2, y + h + 14, 16, '#9fb3d1', 'center', 700);
    },
    drawPause: function (game, ctx) {
      var v = game.view;
      ctx.fillStyle = 'rgba(6,12,24,0.66)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, T('pause_resume'), v.w / 2, v.h * 0.32, 22, '#f2f7ff', 'center', 800);
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawWin: function (game, ctx) {
      var v = game.view, P = G.config.palette;
      ctx.fillStyle = 'rgba(6,12,24,0.62)'; ctx.fillRect(0, 0, v.w, v.h);
      var pw = Math.min(340, v.w * 0.86), ph = Math.min(420, Math.max(360, v.h - 16)), px = (v.w - pw) / 2, py = (v.h - ph) / 2;
      E.ui.roundRect(ctx, px, py, pw, ph, 22); ctx.fillStyle = P.panel; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#5fe08a'; ctx.stroke();
      var wTitle = this.daily ? T('daily_win') : (this.level >= 30 ? T('campaign_done') : T('win_title'));
      E.ui.text(ctx, wTitle, v.w / 2, py + 34, 20, '#8ff0d2', 'center', 800);
      // звёзды
      for (var i = 0; i < 3; i++) {
        E.ui.text(ctx, '★', v.w / 2 + (i - 1) * 40, py + 72, 30, i < this.stars ? '#ffd166' : 'rgba(255,255,255,0.15)', 'center', 800);
      }
      E.ui.text(ctx, T('win_score', { n: this.score }), v.w / 2, py + 112, 15, P.dim, 'center', 600);
      E.ui.text(ctx, T('win_coins', { n: this.reward }), v.w / 2, py + 136, this.chest ? 15 : 17, P.coin, 'center', 800);
      if (this.chest) E.ui.text(ctx, T('win_chest', { n: this.chest }), v.w / 2, py + 158, 12, '#ffd166', 'center', 700);
      E.ui.text(ctx, T('win_moves', { n: this.tapsUsed, o: this.optimal }), v.w / 2, py + 178, 12, P.dim, 'center', 600);
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawOver: function (game, ctx) {
      var v = game.view, P = G.config.palette;
      ctx.fillStyle = 'rgba(6,12,24,0.66)'; ctx.fillRect(0, 0, v.w, v.h);
      var pw = Math.min(340, v.w * 0.86), ph = 330, px = (v.w - pw) / 2, py = (v.h - ph) / 2;
      E.ui.roundRect(ctx, px, py, pw, ph, 22); ctx.fillStyle = P.panel; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#ff6b81'; ctx.stroke();
      E.ui.text(ctx, T('over_title'), v.w / 2, py + 42, 22, '#ff9aa8', 'center', 800);
      var ots = E.ui.fit(ctx, T('over_text'), pw - 24, 14, 600);
      E.ui.text(ctx, T('over_text'), v.w / 2, py + 82, ots, P.dim, 'center', 600);
      E.ui.text(ctx, T('win_score', { n: this.score }), v.w / 2, py + 116, 16, P.text, 'center', 700);
      E.ui.drawButtons(ctx, this.endButtons);
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
