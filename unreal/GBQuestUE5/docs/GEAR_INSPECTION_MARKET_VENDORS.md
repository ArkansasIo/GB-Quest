# Gear stats, substats and item inspection

## Inspection contract
A gear preview carries item identity, slot, rarity, item level, required level, vendor value, market value, base stat lines, rolled substat lines, affix identifiers and a special-effect description. Greater-affix rolls are marked individually so UI can distinguish them from normal substats.

## Comparison
UGBQuestGearInspectionLibrary is Blueprint-callable. InspectGear compares a candidate against the item currently equipped in the same slot and returns per-stat candidate/equipped/delta values, a simple weighted power score, and a level requirement result. The score is a sorting aid only; it is not a universal build recommendation. Class, specialization, damage type, resist caps, breakpoints and set bonuses should be added to build-aware scoring before using it as an auto-equip decision.

## Vendor integration
UGBQuestVendorShopComponent exposes stock, buy quotes, sell quotes and a purchase operation. Quote data includes the complete item so the vendor UI can show stats before the player commits gold. Stock = -1 means unlimited stock; 0 means sold out; positive values decrement on purchase.

## Market integration
Market and auction UI should use the same FGBQuestGearItem payload and inspection library as vendor UI. Keep the inspection view read-only until the player explicitly buys or equips the item. Do not trust client-submitted item stats or market prices: server-side item templates, affix rolls, ownership and transaction totals must be authoritative.

## Substat conventions
Use stable stat IDs such as Strength, Vitality, Armor, AttackPower, CriticalChance, CriticalDamage, Haste, Dodge, Block, LifeSteal, MaxHealth, MaxMana, and elemental resistance IDs. Values are numeric; bIsPercent controls display formatting. bIsGreaterAffix is a presentation marker, not a multiplier—the rolled value should already include its greater-affix increase.
