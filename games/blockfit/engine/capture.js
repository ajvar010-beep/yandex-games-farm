/* engine/capture.js — capture-хуки для автосъёмки медиа внешним скриптом (headless Chrome).
   URL-параметры (все опциональны, ВСЕ — из белого списка KNOWN):
     ?seed=N          детерминированный seed партии
     ?scene=menu|play стартовая сцена
     ?wave=N&score=N&coins=N&mode=shop|over&t=SEC  состояние игры
     ?freeze=1        прогнать t секунд, отрендерить и заморозить кадр (скриншот)
     ?manual=1        update остановлен; внешний шаг через __capture.step(n); render идёт
     ?autoplay=1      autopilot играет сам (attract-режим для видео)
     ?record=SEC      записать canvas в webm ровно SEC секунд (<=28) WALL-CLOCK времени
                      (включает record-safe режим: ядро неуязвимо, сложность ограничена)
     ?lang=ru|en      форсировать язык
     ?mute=1          без звука
     ?banner=1        показать стики-баннер на скриншоте (по умолчанию в capture-режиме
                      баннер НЕ резервирует место — в кадре нет живой рекламы)
   window.__capture = { ready, setScene, setState, getState, step, renderOnce, pause, resume, video }
   В standalone-режиме (sdk-stub) реклама "показывается" мгновенно — съёмка не блокируется.

   АКТИВАЦИЯ — СТРОГО ПО БЕЛОМУ СПИСКУ. Capture-режим (C.active) включается, только если
   в URL есть хотя бы один ИЗВЕСТНЫЙ параметр из KNOWN. Любые чужие параметры —
   ?utm_source=... из расшаренных ссылок, ?payload=... (deep-link платформы:
   ysdk.environment.payload читается именно из query URL игры), мусорные параметры —
   ПОЛНОСТЬЮ игнорируются и не попадают в C.params. У реального игрока на платформе
   стики-баннер, стартовая сцена и звук никогда не меняются из-за чужого query.
   Значения известных параметров валидируются: scene — только menu|play, lang — ru|en,
   record — clamp 0..28, флаги — только '1'. */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var C = { params: {}, seed: null, scene: null, lang: null, mute: false,
            autoplay: false, manual: false, freeze: false, record: 0, banner: false,
            active: false, recorder: null, _chunks: [], _recordLeft: 0, _game: null };

  // Белый список capture-параметров. Ничего вне него игра не читает из query.
  var KNOWN = { seed: 1, scene: 1, wave: 1, score: 1, coins: 1, mode: 1, t: 1,
                freeze: 1, manual: 1, autoplay: 1, record: 1, lang: 1, mute: 1, banner: 1 };

  function parseQuery() {
    var raw = {};
    try { new URLSearchParams(location.search).forEach(function (v, k) { raw[k] = v; }); } catch (e) {}
    var p = {}, known = 0;
    for (var k in raw) {
      if (Object.prototype.hasOwnProperty.call(KNOWN, k)) { p[k] = raw[k]; known++; }
      // чужие ключи (utm_*, payload, fbclid и т.п.) сюда не попадают вообще
    }
    return { params: p, known: known };
  }

  C.init = function (game) {
    C._game = game;
    var parsed = parseQuery();
    var P = C.params = parsed.params;
    C.active = parsed.known > 0; // ТОЛЬКО наши capture-параметры, никаких «любой query»

    if (P.seed != null) C.seed = isNaN(+P.seed) ? String(P.seed) : (+P.seed);
    C.scene = (P.scene === 'play' || P.scene === 'menu') ? P.scene : null; // иное — игнор
    C.lang = (P.lang === 'ru' || P.lang === 'en') ? P.lang : null;
    C.mute = P.mute === '1';
    C.autoplay = P.autoplay === '1';
    C.freeze = P.freeze === '1';
    C.manual = P.manual === '1' || C.freeze;
    C.record = Math.max(0, Math.min(28, parseFloat(P.record) || 0)); // жёсткий clamp 28 с
    C.banner = P.banner === '1';
    if (C.manual) game.manual = true; // update глушится, render продолжается в core

    window.__capture = {
      ready: false,
      params: C.params,
      setScene: function (n, p) { game.setScene(n, p); },
      setState: function (s) { if (game.scene && game.scene.setCaptureState) game.scene.setCaptureState(game, s || {}); },
      getState: function () { return (game.scene && game.scene.getCaptureState) ? game.scene.getCaptureState(game) : {}; },
      step: function (n) { game.step(n || 1); },
      renderOnce: function () { game.render(); },
      pause: function () { game.pause('capture'); },
      resume: function () { game.resume('capture'); },
      video: null
    };
  };

  C.markReady = function () {
    if (!window.__capture) return;
    // финальный кадр: гарантированно что-то нарисовано (даже при freeze)
    if (C._game) { try { C._game.render(); } catch (e) {} }
    window.__capture.ready = true;
  };

  C.maybeStartRecording = function () {
    if (!C.record || C.recorder) return;
    if (!window.MediaRecorder || !C._game.canvas.captureStream) return;
    var stream;
    try { stream = C._game.canvas.captureStream(60); } catch (e) { return; }
    var mime = '';
    try {
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mime = 'video/webm;codecs=vp9';
      else if (MediaRecorder.isTypeSupported('video/webm')) mime = 'video/webm';
    } catch (e) {}
    try {
      var rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8000000 });
      C._chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) C._chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new Blob(C._chunks, { type: mime || 'video/webm' });
        var rd = new FileReader();
        rd.onloadend = function () {
          window.__capture.video = { mime: blob.type, base64: String(rd.result).split(',')[1], seconds: C.record };
        };
        rd.readAsDataURL(blob);
      };
      C.recorder = rec;
      C._recordLeft = C.record;
      rec.start(250);
    } catch (e) { C.recorder = null; }
  };

  /* tickRecording вызывается из сцены на каждый update с фикс-dt (1/60).
     record-режим core гарантирует: число update'ов в секунду wall-clock = 60. */
  C.tickRecording = function (dt) {
    if (!C.recorder) return;
    C._recordLeft -= dt;
    if (C._recordLeft <= 0 && C.recorder.state !== 'inactive') {
      try { C.recorder.stop(); } catch (e) {}
    }
  };
  E.capture = C;
})(window.Engine);
