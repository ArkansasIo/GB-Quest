#!/usr/bin/env python3
"""AELMOOR HD art set: the "Lanterns of Aelmoor" look, a brighter, richer 16-bit-era JRPG style.

Uses the same original shapes as tools/gen_retro8.py (monsters, townsfolk) but renders them with
height-field lighting: every part is domed by its distance to the edge, lit from the top-left, mapped onto
a six-step hue-shifted ramp with ordered dithering, then finished with coloured (not black) outlines,
specular glints and glowing emissives. All art is generated here; nothing third-party is read.

    python tools/gen_aelmoor.py             # writes assets/r9m_* r9b_* r9n_*
    python tools/gen_aelmoor.py --sheet X   # contact sheet for review
"""
import argparse
import colorsys
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_retro8 as R  # noqa: E402

OUT = R.OUT
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float64) / 16.0) - 0.47
LIGHT = np.array([-0.5, -0.72, 0.8]); LIGHT /= np.linalg.norm(LIGHT)
OUTLINE_INK = (30, 20, 44)


def hd_ramp(rgb, n=6, sat_boost=1.18):
    """six shades: shadows shift toward violet and gain saturation, highlights warm toward gold"""
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    s = min(1.0, s * sat_boost)
    out = []
    for i in range(n):
        t = i / (n - 1)
        hh = (h + 0.06 * (0.5 - t) * (1 if 0.08 < h < 0.6 else -1)) % 1.0
        ss = max(0.0, min(1.0, s * (1.2 - 0.6 * t))) if s > 0.08 else s
        vv = max(0.0, min(1.0, v * (0.3 + 0.82 * t) + 0.05 * t))
        r, g, b = colorsys.hsv_to_rgb(hh, ss, vv)
        out.append((int(r * 255), int(g * 255), int(b * 255)))
    return out


GLOWS = {R.GLOW: [(255, 168, 40), (255, 214, 90), (255, 246, 190)], R.HOT: [(196, 28, 30), (255, 84, 52), (255, 176, 120)],
         R.WHITE: [(208, 212, 226), (248, 248, 240), (255, 255, 255)], R.MOUTH: [(70, 10, 30), (128, 24, 44), (170, 50, 66)],
         R.SHINE: [(230, 240, 255), (255, 255, 255), (255, 255, 255)], R.DARK: [(16, 10, 26), (28, 18, 40), (40, 28, 56)]}


