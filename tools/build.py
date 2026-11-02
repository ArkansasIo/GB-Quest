#!/usr/bin/env python3
"""Build GB Quest.
  index.html          -> dev version: loads src/*.js and assets/*.png (serve the folder over http)
  dist/gbquest.html   -> single self-contained file, every asset inlined as a data: URI
  assets/index.json   -> list of asset names for the dev build
"""
import base64, glob, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ['data_rules', 'data_world', 'gen', 'engine', 'rules', 'combat', 'systems', 'scenes_world', 'scenes_menu', 'main']
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf8').read()
shell = rd('src/shell.html')
names = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(ROOT, 'assets', '*.png')) if not os.path.basename(f).startswith(('device_mockup', 'bg_patterns')))
json.dump(names, open(os.path.join(ROOT, 'assets', 'index.json'), 'w'))
dev = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       + shell.replace('<main', '</head><body>\n<main', 1) + '\n' + ''.join(f'<script src="src/{n}.js"></script>\n' for n in ORDER) + '</body></html>\n')
open(os.path.join(ROOT, 'index.html'), 'w').write(dev)
assets = {n: 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', n + '.png'), 'rb').read()).decode() for n in names}
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
single = shell + '\n<script>window.GB_ASSETS=' + json.dumps(assets) + ';</script>\n' + ''.join(f'<script>\n{rd(f"src/{n}.js")}\n</script>\n' for n in ORDER)
open(os.path.join(ROOT, 'dist', 'gbquest.html'), 'w').write(single)
print('index.html + dist/gbquest.html (%d KB, %d assets)' % (len(single) // 1024, len(assets)))
