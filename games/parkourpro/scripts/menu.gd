extends Control
## Menu — главное меню: сетка уровней со звёздами, скины, магазин, лидерборд.
## Шапка и футер закреплены, середина — один общий скролл (не уезжает за экран).

var _main: Node
var _coins_label: Label
var _stars_label: Label
var _title: Label

const LEVELS_TOTAL := 21
const RV_COINS := 30          # «📺 +30 ◈» — повторяемый RV-триггер
const RV_COINS_COOLDOWN_MS := 180_000  # 3 минуты

var _last_rv_coins_ms := 0

func _ready() -> void:
	_main = get_tree().root.get_node_or_null("Main")
	if _main == null:
		_main = get_parent().get_parent().get_parent()  # fallback
	if not GameState.lang_changed.is_connected(_on_lang_changed):
		GameState.lang_changed.connect(_on_lang_changed)
	_build()

func _on_lang_changed() -> void:
	_build()

func refresh() -> void:
	_build()

func _clear() -> void:
	for c in get_children():
		c.queue_free()

func _build() -> void:
	_clear()
	var bg := ColorRect.new()
	bg.color = Color(0.08, 0.10, 0.16)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var vb := VBoxContainer.new()
	vb.set_anchors_preset(Control.PRESET_FULL_RECT)
	vb.offset_left = 24
	vb.offset_right = -24
	vb.offset_top = 10
	vb.offset_bottom = -10
	vb.add_theme_constant_override("separation", 8)
	add_child(vb)

	# ---------- шапка (закреплена) ----------
	var head := HBoxContainer.new()
	vb.add_child(head)
	_title = Label.new()
	_title.text = Variant.title
	_title.add_theme_font_size_override("font_size", 38)
	_title.add_theme_color_override("font_color", Variant.skin_color.lightened(0.5))
	head.add_child(_title)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)
	_stars_label = Label.new()
	_stars_label.text = GameState.L("stars_total") % [GameState.total_stars(), LEVELS_TOTAL * 3]
	_stars_label.add_theme_font_size_override("font_size", 26)
	_stars_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.3))
	head.add_child(_stars_label)
	var sp2 := Control.new()
	sp2.custom_minimum_size = Vector2(20, 0)
	head.add_child(sp2)
	_coins_label = Label.new()
	_coins_label.add_theme_font_size_override("font_size", 28)
	_coins_label.add_theme_color_override("font_color", Color(0.4, 1, 0.7))
	head.add_child(_coins_label)

	var sub := Label.new()
	sub.text = Variant.subtitle
	sub.add_theme_font_size_override("font_size", 15)
	sub.add_theme_color_override("font_color", Color(0.8, 0.85, 0.95))
	vb.add_child(sub)

	# ---------- середина: один общий скролл ----------
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vb.add_child(scroll)

	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 8)
	scroll.add_child(content)

	_build_levels(content)
	_build_skins(content)
	_build_shop(content)
	_build_leaderboard(content)
	_build_series_promo(content)

	# ---------- футер (закреплён, всегда виден) ----------
	var foot := HBoxContainer.new()
	foot.add_theme_constant_override("separation", 10)
	vb.add_child(foot)

	var snd := Button.new()
	snd.text = GameState.L("sound_on") if GameState.sound_on else GameState.L("sound_off")
	snd.add_theme_font_size_override("font_size", 18)
	snd.pressed.connect(func():
		GameState.sound_on = not GameState.sound_on
		GameState.save_data()
		refresh())
	foot.add_child(snd)

	# RV-монеты (повторяемый триггер, кулдаун 3 мин)
	var rvb := Button.new()
	rvb.text = GameState.L("rv_coins") % RV_COINS
	rvb.add_theme_font_size_override("font_size", 18)
	rvb.modulate = Color(0.5, 0.9, 1.0)
	rvb.pressed.connect(_on_rv_coins)
	foot.add_child(rvb)

	var fsp := Control.new()
	fsp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	foot.add_child(fsp)

	var daily := Button.new()
	if GameState.can_claim_daily():
		daily.text = GameState.L("daily")
		daily.modulate = Color(1, 0.9, 0.3)
	else:
		daily.text = GameState.L("daily_next") % GameState.daily_streak
		daily.modulate = Color(0.7, 0.7, 0.75)
	daily.add_theme_font_size_override("font_size", 18)
	daily.pressed.connect(_on_daily)
	foot.add_child(daily)

	_update_coins()

