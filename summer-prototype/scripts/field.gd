extends Node2D
## The overworld: every exported zone and town, walking, exits between zones, NPCs, random encounters and the HUD.

const Battle = preload("res://scripts/battle.gd")
const Bag = preload("res://scripts/bag.gd")
const Dungeon = preload("res://scripts/dungeon.gd")
const CharPage = preload("res://scripts/charpage.gd")
const Fishing = preload("res://scripts/fishing.gd")
const GearX = preload("res://scripts/gearx.gd")
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
			Sound.sfx("gather")
			main.say(["%s: gathered %d %s." % [str(n[2]).to_upper(), qty, Craft.mat_name(item)]] + Quest.on_gather(Game.zone_id))
			return true
	return false

## riding a flying mount in the wilds lifts you over water, trees and rocks (not in towns or dungeons)
func flying() -> bool:
	return Game.hero.get("mounted", false) and mount().get("fly", false) and not zone.get("town", false) and not zone.has("dungeon")

func _walkable(x: int, y: int) -> bool:
	var w: Array = zone.get("walk", [])
	if y < 0 or y >= w.size() or x < 0 or x >= str(w[y]).length():
		return false
	if str(w[y])[x] != "1" and not flying():
		return false
	for n in zone.get("npcs", []):
		if int(n["x"]) == x and int(n["y"]) == y:
			return false
	return true

func _is_water(x: int, y: int) -> bool:
	var rows: Array = zone.get("gfx", [])
	return y >= 0 and y < rows.size() and x >= 0 and x < rows[y].size() and str(rows[y][x]).contains("water")

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

# ------------------------------------------------------------------ NPC AI (after src/npc_ai.js): townsfolk and trainers wander
## near their posts (a leash of 2 tiles), stop when you stand next to them and turn to face you when spoken to.
## Shopkeepers, innkeepers and other fixed services keep their posts.
const NPC_STEP := 0.3
const FIXED := ["inn", "vendor", "bank", "auction", "guild", "honor", "lfg", "difficulty", "tower", "trials", "portal", "server", "stable", "arena",
	"blacksmith", "armorsmith", "weaponsmith", "housing", "elder", "trainer", "craftmaster"]
var _ai_t := 0.0

func _npc_ai(delta: float) -> void:
	var npcs: Array = zone.get("npcs", [])
	for n in npcs:
		if n.has("mt") and float(n["mt"]) > 0: n["mt"] = maxf(0.0, float(n["mt"]) - delta)
	_ai_t -= delta
	if _ai_t > 0 or npcs.is_empty(): return
	_ai_t = 0.35
	for k in range(2):
		var n: Dictionary = npcs[Game.rng.randi_range(0, npcs.size() - 1)]
		if str(n.get("svc")) in FIXED or Game.rng.randf() < 0.5: continue
		if not n.has("x0"): n["x0"] = int(n["x"]); n["y0"] = int(n["y"])
		var here := Vector2i(int(n["x"]), int(n["y"]))
		if (here - Game.pos).length() < 1.5: continue   # waits for you
		var dname: String = ["up", "down", "left", "right"][Game.rng.randi_range(0, 3)]
		var to: Vector2i = here + DIRS[dname]
		n["d"] = dname
		if absi(to.x - int(n["x0"])) > 2 or absi(to.y - int(n["y0"])) > 2: continue
		var w: Array = zone.get("walk", [])
		if to.y < 0 or to.y >= w.size() or to.x < 0 or to.x >= str(w[to.y]).length() or str(w[to.y])[to.x] != "1": continue
		if to == Game.pos or not _npc_at(to.x, to.y).is_empty() or _mob_at(to.x, to.y) >= 0: continue
		n["px"] = here.x; n["py"] = here.y; n["x"] = to.x; n["y"] = to.y; n["mt"] = NPC_STEP; n["f"] = 1 - int(n.get("f", 0))

