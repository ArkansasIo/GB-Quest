#!/usr/bin/env python3
"""
Generate extra art from the sliced sheet assets (run after extract_assets.py).

  b_<biome>_<r>_<c>.png   8 biome recolours of the 32 world tiles
  d_<theme>_<r>_<c>.png   5 themed recolours of the 28 dungeon tiles
  e_<tint>_<enemy>.png    6 elemental variants of every enemy sprite
  c_<class>_<i>.png       12 class looks built from the hero/elder/villager poses
  px_<name>.png           hand-drawn 12x12 icons (weapons, materials, UI)

Everything is derived from src_sheet/sheet.png or drawn here, so the whole
game still comes from the original sheet.
"""
import colorsys, json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")
count = 0


def load(n):
    return np.array(Image.open(os.path.join(A, n + ".png")).convert("RGBA")).astype(float)


def save(n, a):
    global count
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA").save(os.path.join(A, n + ".png"))
    count += 1


def hsv_map(a, fn):
    """Apply fn(h,s,v)->(h,s,v) per pixel (vectorised via numpy)."""
    rgb = a[..., :3] / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn + 1e-9
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    h = np.where(mx - mn < 1e-6, 0, h)
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-9), 0)
    v = mx
    h, s, v = fn(h, s, v)
    h = h % 1.0; s = np.clip(s, 0, 1); v = np.clip(v, 0, 1)
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros_like(rgb)
    for k, (R, G, B) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[..., 0][m], out[..., 1][m], out[..., 2][m] = R[m], G[m], B[m]
    o = a.copy(); o[..., :3] = out * 255
    return o


def tint(a, col, amt):
    o = a.copy(); c = np.array(col, float)
    lum = (a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11)[..., None] / 255.0
    o[..., :3] = a[..., :3] * (1 - amt) + (c * (0.35 + lum * 0.9)) * amt
    return o


def set_hue(target, sat=None, vmul=1.0, vadd=0.0, smul=1.0):
    def fn(h, s, v):
        h2 = np.full_like(h, target)
        return h2, (np.full_like(s, sat) if sat is not None else s * smul), v * vmul + vadd
    return fn


# ------------------------------------------------------------ biome tile recolours
GRASS = {(0, 0), (1, 4), (3, 3), (0, 4), (0, 1), (1, 1), (1, 0)}
WATER = {(0, 2), (1, 2), (0, 7), (1, 7), (3, 2), (2, 2)}
SAND = {(0, 6), (1, 6)}
MOUNT = {(0, 3), (1, 3)}
PATHS = {(0, 5), (1, 5), (2, 1), (2, 3), (2, 5), (3, 1), (3, 5)}

