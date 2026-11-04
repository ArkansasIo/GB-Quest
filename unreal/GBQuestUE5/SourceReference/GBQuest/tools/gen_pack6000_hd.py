#!/usr/bin/env python3
"""GB-Quest 6,000 asset pack, HD64 edition: original 64x64 shaded pixel art for all 18 categories.

    pip install numpy pillow
    python tools/gen_pack6000_hd.py                 # writes assets_hd64/gbq_6000 (+ atlases, manifests)
    python tools/gen_pack6000_hd.py --only monsters_creatures --limit 50

Built on tools/hd64_engine.py (height-field shapes, lit ramps, rock cells with glowing cracks, outlines).
Deterministic: the same asset id always gives the same image. Same layout and asset ids (GBQ-0001..GBQ-6000) as
tools/generate_6000_asset_pack.py, so existing references keep working; this generator replaces its images.
Monster and boss images are grouped by the game's 14 bestiary families (the manifest's `family` field), so the
Summer port can give each monster a picture of its own kind.
"""
import argparse, csv, hashlib, json, math, zipfile
from pathlib import Path
import numpy as np
from PIL import Image
from hd64_engine import Sprite, ramp, MAT, GLOW, value_noise, fbm, dilate, XX, YY, S

CUR = {'rng': np.random.default_rng(0)}


def mat(name, hue=None, sat=None, val=None, n=6):
    """a named material with a small per-asset variation in hue, saturation and value, so no two assets share a palette"""
    h, s, v = MAT[name]
    r = CUR['rng']
    h = hue if hue is not None else (h + r.uniform(-0.025, 0.025)) % 1
    s = sat if sat is not None else min(1, s * r.uniform(0.85, 1.15))
    v = val if val is not None else min(1, v * r.uniform(0.92, 1.05))
    return ramp(h, s, v, n)

CATEGORIES = [
    ("player_races_characters", 500), ("classes_subclasses", 300), ("weapons", 600), ("armor_clothing", 600),
    ("jewelry_accessories", 250), ("monsters_creatures", 700), ("bosses_raid_creatures", 250), ("environments_tilesets", 700),
    ("buildings_settlements", 300), ("maps_worlds", 150), ("dungeons_towers_raids", 250), ("magic_visual_effects", 250),
    ("items_consumables", 350), ("mounts_pets", 150), ("npcs_civilians", 200), ("ui_interface", 200),
    ("factions_quests_achievements", 150), ("promotional_loading_art", 100)]
FAMILIES = ['beast', 'humanoid', 'undead', 'elemental', 'monstrosity', 'fiend', 'fey', 'dragon', 'construct', 'aberration', 'plant', 'giant', 'ooze', 'celestial']
GLOWS = list(GLOW)


def pick(rng, seq):
    return seq[int(rng.integers(len(seq)))]


def rhue(rng, base, spread=0.08):
    h, s, v = MAT[base]
    return ramp((h + rng.uniform(-spread, spread)) % 1, min(1, s * rng.uniform(0.8, 1.2)), min(1, v * rng.uniform(0.85, 1.05)))


def any_ramp(rng, sat=(0.45, 0.8), val=(0.65, 0.95)):
    return ramp(rng.random(), rng.uniform(*sat), rng.uniform(*val))


# ================================================================== humanoids (characters, classes, NPCs, some monsters)
RACES = {
    'hearthkin': dict(skin='skin'), 'thornelf': dict(skin='skin', ears='long'), 'stonekin': dict(skin='skin2', beard=True, stout=True),
    'wispling': dict(skin='ice', wings='wisp', small=True), 'emberborn': dict(skin='fire', horns='small'), 'burrowkin': dict(skin='skin2', ears='round', small=True),
    'twinblood': dict(skin='purple', horns='small'), 'tuskborn': dict(skin='orcskin', tusks=True, stout=True), 'drakkin': dict(skin='scale', horns='back', tail=True),
    'hornfolk': dict(skin='skin3', horns='big'), 'felinar': dict(skin='fur', ears='cat', tail=True), 'pipkin': dict(skin='skin', small=True, ears='round'),
    'wolfkin': dict(skin='fur', ears='wolf', tail=True), 'starkin': dict(skin='crystal', halo=True), 'lunari': dict(skin='marble', ears='long', halo=True),
}
CLASS_GEAR = {
    'warden': ('plate', 'sword', 'shield'), 'berserker': ('fur', 'greataxe', None), 'vanguard': ('plate', 'hammer', 'shield'), 'strider': ('leather', 'bow', None),
    'shade': ('hood', 'dagger', 'dagger'), 'ascetic': ('robe', 'fist', None), 'arcanist': ('robe', 'staff', None), 'wildblood': ('leather', 'staff', None),
    'pactbound': ('robe', 'tome', None), 'cantor': ('leather', 'lute', None), 'chaplain': ('robe', 'mace', 'shield'), 'verdant': ('robe', 'staff', None),
    'necromancer': ('robe', 'scythe', None), 'summoner': ('robe', 'orb', None), 'sunwarden': ('plate', 'mace', 'shield'), 'runeblade': ('plate', 'sword', None),
    'ronin': ('leather', 'katana', None), 'shinobi': ('hood', 'shuriken', None), 'bladedancer': ('leather', 'sword', 'sword'), 'wyrmlancer': ('plate', 'spear', None),
    'corsair': ('leather', 'pistol', 'sword'), 'beastcaller': ('fur', 'axe', None), 'puppeteer': ('robe', 'orb', None), 'dreadknight': ('plate', 'greatsword', None),
    'voidhunter': ('leather', 'crossbow', None), 'scalesage': ('robe', 'staff', None), 'stormcaller': ('robe', 'orb', None),
}


def held(s, rng, kind, x, y, side, metal, wood, glow):
    """a weapon or tool in a hand at (x, y); side -1 left, +1 right"""
    if kind in (None, 'fist'):
        return
    if kind in ('sword', 'katana', 'greatsword', 'dagger'):
        L = {'dagger': 9, 'sword': 18, 'katana': 20, 'greatsword': 24}[kind]
        w = {'dagger': 2, 'sword': 2.5, 'katana': 2, 'greatsword': 3.5}[kind]
        s.capsule(x, y + 2, x + side * 2, y - L, w, w * 0.6, metal, z=2.2)
        s.capsule(x - 4, y - 1, x + 4, y - 1, 1.3, 1.3, wood, z=2.5)
    elif kind in ('greataxe', 'axe', 'hammer', 'mace', 'scythe', 'spear'):
        top = y - (24 if kind in ('greataxe', 'scythe', 'spear') else 16)
        s.capsule(x, y + 6, x + side, top, 1.4, 1.4, wood, z=2.0)
        if kind in ('greataxe', 'axe'):
            s.poly([(x, top + 1), (x + side * 9, top - 3), (x + side * 10, top + 8), (x, top + 7)], metal, z=2.4, bevel=2)
        elif kind == 'hammer':
            s.rect(x - 5, top - 2, x + 5, top + 5, metal, z=2.4)
        elif kind == 'mace':
            s.ellipse(x, top + 1, 4.5, 4.5, metal, z=2.4)
        elif kind == 'scythe':
            s.poly([(x, top), (x - side * 13, top + 4), (x - side * 4, top + 2)], metal, z=2.4, bevel=1)
        else:
            s.poly([(x - 2.5, top + 4), (x + side, top - 6), (x + 3.5, top + 4)], metal, z=2.4, bevel=1)
    elif kind in ('staff', 'orb'):
        if kind == 'staff':
            s.capsule(x, y + 8, x, y - 22, 1.3, 1.3, wood, z=2.0)
            s.ellipse(x, y - 24, 3.2, 3.2, s.material(mat('crystal')), z=2.6)
            s.glow_ellipse(x, y - 24, 1.6, 1.6, glow)
        else:
            s.ellipse(x, y - 4, 4, 4, s.material(mat('glass'), 'shiny'), z=2.6)
            s.glow_ellipse(x, y - 4, 2.2, 2.2, glow)
    elif kind in ('bow', 'crossbow'):
        if kind == 'bow':
            for t in range(9):
                a = -1.2 + t * 0.3
                s.ellipse(x + side * 6 * math.cos(a) - side * 3, y - 6 + 12 * math.sin(a), 1.4, 1.4, wood, z=2.2)
            s.px(x - side * 3, y - 6, (240, 230, 210))
        else:
            s.capsule(x - 6, y - 3, x + 6, y - 3, 1.2, 1.2, wood, z=2.4)
            s.capsule(x, y - 2, x + side * 8, y - 2, 1.2, 1.2, metal, z=2.5)
    elif kind == 'shield':
        s.ellipse(x, y - 2, 7, 8.5, metal, z=2.8)
        s.ellipse(x, y - 2, 4.5, 6, wood, z=3.0)
        s.ellipse(x, y - 2, 1.6, 1.6, metal, z=3.3)
    elif kind == 'tome':
        s.rect(x - 5, y - 6, x + 4, y + 3, s.material(rhue(rng, 'red')), z=2.4)
        s.glow_line([(x - 3, y - 2), (x + 2, y - 2)], glow)
    elif kind == 'lute':
        s.ellipse(x, y + 1, 5, 6, wood, z=2.4)
        s.capsule(x, y - 3, x + side * 3, y - 14, 1.2, 1.2, wood, z=2.5)
    elif kind in ('pistol', 'shuriken'):
        if kind == 'pistol':
            s.capsule(x, y - 1, x + side * 8, y - 3, 1.6, 1.6, metal, z=2.5)
        else:
            s.poly([(x, y - 6), (x + 2, y - 2), (x + 6, y), (x + 2, y + 2), (x, y + 6), (x - 2, y + 2), (x - 6, y), (x - 2, y - 2)], metal, z=2.6, bevel=1)


