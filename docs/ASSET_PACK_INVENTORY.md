# GB Quest asset pack inventory

The checked-in reference art is split into two source collections and installed into the runtime catalog.

## Reference sprite pack

Source: `assets_pack/`  
Manifest: `assets_pack/manifest.json`  
Preview: `assets_pack/preview.png`  
Regenerate from the supplied sheet with:

```sh
python3 tools/slice_assetpack.py
```

| Category | Assets |
|---|---:|
| Characters | 43 |
| NPCs | 33 |
| Enemies | 19 |
| Monsters | 24 |
| Weapons | 42 |
| Armor | 52 |
| Items | 54 |
| Terrain | 34 |
| Environment | 26 |
| Buildings | 27 |
| Dungeon | 48 |
| UI icons | 40 |
| Portraits | 30 |
| Particles | 24 |
| Mounts | 22 |
| Map elements | 12 |
| Scenes | 5 |
| **Total** | **535** |

Each manifest entry describes the transparent source cutout and its 8-bit pixel variant. Runtime pixel assets use the `ap_` prefix in `assets/`; scene backgrounds use `ap_scene_<name>.png`.

## UI kit

Source: `assets_pack/ui/`  
Manifest: `assets_pack/ui/manifest.json`  
Regenerate with:

```sh
python3 tools/slice_assetpack.py --sheet ui
```

The UI kit contains **151 pieces**: rarity frames, socket gems, consumables, panel frames, buttons, checkboxes, system/menu icons, skill and hotbar icons, inventory/storage/shop icons, banners, and minimap/world-map/guild-crest scenes. Runtime assets use the `au_` prefix; UI scenes use `au_scene_<name>.png`.

## Runtime integration

- `src/asset_pack.js` maps items, gems, monster families, battle scenes, spellbook icons, rarity borders and NPC portraits to installed asset names.
- `src/pack_index.js` and `src/pack_art.js` provide the separate classic pixel-pack mode.
- `assets/index.json` is the runtime image catalog used by `loadAssets()`.
- The full runtime identifier list is in [In-Game Asset Names](IN_GAME_ASSET_NAMES.md); regenerate it with `node tools/gen_asset_catalog.cjs`.
- `tools/build.cjs` embeds the runtime PNG catalog in the standalone browser build.
- `tools/build-itch.cjs` creates the one-file `index.html` upload archive so the itch.io 1,000-file limit is not exceeded.

## Completeness checks

Run:

```sh
npm test
```

The asset-pack completeness test checks every manifest source image, every pixel variant, and every installed runtime image against `assets/index.json`. This catches missing or renamed files before packaging.
