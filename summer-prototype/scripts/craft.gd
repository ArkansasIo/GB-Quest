extends Node
## Crafting materials and recipes (RECIPES in src/data_world.js). Autoload "Craft".
## Monsters drop materials by family and level; town crafters turn them into potions and gear.
## Skill per profession starts at 1 and rises by one per craft (the recipe's skill is the level needed).

## which material families a monster family drops
const FAM_MATS := {
	"beast": ["hide", "beast"], "humanoid": ["salvage", "fiber"], "undead": ["beast", "salvage"], "construct": ["ore", "salvage"],
	"plant": ["herb", "wood", "fiber"], "elemental": ["ore", "gem"], "dragon": ["hide", "gem"], "giant": ["ore", "hide"],
	"fey": ["herb", "fiber"], "fiend": ["gem", "salvage"], "ooze": ["herb", "beast"], "aberration": ["gem", "beast"],
	"celestial": ["gem", "fiber"], "monstrosity": ["hide", "beast"],
}
## the tier-1 material for each family (recipes below skill 10 use these)
const BASE := {"hide": "hide", "beast": "bone_dust", "salvage": "scrap", "fiber": "field_fiber", "ore": "iron_ore", "herb": "peacebloom", "wood": "sap", "gem": "cut_gem"}
## professions the port can craft, and the town services that teach them
const PROFS := {"alch": "ALCHEMY", "weaponsmith": "WEAPONSMITHING", "armorsmith": "ARMORSMITHING", "blacksmith": "FORGEWORK"}

func mats() -> Dictionary:
	if not Game.hero.has("mats"):
		Game.hero["mats"] = {}
	return Game.hero["mats"]

func mat_name(id: String) -> String:
	return str(Data.game.get("ITEMS", {}).get(id, {}).get("name", id.to_upper()))

func mat_icon(id: String) -> String:
	var it: Dictionary = Data.game.get("ITEMS", {}).get(id, {})
	return str(it.get("icon", it.get("icon0", "item_herb")))

func add(id: String, n: int = 1) -> void:
	mats()[id] = int(mats().get(id, 0)) + n

## material drops for a won battle: 55% one material; level decides base or tiered (m_<fam>_<tier>)
func drop_mats(def: Dictionary, region: String) -> Array:
	if Game.rng.randf() > 0.55:
		return []
	var fams: Array = FAM_MATS.get(str(def.get("fam", "beast")), ["salvage"])
	var f: String = fams[Game.rng.randi_range(0, fams.size() - 1)]
	var lvl := int(Game.hero.get("lvl", 1))
	var id := ""
	if f == "herb":
		var biome := str(Data.zones.get(Game.zone_id, {}).get("biome", "meadow"))
		id = str(Data.game.get("HERB_BY_BIOME", {}).get(biome, "peacebloom"))
	if id == "" and (lvl < 10 or Game.rng.randf() < 0.3):
		id = str(BASE.get(f, "scrap"))
	if id == "":
		id = "m_%s_%d" % [f, clampi(1 + (lvl - 10) / 60, 1, 9)]
	if not Data.game.get("ITEMS", {}).has(id):
		id = str(BASE.get(f, "scrap"))
	add(id)
	return ["Looted %s." % mat_name(id)]

func skill(prof: String) -> int:
	return int(Game.hero.get("craft", {}).get(prof, 1))

## recipes of one profession at or below the hero's skill, newest first, that the port knows how to make
func recipes(prof: String) -> Array:
	var out := []
	for r in Data.game.get("RECIPES", []):
		if r.get("prof") == prof and int(r.get("skill", 1)) <= skill(prof) + 4 and _makes_kind(r) != "":
			out.append(r)
	out.reverse()
	return out.slice(0, 7)

func _makes_kind(r: Dictionary) -> String:
	var m := str(r.get("makes", ""))
	if m in ["potion", "greater", "superior"]: return "potion"
	if m.begins_with("t_weaponsmith"): return "weapon"
	if m.begins_with("t_armorsmith") or m.begins_with("t_blacksmith"): return "armor"
	return ""

func can_make(r: Dictionary) -> bool:
	if int(r.get("skill", 1)) > skill(str(r["prof"])): return false
	for k in r.get("needs", {}):
		if int(mats().get(k, 0)) < int(r["needs"][k]): return false
	return true

func needs_text(r: Dictionary) -> String:
	var parts := []
	for k in r.get("needs", {}):
		parts.append("%d/%d %s" % [int(mats().get(k, 0)), int(r["needs"][k]), mat_name(k)])
	return ", ".join(parts)

func make(r: Dictionary) -> Array:
	if not can_make(r):
		return ["Need: %s." % needs_text(r) if int(r.get("skill", 1)) <= skill(str(r["prof"])) else "Your %s skill is %d; this needs %d." % [PROFS.get(r["prof"], r["prof"]), skill(str(r["prof"])), int(r["skill"])]]
	for k in r["needs"]:
		mats()[k] = int(mats()[k]) - int(r["needs"][k])
		if int(mats()[k]) <= 0: mats().erase(k)
	var cr: Dictionary = Game.hero.get("craft", {})
	cr[r["prof"]] = skill(str(r["prof"])) + 1
	Game.hero["craft"] = cr
	var out := []
	match _makes_kind(r):
		"potion":
			var n := {"potion": 1, "greater": 2, "superior": 3}.get(str(r["makes"]), 1) as int
			Game.hero["potions"] = int(Game.hero["potions"]) + n
			out.append("Brewed %s: +%d potion%s." % [r["name"], n, "s" if n > 1 else ""])
		"weapon", "armor":
			var desc := str(Data.game.get("ITEMS", {}).get(r["makes"], {}).get("desc", ""))
			var re := RegEx.new(); re.compile("item level (\\d+)")
			var m := re.search(desc)
			var ilvl := int(m.get_string(1)) if m else int(r.get("skill", 1))
			var tbl := "WEAPONS" if _makes_kind(r) == "weapon" else "ARMORS"
			var ids := []
			for id in Data.game.get(tbl, {}):
				var it0 := {"k": "w" if tbl == "WEAPONS" else "a", "id": id}
				if Game.can_use(it0): ids.append(id)
			if ids.is_empty(): ids = Data.game.get(tbl, {}).keys()
			var rr := clampi(2 + int(r.get("skill", 1)) / 40 + (1 if Game.rng.randf() < 0.25 else 0), 2, 8)
			var it := Game.make_item(str(ids[Game.rng.randi_range(0, ids.size() - 1)]), rr, maxi(ilvl, int(Game.hero["lvl"])))
			Game.bag().append(it)
			out.append("Crafted %s!" % Game.item_name(it))
	out.append("%s skill %d." % [PROFS.get(r["prof"], r["prof"]), skill(str(r["prof"]))])
	return out
