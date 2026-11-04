# Lost Kingdom of Shadowbane Chronicles MMORPG Design

## Vision
Expand Lost Kingdom of Shadowbane Chronicles into an original 2D online RPG combining tabletop-inspired d20 rules with persistent-world MMORPG conventions. Preserve the existing 160x144 Game Boy presentation as a supported retro display profile.

## Compatibility and content boundaries
- Implement original code and original setting/content.
- Use the D&D 5e System Reference Document (SRD) as the reference for compatible mechanics where its license permits.
- Do not copy non-SRD rulebook text, proprietary adventure text, setting lore, stat blocks, illustrations, logos, sounds, or other protected content.
- WoW is a feature reference only: do not reproduce its maps, named characters, quests, art, audio, UI trade dress, or proprietary data.
- Keep license notices and attribution with any SRD-derived material as required by its license.

## Game pillars
1. Tactical d20 combat with action economy, checks, saves, conditions, spellcasting and equipment.
2. A seamless-feeling overworld divided into authored and procedurally generated regions.
3. Quest hubs, factions, dungeons, world bosses, group instances and raid encounters.
4. Character progression, professions, crafting, gathering, economy and social systems.
5. Persistent server-authoritative multiplayer with client-side prediction only for presentation.
6. Scalable rendering: 160x144 retro mode, integer-scaled handheld mode, and larger desktop/mobile viewports.

## Player progression
- Character levels 1-20 for the SRD-compatible rules layer.
- Optional account-wide exploration, collection, reputation and cosmetic progression.
- Classes, subclasses, species, backgrounds, ability scores, skills, feats, equipment and spells are data-driven.
- XP, milestone and seasonal progression are configurable by world ruleset.

## Combat
- d20 checks: d20 + ability modifier + proficiency where applicable.
- Combat turn order uses initiative; each combatant receives movement and the actions permitted by the selected ruleset.
- Model action, bonus action, reaction, attack, spell, saving throw, concentration, condition and death-save flows explicitly.
- Keep combat resolution deterministic on the server and record combat events for replay/debugging.
- Avoid mixing tabletop rules with MMO cooldown conventions silently; each ability declares its rules profile.

## MMORPG features
- Quest chains, daily/weekly activities, public events, world bosses and instanced dungeons.
- Party finder, parties, guilds, chat channels, mail, trading, auction house and social presence.
- Professions: gathering, crafting, cooking, alchemy, enchanting-style item enhancement and archaeology-style discovery, implemented with original names and recipes.
- Roles and encounter mechanics are game-design systems, not hard-coded class restrictions.
- PvE first; PvP, battlegrounds and territory systems are optional later modules.

## World scale
Use a hierarchical world model rather than one enormous tile array:
- Planet/world -> continent -> region -> zone -> map chunk -> tile.
- Each zone stores metadata, biome, climate, level band, faction control, points of interest, travel links and spawn tables.
- Chunks stream around the player and can be unloaded outside the active radius.
- Store world coordinates in integer tile units; render coordinates are derived.
- Use 16x16 tiles initially. Keep tile size and pixels-per-tile configurable.
- Start with 4 original continents, 6-10 zones per continent, and 4-8 subregions per zone as content targets, not hard limits.
- Define a world scale in meters per tile only after movement speed and travel-time tests. Do not claim a direct one-to-one copy of any existing game's map dimensions.
- Use portals, boats, flight paths and instance transitions to connect distant areas.

## Content targets
Initial vertical slice:
- 1 starting continent, 3 zones, 1 capital, 2 villages, 1 dungeon, 1 group boss.
- 12 classes as data definitions where supported by the selected rules reference.
- 10 original enemy families, 30 quests, 3 professions and 50 original items.
- Solo play locally before network persistence is enabled.

Expansion targets:
- 4 continents, 24-40 zones, 5 capital cities, 12 dungeons and 3 raids.
- World events, factions, guild progression, player economy and seasonal content.

## Technical architecture
- Keep current game.js and data.js operational during migration.
- Add modular systems under src/mmorpg/ using ES modules, then integrate incrementally through a single adapter.
- Separate rules, simulation, world data, UI, persistence and networking.
- Server is authoritative for movement validation, combat, inventory, currency, loot, trading and quest completion.
- Client predicts movement and renders effects but reconciles against server snapshots.
- Version all save data and content manifests.

## Non-functional requirements
- Stable 60 FPS target on desktop; adaptive performance on mobile.
- Pixel-perfect rendering with nearest-neighbor scaling.
- Chunk streaming and bounded memory use.
- Input remapping, keyboard, touch and gamepad support.
- Automated unit tests for rules, combat, loot, progression and world generation.
- No secrets or credentials in the client or repository.
