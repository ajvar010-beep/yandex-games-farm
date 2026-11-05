extends Node3D
## Game — игровая сцена: камень, тапы, рабочие, уровни, босс, HUD, магазин.
## 3D-сцена (шахта) + CanvasLayer UI. Весь UI программный (меню и панели в menu.gd нет — тут).

const LEVELS_PATH := "res://levels/levels.json"

var _levels: Array = []
var _lvl: Dictionary = {}
var _level := 1

# камень
var _rock: Node3D = null
var _rock_mesh: MeshInstance3D = null
var _crack_overlays: Array[MeshInstance3D] = []
var _rock_hp := 0.0
var _rock_max := 0
var _rocks_broken := 0
var _golden := false

# сцена
var _cam: Camera3D = null
var _env: WorldEnvironment = null
var _sun: DirectionalLight3D = null
var _ground: MeshInstance3D = null
var _workers_root: Node3D = null        # паразитные юниты (кирки/каски/машины)
var _rock_home := Vector3(0, 1.6, 0)    # центр камня
var _debris: Array[Node3D] = []
var _floaters: Array[Dictionary] = []   # {label, t, vel}
var _spark_parts: GPUParticles3D = null

# UI
var _hud: Control = null
var _coins_lbl: Label = null
var _dps_lbl: Label = null
var _lvl_lbl: Label = null
var _prog: ProgressBar = null
var _rock_bar: ProgressBar = null
var _boss_bar: Control = null
var _boss_timer_lbl: Label = null
var _toast_lbl: Label = null
var _tut_lbl: Label = null
var _shop_panel: Control = null
var _pause_panel: Control = null
var _win_panel: Control = null
var _fail_panel: Control = null
var _btn_shop: Button = null
var _btn_menu: Button = null
var _btn_sound: Button = null
var _vein_lbl: Label = null

var _running := false
var _won := false
var _boss_t := 0.0                      # остаток таймера босса
var _boss_active := false
var _dps_acc := 0.0                     # накопитель дробного урона от DPS
var _interstitial_counter := 0          # уровней с прошлого interstitial
var _rewarded_coins := 0                # награда уровня (для удвоения)
var _toast_t := 0.0

func _ready() -> void:
	_load_levels()
	_build_scene()
	_build_ui()
	set_process(true)
	set_physics_process(true)

func _load_levels() -> void:
	var f := FileAccess.open(LEVELS_PATH, FileAccess.READ)
	if f:
		var d = JSON.parse_string(f.get_as_text())
		f.close()
		if d is Dictionary and d.has("levels"):
			_levels = d["levels"]

func load_level(n: int) -> void:
	_level = clampi(n, 1, _levels.size())
	_lvl = _levels[_level - 1]
	_rocks_broken = 0
	_won = false
	_running = true
	_boss_active = bool(_lvl.get("boss", false))
	_boss_t = float(_lvl.get("boss_time", 0)) + GameState.boss_time_bonus()
	_apply_theme()
	_spawn_rock()
	_rebuild_workers()
	_update_hud()
	_update_boss_ui()
	if not GameState.tutorial_done and _level == 1:
		_show_tutorial(GameState.L("tut_tap"))

# ---------- сцена ----------

func _build_scene() -> void:
	_cam = Camera3D.new()
	_cam.position = Vector3(0, 2.6, 7.2)
	_cam.rotation_degrees = Vector3(-14, 0, 0)
	_cam.fov = 55
	add_child(_cam)

	_env = WorldEnvironment.new()
	_env.environment = Environment.new()
	add_child(_env)

	_sun = DirectionalLight3D.new()
	_sun.rotation_degrees = Vector3(-50, 30, 0)
	_sun.shadow_enabled = true
	add_child(_sun)
	var fill := OmniLight3D.new()
	fill.position = Vector3(2.5, 4.0, 3.0)
	fill.light_energy = 0.4
	fill.omni_range = 12.0
	add_child(fill)

	# пол шахты
	_ground = MeshInstance3D.new()
	var gm := BoxMesh.new(); gm.size = Vector3(14, 0.3, 10)
	_ground.mesh = gm
	_ground.position = Vector3(0, -0.15, 0)
	_ground.material_override = _mat(Color(0.24, 0.20, 0.17))
	add_child(_ground)
	# задняя стена
	var wall := MeshInstance3D.new()
	var wm := BoxMesh.new(); wm.size = Vector3(14, 8, 0.3)
	wall.mesh = wm
	wall.position = Vector3(0, 3.5, -3.2)
	wall.material_override = _mat(Color(0.16, 0.13, 0.11))
	add_child(wall)

	_workers_root = Node3D.new()
	add_child(_workers_root)

	# искры (GPU particles, переиспользуем эмиттер)
	_spark_parts = _make_sparks()
	add_child(_spark_parts)

