# Authoritative seasonal progression

The browser seasonal calendar remains a presentation layer. Seasonal counters, currency, renown, reward eligibility and claims are persisted and validated by the PostgreSQL MMO service.

## Calendar

The server uses UTC quarter boundaries and stable season IDs:

| Quarter | Season ID suffix | Display name |
|---|---|---|
| Jan–Mar | `emberfall` | Emberfall |
| Apr–Jun | `frostwake` | Frostwake |
| Jul–Sep | `greentide` | Greentide |
| Oct–Dec | `suncrown` | Suncrown |

Weekly objectives reset on Monday UTC. The first request in a new week snapshots the current counters as the weekly baseline.

## Persistence and authority

Migration `018_seasonal_progression.sql` creates `character_season_progress`, keyed by character and season. It stores activity counters, the current story chapter and baseline, weekly baseline and claims, renown claims, seasonal currency and seasonal XP.

The MMO combat service records enemy defeats and completed quest counts in the same PostgreSQL transaction as the combat reward. The browser cannot submit arbitrary activity totals. The first server implementation tracks kills and completed quests; other activity categories should be wired to their authoritative dungeon, raid, crafting and world-boss completion transactions before those objectives are advertised.

## HTTP API

All routes require the normal bearer token and character ownership check.

- `GET /api/characters/:characterId/season` returns the active season, server counters, current story objective, weekly objectives, currency, season XP, renown and claimed renown tiers.
- `POST /api/characters/:characterId/season/claim` accepts one of:
  - `{ "type": "journey", "id": "chapter_1" }`
  - `{ "type": "weekly", "id": "weekly_hunt" }`
  - `{ "type": "renown", "id": "1" }`

Claims are checked and written inside a transaction with the character row locked. An incomplete objective, stale chapter, unknown weekly ID or already-claimed renown tier is rejected. Reward currency, seasonal XP, renown and character gold are applied server-side.

## Deployment

Back up PostgreSQL and run `npm run mmorpg:migrate` before deploying the updated MMO service. The migration runner applies numbered SQL migrations in order. Do not call client-side save data authoritative for seasonal currency or reward claims.
