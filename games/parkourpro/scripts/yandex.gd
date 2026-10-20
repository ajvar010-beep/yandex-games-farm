extends Node
## Yandex SDK bridge — работает в браузере (Web export), иначе заглушки.

var _sdk_ready := false
var _adv_cb_on: Callable
var _adv_cb_off: Callable
var _rv_reward_cb: Callable
var _save_data: Dictionary = {}
var _js_cb_reward: JavaScriptObject
var _js_cb_close: JavaScriptObject

func _ready() -> void:
	if Engine.has_singleton("JavaScriptBridge") and OS.has_feature("web"):
		_setup_js_callbacks()
		# SDK инициализируется асинхронно — помечаем готовность лениво
		_check_ready()

func _check_ready() -> void:
	if not OS.has_feature("web"): return
	var js = JavaScriptBridge.get_interface("window")
	if js and js.ysdk != null:
		_sdk_ready = true
	else:
		await get_tree().create_timer(0.5).timeout
		_check_ready()

func is_ready() -> bool:
	return _sdk_ready

func _setup_js_callbacks() -> void:
	_js_cb_reward = JavaScriptBridge.create_callback(_on_rv_reward)
	_js_cb_close = JavaScriptBridge.create_callback(_on_rv_close)

func gameplay_start() -> void:
	if not _sdk_ready: return
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.features != null and js.ysdk.features.GameplayAPI != null:
		js.ysdk.features.GameplayAPI.start()

func gameplay_stop() -> void:
	if not _sdk_ready: return
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.features != null and js.ysdk.features.GameplayAPI != null:
		js.ysdk.features.GameplayAPI.stop()

# ---------- реклама ----------

func show_fullscreen(on_closed: Callable = Callable()) -> void:
	_adv_cb_off = on_closed
	if not _sdk_ready:
		if on_closed.is_valid(): on_closed.call()
		return
	AudioBus.mute(true)
	var js = JavaScriptBridge.get_interface("window")
	var opts = js.Object.create()
	opts.callbacks = js.Object.create()
	opts.callbacks.onClose = JavaScriptBridge.create_callback(func(wasShown):
		AudioBus.mute(false)
		if _adv_cb_off.is_valid(): _adv_cb_off.call())
	opts.callbacks.onError = JavaScriptBridge.create_callback(func(e):
		AudioBus.mute(false)
		if _adv_cb_off.is_valid(): _adv_cb_off.call())
	js.ysdk.adv.showFullscreenAdv(opts)

func show_rewarded(on_reward: Callable) -> void:
	_rv_reward_cb = on_reward
	if not _sdk_ready:
		# вне браузера — сразу награда (для отладки)
		on_reward.call()
		return
	AudioBus.mute(true)
	var js = JavaScriptBridge.get_interface("window")
	var opts = js.Object.create()
	opts.callbacks = js.Object.create()
	opts.callbacks.onRewarded = _js_cb_reward
	opts.callbacks.onClose = _js_cb_close
	opts.callbacks.onError = JavaScriptBridge.create_callback(func(e):
		AudioBus.mute(false))
	js.ysdk.adv.showRewardedVideo(opts)

func _on_rv_reward(_args) -> void:
	if _rv_reward_cb.is_valid():
		_rv_reward_cb.call()

func _on_rv_close(_args) -> void:
	AudioBus.mute(false)

# ---------- облако ----------

func save(data: Dictionary) -> void:
	_save_data = data
	if not _sdk_ready: return
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.player != null:
		js.ysdk.player.setData(js.JSON.parse(JSON.stringify(data)))

func load_from_cloud() -> void:
	if not _sdk_ready: return
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.player != null:
		var p = js.ysdk.player.getData()
		# TODO: промис — в 4.7 JavaScriptBridge не даёт await нативно; используем локальный save как основу
		pass

func get_save_data() -> Dictionary:
	return _save_data
