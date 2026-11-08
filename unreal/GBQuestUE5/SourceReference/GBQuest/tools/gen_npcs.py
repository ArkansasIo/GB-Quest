#!/usr/bin/env python3
"""Role-specific NPC walking sprites for the pixel field (16x16, Game Boy scale).

Every townsfolk role gets its own silhouette: outfit, headwear, facial hair and a held prop, layered on a
shared chibi body, then auto-outlined and shaded. Writes, for each role:

  gh_npc_<role>_{down,up,side}{0,1}.png   walk frames (side faces right; the game mirrors it for left)
  gh_npc_<role>_blink.png                 standing frame with closed eyes (idle animation)

  python3 tools/gen_npcs.py            # writes into assets/
  python3 tools/gen_npcs.py --sheet x  # also writes a preview contact sheet to x
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets')
OUT = (24, 20, 28, 255)
EYE = (30, 24, 34, 255)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3])


SKINS = {'fair': (250, 214, 176), 'warm': (232, 180, 136), 'tan': (196, 138, 96), 'deep': (132, 88, 60), 'ash': (190, 196, 200)}

# ---------------------------------------------------------------- roles
# outfit: tunic|robe|apron|armor|vest|dress|coat ; hat: none|hood|helm|horned|straw|top|cap|chef|wizard|bandana|circlet|flowers|bun|long|bald|goggles|mask
# face: none|beard|longbeard|mustache|monocle|glasses ; prop: see draw_prop
ROLES = {
    # city and town services
    'merchant':      dict(skin='warm', hair=(120, 70, 40), cloth=(70, 120, 70), pants=(90, 70, 50), boots=(70, 50, 36), accent=(220, 180, 70), outfit='vest', shirt=(236, 226, 196), hat='cap', hatc=(150, 60, 50), face='mustache', prop='bag', propc=(150, 100, 50)),
    'auctioneer':    dict(skin='fair', hair=(60, 40, 30), cloth=(120, 40, 50), pants=(40, 36, 50), boots=(30, 26, 30), accent=(230, 190, 80), outfit='coat', shirt=(240, 236, 220), hat='top', hatc=(40, 36, 46), face='mustache', prop='gavel', propc=(140, 90, 50)),
    'banker':        dict(skin='fair', hair=(170, 170, 176), cloth=(50, 60, 90), pants=(40, 44, 60), boots=(28, 26, 30), accent=(230, 200, 90), outfit='coat', shirt=(240, 240, 236), hat='none', face='monocle', prop='coin', propc=(240, 200, 70)),
    'innkeeper':     dict(skin='tan', hair=(170, 70, 40), cloth=(170, 110, 70), pants=(90, 60, 40), boots=(70, 46, 30), accent=(240, 236, 220), outfit='apron', apron=(236, 230, 214), hat='bun', face='none', prop='mug', propc=(200, 140, 50)),
    'guildmaster':   dict(skin='warm', hair=(90, 60, 40), cloth=(110, 40, 40), pants=(60, 40, 40), boots=(50, 36, 30), accent=(230, 190, 80), outfit='armor', metal=(176, 180, 196), tabard=(120, 40, 40), cape=(140, 40, 40), hat='none', face='beard', prop='banner', propc=(150, 40, 40)),
    'trainer':       dict(skin='tan', hair=(50, 40, 30), cloth=(90, 90, 110), pants=(60, 60, 70), boots=(50, 40, 30), accent=(200, 60, 50), outfit='armor', metal=(180, 184, 200), tabard=(70, 90, 160), hat='bandana', hatc=(190, 50, 50), face='none', prop='sword', propc=(210, 214, 226)),
    'quartermaster': dict(skin='deep', hair=(30, 26, 26), cloth=(60, 80, 60), pants=(50, 50, 40), boots=(40, 32, 26), accent=(220, 190, 80), outfit='coat', shirt=(210, 200, 170), hat='cap', hatc=(60, 80, 60), face='beard', prop='scroll', propc=(236, 220, 170)),
    'herald':        dict(skin='fair', hair=(230, 200, 110), cloth=(70, 90, 170), pants=(220, 220, 230), boots=(60, 46, 36), accent=(240, 210, 90), outfit='tunic', hat='none', face='none', prop='horn', propc=(230, 190, 90)),
    'oracle':        dict(skin='ash', hair=(220, 220, 240), cloth=(80, 60, 140), pants=(60, 40, 100), boots=(50, 30, 70), accent=(160, 220, 255), outfit='robe', hat='hood', hatc=(70, 50, 120), face='none', prop='orbstaff', propc=(140, 220, 255)),
    'spirekeeper':   dict(skin='ash', hair=(200, 200, 210), cloth=(40, 44, 70), pants=(30, 30, 50), boots=(26, 26, 36), accent=(250, 220, 120), outfit='robe', hat='hood', hatc=(36, 40, 64), face='longbeard', prop='lantern', propc=(250, 210, 90)),
    'trialsmaster':  dict(skin='tan', hair=(40, 30, 30), cloth=(130, 50, 40), pants=(60, 40, 36), boots=(40, 30, 26), accent=(230, 180, 60), outfit='armor', metal=(150, 120, 80), tabard=(130, 50, 40), hat='mask', hatc=(220, 200, 150), face='none', prop='sword', propc=(220, 220, 230)),
    'harbormaster':  dict(skin='tan', hair=(110, 110, 120), cloth=(40, 60, 110), pants=(40, 50, 80), boots=(40, 30, 26), accent=(230, 200, 90), outfit='coat', shirt=(236, 236, 236), hat='captain', hatc=(30, 40, 70), face='beard', prop='spyglass', propc=(200, 160, 70)),
    'dockhand':      dict(skin='deep', hair=(30, 24, 20), cloth=(236, 236, 236), stripe=(60, 80, 160), pants=(70, 80, 110), boots=(50, 40, 30), accent=(200, 60, 60), outfit='striped', hat='bandana', hatc=(200, 60, 60), face='none', prop='rope', propc=(200, 170, 110)),
    'stablemaster':  dict(skin='warm', hair=(110, 70, 40), cloth=(150, 100, 60), pants=(80, 70, 60), boots=(90, 60, 36), accent=(200, 160, 80), outfit='vest', shirt=(220, 200, 160), hat='straw', hatc=(150, 100, 50), face='mustache', prop='rope', propc=(210, 180, 120)),
    'arenamaster':   dict(skin='tan', hair=(60, 40, 30), cloth=(140, 60, 40), pants=(70, 50, 40), boots=(60, 40, 30), accent=(240, 200, 90), outfit='armor', metal=(170, 150, 110), tabard=(150, 60, 40), hat='horned', hatc=(170, 150, 110), face='beard', prop='axe', propc=(200, 204, 214)),
    'steward':       dict(skin='fair', hair=(100, 60, 40), cloth=(90, 60, 110), pants=(60, 50, 70), boots=(40, 32, 30), accent=(230, 200, 100), outfit='dress', apron=None, hat='long', face='none', prop='key', propc=(230, 200, 90)),
    'warden':        dict(skin='warm', hair=(90, 70, 50), cloth=(60, 90, 60), pants=(60, 60, 50), boots=(60, 44, 30), accent=(220, 200, 120), outfit='armor', metal=(150, 156, 170), tabard=(60, 100, 60), cape=(50, 80, 50), hat='helm', hatc=(150, 156, 170), plume=(60, 140, 60), face='none', prop='spear', propc=(210, 214, 226)),
    'guard':         dict(skin='tan', hair=(60, 40, 30), cloth=(90, 90, 110), pants=(70, 70, 80), boots=(50, 40, 30), accent=(200, 50, 50), outfit='armor', metal=(180, 184, 200), tabard=(170, 50, 50), hat='helm', hatc=(180, 184, 200), plume=(200, 50, 50), face='none', prop='spear', propc=(220, 224, 236)),
    'elder':         dict(skin='fair', hair=(250, 250, 250), cloth=(150, 110, 180), pants=(100, 70, 130), boots=(70, 50, 60), accent=(240, 220, 120), outfit='robe', hat='bald', face='longbeard', prop='cane', propc=(140, 100, 60)),
    'realmstone':    dict(special='stone'),
    # profession trainers
    'blacksmith':    dict(skin='tan', hair=(50, 40, 30), cloth=(170, 110, 80), pants=(70, 60, 50), boots=(50, 40, 30), accent=(110, 70, 40), outfit='apron', apron=(110, 74, 46), hat='bald', face='beard', prop='hammer', propc=(150, 156, 170)),
    'armorer':       dict(skin='warm', hair=(140, 60, 30), cloth=(150, 150, 160), pants=(70, 70, 80), boots=(50, 40, 30), accent=(110, 70, 40), outfit='apron', apron=(100, 70, 44), hat='bandana', hatc=(70, 70, 90), face='beard', prop='shieldhold', propc=(170, 176, 190)),
    'weaponsmith':   dict(skin='deep', hair=(30, 26, 26), cloth=(190, 120, 80), pants=(70, 60, 50), boots=(50, 40, 30), accent=(110, 70, 40), outfit='apron', apron=(90, 64, 40), hat='goggles', hatc=(70, 60, 50), face='none', prop='sword', propc=(210, 214, 226)),
    'herbalist':     dict(skin='fair', hair=(200, 120, 60), cloth=(110, 160, 90), pants=(90, 110, 70), boots=(80, 60, 40), accent=(240, 120, 160), outfit='dress', apron=(236, 226, 200), hat='flowers', face='none', prop='basket', propc=(180, 130, 70)),
    'miner':         dict(skin='tan', hair=(60, 40, 30), cloth=(120, 100, 80), pants=(70, 66, 60), boots=(50, 40, 30), accent=(240, 210, 80), outfit='tunic', hat='minercap', hatc=(220, 180, 60), face='beard', prop='pick', propc=(150, 156, 170)),
    'forester':      dict(skin='warm', hair=(100, 60, 30), cloth=(60, 110, 60), pants=(80, 70, 50), boots=(70, 50, 30), accent=(200, 60, 50), outfit='tunic', plaid=(180, 50, 50), hat='cap', hatc=(60, 100, 60), face='beard', prop='axe', propc=(190, 194, 204)),
    'hunter':        dict(skin='tan', hair=(70, 50, 30), cloth=(130, 100, 60), pants=(90, 70, 50), boots=(70, 50, 30), accent=(220, 210, 190), outfit='vest', shirt=(110, 90, 60), hat='hood', hatc=(150, 120, 80), face='none', prop='bow', propc=(150, 100, 50)),
    'fisher':        dict(skin='warm', hair=(140, 140, 150), cloth=(230, 200, 60), pants=(70, 80, 110), boots=(60, 50, 40), accent=(70, 110, 170), outfit='coat', shirt=(230, 230, 230), hat='straw', hatc=(220, 190, 60), face='beard', prop='rod', propc=(140, 100, 60)),
    'salvager':      dict(skin='tan', hair=(170, 80, 40), cloth=(110, 100, 90), pants=(70, 70, 70), boots=(50, 40, 30), accent=(220, 160, 50), outfit='vest', shirt=(180, 160, 130), hat='goggles', hatc=(80, 70, 60), face='none', prop='bag', propc=(110, 90, 70)),
    'curator':       dict(skin='fair', hair=(150, 150, 156), cloth=(110, 80, 60), pants=(70, 60, 50), boots=(50, 40, 30), accent=(230, 200, 100), outfit='coat', shirt=(236, 230, 214), hat='none', face='glasses', prop='book', propc=(120, 50, 50)),
    'farmer':        dict(skin='warm', hair=(200, 160, 80), cloth=(90, 120, 170), pants=(90, 120, 170), boots=(90, 60, 30), accent=(220, 200, 150), outfit='overalls', shirt=(220, 80, 70), hat='straw', hatc=(220, 190, 90), face='none', prop='pitchfork', propc=(150, 110, 60)),
    'beastmaster':   dict(skin='deep', hair=(40, 30, 26), cloth=(120, 90, 60), pants=(80, 60, 40), boots=(60, 44, 30), accent=(220, 220, 210), outfit='vest', shirt=(150, 120, 80), hat='pelt', hatc=(170, 140, 100), face='none', prop='whip', propc=(100, 70, 40)),
    'alchemist':     dict(skin='fair', hair=(120, 200, 160), cloth=(70, 120, 110), pants=(50, 70, 70), boots=(40, 40, 40), accent=(240, 120, 200), outfit='robe', hat='goggles', hatc=(90, 70, 60), face='none', prop='potion', propc=(240, 90, 180)),
    'cook':          dict(skin='warm', hair=(90, 60, 40), cloth=(240, 240, 236), pants=(90, 90, 100), boots=(50, 44, 40), accent=(200, 60, 60), outfit='apron', apron=(250, 250, 250), hat='chef', face='mustache', prop='ladle', propc=(170, 174, 186)),
    'tailor':        dict(skin='fair', hair=(60, 40, 60), cloth=(180, 90, 140), pants=(80, 60, 90), boots=(50, 40, 50), accent=(240, 210, 90), outfit='dress', apron=None, hat='bun', face='glasses', prop='needle', propc=(220, 220, 230)),
    'leatherworker': dict(skin='tan', hair=(120, 70, 40), cloth=(150, 100, 60), pants=(90, 66, 44), boots=(80, 54, 34), accent=(200, 160, 90), outfit='apron', apron=(120, 80, 46), hat='bandana', hatc=(140, 90, 50), face='mustache', prop='pelt', propc=(170, 130, 90)),
    'jeweller':      dict(skin='fair', hair=(230, 210, 140), cloth=(60, 50, 110), pants=(50, 40, 80), boots=(40, 30, 40), accent=(250, 210, 90), outfit='coat', shirt=(240, 236, 226), hat='circlet', hatc=(250, 210, 90), face='monocle', prop='gem', propc=(100, 230, 220)),
    'enchanter':     dict(skin='ash', hair=(200, 180, 250), cloth=(110, 60, 170), pants=(70, 40, 120), boots=(50, 30, 70), accent=(250, 220, 120), outfit='robe', hat='wizard', hatc=(90, 50, 150), face='none', prop='orbstaff', propc=(220, 140, 255)),
    'craftmaster':   dict(skin='deep', hair=(220, 220, 220), cloth=(160, 120, 80), pants=(70, 60, 50), boots=(50, 40, 30), accent=(220, 180, 80), outfit='apron', apron=(100, 70, 44), hat='bald', face='longbeard', prop='hammer', propc=(200, 170, 80)),
    # townsfolk for variety
    'townsman':      dict(skin='warm', hair=(90, 60, 40), cloth=(90, 110, 150), pants=(80, 70, 60), boots=(60, 44, 30), accent=(200, 180, 120), outfit='tunic', hat='none', face='none', prop='none'),
    'townswoman':    dict(skin='fair', hair=(170, 80, 50), cloth=(160, 70, 80), pants=(120, 50, 60), boots=(60, 40, 40), accent=(240, 220, 200), outfit='dress', apron=(240, 232, 214), hat='long', face='none', prop='none'),
    'noble':         dict(skin='fair', hair=(230, 200, 120), cloth=(120, 40, 120), pants=(70, 30, 80), boots=(40, 30, 40), accent=(240, 210, 90), outfit='coat', shirt=(240, 236, 226), cape=(150, 40, 60), hat='circlet', hatc=(240, 210, 90), face='none', prop='none'),
    'child':         dict(skin='tan', hair=(50, 36, 30), cloth=(220, 160, 60), pants=(80, 100, 150), boots=(70, 50, 40), accent=(240, 240, 240), outfit='tunic', hat='none', face='none', prop='none', small=True),
}


# ---------------------------------------------------------------- canvas helpers
class Sprite:
    def __init__(self):
        self.px = {}

    def put(self, x, y, c):
        if 0 <= x < 16 and 0 <= y < 16 and c is not None:
            self.px[(x, y)] = rgba(c) if len(c) == 3 else c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, c)

    def erase(self, x, y):
        self.px.pop((x, y), None)

    def get(self, x, y):
        return self.px.get((x, y))

    def image(self, outline=True):
        img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        for (x, y), c in self.px.items():
            img.putpixel((x, y), c)
        if outline:
            # 1-pixel dark outline around the silhouette (not over existing pixels)
            edge = []
            for y in range(16):
                for x in range(16):
                    if (x, y) in self.px:
                        continue
                    if any((x + dx, y + dy) in self.px for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        edge.append((x, y))
            for x, y in edge:
                img.putpixel((x, y), OUT)
        return img


# ---------------------------------------------------------------- body
def body(s, R, d, f, blink=False):
    """d: down|up|side ; f: 0 stand / 1 step"""
    skin = SKINS[R['skin']]
    cloth, pants, boots = R['cloth'], R['pants'], R['boots']
    dark = shade(cloth, 0.72)
    small = R.get('small')
    top = 3 if small else 1  # children are shorter: head starts lower
    hy = top  # head top row
    # legs and feet
    if d == 'side':
        if f == 0:
            s.rect(7, 13, 8, 14, pants); s.rect(7, 15, 9, 15, boots)
        else:
            s.rect(6, 13, 6, 14, pants); s.put(5, 15, boots); s.put(6, 15, boots)
            s.rect(9, 13, 9, 14, shade(pants, 0.8)); s.put(9, 15, boots); s.put(10, 15, boots)
    else:
        lx, rx = (5, 9)
        if f == 0:
            s.rect(lx, 13, lx + 1, 14, pants); s.rect(rx, 13, rx + 1, 14, pants)
            s.rect(lx, 15, lx + 1, 15, boots); s.rect(rx, 15, rx + 1, 15, boots)
        else:
            s.rect(lx, 13, lx + 1, 15, pants); s.rect(lx, 15, lx + 1, 15, boots)
            s.rect(rx, 13, rx + 1, 13, shade(pants, 0.8)); s.rect(rx, 14, rx + 1, 14, boots)
    # torso
    ty0 = hy + 7
    if d == 'side':
        s.rect(6, ty0, 9, 12, cloth); s.rect(6, ty0, 6, 12, dark)
        # arm swings with the step
        ax = 8 if f == 0 else 9
        s.rect(ax, ty0 + 1, ax, ty0 + 3, dark); s.put(ax, ty0 + 4 if not small else ty0 + 3, skin)
    else:
        s.rect(4, ty0, 11, 12, cloth); s.rect(11, ty0, 11, 12, dark); s.rect(4, 12, 11, 12, dark)
        # arms and hands
        for ax in (3, 12):
            s.rect(ax, ty0 + 1, ax, ty0 + 3, dark if ax == 12 else cloth)
            s.put(ax, ty0 + 4 if not small else ty0 + 3, skin)
        if f == 1 and d == 'down':
            s.put(3, ty0 + 4, None); s.put(3, ty0 + 3, skin)
    # head
    hair = R['hair']
    if d == 'side':
        s.rect(5, hy + 1, 10, hy + 6, skin)
        s.rect(5, hy, 9, hy + 2, hair); s.rect(5, hy + 3, 6, hy + 5, hair)
        s.put(10, hy, None)
        s.put(9, hy + 3, EYE if not blink else shade(skin, 0.6))
        s.put(11, hy + 4, skin)  # nose
    else:
        s.rect(4, hy + 1, 11, hy + 6, skin)
        s.rect(5, hy, 10, hy, hair); s.rect(4, hy + 1, 11, hy + 2, hair)
        s.put(4, hy + 3, hair); s.put(11, hy + 3, hair)
        if d == 'up':
            s.rect(4, hy + 1, 11, hy + 6, hair); s.rect(5, hy + 6, 10, hy + 6, shade(hair, 0.8))
        else:
            if blink:
                s.put(6, hy + 4, shade(skin, 0.6)); s.put(9, hy + 4, shade(skin, 0.6))
            else:
                s.put(6, hy + 4, EYE); s.put(9, hy + 4, EYE)
            s.put(5, hy + 5, shade(skin, 0.9)); s.put(10, hy + 5, shade(skin, 0.9))  # cheeks
        s.put(4, hy + 6, shade(skin, 0.85)); s.put(11, hy + 6, shade(skin, 0.85))
    # hair highlight
    if R['hat'] in ('none', 'bun', 'long', 'flowers', 'circlet', 'goggles') and d != 'side':
        s.put(6, hy + 1, shade(hair, 1.25))
    return hy, ty0


# ---------------------------------------------------------------- outfits
def outfit(s, R, d, hy, ty0):
    o, cloth, acc = R['outfit'], R['cloth'], R['accent']
    dark = shade(cloth, 0.72)
    x0, x1 = (6, 9) if d == 'side' else (4, 11)
    if o == 'tunic':
        s.rect(x0, 11, x1, 11, shade(acc, 0.8))  # belt
        if d == 'down': s.put(7, 11, acc); s.put(8, 11, acc)
        if R.get('plaid') and d != 'side':
            for x in range(4, 12, 2): s.rect(x, ty0, x, 12, R['plaid'])
    elif o in ('robe', 'dress'):
        s.rect(x0, ty0, x1, 14, cloth)
        if d == 'side': s.rect(6, ty0, 6, 14, dark); s.rect(5, 13, 10, 14, cloth); s.rect(5, 13, 5, 14, dark)
        else: s.rect(3, 13, 12, 14, cloth); s.rect(11, ty0, 12, 14, dark)
        if o == 'robe' and d == 'down': s.rect(7, ty0, 8, 14, acc)
        if o == 'robe' and d == 'up': s.rect(4, ty0, 11, ty0, shade(cloth, 0.85))
        if o == 'dress':
            s.rect(x0, 11, x1, 11, shade(cloth, 0.6))
            if R.get('apron') and d == 'down': s.rect(5, 11, 10, 14, R['apron']); s.rect(10, 11, 10, 14, shade(R['apron'], 0.85))
    elif o == 'apron':
        if d == 'down':
            s.rect(5, ty0 + 1, 10, 14, R['apron']); s.rect(10, ty0 + 1, 10, 14, shade(R['apron'], 0.82))
            s.put(5, ty0, shade(R['apron'], 0.7)); s.put(10, ty0, shade(R['apron'], 0.7))
        elif d == 'side':
            s.rect(9, ty0 + 1, 10, 14, R['apron'])
        else:
            s.rect(x0, ty0 + 3, x1, ty0 + 3, R['apron'])  # strap across the back
    elif o == 'armor':
        metal = R['metal']; hi = shade(metal, 1.15); lo = shade(metal, 0.7)
        s.rect(x0, ty0, x1, 12, metal); s.rect(x1, ty0, x1, 12, lo)
        if d != 'side':
            s.put(3, ty0, hi); s.put(12, ty0, lo); s.put(3, ty0 + 1, metal); s.put(12, ty0 + 1, lo)  # pauldrons
            if d == 'down': s.rect(6, ty0 + 1, 9, 13, R['tabard']); s.rect(6, ty0 + 1, 6, 13, shade(R['tabard'], 1.2)); s.put(7, ty0 + 2, acc); s.put(8, ty0 + 2, acc)
            s.put(5, ty0, hi)
        else:
            s.rect(7, ty0 + 1, 9, 13, R['tabard'])
    elif o in ('vest', 'coat'):
        shirt = R['shirt']
        if d == 'down':
            s.rect(6, ty0, 9, 12, shirt); s.rect(9, ty0, 9, 12, shade(shirt, 0.85))
            if o == 'coat': s.rect(4, 12, 5, 13, cloth); s.rect(10, 12, 11, 13, dark); s.put(7, ty0 + 2, acc); s.put(7, ty0 + 4, acc)
            else: s.rect(4, 11, 11, 11, shade(acc, 0.7))
        elif d == 'side':
            s.rect(9, ty0, 9, 12, shirt)
            if o == 'coat': s.rect(6, 12, 9, 13, cloth)
        else:
            if o == 'coat': s.rect(4, 12, 11, 13, cloth); s.rect(7, ty0, 8, 13, dark)
    elif o == 'striped':
        for y in range(ty0, 13, 2): s.rect(x0, y, x1, y, R['stripe'])
    elif o == 'overalls':
        shirt = R['shirt']
        if d != 'up': s.rect(x0, ty0, x1, ty0 + 1, shirt)
        if d == 'down':
            for ax in (3, 12): s.rect(ax, ty0 + 1, ax, ty0 + 3, shirt)
            s.put(6, ty0, cloth); s.put(9, ty0, cloth); s.put(6, ty0 + 2, R['accent']); s.put(9, ty0 + 2, R['accent'])
    # cape behind (visible from the back and the side)
    if R.get('cape'):
        cape = R['cape']
        if d == 'up': s.rect(3, ty0, 12, 14, cape); s.rect(12, ty0, 12, 14, shade(cape, 0.7)); s.rect(5, ty0, 10, ty0, shade(cape, 1.2))
        elif d == 'side': s.rect(4, ty0, 5, 14, cape)
        else: s.put(3, ty0, cape); s.put(12, ty0, shade(cape, 0.7)); s.put(3, 13, cape); s.put(12, 13, shade(cape, 0.7))


# ---------------------------------------------------------------- headwear and faces
def headwear(s, R, d, hy):
    h = R['hat']; c = R.get('hatc') or R['hair']; hair = R['hair']
    hi, lo = shade(c, 1.2), shade(c, 0.72)
    side = d == 'side'
    if h == 'hood':
        if side: s.rect(4, hy, 9, hy + 2, c); s.rect(4, hy + 3, 6, hy + 7, c); s.put(10, hy + 1, c)
        else:
            s.rect(4, hy, 11, hy + 2, c); s.rect(3, hy + 2, 3, hy + 7, c); s.rect(12, hy + 2, 12, hy + 7, lo)
            s.put(4, hy + 3, c); s.put(11, hy + 3, lo)
            if d == 'up': s.rect(4, hy, 11, hy + 7, c); s.rect(11, hy, 11, hy + 7, lo)
            else: s.rect(5, hy + 3, 10, hy + 3, shade(SKINS[R['skin']], 0.7))
        s.put(6 if not side else 5, hy, hi)
    elif h in ('helm', 'horned'):
        if side: s.rect(5, hy - 1, 10, hy + 2, c); s.rect(5, hy + 3, 6, hy + 5, c); s.put(10, hy + 2, lo)
        else:
            s.rect(4, hy - 1, 11, hy + 2, c); s.rect(4, hy + 3, 4, hy + 5, c); s.rect(11, hy + 3, 11, hy + 5, lo)
            s.rect(5, hy - 1, 6, hy - 1, hi); s.rect(4, hy + 2, 11, hy + 2, lo)
            if d == 'up': s.rect(4, hy - 1, 11, hy + 5, c); s.rect(11, hy - 1, 11, hy + 5, lo)
            else: s.rect(7, hy + 2, 8, hy + 4, lo)  # nose guard
        if h == 'helm' and R.get('plume'):
            p = R['plume']
            if side: s.rect(6, hy - 3, 8, hy - 2, p); s.put(5, hy - 2, p)
            else: s.rect(7, hy - 3, 8, hy - 2, p); s.put(9, hy - 3, shade(p, 0.7))
        if h == 'horned':
            bone = (236, 226, 200)
            if side: s.put(9, hy - 2, bone); s.put(10, hy - 3, bone)
            else: s.put(3, hy, bone); s.put(2, hy - 1, bone); s.put(12, hy, bone); s.put(13, hy - 1, bone)
    elif h == 'straw':
        if side: s.rect(3, hy + 1, 12, hy + 1, c); s.rect(5, hy - 1, 9, hy, c); s.rect(5, hy, 9, hy, R['accent'])
        else:
            s.rect(2, hy + 1, 13, hy + 1, c); s.rect(4, hy - 1, 11, hy, c); s.rect(4, hy, 11, hy, R['accent']); s.put(2, hy + 1, lo); s.put(13, hy + 1, lo); s.rect(5, hy - 1, 6, hy - 1, hi)
    elif h == 'top':
        if side: s.rect(5, hy - 3, 9, hy, c); s.rect(4, hy + 1, 11, hy + 1, c); s.rect(5, hy - 1, 9, hy - 1, R['accent'])
        else: s.rect(5, hy - 3, 10, hy, c); s.rect(3, hy + 1, 12, hy + 1, c); s.rect(5, hy - 1, 10, hy - 1, R['accent']); s.put(5, hy - 3, hi)
    elif h in ('cap', 'captain', 'minercap'):
        if side: s.rect(5, hy - 1, 10, hy + 1, c); s.rect(10, hy + 1, 12, hy + 1, lo)
        else:
            s.rect(4, hy - 1, 11, hy + 1, c); s.rect(4, hy + 1, 11, hy + 1, lo); s.put(5, hy - 1, hi)
            if d == 'down': s.rect(5, hy + 2, 10, hy + 2, lo)
        if h == 'captain':
            if not side: s.rect(7, hy - 1, 8, hy, R['accent']); s.rect(4, hy + 1, 11, hy + 1, (240, 240, 240))
            else: s.rect(6, hy, 7, hy, R['accent'])
        if h == 'minercap':
            lamp = (255, 240, 140)
            if d == 'down': s.rect(7, hy - 1, 8, hy, lamp)
            elif side: s.put(10, hy, lamp)
    elif h == 'chef':
        w = (250, 250, 250); g = (220, 220, 226)
        if side: s.rect(5, hy - 3, 9, hy + 1, w); s.rect(5, hy + 1, 9, hy + 1, g)
        else: s.rect(5, hy - 3, 10, hy - 1, w); s.rect(4, hy - 2, 11, hy - 1, w); s.rect(4, hy, 11, hy + 1, g); s.put(10, hy - 3, g)
    elif h == 'wizard':
        star = R['accent']
        if side: s.put(9, hy - 4, c); s.rect(7, hy - 3, 8, hy - 3, c); s.rect(6, hy - 2, 9, hy - 1, c); s.rect(4, hy, 11, hy, lo)
        else:
            s.put(9, hy - 4, c); s.rect(7, hy - 3, 8, hy - 3, c); s.rect(6, hy - 2, 9, hy - 2, c); s.rect(5, hy - 1, 10, hy, c)
            s.rect(3, hy + 1, 12, hy + 1, lo); s.put(7, hy - 1, star); s.put(9, hy, star)
    elif h == 'bandana':
        if side: s.rect(5, hy, 9, hy + 1, c); s.put(4, hy + 2, c); s.put(3, hy + 3, lo)
        else: s.rect(4, hy, 11, hy + 1, c); s.put(12, hy + 2, c); s.put(13, hy + 3, lo); s.put(5, hy, hi)
    elif h == 'circlet':
        if not side: s.rect(4, hy + 1, 11, hy + 1, c); s.put(7, hy + 1, (120, 220, 240)); s.put(8, hy + 1, (120, 220, 240))
        else: s.rect(5, hy + 1, 9, hy + 1, c)
    elif h == 'flowers':
        cols = [(250, 120, 170), (250, 240, 120), (170, 140, 250)]
        xs = range(5, 10) if side else range(4, 12)
        for i, x in enumerate(xs):
            if i % 2 == 0: s.put(x, hy, cols[(i // 2) % 3])
        if not side: s.rect(3, hy + 2, 3, hy + 6, R['hair']); s.rect(12, hy + 2, 12, hy + 6, shade(R['hair'], 0.8))
    elif h == 'bun':
        if side: s.rect(4, hy - 1, 5, hy, hair)
        else: s.rect(7, hy - 2, 8, hy - 1, hair); s.put(7, hy - 2, shade(hair, 1.2))
    elif h == 'long':
        if side: s.rect(4, hy + 1, 5, hy + 8, hair)
        else:
            s.rect(3, hy + 2, 3, hy + 8, hair); s.rect(12, hy + 2, 12, hy + 8, shade(hair, 0.8))
            if d == 'up': s.rect(4, hy + 6, 11, hy + 8, hair)
    elif h == 'bald':
        skin = SKINS[R['skin']]
        if side: s.rect(5, hy, 9, hy + 2, skin); s.rect(5, hy + 3, 5, hy + 4, hair); s.put(7, hy, shade(skin, 1.15))
        else:
            s.rect(5, hy, 10, hy + 2, skin); s.rect(4, hy + 1, 11, hy + 2, skin); s.put(4, hy + 3, hair); s.put(11, hy + 3, hair); s.put(4, hy + 2, hair); s.put(11, hy + 2, hair)
            s.put(6, hy, shade(skin, 1.15))
            if d == 'up': s.rect(4, hy + 3, 11, hy + 5, hair)
    elif h == 'goggles':
        lens = (120, 200, 230)
        if side: s.rect(6, hy + 1, 10, hy + 1, c); s.put(9, hy + 1, lens)
        else: s.rect(4, hy + 1, 11, hy + 1, c); s.put(5, hy + 1, lens); s.put(6, hy + 1, lens); s.put(9, hy + 1, lens); s.put(10, hy + 1, lens)
    elif h == 'mask':
        if d == 'down': s.rect(5, hy + 3, 10, hy + 5, c); s.put(6, hy + 4, EYE); s.put(9, hy + 4, EYE); s.rect(5, hy + 5, 10, hy + 5, shade(c, 0.8))
        elif side: s.rect(8, hy + 3, 10, hy + 5, c); s.put(9, hy + 4, EYE)
    elif h == 'pelt':
        if side: s.rect(4, hy - 1, 9, hy + 2, c); s.put(10, hy + 1, (240, 236, 220)); s.rect(3, hy + 2, 4, hy + 8, c)
        else:
            s.rect(4, hy - 1, 11, hy + 1, c); s.put(4, hy - 2, c); s.put(11, hy - 2, c)  # ears
            s.rect(3, hy + 2, 3, hy + 8, c); s.rect(12, hy + 2, 12, hy + 8, lo)
            if d == 'down': s.put(5, hy + 1, (240, 236, 220)); s.put(10, hy + 1, (240, 236, 220))  # fangs


def face(s, R, d, hy):
    if d == 'up': return
    f = R['face']; skin = SKINS[R['skin']]
    hc = R['hair'] if R['hat'] != 'bald' else R['hair']
    if f in ('beard', 'longbeard'):
        if d == 'down':
            s.rect(5, hy + 5, 10, hy + 6, hc); s.put(5, hy + 4, hc); s.put(10, hy + 4, hc)
            if f == 'longbeard': s.rect(6, hy + 7, 9, hy + 8, hc); s.rect(7, hy + 9, 8, hy + 9, hc)
            s.put(7, hy + 5, shade(skin, 0.75)); s.put(8, hy + 5, shade(skin, 0.75))  # mouth
        else:
            s.rect(7, hy + 4, 10, hy + 6, hc)
            if f == 'longbeard': s.rect(8, hy + 7, 9, hy + 8, hc)
    elif f == 'mustache':
        if d == 'down': s.rect(6, hy + 5, 9, hy + 5, hc)
        else: s.rect(9, hy + 5, 10, hy + 5, hc)
    elif f == 'monocle':
        if d == 'down': s.put(9, hy + 4, (240, 220, 120)); s.put(9, hy + 5, (200, 180, 90))
        else: s.put(9, hy + 3, (240, 220, 120))
    elif f == 'glasses':
        g = (60, 50, 60)
        if d == 'down': s.put(5, hy + 4, g); s.put(7, hy + 4, g); s.put(8, hy + 4, g); s.put(10, hy + 4, g)
        else: s.put(10, hy + 3, g)


# ---------------------------------------------------------------- props (held at the hero's right: screen x 12-14 facing down)
def prop(s, R, d, hy, ty0):
    p = R.get('prop', 'none'); c = R.get('propc') or (150, 110, 60)
    wood = (130, 90, 50); metal = (200, 204, 216); hi = shade(c, 1.2); lo = shade(c, 0.7)
    if p == 'none': return
    # facing up the prop is behind the body: draw it, the body hides most of it; facing the side it is in front
    hx = 13 if d != 'side' else 11
    hand = ty0 + 4
    if p in ('spear', 'staff', 'orbstaff', 'cane', 'rod', 'pitchfork', 'banner'):
        shaft = wood
        top = {'spear': hy - 2, 'staff': hy, 'orbstaff': hy + 1, 'cane': ty0 + 1, 'rod': hy - 3, 'pitchfork': hy, 'banner': hy - 3}[p]
        s.rect(hx, top, hx, 14, shaft)
        if p == 'spear': s.put(hx, top - 1, metal); s.put(hx, top - 2, shade(metal, 1.1)); s.put(hx - 1, top, metal); s.put(hx + 1, top, metal)
        if p == 'orbstaff': s.rect(hx - 1, top - 2, hx + 1, top - 1, c); s.put(hx - 1, top - 2, hi); s.put(hx, top - 3, shade(c, 0.85))
        if p == 'cane': s.put(hx - 1, top, shaft)
        if p == 'rod': s.put(hx + 1, top, wood); s.rect(hx + 2, top + 1, hx + 2, top + 7, (220, 220, 230)); s.put(hx + 2, top + 8, (200, 60, 60))
        if p == 'pitchfork': s.rect(hx - 1, top - 1, hx + 1, top - 1, metal); s.put(hx - 1, top - 2, metal); s.put(hx + 1, top - 2, metal); s.put(hx, top - 2, metal)
        if p == 'banner': s.rect(hx + 1, top, hx + 2, top + 4, c); s.put(hx + 2, top + 5, c); s.put(hx + 1, top + 2, R['accent'])
    elif p == 'hammer':
        s.rect(hx, hand - 3, hx, hand + 1, wood); s.rect(hx - 1, hand - 4, hx + 1, hand - 3, c); s.put(hx - 1, hand - 4, hi)
    elif p == 'pick':
        s.rect(hx, hand - 3, hx, hand + 1, wood); s.rect(hx - 2, hand - 4, hx + 2, hand - 4, c); s.put(hx - 2, hand - 3, c); s.put(hx + 2, hand - 3, lo)
    elif p == 'axe':
        s.rect(hx, hand - 4, hx, hand + 1, wood); s.rect(hx + 1, hand - 4, hx + 2, hand - 2, c); s.put(hx + 2, hand - 4, hi)
    elif p == 'sword':
        s.rect(hx, hand - 6, hx, hand - 1, c); s.put(hx, hand - 7, hi); s.rect(hx - 1, hand, hx + 1, hand, (200, 160, 60)); s.put(hx, hand + 1, wood)
    elif p == 'shieldhold':
        s.rect(hx - 1, hand - 3, hx + 1, hand + 1, c); s.put(hx, hand - 2, R['accent']); s.rect(hx + 1, hand - 3, hx + 1, hand + 1, lo)
    elif p == 'mug':
        s.rect(hx, hand - 1, hx + 1, hand + 1, c); s.rect(hx, hand - 2, hx + 1, hand - 2, (250, 250, 240)); s.put(hx + 2, hand, lo)
    elif p == 'lantern':
        s.put(hx, hand - 1, (60, 50, 40)); s.rect(hx - 1, hand, hx + 1, hand + 2, c); s.put(hx, hand + 1, (255, 250, 210)); s.rect(hx - 1, hand + 3, hx + 1, hand + 3, (60, 50, 40))
    elif p in ('book', 'scroll'):
        if p == 'book': s.rect(hx - 1, hand - 1, hx + 1, hand + 1, c); s.rect(hx - 1, hand - 1, hx - 1, hand + 1, lo); s.put(hx + 1, hand - 1, (240, 230, 200))
        else: s.rect(hx, hand - 2, hx, hand + 2, c); s.put(hx, hand - 2, lo); s.put(hx, hand + 2, lo); s.put(hx + 1, hand, shade(c, 0.85))
    elif p in ('bag', 'basket', 'rope', 'pelt'):
        if p == 'basket': s.rect(hx - 1, hand, hx + 1, hand + 2, c); s.rect(hx - 1, hand, hx + 1, hand, lo); s.put(hx - 1, hand - 1, (90, 170, 80)); s.put(hx + 1, hand - 1, (250, 120, 170)); s.put(hx, hand - 1, (90, 170, 80))
        elif p == 'rope': s.rect(hx - 1, hand, hx + 1, hand + 2, c); s.put(hx, hand + 1, lo)
        elif p == 'pelt': s.rect(hx - 1, hand - 1, hx + 1, hand + 2, c); s.put(hx + 1, hand + 3, lo); s.put(hx - 1, hand - 1, hi)
        else: s.rect(hx - 1, hand, hx + 1, hand + 2, c); s.rect(hx - 1, hand, hx + 1, hand, lo); s.put(hx, hand + 1, R['accent'])
    elif p in ('coin', 'gem'):
        s.put(hx, hand - 1, c); s.put(hx, hand - 2, hi)
    elif p == 'potion':
        s.put(hx, hand - 3, (220, 220, 230)); s.rect(hx - 1, hand - 2, hx + 1, hand, c); s.put(hx - 1, hand - 2, hi)
    elif p == 'gavel':
        s.rect(hx, hand - 2, hx, hand, wood); s.rect(hx - 1, hand - 3, hx + 1, hand - 3, c)
    elif p == 'horn':
        s.put(hx, hand - 1, c); s.put(hx + 1, hand - 2, c); s.put(hx + 1, hand - 3, hi); s.put(hx + 2, hand - 3, hi)
    elif p == 'spyglass':
        s.rect(hx, hand - 3, hx, hand, c); s.put(hx, hand - 4, (180, 220, 240))
    elif p == 'key':
        s.rect(hx, hand - 2, hx, hand, c); s.put(hx + 1, hand, c); s.put(hx, hand - 3, hi)
    elif p == 'ladle':
        s.rect(hx, hand - 4, hx, hand, c); s.rect(hx - 1, hand + 1, hx + 1, hand + 1, c)
    elif p == 'needle':
        s.rect(hx, hand - 3, hx, hand, c); s.rect(hx - 2, ty0 + 1, hx - 2, ty0 + 1, (240, 210, 90))
        if d == 'down':
            for i in range(4): s.put(5 + i, ty0 + i, (240, 210, 90))  # tape across the chest
    elif p == 'bow':
        s.rect(hx + 1, hand - 5, hx + 1, hand + 2, c); s.put(hx, hand - 6, c); s.put(hx, hand + 3, c); s.rect(hx, hand - 5, hx, hand + 2, (230, 230, 230))
    elif p == 'whip':
        s.put(hx, hand, wood); s.put(hx + 1, hand + 1, c); s.put(hx + 2, hand + 2, c); s.put(hx + 2, hand + 3, c); s.put(hx + 1, hand + 4, c)


def realm_stone(f):
    """A glowing crystal obelisk on a plinth (not a person): two pulsing frames."""
    s = Sprite()
    base = (110, 110, 124); glow = (120, 220, 255) if f == 0 else (170, 240, 255)
    s.rect(4, 13, 11, 15, base); s.rect(4, 13, 11, 13, shade(base, 1.2)); s.rect(11, 13, 11, 15, shade(base, 0.7))
    s.rect(6, 4, 9, 12, (60, 120, 190)); s.rect(7, 2, 8, 3, (60, 120, 190)); s.put(7, 1, glow)
    s.rect(7, 3, 7, 11, glow); s.rect(9, 4, 9, 12, (40, 80, 140))
    s.put(6, 6, (230, 250, 255)); s.put(8, 8, glow)
    if f == 1: s.put(4, 4, glow); s.put(11, 7, glow); s.put(3, 10, glow)
    else: s.put(12, 3, glow); s.put(5, 9, glow)
    return s.image()


def build(role, d, f, blink=False):
    R = ROLES[role]
    if R.get('special') == 'stone':
        return realm_stone(1 if blink or f == 1 else 0)
    s = Sprite()
    behind = d == 'up'
    if behind: prop(s, R, d, 3 if R.get('small') else 1, (3 if R.get('small') else 1) + 7)
    hy, ty0 = body(s, R, d, f, blink)
    outfit(s, R, d, hy, ty0)
    headwear(s, R, d, hy)
    face(s, R, d, hy)
    if not behind: prop(s, R, d, hy, ty0)
    return s.image()


def main():
    os.makedirs(A, exist_ok=True)
    n = 0
    for role in ROLES:
        for d in ('down', 'up', 'side'):
            for f in (0, 1):
                build(role, d, f).save(os.path.join(A, f'gh_npc_{role}_{d}{f}.png')); n += 1
        build(role, 'down', 0, blink=True).save(os.path.join(A, f'gh_npc_{role}_blink.png')); n += 1
    print(f'generated {n} NPC sprites for {len(ROLES)} roles')
    if '--sheet' in sys.argv:
        path = sys.argv[sys.argv.index('--sheet') + 1]
        roles = list(ROLES); cols = 8; sc = 5; cw = 16 * sc + 8
        frames = [('down', 0, False), ('down', 0, True), ('side', 1, False), ('up', 0, False)]
        sheet = Image.new('RGBA', (cols * (cw * 2 + 6), ((len(roles) + cols - 1) // cols) * (cw * 2 + 20)), (58, 82, 52, 255))
        for i, role in enumerate(roles):
            gx, gy = (i % cols) * (cw * 2 + 6), (i // cols) * (cw * 2 + 20)
            for j, (d, f, b) in enumerate(frames):
                im = build(role, d, f, b).resize((16 * sc, 16 * sc), Image.NEAREST)
                sheet.alpha_composite(im, (gx + (j % 2) * cw + 4, gy + (j // 2) * cw + 4))
        sheet.save(path)


if __name__ == '__main__':
    main()
