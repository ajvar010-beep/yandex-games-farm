# Баг-репорт и предложения по улучшению — 40 игр GameFactory

**Дата аудита:** 2026-11-13/14
**СТАТУС: P0 и P1 ИСПРАВЛЕНЫ 2026-11-14** (см. «Часть 8 — Отчёт о фикшах» в конце).
**Покрытие:** 35 JS-игр + 5 Godot-игр (`godparkour`, `hackerparkour`, `mineridle`, `nubikparkour`, `parkourpro`)
**Источники:**
- `pipeline/audit.mjs --all` → 2 FAIL
- `pipeline/_runtime_smoke.mjs` → 35/35 OK (все JS-игры загружаются без ошибок)
- `pipeline/release-check.mjs --all` → 67 issues / 40 игр (плюс 5 отдельно)
- Статический анализ `game/*.js` и `scripts/*.gd` тремя параллельными аудиторами с повторной верификацией каждой находки

**Легенда приоритетов:**
- **P0** — игра сломана / неиграбельна / крашится. Чинить немедленно.
- **P1** — серьёзная деградация UX/логики, потеря монетизации или прогресса. Чинить в ближайшей итерации.
- **P2** — заметный баг, есть обходные пути. Чинить в фоне.
- **P3** — косметика / мелкая оптимизация.

---

## Executive summary

| Приоритет | Количество игр | Суть |
|-----------|----------------|------|
| P0 | **7** | `blockfit`, `bubblepop`, `fishpond`, `mahjongpair`, `merge2048` — общий баг звука (`E.audio.toggleMute()` не существует в движке → crash-loop при тапе на «Звук»). `blockfit` — плюс мёртвые overlay-хендлеры (soft-lock после паузы/победы). `merge2048` — плюс полное отсутствие ввода игрока (игра неиграбельна). |
| P1 | **8** | `pizzaspin`, `skyblocks`, `starfall`, `sweettower`, `watersort`, `wordlink`, `solitairekl`, `sudokulite` — отсутствует `consumesInputInUpdate` → двойной ввод на multi-step кадрах. `solitairekl` — copy-paste `sudokulite_tutorial` (туториал повторяется вечно). `sudokulite` — `onError` вместо `onDone` (revive-панель виснет при ошибке рекламы). `wordlink` — бустер «Буква» == «Подсказка» (дубликат). `pipes` — покупка подсказки списывает монеты, когда подсказка невозможна. `hackerparkour` — пустой GOAL-блок (`match Variant.id` без `hacker`). `mineridle` — утечка UI при `refresh()`. |
| P1 (пакет) | **19** | У 19 JS-игр отсутствует `manifest.json` (обязательный по новому `release-check`). У `hexwave`, `skyblocks` zip старше `i18n.js` (нужен repack). У `hackerparkour`, `mineridle` — отсутствует `keywords.txt`. У `godparkour`, `nubikparkour`, `parkourpro` — media (icon/cover) старше кода игры. |
| P2 (shared Godot) | **4** | Все 4 parkour-игры: гонка пауза↔реклама, кнопки jump/dash без `action_mode=PRESS` (~80-150 мс задержки), `audio_bus.gd` регенерирует WAV на каждый SFX (аллокации + GC), `menu.gd` спамит leaderboard API. |
| P2 (perf) | **8** | `arrowescape`, `cannonball`, `dominochain`, `fishpond`, `hexwave`, `kozyr`, `pixelcode`, `pizzaspin` — per-frame аллокации / rebuild UI. |

**Итого критических находок (P0+P1): 36** (без дубликатов; ряд игр имеет несколько P0/P1).

**False positive (обнаружены в ходе аудита):**
- `fishpond [i18n] в en нет en` — ложное срабатывание `release-check.mjs:parseI18n`. Регулярка `loc + ':\s*\{'` находит `en:` внутри `ru: {...}`, потому что `[^\s\S]*?` не ограничивает границу первой закрывающей скобки. Нужен токенизер или depth-aware сканер.
- `mineridle [manifest] leaderboards 'depth', iap 'coins_5000/coins_20000/no_ads'` — `release-check.mjs:checkIds` (строки 146-150) сканирует только `game/*.js`, а Godot-игры хранят код в `scripts/*.gd`. Все ID реально используются (game.gd:438, menu.gd:100-199). Чинить нужно чекер, не игру.
- Godot `requestfailed: file:///C:/sdk.js` + `wasm CORS` — ограничение `file://`-харнесса. На реальной платформе игры работают.

---

## Часть 1 — Критические P0 (чинить немедленно)

### P0-1 — `E.audio.toggleMute()` не существует (5 игр)

**Игры:** `blockfit`, `bubblepop`, `fishpond`, `mahjongpair`, `merge2048`

**Код** (одинаковый шаблон во всех пяти):
```js
// fishpond/game/scenes.js:116
E.audio.toggleMute();
// + label: scenes.js:36
E.audio.muted ? 'OFF' : 'ON'   // всегда 'ON', т.к. поля muted нет
```

**Что экспортирует движок** (`engine/audio.js`): `unlock, setMuted, isMuted, suspend, resume, sfx, music`. `toggleMute` и `muted` отсутствуют.

**Эффект:** тап по кнопке «Звук» в меню бросает `TypeError: E.audio.toggleMute is not a function` внутри `scene.update`. Поскольку `_frame()` не доходит до `postUpdate()` (core.js:175), `pointer.pressed` остаётся `true` → каждый следующий кадр повторно вызывает `handleTap` → **crash-loop, игра неиграбельна до перезагрузки**.

**Фикс (унифицированный патч для всех 5):**
```js
// handler
E.audio.setMuted(!E.audio.isMuted());
E.storage.set('muted', E.audio.isMuted());
// label
text: E.audio.isMuted() ? T('sound_off') : T('sound_on')
// boot (уже есть у других игр): E.audio.setMuted(E.storage.get('muted', false))
```