func _apply_theme() -> void:
	# глава: 1-10 шахта, 11-20 глубь, 21-30 магма
	var ch := Variant.chapter_of(_level)
	var env := _env.environment
	env.background_mode = Environment.BG_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	if ch == 1:
		env.background_color = Color(0.09, 0.075, 0.10)
		env.ambient_light_color = Color(0.55, 0.48, 0.42)
		env.ambient_light_energy = 0.35
		_sun.light_color = Color(1.0, 0.85, 0.6)   # тёплые лампы
		_sun.light_energy = 0.7
		_ground.material_override = _mat(Color(0.26, 0.21, 0.17))
	elif ch == 2:
		env.background_color = Color(0.04, 0.06, 0.12)
		env.ambient_light_color = Color(0.35, 0.45, 0.65)
		env.ambient_light_energy = 0.30
		_sun.light_color = Color(0.6, 0.75, 1.0)   # холодная глубина
		_sun.light_energy = 0.55
		_ground.material_override = _mat(Color(0.16, 0.20, 0.30))
	else:
		env.background_color = Color(0.16, 0.05, 0.04)
		env.ambient_light_color = Color(0.9, 0.4, 0.25)
		env.ambient_light_energy = 0.32
		_sun.light_color = Color(1.0, 0.5, 0.25)   # магма
		_sun.light_energy = 0.7
		_ground.material_override = _mat(Color(0.30, 0.12, 0.08))
	# на затопленном — синяя гладь воды на полу
	var flooded: bool = str(_lvl.get("ban", "")) == "machines"
	var water := get_node_or_null("Water")
	if flooded and water == null:
		var w := MeshInstance3D.new()
		w.name = "Water"
		var wm := PlaneMesh.new(); wm.size = Vector2(14, 10)
		w.mesh = wm
		w.position = Vector3(0, 0.02, 0)
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.15, 0.4, 0.7, 0.6)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.metallic = 0.6; m.roughness = 0.1
		w.material_override = m
		add_child(w)
	elif not flooded and water != null:
		water.queue_free()

func _mat(c: Color, rough := 0.9, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

func _make_sparks() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 24
	p.lifetime = 0.5
	p.explosiveness = 0.9
	p.one_shot = true
	p.emitting = false
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 45.0
	pm.initial_velocity_min = 3.0
	pm.initial_velocity_max = 6.0
	pm.gravity = Vector3(0, -12, 0)
	pm.scale_min = 0.06
	pm.scale_max = 0.14
	pm.color = Color(1.0, 0.85, 0.4)
	p.process_material = pm
	var quad := QuadMesh.new(); quad.size = Vector2(0.12, 0.12)
	p.draw_pass_1 = quad
	return p

# ---------- камень ----------

func _spawn_rock() -> void:
	if _rock:
		_rock.queue_free()
		_crack_overlays.clear()
	_golden = (not _boss_active) and randf() < float(_lvl.get("golden_prob", 0.0))
	_rock_max = int(_lvl.get("rock_hp", 20))
	_rock_hp = float(_rock_max)

	_rock = Node3D.new()
	_rock.position = _rock_home
	add_child(_rock)

	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(2.6, 2.6, 2.6)
	body.mesh = bm
	# цвет: глава + золотая жила
	var c := Color(0.45, 0.40, 0.38)
	if Variant.chapter_of(_level) == 2: c = Color(0.30, 0.36, 0.50)
	elif Variant.chapter_of(_level) == 3: c = Color(0.35, 0.18, 0.12)
	if _golden: c = Color(0.95, 0.78, 0.25)
	body.material_override = _mat(c, 0.95, 0.05)
	# лёгкое случайное вращение формы
	body.rotation_degrees = Vector3(randf_range(-6, 6), randf_range(-12, 12), randf_range(-6, 6))
	_rock_mesh = body
	_rock.add_child(body)

	# 3 слоя трещин (показываются по мере урона): тёмные врезки
	for i in 3:
		var cr := MeshInstance3D.new()
		var cm := BoxMesh.new(); cm.size = Vector3(2.66 + i * 0.02, 0.10 + i * 0.03, 2.66 + i * 0.02)
		cr.mesh = cm
		cr.rotation_degrees = Vector3(randf_range(0, 90), randf_range(0, 90), randf_range(0, 90))
		var cm_m := StandardMaterial3D.new()
		cm_m.albedo_color = Color(0.08, 0.07, 0.06, 0.85)
		cm_m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		cm_m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		cr.material_override = cm_m
		cr.visible = false
		_rock.add_child(cr)
		_crack_overlays.append(cr)
	_update_cracks()

func _update_cracks() -> void:
	var frac := 1.0 - (_rock_hp / maxf(1.0, float(_rock_max)))
	for i in _crack_overlays.size():
		_crack_overlays[i].visible = frac > (float(i + 1) / 4.0)

func _rock_screen_pos() -> Vector2:
	return _cam.unproject_position(_rock_home)

# ---------- ввод ----------

func _unhandled_input(event: InputEvent) -> void:
	if not _running: return
	# тап/клик по экрану → попадание по камню, если луч попал в область камня
	var pos := Vector2(-1, -1)
	if event is InputEventScreenTouch and event.pressed:
		pos = event.position
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		pos = event.position
	if pos.x < 0: return
	# игнорируем клики по UI (HUD кнопки обрабатываются сами; здесь только «мимо UI»)
	if _shop_panel and _shop_panel.visible: return
	if _pause_panel and _pause_panel.visible: return
	if _win_panel and _win_panel.visible: return
	if _fail_panel and _fail_panel.visible: return
	# попадание: луч из камеры
	var from := _cam.project_ray_origin(pos)
	var dir := _cam.project_ray_normal(pos)
	var to := from + dir * 30.0
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, to)
	# у камня нет физ-тела — проверяем попадание по сфере вручную
	var hit := _ray_hits_rock(from, to)
	if hit:
		_tap_rock(pos)

