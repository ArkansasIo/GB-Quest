#!/usr/bin/env python3
"""8-bit art for content that had none (and 64-bit versions via tools/gen_hd64.py):

  np_class_<cls> / c_<cls>_<0..5>   portraits + battle sheets for the 4 newer classes (tinted + emblem)
  bf_<buff>   cd_<condition>        buff / debuff / condition icons (16x16)
  sk_<skill>  ps_<skill>  tl_<node> active skills, passive skills, talent nodes
  ac_<ach>    tt_<title>            achievement medallions, title banners
  sl_<slot>                         12 equipment-slot silhouettes
  rg_<0..8>   rk_<1..9>             rarity gems (tiers 1-9) and F-to-SSS rank badges
  nn_<named>                        a unique icon for every named item
All original pixel art: 12x12 glyph masks, 3-tone shading, dark outline, category frame.
Walking sprites for the new classes come from tools/gen_gbtiles.py (LOOKS).
"""
import json, os, hashlib, colorsys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets')
OUT = (24, 20, 30)
count = 0
def save(name, img):
    global count; Image.fromarray(img, 'RGBA').save(os.path.join(A, name + '.png')); count += 1
def blank(n=16): return np.zeros((n, n, 4), np.uint8)
def px(img, x, y, c, a=255):
    if 0 <= x < img.shape[1] and 0 <= y < img.shape[0]: img[y, x] = (*c, a)
def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
def hsv(h, s, v): return tuple(int(x * 255) for x in colorsys.hsv_to_rgb(h % 1, s, v))

