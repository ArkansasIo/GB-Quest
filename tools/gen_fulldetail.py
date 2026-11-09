#!/usr/bin/env python3
"""FULL DETAIL sprite set (the default art mode): redesigned field walkers, townsfolk, monsters and world props.

Everything is drawn here from original shapes; nothing third-party is read.

  * fdw_<class>_<dir><frame>   16x24 heroes for every class: down / up / side, two walk frames
  * fdn_<role>_<0|1>           16x24 townsfolk for every role (open eyes / blink)
  * fdm_<sub>_<variant>        48x48 monsters, one design per bestiary subtype, seven element variants
  * fdb_<sub>_<0|1|2>          48x52 boss forms (crowned, darker, with an aura)
  * gt_fd<biome>_<prop>        16x16 field props (trees, rocks, houses, shrines, keep...) on each biome's ground

Shading: every part is domed by its distance to the part edge and lit from the top-left onto a five-step,
hue-shifted ramp (cool shadows, warm highlights), with a soft contact shadow, a darker seam where two parts
meet and a coloured selective outline. No dithering, so the sprites stay clean when scaled up.

    python tools/gen_fulldetail.py              # write the assets
    python tools/gen_fulldetail.py --sheet X    # also write a contact sheet for review
"""
import argparse
import colorsys
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_retro8 as R  # noqa: E402  (role table, bestiary list, variant colours)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'

# ---------------------------------------------------------------- materials
(SKIN, HAIR, CLOTH, TRIM, PANTS, BOOT, METAL, WOOD, CAPE, HAT, GOLD, LEATHER, BODY, BELLY, HORN, BONE, STONE, LEAF, BARK,
 ROOF, WALL, WATER, GROUND) = range(1, 24)
EYE, WHITE, GLOW, MOUTH, BLUSH, HOT, INK, PUPIL, STRING = range(40, 49)
FLAT = {EYE: (34, 26, 44), WHITE: (252, 250, 240), GLOW: (255, 222, 120), MOUTH: (110, 30, 46), BLUSH: (236, 140, 130),
        HOT: (255, 96, 52), INK: (24, 18, 34), PUPIL: (20, 14, 30), STRING: (214, 204, 186)}
OUTLINE = (26, 18, 36)
LIGHT = np.array([-0.55, -0.7, 0.75]); LIGHT /= np.linalg.norm(LIGHT)


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def ramp(rgb, n=5):
    """n shades, dark to light: shadows drift toward blue-violet and gain saturation, highlights warm up"""
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    out = []
    for i in range(n):
        t = i / (n - 1)                                   # 0 dark .. 1 light
        if s > 0.06:
            target = 0.72 if 0.15 < h < 0.72 else 0.78    # toward blue/violet in shadow
            dh = ((target - h + 0.5) % 1.0 - 0.5) * 0.12 * (1 - t) - 0.02 * t
        else:
            dh = 0
        hh = (h + dh) % 1.0
        ss = min(1.0, s * (1.15 - 0.45 * t)) if s > 0.06 else s * 0.8 + 0.06 * (1 - t)
        vv = min(1.0, v * (0.42 + 0.72 * t) + 0.06 * t)
        r, g, b = colorsys.hsv_to_rgb(hh, ss, vv)
        out.append((int(r * 255), int(g * 255), int(b * 255)))
    return out


class C:
    """material canvas; x mirrors around the centre column when sym=True"""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new('L', (w, h), 0)
        self.d = ImageDraw.Draw(self.im)

    def mx(self, x):
        return self.w - 1 - x

    def e(self, x0, y0, x1, y1, m, sym=False):
        self.d.ellipse([x0, y0, x1, y1], fill=m)
        if sym:
            self.d.ellipse([self.mx(x1), y0, self.mx(x0), y1], fill=m)

    def r(self, x0, y0, x1, y1, m, sym=False):
        self.d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=m)
        if sym:
            self.d.rectangle([self.mx(max(x0, x1)), min(y0, y1), self.mx(min(x0, x1)), max(y0, y1)], fill=m)

    def p(self, pts, m, sym=False):
        self.d.polygon(pts, fill=m)
        if sym:
            self.d.polygon([(self.mx(x), y) for x, y in pts], fill=m)

    def l(self, pts, m, w=1, sym=False):
        self.d.line(pts, fill=m, width=w)
        if sym:
            self.d.line([(self.mx(x), y) for x, y in pts], fill=m, width=w)

    def px(self, x, y, m, sym=False):
        self.d.point((x, y), fill=m)
        if sym:
            self.d.point((self.mx(x), y), fill=m)

    def ring(self, x0, y0, x1, y1, m, width=1):
        self.d.ellipse([x0, y0, x1, y1], outline=m, width=width)

    def arc(self, box, a0, a1, m, w=1):
        self.d.arc(box, a0, a1, fill=m, width=w)

    def clear(self, x0, y0, x1, y1):
        self.r(x0, y0, x1, y1, 0)

    def flip(self):
        self.im = self.im.transpose(Image.FLIP_LEFT_RIGHT); self.d = ImageDraw.Draw(self.im)
        return self


def shade(c, pal, strength=2.6, outline=True, ground_shadow=False, ink=OUTLINE):
    m = np.array(c.im, dtype=np.int16)
    h, w = m.shape
    solid = m > 0
    height = np.zeros((h, w))
    if solid.any():
        g = ndimage.distance_transform_edt(solid)
        height += 0.5 * np.sqrt(np.clip(g / max(g.max(), 1), 0, 1))
    for k in np.unique(m):
        if k == 0 or k >= 40:
            continue
        sel = m == k
        lab, n = ndimage.label(sel)
        d = ndimage.distance_transform_edt(sel)
        for i in range(1, n + 1):
            part = lab == i
            dm = d[part].max()
            t = np.clip(d / max(dm, 1), 0, 1)
            height[part] += (1 - (1 - t[part]) ** 2) * min(1.0, 0.3 + dm / 5)
    gy, gx = np.gradient(height)
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(height)
    lam = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    up = np.vstack([np.zeros((1, w), np.int16), m[:-1]])
    seam = (m > 0) & (up > 0) & (up != m) & (up < 40)          # a part tucked under the one above it
    v = np.clip(0.05 + 1.0 * lam - 0.25 * seam, 0, 1)
    level = np.clip(np.round(v * 4.4 - 0.2), 0, 4).astype(int)
    out = np.zeros((h, w, 4), np.uint8)
    ramps = {}
    for k in np.unique(m):
        if k == 0:
            continue
        sel = m == k
        if k >= 40:
            out[sel, :3] = pal.get(int(k), FLAT[int(k)])
            ramps[int(k)] = [mix(pal.get(int(k), FLAT[int(k)]), ink, 0.5)] * 5
        else:
            ramps[int(k)] = ramp(pal.get(int(k), (200, 0, 200)))
            out[sel, :3] = np.array(ramps[int(k)], np.uint8)[level[sel]]
        out[sel, 3] = 255
    if outline:
        pad = np.pad(m, 1)
        for y, x in zip(*np.where(~solid)):
            nb = [(pad[y, x + 1], 0), (pad[y + 1, x], 0), (pad[y + 2, x + 1], 1), (pad[y + 1, x + 2], 1)]
            ks = [(k, lit) for k, lit in nb if k > 0]
            if not ks:
                continue
            k, lit = ks[0]
            col = mix(ramps[int(k)][0], ink, 0.45 if lit else 0.72)
            out[y, x, :3] = col; out[y, x, 3] = 255
    if ground_shadow:                                            # soft oval under the feet
        ys = np.where(solid.any(axis=1))[0]
        if len(ys):
            bottom = min(h - 1, ys[-1])
            xs = np.where(solid[max(0, bottom - 2):bottom + 1].any(axis=0))[0]
            if len(xs):
                cx, rx = (xs[0] + xs[-1]) / 2, max(3, (xs[-1] - xs[0]) / 2 + 1)
                for x in range(w):
                    if abs(x - cx) <= rx and out[bottom, x, 3] == 0:
                        out[bottom, x] = (20, 14, 30, 90)
    return Image.fromarray(out, 'RGBA')


# ---------------------------------------------------------------- people (heroes and townsfolk)
SKINS = {'l': (240, 196, 158), 't': (208, 152, 110), 'd': (140, 96, 68), 'p': (226, 214, 236), 'g': (132, 182, 112), 'b': (150, 168, 214)}
HAIRS = {'brown': (122, 76, 42), 'black': (50, 42, 58), 'blond': (236, 198, 96), 'red': (200, 78, 46), 'grey': (178, 176, 188),
         'white': (236, 234, 240), 'auburn': (152, 66, 50), 'blue': (80, 110, 200), 'silver': (200, 206, 222), 'violet': (130, 80, 170),
         'green': (80, 150, 90)}

# class look: clothes, trim, hair, headwear, prop, skin, outfit, cape, offhand
CLASS_LOOK = {
    'warden':      ((70, 96, 150), (226, 178, 58), 'brown', 'short', 'sword', 'l', 'armor', (150, 40, 44), 'shield'),
    'berserker':   ((140, 70, 44), (110, 80, 50), 'red', 'wild', 'axe', 't', 'bare', None, None),
    'vanguard':    ((220, 220, 230), (226, 178, 58), 'blond', 'helm', 'hammer', 'l', 'plate', (60, 90, 180), 'shield'),
    'strider':     ((70, 110, 60), (130, 90, 50), 'auburn', 'hood', 'bow', 'l', 'tunic', (60, 90, 50), None),
    'shade':       ((52, 48, 70), (150, 40, 60), 'black', 'mask', 'dagger', 'l', 'tunic', (36, 32, 50), 'dagger'),
    'ascetic':     ((226, 150, 50), (150, 60, 40), 'black', 'bald', 'fist', 't', 'gi', None, None),
    'arcanist':    ((60, 70, 160), (226, 178, 58), 'white', 'wizard', 'staff', 'l', 'robe', None, None),
    'wildblood':   ((150, 40, 70), (255, 150, 60), 'violet', 'long', 'orb', 'l', 'robe', None, None),
    'pactbound':   ((60, 40, 80), (120, 220, 140), 'black', 'horns', 'tome', 'p', 'robe', (40, 26, 56), None),
    'chaplain':    ((236, 230, 210), (226, 178, 58), 'brown', 'circlet', 'mace', 't', 'robe', None, 'shield'),
    'cantor':      ((170, 60, 120), (240, 200, 90), 'blond', 'feather', 'lute', 'l', 'tunic', (90, 50, 140), None),
    'verdant':     ((90, 130, 60), (200, 150, 70), 'green', 'antler', 'staff', 't', 'robe', None, None),
    'necromancer': ((46, 40, 56), (150, 220, 120), 'white', 'hood', 'scythe', 'p', 'robe', None, None),
    'runeblade':   ((60, 80, 110), (110, 210, 255), 'silver', 'short', 'sword', 'l', 'armor', (40, 60, 100), None),
    'ronin':       ((150, 50, 50), (230, 220, 200), 'black', 'topknot', 'katana', 'l', 'gi', None, None),
    'shinobi':     ((40, 44, 60), (200, 60, 60), 'black', 'mask', 'dagger', 'l', 'gi', None, 'dagger'),
    'bladedancer': ((40, 140, 140), (240, 200, 90), 'red', 'long', 'sword', 't', 'tunic', None, 'sword'),
    'corsair':     ((150, 40, 40), (226, 178, 58), 'black', 'tricorn', 'sword', 't', 'tunic', None, None),
    'dreadknight': ((60, 56, 70), (180, 40, 50), 'black', 'greathelm', 'greatsword', 'p', 'plate', (110, 24, 34), None),
    'sunwarden':   ((240, 200, 90), (255, 255, 230), 'blond', 'circlet', 'spear', 't', 'plate', (230, 140, 50), 'shield'),
    'stormcaller': ((60, 100, 170), (140, 220, 255), 'silver', 'hood', 'staff', 'l', 'robe', None, None),
    'summoner':    ((110, 60, 150), (240, 200, 90), 'blue', 'long', 'tome', 'l', 'robe', None, None),
    'beastcaller': ((120, 90, 50), (90, 140, 60), 'brown', 'wolfhood', 'spear', 't', 'tunic', None, None),
    'puppeteer':   ((130, 50, 90), (230, 220, 200), 'violet', 'tophat', 'orb', 'l', 'tunic', None, None),
    'sage':        ((200, 190, 160), (110, 80, 140), 'grey', 'beard', 'staff', 'l', 'robe', None, None),
    'scalesage':   ((50, 120, 110), (226, 178, 58), 'green', 'horns', 'staff', 'g', 'robe', None, None),
    'voidhunter':  ((50, 40, 80), (170, 100, 255), 'white', 'hood', 'crossbow', 'l', 'tunic', (30, 24, 50), None),
    'wyrmlancer':  ((150, 50, 40), (226, 178, 58), 'red', 'helm', 'spear', 't', 'armor', None, 'shield'),
    'villager0':   ((90, 120, 160), (140, 100, 60), 'brown', 'short', 'none', 'l', 'tunic', None, None),
    'villager1':   ((170, 90, 90), (236, 220, 180), 'red', 'kerchief', 'none', 'l', 'dress', None, None),
    'villager2':   ((110, 140, 70), (210, 180, 100), 'blond', 'straw', 'none', 't', 'tunic', None, None),
    'villager3':   ((120, 100, 80), (90, 70, 50), 'grey', 'cap', 'none', 'd', 'tunic', None, None),
    'elder':       ((130, 110, 160), (226, 178, 58), 'white', 'beard', 'staff', 'l', 'robe', None, None),
    'guard':       ((60, 90, 170), (226, 178, 58), 'brown', 'helm', 'spear', 'l', 'armor', None, 'shield'),
    'merchant':    ((60, 130, 90), (210, 170, 80), 'brown', 'cap', 'bag', 'l', 'tunic', None, None),
}
NPC_LOOKS = {'villager0', 'villager1', 'villager2', 'villager3', 'elder', 'guard', 'merchant'}
HERO_CLASSES = [k for k in CLASS_LOOK if k not in NPC_LOOKS]
ROBED_ROLES = {'oracle', 'enchanter', 'elder', 'spirekeeper', 'curator', 'herbalist', 'alchemist'}
DRESS_ROLES = {'townswoman', 'innkeeper', 'tailor'}
ARMOR_ROLES = {'guard', 'arenamaster', 'trialsmaster', 'warden', 'trainer'}
APRON_ROLES = {'blacksmith', 'armorer', 'weaponsmith', 'craftmaster', 'cook', 'leatherworker'}


