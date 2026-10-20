extends SceneTree
## Генерирует иконку 512×512 процедурно (без внешних ассетов).

func _init() -> void:
	var img := Image.create(512, 512, false, Image.FORMAT_RGBA8)
	# небо
	var sky := Color(0.53, 0.75, 0.92)
	for y in 380:
		for x in 512:
			img.set_pixel(x, y, sky)
	# лава
	var lava := Color(1.0, 0.35, 0.05)
	for y in range(380, 512):
		for x in 512:
			img.set_pixel(x, y, lava)
	# платформы
	_rect(img, 60, 280, 120, 120, Color(0.35, 0.72, 0.35))   # grass
	_rect(img, 200, 240, 100, 100, Color(0.55, 0.4, 0.25))    # dirt
	_rect(img, 320, 200, 90, 90, Color(0.5, 0.5, 0.55))       # stone
	_rect(img, 60, 400, 120, 20, Color(0.35, 0.72, 0.35))
	# игрок
	_rect(img, 180, 60, 60, 70, Color(0.25, 0.45, 0.95))      # body
	_rect(img, 190, 30, 44, 40, Color(0.45, 0.62, 0.95))      # head
	_rect(img, 196, 42, 8, 8, Color(0.1, 0.1, 0.15))          # eye L
	_rect(img, 212, 42, 8, 8, Color(0.1, 0.1, 0.15))          # eye R
	# монета
	_circle(img, 420, 120, 40, Color(0.2, 0.95, 0.6))
	img.save_png("res://export/icon_512.png")
	print("icon saved")
	quit()

func _rect(img: Image, x0: int, y0: int, w: int, h: int, c: Color) -> void:
	for y in range(y0, y0 + h):
		for x in range(x0, x0 + w):
			if x >= 0 and x < 512 and y >= 0 and y < 512:
				img.set_pixel(x, y, c)

func _circle(img: Image, cx: int, cy: int, r: int, c: Color) -> void:
	for y in range(cy - r, cy + r):
		for x in range(cx - r, cx + r):
			var d := Vector2(x - cx, y - cy).length()
			if d <= r:
				img.set_pixel(x, y, c)
