extends Node3D
## Game — собирает уровень, игрока, камеру, HUD, UI; логика смерти/победы/revive.

var player: ParkourPlayer
var cam_rig: Node3D
var level: ParkourLevel
var hud: Control
var ui: Control

var level_num := 1
var coins_collected := 0
var _time_ms := 0
var _running := false
var _death_pos := Vector3.ZERO
var _deaths := 0
var _revives_used := 0  # цепочка revive (0..max)

const MAX_REVIVES := 5
const INTERSTITIAL_COOLDOWN_MS := 130_000  # не чаще ~130с (детская аудитория)
# v9.1 (консилиум v9, критик-монетизация MAJOR): win-double платил coins+20 =
# 24..32◈ на 16/21 уровне — МЕНЬШЕ пассивного menu-RV (+30◈ за тап без игры).
# Инверсия ценности тренировала игнорировать RV-триггер с наивысшим намерением
# (сразу после реального прохождения). Флор гарантирует: win-double > menu-RV всегда.
const RV_WIN_BONUS_FLOOR := 40

func _ready() -> void:
	level = ParkourLevel.new()
	level.name = "Level"
	add_child(level)
	level.coin_collected.connect(_on_coin)
	level.checkpoint_reached.connect(_on_checkpoint)
	level.finish_reached.connect(_on_finish)

	var PlayerScene := preload("res://scenes/Player.tscn")
	player = PlayerScene.instantiate()
	player.name = "Player"
	add_child(player)
	player.died.connect(_on_player_died)
	player.shield_absorbed.connect(_update_shield_hud)  # v9: щит поглотил смерть

	cam_rig = preload("res://scripts/camera_rig.gd").new()
	cam_rig.name = "CameraRig"
	add_child(cam_rig)
	cam_rig.target = player
	# игрок создан РАНЬШЕ камеры — его _cam остался null, чиним wiring
	player._cam = cam_rig

	_build_hud()
	_build_ui()
	_build_touch_input()

func load_level(n: int) -> void:
	level_num = n
	var path := "res://levels/%02d.json" % n
	if not FileAccess.file_exists(path):
		path = "res://levels/01.json"
	var f := FileAccess.open(path, FileAccess.READ)
	var def: Dictionary = {}
	if f:
		var parsed = JSON.parse_string(f.get_as_text())
		f.close()
		# v9.1 (консилиум v8.2, критик-код MAJOR): битый/пустой JSON → parse_string
		# даёт null (НЕ Dictionary) → load_level(null) крашил игру. Фолбэк на
		# процедурный уровень — тот же, что при отсутствии файла.
		if parsed is Dictionary and not (parsed as Dictionary).is_empty():
			def = parsed
		else:
			def = _procedural_level(n)
	else:
		def = _procedural_level(n)
	level.load_level(def)
	var start: Array = def.get("start", [0, 2, 0])
	player.set_spawn(Vector3(start[0], start[1], start[2]))
	player.respawn()
	_time_ms = 0
	_par_sec = _calc_par(def)
	_running = true
	_deaths = 0
	_revives_used = 0
	_new_record = false
	_won = false
	# v8.1 (консилиум v8 #3/#5): монеты СБРАСЫВАЕМ на каждый уровень — иначе
	# win-double (bonus = coins_collected + 20) компаундится между уровнями
	# через _on_next на том же узле Game → 59 млн ◈ за сессию, sink 1146 берётся
	# к 7-8 уровню, IAP-спрос = 0.
	coins_collected = 0
	_lvl_label.text = GameState.L("level") % n
	_update_coins()
	_update_shield_hud()  # v9.1: щиты видны сразу на старте уровня, не после первого урона
	_timer_label.text = "0.0"
	# тутор-подсказка на 1 уровне
	if n == 1:
		_show_tutorial_step(0)

