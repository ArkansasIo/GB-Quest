# Boss Loot and Legendary Equipment Sets

## Boss rune rewards
Boss victories can award runes in addition to the existing gear, named-item, gold, material and consumable rewards. Drop chances are category-based: world 40%, dungeon 50%, trial 60%, tower 65%, arc 75%, and raid 85%. Arc and raid bosses have a 45% chance to award a second rune after a successful rune roll. Rune tier is `ceil(itemLevel / 80)`, clamped to tiers 1–9. Family pools are themed by boss category; raids can award any family.

## Legendary equipment sets
Named boss drops can belong to one of four three-piece legendary sets: Crypt Warden, Forgefire, Rime Throne, and Long Night. Equipping two pieces activates the first set bonus; equipping all three activates the stronger bonus. Set pieces retain their existing named-item identity and base equipment slot. Bonuses are applied in the existing derived-stat pipeline and stack with ordinary affixes, gems, runes and armour-class set bonuses.

## Runtime set-bonus implementation

The browser RPG gear-stat pipeline defines four set IDs: `crypt_warden`, `forgefire`, `rime_throne`, and `long_night`. Set pieces declare `setId` on the item (or its template). Two- and three-piece thresholds are evaluated from currently equipped, non-broken items. Bonuses are included in `aggregateEquipmentStats` and `calculateCharacterGearProfile`, and the profile exposes the unlocked set details under `setBonuses`. Set bonuses stack with ordinary item stats and with bonuses from other sets. The definitions and thresholds are centralized in `src/mmorpg/systems/gear-stats.js`.

## Existing loot integration
The game already uses category-specific boss loot tables and named drop pools. This update adds rune rewards to that flow and adds additional named pieces to selected raid pools. It does not claim that every one of the 350 bosses has an exclusive unique drop. Boss reward probabilities are configurable in `src/boss_rewards.js`.

## Outstanding
- Per-boss pity counters and account-bound duplicate protection.
- Raid lockouts, weekly reward chests and party loot distribution.
- Online authoritative reward rolls and anti-duplication persistence.
- Visual set-piece collection tracker and set-specific item art.
