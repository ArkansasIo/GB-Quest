# MMORPG modules

The legacy 160x144 renderer remains intact. This modular layer now contains D&D 5e-inspired tabletop rules and a separate WoW-style MMO systems foundation.

## D&D rules
- d20 checks, advantage/disadvantage, proficiency and ability modifiers
- Dice expressions, attack rolls, armor class, saving throws, critical hits and damage mitigation
- Character records, derived statistics, XP thresholds and level 1-20 progression
- Conditions, spell slots, spell attack/DC, concentration state
- SRD species, class, equipment and magic-school catalogs

## MMO systems
- Separate 1-720 progression and talent builds
- Inventory, equipment slots and item-stat aggregation
- Threat/aggro, loot modes, 5-player parties and 20-player raids
- Dungeon/raid instance state, role matchmaking, professions and recipes
- Guilds, reputation, achievements, mounts, world events, economy and PvP rules
- WebSocket client foundation and server command validation

## Integration
Modules are intentionally independent from the legacy game loop until their adapters and tests are complete. D&D character level (1-20) and MMO progression level (1-720) are separate tracks. Client requests must be validated and combat, drops, currency, progression and quest rewards must be computed by the authoritative server.

## Limitations
This is a systems foundation, not a live deployed MMO. It does not reproduce Blizzard's proprietary WoW code, assets, quests or data. D&D content is limited to the cited SRD scope; the class feature, spell and feat catalogs still need full structured coverage and licensing review.
