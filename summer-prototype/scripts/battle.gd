extends Node2D
## Turn-based battle in the handheld layout: HP boxes at the top, foe on the right, hero on the left, menu at the bottom.
## Rules follow the browser game's 5e core: d20 + bonus vs AC, natural 20 crits, spell attacks, XP and level-ups,
## plus the gear layer: affixes (crit, damage, elements, lifesteal, haste, dodge, block, resist, thorns, find),
## the 164 legendary aspects (damage conditions, procs, kill and battle-start effects, damage taken), conditions,
## buffs, barriers and the class job abilities (src/jobs_data.js JOB_ABILITIES).

const Loot = preload("res://scripts/loot.gd")
const GearX = preload("res://scripts/gearx.gd")

var main: Node2D
var foe_def: Dictionary = {}
var foe_lvl := 1
var biome := "meadow"
var foe: Dictionary = {}
var state := "menu"     # menu, msg, over
var msgs: Array = []
var shown := 0.0
var sel := 0
var shake := 0.0
var then: Callable = Callable()
var boss := false               # dungeon floor bosses: more HP, XP and gold, a sure drop, no running
var on_win: Callable = Callable()
var conds := {}                 # on the foe: name -> rounds left
var buffs := {}                 # on the hero: name -> rounds left
var barrier := 0
var first_hit := true
var used := {}                  # job abilities used this battle
var round_no := 1
var hp_mult := 3                # boss HP multiplier (raid bosses use 4, world bosses 5)
var on_lose: Callable = Callable()   # trials: losing ends the trial instead of sending you to the shrine
var max_rounds := 0             # trials: TRIAL OF HOURS
var no_escape := false
var loot := true
var hp_scale := 1.0             # conquest waves, arena and the Spire scale foe HP
var dmg_scale := 1.0

const SKY := {"meadow": [Color8(118, 188, 240), Color8(148, 204, 104)], "coast": [Color8(104, 180, 236), Color8(232, 214, 156)], "marsh": [Color8(146, 168, 160), Color8(118, 140, 96)],
	"jungle": [Color8(128, 198, 168), Color8(96, 160, 76)], "snow": [Color8(176, 202, 236), Color8(236, 242, 248)], "badlands": [Color8(238, 180, 120), Color8(214, 160, 106)],
	"volcanic": [Color8(64, 36, 48), Color8(86, 64, 58)], "dusk": [Color8(54, 46, 88), Color8(86, 78, 104)], "crystal": [Color8(140, 196, 232), Color8(176, 206, 224)]}
const DOTS := ["bleeding", "burning", "venom"]
const BUFF_DMG := {"might": 25, "inspired": 10, "frenzy": 15}
const COND_TAKEN := {"vulnerable": 20, "doomed": 15, "shocked": 10}
const ELEMENTS := ["fire", "cold", "lightning", "necrotic", "radiant"]
const SHORT := {"bleeding": "BLD", "burning": "BRN", "venom": "PSN", "frostbite": "FRZ", "shocked": "SHK", "weakened": "WEAK", "vulnerable": "VUL",
	"sundered": "SND", "slowed": "SLW", "doomed": "DOOM", "frightened": "FEAR", "stunned": "STUN",
	"haste": "HST", "might": "MGT", "focus": "FOC", "fortify": "FRT", "regen": "RGN", "bless": "BLS", "thornskin": "THN", "inspired": "INS", "frenzy": "FRZY", "evade": "EVD"}

