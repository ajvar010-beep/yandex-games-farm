extends Node
## GameState — глобальное состояние, сейвы, прогресс, i18n, каталоги снаряжения.

var coins: int = 0
var gems: int = 0                      # премиум-валюта (рубины из золотых жил / IAP)
var max_level: int = 1                 # самый глубокий ОТКРЫТЫЙ уровень
var sound_on: bool = true
var no_ads: bool = false               # IAP: отключить interstitial
var lang := "ru"

# снаряжение: id -> количество купленных
var owned: Dictionary = {}             # pick_wood: 3, helm_bronze: 1, mach_drill: 0...
var upgrades: Dictionary = {}          # tap_power/crit/offline/boss_time -> уровень
var unlocked_skins: Array = ["miner"]
var current_skin: String = "miner"

var last_daily: String = ""
var daily_streak: int = 0
var last_interstitial_ms: int = 0      # кулдаун живёт здесь (Game пересоздаётся)
var last_rv_coins_ms: int = 0
var last_offline_ms: int = 0           # unix-метка последнего save → офлайн-заработок
var tutorial_done: bool = false

signal lang_changed

# ---------- i18n ----------
const TR := {
	"title": {"ru": "ШАХТЁР КЛИКЕР", "en": "MINER CLICKER"},
	"sub": {"ru": "Кликай камень. Нанимай снарягу. Спускайся глубже.", "en": "Click the rock. Hire gear. Dig deeper."},
	"level": {"ru": "Уровень %d", "en": "Level %d"},
	"depth": {"ru": "Глубина: %d м", "en": "Depth: %d m"},
	"play": {"ru": "ИГРАТЬ", "en": "PLAY"},
	"shop": {"ru": "ЛАВКА", "en": "SHOP"},
	"upgrades": {"ru": "ПРОКАЧКА", "en": "UPGRADES"},
	"skins": {"ru": "СКИНЫ", "en": "SKINS"},
	"leaders": {"ru": "ЛИДЕРЫ", "en": "LEADERS"},
	"menu": {"ru": "В меню", "en": "Menu"},
	"back": {"ru": "Назад", "en": "Back"},
	"coins_n": {"ru": "%d ◈", "en": "%d ◈"},
	"gems_n": {"ru": "%d ◆", "en": "%d ◆"},
	"per_sec": {"ru": "+%d/сек", "en": "+%d/s"},
	"tap_power": {"ru": "удар: %d", "en": "hit: %d"},
	"sound_on": {"ru": "Звук: ВКЛ", "en": "Sound: ON"},
	"sound_off": {"ru": "Звук: ВЫКЛ", "en": "Sound: OFF"},
	"tut_tap": {"ru": "ТАПАЙ ПО КАМНЮ — добывай монеты!", "en": "TAP THE ROCK — earn coins!"},
	"tut_buy": {"ru": "Хватит на кирку? Жми ЛАВКУ — она будет бить за тебя!", "en": "Enough for a pickaxe? Tap SHOP — it mines for you!"},
	"tut_goal": {"ru": "Разбей %d камней, чтобы спуститься ниже", "en": "Break %d rocks to dig deeper"},
	"rock_hp": {"ru": "%d/%d", "en": "%d/%d"},
	"rocks_left": {"ru": "камней: %d", "en": "rocks: %d"},
	"boss": {"ru": "БОСС-ПЛИТА", "en": "BOSS SLAB"},
	"boss_time": {"ru": "%d с", "en": "%d s"},
	"boss_fail": {"ru": "Плита не поддалась!", "en": "The slab held!"},
	"boss_retry": {"ru": "Заново", "en": "Retry"},
	"boss_rv": {"ru": "📺 +%d с (видео)", "en": "📺 +%d s (video)"},
	"level_done": {"ru": "Глубина взята!", "en": "Depth cleared!"},
	"reward_n": {"ru": "Награда: +%d ◈", "en": "Reward: +%d ◈"},
	"double_win": {"ru": "📺 Удвоить (видео)", "en": "📺 Double (video)"},
	"doubled": {"ru": "◈ Удвоено!", "en": "◈ Doubled!"},
	"next": {"ru": "Глубже ▼", "en": "Deeper ▼"},
	"new_gear": {"ru": "🔓 Открыто: %s", "en": "🔓 Unlocked: %s"},
	"no_thanks": {"ru": "Нет, спасибо", "en": "No, thanks"},
	"rv_no_reward": {"ru": "Награда не получена — досмотрите видео до конца", "en": "No reward — watch the video to the end"},
	"daily": {"ru": "🎖 Награда дня!", "en": "🎖 Daily reward!"},
	"daily_double_q": {"ru": "🎖 +%d ◈ получено!\nУдвоить за видео?", "en": "🎖 +%d ◈ claimed!\nDouble for a video?"},
	"offline_title": {"ru": "⛏ Пока вас не было…", "en": "⛏ While you were away…"},
	"offline_earned": {"ru": "Бригада добыла: +%d ◈", "en": "Your crew mined: +%d ◈"},
	"offline_double": {"ru": "📺 Удвоить (видео)", "en": "📺 Double (video)"},
	"collect": {"ru": "Забрать", "en": "Collect"},
	"lb_hdr": {"ru": "— ЛИДЕРЫ (глубина) —", "en": "— LEADERS (depth) —"},
	"lb_loading": {"ru": "загрузка...", "en": "loading..."},
	"lb_unavailable": {"ru": "лидерборд недоступен", "en": "leaderboard unavailable"},
	"lb_you": {"ru": "... #%d ты: %d м", "en": "... #%d you: %d m"},
	"series_hdr": {"ru": "— ЦЕЛЬ —", "en": "— GOAL —"},
	"series_goal": {"ru": "Спустись на 300 метров! Открой все кирки, каски и машины. Победи магмовое ядро!", "en": "Reach 300 meters! Unlock every pickaxe, helmet and machine. Beat the magma core!"},

	# магазин
	"tab_picks": {"ru": "КИРКИ", "en": "PICKS"},
	"tab_helms": {"ru": "КАСКИ", "en": "HELMETS"},
	"tab_machs": {"ru": "МАШИНЫ", "en": "MACHINES"},
	"own_n": {"ru": "×%d", "en": "×%d"},
	"buy": {"ru": "◈ %d", "en": "◈ %d"},
	"locked_lvl": {"ru": "🔒 ур. %d", "en": "🔒 lvl %d"},
	"locked_ban": {"ru": "🚫 затоплено", "en": "🚫 flooded"},
	"locked_ban_gold": {"ru": "🚫 нельзя на этом ур.", "en": "🚫 banned here"},
	"maxed": {"ru": "МАКС", "en": "MAX"},
	"not_enough": {"ru": "Не хватает ◈", "en": "Not enough ◈"},
	"gear_unlocks_at": {"ru": "откроется на ур. %d", "en": "unlocks at lvl %d"},

	# кирки (тап-урон)
	"pick_wood": {"ru": "Деревянная кирка", "en": "Wooden pickaxe"},
	"pick_stone": {"ru": "Каменная кирка", "en": "Stone pickaxe"},
	"pick_bronze": {"ru": "Бронзовая кирка", "en": "Bronze pickaxe"},
	"pick_iron": {"ru": "Железная кирка", "en": "Iron pickaxe"},
	"pick_steel": {"ru": "Стальная кирка", "en": "Steel pickaxe"},
	"pick_gold": {"ru": "Золотая кирка", "en": "Golden pickaxe"},
	"pick_diamond": {"ru": "Алмазная кирка", "en": "Diamond pickaxe"},
	"pick_laser": {"ru": "Лазерная кирка", "en": "Laser pickaxe"},
	"dpick": {"ru": "+%d к удару", "en": "+%d hit power"},

	# каски (шахтёры, DPS)
	"helm_bronze": {"ru": "Бронзовая каска", "en": "Bronze helmet"},
	"helm_iron": {"ru": "Железная каска", "en": "Iron helmet"},
	"helm_steel": {"ru": "Стальная каска", "en": "Steel helmet"},
	"helm_gold": {"ru": "Золотая каска", "en": "Golden helmet"},
	"helm_diamond": {"ru": "Алмазная каска", "en": "Diamond helmet"},
	"helm_lava": {"ru": "Лавовая каска", "en": "Lava helmet"},
	"dhelm": {"ru": "+%d ◈/сек (шахтёр)", "en": "+%d ◈/s (miner)"},

	# машины (DPS, запрещены на затопленных)
	"mach_drill": {"ru": "Малый бур", "en": "Small drill"},
	"mach_hammer": {"ru": "Отбойный молот", "en": "Jackhammer"},
	"mach_laser": {"ru": "Лазерный резак", "en": "Laser cutter"},
	"mach_excavator": {"ru": "Экскаватор", "en": "Excavator"},
	"mach_turbodrill": {"ru": "Турбобур", "en": "Turbo drill"},
	"mach_coreburn": {"ru": "Ядерный прожиг", "en": "Core burner"},
	"dmach": {"ru": "+%d ◈/сек (машина)", "en": "+%d ◈/s (machine)"},

	# прокачка
	"up_tap": {"ru": "Сила удара", "en": "Tap power"},
	"up_crit": {"ru": "Крит-удача", "en": "Crit luck"},
	"up_offline": {"ru": "Офлайн-бригада", "en": "Offline crew"},
	"up_boss": {"ru": "Взрывчатка", "en": "Dynamite"},
	"dup_tap": {"ru": "+%d к удару за уровень", "en": "+%d hit power per level"},
	"dup_crit": {"ru": "+2%% шанс ×3 крита", "en": "+2%% ×3 crit chance"},
	"dup_offline": {"ru": "+10%% офлайн-добычи", "en": "+10%% offline earnings"},
	"dup_boss": {"ru": "+2 с на босса", "en": "+2 s on bosses"},
	"up_level_n": {"ru": "Ур. %d/%d", "en": "Lv. %d/%d"},

	# скины (герой у камня)
	"skin_miner": {"ru": "Шахтёр", "en": "Miner"},
	"skin_foreman": {"ru": "Бригадир", "en": "Foreman"},
	"skin_gold": {"ru": "Золотоискатель", "en": "Gold digger"},
	"skin_robot": {"ru": "Робо-бур", "en": "Robo-miner"},

	# IAP / RV
	"shop_coins1": {"ru": "💰 5000 ◈\n49 ₽", "en": "💰 5000 ◈\n49 RUB"},
	"shop_coins2": {"ru": "💰 20000 ◈\n129 ₽", "en": "💰 20000 ◈\n129 RUB"},
	"shop_noads": {"ru": "⛔ Без рекламы\n199 ₽", "en": "⛔ No ads\n199 RUB"},
	"noads_owned": {"ru": "⛔ Реклама отключена ✓", "en": "⛔ Ads removed ✓"},
	"rv_coins": {"ru": "📺 +%d ◈", "en": "📺 +%d ◈"},
	"rv_pick": {"ru": "📺 Кирка бесплатно", "en": "📺 Free pickaxe"},
	"pause": {"ru": "Пауза", "en": "Paused"},
	"continue": {"ru": "Продолжить", "en": "Continue"},
	"golden_vein": {"ru": "◆ ЗОЛОТАЯ ЖИЛА!", "en": "◆ GOLDEN VEIN!"},
}

