extends Node2D
## GEAR and BAG pages in the handheld layout: tabs at the top, an icon list, and a detail box at the bottom.
## LEFT/RIGHT switches tabs, A equips (BAG) or unequips (GEAR), B closes. With sell = true it is the vendor's sell list.

var main: Node2D
var sell := false
const Loot = preload("res://scripts/loot.gd")
const GearX = preload("res://scripts/gearx.gd")
const SLOT_TAG := {"weapon": "WE", "armor": "AR", "shield": "SH", "head": "HE", "neck": "NE", "ear": "EA", "back": "BA", "hands": "HA", "waist": "WA", "legs": "LE", "feet": "FE", "ring1": "R1", "ring2": "R2", "trinket1": "T1", "trinket2": "T2", "relic": "RE", "artifact": "AF"}
var tab := 1            # 0 GEAR, 1 BAG, 2 MATS
var i := 0
var top := 0
var note := ""
const SLOTS := ["weapon", "armor", "shield", "head", "neck", "ear", "back", "hands", "waist", "legs", "feet", "ring1", "ring2", "trinket1", "trinket2", "relic", "artifact"]
const ROWS := 5
const RH := 64

func _rows() -> Array:
	if tab == 2 and not sell:
		var out := []
		for k in Game.hero.get("gems", {}):
			out.append({"gem": k, "n": int(Game.hero["gems"][k])})
		for k in Craft.mats():
			out.append({"mat": k, "n": int(Craft.mats()[k])})
		return out
	if tab == 0 and not sell:
		var out := []
		for s in SLOTS:
			out.append(Game.gear().get(s, {}))
		return out
	return Game.bag()

func step(_d: float) -> void:
	var rows := _rows()
	if not sell and (main.pressed("ui_left") or main.pressed("ui_right")):
		tab = (tab + (2 if main.pressed("ui_left") else 1)) % 3
		i = 0
		top = 0
		note = ""
		return
	var n := rows.size()
	if n:
		if main.pressed("ui_up"): i = (i + n - 1) % n
		if main.pressed("ui_down"): i = (i + 1) % n
		i = clampi(i, 0, n - 1)
		if i < top: top = i
		if i >= top + ROWS: top = i - ROWS + 1
	if main.pressed("ui_b"):
		main.pop(self)
	elif main.pressed("ui_start") and n and tab != 2 and not rows[i].is_empty():
		_actions(rows[i])
	elif main.pressed("ui_a") and n and (tab != 2 or sell):
		_act(i)

var acting: Dictionary = {}
const ACTIONS := ["INFO", "SOCKET GEM", "REMOVE GEMS", "TEMPER", "MASTERWORK", "EXTRACT ASPECT", "IMPRINT ASPECT", "BACK"]

## START on an item: details, gems, and the occultist's tempering and masterwork (in towns)
func _actions(it: Dictionary) -> void:
	acting = it
	var o := ACTIONS.duplicate()
	o[1] = "SOCKET GEM (%d)" % GearX.socket_cap(it) if GearX.socket_cap(it) else "NO SOCKETS"
	o[3] = "TEMPER %dG" % GearX.temper_cost(it)["gold"]
	o[4] = "MASTERWORK %dG" % GearX.mw_cost(it)["gold"] if int(it.get("mw", 0)) < int(Data.game.get("MW_MAX", 12)) else "MASTERWORK MAX"
	main.choose(o, Callable(self, "_action_pick"), Game.item_name(acting))

func _in_town() -> bool:
	return Game.dun.is_empty() and Data.zones.get(Game.zone_id, {}).get("town", false)

func _pay(cost: Dictionary) -> String:
	if int(Game.hero["gold"]) < int(cost["gold"]): return "Need %d G." % int(cost["gold"])
	if int(Craft.mats().get("scrap", 0)) < int(cost["scrap"]): return "Need %d SCRAP (salvage from humanoids and constructs)." % int(cost["scrap"])
	Game.hero["gold"] = int(Game.hero["gold"]) - int(cost["gold"])
	Craft.mats()["scrap"] = int(Craft.mats()["scrap"]) - int(cost["scrap"])
	if int(Craft.mats()["scrap"]) <= 0: Craft.mats().erase("scrap")
	return ""

var gem_list: Array = []

