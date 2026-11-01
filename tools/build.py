#!/usr/bin/env python3
"""Build GB Quest.
  index.html          -> dev version, loads src/*.js and assets/*.png (serve the folder with any static server)
  dist/gbquest.html   -> single self-contained file, every asset inlined as a data: URI
"""
import base64, glob, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf8').read()
shell, data, game = rd('src/shell.html'), rd('src/data.js'), rd('src/game.js')

dev = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' \
      + shell.replace('<main', '</head><body>\n<main', 1) \
      + '\n<script src="src/data.js"></script>\n<script src="src/game.js"></script>\n</body></html>\n'
open(os.path.join(ROOT, 'index.html'), 'w').write(dev)

assets = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'assets', '*.png'))):
    n = os.path.basename(f)[:-4]
    if n in ('device_mockup', 'bg_patterns'): continue   # sliced but not used in-game
    assets[n] = 'data:image/png;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
single = shell + '\n<script>window.GB_ASSETS=' + json.dumps(assets) + ';</script>\n<script>\n' + data + '\n</script>\n<script>\n' + game + '\n</script>\n'
open(os.path.join(ROOT, 'dist', 'gbquest.html'), 'w').write(single)
print('index.html + dist/gbquest.html (%d KB, %d assets)' % (len(single) // 1024, len(assets)))
