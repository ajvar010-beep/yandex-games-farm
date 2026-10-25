extends Node
## КРИТИК-ПРОБА L:
## L1: TANK-ПРОГОН gauntlet L11/L17 с 3 щитами — сколько смертей переживается,
##     не становится ли щит имбой (прохождение «в лицо» hazard'ам).
## L2: валидация ФИКСА edge-standing: capsule-aware (5-ray) vs zero-ray.
## L3: аномалия L17 worst_over=19.75 — что за collider.
## L4: регресс — щит НЕ должен спасать от повторного падения в ту же лаву бесконечно.

var _fails := 0
var _pass := 0

func _check(cond: bool, label: String) -> void:
	if cond:
		_pass += 1
		print("  PASS ", label)
	else:
		_fails += 1
		print("  FAIL ", label)

func _capsule_solid(player: Node, p: Vector3) -> bool:
	var sp: PhysicsDirectSpaceState3D = player.get_world_3d().direct_space_state
	for off in [Vector3.ZERO, Vector3(0.3, 0, 0), Vector3(-0.3, 0, 0), Vector3(0, 0, 0.3), Vector3(0, 0, -0.3)]:
		var q: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(p + off + Vector3.UP * 0.3, p + off - Vector3.UP * 1.7)
		q.exclude = [player.get_rid()]
		q.collide_with_areas = false
		q.collide_with_bodies = true
		var hit: Dictionary = sp.intersect_ray(q)
		if not hit.is_empty():
			var c = hit.get("collider")
			if c is Node and c.is_in_group("lava"):
				continue
			return true
	return false

func _ready() -> void:
	await _run()

