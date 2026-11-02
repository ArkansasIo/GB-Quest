#!/usr/bin/env python3
"""Build GB Quest.
  index.html          -> dev version: loads src/*.js and assets/*.png (serve the folder over http)
  dist/gbquest.html   -> single self-contained file, every asset inlined as a data: URI
  dist/gbquest-fullscreen.html -> same game, LCD fills the window (full-screen toggle, overlay pad + chat)
  assets/index.json   -> list of asset names for the dev build
"""
import base64, glob, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ['data_rules', 'data_world', 'gen', 'rooms', 'engine', 'audio64', 'video64', 'rules', 'combat', 'mmorpg/systems/pvp', 'systems', 'art', 'scenes_menu', 'scenes_world', 'inventory', 'items', 'netlocal', 'main', 'debug']
import subprocess
subprocess.run(['python3', os.path.join(ROOT, 'tools', 'build_atlas.py')], check=True)
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf8').read()
nes = '<script>window.NES_INDEX=' + json.dumps(json.load(open(os.path.join(ROOT, 'assets', 'nes_index.json')))) + ';</script>\n'
shell = rd('src/shell.html')
names = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(ROOT, 'assets', '*.png')) if not os.path.basename(f).startswith(('device_mockup', 'bg_patterns')))
json.dump(names, open(os.path.join(ROOT, 'assets', 'index.json'), 'w'))
dev = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       + shell.replace('<aside', '</head><body>\n<aside', 1) + '\n' + nes + '<script>fetch("dist/atlas.html").then(r => r.text()).then(t => window.ATLAS_HTML = t).catch(() => {});</script>\n' + ''.join(f'<script src="src/{n}.js"></script>\n' for n in ORDER) + '</body></html>\n')
open(os.path.join(ROOT, 'index.html'), 'w').write(dev)
assets = {n: 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', n + '.png'), 'rb').read()).decode() for n in names}
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
atlas = '<script>window.ATLAS_HTML=' + json.dumps(rd('dist/atlas.html')).replace('</', '<\\/') + ';</script>\n'
single = shell + '\n<script>window.GB_ASSETS=' + json.dumps(assets) + ';</script>\n' + nes + atlas + ''.join(f'<script>\n{rd(f"src/{n}.js")}\n</script>\n' for n in ORDER)
open(os.path.join(ROOT, 'dist', 'gbquest.html'), 'w').write(single)
fs = rd('src/fullscreen.html')
full = single.replace('<title>Shadowbane Chronicles</title>', '<title>Shadowbane Chronicles Full Screen</title>', 1).replace('</style>', '</style>\n' + fs.split('<div class="fsbar"')[0], 1)
full = full.replace('<section class="chat"', '<div class="fsbar"' + fs.split('<div class="fsbar"')[1] + '\n<section class="chat"', 1)
open(os.path.join(ROOT, 'dist', 'gbquest-fullscreen.html'), 'w').write(full)
print('index.html + dist/gbquest.html (%d KB, %d assets)' % (len(single) // 1024, len(assets)))
