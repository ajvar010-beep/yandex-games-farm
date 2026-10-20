extends Node3D
## Main — точка входа: показывает меню, переключает в игру.

@onready var menu: Control = $UI/Menu
@onready var game_holder: Node3D = $GameHolder

var _game: Node = null

func _ready() -> void:
	GameState.load_data()
	menu.show()
	Yandex.gameplay_stop()

func start_level(level: int) -> void:
	menu.hide()
	if _game:
		_game.queue_free()
	var GameScene: PackedScene = load("res://scenes/Game.tscn")
	_game = GameScene.instantiate()
	game_holder.add_child(_game)
	_game.call_deferred("load_level", level)
	Yandex.gameplay_start()

func back_to_menu() -> void:
	if _game:
		_game.queue_free()
		_game = null
	menu.show()
	menu.refresh()
	Yandex.gameplay_stop()
