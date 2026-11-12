# Persistent raid groups

Raid groups are durable, realm-scoped rosters independent of five-player dungeon parties. Migration `009_raid_groups.sql` adds raid groups, one-raid-per-character membership, role assignments, and expiring invitations. Apply it with `npm run mmorpg:migrate`.

## Rules

- Raid sizes are 10, 20, or 40; new groups default to 10.
- Characters can belong to only one active raid group and all members must share its realm.
- Only the raid leader can invite, assign roles, transfer leadership, or disband.
- Roles are `tank`, `healer`, `damage`, and `support`.
- Invitations expire after 60 seconds and are accepted only by the invited character's account.
- A raid leader must transfer leadership before leaving. Disbanding removes current membership and cancels pending invitations.
- Database uniqueness constraints protect membership and pending invites against concurrent requests.

## API client

```js
const { raid } = await api.createRaidGroup(characterId, { name: 'Nightfall', raidSize: 20 });
await api.inviteToRaid(raid.id, characterId, targetCharacterId);
await api.acceptRaidInvite(inviteId, targetCharacterId);
await api.setRaidRole(raid.id, characterId, targetCharacterId, 'healer');
await api.transferRaidLeadership(raid.id, characterId, targetCharacterId);
await api.leaveRaid(characterId);
await api.disbandRaid(raid.id, characterId);
```

Read the current roster with `api.raidGroup(characterId)` and current unexpired character lockouts with `api.raidLockouts(characterId)`. The lockout endpoint is read-only and returns only rows whose `reset_at` is still in the future. All endpoints require an authenticated account and verify character ownership for the acting character. Raid completion and lockout issuance are deliberately not exposed as client-authorized actions; those must be tied to authoritative server-side encounter completion.
