# Multiplayer

Multiplayer runs on the hosting page's own real-time and storage capabilities, with no separate server process. When Lost Kingdom of Shadowbane Chronicles is opened as a shared artifact, everyone with the page open is in the same **room**.

## Layers

| Layer | Transport | What |
|---|---|---|
| Presence | `room.presence()` / `onPeers()` | your hero's zone, tile position, look, name and level; whether you are hosting a server |
| Chat | room topic | say, trade, LFG, guild, emote and system channels, shown in the chat panel |
| Host server | room topics `srv_*` | host-authoritative battles that friends join with their own heroes |
| Leaderboard | `db` collection `heroes` | one doc per player (`heroes/{self}`), readable by every viewer, writable only by its owner |
| Simulated realm | local | NPC "players" (seeded per zone) who walk, fight and chat, so the world never feels empty |

Each layer degrades on its own. With no room or database, the game is fully playable solo.

## Host server protocol

| Topic | Direction | Payload | Meaning |
|---|---|---|---|
| `srv_join` | guest → host | slim hero | request to join the host's party |
| `srv_char` | host → guest | ack and party slot | accepted |
| `srv_battle` | host → all | battle snapshot (units, HP, conditions, log) | render `RemoteBattleView` |
| `srv_turn` | host → guest | `{ to, foes, options }` | it is the guest's unit's turn |
| `srv_act` | guest → host | `{ action, target, spell/item }` | chosen action, which the host applies via `Battle.remoteAction()` |
| `srv_end` | host → all | result and loot | battle over |

Rules:

- The host rolls every die and is the only one who mutates battle state. Guests only choose.
- Presence is never trusted for authority: a peer's claimed level or position only affects how it is drawn.
- Strings from peers go through `clean()` (length limit and character filter) before they are shown.
- If a guest does not answer within 10 seconds (600 ticks), their unit switches to AI control for that turn.

See the sequence diagram in [UML.md §7](UML.md#7-sequence-multiplayer-host-battle).

## Play modes

| Mode | Party size | Filled by |
|---|---|---|
| Solo | 1 hero + 1 starter companion (+ hires) | AI companions |
| Party (dungeons) | 4 | joined guests, otherwise AI adventurers (`makeAdventurer`, role-balanced) |
| Raid | 12 | joined guests, otherwise AI adventurers |

## Planned: dedicated realm server

A Node service with the same `srv_*` message shapes over WebSocket, persistent world bosses, an auction house and mail, and server-side loot. It is designed so that the existing host code path becomes the server's battle worker.
