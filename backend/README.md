# MMORPG backend

`server.cjs` is the Node.js realm service. It owns account sessions, cloud saves, presence/chat routing, friend records, invite codes, the realm directory, and server-side admin operations. It has no runtime dependencies.

Run it with `npm run server` (the compatibility entry in `server/server.cjs` still delegates here), or `node backend/server.cjs`. This server serves the game client at `/`, the fullscreen client at `/fullscreen`, the atlas at `/atlas`, and the admin client at `/admin`; the admin page calls the authenticated `/api/admin/*` routes on the same backend. The default data file remains `server/data/realm.json`; set `GBQ_DATA` to store it elsewhere. Use HTTPS behind a trusted reverse proxy for internet access.

Admin access is granted only to the account whose immutable ID equals `GBQ_ADMIN_ID`. Create a dedicated account, sign in, read its ID from `/api/me`, and configure that ID in the server environment. The ID is server configuration; never ship it in the client bundle. See [admin/README.md](../admin/README.md).

## Audit and debug logs

`logs.cjs` gives the realm server two append-only JSON-lines logs in `<GBQ_DATA>/logs/` (override with `GBQ_LOG_DIR`). Both rotate by size, and passwords, tokens, hashes and salts are redacted before anything is written.

**`audit.log`: who did what.** Each entry records `seq`, `at`, `action`, `actor`, `actorId`, `target`, `ip`, `outcome` (`success`, `failure`, `denied`, `throttled`), optional `details`, and the `reqId` of the request. Each entry also carries `prev` and `hash`, a SHA-256 chain over the previous entry, so editing or removing a line is detectable. Entries are written synchronously, before the response is sent. The log rotates at 10 MB and keeps 20 files.

| Action | Recorded when |
|---|---|
| `server.start` | the server starts |
| `auth.register` | an account is created (`throttled` when an IP registers too often) |
| `auth.login` | a sign-in succeeds or fails (`wrong_password`, `unknown_account`), is refused (`suspended`, `maintenance`), or is throttled; staff sign-ins include their role |
| `auth.logout`, `auth.password.change` | sign-out; a password change (failure when the current password is wrong; the number of other sessions revoked) |
| `admin.access` | a staff route is denied: no session, or a missing permission. The game's routine `/api/admin/me` role check is not recorded |
| `admin.settings.update`, `admin.account.create`, `admin.staff.role`, `admin.ban`, `admin.unban` | staff actions (also kept in `realm.json` for the in-game GM console) |
| `admin.audit.verify`, `admin.logs.level` | a staff member checks the chain or changes the log level |
| `save.write`, `save.delete` | a cloud-save slot is first written, changes level, or is deleted |
| `market.list`, `market.buy`, `market.cancel`, `market.claim` | auction house activity, with prices and seller credit |

On first start after upgrading, older admin entries in `realm.json` are imported into the audit log.

**`debug.log`: what went wrong.** Each entry is leveled (`error` > `warn` > `info` > `debug`), and each is also printed to the console unless `GBQ_LOG_QUIET=1`. The log rotates at 5 MB and keeps 5 files.

- `error`: any 500, with the stack trace, request ID, path and account; storage write failures (the server retries); uncaught exceptions; and audit chain failures.
- `warn`: requests slower than `GBQ_SLOW_MS` (default 1000), and throttled logins and registrations.
- `info`: start and stop, suspensions, chat rate limits, and malformed or oversized request bodies.
- `debug`: every request (method, path, status, ms, IP, account), live stream open and close, cloud-save writes, and realm data saves.

Set the level with `GBQ_LOG_LEVEL` (default `info`), or change it live from the control plane. Every response carries an `X-Request-Id` header, and server errors also return `reqId` in the body. When a player reports an error, search the debug log for that ID.

Set `GBQ_TRUST_PROXY=1` only when the server runs behind your own reverse proxy. The first `X-Forwarded-For` address is then logged as the client IP; otherwise the socket address is used.

## Regions and realms

The authoritative MMO service (`backend/mmorpg-server.cjs`) groups the world WoW-style: **regions** (NA *Hydaelyn*, EU *Lordeon*, AP *Aether*) each hold three **realms**. Every character lives on one realm, and each realm is its own copy of the world. Players see, fight beside and chat with only the players on their own realm.

Apply the schema with `npm run mmorpg:migrate`. It runs every file in `backend/migrations/` in order, and each file is safe to run again. `002_regions_realms.sql` adds the `regions` and `realms` tables, puts characters and monsters on a realm, and gives every realm its own monsters.

| Realm type | Realms |
|---|---|
| PvE | Ironreach (NA), Moonfall (EU), Emberwild (AP) |
| PvP | Stormwake, Frostmarch (EU) |
| Roleplay | Ardenhold (NA), Dawnspire, Shadowfen (AP) |
| Seasonal | Starhaven (NA) |

HTTP endpoints:

- `GET /api/regions` returns every region with its realms: type, `pvp`, status, `maxPlayers`, live `population`, `load` (LOW / MEDIUM / HIGH / FULL) and `recommended`. Send a bearer token to also get `characters`, the number of your characters on each realm.
- `GET /api/realms?region=<id>` returns the realms of one region, or of all regions when `region` is left out.
- `POST /api/characters` takes `{ name, class, realmId }`. Names are unique per realm, in any letter case. The limit is 3 characters per realm and 12 per account. Errors: `unknown_realm`, `realm_unavailable`, `name_taken` and `character_limit_reached`.
- `GET /api/characters?realm=<id>` lists your characters on one realm.

WebSocket:

- `authenticated` also returns `regions` and `realms`.
- `character.select` enters that character's realm. It fails with `realm_full` when the realm is at `maxPlayers`, or with `realm_unavailable` when the realm is not online.
- `zone.snapshot` includes `realm`.
- `chat.send` takes `channel`: `zone` (the default), `realm` (everyone on the realm) or `whisper` (with `to`, a character name on the same realm). An unknown name returns `whisper_target_offline`.

Realm status lives in the `realms` table. Set a realm's `status` to `maintenance`, `offline` or `locked` to close it, or raise its `max_players`. The server rereads the table every 30 seconds.
