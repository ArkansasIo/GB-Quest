extends Node
## The hero, the world position and the 5e-style rules the port needs (mirrors src/rules.js for levels 1-720).

const SAVE_PATH := "user://gbquest_save.json"
const ATTRS := ["STR", "DEX", "CON", "INT", "WIS", "CHA"]
const STANDARD_ARRAY := [15, 14, 13, 12, 10, 8]

var hero: Dictionary = {}
var zone_id := "elderwood"
var pos := Vector2i(3, 8)
var facing := "down"
## the dungeon run in progress: {"id", "floor", "map", "ret_zone", "ret_pos"}; empty in the overworld
var dun: Dictionary = {}
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()

# ------------------------------------------------------------------ characters
func new_hero(name: String, cls_id: String, sp_id: String) -> Dictionary:
	var c := Data.cls(cls_id)
	var sp := Data.species(sp_id)
	var prio: Array = [c.get("primary", "STR")]
	if c.get("cast") and c.get("cast") != c.get("primary"):
		prio.append(c["cast"])
	for a in ["CON", "DEX", "WIS", "STR", "INT", "CHA"]:
		if not prio.has(a):
			prio.append(a)
	var base := {}
	for i in range(6):
		base[prio[i]] = STANDARD_ARRAY[i]
	for a in sp.get("asi", {}):
		base[a] = int(base.get(a, 10)) + int(sp["asi"][a])
	hero = {"name": name, "cls": cls_id, "species": sp_id, "lvl": 1, "xp": 0, "gold": 100, "base": base, "potions": 3, "hp": 1, "kills": 0}
	give_start_gear()
	hero["hp"] = hp_max()
	zone_id = "elderwood"
	pos = Vector2i(3, 8)
	return hero

func mod(a: String) -> int:
	return int(floor((int(hero.get("base", {}).get(a, 10)) - 10) / 2.0))

func class_level() -> int:
	return mini(int(hero.get("lvl", 1)), int(Data.game.get("CLASS_LEVEL_CAP", 20)))

func prof() -> int:
	return 2 + int((class_level() - 1) / 4)

func hp_max() -> int:
	var hd := int(Data.cls(hero.get("cls", "warden")).get("hd", 8))
	var L := int(hero.get("lvl", 1))
	var CL := class_level()
	var hp := hd + (CL - 1) * (hd / 2 + 1) + mod("CON") * CL
	return maxi(1, hp + maxi(0, L - CL) * 2)   # ascension levels add a little health each

## AC from the equipped armour and shield (5e: light adds DEX, medium up to +2, heavy none), plus item pluses
func ac() -> int:
	var g: Dictionary = gear()
	var a := def_of(g.get("armor", {}))
	var v := 10 + mod("DEX")
	if not a.is_empty():
		var dm = a.get("dexMax")
		v = int(a["ac"]) + (mod("DEX") if dm == null else mini(int(dm), mod("DEX"))) + int(g["armor"].get("plus", 0))
	var s := def_of(g.get("shield", {}))
	if not s.is_empty():
		v += int(s["ac"]) + int(g["shield"].get("plus", 0))
	return v

## the ability that drives weapon attacks: DEX for finesse and ranged weapons when it is higher
func weapon_mod() -> int:
	var w := def_of(gear().get("weapon", {}))
	var p := str(w.get("props", ""))
	if p.contains("f") or p.contains("r"):
		return maxi(mod("STR"), mod("DEX"))
	return mod("STR") if not w.is_empty() else mod(Data.cls(hero.get("cls", "warden")).get("primary", "STR"))

func attack_bonus() -> int:
	return prof() + weapon_mod() + int(gear().get("weapon", {}).get("plus", 0))

func weapon_dice() -> String:
	var w := def_of(gear().get("weapon", {}))
	return str(w.get("dmg", "1d4")) if not w.is_empty() else "1d4"

