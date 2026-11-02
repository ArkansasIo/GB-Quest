# Lost Kingdom of Shadowbane Chronicles

**A Game Boy–style MMORPG with d20 rules — by ArkansasIo**
Version 2.1.1 (build B2026.11.01) · [Changelog](CHANGELOG.md) · [Documentation](docs/README.md) · [Game design document](docs/GDD.md)

A 160×144 handheld RPG running in the browser. **Lost Kingdom of Shadowbane Chronicles** is the base game; its expansion lineup is **Eternal Odyssey**, **Dragonfire Realm**, **Emberfell Saga**, **Wizard’s Dominion**, **Plagueborn Legacy**, **Crystalized Realms**, **Frostsong Dynasty**, **Arcane Ascension**, **Bloodmoon Conspiracy**, **Dragonspire Odyssey**, **Whispers of Valhalla**, **Nightshade Chronicles**, and **Mythical Meadowlands**. You can play in DMG green, Game Boy Color, Pocket or full colour palettes.

It combines:

- 5e-style tabletop rules: d20 rolls, ability scores, armour class, saving throws, spell slots and death saves.
- An MMO shell modelled on World of Warcraft: quests, loot rarity, dungeons, raids, an auction house, guilds, mounts and live players.
- A Diablo-style campaign: acts, chapters, waypoints and renown.

All art comes from the original asset sheet in `src_sheet/sheet.png`, or is generated from it.

## Play

- **Single file:** open `dist/gbquest.html` in any browser. It opens in the desktop game window layout.
- The game defaults to a full-window layout. Click **FULL SCREEN** or press **F** to enter the browser's native full-screen mode.
- **Full-screen window:** open `dist/gbquest-fullscreen.html`. The screen fills the window, with a full-screen toggle, 1:1 pixel scaling, an overlay pad and overlay chat.
- **Full-screen mode:** open **START → SETTINGS → FULL SCREEN** in either browser build to expand the game to the browser window; the setting is saved between sessions.
- **World atlas:** open `dist/atlas.html` for the interactive map of Valendria, or press **M** in game.
- **Dev build:** run `python3 -m http.server` in this folder, then open `http://localhost:8000`.
  The dev build loads `src/*.js` and `assets/*.png` directly.

### Windows and macOS desktop app

The Electron desktop app opens a regional launcher before the game. Choose North America, Europe, Japan or Oceania, select a logical data center and world, and optionally connect to a realm server to register or sign in. The launcher checks `/api/health` and `/api/realms`; remote realm URLs must use HTTPS. Account sessions use OS-backed encrypted storage where available. The current backend is still one shared realm service: the 11 data centers and 85 worlds are launcher-side logical destinations, not yet separate live deployments. Character selection and region-aware world routing remain future work. To build locally, install Node.js 22+, then run `npm install`, `node tools/build.cjs`, and `npm run desktop:dev`. Create installers with `npm run desktop:dist -- --win` on Windows or `npm run desktop:dist -- --mac` on macOS. Windows creates an installer and portable executable; macOS creates Intel and Apple Silicon DMG/ZIP packages. Builds are also available from the **Desktop packages** GitHub Actions workflow.

Desktop packages are currently unsigned. Windows may show a SmartScreen prompt, and macOS may require opening the app from Finder's context menu. See [desktop/README.md](desktop/README.md).

**Controls**

| Input | Keyboard | Action |
|---|---|---|
| D-pad | Arrows / WASD | Move, navigate menus |
| A | Z / Space | Talk, act, confirm |
| B | X / Esc | Back; mount or dismount in the field |
| START | Enter | Main menu |
| SELECT | Shift / Tab | World map; toggles auto-battle in combat |
| Number row | 1–9 / 0 | Use the matching combat hotbar action |
| — | M | Atlas of Valendria (F full screen, C chat, F3 profiler) |

On phones, use the on-screen buttons. The full list of controls is in [docs/CONTROLS.md](docs/CONTROLS.md).

Choose **START → SETTINGS → COMBAT MODE → REAL-TIME** to enable action combat. Your hotbar actions share a global cooldown, active skills have their own cooldowns, and enemies and AI companions act automatically. In combat, **B** dodges and **Enter** pauses or resumes.

## What's in the game

