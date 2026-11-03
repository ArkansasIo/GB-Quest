extends Node2D
## The trading hub (auction house) on the realm server: the same listings browser players see.
## BROWSE buys (you pay here, the seller is credited by the server less its 5% cut), SELL lists a bag item at your price,
## MINE cancels your listings, CLAIM collects gold from sales and expired items. Items convert to and from the browser format.

const TextEntry = preload("res://scripts/textentry.gd")
const TABS := ["BROWSE", "MINE", "SELL", "CLAIM"]
var main: Node2D
var tab := 0
var i := 0
var top := 0
var listings: Array = []
var busy := false
var note := ""
const ROWS := 6

func _ready() -> void:
	_load()

func _load() -> void:
	busy = true
	var r := await Online.call_api(HTTPClient.METHOD_GET, "/api/market")
	busy = false
	if int(r["code"]) != 200:
		note = Online.err_text(r); listings = []; return
	listings = r["data"].get("listings", [])

func _rows() -> Array:
	match tab:
		0: return listings.filter(func(l): return l.get("sellerName", "") != Online.account and _ok(l))
		1: return listings.filter(func(l): return l.get("sellerName", "") == Online.account)
		2: return Game.bag()
	return []

func _ok(l: Dictionary) -> bool:
	if l.get("item") is Dictionary: return Online.usable_wire(l["item"])
	return l.get("stack") is Dictionary

func _name(l: Dictionary) -> String:
	if l.get("item") is Dictionary:
		var it: Dictionary = Online.from_wire(l["item"])
		return Game.item_name(it) if not Game.def_of(it).is_empty() else str(l["item"].get("name", "?"))
	var st: Dictionary = l.get("stack", {})
	return "%s x%d" % [Craft.mat_name(str(st.get("id", "?"))), int(st.get("n", 1))]

func step(_d: float) -> void:
	if busy: return
	if main.pressed("ui_left") or main.pressed("ui_right"):
		tab = (tab + (3 if main.pressed("ui_left") else 1)) % 4
		i = 0; top = 0; note = ""
		if tab == 3: _claim()
		return
	var rows := _rows()
	var n := rows.size()
	if n:
		if main.pressed("ui_up"): i = (i + n - 1) % n
		if main.pressed("ui_down"): i = (i + 1) % n
		i = clampi(i, 0, n - 1)
		if i < top: top = i
		if i >= top + ROWS: top = i - ROWS + 1
	if main.pressed("ui_b"): main.pop(self); return
	if main.pressed("ui_a") and n: _act(rows[i])

func _act(row: Dictionary) -> void:
	match tab:
		0:
			var price := int(row["price"])
			if int(Game.hero["gold"]) < price: note = "Need %d G." % price; return
			busy = true
			var r := await Online.call_api(HTTPClient.METHOD_POST, "/api/market/buy", {"id": row["id"]})
			busy = false
			if int(r["code"]) != 200: note = Online.err_text(r); await _load(); return
			Game.hero["gold"] = int(Game.hero["gold"]) - price
			_receive(row)
			note = "Bought %s." % _name(row)
			Game.save()
			await _load()
		1:
			busy = true
			var r := await Online.call_api(HTTPClient.METHOD_POST, "/api/market/cancel", {"id": row["id"]})
			busy = false
			if int(r["code"]) != 200: note = Online.err_text(r); return
			_receive(row)
			note = "Listing cancelled."
			Game.save()
			await _load()
		2:
			selling = row
			var t := TextEntry.new()
			t.prompt = "Price for %s (G):" % Game.item_name(row)
			t.value = str(Game.price(row))
			t.done = Callable(self, "_list")
			main.push(t)

var selling: Dictionary = {}

func _list(s: String) -> void:
	if s == "" or not s.is_valid_int() or int(s) < 1: note = "No listing made."; return
	busy = true
	var r := await Online.call_api(HTTPClient.METHOD_POST, "/api/market", {"item": Online.to_wire(selling), "price": int(s), "hours": 24, "sellerName": Online.account})
	busy = false
	if int(r["code"]) != 200: note = Online.err_text(r); return
	Game.bag().erase(selling)
	note = "Listed for %s G (24 h)." % s
	Game.save()
	await _load()

func _receive(row: Dictionary) -> void:
	if row.get("item") is Dictionary:
		Game.bag().append(Online.from_wire(row["item"]))
	elif row.get("stack") is Dictionary:
		Craft.add(str(row["stack"].get("id", "scrap")), int(row["stack"].get("n", 1)))

func _claim() -> void:
	busy = true
	var r := await Online.call_api(HTTPClient.METHOD_GET, "/api/market/claim")
	busy = false
	if int(r["code"]) != 200: note = Online.err_text(r); return
	var g := int(r["data"].get("gold", 0))
	var back: Array = r["data"].get("returned", [])
	Game.hero["gold"] = int(Game.hero["gold"]) + g
	for l in back: _receive(l)
	note = "Claimed %d G and %d returned item%s." % [g, back.size(), "" if back.size() == 1 else "s"]
	Game.save()

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	for t in range(4):
		Data.panel(self, Rect2(4 + t * 158, 4, 154, 56), Data.PANEL if t == tab else Data.PANEL2)
		Data.text_c(self, TABS[t], 4 + t * 158 + 77, 20, Data.INK if t == tab else Data.GREY, 0.7)
	Data.panel(self, Rect2(8, 66, 624, 400))
	var rows := _rows()
	if busy:
		Data.text_c(self, "CONTACTING REALM...", 320, 240, Data.GREY, 0.75)
	elif rows.is_empty():
		Data.text_c(self, ["NO LISTINGS", "NOTHING LISTED", "BAG EMPTY", "SEE BELOW"][tab], 320, 240, Data.GREY, 0.75)
	else:
		for r in range(top, mini(rows.size(), top + ROWS)):
			var y := 88 + (r - top) * 60
			var row: Dictionary = rows[r]
			if r == i: draw_colored_polygon(PackedVector2Array([Vector2(24, y + 10), Vector2(40, y + 22), Vector2(24, y + 34)]), Data.INK)
			if tab == 2:
				Data.blit_fit(self, str(Game.def_of(row).get("icon", "")), Rect2(48, y, 44, 44))
				Data.text(self, Game.item_name(row).substr(0, 18), Vector2(100, y + 8), Game.rarity_color(row), 0.85)
			else:
				var icon := ""
				if row.get("item") is Dictionary: icon = str(Game.def_of(Online.from_wire(row["item"])).get("icon", ""))
				else: icon = Craft.mat_icon(str(row.get("stack", {}).get("id", "")))
				Data.blit_fit(self, icon, Rect2(48, y, 44, 44))
				Data.text(self, _name(row).substr(0, 15), Vector2(100, y + 2), Data.INK, 0.75)
				Data.text(self, "%s  %dG" % [str(row.get("sellerName", "?")).substr(0, 10), int(row.get("price", 0))], Vector2(100, y + 30), Data.GREY, 0.5)
	Data.panel(self, Rect2(8, 472, 624, 96))
	Data.text(self, note.substr(0, 34) if note != "" else ["A: BUY", "A: CANCEL", "A: LIST", ""][tab], Vector2(28, 488), Data.INK, 0.7)
	Data.text(self, "GOLD %d   <> TAB  B BACK" % int(Game.hero["gold"]), Vector2(28, 528), Data.GREY, 0.55)