func weapon_damage(crit: bool) -> int:
	var d := weapon_dice()
	return maxi(1, roll(d) + (roll(d) if crit else 0) + weapon_mod() + int(gear().get("weapon", {}).get("plus", 0)) + int(hero.get("lvl", 1)) / 10)

# ------------------------------------------------------------------ gear and the bag
## an owned item: {"k": "w"|"a", "id": WEAPONS/ARMORS key, "r": RARITY index, "plus": int}
func def_of(it: Dictionary) -> Dictionary:
	if it.is_empty():
		return {}
	return Data.game.get("WEAPONS" if it.get("k") == "w" else "ARMORS", {}).get(it.get("id", ""), {})

func slot_of(it: Dictionary) -> String:
	if it.get("k") == "w":
		return "weapon"
	return "shield" if def_of(it).get("type") == "shield" else "armor"

func gear() -> Dictionary:
	if not hero.has("gear"):
		hero["gear"] = {}
	return hero["gear"]

func bag() -> Array:
	if not hero.has("bag"):
		hero["bag"] = []
	return hero["bag"]

func make_item(id: String, r: int = 1) -> Dictionary:
	var k := "w" if Data.game.get("WEAPONS", {}).has(id) else "a"
	var rr: Dictionary = Data.game.get("RARITY", [])[clampi(r, 0, 8)]
	return {"k": k, "id": id, "r": clampi(r, 0, 8), "plus": maxi(0, int(rr.get("plus", 0)))}

func item_name(it: Dictionary) -> String:
	var rr: Dictionary = Data.game.get("RARITY", [])[int(it.get("r", 1))]
	var n := str(def_of(it).get("name", "?"))
	return n + (" +%d" % int(it["plus"]) if int(it.get("plus", 0)) > 0 else "")

func rarity_color(it: Dictionary) -> Color:
	var rr: Dictionary = Data.game.get("RARITY", [])[int(it.get("r", 1))]
	var c := Color.html(str(rr.get("color", "#ffffff")))
	return Data.INK if int(it.get("r", 1)) <= 1 else c.darkened(0.25)

func item_stat(it: Dictionary) -> String:
	var d := def_of(it)
	if it.get("k") == "w":
		return "%s %s" % [d.get("dmg", "?"), str(d.get("type", "")).to_upper()]
	return ("AC +%d" if d.get("type") == "shield" else "AC %d") % int(d.get("ac", 10)) + " " + str(d.get("type", "")).to_upper()

func price(it: Dictionary) -> int:
	var rr: Dictionary = Data.game.get("RARITY", [])[int(it.get("r", 1))]
	return maxi(5, int(float(def_of(it).get("cost", 1)) * 4 * float(rr.get("value", 1))) + 10)

## whether this class may use the item (armour type list; weapon category, finesse classes take finesse/ranged martial weapons)
func can_use(it: Dictionary) -> bool:
	var c := Data.cls(hero.get("cls", "warden"))
	var d := def_of(it)
	if it.get("k") == "a":
		return d.get("type") == "cloth" or c.get("armor", []).has(d.get("type"))
	var wc := str(c.get("weapons", "simple"))
	if wc == "martial" or d.get("cat") == "simple":
		return true
	return wc == "finesse" and (str(d.get("props", "")).contains("f") or str(d.get("props", "")).contains("r"))

## equip from the bag (the old piece goes back in the bag); returns false if the class can't use it
func equip(i: int) -> bool:
	var it: Dictionary = bag()[i]
	if not can_use(it):
		return false
	var s := slot_of(it)
	if s == "shield" and str(def_of(gear().get("weapon", {})).get("props", "")).contains("2"):
		unequip("weapon")
	if s == "weapon" and str(def_of(it).get("props", "")).contains("2"):
		unequip("shield")
	bag().remove_at(i)
	unequip(s)
	gear()[s] = it
	return true

func unequip(s: String) -> void:
	if gear().has(s):
		bag().append(gear()[s])
		gear().erase(s)

