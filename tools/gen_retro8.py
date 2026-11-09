#!/usr/bin/env python3
"""RETRO 8-BIT art set: original overworld tiles and battle monsters in a classic 8-bit console-RPG style.

Everything here is drawn from scratch by code (no third-party sprites are read or copied):
  * overworld tiles   assets/gt_r8<palette>_<key>.png   16x16, every key the zone renderer asks for
                      (grass, forest, mountains, auto-tiled water and roads, towns, castles...) in six terrain palettes
  * battle monsters   assets/r8m_<subtype>_<variant>.png 40x40, one design per bestiary subtype, palette-swapped
                      for the seven element variants (base, ember, frost, venom, shadow, gilded, ash)
  * boss versions     assets/r8b_<subtype>_<k>.png       40x46, crowned, three regal palettes

    python tools/gen_retro8.py             # writes the PNGs into assets/
    python tools/gen_retro8.py --sheet X   # also writes a contact sheet to X for review
"""
import argparse
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'assets'
INK = (24, 18, 32)

# ============================================================== colour helpers
def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def ramp(base):
    """dark, base, light: the three-step shading every 8-bit sprite colour gets"""
    dark = mix(tuple(int(c * 0.58) for c in base), (24, 12, 56), 0.22)
    light = mix(base, (255, 250, 228), 0.42)
    return dark, tuple(base), light


# ============================================================== monsters
# material ids drawn into an 'L' canvas, then shaded and outlined
BODY, ACC, STEEL, BONE, WOOD, MOUTH, WHITE, DARK, GLOW, HOT, SHINE, GOLD, SKIN, STONE = range(1, 15)
FIXED = {STEEL: (150, 158, 176), BONE: (226, 216, 186), WOOD: (138, 92, 52), GOLD: (226, 178, 58), SKIN: (232, 176, 132), STONE: (124, 118, 112)}
FLAT = {MOUTH: (128, 24, 44), WHITE: (248, 248, 238), DARK: INK, GLOW: (255, 226, 80), HOT: (255, 76, 52), SHINE: (255, 255, 255)}
RAMPED = (BODY, ACC, STEEL, BONE, WOOD, GOLD, SKIN, STONE)

FAMILY_COLOURS = {
    'beast': ((150, 96, 56), (226, 196, 150)), 'humanoid': ((92, 156, 64), (150, 92, 52)), 'undead': ((206, 200, 178), (112, 80, 124)),
    'fiend': ((204, 50, 50), (70, 36, 52)), 'fey': ((232, 118, 184), (118, 196, 92)), 'elemental': ((240, 130, 40), (255, 214, 96)),
    'construct': ((132, 140, 156), (88, 160, 204)), 'dragon': ((62, 150, 78), (232, 206, 112)), 'giant': ((204, 152, 112), (112, 80, 50)),
    'ooze': ((72, 178, 218), (198, 238, 255)), 'aberration': ((146, 80, 178), (232, 150, 172)), 'monstrosity': ((178, 140, 60), (112, 62, 40)),
    'plant': ((72, 150, 56), (222, 82, 102)), 'celestial': ((240, 232, 200), (232, 184, 72)),
}
VARIANT_BODY = {'ember': (226, 72, 30), 'frost': (118, 184, 242), 'venom': (158, 82, 200), 'shadow': (74, 62, 98),
                'gilded': (232, 186, 56), 'ash': (122, 118, 114)}
VARIANTS = ['base', 'ember', 'frost', 'venom', 'shadow', 'gilded', 'ash']
BOSS_BODY = [(176, 26, 42), (98, 50, 170), (54, 50, 66)]


class C:
    """material canvas with mirrored drawing helpers (x mirrors around the centre column)"""
    def __init__(self, w=40, h=40):
        self.w, self.h = w, h
        self.im = Image.new('L', (w, h), 0)
        self.d = ImageDraw.Draw(self.im)

    def _mx(self, x):
        return self.w - 1 - x

    def e(self, x0, y0, x1, y1, m, sym=False):
        self.d.ellipse([x0, y0, x1, y1], fill=m)
        if sym:
            self.d.ellipse([self._mx(x1), y0, self._mx(x0), y1], fill=m)

    def ring(self, x0, y0, x1, y1, m, width=1, sym=False):
        self.d.ellipse([x0, y0, x1, y1], outline=m, width=width)
        if sym:
            self.d.ellipse([self._mx(x1), y0, self._mx(x0), y1], outline=m, width=width)

    def r(self, x0, y0, x1, y1, m, sym=False):
        self.d.rectangle([x0, y0, x1, y1], fill=m)
        if sym:
            self.d.rectangle([self._mx(x1), y0, self._mx(x0), y1], fill=m)

    def p(self, pts, m, sym=False):
        self.d.polygon(pts, fill=m)
        if sym:
            self.d.polygon([(self._mx(x), y) for x, y in pts], fill=m)

    def l(self, pts, m, w=1, sym=False):
        self.d.line(pts, fill=m, width=w)
        if sym:
            self.d.line([(self._mx(x), y) for x, y in pts], fill=m, width=w)

    def px(self, x, y, m, sym=False):
        self.d.point((x, y), fill=m)
        if sym:
            self.d.point((self._mx(x), y), fill=m)

    def eye(self, x, y, m=WHITE, pupil=DARK, sym=True, big=False):
        """2x2 (or 3x3) eye with a pupil in the inner-lower corner, mirrored by default"""
        s = 2 if big else 1
        self.r(x, y, x + s, y + s, m, sym)
        if pupil:
            self.px(x + s, y + s, pupil, sym)


def shade(mat, palette):
    """materials -> RGBA: three-tone ramps lit from the top-left, then a one-pixel ink outline"""
    m = np.array(mat.im, dtype=np.int16)
    h, w = m.shape
    out = np.zeros((h, w, 4), np.uint8)

    def nb(dy, dx):
        s = np.full_like(m, -1)
        ys, yd = (slice(max(dy, 0), h), slice(0, h - max(dy, 0))) if dy >= 0 else (slice(0, h + dy), slice(-dy, h))
        xs, xd = (slice(max(dx, 0), w), slice(0, w - max(dx, 0))) if dx >= 0 else (slice(0, w + dx), slice(-dx, w))
        s[yd, xd] = m[ys, xs]
        return s

    up, left, down, right, down2 = nb(-1, 0), nb(0, -1), nb(1, 0), nb(0, 1), nb(2, 0)
    for k in range(1, 15):
        sel = m == k
        if not sel.any():
            continue
        if k in RAMPED:
            dk, base, lt = ramp(palette.get(k, FIXED.get(k, (200, 0, 200))))
            col = np.zeros((h, w, 3), np.uint8)
            col[:] = base
            dark = sel & ((down != k) | (right != k) | (down2 != k))
            light = sel & ~dark & ((up != k) | (left != k))
            out[sel, :3] = base
            out[dark, :3] = dk
            out[light, :3] = lt
        else:
            out[sel, :3] = FLAT[k]
        out[sel, 3] = 255
    solid = m > 0
    edge = ~solid & ((nb(-1, 0) > 0) | (nb(1, 0) > 0) | (nb(0, -1) > 0) | (nb(0, 1) > 0))
    out[edge, :3] = INK
    out[edge, 3] = 255
    return Image.fromarray(out, 'RGBA')


# ---------------------------------------------------------------- the 51 designs (one per bestiary subtype)
def wolf(c, hound=False):
    c.p([(28, 31), (37, 20), (34, 33)], BODY)                        # tail
    c.e(10, 20, 29, 37, BODY); c.e(15, 24, 24, 36, ACC)
    c.r(12, 31, 16, 38, BODY, True); c.r(12, 36, 16, 38, ACC, True)
    c.e(11, 7, 28, 24, BODY)
    c.p([(11, 13), (12, 2), (19, 9)], BODY, True); c.p([(13, 10), (13, 5), (16, 9)], ACC, True)
    c.e(15, 15, 24, 23, ACC); c.r(18, 16, 21, 18, DARK)
    c.eye(14, 12, GLOW if hound else WHITE)
    c.l([(15, 11), (17, 12)], DARK, sym=True)
    c.px(17, 21, BONE, True); c.l([(17, 22), (22, 22)], MOUTH)
    if hound:
        for x, h in ((13, 5), (16, 1), (19, 0), (22, 1), (25, 5)):
            c.p([(x - 2, 9), (x, h), (x + 2, 9)], HOT)
        c.r(13, 24, 26, 25, STEEL); [c.px(x, 26, STEEL) for x in range(14, 26, 3)]


def bat(c):
    c.p([(17, 14), (2, 7), (4, 13), (1, 18), (6, 17), (4, 24), (10, 20), (16, 24)], BODY, True)
    c.l([(15, 16), (5, 11)], ACC, sym=True); c.l([(15, 19), (6, 19)], ACC, sym=True)
    c.e(15, 13, 24, 27, BODY); c.e(17, 17, 22, 26, ACC)
    c.e(14, 6, 25, 17, BODY); c.p([(15, 9), (14, 1), (19, 7)], BODY, True)
    c.r(16, 10, 17, 11, HOT, True); c.px(18, 15, BONE, True); c.l([(18, 14), (21, 14)], MOUTH)
    c.r(16, 27, 17, 30, DARK, True)


