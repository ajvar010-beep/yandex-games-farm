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
			# Прыжок: force 9.5, gravity 22*1.8*difficulty. Reach ∝ v²/g:
			#   nub(0.85) single ~3.95м, pro(1.0) ~3.36, god(1.3) ~2.58 (двойной ~4.4).
			# Проверяем ХУДШИЙ вариант (god) с учётом двойного прыжка: edge_gap ≤ 4.4,
			# dy ≤ 1.75 (god apex×2). Уровни рассчитаны на двойной прыжок на широких разрывах.
			var asz = (float(a.get("sx",2)) + float(a.get("sz",2))) * 0.5
			var bsz = (float(b.get("sx",2)) + float(b.get("sz",2))) * 0.5
			var edge_gap = dxz - (asz + bsz) * 0.5
			var reach = (dxz <= 5.5 or edge_gap <= 4.4) and (dy <= 1.75)
			if not reach:
				reachable = false
				print("  gap fail at ", i, " in ", f, " dxz=", snappedf(dxz,0.01), " dy=", snappedf(dy,0.01))
				break
		# v8.2 (крит): СОФТЛОК НАВИСАНИЯ. Любая пара НЕсоседних платформ (|i-j|≥2)
		# с XZ-перекрытием >0.3м должна иметь вертикальный просвет ≥1.4м (высота
		# капсулы игрока) — иначе нижнее колено серпантина упирается в верхнее и
		# маршрут непроходим. Это и был софтлок lvl 5/9/16/19/20/21 (v8), который
		# проверка gap/dy СОСЕДЕЙ пропускала.
		if reachable:
			for i in range(plats.size()):
				for j in range(i + 2, plats.size()):
					var a2: Dictionary = plats[i]
					var b2: Dictionary = plats[j]
					var ox = (float(a2.get("sx",2)) + float(b2.get("sx",2))) * 0.5 - absf(float(a2.get("x",0)) - float(b2.get("x",0)))
					var oz = (float(a2.get("sz",2)) + float(b2.get("sz",2))) * 0.5 - absf(float(a2.get("z",0)) - float(b2.get("z",0)))
					if ox <= 0.3 or oz <= 0.3: continue
					var loy = float(a2.get("y",0)); var hiy = float(b2.get("y",0))
					var losy = float(a2.get("sy",1)); var hisy = float(b2.get("sy",1))
					if loy > hiy:
						var tmpy: float = loy; loy = hiy; hiy = tmpy
						var tmpsy: float = losy; losy = hisy; hisy = tmpsy
					var clearance = (hiy - hisy * 0.5) - (loy + losy * 0.5)
					if clearance < 1.4:
						reachable = false
						print("  overhang fail ", i, "-", j, " in ", f, " clr=", snappedf(clearance,0.01))
						break
				if not reachable: break
		if reachable:
			ok += 1
		else:
			bad += 1
	print("OK: ", ok, "  BAD: ", bad)
	quit(0 if bad == 0 else 1)
