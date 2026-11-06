# Player HUD redesign

The browser game now includes a responsive dark-fantasy DOM HUD layer. The original 160×144 canvas renderer remains intact; the HUD is a separate overlay so the legacy game loop and save format are not rewritten.

## Source files

- `src/player_hud.js` — mounts the HUD, reads the live `GBQ.G` character state, updates vitals/resources/party/quest/location data, and routes navigation buttons into existing game scenes.
- `client/player-hud.css` — responsive black-steel, bronze, and gold visual system with desktop and mobile layouts.
- `index.html` — loads the stylesheet and HUD module after the game entry point.

## HUD regions

- Top bar: game identity, compass, currency.
- Left rail: player portrait placeholder, level, health, mana, XP, and party frames.
- Right rail: zone map panel, coordinates, and active quest summaries.
- Bottom rail: character, inventory, skills, talents, crafting, map, journal, guild, market, collection, and eight action slots.

## Integration notes

The HUD is read-only with respect to player progression. It polls the live state at a low frequency and does not alter stats, inventory, equipment, quests, or saves. Navigation buttons reuse existing scene constructors and the existing world atlas. The legacy canvas HUD and its renderer remain available as a fallback.

## Live gameplay integration

- During combat, the HUD reads the active battle's authoritative hotbar entries through `window.GBQCombatHotbar`; action buttons invoke the battle's existing `useHotbar` method, preserving target selection, resource costs, cooldowns, and combat rules. Unavailable actions are disabled.
- In the overworld, `window.GBQWorldMapMini` exposes a read-only snapshot of the current `Field` map rows, player tile coordinates, region name, and nearby entity markers. The HUD draws that snapshot to its minimap canvas and updates the location/coordinate labels from the same source.
- The bridge functions are read-only except for the explicit hotbar `use(index)` action. They do not add a parallel combat or map state model.

- In real-time combat, hotbar entries expose remaining cooldown and global-cooldown ticks from the active battle. The HUD shows a seconds overlay and disables unavailable or paused actions; the battle engine remains authoritative for activation.

## Interactive minimap

- Zoom controls scale the visible tile window around the player; the center control resets to the default player-centered view.
- Clicking a tile inspects its coordinates; clicking a marker reports its name/type and coordinates. Markers are sourced from the current field's live entity list and remain informational; gameplay interactions continue through the existing world controls.
- Marker snapshots include display names where the world entity provides them. The HUD does not teleport the player or mutate world state from map clicks.


## HUD hardening — November 2026

- Quest rail now excludes completed, inactive, and done entries before selecting the visible objectives.
- XP progress normalizes the level-threshold values returned by the progression helper before calculating the bar.
- Scene navigation catches constructor/push failures and gives the player a visible, non-blocking unavailable-menu message rather than interrupting the game loop.
- Hotbar activation validates the live combat entries before dispatch and preserves the authoritative combat bridge as the only activation path.
- Responsive keyboard focus is retained when a hotbar refresh rebuilds its button markup; focus is not moved when the user was interacting elsewhere.
- Added visible keyboard focus treatment and minimum touch targets for minimap controls.

## Live combat profile panel — November 2026

- Added a compact HUD combat profile with armor class, weapon damage, weapon hit bonus, average equipped item level, and equipped-slot count.
- Values are read from the existing `derive(G)` result and current `G.eq` loadout. The HUD does not calculate combat outcomes or modify equipment.
- Empty slots and missing optional stat values render as zero; item level averages only equipped items with a positive item-level value.


## Live character attributes panel — November 2026

The player HUD now renders STR, DEX, CON, INT, WIS, CHA, LCK, WIL, and SPD with each score and its signed modifier. Values are read from the existing `derive(G).A` and `derive(G).M` rules outputs; the HUD does not calculate or persist a parallel character sheet. The panel uses a compact three-column desktop grid and is hidden on narrow mobile layouts to preserve the gameplay viewport. A source-level regression test checks all nine bindings and the rules bridge.