# ---------- уровни со звёздами и рекордами ----------
func _build_levels(parent: Control) -> void:
	var lv_title := Label.new()
	lv_title.text = GameState.L("levels_hdr")
	lv_title.add_theme_font_size_override("font_size", 20)
	lv_title.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	parent.add_child(lv_title)

	var grid := GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	parent.add_child(grid)

	for i in range(1, LEVELS_TOTAL + 1):
		var b := Button.new()
		b.custom_minimum_size = Vector2(170, 92)
		var unlocked := i <= GameState.max_level
		var st := GameState.stars_of(i)
		var best := GameState.best_time(i)
		if i == 21:
			# ХАКЕР — неоновая кнопка
			b.text = GameState.L("hacker") if unlocked else "🔒"
			b.modulate = Color(0.1, 1.0, 0.3) if unlocked else Color(0.45, 0.45, 0.5)
			b.add_theme_font_size_override("font_size", 24)
		else:
			b.text = "%d" % i
			b.add_theme_font_size_override("font_size", 32)
			if unlocked:
				b.modulate = Color(0.5, 0.95, 0.6)
				# мета: звёзды + рекорд (данные уже хранились, но не показывались)
				var info := "\n" + _mini_stars(st)
				if best > 0:
					info += "  %.1f" % (best / 1000.0)
				var info_lbl := Label.new()
				info_lbl.text = info
				info_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				info_lbl.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
				info_lbl.offset_top = -30
				info_lbl.add_theme_font_size_override("font_size", 14)
				info_lbl.add_theme_color_override("font_color", Color(1, 0.9, 0.3))
				info_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
				b.add_child(info_lbl)
			else:
				b.modulate = Color(0.45, 0.45, 0.5)
				b.text = "🔒"
				b.add_theme_font_size_override("font_size", 30)
		b.disabled = not unlocked
		var lv := i
		b.pressed.connect(func():
			AudioBus.click()
			_main.start_level(lv))
		grid.add_child(b)

func _mini_stars(n: int) -> String:
	match n:
		3: return "★★★"
		2: return "★★☆"
		1: return "★☆☆"
	return "☆☆☆"

# ---------- скины ----------
func _build_skins(parent: Control) -> void:
	var sh_title := Label.new()
	sh_title.text = GameState.L("skins_hdr")
	sh_title.add_theme_font_size_override("font_size", 20)
	sh_title.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	parent.add_child(sh_title)

	var skin_grid := GridContainer.new()
	skin_grid.columns = 6
	skin_grid.add_theme_constant_override("h_separation", 10)
	skin_grid.add_theme_constant_override("v_separation", 10)
	parent.add_child(skin_grid)

	for id in GameState.SKINS:
		var s: Dictionary = GameState.SKINS[id]
		var b := Button.new()
		b.custom_minimum_size = Vector2(140, 100)
		var unlocked := GameState.is_unlocked(id)
		var txt: String = GameState.L("skin_" + id)
		if not unlocked:
			if s.get("rv", false):
				txt += "\n📺"
			else:
				txt += "\n◈%d" % s["cost"]
		elif GameState.current_skin == id:
			txt += "\n✓"
		b.text = txt
		b.add_theme_font_size_override("font_size", 16)
		b.self_modulate = s["color"]
		if not unlocked:
			b.modulate = Color(0.75, 0.75, 0.8)
		var sid: String = id
		b.pressed.connect(func(): _on_skin(sid))
		skin_grid.add_child(b)

	# прогресс до следующего скина (видимая цель)
	var next := _next_skin_goal()
	if not next.is_empty():
		var prog := Label.new()
		prog.text = GameState.L("skin_progress") % [GameState.coins, int(next["cost"]), GameState.L("skin_" + str(next["id"]))]
		prog.add_theme_font_size_override("font_size", 15)
		prog.add_theme_color_override("font_color", Color(0.7, 0.8, 0.9))
		parent.add_child(prog)

