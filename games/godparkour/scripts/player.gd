class_name ParkourPlayer
extends CharacterBody3D
## Игрок-паркурщик: бег, прыжок, двойной прыжок, койот-тайм.

signal died
signal landed
signal shield_absorbed  # v9: щит поглотил смерть — HUD обновляет счётчик

@export var speed := 7.0
@export var jump_force := 9.5
@export var gravity_mult := 1.8

const COYOTE_TIME := 0.12
# v9: базовые значения физики — апгрейды ПРОКАЧКИ считаются от них,
# а не от текущего speed/jump_force (иначе покупка компаундилась бы).
const BASE_SPEED := 7.0
const BASE_JUMP := 9.5

var _coyote := 0.0
var _jump_buffer := 0.0
var _jumps := 0
var _max_jumps := 2
var _dead := false
var _spawn := Vector3.ZERO
var _last_safe := Vector3.ZERO   # мировая точка на полу — для честного revive
# v9.2 (консилиум v9.1, MAJOR): _last_safe — устаревающий снимок мира. На mover'е
# платформа уезжает, на crumble — исчезает, и щит/платный revive телепортировали в
# воздух (25 crumble + 100 mover'ов на 19/21 уровне → все заряды впустую + смерть).
# Храним ссылку на collider + локальный офсет: для движущейся платформы to_global()
# пересчитывает точку в её ТЕКУЩУЮ позицию (пол «едет» вместе с игроком), для
# исчезнувшей crumble is_instance_valid() == false → фолбэк на _spawn.
var _last_safe_collider: Node = null
var _last_safe_local := Vector3.ZERO
# v9: прокачка
var shields := 0                 # щиты на уровень (поглощают смерть) — читает game.gd
var _shield_lock := false        # v9.2 minor: щит сработал в этом кадре — не списывать второй
var _dash_cd := 0.0
var _dash_time := 0.0
var _dash_dir := Vector3.ZERO
# v8.1 (#11): кубики смерти спавнятся в Level (пересоздаётся на load_level) с авто-деспавном,
# а НЕ в Player. Иначе ~6-8 RigidBody3D копились на каждую смерть и утекали между уровнями
# (тот же Game-узел при _on_next) → растущий счётчик узлов/draw-call, FPS-деградация.
var _debris: Array[Node] = []

var _cam: Node3D
var _mesh: Node3D
var _body_mat: StandardMaterial3D
var _head_mat: StandardMaterial3D
var _was_air := false

func _ready() -> void:
	_spawn = global_position
	_build_visual()
	_cam = get_parent().get_node_or_null("CameraRig")
	# серия Нубик/Про/Бог: difficulty укорачивает дугу прыжка (reach ∝ v²/g).
	# Это РЕАЛЬНАЯ ось сложности (прыжок вперёд), в отличие от сужения sx (⊥ движению).
	# god 1.3: single-jump reach ~2.6м (pro ~3.4, nub ~3.9) — длинные разрывы требуют двойного.
	gravity_mult = 1.8 * Variant.difficulty
	apply_upgrades()

# v9: ПРОКАЧКА — постоянные апгрейды из GameState.upgrades. gravity_mult НЕ трогаем
# (ось сложности серии); апгрейды усиливают игрока ВНУТРИ своей difficulty.
# Базовая игра (upgrades={}) даёт ровно значения v8.2 — уровни проходимы без прокачки.
# Щиты здесь НЕ пополняем: их расход должен сохраняться между смертями уровня;
# пополнение — только на старте уровня (game.gd::load_level → refill_shields()).
func apply_upgrades() -> void:
	speed = BASE_SPEED * (1.0 + 0.05 * GameState.upgrade_level("speed"))
	jump_force = BASE_JUMP * (1.0 + 0.03 * GameState.upgrade_level("jump"))
	_max_jumps = 2 + (1 if GameState.upgrade_level("extra_jump") > 0 else 0)

func refill_shields() -> void:
	shields = GameState.upgrade_level("shield")

