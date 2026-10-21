extends Control
## Menu — главное меню: сетка уровней, магазин скинов, настройки. Всё программно.

var _main: Node
var _scroll: ScrollContainer
var _grid: GridContainer
var _coins_label: Label
var _skin_grid: GridContainer
var _title: Label

const LEVELS_TOTAL := 21

func _ready() -> void:
	_main = get_tree().root.get_node_or_null("Main")
	if _main == null:
		_main = get_parent().get_parent().get_parent()  # fallback
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
	vb.offset_top = 16
	vb.offset_bottom = -16
	vb.add_theme_constant_override("separation", 14)
	add_child(vb)

	# шапка: название + монеты
	var head := HBoxContainer.new()
	vb.add_child(head)
	_title = Label.new()
	_title.text = Variant.title
	_title.add_theme_font_size_override("font_size", 44)
	_title.add_theme_color_override("font_color", Variant.skin_color.lightened(0.5))
	head.add_child(_title)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)
	_coins_label = Label.new()
	_coins_label.add_theme_font_size_override("font_size", 30)
	_coins_label.add_theme_color_override("font_color", Color(0.4, 1, 0.7))
	head.add_child(_coins_label)

	# подзаголовок
	var sub := Label.new()
	sub.text = Variant.subtitle
	sub.add_theme_font_size_override("font_size", 18)
	sub.add_theme_color_override("font_color", Color(0.8, 0.85, 0.95))
	vb.add_child(sub)

	# скролл с уровнями
	var lv_title := Label.new()
	lv_title.text = "— УРОВНИ —"
	lv_title.add_theme_font_size_override("font_size", 22)
	lv_title.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	vb.add_child(lv_title)

	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vb.add_child(_scroll)

	_grid = GridContainer.new()
	_grid.columns = 5
	_grid.add_theme_constant_override("h_separation", 12)
	_grid.add_theme_constant_override("v_separation", 12)
	_scroll.add_child(_grid)

	for i in range(1, LEVELS_TOTAL + 1):
		var b := Button.new()
		b.custom_minimum_size = Vector2(180, 110)
		var unlocked := i <= GameState.max_level
		if i == 21:
			# ХАКЕР — неоновая кнопка
			b.text = "ХАКЕР" if unlocked else "🔒"
			b.modulate = Color(0.1, 1.0, 0.3) if unlocked else Color(0.45, 0.45, 0.5)
			b.add_theme_font_size_override("font_size", 26)
		else:
			b.text = "%d" % i
			b.add_theme_font_size_override("font_size", 40)
			if unlocked:
				b.modulate = Color(0.5, 0.95, 0.6)
			else:
				b.modulate = Color(0.45, 0.45, 0.5)
				b.text = "🔒"
				b.add_theme_font_size_override("font_size", 34)
		b.disabled = not unlocked
		var lv := i
		b.pressed.connect(func():
			AudioBus.click()
			_main.start_level(lv))
		_grid.add_child(b)

	# магазин скинов
	var sh_title := Label.new()
	sh_title.text = "— СКИНЫ —"
	sh_title.add_theme_font_size_override("font_size", 22)
	sh_title.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	vb.add_child(sh_title)

	_skin_grid = GridContainer.new()
	_skin_grid.columns = 5
	_skin_grid.add_theme_constant_override("h_separation", 10)
	_skin_grid.add_theme_constant_override("v_separation", 10)
	vb.add_child(_skin_grid)

	for id in GameState.SKINS:
		var s: Dictionary = GameState.SKINS[id]
		var b := Button.new()
		b.custom_minimum_size = Vector2(150, 130)
		var unlocked := GameState.is_unlocked(id)
		var txt: String = s["name"]
		if not unlocked:
			if s.get("rv", false):
				txt += "\n📺"
			else:
				txt += "\n◈%d" % s["cost"]
		else:
			txt += "\n✓"
		b.text = txt
		b.add_theme_font_size_override("font_size", 18)
		b.self_modulate = s["color"]
		var sid: String = id
		b.pressed.connect(func(): _on_skin(sid))
		_skin_grid.add_child(b)

	# Магазин монет (IAP)
	var shop_title := Label.new()
	shop_title.text = "— МАГАЗИН —"
	shop_title.add_theme_font_size_override("font_size", 22)
	shop_title.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	vb.add_child(shop_title)

	var shop := HBoxContainer.new()
	shop.add_theme_constant_override("separation", 10)
	vb.add_child(shop)
	_add_iap_btn(shop, "💰 500 ◈\n49 ₽", "coins_500", 500)
	_add_iap_btn(shop, "💰 1500 ◈\n129 ₽", "coins_1500", 1500)
	_add_iap_btn(shop, "🚫 Без рекламы\n199 ₽", "no_ads", 0)

	# низ: звук + ежедневка
	var foot := HBoxContainer.new()
	vb.add_child(foot)
	var snd := Button.new()
	snd.text = "Звук: ВКЛ" if GameState.sound_on else "Звук: ВЫКЛ"
	snd.pressed.connect(func():
		GameState.sound_on = not GameState.sound_on
		GameState.save_data()
		refresh())
	foot.add_child(snd)

	var fsp := Control.new()
	fsp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	foot.add_child(fsp)

	var daily := Button.new()
	if GameState.can_claim_daily():
		daily.text = "🎁 Награда дня!"
		daily.modulate = Color(1, 0.9, 0.3)
	else:
		daily.text = "🎁 завтра (×%d)" % GameState.daily_streak
		daily.modulate = Color(0.7, 0.7, 0.75)
	daily.add_theme_font_size_override("font_size", 20)
	daily.pressed.connect(_on_daily)
	foot.add_child(daily)

	_update_coins()

func _on_daily() -> void:
	if GameState.can_claim_daily():
		var got := GameState.claim_daily()
		AudioBus.buy()
		_coins_label.text = "◈ %d (+%d)" % [GameState.coins, got]
		refresh()

func _add_iap_btn(parent: Control, label: String, product_id: String, coins: int) -> void:
	var b := Button.new()
	b.text = label
	b.custom_minimum_size = Vector2(200, 110)
	b.add_theme_font_size_override("font_size", 20)
	b.pressed.connect(func():
		AudioBus.click()
		Yandex.purchase(product_id, func():
			if coins > 0:
				GameState.add_coins(coins)
			else:
				GameState.no_ads = true
			GameState.save_data()
			AudioBus.buy()
			refresh()))
	parent.add_child(b)

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
			_coins_label.add_theme_color_override("font_color", Color(0.4, 1, 0.7))
