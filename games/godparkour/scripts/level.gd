class_name ParkourLevel
extends Node3D
## Level — генерирует платформы из JSON, ловушки, монеты, чекпоинты, финиш, лаву.

signal coin_collected
signal checkpoint_reached(pos: Vector3)
signal finish_reached

var _mats: Dictionary = {}
var _coins: Array[Node3D] = []
var _traps: Array[Dictionary] = []

const COLORS := {
	"grass": Color(0.35, 0.72, 0.35),
	"dirt": Color(0.55, 0.4, 0.25),
	"stone": Color(0.5, 0.5, 0.55),
	"wood": Color(0.6, 0.45, 0.25),
	"sand": Color(0.9, 0.82, 0.5),
	"ice": Color(0.75, 0.88, 0.95),
	"red": Color(0.85, 0.25, 0.2),
	"gold": Color(0.95, 0.8, 0.25),
	"dark": Color(0.2, 0.2, 0.25),
}

func _ready() -> void:
	_make_materials()

func _make_materials() -> void:
	for k in COLORS:
		var m := StandardMaterial3D.new()
		m.albedo_color = COLORS[k]
		m.roughness = 0.85
		_mats[k] = m
	# лава
	var lava := StandardMaterial3D.new()
	lava.albedo_color = Color(1.0, 0.35, 0.05)
	lava.emission_enabled = true
	lava.emission = Color(1.0, 0.4, 0.1)
	lava.emission_energy_multiplier = 2.0
	_mats["lava"] = lava
	# неон (хакер-тема)
	var neon := StandardMaterial3D.new()
	neon.albedo_color = Color(0.02, 0.15, 0.05)
	neon.emission_enabled = true
	neon.emission = Color(0.0, 1.0, 0.25)
	neon.emission_energy_multiplier = 1.3
	_mats["neon"] = neon
	# монета
	var coin := StandardMaterial3D.new()
	coin.albedo_color = Color(0.2, 0.95, 0.6)
	coin.emission_enabled = true
	coin.emission = Color(0.2, 0.95, 0.6)
	coin.emission_energy_multiplier = 1.5
	_mats["coin"] = coin
	# финиш
	var fin := StandardMaterial3D.new()
	fin.albedo_color = Color(0.3, 0.9, 0.95)
	fin.emission_enabled = true
	fin.emission = Color(0.3, 0.9, 0.95)
	fin.emission_energy_multiplier = 1.8
	_mats["finish"] = fin

func load_level(def: Dictionary) -> void:
	# очистка
	for c in get_children():
		c.queue_free()
	_coins.clear()
	_traps.clear()
	_spawn_ambient_particles()

	var plats: Array = def.get("platforms", [])
	for p in plats:
		_spawn_platform(p)
	var coins: Array = def.get("coins", [])
	for c in coins:
		_spawn_coin(Vector3(c[0], c[1], c[2]))
	var cps: Array = def.get("checkpoints", [])
	for c in cps:
		_spawn_checkpoint(Vector3(c[0], c[1], c[2]))
	var finish: Array = def.get("finish", [])
	if finish.size() == 3:
		_spawn_finish(Vector3(finish[0], finish[1], finish[2]))
	# тема: хакер (неон) или обычная (восстановление дефолта важно — env общий)
	if str(def.get("theme", "")) == "hacker":
		_apply_hacker_theme()
	else:
		_apply_default_theme()
	# лава-плоскость на y=0
	_spawn_lava(def.get("lava_y", -6.0), def.get("lava_size", 220.0))

func _apply_hacker_theme() -> void:
	# тёмное небо
	var env := get_viewport().world_3d.environment
	if env:
		env.background_color = Color(0.01, 0.04, 0.02)
		env.ambient_light_color = Color(0.1, 0.45, 0.15)
		env.ambient_light_energy = 0.55
	# лава-данные (зелёная)
	var data := StandardMaterial3D.new()
	data.albedo_color = Color(0.02, 0.6, 0.1)
	data.emission_enabled = true
	data.emission = Color(0.0, 1.0, 0.2)
	data.emission_energy_multiplier = 2.2
	_mats["lava"] = data
	# монеты — кибер-голубые
	var coin := _mats["coin"]
	coin.albedo_color = Color(0.2, 0.8, 1.0)
	coin.emission = Color(0.2, 0.8, 1.0)

func _apply_default_theme() -> void:
	var env := get_viewport().world_3d.environment
	if env:
		env.background_color = Color(0.53, 0.75, 0.92)
		env.ambient_light_color = Color(0.7, 0.78, 0.9)
		env.ambient_light_energy = 0.9
	var lava := _mats["lava"]
	lava.albedo_color = Color(1.0, 0.35, 0.05)
	lava.emission = Color(1.0, 0.4, 0.1)
	lava.emission_energy_multiplier = 2.0
	var coin := _mats["coin"]
	coin.albedo_color = Color(0.2, 0.95, 0.6)
	coin.emission = Color(0.2, 0.95, 0.6)

