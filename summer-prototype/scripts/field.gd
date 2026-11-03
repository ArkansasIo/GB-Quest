extends Node2D
## The overworld: every exported zone and town, walking, exits between zones, NPCs, random encounters and the HUD.

const Battle = preload("res://scripts/battle.gd")
const Bag = preload("res://scripts/bag.gd")
const Dungeon = preload("res://scripts/dungeon.gd")
const CharPage = preload("res://scripts/charpage.gd")
const Loot = preload("res://scripts/loot.gd")
const T := 64
const BASE_STEP := 0.14
var STEP_TIME := 0.14
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

## lines from quest / crafting events, shown as one dialog
func _show(lines: Array) -> void:
	if lines.size(): main.say(lines)

## a ridden mount makes each step quicker (speed 4 = about 1.6x)
func _step_time() -> float:
	var m := mount()
	return BASE_STEP / (1.0 + 0.15 * float(m.get("speed", 0))) if Game.hero.get("mounted", false) and not m.is_empty() and not zone.has("dungeon") else BASE_STEP

func mount() -> Dictionary:
	var id := str(Game.hero.get("mount", ""))
	for m in Data.game.get("MOUNTS", []):
		if m["id"] == id: return m
	return {}

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
	_spawn_world_bosses()
	if main and Game.hero.size():
		_show(Quest.on_enter_zone(id))

# ------------------------------------------------------------------ world bosses and gathering nodes
const BOSS_RESPAWN := 400   # steps
const NODE_RESPAWN := 250

func _steps() -> int:
	return int(Game.hero.get("steps", 0))

## the zone's world bosses stand in the open until beaten, then return after BOSS_RESPAWN steps
func _spawn_world_bosses() -> void:
	var mobs := []
	var wbk: Dictionary = Game.hero.get("wbk", {})
	for b in zone.get("bosses", []):
		if wbk.has(b["id"]) and _steps() - int(wbk[b["id"]]) < BOSS_RESPAWN: continue
		var def := {}
		for w in Data.game.get("WORLD_BOSSES", []):
			if w["id"] == b["id"]: def = w
		if def.is_empty(): continue
		mobs.append({"x": int(b["x"]), "y": int(b["y"]), "def": def, "lvl": maxi(int(def["lvl"]), int(zone.get("lvl", [1, 1])[1])), "boss": true, "world": true})
	zone["mobs"] = mobs

func _node_ready(i: int) -> bool:
	var g: Dictionary = Game.hero.get("nodes", {}).get(Game.zone_id, {})
	return not g.has(str(i)) or _steps() - int(g[str(i)]) >= NODE_RESPAWN

func _gather_here() -> bool:
	var ns: Array = zone.get("nodes", [])
	for i in range(ns.size()):
		var n: Array = ns[i]
		if int(n[0]) == Game.pos.x and int(n[1]) == Game.pos.y and _node_ready(i):
			var all: Dictionary = Game.hero.get("nodes", {})
			var g: Dictionary = all.get(Game.zone_id, {})
			g[str(i)] = _steps(); all[Game.zone_id] = g; Game.hero["nodes"] = all
			var item := str(n[3])
			var qty := 1 + (1 if Game.rng.randf() < 0.35 else 0)
			Craft.add(item, qty)
			main.say(["%s: gathered %d %s." % [str(n[2]).to_upper(), qty, Craft.mat_name(item)]])
			return true
	return false

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
	for key in ["dungeon", "raid"]:
		var d = zone.get("poi", {}).get(key)
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
				STEP_TIME = _step_time()
				from = Vector2(Game.pos)
				Game.pos = nxt
				moving = true
				move_t = 0.0
				walk_frame = 1 - walk_frame
			return

