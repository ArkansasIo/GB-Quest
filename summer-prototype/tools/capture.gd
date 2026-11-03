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
	get_tree().quit()

func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + "/" + name + ".png")
