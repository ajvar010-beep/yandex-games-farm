extends Node
## UX audit v3 — targeted: revive loop, cam/move decoupling, reachability, touch sizes.

func _ready() -> void:
	print("=== UX AUDIT v3 ===")
	await _lava_revive_loop()
	await _cam_move_decoupling()
	await _last_safe_on_mover()
	await _reachability()
	await _touch_targets()
	await _kill_never_called()
	print("=== END v3 ===")
	get_tree().quit(0)

func _mk(level := 1):
	var g = load("res://scenes/Game.tscn").instantiate()
	add_child(g)
	await get_tree().process_frame
	g.load_level(level)
	await get_tree().process_frame
	await get_tree().process_frame
	return g

# ---- 1. Revive onto the lava surface => instant re-death loop? ----
func _lava_revive_loop() -> void:
	print("\n--- 1. LAVA REVIVE LOOP ---")
	var g = await _mk(1)
	var pl = g.player
	# Simulate low-FPS frame: one physics step carries the player from above -5
	# straight onto the lava collider (top surface y = lava_y - 0.5 = -6.5? measure)
	pl.global_position = Vector3(0, -5.4, -6)
	pl.velocity = Vector3(0, -20, 0)
	for i in 4: await get_tree().physics_frame
	print("  after landing attempt: pos=", pl.global_position, " on_floor=", pl.is_on_floor(), " last_safe=", pl._last_safe)
	# now trigger death as game._process does
	g._on_player_died()
	print("  death_pos=", g._death_pos, " running=", g._running)
	var revives := 0
	for i in 6:
		pl.revive()
		g._running = true
		revives += 1
		await get_tree().physics_frame
		await get_tree().process_frame
		var died_again := pl.global_position.y < -5.0
		print("  revive #%d -> pos=%s  instant_redeath=%s" % [revives, pl.global_position, died_again])
		if not died_again: break
		g._on_player_died()
	print("  g._revives_used stays 0 in this loop (only incremented after RV reward):", g._revives_used)
	g.queue_free()
	await get_tree().process_frame

# ---- 2. Camera yaw vs world-relative movement ----
func _cam_move_decoupling() -> void:
	print("\n--- 2. CAMERA / MOVEMENT DECOUPLING ---")
	var g = await _mk(1)
	var pl = g.player
	print("  player._cam = ", pl._cam, " (null => movement uses Basis.IDENTITY = WORLD axes)")
	# Put a flat floor so we can measure travel direction cleanly
	var floorb = StaticBody3D.new()
	var bs = BoxShape3D.new(); bs.size = Vector3(200, 1, 200)
	var cs = CollisionShape3D.new(); cs.shape = bs
	floorb.add_child(cs); floorb.position = Vector3(0, -0.5, 0)
	g.add_child(floorb)
	pl.global_position = Vector3(0, 1, 0); pl.velocity = Vector3.ZERO
	await get_tree().physics_frame
	for yaw_deg in [0, 45, 90, 180]:
		g.cam_rig._yaw = deg_to_rad(yaw_deg)
		pl.global_position = Vector3(0, 1, 0); pl.velocity = Vector3.ZERO
		g._set_virtual_move(Vector2(0, -1))   # joystick pushed "up/forward"
		await get_tree().physics_frame
		await get_tree().physics_frame
		await get_tree().physics_frame
		g._set_virtual_move(Vector2.ZERO)
		var travelled := pl.global_position - Vector3(0, pl.global_position.y, 0)
		var screen_dir := _world_to_screen_dir(Vector3(0,0,-1), deg_to_rad(yaw_deg))
		print("  cam yaw=%3d deg: joystick FORWARD -> world move=(%+.2f,%+.2f)  |  screen-forward=(%+.2f,%+.2f)  MATCH=%s" % [
			yaw_deg, travelled.x, travelled.z, screen_dir.x, screen_dir.y,
			str(Vector2(travelled.x, travelled.z).normalized().dot(screen_dir) > 0.9)])
	g.queue_free()
	await get_tree().process_frame

func _world_to_screen_dir(_fwd: Vector3, yaw: float) -> Vector2:
	# camera sits at player + (sin(yaw)*d, h, cos(yaw)*d); "away from camera" in XZ = -(sin,cos)
	return Vector2(-sin(yaw), -cos(yaw))

