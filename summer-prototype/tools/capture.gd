extends Node
## Screenshot driver for checking the port without a person at the keyboard:
##   godot --path . res://tools/capture.tscn -- <out_dir>
## Captures the title, character creation, a town, a field zone, a battle and the status page.

var main: Node2D
var out := "user://shots"

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size(): out = args[0]
	DirAccess.make_dir_recursive_absolute(out)
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await _wait(0.6); await _shot("1_title")
	main.clear(); main.push(load("res://scripts/create.gd").new()); await _wait(0.4); await _shot("2_race")
	main.top().step_i = 1; main.top().cls_i = 19; await _wait(0.3); await _shot("3_class")
	Game.new_hero("ALDRIC", "dreadknight", "hornfolk")
	Game.zone_id = "ardenhold"; Game.pos = Vector2i(8, 9)
	main.clear(); main.push(load("res://scripts/field.gd").new()); await _wait(0.5); await _shot("4_town")
	Game.zone_id = "elderwood"; Game.pos = Vector2i(3, 8)
	main.clear(); var f = main.push(load("res://scripts/field.gd").new()); await _wait(3.0); await _shot("5_field")
	f._encounter(); await _wait(2.0); await _shot("6_battle")
	main.top().state = "menu"; await _wait(0.2); await _shot("7_battle_menu")
	main.pop(main.top()); f._menu(); await _wait(0.3); await _shot("8_menu")
	main.pop(main.top())
	# play checks: a full battle with ATTACK, then walking through a zone exit
	f._encounter(); await _wait(0.2)
	var b = main.top(); var turns := 0
	while is_instance_valid(b) and main.stack.has(b) and turns < 200:
		if b.state == "msg": b.msgs = []; b.state = "menu"; if b.then.is_valid(): var c = b.then; b.then = Callable(); c.call()
		elif b.state == "menu": b._act("ATTACK")
		turns += 1
		await get_tree().process_frame
	print("CHECK battle finished=%s turns=%d lvl=%d xp=%d hp=%d" % [not main.stack.has(b), turns, Game.hero["lvl"], Game.hero["xp"], Game.hero["hp"]])
	var fld = main.top()
	var z: Dictionary = Data.zones[Game.zone_id]
	var ex: Dictionary = z["exits"].values()[0]
	Game.pos = Vector2i(int(ex["x"]), int(ex["y"])); fld._arrived()
	print("CHECK exit %s -> %s at %s" % [z["id"], Game.zone_id, Game.pos])
	print("CHECK save=%s load=%s" % [Game.save(), Game.load_save()])
	# gear: starting kit, AC from armour, equipping a drop, the GEAR / BAG / SELL pages
	Game.new_hero("BRAM", "warden", "hearthkin")
	var g0: Dictionary = Game.gear()
	print("CHECK start gear weapon=%s armor=%s shield=%s ac=%d hit=+%d dice=%s" % [g0.get("weapon", {}).get("id"), g0.get("armor", {}).get("id"), g0.get("shield", {}).get("id"), Game.ac(), Game.attack_bonus(), Game.weapon_dice()])
	Game.bag().append(Game.make_item("knife", 4)); Game.bag().append(Game.make_item("quilted", 2)); Game.bag().append(Game.make_item("tower_shield", 6))
	for n in range(4): Game.bag().append(Game.random_drop(40))
	main.clear(); var bg = main.push(load("res://scripts/bag.gd").new()); await _wait(0.3); await _shot("9_bag")
	var before := Game.ac()
	bg._act(0); print("CHECK equip knife -> weapon=%s hit=+%d note=%s" % [Game.gear()["weapon"]["id"], Game.attack_bonus(), bg.note])
	bg.tab = 0; bg.note = ""; bg.i = 0; await _wait(0.3); await _shot("10_gear")
	var shield_i := -1
	for k in range(Game.bag().size()):
		if Game.bag()[k]["id"] == "tower_shield": shield_i = k
	Game.equip(shield_i); print("CHECK shield ac %d -> %d" % [before, Game.ac()])
	main.clear(); var sb = main.push(load("res://scripts/bag.gd").new()); sb.sell = true; await _wait(0.3); await _shot("11_sell")
	var gold := int(Game.hero["gold"]); var nb := Game.bag().size(); sb._act(0)
	print("CHECK sell gold %d -> %d bag %d -> %d" % [gold, Game.hero["gold"], nb, Game.bag().size()])
	print("CHECK save=%s load=%s gear_kept=%s" % [Game.save(), Game.load_save(), Game.gear().has("shield")])
	# dungeons: Goblin Keep's door in elderwood_s3, enter, fight every pack and each floor boss, descend, clear
	Game.new_hero("BRAM", "warden", "hearthkin"); Game.hero["lvl"] = 12; Game.hero["hp"] = Game.hp_max()
	Game.zone_id = "elderwood_s3"; Game.pos = Vector2i(9, 15); Game.facing = "up"
	main.clear(); var df = main.push(load("res://scripts/field.gd").new()); await _wait(0.4)
	print("CHECK dungeon door ahead=%s" % df._dungeon_at(9, 14))
	df.enter_dungeon("dg_elderwood"); await _wait(2.8); await _shot("12_dungeon")
	var mp: Dictionary = df.zone
	print("CHECK dungeon %s floor=%d mobs=%d boss=%s pos=%s" % [mp["name"], mp["floor"], mp["mobs"].size(), mp["mobs"].back()["def"]["name"], Game.pos])
	for fl in range(3):
		var guard := 0
		while df.zone["mobs"].size() and guard < 20:
			guard += 1
			var m: Dictionary = df.zone["mobs"].back()
			df._fight_mob(df.zone["mobs"].size() - 1)
			var bb = main.top()
			if fl == 0 and m.get("boss", false):
				await _wait(1.5); bb.state = "menu"; await _wait(0.2); await _shot("13_boss")
			var tt := 0
			while main.stack.has(bb) and tt < 400:
				if bb.state == "msg":
					bb.msgs = []; bb.state = "menu"
					if bb.then.is_valid():
						var cc = bb.then; bb.then = Callable(); cc.call()
				elif bb.state == "menu":
					Game.hero["hp"] = Game.hp_max(); bb._act("ATTACK")
				tt += 1
				await get_tree().process_frame
			while main.top() != df: main.pop(main.top())
		var dn: Array = df.zone["down"]
		Game.pos = Vector2i(int(dn[0]), int(dn[1])); df._arrived()
		print("CHECK floor %d cleared -> now %s" % [fl + 1, df.zone.get("name")])
		await get_tree().process_frame
		while main.top() != df: main.pop(main.top())
	print("CHECK after clear zone=%s cleared=%s lvl=%d bag=%d" % [Game.zone_id, Game.hero.get("cleared"), Game.hero["lvl"], Game.bag().size()])
	# story: talk to the elder, then the kill chapter in Elderwood
	Game.new_hero("IVY", "ronin", "felinar"); Game.zone_id = "elderwood"; Game.pos = Vector2i(3, 8)
	print("CHECK quest start goal=%s" % Quest.goal())
	var ql := Quest.on_talk("elder")
	print("CHECK quest after elder: %s | chapter=%d goal=%s" % [ql.slice(0, 2), Game.hero["chapter"], Quest.goal()])
	var kills := 0
	while int(Game.hero["chapter"]) == 1 and kills < 20:
		Quest.on_kill({"fam": "beast", "id": "x"}, false); kills += 1
	print("CHECK kill chapter done after %d kills -> chapter=%d goal=%s mats=%s" % [kills, Game.hero["chapter"], Quest.goal(), Craft.mats()])
	# loot: a legendary weapon rolls affixes and an aspect
	var leg := Game.make_item("longbrand", 6, 40)
	var Lt = load("res://scripts/loot.gd")
	var aft := []
	for af in leg["af"]: aft.append(Lt.affix_text(af))
	print("CHECK legendary %s af=%s aspect=%s: %s" % [Game.item_name(leg), aft, Lt.aspect_name(leg["asp"]), Lt.aspect_text(leg["asp"])])
	Game.bag().append(leg); Game.equip(Game.bag().size() - 1)
	print("CHECK equipped legendary: aspects=%d hit=+%d ac=%d hpmax=%d" % [Game.aspects().size(), Game.attack_bonus(), Game.ac(), Game.hp_max()])
	# crafting: brew a draught from peacebloom
	Craft.mats()["peacebloom"] = 4
	var pot0 := int(Game.hero["potions"])
	var rec: Dictionary = Data.game["RECIPES"][0]
	print("CHECK craft %s -> %s potions %d -> %d skill=%d" % [rec["name"], Craft.make(rec), pot0, Game.hero["potions"], Craft.skill("alch")])
	Craft.mats()["iron_ore"] = 3; Craft.mats()["sap"] = 2
	var wr := {}
	for r in Data.game["RECIPES"]: if r["id"] == "crude_weapon" or (r["prof"] == "weaponsmith" and int(r["skill"]) == 1): wr = r
	print("CHECK craft weapon %s -> %s" % [wr.get("name"), Craft.make(wr) if not wr.is_empty() else "none"])
	# support job and mount
	Game.hero["lvl"] = 30; Game.hero["xp"] = Data.xp_for(30); Game.hero["job"] = "warden"
	print("CHECK support job warden at 30: hp stat=%d block=%d" % [Game.stat("hp"), Game.stat("block")])
	Game.hero["gold"] = 5000
	main.clear(); var mf = main.push(load("res://scripts/field.gd").new()); await _wait(0.3)
	mf.talking = "STABLEMASTER"; mf._stable(); main.pop(main.top()); mf._buy_mount(0); main.pop(main.top())
	print("CHECK mount=%s mounted=%s step=%.3f" % [Game.hero.get("mount"), Game.hero.get("mounted"), mf._step_time()])
	while main.top() != mf: main.pop(main.top())
	await _wait(0.4); await _shot("14_field_quest_mount")
	for t in range(5):
		var cpg = main.push(load("res://scripts/charpage.gd").new()); cpg.tab = t; await _wait(0.2); await _shot("15_char_%d" % t); main.pop(cpg)
	var bgm = main.push(load("res://scripts/bag.gd").new()); bgm.tab = 2; await _wait(0.2); await _shot("16_mats"); main.pop(bgm)
	# a battle with the legendary: run it to the end
	mf._encounter(); await _wait(1.6); var lb = main.top(); lb.state = "menu"; await _wait(0.2); await _shot("17_battle_skill")
	var tt2 := 0
	while main.stack.has(lb) and tt2 < 300:
		if lb.state == "msg":
			lb.msgs = []; lb.state = "menu"
			if lb.then.is_valid():
				var c2 = lb.then; lb.then = Callable(); c2.call()
		elif lb.state == "menu":
			Game.hero["hp"] = Game.hp_max(); lb._act("ATTACK")
		tt2 += 1
		await get_tree().process_frame
	print("CHECK legendary battle finished=%s" % [not main.stack.has(lb)])
	print("CHECK save=%s load=%s chapter=%d mount=%s" % [Game.save(), Game.load_save(), Game.hero["chapter"], Game.hero.get("mount")])
	await _stage5()
	await _stage6()
	get_tree().quit()

