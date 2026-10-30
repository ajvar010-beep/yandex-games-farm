extends Node
## Variant — конфиг серии. Меняем id → получаем Нубик/Про/Бог.
## v11: варианты РАЗЛИЧАЮТСЯ по 4 осям, а не только сложностью/цветом:
##   1. ТЕМА окружения (день / закат / ночь) — видно сразу
##   2. КОЛИЧЕСТВО УРОВНЕЙ (21 / 30 с хакер-главой / 21)
##   3. МЕХАНИКИ (тройной прыжок+щиты у Нуба / нет чекпоинтов у Бога)
##   4. ЭКОНОМИКА (×2 монеты у Бога — риск=награда)

# Меняется при сборке (или через URL-параметр в Яндексе)
@export var id := "nub"          # nub | pro | god
@export var title := "НУБИК ПАРКУР"
@export var subtitle := "Учись прыгать! Лёгкие уровни для новичков."
@export var difficulty := 0.85    # множитель сложности (длина прыжков, скорость ловушек)
@export var skin_color := Color(0.35, 0.75, 0.35)
# v11 — оси различий (читаются из VARIANTS в _apply)
@export var levels_total := 21       # сколько уровней в меню/кампании
@export var max_jumps := 2           # базовых прыжков (до апгрейда extra_jump)
@export var free_shields := 0        # бесплатных щитов на каждый уровень
@export var has_checkpoints := true  # есть ли промежуточные чекпоинты
@export var coin_mult := 1           # множитель монет (×2 у Бога)
@export var theme_id := "day"     # day | sunset | night — палитра неба/лав/тумана

# title/sub берутся из i18n: GameState.L("title_"+id) / L("sub_"+id)
const VARIANTS := {
	"nub": {"diff":0.85,"color":Color(0.35,0.75,0.35),
		"levels":21,"jumps":3,"shields":2,"cps":true,"coins":1,"theme":"day"},
	"pro": {"diff":1.0,"color":Color(0.25,0.45,0.95),
		"levels":30,"jumps":2,"shields":0,"cps":true,"coins":1,"theme":"sunset"},
	"god": {"diff":1.3,"color":Color(1.0,0.85,0.2),
		"levels":21,"jumps":2,"shields":0,"cps":false,"coins":2,"theme":"night"},
}

func _ready() -> void:
	# URL-параметр ?v=nub|pro|god (в Яндексе можно)
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		var js = JavaScriptBridge.get_interface("window")
		var url: String = str(js.location.href)
		if "?v=" in url or "&v=" in url:
			var m := url.split("v=")[1].split("&")[0].split("#")[0]
			if m in VARIANTS:
				id = m
	_apply()
	if not GameState.lang_changed.is_connected(_apply):
		GameState.lang_changed.connect(_apply)

func _apply() -> void:
	var v: Dictionary = VARIANTS.get(id, VARIANTS["pro"])
	title = GameState.L("title_" + id)
	subtitle = GameState.L("sub_" + id)
	difficulty = v["diff"]
	skin_color = v["color"]
	levels_total = int(v["levels"])
	max_jumps = int(v["jumps"])
	free_shields = int(v["shields"])
	has_checkpoints = bool(v["cps"])
	coin_mult = int(v["coins"])
	theme_id = str(v["theme"])