func _ready() -> void:
	var blk := Data.monster_block(foe_lvl)
	foe = {"name": str(foe_def.get("name", "FOE")).substr(0, 12), "art": foe_def.get("art", ""), "lvl": foe_lvl, "hp": int(blk.get("hp", 10)), "max": int(blk.get("hp", 10)),
		"ac": int(blk.get("ac", 12)), "hit": int(blk.get("hit", 3)), "dice": str(blk.get("dice", "1d6")), "xp": int(blk.get("xp", 10)), "gold": int(blk.get("gold", 3)), "dt": foe_def.get("dt", "slashing")}
	# difficulty (the oracle) and series scaling
	var D: Dictionary = Social.difficulty()
	foe["max"] = maxi(1, roundi(int(foe["max"]) * hp_scale * float(D.get("hp", 1))))
	foe["hp"] = foe["max"]
	dmg_scale = float(D.get("dmg", 1))
	foe["xp"] = roundi(int(foe["xp"]) * float(D.get("xp", 1)))
	var intro := []
	if boss:
		foe["max"] = int(foe["max"]) * hp_mult; foe["hp"] = foe["max"]; foe["xp"] = int(foe["xp"]) * 4; foe["gold"] = int(foe["gold"]) * 6 + 20
		foe["ac"] = int(foe["ac"]) + 1; foe["hit"] = int(foe["hit"]) + 1
		foe["name"] = str(foe_def.get("name", "BOSS")).substr(0, 14)
		intro.append("%s blocks the way! (BOSS LV%d)" % [foe["name"], foe_lvl])
	else:
		intro.append("A wild %s appears! (LV%d)" % [foe["name"], foe_lvl])
	if int(Game.hero.get("fed", 0)) > int(Game.hero.get("steps", 0)):
		buffs["regen"] = 3
	# battle-start aspects: barriers and opening buffs
	for a in Game.aspects():
		var e: Dictionary = a["e"]
		if e.get("t") != "start": continue
		var act: Dictionary = e.get("act", {})
		if act.get("barrier"):
			barrier += Game.hp_max() * int(a["v"]) / 100
			intro.append("%s: a barrier of %d." % [Loot.aspect_name(a), barrier])
		elif act.has("buff"):
			buffs[str(act["buff"])] = int(a["v"])
			intro.append("%s: %s for %d rounds." % [Loot.aspect_name(a), str(act["buff"]).to_upper(), int(a["v"])])
	_say(intro)

func options() -> Array:
	var o := ["ATTACK"]
	if _abilities().size(): o.append("SKILL")
	if Game.is_caster() and Game.known_spells().size(): o.append("SPELL")
	o.append("POTION x%d" % int(Game.hero["potions"]))
	if _battle_items().size(): o.append("ITEM")
	o.append("RUN")
	return o

func _abilities() -> Array:
	var out := []
	for ab in Data.game.get("JOB_ABILITIES", {}).get(Game.hero["cls"], []):
		if int(ab.get("lvl", 1)) <= int(Game.hero["lvl"]):
			out.append(ab)
	return out

func _say(lines: Array, cb: Callable = Callable()) -> void:
	msgs = lines.duplicate(); shown = 0; state = "msg"; then = cb
	if msgs.is_empty(): msgs = ["..."]
	_sync(state != "over", str(msgs[0]))

# ------------------------------------------------------------------ hosting a realm party (srv_* topics, as src/systems.js battleSync)
var _turn_sent := -1

func _party() -> Array:
	return Online.joined.keys() if Online.hosting else []

func _sync(active: bool, text: String) -> void:
	if _party().is_empty(): return
	var party := [[str(Game.hero["name"]).substr(0, 8), maxi(0, int(Game.hero["hp"])), Game.hp_max()]]
	for pid in _party():
		var ch: Dictionary = Online.joined[pid]
		party.append([str(ch.get("name", "?")).substr(0, 8), 1, 1])
	Online.emit_topic("srv_battle", {"active": active and state != "over", "text": text.substr(0, 120), "party": party,
		"foes": [[str(foe["name"]).substr(0, 10), maxi(0, int(foe["hp"])), int(foe["max"]), "f1", str(foe["art"])]]})
	if active and state != "over" and _turn_sent != round_no:
		_turn_sent = round_no
		for pid in _party():
			Online.emit_topic("srv_turn", {"to": pid, "foes": [["f1", str(foe["name"]).substr(0, 10)]]})

