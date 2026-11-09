/* engine/platform/vk.js — адаптер VK Bridge (VK Игры / VK Play) под контракт Яндекс-ysdk.
   Экспортирует window.VKAdapter.makeYsdkLike(), который возвращает объект той же формы,
   что выдаёт YaGames.init(): { environment, features.{Loading,Gameplay}API, adv.{showFullscreenAdv,
   showRewardedVideo, showBannerAdv, hideBannerAdv}, getPlayer, getLeaderboards, getPayments,
   auth, on }. Диспетчер (engine/sdk.js) отдаёт его в storage.init и использует для рекламы.

   Маппинг VK Bridge → наш контракт:
     VKWebAppInit                 → init
     VKWebAppShowBannerAd/Hide    → стики-баннер (showBannerAdv/hideBannerAdv)
     VKWebAppShowNativeAds        → fullscreen interstitial (showFullscreenAdv)
     VKWebAppShowNativeAds(reward)→ rewarded video (showRewardedVideo) — формат задаётся в кабинете
     VKWebAppStorageGet/Set       → облачные сохранения (getPlayer().getData/setData)
     VKWebAppShowLeaderBoardBox   → лидерборды
     VKWebAppOpenPayForm          → платежи
   Язык берём из launch-параметров; события паузы приходят через vk-bridge subscribe. */