# par-время уровня: путь / скорость + ожидание mover/crumble + hazards.
# v8.1 (консилиум v8 minor): par должен отражать РЕАЛЬНОЕ cautious-время, а не
# «идеальный спидран». Раньше: dist/4.5 + mover — не учитывал ни difficulty-вариант,
# ни crumble, ни hazards → 3★ (par×1.2) требовала почти идеальной игры.
func _calc_par(def: Dictionary) -> float:
	var plats: Array = def.get("platforms", [])
	if plats.size() < 2:
		return 20.0
	var dist := 0.0
	var prev := Vector3.ZERO
	var mover_wait := 0.0
	var crumble_n := 0
	for i in plats.size():
		var p: Dictionary = plats[i]
		var cur := Vector3(float(p.get("x", 0)), float(p.get("y", 0)), float(p.get("z", 0)))
		if i > 0:
			dist += prev.distance_to(cur)
		prev = cur
		# на mover в среднем ждём ~0.75 полупериода (фаза случайна)
		if p.has("move"):
			var mv: Dictionary = p["move"]
			var spd := maxf(0.5, float(mv.get("speed", 2.0)))
			mover_wait += 0.75 * (PI / spd)
		# crumble: каждое крошение — ~0.35с осторожности (тайминг прыжка, не стоять)
		if p.has("crumble"):
			crumble_n += 1
	# hazards (красные блоки): каждый требует выверенного прыжка — ~0.4с
	var haz_n: int = (def.get("hazards", []) as Array).size()
	# эффективная скорость с прыжками ПАДАЕТ с difficulty: god-гравитация (×1.35)
	# укорачивает reach → больше двойных прыжков, медленнее. base 4.5 / difficulty.
	var spd_eff := 4.5 / maxf(0.8, Variant.difficulty)
	# v9.1 (консилиум v9, критик-геймплей minor): множитель mover_wait 0.5→0.7 —
	# skilled-модель на L3 опаздывала на 0.2с к порогу 3★ (единственный уровень, где
	# цель «63 звезды» была недостижима честной игрой). Параметрический замер
	# (scratch/star_param.cjs): 0.7 даёт 21/21 при минимальном раздутии par
	# (важно: par теперь ещё и знаменатель лидерборд-скора).
	var par := dist / spd_eff + mover_wait * 0.7 + crumble_n * 0.35 + haz_n * 0.4
	# v9.2 (консилиум v9.1 minor): лидерборд-par БЕЗ флора 8.0. score=1000×par/time
	# пропорционален par, и maxf(8.0) раздувал L1 (nat-par 6.7 → 8.0) → кемпинг L1
	# оставался оптимумом доски (1839 vs L2 1663), вопреки комментарию у submit_score.
	# Флор звёзд остаётся в _stars_earned — 8.0 нужен там, чтобы пар 3★ на коротком
	# туториале не был тривиальным; на лидерборд он больше не влияет.
	_par_raw = par
	return maxf(8.0, par)

func _procedural_level(n: int) -> Dictionary:
	# авто-генерация, если нет файла уровня
	var rng := RandomNumberGenerator.new()
	rng.seed = 1000 + n
	var plats := []
	var pos := Vector3(0, 0, 0)
	plats.append({"x":0,"y":0,"z":0,"sx":6,"sy":1,"sz":6,"mat":"grass"})
	var coins := []
	var cps := []
	var steps := int((8 + n) * Variant.difficulty)
	var gap := (2.2 + minf(n * 0.12, 2.0)) * Variant.difficulty
	var w := 2.4 - minf(n * 0.05, 1.2) / Variant.difficulty
	var dir := 1
	for i in range(1, steps):
		var nx = pos.x + rng.randf_range(-3.0, 3.0) * dir
		var nz = pos.z - (3.0 + gap + rng.randf_range(0, 1.5))
		var ny = pos.y + rng.randf_range(-0.3, 0.8)
		var m: String = ["grass","stone","wood","sand"][rng.randi_range(0,3)]
		var p := {"x":snappedf(nx,0.5),"y":snappedf(ny,0.5),"z":snappedf(nz,0.5),"sx":w,"sy":0.8,"sz":w,"mat":m}
		# иногда движущаяся
		if n >= 4 and rng.randf() < 0.18:
			p["move"] = {"axis":"x","range":2.0,"speed":1.5+rng.randf()}
		plats.append(p)
		pos = Vector3(p.x, p.y, p.z)
		if i % 3 == 0:
			coins.append([pos.x, pos.y+1.0, pos.z])
		if i == int(steps/2):
			cps.append([pos.x, pos.y+0.5, pos.z])
		dir = -dir
	plats.append({"x":pos.x,"y":pos.y+0.5,"z":pos.z-3,"sx":5,"sy":1,"sz":5,"mat":"gold"})
	return {"start":[0,2,0],"platforms":plats,"coins":coins,"checkpoints":cps,"finish":[pos.x,pos.y+1.5,pos.z-3],"lava_y":-6.0,"lava_size":240.0}

