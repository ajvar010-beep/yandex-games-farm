/* sdk-stub.js — standalone-заглушка SDK Яндекс Игр.
   На платформе реальный /sdk.js уже создал window.YaGames — заглушка ничего не делает.
   Локально обеспечивает полную работоспособность игры: реклама "показывается" мгновенно,
   сохранения пишутся в localStorage. Только console.warn (допустимо в standalone).
   Стики-баннер: заглушка ЧЕСТНО сообщает stickyAdvIsShowing=true + правдоподобные
   height И width — ветка «контент выше баннера» исполняется и проверяется локально
   и на съёмке (?banner=1), а не живёт мёртвым кодом. */
(function () {
  'use strict';
  if (window.YaGames && typeof window.YaGames.init === 'function') return;

  var STORAGE_KEY = 'gamefactory_stub_cloud';

  function readCloud() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function writeCloud(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  function makePlayer(authorized) {
    var data = readCloud();
    return {
      isAuthorized: function () { return authorized; },
      getMode: function () { return authorized ? '' : 'lite'; },
      getName: function () { return 'Guest'; },
      getUniqueID: function () { return 'stub/guest'; },
      getData: function (keys) {
        var out = {};
        (keys || Object.keys(data)).forEach(function (k) { if (k in data) out[k] = data[k]; });
        return Promise.resolve(out);
      },
      setData: function (d, flush) {
        data = Object.assign({}, data, d); writeCloud(data);
        return Promise.resolve();
      },
      flush: function () { return Promise.resolve(); }
    };
  }

  function makeYsdk() {
    var handlers = {};
    var lang = 'en';
    try { lang = (navigator.language || 'en').slice(0, 2).toLowerCase(); } catch (e) {}
    var authorized = false; // openAuthDialog включает её — так authorize() проверяем локально
    var sticky = false, stickyH = 0, stickyW = 0;
    function heightFor() {
      // правдоподобная высота стики-баннера: ~10% высоты экрана, 46..120 px
      var h = 0; try { h = window.innerHeight || 0; } catch (e) {}
      return Math.max(46, Math.min(120, Math.round(Math.max(h, 300) * 0.1)));
    }
    function widthFor() {
      // правдоподобная ширина стики-баннера: полоса во всю ширину вьюпорта
      // (не уже 320 CSS px, не шире экрана)
      var w = 0; try { w = window.innerWidth || 0; } catch (e) {}
      return Math.max(320, Math.min(Math.max(w, 320), 2560));
    }
    function status() {
      return { reason: 'called', stickyAdvIsShowing: sticky,
               height: sticky ? stickyH : 0, width: sticky ? stickyW : 0 };
    }
    return {
      __isStub: true,
      environment: { i18n: { lang: lang }, app: { id: 'stub' }, payload: null },
      deviceInfo: { type: 'desktop' },
      features: {
        LoadingAPI: { ready: function () { console.warn('[sdk-stub] LoadingAPI.ready()'); } },
        GameplayAPI: {
          start: function () { console.warn('[sdk-stub] GameplayAPI.start()'); },
          stop: function () { console.warn('[sdk-stub] GameplayAPI.stop()'); }
        }
      },
      adv: {
        showFullscreenAdv: function (opts) {
          console.warn('[sdk-stub] fullscreen adv shown instantly');
          var c = (opts && opts.callbacks) || {};
          if (c.onOpen) c.onOpen();
          setTimeout(function () { if (c.onClose) c.onClose(true); }, 50);
        },
        showRewardedVideo: function (opts) {
          console.warn('[sdk-stub] rewarded video shown instantly, reward granted');
          var c = (opts && opts.callbacks) || {};
          if (c.onOpen) c.onOpen();
          setTimeout(function () { if (c.onRewarded) c.onRewarded(); if (c.onClose) c.onClose(); }, 50);
        },
        showBannerAdv: function () {
          sticky = true; stickyH = heightFor(); stickyW = widthFor();
          console.warn('[sdk-stub] banner shown, height ' + stickyH);
          return Promise.resolve(status());
        },
        hideBannerAdv: function () {
          sticky = false; stickyH = 0; stickyW = 0;
          return Promise.resolve(status());
        },
        getBannerAdvStatus: function () { return Promise.resolve(status()); }
      },
      getPlayer: function () { console.warn('[sdk-stub] getPlayer'); return Promise.resolve(makePlayer(authorized)); },
      auth: {
        openAuthDialog: function () { authorized = true; console.warn('[sdk-stub] openAuthDialog -> authorized'); return Promise.resolve(); }
      },
      getStorage: function () { return Promise.resolve(window.localStorage); },
      on: function (evt, cb) { handlers[evt] = cb; return this; },
      dispatchEvent: function () { return Promise.resolve(); },
      isAvailableMethod: function () { return Promise.resolve(true); },
      __fire: function (evt) { if (handlers[evt]) handlers[evt](); }
    };
  }

  window.YaGames = { init: function () { console.warn('[sdk-stub] YaGames.init (standalone mode)'); return Promise.resolve(makeYsdk()); } };
})();
