extends Node2D
## The overworld: every exported zone and town, walking, exits between zones, NPCs, random encounters and the HUD.

const Battle = preload("res://scripts/battle.gd")
const T := 64
const STEP_TIME := 0.14
var main: Node2D
var zone: Dictionary = {}
var moving := false
var move_t := 0.0
var from := Vector2.ZERO
var walk_frame := 0
var banner := 2.5
var steps_since := 0

func _ready() -> void:
	_load_zone(Game.zone_id)

func _load_zone(id: String) -> void:
	if not Data.zones.has(id):
		id = "elderwood"
	Game.zone_id = id
	zone = Data.zones[id]
	banner = 2.5
	if not _walkable(Game.pos.x, Game.pos.y):
		var hub: Array = zone.get("hub", [3, 8])
		Game.pos = Vector2i(int(hub[0]), int(hub[1]))

func _walkable(x: int, y: int) -> bool:
	var w: Array = zone.get("walk", [])
	if y < 0 or y >= w.size() or x < 0 or x >= str(w[y]).length():
		return false
	if str(w[y])[x] != "1":
		return false
	for n in zone.get("npcs", []):
		if int(n["x"]) == x and int(n["y"]) == y:
			return false
	return true

func _npc_at(x: int, y: int) -> Dictionary:
	for n in zone.get("npcs", []):
		if int(n["x"]) == x and int(n["y"]) == y:
			return n
	return {}

const DIRS := {"up": Vector2i(0, -1), "down": Vector2i(0, 1), "left": Vector2i(-1, 0), "right": Vector2i(1, 0)}

func step(delta: float) -> void:
	if banner > 0: banner -= delta
	if moving:
		move_t += delta
		if move_t >= STEP_TIME:
			moving = false
			_arrived()
		return
	if main.pressed("ui_start"):
		_menu(); return
	if main.pressed("ui_a"):
		var f: Vector2i = Game.pos + DIRS[Game.facing]
		var n := _npc_at(f.x, f.y)
		if not n.is_empty(): _talk(n)
		return
	for d in ["up", "down", "left", "right"]:
		if Input.is_action_pressed("ui_" + d):
			Game.facing = d
			var nxt: Vector2i = Game.pos + DIRS[d]
			if _walkable(nxt.x, nxt.y):
				from = Vector2(Game.pos)
				Game.pos = nxt
				moving = true
				move_t = 0.0
				walk_frame = 1 - walk_frame
			return

func _arrived() -> void:
	# exits to the next zone
	for k in zone.get("exits", {}):
		var e: Dictionary = zone["exits"][k]
		if int(e["x"]) == Game.pos.x and int(e["y"]) == Game.pos.y:
			var src := Game.zone_id
			var dest: Dictionary = Data.zones.get(e["to"], {})
			if dest.is_empty(): return
			var back: Dictionary = {}
			for k2 in dest.get("exits", {}):
				if dest["exits"][k2]["to"] == src: back = dest["exits"][k2]
			Game.pos = Vector2i(int(back["ix"]), int(back["iy"])) if not back.is_empty() else Vector2i(int(dest["hub"][0]), int(dest["hub"][1]))
			_load_zone(e["to"])
			return
	# random encounters outside towns
	if zone.get("town", false): return
	steps_since += 1
	if steps_since > 4 and Game.rng.randf() < 0.07:
		steps_since = 0
		_encounter()

func _encounter() -> void:
	var fams: Array = Data.game.get("BIOMES", {}).get(zone.get("biome", "meadow"), {}).get("fam", ["beast"])
	var pool := []
	for b in Data.game.get("BESTIARY", []):
		if fams.has(b["fam"]) and b.get("rank", "normal") == "normal": pool.append(b)
	if pool.is_empty(): pool = Data.game.get("BESTIARY", [])
	var lv: Array = zone.get("lvl", [1, 2])
	var b := Battle.new()
	b.foe_def = pool[Game.rng.randi_range(0, pool.size() - 1)]
	b.foe_lvl = Game.rng.randi_range(int(lv[0]), maxi(int(lv[0]), mini(int(lv[1]), Game.hero["lvl"] + 2)))
	b.biome = zone.get("biome", "meadow")
	main.push(b)

func _talk(n: Dictionary) -> void:
	var svc := str(n.get("svc"))
	talking = str(n.get("name", "NPC"))
	if svc == "inn":
		main.choose(["REST (20 G)", "LEAVE"], Callable(self, "_inn"), "%s: A warm bed for 20 G?" % talking)
	elif svc == "vendor":
		main.choose(["POTION (25 G)", "LEAVE"], Callable(self, "_shop"), "%s: What will it be?" % talking)
	elif svc == "elder":
		main.say(["%s: You carry the last lantern. I knew it would choose someone." % talking, "The EMBER CODEX was torn into twelve pages. Find them, and the dawn returns."])
	else:
		main.say(["%s: Welcome, %s." % [talking, Game.hero["name"]], "(This service is fully playable in the browser game; the Summer port adds it in a later stage.)"])

var talking := ""

func _inn(k: int) -> void:
	if k != 0:
		return
	if int(Game.hero["gold"]) < 20:
		main.say(["%s: You need 20 G." % talking])
		return
	Game.hero["gold"] = int(Game.hero["gold"]) - 20
	Game.hero["hp"] = Game.hp_max()
	Game.save()
	main.say(["%s: Sleep well. HP restored. Game saved." % talking])