func _spawn_platform(p: Dictionary) -> void:
	var pos := Vector3(p.get("x", 0), p.get("y", 0), p.get("z", 0))
	var size := Vector3(p.get("sx", 2), p.get("sy", 1), p.get("sz", 2))
	var body := StaticBody3D.new()
	body.position = pos
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _mats.get(p.get("mat", "grass"), _mats["grass"])
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	add_child(body)
	# движущаяся ловушка
	if p.has("move"):
		_traps.append({"node": body, "base": pos, "move": p["move"]})

func _spawn_coin(pos: Vector3) -> void:
	var area := Area3D.new()
	area.position = pos
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.28
	cm.bottom_radius = 0.28
	cm.height = 0.08
	mi.mesh = cm
	mi.material_override = _mats["coin"]
	mi.rotation_degrees.x = 90
	area.add_child(mi)
	var cs := CollisionShape3D.new()
	var ss := SphereShape3D.new()
	ss.radius = 0.45
	cs.shape = ss
	area.add_child(cs)
	area.body_entered.connect(func(b):
		if b is ParkourPlayer:
			area.set_deferred("monitoring", false)
			area.visible = false
			AudioBus.coin()
			coin_collected.emit())
	add_child(area)
	_coins.append(area)

func _spawn_checkpoint(pos: Vector3) -> void:
	var area := Area3D.new()
	area.position = pos
	# столб-флаг
	var pole := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = 0.08
	pm.bottom_radius = 0.08
	pm.height = 2.2
	pole.mesh = pm
	pole.position.y = 1.1
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = Color(0.9, 0.9, 0.95)
	pole.material_override = pmat
	area.add_child(pole)
	var flag := MeshInstance3D.new()
	var fm := BoxMesh.new()
	fm.size = Vector3(0.9, 0.5, 0.04)
	flag.mesh = fm
	flag.position = Vector3(0.45, 1.9, 0)
	var fmat := StandardMaterial3D.new()
	fmat.albedo_color = Color(0.2, 0.9, 0.3)
	fmat.emission_enabled = true
	fmat.emission = Color(0.2, 0.9, 0.3)
	flag.material_override = fmat
	area.add_child(flag)
	var cs := CollisionShape3D.new()
	var ss := SphereShape3D.new()
	ss.radius = 1.2
	cs.shape = ss
	cs.position.y = 1.0
	area.add_child(cs)
	area.body_entered.connect(func(b):
		if b is ParkourPlayer:
			AudioBus.checkpoint()
			checkpoint_reached.emit(pos + Vector3(0, 1.0, 0)))
	add_child(area)

func _spawn_finish(pos: Vector3) -> void:
	var area := Area3D.new()
	area.position = pos
	var mi := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.8
	tm.outer_radius = 1.2
	mi.mesh = tm
	mi.material_override = _mats["finish"]
	mi.rotation_degrees.x = 90
	mi.position.y = 1.4
	area.add_child(mi)
	var cs := CollisionShape3D.new()
	var ss := SphereShape3D.new()
	ss.radius = 1.4
	cs.shape = ss
	cs.position.y = 1.4
	area.add_child(cs)
	area.body_entered.connect(func(b):
		if b is ParkourPlayer:
			AudioBus.win()
			finish_reached.emit())
	add_child(area)

func _spawn_lava(y: float, size: float) -> void:
	var body := StaticBody3D.new()
	body.position = Vector3(0, y, 0)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(size, 0.5, size)
	mi.mesh = bm
	mi.material_override = _mats["lava"]
	mi.position.y = -0.25
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(size, 1, size)
	cs.shape = bs
	body.add_child(cs)
	body.add_to_group("lava")
	add_child(body)

func _physics_process(delta: float) -> void:
	# движение платформ-ловушек
	for t in _traps:
		var mv: Dictionary = t["move"]
		var node: Node3D = t["node"]
		var axis: String = mv.get("axis", "x")
		var range: float = mv.get("range", 3.0)
		var spd: float = mv.get("speed", 2.0)
		var phase := sin(Time.get_ticks_msec() * 0.001 * spd)
		var off := phase * range
		var np: Vector3 = t["base"]
		match axis:
			"x": np.x += off
			"y": np.y += off
			"z": np.z += off
		node.position = np
	# вращение монет
	for c in _coins:
		if c.visible:
			c.rotate_y(2.2 * delta)

func _spawn_ambient_particles() -> void:
	# пыль/пузыри в воздухе (живость)
	for i in 12:
		var p := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.06
		sm.height = 0.12
		p.mesh = sm
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(1, 1, 1, 0.4)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		p.material_override = m
		p.position = Vector3(randf_range(-15, 15), randf_range(1, 8), randf_range(-30, 5))
		add_child(p)