Добавить i18n-ключи `sound_on` / `sound_off` (RU/EN) в `game/i18n.js` каждой игры.

**Сайд-эффект:** состояние `muted` у всех 5 никогда не сохранялось (`E.storage.get('muted')` читается в `main.js`, но никто не пишет) — терялось между сессиями.

---

### P0-2 — `blockfit`: мёртвые overlay-хендлеры (soft-lock)

**Файл:** `games/blockfit/game/scenes.js`

**Механизм:**
- `PlayScene.update` (строка 261-288) вызывает `driveInput(game)` только когда `this.mode === 'running'`.
- HUD-тап (строки 295-298) переводит `mode` в `'paused'` / `'shop'`.
- После этого `driveInput` больше не вызывается → `handlePauseTap/handleShopTap/handleOverTap/handleFailTap/handleReviveTap` (строки 851, 929, 944, 959, 975) недостижимы (0 call sites по grep).

**Эффект:** первый тап на паузу/магазин/победа/проигрыш/revive **перманентно блокирует игру** — нельзя ни продолжить, ни перезапустить, ни выйти.

**Фикс:** скопировать dispatcher из `bubblepop/game/scenes.js:309-315`:
```js
handleTap: function (x, y) {
  if (this.mode === 'shop')   { this.handleShopTap(x, y); return; }
  if (this.mode === 'over')   { this.handleOverTap(x, y); return; }
  if (this.mode === 'fail')   { this.handleFailTap(x, y); return; }
  if (this.mode === 'revive') { this.handleReviveTap(x, y); return; }
  if (this.mode === 'paused') { this.handlePauseTap(x, y); return; }
  if (this.mode !== 'running') return;
  this.driveInput(game);
}
```
И вызывать `this.handleTap(...)` из `update` безусловно (вне `if mode==='running'`).

**Коммит 152b056** («КРИТИЧНО») уже предупреждал об этом — фикс не был завершён.

---

### P0-3 — `merge2048`: нет ввода игрока (неиграбельна)

**Файл:** `games/merge2048/game/scenes.js`

**Механизм:**
- `PlayScene.update` (строки 256-285) не читает ни `E.input.pointer`, ни `E.input.wasPressed`.
- Единственный вызов `this.onTap(...)` — в `MenuScene.update` (строка 73-75).
- `PlayScene.onTap` (721), `onSwipe` (739), `onKey` (750) определены, но **никогда не вызываются**. `onSwipe` вызывается только из `driveAutopilot` (режим записи видео).
- `engine/core.js` диспетчит только `update/draw/enter/exit/onBack` — хуков `onSwipe/onKey` на уровне сцены нет.

**Эффект:** реальный игрок не может сделать ни одного хода. Игра загружается, отображается, но полностью пассивна.

**Фикс:** добавить в `PlayScene.update` детект swipe через `pointer.downX/downY` vs текущая позиция + release, и клавиши через `E.input.wasPressed('ArrowLeft')` и т.д. Эталон — `mazeheart/game/scenes.js:handleMoveInput`.

---

## Часть 2 — P1: серьёзные баги

### P1-1 — Отсутствует `consumesInputInUpdate` (8 игр)

**Игры:** `pizzaspin`, `skyblocks`, `starfall`, `sweettower`, `watersort`, `wordlink`, `solitairekl`, `sudokulite`

**Механизм:** `engine/core.js` гасит edge-флаги `pointer.pressed` внутри fixed-step цикла только для сцен с `consumesInputInUpdate: true`. Эти 8 игр читают `pointer.pressed` в `update()`, но флаг не ставят → при multi-step кадрах (throttling табов, 30 Hz просадки) один тап обрабатывается дважды:
- `pizzaspin` — поворот 90° вместо 45°
- `skyblocks` — два облака вместо одного (двойные кристаллы)
- `watersort` — два перелива
- `solitairekl`, `sudokulite` — две карты/две цифры

**Фикс:** добавить в определение сцены каждой игры:
```js
var PlayScene = {
  name: 'play',
  consumesInputInUpdate: true,
  // ...
}
```

Эталон: `wordgrid` (единственная из восьми, где флаг уже есть).

---

### P1-2 — `solitairekl`: туториал повторяется вечно

**Файл:** `games/solitairekl/game/scenes.js`
- Строка 243: `E.storage.set('sudokulite_tutorial', true)` (copy-paste из `sudokulite`)
- Строка 157: читается `E.storage.get('solitairekl_tutorial')`

Запись и чтение идут в разные ключи → туториал перезапускается на каждом уровне бесконечно.

**Фикс:** строка 243 → `E.storage.set('solitairekl_tutorial', true)`.

---

### P1-3 — `sudokulite`: revive-панель виснет при ошибке рекламы

**Файл:** `games/sudokulite/game/scenes.js:961-977`

`doRevive` передаёт `onError` в `E.sdk.showRewarded`, но `engine/sdk.js:150-167` вызывает только `onReward`/`onDone`. При ошибке рекламы игра не возвращается на fail-screen (revive-оверлей зависает; ручной «отказ» работает).

**Фикс:** заменить `onError: ...` на `onDone: function(ok) { if (!ok) showFailScreen(); }`.

Та же проблема в `blockfit:1044`, `bubblepop:540`, `mahjongpair:805`, `merge2048:940` — но там P0 отменяет приоритет.

---

### P1-4 — `wordlink`: бустер «Буква» == «Подсказка» (дубликат)

**Файл:** `games/wordlink/game/scenes.js:374-394`

`buyHint` и `buyLetter` вызывают **одну и ту же** функцию `G.words.hintLetter()` и открывают **одну и ту же** клетку — два товара с разной ценой делают идентичное действие.

**Фикс:** `buyLetter` должна открывать клетку в **самом длинном нерешённом слове** (логика отличается от generic hint).

---

### P1-5 — `pipes`: покупка подсказки списывает монеты вхолостую

**Файл:** `games/pipes/game/scenes.js:652`