func _ray_hits_rock(from: Vector3, to: Vector3) -> bool:
	# сфера вокруг _rock_home радиусом ~1.9 (камень 2.6 полу-diagonal ≈2.25, щедро)
	var r := 2.1
	var oc := from - _rock_home
	var d := (to - from).normalized()
	var b := oc.dot(d)
	var c := oc.dot(oc) - r * r
	var disc := b * b - c
	if disc < 0.0: return false
	var t := -b - sqrt(disc)
	return t > 0.0

func _tap_rock(screen_pos: Vector2) -> void:
	if not _running or _won: return
	var dmg := GameState.tap_power()
	var crit := randf() < GameState.crit_chance()
	if crit: dmg *= 3
	_apply_damage(float(dmg))
	_hit_visual(crit)
	_spawn_floater("-%d" % dmg + (" ✦" if crit else ""), screen_pos)
	AudioBus.hit()
	# кирки-рабочие тоже «бьют» — визуальный отклик
	_pulse_picks()

func _apply_damage(n: float) -> void:
	# общий вход урона (тап и DPS)
	if not _running or _won: return
	_rock_hp -= n
	_update_cracks()
	_update_rock_bar()
	if _rock_hp <= 0.0:
		_break_rock()

func _break_rock() -> void:
	_rocks_broken += 1
	var reward := int(_lvl.get("reward", 10))
	if _golden:
		reward *= 3
		_gems_pop()
	AudioBus.crumble()
	_spawn_debris()
	GameState.add_coins(reward)
	_spawn_floater("+%d ◈" % reward, _rock_screen_pos())
	_prog.value = _rocks_broken
	if _rocks_broken >= int(_lvl.get("rocks", 10)):
		_complete_level()
	else:
		_spawn_rock()
	_update_hud()

func _gems_pop() -> void:
	# золотая жила даёт кристалл
	GameState.gems += 1
	if _vein_lbl:
		_vein_lbl.visible = true
		_vein_lbl.modulate.a = 1.0

func _hit_visual(crit: bool) -> void:
	# squash камня + искры
	if _rock_mesh:
		var tw := create_tween()
		tw.tween_property(_rock_mesh, "scale", Vector3(0.92, 0.88, 0.92), 0.05)
		tw.tween_property(_rock_mesh, "scale", Vector3.ONE, 0.12).set_trans(Tween.TRANS_BACK)
	if _spark_parts:
		_spark_parts.position = _rock_home + Vector3(randf_range(-0.8, 0.8), randf_range(-0.5, 0.8), 0.5)
		_spark_parts.restart()
	if crit:
		AudioBus.crack()

func _spawn_debris() -> void:
	# 6 кубиков-обломков с физикой-имитацией
	for i in 6:
		var d := MeshInstance3D.new()
		var m := BoxMesh.new(); m.size = Vector3(0.35, 0.35, 0.35)
		d.mesh = m
		d.material_override = _mat(_rock_mesh.material_override.albedo_color, 0.95)
		d.position = _rock_home + Vector3(randf_range(-0.6, 0.6), randf_range(-0.4, 0.6), randf_range(-0.3, 0.3))
		add_child(d)
		_debris.append(d)
		var vel := Vector3(randf_range(-3, 3), randf_range(3, 7), randf_range(-2, 1))
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(d, "position", d.position + vel, 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tw.tween_property(d, "scale", Vector3.ZERO, 0.7)
		tw.chain().tween_callback(d.queue_free)

func _spawn_floater(text: String, pos: Vector2) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 26)
	l.add_theme_color_override("font_color", Color(1, 1, 1))
	l.position = pos + Vector2(-30, -20)
	l.z_index = 50
	_hud.add_child(l)
	_floaters.append({"label": l, "t": 0.0, "vel": Vector2(randf_range(-10, 10), -90)})

# ---------- DPS-тик ----------

func _physics_process(delta: float) -> void:
	if not _running or _won: return
	# пассивный урон рабочих
	var d := GameState.dps(_lvl)
	if d > 0:
		_dps_acc += d * delta
		if _dps_acc >= 1.0:
			var whole := int(_dps_acc)
			_dps_acc -= whole
			_apply_damage(float(whole))
	# таймер босса
	if _boss_active and _boss_t > 0.0:
		_boss_t -= delta
		_update_boss_ui()
		if _boss_t <= 0.0 and not _won:
			_boss_failed()
	# анимации рабочих
	_animate_workers(delta)
	# floaters
	for i in range(_floaters.size() - 1, -1, -1):
		var f = _floaters[i]
		f["t"] += delta
		var l: Label = f["label"]
		l.position += f["vel"] * delta
		l.modulate.a = clampf(1.0 - f["t"] / 1.1, 0, 1)
		if f["t"] > 1.1:
			l.queue_free()
			_floaters.remove_at(i)
	# тост затухает
	if _toast_t > 0:
		_toast_t -= delta
		if _toast_t <= 0 and _toast_lbl:
			_toast_lbl.visible = false

func _boss_failed() -> void:
	_running = false
	AudioBus.fail()
	Yandex.gameplay_stop()
	_show_fail_panel()

