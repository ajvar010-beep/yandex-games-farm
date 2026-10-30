class_name ParkourLevel
extends Node3D
## Level — генерирует платформы из JSON, ловушки, монеты, чекпоинты, финиш, лаву.

signal coin_collected
signal checkpoint_reached(pos: Vector3)
signal finish_reached

var _mats: Dictionary = {}
var _coins: Array[Node3D] = []
var _traps: Array[Dictionary] = []
var _crumbles: Array[Dictionary] = []
# v9.1 minor: кэш ссылки на игрока — get_node_or_null("Player") каждый кадр на
# каждую ждущую crumble-платформу = лишний tree-lookup ×60fps ×N платформ.
var _player_ref: Node3D = null
# v8.1 (консилиум v8 #6): маршрут уровня (центры платформ + финиш) для авто-камеры.
# Камера ведётся по СТАТИЧНОЙ геометрии, а не по вектору скорости: ввод camera-relative,
# поэтому доворот по velocity создаёт петлю «камера↔ввод». Маршрут петли не имеет.
var _route: Array[Vector3] = []

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
		m.albedo_texture = _block_texture(COLORS[k], k.hash(), k)
		m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
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
	# крошащаяся платформа: рыжевато-коричневая с тёплым свечением — честно читается как «хрупкая»
	var crmb := StandardMaterial3D.new()
	crmb.albedo_color = Color(0.68, 0.38, 0.22)
	crmb.emission_enabled = true
	crmb.emission = Color(0.5, 0.22, 0.06)
	crmb.emission_energy_multiplier = 0.4
	_mats["crumble"] = crmb
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
	# v9.1 (консилиум v8.2, критик-код MAJOR): hazard-текстура кэшируется — в v8.2
	# каждый _spawn_hazard создавал НОВЫЙ _block_texture(999) + материал; на
	# gauntlet lvl11/17 это 7-12 одинаковых 32×32-текстур на КАЖДУЮ перезагрузку.
	var haz := StandardMaterial3D.new()
	haz.albedo_color = Color(0.85, 0.25, 0.2)
	haz.albedo_texture = _block_texture(Color(0.85, 0.25, 0.2), 999)
	haz.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	haz.emission_enabled = true
	haz.emission = Color(0.8, 0.15, 0.1)
	haz.emission_energy_multiplier = 0.7
	_mats["hazard"] = haz

func load_level(def: Dictionary) -> void:
	# очистка
	for c in get_children():
		c.queue_free()
	_coins.clear()
	_traps.clear()
	_crumbles.clear()
	_route.clear()
	_player_ref = null  # v9.1: игрок может пересоздаваться — кэш перечитается в _physics_process
	_spawn_ambient_particles()

	var plats: Array = def.get("platforms", [])
	# маршрут для авто-камеры: центры платформ в порядке прохождения + финиш
	for p in plats:
		var pd: Dictionary = p
		_route.append(Vector3(float(pd.get("x", 0)), float(pd.get("y", 0)), float(pd.get("z", 0))))
	var fin_route: Array = def.get("finish", [])
	if fin_route.size() == 3:
		_route.append(Vector3(float(fin_route[0]), float(fin_route[1]), float(fin_route[2])))
	# серия Нубик/Про/Бог: difficulty сужает боковую ширину sx и ускоряет mover'ы.
	# Глубину sz и позиции НЕ трогаем — иначе разрывы вырастут и god-уровни станут
	# непроходимыми (smoke-тест валидирует только базовый JSON). Проходимость сохраняется.
	var diff: float = Variant.difficulty
	for p in plats:
		var q: Dictionary = p.duplicate()
		if diff != 1.0:
			q["sx"] = maxf(1.2, float(q.get("sx", 2)) / diff)
			if q.has("move"):
				var mv: Dictionary = (q["move"] as Dictionary).duplicate()
				mv["speed"] = float(mv.get("speed", 2.0)) * diff
				q["move"] = mv
		_spawn_platform(q)
	var coins: Array = def.get("coins", [])
	for c in coins:
		_spawn_coin(Vector3(c[0], c[1], c[2]))
	# опасные блоки (отдельный массив — не путать с проходимостью platforms)
	var hazards: Array = def.get("hazards", [])
	for h in hazards:
		var hd: Dictionary = h
		_spawn_hazard(Vector3(float(hd.get("x", 0)), float(hd.get("y", 0)), float(hd.get("z", 0))),
			Vector3(float(hd.get("sx", 1)), float(hd.get("sy", 1.5)), float(hd.get("sz", 1))))
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

