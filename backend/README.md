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
- `chat.send` takes `channel`: `zone` (the default), `realm` (everyone on the realm) or `whisper` (with `to`, a character name on the same realm). Whispers are persisted before delivery, so an offline recipient can read them later. An unknown name returns `whisper_target_not_found`.
- A character can be controlled by only one live WebSocket at a time; a second connection receives `character_already_online`. Disconnects remove presence and release the slot.
- Unauthenticated sockets are closed after 10 seconds. The server sends WebSocket ping frames every 30 seconds and terminates connections that stop answering. A client whose outbound buffer exceeds 1 MiB is disconnected rather than allowing unbounded memory growth.
- The authoritative socket currently supports `zone`, `realm` and `whisper` chat. Other channel names return `unsupported_chat_channel`; they are never silently delivered to the zone.
- Server tuning: `GBQ_WS_AUTH_TIMEOUT_MS`, `GBQ_WS_HEARTBEAT_MS` and `GBQ_WS_MAX_BUFFERED_BYTES` override the respective defaults.

Party WebSocket messages:

- `party.create` creates a persistent party with the current character as leader.
- `party.invite` takes `{ to: "CharacterName" }`. Only the leader can invite; the target must be on the same realm, not already grouped, and the party must have fewer than five members. Invitations expire after five minutes.
- `party.accept` takes `{ invitationId }` and joins the invited character after server-side realm, expiry, membership and capacity checks.
- `party.leave` removes the current character. If the leader leaves, the longest-standing remaining member becomes leader; an empty party is deleted.
- `party.kick` takes `{ characterId }` and is leader-only.
- Party changes are broadcast as `party.snapshot` / `party.updated`; invitees receive `party.invited`, and kicked members receive `party.kicked`.
- `chat.send` with `channel: "party"` delivers chat only to current members. Party membership persists across disconnects and reconnects.
- Migration `011_party_system.sql` creates party, membership and invitation tables. The five-member limit is enforced transactionally when invitations are accepted. This is single-service-instance party presence; multi-replica coordination still requires shared presence/pub/sub.

Direct-message HTTP endpoints:

- `GET /api/characters/:id/whispers?with=<peerCharacterId>&limit=50` returns recent inbox/conversation messages and marks incoming messages read.
- `POST /api/characters/:id/whispers` accepts `{ toCharacterId, text }` and requires both characters to share a realm. Offline recipients are supported.
- Messages are stored in `player_whispers` and automatically purged after 30 days. WebSocket commands are serialized per connection to preserve state order.

Character progression:

- Migration `009_jobs_level_720.sql` adds the full 27-job list and the browser game's level 1–720 XP curve. Migration `010_character_species_background.sql` persists all 15 playable species and six backgrounds. Legacy warrior/mage/ranger/cleric/rogue/adventurer values are mapped to warden/arcanist/strider/chaplain/shade/warden respectively.
- `gbq_level_for_xp(bigint)` is the authoritative database progression function. Class-feature levels and post-20 ascension levels remain separate game concepts.

Realm status lives in the `realms` table. Set a realm's `status` to `maintenance`, `offline` or `locked` to close it, or raise its `max_players`. The server rereads the table every 30 seconds.

## Authoritative guilds

Migration `012_guild_system.sql` adds persistent realm-scoped guilds, unique names per realm, one guild per character, ranks and expiring invitations. Guild membership survives reconnects.

WebSocket commands after character selection:
- `guild.create` with `{name}` creates a guild and grants the creator the leader rank.
- `guild.invite` with `{to: "CharacterName"}` allows leaders and officers to invite ungrouped characters on the same realm. Invites expire after 24 hours.
- `guild.accept` with `{invitationId}` joins the invited character; the server verifies invitation, realm and uniqueness transactionally.
- `guild.rank` with `{characterId,rank:"officer"|"member"}` is leader-only.
- `guild.kick` with `{characterId}` lets leaders remove nonleaders, and officers remove members.
- `guild.leave` removes the character; leadership transfers to the longest-standing officer (otherwise oldest member), or deletes an empty guild.
- `chat.send` with `{channel:"guild",text}` broadcasts only to connected guild members.
- Guild membership is delivered via `guild.snapshot` on character selection and `guild.updated` on membership/rank changes.

Guild operations currently coordinate inside a single authoritative server process; distributed presence and cross-replica events are not yet implemented. Guild banks, audit logs, applications and shared storage are not part of this migration.

## Running the realm server (the multiplayer world)

`backend/server.cjs` is the realm server players connect to. It needs no database. On Windows, copy `tools/windows/start-realm-server.bat` next to `package.json` and double-click it. Anywhere else, run `HOST=0.0.0.0 PORT=8787 node backend/server.cjs`. The server serves the game itself at `http://<this computer>:8787`, so players open that address in a browser.

Each realm is its own world:

- An account plays on one realm at a time. `POST /api/realm/select` with `{ realm }` sets it, and the game sends it when a player enters a world from REALM SELECT and when a hero from a save loads. The server refuses a full or offline realm.
- The live player list, every chat channel (say, yell, party, guild, whisper, world, trade, LFG) and party-battle messages reach only the players on the same realm. Whispers to someone on another realm fail.
- `GET /api/realms` and `GET /api/regions` report live population: the distinct accounts connected to each realm. They also report a load label: LOW, MEDIUM, HIGH or FULL (`maxPlayers` is 1000).

Accounts, saves and realm settings live in `server/data/realm.json`.
