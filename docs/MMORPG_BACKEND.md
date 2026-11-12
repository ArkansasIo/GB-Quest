# GB Quest dedicated MMORPG backend

This service is separate from itch.io. itch.io serves the HTML5 game ZIP; this Node.js service owns online accounts, characters, world movement, combat outcomes and zone chat. The browser connects to the API over HTTPS and the live realm over WSS.

## Included

- Node.js 22 service using WebSockets (ws) and PostgreSQL (pg).
- Scrypt password hashes and signed, expiring bearer tokens.
- Account registration/login and authenticated character listing/creation (up to three characters).
- Authenticated WSS sessions, character selection, zone snapshots and player presence.
- Server-validated tile movement with world bounds and a movement rate limit.
- Server-owned mob HP and serialized combat updates; clients cannot submit damage, XP or loot amounts.
- Zone chat with payload validation and rate limiting.
- PostgreSQL schema, starter Aelmoor Fields enemies, Docker image and Compose deployment.

## Local deployment

1. Install Docker Engine / Docker Desktop and Docker Compose.
2. Copy .env.mmorpg.example to .env. Set unique random values for POSTGRES_PASSWORD and GBQ_TOKEN_SECRET (at least 32 characters).
3. Set `GBQ_ALLOWED_ORIGINS` to the exact HTTPS origin serving the game (for example `https://YOURNAME.itch.io`). Multiple origins are comma-separated. An empty value intentionally denies remote browser origins; localhost remains allowed for development. HTTP preflight responses and WebSocket upgrades use the same allowlist.
4. Start the service with:

    docker compose -f docker-compose.mmorpg.yml up --build -d

5. Verify:

    curl http://localhost:8788/health

The container listens on port 8788; the host publishes it on `127.0.0.1:8788` by default. Put a TLS reverse proxy on the host and keep the database private. Override `GBQ_BIND_ADDRESS` only when you intentionally need a different host interface. PostgreSQL data is kept in the named gbquest_pg volume. Back up that volume before upgrades or destructive operations.

For a public deployment, put the service behind a TLS reverse proxy or a platform that supports persistent WebSocket connections. Publish HTTPS and WSS only. Set GBQ_ALLOWED_ORIGINS to the exact HTTPS origin(s) that host the game. Use a managed PostgreSQL database with backups for production. Do not expose PostgreSQL to the public internet.

## API

All request/response bodies are JSON.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /health | No | Service and database health |
| POST | /api/register | No | { username, password }; username 3–16 chars, password 10–72 |
| POST | /api/login | No | { username, password }; returns bearer token |
| GET | /api/me | Bearer | Account and characters |
| GET | /api/characters | Bearer | Character list |
| POST | /api/characters | Bearer | { name, class }; up to three characters |

Allowed classes: warrior, mage, ranger, cleric, rogue, adventurer.

## WebSocket protocol

Connect to wss://YOUR_HOST/ws. The client must authenticate first with an authenticate message containing the bearer token, then send character.select with a characterId UUID. The service responds with authenticated and zone.snapshot, then streams events.

| Client message | Payload | Server behavior |
|---|---|---|
| movement.input | { dx: -1..1, dy: -1..1 } | Applies bounded movement and persists position |
| combat.intent | { targetId } | Checks server-side target position/range, calculates damage and updates mob HP transactionally |
| chat.send | { text } | Validates and broadcasts zone chat |
| ping | { clientTime? } | Replies with pong |

Server events include hello, authenticated, zone.snapshot, presence.joined, presence.left, presence.moved, movement.accepted, combat.resolved, loot.reward, chat.message and error. Each event includes a monotonically increasing server sequence and timestamp.

## Browser client

The new src/mmorpg/net/mmorpg-api.js exports GBQuestMMOApi. Example usage:

    import { GBQuestMMOApi } from './mmorpg/net/mmorpg-api.js';

    const realm = new GBQuestMMOApi({
      baseUrl: 'https://YOUR_HOST',
      onMessage: event => console.log('realm event', event),
      onStatus: status => console.log('realm connection', status)
    });
    await realm.login(username, password);
    const { characters } = await realm.characters();
    realm.connect();
    realm.selectCharacter(characters[0].id);
    realm.send('movement.input', { dx: 1, dy: 0 });

The API client keeps the bearer token in memory only. A page refresh requires login again until a secure account/session UI is integrated. Do not put service secrets in the HTML5 build or commit production credentials.

## Current scope and next server milestones

This is the first deployable authoritative foundation, not yet a complete MMO. It currently has one shared zone, starter enemy records, basic movement, basic server-calculated attacks and zone chat. It does not yet implement party/guild membership, dungeons/raids, quest progression, inventory/equipment ownership, trading, mail, world persistence/simulation loops, matchmaking, shard routing, anti-cheat telemetry, moderation tools, or production observability. The legacy backend/server.cjs remains in place for the older account/cloud-save/SSE realm; the new service currently has its own PostgreSQL account table and token issuer. Account migration and unified login between those services must be completed before existing legacy accounts can be used on the new WSS realm.

## Security and operations

- Set a unique GBQ_TOKEN_SECRET and rotate it deliberately (rotation invalidates all current tokens).
- Use TLS/WSS, exact origin allowlists, firewall rules and database backups.
- Keep rate limits and payload limits enabled; monitor connection counts and database pool saturation.
- The current HTTP login endpoint is a foundation; before an open public launch add distributed IP/account login throttling, account recovery, abuse controls, structured metrics, alerting and a formal privacy/retention policy.
- Do not claim this backend is live until deployed to a public HTTPS/WSS host and the game client has been configured with that endpoint.