def humanoid(rng, race=None, outfit=None, weapon=None, offhand=None, palette=None, scale=1.0, monster=None):
    s = Sprite(rng)
    race = race or pick(rng, list(RACES))
    R = RACES.get(race, {})
    skin_name = monster.get('skin', R.get('skin', 'skin')) if monster else R.get('skin', 'skin')
    skin = s.material(rhue(rng, skin_name, 0.03))
    cloth = s.material(palette or any_ramp(rng))
    cloth2 = s.material(any_ramp(rng, val=(0.4, 0.7)))
    metal = s.material(mat(pick(rng, ['steel', 'gold', 'bronze', 'iron', 'silver'])), 'metal')
    wood = s.material(mat(pick(rng, ['wood', 'darkwood', 'leather'])))
    hair = s.material(ramp(pick(rng, [0.08, 0.1, 0.02, 0.6, 0.75, 0.12, 0.0]), rng.uniform(0.3, 0.8), rng.uniform(0.3, 0.95)))
    glow = pick(rng, GLOWS)
    outfit = outfit or pick(rng, ['plate', 'leather', 'robe', 'hood', 'fur', 'tunic'])
    small, stout = R.get('small') or (monster or {}).get('small'), R.get('stout') or (monster or {}).get('stout')
    k = scale * (0.85 if small else 1.0)
    cx = 32
    top = 64 - 62 * k
    def Y(v): return top + v * k
    def W(v): return v * k * (1.18 if stout else 1.0)
    # legs and feet
    for sg in (-1, 1):
        s.capsule(cx + sg * W(4.5), Y(40), cx + sg * W(5), Y(54), W(3.2), W(3.4), cloth2, z=0.3)
        s.ellipse(cx + sg * W(5.5), Y(56.5), W(4.2), 2.6 * k, wood if outfit != 'plate' else metal, z=0.6)
    # torso
    if outfit == 'robe':
        s.poly([(cx - W(8), Y(24)), (cx + W(8), Y(24)), (cx + W(12), Y(56)), (cx - W(12), Y(56))], cloth, z=0.9, bevel=3)
        s.rect(cx - W(9), Y(36), cx + W(9), Y(39), cloth2, z=1.2)
    else:
        s.poly([(cx - W(8), Y(23)), (cx + W(8), Y(23)), (cx + W(7), Y(41)), (cx - W(7), Y(41))], cloth if outfit != 'plate' else metal, z=0.9, bevel=3)
        s.rect(cx - W(7.5), Y(37), cx + W(7.5), Y(40), wood, z=1.3, bevel=1)
        s.px(cx, Y(38.5), (230, 200, 90))
        if outfit == 'plate':
            s.ellipse(cx, Y(29), W(6), 5 * k, metal, z=1.4)
        if outfit == 'fur':
            for sg in (-1, 1):
                s.ellipse(cx + sg * W(8), Y(22), W(5), 4 * k, s.material(mat('fur')), z=1.6)
    # arms
    hand = {}
    for sg in (-1, 1):
        sh = (cx + sg * W(9.5), Y(25))
        hx, hy = cx + sg * W(12.5), Y(39)
        s.capsule(sh[0], sh[1], hx, hy, W(2.8), W(2.4), cloth if outfit in ('robe', 'hood') else (metal if outfit == 'plate' else skin), z=1.4)
        if outfit == 'plate':
            s.ellipse(sh[0], sh[1], W(4.5), 3.6 * k, metal, z=1.6)
        s.ellipse(hx, hy + 1, W(2.6), 2.6 * k, skin, z=1.3)
        hand[sg] = (hx, hy)
    # head
    hy = Y(13)
    if R.get('wings') == 'wisp' or (monster or {}).get('wings'):
        wingm = s.material(mat('ice') if not monster else rhue(rng, monster.get('wingmat', 'shadow')), alpha=None)
        for sg in (-1, 1):
            s.poly([(cx + sg * 6, Y(24)), (cx + sg * 26, Y(10)), (cx + sg * 22, Y(34))], wingm, z=-0.5, bevel=2)
    if R.get('tail') or (monster or {}).get('tail'):
        s.capsule(cx + 6, Y(44), cx + 18, Y(52), 2, 1, skin, z=-0.4)
    s.ellipse(cx, hy, W(9.5), 9.5 * k, skin, z=1.6)
    ears = R.get('ears')
    if ears == 'long':
        for sg in (-1, 1): s.poly([(cx + sg * W(6), hy - 1), (cx + sg * W(14), hy - 6), (cx + sg * W(7), hy + 3)], skin, z=1.5, bevel=1)
    elif ears in ('cat', 'wolf'):
        for sg in (-1, 1): s.poly([(cx + sg * W(3), hy - 6 * k), (cx + sg * W(8), hy - 13 * k), (cx + sg * W(8), hy - 4 * k)], skin, z=1.8, bevel=1)
    elif ears == 'round':
        for sg in (-1, 1): s.ellipse(cx + sg * W(8), hy - 3, W(3), 3 * k, skin, z=1.5)
    horns = R.get('horns') or (monster or {}).get('horns')
    if horns:
        hm = s.material(mat('bone') if horns != 'back' else rhue(rng, 'black'))
        L = {'small': 4, 'big': 9, 'back': 7}.get(horns, 6)
        for sg in (-1, 1): s.capsule(cx + sg * W(4), hy - 5 * k, cx + sg * W(4 + L * 0.7), hy - (5 + L) * k, 1.8, 0.6, hm, z=2.0)
    # hair / headgear
    if outfit == 'hood':
        s.ellipse(cx, hy - 1.5, W(9.5), 9 * k, cloth, z=1.2)
        s.ellipse(cx, hy + 1.5, W(6.5), 5.5 * k, skin, z=2.2)
    elif outfit == 'plate' and rng.random() < 0.6:
        s.ellipse(cx, hy - 2, W(9), 7.5 * k, metal, z=2.1)
        s.rect(cx - W(5), hy - 1, cx + W(5), hy + 1, s.material(mat('black')), z=2.4, bevel=1)
    else:
        style = int(rng.integers(4))
        if style == 0: s.ellipse(cx, hy - 5 * k, W(10), 6 * k, hair, z=2.0)
        elif style == 1: s.ellipse(cx, hy - 3, W(10.5), 8 * k, hair, z=0.8); s.capsule(cx, hy, cx, hy + 12 * k, W(8), W(6), hair, z=0.3); s.ellipse(cx, hy - 5 * k, W(10), 5.5 * k, hair, z=2.0)
        elif style == 2: s.poly([(cx - W(10.5), hy - 2), (cx - W(4), hy - 15 * k), (cx + W(2), hy - 10 * k), (cx + W(10.5), hy - 2)], hair, z=2.0, bevel=2)
        if outfit == 'robe' and rng.random() < 0.35:   # wizard hat
            s.poly([(cx - W(11), hy - 3), (cx + W(11), hy - 3), (cx + W(2), hy - 22 * k)], cloth, z=2.6, bevel=2)
    if R.get('beard') or (monster or {}).get('beard'):
        s.ellipse(cx, hy + 6 * k, W(5.5), 4.5 * k, hair, z=2.3)
    if R.get('tusks'):
        for sg in (-1, 1): s.px(cx + sg * 3, hy + 4, (240, 232, 210))
    # face
    eye = (20, 18, 30)
    ey = int(hy + 1)
    if (monster or {}).get('glow_eyes'):
        s.glow_ellipse(cx - 3.5, ey, 1.3, 1, monster.get('glow', glow)); s.glow_ellipse(cx + 3.5, ey, 1.3, 1, monster.get('glow', glow))
    else:
        for ex in (int(cx - 4), int(cx + 3)):
            s.px(ex, ey - 1, (250, 250, 250)); s.px(ex + 1, ey - 1, eye); s.px(ex, ey, eye); s.px(ex + 1, ey, eye)
        s.px(int(cx), ey + 3, tuple(max(0, c - 70) for c in s.mats[skin]['ramp'][3]))
    if R.get('halo'):
        s.glow_line([(cx - 7, hy - 11), (cx + 7, hy - 11)], 'holy')
    held(s, rng, weapon, hand[1][0], hand[1][1], 1, metal, wood, glow)
    held(s, rng, offhand, hand[-1][0], hand[-1][1], -1, metal, wood, glow)
    return s


def gen_character(i, rng):
    race = list(RACES)[i % len(RACES)]
    w = pick(rng, [None, 'sword', 'staff', 'bow', 'dagger', 'axe', 'mace', 'spear'])
    return humanoid(rng, race=race, weapon=w, offhand=pick(rng, [None, None, 'shield'])).render()


def gen_class(i, rng):
    cls = list(CLASS_GEAR)[i % len(CLASS_GEAR)]
    outfit, wpn, off = CLASS_GEAR[cls]
    return humanoid(rng, outfit=outfit, weapon=wpn, offhand=off).render()


def gen_npc(i, rng):
    s = humanoid(rng, outfit=pick(rng, ['tunic', 'robe', 'leather']), weapon=pick(rng, [None, 'hammer', 'staff', 'lute', None]),
                 palette=ramp(rng.uniform(0.02, 0.14), rng.uniform(0.2, 0.5), rng.uniform(0.55, 0.9)))
    if rng.random() < 0.5:   # apron or satchel
        s.rect(26, 36, 38, 52, s.material(mat('paper', val=0.85)), z=1.5)
    return s.render()


# ================================================================== quadrupeds, birds, serpents
def quadruped(rng, body='fur', big=1.0, horns=False, saddle=False, mane=False, spikes=False, glow=None, tail=True):
    s = Sprite(rng)
    m = s.material(rhue(rng, body, 0.05) if body in MAT else body, 'plain')
    dark = s.material(rhue(rng, 'black'))
    k = big
    by = 36
    for x in (20, 26, 40, 46):   # legs (back pair lower z)
        z = 0.0 if x in (26, 46) else 0.6
        s.capsule(x, by, x - 1, 56, 3.2 * k, 2.8 * k, m, z=z)
        s.ellipse(x - 1, 57, 3.4 * k, 2 * k, dark, z=z + 0.3)
    s.ellipse(33, by - 2, 18 * k, 11 * k, m, z=1.0)                 # body
    s.capsule(19, by - 5, 14, by - 13, 6 * k, 5.5 * k, m, z=1.3)    # neck
    s.ellipse(12, by - 16, 8 * k, 7 * k, m, z=1.8)                   # head
    s.ellipse(6, by - 13, 5 * k, 4 * k, m, z=2.0)                    # snout
    s.px(3, by - 14, (20, 16, 20))
    s.px(10, by - 18, (250, 250, 240)); s.px(10, by - 17, (20, 16, 20)); s.px(11, by - 17, (20, 16, 20))
    s.poly([(13, by - 21), (17, by - 29), (18, by - 19)], m, z=1.9, bevel=1)   # ear
    if tail:
        s.capsule(49, by - 4, 58, by + 4, 2.5, 1.2, m, z=0.5)
    if horns:
        hm = s.material(mat('bone'))
        s.capsule(10, by - 23, 18, by - 31, 1.8, 0.6, hm, z=2.3)
    if mane:
        mm = s.material(any_ramp(rng, val=(0.3, 0.7)))
        s.capsule(14, by - 22, 24, by - 8, 3, 3.5, mm, z=1.6)
    if spikes:
        sm = s.material(mat('bone'))
        for x in range(22, 46, 5):
            s.poly([(x - 2, by - 10), (x, by - 17), (x + 2, by - 10)], sm, z=1.8, bevel=1)
    if saddle:
        sd = s.material(mat('leather'))
        s.ellipse(32, by - 10, 7, 4, sd, z=1.8)
        s.rect(29, by - 8, 35, by + 4, s.material(any_ramp(rng)), z=1.6, bevel=1)
    if glow:
        s.glow_ellipse(10.5, by - 17.5, 1.3, 0.9, glow)
    s.texture(m, 'fur' if body in ('fur',) else 'noise', 0.5)
    return s


def bird(rng, glow=None, griffin=False):
    s = Sprite(rng)
    m = s.material(any_ramp(rng))
    w = s.material(any_ramp(rng, val=(0.5, 0.85)))
    beak = s.material(mat('gold'))
    if griffin:
        for x in (24, 40):
            s.capsule(x, 40, x, 56, 3, 2.5, m, z=0.4)
    s.ellipse(32, 36, 12, 10, m, z=1.0)
    s.ellipse(32, 20, 7, 7, m, z=1.6)
    s.poly([(34, 20), (42, 22), (34, 25)], beak, z=2.0, bevel=1)
    for sg in (-1, 1):
        s.poly([(32 + sg * 8, 30), (32 + sg * 30, 14), (32 + sg * 26, 30), (32 + sg * 22, 40)], w, z=0.4, bevel=2)
    s.capsule(28, 44, 26, 54, 2, 1, beak, z=0.6); s.capsule(36, 44, 38, 54, 2, 1, beak, z=0.6)
    s.px(35, 18, (20, 16, 20))
    if glow: s.glow_ellipse(35, 18, 1, 1, glow)
    s.texture(w, 'stripes', 0.4)
    return s


