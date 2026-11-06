# Яндекс Игры — Ферма

Производство HTML5-игр (Canvas, vanilla JS, ноль внешних зависимостей) под публикацию в каталоге Яндекс Игр (гео RU+EN, монетизация рекламой РСЯ).

## Структура

```
engine/     — движок: core (цикл/сцены), capture-хуки, sdk, i18n, audio, ui, fx, storage, rng
games/      — исходники игр (по папке на игру: index.html + game/*.js + sdk-stub.js)
pipeline/   — конвейер: pack.mjs (сборка zip+валидация), capture-<game>.mjs (медиа),
              montage.mjs (монтаж gameplay-ролика), audit.mjs (полный баг-чек)
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

## Текущая партия (10 игр, v1.1, pack --check ×10)

hexwave · mergemon · skyblocks · starfall · bubblebay · sweettower · gingerdash · pizzaspin · fireflygrove · cloudherder

## Партия 2026-11 (по свежему скану рынка)

| игра | жанр | статус |
|---|---|---|
| **mergesweets** «Слияние Суфле» v2 | merge-физика | штыри, переменный стакан, комбо, очередь; пакет+медиа, строгий гейт 0 |
| **arrowescape** «Побег Стрелок» v2 | стрелки-пазл | ящики, лёд, темы, сундук, детерминированные уровни; пакет+медиа, гейт 0 |

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

