extends Node
## Autoload "Online": the port as a client of the game's own realm server (backend/server.cjs), so Godot players and
## browser players share one realm. Nothing here changes the server; it uses the same endpoints as the browser client:
##   POST /api/register, /api/login           account and session token (kept in user://online.cfg on this machine only)
##   GET  /api/stream?token=                  Server-Sent Events: "hello" (our peer id), "peers" (presence), "msg" (chat)
##   POST /api/presence {peer, presence}      where we are, in the browser's format {n, c, l, z, x, y, d, g, m}
##   POST /api/emit {peer, topic:"chat", data:{channel, text}}
##   GET/POST /api/market, /api/market/buy, /api/market/cancel, GET /api/market/claim   the trading hub (5% cut)
##   PUT /api/hero, GET /api/heroes           the realm leaderboard
## Items cross the wire in the browser's item format (kind, base, rarity, plus, ilvl, affixes, aspect), converted both ways.

const CFG := "user://online.cfg"
var server := "http://127.0.0.1:8787"
var token := ""
var account := ""
var peer := ""
var status := "OFFLINE"
var peers: Dictionary = {}         # peer id -> {name, presence}
var chat: Array = []               # [{name, text, channel, t}]
var _sse: HTTPClient
var _sse_buf := ""
var _sse_state := 0                 # 0 idle, 1 connecting, 2 requested, 3 streaming
var _last_pres := ""
var _pres_t := 0.0
var _retry := 0.0

func _ready() -> void:
	var c := ConfigFile.new()
	if c.load(CFG) == OK:
		server = str(c.get_value("realm", "server", server))
		token = str(c.get_value("realm", "token", ""))
		account = str(c.get_value("realm", "account", ""))

func _save_cfg() -> void:
	var c := ConfigFile.new()
	c.set_value("realm", "server", server)
	c.set_value("realm", "token", token)
	c.set_value("realm", "account", account)
	c.save(CFG)

func signed_in() -> bool:
	return token != ""

# ------------------------------------------------------------------ REST
## returns {"code": int, "data": parsed JSON or {}}; code 0 when the realm can't be reached
func call_api(method: int, path: String, body = null) -> Dictionary:
	var req := HTTPRequest.new()
	req.timeout = 8.0
	add_child(req)
	var headers := PackedStringArray(["Content-Type: application/json"])
	if token != "": headers.append("Authorization: Bearer " + token)
	var err := req.request(server + path, headers, method, JSON.stringify(body) if body != null else "")
	if err != OK:
		req.queue_free()
		return {"code": 0, "data": {"error": "Could not reach %s." % server}}
	var res: Array = await req.request_completed
	req.queue_free()
	var parsed = JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8()) if (res[3] as PackedByteArray).size() else {}
	if int(res[0]) != HTTPRequest.RESULT_SUCCESS:
		return {"code": 0, "data": {"error": "Could not reach %s." % server}}
	return {"code": int(res[1]), "data": parsed if parsed is Dictionary else {}}

func err_text(r: Dictionary) -> String:
	return str(r.get("data", {}).get("error", "Realm error %d." % int(r.get("code", 0))))

func auth(register: bool, username: String, password: String) -> String:
	var r := await call_api(HTTPClient.METHOD_POST, "/api/register" if register else "/api/login", {"username": username, "password": password})
	if not [200, 201].has(int(r["code"])): return err_text(r)
	token = str(r["data"].get("token", ""))
	account = str(r["data"].get("account", {}).get("name", username))
	_save_cfg()
	connect_stream()
	return ""

func logout() -> void:
	if token != "": await call_api(HTTPClient.METHOD_POST, "/api/logout", {})
	token = ""; account = ""; peer = ""; peers = {}; status = "OFFLINE"
	_sse = null; _sse_state = 0
	_save_cfg()

func health() -> Dictionary:
	return await call_api(HTTPClient.METHOD_GET, "/api/health")

