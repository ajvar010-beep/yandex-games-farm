extends Node3D
## CameraRig — камера от 3-го лица, следует за игроком сзади-сверху.

@export var distance := 6.5
@export var height := 3.2
@export var look_ahead := 1.6
@export var smooth := 8.0

var target: Node3D
var _yaw := 0.0
var _pitch := 0.0

func _ready() -> void:
	var cam := Camera3D.new()
	cam.fov = 62.0
	cam.current = true
	add_child(cam)
	cam.position = Vector3(0, 0, distance)
	# свет
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -30, 0)
	# v8.1 (консилиум v8 #12): тени ОБЯЗАТЕЛЬНЫ — без них кубы не читаются объёмно.
	# ORTHOGONAL + короткая дистанция = дёшево даже на Web/Compatibility.
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 48.0
	sun.light_energy = 0.65  # v10.3: 1.15 засвечивал дневные уровни (см. ниже)
	get_parent().call_deferred("add_child", sun)
	# Environment назначаем НАПРЯМУЮ в world_3d (без WorldEnvironment-узла):
	# call_deferred(add_child) гонит гонку — level.load_level() может выполниться
	# ДО входа узла в дерево, и тема уровня (hacker-небо) молча не применится.
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.53, 0.75, 0.92)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.7, 0.78, 0.9)
	# v8.1 (консилиум v8 #12): ambient 0.9→0.45 — контраст ключевым светом вместо
	# «плоской засветки»; FILMIC-тонмап + glow: эмиссия неона/лавы/монет даёт ореол,
	# а не клипится в белёсую кашу (46% near-white на lvl21 было).
	# ВАЖНО: glow_bloom=0 — равномерный bloom выбеливал ДНЕВНОЕ небо (lvl11: 51%
	# near-white, mean 236). Свечение идёт ТОЛЬКО через glow_hdr_threshold: яркие
	# эмиссивные поверхности (неон/лава/монеты) светятся, небо/трава — нет.
	# v10.3 (отзыв живого игрока «всё очень засвечено»): замер скриншотов v10.2 —
	# дневные уровни mean 230-233/255, 17-25% пикселей ярче 235 (L21 ночной для
	# сравнения 94). Снижаем экспозицию: свет 1.15→0.95 (выше), ambient 0.45→0.35,
	# glow 0.5→0.35 (неон lvl21/монеты продолжат светиться через hdr_threshold),
	# tonemap_exposure 1.0→0.92. FILMIC остаётся (клипы в белое меньше).
	# v10.3 итог: свет 1.15→0.65, ambient 0.45→0.25, glow 0.5→0.25, exposure
	# 1.0→0.78. FILMIC почти не давит белую платформу — снижение экспозиции
	# эффективнее снижения света. Целевой mean скриншотов ~200-210 (было 233).
	e.ambient_light_energy = 0.25
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.tonemap_exposure = 0.78
	e.glow_enabled = true
	e.glow_intensity = 0.25
	e.glow_bloom = 0.0
	e.glow_strength = 0.9
	e.glow_hdr_threshold = 1.0
	get_viewport().world_3d.environment = e
	# облака (процедурные, плавают)
	_spawn_clouds()

func _process(delta: float) -> void:
	if not target:
		return
	_process_auto(delta)
	var tp := target.global_position
	var want := tp + Vector3(sin(_yaw) * distance * cos(_pitch), height + sin(_pitch) * distance * 0.4, cos(_yaw) * distance * cos(_pitch))
	global_position = global_position.lerp(want, smooth * delta)
	look_at(tp + Vector3(0, look_ahead, 0), Vector3.UP)