## each joined player acts once a round: their chosen move (srv_act) or an attack if they haven't answered
func _remote_round(out: Array) -> void:
	for pid in _party():
		if int(foe["hp"]) <= 0: return
		var ch: Dictionary = Online.joined[pid]
		var act: Dictionary = Online.pending_acts.get(pid, {"kind": "attack"})
		Online.pending_acts.erase(pid)
		var L := clampi(int(ch.get("lvl", 1)), 1, 720)
		var nm := str(ch.get("name", "ALLY")).substr(0, 10)
		var c := Data.cls(str(ch.get("cls", "warden")))
		var mod := (int(ch.get("base", {}).get(str(c.get("primary", "STR")), 12)) - 10) / 2
		var dice := "1d8"
		if act.get("kind") == "spell":
			for sp in Data.game.get("SPELLS", []):
				if sp.get("id") == act.get("id"): dice = str(sp.get("dice", "1d8"))
		else:
			var wb = ch.get("eq", {}).get("weapon", {}).get("base") if ch.get("eq", {}).get("weapon") is Dictionary else null
			if wb != null: dice = str(Data.game.get("WEAPONS", {}).get(str(wb), {}).get("dmg", "1d8"))
		if Game.d20() + 2 + L / 4 + mod < int(foe["ac"]) and act.get("kind") != "spell":
			out.append("%s misses." % nm)
			continue
		var dmg := maxi(1, Game.roll(dice) + mod + L / 10)
		foe["hp"] = int(foe["hp"]) - dmg
		out.append("%s %s for %d." % [nm, "casts" if act.get("kind") == "spell" else "hits", dmg])

func step(delta: float) -> void:
	if shake > 0: shake -= delta
	if state == "msg":
		var cur: String = msgs[0]
		if shown < cur.length():
			shown += delta * 90
			if main.pressed("ui_a"): shown = cur.length()
			return
		if main.pressed("ui_a") or main.pressed("ui_b"):
			msgs.pop_front(); shown = 0
			if msgs.is_empty():
				state = "menu"
				if then.is_valid():
					var c := then
					then = Callable()
					c.call()
		return
	if state != "menu": return
	var o := options()
	sel = clampi(sel, 0, o.size() - 1)
	if main.pressed("ui_up"): sel = (sel + o.size() - 2) % o.size()
	if main.pressed("ui_down"): sel = (sel + 2) % o.size()
	if main.pressed("ui_left"): sel = (sel + o.size() - 1) % o.size()
	if main.pressed("ui_right"): sel = (sel + 1) % o.size()
	if main.pressed("ui_a"): _act(str(o[sel]))

# ------------------------------------------------------------------ the hero's actions
func _act(o: String) -> void:
	var out := []
	if o == "ATTACK":
		_swing(out, 0)
		# haste: a chance of a second swing
		var hc := Game.stat("haste") + (25 if buffs.has("haste") else 0)
		if int(foe["hp"]) > 0 and Game.rng.randi_range(1, 100) <= hc:
			out.append("Haste! You strike again.")
			_swing(out, 0)
	elif o == "SKILL":
		var names := []
		for ab in _abilities():
			names.append(str(ab["name"]).substr(0, 16) + ("" if not used.has(ab["id"]) else " (USED)"))
		main.choose(names, Callable(self, "_skill"), "Job abilities work once a battle.")
		return
	elif o == "ITEM":
		var names := []
		for id in _battle_items(): names.append("%s x%d" % [Craft.item_name(id).substr(0, 14), int(Craft.items()[id])])
		main.choose(names, Callable(self, "_use_item"), "Use which item?")
		return
	elif o == "SPELL":
		var names := []
		for s in Game.known_spells():
			names.append(str(s["name"]).substr(0, 18))
		main.choose(names, Callable(self, "_cast"), "Cast which spell?")
		return
	elif o.begins_with("POTION"):
		if int(Game.hero["potions"]) <= 0: _say(["No potions left."]); return
		Game.hero["potions"] = int(Game.hero["potions"]) - 1
		var h := (Game.roll("2d4+2") + int(Game.hero["lvl"]) / 5) * (100 + Game.stat("heal")) / 100
		_heal(h); out.append("You drink a potion: +%d HP." % h)
	elif o == "RUN":
		if boss or no_escape:
			_say(["There is no escape from %s!" % foe["name"]])
			return
		if Game.d20() + Game.mod("DEX") >= 10:
			_say(["You got away safely."], Callable(self, "_leave"))
			return
		out.append("You couldn't escape!")
	_after(out)

