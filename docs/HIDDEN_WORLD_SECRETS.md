# Hidden World Secrets

The world contains **100 concealed discoveries distributed across the world zones**. The original six named encounters remain fixed; the other discoveries are generated from a curated title, clue and encounter catalog and assigned deterministically across the zone list. They are not marked on the map. Each location is derived deterministically from its zone map and stable secret ID, avoiding generated points of interest, boss positions, gathering nodes, exits and other secret locations. A faint glimmer appears only when the player is within three tiles.

| Secret | Region | Encounter | Requirement |
|---|---|---|---:|
| The Drowned Lantern Keeper | Hollowmere | Hidden NPC and supply reward | Level 4 |
| The Ice-Sealed Cache | Greypeak | Invisible treasure cache | Level 8 |
| The King Under Ash | Ashen Barrows | Secret dungeon entrance | Level 20 |
| The Builder’s Hidden Workshop | Ardenhold | Developer-room dungeon | Level 1 |
| The Void Herald | Duskmoor | Hidden high-health boss | Level 28 |
| The Ember Gate | Emberwaste | Secret portal dungeon | Level 14 |

## Rewards

- Lantern Keeper: 1,200 gold and 2 potions.
- Ice-Sealed Cache: 3,200 gold, 2 boss sigils and 3 potions.
- Void Herald: 12,000 gold, 8 boss sigils and the guaranteed legendary **Herald’s Last Star**.
- Secret dungeons use the existing dungeon generator and instance chest reward flow.

Secret NPC/cache/boss rewards are one-time per character. Dungeon and portal entrances can be revisited. Discoveries are persisted in `G.secretWorld`; the Hidden World journal unlocks in the main menu after the first discovery.

## Implementation

- `src/secret_world.js`: stable location selection, level gates, encounter activation, reward handling and journal data.
- `src/scenes_world.js`: hidden-location interaction and proximity glimmers.
- `src/scenes_menu.js`: Hidden World journal.
- `src/systems.js`: save defaults and migration.
- `tests/secret_world.test.js`: deterministic positioning, level gates, reward idempotence and encounter catalog coverage.

These are client-save features. Online production should validate secret completion and item grants on the authoritative server.
