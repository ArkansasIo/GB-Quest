# HD64 Game Asset Library

The game uses the complete `assets_hd64/` atlas library at runtime.

## Runtime integration
- First-run settings migrate to `video: hd64` and `palette: full`; players can switch back in Settings.
- Startup reads all 25 HD64 JSON indexes and preloads every referenced atlas page.
- The sprite renderer resolves HD64 sprites by their existing named keys and source rectangles.
- `src/hd64_game_art.js` maps HD64 equipment categories into the live item art tables and assigns deterministic HD64 monster sprites to bestiary entries.
- World tiles, walkers, portraits, UI, battle art, effects, skills, achievements, class sheets, dungeon tiles, and other indexed families remain available through `GBQ_HD64_ASSET_LIBRARY`.

## Asset library API
- `GBQ_HD64_ASSET_LIBRARY.families`: indexed atlas families.
- `GBQ_HD64_ASSET_LIBRARY.spriteCount`: total indexed sprite keys.
- `GBQ_HD64_ASSET_LIBRARY.keys(family)`: sprite names in a family.
- `GBQ_HD64_ASSET_LIBRARY.resolve(name)`: family, page, crop rectangle and atlas path for a sprite.

## Memory and fallback
All atlas PNGs are preloaded at startup, so this mode has a higher initial network and memory cost than the original Game Boy renderer. Missing atlas pages are logged and fall back to the existing source art. The original assets are retained.