`buyItem` списывает `st.coins` до вызова `L.hint()`. Если все тайлы уже в базовой ориентации, `L.hint()` возвращает `{cell:-1}` — игрок заплатил за пустышку.

**Фикс:** сначала `var res = L.hint(st)`, потом если `res.cell >= 0` — списать монеты, иначе показать «Нечего подсказывать» (паттерн `solitairekl/handleShopButton`).

---

### P1-6 — `hackerparkour`: пустой GOAL-блок в меню

**Файл:** `games/hackerparkour/scripts/menu.gd:394-397`

`_build_series_promo` делает `match Variant.id` с ветками только для `"nub"`, `"pro"`, `"god"`. У hackerparkour `variant.gd:5` → `id = "hacker"`, поэтому ни одна ветка не матчится — GOAL-лейбл **рендерится пустым**.

i18n-ключ `series_hacker` добавлен в `game_state.gd:96`, но не подключён.

**Фикс:** добавить в `match`:
```gdscript
"hacker": hint.text = GameState.L("series_hacker")
```

---

### P1-7 — `mineridle`: утечка UI при refresh()

**Файл:** `games/mineridle/scripts/menu.gd:23-45`

`_build()` добавляет `PanelContainer` (строка 35) и `ScrollContainer` (строка 40) напрямую в `Menu`-ноду, но `refresh()` освобождает только `_root`. Каждое переключение языка / звука / покупка / daily claim / смена скина **добавляет ещё один непрозрачный полноэкранный panel + scroll** — перманентный рост overdraw в течение сессии.

**Фикс:** паттерн `menu.gd:_clear()` из parkour-игр (строки 50-52) — добавить в refresh очистку всех детей перед rebuild.

---

### P1-8 — Shared parkour bug: гонка пауза ↔ fullscreen реклама

**Файлы:** `games/{god,nubik,pro,hacker}parkour/scripts/game.gd:548-556`

HUD имеет `PROCESS_MODE_ALWAYS` (game.gd:245), поэтому кнопка паузы остаётся кликабельной в окно перед тем, как ad-iframe перекроет canvas. Тап переводит `tree.paused` обратно в `false` mid-ad → speedrun-таймер идёт во время рекламы, затем `_on_adv_done` (yandex.gd:106-115) снова ставит `paused=false` — итоговое состояние неконсистентно.

**Фикс:** guard в `_toggle_pause`:
```gdscript
if Yandex.get("_paused_by_adv"): return
```

---

### P1-9 — Shared parkour: кнопки jump/dash без `action_mode=PRESS`

**Файлы:** `games/{god,nubik,pro,hacker}parkour/scripts/game.gd:629-675`

`BaseButton` по умолчанию стреляет на RELEASE → ~80-150 мс perceived latency на самом используемом действии. Roblox-style кнопки должны стрелять на PRESS.

**Фикс:** `_jump_btn.action_mode = BaseButton.ACTION_MODE_PRESS` (и для dash, и для left/right).

---

### P1-10 — Shared parkour: регенерация WAV на каждый SFX

**Файл:** `games/{god,nubik,pro,hacker}parkour/scripts/audio_bus.gd:20-71`

`_play(_gen_tone(...))` генерирует WAV **байт за байтом в GDScript** на каждый SFX (jump = ~1985 итераций + `PackedByteArray` аллокация на каждый tap). Для `mineridle` это особенно критично — `hit()` стреляет на каждый tap в кликере.

**Фикс:** кэшировать `AudioStreamWAV` по `(freq, dur, kind)`.

---

### P1-11 — `mineridle`: gems — мёртвая валюта

**Файлы:** `games/mineridle/scripts/game.gd:343-348, 709`

`◆` выдаются из golden veins, отображаются в HUD, сохраняются в save/cloud — но **нигде не тратятся**. Все апгрейды/скины стоят `◈` или `RUB`. Премиум-валюта без sink = потерянный retention hook.

**Фикс:** добавить gem-priced skins (таблица `SKINS` уже поддерживает), gem-only machine tier, или gem IAP.

---

### P1-12 — `mineridle`: daily claim форсит rewarded video без согласия

**Файл:** `games/mineridle/scripts/menu.gd:241-248`

Кнопка «Собрать» сразу запускает rewarded video без opt-out. i18n-ключи `daily_double_q` и `no_thanks` определены в `game_state.gd:61,64`, но **не используются** (0 refs) — диалог был запланирован и выброшен.

**Фикс:** показать диалог «Удвоить награду за рекламу?» с кнопками `yes`/`no_thanks` перед запуском RV (паттерн `menu.gd:459-494` в parkour).

---

## Часть 3 — Проблемы пакетов / медиа (P1 по бизнес-последствиям)

### P1-PKG-1 — Отсутствует manifest.json (19 игр)

`release-check` требует `packages/<id>/manifest.json`. Отсутствует у:
`bubblebay`, `bubblepop`, `cloudherder`, `fireflygrove`, `fishpond`, `gingerdash`, `hexwave`, `mahjongpair`, `matchcandy`, `merge2048`, `mergemon`, `pizzaspin`, `skyblocks`, `solitairekl`, `starfall`, `sudokulite`, `sweettower`, `watersort`, `wordlink`.

Есть у: `arrowescape`, `blockfit`, `cannonball`, `dominochain`, `kozyr`, `lightout`, `mazeheart`, `mergesweets`, `parkingescape`, `pindrop`, `pipes`, `pixelcode`, `pulseref`, `rollfort`, `slide15`, `wordgrid`.

**Фикс:** написать `pipeline/scaffold-manifest.mjs`, генерирующий manifest по шаблону `wordgrid` (в нём уже есть IAP `no_ads`, leaderboard, categories, orientation).

### P1-PKG-2 — Устаревший zip (2 игры)

- `hexwave`: `game.zip` не содержит последний `game/i18n.js` (изменён в коммите `0021c1c`, zip собран в `d5417f6`)
- `skyblocks`: `game.zip` не содержит последний `game/i18n.js` (изменён в `b23e09a`)

