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
	if args.size() > 1 and args[1] == "online":
		await _online(args[2] if args.size() > 2 else "http://127.0.0.1:8787")
		get_tree().quit()
		return
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
	await _stage7()
	await _stage10()
	await _stage11()
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

## run every battle of a Social series (or a single pushed battle) and pop the dialogs in between
func _run_series(f) -> int:
	var fights := 0
	for n in range(80):
		var top = main.top()
		if top == f: break
		if top.has_method("_victory"):
			fights += 1; await _autobattle(top)
		else:
			main.pop(top)
			if top.get("done") is Callable and top.done.is_valid(): top.done.call()
		await get_tree().process_frame
	return fights

func _stage7() -> void:
	Game.new_hero("NOVA", "arcanist", "wispling"); Game.hero["lvl"] = 60; Game.hero["xp"] = Data.xp_for(60); Game.hero["hp"] = Game.hp_max(); Game.hero["gold"] = 50000
	Game.zone_id = "ardenhold"; Game.pos = Vector2i(16, 12)
	main.clear(); var f = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(f)
	Social.main = main
	# talents
	var hp0 := Game.hp_max()
	var learned := []
	for t in Data.game["TALENT_TREES"]:
		for n in t["nodes"]: learned.append(Social.learn(n).substr(0, 20))
	print("CHECK talents points=%d learned=%d hp %d -> %d fire=%d crit=%d | %s" % [Social.talent_points(), Social.talents().size(), hp0, Game.hp_max(), Game.stat("fire"), Game.stat("crit"), learned.slice(0, 2)])
	# companion
	Social._comp_list = Data.game["COMPANION_DEFS"]; Social._comp_pick(1); await _clear_dialogs(f)
	print("CHECK companion=%s role=%s gold=%d" % [Social.companion().get("name"), Social.companion().get("role"), Game.hero["gold"]])
	for i in range(20): Social.bond_up()
	print("CHECK bond=%d tier=%s stats=%s" % [Social.bond(), Social.bond_tier().get("name"), Social.bond_stats()])
	f._encounter(); await _wait(1.2); main.top().state = "menu"; await _wait(0.2); await _shot("26_companion_battle")
	await _autobattle(main.top()); await _clear_dialogs(f)
	# guild and conquest
	Social._found(0); await _clear_dialogs(f)
	Social.count("dungeons", 3); Social.count("raids", 1); Social.count("kills", 50)
	print("CHECK guild=%s xp=%d level=%d perks=%s" % [Game.hero.get("guild"), Social.guild_xp(), Social.guild_level(), Social.guild_perk_stats()])
	var regs: Array = Social.regions()
	for r in regs.slice(0, 3):
		Social._cq_list = regs; Social._cq_pick(regs.find(r))
		var nf: int = await _run_series(f)
		print("CHECK boonstone %s fights=%d owner=%s" % [r["name"], nf, Social.stone_owner(r["id"])])
	Social._cq_list = regs; Social._cq_pick(regs.size())
	var cf: int = await _run_series(f)
	print("CHECK castle fights=%d owned=%s dmg+%d xp+%d title=%s" % [cf, Social.castle_owned(), Game.stat("dmg"), Game.stat("xp"), Game.hero.get("title")])
	print("CHECK tax now: %s" % Social.collect_tax())
	# arena and honor
	Social._arena_pick(1); var af: int = await _run_series(f)
	print("CHECK arena 3v3 fights=%d rating=%d honor=%d" % [af, int(Game.hero.get("rating", 0)), int(Game.hero.get("honor", 0))])
	Social.open_honor(main); main.pop(main.top()); Game.hero["honor"] = 10000; var nb := Game.bag().size(); Social._honor_buy(0); await _clear_dialogs(f)
	print("CHECK honor shop bag %d -> %d" % [nb, Game.bag().size()])
	# bounties
	var bl: Array = Social.bounties()
	for b in bl: Social.count(str(b["stat"]), int(b["target"]))
	var g0 := int(Game.hero["gold"]); Social._bounty_pick(0); await _clear_dialogs(f)
	print("CHECK bounties=%s claimed first: gold %d -> %d" % [bl.map(func(b): return "%s %d" % [b["name"], b["target"]]), g0, Game.hero["gold"]])
	# home and bank
	Social._buy_home(0); await _clear_dialogs(f)
	Game.bag().append(Game.make_item("knife", 2, 10)); var bn := Game.bag().size()
	Social._store(bn - 1); await _clear_dialogs(f)
	print("CHECK home=%s store=%d/%d bag %d -> %d" % [Game.hero.get("homes", {}).keys(), Social.store().size(), Social.store_cap(), bn, Game.bag().size()])
	# waypoint and travel
	Game.zone_id = "elderwood_s1"; var wpd = Data.zones["elderwood_s1"].get("waypoint")
	main.clear(); f = main.push(load("res://scripts/field.gd").new()); await _wait(0.1); await _clear_dialogs(f)
	if wpd is Dictionary:
		Game.pos = Vector2i(int(wpd["x"]), int(wpd["y"])); f._arrived(); await _clear_dialogs(f)
	Game.zone_id = "ardenhold"; Game.pos = Vector2i(16, 12)
	main.clear(); f = main.push(load("res://scripts/field.gd").new()); await _wait(0.1); await _clear_dialogs(f)
	Social._wp_list = ["ardenhold"] + Game.hero.get("wps", {}).keys(); Social._travel(Social._wp_list.size() - 1, f); await _clear_dialogs(f)
	print("CHECK waypoints=%s travelled to %s at %s" % [Game.hero.get("wps", {}).keys(), Game.zone_id, Game.pos])
	# spire and difficulty
	Social._tower_pick(0); var tf2: int = await _run_series(f)
	print("CHECK spire fights=%d best=%d" % [tf2, int(Game.hero.get("spire", 0))])
	Social._diff(3); await _clear_dialogs(f)
	f._encounter(); await _wait(0.1); var db = main.top()
	print("CHECK difficulty %s: foe hp %d dmg x%.2f" % [Social.difficulty().get("name"), int(db.foe["max"]), db.dmg_scale])
	await _autobattle(db); await _clear_dialogs(f)
	var cp = main.push(load("res://scripts/charpage.gd").new()); cp.tab = 5; await _wait(0.2); await _shot("27_talents"); main.pop(cp)
	print("CHECK counters=%s" % [Game.hero.get("stats")])
	print("CHECK save=%s load=%s guild=%s comp=%s talents=%d" % [Game.save(), Game.load_save(), Game.hero.get("guild"), Game.hero.get("comp"), Social.talents().size()])

