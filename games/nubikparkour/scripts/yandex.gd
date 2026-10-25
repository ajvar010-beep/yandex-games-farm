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
var _js_int_close: JavaScriptObject
var _js_int_err: JavaScriptObject
var _js_cb_err: JavaScriptObject
var _js_lb_err: JavaScriptObject
var _rv_settled := false  # reward ИЛИ fail уже доставлен — не вызывать fail дважды (onError→onClose)
var _paused_by_adv := false  # v9.1: мы поставили дерево на паузу ради fullscreen-рекламы
var _in_menu := true  # v9.4: сейчас меню — gameplay_start() не должен срабатывать (late ad-колбэк)

func set_in_menu(v: bool) -> void:
	_in_menu = v
# v8.1 (консилиум v8 #9): ВСЕ async-колбэки SDK должны ЖИТЬ до резолва промиса.
# JavaScriptObject — RefCounted: inline-темпарарь освобождается в конце statement,
# а .then/.catch/onClose/onError срабатывают на следующем тике → get_proxied_value(id)
# возвращает undefined → тело колбэка НИКОГДА не выполняется (IAP/restore/облако/
# лидерборд/sdk_ready/unmute мертвы в реальном Web-билде). Держим вечные ссылки здесь.
var _live_cbs: Array[JavaScriptObject] = []
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
		js.ysdk.getPlayer().then(_cb(func(args):
			if args.size() > 0: _player = args[0]
			_settle())).catch(_cb(func(_e): _settle()))
	else:
		_settle()
	if js.ysdk.getPayments != null:
		js.ysdk.getPayments().then(_cb(func(args):
			if args.size() > 0: _payments = args[0]
			_settle())).catch(_cb(func(_e): _settle()))
	else:
		_settle()
	if js.ysdk.getLeaderboards != null:
		js.ysdk.getLeaderboards().then(_cb(func(args):
			if args.size() > 0: _lb = args[0]
			_settle())).catch(_cb(func(_e): _settle()))
	else:
		_settle()

func _settle() -> void:
	_pending -= 1
	if _pending <= 0:
		sdk_ready.emit()

func is_ready() -> bool:
	return _sdk_ready

func _setup_js_callbacks() -> void:
	_js_cb_reward = _cb(_on_rv_reward)
	_js_cb_close = _cb(_on_rv_close)
	# v8.3 (консилиум v8.2, критик-код MAJOR): колбэки интерстишиала создавались
	# _cb() на КАЖДЫЙ показ → _live_cbs рос навсегда (2 объекта/показ). Создаём
	# один раз; per-call логика читает _adv_cb_off в момент вызова.
	_js_int_close = _cb(func(_args): _on_adv_done())
	_js_int_err = _cb(func(_args): _on_adv_done())
	_js_cb_err = _cb(_on_rv_error)
	_js_lb_err = _cb(func(_e): pass)

func _on_adv_done() -> void:
	# v9.1: снять паузу, поставленную в show_fullscreen (симметрично)
	if _paused_by_adv:
		_paused_by_adv = false
		get_tree().paused = false
	AudioBus.mute(false)
	gameplay_start()
	var cb := _adv_cb_off
	_adv_cb_off = Callable()  # v8.3 minor: сброс — onError+onClose не дёргают дважды
	if cb.is_valid(): cb.call()

# создаёт JS-колбэк И удерживает ссылку до конца жизни autoload'а (см. _live_cbs).
# Без этого async-колбэк освобождается до резолва промиса и не вызывается вообще.
func _cb(fn: Callable) -> JavaScriptObject:
	var obj := JavaScriptBridge.create_callback(fn)
	_live_cbs.append(obj)
	return obj