def role_look(role):
    clothes, trim, hair, style, prop, skin = R.NPC_ROLES[role]
    outfit = 'robe' if role in ROBED_ROLES else 'dress' if role in DRESS_ROLES else 'armor' if role in ARMOR_ROLES else \
        'apron' if role in APRON_ROLES else 'tunic'
    return (clothes, trim, hair, style, prop, skin, outfit, (130, 40, 50) if role in ('arenamaster', 'guildmaster', 'noble') else None,
            'shield' if role == 'guard' else None)


def look_palette(look):
    clothes, trim, hair, style, prop, skin, outfit, cape, off = look
    pants = mix(clothes, (40, 36, 52), 0.55)
    clothes = mix(clothes, (96, 88, 84), 0.18); trim = mix(trim, (120, 104, 84), 0.12)
    return {SKIN: SKINS[skin], HAIR: HAIRS.get(hair, HAIRS['brown']), CLOTH: clothes, TRIM: trim, PANTS: pants,
            BOOT: (92, 62, 44), METAL: (170, 176, 192) if outfit != 'plate' else mix(clothes, (180, 186, 200), 0.5),
            WOOD: (140, 96, 56), CAPE: cape or clothes, HAT: mix(clothes, trim, 0.25) if style not in ('straw',) else (222, 190, 110),
            GOLD: (232, 186, 60), LEATHER: (120, 80, 50), HORN: (220, 210, 190)}


# species: skin override, ears, horns, tusks, beard, height (wispling/burrowkin are a head shorter)
SPECIES_LOOK = {
    'hearthkin': {}, 'thornelf': {'ears': 'long'}, 'stonekin': {'beard': True, 'skin': 't'}, 'wispling': {'small': True},
    'emberborn': {'skin': 'r', 'horns': 'small'}, 'burrowkin': {'small': True, 'ears': 'round'}, 'twinblood': {'ears': 'short'},
    'tuskborn': {'skin': 'o', 'tusks': True}, 'drakkin': {'skin': 's', 'horns': 'back', 'scales': True},
}
SKINS.update({'r': (206, 92, 80), 'o': (128, 156, 104), 's': (178, 128, 70)})


def draw_head(c, dir, look, blink, sp, t=0):
    """8px-wide head (proportions after the reference hero sheet); t pushes it down for short folk"""
    clothes, trim, hair, style, prop, skin, outfit, cape, off = look
    bald = style == 'bald'
    side = dir == 'side'
    if side:
        c.e(5, 2 + t, 12, 10 + t, SKIN); c.px(13, 7 + t, SKIN)
        if not bald:
            c.e(4, 1 + t, 11, 5 + t, HAIR); c.r(4, 3 + t, 7, 8 + t, HAIR); c.px(11, 3 + t, HAIR)
            if style == 'long':
                c.r(4, 5 + t, 7, 13 + t, HAIR)
        c.r(10, 5 + t, 10, 5 + t if blink else 6 + t, EYE); c.px(11, 9 + t, MOUTH) if not (style == 'beard' or sp.get('beard')) else None
        if sp.get('ears') == 'long':
            c.p([(7, 5 + t), (5, 2 + t), (8, 6 + t)], SKIN)
        elif sp.get('ears'):
            c.px(7, 5 + t, SKIN)
        if style == 'beard' or sp.get('beard'):
            c.p([(8, 7 + t), (13, 8 + t), (12, 12 + t), (8, 11 + t)], HAIR)
        if sp.get('tusks'):
            c.px(12, 9 + t, WHITE)
        return
    c.e(4, 2 + t, 11, 10 + t, SKIN)
    if dir == 'up':
        if not bald:
            c.e(3, 1 + t, 12, 9 + t, HAIR)
            if style == 'long':
                c.r(4, 6 + t, 11, 14 + t, HAIR)
        if sp.get('ears') == 'long':
            c.p([(3, 6 + t), (1, 3 + t), (4, 5 + t)], SKIN, sym=True)
        return
    if not bald:
        c.e(3, 1 + t, 12, 5 + t, HAIR)
        c.r(4, 4 + t, 4, 7 + t, HAIR, sym=True)
        c.px(6, 5 + t, HAIR); c.px(9, 5 + t, HAIR)
        if style == 'long':
            c.r(3, 5 + t, 4, 13 + t, HAIR, sym=True)
    if sp.get('ears') == 'long':
        c.p([(4, 6 + t), (1, 3 + t), (3, 7 + t)], SKIN, sym=True)
    elif sp.get('ears') in ('short', 'round'):
        c.px(3, 6 + t, SKIN, sym=True)
    if blink:
        c.px(6, 7 + t, EYE, sym=True)
    else:
        c.r(6, 6 + t, 6, 7 + t, EYE, sym=True)
    if style == 'beard' or sp.get('beard'):
        c.p([(4, 7 + t), (11, 7 + t), (10, 12 + t), (8, 13 + t), (7, 13 + t), (5, 12 + t)], HAIR)
        c.px(7, 8 + t, MOUTH); c.px(8, 8 + t, MOUTH)
    else:
        c.px(7, 9 + t, MOUTH)
    if sp.get('tusks'):
        c.px(6, 9 + t, WHITE); c.px(9, 9 + t, WHITE)
    if sp.get('scales'):
        c.px(5, 4 + t, HORN); c.px(10, 4 + t, HORN)


def draw_species_horns(c, dir, sp, t=0):
    h = sp.get('horns')
    if not h:
        return
    if dir == 'side':
        c.p([(8, 2 + t), (4, -1 + t), (7, 3 + t)], HORN) if h == 'back' else c.p([(8, 2 + t), (8, -1 + t), (10, 2 + t)], HORN)
    elif h == 'back':
        c.p([(4, 3 + t), (2, -1 + t), (5, 2 + t)], HORN, sym=True)
    else:
        c.p([(5, 2 + t), (4, -1 + t), (6, 1 + t)], HORN, sym=True)


def draw_headwear(c, dir, look, t=0):
    style = look[3]
    side = dir == 'side'
    if style == 'cap':
        c.e(3, 0 + t, 12, 4 + t, HAT)
        c.r(9, 4 + t, 14, 4 + t, HAT) if side else c.r(3, 4 + t, 12, 4 + t, TRIM)
    elif style in ('helm', 'greathelm'):
        c.e(3, 0 + t, 12, 7 + t, METAL)
        if style == 'greathelm':
            c.r(4, 2 + t, 11, 11 + t, METAL); c.r(3, 3 + t, 12, 9 + t, METAL)
            if dir == 'down':
                c.r(5, 6 + t, 10, 6 + t, INK); c.px(7, 8 + t, INK); c.px(8, 8 + t, INK)
            elif side:
                c.r(9, 6 + t, 12, 6 + t, INK)
            c.r(7, -2 + t, 8, 0 + t, TRIM)
        else:
            if dir == 'down':
                c.e(5, 4 + t, 10, 10 + t, SKIN); c.r(6, 6 + t, 6, 7 + t, EYE, sym=True); c.r(7, 3 + t, 8, 7 + t, METAL)
            elif side:
                c.e(8, 4 + t, 12, 10 + t, SKIN); c.r(10, 5 + t, 10, 6 + t, EYE); c.r(4, 4 + t, 7, 9 + t, METAL)
            c.r(3, 4 + t, 12, 4 + t, TRIM) if not side else c.r(3, 4 + t, 8, 4 + t, TRIM)
    elif style in ('hood', 'wolfhood'):
        col = CAPE if look[7] else HAT
        if dir == 'up':
            c.e(2, 0 + t, 13, 11 + t, col); c.p([(4, 9 + t), (11, 9 + t), (8, 15 + t)], col)
        elif side:
            c.e(3, 0 + t, 12, 10 + t, col); c.r(3, 5 + t, 7, 12 + t, col)
            c.e(8, 4 + t, 12, 10 + t, SKIN); c.r(10, 5 + t, 10, 6 + t, EYE); c.r(8, 3 + t, 12, 4 + t, col)
        else:
            c.e(2, 0 + t, 13, 12 + t, col); c.e(5, 4 + t, 10, 10 + t, SKIN); c.r(5, 4 + t, 10, 5 + t, col)
            c.r(6, 6 + t, 6, 7 + t, EYE, sym=True)
        if style == 'wolfhood':
            c.p([(3, 2 + t), (4, -1 + t), (6, 1 + t)], col, sym=not side)
    elif style == 'wizard':
        c.p([(8, -1 + t), (3, 4 + t), (12, 4 + t)], HAT) if not side else c.p([(5, -1 + t), (3, 4 + t), (12, 4 + t)], HAT)
        c.r(1, 4 + t, 14, 5 + t, HAT); c.r(4, 3 + t, 11, 3 + t, TRIM); c.px(7, 1 + t, GLOW)
    elif style == 'straw':
        c.e(5, 0 + t, 10, 3 + t, HAT); c.r(1, 3 + t, 14, 4 + t, HAT); c.r(5, 2 + t, 10, 2 + t, TRIM)
    elif style == 'bun':
        c.e(6, -2 + t, 9, 1 + t, HAIR) if not side else c.e(3, -1 + t, 6, 2 + t, HAIR)
    elif style == 'kerchief':
        c.e(3, 0 + t, 12, 5 + t, HAT); c.r(4, 3 + t, 11, 4 + t, HAT)
        if side:
            c.p([(3, 4 + t), (1, 8 + t), (4, 7 + t)], HAT)
    elif style in ('crown', 'circlet'):
        c.r(4, 2 + t, 11, 3 + t, GOLD)
        if style == 'crown':
            for x in (4, 7, 9, 11):
                c.r(x, 0 + t, x, 1 + t, GOLD)
            c.px(7, 2 + t, HOT) if dir != 'up' else None
        elif dir == 'down':
            c.px(7, 2 + t, GLOW)
    elif style == 'feather':
        c.e(3, 0 + t, 12, 4 + t, HAT); c.r(2, 4 + t, 13, 4 + t, HAT); c.l([(11, 1 + t), (14, -2 + t)], TRIM, 2)
    elif style == 'tricorn':
        c.p([(1, 4 + t), (7.5, -1 + t), (14, 4 + t), (7.5, 2 + t)], HAT); c.r(4, 0 + t, 11, 3 + t, HAT); c.r(3, 4 + t, 12, 4 + t, TRIM)
    elif style == 'tophat':
        c.r(5, -2 + t, 10, 3 + t, HAT); c.r(3, 3 + t, 12, 4 + t, HAT); c.r(5, 2 + t, 10, 2 + t, TRIM)
    elif style == 'horns':
        c.p([(4, 3 + t), (2, -1 + t), (5, 2 + t)], HORN, sym=not side) if not side else c.p([(7, 2 + t), (5, -2 + t), (9, 2 + t)], HORN)
    elif style == 'antler':
        for x0, sgn in (((5, 1),) if side else ((5, 1), (10, -1))):
            c.l([(x0, 2 + t), (x0 - 2 * sgn, -1 + t)], WOOD); c.px(x0 - 3 * sgn, 0 + t, WOOD)
    elif style == 'mask' and dir != 'up':
        c.r(4, 8 + t, 11, 10 + t, CLOTH) if not side else c.r(9, 8 + t, 13, 10 + t, CLOTH)
        if not side:
            c.r(4, 2 + t, 11, 4 + t, CLOTH)
    elif style == 'topknot':
        c.e(6, -2 + t, 9, 1 + t, HAIR) if not side else c.e(5, -2 + t, 8, 1 + t, HAIR)
        if dir == 'down':
            c.r(4, 2 + t, 11, 2 + t, TRIM)
    elif style == 'wild':
        for x in (3, 6, 9):
            c.p([(x, 3 + t), (x + 1, -1 + t), (x + 3, 3 + t)], HAIR)
        if dir == 'down':
            c.r(4, 4 + t, 11, 4 + t, TRIM)