(function () {
  'use strict';

  function bridge() { return window.vkBridge; }

  function send(method, params) {
    var b = window.vkBridge;
    if (!b || typeof b.send !== 'function') return Promise.reject(new Error('no-vk-bridge'));
    try { return b.send(method, params || {}); } catch (e) { return Promise.reject(e); }
  }

  // launch params из URL (?vk_* / sign) — VK мини-апп всегда их прокидывает в iframe.
  function launchQuery() {
    try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; }
  }
  function detectLang() {
    var q = launchQuery();
    var l = q.get('language') || q.get('lang') || '';
    if (!l) { try { l = (navigator.language || 'en'); } catch (e) { l = 'en'; } }
    return /^ru/i.test(l) ? 'ru' : 'en';
  }

  function makeYsdkLike() {
    var handlers = {};
    var authorized = false;
    var userId = launchQuery().get('vk_user_id') || 'vk/guest';
    var bannerVisible = false;

    // Подписка на события bridge (пауза рекламы приходит отдельными событиями).
    var b = bridge();
    if (b && typeof b.subscribe === 'function') {
      try {
        b.subscribe(function (e) {
          var t = e && e.detail && e.detail.type;
          if (!t) return;
          if (handlers[t]) handlers[t]();
          // Нативная реклама VK шлёт pause/resume геймплея.
          if (t === 'VKWebAppShowNativeAdsResult') { if (handlers.__resume) handlers.__resume(); }
        });
      } catch (e) {}
    }

    var player = {
      isAuthorized: function () { return authorized; },
      getMode: function () { return authorized ? '' : 'lite'; },
      getName: function () { return 'VK User'; },
      getUniqueID: function () { return String(userId); },
      // Облачные KV VK: храним один JSON-конверт под ключом 'save' (как S.mergeCloud ждёт).
      getData: function (keys) {
        return send('VKWebAppStorageGet', { keys: (keys && keys.length ? keys : ['save']) }).then(function (r) {
          var out = {};
          var arr = (r && r.keys) || [];
          arr.forEach(function (kv) {
            if (kv && kv.key && kv.value) { try { out[kv.key] = JSON.parse(kv.value); } catch (e) { out[kv.key] = kv.value; } }
          });
          return out;
        }).catch(function () { return {}; });
      },
      setData: function (d, flush) {
        var jobs = [];
        Object.keys(d || {}).forEach(function (k) {
          var v = d[k];
          jobs.push(send('VKWebAppStorageSet', { key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
        });
        return Promise.all(jobs).then(function () {}).catch(function () {});
      },
      flush: function () { return Promise.resolve(); }
    };

    return {
      __isStub: false,
      __platform: 'vk',
      environment: { i18n: { lang: detectLang() }, app: { id: launchQuery().get('vk_app_id') || '' }, payload: null },
      deviceInfo: { type: 'desktop' },
      features: {
        LoadingAPI: { ready: function () { /* у VK нет аналога — no-op, но контракт сохранён */ } },
        GameplayAPI: { start: function () {}, stop: function () {} }
      },
      adv: {
        // fullscreen interstitial
        showFullscreenAdv: function (opts) {
          var c = (opts && opts.callbacks) || {};
          if (c.onOpen) c.onOpen();
          send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
            .then(function () { if (c.onClose) c.onClose(true); })
            .catch(function (e) { if (c.onError) c.onError(e); else if (c.onClose) c.onClose(false); });
        },
        // rewarded video (формат 'reward' включается в кабинете VK)
        showRewardedVideo: function (opts) {
          var c = (opts && opts.callbacks) || {};
          if (c.onOpen) c.onOpen();
          send('VKWebAppShowNativeAds', { ad_format: 'reward' })
            .then(function (r) {
              // VK шлёт результат; считаем просмотр завершённым по успешному resolve.
              if (c.onRewarded) c.onRewarded();
              if (c.onClose) c.onClose();
            })
            .catch(function (e) { if (c.onError) c.onError(e); else if (c.onClose) c.onClose(); });
        },
        // стики-баннер
        showBannerAdv: function () {
          return send('VKWebAppShowBannerAd', { banner_location: 'bottom' }).then(function (r) {
            bannerVisible = !!(r && r.result);
            return { reason: 'called', stickyAdvIsShowing: bannerVisible, height: bannerVisible ? 0 : 0 };
          }).catch(function () { bannerVisible = false; return { reason: 'error', stickyAdvIsShowing: false, height: 0 }; });
        },
        hideBannerAdv: function () {
          return send('VKWebAppHideBannerAd', {}).then(function (r) {
            bannerVisible = false;
            return { reason: 'called', stickyAdvIsShowing: false, height: 0 };
          }).catch(function () { return { reason: 'error', stickyAdvIsShowing: false, height: 0 }; });
        },
        getBannerAdvStatus: function () { return Promise.resolve({ reason: 'status', stickyAdvIsShowing: bannerVisible, height: 0 }); }
      },
      getPlayer: function () { return Promise.resolve(player); },
      getLeaderboards: function () {
        return Promise.resolve({
          setLeaderboardScore: function (name, score) {
            // у VK лидерборд = ShowLeaderBoardBox с результатом; set делается на бэке через secure-запрос.
            return send('VKWebAppShowLeaderBoardBox', { user_result: score }).then(function () {}).catch(function () {});
          },
          getLeaderboardEntries: function () { return Promise.resolve({ entries: [], userRank: 0 }); }
        });
      },
      getPayments: function () {
        return Promise.resolve({
          purchase: function (opts) {
            var id = opts && opts.id;
            // OpenPayForm: type=item, item=id — настраивается в кабинете.
            return send('VKWebAppOpenPayForm', { app_id: +launchQuery().get('vk_app_id') || 0, action: 'pay-to-service', params: { type: 'item', item: id } })
              .then(function () { return { purchaseToken: 'vk-' + Date.now() }; });
          },
          consumePurchase: function () { return Promise.resolve(); },
          getPurchases: function () { return Promise.resolve([]); }
        });
      },
      auth: {
        openAuthDialog: function () {
          // В VK мини-аппе пользователь уже авторизован платформой — диалога нет, просто флаг.
          authorized = true;
          return Promise.resolve();
        }
      },
      getStorage: function () { return Promise.resolve(window.localStorage); },
      on: function (evt, cb) { handlers[evt] = cb; return this; },
      dispatchEvent: function () { return Promise.resolve(); },
      isAvailableMethod: function () { return Promise.resolve(true); }
    };
  }

  // Инициализация bridge: VKWebAppInit обязателен до любых send().
  function init() {
    var b = bridge();
    if (!b) return Promise.reject(new Error('vk-bridge-not-loaded'));
    if (typeof b.send === 'function') {
      return send('VKWebAppInit').then(function () { return makeYsdkLike(); }).catch(function () { return makeYsdkLike(); });
    }
    return Promise.resolve(makeYsdkLike());
  }

  window.VKAdapter = { init: init, makeYsdkLike: makeYsdkLike };
})();
