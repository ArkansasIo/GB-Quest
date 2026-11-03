extends Node2D
## A battle someone else hosts (a browser or Godot player's party): the host's snapshots (srv_battle) are drawn here,
## and on your turn (srv_turn) you pick a target or your best spell (srv_act), as the browser's RemoteBattleView.

var main: Node2D
var i := 0
var t := 0.0

func _ready() -> void:
	Online.want_view = false

func _options() -> Array:
	var o := []
	for f in Online.my_turn.get("foes", []): o.append(["attack", str(f[0]), "ATTACK " + str(f[1])])
	if Game.is_caster() and Game.known_spells().size():
		var sp: Dictionary = Game.known_spells().back()
		o.append(["spell", str(sp.get("id", "")), "CAST " + str(sp.get("name", "")).substr(0, 14)])
	return o

func step(delta: float) -> void:
	t += delta
	if not Online.remote_view.get("active", false) and t > 0.5:
		main.pop(self)
		if Online.party_log.size():
			main.say(Online.party_log.duplicate()); Online.party_log.clear()
		return
	if Online.my_turn.is_empty(): return
	var o := _options()
	if o.is_empty(): return
	if main.pressed("ui_up"): i = (i + o.size() - 1) % o.size()
	if main.pressed("ui_down"): i = (i + 1) % o.size()
	i = clampi(i, 0, o.size() - 1)
	if main.pressed("ui_a"):
		var c: Array = o[i]
		Online.emit_topic("srv_act", {"kind": c[0], "target": c[1]} if c[0] == "attack" else {"kind": "spell", "id": c[1]})
		Online.my_turn = {}

func _draw() -> void:
	var v: Dictionary = Online.remote_view
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	draw_rect(Rect2(0, 150, 640, 230), Color8(54, 46, 88))
	Data.panel(self, Rect2(8, 8, 300, 140))
	var y := 24
	for p in v.get("party", []).slice(0, 4):
		Data.text(self, str(p[0]).substr(0, 8), Vector2(24, y), Data.INK, 0.6)
		Data.bar(self, Rect2(150, y + 2, 140, 16), float(p[1]) / maxf(1, float(p[2])), Data.HP_RED)
		y += 28
	Data.panel(self, Rect2(332, 8, 300, 140))
	y = 24
	for f in v.get("foes", []).slice(0, 4):
		Data.text(self, str(f[0]).substr(0, 8), Vector2(348, y), Data.INK, 0.6)
		Data.bar(self, Rect2(476, y + 2, 140, 16), float(f[1]) / maxf(1, float(f[2])), Data.HP_RED)
		y += 28
	var fs: Array = v.get("foes", [])
	if fs.size() and float(fs[0][1]) > 0: Data.blit_fit(self, str(fs[0][4]) if fs[0].size() > 4 else "", Rect2(400, 170, 180, 180), true)
	var look := "c_%s_4" % Game.hero["cls"]
	Data.blit_fit(self, look, Rect2(80, 200, 130, 160))
	Data.panel(self, Rect2(8, 392, 624, 176))
	if not Online.my_turn.is_empty():
		Data.text(self, "YOUR TURN!", Vector2(32, 408), Data.GOLD, 0.75)
		var o := _options()
		for k in range(o.size()):
			Data.text(self, str(o[k][2]).substr(0, 22), Vector2(72, 444 + k * 40), Data.INK, 0.8)
			if k == i: draw_colored_polygon(PackedVector2Array([Vector2(40, 448 + k * 40), Vector2(56, 460 + k * 40), Vector2(40, 472 + k * 40)]), Data.INK)
	else:
		var lines: Array = load("res://scripts/loot.gd").wrap(str(v.get("text", "Battle in progress...")), 24)
		Data.text(self, "\n".join(lines.slice(0, 3)), Vector2(32, 416))
	Data.text_r(self, "PARTY BATTLE", 616, 540, Data.EDGE, 0.5)