func L(key: String) -> String:
	var d: Dictionary = TR.get(key, {})
	return d.get(lang, key)

func set_lang(l: String) -> void:
	var nl := "en" if l.begins_with("en") else "ru"
	if nl != lang:
		lang = nl
		lang_changed.emit()

# ---------- каталог снаряжения ----------
# kind: pick (тап-урон, стакается) | helm (шахтёр DPS) | mach (машина DPS)
# power: pick=+к удару за штуку, helm/mach=◈/сек за штуку
# cost: базовая цена, cost_mult: рост цены за каждую следующую
# unlock: уровень открытия; ban: тег запрета ("" = нет); stack: макс. штук (1 = апгрейд-замена)
const GEAR := {
	# --- кирки (видны: висят веером, бьют камень при тапе) ---
	"pick_wood":    {"kind": "pick", "power": 1,   "cost": 15,     "cost_mult": 1.6,  "unlock": 1,  "ban": "",     "stack": 10, "tier": 0},
	"pick_stone":   {"kind": "pick", "power": 4,   "cost": 90,     "cost_mult": 1.65, "unlock": 2,  "ban": "",     "stack": 10, "tier": 1},
	"pick_bronze":  {"kind": "pick", "power": 12,  "cost": 420,    "cost_mult": 1.7,  "unlock": 4,  "ban": "",     "stack": 10, "tier": 2},
	"pick_iron":    {"kind": "pick", "power": 35,  "cost": 1800,   "cost_mult": 1.7,  "unlock": 6,  "ban": "",     "stack": 10, "tier": 3},
	"pick_steel":   {"kind": "pick", "power": 100, "cost": 7500,   "cost_mult": 1.75, "unlock": 9,  "ban": "",     "stack": 10, "tier": 4},
	"pick_gold":    {"kind": "pick", "power": 280, "cost": 32000,  "cost_mult": 1.75, "unlock": 13, "ban": "gold", "stack": 10, "tier": 5},
	"pick_diamond": {"kind": "pick", "power": 800, "cost": 140000, "cost_mult": 1.8,  "unlock": 17, "ban": "",     "stack": 10, "tier": 6},
	"pick_laser":   {"kind": "pick", "power": 2400,"cost": 600000, "cost_mult": 1.85, "unlock": 23, "ban": "",     "stack": 10, "tier": 7},
	# --- каски (шахтёры рядом с камнем) ---
	"helm_bronze":  {"kind": "helm", "power": 3,   "cost": 250,    "cost_mult": 1.7,  "unlock": 3,  "ban": "",     "stack": 6, "tier": 0},
	"helm_iron":    {"kind": "helm", "power": 10,  "cost": 1100,   "cost_mult": 1.7,  "unlock": 5,  "ban": "",     "stack": 6, "tier": 1},
	"helm_steel":   {"kind": "helm", "power": 32,  "cost": 5200,   "cost_mult": 1.75, "unlock": 8,  "ban": "",     "stack": 6, "tier": 2},
	"helm_gold":    {"kind": "helm", "power": 95,  "cost": 24000,  "cost_mult": 1.75, "unlock": 12, "ban": "",     "stack": 6, "tier": 3},
	"helm_diamond": {"kind": "helm", "power": 300, "cost": 110000, "cost_mult": 1.8,  "unlock": 16, "ban": "",     "stack": 6, "tier": 4},
	"helm_lava":    {"kind": "helm", "power": 1000,"cost": 520000, "cost_mult": 1.85, "unlock": 21, "ban": "",     "stack": 6, "tier": 5},
	# --- машины (большие, слева от камня; запрещены на затопленных) ---
	"mach_drill":     {"kind": "mach", "power": 25,   "cost": 1500,    "cost_mult": 1.75, "unlock": 7,  "ban": "flood", "stack": 4, "tier": 0},
	"mach_hammer":    {"kind": "mach", "power": 80,   "cost": 8000,   "cost_mult": 1.75, "unlock": 10, "ban": "flood", "stack": 4, "tier": 1},
	"mach_laser":     {"kind": "mach", "power": 260,  "cost": 40000,  "cost_mult": 1.8,  "unlock": 14, "ban": "flood", "stack": 4, "tier": 2},
	"mach_excavator": {"kind": "mach", "power": 850,  "cost": 190000, "cost_mult": 1.8,  "unlock": 18, "ban": "flood", "stack": 4, "tier": 3},
	"mach_turbodrill":{"kind": "mach", "power": 2800, "cost": 900000, "cost_mult": 1.85, "unlock": 22, "ban": "flood", "stack": 4, "tier": 4},
	"mach_coreburn":  {"kind": "mach", "power": 9500, "cost": 4500000,"cost_mult": 1.9,  "unlock": 25, "ban": "",      "stack": 4, "tier": 5},
}
const GEAR_ORDER := [
	"pick_wood","pick_stone","pick_bronze","pick_iron","pick_steel","pick_gold","pick_diamond","pick_laser",
	"helm_bronze","helm_iron","helm_steel","helm_gold","helm_diamond","helm_lava",
	"mach_drill","mach_hammer","mach_laser","mach_excavator","mach_turbodrill","mach_coreburn",
]

