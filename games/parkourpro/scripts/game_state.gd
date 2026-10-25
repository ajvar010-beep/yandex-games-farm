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
# v8.1 (консилиум v8 minor): кулдаун интерстишла ЖИВЁТ ЗДЕСЬ, а не на инстансе Game —
# тот пересоздаётся на каждый вход из меню и кулдаун обнулялся (реклама чаще 130с).
var last_interstitial_ms: int = 0
# то же для RV-монет меню (Menu-инстанс пересоздаётся на каждый вход в меню)
var last_rv_coins_ms: int = 0
var stars: Dictionary = {}       # level -> 1..3 (рейтинг скорости)
var upgrades: Dictionary = {}    # v9: id -> уровень апгрейда (прокачка характеристик)
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
	"tut2": {"ru": "Высокую стену одиночным не взять — прыгни ВТОРОЙ раз в воздухе! Дойди до кольца ⭕", "en": "The tall wall needs a DOUBLE jump — tap jump again mid-air! Reach the ring ⭕"},
	"fail": {"ru": "Провал!", "en": "Failed!"},
	"lava": {"ru": "Упал в лаву...", "en": "Fell into lava..."},
	"lava_n": {"ru": "Упал в лаву... (%d/%d)", "en": "Fell into lava... (%d/%d)"},
	"revive": {"ru": "▶ Ожить (видео)", "en": "▶ Revive (video)"},
	"restart": {"ru": "Заново", "en": "Restart"},
	"menu": {"ru": "В меню", "en": "Menu"},
	"finish": {"ru": "Финиш! %s", "en": "Finish! %s"},
	"new_record": {"ru": "🏆 Новый рекорд!", "en": "🏆 New record!"},
	"time_coins": {"ru": "Время: %s сек  •  ◈ %d", "en": "Time: %s s  •  ◈ %d"},
	"double": {"ru": "◈×2 (видео)", "en": "◈×2 (video)"},
	"next": {"ru": "Дальше ▶", "en": "Next ▶"},
	"doubled": {"ru": "◈ Удвоено!", "en": "◈ Doubled!"},  # menu daily-double (настоящий ×2)
	"bonus_got": {"ru": "◈ Бонус получен!", "en": "◈ Bonus received!"},  # v9.2: win-double = честный флэт-бонус
	# v9.2 (консилиум v9.1 minor): кнопка win-double честно показывает сумму бонуса.
	# «◈×2» было мёртвой механикой: с флором 40 бонус плоский на всех 21 уровнях
	# (max монет в уровне = 12 → coins+20 ≤ 32 < 40), собранные монеты ничего не решали.
	# Отдельный ключ: menu daily-double (настоящий ×2) продолжает использовать "double".
	"double_win": {"ru": "📺 +%d ◈ (видео)", "en": "📺 +%d ◈ (video)"},
	"coins_n": {"ru": "Монет: %d", "en": "Coins: %d"},
	"pause": {"ru": "Пауза", "en": "Paused"},
	"continue": {"ru": "Продолжить", "en": "Continue"},
	"levels_hdr": {"ru": "— УРОВНИ —", "en": "— LEVELS —"},
	"skins_hdr": {"ru": "— СКИНЫ —", "en": "— SKINS —"},
	"shop_hdr": {"ru": "— МАГАЗИН —", "en": "— SHOP —"},
	"sound_on": {"ru": "Звук: ВКЛ", "en": "Sound: ON"},
	"sound_off": {"ru": "Звук: ВЫКЛ", "en": "Sound: OFF"},
	"daily": {"ru": "🎖 Награда дня!", "en": "🎖 Daily reward!"},
	"daily_next": {"ru": "🎖 завтра (×%d)", "en": "🎖 tomorrow (×%d)"},
	"hacker": {"ru": "ХАКЕР", "en": "HACKER"},
	"skin_nub": {"ru": "Нуб", "en": "Noob"},
	"skin_pro": {"ru": "Про", "en": "Pro"},
	"skin_samurai": {"ru": "Самурай", "en": "Samurai"},
	"skin_god": {"ru": "Бог", "en": "God"},
	"skin_neon": {"ru": "Неон", "en": "Neon"},
	"skin_hacker": {"ru": "Хакер", "en": "Hacker"},
	"shop_coins1": {"ru": "💰 500 ◈\n49 ₽", "en": "💰 500 ◈\n49 RUB"},
	"shop_coins2": {"ru": "💰 1500 ◈\n129 ₽", "en": "💰 1500 ◈\n129 RUB"},
	"shop_noads": {"ru": "⛔ Без рекламы\n199 ₽", "en": "⛔ No ads\n199 RUB"},
	"noads_owned": {"ru": "⛔ Реклама отключена ✓", "en": "⛔ Ads removed ✓"},
	"stars_total": {"ru": "★ %d/%d", "en": "★ %d/%d"},
	"rv_coins": {"ru": "📺 +%d ◈", "en": "📺 +%d ◈"},
	# v9.1: on_fail-фидбек menu-RV (видео закрыто раньше порога onRewarded)
	"rv_no_reward": {"ru": "Награда не получена — досмотрите видео до конца", "en": "No reward — watch the video to the end"},
	"skin_progress": {"ru": "◈ %d / %d до скина «%s»", "en": "◈ %d / %d to unlock \"%s\""},
	"lb_hdr": {"ru": "— ЛИДЕРЫ (время) —", "en": "— LEADERS (time) —"},
	"lb_loading": {"ru": "загрузка...", "en": "loading..."},
	"lb_unavailable": {"ru": "лидерборд недоступен", "en": "leaderboard unavailable"},
	"lb_you": {"ru": "... #%d ты (%s): %s", "en": "... #%d you (%s): %s"},
	"sec": {"ru": " с", "en": " s"},
	"pts": {"ru": " очк.", "en": " pts"},  # v9.1: лидерборд = par-эффективность ×1000
	# v9: серия Нубик/Про/Бог ПЕРЕФОРМАТИРОВАНА в 4 разные игры (2D-гонка, 3D-паркур,
	# майнинг, файтинг). Сестринские игры ещё не опубликованы — кросс-промо на
	# несуществующие товары в сторе = риск модерации. Нейтральная цель вместо имён.
	"series_hdr": {"ru": "— ЦЕЛЬ —", "en": "— GOAL —"},
	"series_nub": {"ru": "Пройди все 21 уровень, собери 63 звезды и открой все скины!", "en": "Beat all 21 levels, collect 63 stars and unlock every skin!"},
	"series_pro": {"ru": "Пройди все 21 уровень, собери 63 звезды и открой все скины!", "en": "Beat all 21 levels, collect 63 stars and unlock every skin!"},
	"series_god": {"ru": "Пройди все 21 уровень, собери 63 звезды и открой все скины!", "en": "Beat all 21 levels, collect 63 stars and unlock every skin!"},
	"daily_double_q": {"ru": "🎖 +%d ◈ получено!\nУдвоить награду за видео?", "en": "🎖 +%d ◈ claimed!\nDouble the reward for a video?"},
	"no_thanks": {"ru": "Нет, спасибо", "en": "No, thanks"},
	# v9: прокачка (второй sink монет ◈ — постоянные апгрейды характеристик)
	"upgrades_hdr": {"ru": "— ПРОКАЧКА —", "en": "— UPGRADES —"},
	"up_speed": {"ru": "Скорость", "en": "Speed"},
	"up_jump": {"ru": "Прыжок", "en": "Jump"},
	"up_extra_jump": {"ru": "Тройной", "en": "Triple jump"},
	"up_shield": {"ru": "Щит", "en": "Shield"},
	"up_dash": {"ru": "Рывок", "en": "Dash"},
	"up_magnet": {"ru": "Магнит", "en": "Magnet"},
	"up_desc_speed": {"ru": "+5% скорости бега за уровень", "en": "+5% run speed per level"},
	"up_desc_jump": {"ru": "+3% высоты прыжка за уровень", "en": "+3% jump height per level"},
	"up_desc_extra_jump": {"ru": "Третий прыжок в воздухе", "en": "Third mid-air jump"},
	"up_desc_shield": {"ru": "Щит спасает от падения (×ур.)", "en": "Shield saves a fall (×lvl)"},
	"up_desc_dash": {"ru": "Рывок вперёд: Shift / кнопка", "en": "Dash forward: Shift / button"},
	"up_desc_magnet": {"ru": "Притягивает монеты рядом", "en": "Attracts nearby coins"},
	"up_level_n": {"ru": "Ур. %d/%d", "en": "Lv. %d/%d"},
	"up_buy": {"ru": "◈ %d", "en": "◈ %d"},
	"up_max": {"ru": "МАКС", "en": "MAX"},
	"shield_n": {"ru": "🛡 %d", "en": "🛡 %d"},
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
	"pro":  {"name": "Про",   "color": Color(0.25, 0.45, 0.95), "cost": 80,   "rv": false},
	"samurai": {"name": "Самурай", "color": Color(0.95, 0.35, 0.25), "cost": 150, "rv": false},
	"god":  {"name": "Бог",   "color": Color(1.0, 0.85, 0.20), "cost": 0,    "rv": true},
	"neon": {"name": "Неон",  "color": Color(0.9, 0.2, 0.9),   "cost": 250,  "rv": false},
	"hacker": {"name": "Хакер", "color": Color(0.05, 0.18, 0.08), "cost": 666, "rv": false},
}

