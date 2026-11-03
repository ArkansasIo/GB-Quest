extends RefCounted
## Dungeon floors for the 38 dungeons in DUNGEONS, built as zone dictionaries the field can walk.
## Rooms joined by corridors, the dungeon's own tile theme (gd_<theme>_*), monster packs you can see,
## a gold cache, an UP stair at the entry and a DOWN stair guarded by that floor's boss.
## The browser game's generator lives in src/rooms.js; this is a smaller one with the same tiles and rules of thumb.

const W := 32
const H := 24
const FLOORS := 3
const THEME_FAMS := {
	"dungeon": ["humanoid", "beast", "monstrosity"], "temple": ["celestial", "construct", "fey"], "ice": ["elemental", "giant", "beast"],
	"lava": ["fiend", "elemental", "dragon"], "void": ["aberration", "fiend", "ooze"], "crypt": ["undead", "ooze", "fiend"],
}
const WALK := ".,ULGd"
const KEY := {".": "floor", ",": "floor2", "U": "up", "L": "down", "G": "gold", "A": "altar", "s": "statue", "b": "barrel", "d": "door"}

static func def_by_id(id: String) -> Dictionary:
	for d in Data.game.get("DUNGEONS", []) + Data.game.get("RAIDS", []):
		if d["id"] == id:
			return d
	return {}

static func is_raid(def: Dictionary) -> bool:
	return def.has("bosses")

## dungeons have 3 floors; a raid has one floor per raid boss (4 to 6)
static func floors(def: Dictionary) -> int:
	return int(def["bosses"]) if is_raid(def) else FLOORS

## the boss for one floor: the browser game lists three dungeon bosses per dungeon, in dungeon order
static func boss_for(def: Dictionary, floor: int) -> Dictionary:
	if is_raid(def):
		# RAID_BOSSES lists every raid's bosses in raid order
		var off := 0
		for r in Data.game.get("RAIDS", []):
			if r["id"] == def["id"]: break
			off += int(r["bosses"])
		var rb: Array = Data.game.get("RAID_BOSSES", [])
		if rb.size(): return rb[mini(off + floor, rb.size() - 1)]
	var ds: Array = Data.game.get("DUNGEONS", [])
	var idx := ds.find(def)
	var bs := []
	for b in Data.game.get("BOSSES", []):
		if b["cat"] == "dungeon":
			bs.append(b)
	if bs.is_empty():
		return {"name": "WARDEN OF THE DEEP", "art": "", "lvl": int(def.get("lvl", 5))}
	return bs[(maxi(0, idx) * FLOORS + floor) % bs.size()]

