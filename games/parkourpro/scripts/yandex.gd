extends Node
## Yandex SDK bridge — работает в браузере (Web export), иначе заглушки.

signal sdk_ready  # window.ysdk создан — можно дёргать player/payments/leaderboards

var _sdk_ready := false
var _adv_cb_off: Callable
var _rv_reward_cb: Callable
var _rv_fail_cb: Callable
var _rv_rewarded := false
var _save_data: Dictionary = {}
var _js_cb_reward: JavaScriptObject
var _js_cb_close: JavaScriptObject
# кэши промис-объектов SDK
var _player = null
var _payments = null
var _lb = null
var _loading_done := false

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
		# 1.19.2: LoadingAPI.ready() ОБЯЗАТЕЛЕН — без него модерация отказывает
		if js.ysdk.features != null and js.ysdk.features.LoadingAPI != null and not _loading_done:
			js.ysdk.features.LoadingAPI.ready()
			_loading_done = true
		# автоопределение языка (п. 2.14) — эмитит lang_changed, меню перестроится
		if js.ysdk.environment != null:
			GameState.set_lang(str(js.ysdk.environment.i18n.lang))
		# промис-объекты кэшируем; sdk_ready эмитим, когда все резолвнулись
		_fetch_sdk_objects()
	else:
		await get_tree().create_timer(0.5).timeout
		_check_ready()

var _pending := 0

func _fetch_sdk_objects() -> void:
	var js = JavaScriptBridge.get_interface("window")
	_pending = 3
	# ВАЖНО: .catch() обязателен на КАЖДОМ геттере — иначе при реджекте
	# (getPayments для анонимов, getLeaderboards без настроенных ЛБ) _settle не
	# вызывается, _pending не доходит до 0 и sdk_ready не эмитится (restore/облако мертвы).
	if js.ysdk.getPlayer != null:
		js.ysdk.getPlayer().then(JavaScriptBridge.create_callback(func(args):
			if args.size() > 0: _player = args[0]
			_settle())).catch(JavaScriptBridge.create_callback(func(_e): _settle()))
	else:
		_settle()
	if js.ysdk.getPayments != null:
		js.ysdk.getPayments().then(JavaScriptBridge.create_callback(func(args):
			if args.size() > 0: _payments = args[0]
			_settle())).catch(JavaScriptBridge.create_callback(func(_e): _settle()))
	else:
		_settle()
	if js.ysdk.getLeaderboards != null:
		js.ysdk.getLeaderboards().then(JavaScriptBridge.create_callback(func(args):
			if args.size() > 0: _lb = args[0]
			_settle())).catch(JavaScriptBridge.create_callback(func(_e): _settle()))
	else:
		_settle()

func _settle() -> void:
	_pending -= 1
	if _pending <= 0:
		sdk_ready.emit()

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
		# вне Яндекса рекламы нет — просто продолжаем
		if on_closed.is_valid(): on_closed.call()
		return
	AudioBus.mute(true)
	gameplay_stop()
	var js = JavaScriptBridge.get_interface("window")
	# ВАЖНО: Object.create() без аргумента бросает TypeError в JS-движке;
	# JavaScriptBridge.create_object("Object") = new Object() = {} (документированный API)
	var opts = JavaScriptBridge.create_object("Object")
	opts.callbacks = JavaScriptBridge.create_object("Object")
	opts.callbacks.onClose = JavaScriptBridge.create_callback(func(wasShown):
		AudioBus.mute(false)
		gameplay_start()
		if _adv_cb_off.is_valid(): _adv_cb_off.call())
	opts.callbacks.onError = JavaScriptBridge.create_callback(func(e):
		AudioBus.mute(false)
		gameplay_start()
		if _adv_cb_off.is_valid(): _adv_cb_off.call())
	js.ysdk.adv.showFullscreenAdv(opts)

