#!/usr/bin/env python3
"""HD64 sprite engine: original 64x64 shaded pixel art from height-field shapes.

Every sprite is built from primitives (ellipses, capsules, polygons) that write a height field, a material
and a part id. Rendering then lights the heights from the top-left, maps the light onto a hue-shifted
palette ramp with ordered dithering, darkens seams where one part tucks under another, cuts rock materials
into chunky Voronoi cells (optionally with glowing cracks, like a lava golem), adds emissive glow with a
soft halo, and draws a selective dark outline. Requires numpy and Pillow.
"""
import colorsys
import math
import numpy as np
from PIL import Image, ImageDraw

S = 64
YY, XX = np.mgrid[0:S, 0:S].astype(np.float64) + 0.5
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float64) / 16.0) - 0.47
DITHER = np.tile(BAYER, (S // 4, S // 4))
LIGHT = np.array([-0.55, -0.7, 0.75])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def ramp(h, s, v, n=6, shift=0.07):
    """A pixel-art colour ramp: dark end shifted toward blue/purple and more saturated, light end toward yellow."""
    out = []
    for i in range(n):
        t = i / (n - 1)
        hh = (h + shift * (0.5 - t) * (1 if 0.08 < h < 0.6 else -1)) % 1.0
        ss = max(0.0, min(1.0, s * (1.15 - 0.55 * t)))
        vv = max(0.0, min(1.0, v * (0.22 + 0.85 * t)))
        r, g, b = colorsys.hsv_to_rgb(hh, ss, vv)
        out.append((int(r * 255), int(g * 255), int(b * 255)))
    return out


def hexramp(rgb, n=6):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    return ramp(h, s, v, n)


# named material ramps (hue, saturation, value)
MAT = {
    'stone': (0.08, 0.12, 0.78), 'darkstone': (0.66, 0.1, 0.55), 'sandstone': (0.1, 0.35, 0.85), 'marble': (0.6, 0.04, 0.95),
    'steel': (0.6, 0.1, 0.9), 'iron': (0.62, 0.12, 0.7), 'gold': (0.12, 0.75, 0.98), 'bronze': (0.07, 0.6, 0.82), 'silver': (0.58, 0.05, 0.98),
    'wood': (0.07, 0.55, 0.62), 'darkwood': (0.04, 0.5, 0.42), 'leather': (0.06, 0.5, 0.6), 'bone': (0.11, 0.18, 0.93),
    'skin': (0.07, 0.38, 0.95), 'skin2': (0.06, 0.5, 0.78), 'skin3': (0.05, 0.55, 0.5), 'green': (0.3, 0.55, 0.7), 'orcskin': (0.25, 0.5, 0.62),
    'red': (0.99, 0.7, 0.85), 'blue': (0.6, 0.65, 0.85), 'purple': (0.78, 0.55, 0.75), 'teal': (0.48, 0.6, 0.75), 'yellow': (0.14, 0.7, 0.95),
    'white': (0.6, 0.04, 0.97), 'black': (0.7, 0.15, 0.35), 'leaf': (0.28, 0.65, 0.72), 'moss': (0.22, 0.55, 0.6), 'ice': (0.55, 0.35, 0.98),
    'crystal': (0.75, 0.45, 0.95), 'slime': (0.33, 0.7, 0.88), 'fire': (0.06, 0.9, 1.0), 'flesh': (0.97, 0.45, 0.8), 'fur': (0.08, 0.45, 0.6),
    'scale': (0.4, 0.6, 0.6), 'cloth': (0.6, 0.5, 0.7), 'paper': (0.12, 0.25, 0.95), 'glass': (0.55, 0.2, 0.95), 'shadow': (0.75, 0.35, 0.3),
}
GLOW = {'lava': [(255, 120, 20), (255, 196, 64), (255, 240, 160)], 'arcane': [(120, 60, 255), (170, 120, 255), (225, 205, 255)],
        'frost': [(40, 160, 255), (120, 210, 255), (220, 248, 255)], 'toxic': [(60, 200, 40), (150, 245, 70), (225, 255, 170)],
        'holy': [(255, 190, 40), (255, 228, 120), (255, 252, 220)], 'blood': [(200, 20, 40), (250, 70, 70), (255, 170, 160)],
        'storm': [(70, 120, 255), (150, 200, 255), (240, 250, 255)], 'soul': [(40, 220, 190), (120, 255, 220), (220, 255, 245)]}


def mat(name, hue=None, sat=None, val=None, n=6):
    h, s, v = MAT[name]
    return ramp(hue if hue is not None else h, sat if sat is not None else s, val if val is not None else v, n)


class Sprite:
    def __init__(self, rng):
        self.rng = rng
        self.h = np.full((S, S), -1e9)
        self.mat = np.full((S, S), -1, dtype=np.int32)
        self.part = np.full((S, S), -1, dtype=np.int32)
        self.mats = []
        self.parts = 0
        self.emit = np.zeros((S, S, 3))
        self.emask = np.zeros((S, S), dtype=bool)
        self.glow_strength = np.zeros((S, S))
        self.paint = []          # (x, y, rgb) drawn after shading
        self.alpha_layer = None  # optional translucent overlay (ghosts, glass)
        self.bg = None           # opaque background image for scenes/tiles

    # -------------------------------------------------------------- materials and primitives
    def material(self, ramp_colours, kind='plain', **kw):
        self.mats.append(dict(ramp=ramp_colours, kind=kind, **kw))
        return len(self.mats) - 1

    def _put(self, inside, height, m, over=False):
        if over:
            sel = inside
        else:
            sel = inside & (height > self.h)
        self.h[sel] = height[sel]
        self.mat[sel] = m
        self.part[sel] = self.parts
        self.parts += 1
        return sel

    def ellipse(self, cx, cy, rx, ry, m, z=0.0, dome=1.0, rot=0.0, over=False):
        dx, dy = XX - cx, YY - cy
        if rot:
            c, s = math.cos(rot), math.sin(rot)
            dx, dy = dx * c + dy * s, -dx * s + dy * c
        d2 = (dx / max(rx, 0.5)) ** 2 + (dy / max(ry, 0.5)) ** 2
        inside = d2 <= 1.0
        height = z + dome * np.sqrt(np.clip(1 - d2, 0, 1)) * min(rx, ry) / 6.0
        return self._put(inside, height, m, over)

    def capsule(self, x1, y1, x2, y2, r1, r2, m, z=0.0, dome=1.0, over=False):
        vx, vy = x2 - x1, y2 - y1
        L2 = vx * vx + vy * vy or 1e-6
        t = np.clip(((XX - x1) * vx + (YY - y1) * vy) / L2, 0, 1)
        px, py = x1 + t * vx, y1 + t * vy
        d = np.hypot(XX - px, YY - py)
        r = r1 + (r2 - r1) * t
        inside = d <= r
        height = z + dome * np.sqrt(np.clip(1 - (d / np.maximum(r, 0.3)) ** 2, 0, 1)) * np.maximum(r, 0.5) / 6.0
        return self._put(inside, height, m, over)

    def poly(self, pts, m, z=0.0, bevel=3, over=False):
        img = Image.new('L', (S, S), 0)
        ImageDraw.Draw(img).polygon([(float(x), float(y)) for x, y in pts], fill=255)
        inside = np.array(img) > 0
        dist = chamfer(inside, bevel)
        height = z + dist / max(bevel, 1) * bevel / 6.0
        return self._put(inside, height, m, over)

    def rect(self, x0, y0, x1, y1, m, z=0.0, bevel=2, over=False):
        return self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], m, z, bevel, over)

    def line(self, pts, width, m, z=0.0, dome=1.0):
        for (a, b), (c, d) in zip(pts, pts[1:]):
            self.capsule(a, b, c, d, width / 2, width / 2, m, z, dome)

    # -------------------------------------------------------------- surface detail
    def rockify(self, m, cells=12, crack=None, crack_frac=0.55, jitter=0.9, seed_box=None):
        """Cut material m into chunky cells: each cell tilts and lifts on its own; seams go dark, or glow (crack=glow name)."""
        sel = self.mat == m
        if not sel.any():
            return
        ys, xs = np.nonzero(sel)
        rng = self.rng
        n = max(3, cells)
        idx = rng.choice(len(xs), size=min(n, len(xs)), replace=False)
        sx, sy = xs[idx] + 0.5, ys[idx] + 0.5
        d = (XX[None] - sx[:, None, None]) ** 2 + (YY[None] - sy[:, None, None]) ** 2
        cell = np.argmin(d, axis=0)
        lift = rng.uniform(-jitter, jitter, size=len(sx))
        tx, ty = rng.uniform(-0.12, 0.12, size=len(sx)), rng.uniform(-0.12, 0.12, size=len(sx))
        dome = np.sqrt(np.min(d, axis=0))
        # each chunk is a pillow: it bulges at its seed and falls away toward its seams
        adj = lift[cell] + tx[cell] * (XX - sx[cell]) + ty[cell] * (YY - sy[cell]) - 0.035 * dome * dome
        self.h[sel] += adj[sel]
        seam = np.zeros((S, S), dtype=bool)
        right = np.roll(cell, -1, axis=1) != cell
        down = np.roll(cell, -1, axis=0) != cell
        seam |= (right | down) & sel & np.roll(sel, -1, axis=1) & np.roll(sel, -1, axis=0)
        mm = self.mats[m]
        mm.setdefault('seams', np.zeros((S, S), dtype=bool))
        if crack:
            # a subset of cell borders glows: pick pairs of cells whose shared border becomes a crack
            glowing = rng.random(len(sx)) < crack_frac
            interior = erode(erode(sel))
            cg = seam & interior & glowing[cell] & glowing[np.roll(cell, -1, axis=1)] | (seam & interior & glowing[cell] & glowing[np.roll(cell, -1, axis=0)])
            self.glow(cg, crack, strength=1.0)
            mm['seams'] |= seam & ~cg
        else:
            mm['seams'] |= seam

    def texture(self, m, kind, amount=0.6):
        """Height texture inside material m: 'noise', 'stripes', 'scales', 'planks', 'bricks', 'fur'."""
        sel = self.mat == m
        if not sel.any():
            return
        rng = self.rng
        if kind == 'noise':
            t = value_noise(rng, 8) - 0.5
        elif kind == 'stripes':
            t = np.sin((XX + YY * 0.3) * rng.uniform(0.6, 1.0)) * 0.5
        elif kind == 'scales':
            t = (np.sin(XX * 1.1 + np.floor(YY / 3) * 1.6) * np.sin(YY * 1.05)) * 0.6
        elif kind == 'planks':
            t = np.where((YY.astype(int) % 6) == 0, -1.0, 0.0) + (value_noise(rng, 16) - 0.5) * 0.4
        elif kind == 'bricks':
            row = (YY // 6).astype(int)
            t = np.where(((YY.astype(int) % 6) == 0) | (((XX + row * 5).astype(int) % 11) == 0), -1.2, 0.0)
        elif kind == 'fur':
            t = np.sin(XX * 2.3 + value_noise(rng, 4) * 6) * 0.35 + (value_noise(rng, 16) - 0.5) * 0.5
        else:
            t = np.zeros((S, S))
        self.h[sel] += t[sel] * amount

    def glow(self, mask, name, strength=1.0):
        cols = GLOW[name] if isinstance(name, str) else name
        m = mask.astype(bool)
        self.emask |= m
        # brightest at the core of a thick glow, mid at edges
        core = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
        self.emit[m] = cols[1]
        self.emit[core] = cols[2]
        self.glow_strength[m] = np.maximum(self.glow_strength[m], strength)
        self._glowcol = cols

    def glow_line(self, pts, name, width=1):
        img = Image.new('L', (S, S), 0)
        ImageDraw.Draw(img).line([(float(x), float(y)) for x, y in pts], fill=255, width=width)
        self.glow(np.array(img) > 0, name)

    def glow_ellipse(self, cx, cy, rx, ry, name):
        d2 = ((XX - cx) / max(rx, 0.5)) ** 2 + ((YY - cy) / max(ry, 0.5)) ** 2
        self.glow(d2 <= 1, name)

    def px(self, x, y, rgb):
        self.paint.append((int(x), int(y), rgb))

    # -------------------------------------------------------------- rendering
    def render(self, outline=(18, 12, 20), halo=True, light=LIGHT, contrast=1.0, dither=0.09):
        solid = self.mat >= 0
        img = np.zeros((S, S, 4), dtype=np.float64)
        if self.bg is not None:
            img[..., :3] = self.bg
            img[..., 3] = 255
        if solid.any():
            base = np.where(solid, self.h, np.nan)
            fill = np.nanmin(base) - 1.5 if np.isfinite(np.nanmin(base)) else 0
            H = np.where(solid, self.h, fill)
            gx = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) * 0.5
            gy = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) * 0.5
            nx, ny, nz = -gx * 3.2, -gy * 3.2, np.ones((S, S))
            nl = np.sqrt(nx * nx + ny * ny + nz * nz)
            lam = (nx * light[0] + ny * light[1] + nz * light[2]) / nl
            level = np.clip((lam - 0.45) * 1.6 * contrast + 0.46, 0, 1)
            # ambient occlusion: a neighbouring different part that sits higher shades this pixel
            occl = np.zeros((S, S))
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
                nh = np.roll(np.roll(self.h, dy, 0), dx, 1)
                npart = np.roll(np.roll(self.part, dy, 0), dx, 1)
                occl += ((npart != self.part) & (nh > self.h + 0.35) & solid) * 0.22
            level -= np.clip(occl, 0, 0.5)
            # rim light on the lit edges
            edge = solid & ~(np.roll(solid, 1, 1) & np.roll(solid, 1, 0))
            level[edge] += 0.12
            level = np.clip(level + DITHER * dither, 0, 0.999)
            for mi, mm in enumerate(self.mats):
                sel = solid & (self.mat == mi)
                if not sel.any():
                    continue
                pal = np.array(mm['ramp'], dtype=np.float64)
                lv = level.copy()
                if 'seams' in mm:
                    lv[mm['seams']] = np.minimum(lv[mm['seams']], 0.12)
                if mm['kind'] == 'metal':      # sharp specular band
                    lv = np.where(lv > 0.72, 0.999, lv * 0.85)
                elif mm['kind'] == 'flat':
                    lv = 0.55 + (lv - 0.5) * 0.4
                elif mm['kind'] == 'shiny':    # slime, glass: strong highlight
                    lv = np.where(lv > 0.8, 0.999, lv * 0.9)
                idx = (lv * len(pal)).astype(int).clip(0, len(pal) - 1)
                img[sel, :3] = pal[idx[sel]]
                img[sel, 3] = 255 if mm.get('alpha') is None else mm['alpha']
        # emissive and its halo
        if self.emask.any():
            img[self.emask, :3] = self.emit[self.emask]
            img[self.emask, 3] = 255
            if halo:
                ring = dilate(self.emask, 1) & ~self.emask
                cols = getattr(self, '_glowcol', GLOW['lava'])
                c0 = np.array(cols[0], dtype=np.float64)
                inside = ring & (img[..., 3] > 0)
                img[inside, :3] = img[inside, :3] * 0.45 + c0 * 0.55
                outside = ring & (img[..., 3] == 0)
                img[outside, :3] = c0
                img[outside, 3] = 110
        for x, y, rgb in self.paint:
            if 0 <= x < S and 0 <= y < S:
                img[y, x, :3] = rgb
                img[y, x, 3] = 255
        # selective outline: dark ring around the silhouette (skipped on opaque scenes)
        if outline and self.bg is None:
            filled = img[..., 3] > 0
            ring = dilate(filled, 1) & ~filled
            img[ring, :3] = outline
            img[ring, 3] = 255
            # on the lit (top-left) side the outline takes a little of the colour it borders
            nb = np.zeros((S, S, 3))
            got = np.zeros((S, S), dtype=bool)
            for dy, dx in ((0, -1), (-1, 0)):
                src = np.roll(np.roll(img, dy, 0), dx, 1)
                take = ring & ~got & (src[..., 3] > 0)
                nb[take] = src[take, :3]
                got |= take
            img[got, :3] = np.array(outline, dtype=np.float64) * 0.62 + nb[got] * 0.38
        return Image.fromarray(img.clip(0, 255).astype(np.uint8), 'RGBA')