# ------------------------------------------------------------------ live stream (SSE over HTTPClient)
func connect_stream() -> void:
	if token == "": return
	var u := server.replace("http://", "").replace("https://", "")
	var tls := server.begins_with("https://")
	var host := u.split("/")[0]
	var port := 443 if tls else 80
	if host.contains(":"):
		port = int(host.split(":")[1]); host = host.split(":")[0]
	_sse = HTTPClient.new()
	_sse_buf = ""
	if _sse.connect_to_host(host, port, TLSOptions.client() if tls else null) != OK:
		status = "OFFLINE"; _sse = null; return
	_sse_state = 1
	status = "CONNECTING"

func _process(delta: float) -> void:
	if _sse == null:
		if token != "" and _sse_state != 0:
			_retry -= delta
			if _retry <= 0: connect_stream()
		return
	_sse.poll()
	var st := _sse.get_status()
	match _sse_state:
		1:
			if st == HTTPClient.STATUS_CONNECTED:
				_sse.request(HTTPClient.METHOD_GET, "/api/stream?token=" + token, PackedStringArray(["Accept: text/event-stream"]))
				_sse_state = 2
			elif st in [HTTPClient.STATUS_CANT_CONNECT, HTTPClient.STATUS_CANT_RESOLVE, HTTPClient.STATUS_CONNECTION_ERROR, HTTPClient.STATUS_TLS_HANDSHAKE_ERROR]:
				_drop()
		2, 3:
			if st == HTTPClient.STATUS_BODY:
				if _sse_state == 2:
					if _sse.get_response_code() != 200:
						if _sse.get_response_code() == 401:
							token = ""   # the session expired: sign in again
							_save_cfg()
						_drop()
						return
					_sse_state = 3
				var chunk := _sse.read_response_body_chunk()
				if chunk.size(): _feed(chunk.get_string_from_utf8())
			elif st != HTTPClient.STATUS_REQUESTING:
				_drop()
	if _sse_state == 3 and peer != "":
		_pres_t -= delta
		if _pres_t <= 0:
			_pres_t = 0.5
			publish_presence()

func _drop() -> void:
	_sse = null
	_sse_state = 9 if token != "" else 0
	_retry = 5.0
	peer = ""
	peers = {}
	status = "OFFLINE"

func _feed(s: String) -> void:
	_sse_buf += s
	while _sse_buf.contains("\n\n"):
		var i := _sse_buf.find("\n\n")
		var block := _sse_buf.substr(0, i)
		_sse_buf = _sse_buf.substr(i + 2)
		var ev := ""
		var data := ""
		for line in block.split("\n"):
			if line.begins_with("event:"): ev = line.substr(6).strip_edges()
			elif line.begins_with("data:"): data += line.substr(5).strip_edges()
		if ev != "" and data != "": _event(ev, JSON.parse_string(data))

func _event(ev: String, d) -> void:
	if not d is Dictionary: return
	match ev:
		"hello":
			peer = str(d.get("peer", ""))
			status = "ONLINE"
			_last_pres = ""
		"peers":
			var next := {}
			for p in d.get("peers", []):
				if p.get("sameTab", false) or str(p.get("peer", "")) == peer: continue
				next[str(p["peer"])] = {"name": str(p.get("name", "")), "presence": p.get("presence", {})}
			peers = next
		"msg":
			if d.get("topic") == "chat":
				var m: Dictionary = d.get("data", {})
				_push_chat(str(m.get("name", "?")), str(m.get("text", "")), str(m.get("channel", "say")))

func _push_chat(name: String, text: String, channel: String) -> void:
	chat.append({"name": name, "text": text, "channel": channel, "t": Time.get_ticks_msec()})
	if chat.size() > 30: chat.pop_front()

## our presence in the browser client's format, so browser players see us walking too
func presence() -> Dictionary:
	var h: Dictionary = Game.hero
	if h.is_empty(): return {}
	return {"n": str(h.get("name", "")).substr(0, 10), "c": h.get("cls", ""), "l": int(h.get("lvl", 1)), "z": "inst" if not Game.dun.is_empty() else Game.zone_id,
		"x": Game.pos.x, "y": Game.pos.y, "d": Game.facing, "g": h.get("guild", null), "m": 1 if h.get("mounted", false) else 0, "w": 0, "h": null, "j": null, "uid": null}

