# Story campaign and quest structure

The Shattered Crown is an original six-act GB Quest campaign spanning levels 1-720. Each act contains three chapters, five main story quests and six side quests. The story is authored for the four original continents and a final rift region.

Quest records define stable IDs, objective type/target/count, act, recommended level, repeatability and rewards. Side quests are optional and can be replayable where explicitly marked.

## Quest runtime contract
- Track accepted, active, completed and failed states per character.
- Validate objective progress on the authoritative server.
- Grant rewards once; use an idempotent completion key.
- Persist quest flags and chapter unlocks.
- Do not allow future acts to unlock before required story prerequisites.
- Side quests can unlock reputation, recipes, companions, cosmetics, shortcuts and lore entries.
- Party members can share eligible quests, but each character's progress and rewards remain independently validated.

## Multiplayer

See `src/mmorpg/data/multiplayer.json` for the initial co-op/party/raid protocol contract. It defines five-player parties, twenty-player raid groups, presence, invitations, ready checks, chat, quest sharing, zone instances and server-authoritative combat/loot. This remains a protocol foundation until a server is deployed.

## Build identity

Build metadata is stored in `src/mmorpg/data/build-info.json`. Developer: ArkansasIo. Version: 0.3.0 alpha. Build ID: GBQ-20261101-001.

## Colour modes and build identity

The handheld settings include DMG green, Pocket colour, Sunset, Amber, Ocean and original-art colour modes. Build identity is stored in `src/mmorpg/data/build-info.json` and displayed above the handheld frame.

- Developer: ArkansasIo
- Version: 0.3.0 alpha
- Build ID: GBQ-20261101-001

## Campaign and quests

The Shattered Crown has six acts, eighteen chapters, thirty main quests and thirty-six optional side quests, spanning the level 1-720 progression. Quest records use objective targets, prerequisites, repeatability and rewards. The campaign runtime prevents incomplete objectives and duplicate reward claims.

## Multiplayer

The current implementation includes a client transport wrapper and a protocol contract for parties, raids, presence, chat, quest sharing and zone instances. It requires a deployed secure WebSocket server and authoritative backend before real online play is available. The handheld's Multiplayer screen intentionally displays the connection status rather than pretending a server is live.
