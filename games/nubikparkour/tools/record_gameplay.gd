extends Node
## Автопилот для записи gameplay-видео (Godot Movie Maker):
##   Godot --path . res://tools/record_gameplay.tscn --write-movie export/movie.avi --fixed-fps 60 -- <level> [seconds]
## Игрок сам бежит по платформам и прыгает; после ffmpeg кодирует avi → mp4.

var _level := 3
var _max_sec := 20.0
var _t := 0.0
var _plats: Array = []
var _game: Node
var _player: Node

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: _level = int(args[0])
	if args.size() > 1: _max_sec = float(args[1])
	GameState.lang = "ru"
	GameState.coins = 42
	_start()

func _start() -> void:
	_game = load("res://scenes/Game.tscn").instantiate()
	get_tree().root.add_child.call_deferred(_game)
	await get_tree().process_frame
	await get_tree().process_frame
	_game.call("load_level", _level)
	await get_tree().process_frame
	_player = _game.get("player")
	# список платформ уровня
	var path := "res://levels/%02d.json" % _level
	var f := FileAccess.open(path, FileAccess.READ)
	if f:
		var def: Dictionary = JSON.parse_string(f.get_as_text())
		f.close()
		_plats = def.get("platforms", [])
	await get_tree().process_frame

func _process(delta: float) -> void:
	_t += delta
	# предохранитель: даже если сцена не собралась — выйти, иначе movie растёт вечно
	if _t > _max_sec + 10.0:
		get_tree().quit(1)
		return
	if _game == null or _player == null:
		return
	if _t > _max_sec:
		get_tree().quit(0)
		return
	_drive()

func _drive() -> void:
	var pp: Vector3 = _player.global_position
	# следующая платформа: первая, чей центр впереди по -z
	var target := Vector3(0, 0, -9999)
	for p in _plats:
		var c := Vector3(float(p["x"]), float(p["y"]), float(p["z"]))
		if c.z < pp.z - 0.5 and c.z > target.z:
			target = c
	if target.z < -9000:
		return  # финиш достигнут
	# курс на цель: dx, dz в локальных осях камеры (~мировые, yaw≈0)
	var dx := target.x - pp.x
	var dz := target.z - pp.z
	var len := Vector2(dx, dz).length()
	if len < 0.01: return
	var vm := Vector2(dx / len, dz / len)
	_game.set("_vmove", vm)
	# прыжковая логика
	var on_floor: bool = _player.is_on_floor()
	var falling: bool = _player.velocity.y < -1.0
	var jumps: int = _player.get("_jumps")
	if on_floor and len < maxf(2.5, absf(dz) + 1.5):
		# близко к краю/цели — прыгаем
		_player.tap_jump()
	elif falling and pp.y < target.y + 0.5 and jumps < 2:
		# не долетаем — двойной
		_player.tap_jump()