# вращение камеры мышью (ПК) / свайп с зажатием (моб)
func rotate_cam(dx: float, dy: float) -> void:
	_yaw -= dx * 0.004
	# v10.4 (отзыв живого игрока «верх-низ инвертирован, не как в Roblox»): ЗНАК
	# dy ПЕРЕВЁРНУТ — свайп/мышь ВВЕРХ (dy<0) → pitch ПАДАЕТ → камера НИЖЕ →
	# взгляд ВВЕРХ (небо), свайп ВНИЗ → взгляд ВНИЗ. Это буквальное Roblox-touch:
	# «палец вверх = смотрим вверх». В v10.3 знак оставили старым (свайп вверх =
	# камера выше = взгляд вниз) — игрок подтвердил, что это ощущается инверсией.
	# v10.3 («нет возможности поворачивать под определёнными углами»): clamp
	# расширен [-0.35..0.5] → [-0.9..1.3] рад: pitch −0.9 = камера ниже цели →
	# истинный взгляд вверх (look_ahead 1.6 > высоты камеры), +1.3 = вид сверху.
	_pitch = clampf(_pitch + dy * 0.003, -0.9, 1.3)
	# v10.1 (отзыв живого игрока): ручное вращение ГЛУШИТ авто-доворот на 2.5с.
	# Раньше _process_auto каждый кадр возвращал yaw к маршруту → камера «жила
	# своей жизнью» и поворот пальцем мгновенно отбирался обратно.
	_manual_hold = MANUAL_HOLD

# авто-камера: плавно доворачивает за игроком (чтобы на мобиле не надо было крутить)
var _auto_follow := true
# v10.1: окно «игрок сам крутит камеру» — авто-доворот не мешает
const MANUAL_HOLD := 2.5
var _manual_hold := 0.0

func is_manual() -> bool:
	return _manual_hold > 0.0

func _process_auto(delta: float) -> void:
	if _manual_hold > 0.0:
		_manual_hold -= delta
		return  # игрок только что крутил камеру сам — не доворачиваем
	if not _auto_follow or not target:
		return
	# v8.1 (консилиум v8 #6): цель — точка МАРШРУТА впереди игрока (Level.route_ahead_point),
	# а НЕ вектор скорости. Ввод camera-relative (player.gd:162), поэтому доворот по velocity
	# создавал петлю «камера гонится за скоростью ↔ скорость зависит от камеры» — её и глушил
	# прежний early-return на is_input_active(), из-за чего авто-камера была МЕРТВА на мобиле
	# (палец всегда на стике) и все +z-колени серпантина игрались «бегом в камеру».
	# Маршрут — статичная геометрия, обратной связи нет: «стик вверх» всегда ведёт вперёд по уровню.
	var mv := Vector2.ZERO
	var lvl: Node = get_parent().get_node_or_null("Level") if get_parent() else null
	if lvl and lvl.has_method("route_ahead_point"):
		var ahead: Vector3 = lvl.route_ahead_point(target.global_position, 2)
		if ahead != Vector3.ZERO:
			var d: Vector3 = ahead - target.global_position
			mv = Vector2(d.x, d.z)
	# фолбэк (маршрут ещё не построен): по вектору скорости, как было
	if mv.length() < 0.35 and target is ParkourPlayer:
		var vel: Vector3 = target.velocity
		mv = Vector2(vel.x, vel.z)
	if mv.length() > 1.0:
		var want_yaw := atan2(-mv.x, -mv.y)
		# lerp_angle сглаживает разворот — мгновенных рывков нет ни на одном кадре.
		# v10.3 («инвертировано в некоторых местах»): 3.0→6.0 — на U-поворотах
		# маршрута (47 шт) камера доворачивала ~1с, и «стик вверх» всё это время
		# вёл ОТ камеры = навстречу старому направлению (бег в камеру). Теперь
		# разворот ~0.5с — окно инверсии вдвое короче.
		_yaw = lerp_angle(_yaw, want_yaw, 6.0 * delta)

var _clouds: Array[MeshInstance3D] = []

func _spawn_clouds() -> void:
	var root := get_parent()
	if not root: return
	for i in 7:
		var c := MeshInstance3D.new()
		var bm := BoxMesh.new()
		var s := randf_range(2.5, 5.0)
		bm.size = Vector3(s, s * 0.45, s * 0.7)
		c.mesh = bm
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(1, 1, 1, 0.75)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		c.material_override = m
		c.position = Vector3(randf_range(-30, 30), randf_range(8, 18), randf_range(-40, 10))
		root.call_deferred("add_child", c)
		_clouds.append(c)

func _physics_process(delta: float) -> void:
	# облака медленно плывут
	for c in _clouds:
		if is_instance_valid(c):
			c.position.x += delta * 0.5
			if c.position.x > 40:
				c.position.x = -40
