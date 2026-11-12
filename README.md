# Яндекс Игры — Ферма

Производство HTML5-игр (Canvas, vanilla JS, ноль внешних зависимостей) под публикацию в каталоге Яндекс Игр (гео RU+EN, монетизация рекламой РСЯ). С 2026-11-10 — **кросс-платформенно**: тот же билд публикуется на Яндекс Играх (рубли), VK Играх (рубли) и GameMonetize (USDT) без правок игр.

## Платформы (кросс-публикация, 2026-11-10)

Единый `engine/sdk.js` — диспетчер: `engine/platform.js` по домену определяет площадку и подключает её SDK, адаптеры `engine/platform/{vk,gamemonetize}.js` приводят её к контракту ysdk. Игровые сцены платформу не видят. Подробнее — `docs/SESSION-2026-11-10.md`, карта площадок с монетизацией в РФ — память `gamefactory-platforms-rf`.

## Структура

```
engine/     — движок: core (цикл/сцены), capture-хуки, sdk (диспетчер), platform.js +
              platform/{vk,gamemonetize}.js (адаптеры), i18n, audio, ui, fx, storage, rng
games/      — исходники игр (по папке на игру: index.html + game/*.js + sdk-stub.js)
pipeline/   — конвейер: pack.mjs (сборка zip+валидация), capture-<game>.mjs (медиа),
              montage.mjs (монтаж gameplay-ролика), audit.mjs (полный баг-чек),
              _xplat_rollout.mjs (раскатка кросс-слоя на index.html), _webrecon.mjs
              (веб-разведка через локальный Chrome, когда WebSearch/WebFetch недоступны)
packages/   — готовые к загрузке пакеты: game.zip + media/ (иконка, обложка, скриншоты,
              видео RU/EN) + texts/ (5 полей × 2 языка) + CHECKLIST.md
docs/       — спецификация требований Яндекса (157 пунктов), гайды по сабмишну
skills/     — внешние скиллы-референсы (отобраны и проверены вручную)
research/   — исследование топов каталога, выбор жанров, вердикты консилиума
```

## Правила сборки

