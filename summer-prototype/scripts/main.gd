extends Node2D
## Screen stack like the browser game's `scenes`: only the top screen gets input; every screen draws, bottom to top.

const Title = preload("res://scripts/title.gd")
const Dialog = preload("res://scripts/dialog.gd")
const Choice = preload("res://scripts/choice.gd")

var stack: Array = []

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color8(16, 20, 36))
	if not Data.ok:
		var d := Dialog.new()
		d.lines = ["GAME DATA MISSING.", "From the repository root run:", "node tools/build.cjs", "node tools/export_godot.cjs"]
		push(d)
		return
	push(Title.new())

func push(s: Node2D) -> Node2D:
	s.set("main", self)
	add_child(s)
	stack.append(s)
	return s

func pop(s: Node2D = null) -> void:
	var t: Node2D = s if s else (stack.back() if stack.size() else null)
	if t == null:
		return
	stack.erase(t)
	t.queue_free()

func clear() -> void:
	for s in stack:
		s.queue_free()
	stack.clear()

func top() -> Node2D:
	return stack.back() if stack.size() else null

## show pages of text, then call back
func say(lines: Array, cb: Callable = Callable()) -> void:
	var d := Dialog.new()
	d.lines = lines
	d.done = cb
	push(d)

## a pop-up list; cb gets the index (or -1 on B)
func choose(opts: Array, cb: Callable, prompt: String = "") -> void:
	var c := Choice.new()
	c.opts = opts
	c.done = cb
	c.prompt = prompt
	push(c)

func _process(delta: float) -> void:
	var t := top()
	if t and t.has_method("step"):
		t.step(delta)
	for s in stack:
		s.queue_redraw()

func pressed(action: String) -> bool:
	return Input.is_action_just_pressed(action)