# ---------------------------------------------------------------- 12x12 glyphs ('#' body, '+' highlight, '-' shadow)
G = {
 'sword':   ["          ##","         #+#","        #+# ","       #+#  ","      #+#   "," #   #+#    ","  # #+#     ","   ##-#     ","   #--#     ","  # #  #    "," #      #   ","            "],
 'shield':  [" ########## "," #++++#---# "," #+++##---# "," #++###---# "," #++#+#---# "," #+######-# ","  #+####-#  ","  #+####-#  ","   #+##-#   ","    #+-#    ","     ##     ","            "],
 'heart':   ["            ","  ##    ##  "," #++#  #+-# ","#+++####--#-","#++#####---#","#+########-#"," #########- ","  #######-  ","   #####-   ","    ###-    ","     #-     ","            "],
 'skull':   ["   ######   ","  #++++++#  "," #++####### "," #+########-"," # ##  ## #-"," #  #  #  #-"," ##########-","  ##-##-##- ","   #-#-#-   ","   ######   ","            ","            "],
 'flame':   ["     #      ","    ##      ","    #+#  #  ","   #++#  ## ","  #+++## +# ","  #++++###- "," #++#++###- "," #+##+####- "," #+#++###-- ","  #+####--  ","   ######   ","            "],
 'drop':    ["     #      ","     ##     ","    #+#     ","    #+##    ","   #++##    ","   #+###-   ","  #++###-#  ","  #+####--  ","  #+####--  ","   #####-   ","    ###     ","            "],
 'bolt':    ["      ####  ","     #++#   ","    #++#    ","   #++#     ","  #++#####  "," ######++#  ","     #++#   ","    #++#    ","   #++#     ","  #+#       ","  ##        ","            "],
 'star':    ["     ##     ","     ++     ","    #++#    ","    #++#    ","############","  #++++++#  ","   #++++#   ","  #++##++#  ","  #+#  #+#  "," #+#    #+# "," ##      ## ","            "],
 'eye':     ["            ","            ","   ######   ","  #++++++#  "," #++####++# ","#++##++##+-#","#+###++###-#"," #++####+-# ","  #++++--#  ","   ######   ","            ","            "],
 'cross':   ["    ####    ","    #++#    ","    #++#    ","    #++#    ","#####++#####","#++++++++++#","#----++----#","#####++#####","    #++#    ","    #--#    ","    ####    ","            "],
 'up':      ["     ##     ","    #++#    ","   #++++#   ","  #++++++#  "," #++####++# ","#####++#####","    #++#    ","    #++#    ","    #++#    ","    #--#    ","    ####    ","            "],
 'down':    ["    ####    ","    #++#    ","    #++#    ","    #++#    ","    #++#    ","#####--#####"," #--####--# ","  #------#  ","   #----#   ","    #--#    ","     ##     ","            "],
 'snow':    ["     ##     ","  #  ++  #  ","   # ++ #   ","    #++#    ","  ##++++##  ","#+++++++++++","  ##++++##  ","    #++#    ","   # ++ #   ","  #  ++  #  ","     ##     ","            "],
 'swirl':   ["   ######   ","  #++++++#  "," #+#####+#  "," #+#   #+#  "," #+# ##+#   "," #+# #+#  # "," #+#  ###+# "," #+#    #+# ","  #+####+#  ","   #++++#   ","    ####    ","            "],
 'crown':   ["            ","#    ##    #","#+  #++#  +#","#+# #++# #+#","#++##++##++#","#++++++++++#","#+#+##+##+-#","#++++++++--#","############","            ","            ","            "],
 'fist':    ["            ","   ######   ","  #+#+#+##  "," #+#+#+#+-# "," #+++++++-# "," #++####+-# ","  #+++++--# ","  #++++---# ","   #+----#  ","   #+---#   ","   ######   ","            "],
 'wing':    ["##          ","#+##        ","#++#####    "," #+++++###  "," #+#++++++##","  #+##+++++#","  #+++####+#","   #++++++# ","    #+####  ","     ###    ","            ","            "],
 'moon':    ["    ####    ","   #+++#    ","  #++#      "," #++#       "," #+#        "," #+#        "," #+#        "," #++#     # ","  #++#####  ","   #++++#   ","    ####    ","            "],
 'sun':     ["#    ##    #"," #   ++   # ","  # #++# #  ","   #++++#   ","  #++++++#  ","##++++++++##","  #++++++#  ","   #++++#   ","  # #++# #  "," #   --   # ","#    ##    #","            "],
 'leaf':    ["         ###","      ###++#","    ##++++# ","   #+++#++# ","  #++##++#  ","  #+#++++#  "," #+#++++#   "," #+++++#    "," #++##      ","#-##        ","##          ","            "],
 'chain':   ["  ###       "," #+-+#      "," #+ +#      "," #+#####    ","  ##+-+#    ","    #+ +#   ","    #+#####  ","     ##+-+# ","       #+ +#","       #+-+#","        ### ","            "],
 'hourglass':["############","#++++++++++#"," #+++++++-# ","  #+++++-#  ","   #+++-#   ","    #+-#    ","   #-  -#   ","  #------#  "," #-------+# ","#+++++++++-#","############","            "],
 'mask':    ["            "," ########## ","#++++++++++#","#+##++++##+#","#+#  ++  #+#","#++##++##++#","#++++++++++#"," #++####++# ","  #++++++#  ","   ######   ","            ","            "],
 'bow':     ["  ##        ","  #+#     # ","   #+#   #  ","    #+# #   ","     #+#    ","    # #+#   ","   #   #+#  ","  #     #+# "," #       #+#","#         ##","            ","            "],
 'boot':    ["            ","   #####    ","   #+++#    ","   #+++#    ","   #+++#    ","   #+++#    ","   #+++###  ","  #++++++## ","  #++++++++#","  ##########","            ","            "],
 'helm':    ["    ####    ","  ##++++##  "," #++++++++# "," #++####++# ","#++#    #++#","#+##-##-##+#","#+# #  # #+#","#+# #  # #+#","#++########+","#+#      #+#"," ##      ## ","            "],
 'ring':    ["     ##     ","    #++#    ","   # ++ #   ","    ####    ","  ##    ##  "," #+      -# "," #+      -# "," #+      -# ","  ##    ##  ","    ####    ","            ","            "],
 'amulet':  ["#          #"," #        # ","  #      #  ","   #    #   ","    #  #    ","    ####    ","   #++++#   ","  #++##++#  ","  #+#++#+#  ","   #++++#   ","    ####    ","            "],
 'cloak':   ["    ####    ","   #++++#   ","  #++##++#  ","  #+#  #+#  "," #+#    #+# "," #+#    #+# ","#++#    #+-#","#+#      #-#","#+#      #-#","#++#    #--#","##########  ","            "],
 'glove':   ["   # # #    ","  #+#+#+#   ","  #+#+#+# # ","  #+#+#+##+#","  #+++++#+# ","  #++++++#  ","  #++++++#  ","  #+++++-#  ","   #+++--#  ","   ######   ","   #++--#   ","   ######   "],
 'belt':    ["            ","            ","            ","############","#++++####++#","#+++#++#+++#","#---#++#---#","#----##----#","############","            ","            ","            "],
 'legs':    ["  ########  ","  #++++++#  ","  #++##++#  ","  #++##++#  ","  #+-##+-#  ","  #+-##+-#  ","  #+-##+-#  ","  #+-##+-#  ","  #+-##+-#  "," ##+-##+-## "," ####  #### ","            "],
 'chest':   ["  ##    ##  "," #++####++# ","#++++++++++#","#++#+++#+++#"," #+#+++#++# "," #++++++++# "," #+#+++#++# "," #++++++--# "," #++++---# ","  ########  ","            ","            "],
 'gem':     ["            ","   ######   ","  #++#+-#-# "," #++#++#--# ","############"," #++++#--#  ","  #+++#-#   ","   #++#-#   ","    #+-#    ","     ##     ","            ","            "],
 'book':    ["            "," ########## "," #++++#---# "," #+##+#-##-#"," #++++#---# "," #+##+#-##-#"," #++++#---# "," #++++#---# "," ########## "," #--------# "," ########## ","            "],
 'trophy':  ["############","#++++++++++#"," #+++++++-# ","#+#++++++#-#","#+#++++++#-#"," # #++++-# # ","    #++-#   ","     #-#    ","    #+-#    ","   #++--#   ","  ########  ","            "],
 'paw':     ["  ##    ##  "," #++#  #++# "," #+-#  #+-# ","##-#    #-##","#+#  ##  #+#","#-# #++#  -#"," # #++++#   ","  #++++++#  ","  #++++++#  ","   ######   ","            ","            "],
 'zzz':     ["            ","    ######  ","       #+#  ","      #+#   ","     #+#    ","    ######  "," #####      ","    #+#     ","   #+#      ","  #####     ","            ","            "],
 'ghost':   ["    ####    ","   #+ ++#   ","  #+    +#  ","  # #  # #  ","  +      +  ","  #  ##  #  ","  +      +  ","  #      #  ","  +      +  ","  # # # # #  ","   + + + +  ","            "],
 'target':  ["    ####    ","  ##++++##  "," #+##  ##+# "," #+# ## #+# ","#+# #++# #+#","#+##+##+##+#","#+# #++# #+#"," #+# ## #+# "," #+##  ##-# ","  ##++--##  ","    ####    ","            "],
 'spiral':  ["            ","  ########  "," #+++++++-# "," #+######-# "," #+#++++#-# "," #+#+##+#-# "," #+#+#-+#-# "," #+#+---#-# "," #+#######  "," #+++++++++ ","  ######### ","            "],
 'banner':  [" ########## "," #++++++++# "," #++####++# "," #+#++++#+# "," #++####++# "," #++++++++# "," #++++++++# "," #++#  #++# "," #+#    #+# "," ##      ## "," #        # ","            "],
 'bones':   ["            ","##        ##","#+#      #+#"," #+#    #+# ","  #+#  #+#  ","   #+##+#   ","   #-##-#   ","  #-#  #-#  "," #-#    #-# ","#-#      #-#","##        ##","            "],
 'axe':     ["   ######   ","  #++++++#  "," #++++++++# "," #+++##+++# "," #++####++# ","  ##+##+##  ","     ##     ","     #-     ","     #-     ","     #-     ","     ##     ","            "],
 'staff':   ["      ##### ","     #+++++#","     #++#++#","      ####  ","     #-#    ","    #-#     ","   #-#      ","  #-#       "," #-#        ","#-#         ","##          ","            "],
 'scale':   ["     ##     ","############","#+    #+   #"," #+   #+  # ","  #+  #+ #  ","########### ","     #+     ","     #+     ","     #+     ","   ######   ","  ########  ","            "],
}
def draw_glyph(img, g, base, ox=2, oy=2, n=12):
    hi, lo = shade(base, 1.35), shade(base, 0.62)
    rows = G[g]; mask = np.zeros((n, n), bool)
    for y, r in enumerate(rows[:n]):
        for x, ch in enumerate(r[:n]):
            if ch in '#+-': mask[y, x] = True; px(img, ox + x, oy + y, hi if ch == '+' else lo if ch == '-' else base)
    # outline
    for y in range(n):
        for x in range(n):
            if not mask[y, x] and any(0 <= y + dy < n and 0 <= x + dx < n and mask[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                if img[oy + y, ox + x, 3] < 200 or tuple(img[oy + y, ox + x, :3]) in FRAME_FILLS: px(img, ox + x, oy + y, OUT)
FRAME_FILLS = set()
def frame(kind, col):
    img = blank(); edge, fillc = shade(col, 0.55), shade(col, 0.25); FRAME_FILLS.add(fillc); FRAME_FILLS.add(shade(fillc, 1.3))
    if kind == 'medal':
        for y in range(16):
            for x in range(16):
                d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
                if d < 7.6: px(img, x, y, shade(col, 0.95) if d > 6.4 else (shade(col, 1.25) if (x + y) < 13 and d > 5.4 else fillc))
    elif kind == 'banner':
        for y in range(15):
            for x in range(1, 15):
                if y < 12 or abs(x - 7.5) > (y - 11) * 2.2: px(img, x, y, edge if x in (1, 14) or y == 0 else fillc)
    elif kind == 'slot':
        for y in range(16):
            for x in range(16): px(img, x, y, (34, 30, 44) if 0 < x < 15 and 0 < y < 15 else (70, 64, 84))
        FRAME_FILLS.add((34, 30, 44))
    else:
        for y in range(16):
            for x in range(16):
                corner = (x in (0, 15)) and (y in (0, 15))
                if corner: continue
                px(img, x, y, edge if x in (0, 15) or y in (0, 15) else (shade(fillc, 1.3) if y < 4 else fillc))
    return img

def icon(name, kind, frame_col, glyph, glyph_col):
    img = frame(kind, frame_col); draw_glyph(img, glyph, glyph_col); save(name, img)

def pick_glyph(key, table, default):
    for k, g in table:
        if k in key: return g
    return default

L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'art_ids.json')))
GREEN, RED, VIOLET, BLUE, TEAL, GOLD = (90, 200, 90), (210, 70, 70), (150, 100, 200), (80, 130, 230), (60, 190, 180), (230, 190, 70)
WORDS = [('bless', 'star'), ('haste', 'wing'), ('swift', 'wing'), ('regen', 'cross'), ('heal', 'cross'), ('mend', 'cross'), ('fortify', 'shield'), ('guard', 'shield'), ('ward', 'shield'), ('barrier', 'shield'), ('ac', 'shield'),
         ('might', 'fist'), ('power', 'fist'), ('rage', 'flame'), ('frenzy', 'fist'), ('fed', 'heart'), ('vital', 'heart'), ('hardened', 'heart'), ('inspired', 'star'), ('rally', 'banner'), ('mirror', 'eye'), ('host', 'crown'),
         ('trueveil', 'eye'), ('foresight', 'eye'), ('focus', 'target'), ('aim', 'target'), ('precision', 'target'), ('thorn', 'leaf'), ('nature', 'leaf'), ('spirit', 'ghost'), ('wild', 'paw'), ('beast', 'paw'), ('ferocity', 'paw'),
         ('burn', 'flame'), ('ember', 'flame'), ('flame', 'flame'), ('sunflare', 'sun'), ('sun', 'sun'), ('bleed', 'drop'), ('venom', 'drop'), ('poison', 'drop'), ('wellspring', 'drop'), ('frost', 'snow'), ('shock', 'bolt'), ('storm', 'bolt'),
         ('weak', 'down'), ('vulner', 'target'), ('sunder', 'axe'), ('slow', 'hourglass'), ('doom', 'skull'), ('bane', 'skull'), ('fright', 'skull'), ('blind', 'eye'), ('prone', 'down'), ('restrain', 'chain'), ('stun', 'star'),
         ('paraly', 'chain'), ('asleep', 'zzz'), ('charm', 'heart'), ('domin', 'crown'), ('invis', 'ghost'), ('silence', 'mask'), ('banish', 'swirl'), ('dodg', 'wing'), ('mark', 'target'), ('hex', 'spiral'), ('outlin', 'star'),
         ('curs', 'skull'), ('reckless', 'flame'), ('shadow', 'moon'), ('arcane', 'swirl'), ('burst', 'star'), ('resil', 'shield'), ('endure', 'heart'), ('fortress', 'shield'), ('footwork', 'boot'), ('critical', 'sword'), ('gap', 'sword'),
         ('strike', 'sword')]