# v8.1 (консилиум v8 #6): точка маршрута ВПЕРЕДИ игрока — цель для авто-камеры.
# Берём ближайшую к игроку точку маршрута и отступаем вперёд на lookahead — камера
# разворачивается по ходу уровня (включая +z-колени серпантина), НЕ по вектору
# скорости: ввод camera-relative, и доворот по velocity дал бы петлю камера↔ввод.
# Возвращает нулевой вектор, если маршрут пуст (уровень не загружен).
func route_ahead_point(from_pos: Vector3, lookahead: int = 2) -> Vector3:
	if _route.is_empty():
		return Vector3.ZERO
	var best := 0
	var best_d := from_pos.distance_squared_to(_route[0])
	for i in range(1, _route.size()):
		var d := from_pos.distance_squared_to(_route[i])
		if d < best_d:
			best_d = d
			best = i
	var idx := mini(best + lookahead, _route.size() - 1)
	return _route[idx]

# процедурная пиксельная текстура блока 16×16 (жанровая конвенция майнкрафта).
# Детерминированный шум по базовому цвету + «шапка» сверху для grass-подобных.
## Процедурная пиксель-текстура блока 32×32 (стиль под материал).
## Три слоя: крупная пятнистость (рельеф/грунт) + мелкий шум + стиль-деталь
## (волокна/трещины/искры/штрихи). Bevel-кромка: светлая сверху-слева, тёмная
## снизу-справа — блоки читаются объёмными кубами, а не плоскими плашками.
func _block_texture(base: Color, seed: int, style: String = "stone") -> ImageTexture:
	const S := 32
	const CELLS := 8
	const CW := float(S) / float(CELLS)
	var img := Image.create_empty(S, S, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	# 1) крупная клеточная пятнистость — органический рельеф (не «ТВ-статик»)
	var cell_n: Array[float] = []
	for i in CELLS * CELLS:
		cell_n.append(rng.randf_range(-0.15, 0.15))
	# 2) мелкий пиксельный шум
	var fine: Array[float] = []
	for i in S * S:
		fine.append(rng.randf_range(-0.045, 0.045))
	# 3) редкие акцентные пиксели (искры золота / камешки песка)
	var sparks := {}
	var spark_n := 10 if style in ["gold", "ice", "sand"] else 5
	for i in spark_n:
		sparks[Vector2i(rng.randi_range(1, S - 2), rng.randi_range(1, S - 2))] = true
	for y in S:
		for x in S:
			var cx := int(float(x) / CW)
			var cy := int(float(y) / CW)
			var m := 1.0 + cell_n[cy * CELLS + cx] + fine[y * S + x]
			var c := base * m
			match style:
				"wood":  # горизонтальные волокна + сучок
					if int(y + sin(float(x) * 0.55) * 1.4) % 5 == 0:
						c = c.darkened(0.20)
					elif int(y + sin(float(x) * 0.55) * 1.4) % 5 == 1:
						c = c.lightened(0.07)
					if (x - 11) * (x - 11) + (y - 20) * (y - 20) < 5:
						c = c.darkened(0.28)
				"grass":  # зелёные «blade»-штрихи светлее + тёмные проплешины
					if (x * 7 + y * 3) % 11 == 0:
						c = c.lightened(0.14)
					elif (x * 5 + y * 9) % 17 == 0:
						c = c.darkened(0.16)
				"stone", "red", "dark":  # трещины — ломаные тёмные линии
					if abs((x * 3 + y * 5 + seed) % 29 - 14) < 1:
						c = c.darkened(0.24)
					elif (x + y * 2 + seed) % 23 == 0:
						c = c.lightened(0.09)
				"sand":  # мелкая рябь-точки
					if (x * x + y * 3) % 7 == 0:
						c = c.lightened(0.10)
					elif (x + y * y) % 9 == 0:
						c = c.darkened(0.10)
				"ice":  # диагональные блики-штрихи
					if (x + y) % 6 == 0:
						c = c.lightened(0.18)
					elif (x - y + S) % 9 == 0:
						c = c.darkened(0.10)
				"gold", "dirt":
					if (x * 3 + y * 7 + seed) % 13 == 0:
						c = c.darkened(0.16)
			# акцентные искры
			if sparks.has(Vector2i(x, y)):
				c = c.lightened(0.45) if style in ["gold", "ice"] else c.darkened(0.35)
			# bevel-кромка: верх/лево светлее, низ/право темнее → объёмный куб
			if x == 0 or y == 0:
				c = c.lightened(0.16)
			if x == S - 1 or y == S - 1:
				c = c.darkened(0.24)
			c.a = 1.0
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)

