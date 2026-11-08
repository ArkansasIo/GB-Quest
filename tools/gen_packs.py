#!/usr/bin/env python3
"""Turn the third-party pixel-art packs in art_source/packs/ into game art (pk_* sprites) and src/pack_index.js.

Packs (kept out of git; see CREDITS in docs/ART_PACKS.md):
  MiniWorldSprites            world objects, buildings, townsfolk walkers, monsters
  2D_Pixel_Dungeon_Asset_Pack dungeon tiles and dungeon monsters
  Assets (weapons/armour)     11-tier weapon, shield, armour, helmet and boot icons
  rpg_icon_pack               rings, gems, wands, keys, coins, spellbooks, potions
  Farm_Sim_Asset_Pack         polearms, crossbows, staves, potions
Output:
  assets/pk_*.png             every sprite the game uses (item icons keep 32x32; tiles and walkers are 16x16)
  src/pack_index.js           PACK_INDEX: item lists by art category, monster art by family, and sprite aliases
                              (old sprite name -> pk sprite) for world tiles, dungeon tiles and townsfolk
Run: python3 tools/gen_packs.py
"""
import json, os, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PK = os.path.join(ROOT, 'art_source', 'packs')
A = os.path.join(ROOT, 'assets')
MW = os.path.join(PK, 'MiniWorldSprites', 'MiniWorldSprites')
DG = os.path.join(PK, '2D_Pixel_Dungeon_Asset_Pack_v2.0', '2D Pixel Dungeon Asset Pack', 'character and tileset')
RPG = os.path.join(PK, 'rpg_icon_pack', 'rpg_icon_pack', 'individual 16x16')
FARM = os.path.join(PK, 'Farm_Sim_Asset_Pack')
WEAP = os.path.join(PK, 'Assets', 'Assets', 'Tileset', 'Assets.png')

index = {'items': {}, 'monsters': {}, 'alias': {}}
written = 0
def save(name, im):
    global written; im.save(os.path.join(A, name + '.png')); written += 1; return name
