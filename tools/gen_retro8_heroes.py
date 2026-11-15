#!/usr/bin/env python3
"""RETRO 8-BIT heroes and buildings: original sprites that complete the RETRO 8-BIT art mode.

Drawn from scratch in code with the same materials, three-tone shading and ink outline as tools/gen_retro8.py
(no third-party sprites are read or copied):
  * hero walkers  assets/r8h_<job>_<down|up|side><0|1>.png  16x16, one design per job (27), walking down, up and
                  to the side (left is the mirrored side view), two steps each
  * buildings     assets/r8bld_<kind>.png                  32x32, the town and village buildings (src/buildings.js):
                  inn, store, smithy, stable, post office, bank, shrine, windmill and four houses

    python tools/gen_retro8_heroes.py             # writes the PNGs into assets/
    python tools/gen_retro8_heroes.py --sheet X   # also writes a contact sheet to X for review
"""
import argparse
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_retro8 import (C, shade, OUT, BODY, ACC, STEEL, BONE, WOOD, MOUTH, WHITE, DARK, GLOW, HOT, SHINE, GOLD, SKIN, STONE,
                        HAIR, SKINS)

# ============================================================== heroes (16 x 16)
# job: body colour, trim colour, build (armor | light | robe), head, weapon, extra (shield | cape | none), hair, skin
JOBS = {
    'warden':      ((70, 120, 80), (226, 178, 58), 'armor', 'helm', 'sword', 'shield', 'brown', 'l'),
    'berserker':   ((176, 60, 44), (120, 80, 50), 'light', 'band', 'axe', 'none', 'red', 't'),
    'vanguard':    ((80, 104, 170), (226, 178, 58), 'armor', 'greathelm', 'spear', 'shield', 'brown', 'l'),
    'strider':     ((70, 120, 60), (130, 90, 50), 'light', 'hood', 'bow', 'cape', 'blond', 'l'),
    'shade':       ((56, 52, 70), (150, 40, 60), 'light', 'hood', 'daggers', 'none', 'black', 'l'),
    'ascetic':     ((222, 130, 50), (150, 60, 40), 'light', 'bald', 'none', 'none', 'black', 't'),
    'arcanist':    ((60, 90, 190), (226, 178, 58), 'robe', 'hat', 'orbstaff', 'none', 'white', 'l'),
    'wildblood':   ((130, 90, 50), (90, 150, 70), 'light', 'wild', 'claws', 'none', 'auburn', 'd'),
    'pactbound':   ((110, 50, 140), (200, 90, 220), 'robe', 'hood', 'orb', 'none', 'black', 'l'),
    'cantor':      ((176, 60, 90), (226, 178, 58), 'light', 'feather', 'lute', 'cape', 'blond', 'l'),
    'chaplain':    ((232, 230, 220), (226, 178, 58), 'robe', 'mitre', 'mace', 'none', 'grey', 'l'),
    'verdant':     ((70, 140, 80), (200, 220, 120), 'robe', 'circlet', 'staff', 'none', 'auburn', 't'),
    'necromancer': ((50, 44, 60), (130, 220, 120), 'robe', 'hood', 'skullstaff', 'none', 'white', 'l'),
    'summoner':    ((40, 140, 150), (226, 178, 58), 'robe', 'hat', 'book', 'none', 'blue', 'l'),
    'sunwarden':   ((226, 178, 58), (240, 240, 230), 'armor', 'helm', 'mace', 'shield', 'blond', 't'),
    'runeblade':   ((96, 70, 150), (110, 220, 255), 'armor', 'short', 'runesword', 'cape', 'white', 'l'),
    'ronin':       ((110, 112, 124), (170, 50, 50), 'light', 'topknot', 'katana', 'none', 'black', 't'),
    'shinobi':     ((40, 46, 80), (170, 40, 40), 'light', 'mask', 'daggers', 'none', 'black', 'l'),
    'bladedancer': ((200, 90, 150), (240, 220, 120), 'light', 'bun', 'twinswords', 'none', 'red', 'l'),
    'wyrmlancer':  ((150, 40, 50), (226, 178, 58), 'armor', 'horned', 'spear', 'cape', 'black', 't'),
    'corsair':     ((50, 70, 120), (220, 210, 190), 'light', 'tricorn', 'sword', 'none', 'brown', 't'),
    'beastcaller': ((120, 96, 60), (190, 150, 80), 'light', 'wild', 'whip', 'none', 'brown', 'd'),
    'puppeteer':   ((90, 50, 110), (226, 178, 58), 'robe', 'tophat', 'strings', 'none', 'black', 'l'),
    'dreadknight': ((50, 48, 58), (170, 40, 40), 'armor', 'horned', 'greatsword', 'cape', 'black', 'l'),
    'voidhunter':  ((70, 50, 100), (170, 110, 255), 'light', 'hood', 'bow', 'cape', 'grey', 'l'),
    'scalesage':   ((40, 130, 120), (226, 178, 58), 'robe', 'circlet', 'book', 'none', 'black', 'd'),
    'stormcaller': ((40, 60, 150), (130, 210, 255), 'robe', 'hat', 'orb', 'none', 'white', 'l'),
}
DIRS = ('down', 'up', 'side')


