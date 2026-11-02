# Boss Progression and Collection Journal

## Catalog

The progression system consumes the generated `BOSSES` catalog in `src/gen.js`. The current catalog generator produces 350 records spanning world, dungeon, trial, tower, arc and raid categories. Boss IDs are stable generated identifiers (for example `boss_0`); the journal uses those IDs rather than boss display names.

## Persistent progress

Character saves contain `bossProgress.clears`, `bossProgress.named` and `bossTokens`. Existing saves are migrated lazily when the progression API is first used.

Each defeated boss increments its kill count and updates its last-kill timestamp. The first clear timestamp is only set once. Repeated victories never issue another first-clear reward.

## First-clear rewards

A first clear grants gold based on boss level and category sigils:

| Category | Sigils |
|---|---:|
| World | 1 |
| Dungeon | 2 |
| Trial | 2 |
| Tower | 2 |
| Arc | 4 |
| Raid | 6 |

Gold reward: `max(100, round(500 + bossLevel * 25))`.

These are first-clear progression rewards, separate from the existing repeatable gear, named-item, material, consumable and rune reward rolls. The existing weekly raid instance save remains the raid lockout mechanism; the boss journal does not add a second conflicting lockout per boss.

## Difficulty ranks

Ranks are derived from the boss's generated level:

| Rank | Boss level |
|---|---:|
| F | 1–40 |
| E | 41–80 |
| D | 81–120 |
| C | 121–200 |
| B | 201–300 |
| A | 301–420 |
| S | 421–540 |
| SS | 541–640 |
| SSS | 641+ |

## Collection journal

The main menu includes **Boss Journal**. It lists the generated catalog, category filters, rank, level, clear state, kill count, total completion and current sigil balance. Named gear discoveries are counted in the save and exposed through `GBQBossProgression.discoverNamed`.

## Scope and online authority

This implementation persists progress in the local character save and makes first-clear issuance idempotent within that save. It is not yet an authoritative MMO account service: multiplayer deployments must move first-clear validation and reward issuance to the server to prevent save editing or cross-device duplication. The current raid weekly save remains the existing client-side weekly lockout and is likewise not server-authoritative.