func show_rewarded(on_reward: Callable, on_fail: Callable = Callable()) -> void:
	_rv_reward_cb = on_reward
	_rv_fail_cb = on_fail
	_rv_rewarded = false
	if not _sdk_ready:
		# награда без видео — ТОЛЬКО в debug-сборке (иначе экономика ломается)
		if OS.is_debug_build():
			on_reward.call()
		elif on_fail.is_valid():
			on_fail.call()
		return
	AudioBus.mute(true)
	gameplay_stop()
	var js = JavaScriptBridge.get_interface("window")
	var opts = JavaScriptBridge.create_object("Object")
	opts.callbacks = JavaScriptBridge.create_object("Object")
	opts.callbacks.onRewarded = _js_cb_reward
	opts.callbacks.onClose = _js_cb_close
	opts.callbacks.onError = JavaScriptBridge.create_callback(func(e):
		AudioBus.mute(false)
		gameplay_start()
		if not _rv_rewarded and _rv_fail_cb.is_valid(): _rv_fail_cb.call())
	js.ysdk.adv.showRewardedVideo(opts)

func _on_rv_reward(_args) -> void:
	_rv_rewarded = true
	if _rv_reward_cb.is_valid():
		_rv_reward_cb.call()

func _on_rv_close(_args) -> void:
	AudioBus.mute(false)
	gameplay_start()

# ---------- облако ----------

func save(data: Dictionary) -> void:
	_save_data = data
	if not _sdk_ready or _player == null: return
	var js = JavaScriptBridge.get_interface("window")
	_player.setData(js.JSON.parse(JSON.stringify(data)))

func load_from_cloud(on_loaded: Callable = Callable()) -> void:
	if not _sdk_ready or _player == null:
		if on_loaded.is_valid(): on_loaded.call({})
		return
	var js = JavaScriptBridge.get_interface("window")
	_player.getData().then(JavaScriptBridge.create_callback(func(args):
		var dict := {}
		if args.size() > 0 and args[0] != null:
			var s: String = str(js.JSON.stringify(args[0]))
			var parsed = JSON.parse_string(s)
			if parsed is Dictionary: dict = parsed
		_save_data = dict
		if on_loaded.is_valid(): on_loaded.call(dict)
	)).catch(JavaScriptBridge.create_callback(func(e):
		if on_loaded.is_valid(): on_loaded.call({})))

func get_save_data() -> Dictionary:
	return _save_data

# ---------- IAP (Yandex Payments) ----------

# id расходников (consume после покупки — иначе повторная покупка падает)
const CONSUMABLES := ["coins_500", "coins_1500"]

func purchase(product_id: String, on_ok: Callable, on_fail: Callable = Callable()) -> void:
	if not _sdk_ready or _payments == null:
		# фейк-успех — ТОЛЬКО в debug (иначе бесплатные монеты в проде)
		if OS.is_debug_build():
			on_ok.call()
		elif on_fail.is_valid():
			on_fail.call()
		return
	_payments.purchase({"id": product_id}).then(
		JavaScriptBridge.create_callback(func(args):
			# расходник — consume, чтобы можно было покупать повторно
			if product_id in CONSUMABLES and args.size() > 0 and args[0] != null:
				var token: String = str(args[0].purchaseToken)
				if token != "" and token != "null":
					_payments.consumePurchase(token)
			on_ok.call())
	).catch(
		JavaScriptBridge.create_callback(func(e):
			if on_fail.is_valid(): on_fail.call())
	)

func get_purchases(on_list: Callable) -> void:
	if not _sdk_ready or _payments == null:
		on_list.call([])
		return
	_payments.getPurchases().then(
		JavaScriptBridge.create_callback(func(r): on_list.call(r))
	).catch(JavaScriptBridge.create_callback(func(e): on_list.call([])))

# ---------- Лидерборды ----------

func submit_score(name: String, score: int) -> void:
	if not _sdk_ready or _lb == null: return
	_lb.setScore(name, score)

func get_leaderboard(name: String, on_data: Callable) -> void:
	if not _sdk_ready or _lb == null:
		on_data.call(null)
		return
	_lb.getEntries(name, {"quantityTop": 10, "includeUser": true}).then(
		JavaScriptBridge.create_callback(func(r): on_data.call(r))
	).catch(JavaScriptBridge.create_callback(func(e): on_data.call(null)))