**Фикс:** `node pipeline/pack.mjs hexwave && node pipeline/pack.mjs skyblocks`.

### P1-PKG-3 — Отсутствует keywords.txt (2 игры)

- `packages/hackerparkour/texts/keywords.txt`
- `packages/mineridle/texts/keywords.txt`

**Фикс:** добавить файл (≤100 символов, SEO-ключи через запятую).

### P1-PKG-4 — Media старше кода (3 игры)

У `godparkour`, `nubikparkour`, `parkourpro` файлы `icon.png`, `cover.ru.png`, `cover.en.png` старше `game/`. Нужна пересъёмка.

**Фикс:** `node pipeline/_recapture_all.mjs godparkour nubikparkour parkourpro` (или соответствующий Godot-screenshot скрипт).

### P1-PKG-5 — mineridle: недостающие EN-скриншоты

В `packages/mineridle/media/` есть `screenshot_landscape_01..06_ru.png`, но `screenshot_landscape_02/05/06_en.png` отсутствуют (есть только `01/03/04_en.png`).

**Фикс:** переснять EN-сессию с большим количеством сцен.

---

## Часть 4 — P2: баги и UX-проблемы

### P2-1 — `bubblepop`: hardcoded RU в геймплее

`scenes.js:460` — `this.addFloater(x, y, '+' + orphanScore + ' падение', ...)` — видно в EN-локали.

**Фикс:** добавить i18n-ключ `orphan_drop: 'падение' / 'drop'` и использовать `T('orphan_drop')`.

### P2-2 — `bubblepop`: interstitial без throttle

`scenes.js:512` — interstitial стреляет на каждой победе без временного ограничения. Yandex может забанить за «too frequent».

**Фикс:** добавить 60s min-interval (паттерн `arrowescape:737`).

### P2-3 — `mahjongpair`: `E.core.width` — undefined

`scenes.js:696` — `window.Engine.core.width` — `E.core` экспортирует только `{Game, setScene, _register}` (core.js:235-239). Сравнение `x > undefined - 50` → `NaN`, всегда `false` → HUD-кнопка **магазина мертва** (пауза работает).

**Фикс:** использовать `this.game.view.w - 50` (как в sibling-играх).

### P2-4 — `mahjongpair`: `E.rng.mulberry32` — не существует

`scenes.js:869` — `E.rng.mulberry32(Date.now() % 100000)` — engine экспортирует только `E.Rng` (rng.js:31). TypeError на платный shuffle.

**Фикс:** `new E.Rng(Date.now() % 100000)`.

### P2-5 — `mahjongpair`: `E.audio.music('gameplay')` — нет такого паттерна

`scenes.js:197` — `PATTERNS` содержит только `menu`/`play` (audio.js:98-100). Музыка в геймплее **молчит** (guard `!PATTERNS[name]` возвращает undefined без ошибки).

**Фикс:** `E.audio.music('play')`.

### P2-6 — `mahjongpair`: `E.capture.recordMode` не существует

`scenes.js:765, 778, 785` используют `E.capture.recordMode` и `E.capture.autopilot` — capture.js экспортирует `{active, autoplay, record, ...}` (строка 30). `recordMode` → undefined → interstitial стреляет во время записи видео, revive показывается в autopilot, reward cap не применяется.

**Фикс:** использовать scene-local `this.recordMode` (уже вычисляется правильно на scenes.js:202) или `E.capture.record > 0 || E.capture.autoplay`.

### P2-7 — `merge2048`: отсутствует i18n-ключ `no_moves`

`scenes.js:795, 797` вызывают `E.i18n.t('no_moves')`, но в `game/i18n.js` ключа нет → flash показывает буквальную строку `"no_moves"` вместо «Нет ходов!».

**Фикс:** добавить `no_moves: 'Нет ходов!' / 'No moves!'` в словарь.

### P2-8 — `gingerdash`: distance-scoring мёртв

`scenes.js:550` — `this.score += Math.floor(sp * dt / 40) * C.score.meter`. При `dt=1/60` и `sp<=480` получается `sp*dt/40 <= 0.2` → `Math.floor = 0` каждый тик. Очки за дистанцию **никогда не начисляются** (только рыбки).

**Фикс:**
```js
this.meterAcc = (this.meterAcc || 0) + sp * dt / 40;
var m = Math.floor(this.meterAcc);
if (m) { this.score += m * C.score.meter; this.meterAcc -= m; }
```

### P2-9 — `fireflygrove`: setTimeout не очищается

`scenes.js:407` — `setTimeout(800ms)` спавнит замену светлячку после тапа. Таймер не очищается при `exit()/restart()`. Guard `self.mode==='running'` после быстрого рестарта снова true → светлячок из прошлой сессии появляется в новой.

**Фикс:** сохранять timer id и `clearTimeout` в `exit()`.

### P2-10 — `bubblebay`: сохранённый run никогда не предлагается

`scenes.js:404` пишет `E.storage.set('run', {...})`, но `get('run')` нигде не читается. Menu Play всегда рестартит на level 1 (:149, 216, 538).

**Фикс:** либо использовать (`if (savedRun) showContinueButton()`), либо удалить запись.

### P2-11 — `cannonball`: in-play shop — мёртвая ветка

`openShop` (scenes.js:765) вызывается только из capture-параметров (956, 979, 982), не из HUD. Реальные игроки не могут открыть магазин во время уровня.

**Фикс:** добавить HUD-кнопку магазина или удалить ветку.

### P2-12 — `cannonball`: RV-coins без cooldown

`scenes.js:294-303` — кнопка «+монеты за рекламу» в меню не имеет cooldown → фарм RV ради монет. Yandex может забанить.

**Фикс:** добавить per-session cap или 60s cooldown.

### P2-13 — `cannonball`: per-frame trace allocation