def draw_prop(c, kind, x, y, dir):
    """item held in the hand at (x, y): weapons point up"""
    if kind in ('sword', 'katana', 'greatsword') and dir == 'side':
        n = 9 if kind == 'greatsword' else 7
        c.l([(x, y - 1), (x + 4, y - 1 - n)], METAL, 2 if kind == 'greatsword' else 1)
        c.l([(x - 1, y - 2), (x + 2, y)], GOLD if kind != 'katana' else INK); c.px(x - 1, y, LEATHER)
    elif kind in ('sword', 'katana', 'greatsword'):
        top = y - (12 if kind == 'greatsword' else 9)
        c.r(x, top, x + 1, y - 2, METAL); c.px(x + 1, top, 0) if kind != 'greatsword' else None
        c.r(x - 1, y - 1, x + 2, y - 1, GOLD if kind != 'katana' else INK); c.r(x, y, x, y + 1, LEATHER)
    elif kind == 'dagger':
        c.r(x, y - 4, x, y - 1, METAL); c.r(x - 1, y - 1, x + 1, y - 1, GOLD); c.px(x, y, LEATHER)
    elif kind in ('spear',):
        c.r(x, y - 15, x, y + 4, WOOD); c.p([(x - 1, y - 15), (x, y - 19), (x + 1, y - 15)], METAL); c.px(x, y - 14, TRIM)
    elif kind == 'scythe':
        c.r(x, y - 14, x, y + 4, WOOD); c.l([(x, y - 14), (x - 5, y - 12), (x - 6, y - 9)], METAL, 1); c.px(x - 1, y - 13, METAL)
    elif kind in ('staff',):
        c.r(x, y - 12, x, y + 4, WOOD); c.e(x - 1, y - 15, x + 1, y - 13, GLOW); c.px(x - 1, y - 12, TRIM); c.px(x + 1, y - 12, TRIM)
    elif kind == 'bow':
        c.arc([x - 3, y - 9, x + 2, y + 5], 270, 90, WOOD) if dir != 'up' else c.arc([x - 2, y - 9, x + 3, y + 5], 90, 270, WOOD)
        c.l([(x - 1 if dir != 'up' else x + 1, y - 8), (x - 1 if dir != 'up' else x + 1, y + 4)], STRING)
        c.arc([x - 3, y - 9, x + 2, y + 5], 270, 90, WOOD) if dir != 'up' else c.arc([x - 2, y - 9, x + 3, y + 5], 90, 270, WOOD)
    elif kind == 'crossbow':
        c.r(x - 3, y - 2, x + 1, y - 2, WOOD); c.r(x - 1, y - 4, x - 1, y, METAL)
    elif kind == 'axe':
        c.r(x, y - 8, x, y + 2, WOOD); c.p([(x, y - 9), (x + 2, y - 10), (x + 3, y - 6), (x + 1, y - 5)], METAL)
        c.p([(x, y - 9), (x - 2, y - 10), (x - 3, y - 6), (x - 1, y - 5)], METAL)
    elif kind in ('hammer', 'mace'):
        c.r(x, y - 7, x, y + 2, WOOD)
        if kind == 'hammer':
            c.r(x - 2, y - 10, x + 2, y - 7, METAL)
        else:
            c.e(x - 2, y - 10, x + 2, y - 6, METAL); c.px(x, y - 11, METAL); c.px(x - 3, y - 8, METAL); c.px(x + 3, y - 8, METAL)
    elif kind in ('orb', 'gem'):
        c.e(x - 1, y - 3, x + 1, y - 1, GLOW); c.px(x, y - 4, WHITE)
    elif kind in ('tome', 'book', 'scroll'):
        c.r(x - 2, y - 2, x + 1, y + 1, TRIM if kind != 'scroll' else WHITE); c.r(x - 2, y - 2, x - 2, y + 1, CLOTH if kind != 'scroll' else WOOD)
    elif kind == 'lute':
        c.e(x - 2, y - 1, x + 2, y + 3, WOOD); c.l([(x, y - 1), (x + 2, y - 7)], WOOD); c.px(x, y + 1, INK)
    elif kind in ('mug', 'flask', 'coin', 'bag', 'herbs', 'horn', 'spool'):
        col = {'mug': WOOD, 'flask': GLOW, 'coin': GOLD, 'bag': LEATHER, 'herbs': HAT, 'horn': HORN, 'spool': TRIM}[kind]
        c.r(x - 1, y - 2, x + 1, y, col)
        if kind == 'mug':
            c.px(x - 1, y - 2, WHITE); c.px(x, y - 2, WHITE)
        if kind == 'flask':
            c.px(x, y - 3, WHITE)
    elif kind in ('pick', 'fork', 'rod'):
        c.r(x, y - 11, x, y + 3, WOOD)
        if kind == 'pick':
            c.l([(x - 4, y - 9), (x, y - 11), (x + 4, y - 9)], METAL)
        elif kind == 'fork':
            for dx in (-1, 0, 1):
                c.r(x + dx, y - 14, x + dx, y - 11, METAL)
        else:
            c.l([(x, y - 11), (x + 3, y - 14)], WOOD); c.l([(x + 3, y - 14), (x + 3, y - 6)], WHITE)


def figure(look, dir='down', frame=0, blink=False, species='hearthkin'):
    """16x24 hero/townsfolk after the reference sheet's proportions: 8px head, broad shoulders, stocky legs.
    dir is down, up or side (facing right); frame 1 is the mid-stride pose"""
    clothes, trim, hair, style, prop, skin, outfit, cape, off = look
    sp = SPECIES_LOOK.get(species, {})
    c = C(16, 24)
    t = 2 if sp.get('small') else 0
    step = frame == 1
    top = 11 + t
    robe = outfit in ('robe', 'dress')
    armored = outfit in ('armor', 'plate')
    if cape and dir == 'down':
        c.r(3, top, 12, 21, CAPE)
    if cape and dir == 'side':
        c.p([(5, top), (2, 21), (6, 21), (7, top)], CAPE)
    if dir == 'up' and prop != 'none':
        draw_prop(c, prop, 2, 17, dir)
    # legs
    ly = 18 if not sp.get('small') else 19
    if dir == 'side':
        if step:
            c.p([(6, ly), (8, ly), (6, 21), (4, 21)], PANTS); c.r(3, 21, 6, 23, BOOT)
            c.p([(8, ly), (10, ly), (12, 21), (10, 21)], PANTS); c.r(10, 21, 13, 23, BOOT)
        else:
            c.r(6, ly, 9, 21, PANTS); c.r(6, 21, 10, 23, BOOT)
    else:
        lh = 2 if step else 0
        c.r(5, ly, 7, 21 - lh, PANTS); c.r(8, ly, 10, 21, PANTS)
        c.r(5, 21 - lh, 7, 23 - lh, BOOT); c.r(8, 21, 10, 23, BOOT)
        c.r(4, 23 - lh, 7, 23 - lh, BOOT); c.r(8, 23, 11, 23, BOOT)
    # torso
    if dir == 'side':
        if robe:
            c.p([(5, top), (10, top), (11, 22), (4, 22)], CLOTH)
            if outfit == 'robe':
                c.r(8, top + 1, 8, 21, TRIM)
        else:
            c.r(5, top, 10, ly, CLOTH)
            if armored:
                c.r(5, top, 10, top + 4, METAL)
        c.r(5, ly - 1, 10, ly - 1, TRIM if outfit != 'bare' else LEATHER)
    else:
        if robe:
            c.p([(4, top), (11, top), (12, 22), (3, 22)], CLOTH)
            if outfit == 'robe' and dir == 'down':
                c.r(7, top + 1, 8, 22, TRIM)
            if outfit == 'dress' and dir == 'down':
                c.r(5, top + 2, 10, ly - 1, TRIM)
        else:
            c.r(4, top, 11, ly, CLOTH)
            if outfit == 'bare':
                c.r(5, top, 10, ly - 2, SKIN); c.l([(4, top), (10, ly - 1)], LEATHER)
            if outfit == 'gi' and dir == 'down':
                c.l([(5, top), (7, ly - 2)], TRIM); c.l([(10, top), (8, ly - 2)], TRIM)
            if armored:
                c.r(4, top, 11, top + 4, METAL)
                if dir == 'down':
                    c.r(7, top + 1, 8, top + 3, TRIM); c.l([(5, top + 5), (10, top + 5)], INK) if outfit == 'plate' else None
            if outfit == 'apron' and dir == 'down':
                c.r(5, top + 2, 10, 20, LEATHER)
            if outfit == 'tunic' and dir == 'down':
                c.r(7, top, 8, top + 1, SKIN); c.px(7, top + 2, TRIM)
        c.r(4, ly - 1, 11, ly - 1, TRIM)
        if not robe and dir == 'down':
            c.px(7, ly - 1, GOLD); c.px(8, ly - 1, GOLD)
    # arms and shoulders
    arm = CLOTH if outfit != 'bare' else SKIN
    if dir == 'side':
        ax = 9 if step else 7
        c.r(ax, top + 1, ax + 1, top + 4, arm)
        if armored:
            c.r(ax - 1, top, ax + 2, top + 1, METAL)
        c.r(ax, top + 5, ax + 1, top + 6, SKIN)
        hand = (ax + 1, top + 5)
    else:
        sr = 1 if step else 0
        c.r(2, top + 1, 3, top + 4, arm); c.r(12, top + 1, 13, top + 4 - sr, arm)
        c.r(2, top + 5, 3, top + 6, SKIN); c.r(12, top + 5 - sr, 13, top + 6 - sr, SKIN)
        if armored:
            c.e(1, top - 1, 5, top + 2, METAL); c.e(10, top - 1, 14, top + 2, METAL)
        elif outfit not in ('bare', 'robe', 'dress'):
            c.r(3, top, 4, top + 1, TRIM, sym=True)
        hand = (13, top + 5 - sr)
    long_prop = prop in ('spear', 'staff', 'scythe', 'pick', 'fork', 'rod')
    if dir == 'side' and long_prop:
        draw_prop(c, prop, 12, hand[1], dir)
    draw_head(c, dir, look, blink, sp, t)
    draw_headwear(c, dir, look, t)
    if style not in ('helm', 'greathelm', 'hood', 'wolfhood', 'wizard', 'tophat', 'tricorn', 'horns'):
        draw_species_horns(c, dir, sp, t)
    if cape and dir == 'up':
        c.p([(3, top), (12, top), (13, 21), (2, 21)], CAPE); c.r(4, top, 11, top, TRIM)
    if dir != 'up' and prop not in ('none', 'fist') and not (dir == 'side' and long_prop):
        draw_prop(c, prop, hand[0] + 1, hand[1], dir)
    if dir == 'down' and off == 'shield':
        c.p([(0, top + 2), (5, top + 2), (5, top + 7), (2.5, top + 10), (0, top + 7)], METAL)
        c.p([(1, top + 3), (4, top + 3), (4, top + 7), (2.5, top + 9), (1, top + 7)], CAPE if cape else TRIM)
        c.l([(2.5, top + 3), (2.5, top + 8)], GOLD); c.l([(1, top + 5), (4, top + 5)], GOLD)
    elif dir == 'down' and off in ('dagger', 'sword'):
        draw_prop(c, off, 2, top + 6, dir)
    if prop == 'fist' and dir != 'up':
        c.r(hand[0] - 1, hand[1], hand[0] + 1, hand[1] + 1, TRIM)
    return c


def walker(name, look, dir, frame, species='hearthkin'):
    sp = SPECIES_LOOK.get(species, {})
    pal = look_palette(look)
    if sp.get('skin'):
        pal[SKIN] = SKINS[sp['skin']]
    return shade(figure(look, dir, frame, species=species), pal, ground_shadow=True)


def townsfolk(role, blink=False, dir='down', frame=0):
    if role == 'realmstone':
        c = C(16, 24)
        c.r(3, 20, 12, 23, STONE); c.r(5, 18, 10, 20, STONE)
        c.p([(8, 0), (12, 6), (11, 15), (8, 18), (5, 15), (4, 6)], GLOW if blink else BODY)
        c.l([(8, 2), (8, 16)], WHITE); c.px(6, 5, WHITE)
        return shade(c, {STONE: (120, 116, 130), BODY: (90, 200, 240)}, ground_shadow=True)
    look = role_look(role)
    return shade(figure(look, dir, frame, blink, species='wispling' if role == 'child' else 'hearthkin'), look_palette(look), ground_shadow=True)


# ---------------------------------------------------------------- monsters (48x48, facing the party on the left)
MW = MH = 48
# subtype -> (body, belly/accent) base colours
MON_COL = {
    'wolf': ((120, 120, 134), (220, 214, 200)), 'bat': ((96, 70, 110), (200, 140, 150)), 'serpent': ((70, 140, 80), (226, 210, 120)),
    'boar': ((132, 88, 60), (210, 190, 160)), 'spider': ((70, 56, 80), (200, 60, 60)), 'hawk': ((150, 100, 60), (236, 226, 200)),
    'bear': ((116, 76, 48), (200, 160, 110)), 'goblin': ((110, 160, 70), (150, 100, 60)), 'orc': ((96, 130, 76), (120, 80, 60)),
    'bandit': ((96, 72, 120), (150, 110, 70)), 'apostate': ((120, 36, 52), (230, 190, 90)), 'fenfolk': ((70, 140, 130), (200, 220, 160)),
    'hexer': ((70, 60, 110), (150, 230, 140)), 'sentry': ((60, 96, 170), (226, 178, 58)), 'skeleton': ((226, 218, 190), (120, 100, 140)),
    'zombie': ((128, 160, 110), (110, 80, 110)), 'ghoul': ((150, 140, 170), (120, 40, 60)), 'wraith': ((112, 100, 160), (170, 240, 220)),
    'bonehulk': ((226, 218, 190), (140, 60, 60)), 'imp': ((210, 60, 50), (60, 40, 50)), 'hellhound': ((60, 46, 52), (255, 120, 40)),
    'tormentor': ((170, 40, 60), (90, 80, 90)), 'shade': ((60, 54, 90), (170, 140, 255)), 'sprite': ((150, 230, 200), (255, 180, 230)),
    'thornling': ((90, 140, 60), (200, 90, 110)), 'hag': ((120, 140, 100), (90, 60, 110)), 'satyr': ((170, 120, 80), (110, 80, 60)),
    'mephit': ((120, 200, 240), (240, 250, 255)), 'geode': ((150, 104, 220), (120, 110, 120)), 'gale': ((206, 222, 240), (150, 190, 240)),
    'magmin': ((240, 130, 40), (90, 60, 50)), 'gargoyle': ((128, 124, 132), (90, 86, 96)), 'golem': ((150, 140, 128), (90, 200, 240)),
    'animatedarmour': ((150, 158, 178), (110, 60, 160)), 'wyrmling': ((90, 170, 90), (240, 220, 140)), 'drake': ((180, 70, 50), (240, 200, 120)),
    'wyvern': ((90, 110, 140), (210, 200, 160)), 'ogre': ((200, 150, 110), (120, 90, 60)), 'troll': ((100, 140, 110), (150, 120, 90)),
    'frostgiant': ((150, 192, 232), (230, 240, 255)), 'slime': ((120, 200, 90), (220, 250, 190)), 'jelly': ((90, 170, 230), (210, 240, 255)),
    'pudding': ((90, 60, 70), (200, 150, 100)), 'gazer': ((170, 90, 170), (240, 170, 190)), 'mindworm': ((210, 140, 160), (120, 70, 140)),
    'voidspawn': ((60, 40, 90), (150, 110, 255)), 'chimera': ((200, 150, 70), (120, 70, 50)), 'basilisk': ((110, 130, 70), (230, 200, 110)),
    'harpy': ((120, 100, 80), (230, 200, 170)), 'crab': ((210, 90, 60), (240, 210, 170)), 'blight': ((110, 90, 70), (150, 200, 80)),
    'myconid': ((204, 60, 52), (236, 220, 190)), 'treant': ((120, 90, 60), (90, 160, 70)), 'lanternspirit': ((255, 240, 180), (255, 190, 80)),
    'haloknight': ((236, 232, 220), (232, 184, 72)),
}


