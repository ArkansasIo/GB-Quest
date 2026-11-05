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
