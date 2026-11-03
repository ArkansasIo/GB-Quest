extends Node
## Autoload "Social": the systems around the adventure, each following its browser-game module.
##   activity counters (G.stats)        talents (TALENT_TREES)            companions and bonds (src/companions.js)
##   guild levels and perks (src/guild_prog.js)                          conquest: boonstones and the castle (src/guild_war.js)
##   daily bounties (src/mmo_loop.js)   arena rating and honor            home storage and the bank
##   waypoints and travel               the Spire (tower bosses)          difficulty 1-9 (DIFFICULTY)
## Menus take `main` (the screen stack) so any NPC or the START menu can open them.

const Battle = preload("res://scripts/battle.gd")
var main: Node2D

func h() -> Dictionary:
	return Game.hero

func _d(key: String) -> Dictionary:
	if not h().has(key) or not (h()[key] is Dictionary): h()[key] = {}
	return h()[key]

# ------------------------------------------------------------------ activity counters (feed guild XP and bounties)
func count(k: String, n: int = 1) -> void:
	_d("stats")[k] = int(_d("stats").get(k, 0)) + n

func stat_of(k: String) -> int:
	return int(_d("stats").get(k, 0))

# ------------------------------------------------------------------ substat bonuses from these systems (added in Game.stat)
func stat(k: String) -> int:
	var v := 0
	for id in talents():
		var n := talent_node(id)
		v += int(n.get("mods", {}).get(k, 0))
	for kv in bond_stats():
		if kv[0] == k: v += int(kv[1])
	for kv in guild_perk_stats():
		if kv[0] == k: v += int(kv[1])
	if castle_owned():
		for kv in Data.game.get("CASTLE_BUFF", []):
			if kv[0] == k: v += int(kv[1])
	return v

## % max HP from talents (FORTRESS)
func hp_pct() -> int:
	var v := 0
	for id in talents(): v += int(talent_node(id).get("mods", {}).get("hpPct", 0))
	return v

# ------------------------------------------------------------------ talents: one point per 5 levels, nodes in order along each tree
func talents() -> Array:
	if not h().has("talents"): h()["talents"] = []
	return h()["talents"]

func talent_points() -> int:
	return mini(12, int(h().get("lvl", 1)) / 5) - talents().size()

func talent_node(id: String) -> Dictionary:
	for t in Data.game.get("TALENT_TREES", []):
		for n in t["nodes"]:
			if n["id"] == id: return n
	return {}

func can_learn(n: Dictionary) -> String:
	if talents().has(n["id"]): return "Learned."
	if int(h()["lvl"]) < int(n["level"]): return "Needs level %d." % int(n["level"])
	if n.has("requires") and not talents().has(n["requires"]): return "Learn %s first." % talent_node(n["requires"]).get("name", "")
	if talent_points() <= 0: return "No talent points (one per 5 levels)."
	return ""

func learn(n: Dictionary) -> String:
	var why := can_learn(n)
	if why != "": return why
	talents().append(n["id"])
	return "Learned %s: %s" % [n["name"], n["desc"]]

func reset_talents() -> String:
	var cost := 50 * int(h()["lvl"])
	if int(h()["gold"]) < cost: return "A reset costs %d G." % cost
	h()["gold"] = int(h()["gold"]) - cost
	h()["talents"] = []
	return "Talents reset for %d G." % cost

# ------------------------------------------------------------------ companions: hire at inns, one fights beside you, bonds grow with wins
func comp_def(id: String) -> Dictionary:
	for c in Data.game.get("COMPANION_DEFS", []):
		if c["id"] == id: return c
	return {}

func companion() -> Dictionary:
	return comp_def(str(h().get("comp", "")))

func bond() -> int:
	return int(_d("bonds").get(str(h().get("comp", "")), 0))

func bond_tier() -> Dictionary:
	var best: Dictionary = {}
	for t in Data.game.get("BOND_TIERS", []):
		if bond() >= int(t["at"]): best = t
	return best

func bond_stats() -> Array:
	var out := []
	if companion().is_empty(): return out
	var b: Dictionary = bond_tier().get("bond", {})
	for k in b: out.append([k, int(b[k])])
	return out