BIOMES = {
    # name: (grass fn, water fn, sand fn, mountain fn, other fn)
    "marsh":   (set_hue(0.20, vmul=0.7, smul=0.7), set_hue(0.22, sat=0.45, vmul=0.65), set_hue(0.13, vmul=0.7), None, lambda h, s, v: (h, s * .6, v * .75)),
    "snow":    (set_hue(0.58, sat=0.12, vmul=0.35, vadd=0.62), set_hue(0.53, sat=0.25, vmul=0.4, vadd=0.55), set_hue(0.6, sat=0.08, vmul=0.3, vadd=0.68), set_hue(0.6, sat=0.1, vmul=0.6, vadd=0.35), lambda h, s, v: (h, s * .4, v * .7 + .25)),
    "volcanic": (set_hue(0.02, sat=0.35, vmul=0.45), set_hue(0.06, sat=0.95, vmul=0.6, vadd=0.38), set_hue(0.03, sat=0.3, vmul=0.5), set_hue(0.0, sat=0.4, vmul=0.55), lambda h, s, v: (h * 0 + 0.02, s * .5, v * .6)),
    "jungle":  (set_hue(0.33, smul=1.5, vmul=0.85), set_hue(0.45, sat=0.6, vmul=0.8), set_hue(0.18, vmul=0.85), None, lambda h, s, v: (h, s * 1.2, v * .9)),
    "badlands": (set_hue(0.08, sat=0.45, vmul=0.85), set_hue(0.08, sat=0.4, vmul=0.55), set_hue(0.04, sat=0.55, vmul=0.85), set_hue(0.04, sat=0.45, vmul=0.8), lambda h, s, v: (h * 0 + .06, s * .6, v * .85)),
    "crystal": (set_hue(0.47, smul=1.1, vmul=0.95), set_hue(0.55, sat=0.7, vmul=0.95, vadd=0.05), set_hue(0.5, sat=0.15, vmul=0.5, vadd=0.45), set_hue(0.75, sat=0.35, vmul=0.85), lambda h, s, v: (h * 0 + .55, s * .3, v * .7 + .3)),
    "dusk":    (set_hue(0.78, sat=0.45, vmul=0.5), set_hue(0.8, sat=0.6, vmul=0.45), set_hue(0.82, sat=0.3, vmul=0.5), set_hue(0.8, sat=0.35, vmul=0.45), lambda h, s, v: (h * 0 + .78, s * .5, v * .55)),
    "coast":   (set_hue(0.25, vmul=1.0), set_hue(0.55, sat=0.55, vmul=1.0, vadd=0.1), set_hue(0.12, sat=0.3, vmul=0.8, vadd=0.2), None, None),
}
for biome, (fg, fw, fs, fm, fo) in BIOMES.items():
    for r in range(4):
        for c in range(8):
            a = load(f"world_{r}_{c}")
            fn = fg if (r, c) in GRASS else fw if (r, c) in WATER else fs if (r, c) in SAND else fm if (r, c) in MOUNT else (fo if (r, c) not in PATHS else (lambda h, s, v: (h, s * .8, v * .9)))
            save(f"b_{biome}_{r}_{c}", hsv_map(a, fn) if fn else a)

# ------------------------------------------------------------ dungeon themes
THEMES = {
    "crypt": lambda h, s, v: (h * 0 + .6, s * .35, v * .9),
    "lava": lambda h, s, v: (h * 0 + .02, np.maximum(s, .5), v),
    "ice": lambda h, s, v: (h * 0 + .53, s * .5 + .1, v * .6 + .35),
    "temple": lambda h, s, v: (h * 0 + .3, s * .6 + .2, v * .9),
    "void": lambda h, s, v: (h * 0 + .78, s * .5 + .25, v * .8),
}
for th, fn in THEMES.items():
    for r in range(4):
        for c in range(7):
            save(f"d_{th}_{r}_{c}", hsv_map(load(f"dungeon_{r}_{c}"), fn))

# ------------------------------------------------------------ enemy variants
TINTS = {"ember": (230, 70, 30), "frost": (90, 170, 255), "venom": (120, 220, 60), "shadow": (130, 60, 190), "gilded": (240, 200, 60), "ash": (150, 150, 150)}
enemies = [f[6:-4] for f in os.listdir(A) if f.startswith("enemy_")]
for t, col in TINTS.items():
    for e in enemies:
        save(f"e_{t}_{e}", tint(load("enemy_" + e), col, 0.5))

# ------------------------------------------------------------ class looks (12)
CLASS_LOOK = {
    "warden": ("hero", (200, 200, 210)), "berserker": ("hero", (200, 80, 60)), "vanguard": ("hero", (240, 210, 120)),
    "strider": ("villager", (90, 160, 70)), "shade": ("villager", (70, 70, 100)), "ascetic": ("villager", (230, 150, 60)),
    "arcanist": ("elder", (80, 120, 230)), "wildblood": ("elder", (230, 90, 160)), "pactbound": ("elder", (140, 60, 180)),
    "cantor": ("villager", (230, 120, 200)), "chaplain": ("elder", (250, 240, 200)), "verdant": ("elder", (110, 180, 90)),
}
for cls, (base, col) in CLASS_LOOK.items():
    for i in range(6):
        save(f"c_{cls}_{i}", tint(load(f"{base}_{i}"), col, 0.38))

