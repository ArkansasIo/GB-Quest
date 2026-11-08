# UML and design diagrams

All diagrams are Mermaid, so GitHub renders them inline. The names match the source.

## 1. Component diagram

```mermaid
flowchart TB
  subgraph Data["Data layer"]
    DR[data_rules.js<br/>classes, spells, gear]
    DW[data_world.js<br/>zones, story, bosses cfg]
  end
  subgraph Gen["Generators"]
    GEN[gen.js<br/>RNG, dice, bestiary, bosses,<br/>zones, instances, loot]
  end
  subgraph Engine["Engine"]
    ENG[engine.js<br/>framebuffer, sprites, text, input,<br/>chip audio, physics, scenes, loop]
    A64[audio64.js<br/>64-bit synth, reverb, arrangements]
    V64[video64.js<br/>Scale4x, lights, bloom,<br/>Events, Tween, Cam, Clock, Profiler]
  end
  subgraph Game["Game logic"]
    RUL[rules.js<br/>derive, checks, makeMonster]
    COM[combat.js<br/>Battle]
    SYS[systems.js<br/>G, saves, quests, NET]
    ART[art.js<br/>NES art mapping]
  end
  subgraph Scenes["Scenes"]
    SW[scenes_world.js<br/>Title, Field, WorldMap, services]
    SM[scenes_menu.js<br/>ListScene menus, Settings]
  end
  MAIN[main.js<br/>boot, autosave, Atlas overlay]
  ATLAS[(atlas.html<br/>interactive map)]
  ROOM[(Artifact room<br/>presence + topics)]
  DB[(Artifact db<br/>heroes)]
  LS[(localStorage<br/>3 save slots)]

  DR --> GEN
  DW --> GEN
  GEN --> RUL
  ENG --> A64
  ENG --> V64
  RUL --> COM
  COM --> SYS
  SYS --> SW
  SYS --> SM
  ART --> RUL
  SW --> MAIN
  SM --> MAIN
  MAIN -.postMessage.-> ATLAS
  SYS <--> ROOM
  SYS <--> DB
  SYS <--> LS
```

## 2. Class diagram: scenes

```mermaid
classDiagram
  class Scene {
    <<interface>>
    +bool opaque
    +update()
    +draw()
    +resume()
  }
  class ListScene {
    +int i
    +int top
    +int rows
    +items() string[]
    +navList()
    +scrollbar(x,y,h)
  }
  Scene <|.. ListScene
  ListScene <|-- MainMenu
  ListScene <|-- BagScene
  ListScene <|-- EquipScene
  ListScene <|-- Spellbook
  ListScene <|-- GrowthScene
  ListScene <|-- QuestLog
  ListScene <|-- CraftScene
  ListScene <|-- AchievementScene
  ListScene <|-- BestiaryScene
  ListScene <|-- SocialScene
  ListScene <|-- AuctionHouse
  ListScene <|-- BankScene
  ListScene <|-- SettingsScene
  ListScene <|-- SoundTest
  Scene <|.. Boot
  Scene <|.. Title
  Scene <|.. SlotPicker
  Scene <|.. Prologue
  Scene <|.. CharCreate
  Scene <|.. Field
  Scene <|.. WorldMap
  Scene <|.. Battle
  Scene <|.. Dialog
  Scene <|.. Choice
  Scene <|.. Fade
  Scene <|.. Flash
  Scene <|.. CharSheet
  Scene <|.. RepScene
  Scene <|.. LootRoll
  Scene <|.. Fishing
  Scene <|.. LevelUpScene
  Scene <|.. RemoteBattleView
  Scene <|.. Credits
  Scene <|.. SideQuestBoard
  Scene <|.. WaypointMenu

  class Field {
    +map m
    +zone zone
    +int[] cam
    +reload()
    +entities()
    +blocked(x,y)
    +interact()
    +onStep()
    +discover()
  }
  class WorldMap {
    +int zoom
    +zone sel
    +move(dx,dy)
    +roads()
    +drawRoads(img,ox,oy,scale)
    +pinMarks(img,ox,oy,scale)
    +icons(z)
  }
  class Battle {
    +Member[] party
    +Member[] foes
    +Step[] steps
    +rollInit()
    +startTurn()
    +deathSave(u)
    +weaponAttack(u,t)
    +castSpell(u,sp,t)
    +applyDamage(t,n,type)
    +monsterTurn(u)
    +legendaryAction(u)
    +aiTurn(u)
    +remoteAction(a)
    +win() lose() finish()
  }
```

