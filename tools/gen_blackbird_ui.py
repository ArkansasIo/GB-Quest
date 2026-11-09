#!/usr/bin/env python3
"""Original art for the BLACKBIRD UI theme (assets/bb_*.png).

A dark, minimal leather-and-bronze interface style. Every image here is drawn from scratch by this script
(same file names and sizes the theme code expects), so the theme ships no third-party skin files.

    python tools/gen_blackbird_ui.py            # writes assets/bb_*.png
"""
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'assets'
RNG = np.random.default_rng(1307)
INK = (8, 10, 12)
DARK = (23, 26, 31)
WELL = (14, 16, 20)
RIM = (58, 50, 38)
BRONZE = (140, 116, 75)
GOLD = (176, 146, 88)
GLYPH = (92, 78, 54)
GLYPH_HI = (150, 126, 84)


def leather(w, h, base=DARK, amount=7, seed=0):
    """fine leather grain: value noise plus speckle, tileable enough for a stretched panel"""
    rng = np.random.default_rng(seed)
    coarse = rng.random((h // 6 + 2, w // 6 + 2))
    big = np.array(Image.fromarray((coarse * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float64) / 255 - 0.5
    fine = rng.random((h, w)) - 0.5
    v = big * amount + fine * amount * 0.6
    a = np.zeros((h, w, 4))
    for c in range(3):
        a[..., c] = base[c] + v
    a[..., 3] = 255
    return a


def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def bevel_box(d, x0, y0, x1, y1, fill=WELL, rim=RIM, hi=(70, 64, 54), lo=INK):
    d.rectangle([x0, y0, x1, y1], fill=lo)
    d.rectangle([x0 + 1, y0 + 1, x1 - 1, y1 - 1], fill=rim)
    d.rectangle([x0 + 2, y0 + 2, x1 - 2, y1 - 2], fill=fill)
    d.line([x0 + 2, y0 + 2, x1 - 2, y0 + 2], fill=hi)
    d.line([x0 + 2, y0 + 2, x0 + 2, y1 - 2], fill=hi)


# ------------------------------------------------------------------ equipment slot icons (36 x 36)
def slot(glyph):
    img = to_img(leather(36, 36, WELL, 5, seed=hash(glyph) & 0xffff))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 35, 35], outline=INK)
    d.rectangle([1, 1, 34, 34], outline=RIM)
    d.line([2, 2, 33, 2], fill=(52, 48, 42)); d.line([2, 2, 2, 33], fill=(52, 48, 42))
    g = Image.new('L', (36, 36), 0)
    gd = ImageDraw.Draw(g)
    GLYPHS[glyph](gd)
    # emboss: a light edge up-left, the glyph colour, a dark edge down-right
    ga = np.array(g) > 0
    out = np.array(img).astype(np.float64)
    hi = np.roll(np.roll(ga, -1, 0), -1, 1) & ~ga
    lo = np.roll(np.roll(ga, 1, 0), 1, 1) & ~ga
    out[hi, :3] = GLYPH_HI
    out[lo, :3] = INK
    out[ga, :3] = GLYPH
    return to_img(out)


def g_helm(d):
    d.chord([9, 6, 27, 26], 180, 360, fill=255)
    d.rectangle([9, 15, 27, 28], fill=255)
    d.rectangle([12, 17, 24, 19], fill=0)
    d.rectangle([17, 19, 19, 27], fill=0)


def g_neck(d):
    d.arc([8, 4, 28, 24], 20, 160, fill=255, width=2)
    d.polygon([(18, 20), (24, 26), (18, 32), (12, 26)], fill=255)


def g_cloak(d):
    d.polygon([(13, 6), (23, 6), (29, 31), (18, 28), (7, 31)], fill=255)
    d.line([18, 9, 18, 26], fill=0, width=1)


def g_armor(d):
    d.polygon([(9, 8), (15, 6), (18, 9), (21, 6), (27, 8), (29, 14), (26, 16), (25, 30), (11, 30), (10, 16), (7, 14)], fill=255)
    d.line([12, 20, 24, 20], fill=0)


def g_gloves(d):
    d.rounded_rectangle([11, 14, 25, 30], 4, fill=255)
    for i, x in enumerate((11, 15, 19, 23)):
        d.rounded_rectangle([x, 6 + (i % 2) * 2, x + 3, 16], 1, fill=255)
    d.polygon([(25, 18), (30, 14), (31, 17), (26, 23)], fill=255)


def g_belt(d):
    d.rectangle([4, 15, 31, 21], fill=255)
    d.rectangle([14, 12, 22, 24], outline=255, width=2)
    d.line([18, 15, 18, 21], fill=0)


def g_boots(d):
    for x in (8, 19):
        d.rectangle([x, 6, x + 7, 24], fill=255)
        d.polygon([(x, 24), (x + 7, 24), (x + 11, 30), (x, 30)], fill=255)


def g_ring(d, gem=True):
    d.ellipse([9, 12, 27, 30], outline=255, width=3)
    if gem:
        d.polygon([(18, 4), (23, 9), (18, 14), (13, 9)], fill=255)


def g_trinket(d):
    pts = [(18 + 12 * math.cos(t * math.pi / 3 + math.pi / 6), 18 + 12 * math.sin(t * math.pi / 3 + math.pi / 6)) for t in range(6)]
    d.polygon(pts, outline=255, width=2)
    d.ellipse([14, 14, 22, 22], fill=255)


def g_weapon1(d):
    d.polygon([(26, 5), (31, 5), (31, 10), (14, 27), (9, 22)], fill=255)
    d.line([7, 19, 17, 29], fill=255, width=3)
    d.line([6, 30, 10, 26], fill=255, width=3)


def g_weapon2(d):
    d.chord([7, 7, 29, 31], 200, 340, fill=255)
    d.polygon([(8, 14), (28, 14), (26, 24), (18, 31), (10, 24)], fill=255)
    d.line([18, 15, 18, 28], fill=0)


GLYPHS = {'helm': g_helm, 'neck': g_neck, 'cloak': g_cloak, 'slot': g_armor, 'gloves': g_gloves, 'belt': g_belt, 'boots': g_boots,
          'ring1': lambda d: g_ring(d, True), 'ring2': lambda d: g_ring(d, False), 'trinket': g_trinket, 'weapon1': g_weapon1, 'weapon2': g_weapon2}


# ------------------------------------------------------------------ frames, bars and panels
def panel():
    return to_img(leather(100, 100, (21, 24, 28), 8, seed=7))


def border():
    img = Image.new('RGBA', (8, 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([0, 0, 7, 0], fill=GOLD); d.line([0, 0, 0, 7], fill=GOLD)
    d.line([1, 1, 5, 1], fill=BRONZE); d.line([1, 1, 1, 5], fill=BRONZE)
    d.point((2, 2), fill=GOLD)
    return img


def title():
    a = leather(416, 45, (24, 27, 32), 9, seed=11)
    t = np.linspace(1.12, 0.78, 45)[:, None]
    a[..., :3] *= t[..., None]
    img = to_img(a)
    d = ImageDraw.Draw(img)
    d.line([0, 0, 415, 0], fill=(60, 64, 70))
    d.line([0, 42, 415, 42], fill=BRONZE)
    d.line([0, 43, 415, 43], fill=INK)
    d.line([0, 44, 415, 44], fill=INK)
    return img


def tab():
    img = Image.new('RGBA', (410, 16), (0, 0, 0, 0))
    a = leather(410, 8, (22, 25, 30), 6, seed=13)
    img.paste(to_img(a), (0, 0))
    d = ImageDraw.Draw(img)
    d.line([0, 0, 409, 0], fill=BRONZE)
    d.line([0, 7, 409, 7], fill=INK)
    return img


def vitals(fg):
    w, h = 227, 54
    if not fg:
        img = to_img(leather(w, h, (18, 20, 24), 6, seed=17))
        d = ImageDraw.Draw(img)
        for y0, y1 in ((4, 24), (27, 47)):
            d.rectangle([40, y0, 214, y1], fill=WELL)
            d.line([40, y0, 214, y0], fill=INK)
        return img
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    frame = to_img(leather(w, h, (26, 29, 34), 7, seed=19))
    mask = Image.new('L', (w, h), 255)
    md = ImageDraw.Draw(mask)
    for y0, y1 in ((4, 24), (27, 47)):
        md.rectangle([40, y0, 214, y1], fill=0)          # windows the bars show through
    img.paste(frame, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=INK)
    d.rectangle([1, 1, w - 2, h - 2], outline=RIM)
    for y0, y1 in ((4, 24), (27, 47)):
        d.rectangle([39, y0 - 1, 215, y1 + 1], outline=INK)
        for k in range(1, 4):
            x = 40 + k * 175 // 4
            d.line([x, y0, x, y1], fill=(60, 52, 40, 170))
    # an original crest in the portrait box: a bronze lozenge with a feather
    bevel_box(d, 4, 4, 35, 47, fill=WELL)
    d.polygon([(20, 10), (31, 26), (20, 42), (9, 26)], fill=(64, 54, 38), outline=BRONZE)
    d.line([14, 36, 26, 16], fill=GOLD, width=2)
    for k in range(5):
        y = 20 + k * 3
        d.line([22 - k * 1.2, y + 3, 27 - k * 1.2, y - 2], fill=GLYPH_HI)
    return img


def xp():
    img = Image.new('RGBA', (263, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 262, 15], fill=INK)
    d.rectangle([1, 1, 261, 14], fill=(30, 26, 22))
    d.line([1, 1, 261, 1], fill=BRONZE)
    for k in range(1, 10):
        x = k * 263 // 10
        d.line([x, 3, x, 12], fill=(70, 60, 44))
    return img


def main():
    OUT.mkdir(exist_ok=True)
    for g in GLYPHS:
        slot(g).save(OUT / f'bb_{g}.png')
    panel().save(OUT / 'bb_panel.png')
    border().save(OUT / 'bb_border.png')
    title().save(OUT / 'bb_title.png')
    tab().save(OUT / 'bb_tab.png')
    vitals(False).save(OUT / 'bb_vitals_bg.png')
    vitals(True).save(OUT / 'bb_vitals_fg.png')
    xp().save(OUT / 'bb_xp.png')
    print('wrote 19 original BLACKBIRD theme images to assets/')


if __name__ == '__main__':
    main()