func _shop(k: int) -> void:
	if k != 0:
		return
	if int(Game.hero["gold"]) < 25:
		main.say(["%s: That's 25 G." % talking])
		return
	Game.hero["gold"] = int(Game.hero["gold"]) - 25
	Game.hero["potions"] = int(Game.hero["potions"]) + 1
	main.say(["Bought a potion. You have %d." % int(Game.hero["potions"])])

func _menu() -> void:
	main.choose(["STATUS", "POTION (%d)" % int(Game.hero["potions"]), "SAVE", "SAVE & QUIT", "BACK"], Callable(self, "_menu_pick"))

func _menu_pick(k: int) -> void:
	if k == 0:
		main.say(_status())
	elif k == 1:
		if int(Game.hero["potions"]) <= 0:
			main.say(["No potions."])
			return
		Game.hero["potions"] = int(Game.hero["potions"]) - 1
		var h := Game.roll("2d4+2")
		Game.hero["hp"] = mini(Game.hp_max(), int(Game.hero["hp"]) + h)
		main.say(["+%d HP." % h])
	elif k == 2:
		main.say(["Saved." if Game.save() else "Could not save."])
	elif k == 3:
		Game.save()
		main.clear()
		main.push(load("res://scripts/title.gd").new())

func _status() -> Array:
	var h := Game.hero
	var c := Data.cls(h["cls"])
	var a := []
	for k in Game.ATTRS: a.append("%s %d" % [k, int(h["base"].get(k, 10))])
	return ["%s  LV %d %s %s" % [h["name"], int(h["lvl"]), Data.species(h["species"]).get("name", ""), c.get("name", "")],
		"HP %d/%d  AC %d  HIT +%d" % [int(h["hp"]), Game.hp_max(), Game.ac(), Game.attack_bonus()],
		" ".join(a.slice(0, 3)), " ".join(a.slice(3, 6)),
		"XP %d/%d  GOLD %d  SPELL LV %d" % [int(h["xp"]), Data.xp_for(int(h["lvl"]) + 1), int(h["gold"]), Game.spell_level()]]

# ------------------------------------------------------------------ drawing
func _hero_px() -> Vector2:
	var p := Vector2(Game.pos)
	if moving: p = from.lerp(p, clampf(move_t / STEP_TIME, 0, 1))
	return p * T

func _draw() -> void:
	var rows: Array = zone.get("gfx", [])
	if rows.is_empty(): return
	var cols: int = rows[0].size()
	var hp := _hero_px()
	var cam := Vector2(clampf(hp.x - 288, 0, maxf(0, cols * T - 640)), clampf(hp.y - 256, 0, maxf(0, rows.size() * T - 576)))
	var x0 := int(cam.x / T)
	var y0 := int(cam.y / T)
	for ty in range(y0, mini(rows.size(), y0 + 11)):
		for tx in range(x0, mini(cols, x0 + 12)):
			var t := Data.sprite(str(rows[ty][tx]))
			if t: draw_texture_rect(t, Rect2(Vector2(tx, ty) * T - cam, Vector2(T, T)), false)
	for n in zone.get("npcs", []):
		var p := Vector2(int(n["x"]), int(n["y"])) * T - cam
		if p.x < -T or p.x > 640 or p.y < -T or p.y > 576: continue
		var spr: String = (str(n["sprite"]) + "_down0") if n.get("sprite") else "gh_npc_townsman_down0"
		Data.blit_fit(self, spr, Rect2(p + Vector2(0, -12), Vector2(T, T)))
	var dir := "side" if Game.facing in ["left", "right"] else Game.facing
	var f := walk_frame if moving else 0
	Data.blit_fit(self, "gh_%s_%s%d" % [Game.hero["cls"], dir, f], Rect2(hp - cam + Vector2(0, -12), Vector2(T, T)), Game.facing == "left")
	_hud()

func _hud() -> void:
	var h := Game.hero
	Data.panel(self, Rect2(4, 4, 264, 92))
	draw_rect(Rect2(16, 16, 68, 68), Data.INK)
	draw_rect(Rect2(20, 20, 60, 60), Color8(196, 214, 236))
	Data.blit_fit(self, "np_class_" + h["cls"], Rect2(20, 20, 60, 60))
	Data.text(self, ("L%d %s" % [int(h["lvl"]), h["name"]]).substr(0, 7), Vector2(92, 16), Data.INK)
	Data.bar(self, Rect2(92, 56, 164, 20), float(h["hp"]) / maxf(1, Game.hp_max()), Data.HP_RED)
	var x0 := Data.xp_for(int(h["lvl"]))
	var x1 := Data.xp_for(int(h["lvl"]) + 1)
	Data.bar(self, Rect2(8, 98, 256, 12), float(int(h["xp"]) - x0) / maxf(1, x1 - x0), Data.GOLD)
	var tag := "SAFE" if zone.get("town", false) else "LV %d-%d" % [int(zone["lvl"][0]), int(zone["lvl"][1])]
	Data.panel(self, Rect2(640 - 8 - (tag.length() * 24 + 48), 4, tag.length() * 24 + 48, 56))
	Data.text_r(self, tag, 640 - 32, 14, Data.EDGE)
	Data.text_r(self, "%dG" % int(h["gold"]), 632, 68, Data.GOLD, 0.75)
	if banner > 0:
		var nm := str(zone.get("name", ""))
		Data.panel(self, Rect2(320 - nm.length() * 12 - 32, 300, nm.length() * 24 + 64, 64))
		Data.text_c(self, nm, 320, 314, Data.INK)
