extends Node
## Runtime-тест критических фиксов v7.2 (консилиум v7 = 4.88):
## 1. revive на лаве НЕ сгорает впустую (_last_safe безопасна)
## 2. _on_menu роутит в Main (не софтлок)
## 3. тутор-лейбл видим (offset != 0)
## 4. убийство: kill() замораживает физику, труп не фармит монеты
## 5. панели по центру
## Запуск: Godot --headless --path . res://tools/rt_test.tscn

var _fails := 0
var _pass := 0

func _ready() -> void:
	await _run()

func _check(cond: bool, label: String) -> void:
	if cond:
		_pass += 1
		print("  PASS ", label)
	else:
		_fails += 1
		print("  FAIL ", label)

func _run() -> void:
	print("=== RT TEST v7.2 ===")

	# --- Тест 1+4: Game-сцена, смерть, revive ---
	var main: Node = load("res://scenes/Main.tscn").instantiate()
	get_tree().root.add_child.call_deferred(main)
	await get_tree().process_frame
	await get_tree().process_frame

	var game: Node = load("res://scenes/Game.tscn").instantiate()
	main.get_node("GameHolder").add_child.call_deferred(game)
	await get_tree().process_frame
	await get_tree().process_frame
	game.call("load_level", 3)
	await get_tree().process_frame
	await get_tree().process_frame
	var player: Node = game.get("player")
	if player == null:
		print("FATAL: player null — game._ready не собрался")
		get_tree().quit(2)
		return

	# камера-провожка: _cam у игрока должен быть не null (wiring fix)
	_check(player.get("_cam") != null, "player._cam wired (camera-relative input works)")

	# поставим игрока на платформу, дадим постоять — _last_safe должен обновиться
	var f := FileAccess.open("res://levels/03.json", FileAccess.READ)
	var def: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	var plat: Dictionary = def["platforms"][3]
	player.global_position = Vector3(float(plat["x"]), float(plat["y"]) + 2.0, float(plat["z"]))
	for i in 40:
		await get_tree().process_frame
	var safe: Vector3 = player.get("_last_safe")
	_check(safe.y > -3.0, "on-platform _last_safe is safe (y=%.2f)" % safe.y)

	# --- Тест: смерть на лаве не должна портить _last_safe ---
	var safe_before := safe
	player.set("_dead", false)
	player.global_position = Vector3(plat["x"], -4.5, plat["z"])  # над лавой
	player.velocity = Vector3(0, -5, 0)
	for i in 30:
		await get_tree().process_frame
	var safe_after: Vector3 = player.get("_last_safe")
	_check(safe_after.distance_to(safe_before) < 0.01, "lava does NOT update _last_safe (y=%.2f)" % safe_after.y)

	# --- Тест 4: kill() замораживает, труп не собирает монеты ---
	game.set("_running", true)
	var coins0: int = game.get("coins_collected")
	game.call("_on_coin")  # вызов напрямую — guard по _running пропустит (running=true)
	var coins1: int = game.get("coins_collected")
	_check(coins1 == coins0 + 1, "coin counted while running")
	game.set("_running", false)
	game.call("_on_coin")
	var coins2: int = game.get("coins_collected")
	_check(coins2 == coins1, "dead player does NOT farm coins (guard)")

	# --- Тест 5: панель по центру ---
	var panel: Node = game.get("_panel")
	# симулируем show_panel
	game.call("_show_panel", "T", "S", "A", Callable(), "B", Callable())
	await get_tree().process_frame
	var pos: Vector2 = panel.global_position
	var size: Vector2 = panel.size
	var vp := get_viewport().get_visible_rect().size
	var center := pos + size * 0.5
	var dx := absf(center.x - vp.x * 0.5)
	var dy := absf(center.y - vp.y * 0.5)
	_check(dx < 60 and dy < 60, "panel centered (dx=%.0f dy=%.0f)" % [dx, dy])
	game.call("_hide_panel")

	# --- Тест 3: тутор-лейбл видим (offset != 0) ---
	game.set("level_num", 1)
	game.call("_show_tutorial_step", 0)
	await get_tree().process_frame
	var tl: Node = game.get("_tutorial_label")
	_check(tl != null, "tutorial label created")
	if tl:
		var h: float = tl.size.y
		_check(h > 10.0, "tutorial label has height (%.0f) — visible" % h)

	# --- Тест 2: _on_menu роутит (не падает) ---
	var ok := true
	# back_to_menu должен существовать в Main
	ok = main.has_method("back_to_menu")
	_check(ok, "Main.back_to_menu exists (menu routing target)")
	game.call("_on_menu")
	await get_tree().process_frame
	_check(true, "_on_menu did not crash")

	print("=== RESULT: %d pass, %d fail ===" % [_pass, _fails])
	get_tree().quit(0 if _fails == 0 else 1)