# v9: ПРОКАЧКА — постоянные апгрейды характеристик за ◈ (второй sink после скинов).
# Баланс: апгрейды ОБЛЕГЧАЮТ, но все 21 уровень проходимы и без них (базовые
# значения = v8.2). Цены нарастают ~×1.7; суммарный sink ≈4400 ◈.
# "effect" — множитель/шаг на уровень, читается в player.gd::apply_upgrades().
const UPGRADES := {
	"speed":      {"max": 5, "costs": [60, 120, 200, 320, 480]},
	"jump":       {"max": 5, "costs": [70, 140, 230, 360, 540]},
	"extra_jump": {"max": 1, "costs": [400]},
	"shield":     {"max": 3, "costs": [150, 300, 500]},
	"dash":       {"max": 3, "costs": [120, 260, 450]},
	"magnet":     {"max": 3, "costs": [80, 160, 280]},
}
const UPGRADE_ORDER := ["speed", "jump", "extra_jump", "shield", "dash", "magnet"]

func upgrade_level(id: String) -> int:
	return int(upgrades.get(id, 0))

func upgrade_maxed(id: String) -> bool:
	if not UPGRADES.has(id): return true
	return upgrade_level(id) >= int(UPGRADES[id]["max"])

func upgrade_cost(id: String) -> int:
	# цена СЛЕДУЮЩего уровня (или -1 если макс)
	if not UPGRADES.has(id): return -1
	var lv := upgrade_level(id)
	var costs: Array = UPGRADES[id]["costs"]
	if lv >= costs.size(): return -1
	return int(costs[lv])

