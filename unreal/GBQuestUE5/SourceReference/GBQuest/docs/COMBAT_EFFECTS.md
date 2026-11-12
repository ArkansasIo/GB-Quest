# Combat stats, buffs, debuffs and conditions

Every number below is applied in combat. Buffs and debuffs go through one engine, `src/effect_engine.js`, which `src/combat.js` calls for attack rolls, AC, saves, crits, dodge, haste, damage dealt and taken, resistance, thorns and extra attacks, for heroes and monsters alike. Data lives in `src/data_world.js` (`ATTRS`, `SUBSTATS`, `BUFFS`) and `src/data_rules.js` (`CONDITIONS`).

Check it: `npm test` (engine unit tests) and `python3 tests/effects_check.py` (79 checks against the built game).

## Attributes

| Attribute | What it does |
|---|---|
| STR | Melee hits, carrying, ATHLETICS. |
| DEX | Aim, AC, initiative, finesse. |
| CON | Hit points, endurance, concentration. |
| INT | Arcane power, lore, investigation. |
| WIS | Divine power, perception, insight. |
| CHA | Presence, pacts, persuasion. |
| LCK | Crit chance, rerolls, magic find. |
| WIL | Resist conditions, death saves. |
| SPD | Initiative, extra turns, fleeing. |

## Substats (gear, gems, ascension, talents, boons, saved buffs)

| Key | Name | Unit | Gear cap |
|---|---|---|---|
| `crit` | CRIT CHANCE | % | 50 |
| `critdmg` | CRIT DAMAGE | % | 300 |
| `dodge` | DODGE | % | 40 |
| `block` | BLOCK | % | 40 |
| `leech` | LIFESTEAL | % | 20 |
| `haste` | HASTE | % | 50 |
| `dmg` | DAMAGE | % | 500 |
| `heal` | HEALING | % | 200 |
| `resist` | RESIST ALL | % | 60 |
| `thorns` | THORNS | flat | 9999 |
| `mf` | MAGIC FIND | % | 400 |
| `gf` | GOLD FIND | % | 400 |
| `xp` | XP BONUS | % | 200 |
| `hp` | MAX HP | flat | 99999 |
| `acb` | ARMOUR | flat | 30 |
| `hit` | ACCURACY | flat | 30 |
| `fire` | FIRE DMG | % | 300 |
| `cold` | COLD DMG | % | 300 |
| `lightning` | SHOCK DMG | % | 300 |
| `necrotic` | SHADOW DMG | % | 300 |
| `radiant` | HOLY DMG | % | 300 |

Temporary effects can push a few of these past the gear cap in combat, up to: crit 75%, dodge 60%, haste 75%, resist 75%.

## Buffs

| ID | Name | Effect |
|---|---|---|
| `bless` | BLESSED | +1d4 to attack rolls, +1d4 to saving throws. |
| `haste` | HASTED | +2 AC, 1 extra attack per attack action, 25% chance of an extra action each turn. |
| `regen` | REGENERATING | Heals 6% of maximum HP each turn. |
| `fortify` | FORTIFIED | 25% less damage taken. |
| `might` | MIGHTY | +15% damage dealt. |
| `fed` | WELL FED | +1 to saving throws, +10% maximum HP. |
| `inspired` | INSPIRED | +3 to the next attack roll or saving throw. |
| `rage` | RAGING | Weapon hits deal +2 damage (+3 at class level 9, +4 at 16); physical damage taken is halved. |
| `barrier` | BARRIER | A shield absorbs damage until its pool is used up. |
| `ac` | WARDED | Raises AC by the ward's strength. |
| `mirror` | MIRRORED | Illusory images: each one may take a hit in your place. |
| `host` | SPIRIT HOST | Guardian spirits sear every enemy for 3d8 radiant each turn (WIS save for half). |
| `trueveil` | VEILED | Advantage on attacks, attacks against you have disadvantage. |
| `foresight` | FORESIGHT | Advantage on attacks, attacks against you have disadvantage, advantage on saving throws. |
| `frenzy` | FRENZIED | 10% chance of an extra action each turn, +10% damage dealt (stacks up to 3). |
| `focus` | FOCUSED | +15% critical chance. |
| `thornskin` | THORNSKIN | Melee attackers take 6 damage. |
| `wildshape` | BEASTSHAPE | A beast body soaks damage until its hit points run out. |

## Debuffs