## 3. Class diagram: domain model

```mermaid
classDiagram
  class GameState {
    name, cls, species, bg
    level, xp, hp, slots
    abil, eq, bag, inv, gold
    map, x, y, inst
    visited, waypoints, areas
    quests, chapter, rep, achievements
    party companions
    difficulty, mode
  }
  class Character {
    +newCharacter(o)
    +derive(c) Derived
    +classLevel(c)
    +profBonus(c)
    +skillCheck(c,skill,dc)
    +shortRest(c) longRest(c)
    +equipItem(c,it)
    +gainXP(c,n)
  }
  class Derived {
    ac, hpMax, init, speed
    atk, dmg, spellDC, spellAtk
    saves, skills, passive
    crit, haste, lifesteal
  }
  class Monster {
    name, lvl, cr, hp, ac
    attacks, dt, res
    mechs, legendary
    spr
    +makeMonster(src,L,diff,extra)
  }
  class Zone {
    id, name, region, biome, sub
    lvl, town, last
  }
  class ZoneMap {
    rows, tiles, gfx
    exits, poi, bosses, areas, hub
    +buildZone(z)
  }
  class Item {
    uid, base, slot, rarity, plus
    affixes map
    +makeItem(base,lvl,rarity)
  }
  class Boss {
    id, cat, where, lvl, mechs, title, act
  }
  GameState "1" o-- "1..4" Character : hero + companions
  Character ..> Derived : derive()
  Character "1" o-- "0..*" Item : bag / eq
  Zone "1" --> "1" ZoneMap : buildZoneCached
  ZoneMap "1" o-- "0..*" Boss
  Zone ..> Monster : spawnTable / rollEncounter
  GameState --> Zone : map
```

## 4. State machine: scene flow

```mermaid
stateDiagram-v2
  [*] --> Boot
  Boot --> Title : logo done / A
  Title --> SlotPicker : NEW / LOAD
  Title --> Field : CONTINUE
  SlotPicker --> Prologue : new slot
  SlotPicker --> Field : load
  Prologue --> CharCreate
  CharCreate --> Field : enterWorld()
  Field --> Battle : encounter / boss / pull
  Battle --> Field : win / flee
  Battle --> Field : wipe (ghost)
  Field --> WorldMap : SELECT
  WorldMap --> Field : B / travel
  WorldMap --> Atlas : M
  Atlas --> WorldMap : SHOW ON GAME MAP
  Field --> MainMenu : START
  MainMenu --> Field : B
  Field --> Instance : dungeon / raid / trial / tower
  Instance --> Field : leave / clear
  Field --> Credits : final chapter
```

## 5. State machine: a battle turn

```mermaid
stateDiagram-v2
  [*] --> Initiative
  Initiative --> StartTurn
  StartTurn --> DeathSave : unit at 0 HP
  DeathSave --> NextTurn
  StartTurn --> Decay : tick conditions / buffs
  Decay --> PlayerMenu : player-controlled
  Decay --> AITurn : companion / auto-battle
  Decay --> MonsterTurn : foe
  Decay --> RemoteWait : guest's unit (multiplayer)
  PlayerMenu --> Resolve : FIGHT / SPELL / ITEM / ABILITY / FLEE
  AITurn --> Resolve
  MonsterTurn --> Resolve
  RemoteWait --> Resolve : srv_act
  Resolve --> Legendary : boss has legendary actions
  Legendary --> CheckEnd
  Resolve --> CheckEnd
  CheckEnd --> Win : all foes down
  CheckEnd --> Lose : party down
  CheckEnd --> NextTurn
  NextTurn --> StartTurn
  Win --> [*]
  Lose --> [*]
```

## 6. Sequence: weapon attack