## one weapon attack: d20 + bonus vs AC; the crit range widens 1 per 5% crit chance
func _swing(out: Array, bonus_pct: int, cond_on_hit: String = "") -> void:
	var r := Game.d20()
	var hit := Game.attack_bonus() + (2 if buffs.has("bless") else 0)
	var ac := int(foe["ac"]) - (2 if conds.has("sundered") else 0)
	var crit_at := 20 - (Game.stat("crit") + (15 if buffs.has("focus") else 0)) / 5
	if r >= crit_at or (r != 1 and r + hit >= ac):
		var crit := r >= crit_at
		var base := Game.weapon_damage(crit)
		var dt := str(Game.def_of(Game.gear().get("weapon", {})).get("type", "bludgeoning"))
		var idx := out.size()
		var dmg := _deal(base, "phys", dt, crit, bonus_pct, out)
		out.insert(idx, ("CRITICAL! " if crit else "") + "You hit for %d. (d20 %d+%d)" % [dmg, r, hit])
		if cond_on_hit != "" and int(foe["hp"]) > 0:
			conds[cond_on_hit] = 3; out.append("%s is %s!" % [foe["name"], cond_on_hit.to_upper()])
	else:
		out.append("You miss. (d20 %d+%d vs AC %d)" % [r, hit, ac])

## damage the foe: affix %, elements, buff and condition modifiers, aspect conditions, crits; then procs and lifesteal
func _deal(base: int, kind: String, dt: String, crit: bool, bonus_pct: int, out: Array) -> int:
	var pct := Game.stat("dmg") + bonus_pct
	if ELEMENTS.has(dt): pct += Game.stat(dt)
	for b in buffs: pct += int(BUFF_DMG.get(b, 0))
	for c in conds: pct += int(COND_TAKEN.get(c, 0))
	var fr := float(foe["hp"]) / maxf(1, foe["max"])
	var hr := float(Game.hero["hp"]) / maxf(1, Game.hp_max())
	for a in Game.aspects():
		var e: Dictionary = a["e"]
		if e.get("t") != "dmg": continue
		var w := str(e.get("when", ""))
		var ok := false
		match w:
			"lowhp": ok = fr < 0.35
			"fullhp": ok = fr >= 0.999
			"elite": ok = boss
			"crit": ok = crit
			"first": ok = first_hit
			"selfhigh": ok = hr >= 0.8
			"selflow": ok = hr < 0.35
			"phys": ok = kind == "phys"
			"spell": ok = kind == "spell"
			_:
				if w.begins_with("el:"): ok = dt == w.substr(3)
				elif w.begins_with("cond:"): ok = conds.has(w.substr(5))
				elif w.begins_with("buff:"): ok = buffs.has(w.substr(5))
		if ok: pct += int(a["v"])
	var dmg := maxi(1, int(base * (100 + pct + (Game.stat("critdmg") if crit else 0)) / 100.0))
	first_hit = false
	foe["hp"] = int(foe["hp"]) - dmg
	shake = 0.25
	# lucky-hit procs
	for a in Game.aspects():
		var e: Dictionary = a["e"]
		if e.get("t") != "proc": continue
		var chance := int(a["v"]) if e.get("pv") else int(e.get("p", 15))
		if Game.rng.randi_range(1, 100) > chance: continue
		var act: Dictionary = e.get("act", {})
		var nm := Loot.aspect_name(a)
		if act.has("chain") or act.has("bonus"):
			var extra := maxi(1, dmg * int(a["v"]) / 100)
			foe["hp"] = int(foe["hp"]) - extra
			out.append("%s: +%d %s." % [nm, extra, str(act.get("chain", act.get("bonus")))])
		elif act.get("heal"):
			var h := Game.hp_max() * int(a["v"]) / 100
			_heal(h); out.append("%s: +%d HP." % [nm, h])
		elif act.get("barrier"):
			barrier += Game.hp_max() * int(a["v"]) / 100; out.append("%s: barrier %d." % [nm, barrier])
		elif act.has("cond"):
			conds[str(act["cond"])] = int(act.get("rounds", 2)); out.append("%s: %s %s." % [nm, foe["name"], str(act["cond"]).to_upper()])
		elif act.has("buff"):
			buffs[str(act["buff"])] = int(act.get("rounds", 2)); out.append("%s: %s." % [nm, str(act["buff"]).to_upper()])
	var leech := Game.stat("leech")
	if leech > 0:
		var h := maxi(1, dmg * leech / 100)
		_heal(h); out.append("Lifesteal +%d HP." % h)
	return dmg

