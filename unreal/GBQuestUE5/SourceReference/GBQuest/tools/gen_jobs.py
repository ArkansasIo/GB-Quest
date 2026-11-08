#!/usr/bin/env python3
"""8-bit art for the 11 new jobs and 6 new races (64-bit versions come from tools/gen_hd64.py):

  gh_<cls>_{down,up,side}{0,1}   overworld walkers, tinted from a related class
  np_class_<cls>                 class portrait (tinted + emblem)
  c_<cls>_<0..5>                 battle / menu sheets
  np_race_<sp>_{0,1}             race portraits (tinted + emblem)
All derived from the game's own original art. Run: python3 tools/gen_jobs.py
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
A = os.path.join(ROOT, 'assets')
# reuse the glyph set and helpers from gen_newart without running its generators
_src = open(os.path.join(HERE, 'gen_newart.py')).read()
exec(_src[:_src.index("L = json.load")], globals())
exec(_src[_src.index("def tint("):_src.index("NEW = {")], globals())

JOBS = {
    'ronin': ('warden', (220, 60, 60), 'sword'), 'shinobi': ('shade', (60, 70, 160), 'moon'),
    'bladedancer': ('cantor', (250, 120, 190), 'star'), 'wyrmlancer': ('vanguard', (40, 190, 170), 'wing'),
    'corsair': ('strider', (200, 40, 60), 'target'), 'beastcaller': ('berserker', (130, 170, 70), 'paw'),
    'puppeteer': ('arcanist', (210, 130, 60), 'mask'), 'dreadknight': ('runeblade', (150, 210, 250), 'bones'),
    'voidhunter': ('shade', (170, 80, 240), 'eye'), 'scalesage': ('summoner', (60, 210, 110), 'flame'),
    'stormcaller': ('chaplain', (80, 140, 250), 'bolt'),
}
RACES = {
    'hornfolk': ('tuskborn', (170, 120, 80), 'shield'), 'felinar': ('thornelf', (240, 180, 80), 'paw'),
    'pipkin': ('wispling', (120, 220, 250), 'star'), 'lunari': ('thornelf', (160, 110, 230), 'moon'),
    'wolfkin': ('tuskborn', (150, 150, 170), 'paw'), 'starkin': ('hearthkin', (150, 200, 255), 'sun'),
}
n = 0
def load(name): p = os.path.join(A, name + '.png'); return np.array(Image.open(p).convert('RGBA')) if os.path.exists(p) else None
def put(name, arr):
    global n; Image.fromarray(arr, 'RGBA').save(os.path.join(A, name + '.png')); n += 1
def emblem(a, glyph, col, size, corner='tl'):
    em = blank(); draw_glyph(em, glyph, col)
    em = np.array(Image.fromarray(em, 'RGBA').resize((size, size), Image.NEAREST)); h, w = em.shape[:2]
    y0 = 2; x0 = 2 if corner == 'tl' else a.shape[1] - w - 2
    reg = a[y0:y0 + h, x0:x0 + w]; m = em[..., 3:4] > 0; reg[:] = np.where(m, em, reg)
    return a

INDEX = json.load(open(os.path.join(A, 'nes_index.json')))
for cls, (base, col, glyph) in JOBS.items():
    for d in ('down', 'up', 'side'):
        for f in (0, 1):
            w = load(f'gh_{base}_{d}{f}')
            if w is not None: put(f'gh_{cls}_{d}{f}', tint(w, col, 0.55))
    p = load(f'np_class_{base}')
    if p is not None:
        put(f'np_class_{cls}', emblem(tint(p, col, 0.5), glyph, col, 28))
        if f'np_class_{cls}' not in INDEX['class_portrait']: INDEX['class_portrait'].append(f'np_class_{cls}')
    for i in range(6):
        s = load(f'c_{base}_{i}')
        if s is not None: put(f'c_{cls}_{i}', tint(s, col, 0.5))
for sp, (base, col, glyph) in RACES.items():
    for i in (0, 1):
        r = load(f'np_race_{base}_{i}')
        if r is not None:
            put(f'np_race_{sp}_{i}', emblem(tint(r, col, 0.45), glyph, col, 20, 'tr'))
            if f'np_race_{sp}_{i}' not in INDEX['race_portrait']: INDEX['race_portrait'].append(f'np_race_{sp}_{i}')
json.dump(INDEX, open(os.path.join(A, 'nes_index.json'), 'w'), indent=0)
print(f'generated {n} job and race images')
