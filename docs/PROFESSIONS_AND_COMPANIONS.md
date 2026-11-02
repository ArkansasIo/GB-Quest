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
