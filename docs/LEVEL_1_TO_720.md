# Level progression: 1-720

## Two progression tracks, one character level display

Lost Kingdom of Shadowbane Chronicles uses a hybrid progression model:

- Levels 1-20: D&D 5e-compatible class progression, using the selected SRD version. Class features, proficiency, spell slots and class level stop at the ruleset's supported level cap.
- Levels 21-720: MMORPG Paragon progression. This adds mastery choices, specialization customization, professions, collection, exploration, cosmetics, titles and world renown.

Do not simply extend D&D proficiency bonus, spell slots, ability scores or attack bonuses to 720. That destroys bounded accuracy and makes encounter math unusable.

## Spell levels 1-9 across 1-720
Spell levels are the one 5e table stretched over the whole range. A full caster first casts each spell level at:

| Spell level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Character level | 1 | 12 | 46 | 102 | 181 | 282 | 406 | 552 | 720 |

`spellCasterLevel(level)` (src/data_world.js) turns the character level into the 5e caster level (1-17) used to read the slot tables, with straight lines between those points. Slot counts, half casters (up to 5th level) and pact magic (arcanum 6-9) all follow it. Class features, proficiency and the rest of the 5e table still stop at class level 20.

## Paragon milestone cadence
- Every 5 Paragon ranks: mastery point.
- Every 10: cosmetic or title milestone.
- Every 20: specialization perk choice.
- Every 50: world-renown milestone.
- Level 720: final prestige title, visual aura and account-wide legacy reward.

These are original Lost Kingdom of Shadowbane Chronicles systems and not official D&D progression.

## XP curve
The JS progression module provides canonical SRD 5.2.1 level thresholds through level 20, then a tunable quadratic XP curve for ranks 21-720. XP values above level 20 are original game balance and should be playtested.

## Endgame
Endgame difficulty is controlled through encounter tiers, item power budgets, affix budgets, party composition, mechanics and normalized PvP brackets—not by making every stat grow forever.
