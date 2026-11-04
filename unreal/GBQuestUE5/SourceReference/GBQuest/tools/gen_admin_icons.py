#!/usr/bin/env python3
"""8-bit admin / GM icons (16x16) and the control-plane crest.
  assets/ad_<name>.png          in-game ADMIN CONTROL icons
  admin/assets/ad_<name>.png    64 px copies for the web control plane
  admin/assets/crest.png        128 px control-plane crest
and inlines them as data URIs into admin/controlplane.html between the ADMIN-ICONS markers."""
import base64, io, os, re
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
INK = (20, 16, 22, 255)
PAL = {'.': None, 'o': INK, 'g': (212, 172, 96, 255), 'G': (150, 112, 54, 255), 'w': (240, 232, 214, 255), 'r': (196, 52, 40, 255), 'R': (120, 26, 22, 255),
       'b': (70, 120, 220, 255), 'B': (34, 62, 130, 255), 'e': (70, 180, 90, 255), 'E': (36, 100, 52, 255), 's': (150, 156, 170, 255), 'S': (84, 88, 102, 255), 'p': (170, 110, 220, 255), 'k': (60, 44, 30, 255)}
ICONS = {
    'player': ['................', '.....oooooo.....', '....ogggggGo....', '....ogwwwwGo....', '....owowowGo....', '....owwwwwGo....', '.....oGGGGo.....', '....ooorrooo....', '...orrrrrrrRo...', '..orrrrrrrrrRo..', '..orrogggorrRo..', '..orrrrrrrrrRo..', '..oRRRRRRRRRRo..', '...oSo....oSo...', '...ooo....ooo...', '................'],
    'world': ['................', '.....oooooo.....', '...oobbbeebboo..', '..obbbeeeebbBo..', '..obeeeeebbbBo..', '.obbbeeebbbbbBo.', '.obbbbebbbeebBo.', '.obbbbbbbeeeeBo.', '.obbbbbbbeeebBo.', '.obeebbbbbeebBo.', '..obeeebbbbbBo..', '..obbeebbbbBBo..', '...oobbbbBBoo...', '.....oooooo.....', '................', '................'],
    'economy': ['................', '......oooo......', '....oogggGoo....', '...oggwggggGo...', '...ogwgggggGo...', '...ooggggGGoo...', '...oGooooooGo...', '...oggwgggggGo..', '...ogwggggggGo..', '...ooggggggGoo..', '...oGoooooooGo..', '...oggwgggggGo..', '...oGGGGGGGGGo..', '....ooooooooo...', '................', '................'],
    'chat': ['................', '................', '..oooooooooooo..', '.owwwwwwwwwwwso.', '.owwwwwwwwwwwso.', '.owoowoowoowwso.', '.owwwwwwwwwwwso.', '.owoowoowwwwwso.', '.owwwwwwwwwwwso.', '.osssssssssssSo.', '..oooooosoooooo.', '.......oso......', '........oo......', '................', '................', '................'],
    'realm': ['................', '....oooooooo....', '...osssssssSo...', '...osooooooSo...', '...osoeoeoeSo...', '...osooooooSo...', '...ossssssssSo..', '...osooooooSo...', '...osoboboSSo...', '...osooooooSo...', '...ossssssssSo..', '...osooooooSo...', '...oSSSSSSSSSo..', '...oooooooooo...', '....o......o....', '................'],
    'saves': ['................', '..ooooooooooo...', '..obbbbbbbbBBo..', '..obwwwwwwwbBo..', '..obwwwwwwwbBo..', '..obwwwwwwwbBo..', '..obbbbbbbbbBo..', '..obbsssssbbBo..', '..obbsooSsbbBo..', '..obbsooSsbbBo..', '..obbsssssbbBo..', '..oBBBBBBBBBBo..', '..ooooooooooooo.', '................', '................', '................'],
    'debug': ['................', '....o......o....', '.....o....o.....', '......oooo......', '.....oeeeEo.....', '..o.oeeeeeEo.o..', '...oeeoeeoeEo...', '..ooeeeeeeeEoo..', '.o.oeeoeeoeEo.o.', '...oeeeeeeeEo...', '..o.oeeeeeEo.o..', '.....oEEEEo.....', '......oooo......', '................', '................', '................'],
    'gm': ['................', '................', '..o...o..o...o..', '.ogo.ogooggo.ogo', '.oggoggggggoggo.', '.ogggggrgggggggo', '.oggggrrrgggggGo', '.ogggggrggggggGo', '.ogwgggggggwggGo', '.oggggggggggggGo', '.oGGGGGGGGGGGGGo', '.ooooooooooooooo', '................', '................', '................', '................'],
    'settings': ['................', '......oooo......', '...oo.ossSo.oo..', '..ossoossssossSo', '..ossssssssssSo.', '...osssoooossSo.', '.ooossoo..ossooo', '.ossssoo..osssSo', '.ossssoo..osssSo', '.ooossoo..ossooo', '...osssoooossSo.', '..ossssssssssSo.', '..ossoossssoossSo', '...oo.oSSSo.oo..', '......oooo......', '................'],
    'audit': ['................', '...ooooooooo....', '..okwwwwwwwkko..', '..owwoooowwwko..', '..owwwwwwwwwko..', '..owwooooowwko..', '..owwwwwwwwwko..', '..owwoooowwwko..', '..owwwwwwwwwko..', '..owwooowwwwko..', '..owwwwwwrrwko..', '..owwwwwwrrwko..', '..okkkkkkkkkko..', '...ooooooooooo..', '................', '................'],
    'permissions': ['................', '....oooooooo....', '...ogggggggGo...', '..oggwggggggGo..', '..oggwgggrrgGo..', '..oggwggrrrgGo..', '..ogggggrrrgGo..', '..ogggggggggGo..', '...oggggggggo...', '...ogggggggGo...', '....oggggggo....', '.....oggggo.....', '......oGGo......', '.......oo.......', '................', '................'],
    'overview': ['................', '................', '..o.............', '..o.........ee..', '..o........eeE..', '..o...bb...eeE..', '..o...bbB..eeE..', '..o.rrbbB..eeE..', '..o.rrbbB..eeE..', '..o.rrbbBpppeE..', '..o.rrbbBpppeE..', '..ooooooooooooo.', '................', '................', '................', '................'],
}


