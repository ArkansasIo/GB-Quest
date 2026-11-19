#!/usr/bin/env python3
"""NES CLASSIC tiles: original overworld and dungeon tiles in the style of 1980s NES role-playing games.

Every tile is laid out pixel by pixel below (no third-party art is read or copied) and drawn only with colours from
the NES console's 64-colour palette. Like the real hardware's background tiles, each tile uses at most four colours,
which the generator checks. Flat colour, hard black outlines, no gradients.

  assets/gt_n8<group>_<key>.png  16x16  8 overworld palettes x 75 tiles (the same keys as the RETRO 8-BIT set:
                                        grass, trees, mountains, 16 water edges x 2 frames, 16 road joins, towns...)
  assets/gd_n8<theme>_<key>.png  16x16  6 dungeon themes x 26 tiles (floors, walls, stairs, doors, chests, torches...)

    python tools/gen_nes8.py               # writes the PNGs
    python tools/gen_nes8.py --sheet X     # also writes a contact sheet to X
"""
import argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets'

# ------------------------------------------------------------------ the NES palette (common 2C02 approximation)
NES = {
    0x00: (84, 84, 84), 0x01: (0, 30, 116), 0x02: (8, 16, 144), 0x03: (48, 0, 136), 0x04: (68, 0, 100), 0x05: (92, 0, 48),
    0x06: (84, 4, 0), 0x07: (60, 24, 0), 0x08: (32, 42, 0), 0x09: (8, 58, 0), 0x0A: (0, 64, 0), 0x0B: (0, 60, 0),
    0x0C: (0, 50, 60), 0x0F: (0, 0, 0),
    0x10: (152, 150, 152), 0x11: (8, 76, 196), 0x12: (48, 50, 236), 0x13: (92, 30, 228), 0x14: (136, 20, 176),
    0x15: (160, 20, 100), 0x16: (152, 34, 32), 0x17: (120, 60, 0), 0x18: (84, 90, 0), 0x19: (40, 114, 0),
    0x1A: (8, 124, 0), 0x1B: (0, 118, 40), 0x1C: (0, 102, 120),
    0x20: (236, 238, 236), 0x21: (76, 154, 236), 0x22: (120, 124, 236), 0x23: (176, 98, 236), 0x24: (228, 84, 236),
    0x25: (236, 88, 180), 0x26: (236, 106, 100), 0x27: (212, 136, 32), 0x28: (160, 170, 0), 0x29: (116, 196, 0),
    0x2A: (76, 208, 32), 0x2B: (56, 204, 108), 0x2C: (56, 180, 204),
    0x30: (236, 238, 236), 0x31: (168, 204, 236), 0x32: (188, 188, 236), 0x33: (212, 178, 236), 0x34: (236, 174, 236),
    0x35: (236, 174, 212), 0x36: (236, 180, 176), 0x37: (228, 196, 144), 0x38: (204, 210, 120), 0x39: (180, 222, 120),
    0x3A: (168, 226, 144), 0x3B: (152, 226, 180), 0x3C: (160, 214, 228),
}
NES_RGB = set(NES.values())
K = 0x0F  # black, the outline colour

# ------------------------------------------------------------------ overworld palettes (NES colour numbers)
# g/G ground and its marks, f flowers, dirt/dirtd roads, sand/sandd, L/D leaves, M/m mountain and its lit side,
# w/W/wd/foam water, wood, stone/stoned/stonel masonry, roof, wallc house walls
def pal(**kw):
    base = dict(g=0x2A, G=0x1A, f=0x30, dirt=0x27, dirtd=0x17, sand=0x37, sandd=0x27, L=0x1A, D=0x0A, M=0x17, m=0x27,
                w=0x12, W=0x21, wd=0x02, foam=0x20, wood=0x17, stone=0x10, stoned=0x00, stonel=0x20, roof=0x16, wallc=0x37)
    base.update(kw)
    return base


