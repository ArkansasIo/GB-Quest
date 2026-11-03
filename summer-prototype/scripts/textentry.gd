extends Node2D
## Typed text in the handheld style: a prompt, a box and the keyboard. ENTER accepts, ESC cancels.
## Used for the realm address, account name and password, and chat. `secret` shows dots.

var main: Node2D
var prompt := ""
var value := ""
var secret := false
var max_len := 40
var done: Callable = Callable()   # called with the text, or "" on cancel
var _edit: LineEdit
var _t := 0.0

func _ready() -> void:
	_edit = LineEdit.new()
	_edit.text = value
	_edit.max_length = max_len
	_edit.secret = secret
	_edit.position = Vector2(-2000, -2000)   # off screen: we draw our own box, the LineEdit only takes the keys
	_edit.size = Vector2(400, 40)
	add_child(_edit)
	_edit.grab_focus()
	_edit.caret_column = value.length()
	_edit.text_submitted.connect(func(_s): _finish(_edit.text))

func step(delta: float) -> void:
	_t += delta
	if Input.is_action_just_pressed("ui_cancel"):
		_finish("")
	elif not _edit.has_focus():
		_edit.grab_focus()

func _finish(s: String) -> void:
	main.pop(self)
	if done.is_valid(): done.call(s.strip_edges())

func _draw() -> void:
	Data.panel(self, Rect2(8, 160, 624, 230))
	var y := 184.0
	for l in load("res://scripts/loot.gd").wrap(prompt, 24).slice(0, 2):
		Data.text(self, str(l), Vector2(32, y)); y += 40
	draw_rect(Rect2(28, 272, 584, 56), Data.EDGE)
	draw_rect(Rect2(32, 276, 576, 48), Data.PANEL2)
	var shown: String = ("*".repeat(_edit.text.length()) if secret else _edit.text) if _edit else value
	if shown.length() > 22: shown = shown.substr(shown.length() - 22)
	Data.text(self, shown + ("_" if int(_t * 2) % 2 == 0 else " "), Vector2(44, 282))
	Data.text(self, "ENTER: OK   ESC: CANCEL", Vector2(32, 344), Data.GREY, 0.6)