# buffs (good = green, harmful = red)
HARM = {'burning', 'bleeding', 'venom', 'frostbite', 'shocked', 'weakened', 'vulnerable', 'sundered', 'slowed', 'doomed', 'bane'}
for k, name, *_ in L['buffs']:
    bad = k in HARM
    icon(f'bf_{k}', 'tile', RED if bad else GREEN, pick_glyph(k, WORDS, 'star'), (240, 120, 90) if bad else (200, 250, 160))
for k in L['conds']: icon(f'cd_{k}', 'tile', VIOLET, pick_glyph(k, WORDS, 'skull'), (230, 210, 255))
for k, name, *_ in L['active']: icon(f'sk_{k}', 'tile', BLUE, pick_glyph(k, WORDS, 'sword'), (190, 220, 255))
for k, name in L['passive']: icon(f'ps_{k}', 'tile', TEAL, pick_glyph(k, WORDS, 'star'), (200, 255, 240))
for k, name, tree in L['talents']: icon(f'tl_{k}', 'tile', GOLD, pick_glyph(k.split('_', 1)[1], WORDS, 'star'), (255, 240, 190))
# achievements: medallions, tier by id
ACHW = [('kill', 'sword'), ('lvl', 'up'), ('boss', 'skull'), ('arc', 'crown'), ('dungeon', 'shield'), ('raid', 'crown'), ('trial', 'trophy'), ('tower', 'up'), ('gold', 'gem'), ('legend', 'star'), ('fish', 'drop'),
        ('craft', 'fist'), ('quest', 'book'), ('nat20', 'star'), ('nat1', 'skull'), ('stab', 'heart'), ('elite', 'skull'), ('pvp', 'sword'), ('party', 'banner'), ('diff', 'flame'), ('spell', 'swirl'), ('step', 'boot'), ('auction', 'gem'), ('epic', 'gem')]
