/* game/scenes.js — сцены menu и play «Пиццы-Поворота».
   Механика: пицца из 8 кусков внизу экрана, сверху падают топпинги.
   Целевой луч — вертикальный столбец над пиццей; кусок, оказавшийся под ним,
   подсвечен. Тап поворачивает пиццу на один кусок (45°). Поймал целевым
   куском — очки и комбо; промах — пятно и минус жизнь (2 жизни).
   Контракт с pipeline/capture-pizzaspin.mjs:
   - wave=N = УРОВЕНЬ, t=SEC = прогон autopilot-симуляции (сейфран),
     mode=shop|over|dead|revive = форс-экран, freeze=1 — заморозка.
   - Баннер — ТОЛЬКО вне геймплея (menu/over), в play его нет (4.6). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function i18n() { return E.i18n; }
  function T(k, v) { return E.i18n.t(k, v); }
  function lerpAngle(a, b, k) {
    var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * k;
  }

  /* ---------- фон: кухня — стена, скатерть, пар ---------- */
  function makeDots(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(0.008, 0.02), a: rng.range(0.25, 0.5), sp: rng.range(0.01, 0.04) });
    }
    return s;
  }
  function drawBackground(game, ctx, dots, t) {
    var v = game.view, C = G.config.palette;
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, C.bg2); grd.addColorStop(0.65, C.bg); grd.addColorStop(1, '#ffe8cc');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    // пар/пылинки поднимаются
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var dy = ((d.y - t * d.sp) % 1 + 1) % 1;
      ctx.globalAlpha = d.a * (0.4 + 0.6 * dy);
      ctx.beginPath(); ctx.arc(d.x * v.w, dy * v.h, d.r * Math.min(v.w, v.h), 0, Math.PI * 2); ctx.fill();
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
      this.dots = makeDots(14, 4242);
      this.rot = 0;
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
      this.stageY = availH * 0.4;
      this.stageH = Math.min(availH * 0.34, 210);
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
      this.rot += dt * 0.25;
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', {});
    },
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      drawBackground(game, ctx, this.dots, this.t);
      // сцена: пицца крутится, над ней парит топпинг, рядом поварёнок
      var gy = this.stageY;
      var R = this.stageH * 0.48;
      G.art.drawPizza(ctx, v.w * 0.42, gy, R, this.rot, G.config.slices, 1, this.t);
      var bob = Math.sin(this.t * 2.2) * 8;
      G.art.drawTopping(ctx, 'pepperoni', v.w * 0.42 + R * 0.4, gy - R - 30 + bob, 17, this.t);
      G.art.drawTopping(ctx, 'olive', v.w * 0.42 - R * 0.5, gy - R - 14 - bob * 0.6, 15, this.t);
      G.art.drawChef(ctx, v.w * 0.72, gy + this.stageH * 0.1, this.stageH * 0.32, this.t);

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
      this.dots = makeDots(12, 888);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.score = 0; this.dust = 0;
      this.lives = C.lives; this.combo = 0;
      this.caught = 0;             // поймано топпингов на уровне
      this.rot = 0; this.rotTarget = 0;
      this.goldenIdx = 0;          // золотой кусок (локальный индекс)
      this.toppings = [];
      this.stains = [];
      this.spawnT = 1.1;
      this.slowT = 0; this.doublerT = 0; this.wideT = 0; this.shield = false;
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
      this.dots = makeDots(12, 888);
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
      this.pizzaR = Math.min(v.w, availH) * 0.26;
      this.pizzaX = v.w / 2;
      this.pizzaY = availH - this.pizzaR - Math.max(20, availH * 0.06);
      this.spawnY = this.hudH + 30;
    },

    /* ---------- capture ---------- */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      var keepSafe = this.safeRun;
      this.autopilot = true;
      this.safeRun = true; // на прогоне промахи не ранят: пицца не может подгореть
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
        this.caught = Math.floor(G.config.levelGoal(lv) * 0.5);
        this.score = lv * 120;
        this.dust = lv * 40;
        this.combo = 3;
        // засеваем небо, чтобы кадр был «в процессе»
        var n = 2 + Math.min(3, lv);
        var fallH = this.pizzaY - this.pizzaR - this.spawnY;
        for (var i = 0; i < n; i++) {
          var tx = this.pizzaX + (this.rng.float() * 2 - 1) * this.pizzaR * 0.6;
          var tp = G.makeTopping(tx, this.spawnY + fallH * (0.15 + 0.6 * this.rng.float()),
                                 G.config.fallSpeed(lv), this.rng);
          this.toppings.push(tp);
        }
        if (lv >= G.config.goldenFromLevel) {
          this.toppings.push(G.makeTopping(this.pizzaX - this.pizzaR * 0.3,
            this.spawnY + fallH * 0.3, G.config.fallSpeed(lv), this.rng, true));
        }
        this.rotTarget = this.rot = this.rng.float() * Math.PI * 2;
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

    /* ---------- очки / крошки ---------- */
    comboMult: function () { return Math.min(G.config.score.comboCap, 1 + Math.floor(this.combo / 5)); },
    addScore: function (n, x, y) {
      var mult = this.comboMult() * (this.doublerT > 0 ? 2 : 1);
      var gained = n * mult;
      this.score += gained;
      this.addFloater(x, y, '+' + gained + (mult > 1 ? ' ×' + mult : ''), G.config.palette.gold);
    },
    addDust: function (n, x, y) {
      this.dust += n;
      if (x != null) this.addFloater(x, y - 26, '+' + n + ' 🍕', G.config.palette.dust);
    },
    addFloater: function (x, y, text, color) {
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },
    saveGame: function () {
      var best = Math.max(E.storage.get('best', 0), this.score);
      E.storage.set('best', best);
      E.storage.set('run', { level: this.level, score: this.score, dust: Math.floor(this.dust) });
    },

    /* ---------- геометрия цели ---------- */
    // золотой кусок — физический кусок пиццы (индекс в локальных координатах),
    // вращается вместе с ней; ловить топпинги надо им.
    rotateOnce: function (game) {
      this.rotTarget += Math.PI * 2 / G.config.slices;
      E.audio.sfx('click');
    },

    // сколько кусков сейчас в золотой зоне (1 или 2 с «Широким куском»)
    goldenSpan: function () { return this.wideT > 0 ? 2 : 1; },
    inGolden: function (idx) {
      var N = G.config.slices;
      for (var k = 0; k < this.goldenSpan(); k++) {
        if (idx === (this.goldenIdx + k) % N) return true;
      }
      return false;
    },

    /* ---------- спавн / попадания ---------- */
    spawnTopping: function (game) {
      var vy = G.config.fallSpeed(this.level);
      if (this.slowT > 0) vy *= 0.55;
      if (this.recordMode) vy = Math.min(vy, G.config.recordMaxSpeed);
      var x = this.pizzaX + (this.rng.float() * 2 - 1) * this.pizzaR * 0.7;
      var gold = this.level >= G.config.goldenFromLevel && this.rng.float() < G.config.goldenChance;
      this.toppings.push(G.makeTopping(x, this.spawnY, vy, this.rng, gold));
    },
    // смещение по x в момент приземления (учитывает покачивание)
    landingX: function (tp, time) { return tp.x + Math.sin(time * tp.wobF + tp.phase) * tp.wobA; },
    landTopping: function (game, tp) {
      var hitX = this.landingX(tp, game.time), hitY = this.pizzaY - this.pizzaR;
      // на какой кусок попал топпинг: угол точки приземления в локальных координатах
      var local = ((Math.atan2(-this.pizzaR, hitX - this.pizzaX) - this.rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      var N = G.config.slices;
      var idx = Math.floor(local / (Math.PI * 2 / N)) % N;
      if (this.inGolden(idx)) {
        this.combo++;
        this.caught++;
        if (tp.gold) {
          this.addScore(G.config.score.golden, hitX, hitY - 10);
          this.addDust(5, hitX, hitY - 10);
          E.fx.burst(hitX, hitY, '#ffd43b', 22, 170, this.visRng);
          E.audio.sfx('wave');
          this.addFloater(hitX, hitY - 46, T('golden_caught'), '#ffd43b');
        } else {
          this.addScore(G.config.score.catch, hitX, hitY - 10);
          this.addDust(2, hitX, hitY - 10);
          E.fx.burst(hitX, hitY, '#ffd43b', 10, 100, this.visRng);
          E.audio.sfx('coin');
        }
        this.checkLevelUp(game);
      } else {
        this.missTopping(game, tp);
      }
      this.saveGame();
    },
    missTopping: function (game, tp) {
      var hitX = this.landingX(tp, game.time), hitY = this.pizzaY - this.pizzaR + 6;
      if (this.shield) {
        this.shield = false;
        E.fx.burst(hitX, hitY, '#69db7c', 16, 130, this.visRng);
        E.audio.sfx('pulse');
        this.addFloater(hitX, hitY - 20, '🛡', '#69db7c');
        return;
      }
      this.stains.push({ x: hitX + (this.rng.float() - 0.5) * 20, y: hitY + 4, r: 14 + this.rng.float() * 8 });
      if (this.stains.length > 5) this.stains.shift();
      this.lives--;
      this.combo = 0;
      E.fx.shake(5, 0.3);
      E.fx.flash('#ff5d5d', 0.22);
      E.fx.burst(hitX, hitY, '#8a5a3b', 16, 130, this.visRng);
      E.audio.sfx('hit');
      if (this.lives <= 0) { this.onDeath(game); }
    },
    checkLevelUp: function (game) {
      var need = G.config.levelGoal(this.level);
      if (this.caught < need) return;
      if (this.level >= G.config.maxLevel) { this.victory(game, false); return; }
      var reward = 30 + this.level * 10;
      if (this.recordMode) reward = Math.min(reward, G.config.recordRewardCap);
      this.dust += reward;
      this.level++;
      this.caught = 0;
      E.audio.sfx('wave');
      E.fx.flash('#ffe066', 0.18);
      this.addFloater(this.pizzaX, this.hudH + 40, T('levelup', { n: this.level, c: reward }), '#ffe066');
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
    buyDoubler: function (game) {
      var p = G.config.economy.doublerPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.doublerT = G.config.economy.doublerDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyWide: function (game) {
      var p = G.config.economy.widePrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.wideT = G.config.economy.wideDur;
      E.audio.sfx('buy');
      this.addFloater(this.pizzaX, this.pizzaY - this.pizzaR - 30, T('wide_done', { s: G.config.economy.wideDur }), '#ffb93e');
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
      if (this.slowT > 0) this.slowT -= dt;
      if (this.doublerT > 0) this.doublerT -= dt;
      if (this.wideT > 0) this.wideT -= dt;
      // пицца догоняет целевой угол (пружинно)
      this.rot = lerpAngle(this.rot, this.rotTarget, Math.min(1, dt * 14));
      // спавн
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnTopping(game);
        this.spawnT = G.config.spawnGap(this.level);
      }
      // падение
      var hitLine = this.pizzaY - this.pizzaR;
      for (var i = this.toppings.length - 1; i >= 0; i--) {
        var tp = this.toppings[i];
        tp.y += tp.vy * dt;
        tp.angle += tp.spin * dt;
        if (tp.y >= hitLine) {
          this.toppings.splice(i, 1);
          if (!this.recordMode && !this.safeRun) this.landTopping(game, tp);
          else {
            // сейфран/запись: считаем ловлей без риска
            var lx = this.landingX(tp, game.time);
            this.combo++;
            this.caught++;
            this.addScore(G.config.score.catch, lx, hitLine - 10);
            E.fx.burst(lx, hitLine, '#ffd43b', 8, 90, this.visRng);
            this.checkLevelUp(game);
          }
        }
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
        this.rotateOnce(game);
      }
      if (E.input.wasPressed('Space') || E.input.wasPressed('ArrowRight')) this.rotateOnce(game);
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    /* Autopilot: держит подсвеченный кусок рядом с ближайшим топпингом —
       докручивает пиццу на нужное число шагов за 0.3 с до приземления.
       В реальной игре игрок целится сам; тут достаточно не промахиваться
       и красиво крутиться (запись видео). */
    driveAutopilot: function (dt, game) {
      this._autoT -= dt;
      if (this._autoT > 0) return;
      this._autoT = 0.06;
      var hitLine = this.pizzaY - this.pizzaR;
      var best = null, bestY = -Infinity;
      for (var i = 0; i < this.toppings.length; i++) {
        var tp = this.toppings[i];
        if (tp.y < hitLine && tp.y > bestY) { bestY = tp.y; best = tp; }
      }
      if (!best) return;
      var tLand = (hitLine - best.y) / best.vy;
      if (tLand > 0.45 || tLand < 0) return;
      // докручиваем так, чтобы золотой кусок (local∈[0,step)) оказался под точкой падения
      var lx = this.landingX(best, game.time + tLand);
      var local = ((Math.atan2(-this.pizzaR, lx - this.pizzaX) - this.rotTarget) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      var N = G.config.slices, step = Math.PI * 2 / N;
      var s = Math.floor(local / step) % N;   // сколько шагов вперёд до нуля
      if (s > N / 2) s -= N;                  // кратчайшая сторона
      if (s !== 0) {
        this.rotTarget += s * step;
        E.audio.sfx('click');
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
      var rows = 5; // shield, slow, doubler, wide, далее
      var bh = Math.max(36, Math.min(48, (v.h * 0.52) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 14,
        text: t.t('item_shield') + ' — ' + C.economy.shieldPrice + ' 🍕',
        enabled: this.dust >= C.economy.shieldPrice && !this.shield,
        onTap: function () { self.buyShield(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + (bh + 8), w: bw, h: bh, fontSize: 14,
        text: t.t('item_slow', { s: C.economy.slowDur }) + ' — ' + C.economy.slowPrice + ' 🍕',
        enabled: this.dust >= C.economy.slowPrice,
        onTap: function () { self.buySlow(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 2 * (bh + 8), w: bw, h: bh, fontSize: 14,
        text: t.t('item_doubler', { s: C.economy.doublerDur }) + ' — ' + C.economy.doublerPrice + ' 🍕',
        enabled: this.dust >= C.economy.doublerPrice,
        onTap: function () { self.buyDoubler(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 3 * (bh + 8), w: bw, h: bh, fontSize: 14,
        text: t.t('item_wide', { s: C.economy.wideDur }) + ' — ' + C.economy.widePrice + ' 🍕',
        enabled: this.dust >= C.economy.widePrice,
        onTap: function () { self.buyWide(game); }
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
              self.toppings = [];
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
      drawBackground(game, ctx, this.dots, game.time);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
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
      var t = game.time, C = G.config.palette;
      // пицца (золотая зона вращается вместе с ней; span=2 с «Широким куском»)
      G.art.drawPizza(ctx, this.pizzaX, this.pizzaY, this.pizzaR, this.rot, G.config.slices, this.goldenIdx, t, this.goldenSpan());
      // пятна промахов (поверх корки)
      for (var s = 0; s < this.stains.length; s++) {
        var st = this.stains[s];
        G.art.drawStain(ctx, st.x, st.y, st.r);
      }
      // падающие топпинги
      for (var i = 0; i < this.toppings.length; i++) {
        var tp = this.toppings[i];
        ctx.save();
        ctx.translate(tp.x, tp.y);
        ctx.rotate(tp.angle);
        if (tp.gold) G.art.drawGoldTopping(ctx, 0, 0, tp.r, t);
        else G.art.drawTopping(ctx, tp.type, 0, 0, tp.r, t);
        ctx.restore();
      }
      // щит
      if (this.shield) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.15 * Math.sin(t * 6);
        ctx.strokeStyle = '#69db7c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.pizzaX, this.pizzaY, this.pizzaR * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    },
    drawHud: function (game, ctx) {
      var C = G.config.palette, t = i18n(), v = game.view;
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.34), C.text, 'left', 800);
      E.ui.text(ctx, t.t('hud_score', { n: this.score }), 12, y + this.hudH * 0.30, Math.round(this.hudH * 0.24), C.star, 'left', 800);
      var goalText = t.t('hud_goal', { a: this.caught, b: G.config.levelGoal(this.level) });
      E.ui.text(ctx, goalText, v.w / 2, y, Math.round(this.hudH * 0.26), C.dim, 'center', 700);
      var hearts = '';
      for (var i = 0; i < G.config.lives; i++) hearts += i < this.lives ? '♥' : '♡';
      E.ui.text(ctx, hearts, v.w / 2, y + this.hudH * 0.30, Math.round(this.hudH * 0.26), C.heart, 'center', 800);
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      var cxr = v.w - 2 * (s + 8) - 14;
      E.ui.text(ctx, '🍕' + Math.floor(this.dust), cxr, y, Math.round(this.hudH * 0.32), C.dust, 'right', 800);
      if (this.combo >= 5) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(game.time * 7);
        E.ui.text(ctx, '×' + this.comboMult(), cxr, y + this.hudH * 0.3, Math.round(this.hudH * 0.26), C.accent, 'right', 800);
        ctx.globalAlpha = 1;
      }
      if (this.doublerT > 0) E.ui.text(ctx, '✦2', cxr - 60, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.doubler, 'right', 800);
      if (this.slowT > 0) E.ui.text(ctx, '⏱', cxr - 100, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.slow, 'right', 800);
      if (this.wideT > 0) E.ui.text(ctx, '▣2', cxr - 140, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.accent, 'right', 800);
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
      if (this.tutT > 16) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