static func build(def: Dictionary, floor: int) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash("%s-%d-%d" % [def["id"], floor, Game.rng.randi()])
	var theme := str(def.get("theme", "dungeon"))
	var g := []
	for y in range(H):
		var row := []
		row.resize(W)
		row.fill("#")
		g.append(row)
	# rooms
	var rooms: Array[Rect2i] = []
	for t in range(200):
		if rooms.size() >= 8:
			break
		var rw := rng.randi_range(4, 8)
		var rh := rng.randi_range(3, 5)
		var r := Rect2i(rng.randi_range(1, W - rw - 2), rng.randi_range(2, H - rh - 2), rw, rh)
		var ok := true
		for o in rooms:
			if r.grow(2).intersects(o):
				ok = false
				break
		if ok:
			rooms.append(r)
	rooms.sort_custom(func(a, b): return a.position.x + a.position.y * 0.5 < b.position.x + b.position.y * 0.5)
	for r in rooms:
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				g[y][x] = "," if rng.randf() < 0.12 else "."
	# corridors between neighbouring rooms (L shapes)
	for k in range(rooms.size() - 1):
		var a := rooms[k].get_center()
		var b := rooms[k + 1].get_center()
		var horiz_first := rng.randf() < 0.5
		var corner := Vector2i(b.x, a.y) if horiz_first else Vector2i(a.x, b.y)
		_carve(g, a, corner)
		_carve(g, corner, b)
	# doorways: a corridor tile right outside a room, with walls on both sides of it
	for r in rooms:
		var spots := []
		for x in range(r.position.x, r.end.x):
			spots.append([Vector2i(x, r.position.y - 1), true]); spots.append([Vector2i(x, r.end.y), true])
		for y in range(r.position.y, r.end.y):
			spots.append([Vector2i(r.position.x - 1, y), false]); spots.append([Vector2i(r.end.x, y), false])
		for sp in spots:
			var q: Vector2i = sp[0]
			if q.x < 1 or q.y < 1 or q.x >= W - 1 or q.y >= H - 1 or g[q.y][q.x] != ".": continue
			var side_a: String = g[q.y][q.x - 1] if sp[1] else g[q.y - 1][q.x]
			var side_b: String = g[q.y][q.x + 1] if sp[1] else g[q.y + 1][q.x]
			if side_a == "#" and side_b == "#": g[q.y][q.x] = "d"
	var first := rooms[0]
	var last := rooms[rooms.size() - 1]
	var up := first.get_center()
	var down := last.get_center()
	g[up.y][up.x] = "U"
	g[down.y][down.x] = "L"
	# decoration that never blocks a corridor: statues and barrels in room corners
	for r in rooms.slice(1, rooms.size() - 1):
		if rng.randf() < 0.5:
			g[r.position.y][r.position.x] = "s" if rng.randf() < 0.5 else "b"
	# monster packs, a gold cache and the floor boss
	var lvl := int(def.get("lvl", 5)) + floor * 2
	var fams: Array = THEME_FAMS.get(theme, ["beast"])
	var pool := []
	for m in Data.game.get("BESTIARY", []):
		if fams.has(m["fam"]) and m.get("rank", "normal") == "normal":
			pool.append(m)
	var mobs := []
	for r in rooms.slice(1, rooms.size() - 1):
		for n in range(1 if r.get_area() < 25 else 2):
			var p := Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))
			if g[p.y][p.x] in [".", ","] and not _has(mobs, p):
				mobs.append({"x": p.x, "y": p.y, "def": pool[rng.randi_range(0, pool.size() - 1)], "lvl": lvl})
	var mid: Rect2i = rooms[rng.randi_range(1, maxi(1, rooms.size() - 2))]
	var gp := Vector2i(mid.end.x - 1, mid.end.y - 1)
	if g[gp.y][gp.x] in [".", ","] and not _has(mobs, gp):
		g[gp.y][gp.x] = "G"
	var bpos := down + Vector2i(-1, 0) if g[down.y][down.x - 1] in [".", ","] else down + Vector2i(0, -1)
	g[bpos.y][bpos.x] = "."
	# hidden traps on plain floor away from the stairs and monsters
	var traps := []
	for t in range(60):
		if traps.size() >= 3 + floor: break
		var p := Vector2i(rng.randi_range(1, W - 2), rng.randi_range(1, H - 2))
		if g[p.y][p.x] != "." or p.distance_to(up) < 3 or p.distance_to(down) < 2 or _has(mobs, p) or _has(traps, p): continue
		traps.append({"x": p.x, "y": p.y, "dc": 10 + mini(10, lvl / 5) + floor, "dmg": "%dd10" % (1 + lvl / 4)})
	var bdef := boss_for(def, floor)
	if floor == floors(def) - 1 and not is_raid(def):
		var arc: Dictionary = Quest.arc_boss_for(str(def["id"]))   # the story boss guards the last floor in its chapter
		if not arc.is_empty(): bdef = arc
	mobs.append({"x": bpos.x, "y": bpos.y, "def": bdef, "lvl": maxi(lvl + 1, int(bdef.get("lvl", lvl))), "boss": true})
	# tiles: wall faces where floor is below, wall tops elsewhere, torches on some faces
	var gfx := []
	var walk := []
	for y in range(H):
		var grow := []
		var wrow := ""
		for x in range(W):
			var c: String = g[y][x]
			var name := ""
			if c == "#":
				var face: bool = y + 1 < H and WALK.contains(str(g[y + 1][x]))
				name = "wall" if face else "walltop"
				if face and (x * 7 + y * 3 + floor) % 6 == 0:
					name = "torch0"
			else:
				name = KEY.get(c, "floor")
			grow.append("gd_%s_%s" % [theme, name])
			wrow += "1" if WALK.contains(c) else "0"
		gfx.append(grow)
		walk.append(wrow)
	var biome: String = {"ice": "snow", "lava": "volcanic", "void": "dusk", "temple": "crystal", "crypt": "dusk"}.get(theme, "dusk")
	return {"id": "%s:%d" % [def["id"], floor], "name": "%s %dF" % [def["name"], floor + 1], "dungeon": def["id"], "floor": floor,
		"town": false, "biome": biome, "lvl": [lvl, lvl + 1], "gfx": gfx, "walk": walk, "exits": {}, "npcs": [], "poi": {},
		"hub": [up.x, up.y], "up": [up.x, up.y], "down": [down.x, down.y], "mobs": mobs, "last": floor == floors(def) - 1, "raid": is_raid(def), "traps": traps}

static func _carve(g: Array, a: Vector2i, b: Vector2i) -> void:
	var p := a
	var d := Vector2i(signi(b.x - a.x), signi(b.y - a.y))
	while true:
		if g[p.y][p.x] == "#":
			g[p.y][p.x] = "."
		if p == b:
			break
		p += d

static func _has(mobs: Array, p: Vector2i) -> bool:
	for m in mobs:
		if int(m["x"]) == p.x and int(m["y"]) == p.y:
			return true
	return false
