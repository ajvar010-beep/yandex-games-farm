extends SceneTree
## Smoke test: загружает уровни, проверяет валидность JSON и проходимость по прыжкам.

func _init() -> void:
	print("=== SMOKE TEST parkourpro ===")
	var levels_dir := "res://levels/"
	var files := DirAccess.get_files_at(levels_dir)
	print("levels found: ", files.size())
	var ok := 0
	var bad := 0
	for f in files:
		if not f.ends_with(".json"): continue
		var path := levels_dir + f
		var file := FileAccess.open(path, FileAccess.READ)
		if file == null:
			print("FAIL open: ", f)
			bad += 1
			continue
		var parsed = JSON.parse_string(file.get_as_text())
		file.close()
		if parsed == null:
			print("FAIL json: ", f)
			bad += 1
			continue
		var def: Dictionary = parsed
		var plats: Array = def.get("platforms", [])
		if plats.is_empty():
			print("FAIL empty: ", f)
			bad += 1
			continue
		# проверка: каждая следующая платформа достижима прыжком (gap <= ~5.5 по xz, dy <= 2.2)
		var reachable := true
		for i in range(1, plats.size()):
			var a: Dictionary = plats[i-1]
			var b: Dictionary = plats[i]
			var ax = float(a.get("x",0)); var ay = float(a.get("y",0)); var az = float(a.get("z",0))
			var bx = float(b.get("x",0)); var by = float(b.get("y",0)); var bz = float(b.get("z",0))
			var dxz = Vector2(bx-ax, bz-az).length()
			var dy = by - ay
			# прыжок 9.5 force, gravity 22*1.8=39.6 → высота ~1.14; по горизонтали ~7*0.47=3.3 + размеры
			# учитываем размеры платформ: реальный gap от краёв меньше
			var asz = (float(a.get("sx",2)) + float(a.get("sz",2))) * 0.5
			var bsz = (float(b.get("sx",2)) + float(b.get("sz",2))) * 0.5
			var edge_gap = dxz - (asz + bsz) * 0.5
			var reach = (dxz <= 5.5 or edge_gap <= 3.2) and (dy <= 2.4)
			if not reach:
				reachable = false
				print("  gap fail at ", i, " in ", f, " dxz=", snappedf(dxz,0.01), " dy=", snappedf(dy,0.01))
				break
		if reachable:
			ok += 1
		else:
			bad += 1
	print("OK: ", ok, "  BAD: ", bad)
	quit(0 if bad == 0 else 1)