func _arrived() -> void:
	Game.hero["steps"] = _steps() + 1
	if zone.has("dungeon"):
		_arrived_dungeon()
		return
	if _gather_here(): return
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
	var kind := "RAID" if Dungeon.is_raid(d) else "DUNGEON"
	main.choose(["ENTER", "LEAVE"], Callable(self, "_enter_pick").bind(id), "%s %s (LV %d)%s. %d %s. Enter?" % [kind, d["name"], int(d["lvl"]), " CLEARED" if cleared else "", Dungeon.floors(d), "bosses" if kind == "RAID" else "floors"])

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
	var bonus := int(d["lvl"]) * (60 if first else 20) * (3 if Dungeon.is_raid(d) else 1)
	var ups := Game.gain_xp(bonus)
	var lines := ["%s CLEARED!" % d["name"], "+%d XP for the clear%s." % [bonus, " (first time)" if first else ""]]
	if Dungeon.is_raid(d) and Game.rng.randf() < 0.25:
		var pool: Array = Data.game.get("MOUNTS", []).filter(func(m): return m.get("source") == "raid" and not Game.hero.get("mounts", []).has(m["id"]))
		if pool.size():
			var m: Dictionary = pool[Game.rng.randi_range(0, pool.size() - 1)]
			var own: Array = Game.hero.get("mounts", []); own.append(m["id"]); Game.hero["mounts"] = own
			lines.append("RAID MOUNT: %s%s! (START > MOUNT)" % [m["name"], " (flying)" if m.get("fly") else ""])
	if ups: lines.append("LEVEL UP! You are now level %d." % int(Game.hero["lvl"]))
	leave_dungeon()
	lines.append_array(Quest.on_dungeon_clear(str(d["id"])))
	main.say(lines)

func _fight_mob(k: int) -> void:
	var m: Dictionary = zone["mobs"][k]
	var b := Battle.new()
	b.foe_def = m["def"]
	b.foe_lvl = int(m["lvl"])
	b.biome = zone.get("biome", "dusk")
	b.boss = m.get("boss", false)
	if b.boss and zone.get("raid", false): b.hp_mult = 4
	if m.get("world", false): b.hp_mult = 5
	b.on_win = Callable(self, "_mob_down").bind(m)
	main.push(b)

func _mob_down(m: Dictionary) -> void:
	zone["mobs"].erase(m)
	if m.get("world", false):
		var wbk: Dictionary = Game.hero.get("wbk", {}); wbk[m["def"]["id"]] = _steps(); Game.hero["wbk"] = wbk
		main.say(["%s falls! It will return in time." % m["def"]["name"]])
		return
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
		craft_prof = svc
		main.choose(["ARMS", "SELL", "CRAFT", "LEAVE"], Callable(self, "_smith"), "%s: Steel for the road?" % talking)
	elif svc == "warden":
		var q := Quest.on_talk("warden")
		main.say(["%s: Stay on the road, %s. The deep places bite." % [talking, Game.hero["name"]]] + q)
	elif svc == "elder":
		var q := Quest.on_talk("elder")
		main.say(["%s: You carry the last lantern. I knew it would choose someone." % talking, "The EMBER CODEX was torn into twelve pages. Find them, and the dawn returns."] + q)
	elif svc == "craftmaster":
		main.choose(Craft.PROFS.values(), Callable(self, "_pick_prof"), "%s: Which craft?" % talking)
	elif svc == "proftrainer" and ROLE_PROF.has(str(n.get("role", ""))):
		craft_prof = ROLE_PROF[str(n["role"])]
		_craft_menu()
	elif svc == "stable":
		_stable()
	elif svc == "trials":
		_trials_menu()
	elif svc == "trainer":
		var cp = CharPage.new(); cp.tab = 4; main.push(cp)
	else:
		main.say(["%s: Welcome, %s." % [talking, Game.hero["name"]], "(This service is fully playable in the browser game; the Summer port adds it in a later stage.)"])

var talking := ""
var craft_prof := "alch"
const ROLE_PROF := {"alchemist": "alch", "weaponsmith": "weaponsmith", "armorer": "armorsmith", "blacksmith": "blacksmith"}

