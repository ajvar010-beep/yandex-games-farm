# Партия-4: 10 игр за ночь — бриф исполнителю

Ты строишь **одну** небольшую игру для Яндекс Игр в своей ветке и worktree.
Цель — рабочая, оригинальная по облику игра с проверенной формулой жанра, проходящая все гейты.
Работающая игра важнее количества фич.

## Главное правило

**Берём формулу, не облик.** Механика, темп, камера, структура экономики — можно.
Имя, логотип, персонажи, арт, музыка, тексты, trade dress — нельзя: Яндекс отклоняет
1:1-рескины (треб. 3.6), а копия чужих ассетов — правовой риск. Всё рисуется кодом.

## Где работаешь

- worktree: `C:/gf-wt/<slug>`, ветка `game/<slug>` (уже создана и checkout).
- Пиши **только** `games/<slug>/`, `packages/<slug>/`. Ничего больше не трогай.
- `node_modules` — junction на `C:/GameFactory/node_modules`; не удаляй и не переустанавливай.
- `engine/` не правится: копируешь 1:1 из `games/parkingescape/engine`.

## Прочитай до кода

- скиллы: `game-studio`, `factory-engine`, `yandex-games`, `remaking-play-hits`
  (`C:/Users/Администратор/.claude/skills/<name>/SKILL.md`).
- `RUBRIC.md`, `docs/FACTORY.md`.
- рабочие примеры: `games/kozyr` (простая карточная), `games/rollfort` (свежая, с `capture.json`,
  перками и модалками). `games/rollfort/game/*.js` — лучший образец структуры.

## Что сдать

```
games/<slug>/
  index.html
  engine/                 ← cp -r games/parkingescape/engine
  sdk-stub.js             ← cp games/parkingescape/sdk-stub.js
  game/config.js          ← только данные
  game/i18n.js            ← RU/EN
  game/logic.js           ← чистая логика, без DOM
  game/art.js             ← процедурная графика + promo
  game/scenes.js          ← menu/play/pause/result
  game/main.js
  capture.json
  PLAY-DNA.md / ORIGINALITY.md / CHOICE.md / SPEC.md
packages/<slug>/
  texts/{title,seo,short,about,how_to_play}.{ru,en}.txt
  texts/keywords.txt, texts/game_id.txt
  manifest.json
```

## Контракт игры

- **Сцены:** `menu`, `play` (победа/поражение — оверлей внутри play, `mode` = `win`/`over`),
  пауза с выходом.
- **Прогресс:** 12+ уровней (или бесконечный режим с растущей сложностью и счётчиком).
- **Экономика:** монеты за успех; магазин из 3 товаров (бустеры/апгрейды/скины), цены растут.
- **Реклама:** баннер в меню; interstitial между забегами (каждый 2-й); RV «×2 награда» и
  «продолжить/второй шанс». Награда строго в `onRewarded`.
- **Сохранения:** монеты, прогресс, рекорд — `E.storage`.
- **i18n:** RU/EN, все ключи, без мёртвых; строки только через `E.i18n.t`.
- **Capture-контракт:**
  - `?scene=menu|play`, `?wave=N` (уровень), `?mode=shop|win|over`, `?t=SEC`, `?freeze=1`,
    `?autoplay=1`, `?record=SEC`.
  - `getCaptureState()` → `{ scene:'menu'|'play', mode:'running'|'shop'|'win'|'over', level }`.
  - `setCaptureState(game, s)` для `shop/win/over`.
  - `freeze` — игра не тикает, кадр стабилен.
- **Autopilot:** при `E.capture.autoplay || E.capture.record > 0` игра сама делает ходы
  (простой жадный ИИ или готовое решение уровня) и не проигрывает во время записи
  (`record-safe`/авто-рестарт) — иначе видео будет стоять.
- **Ввод:** Pointer Events, тап/свайп; без скролла, зума, контекстного меню.
- **Логика:** фикс-шаг 1/60, `E.Rng`, `Math.random` в логике запрещён.
- **Ассеты:** ноль внешних URL, ноль файлов; арт и звук — код (WebAudio/Canvas).
- **Звук:** `E.audio.sfx/music`, mute в меню и паузе.
- **Раскладка:** 360×640, 390×844, 844×390, 1280×720, 720×1280. HUD-зоны не пересекаются,
  шрифты ≥12 px, кнопки ≥44 px, низ — `bannerInsetPx()`.