def render(rows, scale=1):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row.ljust(16, '.')[:16]):
            c = PAL.get(ch)
            if c: im.putpixel((x, y), c)
    return im.resize((16 * scale, 16 * scale), Image.NEAREST) if scale > 1 else im


def crest():
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    # shield
    for y in range(3, 29):
        half = 12 if y < 18 else max(1, 12 - (y - 18) * 1.1)
        for x in range(int(16 - half), int(16 + half)):
            edge = x in (int(16 - half), int(16 + half) - 1) or y in (3, 28)
            im.putpixel((x, y), INK if edge else ((128, 30, 26, 255) if (x < 16) else (96, 20, 18, 255)))
    g = render(ICONS['gm'])
    im.alpha_composite(g, (8, 6))
    for x in range(9, 23): im.putpixel((x, 22), (212, 172, 96, 255))
    return im.resize((128, 128), Image.NEAREST)


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'admin', 'assets'), exist_ok=True)
    uris = {}
    for name, rows in ICONS.items():
        render(rows).save(os.path.join(ROOT, 'assets', f'ad_{name}.png'))
        big = render(rows, 4); big.save(os.path.join(ROOT, 'admin', 'assets', f'ad_{name}.png'))
        buf = io.BytesIO(); render(rows, 2).save(buf, 'PNG'); uris[name] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    uris['players'] = uris['player']
    c = crest(); c.save(os.path.join(ROOT, 'admin', 'assets', 'crest.png'))
    buf = io.BytesIO(); c.resize((64, 64), Image.NEAREST).save(buf, 'PNG'); uris['crest'] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    css = '\n'.join(f'.ic-{k} {{ background-image: url({v}); }}' for k, v in uris.items())
    path = os.path.join(ROOT, 'admin', 'controlplane.html')
    html = open(path).read()
    block = f'<style id="admin-icons">/* ADMIN-ICONS (generated by tools/gen_admin_icons.py) */\n{css}\n</style>'
    if 'id="admin-icons"' in html: html = re.sub(r'<style id="admin-icons">.*?</style>', lambda m: block, html, flags=re.S)
    else: html = html.replace('</head>', block + '\n</head>', 1)
    open(path, 'w').write(html)
    print(len(ICONS), 'admin icons + crest; inlined into admin/controlplane.html')