func _run() -> void:
	print("=== PROBE L ===")
	GameState.no_ads = true
	GameState.coins = 0
	var main: Node = load("res://scenes/Main.tscn").instantiate()
	get_tree().root.add_child.call_deferred(main)
	await get_tree().process_frame
	await get_tree().process_frame
	var game: Node = load("res://scenes/Game.tscn").instantiate()
	main.get_node("GameHolder").add_child.call_deferred(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var player: Node = game.get("player")
	var lvl: Node = game.get("level")

	# ---------- L1: TANK-ПРОГОН gauntlet ----------
	print("-- L1: tank-run gauntlet L11 with 3 shields: walk INTO every hazard --")
	for n in [11, 17]:
		game.call("load_level", n)
		await get_tree().process_frame
		await get_tree().process_frame
		GameState.upgrades = {"shield": 3}
		player.call("apply_upgrades")
		player.call("refill_shields")
		var df := FileAccess.open("res://levels/%02d.json" % n, FileAccess.READ)
		var def: Dictionary = JSON.parse_string(df.get_as_text())
		df.close()
		var hzs: Array = def.get("hazards", [])
		var survived := 0
		var died_at := -1
		var total_shields_burned := 0
		for hi in hzs.size():
			var h: Dictionary = hzs[hi]
			# даём игроку встать на пол перед hazard (чтобы _last_safe был валиден)
			var plats: Array = def["platforms"]
			var near_idx := 0
			var bd := 1e9
			for i in plats.size():
				var q: Dictionary = plats[i]
				var dd: float = Vector2(float(q["x"]) - float(h["x"]), float(q["z"]) - float(h["z"])).length()
				if dd < bd:
					bd = dd; near_idx = i
			var qp: Dictionary = plats[near_idx]
			player.set("_dead", false)
			player.global_position = Vector3(float(qp["x"]), float(qp["y"]) + 0.5, float(qp["z"]))
			player.velocity = Vector3.ZERO
			for i in 30:
				await get_tree().physics_frame
			var sh_before: int = player.get("shields")
			# входим В hazard
			player.global_position = Vector3(float(h["x"]), float(h["y"]) + 0.6, float(h["z"]))
			player.velocity = Vector3.ZERO
			await get_tree().physics_frame
			await get_tree().physics_frame
			await get_tree().physics_frame
			if player.get("_dead") == false:
				survived += 1
				total_shields_burned += sh_before - player.get("shields")
			else:
				died_at = hi
				break
		print("   L%d: %d hazards, tanked %d before death (hazard #%d), shields burned %d" % [
			n, hzs.size(), survived, died_at, total_shields_burned])
		_check(survived <= 3, "3 shields tank at most 3 hazards (not an imba: %d)" % survived)
		_check(survived >= 1, "shield is USEFUL: tanks at least 1 hazard")

	# ---------- L2: валидация фикса ----------
	print("-- L2: fix validation — capsule-aware 5-ray vs current zero-ray --")
	game.call("load_level", 17)
	await get_tree().process_frame
	await get_tree().process_frame
	GameState.upgrades = {"shield": 3}
	player.call("apply_upgrades")
	player.call("refill_shields")
	var df17 := FileAccess.open("res://levels/17.json", FileAccess.READ)
	var def17: Dictionary = JSON.parse_string(df17.get_as_text())
	df17.close()
	var plats17: Array = def17["platforms"]
	var tested := 0
	var zero_fail := 0
	var caps_fix := 0
	for i in plats17.size():
		var q: Dictionary = plats17[i]
		if q.has("move") or q.has("crumble"): continue
		var half_x: float = float(q.get("sx", 2)) * 0.5
		if half_x > 0.8: continue
		for frac in [1.05, 1.15, 1.25]:
			var base := Vector3(float(q["x"]), float(q["y"]), float(q["z"]))
			player.set("_dead", false)
			player.global_position = base + Vector3(half_x * frac, 0.45, 0)
			player.velocity = Vector3.ZERO
			var settled := false
			for k in 40:
				await get_tree().physics_frame
				if player.is_on_floor(): settled = true
			if not settled: continue
			var ls: Vector3 = player.get("_last_safe")
			if player.get("_last_safe_collider") == null: continue
			tested += 1
			var z: bool = player.call("_solid_floor_at", ls)
			var c: bool = _capsule_solid(player, ls)
			if not z: zero_fail += 1
			if not z and c: caps_fix += 1
	print("   L17 narrow statics: %d legal edge standings; zero-ray FAILS on %d; capsule-ray fixes %d/%d" % [
		tested, zero_fail, caps_fix, zero_fail])
	_check(tested > 0, "sampled edge standings (%d)" % tested)
	_check(caps_fix == zero_fail, "capsule-aware raycast fixes ALL %d false negatives (%d/%d)" % [zero_fail, caps_fix, zero_fail])

	# ---------- L3: аномалия L17 worst_over=19.75 ----------
	print("-- L3: what collider produces huge over-edge? --")
	game.call("load_level", 17)
	await get_tree().process_frame
	await get_tree().process_frame
	player.set("_dead", false)
	# лавовая плита 220×220 — если _floor_collider когда-нибудь вернёт её, over будет огромным
	var seen_lava := false
	for ch in lvl.get_children():
		if ch is StaticBody3D and ch.is_in_group("lava"):
			for s in ch.get_children():
				if s is CollisionShape3D and s.shape is BoxShape3D:
					print("   lava slab size=%s at y=%s (group=lava -> _floor_collider skips it)" % [
						(s.shape as BoxShape3D).size, (ch as Node3D).position.y])
	# проверяем: может ли _floor_is_safe пропустить лаву, когда игрок на ней стоит?
	player.global_position = Vector3(30, -5.4, 30)  # на поверхности лавы (lava_y=-6, top=-5.5)
	player.velocity = Vector3.ZERO
	for i in 20:
		await get_tree().physics_frame
	var fis_lava: bool = player.call("_floor_is_safe")
	var coll_lava = player.get("_last_safe_collider")
	print("   standing on lava: is_on_floor=%s _floor_is_safe=%s collider=%s" % [
		player.is_on_floor(), fis_lava, (coll_lava as Node).name if coll_lava != null else "null"])
	_check(not fis_lava or not player.is_on_floor(), "lava is not treated as safe floor")

	# ---------- L4: бесконечный цикл щит->лава->щит? ----------
	print("-- L4: does a shield save ever create an infinite death loop? --")
	game.call("load_level", 19)
	await get_tree().process_frame
	await get_tree().process_frame
	GameState.upgrades = {"shield": 3}
	player.call("apply_upgrades")
	player.call("refill_shields")
	player.set("_dead", false)
	# ставим в точку, где _spawn тоже может быть «плохим»: край уровня
	player.global_position = Vector3(200, -4.9, 200)  # далеко за пределами платформ, над лавой
	player.velocity = Vector3.ZERO
	await get_tree().physics_frame
	var sh0: int = player.get("shields")
	var kills := 0
	for k in 10:
		if player.get("_dead"): break
		player.kill()
		kills += 1
		await get_tree().physics_frame
	print("   10 kill() attempts with 3 shields: %d consumed, dead=%s shields=%d" % [kills, player.get("_dead"), player.get("shields")])
	_check(kills <= 4, "shield cannot loop forever (%d kills)" % kills)
	# и что резолв в этом случае дал (spawn далеко отсюда)
	print("   final pos=%s _spawn=%s" % [player.global_position, player.get("_spawn")])

	GameState.upgrades = {}
	print("=== PROBE L RESULT: %d pass, %d fail ===" % [_pass, _fails])
	get_tree().quit(0)
