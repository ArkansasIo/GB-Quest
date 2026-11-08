# Deploying the authoritative GB Quest MMO service

This deployment runs the PostgreSQL-backed service in `mmorpg-server.cjs`. It is separate from the legacy JSON-file realm service in `server.cjs`.

## Included server-side systems

- PostgreSQL accounts with scrypt password hashes and disabled-account checks.
- Signed, expiring bearer tokens (HMAC-SHA256).
- Character creation and account-scoped character queries, with an account-row lock enforcing the three-character limit under concurrent requests.
- Persistent item catalogue, starter inventory, character inventory queries, equipment slot validation, equip/unequip transactions, and transactional consumable use with server-applied HP/MP restoration.
- Persistent quest catalogue and character quest acceptance/progress/completion, with rewards granted inside the monster-defeat transaction.
- Persistent character gold wallet, server-calculated monster gold rewards, and a seeded slime-gel drop with inventory stack limits.
- Authenticated WebSocket sessions.
- Server-authoritative movement coordinates and persisted character positions.
- Zone presence and snapshots.
- Transaction-locked mob combat, server-calculated damage, XP awards and timed mob respawns.
- Zone chat with per-connection rate limits.
- Database health endpoint at `GET /health`.

## Start with Docker Compose

1. Install Docker Engine and the Docker Compose plugin.
2. Copy `.env.example` to `.env`.
3. Generate a database password and token key. For example, use `openssl rand -hex 32` for the database password and `openssl rand -hex 48` for `GBQ_TOKEN_SECRET`.
4. Set `GBQ_ALLOWED_ORIGINS` to the exact HTTPS origin(s) that host the game. Do not include URL paths or trailing slashes.
5. Start the stack:

   ```sh
   docker compose up -d --build
   docker compose ps
   docker compose logs -f mmorpg
   ```

The container runs the idempotent schema migration before starting the service. PostgreSQL data is stored in the named `gbquest-postgres` volume. Back up that volume/database before upgrades.

Check readiness with:

```sh
curl http://127.0.0.1:8788/health
```

A healthy response includes `ok: true`, `database: "connected"`, and the `/ws` endpoint.

## Reverse proxy and browser origins

The Compose default binds the service to `127.0.0.1`, not the public network. Put it behind a TLS reverse proxy that supports WebSocket upgrades at `/ws`. Forward HTTP requests to port 8788 and preserve the WebSocket upgrade headers. Set `GBQ_ALLOWED_ORIGINS` to the exact public HTTPS origin of the browser game. Browser origins not in this allowlist are rejected; local HTTP origins are accepted for local development only.

Do not expose PostgreSQL publicly. Keep `.env` out of version control, rotate secrets if they are exposed, and use encrypted off-host database backups.

## Current scale and production boundaries

This is a real database-backed, authoritative **single service instance**, not 85 deployed game worlds. The current implementation keeps connected sockets and zone broadcasts in process memory. Do not run multiple replicas behind a load balancer yet: players in different replicas would not share presence, zone broadcasts, or consistent live-zone state. Horizontal scaling requires a shared pub/sub layer (for example Redis), zone ownership/partitioning, distributed rate limits, and reconnect/session coordination.

The current world is a 256×256 coordinate grid. Inventory and equipment are persisted in PostgreSQL, but general loot tables beyond the seeded slime-gel drop, vendor transactions, player trading, auction house and an economy ledger are not yet implemented. Movement is bounded and persisted, but a production collision/navmesh service, map-specific spawn data, anti-cheat telemetry, quest persistence, party/guild systems, and operational moderation tooling still need implementation before a public large-scale MMORPG launch. The combat endpoint currently provides a basic server-calculated attack loop; it is not yet the complete RPG ability, status-effect, loot-table, or PvP simulation.

## Local development without Docker

Install dependencies with `npm ci`, provision PostgreSQL, set `DATABASE_URL` and `GBQ_TOKEN_SECRET`, then run:

```sh
npm run mmorpg:migrate
npm run mmorpg:server
```

The service listens on `0.0.0.0:8788` by default. Set `HOST=127.0.0.1` for local-only development.


## Quest and wallet API

- `GET /api/characters/:id/quests` lists active quests and the character's current status/progress.
- `POST /api/characters/:id/quests` accepts a quest using JSON `{"questId":"first_slime"}`. Acceptance is account-scoped and cannot be duplicated.
- `GET /api/characters/:id/wallet` returns the character's persisted gold balance.
- Monster defeats advance matching active quest objectives inside the same PostgreSQL transaction as combat rewards. Quest completion is one-time; XP and gold rewards are applied by the server.
- The seeded `first_slime` quest asks the player to defeat the Training Slime. Monster defeat also awards server-calculated gold and has a 35% chance to award one Slime Gel, with inventory stack quantity capped.


## Character bank

- `GET /api/characters/:id/bank` returns the wallet and bank balances.
- `POST /api/characters/:id/bank/deposit` accepts JSON `{"amount":10}` and moves gold from the character wallet into the bank.
- `POST /api/characters/:id/bank/withdraw` accepts JSON `{"amount":10}` and moves gold from the bank into the character wallet.
- Amounts must be positive whole numbers from 1 to 1,000,000,000 per request. The server locks the character row, rejects overdrafts and balance overflow, and writes an immutable `bank_transactions` audit record in the same PostgreSQL transaction.
- Balances are returned as decimal strings to preserve 64-bit integer precision.

## NPC vendor economy

- `GET /api/vendors` lists active vendors.
- `GET /api/vendors/:vendorId` returns the vendor's current catalogue, prices and stock.
- `POST /api/characters/:id/vendor/buy` accepts `{"vendorId":"aelmoor_general","itemId":"minor_potion","quantity":1}`.
- `POST /api/characters/:id/vendor/sell` accepts `{"vendorId":"aelmoor_general","itemId":"minor_potion","inventoryId":"<owned-inventory-uuid>","quantity":1}`.
- Trades lock the character wallet and vendor listing in a PostgreSQL transaction, verify the character is in the vendor's zone, enforce stock and stack limits, and write an economy transaction record.
- Equipped items cannot be sold. Prices are controlled by the server catalogue; clients cannot submit a price.
- Seed vendor: Mira's Field Supplies in Aelmoor Fields. Current stock includes Minor Potions, Rusty Swords and Traveler Tunics.
