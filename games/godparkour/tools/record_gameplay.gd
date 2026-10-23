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

var _next_plat := 1

func _drive() -> void:
	var pp: Vector3 = _player.global_position
	# следующая платформа — ПО ПОРЯДКУ маршрута (serpentine движется и в +z тоже)
	while _next_plat < _plats.size():
		var p: Dictionary = _plats[_next_plat]
		var c := Vector3(float(p["x"]), float(p["y"]), float(p["z"]))
		if pp.distance_to(c) < 1.6:
			_next_plat += 1  # достигли — следующая
		else:
			break
	if _next_plat >= _plats.size():
		_game.set("_vmove", Vector2.ZERO)
		return
	var pt: Dictionary = _plats[_next_plat]
	var target := Vector3(float(pt["x"]), float(pt["y"]), float(pt["z"]))
	var dx := target.x - pp.x
	var dz := target.z - pp.z
	var len := Vector2(dx, dz).length()
	if len < 0.01: return
	# v8.1: ввод в player.gd — camera-relative (dir = cam_basis * Vector3(v.x,0,v.y)),
	# а авто-камера теперь доворачивает yaw ПО МАРШРУТУ (включая +z-колени серпантина).
	# Раньше vm задавался в МИРОВЫХ осях (расчёт на yaw≈0): на развёрнутой камере
	# (yaw≈180°) автопилот бежал НАЗАД и падал в лаву (lvl21: запись статична).
	# Правильно — повернуть мировое направление в ЛОКАЛЬНЫЕ оси камеры:
	# local = cam_basis.inverse() * world (обратная операция к player'у).
	var want := Vector3(dx, 0.0, dz)
	var cam: Node3D = _game.get("cam_rig")
	if cam != null:
		want = cam.global_transform.basis.inverse() * want
	var vm := Vector2(want.x, want.z).normalized()
	_game.set("_vmove", vm)
	# прыжковая логика (v8.1): порог — по РАЗРЫВУ между краями платформ, а не по
	# «близости к центру цели». Старая формула len < maxf(2.2, len*0.5+1.2) сводилась
	# к len<2.2, но игрок сходил с края РАНЬШЕ (len≈2.5-2.8 на разрывах ≥1.3м) и
	# падал в лаву: к моменту len<2.2 on_floor уже false → прыжок НЕ срабатывал
	# никогда (lvl21 v8.1: запись = падение на 2-й секунде).
	# Геометрия: D = расстояние МЕЖДУ ЦЕНТРАМИ (константа пары), len = игрок→центр
	# цели. Пол кончается при len = D - half_cur; прыгаем на margin=0.6м раньше.
	var cur: Dictionary = _plats[maxi(0, _next_plat - 1)]
	var D := Vector2(float(pt.get("x", 0)) - float(cur.get("x", 0)),
		float(pt.get("z", 0)) - float(cur.get("z", 0))).length()
	var half_cur := (float(cur.get("sx", 2)) + float(cur.get("sz", 2))) * 0.25
	var half_next := (float(pt.get("sx", 2)) + float(pt.get("sz", 2))) * 0.25
	var edge_gap := D - half_cur - half_next
	var on_floor: bool = _player.is_on_floor()
	var jumps: int = _player.get("_jumps")
	var dy := target.y - pp.y
	if on_floor and edge_gap > 0.05 and len <= D - half_cur + 0.6 and dy > -3.0:
		# разрыв впереди и мы в 0.6м от края — отрыв (поздний = максимум дальности)
		_player.tap_jump()
	elif not on_floor and jumps < 2 and _player.velocity.y < 0.0 and len > half_next * 0.8 and dy > -3.0:
		# в воздухе, начали падать, до цели ещё далеко — двойной прыжок
		_player.tap_jump()