def serpent(c):
    c.e(5, 27, 34, 38, BODY); c.e(9, 20, 30, 32, BODY); c.e(12, 29, 27, 36, ACC)
    c.r(16, 10, 23, 24, BODY); c.r(18, 12, 21, 24, ACC)
    c.e(12, 2, 27, 14, BODY)
    c.r(15, 6, 16, 8, GLOW, True); c.px(16, 7, DARK, True)
    c.l([(19, 14), (19, 17)], MOUTH); c.px(18, 18, MOUTH); c.px(20, 18, MOUTH)
    for x, y in ((11, 25), (16, 23), (24, 24), (8, 32), (30, 31)):
        c.px(x, y, ACC)


def boar(c):
    c.e(3, 15, 36, 34, BODY)
    for x in range(12, 28, 3):
        c.p([(x, 13), (x + 1, 8), (x + 3, 13)], WOOD)
    c.r(8, 31, 12, 38, BODY, True); c.r(14, 32, 17, 38, BODY, True); c.r(8, 37, 12, 38, DARK, True); c.r(14, 37, 17, 38, DARK, True)
    c.e(10, 11, 29, 30, BODY)
    c.p([(10, 14), (7, 6), (15, 12)], BODY, True)
    c.e(14, 20, 25, 29, ACC); c.r(16, 23, 17, 25, DARK, True)
    c.p([(13, 25), (9, 16), (14, 22)], BONE, True)
    c.eye(14, 16, HOT, None)


def spider(c):
    for pts in ([(13, 22), (6, 13), (2, 22)], [(13, 25), (4, 23), (1, 32)], [(14, 28), (6, 31), (4, 38)], [(16, 30), (11, 34), (10, 38)]):
        c.l(pts, BODY, 2, True)
    c.e(10, 5, 29, 24, BODY)
    c.p([(16, 9), (23, 9), (20, 14), (23, 19), (16, 19), (19, 14)], HOT)
    c.e(13, 19, 26, 31, BODY)
    c.px(16, 23, HOT, True); c.px(18, 22, HOT, True); c.px(17, 25, HOT, True)
    c.l([(17, 30), (16, 34)], BONE, sym=True)


def hawk(c):
    c.p([(15, 14), (2, 5), (1, 11), (4, 12), (1, 17), (5, 17), (3, 22), (9, 21), (14, 28)], BODY, True)
    for y in (9, 14, 19):
        c.l([(13, y + 2), (5, y)], ACC, sym=True)
    c.p([(15, 32), (24, 32), (26, 38), (13, 38)], BODY)
    c.e(14, 12, 25, 34, BODY); c.e(16, 17, 23, 32, ACC)
    c.e(14, 3, 25, 15, BODY)
    c.p([(18, 9), (21, 9), (19, 14)], GOLD)
    c.r(15, 7, 16, 7, GLOW, True); c.px(16, 8, DARK, True)
    c.l([(17, 34), (16, 37)], GOLD, sym=True)


def bear(c):
    c.e(7, 13, 32, 37, BODY); c.e(13, 19, 26, 36, ACC)
    c.p([(9, 18), (2, 9), (6, 7), (13, 16)], BODY, True)
    c.px(2, 7, BONE, True); c.px(4, 6, BONE, True); c.px(6, 5, BONE, True)
    c.r(9, 33, 16, 38, BODY, True)
    c.e(11, 2, 28, 19, BODY); c.e(9, 1, 15, 7, BODY, True); c.e(11, 3, 13, 5, ACC, True)
    c.e(15, 10, 24, 18, ACC); c.r(18, 11, 21, 13, DARK)
    c.px(15, 8, DARK, True); c.l([(17, 16), (22, 16)], MOUTH)


def goblin(c):
    c.p([(28, 9), (34, 7), (35, 13), (30, 24), (27, 23)], WOOD)
    for x, y in ((33, 6), (36, 10), (35, 14)):
        c.px(x, y, STEEL)
    c.r(10, 22, 13, 30, BODY, True)
    c.r(14, 22, 25, 32, WOOD); c.r(14, 28, 25, 29, DARK); c.px(19, 28, GOLD)
    c.r(15, 32, 17, 37, BODY, True); c.r(14, 37, 17, 38, DARK, True)
    c.e(12, 7, 27, 22, BODY)
    c.p([(12, 13), (2, 8), (13, 17)], BODY, True)
    c.eye(14, 12, GLOW, DARK, big=True)
    c.l([(16, 19), (23, 19)], MOUTH); c.px(17, 19, BONE); c.px(22, 19, BONE)


def orc(c):
    c.l([(34, 6), (34, 37)], WOOD, 2)
    c.p([(34, 7), (39, 3), (39, 17), (34, 13)], STEEL)
    c.r(6, 19, 10, 30, BODY, True)
    c.r(9, 16, 30, 34, STEEL); c.r(11, 26, 28, 28, WOOD); c.px(19, 27, GOLD)
    c.e(4, 13, 14, 22, STEEL, True)
    c.r(12, 33, 17, 38, WOOD, True)
    c.e(12, 2, 27, 18, BODY)
    c.l([(14, 7), (18, 9)], DARK, sym=True)
    c.r(15, 9, 16, 10, HOT, True)
    c.l([(15, 14), (24, 14)], MOUTH); c.p([(15, 15), (14, 10), (16, 13)], BONE, True)


def bandit(c):
    c.p([(19, 1), (30, 11), (34, 38), (5, 38), (9, 11)], BODY)
    c.e(14, 7, 25, 19, SKIN); c.r(13, 14, 26, 18, ACC); c.p([(26, 15), (30, 19), (26, 18)], ACC)
    c.px(16, 11, DARK, True)
    c.r(9, 26, 30, 27, WOOD); c.px(19, 26, GOLD)
    c.e(28, 21, 32, 25, SKIN); c.l([(31, 21), (37, 13)], STEEL, 2); c.r(29, 21, 32, 22, WOOD)
    c.l([(19, 19), (19, 37)], DARK)


def apostate(c):
    c.l([(34, 6), (34, 38)], WOOD, 2); c.e(31, 0, 37, 6, HOT); c.px(33, 2, SHINE)
    c.p([(19, 3), (29, 13), (33, 38), (6, 38), (10, 13)], BODY)
    c.e(13, 6, 26, 20, DARK)
    c.r(16, 12, 17, 13, GLOW); c.r(22, 12, 23, 13, GLOW)
    c.l([(19, 21), (19, 37)], GOLD); c.l([(9, 37), (30, 37)], GOLD)
    c.e(29, 20, 33, 24, BODY)


def fenfolk(c):
    c.l([(32, 1), (32, 38)], WOOD, 2); c.p([(32, 0), (34, 4), (30, 4)], STEEL)
    c.e(12, 16, 27, 34, BODY); c.e(15, 19, 24, 33, ACC)
    c.r(9, 18, 12, 28, BODY, True)
    c.r(14, 33, 17, 38, BODY, True); c.p([(12, 38), (18, 38), (15, 35)], ACC, True)
    c.e(11, 4, 28, 18, BODY); c.p([(19, 0), (24, 6), (14, 6)], ACC)
    c.eye(12, 8, WHITE, DARK, big=True)
    c.l([(14, 14), (25, 14)], MOUTH)
    c.l([(10, 11), (8, 13)], ACC, sym=True)


def hexer(c):
    c.e(1, 21, 8, 28, GLOW); c.px(3, 23, SHINE)
    c.p([(19, 20), (31, 38), (7, 38)], BODY)
    c.p([(13, 22), (7, 26), (9, 28), (14, 25)], BODY)
    c.e(12, 11, 27, 24, BONE)
    c.r(15, 15, 17, 17, DARK, True); c.px(16, 16, HOT, True)
    c.l([(17, 21), (22, 21)], DARK)
    c.r(8, 11, 31, 13, BODY); c.p([(19, 0), (27, 12), (11, 12)], BODY); c.p([(19, 0), (23, -1), (26, 3)], BODY)
    c.r(12, 10, 27, 10, GOLD)


def sentry(c):
    c.l([(34, 1), (34, 38)], WOOD, 2); c.p([(34, 0), (36, 5), (32, 5)], STEEL)
    c.r(13, 31, 17, 38, STEEL, True)
    c.r(11, 14, 28, 32, STEEL); c.r(15, 15, 24, 33, BODY); c.l([(19, 17), (19, 30)], GOLD)
    c.e(13, 2, 26, 15, STEEL); c.r(14, 8, 25, 9, DARK); c.p([(18, 2), (22, -2), (21, 3)], HOT)
    c.e(3, 15, 15, 33, BODY); c.ring(3, 15, 15, 33, GOLD); c.p([(9, 20), (12, 24), (9, 28), (6, 24)], GOLD)


