extends Node2D
## Pop-up list hugging the right edge with a triangle cursor; an optional prompt box below it.

var main: Node2D
var opts: Array = []
var done: Callable = Callable()
var prompt := ""
var i := 0
var top := 0
const ROWS := 7
const RH := 56

func step(_d: float) -> void:
	var n := opts.size()
	if n == 0:
		_finish(-1)
		return
	if main.pressed("ui_up"):
		i = (i + n - 1) % n
	if main.pressed("ui_down"):
		i = (i + 1) % n
	if i < top:
		top = i
	if i >= top + ROWS:
		top = i - ROWS + 1
	if main.pressed("ui_a"):
		_finish(i)
	elif main.pressed("ui_b"):
		_finish(-1)

func _finish(k: int) -> void:
	main.pop(self)
	if done.is_valid():
		done.call(k)

func _draw() -> void:
	var bottom := 576.0 - 8
	if prompt != "":
		Data.panel(self, Rect2(8, 576 - 184, 624, 176))
		var words := prompt.split(" ")
		var cur := ""
		var y := 576 - 160
		for w in words:
			if (cur + " " + w).strip_edges().length() > 24:
				Data.text(self, cur.strip_edges(), Vector2(32, y)); y += 40; cur = w
			else:
				cur += " " + w
		Data.text(self, cur.strip_edges(), Vector2(32, y))
		bottom = 576 - 192
	var widest := 4
	for o in opts:
		widest = maxi(widest, str(o).length())
	var vis := opts.slice(top, top + ROWS)
	var w := minf(624, widest * 24 + 88)
	var h := vis.size() * RH + 40
	var x := 640 - w - 8
	var y0 := maxf(8, bottom - h)
	Data.panel(self, Rect2(x, y0, w, h))
	for j in range(vis.size()):
		var ty := y0 + 28 + j * RH
		Data.text(self, str(vis[j]).substr(0, 23), Vector2(x + 56, ty))
		if top + j == i:
			draw_colored_polygon(PackedVector2Array([Vector2(x + 24, ty + 4), Vector2(x + 40, ty + 18), Vector2(x + 24, ty + 32)]), Data.INK)
	if top > 0:
		Data.text(self, "^", Vector2(x + w - 40, y0 + 6))
	if top + ROWS < opts.size():
		Data.text(self, "v", Vector2(x + w - 40, y0 + h - 40))
