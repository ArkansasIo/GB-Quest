#!/usr/bin/env python3
"""Detailed 32x32 8-bit icons for the scythe, grimoire and wand weapons (assets/wi_*.png).
Bold dark outline, 3-4 tone shading lit from the top-left, specular highlights."""
import math, os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
INK = (18, 14, 20, 255)


class C:
    def __init__(self): self.px = {}
    def put(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < 32 and 0 <= y < 32: self.px[(x, y)] = c
    def line(self, x0, y0, x1, y1, c, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for dx in range(w):
                for dy in range(w): self.put(x + dx - w // 2, y + dy - w // 2, c)
    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, c)
    def save(self, name):
        im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        for (x, y), c in self.px.items(): im.putpixel((x, y), c)
        # outline
        out = im.copy()
        for y in range(32):
            for x in range(32):
                if im.getpixel((x, y))[3]: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + dx, y + dy)
                    if 0 <= q[0] < 32 and 0 <= q[1] < 32 and im.getpixel(q)[3] and im.getpixel(q) != INK:
                        out.putpixel((x, y), INK); break
        out.save(os.path.join(OUT, name + '.png'))


def shade(rgb, k): return tuple(max(0, min(255, int(v * k))) for v in rgb) + (255,)


def scythe(name, blade, shaft, gem=None):
    c = C()
    # shaft: diagonal from bottom-left to top-right, with light/dark edges
    for i in range(0, 25):
        x, y = 6 + i * 0.8, 29 - i * 1.0
        c.put(x, y, shade(shaft, 1.0)); c.put(x + 1, y, shade(shaft, 0.65)); c.put(x - 0.5, y - 0.5, shade(shaft, 1.25))
    c.rect(10, 22, 12, 23, shade((120, 90, 60), 1.0))  # grip wrap
    c.rect(13, 18, 14, 19, shade((120, 90, 60), 0.8))
    # blade: crescent from the top of the shaft sweeping left
    top = (25.5, 5)
    for t in range(0, 40):
        a = math.radians(200 + t * 2.9)
        r1, r2 = 17, 13.5 - t * 0.12
        ox, oy = top[0] - 6 + math.cos(a) * r1 * 0.9, top[1] + 8 + math.sin(a) * r1 * 0.7
        ix, iy = top[0] - 6 + math.cos(a) * r2 * 0.9, top[1] + 8 + math.sin(a) * r2 * 0.75
        c.line(ix, iy, ox, oy, shade(blade, 0.85 + 0.3 * (t / 40)))
        c.put(ox, oy, shade(blade, 1.35))  # cutting edge highlight
    c.rect(23, 4, 26, 7, shade(shaft, 0.6))  # collar
    if gem:
        c.rect(24, 5, 25, 6, shade(gem, 1.2)); c.put(24, 5, (255, 255, 255, 255))
    c.save(name)


def grimoire(name, cover, trim, emblem):
    c = C()
    c.rect(7, 5, 25, 27, shade(cover, 1.0))
    for y in range(5, 28): c.put(7, y, shade(cover, 1.3)); c.put(25, y, shade(cover, 0.6))
    for x in range(7, 26): c.put(x, 5, shade(cover, 1.3)); c.put(x, 27, shade(cover, 0.55))
    c.rect(26, 6, 27, 26, shade((236, 226, 196), 1.0))  # page edges
    for y in range(7, 26, 2): c.put(27, y, shade((200, 186, 150), 1.0))
    c.rect(8, 6, 9, 26, shade(cover, 0.7))  # spine band
    for (x, y) in ((7, 5), (24, 5), (7, 26), (24, 26)):  # metal corners
        c.rect(x, y, x + 1, y + 1, shade(trim, 1.1))
    # emblem: a rune circle with a glyph
    cx, cy = 17, 16
    for a in range(0, 360, 12):
        c.put(cx + math.cos(math.radians(a)) * 5, cy + math.sin(math.radians(a)) * 5, shade(trim, 1.0))
    c.line(cx, cy - 4, cx, cy + 4, shade(emblem, 1.2)); c.line(cx - 3, cy - 1, cx + 3, cy + 2, shade(emblem, 1.2)); c.line(cx - 3, cy + 2, cx + 3, cy - 1, shade(emblem, 0.9))
    c.put(cx, cy, (255, 255, 255, 255))
    c.rect(14, 28, 16, 30, shade((170, 40, 40), 1.0))  # ribbon bookmark
    c.save(name)


def wand(name, wood, gem):
    c = C()
    for i in range(0, 20):
        x, y = 8 + i * 0.85, 27 - i * 0.95
        c.put(x, y, shade(wood, 1.0)); c.put(x + 1, y, shade(wood, 0.6)); c.put(x - 0.4, y - 0.6, shade(wood, 1.3))
    c.rect(9, 23, 11, 25, shade((200, 170, 90), 1.0))  # metal ferrule
    c.rect(20, 9, 22, 11, shade((200, 170, 90), 0.85))  # gem cradle
    # glowing gem with halo
    for r, k in ((4.5, 0.45), (3.2, 0.8), (2.2, 1.1)):
        for a in range(0, 360, 10):
            for rr in range(0, int(r * 10), 5):
                x, y = 24 + math.cos(math.radians(a)) * rr / 10, 7 + math.sin(math.radians(a)) * rr / 10
                if r > 4: c.put(x, y, shade(gem, k) if (int(x) + int(y)) % 2 == 0 else c.px.get((int(x), int(y)), shade(gem, k)))
                else: c.put(x, y, shade(gem, k))
    c.put(23, 6, (255, 255, 255, 255)); c.put(24, 6, (255, 255, 255, 255))
    for (x, y) in ((28, 3), (20, 3), (28, 11)): c.put(x, y, shade(gem, 1.4))  # sparkles
    c.save(name)


if __name__ == '__main__':
    scythe('wi_scythe_0', (170, 176, 186), (120, 84, 52))
    scythe('wi_scythe_1', (196, 204, 214), (78, 58, 44))
    scythe('wi_scythe_2', (226, 190, 100), (70, 40, 60), gem=(220, 70, 60))
    scythe('wi_scythe_3', (150, 120, 220), (40, 30, 52), gem=(120, 240, 180))
    grimoire('wi_grimoire_0', (120, 84, 52), (200, 170, 90), (230, 220, 180))
    grimoire('wi_grimoire_1', (170, 64, 40), (220, 180, 90), (255, 170, 60))
    grimoire('wi_grimoire_2', (110, 20, 30), (180, 150, 160), (240, 70, 70))
    grimoire('wi_grimoire_3', (40, 60, 120), (230, 200, 110), (250, 240, 160))
    grimoire('wi_grimoire_4', (40, 26, 60), (150, 110, 210), (180, 120, 255))
    wand('wi_wand_0', (130, 90, 56), (255, 130, 50))
    wand('wi_wand_1', (150, 160, 180), (120, 210, 255))
    wand('wi_wand_2', (220, 214, 196), (160, 255, 120))
    wand('wi_wand_3', (70, 60, 90), (130, 150, 255))
    wand('wi_wand_4', (230, 210, 150), (255, 240, 160))
    print('14 weapon icons -> assets/wi_*.png')