func publish_presence() -> void:
	var p := presence()
	var k := JSON.stringify(p)
	if k == _last_pres: return
	_last_pres = k
	call_api(HTTPClient.METHOD_POST, "/api/presence", {"peer": peer, "presence": p})

## other players in this zone: [{name, cls, x, y, d, lvl}]
func players_here() -> Array:
	var out := []
	for id in peers:
		var p: Dictionary = peers[id].get("presence", {})
		if str(p.get("z", "")) == Game.zone_id and Game.dun.is_empty():
			out.append({"name": str(p.get("n", peers[id]["name"])), "cls": str(p.get("c", "warden")), "x": int(p.get("x", 0)), "y": int(p.get("y", 0)), "d": str(p.get("d", "down")), "lvl": int(p.get("l", 1))})
	return out

func say(text: String, channel: String = "say") -> String:
	if peer == "": return "Not connected to a realm."
	var r := await call_api(HTTPClient.METHOD_POST, "/api/emit", {"peer": peer, "topic": "chat", "data": {"channel": channel, "text": text}})
	if int(r["code"]) != 200: return err_text(r)
	_push_chat(str(Game.hero.get("name", account)), text, channel)
	return ""

# ------------------------------------------------------------------ items: port <-> browser format
func to_wire(it: Dictionary) -> Dictionary:
	var kind: String = {"w": "weapon", "a": "armor"}.get(it.get("k"), "wondrous")
	var af := []
	var greater := []
	var src: Array = it.get("af", [])
	for i in range(src.size()):
		af.append([src[i][0], int(src[i][1])])
		if src[i].size() > 2 and src[i][2]: greater.append(i)
	var w := {"kind": kind, "base": it.get("id", ""), "rarity": int(it.get("r", 1)), "plus": int(it.get("plus", 0)), "ilvl": int(it.get("ilvl", 1)),
		"affixes": af, "greater": greater, "name": Game.item_name(it), "value": Game.price(it)}
	if it.has("asp"): w["aspect"] = {"id": it["asp"]["id"], "val": int(it["asp"]["v"])}
	if it.get("sk", []).size(): w["sockets"] = it["sk"].map(func(g): return g if g != "" else null)
	if int(it.get("mw", 0)): w["mw"] = int(it["mw"])
	return w

func from_wire(w: Dictionary) -> Dictionary:
	var k: String = {"weapon": "w", "armor": "a"}.get(str(w.get("kind", "")), "o")
	var af := []
	var g: Array = w.get("greater", []).map(func(x): return int(x))   # JSON numbers arrive as floats
	var src: Array = w.get("affixes", [])
	for i in range(src.size()):
		af.append([str(src[i][0]), int(src[i][1]), g.has(i)])
	var it := {"k": k, "id": str(w.get("base", "")), "r": clampi(int(w.get("rarity", 1)), 0, 8), "plus": int(w.get("plus", 0)), "ilvl": int(w.get("ilvl", 1)), "af": af}
	if w.get("aspect") is Dictionary: it["asp"] = {"id": str(w["aspect"].get("id", "")), "v": int(w["aspect"].get("val", 0))}
	if w.get("sockets") is Array: it["sk"] = w["sockets"].map(func(s): return str(s) if s != null else "")
	if w.has("mw"): it["mw"] = int(w["mw"])
	return it

## a wire item the port can hold (its base exists in our tables)
func usable_wire(w: Dictionary) -> bool:
	return not Game.def_of(from_wire(w)).is_empty()

# ------------------------------------------------------------------ leaderboard
func publish_hero() -> void:
	if token == "" or Game.hero.is_empty(): return
	var h: Dictionary = Game.hero
	call_api(HTTPClient.METHOD_PUT, "/api/hero", {"name": str(h.get("name", "")), "cls": h.get("cls", ""), "lvl": int(h.get("lvl", 1)), "ach": 0,
		"tower": int(h.get("spire", 0)), "rating": int(h.get("rating", 1000)), "ch": int(h.get("chapter", 0))})