# ---- 3. _last_safe recorded while riding a MOVING platform ----
func _last_safe_on_mover() -> void:
	print("\n--- 3. LAST_SAFE ON MOVING PLATFORM ---")
	var g = await _mk(21)
	var lvl = g.level
	print("  traps(movers)=", lvl._traps.size())
	if lvl._traps.size() == 0:
		g.queue_free(); return
	var t: Dictionary = lvl._traps[0]
	var node: Node3D = t["node"]
	var pl = g.player
	# ride it: place player on top
	var top := node.global_position + Vector3(0, 0.35, 0)
	pl.global_position = top + Vector3(0, 0.6, 0)
	pl.velocity = Vector3.ZERO
	for i in 30: await get_tree().physics_frame
	print("  mover base=", t["base"], " axis=", t["move"].get("axis"), " range=", t["move"].get("range"))
	print("  mover now=", node.global_position, " on_floor=", pl.is_on_floor(), " last_safe=", pl._last_safe)
	var safe_at_death := pl._last_safe
	# wait ~2s (platform keeps moving), then revive as if the kid died
	for i in 120: await get_tree().physics_frame
	pl._last_safe = safe_at_death
	pl.revive()
	await get_tree().physics_frame
	print("  revive at last_safe=", pl.global_position, " mover now at=", node.global_position)
	print("  vertical gap player-vs-mover = %.2f m" % (pl.global_position.y - node.global_position.y))
	for i in 40: await get_tree().physics_frame
	print("  0.66s later: player y=%.2f on_floor=%s  -> fell off the moved platform: %s" % [pl.global_position.y, pl.is_on_floor(), str(not pl.is_on_floor())])
	g.queue_free()
	await get_tree().process_frame

# ---- 4. Reachability: max jump height vs level dy ----
func _reachability() -> void:
	print("\n--- 4. JUMP REACH vs LEVEL GAPS ---")
	var jf := 9.5
	var grav: float = ProjectSettings.get_setting("physics/3d/default_gravity") * 1.8
	var h1 := jf*jf/(2*grav)
	print("  single jump height = %.2f m, double = %.2f m" % [h1, h1*2])
	var airtime := 2*jf/grav
	print("  single-jump airtime = %.2f s -> horiz reach @7m/s = %.2f m; double = %.2f m" % [airtime, 7*airtime, 7*airtime*2])
	var worst := []
	for n in range(1, 22):
		var p := "res://levels/%02d.json" % n
		if not FileAccess.file_exists(p): continue
		var def: Dictionary = JSON.parse_string(FileAccess.open(p, FileAccess.READ).get_as_text())
		var plats: Array = def.get("platforms", [])
		for i in range(1, plats.size()):
			var a: Dictionary = plats[i-1]; var b: Dictionary = plats[i]
			var dy := float(b.get("y",0)) - float(a.get("y",0))
			var ax=Vector3(float(a.get("x",0)),float(a.get("y",0)),float(a.get("z",0)))
			var bx=Vector3(float(b.get("x",0)),float(b.get("y",0)),float(b.get("z",0)))
			var dxz := Vector2(bx.x-ax.x, bx.z-ax.z).length()
			var edge := dxz - (float(a.get("sx",2))+float(a.get("sz",2)))*0.25 - (float(b.get("sx",2))+float(b.get("sz",2)))*0.25
			if dy > h1*2 - 0.05 or edge > 7*airtime*2 - 0.3:
				worst.append([n, i, snappedf(dy,0.01), snappedf(edge,0.01)])
	print("  steps needing MORE than a double jump (unreachable): ", worst.size())
	for w in worst: print("    level %d step %d dy=%s edge_gap=%s" % w)
	# god variant narrows sx by /1.3 -> recheck edges
	print("  --- god variant (sx/1.3) ---")
	var wg := []
	for n in range(1, 22):
		var p := "res://levels/%02d.json" % n
		if not FileAccess.file_exists(p): continue
		var def: Dictionary = JSON.parse_string(FileAccess.open(p, FileAccess.READ).get_as_text())
		var plats: Array = def.get("platforms", [])
		for i in range(1, plats.size()):
			var a: Dictionary = plats[i-1]; var b: Dictionary = plats[i]
			var asx := maxf(1.2, float(a.get("sx",2))/1.3); var asz := float(a.get("sz",2))
			var bsx := maxf(1.2, float(b.get("sx",2))/1.3); var bsz := float(b.get("sz",2))
			var dxz := Vector2(float(b.get("x",0))-float(a.get("x",0)), float(b.get("z",0))-float(a.get("z",0))).length()
			var edge := dxz - (asx+asz)*0.25 - (bsx+bsz)*0.25
			# landing target width matters most
			if bsx < 1.6: wg.append([n, i, snappedf(bsx,0.01), snappedf(edge,0.01)])
	print("  god-variant platforms narrower than 1.6m: ", wg.size())
	for w in wg.slice(0, 12): print("    level %d step %d sx=%.2f edge_gap=%.2f" % w)