func _next_skin_goal() -> Dictionary:
	# ближайшая ДОСТИЖИМАЯ цель: самый дешёвый скин дороже текущих монет
	var best: Dictionary = {}
	for id in GameState.SKINS:
		if GameState.is_unlocked(id): continue
		var s: Dictionary = GameState.SKINS[id]
		if s.get("rv", false): continue
		var cost := int(s["cost"])
		if cost <= GameState.coins: continue  # уже по карману — не цель
		if best.is_empty() or cost < int(best["cost"]):
			best = {"id": id, "cost": cost}
	return best

# ---------- магазин IAP ----------
func _build_shop(parent: Control) -> void:
	var shop_title := Label.new()
	shop_title.text = GameState.L("shop_hdr")
	shop_title.add_theme_font_size_override("font_size", 20)
	shop_title.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	parent.add_child(shop_title)

	var shop := HBoxContainer.new()
	shop.add_theme_constant_override("separation", 10)
	parent.add_child(shop)
	_add_iap_btn(shop, GameState.L("shop_coins1"), "coins_500", 500)
	_add_iap_btn(shop, GameState.L("shop_coins2"), "coins_1500", 1500)
	if not GameState.no_ads:
		_add_iap_btn(shop, GameState.L("shop_noads"), "no_ads", 0)
	else:
		var owned := Label.new()
		owned.text = GameState.L("noads_owned")
		owned.add_theme_font_size_override("font_size", 18)
		owned.add_theme_color_override("font_color", Color(0.5, 1.0, 0.6))
		shop.add_child(owned)

# ---------- лидерборд (был write-only) ----------
func _build_leaderboard(parent: Control) -> void:
	var lb_title := Label.new()
	lb_title.text = GameState.L("lb_hdr")
	lb_title.add_theme_font_size_override("font_size", 20)
	lb_title.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	parent.add_child(lb_title)

	var lb_label := Label.new()
	lb_label.text = GameState.L("lb_loading")
	lb_label.add_theme_font_size_override("font_size", 15)
	lb_label.add_theme_color_override("font_color", Color(0.75, 0.8, 0.9))
	parent.add_child(lb_label)

	Yandex.get_leaderboard("parkour_time", func(res):
		if not is_instance_valid(lb_label): return
		if res == null:
			lb_label.text = GameState.L("lb_unavailable")
			return
		var lines: PackedStringArray = []
		var entries = res.entries
		var n: int = min(int(res.quantity), 8)
		for i in range(n):
			var e = entries[i]
			var pname := "?"
			if e.player != null:
				pname = str(e.player.publicName)
			lines.append("%d. %s — %s" % [i + 1, pname, _fmt_score(int(e.score))])
		if int(res.userRank) > 0:
			var uname := "?"
			if res.userEntry != null and res.userEntry.player != null:
				uname = str(res.userEntry.player.publicName)
			lines.append(GameState.L("lb_you") % [int(res.userRank), uname, _fmt_score(int(res.userEntry.score))])
		lb_label.text = "\n".join(lines))

func _fmt_score(v: int) -> String:
	# очки = 1_000_000 - время_мс → обратно в секунды
	var ms := 1_000_000 - v
	return "%.1f%s" % [ms / 1000.0, GameState.L("sec")]

# ---------- кросс-промо серии ----------
func _build_series_promo(parent: Control) -> void:
	var t := Label.new()
	t.text = GameState.L("series_hdr")
	t.add_theme_font_size_override("font_size", 20)
	t.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	parent.add_child(t)
	var hint := Label.new()
	match Variant.id:
		"nub": hint.text = GameState.L("series_nub")
		"pro": hint.text = GameState.L("series_pro")
		"god": hint.text = GameState.L("series_god")
	hint.add_theme_font_size_override("font_size", 15)
	hint.add_theme_color_override("font_color", Color(0.7, 0.75, 0.85))
	parent.add_child(hint)

