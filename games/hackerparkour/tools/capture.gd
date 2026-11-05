extends SceneTree
## Capture: рендерит кадр геймплея и сохраняет PNG для иконки/скриншотов.

func _init() -> void:
	var root := Node3D.new()
	root.name = "Root"
	get_root().add_child(root)

	# свет
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -30, 0)
	root.add_child(sun)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.53, 0.75, 0.92)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.8, 0.9)
	env.environment = e
	root.add_child(env)

	# простой уровень: стартовая платформа + несколько прыжковых + лава + монеты + финиш
	_build_showcase(root)

	# игрок
	var player := Node3D.new()
	player.name = "Player"
	root.add_child(player)
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.25, 0.45, 0.95)
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.6, 0.7, 0.35)
	body.mesh = bm
	body.material_override = skin
	body.position = Vector3(0, 0.85, 0)
	player.add_child(body)
	var head := MeshInstance3D.new()
	var hm := BoxMesh.new()
	hm.size = Vector3(0.55, 0.5, 0.55)
	head.mesh = hm
	head.material_override = skin
	head.position = Vector3(0, 1.45, 0)
	player.add_child(head)
	player.position = Vector3(0, 2.0, -3.0)

	# камера — вид сбоку-сзади, как в геймплее
	var cam := Camera3D.new()
	cam.fov = 60
	root.add_child(cam)
	cam.position = Vector3(4.5, 4.5, 2.5)
	cam.look_at(Vector3(0, 1.5, -6), Vector3.UP)
	cam.current = true

	await process_frame
	await process_frame
	await process_frame

	var img := get_root().get_viewport().get_texture().get_image()
	img.save_png("res://export/showcase.png")
	print("saved res://export/showcase.png")
	quit()

func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.85
	return m

func _build_showcase(root: Node3D) -> void:
	var mats := {
		"grass": _mat(Color(0.35, 0.72, 0.35)),
		"stone": _mat(Color(0.5, 0.5, 0.55)),
		"wood": _mat(Color(0.6, 0.45, 0.25)),
		"gold": _mat(Color(0.95, 0.8, 0.25)),
	}
	var lava_m := StandardMaterial3D.new()
	lava_m.albedo_color = Color(1.0, 0.35, 0.05)
	lava_m.emission_enabled = true
	lava_m.emission = Color(1.0, 0.4, 0.1)
	lava_m.emission_energy_multiplier = 2.5

	# лава
	var lava := MeshInstance3D.new()
	var lb := BoxMesh.new()
	lb.size = Vector3(40, 0.5, 40)
	lava.mesh = lb
	lava.material_override = lava_m
	lava.position = Vector3(0, -4, -10)
	root.add_child(lava)

	# платформы
	var pts := [
		[0, 0, 0, 7, "grass"],
		[1, 0.2, -6, 2.5, "stone"],
		[-1.5, 0.5, -11, 2.2, "wood"],
		[2, 0.8, -16, 2.0, "stone"],
		[0, 1.2, -21, 2.4, "grass"],
		[0, 1.5, -26, 5, "gold"],
	]
	for p in pts:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(p[3], 0.8, p[3])
		mi.mesh = bm
		mi.material_override = mats[p[4]]
		mi.position = Vector3(p[0], p[1], p[2])
		root.add_child(mi)

	# монеты
	var coin_m := StandardMaterial3D.new()
	coin_m.albedo_color = Color(0.2, 0.95, 0.6)
	coin_m.emission_enabled = true
	coin_m.emission = Color(0.2, 0.95, 0.6)
	for p in [[1, 1.2, -6], [0, 2.2, -21]]:
		var c := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.28
		cm.bottom_radius = 0.28
		cm.height = 0.08
		c.mesh = cm
		c.material_override = coin_m
		c.rotation_degrees.x = 90
		c.position = Vector3(p[0], p[1], p[2])
		root.add_child(c)