def eyes(c, x, y, gap, m=GLOW, size=1, pupil=True):
    """a pair of eyes: left eye at x, the other gap px to the right"""
    for ex in (x, x + gap):
        c.r(ex, y, ex + size, y + size, m)
        if pupil and m == WHITE:
            c.px(ex, y + size, PUPIL)


def legs4(c, xs, y0, y1, m=BODY, w=3, claw=HORN):
    for x in xs:
        c.r(x, y0, x + w - 1, y1, m); c.r(x - 1, y1, x + w - 1, y1 + 1, m)
        if claw:
            c.px(x - 1, y1 + 1, claw)


def m_wolf(c):
    c.p([(40, 22), (46, 14), (44, 24)], BODY)                               # tail
    c.e(14, 18, 40, 34, BODY); c.e(16, 26, 36, 36, BELLY)
    legs4(c, (16, 22, 31, 36), 32, 44)
    c.p([(6, 20), (18, 14), (22, 24), (12, 30), (3, 27)], BODY)              # head and snout
    c.p([(3, 25), (11, 26), (9, 29), (4, 28)], BELLY)
    c.p([(12, 15), (14, 7), (18, 15)], BODY); c.p([(17, 15), (20, 8), (22, 17)], BODY); c.px(15, 11, BELLY)
    c.r(9, 20, 10, 21, GLOW); c.px(3, 25, INK)
    c.l([(5, 28), (10, 28)], MOUTH); c.px(7, 29, WHITE); c.px(9, 29, WHITE)
    c.p([(18, 18), (26, 14), (34, 18), (24, 22)], BELLY)                    # ruff


def m_bat(c):
    for s in (False,):
        c.p([(23, 20), (2, 10), (6, 18), (2, 24), (9, 25), (6, 31), (16, 28), (22, 30)], BODY, sym=True)   # wings
        c.p([(22, 21), (8, 14), (10, 20), (6, 24), (12, 25), (17, 26)], BELLY, sym=True)
    c.e(17, 16, 30, 33, BODY); c.e(19, 22, 28, 32, BELLY)
    c.p([(17, 18), (16, 9), (21, 15)], BODY, sym=True)
    eyes(c, 19, 20, 7, GLOW, 1); c.l([(21, 26), (26, 26)], MOUTH); c.px(21, 27, WHITE); c.px(26, 27, WHITE)
    c.l([(21, 33), (21, 37)], HORN); c.l([(26, 33), (26, 37)], HORN)


def m_serpent(c):
    c.e(16, 34, 44, 46, BODY); c.e(20, 36, 40, 44, BELLY); c.e(24, 37, 36, 43, BODY)
    c.l([(30, 38), (26, 30), (20, 24), (18, 16)], BODY, 7)
    c.l([(28, 38), (24, 31), (19, 25)], BELLY, 2)
    c.e(8, 8, 24, 20, BODY); c.p([(4, 14), (10, 11), (10, 18)], BODY)
    c.p([(9, 6), (22, 4), (26, 12), (14, 10)], BELLY)                         # hood crest
    c.r(10, 12, 11, 13, GLOW); c.r(16, 12, 17, 13, GLOW)
    c.l([(5, 16), (12, 17)], MOUTH); c.l([(4, 17), (1, 20)], HOT); c.px(1, 21, HOT)
    c.px(32, 40, BELLY); c.px(38, 41, BELLY)


def m_boar(c):
    c.e(12, 16, 42, 38, BODY); c.e(16, 28, 38, 39, BELLY)
    for x in range(16, 40, 4):
        c.p([(x, 18), (x + 2, 10 + (x % 3)), (x + 4, 18)], BELLY)           # bristles
    legs4(c, (15, 21, 31, 37), 34, 44, BODY, 4, HORN)
    c.e(3, 20, 20, 36, BODY); c.e(1, 27, 9, 35, BELLY); c.px(3, 30, INK); c.px(6, 30, INK)
    c.p([(7, 33), (3, 26), (9, 31)], WHITE); c.p([(13, 33), (11, 27), (15, 31)], WHITE)
    c.r(8, 24, 9, 25, GLOW); c.r(14, 24, 15, 25, GLOW)
    c.p([(5, 20), (6, 14), (10, 20)], BODY); c.p([(14, 20), (17, 14), (18, 21)], BODY)


def m_spider(c):
    for i, (dx, dy) in enumerate(((-14, -8), (-17, 2), (-15, 10), (-10, 14))):
        c.l([(18, 28), (18 + dx, 28 + dy - 6), (18 + dx - 3, 28 + dy + 8)], BODY, 2, sym=True)
    c.e(14, 10, 34, 30, BODY); c.e(18, 14, 30, 24, BELLY)
    c.p([(22, 16), (26, 16), (24, 22)], BODY)                               # hourglass mark
    c.e(16, 26, 32, 40, BODY)
    for x, y in ((19, 29), (27, 29), (21, 32), (25, 32)):
        c.r(x, y, x + 1, y + 1, GLOW)
    c.p([(19, 38), (21, 44), (22, 38)], HORN); c.p([(26, 38), (27, 44), (29, 38)], HORN)


def m_hawk(c):
    c.p([(24, 18), (2, 8), (8, 20), (3, 24), (12, 26), (8, 32), (18, 30)], BODY)
    c.p([(24, 18), (46, 8), (40, 20), (45, 24), (36, 26), (40, 32), (30, 30)], BODY)
    for x in (6, 10, 14):
        c.l([(x, 13), (x + 6, 22)], BELLY)
        c.l([(48 - x, 13), (42 - x, 22)], BELLY)
    c.e(17, 14, 31, 38, BODY); c.e(19, 22, 29, 37, BELLY)
    c.p([(19, 38), (24, 46), (29, 38)], BODY)
    c.e(18, 6, 30, 18, BODY); c.r(20, 10, 21, 11, GLOW); c.r(27, 10, 28, 11, GLOW)
    c.p([(22, 13), (26, 13), (24, 19)], GOLD)
    c.l([(21, 38), (20, 43)], GOLD); c.l([(27, 38), (28, 43)], GOLD)


def m_bear(c):
    c.e(10, 12, 42, 42, BODY); c.e(16, 24, 36, 42, BELLY)
    c.e(14, 4, 34, 22, BODY); c.e(12, 2, 19, 9, BODY); c.e(29, 2, 36, 9, BODY); c.e(14, 4, 17, 7, BELLY); c.e(31, 4, 34, 7, BELLY)
    c.e(19, 13, 29, 21, BELLY); c.r(23, 14, 25, 15, INK)
    c.r(18, 10, 19, 11, GLOW); c.r(28, 10, 29, 11, GLOW); c.l([(21, 18), (27, 18)], MOUTH)
    c.e(4, 20, 14, 34, BODY); c.e(34, 20, 44, 34, BODY)
    for x in (4, 7, 10):
        c.l([(x, 34), (x - 1, 37)], HORN); c.l([(48 - x, 34), (49 - x, 37)], HORN)
    c.e(12, 38, 22, 46, BODY); c.e(26, 38, 36, 46, BODY)


def biped(c, head=(16, 4, 32, 20), torso=(15, 19, 33, 36), arms=True, legs=True, body=BODY, cloth=CLOTH, armw=4, legw=5):
    hx0, hy0, hx1, hy1 = head
    tx0, ty0, tx1, ty1 = torso
    if legs:
        c.r(tx0 + 2, ty1 - 2, tx0 + 2 + legw, 43, PANTS); c.r(tx1 - 2 - legw, ty1 - 2, tx1 - 2, 43, PANTS)
        c.r(tx0 + 1, 43, tx0 + 3 + legw, 46, BOOT); c.r(tx1 - 3 - legw, 43, tx1 - 1, 46, BOOT)
    c.p([(tx0 + 1, ty0), (tx1 - 1, ty0), (tx1, ty1), (tx0, ty1)], cloth)
    if arms:
        c.r(tx0 - armw, ty0 + 1, tx0 - 1, ty0 + 12, cloth); c.r(tx1 + 1, ty0 + 1, tx1 + armw, ty0 + 12, cloth)
        c.e(tx0 - armw, ty0 + 11, tx0, ty0 + 16, body); c.e(tx1, ty0 + 11, tx1 + armw, ty0 + 16, body)
    c.e(hx0, hy0, hx1, hy1, body)


def m_goblin(c):
    biped(c, (14, 6, 34, 24), (17, 23, 31, 37), cloth=LEATHER, armw=4, legw=4)
    c.p([(14, 13), (2, 8), (14, 18)], BODY); c.p([(34, 13), (46, 8), (34, 18)], BODY)
    c.p([(5, 9), (13, 13), (12, 15)], BELLY); c.p([(43, 9), (35, 13), (36, 15)], BELLY)
    c.r(19, 13, 21, 15, GLOW); c.r(27, 13, 29, 15, GLOW); c.px(20, 14, INK); c.px(28, 14, INK)
    c.p([(22, 16), (26, 16), (24, 21)], BODY)
    c.l([(19, 21), (29, 21)], MOUTH); c.px(20, 22, WHITE); c.px(28, 22, WHITE)
    c.l([(38, 36), (44, 20)], WOOD, 2); c.p([(42, 20), (46, 14), (47, 22)], METAL)


def m_orc(c):
    biped(c, (14, 4, 34, 22), (11, 20, 37, 38), cloth=LEATHER, armw=6, legw=6)
    c.r(11, 20, 37, 25, METAL); c.r(22, 25, 26, 38, BELLY)
    c.r(18, 11, 21, 12, GLOW); c.r(27, 11, 30, 12, GLOW); c.l([(17, 9), (22, 11)], INK); c.l([(31, 9), (26, 11)], INK)
    c.r(18, 17, 30, 19, MOUTH); c.p([(19, 19), (20, 13), (22, 19)], WHITE); c.p([(26, 19), (28, 13), (29, 19)], WHITE)
    c.r(16, 3, 32, 6, BELLY)
    c.l([(42, 34), (42, 10)], WOOD, 2); c.p([(42, 8), (47, 6), (47, 18), (42, 16)], METAL); c.p([(42, 8), (37, 6), (37, 18), (42, 16)], METAL)


def m_bandit(c):
    biped(c, (17, 4, 31, 18), (15, 17, 33, 36), body=SKIN, cloth=BODY, armw=4)
    c.e(15, 1, 33, 12, CAPE); c.r(13, 9, 35, 11, CAPE)
    c.r(17, 13, 31, 18, BELLY); c.r(19, 11, 21, 12, EYE); c.r(27, 11, 29, 12, EYE)
    c.l([(15, 18), (33, 34)], LEATHER, 2)
    c.l([(38, 32), (44, 14)], METAL, 2); c.r(36, 31, 40, 32, GOLD)
    c.l([(10, 32), (6, 26)], METAL)


def m_apostate(c):
    c.p([(16, 16), (32, 16), (38, 46), (10, 46)], BODY)
    c.p([(22, 16), (26, 16), (27, 46), (21, 46)], BELLY)
    c.e(14, 2, 34, 22, BODY); c.e(18, 8, 30, 21, INK)
    c.r(20, 13, 21, 14, GLOW); c.r(26, 13, 27, 14, GLOW)
    c.r(8, 18, 14, 30, BODY); c.r(34, 18, 40, 30, BODY); c.e(8, 28, 14, 33, SKIN); c.e(34, 28, 40, 33, SKIN)
    c.l([(6, 46), (8, 10)], WOOD, 2); c.e(4, 4, 12, 12, GLOW); c.px(8, 8, HOT)
    c.p([(38, 24), (42, 20), (44, 26), (40, 30)], HOT)


def m_fenfolk(c):
    biped(c, (12, 6, 36, 24), (15, 22, 33, 38), cloth=BELLY, armw=5)
    c.p([(12, 12), (6, 6), (8, 16)], BODY); c.p([(36, 12), (42, 6), (40, 16)], BODY)
    for x in range(16, 34, 4):
        c.p([(x, 7), (x + 2, 1), (x + 3, 7)], BELLY)
    c.e(14, 10, 21, 17, WHITE); c.e(27, 10, 34, 17, WHITE); c.r(16, 12, 18, 15, INK); c.r(29, 12, 31, 15, INK)
    c.l([(17, 21), (31, 21)], MOUTH)
    c.l([(40, 44), (42, 12)], WOOD, 2); c.p([(41, 12), (42, 4), (43, 12)], METAL); c.l([(39, 9), (45, 9)], METAL)


