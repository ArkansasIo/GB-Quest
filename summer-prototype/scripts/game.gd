extends Node
## The hero, the world position and the 5e-style rules the port needs (mirrors src/rules.js for levels 1-720).

const SAVE_PATH := "user://gbquest_save.json"
const ATTRS := ["STR", "DEX", "CON", "INT", "WIS", "CHA"]
const STANDARD_ARRAY := [15, 14, 13, 12, 10, 8]

var hero: Dictionary = {}
var zone_id := "elderwood"
var pos := Vector2i(3, 8)
var facing := "down"
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

func ac() -> int:
	var armor: Array = Data.cls(hero.get("cls", "warden")).get("armor", [])
	if armor.has("heavy"):
		return 16 + (2 if armor.has("shield") else 0)
	if armor.has("medium"):
		return 13 + mini(2, mod("DEX")) + (2 if armor.has("shield") else 0)
	if armor.has("light"):
		return 11 + mod("DEX")
	return 10 + mod("DEX")

func attack_bonus() -> int:
	return prof() + mod(Data.cls(hero.get("cls", "warden")).get("primary", "STR"))

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
	f.store_string(JSON.stringify({"hero": hero, "zone": zone_id, "x": pos.x, "y": pos.y, "facing": facing}))
	return true

func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)

func load_save() -> bool:
	if not has_save():
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if not d is Dictionary:
		return false
	hero = d["hero"]
	zone_id = d["zone"]
	pos = Vector2i(int(d["x"]), int(d["y"]))
	facing = d.get("facing", "down")
	return true
