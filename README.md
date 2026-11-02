# GB Quest: Lanterns of Aelmoor

**A Game Boy–style MMORPG with d20 rules — by ArkansasIo**
Version 2.0.0 (build B2026.11.01)

A 160×144 handheld RPG running in the browser. You can play in DMG green, Game Boy Color, Pocket or full colour palettes.

It combines:

- 5e-style tabletop rules: d20 rolls, ability scores, armour class, saving throws, spell slots and death saves.
- An MMO shell modelled on World of Warcraft: quests, loot rarity, dungeons, raids, an auction house, guilds, mounts and live players.
- A Diablo-style campaign: acts, chapters, waypoints and renown.

All art comes from the original asset sheet in `src_sheet/sheet.png`, or is generated from it.

## Play

- **Single file:** open `dist/gbquest.html` in any browser.
- **Dev build:** run `python3 -m http.server` in this folder, then open `http://localhost:8000`.
  The dev build loads `src/*.js` and `assets/*.png` directly.

**Controls**

| Input | Keyboard | Action |
|---|---|---|
| D-pad | Arrows / WASD | Move, navigate menus |
| A | Z / Space | Talk, act, confirm |
| B | X / Esc | Back; mount or dismount in the field |
| START | Enter | Main menu |
| SELECT | Shift / Tab | World map; toggles auto-battle in combat |

On phones, use the on-screen buttons.

## What's in the game

| System | Details |
|---|---|
| Rules | 9 attributes (STR DEX CON INT WIS CHA LCK WIL SPD), proficiency, AC, saves, 18 skills, advantage and disadvantage, crits, death saves, short and long rests, hit dice, concentration, attunement (3 items) |
| Characters | 6 species, 6 backgrounds, 12 classes with 24 subclasses, ability score increases or feats at levels 4/8/12/16/19 |
| Levels | 1–720. Levels 1–20 follow class progression. Levels 21–720 are ascension levels: +1 attribute and +2 substat points per level, plus a mythic boon every 50 levels |
| Magic | 59 spells, cantrips to level 9, across 8 renamed schools: Aegis, Calling, Omen, Thrall, Storm, Veil, Grave, Flux. Full, half and pact casters, plus mystic arcana |
| Combat | Initiative, multiattack, 20 conditions, 30 buffs and debuffs, 13 damage types, resistances, threat and tanking, legendary actions and resistances, recharge abilities, boss phases (enrage, summon, shield, curse and more), AI companions |
| Gear | 17 weapons, 11 armours, wondrous items. Six rarities (poor to legendary) with +1/+2/+3 bonuses and Diablo-style substat affixes |
| World | Continent of Aelmoor: 28 regions split into 90 zones across 9 biomes and 36 sub-biomes, with weather, waypoints, a parchment world map and a capital city hub |
| Story | Written prologue, 12 acts, 50 chapters, and 6 generated side quests per zone |
| Bestiary | 400 creatures (14 types, 55 subtypes, 7 elemental variants, elites) |
| Bosses | 350: 12 arc bosses, 177 world bosses, 66 dungeon, 45 raid, 30 trial and 20 tower bosses |
| Endgame | 22 dungeons, 9 raids (12 players), 6 trials, the 100-floor Spire, 9 difficulty tiers (Story to Apocalypse), 5 expansions covering levels 40–720 |
| MMO features | Auction house, mail, bank, guilds, reputation with 5 factions, arena with honor and rating, need/greed loot rolls, mounts, pets, a hearthstone, 36 achievements, a simulated realm with NPC players and chat |
| Professions | Herbalism, Alchemy, Fishing (timing minigame), Cooking |
| Multiplayer | 1, 4 or 12 player modes. When the page is shared, live players appear on the map with chat. A built-in host server lets friends fight in your party: the host runs each battle and guests take their own turns. A realm leaderboard is shared between players. |
| Audio | 4-channel chip synth (2 pulse, wave, noise), 103 sound effects and 24 procedural music tracks, with a sound test screen |
| Engine | Fixed 60 fps, scene stack, sprite and palette pipeline (DMG dithering, GBC 4-colour palettes per sprite), physics bodies and particles, save slots, autosave, live-update snapshots |

## Files

```
src_sheet/sheet.png        original asset sheet
tools/extract_assets.py    slices the sheet into assets/*.png
tools/gen_assets.py        biome tilesets, monster variants, class looks, pixel icons
tools/make_font.py         6x9 bitmap font
tools/build.py             builds index.html, dist/gbquest.html and assets/index.json
src/data_rules.js          d20 rules: classes, species, spells, weapons, armour, monsters
src/data_world.js          attributes, buffs, difficulty, zones, story, bosses, expansions
src/gen.js                 RNG, dice, bestiary, bosses, zone/dungeon/tower generators, loot
src/engine.js              renderer, palettes, text, input, audio, physics, scenes
src/rules.js               character derivation, checks, rests, levelling, monster stat blocks
src/combat.js              the battle engine
src/systems.js             saves, quests, achievements, professions, realm, multiplayer
src/scenes_world.js        boot, title, creation, field, services, instances, map
src/scenes_menu.js         menus, sheets, bag, equipment, settings, sound test
src/main.js                entry point
```

Rebuild after any change:

```
python3 tools/extract_assets.py && python3 tools/gen_assets.py   # only if the sheet changes
python3 tools/build.py
```

## Node rules module, data catalogs and tests (`src/mmorpg/`, `world/`, `docs/`)

A separate, test-covered Node.js implementation of the rules and world data lives alongside the playable build. Run its tests with `npm test` (Node.js 20+); CI runs them on every push.

The original v1 game (`legacy/game.js` + `legacy/data.js`) is kept for reference.

### MMORPG expansion notes

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


## Roadmap

- C++23 + SDL2 desktop port of the full game.
- Game Boy Color ROM (RGBDS assembly) of a core version that fits real hardware.

## Legal

All names, lore and story are original to GB Quest.

The rules engine models mechanics from the System Reference Document 5.1 by Wizards of the Coast LLC, which is available under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/legalcode). No book text is reproduced.
