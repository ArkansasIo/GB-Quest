# GB-Quest repository audit

**Audit date:** 2026-11-02  
**Repository:** `ArkansasIo/GB-Quest`  
**Audited base:** `main` at `07d3ff91c7050f072c0205ab7fa4c3870885728f`

## Executive summary

GB-Quest is a substantial browser-based RPG with a growing modular MMORPG rules layer, a Node.js realm service, a desktop launcher, a native C++23 rules core, asset-generation tooling, and broad automated tests. The repository is not a production-grade authoritative MMO yet. The main risk is the gap between local/client-side gameplay features and server-owned durable state.

This audit distinguishes source-backed implementation from roadmap claims. It does not treat a catalog, protocol message, UI control, or local simulation as proof of a complete online feature.

## Confirmed repository structure

- Browser game and UI: `src/`
- Modular MMORPG layer: `src/mmorpg/{data,net,progression,rules,systems,world}/`
- Realm backend: `backend/server.cjs`, with `server/server.cjs` retained as a compatibility wrapper
- Automated tests: `tests/` and `tests/mmorpg/`
- Native rules core: `native/`
- Desktop launcher and SDL client: `desktop/`
- Asset generation/build tooling: `tools/`
- Architecture and feature documentation: `docs/`

## Verified build and CI state

- Package scripts define `npm test`, `npm run sweep`, `npm run native:build`, and `npm run server`.
- `npm run server` correctly starts `backend/server.cjs`.
- `server/server.cjs` is a backwards-compatible wrapper that requires `backend/server.cjs`. The two documented server paths are therefore not competing implementations; the documentation should explain the wrapper relationship.
- The latest observed GitHub Actions run for the audited `main` commit completed successfully. This is CI evidence, not a substitute for a local reproduction or live-service test.
- The test workflow runs Node tests, native C++ builds/tests, desktop C++ builds, and asset generation.

## Findings and priorities

### P0 — Online item ownership and economy authority

**Evidence:** `docs/SERVER.md` explicitly states that item ownership is not checked on the server and that a modified client could list or trade items it does not own. The realm market API accepts client-supplied item/stack payloads and performs listing/buy/cancel operations against server market records.

**Risk:** A modified client can forge item listings or otherwise manipulate valuable economy state. This is a release blocker for a public economy.

**Required work:**
1. Define one canonical, versioned server-side character/inventory schema.
2. Resolve the authenticated account's selected character and inventory on the server.
3. Move listing, purchase, cancellation, claim, direct trade, and item mutation into atomic server transactions.
4. Use idempotency keys and append-only audit events for valuable operations.
5. Add adversarial API tests proving forged item IDs, quantities, ownership, prices, wallet balances, and duplicate requests are rejected.

**Do not** enable real-money checkout or treat the current client-offer trade protocol as secure settlement.

### P0 — Multiplayer authority boundary

**Evidence:** `docs/INTEGRATION_AND_RELEASE_GATES.md` and `docs/MULTIPLAYER.md` describe host-authoritative battles and a browser presence/relay model. The modular MMORPG documentation says authoritative online combat, drops, currency, progression, and quest rewards remain server work.

**Risk:** Presence, client claims, and host-run local battles are not equivalent to a dedicated authoritative realm simulation.

**Required work:** Add authenticated server-side command handlers, actor ownership checks, per-connection sequence numbers, rate limits, deterministic server resolution, reconnect-safe command IDs, and persistent transaction boundaries. Keep shared-page multiplayer clearly labelled as a limited session mode.

### P1 — Persistence and data model

**Evidence:** The realm backend persists its own JSON database, while the MMORPG systems are independently testable modules. Feature documentation identifies a normalized SQL schema and seed/export workflow as not yet built.

**Risk:** The project has no single durable relational contract for accounts, characters, inventories, equipment, guilds, mail, auctions, progression, and audit history.

**Required work:** Design versioned migrations and a canonical relational schema before adding more disconnected gameplay modules. Keep JSON as a supported local/development adapter if desired.

### P1 — Client/runtime integration

**Evidence:** `src/mmorpg/README.md` states that modules remain separate from the legacy game loop until adapters are complete. It also documents missing UI wiring and incomplete class/subclass progression data.

**Risk:** A tested rules module does not prove that the player can access it through the game or that saves/network behavior preserve its state.

**Required work:** Add explicit adapters and end-to-end tests for character creation, progression, equipment modifiers, spell access, party/instance state, and persistence.

### P1 — NPC AI, factions, and world simulation

**Evidence:** The implementation status identifies reusable hierarchical AI, disposition, faction reputation, faction services, and vendor transaction behavior as outstanding or incomplete.

**Required work:** Implement behavior profiles and state transitions with deterministic tests; connect faction reputation and vendor services through server-owned rules before enabling them online.

### P1 — Platform target completeness

**Evidence:** The native target is a partial C++23 rules core with an optional x86-64 assembly path. The project documentation says it is not a full native game port and that the Game Boy SM83/RGBDS ROM target remains a separate roadmap item.

**Required work:** Keep desktop x86-64 assembly and Game Boy SM83 assembly as distinct build targets. Add a real RGBDS ROM build and emulator smoke tests rather than relabelling the existing x86-64 routine.

### P2 — Documentation consistency

**Evidence:** `docs/FEATURE_STATUS.md` describes itself as last updated at commit `43cefdf` and reports an older test count. The implementation status document is more current and detailed.

**Required work:** Establish one canonical feature-status source and update summaries from verified test/build evidence. Clarify that `server/server.cjs` is a compatibility wrapper for `backend/server.cjs`.

## Recommended implementation sequence

1. **Secure the economy boundary:** inventory ownership, escrow, wallet settlement, idempotency, and audit tests.
2. **Secure multiplayer commands:** authenticated actor ownership, sequence numbers, command validation, server-side combat/reward resolution.
3. **Create canonical persistence contracts:** migrations, character/inventory schema, versioned saves, and adapters.
4. **Integrate existing MMORPG modules:** explicit client/server adapters and end-to-end tests.
5. **Complete NPC/faction/vendor runtime:** deterministic AI and server-owned transactions.
6. **Complete platform targets:** expand the C++ core and build a separate RGBDS handheld target.
7. **Consolidate feature documentation:** mark each system as data-only, local playable, networked prototype, or production-authoritative.

## Audit limitations

This is a repository-level source and documentation audit based on the current default-branch tree, selected implementation files, package scripts, tests, CI workflow definitions, and recent CI status. The full test suite was not executed in this session, no live multiplayer realm was deployed, no adversarial penetration test was run, and no production database was provisioned. Findings should be revalidated as implementation changes land.

## Acceptance criteria for the next implementation phase

- A client cannot create, list, transfer, or claim an item unless the server proves ownership.
- Market and trade operations are atomic and safe to retry.
- Duplicate commands cannot duplicate currency, items, XP, or rewards.
- The server derives all valuable outcomes from authenticated persisted state.
- Integration tests cover both successful and adversarial flows.
- CI passes before a change is merged to `main`.
