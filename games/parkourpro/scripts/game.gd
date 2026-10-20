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
var _last_interstitial := 0
var _death_pos := Vector3.ZERO
var _deaths := 0
var _revives_used := 0  # цепочка revive (0..max)

const MAX_REVIVES := 5
const INTERSTITIAL_COOLDOWN_MS := 95_000  # не чаще ~95с

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

	cam_rig = preload("res://scripts/camera_rig.gd").new()
	cam_rig.name = "CameraRig"
	add_child(cam_rig)
	cam_rig.target = player

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
		def = JSON.parse_string(f.get_as_text()) as Dictionary
		f.close()
	else:
		def = _procedural_level(n)
	level.load_level(def)
	var start: Array = def.get("start", [0, 2, 0])
	player.set_spawn(Vector3(start[0], start[1], start[2]))
	player.respawn()
	_time_ms = 0
	_ls = Time.get_ticks_msec()
	_running = true
	_deaths = 0
	_revives_used = 0
	hud.get_node("LevelLabel").text = "Уровень %d" % n
	_update_coins()
	# тутор-подсказка на 1 уровне
	if n == 1:
		_show_tutorial_hint()

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
		var m := ["grass","stone","wood","sand"][rng.randi_range(0,3)]
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

var _ls := 0

func _process(_delta: float) -> void:
	if _running:
		_time_ms = Time.get_ticks_msec() - _ls
	# падение за край
	if player.global_position.y < -5.0 and _running:
		_on_player_died()

func _level_start() -> void:
	_ls = Time.get_ticks_msec()

func _on_coin() -> void:
	coins_collected += 1
	GameState.add_coins(1)
	_update_coins()

func _update_coins() -> void:
	hud.get_node("Coins").text = "◈ %d" % coins_collected

func _on_checkpoint(pos: Vector3) -> void:
	player.set_spawn(pos)

func _on_finish() -> void:
	_running = false
	GameState.complete_level(level_num, _time_ms)
	# сабмит в лидерборд (чем меньше время, тем лучше → инвертируем в очки)
	var score := max(1, 1_000_000 - _time_ms)
	Yandex.submit_score("parkour_time", score)
	_show_win()

func _on_player_died() -> void:
	if not _running: return
	_running = false
	_death_pos = player.global_position
	_deaths += 1
	_show_death()

# ---------- HUD ----------
func _build_hud() -> void:
	hud = Control.new()
	hud.name = "HUD"
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)
	layer.add_child(hud)

	var top := HBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_top = 8
	top.offset_left = 12
	top.offset_right = -12
	hud.add_child(top)

	var lvl := Label.new()
	lvl.name = "LevelLabel"
	lvl.add_theme_font_size_override("font_size", 34)
	lvl.add_theme_color_override("font_color", Color.WHITE)
	lvl.add_theme_color_override("font_shadow_color", Color(0,0,0,0.7))
	lvl.add_theme_constant_override("shadow_offset_x", 2)
	lvl.add_theme_constant_override("shadow_offset_y", 2)
	top.add_child(lvl)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)

	var coins := Label.new()
	coins.name = "Coins"
	coins.text = "◈ 0"
	coins.add_theme_font_size_override("font_size", 34)
	coins.add_theme_color_override("font_color", Color(0.4, 1.0, 0.7))
	coins.add_theme_color_override("font_shadow_color", Color(0,0,0,0.7))
	coins.add_theme_constant_override("shadow_offset_x", 2)
	coins.add_theme_constant_override("shadow_offset_y", 2)
	top.add_child(coins)

	# кнопка паузы
	var pause := Button.new()
	pause.name = "PauseBtn"
	pause.text = "❚❚"
	pause.custom_minimum_size = Vector2(72, 72)
	pause.position = Vector2(12, 8)
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
	add_child(layer)
	layer.add_child(ui)
	ui.visible = false

	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.add_child(dim)

	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(460, 300)
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
	_btn_primary.pressed.connect(primary_cb)
	_btn_secondary.pressed.connect(secondary_cb)
	AudioBus.click()

func _hide_panel() -> void:
	ui.visible = false

func _show_death() -> void:
	AudioBus.die()
	var can_rv := _revives_used < MAX_REVIVES
	if can_rv:
		var n := _revives_used + 1
		_show_panel("Провал!", "Упал в лаву... (%d/%d)" % [n, MAX_REVIVES], "▶ Ожить (видео)", _on_revive, "Заново", _on_restart)
	else:
		_show_panel("Провал!", "Упал в лаву...", "Заново", _on_restart, "В меню", _on_menu)