def m_hexer(c):
    c.p([(14, 18), (34, 18), (40, 46), (8, 46)], BODY)
    c.p([(10, 30), (38, 30), (39, 33), (9, 33)], BELLY)
    c.e(17, 8, 31, 22, SKIN); c.p([(12, 12), (24, 0), (36, 12)], BODY); c.r(10, 11, 38, 13, BODY)
    c.r(20, 15, 21, 16, GLOW); c.r(27, 15, 28, 16, GLOW); c.l([(21, 20), (27, 20)], MOUTH)
    c.e(36, 18, 46, 28, GLOW); c.e(38, 20, 44, 26, BELLY)
    for a in range(0, 360, 60):
        c.px(41 + int(7 * math.cos(math.radians(a))), 23 + int(7 * math.sin(math.radians(a))), BELLY)
    c.r(4, 20, 10, 30, BODY); c.e(4, 28, 10, 33, SKIN)


def m_sentry(c):
    biped(c, (16, 2, 32, 20), (13, 18, 35, 38), body=METAL, cloth=BODY, armw=5, legw=6)
    c.r(13, 18, 35, 24, METAL); c.r(22, 24, 26, 38, TRIM)
    c.r(18, 10, 30, 11, INK); c.r(23, 5, 25, 18, METAL); c.p([(22, 2), (26, 2), (24, -2)], TRIM)
    c.e(2, 18, 16, 38, METAL); c.e(4, 20, 14, 36, BODY); c.l([(9, 21), (9, 35)], TRIM); c.l([(5, 28), (13, 28)], TRIM)
    c.l([(42, 46), (42, 2)], WOOD, 2); c.p([(40, 4), (42, -2), (44, 4)], METAL)


def m_skeleton(c):
    c.e(16, 2, 32, 18, BODY); c.r(19, 16, 29, 20, BODY)
    c.e(18, 8, 22, 13, INK); c.e(26, 8, 30, 13, INK); c.px(20, 10, GLOW); c.px(28, 10, GLOW)
    c.p([(23, 13), (25, 13), (24, 16)], INK)
    for x in range(20, 29, 2):
        c.px(x, 18, INK)
    c.r(23, 20, 25, 34, BODY)
    for y in (22, 25, 28):
        c.l([(16, y), (32, y)], BODY); c.l([(17, y + 1), (31, y + 1)], INK)
    c.e(17, 32, 31, 37, BODY)
    c.l([(18, 36), (17, 46)], BODY, 2); c.l([(30, 36), (31, 46)], BODY, 2)
    c.l([(15, 21), (10, 32)], BODY, 2); c.l([(33, 21), (38, 32)], BODY, 2)
    c.l([(38, 34), (44, 12)], METAL, 2); c.l([(35, 32), (41, 34)], BELLY, 2)
    c.e(2, 22, 14, 38, BELLY); c.e(5, 25, 11, 35, METAL)


def m_zombie(c):
    biped(c, (15, 4, 31, 20), (14, 18, 32, 38), cloth=BELLY, armw=4)
    c.r(32, 20, 44, 24, BELLY); c.e(41, 19, 46, 25, BODY)                  # reaching arm
    c.r(4, 21, 14, 25, BELLY); c.e(2, 20, 7, 26, BODY)
    c.r(18, 10, 20, 12, GLOW); c.r(26, 11, 27, 12, GLOW)
    c.l([(19, 16), (27, 17)], MOUTH); c.px(21, 17, WHITE)
    c.r(18, 26, 22, 30, BODY); c.l([(26, 30), (30, 36)], INK); c.px(24, 4, INK); c.l([(22, 3), (24, 6)], INK)


def m_ghoul(c):
    c.e(10, 18, 38, 38, BODY); c.e(14, 6, 32, 22, BODY)
    c.p([(13, 10), (8, 2), (17, 8)], BODY); c.p([(33, 10), (38, 2), (29, 8)], BODY)
    c.r(17, 12, 20, 14, GLOW); c.r(26, 12, 29, 14, GLOW)
    c.e(17, 16, 29, 22, MOUTH)
    for x in range(18, 29, 2):
        c.p([(x, 16), (x + 1, 19), (x + 2, 16)], WHITE)
    for x0, sgn in ((10, -1), (38, 1)):
        c.l([(x0, 24), (x0 + 6 * sgn, 34), (x0 + 3 * sgn, 42)], BODY, 3)
        for k in range(3):
            c.l([(x0 + 3 * sgn + k - 1, 42), (x0 + 3 * sgn + 2 * k - 2, 46)], HORN)
    c.e(14, 36, 22, 46, BODY); c.e(26, 36, 34, 46, BODY)
    for y in (24, 28, 32):
        c.l([(17, y), (31, y)], BELLY)


def m_wraith(c):
    c.p([(24, 4), (38, 18), (40, 34), (44, 46), (36, 40), (30, 46), (24, 40), (18, 46), (12, 40), (4, 46), (8, 34), (10, 18)], BODY)
    c.p([(24, 10), (32, 20), (30, 38), (24, 34), (18, 38), (16, 20)], INK)
    c.r(19, 18, 21, 20, GLOW); c.r(27, 18, 29, 20, GLOW)
    c.l([(10, 22), (2, 30), (4, 36)], BODY, 3); c.l([(38, 22), (46, 30), (44, 36)], BODY, 3)
    for x in (2, 4, 44, 46):
        c.px(x, 37, BELLY)
    c.p([(16, 6), (24, 0), (32, 6), (24, 12)], BELLY)


def m_bonehulk(c):
    c.e(8, 12, 40, 40, BODY)
    for y in range(18, 36, 5):
        c.l([(12, y), (36, y)], INK); c.l([(12, y + 1), (36, y + 1)], BODY)
    c.e(16, 2, 32, 18, BODY); c.e(18, 7, 22, 11, INK); c.e(26, 7, 30, 11, INK); c.px(20, 9, HOT); c.px(28, 9, HOT)
    c.r(19, 14, 29, 16, INK)
    c.e(0, 14, 12, 30, BODY); c.e(36, 14, 48, 30, BODY)
    c.p([(2, 16), (-2, 6), (6, 14)], HORN); c.p([(46, 16), (50, 6), (42, 14)], HORN)
    c.e(0, 28, 10, 40, BELLY); c.e(38, 28, 48, 40, BELLY)
    c.r(13, 38, 21, 46, BODY); c.r(27, 38, 35, 46, BODY)


def m_imp(c):
    c.p([(22, 20), (4, 6), (8, 16), (2, 20), (10, 22), (8, 28), (18, 26)], BELLY)
    c.p([(26, 20), (44, 6), (40, 16), (46, 20), (38, 22), (40, 28), (30, 26)], BELLY)
    c.e(16, 18, 32, 36, BODY); c.e(15, 4, 33, 22, BODY)
    c.p([(16, 8), (12, -2), (20, 6)], HORN); c.p([(32, 8), (36, -2), (28, 6)], HORN)
    c.r(19, 11, 21, 13, GLOW); c.r(27, 11, 29, 13, GLOW)
    c.p([(19, 16), (29, 16), (24, 20)], MOUTH); c.px(20, 16, WHITE); c.px(28, 16, WHITE)
    c.l([(30, 34), (40, 40), (44, 34)], BODY, 2); c.p([(43, 32), (47, 33), (44, 37)], BODY)
    c.r(18, 34, 21, 44, BODY); c.r(27, 34, 30, 44, BODY)


def m_hellhound(c):
    c.p([(40, 22), (47, 10), (46, 22)], HOT)
    m_wolf_body(c)
    for x in range(18, 38, 5):
        c.p([(x, 19), (x + 2, 11), (x + 4, 19)], HOT)
    c.r(9, 20, 10, 21, HOT); c.p([(1, 28), (-2, 32), (4, 31)], HOT)


def m_wolf_body(c):
    c.e(14, 18, 40, 34, BODY); c.e(16, 26, 36, 36, BELLY)
    legs4(c, (16, 22, 31, 36), 32, 44)
    c.p([(6, 20), (18, 14), (22, 24), (12, 30), (3, 27)], BODY)
    c.p([(12, 15), (14, 7), (18, 15)], BODY); c.p([(17, 15), (20, 8), (22, 17)], BODY)
    c.l([(4, 28), (11, 28)], MOUTH); c.px(6, 29, WHITE); c.px(9, 29, WHITE)


def m_tormentor(c):
    biped(c, (16, 4, 32, 20), (12, 18, 36, 38), cloth=BODY, armw=6, legw=6)
    c.p([(16, 8), (10, -2), (19, 5)], HORN); c.p([(32, 8), (38, -2), (29, 5)], HORN)
    c.r(19, 11, 21, 12, GLOW); c.r(27, 11, 29, 12, GLOW); c.l([(20, 16), (28, 16)], MOUTH)
    c.r(12, 26, 36, 29, BELLY); c.px(24, 27, GOLD)
    c.l([(40, 40), (40, 14)], BELLY, 2)
    for i in range(4):
        c.px(41, 15 + 4 * i, METAL)
    c.l([(40, 14), (46, 20), (44, 28)], METAL, 1)


def m_shade(c):
    c.p([(24, 2), (36, 14), (40, 30), (34, 46), (28, 40), (24, 46), (20, 40), (14, 46), (8, 30), (12, 14)], BODY)
    c.p([(24, 8), (31, 16), (33, 30), (24, 36), (15, 30), (17, 16)], INK)
    c.e(18, 16, 22, 20, GLOW); c.e(26, 16, 30, 20, GLOW); c.px(20, 18, WHITE); c.px(28, 18, WHITE)
    for x, y in ((6, 10), (42, 12), (4, 30), (44, 34), (10, 4)):
        c.r(x, y, x + 1, y + 1, BELLY)


def m_sprite(c):
    c.e(4, 6, 22, 22, BELLY); c.e(26, 6, 44, 22, BELLY); c.e(8, 20, 22, 32, BELLY); c.e(26, 20, 40, 32, BELLY)
    None
    c.e(19, 18, 29, 34, BODY); c.e(18, 6, 30, 19, SKIN); c.e(17, 4, 31, 12, BODY)
    eyes(c, 21, 12, 5, WHITE, 1); c.px(24, 16, MOUTH)
    c.l([(22, 34), (21, 40)], SKIN); c.l([(26, 34), (27, 40)], SKIN)
    for x, y in ((10, 36), (36, 38), (24, 44), (6, 28), (42, 26)):
        c.px(x, y, GLOW)
    c.l([(29, 26), (36, 22)], WOOD); c.px(37, 21, GLOW)


def m_thornling(c):
    c.e(12, 14, 36, 40, BODY)
    for a in range(0, 360, 30):
        x, y = 24 + 14 * math.cos(math.radians(a)), 27 + 14 * math.sin(math.radians(a))
        c.p([(24 + 10 * math.cos(math.radians(a - 8)), 27 + 10 * math.sin(math.radians(a - 8))), (x, y),
             (24 + 10 * math.cos(math.radians(a + 8)), 27 + 10 * math.sin(math.radians(a + 8)))], HORN)
    c.e(18, 4, 32, 14, BELLY); c.e(16, 6, 22, 12, LEAF); c.e(27, 2, 34, 9, LEAF)
    c.r(18, 22, 20, 24, GLOW); c.r(27, 22, 29, 24, GLOW); c.l([(20, 31), (24, 33), (28, 31)], MOUTH)
    c.l([(18, 40), (16, 46)], WOOD, 2); c.l([(30, 40), (32, 46)], WOOD, 2)


def m_hag(c):
    c.p([(14, 16), (34, 16), (40, 46), (8, 46)], BELLY)
    c.e(16, 6, 32, 22, BODY); c.p([(12, 4), (24, -2), (36, 4), (34, 12), (14, 12)], HAIR)
    c.l([(14, 10), (10, 26)], HAIR, 2); c.l([(34, 10), (38, 26)], HAIR, 2)
    c.r(19, 13, 21, 14, GLOW); c.r(27, 13, 29, 14, GLOW); c.p([(23, 14), (25, 14), (22, 20)], BODY)
    c.l([(20, 19), (28, 19)], MOUTH); c.px(22, 20, WHITE)
    c.l([(40, 46), (42, 12)], WOOD, 2); c.e(39, 6, 46, 13, GLOW)
    c.l([(34, 22), (40, 24)], BODY, 3); c.e(38, 22, 43, 27, BODY)
    for x in (39, 41, 43):
        c.px(x, 27, HORN)


def m_satyr(c):
    c.e(14, 16, 34, 32, SKIN); c.e(14, 26, 34, 36, BODY)
    c.l([(18, 34), (14, 40), (17, 46)], BODY, 4); c.l([(30, 34), (34, 40), (31, 46)], BODY, 4)
    c.r(13, 45, 18, 46, INK); c.r(30, 45, 35, 46, INK)
    c.e(16, 2, 32, 18, SKIN); c.e(15, 0, 33, 8, BODY)
    c.p([(16, 6), (8, 0), (10, 10)], HORN); c.p([(32, 6), (40, 0), (38, 10)], HORN)
    c.r(19, 9, 21, 10, EYE); c.r(27, 9, 29, 10, EYE); c.p([(20, 14), (28, 14), (24, 21)], BODY)
    c.r(8, 18, 14, 22, SKIN); c.r(34, 18, 40, 22, SKIN)
    c.l([(6, 14), (6, 26)], WOOD, 3); c.px(5, 17, INK); c.px(5, 21, INK)


