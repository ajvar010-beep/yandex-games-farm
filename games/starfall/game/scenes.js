/* game/scenes.js — сцены menu и play «Старфолла».
   Контракт с pipeline/capture-starfall.mjs:
   - capture-параметры: wave=N = УРОВЕНЬ, t=SEC = прогон autopilot-симуляции,
     mode=shop|over|dead = форсированный экран, freeze=1 — заморозка кадра.
   - Record-safe (?record/?autoplay): автопилот водит комету сам.
   - Стики-баннер — ТОЛЬКО вне геймплея (menu/over), в play его нет (4.6). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function i18n() { return E.i18n; }
  function T(k, v) { return E.i18n.t(k, v); }

  /* ---------- фон: ночное небо, звёздная пыль ---------- */
  function makeBlobs(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(0.05, 0.15),
               tw: rng.range(0.2, 0.7), ph: rng.angle(), hue: rng.pick(['#1a2452', '#24306e', '#2e3d8a']) });
    }
    return s;
  }
  function drawBackground(game, ctx, blobs, t) {
    var v = game.view, C = G.config.palette;
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, C.bg2); grd.addColorStop(1, C.bg);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    for (var i = 0; i < blobs.length; i++) {
      var s = blobs[i];
      var R = s.r * Math.min(v.w, v.h);
      var x = s.x * v.w + Math.sin(t * s.tw + s.ph) * 14;
      var y = s.y * v.h + Math.cos(t * s.tw * 0.8 + s.ph) * 9;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = s.hue;
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.6, R, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ========================================================= MENU */
  function makeSparkles(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(1.2, 3),
               tw: rng.range(0.8, 2.4), ph: rng.angle(),
               hue: rng.pick(['#ffd43b', '#7df9ff', '#ff6b9d', '#b197fc', '#74c0fc']) });
    }
    return s;
  }
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.t = 0;
      this.blobs = makeBlobs(12, 3131);
      this.sparkles = makeSparkles(26, 555);
      // парад дропов: что будем ловить
      this.parade = [
        { kind: 'star', ph: 0 }, { kind: 'gold', ph: 1 }, { kind: 'heart', ph: 2 },
        { kind: 'x2', ph: 3 }, { kind: 'meteor', ph: 4 }, { kind: 'nova', ph: 5 }
      ];
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

      this.titleY = availH * 0.115;
      this.paradeY = availH * 0.33;
      this.stageH = Math.min(w, availH) * 0.30;
      var contentTop = this.paradeY + this.stageH / 2 + (best > 0 ? 30 * k : 16 * k);
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
      drawBackground(game, ctx, this.blobs, this.t);
      var cx = v.w / 2, k = this.k || 1;
      for (var si = 0; si < this.sparkles.length; si++) {
        var sp = this.sparkles[si];
        ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * sp.tw + sp.ph));
        ctx.fillStyle = sp.hue;
        ctx.beginPath(); ctx.arc(sp.x * v.w, sp.y * v.h, sp.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // витрина: падающие дропы над кометой
      var n = this.parade.length, span = Math.min(v.w * 0.86, 560);
      var R = Math.min(v.w, v.h) * 0.052;
      for (var i = 0; i < n; i++) {
        var p = this.parade[i];
        var x = cx - span / 2 + (i + 0.5) * (span / n);
        var y = this.paradeY + Math.sin(this.t * 1.5 + p.ph) * R * 0.5;
        var kind = p.kind;
        if (kind === 'star') G.art.drawStar(ctx, x, y, R, this.t, p.ph);
        else if (kind === 'gold') G.art.drawGold(ctx, x, y, R, this.t, p.ph);
        else if (kind === 'heart') G.art.drawHeart(ctx, x, y, R, this.t, p.ph);
        else if (kind === 'meteor') G.art.drawMeteor(ctx, x, y, R, this.t, p.ph);
        else if (kind === 'nova') G.art.drawNova(ctx, x, y, R, this.t, p.ph);
        else G.art.drawBonus(ctx, kind, x, y, R, this.t, p.ph);
      }
      G.art.drawComet(ctx, cx, this.paradeY + this.stageH * 0.52, Math.min(v.w * 0.2, 130), 40, this.t, 0);
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 54 * k, 800);
      ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(10,13,36,0.85)'; ctx.lineJoin = 'round';
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
      this.blobs = makeBlobs(10, 888);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.score = 0; this.dust = 0;
      this.lives = C.lives; this.combo = 0; this.caught = 0;
      this.bx = 0.5; this.bvx = 0; this.targetX = null;
      this.drops = [];
      this.spawnT = 0.5;
      this.slowT = 0; this.x2T = 0; this.shieldT = 0; this.shieldOn = false;
      this.magnetT = 0;
      this.invulnT = 0;
      this.reviveUsed = false;
      this.floaters = [];
      this.seenNova = false;
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0;
      this.stats = E.storage.get('stats', { games: 0, caught: 0 });
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
      this.blobs = makeBlobs(10, 888);
      this.buildHudButtons(game);
      if (this.mode === 'paused') this.buildPauseButtons();
      if (this.mode === 'over' || this.mode === 'dead') this.buildOverButtons(game);
      if (this.mode === 'revive') this.buildReviveButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    layout: function (game) {
      var v = game.view, C = G.config;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      this.hudH = Math.max(44, availH * 0.075);
      this.inset = inset;
      this.basketW = Math.min(C.basket.w, v.w * 0.16);
      this.basketY = availH - C.basket.yPad;
    },

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
        this.caught = Math.floor(G.config.levelGoal(lv) * 0.6);
        this.score = lv * 130;
        this.dust = lv * 40;
        this.combo = 3;
      }
      if (P.score) this.score = Math.max(0, parseInt(P.score, 10) || 0);
      if (P.coins) this.dust = Math.max(0, parseInt(P.coins, 10) || 0);
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
               score: this.score, coins: Math.floor(this.dust), lives: this.lives, fps: game.fps };
    },

    /* ---------- очки / пыль ---------- */
    comboMult: function () { return Math.min(G.config.score.comboCap, 1 + Math.floor(this.combo / 5)); },
    addScore: function (n, x, y) {
      var mult = this.comboMult();
      var gained = n * mult;
      this.score += gained;
      this.addDust((this.x2T > 0 ? 2 : 1) * Math.max(1, Math.round(n / 5)), x, y);
      this.addFloater(x, y, '+' + gained + (mult > 1 ? ' ×' + mult : ''), G.config.palette.star);
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

    /* ---------- спавн и падение ---------- */
    spawnDrop: function () {
      var C = G.config, v = E.sdk._game.view;
      var ch = C.chances(this.level);
      var roll = this.rng.float();
      var kind = 'star';
      if (roll < ch.meteor) kind = 'meteor';
      else if (roll < ch.meteor + ch.gold) kind = 'gold';
      else if (roll < ch.meteor + ch.gold + ch.heart) kind = 'heart';
      else if (roll < ch.meteor + ch.gold + ch.heart + ch.slow) kind = 'slow';
      else if (roll < ch.meteor + ch.gold + ch.heart + ch.slow + ch.x2) kind = 'x2';
      else if (roll < ch.meteor + ch.gold + ch.heart + ch.slow + ch.x2 + ch.nova) kind = 'nova';
      var x = 30 + this.rng.float() * (v.w - 60);
      var speedCap = this.recordMode ? 260 : 9999;
      var vy = Math.min(speedCap, C.fallSpeed(this.level) * (0.85 + this.rng.float() * 0.3));
      this.drops.push(G.entities.makeDrop(kind, x, -30, vy, this.rng));
      if (kind === 'nova' && !this.seenNova) {
        this.seenNova = true;
        if (!this.autopilot) this.addFloater(x, 70, T('tut_nova'), '#ffa8ff');
      }
    },
    catchDrop: function (i) {
      var d = this.drops[i];
      this.drops.splice(i, 1);
      var C = G.config;
      if (d.kind === 'meteor') {
        if (this.shieldOn) {
          this.shieldOn = false;
          E.fx.burst(d.x, d.y, '#74c0fc', 16, 130, this.visRng);
          E.audio.sfx('pulse');
          this.addFloater(d.x, d.y, '🛡', '#74c0fc');
          return;
        }
        if (this.invulnT > 0) return;
        this.lives--;
        this.combo = 0;
        this.invulnT = 1.2;
        E.fx.shake(5, 0.3);
        E.fx.flash('#ff5d5d', 0.22);
        E.fx.burst(d.x, d.y, '#ff8787', 18, 150, this.visRng);
        E.audio.sfx('hit');
        if (this.lives <= 0) { this.onDeath(E.sdk._game); }
        return;
      }
      this.combo++;
      this.stats.caught++;
      if (d.kind === 'star') {
        this.caught++;
        this.addScore(C.score.star, d.x, d.y);
        E.fx.burst(d.x, d.y, '#ffd43b', 10, 90, this.visRng);
        E.audio.sfx('coin');
      } else if (d.kind === 'gold') {
        this.caught++;
        this.addScore(C.score.gold, d.x, d.y);
        E.fx.burst(d.x, d.y, '#ffb300', 16, 130, this.visRng);
        E.audio.sfx('buy');
      } else if (d.kind === 'nova') {
        this.caught++;
        this.addScore(C.score.nova, d.x, d.y);
        E.fx.burst(d.x, d.y, '#ffa8ff', 24, 170, this.visRng);
        E.fx.flash('rgba(255,168,255,0.2)', 0.2);
        this.addFloater(d.x, d.y - 44, T('nova_caught'), '#ffa8ff');
        E.audio.sfx('wave');
      } else if (d.kind === 'heart') {
        if (this.lives < C.lives) { this.lives++; this.addFloater(d.x, d.y, '+♥', '#ff6b9d'); }
        else this.addDust(30, d.x, d.y);
        E.fx.burst(d.x, d.y, '#ff6b9d', 14, 110, this.visRng);
        E.audio.sfx('revive');
      } else if (d.kind === 'slow') {
        this.slowT = C.economy.slowDur;
        this.addFloater(d.x, d.y, '⏱', '#74c0fc');
        E.audio.sfx('pulse');
      } else if (d.kind === 'x2') {
        this.x2T = C.economy.x2Dur;
        this.addFloater(d.x, d.y, '×2 ✦', '#b197fc');
        E.audio.sfx('pulse');
      }
      this.checkLevelUp(E.sdk._game);
      this.saveGame();
    },
    missStar: function (d) {
      if (d.kind === 'star' || d.kind === 'gold' || d.kind === 'nova') {
        if (this.combo > 0) { this.combo = 0; }
      }
    },
    checkLevelUp: function (game) {
      var need = G.config.levelGoal(this.level);
      if (this.caught < need) return;
      if (this.level >= G.config.maxLevel) { this.victory(game, false); return; }
      var reward = 30 + this.level * 10;
      if (this.recordMode) reward = Math.min(reward, 90);
      this.dust += reward;
      this.level++;
      this.caught = 0;
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
    buySlow: function (game) {
      var p = G.config.economy.slowPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.slowT = G.config.economy.slowDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyX2: function (game) {
      var p = G.config.economy.x2Price;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.x2T = G.config.economy.x2Dur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyShield: function (game) {
      var p = G.config.economy.shieldPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.shieldT = G.config.economy.shieldDur; this.shieldOn = true;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyMagnet: function (game) {
      var p = G.config.economy.magnetPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.magnetT = G.config.economy.magnetDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
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
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
    },
    updateRunning: function (game, dt) {
      var v = game.view, C = G.config;
      var slowK = this.slowT > 0 ? 0.55 : 1;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.x2T > 0) this.x2T -= dt;
      if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shieldOn = false; }
      if (this.magnetT > 0) this.magnetT -= dt;
      if (this.invulnT > 0) this.invulnT -= dt;
      // спавн
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.drops.length < 14) {
        this.spawnT = C.spawnInterval(this.level);
        this.spawnDrop();
      }
      // падение
      for (var i = this.drops.length - 1; i >= 0; i--) {
        var d = this.drops[i];
        d.t += dt;
        d.y += d.vy * dt * slowK;
        d.x += Math.sin(d.t * d.wob + d.wobPh) * 26 * dt;
        if (this.magnetT > 0 && d.kind !== 'meteor') {
          d.x += (this.bx * v.w - d.x) * Math.min(1, C.economy.magnetPull * dt / v.w);
        }
        if (d.x < 16) d.x = 16; if (d.x > v.w - 16) d.x = v.w - 16;
        if (G.entities.caughtBy(d, this.bx * v.w, this.basketY, this.basketW, C.basket.h)) { this.catchDrop(i); continue; }
        if (G.entities.fellOff(d, v.h)) { this.missStar(d); this.drops.splice(i, 1); }
      }
      // движение корзины
      if (this.autopilot) this.driveAutopilot(dt, game);
      else this.driveInput(game, dt);
      var speed = C.basket.speed * dt;
      var tx = this.targetX;
      if (tx != null) {
        var px = this.bx * v.w;
        var dx = tx - px;
        var step = clamp(dx, -speed, speed);
        px += step;
        this.bx = clamp(px / v.w, 0.05, 0.95);
        this.bvx = step / Math.max(dt, 1e-6);
      } else this.bvx *= 0.9;
    },
    updateOver: function (game, dt) {
      this.overT = (this.overT || 0) + dt;
      if (this.autopilot && this.overT > 1.5) this.restart(game);
    },
    driveInput: function (game, dt) {
      var P = E.input.pointer, v = game.view;
      if (P.pressed) {
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) return;
      }
      if (P.down && P.y > this.hudH + 8) this.targetX = P.x;
      else this.targetX = null;
      var k = 0;
      if (E.input.isDown('ArrowLeft') || E.input.isDown('KeyA')) k -= 1;
      if (E.input.isDown('ArrowRight') || E.input.isDown('KeyD')) k += 1;
      if (k !== 0) this.targetX = this.bx * v.w + k * 320 * dt * 4;
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    /* Autopilot: целится в ближайшую звезду/золото/бонус, уклоняется от метеоритов. */
    driveAutopilot: function (dt) {
      this._autoT -= dt;
      if (this._autoT > 0) return;
      this._autoT = 0.08;
      var v = E.sdk._game.view;
      var best = null, bestScore = -1;
      var dangerX = null, dangerY = 0;
      for (var i = 0; i < this.drops.length; i++) {
        var d = this.drops[i];
        var timeTo = (this.basketY - d.y) / Math.max(d.vy, 1);
        if (timeTo < 0) continue;
        if (d.kind === 'meteor') {
          if (timeTo < 1.1 && Math.abs(d.x - this.bx * v.w) < this.basketW * 0.9) {
            if (d.y > dangerY) { dangerY = d.y; dangerX = d.x; }
          }
          continue;
        }
        var val = d.kind === 'nova' ? 7 : (d.kind === 'gold' ? 5 : (d.kind === 'star' ? 3 : 2));
        var sc = val - timeTo * 0.6 - Math.abs(d.x - this.bx * v.w) / v.w * 0.8;
        if (sc > bestScore) { bestScore = sc; best = d; }
      }
      if (dangerX != null) {
        var away = (dangerX < this.bx * v.w) ? dangerX + this.basketW * 1.7 : dangerX - this.basketW * 1.7;
        this.targetX = clamp(away, 30, v.w - 30);
      } else if (best) {
        this.targetX = best.x;
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
      var rows = 5; // slow, x2, shield, magnet, далее
      var bh = Math.max(40, Math.min(54, (v.h * 0.5) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 15,
        text: t.t('item_slow', { s: C.economy.slowDur }) + ' — ' + C.economy.slowPrice + ' ✦',
        enabled: this.dust >= C.economy.slowPrice,
        onTap: function () { self.buySlow(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_x2', { s: C.economy.x2Dur }) + ' — ' + C.economy.x2Price + ' ✦',
        enabled: this.dust >= C.economy.x2Price,
        onTap: function () { self.buyX2(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 2 * (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_shield', { s: C.economy.shieldDur }) + ' — ' + C.economy.shieldPrice + ' ✦',
        enabled: this.dust >= C.economy.shieldPrice,
        onTap: function () { self.buyShield(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 3 * (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_magnet', { s: C.economy.magnetDur }) + ' — ' + C.economy.magnetPrice + ' ✦',
        enabled: this.dust >= C.economy.magnetPrice,
        onTap: function () { self.buyMagnet(game); }
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
              self.lives = 1;
              self.invulnT = 2;
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
      drawBackground(game, ctx, this.blobs, game.time);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawDrops(game, ctx);
      this.drawBasket(game, ctx);
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
    drawDrops: function (game, ctx) {
      var C = G.config.palette;
      for (var i = 0; i < this.drops.length; i++) {
        var d = this.drops[i];
        if (d.kind === 'star') G.art.drawStar(ctx, d.x, d.y, d.r, game.time, d.phase);
        else if (d.kind === 'gold') G.art.drawGold(ctx, d.x, d.y, d.r, game.time, d.phase);
        else if (d.kind === 'meteor') G.art.drawMeteor(ctx, d.x, d.y, d.r, game.time, d.phase);
        else if (d.kind === 'heart') G.art.drawHeart(ctx, d.x, d.y, d.r, game.time, d.phase);
        else if (d.kind === 'nova') G.art.drawNova(ctx, d.x, d.y, d.r, game.time, d.phase);
        else G.art.drawBonus(ctx, d.kind, d.x, d.y, d.r, game.time, d.phase);
      }
    },
    drawBasket: function (game, ctx) {
      var v = game.view, C = G.config;
      G.art.drawComet(ctx, this.bx * v.w, this.basketY, this.basketW, C.basket.h, game.time, this.invulnT);
      if (this.shieldOn) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.15 * Math.sin(game.time * 6);
        ctx.strokeStyle = '#74c0fc'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.bx * v.w, this.basketY - 6, this.basketW * 0.75, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    },
    drawHud: function (game, ctx) {
      var C = G.config.palette, t = i18n(), v = game.view;
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.34), C.text, 'left', 800);
      E.ui.text(ctx, t.t('hud_score', { n: this.score }), 12, y + this.hudH * 0.30, Math.round(this.hudH * 0.24), C.star, 'left', 800);
      // цель уровня
      var goalText = t.t('hud_goal', { a: this.caught, b: G.config.levelGoal(this.level) });
      E.ui.text(ctx, goalText, v.w / 2, y, Math.round(this.hudH * 0.26), C.dim, 'center', 700);
      // жизни
      var hearts = '';
      for (var i = 0; i < G.config.lives; i++) hearts += i < this.lives ? '♥' : '♡';
      E.ui.text(ctx, hearts, v.w / 2, y + this.hudH * 0.30, Math.round(this.hudH * 0.26), C.heart, 'center', 800);
      // пыль и таймеры справа от кнопок
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      var cxr = v.w - 2 * (s + 8) - 14;
      E.ui.text(ctx, '✦' + Math.floor(this.dust), cxr, y, Math.round(this.hudH * 0.32), C.dust, 'right', 800);
      if (this.combo >= 5) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(game.time * 7);
        E.ui.text(ctx, '×' + this.comboMult(), cxr, y + this.hudH * 0.3, Math.round(this.hudH * 0.26), C.x2, 'right', 800);
        ctx.globalAlpha = 1;
      }
      if (this.x2T > 0) E.ui.text(ctx, '✦×2', cxr - 60, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.x2, 'right', 800);
      if (this.slowT > 0) E.ui.text(ctx, '⏱', cxr - 100, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.slow, 'right', 800);
      if (this.magnetT > 0) E.ui.text(ctx, '🧲', cxr - 140, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.nova, 'right', 800);
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
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,13,36,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,32,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, v.h * 0.32, 34, C.text, 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) {
        E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,32,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
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
      ctx.fillStyle = 'rgba(8,12,32,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('gameover_title'), v.w / 2, v.h * 0.34, 30, C.text, 'center', 800);
      E.ui.text(ctx, t.t('revive_offer'), v.w / 2, v.h * 0.34 + 38, 17, C.dim, 'center', 600);
      E.ui.drawButtons(ctx, this.reviveButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.reviveButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawOver: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,32,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
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
      var msgs = [t.t('tut_move'), t.t('tut_avoid'), t.t('tut_combo')];
      var step = Math.min(2, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + 10;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 500);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 34, 17);
      ctx.fillStyle = 'rgba(10,13,36,0.95)'; ctx.fill();
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