const UPGRADES := {
	"tap":    {"max": 10, "costs": [50,120,260,520,1000,1900,3500,6500,12000,22000], "step": 2},
	"crit":   {"max": 10, "costs": [100,250,550,1100,2100,3900,7200,13000,24000,44000]},
	"offline":{"max": 5,  "costs": [300,900,2400,6000,15000]},
	"boss":   {"max": 5,  "costs": [200,600,1600,4000,10000]},
}
const UPGRADE_ORDER := ["tap", "crit", "offline", "boss"]

# ---------- снаряжение: расчёты ----------

func gear_owned(id: String) -> int:
	return int(owned.get(id, 0))

func gear_unlocked(id: String, level: int) -> bool:
	return GEAR.has(id) and level >= int(GEAR[id]["unlock"])

# запрет уровня: lvl.ban == "machines" → запрещён тег "flood"; "no_gold" → "gold"
func gear_banned(id: String, lvl: Dictionary) -> bool:
	if not GEAR.has(id): return true
	var lvl_ban: String = str(lvl.get("ban", ""))
	if lvl_ban == "": return false
	var gtag: String = str(GEAR[id]["ban"])
	if lvl_ban == "machines": return gtag == "flood"
	if lvl_ban == "no_gold": return gtag == "gold"
	return false

