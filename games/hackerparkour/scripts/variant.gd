extends Node
## Variant — «Хакер Паркур», отдельная 4-я игра серии.
## ВСЯ игра живёт в неоновой матрице (уровни = бывшая хакер-глава 22-30 «Про Паркура»).

@export var id := "hacker"
@export var title := "ХАКЕР ПАРКУР"
@export var subtitle := "Взломай матрицу. Неоновые платформы, никакой пощады."
@export var difficulty := 1.15   # между Про (1.0) и Богом (1.3) — неон требует точности
@export var skin_color := Color(0.05, 0.18, 0.08)
@export var levels_total := 9        # кампания = хакер-глава (9 уровней)
@export var max_jumps := 2
@export var free_shields := 0
@export var has_checkpoints := true  # матрица сложная — чекпоинты оставлены
@export var coin_mult := 1
@export var theme_id := "hacker"     # неоновая матрица по умолчанию

const VARIANTS := {
	"hacker": {"diff":1.15,"color":Color(0.05,0.18,0.08),
		"levels":9,"jumps":2,"shields":0,"cps":true,"coins":1,"theme":"hacker"},
}

func _ready() -> void:
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
	var v: Dictionary = VARIANTS.get(id, VARIANTS["hacker"])
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