GROUPS = {
    'green':  pal(),
    'sand':   pal(g=0x37, G=0x27, f=0x16, dirt=0x17, dirtd=0x07, L=0x29, D=0x19, wood=0x07, wallc=0x20),
    'snow':   pal(g=0x20, G=0x31, f=0x21, dirt=0x10, dirtd=0x00, sand=0x31, sandd=0x21, L=0x1B, D=0x0B, M=0x00, m=0x10,
                  w=0x11, W=0x31, wd=0x01, foam=0x20, roof=0x11, wallc=0x10),
    'swamp':  pal(g=0x18, G=0x08, f=0x28, sand=0x28, sandd=0x18, L=0x19, D=0x09, M=0x07, m=0x17, w=0x1B, W=0x2B, wd=0x0B,
                  foam=0x3B, wood=0x07, roof=0x15),
    'lava':   pal(g=0x07, G=0x17, f=0x16, dirt=0x27, dirtd=0x17, sand=0x17, sandd=0x27, L=0x17, D=0x06, M=0x00, m=0x10,
                  w=0x16, W=0x27, wd=0x06, foam=0x38, wood=0x17, roof=0x06, wallc=0x10),
    'mystic': pal(g=0x23, G=0x13, f=0x34, dirt=0x33, dirtd=0x13, sand=0x33, sandd=0x23, L=0x2C, D=0x1C, M=0x03, m=0x13,
                  w=0x14, W=0x24, wd=0x04, foam=0x34, wood=0x03, roof=0x14, wallc=0x33),
    'dark':   pal(g=0x04, G=0x14, f=0x24, dirt=0x10, dirtd=0x00, sand=0x10, sandd=0x00, L=0x15, D=0x05, M=0x00, m=0x10,
                  w=0x02, W=0x12, wd=0x01, foam=0x22, wood=0x07, roof=0x05, wallc=0x10),
    'jungle': pal(g=0x1A, G=0x0A, f=0x26, dirt=0x17, dirtd=0x07, L=0x2A, D=0x0A, w=0x1C, W=0x2C, wd=0x0C, foam=0x3C),
}
# which group each biome uses in NES CLASSIC (anything not listed is 'green'); mirrored in src/art.js NES_TILE_GROUP
BIOME_GROUP = {'desert': 'sand', 'badlands': 'sand', 'savanna': 'sand', 'oasis': 'sand', 'snow': 'snow', 'frozen': 'snow',
               'marsh': 'swamp', 'mushroom': 'swamp', 'volcanic': 'lava', 'crystal': 'mystic', 'aether': 'mystic',
               'sky': 'mystic', 'dusk': 'dark', 'corruption': 'dark', 'ruins': 'dark', 'jungle': 'jungle',
               'deepforest': 'jungle'}

# dungeon palettes: f floor, fd floor shadow / mortar, fl highlight, acc accent (doors, cloth, gold), liq/liql pools,
# fire/firel flames, bone
def dpal(**kw):
    base = dict(f=0x10, fd=0x00, fl=0x20, acc=0x27, liq=0x11, liql=0x21, fire=0x16, firel=0x27, bone=0x20, wood=0x17)
    base.update(kw)
    return base


THEMES = {
    'dungeon': dpal(),
    'crypt':   dpal(f=0x1C, fd=0x0C, fl=0x3C, acc=0x14, liq=0x1B, liql=0x2B, wood=0x0C),
    'ice':     dpal(f=0x21, fd=0x11, fl=0x31, acc=0x12, liq=0x12, liql=0x31, wood=0x11, bone=0x31),
    'lava':    dpal(f=0x17, fd=0x07, fl=0x27, acc=0x16, liq=0x16, liql=0x27, fire=0x16, firel=0x38, wood=0x07, bone=0x37),
    'temple':  dpal(f=0x37, fd=0x17, fl=0x20, acc=0x1A, liq=0x11, liql=0x21, wood=0x17, bone=0x20),
    'void':    dpal(f=0x13, fd=0x03, fl=0x23, acc=0x24, liq=0x14, liql=0x24, fire=0x24, firel=0x34, wood=0x03, bone=0x33),
}