func _action_pick(k: int) -> void:
	var it := acting
	match k:
		0: _info(it)
		1:
			if GearX.socket_cap(it) == 0: main.say(["This item has no sockets. Weapons and armour get one per 180 item levels."]); return
			if not GearX.sockets(it).has(""): main.say(["Every socket is full. REMOVE GEMS first."]); return
			gem_list = Game.hero.get("gems", {}).keys()
			if gem_list.is_empty(): main.say(["You have no gems. Monsters drop them, bosses most often."]); return
			var names := []
			for g in gem_list: names.append("%s x%d" % [GearX.gem(g)["name"], int(Game.hero["gems"][g])])
			main.choose(names, Callable(self, "_socket"), "Socket which gem?")
		2:
			var got := 0
			var sk := GearX.sockets(it)
			for j in range(sk.size()):
				if sk[j] != "":
					Game.hero["gems"][sk[j]] = int(Game.hero.get("gems", {}).get(sk[j], 0)) + 1; sk[j] = ""; got += 1
			main.say(["Removed %d gem%s." % [got, "" if got == 1 else "s"]])
		3:
			if not _in_town(): main.say(["The occultist tempers gear in towns."]); return
			if it.get("tm", []).size() >= int(Data.game.get("TEMPER_MAX", 2)): main.say(["Tempered as far as it goes (%d)." % int(Data.game.get("TEMPER_MAX", 2))]); return
			var err := _pay(GearX.temper_cost(it))
			if err != "": main.say([err]); return
			var pools: Dictionary = Data.game.get("TEMPER_POOLS", {})
			var cat: String = pools.keys()[Game.rng.randi_range(0, pools.size() - 1)]
			var st: String = pools[cat][Game.rng.randi_range(0, pools[cat].size() - 1)]
			var tm: Array = it.get("tm", [])
			tm.append([st, GearX.temper_value(st, int(it.get("ilvl", 1)))]); it["tm"] = tm
			main.say(["Tempered (%s): %s." % [cat, Loot.affix_text(tm.back())]])
		5:
			if not _in_town(): main.say(["The occultist extracts aspects in towns."]); return
			if not it.has("asp"): main.say(["This item has no aspect to extract."]); return
			main.choose(["EXTRACT (destroys item)", "KEEP"], Callable(self, "_extract"), "Save %s (%d) to your codex?" % [Loot.aspect_name(it["asp"]), int(it["asp"]["v"])])
		6:
			if not _in_town(): main.say(["The occultist imprints aspects in towns."]); return
			if int(it.get("r", 1)) < 3: main.say(["Only rare or better gear takes an aspect."]); return
			var kind: String = {"w": "weapon", "a": "armor"}.get(it.get("k"), "wondrous")
			codex_ids = []
			var names := []
			var cx: Dictionary = Game.hero.get("codex", {})
			for id in cx:
				var sk2 := str(Data.game.get("ASPECT_SPECS", {}).get(id, {}).get("kind", "any"))
				if sk2 == "any" or sk2 == kind:
					codex_ids.append(id); names.append("%s %d" % [str(Data.game["ASPECT_SPECS"][id]["name"]).substr(0, 15), int(cx[id])])
			if names.is_empty(): main.say(["Your codex has no aspect for a %s. Extract one first." % kind]); return
			main.choose(names, Callable(self, "_imprint"), "Imprint for %d G (replaces any aspect)." % (150 + int(it.get("ilvl", 1)) * 8))
		4:
			if not _in_town(): main.say(["The occultist masterworks gear in towns."]); return
			if int(it.get("mw", 0)) >= int(Data.game.get("MW_MAX", 12)): main.say(["Masterwork is at its peak."]); return
			if it.get("af", []).is_empty(): main.say(["Only gear with affixes can be masterworked."]); return
			var err := _pay(GearX.mw_cost(it))
			if err != "": main.say([err]); return
			it["mw"] = int(it.get("mw", 0)) + 1
			var lines := ["Masterwork rank %d: affixes +%d%%." % [int(it["mw"]), roundi(float(Data.game.get("MW_STEP", 0.05)) * 100 * int(it["mw"]))]]
			if int(it["mw"]) % 4 == 0:
				var c: Array = it.get("mwc", [])
				var ai := Game.rng.randi_range(0, it["af"].size() - 1)
				c.append(ai)
				it["mwc"] = c
				lines.append("CRITICAL! %s grows 25%%." % Data.game.get("SUBSTATS", {}).get(it["af"][ai][0], {}).get("name", it["af"][ai][0]))
			main.say(lines)

var codex_ids: Array = []

