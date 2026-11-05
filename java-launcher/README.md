# GB-Quest — Native Java Edition

This module is the native Java desktop implementation, separate from the HTML5 game. It uses Java 17+ and the standard Swing/AWT APIs; it does not require a browser, JavaFX, or third-party runtime libraries.

## Build and run

From the repository root:

```sh
cd java-launcher
mvn clean package
java -jar target/gbquest-java-0.4.0.jar
```

The windowed game runs as a native desktop Java application. Run it from the repository root when you want the optional `assets_hd64/` files to be discovered. If an atlas cannot be loaded, the renderer falls back to its procedural pixel-art terrain.

To open the existing HTML5 edition instead:

```sh
java -jar java-launcher/target/gbquest-java-0.4.0.jar --browser
```

## Current native gameplay slice

- 2D tile world, camera tracking, collision and keyboard movement
- Hostile creatures pursue the player and deal contact damage
- Directional melee attacks, enemy health, XP and level progression
- Health, mana, gold, potion inventory and pickups
- Versioned local save file at `saves/java-edition.properties`
- Java Swing desktop window with crisp integer scaling

Controls: **WASD / Arrow keys** move, **Space** attacks, **H** uses a healing potion, **Esc** exits.

## Port status

This is the beginning of the native port, not yet a feature-complete parity release. The original game contains substantially more systems (classes/species, 9 attributes, equipment and affixes, skills/spells, quests, dungeons, bosses, crafting, market, guilds, companions, online services, and the full asset catalog). Those systems must be ported in vertical slices and verified against the JavaScript reference. The browser edition remains intact and is still the feature-complete reference while the port proceeds.

## Architecture

- `Main`: native application entry point; `--browser` retains the optional browser launcher.
- `GameState`: world state, collision, combat, progression, enemies and pickups.
- `GamePanel`: fixed-step input/update and pixel-crisp 2D rendering.
- `SaveStore`: versioned local persistence.
