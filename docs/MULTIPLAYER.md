# Multiplayer

Multiplayer runs on the hosting page's own real-time and storage capabilities, with no separate server process. When Lost Kingdom of Shadowbane Chronicles is opened as a shared artifact, everyone with the page open is in the same **room**.

## Layers

| Layer | Transport | What |
|---|---|---|
| Presence | `room.presence()` / `onPeers()` | your hero's zone, tile position, look, name and level; whether you are hosting a server |
| Chat | room topic | nearby say/yell, party, guild, whisper, world, trade, LFG and emote channels, shown in the filtered chat panel |
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

## Chat channels

The chat panel keeps timestamped messages and filters for **All**, **Say**, **Party**, **Guild**, and **Social**. Slash commands select the send channel: `/s` nearby say, `/y` yell in the zone, `/p` party, `/g` guild, `/w name message` whisper, `/r message` reply, `/1` world, `/2` trade, `/4` LFG, and `/e` emote. `/help` lists commands. Realm-server routing limits say to nearby players, yell to the same zone, party/guild to their members, and whispers to the target; world, trade and LFG reach the connected realm. Offline say/yell/emote remain local.

## Planned: dedicated realm server

A Node service with the same `srv_*` message shapes over WebSocket, persistent world bosses, an auction house and mail, and server-side loot. It is designed so that the existing host code path becomes the server's battle worker.

The current server now exposes a nine-name realm directory, account friend requests, and short-lived invite codes. Live play remains one shared server room; independent realm shards and cross-realm character rules are not implemented yet. See [ONLINE_REALMS_SOCIAL_STORE.md](ONLINE_REALMS_SOCIAL_STORE.md) for the current contract and store-frame status.

## WoW-style chat

`src/chatwow.js`, built on `NET.sendChat` and `chatLog`. Press **C** to show or hide the chat panel and **Enter** to type.

| Channel | Command | Notes |
|---|---|---|
| Say / Yell / Emote | `/s` `/y` `/e` | nearby players (say is limited to 12 tiles); shows as a chat bubble over the speaker |
| 1. GENERAL - zone | `/1` | the channel is labelled with your current zone |
| 2. TRADE - CITY | `/2` | cities only |
| 3. LOCAL DEFENSE | `/3` | |
| 4. LOOKING FOR GROUP | `/4` | |
| Custom channels | `/join name`, `/5`-`/9`, `/leave n`, `/chatlist` | up to 5 |
| Party / Raid / Instance | `/p` `/ra` `/i` | |
| Guild / Officer | `/g` `/o` | |
| Whisper / Reply | `/w name msg`, `/r` | |

**Other commands:**

| Command | Does |
|---|---|
| `/who` | lists real players and adventurers in your zone |
| `/afk`, `/dnd` | sets away or busy; incoming whispers show an auto-reply note |
| `/roll [max]` | rolls a number, 1-100 by default |
| `/played` | shows time played on this hero |
| `/ignore`, `/unignore` | hides or shows a player's messages |
| `/friend`, `/unfriend` | adds or removes a friend |
| `/invite name` | invites a nearby adventurer into your party |
| `/clear` | clears the chat window |
| `/help` | lists every command |
| `/wave` and 19 others | emotes: dance, cheer, bow, laugh, cry, flex, sit, sleep, salute, thank, hug, clap, roar, shrug, point, kneel, taunt, yawn, kiss |

**Tabs:** GENERAL (everything except the combat log), COMBAT (every battle line), LOOT (loot, money, XP, level-ups, achievements, quests and rolls), WHISPER, SOCIAL.

**Automatic messages:** loot pickups, gold, XP gained, level-ups, achievements, toasts and battle lines are posted to the right tab. Townsfolk and adventurers talk now and then in say, trade or LFG.

**In the world:** say, yell and emote messages appear as bubbles over the speaker (you, real players and adventurers). While the chat panel is hidden, the last 3 lines appear in the game screen above the HUD.

Ignore, friend and custom-channel lists are saved with the hero (`G.chat`).
