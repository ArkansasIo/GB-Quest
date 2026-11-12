# ADR 0001: Two backend modes, the realm server and the MMO service

- **Status:** accepted (records the current design)
- **Date:** 2026-11-11
- **Context source:** [repository audit 2026-11-11](../REPOSITORY_AUDIT_2026-11-11.md), finding P1 "Multiple backend modes create operational ambiguity"

## Context

The repository ships two servers that both accept accounts and both answer `/api/login`, `/api/realms` and similar paths, so it was not clear which one to run or which one each client feature talks to.

| | Realm server | MMO service |
|---|---|---|
| Entry point | `backend/server.cjs` (`server/server.cjs` is a compatibility path) | `backend/mmorpg-server.cjs` |
| Start | `npm run server`, or `tools/windows/start-realm-server.bat` | `docker compose up -d --build`, or `tools/windows/start-mmo-server.bat`; `npm run mmorpg:server` with `DATABASE_URL` |
| Port | 8787 | 8788 |
| Storage | one JSON file, `server/data/realm.json` (no database) | PostgreSQL, schema in `backend/migrations/` (applied by `npm run mmorpg:migrate`, or automatically by the container) |
| Who simulates the game | the browser; the server stores saves and relays messages | the server: movement, combat, XP, loot, gold, quests, inventory and trades are decided server-side |
| Transport | HTTP plus Server-Sent Events (`/api/stream`) | HTTP plus WebSocket (`/ws`) |
| Sessions | random session tokens kept in `realm.json` | signed 30-day bearer tokens, revocable through `token_version` (migration 017) |
| Serves the game page | yes: `/`, `/fullscreen`, `/atlas` on the same origin | no: the game is hosted elsewhere and connects across origins |
| Cross-origin pages | allowed when listed in `GBQ_ALLOWED_ORIGINS` (localhost always) | allowed when listed in `GBQ_ALLOWED_ORIGINS` (localhost always) |
| Scale | one process, a LAN or a small group of friends | one or more instances sharing PostgreSQL presence ([cluster guide](../MMORPG_MULTIPLAYER_CLUSTER.md)) |

## Decision

Keep both, deliberately, with separate jobs:

1. **The realm server is the default way to play together.** It needs only Node.js, runs on a home PC, serves the game itself and backs the classic game's online features (accounts, three cloud-save slots, realm select, live presence, chat, party battles, friends and invites, the player market, the realm leaderboard and the admin control plane). The browser stays authoritative for single-player rules, so it suits friends and LAN play, not an open public economy.
2. **The MMO service is the authoritative path for a public, persistent world.** Anything with real value to cheat (gold, loot, trades, auctions, talents, progression) must be decided there. New server-authoritative systems are built only in the MMO service; the realm server gains no new economy features.
3. **The two never share accounts, tokens or data.** An account on one does not exist on the other, and clients keep their server addresses apart: the realm address in ONLINE > SERVER ADDRESS (`localStorage` key `gbq_realm_url`), the MMO address in the MMO account panel.

## API ownership map

Client code and the server it talks to:

| Client code | Server | Endpoints used |
|---|---|---|
| `src/netlocal.js` (`LocalRealm`, `NET` server transport) | realm server | `/api/health`, `/api/register`, `/api/login`, `/api/logout`, `/api/me`, `/api/password`, `/api/saves`, `/api/hero(es)`, `/api/realm/select`, `/api/stream`, `/api/emit`, `/api/presence`, `/api/friends/*`, `/api/invites` |
| `src/front_end.js` (login, ONLINE hub, realm list, characters, friends) | realm server | through `LocalRealm`: `/api/realms`, `/api/regions`, plus the above |
| `src/market.js` | realm server | `/api/market`, `/api/market/buy`, `/cancel`, `/claim` |
| `src/admin.js`, `admin/controlplane.*` | realm server | `/api/admin/*` (hidden unless admin tools are enabled; never served cross-origin) |
| `src/scenes_menu.js` store screen (policy in `store/`) | realm server | `/api/store/catalog`, `/api/store/checkout` |
| `desktop/main.cjs` (launcher) | realm server | `/api/health`, `/api/realms`, `/api/me`, `/api/logout`, `/api/saves`, `/api/stream` |
| `client/mmorpg-account.js` (MMO account panel) | MMO service | `/api/register`, `/api/login`, `/api/me`, `/api/realms`, `/api/regions`, `/api/characters` |
| `client/mmorpg-trade.js` (trading HUD) | MMO service | `/api/trades/*`, `/api/dungeons/catalog`, `/api/dungeons/queue`, `/api/dungeons/groups/*`, `/api/characters`, account routes, `/ws` presence |
| `src/mmorpg/net/mmorpg-api.js`, `multiplayer-client.js` | MMO service | every `/api/*` route of `mmorpg-server.cjs` and its `mmorpg-*-routes.cjs` modules, and `/ws` |
| `src/scenes_menu.js` (online talent screen), `src/menus_aelmoor.js` (online character creation), `src/scenes_world.js` (opens the MMO account panel) | MMO service | through `GBQMMOAccount`: `/api/talents`, `/api/characters`, `/api/characters/:id/*` |

The MMO service also owns `/api/dungeons/*` (`backend/dungeon-matchmaking.cjs`), `/api/auctions`, `/api/vendors`, `/api/mail`, `/api/guilds`, `/api/guild-invites`, `/api/parties`, `/api/party-invites`, `/api/raids`, `/api/raid-invites`, `/api/instances`, `/api/ready-checks`, `/api/pvp-matches`, `/api/world/status` and `/health`.

## Consequences

- Shared paths such as `/api/login` mean different things on the two servers. Documentation and code comments name the server whenever they name a path.
- Launchers are labelled: `start-realm-server.bat` (realm server) and `start-mmo-server.bat` (MMO service).
- The classic game's cloud saves and market are not authoritative. Moving a feature from the realm server to the MMO service is a migration of that feature, recorded in a follow-up ADR, not a silent switch.
- Features that exist only in the browser simulation (seasonal journey and claims, local Activity Finder events) stay offline/local until the MMO service owns them, as the audit recommends.