# ------------------------------------------------------------------ crafting
func _pick_prof(k: int) -> void:
	if k < 0: return
	craft_prof = Craft.PROFS.keys()[k]
	_craft_menu()

var craft_list: Array = []

func _craft_menu() -> void:
	craft_list = Craft.recipes(craft_prof)
	if craft_list.is_empty():
		main.say(["%s: Come back with more skill." % talking]); return
	var names := []
	for r in craft_list:
		names.append(("" if Craft.can_make(r) else "-") + str(r["name"]).substr(0, 17))
	main.choose(names, Callable(self, "_craft_pick"), "%s skill %d. '-' = missing materials." % [Craft.PROFS[craft_prof], Craft.skill(craft_prof)])

func _craft_pick(k: int) -> void:
	if k < 0: return
	var r: Dictionary = craft_list[k]
	if not Craft.can_make(r):
		main.say(["%s needs:" % r["name"]] + Loot.wrap(Craft.needs_text(r), 24))
		return
	main.say(Craft.make(r))

# ------------------------------------------------------------------ trials (TRIALS: rush, timed, solo, frail, waves, mirror)
var trial: Dictionary = {}

func _trials_menu() -> void:
	var names := []
	for t in Data.game.get("TRIALS", []):
		names.append(("*" if Game.hero.get("trials", {}).has(t["id"]) else "") + "%s L%d" % [str(t["name"]).replace("TRIAL OF ", "").substr(0, 14), int(t["lvl"])])
	main.choose(names, Callable(self, "_trial_pick"), "%s: Prove yourself. (* = won)" % talking)

func _trial_pick(k: int) -> void:
	if k < 0: return
	var t: Dictionary = Data.game["TRIALS"][k]
	if int(Game.hero["lvl"]) < int(t["lvl"]):
		main.say(["%s: Come back at level %d." % [talking, int(t["lvl"])]]); return
	var total: int = {"rush": 5, "waves": 10, "mirror": 3}.get(str(t["rule"]), 3)
	trial = {"t": t, "i": 0, "total": total}
	Game.hero["hp"] = Game.hp_max()
	if t["rule"] == "frail": Game.hero["hp"] = Game.hp_max() / 2
	main.say(["%s" % t["name"], str(t.get("desc", "")), "%d fights. No running." % total], Callable(self, "_trial_next"))

func _trial_next() -> void:
	var t: Dictionary = trial["t"]
	var b := Battle.new()
	var lvl := maxi(int(t["lvl"]), int(Game.hero["lvl"]))
	var i := int(trial["i"])
	match str(t["rule"]):
		"waves":
			var pool: Array = Data.game.get("BESTIARY", [])
			b.foe_def = pool[Game.rng.randi_range(0, pool.size() - 1)]
		"mirror":
			var cs: Array = Data.game.get("CLASS_ORDER", ["warden"])
			var c: String = cs[Game.rng.randi_range(0, cs.size() - 1)]
			b.foe_def = {"name": "MIRROR " + str(Data.cls(c).get("name", c)), "art": "c_%s_4" % c, "fam": "humanoid"}
			b.boss = true; b.hp_mult = 2
		_:
			var tb: Array = Data.game.get("TRIAL_BOSSES", [])
			b.foe_def = tb[(Data.game["TRIALS"].find(t) * 5 + i) % maxi(1, tb.size())] if tb.size() else {"name": "CHAMPION", "fam": "humanoid"}
			b.boss = true; b.hp_mult = 2
	b.foe_lvl = lvl
	b.biome = "crystal"
	b.no_escape = true
	b.loot = false
	if t["rule"] == "timed": b.max_rounds = 12
	b.on_win = Callable(self, "_trial_won_fight")
	b.on_lose = Callable(self, "_trial_failed")
	main.push(b)