## extract: the aspect goes to the codex (keeping the best value seen), the item is destroyed
func _extract(k: int) -> void:
	if k != 0: return
	var a: Dictionary = acting["asp"]
	var cx: Dictionary = Game.hero.get("codex", {})
	cx[a["id"]] = maxi(int(cx.get(a["id"], 0)), int(a["v"])); Game.hero["codex"] = cx
	var gi := Game.bag().find(acting)
	if gi >= 0: Game.bag().remove_at(gi)
	else:
		for s2 in Game.gear().keys():
			if Game.gear()[s2] == acting: Game.gear().erase(s2)
	main.say(["%s saved to the codex (%d)." % [Loot.aspect_name(a), int(cx[a["id"]])]])

func _imprint(k: int) -> void:
	if k < 0: return
	var cost := 150 + int(acting.get("ilvl", 1)) * 8
	if int(Game.hero["gold"]) < cost: main.say(["Need %d G." % cost]); return
	Game.hero["gold"] = int(Game.hero["gold"]) - cost
	var id: String = codex_ids[k]
	acting["asp"] = {"id": id, "v": int(Game.hero["codex"][id])}
	main.say(["Imprinted %s." % Loot.aspect_name(acting["asp"]), Loot.aspect_text(acting["asp"])])

func _socket(k: int) -> void:
	if k < 0: return
	var g: String = gem_list[k]
	var sk := GearX.sockets(acting)
	sk[sk.find("")] = g
	Game.hero["gems"][g] = int(Game.hero["gems"][g]) - 1
	if int(Game.hero["gems"][g]) <= 0: Game.hero["gems"].erase(g)
	var d := GearX.gem(g)
	main.say(["Socketed %s: +%d %s." % [d["name"], int(d["value"]), d["label"]]])

## every line about an item: rarity, base stats, affixes (* = greater) and its aspect
func _info(it: Dictionary) -> void:
	if it.is_empty(): return
	var rr: Dictionary = Data.game.get("RARITY", [])[int(it.get("r", 1))]
	var lines := ["%s (%s)" % [Game.item_name(it), rr.get("name", "")], "%s  ILVL %d" % [Game.item_stat(it), int(it.get("ilvl", 1))]]
	var af := []
	var eff := GearX.effective_affixes(it)
	for j in range(eff.size()): af.append(Loot.affix_text([eff[j][0], eff[j][1], j < it.get("af", []).size() and it["af"][j].size() > 2 and it["af"][j][2]]))
	if it.get("k") == "o":
		lines.append(str(Game.def_of(it).get("slot", "")).to_upper() + " ACCESSORY")
	if int(it.get("mw", 0)): lines.append("MASTERWORK %d/%d" % [int(it["mw"]), int(Data.game.get("MW_MAX", 12))])
	var sk := GearX.sockets(it)
	if sk.size():
		var gs := []
		for g in sk: gs.append(GearX.gem(g)["name"] if g != "" else "( )")
		lines.append("SOCKETS " + " ".join(gs))
	for k in range(0, af.size(), 2): lines.append("  ".join(af.slice(k, k + 2)))
	if it.has("asp"):
		lines.append("ASPECT: " + Loot.aspect_name(it["asp"]))
		lines.append_array(Loot.wrap(Loot.aspect_text(it["asp"]), 24))
	main.say(lines)