func gameplay_start() -> void:
	# v9.4 (консилиум v9.2 minor): гейт от late-вызова. Если игрок вышел в меню
	# во время fullscreen-рекламы, запаздывающий onClose (_on_adv_done) дёргал
	# gameplay_start() уже В МЕНЮ → GameplayAPI оставался «started» (нарушение
	# спеки: в меню геймплей должен быть остановлен). main.gd управляет флагом.
	if _in_menu: return
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
	# v9.2 (консилиум v9.1 minor): guard на js.ysdk.adv ДО паузы/mute — иначе
	# синхронный throw (adv undefined) оставлял дерево на паузе БЕЗ единого
	# колбэка = жёсткий софтлок (регресс фикса №2: до паузы throw просто ронял
	# показ, игра продолжалась). По образцу show_banner.
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.adv == null or js.ysdk.adv.showFullscreenAdv == null:
		_adv_cb_off = Callable()  # не оставлять висеть — late-колбэк не должен дублить
		if on_closed.is_valid(): on_closed.call()
		return
	AudioBus.mute(true)
	gameplay_stop()
	# v9.1 (консилиум v9, критик-монетизация MAJOR): спека 4.7 — во время
	# fullscreen-рекламы звук И геймплей НА ПАУЗЕ. Звук глушился, но симуляция
	# жила → спидран-таймер накручивался за 15-30с рекламы, сжигая звёзды и
	# лидерборд-скор на каждом ad-переходе. UI-панели PROCESS_MODE_ALWAYS —
	# кнопки продолжают работать под паузой.
	if not get_tree().paused:
		_paused_by_adv = true
		get_tree().paused = true
	# ВАЖНО: Object.create() без аргумента бросает TypeError в JS-движке;
	# JavaScriptBridge.create_object("Object") = new Object() = {} (документированный API)
	var opts = JavaScriptBridge.create_object("Object")
	opts.callbacks = JavaScriptBridge.create_object("Object")
	opts.callbacks.onClose = _js_int_close
	opts.callbacks.onError = _js_int_err
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
	# v9.2: симметричный guard — throw на showRewardedVideo без него оставлял бы
	# игрока с замьюченным звуком, остановленным GameplayAPI и без fail-колбэка.
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.adv == null or js.ysdk.adv.showRewardedVideo == null:
		_rv_settled = true
		if on_fail.is_valid(): on_fail.call()
		return
	AudioBus.mute(true)
	gameplay_stop()
	_rv_settled = false
	var opts = JavaScriptBridge.create_object("Object")
	opts.callbacks = JavaScriptBridge.create_object("Object")
	opts.callbacks.onRewarded = _js_cb_reward
	opts.callbacks.onClose = _js_cb_close
	opts.callbacks.onError = _js_cb_err
	js.ysdk.adv.showRewardedVideo(opts)

func _on_rv_reward(_args) -> void:
	_rv_rewarded = true
	_rv_settled = true
	if _rv_reward_cb.is_valid():
		_rv_reward_cb.call()

func _on_rv_error(_args) -> void:
	AudioBus.mute(false)
	gameplay_start()
	_settle_rv_fail()

func _on_rv_close(_args) -> void:
	AudioBus.mute(false)
	gameplay_start()
	_settle_rv_fail()

# v8.3 (консилиум v8.2, критик-монетизация MAJOR): закрытие БЕЗ onRewarded —
# штатная ситуация SDK (зритель закрыл раньше порога). Без fail-колбэка панель
# смерти/победы уже скрыта, _running=false → игрок без UI. Возвращаем панель.
# _rv_settled: onError→onClose не должны дёргать fail дважды (панель ×2).
func _settle_rv_fail() -> void:
	if _rv_settled: return
	_rv_settled = true
	if _rv_fail_cb.is_valid():
		_rv_fail_cb.call()

# ---------- баннер (пассивный доход в меню) ----------

func show_banner() -> void:
	if not _sdk_ready or GameState.no_ads: return
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.adv != null and js.ysdk.adv.showBannerAdv != null:
		js.ysdk.adv.showBannerAdv()

func hide_banner() -> void:
	if not _sdk_ready: return
	var js = JavaScriptBridge.get_interface("window")
	if js.ysdk.adv != null and js.ysdk.adv.hideBannerAdv != null:
		js.ysdk.adv.hideBannerAdv()

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
	_player.getData().then(_cb(func(args):
		var dict := {}
		if args.size() > 0 and args[0] != null:
			var s: String = str(js.JSON.stringify(args[0]))
			var parsed = JSON.parse_string(s)
			if parsed is Dictionary: dict = parsed
		_save_data = dict
		if on_loaded.is_valid(): on_loaded.call(dict)
	)).catch(_cb(func(e):
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
		_cb(func(args):
			# расходник — consume, чтобы можно было покупать повторно
			if product_id in CONSUMABLES and args.size() > 0 and args[0] != null:
				var token: String = str(args[0].purchaseToken)
				if token != "" and token != "null":
					_payments.consumePurchase(token)
			on_ok.call())
	).catch(
		_cb(func(e):
			if on_fail.is_valid(): on_fail.call())
	)

func get_purchases(on_list: Callable) -> void:
	if not _sdk_ready or _payments == null:
		on_list.call([])
		return
	_payments.getPurchases().then(
		_cb(func(r): on_list.call(r))
	).catch(_cb(func(e): on_list.call([])))

# ---------- Лидерборды ----------

func submit_score(name: String, score: int) -> void:
	if not _sdk_ready or _lb == null: return
	# v9.1 (консилиум v8.2, критик-код minor): .catch обязателен — без него
	# реджект setScore (ЛБ не настроены/аноним) = unhandled rejection в консоли.
	_lb.setScore(name, score).catch(_js_lb_err)

func get_leaderboard(name: String, on_data: Callable) -> void:
	if not _sdk_ready or _lb == null:
		on_data.call(null)
		return
	_lb.getEntries(name, {"quantityTop": 10, "includeUser": true}).then(
		_cb(func(r): on_data.call(r))
	).catch(_cb(func(e): on_data.call(null)))
