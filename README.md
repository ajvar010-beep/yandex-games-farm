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

## Пайплайн отбора новых игр

1. Концепт в жанре из топов каталога (см. research/).
2. Сборка на движке + медиа + тексты RU/EN.
3. Консилиум: 10 независимых оценщиков, взвешенный балл (механика 30 / вайб 25 / монетизация 20 / реализация 25). ≥8.0 — в публикацию.
