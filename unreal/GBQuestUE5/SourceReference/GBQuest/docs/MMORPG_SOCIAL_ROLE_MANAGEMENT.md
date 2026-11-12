# Party roles and guild ranks

## Party roles

Authenticated party leaders can update a member's combat role:

`POST /api/parties/:partyId/members/:characterId/role`

Request body:

```json
{ "actorCharacterId": "leader-character-uuid", "role": "tank" }
```

Allowed roles: `tank`, `healer`, `damage`, `support`. The actor must be the party leader and own the actor character through the authenticated account. The response contains the updated party roster.

Client helper:

```js
await api.setPartyRole(partyId, leaderCharacterId, memberCharacterId, 'healer');
```

## Guild ranks

The guild leader can assign a non-leader member one of these ranks:

`POST /api/guilds/:guildId/members/:characterId/rank`

Request body:

```json
{ "actorCharacterId": "leader-character-uuid", "rank": "officer" }
```

Allowed assigned ranks: `officer`, `veteran`, `member`, `recruit`. The guild leader rank is controlled only by the existing leadership-transfer endpoint. The actor must be the authenticated guild leader and hold the database `promote` permission.

Client helper:

```js
await api.setGuildMemberRank(guildId, leaderCharacterId, memberCharacterId, 'officer');
```

## Security and testing

Both operations use the authenticated account, validate UUIDs and allowed enum values, lock the parent group row in a transaction, and reject unauthorized actors or missing members. They do not trust a client-supplied rank or role without server-side checks.

Run:
- `node --test tests/mmorpg-social-role-routes.test.js`
- `node --test tests/mmorpg-api.test.js`
- `npm run check:syntax`