func gear_cost(id: String) -> int:
	if not GEAR.has(id): return -1
	var n := gear_owned(id)
	if n >= int(GEAR[id]["stack"]): return -1  # макс
	return int(round(float(GEAR[id]["cost"]) * pow(float(GEAR[id]["cost_mult"]), n)))

# сила тапа = 1 (рука) + апгрейд tap + кирки
func tap_power() -> int:
	var p := 1 + upgrade_level("tap") * int(UPGRADES["tap"]["step"])
	for id in GEAR_ORDER:
		if GEAR[id]["kind"] == "pick":
			p += gear_owned(id) * int(GEAR[id]["power"])
	return p

# DPS = каски + машины (машины выключаются на затопленных уровнях)
func dps(lvl: Dictionary = {}) -> int:
	var d := 0
	for id in GEAR_ORDER:
		var k: String = str(GEAR[id]["kind"])
		if k == "helm" or k == "mach":
			if k == "mach" and gear_banned(id, lvl):
				continue  # машина куплена, но на этом уровне затоплено — молчит
			d += gear_owned(id) * int(GEAR[id]["power"])
	return d

func crit_chance() -> float:
	return minf(0.20, 0.02 * upgrade_level("crit"))  # до 20%

func boss_time_bonus() -> int:
	return 2 * upgrade_level("boss")