## the companion's turn: dps strike, healers mend you under 60% HP, tanks hit lightly (their guard is applied to the foe's hits)
func companion_turn(foe: Dictionary) -> Array:
	var c := companion()
	if c.is_empty(): return []
	var L := maxi(int(c["lvl"]), int(h()["lvl"]) - 2)
	var nm := str(c["name"])
	if c["role"] == "healer" and float(h()["hp"]) / maxf(1, Game.hp_max()) < 0.6:
		var heal := maxi(1, Game.hp_max() * 15 / 100)
		h()["hp"] = mini(Game.hp_max(), int(h()["hp"]) + heal)
		return ["%s heals you for %d." % [nm, heal]]
	if Game.rng.randi_range(1, 20) + 2 + L / 4 < int(foe["ac"]):
		return ["%s misses." % nm]
	var dmg := maxi(1, Game.roll("1d8") + L / (2 if c["role"] == "dps" else 4))
	foe["hp"] = int(foe["hp"]) - dmg
	return ["%s hits for %d." % [nm, dmg]]

func companion_guard() -> int:
	return 20 if companion().get("role") == "tank" else 0

func bond_up() -> void:
	if companion().is_empty(): return
	var id := str(h()["comp"])
	_d("bonds")[id] = mini(100, int(_d("bonds").get(id, 0)) + 1)

func open_companions(m: Node2D) -> void:
	main = m
	var names := []
	_comp_list = []
	for c in Data.game.get("COMPANION_DEFS", []):
		_comp_list.append(c)
		var hired: bool = _d("hired").has(c["id"])
		var tag := "*" if str(h().get("comp", "")) == c["id"] else ("" if hired else ("%dG" % int(c["fee"]) if int(c["lvl"]) <= int(h()["lvl"]) else "L%d" % int(c["lvl"])))
		names.append("%s %s %s" % [str(c["name"]).substr(0, 8), str(c["role"]).to_upper().substr(0, 4), tag])
	main.choose(names + ["DISMISS"], Callable(self, "_comp_pick"), "Companions (* = with you).")

var _comp_list: Array = []

func _comp_pick(k: int) -> void:
	if k < 0: return
	if k >= _comp_list.size():
		h()["comp"] = ""; main.say(["You travel alone."]); return
	var c: Dictionary = _comp_list[k]
	if not _d("hired").has(c["id"]):
		if int(c["lvl"]) > int(h()["lvl"]): main.say(["%s will join you at level %d." % [c["name"], int(c["lvl"])]]); return
		if int(h()["gold"]) < int(c["fee"]): main.say(["%s asks %d G." % [c["name"], int(c["fee"])]]); return
		h()["gold"] = int(h()["gold"]) - int(c["fee"]); _d("hired")[c["id"]] = true
	h()["comp"] = c["id"]
	main.say(["%s joins you. (%s)" % [c["name"], str(c["role"]).to_upper()], str(c.get("bio", "")), "BOND %d: %s" % [bond(), bond_tier().get("name", "")]])

# ------------------------------------------------------------------ guild: levels from activity (GUILD_WEIGHTS), perks at levels
func in_guild() -> bool:
	return str(h().get("guild", "")) != ""

func guild_xp() -> int:
	if not in_guild(): return 0
	var xp := 0
	var base: Dictionary = h().get("gbase", {})
	var W: Dictionary = Data.game.get("GUILD_WEIGHTS", {})
	for k in W: xp += maxi(0, stat_of(k) - int(base.get(k, 0))) * int(W[k])
	return xp + int(h().get("gbonus", 0))

func guild_xp_for(lvl: int) -> int:
	return 0 if lvl <= 1 else roundi(1000 * pow(lvl - 1, 1.6))

func guild_level() -> int:
	var l := 1
	while l < int(Data.game.get("GUILD_MAX_LEVEL", 25)) and guild_xp() >= guild_xp_for(l + 1): l += 1
	return l

func guild_perk_stats() -> Array:
	var out := []
	if not in_guild(): return out
	for p in Data.game.get("GUILD_PERKS", []):
		if guild_level() >= int(p["lvl"]):
			for kv in p.get("stats", []): out.append(kv)
	return out