def serpent(rng, mats='scale', glow=None):
    s = Sprite(rng)
    m = s.material(rhue(rng, mats))
    belly = s.material(mat('sandstone'))
    pts = [(8 + t * 2.1, 46 + 8 * math.sin(t * 0.38)) for t in range(20)]
    for i, (x, y) in enumerate(pts):
        s.ellipse(x, y, 4 + i * 0.12, 4 + i * 0.1, m, z=0.4 + i * 0.04)
    s.ellipse(52, 26, 7, 6, m, z=1.5)
    s.capsule(49, 40, 52, 30, 4, 4, m, z=1.2)
    s.ellipse(52, 30, 3, 2, belly, z=1.7)
    s.px(54, 24, (250, 240, 120)); s.px(54, 25, (20, 16, 20))
    if glow: s.glow_ellipse(54, 24.5, 1, 1, glow)
    s.texture(m, 'scales', 0.6)
    return s


# ================================================================== monster families
def golem(rng, big=1.0, stone=None, glow=None, metal=False):
    s = Sprite(rng)
    stone = stone or pick(rng, ['stone', 'darkstone', 'sandstone', 'marble'])
    glow = glow or pick(rng, GLOWS)
    h, sa, v = MAT[stone]
    m = s.material(ramp(h, sa, v * 0.8) if not metal else mat('iron'), 'metal' if metal else 'plain')
    k = big
    cx = 32
    def X(d): return cx + d * k
    def Y(v_): return 64 - (64 - v_) * k
    for sg in (-1, 1):
        s.capsule(X(sg * 6), Y(43), X(sg * 7), Y(55), 5 * k, 6 * k, m, z=0.2)
        s.ellipse(X(sg * 8), Y(58), 7 * k, 4 * k, m, z=0.5)
        s.ellipse(X(sg * 16), Y(19), 7 * k, 6 * k, m, z=1.4)
        s.capsule(X(sg * 19), Y(24), X(sg * 21), Y(40), 5 * k, 6 * k, m, z=0.6)
        s.ellipse(X(sg * 21), Y(45), 6.5 * k, 6 * k, m, z=1.0)
    s.ellipse(cx, Y(29), 12 * k, 12 * k, m, z=1.0)
    s.ellipse(cx, Y(40), 8 * k, 5 * k, m, z=0.4)
    s.ellipse(cx, Y(11), 6 * k, 6.5 * k, m, z=1.6)
    if metal:
        s.texture(m, 'stripes', 0.3)
    else:
        s.rockify(m, cells=int(22 + 10 * k), crack=glow, crack_frac=rng.uniform(0.4, 0.75))
    s.glow_ellipse(cx - 2.4 * k, Y(11.5), 1.5, 0.9, glow); s.glow_ellipse(cx + 2.4 * k, Y(11.5), 1.5, 0.9, glow)
    s.glow_ellipse(cx, Y(31), 2.2 * k, 2.2 * k, glow)
    return s


def slime(rng, big=1.0):
    s = Sprite(rng)
    m = s.material(any_ramp(rng, sat=(0.5, 0.9), val=(0.7, 1.0)), 'shiny')
    s.ellipse(32, 46 - 6 * (big - 1), 20 * big, 14 * big, m, z=0.5)
    s.ellipse(32, 36 - 8 * (big - 1), 12 * big, 10 * big, m, z=1.3)
    for _ in range(3):
        s.ellipse(rng.uniform(20, 44), rng.uniform(40, 52), rng.uniform(1, 2.5), rng.uniform(1, 2.5), m, z=2.6)
    s.ellipse(25, 32, 2.2, 2.8, s.material(mat('white')), z=3); s.ellipse(37, 32, 2.2, 2.8, s.material(mat('white')), z=3)
    s.px(25, 33, (15, 15, 25)); s.px(37, 33, (15, 15, 25))
    if rng.random() < 0.4:
        s.glow_ellipse(32, 45, 3, 2, pick(rng, GLOWS))
    return s


def skeleton(rng, big=1.0):
    s = Sprite(rng)
    b = s.material(mat('bone'))
    for sg in (-1, 1):
        s.capsule(32 + sg * 4, 40, 32 + sg * 5, 56, 1.6, 1.6, b, z=0.5)
        s.capsule(32 + sg * 9, 22, 32 + sg * 13, 40, 1.6, 1.6, b, z=0.8)
    s.capsule(32, 22, 32, 40, 2, 2, b, z=0.9)
    for y in (25, 29, 33):
        s.capsule(26, y, 38, y, 1.2, 1.2, b, z=1.2)
    s.ellipse(32, 41, 6, 2.5, b, z=1.0)
    s.ellipse(32, 13, 7, 7.5, b, z=1.6)
    s.ellipse(32, 19, 4.5, 2.5, b, z=1.7)
    g = pick(rng, ['soul', 'frost', 'toxic', 'blood', 'arcane'])
    s.glow_ellipse(29, 13, 1.6, 1.6, g); s.glow_ellipse(35, 13, 1.6, 1.6, g)
    held(s, rng, pick(rng, ['sword', 'axe', 'spear', 'shield', 'staff']), 45, 40, 1, s.material(mat('iron'), 'metal'), s.material(mat('darkwood')), g)
    return s


def ghost(rng):
    s = Sprite(rng)
    g = pick(rng, ['soul', 'frost', 'arcane'])
    hh, ss, vv = {'soul': (0.46, 0.4, 0.95), 'frost': (0.56, 0.35, 0.98), 'arcane': (0.74, 0.35, 0.95)}[g]
    m = s.material(ramp((hh + rng.uniform(-0.05, 0.05)) % 1, ss * rng.uniform(0.7, 1.3), vv * rng.uniform(0.85, 1)), 'shiny', alpha=190)
    w, hgt = rng.uniform(11, 15), rng.uniform(13, 17)
    s.ellipse(32, 26, w, hgt, m, z=1.0)
    tail = [(32 - w - 3 + k * (2 * w + 6) / 6, 56 - (k % 2) * rng.uniform(6, 11)) for k in range(7)]
    s.poly([(32 - w + 1, 26), (32 + w - 1, 26)] + tail[::-1], m, z=0.6, bevel=3)
    for sg in (-1, 1):
        s.capsule(32 + sg * 12, 30, 32 + sg * 20, 40, 3, 2, m, z=0.8)
    s.glow_ellipse(27, 24, 2, 2.6, g); s.glow_ellipse(37, 24, 2, 2.6, g)
    s.glow_line([(28, 33), (32, 36), (36, 33)], g)
    return s


def elemental(rng, kind=None):
    kind = kind or pick(rng, ['fire', 'ice', 'storm', 'earth', 'water', 'void'])
    if kind == 'earth':
        return golem(rng, big=0.85, stone='sandstone', glow='lava')
    s = Sprite(rng)
    g = {'fire': 'lava', 'ice': 'frost', 'storm': 'storm', 'water': 'frost', 'void': 'arcane'}[kind]
    base = {'fire': ramp(0.05, 0.9, 1.0), 'ice': mat('ice'), 'storm': ramp(0.62, 0.5, 0.9), 'water': ramp(0.57, 0.7, 0.95), 'void': ramp(0.76, 0.6, 0.6)}[kind]
    m = s.material(base, 'shiny')
    if kind == 'ice':
        for _ in range(9):
            x, y = rng.uniform(18, 46), rng.uniform(14, 50)
            s.poly([(x, y - rng.uniform(6, 12)), (x + 4, y), (x, y + 6), (x - 4, y)], m, z=rng.uniform(0.5, 2), bevel=2)
    else:
        for i in range(14):
            a = i / 14 * 6.28
            r = rng.uniform(6, 14)
            s.ellipse(32 + math.cos(a) * r * 0.8, 34 + math.sin(a) * r, rng.uniform(4, 8), rng.uniform(4, 8), m, z=rng.uniform(0.4, 1.6))
        s.ellipse(32, 18, 9, 9, m, z=2.0)
        if kind == 'fire':
            for _ in range(6):
                x = rng.uniform(20, 44)
                s.poly([(x - 4, 20), (x + rng.uniform(-3, 3), rng.uniform(2, 10)), (x + 4, 20)], m, z=2.3, bevel=2)
    core = dilate(np.zeros((64, 64), bool), 0)
    for _ in range(int(rng.integers(3, 7))):
        x, y = rng.uniform(22, 42), rng.uniform(20, 46)
        s.glow_ellipse(x, y, rng.uniform(1, 2.5), rng.uniform(1, 2.5), g)
    s.glow_ellipse(28.5, 17.5, 1.4, 1, g); s.glow_ellipse(35.5, 17.5, 1.4, 1, g)
    return s


def spider(rng):
    s = Sprite(rng)
    m = s.material(any_ramp(rng, val=(0.35, 0.6)))
    for sg in (-1, 1):
        for j in range(4):
            y = 30 + j * 4
            s.line([(32 + sg * 6, y), (32 + sg * (16 + j), y - 10 + j * 2), (32 + sg * (24 + j), y + 14)], 2.2, m, z=0.3)
    s.ellipse(32, 42, 12, 10, m, z=1.0)
    s.ellipse(32, 27, 7, 6, m, z=1.4)
    g = pick(rng, GLOWS)
    for x in (29, 32, 35):
        s.glow_ellipse(x, 26, 0.9, 0.9, g)
    s.texture(m, 'noise', 0.5)
    return s


def dragon(rng, big=1.0):
    s = Sprite(rng)
    m = s.material(any_ramp(rng, sat=(0.5, 0.85), val=(0.55, 0.9)))
    belly = s.material(mat('sandstone'))
    wing = s.material(any_ramp(rng, val=(0.35, 0.6)))
    k = big
    for sg in (-1, 1):
        s.poly([(32 + sg * 4, 26), (32 + sg * 30 * k, 6), (32 + sg * 28 * k, 26), (32 + sg * 22 * k, 36)], wing, z=-0.6, bevel=2)
    s.ellipse(34, 40, 14 * k, 11 * k, m, z=1.0)
    s.ellipse(34, 42, 8 * k, 7 * k, belly, z=1.4)
    s.capsule(28, 34, 18, 18, 5 * k, 4 * k, m, z=1.4)
    s.ellipse(15, 15, 7 * k, 5.5 * k, m, z=2.0)
    s.ellipse(9, 17, 4.5 * k, 3 * k, m, z=2.2)
    s.capsule(46, 46, 58, 56, 4, 1.4, m, z=0.6)
    for x in (26, 42):
        s.capsule(x, 46, x, 57, 3.4, 3, m, z=0.8)
    hm = s.material(mat('bone'))
    s.capsule(17, 11, 22, 4, 1.6, 0.5, hm, z=2.4)
    g = pick(rng, ['lava', 'frost', 'toxic', 'storm', 'arcane'])
    s.glow_ellipse(14, 14, 1.3, 0.9, g)
    if rng.random() < 0.5:
        s.glow_ellipse(5, 18, 2, 1.4, g)
    s.texture(m, 'scales', 0.5)
    return s