def m_mephit(c):
    c.p([(24, 16), (6, 6), (10, 18), (4, 24), (16, 26)], BELLY); c.p([(24, 16), (42, 6), (38, 18), (44, 24), (32, 26)], BELLY)
    c.e(15, 8, 33, 26, BODY); c.e(17, 22, 31, 38, BODY)
    for x in (16, 22, 28):
        c.p([(x, 10), (x + 2, 1), (x + 4, 10)], BELLY)
    eyes(c, 19, 15, 7, GLOW, 1); c.l([(21, 21), (27, 21)], MOUTH)
    c.p([(20, 38), (24, 46), (28, 38)], BODY)
    for x, y in ((8, 32), (40, 32), (12, 40), (36, 42)):
        c.p([(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)], WHITE)


def m_geode(c):
    c.p([(8, 46), (4, 30), (12, 16), (24, 10), (36, 16), (44, 30), (40, 46)], STONE)
    c.p([(14, 40), (12, 26), (20, 16), (30, 18), (36, 28), (34, 40)], BODY)
    for x, y, h in ((18, 28, 12), (24, 22, 16), (30, 28, 11), (21, 34, 7), (28, 34, 8)):
        c.p([(x - 2, y + 4), (x, y - h // 2), (x + 2, y + 4)], BELLY if (x + y) % 2 else BODY)
    c.r(16, 36, 18, 37, GLOW); c.r(30, 36, 32, 37, GLOW)


def m_gale(c):
    for i, (r, y) in enumerate(((20, 8), (16, 20), (11, 30), (6, 38))):
        c.ring(24 - r, y, 24 + r, y + 8, BODY, 3)
        c.ring(24 - r + 3, y + 2, 24 + r - 3, y + 6, BELLY, 1)
    c.e(17, 12, 31, 26, BODY); eyes(c, 20, 17, 6, WHITE, 1); c.l([(22, 23), (26, 23)], MOUTH)
    c.l([(24, 44), (24, 47)], BODY, 2)
    for x, y in ((2, 14), (44, 18), (6, 30), (42, 34)):
        c.l([(x, y), (x + 3, y - 1)], WHITE)


def m_magmin(c):
    c.e(12, 14, 36, 40, BODY)
    for x, y in ((16, 20), (28, 18), (20, 32), (31, 30), (24, 26)):
        c.e(x, y, x + 4, y + 3, BELLY)
    c.e(14, 2, 34, 22, BODY)
    for x in (16, 22, 28):
        c.p([(x - 2, 6), (x + 1, -4), (x + 4, 6)], HOT); c.p([(x - 1, 6), (x + 1, 0), (x + 3, 6)], GLOW)
    c.e(18, 10, 22, 14, WHITE); c.e(26, 10, 30, 14, WHITE); c.r(19, 12, 20, 13, INK); c.r(27, 12, 28, 13, INK)
    c.e(20, 16, 28, 20, MOUTH); c.px(24, 17, GLOW)
    c.e(4, 22, 13, 30, BODY); c.e(35, 22, 44, 30, BODY)
    c.e(14, 38, 22, 46, BODY); c.e(26, 38, 34, 46, BODY)


def m_gargoyle(c):
    c.p([(20, 16), (2, 2), (4, 14), (0, 22), (8, 24), (6, 32), (16, 28)], BELLY)
    c.p([(28, 16), (46, 2), (44, 14), (48, 22), (40, 24), (42, 32), (32, 28)], BELLY)
    c.e(14, 16, 34, 38, BODY); c.e(15, 4, 33, 20, BODY)
    c.p([(16, 8), (12, -2), (19, 6)], HORN); c.p([(32, 8), (36, -2), (29, 6)], HORN)
    c.r(18, 11, 21, 12, GLOW); c.r(27, 11, 30, 12, GLOW); c.r(19, 16, 29, 18, INK)
    c.px(20, 16, WHITE); c.px(28, 16, WHITE)
    c.e(12, 34, 22, 46, BODY); c.e(26, 34, 36, 46, BODY)
    for x in (12, 15, 33, 36):
        c.px(x, 46, HORN)
    c.l([(18, 26), (22, 30)], INK); c.l([(30, 22), (27, 27)], INK)


def m_golem(c):
    c.r(10, 14, 38, 38, BODY)
    for y in (20, 28):
        c.l([(10, y), (38, y)], INK)
    c.l([(24, 14), (24, 20)], INK); c.l([(18, 28), (18, 38)], INK); c.l([(30, 20), (30, 28)], INK)
    c.r(16, 2, 32, 16, BODY); c.r(18, 7, 30, 9, INK); c.r(19, 7, 21, 8, BELLY); c.r(27, 7, 29, 8, BELLY)
    c.e(20, 22, 28, 30, BELLY); c.e(22, 24, 26, 28, WHITE)
    c.r(0, 14, 9, 30, BODY); c.r(39, 14, 48, 30, BODY); c.r(0, 30, 10, 38, STONE); c.r(38, 30, 48, 38, STONE)
    c.r(12, 38, 21, 46, BODY); c.r(27, 38, 36, 46, BODY)
    for x, y in ((3, 18), (43, 20), (14, 42), (32, 42)):
        c.px(x, y, BELLY)


def m_animatedarmour(c):
    biped(c, (17, 2, 31, 18), (13, 17, 35, 36), body=BODY, cloth=BODY, armw=5, legw=6)
    c.r(15, 9, 33, 10, INK); c.r(17, 9, 31, 10, BELLY); c.r(23, 2, 25, 16, BODY)
    c.p([(22, 2), (24, -4), (26, 2)], CLOTH)
    c.e(8, 15, 18, 23, BODY); c.e(30, 15, 40, 23, BODY)
    c.l([(24, 20), (24, 34)], INK)
    c.l([(14, 27), (34, 27)], INK); c.r(13, 35, 35, 37, BELLY)
    c.l([(44, 40), (44, 4)], METAL, 3); c.r(40, 38, 47, 39, GOLD); c.r(43, 40, 45, 45, LEATHER)
    for x, y in ((6, 26), (42, 30), (24, 44)):
        c.px(x, y, BELLY)


def m_dragonish(c, wings=True, size=1.0, neck=True):
    c.p([(32, 34), (44, 30), (48, 22), (44, 36), (34, 40)], BODY)                    # tail
    if wings:
        c.p([(26, 22), (34, 2), (46, 6), (42, 12), (46, 16), (38, 18), (40, 24)], BELLY)
        c.l([(28, 20), (34, 3)], BODY, 2); c.l([(34, 3), (45, 7)], BODY)
    c.e(12, 20, 38, 42, BODY); c.e(16, 30, 30, 42, BELLY)
    for x in range(16, 30, 4):
        c.l([(x, 32), (x + 3, 32)], BODY)
    if neck:
        c.l([(18, 26), (12, 16)], BODY, 7)
    c.e(2, 6, 18, 18, BODY); c.p([(0, 12), (6, 10), (6, 18), (0, 16)], BODY)
    c.p([(8, 8), (12, -2), (13, 8)], HORN); c.p([(13, 8), (18, 0), (17, 9)], HORN)
    c.r(9, 10, 10, 11, GLOW); c.l([(1, 15), (8, 16)], MOUTH); c.px(3, 16, WHITE); c.px(6, 16, WHITE)
    for x in (14, 20, 26, 32):
        c.p([(x, 21), (x + 2, 16), (x + 4, 22)], BELLY)
    legs4(c, (14, 30), 38, 44, BODY, 5, HORN)


def m_wyrmling(c):
    c.e(10, 22, 36, 44, BODY); c.e(15, 30, 30, 44, BELLY)
    c.p([(32, 36), (44, 34), (46, 26), (40, 40)], BODY)
    c.p([(24, 24), (34, 10), (42, 14), (36, 22), (32, 28)], BELLY); c.l([(26, 24), (34, 11)], BODY, 2)
    c.e(6, 4, 30, 26, BODY); c.e(4, 14, 16, 24, BELLY)
    c.p([(16, 6), (14, -2), (20, 5)], HORN); c.p([(24, 6), (28, 0), (27, 8)], HORN)
    c.e(16, 10, 22, 17, WHITE); c.r(17, 12, 19, 15, INK); c.px(17, 12, WHITE)
    c.l([(5, 21), (11, 22)], MOUTH); c.px(6, 18, INK)
    c.e(12, 40, 20, 46, BODY); c.e(24, 40, 32, 46, BODY)


def m_drake(c):
    m_dragonish(c, wings=False)
    c.p([(20, 22), (24, 12), (28, 22)], BELLY); c.p([(26, 22), (31, 14), (34, 23)], BELLY)
    c.p([(0, 18), (-3, 22), (3, 20)], HOT); c.p([(-1, 22), (-4, 26), (2, 23)], GLOW)


def m_wyvern(c):
    c.p([(24, 22), (2, 2), (8, 10), (2, 14), (10, 18), (4, 24), (16, 26)], BELLY)
    c.l([(22, 22), (2, 2)], BODY, 2)
    m_dragonish(c, wings=True, neck=True)
    c.p([(44, 22), (48, 18), (47, 26)], HORN)


def m_ogre(c):
    c.e(6, 14, 42, 42, BODY); c.e(12, 26, 36, 42, BELLY)
    c.r(8, 32, 40, 36, LEATHER)
    c.e(16, 2, 32, 20, BODY); c.r(18, 9, 21, 11, GLOW); c.r(27, 9, 30, 11, GLOW); c.r(16, 7, 32, 8, INK)
    c.r(20, 15, 28, 17, MOUTH); c.p([(20, 15), (21, 11), (22, 15)], WHITE); c.p([(26, 15), (27, 11), (28, 15)], WHITE)
    c.e(14, 6, 18, 12, BODY); c.e(30, 6, 34, 12, BODY)
    c.e(0, 18, 10, 36, BODY); c.l([(4, 34), (2, 10)], WOOD, 5); c.e(-2, 2, 8, 14, WOOD)
    for x, y in ((0, 6), (6, 4), (3, 12)):
        c.px(x, y, METAL)
    c.e(38, 18, 48, 34, BODY)
    c.r(12, 40, 21, 46, BODY); c.r(27, 40, 36, 46, BODY)


def m_troll(c):
    c.e(10, 10, 38, 36, BODY); c.e(16, 22, 32, 36, BELLY)
    c.e(14, 0, 30, 16, BODY); c.p([(14, 4), (22, -1), (32, 4), (24, 2)], LEAF)
    c.p([(20, 9), (14, 12), (20, 13)], BODY)
    c.r(16, 6, 18, 7, GLOW); c.r(24, 6, 26, 7, GLOW); c.l([(17, 12), (27, 13)], MOUTH); c.p([(18, 13), (19, 10), (20, 13)], WHITE)
    c.l([(10, 18), (4, 34), (6, 44)], BODY, 4); c.l([(38, 18), (44, 34), (42, 44)], BODY, 4)
    for x in (4, 7, 41, 44):
        c.px(x, 46, HORN)
    c.r(14, 34, 21, 46, BODY); c.r(27, 34, 34, 46, BODY)
    c.r(12, 30, 36, 34, LEATHER)


def m_frostgiant(c):
    c.e(10, 14, 38, 40, BODY); c.r(10, 24, 38, 34, METAL); c.r(23, 24, 25, 34, TRIM)
    c.e(16, 2, 32, 18, BODY); c.p([(16, 12), (32, 12), (30, 24), (24, 28), (18, 24)], BELLY)
    c.r(19, 8, 21, 9, GLOW); c.r(27, 8, 29, 9, GLOW)
    c.p([(16, 6), (12, -1), (20, 3)], METAL); c.p([(32, 6), (36, -1), (28, 3)], METAL); c.r(16, 2, 32, 5, METAL)
    c.e(2, 16, 12, 34, BODY); c.e(36, 16, 46, 34, BODY)
    c.l([(44, 40), (44, 4)], WOOD, 2); c.p([(38, 2), (44, 6), (48, 2), (48, 14), (44, 10), (38, 14)], METAL)
    c.r(13, 38, 21, 46, BODY); c.r(27, 38, 35, 46, BODY)
    for x, y in ((6, 6), (40, 22), (4, 40)):
        c.p([(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)], WHITE)


def m_slime(c):
    # a low, spreading mound with drips and a bubble core: wide and irregular, no teardrop
    c.p([(2, 46), (4, 38), (10, 32), (14, 24), (22, 20), (32, 22), (38, 28), (44, 36), (46, 46)], BODY)
    for x, h in ((6, 3), (17, 2), (30, 4), (41, 2)):
        c.e(x - 2, 44, x + 2, 44 + h, BODY)
    c.e(14, 30, 26, 40, BELLY); c.e(28, 34, 34, 40, BELLY); c.e(36, 38, 40, 42, BELLY)
    None
    c.r(16, 28, 18, 30, INK); c.r(28, 27, 30, 29, INK); c.px(16, 28, WHITE); c.px(28, 27, WHITE)
    c.px(9, 40, WHITE); c.px(38, 32, WHITE)
    c.l([(24, 20), (25, 14), (28, 12)], BODY, 2); c.e(27, 9, 31, 13, BELLY)


def m_jelly(c):
    c.e(6, 2, 42, 26, BODY); c.e(10, 6, 26, 16, BELLY)
    for i, x in enumerate(range(9, 40, 5)):
        c.l([(x, 22), (x + (2 if i % 2 else -2), 32), (x, 40 + (i % 3) * 2)], BODY, 2)
    c.e(16, 12, 20, 16, INK); c.e(28, 12, 32, 16, INK); c.px(17, 13, WHITE); c.px(29, 13, WHITE)
    c.e(20, 18, 28, 22, BELLY)


def m_pudding(c):
    c.p([(0, 46), (2, 36), (8, 30), (12, 34), (18, 26), (26, 28), (32, 22), (40, 30), (46, 38), (48, 46)], BODY)
    for x, y, r in ((10, 38, 4), (22, 34, 5), (36, 36, 3), (30, 42, 3)):
        c.e(x - r, y - r, x + r, y + r, BELLY)
    c.r(22, 32, 26, 33, HORN)
    c.l([(14, 42), (18, 40)], HORN); c.e(32, 26, 35, 29, INK); c.e(39, 31, 42, 34, INK); c.px(33, 27, GLOW); c.px(40, 32, GLOW)


def m_gazer(c):
    for a in (-60, -30, 0, 30, 60):
        x = 24 + 18 * math.sin(math.radians(a)); y = 8 - 6 * math.cos(math.radians(a)) + 6
        c.l([(24 + 8 * math.sin(math.radians(a)), 14), (x, y - 6)], BODY, 2); c.e(x - 2, y - 9, x + 2, y - 5, GLOW)
    c.e(6, 10, 42, 44, BODY); c.e(14, 16, 34, 34, WHITE); c.e(19, 20, 29, 30, BELLY); c.e(22, 23, 26, 27, INK); c.px(22, 22, WHITE)
    c.l([(14, 38), (34, 38)], MOUTH, 2)
    for x in range(16, 33, 4):
        c.p([(x, 37), (x + 2, 41), (x + 3, 37)], WHITE)


def m_mindworm(c):
    for i in range(6):
        x, y = 34 - i * 4, 40 - abs(3 - i) * 3
        c.e(x - 6, y - 6, x + 6, y + 6, BODY if i % 2 else BELLY)
    c.e(4, 12, 22, 30, BODY); c.e(6, 14, 20, 28, BELLY)
    for k in range(6):
        a = math.radians(140 + k * 16)
        c.l([(13, 21), (13 + 14 * math.cos(a), 21 + 14 * math.sin(a))], BODY, 2)
    c.e(9, 17, 17, 25, MOUTH); c.e(11, 19, 15, 23, INK)
    for x, y in ((8, 14), (18, 14), (6, 24)):
        c.px(x, y, GLOW)


def m_voidspawn(c):
    c.e(8, 10, 40, 42, BODY)
    for a in range(0, 360, 45):
        x, y = 24 + 22 * math.cos(math.radians(a)), 26 + 20 * math.sin(math.radians(a))
        c.l([(24 + 12 * math.cos(math.radians(a)), 26 + 12 * math.sin(math.radians(a))), (x, y)], BODY, 3)
    c.e(14, 16, 34, 36, INK)
    for x, y in ((18, 20), (27, 19), (22, 28), (30, 27), (17, 30)):
        c.r(x, y, x + 1, y + 1, BELLY)
    c.e(21, 22, 26, 27, GLOW)


def m_chimera(c):
    c.l([(36, 24), (44, 14), (46, 6)], BODY, 2); c.e(42, 2, 48, 8, LEAF); c.px(45, 4, HOT)  # serpent tail
    c.p([(24, 18), (34, 2), (42, 6), (36, 18)], BELLY)
    c.e(12, 18, 40, 36, BODY); c.e(16, 26, 34, 37, BELLY)
    legs4(c, (14, 20, 30, 35), 32, 44, BODY, 4, HORN)
    c.e(0, 12, 18, 30, BELLY); c.e(4, 16, 16, 28, BODY)
    c.r(7, 19, 8, 20, GLOW); c.l([(4, 25), (10, 26)], MOUTH); c.px(5, 26, WHITE)
    c.e(16, 6, 28, 18, HORN)
    c.p([(20, 8), (18, 0), (23, 6)], INK); c.r(19, 11, 20, 12, GLOW)


def m_basilisk(c):
    c.e(10, 22, 42, 38, BODY); c.e(14, 30, 38, 40, BELLY)
    c.p([(38, 30), (48, 36), (40, 38)], BODY)
    for x in range(12, 40, 4):
        c.p([(x, 24), (x + 2, 16), (x + 4, 24)], BELLY)
    for x in (12, 18, 24, 30, 36):
        c.r(x, 36, x + 3, 44, BODY); c.px(x - 1, 45, HORN); c.px(x + 3, 45, HORN)
    c.e(0, 18, 18, 34, BODY); c.r(3, 23, 7, 26, GLOW); c.r(11, 23, 15, 26, GLOW); c.px(5, 24, INK); c.px(13, 24, INK)
    c.l([(1, 30), (10, 31)], MOUTH)


def m_harpy(c):
    c.p([(20, 18), (0, 6), (4, 18), (0, 24), (8, 26), (6, 32), (16, 30)], BODY)
    c.p([(28, 18), (48, 6), (44, 18), (48, 24), (40, 26), (42, 32), (32, 30)], BODY)
    for x in (4, 8, 12):
        c.l([(x, 12), (x + 6, 22)], BELLY); c.l([(48 - x, 12), (42 - x, 22)], BELLY)
    c.e(17, 16, 31, 34, SKIN); c.e(17, 28, 31, 38, BODY)
    c.e(17, 4, 31, 18, SKIN); c.e(15, 1, 33, 10, HAIR); c.r(15, 6, 17, 18, HAIR); c.r(31, 6, 33, 18, HAIR)
    c.r(20, 11, 21, 12, GLOW); c.r(27, 11, 28, 12, GLOW); c.l([(22, 15), (26, 15)], MOUTH)
    c.l([(20, 38), (18, 44)], GOLD, 2); c.l([(28, 38), (30, 44)], GOLD, 2)
    for x in (16, 18, 20, 28, 30, 32):
        c.px(x, 45, HORN)


def m_crab(c):
    c.e(8, 18, 40, 38, BODY); c.e(12, 28, 36, 38, BELLY)
    for k in range(3):
        c.l([(12, 32 + 2 * k), (4, 38 + 3 * k), (2, 46)], BODY, 2); c.l([(36, 32 + 2 * k), (44, 38 + 3 * k), (46, 46)], BODY, 2)
    c.l([(12, 22), (6, 14)], BODY, 3); c.l([(36, 22), (42, 14)], BODY, 3)
    c.p([(0, 4), (10, 2), (12, 12), (4, 14)], BODY); c.p([(1, 9), (8, 8), (6, 11)], INK)
    c.p([(48, 4), (38, 2), (36, 12), (44, 14)], BODY); c.p([(47, 9), (40, 8), (42, 11)], INK)
    c.l([(19, 18), (18, 12)], BODY); c.l([(29, 18), (30, 12)], BODY); c.e(16, 9, 20, 13, WHITE); c.e(28, 9, 32, 13, WHITE)
    c.px(18, 12, INK); c.px(30, 12, INK); c.l([(20, 30), (28, 30)], MOUTH)


def m_blight(c):
    c.p([(10, 46), (12, 30), (16, 14), (24, 8), (32, 14), (36, 30), (38, 46)], BODY)
    for x in (12, 18, 30, 36):
        c.l([(x, 46), (x - 4 if x < 24 else x + 4, 47)], BODY, 2)
    c.l([(14, 22), (4, 12), (2, 4)], BODY, 2); c.l([(34, 22), (44, 14), (46, 6)], BODY, 2); c.l([(6, 14), (10, 10)], BODY)
    for x, y in ((2, 4), (46, 6), (10, 10), (24, 6)):
        c.e(x - 3, y - 3, x + 3, y + 3, BELLY)
    c.e(16, 20, 22, 26, INK); c.e(26, 20, 32, 26, INK); c.px(19, 23, GLOW); c.px(29, 23, GLOW)
    c.p([(18, 32), (30, 32), (27, 38), (21, 38)], INK)
    c.l([(28, 12), (31, 18)], INK)


def m_myconid(c):
    c.e(2, 2, 46, 26, BODY); c.e(8, 18, 40, 26, BELLY)
    for x, y, r in ((10, 8, 3), (22, 5, 4), (34, 9, 3), (16, 15, 2), (38, 16, 2)):
        c.e(x - r, y - r, x + r, y + r, WHITE)
    c.e(14, 22, 34, 44, BELLY); c.r(19, 28, 21, 30, INK); c.r(27, 28, 29, 30, INK); c.l([(21, 35), (24, 37), (27, 35)], MOUTH)
    c.e(14, 40, 22, 46, BELLY); c.e(26, 40, 34, 46, BELLY)
    c.l([(14, 30), (6, 38)], BELLY, 3); c.l([(34, 30), (42, 38)], BELLY, 3)
    for x, y in ((6, 32), (42, 30), (24, 46)):
        c.px(x, y, GLOW)


def m_treant(c):
    c.e(2, 0, 46, 22, LEAF); c.e(8, 4, 20, 14, BELLY); c.e(28, 2, 40, 12, BELLY)
    c.r(14, 14, 34, 46, BODY)
    for x in (17, 22, 27, 31):
        c.l([(x, 16), (x + (1 if x % 2 else -1), 44)], INK)
    c.r(18, 22, 21, 25, GLOW); c.r(27, 22, 30, 25, GLOW); c.e(20, 30, 28, 36, INK)
    c.l([(14, 22), (4, 30), (2, 40)], BODY, 4); c.l([(34, 22), (44, 30), (46, 40)], BODY, 4)
    for x in (0, 3, 45, 48):
        c.l([(x, 40), (x + (2 if x < 24 else -2), 44)], BODY)
    c.p([(10, 46), (14, 40), (20, 46)], BODY); c.p([(28, 46), (34, 40), (38, 46)], BODY)
    c.px(14, 6, HOT); c.px(36, 8, HOT); c.px(24, 4, HOT)


def m_lanternspirit(c):
    c.r(18, 2, 30, 4, METAL); c.r(23, 0, 25, 2, METAL)
    c.p([(16, 4), (32, 4), (36, 12), (34, 34), (14, 34), (12, 12)], METAL)
    c.p([(17, 7), (31, 7), (33, 13), (31, 31), (17, 31), (15, 13)], BODY)
    c.e(18, 12, 30, 30, GLOW); c.r(23, 6, 25, 34, METAL); c.l([(14, 20), (34, 20)], METAL)
    c.r(20, 17, 21, 18, INK); c.r(27, 17, 28, 18, INK); c.e(22, 23, 26, 26, INK)
    c.p([(16, 34), (32, 34), (28, 44), (24, 40), (20, 44)], BELLY)
    for x, y in ((6, 12), (42, 16), (8, 30), (40, 34)):
        c.r(x, y, x + 1, y + 1, GLOW)


def m_haloknight(c):
    c.ring(12, 0, 36, 10, GLOW, 2)
    c.p([(20, 20), (2, 10), (6, 22), (2, 28), (16, 30)], WHITE); c.p([(28, 20), (46, 10), (42, 22), (46, 28), (32, 30)], WHITE)
    biped(c, (17, 4, 31, 19), (14, 18, 34, 37), body=BODY, cloth=BODY, armw=4, legw=6)
    c.r(17, 10, 31, 11, INK); c.r(19, 10, 29, 11, GLOW); c.r(14, 26, 34, 29, BELLY); c.p([(22, 18), (26, 18), (24, 26)], BELLY)
    c.l([(42, 44), (42, 6)], GOLD, 2); c.p([(39, 8), (42, 0), (45, 8)], GLOW)
    c.e(2, 22, 14, 38, BELLY); c.r(7, 25, 9, 35, BODY); c.r(4, 29, 12, 31, BODY)


DESIGNS = {
    'wolf': m_wolf, 'bat': m_bat, 'serpent': m_serpent, 'boar': m_boar, 'spider': m_spider, 'hawk': m_hawk, 'bear': m_bear,
    'goblin': m_goblin, 'orc': m_orc, 'bandit': m_bandit, 'apostate': m_apostate, 'fenfolk': m_fenfolk, 'hexer': m_hexer, 'sentry': m_sentry,
    'skeleton': m_skeleton, 'zombie': m_zombie, 'ghoul': m_ghoul, 'wraith': m_wraith, 'bonehulk': m_bonehulk,
    'imp': m_imp, 'hellhound': m_hellhound, 'tormentor': m_tormentor, 'shade': m_shade,
    'sprite': m_sprite, 'thornling': m_thornling, 'hag': m_hag, 'satyr': m_satyr,
    'mephit': m_mephit, 'geode': m_geode, 'gale': m_gale, 'magmin': m_magmin,
    'gargoyle': m_gargoyle, 'golem': m_golem, 'animatedarmour': m_animatedarmour,
    'wyrmling': m_wyrmling, 'drake': m_drake, 'wyvern': m_wyvern,
    'ogre': m_ogre, 'troll': m_troll, 'frostgiant': m_frostgiant,
    'slime': m_slime, 'jelly': m_jelly, 'pudding': m_pudding,
    'gazer': m_gazer, 'mindworm': m_mindworm, 'voidspawn': m_voidspawn,
    'chimera': m_chimera, 'basilisk': m_basilisk, 'harpy': m_harpy, 'crab': m_crab,
    'blight': m_blight, 'myconid': m_myconid, 'treant': m_treant,
    'lanternspirit': m_lanternspirit, 'haloknight': m_haloknight,
}
SKIN_SUBS = {'bandit', 'hexer', 'hag', 'satyr', 'harpy', 'sprite', 'apostate'}


def monster_palette(sub, variant='base', boss=None):
    body, belly = MON_COL[sub]
    if variant != 'base':
        body = R.VARIANT_BODY[variant]
        belly = mix(belly, body, 0.35)
    if boss is not None:
        body = mix(body, R.BOSS_BODY[boss], 0.55)
        belly = mix(belly, (232, 186, 60), 0.3)
    return {BODY: body, BELLY: belly, CLOTH: body, TRIM: (226, 178, 58), PANTS: mix(body, (40, 34, 50), 0.5), BOOT: (80, 56, 44),
            METAL: (170, 176, 194), WOOD: (130, 88, 52), LEATHER: (120, 82, 52), HORN: (236, 226, 200), HAIR: (60, 56, 70),
            SKIN: (226, 180, 146) if sub != 'hag' else (150, 176, 120), LEAF: (90, 160, 70), STONE: (120, 116, 130), GOLD: (236, 190, 64),
            CAPE: mix(body, (40, 30, 50), 0.4)}


def monster(sub, variant='base', boss=None):
    c = C(MW, MH)
    DESIGNS[sub](c)
    c.flip()                      # drawn facing left; stored facing right like the other sets (combat mirrors foes)
    pal = monster_palette(sub, variant, boss)
    if boss is None:
        return shade(c, pal, ground_shadow=True)
    big = C(MW + 8, MH + 8)
    big.im.paste(c.im, (4, 8))
    a = np.array(big.im)
    top = np.where(a.any(axis=1))[0][0]
    xs = np.where(a[top:top + 3].any(axis=0))[0]
    cx = int(round((xs[0] + xs[-1]) / 2))
    y = max(0, top - 7)
    big.p([(cx - 7, y + 7), (cx - 7, y + 1), (cx - 4, y + 4), (cx, y), (cx + 4, y + 4), (cx + 7, y + 1), (cx + 7, y + 7)], GOLD)
    big.px(cx, y + 4, HOT); big.px(cx - 5, y + 5, GLOW); big.px(cx + 5, y + 5, GLOW)
    im = shade(big, pal, ground_shadow=True)
    # aura: a soft glow ring behind the silhouette
    alpha = np.array(im)[..., 3] > 0
    ring = ndimage.binary_dilation(alpha, iterations=2) & ~alpha
    aura_col = [(255, 120, 80), (180, 120, 255), (150, 255, 200)][boss]
    arr = np.array(im)
    arr[ring] = (*aura_col, 110)
    return Image.fromarray(arr, 'RGBA')


# ---------------------------------------------------------------- field props (16x16, over each biome's own ground)
BIOME_GROUP = {'desert': 'sand', 'badlands': 'sand', 'savanna': 'sand', 'oasis': 'sand', 'snow': 'snow', 'frozen': 'snow',
               'marsh': 'swamp', 'corruption': 'swamp', 'dusk': 'swamp', 'ruins': 'swamp', 'mushroom': 'swamp', 'volcanic': 'lava',
               'crystal': 'mystic', 'aether': 'mystic', 'sky': 'mystic'}
FOLIAGE = {'green': (72, 156, 64), 'sand': (120, 150, 60), 'snow': (60, 120, 100), 'swamp': (90, 120, 70), 'lava': (110, 90, 70), 'mystic': (110, 150, 210)}
ROOFS = {'shop': (60, 100, 190), 'inn': (190, 60, 50), 'temple': (226, 178, 58), 'keep': (170, 50, 50)}
PROPS = ['tree', 'pine', 'dense', 'single', 'rock', 'peak', 'shop', 'inn', 'shrine', 'statue', 'temple', 'arena', 'keep', 'keepdoor', 'wall', 'gate']


def prop(key, group):
    c = C(16, 16)
    snow = group == 'snow'
    if key == 'tree':
        c.r(7, 10, 8, 15, BARK); c.px(6, 15, BARK); c.px(9, 15, BARK)
        c.e(1, 1, 14, 12, LEAF); c.e(3, 3, 8, 7, HAT); c.px(10, 8, GOLD if group == 'green' else LEAF)
    elif key == 'single':
        c.r(7, 11, 8, 15, BARK); c.e(3, 3, 12, 12, LEAF); c.e(5, 4, 8, 7, HAT)
    elif key == 'dense':
        c.r(3, 11, 4, 15, BARK); c.r(11, 12, 12, 15, BARK)
        c.e(-1, 2, 9, 12, LEAF); c.e(7, 0, 16, 11, LEAF); c.e(4, 7, 12, 14, LEAF); c.e(1, 3, 5, 6, HAT); c.e(9, 1, 13, 4, HAT)
    elif key == 'pine':
        c.r(7, 13, 8, 15, BARK)
        for y0, hw in ((1, 3), (4, 5), (7, 6), (10, 7)):
            c.p([(7.5, y0), (7.5 - hw, y0 + 4), (7.5 + hw, y0 + 4)], LEAF)
        if snow:
            for y0, hw in ((1, 2), (4, 3), (7, 4)):
                c.p([(7.5, y0), (7.5 - hw, y0 + 2), (7.5 + hw, y0 + 2)], WHITE)
    elif key == 'rock':
        c.p([(1, 15), (2, 9), (6, 5), (11, 6), (14, 10), (15, 15)], STONE); c.p([(5, 8), (8, 7), (7, 10)], HAT)
        c.l([(9, 9), (11, 13)], INK)
    elif key == 'peak':
        c.p([(0, 15), (8, 1), (16, 15)], STONE); c.p([(8, 1), (5, 6), (7, 7), (8, 6), (10, 8), (11, 6)], WHITE)
        c.l([(8, 6), (6, 12)], HAT)
    elif key in ('shop', 'inn', 'temple'):
        c.r(2, 8, 13, 15, WALL)
        c.p([(0, 9), (8, 1), (15, 9)], ROOF)
        c.l([(1, 9), (14, 9)], TRIM)
        c.r(4, 11, 6, 13, GLOW); c.l([(5, 11), (5, 13)], WOOD)
        c.r(9, 11, 11, 15, WOOD); c.px(10, 13, GOLD)
        if key == 'inn':
            c.r(11, 2, 12, 6, STONE); c.l([(14, 10), (14, 12)], WOOD); c.r(13, 12, 15, 13, GOLD)
        if key == 'shop':
            c.r(2, 10, 7, 10, CLOTH); c.px(3, 10, WHITE); c.px(5, 10, WHITE)
        if key == 'temple':
            c.r(7, 4, 8, 7, GLOW); c.r(3, 9, 3, 15, WHITE); c.r(12, 9, 12, 15, WHITE)
    elif key == 'shrine':
        c.r(4, 13, 11, 15, STONE); c.r(5, 3, 10, 13, STONE); c.p([(4, 4), (7.5, 0), (11, 4)], STONE)
        c.e(6, 5, 9, 9, GLOW); c.px(7, 6, WHITE)
    elif key == 'statue':
        c.r(3, 12, 12, 15, STONE); c.r(5, 10, 10, 12, STONE)
        c.e(5, 1, 10, 5, HAT); c.r(6, 5, 9, 10, HAT); c.l([(10, 6), (12, 2)], HAT); c.px(12, 1, GLOW)
    elif key == 'arena':
        c.r(0, 6, 15, 15, WALL); c.e(3, 8, 12, 15, GROUND)
        for x in range(0, 16, 3):
            c.r(x, 4, x + 1, 6, WALL)
        c.l([(7, 0), (7, 4)], WOOD); c.p([(8, 0), (12, 1), (8, 2)], CLOTH)
    elif key in ('wall', 'keep', 'keepdoor', 'gate'):
        c.r(0, 3, 15, 15, WALL)
        for x in range(0, 16, 4):
            c.r(x, 0, x + 2, 3, WALL)
        for y in (6, 10, 14):
            c.l([(0, y), (15, y)], INK)
            for x in range(1 if y % 8 == 6 else 3, 16, 4):
                c.l([(x, y - 3), (x, y - 1)], INK)
        if key == 'keep':
            c.p([(3, 6), (8, 1), (13, 6)], ROOF); c.r(6, 8, 9, 11, GLOW); c.l([(7.5, 8), (7.5, 11)], INK)
            c.l([(8, -1), (8, 1)], WOOD)
        if key in ('keepdoor', 'gate'):
            c.r(4, 7, 11, 15, WOOD); c.p([(4, 8), (7.5, 5), (11, 8)], WOOD)
            for x in (6, 9):
                c.l([(x, 8), (x, 15)], INK)
            if key == 'gate':
                for y in (9, 12):
                    c.l([(4, y), (11, y)], METAL)
            c.px(10, 11, GOLD)
    return c


def prop_palette(key, group):
    leaf = FOLIAGE[group]
    hl = mix((138, 134, 146), (240, 240, 250), 0.4) if key in ('rock', 'peak') else mix(leaf, (250, 250, 200), 0.35)
    return {LEAF: leaf, HAT: hl, BARK: (110, 74, 46), STONE: (138, 134, 146) if group != 'lava' else (96, 80, 80),
            WALL: (214, 196, 160) if key in ('shop', 'inn', 'temple') else (158, 156, 168), ROOF: ROOFS.get(key, (170, 50, 50)),
            TRIM: (110, 70, 40), WOOD: (126, 84, 50), GOLD: (236, 190, 64), CLOTH: (200, 60, 60), GROUND: (200, 170, 120), METAL: (150, 150, 166)}


def prop_tile(biome, key):
    group = BIOME_GROUP.get(biome, 'green')
    base_key = 'grass'
    ground = Image.open(OUT / f'gt_{biome}_{base_key}.png').convert('RGBA')
    if key in ('keep', 'keepdoor', 'wall', 'gate'):
        ground = Image.open(OUT / f'gt_{biome}_cobble.png').convert('RGBA') if (OUT / f'gt_{biome}_cobble.png').exists() else ground
    fg = shade(prop(key, group), prop_palette(key, group), strength=2.2, ground_shadow=key not in ('wall', 'keep', 'keepdoor', 'gate', 'arena'))
    out = ground.copy(); out.alpha_composite(fg)
    return out


def biomes():
    return sorted({p.name.split('_')[1] for p in OUT.glob('gt_*_grass.png') if not p.name.split('_')[1].startswith(('r8', 'ka', 'fd'))})


# ---------------------------------------------------------------- build
def save(im, path):
    """few-colour sprites: store as an indexed PNG (RGBA kept exactly when it fits in 256 colours)"""
    a = np.array(im.convert('RGBA'))
    a[a[..., 3] == 0] = 0
    flat = a.reshape(-1, 4)
    cols, idx = np.unique(flat, axis=0, return_inverse=True)
    if len(cols) > 256:
        im.save(path, optimize=True); return
    p = Image.fromarray(idx.reshape(a.shape[:2]).astype(np.uint8), 'P')
    p.putpalette(cols[:, :3].astype(np.uint8).flatten().tolist())
    p.save(path, optimize=True, transparency=bytes(cols[:, 3].astype(np.uint8).tolist()))


def build():
    n = 0
    for name, look in CLASS_LOOK.items():
        for species in (SPECIES_LOOK if name in HERO_CLASSES else ('hearthkin',)):
            tag = name if species == 'hearthkin' else f'{name}_{species}'
            for d in ('down', 'up', 'side'):
                for f in (0, 1):
                    save(walker(name, look, d, f, species), OUT / f'fdw_{tag}_{d}{f}.png'); n += 1
    for role in R.NPC_ALL:
        for k in (0, 1):
            save(townsfolk(role, bool(k)), OUT / f'fdn_{role}_{k}.png'); n += 1
        if role != 'realmstone':                        # walking frames for townsfolk that wander (src/npc_ai.js)
            for d in ('down', 'up', 'side'):
                for f in (0, 1):
                    save(townsfolk(role, False, d, f), OUT / f'fdn_{role}_{d}{f}.png'); n += 1
    for sub in DESIGNS:
        for v in R.VARIANTS:
            save(monster(sub, v), OUT / f'fdm_{sub}_{v}.png'); n += 1
        for b in range(3):
            save(monster(sub, boss=b), OUT / f'fdb_{sub}_{b}.png'); n += 1
    for biome in biomes():
        for key in PROPS:
            save(prop_tile(biome, key), OUT / f'gt_fd{biome}_{key}.png'); n += 1
    return n


def contact_sheet(path):
    S = 3
    names = list(CLASS_LOOK)
    rows = []
    row = Image.new('RGBA', (len(names) * 17 * S, 25 * S), (60, 96, 60, 255))
    for i, nme in enumerate(names):
        row.alpha_composite(walker(nme, CLASS_LOOK[nme], 'down', 0).resize((16 * S, 24 * S), Image.NEAREST), (i * 17 * S, 0))
    rows.append(row)
    row = Image.new('RGBA', (len(R.NPC_ALL) * 17 * S // 2 + 17 * S, 50 * S), (60, 96, 60, 255))
    for i, r in enumerate(R.NPC_ALL):
        row.alpha_composite(townsfolk(r).resize((16 * S, 24 * S), Image.NEAREST), ((i % (len(R.NPC_ALL) // 2 + 1)) * 17 * S, (i // (len(R.NPC_ALL) // 2 + 1)) * 25 * S))
    rows.append(row)
    subs = list(DESIGNS)
    cols = 14
    row = Image.new('RGBA', (cols * 50 * S // 2, ((len(subs) + cols - 1) // cols) * 50 * S // 2), (40, 44, 64, 255))
    for i, s in enumerate(subs):
        row.alpha_composite(monster(s).resize((72, 72), Image.NEAREST), ((i % cols) * 75, (i // cols) * 75))
    rows.append(row)
    row = Image.new('RGBA', (len(PROPS) * 17 * S, 6 * 17 * S), (0, 0, 0, 255))
    for j, b in enumerate(['meadow', 'desert', 'snow', 'marsh', 'volcanic', 'crystal']):
        for i, k in enumerate(PROPS):
            row.alpha_composite(prop_tile(b, k).resize((16 * S, 16 * S), Image.NEAREST), (i * 17 * S, j * 17 * S))
    rows.append(row)
    W = max(r.width for r in rows)
    sheet = Image.new('RGBA', (W, sum(r.height + 6 for r in rows)), (20, 20, 30, 255))
    y = 0
    for r in rows:
        sheet.alpha_composite(r, (0, y)); y += r.height + 6
    sheet.save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--no-write', action='store_true')
    a = ap.parse_args()
    if not a.no_write:
        print(f'wrote {build()} FULL DETAIL images to assets/')
    if a.sheet:
        contact_sheet(a.sheet)
