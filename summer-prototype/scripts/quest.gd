extends Node
## The main story (CHAPTERS in src/data_world.js; rules from chapterDef / chapterGoal / advanceChapter in src/systems.js).
## Autoload "Quest". State lives on the hero: chapter (index), chprog (progress), chseen (zones discovered this chapter).
## Every event returns the lines to show (an empty array when nothing happened).

func chapter() -> Dictionary:
	var i := int(Game.hero.get("chapter", 0))
	var C: Array = Data.game.get("CHAPTERS", [])
	if i >= C.size():
		return {}
	var c: Array = C[i]
	var obj := str(c[2]).split(":")
	var act := int(c[0])
	return {"i": i, "act": act, "title": c[1], "type": obj[0], "arg": obj[1] if obj.size() > 1 else "", "line": c[3],
		"region": str(Data.game.get("ACTS", [])[act - 1].get("zone", "elderwood"))}

func region_name(id: String) -> String:
	for r in Data.game.get("REGIONS", []):
		if r.get("id") == id:
			return str(r.get("name", id))
	return id.to_upper()

func dungeon_of(region: String) -> Dictionary:
	for d in Data.game.get("DUNGEONS", []):
		if d.get("zone") == region:
			return d
	return {}

func arc_boss(act: int) -> Dictionary:
	for b in Data.game.get("ARC_BOSSES", []):
		if int(b.get("act", 0)) == act:
			return b
	return {}

func goal() -> String:
	var ch := chapter()
	if ch.is_empty():
		return "The story is complete. Endgame awaits!"
	var reg := region_name(ch["region"])
	var p := int(Game.hero.get("chprog", 0))
	match ch["type"]:
		"talk": return "Talk to the ELDER in Elderwood village." if ch["arg"] == "elder" else "Talk to a warden in %s." % reg
		"kill": return "Defeat foes in %s (%d/%s)." % [reg, p, ch["arg"]]
		"explore": return "Discover areas of %s (%d/%s)." % [reg, p, ch["arg"]]
		"gather": return "Gather herbs in %s (%d/%s)." % [reg, p, ch["arg"]]
		"dungeon": return "Clear the dungeon %s." % dungeon_of(ch["region"]).get("name", "?")
		"boss": return "Defeat %s in %s." % [arc_boss(int(ch["act"])).get("name", "the boss"), dungeon_of(ch["region"]).get("name", reg)]
		"travel": return "Travel to %s." % reg
	return ""

## the region the hero is in (a dungeon counts as its region)
func here_region() -> String:
	if not Game.dun.is_empty():
		for d in Data.game.get("DUNGEONS", []) + Data.game.get("RAIDS", []):
			if d["id"] == Game.dun["id"]: return str(d.get("zone", ""))
		return ""
	return str(Data.zones.get(Game.zone_id, {}).get("region", ""))

func _advance() -> Array:
	var ch := chapter()
	var rw: Dictionary = Data.game.get("CHAPTER_REWARDS", [])[ch["i"]]
	var ups := Game.gain_xp(int(rw["xp"]))
	Game.hero["gold"] = int(Game.hero["gold"]) + int(rw["gold"])
	Game.hero["chapter"] = int(ch["i"]) + 1
	Social.count("quests")
	Game.hero["chprog"] = 0
	Game.hero["chseen"] = []
	var out := ["CHAPTER COMPLETE: %s" % ch["title"], "+%d XP  +%d G" % [int(rw["xp"]), int(rw["gold"])]]
	if ups: out.append("LEVEL UP! You are now level %d." % int(Game.hero["lvl"]))
	var nx := chapter()
	if nx.is_empty():
		out.append("The Ember Codex is whole. The dawn returns.")
	else:
		out.append_array(["NEW: %s" % nx["title"], str(nx["line"])])
		if nx["type"] == "travel" and here_region() == nx["region"]:
			out.append_array(_advance())   # already there
	return out

func _count(n: int = 1) -> Array:
	var ch := chapter()
	Game.hero["chprog"] = int(Game.hero.get("chprog", 0)) + n
	if int(Game.hero["chprog"]) >= int(ch["arg"]):
		return _advance()
	return []

# ------------------------------------------------------------------ events
func on_talk(svc: String) -> Array:
	var ch := chapter()
	if ch.is_empty() or ch["type"] != "talk": return []
	if (ch["arg"] == "elder" and svc == "elder") or (ch["arg"] != "elder" and svc == "warden" and here_region() == ch["region"]):
		return _advance()
	return []

func on_enter_zone(id: String) -> Array:
	var ch := chapter()
	if ch.is_empty(): return []
	var reg := str(Data.zones.get(id, {}).get("region", ""))
	if ch["type"] == "travel" and reg == ch["region"]:
		return _advance()
	if ch["type"] == "explore" and reg == ch["region"]:
		var seen: Array = Game.hero.get("chseen", [])
		if not seen.has(id):
			seen.append(id); Game.hero["chseen"] = seen
			return ["Discovered %s." % Data.zones[id].get("name", id)] + _count()
	return []

