# Online Talent UI

The in-game Talent screen now uses the server-authoritative specialization catalogue for online characters.

## Session lifecycle

- The account gateway passes the authenticated session to online character creation.
- After the server creates the hero, the game adopts a separate in-memory gameplay session.
- The bearer token is not copied into the game state, save slots, or local storage.
- Closing the account/realm overlay does not invalidate the gameplay session.
- Calling `GBQMMOAccount.logout()` clears both gateway and gameplay credentials. Reloading the page also clears them.

The browser uses `GBQMMOAccount.gameplayRequest(path, options)` for authenticated progression calls. The server remains responsible for ownership, level gates, prerequisites, point costs, and atomic unlocks.

## Controls

- New online characters choose one of the three class specializations before entering a tree.
- Left/right changes the specialization before one is selected.
- `SELECT` cycles Assault, Utility, and Mastery branches.
- Up/down navigates the current branch.
- `A` requests a server unlock.
- `B` returns to the previous menu.
- The screen reloads the profile and talent catalogue after a successful unlock.

Online respec is intentionally disabled in the client. A server-side respec transaction and policy must exist before a client may refund points. Offline characters retain the original local talent screen and local reset behavior.

## Current scope

The UI displays the generated 73-node catalogue per specialization, server level requirements, point costs, prerequisites, and unlocked status. The authoritative WebSocket combat handler now:
- Rejects ability IDs that are not unlocked active/ultimate nodes.
- Applies passive talent damage bonuses, with a server-side cap.
- Applies the selected active/ultimate damage multiplier.
- Charges the node's configured mana cost from the persistent character record.
- Enforces and persists per-character cooldowns across reconnects and server instances.
- Includes the used ability, mana spent, and passive bonus in the combat resolution event.

Clients can call `MultiplayerClient.attack(targetId, abilityNodeId)`; omitting the ability ID performs a basic attack. The server still validates every request. Ability cooldown enforcement and wiring this helper into the game's in-world hotbar remain separate work.
