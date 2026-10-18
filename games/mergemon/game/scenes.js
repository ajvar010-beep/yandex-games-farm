/* game/scenes.js — сцены menu и play мердж-игры.
   Ключевые свойства (контракт с pipeline/capture-mergemon.mjs):
   - capture-параметры: wave=N трактуется как УРОВЕНЬ (level), t=SEC — прогон
     autopilot-симуляции, mode=shop|over — форсированный экран, freeze=1 — заморозка.
   - Record-safe (?record/?autoplay): autopilot играет сам, цены капнуты
     (record.coinCap), доход масштабирован — клип 28 с всегда живой и без overflow.
   - Стики-баннер — ТОЛЬКО вне геймплея (menu/over), в play его нет (4.6).
   - Драг: монстрик поднимается над полем, целевая клетка подсвечивается,
     отпуск на валидной паре — мердж с поп-анимацией и burst-частицами. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function i18n() { return E.i18n; }
  function T(k, v) { return E.i18n.t(k, v); }
  function monsName(tier) { return (i18n().t('mons') || [])[tier] || ('T' + tier); }

  /* ---------- фон: мягкие «клумбы»-пятна ---------- */
  function makeBlobs(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(0.04, 0.13),
               tw: rng.range(0.3, 0.9), ph: rng.angle(), hue: rng.pick(['#4d3a85', '#5b46a3', '#6d54b8']) });
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
      var y = s.y * v.h + Math.cos(t * s.tw * 0.8 + s.ph) * 10;
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = s.hue;
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.5, R, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ========================================================= MENU */
  /* звёздочки-конфетти на фоне меню (косметика, фиксированный сид) */
  function makeSparkles(n, seed) {
    var rng = new E.Rng(seed);
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(1.2, 3.2),
               tw: rng.range(0.8, 2.2), ph: rng.angle(), hue: rng.pick(['#ffd43b', '#ff8fa3', '#8ce99a', '#74c0fc', '#e599f7']) });
    }
    return s;
  }
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner(); // баннер ТОЛЬКО вне геймплея
      this.t = 0;
      this.blobs = makeBlobs(12, 4242);
      this.sparkles = makeSparkles(26, 777);
      // витрина монстриков на «стейдже» — эволюция от малыша к королю
      var rng = new E.Rng(999);
      this.parade = [];
      for (var i = 0; i < 5; i++) this.parade.push({ tier: [0, 4, 12, 8, 10][i], ph: rng.range(0, 6.28) });
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

      // вертикальный бюджет: заголовок → стейдж с монстриками → кнопки → подсказка
      this.titleY = availH * 0.115;
      this.paradeY = availH * 0.315;
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
      // ряд сервисных чипов: звук / язык / Яндекс ID (или статус облачных сейвов)
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
      // чип Яндекс ID: гость — приглашение войти (чип с «Я»-меткой),
      // после входа — зелёный статус «сохранения в облаке», не кнопка.
      var authOn = E.storage.authorized;
      this.buttons.push(new E.ui.Button({
        x: cx - bw / 2 + 2 * (sw + 12), y: yy, w: sw, h: rowH * sc,
        fontSize: Math.max(9, Math.round(11.5 * k * sc)), id: 'auth',
        text: authOn ? '' : t.t('menu_auth'),
        bg: authOn ? '#2f9e44' : '#fc5c7d',
        border: authOn ? '#237032' : '#c92a4f',
        icon: authOn ? function (ctx, b) { // галочка + «в облаке»
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
        } : function (ctx, b) { // круглый значок «Я» + подпись
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
          // authorized выставляется storage ТОЛЬКО при реальном входе —
          // отмена диалога оставляет кнопку видимой
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
      // конфетти-звёздочки за витриной
      for (var si = 0; si < this.sparkles.length; si++) {
        var sp = this.sparkles[si];
        ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * sp.tw + sp.ph));
        ctx.fillStyle = sp.hue;
        var sx = sp.x * v.w, sy = sp.y * v.h;
        ctx.beginPath(); ctx.arc(sx, sy, sp.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // праздничные арки-гирлянды вокруг витрины
      ctx.save();
      ctx.globalAlpha = 0.30; ctx.lineCap = 'round';
      ctx.strokeStyle = '#9d6bff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, this.paradeY, Math.min(v.w, v.h) * 0.36, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      ctx.strokeStyle = '#ff8fa3'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, this.paradeY, Math.min(v.w, v.h) * 0.42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.restore();
      // «стейдж» — светлый овал-подиум под витриной
      var stageW = Math.min(v.w * 0.92, 600), stageH = this.stageH || 150;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
      ctx.fillStyle = 'rgba(23,15,48,0.55)';
      ctx.beginPath(); ctx.ellipse(cx, this.paradeY + stageH * 0.34, stageW / 2, stageH * 0.52, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      var sg = ctx.createLinearGradient(0, this.paradeY - stageH * 0.2, 0, this.paradeY + stageH * 0.8);
      sg.addColorStop(0, 'rgba(157,107,255,0.20)'); sg.addColorStop(1, 'rgba(157,107,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.ellipse(cx, this.paradeY + stageH * 0.30, stageW / 2.4, stageH * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      // витрина: монстрики качаются на подиуме, старшие крупнее
      var n = this.parade.length, span = Math.min(v.w * 0.86, 560);
      var R = Math.min(v.w, v.h) * 0.115;
      for (var i = 0; i < n; i++) {
        var p = this.parade[i];
        var x = cx - span / 2 + (i + 0.5) * (span / n);
        var rr = R * (0.78 + p.tier * 0.045);
        var y = this.paradeY + stageH * 0.10 - rr * 0.9 + Math.sin(this.t * 2 + p.ph) * rr * 0.12;
        G.art.drawMonster(ctx, p.tier, x, y, rr, this.t, p.ph, false);
      }
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.9, 52 * k, 800);
      // заголовок с тёмной обводкой — как на промо-арте топов
      ctx.lineWidth = size * 0.14; ctx.strokeStyle = 'rgba(30,16,60,0.85)'; ctx.lineJoin = 'round';
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
      E.sdk.hideBanner(); // в геймплее баннера нет
      E.fx.reset();
      G.art.init();
      var seed = (params.seed != null) ? params.seed
               : (E.capture.seed != null) ? E.capture.seed
               : ((Date.now() % 2147483647) | 0);
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      this.rng = new E.Rng(this.seedNum);
      this.visRng = new E.Rng(this.seedNum ^ 0x9e3779b9);
      this.blobs = makeBlobs(10, 777);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.level = 1; this.coins = C.economy.startCoins; this.merges = 0;
      this.board = []; // length cols*rows, null или монстрик
      var cells = C.board.cols * C.board.rows;
      for (var i = 0; i < cells; i++) this.board.push(null);
      this.targets = C.makeTargets(this.level, new E.Rng(this.rng.subSeed(this.level)));
      this.spawnCost = C.economy.spawnCost;
      this.boosterLvl = { gem: 0, wild: 0, clear: 0 };
      this.drag = null;         // { mon, fromIx, x, y }
      this.floaters = [];       // всплывающий текст { x, y, t, text, color }
      this.popT = {};           // cellIx -> таймер поп-анимации
      this.reviveUsed = false; this.overT = 0; this.overShown = false; this.newBest = false;
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0; this.hudLock = false;
      this.stats = E.storage.get('stats', { games: 0, merges: 0 });
      this.stats.games++;
      E.storage.set('stats', this.stats);
      this._simGuard = false;

      this.layout(game);
      this.buildHudButtons(game);
      E.audio.music('play');
      E.sdk.gameplayStart();

      // стартовое поле: 4 монстрика низких тиров — есть что мержить сразу
      this.spawnStarter(game);
      this.applyCaptureParams(game, params);
      this.saveGame();
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      E.fx.reset();
      this.blobs = makeBlobs(10, 777);
      this.buildHudButtons(game);
      if (this.mode === 'paused') this.buildPauseButtons();
      if (this.mode === 'over') this.buildOverButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    layout: function (game) {
      var v = game.view, C = G.config;
      var cols = C.board.cols, rows = C.board.rows;
      // верх: HUD (уровень/монеты/доход), под ним панель целей, центр — поле, низ — спавнер
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      var hudH = Math.max(44, availH * 0.075);
      var goalH = Math.max(64, availH * 0.115);
      var spawnerH = Math.max(76, availH * 0.13);
      var fieldTop = hudH + goalH;
      var fieldH = availH - fieldTop - spawnerH;
      var cell = Math.floor(Math.min(fieldH / rows, (v.w * 0.94) / cols));
      var fw = cell * cols, fh = cell * rows;
      this.cell = cell;
      this.fx0 = (v.w - fw) / 2;                 // левый край поля
      this.fy0 = fieldTop + (fieldH - fh) / 2;   // верх поля
      this.hudH = hudH; this.goalH = goalH; this.spawnerH = spawnerH; this.inset = inset;
      // кэш прямоугольников клеток
      var cr = [];
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < cols; c++)
          cr.push({ x: this.fx0 + c * cell, y: this.fy0 + r * cell, w: cell, h: cell });
      this.cellRect = cr;
      // кнопка-яйцо (спавнер) по центру нижней зоны
      this.eggBtn = { x: v.w / 2 - cell * 1.05, y: availH - spawnerH + (spawnerH - cell * 0.92) / 2,
                      w: cell * 2.1, h: cell * 0.92 };
    },

    /* ---------- стартовое поле / capture ---------- */
    spawnStarter: function () {
      // 4 монстрика: два тира 0 (сразу мерж), один тир 1, один тир 0 — живое поле
      var cells = [6, 8, 11, 13];
      var tiers = [0, 0, 1, 0];
      for (var i = 0; i < cells.length; i++) {
        this.board[cells[i]] = G.entities.makeMonster(tiers[i], cells[i], this.rng);
      }
    },
    /* Прогон autopilot-мерджей в capture-режиме: шагаем полным тиком (update + fx),
       чтобы на замороженном кадре были частицы, всплывашки и честные позиции. */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot;
      this.autopilot = true;
      this._simGuard = true;
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break;
        this.update(game, dt);
        if (E.fx) E.fx.update(dt);
        game.time += dt;
      }
      this.autopilot = keepAuto;
      this._simGuard = false;
    },
    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave) {
        var lv = clamp(parseInt(P.wave, 10) || 1, 1, 99);
        // прогоняем уровни: заселяем поле под целевой уровень и набираем цели
        for (var l = 1; l < lv; l++) this.grantLevelUp(game, true);
        this.level = lv;
        this.targets = G.config.makeTargets(lv, new E.Rng(this.rng.subSeed(lv)));
        // поле под уровень: заполняем ~70% тирами вокруг level*0.6
        var base = clamp(Math.floor(lv * 0.6), 0, 8);
        var rng = new E.Rng(this.rng.subSeed(1000 + lv));
        for (var i = 0; i < this.board.length; i++) {
          if (rng.chance(0.7)) {
            var tier = clamp(base + rng.int(-1, 1), 0, G.config.tiers.length - 1);
            this.board[i] = G.entities.makeMonster(tier, i, rng);
          } else this.board[i] = null;
        }
      }
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0));
      if (P.mode === 'over') {
        this.simulateCombat(game, tsec > 0 ? tsec : 3);
        this.fillBoardForOver();
        this.gameOver(game, true);
        this.overT = 1; this.overShown = true;
      } else {
        if (tsec > 0) this.simulateCombat(game, tsec);
        if (P.mode === 'shop') this.openBoosters(game);
      }
      if (P.score) this.level = Math.max(1, parseInt(P.score, 10) || 1);
      if (P.coins) this.coins = Math.max(0, parseInt(P.coins, 10) || 0);
      if (P.freeze === '1') { game.pause('capture'); game.render(); }
    },
    setCaptureState: function (game, s) {
      if (s.seed != null) {
        this.seedNum = (typeof s.seed === 'string') ? E.seedFromString(s.seed) : (s.seed >>> 0);
        this.rng = new E.Rng(this.seedNum);
      }
      if (s.wave) { this.level = clamp(s.wave, 1, 99); }
      if (s.coins != null) this.coins = s.coins;
      if (s.mode === 'shop') this.openBoosters(game);
      if (s.mode === 'over') { this.fillBoardForOver(); this.gameOver(game, true); this.overT = 1; this.overShown = true; }
    },
    getCaptureState: function (game) {
      return { scene: 'play', mode: this.mode, wave: this.level, level: this.level,
               coins: this.coins, monsters: this.countMonsters(), fps: game.fps };
    },
    fillBoardForOver: function () {
      // «заполненное поле» для game-over кадра: полное, без валидных мержей
      var rng = new E.Rng(this.rng.subSeed(9999));
      var t = 0;
      for (var i = 0; i < this.board.length; i++) {
        if (!this.board[i]) {
          // чередуем тиры, чтобы не было пар
          this.board[i] = G.entities.makeMonster((t++) % 4, i, rng);
        }
      }
    },
    countMonsters: function () {
      var n = 0;
      for (var i = 0; i < this.board.length; i++) if (this.board[i]) n++;
      return n;
    },

    /* ---------- экономика ---------- */
    incomePerSec: function () {
      var sum = 0;
      for (var i = 0; i < this.board.length; i++) {
        var m = this.board[i];
        if (m && m.tier >= 0) sum += G.config.income[m.tier] || 0;
      }
      // record-safe: доход капнут, чтобы 28-сек клип не улетел в миллионы
      if (this.recordMode) sum = Math.min(sum, 40);
      return sum;
    },
    addCoins: function (n, x, y) {
      this.coins += n;
      if (x != null) this.addFloater(x, y, '+' + n, G.config.palette.coin);
    },
    addFloater: function (x, y, text, color) {
      this.floaters.push({ x: x, y: y, t: 0, text: text, color: color || '#fff' });
    },
    saveGame: function () {
      var best = Math.max(E.storage.get('best', 0), this.level);
      E.storage.set('best', best);
      E.storage.set('run', { level: this.level, coins: this.coins, merges: this.merges });
    },

    /* ---------- мердж-ядро ---------- */
    emptyCells: function () {
      var out = [];
      for (var i = 0; i < this.board.length; i++) if (!this.board[i]) out.push(i);
      return out;
    },
    spawnEgg: function () {
      var cost = this.spawnCost;
      if (this.coins < cost) { E.audio.sfx('deny'); return false; }
      var empty = this.emptyCells();
      if (!empty.length) { E.audio.sfx('deny'); return false; }
      this.coins -= cost;
      this.spawnCost = Math.round(this.spawnCost * G.config.economy.spawnGrowth);
      var ix = empty[Math.floor(this.rng.float() * empty.length)];
      var pool = G.config.economy.spawnTiers;
      var tier = pool[Math.floor(this.rng.float() * pool.length)];
      this.board[ix] = G.entities.makeMonster(tier, ix, this.rng);
      this.popT[ix] = G.config.spawnFx.pop;
      var r = this.cellRect[ix];
      E.fx.burst(r.x + r.w / 2, r.y + r.h / 2, '#ffe066', 10, 90, this.visRng);
      E.audio.sfx('coin');
      this.noteTierSeen(tier);
      this.checkGoals();
      this.saveGame();
      return true;
    },
    tryMerge: function (fromIx, toIx) {
      var a = this.board[fromIx], b = this.board[toIx];
      if (!G.entities.canMerge(a, b)) { E.audio.sfx('deny'); return false; }
      var newTier = G.entities.mergeResult(a, b);
      this.board[fromIx] = null;
      this.board[toIx] = G.entities.makeMonster(newTier, toIx, this.rng);
      this.popT[toIx] = 0.32;
      this.merges++;
      var r = this.cellRect[toIx];
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      var col = G.config.tiers[newTier].color;
      E.fx.burst(cx, cy, col, 16, 130, this.visRng);
      E.fx.shake(3, 0.15);
      E.audio.sfx('pulse');
      this.addFloater(cx, cy - r.h * 0.3, T('merge_to', { name: monsName(newTier) }), col);
      // награда монетами за сам мердж
      this.addCoins(2 + newTier * 2, cx, cy);
      this.noteTierSeen(newTier);
      this.stats.merges++;
      E.storage.set('stats', this.stats);
      this.checkGoals();
      this.saveGame();
      // поле заполнилось и мержей нет — конец забега
      if (!this.emptyCells().length && !this.anyMergeLeft()) this.gameOver(null, false);
      return true;
    },
    anyMergeLeft: function () {
      var seen = {};
      for (var i = 0; i < this.board.length; i++) {
        var m = this.board[i];
        if (!m) continue;
        if (m.tier === -1) return true; // джокер мержится с кем угодно
        if (seen[m.tier]) return true;
        seen[m.tier] = true;
      }
      return false;
    },
    checkGoals: function () {
      // ЦЕЛИ НАКОПИТЕЛЬНЫЕ: цель засчитывается, когда тир ВПЕРВЫЕ появляется на поле
      // (мерж/спавн/бустер), а не живёт на поле — иначе смержил целевых и прогресс
      // откатывался бы назад. got растёт от появлений, до need.
      // Все активные цели уже выполнены -> уровень ап.
      var done = true;
      for (var g = 0; g < this.targets.length; g++)
        if (this.targets[g].got < this.targets[g].need) done = false;
      if (done) this.grantLevelUp(null, false);
    },
    noteTierSeen: function (tier) {
      if (tier < 0) return;
      for (var g = 0; g < this.targets.length; g++) {
        var tg = this.targets[g];
        if (tg.tier === tier && tg.got < tg.need) tg.got++;
      }
    },
    grantLevelUp: function (game, silent) {
      var reward = 20 + this.level * 10;
      if (this.recordMode) reward = Math.min(reward, G.config.record.coinCap);
      this.coins += reward;
      this.level++;
      this.targets = G.config.makeTargets(this.level, new E.Rng(this.rng.subSeed(this.level)));
      // стартовый прогресс новых целей: тиры, которые УЖЕ стоят на поле
      for (var i = 0; i < this.board.length; i++) {
        var m = this.board[i];
        if (m) this.noteTierSeen(m.tier);
      }
      if (!silent) {
        E.audio.sfx('wave');
        E.fx.flash('#ffe066', 0.18);
        this.addFloater(this.fx0 + this.cell * G.config.board.cols / 2, this.fy0 - 8,
          T('levelup', { n: this.level, c: reward }), '#ffe066');
      }
      this.saveGame();
    },

    /* ---------- бустеры ---------- */
    openBoosters: function (game) {
      if (this.mode !== 'running') return;
      this.mode = 'shop';
      E.sdk.gameplayStop();
      this.buildShopButtons(game);
    },
    closeBoosters: function (game) {
      this.mode = 'running';
      E.sdk.gameplayStart();
    },
    boosterCost: function (id) {
      var b = null;
      for (var i = 0; i < G.config.boosters.length; i++)
        if (G.config.boosters[i].id === id) b = G.config.boosters[i];
      return G.config.boosterCost(b, this.boosterLvl[id] || 0);
    },
    buyBooster: function (game, id) {
      var cost = this.boosterCost(id);
      if (this.coins < cost) { E.audio.sfx('deny'); return; }
      var used = false;
      if (id === 'gem') used = this.useGem();
      else if (id === 'wild') used = this.useWild();
      else if (id === 'clear') used = this.useClear();
      else if (id === 'gust') used = this.useGust();
      if (!used) { E.audio.sfx('deny'); return; }
      this.coins -= cost;
      this.boosterLvl[id] = (this.boosterLvl[id] || 0) + 1;
      E.audio.sfx('buy');
      this.checkGoals();
      this.saveGame();
      this.buildShopButtons(game); // пересчитать цены
    },
    monsterIndices: function () {
      var out = [];
      for (var i = 0; i < this.board.length; i++) if (this.board[i] && this.board[i].tier >= 0) out.push(i);
      return out;
    },
    useGem: function () {
      var idx = this.monsterIndices();
      if (!idx.length) return false;
      var ix = idx[Math.floor(this.rng.float() * idx.length)];
      var m = this.board[ix];
      if (m.tier >= G.config.tiers.length - 1) return false;
      m.tier++;
      this.noteTierSeen(m.tier);
      this.popT[ix] = 0.32;
      var r = this.cellRect[ix];
      E.fx.burst(r.x + r.w / 2, r.y + r.h / 2, '#b197fc', 14, 110, this.visRng);
      return true;
    },
    useWild: function () {
      var empty = this.emptyCells();
      if (!empty.length) return false;
      var ix = empty[Math.floor(this.rng.float() * empty.length)];
      this.board[ix] = G.entities.makeMonster(-1, ix, this.rng); // джокер
      this.popT[ix] = G.config.spawnFx.pop;
      // джокер на поле = всегда есть мерж (мержится с кем угодно) — over отменяется
      return true;
    },
    useClear: function () {
      var idx = this.monsterIndices();
      if (!idx.length) return false;
      var minT = 99, minIx = -1;
      for (var i = 0; i < idx.length; i++) {
        var m = this.board[idx[i]];
        if (m.tier < minT) { minT = m.tier; minIx = idx[i]; }
      }
      var r = this.cellRect[minIx];
      this.addCoins(5 + minT * 3, r.x + r.w / 2, r.y);
      this.board[minIx] = null;
      E.fx.burst(r.x + r.w / 2, r.y + r.h / 2, '#adb5bd', 10, 80, this.visRng);
      return true;
    },
    useGust: function () {
      // Ураган: все монстрики на доске перелетают на случайные клетки (Фишер–Йетс).
      // Джокеры (-1) и монстры перемешиваются вместе; пустые клетки остаются пустыми.
      var cells = [];
      for (var i = 0; i < this.board.length; i++) if (this.board[i]) cells.push(this.board[i]);
      if (cells.length < 2) return false; // нечего мешать
      for (var j = cells.length - 1; j > 0; j--) {
        var k = Math.floor(this.rng.float() * (j + 1));
        var tmp = cells[j]; cells[j] = cells[k]; cells[k] = tmp;
      }
      var it = 0;
      for (var q = 0; q < this.board.length; q++) {
        if (this.board[q]) {
          this.board[q] = cells[it++];
          this.popT[q] = G.config.spawnFx.pop; // поп-анимация на новом месте
        }
      }
      E.fx.shake(7, 0.35);
      E.fx.flash('rgba(116,192,252,0.25)', 0.2);
      return true;
    },

    /* ---------- game over / revive ---------- */
    gameOver: function (game, byCapture) {
      if (this.mode === 'over') return;
      this.mode = 'over';
      E.sdk.gameplayStop();
      E.audio.sfx('over');
      var best = E.storage.get('best', 0);
      if (this.level > best) { E.storage.set('best', this.level); this.newBest = true; }
      if (!byCapture) E.sdk.showBanner(); // баннер только вне геймплея
      this.buildOverButtons(game);
    },
    revive: function (game) {
      // «очистить 3 клетки за видео»: rewarded -> убираем 3 самых слабых
      var self = this;
      E.sdk.showRewarded({
        onReward: function () {
          for (var k = 0; k < 3; k++) self.useClear();
          self.reviveUsed = true;
          self.mode = 'running';
          E.sdk.hideBanner();
          E.sdk.gameplayStart();
          self.addFloater(self.fx0 + self.cell * 2.5, self.fy0 - 8, T('revive_done'), '#51cf66');
          E.audio.sfx('revive');
        },
        onDone: function (ok) { if (!ok) { /* реклама не показалась — остаёмся на over */ } }
      });
    },
    restart: function (game) {
      E.storage.set('run', null);
      game.setScene('play', { seed: (Date.now() % 2147483647) | 0 });
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
      else if (this.mode === 'over') this.updateOver(game, dt);
      // всплывашки и поп-анимации живут в любом режиме
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt;
        if (f.t > 1.1) this.floaters.splice(i, 1);
      }
      for (var k in this.popT) {
        this.popT[k] -= dt;
        if (this.popT[k] <= 0) delete this.popT[k];
      }
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.tutT += dt;
      E.capture.tickRecording(dt);
    },
    updateRunning: function (game, dt) {
      // idle-доход
      var inc = this.incomePerSec();
      if (inc > 0) {
        this._incAcc = (this._incAcc || 0) + inc * dt;
        if (this._incAcc >= 1) { var whole = Math.floor(this._incAcc); this.coins += whole; this._incAcc -= whole; }
      }
      if (this.autopilot) this.driveAutopilot(dt, game);
      else this.driveInput(game, dt);
    },
    updateOver: function (game, dt) {
      this.overT += dt;
      if (this.overT > 0.4 && !this.overShown) { this.overShown = true; this.buildOverButtons(game); }
      if (this.autopilot && this.overT > 1.2) this.restart(game); // attract: быстрый рестарт
    },
    driveInput: function (game, dt) {
      var P = E.input.pointer;
      // HUD-кнопки — на pointerdown, до полевого ввода (hudLock)
      if (P.pressed) {
        this.hudLock = false;
        if (E.ui.handleTap(this.hudButtons, P.x, P.y)) { this.hudLock = true; return; }
        // тап по яйцу-спавнеру
        var e = this.eggBtn;
        if (P.x >= e.x && P.x <= e.x + e.w && P.y >= e.y && P.y <= e.y + e.h) {
          this.spawnEgg(); this.hudLock = true; return;
        }
        // начало драга: взяли монстрика
        var ix = G.entities.cellAt(this, P.x, P.y);
        if (ix >= 0 && this.board[ix]) {
          this.drag = { fromIx: ix, mon: this.board[ix], x: P.x, y: P.y };
          E.audio.sfx('click');
        }
      }
      if (this.drag) {
        this.drag.x = P.x; this.drag.y = P.y;
        if (P.released) {
          var from = this.drag.fromIx;
          var to = G.entities.cellAt(this, P.x, P.y);
          this.drag = null;
          if (to >= 0 && to !== from && !this.hudLock) this.tryMerge(from, to);
        }
      }
      if (E.input.wasPressed('Escape')) this.setPaused(true);
    },
    /* Autopilot: детерминированная «разумная» игра — скупает яйца, пока есть место,
       иначе мержит первую найденную пару. Для attract-видео и capture-симуляции. */
    driveAutopilot: function (dt) {
      this._autoT = (this._autoT || 0) - dt;
      if (this._autoT > 0) return;
      this._autoT = 0.55;
      // есть пара — мержим
      var seen = {}, pairA = -1, pairB = -1;
      for (var i = 0; i < this.board.length; i++) {
        var m = this.board[i];
        if (!m) continue;
        if (m.tier === -1) { // джокер — к первому попавшемуся
          for (var j = 0; j < this.board.length; j++) {
            if (j !== i && this.board[j] && this.board[j].tier >= 0) { pairA = i; pairB = j; break; }
          }
          if (pairA >= 0) break;
          continue;
        }
        if (seen[m.tier] != null) { pairA = seen[m.tier]; pairB = i; break; }
        seen[m.tier] = i;
      }
      if (pairA >= 0) { this.tryMerge(pairA, pairB); return; }
      // нет пары — покупаем яйцо, если хватает и есть место
      if (this.coins >= this.spawnCost && this.emptyCells().length) { this.spawnEgg(); return; }
      // заперлись — скидываем цену яйца (аттракт не должен вставать)
      if (this.recordMode) this.spawnCost = G.config.economy.spawnCost;
    },

    /* ---------- HUD-кнопки ---------- */
    buildHudButtons: function (game) {
      var v = game.view;
      var s = Math.max(38, Math.min(46, v.w * 0.11));
      this.hudButtons = [
        new E.ui.Button({ x: v.w - s - 8, y: 8, w: s, h: s, fontSize: 20, text: 'II',
          id: 'pause', onTap: function () { E.audio.sfx('click'); } })
      ];
      var self = this;
      this.hudButtons[0].onTap = function () { E.audio.sfx('click'); self.setPaused(true); };
      // кнопка бустеров (мешочек) — левее паузы
      this.hudButtons.push(new E.ui.Button({
        x: v.w - 2 * (s + 8), y: 8, w: s, h: s, fontSize: 20, text: '★', id: 'boost',
        onTap: function () { E.audio.sfx('click'); self.openBoosters(game); }
      }));
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
      var v = game.view;
      var bw = Math.min(300, v.w * 0.8);
      var cx = v.w / 2;
      var rows = G.config.boosters.length + 2; // 3 бустера + rv + далее
      var bh = Math.max(40, Math.min(54, (v.h * 0.52) / rows));
      var y0 = v.h * 0.5 - (bh + 10) * rows / 2;
      this.shopButtons = [];
      G.config.boosters.forEach(function (b, i) {
        var cost = self.boosterCost(b.id);
        self.shopButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0 + i * (bh + 10), w: bw, h: bh, fontSize: 17,
          text: t.t('item_' + b.id) + ' — ' + cost + ' ◉',
          enabled: self.coins >= cost,
          onTap: function () { self.buyBooster(game, b.id); }
        }));
      });
      var yr = y0 + G.config.boosters.length * (bh + 10);
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: yr, w: bw, h: bh, fontSize: 17,
        text: t.t('shop_rv', { n: G.config.economy.rvCoins }),
        bg: '#7c4dff', border: '#b197fc',
        onTap: function () {
          E.sdk.showRewarded({ onReward: function () {
            self.addCoins(G.config.economy.rvCoins);
            self.buildShopButtons(game);
          } });
        }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: yr + bh + 10, w: bw, h: bh, fontSize: 19, text: t.t('shop_next'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); self.closeBoosters(game); }
      }));
    },
    buildOverButtons: function (game) {
      var t = i18n(), self = this;
      var v = game.view;
      var bw = Math.min(280, v.w * 0.74), bh = 48;
      var cx = v.w / 2;
      var rows = (this.reviveUsed || this.autopilot) ? 2 : 3;
      var y0 = v.h * 0.5 - (bh + 12) * rows / 2 + v.h * 0.04;
      this.overButtons = [];
      if (!this.reviveUsed && !this.autopilot) {
        this.overButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 17, text: t.t('over_revive'),
          bg: '#7c4dff', border: '#b197fc', fg: '#fff',
          onTap: function () { E.audio.sfx('click'); self.revive(game); }
        }));
        y0 += bh + 12;
      }
      this.overButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0, w: bw, h: bh, fontSize: 19, text: t.t('over_restart'),
        bg: '#3fb950', border: '#2b8a3e', fg: '#fff',
        onTap: function () { E.audio.sfx('click'); self.restart(game); }
      }));
      this.overButtons.push(new E.ui.Button({
        x: cx - bw / 2, y: y0 + bh + 12, w: bw, h: bh, fontSize: 19, text: t.t('over_menu'),
        onTap: function () { E.audio.sfx('click'); E.sdk.hideBanner(); game.setScene('menu', {}); }
      }));
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette;
      drawBackground(game, ctx, this.blobs, game.time);
      // тряска
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      this.drawGoals(game, ctx);
      this.drawBoard(game, ctx);
      this.drawSpawner(game, ctx);
      this.drawHud(game, ctx);
      E.fx.draw(ctx);
      this.drawFloaters(ctx);
      ctx.restore();
      E.fx.drawFlash(ctx, v.w, v.h);
      if (this.mode === 'paused') this.drawPause(game, ctx);
      else if (this.mode === 'shop') this.drawShop(game, ctx);
      else if (this.mode === 'over') this.drawOver(game, ctx);
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
    },
    drawGoals: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      var y = this.hudH, h = this.goalH;
      // плашка
      E.ui.roundRect(ctx, 8, y + 4, v.w - 16, h - 8, 12);
      ctx.fillStyle = 'rgba(30,22,58,0.72)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(157,107,255,0.5)'; ctx.stroke();
      var label = t.t('goal_title') + ':';
      ctx.font = '700 ' + Math.round(h * 0.22) + 'px system-ui, sans-serif';
      var lw = ctx.measureText(label).width + 14;
      E.ui.text(ctx, label, 20, y + h / 2, Math.round(h * 0.22), C.text, 'left', 700);
      // 3 слота целей
      var slotW = Math.min(96, (v.w - 40 - lw) / 3);
      var r = (h - 26) / 2;
      for (var i = 0; i < 3; i++) {
        var tg = this.targets[i];
        var x = 20 + lw + i * slotW;
        var cy = y + h / 2;
        G.art.drawMonster(ctx, tg.tier, x + r, cy, r, game.time, i * 1.7, false);
        var done = tg.got >= tg.need;
        E.ui.text(ctx, tg.got + '/' + tg.need, x + r * 2 + 6, cy, Math.round(h * 0.20),
          done ? '#69f0ae' : '#fff6e8', 'left', 800);
        if (done) {
          ctx.globalAlpha = 0.25 + 0.15 * Math.sin(game.time * 4);
          ctx.fillStyle = '#51cf66';
          ctx.beginPath(); ctx.arc(x + r, cy, r * 1.15, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    },
    drawBoard: function (game, ctx) {
      var C = G.config.palette;
      var cell = this.cell;
      // подложка поля
      E.ui.roundRect(ctx, this.fx0 - 6, this.fy0 - 6, cell * G.config.board.cols + 12, cell * G.config.board.rows + 12, 16);
      ctx.fillStyle = 'rgba(20,14,44,0.6)'; ctx.fill();
      // клетки
      var dragTo = this.drag ? G.entities.cellAt(this, this.drag.x, this.drag.y) : -1;
      for (var i = 0; i < this.cellRect.length; i++) {
        var r = this.cellRect[i];
        var hot = (i === dragTo && this.drag && G.entities.canMerge(this.drag.mon, this.board[i]));
        E.ui.roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10);
        ctx.fillStyle = hot ? C.fieldCellHot : C.fieldCell;
        ctx.globalAlpha = hot ? 0.95 : 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (hot) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffe066'; ctx.stroke(); }
      }
      // монстрики
      for (i = 0; i < this.board.length; i++) {
        var m = this.board[i];
        if (!m) continue;
        if (this.drag && this.drag.fromIx === i) continue; // тащимого рисуем сверху
        r = this.cellRect[i];
        var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        var mr = cell * 0.36;
        var squash = false;
        if (this.popT[i]) {
          var k = this.popT[i] / 0.32;
          mr *= 1 + Math.sin(k * Math.PI) * 0.35;
          squash = k > 0.4;
        }
        if (m.tier === -1) this.drawJoker(ctx, cx, cy, mr, game.time);
        else G.art.drawMonster(ctx, m.tier, cx, cy, mr, game.time, m.phase, squash);
      }
      // тащимый — над всем, чуть крупнее
      if (this.drag) {
        var m2 = this.drag.mon;
        var R = cell * 0.44;
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#1a0f2e';
        ctx.beginPath(); ctx.ellipse(this.drag.x, this.drag.y + R * 0.8, R * 0.7, R * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        if (m2.tier === -1) this.drawJoker(ctx, this.drag.x, this.drag.y, R, game.time);
        else G.art.drawMonster(ctx, m2.tier, this.drag.x, this.drag.y, R, game.time, m2.phase, false);
      }
    },
    drawJoker: function (ctx, x, y, r, t) {
      // джокер — радужная звезда с мордочкой
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.15);
      var g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, '#ff8fa3'); g.addColorStop(0.5, '#ffd43b'); g.addColorStop(1, '#63e6be');
      ctx.fillStyle = g; ctx.strokeStyle = '#5b3a8e'; ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.55 : r;
        var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // мордочка
      ctx.fillStyle = '#33241f';
      ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.08, r * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.08, r * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#33241f'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.2, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.restore();
    },
    drawSpawner: function (game, ctx) {
      var C = G.config.palette, t = i18n();
      var e = this.eggBtn;
      var afford = this.coins >= this.spawnCost && this.emptyCells().length > 0;
      // кнопка-яйцо
      E.ui.roundRect(ctx, e.x, e.y, e.w, e.h, e.h / 2);
      ctx.fillStyle = afford ? 'rgba(255,212,59,0.18)' : 'rgba(60,50,90,0.5)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = afford ? '#ffd43b' : 'rgba(157,107,255,0.4)'; ctx.stroke();
      // само яйцо — глянцевое, покачивается
      var er = e.h * 0.34;
      var ex = e.x + e.h * 0.62, ey = e.y + e.h / 2 + Math.sin(game.time * 3) * 2;
      ctx.save();
      var g = ctx.createLinearGradient(ex, ey - er, ex, ey + er);
      g.addColorStop(0, '#fff9db'); g.addColorStop(1, '#ffd43b');
      ctx.fillStyle = g; ctx.strokeStyle = '#c47300'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.82, er, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(ex - er * 0.25, ey - er * 0.35, er * 0.25, er * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();
      // крапинки
      ctx.fillStyle = 'rgba(196,115,0,0.5)';
      ctx.beginPath(); ctx.arc(ex + er * 0.2, ey + er * 0.1, er * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex - er * 0.1, ey + er * 0.45, er * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      E.ui.text(ctx, t.t('spawn_btn', { n: this.spawnCost }), ex + er + 12, ey,
        Math.round(e.h * 0.26), afford ? C.text : C.dim, 'left', 700);
      // счётчик монет рядом
      var coinX = e.x + e.w + 18;
      if (G.art.coin) ctx.drawImage(G.art.coin, coinX, ey - 13, 26, 26);
      E.ui.text(ctx, String(this.coins), coinX + 32, ey, Math.round(e.h * 0.30), C.coin, 'left', 800);
      // предупреждение о почти полном поле
      if (this.emptyCells().length <= 2) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(game.time * 6);
        E.ui.text(ctx, t.t('full_warn'), e.x + e.w / 2, e.y - 14, Math.round(e.h * 0.20), C.bad, 'center', 700);
        ctx.globalAlpha = 1;
      }
    },
    drawHud: function (game, ctx) {
      var C = G.config.palette, t = i18n();
      var y = this.hudH / 2 + 4;
      E.ui.text(ctx, t.t('hud_level', { n: this.level }), 12, y, Math.round(this.hudH * 0.34), C.text, 'left', 800);
      var inc = this.incomePerSec();
      if (inc > 0) E.ui.text(ctx, t.t('hud_income', { n: inc }), 12, y + this.hudH * 0.30, Math.round(this.hudH * 0.22), '#ffe066', 'left', 700);
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
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,16,60,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
      }
      ctx.globalAlpha = 1;
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(15,10,35,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, v.h * 0.32, 34, C.text, 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
      // клик по оверлею
      if (E.input.pointer.pressed) {
        E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      }
      if (E.input.wasPressed('Escape')) this.setPaused(false);
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(15,10,35,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 54) / 2 - 34, 30, C.text, 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: this.coins }), v.w / 2, v.h * 0.5 - (this.shopButtons.length * 54) / 2 - 6, 18, C.coin, 'center', 700);
      // описания бустеров мелким текстом под кнопками не влезают — они в title кнопки
      E.ui.drawButtons(ctx, this.shopButtons);
      if (E.input.pointer.pressed) {
        if (E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y)) E.audio.sfx('click');
      }
      if (E.input.wasPressed('Escape')) this.closeBoosters(game);
    },
    drawOver: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      if (!this.overShown) return;
      ctx.fillStyle = 'rgba(15,10,35,0.82)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('over_title'), v.w / 2, v.h * 0.26, 32, C.text, 'center', 800);
      E.ui.text(ctx, t.t('over_score', { n: this.level }), v.w / 2, v.h * 0.26 + 40, 20, C.dim, 'center', 600);
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
      var msgs = [t.t('tut_drag'), t.t('tut_spawn'), t.t('tut_goal')];
      var step = Math.min(2, Math.floor(this.tutT / 4));
      var msg = msgs[step];
      var y = this.fy0 + this.cell * G.config.board.rows + 8;
      ctx.globalAlpha = 0.92;
      E.ui.roundRect(ctx, v.w / 2 - Math.min(v.w * 0.44, 250), y, Math.min(v.w * 0.88, 500), 34, 17);
      ctx.fillStyle = 'rgba(30,22,58,0.95)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.globalAlpha = 1;
      var size = E.ui.fit(ctx, msg, Math.min(v.w * 0.82, 470), 15, 600);
      E.ui.text(ctx, msg, v.w / 2, y + 17, size, C.text, 'center', 600);
      if (this.tutT > 13) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
      // тап по подсказке закрывает её
      if (E.input.pointer.pressed && E.input.pointer.y > y - 6 && E.input.pointer.y < y + 44) {
        this.tutorial = 0; E.storage.set('tutorialSeen', true, true);
      }
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