## a won battle: kill counts, herb gathering and crafting materials; arc bosses end their chapter
func on_kill(def: Dictionary, boss: bool) -> Array:
	var out := []
	var ch := chapter()
	var reg := here_region()
	out.append_array(Craft.drop_mats(def, reg))
	if Game.dun.is_empty():
		out.append_array(_side_event("worldboss" if def.has("where") else "kill", Game.zone_id))
	if ch.is_empty(): return out
	if ch["type"] == "boss" and def.get("id") == arc_boss(int(ch["act"])).get("id"):
		return out + _advance()
	if reg != ch["region"]: return out
	if ch["type"] == "kill":
		out.append_array(_count())
	elif ch["type"] == "gather" and Game.rng.randf() < 0.6:
		out.append("Gathered a herb for the quest.")
		out.append_array(_count())
	return out

func on_dungeon_clear(dungeon_id: String) -> Array:
	var ch := chapter()
	if ch.is_empty() or ch["type"] != "dungeon": return []
	if dungeon_of(ch["region"]).get("id") == dungeon_id:
		return _advance()
	return []

## during a "boss" chapter, the last floor of the region's dungeon is guarded by the act's arc boss
func arc_boss_for(dungeon_id: String) -> Dictionary:
	var ch := chapter()
	if ch.is_empty() or ch["type"] != "boss": return {}
	if dungeon_of(ch["region"]).get("id") != dungeon_id: return {}
	return arc_boss(int(ch["act"]))

# ------------------------------------------------------------------ side quests (SIDE_TEMPLATES): wardens in every wild zone
## up to 3 active, each {zone, type, n, prog, title, gold, xp}; they turn in by themselves when done
const SIDE_MAX := 3

func side_list() -> Array:
	if not Game.hero.has("sq"):
		Game.hero["sq"] = []
	return Game.hero["sq"]

## the quest this zone's warden offers right now (it changes after each one you finish there)
func side_offer(zone_id: String) -> Dictionary:
	var z: Dictionary = Data.zones.get(zone_id, {})
	var done: int = int(Game.hero.get("sqdone", {}).get(zone_id, 0))
	var rng := RandomNumberGenerator.new()
	rng.seed = hash("%s-%d" % [zone_id, done])
	var types := ["kill", "kill", "gather", "fish"]
	if z.get("bosses", []).size(): types.append("worldboss")
	var t: String = types[rng.randi_range(0, types.size() - 1)]
	if t == "fish" and not _has_water(z): t = "gather"
	var n: int = {"kill": rng.randi_range(5, 8), "gather": 3, "fish": 3, "worldboss": 1}[t]
	var tpl: Array = []
	for row in Data.game.get("SIDE_TEMPLATES", []):
		if row[1] == {"worldboss": "worldboss", "kill": "kill", "gather": "gather", "fish": "fish"}[t]: tpl = row
	var area := str(z.get("name", zone_id))
	var fam: String = ["wolves", "bandits", "spiders", "wraiths", "beasts"][rng.randi_range(0, 4)]
	var line := str(tpl[2] if tpl.size() else "Help the camp.").replace("{fam}", fam).replace("{area}", area).replace("{n}", str(n)).replace("{npc}", "warden").replace("{boss}", "the beast")
	var L := maxi(int(z.get("lvl", [1, 1])[1]), 1)
	return {"zone": zone_id, "type": t, "n": n, "prog": 0, "title": str(tpl[0] if tpl.size() else "TASK"), "line": line,
		"gold": 30 + L * 12, "xp": maxi(50, (Data.xp_for(L + 1) - Data.xp_for(L)) * 15 / 100)}

func _has_water(z: Dictionary) -> bool:
	for row in z.get("gfx", []):
		for t in row:
			if str(t).contains("water"): return true
	return false

func side_has(zone_id: String) -> bool:
	for q in side_list():
		if q["zone"] == zone_id: return true
	return false

func side_accept(q: Dictionary) -> String:
	if side_list().size() >= SIDE_MAX: return "You already carry %d side quests." % SIDE_MAX
	side_list().append(q)
	return "SIDE QUEST: %s" % q["title"]

func side_goal(q: Dictionary) -> String:
	var where := str(Data.zones.get(q["zone"], {}).get("name", q["zone"]))
	match q["type"]:
		"kill": return "%s: defeat foes (%d/%d)" % [where, int(q["prog"]), int(q["n"])]
		"gather": return "%s: gather (%d/%d)" % [where, int(q["prog"]), int(q["n"])]
		"fish": return "%s: catch fish (%d/%d)" % [where, int(q["prog"]), int(q["n"])]
		"worldboss": return "%s: slay the world boss" % where
	return where

func _side_event(type: String, zone_id: String) -> Array:
	var out := []
	for q in side_list().duplicate():
		if q["type"] != type or q["zone"] != zone_id: continue
		q["prog"] = int(q["prog"]) + 1
		if int(q["prog"]) >= int(q["n"]):
			side_list().erase(q)
			Social.count("quests")
			var ups := Game.gain_xp(int(q["xp"]))
			Game.hero["gold"] = int(Game.hero["gold"]) + int(q["gold"])
			var dn: Dictionary = Game.hero.get("sqdone", {}); dn[zone_id] = int(dn.get(zone_id, 0)) + 1; Game.hero["sqdone"] = dn
			out.append_array(["SIDE QUEST DONE: %s" % q["title"], "+%d XP  +%d G" % [int(q["xp"]), int(q["gold"])]])
			if ups: out.append("LEVEL UP! You are now level %d." % int(Game.hero["lvl"]))
	return out

func on_gather(zone_id: String) -> Array:
	return _side_event("gather", zone_id)

func on_fish(zone_id: String) -> Array:
	return _side_event("fish", zone_id)