func _on_revive() -> void:
	AudioBus.click()
	_revives_used += 1
	_hide_panel()
	Yandex.show_rewarded(func():
		player.revive()
		_running = true)

func _on_restart() -> void:
	AudioBus.click()
	_hide_panel()
	_maybe_interstitial()
	player.respawn()
	_running = true

func _on_menu() -> void:
	AudioBus.click()
	get_parent().back_to_menu()

func _show_tutorial_hint() -> void:
	var hint := Label.new()
	hint.text = "WASD/свайп — бег • Space/тап — прыжок (двойной!) • Дойди до кольца ⭕"
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hint.offset_y = -120
	hint.add_theme_font_size_override("font_size", 22)
	hint.add_theme_color_override("font_color", Color.WHITE)
	hint.add_theme_color_override("font_shadow_color", Color(0,0,0,0.8))
	hud.add_child(hint)
	var tw := create_tween()
	tw.tween_interval(6.0)
	tw.tween_property(hint, "modulate:a", 0.0, 1.0)
	tw.tween_callback(hint.queue_free)

func _show_win() -> void:
	var t := "%.1f" % (_time_ms / 1000.0)
	# RV на удвоение награды — главный денежный триггер
	_show_panel("Финиш!", "Время: %s сек  •  ◈ %d" % [t, coins_collected], "◈×2 (видео)", _on_double_coins, "Дальше ▶", _on_next)

func _on_double_coins() -> void:
	AudioBus.click()
	_hide_panel()
	Yandex.show_rewarded(func():
		GameState.add_coins(coins_collected)  # удваиваем
		coins_collected *= 2
		AudioBus.buy()
		_show_panel("◈ Удвоено!", "Монет: %d" % coins_collected, "Дальше ▶", _on_next, "В меню", _on_menu))

func _on_next() -> void:
	AudioBus.click()
	_hide_panel()
	_maybe_interstitial()
	load_level(level_num + 1)

func _maybe_interstitial() -> void:
	if GameState.no_ads: return
	var now := Time.get_ticks_msec()
	if now - _last_interstitial > INTERSTITIAL_COOLDOWN_MS:
		_last_interstitial = now
		Yandex.show_fullscreen()

func _toggle_pause() -> void:
	AudioBus.click()
	get_tree().paused = not get_tree().paused
	if get_tree().paused:
		Yandex.gameplay_stop()
		_show_panel("Пауза", "", "Продолжить", _on_resume, "В меню", _on_menu)
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
var _joy_center := Vector2.ZERO

func _build_touch_input() -> void:
	# виртуальный джойстик слева
	_joy_base = Control.new()
	_joy_base.name = "JoyBase"
	_joy_base.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_joy_base.position = Vector2(40, -160)
	_joy_base.custom_minimum_size = Vector2(220, 220)
	hud.add_child(_joy_base)
	var bg := Panel.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.self_modulate = Color(1,1,1,0.12)
	_joy_base.add_child(bg)
	_joy_knob = Control.new()
	_joy_knob.custom_minimum_size = Vector2(90, 90)
	_joy_knob.position = Vector2(65, 65)
	_joy_base.add_child(_joy_knob)
	var knob_p := Panel.new()
	knob_p.set_anchors_preset(Control.PRESET_FULL_RECT)
	knob_p.self_modulate = Color(1,1,1,0.35)
	_joy_knob.add_child(knob_p)

func _input(event: InputEvent) -> void:
	# мобильный: левая половина — джойстик, правая — прыжок
	if event is InputEventScreenTouch:
		var half := get_viewport().get_visible_rect().size.x * 0.5
		if event.pressed:
			if event.position.x < half:
				_joy_active = true
				_joy_id = event.index
				_joy_center = event.position
			else:
				player.tap_jump()
		else:
			if event.index == _joy_id:
				_joy_active = false
				_reset_joy()
	elif event is InputEventScreenDrag and _joy_active and event.index == _joy_id:
		var d: Vector2 = event.position - _joy_center
		var maxr := 90.0
		if d.length() > maxr:
			d = d.normalized() * maxr
		_joy_knob.position = Vector2(65, 65) + d
		# подменяем ввод
		_set_virtual_move(d / maxr)

func _reset_joy() -> void:
	_joy_knob.position = Vector2(65, 65)
	_set_virtual_move(Vector2.ZERO)

var _vmove := Vector2.ZERO
func _set_virtual_move(v: Vector2) -> void:
	_vmove = v

func _unhandled_input(event: InputEvent) -> void:
	# ПК: движение мыши с зажатой ПКМ крутит камеру
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		cam_rig.rotate_cam(event.relative.x, event.relative.y)
