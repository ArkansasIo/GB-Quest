# Admin control plane

Open `/admin` on the realm server and sign in with an account granted staff access. The control plane provides live realm metrics, player moderation, realm and game-system settings, staff roles, and an audit log.

## Bootstrap root

1. Start the realm server and register a dedicated account.
2. Read its immutable account ID from authenticated `GET /api/me`.
3. Set `GBQ_ROOT_ID` to that ID in the server environment and restart the server.
4. Open `/admin` on the realm server and sign in as root.

The account named by `GBQ_ROOT_ID` always receives root permissions. Root can create admin accounts from **Permissions → Create account**. Alternatively, `GBQ_ADMIN_ID` can designate a fixed admin account directly. Admin sessions are kept in tab-scoped browser storage. Use HTTPS and host-level access controls when exposing the realm to the internet.

## Staff permissions

- **Admin:** view the overview, players and audit log; moderate players; change realm settings; create player/moderator accounts; assign moderator roles.
- **Moderator:** view the overview, players and audit log; suspend or restore player accounts.
- **Player:** no control-plane access.

Root can create or promote admins, grant or remove moderator access, and manage every system. Admins can grant or remove moderator access. Environment-configured root/admin identities cannot be demoted in the control plane. Role changes, account creation, and moderation actions are audited.

## Live settings

Realm settings are persisted in the realm data file and take effect immediately. They control maintenance mode, account registration, chat, auction house, invites, friends/social features, cloud saves, leaderboard updates, live presence/multiplayer events, per-player listing and invite limits, invite lifetime, chat rate, and maximum cloud-save size. Maintenance mode blocks player API access and disconnects players while preserving admin access.

## Admin API

- `GET /api/admin/me` returns the staff role and permissions.
- `GET /api/admin/overview`, `/players`, and `/audit` provide operational data.
- `GET` and `PUT /api/admin/settings` read or update persisted realm settings.
- `GET /api/admin/permissions` lists role permissions and current staff.
- `POST /api/admin/accounts` creates an account with the requested allowed role.
- `PUT /api/admin/players/{accountId}/role` assigns `player`, `moderator`, or (root only) `admin`.
- `POST /api/admin/players/{accountId}/ban` and `/unban` moderate accounts.

Admin and moderator APIs require an authenticated bearer session. Settings and staff-role changes require admin permissions; player moderation requires the `players.moderate` permission.
