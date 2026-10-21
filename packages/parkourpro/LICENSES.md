# LICENSES — «Про Паркур»

## Движок
- **Godot Engine 4.7.2** — MIT License. https://godotengine.org/license
  Используется как runtime (Web export). Исходный код не модифицирован.

## Код игры
- Весь GDScript-код (scripts/*.gd) — собственная разработка, CC0.
- Уровни (levels/*.json) — генерируются процедурно, CC0.

## Ассеты
- Все 3D-модели и текстуры — **процедурные** (генерируются кодом в рантайме: BoxMesh/CylinderMesh/TorusMesh + StandardMaterial3D). Внешних ассетов нет.
- Звуки — процедурные (AudioStreamWAV, генерируются кодом). Внешних аудио нет.

## Шрифты (вшиваются в пакет, assets/fonts/)
- **Noto Sans** (NotoSans-Regular.ttf) — SIL Open Font License 1.1. https://fonts.google.com/noto/specimen/Noto+Sans. Кириллица + латиница.
- **Noto Sans Symbols 2** (NotoSansSymbols2-Regular.ttf) — SIL Open Font License 1.1. https://fonts.google.com/noto/specimen/Noto+Sans+Symbols+2. Глифы ★☆◈✓▶🔒📺🎖⭕🏆 и пр.
- Подключаются через ThemeDB.set_fallback_font (GameState._setup_fonts) с fallback-цепочкой: основной Noto Sans → Symbols 2.

## Медиа (packages/<id>/media/)
- cover.png (800×470), icon.png (512×512), thumb_series.png — процедурная SVG-графика (games/parkourpro/tools/make_thumb.cjs), собственная разработка, CC0.
- screenshot_landscape_*.png — скриншоты игрового процесса (Godot capture, tools/capture_shots.gd), CC0.
- gameplay_landscape.mp4 — смонтированное видео геймплея (Godot Movie Maker + ffmpeg), CC0.

## Офисные лицензии шрифтов
Полные тексты OFL 1.1 — https://openfontlicense.org/

## Планируемые (опционально, для v1.1)
Если добавим внешние ассеты — только CC0/MIT с указанием здесь:
- Kenney.nl (Blocky Characters, Platformer Kit) — CC0
- Quaternius — CC0
- ambientCG — CC0
