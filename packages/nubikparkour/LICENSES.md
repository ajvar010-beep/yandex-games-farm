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

## Шрифты
- Используются системные шрифты ОС (через Godot default font — Noto Sans, OFL). В файл пакета не вшиваются.

## Планируемые (опционально, для v1.1)
Если добавим внешние ассеты — только CC0/MIT с указанием здесь:
- Kenney.nl (Blocky Characters, Platformer Kit) — CC0
- Quaternius — CC0
- ambientCG — CC0
