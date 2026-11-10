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
- Three regions and nine configured realms (1,000 concurrent-player slots each; 9,000 configured slots total), with live per-realm population and realm status.
- Public `GET /api/world/status` dashboard endpoint with live online count by region, realm and zone, configured capacity, utilization, registered-account/character totals, and a persistent peak-concurrent counter. The endpoint is scoped to the current service instance until shared presence/pub-sub is deployed.
- Server-authoritative movement coordinates and persisted character positions.
- Zone presence and snapshots.
- Transaction-locked mob combat, server-calculated damage, XP awards and timed mob respawns.
- Zone and realm chat with per-connection rate limits, persistent PostgreSQL message history, and cross-instance event relay. Whisper remains online-only and is not stored in public channel history.
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

This is a PostgreSQL-backed authoritative service with shared online-presence leases and cross-instance zone/realm event relay. The configuration defines nine logical realms with 1,000 player slots each (9,000 configured slots total); this is not a verified 9,000-player performance result. Realm admission is serialized with PostgreSQL advisory transaction locks. Presence leases expire after `GBQ_PRESENCE_TTL_SECONDS` (default 45 seconds) and are renewed every 15 seconds. Set a unique `GBQ_SERVER_INSTANCE_ID` for each process if operators need to identify instances. PostgreSQL `LISTEN/NOTIFY` provides transient low-latency event relay, not durable delivery: a disconnected listener can miss events, so clients must resynchronize from snapshots after reconnect. This is an initial multi-instance coordination layer, not a complete sharded MMO architecture. Zone ownership, durable event streams, distributed abuse controls, reconnect/session coordination, failover behavior and load tests remain production requirements. Load-test each deployment before advertising a real concurrency limit.

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


## In-game trading client

The game HUD includes a Trading action backed by `client/mmorpg-trade.js` and `client/trade-panel.css`. The panel authenticates directly against the dedicated PostgreSQL MMO service, loads the account's characters and inventory, opens the authenticated WebSocket, and offers only characters currently present in the selected character's zone. Set `window.GBQ_MMO_REALM_URL` before the trading script loads if the MMO service is on a separate HTTPS origin; the reverse proxy must forward `/api/*` and `/ws` to the MMO service. The client has its own MMO account registration/login because legacy local-save accounts are not shared with this service. The build pipeline embeds the panel script and styles in the standalone itch.io HTML file.

## Player-to-player trading

- `GET /api/characters/:id/trades` lists the character's recent incoming and outgoing offers.
- `POST /api/characters/:id/trades` creates an offer with `toCharacterId` and either an item (`itemId`, `quantity`), gold (`goldAmount`), or both.
- `POST /api/trades/:tradeId/accept` is restricted to the recipient character's account and settles the trade.
- `POST /api/trades/:tradeId/cancel` lets either participant cancel a pending offer.
- Offers expire after 15 minutes, and each character is limited to 20 pending incoming/outgoing offers. Both characters must be in the same zone at offer creation and acceptance.
- Settlement locks both character rows in deterministic ID order and then locks inventory rows. The server rechecks ownership, item quantity, equipment state, wallet funds, recipient stack capacity and wallet overflow before moving anything.
- Items currently equipped cannot be offered. Currency and item movement, offer completion, and the `player_trade_transactions` audit row commit in one PostgreSQL transaction. Failed settlement rolls back all changes.
- Offers do not reserve items or gold while pending; the server revalidates availability when the recipient accepts. A stale offer therefore fails safely rather than duplicating assets.

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


### In-game bank interface

The Trading panel's Bank tab uses the authenticated `GET /api/characters/:id/bank`, `POST /api/characters/:id/bank/deposit`, and `POST /api/characters/:id/bank/withdraw` endpoints. The client refreshes both wallet and bank balances after each successful transfer. The server validates whole-gold amounts, checks wallet/bank funds and safe-integer limits, locks the character row, updates balances and writes the `bank_transactions` audit row in the same PostgreSQL transaction. The interface is bundled into the single-file itch.io HTML build with the existing trade-panel stylesheet.


## Persistent realm and zone chat
- `chat.send` accepts `zone` and `realm` channels and stores each message in `world_chat_messages` before broadcasting it. Messages are limited to 180 characters and rate-limited per connection.
- `GET /api/characters/:id/chat?channel=zone&limit=50` or `channel=realm` returns recent history for the authenticated character's current zone or realm. Limits are clamped to 1–100 messages and the character's realm/zone are resolved from PostgreSQL, not accepted from query parameters.
- Whisper is still an online-only direct message in the current socket process. Persistent/offline mail is handled separately by the mailbox system; cross-instance whisper routing and moderation retention are future work.

## Multi-instance WebSocket cluster behavior

- Each server process has a unique `GBQ_SERVER_INSTANCE_ID` and owns only its local WebSocket connections.
- Presence is stored as expiring PostgreSQL leases; the heartbeat renews leases and removes stale ones. WebSocket ping/pong checks terminate half-open connections so leases can expire promptly.
- Zone and realm events are fanned out with PostgreSQL `LISTEN/NOTIFY`. This is low-latency best-effort delivery; it is not a durable queue. Gameplay state and rewards remain committed in PostgreSQL before the event is broadcast.
- Whispers resolve characters within the sender's realm, reject self-messages and either-direction blocks, and commit to `player_whispers` before delivery. Online recipients receive cross-instance events; offline recipients can retrieve the conversation from `GET /api/characters/:id/whispers?with=:peerCharacterId` after reconnecting. History reads are account-owned, same-realm, bounded to 1–100 rows, and mark incoming messages as read.
- Run `DELETE FROM player_whispers WHERE created_at < now() - interval '30 days'` daily; see `ops/cleanup-expired-data.sql`.
- Run multiple identical service containers behind a WebSocket-capable load balancer with sticky connections (or route each account consistently). All instances must use the same PostgreSQL database, token secret, origin allowlist and migration version. Set a distinct `GBQ_SERVER_INSTANCE_ID` per container.
- Do not scale mob respawn workers horizontally without leader election or partitioning: the current SQL update is safe against duplicate respawn rewards, but deployment-level worker coordination is still recommended.
