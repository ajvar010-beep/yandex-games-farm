/* engine/storage.js — облачные сохранения player.setData/getData с фолбэком в localStorage.
   Гостевой режим обязателен и работает без авторизации; авторизация Яндекс ID — только
   по явной кнопке (storage.authorize()). Каждое изменение сразу пишется локально,
   в облако — с дебаунсом 800 мс (setData(..., false) ставит в очередь SDK).
   flush(true) используется при EXIT/закрытии — setData(..., true) уходит на сервер сразу.
   Критично: облачная запись ВСЕГДА несёт полный объект { save: S.data, savedAt: N } —
   иначе setData мержит только верхний уровень ключей и стирает savedAt в облаке,
   из-за чего слияние «кто свежее» на следующем устройстве теряет прогресс. */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var S = { data: {}, player: null, ns: 'game', _saveTimer: 0, authorized: false };

  function readLocal(ns) {
    try {
      var raw = localStorage.getItem(ns + ':save');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function writeLocal(ns, data) {
    try { localStorage.setItem(ns + ':save', JSON.stringify(data)); } catch (e) {}
  }

  S.init = function (ysdk, ns) {
    S.ns = ns || 'game';
    S.data = readLocal(S.ns);
    if (!ysdk || typeof ysdk.getPlayer !== 'function') return Promise.resolve(S.data);
    return ysdk.getPlayer({ scopes: false }).then(function (p) {
      S.player = p;
      try { S.authorized = (typeof p.isAuthorized === 'function') ? !!p.isAuthorized() : false; } catch (e) {}
      return p.getData(['save']);
    }).then(function (d) {
      S.data = S.mergeCloud(d);
      return S.data;
    }).catch(function () { /* гость/офлайн — работаем на localStorage */ return S.data; });
  };
  /* mergeCloud: облачная запись — конверт { save: {...}, savedAt: N } (или legacy:
     просто объект save). Слияние «кто свежее» по savedAt; побеждает целый объект,
     чтобы локальный пустой слот не затирал облачный прогресс (и наоборот). */
  S.mergeCloud = function (raw) {
    var cloud, ct;
    if (raw && raw.save && typeof raw.save === 'object') { cloud = raw.save; ct = raw.savedAt || cloud.savedAt || 0; }
    else { cloud = (raw && typeof raw === 'object') ? raw : {}; ct = cloud.savedAt || 0; }
    var lt = S.data.savedAt || 0;
    S.data = (ct > lt) ? Object.assign({}, S.data, cloud) : Object.assign({}, cloud, S.data);
    writeLocal(S.ns, S.data);
    return S.data;
  };

  S.get = function (key, def) { return (key in S.data) ? S.data[key] : def; };
  S.set = function (key, val, immediate) {
    S.data[key] = val;
    S.data.savedAt = Date.now();
    writeLocal(S.ns, S.data);
    if (immediate) { S.flush(false); return; }
    if (S._saveTimer) clearTimeout(S._saveTimer);
    S._saveTimer = setTimeout(function () { S.flush(false); }, 800);
  };
  /* flushNow=true — вызов при EXIT/закрытии страницы: setData(data, true) шлёт на сервер
     немедленно (по доке Яндекса flush=true). При обычном дебаунсе — false (очередь SDK),
     чтобы не упереться в rate-limit 100 зап./5 мин. */
  S.flush = function (flushNow) {
    if (S._saveTimer) { clearTimeout(S._saveTimer); S._saveTimer = 0; }
    writeLocal(S.ns, S.data);
    if (S.player && typeof S.player.setData === 'function') {
      try {
        // конверт: setData мержит только верхний уровень, поэтому savedAt кладём
        // рядом с save — иначе он терялся бы в облаке и слияние «кто свежее» ломалось
        var r = S.player.setData({ save: S.data, savedAt: S.data.savedAt || 0 }, !!flushNow);
        if (r && r.catch) r.catch(function () {});
      } catch (e) {}
    }
  };
  /* authorize() — только по явной кнопке. КЛЮЧЕВОЕ: после смены игрока (гость -> Яндекс ID)
     облачные данные НОВОГО игрока перечитываются и мержатся по savedAt ДО записи, поэтому
     локальный пустой слот больше не затирает облачный прогресс. Если пользователь ОТМЕНИЛ
     диалог (isAuthorized() === false) — authorized остаётся false, кнопка входа не прячется. */
  S.authorize = function () {
    var y = E.sdk && E.sdk.ysdk;
    if (!y || !y.auth || typeof y.auth.openAuthDialog !== 'function') return Promise.resolve(false);
    var onReload = S.onReload || null;
    return y.auth.openAuthDialog().then(function () {
      return y.getPlayer({ scopes: false });
    }).then(function (p) {
      var ok = false;
      try { ok = (typeof p.isAuthorized === 'function') ? !!p.isAuthorized() : false; } catch (e) {}
      if (!ok) return false;                    // отмена диалога — ничего не меняем
      S.player = p; S.authorized = true;
      return p.getData(['save']).then(function (d) {
        S.mergeCloud(d);                         // подтянуть облачный прогресс нового игрока
        S.flush(true);                           // и только теперь писать на сервер
        if (onReload) { try { onReload(S.data); } catch (e) {} }
        return true;
      });
    }).catch(function () { return false; });
  };
  E.storage = S;
})(window.Engine);
