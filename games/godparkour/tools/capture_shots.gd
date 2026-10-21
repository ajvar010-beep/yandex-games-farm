extends Node
## Capture shots: грузит настоящую Game-сцену с реальными уровнями,
## замораживает игрока на платформе, ждёт камеру, сохраняет PNG 1280×720.
## Запуск (оконный режим, НЕ headless — нужен GL-рендер):
##   Godot --path . res://tools/capture_shots.tscn -- ru 3 12 21
##   Godot --path . res://tools/capture_shots.tscn -- en menu   (скрин меню)
## Окно 1280×720 задаётся project.godot.

func _ready() -> void:
	await _run()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var lang := "ru"
	var shots: Array = ["3", "12", "21"]
	if args.size() >= 1 and String(args[0]) in ["ru", "en"]:
		lang = String(args[0])
		if args.size() > 1:
			shots = []
			for a in args.slice(1):
				shots.append(String(a))
	GameState.lang = lang

	var dir := DirAccess.open("res://export")
	if dir and not dir.dir_exists("shots"):
		dir.make_dir("shots")

	for s in shots:
		if s == "menu":
			await _shoot_menu(lang)
		else:
			await _shoot_level(lang, int(s))
	get_tree().quit(0)

func _shoot_menu(lang: String) -> void:
	# витрина progression-системы: звёзды на кнопках, скины, магазин
	GameState.coins = 340
	GameState.max_level = 14
	GameState.stars = {"1": 3, "2": 3, "3": 2, "4": 3, "5": 2, "6": 1, "7": 3}
	GameState.unlocked_skins = ["nub", "pro"]
	GameState.current_skin = "pro"
	var main: Node = load("res://scenes/Main.tscn").instantiate()
	get_tree().root.add_child.call_deferred(main)
	for i in 8:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	img.convert(Image.FORMAT_RGB8)  # 24-бит без альфы — требование витрины
	var out := "res://export/shots/shot_%s_menu.png" % lang
	img.save_png(out)
	print("saved ", out)
	main.queue_free()
	await get_tree().process_frame

func _shoot_level(lang: String, lv: int) -> void:
	var game: Node = load("res://scenes/Game.tscn").instantiate()
	get_tree().root.add_child.call_deferred(game)
	await get_tree().process_frame
	await get_tree().process_frame
	game.call("load_level", lv)
	await get_tree().process_frame
	var player: Node = game.get("player")
	# стоп-кадр: _dead=true гасит физику игрока (mesh остаётся видим),
	# _running=false гасит таймер и проверку падения
	game.set("_running", false)
	var plat := _pick_platform(lv)
	player.global_position = plat + Vector3(0, 1.0, 0)
	player.velocity = Vector3.ZERO
	player.set("_dead", true)
	game.set("coins_collected", 3 + lv % 5)
	game.call("_update_coins")
	game.get("_timer_label").text = "%.1f" % (6.0 + lv)
	# камера: ждём схождения lerp
	for i in 60:
		await get_tree().process_frame
	await get_tree().process_frame  # финальный рендер
	var img := get_viewport().get_texture().get_image()
	img.convert(Image.FORMAT_RGB8)  # 24-бит без альфы — требование витрины
	var out := "res://export/shots/shot_%s_%02d.png" % [lang, lv]
	img.save_png(out)
	print("saved ", out)
	game.queue_free()
	await get_tree().process_frame

func _pick_platform(n: int) -> Vector3:
	var path := "res://levels/%02d.json" % n
	if not FileAccess.file_exists(path):
		return Vector3(0, 1, 0)
	var f := FileAccess.open(path, FileAccess.READ)
	var def: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	var plats: Array = def.get("platforms", [])
	if plats.is_empty():
		return Vector3(0, 1, 0)
	var i := int(plats.size() * 0.4)
	var p: Dictionary = plats[i]
	return Vector3(float(p["x"]), float(p["y"]) + float(p.get("sy", 1)) * 0.5 + 0.8, float(p["z"]))