func _apply_hacker_theme() -> void:
	# тёмное небо
	var env := get_viewport().world_3d.environment
	if env:
		env.background_color = Color(0.01, 0.04, 0.02)
		env.ambient_light_color = Color(0.1, 0.45, 0.15)
		env.ambient_light_energy = 0.4
		env.fog_enabled = true
		env.fog_light_color = Color(0.02, 0.12, 0.04)
		env.fog_density = 0.018
		# v8.1 (#12): матрица ДОЛЖНА светиться — glow на тёмном фоне почти бесплатен
		env.glow_intensity = 0.9
		env.glow_bloom = 0.15
		env.glow_hdr_threshold = 0.85
	# лава-данные (зелёная)
	var data := StandardMaterial3D.new()
	data.albedo_color = Color(0.02, 0.6, 0.1)
	data.emission_enabled = true
	data.emission = Color(0.0, 1.0, 0.2)
	data.emission_energy_multiplier = 2.2
	_mats["lava"] = data
	# монеты — кибер-голубые
	var coin: StandardMaterial3D = _mats["coin"]
	coin.albedo_color = Color(0.2, 0.8, 1.0)
	coin.emission = Color(0.2, 0.8, 1.0)

func _apply_default_theme() -> void:
	var env := get_viewport().world_3d.environment
	if env:
		env.background_color = Color(0.53, 0.75, 0.92)
		env.ambient_light_color = Color(0.7, 0.78, 0.9)
		# v10.3 (отзыв «всё очень засвечено»): 0.45 → 0.30 — синхронно с camera_rig
		# (эта функция правит ТОТ ЖЕ Environment после его _ready → побеждает её
		# значение; обе точки ДОЛЖНЫ держаться одинаковыми, иначе дневные уровни
		# остаются засвеченными — именно это и видел игрок на скриншотах v10.2).
		env.ambient_light_energy = 0.25
		# v8.1: дневная тема — glow ТОЛЬКО по HDR-порогу (лава/монеты), без bloom
		# по всему кадру (иначе небо выбеливается, 51% near-white на lvl11 было).
		# Сброс обязателен: hacker-тема ставит 0.85/0.15, env общий между уровнями.
		# v10.3: glow 0.5 → 0.25 (синхронно с camera_rig).
		env.glow_intensity = 0.25
		env.glow_bloom = 0.0
		env.glow_hdr_threshold = 1.0
		env.fog_enabled = true
		env.fog_light_color = Color(0.6, 0.78, 0.94)
		env.fog_density = 0.012
	var lava: StandardMaterial3D = _mats["lava"]
	lava.albedo_color = Color(1.0, 0.35, 0.05)
	lava.emission = Color(1.0, 0.4, 0.1)
	lava.emission_energy_multiplier = 2.0
	var coin: StandardMaterial3D = _mats["coin"]
	coin.albedo_color = Color(0.2, 0.95, 0.6)
	coin.emission = Color(0.2, 0.95, 0.6)

