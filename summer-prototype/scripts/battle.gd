extends Node2D
## Turn-based battle in the handheld layout: HP boxes at the top, foe on the right, hero on the left, menu at the bottom.
## Rules follow the browser game's 5e core: d20 + bonus vs AC, natural 20 crits, spell attacks, XP and level-ups.

var main: Node2D
var foe_def: Dictionary = {}
var foe_lvl := 1
var biome := "meadow"
var foe: Dictionary = {}
var state := "menu"     # menu, msg, over
var msgs: Array = []
var shown := 0.0
var sel := 0
var shake := 0.0
var then: Callable = Callable()
var boss := false               # dungeon floor bosses: more HP, XP and gold, and a sure drop
var on_win: Callable = Callable()
const SKY := {"meadow": [Color8(118, 188, 240), Color8(148, 204, 104)], "coast": [Color8(104, 180, 236), Color8(232, 214, 156)], "marsh": [Color8(146, 168, 160), Color8(118, 140, 96)],
	"jungle": [Color8(128, 198, 168), Color8(96, 160, 76)], "snow": [Color8(176, 202, 236), Color8(236, 242, 248)], "badlands": [Color8(238, 180, 120), Color8(214, 160, 106)],
	"volcanic": [Color8(64, 36, 48), Color8(86, 64, 58)], "dusk": [Color8(54, 46, 88), Color8(86, 78, 104)], "crystal": [Color8(140, 196, 232), Color8(176, 206, 224)]}

func _ready() -> void:
	var blk := Data.monster_block(foe_lvl)
	foe = {"name": str(foe_def.get("name", "FOE")).substr(0, 12), "art": foe_def.get("art", ""), "lvl": foe_lvl, "hp": int(blk.get("hp", 10)), "max": int(blk.get("hp", 10)),
		"ac": int(blk.get("ac", 12)), "hit": int(blk.get("hit", 3)), "dice": str(blk.get("dice", "1d6")), "xp": int(blk.get("xp", 10)), "gold": int(blk.get("gold", 3)), "dt": foe_def.get("dt", "slashing")}
	if boss:
		foe["max"] = int(foe["max"]) * 3; foe["hp"] = foe["max"]; foe["xp"] = int(foe["xp"]) * 4; foe["gold"] = int(foe["gold"]) * 6 + 20
		foe["ac"] = int(foe["ac"]) + 1; foe["hit"] = int(foe["hit"]) + 1
		foe["name"] = str(foe_def.get("name", "BOSS")).substr(0, 14)
		_say(["%s blocks the way! (BOSS LV%d)" % [foe["name"], foe_lvl]])
		return
	_say(["A wild %s appears! (LV%d)" % [foe["name"], foe_lvl]])

func options() -> Array:
	var o := ["ATTACK"]
	if Game.is_caster() and Game.known_spells().size(): o.append("SPELL")
	o.append_array(["POTION x%d" % int(Game.hero["potions"]), "RUN"])
	return o

func _say(lines: Array, cb: Callable = Callable()) -> void:
	msgs = lines.duplicate(); shown = 0; state = "msg"; then = cb

func step(delta: float) -> void:
	if shake > 0: shake -= delta
	if state == "msg":
		var cur: String = msgs[0]
		if shown < cur.length():
			shown += delta * 90
			if main.pressed("ui_a"): shown = cur.length()
			return
		if main.pressed("ui_a") or main.pressed("ui_b"):
			msgs.pop_front(); shown = 0
			if msgs.is_empty():
				state = "menu"
				if then.is_valid():
					var c := then
					then = Callable()
					c.call()
		return
	if state != "menu": return
	var o := options()
	if main.pressed("ui_up") or main.pressed("ui_left"): sel = (sel + o.size() - 1) % o.size()
	if main.pressed("ui_down") or main.pressed("ui_right"): sel = (sel + 1) % o.size()
	if main.pressed("ui_a"): _act(str(o[sel]))

func _act(o: String) -> void:
	var out := []
	if o == "ATTACK":
		var r := Game.d20()
		var tot := r + Game.attack_bonus()
		if r == 20 or (r != 1 and tot >= int(foe["ac"])):
			var dmg := Game.weapon_damage(r == 20)
			foe["hp"] = int(foe["hp"]) - dmg; shake = 0.25
			out.append(("CRITICAL! " if r == 20 else "") + "You hit for %d. (d20 %d+%d)" % [dmg, r, Game.attack_bonus()])
		else:
			out.append("You miss. (d20 %d+%d vs AC %d)" % [r, Game.attack_bonus(), int(foe["ac"])])
	elif o == "SPELL":
		var sp: Array = Game.known_spells()
		var names := []
		for s in sp:
			names.append(str(s["name"]).substr(0, 18))
		main.choose(names, Callable(self, "_cast"), "Cast which spell?")
		return
	elif o.begins_with("POTION"):
		if int(Game.hero["potions"]) <= 0: _say(["No potions left."]); return
		Game.hero["potions"] = int(Game.hero["potions"]) - 1; var h := Game.roll("2d4+2") + int(Game.hero["lvl"]) / 5
		Game.hero["hp"] = mini(Game.hp_max(), int(Game.hero["hp"]) + h); out.append("You drink a potion: +%d HP." % h)
	elif o == "RUN":
		if boss:
			_say(["There is no escape from %s!" % foe["name"]])
			return
		if Game.d20() + Game.mod("DEX") >= 10:
			_say(["You got away safely."], Callable(self, "_leave"))
			return
		out.append("You couldn't escape!")
	_after(out)

