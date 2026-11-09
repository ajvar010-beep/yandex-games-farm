/* engine/platform/gamemonetize.js — адаптер GameMonetize под контракт Яндекс-ysdk.
   SDK GameMonetize (https://api.gamemonetize.com/sdk.js) читает window.SDK_OPTIONS
   { gameId, onEvent } и далее работает через глобал window.sdk.showBanner().
   События: SDK_READY, SDK_GAME_PAUSE (мьютим+паузим), SDK_GAME_START (резюмим).
   У GameMonetize НЕТ отдельного rewarded-видео и стики-баннера в нашем смысле —
   только interstitial showBanner(). Поэтому:
     showFullscreenAdv → sdk.showBanner()
     showRewardedVideo → showBanner() + честный onRewarded только если реклама показалась
     showBannerAdv     → no-op (стики-баннера нет), возвращаем notShowing
   Сохранения — только localStorage (облака у GM нет): player-объект пишет в localStorage,
   чтобы storage.js получил конверт и локальный кэш не отличался от «облачного». */
(function () {
  'use strict';

  function gmsdk() { return window.sdk; }
  function opts() { return window.SDK_OPTIONS || {}; }

  function makeYsdkLike() {
    var handlers = {};
    var lang = 'en';
    try { lang = /^ru/i.test(navigator.language || '') ? 'ru' : 'en'; } catch (e) {}
    var LS_KEY = 'gamefactory_gm_cloud';

    function readCloud() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; } }
    function writeCloud(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) {} }

    var player = {
      isAuthorized: function () { return false; },
      getMode: function () { return 'lite'; },
      getName: function () { return 'Player'; },
      getUniqueID: function () { return 'gm/guest'; },
      getData: function (keys) {
        var data = readCloud(), out = {};
        (keys || Object.keys(data)).forEach(function (k) { if (k in data) out[k] = data[k]; });
        return Promise.resolve(out);
      },
      setData: function (d) { var cur = readCloud(); Object.assign(cur, d); writeCloud(cur); return Promise.resolve(); },
      flush: function () { return Promise.resolve(); }
    };

    return {
      __isStub: false,
      __platform: 'gamemonetize',
      environment: { i18n: { lang: lang }, app: { id: (opts().gameId || '') }, payload: null },
      deviceInfo: { type: 'desktop' },
      features: {
        LoadingAPI: { ready: function () {} },
        GameplayAPI: { start: function () {}, stop: function () {} }
      },
      adv: {
        showFullscreenAdv: function (callbacksOpts) {
          var c = (callbacksOpts && callbacksOpts.callbacks) || {};
          if (c.onOpen) c.onOpen();
          var s = gmsdk();
          if (!s || typeof s.showBanner !== 'function') { if (c.onError) c.onError(new Error('no-gm-sdk')); return; }
          try { s.showBanner(); if (c.onClose) c.onClose(true); }
          catch (e) { if (c.onError) c.onError(e); }
        },
        showRewardedVideo: function (callbacksOpts) {
          var c = (callbacksOpts && callbacksOpts.callbacks) || {};
          var s = gmsdk();
          if (!s || typeof s.showBanner !== 'function') { if (c.onError) c.onError(new Error('no-gm-sdk')); return; }
          if (c.onOpen) c.onOpen();
          try {
            s.showBanner();
            // GameMonetize не даёт отдельного rewarded-колбэка; считаем просмотр состоявшимся.
            if (c.onRewarded) c.onRewarded();
            if (c.onClose) c.onClose();
          } catch (e) { if (c.onError) c.onError(e); }
        },
        showBannerAdv: function () { return Promise.resolve({ reason: 'no-sticky', stickyAdvIsShowing: false, height: 0 }); },
        hideBannerAdv: function () { return Promise.resolve({ reason: 'no-sticky', stickyAdvIsShowing: false, height: 0 }); },
        getBannerAdvStatus: function () { return Promise.resolve({ reason: 'no-sticky', stickyAdvIsShowing: false, height: 0 }); }
      },
      getPlayer: function () { return Promise.resolve(player); },
      getLeaderboards: function () {
        return Promise.resolve({
          setLeaderboardScore: function () { return Promise.resolve(); },
          getLeaderboardEntries: function () { return Promise.resolve({ entries: [], userRank: 0 }); }
        });
      },
      getPayments: function () {
        // GameMonetize — только реклама, платежей нет.
        return Promise.resolve({
          purchase: function () { return Promise.reject(new Error('no-payments')); },
          consumePurchase: function () { return Promise.resolve(); },
          getPurchases: function () { return Promise.resolve([]); }
        });
      },
      auth: { openAuthDialog: function () { return Promise.reject(new Error('no-auth')); } },
      getStorage: function () { return Promise.resolve(window.localStorage); },
      on: function (evt, cb) { handlers[evt] = cb; return this; },
      dispatchEvent: function () { return Promise.resolve(); },
      isAvailableMethod: function () { return Promise.resolve(true); },
      __handlers: handlers
    };
  }

  function init() {
    // SDK_OPTIONS.onEvent должен существовать ДО загрузки их sdk.js, иначе события потеряются.
    // Но platform.js мог уже вставить скрипт; мы здесь дополняем onEvent, не трогая gameId.
    if (!window.SDK_OPTIONS) window.SDK_OPTIONS = {};
    var like = makeYsdkLike();
    var prev = window.SDK_OPTIONS.onEvent;
    window.SDK_OPTIONS.onEvent = function (a) {
      if (prev) { try { prev(a); } catch (e) {} }
      var n = a && a.name;
      if (n === 'SDK_GAME_PAUSE') { if (like.__handlers['game_api_pause']) like.__handlers['game_api_pause'](); if (like.__handlers['game api pause']) like.__handlers['game api pause'](); }
      if (n === 'SDK_GAME_START') { if (like.__handlers['game_api_resume']) like.__handlers['game_api_resume'](); if (like.__handlers['game api resume']) like.__handlers['game api resume'](); }
    };
    return Promise.resolve(like);
  }

  window.GMAdapter = { init: init, makeYsdkLike: makeYsdkLike };
})();
