# Pipeline — HTML5 Game Factory

Полный конвейер сборки, валидации и подготовки HTML5-игр для Яндекс Игр.

## 6 Core Scripts (активные)

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `pack.mjs` | Сборка `game.zip` + валидация по `yandex-specs.md` | `../games/<slug>` | `../packages/<slug>/game.zip` + `CHECKLIST.md` |
| `capture-generic.mjs` | Универсальный захват медиа (иконка, обложки, скриншоты, видео) | `../games/<slug>` + `capture.json` | `../packages/<slug>/media/` (RU/EN) |
| `montage.mjs` | Монтаж 26–28с gameplay-ролика (early/mid/late/shop/icon) | `media/` кадры | `packages/<slug>/media/video-*.mp4` |
| `testbed.mjs` | Матрица viewport/DPR (8×3 = 24 комбинации) | `../games/<slug>` | `scratch/testbed/<slug>/` отчёты |
| `release-check.mjs` | Строгий релиз-гейт (zip hash, RGB, SDK contract, мёртвые ключи) | `../packages/<slug>` | Pass/fail + детальный отчёт |
| `audit.mjs` | Полный статический/рантайм/медиа/текстовый чек (0 issues = зелёный) | `../games/<slug>` или `--all` | Список issues или «0 issues» |

## Capture Contract

Каждая игра должна экспонировать `window.__capture` (см. `engine/capture.js`):

```js
window.__capture = {
  ready: boolean,
  renderOnce(),
  getState() → {scene, mode, score, coins, ...},
  setState({...}),
  step(n), pause(), resume(),
  video: {base64: '...'}   // webm из record=SEC
}
```

Активация только по whitelist-параметрам (`seed`, `scene`, `wave`, `record`, `lang`, `mute`, `banner` и др.). utm_* и payload игнорируются.

## Typical Release Flow

```bash
cd pipeline
node capture-generic.mjs ../games/<slug> ../packages/<slug>/media ru,en
node pack.mjs ../games/<slug>
node audit.mjs ../games/<slug>
node testbed.mjs ../games/<slug>
node release-check.mjs ../games/<slug>
```

## Chrome Configuration

См. `docs/CHROME.md` — все скрипты поддерживают `process.env.CHROME_PATH`.

## Environment Variables

- `CHROME_PATH` — путь к `chrome.exe` (fallback: `C:/Program Files/Google/Chrome/Application/chrome.exe`)
- `FFMPEG_PATH`, `FFPROBE_PATH` — опционально (если не в PATH)

## Deprecated / Removed

- `capture.mjs` — заменён на `capture-generic.mjs` + per-game `capture.json`
- Все скрипты с префиксом `_` и `debug-*` — удалены (экспериментальные/одноразовые)
- `promo-only.mjs`, `preview.mjs`, `balance-*` — удалены (не использовались)

## References

- `yandex-specs.md` — 157 требований Яндекса
- `RUBRIC.md` — 100-балльная шкала релизной готовности
- `README.md` — текущее состояние партий
