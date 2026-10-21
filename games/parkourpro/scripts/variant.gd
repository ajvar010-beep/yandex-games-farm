extends Node
## Variant — конфиг серии. Меняем VARIANT → получаем Нубик/Про/Бог.

# Меняется при сборке (или через URL-параметр в Яндексе)
@export var id := "pro"          # nub | pro | god
@export var title := "ПРО ПАРКУР"
@export var subtitle := "Прыгай по блокам. Не упади в лаву. Дойди до финиша."
@export var difficulty := 1.0    # множитель сложности (длина прыжков, скорость ловушек)
@export var skin_color := Color(0.25, 0.45, 0.95)

# title/sub берутся из i18n: GameState.L("title_"+id) / L("sub_"+id)
const VARIANTS := {
	"nub": {"diff":0.85,"color":Color(0.35,0.75,0.35)},
	"pro": {"diff":1.0,"color":Color(0.25,0.45,0.95)},
	"god": {"diff":1.3,"color":Color(1.0,0.85,0.2)},
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