func _process(delta: float) -> void:
	if _running and not get_tree().paused:
		# честный спидран-таймер: копим только активное время (без панелей/видео)
		_time_ms += int(delta * 1000.0)
		_timer_label.text = "%.1f" % (_time_ms / 1000.0)
	# падение за край — через kill(), а не напрямую в _on_player_died:
	# v9: только kill() знает про щит (поглощает смерть до died-сигнала).
	if player.global_position.y < -5.0 and _running:
		player.kill()

func _on_coin() -> void:
	if not _running: return  # труп не фармит монеты
	# v11: «Бог Паркура» даёт ×2 монеты (coin_mult) — риск (хардкор) = награда.
	var m: int = Variant.coin_mult
	coins_collected += m
	GameState.add_coins(m)
	_update_coins()

func _update_coins() -> void:
	_coins_label.text = "◈ %d" % coins_collected

# v9: HUD-счётчик щитов — пустая строка, если щитов нет (не мусорит интерфейс)
func _update_shield_hud() -> void:
	if _shield_label == null: return
	var n: int = player.shields
	_shield_label.text = (GameState.L("shield_n") % n) if n > 0 else ""

func _on_checkpoint(pos: Vector3) -> void:
	player.set_spawn(pos)

func _on_finish() -> void:
	if _won: return  # защита от повторного триггера
	if player.get("_dead"): return  # мёртвый не побеждает
	_won = true
	_running = false
	_new_record = GameState.is_new_record(level_num, _time_ms)
	GameState.complete_level(level_num, _time_ms)
	# v9.1 (консилиум v9, критик-монетизация MAJOR): score = par-эффективность ×1000,
	# НЕ 1e6−мс. Старая формула монотонно падала с длиной уровня → доска структурно
	# вознаграждала кемпинг самого короткого lv1 (туториал), а не кампанию 21 уровня:
	# поздние уровни только ухудшали лучший скор, который хранит setScore. Нормализация
	# по par: прохождение длинного уровня в par даёт ~1000 (сопоставимо с коротким),
	# быстрее par → выше.
	# v9.2 (minor): берём _par_raw БЕЗ флора 8.0 — флор раздувал par L1 (6.7→8.0)
	# и кемпинг L1 оставался оптимумом (замер критика: 1839 vs L2 1663). Без флора
	# теоретический максимум скора одинаков для всех дистанционных уровней (~1944 =
	# 1000×8.75/4.5), оптимум — играть всю кампанию быстро.
	var score: int = maxi(1, int(round(1000.0 * _par_raw / maxf(0.1, _time_ms / 1000.0))))
	Yandex.submit_score("parkour_time", score)
	_show_win()

func _on_player_died() -> void:
	if not _running: return
	_running = false
	_death_pos = player.global_position
	_deaths += 1
	# kill() замораживает физику (_dead=true) — иначе тело долетает до лавы,
	# приземляется на неё (is_on_floor) и портило _last_safe; заодно анимация распада
	player.kill()
	_show_death()

# ---------- HUD ----------
var _lvl_label: Label
var _coins_label: Label
var _timer_label: Label
var _shield_label: Label  # v9: счётчик щитов (виден только когда shields>0)