## consumables usable in battle: anything that heals or grants a buff
func _battle_items() -> Array:
	var out := []
	for id in Craft.items():
		var it: Dictionary = Data.game.get("ITEMS", {}).get(id, {})
		if it.has("heal") or (it.has("buff") and it["buff"] != "fed"): out.append(id)
	return out

func _use_item(k: int) -> void:
	if k < 0: return
	var res: Array = Craft.use_item(str(_battle_items()[k]), true)
	if str(res[1]) != "": buffs[str(res[1])] = 3
	_after(res[0])

func _heal(h: int) -> void:
	Game.hero["hp"] = mini(Game.hp_max(), int(Game.hero["hp"]) + h)

func _skill(k: int) -> void:
	if k < 0: return
	var ab: Dictionary = _abilities()[k]
	if used.has(ab["id"]):
		_say(["%s is spent this battle." % ab["name"]])
		return
	used[ab["id"]] = true
	var out := ["%s!" % ab["name"]]
	var d := str(ab.get("desc", "")).to_lower()
	if ab.get("t") == "enemy":
		var cond := ""
		for pair in [["bleed", "bleeding"], ["burn", "burning"], ["poison", "venom"], ["venom", "venom"], ["stun", "stunned"], ["frost", "frostbite"], ["freez", "frostbite"],
				["slow", "slowed"], ["weak", "weakened"], ["shock", "shocked"], ["lightning", "shocked"], ["fear", "frightened"], ["armor", "sundered"], ["armour", "sundered"]]:
			if d.contains(pair[0]):
				cond = pair[1]
				break
		var tmp := []
		_swing(tmp, 50, cond)
		out.append_array(tmp)
	else:
		if d.contains("dodge") or d.contains("decoy") or d.contains("evade"):
			buffs["evade"] = 2; out.append("You will dodge the next attacks.")
		elif d.contains("heal") or d.contains("mend"):
			var h := Game.hp_max() * 30 / 100
			_heal(h); out.append("+%d HP." % h)
		elif d.contains("haste") or d.contains("speed"):
			buffs["haste"] = 3; out.append("HASTED for 3 rounds.")
		elif d.contains("crit") or d.contains("focus"):
			buffs["focus"] = 3; out.append("FOCUSED for 3 rounds.")
		elif d.contains("rage") or d.contains("fury") or d.contains("might"):
			buffs["might"] = 3; out.append("MIGHT for 3 rounds.")
		else:
			buffs["fortify"] = 3; out.append("FORTIFIED for 3 rounds.")
	_after(out)

func _cast(k: int) -> void:
	if k < 0:
		return
	var s: Dictionary = Game.known_spells()[k]
	var base := maxi(1, Game.roll(str(s.get("dice", "1d8"))) + Game.mod(str(Data.cls(Game.hero["cls"]).get("cast", "INT"))))
	var saved: bool = s.get("save") != null and Game.d20() + int(foe["lvl"]) / 4 >= Game.spell_dc()
	if saved and s.get("half", false):
		base = int(base / 2)
	elif saved:
		base = 0
	var out := []
	if base > 0:
		var dmg := _deal(base, "spell", str(s.get("dt", "")), false, 0, out)
		out.insert(0, "You cast %s: %d %s damage." % [s["name"], dmg, s.get("dt", "")])
	else:
		out.append("%s resists %s." % [foe["name"], s["name"]])
	_after(out)

