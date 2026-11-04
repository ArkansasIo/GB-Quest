# Pixel-art asset and tile pipeline

This repository keeps the native Game Boy presentation at **16×16 pixels per map tile** and uses nearest-neighbour integer scaling for larger displays. The art direction is original fantasy MMORPG pixel art: strong silhouettes, restrained four-colour material ramps, readable outlines, and distinct biome palettes.

## Generate the artwork

Install Python 3 with Pillow and NumPy, then run from the repository root:

```bash
python3 tools/gen_gbtiles.py
python3 tools/gen_newart.py
python3 tools/gen_jobs.py
python3 tools/slice_assetpack.py && python3 tools/slice_assetpack.py --sheet ui
python3 tools/gen_hd64.py
node tools/build.cjs
```

- `gen_gbtiles.py` generates biome terrain, all 16 cardinal road joins, two-frame shoreline animation, dungeon themes, map objects, and walking sprites.
- `gen_newart.py` generates class/UI/equipment icons, rarity gems, named item art, and the nine redesigned adventurer rank badges. The rank badges are written as both `rk_1.png` … `rk_9.png` and named aliases `rk_f.png` … `rk_sss.png`.
- `gen_npcs.py` draws a role-specific NPC sprite for 43 townsfolk roles, each with its own outfit, headwear, facial hair and held prop, plus the Realm Stone crystal. Every role gets walk frames in three directions and a blink frame: `gh_npc_<role>_{down,up,side}{0,1}`, `gh_npc_<role>_blink`. `src/npc_art.js` maps each service NPC and profession trainer to its role. Run `python3 tools/gen_npcs.py --sheet preview.png` for a contact sheet.
- `gen_jobs.py` makes walkers, portraits and battle sheets for the 11 new jobs and portraits for the 6 new races, tinted from related classes and races with an emblem.
- `slice_assetpack.py` cuts the reference sheets in `art_source/` into sprites (`assets_pack/`) and installs 8-bit versions as `assets/ap_*.png` (asset pack) and, with `--sheet ui`, `assets/au_*.png` (UI kit). `src/asset_pack.js` uses them: SCENES battle backgrounds, item icons for potions, food, scrolls, books, keys and coins, gem icons in the socket forge, rarity-tinted item borders (`au_rframe_<tier>`, made from the UI kit's frame), pack monster art for about half of each matching bestiary family, and NPC face portraits in dialogue. The UI kit's logo, named class line-up and event-named banner are not cut.
- `gen_hd64.py` creates the 4× enhanced atlas pages and JSON sprite indexes from the generated native sprites.
- `build.cjs` embeds the Game Boy PNGs plus the HD64 atlas pages and indexes into the single-file browser and desktop builds. In 64-BIT video mode, matching enhanced sprites are loaded from those atlases on demand.

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
