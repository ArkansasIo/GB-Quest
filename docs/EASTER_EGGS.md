# Hidden Easter Eggs

The game contains four undisclosed button-code secrets. They are detected during normal world exploration; no cheat menu or developer console is required.

## Discoveries

- **The Old World** — classic ten-button directional/controller sequence. Reward: 1,337 gold, one boss sigil and 2,500 XP.
- **Hello, Builder** — alternating directional pattern followed by an action. Reward: 4,242 gold and 4,200 XP.
- **The Slime Whisperer** — a short up/down pattern ending in two action buttons. Reward: 250 gold, three potions and 500 XP.
- **Light in the Dark** — a directional cross-pattern followed by action and start. Reward: 777 gold, two boss sigils and 1,777 XP.

The exact sequences are intentionally omitted from the player-facing archive. Each discovery is recorded once per character save; replaying a code cannot duplicate its reward. The Secret Archive appears in the main menu after the first discovery and shows names and hints for found secrets while leaving unknown entries concealed.

## Technical implementation

- `src/easter_eggs.js`: definitions, input sequence recognizer, idempotent reward grant and archive summary.
- `src/scenes_world.js`: samples newly pressed controller keys while the player is stationary.
- `src/scenes_menu.js`: unlockable Secret Archive.
- `src/systems.js`: save migration/default for discovered secrets.
- `tests/easter_eggs.test.js`: reward idempotence and archive coverage tests.

The secrets are client-side and save-local. In an authoritative online deployment, discovery and reward grants should be validated by the game server.
