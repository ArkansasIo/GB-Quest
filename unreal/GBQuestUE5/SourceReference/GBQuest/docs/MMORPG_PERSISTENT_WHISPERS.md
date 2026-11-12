# Persistent same-realm whispers

Migration `008_persistent_whispers.sql` adds a durable direct-message store. Apply it with the normal migration runner before using the history endpoint.

## API

`GET /api/characters/:characterId/whispers?with=:peerCharacterId&limit=50`

- Requires the account bearer token.
- The selected character must belong to the authenticated account.
- The peer must exist on the same realm.
- Returns the newest 1–100 messages in chronological order.
- Incoming messages returned by the query are marked read.

## WebSocket delivery

Send `chat.send` with `channel: "whisper"`, `to: "CharacterName"`, and `text`. The server persists the message before attempting local or cross-instance delivery. Offline recipients can retrieve it from whisper history after reconnecting.

## Operational notes

- Messages are scoped to a realm and deleted when either character is deleted.
- Retention is 30 days; run the optional cleanup job in `ops/cleanup-expired-data.sql` daily.
- Message delivery remains best-effort; PostgreSQL history is authoritative and clients should fetch history after reconnect.