func step(delta: float) -> void:
	_npc_ai(delta)
	Sound.zone_music(zone)   # back to the zone's track after battles and jingles
	if banner > 0: banner -= delta
	if moving:
		move_t += delta
		if move_t >= STEP_TIME:
			moving = false
			_arrived()
		return
	if Online.want_view:
		main.push(load("res://scripts/remotebattle.gd").new()); return
	if Online.party_log.size():
		main.say(Online.party_log.duplicate()); Online.party_log.clear(); return
	if main.pressed("ui_start"):
		_menu(); return
	if main.pressed("ui_a"):
		var f: Vector2i = Game.pos + DIRS[Game.facing]
		var n := _npc_at(f.x, f.y)
		if not n.is_empty(): _talk(n)
		for op in Online.players_here():
			if int(op["x"]) == f.x and int(op["y"]) == f.y: _duel(op)
		var dg := _dungeon_at(f.x, f.y)
		if dg != "": _offer_dungeon(dg)
		elif n.is_empty() and _is_water(f.x, f.y) and not flying():
			main.push(Fishing.new())
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
	var wp = zone.get("waypoint")
	if wp is Dictionary and int(wp["x"]) == Game.pos.x and int(wp["y"]) == Game.pos.y and Social.attune(Game.zone_id):
		main.say(["WAYPOINT ATTUNED: %s." % zone.get("name", ""), "Travel here from START > TRAVEL."])
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
			Sound.sfx("stairs")
			enter_dungeon(str(Game.dun["id"]), int(zone["floor"]) + 1)
	elif _trap_at(p):
		pass
	elif str(zone["gfx"][p.y][p.x]).ends_with("_gold"):
		zone["gfx"][p.y][p.x] = str(zone["gfx"][p.y][p.x]).replace("_gold", "_floor")
		var g := 15 + int(zone["lvl"][0]) * 4 + Game.rng.randi_range(0, 20)
		Game.hero["gold"] = int(Game.hero["gold"]) + g
		var it := Game.random_drop(int(zone["lvl"][0]) + 10)
		Game.bag().append(it)
		Sound.sfx("chest")
		main.say(["A hidden cache! %d G" % g, "and %s." % Game.item_name(it)])

## hidden traps: a DEX save (d20 + DEX + proficiency) against the trap's DC, or take its damage; found traps show as spikes
func _trap_at(p: Vector2i) -> bool:
	for t in zone.get("traps", []):
		if int(t["x"]) != p.x or int(t["y"]) != p.y or t.get("found", false): continue
		t["found"] = true
		zone["gfx"][p.y][p.x] = "gd_%s_spikes" % str(zone["gfx"][p.y][p.x]).split("_")[1]
		var r := Game.d20()
		var save := r + Game.mod("DEX") + Game.prof()
		if save >= int(t["dc"]):
			main.say(["A hidden trap! You leap clear. (DEX %d vs DC %d)" % [save, int(t["dc"])]])
		else:
			var dmg := maxi(1, Game.roll(str(t["dmg"])) * (100 - mini(60, Game.stat("resist"))) / 100)
			Game.hero["hp"] = maxi(1, int(Game.hero["hp"]) - dmg)
			main.say(["A hidden trap! Spikes for %d. (DEX %d vs DC %d)" % [dmg, save, int(t["dc"])]])
		return true
	return false

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
	Social.count("raids" if Dungeon.is_raid(d) else "dungeons")
	var ups := Game.gain_xp(bonus)
	var lines := ["%s CLEARED!" % d["name"], "+%d XP for the clear%s." % [bonus, " (first time)" if first else ""]]
	if Dungeon.is_raid(d) or (first and Game.rng.randf() < 0.2):
		var tr := _treasure("artifact" if Dungeon.is_raid(d) else "relic", int(d["lvl"]) + 10)
		if not tr.is_empty(): lines.append("%s: %s!" % ["ARTIFACT" if Dungeon.is_raid(d) else "RELIC", Game.item_name(tr)])
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
		var lines := ["%s falls! It will return in time." % m["def"]["name"]]
		if Game.rng.randf() < 0.3:
			var rl := _treasure("relic", int(m["lvl"]))
			if not rl.is_empty(): lines.append("RELIC: %s!" % Game.item_name(rl))
		main.say(lines)
		return
	if m.get("boss", false):
		main.say(["The seal on the stairs breaks."])

