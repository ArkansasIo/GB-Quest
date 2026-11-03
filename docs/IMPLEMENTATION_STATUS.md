# Implementation Status and Native-Port Roadmap

**Project:** Lost Kingdom of Shadowbane Chronicles (GB-Quest)  
**Repository:** ArkansasIo/GB-Quest  
**Status date:** 2026-11-02

This document records what is confirmed in the current repository, what is only partially represented, and what remains to be implemented. A design request or data placeholder is not counted as a finished gameplay feature.

## 1. Confirmed implementation

| Feature | Current status | Evidence / notes |
|---|---|---|
| Browser game runtime | Implemented in JavaScript | The current game loads `src/*.js` and browser assets. Its logical display is 160×144. |
| Dark action-RPG HUD | Partially implemented | `src/ui_dark.js` contains the Sanctum/Diablo-style HUD layer and bottom combat-art slots. |
| Local minimap | Implemented in source | `drawSanctumMinimap` renders nearby terrain and entity markers in the upper-right area. The full world map remains available separately. |
| Minimap interaction | Incomplete | Click interaction, zoom controls and a full minimap navigation workflow are not yet complete. |
| Tooltip settings | Settings toggles exist | Hover-tooltip and right-click-tooltip options were added to Settings. The complete tooltip presentation and interaction coverage still need verification and integration. |
| Artifact equipment | Catalog and slot added | 42 named artifact bases are present in `src/data_rules.js`; the Artifact equipment slot is defined. |
| Relic equipment | Catalog and slot added | 42 named relic bases are present in `src/data_rules.js`; the Relic equipment slot is defined. |
| Artifact/relic documentation | Added | See [ARTIFACTS_AND_RELICS.md](ARTIFACTS_AND_RELICS.md). |
| Existing character gear system | Implemented | The game has weapon, armour and wondrous-item generation, equipment slots, affixes, rarity, item levels and attunement. |

The artifact and relic additions reuse the existing wondrous-item schema. They are not separate parallel item systems. The catalog contains **84 named bases total: 42 artifacts and 42 relics**.

## 2. Requested features still requiring implementation or end-to-end verification

The following items are roadmap work. They must not be represented as complete until their data, gameplay rules, UI and save/network behavior have been implemented and tested.

### Equipment enhancement

- **Rune socket rules and player-facing Rune Forge implemented:** nine families with nine tiers each (81 variants), separate weapon/armour rune sockets, one to three sockets based on item level, validated insertion/extraction, inventory consumption/refund, derived-stat integration and three-to-one tier fusion. See [RUNES_AND_FORGE.md](RUNES_AND_FORGE.md).
- Rune gathering/vendor acquisition, per-boss pity counters, weekly raid chests, authoritative online reward rolls and set-specific item art remain outstanding.

- **Gem socket system implemented:** nine gem families with nine tiers each (81 variants), weapon/armour socket capacity from one to four based on item level, validated insertion/extraction, character gem inventory consumption/refund, derived-stat integration, inventory entry point and player-facing socket forge UI. Three matching gems fuse into the next tier. See [GEMS_AND_SOCKETS.md](GEMS_AND_SOCKETS.md).
- Gem loot tables, automatic monster/boss rewards, gathering/crafting sources and vendor stock.
- Gem drop tables, gathering/crafting sources, upgrade recipes and vendor stock.
- Online server-side validation and synchronization for socket operations.
- Slot-specific gem compatibility rules and any socket unlock/upgrade costs.
- **Rune sockets and Rune Forge implemented:** nine families, nine tiers each, separate one-to-three weapon/armour rune sockets, validated insertion/extraction, inventory handling, modifier integration and fusion.
- **Boss rune rewards implemented:** category-based rune drop chances, themed family pools and item-level-scaled rune tiers are connected to the battle victory reward flow.
- **Legendary raid sets implemented:** Crypt Warden, Forgefire, Rime Throne and Long Night each have three named pieces, two-piece and full-set bonuses, and a collection view in the Armoury.
- Rune gathering/vendor acquisition, per-boss pity counters, weekly raid chests, authoritative online reward rolls and unique item art remain outstanding.

