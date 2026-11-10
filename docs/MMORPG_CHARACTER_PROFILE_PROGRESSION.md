# Persistent character profile and attribute progression

Migration `011_character_progression.sql` adds server-owned talent points, allocated core attributes and unlocked-talent storage to each character.

## Authenticated profile

`GET /api/characters/:characterId/profile` returns the account-owned character sheet, realm, location, HP/MP, level/XP, wallet/bank balances, talent points, allocated attributes, unlocked talents, inventory, equipment and quest journal. The route verifies the bearer token and character ownership before reading any data.

## Attribute allocation

`POST /api/characters/:characterId/attributes`

Request body:

```json
{ "attribute": "str", "points": 1 }
```

Allowed attributes: `str`, `dex`, `con`, `int`, `wis`, `vit`. A request may spend 1–20 available points. Each attribute is capped at 100. The update is performed as one conditional SQL statement, so simultaneous requests cannot spend the same points twice. Invalid allocations return 400; insufficient points or a reached cap return 409.

## Awarding progression

When server-authoritative combat or a completed quest awards enough XP to cross the existing level threshold, the character gains one talent point alongside the level increase. Points are capped at 1,000. The client cannot set level, XP, gold, talent points, attributes or unlocked talents directly.

## Client API

`GBQuestMMOApi.characterProfile(characterId)` fetches the complete cloud sheet. `allocateAttribute(characterId, attribute, points)` spends points through the server. `recoverSession(characterId)` now fetches the profile alongside inventory, quests, guild, party, raid, mail, trade and chat resources.

## Deployment

Apply migrations in filename order, including `011_character_progression.sql`, before deploying code that reads these fields. The standard migration runner discovers numbered SQL files. Back up PostgreSQL before applying schema changes.

This is the persistence foundation. Unlockable talent-node definitions, prerequisites, class-specific trees and ability loadouts still need their own catalogue and server validation; `unlocked_talents` is storage only at this stage.
