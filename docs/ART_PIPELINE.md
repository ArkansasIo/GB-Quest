# Pixel-art asset and tile pipeline

This repository keeps the native Game Boy presentation at **16×16 pixels per map tile** and uses nearest-neighbour integer scaling for larger displays. The art direction is original fantasy MMORPG pixel art: strong silhouettes, restrained four-colour material ramps, readable outlines, and distinct biome palettes.

## Generate the artwork

Install Python 3 with Pillow and NumPy, then run from the repository root:

```bash
python3 tools/gen_gbtiles.py
python3 tools/gen_newart.py
python3 tools/gen_hd64.py
node tools/build.cjs
```

- `gen_gbtiles.py` generates biome terrain, all 16 cardinal road joins, two-frame shoreline animation, dungeon themes, map objects, and walking sprites.
- `gen_newart.py` generates class/UI/equipment icons, rarity gems, named item art, and the nine redesigned adventurer rank badges. The rank badges are written as both `rk_1.png` … `rk_9.png` and named aliases `rk_f.png` … `rk_sss.png`.
- `gen_hd64.py` creates the 4× enhanced atlas pages and JSON sprite indexes from the generated native sprites.
- `build.cjs` embeds all PNGs into the browser and desktop game builds.

## Adventurer rank ladder

The rank ladder is **F → E → D → C → B → A → S → SS → SSS**. Its score thresholds and badge colours are defined in `data/progression/ranks.json`; runtime score calculation is in `src/rank-system.js`.

Score is based on achievements, kills, boss kills, dungeons, raids, trials, tower progress, PvP wins, quests, and exploration. The rank is stored with the local character save and published as a profile field by the client. The score is currently client-derived; it is not a server-authoritative competitive rating yet.

Rank is deliberately separate from:
- The existing **nine item rarity tiers**.
- Character level **1–720**.
- Profession talent ranks.

## Tile system

`world/catalog/tile-system.json` is the tile-system contract. It defines ten render layers, nine generated biomes, six dungeon themes, collision semantics, 32×32-tile chunking, and the four-bit cardinal autotile convention:

| Direction | Bit |
|---|---:|
| North | 1 |
| East | 2 |
| South | 4 |
| West | 8 |

The 16 masks cover every cardinal join. Diagonal corner fill is permitted only when both adjacent cardinal edges connect. Animated shorelines use two frames. Collision belongs to terrain/object data, not decorative overlays.

The catalog is a complete schema for the tile families and future additions; it does not claim that every listed prop, effect, or UI marker already has a finished sprite. New art should receive stable IDs and be added to the generator and atlas index rather than being assigned an existing unrelated ID.