# ------------------------------------------------------------------ helpers
def shift(m, dy, dx, fill=False):
    """m moved by (dy, dx) without wrapping around the edges"""
    out = np.full_like(m, fill)
    ys = slice(max(dy, 0), m.shape[0] + min(dy, 0)); yd = slice(max(-dy, 0), m.shape[0] + min(-dy, 0))
    xs = slice(max(dx, 0), m.shape[1] + min(dx, 0)); xd = slice(max(-dx, 0), m.shape[1] + min(-dx, 0))
    out[ys, xs] = m[yd, xd]
    return out


def dilate(m, r=1):
    out = m.copy()
    for _ in range(r):
        out = out | shift(out, 1, 0) | shift(out, -1, 0) | shift(out, 0, 1) | shift(out, 0, -1)
    return out


def erode(m):
    return m & shift(m, 1, 0, True) & shift(m, -1, 0, True) & shift(m, 0, 1, True) & shift(m, 0, -1, True)


def chamfer(inside, steps):
    dist = np.zeros((S, S))
    cur = inside.copy()
    for i in range(steps):
        dist += cur
        cur = erode(cur)
        if not cur.any():
            break
    return np.minimum(dist, steps)


def value_noise(rng, cells, periodic=True):
    """Smooth 64x64 value noise in [0,1]; periodic so tiles wrap."""
    g = rng.random((cells, cells))
    if periodic:
        g = np.vstack([g, g[:1]])
        g = np.hstack([g, g[:, :1]])
    fx = XX / S * cells
    fy = YY / S * cells
    x0, y0 = np.floor(fx).astype(int), np.floor(fy).astype(int)
    tx, ty = fx - x0, fy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    x1, y1 = np.minimum(x0 + 1, cells), np.minimum(y0 + 1, cells)
    a = g[y0, x0] * (1 - tx) + g[y0, x1] * tx
    b = g[y1, x0] * (1 - tx) + g[y1, x1] * tx
    return a * (1 - ty) + b * ty


def fbm(rng, octaves=(4, 8, 16), weights=(0.55, 0.3, 0.15)):
    return sum(w * value_noise(rng, o) for o, w in zip(octaves, weights))
