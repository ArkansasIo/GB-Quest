extends Node2D
## Handheld dialogue box: wraps text into 2-line pages at the bottom of the screen; A or B turns the page.

var main: Node2D
var lines: Array = []
var done: Callable = Callable()
var pages: Array = []
var i := 0
var shown := 0.0

func _ready() -> void:
	for l in lines:
		var words := str(l).split(" ")
		var cur := ""
		var page := []
		for w in words:
			if (cur + " " + w).strip_edges().length() > 24:
				page.append(cur.strip_edges())
				cur = w
				if page.size() == 3:
					pages.append("\n".join(page))
					page = []
			else:
				cur += " " + w
		if cur.strip_edges() != "":
			page.append(cur.strip_edges())
		if page.size():
			pages.append("\n".join(page))
	if pages.is_empty():
		pages = [""]

func step(delta: float) -> void:
	var page: String = pages[i]
	if shown < page.length():
		shown += delta * 90.0
		if main.pressed("ui_a") or main.pressed("ui_b"):
			shown = page.length()
		return
	if main.pressed("ui_a") or main.pressed("ui_b"):
		i += 1
		shown = 0
		if i >= pages.size():
			main.pop(self)
			if done.is_valid():
				done.call()

func _draw() -> void:
	var r := Rect2(8, 576 - 184, 624, 176)
	Data.panel(self, r)
	var page: String = pages[mini(i, pages.size() - 1)]
	Data.text(self, page.substr(0, int(shown)), Vector2(32, 576 - 160), Data.INK)
	if shown >= page.length() and int(Time.get_ticks_msec() / 400) % 2:
		Data.text(self, "v", Vector2(592, 576 - 52), Data.INK)
