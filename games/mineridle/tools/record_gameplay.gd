extends Node
## Автопилот записи gameplay-видео (Godot Movie Maker):
##   Godot --path . res://tools/record_gameplay.tscn --write-movie export/movie.avi --fixed-fps 60 -- <level> [seconds] [ru|en]
## Тапает камень, покупает снарягу на середине, ломает камни.

var _level := 1
var _max_sec := 18.0
var _t := 0.0
var _game: Node = null
var _tap_cd := 0.0
var _bought := false
var _start_coins := 0

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: _level = int(args[0])
	if args.size() > 1: _max_sec = float(args[1])
	GameState.lang = String(args[2]) if args.size() > 2 and String(args[2]) in ["ru", "en"] else "ru"
	# достаточно монет на 1-2 покупки для демонстрации рабочих
	_start_coins = 60
	GameState.coins = _start_coins
	GameState.owned = {}
	_start()

func _start() -> void:
	_game = load("res://scenes/Game.tscn").instantiate()
	get_tree().root.add_child.call_deferred(_game)
	await get_tree().process_frame
	await get_tree().process_frame
	_game.call("load_level", _level)

func _process(delta: float) -> void:
	_t += delta
	if _t > _max_sec + 10.0:
		get_tree().quit(1)
		return
	if _game == null:
		return
	if _t > _max_sec:
		get_tree().quit(0)
		return
	# тап камня ~6 раз/сек
	_tap_cd -= delta
	if _tap_cd <= 0.0:
		_tap_cd = 0.17
		if _game.get("_running") == true and _game.get("_rock") != null:
			_game.call("_tap_rock", Vector2(640, 300))
	# на 4-й секунде — покупка первой кирки (видимый рабочий)
	if not _bought and _t > 4.0 and GameState.coins >= 15:
		_bought = true
		GameState.buy_gear("pick_wood", _game.get("_lvl"))
		_game.call("_rebuild_workers")
		_game.call("_update_hud")
	# на 9-й секунде — ещё одна кирка + каска, если хватает
	if _t > 9.0 and _t < 9.2 and GameState.coins >= 250:
		GameState.buy_gear("helm_bronze", _game.get("_lvl"))
		_game.call("_rebuild_workers")
		_game.call("_update_hud")
