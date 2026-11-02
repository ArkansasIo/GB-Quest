#!/usr/bin/env python3
"""Paint a world map for each new expansion (6-13), in the style of the VALENDRIA map:
dark teal ocean with wave flecks, shallows, inked coastlines, biome-coloured lands with texture,
mountains, forests, rivers, a parchment border, a title cartouche and a compass rose.

Outputs assets/gm_x<N>.png (320x199) and assets/gm_x<N>_s.png (160x99), plus tools/worldmap_pins.json
with the three region pins (normalised 0..1) for each expansion.
"""
import json, math, os, random
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets')
W, H = 640, 398

BIOME = {
    'meadow': (104, 140, 62), 'coast': (196, 170, 112), 'marsh': (82, 102, 70), 'jungle': (42, 108, 52), 'snow': (222, 228, 234),
    'badlands': (176, 108, 62), 'volcanic': (78, 50, 44), 'dusk': (78, 66, 92), 'crystal': (128, 178, 200),
}
# n, title, biomes, land shape: list of blobs (cx, cy, rx, ry) in 0..1, seeds = region pin targets
WORLDS = [
    (6, 'CRYSTALIZED REALMS', ['crystal', 'coast', 'dusk'], [(.30, .45, .20, .26), (.62, .35, .18, .20), (.70, .70, .16, .16), (.45, .78, .10, .10)], [(.28, .42), (.64, .33), (.70, .70)]),
    (7, 'FROSTSONG DYNASTY', ['snow', 'crystal', 'badlands'], [(.50, .30, .40, .22), (.30, .62, .18, .18), (.70, .65, .20, .17)], [(.48, .26), (.30, .62), (.72, .64)]),
    (8, 'ARCANE ASCENSION', ['crystal', 'meadow', 'volcanic'], [(.22, .30, .10, .12), (.42, .25, .09, .10), (.63, .32, .11, .12), (.80, .45, .09, .11), (.30, .62, .11, .12), (.52, .58, .10, .12), (.72, .75, .10, .10)], [(.32, .30), (.42, .60), (.76, .62)]),
    (9, 'BLOODMOON CONSPIRACY', ['dusk', 'marsh', 'badlands'], [(.50, .50, .36, .32), (.25, .30, .12, .12), (.80, .72, .12, .12)], [(.34, .38), (.55, .62), (.72, .40)]),
    (10, 'DRAGONSPIRE ODYSSEY', ['volcanic', 'snow', 'badlands'], [(.40, .55, .26, .28), (.68, .40, .20, .26), (.80, .78, .10, .10)], [(.36, .62), (.68, .30), (.62, .62)]),
    (11, 'WHISPERS OF VALHALLA', ['snow', 'coast', 'meadow'], [(.35, .40, .22, .30), (.68, .45, .22, .28), (.50, .80, .14, .10)], [(.32, .30), (.70, .48), (.48, .72)]),
    (12, 'NIGHTSHADE CHRONICLES', ['dusk', 'jungle', 'marsh'], [(.45, .45, .30, .30), (.72, .62, .16, .18), (.22, .70, .10, .12)], [(.42, .34), (.70, .62), (.36, .62)]),
    (13, 'MYTHICAL MEADOWLANDS', ['meadow', 'jungle', 'coast'], [(.50, .48, .38, .34), (.18, .28, .08, .09), (.84, .76, .08, .09)], [(.40, .38), (.64, .58), (.30, .66)]),
]


def value_noise(w, h, cell, rnd):
    gw, gh = w // cell + 2, h // cell + 2
    g = rnd.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0, y0 = xs.astype(int), ys.astype(int)
    fx, fy = xs - x0, ys - y0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def fbm(w, h, rnd, base=64, oct=5):
    out, amp, tot = np.zeros((h, w)), 1.0, 0.0
    for o in range(oct):
        out += amp * value_noise(w, h, max(2, base >> o), rnd); tot += amp; amp *= 0.5
    return out / tot


FONT = None
def draw_text(img, s, x, y, scale, col):
    global FONT
    if FONT is None: FONT = Image.open(os.path.join(A, 'font_6x9.png')).convert('RGBA')
    for i, ch in enumerate(s):
        code = ord(ch)
        if code < 33 or code > 126: continue
        g = FONT.crop(((code - 32) * 6, 0, (code - 32) * 6 + 6, 9)).resize((6 * scale, 9 * scale), Image.NEAREST)
        mask = g.split()[3]
        img.paste(Image.new('RGBA', g.size, col + (255,)), (x + i * 6 * scale, y), mask)


