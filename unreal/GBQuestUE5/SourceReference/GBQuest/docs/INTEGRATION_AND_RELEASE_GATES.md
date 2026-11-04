# GB-Quest integration and release validation

This document records the current quality gates for Lost Kingdom of Shadowbane Chronicles and the release criteria for the MMORPG systems.

## Repository layers

- Browser game: original 160x144 game loop, scenes, pixel-art asset pipeline and bundled builds.
- Node.js MMORPG modules: independently testable rules, progression, world, inventory, equipment, professions, economy, social and networking modules.
- Native C++23 core: portable native rules layer and desktop target.
- Online services: server-authoritative operations and durable account/character persistence. A client transport or local simulation is not a production MMO service.

## Required validation commands

Run from the repository root:

```sh
npm test
npm run sweep
npm run native:build
```

The native build requires a C++23-capable compiler and CMake. The browser sweep also requires its documented Python/Playwright environment.

## Release gates

### Catalog integrity
- Every item/material/recipe has a stable unique identifier.
- Material tier, rarity grade and level remain in the supported ranges (1-23, 1-9, 1-720).
- Every tiered profession has exactly 23 recipes with a valid profession and material references.
- Every crafted output resolves to a known item template or a supported generated-gear factory.
- Weapon subclass and armour category references must resolve; class proficiency gates must reject invalid equipment.

### Economy integrity
- Currency values use integer copper units and safe-integer bounds.
- Listing, purchase, cancellation, expiration and player trade are atomic on the authoritative server.
- A listing can be purchased only once; retries must be idempotent.
- Escrowed inventory and currency must be restored or committed exactly once.
- Seller proceeds, listing fees and sale taxes must be calculated and recorded in the same transaction.
- Client-supplied prices, ownership, item stats, quantities and wallet balances are never trusted.

### Multiplayer integrity
- Production transport uses WSS and short-lived authenticated sessions.
- The server validates sequence numbers, message shape, actor ownership, rate limits and allowed state transitions.
- Server owns combat outcomes, item creation, currency, quest rewards, loot rolls, trading and auction settlement.
- Reconnect/resume must not duplicate commands or rewards.
- Persisted state changes use transactions and append-only audit events for valuable operations.

### Progression and balance
- D20 class progression ends at level 20 for the selected SRD ruleset.
- Paragon ranks 21-720 are horizontal/mastery progression; they must not increase proficiency or attack bonuses without a separately tested bounded design.
- Item tier, item level, character level and rarity are distinct properties.
- PvP uses normalized brackets and explicit item-power budgets.

### Web and desktop release
- Regenerate browser bundles using the checked-in build tools.
- Validate desktop package contents and platform-specific builds independently.
- Attach build artifacts to a tagged release only after all required jobs pass.
- Keep credentials and service secrets out of browser bundles and repository files.

## Known scope boundary

The existing offline simulation, browser presence prototype and WebSocket client are foundations. They do not alone establish a deployed authoritative realm, production authentication, database persistence, anti-cheat controls, or real-time player combat. Treat those as separate deployment milestones, not as completed multiplayer features.
