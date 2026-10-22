extends Node3D
## Main — точка входа: показывает меню, переключает в игру.

@onready var menu: Control = $UI/Menu
@onready var game_holder: Node3D = $GameHolder

var _game: Node = null

func _ready() -> void:
	GameState.load_data()
	menu.show()
	Yandex.gameplay_stop()
	# баннер показывается, когда SDK готов (асинхронно) — если мы всё ещё в меню
	if Yandex.is_ready():
		_maybe_show_banner()
	else:
		Yandex.sdk_ready.connect(_maybe_show_banner, CONNECT_ONE_SHOT)

func _maybe_show_banner() -> void:
	if _game == null:  # только в меню, не в геймплее
		Yandex.show_banner()

func start_level(level: int) -> void:
	menu.hide()
	Yandex.hide_banner()  # баннер мешает геймплею
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
	Yandex.show_banner()
