# Admin control plane

Open `/admin` on the realm server and sign in with an account granted staff access. The control plane provides live realm metrics, player moderation, realm and game-system settings, staff roles, and an audit log.

## Make yourself admin

**Easiest (in game):** start the realm server (`npm.cmd run server` on Windows), open `http://127.0.0.1:8787`, and create or log in to your account (**ONLINE > ACCOUNT**). While the realm has no admin, the account screen shows **CLAIM REALM ADMIN**. Choose it and your account becomes **root**. This only works from the computer running the server, not over the network or through a reverse proxy, and only once: after that, admins promote other staff. The claim is written to the audit log.

**Command line (server stopped):**

```
npm run admin -- create <name> <password> [root|admin|moderator]   # new staff account (default root)
npm run admin -- promote <name> [role]                             # existing account (default root)
npm run admin -- demote <name>
npm run admin -- list
```

The tool refuses to run while the server is up, because the server would overwrite the change. Root accounts made this way or by claiming can only be changed with this tool.

**Developer mode:** root and admin accounts get developer mode in the game automatically: the GM console (F10), the debug panel, and SETTINGS > DEVELOPER MODE shows **ACCOUNT**. Other players can still turn developer mode on themselves for offline play.

## Bootstrap root with environment IDs

1. Start the realm server and register a dedicated account.
2. Read its immutable account ID from authenticated `GET /api/me`.
3. Set `GBQ_ROOT_ID` to that ID in the server environment and restart the server.
4. Open `/admin` on the realm server and sign in as root.

The account named by `GBQ_ROOT_ID` always receives root permissions. Root can create admin accounts from **Permissions → Create account**. Alternatively, `GBQ_ADMIN_ID` can designate a fixed admin account directly. Admin sessions are kept in tab-scoped browser storage. Use HTTPS and host-level access controls when exposing the realm to the internet.

## Staff permissions

- **Admin:** view the overview, players, audit log and debug log; moderate players; change realm settings; create player/moderator accounts; assign moderator roles.
- **Moderator:** view the overview, players and audit log; suspend or restore player accounts.
- **Player:** no control-plane access.

Root can create or promote admins, grant or remove moderator access, and manage every system. Admins can grant or remove moderator access. Environment-configured root/admin identities cannot be demoted in the control plane. Role changes, account creation, moderation actions, denied staff access, sign-ins, password changes, cloud saves and marketplace trades are recorded in the tamper-evident audit log. The **Audit log** tab filters, verifies and exports it; the **Debug log** tab shows server errors and slow requests. See [backend/README.md](../backend/README.md#audit-and-debug-logs).

## Live settings

Realm settings are persisted in the realm data file and take effect immediately. They control maintenance mode, account registration, chat, auction house, invites, friends/social features, cloud saves, leaderboard updates, live presence/multiplayer events, per-player listing and invite limits, invite lifetime, chat rate, and maximum cloud-save size. Maintenance mode blocks player API access and disconnects players while preserving admin access.

## Admin API

- `GET /api/admin/me` returns the staff role and permissions.
- `GET /api/admin/overview` and `/players` provide operational data.
- `GET /api/admin/audit?action=&outcome=&actor=&target=&ip=&since=&limit=` searches the audit log, newest first. `action` matches by prefix: `auth` matches `auth.login`, `auth.register` and so on.
- `GET /api/admin/audit/verify` checks the audit hash chain. It returns `{ ok, checked }`, or the first entry that was edited or removed.
- `GET /api/admin/logs?level=&q=&limit=` reads the debug log (root and admin only). `PUT /api/admin/logs/level { level }` changes the log level without a restart.
- `GET` and `PUT /api/admin/settings` read or update persisted realm settings.
- `GET /api/admin/permissions` lists role permissions and current staff.
- `POST /api/admin/accounts` creates an account with the requested allowed role.
- `PUT /api/admin/players/{accountId}/role` assigns `player`, `moderator`, or (root only) `admin`.
- `POST /api/admin/players/{accountId}/ban` and `/unban` moderate accounts.

Admin and moderator APIs require an authenticated bearer session. Settings and staff-role changes require admin permissions; player moderation requires the `players.moderate` permission.

## In-game ADMIN CONTROL (GM console)

`src/admin.js`. Open it with **F10**, **SETTINGS > ADMIN CONTROL**, or `/gm` in chat. It is available to the page owner, to realm staff (root, admin or moderator), and in developer mode (open the game with `#admin`, or turn on SETTINGS > DEVELOPER MODE).

| Menu | Sub-menus |
|---|---|
| PLAYER | level, gold, heal, god mode, no encounters, give gear (kind > tier > rarity), materials packs, professions (100 / 720, all blueprints, smith path), collections (mounts, companions, bestiary, waypoints, achievements), reset perks |
| WORLD | teleport (world > region > zone), time of day, weather, spawn encounter / creature / world boss, respawn nodes and bosses, enter any dungeon or raid |
| ECONOMY | restock the NPC market, settle or clear your listings |
| CHAT & BROADCAST | GM broadcast, clear chat |
| REALM SERVER | overview, players (ban / unban / moderator / player), realm settings toggles, audit log; this menu uses the staff API |
| SAVES | save now, repair, copy to a slot, wipe a slot (with confirmation) |
| GM COMMANDS | the typed command list |
| OPTIONS | XP rate, encounter rate, chat bubbles, screen chat, combat log, UI theme, battle background |
| DEBUG | debug panel, collision grid, profiler, game info, developer mode |

Typed GM commands (`/gm help` lists them all):

| Command | Does |
|---|---|
| `/gm level 50` | sets your level (1-720) |
| `/gm gold 1000` | adds gold |
| `/gm heal` | restores HP, slots and companions |
| `/gm god` | toggles god mode |
| `/gm noenc` | toggles random encounters |
| `/gm tp <zone>` | teleports to a zone, by id or name |
| `/gm item <weapon\|armor\|wondrous> <tier> <rarity>` | makes gear: tier 1-23, rarity 1-8 |
| `/gm mats <tier>` | gives a tier materials pack |
| `/gm prof <n>` | sets every profession skill |
| `/gm mount <id\|all>` | grants one mount, or all 120 |
| `/gm time <dawn\|noon\|dusk\|night\|live>` | sets the time of day |
| `/gm weather` | toggles weather |
| `/gm spawn <boss\|creature\|normal>` | starts a battle |
| `/gm reveal` | unlocks all waypoints and the full map |
| `/gm bestiary` | records every creature |
| `/gm xp <x>` | sets an XP rate multiplier |
| `/gm say <text>` | broadcasts a GM message |
| `/gm save` | saves now |

Icons: `tools/gen_admin_icons.py` draws 12 8-bit admin icons (`assets/ad_*.png` for the game, `admin/assets/` for the web) and the realm crest. It also inlines them into this control plane, which uses the same black-and-bronze theme as the game.