func _lost() -> void:
	main.pop(self)
	Game.hero["hp"] = maxi(1, int(Game.hero["hp"]))
	if on_lose.is_valid(): on_lose.call()

func _leave() -> void:
	main.pop(self)

func _won() -> void:
	main.pop(self)
	if on_win.is_valid():
		on_win.call()
	Game.save()

func _died() -> void:
	Game.hero["hp"] = Game.hp_max()
	Game.hero["gold"] = int(Game.hero["gold"]) / 2
	Game.dun = {}
	Game.zone_id = "elderwood"
	Game.pos = Vector2i(3, 8)
	Game.save()
	main.clear()
	main.push(load("res://scripts/field.gd").new())

# ------------------------------------------------------------------ end of the hero's turn: victory or the foe's turn
func _after(out: Array) -> void:
	if int(foe["hp"]) <= 0:
		_victory(out)
		return
	# joined realm players, then the companion
	if _party().size():
		_remote_round(out)
		if int(foe["hp"]) <= 0:
			_victory(out)
			return
	if not Social.companion().is_empty():
		out.append_array(Social.companion_turn(foe))
		if int(foe["hp"]) <= 0:
			_victory(out)
			return
	# the foe's turn
	if conds.has("stunned"):
		out.append("%s is stunned!" % foe["name"])
	else:
		_foe_attack(out)
	if int(Game.hero["hp"]) <= 0:
		state = "over"
		if on_lose.is_valid():
			out.append("You are beaten.")
			_say(out, Callable(self, "_lost"))
			return
		out.append_array(["You have fallen...", "You wake at the village shrine with half your gold."])
		_say(out, Callable(self, "_died"))
		return
	# end of round: damage over time, regeneration, durations
	for c in DOTS:
		if conds.has(c):
			var t := maxi(1, int(foe["max"]) * 4 / 100)
			foe["hp"] = int(foe["hp"]) - t
			out.append("%s takes %d from %s." % [foe["name"], t, c])
	if buffs.has("regen"):
		var h := maxi(1, Game.hp_max() * 5 / 100); _heal(h); out.append("Regen +%d HP." % h)
	for dct in [conds, buffs]:
		for k in dct.keys():
			dct[k] = int(dct[k]) - 1
			if int(dct[k]) <= 0: dct.erase(k)
	round_no += 1
	if int(foe["hp"]) <= 0:
		_victory(out)
		return
	if max_rounds and round_no > max_rounds:
		out.append("Time is up! (%d rounds)" % max_rounds)
		state = "over"
		_say(out, Callable(self, "_lost"))
		return
	_say(out)

