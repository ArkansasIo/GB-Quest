# Professions, perk trees and companions

## 18 professions

| Gathering (9) | Crafting (9) |
|---|---|
| Herbalism, Ore Mining, Forestry, Hidecraft, Fishing, Salvaging, Relic Survey, Cultivation, Beast Lore | Alchemy, Cooking, Blacksmithing, Armorsmithing, Weaponsmithing, Tailoring, Leatherwork, Jewelcrafting, Enchanting |

Every profession has a skill of 0-720, the rank branches (Yield, Efficiency, Mastery, 1 point per skill rank), a side quest and a repeatable work order. The four newest crafts (`src/profperks.js`) use gathered materials:

| Profession | Makes |
|---|---|
| Tailoring | Linen bolts, field and silk bandages, warding shawls (WARDED) |
| Leatherwork | Leather straps, armor patch kits (FORTIFIED), hunter wraps (FOCUSED), camp kits |
| Jewelcrafting | Cut gems, glimmer shards, lucky charms (FORESIGHT) |
| Enchanting | Arcane dust, rune oil (MIGHTY), mending / flame / dawn scrolls, ward runes (BARRIER) |

## Perk trees (commander-style)

`TRAINER > PROFESSION PERKS`, or START inside `PROFESSION TREES`.

- 4 tiers × 6 perks. A tier-N perk costs N points.
- Points: 1 at skill 1, then +1 every 36 ranks, up to 21 at skill 720.
- A tier-N perk needs at least one perk in tier N-1.
- The whole grid costs 60 points, so a full build is always a choice.
- A full reset refunds every point for 100 G per point spent.

| Effect | Gathering | Crafting |
|---|---|---|
| `double` | chance to double the haul | chance to double the batch |
| `rare` | bonus glimmer shard / ember soul | same |
| `xp` | extra chance to gain a skill rank | same |
| `gold` | more gold from profession quests | same |
| `pxp` | hero XP per gather | hero XP per craft |
| `respawn` | nodes regrow faster (fishing: better catch odds) | — |
| `check` | bonus to the gathering check (fishing: longer bite window) | — |
| `save` | — | chance to keep the materials |
| `extra` | — | chance of one extra item |

## Companions

`INN > COMPANION BOARD` to recruit, `MENU > SOCIAL > PARTY` (or `INN > PARTY`) to manage.

- 16 named companions with a class, species, home town, liked gift and a short bio. Each has a level requirement and a signing fee.
- **Affinity 0-100**: +1 per battle won together (+3 against bosses), +1 per day for talking, +3 per gift (+10 for a liked gift).
- **Bond tiers** add stats through `c.bond`, which `derive()` folds in like ascension substats:

| Tier | At | Bonus |
|---|---|---|
| Stranger | 0 | — |
| Ally | 20 | HP |
| Friend | 45 | HP, damage |
| Trusted | 70 | HP, damage, crit |
| Sworn | 100 | HP, damage, crit, resist |

- **Stances** steer the battle AI: BALANCED (by role), AGGRESSIVE (big spells on the main threat, heals only the fallen), DEFENSIVE (holds the boss, heals at 55%), SUPPORT (heals at 70%, buffs first).
- The active party is capped by play mode; extra companions wait on the bench and can be swapped in at any time.

## 90 raw materials

`src/materials.js`. There are 9 families, one per gathering profession, with 10 materials each. Every material is classified FAMILY > CLASS > SUBCLASS > TYPE > SUBTYPE, for example `ORE > METAL > NOBLE METAL > LUNAR > MOONPOOL` for Moonsilver.