def hero(job, d, f):
    """material canvas: BODY clothes or armour, ACC trim, STONE hair; d is down / up / side, f the step"""
    body, acc, build, head, weapon, extra, hair, skin = JOBS[job]
    c = C(16, 16)
    front, back, side = d == 'down', d == 'up', d == 'side'
    metal = build == 'armor'
    # ---- cape behind everything
    if extra == 'cape':
        if back: c.r(4, 7, 11, 14, ACC)
        elif side: c.p([(3, 7), (6, 7), (5, 14), (2, 14)], ACC)
        else: c.r(3, 8, 12, 12, ACC)
    # ---- legs and feet (two steps)
    if build == 'robe':
        c.p([(4, 8), (11, 8), (12, 14), (3, 14)], BODY)
        if side: c.r(5 + f, 14, 7 + f, 15, DARK); c.r(9 - f, 14, 10 - f, 15, DARK)
        else: c.r(5, 14 + (f == 1), 6, 15, DARK); c.r(9, 14 + (f == 0), 10, 15, DARK)
    else:
        leg = STEEL if metal else WOOD
        if side:
            a, b = (5, 9) if f else (7, 7)
            c.r(a, 12, a + 1, 15, leg); c.r(b, 12, b + 1, 15, leg)
            c.r(a, 15, a + 2, 15, DARK); c.r(b, 15, b + 2, 15, DARK)
        else:
            c.r(5, 12, 6, 14 + (f == 1), leg); c.r(9, 12, 10, 14 + (f == 0), leg)
            c.r(5, 14 + (f == 1), 6, 15, DARK) if f == 1 else c.r(5, 14, 6, 14, DARK)
            c.r(9, 14 + (f == 0), 10, 15, DARK) if f == 0 else c.r(9, 14, 10, 14, DARK)
    # ---- torso
    if side: c.r(5, 7, 10, 12, BODY)
    else: c.r(4, 7, 11, 12, BODY)
    if metal and not back:
        c.r(6 if side else 5, 8, 9 if side else 10, 8, STEEL)                    # breastplate band
    c.r(4 if not side else 5, 11, 11 if not side else 10, 11, ACC)              # belt
    if metal and not side:
        c.r(3, 7, 4, 8, STEEL, True)                                             # pauldrons
    # ---- arms (swing with the step)
    arm = STEEL if metal else BODY
    if side:
        sw = 1 if f else -1
        c.r(7 + sw, 8, 8 + sw, 11, arm); c.px(7 + sw, 11, SKIN)
    else:
        c.r(3, 9 - f, 3, 11 - f, arm); c.r(12, 9 - (1 - f), 12, 11 - (1 - f), arm)
        c.px(3, 11 - f, SKIN); c.px(12, 11 - (1 - f), SKIN)
    # ---- head: face (front / side) or back of the head
    covered = head in ('hood', 'greathelm', 'mask', 'helm', 'horned')
    if head == 'hood':
        c.e(3, 0, 12, 8, BODY)                                                   # the hood covers the head; only the face shows
        if front: c.e(5, 2, 10, 7, SKIN); c.r(5, 2, 10, 2, BODY)
        elif side: c.e(7, 2, 11, 7, SKIN); c.r(7, 2, 11, 2, BODY)
        else: c.l([(7, 1), (7, 7)], ACC)                                         # seam down the back
    else:
        c.e(4, 1, 11, 7, SKIN if not back else STONE)
    if head in ('short', 'band', 'topknot', 'bun', 'feather', 'circlet', 'wild', 'tricorn', 'tophat', 'hat', 'mitre'):
        if back: c.e(4, 1, 11, 7, STONE)
        elif side: c.e(4, 0, 10, 4, STONE); c.r(4, 2, 6, 6, STONE)
        else: c.e(4, 0, 11, 4, STONE); c.r(4, 2, 4, 5, STONE, True)
    if head == 'wild':
        c.p([(3, 1), (2, 6), (5, 3)], STONE); c.p([(12, 1), (13, 6), (10, 3)], STONE)
    if head == 'bald':
        if back: c.e(4, 1, 11, 7, SKIN)
        c.px(7, 1, SHINE)
    if head in ('helm', 'horned'):
        c.e(4, 0, 11, 5, STEEL); c.r(3, 3, 12, 4, STEEL)
        if head == 'horned': c.p([(4, 2), (1, -1), (3, 3)], BONE); c.p([(11, 2), (14, -1), (12, 3)], BONE)
        else: c.px(7, 0, ACC); c.px(8, 0, ACC)
    if head == 'greathelm':
        c.e(4, 0, 11, 7, STEEL); c.r(4, 3, 11, 7, STEEL)
        if not back: c.r(5 if not side else 8, 4, 10 if not side else 11, 4, DARK)
        c.r(7, -1, 8, 0, ACC)
    if head == 'mask' and not back:
        c.e(4, 1, 11, 7, BODY); c.r(5 if not side else 7, 3, 10 if not side else 11, 4, SKIN)
    if head == 'mask' and back: c.e(4, 1, 11, 7, BODY)
    if head == 'band': c.r(4, 3, 11, 3, ACC)
    if head == 'topknot': c.e(6, -1, 9, 1, STONE); c.px(7, 1, ACC)
    if head == 'bun': c.e(5, -1, 10, 1, STONE); c.px(7, -1, ACC)
    if head == 'feather': c.e(4, 0, 11, 3, ACC); c.l([(10, 1), (13, -2)], WHITE)
    if head == 'circlet': c.r(4, 2, 11, 2, GOLD); c.px(7, 1, GLOW); c.px(8, 1, GLOW)
    if head == 'hat': c.p([(8, -3), (12, 3), (3, 3)], BODY); c.r(2, 2, 13, 3, BODY); c.px(8, 0, ACC)
    if head == 'mitre': c.p([(5, 3), (7, -2), (8, -2), (10, 3)], WHITE); c.l([(7, -1), (7, 2)], GOLD)
    if head == 'tricorn': c.r(2, 2, 13, 3, DARK); c.e(4, -1, 11, 3, DARK); c.px(7, 1, GOLD)
    if head == 'tophat': c.r(2, 3, 13, 3, DARK); c.r(5, -2, 10, 3, DARK); c.r(5, 1, 10, 1, ACC)
    # ---- eyes
    if front and head not in ('greathelm',):
        c.r(6, 4, 6, 5, DARK, True)
    elif side and head not in ('greathelm',):
        c.r(9, 4, 9, 5, DARK); c.px(11, 5, SKIN) if head not in ('mask',) else None
    # ---- weapon and off-hand (front: right hand; side: in front; back: over the shoulder)
    W = {
        'sword': lambda x, y: (c.l([(x, y - 7), (x, y - 1)], STEEL), c.r(x - 1, y, x + 1, y, GOLD), c.px(x, y + 1, WOOD)),
        'runesword': lambda x, y: (c.l([(x, y - 7), (x, y - 1)], GLOW), c.r(x - 1, y, x + 1, y, ACC), c.px(x, y + 1, WOOD)),
        'katana': lambda x, y: (c.l([(x, y - 8), (x + 1, y - 1)], STEEL), c.r(x - 1, y, x + 1, y, DARK), c.px(x, y + 1, ACC)),
        'greatsword': lambda x, y: (c.r(x, y - 9, x + 1, y - 1, STEEL), c.r(x - 1, y, x + 2, y, DARK), c.px(x, y + 1, WOOD)),
        'axe': lambda x, y: (c.l([(x, y - 6), (x, y + 2)], WOOD), c.p([(x, y - 6), (x + 3, y - 7), (x + 3, y - 3), (x, y - 4)], STEEL)),
        'mace': lambda x, y: (c.l([(x, y - 4), (x, y + 2)], WOOD), c.e(x - 1, y - 7, x + 1, y - 4, STEEL)),
        'spear': lambda x, y: (c.l([(x, y - 10), (x, y + 3)], WOOD), c.p([(x, y - 13), (x + 1, y - 10), (x - 1, y - 10)], STEEL)),
        'staff': lambda x, y: (c.l([(x, y - 9), (x, y + 3)], WOOD), c.e(x - 1, y - 11, x + 1, y - 9, ACC)),
        'orbstaff': lambda x, y: (c.l([(x, y - 8), (x, y + 3)], WOOD), c.e(x - 1, y - 11, x + 1, y - 8, GLOW)),
        'skullstaff': lambda x, y: (c.l([(x, y - 8), (x, y + 3)], WOOD), c.e(x - 1, y - 11, x + 1, y - 8, BONE), c.px(x, y - 9, DARK)),
        'orb': lambda x, y: (c.e(x - 1, y - 3, x + 1, y - 1, GLOW), c.px(x, y - 3, SHINE)),
        'book': lambda x, y: (c.r(x - 1, y - 3, x + 1, y, ACC), c.l([(x - 1, y - 3), (x - 1, y)], GOLD)),
        'bow': lambda x, y: (c.d.arc([x - 2, y - 8, x + 2, y + 2], 270, 90, fill=WOOD), c.l([(x, y - 7), (x, y + 1)], BONE)),
        'daggers': lambda x, y: (c.l([(x, y - 3), (x, y - 1)], STEEL), c.px(x, y, DARK)),
        'twinswords': lambda x, y: (c.l([(x, y - 5), (x, y - 1)], STEEL), c.px(x, y, GOLD)),
        'claws': lambda x, y: (c.px(x, y - 1, BONE), c.px(x + 1, y - 2, BONE), c.px(x - 1, y - 2, BONE)),
        'lute': lambda x, y: (c.e(x - 2, y - 3, x + 1, y, WOOD), c.l([(x + 1, y - 2), (x + 2, y - 6)], WOOD), c.px(x - 1, y - 2, DARK)),
        'whip': lambda x, y: (c.l([(x, y - 1), (x, y + 1)], WOOD), c.l([(x, y + 1), (x + 2, y + 3)], WOOD)),
        'strings': lambda x, y: (c.l([(x - 1, y - 6), (x + 1, y - 6)], WOOD), c.l([(x - 1, y - 6), (x - 1, y)], WHITE), c.l([(x + 1, y - 6), (x + 1, y)], WHITE)),
        'none': lambda x, y: None,
    }
    hand_y = 11 - (1 - f) if front else 11
    if front:
        W[weapon](12, hand_y)
        if weapon in ('daggers', 'twinswords'): W[weapon](3, 11 - f)
        if extra == 'shield': c.e(1, 8 - f, 5, 13 - f, ACC); c.e(2, 9 - f, 4, 12 - f, STEEL); c.px(3, 10 - f, GOLD)
    elif side:
        sw = 1 if f else -1
        if weapon != 'none': W[weapon](min(13, 9 + sw + 1), 11)
        if extra == 'shield': c.e(2, 8, 5, 13, ACC); c.px(3, 10, GOLD)
    else:
        if weapon not in ('none', 'orb', 'book', 'claws', 'daggers', 'whip', 'strings'):
            W[weapon](3, 11 - f)
        if extra == 'shield': c.e(10, 8, 14, 13, ACC); c.e(11, 9, 13, 12, STEEL)
    return c


