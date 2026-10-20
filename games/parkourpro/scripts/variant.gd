extends Node
## Variant — конфиг серии. Меняем VARIANT → получаем Нубик/Про/Бог.

# Меняется при сборке (или через URL-параметр в Яндексе)
@export var id := "nub"          # nub | pro | god
@export var title := "НУБИК ПАРКУР"
@export var subtitle := "Учись прыгать! Лёгкие уровни для новичков."
@export var difficulty := 0.8    # множитель сложности (длина прыжков, скорость ловушек)
@export var skin_color := Color(0.25, 0.45, 0.95)

const VARIANTS := {
	"nub": {"title":"НУБИК ПАРКУР","sub":"Учись прыгать! Лёгкие уровни для новичков.","diff":0.85,"color":Color(0.35,0.75,0.35)},
	"pro": {"title":"ПРО ПАРКУР","sub":"Прыгай по блокам. Не упади в лаву. Дойди до финиша.","diff":1.0,"color":Color(0.25,0.45,0.95)},
	"god": {"title":"БОГ ПАРКУРА","sub":"Только для избранных. Узкие платформы, злые ловушки.","diff":1.3,"color":Color(1.0,0.85,0.2)},
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

func _apply() -> void:
	var v: Dictionary = VARIANTS.get(id, VARIANTS["pro"])
	title = v["title"]
	subtitle = v["sub"]
	difficulty = v["diff"]
	skin_color = v["color"]
