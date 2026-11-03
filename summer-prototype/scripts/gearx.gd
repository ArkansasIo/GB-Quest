extends RefCounted
## Accessories (WONDROUS), gem sockets (src/gems.js), tempering and masterwork (src/d4_gear.js) for owned items.
## Item fields used here:  "k": "o" for an accessory,  "sk": [gem ids or ""],  "tm": [[stat, value], ...],  "mw": rank,  "mwc": [affix indices]

const ACC_SLOTS := ["head", "neck", "ear", "back", "hands", "waist", "legs", "feet", "ring1", "ring2", "trinket1", "trinket2"]
## what each accessory bonus kind does in the port, per point of the item's plus (min 1)
const ACC_BONUS := {"ac": ["acb", 1], "save": ["resist", 2], "init": ["haste", 3], "abil": ["dmg", 3], "hit": ["hit", 1], "hp": ["hp", 5]}

static var _wond: Dictionary = {}

static func wondrous(id: String) -> Dictionary:
	if _wond.is_empty():
		for w in Data.game.get("WONDROUS", []):
			_wond[w["id"]] = w
	return _wond.get(id, {})

static func accessory_ids() -> Array:
	var out := []
	for w in Data.game.get("WONDROUS", []):
		if not (w.get("slot") in ["relic", "artifact"]):
			out.append(w["id"])
	return out

## the slot an accessory goes to: rings and trinkets fill the first free of their two slots
static func acc_slot(it: Dictionary, gear: Dictionary) -> String:
	var s := str(wondrous(str(it["id"])).get("slot", "trinket"))
	if s == "ring": return "ring1" if not gear.has("ring1") else "ring2"
	if s == "trinket": return "trinket1" if not gear.has("trinket1") else "trinket2"
	return s

static func acc_bonus(it: Dictionary) -> Array:
	var b = ACC_BONUS.get(str(wondrous(str(it["id"])).get("bonus", "")))
	if b == null: return []
	return [b[0], int(b[1]) * maxi(1, int(it.get("plus", 0)))]

# ------------------------------------------------------------------ gems
static func socket_cap(it: Dictionary) -> int:
	if it.get("k") == "o": return 0
	return mini(int(Data.game.get("GEM_SOCKET_LIMIT", 4)), 1 + (clampi(int(it.get("ilvl", 1)), 1, 720) - 1) / 180)

static func sockets(it: Dictionary) -> Array:
	var cap := socket_cap(it)
	var s: Array = it.get("sk", [])
	while s.size() < cap: s.append("")
	it["sk"] = s.slice(0, cap)
	return it["sk"]

## "ruby_t3" -> {type, tier, stat, value, name}
static func gem(id: String) -> Dictionary:
	var parts := id.split("_t")
	if parts.size() != 2: return {}
	var t: Dictionary = Data.game.get("GEM_TYPES", {}).get(parts[0], {})
	if t.is_empty(): return {}
	var tier := int(parts[1])
	return {"id": id, "type": parts[0], "tier": tier, "stat": "resist" if t["stat"] == "saves" else str(t["stat"]),
		"value": int(t.get("base", 1)) * tier, "name": "T%d %s" % [tier, t["name"]], "label": t.get("label", "")}

static func gem_icon(id: String) -> String:
	return str(Data.game.get("GEM_ART", {}).get(gem(id).get("type", ""), "px_gem"))

static func random_gem(lvl: int, rng: RandomNumberGenerator) -> String:
	var types: Array = Data.game.get("GEM_TYPES", {}).keys()
	return "%s_t%d" % [types[rng.randi_range(0, types.size() - 1)], clampi(1 + lvl / 80, 1, int(Data.game.get("GEM_TIER_MAX", 9)))]

# ------------------------------------------------------------------ tempering and masterwork
static func temper_value(st: String, ilvl: int) -> int:
	return maxi(1, roundi(float(Data.game.get("TEMPER_BASE", {}).get(st, 2)) * (1.0 + maxi(1, ilvl) / 60.0)))

static func temper_cost(it: Dictionary) -> Dictionary:
	return {"gold": 100 + int(it.get("ilvl", 1)) * 5, "scrap": 4}

static func mw_cost(it: Dictionary) -> Dictionary:
	var rank := int(it.get("mw", 0))
	return {"gold": roundi((80 + int(it.get("ilvl", 1)) * 4) * pow(1.35, rank)), "scrap": 2 + rank * 2}

## affixes after masterwork: base x (1 + 5% per rank) x 1.25 per masterwork crit on that affix
static func effective_affixes(it: Dictionary) -> Array:
	var rank := int(it.get("mw", 0))
	var crits: Array = it.get("mwc", [])
	var step := float(Data.game.get("MW_STEP", 0.05))
	var crit := float(Data.game.get("MW_CRIT", 1.25))
	var out := []
	var af: Array = it.get("af", [])
	for i in range(af.size()):
		var n := crits.count(i)
		out.append([af[i][0], maxi(1, roundi(float(af[i][1]) * (1.0 + step * rank) * pow(crit, n)))])
	for t in it.get("tm", []):
		out.append([t[0], int(t[1])])
	return out