func open_guild(m: Node2D) -> void:
	main = m
	if not in_guild():
		main.choose(["FOUND A GUILD (100 G)", "LEAVE"], Callable(self, "_found"), "Guildmaster: Every legend needs a banner.")
		return
	var nx := guild_xp_for(guild_level() + 1)
	main.choose(["GUILD INFO", "PERKS", "CONQUEST", "COLLECT TAX", "LEAVE"], Callable(self, "_guild_pick"), "%s  LV %d  XP %d/%d" % [h()["guild"], guild_level(), guild_xp(), nx])

func _found(k: int) -> void:
	if k != 0: return
	if int(h()["gold"]) < 100: main.say(["Founding a guild costs 100 G."]); return
	h()["gold"] = int(h()["gold"]) - 100
	var names: Array = Data.game.get("GUILD_NAMES", ["LANTERN KEEPERS"])
	h()["guild"] = str(names[Game.rng.randi_range(0, names.size() - 1)])
	h()["gbase"] = _d("stats").duplicate()
	main.say(["You found %s!" % h()["guild"], "Kills, dungeons, raids, trials, quests, crafting and fishing raise the guild level."])

func _guild_pick(k: int) -> void:
	match k:
		0:
			var lines := ["%s: level %d" % [h()["guild"], guild_level()], "Activity: %d kills, %d dungeons, %d raids, %d quests." % [stat_of("kills"), stat_of("dungeons"), stat_of("raids"), stat_of("quests")]]
			main.say(lines)
		1:
			var lines := []
			for p in Data.game.get("GUILD_PERKS", []):
				lines.append("%s L%d %s: %s" % ["*" if guild_level() >= int(p["lvl"]) else "-", int(p["lvl"]), p["name"], p["desc"]])
			main.say(lines)
		2: open_conquest(main)
		3: main.say([collect_tax()])

# ------------------------------------------------------------------ conquest: a boonstone per wild region, then the castle
func regions() -> Array:
	return Data.game.get("REGIONS", []).filter(func(r): return not r.get("town", false))

func stone_owner(rid: String) -> String:
	var st: Dictionary = _d("stones")
	if st.has(rid): return str(st[rid])
	var ai: Array = Data.game.get("AI_GUILDS", ["IRON TALONS"])
	return str(ai[absi(hash("stone|" + rid)) % ai.size()])

func my_stones() -> Array:
	return regions().filter(func(r): return stone_owner(r["id"]) == "YOU").map(func(r): return r["id"])

func castle_owned() -> bool:
	return _d("castle").get("owner", "") == "YOU"

## +10% XP and gold from foes in a region whose stone you hold
func region_bonus(rid: String) -> int:
	return 10 if stone_owner(rid) == "YOU" else 0

var _cq_list: Array = []

func open_conquest(m: Node2D) -> void:
	main = m
	if not in_guild(): main.say(["Conquest is for guilds. Found one with a guildmaster."]); return
	_cq_list = regions()
	var names := []
	for r in _cq_list:
		var own := stone_owner(r["id"])
		names.append("%s %s" % [str(r["name"]).substr(0, 10), "(YOURS)" if own == "YOU" else own.substr(0, 9)])
	names.append("CASTLE %s" % ("(YOURS)" if castle_owned() else "SIEGE %d/%d" % [my_stones().size(), int(Data.game.get("CASTLE_NEEDS", 3))]))
	main.choose(names, Callable(self, "_cq_pick"), "Boonstones: +10% XP and gold in a held region.")

func _cq_pick(k: int) -> void:
	if k < 0: return
	if k == _cq_list.size():
		if castle_owned(): main.say(["ARDENHOLD KEEP is yours: +5% damage, +5% resist all, +10% XP."]); return
		if my_stones().size() < int(Data.game.get("CASTLE_NEEDS", 3)): main.say(["Hold %d boonstones to besiege the castle." % int(Data.game.get("CASTLE_NEEDS", 3))]); return
		run_waves("castle", 20 + int(h()["lvl"]), Callable(self, "_castle_won"), "ARDENHOLD KEEP")
		return
	var r: Dictionary = _cq_list[k]
	if stone_owner(r["id"]) == "YOU": main.say(["%s's boonstone is yours." % r["name"]]); return
	run_waves("stone", maxi(int(r.get("lvl", [1, 1])[0]), int(h()["lvl"])), Callable(self, "_stone_won").bind(r["id"]), "%s BOONSTONE" % r["name"])