METAL = [(205, 127, 50), (192, 192, 205), (240, 200, 70)]
for i, (k, name) in enumerate(L['ach']):
    tier = 2 if any(t in k for t in ('1000', '100', '9', 'raid', 'arc', 'legend', 'spell9', 'tower')) else 1 if any(t in k for t in ('10', '20', 'boss', 'dungeon', 'trial', '5')) else 0
    icon(f'ac_{k}', 'medal', METAL[tier], pick_glyph(k, ACHW, 'trophy'), shade(METAL[tier], 1.25))
TITW = [('wander', 'boot'), ('blood', 'drop'), ('slayer', 'sword'), ('king', 'crown'), ('hunter', 'bow'), ('delver', 'shield'), ('raider', 'banner'), ('champion', 'trophy'), ('climber', 'up'), ('hundred', 'crown'),
        ('hero', 'star'), ('ascend', 'wing'), ('myth', 'swirl'), ('eternal', 'hourglass'), ('lucky', 'star'), ('rich', 'gem'), ('legend', 'star'), ('collector', 'book'), ('angler', 'drop'), ('survivor', 'heart'), ('nightmare', 'moon'), ('apocalypse', 'skull')]
for i, (k, name) in enumerate(L['titles']):
    h = int(hashlib.md5(k.encode()).hexdigest()[:4], 16) / 65535
    icon(f'tt_{k}', 'banner', hsv(h, 0.55, 0.85), pick_glyph(k, TITW, 'star'), (255, 240, 200))
