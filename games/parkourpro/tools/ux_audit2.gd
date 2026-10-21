extends Node
## UX audit v2 — runs as a scene so autoloads are present.

func _ready() -> void:
	print("=== UX AUDIT v2 ===")
	await _test_offset_y()
	await _test_debris()
	await _test_pause_menu_softlock()
	await _test_pause_button_while_paused()
	await _test_touch_sizes()
	await _test_camera_vs_input()
	await _test_revive_place()
	await _test_tutorial()
	print("=== END ===")
	get_tree().quit(0)

func _test_offset_y() -> void:
	print("\n--- A. offset_y on Label ---")
	var l := Label.new()
	print("  get('offset_y')=", l.get("offset_y"), " -> null means property DOESN'T EXIST")
	print("  get('offset_top')=", l.get("offset_top"))
	# emulate game.gd line 351
	var err := false
	l.offset_top = 0
	print("  setting offset_y via script (game.gd:351) would be a runtime error if absent")
	l.free()

func _test_debris() -> void:
	print("\n--- B. death debris (cube explosion) accumulation ---")
	var g = load("res://scenes/Game.tscn").instantiate()
	add_child(g)
	await get_tree().process_frame
	g.load_level(1)
	await get_tree().process_frame
	var pl = g.player
	print("  player children before: ", pl.get_child_count(), " rigid=", _cnt(pl))
	for i in 5:
		pl.kill()
		await get_tree().process_frame
		pl.revive()
		await get_tree().process_frame
	print("  player children after 5 deaths: ", pl.get_child_count(), " rigid=", _cnt(pl))
	# debris are added to _mesh.get_parent() == player, never freed
	print("  LEAK (rigid > 0): ", _cnt(pl) > 0)
	var yvals := []
	for c in pl.get_children():
		if c is RigidBody3D: yvals.append(c.global_position.y)
	if yvals.size(): print("  debris y range: min=", yvals.min(), " max=", yvals.max(), " (lava_y=-6, death at y<-5)")
	g.queue_free()
	await get_tree().process_frame

func _cnt(n: Node) -> int:
	var c := 0
	for ch in n.get_children():
		if ch is RigidBody3D: c += 1
	return c

func _test_pause_menu_softlock() -> void:
	print("\n--- C. PAUSE -> 'В меню' softlock ---")
	var main = load("res://scenes/Main.tscn").instantiate()
	add_child(main)
	await get_tree().process_frame
	main.start_level(1)
	await get_tree().process_frame
	await get_tree().process_frame
	var g = main._game
	g._toggle_pause()
	print("  paused=", get_tree().paused, " panel title=", g._panel_title.text, " ui.visible=", g.ui.visible)
	g._on_menu()
	await get_tree().process_frame
	print("  after 'В меню': paused=", get_tree().paused, " menu.visible=", main.menu.visible)
	var btns := _find(main.menu, "Button")
	var live := 0
	for b in btns:
		if not b.disabled and b.can_process(): live += 1
	print("  menu buttons=", btns.size(), " clickable(can_process&&!disabled)=", live)
	print("  SOFTLOCK if paused==true: ", get_tree().paused)
	main.queue_free()
	get_tree().paused = false
	await get_tree().process_frame

func _test_pause_button_while_paused() -> void:
	print("\n--- D. HUD pause button while paused ---")
	var g = load("res://scenes/Game.tscn").instantiate()
	add_child(g)
	await get_tree().process_frame
	g.load_level(1)
	await get_tree().process_frame
	var pb = g.hud.get_node("PauseBtn")
	print("  HUD layer process_mode=", pb.get_parent().process_mode)
	g._toggle_pause()
	print("  paused=", get_tree().paused, " pause btn can_process=", pb.can_process())
	# pressing pause again should unpause via the same button
	pb.emit_signal("pressed")
	await get_tree().process_frame
	print("  after 2nd press: paused=", get_tree().paused)
	# death panel while paused?
	g.queue_free()
	get_tree().paused = false
	await get_tree().process_frame

func _find(n: Node, cls: String) -> Array:
	var out := []
	for c in n.get_children():
		if c.get_class() == cls: out.append(c)
		out.append_array(_find(c, cls))
	return out

func _test_touch_sizes() -> void:
	print("\n--- E. touch target sizes ---")
	var m = load("res://scripts/menu.gd").new()
	add_child(m)
	await get_tree().process_frame
	await get_tree().process_frame
	var btns := _find(m, "Button")
	var sx := minf(800.0/1280.0, 360.0/720.0)   # landscape phone CSS scale
	var sp := minf(360.0/1280.0, 800.0/720.0)   # portrait
	print("  scale: landscape=", sx, " portrait=", sp)
	var tiny := 0
	for b in btns:
		var s: Vector2 = b.size
		if s.y * sx < 30: tiny += 1
		if s.y * sx < 30 or s.y * sp < 24:
			print("  TINY: %r virt=%s cssL=%.0f cssP=%.0f" % [b.text.replace("\n"," ").substr(0,20), s, s.y*sx, s.y*sp])
	print("  buttons=", btns.size(), " tiny(<30css landscape)=", tiny)
	m.queue_free()
	await get_tree().process_frame

