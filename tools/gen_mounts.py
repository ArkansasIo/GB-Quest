#!/usr/bin/env python3
"""120 mounts: 12 families x 10 coat variants. Writes assets/mt_<id>.png (32x32, saddled, 8-bit
creature-collector style using the body plans of gen_creatures.py) and src/mount_data.js."""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from gen_creatures import draw, Canvas  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
# family: (name, plan, speed tier, source, base level, description)
FAMILIES = [
    ('steed', 'STEED', 'quad', 1, 'stable', 15, 'A sure-footed riding horse.'),
    ('warwolf', 'WARWOLF', 'quad', 1, 'stable', 15, 'A great wolf bred for the hunt.'),
    ('raptor', 'RAPTOR', 'quad', 1, 'stable', 15, 'A fast running lizard from the badlands.'),
    ('boar', 'WARBOAR', 'quad', 1, 'stable', 25, 'A tusked boar that never turns aside.'),
    ('stag', 'GREAT STAG', 'quad', 1, 'reputation', 30, 'An antlered stag of the old forests.'),
    ('ram', 'MOUNTAIN RAM', 'quad', 1, 'stable', 35, 'A curl-horned ram for the high passes.'),
    ('bear', 'WAR BEAR', 'quad', 2, 'dungeon', 40, 'A heavy bear that shrugs off ambushes.'),
    ('sabrecat', 'SABRECAT', 'quad', 2, 'dungeon', 50, 'A fanged cat that strikes from the dark.'),
    ('clockwork', 'CLOCKWORK STRIDER', 'golem', 2, 'crafted', 60, 'A brass walking engine built by smiths.'),
    ('spectral', 'SPECTRAL STEED', 'ghost', 2, 'worldboss', 80, 'A ghost horse bound by an old oath.'),
    ('gryphon', 'GRYPHON', 'dragon', 3, 'raid', 100, 'A winged hunter. Flies over danger.'),
    ('drake', 'DRAKE', 'dragon', 3, 'raid', 120, 'A young dragon that answers to a rider.'),
]
VARIANTS = [  # name, palette (base, light, dark, accent), level offset
    ('BROWN', ((140, 96, 60), (196, 148, 100), (84, 56, 36), (220, 190, 120)), 0),
    ('GREY', ((134, 136, 146), (196, 198, 206), (78, 80, 90), (230, 230, 236)), 0),
    ('BLACK', ((58, 52, 62), (106, 98, 112), (24, 20, 28), (190, 60, 60)), 5),
    ('WHITE', ((226, 226, 230), (252, 252, 255), (170, 172, 184), (220, 190, 110)), 5),
    ('CRIMSON', ((176, 44, 40), (228, 96, 80), (100, 20, 24), (250, 210, 120)), 15),
    ('GOLDEN', ((214, 170, 60), (250, 220, 120), (140, 100, 30), (255, 250, 210)), 25),
    ('FROST', ((130, 190, 230), (210, 240, 255), (60, 110, 160), (255, 255, 255)), 40),
    ('EMBER', ((220, 100, 36), (255, 180, 80), (130, 40, 20), (255, 240, 140)), 60),
    ('SHADOW', ((70, 54, 100), (130, 110, 170), (30, 22, 48), (180, 100, 255)), 90),
    ('CELESTIAL', ((236, 222, 160), (255, 252, 230), (190, 160, 90), (130, 220, 255)), 140),
]
SADDLE, SADDLE_D = (150, 36, 32), (90, 20, 20)


