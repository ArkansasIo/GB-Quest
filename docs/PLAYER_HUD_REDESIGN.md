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

The map panel is currently a stylized location panel, not a new tile-map renderer. Action slots are presentation/shortcut slots until they are connected to the game's authoritative combat-art activation API.