def eyebeast(rng, big=1.0):
    s = Sprite(rng)
    m = s.material(any_ramp(rng, val=(0.5, 0.8)))
    for i in range(6):
        a = -2.6 + i * 0.42
        x, y = 32 + math.cos(a) * 22 * big, 30 + math.sin(a) * 20 * big
        s.capsule(32, 28, x, y, 1.8, 1.2, m, z=0.5)
        s.ellipse(x, y, 3, 3, s.material(mat('white')), z=1.0)
        s.px(x, y, (20, 15, 25))
    s.ellipse(32, 36, 15 * big, 14 * big, m, z=1.0)
    s.ellipse(32, 34, 7 * big, 7 * big, s.material(mat('white')), z=2.2)
    s.glow_ellipse(32, 34, 3 * big, 3 * big, pick(rng, ['blood', 'arcane', 'toxic', 'holy']))
    s.capsule(22, 46, 42, 46, 1.4, 1.4, s.material(mat('black')), z=2.0)
    return s


def treant(rng):
    s = Sprite(rng)
    bark = s.material(rhue(rng, 'darkwood'))
    leaf = s.material(rhue(rng, 'leaf', 0.08))
    s.capsule(32, 56, 32, 26, 8, 6, bark, z=0.8)
    for sg in (-1, 1):
        s.capsule(32 + sg * 5, 34, 32 + sg * 17, 28, 3, 2, bark, z=1.0)
        s.capsule(32 + sg * 4, 54, 32 + sg * 12, 58, 3, 2, bark, z=0.8)
    for _ in range(9):
        s.ellipse(32 + rng.uniform(-16, 16), 18 + rng.uniform(-8, 6), rng.uniform(6, 10), rng.uniform(5, 8), leaf, z=rng.uniform(1, 2.2))
    s.texture(bark, 'stripes', 0.5)
    s.texture(leaf, 'noise', 0.7)
    g = pick(rng, ['toxic', 'holy', 'soul'])
    s.glow_ellipse(29, 36, 1.4, 1, g); s.glow_ellipse(35, 36, 1.4, 1, g)
    if rng.random() < 0.5:
        for _ in range(4):
            s.ellipse(32 + rng.uniform(-14, 14), 16 + rng.uniform(-6, 8), 1.6, 1.6, s.material(any_ramp(rng, val=(0.85, 1))), z=3)
    return s


def flower_beast(rng):
    s = Sprite(rng)
    stem = s.material(mat('leaf'))
    pet = s.material(any_ramp(rng, sat=(0.6, 0.9)))
    s.capsule(32, 58, 30, 32, 3, 2.5, stem, z=0.6)
    for sg in (-1, 1):
        s.ellipse(32 + sg * 10, 48, 8, 3.5, stem, z=0.8, rot=sg * 0.4)
    for i in range(7):
        a = i / 7 * 6.28
        s.ellipse(30 + math.cos(a) * 10, 22 + math.sin(a) * 10, 6, 6, pet, z=1.0)
    s.ellipse(30, 22, 7, 7, s.material(mat('black')), z=1.6)
    for x in range(25, 36, 3):
        s.px(x, 24, (245, 240, 230))
    s.glow_ellipse(27, 19, 1, 1, 'toxic'); s.glow_ellipse(33, 19, 1, 1, 'toxic')
    return s


def mushroom(rng):
    s = Sprite(rng)
    cap = s.material(any_ramp(rng, sat=(0.6, 0.9)))
    stem = s.material(mat('paper'))
    s.capsule(32, 56, 32, 32, 7, 6, stem, z=0.6)
    s.ellipse(32, 26, 20, 12, cap, z=1.2)
    for _ in range(6):
        s.ellipse(rng.uniform(16, 48), rng.uniform(18, 30), 2.2, 1.8, s.material(mat('white')), z=2.6)
    s.px(29, 42, (20, 16, 20)); s.px(35, 42, (20, 16, 20))
    if rng.random() < 0.5:
        s.glow_ellipse(32, 26, 4, 2, pick(rng, ['arcane', 'soul', 'toxic']))
    return s


def tentacle(rng):
    s = Sprite(rng)
    m = s.material(any_ramp(rng, val=(0.45, 0.75)))
    for i in range(5):
        x0 = 14 + i * 9
        pts = [(x0 + 4 * math.sin(t * 0.7 + i), 58 - t * 5) for t in range(9)]
        for j, (x, y) in enumerate(pts):
            s.ellipse(x, y, 4 - j * 0.35, 4 - j * 0.35, m, z=0.4 + j * 0.1)
    s.ellipse(32, 50, 16, 8, m, z=1.2)
    g = pick(rng, ['arcane', 'toxic', 'soul'])
    for x in (26, 32, 38):
        s.glow_ellipse(x, 49, 1.3, 1.3, g)
    s.texture(m, 'noise', 0.6)
    return s


def creature(fam, rng, big=1.0):
    r = rng.random()
    if fam == 'construct':
        return golem(rng, big=0.92 * big, metal=r < 0.25)
    if fam == 'ooze':
        return slime(rng, big=big)
    if fam == 'beast':
        return quadruped(rng, body=pick(rng, ['fur', 'leather', 'black', 'sandstone']), big=big, horns=r < 0.3, mane=0.3 < r < 0.5, glow=pick(rng, GLOWS) if r > 0.85 else None)
    if fam == 'undead':
        return skeleton(rng) if r < 0.45 else (ghost(rng) if r < 0.75 else humanoid(rng, outfit='tunic', weapon=pick(rng, [None, 'axe']), monster=dict(skin='moss', glow_eyes=True, glow='toxic')))
    if fam == 'elemental':
        return elemental(rng)
    if fam == 'monstrosity':
        return spider(rng) if r < 0.4 else quadruped(rng, body=pick(rng, ['scale', 'purple', 'red']), big=big, spikes=True, horns=True, glow=pick(rng, GLOWS))
    if fam == 'fiend':
        return humanoid(rng, outfit=pick(rng, ['tunic', 'fur', 'leather']), weapon=pick(rng, ['scythe', 'greataxe', 'staff', None]),
                        monster=dict(skin=pick(rng, ['red', 'purple', 'black']), horns='big', wings=r < 0.6, tail=True, glow_eyes=True, glow='lava', wingmat='red'))
    if fam == 'fey':
        return mushroom(rng) if r < 0.4 else humanoid(rng, outfit='tunic', weapon=pick(rng, [None, 'staff', 'bow']), monster=dict(skin=pick(rng, ['leaf', 'teal', 'crystal']), small=True, wings=True, wingmat='teal'))
    if fam == 'dragon':
        return dragon(rng, big=big) if r < 0.7 else serpent(rng, glow=pick(rng, GLOWS))
    if fam == 'aberration':
        return eyebeast(rng, big=big) if r < 0.55 else tentacle(rng)
    if fam == 'plant':
        return treant(rng) if r < 0.5 else flower_beast(rng)
    if fam == 'giant':
        return humanoid(rng, outfit=pick(rng, ['fur', 'tunic']), weapon=pick(rng, ['hammer', 'greataxe', 'mace']), scale=1.0,
                        monster=dict(skin=pick(rng, ['skin2', 'orcskin', 'ice', 'stone' if 'stone' in MAT else 'skin3']), stout=True, beard=r < 0.5))
    if fam == 'humanoid':
        return humanoid(rng, outfit=pick(rng, ['leather', 'tunic', 'fur', 'hood']), weapon=pick(rng, ['sword', 'axe', 'dagger', 'bow', 'spear', 'mace']),
                        offhand=pick(rng, [None, 'shield']), monster=dict(skin=pick(rng, ['orcskin', 'green', 'skin2', 'skin']), small=r < 0.4))
    if fam == 'celestial':
        return humanoid(rng, outfit=pick(rng, ['robe', 'plate']), weapon=pick(rng, ['sword', 'spear', 'staff']), palette=mat('white'),
                        monster=dict(skin='marble', wings=True, wingmat='white', glow_eyes=True, glow='holy'))
    return golem(rng)


def gen_monster(i, rng):
    fam = FAMILIES[i % len(FAMILIES)]
    return creature(fam, rng).render(), fam


def gen_boss(i, rng):
    fam = FAMILIES[i % len(FAMILIES)]
    s = creature(fam, rng, big=1.15)
    # bosses carry a crown or aura
    g = pick(rng, GLOWS)
    img = s.render()
    aura = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    a = np.zeros((64, 64, 4), np.uint8)
    alpha = np.array(img)[..., 3] > 0
    ring = dilate(alpha, 2) & ~alpha
    a[ring] = (*GLOW[g][0], 120)
    aura = Image.fromarray(a, 'RGBA')
    aura.alpha_composite(img)
    return aura, fam


def gen_mount(i, rng):
    kind = i % 6
    if kind == 0: s = quadruped(rng, body=pick(rng, ['fur', 'leather', 'white', 'black']), mane=True, saddle=True)
    elif kind == 1: s = quadruped(rng, body='fur', saddle=True, glow=pick(rng, GLOWS))
    elif kind == 2: s = quadruped(rng, body=pick(rng, ['scale', 'green', 'red']), saddle=True, spikes=True)
    elif kind == 3: s = bird(rng, griffin=True)
    elif kind == 4: s = slime(rng, big=0.8)
    else: s = quadruped(rng, body=pick(rng, ['fur', 'white']), big=0.75, tail=True)
    return s.render()


# ================================================================== items
WEAPON_KINDS = ['sword', 'greatsword', 'dagger', 'axe', 'greataxe', 'mace', 'hammer', 'spear', 'bow', 'crossbow', 'staff', 'wand', 'scythe', 'katana', 'trident']


