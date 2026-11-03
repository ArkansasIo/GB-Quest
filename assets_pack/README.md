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

The script also installs every `px/` version into the game as `assets/ap_<panel>_NNN.png` (scenes: `assets/ap_scene_<name>.png`). The game uses them in `src/asset_pack.js`: SETTINGS > BATTLE BG > SCENES, the potion/food/scroll/book/key/coin item icons, and gem icons in the socket forge. All of them are loaded by name, so any other one can be used with `blit(sprFit('ap_monsters_003', 32), x, y)`.

## UI kit (`ui/`)

Source: `art_source/ui_pack_sheet.png`. Regenerate with `python3 tools/slice_assetpack.py --sheet ui`.

151 pieces: rarity frames (normal to socket), socket gems, consumables, panel frames, buttons, checkboxes, system and menu icons, skill icons, hotbar skills and potions, inventory/storage/shop item icons, two notice banners (LEVEL UP, ENHANCE SUCCESS), and a minimap, world map and guild crest in `ui/scenes/`.

Installed into the game as `assets/au_<panel>_NNN.png` and `assets/au_scene_<name>.png`.

Left out on purpose: the sheet's game logo, its named class line-up and the event-named banner, which belong to another game's brand.