func _stone_won(rid: String) -> void:
	_d("stones")[rid] = "YOU"
	_d("taxat")[rid] = Time.get_unix_time_from_system()
	main.say(["The boonstone is yours!", "+10% XP and gold from foes in this region."])

func _castle_won() -> void:
	_d("castle")["owner"] = "YOU"
	_d("castle")["at"] = Time.get_unix_time_from_system()
	h()["title"] = "CASTLE LORD"
	main.say(["ARDENHOLD KEEP FALLS TO %s!" % h()["guild"], "CASTLE LORD: +5% damage, +5% resist, +10% XP."])

## daily tax from held stones and the castle (src/guild_war.js stoneTax / castleTax, up to 7 days banked)
func collect_tax() -> String:
	var now := Time.get_unix_time_from_system()
	var total := 0
	var L := int(h()["lvl"])
	for rid in my_stones():
		var days := floorf(clampf((now - float(_d("taxat").get(rid, now))) / 86400.0, 0, 7))
		total += roundi((50 + L * 10) * days)
		if days >= 1: _d("taxat")[rid] = now
	if castle_owned():
		var cd := floorf(clampf((now - float(_d("castle").get("taxat", _d("castle").get("at", now)))) / 86400.0, 0, 7))
		total += roundi((500 + L * 50) * cd)
		if cd >= 1: _d("castle")["taxat"] = now
	if total <= 0: return "No tax is due yet (it gathers daily)."
	h()["gold"] = int(h()["gold"]) + total
	return "Tax collected: %d G." % total

# ------------------------------------------------------------------ battle series: conquest waves, arena teams, the Spire
var _series: Array = []
var _series_done: Callable
var _series_name := ""

## CHALLENGE_WAVES[kind]: waves of `count` foes at hero level + lvlAdd with hp multipliers; the last may be a boss
func run_waves(kind: String, lvl: int, done: Callable, title: String) -> void:
	var list := []
	var pool: Array = Data.game.get("BESTIARY", []).filter(func(b): return b["fam"] in ["humanoid", "giant", "construct"])
	for w in Data.game.get("CHALLENGE_WAVES", {}).get(kind, []):
		for i in range(int(w["count"])):
			var def: Dictionary = pool[Game.rng.randi_range(0, pool.size() - 1)].duplicate()
			def["name"] = str(w["name"]) if w.get("boss", false) or w.get("gate", false) else str(def["name"])
			list.append({"def": def, "lvl": lvl + int(w["lvlAdd"]), "hp": float(w["hp"]), "boss": w.get("boss", false)})
	run_series(list, done, title)

func run_series(list: Array, done: Callable, title: String) -> void:
	_series = list
	_series_done = done
	_series_name = title
	main.say(["%s: %d fights." % [title, list.size()]], Callable(self, "_series_next"))

func _series_next() -> void:
	if _series.is_empty():
		h()["hp"] = maxi(int(h()["hp"]), 1)
		if _series_done.is_valid(): _series_done.call()
		return
	var f: Dictionary = _series.pop_front()
	var b := Battle.new()
	b.foe_def = f["def"]
	b.foe_lvl = int(f["lvl"])
	b.biome = "dusk"
	b.boss = f.get("boss", false)
	b.hp_scale = float(f.get("hp", 1.0))
	b.no_escape = true
	b.loot = false
	b.on_win = Callable(self, "_series_next")
	b.on_lose = Callable(self, "_series_lost")
	main.push(b)

func _series_lost() -> void:
	_series = []
	h()["hp"] = Game.hp_max()
	main.say(["%s: defeated. Try again when ready." % _series_name])

# ------------------------------------------------------------------ arena: AI rivals of every class, rating and honor
func open_arena(m: Node2D) -> void:
	main = m
	main.choose(["RANKED 1V1", "TEAM 3V3", "LEAVE"], Callable(self, "_arena_pick"), "ARENA  Rating %d  Honor %d" % [int(h().get("rating", 1000)), int(h().get("honor", 0))])

var _arena_n := 1

