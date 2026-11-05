extends Control
## Menu — главное меню: заголовок, Играть, выбор уровня, скины, лидерборд, магазин IAP, дейли, офлайн.

var _root: VBoxContainer = null
var _title: Label = null
var _sub: Label = null
var _play: Button = null
var _levels_grid: GridContainer = null
var _coins_lbl: Label = null
var _offline_panel: PanelContainer = null
var _daily_panel: PanelContainer = null
var _lb_panel: PanelContainer = null
var _skin_row: HBoxContainer = null
var _lang_btn: Button = null

func _ready() -> void:
	_build()
	if not GameState.lang_changed.is_connected(refresh):
		GameState.lang_changed.connect(refresh)
	# офлайн-заработок и дейли — после загрузки
	call_deferred("_post_open")

func refresh() -> void:
	if _root: _root.queue_free()
	_build()

func _build() -> void:
	# фон-шахта (градиент через StyleBoxFlat тёмный)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.07, 0.06, 0.10)
	var bgp := PanelContainer.new()
	bgp.set_anchors_preset(Control.PRESET_FULL_RECT)
	bgp.add_theme_stylebox_override("panel", bg)
	bgp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bgp)

	var scroll := ScrollContainer.new()
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	_root = VBoxContainer.new()
	_root.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_root.add_theme_constant_override("separation", 10)
	_root.alignment = BoxContainer.ALIGNMENT_CENTER
	scroll.add_child(_root)

	# шапка: язык + звук + монеты
	var top := HBoxContainer.new()
	top.alignment = BoxContainer.ALIGNMENT_CENTER
	top.add_theme_constant_override("separation", 12)
	_root.add_child(top)
	_lang_btn = _btn(GameState.lang.to_upper(), 16)
	_lang_btn.pressed.connect(func():
		GameState.set_lang("en" if GameState.lang == "ru" else "ru"))
	top.add_child(_lang_btn)
	var snd := _btn(GameState.L("sound_on" if GameState.sound_on else "sound_off"), 16)
	snd.pressed.connect(func():
		GameState.sound_on = not GameState.sound_on; GameState.save_data(); refresh())
	top.add_child(snd)
	_coins_lbl = _lbl("", 22, Color(1.0, 0.9, 0.4))
	top.add_child(_coins_lbl)

	_title = _lbl(GameState.L("title"), 44, Color(1.0, 0.85, 0.4))
	_root.add_child(_title)
	_sub = _lbl(GameState.L("sub"), 18, Color(0.9, 0.9, 0.9))
	_root.add_child(_sub)

	# офлайн-панель
	_offline_panel = _mk_panel()
	_root.add_child(_offline_panel)
	_offline_panel.visible = false
	# дейли-панель
	_daily_panel = _mk_panel()
	_root.add_child(_daily_panel)
	_daily_panel.visible = false

	# Играть (продолжить с max_level)
	_play = _btn(GameState.L("play") + "  ▶  " + (GameState.L("level") % GameState.max_level), 30)
	_play.custom_minimum_size = Vector2(340, 66)
	_play.pressed.connect(func():
		var m := _main(); if m: m.start_level(GameState.max_level))
	_root.add_child(_play)

	# RV-монеты (меню, кулдаун 60с) + IAP
	var row := HBoxContainer.new(); row.alignment = BoxContainer.ALIGNMENT_CENTER; row.add_theme_constant_override("separation", 10)
	_root.add_child(row)
	var rv := _btn(GameState.L("rv_coins") % 200, 18)
	rv.pressed.connect(func():
		var now := Time.get_ticks_msec()
		if now - GameState.last_rv_coins_ms < 60000:
			_toast(GameState.L("rv_no_reward")); return
		Yandex.show_rewarded(func():
			GameState.last_rv_coins_ms = Time.get_ticks_msec()
			GameState.add_coins(200); refresh(),
		func(): _toast(GameState.L("rv_no_reward"))))
	row.add_child(rv)
	var noads: Button = _btn(GameState.L("noads_owned") if GameState.no_ads else GameState.L("shop_noads"), 16)
	setup_noads_btn(noads)
	row.add_child(noads)
	for pk in [["coins_5000", "shop_coins1"], ["coins_20000", "shop_coins2"]]:
		var b := _btn(GameState.L(pk[1]), 16)
		b.pressed.connect(func():
			Yandex.purchase(pk[0], func():
				GameState.add_coins(5000 if pk[0] == "coins_5000" else 20000)
				_toast(GameState.L("doubled")); refresh(),
			func(): _toast(GameState.L("rv_no_reward"))))
		row.add_child(b)

	# уровни
	
	_levels_grid = GridContainer.new()
	_levels_grid.columns = 6
	_levels_grid.add_theme_constant_override("h_separation", 8)
	_levels_grid.add_theme_constant_override("v_separation", 8)
	_root.add_child(_levels_grid)
	_build_levels()

	# скины
	_root.add_child(_lbl("— " + GameState.L("skins") + " —", 20, Color(0.8, 0.9, 1.0)))
	_skin_row = HBoxContainer.new()
	_skin_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_skin_row.add_theme_constant_override("separation", 10)
	_root.add_child(_skin_row)
	_build_skins()

	# лидерборд
	_root.add_child(_lbl("— " + GameState.L("lb_hdr") + " —", 20, Color(0.8, 0.9, 1.0)))
	_lb_panel = _mk_panel()
	_root.add_child(_lb_panel)
	var lbv := VBoxContainer.new(); lbv.name = "LBV"
	_lb_panel.add_child(lbv)
	lbv.add_child(_lbl(GameState.L("lb_loading"), 16, Color(0.9, 0.9, 0.9)))
	Yandex.get_leaderboard("depth", _fill_lb)

	# цель
	_root.add_child(_lbl("— " + GameState.L("series_hdr") + " —", 20, Color(0.8, 0.9, 1.0)))
	var goal := _lbl(GameState.L("series_goal"), 16, Color(0.85, 0.85, 0.85))
	goal.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	goal.custom_minimum_size = Vector2(560, 0)
	_root.add_child(goal)

