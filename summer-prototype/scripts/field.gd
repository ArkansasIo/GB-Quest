extends Node2D
## The overworld: every exported zone and town, walking, exits between zones, NPCs, random encounters and the HUD.

const Battle = preload("res://scripts/battle.gd")
const Bag = preload("res://scripts/bag.gd")
const Dungeon = preload("res://scripts/dungeon.gd")
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
	if not Game.dun.is_empty() and id == str(Game.dun["map"]["id"]):
		Game.zone_id = id
		zone = Game.dun["map"]
		banner = 2.5
		return
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

func _mob_at(x: int, y: int) -> int:
	var ms: Array = zone.get("mobs", [])
	for k in range(ms.size()):
		if int(ms[k]["x"]) == x and int(ms[k]["y"]) == y:
			return k
	return -1

func _dungeon_at(x: int, y: int) -> String:
	var d = zone.get("poi", {}).get("dungeon")
	if d is Dictionary and int(d["x"]) == x and int(d["y"]) == y:
		return str(d["id"])
	return ""

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
		var dg := _dungeon_at(f.x, f.y)
		if dg != "": _offer_dungeon(dg)
		return
	for d in ["up", "down", "left", "right"]:
		if Input.is_action_pressed("ui_" + d):
			Game.facing = d
			var nxt: Vector2i = Game.pos + DIRS[d]
			var mk := _mob_at(nxt.x, nxt.y)
			if mk >= 0:
				_fight_mob(mk)
				return
			if _dungeon_at(nxt.x, nxt.y) != "" and main.pressed("ui_" + d):
				_offer_dungeon(_dungeon_at(nxt.x, nxt.y))
				return
			if _walkable(nxt.x, nxt.y):
				from = Vector2(Game.pos)
				Game.pos = nxt
				moving = true
				move_t = 0.0
				walk_frame = 1 - walk_frame
			return

func _arrived() -> void:
	if zone.has("dungeon"):
		_arrived_dungeon()
		return
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

# ------------------------------------------------------------------ dungeons
func _offer_dungeon(id: String) -> void:
	var d := Dungeon.def_by_id(id)
	if d.is_empty(): return
	var cleared: bool = Game.hero.get("cleared", []).has(id)
	main.choose(["ENTER", "LEAVE"], Callable(self, "_enter_pick").bind(id), "%s (LV %d)%s. %d floors. Enter?" % [d["name"], int(d["lvl"]), " CLEARED" if cleared else "", Dungeon.FLOORS])

func _enter_pick(k: int, id: String) -> void:
	if k == 0: enter_dungeon(id)

func enter_dungeon(id: String, floor: int = 0) -> void:
	var d := Dungeon.def_by_id(id)
	if Game.dun.is_empty():
		Game.dun = {"id": id, "ret_zone": Game.zone_id, "ret_pos": Game.pos}
	Game.dun["floor"] = floor
	Game.dun["map"] = Dungeon.build(d, floor)
	var up: Array = Game.dun["map"]["up"]
	Game.pos = Vector2i(int(up[0]), int(up[1]))
	Game.facing = "down"
	_load_zone(str(Game.dun["map"]["id"]))

func leave_dungeon() -> void:
	var z := str(Game.dun["ret_zone"])
	var p: Vector2i = Game.dun["ret_pos"]
	Game.dun = {}
	Game.pos = p
	_load_zone(z)
	Game.save()

func _arrived_dungeon() -> void:
	var p := Game.pos
	var up: Array = zone["up"]
	var dn: Array = zone["down"]
	if p.x == int(up[0]) and p.y == int(up[1]):
		main.choose(["LEAVE", "STAY"], Callable(self, "_up_pick"), "Climb back to the surface?" if int(zone["floor"]) == 0 else "Leave the dungeon? (Floors reset.)")
	elif p.x == int(dn[0]) and p.y == int(dn[1]):
		for m in zone["mobs"]:
			if m.get("boss", false):
				main.say(["A seal holds the way down.", "Defeat %s first." % m["def"]["name"]])
				return
		if zone.get("last", false):
			_finish_dungeon()
		else:
			enter_dungeon(str(Game.dun["id"]), int(zone["floor"]) + 1)
	elif str(zone["gfx"][p.y][p.x]).ends_with("_gold"):
		zone["gfx"][p.y][p.x] = str(zone["gfx"][p.y][p.x]).replace("_gold", "_floor")
		var g := 15 + int(zone["lvl"][0]) * 4 + Game.rng.randi_range(0, 20)
		Game.hero["gold"] = int(Game.hero["gold"]) + g
		var it := Game.random_drop(int(zone["lvl"][0]) + 10)
		Game.bag().append(it)
		main.say(["A hidden cache! %d G" % g, "and %s." % Game.item_name(it)])

func _up_pick(k: int) -> void:
	if k == 0: leave_dungeon()

func _finish_dungeon() -> void:
	var d := Dungeon.def_by_id(str(Game.dun["id"]))
	var cl: Array = Game.hero.get("cleared", [])
	var first := not cl.has(d["id"])
	if first:
		cl.append(d["id"])
	Game.hero["cleared"] = cl
	var bonus := int(d["lvl"]) * (60 if first else 20)
	var ups := Game.gain_xp(bonus)
	var lines := ["%s CLEARED!" % d["name"], "+%d XP for the clear%s." % [bonus, " (first time)" if first else ""]]
	if ups: lines.append("LEVEL UP! You are now level %d." % int(Game.hero["lvl"]))
	leave_dungeon()
	main.say(lines)