# ---- 5. Real touch target sizes ----
func _touch_targets() -> void:
	print("\n--- 5. TOUCH TARGETS (CSS px on a real phone) ---")
	var m = load("res://scripts/menu.gd").new()
	add_child(m)
	await get_tree().process_frame
	await get_tree().process_frame
	var vp := get_viewport().get_visible_rect().size
	print("  design viewport=", vp)
	# typical phone landscape CSS: 740x360
	for phone in [Vector2(740,360), Vector2(360,740)]:
		var s := minf(phone.x/1280.0, phone.y/720.0)
		print("  phone %dx%d -> scale %.3f" % [phone.x, phone.y, s])
		var btns := _find(m, "Button")
		var too_small := 0
		for b in btns:
			var sz: Vector2 = b.size
			if sz.y * s < 44.0:
				too_small += 1
		print("    buttons=%d, below 44 CSS px tall=%d" % [btns.size(), too_small])
		# font sizes
		var lbls := _find(m, "Label")
		var tiny_txt := 0
		for l in lbls:
			var fs: int = l.get_theme_font_size("font_size")
			if fs * s < 11: tiny_txt += 1
		print("    labels=%d, text below 11 CSS px=%d" % [lbls.size(), tiny_txt])
	# in-game HUD
	var g = await _mk(1)
	var pb = g.hud.get_node("PauseBtn")
	print("  pause button virt size=", pb.size, " -> CSS at 0.5 scale=", pb.size*0.5, " (min 44)")
	print("  joy_base pos=", g._joy_base.position, " size=", g._joy_base.size, " -> bottom edge rel to parent bottom")
	var hudsz := g.hud.size
	print("  hud size=", hudsz, " joy bottom=", g._joy_base.position.y + g._joy_base.size.y, " (off-screen if > ", hudsz.y, ")")
	g.queue_free(); m.queue_free()
	await get_tree().process_frame

func _find(n: Node, cls: String) -> Array:
	var out := []
	for c in n.get_children():
		if c.get_class() == cls: out.append(c)
		out.append_array(_find(c, cls))
	return out

# ---- 6. is kill() reachable at all? ----
func _kill_never_called() -> void:
	print("\n--- 6. DEATH ANIMATION REACHABILITY ---")
	var src := ""
	for p in ["game.gd","player.gd","level.gd","main.gd","menu.gd","camera_rig.gd","game_state.gd"]:
		src += FileAccess.open("res://scripts/"+p, FileAccess.READ).get_as_text()
	print("  occurrences of '.kill()' or 'kill(' outside its own def: ", src.count("kill(") - 1)
	print("  occurrences of 'died.emit': ", src.count("died.emit"))
	print("  -> if 0 callers, the cube-explosion death animation NEVER plays")
	var g = await _mk(1)
	var pl = g.player
	pl.global_position = Vector3(0, -7, 0)   # below lava threshold, as game._process detects
	await get_tree().process_frame
	g._process(0.016)
	print("  after lava death: _dead=", pl._dead, " mesh.visible=", pl._mesh.visible, " rigid debris=", _cnt(pl))
	print("  -> player keeps simulating (not _dead), no explosion")
	g.queue_free()
	await get_tree().process_frame

func _cnt(n: Node) -> int:
	var c := 0
	for ch in n.get_children():
		if ch is RigidBody3D: c += 1
	return c
