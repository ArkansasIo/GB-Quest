# Test driver for the online capture run, for a throwaway local realm only (GBQ_DATA=<temp dir> node backend/server.cjs).
# Usage: python3 summer-prototype/tools/realm_peer.py <log file>   then run capture.tscn with: -- <out dir> online
# A second realm client speaking the browser game's formats (src/systems.js), driven step by step against the Godot client.
import json, sys, threading, time, urllib.request
U = "http://127.0.0.1:8787"
LOG = open(sys.argv[1], "w", buffering=1)
def log(*a): print(*a, file=LOG)
def call(method, path, body=None, tok=None):
    req = urllib.request.Request(U + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=10) as r: return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return {"error": e.read().decode()}
tok = call("POST", "/api/register", {"username": "browserbee", "password": "lanternpass2"})["token"]
events = []; state = {"peer": None, "peers": []}
def stream():
    with urllib.request.urlopen(U + "/api/stream?token=" + tok, timeout=600) as r:
        ev = None
        for raw in r:
            line = raw.decode().rstrip("\n")
            if line.startswith("event:"): ev = line[6:].strip()
            elif line.startswith("data:"):
                d = json.loads(line[5:]); events.append((ev, d))
                if ev == "hello": state["peer"] = d["peer"]
                if ev == "peers": state["peers"] = d["peers"]
threading.Thread(target=stream, daemon=True).start()
while not state["peer"]: time.sleep(0.1)
me = state["peer"]
def pres(**kw):
    p = {"n": "BEE", "c": "strider", "l": 14, "z": "ardenhold", "x": 18, "y": 12, "d": "left", "w": 0, "h": None, "j": None}; p.update(kw)
    call("POST", "/api/presence", {"peer": me, "presence": p}, tok)
def emit(topic, data): return call("POST", "/api/emit", {"peer": me, "topic": topic, "data": data}, tok)
def roam():
    for p in state["peers"]:
        if p["presence"].get("n") == "ROAM": return p
    return None
pres()
call("POST", "/api/market", {"item": {"kind": "weapon", "base": "knife", "rarity": 4, "plus": 3, "ilvl": 20, "affixes": [["crit", 5], ["dmg", 12]], "greater": [1], "name": "KNIFE +3", "aspect": {"id": "executioner", "val": 40}}, "price": 250, "hours": 12, "sellerName": "BEE"}, tok)
t0 = time.time(); seen = 0; phase = "wait_host"; acted = 0; godot = None
while time.time() - t0 < 170:
    if int(time.time() - t0) % 3 == 0 and seen != int(time.time() - t0):
        seen = int(time.time() - t0); emit("chat", {"channel": "world", "text": "buzz %d from the browser" % seen})
    r = roam()
    if r: godot = r["peer"]
    if phase == "wait_host" and r and r["presence"].get("h"):
        log("SAW godot hosting:", r["presence"]["h"]); emit("srv_char", {"to": godot, "ch": {"name": "BEE", "species": "thornelf", "cls": "strider", "bg": "wanderer", "lvl": 14, "base": {"STR": 12, "DEX": 16}, "eq": {"weapon": {"kind": "weapon", "base": "longbow" , "rarity": 2, "plus": 0, "ilvl": 14, "affixes": []}}}}); phase = "in_godot_party"
    for ev, d in list(events):
        events.remove((ev, d))
        if ev != "msg": continue
        t = d.get("topic"); data = d.get("data") or {}
        if t == "srv_turn" and data.get("to") == me:
            log("GOT srv_turn foes=", data.get("foes")); emit("srv_act", {"kind": "attack", "target": data["foes"][0][0]}); acted += 1
        if t == "srv_battle" and phase == "in_godot_party" and not data.get("active"): log("GOT srv_battle end text=", data.get("text"))
        if t == "srv_end" and data.get("to") == me:
            log("GOT srv_end xp=%s gold=%s" % (data.get("xp"), data.get("gold"))); phase = "browser_host"; pres(h="BEE'S REALM")
        if t == "srv_char" and phase == "browser_host" and data.get("to") == me:
            log("GOT srv_char from godot: name=%s cls=%s lvl=%s eq=%s" % (data["ch"]["name"], data["ch"]["cls"], data["ch"]["lvl"], sorted(data["ch"]["eq"].keys())))
            emit("srv_battle", {"active": True, "text": "A GOBLIN WARBAND attacks the party!", "party": [["BEE", 90, 100], ["ROAM", 40, 44]], "foes": [["GOBLIN", 30, 30, "x1", "enemy_goblin"], ["GOBLIN", 30, 30, "x2", "enemy_goblin"]]})
            time.sleep(1.5); emit("srv_turn", {"to": godot, "foes": [["x1", "GOBLIN"], ["x2", "GOBLIN"]]}); phase = "await_act"
        if t == "srv_act" and phase == "await_act":
            log("GOT srv_act from godot:", data); emit("srv_battle", {"active": True, "text": "ROAM strikes the goblin!", "party": [["BEE", 90, 100], ["ROAM", 40, 44]], "foes": [["GOBLIN", 0, 30, "x1", "enemy_goblin"], ["GOBLIN", 0, 30, "x2", "enemy_goblin"]]})
            time.sleep(0.5); emit("srv_end", {"to": godot, "xp": 500, "gold": 40}); emit("srv_battle", {"active": False, "text": "Victory!", "party": [], "foes": []})
            phase = "pvp"; pres(h=None, z="elderwood_s1", x=13, y=12, w=1); log("PVP presence set")
    time.sleep(0.1)
log("DONE acted=%d phase=%s" % (acted, phase))