# slots
SLOTG = {'head': 'helm', 'neck': 'amulet', 'armor': 'chest', 'back': 'cloak', 'hands': 'glove', 'weapon': 'sword', 'waist': 'belt', 'legs': 'legs', 'feet': 'boot', 'ring1': 'ring', 'ring2': 'ring', 'offhand': 'shield'}
for s in L['slots']: icon(f'sl_{s}', 'slot', (60, 60, 80), SLOTG.get(s, 'gem'), (120, 116, 140))
# rarity gems (tier colours match the game) and rank pips
RAR = [(157, 157, 157), (255, 255, 255), (30, 255, 0), (0, 112, 221), (163, 53, 238), (255, 128, 0), (230, 38, 77), (230, 204, 128), (127, 255, 212)]
for i, c in enumerate(RAR):
    img = blank(); draw_glyph(img, 'gem', c); save(f'rg_{i}', img)
# Competitive progression ranks: F -> E -> D -> C -> B -> A -> S -> SS -> SSS.
# Each badge is a distinct medal with a rank glyph, readable at native 16x16.
RANKS = [
    ('F',  (128, 132, 140), 'shield'),
    ('E',  (154, 166, 178), 'shield'),
    ('D',  (96, 176, 112),  'leaf'),
    ('C',  (72, 148, 224),  'star'),
    ('B',  (164, 104, 224), 'crown'),
    ('A',  (236, 164, 64),  'sun'),
    ('S',  (232, 76, 92),   'sword'),
    ('SS', (72, 212, 204),  'swirl'),
    ('SSS',(248, 224, 132), 'crown'),
]
for n, (label, color, glyph) in enumerate(RANKS, 1):
    icon(f'rk_{n}', 'medal', color, glyph, (255, 250, 226))
    # Stable named aliases make UI/data consumers independent of numeric index.
    import shutil
    shutil.copyfile(os.path.join(A, f'rk_{n}.png'), os.path.join(A, f'rk_{label.lower()}.png'))