def skeleton(c):
    c.e(1, 17, 12, 31, WOOD); c.ring(1, 17, 12, 31, STEEL)
    c.l([(31, 8), (31, 30)], STEEL, 2); c.r(28, 28, 34, 29, GOLD); c.r(30, 30, 32, 33, WOOD)
    c.l([(13, 17), (9, 28)], BODY, 2, True)
    c.l([(16, 32), (15, 38)], BODY, 2, True); c.r(13, 37, 16, 38, BODY, True)
    c.r(19, 15, 20, 30, BODY)
    for y, a in ((18, 14), (21, 14), (24, 15)):
        c.l([(a, y), (39 - a, y)], BODY)
    c.e(14, 28, 25, 33, BODY)
    c.e(13, 2, 26, 14, BODY); c.r(15, 12, 24, 16, BODY)
    c.r(15, 6, 17, 9, DARK, True); c.px(16, 7, HOT, True); c.px(19, 10, DARK)
    for x in range(16, 24, 2):
        c.px(x, 14, DARK)


def zombie(c):
    c.r(13, 33, 17, 38, ACC, True)
    c.r(11, 17, 28, 34, ACC); c.p([(11, 30), (14, 35), (17, 31), (20, 35), (23, 31), (26, 35), (28, 30)], ACC)
    c.l([(13, 20), (4, 24)], BODY, 3, True); c.e(1, 22, 6, 27, BODY, True)
    c.e(12, 3, 26, 17, BODY)
    c.r(14, 8, 16, 10, WHITE); c.px(15, 9, DARK); c.r(22, 9, 23, 10, HOT)
    c.p([(15, 13), (24, 13), (23, 15), (21, 14), (19, 16), (17, 14)], MOUTH)
    c.px(12, 6, ACC); c.px(25, 12, ACC)


def ghoul(c):
    c.l([(10, 20), (3, 32)], BODY, 2, True); c.l([(3, 32), (1, 37)], BONE, sym=True); c.l([(4, 32), (4, 37)], BONE, sym=True)
    c.e(8, 14, 31, 34, BODY); c.e(12, 30, 18, 38, BODY, True)
    c.e(12, 5, 27, 20, BODY)
    c.p([(12, 9), (6, 3), (15, 7)], BODY, True)
    c.r(15, 10, 16, 11, GLOW, True)
    c.e(14, 14, 25, 19, MOUTH); [c.px(x, 14, BONE) for x in range(15, 25, 2)]; [c.px(x, 19, BONE) for x in range(16, 24, 2)]


def wraith(c):
    c.p([(9, 16), (1, 25), (4, 27), (11, 22)], BODY, True)
    c.l([(1, 25), (0, 29)], BONE, sym=True); c.l([(3, 27), (3, 31)], BONE, sym=True)
    c.p([(19, 1), (29, 9), (32, 30), (28, 38), (24, 33), (19, 38), (15, 33), (11, 38), (7, 30), (10, 9)], BODY)
    c.l([(13, 24), (12, 34)], ACC, sym=True)
    c.e(13, 6, 26, 20, DARK)
    c.r(15, 12, 16, 13, GLOW, True)


def bonehulk(c):
    c.l([(36, 4), (36, 30)], BONE, 3); c.e(33, 1, 39, 8, BONE)
    c.e(0, 13, 9, 30, BODY, True); c.r(0, 28, 9, 32, BONE, True)
    c.r(10, 31, 16, 38, BODY, True)
    c.e(6, 11, 33, 34, BODY)
    for y in (15, 20, 25):
        c.l([(11, y), (28, y)], DARK)
    c.r(19, 12, 20, 33, BONE)
    c.e(14, 1, 25, 13, BODY); c.r(16, 5, 17, 7, HOT, True); c.l([(17, 11), (22, 11)], DARK)
    c.p([(12, 11), (8, 7), (14, 9)], BONE, True)


def imp(c):
    c.l([(6, 5), (6, 36)], STEEL); [c.l([(x, 3), (x, 8)], STEEL) for x in (4, 6, 8)]; c.l([(4, 8), (8, 8)], STEEL)
    c.p([(14, 16), (3, 7), (5, 13), (2, 17), (8, 19), (14, 22)], ACC, True)
    c.l([(24, 28), (33, 32), (35, 25)], BODY); c.p([(34, 22), (37, 26), (33, 26)], BODY)
    c.e(14, 16, 25, 30, BODY); c.r(15, 30, 17, 35, BODY, True)
    c.e(12, 6, 27, 19, BODY)
    c.p([(13, 9), (9, 0), (16, 7)], BONE, True)
    c.eye(15, 11, GLOW, DARK)
    c.l([(16, 16), (23, 16)], MOUTH); c.px(16, 17, BONE, True)


def hellhound(c):
    wolf(c, hound=True)


def tormentor(c):
    c.l([(36, 18), (38, 30), (34, 38)], STEEL)
    c.e(0, 15, 9, 31, BODY, True); c.l([(1, 31), (0, 35)], BONE, sym=True); c.l([(4, 31), (4, 35)], BONE, sym=True)
    c.r(10, 33, 16, 38, BODY, True)
    c.e(6, 13, 33, 36, BODY); c.e(12, 19, 27, 34, ACC)
    c.e(12, 3, 27, 18, BODY)
    c.p([(13, 7), (4, 0), (6, 6), (15, 11)], BONE, True)
    c.r(15, 9, 17, 10, GLOW, True); c.l([(14, 8), (18, 9)], DARK, sym=True)
    c.r(15, 13, 24, 15, MOUTH); c.px(16, 13, BONE, True); c.px(18, 15, BONE, True)


def shade_mask(c):
    for x, h in ((9, 26), (14, 30), (19, 33), (24, 30), (29, 26)):
        c.p([(x - 4, 24), (x, h + 6), (x + 4, 24)], HOT)
        c.p([(x - 2, 24), (x, h + 2), (x + 2, 24)], GLOW)
    c.p([(9, 11), (2, 0), (13, 8)], BONE, True)
    c.e(8, 5, 31, 30, BODY)
    c.p([(12, 13), (18, 16), (12, 17)], GLOW, True)
    c.p([(13, 22), (26, 22), (24, 27), (21, 25), (19, 28), (17, 25), (15, 27)], DARK)


def sprite(c):
    c.e(2, 4, 17, 20, ACC, True); c.e(5, 18, 17, 30, ACC, True)
    c.e(6, 8, 11, 13, BODY, True); c.e(8, 22, 11, 25, BODY, True)
    c.p([(19, 17), (24, 30), (15, 30)], BODY)
    c.l([(18, 30), (17, 35)], SKIN, sym=True)
    c.e(15, 7, 24, 18, SKIN); c.e(14, 5, 25, 12, BODY)
    c.px(17, 13, DARK, True)
    for x, y in ((3, 2), (36, 6), (2, 33), (34, 34), (19, 2)):
        c.px(x, y, SHINE)


def thornling(c):
    for a in range(12):
        t = a * math.pi / 6
        x, y = 19.5 + 13 * math.cos(t), 23 + 12 * math.sin(t)
        c.p([(19.5 + 9 * math.cos(t - 0.25), 23 + 9 * math.sin(t - 0.25)), (x, y), (19.5 + 9 * math.cos(t + 0.25), 23 + 9 * math.sin(t + 0.25))], BONE)
    c.e(9, 12, 30, 34, BODY)
    c.p([(19, 13), (12, 4), (17, 6)], ACC); c.p([(20, 13), (27, 3), (22, 8)], ACC)
    c.r(14, 19, 16, 21, GLOW, True); c.px(15, 20, DARK, True)
    c.p([(15, 27), (24, 27), (19, 30)], MOUTH)


def hag(c):
    c.l([(33, 12), (35, 38)], WOOD, 2); c.e(31, 9, 35, 13, WOOD)
    c.p([(16, 8), (30, 14), (34, 38), (5, 38), (8, 18)], BODY)
    c.l([(13, 10), (9, 24)], BONE); c.l([(15, 8), (12, 22)], BONE); c.l([(24, 8), (26, 20)], BONE)
    c.e(13, 7, 25, 19, ACC)
    c.p([(19, 11), (14, 17), (19, 15)], ACC)
    c.px(16, 11, HOT); c.px(22, 11, HOT); c.l([(16, 16), (21, 17)], DARK)
    c.e(29, 20, 32, 23, ACC)
    c.e(11, 2, 27, 11, BODY)


def satyr(c):
    c.e(11, 24, 19, 33, BODY, True); c.r(13, 32, 16, 37, BODY, True); c.r(12, 37, 16, 38, DARK, True)
    c.r(12, 15, 27, 26, SKIN); c.r(8, 16, 11, 24, SKIN, True)
    c.r(15, 19, 24, 22, WOOD); [c.l([(x, 19), (x, 23 + (x % 3))], WOOD) for x in range(15, 25, 2)]
    c.e(13, 3, 26, 16, SKIN)
    c.ring(6, 1, 16, 11, BONE, 2, True)
    c.p([(15, 13), (24, 13), (19, 19)], BODY)
    c.px(16, 8, DARK, True); c.l([(17, 12), (22, 12)], MOUTH)


