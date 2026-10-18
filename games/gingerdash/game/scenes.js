/* game/scenes.js — сцены menu и play «Рыжего Побега».
   Контракт с pipeline/capture-gingerdash.mjs:
   - capture-параметры: wave=N = УРОВЕНЬ, t=SEC = прогон autopilot-симуляции,
     mode=shop|over|dead|revive = форсированный экран, freeze=1 — заморозка кадра.
   - Record-safe (?record/?autoplay): автопилот сам перепрыгивает препятствия.
   - Стики-баннер — ТОЛЬКО вне геймплея (menu/over), в play его нет (4.6). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function i18n() { return E.i18n; }
  function T(k, v) { return E.i18n.t(k, v); }

  /* ---------- фон: луг, солнце, облака, цветы ---------- */
  function makeMeadow(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float() * 0.7, s: rng.range(0.05, 0.12),
               sp: rng.range(0.01, 0.03), a: rng.range(0.5, 0.85) });
    }
    return s;
  }
  function makeFlowers(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), k: rng.range(0.7, 1.3),
               hue: rng.pick(['#ff8fb3', '#ffd43b', '#b197fc', '#ff6b9d', '#fff3d6']) });
    }
    return s;
  }
  function drawBackground(game, ctx, meadow, flowers, t, scroll) {
    var v = game.view, C = G.config.palette;
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, C.bg2); grd.addColorStop(0.7, C.bg); grd.addColorStop(1, '#ffecc2');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    G.art.drawSun(ctx, v.w * 0.85, v.h * 0.14, Math.min(v.w, v.h) * 0.08, t);
    // облака
    for (var i = 0; i < meadow.length; i++) {
      var c = meadow[i];
      var cx = ((c.x - (scroll || 0) * c.sp * 0.02) % 1.2 + 1.2) % 1.2 * v.w - v.w * 0.1;
      ctx.save();
      ctx.globalAlpha = c.a * 0.5;
      ctx.fillStyle = '#fff8ea';
      var s = c.s * Math.min(v.w, v.h);
      ctx.beginPath();
      ctx.arc(cx - s * 0.4, c.y * v.h, s * 0.4, 0, Math.PI * 2);
      ctx.arc(cx, c.y * v.h - s * 0.12, s * 0.5, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.42, c.y * v.h, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // холмы сзади
    ctx.fillStyle = 'rgba(122,182,72,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, v.h * 0.8);
    for (var hx = 0; hx <= v.w; hx += v.w / 8) {
      ctx.quadraticCurveTo(hx + v.w / 16, v.h * 0.72 + Math.sin(hx * 0.01 + 2) * 14, hx + v.w / 8, v.h * 0.8);
    }
    ctx.lineTo(v.w, v.h); ctx.lineTo(0, v.h); ctx.closePath(); ctx.fill();
  }
  function drawGround(game, ctx, scroll) {
    var v = game.view, C = G.config.palette;
    var gy = this.groundY;
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, gy, v.w, v.h - gy);
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, gy, v.w, Math.max(8, v.h * 0.02));
    // колоски бегут справа налево
    ctx.strokeStyle = '#5c9632'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    var step = 46;
    var off = (scroll * 0.9) % step;
    for (var gx = -step; gx < v.w + step; gx += step) {
      var x = gx - off;
      ctx.beginPath(); ctx.moveTo(x, gy + 2); ctx.lineTo(x + 4, gy - 8 - ((gx * 7919) % 7)); ctx.stroke();
    }
  }

  /* ========================================================= MENU */
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.t = 0;
      this.meadow = makeMeadow(8, 3131);
      this.flowers = makeFlowers(14, 555);
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
      this.stageY = availH * 0.42;
      this.stageH = Math.min(availH * 0.3, 190);
      var contentTop = this.stageY + this.stageH / 2 + (best > 0 ? 26 * k : 16 * k);
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
      drawBackground(game, ctx, this.meadow, this.flowers, this.t, this.t * 120);
      // сцена: кот бежит по траве, впереди ящик и рыбка
      var gy = this.stageY + this.stageH / 2;
      ctx.save();
      ctx.translate(0, 0);
      var fake = { view: v };
      this.groundY = gy;
      drawGround.call(this, fake, ctx, this.t * 300);
      G.art.drawCat(ctx, v.w * 0.36, gy - 34, Math.min(v.w, v.h) * 0.16, this.t, Math.sin(this.t * 2) > 0.6 ? 1 : 0);
      G.art.drawBox(ctx, v.w * 0.62, gy - 22, Math.min(v.w, v.h) * 0.11, this.t);
      G.art.drawFish(ctx, v.w * 0.5, gy - 80, 14, this.t, 1);
      G.art.drawBird(ctx, v.w * 0.76, gy - 70, Math.min(v.w, v.h) * 0.08, this.t);
      ctx.restore();
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 54 * (this.k || 1), 800);
      ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(90,50,20,0.9)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.strokeText(title, v.w / 2, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#fff9db'); tg.addColorStop(1, '#ffd43b');
      ctx.fillStyle = tg; ctx.fillText(title, v.w / 2, this.titleY);
      if (this.best > 0) E.ui.text(ctx, t.t('menu_best', { n: this.best }), v.w / 2, this.titleY + 34 * (this.k || 1), Math.round(18 * (this.k || 1)), C.dim);
      E.ui.drawButtons(ctx, this.buttons);
      var hintSize = E.ui.fit(ctx, t.t('menu_hint'), v.w * 0.92, this.hintSize, 400);
      E.ui.text(ctx, t.t('menu_hint'), v.w / 2, this.hintY, hintSize, C.dim, 'center', 400);
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
      this.meadow = makeMeadow(7, 888);
      this.flowers = makeFlowers(16, 999);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.score = 0; this.dust = 0;
      this.extraLives = 0;
      this.lives = C.lives; this.combo = 0;
      this.seenGold = false;
      this.distance = 0;          // метры текущего уровня
      this.scroll = 0;            // мировой скролл px
      this.cat = { x: 0, y: 0, w: 46, h: 40, vy: 0, air: false };
      this.obstacles = [];
      this.fishes = [];
      this.nextSpawn = 0;
      this.slowT = 0; this.magnetT = 0; this.shield = false;
      this.reviveUsed = false;
      this.floaters = [];
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0;
      this.stats = E.storage.get('stats', { games: 0, bestM: 0 });
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
      this.meadow = makeMeadow(7, 888);
      this.flowers = makeFlowers(16, 999);
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
      this.groundY = v.h - Math.max(46, availH * 0.16);
      this.cat.x = clamp(v.w * 0.24, 80, v.w * 0.4);
      if (!this.cat.y) this.cat.y = this.groundY - this.cat.h;
    },

    /* ---------- capture ---------- */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      var keepSafe = this.safeRun;
      this.autopilot = true;
      this.safeRun = true; // на прогоне кот неуязвим: препятствия проходят сквозь
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.update(game, dt);
        if (E.fx) E.fx.update(dt);
        game.time += dt;
      }
      this.autopilot = keepAuto;
      this.safeRun = keepSafe;
    },
    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave) {
        var lv = clamp(parseInt(P.wave, 10) || 1, 1, G.config.maxLevel);
        this.level = lv;
        this.distance = Math.floor(G.config.levelGoal(lv) * 0.5);
        this.score = lv * 120;
        this.dust = lv * 40;
        this.combo = 2;
        // засеваем трассу, чтобы кадр был «в процессе»
        var n = 3 + Math.min(4, lv);
        for (var i = 0; i < n; i++) {
          var type = i % 2 === 0 ? 'box' : 'bird';
          this.obstacles.push(G.makeObstacle(type, 200 + i * 190 + this.rng.float() * 40, this.groundY, lv, this.rng));
        }
        for (var f = 0; f < 4; f++) {
          this.fishes.push(G.makeFish(160 + f * 130 + this.rng.float() * 30, this.groundY - 70 - this.rng.float() * 60, 12, this.rng));
        }
        // золотая рыбка в кадре — с 3 уровня
        if (lv >= G.config.goldfishFromLevel) {
          this.fishes.push(G.makeFish(game.view.w * 0.72, this.groundY - G.config.goldfishMinH - 10, 13, this.rng, true));
        }
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

    /* ---------- очки / рыбки ---------- */
    comboMult: function () { return Math.min(G.config.score.comboCap, 1 + Math.floor(this.combo / 6)); },
    addScore: function (n, x, y) {
      var mult = this.comboMult();
      var gained = n * mult;
      this.score += gained;
      this.addFloater(x, y, '+' + gained + (mult > 1 ? ' ×' + mult : ''), G.config.palette.gold);
    },
    addDust: function (n, x, y) {
      this.dust += n;
      if (x != null) this.addFloater(x, y - 26, '+' + n + ' 🐟', G.config.palette.dust);
    },
    addFloater: function (x, y, text, color) {
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },
    saveGame: function () {
      var best = Math.max(E.storage.get('best', 0), this.score);
      E.storage.set('best', best);
      E.storage.set('run', { level: this.level, score: this.score, dust: Math.floor(this.dust) });
    },

    /* ---------- спавн и мир ---------- */
    spawnObstacle: function (game) {
      var C = G.config, v = game.view;
      var roll = this.rng.float();
      var type = (this.level < 4 || roll < 0.65) ? 'box' : 'bird';
      this.obstacles.push(G.makeObstacle(type, v.w + 60, this.groundY, this.level, this.rng));
      // золотая рыбка: редкий бонус высоко над землёй (нужен двойной прыжок)
      if (this.level >= C.goldfishFromLevel && this.rng.chance(C.goldfishChance)) {
        var gy = this.groundY - C.goldfishMinH - this.rng.float() * 40;
        this.fishes.push(G.makeFish(v.w + 140 + this.rng.float() * 100, gy, 13, this.rng, true));
      } else if (this.rng.chance(0.55)) {
        var fy = this.groundY - 60 - this.rng.float() * 90;
        this.fishes.push(G.makeFish(v.w + 90 + this.rng.float() * 120, fy, 12, this.rng));
      }
    },
    jump: function (game) {
      // двойной прыжок разрешён: кот может подпрыгнуть ещё раз в воздухе
      this.cat.vy = G.config.jumpV;
      this.cat.air = true;
      E.audio.sfx('jump');
    },
    hitObstacle: function (game, o) {
      if (this.shield) {
        this.shield = false;
        E.fx.burst(o.x + o.w / 2, o.y + o.h / 2, '#69db7c', 16, 130, this.visRng);
        E.audio.sfx('pulse');
        this.addFloater(o.x + o.w / 2, o.y, '🛡', '#69db7c');
        return;
      }
      this.lives--;
      this.combo = 0;
      E.fx.shake(5, 0.3);
      E.fx.flash('#ff5d5d', 0.22);
      E.fx.burst(o.x + o.w / 2, o.y + o.h / 2, '#ff8787', 18, 150, this.visRng);
      E.audio.sfx('hit');
      if (this.lives <= 0) { this.onDeath(game); }
    },
    checkLevelUp: function (game) {
      var need = G.config.levelGoal(this.level);
      if (this.distance < need) return;
      if (this.level >= G.config.maxLevel) { this.victory(game, false); return; }
      var reward = 30 + this.level * 10;
      if (this.recordMode) reward = Math.min(reward, G.config.recordRewardCap);
      this.dust += reward;
      this.level++;
      this.distance = 0;
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
    buyMagnet: function (game) {
      var p = G.config.economy.magnetPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.magnetT = G.config.economy.magnetDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyShield: function (game) {
      var p = G.config.economy.shieldPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.shield = true;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buySlow: function (game) {
      var p = G.config.economy.slowPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.slowT = G.config.economy.slowDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyHeart: function (game) {
      var p = G.config.economy.heartPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p;
      this.extraLives = (this.extraLives || 0) + 1;
      this.lives++;
      E.audio.sfx('buy');
      var v = game.view;
      this.addFloater(v.w / 2, this.hudH + 40, T('heart_done', { n: this.lives }), '#ff6b9d');
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
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
    },
    updateRunning: function (game, dt) {
      var v = game.view, C = G.config;
      var slowK = this.slowT > 0 ? 0.55 : 1;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.magnetT > 0) this.magnetT -= dt;
      // скорость
      var sp = C.runSpeed(this.level) * slowK;
      if (this.recordMode) sp = Math.min(sp, C.recordMaxSpeed);
      this.scroll += sp * dt;
      this.distance += sp * dt / 40; // 40 px = 1 метр
      this.score += Math.floor(sp * dt / 40) * C.score.meter;
      // прыжок кота
      if (this.cat.air) {
        this.cat.vy += C.gravity * dt;
        this.cat.y += this.cat.vy * dt;
        if (this.cat.y >= this.groundY - this.cat.h) {
          this.cat.y = this.groundY - this.cat.h;
          this.cat.air = false;
          this.cat.vy = 0;
          E.fx.burst(this.cat.x + 20, this.groundY, '#d9a65e', 5, 60, this.visRng);
        }
      }
      // спавн препятствий по интервалу скролла
      this.nextSpawn -= sp * dt;
      if (this.nextSpawn <= 0) {
        this.spawnObstacle(game);
        this.nextSpawn = C.spawnGap(this.level) * 220;
      }
      // движение мира
      for (var i = this.obstacles.length - 1; i >= 0; i--) {
        var o = this.obstacles[i];
        o.x -= sp * dt;
        if (o.type === 'bird') {
          // птица взлетает вверх, когда кот приближается — пролетает над ним
          var dx = o.x - this.cat.x;
          if (dx < 320) o.y -= dt * 260;
        }
        if (o.x + o.w < -40) { this.obstacles.splice(i, 1); continue; }
        // столкновение
        if (G.aabb(this.cat.x, this.cat.y, this.cat.w, this.cat.h, o)) {
          this.obstacles.splice(i, 1);
          if (!this.recordMode && !this.safeRun) this.hitObstacle(game, o);
          else E.fx.burst(o.x + o.w / 2, o.y + o.h / 2, '#ffd43b', 8, 80, this.visRng);
        }
      }
      for (var j = this.fishes.length - 1; j >= 0; j--) {
        var f = this.fishes[j];
        f.x -= sp * dt;
        if (f.x < -30) { this.fishes.splice(j, 1); continue; }
        var mr = this.magnetT > 0 ? 96 : 0;
        if (mr && Math.abs(f.x - this.cat.x) < mr && Math.abs(f.y - this.cat.y) < mr) {
          f.x += (this.cat.x - f.x) * dt * 6;
          f.y += (this.cat.y - f.y) * dt * 6;
        }
        if (G.hitCircle(this.cat.x + this.cat.w / 2, this.cat.y + this.cat.h / 2, f)) {
          this.fishes.splice(j, 1);
          this.combo++;
          if (f.gold) {
            this.addScore(C.score.goldfish, f.x, f.y);
            this.addDust(10, f.x, f.y);
            E.fx.burst(f.x, f.y, '#ffd43b', 20, 170, this.visRng);
            E.fx.flash('rgba(255,212,59,0.22)', 0.25);
            this.addFloater(f.x, f.y - 20, T('goldfish_caught'), '#ffd43b');
            E.audio.sfx('wave');
            this.seenGold = true;
          } else {
            this.addScore(C.score.fish, f.x, f.y);
            this.addDust(2, f.x, f.y);
            E.fx.burst(f.x, f.y, '#4dabf7', 8, 90, this.visRng);
            E.audio.sfx('coin');
          }
          this.saveGame();
        }
      }
      this.checkLevelUp(game);
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
        this.jump(game);
      }
      if (E.input.wasPressed('Space') || E.input.wasPressed('ArrowUp')) this.jump(game);
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    /* Autopilot: прыгает перед препятствием на расчётной дистанции. */
    driveAutopilot: function (dt, game) {
      if (this.cat.air) return;
      this._autoT -= dt;
      if (this._autoT > 0) return;
      this._autoT = 0.05;
      for (var i = 0; i < this.obstacles.length; i++) {
        var o = this.obstacles[i];
        if (o.type === 'bird') continue; // птицу перепрыгивать нельзя — она на высоте прыжка; просто не прыгаем под неё
        var dx = o.x - this.cat.x;
        if (dx > 0 && dx < 140) { this.jump(game); return; }
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
      var rows = 5; // magnet, shield, slow, heart, далее
      var bh = Math.max(38, Math.min(50, (v.h * 0.52) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 14,
        text: t.t('item_magnet', { s: C.economy.magnetDur }) + ' — ' + C.economy.magnetPrice + ' 🐟',
        enabled: this.dust >= C.economy.magnetPrice,
        onTap: function () { self.buyMagnet(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + (bh + 8), w: bw, h: bh, fontSize: 14,
        text: t.t('item_shield') + ' — ' + C.economy.shieldPrice + ' 🐟',
        enabled: this.dust >= C.economy.shieldPrice && !this.shield,
        onTap: function () { self.buyShield(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 2 * (bh + 8), w: bw, h: bh, fontSize: 14,
        text: t.t('item_slow', { s: C.economy.slowDur }) + ' — ' + C.economy.slowPrice + ' 🐟',
        enabled: this.dust >= C.economy.slowPrice,
        onTap: function () { self.buySlow(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 3 * (bh + 8), w: bw, h: bh, fontSize: 14,
        text: t.t('item_heart') + ' — ' + C.economy.heartPrice + ' 🐟',
        enabled: this.dust >= C.economy.heartPrice,
        onTap: function () { self.buyHeart(game); }
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
              self.obstacles = [];
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
      drawBackground(game, ctx, this.meadow, this.flowers, game.time, this.scroll);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      drawGround.call(this, game, ctx, this.scroll);
      this.drawWorld(game, ctx);
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
    drawWorld: function (game, ctx) {
      var t = game.time;
      for (var i = 0; i < this.fishes.length; i++) {
        var f = this.fishes[i];
        if (f.gold) G.art.drawGoldFish(ctx, f.x, f.y, f.r, t, f.phase);
        else G.art.drawFish(ctx, f.x, f.y, f.r, t, f.phase);
      }
      for (var j = 0; j < this.obstacles.length; j++) {
        var o = this.obstacles[j];
        if (o.type === 'box') G.art.drawBox(ctx, o.x + o.w / 2, o.y + o.h / 2, o.w, t);
        else if (o.type === 'puddle') G.art.drawPuddle(ctx, o.x + o.w / 2, o.y + o.h - 4, o.w, t);
        else G.art.drawBird(ctx, o.x + o.w / 2, o.y + o.h / 2, o.h * 0.8, t);
      }
      G.art.drawCat(ctx, this.cat.x + this.cat.w / 2, this.cat.y + this.cat.h / 2, this.cat.h * 1.35, t, this.cat.air ? 1 : 0);
      if (this.shield) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.15 * Math.sin(t * 6);
        ctx.strokeStyle = '#69db7c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.cat.x + this.cat.w / 2, this.cat.y + this.cat.h / 2, this.cat.h * 1.1, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    },
    drawHud: function (game, ctx) {
      var C = G.config.palette, t = i18n(), v = game.view;
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.34), C.text, 'left', 800);
      E.ui.text(ctx, t.t('hud_score', { n: this.score }), 12, y + this.hudH * 0.30, Math.round(this.hudH * 0.24), C.star, 'left', 800);
      var goalText = t.t('hud_goal', { a: Math.floor(this.distance), b: G.config.levelGoal(this.level) });
      E.ui.text(ctx, goalText, v.w / 2, y, Math.round(this.hudH * 0.26), C.dim, 'center', 700);
      var hearts = '';
      var totalLives = G.config.lives + (this.extraLives || 0);
      for (var i = 0; i < totalLives; i++) hearts += i < this.lives ? '♥' : '♡';
      E.ui.text(ctx, hearts, v.w / 2, y + this.hudH * 0.30, Math.round(this.hudH * 0.26), C.heart, 'center', 800);
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      var cxr = v.w - 2 * (s + 8) - 14;
      E.ui.text(ctx, '🐟' + Math.floor(this.dust), cxr, y, Math.round(this.hudH * 0.32), C.dust, 'right', 800);
      if (this.combo >= 6) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(game.time * 7);
        E.ui.text(ctx, '×' + this.comboMult(), cxr, y + this.hudH * 0.3, Math.round(this.hudH * 0.26), C.accent, 'right', 800);
        ctx.globalAlpha = 1;
      }
      if (this.magnetT > 0) E.ui.text(ctx, '🧲', cxr - 60, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.accent, 'right', 800);
      if (this.slowT > 0) E.ui.text(ctx, '⏱', cxr - 100, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.accent, 'right', 800);
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
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(90,50,20,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(74,47,24,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, v.h * 0.32, 34, '#fff6ea', 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) {
        E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(74,47,24,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 34, 30, '#fff6ea', 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: Math.floor(this.dust) }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 6, 18, C.dust, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeShop(game);
    },
    drawRevive: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(74,47,24,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('gameover_title'), v.w / 2, v.h * 0.34, 30, '#fff6ea', 'center', 800);
      E.ui.text(ctx, t.t('revive_offer'), v.w / 2, v.h * 0.34 + 38, 17, '#ffd9a0', 'center', 600);
      E.ui.drawButtons(ctx, this.reviveButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.reviveButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawOver: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(74,47,24,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      var titleKey = this.mode === 'over' ? 'over_title' : 'gameover_title';
      E.ui.text(ctx, t.t(titleKey), v.w / 2, v.h * 0.26, 32, '#fff6ea', 'center', 800);
      E.ui.text(ctx, t.t('over_score', { n: this.score }), v.w / 2, v.h * 0.26 + 40, 20, '#ffd9a0', 'center', 600);
      if (this.newBest) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
        E.ui.text(ctx, t.t('over_newbest'), v.w / 2, v.h * 0.26 + 70, 20, '#ffd43b', 'center', 800);
        ctx.globalAlpha = 1;
      } else {
        E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, v.h * 0.26 + 70, 18, '#ffd9a0', 'center', 600);
      }
      E.ui.drawButtons(ctx, this.overButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      var msgs = [t.t('tut_tap'), t.t('tut_hazard'), t.t('tut_combo'), t.t('tut_gold')];
      var step = Math.min(3, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + 10;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 500);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 34, 17);
      ctx.fillStyle = 'rgba(74,47,24,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, w - 30, 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 17, size, '#fff6ea', 'center', 600);
      if (this.tutT > 17) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
