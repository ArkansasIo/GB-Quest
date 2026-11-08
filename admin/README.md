# Admin and developer tools (disabled by default)

The public/default GB-Quest build disables the in-game GM console, debug panel, realm admin API, `/admin` web control plane, and admin CLI. Existing staff roles are ignored while the server runs with administration disabled. This does not delete accounts, saved data, staff-role records, audit logs, or source code.

## Private development opt-in

Only enable administration on a private, isolated development realm:

- Set `GBQ_ENABLE_ADMIN=1` in the server environment before starting `backend/server.cjs`.
- For local client-side GM/debug tools, change `GAME_ADMIN_ENABLED` and `GAME_DEBUG_ENABLED` to `true` in `src/admin.js` and `src/debug.js`, then rebuild the game.
- Do not ship a client build with those constants enabled. Client-side cheats are not a security boundary; all multiplayer rewards and economy changes must remain server-authoritative.
- The admin CLI also requires `GBQ_ENABLE_ADMIN=1`.

When the server flag is unset or not exactly `1`, requests to `/admin`, `/admin/*`, and `/api/admin/*` return 404. The account API reports every account as a normal player and disables first-admin claiming.

## Data preservation

Disabling these tools does not remove realm accounts, role assignments, game saves, logs, or source files. Re-enabling requires the explicit private-development configuration above.

## Operational note

Keep normal server diagnostics and error logging enabled as appropriate. The disabled developer panel is not required for production observability; use deployment logs and CI instead.
