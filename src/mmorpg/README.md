# MMORPG modules

The legacy 160x144 renderer remains intact. The modular layer contains D&D 5e-inspired rules and an independently implemented WoW-style MMO foundation.

## Native C++23 core

A standalone native rules library now lives in `native/`. It provides deterministic ability modifiers, proficiency progression, armor class and attack resolution, with an optional x86-64 System V assembly fast path and a portable C++23 fallback. See [native/README.md](../../native/README.md) for build instructions. This library is not yet wired into the JavaScript runtime or packaged as WebAssembly.

## D&D rules runtime
- d20 checks, advantage/disadvantage, proficiency, all 18 skills and expertise
- Dice expressions, attack rolls, armor class, saving throws, critical hits and damage mitigation
- Character creation validates species and class IDs against the catalogs, supports manual scores, the standard array and a 27-point buy, and carries species movement and class hit-die metadata into the character state
- Six original backgrounds grant two skill proficiencies, a tool proficiency, a descriptive feature and catalogued starter equipment
- Derived HP, hit dice, passive perception and level 1-20 XP thresholds
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
- Economy, a PvE/PvP war-mode flag, simulated open-world PvP and objective battlegrounds, plus a WebSocket client foundation and server command validation

## Integration and authoritative simulation
Modules remain separate from the legacy game loop until adapters are complete. D&D character level (1-20) and MMO progression (1-720) are separate tracks. Client requests must be validated; combat outcomes, drops, currency, progression and quest rewards must be computed by an authoritative server.

## Remaining production work
The current implementation is a tested rules/gameplay foundation, not a deployed MMO. Full class/subclass feature progression, the full licensed SRD spell/feat catalog, persistence, authentication, authoritative server simulation, matchmaking services, UI screens, content authoring and live operations remain to be built. World manifests are catalogs, not fully authored playable scenes.

No proprietary World of Warcraft code, assets, quests or data are copied. D&D data is limited to the SRD scope and attributed in `docs/SRD_ATTRIBUTION.md`.


## Monster bestiary
`src/mmorpg/data/monsters.json` contains the structured SRD 5.2.1 monster dataset. `systems/monsters.js` exposes lookup, search/filter, combatant creation, hit-point rolling, initiative, XP lookup and encounter composition. Monster trait/action text is retained as source data; complex abilities still require dedicated rule handlers before they can be resolved automatically by the combat engine. The dataset is attributed under CC BY 4.0 in `docs/SRD_ATTRIBUTION.md`.

## Enemy ranks and boss encounters
`systems/enemy-encounters.js` layers configurable ranks and difficulties, capped party-size scaling, original enemy affixes, validated monster archetypes/subclasses and filters over the SRD bestiary. It also indexes the 350 original world/arc bosses and provides a deterministic boss-phase state machine for HP, elapsed-time and player-death triggers. Phase actions are emitted as events for the authoritative combat adapter to execute; the data layer does not pretend to run unimplemented boss mechanics. `systems/threat.js` supports damage, multi-target healing, buffs, taunts, threat multipliers, ranking and decay. Tune multipliers and affix effects in `data/enemy-framework.json`.

## D&D equipment and itemization
- SRD weapon and armor catalogs, including weapon mastery metadata, damage dice, range, properties, armor class, stealth and Strength requirements.
- Adventuring gear, tools, equipment packs, mounts, vehicles and magic-item catalog entries.
- Item instances with rarity, item level, binding, durability and repair.
- The catalog includes 38 weapons, 13 armor/shield entries, 67 adventuring gear entries, 31 tools, 7 equipment packs, 17 mounts/vehicles and 24 magic-item entries.

## MMORPG service systems
- Auction house listings reserve seller inventory in escrow, charge listing/sale fees, deliver purchases, credit seller proceeds when a seller wallet is supplied, and return cancelled/expired escrow payloads for delivery.
- Character mail supports one-time atomic claims that stage attachments against inventory capacity/weight before crediting currency; failed claims remain retryable.
- Direct player trades require both players to accept the current offers, then stage inventory and currency changes before committing; invalid capacity, stock or wallet state leaves both characters unchanged.
- Social state supports reciprocal friend requests, ignore lists, friend-only whispers, bounded chat text and per-sender rate limiting. Party/guild channel membership authorization remains the responsibility of the server adapter.
- Parties support leader-issued expiring invites, role assignments, leader handoff and bounded ready checks; matchmaking and authoritative online membership still need a server adapter.
- `systems/instance-finder.js` indexes 20 dungeon and 14 raid entrances, with level/zone/continent/difficulty/party-size filters, and tower checkpoint validation. `systems/event-finder.js` schedules six original recurring public events plus the 300 world-boss roster and supports active-event joining. The browser's Activity Finder exposes dungeon/raid entry, the Spire, and local event travel/join actions; this is a local simulation, not shared live-world scheduling.
- Appearance/mount/title collections and transmog unlocks.
- Role-based dungeon finder queue for tank/healer/damage compositions.
- Map registry for the 90-map atlas.

