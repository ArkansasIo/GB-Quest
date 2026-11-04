# D&D 5e + MMORPG systems roadmap

## Rules layer
The rules modules provide d20 checks, dice expressions, ability modifiers, proficiency, attack rolls, armor class, saving throws, critical hits, damage types, conditions, spell slots, concentration state, character creation and D&D level progression.

## MMO layer
The MMO modules provide a separate 720-level progression track, talent builds, equipment slots and stat aggregation, threat/aggro, loot distribution modes, 5-player parties, 20-player raid groups, encounter instances, professions/recipes, copper-denominated wallets, vendor quotes, PvP eligibility and client command validation.

## Design boundary
D&D character levels are capped at 20 in the SRD rules layer. The game's MMO progression track is separately capped at 720. These are not interchangeable: D&D level governs rules proficiency and class progression; MMO level is the long-form game progression layer.

## Planned integration
1. Connect character creation to a character-select flow and persist character records server-side.
2. Bind the existing game combat scene to a rules adapter without replacing its renderer.
3. Connect zone manifests to NPC, spawn, quest, gathering and instance definitions.
4. Add authoritative WebSocket server, database persistence, party/raid matchmaking and anti-cheat validation.
5. Add UI screens for talents, spellbook, equipment, professions, guilds, auction house, PvP and raid finder.

## Production status
These files are engine foundations and pure logic modules. They do not constitute a live MMO server, complete client UI, complete SRD feature database, or all authored World of Warcraft content. The world, progression and combat systems still require integration and balancing.