func _foe_attack(out: Array) -> void:
	var r := Game.d20()
	var hit := int(foe["hit"]) - (2 if conds.has("frostbite") or conds.has("slowed") else 0) - (2 if conds.has("frightened") else 0)
	if not (r == 20 or (r != 1 and r + hit >= Game.ac())):
		out.append("%s misses." % foe["name"])
		return
	if buffs.has("evade") or Game.rng.randi_range(1, 100) <= Game.stat("dodge"):
		out.append("You dodge %s!" % foe["name"])
		return
	var dmg := maxi(1, roundi(Game.roll(str(foe["dice"])) * (2 if r == 20 else 1) * dmg_scale))
	var red := Game.stat("resist") + Social.companion_guard() + (25 if conds.has("weakened") else 0) + (25 if buffs.has("fortify") else 0)
	var hr := float(Game.hero["hp"]) / maxf(1, Game.hp_max())
	var reflect := 0
	for a in Game.aspects():
		var e: Dictionary = a["e"]
		if e.get("t") != "hit": continue
		var act: Dictionary = e.get("act", {})
		if act.get("reflect"):
			reflect += int(a["v"])
		elif act.has("curse"):
			if Game.rng.randi_range(1, 100) <= int(a["v"]):
				conds[str(act["curse"])] = 2; out.append("%s: %s is %s." % [Loot.aspect_name(a), foe["name"], str(act["curse"]).to_upper()])
		elif act.get("reduce"):
			var w := str(act.get("when", "always"))
			if w == "always" or (w == "lowhp" and hr < 0.5) or (w == "elite" and boss) or (w == "barrier" and barrier > 0) or (w.begins_with("el:") and str(foe["dt"]) == w.substr(3)):
				red += int(a["v"])
	dmg = maxi(1, dmg * (100 - mini(80, red)) / 100)
	if Game.rng.randi_range(1, 100) <= Game.stat("block"):
		dmg = maxi(1, dmg / 2); out.append("Blocked!")
	var absorbed := mini(barrier, dmg)
	barrier -= absorbed
	dmg -= absorbed
	Game.hero["hp"] = int(Game.hero["hp"]) - dmg
	out.append("%s hits you for %d%s." % [foe["name"], dmg, (" (%d absorbed)" % absorbed) if absorbed else ""])
	var back := Game.stat("thorns") + (dmg + absorbed) * (reflect + (10 if buffs.has("thornskin") else 0)) / 100
	if back > 0:
		foe["hp"] = int(foe["hp"]) - back; out.append("%s takes %d back." % [foe["name"], back])

func _victory(out: Array) -> void:
	var rb := Social.region_bonus(Quest.here_region())
	var xp := int(foe["xp"]) * (100 + Game.stat("xp") + rb) / 100
	var gold := int(foe["gold"]) * (100 + Game.stat("gf") + rb) / 100
	Social.count("kills")
	if boss: Social.count("elites")
	if foe_def.has("where"): Social.count("worldBosses")
	Social.bond_up()
	var ups := Game.gain_xp(xp)
	Game.hero["gold"] = int(Game.hero["gold"]) + gold; Game.hero["kills"] = int(Game.hero.get("kills", 0)) + 1
	out.append_array(["%s is defeated!" % foe["name"], "Got %d XP and %d G." % [xp, gold]])
	for a in Game.aspects():
		var e: Dictionary = a["e"]
		if e.get("t") != "kill": continue
		var act: Dictionary = e.get("act", {})
		if act.get("heal"):
			var h := Game.hp_max() * int(a["v"]) / 100; _heal(h); out.append("%s: +%d HP." % [Loot.aspect_name(a), h])
		elif act.has("explode"):
			out.append("%s: the foe bursts in %s!" % [Loot.aspect_name(a), act["explode"]])
	if ups: out.append("LEVEL UP! You are now level %d." % int(Game.hero["lvl"]))
	var gd: Dictionary = Data.game.get("GEM_DROP", {})
	if loot and Game.rng.randf() < float(gd.get("boss" if boss else "normal", 0.02)) * (1.0 + Game.stat("mf") / 100.0):
		var g := GearX.random_gem(int(foe["lvl"]), Game.rng)
		var gems: Dictionary = Game.hero.get("gems", {})
		gems[g] = int(gems.get(g, 0)) + 1; Game.hero["gems"] = gems
		out.append("Found a gem: %s!" % GearX.gem(g)["name"])
	if loot and (boss or Game.rng.randf() < (0.2 + int(foe["lvl"]) / 400.0 + Game.stat("mf") / 1000.0) * float(Social.difficulty().get("loot", 1))):
		var it := Game.random_drop(int(foe["lvl"]))
		if boss:
			var nr := mini(8, int(it["r"]) + 2)
			it = Game.make_item(str(it["id"]), nr, int(foe["lvl"]))
		Game.bag().append(it)
		out.append("Found %s!" % Game.item_name(it))
	out.append_array(Quest.on_kill(foe_def, boss))
	for pid in _party():
		Online.emit_topic("srv_end", {"to": pid, "xp": xp, "gold": gold / 2})
	if _party().size(): out.append("Your party shares the spoils.")
	state = "over"
	_say(out, Callable(self, "_won"))

