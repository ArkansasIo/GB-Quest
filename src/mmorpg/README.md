# MMORPG modules

This directory is the new modular expansion layer. The legacy single-file engine remains the active runtime until each subsystem has tests and an integration adapter.

## Modules
- rules/: d20 rules primitives and later combat, conditions, spells, progression.
- world/: coordinate math, chunk streaming, zone manifests and procedural generation.
- systems/: quests, inventory, equipment, crafting, professions, parties, guilds and economy.
- net/: authoritative protocol, snapshots, validation and persistence adapters.

## Integration policy
Do not import these modules from the legacy game until the build pipeline supports module bundling and the feature has tests. Avoid rewriting the current game.js wholesale.
