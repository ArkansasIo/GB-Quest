# MMORPG feature matrix: D20 rules + persistent-world MMO

This is an original Lost Kingdom of Shadowbane Chronicles design using familiar MMORPG genre conventions. It does not reproduce World of Warcraft source code, assets, maps, quest text, named characters, faction names, UI art or other proprietary expression.

## Character and rules
- 9 SRD 5.2.1 species, 12 classes and supported SRD subclasses.
- Backgrounds, ability scores, skills, saving throws, feats, equipment proficiencies and character sheet.
- D20 checks, advantage/disadvantage, initiative, action economy, conditions, rests, death saves and spellcasting.
- Character classes progress through levels 1-20 under the chosen SRD ruleset.
- Paragon ranks 21-720 add non-linear horizontal progression; no uncapped proficiency or attack bonuses.

## MMORPG gameplay modules
- Open-world exploration, zone discovery, map fog, landmarks and fast travel.
- Quest log, quest chains, objectives, dialogue, escort quests, bounties and repeatable tasks.
- NPC schedules, vendors, trainers, repair, banks, mail and auction listings.
- Parties, roles, guilds, guild ranks, guild storage, chat, friends and ignore lists.
- Dungeons, raid instances, encounter phases, boss telegraphs, loot tables and lockouts.
- World events, rare spawns, elite enemies, public objectives and world bosses.
- Professions, gathering nodes, crafting recipes, refinement, repair and item enhancement.
- Mount collection, ground movement, boats, flight routes and portals.
- Reputation, faction standing, achievements, titles, collections and cosmetics.
- PvE first; optional normalized PvP, arenas, battleground-style objectives and territory contests.

## Gear and itemization
- Weapon, armor, shield, trinket, ring, amulet, cloak and cosmetic slots.
- Common through legendary rarity bands with original names, colors and iconography.
- Item level is separate from D20 character level and does not automatically increase attack proficiency.
- Affixes have explicit budgets and diminishing returns.
- Bind-on-pickup, bind-on-equip, tradeable and account-bound flags.
- Durability, repair costs, sockets, runes and upgrade paths are optional configurable systems.
- Loot tables support weights, pity protection where appropriate, party loot rules and audit logs.

## World and content
- World -> continent -> region -> zone -> chunk -> tile hierarchy.
- Chunk streaming, deterministic procedural seeds, handcrafted landmarks and authored quest hubs.
- Biomes, climate, day/night, weather, ambient creatures, resource nodes and faction control.
- Starting experience target: one continent, three zones, one capital, two villages, one dungeon and one group boss.
- Expansion target: four original continents, 24-40 zones, 12 dungeons and three raids.

## Pixel-art content
- 8-bit original art at 8x8, 16x16, 24x24, 32x32 and 48x48 logical sizes.
- Game Boy four-shade profile plus expanded 8-bit palette profile.
- Sprite layers: body, hair, face, class outfit, armor, weapon, offhand and cosmetic.
- Directional animation: idle, walk, run, attack, cast, hurt, death and emotes.
- Tilesets, creatures, equipment, consumables, VFX, world props, UI, map markers and portraits.
- All sprites must be original. Use the procedural atlas generator as a placeholder source, then replace placeholders with reviewed pixel art.

## Multiplayer/backend
- Server-authoritative movement, combat, inventory, loot, currency, crafting, trading and quest state.
- Account authentication, character persistence, session management, party/guild services and moderation.
- Zone instance manager, matchmaking, world event scheduler, chat and mail.
- Database migrations, backups, anti-duplication transactions, rate limits and server-side validation.
- Do not ship server secrets or authoritative drop/loot logic in the browser client.

## UI screens
- Character creation, character select, character sheet, attributes, skills, talents/mastery.
- Inventory, equipment, bank, vendor, auction, crafting and profession windows.
- Quest tracker, quest journal, map, minimap, world map and travel interface.
- Spellbook, abilities, action bars, cooldowns, buffs/debuffs and combat log.
- Party frames, raid frames, guild, friends, chat, mail and social settings.
- Dungeon journal, encounter tracker, achievements, collections and settings.

## Delivery sequence
1. Data contracts and tests.
2. Local playable vertical slice.
3. Complete 1-20 D20 character rules.
4. Content and art pipeline.
5. World streaming and zone generator.
6. MMO systems in offline simulation.
7. Dedicated authoritative server and persistence.
8. Closed multiplayer test, balance, accessibility and performance.
