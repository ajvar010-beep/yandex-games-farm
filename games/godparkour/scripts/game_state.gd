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
var no_ads: bool = false         # IAP: отключить interstitial
var stars: Dictionary = {}       # level -> 1..3 (рейтинг скорости)
var lang := "ru"                 # ru | en (авто по SDK)

signal lang_changed              # SDK определил язык — меню/HUD перестраиваются

# ---------- i18n ----------
const TR := {
	"title_nub": {"ru": "НУБИК ПАРКУР", "en": "NOOBIK PARKOUR"},
	"title_pro": {"ru": "ПРО ПАРКУР", "en": "PRO PARKOUR"},
	"title_god": {"ru": "БОГ ПАРКУРА", "en": "PARKOUR GOD"},
	"sub_nub": {"ru": "Учись прыгать! Лёгкие уровни для новичков.", "en": "Learn to jump! Easy levels for beginners."},
	"sub_pro": {"ru": "Прыгай по блокам. Не упади в лаву. Дойди до финиша.", "en": "Jump across blocks. Don't fall in lava. Reach the finish."},
	"sub_god": {"ru": "Только для избранных. Узкие платформы, злые ловушки.", "en": "Only for the chosen. Narrow platforms, evil traps."},
	"level": {"ru": "Уровень %d", "en": "Level %d"},
	"tut0": {"ru": "Беги вперёд: WASD или свайп в левой части экрана", "en": "Run forward: WASD or swipe on the left half"},
	"tut1": {"ru": "Прыгай: Space или тап правой части", "en": "Jump: Space or tap on the right half"},
	"tut2": {"ru": "Двойной прыжок в воздухе! Дойди до кольца ⭕", "en": "Double jump in mid-air! Reach the ring ⭕"},
	"fail": {"ru": "Провал!", "en": "Failed!"},
	"lava": {"ru": "Упал в лаву...", "en": "Fell into lava..."},
	"lava_n": {"ru": "Упал в лаву... (%d/%d)", "en": "Fell into lava... (%d/%d)"},
	"revive": {"ru": "▶ Ожить (видео)", "en": "▶ Revive (video)"},
	"restart": {"ru": "Заново", "en": "Restart"},
	"menu": {"ru": "В меню", "en": "Menu"},
	"finish": {"ru": "Финиш! %s", "en": "Finish! %s"},
	"time_coins": {"ru": "Время: %s сек  •  ◈ %d", "en": "Time: %s s  •  ◈ %d"},
	"double": {"ru": "◈×2 (видео)", "en": "◈×2 (video)"},
	"next": {"ru": "Дальше ▶", "en": "Next ▶"},
	"doubled": {"ru": "◈ Удвоено!", "en": "◈ Doubled!"},
	"coins_n": {"ru": "Монет: %d", "en": "Coins: %d"},
	"pause": {"ru": "Пауза", "en": "Paused"},
	"continue": {"ru": "Продолжить", "en": "Continue"},
	"levels_hdr": {"ru": "— УРОВНИ —", "en": "— LEVELS —"},
	"skins_hdr": {"ru": "— СКИНЫ —", "en": "— SKINS —"},
	"shop_hdr": {"ru": "— МАГАЗИН —", "en": "— SHOP —"},
	"sound_on": {"ru": "Звук: ВКЛ", "en": "Sound: ON"},
	"sound_off": {"ru": "Звук: ВЫКЛ", "en": "Sound: OFF"},
	"daily": {"ru": "🎁 Награда дня!", "en": "🎁 Daily reward!"},
	"daily_next": {"ru": "🎁 завтра (×%d)", "en": "🎁 tomorrow (×%d)"},
	"hacker": {"ru": "ХАКЕР", "en": "HACKER"},
	"skin_nub": {"ru": "Нуб", "en": "Noob"},
	"skin_pro": {"ru": "Про", "en": "Pro"},
	"skin_samurai": {"ru": "Самурай", "en": "Samurai"},
	"skin_god": {"ru": "Бог", "en": "God"},
	"skin_neon": {"ru": "Неон", "en": "Neon"},
	"skin_hacker": {"ru": "Хакер", "en": "Hacker"},
	"shop_coins1": {"ru": "💰 500 ◈\n49 ₽", "en": "💰 500 ◈\n49 RUB"},
	"shop_coins2": {"ru": "💰 1500 ◈\n129 ₽", "en": "💰 1500 ◈\n129 RUB"},
	"shop_noads": {"ru": "🚫 Без рекламы\n199 ₽", "en": "🚫 No ads\n199 RUB"},
}

func L(key: String) -> String:
	var d: Dictionary = TR.get(key, {})
	return d.get(lang, key)

func set_lang(l: String) -> void:
	var nl := "en" if l.begins_with("en") else "ru"
	if nl != lang:
		lang = nl
		lang_changed.emit()

const SKINS := {
	"nub":  {"name": "Нуб",   "color": Color(0.35, 0.75, 0.35), "cost": 0,    "rv": false},
	"pro":  {"name": "Про",   "color": Color(0.25, 0.45, 0.95), "cost": 120,  "rv": false},
	"samurai": {"name": "Самурай", "color": Color(0.95, 0.35, 0.25), "cost": 250, "rv": false},
	"god":  {"name": "Бог",   "color": Color(1.0, 0.85, 0.20), "cost": 0,    "rv": true},
	"neon": {"name": "Неон",  "color": Color(0.9, 0.2, 0.9),   "cost": 400,  "rv": false},
	"hacker": {"name": "Хакер", "color": Color(0.05, 0.18, 0.08), "cost": 666, "rv": false},
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
		"no_ads": no_ads,
		"stars": stars,
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
	no_ads = bool(d.get("no_ads", false))
	stars = Dictionary(d.get("stars", {}))

func add_stars(level: int, n: int) -> void:
	var key := str(level)
	if not stars.has(key) or n > stars[key]:
		stars[key] = n
		save_data()

func total_stars() -> int:
	var s := 0
	for k in stars:
		s += int(stars[k])
	return s

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