func _build_levels() -> void:
	for c in _levels_grid.get_children(): c.queue_free()
	var total := Variant.levels_total
	for i in range(1, total + 1):
		var open := i <= GameState.max_level
		var b := _btn(str(i), 20)
		b.custom_minimum_size = Vector2(84, 54)
		if not open:
			b.text = "🔒"
			b.disabled = true
		else:
			b.pressed.connect(func():
				var m := _main(); if m: m.start_level(i))
		_levels_grid.add_child(b)

func _build_skins() -> void:
	for c in _skin_row.get_children(): c.queue_free()
	for id in GameState.SKIN_ORDER:
		var s: Dictionary = GameState.SKINS[id]
		var owned: bool = GameState.is_unlocked(id)
		var cur: bool = GameState.current_skin == id
		var b := _btn("", 15)
		b.custom_minimum_size = Vector2(120, 90)
		var nm := GameState.L("skin_" + id)
		if cur:
			b.text = "▶ " + nm
		elif owned:
			b.text = nm
		elif bool(s["rv"]):
			b.text = nm + "\n📺"
		else:
			b.text = "%s\n◈ %d" % [nm, int(s["cost"])]
		b.pressed.connect(func(): _on_skin(id))
		_skin_row.add_child(b)

func _on_skin(id: String) -> void:
	var s: Dictionary = GameState.SKINS[id]
	if GameState.is_unlocked(id):
		GameState.set_skin(id)
		refresh()
	elif bool(s["rv"]):
		Yandex.show_rewarded(func():
			GameState.unlock_skin(id); GameState.set_skin(id); refresh(),
		func(): _toast(GameState.L("rv_no_reward")))
	elif GameState.coins >= int(s["cost"]):
		GameState.coins -= int(s["cost"])
		GameState.unlock_skin(id)
		GameState.set_skin(id)
		AudioBus.buy()
		refresh()
	else:
		_toast(GameState.L("not_enough"))