func _build_hud() -> void:
	hud = Control.new()
	hud.name = "HUD"
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	var layer := CanvasLayer.new()
	layer.layer = 10
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(layer)
	layer.add_child(hud)

	var top := HBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_top = 8
	top.offset_left = 12
	top.offset_right = -96  # справа — кнопка паузы
	hud.add_child(top)

	_lvl_label = Label.new()
	_lvl_label.add_theme_font_size_override("font_size", 34)
	_lvl_label.add_theme_color_override("font_color", Color.WHITE)
	_lvl_label.add_theme_color_override("font_shadow_color", Color(0,0,0,0.7))
	_lvl_label.add_theme_constant_override("shadow_offset_x", 2)
	_lvl_label.add_theme_constant_override("shadow_offset_y", 2)
	top.add_child(_lvl_label)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)

	_coins_label = Label.new()
	_coins_label.text = "◈ 0"
	_coins_label.add_theme_font_size_override("font_size", 34)
	_coins_label.add_theme_color_override("font_color", Color(0.4, 1.0, 0.7))
	_coins_label.add_theme_color_override("font_shadow_color", Color(0,0,0,0.7))
	_coins_label.add_theme_constant_override("shadow_offset_x", 2)
	_coins_label.add_theme_constant_override("shadow_offset_y", 2)
	top.add_child(_coins_label)

	# v9: счётчик щитов (прокачка) — между монетами и паузой, виден при shields>0
	_shield_label = Label.new()
	_shield_label.add_theme_font_size_override("font_size", 30)
	_shield_label.add_theme_color_override("font_color", Color(0.6, 0.85, 1.0))
	_shield_label.add_theme_color_override("font_shadow_color", Color(0,0,0,0.7))
	_shield_label.add_theme_constant_override("shadow_offset_x", 2)
	_shield_label.add_theme_constant_override("shadow_offset_y", 2)
	top.add_child(_shield_label)
	_update_shield_hud()

	# таймер (спидран)
	_timer_label = Label.new()
	_timer_label.text = "0.0"
	_timer_label.add_theme_font_size_override("font_size", 26)
	_timer_label.add_theme_color_override("font_color", Color(0.9, 0.95, 1.0))
	_timer_label.add_theme_color_override("font_shadow_color", Color(0,0,0,0.7))
	_timer_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_timer_label.offset_top = 10
	hud.add_child(_timer_label)

	# кнопка паузы — справа вверху (не перекрывает LevelLabel)
	var pause := Button.new()
	pause.name = "PauseBtn"
	pause.text = "II"
	pause.custom_minimum_size = Vector2(72, 72)
	pause.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	pause.offset_left = -84
	pause.offset_right = -12
	pause.offset_top = 8
	pause.offset_bottom = 80
	pause.add_theme_font_size_override("font_size", 28)
	pause.pressed.connect(_toggle_pause)
	hud.add_child(pause)

# ---------- UI (смерть/победа/пауза) ----------
var _panel: PanelContainer
var _panel_title: Label
var _panel_sub: Label
var _btn_primary: Button
var _btn_secondary: Button

func _build_ui() -> void:
	ui = Control.new()
	ui.name = "UI"
	ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	var layer := CanvasLayer.new()
	layer.layer = 20
	# КРИТИЧНО: панель паузы/смерти/победы должна принимать ввод при paused-дереве
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(layer)
	layer.add_child(ui)
	ui.visible = false

	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.add_child(dim)

	_panel = PanelContainer.new()
	# anchors AND offsets по центру (set_anchors_preset оставляет offsets нулевыми — панель уезжала)
	_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(460, 300)
	_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	ui.add_child(_panel)

	var vb := VBoxContainer.new()
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_theme_constant_override("separation", 18)
	_panel.add_child(vb)

	_panel_title = Label.new()
	_panel_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_panel_title.add_theme_font_size_override("font_size", 48)
	vb.add_child(_panel_title)

	_panel_sub = Label.new()
	_panel_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_panel_sub.add_theme_font_size_override("font_size", 24)
	vb.add_child(_panel_sub)

	_btn_primary = Button.new()
	_btn_primary.custom_minimum_size = Vector2(380, 76)
	_btn_primary.add_theme_font_size_override("font_size", 28)
	vb.add_child(_btn_primary)

	_btn_secondary = Button.new()
	_btn_secondary.custom_minimum_size = Vector2(380, 64)
	_btn_secondary.add_theme_font_size_override("font_size", 24)
	vb.add_child(_btn_secondary)

func _show_panel(title: String, sub: String, primary_text: String, primary_cb: Callable, secondary_text: String, secondary_cb: Callable) -> void:
	ui.visible = true
	_panel_title.text = title
	_panel_sub.text = sub
	_btn_primary.text = primary_text
	_btn_secondary.text = secondary_text
	# очистка старых коннектов
	for c in _btn_primary.pressed.get_connections():
		_btn_primary.pressed.disconnect(c.callable)
	for c in _btn_secondary.pressed.get_connections():
		_btn_secondary.pressed.disconnect(c.callable)
	if primary_cb.is_valid():
		_btn_primary.pressed.connect(primary_cb)
	if secondary_cb.is_valid():
		_btn_secondary.pressed.connect(secondary_cb)
	AudioBus.click()

func _hide_panel() -> void:
	ui.visible = false