func buy_upgrade(id: String) -> bool:
	var cost := upgrade_cost(id)
	if cost < 0 or coins < cost: return false
	coins -= cost
	upgrades[id] = upgrade_level(id) + 1
	save_data()  # покупка — немедленный save (не debounce)
	return true

func _ready() -> void:
	_setup_fonts()
	load_data()
	# GameState — первый autoload, Yandex ещё не в дереве; коннектим отложенно
	_connect_yandex.call_deferred()

func _notification(what: int) -> void:
	# v9.1: debounce save (add_coins не пишет сразу) → при закрытии вкладки
	# принудительно сбрасываем dirty-сейв, иначе последние монеты теряются.
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_EXIT_TREE:
		if _save_dirty:
			save_data()

func _connect_yandex() -> void:
	if Yandex.is_ready():
		_on_sdk_ready()  # сигнал уже прошёл до коннекта
		return
	if not Yandex.sdk_ready.is_connected(_on_sdk_ready):
		Yandex.sdk_ready.connect(_on_sdk_ready)

func _on_sdk_ready() -> void:
	# restore покупок (no_ads) + облачный сейв
	Yandex.get_purchases(_restore_purchases)
	Yandex.load_from_cloud(_merge_cloud)

# глобальный шрифт: Noto Sans (кириллица) + Noto Sans Symbols 2 (★◈▶🔒 и пр.)
# без этого дефолтный шрифт Godot рисует тофу вместо глифов
func _setup_fonts() -> void:
	var main: Font = load("res://assets/fonts/NotoSans-Regular.ttf")
	var symbols: Font = load("res://assets/fonts/NotoSansSymbols2-Regular.ttf")
	if main and symbols:
		if main is FontFile:
			(main as FontFile).fallbacks = [symbols]
		ThemeDB.set_fallback_font(main)

