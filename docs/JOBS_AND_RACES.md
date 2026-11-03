# Jobs, support jobs and races

Code: `src/jobs_data.js` (classes and races), `src/jobs.js` (job change, support jobs, job abilities, racial traits, monster jobs). Art: `tools/gen_jobs.py`. Tests: `tests/jobs.test.js`.

## New jobs (11, 27 classes total)

| Job | Role | Inspired by | Job abilities (level) |
|---|---|---|---|
| RONIN | dps | samurai | MEIKYO STRIKE (1), THIRD EYE (15) |
| SHINOBI | dps | ninja | PAPER IMAGE (1), SHURIKEN (10) |
| BLADEDANCER | healer | dancer | HEALING WALTZ (1), BOX STEP (8), FAN DANCE (20) |
| WYRMLANCER | dps | dragon lancer | JUMP (1), CALL WYVERN (5), ANCIENT CIRCLE (25) |
| CORSAIR | dps | gunner | PHANTOM ROLL (1), QUICK DRAW (10) |
| BEASTCALLER | tank | beast tamer | CALL BEAST (1), FERAL HOWL (12) |
| PUPPETEER | tank | automaton master | DEPLOY AUTOMATON (1), OVERDRIVE (15) |
| DREADKNIGHT | tank | death knight | DEATH STRIKE (1), DARK GRASP (5), BONE SHIELD (15) |
| VOIDHUNTER | dps | glaive hunter | CHAOS STRIKE (1), BLUR (8), METAMORPHOSIS (25) |
| SCALESAGE | healer | dragon caster | DRAGON BREATH (1), VERDANT EMBRACE (5) |
| STORMCALLER | healer | totem shaman | TOTEM OF MIGHT (1), CHAIN SURGE (8), HEALING TIDE (20) |

Job abilities work once per battle. Companions and NPC adventurers of these jobs use them too.

## Job change (MAIN MENU > JOBS)
- Change jobs in any town, outside battles and instances.
- Each job keeps its own level, XP, attributes, subclass, talents, skills, arts, loadouts and hotbar.
- A new job starts at level 1. Its starting gear goes into empty slots or your bag. Armour the job can't wear goes to your bag.

## Support job
- Unlocks at main job level 18.
- Support level = half your main level, but never above that job's own level.
- You gain its **support traits** (substats per 10 support levels, capped) and the job abilities it has learned up to the support level (shown as `SUP`).

## New races (15 total)
| Race | Bonuses | Trait |
|---|---|---|
| HORNFOLK | STR+2 CON+1 | +HP; WAR STOMP stuns foes once a battle |
| FELINAR | DEX+2 WIS+1 | keen senses, +5% dodge |
| PIPKIN | INT+2 DEX+1 | +10% fire/cold/shock damage, resist magic |
| LUNARI | DEX+2 INT+1 | start battles hidden, resist charm |
| WOLFKIN | STR+2 DEX+1 | +4% crit, +15% crit damage |
| STARKIN | WIS+2 CHA+1 | +15% healing, resist radiant, GIFT OF LIGHT heal |

## Monster jobs
About 35% of ordinary humanoid, giant, fey, fiend and undead foes have a job (name tag): HEXER (spells, -15% HP), GUARDIAN (+3 AC, +30% HP), ARCHER (+2 to hit), BRUTE (+30% damage, -1 AC), MENDER (its side regenerates). They give 20% more XP. Bosses and rares never get one.