| Family | Gathered by | Tier 1 → tier 23 |
|---|---|---|
| HERB | Herbalism | Peacebloom → Dawnrose |
| ORE | Ore Mining | Iron Ore → Dawnsteel Ore |
| WOOD | Forestry | Living Sap → Worldroot |
| HIDE | Hidecraft | Thick Hide → Seraph Leather |
| FISH | Fishing | Small Fish → Lantern Whale Oil |
| SALVAGE | Salvaging | Scrap Iron → Titan Plate |
| RELIC | Relic Survey | Relic Fragment → First Lantern Glass |
| FIBER | Cultivation | Field Fiber → Halo Silk |
| BEAST PARTS | Beast Lore | Bone Dust → Dragon Heart |

- **Tier bands:** each material slot covers a band of gear tiers, starting at tiers 1, 3, 6, 8, 11, 13, 16, 18, 21 and 23.
- **Level:** the first level of its tier band (1-670).
- **Rarity grade:** 1-9, from Poor to Divine.
- **Gathering:** a node or catch gives the best material that both the zone level and your profession skill allow.

## Recipes and blueprints 1-720

All 9 crafting professions have a blueprint for each of the 23 tiers (207 tiered recipes, plus the hand-made ones). The required skill is the tier's level, from 1 to 670, and the materials come from the matching tier.

| Profession | Materials | Makes |
|---|---|---|
| Alchemy | herb + beast | Minor → Dawn ELIXIR (healing) |
| Cooking | fish + herb | FEASTS (healing + WELL FED) |
| Tailoring | fiber + herb | BANDAGES (healing) |
| Leatherwork | hide + wood | ARMOR KITS (defensive buffs) |
| Enchanting | relic + beast | RUNE OILS (offensive buffs) |
| Jewelcrafting | ore + relic | forged **trinkets** of the tier |
| Blacksmithing | ore + wood + salvage | forged **weapons or armour** of the tier |
| Armorsmithing | ore + hide | forged **armour** of the tier |
| Weaponsmithing | ore + wood | forged **weapons** of the tier |

Forged gear rolls rarity at the tier's level. The Masterwork perk and Mastery ranks can raise it one grade.

In CRAFTING and BLUEPRINTS, LEFT and RIGHT filter by profession and SELECT opens the blueprint shop.

## Settlement trainers

`src/towns.js`. Every settlement has profession trainers placed by district.

| Settlement | Trainers |
|---|---|
| **City (Ardenhold)** | FORGE QUARTER: craft master, miner, salvager, leatherworker, armorsmith, weaponsmith. MARKET QUARTER: jeweller, enchanter, tailor. TEMPLE QUARTER: alchemist, curator. GARDENS: herbalist, cultivator. TOWN EDGE: forester, hidecrafter, beastmaster |
| **Harbor Ward (docks)** | fisher, cook, salvager |
| **Towns** (every third region hub) | craft master, curator, two gatherers and two crafters suited to the biome |
| **Villages** (other region hubs) | three trainers, mostly gatherers for the land around them, plus a traveling curator near ruins (badlands, volcanic, dusk and crystal) |

**Every trainer** offers:

- LEARN, or LESSONS at +3 skill for gold. Lessons can take you up to 10 × your level, capped at 720.
- A **STARTER QUEST from level 10**: gather or catch 8 times, or craft 4 times. The reward is gold, XP, +15 skill, and materials (gatherers) or a free blueprint (crafters).
- BLUEPRINTS (crafters) or a FIELD GUIDE (gatherers).
- The profession PERK TREE.
- WORK ORDERS.

**Craft master:** teaches blacksmithing. At **level 20** you choose a smith path, WEAPONSMITH or ARMORSMITH. The new profession starts at a quarter of your blacksmithing skill. The armorsmith and weaponsmith trainers, and the tiered blueprints for those two professions, only work for the path you chose. Changing path costs 1000 G.

**Curator** (relics and artifacts):

- Trains Relic Survey and gives its starter quest.
- **Appraises** relics and artifacts. Artifacts are named, legendary or better gear.
- Buys relics at 150% of their value and artifacts at 120%.
- Runs a **rare exchange**: 5 relics plus a fee for 1 relic of the next tier.