func _show_death() -> void:
	AudioBus.die()
	var can_rv := _revives_used < MAX_REVIVES
	if can_rv:
		var n := _revives_used + 1
		_show_panel(GameState.L("fail"), GameState.L("lava_n") % [n, MAX_REVIVES], GameState.L("revive"), _on_revive, GameState.L("restart"), _on_restart)
	else:
		_show_panel(GameState.L("fail"), GameState.L("lava"), GameState.L("restart"), _on_restart, GameState.L("menu"), _on_menu)

func _on_revive() -> void:
	AudioBus.click()
	_hide_panel()
	Yandex.show_rewarded(func():
		# награда получена — только теперь тратим попытку revive
		_revives_used += 1
		player.revive()
		_running = true,
		func():
			# ошибка рекламы — без софтока: панель снова показана
			AudioBus.mute(false)
			_show_death())

func _on_restart() -> void:
	AudioBus.click()
	_hide_panel()
	# смерть + мгновенная реклама = двойной удар по новичку (тренд: рейтинг важнее дохода)
	if _deaths >= 2:
		_maybe_interstitial()
	player.respawn()
	_update_shield_hud()  # v9.1: respawn() пополнил щиты — отразить в HUD (не stale)
	_running = true

func _on_menu() -> void:
	AudioBus.click()
	# родитель — GameHolder (без скрипта): Main ищем от корня, иначе софтлок «В меню»
	get_tree().paused = false
	# v9.2 (консилиум v9.1 minor): если выход в меню произошёл во время рекламы,
	# сбросить ad-флаг — иначе запаздывающий _on_adv_done снимет уже ПОЛЬЗОВАТЕЛЬСКУЮ
	# паузу (рассинхрон состояния). Yandex — autoload, метод всегда доступен.
	if Yandex.get("_paused_by_adv"):
		Yandex.set("_paused_by_adv", false)
	var main := get_tree().root.get_node_or_null("Main")
	if main:
		main.back_to_menu()
	else:
		get_tree().change_scene_to_file("res://scenes/Main.tscn")

var _tutorial_step := 0
var _tutorial_label: Label

func _show_tutorial_step(step: int) -> void:
	_tutorial_step = step
	if _tutorial_label:
		_tutorial_label.queue_free()
		_tutorial_label = null
	if step > 2:
		return
	_tutorial_label = Label.new()
	var texts := [
		GameState.L("tut0"),
		GameState.L("tut1"),
		GameState.L("tut2")
	]
	_tutorial_label.text = texts[step]
	_tutorial_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# preset + offset_top/bottom (offset_y после preset сбрасывался в 0 — тутор был невидим)
	_tutorial_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_tutorial_label.offset_top = -150
	_tutorial_label.offset_bottom = -110
	_tutorial_label.offset_left = -400
	_tutorial_label.offset_right = 400
	_tutorial_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_tutorial_label.add_theme_font_size_override("font_size", 24)
	_tutorial_label.add_theme_color_override("font_color", Color(1, 1, 0.4))
	_tutorial_label.add_theme_color_override("font_shadow_color", Color(0,0,0,0.8))
	hud.add_child(_tutorial_label)

# шаги тутора по типу действия (а не каждый кадр): move→jump→double
func _advance_tutorial(trigger: String = "") -> void:
	if level_num != 1: return
	match trigger:
		"move":
			if _tutorial_step == 0:
				_show_tutorial_step(1)
		"jump":
			if _tutorial_step == 1:
				_show_tutorial_step(2)
		"double":
			if _tutorial_step == 2:
				_show_tutorial_step(99)  # скрыть

var _par_sec := 20.0  # par-время уровня: путь / средняя скорость (с флором 8.0 для звёзд)
var _par_raw := 20.0  # v9.2: par БЕЗ флора — только для лидерборд-скора (см. _calc_par)
var _new_record := false
var _won := false

func _stars_earned() -> int:
	# звёзды от par-времени: par×1.2 = 3★, par×1.8 = 2★, иначе 1★
	# (детская аудитория: 3★ достижима хорошей игрой, не идеальной)
	var sec := _time_ms / 1000.0
	if sec <= _par_sec * 1.2: return 3
	if sec <= _par_sec * 1.8: return 2
	return 1

func _star_str(n: int) -> String:
	return "★★★" if n == 3 else ("★★☆" if n == 2 else "★☆☆")