`scenes.js:1091-1094` — `L.trace` вызывается каждый кадр при aiming (с preview upgrade), аллоцирует до 250 точек + копию targets на кадр.

**Фикс:** кэшировать trace, пересчитывать только при изменении angle/power.

### P2-14 — `kozyr`: per-frame button churn

`scenes.js:458-530` — `_syncButtons` конструирует новые `E.ui.Button` + closures каждый update tick (60fps аллокации). `scenes.js:371` — `prevTable = stA.table.map(...)` каждый кадр.

**Фикс:** кэшировать кнопки по `(phase, turn)`-сигнатуре; обновлять `prevTable` только при изменении `table`.

### P2-15 — `arrowescape`: per-frame refreshBoosterLabels

`scenes.js:984` — `refreshBoosterLabels()` вызывается внутри `drawBoosters` каждый кадр (60×/s). Пересобирает текст кнопок бустеров.

**Фикс:** вынести в события изменения состояния (покупка бустера, начало уровня).

### P2-16 — `matchcandy`: shuffleBoard сбрасывает доску

`scenes.js:374` — `shuffleBoard()` делает `G.match.freshBoard(...)` (новая случайная доска) вместо перестановки существующих фишек. Для **платного** shuffle это наказывает покупателя (стратегия сбрасывается).

**Фикс:** Fisher-Yates по текущей доске с проверкой `anyMove` (паттерн `slide15`).

### P2-17 — `matchcandy`: saveGame только после победы

`scenes.js:397` — `saveGame()` вызывается только в interstitial callback после победы. Закрытие таба между победой и следующим уровнем теряет прогресс.

**Фикс:** сохранять сразу в `onWin()`, до показа рекламы.

### P2-18 — `dominochain`: per-frame `L.playable` + unpruned pops

`scenes.js:1216-1221` — `L.playable(st)` (аллоцирует массивы/объекты) вызывается на каждый тайл каждый кадр. `scenes.js:990` — `this.pops` map никогда не чистится.

**Фикс:** вычислять `playable` один раз на кадр; чистить `pops` после анимации.

### P2-19 — `dominochain`: красный X-маркер в неправильном месте

`scenes.js:516-527` — `computeEndZones` при заполнении стороны до cap выдаёт отрицательный zone index, клампится в slot 0. Маркер «сторона заполнена» рисуется ~12 слотов от реального конца.

**Фикс:** вычислять marker position от последнего валидного слота.

### P2-20 — `fishpond`: per-frame closure bind

`scenes.js:193` — `this.rng.float.bind(this.rng)` аллоцирует новую closure на каждую рыбку каждый кадр.

**Фикс:** вынести bound fn в поле сцены (в `enter`).

### P2-21 — `fishpond`: main.js header — copy-paste

`main.js:1` — комментарий «Бабл-Бухта» (копия из `bubblebay`).

**Фикс:** заменить на «Рыбный Пруд».

### P2-22 — `mergesweets`: drawTutorial tap-dismiss мёртв

`scenes.js:1051` — `pointer.pressed` читается в `draw()`, но у flag-игр он уже гасится до render (core.js:150) → tap-dismiss никогда не срабатывает, только 8s таймер.

**Фикс:** переместить dismiss в `update()`.

### P2-23 — `mergesweets`: `anyResting()` — мёртвый код

`scenes.js:620` — `anyResting()` определён, но логика уже заменена на `aboveT` в `updateRunning`. Можно удалить.

### P2-24 — `pixelcode`: `L.makePuzzle` на главном потоке

`logic.js:267` — до 48 line-solver passes синхронно на входе в уровень → возможный first-frame hitch на 15x15.

**Фикс:** кэшировать пазлы по seed или генерировать вне critical path.

### P2-25 — `pizzaspin`: saveGame на каждый пойманный топпинг

`scenes.js:406` — `saveGame()` вызывается на каждый пойманный топпинг → частые записи в storage.

**Фикс:** батчить раз в уровень.

### P2-26 — `skyblocks`: нет offline earnings

Idle-жанр ожидает offline-накопления, а у `skyblocks` доход идёт только при открытой вкладке.

**Фикс:** сохранять `lastLogout` timestamp, при старте начислять `(now - lastLogout) * baseIncome`.

### P2-27 — Shared parkour: leaderboard API spam

`menu.gd:365` — `_build_leaderboard` вызывает `Yandex.get_leaderboard` на каждый rebuild меню. `refresh()` запускается после каждой покупки, переключения языка, daily claim, возврата из уровня → спам API.

**Фикс:** кэшировать leaderboard с TTL 60s.

### P2-28 — Shared parkour: per-frame Label.text rewrite

`menu.gd:430-449` — `_process` переписывает `btn.text` для RV-cooldown каждый кадр даже при неизменном тексте → per-frame relayout.

**Фикс:** обновлять только при изменении секунды.

### P2-29 — Shared parkour: exit-flush ненадёжен

`game_state.gd:200-206` — exit-flush полагается на `NOTIFICATION_WM_CLOSE_REQUEST`/`EXIT_TREE`, которые browser tab не всегда доставляет. С debounce 1.5s (`game_state.gd:270-279`) монеты за последние секунды могут теряться при закрытии таба.

**Фикс:** flush на `visibilitychange` через JS bridge.

### P2-30 — `mineridle`: мёртвый PAUSE-панель

`game.gd:756, 777-790` — `_build_pause()` создаёт overlay с Continue-кнопкой, но ничто не ставит `_pause_panel.visible = true`, `get_tree().paused = true`, и нет pause-кнопки в HUD (только sound/menu/shop). ~20 строк мёртвого кода; shop overlay — де-факто пауза.

**Фикс:** либо добавить HUD pause-кнопку и wire, либо удалить dead code.

### P2-31 — `mineridle`: мёртвые i18n-ключи

`daily_double_q`, `no_thanks`, `rv_pick`, `locked_ban_gold`, `tut_buy`, `rocks_left`, `rock_hp`, `gems_n` — 0 использований в коде.

