# Class talent trees and specialization progression

Migration `012_class_talent_trees.sql` creates the server-owned talent catalogue and unlock ledger, extends character levels to 720, and installs the authoritative XP threshold function used by combat and quest rewards.

## Specializations

### The 27 jobs (migration 016)

Every character plays one of the browser game's 27 jobs (migration 009 moved existing characters onto them). Migration `016_job_talent_trees.sql` gives each job two specializations, named after the job's subclasses in the game data (`CLASSES[job].subs` in `src/data_rules.js` and `src/jobs_data.js`), with the job's role. Specialization IDs are `<job>_<subclass>`, for example `ronin_kensai`.

| Job | Role | Specialization 1 | Specialization 2 |
|---|---|---|---|
| Warden (`warden`) | Tank | Champion | Tactician |
| Berserker (`berserker`) | Tank | Frenzy | Totem |
| Vanguard (`vanguard`) | Tank | Devotion | Vengeance |
| Strider (`strider`) | Damage | Hunter | Beastmaster |
| Shade (`shade`) | Damage | Thief | Assassin |
| Ascetic (`ascetic`) | Damage | Open Hand | Shadow |
| Arcanist (`arcanist`) | Damage | Evoker | Abjurer |
| Wildblood (`wildblood`) | Damage | Draconic | Wild Surge |
| Pactbound (`pactbound`) | Damage | Fiend Pact | Archfey |
| Cantor (`cantor`) | Healer | Lore | Valor |
| Chaplain (`chaplain`) | Healer | Life | Tempest |
| Verdant (`verdant`) | Healer | Moon | Land |
| Necromancer (`necromancer`) | Damage | Gravecaller | Boneweaver |
| Summoner (`summoner`) | Damage | Spiritcaller | Wardbinder |
| Sunwarden (`sunwarden`) | Healer | Dawnkeeper | Sunstriker |
| Runeblade (`runeblade`) | Tank | Blood Rune | Frost Brand |
| Ronin (`ronin`) | Damage | Kensai | Iaido |
| Shinobi (`shinobi`) | Damage | Kage | Yamikiri |
| Bladedancer (`bladedancer`) | Healer | Veil Dancer | Edge Dancer |
| Wyrmlancer (`wyrmlancer`) | Damage | Skyleap | Wyrmbond |
| Corsair (`corsair`) | Damage | Fortune | Quickdraw |
| Beastcaller (`beastcaller`) | Tank | Packlord | Feral |
| Puppeteer (`puppeteer`) | Tank | Valoredge | Sharpshot Frame |
| Dreadknight (`dreadknight`) | Tank | Blood Oath | Frostgrave |
| Voidhunter (`voidhunter`) | Damage | Havoc | Vengeance |
| Scalesage (`scalesage`) | Healer | Devastation | Preservation |
| Stormcaller (`stormcaller`) | Healer | Thunder | Tides |

Each job specialization has the same 73-node tree as the legacy classes below, including the migration 013 combat tuning and migration 014 cooldowns (54 specializations, 3,942 nodes).

### Legacy classes (migration 012)

The six original classes keep three specializations each, for any character still on a legacy class:

| Class | Specialization 1 | Specialization 2 | Specialization 3 |
|---|---|---|---|
| Warrior | Vanguard | Berserker | Sentinel |
| Mage | Arcanist | Pyromancer | Chronomancer |
| Ranger | Hunter | Marksman | Beastwarden |
| Cleric | Oracle | Templar | Warden |
| Rogue | Assassin | Shadowdancer | Trickster |
| Adventurer | Spellblade | Explorer | Tactician |

Every specialization has three branches: Assault, Utility and Mastery. The catalogue seeds 73 nodes per specialization (1,314 nodes total). The first node is available at level 1, subsequent milestone nodes unlock at levels 11, 21, 31 ... 711, and the capstone unlocks at level 720. Nodes carry active, passive or ultimate types, point costs, effect metadata and branch prerequisites.

## Server API

- `GET /api/talents?class=ronin` returns the class's specialization trees and their node definitions. Every job and legacy class is accepted; anything else returns `400 invalid_class`.
- `POST /api/characters/:characterId/specialization` with `{ "specializationId": "ranger_hunter" }` selects the character's class-compatible specialization.
- `POST /api/characters/:characterId/talents/:nodeId/unlock` spends talent points and unlocks one node.

All character mutations require a bearer-authenticated account that owns the character. The server validates class compatibility, selected specialization, level requirement, point balance, prerequisite unlocks and duplicate unlocks inside a database transaction. The client cannot directly write unlocked talents or talent-point balances.

A specialization can be changed only before any node has been learned. A respec workflow and its cost/cooldown are not yet implemented.

## 720-level progression

The SQL function `gbq_xp_for_level(level)` mirrors `src/mmorpg/progression/level-progression.js`: D20 class levels 1–20 use the established threshold table, and Paragon levels 21–720 use the existing quadratic prestige curve. Combat and quest rewards calculate the highest level reached from total XP and award one talent point per level gained, subject to the 1,000-point wallet cap.

## Profile and persistence

The authenticated character profile now includes `specialization_id` and the unlocked talent-node records. The normalized `character_talent_unlocks` table is the authoritative unlock ledger; the legacy `unlocked_talents` JSON column remains for compatibility and is not used to grant access.

## Deployment

Run the normal ordered migration command (`npm run mmorpg:migrate`) before deploying the server. Migration 012 depends on migrations 001 and 011; migration 016 depends on 012, 013 and 014. Back up PostgreSQL before applying schema changes. The database-backed integration suite exercises tree discovery, specialization class checks, talent spending, duplicate rejection and level progression.
