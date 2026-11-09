#!/usr/bin/env python3
"""Slice the project's "Lanterns of Aelmoor" asset-pack overview (art_source/keyart/asset_pack_overview.png,
1536x1024) into individual game sprites.

Each panel of the sheet has a box below. Inside a panel, every pixel that differs enough from the dark panel
background is foreground; touching blobs (dilated a little so outlines and loose parts join) become one sprite,
cut out with the background made transparent. Whole-picture panels (portraits, cutscenes, the world map) are
cut as rectangles instead.

    python tools/slice_keyart.py                 # writes assets/ka_<panel>_<nn>.png + assets/keyart_index.json
    python tools/slice_keyart.py --sheet X.png   # numbered contact sheet for review
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art_source' / 'keyart' / 'asset_pack_overview.png'
OUT = ROOT / 'assets'

# panel: (x0, y0, x1, y1) of the sprite area (titles and captions left out)
PANELS = {
    'chars': (292, 30, 852, 162),
    'monsters': (862, 30, 1532, 178),
    'weapons': (218, 216, 642, 424),
    'items': (652, 216, 1052, 424),
    'buildings': (1060, 216, 1532, 424),
    'icons': (8, 782, 482, 862),
    'effects': (492, 898, 788, 1020),
    'status': (794, 898, 1028, 1020),
    'mounts': (1034, 898, 1278, 1020),
}
# whole pictures, cut as rectangles: name -> list of boxes
PICTURES = {
    'portrait': [(498 + i * 50.4, 784, 498 + i * 50.4 + 46, 858) for i in range(10)],
    'cutscene': [(1018 + i * 102, 784, 1018 + i * 102 + 98, 860) for i in range(5)],
    'worldmap': [(1150, 456, 1532, 596), (1284, 896, 1532, 1020)],
    'citadel': [(6, 896, 230, 1016)],
}
# left out on purpose: monsters_00 and mounts_02 read as other companies' famous characters (a drop-shaped
# slime, a yellow riding bird); the rest are merged strips, captions or empty slivers
EXCLUDE = {('monsters', 0), ('mounts', 2), ('monsters', 8), ('items', 0), ('mounts', 0), ('status', 0),
           *(('chars', k) for k in range(28, 40)), *(('icons', k) for k in (4, 5, 6, 8))}
MIN_AREA = 70
BG_DIST = 34


def foreground(rgb, box):
    x0, y0, x1, y1 = box
    a = rgb[y0:y1, x0:x1].astype(np.float64)
    # panel background: the darkest common colour along the panel border
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border[border.sum(1) < 140], axis=0) if (border.sum(1) < 140).any() else np.array([12, 14, 24])
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    return dist, bg


def slice_panel(rgb, name, box):
    dist, bg = foreground(rgb, box)
    fg = dist > BG_DIST
    joined = ndimage.binary_dilation(fg, iterations=2)
    lab, n = ndimage.label(joined)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        part = (lab[sl] == i) & fg[sl]
        if part.sum() < MIN_AREA:
            continue
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        if h < 8 or w < 8:
            continue
        crop = rgb[box[1] + ys.start:box[1] + ys.stop, box[0] + xs.start:box[0] + xs.stop]
        d = dist[sl]
        keep = (lab[sl] == i)
        alpha = np.clip((d - BG_DIST * 0.55) / (BG_DIST * 0.45), 0, 1) * keep
        alpha = ndimage.binary_closing(alpha > 0.5, iterations=1) | (alpha > 0.5)
        rgba = np.dstack([crop, (alpha * 255).astype(np.uint8)])
        out.append(((box[0] + xs.start, box[1] + ys.start), Image.fromarray(rgba.astype(np.uint8), 'RGBA')))
    # reading order: rows (by top, bucketed), then left to right
    out.sort(key=lambda t: (round(t[0][1] / 14), t[0][0]))
    return out


def run(write=True, sheet=None):
    rgb = np.array(Image.open(SRC).convert('RGB'))
    index = {}
    tiles = []
    for name, box in PANELS.items():
        index[name] = []
        for k, (pos, im) in enumerate(slice_panel(rgb, name, box)):
            if (name, k) in EXCLUDE:
                continue
            key = f'ka_{name}_{k:02d}'
            index[name].append({'name': key, 'x': int(pos[0]), 'y': int(pos[1]), 'w': im.width, 'h': im.height})
            tiles.append((key, im))
            if write:
                im.save(OUT / f'{key}.png')
    for name, boxes in PICTURES.items():
        index[name] = []
        for k, b in enumerate(boxes):
            b = tuple(int(round(v)) for v in b)
            im = Image.fromarray(rgb[b[1]:b[3], b[0]:b[2]]).convert('RGBA')
            key = f'ka_{name}_{k:02d}'
            index[name].append({'name': key, 'x': b[0], 'y': b[1], 'w': im.width, 'h': im.height})
            tiles.append((key, im))
            if write:
                im.save(OUT / f'{key}.png')
    if write:
        (OUT / 'keyart_index.json').write_text(json.dumps(index, indent=1))
    if sheet:
        cell = 72
        cols = 18
        rows = (len(tiles) + cols - 1) // cols
        cs = Image.new('RGBA', (cols * cell, rows * (cell + 10)), (60, 60, 70, 255))
        d = ImageDraw.Draw(cs)
        for i, (key, im) in enumerate(tiles):
            s = min((cell - 4) / im.width, (cell - 4) / im.height)
            t = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.NEAREST)
            x, y = (i % cols) * cell, (i // cols) * (cell + 10)
            cs.alpha_composite(t, (x + 2, y + 2))
            d.text((x + 2, y + cell - 2), key[3:], fill=(255, 255, 160))
        cs.save(sheet)
    return {k: len(v) for k, v in index.items()}

# ---------------------------------------------------------------- how the sliced art is used in AELMOOR HD mode
MONSTER_FOR = {   # bestiary subtype slug -> monsters_NN
    'goblin': 1, 'skeleton': 2, 'wolf': 3, 'bat': 4, 'myconid': 5, 'orc': 6, 'golem': 7, 'tormentor': 22, 'hellhound': 9,
    'hexer': 10, 'ogre': 11, 'imp': 13, 'treant': 14, 'wraith': 15, 'apostate': 16, 'bonehulk': 17, 'geode': 18,
    'animatedarmour': 19, 'ghoul': 20, 'blight': 21, 'haloknight': 23, 'wyvern': 24, 'drake': 24, 'troll': 11,
    'gargoyle': 18, 'sentry': 23, 'thornling': 21, 'shade': 16,
}
VARIANT_HUE = {'ember': 0.02, 'frost': 0.57, 'venom': 0.79, 'gilded': 0.12}
EQUIP_FOR = {     # icon category -> sliced sprites, weakest to strongest
    'sword': ['weapons_%02d' % k for k in (3, 4, 5, 6, 7)], 'dagger': ['weapons_03', 'weapons_04'], 'axe': ['weapons_%02d' % k for k in (8, 9, 10)],
    'polearm': ['weapons_11'], 'mace': ['weapons_12'], 'bow': ['weapons_00'], 'staff': ['weapons_01', 'weapons_02'], 'wand': ['weapons_02'],
    'shield': ['weapons_%02d' % k for k in (13, 14, 15, 16)], 'heavyarmor': ['weapons_%02d' % k for k in range(17, 28)],
    'lightarmor': ['weapons_%02d' % k for k in (28, 29, 30)], 'mediumarmor': ['weapons_%02d' % k for k in (31, 32, 33)],
    'helmet': ['weapons_34'], 'ring': ['weapons_%02d' % k for k in (35, 36, 37)], 'belt': ['weapons_42', 'weapons_43'], 'glove': ['weapons_44'],
}
CONSUMABLE_FOR = {
    'potion': 'items_01', 'greater': 'items_05', 'superior': 'items_06', 'supreme': 'items_08', 'ether': 'items_03', 'antitoxin': 'items_07',
    'might': 'items_10', 'ration': 'items_40', 'grilled': 'items_39', 'feast': 'items_41', 'scroll_flame': 'items_11', 'scroll_mend': 'items_12',
    'scroll_dawn': 'items_13', 'peacebloom': 'items_61', 'sandroot': 'items_57', 'frostbloom': 'items_62', 'gold_dust': 'items_53',
    'idol_shard': 'items_26', 'codex_page': 'items_45', 'tower_key': 'items_42',
}
NPC_FOR = {'guard': 6, 'elder': 5, 'oracle': 4, 'enchanter': 4, 'spirekeeper': 21, 'merchant': 19, 'noble': 27, 'child': 11,
           'innkeeper': 3, 'warden': 22, 'hunter': 23, 'herbalist': 9, 'blacksmith': 20, 'trainer': 0}
NPC_POOL = list(range(0, 28))
BUILDING_FOR = {'house': 'buildings_02', 'inn': 'buildings_06', 'shop': 'buildings_07', 'temple': 'buildings_13', 'shrine': 'buildings_22',
                'statue': 'buildings_14', 'keep': 'buildings_00'}
EFFECT_FOR = {'fire': 'effects_02', 'cold': 'effects_04', 'lightning': 'effects_05', 'poison': 'status_14', 'acid': 'status_14',
              'necrotic': 'effects_03', 'psychic': 'effects_03', 'radiant': 'effects_07', 'force': 'effects_00', 'thunder': 'effects_05',
              'piercing': 'effects_09', 'bludgeoning': 'effects_06', 'slashing': 'effects_00'}


def recolour(im, variant):
    """element palette swap for a sliced monster: shift the hue of its coloured pixels (keeps eyes and outlines)"""
    import colorsys
    a = np.array(im).astype(np.float64) / 255
    out = a.copy()
    h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            r, g, b, al = a[y, x]
            if al == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
            if variant == 'shadow':
                hh, ss, vv = 0.74, min(1, ss * 0.6 + 0.15), vv * 0.62
            elif variant == 'ash':
                ss, vv = ss * 0.12, vv * 0.85
            elif ss > 0.22:
                hh = VARIANT_HUE[variant]; ss = min(1, ss * 1.05)
            out[y, x, :3] = colorsys.hsv_to_rgb(hh, ss, vv)
    return Image.fromarray((out * 255).astype(np.uint8), 'RGBA')


def derive(index):
    """element variants, town tiles and the runtime index (src/keyart_index.js)"""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import gen_retro8 as R
    names = {e['name'] for v in index.values() for e in v}
    mons = {}
    for sub, k in MONSTER_FOR.items():
        base = f'ka_monsters_{k:02d}'
        if base not in names:
            continue
        mons[sub] = base
    made = set()
    for base in set(mons.values()):
        im = Image.open(OUT / f'{base}.png').convert('RGBA')
        for v in ('ember', 'frost', 'venom', 'shadow', 'gilded', 'ash'):
            recolour(im, v).save(OUT / f'{base}_{v}.png'); made.add(f'{base}_{v}')
    town = {}
    for key, src in BUILDING_FOR.items():
        b = Image.open(OUT / f'ka_{src}.png').convert('RGBA')
        s = 16 / max(b.width, b.height)
        b = b.resize((max(1, round(b.width * s)), max(1, round(b.height * s))), Image.LANCZOS)
        for g in R.TILE_PALS:
            t = R.tile(g, 'grass').convert('RGBA')
            t.alpha_composite(b, ((16 - b.width) // 2, 16 - b.height))
            t.save(OUT / f'gt_ka{g}_{key}.png')
        town[key] = True
    k = lambda n: 'ka_' + n
    data = {
        'monsters': mons,
        'equip': {c: [k(n) for n in L] for c, L in EQUIP_FOR.items()},
        'consumables': {c: k(n) for c, n in CONSUMABLE_FOR.items()},
        'npc': {r: f'ka_chars_{n:02d}' for r, n in NPC_FOR.items()},
        'npcPool': [f'ka_chars_{n:02d}' for n in NPC_POOL],
        'town': sorted(town),
        'effects': {d: k(n) for d, n in EFFECT_FOR.items()},
        'portraits': [e['name'] for e in index.get('portrait', [])],
        'cutscenes': [e['name'] for e in index.get('cutscene', [])],
    }
    js = ("'use strict';\n// GENERATED by tools/slice_keyart.py from art_source/keyart/asset_pack_overview.png - do not edit by hand.\n"
          "// Which sliced Lanterns of Aelmoor sprites AELMOOR HD mode uses for monsters, gear, consumables, townsfolk,\n"
          "// town buildings and spell effects (see src/art.js keyArt*).\n"
          "const KEYART = " + json.dumps(data, separators=(',', ':')) + ";\n"
          "if (typeof globalThis !== 'undefined') globalThis.KEYART = KEYART;\n")
    (ROOT / 'src' / 'keyart_index.js').write_text(js)
    return len(made) + len(town) * len(R.TILE_PALS)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--no-write', action='store_true')
    a = ap.parse_args()
    counts = run(write=not a.no_write, sheet=a.sheet)
    print(counts)
    if not a.no_write:
        print('derived', derive(json.loads((OUT / 'keyart_index.json').read_text())))