func _spawn_platform(p: Dictionary) -> void:
	var pos := Vector3(p.get("x", 0), p.get("y", 0), p.get("z", 0))
	var size := Vector3(p.get("sx", 2), p.get("sy", 1), p.get("sz", 2))
	var moving: bool = p.has("move")
	# AnimatableBody3D переносит CharacterBody3D на себе (в отличие от StaticBody3D,
	# где платформа просто уезжает из-под ног)
	var body: PhysicsBody3D = AnimatableBody3D.new() if moving else StaticBody3D.new()
	body.position = pos
	var mat: String = p.get("mat", "grass")
	# физика материалов: лёд скользит, песок тормозит (жанровое ожидание).
	# player._floor_accel_mult() читает группы; PhysicsMaterial — для физдвижка.
	if mat == "ice":
		var pm := PhysicsMaterial.new()
		pm.friction = 0.12
		pm.bounce = 0.05
		body.physics_material_override = pm
		body.add_to_group("ice")
	elif mat == "sand":
		var pm2 := PhysicsMaterial.new()
		pm2.friction = 1.4
		body.physics_material_override = pm2
		body.add_to_group("sand")
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	# крошащаяся платформа получает свой «хрупкий» вид — иначе игрок не может её предвидеть
	if p.has("crumble"):
		# v8.1 (minor): у каждой crumble СВОЙ материал-клон — предупреждение мигает
		# emission, а общий _mats["crumble"] мигнул бы сразу на ВСЕХ крошащихся
		# платформах уровня. Дешёвый клон раз в load_level, не каждый кадр.
		var cm: StandardMaterial3D = _mats["crumble"].duplicate()
		mi.material_override = cm
	else:
		mi.material_override = _mats.get(mat, _mats["grass"])
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	add_child(body)
	# опасный блок: касание = смерть (материал "red" или явный флаг hazard)
	if mat == "red" or bool(p.get("hazard", false)):
		_spawn_hazard(pos, size)
	# крошащаяся платформа: через crumble секунд после касания исчезает, потом респавн
	if p.has("crumble") and not moving:
		# v9.1 minor: maxf — crumble:0 из JSON не должен ломать FSM (деление на 0)
		_crumbles.append({"body": body, "mesh": mi, "cs": cs, "mat": mi.material_override,
			"base": pos, "t": maxf(0.05, float(p["crumble"])), "timer": -1.0})
	# движущаяся ловушка
	if moving:
		# v9.1 (критик-код minor): фаза — накапливаемое игровое время, НЕ wall-clock.
		# Time.get_ticks_msec() тикает на паузе → после unpause платформа
		# телепортировалась в другую фазу (игрок, стоявший на ней, падал).
		_traps.append({"node": body, "base": pos, "move": p["move"], "phase_t": 0.0})

