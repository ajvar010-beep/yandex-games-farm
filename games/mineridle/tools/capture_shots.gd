extends Node3D
## capture_shots — скриншоты ключевых состояний для витрины. Без SDK.

var _out := "user://shots"
var _game: Node = null

func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(_out)
	await get_tree().process_frame
	await get_tree().process_frame
	await _run()

func _save(name: String) -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.convert(Image.FORMAT_RGB8)
	img.save_png(_out + "/" + name + ".png")
	print("shot: ", name)

func _run() -> void:
	# сцену Game со стартовым состоянием
	var GameScene: PackedScene = load("res://scenes/Game.tscn")
	_game = GameScene.instantiate()
	add_child(_game)
	# уровень 1, без снаряги
	GameState.coins = 40
	GameState.owned = {}
	GameState.max_level = 1
	_game.load_level(1)
	await get_tree().create_timer(0.4).timeout
	await _save("01_start")
	# несколько тапов — камень потрескался
	for i in 8:
		_game._apply_damage(4.0)
		await get_tree().process_frame
	await _save("02_hit")
	# магазин открыт
	_game._on_shop()
	await get_tree().process_frame
	await _save("03_shop")
	_game._shop_panel.visible = false
	# снаряга куплена — рабочие на экране
	GameState.coins = 5000
	GameState.max_level = 10
	GameState.owned = {"pick_wood": 3, "pick_stone": 2, "helm_bronze": 2, "mach_drill": 1}
	_game._rebuild_workers()
	_game._update_hud()
	await get_tree().create_timer(0.5).timeout
	await _save("04_workers")
	# глава 2 (глубина, синий) — уровень 12
	GameState.max_level = 20
	_game.load_level(12)
	await get_tree().create_timer(0.4).timeout
	await _save("05_deep")
	# глава 3 (магма) — уровень 25 босс
	GameState.max_level = 30
	_game.load_level(25)
	await get_tree().create_timer(0.4).timeout
	await _save("06_boss_magma")
	# золотая жила
	_game.load_level(3)
	_game._golden = true
	_game._spawn_rock()
	await get_tree().process_frame
	await _save("07_golden")
	print("done")
	get_tree().quit(0)
