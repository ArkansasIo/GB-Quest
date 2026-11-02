# Realm server, accounts and online play

Lost Kingdom of Shadowbane Chronicles runs in three network modes:

| Mode | How | What you get |
|---|---|---|
| **Offline** | TITLE > ONLINE > MODE: OFFLINE, or SETTINGS > NETWORK | Solo play with AI companions and the simulated NPC realm. Nothing leaves your device. |
| **Online (shared page)** | open the published claude.ai page | Presence, chat, host-server battles and the leaderboard, through the page's built-in room and database |
| **Online (realm server)** | run `server/server.cjs` and open `http://localhost:8787` | Accounts (register, log in, log out), cloud saves, the realm leaderboard, and the same live play relayed by your own server |

## Run the realm server

```sh
python3 tools/build.py          # build the client first
npm run server                  # = node server/server.cjs  -> http://127.0.0.1:8787
PORT=9000 HOST=0.0.0.0 REALM="ARKANSAS REALM" node server/server.cjs   # LAN play
```

It needs Node 18+ and has no dependencies. Data is kept in `server/data/realm.json`, written atomically once a second and on shutdown; set `GBQ_DATA` to move it. The server serves the client on the same origin: `/` (handheld), `/fullscreen` and `/atlas`. For play over the internet, put it behind an HTTPS reverse proxy.

## Accounts

- **Register:** TITLE > ACCOUNT > CREATE ACCOUNT. Names are 3–16 letters, digits or `_`; passwords are 8–72 characters.
- **Log in / log out:** TITLE > ACCOUNT. The session token is kept in this browser for 30 days. Logging out ends the session on the server.
- Passwords are hashed with scrypt (N=16384, r=8, p=1) using a 16-byte salt per account and compared in constant time. Failed logins are throttled per IP and per name (10 per 10 minutes). A login for an unknown name still runs the hash, so the response time does not reveal which names exist.
- **Cloud saves:** ACCOUNT > UPLOAD SLOT n / DOWNLOAD SLOT n. Saves are limited to 1 MB each.

## API

| Method | Path | Auth | Body / result |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, realm, players, accounts }` |
| POST | `/api/register` | — | `{ username, password }` → `{ token, account }` |
| POST | `/api/login` | — | `{ username, password }` → `{ token, account }` |
| POST | `/api/logout` | Bearer | ends the session |
| GET | `/api/me` | Bearer | `{ account, slots }` |
| POST | `/api/password` | Bearer | `{ oldPassword, newPassword }` (logs out other devices) |
| GET | `/api/saves` | Bearer | the 3 slot summaries |
| GET / PUT / DELETE | `/api/saves/0..2` | Bearer | `{ state }` |
| GET | `/api/heroes` | Bearer | top 50 heroes |
| PUT | `/api/hero` | Bearer | publish your hero to the leaderboard |
| GET | `/api/stream?token=` | token | Server-Sent Events: `hello {peer}`, `peers {peers, left}`, `msg {topic, peer, data}` |
| POST | `/api/presence` | Bearer | `{ peer, presence }` |
| POST | `/api/emit` | Bearer | `{ peer, topic, data }`. Topics: `srv_join srv_char srv_battle srv_turn srv_act srv_end chat` |

The client (`src/netlocal.js`) wraps this API in an object with the same shape as the shared page's room (`presence`, `onPeers`, `on`, `emit`, `peers`). The host-server battle code in `systems.js` therefore runs unchanged on either transport. See the protocol in [MULTIPLAYER.md](MULTIPLAYER.md).

## Trading hub (auction house) and direct trade

`src/market.js` picks the backend automatically:

| Mode | When | Listings live in |
|---|---|---|
| `realm` | the game is served by `server/server.cjs` and you are logged in | the server (`db.market`); the server pays sellers 95% into `db.proceeds` |
| `page` | a shared claude.ai page | the page's shared database, collection `market` |
| `local` | offline | a simulated market: NPC sellers (gear, tiered materials, consumables) and NPC buyers |

There are two gold sinks: a 5% deposit when you list, and a 5% cut when the item sells. You can have up to 20 listings, and each lasts 12 hours. Unsold items are returned through **CLAIM**, or by mail when offline.

Server endpoints:

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/market` | lists active listings |
| `POST` | `/api/market` | creates a listing: `{ item \| stack, price, hours }` |
| `POST` | `/api/market/buy` | buys a listing: `{ id }` |
| `POST` | `/api/market/cancel` | cancels a listing: `{ id }` |
| `GET` | `/api/market/claim` | collects gold from sales and returned items |

**Direct trade** (`SOCIAL > TRADE`) runs over the `trade` room topic, on the page room or on the realm server. You invite a player who is online with you, and each of you puts up items, stacks and gold. Both sides LOCK, then both CONFIRM, and each client applies the swap. Received items are re-validated with `cleanItem`. Trades have no fees.

Item ownership is not checked on the server yet. A realm or page you host trusts its players' clients, so a modified client could list or trade items it doesn't own.
