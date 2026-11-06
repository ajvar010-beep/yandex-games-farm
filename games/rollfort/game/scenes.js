/* game/scenes.js — «Крепость на Колёсах»: меню, карта глав и бой.
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
  var ROMAN = ['', 'I', 'II', 'III'];

  var W_NAME = {
    saw: 'w_saw', shock: 'w_shock', flame: 'w_flame',
    laser: 'w_laser', mg: 'w_mg', grenade: 'w_grenade'
  };
  var BOSS_NAME = { brute: 'boss_brute', matka: 'boss_matka', shield: 'boss_shield', elite: 'boss_elite' };
  var BOSS_TAG = { brute: 'boss_brute_tag', matka: 'boss_matka_tag', shield: 'boss_shield_tag' };
  var Z_NAME = { walker: 'z_walker', runner: 'z_runner', brute: 'z_brute', flyer: 'z_flyer' };
  var PERK_GLYPH = { dmg: '★', rate: '⚡', hull: '▮', repair: '✚', coin: '✦', slow: '❄', crit: '◎' };
  var PERK_COLOR = { dmg: '#ffd166', rate: '#6fd3ff', hull: '#8a97a8', repair: '#6ee07a', coin: '#f2c14e', slow: '#9fe6ff', crit: '#ff8a7a' };
  var MOD_LABEL = { air: 'mod_air', horde: 'mod_horde', mixed: 'mod_mixed', rush: 'mod_rush' };

  /* ---------------- мета / сохранения ---------------- */
  var Meta = {
    coins: function () {
      var c = E.storage.get('coins', null);
      if (c == null) { c = C.economy.startCoins; E.storage.set('coins', c); }
      return c | 0;
    },
    setCoins: function (n) { E.storage.set('coins', Math.max(0, Math.round(n))); },
    layout: function () { return L.sanitize(E.storage.get('layout', null)); },
    saveLayout: function (layout) { E.storage.set('layout', L.saveLayout(layout)); },
    chapter: function () { return clamp((E.storage.get('ch', 1) | 0) || 1, 1, C.chapters.length); },
    setChapter: function (n) { E.storage.set('ch', clamp(n | 0, 1, C.chapters.length)); },
    done: function () {
      var d = E.storage.get('done', null);
      return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
    },
    markDone: function (n) { var d = Meta.done(); d[n] = 1; E.storage.set('done', d); },
    bossHp: function (ch) {
      var b = E.storage.get('bosshp', null);
      b = (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
      return b[ch] | 0;
    },
    setBossHp: function (ch, hp) {
      var b = E.storage.get('bosshp', null);
      b = (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
      if (hp > 0) b[ch] = Math.round(hp); else delete b[ch];
      E.storage.set('bosshp', b);
    },
    hangar: function () {
      var h = E.storage.get('hangar', null);
      h = (h && typeof h === 'object' && !Array.isArray(h)) ? h : {};
      var out = {};
      for (var i = 0; i < C.hangar.length; i++) out[C.hangar[i].id] = clamp(h[C.hangar[i].id] | 0, 0, C.hangar[i].max);
      return out;
    },
    saveHangar: function (h) { E.storage.set('hangar', h); },
    hangarCost: function (item, lvl) { return item.base + item.step * lvl; },
    submit: function () { E.sdk.submitScore('rollfort_chapter', Meta.chapter()); }
  };

  function addCoins(n) {
    var c = Math.max(0, Meta.coins() + (n | 0));
    Meta.setCoins(c);
    return c;
  }
  function maxDone() {
    var d = Meta.done(), m = 0;
    for (var k in d) { var n = +k; if (d[k] && n > m) m = n; }
    return m;
  }

  /* ---------------- мелкая графика ---------------- */
  function pill(ctx, x, y, w, h, fill, stroke) {
    E.ui.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function coinsBadge(ctx, x, y, val) {
    var h = 32, w = 96;
    pill(ctx, x, y, w, h, 'rgba(8,11,15,0.62)', 'rgba(240,193,75,0.35)');
    A.coin(ctx, x + 17, y + h / 2, 9.5);
    E.ui.text(ctx, String(val), x + 31, y + h / 2 + 1, 16, P.gold, 'left', 700);
  }
  function soundButton(x, y) {
    return new E.ui.Button({
      x: x, y: y, w: 40, h: 40, bg: 'rgba(8,11,15,0.62)', border: 'rgba(240,193,75,0.35)',
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
  function helpButton(x, y) {
    return new E.ui.Button({
      x: x, y: y, w: 40, h: 40, bg: 'rgba(8,11,15,0.62)', border: 'rgba(240,193,75,0.35)',
      text: '?', fontSize: 18, fg: P.gold
    });
  }
  function drawStripe(ctx, x, y, w, h, alpha) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(240,193,75,' + (alpha == null ? 0.5 : alpha) + ')';
    var step = Math.max(10, h * 1.6);
    for (var i = -h; i < w + h; i += step) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.lineTo(x + i + h + step * 0.45, y);
      ctx.lineTo(x + i + step * 0.45, y + h);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ================================================================ МЕНЮ */
  S.menu = {
    name: 'menu',
    consumesInputInUpdate: true,
    enter: function (game) {
      this.game = game; this.t = 0; this.help = false; this.toast = null;
      this.hangar = false; this.hangarButtons = []; this.hangarCards = [];
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
      var titleSize = Math.min(W * (portrait ? 0.15 : 0.085), H * (portrait ? 0.078 : 0.125), portrait ? 62 : 74);
      var y1 = H * (portrait ? 0.10 : 0.11);
      var y2 = y1 + titleSize * 0.95;
      var subY = y2 + titleSize * 0.62;
      var fortW = Math.min(W * (portrait ? 0.72 : 0.5), 460);
      var fortH = Math.min(H * 0.20, fortW * 0.26);
      var fortY = H * (portrait ? 0.28 : 0.27);
      var bw = Math.min(340, W * 0.74);
      var bh = Math.max(42, Math.min(58, H * 0.075));
      var b0 = H * (portrait ? 0.52 : 0.50);
      return {
        W: W, H: H, portrait: portrait, titleSize: titleSize,
        y1: y1, y2: y2, subY: subY,
        fortW: fortW, fortH: fortH, fortX: (W - fortW) / 2, fortY: fortY,
        roadY: fortY - fortH * 0.18,
        bw: bw, bh: bh, b0: b0
      };
    },
    _build: function (game) {
      var v = game.view;
      var M = this._lay(v), W = v.w, that = this;
      var list = [];
      var bx = (W - M.bw) / 2;
      list.push(new E.ui.Button({
        x: bx, y: M.b0, w: M.bw, h: M.bh, text: T('play'),
        bg: '#5a3a22', border: P.hazard, fg: P.cream, fontSize: Math.round(M.bh * 0.38),
        onTap: function () { E.audio.sfx('click'); game.setScene('play', { chapter: Meta.chapter() }); }
      }));
      list.push(new E.ui.Button({
        x: bx, y: M.b0 + M.bh + 10, w: M.bw, h: M.bh * 0.82, text: T('chapters'),
        bg: 'rgba(18,23,30,0.85)', border: 'rgba(240,193,75,0.45)', fg: P.cream,
        fontSize: Math.round(M.bh * 0.32),
        onTap: function () { E.audio.sfx('click'); game.setScene('map', {}); }
      }));
      // реклама за монеты
      var rvW = Math.min(220, W * 0.56), rvH = Math.max(36, M.bh * 0.66);
      list.push(new E.ui.Button({
        x: W / 2 - rvW / 2, y: M.b0 + M.bh * 1.82 + 22, w: rvW, h: rvH,
        bg: 'rgba(18,23,30,0.8)', border: 'rgba(158,240,92,0.4)',
        icon: function (ctx, b) {
          A.coin(ctx, b.x + 20, b.y + b.h / 2, 9);
          E.ui.text(ctx, T('coins_150', { n: C.ads.rewardedCoins }), b.x + 36, b.y + b.h / 2 - 5, 13, P.gold, 'left', 700);
          E.ui.text(ctx, T('coins_ad'), b.x + 36, b.y + b.h / 2 + 8, 9.5, P.dim, 'left', 500);
          // треугольник «плей»
          ctx.fillStyle = 'rgba(158,240,92,0.85)';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w - 20, b.y + b.h / 2 - 6);
          ctx.lineTo(b.x + b.w - 10, b.y + b.h / 2);
          ctx.lineTo(b.x + b.w - 20, b.y + b.h / 2 + 6);
          ctx.closePath(); ctx.fill();
        },
        onTap: function () {
          E.sdk.showRewarded({
            onReward: function () { addCoins(C.ads.rewardedCoins); E.audio.sfx('coin'); that.toast = { t: 1.6, text: T('coins_150', { n: C.ads.rewardedCoins }) }; },
            onDone: function (ok) { if (!ok) that.toast = { t: 1.6, text: T('ad_fail') }; }
          });
        }
      }));
      var sb = helpButton(W - 56, 14);
      sb.onTap = function () { E.audio.sfx('click'); that.help = !that.help; };
      list.push(sb);
      list.push(soundButton(W - 56 - 46, 14));
      list.push(new E.ui.Button({
        x: W - 148, y: 14, w: 40, h: 40, bg: 'rgba(8,11,15,0.62)', border: 'rgba(240,193,75,0.35)',
        icon: function (ctx, b) { A.wrench(ctx, b.x + b.w / 2, b.y + b.h / 2, 20, P.cream); },
        onTap: function () { E.audio.sfx('click'); that.hangar = true; that._buildHangar(game); }
      }));
      this.buttons = list;
    },
    _buildHangar: function (game) {
      var v = game.view, W = v.w, H = v.h, that = this;
      var bw = Math.min(520, W * 0.9);
      var bh = Math.min(104, (H * 0.52) / C.hangar.length - 10);
      var top = H * 0.26;
      var list = [];
      this.hangarCards = [];
      for (var i = 0; i < C.hangar.length; i++) {
        (function (item, idx) {
          var y = top + idx * (bh + 10);
          var x = W / 2 - bw / 2;
          that.hangarCards.push({ item: item, x: x, y: y, w: bw, h: bh });
          var h = Meta.hangar(), lvl = h[item.id] | 0;
          var maxed = lvl >= item.max;
          var cost = Meta.hangarCost(item, lvl);
          list.push(new E.ui.Button({
            x: x + bw - 122, y: y + bh / 2 - 20, w: 112, h: 40,
            text: maxed ? T('maxed') : String(cost),
            bg: maxed ? 'rgba(30,36,44,0.9)' : '#3d4a5c',
            border: maxed ? 'rgba(120,132,148,0.4)' : P.hazard,
            fg: maxed ? P.dim : P.cream, fontSize: 15,
            enabled: !maxed,
            onTap: function () { that.buyHangar(game, item); }
          }));
        })(C.hangar[i], i);
      }
      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      list.push(new E.ui.Button({
        x: W / 2 - 80, y: H - 86 - banM, w: 160, h: 44, text: T('back'),
        bg: 'rgba(18,23,30,0.9)', border: 'rgba(240,193,75,0.45)', fg: P.cream, fontSize: 17,
        onTap: function () { E.audio.sfx('click'); that.hangar = false; }
      }));
      this.hangarButtons = list;
    },
    buyHangar: function (game, item) {
      var h = Meta.hangar(), lvl = h[item.id] | 0;
      if (lvl >= item.max) return;
      var cost = Meta.hangarCost(item, lvl);
      if (Meta.coins() < cost) { this.toast = { t: 1.4, text: T('not_enough') }; E.audio.sfx('deny'); return; }
      addCoins(-cost);
      h[item.id] = lvl + 1;
      Meta.saveHangar(h);
      E.audio.sfx('buy');
      this._buildHangar(game);
    },
    _drawHangar: function (ctx) {
      var v = this.game.view, W = v.w, H = v.h;
      ctx.fillStyle = 'rgba(6,9,13,0.94)'; ctx.fillRect(0, 0, W, H);
      E.ui.text(ctx, T('hangar_title'), W / 2, H * 0.14, Math.min(W * 0.08, 34), P.hazard, 'center', 800);
      E.ui.text(ctx, T('hangar_hint'), W / 2, H * 0.14 + 26, Math.min(W * 0.036, 14), 'rgba(241,233,216,0.6)', 'center', 500);
      var h = Meta.hangar();
      for (var i = 0; i < this.hangarCards.length; i++) {
        var c = this.hangarCards[i], item = c.item, lvl = h[item.id] | 0;
        E.ui.roundRect(ctx, c.x, c.y, c.w, c.h, 14);
        ctx.fillStyle = 'rgba(28,34,42,0.95)'; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(240,193,75,0.3)'; ctx.stroke();
        E.ui.text(ctx, T(item.name), c.x + 16, c.y + c.h * 0.32, Math.min(17, c.h * 0.2), P.cream, 'left', 700);
        E.ui.text(ctx, T(item.desc), c.x + 16, c.y + c.h * 0.60, Math.min(12, c.h * 0.13), 'rgba(241,233,216,0.6)', 'left', 500);
        var pw = Math.min(16, c.w * 0.035), gap = 5;
        for (var p = 0; p < item.max; p++) {
          ctx.fillStyle = p < lvl ? P.toxic : 'rgba(120,132,148,0.3)';
          E.ui.roundRect(ctx, c.x + 16 + p * (pw + gap), c.y + c.h * 0.76, pw, 6, 3); ctx.fill();
        }
        if (lvl < item.max) A.coin(ctx, c.x + c.w - 138, c.y + c.h / 2, 9);
      }
      E.ui.drawButtons(ctx, this.hangarButtons);
    },
    update: function (game, dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.hangar) {
        if (E.input.wasPressed('Escape')) { this.hangar = false; return; }
        if (E.input.pointer.pressed) E.ui.handleTap(this.hangarButtons, E.input.pointer.x, E.input.pointer.y);
        return;
      }
      if (this.help) { if (E.input.pointer.pressed) this.help = false; return; }
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) {
        game.setScene('play', { chapter: Meta.chapter() });
      }
    },
    draw: function (game, ctx) {
      var v = game.view, W = v.w, H = v.h;
      var M = this._lay(v);
      A.sky(ctx, W, H, this.t, 1);
      A.skyline(ctx, W, H, M.roadY, 71, 1);
      A.road(ctx, 0, M.roadY, W, H - M.roadY, false, [M.roadY + (H - M.roadY) * 0.42, M.roadY + (H - M.roadY) * 0.78], 47);
      A.menuFort(ctx, M.fortX, M.fortY, M.fortW, M.fortH, this.t);

      var a = Math.min(1, this.t * 1.6);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      E.ui.text(ctx, T('title1'), W / 2, M.y1, M.titleSize, P.hazard, 'center', 800);
      E.ui.text(ctx, T('title2'), W / 2, M.y2, M.titleSize * 0.78, P.cream, 'center', 800);
      ctx.restore();
      E.ui.text(ctx, T('subtitle'), W / 2, M.subY, Math.min(W * 0.042, 19), 'rgba(241,233,216,0.62)', 'center', 500);

      coinsBadge(ctx, 14, 14, Meta.coins());
      ctx.save();
      ctx.globalAlpha = a;
      E.ui.drawButtons(ctx, this.buttons);
      ctx.restore();

      // прогресс и подсказка
      var pr = T('progress_n', { n: Meta.chapter(), total: C.chapters.length });
      var banM = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      E.ui.text(ctx, pr + ' · ' + T('best_n', { n: maxDone() }), W / 2, H - 54 - banM, Math.min(W * 0.034, 14), 'rgba(241,233,216,0.55)', 'center', 600);
      E.ui.text(ctx, T('menu_tip'), W / 2, H - 30 - banM, Math.min(W * 0.032, 13), 'rgba(241,233,216,0.35)', 'center', 500);

      if (this.toast) {
        var ta = Math.min(1, this.toast.t * 2);
        ctx.globalAlpha = ta;
        pill(ctx, W / 2 - 110, H * 0.86, 220, 36, 'rgba(10,14,18,0.92)', 'rgba(240,193,75,0.4)');
        E.ui.text(ctx, this.toast.text, W / 2, H * 0.86 + 18, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }

      if (this.help) {
        ctx.fillStyle = 'rgba(8,11,15,0.93)'; ctx.fillRect(0, 0, W, H);
        var hy = H * 0.24;
        E.ui.text(ctx, T('rules_title'), W / 2, hy, Math.min(W * 0.07, 30), P.hazard, 'center', 800);
        var lines = [T('rules_1'), T('rules_2'), T('rules_3'), T('rules_4')];
        for (var i = 0; i < lines.length; i++) {
          var s = E.ui.fit(ctx, lines[i], W * 0.84, Math.max(13, Math.min(W * 0.036, 17)), 500);
          E.ui.text(ctx, lines[i], W / 2, hy + 48 + i * (s + 20), s, P.cream, 'center', 500);
        }
        E.ui.text(ctx, T('close'), W / 2, H * 0.82, 16, 'rgba(241,233,216,0.6)', 'center', 600);
      }
      if (this.hangar) this._drawHangar(ctx);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ================================================================ КАРТА */
  S.map = {
    name: 'map',
    consumesInputInUpdate: true,
    enter: function (game) {
      this.game = game; this.t = 0;
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
      var rows = Math.ceil(C.chapters.length / cols);
      var pad = Math.max(10, Math.min(W, H) * 0.03);
      var gap = 8;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var top = H * 0.19;
      var bottom = H - banner - pad * 2;
      var tw = (W - pad * 2 - (cols - 1) * gap) / cols;
      var th = Math.min(tw * 1.18, (bottom - top - (rows - 1) * gap) / rows);
      return { W: W, H: H, portrait: portrait, cols: cols, rows: rows, pad: pad, gap: gap, banner: banner,
               top: top, tw: tw, th: th, totalW: cols * tw + (cols - 1) * gap,
               x0: (W - (cols * tw + (cols - 1) * gap)) / 2 };
    },
    _build: function (game) {
      var v = game.view, M = this._lay(v);
      var that = this, list = [];
      list.push(new E.ui.Button({
        x: 14, y: M.H - M.banner - 54, w: Math.min(180, M.W * 0.38), h: 40, text: T('back'),
        bg: 'rgba(18,23,30,0.85)', border: 'rgba(240,193,75,0.45)', fg: P.cream, fontSize: 16,
        onTap: function () { E.audio.sfx('click'); game.setScene('menu', {}); }
      }));
      this.levelRects = [];
      for (var i = 0; i < C.chapters.length; i++) {
        (function (ch, idx) {
          var col = idx % M.cols, row = Math.floor(idx / M.cols);
          var x = M.x0 + col * (M.tw + M.gap);
          var y = M.top + row * (M.th + M.gap);
          that.levelRects.push({ x: x, y: y, w: M.tw, h: M.th });
          list.push(new E.ui.Button({
            x: x, y: y, w: M.tw, h: M.th, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            icon: function (ctx, b) { that._tile(ctx, b, ch, idx); },
            onTap: function () {
              if (ch.n > Meta.chapter()) { E.audio.sfx('deny'); that.toast = { t: 1.4, text: T('locked') }; return; }
              E.audio.sfx('click');
              game.setScene('play', { chapter: ch.n });
            }
          }));
        })(C.chapters[i], i);
      }
      this.buttons = list;
    },
    _tile: function (ctx, b, ch, idx) {
      var x = b.x, y = b.y, w = b.w, h = b.h;
      var locked = ch.n > Meta.chapter();
      var done = !!Meta.done()[ch.n];
      var current = ch.n === Meta.chapter();
      var r = Math.max(6, Math.min(w, h) * 0.07);
      var g = ctx.createLinearGradient(x, y, x, y + h);
      if (locked) { g.addColorStop(0, '#1b2028'); g.addColorStop(1, '#12161c'); }
      else { g.addColorStop(0, '#39424d'); g.addColorStop(1, '#1f262e'); }
      E.ui.roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = locked ? 'rgba(70,78,90,0.5)' : (current ? P.toxic : (done ? 'rgba(110,224,122,0.55)' : 'rgba(240,193,75,0.55)'));
      ctx.stroke();

      // номер
      var ns = Math.min(h * 0.30, w * 0.34);
      E.ui.text(ctx, String(ch.n), x + w * 0.12, y + h * 0.26, ns, locked ? 'rgba(140,150,163,0.5)' : P.hazard, 'left', 800);
      // название
      var name = T(ch.name);
      var nfs = E.ui.fit(ctx, name, w * 0.84, Math.max(9, Math.min(w * 0.115, h * 0.13)), 600);
      E.ui.text(ctx, name, x + w * 0.09, y + h * 0.83, nfs, locked ? 'rgba(140,150,163,0.45)' : 'rgba(241,233,216,0.72)', 'left', 600);
      if (ch.mod && MOD_LABEL[ch.mod]) {
        E.ui.text(ctx, T(MOD_LABEL[ch.mod]), x + w * 0.09, y + h * 0.62, Math.max(9, Math.min(w * 0.08, 12)), locked ? 'rgba(140,150,163,0.35)' : P.hazard, 'left', 700);
      }

      // награда главы
      if (ch.boss) {
        A.skull(ctx, x + w * 0.82, y + h * 0.30, Math.min(w, h) * 0.20, locked ? 'rgba(140,150,163,0.35)' : '#e07070');
      } else if (ch.weapon) {
        A.weapon(ctx, ch.weapon, x + w * 0.80, y + h * 0.32, Math.min(w, h) * 0.26, { alpha: locked ? 0.28 : 0.9, t: 0 });
      } else {
        // «просто сложнее» — шеврон
        ctx.strokeStyle = locked ? 'rgba(140,150,163,0.25)' : 'rgba(158,240,92,0.6)';
        ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.03);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.70, y + h * 0.26); ctx.lineTo(x + w * 0.86, y + h * 0.36);
        ctx.lineTo(x + w * 0.70, y + h * 0.46);
        ctx.stroke();
      }

      if (locked) {
        A.lock(ctx, x + w * 0.5, y + h * 0.52, Math.min(w, h) * 0.30, 'rgba(160,170,184,0.55)');
      } else if (done) {
        ctx.save();
        ctx.strokeStyle = '#6ee07a'; ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.05);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + w - Math.min(w, h) * 0.20, y + Math.min(w, h) * 0.16);
        ctx.lineTo(x + w - Math.min(w, h) * 0.13, y + Math.min(w, h) * 0.24);
        ctx.lineTo(x + w - Math.min(w, h) * 0.03, y + Math.min(w, h) * 0.09);
        ctx.stroke();
        ctx.restore();
      }
      if (current) {
        var pulse = 0.5 + Math.sin(this.t * 3) * 0.25;
        ctx.save();
        ctx.globalAlpha = pulse * 0.5;
        ctx.strokeStyle = P.toxic;
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
      var v = game.view, W = v.w, H = v.h;
      A.sky(ctx, W, H, this.t, 2);
      A.skyline(ctx, W, H, H * 0.92, 91, 0.75);
      ctx.fillStyle = 'rgba(10,13,17,0.55)'; ctx.fillRect(0, 0, W, H);
      E.ui.text(ctx, T('map_title'), W / 2, H * 0.085, Math.min(W * 0.09, 38), P.hazard, 'center', 800);
      E.ui.text(ctx, T('map_hint'), W / 2, H * 0.135, Math.min(W * 0.036, 14), 'rgba(241,233,216,0.55)', 'center', 500);
      coinsBadge(ctx, 14, 14, Meta.coins());
      E.ui.drawButtons(ctx, this.buttons);
      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 2);
        pill(ctx, W / 2 - 100, H * 0.5 - 18, 200, 36, 'rgba(10,14,18,0.92)', 'rgba(240,193,75,0.4)');
        E.ui.text(ctx, this.toast.text, W / 2, H * 0.5, 13, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },
    getCaptureState: function () { return { scene: 'map' }; }
  };

  /* ================================================================ БОЙ */
  S.battle = {
    name: 'play',
    consumesInputInUpdate: true,

    enter: function (game, params) {
      params = params || {};
      var cp = (E.capture && E.capture.params) || {};
      this.game = game;
      this.chapter = clamp(parseInt(params.chapter || (cp.wave != null ? cp.wave : Meta.chapter()), 10) || 1, 1, C.chapters.length);
      this.autopilot = !!(E.capture.autoplay || E.capture.record > 0);
      var seed = (params.seed != null) ? params.seed : (E.capture.seed != null ? E.capture.seed : (Date.now() % 999983));
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      var firstRun = !Meta.done()[this.chapter] && this.chapter === Meta.chapter();
      this.st = L.newBattle({
        chapter: this.chapter,
        layout: Meta.layout(),
        coins: Meta.coins(),
        rng: new E.Rng(this.seedNum || 1),
        bossHp: Meta.bossHp(this.chapter),
        bonus: Meta.hangar(),
        first: firstRun && !this.autopilot
      });
      this.st.recordSafe = this.autopilot || E.capture.active;
      this.mode = 'running';
      this.panel = '';
      this.selected = null;
      this.pending = null;
      this.drag = null;
      this.t = 0; this.clearT = 0; this.autoT = 0; this.autoBuilt = false;
      this.bannerT = 0; this.bannerText = ''; this.bannerSub = '';
      this.floaters = []; this.sfxT = {};
      this.toast = null;
      this.result = null; this.reward = 0; this.reviveUsed = false; this.doubled = false;
      this.endButtons = [];
      this.pausePrev = 'running';
      this.coinSyncT = 0; this.lastCoins = this.st.coins;
      this.selPulse = 0;
      E.audio.music('play');
      E.sdk.hideBanner();
      E.sdk.gameplayStart();
      this.layout(game);
      this.buildPanel(game);
      this.buildEnd(game);
      if (this.autopilot) this.st.coins = Math.max(this.st.coins, 5000);
      if (E.capture && E.capture.active) this.applyCapture(game);
      this.lastCoins = this.st.coins;
      this.lastPhase = this.st.phase;
    },
    exit: function () {
      this.persist();
      E.sdk.gameplayStop();
    },
    onResize: function (game) {
      this.layout(game);
      this.buildPanel(game);
      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') this.buildEnd(game);
    },
    onBack: function (game) {
      if (this.mode === 'running') this.setPaused(true, game);
    },

    persist: function () {
      if (!this.st) return;
      Meta.setCoins(this.st.coins);
      Meta.saveLayout(this.st.layout);
      var b = this.st.bossRef;
      if (b && !b.dead && this.st.phase !== 'win') Meta.setBossHp(this.chapter, Math.max(1, b.hp));
    },

    /* ---------- раскладка ---------- */
    layout: function (game) {
      var v = game.view, W = v.w, H = v.h;
      var banner = (E.sdk.bannerInsetPx ? E.sdk.bannerInsetPx() : 0);
      var portrait = H > W * 1.06;
      var hudH = portrait ? clamp(H * 0.075, 54, 70) : clamp(H * 0.13, 42, 56);
      var panelH = portrait ? clamp(H * 0.24, 146, 190) : clamp(H * 0.26, 98, 116);
      var top = hudH + 2;
      var panelTop = H - banner - panelH;
      var bottom = panelTop - 2;
      var availH = Math.max(100, bottom - top);
      var cw, ch, gx, gy, gw, gh;
      if (portrait) {
        ch = Math.min(availH * 0.42 / 6, 78);
        cw = Math.min(W * 0.92 / 3, ch * 1.95);
        gw = cw * 3; gh = ch * 6;
        gx = (W - gw) / 2; gy = bottom - gh;
      } else {
        cw = Math.min(W * 0.44 / 6, 68);
        ch = Math.min(availH * 0.92 / 3, 68);
        gw = cw * 6; gh = ch * 3;
        gx = Math.max(8, W * 0.04);
        gy = top + (availH - gh) / 2;
      }
      var ahead = portrait ? (gy - top) : (W - (gx + gw) - 8);
      var es = Math.max(16, Math.min(portrait ? ch : cw, ahead / 9.2));
      var Lt = {
        W: W, H: H, portrait: portrait, hudH: hudH, panelH: panelH, panelTop: panelTop,
        top: top, bottom: bottom, availH: availH,
        cw: cw, ch: ch, gx: gx, gy: gy, gw: gw, gh: gh,
        frontX: gx + gw, frontY: gy, ahead: ahead, es: es, banner: banner
      };
      this.Lt = Lt;
      var s = portrait ? 38 : 40;
      var pb = new E.ui.Button({
        x: W - s - 8, y: 8, w: s, h: s, fontSize: 15, text: 'II', id: 'pause',
        bg: 'rgba(8,11,15,0.62)', border: 'rgba(240,193,75,0.35)', fg: P.cream,
        onTap: function () { E.audio.sfx('click'); S.battle.setPaused(true, game); }
      });
      this.pauseBtn = pb;
      this.buttons = [pb];
    },

    perkRects: function () {
      var Lt = this.Lt, W = Lt.W;
      var n = Math.max(1, this.st.perkChoices ? this.st.perkChoices.length : 3);
      var gap = 14;
      var cw = Math.min(Lt.portrait ? 200 : 260, (W - 40 - (n - 1) * gap) / n);
      var chh = Math.min(Lt.portrait ? 240 : 200, (Lt.panelTop - Lt.top) * (Lt.portrait ? 0.5 : 0.6));
      var total = cw * n + gap * (n - 1);
      var x0 = (W - total) / 2;
      var y = Lt.top + Math.max(40, (Lt.panelTop - Lt.top - chh) / 2);
      var out = [];
      for (var i = 0; i < n; i++) out.push({ x: x0 + i * (cw + gap), y: y, w: cw, h: chh });
      return out;
    },
    cellRect: function (idx) {
      var Lt = this.Lt, r = L.rowOf(idx), l = L.laneOf(idx);
      if (Lt.portrait) return { x: Lt.gx + l * Lt.cw, y: Lt.gy + (r - 1) * Lt.ch, w: Lt.cw, h: Lt.ch };
      return { x: Lt.gx + (L.ROWS - r) * Lt.cw, y: Lt.gy + l * Lt.ch, w: Lt.cw, h: Lt.ch };
    },
    cellCenter: function (idx) {
      var r = this.cellRect(idx);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    },
    cellAt: function (x, y) {
      for (var i = 0; i < L.N; i++) {
        var r = this.cellRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    },
    zpos: function (lane, d) {
      var Lt = this.Lt;
      if (Lt.portrait) return { x: Lt.gx + (lane + 0.5) * Lt.cw, y: Lt.gy - d * Lt.es };
      return { x: Lt.frontX + d * Lt.es, y: Lt.gy + (lane + 0.5) * Lt.ch };
    },

    /* ---------- панель сборки ---------- */
    buildPanel: function (game) {
      if (!this.Lt || !this.st) { this.panelButtons = []; return; }
      var Lt = this.Lt, W = Lt.W, self = this;
      var list = [];
      var isBuild = this.st.phase === 'build';
      var perkActive = !!(isBuild && this.st.perkChoices && this.st.perkChoices.length);
      var hy = Lt.panelTop + 8, hh = 44;
      var fightW = Math.min(120, W * 0.31);
      var actRight = W - 10;
      if (isBuild && !perkActive) {
        list.push(new E.ui.Button({
          x: W - 10 - fightW, y: hy, w: fightW, h: hh, text: T('fight'),
          bg: '#3d5a34', border: P.toxic, fg: '#eaf6dc', fontSize: Math.min(17, hh * 0.40),
          onTap: function () { self.startFight(game); }
        }));
        actRight = W - 10 - fightW - 6;
      }
      var it = this.selected != null ? this.st.layout[this.selected] : null;
      if (isBuild && !perkActive && it && it.k === 'w' && it.lvl < 3) {
        var uw = Math.min(84, W * 0.22);
        list.push(new E.ui.Button({
          x: actRight - uw, y: hy, w: uw, h: hh, text: T('upgrade') + ' ' + L.upgradePriceAt(this.st, this.selected),
          bg: '#3d4a5c', border: P.hazard, fg: P.cream, fontSize: Math.min(13, hh * 0.28),
          onTap: function () { self.upgradeSelected(game); }
        }));
        actRight -= uw + 4;
      }
      if (isBuild && !perkActive && it) {
        var rw = Math.min(78, W * 0.20);
        list.push(new E.ui.Button({
          x: actRight - rw, y: hy, w: rw, h: hh, text: T('remove') + ' +' + it.spent,
          bg: '#4a2320', border: '#b23a2e', fg: '#f0d0c8', fontSize: Math.min(13, hh * 0.28),
          onTap: function () { self.removeSelected(game); }
        }));
        actRight -= rw + 4;
      }
      if (perkActive) {
        var rects = this.perkRects();
        for (var pi = 0; pi < rects.length; pi++) {
          list.push(this.makePerkButton(pi, rects[pi].x, rects[pi].y, rects[pi].w, rects[pi].h, game));
        }
      } else if (isBuild) {
        var cols = Lt.portrait ? 4 : 8, rows = Lt.portrait ? 2 : 1;
        var pad = 8, gap = 5;
        var gridTop = hy + hh + 6;
        var gridBottom = Lt.panelTop + Lt.panelH - 12;
        var bh = (gridBottom - gridTop - (rows - 1) * gap) / rows;
        var bw = (W - pad * 2 - (cols - 1) * gap) / cols;
        for (var i = 0; i < 8; i++) {
          var col = i % cols, row = Math.floor(i / cols);
          list.push(this.makeItemButton(i, pad + col * (bw + gap), gridTop + row * (bh + gap), bw, bh, game));
        }
      }
      this.panelButtons = list;
    },
    makeItemButton: function (i, x, y, w, h, game) {
      var self = this;
      var type = i === 0 ? 'block' : (i === 7 ? 'repair' : C.weapons[i - 1].id);
      var def = (type === 'block' || type === 'repair') ? null : L.weapon(type);
      var unlocked = type === 'block' || type === 'repair' || L.unlocked(this.chapter, type);
      var cost = type === 'block' ? C.blockCost : (type === 'repair' ? L.repairCost(this.st) : def.price);
      var afford = this.st.coins >= cost;
      var sel = this.pending === type;
      return new E.ui.Button({
        x: x, y: y, w: w, h: h,
        bg: sel ? 'rgba(64,96,52,0.92)' : (unlocked ? 'rgba(40,47,56,0.96)' : 'rgba(24,28,34,0.96)'),
        border: sel ? P.toxic : (unlocked ? (afford ? 'rgba(240,193,75,0.5)' : 'rgba(240,193,75,0.18)') : 'rgba(60,66,76,0.55)'),
        icon: function (ctx, b) { self.drawItem(ctx, b, i, type, def, unlocked, cost, afford); },
        onTap: function () { self.itemTap(game, i, type); }
      });
    },
    perkDef: function (id) {
      for (var i = 0; i < C.perks.length; i++) if (C.perks[i].id === id) return C.perks[i];
      return null;
    },
    makePerkButton: function (i, x, y, w, h, game) {
      var self = this, id = this.st.perkChoices[i];
      return new E.ui.Button({
        x: x, y: y, w: w, h: h,
        bg: 'rgba(40,47,56,0.97)', border: 'rgba(240,193,75,0.55)',
        icon: function (ctx, b) { self.drawPerk(ctx, b, id); },
        onTap: function () { self.pickPerk(game, id); }
      });
    },
    drawPerk: function (ctx, b, id) {
      var def = this.perkDef(id);
      if (!def) return;
      var cx = b.x + b.w / 2;
      var col = PERK_COLOR[id] || P.hazard;
      var r = Math.max(12, Math.min(24, b.h * 0.16));
      ctx.beginPath(); ctx.arc(cx, b.y + b.h * 0.28, r, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      E.ui.text(ctx, PERK_GLYPH[id] || '★', cx, b.y + b.h * 0.28 + 1, Math.max(12, r * 0.95), '#0e1218', 'center', 800);
      var ns = E.ui.fit(ctx, T(def.name), b.w - 10, Math.min(15, b.h * 0.14), 700);
      E.ui.text(ctx, T(def.name), cx, b.y + b.h * 0.56, ns, P.cream, 'center', 700);
      if (b.h > 64 && b.w > 150) {
        var ds = E.ui.fit(ctx, T(def.desc), b.w - 12, Math.min(12, b.h * 0.095), 500);
        E.ui.text(ctx, T(def.desc), cx, b.y + b.h * 0.78, ds, 'rgba(241,233,216,0.65)', 'center', 500);
      }
    },
    pickPerk: function (game, id) {
      if (L.applyPerk(this.st, id)) {
        E.audio.sfx('buy');
        this.buildPanel(game);
      }
    },
    drawItem: function (ctx, b, i, type, def, unlocked, cost, afford) {
      var x = b.x, y = b.y, w = b.w, h = b.h;
      if (type === 'block') {
        A.block(ctx, x + 5, y + h * 0.17, w * 0.30, h * 0.66, 3);
      } else if (type === 'repair') {
        A.wrench(ctx, x + w * 0.18, y + h * 0.48, Math.min(h * 0.52, w * 0.28), afford ? P.cream : P.dim);
      } else {
        A.weapon(ctx, type, x + w * 0.20, y + h * 0.48, Math.min(w * 0.30, h * 0.62), { alpha: unlocked ? 1 : 0.28, t: 0 });
      }
      var name = type === 'block' ? T('block_name') : (type === 'repair' ? T('repair') : T(W_NAME[type]));
      var maxName = w * 0.58;
      var ns = E.ui.fit(ctx, name, maxName, Math.min(12, h * 0.28), 600);
      E.ui.text(ctx, name, x + w - 5, y + h * 0.33, ns, unlocked ? P.cream : P.dim, 'right', 600);
      if (!unlocked) {
        E.ui.text(ctx, T('unlock_at', { n: L.unlockChapter(type) }), x + w - 5, y + h * 0.70, 12, P.dim, 'right', 500);
      } else {
        var label = (type === 'repair' && cost <= 0) ? '—' : String(cost);
        A.coin(ctx, x + w - 5 - 30, y + h * 0.71, Math.max(5.5, h * 0.13));
        E.ui.text(ctx, label, x + w - 5, y + h * 0.72, 12, afford ? P.gold : '#c06a5a', 'right', 700);
      }
    },
    panelInfo: function () {
      if (this.st.perkChoices && this.st.perkChoices.length) return T('perk_title');
      if (this.pending) {
        var nm = this.pending === 'block' ? T('block_name') : T(W_NAME[this.pending]);
        return nm + ' · ' + T('place_here');
      }
      if (this.selected != null) {
        var it = this.st.layout[this.selected];
        if (!it) return T('empty_cell') + ' · ' + T('row_n', { n: L.rowOf(this.selected) });
        if (it.k === 'b') return T('block_name') + ' · +' + C.hp.block;
        var def = L.weapon(it.t);
        var s = T(W_NAME[it.t]) + ' ' + ROMAN[it.lvl] + ' · ' + T('rows_n', { a: def.rows[0], b: def.rows[1] });
        if (this.Lt && !this.Lt.portrait) s += ' · ' + T('range_n', { n: def.range });
        return s;
      }
      return T('select_cell');
    },

    /* ---------- действия сборки ---------- */
    toast: function (text) { this.toast = { t: 2.2, text: text }; },
    itemTap: function (game, i, type) {
      if (this.st.phase !== 'build') return;
      if (type === 'repair') {
        var cost = L.repairCost(this.st);
        if (cost <= 0) { this.toast(T('full_hp')); E.audio.sfx('deny'); return; }
        if (L.repair(this.st) < 0) { this.toast(T('not_enough')); E.audio.sfx('deny'); return; }
        E.audio.sfx('buy');
        this.buildPanel(game);
        return;
      }
      if (type !== 'block' && !L.unlocked(this.chapter, type)) {
        this.toast(T('locked') + ' · ' + T('unlock_at', { n: L.unlockChapter(type) }));
        E.audio.sfx('deny');
        return;
      }
      if (this.selected != null && !this.st.layout[this.selected]) {
        this.pending = type;
        this.placeSelected(game);
      } else {
        this.pending = this.pending === type ? null : type;
        E.audio.sfx('click');
        this.buildPanel(game);
      }
    },
    placeSelected: function (game) {
      var idx = this.selected;
      if (idx == null) return;
      if (this.st.layout[idx]) { this.toast(T('cannot_place')); E.audio.sfx('deny'); return; }
      var t = this.pending, ok;
      if (t === 'block') ok = L.placeBlock(this.st, idx);
      else ok = L.placeWeapon(this.st, idx, t);
      if (!ok) { this.toast(T('not_enough')); E.audio.sfx('deny'); return; }
      Meta.saveLayout(this.st.layout);
      E.audio.sfx('buy');
      if (t !== 'block') {
        var def = L.weapon(t), row = L.rowOf(idx);
        if (row < def.rows[0] || row > def.rows[1]) {
          this.toast(T('invalid_row', { a: def.rows[0], b: def.rows[1] }));
        }
      }
      this.selPulse = 0.3;
      this.buildPanel(game);
    },
    removeSelected: function (game) {
      if (this.selected == null || !this.st.layout[this.selected]) return;
      var got = L.removeItem(this.st, this.selected);
      Meta.saveLayout(this.st.layout);
      E.audio.sfx('click');
      if (got) this.toast('+' + got);
      this.buildPanel(game);
    },
    upgradeSelected: function (game) {
      if (this.selected == null) return;
      if (L.upgradeItem(this.st, this.selected)) {
        Meta.saveLayout(this.st.layout);
        E.audio.sfx('buy');
      } else {
        this.toast(T('not_enough'));
        E.audio.sfx('deny');
      }
      this.buildPanel(game);
    },
    startFight: function (game) {
      if (this.st.phase !== 'build') return;
      L.startWave(this.st);
      this.mode = 'running';
      this.selected = null;
      this.pending = null;
      this.buildPanel(game);
      E.audio.sfx('horn');
    },

    /* ---------- пауза / исходы ---------- */
    setPaused: function (on, game) {
      game = game || this.game;
      if (on && (this.mode === 'running' || this.mode === 'shop')) {
        this.pausePrev = this.mode;
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildPanel(game);
        this.buildEnd(game);
      } else if (!on && this.mode === 'paused') {
        this.mode = this.pausePrev === 'shop' ? 'shop' : 'running';
        if (this.st.phase === 'combat') E.sdk.gameplayStart();
        this.buildPanel(game);
      }
    },
    onWin: function (game, capture) {
      if (this.result) return;
      this.mode = 'win';
      this.result = { win: true };
      var reward = C.economy.chapter + this.chapter * 10;
      this.reward = reward;
      this.st.coins += reward;
      if (!capture && !this.autopilot) {
        Meta.setCoins(this.st.coins);
        Meta.markDone(this.chapter);
        Meta.setChapter(Math.max(Meta.chapter(), Math.min(C.chapters.length, this.chapter + 1)));
        Meta.setBossHp(this.chapter, 0);
        Meta.saveLayout(this.st.layout);
        Meta.submit();
      }
      E.audio.sfx('win');
      E.sdk.gameplayStop();
      this.buildPanel(game);
      this.buildEnd(game);
    },
    onLose: function (game) {
      if (this.result) return;
      this.mode = 'over';
      this.result = { win: false };
      var b = this.st.bossRef;
      if (b && !b.dead) Meta.setBossHp(this.chapter, Math.max(1, b.hp));
      Meta.setCoins(this.st.coins);
      Meta.saveLayout(this.st.layout);
      E.audio.sfx('core');
      E.audio.sfx('over');
      E.sdk.gameplayStop();
      this.buildPanel(game);
      this.buildEnd(game);
    },
    buildEnd: function (game) {
      var Lt = this.Lt, W = Lt.W, H = Lt.H, self = this;
      var list = [];
      if (!Lt) { this.endButtons = list; return; }
      var bw = Math.min(300, W * 0.76), bh = Math.min(52, Math.max(40, H * 0.075));
      var gapY = 10;
      var cy = (Lt.top + Lt.panelTop) / 2;
      var n = 0;
      if (this.mode === 'paused') n = 4;
      else if (this.mode === 'win') n = 3;
      else if (this.mode === 'over') n = 3;
      var y0 = Math.min(Lt.panelTop - 20 - n * (bh + gapY), Math.max(Lt.top + 30, cy - n * (bh + gapY) / 2));
      var x = W / 2 - bw / 2;
      var i = 0;
      function add(text, bg, border, fg, fs, fn) {
        list.push(new E.ui.Button({ x: x, y: y0 + i * (bh + gapY), w: bw, h: bh, text: text,
          bg: bg, border: border, fg: fg, fontSize: fs, onTap: fn }));
        i++;
      }
      if (this.mode === 'paused') {
        add(T('pause_resume'), '#3d5a34', P.toxic, '#eaf6dc', 18, function () { E.audio.sfx('click'); self.setPaused(false, game); });
        add(T('pause_restart'), 'rgba(40,47,56,0.92)', 'rgba(240,193,75,0.4)', P.cream, 17, function () { E.audio.sfx('click'); game.setScene('play', { chapter: self.chapter }); });
        add(E.audio.isMuted() ? T('sound_off') : T('sound_on'), 'rgba(18,23,30,0.9)', 'rgba(240,193,75,0.25)', P.dim, 15, function (b) {
          var m = !E.audio.isMuted(); E.audio.setMuted(m); E.storage.set('muted', m); b.text = m ? T('sound_off') : T('sound_on');
        });
        add(T('pause_menu'), 'rgba(18,23,30,0.9)', 'rgba(240,193,75,0.25)', P.cream, 16, function () {
          E.audio.sfx('click');
          self.persist();
          game.setScene('map', {});
        });
      } else if (this.mode === 'win') {
        var last = this.chapter >= C.chapters.length;
        add(last ? T('to_map') : T('next_chapter'), '#3d5a34', P.toxic, '#eaf6dc', 18, function () {
          E.audio.sfx('click');
          self.leaveWin(game, last ? 'map' : 'next');
        });
        if (!this.captureMode && !this.doubled) {
          add(T('double_reward'), 'rgba(40,47,56,0.92)', P.hazard, P.cream, 16, function () {
            E.sdk.showRewarded({
              onReward: function () { self.doubled = true; self.st.coins += self.reward; Meta.setCoins(self.st.coins); E.audio.sfx('coin'); self.buildEnd(game); },
              onDone: function () {}
            });
          });
        }
        add(T('to_map'), 'rgba(18,23,30,0.9)', 'rgba(240,193,75,0.25)', P.dim, 15, function () {
          E.audio.sfx('click');
          self.leaveWin(game, 'map');
        });
      } else if (this.mode === 'over') {
        if (!this.captureMode && !this.reviveUsed) {
          add(T('second_chance'), '#4b3a22', P.hazard, P.cream, 17, function () {
            E.sdk.showRewarded({
              onReward: function () {
                self.reviveUsed = true;
                self.st.hp = Math.max(1, Math.round(self.st.maxHp * 0.5));
                self.st.zombies = []; self.st.spawnQueue = [];
                self.st.bossRef = null;
                self.st.phase = 'build';
                self.st.buildT = C.buildTime;
                self.mode = 'running';
                self.result = null;
                E.sdk.gameplayStart();
                E.audio.sfx('revive');
                self.buildPanel(game);
                self.buildEnd(game);
              },
              onDone: function (ok) { if (!ok) { E.audio.sfx('deny'); self.toast(T('ad_fail')); } }
            });
          });
        }
        add(T('retry'), '#3d4a5c', P.hazard, P.cream, 18, function () { E.audio.sfx('click'); game.setScene('play', { chapter: self.chapter }); });
        add(T('to_map'), 'rgba(18,23,30,0.9)', 'rgba(240,193,75,0.25)', P.dim, 15, function () { E.audio.sfx('click'); self.persist(); game.setScene('map', {}); });
      }
      this.endButtons = list;
    },
    leaveWin: function (game, to) {
      this.persist();
      var self = this;
      var every = C.ads.interstitialEvery;
      var needAd = !this.captureMode && !this.autopilot && (this.chapter % every === 0);
      var go = function () {
        if (to === 'next') game.setScene('play', { chapter: Math.min(C.chapters.length, self.chapter + 1) });
        else game.setScene('map', {});
      };
      if (needAd) E.sdk.showInterstitial(function () { go(); });
      else go();
    },

    /* ---------- события боя ---------- */
    sfx: function (name, gap) {
      var last = this.sfxT[name] == null ? -9 : this.sfxT[name];
      if (this.t - last < (gap == null ? 0.09 : gap)) return;
      this.sfxT[name] = this.t;
      E.audio.sfx(name);
    },
    floater: function (x, y, text, color, size) {
      if (this.floaters.length > 26) this.floaters.shift();
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color, size: size || 12 });
    },
    processEvents: function () {
      var ev = L.takeEvents(this.st);
      for (var i = 0; i < ev.length; i++) {
        var e = ev[i];
        if (e.type === 'shot') {
          var k = e.k;
          this.sfx(k === 'saw' ? 'hit' : (k === 'shock' ? 'pulse' : (k === 'grenade' ? 'explode' : 'shoot')),
            k === 'mg' ? 0.11 : (k === 'grenade' ? 0.5 : 0.2));
        } else if (e.type === 'kill') {
          this.sfx('crunch', 0.07);
          var p = this.zpos(e.lane, e.d);
          E.fx.burst(p.x, p.y, e.boss ? '#ff5c4d' : '#9ef05c', e.boss ? 18 : 7, e.boss ? 240 : 130, this.st.rng);
          E.fx.burst(p.x, p.y, '#f0c14b', 3, 90, this.st.rng);
          if (e.boss) this.floater(p.x, p.y - 20, '+' + e.gain, '#f0c14b', 16);
        } else if (e.type === 'hurt') {
          this.sfx('hit', 0.12);
          E.fx.shake(e.boss ? 7 : 3.5, 0.18);
          if (e.dmg > 0) {
            E.fx.flash('#e05a4f', 0.10);
            this.floater(this.Lt.W / 2, this.Lt.hudH + 46, '-' + Math.round(e.dmg), '#ff8a7a', 14);
          }
        } else if (e.type === 'wave') {
          this.sfx('horn', 0.5);
          this.bannerT = 1.6;
          this.bannerText = L.isBossWave(this.st) ? T('boss_appears') : T('wave_n', { n: this.st.wave + 1, total: L.waveTotal });
          this.bannerSub = '';
        } else if (e.type === 'boss') {
          E.audio.sfx('pulse');
        } else if (e.type === 'clear') {
          this.sfx('wave', 0.4);
          this.bannerT = 1.5;
          this.bannerText = T('wave_clear');
          this.bannerSub = e.bonus ? T('no_damage', { n: e.bonus }) : '';
          for (var c = 0; c < 16; c++) {
            E.fx.spawn(this.Lt.W * 0.5 + (this.st.rng.float() - 0.5) * 240, this.Lt.gy + this.Lt.gh * 0.3,
              { vx: (this.st.rng.float() - 0.5) * 200, vy: -80 - this.st.rng.float() * 180,
                life: 0.7 + this.st.rng.float() * 0.5, size: 2 + this.st.rng.float() * 3, color: '#f0c14b', grav: 500 });
          }
        } else if (e.type === 'perk') {
          var pd = this.perkDef(e.id);
          this.sfx('buy', 0.2);
          if (pd) this.toast = { t: 2.2, text: T('perk_picked', { name: T(pd.name) }) };
        } else if (e.type === 'build') {
          this.sfx('click', 0.12);
        } else if (e.type === 'remove' || e.type === 'move') {
          this.sfx('click', 0.08);
        } else if (e.type === 'upgrade' || e.type === 'repair') {
          this.sfx('buy', 0.2);
        }
      }
    },

    /* ---------- главный шаг ---------- */
    update: function (game, dt) {
      this.t += dt;
      if (E.capture && E.capture.tickRecording) E.capture.tickRecording(dt);
      var i;
      for (i = this.floaters.length - 1; i >= 0; i--) {
        this.floaters[i].t += dt;
        if (this.floaters[i].t > 1.0) this.floaters.splice(i, 1);
      }
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      if (this.bannerT > 0) this.bannerT -= dt;
      if (this.selPulse > 0) this.selPulse -= dt;

      // кошелёк синхронизуем не чаще двух раз в секунду
      this.coinSyncT += dt;
      if (this.st && this.st.coins !== this.lastCoins && this.coinSyncT >= 0.5) {
        this.lastCoins = this.st.coins;
        this.coinSyncT = 0;
        Meta.setCoins(this.st.coins);
        if (this.st.phase === 'build') this.buildPanel(game);
      }

      var Ptr = E.input.pointer;

      if (E.input.wasPressed('Escape')) {
        if (this.mode === 'paused') { this.setPaused(false, game); return; }
        if (this.mode === 'running') { this.setPaused(true, game); return; }
      }

      if (this.mode === 'paused' || this.mode === 'win' || this.mode === 'over') {
        if (Ptr.pressed) E.ui.handleTap(this.endButtons, Ptr.x, Ptr.y);
        // автопилот сам листает дальше, кадр не замирает на оверлее
        if (this.autopilot || this.captureMode) {
          this.autoT += dt;
          if (this.autoT > 1.6) {
            this.autoT = 0;
            if (this.mode === 'win') game.setScene('play', { chapter: Math.min(C.chapters.length, this.chapter + 1) });
            else if (this.mode === 'over') game.setScene('play', { chapter: this.chapter });
          }
        }
        return;
      }

      if (this.mode === 'shop') {
        if (Ptr.pressed) {
          if (E.ui.handleTap(this.buttons, Ptr.x, Ptr.y)) return;
          E.ui.handleTap(this.panelButtons, Ptr.x, Ptr.y);
        }
        return;
      }

      // фаза «волна отбита»
      if (this.st.phase === 'clear') {
        this.clearT += dt;
        if (this.clearT > 1.1) {
          this.clearT = 0;
          L.nextWave(this.st);
          this.autoBuilt = false;
          this.selected = null; this.pending = null;
          this.buildPanel(game);
          if (this.autopilot && this.st.phase === 'build') this.st.buildT = 2.2;
        }
      }

      if (this.autopilot) this.autoTick(dt);
      L.update(this.st, dt);
      if (this.st.phase !== this.lastPhase) {
        this.lastPhase = this.st.phase;
        this.selected = null; this.pending = null;
        this.buildPanel(game);
      }
      this.processEvents();

      if (this.st.phase === 'win') { this.onWin(game, false); return; }
      if (this.st.phase === 'over') { this.onLose(game); return; }

      // ввод
      if (Ptr.pressed) {
        if (E.ui.handleTap(this.buttons, Ptr.x, Ptr.y)) return;
        if (this.st.phase === 'build' && E.ui.handleTap(this.panelButtons, Ptr.x, Ptr.y)) return;
        var idx = this.cellAt(Ptr.x, Ptr.y);
        if (idx >= 0 && this.st.phase === 'build') {
          this.selected = idx;
          this.selPulse = 0.4;
          if (this.pending) this.placeSelected(game);
          else this.buildPanel(game);
          var t0 = this.st.layout[idx];
          this.drag = t0 ? { from: idx, sx: Ptr.x, sy: Ptr.y, moved: false, over: idx } : null;
        } else if (idx < 0) {
          this.selected = null;
          this.pending = null;
          this.buildPanel(game);
        }
      }
      if (this.drag) {
        var dg = this.drag;
        if (Ptr.down) {
          if (Math.abs(Ptr.x - dg.sx) + Math.abs(Ptr.y - dg.sy) > 10) dg.moved = true;
          var over = this.cellAt(Ptr.x, Ptr.y);
          dg.over = over;
        }
        if (Ptr.released) {
          if (dg.moved && dg.over >= 0 && dg.over !== dg.from && !this.st.layout[dg.over]) {
            if (L.moveItem(this.st, dg.from, dg.over)) {
              Meta.saveLayout(this.st.layout);
              this.selected = dg.over;
              E.audio.sfx('click');
              this.buildPanel(game);
            }
          }
          this.drag = null;
        }
      }
    },

    autoTick: function (dt) {
      var st = this.st;
      if (st.phase === 'build') {
        if (st.perkChoices && st.perkChoices.length) {
          this.autoT += dt;
          if (this.autoT > 0.25) { this.autoT = 0; L.applyPerk(st, st.perkChoices[0]); this.buildPanel(this.game); }
        } else if (!this.autoBuilt) {
          this.autoBuilt = true;
          L.autoBuild(st, { level: this.chapter >= 9 ? 3 : (this.chapter >= 6 ? 2 : 1), blocks: 6 });
          Meta.setCoins(st.coins);
          this.buildPanel(this.game);
        }
        if (st.buildT > 1.4) st.buildT = 1.4;
      } else if (st.phase === 'clear') {
        this.autoT += dt;
        if (this.autoT > 0.8) { this.autoT = 0; this.clearT = 2; }
      }
    },

    /* ---------- capture ---------- */
    applyCapture: function (game) {
      var cp = E.capture.params || {};
      this.captureMode = true;
      this.st.recordSafe = true;
      this.st.coins = Math.max(5000, this.st.coins);
      L.autoBuild(this.st, { level: this.chapter >= 9 ? 3 : (this.chapter >= 6 ? 2 : 1), blocks: 6 });
      this.st.coins = 480;
      var mode = cp.mode;
      if (mode === 'boss') {
        this.st.wave = C.waves;
        this.st.phase = 'build';
        this.forceCombat();
        var tb = clamp(parseFloat(cp.t) || 14, 1, 24);
        L.simulate(this.st, tb);
        this.forceCombat();
        this.mode = 'running';
      } else if (mode === 'perk') {
        this.st.wave = 2;
        this.st.phase = 'build';
        this.st.buildT = C.buildTime;
        this.st.holdBuild = true;
        L.rollPerks(this.st);
        this.mode = 'shop';
        this.panel = 'shop';
        this.selected = null;
      } else if (mode === 'shop') {
        this.st.phase = 'build';
        this.st.holdBuild = true;
        this.mode = 'shop';
        this.panel = 'shop';
        this.selected = L.idx(4, 1);
        this.pending = null;
      } else if (mode === 'over') {
        this.st.phase = 'over';
        this.st.hp = 0;
        this.mode = 'over';
        this.result = { win: false };
      } else if (mode === 'win') {
        this.st.phase = 'win';
        this.onWin(game, true);
        this.captureMode = true;
      } else {
        this.forceCombat();
        var t = clamp(parseFloat(cp.t) || 12, 1, 24);
        L.simulate(this.st, t);
        this.forceCombat();
        this.mode = 'running';
      }
      this.layout(game);
      this.buildPanel(game);
      this.buildEnd(game);
      this.lastCoins = this.st.coins;
    },
    forceCombat: function () {
      var st = this.st;
      for (var guard = 0; guard < 4; guard++) {
        if (st.phase === 'combat') { st.recordSafe = true; st.hp = Math.max(st.hp, st.maxHp * 0.25); return; }
        if (st.phase === 'clear') { st.phase = 'build'; }
        if (st.phase === 'build') {
          st.hp = Math.max(st.hp, st.maxHp * 0.5);
          L.startWave(st);
          st.recordSafe = true;
          if (st.phase === 'combat') return;
        }
        if (st.phase === 'over' || st.phase === 'win') {
          st.hp = Math.max(1, st.maxHp * 0.4);
          st.phase = 'build';
        }
      }
    },
    setCaptureState: function (game, s) {
      s = s || {};
      if (s.mode === 'shop') this.openShop(game);
      else if (s.mode === 'over') {
        this.st.phase = 'over'; this.st.hp = 0; this.mode = 'over'; this.buildEnd(game);
      } else if (s.mode === 'win') {
        this.st.phase = 'win'; this.onWin(game, true); this.captureMode = true; this.buildEnd(game);
      }
      if (s.chapter) {
        this.chapter = clamp(s.chapter, 1, C.chapters.length);
      }
    },
    openShop: function (game) {
      this.st.phase = 'build';
      this.st.holdBuild = true;
      this.mode = 'shop';
      this.panel = 'shop';
      this.selected = L.idx(4, 1);
      this.buildPanel(game);
    },
    getCaptureState: function () {
      return {
        scene: 'play', mode: this.mode, chapter: this.chapter,
        phase: this.st ? this.st.phase : '', wave: this.st ? this.st.wave : 0,
        hp: this.st ? Math.round(this.st.hp) : 0
      };
    },

    /* ================= отрисовка ================= */
    drawBg: function (ctx) {
      var Lt = this.Lt, s = Math.min(Lt.cw, Lt.ch);
      A.sky(ctx, Lt.W, Lt.H, this.t, this.chapter);
      if (Lt.portrait) {
        var roadX = Lt.gx - Lt.cw * 0.5, roadW = Lt.gw + Lt.cw;
        A.skyline(ctx, Lt.W, Lt.H, Lt.top + 12, 71 + this.chapter, 0.55);
        A.road(ctx, roadX, Lt.top, roadW, Lt.panelTop - Lt.top, true,
          [Lt.gx + Lt.cw, Lt.gx + 2 * Lt.cw], 21 + this.chapter);
        A.sideCity(ctx, 0, Lt.top, Math.max(0, roadX), Lt.panelTop - Lt.top, 31 + this.chapter, false);
        A.sideCity(ctx, roadX + roadW, Lt.top, Math.max(0, Lt.W - roadX - roadW), Lt.panelTop - Lt.top, 41 + this.chapter, true);
        // реквизит по краям улицы
        A.puddle(ctx, roadX + roadW * 0.30, Lt.gy - Lt.ch * 2.2, roadW * 0.12, s * 0.16);
        A.puddle(ctx, roadX + roadW * 0.74, Lt.gy - Lt.ch * 4.1, roadW * 0.10, s * 0.14);
        A.lamp(ctx, roadX + 8, Lt.gy - Lt.ch * 2.6, s * 0.13, false);
        A.lamp(ctx, roadX + roadW - 8, Lt.gy - Lt.ch * 4.6, s * 0.12, true);
        A.wreck(ctx, roadX + s * 0.25, Lt.gy - Lt.ch * 5.6, s * 0.22, false);
        A.wreck(ctx, roadX + roadW - s * 0.25, Lt.gy - Lt.ch * 1.5, s * 0.20, true);
        A.barrier(ctx, roadX + roadW * 0.5, Lt.gy - Lt.ch * 0.4, s * 0.22);
      } else {
        var roadTop = Lt.gy - Lt.ch * 0.62;
        A.skyline(ctx, Lt.W, Lt.H, roadTop + 2, 71 + this.chapter, 0.9);
        A.road(ctx, 0, roadTop, Lt.W, Lt.panelTop - roadTop, false,
          [Lt.gy + Lt.ch, Lt.gy + 2 * Lt.ch], 21 + this.chapter);
        // реквизит вдоль бордюров
        A.puddle(ctx, Lt.W * 0.60, roadTop + Lt.ch * 0.55, Lt.cw * 0.55, s * 0.10);
        A.puddle(ctx, Lt.W * 0.83, Lt.panelTop - Lt.ch * 0.55, Lt.cw * 0.45, s * 0.09);
        A.lamp(ctx, Lt.W * 0.30, roadTop + 6, s * 0.16, false);
        A.lamp(ctx, Lt.W * 0.72, Lt.panelTop - 6, s * 0.14, true);
        A.wreck(ctx, Lt.W * 0.55, roadTop + s * 0.34, s * 0.26, false);
        A.wreck(ctx, Lt.W * 0.86, Lt.panelTop - s * 0.30, s * 0.28, true);
        A.barrier(ctx, Lt.W * 0.46, Lt.panelTop - s * 0.34, s * 0.22);
        A.barrier(ctx, Lt.W * 0.93, roadTop + s * 0.40, s * 0.20);
      }
      // дымка у линии, из которой выходят зомби
      if (Lt.portrait) {
        var fh = Math.max(60, (Lt.gy - Lt.top) * 0.24);
        var fg = ctx.createLinearGradient(0, Lt.top, 0, Lt.top + fh);
        fg.addColorStop(0, 'rgba(10,13,18,0.92)');
        fg.addColorStop(1, 'rgba(10,13,18,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(Lt.gx - Lt.cw, Lt.top, Lt.gw + Lt.cw * 2, fh);
      } else {
        var roadTop2 = Lt.gy - Lt.ch * 0.62;
        var fw = Math.max(120, Lt.W * 0.2);
        var fg2 = ctx.createLinearGradient(Lt.W, 0, Lt.W - fw, 0);
        fg2.addColorStop(0, 'rgba(10,13,18,0.92)');
        fg2.addColorStop(1, 'rgba(10,13,18,0)');
        ctx.fillStyle = fg2;
        ctx.fillRect(Lt.W - fw, roadTop2, fw, Lt.panelTop - roadTop2);
      }
    },

    drawFort: function (ctx) {
      var Lt = this.Lt, t = this.t;
      var th = Math.max(7, Math.min(Lt.cw, Lt.ch) * 0.16);
      var gx = Lt.gx, gy = Lt.gy, gw = Lt.gw, gh = Lt.gh;
      // гусеницы
      if (Lt.portrait) {
        A.treads(ctx, gx - th, gy - 6, th, gh + 12, true, t);
        A.treads(ctx, gx + gw, gy - 6, th, gh + 12, true, t);
      } else {
        A.treads(ctx, gx - 6, gy - th, gw + 12, th, false, t);
        A.treads(ctx, gx - 6, gy + gh, gw + 12, th, false, t);
      }
      // корпус
      var g = ctx.createLinearGradient(gx, gy, gx, gy + gh);
      g.addColorStop(0, '#39424d'); g.addColorStop(0.5, '#2b323b'); g.addColorStop(1, '#20262d');
      E.ui.roundRect(ctx, gx - 2, gy - 2, gw + 4, gh + 4, 7);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(10,13,17,0.8)'; ctx.stroke();

      // клетки
      for (var i = 0; i < L.N; i++) {
        var r = this.cellRect(i);
        var it = this.st.layout[i];
        var inset = Math.max(1.5, Math.min(r.w, r.h) * 0.035);
        if (!it) {
          E.ui.roundRect(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, Math.min(r.w, r.h) * 0.10);
          ctx.fillStyle = '#1a1f26'; ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,132,148,0.16)'; ctx.stroke();
          if (this.st.phase === 'build') {
            // «сюда можно ставить»: тонкий пунктир и плюс
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(240,193,75,0.22)';
            ctx.lineWidth = 1;
            E.ui.roundRect(ctx, r.x + inset + 2, r.y + inset + 2, r.w - inset * 2 - 4, r.h - inset * 2 - 4, Math.min(r.w, r.h) * 0.08);
            ctx.stroke();
            ctx.restore();
            var pc = Math.max(4, Math.min(r.w, r.h) * 0.10);
            ctx.strokeStyle = 'rgba(240,193,75,0.30)';
            ctx.lineWidth = Math.max(1.5, pc * 0.24);
            ctx.beginPath();
            ctx.moveTo(r.x + r.w / 2 - pc, r.y + r.h / 2);
            ctx.lineTo(r.x + r.w / 2 + pc, r.y + r.h / 2);
            ctx.moveTo(r.x + r.w / 2, r.y + r.h / 2 - pc);
            ctx.lineTo(r.x + r.w / 2, r.y + r.h / 2 + pc);
            ctx.stroke();
          }
        } else if (it.k === 'b') {
          A.block(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, i);
        } else {
          var def = L.weapon(it.t);
          var size = Math.min(r.w, r.h) * 0.92;
          E.ui.roundRect(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, Math.min(r.w, r.h) * 0.10);
          ctx.fillStyle = 'rgba(20,25,31,0.6)'; ctx.fill();
          A.weapon(ctx, it.t, r.x + r.w / 2, r.y + r.h / 2, size,
            { angle: Lt.portrait ? -Math.PI / 2 : 0, level: it.lvl, t: t, alpha: 1 });
          if (def) {
            var row = L.rowOf(i);
            if (row < def.rows[0] || row > def.rows[1]) {
              E.ui.roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, Math.min(r.w, r.h) * 0.10);
              ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(224,90,79,0.85)'; ctx.stroke();
              var bx = r.x + r.w - Math.max(8, r.w * 0.18), by = r.y + Math.max(8, r.h * 0.18);
              ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.max(7, r.w * 0.13), by + Math.max(7, r.w * 0.13));
              ctx.lineTo(bx, by + Math.max(14, r.w * 0.26)); ctx.closePath();
              ctx.fillStyle = 'rgba(224,90,79,0.9)'; ctx.fill();
            }
          }
        }
        // подсветка пустых клеток под установку
        if (this.st.phase === 'build' && !it) {
          var valid = true;
          if (this.pending && this.pending !== 'block') {
            var pd = L.weapon(this.pending);
            var pr = L.rowOf(i);
            valid = pd && pr >= pd.rows[0] && pr <= pd.rows[1];
          }
          if (this.pending) {
            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = valid ? P.toxic : '#e05a4f';
            E.ui.roundRect(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, Math.min(r.w, r.h) * 0.1);
            ctx.fill();
            ctx.restore();
          }
        }
        // выделение
        if (this.selected === i) {
          var pulse = 0.65 + Math.sin(this.t * 7) * 0.25 + (this.selPulse > 0 ? 0.4 : 0);
          ctx.save();
          ctx.globalAlpha = Math.min(1, pulse);
          ctx.lineWidth = 2.5; ctx.strokeStyle = P.hazard;
          E.ui.roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, Math.min(r.w, r.h) * 0.12);
          ctx.stroke();
          ctx.restore();
        }
      }

      // таран впереди
      if (!Lt.portrait) {
        var rw = Math.max(9, Lt.cw * 0.30);
        ctx.fillStyle = '#3b434e';
        ctx.beginPath();
        ctx.moveTo(Lt.frontX - 2, gy - 5);
        ctx.lineTo(Lt.frontX + rw, gy + gh * 0.24);
        ctx.lineTo(Lt.frontX + rw, gy + gh * 0.76);
        ctx.lineTo(Lt.frontX - 2, gy + gh + 5);
        ctx.closePath(); ctx.fill();
        drawStripe(ctx, Lt.frontX - 2, gy + gh * 0.24, rw, gh * 0.52, 0.55);
      } else {
        var rh = Math.max(9, Lt.ch * 0.30);
        ctx.fillStyle = '#3b434e';
        ctx.beginPath();
        ctx.moveTo(gx - 5, gy + 2);
        ctx.lineTo(gx + gw * 0.24, gy - rh);
        ctx.lineTo(gx + gw * 0.76, gy - rh);
        ctx.lineTo(gx + gw + 5, gy + 2);
        ctx.closePath(); ctx.fill();
        drawStripe(ctx, gx + gw * 0.24, gy - rh, gw * 0.52, rh, 0.55);
      }

      // двигатель сзади + дым
      if (!Lt.portrait) {
        ctx.fillStyle = '#2a3038';
        E.ui.roundRect(ctx, gx - Math.max(8, Lt.cw * 0.18), gy + 4, Math.max(10, Lt.cw * 0.2), gh - 8, 4);
        ctx.fill();
        for (var p = 0; p < 3; p++) {
          var pk = (this.t * 0.5 + p * 0.33) % 1;
          ctx.globalAlpha = 0.25 * (1 - pk);
          ctx.fillStyle = '#8b8f98';
          ctx.beginPath();
          ctx.arc(gx - Math.max(8, Lt.cw * 0.18) - pk * Math.max(16, Lt.cw * 0.5), gy + gh * 0.3 - pk * 18,
            Math.max(3, Lt.cw * 0.07) * (1 + pk), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#2a3038';
        E.ui.roundRect(ctx, gx + 4, gy + gh - 2, gw - 8, Math.max(10, Lt.ch * 0.16), 4);
        ctx.fill();
        for (var q = 0; q < 3; q++) {
          var qk = (this.t * 0.5 + q * 0.33) % 1;
          ctx.globalAlpha = 0.2 * (1 - qk);
          ctx.fillStyle = '#8b8f98';
          ctx.beginPath();
          ctx.arc(gx + gw * 0.35 + qk * 30, gy + gh + qk * 26, 4 * (1 + qk), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },

    drawShots: function (ctx) {
      var Lt = this.Lt;
      for (var i = 0; i < this.st.shots.length; i++) {
        var s = this.st.shots[i];
        var from = this.cellCenter(L.idx(s.r, s.l));
        var k = clamp(s.t / s.life, 0, 1), a = 1 - k;
        if (!s.z.length) continue;
        if (s.k === 'laser' || s.k === 'mg' || s.k === 'saw') {
          var far = s.z[0], fd = far.d;
          for (var j = 1; j < s.z.length; j++) if (s.z[j].d > fd) fd = s.z[j].d;
          var to = this.zpos(s.l, fd);
          ctx.save();
          ctx.globalAlpha = a * (s.k === 'laser' ? 0.95 : 0.75);
          if (s.k === 'laser') {
            ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = Math.max(2, Lt.cw * 0.1);
            ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
            ctx.strokeStyle = '#ffe3e9'; ctx.lineWidth = Math.max(1, Lt.cw * 0.035);
            ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
          } else if (s.k === 'mg') {
            ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(1.2, Lt.cw * 0.03);
            ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
            ctx.fillStyle = '#fff3c4';
            ctx.beginPath(); ctx.arc(to.x, to.y, Math.max(1.5, Lt.cw * 0.04), 0, Math.PI * 2); ctx.fill();
          } else {
            // пила: искры вдоль линии
            ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = Math.max(1, Lt.cw * 0.02);
            for (var sp = 0; sp < 5; sp++) {
              var f = (sp / 5 + k * 0.4) % 1;
              var sx = lerp(from.x, to.x, f), sy = lerp(from.y, to.y, f);
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(sx + Math.sin(sp * 9 + this.t * 20) * 6, sy + Math.cos(sp * 7 + this.t * 17) * 6);
              ctx.stroke();
            }
          }
          ctx.restore();
        } else if (s.k === 'shock') {
          ctx.save();
          ctx.globalAlpha = a * 0.95;
          ctx.strokeStyle = '#9fe6ff';
          ctx.lineWidth = Math.max(1.5, Lt.cw * 0.035);
          var px = from.x, py = from.y;
          for (var q = 0; q < s.z.length; q++) {
            var tp = this.zpos(s.z[q].lane, s.z[q].d);
            var seg = 6;
            ctx.beginPath(); ctx.moveTo(px, py);
            for (var m = 1; m <= seg; m++) {
              var f2 = m / seg;
              var jx = Math.sin(m * 7 + q * 5) * Lt.cw * 0.12;
              var jy = Math.cos(m * 5 + q * 3) * Lt.cw * 0.12;
              if (m === seg) { jx = 0; jy = 0; }
              ctx.lineTo(lerp(px, tp.x, f2) + jx, lerp(py, tp.y, f2) + jy);
            }
            ctx.stroke();
            px = tp.x; py = tp.y;
          }
          ctx.restore();
        } else if (s.k === 'flame') {
          var farT = s.z[0];
          for (var z2 = 1; z2 < s.z.length; z2++) if (s.z[z2].d > farT.d) farT = s.z[z2];
          var tp2 = this.zpos(s.l, farT.d);
          var ang = Math.atan2(tp2.y - from.y, tp2.x - from.x);
          var len = Math.hypot(tp2.x - from.x, tp2.y - from.y);
          ctx.save();
          ctx.globalAlpha = a * 0.55;
          var grad = ctx.createLinearGradient(from.x, from.y, tp2.x, tp2.y);
          grad.addColorStop(0, 'rgba(255,220,120,0.95)');
          grad.addColorStop(0.55, 'rgba(255,138,61,0.55)');
          grad.addColorStop(1, 'rgba(255,80,20,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(from.x + Math.cos(ang - 0.32) * (len + Lt.cw * 0.4), from.y + Math.sin(ang - 0.32) * (len + Lt.cw * 0.4));
          ctx.lineTo(from.x + Math.cos(ang + 0.32) * (len + Lt.cw * 0.4), from.y + Math.sin(ang + 0.32) * (len + Lt.cw * 0.4));
          ctx.closePath(); ctx.fill();
          ctx.restore();
        } else if (s.k === 'grenade') {
          var gt = this.zpos(s.z[0].lane, s.z[0].d);
          ctx.save();
          ctx.globalAlpha = a * 0.8;
          ctx.strokeStyle = '#b8e06a'; ctx.lineWidth = Math.max(1.5, Lt.cw * 0.03);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          var mx = (from.x + gt.x) / 2, my = (from.y + gt.y) / 2 - Lt.cw * 0.5;
          ctx.quadraticCurveTo(mx, my, gt.x, gt.y);
          ctx.stroke();
          if (k > 0.45) {
            var rk = (k - 0.45) / 0.55;
            var rg = ctx.createRadialGradient(gt.x, gt.y, 1, gt.x, gt.y, Lt.cw * (0.4 + rk * 1.4));
            rg.addColorStop(0, 'rgba(255,240,180,' + (0.85 * (1 - rk)) + ')');
            rg.addColorStop(0.5, 'rgba(255,150,50,' + (0.5 * (1 - rk)) + ')');
            rg.addColorStop(1, 'rgba(255,80,20,0)');
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(gt.x, gt.y, Lt.cw * (0.4 + rk * 1.4), 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }
    },

    drawZombies: function (ctx) {
      var Lt = this.Lt;
      var zs = this.st.zombies.slice();
      zs.sort(function (a, b) { return b.d - a.d; });
      for (var i = 0; i < zs.length; i++) {
        var z = zs[i];
        var p = this.zpos(z.lane, z.d);
        var def = C.zombies[z.type] || C.zombies.walker;
        var size = Math.min(Lt.cw, Lt.ch) * 1.85 * (z.boss ? z.r : def.r);
        A.zombie(ctx, z.type, p.x, p.y, size, z.t, {
          air: z.air, boss: z.boss, bossId: z.bossId, dead: z.dead, deathT: z.deathT,
          flip: !Lt.portrait, eye: z.boss ? '#ff5c4d' : def.eye,
          hpRatio: z.dead ? null : Math.max(0, z.hp / z.maxHp), flash: z.flash > 0
        });
      }
    },

    drawHud: function (ctx) {
      var Lt = this.Lt, W = Lt.W, st = this.st;
      // затемнение под HUD — текст читается поверх любого силуэта
      var hs = ctx.createLinearGradient(0, 0, 0, Lt.hudH + 18);
      hs.addColorStop(0, 'rgba(8,11,15,0.90)');
      hs.addColorStop(0.65, 'rgba(8,11,15,0.58)');
      hs.addColorStop(1, 'rgba(8,11,15,0)');
      ctx.fillStyle = hs;
      ctx.fillRect(0, 0, W, Lt.hudH + 18);
      var midY = Lt.portrait ? 22 : Lt.hudH / 2;
      // прочность
      var hpR = st.hp / Math.max(1, st.maxHp);
      A.shield(ctx, 20, midY, 22, hpR, '#3a4654');
      var bw = Math.min(140, W * 0.33);
      ctx.fillStyle = 'rgba(8,11,15,0.7)';
      E.ui.roundRect(ctx, 34, midY - 9, bw, 18, 9); ctx.fill();
      ctx.fillStyle = hpR > 0.5 ? '#6ee07a' : (hpR > 0.25 ? '#f0c14b' : '#e05a4f');
      E.ui.roundRect(ctx, 36, midY - 7, Math.max(2, (bw - 4) * hpR), 14, 7); ctx.fill();
      E.ui.text(ctx, Math.ceil(st.hp) + '/' + st.maxHp, 34 + bw / 2, midY + 0.5, 12, 'rgba(10,13,17,0.95)', 'center', 800);

      // монеты
      var cbW = 88, cbH = 30;
      var cbX = (this.pauseBtn ? this.pauseBtn.x : W - 48) - cbW - 8;
      var cbY = (this.pauseBtn ? this.pauseBtn.y : 8) + 5;
      pill(ctx, cbX, cbY, cbW, cbH, 'rgba(8,11,15,0.62)', 'rgba(240,193,75,0.35)');
      A.coin(ctx, cbX + 16, cbY + cbH / 2, 9);
      E.ui.text(ctx, String(Math.round(st.coins)), cbX + 30, cbY + cbH / 2 + 1, 15, P.gold, 'left', 700);

      // волна / сборка
      var label;
      if (st.phase === 'build') label = T('build') + ' · ' + T('seconds_n', { n: Math.ceil(st.buildT) });
      else if (L.isBossWave(st)) label = T('boss_wave');
      else label = T('wave_n', { n: st.wave + 1, total: L.waveTotal });
      var wy = Lt.portrait ? Lt.hudH - 14 : Lt.hudH / 2;
      var ws = Math.min(W * 0.038, 14);
      E.ui.text(ctx, label, W * (Lt.portrait ? 0.5 : 0.5), wy, ws, st.phase === 'build' ? P.hazard : P.cream, 'center', 700);

      // полоса босса
      var b = st.bossRef;
      if (b && !b.dead) {
        var bd = C.bosses[b.bossId];
        var by = Lt.hudH + 4;
        E.ui.text(ctx, T(BOSS_NAME[b.bossId] || 'boss'), 14, by + 8, Math.min(W * 0.035, 13), '#ffb3a8', 'left', 700);
        var bx = 14, bw2 = W - 28, bh2 = 10;
        ctx.fillStyle = 'rgba(8,11,15,0.75)';
        E.ui.roundRect(ctx, bx, by + 16, bw2, bh2, 5); ctx.fill();
        ctx.fillStyle = '#c0392b';
        E.ui.roundRect(ctx, bx + 1, by + 17, Math.max(2, (bw2 - 2) * clamp(b.hp / b.maxHp, 0, 1)), bh2 - 2, 4); ctx.fill();
        if (b.maxShield > 0) {
          E.ui.text(ctx, T('shield_hp'), bx + 4, by + 22, 12, '#cfe8ff', 'left', 700);
          var sw = (bw2 - 8) * clamp(b.shield / b.maxShield, 0, 1);
          ctx.fillStyle = '#6fd3ff';
          ctx.fillRect(bx + 4, by + 28, sw, 4);
        }
      }
    },

    drawPanel: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      var top = Lt.panelTop;
      var g = ctx.createLinearGradient(0, top, 0, Lt.H);
      g.addColorStop(0, '#242b34'); g.addColorStop(1, '#151a20');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W, Lt.H - top);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, top, W, 2);
      if (this.st.phase === 'build') drawStripe(ctx, 0, top + 2, W, 3, 0.7);

      var hy = top + 8, hh = 44;
      var minX = W - 10;
      for (var i = 0; i < this.panelButtons.length; i++) {
        var b = this.panelButtons[i];
        if (b.y === hy && b.x < minX) minX = b.x;
      }
      if (this.st.phase === 'build') {
        if (!(this.st.perkChoices && this.st.perkChoices.length)) {
          var info = this.panelInfo();
          var maxW = minX - 12 - 10;
          var fs = E.ui.fit(ctx, info, Math.max(40, maxW), Math.min(15, hh * 0.34), 600);
          E.ui.text(ctx, info, 12, hy + hh / 2, fs, this.pending ? P.toxic : P.cream, 'left', 600);
        }
      } else {
        // во время боя панель — табло волны
        var st = this.st;
        var cx = W / 2;
        var cyc = top + Lt.panelH * 0.42;
        var label = L.isBossWave(st) ? T('boss_wave') : T('wave_n', { n: st.wave + 1, total: L.waveTotal });
        E.ui.text(ctx, label, cx, cyc - 18, Math.min(20, Lt.panelH * 0.12), L.isBossWave(st) ? '#ff8a7a' : P.cream, 'center', 800);
        var aliveN = 0;
        for (var zz = 0; zz < st.zombies.length; zz++) if (!st.zombies[zz].dead) aliveN++;
        var leftN = aliveN + st.spawnQueue.length;
        E.ui.text(ctx, T('left_n', { n: leftN }), cx, cyc + 4, Math.min(12, Lt.panelH * 0.075), 'rgba(241,233,216,0.62)', 'center', 600);
        E.ui.text(ctx, T('kills_n', { n: st.kills }), cx, cyc + 25, 12, 'rgba(241,233,216,0.55)', 'center', 600);
        E.ui.text(ctx, T('tut_shoot'), cx, cyc + 46, 12, 'rgba(241,233,216,0.36)', 'center', 500);
        // вооружение крепости — заполняет нижнюю полосу панели и полезно
        var arm = {};
        for (var ai = 0; ai < L.N; ai++) {
          var ac = this.st.layout[ai];
          if (ac && ac.k === 'w') arm[ac.t] = (arm[ac.t] | 0) + 1;
        }
        var akeys = [];
        for (var ak in arm) akeys.push(ak);
        if (akeys.length && Lt.panelH > 120) {
          var aStep = Math.min(72, (W - 40) / akeys.length);
          var ax0 = cx - aStep * akeys.length / 2 + aStep / 2;
          var ay = top + Lt.panelH - 34;
          for (var ki = 0; ki < akeys.length; ki++) {
            A.weapon(ctx, akeys[ki], ax0 + ki * aStep - 10, ay, Math.min(20, aStep * 0.34), { alpha: 0.9 });
            E.ui.text(ctx, '×' + arm[akeys[ki]], ax0 + ki * aStep + 8, ay, 12, 'rgba(241,233,216,0.8)', 'left', 700);
          }
        }
        // точки-пипсы
        var n = L.waveTotal, pw = Math.min(16, (W - 40) / n - 6);
        for (var p = 0; p < n; p++) {
          var px = cx - (n * (pw + 6) - 6) / 2 + p * (pw + 6);
          ctx.fillStyle = p < st.wave ? 'rgba(158,240,92,0.55)' : (p === st.wave ? '#f0c14b' : 'rgba(120,132,148,0.25)');
          E.ui.roundRect(ctx, px, top + Lt.panelH - 14, pw, 5, 2); ctx.fill();
        }
      }

      if (this.st.phase === 'build' && (this.mode === 'running' || this.mode === 'shop')) E.ui.drawButtons(ctx, this.panelButtons);

      if (this.toast) {
        ctx.globalAlpha = Math.min(1, this.toast.t * 1.6);
        var tw = Math.min(320, W * 0.9);
        pill(ctx, W / 2 - tw / 2, top - 48, tw, 36, 'rgba(10,14,18,0.94)', 'rgba(240,193,75,0.45)');
        E.ui.text(ctx, this.toast.text, W / 2, top - 30, 12, P.cream, 'center', 600);
        ctx.globalAlpha = 1;
      }
    },

    drawBanner: function (ctx) {
      if (this.bannerT <= 0) return;
      var Lt = this.Lt, W = Lt.W;
      var k = this.bannerT > 1.2 ? (1.6 - this.bannerT) / 0.4 : Math.min(1, this.bannerT / 0.5);
      var a = Math.sin(clamp(k, 0, 1) * Math.PI * 0.5);
      var cy = (Lt.top + Lt.panelTop) / 2 - Lt.ch * 0.6;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,11,15,0.55)';
      E.ui.roundRect(ctx, W / 2 - Math.min(220, W * 0.7) / 2, cy - 26, Math.min(220, W * 0.7), 52, 10);
      ctx.fill();
      E.ui.text(ctx, this.bannerText, W / 2, cy - 4, Math.min(W * 0.065, 26), this.bannerText === T('boss_appears') ? '#ff8a7a' : P.hazard, 'center', 800);
      if (this.bannerSub) E.ui.text(ctx, this.bannerSub, W / 2, cy + 16, Math.min(W * 0.04, 13), P.toxic, 'center', 600);
      ctx.restore();
    },

    drawFloaters: function (ctx) {
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        var a = 1 - f.t / 1.0;
        ctx.globalAlpha = Math.max(0, a);
        E.ui.text(ctx, f.text, f.x, f.y - f.t * 28, f.size, f.color, 'center', 700);
      }
      ctx.globalAlpha = 1;
    },

    drawEnd: function (ctx) {
      if (this.mode === 'paused') this.drawPause(ctx);
      else if (this.mode === 'win') this.drawWin(ctx);
      else if (this.mode === 'over') this.drawOver(ctx);
    },
    _scrim: function (ctx, a) {
      ctx.fillStyle = 'rgba(6,9,13,' + a + ')';
      ctx.fillRect(0, 0, this.Lt.W, this.Lt.H);
    },
    _endTitle: function (ctx, title, sub, color, size, cy) {
      var W = this.Lt.W;
      E.ui.text(ctx, title, W / 2, cy, Math.min(W * 0.10, size), color, 'center', 800);
      if (sub) {
        var s = E.ui.fit(ctx, sub, W * 0.84, Math.min(W * 0.038, 15), 500);
        E.ui.text(ctx, sub, W / 2, cy + Math.max(26, size * 0.5), s, 'rgba(241,233,216,0.72)', 'center', 500);
      }
    },
    drawPause: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      this._scrim(ctx, 0.72);
      var top = (Lt.top + Lt.panelTop) / 2;
      var py = this.endButtons.length ? this.endButtons[0].y - 50 : top;
      E.ui.text(ctx, T('paused'), W / 2, Math.max(Lt.top + 28, py), Math.min(W * 0.09, 34), P.hazard, 'center', 800);
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawWin: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      this._scrim(ctx, 0.72);
      var top = (Lt.top + Lt.panelTop) / 2;
      if (this.endButtons.length) {
        var firstY = this.endButtons[0].y;
        var tY = Math.max(Lt.top + 34, firstY - 122);
        this._endTitle(ctx, T('win_title'), T('win_sub'), P.toxic, Math.min(W * 0.10, 40), tY);
        // что открылось
        var nextCh = C.chapters[Math.min(C.chapters.length - 1, this.chapter)];
        if (this.chapter < C.chapters.length && nextCh.weapon && C.weapons.length) {
          var wd = L.unlockChapter(nextCh.weapon) === nextCh.n ? nextCh.weapon : null;
          if (wd) E.ui.text(ctx, T('unlocked_weapon', { weapon: T(W_NAME[wd]) }), W / 2, tY + 58, Math.min(W * 0.036, 14), '#cfe8ff', 'center', 600);
        }
        // награда
        var rw = Math.min(240, W * 0.62);
        pill(ctx, W / 2 - rw / 2, firstY - 44, rw, 36, 'rgba(8,11,15,0.8)', 'rgba(240,193,75,0.4)');
        A.coin(ctx, W / 2 - rw / 2 + 24, firstY - 26, 10);
        E.ui.text(ctx, T('won_coins', { n: (this.doubled ? this.reward * 2 : this.reward) }), W / 2 + 8, firstY - 25, 16, P.gold, 'center', 700);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },
    drawOver: function (ctx) {
      var Lt = this.Lt, W = Lt.W;
      this._scrim(ctx, 0.72);
      if (this.endButtons.length) {
        var firstY = this.endButtons[0].y;
        var ty = Math.max(Lt.top + 44, firstY - 86);
        this._endTitle(ctx, T('lose_title'), T('lose_sub'), '#ff8a7a', Math.min(W * 0.095, 36), ty);
        E.ui.text(ctx, T('lose_wave', { w: Math.min(this.st.wave + 1, L.waveTotal), total: L.waveTotal }),
          W / 2, ty + 50, Math.min(W * 0.036, 14), 'rgba(241,233,216,0.75)', 'center', 600);
      }
      E.ui.drawButtons(ctx, this.endButtons);
    },

    drawPreview: function (ctx) {
      var Lt = this.Lt, st = this.st;
      if (st.phase !== 'build') return;
      var pv = L.previewWave(st);
      var W = Lt.W;
      var pw = Math.min(360, W * 0.68), ph = 34;
      var x = W / 2 - pw / 2, y = Lt.top + 8;
      pill(ctx, x, y, pw, ph, 'rgba(8,11,15,0.74)', 'rgba(240,193,75,0.28)');
      var label = (pv.boss ? T('boss_wave') : T('next_wave')) + ' · ' + pv.count;
      E.ui.text(ctx, label, x + 12, y + ph / 2, Math.min(12, W * 0.03), P.hazard, 'left', 700);
      var n = pv.types.length, isz = 24;
      var ix = x + pw - 10 - n * isz;
      for (var i = 0; i < n; i++) {
        var zd = C.zombies[pv.types[i]];
        A.zombie(ctx, pv.types[i], ix + i * isz + isz / 2, y + ph / 2 + 6, isz, 0, { flip: !Lt.portrait, eye: zd.eye, hpRatio: null });
      }
    },
    draw: function (game, ctx) {
      var Lt = this.Lt, st = this.st;
      this.drawBg(ctx);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawFort(ctx);
      this.drawShots(ctx);
      this.drawZombies(ctx);
      ctx.restore();

      E.fx.draw(ctx);
      this.drawFloaters(ctx);

      // низкий HP: красная пульсация по краю
      var hpR = st.hp / Math.max(1, st.maxHp);
      if (hpR < 0.3 && this.mode !== 'win' && this.mode !== 'over') {
        var pa = 0.18 + Math.sin(this.t * 5) * 0.08;
        var vg = ctx.createRadialGradient(Lt.W / 2, Lt.H / 2, Math.min(Lt.W, Lt.H) * 0.3, Lt.W / 2, Lt.H / 2, Math.max(Lt.W, Lt.H) * 0.7);
        vg.addColorStop(0, 'rgba(224,90,79,0)');
        vg.addColorStop(1, 'rgba(224,90,79,' + pa + ')');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, Lt.W, Lt.H);
      }

      if (st.phase === 'build' && st.perkChoices && st.perkChoices.length) {
        ctx.fillStyle = 'rgba(6,9,13,0.62)';
        ctx.fillRect(0, Lt.top, Lt.W, Lt.panelTop - Lt.top);
        E.ui.text(ctx, T('perk_title'), Lt.W / 2, Lt.top + 22, Math.min(Lt.W * 0.06, 24), P.hazard, 'center', 800);
      }
      this.drawHud(ctx);
      if (!(st.perkChoices && st.perkChoices.length)) this.drawPreview(ctx);
      E.ui.drawButtons(ctx, this.buttons);
      this.drawPanel(ctx);
      this.drawBanner(ctx);

      // подсказка новичка: пустая крепость в первой главе
      if (st.phase === 'build' && this.chapter === 1 && L.weaponCount(st.layout) === 0 && !this.captureMode) {
        var hy2 = Lt.gy - 18;
        ctx.save();
        ctx.globalAlpha = 0.9;
        pill(ctx, Lt.gx + Lt.gw / 2 - 110, hy2 - 16, 220, 32, 'rgba(10,14,18,0.9)', 'rgba(158,240,92,0.45)');
        E.ui.text(ctx, T('tut_build'), Lt.gx + Lt.gw / 2, hy2, 12, '#eaf6dc', 'center', 600);
        ctx.restore();
      }

      this.drawEnd(ctx);
      E.fx.drawFlash(ctx, Lt.W, Lt.H);
    }
  };

  G.scenes = S;
})(window.GAME);