| System | Details |
|---|---|
| Rules | 9 attributes (STR DEX CON INT WIS CHA LCK WIL SPD), proficiency, AC, saves, 18 skills, advantage and disadvantage, crits, death saves, short and long rests, hit dice, concentration, attunement (3 items) |
| Characters | 9 species, 6 backgrounds, 16 classes with 32 subclasses, ability score increases or feats at levels 4/8/12/16/19 |
| Levels | 1–720. Levels 1–20 follow class progression. Earn points every 3 levels to learn class-specific active skills and passives; levels 21–720 also grant +1 attribute and +2 substat points, plus a mythic boon every 50 levels |
| Magic | 59 spells, cantrips to level 9, across 8 renamed schools: Aegis, Calling, Omen, Thrall, Storm, Veil, Grave, Flux. Full, half and pact casters, plus mystic arcana |
| Combat | Initiative, multiattack, 20 conditions, 30 buffs and debuffs, 13 damage types, resistances, threat and tanking, legendary actions and resistances, recharge abilities, boss phases (enrage, summon, shield, curse and more), AI companions |
| Gear | 17 weapons, 11 armours, wondrous items. Six rarities (poor to legendary) with +1/+2/+3 bonuses and Diablo-style substat affixes |
| World | The continent of Valendria: 28 regions split into 90 zones across 9 biomes and 36 sub-biomes, with weather, waypoints and a capital city hub. The world map shows roads and sea lanes. The interactive Atlas adds search, layers, zone details and a route planner. |
| Story | Written prologue, 12 acts, 50 chapters, and 6 generated side quests per zone |
| Bestiary | 400 creatures (14 types, 55 subtypes, 7 elemental variants, elites) |
| Bosses | 350: 12 arc bosses, 177 world bosses, 66 dungeon, 45 raid, 30 trial and 20 tower bosses |
| Endgame | 22 dungeons, 9 raids (12 players), 6 trials, the 100-floor Spire, 9 difficulty tiers (Story to Apocalypse), 5 built-out expansion worlds covering levels 40–720; 13 expansion titles are listed in the game metadata |
| MMO features | Dungeon/raid/activity finder, a 100-floor tower finder, scheduled public event finder, auction house, mail, bank, guilds, reputation with 5 factions, ranked arena, flagged open-world PvP, two objective battlegrounds, honor gear, need/greed loot rolls, mounts, pets, a hearthstone, 36 achievements, a simulated realm with NPC players and chat |
| Housing | Buy a home in the capital, harbor ward or Elderwood village. Rest for free, store gear, upgrade chest space, decorate, and bind your hearth; a study desk improves profession skill gains. |
| Professions | 14 gathering and crafting jobs with 720 skill ranks, 720-point specialization trees, profession quests and work orders. Learn recipe blueprints with profession skill and gold; cooking includes fish, herb and feast recipes. Smithing tiers reach Grandmaster. |
| Multiplayer | 1, 4 or 12 player modes. When the page is shared, live players appear on the map with chat. A built-in host server lets friends fight in your party: the host runs each battle and guests take their own turns. A realm leaderboard is shared between players. |
| Audio | Two engines. **Chip 4CH**: 2 pulse, wave and noise channels. **64-bit**: stereo, 8 voices, reverb, echo and a compressor, with strings, brass, flute, harp, FM bells, choir, organ, piano, bass and a full drum kit. 103 + 8 sound effects and 24 tracks, each with an orchestral arrangement, plus a sound test. |
| Engine | Fixed 60 fps, scene stack, sprite and palette pipeline (DMG dithering, GBC 4-colour palettes per sprite), physics bodies and particles, an Events bus, Tween, Cam, a game Clock, a Profiler, save slots, autosave |
| Video | **Game Boy** at 160×144, or **64-bit**: Scale4x at 640×576, full colour, a day/night cycle, dynamic lights, bloom, vignette and camera pulses. The 64-bit asset atlases (2,236 sprites at 4×) are in `assets_hd64/`. |

## Files

```
src_sheet/sheet.png        original asset sheet
tools/extract_assets.py    slices the sheet into assets/*.png
tools/gen_assets.py        biome tilesets, monster variants, class looks, pixel icons
tools/gen_gbtiles.py       crisp 16x16 Game Boy pixel art: terrain for 9 biomes (auto-tiled roads
                           and shores, animated water), buildings, 6 dungeon themes, map objects,
                           and walking sprites for 12 classes + 8 NPC looks
tools/make_font.py         6x9 bitmap font
tools/make_worldmap.py     pixelates src_sheet/world_map.png (VALENDRIA) into the world map art
tools/slice_sheets.py      slices the NES-style sheets (monsters, equipment, class/species
                           portraits) into ~1,100 sprites + assets/nes_index.json
tools/build.py             builds index.html, dist/gbquest.html and assets/index.json
src/data_rules.js          d20 rules: classes, species, spells, weapons, armour, monsters
src/data_world.js          attributes, buffs, difficulty, zones, story, bosses, expansions
src/gen.js                 RNG, dice, bestiary, bosses, zone/dungeon/tower generators, loot
src/engine.js              renderer, palettes, text, input, chip audio, physics, scenes
src/audio64.js             64-bit audio engine: synth instruments, drum kit, reverb, arrangements
src/video64.js             64-bit video (Scale4x, lighting, bloom) + Events, Tween, Cam, Clock, Profiler
src/rules.js               character derivation, checks, rests, levelling, monster stat blocks
src/combat.js              the battle engine
src/systems.js             saves, quests, achievements, professions, realm, multiplayer
src/scenes_world.js        boot, title, creation, field, services, instances, map
src/scenes_menu.js         menus, sheets, bag, equipment, settings, sound test
client/main.js             front-end entry point, embedded Atlas overlay
client/shell.html          desktop/mobile client shell; client/fullscreen.html full-screen layer
backend/server.cjs         MMORPG realm/account/multiplayer backend
store/catalog.cjs          server-owned store catalog and checkout contract
admin/                     restricted admin control plane (`/admin`)
atlas/atlas_template.html  interactive Atlas of Valendria (built into dist/atlas.html)
tools/export_atlas.cjs      exports zones, roads, bosses and quests for the atlas
tools/build_atlas.py       builds dist/atlas.html
tools/gen_hd64.py          64-bit sprite atlases -> assets_hd64/
tools/gen_docs.cjs          generated reference docs -> docs/STORY, CHARACTERS, CONTENT_CATALOG, WORLD_ATLAS
docs/                      GDD, architecture, UML, audio, graphics, multiplayer, build, controls
```