# ---------- обработчики ----------
func _on_rv_coins() -> void:
	var now := Time.get_ticks_msec()
	if now - _last_rv_coins_ms < RV_COINS_COOLDOWN_MS and _last_rv_coins_ms != 0:
		AudioBus.click()
		return
	AudioBus.click()
	Yandex.show_rewarded(func():
		_last_rv_coins_ms = Time.get_ticks_msec()
		GameState.add_coins(RV_COINS)
		AudioBus.buy()
		refresh())

func _on_daily() -> void:
	if GameState.can_claim_daily():
		var got := GameState.claim_daily()
		AudioBus.buy()
		_coins_label.text = "◈ %d (+%d)" % [GameState.coins, got]
		# удвоение ежедневки за RV — ещё один денежный триггер
		_offer_daily_double(got)

func _offer_daily_double(got: int) -> void:
	var box := PanelContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(420, 200)
	add_child(box)
	var vb := VBoxContainer.new()
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_theme_constant_override("separation", 12)
	box.add_child(vb)
	var lbl := Label.new()
	lbl.text = GameState.L("daily_double_q") % got
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.add_theme_font_size_override("font_size", 22)
	vb.add_child(lbl)
	var yes := Button.new()
	yes.text = GameState.L("double")
	yes.add_theme_font_size_override("font_size", 20)
	vb.add_child(yes)
	var no := Button.new()
	no.text = GameState.L("no_thanks")
	no.add_theme_font_size_override("font_size", 18)
	vb.add_child(no)
	yes.pressed.connect(func():
		AudioBus.click()
		box.queue_free()
		Yandex.show_rewarded(func():
			GameState.add_coins(got)
			AudioBus.buy()
			refresh()))
	no.pressed.connect(func():
		AudioBus.click()
		box.queue_free()
		refresh())

func _add_iap_btn(parent: Control, label: String, product_id: String, coins: int) -> void:
	var b := Button.new()
	b.text = label
	b.custom_minimum_size = Vector2(190, 90)
	b.add_theme_font_size_override("font_size", 18)
	b.pressed.connect(_make_iap_handler(product_id, coins))
	parent.add_child(b)

func _make_iap_handler(product_id: String, coins: int) -> Callable:
	return func():
		AudioBus.click()
		Yandex.purchase(product_id, _iap_ok.bind(coins), _iap_fail)

func _iap_ok(coins: int) -> void:
	if coins > 0:
		GameState.add_coins(coins)
	else:
		GameState.no_ads = true
	GameState.save_data()
	AudioBus.buy()
	refresh()

func _iap_fail() -> void:
	AudioBus.click()

func _update_coins() -> void:
	_coins_label.text = "◈ %d" % GameState.coins

func _on_skin(id: String) -> void:
	AudioBus.click()
	if GameState.is_unlocked(id):
		GameState.set_skin(id)
		refresh()
		return
	var s: Dictionary = GameState.SKINS[id]
	if s.get("rv", false):
		# RV-разблок
		Yandex.show_rewarded(func():
			GameState.unlock_skin(id)
			GameState.set_skin(id)
			AudioBus.buy()
			refresh())
	else:
		if GameState.coins >= s["cost"]:
			GameState.add_coins(-s["cost"])
			GameState.unlock_skin(id)
			GameState.set_skin(id)
			AudioBus.buy()
			refresh()
		else:
			# не хватает монет — подсветить
			_coins_label.add_theme_color_override("font_color", Color(1, 0.4, 0.4))
			await get_tree().create_timer(0.4).timeout
			if is_instance_valid(_coins_label):
				_coins_label.add_theme_color_override("font_color", Color(0.4, 1, 0.7))
