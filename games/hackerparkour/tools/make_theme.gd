extends SceneTree
## Генератор темы UI: res://assets/default.theme (подключается через gui/theme/custom).
## Запуск: Godot --headless --path . --script tools/make_theme.gd

func _init() -> void:
	var theme := Theme.new()

	# шрифт темы: Noto Sans + symbols fallback
	var font: FontFile = load("res://assets/fonts/NotoSans-Regular.ttf")
	var symbols: FontFile = load("res://assets/fonts/NotoSansSymbols2-Regular.ttf")
	font.fallbacks = [symbols]
	theme.default_font = font
	theme.default_font_size = 18

	var base_color := Color(0.18, 0.32, 0.62)
	# ---------- Button ----------
	var n := StyleBoxFlat.new()
	n.bg_color = base_color
	n.set_corner_radius_all(12)
	n.content_margin_left = 14
	n.content_margin_right = 14
	n.content_margin_top = 10
	n.content_margin_bottom = 10
	n.border_width_bottom = 4
	n.border_color = base_color.darkened(0.45)
	theme.set_stylebox("normal", "Button", n)
	var h := n.duplicate() as StyleBoxFlat
	h.bg_color = base_color.lightened(0.12)
	theme.set_stylebox("hover", "Button", h)
	var p := n.duplicate() as StyleBoxFlat
	p.bg_color = base_color.darkened(0.18)
	p.border_width_bottom = 1
	theme.set_stylebox("pressed", "Button", p)
	var d := n.duplicate() as StyleBoxFlat
	d.bg_color = Color(0.3, 0.32, 0.38)
	d.border_color = Color(0.2, 0.21, 0.25)
	theme.set_stylebox("disabled", "Button", d)
	theme.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	theme.set_color("font_color", "Button", Color(0.95, 0.97, 1.0))
	theme.set_color("font_hover_color", "Button", Color.WHITE)
	theme.set_color("font_pressed_color", "Button", Color(0.85, 0.9, 1.0))
	theme.set_color("font_disabled_color", "Button", Color(0.55, 0.57, 0.62))
	theme.set_color("font_focus_color", "Button", Color.WHITE)

	# ---------- PanelContainer ----------
	var pn := StyleBoxFlat.new()
	pn.bg_color = Color(0.09, 0.11, 0.17, 0.94)
	pn.set_corner_radius_all(16)
	pn.set_border_width_all(2)
	pn.border_color = Color(0.35, 0.55, 0.95, 0.8)
	pn.content_margin_left = 24
	pn.content_margin_right = 24
	pn.content_margin_top = 20
	pn.content_margin_bottom = 20
	pn.shadow_color = Color(0, 0, 0, 0.4)
	pn.shadow_size = 12
	theme.set_stylebox("panel", "PanelContainer", pn)

	# ---------- Label: лёгкая тень для читаемости на 3D ----------
	theme.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.55))
	theme.set_constant("shadow_offset_x", "Label", 2)
	theme.set_constant("shadow_offset_y", "Label", 2)

	var dir := DirAccess.open("res://")
	if dir and not dir.dir_exists("assets"):
		dir.make_dir("assets")
	var err := ResourceSaver.save(theme, "res://assets/default.theme")
	print("saved default.theme, err=", err)
	quit(0)
