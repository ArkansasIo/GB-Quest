#!/usr/bin/env python3
"""300 original creatures: 100 three-stage evolution lines across the 14 5e creature types.

Each line is an original redesign of a classic fantasy archetype (described generically, no
non-SRD names). Outputs:
  assets/cc_<id>.png        32x32 8-bit creature-collector sprites (bold outline, big eyes, 3-tone shading)
  src/creatures.js          generated data appended to the bestiary
  assets_preview/creatures.png  contact sheet
"""
import json, os, random, math
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
ASSETS = os.path.join(ROOT, 'assets')

# (type, family key, [(root, archetype, plan, element, damage, resist, role, [s1, s2, s3 suffixes])])
LINES = {
 'beast': [
  ('GLOAM', 'dire wolf', 'quad', 'shadow', 'piercing', None, 'pack', ['PUP', 'FANG', 'HOWL']),
  ('BRISTL', 'giant boar', 'quad', 'earth', 'piercing', None, 'brute', ['ET', 'TUSK', 'HOG']),
  ('SKREE', 'giant hawk', 'bird', 'wind', 'slashing', None, 'swift', ['LET', 'WING', 'TALON']),
  ('MOSSA', 'giant tortoise', 'quad', 'nature', 'bludgeoning', 'piercing', 'guard', ['BIT', 'SHELL', 'DOME']),
  ('PRICKL', 'giant porcupine', 'blob', 'nature', 'piercing', None, 'skirm', ['Y', 'QUILL', 'SPIRE']),
  ('FENNI', 'desert fox', 'quad', 'fire', 'piercing', None, 'swift', ['K', 'DUNE', 'BLAZE']),
  ('URSA', 'cave bear', 'biped', 'earth', 'slashing', None, 'brute', ['CUB', 'MAUL', 'KING']),
  ('CRAGG', 'giant crab', 'insect', 'water', 'bludgeoning', 'slashing', 'guard', ['LING', 'CLAW', 'TITAN']),
  ('NOCTO', 'giant owl', 'bird', 'shadow', 'slashing', None, 'swift', ['HOOT', 'WATCH', 'SAGE']),
  ('STAGG', 'great elk', 'quad', 'nature', 'piercing', None, 'brute', ['LET', 'HORN', 'LORD']),
 ],
 'humanoid': [
  ('GOBBL', 'goblin raider', 'biped', 'earth', 'slashing', None, 'skirm', ['IN', 'NAB', 'BOSS']),
  ('TUSKA', 'orc warrior', 'biped', 'fire', 'slashing', None, 'brute', ['RUNT', 'BRAVE', 'WARLORD']),
  ('KOBO', 'kobold trapper', 'biped', 'fire', 'piercing', None, 'skirm', ['LD', 'TRAP', 'SCALE']),
  ('FENNA', 'lizardfolk hunter', 'biped', 'water', 'piercing', None, 'skirm', ['K', 'SPEAR', 'CHIEF']),
  ('HEXA', 'hedge witch', 'biped', 'shadow', 'necrotic', None, 'caster', ['KIT', 'CURSE', 'CROWN']),
  ('GNOLLA', 'hyena-folk', 'biped', 'earth', 'piercing', None, 'pack', ['PUP', 'CACKLE', 'PACKLORD']),
 ],
 'undead': [
  ('RATTL', 'skeleton', 'biped', 'shadow', 'slashing', 'piercing', 'guard', ['ING', 'BONE', 'KNIGHT']),
  ('SHAMB', 'zombie', 'biped', 'poison', 'bludgeoning', 'poison', 'brute', ['LE', 'ROT', 'HULK']),
  ('WISPEL', 'will-o-wisp', 'floater', 'light', 'lightning', None, 'caster', ['', 'GLOW', 'BEACON']),
  ('MOURN', 'banshee', 'ghost', 'shadow', 'psychic', 'necrotic', 'caster', ['LING', 'WAIL', 'QUEEN']),
  ('GHAST', 'ghoul', 'biped', 'poison', 'slashing', None, 'skirm', ['LY', 'GNAW', 'FEAST']),
  ('SHADE', 'shadow', 'ghost', 'shadow', 'necrotic', 'necrotic', 'skirm', ['LET', 'VEIL', 'NIGHT']),
  ('CRYPT', 'mummy', 'golem', 'sand', 'bludgeoning', 'necrotic', 'guard', ['KIN', 'WRAP', 'PHARAOH']),
 ],
 'fiend': [
  ('IMPLE', 'imp', 'biped', 'fire', 'fire', 'fire', 'skirm', ['T', 'HORN', 'DUKE']),
  ('CINDR', 'hell hound', 'quad', 'fire', 'fire', 'fire', 'pack', ['PUP', 'HOUND', 'MAW']),
  ('QUASI', 'quasit', 'biped', 'shadow', 'poison', None, 'skirm', ['T', 'CLAW', 'TYRANT']),
  ('NIGHTM', 'nightmare steed', 'quad', 'fire', 'fire', 'fire', 'brute', ['ARE', 'STEED', 'HOOF']),
  ('BRIMS', 'lemure-like blob fiend', 'blob', 'fire', 'fire', 'fire', 'brute', ['LET', 'TONE', 'MOLTEN']),
  ('SULFU', 'bat-winged fiend', 'bird', 'fire', 'fire', 'fire', 'swift', ['R', 'WING', 'SCOURGE']),
  ('GLUTTO', 'fiend of hunger', 'blob', 'poison', 'acid', 'poison', 'brute', ['N', 'MAW', 'GORGE']),
 ],
 'fey': [
  ('PIXI', 'sprite', 'floater', 'nature', 'psychic', None, 'caster', ['E', 'GLIM', 'QUEEN']),
  ('THISTL', 'thorn dryad', 'plant', 'nature', 'piercing', None, 'caster', ['E', 'THORN', 'MATRON']),
  ('BLINKA', 'blink dog', 'quad', 'arcane', 'piercing', None, 'swift', ['PUP', 'SHIFT', 'PHASE']),
  ('SATYR', 'satyr piper', 'biped', 'nature', 'psychic', None, 'caster', ['KIN', 'PIPE', 'REVEL']),
  ('MOTHA', 'moth fairy', 'insect', 'light', 'psychic', None, 'caster', ['', 'DUST', 'LUNA']),
  ('HAGGL', 'sea hag', 'biped', 'water', 'necrotic', None, 'caster', ['ET', 'BRINE', 'CROWN']),
  ('FAWNA', 'unicorn foal', 'quad', 'light', 'radiant', 'radiant', 'guard', ['', 'HORN', 'ROYAL']),
 ],
 'elemental': [
  ('EMBRA', 'fire elemental', 'floater', 'fire', 'fire', 'fire', 'caster', ['', 'FLARE', 'INFERNO']),
  ('TIDAL', 'water elemental', 'blob', 'water', 'cold', 'cold', 'brute', ['ET', 'WAVE', 'SURGE']),
  ('GALEO', 'air elemental', 'ghost', 'wind', 'lightning', None, 'swift', ['N', 'GUST', 'CYCLONE']),
  ('PEBBL', 'earth elemental', 'golem', 'earth', 'bludgeoning', 'piercing', 'guard', ['ET', 'BOULDER', 'MOUNTAIN']),
  ('FROSTI', 'ice mephit', 'biped', 'ice', 'cold', 'cold', 'skirm', ['K', 'SHARD', 'GLACIER']),
  ('ZAPPL', 'storm mephit', 'floater', 'storm', 'lightning', 'lightning', 'caster', ['E', 'VOLT', 'TEMPEST']),
  ('MAGMO', 'magma mephit', 'blob', 'fire', 'fire', 'fire', 'brute', ['T', 'LAVA', 'CALDERA']),
  ('DUSTY', 'dust devil', 'ghost', 'sand', 'slashing', None, 'swift', ['', 'TWIST', 'SIMOOM']),
 ],
 'construct': [
  ('COGLI', 'clockwork servant', 'golem', 'metal', 'bludgeoning', 'poison', 'guard', ['N', 'GEAR', 'ENGINE']),
  ('GARGO', 'gargoyle', 'bird', 'earth', 'slashing', 'piercing', 'guard', ['YL', 'STONE', 'SPIRE']),
  ('ANIMA', 'animated armor', 'biped', 'metal', 'slashing', 'poison', 'guard', ['HELM', 'PLATE', 'BASTION']),
  ('BRASS', 'brass homunculus', 'biped', 'metal', 'fire', 'poison', 'skirm', ['LET', 'WORK', 'TITAN']),
  ('RUNIC', 'rune golem', 'golem', 'arcane', 'force', 'poison', 'brute', ['A', 'GLYPH', 'COLOSSUS']),
  ('CLAYM', 'clay golem', 'golem', 'earth', 'bludgeoning', 'acid', 'brute', ['ITE', 'MOLD', 'KILN']),
  ('SCARA', 'clockwork beetle', 'insect', 'metal', 'piercing', 'poison', 'swift', ['B', 'SHELL', 'DYNAMO']),
 ],
 'dragon': [
  ('WYRML', 'red dragon wyrmling', 'dragon', 'fire', 'fire', 'fire', 'brute', ['ET', 'SCORCH', 'SOVEREIGN']),
  ('AZURI', 'blue dragon wyrmling', 'dragon', 'storm', 'lightning', 'lightning', 'brute', ['N', 'THUNDER', 'EMPRESS']),
  ('VERDI', 'green dragon wyrmling', 'dragon', 'poison', 'poison', 'poison', 'caster', ['N', 'VENOM', 'MONARCH']),
  ('RIMEL', 'white dragon wyrmling', 'dragon', 'ice', 'cold', 'cold', 'brute', ['ET', 'FROST', 'TYRANT']),
  ('NOXI', 'black dragon wyrmling', 'dragon', 'shadow', 'acid', 'acid', 'skirm', ['N', 'MIRE', 'DREAD']),
  ('AURIC', 'gold dragon wyrmling', 'dragon', 'light', 'fire', 'fire', 'guard', ['LET', 'SUN', 'ASCENDANT']),
  ('DRAKI', 'wyvern', 'bird', 'poison', 'poison', None, 'swift', ['N', 'STING', 'SKYREAVER']),
  ('SERPA', 'sea serpent', 'serpent', 'water', 'piercing', 'cold', 'brute', ['NT', 'COIL', 'LEVIATHAN']),
 ],
 'giant': [
  ('OGRI', 'ogre', 'biped', 'earth', 'bludgeoning', None, 'brute', ['N', 'CLUB', 'WARCHIEF']),
  ('TROLLO', 'troll', 'biped', 'nature', 'slashing', None, 'brute', ['P', 'REND', 'REGENT']),
  ('HILLO', 'hill giant', 'golem', 'earth', 'bludgeoning', None, 'brute', ['CK', 'KNOLL', 'SUMMIT']),
  ('FROSTGA', 'frost giant', 'biped', 'ice', 'cold', 'cold', 'brute', ['RD', 'JARL', 'WINTERKING']),
  ('CYCLO', 'cyclops', 'biped', 'earth', 'bludgeoning', None, 'brute', ['PS', 'EYE', 'COLOSSUS']),
  ('STORMG', 'storm giant', 'biped', 'storm', 'lightning', 'lightning', 'caster', ['ALE', 'THUNDER', 'SKYLORD']),
 ],
 'ooze': [
  ('GLOBB', 'gray ooze', 'blob', 'poison', 'acid', 'acid', 'brute', ['LET', 'SLOSH', 'DELUGE']),
  ('CUBEL', 'gelatinous cube', 'golem', 'water', 'acid', 'acid', 'guard', ['ET', 'JELL', 'MONOLITH']),
  ('PUDDA', 'black pudding', 'blob', 'shadow', 'acid', 'acid', 'brute', ['', 'SPLAT', 'ABYSS']),
  ('JELLI', 'ochre jelly', 'blob', 'sand', 'acid', 'lightning', 'skirm', ['', 'GOOP', 'MIRE']),
  ('MYCOS', 'slime mold', 'blob', 'nature', 'poison', 'poison', 'caster', ['PORE', 'SPORE', 'BLOOM']),
  ('QUICKS', 'mercury ooze', 'blob', 'metal', 'acid', 'slashing', 'swift', ['ILVER', 'SHINE', 'MIRROR']),
 ],
 'aberration': [
  ('OCULI', 'floating eye tyrant', 'floater', 'arcane', 'psychic', None, 'caster', ['', 'GAZE', 'OVERSEER']),
  ('TENTA', 'tentacled horror', 'floater', 'shadow', 'bludgeoning', None, 'brute', ['CLE', 'GRASP', 'KRAKEN']),
  ('CHUUL', 'river lurker', 'insect', 'water', 'bludgeoning', 'poison', 'guard', ['ET', 'PINCER', 'DEEPKING']),
  ('GIBBER', 'gibbering mouther', 'blob', 'shadow', 'psychic', None, 'brute', ['LET', 'BABBLE', 'CHORUS']),
  ('BRAINA', 'brain-eater', 'floater', 'arcane', 'psychic', 'psychic', 'caster', ['', 'MIND', 'HIVEMIND']),
  ('OTYGO', 'sewer otyugh', 'blob', 'poison', 'piercing', 'poison', 'brute', ['', 'GRIME', 'GLUTTON']),
  ('STARSP', 'star spawn', 'ghost', 'arcane', 'psychic', 'cold', 'caster', ['ORE', 'SPAWN', 'VOIDLORD']),
 ],
 'monstrosity': [
  ('OWLBE', 'owlbear', 'biped', 'nature', 'slashing', None, 'brute', ['AR', 'CLAW', 'TITAN']),
  ('GRIFFI', 'griffon', 'dragon', 'wind', 'slashing', None, 'swift', ['N', 'TALON', 'EMPYREAN']),
  ('BASILI', 'basilisk', 'quad', 'earth', 'poison', None, 'guard', ['K', 'STARE', 'PETRIFEX']),
  ('MANTI', 'manticore', 'quad', 'fire', 'piercing', None, 'brute', ['CUB', 'SPIKE', 'KING']),
  ('ARACH', 'giant spider', 'insect', 'poison', 'poison', 'poison', 'venom', ['NA', 'WEAVE', 'BROODQUEEN']),
  ('HYDRAL', 'hydra', 'serpent', 'water', 'piercing', None, 'brute', ['ING', 'HEADS', 'MULTIHEAD']),
  ('MIMIK', 'mimic', 'golem', 'metal', 'bludgeoning', 'acid', 'skirm', ['IT', 'CHEST', 'VAULT']),
  ('COCKA', 'cockatrice', 'bird', 'earth', 'piercing', None, 'skirm', ['CHICK', 'CROW', 'STONEBEAK']),
 ],
 'plant': [
  ('SPRIGG', 'twig blight', 'plant', 'nature', 'piercing', 'piercing', 'skirm', ['Y', 'BRANCH', 'GROVE']),
  ('VINEA', 'assassin vine', 'serpent', 'nature', 'bludgeoning', None, 'venom', ['', 'LASH', 'STRANGLER']),
  ('SHROOMI', 'myconid', 'plant', 'poison', 'poison', 'poison', 'caster', ['', 'CAP', 'SOVEREIGN']),
  ('BULBA', 'flytrap', 'plant', 'nature', 'acid', None, 'brute', ['', 'SNAP', 'DEVOURER']),
  ('TREANT', 'treant', 'golem', 'nature', 'bludgeoning', 'bludgeoning', 'guard', ['LING', 'BARK', 'ELDERWOOD']),
  ('CACTU', 'cactus walker', 'plant', 'sand', 'piercing', None, 'guard', ['S', 'NEEDLE', 'SAGUARO']),
  ('LILIA', 'water lily nymph', 'plant', 'water', 'cold', None, 'caster', ['', 'PAD', 'LOTUS']),
 ],
 'celestial': [
  ('LUMEN', 'lantern spirit', 'floater', 'light', 'radiant', 'radiant', 'caster', ['', 'GLOW', 'SOLAR']),
  ('PEGA', 'pegasus', 'dragon', 'light', 'bludgeoning', 'radiant', 'swift', ['FOAL', 'SUS', 'STARWING']),
  ('CHERU', 'winged guardian', 'bird', 'light', 'radiant', 'radiant', 'guard', ['B', 'WARD', 'SERAPH']),
  ('AURORA', 'couatl', 'serpent', 'light', 'radiant', 'radiant', 'caster', ['', 'COIL', 'PLUMESERPENT']),
  ('HALOA', 'deva', 'biped', 'light', 'radiant', 'radiant', 'caster', ['', 'HALO', 'ARCHON']),
  ('KIRIN', 'ki-rin', 'quad', 'storm', 'lightning', 'radiant', 'guard', ['', 'THUNDER', 'HEAVENLY']),
 ],
}

