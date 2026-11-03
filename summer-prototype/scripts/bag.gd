extends Node2D
## GEAR and BAG pages in the handheld layout: tabs at the top, an icon list, and a detail box at the bottom.
## LEFT/RIGHT switches tabs, A equips (BAG) or unequips (GEAR), B closes. With sell = true it is the vendor's sell list.

var main: Node2D
var sell := false
var tab := 1            # 0 GEAR, 1 BAG
var i := 0
var top := 0
var note := ""
const SLOTS := ["weapon", "armor", "shield"]
const ROWS := 5
const RH := 64

func _rows() -> Array:
	if tab == 0 and not sell:
		var out := []
		for s in SLOTS:
			out.append(Game.gear().get(s, {}))
		return out
	return Game.bag()

func step(_d: float) -> void:
	var rows := _rows()
	if not sell and (main.pressed("ui_left") or main.pressed("ui_right")):
		tab = 1 - tab
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
	elif main.pressed("ui_a") and n:
		_act(i)

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
	var tabs := ["SELL"] if sell else ["GEAR", "BAG"]
	for t in range(tabs.size()):
		var on := sell or t == tab
		Data.panel(self, Rect2(8 + t * 200, 8, 192, 64), Data.PANEL if on else Data.PANEL2)
		Data.text_c(self, tabs[t], 8 + t * 200 + 96, 22, Data.INK if on else Data.GREY)
	Data.panel(self, Rect2(416, 8, 216, 64))
	Data.text_r(self, "%dG" % int(Game.hero["gold"]), 608, 22, Data.GOLD)
	# list
	Data.panel(self, Rect2(8, 80, 624, 344))
	var rows := _rows()
	if rows.is_empty():
		Data.text_c(self, "EMPTY", 320, 230, Data.GREY)
	for r in range(top, mini(rows.size(), top + ROWS)):
		var y := 100 + (r - top) * RH
		var it: Dictionary = rows[r]
		if r == i:
			draw_colored_polygon(PackedVector2Array([Vector2(28, y + 14), Vector2(44, y + 28), Vector2(28, y + 42)]), Data.INK)
		if tab == 0 and not sell:
			Data.text(self, str(SLOTS[r]).substr(0, 2).to_upper(), Vector2(52, y + 10), Data.GREY)
		var x := 112 if (tab == 0 and not sell) else 56
		if it.is_empty():
			Data.text(self, "- EMPTY -", Vector2(x + 60, y + 10), Data.GREY)
			continue
		Data.blit_fit(self, str(Game.def_of(it).get("icon", "")), Rect2(x, y, 52, 52))
		var col := Game.rarity_color(it) if Game.can_use(it) else Data.GREY
		Data.text(self, Game.item_name(it).substr(0, 18 if x == 56 else 16), Vector2(x + 60, y + 10), col)
	if rows.size() > ROWS:
		Data.text_r(self, "%d/%d" % [i + 1, rows.size()], 616, 388, Data.GREY, 0.75)
	# detail
	Data.panel(self, Rect2(8, 432, 624, 136))
	var cur: Dictionary = rows[i] if i < rows.size() else {}
	if note != "":
		Data.text(self, note.substr(0, 24), Vector2(32, 450))
	elif not cur.is_empty():
		var rr: Dictionary = Data.game.get("RARITY", [])[int(cur.get("r", 1))]
		Data.text(self, ("%s %s" % [rr.get("name", ""), Game.item_stat(cur)]).substr(0, 24), Vector2(32, 450), Game.rarity_color(cur))
		var hint := ("A: SELL %dG" % (Game.price(cur) / 2)) if sell else ("A: PUT AWAY" if tab == 0 else ("A: EQUIP" if Game.can_use(cur) else "CAN'T USE"))
		Data.text(self, hint, Vector2(32, 492))
	Data.text_r(self, "AC %d HIT +%d" % [Game.ac(), Game.attack_bonus()], 608, 520, Data.EDGE, 0.75)
	if not sell:
		Data.text(self, "<> TAB  B BACK", Vector2(32, 528), Data.GREY, 0.75)