func _talk(n: Dictionary) -> void:
	n["d"] = {"up": "down", "down": "up", "left": "right", "right": "left"}[Game.facing]   # turns to face you
	Sound.sfx("confirm")
	var svc := str(n.get("svc"))
	talking = str(n.get("name", "NPC"))
	if svc == "inn":
		main.choose(["REST (20 G)", "COOK", "COMPANIONS", "LEAVE"], Callable(self, "_inn"), "%s: A warm bed for 20 G?" % talking)
	elif svc == "vendor":
		main.choose(["POTION (25 G)", "ARMS", "SELL", "LEAVE"], Callable(self, "_shop"), "%s: What will it be?" % talking)
	elif svc in ["blacksmith", "armorsmith", "weaponsmith"]:
		craft_prof = svc
		main.choose(["ARMS", "SELL", "CRAFT", "LEAVE"], Callable(self, "_smith"), "%s: Steel for the road?" % talking)
	elif svc == "warden":
		var q := Quest.on_talk("warden")
		if q.size():
			main.say(["%s: Stay on the road, %s. The deep places bite." % [talking, Game.hero["name"]]] + q)
		else:
			main.choose(["TALK", "SIDE QUEST", "LEAVE"], Callable(self, "_warden"), "%s: Need something?" % talking)
	elif svc == "curator":
		_curator()
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
	elif svc == "guild": Social.open_guild(main)
	elif svc == "housing": Social.open_home(main)
	elif svc == "bank": Social.open_bank(main)
	elif svc == "arena": Social.open_arena(main)
	elif svc == "honor": Social.open_honor(main)
	elif svc == "lfg": Social.open_bounties(main)
	elif svc == "tower": Social.open_tower(main)
	elif svc == "difficulty": Social.open_oracle(main)
	elif svc == "portal": Social.open_travel(main, self)
	elif svc == "auction":
		if not Online.signed_in(): main.say(["%s: The trading hub lives on the realm server." % talking, "Sign in from START > REALM first."])
		else: main.push(load("res://scripts/market.gd").new())
	elif svc == "trials":
		_trials_menu()
	elif svc == "trainer":
		var cp = CharPage.new(); cp.tab = 4; main.push(cp)
	else:
		main.say(["%s: Welcome, %s." % [talking, Game.hero["name"]], "(This service is fully playable in the browser game; the Summer port adds it in a later stage.)"])

var talking := ""
var craft_prof := "alch"
const ROLE_PROF := {"alchemist": "alch", "weaponsmith": "weaponsmith", "armorer": "armorsmith", "blacksmith": "blacksmith"}

# ------------------------------------------------------------------ war mode: duel a flagged player in the wilds (as fightWorldPvp)
func _duel(op: Dictionary) -> void:
	if not Online.war or not op.get("war", false):
		main.say(["%s L%d" % [op["name"], int(op["lvl"])], "Both of you need WAR MODE on (START > REALM) to duel."]); return
	if zone.get("town", false):
		main.say(["Towns are safe zones. Duel in the wilds."]); return
	var b := Battle.new()
	b.foe_def = {"name": str(op["name"]), "art": "c_%s_4" % op["cls"], "fam": "humanoid", "id": "pvp_" + str(op["name"])}
	b.foe_lvl = clampi(int(op["lvl"]), 1, 720)
	b.biome = zone.get("biome", "meadow")
	b.hp_scale = 2.0
	b.no_escape = true
	b.loot = false
	b.on_win = Callable(self, "_duel_won").bind(op)
	b.on_lose = Callable(self, "_duel_lost").bind(op)
	main.push(b)

func _duel_won(op: Dictionary) -> void:
	var dfs: Dictionary = Game.hero.get("pvpdef", {})
	var n := int(dfs.get(op["name"], 0))
	dfs[op["name"]] = n + 1; Game.hero["pvpdef"] = dfs
	var honor := maxi(1, roundi((20 + int(Game.hero["lvl"]) / 2 + (int(op["lvl"]) - int(Game.hero["lvl"]))) * maxf(0.2, 1.0 - n * 0.2)))
	Game.hero["honor"] = int(Game.hero.get("honor", 0)) + honor
	Social.count("pvpKills")
	main.say(["Victory over %s! +%d honor." % [op["name"], honor]])

func _duel_lost(op: Dictionary) -> void:
	Game.hero["hp"] = 1
	main.say(["%s wins the duel." % op["name"]])

# ------------------------------------------------------------------ wardens: side quests
var offer: Dictionary = {}

func _warden(k: int) -> void:
	if k == 0:
		main.say(["%s: Stay on the road, %s. The deep places bite." % [talking, Game.hero["name"]]])
	elif k == 1:
		if Quest.side_has(Game.zone_id):
			for q in Quest.side_list():
				if q["zone"] == Game.zone_id: main.say(["%s: How goes it?" % talking, Quest.side_goal(q)])
			return
		offer = Quest.side_offer(Game.zone_id)
		main.choose(["ACCEPT", "DECLINE"], Callable(self, "_side_pick"), "%s: %s Reward %d G." % [offer["title"], offer["line"], int(offer["gold"])])

func _side_pick(k: int) -> void:
	if k == 0: main.say([Quest.side_accept(offer), Quest.side_goal(offer)])

