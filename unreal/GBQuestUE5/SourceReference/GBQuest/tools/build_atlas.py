#!/usr/bin/env python3
"""Builds dist/atlas.html: the interactive Atlas of Valendria (roads, sea lanes, zones, bosses, quests).
Exports live game data with tools/export_atlas.cjs, embeds src_sheet/world_map.png as JPEG."""
import base64, io, json, os, subprocess, tempfile
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
tmp = os.path.join(tempfile.gettempdir(), 'gbq_atlas.json')
subprocess.run(['node', 'tools/export_atlas.cjs', tmp], check=True)
data = json.load(open(tmp))
buf = io.BytesIO(); Image.open('src_sheet/world_map.png').convert('RGB').save(buf, 'JPEG', quality=82, optimize=True)
uri = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
html = open('atlas/atlas_template.html').read().replace('__MAP__', uri).replace('__DATA__', json.dumps(data, separators=(',', ':')))
os.makedirs('dist', exist_ok=True)
open('dist/atlas.html', 'w').write(html)
json.dump(data, open('atlas/atlas.json', 'w'), separators=(',', ':'))
print('dist/atlas.html', len(html) // 1024, 'KB')
