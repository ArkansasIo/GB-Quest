# Asset pack (sliced from the reference sheet)

Source: `art_source/asset_pack_sheet.png`, the asset sheet supplied for the project. Regenerate everything with:

    python3 tools/slice_assetpack.py          # add --debug to write _boxes.png with the panel boxes

| Folder | What | Pixel size |
|---|---|---|
| characters, npcs, enemies | hero figures and small walkers | 34 px |
| monsters, portraits | bosses, creatures, face portraits | 50 px |
| mounts, environment, buildings | mounts and pets, props, houses | 34 px |
| weapons, armor, items, terrain, dungeon, ui_icons, particles, map_elements | icons and tiles | 18 px |
| scenes | city, wilderness, dungeon, boss fight and world map paintings, plus 160x144 pixel backdrops (`*_px.png`) | |

Each folder has the full-detail cutout (`<panel>_NNN.png`, transparent background) and an 8-bit version in `px/` (32 colours, dark outline). `manifest.json` lists every asset with its source box on the sheet; `preview.png` shows all the pixel versions.

These files are not loaded by the game yet. To use one, copy its `px/` version into `assets/` under the game's naming (for example `np_class_<cls>.png`) and rebuild.