# ------------------------------------------------------------------ curators: relics and artifacts
func _curator() -> void:
	var found: Dictionary = Game.hero.get("found", {})
	var paid: Dictionary = Game.hero.get("paid", {})
	var rel := 0
	var art := 0
	var fresh := 0
	for id in found:
		if str(id).begins_with("relic"): rel += 1
		else: art += 1
		if not paid.has(id): paid[id] = true; fresh += 1
	Game.hero["paid"] = paid
	var lines := ["%s: The collection grows." % talking, "RELICS %d/42  ARTIFACTS %d/42" % [rel, art]]
	if fresh:
		var g := fresh * (100 + int(Game.hero["lvl"]) * 10)
		Game.hero["gold"] = int(Game.hero["gold"]) + g
		lines.append("For %d new find%s: %d G." % [fresh, "" if fresh == 1 else "s", g])
	else:
		lines.append("World bosses carry relics; raids guard artifacts.")
	main.say(lines)

## a relic or artifact: epic relics, legendary+ artifacts; recorded for the curators
func _treasure(slot: String, lvl: int) -> Dictionary:
	var ids := []
	for w in Data.game.get("WONDROUS", []):
		if w.get("slot") == slot: ids.append(w["id"])
	if ids.is_empty(): return {}
	var it := Game.make_item(str(ids[Game.rng.randi_range(0, ids.size() - 1)]), 4 if slot == "relic" else 5 + Game.rng.randi_range(0, 2), lvl)
	Game.bag().append(it)
	var f: Dictionary = Game.hero.get("found", {}); f[it["id"]] = true; Game.hero["found"] = f
	return it

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
	Social.count("trials")
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
	if k == 1:
		craft_prof = "cook"; _craft_menu(); return
	if k == 2:
		Social.open_companions(main); return
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

const MENU := ["CHARACTER", "GEAR & BAG", "ITEMS", "POTION", "QUEST", "MOUNT", "BOOK OF DEAD", "TRAVEL", "COMPANION", "BOUNTIES", "REALM", "SETTINGS", "SAVE", "SAVE & QUIT", "BACK"]
var menu_opts: Array = []
var menu_keys: Array = []

var item_ids: Array = []

func _use_item(k: int) -> void:
	if k < 0: return
	main.say(Craft.use_item(str(item_ids[k]), false)[0])

func _menu() -> void:
	Sound.sfx("open")
	menu_keys = MENU.filter(func(m): return m != "BOOK OF DEAD" or Game.army_cap() > 0)
	menu_opts = []
	for m in menu_keys:
		match m:
			"POTION": menu_opts.append("POTION (%d)" % int(Game.hero["potions"]))
			"MOUNT": menu_opts.append(("DISMOUNT" if Game.hero.get("mounted", false) else "MOUNT") if Game.hero.get("mount", "") != "" else "MOUNT (NONE)")
			_: menu_opts.append(m)
	main.choose(menu_opts, Callable(self, "_menu_pick"))

# ------------------------------------------------------------------ the Book of the Dead: a variant per minion kind, or sacrifice it
var _book_kind := ""

func _book() -> void:
	var bk := Game.book()
	main.choose(["WARRIORS: %s" % str(bk["warrior"]).to_upper(), "MAGES: %s" % str(bk["mage"]).to_upper(), "GOLEM: %s" % str(bk["golem"]).to_upper()], Callable(self, "_book_pick"),
		"Army of %d. Pick a variant, or sacrifice a kind for a lasting bonus." % Game.army_cap())

func _book_pick(k: int) -> void:
	if k < 0: return
	_book_kind = ["warrior", "mage", "golem"][k]
	var vs: Dictionary = Data.game.get("ARMY_VARIANTS", {}).get(_book_kind, {})
	main.choose(vs.values().map(func(v): return str(v["name"])) + ["SACRIFICE"], Callable(self, "_book_set"), "SACRIFICE: %s" % ", ".join(Data.game.get("SACRIFICE", {}).get(_book_kind, []).map(func(kv): return "+%s %s" % [kv[1], kv[0]])))

func _book_set(k: int) -> void:
	if k < 0: return
	var vs: Array = Data.game.get("ARMY_VARIANTS", {}).get(_book_kind, {}).keys()
	var b: Dictionary = Game.hero.get("book", {})
	b[_book_kind] = vs[k] if k < vs.size() else "sacrifice"
	Game.hero["book"] = b
	main.say(["%s: %s." % [_book_kind.to_upper(), str(b[_book_kind]).to_upper()], "Your army: %d raised next battle." % Game.army().size()])

