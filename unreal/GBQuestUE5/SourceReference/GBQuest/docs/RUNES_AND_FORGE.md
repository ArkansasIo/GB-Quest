# Rune Forge and Rune Socket Rules

## Catalog
Nine rune families are implemented, each with tiers 1–9 (81 variants): Flame (fire damage), Frost (cold damage), Storm (lightning damage), Ward (all resistance), Vigor (maximum health), Might (weapon damage), Precision (attack rating), Shadow (critical chance), and Leech (life leech). Modifier values scale linearly with tier.

## Socket rules
Only weapons and armour are eligible. Capacity is item-level based: IL 1–240 = 1 rune; 241–480 = 2; 481–720 = 3. Rune sockets are stored separately from gem sockets, so both enhancement systems can coexist on an item. The hard cap is three runes per item.

## Player interface
Open Inventory > Gear, select an eligible weapon or armour piece, then choose RUNE FORGE. The interface supports insertion, extraction, inventory counts and fusion. Three identical runes of tiers 1–8 fuse into one rune of the next tier. Tier 9 is the maximum.

## Rules and limitations
Rune modifiers are aggregated by `runeAffixes(item)` and added to the same derived-stat modifier pipeline as gems and ordinary gear affixes. No rune loot drops, boss-specific reward tables, gathering sources, vendor stock, service NPC placement, multiplayer authority, or rune-specific combination/set effects are claimed as implemented. Those are follow-on systems.