func _spawn_hazard(pos: Vector3, size: Vector3) -> void:
	var hz := Area3D.new()
	hz.add_to_group("hazard")  # v9.1: player._overlaps_hazard() ищет зоны по этой группе
	hz.position = pos
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _mats["hazard"]  # v9.1: общий кэш-материал (см. _make_materials)
	hz.add_child(mi)
	var hcs := CollisionShape3D.new()
	var hbs := BoxShape3D.new()
	hbs.size = size + Vector3(0.1, 0.2, 0.1)
	hcs.shape = hbs
	hz.add_child(hcs)
	hz.body_entered.connect(func(b):
		if b is ParkourPlayer and not b.get("_dead"):
			b.kill())
	add_child(hz)

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
	# v9: кэш игрока — обновляем в начале кадра (нужен и magnet'у, и crumble)
	if _player_ref == null or not is_instance_valid(_player_ref):
		_player_ref = get_parent().get_node_or_null("Player")
	# движение платформ-ловушек
	for t in _traps:
		var mv: Dictionary = t["move"]
		var node: Node3D = t["node"]
		var axis: String = mv.get("axis", "x")
		var range: float = mv.get("range", 3.0)
		var spd: float = mv.get("speed", 2.0)
		# v9.1: phase_t накапливается только когда не на паузе → детерминированно,
		# без скачка после unpause (было Time.get_ticks_msec — wall-clock).
		t["phase_t"] = t.get("phase_t", 0.0) + delta
		var phase := sin(float(t["phase_t"]) * spd)
		var off := phase * range
		var np: Vector3 = t["base"]
		match axis:
			"x": np.x += off
			"y": np.y += off
			"z": np.z += off
		node.position = np
	# вращение монет + v9 МАГНИТ: купленный апгрейд притягивает монеты в радиусе
	# (1.5 + 1.5×уровень) метров к игроку — левитацией, физику не трогаем.
	var magnet_lvl: int = GameState.upgrade_level("magnet")
	var magnet_r: float = 1.5 + 1.5 * magnet_lvl if magnet_lvl > 0 else 0.0
	for c in _coins:
		if c.visible:
			c.rotate_y(2.2 * delta)
			if magnet_lvl > 0 and is_instance_valid(_player_ref):
				var to_p: Vector3 = _player_ref.global_position - c.global_position
				var d := to_p.length()
				if d < magnet_r and d > 0.05:
					c.global_position += to_p.normalized() * minf(9.0 * delta, d)
	# крошащиеся платформы: тронул → таймер → исчезла → респавн через 2.6с.
	# FSM по body.visible: таймер активной фазы всегда ≥0, -1 = «ждём касания».
	# (старая версия с отрицательным таймером-диапазоном мёртвой ветвью не респавнила НИКОГДА)
	var CRUMBLE_RESPAWN := 2.6
	for cr in _crumbles:
		var body: PhysicsBody3D = cr["body"]
		if not is_instance_valid(body): continue
		var timer: float = cr["timer"]
		if body.visible:
			if timer < 0.0:
				# ждём касания: игрок стоит на этой платформе?
				var pl := _player_ref
				if pl and pl.is_on_floor() and _player_on_body(pl, body):
					cr["timer"] = cr["t"]
			else:
				timer -= delta
				if timer <= 0.0:
					# рассыпалась
					body.visible = false
					_disable_collision(body, true)
					cr["timer"] = CRUMBLE_RESPAWN
				else:
					cr["timer"] = timer
					# v8.1 (minor): прогрессивное ПРЕДУПРЕЖДЕНИЕ — тряска + мигание
					# эмиссии, частота/амплитуда растут к моменту распада. Раньше
					# crumble читался только по статичному цвету — окно 0.7с было
					# «невидимым» и игрок падал не понимая почему. Трясём МЕШ (не body):
					# на коллизию/физику не влияет, только визуал.
					var mesh: MeshInstance3D = cr["mesh"]
					var cm: StandardMaterial3D = cr["mat"]
					var frac: float = clampf(1.0 - (timer / cr["t"]), 0.0, 1.0)
					if is_instance_valid(mesh):
						var amp := 0.04 + frac * 0.10
						var sh := randf_range(-amp, amp)
						mesh.position = Vector3(sh, 0.0, sh)
					if is_instance_valid(cm):
						cm.emission_energy_multiplier = 0.4 + (1.5 + frac * 3.0) * absf(sin(timer * (18.0 + frac * 30.0)))
		else:
			# исчезла — отсчитываем респавн
			timer -= delta
			if timer <= 0.0:
				body.visible = true
				_disable_collision(body, false)
				cr["timer"] = -1.0
				# v8.1 (minor): сброс предупреждения — меш на место, эмиссия базовая
				var mesh: MeshInstance3D = cr["mesh"]
				var cm: StandardMaterial3D = cr["mat"]
				if is_instance_valid(mesh): mesh.position = Vector3.ZERO
				if is_instance_valid(cm): cm.emission_energy_multiplier = 0.4
			else:
				cr["timer"] = timer

func _player_on_body(pl: Node, body: PhysicsBody3D) -> bool:
	for i in pl.get_slide_collision_count():
		var col = pl.get_slide_collision(i)
		if col and col.get_collider() == body:
			return true
	return false

func _disable_collision(body: PhysicsBody3D, off: bool) -> void:
	for ch in body.get_children():
		if ch is CollisionShape3D:
			ch.disabled = off

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
