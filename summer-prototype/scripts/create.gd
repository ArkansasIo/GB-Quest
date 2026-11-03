extends Node2D
## Character creation: race (15), class (27, nine to a row) and name, all from the exported data.

const Field = preload("res://scripts/field.gd")
const NAMES := ["ALDRIC", "BRYNN", "CORAL", "DASK", "ELORA", "FENN", "GRETA", "HOLT", "ISOLDE", "JORAH", "KAEL", "LYRA", "MORN", "NESSA", "ORIN", "PELL"]
var main: Node2D
var step_i := 0       # 0 race, 1 class, 2 name
var race_i := 0
var cls_i := 0
var name_i := 0
var typed := ""

func races() -> Array: return Data.game.get("SPECIES", {}).keys()
func classes() -> Array: return Data.game.get("CLASS_ORDER", [])

func step(_d: float) -> void:
	if step_i == 0:
		var n := races().size()
		if main.pressed("ui_up"): race_i = (race_i + n - 1) % n
		if main.pressed("ui_down"): race_i = (race_i + 1) % n
	elif step_i == 1:
		var n := classes().size()
		if main.pressed("ui_left"): cls_i = (cls_i + n - 1) % n
		if main.pressed("ui_right"): cls_i = (cls_i + 1) % n
		if main.pressed("ui_up"): cls_i = (cls_i + n - 9) % n
		if main.pressed("ui_down"): cls_i = (cls_i + 9) % n
	else:
		if main.pressed("ui_up") or main.pressed("ui_left"): name_i = (name_i + NAMES.size() - 1) % NAMES.size(); typed = ""
		if main.pressed("ui_down") or main.pressed("ui_right"): name_i = (name_i + 1) % NAMES.size(); typed = ""
	if main.pressed("ui_a") or main.pressed("ui_start"):
		if step_i < 2:
			step_i += 1
		else:
			Game.new_hero(typed if typed != "" else NAMES[name_i], classes()[cls_i], races()[race_i])
			Game.save()
			main.clear(); main.push(Field.new())
			main.say(["Welcome to AELMOOR, %s." % Game.hero["name"], "Walk with the arrows. Z talks and confirms, X goes back, ENTER opens the menu."])
	elif main.pressed("ui_b") and step_i > 0:
		step_i -= 1

func _unhandled_input(e: InputEvent) -> void:
	if step_i != 2 or not (e is InputEventKey) or not e.pressed: return
	var k := e as InputEventKey
	if k.keycode == KEY_BACKSPACE: typed = typed.substr(0, maxi(0, typed.length() - 1))
	elif k.unicode >= 65 and k.unicode <= 122 and typed.length() < 9 and char(k.unicode).to_upper() != "Z" and char(k.unicode).to_upper() != "X": typed += char(k.unicode).to_upper()

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(232, 236, 246))
	var titles := ["CHOOSE YOUR RACE", "CHOOSE YOUR CLASS", "CHOOSE YOUR NAME"]
	Data.text_c(self, titles[step_i], 320, 16, Data.INK)
	if step_i == 0:
		var L := races()
		var top := clampi(race_i - 5, 0, maxi(0, L.size() - 10))
		Data.panel(self, Rect2(8, 64, 264, 448))
		for k in range(top, mini(L.size(), top + 10)):
			var y := 88 + (k - top) * 42
			if k == race_i: draw_rect(Rect2(20, y - 4, 240, 40), Data.PANEL2.darkened(0.15))
			Data.text(self, Data.species(L[k]).get("name", L[k]).substr(0, 10), Vector2(32, y))
		var sp := Data.species(L[race_i])
		Data.panel(self, Rect2(280, 64, 352, 448))
		Data.blit_fit(self, Data.game.get("RACE_PORTRAITS", {}).get(L[race_i], ""), Rect2(300, 84, 140, 200))
		var asi := []
		for a in sp.get("asi", {}): asi.append("%s+%d" % [a, sp["asi"][a]])
		Data.text(self, " ".join(asi).substr(0, 13), Vector2(300, 300), Data.GOLD)
		_wrap(sp.get("desc", ""), Vector2(300, 344), 13, 4)
	elif step_i == 1:
		var C := classes()
		for k in range(C.size()):
			var x := 12 + (k % 9) * 68
			var y := 56 + int(k / 9) * 76
			if k == cls_i: draw_rect(Rect2(x - 4, y - 4, 72, 72), Data.EDGE)
			Data.blit_fit(self, "np_class_" + C[k], Rect2(x, y, 64, 64))
		var c := Data.cls(C[cls_i])
		Data.panel(self, Rect2(8, 300, 624, 268))
		Data.text(self, c.get("name", ""), Vector2(32, 324), Data.GOLD)
		Data.text_r(self, "%s D%d %s" % [str(c.get("role", "")).to_upper(), int(c.get("hd", 8)), c.get("primary", "")], 608, 324, Data.EDGE)
		_wrap(c.get("desc", ""), Vector2(32, 372), 24, 3)
		Data.text(self, ("CASTER " + str(c.get("cast"))) if c.get("caster") else "MARTIAL", Vector2(32, 500), Data.GREY)
	else:
		Data.panel(self, Rect2(80, 160, 480, 200))
		Data.text_c(self, typed if typed != "" else NAMES[name_i], 320, 220, Data.INK, 1.5)
		Data.text_c(self, "ARROWS: PICK  OR TYPE", 320, 300, Data.GREY, 0.75)
		Data.text_c(self, "%s %s" % [Data.species(races()[race_i]).get("name", ""), Data.cls(classes()[cls_i]).get("name", "")], 320, 420, Data.EDGE)
	Data.text_c(self, "Z: NEXT   X: BACK", 320, 536, Data.GREY, 0.75)

func _wrap(s: String, pos: Vector2, width: int, max_lines: int) -> void:
	var words := s.split(" ")
	var cur := ""
	var n := 0
	for w in words:
		if (cur + " " + w).strip_edges().length() > width:
			if n < max_lines: Data.text(self, cur.strip_edges(), pos + Vector2(0, n * 40))
			n += 1; cur = w
		else: cur += " " + w
	if n < max_lines and cur.strip_edges() != "": Data.text(self, cur.strip_edges(), pos + Vector2(0, n * 40))
