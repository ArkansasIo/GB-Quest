# Market gear inspection

The Trading Hub's selected-item panel now exposes equipment information for gear listings in the Browse, Sell, and Mine tabs.

## Displayed fields

- Item level and equipment slot.
- The same primary combat-stat summary used by the inventory UI (`itemKeyStat`).
- Up to two rolled sub-stat affixes, including their configured units.
- Equipped-item power delta, or a new-slot indicator when the character has no item in that slot.
- Negative power deltas are highlighted as a downgrade; neutral/positive deltas are highlighted as a potential upgrade.

The comparison uses the current character state through `equippedFor` and `itemPower`. It is an inspection aid, not an automatic equip action or a replacement for the full inventory comparison screen.

## Market behavior retained

This is a presentation-only integration. It does not alter listing prices, auction deposits, sale fees, item ownership, purchase validation, or server-authoritative market transactions. Stack listings continue to show their item description. Public admin and developer tools remain disabled.

## Manual verification

1. Open Trading Hub > Browse and select a gear listing.
2. Confirm item level, slot, primary stat summary, affix summary, and equipped power delta appear.
3. Open Sell and select a bag item; confirm value/deposit and gear inspection appear.
4. Open Mine and select a listed gear item; confirm the listing price and gear inspection appear.
5. Select a material or consumable listing; confirm the stack description still appears.
