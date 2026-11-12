# GB Quest multiplayer server cluster

This repository has two server implementations. The legacy JSON-file realm server (`backend/server.cjs`) is for local/LAN play and should not be used for a persistent public MMO. The authoritative PostgreSQL service (`backend/mmorpg-server.cjs`) is the production multiplayer backend.

## Cluster layout

```text
Browser / desktop game
        |
 HTTPS + WSS (TLS terminates at your edge proxy)
        |
 Nginx gateway :8788
   |        |        |
 MMO-1    MMO-2    MMO-3
   |        |        |
   +--------+--------+
            |
       PostgreSQL 16
```

All three MMO processes share one PostgreSQL database and token secret. They have distinct server instance IDs, own their local WebSocket connections, renew shared presence leases, and relay zone/realm/character events using PostgreSQL LISTEN/NOTIFY. The gateway distributes new WebSocket connections with least-connections balancing. Existing WebSocket sessions remain attached to the node that accepted them.

## Deploy

1. Provision a host with Docker Engine and Docker Compose v2.
2. Copy `.env.cluster.example` to `.env.cluster`. Generate secrets, for example `openssl rand -hex 32` for each secret, and set the exact game website HTTPS origins in `GBQ_ALLOWED_ORIGINS`.
3. Put the gateway behind a TLS reverse proxy/load balancer. Expose only the TLS edge publicly; do not expose PostgreSQL or the three MMO node ports.
4. Start the stack:

   ```sh
   docker compose --env-file .env.cluster -f compose.cluster.yaml up -d --build
   docker compose --env-file .env.cluster -f compose.cluster.yaml ps
   docker compose --env-file .env.cluster -f compose.cluster.yaml logs -f gateway mmorpg-1 mmorpg-2 mmorpg-3
   ```

5. Verify `GET /health`, `GET /api/regions`, and `GET /api/world/status` through the TLS gateway.
6. Configure the game client with the public WSS URL, e.g. `wss://mmo.example.com/ws`, and the HTTPS API origin. Do not put database credentials or the token signing secret in the client.

## Included multiplayer domains

- Accounts, signed sessions, characters and realm selection
- Realm/zone presence, movement and authoritative mob combat/XP
- Zone and realm chat history; same-realm whispers routed across MMO nodes
- Inventory, equipment, consumables, quest progression and rewards
- Wallet, bank, vendors, player trade, mailbox and auction house
- Friends, parties, guilds, dungeon/raid instances, ready checks and PvP ratings
- Player reports, request/auth throttles, CORS origin checks and admin tooling
- Database migrations and health checks

## Operational limits and next production steps

- The nine realm capacity values in the realm directory are configuration, not a measured concurrent-player benchmark. Load-test the full stack before advertising capacity.
- PostgreSQL NOTIFY is best-effort and has a small payload limit. It is suitable for transient fan-out, not durable delivery. Persisted game state and chat history are the source of truth; reconnecting clients must fetch snapshots/history.
- The current cross-node event bus uses PostgreSQL. For high event volume, replace fan-out with Redis/NATS/Kafka or a dedicated gateway while retaining PostgreSQL as the authoritative store.
- The current mob respawn timer runs in each MMO process. It is database-safe for the current update query, but should become a leased singleton/partitioned worker before large-scale deployment.
- Use managed PostgreSQL with backups, point-in-time recovery, TLS, connection pooling, metrics, alerting and tested restore procedures for public production.
- Add TLS at the edge, DDoS/WAF protection, centralized logs, secret rotation, abuse moderation, and a staging environment before opening public registration.
- Do not interpret three containers as three independent worlds: they are three compute nodes serving the same realm data. Region/realm sharding and world simulation ownership are a separate future scaling phase.
