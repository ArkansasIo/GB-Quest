extends Node2D
## ART GALLERY: browse the HD64 6,000 asset pack (tools/gen_pack6000_hd.py) by category.
## LEFT/RIGHT: category, UP/DOWN: scroll rows (A/B... B closes). 8 x 6 pictures per page at 64 px.

var main: Node2D
var cat := 0
var row := 0
const COLS := 8
const ROWS := 6

func _cats() -> Array:
	return Data.pack.get("categories", {}).keys()

func step(_d: float) -> void:
	var cs := _cats()
	if cs.is_empty():
		if main.pressed("ui_b") or main.pressed("ui_a"): main.pop(self)
		return
	if main.pressed("ui_left"): cat = (cat + cs.size() - 1) % cs.size(); row = 0
	if main.pressed("ui_right"): cat = (cat + 1) % cs.size(); row = 0
	var n: int = Data.pack["categories"][cs[cat]].size()
	var rows := int(ceil(n / float(COLS)))
	if main.pressed("ui_down") or main.pressed("ui_a"): row = mini(row + ROWS, maxi(0, rows - ROWS))
	if main.pressed("ui_up"): row = maxi(0, row - ROWS)
	if main.pressed("ui_b"): main.pop(self)

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	var cs := _cats()
	Data.panel(self, Rect2(4, 4, 632, 64))
	if cs.is_empty():
		Data.text_c(self, "NO ART PACK", 320, 20)
		Data.text_c(self, "Run node tools/export_godot.cjs", 320, 260, Data.GREY, 0.6)
		return
	var c: String = cs[cat]
	var list: Array = Data.pack["categories"][c]
	Data.text_c(self, c.replace("_", " ").to_upper().substr(0, 34), 320, 14, Data.INK, 0.6)
	Data.text_c(self, "%d/%d  %d PICTURES  ROWS %d-%d" % [cat + 1, cs.size(), list.size(), row + 1, mini(row + ROWS, int(ceil(list.size() / float(COLS))))], 320, 40, Data.GREY, 0.5)
	for k in range(COLS * ROWS):
		var idx := row * COLS + k
		if idx >= list.size(): break
		var p := Vector2(8 + (k % COLS) * 78, 76 + (k / COLS) * 78)
		draw_rect(Rect2(p, Vector2(74, 74)), Color8(34, 40, 58))
		Data.blit_fit(self, str(list[idx]), Rect2(p + Vector2(5, 5), Vector2(64, 64)))
	Data.text(self, "<> CATEGORY  ^v PAGE  B BACK", Vector2(16, 548), Data.GREY, 0.5)