def mephit(c):
    c.p([(13, 16), (2, 8), (6, 14), (1, 19), (8, 20), (13, 23)], ACC, True)
    c.e(13, 12, 26, 28, BODY); c.l([(16, 28), (15, 33)], BODY, 2, True)
    c.e(12, 4, 27, 17, BODY)
    for x, h in ((14, 0), (19, -2), (24, 0)):
        c.p([(x - 3, 7), (x, h), (x + 3, 7)], GLOW)
    c.eye(15, 9, WHITE, DARK, big=False)
    c.l([(17, 14), (22, 14)], MOUTH)


def geode(c):
    c.e(5, 9, 34, 38, STONE)
    for x, y in ((9, 16), (28, 18), (12, 33), (27, 32), (19, 11)):
        c.px(x, y, DARK)
    c.e(11, 16, 28, 33, DARK)
    c.p([(13, 32), (15, 19), (18, 32)], BODY); c.p([(17, 32), (20, 16), (23, 32)], BODY); c.p([(22, 32), (25, 21), (27, 32)], BODY)
    c.px(19, 19, SHINE); c.px(15, 23, SHINE); c.px(25, 24, SHINE)
    c.r(12, 12, 14, 13, GLOW, True)


def gale(c):
    c.p([(16, 28), (22, 28), (19, 34), (23, 34), (15, 40), (17, 34), (13, 34)], GLOW)
    c.e(4, 8, 35, 30, BODY); c.e(1, 14, 12, 26, BODY); c.e(27, 12, 39, 26, BODY)
    c.d.arc([9, 11, 30, 28], 200, 340, fill=ACC); c.d.arc([13, 15, 26, 26], 20, 160, fill=ACC)
    c.r(14, 16, 15, 18, GLOW, True)
    c.l([(17, 23), (22, 23)], DARK)


def magmin(c):
    for x, h in ((13, 2), (19, 0), (25, 3)):
        c.p([(x - 4, 12), (x, h), (x + 4, 12)], HOT); c.p([(x - 2, 12), (x, h + 4), (x + 2, 12)], GLOW)
    c.e(3, 18, 11, 28, BODY, True)
    c.e(10, 9, 29, 37, BODY)
    for x, y, w in ((12, 26, 5), (22, 30, 4), (14, 33, 6), (23, 14, 4)):
        c.r(x, y, x + w, y + 2, STONE)
    c.r(14, 17, 16, 19, GLOW, True)
    c.e(16, 22, 23, 26, HOT)


def gargoyle(c):
    c.r(7, 35, 32, 38, STONE)
    c.p([(12, 16), (1, 3), (3, 11), (0, 19), (10, 24)], BODY, True)
    c.l([(10, 16), (3, 7)], DARK, sym=True)
    c.e(10, 15, 29, 36, BODY)
    c.e(12, 30, 18, 36, BODY, True); c.px(11, 36, BONE, True); c.px(14, 36, BONE, True)
    c.e(13, 5, 26, 18, BODY); c.p([(14, 8), (11, 1), (16, 6)], BODY, True)
    c.r(15, 10, 16, 11, HOT, True)
    c.l([(16, 15), (23, 15)], DARK); c.px(16, 16, BONE, True)


def golem(c):
    c.r(1, 12, 9, 29, BODY, True); c.r(0, 28, 10, 35, BODY, True)
    c.r(11, 30, 17, 38, BODY, True)
    c.r(9, 11, 30, 31, BODY)
    c.l([(14, 17), (19, 21), (25, 16)], ACC); c.l([(19, 21), (19, 27)], ACC)
    c.l([(10, 24), (13, 27)], DARK); c.l([(27, 13), (29, 17)], DARK)
    c.r(14, 2, 25, 12, BODY); c.r(16, 6, 23, 7, GLOW)


def animated_armour(c):
    c.l([(33, 4), (33, 33)], STEEL, 2); c.r(30, 31, 36, 32, GOLD); c.r(32, 33, 34, 37, WOOD)
    c.r(13, 30, 17, 38, BODY, True)
    c.r(11, 14, 28, 31, BODY); c.r(15, 16, 24, 32, ACC); c.l([(19, 17), (19, 30)], GOLD)
    c.e(5, 11, 15, 20, BODY, True)
    c.r(7, 19, 10, 29, BODY, True)
    c.e(13, 1, 26, 14, BODY); c.r(14, 7, 25, 9, DARK); c.px(16, 8, GLOW, True)
    c.p([(19, 1), (21, -3), (22, 2)], HOT)


def wyrmling(c):
    c.l([(29, 34), (36, 31), (35, 25)], BODY, 2); c.p([(34, 22), (38, 26), (33, 26)], ACC)
    c.p([(11, 18), (2, 10), (4, 20), (10, 24)], BODY, True); c.l([(10, 19), (4, 13)], ACC, sym=True)
    c.e(9, 14, 30, 36, BODY); c.e(14, 19, 25, 35, ACC)
    for y in (23, 27, 31):
        c.l([(15, y), (24, y)], DARK)
    c.e(11, 31, 17, 38, BODY, True)
    c.e(11, 3, 28, 19, BODY); c.e(14, 11, 25, 20, BODY)
    c.p([(13, 6), (11, 0), (16, 4)], BONE, True)
    c.eye(13, 7, WHITE, DARK, big=True)
    c.px(17, 14, DARK, True); c.l([(16, 18), (23, 18)], MOUTH)


def drake(c):
    c.p([(12, 20), (3, 12), (6, 24)], ACC, True)
    c.e(8, 18, 31, 34, BODY); c.e(14, 22, 25, 33, ACC)
    c.r(8, 30, 13, 38, BODY, True); c.px(8, 38, BONE, True); c.px(10, 38, BONE, True)
    c.r(16, 12, 23, 22, BODY)
    c.p([(14, 7), (7, 1), (15, 5)], BONE, True)
    c.e(13, 3, 26, 15, BODY)
    c.r(15, 7, 16, 8, GLOW, True)
    c.e(15, 11, 24, 17, MOUTH); c.px(16, 11, BONE, True); c.px(18, 11, BONE, True); c.px(17, 17, BONE, True)
    for y in (19, 23, 27):
        c.p([(19, y - 3), (21, y), (17, y)], ACC)


def wyvern(c):
    c.p([(16, 14), (1, 2), (4, 8), (0, 14), (5, 15), (2, 22), (10, 20), (15, 26)], BODY, True)
    for a, b in (((15, 15), (4, 7)), ((15, 18), (3, 15)), ((15, 21), (6, 20))):
        c.l([a, b], ACC, sym=True)
    c.l([(19, 30), (27, 37)], BODY, 2); c.p([(27, 34), (32, 39), (26, 39)], BONE)
    c.e(15, 12, 24, 31, BODY); c.e(17, 16, 22, 29, ACC)
    c.l([(17, 30), (15, 35)], BODY, sym=True)
    c.e(14, 2, 25, 13, BODY); c.p([(15, 5), (11, 0), (17, 3)], BONE, True)
    c.r(16, 6, 17, 7, GLOW, True); c.l([(17, 11), (22, 11)], MOUTH)


def ogre(c):
    c.p([(31, 4), (37, 2), (39, 8), (34, 26), (31, 25)], WOOD); c.px(36, 4, STONE); c.px(38, 9, STONE)
    c.e(0, 14, 9, 30, BODY, True)
    c.r(11, 32, 17, 38, BODY, True)
    c.e(5, 11, 34, 37, BODY); c.r(10, 27, 29, 33, ACC); c.p([(14, 33), (19, 37), (24, 33)], ACC)
    c.e(14, 23, 17, 26, DARK)
    c.e(13, 1, 26, 15, BODY)
    c.px(16, 6, WHITE, True); c.px(17, 6, DARK, True)
    c.l([(15, 11), (24, 11)], MOUTH); c.p([(16, 11), (16, 8), (17, 11)], BONE, True)


def troll(c):
    c.l([(8, 14), (2, 35)], BODY, 4, True); c.l([(1, 35), (0, 38)], BONE, sym=True); c.l([(3, 35), (4, 38)], BONE, sym=True)
    c.r(12, 30, 17, 37, BODY, True)
    c.p([(8, 12), (31, 12), (34, 32), (5, 32)], BODY); c.r(10, 27, 29, 32, ACC)
    c.e(12, 2, 27, 16, BODY)
    c.p([(19, 7), (25, 17), (19, 14)], BODY)
    c.p([(14, 3), (19, -1), (25, 3)], ACC)
    c.r(15, 7, 16, 8, GLOW, True)
    c.l([(15, 13), (20, 13)], MOUTH); c.px(15, 12, BONE)


