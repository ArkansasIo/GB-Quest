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
	get_tree().quit()

func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + "/" + name + ".png")