func _complete_level() -> void:
	_won = true
	_running = false
	_rewarded_coins = int(_lvl.get("reward", 0))  # уже начислено в _break_rock; для «удвоения» — сумма
	AudioBus.win()
	GameState.flush_save()
	# лидерборд глубины
	Yandex.submit_score("depth", _level * 10)
	# открытие нового уровня
	if _level >= GameState.max_level and _level < _levels.size():
		GameState.max_level = _level + 1
	GameState.save_data()
	# интерстишиал каждые 3 пройденных уровня (кулдаун 95с), потом win-панель
	_interstitial_counter += 1
	var show_ad := _interstitial_counter >= 3 and not GameState.no_ads
	if show_ad:
		_interstitial_counter = 0
		var now := Time.get_ticks_msec()
		if now - GameState.last_interstitial_ms >= 95000:
			GameState.last_interstitial_ms = now
			Yandex.show_fullscreen(Callable(self, "_show_win_panel"))
			return
	_show_win_panel()

# ---------- рабочие на экране ----------

func _rebuild_workers() -> void:
	for c in _workers_root.get_children():
		c.queue_free()
	# кирки: веер над камнем (по одной на штуку, до 10 видимых на тип — кап 12 спрайтов)
	var picks := []
	for id in GameState.GEAR_ORDER:
		if GameState.GEAR[id]["kind"] == "pick":
			for i in GameState.gear_owned(id):
				picks.append(id)
	var shown := 0
	for i in picks.size():
		if shown >= 12: break
		var p: Node3D = _make_pick(int(GameState.GEAR[picks[i]]["tier"]))
		var ang: float = lerpf(-1.1, 1.1, (float(i) + 0.5) / maxf(1.0, float(picks.size())))
		p.position = _rock_home + Vector3(sin(ang) * 3.4, 2.2 + abs(ang) * 0.4, 0.6)
		p.set_meta("kind", "pick"); p.set_meta("phase", randf() * TAU)
		_workers_root.add_child(p)
		shown += 1
	# каски: шахтёры рядом с камнем (до 6)
	var helms := []
	for id in GameState.GEAR_ORDER:
		if GameState.GEAR[id]["kind"] == "helm":
			for i in GameState.gear_owned(id):
				helms.append(id)
	for i in mini(helms.size(), 6):
		var h: Node3D = _make_miner(int(GameState.GEAR[helms[i]]["tier"]))
		h.position = Vector3(-4.6 + i * 1.85, 0.0, 2.2)
		h.set_meta("kind", "miner"); h.set_meta("phase", randf() * TAU)
		_workers_root.add_child(h)
	# машины: слева/справа (до 4)
	var machs := []
	for id in GameState.GEAR_ORDER:
		if GameState.GEAR[id]["kind"] == "mach":
			for i in GameState.gear_owned(id):
				machs.append(id)
	var banned := str(_lvl.get("ban", ""))
	for i in mini(machs.size(), 4):
		var m: Node3D = _make_machine(int(GameState.GEAR[machs[i]]["tier"]))
		m.position = Vector3(-5.6 + i * 3.6, 0.0, -1.4)
		m.set_meta("kind", "mach"); m.set_meta("phase", randf() * TAU)
		# затопленный уровень: машина видна, но «замолкла» (приглушена)
		if banned == "machines":
			m.modulate = Color(0.5, 0.6, 0.7, 0.85)
		_workers_root.add_child(m)

func _make_pick(tier: int) -> Node3D:
	# кирка = палка + наконечник; цвет по тиру
	var root := Node3D.new()
	var stick := MeshInstance3D.new()
	var sm := BoxMesh.new(); sm.size = Vector3(0.10, 0.9, 0.10)
	stick.mesh = sm
	stick.material_override = _mat(Color(0.45, 0.30, 0.15))
	root.add_child(stick)
	var head := MeshInstance3D.new()
	var hm := BoxMesh.new(); hm.size = Vector3(0.7, 0.18, 0.14)
	head.mesh = hm
	head.position = Vector3(0, 0.45, 0)
	var colors := [Color(0.6,0.4,0.2), Color(0.55,0.55,0.58), Color(0.7,0.45,0.2), Color(0.5,0.5,0.55),
		Color(0.6,0.65,0.75), Color(0.95,0.78,0.25), Color(0.4,0.8,0.95), Color(0.8,0.3,0.95)]
	head.material_override = _mat(colors[clampi(tier,0,7)], 0.5, 0.4)
	root.add_child(head)
	return root

