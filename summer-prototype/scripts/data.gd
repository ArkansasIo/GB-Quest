extends Node
## Game data, sprites and drawing helpers shared by every screen.
## data/game.json, data/zones.json and data/sprites.json are exported from the browser game by tools/export_godot.cjs.

const T := 64                       # one tile: 16 px in the browser game, x4 here
const GLYPH := Vector2(24, 36)      # the game's 6x9 pixel font, x4
# UI colours: the current theme's (SETTINGS > UI THEME); names follow the browser's themes, mu is shown as CRIMSON
var INK := Color8(24, 28, 48)
var EDGE := Color8(64, 88, 160)
var PANEL := Color8(248, 246, 232)
var PANEL2 := Color8(226, 232, 244)
var BORDER := Color8(24, 28, 48)
const GOLD := Color8(232, 184, 48)
const THEMES := {
	"classic": {"name": "CLASSIC", "ink": [24, 28, 48], "edge": [64, 88, 160], "panel": [248, 246, 232], "panel2": [226, 232, 244], "border": [24, 28, 48]},
	"mmo": {"name": "MMO", "ink": [236, 232, 210], "edge": [200, 168, 88], "panel": [26, 34, 60], "panel2": [42, 54, 92], "border": [8, 10, 20]},
	"mu": {"name": "CRIMSON", "ink": [242, 222, 184], "edge": [200, 44, 40], "panel": [38, 14, 16], "panel2": [66, 24, 26], "border": [10, 4, 4]},
	"sanctum": {"name": "SANCTUM", "ink": [212, 232, 228], "edge": [64, 172, 160], "panel": [24, 28, 30], "panel2": [38, 46, 48], "border": [6, 8, 8]},
	"diablo": {"name": "DIABLO", "ink": [232, 204, 150], "edge": [160, 96, 40], "panel": [22, 17, 13], "panel2": [42, 31, 21], "border": [6, 4, 2]},
}
var theme := "classic"

func set_theme(id: String) -> void:
	if not THEMES.has(id): id = "classic"
	theme = id
	var t: Dictionary = THEMES[id]
	INK = Color8(t["ink"][0], t["ink"][1], t["ink"][2])
	EDGE = Color8(t["edge"][0], t["edge"][1], t["edge"][2])
	PANEL = Color8(t["panel"][0], t["panel"][1], t["panel"][2])
	PANEL2 = Color8(t["panel2"][0], t["panel2"][1], t["panel2"][2])
	BORDER = Color8(t["border"][0], t["border"][1], t["border"][2])
	var c := ConfigFile.new()
	c.load("user://settings.cfg")
	c.set_value("ui", "theme", id)
	c.save("user://settings.cfg")
const HP_RED := Color8(216, 48, 40)
const MP_BLUE := Color8(48, 104, 224)
const GREY := Color8(120, 128, 150)

var game: Dictionary = {}
var zones: Dictionary = {}
var sprites: Dictionary = {}
var pack: Dictionary = {}          # the HD64 6,000 asset pack: {categories, families, boss_families} (data/pack6000.json)
var hd_monsters := true            # SETTINGS > MONSTER ART: HD64 pack pictures for monsters and bosses
var _tex_cache: Dictionary = {}
var _atlas_cache: Dictionary = {}
var ok := false

func _ready() -> void:
	game = _load_json("res://data/game.json")
	zones = _load_json("res://data/zones.json")
	sprites = _load_json("res://data/sprites.json")
	pack = _load_json("res://data/pack6000.json")
	ok = not game.is_empty() and not zones.is_empty() and not sprites.is_empty()
	var c := ConfigFile.new()
	if c.load("user://settings.cfg") == OK:
		set_theme(str(c.get_value("ui", "theme", "classic")))
		hd_monsters = bool(c.get_value("ui", "hd_monsters", true))

func set_hd_monsters(on: bool) -> void:
	hd_monsters = on
	var c := ConfigFile.new()
	c.load("user://settings.cfg")
	c.set_value("ui", "hd_monsters", on)
	c.save("user://settings.cfg")

## a monster's picture: with HD64 on, one of the pack's pictures of its family (the same one every time for that monster)
func monster_art(def: Dictionary, boss: bool = false) -> String:
	var art := str(def.get("art", ""))
	if not hd_monsters or pack.is_empty(): return art
	var fam := str(def.get("fam", ""))
	var lists: Dictionary = pack.get("boss_families" if boss else "families", {})
	var l: Array = lists.get(fam, [])
	if l.is_empty(): return art
	return str(l[absi(hash(str(def.get("id", def.get("name", ""))))) % l.size()])
	if not ok:
		push_error("GB-Quest data missing: run `node tools/export_godot.cjs` from the repository root.")

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}

## A sprite by its browser-game name, as a texture (atlas region of the 4x art). Null when unknown.
func sprite(name: String) -> Texture2D:
	if name == "" or not sprites.has(name):
		return null
	if _atlas_cache.has(name):
		return _atlas_cache[name]
	var e: Array = sprites[name]
	var file := "res://art/" + str(e[0])
	if not _tex_cache.has(file):
		_tex_cache[file] = load(file) if ResourceLoader.exists(file) else null
	var base: Texture2D = _tex_cache[file]
	if base == null:
		return null
	var at := AtlasTexture.new()
	at.atlas = base
	at.region = Rect2(e[1], e[2], e[3], e[4])
	at.filter_clip = true   # no bleeding from neighbouring sprites in the sheet (seams between tiles)
	_atlas_cache[name] = at
	return at

