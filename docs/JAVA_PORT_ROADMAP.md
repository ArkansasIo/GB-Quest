# GB-Quest Native Java Port Roadmap

## Goal

Deliver a native Java desktop edition of Lost Kingdom of Shadowbane Chronicles while keeping the browser edition intact. Java is a separate runtime implementation; the existing JavaScript game remains the behavioral reference until each subsystem reaches parity.

## Current implementation

The initial playable Java slice provides a native Swing/AWT window, a tile-based world, camera tracking, keyboard movement, collision, enemy pursuit, contact damage, directional melee, enemy defeat, XP/level progression, gold and potion pickups, HUD rendering, and versioned local saves.

Build: `mvn -B -f java-launcher/pom.xml clean package`

Run from repository root: `java -jar java-launcher/target/gbquest-java-0.4.0.jar`

## Porting rules

1. Preserve existing browser behavior; do not delete or rewrite the JavaScript implementation as a shortcut.
2. Port rules and data before presentation code. Keep formulas deterministic and cover them with tests.
3. Use shared JSON data catalogs where possible instead of manually duplicating item, class, creature, and world definitions.
4. Keep simulation independent from rendering and input so headless tests can validate combat and progression.
5. Treat online play as a separate milestone: server-authoritative combat, account/session security, persistence migrations, and protocol compatibility must be implemented before claiming multiplayer parity.
6. Load HD64 and Citadel atlases through explicit atlas/index readers and validate every sprite rectangle before rendering.

## Feature parity workstreams

- **Foundation:** fixed-timestep simulation, scene/state stack, settings, input mapping, audio, asset catalog and save migrations.
- **Character rules:** races/species, all classes/subclasses, nine attributes, derived stats, skills, saves, resources, leveling through 720, talents, ascension and boons.
- **Items:** inventory, equipment slots, rarity, affixes, sockets, gems, runes, durability, crafting materials, vendors, market and loot generation.
- **Combat:** d20 checks, initiative, actions/bonus actions/reactions, spells and slots, conditions, buffs/debuffs, boss phases, companions, threat and rewards.
- **World:** zones, collision maps, NPCs, dialogue, quests, factions, dungeons, raids, towers, secrets, weather and world events.
- **Social/MMO:** profiles, chat, parties, guilds, guild wars, rankings, matchmaking, backend API, authoritative server and reconnect handling.
- **Presentation:** HD64/Citadel sprite atlases, animation states, portraits, UI menus, accessibility, audio and display settings.

## Release gates

A subsystem is not considered ported until:
- Java behavior is compared against representative JavaScript reference cases.
- Unit tests cover normal, boundary, and invalid inputs.
- Save/load migration is tested.
- Assets and UI render without missing references.
- CI builds the executable JAR on Java 17.
- A release note clearly identifies any remaining differences.

The current code is an initial playable foundation, not a completed feature-parity port.