func _build_visual() -> void:
	_mesh = Node3D.new()
	add_child(_mesh)
	var col: Color = GameState.SKINS.get(GameState.current_skin, GameState.SKINS["nub"])["color"]
	_body_mat = StandardMaterial3D.new()
	_body_mat.albedo_color = col
	_body_mat.albedo_texture = _char_texture(col, 1234, "body")
	_body_mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	_body_mat.roughness = 0.7
	_head_mat = StandardMaterial3D.new()
	_head_mat.albedo_color = col.lightened(0.35)
	_head_mat.albedo_texture = _char_texture(col.lightened(0.35), 5678, "head")
	_head_mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	# тело
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.6, 0.7, 0.35)
	body.mesh = bm
	body.position.y = 0.85
	body.material_override = _body_mat
	_mesh.add_child(body)
	# голова
	var head := MeshInstance3D.new()
	var hm := BoxMesh.new()
	hm.size = Vector3(0.55, 0.5, 0.55)
	head.mesh = hm
	head.position.y = 1.45
	head.material_override = _head_mat
	_mesh.add_child(head)
	# глаза + брови + рот (лицо на +z, вперёд по движению)
	var face_mat := StandardMaterial3D.new()
	face_mat.albedo_color = Color(0.08, 0.08, 0.12)
	for sx in [-1.0, 1.0]:
		var eye := MeshInstance3D.new()
		var em := BoxMesh.new()
		em.size = Vector3(0.08, 0.08, 0.02)
		eye.mesh = em
		eye.position = Vector3(sx * 0.13, 1.47, 0.29)
		eye.material_override = face_mat
		_mesh.add_child(eye)
		# бровь над глазом — придаёт «направление взгляда»
		var brow := MeshInstance3D.new()
		var bm2 := BoxMesh.new()
		bm2.size = Vector3(0.11, 0.025, 0.02)
		brow.mesh = bm2
		brow.position = Vector3(sx * 0.13, 1.55, 0.29)
		brow.material_override = face_mat
		_mesh.add_child(brow)
	# рот
	var mouth := MeshInstance3D.new()
	var mm := BoxMesh.new()
	mm.size = Vector3(0.16, 0.03, 0.02)
	mouth.mesh = mm
	mouth.position = Vector3(0, 1.33, 0.29)
	mouth.material_override = face_mat
	_mesh.add_child(mouth)
	# ноги
	for sx in [-1.0, 1.0]:
		var leg := MeshInstance3D.new()
		var lm := BoxMesh.new()
		lm.size = Vector3(0.22, 0.5, 0.3)
		leg.mesh = lm
		leg.position = Vector3(sx * 0.16, 0.25, 0.0)
		leg.material_override = _body_mat
		leg.name = "Leg" + ("L" if sx < 0 else "R")
		_mesh.add_child(leg)
	# руки (качаются при беге)
	for sx in [-1.0, 1.0]:
		var arm := MeshInstance3D.new()
		var am := BoxMesh.new()
		am.size = Vector3(0.18, 0.55, 0.25)
		arm.mesh = am
		arm.position = Vector3(sx * 0.42, 0.95, 0.0)
		arm.material_override = _body_mat
		arm.name = "Arm" + ("L" if sx < 0 else "R")
		_mesh.add_child(arm)
	# коллизия
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.4
	shape.shape = cap
	shape.position.y = 0.75
	add_child(shape)

