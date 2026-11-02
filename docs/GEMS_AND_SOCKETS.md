# Gem Sockets and Gem Rules

## Scope

The first gem socket rules layer is implemented in `src/gems.js` and loaded by the browser build after `src/items.js`. It is a gameplay rules/API layer; the player-facing socketing screen, gem loot tables, vendors and Rune Forge are not yet implemented.

## Gem families

| Gem | Modifier | Tier 1 value |
|---|---|---:|
| Ruby | Weapon damage (`dmg`) | +1 |
| Sapphire | All resistance (`resist`) | +1 |
| Emerald | Attack rating (`hit`) | +1 |
| Amethyst | Maximum health (`hp`) | +5 |
| Topaz | Haste (`haste`) | +1 |
| Diamond | Saving throws (`saves`) | +1 |
| Onyx | Critical chance (`crit`) | +1 |
| Opal | Magic find (`mf`) | +1 |
| Garnet | Life leech (`leech`) | +1 |

Each family has nine tiers (`ruby_t1` through `ruby_t9`, etc.). The modifier scales linearly with tier. There are 81 defined gem variants across nine families.

## Socket eligibility and capacity

- Only weapons and armour can receive gem sockets in this first rules version.
- Wondrous items, artifacts and relics are not socket-eligible.
- Socket capacity is based on item level: IL 1–180 = 1 socket; 181–360 = 2; 361–540 = 3; 541–720 = 4.
- The hard cap is four sockets per item.
- Socket operations validate gem IDs, item eligibility, index range and whether the target socket is already occupied.

## Inventory operations

`addGemToInventory` adds valid gem IDs to `character.gems`. `socketGemFromInventory` consumes one gem only after insertion succeeds. `unsocketGemToInventory` removes the gem from the item and returns it to the character's gem inventory. Failed operations do not consume gems or mutate the item.

## Stat integration

`gemAffixes(item)` converts socket contents to the existing gear modifier keys. `src/rules.js` adds those values into the same derived-stat pipeline used by ordinary affixes, so equipped socketed gear contributes to character derivation.

## Current limitations

- There is no player-facing socket management UI yet.
- No gem drop tables, gathering recipes, crafting recipes or vendor stock have been added yet.
- No socket unlock/upgrade currency or extraction fee exists yet.
- The rules currently allow the defined gem families in any eligible weapon or armour socket; slot-specific gem restrictions are not yet defined.
- Online server-side validation and synchronization must be added before socket operations are trusted in multiplayer.

## Tests

`tests/gems.test.js` covers catalog bounds, socket capacity, immutable insertion/extraction, inventory consumption/refund and modifier aggregation. Run with `npm test`.