# ------------------------------------------------------------------ drawing
func _draw() -> void:
	var c: Array = SKY.get(biome, SKY["meadow"])
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	draw_rect(Rect2(0, 120, 640, 120), c[0])
	draw_rect(Rect2(0, 240, 640, 140), c[1])
	draw_set_transform(Vector2(randf_range(-6, 6) if shake > 0 else 0.0, 0), 0, Vector2.ONE)
	draw_circle(Vector2(472, 340), 110, c[1].darkened(0.15))
	if int(foe["hp"]) > 0: Data.blit_fit(self, str(foe["art"]), Rect2(392, 170, 170, 170) if not boss else Rect2(372, 130, 210, 210), true)
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	draw_circle(Vector2(140, 370), 110, c[1].darkened(0.1))
	var cmp := Social.companion()
	if not cmp.is_empty():
		Data.blit_fit(self, "c_%s_4" % cmp["cls"], Rect2(196, 262, 90, 110))
	var look := "c_%s_4" % Game.hero["cls"]
	Data.blit_fit(self, look if Data.sprite(look) else "np_class_" + Game.hero["cls"], Rect2(80, 220, 130, 150))
	# HP boxes, with the barrier as a white band and conditions / buffs as tags under them
	Data.panel(self, Rect2(8, 8, 300, 96))
	Data.text(self, ("%s L%d" % [Game.hero["name"], int(Game.hero["lvl"])]).substr(0, 11), Vector2(28, 24))
	Data.bar(self, Rect2(28, 64, 200, 20), float(Game.hero["hp"]) / maxf(1, Game.hp_max()), Data.HP_RED)
	if barrier > 0:
		draw_rect(Rect2(32, 68, 192 * clampf(float(barrier) / maxf(1, Game.hp_max()), 0, 1), 4), Color.WHITE)
	Data.text(self, "%d" % maxi(0, int(Game.hero["hp"])), Vector2(236, 56), Data.INK, 0.75)
	Data.panel(self, Rect2(332, 8, 300, 96))
	Data.text(self, ("%s L%d" % [foe["name"], int(foe["lvl"])]).substr(0, 11), Vector2(352, 24))
	Data.bar(self, Rect2(352, 64, 256, 20), float(foe["hp"]) / maxf(1, foe["max"]), Data.HP_RED)
	_tags(buffs, Vector2(16, 110), Color8(232, 246, 255))
	_tags(conds, Vector2(340, 110), Color8(255, 220, 200))
	# message or menu
	Data.panel(self, Rect2(8, 392, 624, 176))
	if state == "msg" and msgs.size():
		var s: String = msgs[0]
		Data.text(self, _wrapped(s.substr(0, int(shown))), Vector2(32, 416))
	elif state == "menu":
		var o := options()
		for k in range(o.size()):
			var x := 56 + (k % 2) * 300
			var y := 412 + int(k / 2) * 50
			Data.text(self, str(o[k]), Vector2(x, y))
			if k == sel: draw_colored_polygon(PackedVector2Array([Vector2(x - 32, y + 4), Vector2(x - 16, y + 18), Vector2(x - 32, y + 32)]), Data.INK)

func _tags(d: Dictionary, at: Vector2, col: Color) -> void:
	var x := at.x
	for k in d:
		var t := "%s%d" % [SHORT.get(k, str(k).substr(0, 3).to_upper()), int(d[k])]
		var w := t.length() * 12 + 8
		if x + w > at.x + 292: break
		draw_rect(Rect2(x, at.y, w, 22), Data.INK)
		Data.text(self, t, Vector2(x + 4, at.y + 2), col, 0.5)
		x += w + 4

func _wrapped(s: String) -> String:
	return "\n".join(Loot.wrap(s, 24).slice(0, 3))