func _make_miner(tier: int) -> Node3D:
	# блочный шахтёр: тело + голова + каска (светится в темноте)
	var root := Node3D.new()
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new(); bm.size = Vector3(0.6, 0.9, 0.4)
	body.mesh = bm; body.position = Vector3(0, 0.45, 0)
	body.material_override = _mat(Color(0.35, 0.35, 0.45))
	root.add_child(body)
	var head := MeshInstance3D.new()
	var hm := BoxMesh.new(); hm.size = Vector3(0.45, 0.45, 0.45)
	head.mesh = hm; head.position = Vector3(0, 1.12, 0)
	head.material_override = _mat(Color(0.94, 0.75, 0.60))
	root.add_child(head)
	var helm := MeshInstance3D.new()
	var helm_m := BoxMesh.new(); helm_m.size = Vector3(0.5, 0.22, 0.5)
	helm.mesh = helm_m; helm.position = Vector3(0, 1.38, 0)
	var cols := [Color(0.7,0.45,0.2), Color(0.5,0.5,0.55), Color(0.6,0.65,0.75), Color(0.95,0.78,0.25), Color(0.4,0.8,0.95), Color(0.95,0.35,0.2)]
	helm.material_override = _mat(cols[clampi(tier,0,5)], 0.4, 0.5, 0.6)
	root.add_child(helm)
	# лампочка на каске
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0, 1.4, 0.3)
	lamp.light_energy = 0.25
	lamp.omni_range = 2.0
	lamp.light_color = Color(1.0, 0.9, 0.6)
	root.add_child(lamp)
	return root

func _make_machine(tier: int) -> Node3D:
	# машина = корпус + бур/лазер
	var root := Node3D.new()
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new(); bm.size = Vector3(1.1, 0.8, 0.9)
	body.mesh = bm; body.position = Vector3(0, 0.4, 0)
	var cols := [Color(0.8,0.5,0.1), Color(0.6,0.3,0.1), Color(0.3,0.5,0.8), Color(0.7,0.4,0.1), Color(0.5,0.2,0.7), Color(0.9,0.2,0.2)]
	body.material_override = _mat(cols[clampi(tier,0,5)], 0.5, 0.5)
	root.add_child(body)
	var drill := MeshInstance3D.new()
	var dm := CylinderMesh.new(); dm.top_radius = 0.05; dm.bottom_radius = 0.22; dm.height = 0.9
	drill.mesh = dm
	drill.position = Vector3(0.7, 0.5, 0)
	drill.rotation_degrees = Vector3(0, 0, -60)
	drill.material_override = _mat(Color(0.7, 0.7, 0.75), 0.3, 0.7)
	root.add_child(drill)
	return root

func _pulse_picks() -> void:
	# кирки «взмахивают» при тапе
	for c in _workers_root.get_children():
		if c.get_meta("kind", "") == "pick":
			var tw := create_tween()
			tw.tween_property(c, "rotation_degrees", Vector3(0, 0, -25), 0.06)
			tw.tween_property(c, "rotation_degrees", Vector3(0, 0, 10), 0.14)

