extends Node2D
## Fishing (as the browser game's Fishing scene): cast, wait, and press A when the float bobs. Too early or too late loses the fish.
## Catches: small fish, silverfin, sand eel or an old boot; fishing skill widens the bite window and improves the catch.

var main: Node2D
var t := 0.0
var state := "cast"     # cast, wait, bite
var wait := 0.0
var bite_at := 0.0

func _ready() -> void:
	wait = 1.0 + Game.rng.randf() * 3.0

func skill() -> int:
	return int(Game.hero.get("craft", {}).get("fish", 1))

func step(delta: float) -> void:
	t += delta
	match state:
		"cast":
			if t > 0.35: state = "wait"
		"wait":
			if main.pressed("ui_b"):
				main.pop(self); return
			if main.pressed("ui_a"):
				_end(["Too early! The fish swims off."]); return
			if t > wait:
				state = "bite"; bite_at = t; Sound.sfx("bite")
		"bite":
			if main.pressed("ui_a"):
				_catch(); return
			if t - bite_at > 0.5 + skill() / 200.0:
				_end(["It got away..."])

func _end(lines: Array) -> void:
	main.pop(self)
	main.say(lines)

func _catch() -> void:
	var r := Game.rng.randf() * 100 + skill() / 4.0
	var k := "old_boot" if r < 8 else ("eel" if r > 90 else ("big_fish" if r > 70 else "small_fish"))
	if not Data.game.get("ITEMS", {}).has(k): k = "small_fish"
	var out := []
	if k == "old_boot":
		out.append("An old boot. Lovely.")
	else:
		Sound.sfx("reel")
		Craft.add(k)
		Social.count("fish")
		var cr: Dictionary = Game.hero.get("craft", {}); cr["fish"] = skill() + 1; Game.hero["craft"] = cr
		out.append("CAUGHT %s! (fishing %d)" % [Craft.mat_name(k), skill()])
		out.append_array(Quest.on_fish(Game.zone_id))
	main.pop(self)
	main.say(out)

func _draw() -> void:
	Data.panel(self, Rect2(120, 200, 400, 176))
	Data.text_c(self, "FISHING", 320, 216, Data.EDGE, 0.75)
	# water, line and float
	draw_rect(Rect2(144, 260, 352, 72), Color8(72, 132, 208))
	var bob := 0.0
	if state == "bite": bob = 8.0 * sin(t * 40.0)
	draw_line(Vector2(200, 228), Vector2(360, 280 + bob), Data.INK, 2)
	draw_circle(Vector2(360, 284 + bob), 9, Data.HP_RED)
	draw_circle(Vector2(360, 288 + bob), 9, Color.WHITE)
	var msg := {"cast": "CASTING...", "wait": "WAIT... (B: STOP)", "bite": "! PRESS A !"}[state] as String
	Data.text_c(self, msg, 320, 340, Data.HP_RED if state == "bite" else Data.INK, 0.6)