- **Пауза:** всегда с «Продолжить», «Заново», «В меню»; Escape/Back.
- **Консоль:** ноль ошибок — это красный гейт.

## capture.json

```json
{
  "variant": 101,
  "landscape": [
    { "name": "level_early", "q": "scene=play&wave=1&freeze=1", "expect": { "scene": "play", "mode": "running" } },
    { "name": "level_mid",   "q": "scene=play&wave=5&freeze=1", "expect": { "scene": "play", "mode": "running" } },
    { "name": "level_late",  "q": "scene=play&wave=9&freeze=1", "expect": { "scene": "play", "mode": "running" } },
    { "name": "level_final", "q": "scene=play&wave=12&freeze=1", "expect": { "scene": "play", "mode": "running" } }
  ],
  "portrait": [
    { "name": "level_early", "q": "scene=play&wave=1&freeze=1", "expect": { "scene": "play", "mode": "running" } },
    { "name": "level_mid",   "q": "scene=play&wave=5&freeze=1", "expect": { "scene": "play", "mode": "running" } },
    { "name": "level_late",  "q": "scene=play&wave=9&freeze=1", "expect": { "scene": "play", "mode": "running" } }
  ],
  "qa": [
    { "name": "menu",  "q": "scene=menu&freeze=1", "expect": { "scene": "menu" } },
    { "name": "shop",  "q": "scene=play&wave=5&mode=shop&freeze=1", "expect": { "scene": "play", "mode": "shop" } },
    { "name": "win",   "q": "scene=play&wave=4&mode=win&freeze=1", "expect": { "scene": "play", "mode": "win" } },
    { "name": "over",  "q": "scene=play&wave=6&mode=over&freeze=1", "expect": { "scene": "play", "mode": "over" } }
  ],
  "video": { "q": "autoplay=1&record=26&wave=5&seed=31", "seconds": 26 }
}
```
`variant` — уникальный (101..120). Все кадры с `freeze=1`; `expect` обязателен.

## Тексты

Лимиты: title ≤50, seo ≤160, short ≤70, about 100..1000, how_to_play 40..1000, keywords ≤100.
RU и EN — реальные переводы, не калька. В названии не должно быть «игра»/«game».

## manifest.json

```json
{ "id": "<slug>", "engine": "html5-canvas", "version": "1.0.0", "orientation": "any",
  "touch": true, "languages": ["ru","en"], "age": "6+",
  "categories": ["puzzle","casual"], "monetization": ["rewarded_video","interstitial","banner"],
  "iap": [], "leaderboards": [], "cloud_saves": true, "levels": 12 }
```

## Промо

`game/art.js` обязан отдать `A.promo(ctx, w, h, kind, rng, title)`:
иконка 512×512 **без текста** и обложка 800×470 (текст не обрезан). Промо — стилизованный
арт из твоих процедурных форм, не скриншот.

## Проверки (в своём worktree)

```bash
cd pipeline
node smoke.mjs ../games/<slug>
node capture-generic.mjs ../games/<slug> ../packages/<slug>/media ru,en
node pack.mjs ../games/<slug>
node audit.mjs ../games/<slug>
node testbed.mjs ../games/<slug>
node release-check.mjs ../games/<slug>
```

Зелёный результат: `smoke OK`, capture без ошибок, `pack OK`, `audit 0`, `testbed 48/48`,
`release-check 0`. Красное — чинить, не сдавать.

## Git

```
git add games/<slug> packages/<slug>
git commit -m "<slug>: игра v1.0 — <жанр>, медиа RU/EN, гейты зелёные"
git push origin game/<slug>
```

Только своя ветка. **Не мержи в main.** Не трогай чужие файлы, `pipeline/` (кроме своего
`capture.json` в игре), `engine/`, `docs/`.

## Отчёт

`slug`, ветка, жанр и отличие одной фразой, результаты гейтов, известные ограничения.
Не пиши «всё зелёное», если хоть один гейт красный.