- **Boss progression and collection journal implemented:** all 350 generated boss IDs feed a persistent journal with category filters, difficulty ranks F–SSS, per-boss kill/first-clear timestamps, named-equipment discovery counts, and idempotent first-clear gold/sigil rewards. Existing repeatable loot rolls remain separate. The current weekly raid instance save remains the existing raid lockout. See [BOSS_PROGRESSION_AND_JOURNAL.md](BOSS_PROGRESSION_AND_JOURNAL.md).
- Boss progression is currently local-save authoritative only. Server-side account validation, cross-device synchronization and anti-tamper reward issuance remain outstanding.

- **Hidden world secrets implemented:** 100 deterministic concealed discoveries distributed across the world zones across Hollowmere, Greypeak, Ashen Barrows, Ardenhold, Duskmoor and Emberwaste. Includes a secret NPC, invisible cache, repeatable secret dungeon/portal entrances, developer workshop, ultra-rare hidden boss, one-time rewards, a guaranteed legendary relic, proximity glimmers and a Hidden World journal. See [HIDDEN_WORLD_SECRETS.md](HIDDEN_WORLD_SECRETS.md). Online reward validation remains server-side work.
### NPC and creature AI

- A reusable behavior-tree or equivalent hierarchical AI runtime.
- Per-archetype behavior profiles for monsters, creatures, animals, guards, vendors and civilian NPCs.
- Perception, target selection, threat, aggro, leash, patrol, flee, assist, defend, investigate and return-to-home behaviors.
- Combat decision logic for melee, ranged, caster, support and boss roles.
- Navigation and encounter integration, plus deterministic server-side validation for online play.
- Debug visualization and automated tests for behavior transitions.

### Alignment, factions and vendors

- A consistent disposition model: **Friendly, Neutral, Wary, Hostile** (with optional faction-specific reputation modifiers).
- Twelve fully defined factions, each with identity, territory, reputation, allies, rivals, services and hostility rules.
- Faction reputation and reaction rules for players and NPCs.
- Vendor inventories, buy/sell pricing, stock refresh, currency handling, purchase limits and transaction validation.
- Rune Forge and specialist crafting vendors as service types within the vendor framework.

### PvP and PvE player controls

- A player-facing PvP/PvE flag control and clear visual state indicator.
- Safe-zone, contested-zone and opt-in PvP rules.
- Rules for attacks, party members, guilds, factions, duels and rewards when PvP is enabled.
- Server-authoritative enforcement for online play.

The current character state already contains PvP-related fields such as `pvpEnabled` and `pvpFaction`. Those fields alone do not prove that a complete player-facing toggle, world rules and online enforcement are finished.

### Character inspection and cosmetics

- A character inspect panel that displays equipped gear and equipment details.
- A privacy control to hide or show the character's equipment to other players.
- **Basic wardrobe/transmog is implemented in the browser client:** acquired weapon, armour and wondrous-item bases are collected; the Wardrobe menu applies a same-kind, same-slot appearance override to an equipped item without changing its stats; restoring the original look is supported. The override is stored separately as `item.tmog` and persists with the character save.
- **Wardrobe collection now includes the multi-tab stash** as well as equipped gear, bag items and the legacy bank. Saved appearance selections are validated against unlocked appearances and slot compatibility before their icon/description override is used.
- Full layered character-sprite rendering from the HD equipment PNG overlays, character-inspect privacy controls, server-authoritative cosmetic ownership/synchronization, and boss/vendor cosmetic acquisition remain outstanding.

### HUD and interface integration

- Complete action-RPG top HUD and character status display.
- Clickable, zoomable minimap with navigation and marker controls.
- Spell/ability bar integrated with cooldown and resource states.
- Buff and debuff indicators with readable tooltips.
- Quest tracker/log integration.
- Party/raid frames and character inspection entry points.
- Settings that control tooltip behavior and interface visibility.

## 3. C++ and assembly source-port plan

The main playable browser game is JavaScript. The repository also contains a **partial C++23 native rules core** and an **optional x86-64 System V assembly fast path**. These are real native source files with build/test scaffolding, but they are not a full port of the JavaScript game. The Game Boy SM83/RGBDS ROM target is not yet present. The correct approach is to expand the existing native target and create a separate handheld target; renaming JavaScript files or mechanically translating syntax would not create working ports.