func _animate_workers(delta: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for c in _workers_root.get_children():
		var k: String = c.get_meta("kind", "")
		var ph: float = c.get_meta("phase", 0.0)
		if k == "miner":
			# шахтёр покачивается (бьёт киркой)
			c.rotation_degrees.z = sin(t * 4.0 + ph) * 8.0
		elif k == "mach":
			c.position.y = 0.0 + abs(sin(t * 3.0 + ph)) * 0.06  # вибрация
		elif k == "pick":
			c.rotation_degrees.z = sin(t * 2.0 + ph) * 6.0

# ---------- UI ----------

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.name = "HUD"
	add_child(layer)
	_hud = Control.new()
	_hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE  # тапы проходят к камню
	layer.add_child(_hud)

	# верхняя панель: монеты/кристаллы + dps + уровень
	var top := HBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_top = 8; top.offset_left = 12; top.offset_right = -12
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(top)
	_coins_lbl = _mk_label(30, Color(1.0, 0.9, 0.4))
	top.add_child(_coins_lbl)
	var spacer := Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(spacer)
	_lvl_lbl = _mk_label(24, Color(1, 1, 1))
	top.add_child(_lvl_lbl)
	var spacer2 := Control.new(); spacer2.size_flags_horizontal = Control.SIZE_EXPAND_FILL; spacer2.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(spacer2)
	_dps_lbl = _mk_label(22, Color(0.7, 0.95, 1.0))
	top.add_child(_dps_lbl)
	_btn_sound = _mk_btn("🔊", 22)
	_btn_sound.pressed.connect(_on_sound)
	_btn_sound.mouse_filter = Control.MOUSE_FILTER_STOP
	top.add_child(_btn_sound)

	# прогресс уровня
	_prog = ProgressBar.new()
	_prog.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_prog.offset_left = 12; _prog.offset_right = -12; _prog.offset_top = 56; _prog.offset_bottom = 78
	_prog.min_value = 0; _prog.max_value = int(_lvl.get("rocks", 10)); _prog.value = 0
	_prog.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(_prog)

	# HP камня (плавает над камнем — позиционируем в _process через unproject)
	_rock_bar = ProgressBar.new()
	_rock_bar.custom_minimum_size = Vector2(220, 18)
	_rock_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(_rock_bar)

	# босс-панель (таймер)
	_boss_bar = Control.new()
	_boss_bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_boss_bar.offset_top = 84
	_boss_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(_boss_bar)
	_boss_timer_lbl = _mk_label(26, Color(1.0, 0.4, 0.3))
	_boss_timer_lbl.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_boss_timer_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_timer_lbl.offset_left = -200; _boss_timer_lbl.offset_right = 200
	_boss_bar.add_child(_boss_timer_lbl)
	var bl := _mk_label(20, Color(1.0, 0.6, 0.3))
	bl.text = GameState.L("boss")
	bl.set_anchors_preset(Control.PRESET_CENTER_TOP)
	bl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bl.offset_left = -200; bl.offset_right = 200; bl.offset_top = 30
	_boss_bar.add_child(bl)
	_boss_bar.visible = false

	# тост / туториал
	_toast_lbl = _mk_label(24, Color(1.0, 1.0, 0.6))
	_toast_lbl.set_anchors_preset(Control.PRESET_CENTER)
	_toast_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast_lbl.offset_left = -300; _toast_lbl.offset_right = 300; _toast_lbl.offset_top = -120; _toast_lbl.offset_bottom = -90
	_toast_lbl.visible = false
	_hud.add_child(_toast_lbl)
	_tut_lbl = _mk_label(24, Color(1, 1, 1))
	_tut_lbl.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_tut_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tut_lbl.offset_left = -350; _tut_lbl.offset_right = 350; _tut_lbl.offset_top = -140; _tut_lbl.offset_bottom = -90
	_tut_lbl.visible = false
	_hud.add_child(_tut_lbl)
	_vein_lbl = _mk_label(28, Color(1.0, 0.9, 0.3))
	_vein_lbl.text = GameState.L("golden_vein")
	_vein_lbl.set_anchors_preset(Control.PRESET_CENTER)
	_vein_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_vein_lbl.offset_left = -200; _vein_lbl.offset_right = 200; _vein_lbl.offset_top = -180; _vein_lbl.offset_bottom = -140
	_vein_lbl.visible = false
	_hud.add_child(_vein_lbl)

	# нижние кнопки: магазин / меню
	var bottom := HBoxContainer.new()
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_left = 12; bottom.offset_right = -12; bottom.offset_bottom = -12; bottom.offset_top = -68
	bottom.add_theme_constant_override("separation", 12)
	_hud.add_child(bottom)
	_btn_menu = _mk_btn(GameState.L("menu"), 22)
	_btn_menu.pressed.connect(_on_menu)
	bottom.add_child(_btn_menu)
	var bsp := Control.new(); bsp.size_flags_horizontal = Control.SIZE_EXPAND_FILL; bsp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bottom.add_child(bsp)
	_btn_shop = _mk_btn("⛏ " + GameState.L("shop"), 24)
	_btn_shop.pressed.connect(_on_shop)
	bottom.add_child(_btn_shop)

	# панели (скрыты)
	_build_panels()
	_update_hud()

func _mk_label(size: int, color: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _mk_btn(text: String, size: int) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	b.custom_minimum_size = Vector2(0, 52)
	b.mouse_filter = Control.MOUSE_FILTER_STOP
	return b

func _update_hud() -> void:
	if _coins_lbl:
		_coins_lbl.text = "%d ◈  ◆ %d" % [GameState.coins, GameState.gems]
	if _dps_lbl:
		_dps_lbl.text = GameState.L("per_sec") % GameState.dps(_lvl) + "  " + (GameState.L("tap_power") % GameState.tap_power())
	if _lvl_lbl:
		_lvl_lbl.text = GameState.L("level") % _level + "  " + (GameState.L("depth") % (_level * 10))
	if _prog:
		_prog.max_value = int(_lvl.get("rocks", 10))
		_prog.value = _rocks_broken
	_update_rock_bar()

func _update_rock_bar() -> void:
	if not _rock_bar: return
	_rock_bar.max_value = _rock_max
	_rock_bar.value = maxf(0.0, _rock_hp)
	var sp := _rock_screen_pos()
	_rock_bar.position = sp + Vector2(-110, -170)

func _update_boss_ui() -> void:
	if _boss_bar:
		_boss_bar.visible = _boss_active
	if _boss_active and _boss_timer_lbl:
		_boss_timer_lbl.text = GameState.L("boss_time") % int(ceil(maxf(0.0, _boss_t)))

func _process(_delta: float) -> void:
	_update_rock_bar()
	if _vein_lbl and _vein_lbl.visible:
		_vein_lbl.modulate.a -= _delta * 0.5
		if _vein_lbl.modulate.a <= 0.0:
			_vein_lbl.visible = false

func _toast(msg: String) -> void:
	_toast_lbl.text = msg
	_toast_lbl.visible = true
	_toast_lbl.modulate.a = 1.0
	_toast_t = 2.2

func _show_tutorial(msg: String) -> void:
	_tut_lbl.text = msg
	_tut_lbl.visible = true
	await get_tree().create_timer(5.0).timeout
	if is_instance_valid(_tut_lbl):
		_tut_lbl.visible = false

# ---------- панели ----------

func _build_panels() -> void:
	_shop_panel = _mk_overlay("SHOP")
	_pause_panel = _mk_overlay("PAUSE")
	_win_panel = _mk_overlay("WIN")
	_fail_panel = _mk_overlay("FAIL")
	_build_shop()
	_build_pause()
	_build_win()
	_build_fail()

func _mk_overlay(n: String) -> PanelContainer:
	var p := PanelContainer.new()
	p.name = n
	p.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.visible = false
	p.process_mode = Node.PROCESS_MODE_ALWAYS
	# полупрозрачный фон
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0.72)
	p.add_theme_stylebox_override("panel", sb)
	_hud.add_child(p)
	return p

func _build_pause() -> void:
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.add_theme_constant_override("separation", 14)
	v.custom_minimum_size = Vector2(360, 0)
	_pause_panel.add_child(v)
	var h := _mk_label(34, Color(1, 1, 1)); h.text = GameState.L("pause"); h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(h)
	var cont := _mk_btn(GameState.L("continue"), 24); cont.pressed.connect(func(): _pause_panel.visible = false; _running = true; get_tree().paused = false)
	v.add_child(cont)
	var snd := _mk_btn(GameState.L("sound_on" if GameState.sound_on else "sound_off"), 20); snd.pressed.connect(_on_sound)
	v.add_child(snd)
	var menu := _mk_btn(GameState.L("menu"), 22); menu.pressed.connect(_on_menu)
	v.add_child(menu)

func _build_win() -> void:
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.add_theme_constant_override("separation", 12)
	v.custom_minimum_size = Vector2(420, 0)
	_win_panel.add_child(v)
	var h := _mk_label(32, Color(0.6, 1.0, 0.6)); h.name = "Title"; h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(h)
	var r := _mk_label(24, Color(1.0, 0.9, 0.4)); r.name = "Reward"; r.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(r)
	var unlock := _mk_label(20, Color(0.5, 1.0, 0.8)); unlock.name = "Unlock"; unlock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(unlock)
	var dbl := _mk_btn(GameState.L("double_win"), 22); dbl.name = "Double"
	dbl.pressed.connect(_on_win_double)
	v.add_child(dbl)
	var next := _mk_btn(GameState.L("next"), 26); next.name = "Next"
	next.pressed.connect(_on_next)
	v.add_child(next)
	var menu := _mk_btn(GameState.L("menu"), 20); menu.pressed.connect(_on_menu)
	v.add_child(menu)

func _build_fail() -> void:
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.add_theme_constant_override("separation", 12)
	v.custom_minimum_size = Vector2(420, 0)
	_fail_panel.add_child(v)
	var h := _mk_label(32, Color(1.0, 0.5, 0.4)); h.text = GameState.L("boss_fail"); h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(h)
	var rv := _mk_btn(GameState.L("boss_rv") % 15, 22)
	rv.name = "RV"
	rv.pressed.connect(_on_fail_rv)
	v.add_child(rv)
	var retry := _mk_btn(GameState.L("boss_retry"), 24)
	retry.pressed.connect(func():
		_fail_panel.visible = false
		load_level(_level))
	v.add_child(retry)
	var menu := _mk_btn(GameState.L("menu"), 20); menu.pressed.connect(_on_menu)
	v.add_child(menu)

func _show_fail_panel() -> void:
	_fail_panel.visible = true
	var rv_btn: Button = _fail_panel.find_child("RV", true, false)
	if rv_btn:
		rv_btn.text = GameState.L("boss_rv") % 15
		rv_btn.disabled = false

func _show_win_panel() -> void:
	_win_panel.visible = true
	var t: Label = _win_panel.find_child("Title", true, false)
	var r: Label = _win_panel.find_child("Reward", true, false)
	var u: Label = _win_panel.find_child("Unlock", true, false)
	var dbl: Button = _win_panel.find_child("Double", true, false)
	if t: t.text = GameState.L("level_done")
	if r: r.text = GameState.L("reward_n") % _rewarded_coins
	# что открылось на новом уровне
	if u:
		var nxt := _level + 1
		var news := []
		for id in GameState.GEAR_ORDER:
			if int(GameState.GEAR[id]["unlock"]) == nxt and nxt <= _levels.size():
				news.append(GameState.L(id))
		u.text = (GameState.L("new_gear") % ", ".join(news)) if news.size() > 0 else ""
		if news.size() > 0: AudioBus.unlock()
	if dbl:
		dbl.text = GameState.L("double_win")
		dbl.disabled = false
	AudioBus.level_up()

func _on_win_double() -> void:
	var dbl: Button = _win_panel.find_child("Double", true, false)
	if dbl: dbl.disabled = true
	Yandex.show_rewarded(func():
		GameState.add_coins(_rewarded_coins)
		_toast(GameState.L("doubled"))
		_update_hud(),
	func():
		_toast(GameState.L("rv_no_reward"))
		if dbl: dbl.disabled = false)

func _on_fail_rv() -> void:
	_fail_panel.visible = false
	Yandex.show_rewarded(func():
		_boss_t += 15.0
		_running = true
		Yandex.gameplay_start(),
	func():
		_fail_panel.visible = true)

func _on_next() -> void:
	_win_panel.visible = false
	if _level < _levels.size():
		load_level(_level + 1)
	else:
		_on_menu()  # финал 30-го — в меню

func _on_menu() -> void:
	get_tree().paused = false
	GameState.flush_save()
	var main := get_parent()
	# GameHolder — родитель; main — его родитель
	if main and main.get_parent() and main.get_parent().has_method("back_to_menu"):
		main.get_parent().back_to_menu()
	elif main and main.has_method("back_to_menu"):
		main.back_to_menu()

func _on_sound() -> void:
	GameState.sound_on = not GameState.sound_on
	GameState.save_data()
	_toast(GameState.L("sound_on" if GameState.sound_on else "sound_off"))

# ---------- магазин ----------

var _shop_tabs: HBoxContainer = null
var _shop_list: VBoxContainer = null
var _shop_tab := "pick"

func _build_shop() -> void:
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.custom_minimum_size = Vector2(560, 560)
	v.add_theme_constant_override("separation", 8)
	_shop_panel.add_child(v)
	var h := _mk_label(30, Color(1, 1, 1)); h.text = GameState.L("shop"); h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(h)
	_shop_tabs = HBoxContainer.new()
	_shop_tabs.alignment = BoxContainer.ALIGNMENT_CENTER
	_shop_tabs.add_theme_constant_override("separation", 8)
	v.add_child(_shop_tabs)
	for tab in [["pick", "tab_picks"], ["helm", "tab_helms"], ["mach", "tab_machs"]]:
		var b := _mk_btn(GameState.L(tab[1]), 20)
		b.set_meta("tab", tab[0])
		b.pressed.connect(func(): _shop_tab = tab[0]; _refresh_shop())
		_shop_tabs.add_child(b)
	# прокрутка списка
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(540, 380)
	v.add_child(scroll)
	_shop_list = VBoxContainer.new()
	_shop_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_shop_list)
	# прокачка + закрыть
	var uph := _mk_label(22, Color(0.7, 1.0, 0.8)); uph.text = "— " + GameState.L("upgrades") + " —"; uph.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(uph)
	var upg := HBoxContainer.new(); upg.alignment = BoxContainer.ALIGNMENT_CENTER; upg.add_theme_constant_override("separation", 8)
	upg.name = "Upgrades"
	v.add_child(upg)
	var close := _mk_btn(GameState.L("back"), 20)
	close.pressed.connect(func(): _shop_panel.visible = false; _running = true)
	v.add_child(close)