func give_start_gear() -> void:
	hero["gear"] = {}
	hero["bag"] = []
	for id in Data.cls(hero.get("cls", "warden")).get("gear", []):
		var it := make_item(str(id), 1)
		gear()[slot_of(it)] = it

## a random weapon or armour drop scaled by monster level; rarity rolls up with level
func random_drop(lvl: int) -> Dictionary:
	var pool := []
	for k in Data.game.get("WEAPONS", {}):
		pool.append(k)
	for k in Data.game.get("ARMORS", {}):
		pool.append(k)
	var id: String = pool[rng.randi_range(0, pool.size() - 1)]
	var r := 1
	var roll_r := rng.randf() + minf(0.5, lvl / 200.0)
	for cut in [0.55, 0.8, 0.93, 0.985, 1.2, 1.35, 1.45]:
		if roll_r > cut:
			r += 1
	return make_item(id, mini(r, 8))

func is_caster() -> bool:
	return Data.cls(hero.get("cls", "warden")).get("caster") != null

func spell_dc() -> int:
	var cast = Data.cls(hero.get("cls", "warden")).get("cast", "INT")
	return 8 + prof() + mod(str(cast if cast else "INT"))

## highest spell level known at this character level (spell levels 1-9 spread over 1-720)
func spell_level() -> int:
	var unlock: Array = Data.game.get("SPELL_UNLOCK", [])
	var n := 0
	for i in range(unlock.size()):
		if int(hero.get("lvl", 1)) >= int(unlock[i]):
			n = i + 1
	return n if is_caster() else 0

func known_spells() -> Array:
	var out := []
	for s in Data.game.get("SPELLS", []):
		if s.get("cls", []).has(hero.get("cls")) and int(s.get("lvl", 0)) <= spell_level() and s.get("eff") == "dmg":
			out.append(s)
	return out

func roll(dice: String) -> int:
	var re := RegEx.new()
	re.compile("^(\\d+)d(\\d+)([+-]\\d+)?$")
	var m := re.search(dice.strip_edges())
	if m == null:
		return int(dice) if dice.is_valid_int() else 1
	var total := int(m.get_string(3)) if m.get_string(3) != "" else 0
	for i in range(int(m.get_string(1))):
		total += rng.randi_range(1, int(m.get_string(2)))
	return total

func d20() -> int:
	return rng.randi_range(1, 20)

## add XP, return the levels gained
func gain_xp(n: int) -> int:
	hero["xp"] = int(hero["xp"]) + n
	var ups := 0
	while int(hero["lvl"]) < int(Data.game.get("LEVEL_CAP", 720)) and int(hero["xp"]) >= Data.xp_for(int(hero["lvl"]) + 1):
		hero["lvl"] = int(hero["lvl"]) + 1
		ups += 1
		if int(hero["lvl"]) in [4, 8, 12, 16, 19]:
			var a: String = Data.cls(hero["cls"]).get("primary", "STR")
			hero["base"][a] = mini(20, int(hero["base"][a]) + 2)
	if ups:
		hero["hp"] = hp_max()
	return ups

# ------------------------------------------------------------------ saving
func save() -> bool:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f == null:
		return false
	# saving inside a dungeon saves you at its entrance (floors are rebuilt on each visit)
	var z := zone_id if dun.is_empty() else str(dun["ret_zone"])
	var p: Vector2i = pos if dun.is_empty() else dun["ret_pos"]
	f.store_string(JSON.stringify({"hero": hero, "zone": z, "x": p.x, "y": p.y, "facing": facing}))
	return true

func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)

func load_save() -> bool:
	if not has_save():
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if not d is Dictionary:
		return false
	dun = {}
	hero = d["hero"]
	zone_id = d["zone"]
	pos = Vector2i(int(d["x"]), int(d["y"]))
	facing = d.get("facing", "down")
	if not hero.has("gear"):
		give_start_gear()   # saves made before gear existed
	return true
