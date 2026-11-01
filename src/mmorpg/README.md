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
- 322 SRD 5.2.1 monster stat blocks with search/filter, CR/XP lookup, hit-point rolling, initiative and encounter composition

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


## Monster bestiary
`src/mmorpg/data/monsters.json` contains the structured SRD 5.2.1 monster dataset. `systems/monsters.js` exposes lookup, search/filter, combatant creation, hit-point rolling, initiative, XP lookup and encounter composition. Monster trait/action text is retained as source data; complex abilities still require dedicated rule handlers before they can be resolved automatically by the combat engine. The dataset is attributed under CC BY 4.0 in `docs/SRD_ATTRIBUTION.md`.

## D&D equipment and itemization
- SRD weapon and armor catalogs, including weapon mastery metadata, damage dice, range, properties, armor class, stealth and Strength requirements.
- Adventuring gear, tools, equipment packs, mounts, vehicles and magic-item catalog entries.
- Item instances with rarity, item level, binding, durability and repair.
- The catalog includes 38 weapons, 13 armor/shield entries, 67 adventuring gear entries, 31 tools, 7 equipment packs, 17 mounts/vehicles and 24 magic-item entries.

## MMORPG service systems
- Auction house listings reserve seller inventory in escrow, charge listing/sale fees, deliver purchases, credit seller proceeds when a seller wallet is supplied, and return cancelled/expired escrow payloads for delivery.
- Character mail supports one-time atomic claims that stage attachments against inventory capacity/weight before crediting currency; failed claims remain retryable.
- Appearance/mount/title collections and transmog unlocks.
- Role-based dungeon finder queue for tank/healer/damage compositions.
- Map registry for the 90-map atlas.

The MMO systems are original implementations inspired by common MMORPG design patterns. They do not use World of Warcraft source code, art, names, quest text or proprietary game data.


### Economy transaction boundaries
Auction listing requires `sellerInventory` and `sellerWallet`; the listed quantity is removed immediately and the listing fee is charged. `buyAuction` adds the item to the buyer inventory before debiting the buyer; pass the seller wallet as the final argument to credit proceeds in the same in-memory operation. If omitted, the result returns `sellerProceedsCopper` for an external settlement adapter. `cancelAuction` requires the seller inventory to receive escrow back. `expireAuctions` returns expired escrow payloads to the caller for delivery; a persistent server must process that delivery idempotently before acknowledging expiry. Use `claimMailToCharacter` for inventory-and-wallet delivery; `claimMail` is retained only as a legacy payload API for callers that implement their own transaction.


### Spell execution runtime
`rules/spell-runtime.js` resolves supplied spell records against one or more targets. It validates range, known/prepared state when populated, slot availability, action economy, dice expressions and condition IDs before spending costs. Supported effects include spell attacks, saving throws, damage and resistance, critical hits, upcast damage, healing capped at maximum HP, timed conditions and concentration. This is an execution engine, not a complete spell catalog; full SRD spell records, class access/preparation rules and spell-specific exceptions remain separate work.


### SRD spell records
`data/spells.json` and `systems/spell-catalog.js` provide a compact, searchable mechanical catalog of eight SRD 5.2.1 spells across cantrips and levels 1–2. Records include casting action, range, components, damage/save/healing/concentration metadata. `rules/spell-runtime.js` resolves supported fields. This is a starter subset, not the complete SRD spell list; spell-specific targeting geometry, class preparation/access, material components, and every unique spell rider still need implementation.


### D&D class progression runtime
`rules/class-progression.js` provides a data-driven level advancement layer for the 1–20 D&D class track, separate from MMO/paragon progression. It applies one class level at a time, grants feature identifiers from supplied progression rows, exposes subclass unlock choices, validates subclass selection before mutating progression state, and grants subclass features at the selected level. It intentionally does not fabricate missing SRD feature tables: class/subclass progression data must be authored and attributed separately before those features can be granted in-game.

### Class-specific spell access
`rules/spell-access.js` provides configurable spell access policies without inventing class spell lists. A class/ruleset data record supplies the allowed spell IDs, access mode (`known` or `prepared`), and optional known/prepared limits. Characters can learn, prepare and unprepare spells; the casting runtime checks the configured policy before spending a spell slot or action. The actual per-class spell lists and limits still need to be populated from the applicable SRD rules.

### Class resource runtime
`rules/class-resources.js` provides a generic resource-pool engine for class and subclass abilities. Class data supplies resource IDs, level-based or fixed maximum uses, recovery trigger (`short_rest`, `long_rest`, `turn`, `manual`, or `never`), and spendability. The runtime supports configuration/reconfiguration, spending, trigger-based recovery, manual restoration and status projections. It does not assign class-specific resource values or recovery rules; those must come from validated class progression data.


### Generic class ability execution
`rules/class-ability-runtime.js` executes authored ability records with action/bonus-action/reaction costs, class-resource costs, attack rolls, saving throws, damage mitigation, healing, and condition application. It validates required target state before resolution, aggregates repeated costs against the same resource, resolves random outcomes before committing costs, and restores action/resource balances if a resource commit unexpectedly fails. Ability definitions remain data-driven; this generic resolver does not claim to implement every class feature, feat, subclass rider, area template, movement effect, or legendary action. Run it only inside authoritative server simulation, not as a client-trusted outcome.


### Class ability catalog
`systems/class-abilities.js` builds a validated lookup catalog from explicitly authored ability records. It supports lookup by stable ID and filtering by class, subclass, level, action economy and text. The catalog validates records through the same definition validator used by the runtime; it intentionally contains no fabricated class feature data.


### Class feature progression catalog
`rules/class-feature-catalog.js` validates authored class and subclass feature tables, stable IDs, unique progression levels, subclass options and prerequisite records. It exposes features available through a selected class level/subclass and checks feature ownership, class-level and ability-score prerequisites without mutating character state. No class feature tables are fabricated by this module; populate it with reviewed SRD 5.2.1 progression data before enabling those features in-game.


### Feat and subclass catalog API
`systems/feat-catalog.js` validates explicitly authored feat records, indexes them by ID, filters by category/text, and checks ability-score, character-level and prerequisite-feat requirements. It re-exports the class feature catalog factory for consumers that want a shared content entry point. The repository currently has no claim of a complete authored feat dataset; this module is the validated data layer, not a complete feat rules implementation.
