/* game/scenes.js — сцены menu и play «Сладкой Башни».
   Контракт с pipeline/capture-sweettower.mjs:
   - capture-параметры: wave=N = УРОВЕНЬ, t=SEC = прогон autopilot-симуляции,
     mode=shop|over|dead|revive = форсированный экран, freeze=1 — заморозка кадра.
   - Record-safe (?record/?autoplay): автопилот сам роняет слои почти идеально.
   - Стики-баннер — ТОЛЬКО вне геймплея (menu/over), в play его нет (4.6). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function i18n() { return E.i18n; }
  function T(k, v) { return E.i18n.t(k, v); }

  /* ---------- фон: закатное небо, кремовые облака, горошки ---------- */
  function makeClouds(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float() * 0.85, s: rng.range(0.05, 0.13),
               sp: rng.range(0.004, 0.012), a: rng.range(0.16, 0.4) });
    }
    return s;
  }
  function makeDots(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(1.2, 2.8),
               tw: rng.range(0.8, 2.2), ph: rng.angle(),
               hue: rng.pick(['#ffd43b', '#ff8fb3', '#9fe8c1', '#fff3d6', '#c74b71']) });
    }
    return s;
  }
  function drawBackground(game, ctx, clouds, dots, t) {
    var v = game.view, C = G.config.palette;
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, C.bg2); grd.addColorStop(0.55, C.bg); grd.addColorStop(1, '#1d1129');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    // луна-печенька
    var mx = v.w * 0.82, my = v.h * 0.14, mr = Math.min(v.w, v.h) * 0.075;
    var mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    mg.addColorStop(0, '#fff3d6'); mg.addColorStop(1, '#e8c88f');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(122,74,43,0.35)';
    ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.1, mr * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * 0.22, my + mr * 0.28, mr * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * 0.05, my - mr * 0.42, mr * 0.1, 0, Math.PI * 2); ctx.fill();
    // облака
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var cx = ((c.x + t * c.sp) % 1.3 - 0.15) * v.w;
      G.art.drawCreamCloud(ctx, cx, c.y * v.h, c.s * Math.min(v.w, v.h), c.a);
    }
    // светящиеся горошки-посыпки
    for (var d = 0; d < dots.length; d++) {
      var sp = dots[d];
      ctx.globalAlpha = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(t * sp.tw + sp.ph));
      ctx.fillStyle = sp.hue;
      ctx.beginPath(); ctx.arc(sp.x * v.w, sp.y * v.h, sp.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ========================================================= MENU */
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.t = 0;
      this.clouds = makeClouds(8, 3131);
      this.dots = makeDots(30, 555);
      this.layout(game);
    },
    exit: function () { E.sdk.hideBanner(); },
    onResize: function (game) { this.layout(game); },
    layout: function (game) {
      var v = game.view, w = v.w, h = v.h;
      var t = i18n();
      var inset = E.sdk.bannerInsetPx();
      var availH = h - inset;
      var k = clamp(availH / 560, 0.68, 1);
      var bw = Math.min(320, w * 0.78), bh = Math.round(58 * k), cx = w / 2;
      var rowH = Math.round(44 * k), rowGap = Math.round(12 * k);
      var best = E.storage.get('best', 0);
      this.best = best; this.k = k; this.inset = inset;

      this.titleY = availH * 0.1;
      this.towerY = availH * 0.72; // подошва витринной башни
      this.towerH = Math.min(availH * 0.34, 220);
      var contentTop = this.towerY + (best > 0 ? 24 * k : 14 * k);
      var hintH = Math.round(24 * k) + 8;
      var stackAvail = Math.max(40, availH - hintH - contentTop);

      var rows = [{ h: bh, gap: rowGap + 2 }, { h: rowH, gap: 0 }];
      var col = E.ui.layoutColumn(rows, stackAvail, { pad: 0, alignTop: true });
      var sc = col.scale;
      this.buttons = [];
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: contentTop + col.ys[0], w: bw, h: rows[0].h * sc,
        fontSize: Math.max(15, Math.round(26 * k * sc)), text: t.t('menu_play'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#ffffff',
        onTap: function () { E.audio.sfx('click'); game.setScene('play', {}); }
      }));
      var sw = Math.floor((bw - 24) / 3), fs = Math.max(10, Math.round(14 * k * sc));
      var yy = contentTop + col.ys[1];
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2, y: yy, w: sw, h: rowH * sc, fontSize: fs, id: 'snd',
        text: E.audio.isMuted() ? t.t('snd_off') : t.t('snd_on'),
        onTap: function (b) {
          var m = !E.audio.isMuted();
          E.audio.setMuted(m); E.storage.set('muted', m, true);
          b.text = m ? t.t('snd_off') : t.t('snd_on');
          E.audio.sfx('click');
        }
      }));
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + sw + 12, y: yy, w: sw, h: rowH * sc, fontSize: fs, id: 'lang',
        text: t.t('lang_btn'),
        onTap: function () {
          E.audio.sfx('click');
          var nl = E.i18n.lang === 'ru' ? 'en' : 'ru';
          E.i18n.setLang(nl); E.storage.set('lang', nl, true);
          document.title = i18n().t('title');
          MenuScene.layout(game);
        }
      }));
      var authOn = E.storage.authorized;
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + 2 * (sw + 12), y: yy, w: sw, h: rowH * sc,
        fontSize: Math.max(9, Math.round(11.5 * k * sc)), id: 'auth',
        text: authOn ? '' : t.t('menu_auth'),
        bg: authOn ? '#2f9e44' : '#fc5c7d',
        border: authOn ? '#237032' : '#c92a4f',
        icon: authOn ? function (ctx, b) {
          var cy = b.y + b.h / 2 + 1;
          var fs2 = Math.max(9, Math.round(11.5 * k * sc));
          ctx.font = '600 ' + fs2 + 'px system-ui, sans-serif';
          var tw = ctx.measureText(t.t('menu_auth_ok')).width;
          var x0 = b.x + (b.w - tw - fs2 * 0.9) / 2;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, fs2 * 0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(x0 + fs2 * 0.1, cy); ctx.lineTo(x0 + fs2 * 0.35, cy + fs2 * 0.26); ctx.lineTo(x0 + fs2 * 0.8, cy - fs2 * 0.3);
          ctx.stroke();
          E.ui.text(ctx, t.t('menu_auth_ok'), x0 + fs2 * 0.9 + tw / 2, cy, fs2, '#ffffff', 'center', 600);
        } : function (ctx, b) {
          var cy = b.y + b.h / 2 + 1;
          var fs2 = b.fontSize;
          ctx.font = '600 ' + fs2 + 'px system-ui, sans-serif';
          var tw = ctx.measureText(b.text).width;
          var r = fs2 * 0.72;
          var x0 = b.x + (b.w - tw - r * 2 - 5) / 2 + r;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x0, cy, r, 0, Math.PI * 2); ctx.fill();
          E.ui.text(ctx, 'Я', x0, cy + fs2 * 0.06, Math.round(fs2 * 0.9), '#fc5c7d', 'center', 800);
          E.ui.text(ctx, b.text, x0 + r + 5 + tw / 2, cy, fs2, '#ffffff', 'center', 600);
        },
        onTap: function () {
          if (E.storage.authorized) return;
          E.audio.sfx('click');
          E.storage.authorize().then(function (ok) { if (ok) MenuScene.layout(game); });
        }
      }));
      this.hintY = availH - hintH / 2 - 2;
      this.hintSize = Math.max(10, Math.round(13 * k));
    },
    update: function (game, dt) {
      this.t += dt;
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', {});
    },
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      drawBackground(game, ctx, this.clouds, this.dots, this.t);
      var cx = v.w / 2, k = this.k || 1;
      // витринная башенка из 4 слоёв с вишенкой
      var lw = Math.min(v.w * 0.42, 250), lh = this.towerH / 4.6;
      for (var i = 0; i < 4; i++) {
        var ww = lw * (1 - i * 0.1);
        G.art.drawLayer(ctx, cx + Math.sin(this.t * 1.2 + i) * 2, this.towerY - i * lh * 0.9, ww, lh, i % 3, this.t + i);
      }
      G.art.drawCherry(ctx, cx, this.towerY - 3 * lh * 0.9 - lh * 0.95, Math.min(v.w, v.h) * 0.055, this.t);
      G.art.drawSpark(ctx, cx - lw * 0.62, this.towerY - this.towerH * 0.55, 12, this.t, 0);
      G.art.drawSpark(ctx, cx + lw * 0.66, this.towerY - this.towerH * 0.3, 9, this.t, 2);
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 54 * k, 800);
      ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(43,26,61,0.9)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.strokeText(title, cx, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
      ctx.fillStyle = tg; ctx.fillText(title, cx, this.titleY);
      if (this.best > 0) E.ui.text(ctx, t.t('menu_best', { n: this.best }), cx, this.titleY + 34 * k, Math.round(18 * k), C.dim);
      E.ui.drawButtons(ctx, this.buttons);
      var hintSize = E.ui.fit(ctx, t.t('menu_hint'), v.w * 0.92, this.hintSize, 400);
      E.ui.text(ctx, t.t('menu_hint'), cx, this.hintY, hintSize, C.dim, 'center', 400);
      E.ui.text(ctx, 'v' + G.version, 10, (v.h - (this.inset || 0)) - 12, 12, C.dim, 'left', 400);
    },
    getCaptureState: function () { return { scene: 'menu' }; }
  };

  /* ========================================================= PLAY */
  var PlayScene = {
    /* ---------- lifecycle ---------- */
    enter: function (game, params) {
      var C = G.config;
      E.sdk.hideBanner();
      E.fx.reset();
      G.art.init();
      var seed = (params.seed != null) ? params.seed
               : (E.capture.seed != null) ? E.capture.seed
               : ((Date.now() % 2147483647) | 0);
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      this.rng = new E.Rng(this.seedNum);
      this.visRng = new E.Rng(this.seedNum ^ 0x9e3779b9);
      this.clouds = makeClouds(7, 888);
      this.dots = makeDots(24, 999);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.score = 0; this.dust = 0;
      this.combo = 0; this.placed = 0;
      this.layers = [];           // settled layers, x/w в долях ширины поля
      this.layers.push(G.makeLayer(0.5, C.baseWidth(), 0)); // подошва
      this.swing = { t: 0, dir: 1 };  // маятник нового слоя
      this.dropAnim = null;       // {x0, x1, y0, y1, t, layer}
      this.fallOff = [];          // срезанные куски, падающие вниз
      this.camY = 0;              // вертикальный скролл башни (px)
      this.camTarget = 0;
      this.guideT = 0; this.slowT = 0; this.bouncyT = 0;
      this.nextStar = false; this.seenStar = false;
      this.reviveUsed = false;
      this.floaters = [];
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0;
      this.stats = E.storage.get('stats', { games: 0, placed: 0 });
      this.stats.games++;
      E.storage.set('stats', this.stats);
      this._autoT = 0;

      this.layout(game);
      this.buildHudButtons(game);
      E.audio.music('play');
      E.sdk.gameplayStart();

      this.applyCaptureParams(game, params);
      this.saveGame();
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      E.fx.reset();
      this.clouds = makeClouds(7, 888);
      this.dots = makeDots(24, 999);
      this.buildHudButtons(game);
      if (this.mode === 'paused') this.buildPauseButtons();
      if (this.mode === 'over' || this.mode === 'dead') this.buildOverButtons(game);
      if (this.mode === 'revive') this.buildReviveButtons(game);
      if (this.mode === 'shop') this.buildShopButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    layout: function (game) {
      var v = game.view;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      this.hudH = Math.max(44, availH * 0.075);
      this.inset = inset;
      this.layerH = clamp(availH * 0.075, 34, 56);
      this.groundY = v.h - Math.max(24, availH * 0.05);
    },

    /* ---------- геометрия башни ---------- */
    layerY: function (i) {
      // i-й settled-слой: подошва i=0 стоит на земле
      return this.groundY - (i + 0.5) * this.layerH * 0.94 + this.camY;
    },
    topIndex: function () { return this.layers.length - 1; },
    swingX: function () {
      // позиция качающегося слоя (доли ширины поля)
      var C = G.config;
      var sp = C.swingSpeed(this.level);
      if (this.slowT > 0) sp *= 0.55;
      if (this.recordMode) sp = Math.min(sp, C.recordMaxSpeed);
      var ph = this.swing.t * sp;
      return 0.5 + Math.sin(ph) * C.swingAmp();
    },
    currentW: function () { return this.layers[this.topIndex()].w; },

    /* ---------- capture ---------- */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      this.autopilot = true;
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.update(game, dt);
        if (E.fx) E.fx.update(dt);
        game.time += dt;
      }
      this.autopilot = keepAuto;
    },
    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave) {
        var lv = clamp(parseInt(P.wave, 10) || 1, 1, G.config.maxLevel);
        this.level = lv;
        this.placed = Math.floor(G.config.levelGoal(lv) * 0.55);
        this.score = lv * 140;
        this.dust = lv * 40;
        this.combo = 2;
        // достраиваем башню до ~7+lv*0.4 слоёв, чтобы кадр выглядел «в процессе»
        var want = Math.min(7 + Math.floor(lv * 0.5), 16);
        var w = this.layers[0].w;
        for (var i = 1; i < want; i++) {
          w = Math.max(G.config.minLayer * 1.6, w * (0.985 - (this.rng.float() * 0.05)));
          var jitter = (this.rng.float() - 0.5) * 0.04;
          var prevX = this.layers[this.layers.length - 1].x;
          this.layers.push(G.makeLayer(clamp(prevX + jitter, w / 2, 1 - w / 2), w, i));
        }
      }
      if (P.score) this.score = Math.max(0, parseInt(P.score, 10) || 0);
      if (P.coins) this.dust = Math.max(0, parseInt(P.coins, 10) || 0);
      this.updateCamera(game, true);
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0));
      if (P.mode === 'over') {
        this.level = G.config.maxLevel;
        this.victory(game, true);
        this.overT = 1;
      } else if (P.mode === 'dead') {
        this.gameOver(game, true);
        this.overT = 1;
      } else {
        if (tsec > 0) this.simulateCombat(game, tsec);
        if (P.mode === 'shop') this.openShop(game);
        if (P.mode === 'revive') { this.mode = 'revive'; this.buildReviveButtons(game); }
      }
      if (P.freeze === '1') { game.pause('capture'); game.render(); }
    },
    setCaptureState: function (game, s) {
      if (s.seed != null) {
        this.seedNum = (typeof s.seed === 'string') ? E.seedFromString(s.seed) : (s.seed >>> 0);
        this.rng = new E.Rng(this.seedNum);
      }
      if (s.wave) { this.level = clamp(s.wave, 1, G.config.maxLevel); }
      if (s.score != null) this.score = s.score;
      if (s.coins != null) this.dust = s.coins;
      if (s.mode === 'shop') this.openShop(game);
      if (s.mode === 'over') { this.victory(game, true); this.overT = 1; }
    },
    getCaptureState: function (game) {
      return { scene: 'play', mode: this.mode, wave: this.level, level: this.level,
               score: this.score, coins: Math.floor(this.dust), lives: 1, fps: game.fps };
    },

    /* ---------- очки / блёстки ---------- */
    comboMult: function () { return Math.min(G.config.score.comboCap, 1 + Math.floor(this.combo / 3)); },
    addScore: function (n, x, y) {
      var mult = this.comboMult();
      var gained = n * mult;
      this.score += gained;
      this.dust += Math.max(1, Math.round(n / 5));
      this.addFloater(x, y, '+' + gained + (mult > 1 ? ' ×' + mult : ''), G.config.palette.gold);
    },
    addDust: function (n, x, y) {
      this.dust += n;
      if (x != null) this.addFloater(x, y - 26, '+' + n + ' ✦', G.config.palette.dust);
    },
    addFloater: function (x, y, text, color) {
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },
    saveGame: function () {
      var best = Math.max(E.storage.get('best', 0), this.score);
      E.storage.set('best', best);
      E.storage.set('run', { level: this.level, score: this.score, dust: Math.floor(this.dust) });
    },

    /* ---------- бросок слоя ---------- */
    dropLayer: function (game) {
      if (this.dropAnim) return; // ждём приземления предыдущего
      var C = G.config;
      var v = game.view;
      var prev = this.layers[this.topIndex()];
      var x = this.swingX();
      var cur = { x: x, w: prev.w, variant: (this.topIndex() + 1) % 3, star: this.nextStar };
      if (this.nextStar) this.nextStar = false;
      else if (this.level >= C.starFromLevel && this.rng.float() < C.starChance) this.nextStar = true;
      var dropFromY = this.hudH + 30;
      var targetY = this.layerY(this.topIndex() + 1);
      this.dropAnim = { x0: x, y0: dropFromY, y1: targetY, t: 0, cur: cur };
      E.audio.sfx('click');
    },
    resolveDrop: function (game) {
      var C = G.config, v = game.view;
      var anim = this.dropAnim;
      this.dropAnim = null;
      var prev = this.layers[this.topIndex()];
      var cur = anim.cur;
      var px = cur.x * v.w;
      if (G.isPerfect(prev, cur, C.perfectTol)) {
        // идеально: слой не сужается, комбо растёт
        this.combo++;
        this.placed++;
        this.stats.placed++;
        var np = G.makeLayer(prev.x, cur.w, cur.variant);
        np.star = !!cur.star;
        this.layers.push(np);
        if (cur.star) {
          this.addScore(C.score.star, px, anim.y1);
          E.fx.burst(px, anim.y1, '#ffe27a', 22, 170, this.visRng);
          E.fx.flash('rgba(255,212,59,0.22)');
          E.audio.sfx('wave');
          this.addFloater(px, anim.y1 - 20, T('star_landed'), '#ffe27a');
        } else {
          this.addScore(C.score.perfect, px, anim.y1);
          E.fx.burst(px, anim.y1, '#ffd43b', 14, 120, this.visRng);
          E.audio.sfx('coin');
          this.addFloater(px, anim.y1 - 20, 'PERFECT!', '#ffd43b');
        }
      } else if (this.bouncyT > 0) {
        // упругий крем: слой прилипает целиком, без среза и без комбо
        this.combo = 0;
        this.placed++;
        this.stats.placed++;
        var bp = G.makeLayer(clamp(cur.x, cur.w / 2, 1 - cur.w / 2), cur.w, cur.variant);
        bp.star = !!cur.star;
        this.layers.push(bp);
        if (cur.star) {
          this.addScore(C.score.star, bp.x * v.w, anim.y1);
          E.fx.burst(bp.x * v.w, anim.y1, '#ffe27a', 22, 170, this.visRng);
          E.fx.flash('rgba(255,212,59,0.22)');
          E.audio.sfx('wave');
          this.addFloater(bp.x * v.w, anim.y1 - 20, T('star_landed'), '#ffe27a');
        } else {
          this.addScore(C.score.layer, bp.x * v.w, anim.y1);
          E.fx.burst(bp.x * v.w, anim.y1, '#9fe8c1', 10, 90, this.visRng);
          E.audio.sfx('pulse');
        }
      } else {
        var ov = G.overlap(prev, cur);
        if (!ov || ov.w < C.minLayer) { this.missLayer(game, cur, anim); return; }
        // срезаем свес
        var cutL = Math.min(prev.x, cur.x), cutR = Math.max(prev.x, cur.x);
        this.combo = 0;
        this.placed++;
        this.stats.placed++;
        var sp = G.makeLayer(ov.x, ov.w, cur.variant);
        sp.star = !!cur.star;
        this.layers.push(sp);
        if (cur.star) {
          this.addScore(C.score.star, ov.x * v.w, anim.y1);
          E.fx.burst(ov.x * v.w, anim.y1, '#ffe27a', 22, 170, this.visRng);
          E.fx.flash('rgba(255,212,59,0.22)');
          E.audio.sfx('wave');
          this.addFloater(ov.x * v.w, anim.y1 - 20, T('star_landed'), '#ffe27a');
        } else {
          this.addScore(C.score.layer, ov.x * v.w, anim.y1);
          E.fx.burst(ov.x * v.w, anim.y1, '#ff8fb3', 8, 80, this.visRng);
          E.audio.sfx('pulse');
        }
        // падающие обрезки
        var offW = cur.w - ov.w;
        if (offW > 0.01) {
          var side = cur.x < prev.x ? -1 : 1;
          this.fallOff.push({ x: cur.x + side * (ov.w + offW / 2) / 2, y: anim.y1, w: offW * v.w, vy: 60, rot: 0, variant: cur.variant });
        }
      }
      this.swing.t = 0;
      this.updateCamera(game, false);
      this.checkLevelUp(game);
      this.saveGame();
    },
    missLayer: function (game, cur, anim) {
      // слой улетел мимо — конец игры
      var v = game.view;
      this.fallOff.push({ x: cur.x * v.w, y: anim.y1, w: cur.w * v.w, vy: 140, rot: 0, variant: cur.variant, missed: true });
      E.fx.shake(6, 0.35);
      E.fx.flash('#ff5d5d', 0.2);
      E.audio.sfx('hit');
      this.onDeath(game);
    },
    updateCamera: function (game, instant) {
      // держим вершину башни примерно на 45% высоты
      var v = game.view;
      var topY = this.layerY(this.topIndex() + 1);
      var want = v.h * 0.42 - topY + this.camY;
      this.camTarget = Math.max(0, want);
      if (instant) this.camY = this.camTarget;
    },
    checkLevelUp: function (game) {
      var need = G.config.levelGoal(this.level);
      if (this.placed < need) return;
      if (this.level >= G.config.maxLevel) { this.victory(game, false); return; }
      var reward = 30 + this.level * 10;
      if (this.recordMode) reward = Math.min(reward, G.config.recordRewardCap);
      this.dust += reward;
      this.level++;
      this.placed = 0;
      E.audio.sfx('wave');
      E.fx.flash('#ffe066', 0.18);
      var v = game.view;
      this.addFloater(v.w / 2, this.hudH + 40, T('levelup', { n: this.level, c: reward }), '#ffe066');
      this.saveGame();
    },
    onDeath: function (game) {
      if (!this.reviveUsed) {
        this.mode = 'revive';
        E.sdk.gameplayStop();
        this.buildReviveButtons(game);
      } else {
        this.gameOver(game, false);
      }
    },
    gameOver: function (game, byCapture) {
      if (this.mode === 'dead' || this.mode === 'over') return;
      this.mode = 'dead';
      E.sdk.gameplayStop();
      E.audio.sfx('over');
      var best = E.storage.get('best', 0);
      if (this.score > best) { E.storage.set('best', this.score); this.newBest = true; }
      if (!byCapture) E.sdk.showBanner();
      this.buildOverButtons(game);
    },
    victory: function (game, byCapture) {
      if (this.mode === 'over') return;
      this.mode = 'over';
      E.sdk.gameplayStop();
      E.audio.sfx('wave');
      var best = E.storage.get('best', 0);
      if (this.score > best) { E.storage.set('best', this.score); this.newBest = true; }
      if (!byCapture) E.sdk.showBanner();
      this.buildOverButtons(game);
    },
    restart: function (game) {
      E.storage.set('run', null);
      game.setScene('play', { seed: (Date.now() % 2147483647) | 0 });
    },

    /* ---------- магазин ---------- */
    openShop: function (game) {
      if (this.mode !== 'running') return;
      this.mode = 'shop';
      E.sdk.gameplayStop();
      this.buildShopButtons(game);
    },
    closeShop: function (game) {
      this.mode = 'running';
      E.sdk.gameplayStart();
    },
    buyGuide: function (game) {
      var p = G.config.economy.guidePrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.guideT = G.config.economy.guideDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buySlow: function (game) {
      var p = G.config.economy.slowPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.slowT = G.config.economy.slowDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyGrow: function (game) {
      var p = G.config.economy.growPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      var top = this.layers[this.topIndex()];
      if (top.w >= G.config.baseWidth()) { E.audio.sfx('deny'); return; }
      this.dust -= p;
      top.w = Math.min(G.config.baseWidth(), top.w * 1.3);
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyBouncy: function (game) {
      var p = G.config.economy.bouncyPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.bouncyT = G.config.economy.bouncyDur;
      E.audio.sfx('buy');
      var v = game.view;
      this.addFloater(v.w / 2, this.hudH + 40, T('bouncy_done'), '#9fe8c1');
      this.buildShopButtons(game);
    },

    /* ---------- пауза ---------- */
    setPaused: function (on) {
      if (on && this.mode === 'running') {
        this.mode = 'paused';
        E.sdk.gameplayStop();
        this.buildPauseButtons();
      } else if (!on && this.mode === 'paused') {
        this.mode = 'running';
        E.sdk.gameplayStart();
      }
    },

    /* ---------- ввод ---------- */
    update: function (game, dt) {
      if (this.mode === 'running') this.updateRunning(game, dt);
      else if (this.mode === 'over' || this.mode === 'dead') this.updateOver(game, dt);
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt;
        if (f.t > 1.1) this.floaters.splice(i, 1);
      }
      for (var j = this.fallOff.length - 1; j >= 0; j--) {
        var o = this.fallOff[j];
        o.vy += 900 * dt; o.y += o.vy * dt; o.rot += dt * 2.5;
        if (o.y > game.view.h + 120) this.fallOff.splice(j, 1);
      }
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
    },
    updateRunning: function (game, dt) {
      this.swing.t += dt;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.guideT > 0) this.guideT -= dt;
      if (this.bouncyT > 0) this.bouncyT -= dt;
      // анимация падения слоя
      if (this.dropAnim) {
        var a = this.dropAnim;
        a.t += dt * 3.4;
        if (a.t >= 1) this.resolveDrop(game);
      }
      // камера плавно
      if (Math.abs(this.camTarget - this.camY) > 0.5) {
        this.camY += (this.camTarget - this.camY) * Math.min(1, dt * 6);
      }
      if (this.autopilot) this.driveAutopilot(dt, game);
      else this.driveInput(game);
    },
    updateOver: function (game, dt) {
      this.overT = (this.overT || 0) + dt;
      if (this.autopilot && this.overT > 1.5) this.restart(game);
    },
    driveInput: function (game) {
      var P = E.input.pointer;
      if (P.pressed) {
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) return;
        this.dropLayer(game);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    /* Autopilot: роняет слой, когда он почти над вершиной (с крошечной погрешностью). */
    driveAutopilot: function (dt, game) {
      if (this.dropAnim) return;
      this._autoT -= dt;
      if (this._autoT > 0) return;
      var prev = this.layers[this.topIndex()];
      var x = this.swingX();
      var err = Math.abs(x - prev.x);
      // маятник быстрее на высоких уровнях: допуск чуть шире perfectTol
      var tol = G.config.perfectTol * prev.w * 1.4;
      if (err <= tol) {
        // небольшая случайная погрешность, чтобы видео выглядело живо
        this.dropLayer(game);
        this._autoT = 0.12;
      }
    },

    /* ---------- HUD-кнопки ---------- */
    buildHudButtons: function (game) {
      var v = game.view;
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      var self = this;
      this.hudButtons = [
        new E.ui.Button({ x: v.w - s - 8, y: 8, w: s, h: s, fontSize: 20, text: 'II',
          id: 'pause', onTap: function () { E.audio.sfx('click'); self.setPaused(true); } }),
        new E.ui.Button({ x: v.w - 2 * (s + 8), y: 8, w: s, h: s, fontSize: 20, text: '★', id: 'shop',
          onTap: function () { E.audio.sfx('click'); self.openShop(game); } })
      ];
    },
    buildPauseButtons: function () {
      var t = i18n(), self = this;
      var bw = Math.min(260, window.innerWidth * 0.7), bh = 50;
      var cx = window.innerWidth / 2, y0 = window.innerHeight * 0.42;
      var game = E.sdk._game;
      this.pauseButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 20, text: t.t('pause_resume'),
          onTap: function () { E.audio.sfx('click'); self.setPaused(false); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 20, text: t.t('pause_restart'),
          onTap: function () { E.audio.sfx('click'); self.restart(game); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + 2 * (bh + 12), w: bw, h: bh, fontSize: 20, text: t.t('pause_menu'),
          onTap: function () { E.audio.sfx('click'); E.sdk.gameplayStop(); game.setScene('menu', {}); } })
      ];
    },
    buildShopButtons: function (game) {
      var t = i18n(), self = this;
      var v = game.view, C = G.config;
      var bw = Math.min(340, v.w * 0.84);
      var cx = v.w / 2;
      var rows = 5; // guide, slow, grow, bouncy, далее
      var bh = Math.max(38, Math.min(50, (v.h * 0.52) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 15,
        text: t.t('item_guide', { s: C.economy.guideDur }) + ' — ' + C.economy.guidePrice + ' ✦',
        enabled: this.dust >= C.economy.guidePrice,
        onTap: function () { self.buyGuide(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_slow', { s: C.economy.slowDur }) + ' — ' + C.economy.slowPrice + ' ✦',
        enabled: this.dust >= C.economy.slowPrice,
        onTap: function () { self.buySlow(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 2 * (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_grow') + ' — ' + C.economy.growPrice + ' ✦',
        enabled: this.dust >= C.economy.growPrice && this.layers[this.topIndex()].w < C.baseWidth(),
        onTap: function () { self.buyGrow(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 3 * (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_bouncy', { s: C.economy.bouncyDur }) + ' — ' + C.economy.bouncyPrice + ' ✦',
        enabled: this.dust >= C.economy.bouncyPrice,
        onTap: function () { self.buyBouncy(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 4 * (bh + 8), w: bw, h: bh, fontSize: 18, text: t.t('shop_next'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
    },
    buildReviveButtons: function (game) {
      var t = i18n(), self = this;
      var v = game.view;
      var bw = Math.min(280, v.w * 0.74), bh = 50;
      var cx = v.w / 2;
      var y0 = v.h * 0.52;
      this.reviveButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19, text: t.t('revive_btn'),
          bg: '#7c4dff', border: '#b197fc', fg: '#fff',
          onTap: function () {
            E.sdk.showRewarded({ onReward: function () {
              self.reviveUsed = true;
              // возрождение: убираем анимацию промаха, башня остаётся как есть
              self.dropAnim = null;
              self.mode = 'running';
              E.sdk.gameplayStart();
              E.audio.sfx('revive');
              self.addFloater(v.w / 2, v.h * 0.4, T('revive_done'), '#b197fc');
            } });
          } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 19, text: t.t('revive_no'),
          onTap: function () { E.audio.sfx('click'); self.gameOver(game, false); } })
      ];
    },
    buildOverButtons: function (game) {
      var t = i18n(), self = this;
      var v = game.view;
      var bw = Math.min(280, v.w * 0.74), bh = 48;
      var cx = v.w / 2;
      var rows = 2;
      var y0 = v.h * 0.5 - (bh + 12) * rows / 2 + v.h * 0.06;
      this.overButtons = [
        new E.ui.Button({ x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19, text: t.t('over_restart'),
          bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
          onTap: function () { E.audio.sfx('click'); self.restart(game); } }),
        new E.ui.Button({ x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 19, text: t.t('over_menu'),
          onTap: function () { E.audio.sfx('click'); E.sdk.hideBanner(); game.setScene('menu', {}); } })
      ];
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette;
      drawBackground(game, ctx, this.clouds, this.dots, game.time);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawTower(game, ctx);
      this.drawSwinger(game, ctx);
      this.drawHud(game, ctx);
      E.fx.draw(ctx);
      this.drawFloaters(ctx);
      ctx.restore();
      E.fx.drawFlash(ctx, v.w, v.h);
      if (this.mode === 'paused') this.drawPause(game, ctx);
      else if (this.mode === 'shop') this.drawShop(game, ctx);
      else if (this.mode === 'revive') this.drawRevive(game, ctx);
      else if (this.mode === 'over' || this.mode === 'dead') this.drawOver(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
    },
    drawTower: function (game, ctx) {
      var v = game.view;
      // земля-подложка: вафельный столик
      var gy = this.groundY + this.camY;
      ctx.fillStyle = '#7a4a2b';
      ctx.fillRect(0, gy, v.w, v.h - gy);
      ctx.fillStyle = 'rgba(93,55,32,0.8)';
      for (var gx = 0; gx < v.w; gx += 26) {
        ctx.fillRect(gx, gy, 2, 10);
      }
      ctx.fillStyle = 'rgba(255,243,214,0.25)';
      ctx.fillRect(0, gy, v.w, 4);
      // settled-слои (перерисовка с учётом star)
      for (var i = 0; i < this.layers.length; i++) {
        var L = this.layers[i];
        var y = this.layerY(i);
        if (y < -this.layerH || y > v.h + this.layerH) continue;
        if (L.star) G.art.drawStarLayer(ctx, L.x * v.w, y, L.w * v.w, this.layerH, game.time + i * 0.3);
        else G.art.drawLayer(ctx, L.x * v.w, y, L.w * v.w, this.layerH, L.variant, game.time + i * 0.3);
      }
      // вишенка на вершине, когда нет качающегося слоя в полёте
      if (!this.dropAnim) {
        var topY = this.layerY(this.topIndex());
        G.art.drawCherry(ctx, this.layers[this.topIndex()].x * v.w, topY - this.layerH * 0.92, this.layerH * 0.62, game.time);
      }
      // обрезки, падающие вниз
      for (var j = 0; j < this.fallOff.length; j++) {
        var o = this.fallOff[j];
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rot);
        G.art.drawLayer(ctx, 0, 0, Math.max(10, o.w), this.layerH * 0.8, o.variant, game.time);
        ctx.restore();
      }
    },
    drawSwinger: function (game, ctx) {
      if (this.mode !== 'running' && this.mode !== 'shop' && this.mode !== 'paused') return;
      var v = game.view, C = G.config.palette;
      if (this.dropAnim) {
        // падающий слой
        var a = this.dropAnim;
        var k = Math.min(1, a.t);
        var y = a.y0 + (a.y1 - a.y0) * k * k;
        if (a.cur.star) G.art.drawStarLayer(ctx, a.x0 * v.w, y, a.cur.w * v.w, this.layerH, game.time);
        else G.art.drawLayer(ctx, a.x0 * v.w, y, a.cur.w * v.w, this.layerH, a.cur.variant, game.time);
        return;
      }
      // качающийся слой на «нитке» крана
      var x = this.swingX();
      var topY = this.layerY(this.topIndex() + 1);
      var wy = this.hudH + 30;
      var w = this.currentW() * v.w;
      // нитка от верха экрана
      ctx.strokeStyle = 'rgba(255,243,214,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x * v.w, 0); ctx.lineTo(x * v.w, wy - this.layerH / 2); ctx.stroke();
      // направляющая (купленная линейка)
      if (this.guideT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.15 * Math.sin(game.time * 6);
        ctx.strokeStyle = C.accent;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(this.layers[this.topIndex()].x * v.w, wy + this.layerH / 2);
        ctx.lineTo(this.layers[this.topIndex()].x * v.w, topY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (this.nextStar) G.art.drawStarLayer(ctx, x * v.w, wy, w, this.layerH, game.time);
      else G.art.drawLayer(ctx, x * v.w, wy, w, this.layerH, (this.topIndex() + 1) % 3, game.time);
    },
    drawHud: function (game, ctx) {
      var C = G.config.palette, t = i18n(), v = game.view;
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.34), C.text, 'left', 800);
      E.ui.text(ctx, t.t('hud_score', { n: this.score }), 12, y + this.hudH * 0.30, Math.round(this.hudH * 0.24), C.star, 'left', 800);
      var goalText = t.t('hud_goal', { a: this.placed, b: G.config.levelGoal(this.level) });
      E.ui.text(ctx, goalText, v.w / 2, y, Math.round(this.hudH * 0.26), C.dim, 'center', 700);
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      var cxr = v.w - 2 * (s + 8) - 14;
      E.ui.text(ctx, '✦' + Math.floor(this.dust), cxr, y, Math.round(this.hudH * 0.32), C.dust, 'right', 800);
      if (this.combo >= 3) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(game.time * 7);
        E.ui.text(ctx, '×' + this.comboMult(), cxr, y + this.hudH * 0.3, Math.round(this.hudH * 0.26), C.accent, 'right', 800);
        ctx.globalAlpha = 1;
      }
      if (this.guideT > 0) E.ui.text(ctx, '📏', cxr - 60, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.accent, 'right', 800);
      if (this.slowT > 0) E.ui.text(ctx, '⏱', cxr - 100, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.accent, 'right', 800);
      if (this.bouncyT > 0) E.ui.text(ctx, '🍮', cxr - 140, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.mint, 'right', 800);
      E.ui.drawButtons(ctx, this.hudButtons);
    },
    drawFloaters: function (ctx) {
      for (var i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        var k = f.t / 1.1;
        ctx.globalAlpha = 1 - k * k;
        var size = 17;
        ctx.font = '800 ' + size + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(43,26,61,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(43,26,61,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, v.h * 0.32, 34, C.text, 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) {
        E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(43,26,61,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 34, 30, C.text, 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: Math.floor(this.dust) }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 6, 18, C.dust, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeShop(game);
    },
    drawRevive: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(43,26,61,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('gameover_title'), v.w / 2, v.h * 0.34, 30, C.text, 'center', 800);
      E.ui.text(ctx, t.t('revive_offer'), v.w / 2, v.h * 0.34 + 38, 17, C.dim, 'center', 600);
      E.ui.drawButtons(ctx, this.reviveButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.reviveButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawOver: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(43,26,61,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      var titleKey = this.mode === 'over' ? 'over_title' : 'gameover_title';
      E.ui.text(ctx, t.t(titleKey), v.w / 2, v.h * 0.26, 32, C.text, 'center', 800);
      E.ui.text(ctx, t.t('over_score', { n: this.score }), v.w / 2, v.h * 0.26 + 40, 20, C.dim, 'center', 600);
      if (this.newBest) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
        E.ui.text(ctx, t.t('over_newbest'), v.w / 2, v.h * 0.26 + 70, 20, '#ffd43b', 'center', 800);
        ctx.globalAlpha = 1;
      } else {
        E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, v.h * 0.26 + 70, 18, C.dim, 'center', 600);
      }
      E.ui.drawButtons(ctx, this.overButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      var msgs = [t.t('tut_tap'), t.t('tut_over'), t.t('tut_combo')];
      var step = Math.min(2, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + 10;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 500);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 34, 17);
      ctx.fillStyle = 'rgba(43,26,61,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, w - 30, 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 17, size, C.text, 'center', 600);
      if (this.tutT > 13) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
