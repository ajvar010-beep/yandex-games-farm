extends Node
## КРИТИК-ПРОБА K (v2, последовательная): реальная частота edge-standing
## при игре автопилотом из record_gameplay.gd. Без гонки _process/_start_level.

var _game: Node
var _player: Node
var _plats: Array = []
var _next_plat := 1

func _ready() -> void:
	await _run()

func _run() -> void:
	print("=== PROBE K v2: edge-standing rate, REAL autopilot play ===")
	GameState.no_ads = true
	GameState.coins = 0
	_game = load("res://scenes/Game.tscn").instantiate()
	get_tree().root.add_child.call_deferred(_game)
	await get_tree().process_frame
	await get_tree().process_frame
	_player = _game.get("player")

	var grand := {"frames": 0, "recorded": 0, "edge": 0, "deaths": 0}
	var rows := []
	for n in [8, 11, 13, 15, 16, 17, 18, 19, 20, 21]:
		var r: Dictionary = await _play_level(n)
		rows.append(r)
		grand["frames"] += r["frames"]
		grand["recorded"] += r["recorded"]
		grand["edge"] += r["edge"]
		grand["deaths"] += r["deaths"]

	print("  lvl  frames  recorded  EDGE  rate%  worst_over  med_lost  max_lost  deaths  finished")
	for r in rows:
		var rate: float = 100.0 * float(r["edge"]) / maxf(1, r["recorded"])
		print("  L%-3d %7d %9d %5d %6.2f %10.3f %9.1f %9.1f %7d %9s" % [
			r["n"], r["frames"], r["recorded"], r["edge"], rate, r["worst_over"], r["med_lost"], r["max_lost"], r["deaths"], r["finished"]])
	var total_rate: float = 100.0 * float(grand["edge"]) / maxf(1, grand["recorded"])
	print("  TOTAL grounded-recorded=%d edge=%d => %.2f%% ; deaths=%d" % [
		grand["recorded"], grand["edge"], total_rate, grand["deaths"]])
	print("=== PROBE K v2 done ===")
	get_tree().quit(0)

func _play_level(n: int) -> Dictionary:
	GameState.upgrades = {"shield": 3}
	_player.set("_dead", false)
	_player.call("apply_upgrades")
	_player.call("refill_shields")
	_game.call("load_level", n)
	await get_tree().process_frame
	await get_tree().process_frame
	_player = _game.get("player")
	_plats = []
	var f := FileAccess.open("res://levels/%02d.json" % n, FileAccess.READ)
	if f:
		var def: Dictionary = JSON.parse_string(f.get_as_text())
		f.close()
		_plats = def.get("platforms", [])
	_next_plat = 1
	var st := {"n": n, "frames": 0, "recorded": 0, "edge": 0, "worst_over": 0.0,
		"lost": [], "deaths": 0, "finished": false}
	var t := 0.0
	while t < 55.0:
		t += 1.0 / 60.0
		await get_tree().physics_frame
		if _player.get("_dead"):
			st["deaths"] += 1
			_player.set("_dead", false)
			_player.call("refill_shields")
			_player.call("respawn")
			_game.set("_running", true)
			_next_plat = 1
			continue
		_drive()
		st["frames"] += 1
		if _player.is_on_floor():
			var coll = _player.get("_last_safe_collider")
			if coll != null:
				st["recorded"] += 1
				var ls: Vector3 = _player.get("_last_safe")
				var solid: bool = _player.call("_solid_floor_at", ls)
				if not solid:
					st["edge"] += 1
					if coll is Node3D:
						var loc: Vector3 = _player.get("_last_safe_local")
						var hx := 0.75
						var hz := 0.75
						for ch in (coll as Node).get_children():
							if ch is CollisionShape3D and (ch as CollisionShape3D).shape is BoxShape3D:
								var bs: Vector3 = ((ch as CollisionShape3D).shape as BoxShape3D).size
								hx = bs.x * 0.5
								hz = bs.z * 0.5
						var over: float = maxf(absf(loc.x) - hx, absf(loc.z) - hz)
						if over > st["worst_over"]:
							st["worst_over"] = over
						st["lost"].append(ls.distance_to(_player.get("_spawn")))
		if _next_plat >= _plats.size():
			st["finished"] = true
			break
	st["med_lost"] = 0.0
	st["max_lost"] = 0.0
	var losts: Array = st["lost"]
	if not losts.is_empty():
		losts.sort()
		st["med_lost"] = losts[losts.size() / 2]
		st["max_lost"] = losts[losts.size() - 1]
	return st

func _drive() -> void:
	var pp: Vector3 = _player.global_position
	while _next_plat < _plats.size():
		var p: Dictionary = _plats[_next_plat]
		var c := Vector3(float(p["x"]), float(p["y"]), float(p["z"]))
		var half_p := (float(p.get("sx", 2)) + float(p.get("sz", 2))) * 0.25
		var horiz := Vector2(pp.x - c.x, pp.z - c.z).length()
		var top := float(p["y"]) + float(p.get("sy", 1)) * 0.5
		var on_plat: bool = _player.is_on_floor()
		var standing: bool = horiz < half_p and absf(pp.y - top) < 0.6 and on_plat
		if standing:
			_next_plat += 1
		else:
			break
	if _next_plat >= _plats.size():
		_game.set("_vmove", Vector2.ZERO)
		return
	var pt: Dictionary = _plats[_next_plat]
	var target := Vector3(float(pt["x"]), float(pt["y"]), float(pt["z"]))
	var dx := target.x - pp.x
	var dz := target.z - pp.z
	var len := Vector2(dx, dz).length()
	if len < 0.01: return
	var want := Vector3(dx, 0.0, dz)
	var cam: Node3D = _game.get("cam_rig")
	if cam != null:
		want = cam.global_transform.basis.inverse() * want
	var vm := Vector2(want.x, want.z).normalized()
	_game.set("_vmove", vm)
	var cur: Dictionary = _plats[maxi(0, _next_plat - 1)]
	var D := Vector2(float(pt.get("x", 0)) - float(cur.get("x", 0)),
		float(pt.get("z", 0)) - float(cur.get("z", 0))).length()
	var half_cur := (float(cur.get("sx", 2)) + float(cur.get("sz", 2))) * 0.25
	var half_next := (float(pt.get("sx", 2)) + float(pt.get("sz", 2))) * 0.25
	var edge_gap := D - half_cur - half_next
	var on_floor: bool = _player.is_on_floor()
	var jumps: int = _player.get("_jumps")
	var dy := target.y - pp.y
	var need_jump := edge_gap > 0.05 or dy > 0.2
	if on_floor and need_jump and len <= D - half_cur + 0.6 and dy > -3.0:
		_player.tap_jump()
	elif not on_floor and jumps < 2 and _player.velocity.y < 0.0 and len > half_next * 0.8 and dy > -3.0:
		_player.tap_jump()