Rebuild after any change:

```
python3 tools/extract_assets.py && python3 tools/gen_assets.py   # only if the sheet changes
python3 tools/gen_gbtiles.py                                     # Game Boy pixel tiles and sprites
python3 tools/make_worldmap.py && python3 tools/slice_sheets.py # VALENDRIA map + NES art sheets
python3 tools/build.py        # also builds the atlas and the full-screen build
node tools/gen_docs.cjs        # regenerate reference docs
python3 tools/gen_hd64.py     # regenerate 64-bit atlases
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

The MMORPG modules are a separately tested rules and data layer. The original v1 browser game is preserved under `legacy/`; the newer v2 game is the active browser build.

### Native C++ rules demo

The legacy v1 game includes a **NATIVE CORE** screen that calls the C++23 rules library through a loopback-only Node.js API. Its self-contained browser build is preserved at `legacy/gbquest-native-demo.html`.

```sh
npm run native:build
npm start
```

Open `http://127.0.0.1:8000/legacy/gbquest-native-demo.html` and choose **NATIVE CORE**. Press A to roll again. The native core receives a caller-rolled d20 result; random-number generation remains outside the rules library. The single-file build does not provide this native API.

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

The D20 class progression ends at level 20. Levels 21-720 are Lost Kingdom of Shadowbane Chronicles Paragon ranks, focused on mastery, professions, exploration, collections, cosmetics and world renown. This preserves bounded accuracy while supporting long-term MMORPG progression.

Run `npm test` with Node.js 20+. Run `python tools/generate_pixel_assets.py` to generate starter atlases. These are original procedural placeholders, not final production art.

### 350 bosses, monster taxonomy and world-scale map

- `src/mmorpg/data/bosses-350.json` — 300 world bosses and 50 arc bosses.
- `src/mmorpg/data/monster-taxonomy.json` — 14 D&D-style creature types and 20 original monster combat classes with subclass archetypes.
- `world/manifests/world-scale.json` — four continents, 40 zones, 512x512 tiles per zone, 32x32 tile chunks and 10,240 streamable chunks.
- `docs/BOSSES_MONSTERS_AND_WORLD_MAP.md` — encounter and world-map design.
- `tests/mmorpg/bosses-world.test.js` — catalogue and map integrity tests.

The map target is 2,048 x 5,120 logical tiles at 16 source pixels per tile, rendered through the existing 160 x 144 handheld viewport with nearest-neighbor integer zoom. All boss names and encounter concepts are original Lost Kingdom of Shadowbane Chronicles content; D&D creature-type taxonomy is used as the rules classification.

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

### PvP, war mode and battlegrounds

The honor quartermaster in Ardenhold offers a persistent PvE/PvP war-mode flag, ranked arena matches, and two playable 3v3 battleground queues: Banner Run and Waystone Control. In war mode, flagged heroes can attack hostile simulated realm players in non-town zones; towns remain safe. PvP fights do not grant monster XP or loot, and repeat victories against the same rival award less honor. Battlegrounds use five distinct capture objectives and end when a team reaches three captures.

These are local PvE-driven simulations using the game's combat system and simulated realm heroes. The existing presence-sharing prototype does not provide authoritative live player combat; online PvP requires a deployed server that validates challenges, movement, combat and rewards.


## Roadmap

- Expand the independent C++23 + SDL2 native port; the installable Windows/macOS desktop app currently runs the complete browser game in Electron.
- Game Boy Color ROM (RGBDS assembly) of a core version that fits real hardware.

## Legal

All names, lore and story are original to Lost Kingdom of Shadowbane Chronicles.

The rules engine models mechanics from the System Reference Document 5.1 by Wizards of the Coast LLC, which is available under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/legalcode). No book text is reproduced.