func _act(k: int) -> void:
	if sell:
		var it: Dictionary = Game.bag()[k]
		var p := Game.price(it) / 2
		Game.bag().remove_at(k)
		Game.hero["gold"] = int(Game.hero["gold"]) + p
		note = "Sold for %d G." % p
	elif tab == 0:
		var s: String = SLOTS[k]
		if Game.gear().has(s):
			Game.unequip(s)
			note = "Put away."
	else:
		var it: Dictionary = Game.bag()[k]
		if Game.equip(k):
			note = "Equipped %s." % Game.item_name(it)
		else:
			note = "Your class can't use that."
	Game.hero["hp"] = mini(int(Game.hero["hp"]), Game.hp_max())
	i = clampi(i, 0, maxi(0, _rows().size() - 1))

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	# tabs
	var tabs := ["SELL"] if sell else ["GEAR", "BAG", "MATS"]
	for t in range(tabs.size()):
		var on := sell or t == tab
		Data.panel(self, Rect2(8 + t * 136, 8, 130, 64), Data.PANEL if on else Data.PANEL2)
		Data.text_c(self, tabs[t], 8 + t * 136 + 65, 22, Data.INK if on else Data.GREY, 0.85)
	Data.panel(self, Rect2(424, 8, 208, 64))
	Data.text_r(self, "%dG" % int(Game.hero["gold"]), 608, 22, Data.GOLD)
	# list
	Data.panel(self, Rect2(8, 80, 624, 344))
	var rows := _rows()
	if rows.is_empty():
		Data.text_c(self, "EMPTY", 320, 230, Data.GREY)
	for r in range(top, mini(rows.size(), top + ROWS)):
		var y := 100 + (r - top) * RH
		var it: Dictionary = rows[r]
		if it.has("gem"):
			if r == i:
				draw_colored_polygon(PackedVector2Array([Vector2(28, y + 14), Vector2(44, y + 28), Vector2(28, y + 42)]), Data.INK)
			Data.blit_fit(self, GearX.gem_icon(it["gem"]), Rect2(56, y, 52, 52))
			Data.text(self, str(GearX.gem(it["gem"]).get("name", "?")).substr(0, 15), Vector2(116, y + 10), Color8(150, 40, 150))
			Data.text_r(self, "x%d" % int(it["n"]), 612, y + 10, Data.EDGE)
			continue
		if it.has("mat"):
			if r == i:
				draw_colored_polygon(PackedVector2Array([Vector2(28, y + 14), Vector2(44, y + 28), Vector2(28, y + 42)]), Data.INK)
			Data.blit_fit(self, Craft.mat_icon(it["mat"]), Rect2(56, y, 52, 52))
			Data.text(self, Craft.mat_name(it["mat"]).substr(0, 15), Vector2(116, y + 10))
			Data.text_r(self, "x%d" % int(it["n"]), 612, y + 10, Data.EDGE)
			continue
		if r == i:
			draw_colored_polygon(PackedVector2Array([Vector2(28, y + 14), Vector2(44, y + 28), Vector2(28, y + 42)]), Data.INK)
		if tab == 0 and not sell:
			Data.text(self, SLOT_TAG.get(SLOTS[r], "??"), Vector2(52, y + 10), Data.GREY)
		var x := 112 if (tab == 0 and not sell) else 56
		if it.is_empty():
			Data.text(self, "- EMPTY -", Vector2(x + 60, y + 10), Data.GREY)
			continue
		Data.blit_fit(self, str(Game.def_of(it).get("icon", "")), Rect2(x, y, 52, 52))
		var col := Game.rarity_color(it) if Game.can_use(it) else Data.GREY
		Data.text(self, Game.item_name(it).substr(0, 18 if x == 56 else 14), Vector2(x + 60, y + 10), col)
	if rows.size() > ROWS:
		Data.text_r(self, "%d/%d" % [i + 1, rows.size()], 616, 388, Data.GREY, 0.75)
	# detail
	Data.panel(self, Rect2(8, 432, 624, 136))
	var cur: Dictionary = rows[i] if i < rows.size() else {}
	if cur.has("gem"):
		var gd := GearX.gem(cur["gem"])
		Data.text(self, "GEM +%d %s" % [int(gd["value"]), str(gd["label"]).to_upper()], Vector2(32, 450), Color8(150, 40, 150), 0.75)
		Data.text(self, "Socket from an item: START.", Vector2(32, 492), Data.INK, 0.75)
	elif cur.has("mat"):
		Data.text(self, "CRAFTING MATERIAL", Vector2(32, 450), Data.GREY)
		Data.text(self, "Town crafters use these.", Vector2(32, 492), Data.INK, 0.75)
	elif note != "":
		Data.text(self, note.substr(0, 24), Vector2(32, 450))
	elif not cur.is_empty():
		var rr: Dictionary = Data.game.get("RARITY", [])[int(cur.get("r", 1))]
		Data.text(self, ("%s %s" % [rr.get("name", ""), Game.item_stat(cur)]).substr(0, 24), Vector2(32, 450), Game.rarity_color(cur))
		var hint := ("A: SELL %dG" % (Game.price(cur) / 2)) if sell else ("A: PUT AWAY" if tab == 0 else ("A: EQUIP" if Game.can_use(cur) else "CAN'T USE"))
		Data.text(self, hint, Vector2(32, 492))
		var nf: int = cur.get("af", []).size()
		if nf or cur.has("asp"):
			Data.text_r(self, ("%d AFFIX%s" % [nf, "ES" if nf != 1 else ""]) + (" +ASPECT" if cur.has("asp") else ""), 608, 492, Color8(200, 100, 20), 0.6)
	Data.text_r(self, "AC %d HIT +%d" % [Game.ac(), Game.attack_bonus()], 608, 520, Data.EDGE, 0.75)
	if not sell:
		Data.text(self, "<> TAB  START: MENU", Vector2(32, 532), Data.GREY, 0.5)