func _trial_won_fight() -> void:
	trial["i"] = int(trial["i"]) + 1
	if int(trial["i"]) < int(trial["total"]):
		if trial["t"]["rule"] != "rush":
			Game.hero["hp"] = mini(Game.hp_max() / (2 if trial["t"]["rule"] == "frail" else 1), int(Game.hero["hp"]) + Game.hp_max() / 4)
		main.say(["Fight %d of %d won." % [int(trial["i"]), int(trial["total"])]], Callable(self, "_trial_next"))
		return
	var t: Dictionary = trial["t"]
	var first: bool = not Game.hero.get("trials", {}).has(t["id"])
	var tr: Dictionary = Game.hero.get("trials", {}); tr[t["id"]] = true; Game.hero["trials"] = tr
	var it := Game.random_drop(int(Game.hero["lvl"]) + 20)
	it = Game.make_item(str(it["id"]), maxi(4 if first else 3, int(it["r"])), int(Game.hero["lvl"]) + 10)
	Game.bag().append(it)
	var gold := int(t["lvl"]) * (40 if first else 10)
	Game.hero["gold"] = int(Game.hero["gold"]) + gold
	Game.hero["hp"] = Game.hp_max()
	trial = {}
	main.say(["%s COMPLETE!" % t["name"], "+%d G and %s." % [gold, Game.item_name(it)]])

func _trial_failed() -> void:
	var t: Dictionary = trial.get("t", {})
	trial = {}
	Game.hero["hp"] = Game.hp_max()
	main.say(["%s failed. Try again any time." % t.get("name", "The trial")])

# ------------------------------------------------------------------ the stable: mounts
var stable_list: Array = []

func _stable() -> void:
	stable_list = []
	for m in Data.game.get("MOUNTS", []):
		if m.get("source") == "stable" and int(m.get("lvl", 1)) <= int(Game.hero["lvl"]) + 10:
			stable_list.append(m)
	stable_list = stable_list.slice(0, 7)
	if stable_list.is_empty():
		main.say(["%s: Come back at level 15 for your first mount." % talking]); return
	var names := []
	for m in stable_list:
		names.append("%s %dG" % [str(m["name"]).substr(0, 12), int(m["price"])])
	main.choose(names, Callable(self, "_buy_mount"), "%s: Ride from START > MOUNT." % talking)

func _buy_mount(k: int) -> void:
	if k < 0: return
	var m: Dictionary = stable_list[k]
	var own: Array = Game.hero.get("mounts", [])
	if own.has(m["id"]):
		Game.hero["mount"] = m["id"]; main.say(["You saddle your %s." % m["name"]]); return
	if int(Game.hero["lvl"]) < int(m["lvl"]):
		main.say(["%s: Come back at level %d." % [talking, int(m["lvl"])]]); return
	if int(Game.hero["gold"]) < int(m["price"]):
		main.say(["%s: That's %d G." % [talking, int(m["price"])]]); return
	Game.hero["gold"] = int(Game.hero["gold"]) - int(m["price"])
	own.append(m["id"]); Game.hero["mounts"] = own
	Game.hero["mount"] = m["id"]; Game.hero["mounted"] = true
	main.say(["You bought the %s! (Speed %d)" % [m["name"], int(m["speed"])], str(m.get("desc", ""))])

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
	elif k == 2: _craft_menu()

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
			var it := Game.make_item(id, 1 if Game.rng.randf() < 0.8 else 2, int(Game.hero["lvl"]))
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

const MENU := ["CHARACTER", "GEAR & BAG", "QUEST", "POTION", "MOUNT", "SAVE", "SAVE & QUIT", "BACK"]

func _menu() -> void:
	var o := MENU.duplicate()
	o[3] = "POTION (%d)" % int(Game.hero["potions"])
	o[4] = ("DISMOUNT" if Game.hero.get("mounted", false) else "MOUNT") if Game.hero.get("mount", "") != "" else "MOUNT (NONE)"
	main.choose(o, Callable(self, "_menu_pick"))

