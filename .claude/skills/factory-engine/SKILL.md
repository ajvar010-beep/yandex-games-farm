---
name: factory-engine
description: Контракт HTML5-движка фабрики (window.Engine) — модули sdk/capture/storage/input/core/i18n/ui/fx/audio/rng, capture-хуки для скриншотов и видео, единый кошелёк, порядок подключения скриптов. Использовать при написании или правке game/*.js, подключении рекламы и сохранений, починке «не работает тап», «не показывается баннер», «не собираются скриншоты».
---

# Движок фабрики (`window.Engine`)

Один движок на все HTML5-игры. В каждой игре это `engine/` — **копия 1:1** из последней
рабочей игры (`games/parkingescape`). Правка `engine/core.js` или `engine/sdk.js` запрещена:
чинится эталон, потом копия распространяется по остальным. Пишутся только `index.html` и
`game/*.js`.

## Модули

| Модуль | Зачем | Ключевое |
|---|---|---|
| `E.core` | цикл, сцены, фикс-шаг | edge-флаги ввода гасятся только после реального update |
| `E.input` | тач/мышь/клавиши | один и тот же путь для мыши и пальца |
| `E.sdk` | платформа | `init`, `loadingReady`, `gameplayStart/Stop`, `pause`, `onPause/onResume` |
| `E.sdk` реклама | баннер, interstitial, RV | `showBanner/hideBanner`, `showInterstitial(cb)`, `showRewarded(onReward, cb)` |
| `E.sdk` платежи | IAP | `initPayments`, `purchase`, `getPurchases` |
| `E.storage` | сохранения | `get/set/flush`, `mergeCloud`; **один кошелёк** `coins` |
| `E.capture` | скриншоты/видео | белый список query-параметров, `markReady` |
| `E.i` | i18n | только ключи из `game/i18n.js`, мёртвых ключей быть не должно |
| `E.ui` | кнопки/зоны | хитбоксы ≥44pt, состояния нажатия |
| `E.fx`, `E.audio`, `E.rng` | эффекты, звук, генератор | rng — функция, не метод: используется в промо-арте |

## Порядок подключения (ломается чаще, чем кажется)

```html
<script>/* sdk.js с платформы только на http(s) */</script>
<script src="sdk-stub.js"></script>
<script src="engine/rng.js"></script>  <script src="engine/i18n.js"></script>
<script src="engine/audio.js"></script><script src="engine/input.js"></script>
<script src="engine/ui.js"></script>   <script src="engine/fx.js"></script>
<script src="engine/storage.js"></script><script src="engine/sdk.js"></script>
<script src="engine/core.js"></script> <script src="engine/capture.js"></script>
<script src="game/config.js"></script><script src="game/i18n.js"></script>
<script src="game/logic.js"></script>  <script src="game/art.js"></script>
<script src="game/scenes.js"></script><script src="game/main.js"></script>
```

`E.capture.init(game)` — до первого кадра; `E.sdk.loadingReady()` — после готовности меню.

## Capture-контракт

`window.__capture` + белый список параметров: `seed, scene, wave, score, coins, mode, t,
freeze, manual, autoplay, record, lang, mute, banner`. Всё остальное (`utm_*`, `payload`,
`fbclid`) игнорируется и **не** включает capture-режим. `lang` и `mute` не считаются
сильными — иначе у живого игрока с расшаренной ссылки пропадут баннер и туториал.

Правила:
- `scene=menu|play`, `lang=ru|en`, `record` 0..28, флаги — только `'1'`, иное молча игнор.
- `freeze` + `manual` дают детерминированный кадр для скриншота: шаг игры не идёт сам.
- `record` включает MediaRecorder и отдаёт blob через `E.capture` — так собирается видео.
- Детерминизм: при `seed` никакого `Math.random()` в логике, только `E.rng`.

## Правила, добытые болью

1. **Один кошелёк.** Только `storage['coins']`. Отдельные `menuCoins`/`runCoins` → покупки и
   RV-награды не доходят до забега. Расход и начисление — через один хелпер.
2. **Ввод на 120–144 Гц.** Edge-флаг (`justPressed`) сбрасывается только после обработки в
   update, иначе половина тапов теряется на высоких герцовках.
3. **`no_ads`** гасит и баннер, и interstitial. Проверять оба, не одну кнопку.
4. **HUD — четыре независимые зоны:** левая (уровень/ходы), панель цели, правая (монеты/очки),
   кнопка паузы. Не пересекаются на 360 и 720 px; баннер снизу — через `bannerInsetPx()`.
5. **Пауза всегда имеет выход.** `E.sdk.onPause` ставит причину (`ad`, `exit`, `blur`);
   resume снимает. Экран паузы без кнопки «продолжить» = кирпич, `release-check` это ловит.
6. **Ошибки в консоли — красный гейт.** Каждый capture-скрипт и `audit` слушают console.error.
7. **Офлайн.** `sdk-stub.js` на `file://` ведёт себя как SDK: те же колбэки, награда выдаётся.

## Мини-каркас `game/main.js`

```js
var E = window.Engine;
var G = window.GAME;                      // состояние конкретной игры
E.capture.init(G);
E.storage.init().then(function () { ... }); // миграции и облачный merge
E.sdk.init().then(function () { E.sdk.loadingReady(); });
// цикл: E.core.start({ update: function (dt) {...}, render: function (ctx) {...} });
```

Состояние — плоский объект; сцены — функции `enter/update/render/exit`. Никаких глобальных
переменных кроме `G` и `E` (в `config.js` — только `window.GAME` и `G.config`).