def icon_weapon(i, rng):
    s = Sprite(rng)
    kind = WEAPON_KINDS[i % len(WEAPON_KINDS)]
    metal = s.material(mat(pick(rng, ['steel', 'silver', 'gold', 'bronze', 'iron', 'crystal'])), 'metal')
    grip = s.material(mat(pick(rng, ['leather', 'wood', 'darkwood'])))
    guard = s.material(mat(pick(rng, ['gold', 'bronze', 'steel'])), 'metal')
    gem = s.material(any_ramp(rng, sat=(0.7, 1), val=(0.85, 1)), 'shiny')
    g = pick(rng, GLOWS)
    # everything along the diagonal from bottom-left (handle) to top-right (tip)
    def P(t): return 10 + t * 44, 54 - t * 44
    if kind in ('sword', 'greatsword', 'dagger', 'katana'):
        L = {'dagger': 0.55, 'sword': 0.85, 'greatsword': 1.0, 'katana': 0.95}[kind]
        w = {'dagger': 2.6, 'sword': 3.2, 'greatsword': 4.4, 'katana': 2.4}[kind]
        x0, y0 = P(0.18); x1, y1 = P(L)
        s.capsule(x0, y0, x1, y1, w, 0.8, metal, z=1.0)
        s.capsule(*P(0.0), *P(0.16), 1.8, 1.8, grip, z=1.0)
        gx, gy = P(0.17)
        s.capsule(gx - 6, gy - 6, gx + 6, gy + 6, 1.8, 1.8, guard, z=1.6)
        s.ellipse(*P(0.0), 2.4, 2.4, guard, z=1.4)
        s.ellipse(gx, gy, 1.6, 1.6, gem, z=2.0)
        if rng.random() < 0.4: s.glow_line([P(0.25), P(L - 0.08)], g)
    elif kind in ('axe', 'greataxe', 'mace', 'hammer', 'scythe', 'spear', 'trident'):
        s.capsule(*P(0.0), *P(0.82), 1.7, 1.7, grip, z=0.8)
        hx, hy = P(0.78)
        if kind in ('axe', 'greataxe'):
            big = 1.4 if kind == 'greataxe' else 1.0
            s.poly([(hx - 2, hy + 2), (hx - 4 * big, hy - 12 * big), (hx + 10 * big, hy - 2 * big), (hx + 2, hy + 3)], metal, z=1.4, bevel=2)
        elif kind == 'mace':
            s.ellipse(hx, hy, 6, 6, metal, z=1.4)
            for a in range(0, 360, 60):
                s.poly([(hx + 5 * math.cos(math.radians(a)), hy + 5 * math.sin(math.radians(a))), (hx + 9 * math.cos(math.radians(a + 10)), hy + 9 * math.sin(math.radians(a + 10))), (hx + 5 * math.cos(math.radians(a + 25)), hy + 5 * math.sin(math.radians(a + 25)))], metal, z=1.5, bevel=1)
        elif kind == 'hammer':
            s.capsule(hx - 7, hy - 7, hx + 7, hy + 7, 5, 5, metal, z=1.4)
        elif kind == 'scythe':
            s.poly([(hx, hy), (hx - 22, hy - 4), (hx - 8, hy + 3)], metal, z=1.4, bevel=1)
        elif kind == 'spear':
            s.poly([(hx - 3, hy + 3), (hx + 8, hy - 8), (hx + 3, hy + 3)], metal, z=1.4, bevel=1)
        else:
            for d in (-5, 0, 5):
                s.capsule(hx + d * 0.7, hy + d * 0.7, hx + 8 + d * 0.7, hy - 8 + d * 0.7, 1.3, 0.6, metal, z=1.4)
    elif kind in ('staff', 'wand'):
        L = 0.85 if kind == 'staff' else 0.6
        s.capsule(*P(0.0), *P(L), 1.8 if kind == 'staff' else 1.3, 1.5, grip, z=0.8)
        tx, ty = P(L)
        s.ellipse(tx, ty, 5 if kind == 'staff' else 3.5, 5 if kind == 'staff' else 3.5, gem, z=1.8)
        s.glow_ellipse(tx, ty, 2.4, 2.4, g)
    elif kind == 'bow':
        for t in range(13):
            a = -1.1 + t * 0.18
            s.ellipse(30 + 20 * math.cos(a + 0.8) - 10, 30 + 20 * math.sin(a + 0.8) - 10, 2, 2, grip, z=1.0)
        s.capsule(12, 50, 50, 12, 0.5, 0.5, s.material(mat('white')), z=0.4)
    else:  # crossbow
        s.capsule(14, 50, 44, 20, 3, 3, grip, z=0.9)
        s.capsule(20, 18, 48, 46, 1.8, 1.8, metal, z=1.3)
    s.texture(grip, 'stripes', 0.3)
    return s.render()


ARMOR_KINDS = ['chest', 'helm', 'boots', 'gloves', 'shield', 'cloak', 'pants', 'pauldron']


def icon_armor(i, rng):
    s = Sprite(rng)
    kind = ARMOR_KINDS[i % len(ARMOR_KINDS)]
    heavy = rng.random() < 0.5
    main = s.material(mat(pick(rng, ['steel', 'iron', 'gold', 'bronze', 'silver'])), 'metal') if heavy else s.material(any_ramp(rng))
    trim = s.material(mat(pick(rng, ['gold', 'bronze', 'leather'])), 'metal')
    if kind == 'chest':
        s.poly([(18, 12), (26, 8), (38, 8), (46, 12), (54, 24), (46, 30), (44, 26), (44, 54), (20, 54), (20, 26), (18, 30), (10, 24)], main, z=0.8, bevel=4)
        s.capsule(26, 10, 32, 20, 1.6, 1.6, trim, z=1.6); s.capsule(38, 10, 32, 20, 1.6, 1.6, trim, z=1.6)
        s.rect(20, 40, 44, 44, trim, z=1.5)
    elif kind == 'helm':
        s.ellipse(32, 30, 18, 18, main, z=1.0)
        s.rect(18, 30, 46, 48, main, z=0.9, bevel=3)
        s.rect(22, 30, 42, 34, s.material(mat('black')), z=1.8, bevel=1, over=True)
        s.capsule(32, 12, 32, 30, 2, 2, trim, z=1.8)
        if rng.random() < 0.5:
            s.capsule(32, 12, 44, 4, 2.5, 1, s.material(any_ramp(rng)), z=1.5)
    elif kind == 'boots':
        for x in (22, 40):
            s.capsule(x, 12, x, 44, 6, 6, main, z=0.8)
            s.ellipse(x + 4, 50, 10, 6, main, z=1.0)
            s.rect(x - 7, 14, x + 7, 18, trim, z=1.4)
    elif kind == 'gloves':
        for x, sg in ((22, -1), (42, 1)):
            s.ellipse(x, 36, 9, 11, main, z=0.9)
            for f in range(4):
                s.capsule(x - 6 + f * 4, 28, x - 6 + f * 4, 16, 2, 2, main, z=1.2)
            s.rect(x - 9, 44, x + 9, 52, trim, z=1.2)
    elif kind == 'shield':
        s.poly([(14, 10), (50, 10), (50, 30), (32, 56), (14, 30)], main, z=0.9, bevel=4)
        s.poly([(20, 16), (44, 16), (44, 30), (32, 48), (20, 30)], s.material(any_ramp(rng)), z=1.4, bevel=2)
        s.ellipse(32, 28, 4, 4, trim, z=2.0)
    elif kind == 'cloak':
        s.poly([(22, 8), (42, 8), (54, 56), (10, 56)], s.material(any_ramp(rng)), z=0.7, bevel=4)
        s.ellipse(32, 10, 6, 3, trim, z=1.6)
    elif kind == 'pants':
        s.poly([(18, 10), (46, 10), (48, 56), (36, 56), (32, 26), (28, 56), (16, 56)], main, z=0.8, bevel=3)
        s.rect(18, 10, 46, 15, trim, z=1.3)
    else:
        s.ellipse(32, 30, 22, 14, main, z=1.0)
        s.ellipse(32, 34, 16, 9, main, z=1.6)
        for x in (18, 32, 46):
            s.ellipse(x, 24, 2, 2, trim, z=2.4)
    if not heavy:
        s.texture(main, 'stripes', 0.3)
    if rng.random() < 0.3:
        s.glow_ellipse(32, 30, 2, 2, pick(rng, GLOWS))
    return s.render()


def icon_jewel(i, rng):
    s = Sprite(rng)
    kind = i % 6
    gold = s.material(mat(pick(rng, ['gold', 'silver', 'bronze'])), 'metal')
    gem = s.material(any_ramp(rng, sat=(0.7, 1), val=(0.85, 1)), 'shiny')
    g = pick(rng, GLOWS)
    if kind == 0:   # ring
        for t in range(24):
            a = t / 24 * 6.28
            s.ellipse(32 + 14 * math.cos(a), 38 + 10 * math.sin(a), 3, 3, gold, z=0.8)
        s.ellipse(32, 24, 7, 6, gem, z=2.0)
    elif kind == 1:   # amulet
        for t in range(16):
            a = 3.14 + t / 15 * 3.14
            s.ellipse(32 + 18 * math.cos(a), 26 + 18 * math.sin(a), 1.4, 1.4, gold, z=0.6)
        s.ellipse(32, 42, 9, 11, gold, z=1.2)
        s.ellipse(32, 42, 5.5, 7, gem, z=2.0)
    elif kind == 2:   # crown
        s.poly([(12, 50), (12, 22), (22, 34), (32, 14), (42, 34), (52, 22), (52, 50)], gold, z=1.0, bevel=3)
        for x in (20, 32, 44):
            s.ellipse(x, 42, 3, 3, gem, z=2.0)
    elif kind == 3:   # earring
        s.ellipse(32, 14, 4, 4, gold, z=1.0)
        s.capsule(32, 16, 32, 32, 1.2, 1.2, gold, z=0.8)
        s.poly([(32, 30), (40, 42), (32, 56), (24, 42)], gem, z=1.6, bevel=3)
    elif kind == 4:   # bracelet
        for t in range(26):
            a = t / 26 * 6.28
            s.ellipse(32 + 18 * math.cos(a), 32 + 12 * math.sin(a), 3.4, 3.4, gold, z=0.8 + 0.5 * math.sin(a))
        for t in range(0, 26, 6):
            a = t / 26 * 6.28
            s.ellipse(32 + 18 * math.cos(a), 32 + 12 * math.sin(a), 2, 2, gem, z=2.0)
    else:   # loose gem
        n = int(rng.integers(5, 9))
        pts = [(32 + 20 * math.cos(t / n * 6.28), 32 + 18 * math.sin(t / n * 6.28)) for t in range(n)]
        s.poly(pts, gem, z=1.0, bevel=6)
    s.glow_ellipse(30, 30, 1, 1, 'holy') if rng.random() < 0.3 else None
    return s.render()