# palettes: element -> (base, light, dark, accent)
ELEM = {
 'fire': ((228, 92, 40), (255, 178, 90), (140, 40, 30), (255, 230, 90)),
 'water': ((60, 130, 220), (140, 200, 255), (30, 60, 130), (230, 250, 255)),
 'ice': ((150, 210, 240), (230, 248, 255), (70, 120, 170), (255, 255, 255)),
 'storm': ((120, 110, 220), (190, 180, 255), (60, 50, 130), (255, 240, 90)),
 'earth': ((160, 120, 70), (215, 180, 120), (95, 65, 40), (120, 180, 70)),
 'nature': ((80, 170, 70), (170, 225, 110), (40, 95, 45), (240, 120, 160)),
 'poison': ((140, 80, 180), (200, 150, 230), (70, 35, 100), (170, 230, 80)),
 'shadow': ((80, 70, 110), (140, 125, 175), (35, 30, 55), (220, 70, 90)),
 'light': ((245, 220, 120), (255, 250, 210), (180, 140, 60), (255, 255, 255)),
 'wind': ((170, 210, 200), (230, 250, 240), (90, 140, 140), (255, 255, 255)),
 'arcane': ((190, 90, 210), (240, 170, 250), (100, 40, 130), (110, 230, 255)),
 'metal': ((150, 160, 175), (215, 222, 232), (80, 88, 105), (230, 190, 70)),
 'sand': ((215, 180, 110), (245, 225, 170), (150, 115, 60), (200, 90, 50)),
}
OUT = (24, 20, 30, 255)
WHITE = (255, 255, 255, 255)


