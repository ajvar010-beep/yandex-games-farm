/* game/main.js — boot-последовательность «Старфолла». Порядок строгий:
   capture.init (парсит URL по белому списку) -> sdk.init -> storage.init -> i18n
   -> art.init -> scenes -> game.start -> LoadingAPI.ready (1.19.2) -> __capture.ready.
   Язык: URL ?lang > сохранённый > ysdk.environment.i18n.lang (2.14). */
(function () {
  'use strict';
  var E = window.Engine, G = window.GAME;

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
      G.art.init();

      game.addScene('menu', G.scenes.menu);
      game.addScene('play', G.scenes.play);

      E.sdk.onPause(function (why) { game.pause(why || 'sdk'); });
      E.sdk.onResume(function (why) { game.resume(why || 'sdk'); });

      var scene = (cap.scene === 'play' || cap.autoplay || cap.record > 0) ? 'play' : 'menu';
      game.setScene(scene, { seed: cap.seed });
      game.start();

      var b = document.getElementById('boot');
      if (b && b.parentNode) b.parentNode.removeChild(b);

      E.sdk.loadingReady();
      E.capture.markReady();
      if (cap.record > 0) E.capture.maybeStartRecording();
    }).catch(function (err) {
      try { console.warn('boot fallback:', err); } catch (e) {}
      try {
        E.i18n.init(G.i18n, 'en');
        G.art.init();
        game.addScene('menu', G.scenes.menu);
        game.addScene('play', G.scenes.play);
        game.setScene('menu', {});
        game.start();
        var b = document.getElementById('boot');
        if (b && b.parentNode) b.parentNode.removeChild(b);
        E.capture.markReady();
      } catch (e2) {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