## the realm client against a running backend/server.cjs (a second, browser-format client is driven by the shell)
func _online(url: String) -> void:
	Online.server = url
	Online.token = ""
	var h := await Online.health()
	print("CHECK realm health code=%d realm=%s" % [h["code"], h["data"].get("realm")])
	var e := await Online.auth(true, "godotroam", "lanternpass1")
	print("CHECK register: %s account=%s" % [e if e != "" else "ok", Online.account])
	Game.new_hero("ROAM", "warden", "hearthkin"); Game.zone_id = "ardenhold"; Game.pos = Vector2i(16, 12); Game.hero["gold"] = 5000
	main.clear(); var f = main.push(load("res://scripts/field.gd").new())
	for k in range(100):
		if Online.status == "ONLINE" and Online.peers.size(): break
		await _wait(0.1)
	print("CHECK stream status=%s peer=%s peers=%s" % [Online.status, Online.peer != "", Online.peers.values().map(func(p): return p["presence"].get("n", "?"))])
	print("CHECK players here: %s" % [Online.players_here()])
	await _wait(2.5)
	print("CHECK chat received: %s" % [Online.chat.map(func(c): return "%s/%s: %s" % [c["channel"], c["name"], c["text"]]).slice(-2)])
	var se: String = await Online.say("hello from godot", "world")
	print("CHECK say: %s" % ("ok" if se == "" else se))
	await _wait(0.3); await _shot("28_online_field")
	# market: buy the browser player's listing, then list one of ours
	var mk = main.push(load("res://scripts/market.gd").new())
	for k in range(50):
		if not mk.busy: break
		await _wait(0.1)
	var rows: Array = mk._rows()
	print("CHECK market listings=%d browse=%s" % [mk.listings.size(), rows.map(func(l): return "%s %dG" % [mk._name(l), l["price"]])])
	await _shot("29_market")
	var g0 := int(Game.hero["gold"]); var b0 := Game.bag().size()
	if rows.size(): await mk._act(rows[0])
	print("CHECK bought: %s gold %d -> %d bag %d -> %d item=%s" % [mk.note, g0, Game.hero["gold"], b0, Game.bag().size(), Game.bag().back() if Game.bag().size() else {}])
	Game.bag().append(Game.make_item("longbrand", 5, 30))
	mk.selling = Game.bag().back(); await mk._list("777")
	print("CHECK listed: %s mine=%d" % [mk.note, mk.listings.filter(func(l): return l.get("sellerName") == Online.account).size()])
	main.pop(mk)
	Game.save()
	await _wait(1.0)
	var lb := await Online.call_api(HTTPClient.METHOD_GET, "/api/heroes")
	print("CHECK leaderboard: %s" % [lb["data"].get("heroes", []).map(func(x): return "%s L%d" % [x["name"], x["lvl"]])])
	var rp = main.push(load("res://scripts/realm.gd").new()); await _wait(1.0); await _shot("30_realm"); main.pop(rp)
	# a realm party hosted here: the browser-format client joins and fights in our battle
	Online.host_party(true)
	for k in range(100):
		if Online.joined.size(): break
		await _wait(0.1)
	print("CHECK hosting: joined=%s" % [Online.joined.values().map(func(c): return "%s %s L%d" % [c["name"], c["cls"], c["lvl"]])])
	f._encounter(); await _wait(0.2)
	var hb = main.top(); var said := []
	var tt := 0
	while main.stack.has(hb) and tt < 600:
		if hb.state == "msg":
			said.append_array(hb.msgs); hb.msgs = []; hb.state = "menu"
			if hb.then.is_valid():
				var c = hb.then; hb.then = Callable(); c.call()
		elif hb.state == "menu":
			Game.hero["hp"] = 1000000; await _wait(0.4); hb._act("ATTACK")
		tt += 1
		await get_tree().process_frame
	Game.hero["hp"] = Game.hp_max()
	print("CHECK party battle: ally lines=%s shared=%s" % [said.filter(func(l): return str(l).begins_with("BEE")).slice(0, 3), said.has("Your party shares the spoils.")])
	await _clear_dialogs(f)
	Online.host_party(false)
	# a party hosted by the browser-format client: join, take our turn in its battle, receive the shared reward
	for k in range(100):
		if Online.servers().size(): break
		await _wait(0.1)
	print("CHECK hosts on realm: %s" % [Online.servers()])
	var xp0 := int(Game.hero["xp"])
	if Online.servers().size(): Online.join(str(Online.servers()[0]["peer"]))
	for k in range(100):
		if main.top() != f and main.top().has_method("_options") and not Online.my_turn.is_empty(): break
		await _wait(0.1)
	var rb = main.top()
	print("CHECK remote view: turn=%s options=%s" % [Online.my_turn.get("foes"), rb._options().map(func(o): return o[2]) if rb.has_method("_options") else "none"])
	await _shot("31_party_join")
	if rb.has_method("_options"):
		var o: Array = rb._options()[0]
		Online.emit_topic("srv_act", {"kind": o[0], "target": o[1]}); Online.my_turn = {}
	for k in range(100):
		if int(Game.hero["xp"]) > xp0: break
		await _wait(0.1)
	await _wait(1.0); await _clear_dialogs(f)
	print("CHECK party reward: xp %d -> %d" % [xp0, int(Game.hero["xp"])])
	Online.leave_party()
	# war mode duel against the flagged browser player in the wilds
	Online.war = true; Online._last_pres = ""
	Game.zone_id = "elderwood_s1"; Game.pos = Vector2i(12, 12); Game.facing = "right"
	main.clear(); f = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(f)
	var foe_p := {}
	for k in range(100):
		for op in Online.players_here():
			if op["war"]: foe_p = op
		if not foe_p.is_empty(): break
		await _wait(0.1)
	print("CHECK war mode: flagged player here=%s" % [foe_p])
	var h0 := int(Game.hero.get("honor", 0))
	if not foe_p.is_empty():
		f._duel(foe_p); await _autobattle(main.top()); await _clear_dialogs(f)
	print("CHECK duel honor %d -> %d" % [h0, int(Game.hero.get("honor", 0))])
	print("CHECK done peer=%s" % Online.peer)

