#!/usr/bin/env python3
"""Slice the reference asset sheet (art_source/asset_pack_sheet.png) into individual game assets.

For every panel of the sheet it cuts out each sprite on a transparent background and writes:
  assets_pack/<panel>/<panel>_NNN.png      full-detail cutout (trimmed, transparent)
  assets_pack/<panel>/px/<panel>_NNN.png   pixel version for the 8-bit game (fit to the panel's size, 32 colours)
  assets_pack/scenes/*.png                 the four scene paintings (full and 160x144 pixel backdrops)
  assets_pack/manifest.json                every asset: panel, file, size, source box
  assets_pack/preview.png                  contact sheet of the pixel versions
Run: python3 tools/slice_assetpack.py [--sheet ui] [--debug]
  --sheet ui slices art_source/ui_pack_sheet.png (UI icons, gems, potions, frames, buttons, banners) into assets_pack/ui/;
  its logo and named class line-up are left out on purpose.   (--debug writes assets_pack/_boxes.png with the panel boxes)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art_source', 'asset_pack_sheet.png')
OUT = os.path.join(ROOT, 'assets_pack')
# panel: (x0, y0, x1, y1) in sheet pixels, pixel size (longest side), min blob area
PANELS = {
    'characters': ((6, 24, 428, 248), 32, 60), 'npcs': ((434, 24, 800, 248), 32, 60), 'enemies': ((806, 24, 1046, 248), 32, 60),
    'monsters': ((1052, 24, 1530, 248), 48, 60),
    'weapons': ((6, 280, 262, 522), 16, 40), 'armor': ((268, 280, 522, 522), 16, 40), 'items': ((528, 280, 727, 522), 16, 40),
    'terrain': ((733, 280, 892, 522), 16, 40), 'environment': ((898, 280, 1110, 522), 32, 40), 'buildings': ((1116, 280, 1292, 522), 32, 40),
    'dungeon': ((1298, 280, 1530, 522), 16, 40),
    'ui_icons': ((6, 554, 262, 726), 16, 40), 'portraits': ((268, 554, 558, 726), 48, 60), 'particles': ((860, 554, 1130, 726), 16, 30),
    'mounts': ((1136, 554, 1530, 726), 32, 60), 'map_elements': ((566, 554, 852, 726), 16, 30),
}
SCENES = {'city': (7, 754, 309, 926), 'wilderness': (315, 754, 566, 926), 'dungeon': (571, 754, 776, 926), 'boss_fight': (780, 754, 978, 926), 'world_map': (575, 556, 846, 690)}

def mask_of(rgb):
    """foreground = differs from the dark panel background"""
    a = rgb.astype(int); lum = a.max(axis=2); bg = np.median(a.reshape(-1, 3), axis=0)
    diff = np.abs(a - bg).sum(axis=2)
    m = (diff > 55) & (lum > 38)
    m = ndimage.binary_opening(m, iterations=1); m = ndimage.binary_closing(m, iterations=2)
    return ndimage.binary_fill_holes(m)

VALLEY = 0.42
# areas of overlapping art cut into fixed cells: (x0, y0, x1, y1, columns or x cut list, rows)
REGIONS = {
    'characters': [(6, 26, 428, 182, 6, 1)], 'npcs': [(434, 26, 800, 174, 7, 1)], 'enemies': [(806, 26, 1046, 152, 4, 1)],
    'monsters': [(1052, 26, 1530, 152, [1052, 1232, 1345, 1440, 1530], 1)],
    'terrain': [(735, 284, 891, 452, 4, 4), (735, 454, 891, 521, 6, 3)],
    'buildings': [(1116, 282, 1292, 374, 2, 1)], 'particles': [(862, 556, 1128, 662, 5, 2)],
}
OPAQUE = {'terrain', 'dungeon', 'portraits', 'ui_icons'}

def loose_mask(rgb):
    a = rgb.astype(int); bg = np.median(np.concatenate([a[:3].reshape(-1, 3), a[-3:].reshape(-1, 3), a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)]), axis=0)
    return (np.abs(a - bg).sum(axis=2) > 36) & (a.max(axis=2) > 30)

def gaps(profile, min_gap):
    """split [0, n) into runs where profile is set, merging runs separated by fewer than min_gap empty lines"""
    on = profile > 0; runs, i, n = [], 0, len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]: j += 1
            if runs and i - runs[-1][1] < min_gap: runs[-1][1] = j
            else: runs.append([i, j])
            i = j
        else: i += 1
    return runs

def xy_cut(m, x0, y0, x1, y1, depth=0):
    """recursive XY cut on a foreground mask: split by empty rows, then by empty columns, until nothing splits"""
    sub = m[y0:y1, x0:x1]
    rows = gaps((sub.sum(axis=1) > 1).astype(int), 2)
    if len(rows) > 1 and depth < 12:
        return [b for r in rows for b in xy_cut(m, x0, y0 + r[0], x1, y0 + r[1], depth + 1)]
    cols = gaps((sub.sum(axis=0) > 1).astype(int), 2)
    if len(cols) > 1 and depth < 12:
        return [b for c in cols for b in xy_cut(m, x0 + c[0], y0, x0 + c[1], y1, depth + 1)]
    if not rows: return []
    bx0, by0, bx1, by1 = x0 + (cols[0][0] if cols else 0), y0 + rows[0][0], x0 + (cols[-1][1] if cols else x1 - x0), y0 + rows[-1][1]
    # touching sprites: cut at the deepest valley of the projection along the long side
    w, h = bx1 - bx0, by1 - by0
    if depth < 10 and (w > 1.45 * h or h > 2.6 * w or w * h > m.size * 0.2) and min(w, h) > 14:
        axis = 0 if (w >= h or w * h > m.size * 0.2 and w >= h) else 1
        prof = m[by0:by1, bx0:bx1].sum(axis=axis).astype(float); n = len(prof)
        sm = np.convolve(prof, np.ones(5) / 5, mode='same'); lo, hi = int(n * 0.12), int(n * 0.88)
        if hi > lo:
            k = lo + int(np.argmin(sm[lo:hi]))
            if sm[k] < VALLEY * sm.mean():
                if axis == 0: return xy_cut(m, bx0, by0, bx0 + k, by1, depth + 1) + xy_cut(m, bx0 + k, by0, bx1, by1, depth + 1)
                return xy_cut(m, bx0, by0, bx1, by0 + k, depth + 1) + xy_cut(m, bx0, by0 + k, bx1, by1, depth + 1)
    return [(bx0, by0, bx1, by1)]

def pixelize(img, size, opaque=False, colors=32):
    w, h = img.size; k = size / max(w, h)
    sm = img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    a = np.array(sm); alpha = a[..., 3]
    rgb = Image.fromarray(a[..., :3]).quantize(colors, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    out = np.dstack([np.array(rgb), np.where(alpha > 110, 255, 0).astype(np.uint8)])
    # dark outline around the silhouette, like the game's own sprites
    if not opaque:
        m = out[..., 3] > 0; edge = ndimage.binary_dilation(m) & ~m
        out[edge] = (24, 20, 30, 255)
    pad = np.zeros((size + 2, size + 2, 4), np.uint8); h2, w2 = out.shape[:2]
    oy, ox = (size + 2 - h2) // 2, (size + 2 - w2) // 2
    pad[oy:oy + h2, ox:ox + w2] = out[:size + 2, :size + 2]
    return Image.fromarray(pad, 'RGBA')

# second sheet: a UI kit. Only generic pieces are cut (no logo, no named class line-up).
UI_SHEET = {
    'src': os.path.join(ROOT, 'art_source', 'ui_pack_sheet.png'), 'out': os.path.join(ROOT, 'assets_pack', 'ui'),
    'panels': {
        'rarity_frames': ((14, 792, 636, 866), 32, 60), 'socket_gems': ((660, 792, 842, 882), 16, 40), 'consumables': ((858, 790, 1106, 882), 16, 40),
        'frames': ((1128, 786, 1345, 882), 48, 200), 'buttons': ((1350, 778, 1444, 884), 48, 200), 'checkboxes': ((1452, 778, 1530, 882), 16, 40),
        'system_icons': ((8, 925, 700, 966), 16, 40), 'hotbar_skills': ((203, 670, 382, 724), 16, 60), 'hotbar_potions': ((410, 670, 562, 724), 16, 60),
        'skill_icons': ((995, 92, 1256, 268), 16, 120), 'inventory_items': ((676, 46, 948, 282), 32, 60), 'storage_items': ((1336, 395, 1522, 568), 16, 40),
        'shop_items': ((872, 395, 1076, 526), 16, 40), 'menu_icons': ((14, 176, 52, 568), 16, 40), 'banners': ((1060, 922, 1356, 1008), 64, 200),
    },
    'regions': {'banners': [(1060, 922, 1356, 1008, [1060, 1205, 1355], 1)], 'inventory_items': [(680, 200, 948, 280, 7, 2)], 'hotbar_potions': [(414, 672, 562, 724, 3, 1)]},  # third notice banner names another game's event, so it is skipped
    'opaque': {'rarity_frames', 'frames', 'buttons', 'checkboxes', 'hotbar_skills', 'hotbar_potions', 'skill_icons', 'banners'},
    'scenes': {'minimap': (750, 618, 892, 752), 'world_map': (918, 624, 1118, 740), 'guild_crest': (1160, 626, 1230, 706)},
}

def main():
    global SRC, OUT, PANELS, REGIONS, OPAQUE, SCENES
    if '--sheet' in sys.argv and sys.argv[sys.argv.index('--sheet') + 1] == 'ui':
        U = UI_SHEET; SRC, OUT, PANELS, REGIONS, OPAQUE, SCENES = U['src'], U['out'], U['panels'], U['regions'], U['opaque'], U['scenes']
    sheet = Image.open(SRC).convert('RGB'); S = np.array(sheet)
    os.makedirs(OUT, exist_ok=True); manifest = []
    if '--debug' in sys.argv:
        dbg = sheet.copy(); d = ImageDraw.Draw(dbg)
        for k, (b, _, _) in PANELS.items(): d.rectangle(b, outline=(255, 0, 255), width=2); d.text((b[0] + 3, b[1] + 3), k, fill=(255, 0, 255))
        for k, b in SCENES.items(): d.rectangle(b, outline=(0, 255, 0), width=2)
        dbg.save(os.path.join(OUT, '_boxes.png'))
    for panel, ((x0, y0, x1, y1), size, minarea) in PANELS.items():
        crop = S[y0:y1, x0:x1]; loose = loose_mask(crop); opaque = panel in OPAQUE
        fixed = []
        for (rx0, ry0, rx1, ry1, cols, nrows) in REGIONS.get(panel, []):
            xs = [c - x0 for c in cols] if isinstance(cols, list) else [round(rx0 - x0 + (rx1 - rx0) * k / cols) for k in range(cols + 1)]
            ys = [round(ry0 - y0 + (ry1 - ry0) * k / nrows) for k in range(nrows + 1)]
            for r in range(nrows):
                for c in range(len(xs) - 1):
                    sub = loose[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]; yy, xx = np.nonzero(sub)
                    if len(yy) > minarea: fixed.append((int(xs[c] + xx.min()), int(ys[r] + yy.min()), int(xs[c] + xx.max() + 1), int(ys[r] + yy.max() + 1), (xs[c], ys[r], xs[c + 1], ys[r + 1])))
            loose_cut = loose.copy(); loose_cut[ry0 - y0:ry1 - y0, rx0 - x0:rx1 - x0] = False; loose = loose_cut
        free = [b for b in xy_cut(loose, 0, 0, crop.shape[1], crop.shape[0]) if (b[2] - b[0]) * (b[3] - b[1]) >= minarea and min(b[2] - b[0], b[3] - b[1]) >= 6]
        loose = loose_mask(crop)
        boxes = [f[:4] for f in fixed] + free; cells = {f[:4]: f[4] for f in fixed}
        os.makedirs(os.path.join(OUT, panel, 'px'), exist_ok=True)
        for j, (bx0, by0, bx1, by1) in enumerate(boxes):
            cell = crop[by0:by1, bx0:bx1]
            if opaque or panel == 'terrain' and (bx0, by0, bx1, by1) in cells: alpha = np.full(cell.shape[:2], 255, np.uint8)
            else:
                m = loose[by0:by1, bx0:bx1].copy(); m = ndimage.binary_closing(m, iterations=2); m = ndimage.binary_fill_holes(m)
                lab, n = ndimage.label(m)
                if n > 1:  # keep the main figure and anything near its size, drop specks from neighbours
                    areas = ndimage.sum(m, lab, range(1, n + 1)); keep = [k + 1 for k, a in enumerate(areas) if a >= 0.08 * areas.max()]
                    m = np.isin(lab, keep)
                alpha = np.where(m, 255, 0).astype(np.uint8)
            img = Image.fromarray(np.dstack([cell, alpha]), 'RGBA'); bb = img.getbbox()
            if not bb: continue
            img = img.crop(bb); name = f'{panel}_{j:03d}'
            img.save(os.path.join(OUT, panel, name + '.png')); pixelize(img, size, opaque).save(os.path.join(OUT, panel, 'px', name + '.png'))
            manifest.append({'panel': panel, 'name': name, 'file': f'{panel}/{name}.png', 'px': f'{panel}/px/{name}.png', 'w': img.width, 'h': img.height, 'px_size': size + 2,
                             'box': [x0 + bx0 + bb[0], y0 + by0 + bb[1], x0 + bx0 + bb[2], y0 + by0 + bb[3]]})
        print(f'{panel:13s} {len(boxes)} assets')
    os.makedirs(os.path.join(OUT, 'scenes'), exist_ok=True)
    for k, b in SCENES.items():
        im = sheet.crop(b); im.save(os.path.join(OUT, 'scenes', f'{k}.png'))
        size = (160, 144) if k != 'world_map' else (160, 96)
        if OUT.endswith('ui'): f = 64 / max(im.size); size = (round(im.width * f), round(im.height * f))
        bd = im.resize(size, Image.LANCZOS).quantize(48, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
        bd.save(os.path.join(OUT, 'scenes', f'{k}_px.png'))
        manifest.append({'panel': 'scenes', 'name': k, 'file': f'scenes/{k}.png', 'px': f'scenes/{k}_px.png', 'w': im.width, 'h': im.height, 'box': list(b)})
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    # contact sheet of the pixel versions, one band per panel
    bands = []
    for panel in PANELS:
        ims = [Image.open(os.path.join(OUT, e['px'])) for e in manifest if e['panel'] == panel]
        if not ims: continue
        cell = max(i.width for i in ims) + 2; cols = max(1, 768 // cell); rows = -(-len(ims) // cols)
        band = Image.new('RGBA', (768, 12 + rows * cell), (16, 14, 22, 255)); ImageDraw.Draw(band).text((2, 0), f'{panel} ({len(ims)})', fill=(230, 200, 120))
        for k, im in enumerate(ims): band.alpha_composite(im, (1 + (k % cols) * cell, 12 + (k // cols) * cell))
        bands.append(band)
    H = sum(b.height for b in bands); prev = Image.new('RGBA', (768, H), (16, 14, 22, 255)); y = 0
    for b in bands: prev.alpha_composite(b, (0, y)); y += b.height
    prev.resize((768 * 2, H * 2), Image.NEAREST).save(os.path.join(OUT, 'preview.png'))
    print(f'{len(manifest)} assets -> assets_pack/')

if __name__ == '__main__':
    main()
