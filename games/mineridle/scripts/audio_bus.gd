extends Node
## AudioBus — процедурные звуки (без ассетов) + мьют во время рекламы.

var _muted := false
var _players: Array[AudioStreamPlayer] = []
const MAX_PLAYERS := 8

func _ready() -> void:
	for i in MAX_PLAYERS:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_players.append(p)

func mute(m: bool) -> void:
	_muted = m
	for p in _players:
		p.volume_db = -80.0 if m else 0.0

func _gen_tone(freq: float, dur: float, kind := "square") -> AudioStreamWAV:
	var rate := 22050
	var n := int(rate * dur)
	var data := PackedByteArray()
	data.resize(n)
	for i in n:
		var t := float(i) / rate
		var env := 1.0 - (t / dur)
		var s: float
		match kind:
			"square":
				s = sign(sin(TAU * freq * t))
			"noise":
				s = randf_range(-1.0, 1.0)
			"saw":
				s = 2.0 * fmod(freq * t, 1.0) - 1.0
			_:
				s = sin(TAU * freq * t)
		data[i] = int(clamp(s * env * 0.5, -1.0, 1.0) * 127.0) & 0xFF
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_8_BITS
	wav.mix_rate = rate
	wav.data = data
	return wav

func _play(wav: AudioStreamWAV, vol := 1.0) -> void:
	if _muted or not GameState.sound_on:
		return
	for p in _players:
		if not p.playing:
			p.stream = wav
			p.volume_db = linear_to_db(vol)
			p.play()
			return

# --- звуки кликера ---
func hit() -> void:      _play(_gen_tone(320, 0.06, "square"), 0.45)   # удар киркой
func crack() -> void:    _play(_gen_tone(160, 0.10, "noise"), 0.55)    # трещина камня
func crumble() -> void:  _play(_gen_tone(120, 0.20, "noise"), 0.65)    # камень развалился
func coin() -> void:     _play(_gen_tone(980, 0.07), 0.4)
func drill() -> void:    _play(_gen_tone(220, 0.12, "saw"), 0.4)       # бур
func laser() -> void:    _play(_gen_tone(1200, 0.10, "saw"), 0.35)     # лазер
func click() -> void:    _play(_gen_tone(440, 0.05), 0.4)
func buy() -> void:
	_play(_gen_tone(700, 0.08), 0.5)
	await get_tree().create_timer(0.08).timeout
	_play(_gen_tone(1050, 0.10), 0.55)
func unlock() -> void:   # открытие нового предмета (фанфар)
	_play(_gen_tone(523, 0.10), 0.5)
	await get_tree().create_timer(0.10).timeout
	_play(_gen_tone(659, 0.10), 0.5)
	await get_tree().create_timer(0.10).timeout
	_play(_gen_tone(784, 0.16), 0.6)
func win() -> void:
	_play(_gen_tone(660, 0.10), 0.5)
	await get_tree().create_timer(0.1).timeout
	_play(_gen_tone(880, 0.14), 0.6)
func fail() -> void:     _play(_gen_tone(140, 0.30, "noise"), 0.6)     # босс не пройден
func level_up() -> void:
	_play(_gen_tone(523, 0.09), 0.5)
	await get_tree().create_timer(0.09).timeout
	_play(_gen_tone(1046, 0.14), 0.6)
