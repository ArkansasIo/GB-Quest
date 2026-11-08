#!/usr/bin/env python3
"""8-bit 16x16 icons for the profession perk trees (pp_<effect>.png).

Each icon is an ASCII mask: '.' transparent, 'o' outline, 'd' dark, 'm' mid, 'l' light, 'w' highlight.
"""
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')

PAL = {  # effect: (dark, mid, light)
    'double':  ((40, 110, 40), (80, 170, 60), (170, 225, 110)),
    'rare':    ((70, 40, 140), (130, 80, 220), (200, 170, 255)),
    'xp':      ((30, 70, 140), (60, 130, 210), (150, 200, 255)),
    'gold':    ((130, 80, 10), (220, 160, 30), (255, 225, 110)),
    'pxp':     ((140, 30, 30), (210, 70, 50), (255, 160, 120)),
    'respawn': ((20, 100, 100), (40, 170, 160), (140, 235, 220)),
    'check':   ((90, 60, 30), (160, 110, 60), (225, 185, 130)),
    'save':    ((60, 60, 80), (120, 125, 150), (200, 205, 225)),
    'extra':   ((150, 60, 10), (235, 120, 30), (255, 200, 110)),
}

MASKS = {
    'double': [  # two bundled sheaves
        '................',
        '...o......o.....',
        '..olo....olo....',
        '..olmo..olmo....',
        '...omo...omo....',
        '..olmmo.olmmo...',
        '..ommdo.ommdo...',
        '...odo...odo....',
        '..oomoo.oomoo...',
        '..owwlo.owwlo...',
        '...omo...omo....',
        '...omo...omo....',
        '...odo...odo....',
        '...odo...odo....',
        '....o.....o.....',
        '................'],
    'rare': [  # cut gem
        '................',
        '................',
        '....oooooooo....',
        '...owwllllmmo...',
        '..owllllmmmmdo..',
        '.oooooooooooooo.',
        '.olwlllmmmmmddo.',
        '..olllmmmmmddo..',
        '...olmmmmmddo...',
        '....olmmmddo....',
        '.....ommmdo.....',
        '......omdo......',
        '.......oo.......',
        '................',
        '..w.........w...',
        '................'],
    'xp': [  # open book
        '................',
        '................',
        '..ooooo..ooooo..',
        '.owwwwlooolllmo.',
        '.owdddlooldddmo.',
        '.owwwwlooolllmo.',
        '.owdddlooldddmo.',
        '.owwwwlooolllmo.',
        '.owdddlooldddmo.',
        '.owwwwlooolllmo.',
        '.oooooommoooooo.',
        '..oddddooddddo..',
        '...oooo..oooo...',
        '................',
        '................',
        '................'],
    'gold': [  # coin stack
        '................',
        '......oooo......',
        '....oowwllmo....',
        '...owlllllmmo...',
        '...oolllllmdo...',
        '...odooooooddo..',
        '...owlllllmmo...',
        '...oolllllmdo...',
        '...odooooooddo..',
        '...owlllllmmo...',
        '...oolllllmdo...',
        '...oddmmmmddo...',
        '....oooooooo....',
        '................',
        '................',
        '................'],
    'pxp': [  # rising star
        '................',
        '.......oo.......',
        '......owlo......',
        '......owlo......',
        '..oooowllmoooo..',
        '..owwwlllmmmmo..',
        '...owllllmmmo...',
        '....olllmmmo....',
        '....olmmmmdo....',
        '...olmmoommdo...',
        '...omdo..odmo...',
        '..oddo....oddo..',
        '..ooo......ooo..',
        '................',
        '................',
        '................'],
    'respawn': [  # circular arrows
        '................',
        '.....oooooo.....',
        '....owwlllmo....',
        '...olo....omo...',
        '..olo......oo...',
        '..olo....ooooo..',
        '..olo.....omo...',
        '..oo.......o....',
        '....o.......oo..',
        '...omo.....odo..',
        '..ooooo....odo..',
        '...oo......odo..',
        '...omo....odo...',
        '....ommmmmddo...',
        '.....oooooo.....',
        '................'],
    'check': [  # magnifying glass
        '................',
        '....oooooo......',
        '...owwlllmo.....',
        '..owllllllmo....',
        '..owlloolllmo...',
        '..olllllllmmo...',
        '..olllllllmmo...',
        '..ommlllllmdo...',
        '...ommmmmmdo....',
        '....oooooodoo...',
        '..........oddo..',
        '...........oddo.',
        '............odo.',
        '.............o..',
        '................',
        '................'],
    'save': [  # bound satchel
        '................',
        '.....oooooo.....',
        '....oo....oo....',
        '...oo......oo...',
        '..oooooooooooo..',
        '..owwlllllllmo..',
        '..olllllllllmo..',
        '..ooooooooooo...',
        '..olllloolllmo..',
        '..olllowwolllmo.',
        '..olllloollmmo..',
        '..ommmmmmmmmdo..',
        '..oddddddddddo..',
        '..oooooooooooo..',
        '................',
        '................'],
    'extra': [  # anvil spark
        '................',
        '....w.....w.....',
        '......w.w.......',
        '.....wwlww......',
        '......w.w.......',
        '....w.....w.....',
        '..oooooooooooo..',
        '.owwlllllllmmmo.',
        '..oolllllmmmdo..',
        '....oommmmddo...',
        '.....olmmmdo....',
        '....oolmmmdoo...',
        '...ommmmmmmddo..',
        '...oooooooooo...',
        '................',
        '................'],
}


def render(key):
    dark, mid, light = PAL[key]
    cols = {'o': (16, 16, 24, 255), 'd': dark + (255,), 'm': mid + (255,), 'l': light + (255,), 'w': (255, 255, 240, 255)}
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(MASKS[key]):
        for x, ch in enumerate(row.ljust(16, '.')[:16]):
            if ch in cols:
                im.putpixel((x, y), cols[ch])
    return im


if __name__ == '__main__':
    for k in MASKS:
        render(k).save(os.path.join(OUT, f'pp_{k}.png'))
    print(f'{len(MASKS)} perk icons written to assets/pp_*.png')