### C++ native target

Recommended structure:

```text
native/
  CMakeLists.txt
  include/gbq/
    core/
    game/
    world/
    combat/
    inventory/
    equipment/
    ai/
    networking/
    ui/
  src/
    core/
    game/
    world/
    combat/
    inventory/
    equipment/
    ai/
    networking/
    ui/
  tests/
```

Existing native files include `native/CMakeLists.txt`, `native/include/gbquest/core.hpp`, `native/src/core.cpp`, `native/src/cli.cpp`, and `native/tests/core_tests.cpp`. The current core covers selected rules operations (ability modifiers, proficiency, armour class, attack resolution and other documented primitives) and is built as a C++23 library plus CLI. Expand it toward portable gameplay systems, deterministic simulation, data loading, save serialization and broader test coverage. Rendering and platform input should sit behind interfaces. This remains a partial rules core, not a complete native game client.

### Assembly / Game Boy target

A Game Boy assembly port is a separate constrained target, not a full MMO server port. It should use RGBDS and a clearly scoped Game Boy-compatible feature set.

```text
gb/
  Makefile
  src/
    main.asm
    memory.asm
    input.asm
    video.asm
    audio.asm
    world.asm
    entities.asm
    combat.asm
    inventory.asm
    data/
  assets/
  tests/
```

The existing `native/src/ability_modifier_x86_64.S` is a desktop x86-64 System V routine used by the native C++ core on supported toolchains. It is not Game Boy assembly. The separate RGBDS target should produce an SM83 ROM and include emulator smoke tests. Online account services, authoritative MMO simulation and large-scale world generation remain server/desktop responsibilities; the handheld build would use a compatible offline or connected-client subset.

## 4. Recommended implementation order

1. Stabilize and test the current JavaScript game and the 84-item Artifact/Relic equipment additions.
2. Define versioned data contracts for items, sockets, gems, runes, factions, NPC profiles, vendors, cosmetics and PvP state.
3. Implement gem sockets and rune sockets through one shared equipment-modifier pipeline.
4. Implement the Rune Forge NPC and vendor transaction framework.
5. Implement NPC disposition, faction reputation and the behavior-tree runtime.
6. Implement the 12 factions and their vendor/service relationships.
7. Implement PvP/PvE UI and authoritative gameplay rules.
8. Complete layered character-sprite rendering, inspect/privacy and server-authoritative cosmetic synchronization; the basic local Wardrobe/transmog system already exists.
9. Complete the HUD, minimap interactions, spell bar, status effects and quest tracker.
10. Build the C++ native target and the RGBDS assembly target as separately tested deliverables.

## 5. Completion criteria

A feature is complete only when all relevant layers are present:

- **Data:** definitions, validation and migration/versioning.
- **Rules:** deterministic gameplay effects and edge-case handling.
- **UI:** player-facing interaction, feedback and accessibility.
- **Persistence:** save/load support; network synchronization where applicable.
- **Security:** authoritative validation for online transactions and combat.
- **Tests:** unit tests plus end-to-end gameplay checks.
- **Documentation:** updated system reference and build instructions.

## 6. Current delivery statement

The equipment progression layer now includes boss-category rune rewards and four three-piece legendary raid sets. Boss reward rolls award category-themed rune families with tiers derived from item level; battle victory applies the rune inventory rewards. Named raid drops can carry set IDs, and equipping two or three matching pieces activates the configured bonuses through the existing derived-stat pipeline. The Armoury includes a Legendary Sets tab showing owned equipped-piece counts and thresholds.

As of 2026-11-02, the repository contains the JavaScript browser game, a local minimap implementation, the 42-item Artifact and 42-item Relic catalogs, and the gem socket rules and player-facing forge (nine gem families, nine tiers each, socket validation, inventory consumption/refund, derived-stat integration, socket insertion/extraction UI and three-to-one gem fusion). Automatic loot integration, gathering/vendor sources and multiplayer authority remain outstanding. The repository also has a partial C++23 native rules core and optional x86-64 assembly fast path; neither is a full game port. The Game Boy SM83/RGBDS ROM target remains a roadmap item.