func _stage10() -> void:
	# audio: the rendered chip tracks and SFX load, and the field / battle pick the right music
	var st = Sound._stream("music_field", true)
	var sx = Sound._stream("sfx_levelup", false)
	print("CHECK audio: field music %s (%.1f s, loop %s), levelup sfx %s" % [st != null, st.data.size() / 2.0 / st.mix_rate if st else 0.0, st.loop_mode == AudioStreamWAV.LOOP_FORWARD if st else false, sx != null])
	Game.new_hero("MORT", "necromancer", "twinblood"); Game.hero["lvl"] = 28; Game.hero["xp"] = Data.xp_for(28); Game.hero["hp"] = Game.hp_max()
	Game.zone_id = "ardenhold"; Game.pos = Vector2i(16, 12)
	main.clear(); var f = main.push(load("res://scripts/field.gd").new()); await _wait(0.3); await _clear_dialogs(f)
	print("CHECK music in ardenhold: %s" % Sound.cur)
	# NPC AI: townsfolk move about their posts
	var before: Array = f.zone["npcs"].map(func(n): return Vector2i(int(n["x"]), int(n["y"])))
	for k in range(60):
		f.step(0.1)
		await get_tree().process_frame
	var moved := 0
	for k in range(before.size()):
		if Vector2i(int(f.zone["npcs"][k]["x"]), int(f.zone["npcs"][k]["y"])) != before[k]: moved += 1
	var fixed_moved := 0
	for k in range(before.size()):
		var n2: Dictionary = f.zone["npcs"][k]
		if str(n2.get("svc")) in f.FIXED and Vector2i(int(n2["x"]), int(n2["y"])) != before[k]: fixed_moved += 1
	var leash_ok: bool = f.zone["npcs"].all(func(n3): return not n3.has("x0") or (absi(int(n3["x"]) - int(n3["x0"])) <= 2 and absi(int(n3["y"]) - int(n3["y0"])) <= 2))
	print("CHECK npc ai: %d of %d moved in 6 s, fixed services moved=%d, all within leash=%s" % [moved, before.size(), fixed_moved, leash_ok])
	# the necromancer's army: 9 at level 28, then a sacrifice
	print("CHECK army: cap=%d raised=%s" % [Game.army_cap(), Game.army().map(func(m): return "%s %d" % [m["name"], m["max"]])])
	f._encounter(); await _wait(1.0); var b = main.top()
	print("CHECK battle music=%s army in battle=%d options=%s" % [Sound.cur, b.army.size(), b.options()])
	b.state = "menu"; await _wait(0.1); await _shot("32_army_battle")
	for m in b.army.slice(0, 3): m["hp"] = 0
	b._act("RAISE DEAD")
	print("CHECK raise dead: %s alive=%d" % [b.msgs.slice(0, 1), b.army.filter(func(m): return m["hp"] > 0).size()])
	await _autobattle(b); await _clear_dialogs(f)
	var crit0 := Game.stat("crit")
	f._book_kind = "warrior"; f._book_set(3); await _clear_dialogs(f)
	print("CHECK sacrifice warriors: army=%d crit %d -> %d book=%s" % [Game.army().size(), crit0, Game.stat("crit"), Game.book()])
	# UI themes
	var shots := []
	for th in Data.THEMES:
		Data.set_theme(th)
		var bg = main.push(load("res://scripts/settings.gd").new()); bg.i = 2; await _wait(0.15); await _shot("33_theme_" + th); main.pop(bg)
		shots.append(th)
	Data.set_theme("classic")
	print("CHECK themes: %s" % [shots])

