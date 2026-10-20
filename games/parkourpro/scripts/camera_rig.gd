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
	sun.shadow_enabled = false  # на Web лучше без теней для производительности
	get_parent().call_deferred("add_child", sun)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.53, 0.75, 0.92)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.7, 0.78, 0.9)
	e.ambient_light_energy = 0.9
	env.environment = e
	get_parent().call_deferred("add_child", env)

func _process(delta: float) -> void:
	if not target:
		return
	var tp := target.global_position
	var want := tp + Vector3(sin(_yaw) * distance * cos(_pitch), height + sin(_pitch) * distance * 0.4, cos(_yaw) * distance * cos(_pitch))
	global_position = global_position.lerp(want, smooth * delta)
	look_at(tp + Vector3(0, look_ahead, 0), Vector3.UP)

# вращение камеры мышью (ПК) / свайп с зажатием (моб)
func rotate_cam(dx: float, dy: float) -> void:
	_yaw -= dx * 0.004
	_pitch = clampf(_pitch - dy * 0.003, -0.35, 0.5)