def frost_giant(c):
    c.l([(35, 6), (35, 38)], WOOD, 2); c.p([(35, 6), (39, 2), (39, 14), (35, 12)], STEEL)
    c.e(1, 15, 10, 30, BODY, True)
    c.r(11, 31, 17, 38, ACC, True)
    c.r(8, 14, 31, 32, STEEL); c.r(11, 26, 28, 28, WOOD)
    c.e(4, 12, 14, 20, ACC, True)
    c.e(13, 2, 26, 15, BODY)
    c.p([(13, 10), (26, 10), (24, 22), (19, 26), (15, 22)], BONE)
    c.e(12, 0, 27, 7, STEEL); c.p([(12, 4), (6, -2), (13, 2)], BONE, True)
    c.px(16, 9, DARK, True); c.l([(17, 14), (22, 14)], MOUTH)


def slime(c):
    """a wide jelly puddle: flat, bubbly, two small eyes, drips (no peak, no grin)"""
    c.e(3, 22, 36, 38, BODY); c.e(8, 13, 31, 34, BODY)
    for x in (6, 31):
        c.r(x, 34, x + 1, 38, BODY)
    c.e(11, 26, 15, 30, ACC); c.e(24, 28, 27, 31, ACC); c.px(20, 32, ACC)
    c.e(12, 16, 15, 18, SHINE); c.px(17, 16, SHINE)
    c.r(14, 21, 15, 24, DARK, True)


def jelly(c):
    c.r(7, 13, 32, 37, BODY)
    c.p([(7, 13), (12, 8), (37, 8), (32, 13)], ACC); c.p([(32, 13), (37, 8), (37, 32), (32, 37)], BODY)
    c.e(14, 19, 25, 29, BONE); c.r(16, 27, 23, 31, BONE)
    c.r(16, 22, 17, 24, DARK, True); c.px(19, 26, DARK)
    c.l([(10, 33), (15, 31)], BONE, 2)
    c.px(10, 16, SHINE); c.px(11, 15, SHINE); c.l([(9, 18), (9, 22)], SHINE)


def pudding(c):
    c.e(4, 24, 35, 38, BODY); c.e(8, 14, 31, 31, BODY); c.e(12, 5, 27, 20, BODY)
    for x, y in ((9, 28), (13, 19), (27, 21), (30, 32), (17, 8)):
        c.r(x, y, x, y + 3, BODY)
    for x, y in ((15, 10), (22, 9), (12, 22), (25, 24), (19, 17)):
        c.px(x, y, GLOW); c.px(x + 1, y, DARK)
    c.e(14, 28, 25, 33, MOUTH); c.px(16, 28, BONE); c.px(23, 28, BONE)


