# Online realms, friends, invites and store frame

## Realm directory

The realm directory contains nine realm identities for the world:

| Realm | Play style |
|---|---|
| Ardenhold | Roleplay |
| Ironreach | PvE |
| Moonfall | PvE |
| Stormwake | PvP |
| Dawnspire | Roleplay |
| Emberwild | PvE |
| Frostmarch | PvP |
| Starhaven | Seasonal |
| Shadowfen | Roleplay |

`GET /api/realms` returns the directory; `/api/health` includes the same list. This is the directory foundation. The current server still hosts one shared live-play room, so realm selection, per-realm character/save separation, transfers, and per-realm moderation are follow-up work. A production deployment should partition live peers and durable world state by realm before presenting these as separate playable shards.

## Account and session flow

The existing account scene supports registration, login, cloud-save upload/download, and logout. Passwords stay on the server as scrypt hashes. The browser stores a bearer token; logging out revokes that token. Keep passwords and tokens out of presence, chat, invite codes, and client logs.

## Friends and party invites

The friend list is available from **SOCIAL > FRIENDS** after realm login. Players can send a request by account name, accept/decline incoming requests, see whether a friend has an active connection, or remove a friend. Friend records are keyed by immutable account IDs, while names are display labels. Friend requests and relationships persist in the realm JSON database.

The invite flow is **SOCIAL > CREATE INVITE CODE** on the host and **SOCIAL > JOIN WITH CODE** on the guest. Codes are twelve hexadecimal characters, expire after 15 minutes, and resolve only to a currently connected host. A code grants a join target, not account access. The actual party join and battle authority continue to use the existing host battle protocol. Treat codes like short-lived bearer links and share them privately.

Authenticated API additions:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/friends` | Friend entries and incoming requests |
| POST | `/api/friends/request` | `{ username }`, send request or accept reciprocal request |
| POST | `/api/friends/accept` | `{ accountId }`, accept an incoming request |
| POST | `/api/friends/remove` | `{ accountId }`, remove friend or decline request |
| POST | `/api/invites` | `{ peer }`, create a 12-character, 15-minute code for your live connection |
| GET | `/api/invites/{code}` | Resolve a code to an online host peer |

## In-game store frame

Open **SOCIAL > REALM STORE** to view the store frame prototype. It lists cosmetic and account-service categories. The checkout is intentionally disabled: this repository has no payment provider, signed purchase verification, refunds, or entitlement fulfillment. No real-money charge can be started from the prototype.

Before enabling paid items, connect a payment provider through a server-only checkout flow. The server must verify provider webhooks, make purchase fulfillment idempotent, keep an auditable transaction ledger, support refunds and chargebacks, and grant entitlements server-side. Do not ship payment secrets or trust client-side purchase claims. Keep gameplay power, randomized paid rewards, and account security outside the store UI.