def hero_palette(job):
    body, acc, build, head, weapon, extra, hair, skin = JOBS[job]
    return {BODY: body, ACC: acc, STONE: HAIR[hair], SKIN: SKINS[skin]}


# ============================================================== town buildings (32 x 32)
# kind: wall, roof, trim, sign
BUILDINGS = {
    'inn':    ((214, 196, 160), (170, 64, 48), (110, 70, 40), 'bed'),
    'store':  ((206, 186, 150), (60, 120, 170), (110, 70, 40), 'bag'),
    'smithy': ((140, 132, 124), (90, 84, 92), (60, 56, 64), 'anvil'),
    'stable': ((168, 112, 64), (150, 70, 46), (110, 70, 40), 'shoe'),
    'post':   ((220, 210, 180), (60, 90, 160), (110, 70, 40), 'letter'),
    'bank':   ((226, 222, 210), (90, 96, 120), (150, 120, 60), 'coin'),
    'house0': ((214, 196, 160), (160, 70, 50), (110, 70, 40), None),
    'house1': ((196, 176, 140), (70, 110, 70), (110, 70, 40), None),
    'house2': ((200, 200, 196), (80, 80, 150), (110, 70, 40), None),
    'house3': ((176, 140, 100), (150, 120, 60), (90, 60, 34), None),
}


