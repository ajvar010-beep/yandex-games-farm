/* engine/platform.js — детект платформы по домену и инжект её SDK ДО движка.
   Грузится ПЕРВЫМ среди engine-скриптов (см. index.html), синхронно вставляет <script>
   платформенного SDK через document.write, чтобы window.YaGames / window.vkBridge /
   window.sdk уже существовали к моменту исполнения engine/sdk.js и main.js.
   Детект:
     - yandex.ru/.net/.by/...      → /sdk.js  (Яндекс Игры, обслуживается платформой)
     - vk.com / vkplay.ru / *.userapi.com → VK Bridge (jsdelivr CDN)
     - gamemonetize.com и сеть      → https://api.gamemonetize.com/sdk.js (нужен SDK_OPTIONS.gameId)
     - localhost / file: / прочее   → ничего; работает общий sdk-stub.js
   Порядок важен: platform.js ДО sdk-stub.js — иначе стаб создаст YaGames-заглушку,
   и диспетчер примет её за реальный Яндекс. */
(function () {
  'use strict';
  var host = '';
  try { host = (location.hostname || '').toLowerCase(); } catch (e) { return; }

  var proto = '';
  try { proto = location.protocol; } catch (e) {}
  if (proto === 'file:' || proto === 'about:' || proto === 'data:') return; // локальная съёмка/отладка — только стаб

  function inject(src, id) {
    // document.write сохраняет порядок исполнения относительно engine-скриптов,
    // гарантируя, что глобал SDK появится до sdk.js. id защищает от двойной вставки.
    if (id && document.getElementById(id)) return;
    document.write('<script src="' + src + '"' + (id ? ' id="' + id + '"' : '') + '><\/script>');
  }

  window.Engine = window.Engine || {};
  var P = { name: 'standalone' };

  if (/(\.|^)yandex\.(ru|net|by|kz|com(\.tr)?)$/.test(host) || /(\.|^)yastatic\.net$/.test(host)) {
    P.name = 'yandex';
    inject('/sdk.js');
  } else if (/(\.|^)(vk\.com|vkplay\.(ru|com)|userapi\.com|vkuserlive\.net)$/.test(host)) {
    P.name = 'vk';
    inject('https://cdn.jsdelivr.net/npm/@vkontakte/vk-bridge@2/dist/browser.min.js', 'vk-bridge-sdk');
  } else if (/(\.|^)gamemonetize\.(com|net)$/.test(host) || (window.SDK_OPTIONS && window.SDK_OPTIONS.gameId)) {
    // gamemonetize также активируется, если издатель заранее выставил window.SDK_OPTIONS.gameId
    // (игра встроена на сайте-партнёре сети, домен не gamemonetize.com).
    P.name = 'gamemonetize';
    inject('https://api.gamemonetize.com/sdk.js', 'gamemonetize-sdk');
  } else {
    P.name = 'standalone'; // прямая ссылка/iframe на неизвестном домене — стаб всё равно даст игру
  }

  P.is = function (n) { return P.name === n; };
  window.Engine.platform = P;
})();
