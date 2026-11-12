# Lanterns of Aelmoor — Expansion Systems

This change adds a modular expansion layer without replacing the legacy 160×144 game loop.

## New runtime modules
- `src/mmorpg/systems/guild-operations.js`: permission-gated rank management, guild bank ledger, MOTD, scheduled guild events, war declarations, upgrade purchases and bounded audit history. The server remains responsible for persisting state and verifying currency/inventory atomically.
- `src/mmorpg/systems/collections.js`: mount, pet, title, appearance and achievement unlocks; active mount/pet/title selection; achievement points and catalogued rewards.
- `src/mmorpg/systems/expansion-menu.js`: menu navigation model with availability derived from character, guild, collection and online-session state.
- `src/mmorpg/data/expansion-catalog.json`: five original regions, five dungeons, three raids, eight professions, guild upgrades and achievement rewards.
- `assets/mmorpg/lanterns-of-aelmoor/expansion-atlas.svg`: original crisp-edge SVG pixel-art atlas with 32px icons for character classes, gear, magic, materials, creatures and environments.

## Integration contract
These modules are deterministic client/domain helpers, not a substitute for server authority. The authoritative MMORPG service must validate account ownership, realm membership, permission grants, bank balances, upgrade costs, reward eligibility and event timing inside database transactions. Never accept client-supplied balances, item ownership, achievement completion or war outcomes.

## Test
Run `npm test`. The expansion test file exercises authorization, ledger accounting, event membership, war declaration, upgrade costs, collection unlock idempotency, rewards and menu availability.

## Art direction
The atlas uses a limited navy, slate, forest, amber, cream, ember and violet palette. SVG uses a 32px grid and `shape-rendering="crispEdges"` so it scales cleanly in the handheld viewport and high-resolution UI.
