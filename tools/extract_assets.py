#!/usr/bin/env python3
"""
Slice the Lost Kingdom of Shadowbane Chronicles asset sheet (src_sheet/sheet.png) into individual PNG assets.

Usage:  python3 tools/extract_assets.py
Output: assets/*.png  +  assets/manifest.json

Every sprite comes straight from the sheet: the panel background is removed
(flood-filled from the crop edges, so dark outlines inside a sprite survive)
and the result is saved at its original resolution. The game scales/tints
these at runtime, so you can redraw any PNG in assets/ and it will just work.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, "src_sheet", "sheet.png")
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

im = np.array(Image.open(SHEET).convert("RGB")).astype(int)
manifest = {}


def cut(name, box, thr=34, pad=0, keep_bg=False):
    """Crop box=(x0,y0,x1,y1); make edge-connected background transparent."""
    x0, y0, x1, y1 = box
    a = im[y0 - pad:y1 + pad, x0 - pad:x1 + pad]
    rgba = np.dstack([a, np.full(a.shape[:2], 255)]).astype(np.uint8)
    if not keep_bg:
        edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
        bg = np.median(edge, axis=0)
        near = np.abs(a - bg).sum(2) < thr
        lab, _ = ndimage.label(near)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        mask = np.isin(lab, list(border))
        rgba[mask, 3] = 0
        # trim to content
        ys, xs = np.where(rgba[:, :, 3] > 0)
        if len(xs):
            rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, name + ".png"))
    manifest[name] = {"src": [int(v) for v in box], "w": int(rgba.shape[1]), "h": int(rgba.shape[0])}


# ---- 17. Characters (player) : 3 rows x 6 poses --------------------------
char_cols = [(782, 813), (820, 846), (855, 883), (891, 920), (927, 952), (957, 985)]
char_rows = {"villager": (736, 786), "elder": (786, 834), "hero": (833, 885)}
for who, (ya, yb) in char_rows.items():
    for i, (xa, xb) in enumerate(char_cols):
        cut(f"{who}_{i}", (xa - 1, ya, xb + 1, yb))

# ---- 18. Enemies ----------------------------------------------------------
enemies = {
    "goblin":      (996, 737, 1040, 786),
    "imp":         (1040, 737, 1082, 786),
    "slime":       (1086, 738, 1129, 773),
    "bat":         (1136, 739, 1184, 772),
    "bigbat":      (1184, 739, 1238, 773),
    "orc":         (994, 789, 1041, 839),
    "ghoul":       (1040, 789, 1088, 839),
    "gargoyle":    (1083, 776, 1133, 816),
    "zombie":      (1135, 773, 1183, 816),
    "spearorc":    (1183, 774, 1236, 817),
    "skeleton":    (1085, 816, 1129, 871),
    "wraith":      (1138, 813, 1180, 866),
    "goblinking":  (1183, 819, 1234, 865),
    "goldslime":   (1000, 854, 1038, 884),
    "lizard":      (1040, 840, 1104, 884),
}
for k, b in enemies.items():
    cut("enemy_" + k, b)

# ---- 19. Items ------------------------------------------------------------
items = [
    ("iron_sword", (1252, 740, 1286, 775)), ("dagger", (1290, 740, 1320, 773)),
    ("steel_sword", (1327, 741, 1358, 773)), ("leather_armor", (1363, 740, 1400, 772)),
    ("goblin_mask", (1404, 740, 1435, 772)), ("iron_helm", (1439, 739, 1466, 772)),
    ("cap", (1473, 743, 1500, 769)),
    ("health_potion", (1255, 782, 1281, 819)), ("antidote", (1285, 782, 1312, 819)),
    ("ether", (1313, 782, 1340, 819)), ("mana_potion", (1343, 782, 1370, 819)),
    ("elixir", (1374, 781, 1401, 818)), ("tonic", (1408, 781, 1435, 818)),
    ("bread", (1437, 785, 1468, 817)), ("spellbook", (1469, 783, 1502, 817)),
    ("scroll", (1251, 831, 1284, 865)), ("key", (1287, 832, 1318, 866)),
    ("herb", (1322, 829, 1349, 865)), ("boots", (1355, 829, 1394, 864)),
    ("coin", (1402, 829, 1432, 862)), ("chest", (1435, 829, 1469, 861)),
    ("chest_open", (1472, 831, 1502, 864)),
]
for k, b in items:
    cut("item_" + k, (b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1))

# ---- 14. World tileset : 8 x 4 grid of 36px tiles -------------------------
wx = [24, 60, 96, 132, 168, 204, 240, 276, 312]
wy = [736, 773, 809, 846, 883]
for r in range(4):
    for c in range(8):
        cut(f"world_{r}_{c}", (wx[c] + 2, wy[r] + 2, wx[c + 1] - 1, wy[r + 1] - 1), keep_bg=True)

# ---- 15. Dungeon tileset : 7 x 4 grid -------------------------------------
dx = np.linspace(323, 558, 8).round().astype(int)
dy = np.linspace(736, 883, 5).round().astype(int)
for r in range(4):
    for c in range(7):
        cut(f"dungeon_{r}_{c}", (dx[c] + 2, dy[r] + 2, dx[c + 1] - 1, dy[r + 1] - 1), keep_bg=True)

# ---- 16. UI icons : 6 x 4 grid --------------------------------------------
ux = np.linspace(570, 770, 7).round().astype(int)
uy = np.linspace(737, 885, 5).round().astype(int)
for r in range(4):
    for c in range(6):
        cut(f"icon_{r}_{c}", (ux[c] + 1, uy[r] + 1, ux[c + 1] - 1, uy[r + 1] - 1))

# ---- 23. Effects ------------------------------------------------------------
cut("fx_sparkle", (915, 918, 975, 992))
cut("fx_slash", (975, 918, 1030, 992))
cut("fx_burst", (1030, 918, 1092, 992))
cut("fx_hit", (1092, 918, 1140, 992))

# ---- Whole screens / panels used as-is ------------------------------------
cut("screen_worldmap", (55, 336, 316, 482), keep_bg=True)     # 5. Map screen art
cut("device_mockup", (12, 32, 498, 272))                       # 1. Device art
cut("bg_patterns", (1220, 916, 1502, 994), keep_bg=True)       # 24. Patterns

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print(f"wrote {len(manifest)} assets to {OUT}")