def load(p): return Image.open(p).convert('RGBA')
def cell(im, c, r, s=16): return im.crop((c * s, r * s, c * s + s, r * s + s))
def trim(im): bb = im.getbbox(); return im.crop(bb) if bb else im
def over(base, top):
    out = base.copy().convert('RGBA'); t = top.convert('RGBA')
    out.alpha_composite(t, ((out.width - t.width) // 2, out.height - t.height)); return out
def key_out_bg(im, tol=48):
    """JPG icons: make the corner colour transparent"""
    a = np.array(im.convert('RGBA')).astype(int); bg = np.median(np.array([a[0, 0, :3], a[0, -1, :3], a[-1, 0, :3], a[-1, -1, :3]]), axis=0)
    m = np.abs(a[..., :3] - bg).sum(axis=2) < tol; a[m, 3] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

# ---------------------------------------------------------------- items: lists by NES art category, ordered by tier
W = load(WEAP)  # 11 tiers (columns) x 10 kinds (rows) of 32x32 icons
ROWS = {0: 'mace', 1: 'sword', 3: 'dagger', 4: 'axe', 5: 'bow', 6: 'shield', 7: 'armor', 8: 'helmet', 9: 'boots'}
for r, cat in ROWS.items():
    index['items'][cat] = [save(f'pk_it_{cat}_{c}', cell(W, c, r, 32)) for c in range(11)]
for cat in ('lightarmor', 'mediumarmor', 'heavyarmor'): index['items'][cat] = index['items']['armor']
def farm(cat, names, folder='weapon asset pack'):
    out = []
    for i, n in enumerate(names):
        p = os.path.join(FARM, folder, n + '.png')
        if os.path.exists(p): out.append(save(f'pk_it_{cat}_{i}', load(p)))
    index['items'][cat] = out
farm('polearm', ['Hunter Spear', 'Knight Pike', 'Halberd of the Guard', 'Twin Javelins', 'Pole Hammer', 'Temple Trident', 'Grappling Harpoon', 'Dark Halberd', 'Reaper Scythe'])
farm('crossbow', ['Scout Crossbow', 'Hunter Crossbow', 'Siege Crossbow'])
farm('staff', ['Iron Staff', 'Ancient Rune Staff', 'Elemental Staff', 'Sun Priest Staff', 'Blood Mage Scepter'])
farm('potion', ['Crimson Health Elixir', 'Royal Medicine Flask', 'Azure Mana Potion', 'Bubbling Mana Draught', 'Earthroot Tonic', 'Elixir of Swiftness', 'Frostbite Potion',
                'Inferno Brew', 'Stormcaller Elixir', 'Sunflare Elixir', 'Elixir of Eternal Vitality', 'Spirit Bloom Potion', 'Potion of Liquid Shadow', 'Flask of Toxic Brew'], 'potion and poison asset pack')
def rpg(cat, stem, n):
    out = []
    for i in range(1, n + 1):
        p = os.path.join(RPG, f'{stem}_{i}.jpg')
        if os.path.exists(p): out.append(save(f'pk_it_{cat}_{i - 1}', key_out_bg(Image.open(p))))
    index['items'][cat] = out
rpg('ring', 'ring', 9); rpg('gem', 'magic_gem', 8); rpg('wand', 'magic_wand', 8); rpg('key', 'key', 4); rpg('currency', 'coins', 2); rpg('tome', 'spelbook', 16)

# ---------------------------------------------------------------- monsters by family (front-facing first frame, trimmed)
def big(im):
    """battle sprites are drawn at their own height: scale tiny pack sprites up (nearest) to about 40-56 px"""
    k = max(1, min(3, round(44 / max(1, im.height)))); return im.resize((im.width * k, im.height * k), Image.NEAREST)
def mw_front(rel, s=16):
    im = load(os.path.join(MW, 'Characters', rel)); return trim(cell(im, 0, 0, s))
FAM = {
    'dragon': [('Monsters/Dragons/' + d, 32) for d in ('RedDragon', 'BlueDragon', 'BlackDragon', 'WhiteDragon', 'YellowDragon')],
    'fiend': [('Monsters/Demons/' + d, 16) for d in ('RedDemon', 'PurpleDemon', 'ArmouredRedDemon')],
    'humanoid': [('Monsters/Orcs/' + d, 16) for d in ('Orc', 'OrcMage', 'OrcShaman', 'ClubGoblin', 'SpearGoblin', 'ArcherGoblin', 'FarmerGoblin', 'KamikazeGoblin')]
                + [('Monsters/Pirates/' + d, 16) for d in ('PirateCaptain', 'PirateGrunt', 'PirateGunner')],
    'giant': [('Monsters/Frostborn/Yeti', 16), ('Monsters/Frostborn/Wendigo', 16), ('Monsters/Frostborn/Mammoth', 32), ('Monsters/Orcs/Minotaur', 16)],
    'ooze': [('Monsters/Slimes/' + d, 16) for d in ('Slime', 'SlimeBlue')] + [('Monsters/Slimes/' + d, 16) for d in ('KingSlimeGreen', 'KingSlimeBlue', 'MegaSlimeGreen', 'MegaSlimeBlue')],
    'undead': [('Monsters/Undead/Skeleton-Soldier', 16), ('Monsters/Undead/Necromancer', 16)],
}
for fam, L in FAM.items():
    out = []
    for rel, s in L:
        p = os.path.join(MW, 'Characters', rel + '.png')
        if os.path.exists(p): out.append(save('pk_mon_' + rel.split('/')[-1].lower().replace('-', '_'), big(mw_front(rel + '.png', s))))
    index['monsters'][fam] = out
# dungeon pack monsters (first row of each pair is the idle frame)
DC = load(os.path.join(DG, 'Dungeon_Character.png'))
dmon = {'undead': [(0, 0, 'skelknight'), (5, 0, 'skeleton'), (6, 0, 'skelguard'), (2, 1, 'vampire'), (3, 1, 'ghoul'), (4, 1, 'mummy'), (5, 1, 'gravedigger')],
        'humanoid': [(3, 0, 'outlaw'), (4, 0, 'gunslinger'), (1, 0, 'cultist'), (2, 0, 'acolyte')], 'elemental': [(0, 1, 'wisp')]}
for fam, L in dmon.items():
    index['monsters'].setdefault(fam, []).extend(save(f'pk_mon_{n}', big(trim(cell(DC, c, r)))) for c, r, n in L)
# (animals and giant crabs are left out: one boar would stand in for every wolf, bear and serpent)

# ---------------------------------------------------------------- townsfolk walkers (down row 0, up row 1, side row 2 faces right)
NPC = {
    'guard': 'Soldiers/Melee/CyanMelee/SwordsmanCyan', 'warden': 'Soldiers/Melee/CyanMelee/SpearmanCyan', 'trainer': 'Soldiers/Melee/RedMelee/SwordsmanRed',
    'arenamaster': 'Soldiers/Melee/RedMelee/AssasinRed', 'trialsmaster': 'Soldiers/Melee/PurpleMelee/SwordsmanPurple', 'quartermaster': 'Soldiers/Melee/LimeMelee/SpearmanLime',
    'hunter': 'Soldiers/Ranged/LimeRanged/BowmanLime', 'oracle': 'Soldiers/Ranged/PurpleRanged/MagePurple', 'enchanter': 'Soldiers/Ranged/CyanRanged/MageCyan',
    'spirekeeper': 'Soldiers/Ranged/RedRanged/MageRed', 'alchemist': 'Soldiers/Ranged/LimeRanged/MageLime', 'farmer': 'Workers/LimeWorker/FarmerLime',
    'forester': 'Workers/CyanWorker/FarmerCyan', 'miner': 'Workers/RedWorker/FarmerRed', 'herbalist': 'Workers/LimeWorker/FarmerLime',
    'fisher': 'Workers/CyanWorker/FarmerCyan', 'dockhand': 'Workers/PurpleWorker/FarmerPurple', 'stablemaster': 'Workers/RedWorker/FarmerRed',
}
for role, rel in NPC.items():
    p = os.path.join(MW, 'Characters', rel + '.png')
    if not os.path.exists(p): continue
    im = load(p)
    for d, row in (('down', 0), ('up', 1), ('side', 2)):
        for f, col in ((0, 0), (1, 2)):
            index['alias'][f'gh_npc_{role}_{d}{f}'] = save(f'pk_npc_{role}_{d}{f}', cell(im, col, row))
    index['alias'][f'gh_npc_{role}_blink'] = f'pk_npc_{role}_down0'

# ---------------------------------------------------------------- world objects on each biome's own ground
N = lambda f: load(os.path.join(MW, 'Nature', f + '.png'))
TREES, PINES, WINTER, DEAD, PALM, CACTUS, ROCKS = N('Trees'), N('PineTrees'), N('WinterTrees'), N('DeadTrees'), N('CoconutTrees'), N('Cactus'), N('Rocks')
t = lambda im, c, r=0: cell(im, c, r)
BIOME_OBJ = {
    'meadow': dict(tree=t(TREES, 3), single=t(TREES, 1), pine=t(PINES, 1), dense=t(TREES, 2), rock=t(ROCKS, 0, 0)),
    'coast': dict(tree=t(PALM, 2), single=t(TREES, 1), pine=t(PINES, 1), dense=t(PALM, 4), rock=t(ROCKS, 0, 0)),
    'marsh': dict(tree=t(DEAD, 2), single=t(TREES, 2), pine=t(PINES, 1), dense=t(DEAD, 3), rock=t(ROCKS, 0, 1)),
    'jungle': dict(tree=t(PALM, 3), single=t(PALM, 2), pine=t(PALM, 5), dense=t(PALM, 4), rock=t(ROCKS, 0, 2)),
    'snow': dict(tree=t(WINTER, 3, 3), single=t(WINTER, 1, 3), pine=t(PINES, 2), dense=t(WINTER, 2, 3), rock=t(ROCKS, 0, 3)),
    'badlands': dict(tree=t(CACTUS, 0), single=t(CACTUS, 3), pine=t(DEAD, 2), dense=t(CACTUS, 2), rock=t(ROCKS, 1, 0)),
    'volcanic': dict(tree=t(DEAD, 3), single=t(DEAD, 2), pine=t(DEAD, 2), dense=t(DEAD, 3), rock=t(ROCKS, 2, 0)),
    'dusk': dict(tree=t(DEAD, 2), single=t(TREES, 1), pine=t(PINES, 1), dense=t(DEAD, 3), rock=t(ROCKS, 0, 0)),
}
B = lambda col, f: load(os.path.join(MW, 'Buildings', col, f'{col if col != "Wood" else ""}{f}.png'))
BCOL = {'meadow': 'Red', 'coast': 'Cyan', 'jungle': 'Lime', 'dusk': 'Purple', 'marsh': 'Wood', 'snow': 'Cyan', 'badlands': 'Wood', 'volcanic': 'Red', 'crystal': 'Purple'}
for b, objs in BIOME_OBJ.items():
    gp = os.path.join(A, f'gt_{b}_grass.png'); g = load(gp if os.path.exists(gp) else os.path.join(A, f'gt_{b}_ground.png'))
    for k, sprite in objs.items():
        if os.path.exists(os.path.join(A, f'gt_{b}_{k}.png')): index['alias'][f'gt_{b}_{k}'] = save(f'pk_gt_{b}_{k}', over(g, sprite))
for b, col in BCOL.items():
    gp = os.path.join(A, f'gt_{b}_ground.png'); g = load(gp)
    for k, f, c, r in (('house', 'Houses', 0, 0), ('inn', 'Taverns', 0, 0), ('shop', 'Market', 0, 0), ('temple', 'Chapels', 0, 0)):
        try: index['alias'][f'gt_{b}_{k}'] = save(f'pk_gt_{b}_{k}', over(g, cell(B(col, f), c, r)))
        except FileNotFoundError: pass

# ---------------------------------------------------------------- dungeon theme from the dungeon tileset
DT = load(os.path.join(DG, 'Dungeon_Tileset.png')); FLOOR = cell(DT, 2, 2)
DMAP = {'floor': (2, 2), 'floor2': (1, 6), 'wall': (2, 0), 'walltop': (8, 7), 'door': (6, 3), 'bars': (8, 3), 'down': (9, 3),
        'torch0': (0, 9, 1), 'torch1': (1, 9, 1), 'brazier0': (3, 9, 1), 'brazier1': (5, 9, 1), 'bones': (7, 7, 1), 'gold': (6, 8, 1), 'barrel': (0, 8, 1), 'altar': (4, 7, 1)}
for k, v in DMAP.items():
    tile = cell(DT, v[0], v[1]); tile = over(FLOOR, tile) if len(v) > 2 else tile
    index['alias'][f'gd_dungeon_{k}'] = save(f'pk_gd_dungeon_{k}', tile)

with open(os.path.join(ROOT, 'src', 'pack_index.js'), 'w') as fh:
    fh.write("'use strict';\n// GENERATED by tools/gen_packs.py from the third-party packs in art_source/packs (see docs/ART_PACKS.md). Do not edit.\n")
    fh.write('const PACK_INDEX = ' + json.dumps(index, separators=(',', ':')) + ';\n')
print(f'wrote {written} pk_ sprites, {len(index["alias"])} aliases, {sum(len(v) for v in index["items"].values())} item icons, {sum(len(v) for v in index["monsters"].values())} monsters')
