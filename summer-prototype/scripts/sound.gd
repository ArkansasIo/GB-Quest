extends Node
## Autoload "Sound": the browser game's chip music and SFX, rendered to WAVs by tools/export_godot.cjs (audio/).
## Music loops per zone (zone "music", or MUSIC_BY_BIOME), battle / boss / victory / defeat themes; SFX by name (SFX_BANK).
## Volumes 0-3 like the browser's settings (S.music, S.vol), saved in user://settings.cfg with the UI theme.

var music_vol := 2
var sfx_vol := 3
var _music: AudioStreamPlayer
var _sfx: Array = []
var _cache: Dictionary = {}
var cur := ""

func _ready() -> void:
	_music = AudioStreamPlayer.new()
	add_child(_music)
	for i in range(6):
		var p := AudioStreamPlayer.new()
		add_child(p)
		_sfx.append(p)
	var c := ConfigFile.new()
	if c.load("user://settings.cfg") == OK:
		music_vol = int(c.get_value("audio", "music", music_vol))
		sfx_vol = int(c.get_value("audio", "sfx", sfx_vol))
	_apply()

func save_settings() -> void:
	var c := ConfigFile.new()
	c.load("user://settings.cfg")
	c.set_value("audio", "music", music_vol)
	c.set_value("audio", "sfx", sfx_vol)
	c.save("user://settings.cfg")
	_apply()

func _apply() -> void:
	_music.volume_db = linear_to_db(music_vol / 3.0) if music_vol > 0 else -80.0
	for p in _sfx: p.volume_db = linear_to_db(sfx_vol / 3.0) if sfx_vol > 0 else -80.0

## an AudioStreamWAV from audio/<name>.wav: the imported resource when there is one, else the raw file (16-bit mono PCM)
func _stream(name: String, loop: bool) -> AudioStreamWAV:
	if _cache.has(name): return _cache[name]
	var path := "res://audio/%s.wav" % name
	var st: AudioStreamWAV = null
	if ResourceLoader.exists(path):
		st = load(path) as AudioStreamWAV
	elif FileAccess.file_exists(path):
		var b := FileAccess.get_file_as_bytes(path)
		if b.size() > 44:
			st = AudioStreamWAV.new()
			st.format = AudioStreamWAV.FORMAT_16_BITS
			st.mix_rate = b.decode_u32(24)
			st.stereo = false
			st.data = b.slice(44)
	if st and loop:
		st.loop_mode = AudioStreamWAV.LOOP_FORWARD
		st.loop_begin = 0
		st.loop_end = st.data.size() / 2
	_cache[name] = st
	return st

func music(id: String) -> void:
	if id == cur: return
	cur = id
	var jingle := id in ["victory", "defeat", "boot"]
	var st := _stream("music_" + id, not jingle)
	if st == null:
		_music.stop(); return
	_music.stream = st
	_music.play()

func stop_music() -> void:
	cur = ""
	_music.stop()

## the zone's track: the zone's own music name, else its biome's
func zone_music(z: Dictionary) -> void:
	if z.has("dungeon"):
		music("raid" if z.get("raid", false) else "dungeon"); return
	var m := str(z.get("music", ""))
	if m == "" or not Data.game.get("SONGS", {}).has(m):
		m = str(Data.game.get("MUSIC_BY_BIOME", {}).get(str(z.get("biome", "meadow")), "field"))
	music(m)

func sfx(id: String) -> void:
	if sfx_vol <= 0: return
	var st := _stream("sfx_" + id, false)
	if st == null: return
	for p in _sfx:
		if not p.playing:
			p.stream = st; p.play(); return
	_sfx[0].stream = st
	_sfx[0].play()
