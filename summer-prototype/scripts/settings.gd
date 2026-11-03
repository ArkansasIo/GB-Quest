extends Node2D
## SETTINGS: music and sound volume (0-3, as the browser's S.music / S.vol) and the UI theme
## (CLASSIC, MMO, CRIMSON, SANCTUM, DIABLO). LEFT/RIGHT changes the selected row; B closes. Saved to user://settings.cfg.

var main: Node2D
var i := 0
const ROWS := ["MUSIC", "SOUND", "UI THEME"]

func step(_d: float) -> void:
	if main.pressed("ui_up"): i = (i + 2) % 3
	if main.pressed("ui_down"): i = (i + 1) % 3
	var d := 0
	if main.pressed("ui_left"): d = -1
	if main.pressed("ui_right") or main.pressed("ui_a"): d = 1
	if d != 0:
		match i:
			0: Sound.music_vol = clampi(Sound.music_vol + d, 0, 3); Sound.save_settings()
			1: Sound.sfx_vol = clampi(Sound.sfx_vol + d, 0, 3); Sound.save_settings(); Sound.sfx("cursor")
			2:
				var ids: Array = Data.THEMES.keys()
				Data.set_theme(ids[(ids.find(Data.theme) + d + ids.size()) % ids.size()])
		Sound.sfx("select")
	if main.pressed("ui_b"): main.pop(self)

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	Data.panel(self, Rect2(8, 8, 624, 72))
	Data.text_c(self, "SETTINGS", 320, 26, Data.EDGE)
	Data.panel(self, Rect2(8, 96, 624, 220))
	var vals := ["%d/3" % Sound.music_vol, "%d/3" % Sound.sfx_vol, str(Data.THEMES[Data.theme]["name"])]
	for k in range(3):
		var y := 124 + k * 60
		Data.text(self, ROWS[k], Vector2(72, y))
		Data.text_r(self, "< %s >" % vals[k], 600, y, Data.EDGE)
		if k == i: draw_colored_polygon(PackedVector2Array([Vector2(36, y + 4), Vector2(52, y + 18), Vector2(36, y + 32)]), Data.INK)
	# a preview of the theme: a panel, a bar and some text
	Data.panel(self, Rect2(8, 332, 624, 150))
	Data.text(self, "THE LANTERN BURNS ON.", Vector2(32, 356))
	Data.bar(self, Rect2(32, 412, 300, 22), 0.7, Data.HP_RED)
	Data.text(self, "HP 70/100", Vector2(352, 408), Data.EDGE, 0.75)
	Data.text(self, "<> CHANGE   B BACK", Vector2(24, 540), Data.GREY, 0.6)