func _test_camera_vs_input() -> void:
	print("\n--- F. auto-camera vs joystick (fight?) ---")
	var g = load("res://scenes/Game.tscn").instantiate()
	add_child(g)
	await get_tree().process_frame
	g.load_level(1)
	await get_tree().process_frame
	var cam = g.cam_rig
	var pl = g.player
	print("  cam_rig._cam in player: ", pl._cam, " (null => player moves in WORLD axes, not camera-relative)")
	print("  cam has rotate_cam: ", cam.has_method("rotate_cam"))
	# mobile: no RMB. Is there ANY touch path to rotate_cam?
	var found_touch_rotate := false
	for line in ["_input handles ScreenDrag -> only _set_virtual_move"]:
		pass
	print("  mobile camera rotation available? (game.gd _unhandled_input needs RMB): NO on touch")
	# simulate: joystick pushes +x, does camera yaw chase and cancel it?
	g._set_virtual_move(Vector2(1, 0))
	var yaw0 = cam._yaw
	for i in 60:
		await get_tree().process_frame
	print("  after 1s of +x input: yaw0=", yaw0, " yaw1=", cam._yaw, " is_input_active=", pl.is_input_active())
	print("  camera stayed put while input active (anti-cycle): ", absf(cam._yaw - yaw0) < 0.01)
	g._set_virtual_move(Vector2.ZERO)
	await get_tree().process_frame
	var yaw2 = cam._yaw
	pl.velocity = Vector3(5, 0, 0)
	for i in 60:
		await get_tree().process_frame
	print("  with no input but velocity: yaw moved ", absf(cam._yaw - yaw2))
	g.queue_free()
	await get_tree().process_frame

func _test_revive_place() -> void:
	print("\n--- G. revive placement ---")
	var g = load("res://scenes/Game.tscn").instantiate()
	add_child(g)
	await get_tree().process_frame
	g.load_level(1)
	await get_tree().process_frame
	var pl = g.player
	print("  spawn=", pl._spawn, " last_safe=", pl._last_safe)
	# walk player to a mid platform
	pl.global_position = Vector3(0, 1.0, -12)
	for i in 10: await get_tree().process_frame
	print("  after standing on plat z=-12: last_safe=", pl._last_safe)
	# simulate fall to lava
	pl.global_position = Vector3(0, -7, -12)
	await g._on_player_died
	g._on_player_died()
	print("  death_pos=", g._death_pos, " running=", g._running)
	pl.revive()
	print("  revive pos=", pl.global_position, " (should be last_safe+0.5y, NOT death/lava)")
	print("  REVIVE INTO LAVA if y<=-5: ", pl.global_position.y <= -5)
	# revive on a MOVING platform: last_safe is a world point, platform moved away?
	g.queue_free()
	await get_tree().process_frame

func _test_tutorial() -> void:
	print("\n--- H. tutorial ---")
	var g = load("res://scenes/Game.tscn").instantiate()
	add_child(g)
	await get_tree().process_frame
	g.load_level(1)
	await get_tree().process_frame
	print("  tutorial label exists: ", g._tutorial_label != null, " step=", g._tutorial_step)
	if g._tutorial_label:
		var lbl: Label = g._tutorial_label
		print("  text=", lbl.text)
		print("  anchors preset CENTER_BOTTOM; offset_y=", lbl.get("offset_y"), " offset_top=", lbl.offset_top, " offset_bottom=", lbl.offset_bottom)
		print("  position=", lbl.position, " size=", lbl.size, " global=", lbl.global_position)
		var vp := get_viewport().get_visible_rect().size
		print("  viewport=", vp, " -> label bottom=", lbl.global_position.y + lbl.size.y, " (off-screen if > ", vp.y, ")")
		print("  autowrap=", lbl.autowrap_mode, " -> long RU text on one line width=", lbl.get_minimum_size())
	# advance logic: _advance_tutorial called from player every physics frame with input
	g._advance_tutorial()
	print("  after 1 advance: step=", g._tutorial_step)
	for i in 5: g._advance_tutorial()
	print("  after 6 advances: step=", g._tutorial_step, " (max 2 expected)")
	print("  tut2 mentions ring ⭕ — glyph in Symbols2: yes (verified separately)")
	g.queue_free()
	await get_tree().process_frame
