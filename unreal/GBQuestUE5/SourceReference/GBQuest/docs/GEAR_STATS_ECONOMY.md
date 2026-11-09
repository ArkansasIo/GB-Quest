# Gear stats, vendors and market economy

Six primary attributes: Strength, Dexterity, Constitution, Intelligence, Wisdom and Vitality. Gear contributes primary attributes and combat/resource sub-stats.

Derived values include health, mana, attack power, spell power, armor, critical chance/damage, hit, dodge, block, parry, haste, movement speed, regeneration, life steal and elemental resistances. Percentage stats are capped.

Quality tiers: Poor, Common, Uncommon, Rare, Epic, Legendary and Artifact. Higher tiers roll more affixes. Item level scales affix magnitude and required level. Inject random functions for repeatable tests and server-authoritative loot rolls.

Broken equipment (durability zero) contributes no stats. Gear comparison returns a weighted score and upgrade delta. Vendor quotes use integer copper, configurable markup and demand; durability reduces value.

Market recommendations use the median active listing for the same item template. With no comparable listing, a gear-value estimate is returned. Auction escrow, fees, transfers and settlement remain the responsibility of the auction-house service.

Import deriveSubStats, aggregateEquipmentStats, calculateCharacterGearProfile, rollGearAffixes, createGearInstance, compareGear, calculateGearValue, quoteVendorPrice, buildVendorStock and recommendMarketPrice from src/mmorpg/systems/gear-stats.js.

Inventory, wallets, equipment, rolls and settlement must remain server-authoritative. Never trust client-supplied prices or rolled stats.