func _stage11() -> void:
	# the HD64 6,000 asset pack: atlases load, the gallery pages through every category, monsters use their family's art
	var cats: Dictionary = Data.pack.get("categories", {})
	var total := 0
	for c in cats: total += cats[c].size()
	var loaded := 0
	for c in cats:
		for nm in [cats[c][0], cats[c][cats[c].size() - 1]]:
			if Data.sprite(str(nm)) != null: loaded += 1
	print("CHECK pack: %d categories, %d pictures, first+last of each loaded %d/%d" % [cats.size(), total, loaded, cats.size() * 2])
	main.clear()
	var gal = main.push(load("res://scripts/gallery.gd").new())
	var shots := 0
	for k in [0, 5, 6, 7, 11, 12]:
		gal.cat = k; gal.row = 0; await _wait(0.15); await _shot("34_gallery_%02d" % k); shots += 1
	main.pop(gal)
	Data.set_hd_monsters(true)
	var golem_def := {}
	for b in Data.game["BESTIARY"]:
		if b["fam"] == "construct": golem_def = b; break
	print("CHECK hd monster art: %s (%s) -> %s; off -> %s" % [golem_def["name"], golem_def["fam"], Data.monster_art(golem_def), (func(): Data.hd_monsters = false; var a2 := Data.monster_art(golem_def); Data.hd_monsters = true; return a2).call()])
	Game.new_hero("HDHERO", "warden", "stonekin"); Game.hero["lvl"] = 10; Game.hero["hp"] = Game.hp_max()
	Game.zone_id = "elderwood"; Game.pos = Vector2i(3, 8)
	main.clear(); var f = main.push(load("res://scripts/field.gd").new()); await _wait(0.2); await _clear_dialogs(f)
	var b = load("res://scripts/battle.gd").new(); b.foe_def = golem_def; b.foe_lvl = 10; b.biome = "volcanic"; b.boss = true
	main.push(b); await _wait(1.0); b.state = "menu"; await _wait(0.1); await _shot("35_hd_golem_battle")
	print("CHECK battle foe art=%s" % b.foe["art"])
	main.pop(b)
