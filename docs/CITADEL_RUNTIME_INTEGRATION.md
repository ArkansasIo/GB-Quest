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