func _fight_mob(k: int) -> void:
	var m: Dictionary = zone["mobs"][k]
	var b := Battle.new()
	b.foe_def = m["def"]
	b.foe_lvl = int(m["lvl"])
	b.biome = zone.get("biome", "dusk")
	b.boss = m.get("boss", false)
	b.on_win = Callable(self, "_mob_down").bind(m)
	main.push(b)

func _mob_down(m: Dictionary) -> void:
	zone["mobs"].erase(m)
	if m.get("boss", false):
		main.say(["The seal on the stairs breaks."])

func _talk(n: Dictionary) -> void:
	var svc := str(n.get("svc"))
	talking = str(n.get("name", "NPC"))
	if svc == "inn":
		main.choose(["REST (20 G)", "LEAVE"], Callable(self, "_inn"), "%s: A warm bed for 20 G?" % talking)
	elif svc == "vendor":
		main.choose(["POTION (25 G)", "ARMS", "SELL", "LEAVE"], Callable(self, "_shop"), "%s: What will it be?" % talking)
	elif svc in ["blacksmith", "armorsmith", "weaponsmith"]:
		main.choose(["ARMS", "SELL", "LEAVE"], Callable(self, "_smith"), "%s: Steel for the road?" % talking)
	elif svc == "warden":
		main.say(["%s: Stay on the road, %s. The deep places bite." % [talking, Game.hero["name"]]])
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

var stock: Array = []

func _smith(k: int) -> void:
	if k >= 0 and k < 2: _shop(k + 1)

func _shop(k: int) -> void:
	if k == 1:
		stock = _stock()
		var names := []
		for it in stock:
			names.append("%s %dG" % [Game.item_name(it).substr(0, 12), Game.price(it)])
		main.choose(names, Callable(self, "_buy"), "%s: Fine steel, fair prices." % talking)
		return
	if k == 2:
		var b = Bag.new()
		b.sell = true
		main.push(b)
		return
	if k != 0:
		return
	if int(Game.hero["gold"]) < 25:
		main.say(["%s: That's 25 G." % talking])
		return
	Game.hero["gold"] = int(Game.hero["gold"]) - 25
	Game.hero["potions"] = int(Game.hero["potions"]) + 1
	main.say(["Bought a potion. You have %d." % int(Game.hero["potions"])])

## the vendor's arms list: gear this class can use, priced around the hero's level
func _stock() -> Array:
	var all := []
	for tbl in ["WEAPONS", "ARMORS"]:
		for id in Data.game.get(tbl, {}):
			var it := Game.make_item(id, 1 if Game.rng.randf() < 0.8 else 2)
			if Game.can_use(it):
				all.append(it)
	all.sort_custom(func(a, b): return Game.price(a) < Game.price(b))
	var lo := clampi(int(Game.hero["lvl"]) * all.size() / 60, 0, maxi(0, all.size() - 7))
	return all.slice(lo, lo + 7)

func _buy(k: int) -> void:
	if k < 0:
		return
	var it: Dictionary = stock[k]
	if int(Game.hero["gold"]) < Game.price(it):
		main.say(["%s: That's %d G." % [talking, Game.price(it)]])
		return
	Game.hero["gold"] = int(Game.hero["gold"]) - Game.price(it)
	Game.bag().append(it)
	main.say(["Bought %s. Equip it from GEAR & BAG." % Game.item_name(it)])

func _menu() -> void:
	main.choose(["STATUS", "GEAR & BAG", "POTION (%d)" % int(Game.hero["potions"]), "SAVE", "SAVE & QUIT", "BACK"], Callable(self, "_menu_pick"))

func _menu_pick(k: int) -> void:
	if k == 1:
		main.push(Bag.new())
		return
	if k > 1:
		k -= 1
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
		"XP %d/%d  GOLD %d  SPELL LV %d" % [int(h["xp"]), Data.xp_for(int(h["lvl"]) + 1), int(h["gold"]), Game.spell_level()],
		"WEAPON %s (%s)" % [Game.item_name(Game.gear().get("weapon", {})) if Game.gear().has("weapon") else "FISTS", Game.weapon_dice()],
		"ARMOR %s" % (Game.item_name(Game.gear().get("armor", {})) if Game.gear().has("armor") else "NONE")]

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
	for m in zone.get("mobs", []):
		var mp := Vector2(int(m["x"]), int(m["y"])) * T - cam
		if mp.x < -T or mp.x > 640 or mp.y < -T or mp.y > 576: continue
		var big: bool = m.get("boss", false)
		var bob := sin(Time.get_ticks_msec() / 300.0 + int(m["x"])) * 3
		Data.blit_fit(self, str(m["def"].get("art", "")), Rect2(mp + Vector2(-8 if big else 4, (-24 if big else -4) + bob), Vector2(80, 80) if big else Vector2(56, 56)), true)
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
	var tag := ("B%dF" % (int(zone["floor"]) + 1)) if zone.has("dungeon") else "SAFE" if zone.get("town", false) else "LV %d-%d" % [int(zone["lvl"][0]), int(zone["lvl"][1])]
	Data.panel(self, Rect2(640 - 8 - (tag.length() * 24 + 48), 4, tag.length() * 24 + 48, 56))
	Data.text_r(self, tag, 640 - 32, 14, Data.EDGE)
	Data.text_r(self, "%dG" % int(h["gold"]), 632, 68, Data.GOLD, 0.75)
	if banner > 0:
		var nm := str(zone.get("name", ""))
		Data.panel(self, Rect2(320 - nm.length() * 12 - 32, 300, nm.length() * 24 + 64, 64))
		Data.text_c(self, nm, 320, 314, Data.INK)
