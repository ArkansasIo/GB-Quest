# CITADEL runtime integration

## Runtime
- `src/engine.js` loads the race, class, creature, boss and environment SVG catalogs into the existing `IMG` registry.
- `server.js` serves `assets_citadel/` and returns the correct `image/svg+xml` MIME type for SVG files.
- `src/art.js` routes character creation portraits, class portraits, creature portraits and boss portraits to CITADEL art when available.
- `src/battlebg.js` renders the matching biome SVG as the battle backdrop.
- `src/scenes_menu.js` exposes **SETTINGS → CITADEL ART** as an ON/OFF compatibility switch.
- `tools/build.cjs` embeds all CITADEL SVG files and the CITADEL stylesheet into the standalone HTML build so the packaged client does not depend on loose SVG/CSS files.
- New installs default to the CITADEL painted battle backdrops; the existing BATTLE BG setting still switches back to the clean procedural backdrop.

## New environment artwork
Forest, plains, coast, snow, swamp, desert, volcanic, dungeon, city and crystal. Master SVG viewBox: 1600×900.

## User-provided woodland tileset
The uploaded `pixel_16_woods v2 free.zip` contains a 352×192 pixel-art woodland sheet. It is a legacy tile source, not a high-resolution replacement. It should be retained as a source/reference and not enlarged with nearest-neighbour scaling as if it were HD artwork. The new forest environment backdrop is now used by the battle-scene pipeline. A separate HD exploration tileset and autotile rules are still a future production task.

## Compatibility
Existing PNG packs, legacy sprites, gameplay rules, saves and network systems are retained. Turn CITADEL ART OFF to restore the previous art routing.

## Batch 06 — world props
- Added ten original scalable prop illustrations under `assets_citadel/props/`.
- `assets_citadel/prop_catalog.json` provides stable IDs and source paths.
- `src/engine.js` loads the prop catalog and exposes `window.GBQ_CITADEL_PROPS` keyed by stable prop ID for scene-level rendering.
- The standalone build already embeds every SVG found under `assets_citadel/`; the new prop files are therefore included automatically by `tools/build.cjs`.
- These are concept illustrations, not final 3D meshes, collision geometry, or instanced world props.

## Batch 07 — terrain materials
- Added eight seamless SVG terrain material concepts under `assets_citadel/terrain/`.
- `assets_citadel/terrain_catalog.json` lists stable IDs and source paths.
- `src/engine.js` loads them and exposes `window.GBQ_CITADEL_TERRAIN`.
- The standalone builder embeds all SVGs recursively, so these assets are included automatically in generated standalone builds.
- These are vector material concepts, not production PBR maps; base-color, normal, roughness, ambient-occlusion and displacement maps remain to be authored for a true 3D material pipeline.

## Batches 08–09 — buildings and roads
- Added eight medieval building concept illustrations under `assets_citadel/buildings/` and six road layout tiles under `assets_citadel/roads/`.
- Catalogs: `assets_citadel/building_catalog.json` and `assets_citadel/road_catalog.json`.
- `src/engine.js` loads both catalogs and exposes `window.GBQ_CITADEL_BUILDINGS` and `window.GBQ_CITADEL_ROADS` by stable ID.
- The standalone build embeds these SVGs through the recursive asset bundler.
- These assets are concept illustrations; map placement, collision, navmesh and actual world-tile replacement remain separate integration work.

## Batches 10–12 — equipment artwork
- Added six weapon icons, six armor icons and four shield icons under `assets_citadel/weapons/`, `armor/` and `shields/`.
- Catalogs: `weapons_catalog.json`, `armor_catalog.json` and `shields_catalog.json`.
- `src/engine.js` loads these catalogs and exposes `window.GBQ_CITADEL_WEAPONS`, `window.GBQ_CITADEL_ARMOR` and `window.GBQ_CITADEL_SHIELDS` by stable ID.
- Standalone builds embed these SVG assets recursively.
- These are inventory concept icons, not production 3D equipment models, PBR materials or equip animations.
