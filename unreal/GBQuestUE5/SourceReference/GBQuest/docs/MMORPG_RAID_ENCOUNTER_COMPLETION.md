# Server-authoritative raid encounter completion

Raid roster management is exposed through the authenticated player API, but clients cannot grant themselves encounter completion or raid lockouts.

## Internal completion endpoint

Trusted game-server encounter workers may call:

`POST /api/internal/raids/:raidGroupId/encounters/:encounterId/complete`

Headers: `x-gbq-internal-secret: <GBQ_INTERNAL_SECRET>`

Body:

```json
{ "difficulty": "heroic" }
```

Configure `GBQ_INTERNAL_SECRET` as a randomly generated secret of at least 32 characters and share it only with trusted server-side encounter workers. Requests without a configured secret are rejected. Never put this secret in browser code, game clients, logs, or public build artifacts.

The endpoint locks the active raid row, snapshots its current members, writes an idempotency record, and issues a seven-day lockout for each member in one database transaction. A unique completion key prevents the same raid group/encounter/difficulty from issuing a second completion. Duplicate attempts return HTTP 409. Allowed difficulties: story, normal, heroic, mythic.

Apply migrations with `npm run mmorpg:migrate`. This endpoint records completion and lockouts only; reward grants must be performed by a separate trusted, idempotent loot pipeline after the completion transaction succeeds.
