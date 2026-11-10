# GB Quest — Multiplayer Server Systems

This specification defines the authoritative multiplayer domain and deployment contract. The PostgreSQL MMO service remains the source of truth for accounts, characters, inventory, movement and combat. Migration 003 adds persistent tables for social groups, instances, mail, auctions, PvP and economy audit.

## Service boundaries
- Gateway/session: HTTPS REST + WSS, signed bearer sessions, origin allowlist, authentication throttling, message-size and sequence validation.
- Realm simulation: realm isolation, zone membership, movement validation, combat resolution, mob state, quest progress and reward grants.
- Social: friends, block list, whispers, parties (5), role assignment, invites, ready checks, guilds and guild ranks.
- Group content: dungeon instances, raid groups (up to 20), difficulty, membership snapshots, lockouts, encounter state and completion.
- Economy: server-owned inventory, player-to-player trade escrow, auction listings, mailbox attachments, bank and append-only ledger.
- Competitive: duels, arena 2v2/3v3, battleground queues, rating and match results.
- Operations: player reports, moderation queue, GM permissions, audit trails, realm maintenance and health checks.

## Security invariants
1. Every REST and WSS command is authenticated and character ownership is checked against the account.
2. Realm and zone are derived from the selected character and server-side records, never trusted from client payloads.
3. Client messages express intent only. Damage, cooldowns, movement speed, item quantity, gold, XP, loot and rating are calculated by the server.
4. Transfers and reward grants use PostgreSQL transactions and row locks. Trade, auction and mail claims must be idempotent and write the economy ledger in the same transaction.
5. Party, guild, whisper, trade, mail and instance membership cannot cross realm boundaries unless a future cross-realm transfer protocol explicitly allows it.
6. WSS requires TLS outside localhost. Configure GBQ_ALLOWED_ORIGINS with exact HTTPS origins; do not use wildcard origins.
7. Staff actions require permissions and audit entries. Staff secrets never ship in the browser bundle.

## Feature contracts
| System | Persistent state | Expected events/API |
|---|---|---|
| Presence | active socket + character zone | presence.joined, presence.moved, presence.left |
| Party | parties, party_members, party_invites, ready_checks | party.create/invite/accept/leave/role/ready |
| Guild | guilds, guild_members, guild_permissions | guild.create/invite/accept/leave/motd/rank |
| Dungeon/raid | dungeon_instances, dungeon_instance_members, raid_lockouts, ready_checks, ready_check_responses | instance.create/leave/complete, ready-check.start/respond/status |
| Friends/mail | player_friends, player_mail | friend.request/accept/block/remove, mail.send/claim |
| Economy | auction_listings, economy_ledger plus existing inventory/bank/trade tables | trade.offer/accept, auction.list/buy/cancel |
| PvP | pvp_matches, pvp_ratings | pvp.queue/leave/duel/result |
| Safety | player_reports | report.player and staff moderation routes |

## Scaling and runtime
- Keep one authoritative simulation owner per realm/zone. Process-local registries are single-node only; multi-node deployments require Redis/NATS pub-sub or a durable event bus plus distributed ownership leases.
- PostgreSQL is authoritative for durable state. Redis may cache presence, queues and short-lived invitations, never the sole copy of inventory or currency.
- Separate workers for simulation, chat fan-out, persistence and background jobs as load grows.
- Add per-account, per-IP and per-message-type limits; disconnect malformed clients; record request IDs and security events.
- Back up PostgreSQL, test restore, cap connection pools, and monitor p95/p99 latency, queue depth, active sockets, DB wait time, errors and memory.
- A configured 1,000-player realm cap is a product setting, not a demonstrated capacity benchmark.

## Migration and verification
Run npm run mmorpg:migrate with DATABASE_URL configured. The migration is additive and idempotent. Run npm test and npm run check:syntax before deployment.

**Implementation status:** party REST routes are now wired to PostgreSQL and exposed through the game API client: GET/POST/DELETE `/api/characters/:id/party`, POST `/api/parties/:id/invites`, and POST `/api/party-invites/:id/accept`. Party creation, membership, invitation expiry, realm checks, five-member cap and leader succession are persisted transactionally. Guild REST routes are also wired: GET/POST/DELETE `/api/characters/:id/guild`, POST `/api/guilds/:id/invites`, POST `/api/guild-invites/:id/accept`, and POST `/api/guilds/:id/motd`. Guild creation, realm-scoped names, invite permissions, invitation expiry, same-realm membership, ranks and MOTD permissions are persisted. Friend and block-list REST routes are now wired and exposed through the API client: GET/POST `/api/characters/:id/friends`, POST `/api/characters/:id/friends/:friendId/accept`, DELETE `/api/characters/:id/friends/:friendId`, and POST `/api/characters/:id/blocks`. Friend requests are same-realm, reciprocal pending requests auto-accept, and blocking removes the reverse relationship and prevents new requests. Dungeon instance and ready-check REST routes are now wired and exposed through the API client: GET/POST `/api/characters/:id/instances`, POST `/api/instances/:id/leave`, POST `/api/instances/:id/complete`, POST `/api/characters/:id/ready-checks`, GET `/api/ready-checks/:id?characterId=...`, and POST `/api/ready-checks/:id/respond`. Instance creation snapshots the caller's current party (leader-only) or creates a solo instance, enforces a five-player dungeon cap, same-realm membership, one active instance per character, server-generated seed and two-hour expiry. Ready checks are party-leader initiated, member-only, and expire after 30 seconds. Mail and auction REST routes are now wired into the server and API client. Mail supports same-realm delivery, up to five item attachments, gold, 30-day expiry, and atomic claim into inventory. Auction listings support 12/24/48-hour durations, a 2% refundable deposit, buyout, a 5% sale fee, cancellation/refund, and same-realm settlement through economy_ledger. PvP duel challenge REST routes are now wired: challenge, accept, decline, cancel, match history, and voluntary forfeit. Forfeits settle the duel and update both participants' duel bracket Elo ratings transactionally. This is a duel MVP only; ranked matchmaking, arena team queues, battlegrounds, authoritative live combat results, and client UI remain outstanding. All new REST flows still need database integration tests, rate limits, real-time event fan-out, and UI panels. The new routes still require a live PostgreSQL integration test before public launch.
