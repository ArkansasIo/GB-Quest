#!/usr/bin/env python3
"""
Generate crisp 16x16 Game Boy-style pixel art for everything on the map.

  gt_<biome>_<key>.png        terrain + buildings for 9 biomes
  gt_<biome>_road<m>.png      16 auto-tiled road joins (m = N1 E2 S4 W8 bitmask)
  gt_<biome>_water<m>_<f>.png 16 shoreline variants x 2 animation frames
  gd_<theme>_<key>.png        dungeon tiles for 6 themes (wall top/face, floors, torches...)
  go_<key>.png                map objects (herb, waypoint, chest, grave, trap, sign)
  gh_<look>_<dir><f>.png      walking sprites: 12 classes + 8 villagers, 3 directions x 2 frames

Every tile uses 4-colour ramps per material (GBC style), so it also quantises
cleanly to the 4-shade DMG palette.
"""
import os, random
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")
HD_ROOT = os.path.join(ROOT, "assets_hd", "gbtiles")
N = 16
count = 0
hi_count = 0
HI_SCALES = (4, 6)  # 64px and 96px exports from the 16px logical pixel grid
HI_MANIFEST = {}

def save(name, img):
    global count, hi_count
    source = Image.fromarray(img.astype(np.uint8))
    source.save(os.path.join(A, name + ".png"), optimize=True)
    count += 1
    variants = {}
    for scale in HI_SCALES:
        target_dir = os.path.join(HD_ROOT, f"{scale}x")
        os.makedirs(target_dir, exist_ok=True)
        target = source.resize((N * scale, N * scale), Image.Resampling.NEAREST)
        relative = f"assets_hd/gbtiles/{scale}x/{name}.png"
        target.save(os.path.join(target_dir, name + ".png"), optimize=True)
        variants[str(scale)] = {"file": relative, "width": N * scale, "height": N * scale}
        hi_count += 1
    HI_MANIFEST[name] = {
        "source": f"assets/{name}.png",
        "logical_size": [N, N],
        "format": "RGBA",
        "scaling": "nearest-neighbor",
        "variants": variants
    }

def blank(): return np.zeros((N, N, 4), np.uint8)
def px(img, x, y, rgb):
    if 0 <= x < N and 0 <= y < N: img[y, x] = (*rgb, 255)
def fillr(img, x, y, w, h, rgb):
    for j in range(y, y + h):
        for i in range(x, x + w): px(img, i, j, rgb)

