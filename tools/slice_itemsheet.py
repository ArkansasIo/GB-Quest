#!/usr/bin/env python3
"""Slice the project's 8-bit item sheet (art_source/keyart/item_classes_8bit.png, 1536x1024) into icons for the
RETRO 8-BIT art mode.

Each labelled row (swords, bows, light armour, rings, potions, keys...) becomes an ordered list of icons, weakest to
strongest left to right, written as assets/ki_<row>_<nn>.png and indexed in src/itemsheet_index.js. Only the
generic item, equipment, consumable and material rows are used: the sheet's title, its monster and slime rows
and its sample UI panels are not sliced.

    python tools/slice_itemsheet.py [--sheet review.png]
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art_source' / 'keyart' / 'item_classes_8bit.png'
OUT = ROOT / 'assets'

# (x0, y0, x1, y1) of the icon area (labels on the left left out) and the row names top to bottom
REGIONS = [
    ((66, 72, 360, 232), ['swords', 'daggers', 'axes', 'maces', 'polearms']),
    ((445, 72, 636, 232), ['bows', 'crossbows', 'staves', 'wands', 'thrown']),
    ((672, 82, 1100, 122), ['lightarmor']),
    ((672, 127, 1100, 165), ['mediumarmor']),
    ((672, 172, 1100, 210), ['heavyarmor']),
    ((715, 210, 1100, 240), ['shields']),
    ((1172, 72, 1525, 232), ['rings', 'amulets', 'belts', 'gloves', 'boots']),
    ((70, 276, 572, 432), ['potions', 'scrolls', 'food', 'books', 'magic']),
    ((650, 276, 1040, 432), ['tools', 'lights', 'keys', 'treasure', 'misc']),
    ((1176, 276, 1528, 432), ['ores', 'gems', 'leather', 'wood', 'alchemy']),
]
BG = 26


def slice_region(rgb, box, rows):
    x0, y0, x1, y1 = box
    a = rgb[y0:y1, x0:x1].astype(np.int32)
    fg = a.max(-1) > BG
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=1))
    blobs = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        part = (lab[sl] == i) & fg[sl]
        ys, xs = sl
        # icons are ~16px tall; caption fragments (row labels) are short strips of light text
        if part.sum() < 30 or ys.stop - ys.start < 11 or xs.stop - xs.start < 6:
            continue
        blobs.append(((ys.start + ys.stop) / 2, (xs.start + xs.stop) / 2, sl, i))
    if not blobs:
        return {r: [] for r in rows}
    # split into rows at the largest vertical gaps between blob centres
    blobs.sort(key=lambda b: b[0])
    cy = [b[0] for b in blobs]
    gaps = sorted(range(1, len(cy)), key=lambda k: cy[k] - cy[k - 1], reverse=True)[:len(rows) - 1]
    cuts = sorted(gaps)
    groups, start = [], 0
    for c in cuts + [len(blobs)]:
        groups.append(blobs[start:c]); start = c
    out = {}
    for name, grp in zip(rows, groups):
        icons = []
        for _, _, sl, i in sorted(grp, key=lambda b: b[1]):
            ys, xs = sl
            crop = rgb[y0 + ys.start:y0 + ys.stop, x0 + xs.start:x0 + xs.stop]
            keep = ((lab[sl] == i) & fg[sl]) | ((lab[sl] == i) & (crop.max(-1) > 8))
            rgba = np.dstack([crop, (keep * 255).astype(np.uint8)]).astype(np.uint8)
            icons.append(Image.fromarray(rgba, 'RGBA'))
        out[name] = icons
    return out


# game icon category / consumable -> sheet row (and index for consumables)
EQUIP = {'sword': 'swords', 'dagger': 'daggers', 'axe': 'axes', 'mace': 'maces', 'polearm': 'polearms', 'bow': 'bows', 'crossbow': 'crossbows',
         'staff': 'staves', 'wand': 'wands', 'lightarmor': 'lightarmor', 'mediumarmor': 'mediumarmor', 'heavyarmor': 'heavyarmor',
         'shield': 'shields', 'ring': 'rings', 'amulet': 'amulets', 'belt': 'belts', 'glove': 'gloves', 'boots': 'boots', 'magicitem': 'magic'}
CONSUMABLE = {'potion': ('potions', 0), 'greater': ('potions', 1), 'superior': ('potions', 5), 'supreme': ('potions', 6), 'ether': ('potions', 2),
              'antitoxin': ('potions', 3), 'might': ('potions', 4), 'scroll_flame': ('scrolls', 2), 'scroll_mend': ('scrolls', 3),
              'scroll_dawn': ('scrolls', 4), 'ration': ('food', 9), 'grilled': ('food', 1), 'feast': ('food', 5), 'codex_page': ('books', 0),
              'campkit': ('tools', 0), 'tower_key': ('keys', 0), 'coinpurse': ('treasure', 0), 'gold_dust': ('ores', 0), 'idol_shard': ('gems', 0),
              'peacebloom': ('wood', 0), 'sandroot': ('wood', 1), 'frostbloom': ('wood', 2), 'old_boot': ('leather', 0), 'slimegel': ('alchemy', 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    a = ap.parse_args()
    rgb = np.array(Image.open(SRC).convert('RGB'))
    rows = {}
    for box, names in REGIONS:
        rows.update(slice_region(rgb, box, names))
    names = {}
    for row, icons in rows.items():
        names[row] = []
        for k, im in enumerate(icons):
            key = f'ki_{row}_{k:02d}'
            im.save(OUT / f'{key}.png'); names[row].append(key)
    data = {'equip': {c: names[r] for c, r in EQUIP.items() if names.get(r)},
            'consumables': {c: names[r][min(i, len(names[r]) - 1)] for c, (r, i) in CONSUMABLE.items() if names.get(r)}}
    js = ("'use strict';\n// GENERATED by tools/slice_itemsheet.py from art_source/keyart/item_classes_8bit.png - do not edit by hand.\n"
          "// Item, equipment and consumable icons for the RETRO 8-BIT art mode (see src/art.js retroItemIcon).\n"
          "const ITEMSHEET = " + json.dumps(data, separators=(',', ':')) + ";\nif (typeof globalThis !== 'undefined') globalThis.ITEMSHEET = ITEMSHEET;\n")
    (ROOT / 'src' / 'itemsheet_index.js').write_text(js)
    print({r: len(v) for r, v in rows.items()})
    if a.sheet:
        cs = Image.new('RGBA', (14 * 40, len(rows) * 40), (50, 50, 64, 255)); d = ImageDraw.Draw(cs)
        for j, (row, icons) in enumerate(rows.items()):
            d.text((2, j * 40 + 14), row[:7], fill=(255, 255, 160))
            for k, im in enumerate(icons[:12]):
                s = min(32 / im.width, 32 / im.height); cs.alpha_composite(im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.NEAREST), (56 + k * 40, j * 40 + 4))
        cs.save(a.sheet)


if __name__ == '__main__':
    main()