def icon_item(i, rng):
    s = Sprite(rng)
    kind = i % 10
    g = pick(rng, GLOWS)
    if kind == 0:   # potion
        glass = s.material(mat('glass'), 'shiny', alpha=230)
        liquid = s.material(any_ramp(rng, sat=(0.7, 1), val=(0.8, 1)), 'shiny')
        shape = int(rng.integers(3))
        if shape == 0: s.ellipse(32, 40, 14, 14, glass, z=0.8)
        elif shape == 1: s.poly([(20, 56), (44, 56), (38, 30), (26, 30)], glass, z=0.8, bevel=3)
        else: s.rect(20, 28, 44, 56, glass, z=0.8, bevel=4)
        s.ellipse(32, 46, 11, 8, liquid, z=1.4)
        s.rect(27, 14, 37, 28, glass, z=1.0, bevel=2)
        s.rect(26, 9, 38, 15, s.material(mat('wood')), z=1.5, bevel=2)
        s.px(26, 36, (255, 255, 255)); s.px(25, 37, (255, 255, 255))
    elif kind == 1:   # scroll
        p = s.material(mat('paper'))
        s.rect(14, 18, 50, 46, p, z=0.6, bevel=2)
        s.capsule(12, 16, 52, 16, 4, 4, p, z=1.2); s.capsule(12, 48, 52, 48, 4, 4, p, z=1.2)
        for y in (24, 30, 36):
            s.capsule(18, y, 46, y, 0.6, 0.6, s.material(mat('black')), z=1.0)
        s.ellipse(40, 42, 4, 4, s.material(mat('red')), z=1.6)
    elif kind == 2:   # food
        if rng.random() < 0.5:
            s.ellipse(32, 36, 18, 12, s.material(mat('wood', val=0.8)), z=0.8); s.ellipse(32, 30, 12, 8, s.material(any_ramp(rng)), z=1.4)
        else:
            s.ellipse(30, 36, 16, 14, s.material(any_ramp(rng, sat=(0.6, 0.9))), z=1.0); s.capsule(30, 22, 34, 14, 1.4, 1.4, s.material(mat('wood')), z=1.4)
            s.ellipse(38, 18, 5, 2.5, s.material(mat('leaf')), z=1.6, rot=0.4)
    elif kind == 3:   # herb
        lm = s.material(rhue(rng, 'leaf', 0.1))
        s.capsule(32, 58, 32, 26, 1.4, 1.2, lm, z=0.6)
        for j in range(6):
            a = -2.6 + j * 0.45
            s.ellipse(32 + 12 * math.cos(a), 34 + 12 * math.sin(a), 7, 3, lm, z=1.0, rot=a)
        s.ellipse(32, 20, 5, 5, s.material(any_ramp(rng, val=(0.85, 1))), z=1.6)
    elif kind == 4:   # ore
        ore = s.material(mat(pick(rng, ['stone', 'darkstone', 'sandstone'])))
        s.ellipse(32, 38, 20, 14, ore, z=1.0)
        s.rockify(ore, cells=8)
        for _ in range(4):
            s.ellipse(rng.uniform(20, 44), rng.uniform(30, 46), 2.4, 2.4, s.material(any_ramp(rng, sat=(0.6, 1), val=(0.85, 1)), 'shiny'), z=2.4)
    elif kind == 5:   # key
        k = s.material(mat(pick(rng, ['gold', 'iron', 'silver'])), 'metal')
        br = rng.uniform(6, 10)
        for t in range(18):
            a = t / 18 * 6.28
            s.ellipse(20 + br * math.cos(a), 22 + br * math.sin(a), 2.4, 2.4, k, z=0.8)
        s.capsule(26, 28, 48, 50, 2.6, 2.6, k, z=1.0)
        for j in range(int(rng.integers(1, 4))):
            tx = 46 - j * 5
            s.rect(tx - 3, tx + 2, tx + 3, tx + 2 + rng.uniform(4, 8), k, z=1.2)
        if rng.random() < 0.5: s.ellipse(20, 22, 2.5, 2.5, s.material(any_ramp(rng, sat=(0.7, 1), val=(0.85, 1)), 'shiny'), z=1.4)
    elif kind == 6:   # book
        cover = s.material(any_ramp(rng, val=(0.4, 0.75)))
        s.rect(14, 12, 48, 54, cover, z=0.8, bevel=3)
        s.rect(46, 14, 52, 52, s.material(mat('paper')), z=0.6)
        s.rect(20, 22, 42, 30, s.material(mat('gold'), 'metal'), z=1.4, bevel=1)
        if rng.random() < 0.5: s.glow_ellipse(31, 40, 3, 3, g)
    elif kind == 7:   # bag
        bagm = s.material(mat('leather'))
        s.ellipse(32, 40, 18, 16, bagm, z=1.0)
        s.capsule(24, 22, 40, 22, 4, 4, bagm, z=1.4)
        s.rect(26, 34, 38, 40, s.material(mat('gold'), 'metal'), z=1.8)
    elif kind == 8:   # coins
        c = s.material(mat('gold'), 'metal')
        for j in range(int(rng.integers(4, 9))):
            s.ellipse(rng.uniform(18, 46), rng.uniform(26, 50), 8, 5, c, z=0.5 + j * 0.3)
    else:   # egg / orb / bomb
        if rng.random() < 0.5:
            s.ellipse(32, 36, 14, 18, s.material(any_ramp(rng, sat=(0.2, 0.6), val=(0.8, 1))), z=1.0)
            s.texture(s.mat[32, 32] if s.mat[32, 32] >= 0 else 0, 'noise', 0.5)
        else:
            s.ellipse(32, 38, 16, 16, s.material(mat('black')), z=1.0)
            s.capsule(38, 24, 44, 14, 1.6, 1.2, s.material(mat('wood')), z=1.2)
            s.glow_ellipse(45, 12, 2, 2, 'lava')
    return s.render()


# ================================================================== environment tiles (opaque and tileable)
TILE_KINDS = ['grass', 'dirt', 'sand', 'snow', 'stonefloor', 'cobble', 'bricks', 'planks', 'water', 'lava', 'ice', 'marsh', 'crystalfloor', 'rooftiles']


def tile(i, rng):
    kind = TILE_KINDS[i % len(TILE_KINDS)]
    s = Sprite(rng)
    base = {'grass': ramp(0.28, 0.6, 0.72), 'dirt': ramp(0.07, 0.5, 0.6), 'sand': ramp(0.11, 0.4, 0.92), 'snow': ramp(0.58, 0.08, 1.0), 'stonefloor': ramp(0.62, 0.08, 0.72),
            'cobble': ramp(0.08, 0.12, 0.7), 'bricks': ramp(0.03, 0.5, 0.68), 'planks': ramp(0.07, 0.55, 0.66), 'water': ramp(0.56, 0.65, 0.88), 'lava': ramp(0.03, 0.9, 0.8),
            'ice': ramp(0.53, 0.3, 0.98), 'marsh': ramp(0.22, 0.45, 0.5), 'crystalfloor': ramp(0.75, 0.4, 0.85), 'rooftiles': ramp(0.01, 0.6, 0.6)}[kind]
    hue_jit = rng.uniform(-0.03, 0.03)
    base = [tuple(int(max(0, min(255, c * (1 + hue_jit)))) for c in col) for col in base]
    m = s.material(base)
    s.mat[:] = m
    s.part[:] = 0
    n = fbm(rng)
    if kind in ('cobble', 'stonefloor', 'crystalfloor'):
        s.h[:] = n * 2
        s.rockify(m, cells=int(rng.integers(8, 18)) if kind != 'stonefloor' else 6, jitter=0.6)
    elif kind == 'bricks':
        s.h[:] = n; s.texture(m, 'bricks', 2.5)
    elif kind in ('planks', 'rooftiles'):
        s.h[:] = n; s.texture(m, 'planks', 2.5)
        if kind == 'rooftiles': s.h += np.sin(XX * 0.75) * 0.8
    elif kind in ('water', 'lava'):
        s.h[:] = np.sin(XX * 0.35 + n * 6) * 0.8 + np.sin(YY * 0.5 + n * 4) * 0.6
        if kind == 'lava':
            s.glow(n > 0.6, 'lava')
        else:
            s.glow((np.sin(XX * 0.35 + n * 6 + YY * 0.2) > 0.93), [(150, 210, 255), (200, 235, 255), (245, 252, 255)])
    else:
        s.h[:] = n * 3 + (value_noise(rng, 32) - 0.5) * 1.2
        if kind == 'grass':
            blades = value_noise(rng, 32) > 0.72
            s.h[blades] += 1.2
            if rng.random() < 0.5:
                fl = (value_noise(rng, 32) > 0.86)
                s.glow(fl & (value_noise(rng, 16) > 0.6), [(240, 220, 90), (250, 240, 150), (255, 255, 220)])
        if kind == 'marsh':
            s.glow((n > 0.68) & (value_noise(rng, 16) > 0.5), [(70, 110, 90), (90, 140, 110), (130, 170, 140)])
    s.bg = np.zeros((64, 64, 3))
    s.mat_force = True
    img = s.render(outline=None, halo=False)
    return img


def building(i, rng):
    s = Sprite(rng)
    kind = i % 6
    wall = s.material(pick(rng, [mat('stone'), mat('sandstone'), mat('wood'), mat('marble'), mat('darkstone')]))
    roof = s.material(any_ramp(rng, val=(0.45, 0.75)))
    trim = s.material(mat('darkwood'))
    door = s.material(mat('wood'))
    win = (rng.random() < 0.5)
    if kind in (0, 1):   # house
        w = 36 if kind == 0 else 44
        s.rect(32 - w / 2, 28, 32 + w / 2, 58, wall, z=0.6)
        s.poly([(32 - w / 2 - 4, 30), (32, 6), (32 + w / 2 + 4, 30)], roof, z=1.2, bevel=4)
        s.texture(roof, 'planks', 1.2)
        s.rect(27, 42, 37, 58, door, z=1.0)
        for x in (32 - w / 2 + 4, 32 + w / 2 - 12):
            s.rect(x, 34, x + 8, 41, trim, z=1.0, bevel=1)
            if win: s.glow(((XX > x + 1) & (XX < x + 7) & (YY > 35) & (YY < 40)), [(240, 170, 60), (255, 210, 110), (255, 240, 190)])
        if wall in (0,): s.texture(wall, 'bricks', 0.8)
    elif kind == 2:   # tower
        s.rect(20, 18, 44, 58, wall, z=0.8, bevel=4)
        s.poly([(16, 20), (32, 0), (48, 20)], roof, z=1.4, bevel=3)
        s.rect(28, 30, 36, 40, trim, z=1.2, bevel=1)
        s.glow(((XX > 29) & (XX < 35) & (YY > 31) & (YY < 39)), 'arcane' if win else 'holy')
        s.rect(27, 48, 37, 58, door, z=1.2)
        s.texture(wall, 'bricks', 0.8)
    elif kind == 3:   # temple
        s.rect(8, 50, 56, 58, wall, z=0.8)
        for x in (14, 26, 38, 50):
            s.capsule(x, 50, x, 24, 3.2, 3.2, wall, z=1.0)
        s.poly([(6, 24), (32, 6), (58, 24)], wall, z=1.2, bevel=3)
        s.glow_ellipse(32, 16, 3, 3, 'holy')
    elif kind == 4:   # tent / market stall
        s.poly([(8, 56), (32, 10), (56, 56)], roof, z=0.9, bevel=4)
        s.texture(roof, 'stripes', 1.0)
        s.poly([(26, 56), (32, 36), (38, 56)], s.material(mat('black')), z=1.4, bevel=1)
    else:   # wall and gate
        s.rect(4, 22, 60, 58, wall, z=0.7, bevel=3)
        for x in range(4, 60, 10):
            s.rect(x, 14, x + 6, 22, wall, z=0.8, bevel=2)
        s.poly([(22, 58), (22, 36), (32, 28), (42, 36), (42, 58)], s.material(mat('black')), z=1.2, bevel=1)
        s.texture(wall, 'bricks', 0.9)
    return s.render()


