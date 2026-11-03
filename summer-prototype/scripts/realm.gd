extends Node2D
## The REALM page: connect the port to the game's realm server (backend/server.cjs) to play beside browser players.
## Shows the realm status, signs in or registers, lists who is online, the leaderboard, and sends chat.

const TextEntry = preload("res://scripts/textentry.gd")
var main: Node2D
var i := 0
var info: Array = []        # status lines
var busy := false
var _user := ""
var _register := false

func opts() -> Array:
	if Online.signed_in():
		var party := "STOP HOSTING" if Online.hosting else ("LEAVE PARTY" if Online.host_of != "" else "HOST PARTY")
		var o := ["PLAYERS ONLINE", party]
		if not Online.hosting and Online.host_of == "": o.append("JOIN PARTY")
		return o + ["WAR MODE: %s" % ("ON" if Online.war else "OFF"), "SAY", "WORLD CHAT", "LEADERBOARD", "SERVER ADDRESS", "LOG OUT", "BACK"]
	return ["LOG IN", "REGISTER", "SERVER ADDRESS", "CHECK REALM", "BACK"]

func _ready() -> void:
	_check()

func _check() -> void:
	busy = true
	var r := await Online.health()
	busy = false
	if int(r["code"]) == 200:
		var d: Dictionary = r["data"]
		info = ["REALM %s" % str(d.get("realm", "?")).substr(0, 18), "%d ONLINE  %d ACCOUNTS%s" % [int(d.get("players", 0)), int(d.get("accounts", 0)), "  MAINTENANCE" if d.get("maintenance", false) else ""]]
	else:
		info = ["REALM UNREACHABLE", Online.err_text(r).substr(0, 36)]
	if Online.signed_in() and Online.status == "OFFLINE": Online.connect_stream()

func step(_d: float) -> void:
	if busy: return
	var o := opts()
	i = clampi(i, 0, o.size() - 1)
	if main.pressed("ui_up"): i = (i + o.size() - 1) % o.size()
	if main.pressed("ui_down"): i = (i + 1) % o.size()
	if main.pressed("ui_b"): main.pop(self); return
	if main.pressed("ui_a"): _pick(str(o[i]))

func _entry(prompt: String, value: String, secret: bool, cb: Callable) -> void:
	var t := TextEntry.new()
	t.prompt = prompt; t.value = value; t.secret = secret; t.done = cb
	main.push(t)

func _pick(o: String) -> void:
	match o:
		"LOG IN", "REGISTER":
			_register = o == "REGISTER"
			_entry("Account name (3-16 letters, digits or _):", Online.account, false, Callable(self, "_got_user"))
		"SERVER ADDRESS":
			_entry("Realm address (run npm run server on the host):", Online.server, false, Callable(self, "_got_server"))
		"CHECK REALM": _check()
		"LOG OUT":
			busy = true; await Online.logout(); busy = false; info = ["Signed out."]
		"PLAYERS ONLINE":
			var lines := ["%d other players online." % Online.peers.size()]
			for id in Online.peers:
				var p: Dictionary = Online.peers[id]["presence"]
				var zn := str(Data.zones.get(str(p.get("z", "")), {}).get("name", p.get("z", "?")))
				lines.append("%s L%d %s" % [str(p.get("n", Online.peers[id]["name"])).substr(0, 10), int(p.get("l", 1)), zn.substr(0, 12)])
			main.say(lines)
		"LEADERBOARD":
			busy = true
			var r := await Online.call_api(HTTPClient.METHOD_GET, "/api/heroes")
			busy = false
			if int(r["code"]) != 200: main.say([Online.err_text(r)]); return
			var lines := ["REALM LEADERBOARD"]
			var n := 0
			for hro in r["data"].get("heroes", []):
				n += 1
				if n > 10: break
				lines.append("%d. %s L%d %s" % [n, str(hro.get("name", "?")).substr(0, 10), int(hro.get("lvl", 1)), str(Data.cls(str(hro.get("cls", ""))).get("name", "")).substr(0, 8)])
			main.say(lines)
		"SAY", "WORLD CHAT":
			var ch := "say" if o == "SAY" else "world"
			_entry("Message to %s:" % ("players near you" if ch == "say" else "the whole realm"), "", false, Callable(self, "_send").bind(ch))
		"HOST PARTY":
			Online.host_party(true); info = ["HOSTING %s" % Online.host_name, "Others can join from REALM > JOIN PARTY."]
		"STOP HOSTING":
			Online.host_party(false); info = ["Party closed."]
		"LEAVE PARTY":
			Online.leave_party(); info = ["You left the party."]
		"JOIN PARTY":
			_hosts = Online.servers()
			if _hosts.is_empty(): main.say(["Nobody is hosting a party right now."]); return
			main.choose(_hosts.map(func(h2): return "%s (%s L%d)" % [str(h2["name"]).substr(0, 12), str(h2["host"]).substr(0, 8), int(h2["lvl"])]), Callable(self, "_join"), "Join whose party?")
		"BACK": main.pop(self)
		_:
			if o.begins_with("WAR MODE"):
				Online.war = not Online.war; Online._last_pres = ""
				info = ["WAR MODE %s." % ("ON: flagged players may duel you in the wilds" if Online.war else "OFF")]