func _restore_purchases(list) -> void:
	if list == null: return
	for p in list:
		var pid: String = str(p.productID)
		if pid == "no_ads":
			no_ads = true
	save_data()

func _merge_cloud(d: Dictionary) -> void:
	if d.is_empty(): return
	# мердж по принципу «больше/новее» — облако не должно откатывать локальный прогресс
	coins = maxi(coins, int(d.get("coins", 0)))
	max_level = maxi(max_level, int(d.get("max_level", 1)))
	for s in d.get("unlocked", []):
		if s not in unlocked_skins:
			unlocked_skins.append(s)
	no_ads = no_ads or bool(d.get("no_ads", false))
	for k in d.get("best", {}):
		if not best_times.has(k) or int(d["best"][k]) < int(best_times[k]):
			best_times[k] = d["best"][k]
	for k in d.get("stars", {}):
		if not stars.has(k) or int(d["stars"][k]) > int(stars[k]):
			stars[k] = d["stars"][k]
	# v9: апгрейды — maxi по каждому (облако не откатывает прогресс)
	for k in d.get("upgrades", {}):
		upgrades[k] = maxi(upgrade_level(str(k)), int(d["upgrades"][k]))
	save_data()

func add_coins(n: int) -> void:
	coins += n
	# v9.1 (консилиум v8.2, критик-код minor): save_data на КАЖДУЮ монету = 150+
	# синхронных FileAccess+JSON+cloud-посылок за прохождение. Debounce: помечаем
	# dirty, flush через 1.5с one-shot таймером; немедленный save остаётся в
	# ключевых точках (complete_level, покупки, merge). Потеря ≤1.5с монет при
	# краше вкладки приемлемо (cloud мерджит по maxi).
	_save_dirty = true
	_flush_soon()

var _save_dirty := false
var _flush_pending := false

func _flush_soon() -> void:
	if _flush_pending: return
	_flush_pending = true
	var t := get_tree().create_timer(1.5)
	t.timeout.connect(_on_flush_timeout)

func _on_flush_timeout() -> void:
	_flush_pending = false
	if _save_dirty:
		save_data()

func flush_save() -> void:
	_save_dirty = false
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

func is_new_record(level: int, time_ms: int) -> bool:
	var key := str(level)
	if not best_times.has(key): return true
	return time_ms < int(best_times[key])

func best_time(level: int) -> int:
	return int(best_times.get(str(level), 0))

func stars_of(level: int) -> int:
	return int(stars.get(str(level), 0))

# ---------- persistence (Yandex cloud или localStorage fallback) ----------

func save_data() -> void:
	_save_dirty = false
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
		"upgrades": upgrades,  # v9
	}
	# ОБА хранилища: локал работает всегда, облако — когда SDK готов
	var f := FileAccess.open("user://save.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))
		f.close()
	if Yandex.is_ready():
		Yandex.save(data)

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
	upgrades = Dictionary(d.get("upgrades", {}))  # v9

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
	var reward := mini(200, 50 + (daily_streak - 1) * 25)  # 50..200, кап против инфляции
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