def paint(n, title, biomes, blobs, seeds):
    rnd = np.random.default_rng(1000 + n)
    yy, xx = np.mgrid[0:H, 0:W]
    nx, ny = xx / W, yy / H
    shape = np.zeros((H, W))
    for cx, cy, rx, ry in blobs:
        shape = np.maximum(shape, 1 - np.sqrt(((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2))
    noise = fbm(W, H, rnd, 96, 6)
    detail = fbm(W, H, rnd, 24, 4)
    height = shape + (noise - 0.5) * 0.75 + (detail - 0.5) * 0.35
    land = height > 0.18
    # biome regions: nearest seed, perturbed by noise
    warp = fbm(W, H, rnd, 48, 4) - 0.5
    dists = [np.sqrt((nx - sx + warp * 0.12) ** 2 + (ny - sy - warp * 0.12) ** 2) for sx, sy in seeds]
    region = np.argmin(np.stack(dists), axis=0)
    tex = fbm(W, H, rnd, 8, 3)
    img = np.zeros((H, W, 3))
    # ocean: deep teal, lighter near land, wave flecks
    from scipy.ndimage import distance_transform_edt
    dist = distance_transform_edt(~land)
    deep, shallow = np.array([16, 50, 66]), np.array([46, 110, 128])
    t = np.clip(1 - dist / 26, 0, 1)[..., None]
    img[:] = deep * (1 - t) + shallow * t
    img *= (0.9 + 0.2 * fbm(W, H, rnd, 32, 3))[..., None]
    flecks = (rnd.random((H, W)) < 0.012) & ~land & (dist > 6)
    img[flecks] = [90, 150, 168]
    # land colours
    for i, b in enumerate(biomes):
        m = land & (region == i)
        c = np.array(BIOME[b], float)
        shade = (0.78 + 0.42 * tex[m])[:, None] * (0.85 + 0.3 * np.clip(height[m] - 0.18, 0, 1))[:, None]
        img[m] = np.clip(c * shade, 0, 255)
        if b == 'volcanic':
            lava = m & (noise > 0.62) & (tex > 0.55); img[lava] = [214, 84, 34]
        if b == 'crystal':
            glint = m & (rnd.random((H, W)) < 0.02); img[glint] = [220, 245, 255]
    # beaches on coast-adjacent land
    from scipy.ndimage import binary_dilation
    shore = land & binary_dilation(~land, iterations=2)
    img[shore] = img[shore] * 0.5 + np.array([214, 196, 140]) * 0.5
    coast = ~land & binary_dilation(land, iterations=1)
    img[coast] = [20, 26, 30]
    im = Image.fromarray(img.astype(np.uint8)).convert('RGBA')
    d = ImageDraw.Draw(im)
    R = random.Random(n)
    # mountains and forests
    for _ in range(900):
        x, y = R.randrange(10, W - 10), R.randrange(10, H - 10)
        if not land[y, x] or shore[y, x]: continue
        b = biomes[region[y, x]]
        if height[y, x] > 0.55 and R.random() < 0.5:
            s = R.randint(4, 8); base = tuple(int(v * 0.6) for v in BIOME[b])
            d.polygon([(x - s, y + s // 2), (x, y - s), (x + s, y + s // 2)], fill=base + (255,), outline=(30, 24, 20, 255))
            d.polygon([(x, y - s), (x + s, y + s // 2), (x + 1, y + s // 2)], fill=tuple(int(v * 0.4) for v in BIOME[b]) + (255,))
            if b in ('snow', 'crystal') or height[y, x] > 0.75: d.polygon([(x - 2, y - s + 3), (x, y - s), (x + 2, y - s + 3)], fill=(240, 244, 250, 255))
        elif b in ('meadow', 'jungle', 'marsh', 'dusk') and R.random() < 0.45:
            g = tuple(int(v * 0.55) for v in BIOME[b]); d.ellipse([x - 3, y - 4, x + 3, y + 2], fill=g + (255,), outline=(24, 30, 20, 255))
        elif b in ('badlands', 'coast') and R.random() < 0.15:
            d.rectangle([x - 2, y - 3, x + 2, y + 1], fill=tuple(int(v * 0.7) for v in BIOME[b]) + (255,), outline=(40, 30, 20, 255))
    # rivers from high ground to the sea
    for _ in range(5):
        for _try in range(200):
            x, y = R.randrange(20, W - 20), R.randrange(20, H - 20)
            if land[y, x] and height[y, x] > 0.6: break
        pts = [(x, y)]
        for _s in range(260):
            best = None
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2), (2, 2), (-2, 2), (2, -2), (-2, -2)):
                qx, qy = x + dx, y + dy
                if 0 <= qx < W and 0 <= qy < H and (best is None or height[qy, qx] < best[0]): best = (height[qy, qx] + R.random() * 0.02, qx, qy)
            _, x, y = best; pts.append((x, y))
            if not land[y, x]: break
        if len(pts) > 8: d.line(pts, fill=(60, 120, 150, 255), width=2)
    # region markers: settlements
    for sx, sy in seeds:
        x, y = int(sx * W), int(sy * H)
        d.rectangle([x - 5, y - 4, x + 5, y + 4], fill=(70, 50, 36, 255), outline=(20, 16, 12, 255))
        d.polygon([(x - 6, y - 4), (x, y - 10), (x + 6, y - 4)], fill=(150, 40, 32, 255), outline=(20, 16, 12, 255))
    # parchment border
    border = 10
    for i in range(border):
        c = (70 + i * 6, 52 + i * 5, 34 + i * 3, 255) if i < border - 2 else (20, 16, 12, 255)
        d.rectangle([i, i, W - 1 - i, H - 1 - i], outline=c)
    for _ in range(400):
        x, y = R.randrange(0, W), R.choice([R.randrange(0, border), R.randrange(H - border, H)])
        d.point((x, y), fill=(40, 30, 20, 255))
    # title cartouche and compass
    label = title.split(' ')[0] if len(title) > 14 else title
    tw = len(label) * 12 + 24
    d.rectangle([20, 18, 20 + tw, 50], fill=(196, 168, 118, 255), outline=(40, 28, 18, 255), width=2)
    d.rectangle([24, 22, 16 + tw, 46], outline=(120, 86, 52, 255))
    draw_text(im, label, 32, 25, 2, (46, 30, 20))
    cx, cy = W - 44, 40
    d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], outline=(196, 168, 118, 255), width=2)
    for ang, ln in ((0, 22), (90, 16), (180, 16), (270, 16)):
        a = math.radians(ang - 90)
        d.polygon([(cx + math.cos(a) * ln, cy + math.sin(a) * ln), (cx + math.cos(a + 1.9) * 4, cy + math.sin(a + 1.9) * 4), (cx + math.cos(a - 1.9) * 4, cy + math.sin(a - 1.9) * 4)], fill=(214, 186, 130, 255), outline=(40, 28, 18, 255))
    draw_text(im, 'N', cx - 3, cy - 36, 1, (214, 186, 130))
    out = {}
    for name, w in ((f'gm_x{n}', 320), (f'gm_x{n}_s', 160)):
        h = round(H * w / W)
        q = im.convert('RGB').resize((w, h), Image.LANCZOS).quantize(colors=32, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGBA')
        q.save(os.path.join(A, name + '.png')); out[name] = q.size
    return [[round(sx, 3), round(sy, 3)] for sx, sy in seeds]


if __name__ == '__main__':
    pins = {}
    for n, title, biomes, blobs, seeds in WORLDS:
        pins[f'x{n}'] = paint(n, title, biomes, blobs, seeds)
        print('painted', n, title)
    json.dump(pins, open(os.path.join(ROOT, 'tools', 'worldmap_pins.json'), 'w'), indent=1)
    # contact sheet
    ims = [Image.open(os.path.join(A, f'gm_x{n}.png')) for n, *_ in WORLDS]
    sheet = Image.new('RGBA', (320 * 4 + 12, 199 * 2 + 4), (0, 0, 0, 255))
    for i, im in enumerate(ims): sheet.paste(im, ((i % 4) * 324, (i // 4) * 203))
    os.makedirs(os.path.join(ROOT, 'assets_preview'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'assets_preview', 'expansion_maps.png'))