def world_map(i, rng):
    s = Sprite(rng)
    land = fbm(rng, (3, 6, 12), (0.6, 0.3, 0.1))
    falloff = 1 - np.hypot(XX - 32, YY - 32) / 46
    h = land * 0.7 + falloff * 0.5
    sea = h < 0.55
    parchment = rng.random() < 0.3
    img = np.zeros((64, 64, 3))
    if parchment:
        img[:] = (214, 190, 140); img[sea] = (190, 165, 120)
        img[(h > 0.53) & (h < 0.56)] = (110, 80, 50)
    else:
        img[:] = (40, 90, 160)
        img[(h > 0.5) & sea] = (60, 120, 190)
        biome = value_noise(rng, 4)
        land_m = ~sea
        img[land_m & (biome < 0.35)] = (210, 196, 140)
        img[land_m & (biome >= 0.35)] = (86, 150, 70)
        img[land_m & (biome > 0.7)] = (52, 110, 60)
        img[land_m & (h > 0.75)] = (140, 130, 120)
        img[land_m & (h > 0.85)] = (240, 240, 245)
        coast = land_m & ~dilate(~land_m, 1)
        img[land_m & ~coast & (h < 0.57)] = (226, 210, 160)
    # pins: towns and a path
    for _ in range(int(rng.integers(2, 5))):
        ys, xs = np.nonzero(~sea)
        if len(xs):
            j = int(rng.integers(len(xs)))
            x, y = xs[j], ys[j]
            img[max(0, y - 1):y + 2, max(0, x - 1):x + 2] = (200, 40, 40)
    img += (DITHER_IMG(rng) * 10)[..., None]
    s.bg = img.clip(0, 255)
    return s.render(outline=None)


def DITHER_IMG(rng):
    from hd64_engine import DITHER
    return DITHER


def dungeon_prop(i, rng):
    s = Sprite(rng)
    kind = i % 10
    stone = s.material(mat(pick(rng, ['darkstone', 'stone', 'marble'])))
    wood = s.material(mat('darkwood'))
    metal = s.material(mat('iron'), 'metal')
    gold = s.material(mat('gold'), 'metal')
    g = pick(rng, GLOWS)
    if kind == 0:   # door
        s.poly([(14, 58), (14, 22), (32, 8), (50, 22), (50, 58)], stone, z=0.6, bevel=3)
        s.poly([(19, 58), (19, 24), (32, 14), (45, 24), (45, 58)], wood, z=1.0, bevel=2)
        s.texture(wood, 'stripes', 0.8)
        s.rect(19, 30, 45, 33, metal, z=1.4); s.rect(19, 46, 45, 49, metal, z=1.4)
        s.ellipse(40, 40, 2, 2, gold, z=1.8)
    elif kind == 1:   # stairs
        for j in range(6):
            s.rect(10 + j * 3, 52 - j * 8, 54 - j * 3, 58 - j * 8, stone, z=0.3 + j * 0.4, bevel=2)
    elif kind == 2:   # pillar
        s.rect(20, 52, 44, 60, stone, z=0.8); s.rect(20, 4, 44, 12, stone, z=0.8)
        s.capsule(32, 12, 32, 52, 8, 8, stone, z=1.0)
        s.texture(stone, 'stripes', 0.6)
        if rng.random() < 0.5: s.glow_line([(32, 18), (32, 46)], g)
    elif kind == 3:   # altar
        s.rect(10, 34, 54, 58, stone, z=0.8, bevel=3)
        s.rect(6, 28, 58, 36, stone, z=1.0, bevel=2)
        s.glow_line([(16, 46), (24, 42), (32, 48), (40, 42), (48, 46)], g)
        s.ellipse(32, 22, 6, 6, s.material(mat('crystal'), 'shiny'), z=1.6)
        s.glow_ellipse(32, 22, 3, 3, g)
    elif kind == 4:   # chest
        s.rect(10, 28, 54, 56, wood, z=0.8, bevel=3)
        s.ellipse(32, 28, 22, 10, wood, z=1.0)
        s.texture(wood, 'planks', 0.8)
        s.rect(10, 34, 54, 38, gold, z=1.4); s.rect(28, 32, 36, 44, gold, z=1.6)
        if rng.random() < 0.4: s.glow_ellipse(32, 26, 10, 3, 'holy')
    elif kind == 5:   # sarcophagus
        s.poly([(20, 6), (44, 6), (50, 30), (42, 58), (22, 58), (14, 30)], stone, z=0.8, bevel=4)
        s.ellipse(32, 18, 7, 7, stone, z=1.4)
        s.capsule(24, 34, 40, 34, 3, 3, stone, z=1.4)
        s.glow_ellipse(29, 18, 1, 1, g); s.glow_ellipse(35, 18, 1, 1, g)
    elif kind == 6:   # brazier
        s.capsule(32, 58, 32, 34, 3, 3, metal, z=0.8)
        s.ellipse(32, 30, 14, 6, metal, z=1.2)
        fire = s.material(ramp(0.07, 0.9, 1.0))
        for _ in range(5):
            x = rng.uniform(22, 42)
            s.poly([(x - 5, 28), (x + rng.uniform(-2, 2), rng.uniform(6, 16)), (x + 5, 28)], fire, z=1.8, bevel=2)
        s.glow_ellipse(32, 22, 6, 6, 'lava')
    elif kind == 7:   # portcullis
        s.rect(6, 6, 58, 58, stone, z=0.6, bevel=3)
        s.rect(12, 12, 52, 58, s.material(mat('black')), z=0.8, bevel=1)
        for x in range(14, 52, 7):
            s.capsule(x, 12, x, 58, 1.6, 1.6, metal, z=1.4)
        for y in (24, 40):
            s.capsule(12, y, 52, y, 1.4, 1.4, metal, z=1.6)
    elif kind == 8:   # statue
        st = humanoid(rng, outfit=pick(rng, ['robe', 'plate']), weapon=pick(rng, ['sword', 'staff', 'spear']))
        stone_r = mat('marble')
        for mm in st.mats: mm['ramp'] = stone_r; mm['kind'] = 'plain'
        st.emask[:] = False
        st.rect(16, 56, 48, 63, st.material(mat('stone')), z=0.6)
        return st.render()
    else:   # spike trap
        s.rect(6, 40, 58, 58, stone, z=0.4, bevel=2)
        for x in range(10, 56, 8):
            s.poly([(x - 3, 44), (x, 26 + rng.uniform(-4, 4)), (x + 3, 44)], metal, z=1.2, bevel=1)
    s.texture(stone, 'noise', 0.6)
    return s.render()


def vfx(i, rng):
    s = Sprite(rng)
    kind = i % 8
    g = pick(rng, GLOWS)
    cols = GLOW[g]
    a = np.zeros((64, 64, 4))
    sc = rng.uniform(0.82, 1.12)
    ox, oy = rng.uniform(-2, 2), rng.uniform(-2, 2)
    r = np.hypot(XX - 32 - ox, YY - 32 - oy) / sc
    ang = np.arctan2(YY - 32 - oy, XX - 32 - ox) + rng.uniform(-0.6, 0.6)
    tint = rng.uniform(0.85, 1.1)
    cols = [tuple(min(255, int(c * tint)) for c in col) for col in cols]
    def put(mask, col, alpha):
        a[mask, :3] = col
        a[mask, 3] = np.maximum(a[mask, 3], alpha)
    if kind == 0:   # orb
        for rr, ci, al in ((22, 0, 90), (16, 0, 170), (11, 1, 230), (6, 2, 255)):
            put(r < rr + DITHER_IMG(rng) * 3, cols[ci], al)
    elif kind == 1:   # burst
        rays = np.cos(ang * rng.integers(5, 10)) > 0.6
        put((r < 28) & rays & (r > 6), cols[0], 200); put(r < 10, cols[1], 255); put(r < 5, cols[2], 255)
    elif kind == 2:   # rune circle
        ring = (np.abs(r - 24) < 1.5) | (np.abs(r - 18) < 1)
        put(ring, cols[1], 255)
        n = int(rng.integers(5, 9))
        for t in range(n):
            th = t / n * 6.28
            x, y = 32 + 21 * math.cos(th), 32 + 21 * math.sin(th)
            put(np.hypot(XX - x, YY - y) < 2.2, cols[2], 255)
        star = np.abs(np.cos(ang * n / 2)) * 18 > r - 2
        put(star & (r < 17) & (np.abs(r - np.abs(np.cos(ang * n / 2)) * 17) < 1.2), cols[0], 230)
    elif kind == 3:   # slash
        arc = (np.abs(r - 22) < 4 - np.abs(ang) * 1.2) & (ang > -1.6) & (ang < 1.6)
        put(arc, cols[1], 240); put(arc & (np.abs(r - 22) < 1.2), cols[2], 255)
    elif kind == 4:   # beam
        put(np.abs(XX - 32 - (YY - 32) * 0.2) < 7, cols[0], 140)
        put(np.abs(XX - 32 - (YY - 32) * 0.2) < 4, cols[1], 230)
        put(np.abs(XX - 32 - (YY - 32) * 0.2) < 1.5, cols[2], 255)
    elif kind == 5:   # sparkles
        for _ in range(int(rng.integers(8, 16))):
            x, y, sz = rng.uniform(6, 58), rng.uniform(6, 58), rng.uniform(1, 3.5)
            put((np.abs(XX - x) < 0.6) & (np.abs(YY - y) < sz * 2) | (np.abs(YY - y) < 0.6) & (np.abs(XX - x) < sz * 2), cols[2], 255)
            put(np.hypot(XX - x, YY - y) < sz, cols[1], 200)
    elif kind == 6:   # swirl
        spiral = np.abs(((ang + r * 0.25) % (math.pi / 1.5)) - 0.5) < 0.35
        put(spiral & (r < 28) & (r > 3), cols[0], 210); put(spiral & (r < 18), cols[1], 240); put(r < 4, cols[2], 255)
    else:   # shield bubble
        put((r < 26) & (r > 23), cols[1], 220); put(r < 23, cols[0], 70)
        put((np.hypot(XX - 24, YY - 22) < 4), cols[2], 200)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def ui_icon(i, rng):
    s = Sprite(rng)
    kind = i % 10
    frame = s.material(mat(pick(rng, ['gold', 'silver', 'bronze', 'iron'])), 'metal')
    fill = s.material(any_ramp(rng, val=(0.3, 0.55)))
    if kind == 0:   # slot frame
        s.rect(4, 4, 60, 60, frame, z=0.6, bevel=4); s.rect(10, 10, 54, 54, fill, z=0.2, bevel=2, over=True)
    elif kind == 1:   # button
        s.rect(4, 18, 60, 46, frame, z=0.6, bevel=3); s.rect(8, 22, 56, 42, fill, z=1.0, bevel=3)
    elif kind == 2:   # heart
        s.ellipse(24, 26, 12, 12, s.material(mat('red'), 'shiny'), z=1.0); s.ellipse(40, 26, 12, 12, s.material(mat('red'), 'shiny'), z=1.0)
        s.poly([(13, 30), (51, 30), (32, 54)], s.material(mat('red'), 'shiny'), z=1.0, bevel=4)
    elif kind == 3:   # star
        pts = [(32 + (24 if t % 2 == 0 else 10) * math.cos(t * math.pi / 5 - math.pi / 2), 34 + (24 if t % 2 == 0 else 10) * math.sin(t * math.pi / 5 - math.pi / 2)) for t in range(10)]
        s.poly(pts, s.material(mat('gold'), 'metal'), z=1.0, bevel=5)
    elif kind == 4:   # gear
        gm = s.material(mat('steel'), 'metal')
        s.ellipse(32, 32, 18, 18, gm, z=1.0)
        for t in range(8):
            th = t / 8 * 6.28
            s.rect(32 + 20 * math.cos(th) - 3, 32 + 20 * math.sin(th) - 3, 32 + 20 * math.cos(th) + 3, 32 + 20 * math.sin(th) + 3, gm, z=1.0, bevel=1)
        s.ellipse(32, 32, 6, 6, s.material(mat('black')), z=1.6, over=True)
    elif kind == 5:   # skull
        b = s.material(mat('bone'))
        s.ellipse(32, 28, 18, 17, b, z=1.0); s.rect(22, 38, 42, 50, b, z=0.9, bevel=3)
        eyes = s.material(mat('black'))
        s.ellipse(25, 29, 4.5, 5, eyes, z=1.6, over=True); s.ellipse(39, 29, 4.5, 5, eyes, z=1.6, over=True)
        s.poly([(32, 34), (35, 40), (29, 40)], eyes, z=1.6, over=True)
    elif kind == 6:   # bar
        s.rect(2, 24, 62, 40, frame, z=0.6, bevel=2)
        s.rect(6, 28, 6 + rng.uniform(20, 54), 36, s.material(any_ramp(rng, sat=(0.7, 1), val=(0.8, 1)), 'shiny'), z=1.0, bevel=2)
    elif kind == 7:   # cursor
        s.poly([(14, 8), (48, 34), (34, 36), (42, 54), (36, 56), (28, 40), (16, 48)], s.material(mat('white')), z=1.0, bevel=2)
    elif kind == 8:   # badge / rank chevrons
        s.poly([(10, 10), (54, 10), (54, 40), (32, 58), (10, 40)], frame, z=0.8, bevel=3)
        for y in (20, 30):
            s.poly([(18, y), (32, y + 8), (46, y), (46, y + 5), (32, y + 13), (18, y + 5)], s.material(any_ramp(rng)), z=1.4, bevel=1)
    else:   # sword-and-shield crest
        s.ellipse(32, 32, 20, 20, frame, z=0.8)
        s.capsule(16, 48, 48, 16, 2.5, 1, s.material(mat('steel'), 'metal'), z=1.6)
        s.ellipse(32, 32, 10, 12, fill, z=1.8)
    return s.render()


