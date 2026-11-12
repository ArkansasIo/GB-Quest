# MMORPG account and realm character creation

The browser title screen's **NEW GAME** action now opens an account gateway before the standard Aelmoor character creator.

## Player flow

1. Enter the MMO service URL, account name and password.
2. Choose **SIGN IN** or **CREATE ACCOUNT**.
3. Select a region/data centre and an online realm.
4. Continue to the existing character creator, choose class/appearance/name, and review the summary.
5. Confirming the summary creates the character on the selected realm through the authenticated server API. The server enforces account ownership, realm availability, per-realm/per-account limits and realm-unique names.
6. The created server character ID, account ID and realm ID are linked to the local campaign save.

**PLAY OFFLINE INSTEAD** preserves the existing local-only new-game path. The advanced local character creator remains offline-only until its full race/stat payload has a server-side schema.

## Configuration

Set `window.GBQ_MMO_REALM_URL` before the account script loads when the MMO service is hosted separately from the game, for example:

```html
<script>window.GBQ_MMO_REALM_URL = 'https://mmo.example.com';</script>
```

The remote service must allow the exact browser origin through `GBQ_ALLOWED_ORIGINS` and serve HTTPS. Localhost HTTP is allowed only for development. The account gateway also accepts a server URL in its sign-in form.

The account token is held in page memory only; it is not written to localStorage. Closing/reloading the page requires signing in again. The backend stores password hashes using scrypt and issues its existing signed session token.

## Server endpoints used

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `GET /api/regions`
- `GET /api/realms`
- `POST /api/characters` with `name`, mapped server `class`, and selected `realmId`

Local campaign progression is still stored in the browser save slot. This change registers the account-owned character identity and realm assignment on the MMO server; it does not yet synchronize all local inventory, quests, combat progression or campaign state to PostgreSQL. That requires a separate server-authoritative save/progression integration.

## Validation

```sh
node --test tests/mmorpg-account.test.js
npm run check:syntax
```
