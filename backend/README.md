# MMORPG backend

`server.cjs` is the Node.js realm service. It owns account sessions, cloud saves, presence/chat routing, friend records, invite codes, the realm directory, and server-side admin operations. It has no runtime dependencies.

Run it with `npm run server` (the compatibility entry in `server/server.cjs` still delegates here), or `node backend/server.cjs`. This server serves the game client at `/`, the fullscreen client at `/fullscreen`, the atlas at `/atlas`, and the admin client at `/admin`; the admin page calls the authenticated `/api/admin/*` routes on the same backend. The default data file remains `server/data/realm.json`; set `GBQ_DATA` to store it elsewhere. Use HTTPS behind a trusted reverse proxy for internet access.

Admin access is granted only to the account whose immutable ID equals `GBQ_ADMIN_ID`. Create a dedicated account, sign in, read its ID from `/api/me`, and configure that ID in the server environment. The ID is server configuration; never ship it in the client bundle. See [admin/README.md](../admin/README.md).