## Серая шумовая карта 32×32 (вокруг 1.0) — в Godot albedo_color × texture,
## поэтому цвет скина сохраняется, а текстура даёт только рельеф/фактуру.
## body: вертикальные складки одежды; head: мелкий ровный шум (кожа).
func _char_texture(_col: Color, seed: int, style: String) -> ImageTexture:
	const S := 32
	var img := Image.create_empty(S, S, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	for y in S:
		for x in S:
			var v := 1.0
			if style == "body":
				# вертикальные складки + пояс
				v += rng.randf_range(-0.05, 0.05)
				if (x + (y >> 2)) % 8 < 1:
					v -= 0.10
				if y == S / 2 or y == S / 2 + 1:
					v -= 0.18
			else:
				v += rng.randf_range(-0.04, 0.04)
			# bevel-кромка: верх светлее, низ темнее — грани читаются
			if y < 2:
				v += 0.07
			elif y >= S - 2:
				v -= 0.09
			if x < 1:
				v += 0.04
			elif x >= S - 1:
				v -= 0.05
			v = clampf(v, 0.0, 1.0)
			img.set_pixel(x, y, Color(v, v, v, 1.0))
	return ImageTexture.create_from_image(img)

func set_spawn(p: Vector3) -> void:
	_spawn = p
	_last_safe = p  # v9.2: старт/чекпоинт всегда на статичном полу — валидный фолбэк
	_last_safe_collider = null

func respawn() -> void:
	global_position = _spawn
	_last_safe = _spawn
	_last_safe_collider = null  # v9.2: _spawn — статичный старт/чекпоинт, без collider-привязки
	_shield_lock = false
	velocity = Vector3.ZERO
	_dead = false
	_jumps = 0
	_jump_buffer = 0.0  # v8.1 (#7): гасим фантомный авто-прыжок при возрождении
	_clear_debris()     # v8.1 (#11): кубики прошлой смерти долой
	_dash_cd = 0.0      # v9: рывок снова доступен
	_dash_time = 0.0
	apply_upgrades()    # v9: speed/jump/max_jumps на старт уровня
	refill_shields()    # v9: щиты пополняются на старт/рестарт УРОВНЯ (не на revive)
	if _mesh: _mesh.visible = true

func kill() -> void:
	if _dead: return
	# v9: ЩИТ поглощает смерть — мгновенный возврат в последнюю безопасную точку,
	# без распада на кубики и без панели смерти (игра продолжается). Расход щитов
	# сохраняется до конца уровня; пополнение — в respawn() (старт/рестарт уровня).
	# v9.2: точка резолвится через _resolve_safe_pos() — collider-aware (mover
	# уехал → точка едет с ним; crumble исчезла → фолбэк _spawn). Без этого щит
	# телепортировал в воздух и сгорал впустую (MAJOR консилиума v9.1).
	# v9.2 minor: guard от двойного списания за один кадр (hazard body_entered +
	# lava-kill из game._process могут выстрелить синхронно).
	if shields > 0:
		if _shield_lock: return  # второй kill() в том же кадре — щит уже сработал
		_shield_lock = true
		shields -= 1
		AudioBus.shield()
		global_position = _resolve_safe_pos() + Vector3.UP * 0.5
		velocity = Vector3.ZERO
		_jumps = 0
		_jump_buffer = 0.0
		_coyote = COYOTE_TIME
		shield_absorbed.emit()
		return
	_dead = true
	AudioBus.die()
	_explode()
	died.emit()

func _explode() -> void:
	# разлетаемся кубиками
	if not _mesh: return
	# хост debris: Level (пересоздаётся на load_level → автоочистка при смене уровня).
	# Фолбэк на Game если Level не найден (напр. в тестах).
	var host: Node = get_parent().get_node_or_null("Level") if get_parent() else null
	if host == null: host = get_parent()
	if host == null: return
	var parts := _mesh.get_children()
	for p in parts:
		if p is MeshInstance3D:
			var rb := RigidBody3D.new()
			var part := (p as MeshInstance3D).duplicate()
			# v8.1 (#11/minor): ОБНУЛЯЕМ локальную позицию дубликата — иначе она
			# складывается с мировой позицией rb (двойной офсет 0.85-1.45м, критик v8)
			(part as Node3D).position = Vector3.ZERO
			rb.add_child(part)
			# случайный импульс
			rb.linear_velocity = Vector3(randf_range(-3,3), randf_range(3,6), randf_range(-3,3))
			rb.angular_velocity = Vector3(randf_range(-8,8), randf_range(-8,8), randf_range(-8,8))
			host.add_child(rb)
			# МИРОВАЯ позиция части ПОСЛЕ add_child: вне дерева set_global_position
			# бьёт «!is_inside_tree()» (global_transform недоступен)
			rb.global_position = p.global_position
			_debris.append(rb)
			# авто-деспавн через 2с — кубики не копятся и не плавают в следующем уровне.
			# Timer — РЕБЁНОК rb: если rb освобождён рано (_clear_debris при revive),
			# таймер освобождается вместе с ним и НЕ стреляет по freed-объекту
			# (иначе лямбда-захват rb даёт «Lambda capture freed» в логах).
			var t := Timer.new()
			t.wait_time = 2.0
			t.one_shot = true
			rb.add_child(t)
			t.timeout.connect(rb.queue_free)
			t.start()
	_mesh.visible = false

# очистка debris: зовётся при возрождении/респавне (кубики прошлой смерти долой)
func _clear_debris() -> void:
	for d in _debris:
		if is_instance_valid(d): d.queue_free()
	_debris.clear()

func revive() -> void:
	_dead = false
	# честный revive: последняя безопасная точка на полу (v9.2: collider-aware
	# резолв — не телепортирует в воздух на уехавшем mover'е/исчезнувшей crumble)
	global_position = _resolve_safe_pos() + Vector3.UP * 0.5
	velocity = Vector3.ZERO
	_jumps = 0
	_jump_buffer = 0.0  # v8.1 (#7): гасим фантомный авто-прыжок (см. tap_jump)
	_coyote = COYOTE_TIME
	_dash_cd = 0.0      # v9
	_dash_time = 0.0
	if _mesh: _mesh.visible = true

func _input(event: InputEvent) -> void:
	if _dead: return
	if event.is_action_pressed("jump"):
		_jump_buffer = 0.15
	if event.is_action_pressed("dash"):
		try_dash()
	# мобильный тап = прыжок (обработаем в Game через тап по экрану)

func _physics_process(delta: float) -> void:
	if _dead:
		return
	_shield_lock = false  # v9.2: новый кадр — щит снова может поглотить смерть
	# таймеры
	if _coyote > 0: _coyote -= delta
	if _jump_buffer > 0: _jump_buffer -= delta

	# направление ввода
	var input_dir := _get_input_dir()
	var cam_basis := Basis.IDENTITY
	if _cam:
		cam_basis = _cam.global_transform.basis
	var dir := (cam_basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	dir.y = 0
	dir = dir.normalized()

	# скорость: ускорение зависит от поверхности (лёд скользит, песок тормозит).
	# move_toward переопределяет трение PhysicsMaterial — поэтому модулируем accel напрямую.
	var spd := speed
	var target := dir * spd
	var accel := 40.0 * _floor_accel_mult()
	velocity.x = move_toward(velocity.x, target.x, accel * delta)
	velocity.z = move_toward(velocity.z, target.z, accel * delta)

	# v9: РЫВОК (dash) — короткий горизонтальный burst поверх обычного бега.
	# vy НЕ меняем (нет бесконечного полёта), cd 2.5с. Базовый double-jump уже
	# покрывает все gap уровней — dash удобство, не требование прохождения.
	if _dash_cd > 0.0: _dash_cd -= delta
	if _dash_time > 0.0:
		_dash_time -= delta
		var dspeed := speed + 6.0 + 2.0 * GameState.upgrade_level("dash")
		velocity.x = _dash_dir.x * dspeed
		velocity.z = _dash_dir.z * dspeed

	# гравитация + койот-тайм
	if is_on_floor():
		_jumps = 0
		_coyote = COYOTE_TIME
		# честный revive: помним точку только на НАСТОЯЩЕМ полу, не на лаве
		# (лава — StaticBody3D с коллизией, is_on_floor на ней true, но revive туда = смерть)
		if _floor_is_safe():
			_last_safe = global_position
			# v9.2: запоминаем КОЛЛАЙДЕР пола + локальный офсет (см. _last_safe_collider)
			_last_safe_collider = _floor_collider()
			if _last_safe_collider is Node3D:
				_last_safe_local = (_last_safe_collider as Node3D).to_local(global_position)
	else:
		velocity.y -= ProjectSettings.get_setting("physics/3d/default_gravity") * gravity_mult * delta

	# прыжок: пол / койот / двойной в воздухе
	var on_floor_or_coyote := is_on_floor() or _coyote > 0.0
	if _jump_buffer > 0:
		if on_floor_or_coyote:
			if not is_on_floor(): _coyote = 0.0  # потратили койот
			_do_jump()
			_jump_buffer = 0
		elif _jumps > 0 and _jumps < _max_jumps:
			_do_jump()
			_jump_buffer = 0

	# переменная высота прыжка: отпустил кнопку — гасим подъём
	if Input.is_action_just_released("jump") and velocity.y > 0:
		velocity.y *= 0.45

	move_and_slide()

	# squash при приземлении
	if is_on_floor() and _was_air:
		_was_air = false
		if _mesh:
			_mesh.scale = Vector3(1.2, 0.8, 1.2)
			var tw := create_tween()
			tw.tween_property(_mesh, "scale", Vector3.ONE, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		landed.emit()
	elif not is_on_floor():
		_was_air = true

	# поворот модели по направлению движения
	if dir.length() > 0.1 and _mesh:
		var target_yaw := atan2(dir.x, dir.z)
		_mesh.rotation.y = lerp_angle(_mesh.rotation.y, target_yaw, 12 * delta)
		# тутор: первое движение (шаг 0→1)
		var game := get_parent()
		if game and game.has_method("_advance_tutorial"):
			game._advance_tutorial("move")

	# подпрыгивание при беге + размахивание руками/ногами
	if _mesh:
		var run := clampf(Vector2(velocity.x, velocity.z).length() / speed, 0.0, 1.0)
		_mesh.position.y = abs(sin(Time.get_ticks_msec() * 0.012)) * 0.12 * run
		_animate_limbs(run)

func _get_input_dir() -> Vector2:
	# виртуальный джойстик (моб) имеет приоритет
	var game := get_parent()
	if game and game.get("_vmove") != null:
		var vm: Vector2 = game.get("_vmove")
		if vm.length() > 0.08:
			return vm
	return Input.get_vector("move_left", "move_right", "move_forward", "move_back")

# для авто-камеры: пока есть активный ввод — не доворачивать yaw (анти-цикл)
func is_input_active() -> bool:
	return _get_input_dir().length() > 0.08

# множитель ускорения по материалу пола: лёд скользкий, песок вязкий
func _floor_accel_mult() -> float:
	if not is_on_floor():
		return 1.0
	for i in get_slide_collision_count():
		var col := get_slide_collision(i)
		if col == null: continue
		var c = col.get_collider()
		# материал платформы — через группы (level.gd добавляет ice/sand в группы)
		if c is Node and c.is_in_group("ice"):
			return 0.25
		if c is Node and c.is_in_group("sand"):
			return 1.8
	return 1.0

# пол под игроком безопасен для revive-точки? (не лава, не hazard, не ниже порога)
func _floor_is_safe() -> bool:
	if global_position.y < -3.0:
		return false  # страховка: слишком низко = над лавой
	# проверяем все slide-коллизии кадра на группу «lava»
	for i in get_slide_collision_count():
		var col := get_slide_collision(i)
		if col == null: continue
		var collider = col.get_collider()
		if collider is Node and collider.is_in_group("lava"):
			return false
	# v9.1 (консилиум v9, критик-код MAJOR): hazard — Area3D поверх обычной платформы.
	# is_on_floor()=true на StaticBody под ним, поэтому _last_safe писался ПРЯМО на
	# hazard-блок → kill()-щит телепортировал обратно в тот же hazard → все заряды
	# (950◈) сгорали на одном блоке и всё равно смерть (gauntlet L11/L17). hazard не
	# даёт slide-коллизий, поэтому опрашиваем пространство на hazard-зоны напрямую.
	if _overlaps_hazard():
		return false
	return true

# v9.2: collider пола под игроком (первая не-lava slide-коллизия кадра) — для
# привязки _last_safe к движущейся/исчезающей платформе.
func _floor_collider() -> Node:
	for i in get_slide_collision_count():
		var col := get_slide_collision(i)
		if col == null: continue
		var c = col.get_collider()
		if c is Node and not c.is_in_group("lava"):
			return c
	return null

# v9.2 (консилиум v9.1 MAJOR): актуальная мировая позиция _last_safe.
# - collider жив (mover уехал) → to_global(локального офсета) = точка ЕДЕТ с полом;
# - collider мёртв (crumble исчезла) или не Node3D → фолбэк _spawn (старт/чекпоинт,
#   всегда статичный пол — set_spawn пишет его вместе с _last_safe).
# Дополнительно проверяем, что в точке resolver'а всё ещё твёрдый пол (raycast вниз)
# — защита от случая «mover уехал под другую платформу/hazard».
func _resolve_safe_pos() -> Vector3:
	var p := _last_safe
	# v9.3 (консилиум v9.2 minor): is_instance_valid ПЕРЕД `is Node3D` — на freed-
	# инстансе оператор `is` бросает SCRIPT ERROR («previously freed instance»).
	if _last_safe_collider != null:
		if is_instance_valid(_last_safe_collider):
			if _last_safe_collider is Node3D:
				p = (_last_safe_collider as Node3D).to_global(_last_safe_local)
		else:
			p = _spawn  # узел пола вообще освобождён — точка в воздухе
	# _spawn (старт/чекпоинт) всегда на статичной платформе без hazard —
	# валидный фолбэк (генератор это гарантирует, smoke_test проверяет).
	if not _solid_floor_at(p):
		p = _spawn
	return p

# v9.3 (консилиум v9.2 MAJOR): твёрдый ли пол в точке p — КАПСУЛ-ОСОЗНАННО.
# v9.2 проверял ОДИН луч из центра точки: is_on_floor() держится до 0.16м за
# гранью плиты (капсула r=0.32 опирается на край), _last_safe записывался с
# таким выносом, и одиночный луч в этой точке мазал мимо своего же пола →
# щит/revive отбрасывал легальное стояние на _spawn (замер критиков: 342/342
# over-edge false-negative на узких плитах, до 20% grounded-кадров на L19).
# 5 лучей (центр + 4 смещения ±0.30 по XZ = радиус капсулы) повторяют опорное
# пятно капсулы: over-edge-точка валидна, если плита есть хотя бы под частью
# пятна. Исчезнувшая crumble (collision disabled) по-прежнему false — ни один
# луч не находит пол (модератор подтвердил пробой: crumble-фикс сохраняется).
func _solid_floor_at(p: Vector3) -> bool:
	var w := get_world_3d()
	if w == null: return false
	var space := w.direct_space_state
	if space == null: return false
	const R := 0.30
	var offsets := [Vector3.ZERO, Vector3(R, 0, 0), Vector3(-R, 0, 0), Vector3(0, 0, R), Vector3(0, 0, -R)]
	for off in offsets:
		var q := PhysicsRayQueryParameters3D.create(p + off + Vector3.UP * 0.3, p + off - Vector3.UP * 1.7)
		q.exclude = [get_rid()]
		q.collide_with_areas = false
		q.collide_with_bodies = true
		var hit := space.intersect_ray(q)
		if hit.is_empty(): continue
		var c = hit.get("collider")
		if c is Node and c.is_in_group("lava"): continue  # лава — не пол, пробуем другой луч
		return true
	return false

# игрок сейчас пересекает hazard-зону (Area3D в группе "hazard")?
func _overlaps_hazard() -> bool:
	var w := get_world_3d()
	if w == null: return false
	var space := w.direct_space_state
	if space == null: return false
	var q := PhysicsShapeQueryParameters3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 0.4
	q.shape = sph
	q.transform = Transform3D(Basis.IDENTITY, global_position)
	q.collide_with_areas = true
	q.collide_with_bodies = false
	q.collision_mask = 0xFFFFFFFF
	q.exclude = [get_rid()]
	for h in space.intersect_shape(q, 8):
		var c = h.get("collider")
		if c is Node and c.is_in_group("hazard"):
			return true
	return false

func _do_jump() -> void:
	_jumps += 1
	velocity.y = jump_force
	# тутор: первый прыжок (1→2), двойной (2→скрыть)
	var game := get_parent()
	if game and game.has_method("_advance_tutorial"):
		if _jumps > 1:
			game._advance_tutorial("double")
		else:
			game._advance_tutorial("jump")
	# squash&stretch: при прыжке вытягиваемся
	if _mesh:
		_mesh.scale = Vector3(0.85, 1.15, 0.85)
		var tw := create_tween()
		tw.tween_property(_mesh, "scale", Vector3.ONE, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if _jumps > 1:
		AudioBus.double_jump()
	else:
		AudioBus.jump()

# v9: рывок вперёд (dash). Требует купленного апгрейда "dash". Направление —
# текущий ввод (или последнее направление движения, если ввода нет).
func try_dash() -> void:
	if _dead: return
	if GameState.upgrade_level("dash") <= 0: return
	if _dash_cd > 0.0: return
	var d := _get_input_dir()
	var basis := Basis.IDENTITY
	if _cam: basis = _cam.global_transform.basis
	var dir := (basis * Vector3(d.x, 0, d.y))
	dir.y = 0
	if dir.length() < 0.05:
		dir = Vector3(velocity.x, 0, velocity.z)  # по инерции, если нет ввода
	if dir.length() < 0.05:
		dir = -_mesh.global_transform.basis.z if _mesh else Vector3.FORWARD
	_dash_dir = dir.normalized()
	_dash_time = 0.18
	_dash_cd = 2.5
	AudioBus.dash()

# мобильный тап (из Game)
func tap_jump() -> void:
	# v8.1 (консилиум v8 #7): НЕ буферизуем прыжок пока мёртв. Тап по кнопке
	# «Ожить»/панели (правая половина экрана) раньше ставил _jump_buffer=0.15,
	# а revive() не сбрасывал его → персонаж сам прыгал с уступа, тратя купленный
	# за RV revive. Гард + сброс в revive/respawn + ui.visible-гард в Game._input.
	if _dead: return
	_jump_buffer = 0.15

func _animate_limbs(run: float) -> void:
	if not _mesh: return
	var t := Time.get_ticks_msec() * 0.012
	var swing := sin(t) * 0.5 * run
	var armL := _mesh.get_node_or_null("ArmL")
	var armR := _mesh.get_node_or_null("ArmR")
	var legL := _mesh.get_node_or_null("LegL")
	var legR := _mesh.get_node_or_null("LegR")
	if armL: armL.rotation.x = swing
	if armR: armR.rotation.x = -swing
	if legL: legL.rotation.x = -swing * 0.7
	if legR: legR.rotation.x = swing * 0.7