func _menu_pick(k: int) -> void:
	if k < 0: return
	var pick: String = menu_keys[k]
	match pick:
		"CHARACTER": main.push(CharPage.new())
		"GEAR & BAG": main.push(Bag.new())
		"QUEST":
			var cp = CharPage.new(); cp.tab = 3; main.push(cp)
		"ITEMS":
			var ids: Array = Craft.items().keys()
			if ids.is_empty(): main.say(["No food or elixirs. Cook at an inn; brew at an alchemist."]); return
			var names := []
			for id in ids: names.append("%s x%d" % [Craft.item_name(id).substr(0, 14), int(Craft.items()[id])])
			item_ids = ids
			main.choose(names, Callable(self, "_use_item"), "Use which item?")
		"MOUNT":
			if Game.hero.get("mount", "") == "":
				main.say(["You have no mount. Stablemasters in towns sell them from level 15."])
			elif zone.has("dungeon"):
				main.say(["No riding in dungeons."])
			else:
				Game.hero["mounted"] = not Game.hero.get("mounted", false)
				main.say(["You ride your %s." % mount().get("name", "mount") if Game.hero["mounted"] else "You dismount."])
		"TRAVEL": Social.open_travel(main, self)
		"COMPANION": Social.open_companions(main)
		"BOUNTIES": Social.open_bounties(main)
		"REALM": main.push(load("res://scripts/realm.gd").new())
		"SETTINGS": main.push(load("res://scripts/settings.gd").new())
		"BOOK OF DEAD": _book()
		"POTION":
			if int(Game.hero["potions"]) <= 0:
				main.say(["No potions."])
				return
			Game.hero["potions"] = int(Game.hero["potions"]) - 1
			var h := (Game.roll("2d4+2") + int(Game.hero["lvl"]) / 5) * (100 + Game.stat("heal")) / 100
			Game.hero["hp"] = mini(Game.hp_max(), int(Game.hero["hp"]) + h)
			main.say(["+%d HP." % h])
		"SAVE": main.say(["Saved." if Game.save() else "Could not save."])
		"SAVE & QUIT":
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
		var nd := str(n.get("d", "down"))
		var ndir := "side" if nd in ["left", "right"] else nd
		var spr: String = "%s_%s%d" % [str(n["sprite"]) if n.get("sprite") else "gh_npc_townsman", ndir, int(n.get("f", 0))]
		var np2 := p
		if n.has("mt") and float(n["mt"]) > 0: np2 = (Vector2(int(n["px"]), int(n["py"])) * T - cam).lerp(p, 1.0 - float(n["mt"]) / NPC_STEP)
		Data.blit_fit(self, spr, Rect2(np2 + Vector2(0, -12), Vector2(T, T)), nd == "left")
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
		Data.blit_fit(self, Data.monster_art(m["def"], big), Rect2(mp + Vector2(-8 if big else 4, (-24 if big else -4) + bob), Vector2(80, 80) if big else Vector2(56, 56)), true)
	# other players on the realm, in this zone (browser or Godot)
	for op in Online.players_here():
		var opp := Vector2(int(op["x"]), int(op["y"])) * T - cam
		if opp.x < -T or opp.x > 640 or opp.y < -T or opp.y > 576: continue
		var od := "side" if op["d"] in ["left", "right"] else str(op["d"])
		Data.blit_fit(self, "gh_%s_%s0" % [op["cls"], od], Rect2(opp + Vector2(0, -12), Vector2(T, T)), op["d"] == "left")
		var nm2 := str(op["name"]).substr(0, 10)
		draw_rect(Rect2(opp.x + 32 - nm2.length() * 6 - 4, opp.y - 34, nm2.length() * 12 + 8, 20), Color(0.06, 0.07, 0.12, 0.75))
		Data.text_c(self, nm2, opp.x + 32, opp.y - 32, Color8(140, 220, 255), 0.5)
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
	# realm chat: the last few lines for 10 seconds each
	var now := Time.get_ticks_msec()
	var recent: Array = Online.chat.filter(func(c): return now - int(c["t"]) < 10000).slice(-3)
	for ci in range(recent.size()):
		var c: Dictionary = recent[ci]
		var line := ("[%s] %s: %s" % [str(c["channel"]).to_upper().substr(0, 1), str(c["name"]).substr(0, 10), str(c["text"])]).substr(0, 52)
		draw_rect(Rect2(4, 470 - (recent.size() - ci) * 22, 632, 22), Color(0.06, 0.07, 0.12, 0.6))
		Data.text(self, line, Vector2(10, 472 - (recent.size() - ci) * 22), Color8(255, 240, 160) if c["channel"] == "world" else Color.WHITE, 0.5)
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