# ------------------------------------------------------------ drawn icons (12x12)
PAL = {".": None, "k": (24, 28, 20), "d": (70, 70, 64), "m": (140, 140, 130), "l": (220, 220, 205), "w": (250, 250, 245),
       "b": (120, 80, 40), "B": (170, 120, 60), "r": (200, 50, 40), "g": (70, 170, 60), "u": (60, 110, 210), "y": (240, 200, 60), "p": (150, 70, 190), "c": (90, 200, 220)}
ICONS = {
    "bow": ["....kk......", "...kBk......", "..kB.k......", ".kB..kl.....", ".kB..k.l....", "kB...k..l...", "kB...k..l...", ".kB..k.l....", ".kB..kl.....", "..kB.k......", "...kBk......", "....kk......"],
    "staff": ["........kyk.", ".......kyyk.", "........kk..", ".......kb...", "......kb....", ".....kb.....", "....kb......", "...kb.......", "..kb........", ".kb.........", "kb..........", "k..........."],
    "mace": ["......kkk...", ".....kmlmk..", ".....kmmmk..", "......kkk...", ".....kb.....", "....kb......", "...kb.......", "..kb........", ".kb.........", "kb..........", "k...........", "............"],
    "axe": ["......kkk...", ".....kllmk..", "....kblmmk..", "...kb.kmk...", "..kb..kk....", ".kb.........", "kb..........", "k...........", "............", "............", "............", "............"],
    "spear": [".........kk.", "........klk.", ".......kmk..", "......kb....", ".....kb.....", "....kb......", "...kb.......", "..kb........", ".kb.........", "kb..........", "k...........", "............"],
    "hammer": ["...kkkkk....", "..kmmlmmk...", "..kmmmmmk...", "...kkkkk....", ".....kb.....", ".....kb.....", ".....kb.....", ".....kb.....", ".....kb.....", ".....kB.....", ".....kk.....", "............"],
    "fish": ["............", "............", "....kkkk....", "..kkcccckk.k", ".kcwkcccckkk", "kccccccckck.", ".kcccccckkkk", "..kkcccckk.k", "....kkkk....", "............", "............", "............"],
    "fishcooked": ["............", "............", "....kkkk....", "..kkBBBBkk.k", ".kBwkbBBBkkk", "kBBBbBbBkBk.", ".kBBBBBBkkkk", "..kkBBBBkk.k", "....kkkk....", "............", "............", "............"],
    "eel": ["............", "..kk........", ".kyyk.......", "kykyyk..kk..", ".kkyyk.kyyk.", "...kyykyykk.", "....kyyyk...", ".....kkk....", "............", "............", "............", "............"],
    "bone": ["............", ".kk......kk.", "klk......klk", ".kllkkkkllk.", "..kllllllk..", ".kllkkkkllk.", "klk......klk", ".kk......kk.", "............", "............", "............", "............"],
    "token": ["............", "...kkkkkk...", "..kyyyyyyk..", ".kyykkkkyyk.", ".kykyyyykyk.", ".kykyrrykyk.", ".kykyrrykyk.", ".kykyyyykyk.", ".kyykkkkyyk.", "..kyyyyyyk..", "...kkkkkk...", "............"],
    "fang": ["............", "...kkkkk....", "..klllllk...", "..kllllk....", "...klllk....", "...kllk.....", "....klk.....", "....kk......", "............", "............", "............", "............"],
    "sandroot": ["....kk......", "...kgk.kk...", "...kgkkgk...", "....kgkgk...", ".....kgk....", "....kBBk....", "...kBbBBk...", "..kBbbbBk...", "...kBbBk....", "....kBk.....", ".....k......", "............"],
    "gem": ["............", "...kkkkkk...", "..kccwccck..", ".kcwcccccck.", "kkkkkkkkkkkk", ".kcccuucck..", "..kcuuuck...", "...kcuck....", "....kck.....", ".....k......", "............", "............"],
    "ore": ["............", "....kkkk....", "..kkmmdmkk..", ".kmdmyymmdk.", ".kmmyymdmmk.", "kdmmmmmmydmk", "kmmdmyymmmdk", ".kmmmdmmmmk.", "..kkkkkkkk..", "............", "............", "............"],
    "ration": ["............", "..kkkkkkkk..", ".kBBBBBBBBk.", ".kBbbBBbbBk.", ".kBBBBBBBBk.", ".kkkkkkkkkk.", ".kllllllllk.", ".klrrllrrlk.", ".kllllllllk.", "..kkkkkkkk..", "............", "............"],
    "tent": ["............", ".....kk.....", "....kBBk....", "...kBbbBk...", "..kBbBBbBk..", ".kBbBkkBbBk.", "kBbBBkkBBbBk", "kkkkkkkkkkkk", "............", "............", "............", "............"],
    "rune": ["............", "..kkkkkkkk..", ".kmmmmmmmmk.", ".kmmpmmmmmk.", ".kmmpppmmmk.", ".kmmmpmpmmk.", ".kmmmpmmpmk.", ".kmmmmmmmmk.", "..kkkkkkkk..", "............", "............", "............"],
    "skull": ["............", "...kkkkkk...", "..kllllllk..", ".kllllllllk.", ".klkklkklk..", ".klkklkklk..", ".kllllllllk.", "..kllkkllk..", "...klklk....", "...kkkkk....", "............", "............"],
    "crown": ["............", "............", "k...k...k...", "ky.kyk.kyk..", "kyykyyykyyk.", "kyyyyyyyyyk.", "kyryyuyyryk.", "kyyyyyyyyyk.", "kkkkkkkkkkk.", "............", "............", "............"],
    "orb": ["............", "....kkkk....", "...kcwcck...", "..kcwccuuk..", "..kccccuuk..", "..kcccuuuk..", "...kcuuuk...", "....kkkk....", "....kBBk....", "...kBbbBk...", "...kkkkkk...", "............"],
    "lute": ["..........kk", ".........kbk", "........kbk.", ".......kbk..", "..kkk.kbk...", ".kBBBkbk....", "kBBkBBk.....", "kBkkkBk.....", "kBBkBBk.....", ".kBBBk......", "..kkk.......", "............"],
    "symbol": ["............", ".....kk.....", ".....ky.....", "..kkkkykkk..", "..kyyyyyyk..", "..kkkkykkk..", ".....ky.....", ".....ky.....", ".....ky.....", ".....kk.....", "............", "............"],
    "totem": ["....kkkk....", "...kgggk....", "...kgkgk....", "...kggggk...", "....kbbk....", "....kbbk....", "...kBBBBk...", "...kBkkBk...", "...kBBBBk...", "....kbbk....", "....kbbk....", "....kkkk...."],
    "map": ["............", ".kkkkkkkkkk.", ".kllllllllk.", ".kllgglullk.", ".klggluullk.", ".klllluulk..", ".klrllllllk.", ".kllllllllk.", ".kkkkkkkkkk.", "............", "............", "............"],
    "waypoint": ["....kkkk....", "...kuuuuk...", "..kuccccuk..", "..kucwwcuk..", "..kuccccuk..", "...kuuuuk...", "....kmmk....", "....kmmk....", "...kmmmmk...", "..kmmmmmmk..", "..kkkkkkkk..", "............"],
    "tower": ["....k..k....", "...kkkkkk...", "...kmmmmk...", "...kmkkmk...", "...kmmmmk...", "..kkmmmmkk..", "..kmmkkmmk..", "..kmmmmmmk..", ".kkmmmmmmkk.", ".kmmmkkmmmk.", ".kmmmkkmmmk.", "kkkkkkkkkkkk"],
}
for name, rows in ICONS.items():
    img = np.zeros((12, 12, 4))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[:12]):
            col = PAL.get(ch)
            if col: img[y, x] = (*col, 255)
    save("px_" + name, img)

print(f"generated {count} assets")