def render(fam, plan, var, pal, seed):
    stage = 2 if plan != 'quad' else 1
    c = draw(plan, stage, random.Random(seed), 'earth')
    k = [0.66, 0.84, 1.0][stage]
    bw, bh = 10 * k, 6 * k; by = 30 - 4 * k - bh / 2; hx, hy, hr = 16 - bw * 0.75, by - bh * 0.7, 5.5 * k
    if plan == 'quad':
        # clear random horns above the head, then add the family's own features
        for y in range(0, int(hy - hr + 1)):
            for x in range(0, 16):
                if c.m[y][x] == 'a': c.m[y][x] = None
        if fam == 'steed':
            c.line(hx + 2, hy - hr + 1, hx + 6, by - bh * 0.6, 'd', 2)            # mane
            c.line(16 + bw, by - 1, 16 + bw + 3, by + 5, 'd', 2)                    # tail plume
            c.tri([(hx - 1, hy - hr + 1), (hx + 1, hy - hr + 1), (hx, hy - hr - 2)], 'b')
        elif fam == 'warwolf':
            c.tri([(hx - 3, hy - hr + 2), (hx - 0.5, hy - hr + 1), (hx - 2.5, hy - hr - 3)], 'b')
            c.tri([(hx + 0.5, hy - hr + 1), (hx + 3, hy - hr + 2), (hx + 2, hy - hr - 3)], 'b')
            c.ellipse(16 + bw + 2, by - 2, 3, 2, 'l', shade=False)                # bushy tail
        elif fam == 'raptor':
            c.line(16 + bw, by, 16 + bw + 6, by - 3, 'b', 2)                       # long tail
            c.line(hx - hr, hy + 1, hx - hr - 2, hy + 1, 'd', 1)
            for x in range(int(hx) + 2, int(16 + bw), 3): c.put(x, by - bh / 2 - 1, 'a')   # back spines
        elif fam == 'boar':
            c.tri([(hx - hr + 1, hy + 2), (hx - hr + 2, hy + 2), (hx - hr - 1, hy - 1)], 'w')  # tusk
            for x in range(int(hx) + 2, int(16 + bw), 2): c.put(x, by - bh / 2 - 1, 'd')   # bristles
        elif fam == 'stag':
            for sx in (-1, 2):
                x0, y0 = hx + sx, hy - hr + 1
                c.line(x0, y0, x0 - 1, y0 - 6, 'a', 1); c.line(x0 - 1, y0 - 3, x0 - 3, y0 - 5, 'a', 1); c.line(x0 - 1, y0 - 5, x0 + 1, y0 - 8, 'a', 1)
        elif fam == 'ram':
            for a in range(0, 360, 30):
                import math
                c.put(hx + 2 + math.cos(math.radians(a)) * 2.6, hy - 1 + math.sin(math.radians(a)) * 2.6, 'a')
        elif fam == 'bear':
            c.ellipse(hx - 2, hy - hr + 1, 1.6, 1.6, 'b', shade=False); c.ellipse(hx + 2, hy - hr + 1, 1.6, 1.6, 'b', shade=False)
        elif fam == 'sabrecat':
            c.line(hx - hr + 1, hy + 2, hx - hr + 1, hy + 5, 'w', 1); c.line(hx - hr + 3, hy + 2, hx - hr + 3, hy + 4, 'w', 1)  # fangs
            for x in range(int(hx) + 3, int(16 + bw), 3): c.line(x, by - bh / 2, x + 1, by, 'd', 1)                       # stripes
            c.tri([(hx - 2, hy - hr + 2), (hx, hy - hr + 1), (hx - 1, hy - hr - 2)], 'b')
            c.line(16 + bw, by, 16 + bw + 5, by - 5, 'b', 1)
    # saddle on the back: find the topmost body pixels in the middle columns
    xs = range(12, 21)
    for x in xs:
        for y in range(32):
            if c.m[y][x] in ('b', 'l', 'd', 'p'):
                c.m[y][x] = 'S'; c.m[min(31, y + 1)][x] = 'T'; break
    base, light, dark, acc = pal
    col = {'b': base, 'l': light, 'd': dark, 'a': acc, 'w': (255, 255, 255), 'k': (22, 18, 26), 'p': tuple(min(255, v + 40) for v in base), 'S': SADDLE, 'T': SADDLE_D}
    from PIL import Image
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    filled = [[c.m[y][x] is not None for x in range(32)] for y in range(32)]
    for y in range(32):
        for x in range(32):
            v = c.m[y][x]
            if v is not None: im.putpixel((x, y), col.get(v, base) + (255,))
            elif any(0 <= x + dx < 32 and 0 <= y + dy < 32 and filled[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                im.putpixel((x, y), (22, 18, 26, 255))
    return im


def main():
    mounts, no = [], 0
    for fi, (fid, fname, plan, tier, source, lvl, desc) in enumerate(FAMILIES):
        for vi, (vname, pal, off) in enumerate(VARIANTS):
            no += 1
            mid = f'{fid}_{vname.lower()}'
            im = render(fid, plan, vname, pal, f'{fid}-{fi}')
            im.save(os.path.join(ROOT, 'assets', f'mt_{mid}.png'))
            t = min(3, tier + (1 if vi >= 8 else 0))
            mounts.append({'id': mid, 'no': no, 'name': f'{vname} {fname}', 'family': fid, 'familyName': fname, 'variant': vname,
                           'tier': t, 'speed': [0, 4, 4, 8][t], 'enc': [1, 0.6, 0.45, 0.3][t], 'fly': plan == 'dragon',
                           'source': source if vi < 8 else ('raid' if source in ('raid', 'worldboss') else 'achievement'),
                           'lvl': lvl + off, 'price': 0 if source != 'stable' else (100 if lvl + off <= 15 else 200 + (lvl + off) * 25),
                           'desc': desc})
    js = '// GENERATED by tools/gen_mounts.py - do not edit by hand.\nconst MOUNTS = ' + json.dumps(mounts, separators=(',', ':')) + ';\n'
    open(os.path.join(ROOT, 'src', 'mount_data.js'), 'w').write(js)
    from PIL import Image
    sheet = Image.new('RGBA', (10 * 34, 12 * 34), (238, 236, 225, 255))
    for i, m in enumerate(mounts): sheet.alpha_composite(Image.open(os.path.join(ROOT, 'assets', f"mt_{m['id']}.png")), ((i % 10) * 34 + 1, (i // 10) * 34 + 1))
    sheet.save(os.path.join(ROOT, 'assets_preview', 'mounts.png'))
    print(len(mounts), 'mounts -> assets/mt_*.png, src/mount_data.js')


if __name__ == '__main__':
    main()
