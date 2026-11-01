# GB Quest

A small Game Boy–style RPG built entirely from the supplied asset sheet
(`src_sheet/sheet.png`). 160×144 screen, 4-shade LCD palette (or the sheet's
original colours), square-wave sound, 60 fps.

## Play

- **Single file:** open `dist/gbquest.html` in any browser (all art inlined).
- **Dev version:** serve the folder and open `index.html`
  (`python3 -m http.server` then visit http://localhost:8000). It loads
  `src/*.js` and the PNGs in `assets/`, so edits show on reload.

Controls: arrows/WASD move · Z/Space = A · X/Esc = B · Enter = START ·
Shift = SELECT (map). On phones use the on-screen D-pad and buttons.

## The game

Wake by the castle, visit the OLD MAN in the village (he gives you the key),
gather 10 herbs, cross the river to the GOBLIN KEEP, beat the GOBLIN KING and
bring the LOST RELIC home.

Screens from the sheet that are implemented: main menu, inventory, item use,
status, equipment, quests, map, settings, battle (encounter / turn / action
result), level up — plus title, overworld, dungeon, shop, ending.

Systems: random encounters by terrain (plains / forest / dungeon), 15 enemies
+ boss, 3 skills, poison, crits/dodges, drops, gold shop, chests, gear slots
(weapon, shield, helm, armor, boots), levelling, castle rest + save
(localStorage), settings (volume, music, brightness, contrast, LCD/colour
palette, A/B swap, reset save).

## Files

```
src_sheet/sheet.png      the original asset sheet
tools/extract_assets.py  slices the sheet into assets/*.png (+ manifest.json)
tools/make_font.py       builds assets/font_6x9.png (X11 6x9 bitmap font)
tools/build.py           writes index.html and dist/gbquest.html
assets/                  146 sliced sprites, tiles, icons, effects
src/data.js              maps, tiles, items, enemies, quests, music
src/game.js              engine + every scene
src/shell.html           the handheld frame (HTML/CSS + touch controls)
```

Rebuild after changing anything:

```
python3 tools/extract_assets.py   # only if the sheet changes (needs Pillow, numpy, scipy)
python3 tools/build.py
```

Swap any PNG in `assets/` for your own art — sprites are scaled and
palette-quantised at runtime, so sizes don't need to match exactly.


## MMORPG expansion (in progress)

The `feature/mmorpg-dnd5e-world` branch introduces the first modular foundation for a larger online RPG:

- `docs/MMORPG_DESIGN.md` — game pillars, character progression, combat, social systems and production targets.
- `docs/WORLD_SCALE_AND_MAPS.md` — continent/zone/chunk hierarchy and streaming strategy.
- `docs/RULES_IMPLEMENTATION.md` — D&D 5e-compatible d20 rules implementation plan.
- `src/mmorpg/rules/d20.js` — initial ability modifier, proficiency and d20 check primitives.
- `src/mmorpg/world/coordinates.js` — chunk coordinate and neighborhood helpers.
- `world/manifests/greenreach.json` — example original zone manifest.
- `tests/mmorpg/` — initial automated tests.

Run the new Node.js tests with `npm test` (Node.js 20 or newer).

The original Game Boy runtime remains the active game. The MMORPG modules are an isolated expansion layer and are not yet wired into the legacy runtime. Network persistence, full class/spell/monster content, procedural continent generation, chunk loading and deployment remain future implementation work.

**Content/licensing:** D&D-compatible mechanics should use permitted SRD material with required notices and attribution. Do not copy non-SRD rulebook text or proprietary World of Warcraft assets, lore, maps or content. All new setting, quest, item, enemy and visual content should be original.


### D&D-compatible character and equipment catalog

The expansion data layer now includes the nine SRD 5.2.1 species, twelve SRD classes with their included SRD subclasses, eight schools of magic, the SRD weapon catalog (including mastery properties), and armor categories and AC rules:

- `src/mmorpg/data/species.json`
- `src/mmorpg/data/classes.json`
- `src/mmorpg/data/magic-schools.json`
- `src/mmorpg/data/equipment.json`
- `docs/SRD_ATTRIBUTION.md`

This is a structured catalog foundation, not yet the complete character builder: species traits, every level-by-level class feature, all spell records, feats, backgrounds, equipment costs/weights and full rules resolution still need to be implemented and validated against SRD 5.2.1. See the attribution document for licensing and scope.


### 1-720 progression and 8-bit asset expansion

- `src/mmorpg/progression/level-progression.js` — D20 levels 1-20 plus Paragon progression through level 720.
- `src/mmorpg/data/progression.json` — progression design contract and milestone rewards.
- `src/mmorpg/data/asset-manifest.json` — original pixel-art atlas and animation requirements.
- `tools/generate_pixel_assets.py` — Python standard-library generator for original placeholder sprite atlases.
- `docs/LEVEL_1_TO_720.md` — level-cap and endgame design.
- `docs/PIXEL_ART_PIPELINE.md` — 8-bit art standards and asset provenance.
- `docs/MMORPG_FEATURE_MATRIX.md` — character, world, social, economy, combat, UI and multiplayer feature scope.
- `tests/mmorpg/progression.test.js` — level curve tests.

The D20 class progression ends at level 20. Levels 21-720 are GB Quest Paragon ranks, focused on mastery, professions, exploration, collections, cosmetics and world renown. This preserves bounded accuracy while supporting long-term MMORPG progression.

Run `npm test` with Node.js 20+. Run `python tools/generate_pixel_assets.py` to generate starter atlases. These are original procedural placeholders, not final production art.

### 350 bosses, monster taxonomy and world-scale map

- `src/mmorpg/data/bosses-350.json` — 300 world bosses and 50 arc bosses.
- `src/mmorpg/data/monster-taxonomy.json` — 14 D&D-style creature types and 20 original monster combat classes with subclass archetypes.
- `world/manifests/world-scale.json` — four continents, 40 zones, 512x512 tiles per zone, 32x32 tile chunks and 10,240 streamable chunks.
- `docs/BOSSES_MONSTERS_AND_WORLD_MAP.md` — encounter and world-map design.
- `tests/mmorpg/bosses-world.test.js` — catalogue and map integrity tests.

The map target is 2,048 x 5,120 logical tiles at 16 source pixels per tile, rendered through the existing 160 x 144 handheld viewport with nearest-neighbor integer zoom. All boss names and encounter concepts are original GB Quest content; D&D creature-type taxonomy is used as the rules classification.

- `src/mmorpg/world/chunk-generation.js` — deterministic seed-based 32x32 terrain chunk generation.
- `tests/mmorpg/chunk-generation.test.js` — deterministic generation and map-boundary tests.

### Colour modes, build identity, story campaign and multiplayer foundation

- Build metadata: `src/mmorpg/data/build-info.json` — developer ArkansasIo, version 0.3.0 alpha, build ID GBQ-20261101-001.
- The handheld shell now displays developer, version and build ID above the device.
- Display settings cycle through DMG green, Pocket colour, Sunset, Amber, Ocean and original full-colour artwork.
- Title screen now offers Campaign and Multiplayer entry points. The Multiplayer screen clearly reports that a live server is not connected yet.
- `src/mmorpg/data/campaign.json` — six acts and eighteen chapters, covering levels 1-720.
- `src/mmorpg/data/quests.json` — 30 main quests and 36 side quests.
- `src/mmorpg/systems/campaign-runtime.js` — quest acceptance, objective progress, completion, reward claiming and act unlock helpers.
- `src/mmorpg/data/multiplayer.json` and `src/mmorpg/net/multiplayer-client.js` — party, raid, chat, presence and secure WebSocket protocol foundation.
- `tests/mmorpg/campaign-quests.test.js` and `tests/mmorpg/campaign-runtime.test.js` — campaign and quest validation tests.

Online multiplayer still requires a deployed authoritative server, account authentication, persistent database and live integration. Campaign and quest records are data-driven foundations; the full 66-quest campaign still needs to be connected to in-game NPCs, maps, objectives and reward UI.
