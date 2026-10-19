/* engine/core.js — игровой цикл (fixed timestep 1/60, спираль-гард), менеджер сцен,
   resize с devicePixelRatio (cap 2), пауза по стеку причин (sys/sdk/ad/capture/exit/manual),
   остановка звука и обновлений при потере фокуса (1.3), рендер продолжается (замороженный кадр),
   защита от выхода по истории браузера.
   EXIT/bfcache: SDK-событие EXIT ставит причину паузы 'exit'. Если страница восстановлена
   из back-forward cache (pageshow, e.persisted=true) — полной перезагрузки нет, поэтому
   'exit' снимается здесь по pageshow (и дополнительно по game_api_resume в sdk.js):
   игра никогда не остаётся навсегда замороженной после навигации по платформе.
   Capture:
   - manual-режим: update остановлен, но render продолжается — canvas всегда показывает
     последний отрисованный кадр, __capture.step/renderOnce доступны извне.
   - record-режим (?record=N): игровое время = wall-clock. За каждый RAF выполняется
     floor(elapsed*60) кадров 1/60 (с cap 60), поэтому видео длится ровно N секунд
     реального времени независимо от частоты монитора (60/90/120 Гц). */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';

  function Game(opts) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.bgColor = opts.bgColor || '#0b0e1a';
    this.scenes = {};
    this.scene = null; this.sceneName = '';
    this.view = { w: 0, h: 0, dpr: 1 };
    this.fixedDt = 1 / 60;
    this.timeScale = 1;
    this.time = 0; this.frame = 0;
    this._acc = 0; this._last = 0;
    this._pauseCount = 0; this._pauseReasons = {};
    this.manual = false;         // capture: внешнее шагание через game.step()
    this._recordElapsed = 0;     // capture record: wall-clock накопитель
    this.onPause = []; this.onResume = [];
    this.started = false;
    this.fps = 60; this._fpsCount = 0; this._fpsTime = 0;
  }

  Game.prototype.addScene = function (name, scene) { this.scenes[name] = scene; scene.name = name; };
  Game.prototype.setScene = function (name, params) {
    if (this.scene && this.scene.exit) { try { this.scene.exit(this); } catch (e) {} }
    // геометрия ОБЯЗАНА существовать до enter(): иначе layout/capture-симуляция считаются
    // в view.w=view.h=0 (нулевая арена, враги спавнятся в r=0 и мгновенно «бьют ядро»).
    this._syncViewGeometry(); // НЕ трогает onResize старой/новой сцены — только canvas+view
    this.scene = this.scenes[name]; this.sceneName = name;
    if (this.scene && this.scene.enter) this.scene.enter(this, params || {});
  };

  // устанавливает размер canvas, DPR-трансформ и view.w/h — без колбэка onResize.
  // возвращает true, если размер действительно изменился.
  Game.prototype._syncViewGeometry = function () {
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    var changed = (this.canvas.width !== W || this.canvas.height !== H || this.view.w !== w || this.view.h !== h);
    this.canvas.width = W; this.canvas.height = H;
    this.view.w = w; this.view.h = h; this.view.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return changed;
  };

  Game.prototype.resize = function () {
    // onResize зовётся ТОЛЬКО если геометрия реально изменилась: иначе boot-последовательность
    // (setScene -> start -> resize) стирала бы пули/частицы, только что созданные
    // capture-симуляцией. Баннерный relayout идёт напрямую через scene.onResize (см. sdk.js),
    // поэтому показ/скрытие стики-баннера по-прежнему перестраивает раскладку.
    var changed = this._syncViewGeometry();
    if (changed && this.scene && this.scene.onResize) { try { this.scene.onResize(this); } catch (e) {} }
  };

  Game.prototype.isPaused = function () { return this._pauseCount > 0; };
  Game.prototype.pause = function (reason) {
    if (this._pauseReasons[reason]) return;
    this._pauseReasons[reason] = true; this._pauseCount++;
    if (this._pauseCount === 1) {
      if (E.audio) E.audio.suspend();
      // GameplayAPI.stop() на ЛЮБУЮ системную паузу: сворачивание вкладки, blur,
      // game_api_pause, показ рекламы — для платформы геймплей тоже замирает (1.19.3)
      if (E.sdk && E.sdk.gameplayPauseChanged) { try { E.sdk.gameplayPauseChanged(true); } catch (e) {} }
      for (var i = 0; i < this.onPause.length; i++) { try { this.onPause[i](reason); } catch (e) {} }
    }
  };
  Game.prototype.resume = function (reason) {
    if (!this._pauseReasons[reason]) return; // идемпотентно: resume по отсутствующей причине — no-op
    delete this._pauseReasons[reason]; this._pauseCount--;
    if (this._pauseCount === 0) {
      if (E.audio) E.audio.resume();
      if (E.sdk && E.sdk.gameplayPauseChanged) { try { E.sdk.gameplayPauseChanged(false); } catch (e) {} }
      for (var i = 0; i < this.onResume.length; i++) { try { this.onResume[i](reason); } catch (e) {} }
    }
  };

  Game.prototype.update = function (dt) {
    this.time += dt; this.frame++;
    if (this.scene && this.scene.update) this.scene.update(this, dt);
    if (E.fx) E.fx.update(dt);
  };
  Game.prototype.render = function () {
    var ctx = this.ctx, v = this.view;
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, v.w, v.h);
    if (this.scene && this.scene.draw) this.scene.draw(this, ctx);
  };
  Game.prototype.step = function (n) {
    n = n || 1;
    for (var i = 0; i < n; i++) {
      if (!this.isPaused()) this.update(this.fixedDt);
      // В manual-режиме основной цикл не тикает, поэтому edge-флаги ввода
      // (pointer.pressed/released/moved, I.pressed{}, anyKey*) ОБЯЗАНЫ гаситься
      // здесь. Иначе один случайный pointerdown «залипнет» навсегда и будет
      // повторно срабатывать (hitTest+impulse/кнопки) на КАЖДОМ __capture.step(),
      // ломая детерминизм покадровой съёмки.
      if (E.input) E.input.postUpdate();
    }
    this.render();
  };

  Game.prototype._frame = function (ts) {
    var self = this;
    requestAnimationFrame(function (t) { self._frame(t); });
    if (!this._last) this._last = ts;
    var dt = Math.min((ts - this._last) / 1000, 0.25);
    this._last = ts;

    if (this.manual) {
      // capture шагает кадрами снаружи; render продолжается — кадр всегда свежий.
      // Edge-флаги ввода ЗДЕСЬ НЕ трогаем: render() их не потребляет (в manual-режиме
      // update() идёт только из step()). Флаги обязан гасить step() после каждого
      // симулированного кадра — иначе одиночный pointerdown «залипал» бы и переигрывался
      // на всех последующих step(). RAF-ветка только рисует, поэтому внешний скрипт может
      // безопасно диспатчить событие и затем шагнуть — флаг доживёт до step() и будет
      // потреблён ровно один раз.
      this.render();
      return;
    }

    if (E.capture && E.capture.record > 0) {
      // record-режим: игровое время привязано к wall-clock, не к частоте RAF.
      this._acc += dt;
      var n = 0, maxSteps = 60; // защита от спирали после сворачивания вкладки
      while (this._acc >= this.fixedDt && n < maxSteps) {
        if (!this.isPaused()) this.update(this.fixedDt);
        this._acc -= this.fixedDt; n++;
      }
      if (n === maxSteps) this._acc = 0;
    } else {
      this._acc += dt * this.timeScale;
      var steps2 = 0;
      while (this._acc >= this.fixedDt && steps2 < 5) {
        if (!this.isPaused()) this.update(this.fixedDt);
        this._acc -= this.fixedDt; steps2++;
      }
      if (steps2 === 5) this._acc = 0;
    }

    this.render();
    if (E.input) E.input.postUpdate();
    this._fpsCount++; this._fpsTime += dt;
    if (this._fpsTime >= 1) {
      this.fps = Math.round(this._fpsCount / this._fpsTime);
      this._fpsCount = 0; this._fpsTime = 0;
    }
  };

  Game.prototype.start = function () {
    if (this.started) return; this.started = true;
    var self = this;
    this.resize();
    var rs = function () { self.resize(); };
    window.addEventListener('resize', rs);
    window.addEventListener('orientationchange', function () { setTimeout(rs, 60); setTimeout(rs, 300); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.pause('sys'); else self.resume('sys');
    });
    window.addEventListener('blur', function () { self.pause('sys'); });
    window.addEventListener('focus', function () { self.resume('sys'); });
    // Возврат из back-forward cache: страница восстановлена БЕЗ перезагрузки, поэтому
    // EXIT-пауза (поставленная при уходе на другую страницу платформы) должна быть
    // снята здесь — иначе focus/resume('sys') её не трогает, и игра осталась бы
    // навсегда замороженной на кадре без оверлея. pageshow с persisted=true — это
    // именно сценарий bfcache-возврата; на обычной загрузке 'exit' в стеке нет,
    // и resume('exit') — безопасный no-op (стек причин идемпотентен).
    window.addEventListener('pageshow', function (e) {
      self.resume('exit');
      if (e && e.persisted) rs(); // геометрия могла измениться, пока страница была в кэше
    });
    // Переходы по истории браузера («Назад» / Alt+← / системный Back на Android) не
    // выбрасывают из игры (1.14). ВАЖНО: мы НЕ глушим цикл через core.pause('sys') —
    // тогда update остановился бы, ввод перестал обрабатываться и пауза стала бы
    // необратимой (Alt+← не теряет фокус окна). Вместо этого гасим сам popstate
    // (pushState обратно) и просим сцену перейти в СВОЙ режим паузы: цикл продолжает
    // тикать, оверлей паузы рисуется, Escape/тап по «Продолжить» возвращают в игру.
    try {
      history.pushState({ g: 1 }, '');
      window.addEventListener('popstate', function () {
        try { history.pushState({ g: 1 }, ''); } catch (e) {}
        if (self.scene && self.scene.onBack) { try { self.scene.onBack(self); } catch (e) {} }
      });
    } catch (e) {}
    requestAnimationFrame(function (t) { self._last = t; self._frame(t); });
  };

  E.core = { Game: Game };
})(window.Engine);
