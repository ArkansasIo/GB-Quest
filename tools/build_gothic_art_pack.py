#!/usr/bin/env python3
"""Build GB-Quest category atlases from the six supplied reference sheets.

Usage:
  python tools/build_gothic_art_pack.py --source-dir /path/to/six-sheets --output-dir assets_gothic

The source sheets are composite catalogs, not isolated sprite sheets. This tool
preserves the six sources and crops documented category panels. It deliberately
does not pretend the resulting panels are individual transparent sprites.
"""
from pathlib import Path
from PIL import Image
import argparse, json, shutil

SHEETS = {
 "master-atlas-v3-expansion": "master-atlas-v3-expansion.jpg",
 "great-catalog-v2": "great-catalog-v2.jpg",
 "sprite-sheet-collection-v1-5": "sprite-sheet-collection-v1-5.jpg",
 "master-developer-mockup": "master-developer-mockup.jpg",
 "asset-sheet-v1-2": "asset-sheet-v1-2.jpg",
 "gothic-4-color-ui-kit": "gothic-4-color-ui-kit.jpg",
}
CROPS = [
 ("characters-monsters-atlas.png","sprite-sheet-collection-v1-5.jpg",(500,125,940,335),"Monster and character sprite panel"),
 ("weapons-armor-atlas.png","sprite-sheet-collection-v1-5.jpg",(80,340,480,555),"Weapon and armor panel"),
 ("biomes-atlas.png","sprite-sheet-collection-v1-5.jpg",(500,345,940,560),"Isometric biome tile panel"),
 ("dungeon-interiors-atlas.png","sprite-sheet-collection-v1-5.jpg",(500,580,940,700),"Dungeon interior tiles"),
 ("skills-abilities-atlas.png","sprite-sheet-collection-v1-5.jpg",(80,125,480,310),"Skill and ability icon panel"),
 ("ui-components-atlas.png","sprite-sheet-collection-v1-5.jpg",(960,345,1330,700),"UI icons, frames, cards and orbs"),
 ("catalog-items-monsters-atlas.png","great-catalog-v2.jpg",(570,85,1380,625),"Items, consumables and monster catalog"),
 ("catalog-world-blocks-atlas.png","great-catalog-v2.jpg",(810,85,1115,625),"World blocks, tiles and structures"),
 ("gothic-ui-kit-atlas.png","gothic-4-color-ui-kit.jpg",(0,0,1408,768),"Gothic UI reference sheet"),
 ("expansion-gear-biomes-atlas.png","master-atlas-v3-expansion.jpg",(550,55,1330,715),"Expansion gear, wings, mounts and biome panels"),
]
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--source-dir",required=True); p.add_argument("--output-dir",required=True)
 a=p.parse_args(); src=Path(a.source_dir); out=Path(a.output_dir); out.mkdir(parents=True,exist_ok=True)
 sources=[]
 for stem,filename in SHEETS.items():
  candidates=[src/filename,src/(stem+".png")]
  found=next((x for x in candidates if x.exists()),None)
  if found is None: raise FileNotFoundError(f"Missing source sheet: {filename}")
  target=out/(stem+".png"); Image.open(found).convert("RGB").save(target,optimize=True)
  sources.append({"id":stem,"file":target.name})
 atlases=[]
 for name,source,box,description in CROPS:
  im=Image.open(src/source).convert("RGB").crop(box)
  im.save(out/name,optimize=True)
  atlases.append({"file":name,"source":source,"crop":list(box),"width":im.width,"height":im.height,"description":description})
 (out/"asset-manifest.json").write_text(json.dumps({"pack":"GB-Quest Dark Fantasy Replacement Art Pack","version":"1.0.0","sourceSheets":sources,"atlases":atlases,"note":"Composite panel crops retain labels/borders and require sprite-level cleanup before direct animation use."},indent=2)+"\n")
if __name__=="__main__": main()