func _cast(k: int) -> void:
	if k < 0:
		return
	var s: Dictionary = Game.known_spells()[k]
	var dmg := maxi(1, Game.roll(str(s.get("dice", "1d8"))) + Game.mod(str(Data.cls(Game.hero["cls"]).get("cast", "INT"))))
	var saved: bool = s.get("save") != null and Game.d20() + int(foe["lvl"]) / 4 >= Game.spell_dc()
	if saved and s.get("half", false):
		dmg = int(dmg / 2)
	elif saved:
		dmg = 0
	foe["hp"] = int(foe["hp"]) - dmg
	shake = 0.25
	_after(["You cast %s: %d %s damage." % [s["name"], dmg, s.get("dt", "")] if dmg else "%s resists %s." % [foe["name"], s["name"]]])

func _leave() -> void:
	main.pop(self)

func _won() -> void:
	main.pop(self)
	if on_win.is_valid():
		on_win.call()
	Game.save()

func _died() -> void:
	Game.hero["hp"] = Game.hp_max()
	Game.hero["gold"] = int(Game.hero["gold"]) / 2
	Game.dun = {}
	Game.zone_id = "elderwood"
	Game.pos = Vector2i(3, 8)
	Game.save()
	main.clear()
	main.push(load("res://scripts/field.gd").new())

func _after(out: Array) -> void:
	if int(foe["hp"]) <= 0:
		var ups := Game.gain_xp(int(foe["xp"]))
		Game.hero["gold"] = int(Game.hero["gold"]) + int(foe["gold"]); Game.hero["kills"] = int(Game.hero.get("kills", 0)) + 1
		out.append_array(["%s is defeated!" % foe["name"], "Got %d XP and %d G." % [int(foe["xp"]), int(foe["gold"])]])
		if ups: out.append("LEVEL UP! You are now level %d." % int(Game.hero["lvl"]))
		if boss or Game.rng.randf() < 0.2 + int(foe["lvl"]) / 400.0:
			var it := Game.random_drop(int(foe["lvl"]))
			if boss: it["r"] = mini(8, int(it["r"]) + 2); it["plus"] = maxi(0, int(Data.game["RARITY"][it["r"]].get("plus", 0)))
			Game.bag().append(it)
			out.append("Found %s!" % Game.item_name(it))
		state = "over"
		_say(out, Callable(self, "_won"))
		return
	# the foe's turn
	var r := Game.d20()
	var tot := r + int(foe["hit"])
	if r == 20 or (r != 1 and tot >= Game.ac()):
		var dmg := maxi(1, Game.roll(str(foe["dice"])) * (2 if r == 20 else 1))
		Game.hero["hp"] = int(Game.hero["hp"]) - dmg
		out.append("%s hits you for %d." % [foe["name"], dmg])
	else:
		out.append("%s misses." % foe["name"])
	if int(Game.hero["hp"]) <= 0:
		out.append_array(["You have fallen...", "You wake at the village shrine with half your gold."])
		state = "over"
		_say(out, Callable(self, "_died"))
		return
	_say(out)

func _draw() -> void:
	var c: Array = SKY.get(biome, SKY["meadow"])
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	draw_rect(Rect2(0, 120, 640, 120), c[0])
	draw_rect(Rect2(0, 240, 640, 140), c[1])
	draw_set_transform(Vector2(randf_range(-6, 6) if shake > 0 else 0.0, 0), 0, Vector2.ONE)
	draw_circle(Vector2(472, 340), 110, c[1].darkened(0.15))
	if int(foe["hp"]) > 0: Data.blit_fit(self, str(foe["art"]), Rect2(392, 170, 170, 170) if not boss else Rect2(372, 130, 210, 210), true)
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	draw_circle(Vector2(140, 370), 110, c[1].darkened(0.1))
	var look := "c_%s_4" % Game.hero["cls"]
	Data.blit_fit(self, look if Data.sprite(look) else "np_class_" + Game.hero["cls"], Rect2(80, 220, 130, 150))
	# HP boxes
	Data.panel(self, Rect2(8, 8, 300, 96))
	Data.text(self, ("%s L%d" % [Game.hero["name"], int(Game.hero["lvl"])]).substr(0, 11), Vector2(28, 24))
	Data.bar(self, Rect2(28, 64, 200, 20), float(Game.hero["hp"]) / maxf(1, Game.hp_max()), Data.HP_RED)
	Data.text(self, "%d" % maxi(0, int(Game.hero["hp"])), Vector2(236, 56), Data.INK, 0.75)
	Data.panel(self, Rect2(332, 8, 300, 96))
	Data.text(self, ("%s L%d" % [foe["name"], int(foe["lvl"])]).substr(0, 11), Vector2(352, 24))
	Data.bar(self, Rect2(352, 64, 256, 20), float(foe["hp"]) / maxf(1, foe["max"]), Data.HP_RED)
	# message or menu
	Data.panel(self, Rect2(8, 392, 624, 176))
	if state == "msg" and msgs.size():
		var s: String = msgs[0]
		Data.text(self, _wrapped(s.substr(0, int(shown))), Vector2(32, 416))
	elif state == "menu":
		var o := options()
		for k in range(o.size()):
			var x := 56 + (k % 2) * 300
			var y := 420 + int(k / 2) * 56
			Data.text(self, str(o[k]), Vector2(x, y))
			if k == sel: draw_colored_polygon(PackedVector2Array([Vector2(x - 32, y + 4), Vector2(x - 16, y + 18), Vector2(x - 32, y + 32)]), Data.INK)

func _wrapped(s: String) -> String:
	var words := s.split(" ")
	var lines := []
	var cur := ""
	for w in words:
		if (cur + " " + w).strip_edges().length() > 24: lines.append(cur.strip_edges()); cur = w
		else: cur += " " + w
	lines.append(cur.strip_edges())
	return "\n".join(lines.slice(0, 3))