def gazer(c):
    for x0, x1 in ((12, 6), (16, 13), (23, 26), (27, 33)):
        c.l([(x0, 26), ((x0 + x1) // 2 + (2 if x0 < 19 else -2), 32), (x1, 38)], BODY, 2)
    for x, y in ((10, 2), (19, 0), (29, 2)):
        c.l([(19, 8), (x, y + 3)], BODY); c.e(x - 2, y, x + 1, y + 3, WHITE); c.px(x, y + 2, DARK)
    c.e(6, 4, 33, 30, BODY)
    c.e(11, 9, 28, 25, WHITE); c.e(15, 12, 24, 22, ACC); c.e(18, 14, 21, 19, DARK)
    c.d.arc([10, 7, 29, 26], 200, 340, fill=BODY, width=2)
    c.px(16, 13, SHINE)


def mindworm(c):
    c.e(3, 31, 36, 39, STONE)
    for y in (27, 21, 15):
        c.e(13, y, 26, y + 9, BODY); c.l([(14, y + 8), (25, y + 8)], ACC)
    c.e(10, 3, 29, 17, BODY)
    c.e(14, 6, 25, 15, MOUTH)
    for a in range(10):
        t = a * math.pi / 5
        c.px(int(round(19.5 + 4.5 * math.cos(t))), int(round(10.5 + 3.5 * math.sin(t))), BONE)
    c.l([(11, 8), (5, 4), (3, 9)], ACC, sym=True)


def voidspawn(c):
    c.l([(10, 18), (3, 14), (1, 22), (5, 26)], BODY, 2, True)
    c.l([(11, 28), (5, 34), (8, 38)], BODY, 2, True)
    c.e(7, 8, 32, 35, BODY)
    for x, y, big in ((12, 13, 1), (24, 12, 0), (18, 10, 0), (27, 19, 1), (10, 21, 0)):
        c.eye(x, y, WHITE, DARK, sym=False, big=bool(big))
    c.e(13, 24, 26, 31, MOUTH)
    for x in range(14, 26, 2):
        c.px(x, 24, BONE); c.px(x + 1, 31, BONE)


def chimera(c):
    c.l([(29, 30), (36, 22), (34, 13)], ACC, 2); c.e(31, 8, 37, 14, ACC); c.px(33, 10, HOT)
    c.r(10, 31, 15, 38, BODY, True)
    c.e(9, 20, 30, 36, BODY)
    c.e(7, 4, 32, 27, ACC)
    c.ring(7, 0, 15, 9, BONE, 2, True)
    c.e(12, 8, 27, 24, BODY)
    c.r(15, 12, 16, 13, GLOW, True)
    c.e(15, 16, 24, 23, BONE); c.r(18, 16, 21, 18, DARK)
    c.l([(17, 21), (22, 21)], MOUTH); c.px(17, 22, WHITE, True)


def basilisk(c):
    for x in (6, 12):
        c.r(x, 30, x + 3, 37, BODY, True); c.px(x, 37, BONE, True)
    c.e(3, 17, 36, 35, BODY)
    for x in range(8, 32, 4):
        c.px(x, 22, ACC); c.px(x + 2, 27, ACC)
    c.e(11, 9, 28, 25, BODY)
    for x in range(14, 26, 3):
        c.p([(x, 10), (x + 1, 4), (x + 3, 10)], ACC)
    c.r(14, 13, 16, 15, HOT, True); c.px(15, 14, GLOW, True)
    c.e(14, 18, 25, 24, MOUTH); c.px(15, 18, BONE, True); c.px(17, 18, BONE, True)


def harpy(c):
    c.p([(15, 14), (1, 4), (2, 12), (0, 18), (4, 18), (2, 25), (9, 23), (15, 28)], BODY, True)
    for y in (10, 15, 20):
        c.l([(14, y + 4), (4, y)], ACC, sym=True)
    c.e(14, 13, 25, 32, BODY); c.r(16, 13, 23, 20, SKIN)
    c.l([(17, 32), (15, 37)], GOLD, sym=True); c.l([(15, 37), (13, 38)], GOLD, sym=True)
    c.p([(12, 8), (19, 1), (27, 8), (28, 18), (11, 18)], ACC)
    c.e(14, 4, 25, 15, SKIN)
    c.px(16, 9, HOT, True); c.l([(18, 13), (21, 13)], MOUTH)


def crab(c):
    c.l([(10, 26), (3, 31), (2, 37)], BODY, 2, True); c.l([(13, 28), (8, 34), (8, 38)], BODY, 2, True)
    c.l([(10, 20), (5, 15)], BODY, 2, True)
    c.e(0, 4, 10, 15, BODY, True); c.p([(4, 4), (7, 9), (2, 9)], DARK, True)
    c.e(6, 14, 33, 31, BODY); c.e(11, 17, 28, 23, ACC)
    c.l([(15, 15), (14, 8)], BODY, sym=True); c.e(12, 5, 16, 9, WHITE, True); c.px(14, 7, DARK, True)
    c.l([(16, 27), (23, 27)], MOUTH)


def blight(c):
    c.l([(11, 18), (3, 22), (1, 30)], BODY, 2, True); c.px(3, 21, BONE, True); c.px(2, 26, BONE, True)
    c.l([(15, 30), (12, 38)], BODY, 3, True); c.l([(19, 30), (19, 38)], BODY, 2)
    c.p([(12, 14), (27, 14), (29, 32), (10, 32)], BODY)
    for x, y in ((12, 20), (25, 18), (20, 27), (14, 29)):
        c.px(x, y, BONE)
    c.e(12, 2, 27, 17, BODY)
    c.r(15, 7, 17, 10, DARK, True); c.px(16, 8, GLOW, True)
    c.e(26, 5, 31, 10, ACC); c.px(28, 7, GLOW)
    c.e(8, 22, 12, 26, ACC)


def myconid(c):
    c.r(13, 32, 17, 38, BONE, True)
    c.r(12, 18, 27, 35, BONE); c.e(8, 22, 13, 28, BONE, True)
    c.px(16, 25, DARK, True); c.l([(18, 30), (21, 30)], MOUTH)
    c.e(3, 3, 36, 22, BODY)
    for x, y, s in ((9, 9, 3), (19, 6, 4), (28, 10, 3), (14, 15, 2), (25, 16, 2)):
        c.e(x, y, x + s, y + s, SHINE)
    c.l([(5, 21), (34, 21)], ACC)


def treant(c):
    c.l([(10, 18), (2, 10), (0, 4)], WOOD, 3, True); c.e(0, 0, 7, 6, BODY, True)
    c.p([(7, 38), (11, 32), (14, 38)], WOOD, True)
    c.r(9, 10, 30, 37, WOOD)
    c.l([(13, 14), (12, 34)], DARK); c.l([(26, 16), (27, 33)], DARK)
    c.e(4, 0, 35, 17, BODY); c.e(10, 2, 16, 7, ACC); c.e(24, 4, 29, 9, ACC)
    c.e(14, 19, 18, 23, DARK, True); c.px(16, 21, GLOW, True)
    c.e(15, 27, 24, 32, DARK)


def lantern_spirit(c):
    c.p([(12, 18), (2, 12), (3, 18), (1, 22), (12, 24)], SHINE, True)
    c.d.arc([14, 0, 25, 12], 180, 360, fill=GOLD, width=2)
    c.r(11, 6, 28, 10, GOLD); c.r(11, 30, 28, 33, GOLD)
    c.r(12, 10, 27, 30, BODY)
    c.l([(12, 10), (12, 30)], GOLD); c.l([(27, 10), (27, 30)], GOLD)
    c.p([(19, 12), (24, 22), (22, 28), (17, 28), (15, 22)], GLOW); c.p([(19, 17), (21, 24), (18, 24)], HOT)
    c.px(17, 22, DARK); c.px(21, 22, DARK)
    c.r(17, 33, 22, 36, GOLD); c.px(19, 37, GLOW)
    for x, y in ((4, 4), (35, 6), (6, 34), (33, 36)):
        c.px(x, y, SHINE)


def halo_knight(c):
    c.p([(13, 15), (2, 4), (1, 12), (3, 13), (1, 20), (5, 21), (4, 28), (12, 25)], SHINE, True)
    c.l([(34, 2), (34, 38)], GOLD, 2); c.p([(34, 0), (37, 6), (31, 6)], GOLD)
    c.r(13, 31, 17, 38, BODY, True)
    c.r(11, 14, 28, 32, BODY); c.l([(19, 15), (19, 31)], GOLD)
    c.e(3, 17, 13, 31, ACC); c.ring(3, 17, 13, 31, GOLD); c.px(8, 24, SHINE)
    c.e(14, 4, 25, 15, BODY); c.r(15, 9, 24, 10, DARK)
    c.ring(12, 0, 27, 4, GLOW)


DESIGNS = {
    'wolf': wolf, 'bat': bat, 'serpent': serpent, 'boar': boar, 'spider': spider, 'hawk': hawk, 'bear': bear,
    'goblin': goblin, 'orc': orc, 'bandit': bandit, 'apostate': apostate, 'fenfolk': fenfolk, 'hexer': hexer, 'sentry': sentry,
    'skeleton': skeleton, 'zombie': zombie, 'ghoul': ghoul, 'wraith': wraith, 'bonehulk': bonehulk,
    'imp': imp, 'hellhound': hellhound, 'tormentor': tormentor, 'shade': shade_mask,
    'sprite': sprite, 'thornling': thornling, 'hag': hag, 'satyr': satyr,
    'mephit': mephit, 'geode': geode, 'gale': gale, 'magmin': magmin,
    'gargoyle': gargoyle, 'golem': golem, 'animatedarmour': animated_armour,
    'wyrmling': wyrmling, 'drake': drake, 'wyvern': wyvern,
    'ogre': ogre, 'troll': troll, 'frostgiant': frost_giant,
    'slime': slime, 'jelly': jelly, 'pudding': pudding,
    'gazer': gazer, 'mindworm': mindworm, 'voidspawn': voidspawn,
    'chimera': chimera, 'basilisk': basilisk, 'harpy': harpy, 'crab': crab,
    'blight': blight, 'myconid': myconid, 'treant': treant,
    'lanternspirit': lantern_spirit, 'haloknight': halo_knight,
}
FAMILY_OF = {}
for fam, subs in {
    'beast': 'wolf bat serpent boar spider hawk bear', 'humanoid': 'goblin orc bandit apostate fenfolk hexer sentry',
    'undead': 'skeleton zombie ghoul wraith bonehulk', 'fiend': 'imp hellhound tormentor shade', 'fey': 'sprite thornling hag satyr',
    'elemental': 'mephit geode gale magmin', 'construct': 'gargoyle golem animatedarmour', 'dragon': 'wyrmling drake wyvern',
    'giant': 'ogre troll frostgiant', 'ooze': 'slime jelly pudding', 'aberration': 'gazer mindworm voidspawn',
    'monstrosity': 'chimera basilisk harpy crab', 'plant': 'blight myconid treant', 'celestial': 'lanternspirit haloknight'}.items():
    for s in subs.split():
        FAMILY_OF[s] = fam
# base-variant body colours for designs whose family colour would read wrong
BASE_BODY = {'bandit': (96, 72, 120), 'apostate': (120, 36, 52), 'hexer': (70, 60, 110), 'sentry': (60, 96, 170), 'gale': (206, 222, 240),
             'geode': (150, 104, 220), 'animatedarmour': (150, 158, 178), 'frostgiant': (150, 192, 232), 'skeleton': (226, 218, 190),
             'golem': (150, 140, 128), 'gargoyle': (128, 124, 132), 'myconid': (204, 60, 52), 'harpy': (120, 100, 80),
             'bonehulk': (226, 218, 190), 'wraith': (112, 100, 140), 'lanternspirit': (255, 240, 180), 'haloknight': (236, 232, 220)}


def monster(sub, variant='base', boss=None):
    fam = FAMILY_OF[sub]
    body, acc = FAMILY_COLOURS[fam]
    if variant == 'base':
        body = BASE_BODY.get(sub, body)
    else:
        body = VARIANT_BODY[variant]
    if boss is not None:
        body = BOSS_BODY[boss]
        acc = mix(acc, (226, 178, 58), 0.35)
    c = C(40, 40)
    DESIGNS[sub](c)
    if boss is None:
        return shade(c, {BODY: body, ACC: acc})
    big = C(40, 46)
    big.im.paste(c.im, (0, 6))
    a = np.array(big.im)
    rows = np.where(a.any(axis=1))[0]
    top = rows[0]
    xs = np.where(a[top:top + 3].any(axis=0))[0]
    cx = int(round((xs[0] + xs[-1]) / 2))
    y = max(0, top - 6)
    big.p([(cx - 6, y + 6), (cx - 6, y + 1), (cx - 3, y + 3), (cx, y), (cx + 3, y + 3), (cx + 6, y + 1), (cx + 6, y + 6)], GOLD)
    big.px(cx, y + 3, HOT)
    return shade(big, {BODY: body, ACC: acc})


# ============================================================== overworld tiles (16 x 16)
TILE_PALS = {
    'green': dict(g=(84, 168, 68), gl=(132, 204, 92), gd=(44, 116, 52), tree=(36, 124, 48), treel=(88, 176, 72), treed=(22, 78, 40),
                  trunk=(120, 78, 40), dirt=(186, 146, 96), dirtl=(212, 180, 130), dirtd=(140, 104, 64), rock=(150, 142, 134),
                  sand=(232, 208, 144), sandd=(200, 168, 104), w=(48, 104, 216), wl=(108, 162, 242), wd=(30, 64, 160), foam=(226, 240, 255),
                  mtn=(158, 118, 78), cap=(240, 240, 248), roof=(196, 64, 48), flower=(248, 232, 96), flower2=(240, 120, 160)),
    'sand': dict(g=(218, 186, 112), gl=(240, 214, 150), gd=(180, 144, 80), tree=(104, 140, 56), treel=(150, 180, 80), treed=(64, 96, 40),
                 trunk=(132, 92, 50), dirt=(196, 140, 84), dirtl=(220, 172, 116), dirtd=(150, 100, 56), rock=(176, 128, 92),
                 sand=(240, 220, 160), sandd=(204, 170, 104), w=(52, 132, 212), wl=(116, 186, 240), wd=(30, 82, 160), foam=(232, 246, 255),
                 mtn=(180, 112, 64), cap=(236, 200, 150), roof=(204, 112, 56), flower=(232, 80, 64), flower2=(250, 236, 180)),
    'snow': dict(g=(226, 232, 246), gl=(255, 255, 255), gd=(170, 186, 222), tree=(36, 96, 76), treel=(84, 140, 116), treed=(20, 60, 56),
                 trunk=(104, 74, 52), dirt=(170, 160, 170), dirtl=(200, 194, 204), dirtd=(126, 116, 132), rock=(130, 136, 156),
                 sand=(210, 218, 236), sandd=(170, 182, 214), w=(70, 130, 206), wl=(150, 196, 240), wd=(40, 82, 160), foam=(255, 255, 255),
                 mtn=(120, 128, 156), cap=(255, 255, 255), roof=(60, 92, 170), flower=(150, 196, 240), flower2=(255, 255, 255)),
    'swamp': dict(g=(86, 112, 62), gl=(120, 142, 80), gd=(54, 72, 46), tree=(56, 82, 50), treel=(92, 118, 66), treed=(32, 48, 34),
                  trunk=(86, 66, 52), dirt=(110, 92, 70), dirtl=(140, 120, 92), dirtd=(76, 62, 50), rock=(104, 104, 98),
                  sand=(150, 138, 96), sandd=(116, 104, 72), w=(62, 102, 88), wl=(96, 140, 116), wd=(36, 66, 60), foam=(170, 196, 160),
                  mtn=(96, 88, 84), cap=(168, 168, 160), roof=(110, 70, 110), flower=(196, 120, 220), flower2=(220, 220, 140)),
    'lava': dict(g=(86, 70, 70), gl=(122, 100, 96), gd=(54, 42, 48), tree=(70, 52, 44), treel=(104, 80, 64), treed=(40, 28, 30),
                 trunk=(56, 40, 36), dirt=(150, 104, 78), dirtl=(184, 136, 104), dirtd=(96, 64, 52), rock=(96, 84, 86),
                 sand=(140, 110, 96), sandd=(104, 80, 72), w=(228, 86, 24), wl=(255, 176, 48), wd=(170, 38, 16), foam=(255, 232, 120),
                 mtn=(80, 64, 66), cap=(232, 96, 40), roof=(140, 40, 32), flower=(255, 140, 40), flower2=(255, 220, 90)),
    'mystic': dict(g=(108, 102, 182), gl=(148, 140, 222), gd=(70, 62, 134), tree=(70, 160, 200), treel=(140, 220, 240), treed=(40, 96, 150),
                   trunk=(100, 80, 140), dirt=(150, 130, 190), dirtl=(184, 168, 222), dirtd=(108, 90, 150), rock=(130, 124, 170),
                   sand=(200, 190, 232), sandd=(160, 148, 206), w=(140, 90, 222), wl=(196, 150, 250), wd=(92, 52, 170), foam=(240, 226, 255),
                   mtn=(120, 108, 170), cap=(232, 220, 255), roof=(90, 180, 200), flower=(255, 220, 250), flower2=(160, 250, 230)),
}
STONE_T, STONE_L, STONE_D = (168, 160, 152), (210, 202, 194), (104, 96, 98)
WOOD_T, WOOD_L, WOOD_D = (150, 102, 56), (192, 144, 88), (100, 62, 32)
GROUP_OF_BIOME = {
    'meadow': 'green', 'forest': 'green', 'deepforest': 'green', 'hills': 'green', 'jungle': 'green', 'river': 'green', 'coast': 'green',
    'ocean': 'green', 'steppe': 'green', 'mountains': 'green', 'desert': 'sand', 'badlands': 'sand', 'savanna': 'sand', 'oasis': 'sand',
    'snow': 'snow', 'frozen': 'snow', 'marsh': 'swamp', 'corruption': 'swamp', 'dusk': 'swamp', 'ruins': 'swamp', 'mushroom': 'swamp',
    'volcanic': 'lava', 'crystal': 'mystic', 'aether': 'mystic', 'sky': 'mystic',
}


class T:
    def __init__(self, pal):
        self.P = pal
        self.im = Image.new('RGBA', (16, 16), pal['g'] + (255,))
        self.d = ImageDraw.Draw(self.im)

    def c(self, k):
        return self.P[k] if isinstance(k, str) else k

    def px(self, x, y, k):
        if 0 <= x < 16 and 0 <= y < 16:
            self.d.point((x, y), fill=self.c(k))

    def r(self, x0, y0, x1, y1, k):
        self.d.rectangle([x0, y0, x1, y1], fill=self.c(k))

    def e(self, x0, y0, x1, y1, k):
        self.d.ellipse([x0, y0, x1, y1], fill=self.c(k))

    def p(self, pts, k):
        self.d.polygon(pts, fill=self.c(k))

    def l(self, pts, k, w=1):
        self.d.line(pts, fill=self.c(k), width=w)


def grass(t, flowers=False):
    for x, y in ((2, 3), (10, 1), (6, 8), (13, 10), (3, 13), (9, 14)):
        t.px(x, y, 'gd'); t.px(x + 1, y - 1, 'gd'); t.px(x + 2, y, 'gd')
    for x, y in ((12, 5), (5, 11), (0, 7)):
        t.px(x, y, 'gl')
    if flowers:
        for x, y, k in ((4, 5, 'flower'), (11, 12, 'flower2'), (14, 3, 'flower'), (7, 15, 'flower2'), (1, 10, 'flower')):
            t.px(x, y, k); t.px(x, y + 1, 'gd')


def ground(t):
    t.r(0, 0, 15, 15, 'dirt')
    for x, y in ((3, 2), (11, 5), (6, 10), (13, 13), (1, 12)):
        t.px(x, y, 'dirtd'); t.px(x + 1, y, 'dirtl')


def cobble(t):
    t.r(0, 0, 15, 15, STONE_D)
    for y0 in (0, 4, 8, 12):
        off = 0 if (y0 // 4) % 2 == 0 else 2
        for x0 in range(-off, 16, 4):
            t.r(x0, y0, x0 + 2, y0 + 2, STONE_T); t.px(x0, y0, STONE_L)


def sand(t, ripples=False):
    t.r(0, 0, 15, 15, 'sand')
    if ripples:
        for y in (3, 9, 14):
            t.l([(1, y), (5, y - 1), (9, y), (13, y - 1)], 'sandd')
    else:
        for x, y in ((3, 4), (11, 2), (7, 11), (13, 13), (2, 14)):
            t.px(x, y, 'sandd')


def round_tree(t, cx, cy, s=6):
    t.r(cx - 1, cy + s - 2, cx, cy + s + 1, 'trunk')
    t.e(cx - s, cy - s, cx + s - 1, cy + s - 2, INK)
    t.e(cx - s + 1, cy - s + 1, cx + s - 2, cy + s - 3, 'tree')
    t.e(cx - s + 2, cy - s + 2, cx, cy - 1, 'treel')
    t.px(cx + s - 3, cy + s - 4, 'treed'); t.px(cx + s - 4, cy + s - 3, 'treed')


def tree(t):
    grass(t); round_tree(t, 8, 7, 7)


def single(t):
    grass(t); round_tree(t, 8, 9, 5)


def pine(t):
    grass(t)
    t.r(7, 12, 8, 15, 'trunk')
    t.p([(8, 0), (15, 13), (0, 13)], INK)
    t.p([(8, 1), (14, 12), (1, 12)], 'tree')
    t.p([(8, 1), (8, 12), (2, 12)], 'treel')
    for y in (5, 9):
        t.l([(4 if y == 9 else 6, y), (11 if y == 9 else 10, y)], 'treed')


def dense(t):
    t.r(0, 0, 15, 15, 'treed')
    for cx, cy in ((4, 4), (12, 3), (8, 10), (0, 12), (15, 11)):
        t.e(cx - 4, cy - 4, cx + 3, cy + 3, INK)
        t.e(cx - 3, cy - 3, cx + 2, cy + 2, 'tree')
        t.e(cx - 2, cy - 2, cx, cy, 'treel')


def rock(t):
    grass(t)
    t.e(2, 5, 14, 15, INK); t.e(3, 6, 13, 14, 'rock')
    t.e(4, 7, 8, 10, mix(t.P['rock'], (255, 255, 255), 0.4)); t.l([(8, 13), (12, 10)], mix(t.P['rock'], INK, 0.45))


def peak(t):
    grass(t)
    t.p([(8, 1), (16, 15), (0, 15)], INK)
    t.p([(8, 2), (15, 15), (1, 15)], 'mtn')
    t.p([(8, 2), (8, 15), (1, 15)], mix(t.P['mtn'], (255, 240, 220), 0.25))
    t.p([(8, 2), (11, 7), (9, 6), (8, 8), (6, 6), (5, 7)], 'cap')
    t.l([(10, 10), (12, 14)], mix(t.P['mtn'], INK, 0.4))


WAVES = [((2, 3), (9, 6), (4, 11), (11, 13)), ((5, 2), (12, 7), (1, 9), (8, 12))]


def water(t, mask, f, deep=False):
    t.r(0, 0, 15, 15, 'wd' if deep else 'w')
    for x, y in WAVES[f]:
        t.l([(x, y), (x + 2, y - 1), (x + 3, y)], 'w' if deep else 'wl')
    edge = 'dirt' if t.P is TILE_PALS['lava'] else 'g'
    for bit, box, foam in ((1, (0, 0, 15, 1), (0, 2, 15, 2)), (2, (14, 0, 15, 15), (13, 0, 13, 15)),
                           (4, (0, 14, 15, 15), (0, 13, 15, 13)), (8, (0, 0, 1, 15), (2, 0, 2, 15))):
        if mask & bit:
            t.r(*foam, 'foam')
    for bit, box in ((1, (0, 0, 15, 1)), (2, (14, 0, 15, 15)), (4, (0, 14, 15, 15)), (8, (0, 0, 1, 15))):
        if mask & bit:
            t.r(*box, edge)
    if mask & 1:
        t.l([(0, 1), (15, 1)], 'gd')


def bridge(t, f):
    water(t, 0, f)
    t.r(1, 0, 14, 15, WOOD_T)
    for y in (0, 3, 6, 9, 12, 15):
        t.l([(1, y), (14, y)], WOOD_D)
    t.l([(1, 1), (14, 1)], WOOD_L); t.l([(1, 7), (14, 7)], WOOD_L); t.l([(1, 13), (14, 13)], WOOD_L)
    t.l([(1, 0), (1, 15)], INK); t.l([(14, 0), (14, 15)], INK)


def road(t, mask):
    grass(t)
    t.r(4, 4, 11, 11, 'dirt')
    for bit, box in ((1, (4, 0, 11, 4)), (2, (11, 4, 15, 11)), (4, (4, 11, 11, 15)), (8, (0, 4, 4, 11))):
        if mask & bit:
            t.r(*box, 'dirt')
    a = np.array(t.im)
    d = np.all(a[..., :3] == t.P['dirt'], axis=-1)
    for y in range(16):
        for x in range(16):
            if d[y, x]:
                for dy, dx, k in ((1, 0, 'dirtd'), (0, 1, 'dirtd'), (-1, 0, 'dirtl'), (0, -1, 'dirtl')):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < 16 and 0 <= xx < 16 and not d[yy, xx]:
                        t.px(x, y, k)
    t.px(7, 7, 'dirtd'); t.px(9, 10, 'dirtl')


def bricks(t, y0=0, y1=15):
    t.r(0, y0, 15, y1, STONE_T)
    for i, y in enumerate(range(y0, y1 + 1, 4)):
        t.l([(0, y), (15, y)], STONE_D)
        off = 0 if i % 2 == 0 else 4
        for x in range(off, 16, 8):
            t.l([(x, y), (x, min(y + 3, y1))], STONE_D)
        t.l([(0, y + 1), (15, y + 1)], STONE_L)


def wall(t):
    bricks(t, 3, 15)
    for x in (0, 6, 12):
        t.r(x, 0, x + 3, 3, STONE_T); t.l([(x, 0), (x + 3, 0)], STONE_L)
    t.l([(0, 15), (15, 15)], INK)


def gate(t):
    wall(t)
    t.e(4, 5, 11, 14, INK); t.r(4, 9, 11, 15, INK)
    t.e(5, 6, 10, 13, WOOD_D); t.r(5, 9, 10, 15, WOOD_D)
    for x in (6, 8):
        t.l([(x, 7), (x, 15)], WOOD_T)


def keep(t):
    bricks(t)
    t.r(6, 4, 9, 9, INK); t.r(7, 5, 8, 9, (255, 220, 120))
    t.l([(1, 0), (1, 15)], STONE_L); t.l([(14, 0), (14, 15)], STONE_D)


def keepdoor(t):
    bricks(t)
    t.e(4, 4, 11, 12, INK); t.r(4, 8, 11, 15, INK)
    t.e(5, 5, 10, 11, WOOD_T); t.r(5, 8, 10, 15, WOOD_T)
    t.l([(7, 5), (7, 15)], WOOD_D); t.px(9, 11, (226, 178, 58))


def house(t, sign=None):
    grass(t)
    t.r(2, 7, 13, 15, INK); t.r(3, 8, 12, 15, (226, 210, 176))
    t.p([(8, 0), (16, 8), (-1, 8)], INK); t.p([(8, 1), (14, 7), (1, 7)], 'roof')
    t.p([(8, 1), (8, 7), (1, 7)], mix(t.P['roof'], (255, 240, 220), 0.3))
    t.r(6, 10, 9, 15, WOOD_D); t.px(8, 12, (226, 178, 58))
    t.r(10, 9, 11, 10, (90, 140, 210))
    if sign == 'shop':
        t.r(2, 9, 5, 12, WOOD_T); t.e(3, 10, 4, 11, (226, 178, 58))
    elif sign == 'inn':
        t.r(1, 9, 5, 12, WOOD_T); t.r(2, 10, 4, 11, (240, 240, 240)); t.px(2, 10, (196, 64, 48))


def shrine(t):
    grass(t)
    t.r(3, 12, 12, 15, STONE_D); t.r(4, 11, 11, 13, STONE_T)
    t.r(5, 3, 10, 11, STONE_T); t.l([(5, 3), (5, 11)], STONE_L); t.l([(10, 3), (10, 11)], STONE_D)
    t.e(6, 5, 9, 8, (120, 220, 255)); t.px(7, 5, (255, 255, 255))
    t.p([(4, 3), (8, 0), (11, 3)], 'roof')


def statue(t):
    grass(t)
    t.r(3, 12, 12, 15, STONE_D); t.r(4, 11, 11, 12, STONE_T)
    t.e(6, 1, 9, 4, STONE_T); t.r(5, 5, 10, 10, STONE_T); t.l([(11, 2), (11, 10)], STONE_L)
    t.l([(5, 5), (5, 10)], STONE_L); t.l([(10, 5), (10, 10)], STONE_D)


def temple(t):
    grass(t)
    t.r(1, 13, 14, 15, STONE_D); t.r(2, 12, 13, 13, STONE_T)
    for x in (2, 6, 9, 12):
        t.r(x, 5, x + 1, 12, STONE_L); t.px(x + 1, 11, STONE_D)
    t.p([(8, 0), (15, 5), (0, 5)], INK); t.p([(8, 1), (14, 4), (1, 4)], STONE_T)
    t.px(8, 3, (226, 178, 58))


def arena(t):
    t.r(0, 0, 15, 15, STONE_T)
    t.e(1, 1, 14, 14, STONE_D); t.e(3, 3, 12, 12, 'sand')
    for x, y in ((1, 0), (13, 0), (1, 13), (13, 13)):
        t.r(x, y, x + 1, y + 2, (196, 64, 48))
    t.px(7, 7, 'sandd')


TILE_KEYS = {
    'grass': lambda t: grass(t), 'meadow': lambda t: grass(t, True), 'ground': ground, 'cobble': cobble,
    'sand': lambda t: sand(t), 'sand2': lambda t: sand(t, True), 'tree': tree, 'single': single, 'pine': pine, 'dense': dense,
    'rock': rock, 'peak': peak, 'wall': wall, 'gate': gate, 'keep': keep, 'keepdoor': keepdoor,
    'house': lambda t: house(t), 'shop': lambda t: house(t, 'shop'), 'inn': lambda t: house(t, 'inn'),
    'shrine': shrine, 'statue': statue, 'temple': temple, 'arena': arena,
}
for f in (0, 1):
    TILE_KEYS[f'deep{f}'] = (lambda f: lambda t: water(t, 0, f, deep=True))(f)
    TILE_KEYS[f'bridge{f}'] = (lambda f: lambda t: bridge(t, f))(f)
    for m in range(16):
        TILE_KEYS[f'water{m}_{f}'] = (lambda m, f: lambda t: water(t, m, f))(m, f)
for m in range(16):
    TILE_KEYS[f'road{m}'] = (lambda m: lambda t: road(t, m))(m)


def tile(group, key):
    t = T(TILE_PALS[group])
    TILE_KEYS[key](t)
    return t.im


# ============================================================== output
def build(out=OUT):
    out.mkdir(exist_ok=True)
    n = 0
    for g in TILE_PALS:
        for k in TILE_KEYS:
            tile(g, k).save(out / f'gt_r8{g}_{k}.png'); n += 1
    for sub in DESIGNS:
        for v in VARIANTS:
            monster(sub, v).save(out / f'r8m_{sub}_{v}.png'); n += 1
        for b in range(3):
            monster(sub, boss=b).save(out / f'r8b_{sub}_{b}.png'); n += 1
    return n


def contact_sheet(path):
    subs = list(DESIGNS)
    cols = 8
    rows = (len(subs) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * 84, rows * 92 + 6 * 36 + 10), (40, 40, 52, 255))
    for i, sub in enumerate(subs):
        im = monster(sub).resize((80, 80), Image.NEAREST)
        sheet.alpha_composite(im, ((i % cols) * 84 + 2, (i // cols) * 92 + 2))
    y = rows * 92 + 6
    keys = ['grass', 'meadow', 'ground', 'cobble', 'sand', 'sand2', 'tree', 'single', 'pine', 'dense', 'rock', 'peak', 'water0_0',
            'water5_0', 'water15_1', 'deep0', 'bridge0', 'road5', 'road15', 'wall', 'gate', 'keep', 'keepdoor', 'house', 'shop', 'inn',
            'shrine', 'statue', 'temple', 'arena']
    for g in TILE_PALS:
        for j, k in enumerate(keys[:cols * 84 // 32 - 1]):
            sheet.alpha_composite(tile(g, k).resize((32, 32), Image.NEAREST), (2 + j * 33 // 1 if j * 33 < cols * 84 - 32 else 0, y))
        y += 36
    sheet.save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--no-write', action='store_true')
    a = ap.parse_args()
    if not a.no_write:
        print(f'wrote {build()} RETRO 8-BIT images to assets/')
    if a.sheet:
        contact_sheet(a.sheet)
