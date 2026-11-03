extends RefCounted
## Item affixes and legendary aspects, rolled the way the browser game rolls them (src/gen.js makeItem, src/d4_gear.js).
## An item may carry  "af": [[stat, value, greater?], ...]  and  "asp": {"id": aspect id, "v": value}.

## affix count by rarity index (POOR, COMMON, UNCOMMON, RARE, EPIC, LEGENDARY+), as in makeItem
const AFFIX_COUNT := [0, 0, 1, 2, 3, 4, 4, 5, 5]

static func roll(it: Dictionary, lvl: int, rng: RandomNumberGenerator) -> void:
	var r := int(it.get("r", 1))
	var pool: Array = Data.game.get("AFFIX_POOL", []).duplicate()
	var K: Dictionary = Data.game.get("AFFIX_K", {})
	var caps: Dictionary = Data.game.get("SUBSTATS", {})
	# shuffle with our rng so tests can seed it
	for i in range(pool.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var t = pool[i]; pool[i] = pool[j]; pool[j] = t
	var af := []
	var n: int = AFFIX_COUNT[clampi(r, 0, 8)]
	var gchance := float(Data.game.get("GREATER_CHANCE", 0.06))
	var gmult := float(Data.game.get("GREATER_MULT", 1.5))
	for i in range(mini(n, pool.size())):
		var s := str(pool[i])
		var v := float(K.get(s, 1)) * (1.0 + lvl / 12.0) * (0.6 + mini(r, 5) * 0.25) * (0.7 + rng.randf() * 0.3)
		var greater := rng.randf() < gchance
		if greater:
			v *= gmult
		af.append([s, mini(int(caps.get(s, {}).get("max", 999)), maxi(1, roundi(v))), greater])
	if r >= 7 and af.size():   # ancestral and divine always carry one greater affix
		var has := false
		for a in af: has = has or a[2]
		if not has:
			var k := rng.randi_range(0, af.size() - 1)
			af[k][1] = mini(int(caps.get(af[k][0], {}).get("max", 999)), roundi(af[k][1] * gmult)); af[k][2] = true
	it["af"] = af
	it["ilvl"] = lvl
	if r >= 5:   # legendary, mythic, ancestral, divine
		it["asp"] = roll_aspect("weapon" if it.get("k") == "w" else "armor", r, rng)

static func roll_aspect(kind: String, r: int, rng: RandomNumberGenerator) -> Dictionary:
	var specs: Dictionary = Data.game.get("ASPECT_SPECS", {})
	var ids := []
	for id in specs:
		var k := str(specs[id].get("kind", "any"))
		if k == "any" or k == kind:
			ids.append(id)
	var id: String = ids[rng.randi_range(0, ids.size() - 1)]
	var A: Dictionary = specs[id]
	var q := clampf((maxi(5, r) - 5) / 4.0 * 0.5 + rng.randf() * 0.5, 0.0, 1.0)
	return {"id": id, "v": roundi(float(A["lo"]) + (float(A["hi"]) - float(A["lo"])) * q)}

static func affix_text(a: Array) -> String:
	var sub: Dictionary = Data.game.get("SUBSTATS", {}).get(a[0], {})
	return "%s+%d%s %s" % ["*" if a.size() > 2 and a[2] else "", int(a[1]), str(sub.get("unit", "")), str(sub.get("name", a[0]))]

static func aspect_name(asp: Dictionary) -> String:
	return str(Data.game.get("ASPECT_SPECS", {}).get(asp.get("id", ""), {}).get("name", "?"))

static func aspect_text(asp: Dictionary) -> String:
	var A: Dictionary = Data.game.get("ASPECT_SPECS", {}).get(asp.get("id", ""), {})
	if A.is_empty():
		return ""
	var v := int(asp.get("v", 0))
	var e: Dictionary = A["e"]
	if e.get("t") == "stat":
		var parts := []
		var names: Dictionary = Data.game.get("ASP_STAT", {})
		for sm in e.get("stats", []):
			var pct := "" if str(sm[0]) in ["hp", "acb", "hit", "thorns"] else "%"
			parts.append("+%d%s %s" % [maxi(1, int(floor(v * float(sm[1])))), pct, names.get(sm[0], sm[0])])
		return ", ".join(parts) + "."
	var t = Data.game.get("ASPECT_TEXT", {}).get(asp["id"])
	return str(t).replace("{v}", str(v)) if t else ""

## stat contributions of an aspect with t = "stat"
static func aspect_stats(asp: Dictionary) -> Array:
	var A: Dictionary = Data.game.get("ASPECT_SPECS", {}).get(asp.get("id", ""), {})
	var out := []
	if A.get("e", {}).get("t") == "stat":
		for sm in A["e"]["stats"]:
			out.append([str(sm[0]), maxi(1, int(floor(int(asp["v"]) * float(sm[1]))))])
	return out

## the support-job bonus, as supportBonus in src/jobs.js: traits x (level / 10), capped
static func support_bonus(cls: String, lvl: int) -> Array:
	var tr: Array = Data.game.get("SUPPORT_TRAITS", {}).get(cls, [])
	var caps: Dictionary = Data.game.get("SUPPORT_CAPS", {})
	var steps := maxi(1, lvl / 10)
	var out := []
	for kv in tr:
		out.append([str(kv[0]), mini(int(caps.get(kv[0], 20)), maxi(1, int(floor(float(kv[1]) * steps))))])
	return out

## word-wrap for the 24-px font: up to `cols` characters per line
static func wrap(s: String, cols: int) -> Array:
	var lines := []
	var cur := ""
	for w in s.split(" "):
		if (cur + " " + w).strip_edges().length() > cols:
			lines.append(cur.strip_edges())
			cur = w
		else:
			cur += " " + w
	if cur.strip_edges() != "":
		lines.append(cur.strip_edges())
	return lines