func _menu_pick(k: int) -> void:
	if k == 0:
		main.push(CharPage.new())
		return
	if k == 1:
		main.push(Bag.new())
		return
	if k == 2:
		var cp = CharPage.new(); cp.tab = 3; main.push(cp)
		return
	if k == 4:
		if Game.hero.get("mount", "") == "":
			main.say(["You have no mount. Stablemasters in towns sell them from level 15."])
		elif zone.has("dungeon"):
			main.say(["No riding in dungeons."])
		else:
			Game.hero["mounted"] = not Game.hero.get("mounted", false)
			main.say(["You ride your %s." % mount().get("name", "mount") if Game.hero["mounted"] else "You dismount."])
		return
	k = {3: 1, 5: 2, 6: 3}.get(k, 9)
	if k == 1:
		if int(Game.hero["potions"]) <= 0:
			main.say(["No potions."])
			return
		Game.hero["potions"] = int(Game.hero["potions"]) - 1
		var h := (Game.roll("2d4+2") + int(Game.hero["lvl"]) / 5) * (100 + Game.stat("heal")) / 100
		Game.hero["hp"] = mini(Game.hp_max(), int(Game.hero["hp"]) + h)
		main.say(["+%d HP." % h])
	elif k == 2:
		main.say(["Saved." if Game.save() else "Could not save."])
	elif k == 3:
		Game.save()
		main.clear()
		main.push(load("res://scripts/title.gd").new())

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
	var ns: Array = zone.get("nodes", [])
	for i in range(ns.size()):
		if not _node_ready(i): continue
		var np := Vector2(int(ns[i][0]), int(ns[i][1])) * T - cam
		if np.x < -T or np.x > 640 or np.y < -T or np.y > 576: continue
		var bob2 := 2.0 if (Time.get_ticks_msec() / 500) % 4 == 0 else 0.0
		Data.blit_fit(self, Craft.mat_icon(str(ns[i][3])), Rect2(np + Vector2(12, 8 - bob2), Vector2(40, 40)))
	for m in zone.get("mobs", []):
		var mp := Vector2(int(m["x"]), int(m["y"])) * T - cam
		if mp.x < -T or mp.x > 640 or mp.y < -T or mp.y > 576: continue
		var big: bool = m.get("boss", false)
		var bob := sin(Time.get_ticks_msec() / 300.0 + int(m["x"])) * 3
		Data.blit_fit(self, str(m["def"].get("art", "")), Rect2(mp + Vector2(-8 if big else 4, (-24 if big else -4) + bob), Vector2(80, 80) if big else Vector2(56, 56)), true)
	var riding: bool = Game.hero.get("mounted", false) and not mount().is_empty() and not zone.has("dungeon")
	if riding:
		Data.blit_fit(self, "ap_mounts_%03d" % ((int(mount().get("no", 1)) - 1) % 22), Rect2(hp - cam + Vector2(-12, -6), Vector2(88, 80)), Game.facing == "left")
	Data.blit_fit(self, "gh_%s_%s%d" % [Game.hero["cls"], dir, f], Rect2(hp - cam + Vector2(0, -28 if riding else -12), Vector2(T, T)), Game.facing == "left")
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
	# quest tracker: the current chapter goal along the bottom
	var lines: Array = Loot.wrap(Quest.goal(), 50)
	var hh := 14 + lines.size() * 22
	draw_rect(Rect2(4, 576 - hh - 4, 632, hh), Color(0.06, 0.07, 0.12, 0.82))
	for i in range(lines.size()):
		Data.text(self, str(lines[i]), Vector2(14, 576 - hh + 4 + i * 22), Data.GOLD, 0.5)
	if banner > 0:
		var nm := str(zone.get("name", ""))
		Data.panel(self, Rect2(320 - nm.length() * 12 - 32, 300, nm.length() * 24 + 64, 64))
		Data.text_c(self, nm, 320, 314, Data.INK)
