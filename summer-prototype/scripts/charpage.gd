extends Node2D
## The CHARACTER page with tabs: STATS, SUBSTATS, ASPECTS, QUEST and JOB (support job, as src/jobs.js).
## LEFT/RIGHT switches tabs, B closes; on JOB, A picks a support job once the hero reaches SUPPORT_UNLOCK.

const Loot = preload("res://scripts/loot.gd")
const TABS := ["STATS", "SUBST", "ASPECT", "QUEST", "JOB", "TALENT"]

var main: Node2D
var tab := 0
var job_ids: Array = []

func step(_d: float) -> void:
	if main.pressed("ui_left"): tab = (tab + TABS.size() - 1) % TABS.size()
	if main.pressed("ui_right"): tab = (tab + 1) % TABS.size()
	if main.pressed("ui_b"):
		main.pop(self)
	elif main.pressed("ui_a") and tab == 4:
		_pick_job()
	elif main.pressed("ui_a") and tab == 5:
		_pick_talent()

var t_nodes: Array = []

func _pick_talent() -> void:
	t_nodes = []
	var names := []
	for t in Data.game.get("TALENT_TREES", []):
		for n in t["nodes"]:
			t_nodes.append(n)
			var st := "*" if Social.talents().has(n["id"]) else ("" if Social.can_learn(n) == "" else "-")
			names.append("%s%s L%d" % [st, str(n["name"]).substr(0, 14), int(n["level"])])
	t_nodes.append({})
	names.append("RESET (%dG)" % (50 * int(Game.hero["lvl"])))
	main.choose(names, Callable(self, "_learn"), "Points: %d. (* learned, - locked)" % Social.talent_points())

func _learn(k: int) -> void:
	if k < 0: return
	if t_nodes[k].is_empty():
		main.say([Social.reset_talents()]); return
	main.say([Social.learn(t_nodes[k])])

func _pick_job() -> void:
	var need := int(Data.game.get("SUPPORT_UNLOCK", 18))
	if int(Game.hero["lvl"]) < need:
		main.say(["Support jobs open at level %d." % need])
		return
	job_ids = ["(NONE)"]
	var names := ["(NONE)"]
	for c in Data.game.get("CLASS_ORDER", Data.game.get("CLASSES", {}).keys()):
		if c != Game.hero["cls"]:
			job_ids.append(c)
			names.append(str(Data.cls(c).get("name", c)))
	main.choose(names, Callable(self, "_set_job"), "Pick a support job: you gain its traits.")

func _set_job(k: int) -> void:
	if k < 0: return
	Game.hero["job"] = "" if k == 0 else str(job_ids[k])
	Game.hero["hp"] = mini(int(Game.hero["hp"]), Game.hp_max())

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	for t in range(TABS.size()):
		var on := t == tab
		Data.panel(self, Rect2(4 + t * 106, 4, 102, 56), Data.PANEL if on else Data.PANEL2)
		Data.text_c(self, TABS[t], 4 + t * 106 + 51, 20, Data.INK if on else Data.GREY, 0.6)
	Data.panel(self, Rect2(4, 64, 632, 508))
	match tab:
		0: _stats()
		1: _substats()
		2: _aspects()
		3: _quest()
		4: _job()
		5: _talents()
	Data.text(self, "<> TAB   B BACK" + ("   A CHOOSE" if tab >= 4 else ""), Vector2(24, 540), Data.GREY, 0.5)