def emblem(i, rng):
    s = Sprite(rng)
    kind = i % 5
    cloth = s.material(any_ramp(rng))
    gold = s.material(mat('gold'), 'metal')
    if kind == 0:   # banner
        s.capsule(10, 6, 54, 6, 2, 2, s.material(mat('wood')), z=1.4)
        s.poly([(14, 8), (50, 8), (50, 56), (32, 46), (14, 56)], cloth, z=0.8, bevel=3)
        s.texture(cloth, 'stripes', 0.4)
        s.ellipse(32, 26, 8, 8, gold, z=1.6)
    elif kind == 1:   # heraldic shield
        s.poly([(12, 8), (52, 8), (52, 32), (32, 58), (12, 32)], gold, z=0.8, bevel=3)
        s.poly([(16, 12), (48, 12), (48, 32), (32, 52), (16, 32)], cloth, z=1.2, bevel=2)
        s.poly([(32, 16), (40, 30), (32, 44), (24, 30)], gold, z=1.8, bevel=2)
    elif kind == 2:   # medal
        s.poly([(20, 4), (30, 4), (34, 30), (24, 30)], cloth, z=0.6, bevel=1)
        s.poly([(34, 4), (44, 4), (40, 30), (30, 30)], s.material(any_ramp(rng)), z=0.6, bevel=1)
        s.ellipse(32, 42, 14, 14, gold, z=1.2); s.ellipse(32, 42, 8, 8, cloth, z=1.8)
    elif kind == 3:   # trophy
        s.ellipse(32, 20, 16, 12, gold, z=1.0)
        s.capsule(32, 30, 32, 46, 3, 3, gold, z=1.0)
        s.rect(20, 46, 44, 56, s.material(mat('darkwood')), z=1.0, bevel=2)
        for sg in (-1, 1):
            s.capsule(32 + sg * 16, 16, 32 + sg * 20, 26, 2, 2, gold, z=0.8)
    else:   # quest scroll with seal
        p = s.material(mat('paper'))
        s.rect(12, 10, 52, 54, p, z=0.6, bevel=2)
        for y in (18, 24, 30, 36):
            s.capsule(18, y, 46, y, 0.6, 0.6, s.material(mat('black')), z=0.9)
        s.ellipse(42, 46, 7, 7, s.material(mat('red')), z=1.6)
    if rng.random() < 0.3:
        s.glow_ellipse(32, 30, 2, 2, 'holy')
    return s.render()


def promo_scene(i, rng):
    s = Sprite(rng)
    sky_top = np.array(ramp(rng.random(), rng.uniform(0.4, 0.8), rng.uniform(0.25, 0.6))[1], np.float64)
    sky_bot = np.array(ramp(rng.random(), rng.uniform(0.3, 0.7), rng.uniform(0.7, 1.0))[4], np.float64)
    t = (YY / 64)[..., None]
    img = sky_top * (1 - t) + sky_bot * t
    from hd64_engine import DITHER
    img += DITHER[..., None] * 18
    # moon or sun
    mx, my, mr = rng.uniform(10, 54), rng.uniform(8, 22), rng.uniform(4, 8)
    img[np.hypot(XX - mx, YY - my) < mr] = (250, 240, 210)
    # mountain ranges
    hue = rng.uniform(0.55, 0.8)
    for layer, (base_y, col_v) in enumerate(((30, 0.5), (42, 0.3), (52, 0.16))):
        xs = np.arange(64)
        ridge = base_y + sum(rng.uniform(2, 7) * np.sin(xs * f + rng.uniform(0, 6.28)) for f in (0.07, 0.15, 0.33)) - layer * 2
        col = np.array(ramp(hue, 0.35, col_v)[2], np.float64)
        img[YY > ridge[None, :]] = col
    # castle or tower silhouette, and a hero on the ridge
    if rng.random() < 0.6:
        cx = rng.uniform(14, 50)
        castle = ((np.abs(XX - cx) < 9) & (YY > 30) & (YY < 46)) | ((np.abs(XX - cx) < 3) & (YY > 20) & (YY < 46))
        img[castle] = (24, 20, 32)
        img[(np.abs(XX - cx) < 1) & (YY > 34) & (YY < 37)] = (255, 210, 110)
    hx = rng.uniform(16, 48)
    hero = (np.hypot(XX - hx, YY - 50) < 2.2) | ((np.abs(XX - hx) < 2) & (YY > 51) & (YY < 58))
    img[hero] = (10, 8, 14)
    img[(np.abs(XX - (hx + 3)) < 0.6) & (YY > 44) & (YY < 54)] = (200, 210, 230)
    s.bg = img.clip(0, 255)
    return s.render(outline=None)


# ================================================================== registry and main
def make(category, idx, aid):
    seed = int(hashlib.sha256(('hd64|' + aid).encode()).hexdigest()[:12], 16)
    rng = np.random.default_rng(seed)
    CUR['rng'] = np.random.default_rng(seed ^ 0x5EED)
    fam = None
    i = idx - 1
    if category == 'player_races_characters': img = gen_character(i, rng)
    elif category == 'classes_subclasses': img = gen_class(i, rng)
    elif category == 'weapons': img = icon_weapon(i, rng)
    elif category == 'armor_clothing': img = icon_armor(i, rng)
    elif category == 'jewelry_accessories': img = icon_jewel(i, rng)
    elif category == 'monsters_creatures': img, fam = gen_monster(i, rng)
    elif category == 'bosses_raid_creatures': img, fam = gen_boss(i, rng)
    elif category == 'environments_tilesets': img = tile(i, rng)
    elif category == 'buildings_settlements': img = building(i, rng)
    elif category == 'maps_worlds': img = world_map(i, rng)
    elif category == 'dungeons_towers_raids': img = dungeon_prop(i, rng)
    elif category == 'magic_visual_effects': img = vfx(i, rng)
    elif category == 'items_consumables': img = icon_item(i, rng)
    elif category == 'mounts_pets': img = gen_mount(i, rng)
    elif category == 'npcs_civilians': img = gen_npc(i, rng)
    elif category == 'ui_interface': img = ui_icon(i, rng)
    elif category == 'factions_quests_achievements': img = emblem(i, rng)
    else: img = promo_scene(i, rng)
    return img, fam


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', default='assets_hd64/gbq_6000')
    ap.add_argument('--zip', default='')
    ap.add_argument('--only', default='')
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()
    out = Path(args.output)
    (out / 'atlases').mkdir(parents=True, exist_ok=True)
    rows, gid = [], 1
    for category, count in CATEGORIES:
        if args.only and category != args.only:
            gid += count
            continue
        folder = out / 'assets' / category
        folder.mkdir(parents=True, exist_ok=True)
        previews = []
        n = min(count, args.limit) if args.limit else count
        for i in range(1, n + 1):
            aid = f'GBQ-{gid + i - 1:04d}'
            name = f'{i:04d}_{category}.png'
            img, fam = make(category, i, aid)
            img.save(folder / name, optimize=True)
            if i <= 100:
                previews.append(img)
            row = {'asset_id': aid, 'category': category, 'category_index': i, 'filename': name, 'path': f'assets/{category}/{name}',
                   'format': 'PNG', 'width': 64, 'height': 64, 'alpha': True, 'status': 'GENERATED_PROCEDURAL_HD64'}
            if fam:
                row['family'] = fam
            rows.append(row)
        gid += count
        sheet = Image.new('RGBA', (640, 640), (18, 22, 34, 255))
        for j, im in enumerate(previews):
            sheet.alpha_composite(im, ((j % 10) * 64, (j // 10) * 64))
        sheet.save(out / 'atlases' / f'{category}_preview.png', optimize=True)
        (out / 'atlases' / f'{category}.json').write_text(json.dumps({'category': category, 'total_assets': count, 'preview_count': len(previews),
            'preview_file': f'{category}_preview.png', 'cell_size': [64, 64], 'columns': 10}, indent=2), encoding='utf-8')
        print(f'{category}: {n}', flush=True)
    meta = out / 'metadata'
    meta.mkdir(exist_ok=True)
    if not args.only and not args.limit:
        fields = ['asset_id', 'category', 'category_index', 'filename', 'path', 'format', 'width', 'height', 'alpha', 'status', 'family']
        with (meta / 'asset_manifest.csv').open('w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
        (meta / 'asset_manifest.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
        (meta / 'category_summary.json').write_text(json.dumps([{'category': c, 'count': n} for c, n in CATEGORIES], indent=2), encoding='utf-8')
        (out / 'README.md').write_text('# GB-Quest 6,000 Asset Pack (HD64)\n\n6,000 original 64x64 RGBA shaded pixel-art PNGs in 18 categories, '
            'generated by tools/gen_pack6000_hd.py on tools/hd64_engine.py. Monster and boss images are grouped by bestiary family '
            '(see metadata/asset_manifest.json `family`). Includes preview atlases and CSV/JSON manifests.\n', encoding='utf-8')
    if args.zip:
        with zipfile.ZipFile(args.zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for p in out.rglob('*'):
                if p.is_file():
                    z.write(p, p.relative_to(out.parent))
    print(f'Generated {len(rows)} HD64 PNG assets.')


if __name__ == '__main__':
    main()