```mermaid
sequenceDiagram
  participant P as Player
  participant B as Battle
  participant R as rules.js
  participant E as engine (SFX/FX)
  P->>B: FIGHT → target
  B->>R: derive(attacker)
  B->>B: advState(attacker, target)
  B->>R: d20() (+ advantage)
  alt natural 20 or within crit range
    B->>R: roll(dmg, crit=true)
    B->>E: SFX.crit(), shake, Cam.pulse (64-bit)
  else total >= target AC
    B->>R: roll(dmg)
    B->>E: SFX.hit_slash()
  else miss
    B->>E: SFX.miss()
  end
  B->>B: applyDamage(target, n, type) → resist / vuln / conc check
  B->>B: checkEnd()
```

## 7. Sequence: multiplayer host battle

```mermaid
sequenceDiagram
  participant H as Host (runs Battle)
  participant Room as room (topics)
  participant G as Guest
  G->>Room: srv_join {hero}
  Room->>H: srv_join
  H->>Room: srv_char ack
  Note over H: encounter starts with guest's hero in party
  H->>Room: srv_battle {snapshot}
  Room->>G: srv_battle → RemoteBattleView
  loop each guest-controlled turn
    H->>Room: srv_turn {to: guest, foes, options}
    Room->>G: srv_turn
    G->>Room: srv_act {action, target}
    Room->>H: srv_act → Battle.remoteAction()
    H->>Room: srv_battle {snapshot}
  end
  H->>Room: srv_end {result, loot}
  Room->>G: srv_end
```

## 8. Sequence: save and load

```mermaid
sequenceDiagram
  participant S as Scene
  participant Sys as systems.js
  participant LS as localStorage
  S->>Sys: saveGame()
  Sys->>Sys: clean(G), slimChar(companions)
  Sys->>LS: set gbq2_slotN
  Note over S,LS: later
  S->>Sys: loadSlot(i)
  Sys->>LS: get gbq2_slotN
  Sys->>Sys: unslimChar, fixupState(), ITEM_UID
  Sys-->>S: G ready → enterWorld()
```

## 9. Sequence: 64-bit frame

```mermaid
sequenceDiagram
  participant L as loop()
  participant Sc as scenes
  participant FB as 160x144 framebuffer
  participant V as present64()
  participant LCD as #lcd 640x576
  L->>Sc: tick() ×n (60 Hz)
  L->>Sc: render(): draw opaque..top
  Sc->>FB: tiles, sprites, UI
  Sc->>V: Light64.fromField() (lights for this frame)
  L->>V: present()
  V->>V: getImageData → scale2x → scale2x
  V->>LCD: draw scaled + grade
  V->>LCD: light map (ambient by Clock, cut-outs per light)
  V->>LCD: additive glow, bloom (screen), vignette
  V->>LCD: Profiler overlay (F3)
```

## 10. Activity: world generation

```mermaid
flowchart TD
  A[REGIONS 28] --> B[splitRegions → 90 ZONES with sub-biome + level band]
  B --> C[buildZone z]
  C --> D[noiseGrid → terrain by biome]
  D --> E[carve roads between exits EXIT_POS]
  E --> F[place hub, POIs: waypoint, dungeon, raid]
  F --> G[place bosses from BOSSES where=z]
  G --> H[zoneGfx: auto-tile roads N1 E2 S4 W8, shores, animated water]
  H --> I[areas, nodes, herbs]
  I --> J[(ZONE_CACHE)]
  J --> K[Field draws] & L[WorldMap roads] & M[Atlas export]
```

## 11. Deployment

```mermaid
flowchart LR
  Dev[src/ + assets/ + atlas/] -->|tools/build.py| Dist[dist/gbquest.html<br/>dist/gbquest-fullscreen.html<br/>dist/atlas.html]
  Dist -->|publish| Artifact[claude.ai artifact<br/>room + db capabilities]
  Dist -->|git push| GH[GitHub ArkansasIo/GB-Quest]
  GH -->|CI| Tests[node --test]
  GH -->|CI| Desk[desktop/ CMake C++23]
  Dev -->|tools/gen_hd64.py| HD[assets_hd64/ atlases]
  HD --> Desk
```
