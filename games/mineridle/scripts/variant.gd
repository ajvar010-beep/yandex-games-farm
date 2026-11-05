extends Node
## Variant — конфиг игры (одна игра, но оставляем крюк на ?v= для тестов).

@export var id := "mineridle"
@export var title := "ШАХТЁР КЛИКЕР"
@export var subtitle := "Кликай камень. Нанимай кирки, каски и машины. Спускайся глубже."
@export var levels_total := 30
@export var theme_id := "mine"    # mine | deep | magma — палитра шахты по главам

func _ready() -> void:
	if OS.has_feature("web") and Engine.has_singleton("JavaScriptBridge"):
		var js = JavaScriptBridge.get_interface("window")
		var url: String = str(js.location.href)
		# тестовый крюк: ?lang=en / ?lang=ru
		if "lang=" in url:
			var m := url.split("lang=")[1].split("&")[0].split("#")[0]
			if m in ["ru", "en"]:
				GameState.set_lang(m)
	# тема зависит от уровня (глава 1-10 шахта, 11-20 глубь, 21-30 магма) — читает game.gd
	if not GameState.lang_changed.is_connected(_on_lang):
		GameState.lang_changed.connect(_on_lang)

func _on_lang() -> void:
	title = GameState.L("title")
	subtitle = GameState.L("sub")

# глава уровня → тема (1-10 шахта, 11-20 глубокая шахта, 21-30 магма)
static func chapter_of(level: int) -> int:
	if level <= 10: return 1
	if level <= 20: return 2
	return 3