def building(kind):
    c = C(32, 32)
    if kind == 'shrine':
        c.r(6, 26, 25, 30, STONE)                                      # steps
        c.r(8, 12, 23, 26, BODY)                                       # walls
        c.p([(4, 13), (16, 3), (27, 13)], ACC)                         # roof
        c.r(9, 14, 10, 25, STONE); c.r(21, 14, 22, 25, STONE)          # pillars
        c.r(13, 17, 18, 26, DARK); c.e(14, 19, 17, 22, GLOW)           # altar glow in the doorway
        c.r(15, 4, 16, 8, GOLD); c.r(13, 5, 18, 6, GOLD)                # emblem
        return c, {BODY: (226, 222, 210), ACC: (110, 120, 170), STONE: (170, 166, 160)}
    if kind == 'mill':
        c.p([(9, 31), (11, 10), (20, 10), (22, 31)], BODY)             # tower
        c.p([(9, 11), (15, 4), (22, 11)], ACC)                          # cap
        c.r(13, 24, 18, 31, WOOD); c.r(14, 15, 17, 18, DARK)            # door, window
        for (x0, y0, x1, y1) in [(15, 9, 3, -1), (16, 9, 28, -1), (15, 10, 3, 21), (16, 10, 28, 21)]:
            c.l([(x0, y0), (x1, y1)], WOOD, w=2)                        # sails
        c.e(14, 8, 17, 11, STEEL)
        return c, {BODY: (226, 214, 180), ACC: (170, 64, 48)}
    wall, roof, trim, sign = BUILDINGS[kind]
    big = kind in ('inn', 'bank', 'store')
    x0, x1 = (2, 29) if big else (4, 27)
    c.r(x0, 15, x1, 31, BODY)                                           # walls
    c.p([(x0 - 2, 16), (16, 3 if big else 6), (x1 + 2, 16)], ACC)       # roof
    c.r(x0 - 2, 15, x1 + 2, 16, ACC)
    c.l([(x0 - 2, 16), (16, 3 if big else 6)], WOOD); c.l([(16, 3 if big else 6), (x1 + 2, 16)], WOOD)
    if kind == 'bank':
        c.r(x0, 15, x1, 17, STONE)
        for px_ in (5, 11, 20, 26): c.r(px_, 18, px_ + 1, 31, STONE)   # columns
    if kind == 'smithy':
        c.r(22, 1, 25, 9, STONE); c.e(21, -2, 26, 2, BONE)             # chimney and smoke
        c.r(5, 22, 10, 26, HOT)                                          # forge glow
    if kind == 'stable':
        c.r(5, 21, 26, 21, WOOD); c.r(5, 25, 26, 25, WOOD)              # fence rails
    c.r(13, 22, 18, 31, WOOD); c.r(13, 22, 18, 22, DARK); c.px(17, 27, GOLD)     # door
    if kind not in ('smithy', 'stable', 'bank'):
        c.r(5, 20, 9, 24, GLOW); c.l([(7, 20), (7, 24)], WOOD)          # windows
        c.r(22, 20, 26, 24, GLOW); c.l([(24, 20), (24, 24)], WOOD)
    if kind == 'house3':
        c.r(20, 6, 22, 11, STONE)
    if sign:
        c.r(20, 17, 27, 19, WOOD) if kind == 'smithy' else None
        sx, sy = (21, 25) if kind in ('smithy', 'stable', 'bank') else (12, 16)
        c.r(sx, sy, sx + 7, sy + 5, WOOD); c.r(sx + 1, sy + 1, sx + 6, sy + 4, BONE)
        icon = {'bed': lambda: (c.r(sx + 2, sy + 3, sx + 5, sy + 3, MOUTH), c.px(sx + 2, sy + 2, WHITE)),
                'bag': lambda: c.e(sx + 2, sy + 1, sx + 5, sy + 4, WOOD),
                'anvil': lambda: (c.r(sx + 2, sy + 2, sx + 5, sy + 2, DARK), c.r(sx + 3, sy + 3, sx + 4, sy + 4, DARK)),
                'shoe': lambda: c.d.arc([sx + 2, sy + 1, sx + 5, sy + 5], 180, 360, fill=DARK),
                'letter': lambda: (c.r(sx + 2, sy + 2, sx + 5, sy + 4, WHITE), c.l([(sx + 2, sy + 2), (sx + 3, sy + 3), (sx + 5, sy + 2)], DARK)),
                'coin': lambda: c.e(sx + 2, sy + 1, sx + 5, sy + 4, GOLD)}[sign]
        icon()
    return c, {BODY: wall, ACC: roof, STONE: (176, 172, 166), WOOD: trim}