var _hosts: Array = []

func _join(k: int) -> void:
	if k < 0: return
	Online.join(str(_hosts[k]["peer"]))
	info = ["JOINED %s" % _hosts[k]["name"], "You fight in their battles; rewards are shared."]

func _got_server(s: String) -> void:
	if s == "": return
	Online.server = s.trim_suffix("/") if s.begins_with("http") else "http://" + s.trim_suffix("/")
	Online._save_cfg()
	_check()

func _got_user(s: String) -> void:
	if s == "": return
	_user = s
	_entry("Password for %s (8+ characters):" % s, "", true, Callable(self, "_got_pass"))

func _got_pass(pw: String) -> void:
	if pw == "": return
	busy = true
	info = ["SIGNING IN..."]
	var e := await Online.auth(_register, _user, pw)
	busy = false
	info = [e.substr(0, 36)] if e != "" else ["SIGNED IN AS %s" % Online.account, "Your hero joins the realm on its next step."]

func _send(text: String, ch: String) -> void:
	if text == "": return
	var e := await Online.say(text, ch)
	if e != "": main.say([e])

func _draw() -> void:
	draw_rect(Rect2(0, 0, 640, 576), Color8(16, 20, 36))
	Data.panel(self, Rect2(8, 8, 624, 142))
	Data.text(self, "REALM", Vector2(32, 26), Data.EDGE)
	Data.text_r(self, Online.status, 608, 26, Data.GOLD if Online.status == "ONLINE" else Data.GREY, 0.75)
	Data.text(self, Online.server.substr(0, 40), Vector2(32, 72), Data.GREY, 0.6)
	var y := 92.0
	for l in (["PLEASE WAIT..."] if busy else info):
		Data.text(self, str(l).substr(0, 36), Vector2(32, y), Data.INK, 0.55); y += 22
	if Online.signed_in():
		Data.text(self, "ACCOUNT %s" % Online.account, Vector2(32, 124), Data.EDGE, 0.5)
	var o := opts()
	Data.panel(self, Rect2(8, 156, 624, 32 + o.size() * 34))
	for k in range(o.size()):
		var ty := 172 + k * 34
		Data.text(self, str(o[k]), Vector2(72, ty), Data.INK, 0.7)
		if k == i: draw_colored_polygon(PackedVector2Array([Vector2(36, ty + 2), Vector2(52, ty + 13), Vector2(36, ty + 24)]), Data.INK)
	Data.text(self, "Play beside browser players on your realm server.", Vector2(16, 548), Data.GREY, 0.45)
