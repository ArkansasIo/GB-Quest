# Equipment progression: gear level, power level, item level and rank stars

Every generated weapon, armour piece and wondrous equipment item now carries four separate progression values.

| Field | Display | Range | Meaning |
|---|---|---:|---|
| `gearLevel` | 4 digits, e.g. `0042` | 0001–9999 | Normalized gear progression number |
| `powerLevel` | 6 digits, e.g. `052480` | 000001–999999 | Composite display rating from item level, rarity and stars |
| `ilvl` | `IL720` | 1–720 | Actual item level; drives the existing 23 gear-material tiers |
| `adventurerRank` + `starLevel` | `SS ★7` | F–SSS, stars 1–12 | Equipment rank band and enhancement stage |

## 108 rank-star stages

There are nine rank bands, each with twelve stars:

`F 1–12 → E 1–12 → D 1–12 → C 1–12 → B 1–12 → A 1–12 → S 1–12 → SS 1–12 → SSS 1–12`.

The 720 item levels are divided into 108 consecutive stages. Each stage spans six or seven item levels. Each rank spans 80 item levels:
- F: IL 1–80
- E: IL 81–160
- D: IL 161–240
- C: IL 241–320
- B: IL 321–400
- A: IL 401–480
- S: IL 481–560
- SS: IL 561–640
- SSS: IL 641–720

Star 1 is the start of each rank band; star 12 is its end. The mapping is deterministic, so the same item level always receives the same rank and star.

## Power and enhancement rules

- Gear level maps item level 1 to 0001 and item level 720 to 9999.
- Power level maps item level to a six-digit base rating, then adds small rarity and star weighting. It is capped at 999999.
- Star enhancement increases equipment implicit stats by 1% per star beyond star 1 (maximum +11% at star 12).
- Item rarity remains the existing independent tier 1–9 system.
- The existing `rank` property remains the 1–23 material/gear tier used by weapon and armour base-stat curves. It is not overwritten by F–SSS.

## Migration and UI

The save migration pass recalculates these fields for owned equipment in inventories, equipment slots, companions and stash tabs. Newly generated gear receives the fields at creation. Inventory detail panels display item level, four-digit gear level, six-digit power level, F–SSS rank and numeric star level.

Configuration: `data/progression/gear-progression.json`.
Implementation: `src/items.js`, `src/gen.js`, and `src/armory.js`.
Tests: `tests/content-catalog.test.js`.


## Enhancement system (MMORPG gear instances)

The newer instance-based MMORPG rules layer provides a separate material-based enhancement track in `src/mmorpg/systems/gear-upgrade.js`. It does not overwrite the legacy 108 rank-star mapping above.

- Maximum enhancement is +20.
- Each attempt consumes upgrade stones and copper; every fifth enhancement also consumes arcane dust.
- Upgrade cost scales with item level and the target enhancement level.
- Success chance starts at 100% and decreases by 2.5 percentage points per current enhancement level, with a 50% floor.
- A failed attempt consumes the quoted materials and copper but does not change the item's enhancement level or stats.
- Successful stat scaling is calculated from the stored original stat baseline, preventing repeated upgrades from compounding the multiplier.
- Quotes, material availability, wallet balance, stat validity, projected stat results and random-source bounds are checked before resources are consumed. Overflowing enhancement results are rejected without charging the player or consuming materials.

Run the enhancement tests with `node --test tests/mmorpg/gear-upgrade.test.js`.