func _talents() -> void:
	_line("TALENT POINTS %d  (one per 5 levels)" % Social.talent_points(), 84, Data.EDGE, 0.6)
	var y := 116
	for t in Data.game.get("TALENT_TREES", []):
		_line(str(t["name"]), y, Data.GREY, 0.6); y += 26
		for n in t["nodes"]:
			var have: bool = Social.talents().has(n["id"])
			_line("%s %s L%d: %s" % ["*" if have else " ", n["name"], int(n["level"]), n["desc"]], y, Data.INK if have else Data.GREY, 0.45, 40)
			y += 22
		y += 8
	var c := Social.companion()
	if not c.is_empty():
		_line("COMPANION %s (%s) BOND %d %s" % [c["name"], str(c["role"]).to_upper(), Social.bond(), Social.bond_tier().get("name", "")], 470, Data.EDGE, 0.5)
	if Social.in_guild():
		_line("GUILD %s LV %d%s" % [Game.hero["guild"], Social.guild_level(), "  CASTLE LORD" if Social.castle_owned() else ""], 494, Data.EDGE, 0.5)
	_line("ARENA %d  HONOR %d  SPIRE %d  DIFF %s" % [int(Game.hero.get("rating", 1000)), int(Game.hero.get("honor", 0)), int(Game.hero.get("spire", 0)), Social.difficulty().get("name", "")], 518, Data.GREY, 0.45)

func _line(s: String, y: float, col: Color = Data.INK, sc: float = 0.75, x: float = 28) -> void:
	Data.text(self, s, Vector2(x, y), col, sc)

func _stats() -> void:
	var h := Game.hero
	draw_rect(Rect2(28, 88, 132, 132), Data.INK)
	draw_rect(Rect2(32, 92, 124, 124), Color8(196, 214, 236))
	Data.blit_fit(self, "np_class_" + h["cls"], Rect2(32, 92, 124, 124))
	_line(str(h["name"]), 92, Data.INK, 1.0, 180)
	_line("LV %d %s" % [int(h["lvl"]), Data.cls(h["cls"]).get("name", "")], 136, Data.EDGE, 0.75, 180)
	_line(str(Data.species(h["species"]).get("name", "")), 166, Data.GREY, 0.75, 180)
	if str(h.get("job", "")) != "":
		_line("/" + str(Data.cls(h["job"]).get("name", "")), 194, Data.GREY, 0.75, 180)
	var y := 240
	_line("HP %d/%d   AC %d   HIT +%d" % [int(h["hp"]), Game.hp_max(), Game.ac(), Game.attack_bonus()], y)
	_line("XP %d / %d" % [int(h["xp"]), Data.xp_for(int(h["lvl"]) + 1)], y + 34)
	_line("GOLD %d   SPELL LV %d   KILLS %d" % [int(h["gold"]), Game.spell_level(), int(h.get("kills", 0))], y + 68)
	for i in range(6):
		var a: String = Game.ATTRS[i]
		var v := int(h["base"].get(a, 10))
		_line("%s %2d (%s%d)" % [a, v, "+" if Game.mod(a) >= 0 else "", Game.mod(a)], y + 112 + (i % 3) * 32, Data.INK, 0.75, 28 + (i / 3) * 300)
	var w := Game.gear().get("weapon", {}) as Dictionary
	_line("WEAPON " + (Game.item_name(w) if not w.is_empty() else "FISTS") + " " + Game.weapon_dice(), y + 222, Data.INK, 0.5)
	var ar := Game.gear().get("armor", {}) as Dictionary
	_line("ARMOR  " + (Game.item_name(ar) if not ar.is_empty() else "NONE"), y + 248, Data.INK, 0.5)

func _substats() -> void:
	var y := 84
	var n := 0
	for k in Data.game.get("SUBSTATS", {}):
		var v := Game.stat(k)
		if v == 0: continue
		var sub: Dictionary = Data.game["SUBSTATS"][k]
		_line("%s +%d%s" % [str(sub.get("name", k)).substr(0, 12), v, sub.get("unit", "")], y + (n % 13) * 34, Data.INK, 0.6, 28 + (n / 13) * 300)
		n += 1
	if n == 0:
		_line("No bonuses yet. Uncommon and better", 100)
		_line("gear rolls affixes; legendary gear", 130)
		_line("carries an aspect.", 160)

