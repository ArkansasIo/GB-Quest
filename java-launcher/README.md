# GB-Quest — Native Java Edition

This module is a native Java desktop implementation alongside the existing HTML5 game. It uses Java 17+, Swing/AWT, and Maven. The native edition runs without a browser; `--browser` remains available to launch the HTML5 build.

## Build and run

From the repository root:

```sh
cd java-launcher
mvn clean package
java -jar target/gbquest-java-0.4.0.jar
```

The first run presents character creation. Select a hero name, one of the 15 source-game species, and one of the 27 source-game classes. The game stores progress in `saves/java-edition.properties`.

To open the existing HTML5 edition instead:

```sh
java -jar java-launcher/target/gbquest-java-0.4.0.jar --browser
```

## Current native systems

- Native 640×480 desktop window with integer-scaled 2D tile rendering and camera tracking
- Character creation with the reference game's 27 classes and 15 species
- Nine character attributes, species bonuses, class hit dice, derived HP/AC, proficiency, saving throws and skills
- Level progression through 720, using the reference XP thresholds through level 20 and paragon XP thereafter
- Procedural rarity tiers and affixes, gear stats, equipment slots, inventory, vendor purchasing and item selling
- Enemy pursuit, contact damage, directional melee, XP and gold rewards, pickups and healing potions
- Version 2 local saves including character identity, progression, wallet, inventory, equipped items and exact item stat rolls
- JUnit tests for character rules, item generation, inventory, vendors and save/load

## Controls

- **WASD / Arrow keys:** move
- **Space:** attack
- **H:** use a healing potion
- **V:** open the vendor
- **I:** open inventory; choose an item to equip or sell
- **Esc:** save and exit

## Architecture

- `Main`: native entry point and first-run character creation; `--browser` opens the browser edition.
- `CharacterRules`: species/class catalog, attribute derivation, saving throws and XP progression.
- `ItemSystem`: rarity, affixes, equipment, inventory, wallet and vendor economy.
- `GameState`: world simulation, movement, combat, rewards and progression.
- `GamePanel`: Swing input, game loop, renderer and vendor/inventory dialogs.
- `SaveStore`: versioned local persistence and migration from version 1 saves.

## Port status

This is a growing native port, not yet full feature parity. Remaining major work includes the full 5e/d20 combat pipeline, subclass features, spells and spell slots, active/passive skills, talent trees, quests, NPC dialogue, dungeons, bosses, crafting, market listings, companions, guild systems, online accounts and authoritative multiplayer services, plus the complete asset/animation/UI catalog.

The JavaScript browser edition remains intact as the reference implementation. New Java subsystems should be validated against its data and behavior before being marked complete.
