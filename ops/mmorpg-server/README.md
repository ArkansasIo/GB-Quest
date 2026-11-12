# GB-Quest dedicated MMORPG server

This deployment runs the PostgreSQL-backed authoritative service in `backend/mmorpg-server.cjs`. It is separate from the legacy JSON/SSE realm server in `backend/server.cjs`.

## Requirements
- Docker Engine with the Compose v2 plugin
- Linux server or Windows with Docker Desktop
- A domain and TLS reverse proxy for public internet deployment

## 1. Configure secrets

From the repository root:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

Use independent generated values for `POSTGRES_PASSWORD` and `GBQ_TOKEN_SECRET`. The token secret must be at least 32 characters. Keep `.env` private and never commit it. Use a hexadecimal/alphanumeric database password because Compose builds a PostgreSQL connection URL from these values.

Set `GBQ_ALLOWED_ORIGINS` to the exact origins that host the game client, comma-separated, without paths or trailing slashes.

## 2. Start

```bash
docker compose --env-file .env -f docker-compose.mmorpg.yml up -d --build
```

Compose starts PostgreSQL, waits for its health check, runs all ordered SQL migrations in `backend/migrations`, then starts the MMO service. PostgreSQL data persists in the named `gbquest_pg_data` volume.

Check status and logs:

```bash
docker compose --env-file .env -f docker-compose.mmorpg.yml ps
docker compose --env-file .env -f docker-compose.mmorpg.yml logs -f mmo
docker compose --env-file .env -f docker-compose.mmorpg.yml logs migrate
curl http://127.0.0.1:8788/health
```

A healthy response includes `ok: true` and `database: "connected"`. The WebSocket endpoint is `/ws`.

## 3. Public internet / TLS

The default Compose binding is loopback (`127.0.0.1`). Put a TLS reverse proxy such as Caddy, nginx, or a managed load balancer in front of it. Configure the proxy to terminate HTTPS, forward to `127.0.0.1:8788`, preserve the Host header, and support HTTP/1.1 WebSocket upgrades for `/ws`. Set `GBQ_ALLOWED_ORIGINS` to the exact HTTPS origin of the game. The browser must connect to `wss://YOUR-GAME-DOMAIN/ws`. Never expose PostgreSQL publicly.

For trusted LAN testing only, set `MMO_BIND_ADDRESS=0.0.0.0` and allow TCP port 8788 through the host firewall. This is not a substitute for HTTPS on the public internet.

## 4. Migrations and updates

Migrations run automatically before the MMO service starts. To run explicitly:

```bash
docker compose --env-file .env -f docker-compose.mmorpg.yml run --rm migrate
```

Back up the database before schema updates:

```bash
docker compose --env-file .env -f docker-compose.mmorpg.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > gbquest-backup.sql
```

Update after pulling a reviewed branch:

```bash
docker compose --env-file .env -f docker-compose.mmorpg.yml up -d --build
```

## 5. Operations

- Stop containers: `docker compose --env-file .env -f docker-compose.mmorpg.yml down`.
- This preserves player data. Do not add `-v` unless intentionally deleting the PostgreSQL volume.
- Destructive reset: `docker compose --env-file .env -f docker-compose.mmorpg.yml down -v` permanently deletes the database volume.
- Configure off-host backups and monitor CPU, memory, disk, connection counts and logs.
- Presence and WebSocket broadcasts are process-local. Run one MMO instance until shared presence/pub/sub and distributed matchmaking coordination are implemented; do not horizontally scale this service yet.

## Current scope

The service includes account authentication, character/realm persistence, WebSocket world sessions, combat/chat intents, parties, guilds, dungeon matchmaking, social/mail, 1v1 PvP and competitive queue endpoints on this branch. Queue allocation is not complete arena maps, battleground objectives or combat-result settlement. A successful container start does not prove production capacity; run integration, soak and security testing before public registration.
