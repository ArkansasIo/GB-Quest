extends Node2D
## Title screen: NEW GAME / CONTINUE.

const Create = preload("res://scripts/create.gd")
const Field = preload("res://scripts/field.gd")
var main: Node2D
var i := 0
var t := 0.0

func opts() -> Array:
	return ["NEW GAME", "CONTINUE"] if Game.has_save() else ["NEW GAME"]

func step(delta: float) -> void:
	t += delta
	var n := opts().size()
	if main.pressed("ui_up"): i = (i + n - 1) % n
	if main.pressed("ui_down"): i = (i + 1) % n
	if main.pressed("ui_a") or main.pressed("ui_start"):
		if opts()[i] == "CONTINUE" and Game.load_save():
			main.clear(); main.push(Field.new())
		else:
			main.clear(); main.push(Create.new())

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	for k in range(40):
		var sx := float((k * 97) % 640)
		var sy := float((k * 53) % 300)
		draw_rect(Rect2(sx, sy, 4, 4), Color(1, 1, 1, 0.35 + 0.3 * sin(t * 2.0 + k)))
	Data.text_c(self, "LOST KINGDOM", 320, 96, Data.GOLD, 1.5)
	Data.text_c(self, "OF SHADOWBANE", 320, 160, Data.GOLD, 1.5)
	Data.text_c(self, "CHRONICLES", 320, 224, Data.PANEL, 1.0)
	Data.blit_fit(self, "gh_warden_down0", Rect2(288, 280, 64, 64))
	var o := opts()
	Data.panel(self, Rect2(176, 372, 288, 40 + o.size() * 48))
	for k in range(o.size()):
		var y := 392 + k * 48
		Data.text(self, o[k], Vector2(240, y))
		if k == i:
			draw_colored_polygon(PackedVector2Array([Vector2(208, y + 4), Vector2(224, y + 18), Vector2(208, y + 32)]), Data.INK)
	Data.text_c(self, "Z:A  X:B  ENTER:START", 320, 530, Data.GREY, 0.75)
