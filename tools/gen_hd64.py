#!/usr/bin/env python3
"""64-bit asset set: every sprite family re-rendered at 4x with Scale4x edge smoothing,
full colour, a soft top-left light ramp, rim light and a dark outline, packed into
atlas sheets with a JSON index:

  assets_hd64/<family>_<page>.png  sprite atlas pages, max 2048x4096 (cell = sprite at 4x + 4px padding)
  assets_hd64/<family>.json        { name: [page, x, y, w, h] }
  assets_hd64/preview.png        contact sheet of a few sprites from each family

The game's 64-BIT video mode upscales live (src/video64.js); this tool produces the
same look as standalone files for the desktop port, marketing art and modding.
"""
import json, os, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'assets'), os.path.join(ROOT, 'assets_hd64')
FAMILIES = {
    'monsters': 'nm_', 'equipment': 'ne_', 'portraits': 'np_', 'walkers': 'gh_',
    'tiles': 'gt_', 'dungeon_tiles': 'gd_', 'objects': 'go_', 'icons': 'i_', 'battle': 'b_',
}

def scale2x(a):
    h, w = a.shape[:2]
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    E = p[1:-1, 1:-1]; B = p[:-2, 1:-1]; D = p[1:-1, :-2]; F = p[1:-1, 2:]; H = p[2:, 1:-1]
    eq = lambda x, y: np.all(x == y, axis=2)
    ok = ~eq(B, H) & ~eq(D, F)
    out = np.zeros((h * 2, w * 2, a.shape[2]), a.dtype)
    for (dy, dx), (c1, c2, n) in {(0, 0): (D, B, D), (0, 1): (B, F, F), (1, 0): (D, H, D), (1, 1): (H, F, F)}.items():
        m = (ok & eq(c1, c2))[..., None]
        out[dy::2, dx::2] = np.where(m, n, E)
    return out

def enhance(img):
    a = np.array(img.convert('RGBA'))
    a = scale2x(scale2x(a)).astype(np.float32)
    h, w = a.shape[:2]
    alpha = a[..., 3:4] / 255
    # light ramp: brighter top-left, darker bottom-right
    yy, xx = np.mgrid[0:h, 0:w]
    ramp = 1.12 - 0.24 * ((xx / max(1, w - 1)) * 0.4 + (yy / max(1, h - 1)) * 0.6)
    rgb = a[..., :3] * ramp[..., None]
    # saturation boost
    g = rgb.mean(axis=2, keepdims=True); rgb = g + (rgb - g) * 1.18
    # rim light on top edges of the silhouette, outline on the outside
    solid = a[..., 3] > 32
    up = np.zeros_like(solid); up[1:] = solid[:-1]
    rim = solid & ~up
    rgb[rim] = rgb[rim] * 0.6 + 255 * 0.4
    grow = solid.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grow |= np.roll(np.roll(solid, dy, 0), dx, 1)
    outline = grow & ~solid
    out = np.dstack([np.clip(rgb, 0, 255), a[..., 3:4]]).astype(np.uint8)
    out[outline] = [18, 14, 26, 230]
    return Image.fromarray(out, 'RGBA')

def main():
    os.makedirs(OUT, exist_ok=True)
    previews = []
    total = 0
    for fam, prefix in FAMILIES.items():
        files = sorted(glob.glob(os.path.join(SRC, prefix + '*.png')))
        if not files: continue
        sprites = [(os.path.basename(f)[:-4], enhance(Image.open(f))) for f in files]
        cw = max(s.width for _, s in sprites) + 4; ch = max(s.height for _, s in sprites) + 4
        cols = max(1, min(len(sprites), 2048 // cw)); per_page = cols * max(1, 4096 // ch)
        idx = {}
        for pg in range(-(-len(sprites) // per_page)):
            chunk = sprites[pg * per_page:(pg + 1) * per_page]; rows = -(-len(chunk) // cols)
            sheet = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))
            for i, (n, s) in enumerate(chunk):
                x, y = (i % cols) * cw + 2, (i // cols) * ch + 2
                sheet.paste(s, (x, y)); idx[n] = [pg, x, y, s.width, s.height]
            sheet.save(os.path.join(OUT, f'{fam}_{pg}.png'), optimize=True)
        json.dump(idx, open(os.path.join(OUT, fam + '.json'), 'w'), separators=(',', ':'))
        previews += [s for _, s in sprites[:: max(1, len(sprites) // 6)][:6]]
        total += len(sprites)
        print(f'{fam:14s} {len(sprites):4d} sprites -> {pg + 1} page(s)')
    cell = 136; cols = 9; rows = -(-len(previews) // cols)
    pv = Image.new('RGBA', (cols * cell, rows * cell), (24, 20, 32, 255))
    for i, s in enumerate(previews):
        s2 = s.copy(); s2.thumbnail((cell - 8, cell - 8), Image.NEAREST)
        pv.paste(s2, ((i % cols) * cell + (cell - s2.width) // 2, (i // cols) * cell + (cell - s2.height) // 2), s2)
    pv.save(os.path.join(OUT, 'preview.png'))
    print('total', total, 'sprites')

if __name__ == '__main__':
    main()