BUILDING_KINDS = list(BUILDINGS) + ['shrine', 'mill']


# ============================================================== output
def build(out=OUT):
    out.mkdir(exist_ok=True)
    n = 0
    for job in JOBS:
        for d in DIRS:
            for f in (0, 1):
                shade(hero(job, d, f), hero_palette(job), rim=1).save(out / f'r8h_{job}_{d}{f}.png'); n += 1
    for kind in BUILDING_KINDS:
        c, pal = building(kind)
        shade(c, pal, rim=1).save(out / f'r8bld_{kind}.png'); n += 1
    return n


def contact_sheet(path, scale=4):
    jobs = list(JOBS)
    cell = 18
    sheet = Image.new('RGBA', (6 * cell * 3 + 8, (len(jobs) + 1) // 3 * cell + 4 + 2 * 34), (52, 60, 52, 255))
    for i, job in enumerate(jobs):
        col, row = i % 3, i // 3
        for k, (d, f) in enumerate([(d, f) for d in DIRS for f in (0, 1)]):
            im = shade(hero(job, d, f), hero_palette(job), rim=1)
            sheet.alpha_composite(im, (col * (6 * cell + 4) + k * cell + 1, row * cell + 1))
    y = (len(jobs) + 2) // 3 * cell + 4
    for i, kind in enumerate(BUILDING_KINDS):
        c, pal = building(kind)
        sheet.alpha_composite(shade(c, pal, rim=1), ((i % 9) * 36 + 1, y + (i // 9) * 34))
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST).save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--no-write', action='store_true')
    a = ap.parse_args()
    if not a.no_write:
        print(f'wrote {build()} sprites')
    if a.sheet:
        contact_sheet(a.sheet)