class Canvas:
    def __init__(self, n=32):
        self.n = n
        self.m = [[None] * n for _ in range(n)]  # None or 'b','l','d','a','w','k' (body/light/dark/accent/white/black)

    def put(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.n and 0 <= y < self.n:
            self.m[y][x] = c

    def ellipse(self, cx, cy, rx, ry, c='b', shade=True):
        for y in range(self.n):
            for x in range(self.n):
                dx, dy = (x + 0.5 - cx) / max(rx, 0.5), (y + 0.5 - cy) / max(ry, 0.5)
                d = dx * dx + dy * dy
                if d <= 1:
                    if shade and c == 'b':
                        # light from top-left
                        s = (dx * 0.7 + dy * 0.9)
                        self.m[y][x] = 'l' if s < -0.55 else 'd' if s > 0.55 else 'b'
                    else:
                        self.m[y][x] = c

    def rect(self, x0, y0, x1, y1, c='b', shade=True):
        for y in range(max(0, int(y0)), min(self.n, int(y1) + 1)):
            for x in range(max(0, int(x0)), min(self.n, int(x1) + 1)):
                if shade and c == 'b':
                    self.m[y][x] = 'l' if (y == int(y0) or x == int(x0)) else 'd' if (y == int(y1) or x == int(x1)) else 'b'
                else:
                    self.m[y][x] = c

    def line(self, x0, y0, x1, y1, c='d', w=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for ox in range(w):
                for oy in range(w):
                    self.put(x + ox - w // 2, y + oy - w // 2, c)

    def tri(self, pts, c='a'):
        (x0, y0), (x1, y1), (x2, y2) = pts
        for y in range(self.n):
            for x in range(self.n):
                px, py = x + 0.5, y + 0.5
                d1 = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1)
                d2 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)
                d3 = (px - x0) * (y2 - y0) - (x2 - x0) * (py - y0)
                neg = d1 < 0 or d2 < 0 or d3 < 0
                pos = d1 > 0 or d2 > 0 or d3 > 0
                if not (neg and pos):
                    self.m[y][x] = c

    def eyes(self, cx, cy, gap, size, rnd, style):
        for sx in (-1, 1):
            ex = cx + sx * gap
            if style == 'cyclops' and sx == 1:
                continue
            if style == 'cyclops':
                ex = cx
            r = size + (1 if style == 'cyclops' else 0)
            self.ellipse(ex, cy, r, r + 0.3, 'w', shade=False)
            self.ellipse(ex + 0.3 * sx * (0 if style == 'cyclops' else 1), cy + 0.4, max(0.8, r * 0.55), max(1.0, r * 0.7), 'k', shade=False)
            self.put(ex - 0.6, cy - 0.8, 'w')
            if style == 'angry':
                self.line(ex - r, cy - r - 0.5 + (0 if sx < 0 else 1), ex + r, cy - r - 0.5 + (1 if sx < 0 else 0), 'k')

    def mirror(self):
        h = self.n // 2
        for y in range(self.n):
            for x in range(h):
                if self.m[y][x] is not None:
                    self.m[y][self.n - 1 - x] = self.m[y][x] if self.m[y][x] not in ('l',) else 'b'

    def render(self, pal):
        base, light, dark, acc = pal
        col = {'b': base, 'l': light, 'd': dark, 'a': acc, 'w': WHITE[:3], 'k': OUT[:3], 'p': tuple(min(255, c + 60) for c in base)}
        im = Image.new('RGBA', (self.n, self.n), (0, 0, 0, 0))
        filled = [[self.m[y][x] is not None for x in range(self.n)] for y in range(self.n)]
        for y in range(self.n):
            for x in range(self.n):
                c = self.m[y][x]
                if c is not None:
                    im.putpixel((x, y), col[c] + (255,))
                else:  # outline: any 4-neighbour filled
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.n and 0 <= ny < self.n and filled[ny][nx]:
                            im.putpixel((x, y), OUT)
                            break
        return im


def draw(plan, stage, rnd, elem):
    c = Canvas()
    k = [0.66, 0.84, 1.0][stage]   # stage size
    cx, ground = 16, 30
    eye = rnd.choice(['round', 'round', 'angry', 'cyclops']) if plan in ('floater', 'blob', 'golem') else rnd.choice(['round', 'round', 'angry'])
    if plan == 'floater' and rnd.random() < 0.5:
        eye = 'cyclops'
    horns = stage >= 1 and rnd.random() < 0.7
    spikes = stage == 2
    belly = rnd.random() < 0.7

    def head_feats(hx, hy, hr):
        if horns:
            hh = 3 + stage * 2
            c.tri([(hx - hr * 0.6, hy - hr * 0.5), (hx - hr * 0.2, hy - hr * 0.8), (hx - hr * 0.8, hy - hr - hh)], 'a')
            c.tri([(hx + hr * 0.6, hy - hr * 0.5), (hx + hr * 0.2, hy - hr * 0.8), (hx + hr * 0.8, hy - hr - hh)], 'a')
        c.eyes(hx, hy, hr * 0.42, max(1.2, hr * 0.26), rnd, eye)

    if plan == 'blob':
        rx, ry = 10 * k, 8.5 * k
        cy = ground - ry
        if spikes:
            for i in range(5):
                a = math.pi * (0.15 + 0.175 * i)
                c.tri([(cx + math.cos(a) * rx * 0.7 - 2, cy - math.sin(a) * ry * 0.7), (cx + math.cos(a) * rx * 0.7 + 2, cy - math.sin(a) * ry * 0.7), (cx + math.cos(a) * (rx + 4), cy - math.sin(a) * (ry + 4))], 'a')
        c.ellipse(cx, cy, rx, ry)
        if belly: c.ellipse(cx, cy + ry * 0.35, rx * 0.55, ry * 0.4, 'p', shade=False)
        c.eyes(cx, cy - ry * 0.15, rx * 0.38, max(1.3, rx * 0.2), rnd, eye)
        c.ellipse(cx - rx * 0.55, ground - 1, 2 * k + 0.5, 1.4, 'd', shade=False)
        c.ellipse(cx + rx * 0.55, ground - 1, 2 * k + 0.5, 1.4, 'd', shade=False)
        if horns: c.tri([(cx - 2, cy - ry + 1), (cx + 2, cy - ry + 1), (cx, cy - ry - 3 - stage * 2)], 'a')
    elif plan == 'biped':
        bh = 9 * k; hr = 6.2 * k
        by = ground - 3 * k - bh / 2 - 1
        c.rect(cx - 4 * k, ground - 4 * k, cx - 1.5 * k, ground - 1, 'd', shade=False)
        c.rect(cx + 1.5 * k, ground - 4 * k, cx + 4 * k, ground - 1, 'd', shade=False)
        c.ellipse(cx, by, 6 * k, bh / 2 + 1)
        if belly: c.ellipse(cx, by + 1, 3.5 * k, bh / 2 - 1, 'p', shade=False)
        c.line(cx - 6 * k, by - 2, cx - 9 * k, by + 3 * k, 'd', 2)
        c.line(cx + 6 * k, by - 2, cx + 9 * k, by + 3 * k, 'd', 2)
        if stage >= 1 and rnd.random() < 0.6:  # weapon / staff
            c.line(cx + 9 * k, by + 4 * k, cx + 11 * k, by - 8 * k, 'a', 1)
        hy = by - bh / 2 - hr + 2
        c.ellipse(cx, hy, hr, hr * 0.92)
        head_feats(cx, hy + 0.5, hr)
    elif plan in ('quad', 'dragon'):
        bw, bh = 10 * k, 6 * k
        by = ground - 4 * k - bh / 2
        for lx in (-bw * 0.6, -bw * 0.25, bw * 0.25, bw * 0.6):
            c.rect(cx + lx - 1, by + bh * 0.3, cx + lx + 1, ground - 1, 'd', shade=False)
        if plan == 'dragon' or stage == 2:
            wing = 6 + stage * 3
            c.tri([(cx - 2, by - bh * 0.4), (cx + 4, by - bh * 0.4), (cx - 4, by - bh * 0.4 - wing)], 'a')
            c.tri([(cx + 2, by - bh * 0.4), (cx + 8, by - bh * 0.4), (cx + 10, by - bh * 0.4 - wing)], 'a')
        c.line(cx + bw, by, cx + bw + 4 * k, by - 4 * k, 'b', 2)  # tail
        if elem == 'fire': c.ellipse(cx + bw + 4 * k, by - 5 * k, 1.6, 2.2, 'a', shade=False)
        c.ellipse(cx + 1, by, bw, bh)
        if belly: c.ellipse(cx + 1, by + bh * 0.4, bw * 0.6, bh * 0.35, 'p', shade=False)
        hr = 5.5 * k
        hx, hy = cx - bw * 0.75, by - bh * 0.7
        c.ellipse(hx, hy, hr, hr * 0.9)
        c.ellipse(hx - hr * 0.7, hy + hr * 0.35, hr * 0.45, hr * 0.35, 'p', shade=False)  # snout
        head_feats(hx + 0.5, hy - 0.5, hr)
    elif plan == 'bird':
        r = 7.5 * k; cy = ground - 3 - r
        c.rect(cx - 3, ground - 4, cx - 2, ground - 1, 'a', shade=False)
        c.rect(cx + 2, ground - 4, cx + 3, ground - 1, 'a', shade=False)
        span = 5 + stage * 4
        c.tri([(cx - r * 0.6, cy - 1), (cx - r * 0.6, cy + r * 0.6), (cx - r - span, cy - r * 0.6)], 'd')
        c.tri([(cx + r * 0.6, cy - 1), (cx + r * 0.6, cy + r * 0.6), (cx + r + span, cy - r * 0.6)], 'd')
        c.ellipse(cx, cy, r, r)
        if belly: c.ellipse(cx, cy + r * 0.35, r * 0.55, r * 0.45, 'p', shade=False)
        c.eyes(cx, cy - r * 0.2, r * 0.38, max(1.3, r * 0.22), rnd, eye)
        c.tri([(cx - 1.6, cy + r * 0.12), (cx + 1.6, cy + r * 0.12), (cx, cy + r * 0.12 + 3)], 'a')
        if horns:
            c.tri([(cx - 1, cy - r + 1), (cx + 1, cy - r + 1), (cx - 3, cy - r - 3 - stage)], 'a')
            c.tri([(cx + 1, cy - r + 1), (cx + 3, cy - r + 1), (cx + 3, cy - r - 4 - stage)], 'a')
    elif plan == 'floater':
        r = 8 * k; cy = 15
        n = 3 + stage
        for i in range(n):
            tx = cx - r * 0.7 + (r * 1.4) * i / max(1, n - 1)
            c.line(tx, cy + r * 0.6, tx + (1 if i % 2 else -1) * 1.5, cy + r + 4 + stage * 2, 'd', 2)
        if elem in ('fire', 'light', 'storm', 'arcane'):
            c.tri([(cx - r * 0.8, cy - r * 0.3), (cx - r * 0.2, cy - r * 0.8), (cx - r * 0.5, cy - r - 4 - stage * 2)], 'a')
            c.tri([(cx + r * 0.8, cy - r * 0.3), (cx + r * 0.2, cy - r * 0.8), (cx + r * 0.5, cy - r - 4 - stage * 2)], 'a')
            c.tri([(cx - 2, cy - r + 1), (cx + 2, cy - r + 1), (cx, cy - r - 6 - stage * 2)], 'a')
        c.ellipse(cx, cy, r, r)
        c.eyes(cx, cy - 0.5, r * 0.4, max(1.5, r * 0.24), rnd, eye)
        if spikes:
            for a in (0.6, 2.54):
                c.tri([(cx + math.cos(a) * r - 1, cy - math.sin(a) * r), (cx + math.cos(a) * r + 1, cy - math.sin(a) * r), (cx + math.cos(a) * (r + 5), cy - math.sin(a) * (r + 5))], 'a')
    elif plan == 'ghost':
        r = 8 * k; cy = 14
        c.ellipse(cx, cy, r, r)
        c.rect(cx - r + 1, cy, cx + r - 1, cy + r + 3, 'b')
        for i in range(4):
            x = cx - r + 1 + i * (2 * r - 2) / 3
            c.ellipse(x, cy + r + 3, 1.6, 2, None, shade=False) if False else None
            c.tri([(x - 1.5, cy + r + 2), (x + 1.5, cy + r + 2), (x + (2 if i % 2 else -2), cy + r + 6 + stage)], 'b')
        c.line(cx - r, cy + 1, cx - r - 3 - stage, cy + 4, 'd', 2)
        c.line(cx + r, cy + 1, cx + r + 3 + stage, cy + 4, 'd', 2)
        c.eyes(cx, cy - 0.5, r * 0.4, max(1.4, r * 0.24), rnd, eye)
        if horns: head_feats(cx, cy, r) if False else c.tri([(cx - 2, cy - r + 1), (cx + 2, cy - r + 1), (cx, cy - r - 3 - stage * 2)], 'a')
    elif plan == 'golem':
        w, h = 9 * k, 10 * k
        top = ground - h * 2 + 2
        c.rect(cx - w * 0.75, ground - h * 0.6, cx - w * 0.25, ground - 1, 'd', shade=False)
        c.rect(cx + w * 0.25, ground - h * 0.6, cx + w * 0.75, ground - 1, 'd', shade=False)
        c.rect(cx - w, top + h * 0.6, cx + w, ground - h * 0.5)
        c.rect(cx - w - 3 * k, top + h * 0.7, cx - w, top + h * 1.4, 'd', shade=False)
        c.rect(cx + w, top + h * 0.7, cx + w + 3 * k, top + h * 1.4, 'd', shade=False)
        c.rect(cx - w * 0.65, top, cx + w * 0.65, top + h * 0.7)
        c.rect(cx - w * 0.4, top + h * 0.95, cx + w * 0.4, top + h * 1.1, 'a', shade=False)  # rune / core
        c.eyes(cx, top + h * 0.35, w * 0.3, max(1.1, w * 0.13), rnd, eye)
        if spikes or horns:
            c.tri([(cx - w * 0.65, top + 1), (cx - w * 0.3, top + 1), (cx - w * 0.6, top - 3 - stage)], 'a')
            c.tri([(cx + w * 0.3, top + 1), (cx + w * 0.65, top + 1), (cx + w * 0.6, top - 3 - stage)], 'a')
    elif plan == 'serpent':
        r = 3.2 * k + 1
        pts = [(cx + 9 * k * math.sin(t * 1.3), ground - 2 - t * 4.2 * k) for t in [i * 0.5 for i in range(7)]]
        for i, (x, y) in enumerate(pts[:-1]):
            c.ellipse(x, y, r + 0.3 * (len(pts) - i) * k * 0.4, r * 0.9)
        hx, hy = pts[-1]
        hr = 4.6 * k + 1
        c.ellipse(hx, hy, hr, hr * 0.85)
        head_feats(hx, hy, hr)
        if stage == 2:  # frill
            c.tri([(hx - hr, hy), (hx - hr - 4, hy - 4), (hx - hr - 1, hy + 3)], 'a')
            c.tri([(hx + hr, hy), (hx + hr + 4, hy - 4), (hx + hr + 1, hy + 3)], 'a')
    elif plan == 'insect':
        r = 6.5 * k
        cy = ground - 4 - r * 0.7
        for i in range(3):
            lx = cx - r * 0.6 + i * r * 0.6
            c.line(lx, cy + 1, lx - 5 * k, ground - 1, 'k', 1)
            c.line(lx, cy + 1, lx + 5 * k, ground - 1, 'k', 1)
        c.ellipse(cx + r * 0.9, cy - 0.5, r, r * 0.75)
        if stage >= 1:
            c.ellipse(cx + 4, cy - r * 0.9, r * 0.8, r * 0.5, 'a', shade=False)  # wing / shell crest
        hx = cx - r * 0.8
        c.ellipse(hx, cy - 1, r * 0.75, r * 0.7)
        c.line(hx - 1, cy - r * 0.6, hx - 4, cy - r - 3, 'k', 1)
        c.line(hx + 1, cy - r * 0.6, hx + 2, cy - r - 4, 'k', 1)
        c.eyes(hx, cy - 1.5, r * 0.32, max(1.2, r * 0.2), rnd, eye)
        if spikes:
            c.tri([(hx - r * 0.7, cy + 1), (hx - r * 0.3, cy + 2), (hx - r - 3, cy + 4)], 'a')
    elif plan == 'plant':
        r = 7 * k
        cy = ground - 3 - r
        c.tri([(cx - 2, ground - 1), (cx - 10 * k, ground - 2), (cx - 4, ground - 6 * k)], 'd')
        c.tri([(cx + 2, ground - 1), (cx + 10 * k, ground - 2), (cx + 4, ground - 6 * k)], 'd')
        c.ellipse(cx, cy, r, r * 0.95)
        n = 4 + stage * 2
        for i in range(n):
            a = math.pi * (0.1 + 0.8 * i / max(1, n - 1))
            px, py = cx + math.cos(a) * (r + 1), cy - math.sin(a) * (r + 1)
            c.ellipse(px, py, 2.2 + stage * 0.4, 2.2 + stage * 0.4, 'a', shade=False)
        c.ellipse(cx, cy, r, r * 0.95)
        if belly: c.ellipse(cx, cy + r * 0.4, r * 0.5, r * 0.35, 'p', shade=False)
        c.eyes(cx, cy - 0.5, r * 0.4, max(1.3, r * 0.22), rnd, eye)
    return c


def build():
    os.makedirs(os.path.join(ROOT, 'assets_preview'), exist_ok=True)
    out, sprites = [], []
    li = 0
    for t, lines in LINES.items():
        for (root, arche, plan, elem, dmg, res, role, sufs) in lines:
            base = 1 + (li % 12) * 9 + (li // 12) * 3  # spread lines over the early and mid game
            for st in range(3):
                name = (root + sufs[st]).upper()[:12]
                cid = 'cc_' + name.lower()
                rnd = random.Random(f'{root}-{plan}-{st}')
                # keep each line's look consistent: seed traits from the root, size from the stage
                trnd = random.Random(root)
                c = draw(plan, st, trnd, elem)
                pal = ELEM[elem]
                if st == 2:  # final stage: richer accent
                    pal = (pal[0], pal[1], pal[2], ELEM['light'][3] if elem != 'light' else ELEM['fire'][1])
                im = c.render(pal)
                im.save(os.path.join(ASSETS, cid + '.png'))
                sprites.append(im)
                lo = base + [0, 18, 45][st]
                out.append({
                    'id': cid, 'name': name, 'type': t, 'line': root.lower(), 'stage': st + 1, 'archetype': arche,
                    'plan': plan, 'elem': elem, 'dt': dmg, 'res': [res] if res else [], 'role': role if st else ('swift' if role in ('pack', 'swift') else 'skirm' if role != 'caster' else 'caster'),
                    'minLvl': lo, 'maxLvl': (base + [30, 80, 720][st]),
                    'evolvesTo': ('cc_' + (root + sufs[st + 1]).lower()[:12]) if st < 2 else None,
                })
            li += 1
    # contact sheet
    cols = 30
    sheet = Image.new('RGBA', (cols * 34, ((len(sprites) + cols - 1) // cols) * 34), (238, 236, 225, 255))
    for i, im in enumerate(sprites):
        sheet.alpha_composite(im, ((i % cols) * 34 + 1, (i // cols) * 34 + 1))
    sheet.save(os.path.join(ROOT, 'assets_preview', 'creatures.png'))
    lore = {
        'aberration': 'Wrong-angled things from beyond the stars.', 'beast': 'Creatures of tooth and instinct.',
        'celestial': 'Messengers of the dawn lanterns.', 'construct': 'Made things that remember their makers.',
        'dragon': 'Proud wyrm-kin, ancient and hungry.', 'elemental': 'Living storm, stone, wave and flame.',
        'fey': 'Tricksters of the Thorn Court.', 'fiend': 'Ash-born things from the burning deep.',
        'giant': 'Huge folk of hill, frost and storm.', 'humanoid': 'Folk who walk the roads with blades.',
        'monstrosity': 'Beasts twisted into something more.', 'ooze': 'Hungry slimes that remember nothing.',
        'plant': 'Roots that learned to walk.', 'undead': 'The restless dead of AELMOOR.',
    }
    js = ['// GENERATED by tools/gen_creatures.py - do not edit by hand.',
          '// 300 original creatures in 100 three-stage evolution lines, one per classic fantasy archetype,',
          '// spread over all 14 creature types. Each joins the bestiary and the biome spawn tables by level.',
          'const CREATURES = ' + json.dumps(out, separators=(',', ':')) + ';',
          'const CREATURE_LORE = ' + json.dumps(lore) + ';',
          ]
    with open(os.path.join(ROOT, 'src', 'creatures.js'), 'w') as f:
        f.write('\n'.join(js) + '\n' + JS_TAIL)
    print(f'{len(out)} creatures, {len(sprites)} sprites -> assets/cc_*.png, src/creatures.js')


JS_TAIL = r"""
// type -> bestiary family key (same names as FAMILIES)
const CREATURE_FAM = t => (FAMILIES[t] ? t : 'beast');
const CREATURE_SPR_FALLBACK = { aberration: 'enemy_gazer', beast: 'enemy_bigbat', celestial: 'enemy_bat', construct: 'enemy_skeleton', dragon: 'enemy_lizard', elemental: 'enemy_imp', fey: 'enemy_bat', fiend: 'enemy_imp', giant: 'enemy_goblinking', humanoid: 'enemy_goblin', monstrosity: 'enemy_orc', ooze: 'enemy_slime', plant: 'enemy_zombie', undead: 'enemy_skeleton' };
(function addCreatures() {
  const start = BESTIARY.length;
  for (const c of CREATURES) {
    const fam = CREATURE_FAM(c.type);
    const b = { id: c.id, fam, sub: c.name, variant: '', name: c.name, spr: CREATURE_SPR_FALLBACK[c.type] || 'enemy_goblin', nspr: c.id, ccArt: c.id,
      dt: c.dt, res: c.res.slice(), role: c.role, rank: 'normal', minLvl: c.minLvl, maxLvl: c.maxLvl, stage: c.stage, line: c.line,
      evolvesTo: c.evolvesTo, archetype: c.archetype, elem: c.elem, collector: true };
    BESTIARY.push(b); BEAST_BY_ID[b.id] = b;
  }
  BESTIARY.forEach((b, i) => { if (i >= start) { b.no = i + 1; b.type = FAMILIES[b.fam].name; b.lore = `${CREATURE_LORE[CREATURES[i - start].type]} A redesign of the ${b.archetype}. Stage ${b.stage}${b.evolvesTo ? ', evolves into ' + BEAST_BY_ID[b.evolvesTo].name : ''}.`; } });
})();
"""

if __name__ == '__main__':
    build()