func _show_win() -> void:
	var t := "%.1f" % (_time_ms / 1000.0)
	var stars := _stars_earned()
	GameState.add_stars(level_num, stars)
	var body := GameState.L("time_coins") % [t, coins_collected]
	if _new_record:
		body += "\n" + GameState.L("new_record")
	_show_panel(GameState.L("finish") % _star_str(stars), body, _double_btn_text(), _on_double_coins, GameState.L("next"), _on_next)

# v9.2: текст кнопки = фактическая сумма бонуса (та же формула, что в _on_double_coins)
func _double_btn_text() -> String:
	return GameState.L("double_win") % maxi(coins_collected + 20, RV_WIN_BONUS_FLOOR)

func _on_double_coins() -> void:
	AudioBus.click()
	_hide_panel()
	Yandex.show_rewarded(func():
		# удваиваем + фикс-бонус 20, но не меньше флора (см. RV_WIN_BONUS_FLOOR):
		# смотреть видео на финише выгодно ВСЕГДА — даже беднее menu-RV не бывает
		var bonus := maxi(coins_collected + 20, RV_WIN_BONUS_FLOOR)
		GameState.add_coins(bonus)
		coins_collected += bonus
		AudioBus.buy()
		_show_panel(GameState.L("bonus_got"), GameState.L("coins_n") % coins_collected, GameState.L("next"), _on_next, GameState.L("menu"), _on_menu),
		func():
			# ошибка рекламы — возвращаем панель победы без удвоения
			_show_win_panel())

func _show_win_panel() -> void:
	var t := "%.1f" % (_time_ms / 1000.0)
	var star_str := _star_str(_stars_earned())
	_show_panel(GameState.L("finish") % star_str, GameState.L("time_coins") % [t, coins_collected], _double_btn_text(), _on_double_coins, GameState.L("next"), _on_next)

func _on_next() -> void:
	AudioBus.click()
	_hide_panel()
	_maybe_interstitial()
	# v9.1 (консилиум v8.2, критик-код minor): после финала load_level(N+1)
	# молча играл 01.json с номером «Уровень N+1» в HUD. Явный цикл на 1 (NG+:
	# фарм монет/звёзд на пройденных уровнях — стандарт жанра).
	# v11: финал = Variant.levels_total (21 у Нуба/Бога, 30 у Про с хакер-главой).
	load_level(1 if level_num >= Variant.levels_total else level_num + 1)

func _maybe_interstitial() -> void:
	if GameState.no_ads: return
	# v8.1 (minor): кулдаун — в GameState (переживает вход в меню). Time.get_ticks_msec()
	# монотонный в рамках сессии процесса; на reload страницы сбрасывается вместе с
	# GameState — допустимо (новая сессия = новый показ разрешён правилами Яндекса).
	var now := Time.get_ticks_msec()
	if now - GameState.last_interstitial_ms > INTERSTITIAL_COOLDOWN_MS:
		GameState.last_interstitial_ms = now
		Yandex.show_fullscreen()

func _toggle_pause() -> void:
	AudioBus.click()
	get_tree().paused = not get_tree().paused
	if get_tree().paused:
		Yandex.gameplay_stop()
		_show_panel(GameState.L("pause"), "", GameState.L("continue"), _on_resume, GameState.L("menu"), _on_menu)
	else:
		_hide_panel()
		Yandex.gameplay_start()

func _on_resume() -> void:
	get_tree().paused = false
	_hide_panel()
	Yandex.gameplay_start()

# ---------- мобильный ввод ----------
var _joy_base: Control
var _joy_knob: Control
var _joy_active := false
var _joy_id := -1
# v10.1: свайп по правой половине = вращение камеры; тап без движения = прыжок
var _cam_touch_id := -1
var _cam_touch_moved := Vector2.ZERO
var _joy_center := Vector2.ZERO