func offline_mult() -> float:
	return 0.5 + 0.1 * upgrade_level("offline")  # 50%..100%

# покупка с проверкой ВСЕХ условий до списания (урок партии-2)
func buy_gear(id: String, lvl: Dictionary) -> int:  # 0=ok, 1=нет денег, 2=макс, 3=закрыт, 4=запрет
	if not GEAR.has(id): return 3
	if gear_owned(id) >= int(GEAR[id]["stack"]): return 2
	if not gear_unlocked(id, max_level): return 3
	if gear_banned(id, lvl): return 4
	var c := gear_cost(id)
	if coins < c: return 1
	coins -= c
	owned[id] = gear_owned(id) + 1
	save_data()
	return 0

# ---------- прокачка ----------

func upgrade_level(id: String) -> int:
	return int(upgrades.get(id, 0))

func upgrade_maxed(id: String) -> bool:
	if not UPGRADES.has(id): return true
	return upgrade_level(id) >= int(UPGRADES[id]["max"])

func upgrade_cost(id: String) -> int:
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
	save_data()
	return true

# ---------- скины ----------

const SKINS := {
	"miner":  {"cost": 0,    "rv": false, "pal": {"skin": Color(0.94,0.75,0.60), "shirt": Color(0.85,0.55,0.15), "pants": Color(0.30,0.25,0.20), "helm": Color(0.95,0.80,0.20)}},
	"foreman":{"cost": 500,  "rv": false, "pal": {"skin": Color(0.93,0.78,0.62), "shirt": Color(0.20,0.45,0.80), "pants": Color(0.20,0.20,0.25), "helm": Color(0.95,0.35,0.25)}},
	"gold":   {"cost": 2500, "rv": false, "pal": {"skin": Color(0.98,0.88,0.72), "shirt": Color(1.00,0.85,0.20), "pants": Color(0.60,0.45,0.15), "helm": Color(1.00,0.90,0.30)}},
	"robot":  {"cost": 0,    "rv": true,  "pal": {"skin": Color(0.60,0.65,0.70), "shirt": Color(0.40,0.45,0.55), "pants": Color(0.30,0.35,0.45), "helm": Color(0.20,0.90,0.60)}},
}
const SKIN_ORDER := ["miner", "foreman", "gold", "robot"]