func _arena_pick(k: int) -> void:
	if k < 0 or k == 2: return
	_arena_n = 1 if k == 0 else 3
	var list := []
	var names: Array = Data.game.get("SIM_NAMES", ["RIVAL"])
	for i in range(_arena_n):
		var cs: Array = Data.game.get("CLASS_ORDER", ["warden"])
		var c: String = cs[Game.rng.randi_range(0, cs.size() - 1)]
		list.append({"def": {"name": str(names[Game.rng.randi_range(0, names.size() - 1)]), "art": "c_%s_4" % c, "fam": "humanoid", "dt": "slashing"},
			"lvl": int(h()["lvl"]) + Game.rng.randi_range(-1, 1), "hp": 2.0, "boss": false})
	run_series(list, Callable(self, "_arena_won"), "ARENA %dV%d" % [_arena_n, _arena_n])

func _arena_won() -> void:
	var honor := (20 + int(h()["lvl"])) * _arena_n
	h()["honor"] = int(h().get("honor", 0)) + honor
	h()["rating"] = int(h().get("rating", 1000)) + 18 * _arena_n
	count("pvpWins")
	main.say(["Victory! +%d honor. Rating %d." % [honor, int(h()["rating"])]])

## the quartermaster sells epic and legendary gear for honor
var _honor_stock: Array = []

func open_honor(m: Node2D) -> void:
	main = m
	_honor_stock = []
	var names := []
	for i in range(5):
		var it := Game.random_drop(int(h()["lvl"]) + 10)
		it = Game.make_item(str(it["id"]), 4 if i < 3 else 5, int(h()["lvl"]) + 10)
		_honor_stock.append(it)
		names.append("%s %dH" % [Game.item_name(it).substr(0, 12), honor_price(it)])
	main.choose(names, Callable(self, "_honor_buy"), "Quartermaster: Honor %d." % int(h().get("honor", 0)))

func honor_price(it: Dictionary) -> int:
	return (60 if int(it["r"]) == 4 else 160) + int(h()["lvl"]) * 2

func _honor_buy(k: int) -> void:
	if k < 0: return
	var it: Dictionary = _honor_stock[k]
	if int(h().get("honor", 0)) < honor_price(it): main.say(["That costs %d honor." % honor_price(it)]); return
	h()["honor"] = int(h()["honor"]) - honor_price(it)
	Game.bag().append(it)
	main.say(["Bought %s." % Game.item_name(it)])

# ------------------------------------------------------------------ daily bounties (BOUNTY_TYPES): three a day, from your activity counters
func today() -> String:
	return Time.get_date_string_from_system()

func bounties() -> Array:
	var b: Dictionary = _d("bounty")
	if b.get("day", "") != today():
		var pool: Array = Data.game.get("BOUNTY_TYPES", []).filter(func(t): return int(h()["lvl"]) >= int(t.get("minLvl", 1)) and not t.get("weekOnly", false))
		var rng := RandomNumberGenerator.new()
		rng.seed = hash("%s|%s" % [h().get("name", ""), today()])
		var list := []
		while list.size() < 3 and pool.size():
			var t: Dictionary = pool.pop_at(rng.randi_range(0, pool.size() - 1))
			list.append({"id": t["id"], "stat": t["stat"], "name": t["name"], "target": int(t["day"]), "base": stat_of(str(t["stat"])), "claimed": false})
		h()["bounty"] = {"day": today(), "list": list}
	return h()["bounty"]["list"]

func bounty_progress(b: Dictionary) -> int:
	return clampi(stat_of(str(b["stat"])) - int(b["base"]), 0, int(b["target"]))

func open_bounties(m: Node2D) -> void:
	main = m
	var names := []
	for b in bounties():
		names.append("%s%s %d/%d" % ["# " if b["claimed"] else ("! " if bounty_progress(b) >= int(b["target"]) else ""), str(b["name"]).substr(0, 14), bounty_progress(b), int(b["target"])])
	main.choose(names, Callable(self, "_bounty_pick"), "BOUNTY BOARD %s  (! = ready)" % today())

