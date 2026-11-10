# Multiplayer reconnect and recovery

The browser transport supports opt-in reconnection with exponential backoff.

The same controls are exposed by `GBQuestMMOApi`, so the game can enable recovery without reaching into the transport object:

```js
const api = new GBQuestMMOApi({
  baseUrl: 'https://your-server.example',
  autoReconnect: true,
  reconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  onMessage: handleServerMessage,
  onStatus: handleConnectionStatus
});
```

Use `api.selectCharacter(characterId)` after the initial `authenticated` event. The API wrapper remembers that ID and reselects it after subsequent successful authentications.

```js
import { MultiplayerClient } from './src/mmorpg/net/multiplayer-client.js';

const client = new MultiplayerClient({
  autoReconnect: true,
  reconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  onStatus: status => console.log('Multiplayer status:', status),
  onMessage: event => {
    if (event.type === 'zone.snapshot') {
      // Replace local world state from the authoritative server snapshot.
    }
  }
});
client.connect('wss://your-server.example/ws', token);
client.selectCharacter(characterId);
```

On an unexpected socket close the client schedules a retry. After the server emits `authenticated`, the client resends `character.select` and receives a new `zone.snapshot`. A manual `disconnect()` cancels pending retries. The client does not replay movement, combat, trading, or other mutating commands: doing so would risk duplicate operations.

## Limitations and operations

- `autoReconnect` is off by default to preserve existing callers.
- The application must explicitly call `selectCharacter(id)` to enable character restoration.
- Reconnection does not bypass server authentication, realm capacity, or ownership checks.
- No durable replay of missed WebSocket events is implemented. Always replace state from the server snapshot and refetch party, guild, mail, auction and chat history through authenticated APIs.
- Server close code `4401` (invalid, expired, or unavailable account token) and `4403` (forbidden) stop automatic retries, clear the cached connection credentials and selected character, and emit `authentication_required`; the application should request a fresh login and reconnect with the new token.\n- Server close code `4429` stops automatic retries and emits `rate_limited`; wait for the server's rate-limit window and require an explicit reconnect rather than amplifying authentication traffic.\n- Other unexpected closes retain exponential-backoff retry behavior.
- Client tests: `node --test tests/mmorpg-reconnect.test.js`.


## Rebuilding UI state after reconnect

WebSocket messages are transient. After the transport reports `authenticated` and the server sends a fresh `zone.snapshot`, call `api.recoverSession(characterId)` to repopulate the character's durable UI panels:

```js
const recovery = await api.recoverSession(characterId, { chatLimit: 50 });
renderInventory(recovery.resources.inventory);
renderQuests(recovery.resources.quests);
renderParty(recovery.resources.party);
renderGuild(recovery.resources.guild);
renderInstances(recovery.resources.instance);
renderMail(recovery.resources.mail);
renderFriends(recovery.resources.friends);
renderTrades(recovery.resources.trades);
renderChat(recovery.resources.zoneChat, recovery.resources.realmChat);
if (recovery.errors.length) showRecoveryWarnings(recovery.errors);
```

The recovery call fetches inventory, quests, party, guild, dungeon instances, mail, friends, trades, and recent zone/realm chat in parallel. It uses `Promise.allSettled`: a failed panel is reported in `errors` while successful panels remain available. Invoke it after authentication/character selection and after receiving the authoritative `zone.snapshot`; do not replay commands that may mutate game state.