# ------------------------------------------------------------------ drawing helpers (call from a CanvasItem's _draw)
func text(ci: CanvasItem, s: String, pos: Vector2, color: Color = Color(0, 0, 0, 0), scale: float = 1.0) -> void:
	if color.a == 0.0: color = INK   # default: the theme's ink
	var font := sprite("font_6x9")
	if font == null:
		ci.draw_string(ThemeDB.fallback_font, pos + Vector2(0, 28 * scale), s, HORIZONTAL_ALIGNMENT_LEFT, -1, int(28 * scale), color)
		return
	var at := font as AtlasTexture
	var x := pos.x
	for ch in s:
		if ch == "\n":
			pos.y += 40 * scale
			x = pos.x
			continue
		var code := ch.unicode_at(0)
		if code < 32 or code > 126:
			code = 63
		if code != 32:
			ci.draw_texture_rect_region(at.atlas, Rect2(Vector2(x, pos.y), GLYPH * scale), Rect2(at.region.position + Vector2((code - 32) * 24, 0), GLYPH), color)
		x += GLYPH.x * scale

func text_c(ci: CanvasItem, s: String, cx: float, y: float, color: Color = Color(0, 0, 0, 0), scale: float = 1.0) -> void:
	text(ci, s, Vector2(cx - s.length() * GLYPH.x * scale / 2.0, y), color, scale)

func text_r(ci: CanvasItem, s: String, rx: float, y: float, color: Color = Color(0, 0, 0, 0), scale: float = 1.0) -> void:
	text(ci, s, Vector2(rx - s.length() * GLYPH.x * scale, y), color, scale)

## the handheld panel: rounded double border, cream fill
func panel(ci: CanvasItem, r: Rect2, fill: Color = Color(0, 0, 0, 0)) -> void:
	if fill.a == 0.0: fill = PANEL
	var b := 4.0
	ci.draw_rect(Rect2(r.position + Vector2(2 * b, 0), r.size - Vector2(4 * b, 0)), BORDER)
	ci.draw_rect(Rect2(r.position + Vector2(0, 2 * b), r.size - Vector2(0, 4 * b)), BORDER)
	ci.draw_rect(Rect2(r.position + Vector2(b, b), r.size - Vector2(2 * b, 2 * b)), BORDER)
	ci.draw_rect(Rect2(r.position + Vector2(2 * b, b), r.size - Vector2(4 * b, 2 * b)), EDGE)
	ci.draw_rect(Rect2(r.position + Vector2(b, 2 * b), r.size - Vector2(2 * b, 4 * b)), EDGE)
	ci.draw_rect(Rect2(r.position + Vector2(2 * b, 2 * b), r.size - Vector2(4 * b, 4 * b)), fill)
	ci.draw_rect(Rect2(r.position + Vector2(3 * b, 3 * b), Vector2(r.size.x - 6 * b, b)), PANEL2 if fill == PANEL else fill.lightened(0.08))

func bar(ci: CanvasItem, r: Rect2, frac: float, color: Color) -> void:
	ci.draw_rect(r, BORDER)
	ci.draw_rect(Rect2(r.position + Vector2(4, 4), r.size - Vector2(8, 8)), Color8(40, 44, 60))
	var w := (r.size.x - 8) * clampf(frac, 0.0, 1.0)
	if w > 0:
		ci.draw_rect(Rect2(r.position + Vector2(4, 4), Vector2(w, r.size.y - 8)), color)

## a sprite fitted inside a box, keeping its aspect ratio
func blit_fit(ci: CanvasItem, name: String, box: Rect2, flip: bool = false) -> void:
	var t := sprite(name)
	if t == null:
		return
	var sz := t.get_size()
	var k := minf(box.size.x / sz.x, box.size.y / sz.y)
	var d := sz * k
	var pos := box.position + (box.size - d) / 2.0
	if flip:
		ci.draw_set_transform(Vector2(pos.x + d.x, pos.y), 0.0, Vector2(-1, 1))
		ci.draw_texture_rect(t, Rect2(Vector2.ZERO, d), false)
		ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	else:
		ci.draw_texture_rect(t, Rect2(pos, d), false)

# ------------------------------------------------------------------ rules lookups
func cls(id: String) -> Dictionary:
	return game.get("CLASSES", {}).get(id, {})

func species(id: String) -> Dictionary:
	return game.get("SPECIES", {}).get(id, {})

func xp_for(lvl: int) -> int:
	var xp: Array = game.get("XP", [])
	return int(xp[clampi(lvl, 0, xp.size() - 1)]) if xp.size() else lvl * lvl * 100

func monster_block(lvl: int) -> Dictionary:
	var L: Array = game.get("MONSTER_LEVELS", [])
	var best: Dictionary = L[0] if L.size() else {}
	for m in L:
		if int(m["lvl"]) <= lvl:
			best = m
	return best