func _bounty_pick(k: int) -> void:
	if k < 0: return
	var b: Dictionary = bounties()[k]
	if b["claimed"]: main.say(["Already claimed. New bounties tomorrow."]); return
	if bounty_progress(b) < int(b["target"]): main.say(["Not finished yet."]); return
	b["claimed"] = true
	var L := int(h()["lvl"])
	var gold := 40 + L * 15
	var xp := (Data.xp_for(L + 1) - Data.xp_for(L)) * 12 / 100
	h()["gold"] = int(h()["gold"]) + gold
	var ups := Game.gain_xp(xp)
	Craft.add("scrap", 4)
	count("bounties")
	main.say(["Bounty claimed: +%d G, +%d XP, 4 SCRAP." % [gold, xp]] + (["LEVEL UP! You are now level %d." % int(h()["lvl"])] if ups else []))

# ------------------------------------------------------------------ homes and the bank: storage for gear
func open_home(m: Node2D) -> void:
	main = m
	var homes: Dictionary = _d("homes")
	var key := Game.zone_id
	if not homes.has(key):
		main.choose(["BUY HOME (500 G)", "LEAVE"], Callable(self, "_buy_home"), "Housing steward: a home here?")
		return
	var lv := int(homes[key]["level"])
	main.choose(["STORE GEAR", "TAKE GEAR", "REST", "UPGRADE (%s)" % ("MAX" if lv >= 5 else "%dG" % (lv * 300)), "LEAVE"], Callable(self, "_home_pick"), "Your home: storage %d/%d." % [store().size(), lv * 20])

func store() -> Array:
	if not h().has("store"): h()["store"] = []
	return h()["store"]

func store_cap() -> int:
	var best := 20   # the bank in Ardenhold holds 20 even without a home
	for k in _d("homes"): best = maxi(best, int(_d("homes")[k]["level"]) * 20)
	return best

func _buy_home(k: int) -> void:
	if k != 0: return
	if int(h()["gold"]) < 500: main.say(["A home costs 500 G."]); return
	h()["gold"] = int(h()["gold"]) - 500
	_d("homes")[Game.zone_id] = {"level": 1}
	main.say(["NEW HOME in %s!" % Data.zones.get(Game.zone_id, {}).get("name", "town"), "Store gear here; rest for free."])

func _home_pick(k: int) -> void:
	match k:
		0: _store_menu()
		1: _take_menu()
		2:
			h()["hp"] = Game.hp_max(); h()["fed"] = int(h().get("steps", 0)) + 300
			main.say(["You rest at home. HP full, WELL FED."])
		3:
			var hm: Dictionary = _d("homes")[Game.zone_id]
			if int(hm["level"]) >= 5: main.say(["Storage is fully upgraded."]); return
			var cost := int(hm["level"]) * 300
			if int(h()["gold"]) < cost: main.say(["The upgrade costs %d G." % cost]); return
			h()["gold"] = int(h()["gold"]) - cost; hm["level"] = int(hm["level"]) + 1
			main.say(["Storage %d." % (int(hm["level"]) * 20)])

func open_bank(m: Node2D) -> void:
	main = m
	main.choose(["DEPOSIT GEAR", "WITHDRAW GEAR", "LEAVE"], Callable(self, "_bank_pick"), "Banker: %d/%d stored." % [store().size(), store_cap()])

func _bank_pick(k: int) -> void:
	if k == 0: _store_menu()
	elif k == 1: _take_menu()

func _store_menu() -> void:
	if Game.bag().is_empty(): main.say(["Your bag is empty."]); return
	main.choose(Game.bag().map(func(it): return Game.item_name(it).substr(0, 18)), Callable(self, "_store"), "Store which item? (%d/%d)" % [store().size(), store_cap()])

func _store(k: int) -> void:
	if k < 0: return
	if store().size() >= store_cap(): main.say(["Storage is full."]); return
	store().append(Game.bag()[k]); Game.bag().remove_at(k)
	main.say(["Stored."])

func _take_menu() -> void:
	if store().is_empty(): main.say(["Storage is empty."]); return
	main.choose(store().map(func(it): return Game.item_name(it).substr(0, 18)), Callable(self, "_take"), "Take which item?")

func _take(k: int) -> void:
	if k < 0: return
	Game.bag().append(store()[k]); store().remove_at(k)
	main.say(["Taken."])

# ------------------------------------------------------------------ waypoints: step on one to attune; travel from START > TRAVEL or a harbormaster
func attune(zone_id: String) -> bool:
	if _d("wps").has(zone_id): return false
	_d("wps")[zone_id] = true
	return true

