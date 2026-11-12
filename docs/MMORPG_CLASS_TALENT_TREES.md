# Class talent trees and specialization progression

Migration `012_class_talent_trees.sql` creates the server-owned talent catalogue and unlock ledger, extends character levels to 720, and installs the authoritative XP threshold function used by combat and quest rewards.

## Specializations

Each class has three specializations:

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

- `GET /api/talents?class=ranger` returns the three specialization trees and their node definitions.
- `POST /api/characters/:characterId/specialization` with `{ "specializationId": "ranger_hunter" }` selects the character's class-compatible specialization.
- `POST /api/characters/:characterId/talents/:nodeId/unlock` spends talent points and unlocks one node.

All character mutations require a bearer-authenticated account that owns the character. The server validates class compatibility, selected specialization, level requirement, point balance, prerequisite unlocks and duplicate unlocks inside a database transaction. The client cannot directly write unlocked talents or talent-point balances.

A specialization can be changed only before any node has been learned. A respec workflow and its cost/cooldown are not yet implemented.

## 720-level progression

The SQL function `gbq_xp_for_level(level)` mirrors `src/mmorpg/progression/level-progression.js`: D20 class levels 1–20 use the established threshold table, and Paragon levels 21–720 use the existing quadratic prestige curve. Combat and quest rewards calculate the highest level reached from total XP and award one talent point per level gained, subject to the 1,000-point wallet cap.

## Profile and persistence

The authenticated character profile now includes `specialization_id` and the unlocked talent-node records. The normalized `character_talent_unlocks` table is the authoritative unlock ledger; the legacy `unlocked_talents` JSON column remains for compatibility and is not used to grant access.

## Deployment

Run the normal ordered migration command (`npm run mmorpg:migrate`) before deploying the server. Migration 012 depends on migrations 001 and 011. Back up PostgreSQL before applying schema changes. The database-backed integration suite exercises tree discovery, specialization class checks, talent spending, duplicate rejection and level progression.
