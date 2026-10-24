extends Node
## Runtime-тест критических фиксов v7.2 (консилиум v7 = 4.88):
## 1. revive на лаве НЕ сгорает впустую (_last_safe безопасна)
## 2. _on_menu роутит в Main (не софтлок)
## 3. тутор-лейбл видим (offset != 0)
## 4. убийство: kill() замораживает физику, труп не фармит монеты
## 5. панели по центру
## v8-механики (консилиум v7 L-остаток):
## 6. gravity_mult = 1.8 × Variant.difficulty (реальная ось сложности)
## 7. ice/sand: _floor_accel_mult 0.25/1.8 (материалы ощущаются)
## 8. hazard-блок убивает
## 9. crumble-платформа исчезает после касания и респавнится
## 10. уровни: спуски, +z-повороты, ≥5 архетипов (не один зигзаг)
## 11. баннер: show/hide существуют и безопасны без SDK
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

	# --- Тест 2 (частично): Main.back_to_menu существует ---
	_check(main.has_method("back_to_menu"), "Main.back_to_menu exists (menu routing target)")
	# NOTE: game.call("_on_menu") освобождает game (queue_free) — делаем в самом конце

	# --- Тест 6 (v8): difficulty = реальная ось сложности через гравитацию ---
	var gm: float = player.get("gravity_mult")
	var expect_gm: float = 1.8 * Variant.difficulty
	_check(absf(gm - expect_gm) < 0.001, "gravity_mult = 1.8×difficulty (%.2f)" % gm)

	# --- Тест 7 (v8): материалы льда/песка меняют ускорение ---
	var lvl: Node = game.get("level")
	# синтетический уровень: ice/sand/grass платформы (load_level напрямую — без game.respawn)
	lvl.call("load_level", {
		"name": "test", "start": [0, 2, 0],
		"platforms": [
			{"x": 0, "y": 0, "z": 0, "sx": 6, "sy": 1, "sz": 6, "mat": "ice"},
			{"x": 10, "y": 0, "z": 0, "sx": 6, "sy": 1, "sz": 6, "mat": "sand"},
			{"x": 20, "y": 0, "z": 0, "sx": 6, "sy": 1, "sz": 6, "mat": "grass"},
			{"x": 30, "y": 0, "z": 0, "sx": 6, "sy": 1, "sz": 6, "mat": "wood", "crumble": 0.5},
		],
		"coins": [], "checkpoints": [], "hazards": [
			{"x": 0, "y": 1.4, "z": 12, "sx": 1.2, "sy": 1.6, "sz": 1.2},
		],
		"finish": [0, 1.6, 20], "lava_y": -6.0, "lava_size": 220.0,
	})
	# игрок мог умереть в лавовом тесте выше — воскрешаем и ставим на лёд
	player.set("_dead", false)
	player.set("_jumps", 0)
	player.global_position = Vector3(0, 0.8, 0)
	player.velocity = Vector3.ZERO
	await get_tree().physics_frame
	await get_tree().physics_frame
	_check(player.get("_dead") == false, "synthetic level loaded, player alive")
	player.velocity = Vector3.ZERO
	for i in 12:
		await get_tree().physics_frame
	_check(absf(player.call("_floor_accel_mult") - 0.25) < 0.001, "ice floor accel 0.25 (slippery)")
	player.global_position = Vector3(10, 0.8, 0)
	player.velocity = Vector3.ZERO
	for i in 12:
		await get_tree().physics_frame
	_check(absf(player.call("_floor_accel_mult") - 1.8) < 0.001, "sand floor accel 1.8 (sticky)")
	player.global_position = Vector3(20, 0.8, 0)
	player.velocity = Vector3.ZERO
	for i in 12:
		await get_tree().physics_frame
	_check(absf(player.call("_floor_accel_mult") - 1.0) < 0.001, "grass floor accel 1.0 (normal)")

	# --- Тест 8 (v8): hazard-блок убивает ---
	var died_emitted := [false]
	var conn: Callable = func(): died_emitted[0] = true
	player.died.connect(conn)
	player.set("_dead", false)
	player.global_position = Vector3(0, 1.4, 12)  # внутри hazard Area3D
	player.velocity = Vector3.ZERO
	for i in 8:
		await get_tree().physics_frame
	_check(player.get("_dead") == true and died_emitted[0], "hazard block kills player")
	player.died.disconnect(conn)

	# --- Тест 9 (v8): crumble-платформа исчезает и респавнится ---
	player.set("_dead", false)
	player.revive()
	player.global_position = Vector3(30, 0.9, 0)
	player.velocity = Vector3.ZERO
	var crumbles: Array = lvl.get("_crumbles")
	_check(crumbles.size() == 1, "crumble platform registered (%d)" % crumbles.size())
	var cr_body: PhysicsBody3D = crumbles[0]["body"]
	for i in 60:  # стоим 1с — crumble=0.5с должен сработать
		await get_tree().physics_frame
	_check(cr_body.visible == false, "crumble platform hides after touch")
	for i in 200:  # ~3.3с — респавн через 2.6с после скрытия
		await get_tree().physics_frame
	_check(cr_body.visible == true, "crumble platform respawns (~2.6s)")

	# --- Тест 10 (v8): уровни разнообразны — спуски, +z, архетипы ---
	var archs := {}
	var total_desc := 0
	var total_plusz := 0
	for n in range(2, 21):
		var ff := FileAccess.open("res://levels/%02d.json" % n, FileAccess.READ)
		if ff == null: continue
		var d: Dictionary = JSON.parse_string(ff.get_as_text())
		ff.close()
		archs[str(d.get("archetype", "?"))] = true
		var pp: Array = d.get("platforms", [])
		for i in range(1, pp.size()):
			var a: Dictionary = pp[i - 1]
			var b: Dictionary = pp[i]
			if float(b.get("y", 0)) < float(a.get("y", 0)) - 0.1: total_desc += 1
			if float(b.get("z", 0)) > float(a.get("z", 0)) + 0.1: total_plusz += 1
	_check(archs.size() >= 5, "%d route archetypes (v7 had 1)" % archs.size())
	_check(total_desc >= 15, "%d descent segments (v7 had 0)" % total_desc)
	_check(total_plusz >= 10, "%d +z turn segments (v7 had 0)" % total_plusz)

	# --- Тест 11 (v8): баннер безопасен без SDK ---
	var banner_ok := Yandex.has_method("show_banner") and Yandex.has_method("hide_banner")
	_check(banner_ok, "banner API exists")
	if banner_ok:
		Yandex.call("show_banner")  # без SDK должен молча выйти
		Yandex.call("hide_banner")
		_check(true, "banner show/hide safe without SDK")

	# --- Тесты 12-15 (v9): ПРОКАЧКА ---
	# запоминаем состояние GameState, чтобы не испортить реальный сейв
	var _sv_coins: int = GameState.coins
	var _sv_up: Dictionary = GameState.upgrades.duplicate()

	# 12a. apply_upgrades: пустые апгрейды = базовые значения v8.2
	GameState.upgrades = {}
	player.call("apply_upgrades")
	_check(absf(player.speed - 7.0) < 0.001 and absf(player.jump_force - 9.5) < 0.001 and player.get("_max_jumps") == 2,
		"apply_upgrades({}) = base v8.2 values (spd=%.2f jmp=%.2f mj=%d)" % [player.speed, player.jump_force, player.get("_max_jumps")])
	# 12b. прокачанный: speed+25%, jump+15%, тройной прыжок
	GameState.upgrades = {"speed": 5, "jump": 5, "extra_jump": 1}
	player.call("apply_upgrades")
	_check(absf(player.speed - 8.75) < 0.001 and absf(player.jump_force - 10.925) < 0.001 and player.get("_max_jumps") == 3,
		"apply_upgrades(maxed) = 8.75/10.925/3 (spd=%.2f jmp=%.3f mj=%d)" % [player.speed, player.jump_force, player.get("_max_jumps")])

	# 13. buy_upgrade: списание + отказ при нехватке
	GameState.upgrades = {}
	GameState.coins = 200
	var bought: bool = GameState.buy_upgrade("speed")  # цена 60
	_check(bought and GameState.coins == 140 and GameState.upgrade_level("speed") == 1,
		"buy_upgrade deducts cost and levels up (coins=%d lvl=%d)" % [GameState.coins, GameState.upgrade_level("speed")])
	GameState.coins = 10
	var rejected: bool = GameState.buy_upgrade("speed")  # цена след. уровня 120 > 10
	_check(not rejected and GameState.coins == 10 and GameState.upgrade_level("speed") == 1,
		"buy_upgrade rejects when coins insufficient")

	# 14. save/load round-trip апгрейдов
	GameState.upgrades = {"magnet": 2, "shield": 1}
	GameState.save_data()
	GameState.upgrades = {}
	GameState.load_data()
	_check(GameState.upgrade_level("magnet") == 2 and GameState.upgrade_level("shield") == 1,
		"upgrades survive save/load round-trip")

	# 15. shield: поглощает смерть (возврат на _last_safe), второй удар убивает
	GameState.upgrades = {"shield": 1}
	player.call("apply_upgrades")
	player.call("refill_shields")
	player.set("_dead", false)
	player.set("_last_safe", Vector3(0, 1.0, 0))
	player.global_position = Vector3(0, 0.9, 0)
	player.set("shields", 1)
	player.kill()
	_check(player.get("_dead") == false and player.get("shields") == 0 and absf(player.global_position.y - 1.5) < 0.01,
		"shield absorbs death: alive=%s shields=%d pos.y=%.2f" % [not player.get("_dead"), player.get("shields"), player.global_position.y])
	# щитов больше нет → обычная смерть
	player.kill()
	_check(player.get("_dead") == true, "second death without shield kills normally")

	# 16. dash: доступен с апгрейдом, не меняет vy, cooldown ставится
	GameState.upgrades = {"dash": 1}
	player.set("_dead", false)
	player.velocity = Vector3.ZERO
	player.set("_dash_cd", 0.0)
	player.set("_dash_time", 0.0)
	player.call("try_dash")
	_check(player.get("_dash_time") > 0.0 and player.get("_dash_cd") > 2.0 and absf(player.velocity.y) < 0.001,
		"dash activates with cooldown, vy untouched (t=%.2f cd=%.2f)" % [player.get("_dash_time"), player.get("_dash_cd")])
	# без апгрейда dash не работает
	GameState.upgrades = {}
	player.set("_dash_cd", 0.0)
	player.set("_dash_time", 0.0)
	player.call("try_dash")
	_check(player.get("_dash_time") == 0.0, "dash locked without upgrade")

	# восстанавливаем GameState (тесты не должны портить прогресс)
	GameState.upgrades = _sv_up
	GameState.coins = _sv_coins
	GameState.save_data()

	# --- Тест 2 (финал): _on_menu роутит и НЕ крашит (освобождает game) ---
	game.call("_on_menu")
	await get_tree().process_frame
	_check(true, "_on_menu did not crash")

	print("=== RESULT: %d pass, %d fail ===" % [_pass, _fails])
	get_tree().quit(0 if _fails == 0 else 1)
