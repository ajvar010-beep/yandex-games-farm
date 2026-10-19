/* engine/sdk.js — единая точка интеграции SDK Яндекс Игр и всей рекламы.
   - YaGames.init(), автоязык (2.14), LoadingAPI.ready (1.19.2), GameplayAPI (1.19.3)
   - события game_api_pause/resume (оба написания) и EXIT (1.19.4)
   - fullscreen: только в логических паузах, кулдаун 60 сек, звук+геймплей на паузе (4.7),
     onClose/onError обрабатывают "реклама не показалась" — игра продолжается
   - rewarded: награда строго в onRewarded; onError/onClose без награды (4.5)
   - стики-баннер: только вне геймплея (4.6); show/hide + статус
   EXIT: ставит причину паузы 'exit' (см. core.js: pageshow и game_api_resume снимают её,
   поэтому возврат из bfcache/навигации платформы не оставляет игру замороженной).
   Все вызовы обёрнуты в try/catch — ноль ошибок консоли (6.4). */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var K = {
    ysdk: null, isStub: true, lang: 'en', bannerVisible: false,
    bannerInset: 0, // реальная высота стики-баннера, сообщённая платформой (0 = не показан)
    cooldownMs: 60000, _lastInterstitial: 0,
    _pauseCbs: [], _resumeCbs: [], inAd: false, _game: null
  };
  // Резервная высота баннера, если платформа не вернула её в статусе. Берётся от
  // высоты экрана (10%, clamp 46..120) — физически правдоподобно и адаптивно.
  function fallbackInset() {
    var h = 0; try { h = window.innerHeight || 0; } catch (e) {}
    return Math.max(46, Math.min(120, Math.round(Math.max(h, 300) * 0.1)));
  }
  K.bannerInsetPx = function () { return K.bannerVisible ? (K.bannerInset || fallbackInset()) : 0; };

  function emit(list, arg) { for (var i = 0; i < list.length; i++) { try { list[i](arg); } catch (e) {} } }
  K.onPause = function (cb) { K._pauseCbs.push(cb); };
  K.onResume = function (cb) { K._resumeCbs.push(cb); };
  K.pause = function (why) { emit(K._pauseCbs, why); };
  K.resume = function (why) { emit(K._resumeCbs, why); };

  K.init = function () {
    if (!window.YaGames || typeof window.YaGames.init !== 'function') return Promise.resolve(null);
    return window.YaGames.init().then(function (ysdk) {
      K.ysdk = ysdk;
      K.isStub = !!ysdk.__isStub;
      var l = '';
      try { l = (ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang) || ''; } catch (e) {}
      K.lang = /^ru/i.test(l) ? 'ru' : 'en';
      if (typeof ysdk.on === 'function') {
        var subs = [
          ['game_api_pause', 'pause'], ['game api pause', 'pause'],
          ['game_api_resume', 'resume'], ['game api resume', 'resume']
        ];
        subs.forEach(function (pair) {
          try {
            ysdk.on(pair[0], function () {
              if (pair[1] === 'pause') {
                K.pause('sdk');
              } else {
                // платформа вернула геймплей: снимаем и sdk-паузу, и возможную exit-паузу —
                // возврат в игру после навигации по платформе не должен оставлять её
                // замороженной (стек причин идемпотентен: resume по отсутствующей
                // причине — no-op).
                K.resume('sdk');
                K.resume('exit');
              }
            });
          } catch (e) {}
        });
        try {
          ysdk.on('EXIT', function () {
            if (E.storage) E.storage.flush(true); // flush=true — запись на сервер до закрытия
            K.pause('exit'); // снимается pageshow (bfcache-возврат) или game_api_resume
          });
        } catch (e) {}
      }
      return ysdk;
    }).catch(function () { K.ysdk = null; return null; });
  };

  /* GameplayAPI — идемпотентный sync, а не «голые» start/stop.
     _gameplayWanted — чего хочет сцена (геймплей начался/кончился).
     _pausedByCore — ядро на паузе по ЛЮБОЙ причине (sys/blur, sdk game_api_pause, ad, capture).
     _loadingReady — LoadingAPI.ready() уже вызван (GameplayAPI.start ДО ready запрещён).
     Фактический старт = wanted && !paused && ready. stop = иначе. Повторные вызовы
     не дёргают API дважды (флаг _gameplayActive). Это закрывает: (а) при сворачивании
     вкладки/game_api_pause геймплей для платформы тоже останавливается, (б) старт не
     уходит раньше LoadingAPI.ready(). */
  K._gameplayWanted = false; K._pausedByCore = false; K._loadingReady = false; K._gameplayActive = false;
  K._syncGameplay = function () {
    if (!K._loadingReady) return;                       // start ДО ready — отложен
    var api = K.ysdk && K.ysdk.features && K.ysdk.features.GameplayAPI;
    if (!api) return;
    var want = K._gameplayWanted && !K._pausedByCore;
    if (want && !K._gameplayActive) { try { api.start(); } catch (e) {} K._gameplayActive = true; }
    else if (!want && K._gameplayActive) { try { api.stop(); } catch (e) {} K._gameplayActive = false; }
  };
  K.gameplayPauseChanged = function (paused) { K._pausedByCore = !!paused; K._syncGameplay(); };

  K.loadingReady = function () {
    try { if (K.ysdk && K.ysdk.features && K.ysdk.features.LoadingAPI) K.ysdk.features.LoadingAPI.ready(); } catch (e) {}
    K._loadingReady = true;
    K._syncGameplay();                                  // выпустить отложенный старт, если сцена просила
  };
  K.gameplayStart = function () { K._gameplayWanted = true; K._syncGameplay(); };
  K.gameplayStop = function () { K._gameplayWanted = false; K._syncGameplay(); };

  K.showInterstitial = function (onDone) {
    onDone = onDone || function () {};
    var now = Date.now();
    if (now - K._lastInterstitial < K.cooldownMs) { onDone(false, 'cooldown'); return; }
    if (!K.ysdk || !K.ysdk.adv || typeof K.ysdk.adv.showFullscreenAdv !== 'function') { onDone(false, 'no-sdk'); return; }
    K._lastInterstitial = now;
    K.inAd = true; K.pause('ad');
    var finished = false;
    function done(shown, err) {
      if (finished) return; finished = true;
      K.inAd = false; K.resume('ad');
      onDone(shown, err);
    }
    try {
      K.ysdk.adv.showFullscreenAdv({ callbacks: {
        // onOpen идемпотентен по ключу 'ad' и глушится после done() — поздний/дублирующий
        // onOpen (у некоторых SDK бывает) не сможет снова поставить паузу поверх закрытой рекламы.
        onOpen: function () { if (!finished) K.pause('ad'); },
        onClose: function (wasShown) { done(!!wasShown); },
        onError: function (err) { done(false, err); } // "too frequent" и сетевые сбои — игра продолжается
      } });
    } catch (e) { done(false, e); }
  };

  K.showRewarded = function (cbs) {
    cbs = cbs || {};
    var onReward = cbs.onReward || function () {};
    var onDone = cbs.onDone || function () {};
    if (!K.ysdk || !K.ysdk.adv || typeof K.ysdk.adv.showRewardedVideo !== 'function') { onDone(false, 'no-sdk'); return; }
    K.inAd = true; K.pause('ad');
    var rewarded = false, finished = false;
    function done(err) {
      if (finished) return; finished = true;
      K.inAd = false; K.resume('ad');
      if (rewarded && !err) { try { onReward(); } catch (e) {} }
      onDone(rewarded, err);
    }
    try {
      K.ysdk.adv.showRewardedVideo({ callbacks: {
        onOpen: function () { if (!finished) K.pause('ad'); }, // глушится после done() — см. showInterstitial
        onRewarded: function () { rewarded = true; },
        onClose: function () { done(); },
        onError: function (err) { done(err); } // награда НЕ выдаётся
      } });
    } catch (e) { done(e); }
  };

  K.showBanner = function () {
    // Capture-съёмка: баннер не резервирует место, если не запрошен явно через
    // ?banner=1 — иначе в скриншоте осталась бы пустая полоса под несуществующую
    // рекламу. Capture-режим включается ТОЛЬКО параметрами из белого списка
    // (см. engine/capture.js KNOWN): чужие query-параметры реального игрока
    // (?utm_source=..., ?payload=... deep-link платформы) capture-режим НЕ включают,
    // и баннер у игрока работает всегда.
    if (E.capture && E.capture.active && !E.capture.banner) return;
    if (!K.ysdk || !K.ysdk.adv || typeof K.ysdk.adv.showBannerAdv !== 'function') return;
    try {
      var r = K.ysdk.adv.showBannerAdv();
      if (r && r.then) r.then(function (st) {
        K.bannerVisible = !!(st && st.stickyAdvIsShowing);
        // высота, сообщённая платформой (stickyAdvIsShowing-объект может нести height)
        var hh = st && (st.height || st.advHeight || st.bannerHeight);
        K.bannerInset = K.bannerVisible ? (hh ? Math.max(0, Math.round(hh)) : fallbackInset()) : 0;
        relayout();
      }).catch(function () { K.bannerVisible = false; K.bannerInset = 0; relayout(); });
    } catch (e) {}
  };
  K.hideBanner = function () {
    var wasVisible = K.bannerVisible;
    K.bannerVisible = false; K.bannerInset = 0;
    if (wasVisible) relayout();
    if (!K.ysdk || !K.ysdk.adv || typeof K.ysdk.adv.hideBannerAdv !== 'function') return;
    try { var r = K.ysdk.adv.hideBannerAdv(); if (r && r.catch) r.catch(function () {}); } catch (e) {}
  };
  function relayout() {
    var g = K._game;
    if (g && g.scene && g.scene.onResize) { try { g.scene.onResize(g); } catch (e) {} }
  }
  E.sdk = K;
})(window.Engine);