# named items: base family glyph, unique hue, rarity-coloured frame with sparkle
FAM = {'weapon': 'sword', 'armor': 'chest', 'wondrous': 'ring'}
BASEG = [('bow', 'bow'), ('yumi', 'bow'), ('axe', 'axe'), ('maul', 'fist'), ('trident', 'staff'), ('guandao', 'axe'), ('crozier', 'staff'), ('sceptre', 'staff'), ('rondel', 'sword'), ('kukri', 'sword'), ('shield', 'shield'),
         ('helm', 'helm'), ('kabuto', 'helm'), ('circlet', 'crown'), ('cloak', 'cloak'), ('tabard', 'banner'), ('pauldron', 'shield'), ('band', 'ring'), ('torc', 'amulet'), ('pendant', 'amulet'), ('amulet', 'amulet'), ('boots', 'boot'),
         ('gauntlet', 'glove'), ('vambrace', 'glove'), ('baldric', 'belt'), ('plate', 'chest'), ('mail', 'chest')]
for k, kind, base, rar in L['named']:
    h = int(hashlib.md5(k.encode()).hexdigest()[:4], 16) / 65535
    img = frame('tile', RAR[min(8, rar)])
    draw_glyph(img, pick_glyph(base, BASEG, FAM[kind]), hsv(h, 0.6, 0.95))
    for (x, y) in ((13, 2), (2, 13)): px(img, x, y, (255, 255, 230))
    save(f'nn_{k}', img)

# ---------------------------------------------------------------- the 4 newer classes: portraits + battle sheets
def tint(arr, col, amt):
    a = arr.astype(float); lum = (a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11)[..., None] / 255
    a[..., :3] = a[..., :3] * (1 - amt) + np.array(col) * (0.35 + lum * 0.9) * amt
    return np.clip(a, 0, 255).astype(np.uint8)
NEW = {'necromancer': ('arcanist', (110, 220, 120), 'skull'), 'summoner': ('cantor', (170, 110, 240), 'swirl'), 'sunwarden': ('vanguard', (255, 200, 60), 'sun'), 'runeblade': ('warden', (80, 220, 240), 'spiral')}
idx_path = os.path.join(A, 'nes_index.json'); INDEX = json.load(open(idx_path))
for cls, (base, col, emb) in NEW.items():
    src = os.path.join(A, f'np_class_{base}.png')
    if os.path.exists(src):
        a = tint(np.array(Image.open(src).convert('RGBA')), col, 0.5)
        em = blank(); draw_glyph(em, emb, col)                      # emblem in the top-left corner
        em = np.array(Image.fromarray(em, 'RGBA').resize((28, 28), Image.NEAREST)); h, w = em.shape[:2]
        reg = a[2:2 + h, 2:2 + w]; m = em[..., 3:4] > 0; reg[:] = np.where(m, em, reg)
        Image.fromarray(a, 'RGBA').save(os.path.join(A, f'np_class_{cls}.png')); count += 1
        if f'np_class_{cls}' not in INDEX['class_portrait']: INDEX['class_portrait'].append(f'np_class_{cls}')
    for i in range(6):
        s = os.path.join(A, f'c_{base}_{i}.png')
        if os.path.exists(s): save(f'c_{cls}_{i}', tint(np.array(Image.open(s).convert('RGBA')), col, 0.45))
json.dump(INDEX, open(idx_path, 'w'), indent=0)
print(f'generated {count} new 8-bit images')
