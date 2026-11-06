---
name: godot-web-game
description: Производство 3D-игр на Godot 4.7.2 с Web-экспортом под Яндекс Игры — сборка вариантов, headless-тесты rt/smoke, запись геймплея, иконка и тема, уровни из JSON. Использовать при работе с games/parkourpro, nubikparkour, godparkour, hackerparkour, mineridle; при экспорте в HTML5, починке Web-сборки, съёмке медиа из Godot.
---

# Godot 4.7.2 → Web (Яндекс Игры)

Вторая линия фабрики: 3D-игры. Движок портативный, лежит в репозитории, ставится не требуется.

```
engines/godot/Godot_v4.7.2-stable_win64.exe           — редактор/рантайм
engines/godot/Godot_v4.7.2-stable_win64_console.exe   — то же, с выводом в stdout (для headless)
engines/godot/templates.tpz                           — экспортные шаблоны (обязательны для Web)
games/<slug>/                                         — один проект = одна папка
  project.godot  export_presets.cfg  scenes/  scripts/  assets/  levels/  tools/  export/
```

Версия строго 4.7.2: проект, открытый другой версией, переписывает `project.godot` и ломает
Web-шаблоны. Всегда вызывать бинарник по полному пути из репозитория.

## Структура проекта

| Файл | Роль |
|---|---|
| `scripts/main.gd` | корень, роутинг сцен меню/игра |
| `scripts/game.gd`, `game_state.gd` | забег и состояние (монеты, чекпоинты, прогресс) |
| `scripts/player.gd` | управление и физика персонажа |
| `scripts/level.gd`, `levels/*.json` | уровни данными, не сценами |
| `scripts/variant.gd` | `@export`-конфиг серии (id, title, difficulty) |
| `scripts/yandex.gd` | SDK: реклама, сохранения, язык |
| `tools/*.gd` | съёмка, тесты, иконка, тема, запись видео |

## Сборка

```bash
export GODOT="C:/GameFactory/engines/godot/Godot_v4.7.2-stable_win64_console.exe"
cd games/<slug>
"$GODOT" --headless --export-release "Web" "export/web/index.html"
```

`export_presets.cfg` → пресет `Web`, `variant/thread_support=false` (без SharedArrayBuffer:
у площадки нет COOP/COEP). Вывод — `export/web/` (`index.html` + `.wasm` + `.pck`); в ZIP
кладётся содержимое этой папки, `index.html` в корне.

Серия из одной кодовой базы (Нуб/Про/Бог):

```bash
node tools/build_variants.cjs   # правит variant.gd → экспорт в export/web_<id> → возвращает файл
```

Скрипт обязан вернуть `variant.gd` в исходное состояние (он это делает) — проверять `git diff`
после сборки.

## Тесты (обязательны перед пакетом)

```bash
"$GODOT" --headless --path . res://tools/rt_test.tscn       # рантайм: exit 0 = всё зелёное
"$GODOT" --headless --path . --script res://tools/smoke_test.gd  # уровни: JSON и проходимость
```

- `rt_test` проверяет фиксы, которые уже ломались: revive на лаве, софтлок меню, тутор,
  заморозка физики на смерти, центрирование панелей, ощущение материалов пола, hazard-блоки,
  crumble-платформы, разнообразие уровней, безопасные вызовы баннера без SDK.
- `smoke_test` — каждый `levels/*.json` валиден и проходим по длине прыжка без читов.
- Новый фикс → новый пункт в `rt_test`. Тест без пункта = фикс вернётся.

## Медиа изнутри игры

```bash
"$GODOT" --headless --path . res://tools/capture_shots.tscn    # экраны RU/EN, ландшафт/портрет
"$GODOT" --headless --path . res://tools/record_gameplay.tscn  # видео геймплея
"$GODOT" --headless --path . --script res://tools/make_icon.gd # иконка 512×512
"$GODOT" --headless --path . --script res://tools/make_theme.gd
node tools/make_thumb.cjs                                      # миниатюра серии
node tools/gen_levels.cjs                                      # генерация уровней
```

Рендер идёт в headless — кадр берётся из viewport, а не из окна: проверять результат глазами,
headless не гарантирует тот же свет и тот же ракурс, что в браузере.

## Требования площадки для Godot

1. Никаких сетевых запросов; SDK — через `yandex.gd`, без `HTTPRequest`.
2. Сохранения — `user://` (в Web это IndexedDB), кошелёк один.
3. Тач: управление дублируется экранными зонами, не только WASD; портрет и ландшафт.
4. Пауза по потере фокуса; Back/Escape ведёт в меню, а не в пустоту.
5. Размер Web-сборки — держать в пределах площадки: текстуры импортировать с VRAM-сжатием
   под desktop/mobile, лишние исходники не тащить в экспорт.
6. `LoadingAPI.ready()` — после того как стартовая сцена реально готова.

## Частые поломки

- Экспорт «пустой экран» → забыты шаблоны (`templates.tpz`) или threads включены.
- Тест не запускается → путь `res://tools/...` при `--path .`, не относительный.
- Диффы после сборки вариантов → скрипт не восстановил `variant.gd`.
- Телефон не видит кнопки → хитбоксы меньше 44pt или HUD за баннером.
