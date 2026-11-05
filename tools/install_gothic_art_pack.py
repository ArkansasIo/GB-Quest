#!/usr/bin/env python3
"""Install the GB-Quest six-sheet dark-fantasy art pack into a staging folder.

The supplied sheets are composite catalog boards, not production sprite atlases.
This installer preserves originals, validates all supplied category panels, and
writes a manifest for review. It does not delete or overwrite the live art pack.
"""
from __future__ import annotations
import argparse, json, zipfile
from pathlib import Path
from PIL import Image

REQUIRED = {
    "asset-sheet-v1-2.png", "biomes-atlas.png",
    "catalog-items-monsters-atlas.png", "catalog-world-blocks-atlas.png",
    "characters-monsters-atlas.png", "dungeon-interiors-atlas.png",
    "expansion-gear-biomes-atlas.png", "gothic-4-color-ui-kit.png",
    "great-catalog-v2.png", "master-atlas-v3-expansion.png",
    "master-developer-mockup.png", "skills-abilities-atlas.png",
    "sprite-sheet-collection-v1-5.png", "ui-components-atlas.png",
    "weapons-armor-atlas.png",
}
SOURCE_SHEETS = {
    "asset-sheet-v1-2.png", "gothic-4-color-ui-kit.png",
    "great-catalog-v2.png", "master-atlas-v3-expansion.png",
    "master-developer-mockup.png", "sprite-sheet-collection-v1-5.png",
}
CATEGORIES = {
    "characters-monsters-atlas.png": "characters, enemies, bosses",
    "weapons-armor-atlas.png": "weapons, armor and equipment",
    "biomes-atlas.png": "overworld biomes and isometric terrain",
    "dungeon-interiors-atlas.png": "dungeon walls, floors and interior tiles",
    "skills-abilities-atlas.png": "skills and ability icons",
    "ui-components-atlas.png": "UI icons, frames, cards and resource orbs",
    "catalog-items-monsters-atlas.png": "items, consumables and creature catalog",
    "catalog-world-blocks-atlas.png": "world blocks, tiles and structures",
    "expansion-gear-biomes-atlas.png": "expansion equipment, wings, mounts and biomes",
}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("source_zip", type=Path)
    ap.add_argument("--output", type=Path, default=Path("assets_gothic/staging"))
    args=ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.source_zip) as z:
        names={Path(n).name:n for n in z.namelist() if not n.endswith("/")}
        missing=sorted(REQUIRED-set(names))
        if missing:
            raise SystemExit("Missing art-pack entries: "+", ".join(missing))
        records=[]
        for filename in sorted(REQUIRED):
            data=z.read(names[filename])
            target=args.output/filename
            target.write_bytes(data)
            with Image.open(target) as im:
                im.verify()
            with Image.open(target) as im:
                records.append({"file":filename,"width":im.width,"height":im.height,
                    "kind":"source-sheet" if filename in SOURCE_SHEETS else "category-atlas",
                    "category":CATEGORIES.get(filename,"reference sheet")})
    manifest={"name":"GB-Quest Dark Fantasy Replacement Art Pack","version":"1.0.0",
      "status":"staging-review","sourceSheets":sorted(SOURCE_SHEETS),
      "atlases":records,"runtimeSwapEnabled":False,
      "notes":["The category panels are crops from composite reference boards.",
       "Captions, panel borders and UI mockups may remain in some crops.",
       "Split and validate individual sprites and animation frames before runtime replacement.",
       "Legacy assets are intentionally retained until replacement coverage is verified."]}
    (args.output/"asset-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    print(f"Staged {len(records)} images in {args.output}")
if __name__=="__main__": main()
