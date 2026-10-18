/* game/scenes.js — сцены menu и play «Лампового Сада».
   Механика: светлячки блуждают по поляне и периодически вспыхивают.
   Тап по ГОРЯЩЕМУ — ловля (очки, комбо, пыльца). Тап по тёмному — промах
   (комбо в ноль). Гусеницы ползают снизу — укол стоит жизнь (2 жизни).
   Контракт с pipeline/capture-fireflygrove.mjs:
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

  /* ---------- фон: ночная поляна, звёзды, трава ---------- */
  function makeStars(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float() * 0.62, r: rng.range(0.4, 1.6), a: rng.range(0.25, 0.9), tw: rng.range(1.5, 4) });
    }
    return s;
  }
  function makeBlades(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), h: rng.range(0.5, 1.1), lean: rng.range(-0.5, 0.5) });
    }
    return s;
  }
  function drawBackground(game, ctx, stars, blades, t) {
    var v = game.view, C = G.config.palette;
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, C.bg); grd.addColorStop(0.75, C.bg2); grd.addColorStop(1, '#141a36');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * s.tw));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x * v.w, s.y * v.h, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    G.art.drawMoon(ctx, v.w * 0.86, v.h * 0.12, Math.min(v.w, v.h) * 0.06, t);
    // поляна
    ctx.fillStyle = C.grass;
    ctx.beginPath(); ctx.ellipse(v.w / 2, v.h * 1.12, v.w * 0.9, v.h * 0.3, 0, Math.PI, 0); ctx.fill();
    // травинки
    ctx.strokeStyle = C.grassHi; ctx.lineWidth = 2; ctx.lineCap = 'round';
    var baseY = v.h * 0.9;
    for (var b = 0; b < blades.length; b++) {
      var bl = blades[b];
      var bx = bl.x * v.w;
      var bh = bl.h * v.h * 0.05;
      var sway = Math.sin(t * 1.4 + bx * 0.05) * 4 + bl.lean * 6;
      ctx.beginPath(); ctx.moveTo(bx, baseY); ctx.quadraticCurveTo(bx + sway * 0.4, baseY - bh * 0.6, bx + sway, baseY - bh); ctx.stroke();
    }
  }

  /* ========================================================= MENU */
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner();
      this.t = 0;
      this.stars = makeStars(36, 777);
      this.blades = makeBlades(28, 888);
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
      drawBackground(game, ctx, this.stars, this.blades, this.t);
      // сцена: совёнок смотрит на трёх светлячков над травой
      var gy = this.stageY;
      var s0 = Math.min(v.w, v.h);
      G.art.drawBug(ctx, v.w * 0.34, gy - 10 + Math.sin(this.t * 1.7) * 8, s0 * 0.06, this.t, 0.9 + 0.1 * Math.sin(this.t * 3));
      G.art.drawBug(ctx, v.w * 0.52, gy - 34 + Math.sin(this.t * 2.3 + 2) * 10, s0 * 0.05, this.t + 1, 0.7 + 0.3 * Math.sin(this.t * 2.2 + 1));
      G.art.drawBug(ctx, v.w * 0.66, gy + 6 + Math.sin(this.t * 1.9 + 4) * 7, s0 * 0.055, this.t + 2, 0.5 + 0.5 * Math.max(0, Math.sin(this.t * 1.5)));
      G.art.drawOwl(ctx, v.w * 0.44, gy + this.stageH * 0.22, s0 * 0.11, this.t);
      G.art.drawCaterpillar(ctx, v.w * 0.74, gy + this.stageH * 0.4, s0 * 0.05, this.t);

      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 54 * (this.k || 1), 800);
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(8,12,28,0.95)'; ctx.lineJoin = 'round';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.strokeText(title, v.w / 2, this.titleY);
      var tg = ctx.createLinearGradient(0, this.titleY - size / 2, 0, this.titleY + size / 2);
      tg.addColorStop(0, '#fffbe0'); tg.addColorStop(1, '#ffd43b');
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
      this.stars = makeStars(30, 555);
      this.blades = makeBlades(24, 666);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.score = 0; this.dust = 0;
      this.lives = C.lives; this.combo = 0;
      this.caught = 0;
      this.bugs = [];
      this.caters = [];
      this.slowT = 0; this.netT = 0; this.calmT = 0; this.bubble = false;
      this.reviveUsed = false;
      this.floaters = [];
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0;
      this.stats = E.storage.get('stats', { games: 0, bestM: 0 });
      this.stats.games++;
      E.storage.set('stats', this.stats);
      this._autoT = 0;
      this._caterTimer = 6;

      this.layout(game);
      this.buildHudButtons(game);
      this.spawnBugs();
      E.audio.music('play');
      E.sdk.gameplayStart();

      this.applyCaptureParams(game, params);
      this.saveGame();
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      E.fx.reset();
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
      // поляна — под HUD до нижней кромки травы
      this.area = { x0: 20, y0: this.hudH + 24, x1: v.w - 20, y1: availH - Math.max(50, availH * 0.14) };
      for (var i = 0; i < this.bugs.length; i++) this.bugs[i].area = this.area;
      for (var c = 0; c < this.caters.length; c++) this.caters[c].area = this.area;
    },

    spawnBugs: function () {
      this.bugs = [];
      var n = G.config.bugsCount(this.level);
      for (var i = 0; i < n; i++) {
        this.bugs.push(G.makeBug(
          this.area.x0 + 40 + this.rng.float() * (this.area.x1 - this.area.x0 - 80),
          this.area.y0 + 40 + this.rng.float() * (this.area.y1 - this.area.y0 - 80),
          this.area, this.rng, this.level));
      }
    },

    /* ---------- capture ---------- */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      var keepSafe = this.safeRun;
      this.autopilot = true;
      this.safeRun = true; // на прогоне уколы и промахи не ранят
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
        this.spawnBugs();
        this.caught = Math.floor(G.config.levelGoal(lv) * 0.5);
        this.score = lv * 120;
        this.dust = lv * 40;
        this.combo = 3;
        // зажигаем часть светлячков, чтобы кадр был «в процессе»
        for (var i = 0; i < this.bugs.length; i++) {
          if (i % 2 === 0) { this.bugs[i].lit = 1; this.bugs[i].glowT = 2 + this.rng.float(); }
        }
        if (lv >= 3) this.caters.push(G.makeCaterpillar(this.area.x0 + 60, this.area.y1 - 20, this.area, this.rng));
        if (lv >= G.config.mothFromLevel) {
          this.bugs.push(G.makeMoth(
            (this.area.x0 + this.area.x1) / 2 + 60, (this.area.y0 + this.area.y1) / 2 - 30,
            this.area, this.rng, lv));
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
      if (s.wave) { this.level = clamp(s.wave, 1, G.config.maxLevel); this.spawnBugs(); }
      if (s.score != null) this.score = s.score;
      if (s.coins != null) this.dust = s.coins;
      if (s.mode === 'shop') this.openShop(game);
      if (s.mode === 'over') { this.victory(game, true); this.overT = 1; }
    },
    getCaptureState: function (game) {
      return { scene: 'play', mode: this.mode, wave: this.level, level: this.level,
               score: this.score, coins: Math.floor(this.dust), lives: this.lives, fps: game.fps };
    },

    /* ---------- очки / пыльца ---------- */
    comboMult: function () { return Math.min(G.config.score.comboCap, 1 + Math.floor(this.combo / 5)); },
    addScore: function (n, x, y) {
      var mult = this.comboMult();
      var gained = n * mult;
      this.score += gained;
      this.addFloater(x, y, '+' + gained + (mult > 1 ? ' ×' + mult : ''), G.config.palette.gold);
    },
    addDust: function (n, x, y) {
      this.dust += n;
      if (x != null) this.addFloater(x, y - 26, '+' + n + ' ✨', G.config.palette.dust);
    },
    addFloater: function (x, y, text, color) {
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },
    saveGame: function () {
      var best = Math.max(E.storage.get('best', 0), this.score);
      E.storage.set('best', best);
      E.storage.set('run', { level: this.level, score: this.score, dust: Math.floor(this.dust) });
    },

    /* ---------- тап ---------- */
    tapAt: function (game, px, py) {
      var C = G.config;
      var radius = this.netT > 0 ? 2 : 1;
      // 1) гусеница?
      for (var c = 0; c < this.caters.length; c++) {
        var ct = this.caters[c];
        if (G.hitCircle(px, py, ct.x, ct.y, ct.r * 1.4)) { this.sting(game, ct); return; }
      }
      // 2) горящий светлячок / мотылёк?
      for (var i = this.bugs.length - 1; i >= 0; i--) {
        var b = this.bugs[i];
        if (b.lit > 0.5 && G.hitCircle(px, py, b.x, b.y, (b.r + 10) * radius)) {
          this.bugs.splice(i, 1);
          var wasMoth = !!b.moth;
          this.combo++;
          this.caught++;
          if (wasMoth) {
            this.addScore(C.score.moth, b.x, b.y);
            this.addDust(8, b.x, b.y);
            E.fx.burst(b.x, b.y, '#b197fc', 22, 150, this.visRng);
            E.audio.sfx('wave');
            this.addFloater(b.x, b.y - 44, T('moth_caught'), '#e5dbff');
          } else {
            this.addScore(C.score.catch, b.x, b.y);
            this.addDust(2, b.x, b.y);
            E.fx.burst(b.x, b.y, '#ffe873', 12, 110, this.visRng);
            E.audio.sfx('coin');
          }
          this.checkLevelUp(game);
          this.saveGame();
          // пополнение стаи (мотылёк на замену не приходит — он редкий,
          // появляется отдельным шансом при каждом пополнении)
          var self = this;
          setTimeout(function () {
            if (self.mode === 'running' && self.bugs.length < C.bugsCount(self.level)) {
              var x = self.area.x0 + 40 + self.rng.float() * (self.area.x1 - self.area.x0 - 80);
              var y = self.area.y0 + 40 + self.rng.float() * (self.area.y1 - self.area.y0 - 80);
              if (self.level >= C.mothFromLevel && self.rng.float() < C.mothChance) {
                self.bugs.push(G.makeMoth(x, y, self.area, self.rng, self.level));
              } else {
                self.bugs.push(G.makeBug(x, y, self.area, self.rng, self.level));
              }
            }
          }, 800);
          return;
        }
      }
      // 3) промах (по тёмному светлячку тоже — он «пугается»)
      var scared = null;
      for (var j = 0; j < this.bugs.length; j++) {
        var bb = this.bugs[j];
        if (G.hitCircle(px, py, bb.x, bb.y, bb.r + 10)) { scared = bb; break; }
      }
      if (scared) {
        scared.gapT += 1.2; scared.lit = 0; scared.glowT = 0;
        var a = this.rng.float() * Math.PI * 2;
        scared.vx = Math.cos(a); scared.vy = Math.sin(a);
      }
      this.combo = 0;
      E.audio.sfx('hit');
      this.addFloater(px, py - 10, '…', '#8b95c9');
    },
    sting: function (game, ct) {
      if (this.bubble) {
        this.bubble = false;
        E.fx.burst(ct.x, ct.y, '#69db7c', 16, 130, this.visRng);
        E.audio.sfx('pulse');
        this.addFloater(ct.x, ct.y - 20, '🛡', '#69db7c');
        return;
      }
      this.lives--;
      this.combo = 0;
      E.fx.shake(5, 0.3);
      E.fx.flash('#ff5d5d', 0.22);
      E.fx.burst(ct.x, ct.y, '#e8734a', 18, 150, this.visRng);
      E.audio.sfx('hit');
      this.addFloater(ct.x, ct.y - 24, '💢', '#e8734a');
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
      this.addFloater((this.area.x0 + this.area.x1) / 2, this.hudH + 40, T('levelup', { n: this.level, c: reward }), '#ffe066');
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
    buyBubble: function (game) {
      var p = G.config.economy.bubblePrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.bubble = true;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyLantern: function (game) {
      var p = G.config.economy.lanternPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.slowT = G.config.economy.lanternDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyNet: function (game) {
      var p = G.config.economy.netPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.netT = G.config.economy.netDur;
      E.audio.sfx('buy'); this.buildShopButtons(game);
    },
    buyCalm: function (game) {
      var p = G.config.economy.calmPrice;
      if (this.dust < p) { E.audio.sfx('deny'); return; }
      this.dust -= p; this.calmT = G.config.economy.calmDur;
      E.audio.sfx('buy');
      this.addFloater((this.area.x0 + this.area.x1) / 2, this.hudH + 40, T('calm_done', { s: G.config.economy.calmDur }), '#b197fc');
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
      var C = G.config;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.netT > 0) this.netT -= dt;
      if (this.calmT > 0) this.calmT -= dt;
      var lantern = this.slowT > 0;
      // светлячки (мотылёк летает шустрее и не гаснет)
      for (var i = 0; i < this.bugs.length; i++) {
        var b = this.bugs[i];
        var sp = C.bugSpeed(this.level) * (b.moth ? 1.45 : 1);
        if (this.recordMode) sp = Math.min(sp, C.recordMaxSpeed);
        b.turnT -= dt;
        if (b.turnT <= 0) {
          b.turnT = 0.5 + this.rng.float() * 1.6;
          var na = Math.atan2(b.vy, b.vx) + (this.rng.float() - 0.5) * 1.8;
          b.vx = Math.cos(na); b.vy = Math.sin(na);
        }
        b.x += b.vx * sp * dt;
        b.y += b.vy * sp * dt;
        if (b.x < b.area.x0) { b.x = b.area.x0; b.vx = Math.abs(b.vx); }
        if (b.x > b.area.x1) { b.x = b.area.x1; b.vx = -Math.abs(b.vx); }
        if (b.y < b.area.y0) { b.y = b.area.y0; b.vy = Math.abs(b.vy); }
        if (b.y > b.area.y1) { b.y = b.area.y1; b.vy = -Math.abs(b.vy); }
        // вспышки
        if (b.glowT > 0) {
          b.glowT -= dt;
          b.lit = Math.min(1, b.lit + dt * 5);
          if (b.glowT <= 0) b.gapT = C.glowGap(this.level) * (0.7 + this.rng.float() * 0.8);
        } else {
          b.lit = Math.max(0, b.lit - dt * 3);
          b.gapT -= dt;
          if (b.gapT <= 0) b.glowT = C.glowDur(this.level) * (lantern ? 1.8 : 1);
        }
      }
      // гусеницы (под настоем — вдвое медленнее)
      var calmK = this.calmT > 0 ? 0.5 : 1;
      for (var c = 0; c < this.caters.length; c++) {
        var ct = this.caters[c];
        ct.x += ct.dir * ct.speed * calmK * dt;
        if (ct.x < ct.area.x0) ct.dir = 1;
        if (ct.x > ct.area.x1) ct.dir = -1;
      }
      // новая гусеница со 2 уровня
      if (this.level >= 2 && this.caters.length < Math.min(3, this.level - 1)) {
        this._caterTimer -= dt;
        if (this._caterTimer <= 0) {
          this._caterTimer = 8 + this.rng.float() * 6;
          this.caters.push(G.makeCaterpillar(
            this.rng.float() < 0.5 ? this.area.x0 : this.area.x1,
            this.area.y1 - 16, this.area, this.rng));
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
        this.tapAt(game, P.x, P.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    /* Autopilot: аккуратно «тапает» по самому яркому горящему светлячку. */
    driveAutopilot: function (dt, game) {
      this._autoT -= dt;
      if (this._autoT > 0) return;
      this._autoT = 0.18;
      var best = null, bestLit = 0.6;
      for (var i = 0; i < this.bugs.length; i++) {
        var b = this.bugs[i];
        if (b.lit > bestLit) { bestLit = b.lit; best = b; }
      }
      if (best) this.tapAt(game, best.x, best.y);
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
      var rows = 5; // bubble, lantern, net, calm, далее
      var bh = Math.max(36, Math.min(50, (v.h * 0.5) / rows));
      var y0 = v.h * 0.5 - (bh + 8) * rows / 2;
      this.shopButtons = [];
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 15,
        text: t.t('item_bubble') + ' — ' + C.economy.bubblePrice + ' ✨',
        enabled: this.dust >= C.economy.bubblePrice && !this.bubble,
        onTap: function () { self.buyBubble(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_lantern', { s: C.economy.lanternDur }) + ' — ' + C.economy.lanternPrice + ' ✨',
        enabled: this.dust >= C.economy.lanternPrice,
        onTap: function () { self.buyLantern(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 2 * (bh + 8), w: bw, h: bh, fontSize: 15,
        text: t.t('item_net', { s: C.economy.netDur }) + ' — ' + C.economy.netPrice + ' ✨',
        enabled: this.dust >= C.economy.netPrice,
        onTap: function () { self.buyNet(game); }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + 3 * (bh + 8), w: bw, h: bh, fontSize: 14,
        text: t.t('item_calm', { s: C.economy.calmDur }) + ' — ' + C.economy.calmPrice + ' ✨',
        enabled: this.dust >= C.economy.calmPrice,
        onTap: function () { self.buyCalm(game); }
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
              self.caters = [];
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
      drawBackground(game, ctx, this.stars, this.blades, game.time);
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
      var t = game.time;
      for (var c = 0; c < this.caters.length; c++) {
        var ct = this.caters[c];
        ctx.save();
        if (ct.dir < 0) { ctx.translate(ct.x * 2, 0); ctx.scale(-1, 1); }
        G.art.drawCaterpillar(ctx, ct.x, ct.y, ct.r, t);
        ctx.restore();
      }
      for (var i = 0; i < this.bugs.length; i++) {
        var b = this.bugs[i];
        if (b.moth) G.art.drawMoth(ctx, b.x, b.y + Math.sin(t * 3 + b.phase) * 4, b.r, t + b.phase);
        else G.art.drawBug(ctx, b.x, b.y + Math.sin(t * 3 + b.phase) * 4, b.r, t + b.phase, b.lit);
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
      E.ui.text(ctx, '✨' + Math.floor(this.dust), cxr, y, Math.round(this.hudH * 0.32), C.dust, 'right', 800);
      if (this.combo >= 5) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(game.time * 7);
        E.ui.text(ctx, '×' + this.comboMult(), cxr, y + this.hudH * 0.3, Math.round(this.hudH * 0.26), C.accent, 'right', 800);
        ctx.globalAlpha = 1;
      }
      if (this.netT > 0) E.ui.text(ctx, '🥅', cxr - 60, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.net, 'right', 800);
      if (this.slowT > 0) E.ui.text(ctx, '🏮', cxr - 100, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.lantern, 'right', 800);
      if (this.bubble) E.ui.text(ctx, '🫧', cxr - 140, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), C.shield, 'right', 800);
      if (this.calmT > 0) E.ui.text(ctx, '🌿', cxr - 180, y + this.hudH * 0.3, Math.round(this.hudH * 0.22), '#b197fc', 'right', 800);
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
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,12,28,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,28,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, v.h * 0.32, 34, '#eef1ff', 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      if (E.input.pointer.pressed) {
        E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,28,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 34, 30, '#eef1ff', 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: Math.floor(this.dust) }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 60) / 2 - 6, 18, C.dust, 'center', 700);
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeShop(game);
    },
    drawRevive: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,28,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('gameover_title'), v.w / 2, v.h * 0.34, 30, '#eef1ff', 'center', 800);
      E.ui.text(ctx, t.t('revive_offer'), v.w / 2, v.h * 0.34 + 38, 17, '#b8c0f0', 'center', 600);
      E.ui.drawButtons(ctx, this.reviveButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.reviveButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawOver: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(8,12,28,0.86)'; ctx.fillRect(0, 0, v.w, v.h);
      var titleKey = this.mode === 'over' ? 'over_title' : 'gameover_title';
      E.ui.text(ctx, t.t(titleKey), v.w / 2, v.h * 0.26, 32, '#eef1ff', 'center', 800);
      E.ui.text(ctx, t.t('over_score', { n: this.score }), v.w / 2, v.h * 0.26 + 40, 20, '#b8c0f0', 'center', 600);
      if (this.newBest) {
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(game.time * 5);
        E.ui.text(ctx, t.t('over_newbest'), v.w / 2, v.h * 0.26 + 70, 20, '#ffd43b', 'center', 800);
        ctx.globalAlpha = 1;
      } else {
        E.ui.text(ctx, t.t('over_best', { n: E.storage.get('best', 0) }), v.w / 2, v.h * 0.26 + 70, 18, '#b8c0f0', 'center', 600);
      }
      E.ui.drawButtons(ctx, this.overButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      var msgs = [t.t('tut_tap'), t.t('tut_hazard'), t.t('tut_combo'), t.t('tut_moth')];
      var step = Math.min(3, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.hudH + 10;
      ctx.globalAlpha = 0.92;
      var w = Math.min(v.w * 0.88, 500);
      E.ui.roundRect(ctx, v.w / 2 - w / 2, y, w, 34, 17);
      ctx.fillStyle = 'rgba(14,20,40,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, w - 30, 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 17, size, '#eef1ff', 'center', 600);
      if (this.tutT > 17) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