def hd_shade(mat, palette, strength=3.0, glint=True):
    m = np.array(mat.im, dtype=np.int16)
    h, w = m.shape
    solid = m > 0
    height = np.zeros((h, w))
    # whole-body dome so separate parts still read as one volume
    if solid.any():
        g = ndimage.distance_transform_edt(solid)
        height += 0.6 * np.sqrt(np.clip(g / max(g.max(), 1), 0, 1))
    for k in range(1, 15):
        sel = m == k
        if not sel.any():
            continue
        lab, n = ndimage.label(sel)
        d = ndimage.distance_transform_edt(sel)
        for i in range(1, n + 1):
            part = lab == i
            dm = d[part].max()
            t = np.clip(d / max(dm, 1), 0, 1)
            height[part] += (1 - (1 - t[part]) ** 2) * min(1.0, 0.35 + dm / 6)
    gy, gx = np.gradient(height)
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(height)
    norm = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    lam = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / norm
    # ambient occlusion where a part tucks under a different part above it
    up = np.vstack([np.zeros((1, w), np.int16), m[:-1]])
    ao = (m > 0) & (up > 0) & (up != m)
    v = np.clip(0.08 + 0.95 * lam - 0.22 * ao, 0, 1)
    dither = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    level = np.clip(np.floor(v * 6 + dither * 0.45), 0, 5).astype(int)
    out = np.zeros((h, w, 4), np.uint8)
    ramps = {}
    for k in range(1, 15):
        sel = m == k
        if not sel.any():
            continue
        if k in R.RAMPED:
            ramps[k] = hd_ramp(palette.get(k, R.FIXED.get(k, (200, 0, 200))))
            lut = np.array(ramps[k], np.uint8)
            out[sel, :3] = lut[level[sel]]
        else:
            g3 = np.array(GLOWS[k], np.uint8)
            lv = np.clip(level // 2, 0, 2)
            if k in (R.GLOW, R.HOT):                                   # emissives glow from the middle out
                lab, n = ndimage.label(sel)
                d = ndimage.distance_transform_edt(sel)
                lv = np.where(d >= 2, 2, np.where(d >= 1.5, 1, 1))
            out[sel, :3] = g3[lv[sel]]
            ramps[k] = [tuple(int(c) for c in GLOWS[k][0])] * 6
        out[sel, 3] = 255
    if glint:                                                          # one specular pixel on the brightest spots
        hi = solid & (lam > 0.93) & np.isin(m, list(R.RAMPED))
        for y, x in zip(*np.where(hi)):
            if (x + y) % 3 == 0:
                out[y, x, :3] = np.minimum(255, out[y, x, :3].astype(int) + 40)
    # coloured selective outline: the darkest shade of the neighbouring part, darker still on the shadow side
    pad = np.pad(m, 1)
    for y, x in zip(*np.where(~solid)):
        nb = [(pad[y, x + 1], 'u'), (pad[y + 1, x], 'l'), (pad[y + 2, x + 1], 'd'), (pad[y + 1, x + 2], 'r')]
        ks = [(k, s) for k, s in nb if k > 0]
        if not ks:
            continue
        k, side = ks[0]
        base = ramps.get(k, [OUTLINE_INK] * 6)[0]
        lit = side in ('d', 'r')       # the neighbour lies below/right: we are on its top-left (lit) rim
        col = R.mix(base, OUTLINE_INK, 0.35 if lit else 0.7)
        out[y, x, :3] = col
        out[y, x, 3] = 255
    return Image.fromarray(out, 'RGBA')


def body_colours(sub, variant, boss):
    fam = R.FAMILY_OF[sub]
    body, acc = R.FAMILY_COLOURS[fam]
    body = R.BASE_BODY.get(sub, body) if variant == 'base' else R.VARIANT_BODY[variant]
    if boss is not None:
        body = R.BOSS_BODY[boss]
        acc = R.mix(acc, (226, 178, 58), 0.35)
    return {R.BODY: body, R.ACC: acc}


def monster(sub, variant='base', boss=None):
    c = R.C(40, 40)
    R.DESIGNS[sub](c)
    pal = body_colours(sub, variant, boss)
    if boss is None:
        return hd_shade(c, pal)
    big = R.C(40, 46)
    big.im.paste(c.im, (0, 6))
    a = np.array(big.im)
    top = np.where(a.any(axis=1))[0][0]
    xs = np.where(a[top:top + 3].any(axis=0))[0]
    cx = int(round((xs[0] + xs[-1]) / 2))
    y = max(0, top - 6)
    big.p([(cx - 6, y + 6), (cx - 6, y + 1), (cx - 3, y + 3), (cx, y), (cx + 3, y + 3), (cx + 6, y + 1), (cx + 6, y + 6)], R.GOLD)
    big.px(cx, y + 3, R.HOT)
    return hd_shade(big, pal)


def townsfolk(role, blink=False):
    return hd_shade(R.npc(role, blink), R.npc_palette(role), strength=2.2, glint=False)


def title_backdrop():
    """160x144 moonlit title scene: violet sky, moon, mountains, a lit castle and waterfall (right), a cliff with
    a lantern banner (left). Composed so the logo card and menu panel sit over the sky."""
    from PIL import ImageDraw
    W, H = 160, 144
    rng = np.random.default_rng(7)
    sky = np.zeros((H, W, 3))
    top, mid, low = np.array((18, 14, 46)), np.array((70, 40, 112)), np.array((150, 84, 150))
    for y in range(H):
        t = y / (H - 1)
        sky[y] = top * (1 - t / 0.6) + mid * (t / 0.6) if t < 0.6 else mid * (1 - (t - 0.6) / 0.4) + low * ((t - 0.6) / 0.4)
    dither = np.tile(BAYER, (H // 4, W // 4))
    sky = np.clip(np.round((sky + dither[..., None] * 10) / 6) * 6, 0, 255)
    im = Image.fromarray(sky.astype(np.uint8), 'RGB').convert('RGBA')
    d = ImageDraw.Draw(im)
    for _ in range(70):
        x, y = int(rng.integers(0, W)), int(rng.integers(0, 70))
        d.point((x, y), fill=(255, 250, 220) if rng.random() < 0.3 else (190, 180, 230))
    for r, a in ((22, 40), (17, 70), (13, 110)):                       # moon halo
        halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse([128 - r, 30 - r, 128 + r, 30 + r], fill=(220, 200, 255, a // 3))
        im.alpha_composite(halo)
    d.ellipse([118, 20, 138, 40], fill=(240, 236, 255)); d.ellipse([121, 23, 128, 29], fill=(214, 206, 240)); d.ellipse([129, 31, 133, 35], fill=(214, 206, 240))
    # far mountains
    pts = [(0, 96)] + [(x, int(84 + 10 * np.sin(x / 13) + 6 * np.sin(x / 5.3))) for x in range(0, W + 1, 4)] + [(W, 96)]
    d.polygon(pts + [(W, H), (0, H)], fill=(58, 38, 96))
    pts = [(x, int(100 + 7 * np.sin(x / 9 + 2) + 4 * np.sin(x / 3.7))) for x in range(0, W + 1, 3)]
    d.polygon([(0, H)] + pts + [(W, H)], fill=(40, 28, 72))
    # castle on the right
    cx = 120
    d.rectangle([cx, 62, cx + 34, 112], fill=(30, 22, 56))
    for tx, ty, tw in ((cx - 4, 50, 9), (cx + 12, 40, 10), (cx + 30, 52, 9)):
        d.rectangle([tx, ty, tx + tw, 112], fill=(34, 24, 62))
        d.polygon([(tx - 1, ty), (tx + tw // 2, ty - 12), (tx + tw + 1, ty)], fill=(56, 36, 104))
        d.point((tx + tw // 2, ty - 13), fill=(255, 210, 90))
    for wx, wy in ((cx + 15, 50), (cx + 19, 58), (cx + 2, 62), (cx + 32, 64), (cx + 8, 76), (cx + 24, 80), (cx + 15, 70)):
        d.rectangle([wx, wy, wx + 1, wy + 2], fill=(255, 214, 110))
    # waterfall and mist
    for i, x in enumerate(range(134, 146)):
        d.line([(x, 112), (x, 144)], fill=(150, 190, 240) if i % 3 else (220, 236, 255))
    d.ellipse([126, 134, 154, 148], fill=(200, 220, 250))
    # left cliff with a gnarled tree and a lantern banner
    d.polygon([(0, 104), (14, 100), (26, 106), (30, 118), (24, 144), (0, 144)], fill=(22, 16, 36))
    d.line([(6, 101), (4, 80), (9, 70)], fill=(28, 20, 40), width=2); d.line([(5, 86), (13, 80)], fill=(28, 20, 40))
    for x, y in ((9, 68), (14, 78), (2, 74)):
        d.ellipse([x - 4, y - 3, x + 4, y + 3], fill=(50, 70, 60))
    d.line([(20, 101), (20, 78)], fill=(90, 70, 50)); d.polygon([(21, 79), (28, 79), (28, 90), (24.5, 87), (21, 90)], fill=(110, 40, 90))
    d.point((24, 83), fill=(255, 210, 90)); d.ellipse([16, 76, 20, 80], fill=(255, 200, 80))
    return im


def build(out=OUT):
    title_backdrop().save(out / 'r9_title.png')
    n = 1
    for sub in R.DESIGNS:
        for v in R.VARIANTS:
            monster(sub, v).save(out / f'r9m_{sub}_{v}.png'); n += 1
        for b in range(3):
            monster(sub, boss=b).save(out / f'r9b_{sub}_{b}.png'); n += 1
    for cat in R.EQUIP_ICONS:
        for slot in range(11):
            c, pal = R.equip_icon(cat, slot); hd_shade(c, pal, strength=2.0, glint=False).save(out / f'r9i_{cat}_{slot}.png'); n += 1
    for key in R.CONSUMABLES:
        c, pal = R.consumable(key); hd_shade(c, pal, strength=2.0, glint=False).save(out / f'r9c_{key}.png'); n += 1
    for role in R.NPC_ALL:
        for k in (0, 1):
            townsfolk(role, bool(k)).save(out / f'r9n_{role}_{k}.png'); n += 1
    return n


def contact_sheet(path):
    subs = list(R.DESIGNS)
    cols = 11
    rows = (len(subs) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * 84, rows * 84 + 2 * 52 + 8), (24, 26, 44, 255))
    for i, sub in enumerate(subs):
        sheet.alpha_composite(monster(sub).resize((80, 80), Image.NEAREST), ((i % cols) * 84 + 2, (i // cols) * 84 + 2))
    y = rows * 84 + 4
    for i, role in enumerate(R.NPC_ALL):
        sheet.alpha_composite(townsfolk(role).resize((48, 48), Image.NEAREST), ((i % 19) * 48, y + (i // 19) * 52))
    sheet.save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--no-write', action='store_true')
    a = ap.parse_args()
    if not a.no_write:
        print(f'wrote {build()} AELMOOR HD images to assets/')
    if a.sheet:
        contact_sheet(a.sheet)
