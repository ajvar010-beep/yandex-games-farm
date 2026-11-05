extends Node3D
## rt_test — runtime-проверки минимального цикла. Печатает PASS/FAIL, код выхода = число фейлов.

var _fails := 0
var _checks := 0

func _ready() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	_run()

func _ck(ok: bool, name: String) -> void:
	_checks += 1
	if not ok:
		_fails += 1
		print("FAIL: ", name)
	else:
		print("PASS: ", name)

func _run() -> void:
	_ck(GameState != null, "GameState autoload")
	_ck(GameState.GEAR.size() >= 20, "GEAR catalog 20 items")
	_ck(GameState.GEAR_ORDER.size() == GameState.GEAR.size(), "GEAR_ORDER covers GEAR")
	_ck(GameState.UPGRADES.size() == 4, "UPGRADES 4 kinds")
	_ck(GameState.SKINS.size() == 4, "SKINS 4")
	# экономика
	GameState.coins = 0
	GameState.owned = {}
	_ck(GameState.tap_power() == 1, "tap_power base=1")
	GameState.coins = 100
	var res := GameState.buy_gear("pick_wood", {})
	_ck(res == 0, "buy pick_wood ok")
	_ck(GameState.gear_owned("pick_wood") == 1, "owned pick_wood=1")
	_ck(GameState.tap_power() == 2, "tap_power +1")
	_ck(GameState.coins < 100, "coins spent")
	# запрет: затопленный уровень не даёт купить машину
	GameState.max_level = 10
	GameState.coins = 100000
	var lvl_flood := {"ban": "machines"}
	res = GameState.buy_gear("mach_drill", lvl_flood)
	_ck(res == 4, "mach_drill banned on flooded")
	# dps: купленная каска даёт dps, машина на затопленном — нет
	GameState.owned = {"helm_bronze": 2, "mach_drill": 1}
	_ck(GameState.dps({}) == 2 * 3 + 25, "dps normal")
	_ck(GameState.dps({"ban": "machines"}) == 2 * 3, "dps flooded excludes machines")
	# открытие по уровню
	_ck(not GameState.gear_unlocked("pick_laser", 5), "laser locked at 5")
	_ck(GameState.gear_unlocked("pick_laser", 23), "laser unlocked at 23")
	# цены растут
	GameState.owned = {"pick_wood": 3}
	_ck(GameState.gear_cost("pick_wood") > 15, "gear cost scales")
	# сейв/лоад
	GameState.coins = 12345
	GameState.max_level = 7
	GameState.save_data()
	GameState.coins = 0
	GameState.max_level = 1
	GameState.load_data()
	_ck(GameState.coins == 12345, "save/load coins")
	_ck(GameState.max_level == 7, "save/load max_level")
	# i18n паритет
	var missing := 0
	for k in GameState.TR:
		var d: Dictionary = GameState.TR[k]
		if not (d.has("ru") and d.has("en")):
			missing += 1
			print("  i18n missing lang for key: ", k)
	_ck(missing == 0, "i18n parity RU/EN")
	# нет мёртвых ключей для снаряжения
	var gear_i18n := 0
	for id in GameState.GEAR_ORDER:
		if not GameState.TR.has(id): gear_i18n += 1
	_ck(gear_i18n == 0, "all gear has i18n")
	# сцена Game грузится и стартует уровень
	var GameScene: PackedScene = load("res://scenes/Game.tscn")
	_ck(GameScene != null, "Game.tscn loads")
	if GameScene:
		var g := GameScene.instantiate()
		add_child(g)
		g.load_level(1)
		await get_tree().process_frame
		_ck(g._levels.size() == 30, "levels.json 30 loaded")
		_ck(g._rock != null, "rock spawned")
		_ck(g._rock_hp == float(g._rock_max), "rock hp full")
		# симулируем тап
		var before := GameState.coins
		g._apply_damage(5.0)
		_ck(g._rock_hp == float(g._rock_max) - 5.0, "tap damages rock")
		# добить камень
		g._apply_damage(float(g._rock_max))
		_ck(g._rocks_broken == 1, "rock broken increments")
		_ck(GameState.coins > before, "coins earned")
		# босс-уровень 5
		g.load_level(5)
		await get_tree().process_frame
		_ck(bool(g._lvl.get("boss", false)), "level 5 is boss")
		_ck(g._boss_active, "boss timer active")
		g.queue_free()
	print("---")
	print("RT: %d/%d PASS" % [_checks - _fails, _checks])
	await get_tree().process_frame
	get_tree().quit(_fails)
