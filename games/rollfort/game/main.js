/* game/main.js — boot-последовательность «Крепости на Колёсах». */
(function () {
  'use strict';
  var E = window.Engine, G = window.GAME;

  function startScenes(game, cap) {
    var cp = cap.params || {};
    game.addScene('menu', G.scenes.menu);
    game.addScene('map', G.scenes.map);
    game.addScene('play', G.scenes.battle);

    E.sdk.onPause(function (why) { game.pause(why || 'sdk'); });
    E.sdk.onResume(function (why) { game.resume(why || 'sdk'); });

    var scene = (cap.scene === 'play' || cap.autoplay || cap.record > 0) ? 'play' : 'menu';
    game.setScene(scene, { chapter: cp.wave });
    game.start();

    var b = document.getElementById('boot');
    if (b && b.parentNode) b.parentNode.removeChild(b);

    E.sdk.loadingReady();
    E.capture.markReady();
    if (cap.record > 0) setTimeout(function () { E.capture.maybeStartRecording(); }, 700);
  }

  function boot() {
    var canvas = document.getElementById('game');
    var game = new E.core.Game({ canvas: canvas, bgColor: G.config.palette.bg });
    E.sdk._game = game;
    E.input.attach(canvas);
    E.capture.init(game);
    var cap = E.capture;

    E.sdk.init().then(function () {
      return E.storage.init(E.sdk.ysdk, G.id);
    }).then(function () {
      var savedLang = E.storage.get('lang', null);
      var lang = cap.lang || savedLang || E.sdk.lang || 'en';
      E.i18n.init(G.i18n, lang);
      document.title = E.i18n.t('title');
      E.audio.setMuted(E.storage.get('muted', false) || cap.mute);
      startScenes(game, cap);
    }).catch(function (err) {
      // офлайн/гость: те же сцены на языке по умолчанию
      try {
        E.i18n.init(G.i18n, cap.lang || 'en');
        E.audio.setMuted(cap.mute);
        startScenes(game, cap);
      } catch (e) {
        try { console.warn('boot fallback failed:', err, e); } catch (e2) {}
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