func _build_touch_input() -> void:
	# v10.2 (запрос пользователя): управление как в ROBLOX —
	# (1) ДИНАМИЧЕСКИЙ стик: появляется ПОД ПАЛЬЦЕМ в любом месте левой половины
	#     (Roblox Dynamic Thumbstick), а не прибит к углу;
	# (2) отдельная круглая кнопка ПРЫЖКА справа внизу (в Roblox прыжок — кнопка,
	#     не тап по экрану);
	# (3) свайп правой половины — только камера.
	var joy_size := Vector2(200, 200)
	var safe_bottom := 16.0
	var safe_right := 16.0
	# DisplayServer.get_display_safe_area() — Rect2i в экранных координатах
	# (Window.get_safe_area() в Godot 4.7 НЕТ — rt_test поймал «Nonexistent function»).
	# На десктопе возвращает весь прямоугольник окна → maxf оставляет дефолт 16.
	var sa: Rect2i = DisplayServer.get_display_safe_area()
	var win_size: Vector2i = DisplayServer.window_get_size()
	if sa.size.x > 0 and sa.size.y > 0:
		safe_bottom = maxf(16.0, float(win_size.y - (sa.position.y + sa.size.y)))
		safe_right = maxf(16.0, float(win_size.x - (sa.position.x + sa.size.x)))
	# динамический стик: скрыт до первого касания, позиционируется под пальцем
	_joy_base = Control.new()
	_joy_base.name = "JoyBase"
	_joy_base.custom_minimum_size = joy_size
	_joy_base.size = joy_size
	_joy_base.visible = false
	_joy_base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(_joy_base)
	var bg := Panel.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.self_modulate = Color(1, 1, 1, 0.14)
	var bg_sb := StyleBoxFlat.new()
	bg_sb.bg_color = Color(1, 1, 1, 0.14)
	bg_sb.corner_radius_top_left = 100
	bg_sb.corner_radius_top_right = 100
	bg_sb.corner_radius_bottom_left = 100
	bg_sb.corner_radius_bottom_right = 100
	bg.add_theme_stylebox_override("panel", bg_sb)
	_joy_base.add_child(bg)
	_joy_knob = Control.new()
	_joy_knob.custom_minimum_size = Vector2(84, 84)
	_joy_knob.size = Vector2(84, 84)
	_joy_knob.position = (joy_size - Vector2(84, 84)) * 0.5
	_joy_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_joy_base.add_child(_joy_knob)
	var knob_p := Panel.new()
	knob_p.set_anchors_preset(Control.PRESET_FULL_RECT)
	var knob_sb := StyleBoxFlat.new()
	knob_sb.bg_color = Color(1, 1, 1, 0.4)
	knob_sb.corner_radius_top_left = 42
	knob_sb.corner_radius_top_right = 42
	knob_sb.corner_radius_bottom_left = 42
	knob_sb.corner_radius_bottom_right = 42
	knob_p.add_theme_stylebox_override("panel", knob_sb)
	_joy_knob.add_child(knob_p)
	_joy_center_offset = joy_size * 0.5

	# круглая кнопка ПРЫЖКА (Roblox: jump — кнопка справа внизу)
	_jump_btn = Button.new()
	_jump_btn.name = "JumpBtn"
	_jump_btn.text = "↑"
	_jump_btn.add_theme_font_size_override("font_size", 40)
	_jump_btn.custom_minimum_size = Vector2(104, 104)
	_jump_btn.size = Vector2(104, 104)
	_jump_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_jump_btn.position = Vector2(-safe_right - 104.0 - 12.0, -safe_bottom - 104.0 - 12.0)
	var j_sb := StyleBoxFlat.new()
	j_sb.bg_color = Color(1, 1, 1, 0.22)
	j_sb.corner_radius_top_left = 52
	j_sb.corner_radius_top_right = 52
	j_sb.corner_radius_bottom_left = 52
	j_sb.corner_radius_bottom_right = 52
	_jump_btn.add_theme_stylebox_override("normal", j_sb)
	var j_sb_pr := j_sb.duplicate() as StyleBoxFlat
	j_sb_pr.bg_color = Color(1, 1, 1, 0.4)
	_jump_btn.add_theme_stylebox_override("pressed", j_sb_pr)
	_jump_btn.flat = true
	_jump_btn.focus_mode = Control.FOCUS_NONE
	_jump_btn.pressed.connect(func():
		if player: player.tap_jump())
	hud.add_child(_jump_btn)

	# v9: кнопка РЫВКА — над кнопкой прыжка (Roblox-стопка кнопок справа).
	# Показываем только если апгрейд dash куплен — иначе мёртвая кнопка путает.
	if GameState.upgrade_level("dash") > 0:
		_dash_btn = Button.new()
		_dash_btn.name = "DashBtn"
		_dash_btn.text = "»»"
		_dash_btn.add_theme_font_size_override("font_size", 30)
		_dash_btn.custom_minimum_size = Vector2(92, 92)
		_dash_btn.size = Vector2(92, 92)
		_dash_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		_dash_btn.position = Vector2(-safe_right - 100.0 - 12.0, -safe_bottom - 104.0 - 24.0 - 92.0)
		var d_sb := StyleBoxFlat.new()
		d_sb.bg_color = Color(1, 1, 1, 0.18)
		d_sb.corner_radius_top_left = 46
		d_sb.corner_radius_top_right = 46
		d_sb.corner_radius_bottom_left = 46
		d_sb.corner_radius_bottom_right = 46
		_dash_btn.add_theme_stylebox_override("normal", d_sb)
		_dash_btn.flat = true
		_dash_btn.focus_mode = Control.FOCUS_NONE
		_dash_btn.modulate = Color(1, 1, 1, 0.75)
		_dash_btn.pressed.connect(func(): player.try_dash())
		hud.add_child(_dash_btn)

