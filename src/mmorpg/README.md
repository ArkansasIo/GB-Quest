# MMORPG modules

The legacy 160x144 renderer remains intact. The modular layer contains D&D 5e-inspired rules and an independently implemented WoW-style MMO foundation.

## D&D rules runtime
- d20 checks, advantage/disadvantage, proficiency, all 18 skills and expertise
- Dice expressions, attack rolls, armor class, saving throws, critical hits and damage mitigation
- Character creation, derived HP, hit dice, passive perception and level 1-20 XP thresholds
- Short rests, long rests, hit-dice recovery, death saves, stabilization and death state
- Initiative encounters, action/bonus-action/reaction economy
- Conditions, spell slots, spell attack/DC and concentration state
- SRD species, class, equipment, magic-school and skill catalogs

## MMO runtime
- Separate 1-720 progression and talent builds
- Inventory, equipment slots and item-stat aggregation
- Threat/aggro, timed buffs/debuffs, ability cooldowns and loot modes
- 5-player parties, 20-player raid groups, dungeon/raid instance state and role matchmaking
- Professions, recipes, guilds, reputation, achievements, mounts and world events
- Economy, PvP rules, WebSocket client foundation and server command validation

## Integration and authoritative simulation
Modules remain separate from the legacy game loop until adapters are complete. D&D character level (1-20) and MMO progression (1-720) are separate tracks. Client requests must be validated; combat outcomes, drops, currency, progression and quest rewards must be computed by an authoritative server.

## Remaining production work
The current implementation is a tested rules/gameplay foundation, not a deployed MMO. Full class/subclass feature progression, the full licensed SRD spell/feat catalog, persistence, authentication, authoritative server simulation, matchmaking services, UI screens, content authoring and live operations remain to be built. World manifests are catalogs, not fully authored playable scenes.

No proprietary World of Warcraft code, assets, quests or data are copied. D&D data is limited to the SRD scope and attributed in `docs/SRD_ATTRIBUTION.md`.
