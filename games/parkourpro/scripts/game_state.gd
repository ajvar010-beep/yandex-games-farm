extends Node
## GameState — глобальное состояние, сейвы, прогресс.

var coins: int = 0
var unlocked_skins: Array = ["nub"]
var current_skin: String = "nub"
var max_level: int = 1
var sound_on: bool = true
var best_times: Dictionary = {}  # level -> ms
var last_daily: String = ""      # YYYY-MM-DD
var daily_streak: int = 0

const SKINS := {
	"nub":  {"name": "Нуб",   "color": Color(0.35, 0.75, 0.35), "cost": 0,    "rv": false},
	"pro":  {"name": "Про",   "color": Color(0.25, 0.45, 0.95), "cost": 120,  "rv": false},
	"samurai": {"name": "Самурай", "color": Color(0.95, 0.35, 0.25), "cost": 250, "rv": false},
	"god":  {"name": "Бог",   "color": Color(1.0, 0.85, 0.20), "cost": 0,    "rv": true},
	"neon": {"name": "Неон",  "color": Color(0.9, 0.2, 0.9),   "cost": 400,  "rv": false},
}

func _ready() -> void:
	load_data()

func add_coins(n: int) -> void:
	coins += n
	save_data()

func unlock_skin(id: String) -> void:
	if id not in unlocked_skins:
		unlocked_skins.append(id)
		save_data()

func is_unlocked(id: String) -> bool:
	return id in unlocked_skins

func set_skin(id: String) -> void:
	if is_unlocked(id):
		current_skin = id
		save_data()

func complete_level(level: int, time_ms: int) -> void:
	if level >= max_level:
		max_level = level + 1
	var key := str(level)
	if not best_times.has(key) or time_ms < best_times[key]:
		best_times[key] = time_ms
	save_data()

# ---------- persistence (Yandex cloud или localStorage fallback) ----------

func save_data() -> void:
	var data := {
		"coins": coins,
		"unlocked": unlocked_skins,
		"skin": current_skin,
		"max_level": max_level,
		"sound": sound_on,
		"best": best_times,
		"last_daily": last_daily,
		"daily_streak": daily_streak,
	}
	if Yandex.is_ready():
		Yandex.save(data)
	else:
		var f := FileAccess.open("user://save.json", FileAccess.WRITE)
		if f:
			f.store_string(JSON.stringify(data))
			f.close()

func load_data() -> void:
	# облако грузит Yandex позже; тут локальный fallback
	var f := FileAccess.open("user://save.json", FileAccess.READ)
	if f:
		var parsed = JSON.parse_string(f.get_as_text())
		f.close()
		if parsed is Dictionary:
			_apply(parsed)

func _apply(d: Dictionary) -> void:
	coins = int(d.get("coins", 0))
	unlocked_skins = Array(d.get("unlocked", ["nub"]))
	current_skin = str(d.get("skin", "nub"))
	max_level = int(d.get("max_level", 1))
	sound_on = bool(d.get("sound", true))
	best_times = Dictionary(d.get("best", {}))
	last_daily = str(d.get("last_daily", ""))
	daily_streak = int(d.get("daily_streak", 0))

# Ежедневная награда (retention)
func can_claim_daily() -> bool:
	var today := _today()
	return last_daily != today

func claim_daily() -> int:
	if not can_claim_daily():
		return 0
	var today := _today()
	var yesterday := _yesterday()
	if last_daily == yesterday:
		daily_streak += 1
	else:
		daily_streak = 1
	last_daily = today
	var reward := 50 + (daily_streak - 1) * 25  # 50, 75, 100, ...
	add_coins(reward)
	save_data()
	return reward

func _today() -> String:
	var d := Time.get_datetime_dict_from_system()
	return "%04d-%02d-%02d" % [d.year, d.month, d.day]

func _yesterday() -> String:
	var t := Time.get_unix_time_from_system() - 86400
	var d := Time.get_datetime_dict_from_unix_time(t)
	return "%04d-%02d-%02d" % [d.year, d.month, d.day]
