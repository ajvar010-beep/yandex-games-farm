# Chrome Configuration for Pipeline

Все 44 скрипта в `pipeline/` используют Puppeteer + Chrome для рендера и захвата медиа.

## Recommended Setup

1. Установите Google Chrome (обычная версия, не Canary/Dev).
2. Убедитесь, что Chrome доступен по одному из путей:
   - `C:/Program Files/Google/Chrome/Application/chrome.exe` (Windows default)
   - `%LOCALAPPDATA%/Google/Chrome/Application/chrome.exe`

## Environment Variable (Portable)

```bash
# PowerShell
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"

# CMD
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Git Bash / MSYS2
export CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
```

## Scripts Supporting CHROME_PATH

Все активные скрипты используют:
```js
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
```

Скрипты, обновлённые до env fallback:
- `audit.mjs`, `capture-generic.mjs`, `montage.mjs`, `release-check.mjs`, `testbed.mjs`, `smoke.mjs`
- 30+ `capture-*.mjs` (game-specific)

## Verification

```bash
node -e "console.log(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe')"
```

Если `audit --all` падает с `spawn ENOENT`, проверьте `CHROME_PATH`.

## Headless / CI

Puppeteer запускается с `--headless=new`. Для CI без GUI используйте:
```bash
CHROME_PATH=/usr/bin/google-chrome-stable
```

## Troubleshooting

- `ERR_LAUNCHER_NOT_INSTALLED` → установите Chrome или укажите `CHROME_PATH`
- `TimeoutError` на `capture-generic` → увеличьте `wait_seconds` в вызове или проверьте GPU/драйверы
- Чёрные скриншоты → отключите hardware acceleration в Chrome (`chrome://settings/system`)
