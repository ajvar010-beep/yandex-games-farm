class_name ParkourPlayer
extends CharacterBody3D
## Игрок-паркурщик: бег, прыжок, двойной прыжок, койот-тайм.

signal died
signal landed

@export var speed := 7.0
@export var sprint_mult := 1.4
@export var jump_force := 9.5
@export var gravity_mult := 1.8

var _coyote := 0.0
var _jump_buffer := 0.0
var _jumps := 0
var _max_jumps := 2
var _dead := false
var _spawn := Vector3.ZERO

var _cam: Node3D
var _mesh: Node3D
var _body_mat: StandardMaterial3D
var _head_mat: StandardMaterial3D
var _was_air := false

func _ready() -> void:
	_spawn = global_position
	_build_visual()
	_cam = get_parent().get_node_or_null("CameraRig")

func _build_visual() -> void:
	_mesh = Node3D.new()
	add_child(_mesh)
	var col: Color = GameState.SKINS.get(GameState.current_skin, GameState.SKINS["nub"])["color"]
	_body_mat = StandardMaterial3D.new()
	_body_mat.albedo_color = col
	_body_mat.roughness = 0.7
	_head_mat = StandardMaterial3D.new()
	_head_mat.albedo_color = col.lightened(0.35)
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
	# глаза
	for sx in [-1.0, 1.0]:
		var eye := MeshInstance3D.new()
		var em := BoxMesh.new()
		em.size = Vector3(0.08, 0.08, 0.02)
		eye.mesh = em
		eye.position = Vector3(sx * 0.13, 1.47, 0.29)
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.1, 0.1, 0.15)
		eye.material_override = m
		_mesh.add_child(eye)
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

func set_spawn(p: Vector3) -> void:
	_spawn = p

func respawn() -> void:
	global_position = _spawn
	velocity = Vector3.ZERO
	_dead = false
	_jumps = 0
	if _mesh: _mesh.visible = true

func kill() -> void:
	if _dead: return
	_dead = true
	AudioBus.die()
	_explode()
	died.emit()

func _explode() -> void:
	# разлетаемся кубиками
	if not _mesh: return
	var parts := _mesh.get_children()
	for p in parts:
		if p is MeshInstance3D:
			var rb := RigidBody3D.new()
			rb.position = p.position
			rb.add_child(p.duplicate())
			# случайный импульс
			rb.linear_velocity = Vector3(randf_range(-3,3), randf_range(3,6), randf_range(-3,3))
			rb.angular_velocity = Vector3(randf_range(-8,8), randf_range(-8,8), randf_range(-8,8))
			_mesh.get_parent().add_child(rb)
	_mesh.visible = false

func revive() -> void:
	_dead = false
	# чуть выше, чтобы не провалиться
	global_position = _spawn + Vector3.UP * 0.5
	velocity = Vector3.ZERO
	_jumps = 0
	if _mesh: _mesh.visible = true

func _input(event: InputEvent) -> void:
	if _dead: return
	if event.is_action_pressed("jump"):
		_jump_buffer = 0.15
	# мобильный тап = прыжок (обработаем в Game через тап по экрану)

func _physics_process(delta: float) -> void:
	if _dead:
		return
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

	# скорость
	var spd := speed
	var target := dir * spd
	velocity.x = move_toward(velocity.x, target.x, 40 * delta)
	velocity.z = move_toward(velocity.z, target.z, 40 * delta)

	# гравитация
	if not is_on_floor():
		velocity.y -= ProjectSettings.get_setting("physics/3d/default_gravity") * gravity_mult * delta
	else:
		_jumps = 0
		_coyote = 0.12
		if _jump_buffer > 0:
			_do_jump()
			_jump_buffer = 0

	# прыжок из буфера/в воздухе (двойной)
	if _jump_buffer > 0 and not is_on_floor() and _jumps < _max_jumps and _jumps > 0:
		_do_jump()
		_jump_buffer = 0
	elif _jump_buffer > 0 and is_on_floor():
		_do_jump()
		_jump_buffer = 0

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
		var target_yaw := atan2(-dir.x, -dir.z)
		_mesh.rotation.y = lerp_angle(_mesh.rotation.y, target_yaw, 12 * delta)
		# тутор: первое движение
		var game := get_parent()
		if game and game.has_method("_advance_tutorial"):
			game._advance_tutorial()

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

func _do_jump() -> void:
	_jumps += 1
	velocity.y = jump_force
	# тутор: первый прыжок
	var game := get_parent()
	if game and game.has_method("_advance_tutorial"):
		game._advance_tutorial()
	# squash&stretch: при прыжке вытягиваемся
	if _mesh:
		_mesh.scale = Vector3(0.85, 1.15, 0.85)
		var tw := create_tween()
		tw.tween_property(_mesh, "scale", Vector3.ONE, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if _jumps > 1:
		AudioBus.double_jump()
	else:
		AudioBus.jump()

# мобильный тап (из Game)
func tap_jump() -> void:
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
