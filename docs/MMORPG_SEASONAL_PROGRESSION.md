# Persistent seasonal progression

The seasonal server implementation is being developed in the existing pull request [#44 — Add persistent server-authoritative seasonal progression](https://github.com/ArkansasIo/GB-Quest/pull/44). That pull request is the source of truth for the server API and schema; do not merge a second implementation of the same routes or tables.

## Server contract

- `GET /api/characters/:characterId/season?seasonId=Y2027_emberfall` returns the character's seasonal wallet and all 12 objective records.
- `POST /api/characters/:characterId/season/claim` accepts `seasonId` and `objectiveId`. The server defines the reward, checks completion, locks the objective and character, and credits the seasonal wallet and character gold in one transaction.
- `POST /api/characters/:characterId/season/progress` is reserved for trusted gameplay services. It requires the `X-GBQ-Internal-Secret` header matching `GBQ_INTERNAL_SECRET`; never put this secret in browser code or public client configuration.

The seasonal calendar uses UTC quarter IDs: `emberfall`, `frostwake`, `greentide`, and `suncrown`. Combat automatically advances the configured kill objectives in the same transaction as the mob defeat and combat reward. Other gameplay systems should report progress only after their authoritative action has succeeded.

## Validation and release status

As of 13 November 2026, the pull request's JavaScript/MMORPG test workflow and itch.io HTML5 build workflow both completed successfully. See the live [pull request checks](https://github.com/ArkansasIo/GB-Quest/pull/44) before merging; CI status can change as new commits are pushed.

Apply the pull request's migration with `npm run mmorpg:migrate` as part of the database deployment procedure. Back up PostgreSQL first. Keep the existing browser seasonal UI as presentation only; never trust client-submitted progress, currency, renown, or reward values.
