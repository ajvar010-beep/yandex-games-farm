extends SceneTree
## UX audit (temporary, for council review) — headless checks.

func _init() -> void:
	print("=== UX AUDIT parkourpro ===")
	_test_script_compiles()
	await process_frame
	_test_debris()
	_test_pause_menu_softlock()
	_test_touch_sizes()
	quit(0)

func _test_script_compiles() -> void:
	print("\n--- A. script load/compile ---")
	for p in ["res://scripts/game.gd","res://scripts/player.gd","res://scripts/menu.gd","res://scripts/camera_rig.gd","res://scripts/game_state.gd","res://scripts/level.gd","res://scripts/yandex.gd","res://scripts/variant.gd","res://scripts/main.gd"]:
		var s = load(p)
		if s == null:
			print("  LOAD FAIL: ", p)
		else:
			print("  ok: ", p)
	# offset_y existence on Control/Label
	var l := Label.new()
	print("  Label has 'offset_y' property? ", l.get("offset_y") != null, " value=", l.get("offset_y"))
	print("  Label has 'offset_top'? ", l.get("offset_top") != null)
	l.free()

func _test_debris() -> void:
	print("\n--- B. death debris accumulation ---")
	var g = load("res://scenes/Game.tscn").instantiate()
	root.add_child(g)
	g.load_level(1)
	await process_frame
	var pl = g.player
	var before := _count_rigid(pl)
	print("  rigid bodies on player before death: ", before)
	for i in 3:
		pl.kill()
		pl.revive()
		await process_frame
	var after := _count_rigid(pl)
	print("  rigid bodies after 3 deaths+revives: ", after)
	print("  total player children: ", pl.get_child_count())
	# does debris collide with player / fall to lava?
	var sample = []
	for c in pl.get_children():
		if c is RigidBody3D:
			sample.append(c.global_position)
	if sample.size() > 0:
		print("  first debris pos: ", sample[0])
	print("  DEBRIS LEAK: ", after > before)
	g.queue_free()
	await process_frame

func _count_rigid(n: Node) -> int:
	var c := 0
	for ch in n.get_children():
		if ch is RigidBody3D: c += 1
	return c

func _test_pause_menu_softlock() -> void:
	print("\n--- C. pause -> menu softlock ---")
	var main = load("res://scenes/Main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	main.start_level(1)
	await process_frame
	await process_frame
	var g = main._game
	print("  game node: ", g, " paused=", paused)
	# open pause
	g._toggle_pause()
	print("  after pause toggle: tree.paused=", paused, " ui.visible=", g.ui.visible)
	print("  panel title=", g._panel_title.text)
	# now press secondary = "В меню" -> _on_menu
	g._on_menu()
	await process_frame
	await process_frame
	print("  after _on_menu: tree.paused=", paused, " (must be false!)")
	print("  menu visible=", main.menu.visible)
	print("  SOFTLOCK: ", paused == true)
	# is the menu Control actually processing input while paused?
	print("  menu process_mode=", main.menu.process_mode, " can_process=", main.menu.can_process())
	var btns := _find_buttons(main.menu)
	print("  menu buttons found: ", btns.size())
	if btns.size() > 0:
		var b: Button = btns[0]
		print("  first button can_process=", b.can_process(), " disabled=", b.disabled, " text=", b.text.replace("\n"," "))
	main.queue_free()
	paused = false
	await process_frame

func _find_buttons(n: Node) -> Array:
	var out := []
	for c in n.get_children():
		if c is Button: out.append(c)
		out.append_array(_find_buttons(c))
	return out

func _test_touch_sizes() -> void:
	print("\n--- D. touch target sizes (virtual px) ---")
	var m = load("res://scripts/menu.gd").new()
	root.add_child(m)
	await process_frame
	await process_frame
	var all := _find_buttons(m)
	var small := 0
	for b in all:
		var s: Vector2 = b.size
		if s.y < 60 or s.x < 60:
			small += 1
			print("  SMALL: text=%r size=%s" % [b.text.replace("\n"," ").substr(0,22), s])
	print("  total buttons=", all.size(), " smaller than 60x60 virtual px=", small)
	# scale factor for a real phone landscape 800x360 CSS px
	var scale_800 := minf(800.0/1280.0, 360.0/720.0)
	print("  CSS scale at 800x360 landscape: ", scale_800, " -> 60 virtual px = ", 60*scale_800, " CSS px (min recommended 44)")
	var scale_portrait := minf(360.0/1280.0, 800.0/720.0)
	print("  CSS scale at 360x800 PORTRAIT: ", scale_portrait, " -> font 34 = ", 34*scale_portrait, " CSS px")
	# footer row measured
	for b in all:
		if b.text.begins_with("📺") or "звук" in b.text.to_lower() or "sound" in b.text.to_lower() or "🎖" in b.text:
			print("  FOOTER btn %r size=%s -> CSS landscape h=%.1f portrait h=%.1f" % [b.text.replace("\n"," ").substr(0,18), b.size, b.size.y*scale_800, b.size.y*scale_portrait])
	m.queue_free()
	await process_frame