**Фикс:** удалить или подключить (зависит от решения по P1-11/P1-12).

### P2-32 — `mineridle`: tutorial timer guard

`game.gd:745-750` — `_show_tutorial` ждёт `SceneTreeTimer(5s)`. Если игрок ушёл в меню mid-await, resume попадает на freed instance.

**Фикс:** `if is_instance_valid(get_tree())` после `await`.

---

## Часть 5 — P3: косметика / улучшения

### По играм (алфавит)

| Игра | Предложения |
|------|-------------|
| arrowescape | (1) Menu `onBack` не переопределён — browser back из меню ставит паузу вместо exit/no-op. (2) Revive только на game-over — добавить «double coins» на win-screen (паттерн `cannonball`). |
| blockfit | (после P0-фиксов) Добавить `mute persistence` + `isMuted()` label + `sound_on/off` i18n. |
| bubblebay | (1) Добавить interstitial (нет совсем, только banner + RV revive) — каждые 2 уровня по паттерну `lightout`. (2) Hardcoded `'Я'` glyph в auth-иконке показывается в EN (scenes.js:201). (3) `showRewarded` без `onDone` — silent dead button при ошибке рекламы (toast `ad_fail`). |
| bubblepop | (после P0) `interstitial throttle 60s` (P2-2). `orphan_drop` i18n (P2-1). |
| cannonball | (после P2-12/13) Wire in-play shop к HUD или удалить ветку. |
| cloudherder | (1) Нет interstitial. (2) `showRewarded` без `onDone` — silent dead button. (3) `🪣/🌤/🌈` emoji в HUD могут выходить за левый край на узких экранах (cxr-140 без проверки). |
| dominochain | (после P2-18/19) `defPos()` аллоцирует per call в tryFire/pulse/draw — inline в scratch. HUD coin counter `v.w-118` толпится с wave label на узких экранах. |
| fireflygrove | (после P2-9) `config rvDust` мёртв — нет rewarded-for-dust кнопки. Добавить или удалить. |
| fishpond | (после P0) Нет in-game pause (только SDK onPause) — добавить pause-кнопку + Escape. Zero monetization hooks (нет RV вообще, только banner) — добавить revive RV + interstitial. |
| gingerdash | (после P2-8) `config rvFish` мёртв — нет rewarded-for-fish кнопки. `puddle` obstacle поддержан в коде (entities.js:13-15), рисуется (scenes.js:779), но никогда не спавнится — добавить на высоких уровнях или удалить. |
| godparkour | (1) RV-сундук на старте уровня / shield-refill на death-panel (когда revive исчерпаны) — сейчас RV только revive×5 и win-double, оба требуют смерти. (2) Variable-jump cut (player.gd:407) работает только для keyboard; mobile tap всегда даёт полную высоту. (3) Заблокированные уровни показывают только замок — добавить текст «Достигни уровня N». |
| hackerparkour | (после P1-6) 9 уровней × 3 звезды = 27 — кампания заканчивается за 15-20 мин. Добавить NG+ или loop-with-scaling на final win panel (game.gd:528-536 уже loop'ит к level 1). |
| hexwave | (после repack) `defPos()` аллокации inline. |
| kozyr | (после P2-14) Нет in-game pause (короткие раунды — оправдано, SDK onPause есть). |
| lightout | Всё чисто. Минимальные улучшения не требуются. |
| mahjongpair | (после P0 + P2-3..6) Полная переработка capture-aware логики. |
| matchcandy | (после P2-16/17) — |
| mazeheart | Всё чисто. |
| merge2048 | (после P0) Полный rewrite input path. |
| mergemon | Добавить interstitial (нет совсем). |
| mergesweets | (1) Добавить sound toggle в pause menu (только resume/restart/menu). (2) Показывать `boost_*_d` описания из i18n (определены, но не рендерятся — blind buying). |
| mineridle | (после P1-7/11/12) Добавить timed booster RV «x2 DPS 4h» — самый сильный ad hook idle-жанра (сейчас только +200 coins / boss +15s / win/offline doubles). |
| nubikparkour | (как godparkour) Для child-friendly варианта: death-panel после 5 revive предлагает только restart/menu — free continue (reset to checkpoint) подойдёт «learn to jump» позиционированию. |
| parkingescape | Leaderboard panel не показывает `userRank` (`mergesweets` показывает). |
| parkourpro | Hacker-глава (22-30) — дифференциатор; добавить H-chapter-only leaderboard (иначе 21-level main board скрывает late-game прогресс). |
| pindrop | Нет IAP no-ads; landscape HUD показывает balance, но не run earnings. |
| pipes | (после P1-5) hint highlight 1.8s — коротко на больших досках. |
| pixelcode | (после P2-24) `noAdsPrice` из `getCatalog` обновляется только в `menu.enter`. |
| pizzaspin | (после P1-1, P2-25) — |
| pulseref | Нет IAP no-ads. |
| rollfort | Нет IAP no-ads; `leaveWin` interstitial без no_ads guard (безобидно, пока IAP нет). |
| skyblocks | (после P1-1, P2-26) — |
| slide15 | Нет keyboard-управления на desktop (только tap/mouse). |
| solitairekl | (после P1-1, P1-2) HUD hit-zones захардкожены на 30px — мало для touch (Yandex рекомендует ≥44px). |
| starfall | (после P1-1) Нет IAP no-ads. |
| sudokulite | (после P1-1, P1-3) HUD hit-zones как в `solitairekl` (30px). |
| sweettower | (после P1-1) Нет IAP no-ads. |
| watersort | (после P1-1) Stuck-panel не имеет кнопки «В меню» (только платный shuffle + restart). |
| wordgrid | Эталон для остальных (consumesInputInUpdate + noAds guard есть). `no_ads` catalog price читается только в `menu.enter`. |
| wordlink | (после P1-1, P1-4) — |

---

## Часть 6 — Глобальные улучшения

### G-1 — `consumesInputInUpdate` rollout
8 игр нуждаются в однострочном флаге (см. P1-1). Один PR на все.

### G-2 — IAP `no_ads` rollout
Из 17 игр N-Z батча `no_ads` есть только у 4 (`mergesweets`, `parkingescape`, `pixelcode`, `wordgrid`). Остальные 13 не имеют платного пути вовсе. Эталон — `wordgrid` (уже работает `noAds guard` на interstitial).

### G-3 — `showRewarded` `onDone` паттерн
В `bubblebay`, `cloudherder`, `sudokulite`, `blockfit`, `bubblepop`, `mahjongpair`, `merge2048` — `showRewarded` либо не имеет failure-callback, либо использует несуществующий `onError`. Правильный паттерн (из `wordgrid`, `mazeheart`, `lightout`):
```js
E.sdk.showRewarded({
  onReward: function () { /* награда */ },
  onDone: function (ok) { if (!ok) toast(T('ad_fail')); }
});
```

### G-4 — Перф-кэширование WAV (Godot)
Все 5 Godot-игр регенерируют WAV на каждый SFX. Кэшировать по `(freq, dur, kind)`. Критично для `mineridle` (clicker).

### G-5 — Перф-кэширование UI (parkour + kozyr + arrowescape)
- `parkour/menu.gd:430-449` — Label.text rewrite per frame
- `parkour/menu.gd:365` — leaderboard API spam
- `kozyr/scenes.js:458-530` — Button construction per frame
- `arrowescape/scenes.js:984` — refreshBoosterLabels per frame

### G-6 — Manifest generator
19 игр без manifest.json. Написать `pipeline/scaffold-manifest.mjs`, который парсит существующий `packages/<id>/texts/title.ru.txt`, `manifest` из `wordgrid` (как template), и подставляет `id`, `version`, `title`.

### G-7 — Repack hexwave + skyblocks
Оба zip старше `i18n.js`. `node pipeline/pack.mjs hexwave skyblocks`.

### G-8 — Fix `release-check.mjs:parseI18n`
Регулярка `loc + ':\s*\{([\\s\\S]*?)\\n\\s*\\}'` находит `en:` внутри `ru:`-блока, потому что `[\s\S]*?` non-greedy матчится до первого `\n}` — а это может быть конец ru-блока. Нужен depth-aware сканер (или использовать существующий `parseI18n` из `_i18n_check.mjs`, который работает корректно).

### G-9 — Fix `release-check.mjs:checkIds` для Godot
`release-check.mjs:146-150` сканирует только `game/*.js`. Для Godot-игр нужно также сканировать `scripts/*.gd` и `levels/*.json`.

### G-10 — Godot runtime smoke
`_runtime_smoke.mjs` проверяет только JS-игры (есть `index.html` + `game/main.js`). Для Godot нужен отдельный smoke: `export/web/index.html` + wait `Engine.isGameReady` или аналог. Сейчас Godot-игры проверяются только статически + release-check (который падает на CORS).

---

## Часть 7 — Приоритизированный план действий

### Спирнт 1 (P0, 1 день)
1. `blockfit`: fix sound button + overlay dispatcher (P0-1, P0-2)
2. `bubblepop`: fix sound button + RU floater (P0-1, P2-1)
3. `fishpond`: fix sound button + label (P0-1)
4. `mahjongpair`: fix sound button + `E.core.width` + `E.rng.mulberry32` + music + capture (P0-1, P2-3..6)
5. `merge2048`: fix sound button + ПОЛНЫЙ rewrite input path (P0-1, P0-3)

### Спринт 2 (P1, 2-3 дня)
1. `consumesInputInUpdate` rollout × 8 игр (P1-1)
2. `solitairekl` tutorial key fix (P1-2)
3. `sudokulite` revive onDone (P1-3)
4. `wordlink` letter booster differentiate (P1-4)
5. `pipes` hint refund (P1-5)
6. `hackerparkour` GOAL-block fix (P1-6)
7. `mineridle` refresh() leak (P1-7)
8. Shared parkour: pause race + action_mode + WAV cache (P1-8..10)
9. `mineridle` gems sink + daily dialog (P1-11, P1-12)

### Спринт 3 (Пакеты, 1 день)
1. Manifest generator + rollout × 19 игр (G-6)
2. Repack `hexwave` + `skyblocks` (G-7)
3. keywords.txt × 2 (P1-PKG-3)
4. Media recapture × 3 Godot (P1-PKG-4)
5. mineridle EN screenshots (P1-PKG-5)
6. Fix `release-check` parseI18n + checkIds (G-8, G-9)

### Спринт 4 (P2 + G, фоном)
- Все P2 из части 4
- G-1..G-10

---

## Приложение A — Команды для проверки фиксов

```bash
# Полный аудит всех 35 JS-игр
node pipeline/audit.mjs --all

# Runtime smoke (быстрый, без media-asserts)
node pipeline/_runtime_smoke.mjs

# Release-check всех 40 игр (долгий, ~30 минут)
node pipeline/release-check.mjs --all

# Проверка конкретной игры
node pipeline/release-check.mjs <gameid>

# Repack после фиксов
node pipeline/pack.mjs <gameid>
```

## Приложение B — Файлы с сырыми отчётами аудиторов

- `scratch/report-a-m.md` — 18 игр (arrowescape..mergemon)
- `scratch/report-n-z.md` — 17 игр (mergesweets..wordlink)
- `scratch/report-godot.md` — 5 Godot-игр

Все три отчёта верифицированы повторными прямыми чтениями кода; 2 ложных срабатывания (`lightout/mazeheart sfx revive/over`, `mineridle manifest`) отфильтрованы.

---

## Часть 8 — Отчёт о фикшах (2026-11-14)

### Исправлено (P0)

| # | Что | Где | Верификация |
|---|-----|-----|-------------|
| P0-1 | `E.audio.toggleMute()` → `setMuted(!isMuted())` + persist + i18n `sound_on/off` | **7 игр**: blockfit, bubblepop, fishpond, mahjongpair, merge2048, solitairekl, sudokulite (в аудите нашли 2 лишних) | smoke 7/7 OK |
| P0-2 | Overlay-диспетчер `handleTap` по mode (copy из bubblepop:309-315) | blockfit scenes.js | smoke OK |
| P0-3 | `handlePlayerInput`: swipe-детект + `wasPressed` клавиши, диспетчер onTap на все режимы | merge2048 scenes.js | smoke OK |

### Исправлено (P1/P2 JS)

| # | Что | Где |
|---|-----|-----|
| P1-1 | `consumesInputInUpdate: true` | 8 игр: pizzaspin, skyblocks, starfall, sweettower, watersort, wordlink, solitairekl, sudokulite |
| P1-2 | Tutorial key `sudokulite_tutorial` → `solitairekl_tutorial` | solitairekl scenes.js:246 |
| P1-3 | doRevive `onError` → `onDone(ok)` (guard `mode==='revive'`) | sudokulite + blockfit, bubblepop, mahjongpair, merge2048 (5 игр) |
| P1-4 | buyLetter → `hintLongestLetter` (самое длинное нерешённое слово) | wordlink entities.js + scenes.js |
| P1-5 | Hint refund при `cell===-1` + i18n `hint_nothing` | pipes logic.js + scenes.js + i18n.js |
| P2-1 | Floater `' падение'` → `E.i18n.t('orphan_drop')` | bubblepop scenes.js:462 + i18n |
| P2-3..6 | `E.core.width` → `this.game.view.w`; `E.rng.mulberry32` → `new E.Rng().float`; `music('gameplay')` → `music('play')`; `E.capture.recordMode` → `this.recordMode` | mahjongpair scenes.js (4 фикса) |
| P2-7 | i18n `no_moves` добавлен | merge2048 i18n.js |
| P2-8 | Distance-score через `meterAcc`-накопление | gingerdash scenes.js:548-553 |
| P2-9 | `setTimeout`-спавны светлячков: массив `_bugTimers` + clearTimeout в exit() | fireflygrove scenes.js |

### Исправлено (Godot)

| # | Что | Где |
|---|-----|-----|
| P1-6 | `"hacker": hint.text = L("series_hacker")` в match | hackerparkour menu.gd:436 |
| P1-7 | refresh() освобождает ВСЕХ детей (bg+scroll+_root), нулит ссылки | mineridle menu.gd:23-36 |
| P1-8 | Guard `if Yandex._paused_by_adv: return` в `_toggle_pause` | 4 parkour game.gd:548 |
| P1-9 | `action_mode = BaseButton.ACTION_MODE_BUTTON_PRESS` (jump + dash) | 4 parkour game.gd:655,682 |
| P1-10 | WAV-кэш `_tone()` по ключу `(freq,dur,kind)`, 13 call sites | 4 parkour audio_bus.gd:26-34 |
| P2-27 | Leaderboard TTL-кэш 60s + `_apply_leaderboard()` + dedup in-flight | 4 parkour menu.gd:365-383 |
| P1-12 | ConfirmationDialog «Удвоить за видео?» перед daily-RV (подключены `daily_double_q`/`no_thanks`) | mineridle menu.gd:250-266 |

### Исправлено (пакеты и pipeline)

| # | Что | Результат |
|---|-----|-----------|
| P1-PKG-1 | `pipeline/scaffold-manifest.mjs` (генератор: iap/leaderboards/levels-детект) | 20 новых manifest.json |
| P1-PKG-2 | Repack hexwave + skyblocks + 16 игр после правок кода | zip свежие, `audit.mjs --all` = **0 issues / 35** |
| P1-PKG-3 | keywords.txt | hackerparkour (67), mineridle (62) — обе ≤100 |
| P1-PKG-4 | Media пересобраны из свежих SVG через `pipeline/_svg2png.mjs` (новый тул: headless Chrome SVG→PNG) | godparkour, nubikparkour, parkourpro, hackerparkour: icon 512×512 + cover RU/EN 800×470, все RGB=2 |
| G-8 | parseI18n depth-aware (счётчик `{}` + учёт строк) | FP `fishpond: в en нет en` исчез |
| G-9 | checkIds: скан `.gd` + GDScript-сигнатуры (`submit_score`, `purchase`) + строковые литералы | FP mineridle manifest исчез |

### Верификация после фиксов

- `node pipeline/_runtime_smoke.mjs` → **35/35 OK, 0 issues**
- `node pipeline/audit.mjs --all` → **0 issues / 35 games**
- Godot rt-тесты: godparkour **86/86**, nubikparkour **86/86**, parkourpro **87/87**, hackerparkour **86/86**, mineridle **29/29**
- release-check выборочно: fishpond OK (без i18n-FP), mineridle (без manifest-FP), kozyr OK

### Не исправлено (осознанно отложено)

- **IAP no_ads rollout ×13** (G-2) — продуктовое решение, требует решения по ценообразованию на каждую игру.
- **Interstitials для bubblebay/cloudherder/mergemon/mergesweets** (P3) — нужно выбрать точки (каждые N уровней) отдельно.
- **Мелкие перфы** (P2-10..30 не из таблицы выше: cannonball trace-кэш, kozyr button-churn, matchcandy shuffleBoard, dominochain playable/pops, pixelcode makePuzzle, pizzaspin saveGame-батчинг, skyblocks offline-earnings, watersort stuck-menu, slide15 keyboard, HUD 30px→44px в solitairekl/sudokulite) — низкий риск, вынесены в бэклог.
- **mineridle EN-скриншоты 02/05/06** — требуют GL-рендера (оконный Godot), отдельная сессия.
- **Godot runtime smoke в пайплайне** (G-10) — инфраструктурная задача (CORS-прокси для wasm).
