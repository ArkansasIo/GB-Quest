# Build and integrate the 6,000-image HD64 asset pack

GB-Quest already has a deterministic 6,000-image procedural art generator. Use this pipeline rather than the older generic starter generator.

## Install the image-generation dependencies

```bash
python -m pip install -r requirements-assets.txt
```

## Generate and validate all images

```bash
npm run assets:build:6000
```

The command generates **6,000 individual 64×64 RGBA PNG files** across 18 art categories, builds full 10×10 atlas pages covering every image (not only previews), writes JSON/CSV manifests and an atlas index, then runs the read-only integrity validator.

Generated source assets and metadata are placed under:

```text
assets_hd64/gbq_6000/
  assets/
    player_races_characters/
    classes_subclasses/
    weapons/
    armor_clothing/
    jewelry_accessories/
    monsters_creatures/
    bosses_raid_creatures/
    environments_tilesets/
    buildings_settlements/
    maps_worlds/
    dungeons_towers_raids/
    magic_visual_effects/
    items_consumables/
    mounts_pets/
    npcs_civilians/
    ui_interface/
    factions_quests_achievements/
    promotional_loading_art/
  atlases/
  metadata/
    asset_manifest.json
    asset_manifest.csv
    category_summary.json
```

## Runtime integration

The browser game loads the small atlas index at startup and keeps image pages lazy-loaded. The GitHub Actions workflow `.github/workflows/asset-catalog-6000.yml` generates, validates, and publishes the complete source-image pack as the `GB-Quest-6000-HD64-Asset-Pack` workflow artifact (30-day retention). Because a pull-request workflow must already exist on the base branch to run for that pull request, this newly added workflow will become runnable after it is merged; it can then be manually dispatched and will also run for future matching pull requests. The runtime API is exposed as `window.GBQ6000Assets`:

- `load()` — load the index without decoding every sprite.
- `get('GBQ-0001')` — decode and return one 64×64 canvas.
- `pick('weapons', 'iron-sword')` — deterministically choose a stable ID from a category.
- `draw(ctx, id, x, y, width, height)` — draw an already-loaded sprite, or request it for the next frame.
- `info(id)` — retrieve category, atlas and source-path metadata.

The game asset-pack module also exposes `GBQAssetPack.asset6000For(category, identity)` and `GBQAssetPack.get6000(id)`. The standalone browser and itch.io builders embed the generated atlas pages and index when present; the normal game continues to fall back to its existing art if the optional pack has not been generated.

## Export to the Godot/Summer game port

```bash
npm run assets:export:godot
```

The exporter copies the catalog into the Summer prototype's art and sprite data files. To run both generation/validation and export in one step:

```bash
npm run assets:build:godot
```

## Create a separate asset ZIP

```bash
npm run assets:zip:6000
```

The ZIP helper first runs the full read-only integrity validator, then archives the already-generated catalog without regenerating it. It writes `build/GB-Quest-6000-HD64-Assets.zip`. It is a separate art download; the itch.io HTML5 game ZIP remains a distinct release artifact.

## Partial development runs

For a focused generator iteration:

```bash
python tools/gen_pack6000_hd.py --only monsters_creatures --limit 50
python tools/validate_pack6000_hd.py --allow-partial
```

Do not use a partial output as a release pack. Run the full generator and full validator before packaging.

## Notes

- The images are procedural original starter artwork, not hand-painted final production illustrations.
- IDs are stable in the `GBQ-0001` through `GBQ-6000` range.
- Monsters and bosses carry a bestiary `family` field in the manifest.
- Generated binaries are rebuildable outputs and remain excluded from Git history; commit the generator, source engine, manifests/schema and exporter instead.
- The canonical category definitions and image-generation logic live in `tools/gen_pack6000_hd.py` and `tools/hd64_engine.py`.