| ID | Name | Effect |
|---|---|---|
| `burning` | BURNING | 1d6 fire damage each turn per stack, +1 per 3 levels of whoever applied it (stacks up to 5). |
| `bleeding` | BLEEDING | 1d4 slashing damage each turn per stack, +1 per 3 levels of whoever applied it (stacks up to 5). |
| `venom` | ENVENOMED | 1d6 poison damage each turn per stack, +1 per 3 levels of whoever applied it (stacks up to 5). |
| `frostbite` | FROSTBITTEN | -1 AC, 25% less chance of extra actions (stacks up to 3). |
| `shocked` | SHOCKED | -10% dodge, 10% more damage taken. |
| `weakened` | WEAKENED | -25% damage dealt. |
| `vulnerable` | VULNERABLE | 25% more damage taken. |
| `sundered` | SUNDERED | -2 AC (stacks up to 3). |
| `slowed` | SLOWED | -2 AC, 50% less chance of extra actions. |
| `doomed` | DOOMED | -2 to attack rolls, -2 to saving throws. |
| `bane` | BANED | -2 to attack rolls, -2 to saving throws. |

## Conditions

| ID | Name | Effect |
|---|---|---|
| `poisoned` | POISONED | Disadvantage on attack rolls. |
| `frightened` | FRIGHTENED | Disadvantage on attack rolls. |
| `blinded` | BLINDED | Disadvantage on attack rolls; attacks against you have advantage. |
| `prone` | PRONE | Disadvantage on attack rolls; attacks against you have advantage. You stand up at the start of your turn. |
| `restrained` | RESTRAINED | Disadvantage on attack rolls and DEX saves; attacks against you have advantage. |
| `stunned` | STUNNED | Lose your turns; automatically fail STR and DEX saves; attacks against you have advantage. |
| `paralyzed` | PARALYZED | Lose your turns; automatically fail STR and DEX saves; attacks against you have advantage and every hit is a critical hit. |
| `asleep` | ASLEEP | Lose your turns until damaged; attacks against you have advantage and every hit is a critical hit. |
| `charmed` | CHARMED | You will not attack: you lose your turns. |
| `dominated` | DOMINATED | Fights for the side that dominated it. |
| `invisible` | INVISIBLE | Advantage on attacks; attacks against you have disadvantage. Ends when you attack. |
| `silenced` | SILENCED | Cannot cast spells. |
| `banished` | BANISHED | Removed from the fight: lose your turns and cannot be targeted. |
| `dodging` | DODGING | Attacks against you have disadvantage. |
| `marked` | MARKED | The hunter who marked you deals +1d6 damage to you with weapon hits. |
| `hexed` | HEXED | The caster who hexed you deals +1d6 damage to you with weapon hits. |
| `outlined` | OUTLINED | Attacks against you have advantage, and you gain no benefit from being invisible. |
| `cursed` | NO HEALING | Cannot be healed. |
| `reckless` | RECKLESS | Attacks against you have advantage. |
| `beast` | BEASTSHAPE | Turned into a harmless beast: lose your turns. |

## Effect fields

| Field | Meaning |
|---|---|
| `mods.hit` | attack rolls (weapon, spell and monster attacks) (multiplied by stacks) |
| `mods.saves` | saving throws (multiplied by stacks) |
| `mods.acb` | armour class (multiplied by stacks) |
| `mods.crit` | % chance that a hit becomes a critical hit (multiplied by stacks) |
| `mods.dodge` | % chance to dodge an attack that hits (multiplied by stacks) |
| `mods.haste` | % chance of an extra action at the start of each turn (multiplied by stacks) |
| `mods.dmg` | % damage dealt (every kind of damage) (multiplied by stacks) |
| `mods.resist` | % less damage taken (every kind) (multiplied by stacks) |
| `mods.takenPct` | % more damage taken (every kind) (multiplied by stacks) |
| `mods.thorns` | damage dealt back to melee attackers (multiplied by stacks) |
| `mods.extraAttack` | extra attacks with each attack action (multiplied by stacks) |
| `mods.hpPct` | % maximum HP (saved buffs only: applied through derive) (multiplied by stacks) |
| `dice` | dice added to every roll of a kind: `hit` or `saves` |
| `once` | a bonus spent by the next roll of that kind |
| `flags` | `attackAdv`, `attackedDis`, `saveAdv` |
| `tick` | per-turn healing (`healPct` of max HP) or damage (`dice` and `type`) |
| `stack` | maximum stacks |

A hero's saved buffs (food, potions, tier guards kept between fights) are already part of the character's derived stats, so the engine does not count their stat keys a second time in combat.