- Никаких внешних сетевых запросов в рантайме (треб. 1.7); `<script src="/sdk.js">` подключается
  только на http/https (на file:// работает заглушка).
- Capture-контракт: `window.__capture = { ready, setScene, setState, getState, step, renderOnce, ... }`,
  активация только whitelisted URL-параметрами (seed/scene/wave/score/coins/mode/t/freeze/manual/autoplay/record/lang/mute/banner).
- Пакет: `cd pipeline && node pack.mjs ../games/<name>` → `packages/<name>/game.zip` + `--check`.
- Аудит перед сабмишном: `node audit.mjs --all` (0 issues — зелёный свет).

## Партия-4: 10 игр — состояние на 2026-11-07 (после команды «стоп»)

Все 10 собраны, упакованы и лежат в `main` (ветки `game/<slug>` смержены,
worktrees `C:/gf-wt/<slug>` можно удалять). У каждой игры есть
`games/<slug>/` (index.html + `game/*.js` + `engine/`) и `packages/<slug>/`:
`game.zip`, медиа RU/EN (4 landscape + 3 portrait + qa), два видео,
иконка 512×512, обложки 800×470, тексты 5 полей × 2 языка, `CHECKLIST.md`.

| slug | название | жанр | RUBRIC | вердикт |
|---|---|---|---|---|
| pulseref | Пульс | ритм-аркада | 87 | PUBLISH |
| mazeheart | Сердце Лабиринта | лабиринт | 86 | PUBLISH |
| pindrop | Гвозди | шпильки/шары | 86 | PUBLISH |
| pipes | Трубы | поворот труб | 85 | PUBLISH |
| pixelcode | Пиксель-Код | нонограмма | 85 | PUBLISH |
| lightout | Свет-Плитки | свет-плитки | 85 | PUBLISH |
| cannonball | Ядро | баллистика | 85 | PUBLISH |
| slide15 | Латунный Порядок | пятнашки | 86 | PUBLISH |
| wordgrid | Слово-Сетка | поиск слов | 85 | PUBLISH |
| dominochain | Домино-Цепь | домино-цепь | 87 | PUBLISH |

**Гейты** (по каждой после последней правки): `smoke` OK, `capture-generic`
пересъёмка, `pack` OK, `audit` 0 issues, `testbed` 48/48, `release-check` 0.
Сплошной прогон: `audit` 10/10. Рабочее дерево чистое, `main` = `origin/main`.

**Пересчёт завершён 2026-11-12**: slide15 83→**86**, wordgrid 84→**85**,
dominochain 84→**87** (добавлены механики уровней: заморозка 5-8, золотые дубли 9-12,
минимальные шрифты до 12px). Партия-4: **10/10 PUBLISH**.

**Что осталось**
1. **Ручная выкладка** по `packages/<slug>/CHECKLIST.md`. Первый кандидат по
   совокупности балла и контента — **pulseref** (87, 8 песен + 4 энкора) или
   **dominochain** (87). Для массового casual — pindrop (86) или mazeheart (86).
2. **Товар `no_ads`** создать в консоли Яндекса: wordgrid и pixelcode
   (манифесты уже содержат `iap: ["no_ads"]`); на живом SDK покупка не
   проверялась, только заглушка.

**Как продолжить после сброса сессии**
```bash
cd pipeline
node capture-generic.mjs ../games/<slug> ../packages/<slug>/media ru,en
node pack.mjs ../games/<slug>
node audit.mjs ../games/<slug>
node testbed.mjs ../games/<slug>
node release-check.mjs ../games/<slug>
```
Полный разбор правок и оценок — `docs/BATCH-4-REPORT.md`. Контекст партии —
`market/play-batch-2026-11-07.md` (Play был недоступен, жанры по скану
Яндекса) и память проекта `gamefactory-batch4.md`.

**Идея автоматизации выкладки** (не реализована): подключиться к уже
авторизованному Chrome через `--remote-debugging-port=9222` + `connectOverCDP`,
заполнять форму консоли и загружать файлы из `packages/<slug>/`, финальную
кнопку «на модерацию» оставлять человеку. Скрипт `pipeline/console-upload.mjs`
не создан.

## Текущая партия (10 игр, v1.1, pack --check ×10)

hexwave · mergemon · skyblocks · starfall · bubblebay · sweettower · gingerdash · pizzaspin · fireflygrove · cloudherder

## Партия 2026-11 (по свежему скану рынка)

| игра | жанр | статус |
|---|---|---|
| **mergesweets** «Слияние Суфле» v2 | merge-физика | штыри, переменный стакан, комбо, очередь; пакет+медиа, строгий гейт 0 |
| **parkingescape** «Побег с Парковки» | парковочный пазл | машины/колонны, блоки, снег, эвакуатор; пакет+медиа, гейт 0 |
| **arrowescape** «Побег Стрелок» v2 | стрелки-пазл (прототип) | ящики, лёд, темы; механика перенесена в parkingescape |

Релизный гейт: `audit.mjs` (0/22) + `testbed.mjs` (48/48) + `release-check.mjs`
(zip==исходники, свежие RGB-медиа, manifest↔код, мёртвые ключи, реальные клики, пауза/Back).

Отдельно (Godot, партия-3): parkourpro · mineridle · hackerparkour.

## Пайплайн отбора новых игр

1. Скан рынка → `market/scan-YYYY-MM.md` (живой fetch `yandex.ru/games` + `/category/new`).
2. Жанр по `genres.md` (что брать/не брать), тема по правилу иконки 128×128.
3. `games/<слаг>/CHOICE.md` (жанр, тема, 3 подтверждения из топа, отличие одним предложением)
   и `SPEC.md` (цикл, очки, проигрыш, мета, реклама).
4. Сборка на движке + медиа + тексты RU/EN; `node pipeline/pack.mjs ../games/<slug>`.
5. **Независимая оценка по `RUBRIC.md`** (свежий контекст, другая модель): ≥85/100 —
   в отправку; ниже — правится только слабейший блок.
6. `node pipeline/audit.mjs ../games/<slug>` → 0 issues; `testbed.mjs` → 48/48;
   `release-check.mjs` → 0 (zip==исходники, свежие медиа, нет мёртвых ключей/кирпичей);
   затем ZIP из `packages/<slug>/`.

Порог 8.0 консилиума (партия-2) заменён релизным порогом RUBRIC ≥85: он учитывает
монетизацию и модерацию, а не только «весело ли».

## Аудит и чистка 2026-11-08

Полный аудит (игры + pipeline + скиллы) завершён. Исправлено:

- **P0:** `pipeline/audit.mjs` — добавлен `process.env.CHROME_PATH` fallback (ранее жёсткий путь).
- **P1:** Удалены 16 debug/legacy скриптов (`debug-*`, `_*`, `capture.mjs`, `promo-only.mjs` и др.). Созданы `docs/pipeline.md` и `docs/CHROME.md`.
- **P2:** `scratch/` (1.5 ГБ) архивирован в `.trash/scratch/`. Оставлены только `assets/` (CC0) и `play-scout/` (разведка). 6 orphaned пакетов (`blockfit`…`sudokulite`) задокументированы в `docs/orphaned-packages.md`.
- **P3:** Удалены 49 orphaned скиллов (`skills/` + 11 Blender из `~/.claude/skills/`). Ложное утверждение `full-team:*` (147/27) исправлено в `memory/gamefactory-ecc-skills.md`.

Текущее состояние: 36 HTML5-игр + 5 Godot-прототипов, 40 пакетов, pipeline чистый, 0 активных скиллов.

