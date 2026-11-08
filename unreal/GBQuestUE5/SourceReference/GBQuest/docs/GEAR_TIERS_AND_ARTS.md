# Gear tiers and combat arts

## 23 gear tiers (item levels 1-720)

`src/items.js` (`ITEM_RANKS` / `GEAR_TIERS`). An item's tier comes from its item level, so drops from higher-level foes land in higher tiers. Old saves are re-tiered on load.

| T | Name | Item level | | T | Name | Item level |
|---|---|---|---|---|---|---|
| 1 | CRUDE | 1 | | 13 | ADAMANT | 150 |
| 2 | IRONBOUND | 5 | | 14 | ASTRAL | 180 |
| 3 | STEEL | 10 | | 15 | ABYSSAL | 215 |
| 4 | TEMPERED | 15 | | 16 | CELESTIAL | 255 |
| 5 | SILVERED | 20 | | 17 | PRIMORDIAL | 300 |
| 6 | DUSKSTEEL | 30 | | 18 | ETERNAL | 350 |
| 7 | RUNEFORGED | 40 | | 19 | MYTHFORGED | 405 |
| 8 | MOONSILVER | 50 | | 20 | WORLDSTONE | 465 |
| 9 | EMBERSTEEL | 65 | | 21 | GODSTEEL | 530 |
| 10 | STORMFORGED | 80 | | 22 | AETHERIC | 600 |
| 11 | STARMETAL | 100 | | 23 | DAWNFORGED | 670 |
| 12 | DRAGONBONE | 125 | | | | |

What a tier gives:

- **Base stats:** weapons get +1.5 flat damage per tier. Armour gets +1 AC per 4 tiers, capped at +5, so d20 accuracy stays bounded the 5e way.
- **Implicit stats** (`TIER_IMPLICIT`), always on and growing with the tier:
  - **Weapons:** damage %, then crit (tier 4+), crit damage (10+) and accuracy (16+).
  - **Armour:** max HP, then resist all (3+), block (8+) and thorns (14+).
  - **Trinkets:** healing %, then XP (3+), haste (6+) and magic find (12+).
- **Tier power** (`TIER_POWERS`, one per tier): an effect from the weapon, or the caster offhand, that procs from any damage you deal, including weapon attacks, spells, combat arts and abilities. The chance is 8% + 0.6% per tier. Examples: KEEN EDGE (bleed), EMBER BRAND (fire and burning), DRAGON'S BREATH (fire to all foes), ABYSSAL DRAIN (lifesteal), CELESTIAL HYMN (party heal), ETERNAL ECHO (repeat hit), DAWNBREAK (radiant to all foes and a party heal).
- **Tier guard:** armour can grant FORTIFIED, REGENERATING, THORNSKIN, BARRIER or WARDED when you are hit. The chance is 6% + 0.5% per tier.

## Combat arts: physical and casting attacks

`src/arts.js`. Open the loadout from `MENU > COMBAT ARTS`. You can equip up to 4 arts; they appear in battle under SKILLS and on the realtime hotbar. Companions use theirs automatically.

| System | Roll | Damage | Scaling |
|---|---|---|---|
| **Physical** | weapon attack: d20 + weapon hit vs AC | weapon dice + ability mod + tier damage + the art's bonus dice | bonus dice grow with level |
| **Casting** | spell attack (d20 + PB + casting mod vs AC) or a save vs spell DC (8 + PB + mod), half damage on a save where noted | element dice | cantrip-style ×1/×2/×3/×4 at levels 1/5/11/17, then +1 per 50 levels |

There are 36 arts: 18 physical and 18 casting, unlocking from level 1 to 100. Each class reaches its arts through groups: blade, brute, agile, arcane, divine, primal and shadow.

- **Cost:** arts use cooldowns in rounds, not spell slots.
- **Riders:** effects like bleed, slow, sunder, stun, prone, burn, frostbite, shock, venom, bane, vulnerable and doomed land on a hit, or on damage dealt for casting arts.
- **Other effects:** EXECUTE doubles damage below half health, drain arts heal you, and nova arts heal the party.

## Armour classes, armour categories and weapon subclasses

`src/armory.js`. Open the reference screen from `MENU > ARMOURY`.

**4 armour classes**, gated by 5e armour proficiency:

| Class | Needs | Per-piece implicit stats (scale with tier) | 4-piece set | 7-piece set |
|---|---|---|---|---|
| CLOTH | anyone | healing, damage % | +10% damage, +15% healing | +10 haste, +10% damage |
| LEATHER | light | dodge, crit | +5 crit | +6 dodge, +25% crit damage |
| MAIL | medium | max HP, resist | +6 resist | +60 HP, +1 accuracy |
| PLATE | heavy | max HP, block, thorns | +1 AC | +1 AC, +8 block (+2 AC total, capped) |

**7 armour categories** (piece slots): HELM, CLOAK, CHEST, GLOVES, BELT, LEGGINGS and BOOTS. Chest armour takes its class from its 5e type: light is leather, medium is mail, heavy is plate. There are also four new cloth robes. The other six categories roll a class when they drop, with a 60% chance of the heaviest class you can wear (smart loot). Items from older saves count as cloth.

**14 weapon subclasses**, each with a signature implicit that stacks with the tier implicit:

| Subclass | Implicit |
|---|---|
| SWORD | crit chance, accuracy |
| AXE | crit damage |
| MACE | damage, holy damage |
| HAMMER | big damage, crit damage |
| DAGGER | high crit chance and crit damage |
| POLEARM | damage, block |
| STAFF | healing, fire, cold and shock damage |
| WAND | shadow and holy damage |
| BOW | accuracy, crit chance |
| CROSSBOW | heavy crit damage |
| THROWN | haste, crit chance |
| FIST | haste, dodge (4 fist weapons) |
| SCYTHE | crit damage, shadow damage, lifesteal (4 scythes, two-handed; the Grave Scythe is a simple weapon, so casters can use it) |
| GRIMOIRE | damage and every elemental school (5 spellbooks: Primer, Ashes, Blood, Star, Void Codex) |

There are also 5 elemental wands: Ember, Frost, Bone, Storm and Dawn. The scythe, grimoire and wand icons are `assets/wi_*.png`, drawn by `tools/gen_weapon_icons.py`.
