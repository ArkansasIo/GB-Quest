#!/usr/bin/env python3
"""Slice the NES-style asset sheets into individual sprites.

  src_sheet/sheet_monsters.png  -> assets/nm_<panel>_<n>.png (monsters, NPCs, items, spells, backgrounds...)
  src_sheet/sheet_equipment.png -> assets/ne_<panel>_<n>.png (weapons, armour, accessories, mounts...)
  assets/nes_index.json         -> {panel: [names...]} for the game to look up by category
Background (near-black) is made transparent; sprites are found as connected components
inside each named panel, and text labels are filtered out.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")
INDEX = {}

PANELS_1 = {  # (x0, y0, x1, y1) inside sheet_monsters.png
    'dragon': (8, 76, 570, 165), 'hero': (578, 100, 1032, 168), 'companion': (1044, 80, 1228, 140), 'npc': (1238, 78, 1530, 218),
    'monster': (8, 222, 726, 396), 'strong': (736, 222, 1023, 396), 'undead': (1032, 222, 1530, 396),
    'demon': (8, 424, 296, 538), 'elemental': (304, 424, 590, 538), 'beast': (600, 424, 928, 538), 'plant': (938, 424, 1186, 538), 'slime': (1194, 434, 1530, 538),
    'town': (8, 566, 296, 698), 'dungeon': (304, 566, 603, 698), 'world': (612, 566, 1013, 698), 'interior': (1022, 566, 1223, 698),
    'item': (8, 728, 268, 836), 'weapon': (277, 728, 535, 836), 'armor': (544, 728, 826, 836), 'spell': (835, 728, 1178, 836), 'status': (1187, 728, 1530, 836),
    'treasure': (8, 866, 282, 976), 'book': (291, 866, 513, 976), 'door': (522, 866, 840, 976), 'effect': (849, 866, 1103, 976), 'battlebg': (1112, 872, 1530, 976),
}
PANELS_2 = {  # inside sheet_equipment.png; label columns on the left are excluded
    'sword': (90, 72, 365, 102), 'dagger': (90, 104, 365, 134), 'axe': (90, 136, 365, 164), 'mace': (90, 166, 365, 196), 'polearm': (90, 198, 365, 232),
    'bow': (440, 72, 635, 102), 'crossbow': (440, 104, 635, 134), 'staff': (440, 136, 635, 164), 'wand': (440, 166, 635, 196), 'thrown': (440, 198, 635, 232),
    'lightarmor': (672, 86, 1100, 116), 'mediumarmor': (672, 130, 1100, 160), 'heavyarmor': (672, 174, 1100, 206), 'shield': (712, 210, 1100, 240),
    'ring': (1170, 78, 1500, 104), 'amulet': (1170, 110, 1500, 138), 'belt': (1170, 142, 1500, 168), 'glove': (1170, 174, 1500, 200), 'boots': (1170, 206, 1500, 234),
    'potion': (76, 278, 560, 304), 'scroll': (76, 308, 560, 336), 'food': (76, 340, 560, 368), 'tome': (76, 372, 560, 400), 'magicitem': (106, 404, 560, 432),
    'tool': (686, 278, 1040, 304), 'light': (686, 308, 1040, 336), 'key': (686, 340, 1040, 368), 'treasure2': (676, 372, 1040, 400), 'misc': (686, 404, 1040, 432),
    'ore': (1166, 280, 1505, 308), 'gem': (1166, 312, 1505, 340), 'leather': (1166, 344, 1505, 372), 'wood': (1166, 376, 1505, 404), 'reagent': (1166, 408, 1505, 436),
    'mount': (590, 468, 875, 600), 'vehicle': (590, 626, 875, 704), 'relic': (952, 466, 1525, 492), 'artifact': (952, 494, 1525, 520), 'questitem': (952, 522, 1525, 546),
    'banner': (952, 572, 1525, 598), 'instrument': (952, 598, 1525, 622), 'currency': (952, 706, 1525, 730),
    'm_dragon': (96, 680, 570, 706), 'm_undead': (96, 706, 570, 732), 'm_beast': (96, 732, 570, 756), 'm_fiend': (96, 756, 570, 780), 'm_elemental': (96, 780, 570, 804),
    'm_aberration': (96, 804, 570, 830), 'm_giant': (96, 830, 570, 854), 'm_fey': (96, 854, 570, 880), 'm_humanoid': (96, 880, 570, 904), 'm_ooze': (96, 904, 570, 930),
    'c_hero': (686, 736, 875, 756), 'c_townsfolk': (686, 764, 875, 788), 'c_merchant': (686, 796, 875, 820), 'c_noble': (686, 828, 875, 852),
    'c_guard': (686, 860, 875, 884), 'c_special': (686, 892, 875, 916), 'buff': (895, 866, 1085, 920), 'status2': (895, 782, 1085, 830),
}

def slice_sheet(path, panels, prefix, min_size=10, max_size=120, dark=46):
    im = np.array(Image.open(path).convert("RGB")).astype(int)
    for name, (x0, y0, x1, y1) in panels.items():
        a = im[y0:y1, x0:x1]
        lum = a.max(axis=2)
        fg = lum > dark
        big = name in ('battlebg',)
        lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=1 if not big else 3))
        boxes = []
        for sl in ndimage.find_objects(lab):
            h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            if h < min_size or w < min_size or (not big and (h > max_size or w > max_size)): continue
            sub = a[sl]; m = fg[sl]
            # text labels: mostly neutral grey/white and thin
            sat = (sub.max(2) - sub.min(2))[m]
            if not big and m.mean() < 0.35 and np.median(sat) < 30 and h < 14: continue
            boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
        boxes.sort(key=lambda b: (round(b[1] / 14), b[0]))
        names = []
        for i, (bx0, by0, bx1, by1) in enumerate(boxes):
            pad = 1
            crop = a[max(0, by0 - pad):by1 + pad, max(0, bx0 - pad):bx1 + pad]
            rgba = np.dstack([crop, np.full(crop.shape[:2], 255)]).astype(np.uint8)
            if not big:
                bg = crop.max(axis=2) <= dark
                lab2, _ = ndimage.label(bg)
                edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
                rgba[np.isin(lab2, list(edge)), 3] = 0
            nm = f"{prefix}_{name}_{i}"
            Image.fromarray(rgba, "RGBA").save(os.path.join(A, nm + ".png"))
            names.append(nm)
        INDEX[name] = names

slice_sheet(os.path.join(ROOT, "src_sheet", "sheet_monsters.png"), PANELS_1, "nm")
slice_sheet(os.path.join(ROOT, "src_sheet", "sheet_equipment.png"), PANELS_2, "ne", min_size=8)
json.dump(INDEX, open(os.path.join(A, "nes_index.json"), "w"), indent=0)
print({k: len(v) for k, v in INDEX.items()})
print("total", sum(len(v) for v in INDEX.values()))

# ---------------------------------------------------------------- class & species portraits (sheet_classes.png)
CARD_X = [(15, 178), (187, 355), (362, 520), (527, 693), (700, 872), (880, 1052), (1060, 1215), (1222, 1365), (1372, 1520)]
CLASS_IDS = ['warden', 'berserker', 'shade', 'strider', 'vanguard', 'chaplain', 'arcanist', 'pactbound', 'verdant']
RACE_IDS = ['hearthkin', 'thornelf', 'stonekin', 'wispling', 'drakkin', 'burrowkin', 'twinblood', 'emberborn', 'tuskborn']
RACE_X = [(15, 163), (172, 330), (339, 500), (509, 666), (675, 848), (856, 1006), (1016, 1172), (1181, 1338), (1347, 1520)]
im3 = np.array(Image.open(os.path.join(ROOT, "src_sheet", "sheet_classes.png")).convert("RGB")).astype(int)
def biggest(a, keep=1, dark=40):
    fg = a.max(2) > dark
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=2))
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1][:keep]
    out = []
    for k in sorted(order, key=lambda k: ndimage.find_objects(lab)[k][1].start):
        sl = ndimage.find_objects(lab)[k]; crop = a[sl]; m = (lab[sl] == k + 1) & fg[sl]
        rgba = np.dstack([crop, np.where(m, 255, 0)]).astype(np.uint8)
        out.append(rgba)
    return out
INDEX['class_portrait'] = []; INDEX['race_portrait'] = []
for (x0, x1), cid in zip(CARD_X, CLASS_IDS):
    [img] = biggest(im3[140:275, x0 + 4:x1 - 44], 1)
    Image.fromarray(img, "RGBA").save(os.path.join(A, f"np_class_{cid}.png")); INDEX['class_portrait'].append(f"np_class_{cid}")
for (x0, x1), rid in zip(RACE_X, RACE_IDS):
    imgs = biggest(im3[615:738, x0 + 4:x1 - 4], 2)
    for j, img in enumerate(imgs):
        Image.fromarray(img, "RGBA").save(os.path.join(A, f"np_race_{rid}_{j}.png")); INDEX['race_portrait'].append(f"np_race_{rid}_{j}")
json.dump(INDEX, open(os.path.join(A, "nes_index.json"), "w"), indent=0)
print("portraits", len(INDEX['class_portrait']), len(INDEX['race_portrait']))

# ---------------------------------------------------------------- cleanup + derived portraits
for k in list(INDEX):
    keep = []
    for n in INDEX[k]:
        p = os.path.join(A, n + ".png"); a = np.array(Image.open(p))
        if k not in ('battlebg',) and (a[:, :, 3] > 0).sum() < (40 if n.startswith('ne_') else 110): os.remove(p); continue
        keep.append(n)
    INDEX[k] = keep
def tint(src, dst, col, amt=0.45):
    a = np.array(Image.open(os.path.join(A, src + ".png")).convert("RGBA")).astype(float)
    lum = (a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11)[..., None] / 255
    a[..., :3] = a[..., :3] * (1 - amt) + np.array(col) * (0.35 + lum * 0.9) * amt
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA").save(os.path.join(A, dst + ".png")); INDEX['class_portrait'].append(dst)
tint('np_class_arcanist', 'np_class_wildblood', (230, 70, 170))   # sorcerer-style caster
tint('np_class_shade', 'np_class_cantor', (240, 140, 200))        # songweaver
tint('np_class_strider', 'np_class_ascetic', (240, 150, 50))      # monk in saffron
json.dump(INDEX, open(os.path.join(A, "nes_index.json"), "w"), indent=0)
print("after cleanup", sum(len(v) for v in INDEX.values()))