The MMO systems are original implementations inspired by common MMORPG design patterns. They do not use World of Warcraft source code, art, names, quest text or proprietary game data.


### Economy transaction boundaries
Auction listing requires `sellerInventory` and `sellerWallet`; the listed quantity is removed immediately and the listing fee is charged. `buyAuction` adds the item to the buyer inventory before debiting the buyer; pass the seller wallet as the final argument to credit proceeds in the same in-memory operation. If omitted, the result returns `sellerProceedsCopper` for an external settlement adapter. `cancelAuction` requires the seller inventory to receive escrow back. `expireAuctions` returns expired escrow payloads to the caller for delivery; a persistent server must process that delivery idempotently before acknowledging expiry. Use `claimMailToCharacter` for inventory-and-wallet delivery; `claimMail` is retained only as a legacy payload API for callers that implement their own transaction.


### Spell execution runtime
`rules/spell-runtime.js` resolves supplied spell records against one or more targets. It validates range, known/prepared state when populated, slot availability, action economy, dice expressions and condition IDs before spending costs. Supported effects include spell attacks, saving throws, damage and resistance, critical hits, upcast damage and healing, timed conditions, armor and temporary-hit-point wards, summons, movement effects, senses, transformations and concentration. Scrolls can resolve a spell without spending a slot; callers must deliver and consume the scroll transactionally in an authoritative game server.


### SRD spell records
`data/spells.json` contains eight compact SRD 5.2.1 examples. `data/spell-content.js` adds 90 original spells across nine GB Quest schools and all ten spell levels. Every original spell has stable IDs, class and subclass access, spell/effect type and subtype, a concise original description, casting and range metadata, component and duration sub-stats, and level-scaled effect stats. `systems/spell-catalog.js` indexes both catalogs with lookup, text search, and class, subclass, school, level, type and subtype filters. The expansion is original game content; its descriptions do not reproduce source rulebook text.

### Spellbooks, scrolls and archive materials
`systems/spell-archive.js` provides an inventory-ready catalog of exactly 300 uniquely named records: 90 single-use spell scrolls, 90 class-restricted spellbooks, 90 study-to-prepare codices and 30 original spellcraft materials. Books teach or prepare their linked spell without being consumed. Successful scroll casts spend an action but no spell slot and consume one scroll; invalid casts leave the item untouched. Archive operations validate item IDs, stack rules, capacity and safe quantities.


### D&D class progression runtime
`rules/class-progression.js` provides a data-driven level advancement layer for the 1–20 D&D class track, separate from MMO/paragon progression. It applies one class level at a time, grants feature identifiers from supplied progression rows, exposes subclass unlock choices, validates subclass selection before mutating progression state, and grants subclass features at the selected level. It intentionally does not fabricate missing SRD feature tables: class/subclass progression data must be authored and attributed separately before those features can be granted in-game.

`rules/character.js` validates selected species and classes against the structured catalogs and supports manual ability scores, assigning the standard array, or point buy (8–15 per score, up to 27 points). `systems/backgrounds.js` validates and applies one of six original background records, including proficiencies and starter equipment. Species trait choices, class skill choices, and the interactive character-creation screen are not wired into this rules-layer builder yet.

### Class ability catalog
`data/class-abilities.js` contains 24 original, executable ability records: one class action and one subclass action for each of the 12 class/subclass pairs in `data/classes.json`. `systems/class-abilities.js` validates the records against that catalog and lists abilities available to a character by class, subclass, and level. The shared `rules/class-ability-runtime.js` resolves their attacks, saves, damage, healing, action costs, and class-resource costs. These records are an initial sample, not the complete level-by-level feature progression, and callers must authorize abilities from the character-filtered catalog before invoking the runtime.

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
`systems/feat-catalog.js` validates explicitly authored feat records, deeply freezes their metadata, indexes them by ID, filters by category/text, checks ability-score, character-level and prerequisite-feat requirements, and grants eligible feats to character state with duplicate protection. It re-exports the class feature catalog factory for consumers that want a shared content entry point. The repository currently has no claim of a complete authored feat dataset; this module is the validated data layer, not a complete feat rules implementation.


### Spell-slot progression data
`rules/spell-slot-progression.js` validates and indexes explicit twenty-level spell-slot tables per class, distinguishes full/half/third/pact/non-caster categories, and exposes defensive level lookups. It intentionally does not infer class tables from casting labels; populate the tables from reviewed SRD 5.2.1 records before connecting them to character advancement.