func is_unlocked(id: String) -> bool: return id in unlocked_skins
func unlock_skin(id: String) -> void:
	if id not in unlocked_skins:
		unlocked_skins.append(id)
		save_data()
func set_skin(id: String) -> void:
	if is_unlocked(id):
		current_skin = id
		save_data()

# ---------- офлайн-заработок ----------

# вызывается после load_data: возвращает монеты, заработанные пока игрока не было
func offline_earnings() -> int:
	if last_offline_ms <= 0: return 0
	var away_s := int(Time.get_unix_time_from_system()) - last_offline_ms / 1000
	if away_s < 300: return 0  # меньше 5 минут — не считаем
	var d := dps()
	if d <= 0: return 0
	var capped := mini(away_s, 8 * 3600)  # кап 8 часов
	return int(d * capped * offline_mult())

# ---------- жизненный цикл ----------

func _ready() -> void:
	_setup_fonts()
	load_data()
	_connect_yandex.call_deferred()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_EXIT_TREE:
		if _save_dirty:
			save_data()

func _connect_yandex() -> void:
	if Yandex.is_ready():
		_on_sdk_ready()
		return
	if not Yandex.sdk_ready.is_connected(_on_sdk_ready):
		Yandex.sdk_ready.connect(_on_sdk_ready)

func _on_sdk_ready() -> void:
	Yandex.get_purchases(_restore_purchases)
	Yandex.load_from_cloud(_merge_cloud)

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
	coins = maxi(coins, int(d.get("coins", 0)))
	gems = maxi(gems, int(d.get("gems", 0)))
	max_level = maxi(max_level, int(d.get("max_level", 1)))
	no_ads = no_ads or bool(d.get("no_ads", false))
	for k in d.get("owned", {}):
		owned[k] = maxi(int(owned.get(k, 0)), int(d["owned"][k]))
	for k in d.get("upgrades", {}):
		upgrades[k] = maxi(upgrade_level(str(k)), int(d["upgrades"][k]))
	for s in d.get("unlocked", []):
		if s not in unlocked_skins:
			unlocked_skins.append(s)
	save_data()

func add_coins(n: int) -> void:
	coins += n
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

# ---------- persistence ----------

func save_data() -> void:
	_save_dirty = false
	last_offline_ms = int(Time.get_unix_time_from_system() * 1000)
	var data := {
		"coins": coins,
		"gems": gems,
		"max_level": max_level,
		"sound": sound_on,
		"no_ads": no_ads,
		"owned": owned,
		"upgrades": upgrades,
		"unlocked": unlocked_skins,
		"skin": current_skin,
		"last_daily": last_daily,
		"daily_streak": daily_streak,
		"last_offline_ms": last_offline_ms,
		"tutorial_done": tutorial_done,
	}
	var f := FileAccess.open("user://save.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))
		f.close()
	if Yandex.is_ready():
		Yandex.save(data)

func load_data() -> void:
	var f := FileAccess.open("user://save.json", FileAccess.READ)
	if f:
		var parsed = JSON.parse_string(f.get_as_text())
		f.close()
		if parsed is Dictionary:
			_apply(parsed)

func _apply(d: Dictionary) -> void:
	coins = int(d.get("coins", 0))
	gems = int(d.get("gems", 0))
	max_level = int(d.get("max_level", 1))
	sound_on = bool(d.get("sound", true))
	no_ads = bool(d.get("no_ads", false))
	owned = Dictionary(d.get("owned", {}))
	upgrades = Dictionary(d.get("upgrades", {}))
	unlocked_skins = Array(d.get("unlocked", ["miner"]))
	current_skin = str(d.get("skin", "miner"))
	last_daily = str(d.get("last_daily", ""))
	daily_streak = int(d.get("daily_streak", 0))
	last_offline_ms = int(d.get("last_offline_ms", 0))
	tutorial_done = bool(d.get("tutorial_done", false))

# ---------- ежедневная награда ----------

func can_claim_daily() -> bool:
	return last_daily != _today()

func claim_daily() -> int:
	if not can_claim_daily(): return 0
	var today := _today()
	if last_daily == _yesterday():
		daily_streak += 1
	else:
		daily_streak = 1
	last_daily = today
	var reward := mini(500, 100 + (daily_streak - 1) * 50)
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
