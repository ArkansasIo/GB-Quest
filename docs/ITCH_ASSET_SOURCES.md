# itch.io asset sources and integration

This project uses a curated, licence-aware workflow for external pixel-art packs. Do not bulk-copy assets from itch.io search pages: each product has its own licence and redistribution conditions. The user must obtain each ZIP from itch.io; the game repository may include only files whose licence permits inclusion in this project and its distributed builds.

## Priority free sources

| Source | Useful content | Status / terms |
|---|---|---|
| [Gen XIA free game asset sampler](https://gen-xia.itch.io/gen-xia-five-pack-free-sampler) | 137 files: animated characters/monsters, sci-fi HUD, modular lab tiles, VFX/audio and SVG patterns | Free sampler; product page states free commercial use. AI-assisted disclosure is included on the page. |
| [Gen XIA animated RPG character sampler](https://gen-xia.itch.io/rpg-character-monster-library-free-sampler) | 5 creatures, 16×16, four directions, idle/walk, 640 frames | Free; commercial use in released games; no resale/redistribution as an asset pack. |
| [Gen XIA asset collection](https://itch.io/c/8248062/gen-xia-game-asset-packs) | Additional free samplers for fantasy icons/UI, characters, VFX and sci-fi UI | Collection states all licences permit commercial use; check each product page before import. |
| [Spritewell free starter kit](https://spritewell.itch.io/) | Samples across tiles, backgrounds, characters, monsters, icons, UI, effects, weather, sound and fonts | Free starter; creator states personal and commercial game use is allowed, with credit “Art by Spritewell” and a link. Do not resell assets. |
| [itch.io free MMORPG + pixel-art assets](https://itch.io/game-assets/free/tag-mmorpg/tag-pixel-art) | Discovery index for more free RPG/MMORPG pixel assets | Search index only, not a licence. Verify every individual product page. |

## Pack selection for GB Quest

1. **World and biome art:** 16×16 top-down terrain, water, paths, interiors, props and modular buildings.
2. **Player/NPC art:** four-directional top-down characters with idle/walk frames; preserve source animation timing and frame dimensions.
3. **Monsters and bosses:** top-down or compatible perspective creatures, with idle/attack/hurt/death frames.
4. **Equipment and loot:** weapons, armour, shields, accessories, potions, materials and rarity icons.
5. **UI:** panels, buttons, inventory slots, hotbars, gauges, cursors and status icons.
6. **Effects:** spells, hits, healing, projectiles and weather overlays.

The existing game renderer is top-down. Side-view character/monster packs are not automatically substituted into the overworld; they need a compatible battle renderer or deliberate conversion. Sprite sheets larger than 128 px in either dimension are imported as review-required assets and must receive crop/animation metadata before use as individual sprites.

## Import workflow

Download a pack directly from its itch.io product page, read its current licence, and keep the ZIP outside the repository. Then run:

```sh
python tools/import_itch_asset_pack.py path/to/download.zip \
  --pack genxia-free-sampler \
  --source-url https://gen-xia.itch.io/gen-xia-five-pack-free-sampler \
  --license "Free commercial use; no redistribution as a standalone asset pack" \
  --credit "Gen XIA"
```

The importer:
- rejects unsafe ZIP paths and non-PNG files;
- adds stable, hash-suffixed IDs to `assets/index.json`;
- copies PNGs into `assets/` so the existing image loader can discover them;
- records source filename, dimensions, SHA-256, category and review status in `assets/itchio_manifest.json`;
- does not overwrite existing assets or claim that a spritesheet is a single sprite.

After import, add crop/animation metadata for sprite sheets, connect reviewed IDs to the appropriate runtime category in `src/asset_pack.js`, run `npm run check:syntax`, `npm test`, and `npm run build:itch`, then inspect the HTML5 build before release.

## Current limitation

The GitHub integration in this session can commit source text, but it does not provide a binary ZIP download/upload operation for itch.io files. Therefore, this commit provides the source catalogue and safe importer, not the actual third-party PNG payloads. No external pack is represented as already installed until its PNGs appear in `assets/` and the manifest records them.