# ---------------------------------------------------------------- material ramps (light -> dark)
# Dragon Warrior / NES-style saturated 4-colour ramps; quantise cleanly to DMG.
R = {
    'grass': [(128, 224, 80), (64, 168, 48), (32, 112, 32), (16, 56, 20)],
    'leaf': [(112, 216, 72), (56, 160, 40), (24, 104, 24), (12, 48, 16)],
    'water': [(120, 200, 248), (56, 136, 224), (24, 80, 192), (12, 32, 96)],
    'stone': [(200, 200, 192), (148, 140, 132), (96, 88, 84), (40, 36, 36)],
    'sand': [(248, 224, 136), (224, 176, 80), (176, 120, 48), (96, 64, 32)],
    'dirt': [(224, 176, 112), (176, 128, 72), (128, 88, 56), (64, 44, 28)],
    'wood': [(208, 144, 72), (160, 96, 48), (112, 64, 32), (56, 32, 16)],
    'roof': [(248, 88, 56), (200, 56, 40), (140, 32, 32), (72, 16, 20)],
    'snow': [(248, 248, 248), (200, 216, 232), (148, 172, 208), (88, 104, 152)],
}
BIOME = {
    'meadow': {},
    'coast': {'grass': [(196, 232, 136), (144, 196, 88), (84, 140, 56), (36, 70, 36)]},
    'marsh': {'grass': [(150, 172, 104), (110, 132, 74), (70, 92, 52), (36, 48, 28)], 'water': [(150, 184, 156), (100, 142, 112), (62, 98, 80), (28, 48, 40)], 'leaf': [(130, 160, 92), (90, 122, 64), (56, 82, 44), (24, 40, 22)]},
    'jungle': {'grass': [(150, 222, 92), (82, 182, 60), (32, 122, 50), (10, 56, 28)], 'leaf': [(120, 210, 80), (50, 160, 56), (20, 100, 44), (8, 44, 24)], 'water': [(150, 230, 220), (70, 180, 190), (30, 120, 150), (12, 56, 80)]},
    'snow': {'grass': R['snow'], 'leaf': [(236, 246, 250), (140, 186, 176), (56, 108, 98), (20, 48, 48)], 'water': [(224, 242, 255), (170, 212, 242), (110, 162, 222), (50, 80, 140)], 'stone': [(232, 236, 244), (176, 184, 200), (112, 120, 140), (52, 56, 72)]},
    'badlands': {'grass': [(234, 178, 122), (202, 138, 90), (150, 92, 60), (80, 44, 30)], 'sand': [(240, 196, 140), (216, 156, 100), (164, 104, 64), (88, 50, 30)], 'leaf': [(172, 204, 112), (122, 162, 72), (72, 112, 50), (30, 52, 24)], 'stone': [(214, 160, 120), (170, 110, 80), (116, 70, 52), (56, 32, 26)]},
    'volcanic': {'grass': [(124, 108, 104), (88, 72, 70), (58, 46, 46), (26, 20, 22)], 'water': [(255, 240, 120), (255, 160, 48), (210, 72, 24), (100, 24, 16)], 'leaf': [(150, 110, 90), (110, 76, 60), (70, 46, 40), (30, 20, 18)], 'stone': [(120, 100, 96), (84, 68, 66), (56, 42, 42), (24, 18, 20)], 'dirt': [(150, 120, 100), (116, 88, 72), (80, 58, 48), (40, 28, 24)]},
    'dusk': {'grass': [(172, 152, 204), (122, 102, 164), (80, 64, 122), (36, 28, 62)], 'water': [(150, 130, 210), (100, 82, 176), (62, 48, 132), (28, 20, 72)], 'leaf': [(132, 112, 172), (92, 72, 132), (56, 40, 92), (24, 16, 46)], 'stone': [(170, 160, 186), (122, 112, 142), (80, 70, 100), (36, 30, 50)]},
    'crystal': {'grass': [(184, 242, 232), (112, 202, 200), (60, 152, 162), (24, 72, 92)], 'water': [(196, 240, 255), (110, 200, 246), (50, 140, 220), (20, 64, 140)], 'leaf': [(176, 242, 255), (92, 202, 232), (40, 142, 182), (16, 62, 92)], 'stone': [(236, 230, 252), (190, 176, 232), (130, 112, 190), (60, 48, 110)]},
    # Additional biome families from the uploaded 8-bit MMORPG tile reference.
    'forest': {'grass': [(142, 204, 88), (88, 156, 56), (42, 104, 40), (18, 48, 24)]},
    'deepforest': {'grass': [(62, 148, 92), (32, 104, 72), (18, 68, 58), (8, 34, 36)], 'leaf': [(72, 176, 124), (32, 124, 92), (14, 76, 62), (4, 34, 32)]},
    'hills': {'grass': [(184, 216, 112), (128, 172, 72), (72, 124, 48), (32, 60, 28)]},
    'mountains': {'grass': [(156, 164, 176), (112, 120, 136), (72, 80, 96), (32, 36, 48)], 'stone': [(220, 224, 236), (160, 168, 188), (100, 108, 132), (44, 48, 68)]},
    'desert': {'grass': [(244, 212, 148), (216, 176, 104), (164, 120, 64), (88, 56, 28)], 'sand': [(252, 228, 164), (232, 196, 120), (188, 144, 76), (112, 76, 36)]},
    'oasis': {'grass': [(172, 208, 112), (112, 164, 72), (56, 112, 52), (24, 56, 32)], 'water': [(136, 220, 232), (64, 164, 192), (28, 104, 144), (12, 48, 80)]},
    'savanna': {'grass': [(236, 204, 104), (204, 164, 72), (148, 116, 48), (76, 56, 28)], 'leaf': [(164, 172, 72), (112, 128, 48), (68, 84, 32), (28, 40, 20)]},
    'steppe': {'grass': [(196, 196, 112), (148, 156, 72), (96, 108, 48), (48, 56, 28)]},
    'ruins': {'grass': [(132, 152, 92), (92, 116, 68), (56, 76, 48), (28, 40, 28)], 'stone': [(188, 184, 164), (132, 128, 116), (80, 76, 72), (36, 34, 34)]},
    'corruption': {'grass': [(124, 84, 164), (88, 52, 132), (56, 32, 92), (24, 14, 48)], 'leaf': [(148, 92, 188), (100, 56, 144), (60, 28, 100), (24, 10, 48)], 'water': [(116, 64, 176), (76, 36, 132), (44, 18, 88), (18, 8, 44)]},
    'aether': {'grass': [(88, 176, 236), (48, 128, 208), (28, 76, 164), (12, 32, 88)], 'leaf': [(132, 220, 252), (72, 168, 236), (32, 108, 196), (12, 48, 112)], 'water': [(168, 236, 255), (96, 188, 248), (48, 124, 220), (18, 56, 144)]},
    'mushroom': {'grass': [(156, 176, 104), (108, 132, 72), (64, 88, 48), (28, 44, 28)], 'leaf': [(196, 120, 204), (144, 72, 164), (88, 40, 112), (36, 16, 56)]},
    'ocean': {'grass': [(52, 132, 168), (28, 92, 136), (16, 56, 96), (8, 28, 56)], 'water': [(112, 208, 248), (48, 148, 224), (24, 88, 176), (8, 36, 104)]},
    'river': {'grass': [(104, 172, 96), (64, 128, 72), (32, 84, 52), (12, 40, 28)], 'water': [(152, 224, 248), (80, 168, 220), (40, 112, 184), (16, 52, 112)]},
    'frozen': {'grass': R['snow'], 'water': [(220, 248, 255), (156, 216, 248), (88, 160, 220), (36, 84, 144)], 'stone': [(232, 240, 252), (176, 196, 220), (112, 140, 176), (48, 64, 104)]},
    'sky': {'grass': [(168, 212, 244), (112, 176, 224), (64, 132, 196), (28, 72, 128)], 'water': [(220, 244, 255), (152, 208, 244), (88, 152, 216), (32, 80, 144)], 'leaf': [(176, 224, 152), (112, 184, 104), (56, 132, 72), (24, 68, 40)]},
}
def ramp(b, mat): return BIOME[b].get(mat, R[mat])

# ---------------------------------------------------------------- terrain painters
def grass(b, seed, flowers=0):
    g = ramp(b, 'grass'); r = random.Random(seed); img = blank(); fillr(img, 0, 0, N, N, g[1])
    for _ in range(9):
        x, y = r.randrange(16), r.randrange(16); px(img, x, y, g[2]); px(img, x + 1, y - 1, g[2]); px(img, x + 2, y, g[2])
    for _ in range(5): px(img, r.randrange(16), r.randrange(16), g[0])
    for _ in range(flowers):
        x, y = r.randrange(1, 15), r.randrange(1, 15); c = r.choice([(255, 255, 255), (248, 216, 72), (248, 120, 160)])
        px(img, x, y, c); px(img, x, y + 1, g[3])
    return img