var _dash_btn: Button = null
var _jump_btn: Button = null
var _joy_center_offset := Vector2(100, 100)

func _input(event: InputEvent) -> void:
	# v10.2 (Roblox Dynamic Thumbstick): палец в ЛЮБОМ месте левой половины =
	# стик появляется ПОД ПАЛЬЦЕМ; правая половина = только камера; прыжок —
	# отдельная кнопка (тап по правой половине больше НЕ прыгает).
	# event.position для ScreenTouch/Drag приходит УЖЕ в canvas-координатах
	# (Godot конвертирует screen→canvas до _input, при stretch canvas_items),
	# поэтому сравниваем напрямую с half и GUI-rect'ами — без доп. трансформ.
	if event is InputEventScreenTouch:
		var pos: Vector2 = event.position
		var half := get_viewport().get_visible_rect().size.x * 0.5
		if event.pressed:
			if ui != null and ui.visible:
				# панель открыта (смерть/победа/пауза) — тап идёт по её кнопкам,
				# НЕ по игре (иначе фантомный прыжок сразу после revive).
				return
			if _touch_on_buttons(pos):
				return  # кнопки сами ловят pressed (Button.pressed)
			if pos.x < half:
				# динамический стик: база — под пальцем
				_joy_active = true
				_joy_id = event.index
				_joy_center = pos
				_joy_base.visible = true
				var vp := get_viewport().get_visible_rect().size
				_joy_base.position = Vector2(
					clampf(pos.x - _joy_center_offset.x, 0, vp.x - _joy_base.size.x),
					clampf(pos.y - _joy_center_offset.y, 0, vp.y - _joy_base.size.y))
				_joy_knob.position = _joy_center_offset - _joy_knob.size * 0.5
			else:
				_cam_touch_id = event.index
				_cam_touch_moved = Vector2.ZERO
		else:
			if event.index == _joy_id:
				_joy_active = false
				_joy_base.visible = false
				_reset_joy()
			elif event.index == _cam_touch_id:
				_cam_touch_id = -1
	elif event is InputEventScreenDrag:
		if _joy_active and event.index == _joy_id:
			var d: Vector2 = event.position - _joy_center
			var maxr := 80.0
			if d.length() > maxr:
				d = d.normalized() * maxr
			_joy_knob.position = _joy_center_offset - _joy_knob.size * 0.5 + d
			_set_virtual_move(d / maxr)
		elif event.index == _cam_touch_id and cam_rig:
			# свайп правой половины крутит камеру (rotate_cam глушит авто-доворот)
			_cam_touch_moved += event.relative
			cam_rig.rotate_cam(event.relative.x * 1.6, event.relative.y * 1.6)

# нажатие пришлось на кнопку прыжка/рывка? (Button сам обработает — не дублировать)
func _touch_on_buttons(pos: Vector2) -> bool:
	if _jump_btn != null and _jump_btn.get_global_rect().has_point(pos):
		return true
	if _dash_btn != null and _dash_btn.get_global_rect().has_point(pos):
		return true
	return false

func _reset_joy() -> void:
	_joy_knob.position = _joy_center_offset - _joy_knob.size * 0.5
	_set_virtual_move(Vector2.ZERO)

var _vmove := Vector2.ZERO
func _set_virtual_move(v: Vector2) -> void:
	_vmove = v

func _unhandled_input(event: InputEvent) -> void:
	# ПК: движение мыши с зажатой ПКМ крутит камеру
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		cam_rig.rotate_cam(event.relative.x, event.relative.y)