## run a pushed battle to the end with ATTACK, keeping the hero alive unless told not to
func _autobattle(b, heal := true) -> int:
	var tt := 0
	while is_instance_valid(b) and main.stack.has(b) and tt < 400:
		if b.state == "msg":
			b.msgs = []; b.state = "menu"
			if b.then.is_valid():
				var c = b.then; b.then = Callable(); c.call()
		elif b.state == "menu":
			if heal: Game.hero["hp"] = 1000000   # the test hero can't fall; rules are checked elsewhere
			b._act("ATTACK")
		tt += 1
		await get_tree().process_frame
	Game.hero["hp"] = mini(int(Game.hero["hp"]), Game.hp_max())
	return tt

func _clear_dialogs(f) -> void:
	var guard := 0
	while main.top() != f and guard < 50:
		var t = main.top()
		if t.has_method("_finish"): main.pop(t)
		elif t.get("done") is Callable and t.get("lines") != null:
			main.pop(t); if t.done.is_valid(): t.done.call()
		else: main.pop(t)
		guard += 1
		await get_tree().process_frame

func _stage5() -> void:
	var GX = load("res://scripts/gearx.gd")
	Game.new_hero("REN", "warden", "hearthkin"); Game.hero["lvl"] = 40; Game.hero["xp"] = Data.xp_for(40); Game.hero["hp"] = Game.hp_max()
	# accessories
	var ring := Game.make_item("ring_prot" if GX.wondrous("ring_prot").size() else GX.accessory_ids().filter(func(i): return GX.wondrous(i)["slot"] == "ring")[0], 4, 40)
	var ac0 := Game.ac(); var hp0 := Game.hp_max()
	Game.bag().append(ring); Game.equip(Game.bag().size() - 1)
	print("CHECK accessory %s slot=%s stat=%s ac %d->%d hp %d->%d" % [Game.item_name(ring), Game.slot_of(ring) if false else Game.gear().keys().filter(func(k): return Game.gear()[k] == ring), Game.item_stat(ring), ac0, Game.ac(), hp0, Game.hp_max()])
	# gems: a high-level weapon has more sockets; socket a ruby
	var w := Game.make_item("longbrand", 4, 400)
	print("CHECK sockets ilvl400=%d ilvl1=%d" % [GX.socket_cap(w), GX.socket_cap(Game.make_item("longbrand", 1, 1))])
	Game.bag().append(w); Game.equip(Game.bag().size() - 1)
	var d0 := Game.stat("dmg")
	Game.hero["gems"] = {"ruby_t3": 1}
	main.clear(); var bg = main.push(load("res://scripts/bag.gd").new()); bg.tab = 0; await _wait(0.2)
	bg.acting = Game.gear()["weapon"]; bg.gem_list = ["ruby_t3"]; bg._socket(0); main.pop(main.top())
	print("CHECK socket ruby_t3 dmg %d -> %d sockets=%s" % [d0, Game.stat("dmg"), Game.gear()["weapon"]["sk"]])
	# temper and masterwork need a town, gold and scrap
	Game.zone_id = "ardenhold"; Game.hero["gold"] = 100000; Craft.mats()["scrap"] = 200
	var af0: Array = GX.effective_affixes(Game.gear()["weapon"])
	bg._action_pick(3); main.pop(main.top())
	for r in range(4): bg._action_pick(4); main.pop(main.top())
	var wpn: Dictionary = Game.gear()["weapon"]
	print("CHECK temper tm=%s masterwork rank=%d crits=%s affixes %s -> %s" % [wpn.get("tm"), int(wpn.get("mw", 0)), wpn.get("mwc"), af0, GX.effective_affixes(wpn)])
	await _wait(0.2); await _shot("18_gear_acc")
	bg.tab = 2; Game.hero["gems"] = {"onyx_t2": 2, "opal_t1": 1}; await _wait(0.2); await _shot("19_gems_mats")
	# world boss and gathering in elderwood_s1
	Game.zone_id = "elderwood_s1"; Game.pos = Vector2i(16, 12); Game.hero["wbk"] = {}; Game.hero["nodes"] = {}
	main.clear(); var wf = main.push(load("res://scripts/field.gd").new()); await _wait(0.3); await _clear_dialogs(wf)
	var wb: Array = wf.zone.get("mobs", [])
	print("CHECK world bosses in elderwood_s1: %s" % [wb.map(func(m): return "%s@%d,%d" % [m["def"]["name"], m["x"], m["y"]])])
	var nd: Array = wf.zone["nodes"][0]
	Game.pos = Vector2i(int(nd[0]), int(nd[1])); var m0 := int(Craft.mats().get(str(nd[3]), 0)); wf._arrived(); await _clear_dialogs(wf)
	print("CHECK gather %s at %s: %d -> %d, ready again=%s" % [nd[3], Game.pos, m0, int(Craft.mats().get(str(nd[3]), 0)), wf._node_ready(0)])
	if wb.size():
		Game.pos = Vector2i(int(wb[0]["x"]), int(wb[0]["y"]) + 1)
		await _wait(0.3); await _shot("20_world_boss")
		wf._fight_mob(0); var wbb = main.top(); await _wait(0.2)
		print("CHECK world boss hp=%d (x%d)" % [wbb.foe["max"], wbb.hp_mult])
		await _autobattle(wbb); await _clear_dialogs(wf)
		print("CHECK world boss down: mobs=%d wbk=%s" % [wf.zone["mobs"].size(), Game.hero.get("wbk")])
	# a raid: the Bone Crypt in sandspire
	var rz := ""
	for zid in Data.zones:
		if Data.zones[zid]["poi"].get("raid", {}).get("id", "") == "rd_crypt": rz = zid
	var rp: Dictionary = Data.zones[rz]["poi"]["raid"]
	Game.zone_id = rz; Game.pos = Vector2i(int(rp["x"]), int(rp["y"]) + 1)
	main.clear(); var rf = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(rf)
	print("CHECK raid door at %s ahead=%s" % [rz, rf._dungeon_at(int(rp["x"]), int(rp["y"]))])
	rf.enter_dungeon("rd_crypt")
	var bosses := []
	for fl in range(8):
		if Game.dun.is_empty(): break
		while rf.zone["mobs"].size():
			var mm: Dictionary = rf.zone["mobs"].back()
			rf._fight_mob(rf.zone["mobs"].size() - 1)
			if mm.get("boss"): bosses.append("%s(x%d)" % [mm["def"]["name"], main.top().hp_mult])
			await _autobattle(main.top()); await _clear_dialogs(rf)
		var dn: Array = rf.zone["down"]; Game.pos = Vector2i(int(dn[0]), int(dn[1])); rf._arrived(); await _clear_dialogs(rf)
	print("CHECK raid bosses=%s cleared=%s zone=%s" % [bosses, Game.hero.get("cleared"), Game.zone_id])
	# a trial: GAUNTLET OF STEEL (rush, 5 fights)
	Game.zone_id = "ardenhold"; Game.pos = Vector2i(16, 12)
	main.clear(); var tf = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(tf)
	tf.talking = "TRIALS MASTER"; tf._trial_pick(0)
	var fights := 0
	for n in range(40):
		var top = main.top()
		if top == tf: break
		if top.has_method("_victory"):
			if fights == 0: await _wait(1.0); top.state = "menu"; await _wait(0.2); await _shot("21_trial")
			fights += 1; await _autobattle(top)
		else:
			main.pop(top); if top.get("done") is Callable and top.done.is_valid(): top.done.call()
		await get_tree().process_frame
	print("CHECK trial fights=%d won=%s" % [fights, Game.hero.get("trials")])
	print("CHECK save=%s load=%s gems=%s acc=%s" % [Game.save(), Game.load_save(), Game.hero.get("gems"), Game.gear().keys()])