func _aspects() -> void:
	var y := 84.0
	var asp := Game.aspects()
	if asp.is_empty():
		_line("No legendary aspects equipped.", 100)
		_line("LEGENDARY, MYTHIC, ANCESTRAL and", 140, Data.GREY)
		_line("DIVINE gear each carries one of", 170, Data.GREY)
		_line("%d aspects." % Data.game.get("ASPECT_SPECS", {}).size(), 200, Data.GREY)
		return
	for a in asp:
		_line(Loot.aspect_name(a), y, Color8(200, 100, 20), 0.75)
		y += 30
		for l in Loot.wrap(Loot.aspect_text(a), 40):
			_line(str(l), y, Data.INK, 0.6)
			y += 24
		y += 12

func _quest() -> void:
	var ch := Quest.chapter()
	var total: int = Data.game.get("CHAPTERS", []).size()
	if ch.is_empty():
		_line("THE STORY IS COMPLETE.", 100, Data.EDGE, 1.0)
		_line("All %d chapters done." % total, 150)
		return
	var act: Dictionary = Data.game.get("ACTS", [])[int(ch["act"]) - 1]
	_line("ACT %d: %s" % [int(ch["act"]), act.get("name", "")], 88, Data.GREY, 0.6)
	_line("CHAPTER %d/%d" % [int(ch["i"]) + 1, total], 118, Data.EDGE, 0.75)
	_line(str(ch["title"]), 152, Data.INK, 1.0)
	var y := 204
	for l in Loot.wrap('"' + str(ch["line"]) + '"', 36):
		_line(str(l), y, Data.GREY, 0.65); y += 28
	y += 16
	_line("GOAL", y, Data.EDGE, 0.75); y += 34
	for l in Loot.wrap(Quest.goal(), 32):
		_line(str(l), y, Data.INK, 0.75); y += 32
	y += 8
	if Quest.side_list().size():
		_line("SIDE QUESTS", y, Data.EDGE, 0.6); y += 26
		for q in Quest.side_list():
			_line(Quest.side_goal(q).substr(0, 48), y, Data.INK, 0.5); y += 22
	_line("DUNGEONS CLEARED %d/%d" % [Game.hero.get("cleared", []).size(), Data.game.get("DUNGEONS", []).size()], 500, Data.GREY, 0.6)

func _job() -> void:
	var need := int(Data.game.get("SUPPORT_UNLOCK", 18))
	var j := str(Game.hero.get("job", ""))
	_line("SUPPORT JOB", 88, Data.EDGE, 0.75)
	_line(Data.cls(j).get("name", "NONE") if j != "" else "NONE", 124, Data.INK, 1.0)
	var y := 180
	if int(Game.hero["lvl"]) < need:
		_line("Unlocks at level %d." % need, y)
		y += 40
	elif j != "":
		_line("BONUSES (grow every 10 levels)", y, Data.GREY, 0.6); y += 32
		for kv in Loot.support_bonus(j, int(Game.hero["lvl"])):
			var sub: Dictionary = Data.game.get("SUBSTATS", {}).get(kv[0], {})
			_line("+%d%s %s" % [int(kv[1]), sub.get("unit", ""), sub.get("name", kv[0])], y); y += 32
	y += 20
	_line("JOB ABILITIES (battle > SKILL)", y, Data.GREY, 0.6); y += 32
	var jabs: Array = Data.game.get("JOB_ABILITIES", {}).get(Game.hero["cls"], [])
	if jabs.is_empty():
		_line("Your class has none; the 11", y); _line("job classes do.", y + 30)
	for ab in jabs:
		var have := int(ab.get("lvl", 1)) <= int(Game.hero["lvl"])
		_line("%s (LV %d)" % [ab["name"], int(ab.get("lvl", 1))], y, Data.INK if have else Data.GREY, 0.6); y += 26
		for l in Loot.wrap(str(ab.get("desc", "")), 42).slice(0, 2):
			_line(str(l), y, Data.GREY, 0.5); y += 22
		y += 6
		if y > 500: break
