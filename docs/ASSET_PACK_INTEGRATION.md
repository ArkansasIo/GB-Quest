# Asset pack integration

The game ships two complementary pixel-art integrations:

- `assets_pack/` contains the sliced source pack, transparent full-detail cutouts, pixel-ready variants, scenes and the manifest.
- `assets/ap_*.png` and `assets/au_*.png` contain optimized game-ready images. These are indexed by `assets/index.json` and loaded into the shared `IMG` sprite registry by `src/engine.js`.

## Runtime ownership

| Runtime file | Responsibility |
|---|---|
| `src/asset_pack.js` | Item and consumable art, gem icons, selected bestiary and boss art, battle scenes, NPC dialogue portraits and rarity frames |
| `src/pack_index.js` | Generated lookup tables for gear tiers, monster families and sprite aliases |
| `src/pack_art.js` | Pixel Packs art mode, gear category swaps, NPC walk-cycle aliases, biome scenery aliases and dungeon object aliases |
| `src/art.js` | Existing NES/classic item, monster, spell and character art plus fallback behavior |
| `src/engine.js` | Loads the asset index and makes successfully loaded images available through `IMG` |

The scripts are intentionally ordered in `index.html`: core art first, then the asset-pack integration, generated index, and pixel-pack runtime. Do not move the generated index ahead of the script that consumes it.

## Coverage currently shipped

The generated runtime index references 177 unique gear/item sprites, 43 unique monster sprites and 199 unique alias targets. The shipped asset index contains 535 `ap_*` images and 160 `au_*` images. All sprite names referenced by the generated item, monster and alias tables are present in `assets/index.json`.

The alias groups cover 18 townsfolk roles, nine biome families (including meadow, coast, marsh, jungle, snow, badlands, volcanic, dusk and crystal), and dungeon props. The pixel-pack runtime swaps aliases only when the target image has loaded and restores the original sprite when another art mode is selected.

## Validation

Run:

```bash
npm test
```

The asset-pack integration tests check that:

1. Every generated item, monster and alias sprite is included in the shipped asset index.
2. The art scripts are present and loaded in dependency order.
3. Classic/NES fallback behavior and generated NPC, biome and dungeon alias groups remain available.
4. Item, monster, scene and UI hooks remain wired into the game.

When regenerating the pixel packs, run the generator documented in `docs/ART_PACKS.md`, rebuild `assets/index.json` using the project build tooling, and rerun the tests.
