#!/usr/bin/env python3
"""Repaint the title banner of the world map (src_sheet/world_map.png) with the continent's name.
Works from src_sheet/world_map_original.png, so it can be re-run with a different name:
  python3 tools/retitle_worldmap.py VALENDRIA && python3 tools/make_worldmap.py && python3 tools/build_atlas.py
"""
import os, sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = (sys.argv[1] if len(sys.argv) > 1 else 'VALENDRIA').upper()
src = Image.open(os.path.join(ROOT, 'src_sheet', 'world_map_original.png')).convert('RGB')
im = src.copy()
x0, y0, x1, y1 = 100, 55, 414, 128                       # plank interior holding the old title
a = np.array(im).astype(float)
wood = a[y0:y1, 92:100].mean(axis=(0, 1))                # sample the plank colour beside the old letters
r = random.Random(7); h, w = y1 - y0, x1 - x0
plank = np.zeros((h, w, 3))
for y in range(h):
    grain = 0.86 + 0.14 * np.sin(y * 0.9 + r.random()) + 0.06 * r.random()
    plank[y, :] = wood * grain
plank *= (0.92 + 0.16 * np.random.default_rng(3).random((h, w)))[..., None]
for y in (0, 1, h - 2, h - 1): plank[y, :] *= 0.55          # plank edges
p = Image.fromarray(np.clip(plank, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], 10, fill=255)
im.paste(p, (x0, y0), mask.filter(ImageFilter.GaussianBlur(1.5)))
# title text: gold with a dark outline and a soft shadow
for fp in ('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',):
    if os.path.exists(fp): break
size = 64
while True:
    font = ImageFont.truetype(fp, size); bb = font.getbbox(name)
    if bb[2] - bb[0] <= w - 26 or size <= 20: break
    size -= 2
d = ImageDraw.Draw(im)
tx = x0 + (w - (bb[2] - bb[0])) // 2 - bb[0]; ty = y0 + (h - (bb[3] - bb[1])) // 2 - bb[1]
d.text((tx + 3, ty + 4), name, font=font, fill=(24, 14, 8))
d.text((tx, ty), name, font=font, fill=(236, 196, 120), stroke_width=3, stroke_fill=(46, 26, 12))
d.text((tx, ty - 1), name, font=font, fill=(250, 222, 156))
im.save(os.path.join(ROOT, 'src_sheet', 'world_map.png'))
print('retitled world map:', name, 'font', os.path.basename(fp), size)