def ground(b, seed):
    d = ramp(b, 'dirt'); r = random.Random(seed); img = blank(); fillr(img, 0, 0, N, N, d[1])
    for _ in range(14): px(img, r.randrange(16), r.randrange(16), r.choice([d[2], d[0]]))
    return img
def cobble(b, seed):
    st = ramp(b, 'stone'); r = random.Random(seed); img = blank(); fillr(img, 0, 0, N, N, st[2])
    for y in range(0, N, 4):
        off = (y // 4 % 2) * 2
        for x in range(off - 4, N, 4):
            fillr(img, x + 1, y + 1, 3, 2, st[1] if r.random() < 0.8 else st[0]); px(img, x + 1, y + 1, st[0])
    return img
def sand(b, seed, dense=False):
    s = ramp(b, 'sand'); r = random.Random(seed); img = blank(); fillr(img, 0, 0, N, N, s[0 if dense else 1])
    for _ in range(18): px(img, r.randrange(16), r.randrange(16), s[2])
    for _ in range(6): x, y = r.randrange(15), r.randrange(16); px(img, x, y, s[1 if dense else 0]); px(img, x + 1, y, s[1 if dense else 0])
    return img
def tree_round(img, cx, cy, b, rad=6):
    L, w = ramp(b, 'leaf'), ramp(b, 'wood')
    fillr(img, cx - 1, cy + rad - 2, 3, 4, w[2]); px(img, cx + 1, cy + rad - 2, w[3])
    for y in range(-rad, rad):
        for x in range(-rad, rad + 1):
            d = (x * x + y * y * 1.2) ** 0.5
            if d <= rad:
                c = L[3] if d > rad - 1 else L[2] if (x + y > 2) else L[1] if (x + y > -4) else L[0]
                px(img, cx + x, cy + y, c)
    for (x, y) in [(-2, -3), (-3, -1), (0, -4)]: px(img, cx + x, cy + y, L[0])
def tree_pine(img, cx, top, b, h=13):
    L, w = ramp(b, 'leaf'), ramp(b, 'wood')
    fillr(img, cx - 1, top + h - 2, 2, 3, w[2])
    for i in range(h - 2):
        half = 1 + (i % 4) + i // 4
        for x in range(-half, half + 1):
            c = L[3] if abs(x) == half else (L[2] if x > 0 else L[1] if x > -half + 1 else L[0])
            px(img, cx + x, top + i, c)
def forest(b, kind, seed):
    img = grass(b, seed)
    if kind == 'round': tree_round(img, 8, 7, b, 6)
    elif kind == 'pine': tree_pine(img, 8, 1, b, 14)
    elif kind == 'dense': tree_round(img, 5, 5, b, 5); tree_round(img, 11, 9, b, 5)
    elif kind == 'single': tree_pine(img, 8, 2, b, 12)
    return img
def mountain(b, seed, snow=False):
    s, img = ramp(b, 'stone'), grass(b, seed)
    sn = R['snow']
    for y in range(N):
        half = int((y + 1) * 0.55) + 1
        for x in range(8 - half, 8 + half):
            if 0 <= x < N:
                c = s[3] if x in (8 - half, 8 + half - 1) else (s[2] if x >= 8 + (y % 3 == 0) else s[1])
                if snow and y < 6: c = sn[0] if x < 8 else sn[2]
                px(img, x, y + 1, c)
    for (x, y) in [(6, 9), (9, 11), (5, 13), (11, 14)]: px(img, x, y, s[3]); px(img, x + 1, y, s[3])
    return img
def water(b, mask, frame):
    wv = ramp(b, 'water'); img = blank(); fillr(img, 0, 0, N, N, wv[1])
    for y in (3, 9, 14):
        for x in range(N):
            if (x + frame * 2 + y) % 8 in (0, 1, 2): px(img, x, y, wv[0] if (x + y) % 8 == 1 else wv[2])
    land = ramp(b, 'grass') if b != 'badlands' else ramp(b, 'sand')
    foam = (248, 252, 255) if b != 'volcanic' else (60, 40, 30)
    # mask: bit set = neighbour is LAND on that side (N1 E2 S4 W8): draw shore + foam
    if mask & 1: fillr(img, 0, 0, N, 2, land[2]); [px(img, x, 2, foam) for x in range(N) if (x + frame) % 3]
    if mask & 4: fillr(img, 0, 14, N, 2, land[2]); [px(img, x, 13, foam) for x in range(N) if (x + frame) % 3]
    if mask & 8: fillr(img, 0, 0, 2, N, land[2]); [px(img, 2, y, foam) for y in range(N) if (y + frame) % 3]
    if mask & 2: fillr(img, 14, 0, 2, N, land[2]); [px(img, 13, y, foam) for y in range(N) if (y + frame) % 3]
    return img
def deep(b, frame):
    wv = ramp(b, 'water'); img = blank(); fillr(img, 0, 0, N, N, wv[2])
    for y in (4, 11):
        for x in range(N):
            if (x + frame * 3 + y) % 7 < 2: px(img, x, y, wv[1])
    return img
def road(b, mask, seed):
    d = ramp(b, 'dirt'); img = grass(b, seed); r = random.Random(seed + mask)
    fillr(img, 4, 4, 8, 8, d[1])
    if mask & 1: fillr(img, 4, 0, 8, 4, d[1])
    if mask & 4: fillr(img, 4, 12, 8, 4, d[1])
    if mask & 8: fillr(img, 0, 4, 4, 8, d[1])
    if mask & 2: fillr(img, 12, 4, 4, 8, d[1])
    if mask == 0: fillr(img, 2, 2, 12, 12, d[1])
    for _ in range(10):
        x, y = r.randrange(16), r.randrange(16)
        if tuple(img[y, x, :3]) == d[1]: px(img, x, y, r.choice([d[0], d[2]]))
    # edge darkening where road meets grass
    g = ramp(b, 'grass')
    for y in range(N):
        for x in range(N):
            if tuple(img[y, x, :3]) in (d[0], d[1], d[2]):
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < N and 0 <= ny < N and tuple(img[ny, nx, :3]) not in (d[0], d[1], d[2], d[3]): px(img, nx, ny, g[2])
    return img
def bridge(b, frame):
    img = water(b, 0, frame); w = ramp(b, 'wood')
    fillr(img, 0, 3, N, 10, w[1])
    for x in range(0, N, 4): fillr(img, x, 3, 1, 10, w[3])
    fillr(img, 0, 3, N, 1, w[0]); fillr(img, 0, 12, N, 1, w[3])
    return img

# ---------------------------------------------------------------- buildings
def wall_top(b):
    s = ramp(b, 'stone'); img = blank(); fillr(img, 0, 4, N, 12, s[1])
    for x in range(0, N, 4): fillr(img, x, 0, 3, 4, s[1]); fillr(img, x, 0, 3, 1, s[0])
    for y in range(6, N, 4):
        for x in range((y // 4) % 2 * 4, N, 8): fillr(img, x, y, 1, 3, s[2])
        fillr(img, 0, y + 3, N, 1, s[2])
    fillr(img, 0, 4, N, 1, s[0])
    return img
def gate(b):
    img = wall_top(b); w = ramp(b, 'wood'); s = ramp(b, 'stone')
    fillr(img, 4, 6, 8, 10, (24, 20, 20)); fillr(img, 5, 5, 6, 1, s[3])
    for x in (5, 8, 10): fillr(img, x, 7, 1, 9, w[2])
    return img
def keep_top(b):
    img = wall_top(b); r = ramp(b, 'roof')
    for y in range(8):
        for x in range(8 - y, 8 + y): px(img, x, y, r[1] if x < 8 else r[2])
    return img
def house(b, kind):
    img = grass(b, 7); w, r, s = ramp(b, 'wood'), ramp(b, 'roof'), ramp(b, 'stone')
    if kind == 'inn': r = [(144, 200, 248), (64, 128, 216), (40, 72, 160), (20, 32, 80)]
    if kind == 'temple': r = [(248, 232, 160), (224, 184, 72), (160, 120, 40), (80, 56, 20)]
    fillr(img, 2, 7, 12, 8, w[0]); fillr(img, 2, 14, 12, 1, w[2])
    for y in range(8):
        for x in range(8 - y - 1, 8 + y + 1): px(img, x, y, r[3] if y == 7 or x in (8 - y - 1, 8 + y) else (r[1] if x < 8 else r[2]))
    fillr(img, 7, 10, 3, 5, w[3]); px(img, 9, 12, (248, 216, 72))
    fillr(img, 3, 9, 3, 3, (40, 60, 90)); px(img, 3, 9, (200, 230, 255))
    if kind == 'inn': fillr(img, 11, 9, 3, 2, w[2]); px(img, 12, 9, (248, 216, 72))
    if kind == 'shop': fillr(img, 10, 9, 4, 3, (40, 60, 90))
    return img
def shrine(b):
    img = grass(b, 9); s = ramp(b, 'stone')
    fillr(img, 4, 12, 8, 3, s[2]); fillr(img, 5, 4, 6, 8, s[1]); fillr(img, 5, 4, 1, 8, s[0]); fillr(img, 10, 4, 1, 8, s[2])
    fillr(img, 4, 3, 8, 1, s[3]); fillr(img, 7, 6, 2, 3, (120, 200, 255))
    return img
def statue(b):
    img = grass(b, 11); s = ramp(b, 'stone')
    fillr(img, 4, 13, 8, 2, s[3]); fillr(img, 5, 11, 6, 2, s[2])
    fillr(img, 6, 3, 4, 3, s[1]); fillr(img, 5, 6, 6, 5, s[1]); fillr(img, 5, 6, 1, 5, s[0]); fillr(img, 10, 6, 1, 5, s[2])
    return img
def arena(b):
    img = wall_top(b); r = (200, 40, 40)
    fillr(img, 6, 0, 1, 8, (60, 40, 30)); fillr(img, 7, 0, 5, 3, r)
    return img

# ---------------------------------------------------------------- dungeon themes
THEMES = {
    'dungeon': [(176, 168, 152), (124, 116, 104), (76, 70, 64), (32, 28, 28)],
    'crypt': [(176, 184, 208), (120, 128, 156), (72, 78, 104), (28, 30, 46)],
    'lava': [(208, 140, 110), (150, 84, 64), (96, 46, 36), (40, 16, 14)],
    'ice': [(220, 244, 255), (150, 200, 230), (90, 140, 190), (36, 60, 100)],
    'temple': [(196, 216, 150), (136, 164, 96), (84, 110, 60), (34, 48, 26)],
    'void': [(196, 160, 232), (136, 100, 188), (82, 56, 132), (32, 18, 60)],
}
def d_wall_top(t):
    s = THEMES[t]; img = blank(); fillr(img, 0, 0, N, N, s[3])
    for _ in range(6): r = random.Random(_); px(img, r.randrange(16), r.randrange(16), s[2])
    return img
def d_wall_face(t, seed=0):
    s = THEMES[t]; img = blank(); fillr(img, 0, 0, N, N, s[2])
    for row, y in enumerate(range(0, N, 4)):
        fillr(img, 0, y + 3, N, 1, s[3]); off = (row % 2) * 4
        for x in range(off, N, 8): fillr(img, x, y, 1, 3, s[3])
        fillr(img, 0, y, N, 1, s[1])
    fillr(img, 0, 0, N, 2, s[3]); fillr(img, 0, 15, N, 1, s[3])
    return img
def d_floor(t, seed, cracked=False):
    s = THEMES[t]; r = random.Random(seed); img = blank(); fillr(img, 0, 0, N, N, s[0])
    for y in (0, 8):
        fillr(img, 0, y, N, 1, s[1])
        for x in (0, 8) if y == 0 else (4, 12): fillr(img, x, y, 1, 8, s[1])
    for _ in range(8): px(img, r.randrange(16), r.randrange(16), s[1])
    if cracked:
        x, y = 3, 3
        for _ in range(9): px(img, x, y, s[3]); x += r.choice([1, 1, 0]); y += r.choice([1, 0, 1])
    return img
def d_torch(t, frame):
    img = d_wall_face(t); w = R['wood']
    fillr(img, 7, 7, 2, 6, w[2]); fillr(img, 6, 6, 4, 1, w[3])
    flame = [(255, 240, 160), (255, 176, 48), (232, 88, 24)]
    fillr(img, 6, 2 + frame, 4, 4 - frame, flame[1]); fillr(img, 7, 3 + frame, 2, 2, flame[0]); px(img, 8 - frame, 1 + frame, flame[2])
    return img
def d_stairs(t, up):
    s = THEMES[t]; img = d_floor(t, 3)
    for i in range(5):
        y = 2 + i * 3; fillr(img, 2 + (0 if up else i), y, 12 - i * (0 if up else 1), 2, s[0] if up else s[1 + min(2, i // 2)]); fillr(img, 2, y + 2, 12, 1, s[3])
    return img
def d_altar(t):
    s = THEMES[t]; img = d_floor(t, 4)
    fillr(img, 2, 7, 12, 7, s[1]); fillr(img, 2, 7, 12, 1, s[0]); fillr(img, 2, 13, 12, 1, s[3])
    fillr(img, 5, 3, 2, 4, (240, 232, 200)); fillr(img, 9, 3, 2, 4, (240, 232, 200)); px(img, 5, 2, (255, 200, 60)); px(img, 10, 2, (255, 200, 60))
    return img
def d_door(t, gold=False):
    img = d_wall_face(t); w = R['wood'] if not gold else [(255, 240, 150), (232, 192, 64), (168, 128, 32), (80, 56, 16)]
    fillr(img, 3, 3, 10, 13, w[1]); fillr(img, 3, 3, 10, 1, w[0])
    for x in (5, 8, 11): fillr(img, x, 4, 1, 12, w[2])
    px(img, 10, 10, (40, 30, 20))
    return img
def d_barrel(t):
    img = d_floor(t, 6); w = R['wood']
    fillr(img, 4, 3, 8, 11, w[1]); fillr(img, 4, 3, 1, 11, w[0]); fillr(img, 11, 3, 1, 11, w[2])
    for y in (5, 11): fillr(img, 4, y, 8, 1, w[3])
    return img
def d_statue(t):
    img = d_floor(t, 8); s = THEMES[t]
    fillr(img, 4, 12, 8, 3, s[3]); fillr(img, 6, 2, 4, 3, s[0]); fillr(img, 5, 5, 6, 7, s[1]); fillr(img, 5, 5, 1, 7, s[0])
    return img
def d_sign(t):
    img = d_wall_face(t); w = R['wood']
    fillr(img, 3, 4, 10, 7, w[1]); fillr(img, 3, 4, 10, 1, w[0])
    for y in (6, 8): fillr(img, 5, y, 6, 1, w[3])
    return img

# ---------------------------------------------------------------- room props (designed instance rooms)
POOL = {'lava': [(255, 220, 120), (248, 136, 40), (200, 64, 24), (96, 24, 16)], 'void': [(232, 200, 255), (168, 104, 232), (96, 40, 168), (36, 12, 72)],
        'ice': [(230, 250, 255), (150, 210, 245), (80, 150, 220), (30, 70, 140)], 'crypt': [(180, 220, 200), (96, 160, 140), (48, 100, 90), (16, 44, 40)]}
def d_pillar(t):
    s = THEMES[t]; img = d_floor(t, 9)
    fillr(img, 3, 13, 10, 2, s[3]); fillr(img, 4, 1, 8, 12, s[1]); fillr(img, 4, 1, 2, 12, s[0]); fillr(img, 10, 1, 2, 12, s[2]); fillr(img, 3, 0, 10, 2, s[0]); fillr(img, 3, 12, 10, 1, s[2])
    return img
def d_spikes(t):
    s = THEMES[t]; img = d_floor(t, 10); m = [(232, 232, 240), (168, 168, 184), (96, 96, 112)]
    for (x, y) in [(3, 4), (9, 4), (6, 9), (12, 9), (3, 13), (9, 13)]:
        px(img, x, y - 2, m[0]); fillr(img, x - 1, y - 1, 3, 1, m[1]); fillr(img, x - 1, y, 3, 1, m[2])
    return img
def d_pool(t, f):
    c = POOL.get(t, [(200, 236, 255), (96, 176, 232), (48, 112, 192), (20, 50, 110)]); img = blank(); fillr(img, 0, 0, N, N, c[2])
    for y in range(0, N, 4):
        for x in range((y // 4 + f) % 2 * 4, N, 8): fillr(img, x, y + 1, 3, 1, c[1]); px(img, x + 1, y, c[0])
    fillr(img, 0, 0, N, 1, c[3])
    return img
def d_bones(t):
    img = d_floor(t, 11); b = [(248, 244, 228), (200, 192, 168), (120, 112, 96)]
    fillr(img, 3, 9, 9, 2, b[1]); fillr(img, 3, 9, 9, 1, b[0]); fillr(img, 2, 8, 2, 4, b[0]); fillr(img, 11, 8, 2, 4, b[0])
    fillr(img, 6, 3, 5, 4, b[0]); px(img, 7, 5, b[2]); px(img, 9, 5, b[2]); fillr(img, 7, 7, 3, 1, b[1])
    return img
def d_shelf(t):
    img = d_wall_face(t); w = R['wood']; books = [(200, 60, 60), (60, 120, 200), (80, 168, 80), (216, 176, 64), (150, 90, 190)]
    fillr(img, 1, 2, 14, 13, w[2]); fillr(img, 1, 2, 14, 1, w[0])
    for row, y in enumerate((3, 9)):
        fillr(img, 2, y + 5, 12, 1, w[3])
        for i, x in enumerate(range(2, 14, 2)): fillr(img, x, y + (i + row) % 2, 2, 5 - (i + row) % 2, books[(i + row * 2) % 5])
    return img
def d_bars(t):
    img = d_floor(t, 12); m = [(200, 200, 216), (120, 120, 140), (60, 60, 76)]
    fillr(img, 0, 2, N, 2, m[1]); fillr(img, 0, 13, N, 2, m[1])
    for x in range(1, N, 4): fillr(img, x, 2, 2, 13, m[1]); px(img, x, 2, m[0])
    return img
def d_brazier(t, f):
    img = d_floor(t, 13); s = THEMES[t]; fl = POOL.get(t, [(255, 240, 160), (255, 176, 48), (232, 88, 24), (120, 40, 10)]) if t in ('void', 'ice') else [(255, 240, 160), (255, 176, 48), (232, 88, 24)]
    fillr(img, 5, 12, 6, 2, s[3]); fillr(img, 7, 9, 2, 3, s[2]); fillr(img, 3, 7, 10, 3, s[1]); fillr(img, 3, 7, 10, 1, s[0])
    fillr(img, 5, 3 + f, 6, 4 - f, fl[1]); fillr(img, 6, 4 + f, 4, 2, fl[0]); px(img, 7 + f, 2 + f, fl[2]); px(img, 9 - f, 1 + f, fl[1])
    return img
def d_rug(t):
    img = d_floor(t, 14); c = {'lava': (150, 40, 40), 'ice': (40, 80, 150), 'void': (90, 40, 140), 'temple': (40, 110, 60), 'crypt': (70, 60, 110)}.get(t, (130, 40, 40)); g = (232, 192, 64)
    fillr(img, 1, 0, 14, N, c); fillr(img, 2, 0, 1, N, g); fillr(img, 13, 0, 1, N, g)
    for y in range(2, N, 6): px(img, 7, y, g); px(img, 8, y + 1, g)
    return img
def d_throne(t):
    img = d_rug(t); s = THEMES[t]; g = [(255, 236, 140), (232, 192, 64), (160, 120, 32)]
    fillr(img, 3, 1, 10, 14, g[1]); fillr(img, 3, 1, 10, 1, g[0]); fillr(img, 5, 3, 6, 7, (150, 30, 40)); fillr(img, 3, 10, 10, 2, g[2]); fillr(img, 3, 13, 10, 2, g[2])
    px(img, 3, 0, g[0]); px(img, 12, 0, g[0]); px(img, 7, 0, g[0]); px(img, 8, 0, g[0])
    return img
def d_seal(t):
    img = d_door(t); m = [(220, 220, 236), (140, 140, 160)]; c = POOL.get(t, [(200, 236, 255), (120, 200, 255)])
    for y in (5, 9, 13): fillr(img, 2, y, 12, 2, m[1]); fillr(img, 2, y, 12, 1, m[0])
    fillr(img, 6, 7, 4, 4, c[1]); px(img, 7, 8, c[0])
    return img

# ---------------------------------------------------------------- map objects
def obj_herb():
    img = blank(); L = R['leaf']
    for (x, y) in [(5, 8), (7, 6), (9, 7), (11, 9), (6, 11), (10, 11), (8, 9)]: fillr(img, x - 1, y - 1, 3, 3, L[1]); px(img, x, y, L[0])
    for (x, y) in [(7, 5), (11, 8), (5, 10)]: px(img, x, y, (248, 120, 160)); px(img, x, y - 1, (255, 200, 220))
    fillr(img, 6, 13, 5, 1, L[3])
    return img
def obj_waypoint(f):
    img = blank(); s = R['stone']; c = [(220, 250, 255), (120, 200, 255), (40, 120, 220), (20, 50, 120)]
    fillr(img, 4, 13, 8, 2, s[2]); fillr(img, 5, 12, 6, 1, s[1])
    for y in range(9):
        half = 3 - abs(y - 4) * 3 // 4
        for x in range(8 - half, 8 + half + 1): px(img, x, 2 + y - f, c[1] if x <= 8 else c[2])
    px(img, 7, 4 - f, c[0]); px(img, 7, 5 - f, c[0])
    return img
def obj_chest(open_=False):
    img = blank(); w = R['wood']; g = (248, 216, 72)
    fillr(img, 2, 7, 12, 8, w[1]); fillr(img, 2, 14, 12, 1, w[3]); fillr(img, 2, 7, 1, 8, w[0])
    if open_: fillr(img, 2, 3, 12, 4, w[2]); fillr(img, 3, 7, 10, 2, (24, 20, 20)); px(img, 6, 6, g); px(img, 9, 6, g)
    else: fillr(img, 2, 4, 12, 4, w[0]); fillr(img, 2, 7, 12, 1, w[3]); fillr(img, 7, 6, 2, 3, g)
    return img
def obj_grave():
    img = blank(); s = R['stone']
    fillr(img, 4, 4, 8, 10, s[1]); fillr(img, 5, 3, 6, 1, s[1]); fillr(img, 4, 4, 1, 10, s[0]); fillr(img, 11, 4, 1, 10, s[2])
    fillr(img, 7, 6, 2, 5, s[3]); fillr(img, 6, 7, 4, 1, s[3]); fillr(img, 3, 14, 10, 1, s[3])
    return img
def obj_trap():
    img = blank(); s = R['stone']
    fillr(img, 2, 6, 12, 5, s[2]); fillr(img, 2, 6, 12, 1, s[3])
    for x in range(3, 14, 3): px(img, x, 5, (230, 230, 240)); px(img, x, 4, (180, 180, 200))
    return img
def obj_sign():
    img = blank(); w = R['wood']
    fillr(img, 7, 9, 2, 6, w[2]); fillr(img, 3, 3, 10, 6, w[1]); fillr(img, 3, 3, 10, 1, w[0]); fillr(img, 3, 8, 10, 1, w[3])
    for y in (5, 6): fillr(img, 5, y, 6, 1, w[3])
    return img

# ---------------------------------------------------------------- walking sprites (16x16, 3 dirs x 2 frames)
# o outline, s skin, h hair, c cloth, d cloth shade, b boots/belt, e eye, w weapon/trim
HERO = {
 'down0': ["......oooo......", "....oohhhhoo....", "...ohhhhhhhho...", "...ohhsssshho...", "...ohseesseho...",
           "...oosssssso....", "....oosssoo.....", "...occcwwccco...", "..oscccwwcccso..", "..oscccccccso...",
           "..ooccbbbccoo...", "...occcccco.....", "...odddoddo.....", "...obbo.obbo....", "...oo...oo......", "................"],
 'down1': ["......oooo......", "....oohhhhoo....", "...ohhhhhhhho...", "...ohhsssshho...", "...ohseesseho...",
           "...oosssssso....", "....oosssoo.....", "...occcwwccco...", "..oscccwwcccso..", "..oscccccccso...",
           "..ooccbbbccoo...", "...occcccco.....", "...oddo.oddo....", "...obbo..obo....", "....o....oo.....", "................"],
 'up0':   ["......oooo......", "....oohhhhoo....", "...ohhhhhhhho...", "...ohhhhhhhho...", "...ohhhhhhhho...",
           "...oohhhhhho....", "....oosssoo.....", "...occcccccco...", "..oscccdddccso..", "..oscccdddccso..",
           "..ooccbbbccoo...", "...occcccco.....", "...odddoddo.....", "...obbo.obbo....", "...oo...oo......", "................"],
 'up1':   ["......oooo......", "....oohhhhoo....", "...ohhhhhhhho...", "...ohhhhhhhho...", "...ohhhhhhhho...",
           "...oohhhhhho....", "....oosssoo.....", "...occcccccco...", "..oscccdddccso..", "..oscccdddccso..",
           "..ooccbbbccoo...", "...occcccco.....", "...oddo.oddo....", "...obo..obbo....", "...oo....o......", "................"],
 'side0': [".....oooo.......", "...oohhhhoo.....", "..ohhhhhhhho....", "..ohhhhhsssho...", "..ohhhhsseso....",
           "..oohhhsssso....", "....oosssoo.....", "....occcccwo....", "...occcccwwso...", "...occcccccso...",
           "...occbbbcco....", "....occcccco....", "....oddoddo.....", "....obboobbo....", "....oo..oo......", "................"],
 'side1': [".....oooo.......", "...oohhhhoo.....", "..ohhhhhhhho....", "..ohhhhhsssho...", "..ohhhhsseso....",
           "..oohhhsssso....", "....oosssoo.....", "....occcccwo....", "...occcccwwso...", "...occcccccso...",
           "...occbbbcco....", "....occcccco....", ".....oddddo.....", ".....obbbbo.....", ".....oo.oo......", "................"],
}
LOOKS = {  # hair, cloth, cloth-dark, boots, trim, skin — D&D 5e class colours
    'warden': [(160, 140, 100), (110, 140, 180), (60, 90, 140), (50, 40, 30), (200, 60, 60)],   # Fighter: steel + red cape
    'berserker': [(210, 90, 40), (160, 60, 40), (110, 30, 20), (60, 30, 20), (220, 200, 160)], # Barbarian: red fur/leather
    'vanguard': [(240, 230, 180), (240, 200, 70), (190, 150, 50), (80, 60, 30), (250, 230, 120)],# Paladin: white plate + gold
    'strider': [(90, 70, 40), (60, 120, 60), (30, 80, 40), (70, 50, 40), (160, 200, 160)],     # Ranger: green cloak
    'shade': [(40, 50, 40), (60, 80, 60), (30, 50, 30), (30, 30, 30), (220, 200, 160)],       # Rogue: dark leather
    'ascetic': [(30, 30, 30), (230, 140, 50), (190, 100, 30), (110, 70, 30), (250, 230, 200)], # Monk: orange robes
    'arcanist': [(220, 220, 230), (80, 120, 220), (40, 60, 160), (60, 50, 80), (240, 210, 90)],# Wizard: blue robes
    'wildblood': [(210, 60, 60), (160, 40, 40), (110, 30, 30), (60, 30, 30), (240, 160, 60)],  # Sorcerer: dragon red
    'pactbound': [(60, 30, 90), (140, 60, 180), (90, 30, 130), (30, 20, 50), (180, 140, 220)], # Warlock: eldritch purple
    'cantor': [(220, 160, 60), (180, 80, 180), (130, 40, 130), (90, 50, 40), (240, 200, 240)], # Bard: purple/magenta
    'chaplain': [(245, 245, 235), (245, 220, 140), (200, 170, 90), (120, 100, 60), (255, 240, 160)], # Cleric: white/gold
    'verdant': [(80, 140, 70), (70, 130, 70), (40, 90, 50), (80, 60, 40), (200, 240, 160)],    # Druid: forest green
    'villager0': [(120, 80, 40), (180, 120, 70), (130, 80, 40), (80, 60, 40), (230, 210, 170)],
    'villager1': [(240, 200, 100), (90, 140, 200), (60, 90, 150), (70, 50, 40), (230, 230, 230)],
    'villager2': [(60, 40, 30), (200, 80, 80), (140, 50, 50), (70, 50, 40), (240, 220, 180)],
    'villager3': [(200, 200, 200), (120, 160, 120), (80, 110, 80), (70, 50, 40), (220, 220, 200)],
    'elder': [(250, 250, 250), (150, 110, 180), (100, 70, 130), (70, 50, 60), (240, 220, 120)],
    'guard': [(90, 60, 30), (170, 170, 180), (110, 110, 130), (60, 50, 40), (200, 60, 60)],
    'merchant': [(140, 90, 50), (220, 190, 90), (170, 130, 50), (90, 60, 30), (120, 60, 30)],
    'sage': [(200, 200, 220), (80, 120, 220), (40, 60, 160), (40, 30, 50), (240, 210, 90)],
    'necromancer': [(40, 40, 40), (60, 40, 70), (30, 30, 50), (24, 24, 28), (140, 60, 180)],
    'summoner': [(230, 220, 250), (140, 60, 180), (90, 30, 130), (50, 30, 70), (240, 140, 240)],
    'sunwarden': [(250, 230, 160), (240, 200, 70), (190, 150, 50), (110, 70, 30), (255, 240, 160)],
    'runeblade': [(60, 70, 90), (80, 130, 220), (40, 60, 160), (40, 40, 50), (90, 230, 250)],
}
SKINS = [(248, 208, 168), (224, 172, 128), (176, 120, 84), (120, 80, 56)]
def sprite(look, frame, skin):
    hair, cloth, dark, boots, trim = LOOKS[look]
    pal = {'o': (24, 20, 28), 's': skin, 'h': hair, 'c': cloth, 'd': dark, 'b': boots, 'e': (24, 20, 28), 'w': trim}
    img = blank()
    for y, row in enumerate(HERO[frame]):
        for x, ch in enumerate(row[:16]):
            if ch in pal: px(img, x, y, pal[ch])
    return img

# ---------------------------------------------------------------- emit everything
for b in BIOME:
    tiles = {
        'grass': grass(b, 1), 'meadow': grass(b, 2, flowers=4), 'cobble': cobble(b, 13), 'ground': ground(b, 3), 'sand': sand(b, 4), 'sand2': sand(b, 5, True),
        'tree': forest(b, 'round', 6), 'pine': forest(b, 'pine', 7), 'dense': forest(b, 'dense', 8), 'single': forest(b, 'single', 9),
        'rock': mountain(b, 10), 'peak': mountain(b, 11, True), 'deep0': deep(b, 0), 'deep1': deep(b, 1), 'bridge0': bridge(b, 0), 'bridge1': bridge(b, 1),
        'wall': wall_top(b), 'gate': gate(b), 'keep': keep_top(b), 'keepdoor': gate(b), 'house': house(b, 'house'), 'inn': house(b, 'inn'),
        'shop': house(b, 'shop'), 'temple': house(b, 'temple'), 'shrine': shrine(b), 'statue': statue(b), 'arena': arena(b),
    }
    for k, img in tiles.items(): save(f"gt_{b}_{k}", img)
    for m in range(16):
        save(f"gt_{b}_road{m}", road(b, m, 12))
        for f in (0, 1): save(f"gt_{b}_water{m}_{f}", water(b, m, f))
for t in THEMES:
    for k, img in {'walltop': d_wall_top(t), 'wall': d_wall_face(t), 'floor': d_floor(t, 1), 'floor2': d_floor(t, 2, True), 'down': d_stairs(t, False), 'up': d_stairs(t, True),
                   'torch0': d_torch(t, 0), 'torch1': d_torch(t, 1), 'altar': d_altar(t), 'gold': d_door(t, True), 'door': d_door(t), 'barrel': d_barrel(t), 'statue': d_statue(t), 'sign': d_sign(t),
                   'pillar': d_pillar(t), 'spikes': d_spikes(t), 'pool0': d_pool(t, 0), 'pool1': d_pool(t, 1), 'bones': d_bones(t), 'shelf': d_shelf(t), 'bars': d_bars(t),
                   'brazier0': d_brazier(t, 0), 'brazier1': d_brazier(t, 1), 'rug': d_rug(t), 'throne': d_throne(t), 'seal': d_seal(t)}.items():
        save(f"gd_{t}_{k}", img)
for k, img in {'herb': obj_herb(), 'wp0': obj_waypoint(0), 'wp1': obj_waypoint(1), 'chest': obj_chest(), 'chestopen': obj_chest(True), 'grave': obj_grave(), 'trap': obj_trap(), 'sign': obj_sign()}.items():
    save(f"go_{k}", img)
for i, look in enumerate(LOOKS):
    skin = SKINS[i % len(SKINS)]
    for fr in HERO: save(f"gh_{look}_{fr}", sprite(look, fr, skin))
manifest_path = os.path.join(HD_ROOT, "manifest.json")
os.makedirs(HD_ROOT, exist_ok=True)
with open(manifest_path, "w", encoding="utf-8") as manifest_file:
    import json
    json.dump({
        "schema": "gbq-hires-pixel-assets-v1",
        "logical_tile_size": [N, N],
        "scales": list(HI_SCALES),
        "resampling": "nearest-neighbor",
        "alpha": "preserved",
        "assets": HI_MANIFEST
    }, manifest_file, indent=2)
    manifest_file.write("\n")
print(f"generated {count} Game Boy tiles and sprites; exported {hi_count} crisp HD variants (64px and 96px) to assets_hd/gbtiles")