var _wp_list: Array = []

func open_travel(m: Node2D, field: Node) -> void:
	main = m
	_wp_list = ["ardenhold"] + _d("wps").keys()
	var names := []
	for z in _wp_list: names.append("%s %dG" % [str(Data.zones.get(z, {}).get("name", z)).substr(0, 14), travel_cost()])
	main.choose(names, Callable(self, "_travel").bind(field), "Travel to an attuned waypoint.")

func travel_cost() -> int:
	return 10 + int(h()["lvl"]) / 2

func _travel(k: int, field: Node) -> void:
	if k < 0: return
	if not Game.dun.is_empty(): main.say(["Not from inside a dungeon."]); return
	if int(h()["gold"]) < travel_cost(): main.say(["Travel costs %d G." % travel_cost()]); return
	h()["gold"] = int(h()["gold"]) - travel_cost()
	var z: Dictionary = Data.zones.get(_wp_list[k], {})
	var wp = z.get("waypoint")
	var hub: Array = z.get("hub", [3, 8])
	Game.pos = Vector2i(int(wp["x"]), int(wp["y"]) + 1) if wp is Dictionary else Vector2i(int(hub[0]), int(hub[1]))
	field.call("_load_zone", _wp_list[k])

# ------------------------------------------------------------------ the Spire: climb floor by floor against the tower bosses
func open_tower(m: Node2D) -> void:
	main = m
	var best := int(h().get("spire", 0))
	main.choose(["CLIMB TO FLOOR %d" % (best + 1), "LEAVE"], Callable(self, "_tower_pick"), "Spire keeper: your best is floor %d." % best)

func _tower_pick(k: int) -> void:
	if k != 0: return
	var fl := int(h().get("spire", 0)) + 1
	var tb: Array = Data.game.get("TOWER_BOSSES", [])
	var def: Dictionary = tb[(fl - 1) % maxi(1, tb.size())] if tb.size() else {"name": "SPIRE GUARDIAN", "fam": "construct"}
	run_series([{"def": def, "lvl": 5 + fl * 5, "hp": 2.0 + fl * 0.1, "boss": true}], Callable(self, "_tower_won"), "SPIRE FLOOR %d" % fl)

func _tower_won() -> void:
	var fl := int(h().get("spire", 0)) + 1
	h()["spire"] = fl
	var gold := 50 * fl
	h()["gold"] = int(h()["gold"]) + gold
	var lines := ["SPIRE FLOOR %d CLEARED. +%d G." % [fl, gold]]
	if fl % 5 == 0:
		var it := Game.make_item(str(Game.random_drop(5 + fl * 5)["id"]), mini(8, 4 + fl / 10), 5 + fl * 5)
		Game.bag().append(it); lines.append("Spire chest: %s!" % Game.item_name(it))
	main.say(lines)

# ------------------------------------------------------------------ difficulty (DIFFICULTY 1-9): the oracle sets it, battles read it
func difficulty() -> Dictionary:
	var D: Array = Data.game.get("DIFFICULTY", [])
	return D[clampi(int(h().get("diff", 2)) - 1, 0, D.size() - 1)] if D.size() else {"hp": 1, "dmg": 1, "xp": 1, "loot": 1, "lvl": 0}

func open_oracle(m: Node2D) -> void:
	main = m
	var names := []
	for d in Data.game.get("DIFFICULTY", []):
		names.append("%s%s%s" % ["*" if int(d["n"]) == int(h().get("diff", 2)) else "", d["name"], " L%d" % int(d.get("req", 0)) if d.has("req") else ""])
	main.choose(names, Callable(self, "_diff"), "Oracle: foes x HP, x damage; more XP and loot.")

func _diff(k: int) -> void:
	if k < 0: return
	var d: Dictionary = Data.game["DIFFICULTY"][k]
	if int(h()["lvl"]) < int(d.get("req", 0)): main.say(["%s opens at level %d." % [d["name"], int(d["req"])]]); return
	h()["diff"] = int(d["n"])
	main.say(["Difficulty: %s." % d["name"], "Foes: x%.2f HP, x%.2f damage. Rewards: x%.2f XP, x%.2f loot." % [float(d["hp"]), float(d["dmg"]), float(d["xp"]), float(d["loot"])]])
