# Browser game to Unreal Blueprints

This port replaces the HTML canvas game with an Unreal-native, Blueprint-driven 2D game. The existing browser build remains the behavior and content reference until each Unreal milestone reaches parity. The browser wrapper is not the target runtime.

## Source scope

The game runtime loads in a fixed order from `index.html`: shared data and generation, the 160x144 renderer and input loop, character rules and combat, persistent state and scenes, then the browser entry point. `src/mmorpg/` adds a second rules and online-game layer. The port therefore covers substantially more than the C++ wrapper under `Source/`.

| Browser source | Unreal destination |
| --- | --- |
| `src/data_rules.js`, `src/data_world.js`, `src/mmorpg/data/`, and root `data/` | DataTables and Primary Data Assets under `Content/Data` |
| `src/rules.js`, `src/mmorpg/rules/`, `src/mmorpg/progression/` | Blueprint function libraries for dice, character derivation, checks, rests, and progression |
| `src/gen.js`, `src/mmorpg/world/` | Seeded world, zone, encounter, and loot generation functions |
| `src/systems.js`, `src/mmorpg/systems/` | GameInstance subsystems for inventory, quests, economy, professions, social, and account state |
| `src/combat.js` | Battle state machine and combatant/effect Blueprints |
| `src/scenes_world.js` | World, town, dungeon, battle, and map UMG screens with a shared navigation stack |
| `src/scenes_menu.js`, `src/inventory.js`, and other UI modules | Reusable UMG widgets for menus, equipment, inventory, quests, crafting, and settings |
| `src/engine.js`, `src/video64.js`, `src/art.js`, `src/audio64.js` | Pixel-art presentation, palette/post-process options, animation, sound, and music assets |
| `client/main.js` | Blueprint boot flow, save loading, autosave, and top-level UI routing |
| `backend/`, `server/`, multiplayer rules | Separate online milestone; keep server authority and validation outside client Blueprints |

## Port order

1. **Project foundation:** replace the browser GameMode/widget with a native 2D game entry point, input mapping, save model, and top-level UMG navigation.
2. **Deterministic rules and data:** import the canonical classes, items, spells, creatures, regions, quests, and progression data; port seeded dice, character creation, stat derivation, XP, and rests.
3. **Playable loop:** title and creation screens, field movement, generated encounters, turn-based battle, rewards, death, and save/load. Compare each loop against the browser build.
4. **Core RPG screens:** character sheet, inventory/equipment, spellbook, quests, map, services, loot, and level-up.
5. **World content and systems:** towns, instances, crafting, professions, achievements, factions, companions, mounts, and generated world events.
6. **Online features:** port the client flows and preserve backend-authoritative account, realm, trading, chat, and multiplayer behavior.
7. **Presentation and parity:** port audio, visual modes, atlas, accessibility/settings, remaining menus, and migration of existing browser saves where practical.

## Parity checks for each milestone

- Use fixed seeds and compare generated zones, encounters, loot, and dice outcomes with the browser implementation.
- Compare character stats and derived combat values at representative levels and equipment states.
- Walk the same start-to-save gameplay path and verify that state survives reload.
- Keep browser and Unreal implementations separate during migration; remove the web wrapper only after all required systems have native equivalents.

## Current status

`create_blueprints.py` now clones source files into `SourceReference/GBQuest`, imports the existing art as Unreal textures, creates empty Blueprint scaffolds, and writes a per-file mapping manifest. These steps organize the migration but do not translate gameplay logic. The Unreal Editor's Python API can create and compile Blueprint assets, but this script does not generate the event-graph logic required for a faithful game port.