func setup_noads_btn(b: Button) -> void:
	b.disabled = GameState.no_ads
	if not GameState.no_ads:
		b.pressed.connect(func():
			Yandex.purchase("no_ads", func():
				GameState.no_ads = true; GameState.save_data(); refresh(),
			func(): _toast(GameState.L("rv_no_reward"))))

func _post_open() -> void:
	# офлайн-заработок
	var earned := GameState.offline_earnings()
	if earned > 0:
		_show_offline(earned)
	# дейли
	if GameState.can_claim_daily():
		_show_daily()

func _show_offline(amount: int) -> void:
	_offline_panel.visible = true
	for c in _offline_panel.get_children(): c.queue_free()
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 8)
	_offline_panel.add_child(v)
	v.add_child(_lbl(GameState.L("offline_title"), 20, Color(1.0, 0.9, 0.5)))
	v.add_child(_lbl(GameState.L("offline_earned") % amount, 22, Color(1, 1, 1)))
	var row := HBoxContainer.new(); row.alignment = BoxContainer.ALIGNMENT_CENTER; row.add_theme_constant_override("separation", 10)
	v.add_child(row)
	var dbl := _btn(GameState.L("offline_double"), 16)
	dbl.pressed.connect(func():
		Yandex.show_rewarded(func():
			GameState.add_coins(amount * 2); _offline_panel.visible = false; refresh(),
		func():
			GameState.add_coins(amount); _offline_panel.visible = false; refresh()))
	row.add_child(dbl)
	var take := _btn(GameState.L("collect"), 18)
	take.pressed.connect(func():
		GameState.add_coins(amount); _offline_panel.visible = false; refresh())
	row.add_child(take)

func _show_daily() -> void:
	_daily_panel.visible = true
	for c in _daily_panel.get_children(): c.queue_free()
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 8)
	_daily_panel.add_child(v)
	v.add_child(_lbl(GameState.L("daily"), 22, Color(1.0, 0.9, 0.5)))
	var row := HBoxContainer.new(); row.alignment = BoxContainer.ALIGNMENT_CENTER; row.add_theme_constant_override("separation", 10)
	v.add_child(row)
	var take := _btn(GameState.L("collect"), 18)
	take.pressed.connect(func():
		var got := GameState.claim_daily()
		_daily_panel.visible = false
		# предложить удвоить
		Yandex.show_rewarded(func():
			GameState.add_coins(got); _toast(GameState.L("doubled")); refresh(),
		func(): refresh()))
	row.add_child(take)

func _fill_lb(r) -> void:
	var lbv: VBoxContainer = _lb_panel.find_child("LBV", true, false)
	if not lbv: return
	for c in lbv.get_children(): c.queue_free()
	if r == null:
		lbv.add_child(_lbl(GameState.L("lb_unavailable"), 16, Color(0.8, 0.8, 0.8)))
		return
	var n := 0
	if r.entries != null:
		for e in r.entries:
			if n >= 5: break
			var nm: String = str(e.player.publicName) if e.player != null else "?"
			lbv.add_child(_lbl("%d. %s — %d м" % [n + 1, nm, int(e.score)], 16, Color(0.95, 0.95, 0.95)))
			n += 1

func _main() -> Node:
	var p := get_parent()  # UI
	if p and p.get_parent() and p.get_parent().has_method("start_level"):
		return p.get_parent()
	return null

var _toast_ref: Label = null
func _toast(msg: String) -> void:
	if not _toast_ref:
		_toast_ref = _lbl("", 20, Color(1.0, 0.6, 0.5))
		_toast_ref.set_anchors_preset(Control.PRESET_CENTER)
		add_child(_toast_ref)
	_toast_ref.text = msg
	_toast_ref.visible = true
	await get_tree().create_timer(2.0).timeout
	if is_instance_valid(_toast_ref):
		_toast_ref.visible = false

func _lbl(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l

func _btn(text: String, size: int) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	b.custom_minimum_size = Vector2(0, 46)
	return b

func _mk_panel() -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.10, 0.16, 0.95)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(14)
	p.add_theme_stylebox_override("panel", sb)
	return p