func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + "/" + name + ".png")

func _stage6() -> void:
	Game.new_hero("SKY", "shade", "felinar"); Game.hero["lvl"] = 120; Game.hero["xp"] = Data.xp_for(120); Game.hero["hp"] = Game.hp_max()
	# side quest from the warden of elderwood_s1, finished by kills there
	Game.zone_id = "elderwood_s1"; Game.pos = Vector2i(16, 12)
	main.clear(); var f = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(f)
	var off: Dictionary = Quest.side_offer("elderwood_s1")
	print("CHECK side offer: %s %s n=%d gold=%d | %s" % [off["title"], off["type"], int(off["n"]), int(off["gold"]), off["line"]])
	var q := {"zone": "elderwood_s1", "type": "kill", "n": 3, "prog": 0, "title": "CULL", "line": "", "gold": 50, "xp": 100}
	print("CHECK accept: %s" % Quest.side_accept(q))
	var g0 := int(Game.hero["gold"]); var res := []
	for i in range(3): res = Quest.on_kill({"fam": "beast", "id": "x"}, false)
	print("CHECK side done: %s gold %d -> %d active=%d" % [res.filter(func(l): return str(l).begins_with("SIDE")), g0, Game.hero["gold"], Quest.side_list().size()])
	# fishing: face water in a coast zone and land a catch
	var wz := ""
	var wp := Vector2i.ZERO
	for zid in Data.zones:
		if Data.zones[zid]["town"]: continue
		var rows: Array = Data.zones[zid]["gfx"]
		for y in range(1, rows.size() - 1):
			for x in range(1, rows[y].size() - 1):
				if wz == "" and str(rows[y][x]).contains("water") and str(Data.zones[zid]["walk"][y + 1])[x] == "1": wz = zid; wp = Vector2i(x, y + 1)
		if wz != "": break
	Game.zone_id = wz; Game.pos = wp; Game.facing = "up"
	main.clear(); f = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(f)
	print("CHECK water ahead in %s at %s: %s" % [wz, wp, f._is_water(wp.x, wp.y - 1)])
	var caught := 0
	for i in range(6):
		var fs = main.push(load("res://scripts/fishing.gd").new()); fs.state = "bite"; fs.bite_at = 0
		if i == 0: await _wait(0.1); fs.t = 0.1; fs.state = "bite"; await _shot("22_fishing")
		fs._catch(); await _clear_dialogs(f)
	var fish := 0
	for k in ["small_fish", "big_fish", "eel"]: fish += int(Craft.mats().get(k, 0))
	print("CHECK fishing: fish=%d skill=%d mats=%s" % [fish, int(Game.hero["craft"].get("fish", 1)), Craft.mats()])
	# cooking a ration at the inn and eating it
	Craft.mats()["small_fish"] = 5; Craft.mats()["peacebloom"] = 5
	var rr := {}
	for r in Data.game["RECIPES"]: if r["id"] == "trail_ration": rr = r
	print("CHECK cook: %s items=%s" % [Craft.make(rr), Craft.items()])
	print("CHECK eat: %s fed_until=%d steps=%d" % [Craft.use_item("ration", false)[0], int(Game.hero.get("fed", 0)), int(Game.hero.get("steps", 0))])
	Craft.items()["grilled"] = 2; Craft.items()["might"] = 1
	# a battle: WELL FED opens with REGEN; use MIGHT from ITEM
	f._encounter(); await _wait(0.3); var b = main.top()
	print("CHECK battle opens with buffs=%s options=%s" % [b.buffs, b.options()])
	b.state = "menu"; b._use_item(b._battle_items().find("might")); await _wait(0.2)
	print("CHECK after ITEM might: buffs=%s" % [b.buffs])
	await _wait(0.6); b.state = "menu"; await _wait(0.1); await _shot("23_battle_items")
	await _autobattle(b); await _clear_dialogs(f)
	# flight: a flying raid mount crosses water
	Game.hero["mounts"] = ["gryphon_brown"]; Game.hero["mount"] = "gryphon_brown"; Game.hero["mounted"] = false
	print("CHECK walk onto water: on foot=%s flying=%s" % [f._walkable(wp.x, wp.y - 1), (func(): Game.hero["mounted"] = true; return f._walkable(wp.x, wp.y - 1)).call()])
	Game.hero["mounted"] = false
	# relics, artifacts and the curator
	var rl: Dictionary = f._treasure("relic", 120); var ar: Dictionary = f._treasure("artifact", 120)
	print("CHECK treasure: %s (%s) / %s (%s)" % [Game.item_name(rl), Game.slot_of(rl), Game.item_name(ar), Game.slot_of(ar)])
	Game.equip(Game.bag().find(rl)); Game.equip(Game.bag().find(ar))
	print("CHECK equipped relic+artifact: %s" % [Game.gear().keys()])
	Game.zone_id = "ardenhold"; Game.pos = Vector2i(16, 12)
	main.clear(); f = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(f)
	var gb := int(Game.hero["gold"]); f.talking = "CURATOR"; f._curator()
	print("CHECK curator: %s gold %d -> %d" % [main.top().lines, gb, Game.hero["gold"]]); await _clear_dialogs(f)
	# extract an aspect into the codex and imprint it onto another item
	var leg := Game.make_item("longbrand", 6, 120); var rare := Game.make_item("knife", 3, 120)
	Game.bag().append(leg); Game.bag().append(rare); Game.hero["gold"] = 50000
	var bg = main.push(load("res://scripts/bag.gd").new()); await _wait(0.1)
	bg.acting = leg; bg._extract(0); main.pop(main.top())
	print("CHECK extract: codex=%s leg in bag=%s" % [Game.hero.get("codex"), Game.bag().has(leg)])
	bg.acting = rare; bg.codex_ids = Game.hero["codex"].keys(); bg._imprint(0); main.pop(main.top())
	print("CHECK imprint: %s now has %s" % [Game.item_name(rare), rare.get("asp")])
	bg.tab = 0; bg.i = 15; bg.top = 12; await _wait(0.2); await _shot("24_relic_slots"); main.pop(bg)
	# dungeon doors and traps
	Game.dun = {}; Game.zone_id = "elderwood_s3"; Game.pos = Vector2i(9, 15)
	main.clear(); f = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(f)
	f.enter_dungeon("dg_elderwood")
	var doors := 0
	for row in f.zone["gfx"]:
		for t in row: if str(t).ends_with("_door"): doors += 1
	var tr: Dictionary = f.zone["traps"][0]
	var hp0 := int(Game.hero["hp"])
	Game.pos = Vector2i(int(tr["x"]), int(tr["y"])); f._arrived()
	print("CHECK dungeon doors=%d traps=%d first trap -> %s hp %d->%d tile=%s" % [doors, f.zone["traps"].size(), main.top().lines if main.top() != f else "-", hp0, Game.hero["hp"], f.zone["gfx"][tr["y"]][tr["x"]]])
	await _clear_dialogs(f); await _wait(0.3); await _shot("25_dungeon_doors_trap")
	print("CHECK save=%s load=%s codex=%d found=%d" % [Game.save(), Game.load_save(), Game.hero.get("codex", {}).size(), Game.hero.get("found", {}).size()])
