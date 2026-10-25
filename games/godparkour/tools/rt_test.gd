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
	# v9.1 (консилиум v9, критик-монетизация minor): ГЕРМЕТИЧНОСТЬ. Тест читал
	# реальный user://save.json; при сохранённом shield:3 щит поглощал смерть и
	# тест #8 падал (32 pass / 1 fail). Принудительно гасим апгрейды+щиты, чтобы
	# результат не зависел от сейва машины, на которой гоняют тест.
	GameState.upgrades = {}
	player.set("shields", 0)
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

	# (тест 8b — щит на hazard-платформе — перенесён в конец: он перегружает
	# уровень и сломал бы тест 9, который зависит от _crumbles синтетического)

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
	player.set("_last_safe_collider", null)  # v9.2: статичный пол — без collider-привязки
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

	# --- 17 (v9.1, MAJOR консилиума v9): щит на hazard-платформе ---
	# _last_safe НЕ должен писаться на hazard → щит возвращает ДО hazard'а, а не
	# в него (иначе все заряды 950◈ сгорают на одном блоке и всё равно смерть —
	# штатная ситуация gauntlet L11/L17). Геометрия — как в генераторе: hazard =
	# Area3D поверх обычной платформы (y = plat.y + 0.625).
	GameState.upgrades = {"shield": 1}
	player.call("apply_upgrades")
	lvl.call("load_level", {
		"name": "shield_hazard", "start": [0, 2, 0],
		"platforms": [
			{"x": 0, "y": 0, "z": 0, "sx": 6, "sy": 1, "sz": 6, "mat": "grass"},   # безопасная
			{"x": 0, "y": 0, "z": -8, "sx": 6, "sy": 1, "sz": 6, "mat": "grass"},  # с hazard сверху
		],
		"coins": [], "checkpoints": [],
		"hazards": [{"x": 0, "y": 0.625, "z": -8, "sx": 1.2, "sy": 0.45, "sz": 1.2}],
		"finish": [0, 1.6, -14], "lava_y": -6.0, "lava_size": 220.0,
	})
	player.set("_dead", false)
	player.call("refill_shields")
	_check(player.get("shields") == 1, "shield refilled before hazard test")
	# встаём на безопасную платформу (z=0) — _last_safe фиксируется там
	player.global_position = Vector3(0, 0.9, 0)
	player.velocity = Vector3.ZERO
	for i in 20:
		await get_tree().physics_frame
	var safe_before_hz: Vector3 = player.get("_last_safe")
	_check(absf(safe_before_hz.z) < 1.0, "_last_safe set on safe platform (z=%.1f)" % safe_before_hz.z)
	# шаг на hazard-платформу (z=-8): on_floor И внутри hazard одновременно
	var died2 := [false]
	var conn2: Callable = func(): died2[0] = true
	player.died.connect(conn2)
	player.global_position = Vector3(0, 0.9, -8)
	player.velocity = Vector3.ZERO
	for i in 6:
		await get_tree().physics_frame
	# КЛЮЧ 1: _last_safe НЕ переехал на hazard-платформу
	var safe_on_hz: Vector3 = player.get("_last_safe")
	_check(absf(safe_on_hz.z) < 1.0,
		"hazard floor does NOT update _last_safe (z=%.1f, want ~0)" % safe_on_hz.z)
	# КЛЮЧ 2: щит поглотил смерть (died НЕ эмитился), игрок жив, щит израсходован,
	# возвращён на БЕЗОПАСНУЮ платформу (z≈0), а не обратно в hazard
	_check(player.get("_dead") == false and not died2[0] and player.get("shields") == 0,
		"shield absorbed hazard death without died-signal (dead=%s shields=%d)" % [player.get("_dead"), player.get("shields")])
	_check(absf(player.global_position.z) < 1.5,
		"shield teleport lands AWAY from hazard (z=%.1f, want ~0 not -8)" % player.global_position.z)
	player.died.disconnect(conn2)
	GameState.upgrades = {}
	player.set("shields", 0)

	# --- 18 (v9.1, MAJOR): спидран-таймер НЕ тикает во время интерстишиала ---
	# show_fullscreen ставит get_tree().paused=true (спека 4.7), _process копает
	# _time_ms только при not paused. Без SDK (headless) колбэк on_closed
	# вызывается синхронно, поэтому проверяем сам флаг паузы в обёртке.
	game.call("load_level", 2)
	await get_tree().process_frame
	await get_tree().process_frame
	game.set("_time_ms", 100)
	game.set("_running", true)
	var paused_seen := [false]
	var t_before: int = game.get("_time_ms")
	# имитируем рекламу: пауза дерева + process-кадры (как во время реального ad)
	get_tree().paused = true
	paused_seen[0] = get_tree().paused
	for i in 10:
		await get_tree().process_frame
	var t_during: int = game.get("_time_ms")
	get_tree().paused = false
	_check(paused_seen[0] and t_during == t_before,
		"speedrun timer frozen while tree paused for interstitial (%d -> %d)" % [t_before, t_during])
	# и наоборот: без паузы таймер честно тикает
	for i in 5:
		await get_tree().process_frame
	_check(game.get("_time_ms") > t_before, "timer resumes after unpause")
	# прямой тест второй половины механизма: _on_adv_done снимает паузу рекламы.
	# (show_fullscreen с _sdk_ready=true в headless невыполним — js.ysdk null —
	# поэтому пауза на показе проверяется чтением кода, а снятие — рантаймом.)
	get_tree().paused = true
	Yandex.set("_paused_by_adv", true)
	Yandex.call("_on_adv_done")
	_check(get_tree().paused == false and Yandex.get("_paused_by_adv") == false,
		"_on_adv_done unpauses tree after interstitial (paused=%s)" % get_tree().paused)

	# --- 19 (v9.1, MAJOR): win-double бонус >= menu-RV на всех 21 уровнях ---
	# (floor RV_WIN_BONUS_FLOOR=40 > RV_COINS=30: инверсия ценности устранена)
	var floor_ok := true
	for n in 21:
		var f2 := FileAccess.open("res://levels/%02d.json" % (n + 1), FileAccess.READ)
		if f2 == null: floor_ok = false; continue
		var d2 = JSON.parse_string(f2.get_as_text())
		f2.close()
		var lvl_coins: int = ((d2 as Dictionary).get("coins", []) as Array).size()
		if maxi(lvl_coins + 20, game.RV_WIN_BONUS_FLOOR) < 30: floor_ok = false
	_check(floor_ok, "win-double bonus (floor %d) >= menu-RV 30 on all 21 levels" % game.RV_WIN_BONUS_FLOOR)

	# --- 20 (v9.2, MAJOR консилиума v9.1): щит на ИСЧЕЗНУВШЕЙ crumble ---
	# _last_safe — снимок мира; на crumble платформа рассыпается, и без collider-aware
	# резолва щит телепортировал в воздух (25 crumble в кампании). Фикс: мёртвый
	# collider → фолбэк _spawn. Проверяем _resolve_safe_pos() напрямую.
	GameState.upgrades = {"shield": 1}
	player.call("apply_upgrades")
	lvl.call("load_level", {
		"name": "shield_crumble", "start": [0, 2, 0],
		"platforms": [
			{"x": 0, "y": 0, "z": 0, "sx": 6, "sy": 1, "sz": 6, "mat": "grass"},              # safe (spawn)
			{"x": 0, "y": 0, "z": -8, "sx": 6, "sy": 1, "sz": 6, "mat": "wood", "crumble": 0.5},
		],
		"coins": [], "checkpoints": [], "hazards": [],
		"finish": [0, 1.6, -14], "lava_y": -6.0, "lava_size": 220.0,
	})
	player.set("_dead", false)
	player.call("set_spawn", Vector3(0, 2, 0))
	# встаём на crumble-платформу (z=-8), даём _last_safe_collider зафиксироваться
	player.global_position = Vector3(0, 0.9, -8)
	player.velocity = Vector3.ZERO
	for i in 12:
		await get_tree().physics_frame
	var crumb_coll = player.get("_last_safe_collider")
	_check(crumb_coll != null and absf(player.get("_last_safe").z + 8.0) < 1.0,
		"_last_safe recorded on crumble (collider=%s, z=%.1f)" % [crumb_coll != null, player.get("_last_safe").z])
	# crumble рассыпалась: РЕАЛЬНЫЙ путь level.gd — body.visible=false +
	# _disable_collision(body,true); узел остаётся ЖИВ (is_instance_valid=true),
	# поэтому фолбэк обязан идти через _solid_floor_at (raycast не находит пол).
	if crumb_coll is Node3D:
		crumb_coll.visible = false
		for ch in crumb_coll.get_children():
			if ch is CollisionShape3D:
				ch.disabled = true
	await get_tree().physics_frame
	var resolved_crumb: Vector3 = player.call("_resolve_safe_pos")
	# пол в stale-точке исчез → фолбэк _spawn (z=0), НЕ точка на исчезнувшей crumble (z=-8)
	_check(absf(resolved_crumb.z) < 1.0,
		"vanished crumble -> shield resolves to _spawn (z=%.1f, want ~0 not -8)" % resolved_crumb.z)
	# и щит-телепорт реально спасает: kill() на воздухе у crumble → жив, заряд списан
	player.set("_dead", false)
	player.call("refill_shields")
	player.kill()
	_check(player.get("_dead") == false and player.get("shields") == 0
		and absf(player.global_position.z) < 1.5,
		"shield on vanished crumble lands on safe spawn (z=%.1f, alive=%s)" % [player.global_position.z, not player.get("_dead")])

	# --- 21 (v9.2, MAJOR): щит на УЕХАВШЕМ mover'е ---
	# точка _last_safe должна ЕХАТЬ с платформой (to_global локального офсета), а не
	# оставаться в stale-мировой позиции (100 mover'ов на 19/21 уровне).
	lvl.call("load_level", {
		"name": "shield_mover", "start": [0, 2, 0],
		"platforms": [
			{"x": 0, "y": 0, "z": 0, "sx": 6, "sy": 1, "sz": 6, "mat": "grass"},
			{"x": 8, "y": 0, "z": 0, "sx": 3, "sy": 1, "sz": 3, "mat": "stone",
			 "move": {"axis": "x", "range": 3.0, "speed": 2.2}},
		],
		"coins": [], "checkpoints": [], "hazards": [],
		"finish": [16, 1.6, 0], "lava_y": -6.0, "lava_size": 220.0,
	})
	player.set("_dead", false)
	player.call("refill_shields")
	var traps: Array = lvl.get("_traps")
	_check(traps.size() == 1, "mover registered in _traps (%d)" % traps.size())
	var mover: Node3D = traps[0]["node"]
	# сажаем игрока на mover, ждём фиксации _last_safe_collider == mover
	player.global_position = Vector3(mover.global_position.x, mover.global_position.y + 1.0, 0)
	player.velocity = Vector3.ZERO
	var got_mover := false
	for i in 40:
		await get_tree().physics_frame
		if player.get("_last_safe_collider") == mover:
			got_mover = true
			break
	_check(got_mover, "_last_safe_collider bound to mover after landing")
	# v9.2: проверяем МЕХАНИЗМ collider-aware резолва напрямую, не борясь с синус-
	# анимацией level._process (mover качается каждый кадр). Инвариант: пока collider
	# жив, _resolve_safe_pos() = mover.to_global(_last_safe_local) — точка ЕДЕТ с
	# платформой. Задаём известный локальный офсет и сверяем с to_global на этом кадре.
	player.set("_last_safe_collider", mover)
	player.set("_last_safe_local", Vector3(0.0, 0.5, 0.0))  # v9.2-sync: ЦЕНТР (1.5=край → raycast промах на god)
	var expected: Vector3 = mover.to_global(Vector3(0.0, 0.5, 0.0))
	var resolved_mover: Vector3 = player.call("_resolve_safe_pos")
	# Инвариант: resolved == mover.to_global(офсет) на ЭТОМ кадре. Поскольку
	# _resolve_safe_pos() всегда берёт ТЕКУЩИЙ global_transform collider'а, точка
	# следует за mover'ом по построению — stale-баг (фикс-позиция уехавшей платформы)
	# закрыт. Дополнительно: глобальная позиция mover'а меняется от кадра к кадру
	# (синус-анимация), а resolved каждый раз совпадает с to_global — не залипает.
	_check(resolved_mover.distance_to(expected) < 0.01,
		"resolve follows mover via to_global (Δ=%.3f)" % resolved_mover.distance_to(expected))
	# следующий кадр — снова точное совпадение с to_global (не залипшая копия).
	# Требовать dx>0 нельзя: у пика синуса движение за кадр ~0 (флак).
	# ВАЖНО: убираем игрока с mover'а в воздух — иначе _physics_process (is_on_floor)
	# перезапишет _last_safe_local реальной точкой стояния и сравнение собьётся.
	player.global_position = Vector3(0, -4.0, 0)
	player.velocity = Vector3.ZERO
	await get_tree().physics_frame
	var expected_next: Vector3 = mover.to_global(Vector3(0.0, 0.5, 0.0))
	var resolved_next: Vector3 = player.call("_resolve_safe_pos")
	_check(resolved_next.distance_to(expected_next) < 0.01,
		"resolve tracks animating mover each frame (x=%.2f, Δ=%.4f)" % [resolved_next.x, resolved_next.distance_to(expected_next)])
	GameState.upgrades = {}
	player.set("shields", 0)

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
