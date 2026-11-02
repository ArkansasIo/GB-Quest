# Admin control plane

Open `/admin` on the realm server. The page reads its existing `gbq_token` session from same-origin local storage and calls `/api/admin/*`. It shows a realm summary, account status, and an audit trail; administrators can suspend or restore accounts. Suspension revokes sessions and disconnects live streams.

## Enable the admin account

1. Start the realm server and register a dedicated account.
2. Log into that account and read its immutable account ID from authenticated `GET /api/me`.
3. Set `GBQ_ADMIN_ID` to that ID in the server environment, then restart the server.
4. Log in to the game with the dedicated account and open `/admin`.

Do not expose the admin account to normal play, do not put its ID in frontend code, and protect the deployment with HTTPS and host-level access controls. If `GBQ_ADMIN_ID` is unset, all admin API requests are denied. Administrative mutations are recorded in the persisted audit list.

## API

- `GET /api/admin/overview`
- `GET /api/admin/players`
- `GET /api/admin/audit`
- `POST /api/admin/players/{accountId}/ban` with an optional reason
- `POST /api/admin/players/{accountId}/unban`
