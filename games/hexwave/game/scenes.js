/* game/scenes.js — сцены menu и play (режимы running/paused/shop/over),
   autopilot (attract), туториал, магазин, rewarded/interstitial/banner точки,
   capture-состояния (setCaptureState/getCaptureState).
   Ключевые свойства:
   - HUD-кнопки (пауза/импульс) обрабатываются на pointerdown до полевого ввода;
     тап по ним не проваливается в импульс (hudLock).
   - Инсет баннера — положительный: layout считается в области (h - inset),
     контент никогда не уходит под баннер.
   - Record-safe режим (?record/?autoplay): ядро неуязвимо, сложность ограничена,
     рестарт мгновенный — 28-сек клип всегда ≥95% живого геймплея.
   - Capture-симуляция (?t=SEC) всегда бежит под временным record-safe guard:
     ядро не может умереть в середине прогона, симуляция останавливается на
     первой смене режима (wave-clear -> shop), поэтому captured state чистый.
     Guard НЕ оставляет следов на скриншоте: нанесённый врагами урон накапливается
     (_simDamage) и после прогона вычитается из честного pre-sim HP — сердечки на
     захваченном кадре отражают реальный ход боя, а не «всегда полные».
   - Autopilot целится и стреляет в ОДНУ цель: угроза ранжируется по полярному
     радиусу r (ближе к ядру = опаснее), наведение и огонь согласованы.
   - mode=over capture: прогоняет бой несколько секунд под guard'ом, обнуляет
     ядро и принудительно выставляет overShown — замороженный кадр показывает
     полноценный game-over экран, а не пустую арену.
   - Revive сразу пересохраняет забег (saveRun) — прогресс не теряется, если
     игрок закроет игру между волнами после оживления.
   - «Продолжить: волна N» стартует волну N сразу, без фантомного магазина.
   - Дети сплиттера наследуют hpMul/spMul родителя (поля хранятся на враге,
     см. entities.makeEnemy) — скейлинг волны не теряется на поздних волнах. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var E = window.Engine;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function angDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function d2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function i18n() { return E.i18n; }

  /* ---------- фон ---------- */
  function makeStars(n) {
    var rng = new E.Rng(1234); // фиксированный: косметический, не геймплейный
    var s = [];
    for (var i = 0; i < n; i++) {
      s.push({ x: rng.float(), y: rng.float(), r: rng.range(0.5, 1.8),
               tw: rng.range(0.5, 2), ph: rng.angle(), drift: rng.range(2, 9) });
    }
    return s;
  }
  function drawBackground(game, ctx, stars, t) {
    var v = game.view, C = G.config.palette;
    var grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, C.bg2); grd.addColorStop(1, C.bg);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var x = (s.x * v.w + t * s.drift) % v.w;
      var y = s.y * v.h;
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(x, y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  /* ========================================================= MENU */
  var MenuScene = {
    enter: function (game) {
      E.audio.music('menu');
      E.sdk.gameplayStop();
      E.sdk.showBanner(); // баннер ТОЛЬКО вне геймплея
      this.t = 0;
      this.stars = makeStars(90);
      this.layout(game);
    },
    exit: function () { E.sdk.hideBanner(); },
    onResize: function (game) { this.layout(game); },
    layout: function (game) {
      var v = game.view, w = v.w, h = v.h;
      var t = i18n();
      var inset = E.sdk.bannerInsetPx();   // реальная высота стики-баннера (0 если не показан)
      var availH = h - inset;              // ВСЯ раскладка — строго выше баннера
      // единый масштаб шрифта/размеров для коротких экранов
      var k = clamp(availH / 520, 0.72, 1);
      var bw = Math.min(300, w * 0.74), bh = Math.round(54 * k), cx = w / 2;
      var rowH = Math.round(46 * k), rowGap = Math.round(12 * k);
      var best = E.storage.get('best', 0);
      var run = E.storage.get('run', null);
      this.best = best; this.k = k; this.inset = inset;

      // --- вертикальный бюджет: [заголовок] [стек кнопок] [подсказка] ---
      this.titleY = availH * 0.20 + 40 * k;
      var contentTop = this.titleY + (best > 0 ? 30 * k : 6 * k) + 18 * k;
      var hintH = Math.round(24 * k) + 8;
      var stackAvail = Math.max(40, availH - hintH - contentTop);

      // --- строки стека: «Продолжить» (если есть забег), «Играть», ряд настроек ---
      var rows = [], defs = [];
      if (run && run.wave > 1) { rows.push({ h: bh, gap: rowGap }); defs.push('continue'); }
      rows.push({ h: bh, gap: rowGap + 2 }); defs.push('play');
      rows.push({ h: rowH, gap: 0 }); defs.push('settings');

      var col = E.ui.layoutColumn(rows, stackAvail, { pad: 0, alignTop: true });
      var sc = col.scale;
      this.buttons = [];
      var self = this;
      for (var i = 0; i < defs.length; i++) {
        var yy = contentTop + col.ys[i];
        var hh = rows[i].h * sc;
        if (defs[i] === 'continue') {
          this.buttons.push(new E.ui.Button({
            x: cx - bw / 2, y: yy, w: bw, h: hh, fontSize: Math.max(13, Math.round(20 * k * sc)),
            text: t.t('menu_continue', { n: run.wave }),
            onTap: function () { E.audio.sfx('click'); game.setScene('play', { resume: run }); }
          }));
        } else if (defs[i] === 'play') {
          this.buttons.push(new E.ui.Button({
            x: cx - bw / 2, y: yy, w: bw, h: hh, fontSize: Math.max(15, Math.round(26 * k * sc)),
            text: t.t('menu_play'),
            onTap: function () { E.audio.sfx('click'); game.setScene('play', {}); }
          }));
        } else {
          var sw = Math.floor((bw - 24) / 3);
          var fs = Math.max(10, Math.round(15 * k * sc));
          this.buttons.push(new E.ui.Button({
            x: cx - bw / 2, y: yy, w: sw, h: hh, fontSize: fs, id: 'snd',
            text: E.audio.isMuted() ? t.t('snd_off') : t.t('snd_on'),
            onTap: function (b) {
              var m = !E.audio.isMuted();
              E.audio.setMuted(m);
              E.storage.set('muted', m, true);
              b.text = m ? t.t('snd_off') : t.t('snd_on');
              E.audio.sfx('click');
            }
          }));
          this.buttons.push(new E.ui.Button({
            x: cx - bw / 2 + sw + 12, y: yy, w: sw, h: hh, fontSize: fs, id: 'lang',
            text: t.t('lang_btn'),
            onTap: function () {
              E.audio.sfx('click');
              var nl = E.i18n.lang === 'ru' ? 'en' : 'ru';
              E.i18n.setLang(nl);
              E.storage.set('lang', nl, true);
              document.title = i18n().t('title');
              MenuScene.layout(game);
            }
          }));
          this.buttons.push(new E.ui.Button({
            x: cx - bw / 2 + 2 * (sw + 12), y: yy, w: sw, h: hh, fontSize: Math.max(9, Math.round(13 * k * sc)), id: 'auth',
            text: t.t('menu_auth'),
            visible: !E.storage.authorized,
            onTap: function (b) {
              E.audio.sfx('click');
              // authorized=true выставляется storage ТОЛЬКО при реальном входе (isAuthorized),
              // поэтому при отмене диалога кнопка остаётся видимой после перерисовки
              E.storage.authorize().then(function (ok) { if (ok) MenuScene.layout(game); });
            }
          }));
        }
      }
      // подсказка — в оставленном под неё нижнем слоте availH, никогда не на кнопках
      this.hintY = availH - hintH / 2 - 2;
      this.hintSize = Math.max(10, Math.round(14 * k));
    },
    update: function (game, dt) {
      this.t += dt;
      if (E.input.pointer.pressed) E.ui.handleTap(this.buttons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) game.setScene('play', {});
    },
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      drawBackground(game, ctx, this.stars, this.t);
      var cx = v.w / 2;
      var k = this.k || 1;
      var ty = (this.titleY || v.h * 0.26) - 40 * k;
      // вращающиеся гекс-кольца — "логотип"
      ctx.save();
      ctx.translate(cx, ty - 40 * k);
      for (var i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.5 - i * 0.13;
        ctx.strokeStyle = C.core; ctx.lineWidth = 2;
        G.entities.poly(ctx, 0, 0, (44 + i * 16) * k, 6, this.t * (0.3 + i * 0.17));
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      var title = t.t('title');
      var size = E.ui.fit(ctx, title, v.w * 0.86, 54 * k, 800);
      E.ui.text(ctx, title, cx, this.titleY, size, C.text, 'center', 800);
      if (this.best > 0) E.ui.text(ctx, t.t('menu_best', { n: this.best }), cx, this.titleY + 30 * k, Math.round(18 * k), C.dim);
      E.ui.drawButtons(ctx, this.buttons);
      var hintSize = E.ui.fit(ctx, t.t('menu_hint'), v.w * 0.9, this.hintSize, 400);
      E.ui.text(ctx, t.t('menu_hint'), cx, this.hintY, hintSize, C.dim, 'center', 400);
      E.ui.text(ctx, 'v' + G.version, 10, (v.h - (this.inset || 0)) - 12, 12, C.dim, 'left', 400);
    },
    getCaptureState: function (game) { return { scene: 'menu', fps: game.fps }; }
  };

  /* ========================================================= PLAY */
  var PlayScene = {
    /* ---------- lifecycle ---------- */
    enter: function (game, params) {
      var C = G.config;
      E.sdk.hideBanner(); // в геймплее баннера нет
      E.fx.reset();
      var seed = (params.seed != null) ? params.seed
               : (E.capture.seed != null) ? E.capture.seed
               : ((Date.now() % 2147483647) | 0);
      this.seedNum = (typeof seed === 'string') ? E.seedFromString(seed) : (seed >>> 0);
      this.rng = new E.Rng(this.seedNum);       // геймплейный RNG (runtime-события)
      this.visRng = new E.Rng(this.seedNum ^ 0x9e3779b9); // только частицы
      this.stars = makeStars(70);

      this.autopilot = E.capture.autoplay || E.capture.record > 0 || !!params.autopilot;
      this.recordMode = E.capture.record > 0 || E.capture.autoplay;
      this.mode = 'running';
      this.wave = 0; this.score = 0; this.coins = 0; this.runKills = 0;
      this.core = { hp: C.core.hp, max: C.core.hp, hitT: 0 };
      if (this.recordMode) this.core.hp = C.record.coreHpFloor; // съёмка: ядро не умирает
      this.def = { angle: -Math.PI / 2, aim: -Math.PI / 2,
                   rate: C.defender.rate, dmg: C.defender.dmg, multi: 1,
                   pulseCd: 0, pulseCdMax: C.defender.pulseCd,
                   pulseDmg: C.defender.pulseDmg, pulseR: C.defender.pulseR,
                   slow: 0, fireT: 0, aegisMax: 0, aegisLeft: 0 };
      this.upLevels = {};
      this.enemies = []; this.bullets = []; this.floaters = [];
      this.queue = []; this.waveT = 0; this.bannerT = 0; this.clearT = 0;
      this.reviveUsed = false; this.overT = 0; this.overShown = false; this.newBest = false;
      this.shopOffers = []; this.shopAutoT = 0; this.shopRvUsed = false;
      this.tutorial = (E.storage.get('tutorialSeen', false) || this.autopilot) ? 0 : 1;
      this.tutT = 0; this.tapDownT = 0; this.tapDownX = 0; this.tapDownY = 0;
      this.hudLock = false;
      this._resumeNow = false;
      this._simGuard = false;   // временный record-safe guard на время capture-симуляции
      this._simDamage = 0;      // урон, поглощённый guard'ом (для честного HP на скриншоте)
      this.stats = E.storage.get('stats', { games: 0, kills: 0 });
      this.stats.games++;
      E.storage.set('stats', this.stats);

      this.layout(game);
      this.buildHudButtons(game);
      E.audio.music('play');
      E.sdk.gameplayStart();

      if (params.resume) this.applyResume(params.resume);
      this.applyCaptureParams(game, params);
      if (this._resumeNow) { this._resumeNow = false; this.startWave(game); } // сразу волна N
      else if (this.wave === 0) this.startWave(game);
      this.saveRun();
    },
    exit: function () { E.sdk.gameplayStop(); },
    onResize: function (game) {
      this.layout(game);
      this.bullets.length = 0; // пули живут 1.2с — безопасно пересоздать
      E.fx.reset();
      this.stars = makeStars(70);
      this.buildHudButtons(game);
      if (this.mode === 'paused') this.buildPauseButtons();
      if (this.mode === 'shop') this.buildShopButtons(game);
      if (this.mode === 'over') this.buildOverButtons(game);
    },
    onBack: function () { if (this.mode === 'running') this.setPaused(true); },

    layout: function (game) {
      var v = game.view;
      this.cx = v.w / 2;
      this.cy = v.h / 2;
      var fieldR = Math.min(v.w, v.h) * G.config.arena.fieldFactor;
      this.spawnR = fieldR * 1.08;
      this.coreR = Math.max(26, Math.min(40, fieldR * 0.16));
      this.orbit = this.coreR + 46;
    },

    applyResume: function (run) {
      if (!run || !run.def) return;
      this.wave = run.wave - 1; // startWave инкрементирует до сохранённой волны
      this.score = run.score; this.coins = run.coins;
      this.core.hp = run.core.hp; this.core.max = run.core.max;
      this.def = Object.assign(this.def, run.def);
      this.def.aegisLeft = this.def.aegisMax; // щит перезаряжен при возобновлении забега
      this.upLevels = Object.assign({}, run.upLevels);
      this.runKills = run.runKills || 0;
      this.reviveUsed = !!run.reviveUsed;
      this._resumeNow = true; // просим enter запустить волну сразу, минуя пустое поле и магазин
    },
    saveRun: function () {
      E.storage.set('run', {
        wave: Math.max(1, this.wave), score: this.score, coins: this.coins,
        core: { hp: this.core.hp, max: this.core.max },
        def: { rate: this.def.rate, dmg: this.def.dmg, multi: this.def.multi,
               pulseCdMax: this.def.pulseCdMax, pulseDmg: this.def.pulseDmg,
               pulseR: this.def.pulseR, slow: this.def.slow, aegisMax: this.def.aegisMax },
        upLevels: this.upLevels, runKills: this.runKills, reviveUsed: this.reviveUsed
      });
    },

    /* ---------- capture ---------- */
    /* Прогон боя в capture-режиме. Всегда под временным record-safe guard'ом:
       ядро не может умереть в середине симуляции (иначе замороженный кадр
       показал бы посмертное поле). Останавливается на первой смене режима —
       после wave-clear открывается магазин, и дальше симулировать "бой"
       бессмысленно и вредно (runaway clear-branch).
       ВАЖНО 1: шагаем ПОЛНЫМ тиком (this.update + E.fx.update + game.time), а не голым
       updateRunning. Иначе частицы, core.hitT (красное «повреждённое» ядро), всплывающий
       текст и bannerT застыли бы на последнем значении — на скриншоте ядро осталось бы
       красным от уже «забытого» удара, а fx не двигались бы.
       ВАЖНО 2: guard не фальсифицирует скриншот. Урон, который враги нанесли бы ядру,
       накапливается в _simDamage (см. updateRunning), и после прогона HP ядра
       выставляется в clamp(preSimHp - _simDamage, 1, core.max): сердечки на кадре
       отражают реальный ход боя (ядро живо, но честно потрёпано), а не «всегда 3/3». */
    simulateCombat: function (game, tsec) {
      if (tsec <= 0) return;
      var keepAuto = this.autopilot, keepGuard = this._simGuard, keepDmg = this._simDamage;
      this.autopilot = true;
      this._simGuard = true;
      this._simDamage = 0;
      var preSimHp = Math.min(this.core.hp, this.core.max); // честный HP до прогона
      var steps = Math.round(tsec * 60), dt = 1 / 60;
      for (var i = 0; i < steps; i++) {
        if (this.mode !== 'running') break; // волна зачищена -> shop, стоп
        this.update(game, dt);              // полный сценический тик (hitT/bannerT/floaters)
        if (E.fx) E.fx.update(dt);          // частицы/тряска/вспышка живут
        game.time += dt;
      }
      var absorbed = this._simDamage;
      this.autopilot = keepAuto;
      this._simGuard = keepGuard;
      this._simDamage = keepDmg;
      // Восстановление состояния: guard-надбавка (ядро разгонялось до coreHpFloor)
      // снимается, а реально нанесённый урон — применяется. Ядро остаётся живым
      // (минимум 1 HP), но скриншот показывает честные повреждения.
      if (!keepGuard && !this.recordMode && this.core.hp > G.config.core.hpMaxCap) {
        this.core.hp = clamp(preSimHp - absorbed, 1, this.core.max);
      }
    },
    applyCaptureParams: function (game) {
      var P = E.capture.params;
      if (P.wave) {
        var w = clamp(parseInt(P.wave, 10) || 1, 1, 999);
        this.wave = w - 1;
        this.startWave(game);
      }
      var tsec = Math.max(0, Math.min(120, parseFloat(P.t) || 0)); // валидация: не более 120 с
      if (P.mode === 'over') {
        // Game-over capture: нужен живой посмертный кадр, а не пустая арена.
        // Прогоняем несколько секунд боя (под guard'ом — ядро переживёт симуляцию),
        // чтобы на поле были враги/частицы, затем честно убиваем ядро.
        this.simulateCombat(game, tsec > 0 ? tsec : 4);
        this.core.hp = 0;
        this.gameOver(game, true);
        // freeze глушит update -> updateOver никогда не добежит до overShown.
        // Для capture выставляем оверлей сразу.
        this.overT = 1; this.overShown = true;
      } else {
        if (tsec > 0) this.simulateCombat(game, tsec);
        if (P.mode === 'shop') {
          // если симуляция сама открыла магазин — не перебиваем его,
          // иначе открываем принудительно
          if (this.mode !== 'shop') this.openShop(game);
        }
      }
      if (P.score) this.score = Math.max(0, parseInt(P.score, 10) || 0);
      if (P.coins) this.coins = Math.max(0, parseInt(P.coins, 10) || 0);
      if (P.freeze === '1') { game.pause('capture'); game.render(); } // явный кадр — canvas не пустой
    },
    setCaptureState: function (game, s) {
      if (s.seed != null) {
        this.seedNum = (typeof s.seed === 'string') ? E.seedFromString(s.seed) : (s.seed >>> 0);
        this.rng = new E.Rng(this.seedNum);
      }
      if (s.wave) { this.wave = clamp(s.wave, 1, 999) - 1; this.startWave(game); }
      if (s.score != null) this.score = s.score;
      if (s.coins != null) this.coins = s.coins;
      if (s.coreHp != null) this.core.hp = clamp(s.coreHp, 1, this.core.max);
      if (s.mode === 'shop') this.openShop(game);
      if (s.mode === 'over') {
        this.core.hp = 0;
        this.gameOver(game, true);
        this.overT = 1; this.overShown = true;
      }
    },
    getCaptureState: function (game) {
      return { scene: 'play', mode: this.mode, wave: this.wave, score: this.score,
               coins: this.coins, coreHp: this.core.hp, enemies: this.enemies.length,
               fps: game.fps };
    },

    /* ---------- волны ---------- */
    startWave: function (game) {
      this.wave++;
      // record-safe: сложность ограничена, чтобы autopilot гарантированно справлялся
      var effWave = this.recordMode ? Math.min(this.wave, G.config.record.waveCap) : this.wave;
      var waveRng = new E.Rng(this.rng.subSeed(effWave)); // детерминировано по (seed, wave)
      this.queue = G.config.waveSpec(effWave, waveRng);
      this.waveT = 0; this.bannerT = 2; this.clearT = 0;
      this.def.aegisLeft = this.def.aegisMax; // щит эгиды перезаряжается на каждой волне
      this.mode = 'running';
      E.audio.sfx('wave');
      if (this.wave >= 3 && !E.storage.get('tutorialSeen', false)) {
        E.storage.set('tutorialSeen', true, true);
      }
      this.saveRun();
    },
    spawnFromQueue: function () {
      while (this.queue.length && this.queue[0].at <= this.waveT) {
        var q = this.queue.shift();
        this.enemies.push(G.entities.makeEnemy(q.type, q.angle, this.spawnR, q.hpMul, q.spMul));
      }
    },
    slowFactor: function () { return 1 / (1 + 0.12 * this.def.slow); },

    /* ---------- бой ---------- */
    defPos: function () {
      return { x: this.cx + Math.cos(this.def.angle) * this.orbit,
               y: this.cy + Math.sin(this.def.angle) * this.orbit };
    },
    /* Цель для автоприцела. Два режима, одна функция:
       - autopilot/record: угроза ранжируется по полярному радиусу r (ближе к ядру =
         опаснее). Это СОГЛАСОВАНО с driveAutopilot: страж наводится и стреляет в одну
         и ту же цель, поэтому attract-видео показывает осмысленную игру (защита ядра,
         а не стрельба по случайному ближнему).
       - ручная игра: ближайший к стражу по Евклиду — отзывчивый автоприцел туда,
         куда игрок уже повернул стража. */
    nearestEnemy: function (maxDist) {
      var p = this.defPos(), best = null;
      var magnet2 = maxDist * maxDist;
      if (this.autopilot) {
        var bestR = 1e18, bestD = 1e18;
        for (var i = 0; i < this.enemies.length; i++) {
          var e = this.enemies[i];
          var ex = this.cx + Math.cos(e.angle) * e.r, ey = this.cy + Math.sin(e.angle) * e.r;
          var dd = d2(p.x, p.y, ex, ey);
          if (dd > magnet2) continue; // вне радиуса автоприцела — не трогаем
          // основной ключ — угроза (r), тай-брейк — расстояние до стража
          if (e.r < bestR - 0.001 || (Math.abs(e.r - bestR) <= 0.001 && dd < bestD)) {
            bestR = e.r; bestD = dd; best = e;
          }
        }
        return best;
      }
      var bd = magnet2;
      for (var j = 0; j < this.enemies.length; j++) {
        var e2 = this.enemies[j];
        var ex2 = this.cx + Math.cos(e2.angle) * e2.r, ey2 = this.cy + Math.sin(e2.angle) * e2.r;
        var dd2 = d2(p.x, p.y, ex2, ey2);
        if (dd2 < bd) { bd = dd2; best = e2; }
      }
      return best;
    },
    tryFire: function (dt) {
      this.def.fireT -= dt;
      if (this.def.fireT > 0) return;
      var target = this.nearestEnemy(G.config.defender.magnet);
      if (!target) return;
      var p = this.defPos();
      var tx = this.cx + Math.cos(target.angle) * target.r;
      var ty = this.cy + Math.sin(target.angle) * target.r;
      var base = Math.atan2(ty - p.y, tx - p.x);
      this.def.aim = base;
      var n = this.def.multi;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * 0.14;
        this.bullets.push(G.entities.makeBullet(p.x, p.y, a, G.config.defender.bulletSpeed, this.def.dmg));
      }
      this.def.fireT = 1 / this.def.rate;
      E.audio.sfx('shoot');
    },
    damageEnemy: function (e, dmg, game) {
      e.hp -= dmg; e.hitFlash = 1;
      if (e.hp <= 0) this.killEnemy(e, game); else E.audio.sfx('hit');
    },
    killEnemy: function (e, game) {
      var C = G.config.palette;
      var ex = this.cx + Math.cos(e.angle) * e.r, ey = this.cy + Math.sin(e.angle) * e.r;
      e.dead = true;
      this.score += e.value * 10;
      this.coins += e.value;
      this.runKills++;
      E.audio.sfx('explode'); E.audio.sfx('coin');
      E.fx.burst(ex, ey, C.enemy[e.type] || '#fff', 14, 160, this.visRng);
      E.fx.burst(ex, ey, C.coin, 5, 90, this.visRng);
      this.floaters.push({ x: ex, y: ey, t: 0, txt: '+' + (e.value * 10), color: C.text });
      if (e.type === 'splitter') {
        for (var k = -1; k <= 1; k += 2) {
          // hpMul/spMul хранятся на враге (entities.makeEnemy) — дети наследуют
          // скейлинг ТЕКУЩЕЙ волны, а не откатываются к статам волны 1
          var d = G.entities.makeEnemy('dart', e.angle + 0.35 * k, Math.max(e.r, this.orbit + 30), e.hpMul, e.spMul);
          this.enemies.push(d);
        }
      }
    },
    activatePulse: function (game) {
      if (this.mode !== 'running') return;
      if (this.def.pulseCd > 0) { E.audio.sfx('deny'); return; }
      this.def.pulseCd = this.def.pulseCdMax;
      var p = this.defPos();
      E.audio.sfx('pulse');
      E.fx.flash(G.config.palette.core, 0.12);
      E.fx.shake(4, 0.2);
      E.fx.burst(p.x, p.y, G.config.palette.defender, 22, 220, this.visRng);
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        var ex = this.cx + Math.cos(e.angle) * e.r, ey = this.cy + Math.sin(e.angle) * e.r;
        if (d2(p.x, p.y, ex, ey) < Math.pow(this.def.pulseR + e.size, 2)) {
          this.damageEnemy(e, this.def.pulseDmg, game);
        }
      }
      if (this.tutorial === 2) { this.tutorial = 0; E.storage.set('tutorialSeen', true, true); }
    },

    /* ---------- ввод / autopilot ---------- */
    driveInput: function (game, dt) {
      var I = E.input, D = G.config.defender;
      if (this.hudLock) return; // тап начался на HUD-кнопке — поле не реагирует
      if (I.down('ArrowLeft') || I.down('KeyA')) this.def.angle -= D.rotateSpeed * dt;
      if (I.down('ArrowRight') || I.down('KeyD')) this.def.angle += D.rotateSpeed * dt;
      if (I.pointer.down) {
        var dx = I.pointer.x - this.cx, dy = I.pointer.y - this.cy;
        if (dx * dx + dy * dy > this.coreR * this.coreR) {
          var want = Math.atan2(dy, dx);
          this.def.angle += angDiff(want, this.def.angle) * Math.min(1, dt * 14);
          if (this.tutorial === 1) { this.tutorial = 2; this.tutT = 0; }
        }
      }
      if (I.wasPressed('Space') || I.wasPressed('KeyW') || I.wasPressed('ArrowUp')) {
        this.activatePulse(game);
        if (this.tutorial === 1) { this.tutorial = 2; this.tutT = 0; }
      }
      // быстрый тап по полю = импульс (не drag)
      if (I.pointer.pressed) {
        this.tapDownT = Date.now(); this.tapDownX = I.pointer.x; this.tapDownY = I.pointer.y;
      }
      if (I.pointer.released && this.tapDownT > 0) {
        var quick = Date.now() - this.tapDownT < 260;
        var still = d2(I.pointer.x, I.pointer.y, this.tapDownX, this.tapDownY) < 144;
        this.tapDownT = 0;
        if (quick && still) this.activatePulse(game);
      }
    },
    driveAutopilot: function (dt, game) {
      // Цель наведения = та же, что у автоприцела: ближайший к ядру (наименьший r).
      // Копейщик в рывке получает виртуальный -70 к радиусу: он опаснее, чем кажется.
      var best = null, bestR = 1e18;
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        var effR = e.r - ((e.type === 'lancer' && e.lunging) ? 70 : 0);
        if (effR < bestR) { bestR = effR; best = e; }
      }
      if (best) {
        var d = angDiff(best.angle, this.def.angle);
        var maxTurn = 4.6 * dt;
        this.def.angle += clamp(d, -maxTurn, maxTurn);
      }
      if (this.def.pulseCd <= 0) {
        var p = this.defPos(), near = 0;
        for (var j = 0; j < this.enemies.length; j++) {
          var en = this.enemies[j];
          var ex = this.cx + Math.cos(en.angle) * en.r, ey = this.cy + Math.sin(en.angle) * en.r;
          if (d2(p.x, p.y, ex, ey) < Math.pow(this.def.pulseR * 0.8, 2)) near++;
        }
        if (near >= 3) this.activatePulse(game);
      }
    },

    /* ---------- режимы ---------- */
    setPaused: function (on) {
      if (on && this.mode === 'running') { this.mode = 'paused'; this.buildPauseButtons(); E.sdk.gameplayStop(); }
      else if (!on && this.mode === 'paused') { this.mode = 'running'; E.sdk.gameplayStart(); }
    },
    update: function (game, dt) {
      E.capture.tickRecording(dt);
      // HUD-кнопки (пауза/импульс) — ПЕРВЫМИ на pointerdown; тап по ним не проваливается в поле
      if (this.mode === 'running' && E.input.pointer.pressed) {
        var px = E.input.pointer.x, py = E.input.pointer.y;
        var hit = E.ui.hitTest(this.hudButtons, px, py);
        if (hit) {
          this.hudLock = true;
          E.input.pointer.pressed = false; // поглощаем событие — поле его не увидит
          hit.tap();
        }
      }
      if (E.input.pointer.released) this.hudLock = false;

      if (E.input.wasPressed('Escape') || E.input.wasPressed('KeyP')) {
        if (this.mode === 'running' || this.mode === 'paused') this.setPaused(this.mode === 'running');
      }
      if (this.mode === 'running') this.updateRunning(game, dt);
      else if (this.mode === 'shop') this.updateShop(game, dt);
      else if (this.mode === 'over') this.updateOver(game, dt);
      else if (this.mode === 'paused') {
        if (E.input.pointer.pressed) E.ui.handleTap(this.pauseButtons, E.input.pointer.x, E.input.pointer.y);
      }
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i]; f.t += dt; f.y -= 30 * dt;
        if (f.t > 0.9) this.floaters.splice(i, 1);
      }
      if (this.core.hitT > 0) this.core.hitT -= dt;
      if (this.bannerT > 0) this.bannerT -= dt;
    },
    updateRunning: function (game, dt) {
      if (this.mode !== 'running') return; // страховка: режим уже сменился — не трогаем бой
      this.waveT += dt;
      if (this.autopilot) this.driveAutopilot(dt, game); else this.driveInput(game, dt);
      this.def.pulseCd = Math.max(0, this.def.pulseCd - dt);
      this.spawnFromQueue();
      this.tryFire(dt);
      var sf = this.slowFactor();
      var i, e;
      for (i = this.enemies.length - 1; i >= 0; i--) {
        e = this.enemies[i];
        G.entities.updateEnemy(e, dt, sf);
        if (e.r <= this.coreR + e.size * 0.5) {
          e.dead = true;
          if (this.def.aegisLeft > 0) {
            // Эгида поглощает удар: ядро не теряет HP, враг просто взрывается
            this.def.aegisLeft--;
            E.audio.sfx('pulse');
            E.fx.flash(G.config.palette.aegis, 0.18);
            var aex = this.cx + Math.cos(e.angle) * e.r, aey = this.cy + Math.sin(e.angle) * e.r;
            E.fx.burst(aex, aey, G.config.palette.aegis, 16, 170, this.visRng);
            continue;
          }
          this.core.hp -= e.touch;
          this.core.hitT = 0.6;
          E.audio.sfx('core');
          E.fx.shake(9, 0.35);
          E.fx.flash(G.config.palette.coreHurt, 0.22);
          // record-safe guard: активен при ?record/?autoplay И во время capture-симуляции.
          // Ядро не умирает на съёмке и в середине прогона t=SEC. Во время симуляции
          // фактически нанесённый урон копится в _simDamage — после прогона он будет
          // честно вычтен из pre-sim HP (см. simulateCombat), чтобы скриншот не
          // показывал «всегда полные» сердечки.
          if (this.recordMode || this._simGuard) {
            if (this._simGuard) this._simDamage += e.touch;
            this.core.hp = Math.max(this.core.hp, G.config.record.coreHpFloor);
          }
          if (this.core.hp <= 0) { this.core.hp = 0; this.gameOver(game, false); return; }
        }
      }
      // пули
      for (i = this.bullets.length - 1; i >= 0; i--) {
        var b = this.bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        var removed = b.life <= 0;
        if (!removed) {
          for (var j = 0; j < this.enemies.length; j++) {
            e = this.enemies[j];
            if (e.dead) continue;
            var ex = this.cx + Math.cos(e.angle) * e.r, ey = this.cy + Math.sin(e.angle) * e.r;
            if (d2(b.x, b.y, ex, ey) < Math.pow(e.size + 5, 2)) {
              this.damageEnemy(e, b.dmg, game);
              removed = true;
              break;
            }
          }
        }
        if (removed) this.bullets.splice(i, 1);
      }
      // чистка трупов
      for (i = this.enemies.length - 1; i >= 0; i--) {
        if (this.enemies[i].dead) this.enemies.splice(i, 1);
      }
      // волна зачищена?
      if (this.queue.length === 0 && this.enemies.length === 0) {
        this.clearT += dt;
        if (this.clearT > 0.7) {
          var bonus = 50 * this.wave;
          this.score += bonus;
          this.floaters.push({ x: this.cx, y: this.cy - this.coreR - 40, t: 0,
                               txt: i18n().t('bonus', { n: bonus }), color: G.config.palette.good });
          this.clearT = 0;           // обязательно: без сброса ветка стреляет каждый кадр
          this.saveRun();
          this.openShop(game);
          return;                    // режим сменился на shop — выходим немедленно
        }
      } else this.clearT = 0;
    },

    /* ---------- магазин ---------- */
    openShop: function (game) {
      this.mode = 'shop';
      this.shopRvUsed = false;
      this.shopAutoT = this.autopilot ? 1.4 : 8;
      var avail = G.config.shop.filter(function (it) {
        return (PlayScene.upLevels[it.id] || 0) < it.max;
      });
      var rng = new E.Rng(this.rng.subSeed(this.wave * 31 + 7));
      var offers = [];
      var pool = avail.slice();
      while (offers.length < 3 && pool.length) {
        var idx = Math.floor(rng.float() * pool.length);
        offers.push(pool.splice(idx, 1)[0]);
      }
      this.shopOffers = offers;
      this.buildShopButtons(game);
    },
    buyItem: function (game, item) {
      var lvl = this.upLevels[item.id] || 0;
      var cost = G.config.shopCost(item, lvl);
      if (lvl >= item.max || this.coins < cost) { E.audio.sfx('deny'); return; }
      this.coins -= cost;
      this.upLevels[item.id] = lvl + 1;
      var d = this.def;
      if (item.id === 'dmg') d.dmg += 1;
      else if (item.id === 'rate') d.rate *= 1.25;
      else if (item.id === 'multi') d.multi += 1;
      else if (item.id === 'core') { this.core.max = Math.min(G.config.core.hpMaxCap, this.core.max + 1); this.core.hp = Math.min(this.core.max, this.core.hp + 1); }
      else if (item.id === 'pulse') { d.pulseCdMax *= 0.85; d.pulseDmg += 1; }
      else if (item.id === 'slow') d.slow += 1;
      else if (item.id === 'aegis') { d.aegisMax += 1; d.aegisLeft = d.aegisMax; }
      E.audio.sfx('buy');
      this.saveRun();
      this.buildShopButtons(game); // пересчитать цены/доступность
    },
    updateShop: function (game, dt) {
      this.shopAutoT -= dt;
      if (E.input.pointer.pressed) E.ui.handleTap(this.shopButtons, E.input.pointer.x, E.input.pointer.y);
      if (E.input.wasPressed('Enter') || E.input.wasPressed('Space')) this.closeShop(game);
      if (this.shopAutoT <= 0) {
        if (this.autopilot) {
          // autopilot покупает самое дорогое доступное — детерминированно
          var best = null, bestCost = -1;
          for (var i = 0; i < this.shopOffers.length; i++) {
            var it = this.shopOffers[i];
            var lvl = this.upLevels[it.id] || 0;
            var cost = G.config.shopCost(it, lvl);
            if (cost <= this.coins && cost > bestCost) { bestCost = cost; best = it; }
          }
          if (best) this.buyItem(game, best);
        }
        this.closeShop(game);
      }
    },
    closeShop: function (game) {
      if (this.mode !== 'shop') return;
      this.startWave(game);
    },

    /* ---------- game over ---------- */
    gameOver: function (game, byCapture) {
      if (this.mode === 'over') return;
      this.mode = 'over';
      this.overT = 0; this.overShown = false;
      this.floaters.length = 0; // очки-попапы бессмысленны на экране смерти — не мешают оверлею
      E.sdk.gameplayStop();
      E.audio.sfx('over');
      E.audio.music('menu');
      this.stats.kills += this.runKills;
      E.storage.set('stats', this.stats, true);
      var best = E.storage.get('best', 0);
      this.newBest = this.score > best;
      if (this.newBest) E.storage.set('best', this.score, true);
      E.storage.set('run', null, true); // забег окончен — продолжать нечего
      E.fx.shake(12, 0.5);
      E.fx.flash(G.config.palette.coreHurt, 0.3);
      if (!byCapture && !this.recordMode) E.sdk.showBanner(); // баннер только вне геймплея
      if (!byCapture && !this.recordMode && this.stats.games % 3 === 0) {
        // interstitial только в логической паузе, кулдаун 60с внутри sdk
        E.sdk.showInterstitial(function () {});
      }
      this.buildOverButtons(game);
    },
    revive: function (game) {
      var self = this;
      E.sdk.showRewarded({
        onReward: function () {
          self.reviveUsed = true;
          self.core.hp = self.core.max;
          self.mode = 'running';
          E.sdk.hideBanner();
          E.sdk.gameplayStart();
          E.audio.music('play');
          E.audio.sfx('revive');
          // отодвинуть врагов от ядра
          for (var i = 0; i < self.enemies.length; i++) {
            self.enemies[i].r = Math.max(self.enemies[i].r, self.spawnR * 0.7);
          }
          self.floaters.push({ x: self.cx, y: self.cy - self.coreR - 30, t: 0,
                               txt: i18n().t('revive_done'), color: G.config.palette.good });
          // gameOver() выше очистил сохранённый забег; оживление — это ВОЗОБНОВЛЕНИЕ
          // того же забега, поэтому снапшот пересохраняется НЕМЕДЛЕННО. Иначе выход
          // из игры между волнами после оживления терял бы весь прогресс (кнопка
          // «Продолжить» не появилась бы), а задача требует сохранение сразу после
          // действия игрока.
          self.saveRun();
        },
        onDone: function () {}
      });
    },
    restart: function (game) {
      var seed = (E.capture.seed != null) ? E.capture.seed : ((Date.now() % 2147483647) | 0);
      game.setScene('play', { seed: seed, autopilot: this.autopilot });
    },

    /* ---------- кнопки ---------- */
    buildHudButtons: function (game) {
      var v = game.view, C = G.config.palette, t = i18n();
      var self = this;
      this.hudButtons = [];
      this.hudButtons.push(new E.ui.Button({
        x: v.w - 52, y: 10, w: 42, h: 42, id: 'pause',
        onTap: function () { E.audio.sfx('click'); self.setPaused(true); },
        icon: function (ctx, b) {
          ctx.fillStyle = C.text;
          ctx.fillRect(b.x + b.w / 2 - 8, b.y + 11, 5, 20);
          ctx.fillRect(b.x + b.w / 2 + 3, b.y + 11, 5, 20);
        }
      }));
      // кнопка импульса — большая, под большой палец, внизу справа
      var pr = 38;
      this.pulseBtn = { x: v.w - pr - 18, y: v.h - pr - 18, r: pr };
      this.hudButtons.push(new E.ui.Button({
        x: this.pulseBtn.x - pr, y: this.pulseBtn.y - pr, w: pr * 2, h: pr * 2, id: 'pulse',
        bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
        onTap: function () { self.activatePulse(game); },
        icon: function () {}
      }));
    },
    buildPauseButtons: function () {
      var t = i18n(), self = this;
      var game = E.sdk._game, v = game.view;
      // Оверлей паузы рисуется поверх геймплея, баннер в бою скрыт — availH = вся высота.
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;
      var cx = v.w / 2;
      var k = clamp(availH / 460, 0.72, 1);
      var bw = Math.min(260, v.w * 0.7);
      // заголовок «Пауза» — сверху, кнопки занимают остаток и ГАРАНТИРОВАННО в него влезают
      this.pauseTitleY = availH * 0.20;
      this.pauseTitleSize = Math.round(36 * k);
      var top = this.pauseTitleY + 34 * k;
      var stackAvail = Math.max(40, availH - top - 8);
      var rows = [
        { h: Math.round(50 * k), gap: Math.round(12 * k) },
        { h: Math.round(50 * k), gap: Math.round(12 * k) },
        { h: Math.round(50 * k), gap: Math.round(10 * k) },
        { h: Math.round(44 * k), gap: 0 }
      ];
      var col = E.ui.layoutColumn(rows, stackAvail, { pad: 0, alignTop: true });
      var sc = col.scale;
      this.pauseButtons = [];
      var mk = function (idx, text, fontSize, onTap) {
        var yy = top + col.ys[idx];
        self.pauseButtons.push(new E.ui.Button({
          x: cx - bw / 2, y: yy, w: bw, h: rows[idx].h * sc,
          fontSize: Math.max(11, Math.round(fontSize * k * sc)), text: text, onTap: onTap
        }));
      };
      mk(0, t.t('pause_resume'), 20, function () { E.audio.sfx('click'); self.setPaused(false); });
      mk(1, t.t('pause_restart'), 20, function () { E.audio.sfx('click'); self.restart(game); });
      mk(2, t.t('pause_menu'), 20, function () { E.audio.sfx('click'); game.setScene('menu'); });
      mk(3, E.audio.isMuted() ? t.t('snd_off') : t.t('snd_on'), 16, function (b) {
        var m = !E.audio.isMuted();
        E.audio.setMuted(m); E.storage.set('muted', m, true);
        b.text = m ? t.t('snd_off') : t.t('snd_on');
      });
    },
    buildShopButtons: function (game) {
      var v = game.view, C = G.config.palette, t = i18n(), self = this;
      this.shopButtons = [];
      var n = this.shopOffers.length;
      var gap = 14;
      var cw = Math.min(180, (v.w - 40 - gap * (n - 1)) / Math.max(1, n));
      var ch = Math.min(210, v.h * 0.34);
      var x0 = (v.w - (cw * n + gap * (n - 1))) / 2;
      var y0 = v.h * 0.30;
      this.shopCards = [];
      for (var i = 0; i < n; i++) {
        (function (item, x) {
          self.shopCards.push({ item: item, x: x, y: y0, w: cw, h: ch });
          self.shopButtons.push(new E.ui.Button({
            x: x, y: y0, w: cw, h: ch,
            bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)',
            onTap: function () { self.buyItem(game, item); },
            icon: function () {}
          }));
        })(this.shopOffers[i], x0 + i * (cw + gap));
      }
      var bw = Math.min(240, v.w * 0.42), bh = 48;
      var by = y0 + ch + 18;
      this.shopButtons.push(new E.ui.Button({
        x: v.w / 2 - bw - 8, y: by, w: bw, h: bh, fontSize: 16,
        text: t.t('shop_rv', { n: G.config.economy.rvCoins }),
        visible: !this.shopRvUsed,
        onTap: function () {
          E.audio.sfx('click');
          E.sdk.showRewarded({
            onReward: function () {
              self.coins += G.config.economy.rvCoins;
              self.shopRvUsed = true;
              E.audio.sfx('coin');
              self.buildShopButtons(game);
            },
            onDone: function () {}
          });
        }
      }));
      this.shopButtons.push(new E.ui.Button({
        x: v.w / 2 + 8, y: by, w: bw, h: bh, fontSize: 18,
        text: t.t('shop_next'),
        onTap: function () { E.audio.sfx('click'); self.closeShop(game); }
      }));
    },
    buildOverButtons: function (game) {
      var v = game.view, t = i18n(), self = this;
      var inset = E.sdk.bannerInsetPx();
      var availH = v.h - inset;   // тексты И кнопки — в одной системе координат, выше баннера
      var cx = v.w / 2;
      var k = clamp(availH / 460, 0.72, 1);
      var bw = Math.min(280, v.w * 0.72);

      // ЕДИНЫЙ вертикальный стек: заголовок, очки, рекорд, «новый рекорд», затем кнопки.
      // layoutColumn гарантирует, что всё влезет в availH — тексты больше не могут
      // оказаться под кнопками (раньше тексты были в долях v.h, кнопки — в долях availH).
      var rows = [], kinds = [];
      rows.push({ h: Math.round(38 * k), gap: Math.round(6 * k) });  kinds.push('title');
      rows.push({ h: Math.round(24 * k), gap: Math.round(4 * k) });  kinds.push('score');
      rows.push({ h: Math.round(18 * k), gap: Math.round(8 * k) });  kinds.push('best');
      var hasNew = this.newBest;
      if (hasNew) { rows.push({ h: Math.round(20 * k), gap: Math.round(14 * k) }); kinds.push('newbest'); }
      var revive = !this.reviveUsed && !this.autopilot;
      if (revive) { rows.push({ h: Math.round(50 * k), gap: Math.round(12 * k) }); kinds.push('revive'); }
      rows.push({ h: Math.round(50 * k), gap: Math.round(12 * k) }); kinds.push('restart');
      rows.push({ h: Math.round(50 * k), gap: 0 });                  kinds.push('menu');

      var col = E.ui.layoutColumn(rows, availH, { pad: 10 });
      var sc = col.scale;
      this.overLayout = {};   // y-позиции (центр для текста, верх для кнопок) + scale
      this.overButtons = [];
      for (var i = 0; i < kinds.length; i++) {
        var top = col.ys[i], hh = rows[i].h * sc;
        var kind = kinds[i];
        if (kind === 'title' || kind === 'score' || kind === 'best' || kind === 'newbest') {
          this.overLayout[kind] = { y: top + hh / 2, size: Math.max(11, Math.round(rows[i].h * sc)) };
        } else {
          var fs = Math.max(12, Math.round(20 * k * sc));
          if (kind === 'revive') {
            this.overButtons.push(new E.ui.Button({
              x: cx - bw / 2, y: top, w: bw, h: hh, fontSize: fs, text: t.t('over_revive'),
              bg: '#14301c', border: G.config.palette.good,
              onTap: function () { E.audio.sfx('click'); self.revive(game); }
            }));
          } else if (kind === 'restart') {
            this.overButtons.push(new E.ui.Button({ x: cx - bw / 2, y: top, w: bw, h: hh, fontSize: fs, text: t.t('over_restart'),
              onTap: function () { E.audio.sfx('click'); self.restart(game); } }));
          } else {
            this.overButtons.push(new E.ui.Button({ x: cx - bw / 2, y: top, w: bw, h: hh, fontSize: fs, text: t.t('over_menu'),
              onTap: function () { E.audio.sfx('click'); game.setScene('menu'); } }));
          }
        }
      }
      this.overBottom = col.top + col.height; // ГАРАНТИРОВАННО <= availH
    },
    updateOver: function (game, dt) {
      this.overT += dt;
      if (this.overT > 0.6 && !this.overShown) { this.overShown = true; }
      if (this.overShown && E.input.pointer.pressed) {
        E.ui.handleTap(this.overButtons, E.input.pointer.x, E.input.pointer.y);
      }
      if (this.overShown && E.input.wasPressed('Enter')) this.restart(game);
      if (this.autopilot && this.overT > 0.5) this.restart(game); // attract: быстрый рестарт
    },

    /* ---------- отрисовка ---------- */
    draw: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      drawBackground(game, ctx, this.stars, this.waveT + this.wave * 3);
      ctx.save();
      ctx.translate(E.fx.offsetX(game.time), E.fx.offsetY(game.time));
      // арена: направляющие кольца
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = C.core; ctx.lineWidth = 1;
      for (var ring = 1; ring <= 3; ring++) {
        G.entities.poly(ctx, this.cx, this.cy, this.spawnR * ring / 3, 6, game.time * 0.05);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // враги
      for (var i = 0; i < this.enemies.length; i++) {
        G.entities.drawEnemy(ctx, this.enemies[i], this.cx, this.cy, C);
      }
      // пули
      for (i = 0; i < this.bullets.length; i++) G.entities.drawBullet(ctx, this.bullets[i], C);
      // ядро и страж
      this.core.aegisLeft = this.def.aegisLeft; // drawCore рисует кольцо по заряду щита
      G.entities.drawCore(ctx, this.cx, this.cy, this.core, this.coreR, C, game.time);
      var p = this.defPos();
      G.entities.drawDefender(ctx, p.x, p.y, this.def.aim, C, this.def.pulseCd <= 0);
      // радиус импульса при готовности
      if (this.def.pulseCd <= 0 && this.mode === 'running') {
        ctx.globalAlpha = 0.07 + 0.03 * Math.sin(game.time * 3);
        ctx.strokeStyle = C.defender; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, this.def.pulseR, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      E.fx.draw(ctx);
      // всплывающий текст
      for (i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        ctx.globalAlpha = 1 - f.t / 0.9;
        E.ui.text(ctx, f.txt, f.x, f.y, 16, f.color, 'center', 700);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      E.fx.drawFlash(ctx, v.w, v.h);
      this.drawHud(game, ctx);
      if (this.bannerT > 0 && this.mode === 'running') {
        ctx.globalAlpha = Math.min(1, this.bannerT);
        E.ui.text(ctx, t.t('hud_wave', { n: this.wave }), v.w / 2, v.h * 0.24, 40, C.text, 'center', 800);
        ctx.globalAlpha = 1;
      }
      if (this.tutorial > 0 && this.mode === 'running' && !this.autopilot) this.drawTutorial(game, ctx);
      if (this.mode === 'shop') this.drawShop(game, ctx);
      if (this.mode === 'paused') this.drawPause(game, ctx);
      if (this.mode === 'over') this.drawOver(game, ctx);
    },
    drawHud: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(10,13,28,0.72)';
      ctx.fillRect(0, 0, v.w, 56);
      E.ui.text(ctx, t.t('hud_score') + ': ' + this.score, 14, 28, 17, C.text, 'left', 700);
      E.ui.text(ctx, t.t('hud_wave', { n: this.wave }), v.w / 2, 28, 17, C.text, 'center', 700);
      // монеты
      ctx.fillStyle = C.coin;
      ctx.beginPath(); ctx.arc(v.w - 118, 28, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5c00';
      ctx.beginPath(); ctx.arc(v.w - 118, 28, 4, 0, Math.PI * 2); ctx.fill();
      E.ui.text(ctx, String(this.coins), v.w - 104, 28, 17, C.text, 'left', 700);
      // сердечки ядра (рисуются по max, заполнение — по hp)
      var shownMax = Math.min(this.core.max, 6);
      for (var i = 0; i < shownMax; i++) {
        ctx.fillStyle = i < this.core.hp ? C.core : 'rgba(125,249,255,0.18)';
        ctx.beginPath(); ctx.arc(20 + i * 20, 68, 6, 0, Math.PI * 2); ctx.fill();
      }
      if (this.mode === 'running') {
        E.ui.drawButtons(ctx, this.hudButtons); // пауза и импульс — обе кликабельны
        // индикатор перезарядки импульса поверх его кнопки
        var pb = this.pulseBtn, k = this.def.pulseCdMax > 0 ? 1 - this.def.pulseCd / this.def.pulseCdMax : 1;
        ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20,26,52,0.8)'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = k >= 1 ? C.defender : C.dim; ctx.stroke();
        if (k < 1) {
          ctx.beginPath();
          ctx.moveTo(pb.x, pb.y);
          ctx.arc(pb.x, pb.y, pb.r - 4, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,224,102,0.25)'; ctx.fill();
        }
        ctx.fillStyle = k >= 1 ? C.defender : C.dim;
        G.entities.poly(ctx, pb.x, pb.y, 12, 3, -Math.PI / 2); ctx.fill();
      }
    },
    drawTutorial: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      var txt = this.wave === 1 && this.tutorial === 1 ? t.t('tut_goal')
              : this.tutorial === 1 ? t.t('tut_move') : t.t('tut_pulse');
      // на первой волне с копейщиками — короткое предупреждение вместо обычной подсказки
      if (this.wave === G.config.waves.lancerFrom && this.waveT < 3.5) txt = t.t('tut_lancer');
      var y = v.h - 130;
      ctx.fillStyle = 'rgba(10,13,28,0.8)';
      E.ui.roundRect(ctx, v.w * 0.06, y - 26, v.w * 0.88, 52, 12); ctx.fill();
      var size = E.ui.fit(ctx, txt, v.w * 0.8, 15, 500);
      E.ui.text(ctx, txt, v.w / 2, y, size, C.text, 'center', 500);
      // пульсирующая стрелка к стражу
      var p = this.defPos();
      var bob = Math.sin(game.time * 4) * 6;
      ctx.fillStyle = C.defender;
      G.entities.poly(ctx, p.x, p.y - 34 + bob, 8, 3, Math.PI); ctx.fill();
    },
    drawShop: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(5,7,16,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('shop_title'), v.w / 2, v.h * 0.16, 34, C.text, 'center', 800);
      E.ui.text(ctx, t.t('shop_coins', { n: this.coins }), v.w / 2, v.h * 0.16 + 38, 18, C.coin, 'center', 700);
      for (var i = 0; i < this.shopCards.length; i++) {
        var card = this.shopCards[i], item = card.item;
        var lvl = this.upLevels[item.id] || 0;
        var maxed = lvl >= item.max;
        var cost = G.config.shopCost(item, lvl);
        var afford = this.coins >= cost;
        ctx.globalAlpha = (!maxed && afford) ? 1 : 0.55;
        E.ui.roundRect(ctx, card.x, card.y, card.w, card.h, 14);
        ctx.fillStyle = C.panel; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = C.panelBorder; ctx.stroke();
        var nameS = E.ui.fit(ctx, t.t('item_' + item.id), card.w - 16, 19, 700);
        E.ui.text(ctx, t.t('item_' + item.id), card.x + card.w / 2, card.y + 26, nameS, C.text, 'center', 700);
        var descS = E.ui.fit(ctx, t.t('item_' + item.id + '_d'), card.w - 14, 13, 400);
        E.ui.text(ctx, t.t('item_' + item.id + '_d'), card.x + card.w / 2, card.y + 52, descS, C.dim, 'center', 400);
        // пипсы уровня
        for (var p = 0; p < item.max; p++) {
          ctx.fillStyle = p < lvl ? C.good : 'rgba(255,255,255,0.15)';
          ctx.fillRect(card.x + 10 + p * ((card.w - 20) / item.max), card.y + card.h - 54, (card.w - 20) / item.max - 3, 5);
        }
        E.ui.text(ctx, maxed ? t.t('shop_max') : String(cost),
                  card.x + card.w / 2, card.y + card.h - 26, 20,
                  maxed ? C.good : (afford ? C.coin : C.bad), 'center', 800);
        ctx.globalAlpha = 1;
      }
      E.ui.drawButtons(ctx, this.shopButtons);
      // полоса автопродолжения
      var bw = Math.min(300, v.w * 0.6);
      var k = clamp(this.shopAutoT / (this.autopilot ? 1.4 : 8), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(v.w / 2 - bw / 2, v.h - 30, bw, 4);
      ctx.fillStyle = C.accent;
      ctx.fillRect(v.w / 2 - bw / 2, v.h - 30, bw * k, 4);
    },
    drawPause: function (game, ctx) {
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(5,7,16,0.72)'; ctx.fillRect(0, 0, v.w, v.h);
      E.ui.text(ctx, t.t('pause_title'), v.w / 2, this.pauseTitleY || v.h * 0.28,
                this.pauseTitleSize || 36, C.text, 'center', 800);
      E.ui.drawButtons(ctx, this.pauseButtons);
    },
    drawOver: function (game, ctx) {
      if (!this.overShown && this.overT < 0.6) return;
      var v = game.view, C = G.config.palette, t = i18n();
      ctx.fillStyle = 'rgba(5,7,16,0.78)'; ctx.fillRect(0, 0, v.w, v.h);
      var L = this.overLayout || {};
      var cx = v.w / 2;
      var put = function (kind, str, weight, color) {
        var s = L[kind]; if (!s) return;
        E.ui.text(ctx, str, cx, s.y, s.size, color, 'center', weight);
      };
      put('title', t.t('over_title'), 800, C.coreHurt);
      put('score', t.t('over_score', { n: this.score }), 700, C.text);
      put('best', t.t('over_best', { n: Math.max(E.storage.get('best', 0), this.score) }), 600, C.dim);
      if (this.newBest && L.newbest) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(game.time * 5);
        E.ui.text(ctx, t.t('over_newbest'), cx, L.newbest.y, L.newbest.size, C.good, 'center', 800);
        ctx.globalAlpha = 1;
      }
      E.ui.drawButtons(ctx, this.overButtons);
    }
  };

  G.scenes = { menu: MenuScene, play: PlayScene };
})(window.GAME);