# ------------------------------------------------------------------ a tiny tile painter
class Tile:
    def __init__(self, pal):
        self.P, self.im = pal, Image.new('RGB', (16, 16))

    def c(self, k):
        return NES[self.P[k] if isinstance(k, str) else k]

    def fill(self, k):
        self.im.paste(self.c(k), (0, 0, 16, 16))

    def rect(self, x0, y0, x1, y1, k):
        col = self.c(k)
        for y in range(max(0, y0), min(15, y1) + 1):
            for x in range(max(0, x0), min(15, x1) + 1):
                self.im.putpixel((x, y), col)

    def px(self, x, y, k):
        if 0 <= x < 16 and 0 <= y < 16:
            self.im.putpixel((x, y), self.c(k))

    def art(self, rows, keys, ox=0, oy=0, tile=False):
        """stamp a pixel pattern; '.' is see-through; tile=True repeats it across the 16x16 tile"""
        h, w = len(rows), len(rows[0])
        assert all(len(r) == w for r in rows), rows
        spots = [(ox + i * w, oy + j * h) for j in range(16 // h) for i in range(16 // w)] if tile else [(ox, oy)]
        for sx, sy in spots:
            for y, row in enumerate(rows):
                for x, ch in enumerate(row):
                    if ch != '.':
                        self.px(sx + x, sy + y, keys[ch])

    def done(self):
        cols = set(self.im.get_flattened_data()) if hasattr(self.im, 'get_flattened_data') else set(self.im.getdata())
        assert len(cols) <= 4, f'{len(cols)} colours'
        assert cols <= NES_RGB
        return self.im


# ------------------------------------------------------------------ overworld art
GRASS = ['........', '..x.....', '.x.x....', '........', '......x.', '.....x.x', '........', '........']
FLOWERS = ['........', '..x.....', '.x.x..o.', '........', '.o....x.', '.....x.x', '........', '...o....']
GROUND = ['........', '.x......', '........', '....x...', '........', '......x.', '..x.....', '........']
SAND = ['........', '........', '.xx.....', 'x..x....', '........', '........', '.....xx.', '....x..x']
SAND2 = ['........', '...xxx..', '..x...x.', '........', '........', 'xx......', '..x....x', '........']
TREE = [
    '................',
    '......KKKK......',
    '....KKLLLLKK....',
    '...KLLLLLLLLK...',
    '..KLLLLLLLDLLK..',
    '..KLLDLLLLLLLK..',
    '.KLLLLLLLDLLLLK.',
    '.KLLLLDLLLLLDLK.',
    '.KLDLLLLLLLLLDK.',
    '..KLLLLDLLLDLK..',
    '..KDLLLLLLLDDK..',
    '...KDDLLLDDDK...',
    '....KKDDDDKK....',
    '......KDDK......',
    '......KDDK......',
    '.....KKKKKK.....',
]
PINE = [
    '.......KK.......',
    '......KLLK......',
    '......KLDK......',
    '.....KLLLDK.....',
    '.....KLLLLK.....',
    '....KLLLLLDK....',
    '....KLLDLLLK....',
    '...KLLLLLLLDK...',
    '...KLLLLDLLLK...',
    '..KLLDLLLLLLDK..',
    '..KLLLLLLLDLLK..',
    '.KLLLLLDLLLLLDK.',
    '.KKKKKKKKKKKKKK.',
    '......KDDK......',
    '......KDDK......',
    '......KKKK......',
]
BUSH = ['..KKKK..', '.KLLLLK.', 'KLLDLLLK', 'KLLLLDLK', '.KDLLDK.', '..KDDK..', '...KK...', '........']
ROCK = [
    '................',
    '................',
    '................',
    '................',
    '.....KKKKKK.....',
    '....KmmmMMMK....',
    '...KmmMMMMMMK...',
    '..KmMMMMMMMMMK..',
    '..KMMMMMMKMMMK..',
    '..KMMMMMMMMMMK..',
    '..KmMMMKMMMMMK..',
    '...KMMMMMMMMK...',
    '....KKKKKKKK....',
    '................',
    '................',
    '................',
]
PEAK = [
    '................',
    '.......KK.......',
    '......KmmK......',
    '.....KmmMMK.....',
    '.....KmMMMK.....',
    '....KmmMMMMK....',
    '....KmMMKMMK....',
    '...KmmMMMKMMK...',
    '...KmMMMMMMMK...',
    '..KmmMMKMMMMMK..',
    '..KmMMMMKMMMMK..',
    '.KmmMMMMMMMKMMK.',
    '.KmMMMMMMMMMMMK.',
    'KmMMMMKMMMMMMMMK',
    'KMMMMMMMMMMMMMMK',
    'KKKKKKKKKKKKKKKK',
]
WAVES = [['........', '........', '.xx.....', 'x..x....', '........', '........', '.....xx.', '....x..x'],
         ['........', '........', '...xx...', '..x..x..', '........', '........', 'x.....xx', '.x....x.']]


def grass(t, flowers=False):
    t.fill('g')
    t.art(FLOWERS if flowers else GRASS, {'x': 'G', 'o': 'f'}, tile=True)


def water(t, mask, f, deep=False):
    t.fill('wd' if deep else 'w')
    t.art(WAVES[f], {'x': 'W'}, tile=True)
    shore = 'dirt' if t.P is GROUPS['lava'] else 'g'
    for bit, band, foam in ((1, (0, 0, 15, 1), (0, 2, 15, 2)), (2, (14, 0, 15, 15), (13, 0, 13, 15)),
                            (4, (0, 14, 15, 15), (0, 13, 15, 13)), (8, (0, 0, 1, 15), (2, 0, 2, 15))):
        if mask & bit:
            t.rect(*foam, 'foam')
    for bit, band in ((1, (0, 0, 15, 1)), (2, (14, 0, 15, 15)), (4, (0, 14, 15, 15)), (8, (0, 0, 1, 15))):
        if mask & bit:
            t.rect(*band, shore)


def road(t, mask):
    t.fill('g')
    t.art(GRASS, {'x': 'G'}, tile=True)
    t.rect(4, 4, 11, 11, 'dirt')
    for bit, box in ((1, (4, 0, 11, 4)), (2, (11, 4, 15, 11)), (4, (4, 11, 11, 15)), (8, (0, 4, 4, 11))):
        if mask & bit:
            t.rect(*box, 'dirt')
    for (x, y) in ((5, 6), (9, 9), (7, 2), (13, 7), (2, 8), (8, 13)):
        if t.im.getpixel((x, y)) == t.c('dirt'):
            t.px(x, y, 'dirtd')


def bridge(t, f):
    t.fill('w')
    t.art(WAVES[f], {'x': 'W'}, tile=True)
    t.rect(2, 0, 13, 15, 'wood')
    for y in (0, 4, 8, 12):
        t.rect(2, y, 13, y, K)
    t.rect(2, 0, 2, 15, K); t.rect(13, 0, 13, 15, K)


def mound(t, rows):
    t.fill('g')
    t.art(rows, {'K': K, 'M': 'M', 'm': 'm'})


def trees(t, rows):
    t.fill('g')
    t.art(rows, {'K': K, 'L': 'L', 'D': 'D'})


def dense(t):
    t.fill('g')
    t.art(BUSH, {'K': K, 'L': 'L', 'D': 'D'}, tile=True)


def masonry(t, light=True):
    t.fill('stone')
    for y in (3, 7, 11, 15):
        t.rect(0, y, 15, y, 'stoned')
    for row, y0 in enumerate((0, 4, 8, 12)):
        for x in ((3, 11) if row % 2 == 0 else (7, 15)):
            t.rect(x, y0, x, y0 + 2, 'stoned')
    if light:
        for row, y0 in enumerate((0, 4, 8, 12)):
            t.rect(0 if row % 2 else 4, y0, 0 if row % 2 else 4, y0, 'stonel')


def cobble(t):
    t.fill('stone')
    t.art(['xxx.xxxx', '...x....', 'xxxxx.xx', '.....x..'], {'x': 'stoned'}, tile=True)
    for x, y in ((1, 1), (9, 5), (5, 9), (13, 13)):
        t.px(x, y, 'stonel')


def house(t, kind='house'):
    t.fill('g')
    t.art([
        '.......KK.......',
        '......KRRK......',
        '.....KRRRRK.....',
        '....KRRRRRRK....',
        '...KRRRRRRRRK...',
        '..KRRRRRRRRRRK..',
        '.KKKKKKKKKKKKKK.',
        '..KwwwwwwwwwwK..',
        '..KwKKwwwwKKwK..',
        '..KwKKwwwwKKwK..',
        '..KwwwwKKwwwwK..',
        '..KwwwwKKwwwwK..',
        '..KwwwwKKwwwwK..',
        '..KKKKKKKKKKKK..',
        '................',
        '................'], {'K': K, 'R': 'roof', 'w': 'wallc'})
    if kind == 'inn':  # a hanging sign with a bed
        t.art(['KKKKK', 'KwwwK', 'KKKwK', 'KKKKK'], {'K': K, 'w': 'wallc'}, 11, 10)
    if kind == 'shop':  # a pot over the door
        t.art(['.KKK.', 'KRRRK', 'KRRRK', '.KKK.'], {'K': K, 'R': 'roof'}, 0, 9)


def keep(t, door=False):
    t.fill('g')
    t.art([
        '.KKK..KKKK..KKK.',
        '.KsK..KssK..KsK.',
        '.KsKKKKssKKKKsK.',
        '.KssssssssssssK.',
        '.KsdsssssssssdK.',
        '.KssssssssssssK.',
        '.KsssdssssdsssK.',
        '.KssssssssssssK.',
        '.KsdsssssssssdK.',
        '.KssssssssssssK.',
        '.KsssdssssdsssK.',
        '.KssssssssssssK.',
        '.KsdsssssssssdK.',
        '.KssssssssssssK.',
        '.KssssssssssssK.',
        '.KKKKKKKKKKKKKK.'], {'K': K, 's': 'stone', 'd': 'stoned'})
    if door:
        t.art(['.KKKK.', 'KKKKKK', 'KKKKKK', 'KKKKKK', 'KKKKKK'], {'K': K}, 5, 10)
    else:
        t.art(['KK', 'KK'], {'K': K}, 7, 5)


def gate(t):
    masonry(t, light=False)
    t.art([
        '....KKKKKK......',
        '...KKKKKKKK.....',
        '..KKKKKKKKKK....',
        '..KKKKKKKKKK....'], {'K': K}, 2, 4)
    t.rect(4, 8, 13, 15, K)


def statue(t):
    t.fill('g')
    t.art([
        '......KKKK......',
        '.....KssssK.....',
        '.....KsKsKK.....',
        '.....KssssK.....',
        '......KssK......',
        '....KKssssKK....',
        '...KssKssKssK...',
        '...KsK.ss.KsK...',
        '...KsK.ss.KsK...',
        '......KssK......',
        '.....KsKKsK.....',
        '.....KsK.KsK....',
        '...KKKKKKKKKK...',
        '...KddddddddK...',
        '...KKKKKKKKKK...',
        '................'], {'K': K, 's': 'stonel', 'd': 'stone'})


def shrine(t):
    t.fill('g')
    t.art([
        '.......KK.......',
        '......KssK......',
        '......KsdK......',
        '.....KsssdK.....',
        '.....KsKKdK.....',
        '.....KsKKdK.....',
        '.....KssssK.....',
        '.....KsssdK.....',
        '.....KsssdK.....',
        '.....KsssdK.....',
        '....KKKKKKKK....',
        '...KssssssddK...',
        '..KKKKKKKKKKKK..',
        '..KsssssssdddK..',
        '..KKKKKKKKKKKK..',
        '................'], {'K': K, 's': 'stonel', 'd': 'stone'})


def temple(t):
    t.fill('g')
    t.art([
        '.......KK.......',
        '.....KKllKK.....',
        '...KKllllllKK...',
        '.KKllllllllllKK.',
        'KKKKKKKKKKKKKKKK',
        '.KllKKllKKllKKl.',
        '.KlsK.KlsK.KlsK.',
        '.KlsK.KlsK.KlsK.',
        '.KlsK.KlsK.KlsK.',
        '.KlsK.KlsK.KlsK.',
        '.KlsK.KlsK.KlsK.',
        '.KlsK.KlsK.KlsK.',
        'KKKKKKKKKKKKKKKK',
        'KllllllllllllllK',
        'KKKKKKKKKKKKKKKK',
        '................'], {'K': K, 'l': 'stonel', 's': 'stone'})


def arena(t):
    t.fill('g')
    t.art([
        '.....KKKKKK.....',
        '...KKddddddKK...',
        '..KddKKKKKKddK..',
        '.KdKKddddddKKdK.',
        '.KdKddddddddKdK.',
        'KdKddddddddddKdK',
        'KdKddddddddddKdK',
        'KdKddddddddddKdK',
        'KdKddddddddddKdK',
        'KdKddddddddddKdK',
        'KdKddddddddddKdK',
        '.KdKddddddddKdK.',
        '.KdKKddddddKKdK.',
        '..KddKKKKKKddK..',
        '...KKddddddKK...',
        '.....KKKKKK.....'], {'K': K, 'd': 'dirt'})


def wall(t):
    masonry(t)
    t.rect(0, 0, 15, 0, K)


TILE_KEYS = {
    'grass': lambda t: grass(t), 'meadow': lambda t: grass(t, True),
    'ground': lambda t: (t.fill('dirt'), t.art(GROUND, {'x': 'dirtd'}, tile=True)),
    'sand': lambda t: (t.fill('sand'), t.art(SAND, {'x': 'sandd'}, tile=True)),
    'sand2': lambda t: (t.fill('sand'), t.art(SAND2, {'x': 'sandd'}, tile=True)),
    'cobble': cobble, 'tree': lambda t: trees(t, TREE), 'pine': lambda t: trees(t, PINE), 'dense': dense,
    'single': lambda t: (t.fill('g'), t.art(BUSH, {'K': K, 'L': 'L', 'D': 'D'}, 4, 6)),
    'rock': lambda t: mound(t, ROCK), 'peak': lambda t: mound(t, PEAK),
    'wall': wall, 'gate': gate, 'keep': lambda t: keep(t), 'keepdoor': lambda t: keep(t, True),
    'house': lambda t: house(t), 'shop': lambda t: house(t, 'shop'), 'inn': lambda t: house(t, 'inn'),
    'shrine': shrine, 'statue': statue, 'temple': temple, 'arena': arena,
}
for _f in (0, 1):
    TILE_KEYS[f'deep{_f}'] = (lambda f: lambda t: water(t, 0, f, deep=True))(_f)
    TILE_KEYS[f'bridge{_f}'] = (lambda f: lambda t: bridge(t, f))(_f)
    for _m in range(16):
        TILE_KEYS[f'water{_m}_{_f}'] = (lambda m, f: lambda t: water(t, m, f))(_m, _f)
for _m in range(16):
    TILE_KEYS[f'road{_m}'] = (lambda m: lambda t: road(t, m))(_m)


def world_tile(group, key):
    t = Tile(GROUPS[group])
    TILE_KEYS[key](t)
    return t.done()


# ------------------------------------------------------------------ dungeon art
def floor(t, cracks=False, lit=True):
    """lit=False leaves out the highlight, so a prop drawn on top can use its own colour and stay within four"""
    t.fill('f')
    t.art(['xxxxxxxx', 'x.......', 'x.......', 'x.......', 'x.......', 'x.......', 'x.......', 'x.......'], {'x': 'fd'}, tile=True)
    for x, y in ((1, 1), (9, 9)) if lit else ():
        t.px(x, y, 'fl')
    if cracks:
        t.art(['x...', '.x..', '.xx.', '...x'], {'x': 'fd'}, 3, 3)
        t.art(['.x..', 'x...', 'x...'], {'x': 'fd'}, 11, 11)


def brick(t, lit=True):
    t.fill('f')
    for y in (3, 7, 11, 15):
        t.rect(0, y, 15, y, 'fd')
    for row, y0 in enumerate((0, 4, 8, 12)):
        for x in ((3, 11) if row % 2 == 0 else (7, 15)):
            t.rect(x, y0, x, y0 + 2, 'fd')
        if lit:
            t.rect(0 if row % 2 else 4, y0, 0 if row % 2 else 4, y0, 'fl')


def stairs(t, down):
    t.fill('f')
    if down:
        t.art(['KKKKKKKKKKKKKKKK', 'KllllllllllllllK', 'KKKKKKKKKKKKKKKK', '.KdddddddddddK..', '.KKKKKKKKKKKKKK.',
               '..KdddddddddK...', '..KKKKKKKKKKK...', '...KKKKKKKKK....'], {'K': K, 'l': 'fl', 'd': 'fd'}, 0, 4)
    else:
        t.art(['......KKKK......', '.....KllllK.....', '.....KKKKKK.....', '....KllllllK....', '....KKKKKKKK....',
               '...KllllllllK...', '...KKKKKKKKKK...', '..KllllllllllK..', '..KKKKKKKKKKKK..', '.KllllllllllllK.',
               '.KKKKKKKKKKKKKK.', 'KddddddddddddddK', 'KKKKKKKKKKKKKKKK'], {'K': K, 'l': 'fl', 'd': 'fd'}, 0, 2)


def door(t):
    brick(t, lit=False)
    t.art([
        '...KKKKKKKK.....',
        '..KaaaaaaaaK....',
        '.KaaKaaKaaaaK...',
        '.KaaKaaKaaaaK...',
        '.KaaKaaKaaaaK...',
        '.KaaKaaKaaaaK...',
        '.KaaKaaKaaKaK...',
        '.KaaKaaKaaaaK...',
        '.KaaKaaKaaaaK...',
        '.KaaKaaKaaaaK...',
        '.KaaKaaKaaaaK...',
        '.KKKKKKKKKKKK...'], {'K': K, 'a': 'acc'}, 2, 4)


def chest(t):
    floor(t, lit=False)
    t.art([
        '..KKKKKKKKKKKK..',
        '.KaaaaaaaaaaaaK.',
        '.KaaaaaaaaaaaaK.',
        '.KKKKKKKKKKKKKK.',
        '.KaaaaaKKaaaaaK.',
        '.KaaaaaKKaaaaaK.',
        '.KaaaaaaaaaaaaK.',
        '.KKKKKKKKKKKKKK.'], {'K': K, 'a': 'acc'}, 0, 5)


def torch(t, f):
    brick(t, lit=False)
    t.art(['..x..', '.xx..', '.xxx.', 'xxxxx', '.xxx.'] if f == 0 else ['...x.', '..xx.', '.xxx.', 'xxxxx', '.xxx.'],
          {'x': 'fire'}, 6, 2)
    t.art(['.KKK.', '..K..', '..K..', '..K..', '.KKK.'], {'K': K}, 6, 7)


def brazier(t, f):
    floor(t, lit=False)
    t.art(['....x.x.....', '...xxxxx....', '..xxxxxx....', '..xxxxxxx...'] if f == 0 else
          ['...x...x....', '...xx.xx....', '..xxxxxx....', '..xxxxxxx...'], {'x': 'fire'}, 3, 1)
    t.art(['.KKKKKKKKKK.', 'KKKKKKKKKKKK', '.KKKKKKKKKK.', '....KKKK....', '....KKKK....', '...KKKKKK...',
           '..KKKKKKKK..'], {'K': K}, 2, 5)


def pool(t, f):
    t.fill('f')
    t.art(['..KKKKKKKKKKKK..', '.KllllllllllllK.', 'KlllllllllllllllK'[:16]], {'K': K, 'l': 'liq'}, 0, 1)
    t.rect(1, 3, 14, 13, 'liq'); t.rect(0, 3, 0, 13, K); t.rect(15, 3, 15, 13, K)
    t.art(['.KKKKKKKKKKKKKK.', '..KKKKKKKKKKKK..'], {'K': K}, 0, 14)
    for x, y in ((3, 5), (9, 9), (5, 11)) if f == 0 else ((6, 5), (11, 8), (3, 10)):
        t.rect(x, y, x + 2, y, 'liql')


def dprop(rows, keys, base=floor):
    def draw(t):
        base(t, lit=False)
        t.art(rows, keys)
    return draw


D_KEYS = {
    'floor': floor, 'floor2': lambda t: floor(t, True), 'wall': brick,
    'walltop': lambda t: (t.fill(K), t.art(['........', '.x......', '........', '.....x..'], {'x': 'fd'}, tile=True)),
    'down': lambda t: stairs(t, True), 'up': lambda t: stairs(t, False), 'door': door, 'gold': chest,
    'torch0': lambda t: torch(t, 0), 'torch1': lambda t: torch(t, 1),
    'brazier0': lambda t: brazier(t, 0), 'brazier1': lambda t: brazier(t, 1),
    'pool0': lambda t: pool(t, 0), 'pool1': lambda t: pool(t, 1),
    'altar': dprop(['................', '................', '.......KK.......', '......KaaK......', '.......KK.......',
                    '..KKKKKKKKKKKK..', '.KKKKKKKKKKKKKK.', '.KaaaaaaaaaaaaK.', '.KaaKaaaaaaKaaK.', '.KaaKaaaaaaKaaK.',
                    '.KaaKaaaaaaKaaK.', '.KaaKaaaaaaKaaK.', '.KKKKKKKKKKKKKK.'], {'K': K, 'a': 'acc'}),
    'barrel': dprop(['................', '................', '.....KKKKKK.....', '....KaaaaaaK....', '...KKKKKKKKKK...',
                     '...KaaaaaaaaK...', '...KaaaaaaaaK...', '...KKKKKKKKKK...', '...KaaaaaaaaK...', '...KaaaaaaaaK...',
                     '...KKKKKKKKKK...', '....KaaaaaaK....', '.....KKKKKK.....'], {'K': K, 'a': 'acc'}),
    'bars': lambda t: (t.fill(K), [t.rect(x, 0, x, 15, 'fl') for x in (2, 6, 10, 14)], t.rect(0, 2, 15, 2, 'f'),
                       t.rect(0, 13, 15, 13, 'f')),
    'bones': dprop(['................', '................', '....KKK.........', '...KbbbK........', '...KbKbK........',
                    '...KbbbK...KK...', '....KbK...KbbK..', '...........KbbK.', '..KK.........KbK', '.KbbKKKKKKKKKbK.',
                    '..KKbbbbbbbbbK..', '....KKKKKKKKKK..'], {'K': K, 'b': 'bone'}),
    'pillar': lambda t: (floor(t), t.art(['..KKKKKKKKKKKK..', '..KllllllllllK..', '...KKKKKKKKKK...'] +
                                         ['...KlllddddddK..'[:16]] * 10 + ['..KKKKKKKKKKKK..'], {'K': K, 'l': 'fl', 'd': 'fd'})),
    'rug': lambda t: (floor(t, lit=False), t.rect(2, 1, 13, 14, K), t.rect(3, 2, 12, 13, 'acc'),
                      t.art(['KKKKKK', 'K....K', 'K.KK.K', 'K.KK.K', 'K....K', 'KKKKKK'], {'K': K}, 5, 5)),
    'seal': dprop(['................', '.....KKKKKK.....', '...KKaaaaaaKK...', '..KaaKKKKKKaaK..', '..KaKaaaaaaKaK..',
                   '.KaKaaaKKaaaKaK.', '.KaKaaKaaKaaKaK.', '.KaKaKaaaaKaKaK.', '.KaKaKaaaaKaKaK.', '.KaKaaKaaKaaKaK.',
                   '.KaKaaaKKaaaKaK.', '..KaKaaaaaaKaK..', '..KaaKKKKKKaaK..', '...KKaaaaaaKK...', '.....KKKKKK.....'],
                  {'K': K, 'a': 'acc'}),
    'shelf': lambda t: (brick(t, lit=False), t.rect(1, 2, 14, 14, K),
                        [t.rect(2, y, 13, y + 2, 'acc') for y in (3, 7, 11)],
                        [t.rect(x, y, x, y + 2, K) for y in (3, 7, 11) for x in (4, 7, 9, 12)]),
    'sign': dprop(['................', '................', '..KKKKKKKKKKKK..', '..KaaaaaaaaaaK..', '..KaKKKKKKKKaK..',
                   '..KaaaaaaaaaaK..', '..KaKKKKKKaaaK..', '..KaaaaaaaaaaK..', '..KKKKKKKKKKKK..', '.......KK.......',
                   '.......KK.......', '.......KK.......', '......KKKK......'], {'K': K, 'a': 'acc'}),
    'spikes': dprop(['................', '................', '................', '..K...K...K...K.', '.KlK.KlK.KlK.KlK',
                     '.KlK.KlK.KlK.KlK', 'KllKKllKKllKKllK', '................', '................',
                     '...K...K...K...K', '..KlK.KlK.KlK.Kl', '..KlK.KlK.KlK.Kl', '.KllKKllKKllKKll'],
                    {'K': K, 'l': 'fl'}),
    'statue': dprop(['......KKKK......', '.....KllllK.....', '.....KlKlKK.....', '.....KllllK.....', '......KllK......',
                     '....KKllllKK....', '...KllKllKllK...', '...KlK.ll.KlK...', '...KlK.ll.KlK...', '......KllK......',
                     '.....KlKKlK.....', '.....KlK.KlK....', '...KKKKKKKKKK...', '...KddddddddK...',
                     '...KKKKKKKKKK...'], {'K': K, 'l': 'fl', 'd': 'fd'}),
    'throne': dprop(['....KKKKKKKK....', '....KaaaaaaK....', '....KaKaaKaK....', '....KaaaaaaK....', '....KaaaaaaK....',
                     '..KKKaaaaaaKKK..', '..KaKKKKKKKKaK..', '..KaKaaaaaaKaK..', '..KaKKKKKKKKaK..', '..KaK......KaK..',
                     '..KKK......KKK..', '................'], {'K': K, 'a': 'acc'}),
}


def dungeon_tile(theme, key):
    t = Tile(THEMES[theme])
    D_KEYS[key](t)
    return t.done()


# ------------------------------------------------------------------ output
def build(out=OUT):
    out.mkdir(exist_ok=True)
    n = 0
    for g in GROUPS:
        for k in TILE_KEYS:
            world_tile(g, k).save(out / f'gt_n8{g}_{k}.png'); n += 1
    for th in THEMES:
        for k in D_KEYS:
            dungeon_tile(th, k).save(out / f'gd_n8{th}_{k}.png'); n += 1
    return n


SHEET_KEYS = ['grass', 'meadow', 'ground', 'sand', 'tree', 'pine', 'dense', 'single', 'rock', 'peak', 'water0_0', 'water5_0',
              'water15_1', 'deep0', 'bridge0', 'road5', 'road10', 'road15', 'cobble', 'wall', 'gate', 'keep', 'keepdoor',
              'house', 'inn', 'shop', 'shrine', 'temple', 'statue', 'arena']


def contact_sheet(path, scale=3):
    dk = list(D_KEYS)
    w = max(len(SHEET_KEYS), len(dk)) * 17
    sheet = Image.new('RGB', (w, (len(GROUPS) + len(THEMES)) * 17 + 4), (0, 0, 0))
    for y, g in enumerate(GROUPS):
        for x, k in enumerate(SHEET_KEYS):
            sheet.paste(world_tile(g, k), (x * 17, y * 17))
    for y, th in enumerate(THEMES):
        for x, k in enumerate(dk):
            sheet.paste(dungeon_tile(th, k), (x * 17, (len(GROUPS) + y) * 17 + 4))
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST).save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--no-write', action='store_true')
    a = ap.parse_args()
    if not a.no_write:
        print(f'wrote {build()} NES CLASSIC tiles')
    if a.sheet:
        contact_sheet(a.sheet)