func _on_shop() -> void:
	_running = false
	_shop_panel.visible = true
	_refresh_shop()

func _refresh_shop() -> void:
	for c in _shop_list.get_children(): c.queue_free()
	for id in GameState.GEAR_ORDER:
		var g: Dictionary = GameState.GEAR[id]
		if str(g["kind"]) != _shop_tab: continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		_shop_list.add_child(row)
		var own := GameState.gear_owned(id)
		var unlocked := GameState.gear_unlocked(id, GameState.max_level)
		var banned := GameState.gear_banned(id, _lvl)
		var cost := GameState.gear_cost(id)
		var name_l := _mk_label(19, Color(1, 1, 1) if unlocked else Color(0.6, 0.6, 0.6))
		name_l.custom_minimum_size = Vector2(220, 0)
		name_l.text = GameState.L(id)
		row.add_child(name_l)
		var desc := _mk_label(16, Color(0.8, 0.9, 1.0))
		var dkey: String = "dpick" if g["kind"] == "pick" else ("dhelm" if g["kind"] == "helm" else "dmach")
		desc.text = GameState.L(dkey) % int(g["power"])
		desc.custom_minimum_size = Vector2(150, 0)
		row.add_child(desc)
		var own_l := _mk_label(18, Color(0.9, 0.9, 0.6))
		own_l.text = GameState.L("own_n") % own
		own_l.custom_minimum_size = Vector2(50, 0)
		row.add_child(own_l)
		var btn := _mk_btn("", 18)
		btn.custom_minimum_size = Vector2(130, 44)
		if not unlocked:
			btn.text = GameState.L("locked_lvl") % int(g["unlock"])
			btn.disabled = true
			btn.tooltip_text = GameState.L("gear_unlocks_at") % int(g["unlock"])
		elif banned:
			btn.text = GameState.L("locked_ban")
			btn.disabled = true
		elif cost < 0:
			btn.text = GameState.L("maxed")
			btn.disabled = true
		else:
			btn.text = GameState.L("buy") % cost
			btn.disabled = GameState.coins < cost
			btn.pressed.connect(_on_buy_gear.bind(id, btn))
		row.add_child(btn)
	# прокачка
	var upg: HBoxContainer = _shop_panel.find_child("Upgrades", true, false)
	if upg:
		for c in upg.get_children(): c.queue_free()
		for uid in GameState.UPGRADE_ORDER:
			var b := _mk_btn("", 16)
			var lv := GameState.upgrade_level(uid)
			var cost := GameState.upgrade_cost(uid)
			var nm := GameState.L("up_" + uid)
			if cost < 0:
				b.text = "%s\n%s" % [nm, GameState.L("maxed")]
				b.disabled = true
			else:
				b.text = "%s %s\n◈ %d" % [nm, GameState.L("up_level_n") % [lv, GameState.UPGRADES[uid]["max"]], cost]
				b.disabled = GameState.coins < cost
				b.tooltip_text = GameState.L("dup_" + uid)
				b.pressed.connect(func():
					if GameState.buy_upgrade(uid):
						AudioBus.buy(); _refresh_shop(); _update_hud())
			upg.add_child(b)

func _on_buy_gear(id: String, btn: Button) -> void:
	var res := GameState.buy_gear(id, _lvl)
	if res == 0:
		AudioBus.buy()
		_rebuild_workers()
		_refresh_shop()
		_update_hud()
		if not GameState.tutorial_done:
			GameState.tutorial_done = true
			GameState.save_data()
			_show_tutorial(GameState.L("tut_goal") % int(_lvl.get("rocks", 10)))
	elif res == 1:
		_toast(GameState.L("not_enough"))
	elif res == 4:
		_toast(GameState.L("locked_ban"))
