# Systems design: Lost Kingdom of Shadowbane Chronicles

This document describes how the game's systems work, how they connect, and where each one lives in the code. It reflects the repository as of November 2026. Older focused docs (for example [JOBS_AND_RACES.md](JOBS_AND_RACES.md), [LEVEL_1_TO_720.md](LEVEL_1_TO_720.md) and [ART_PACKS.md](ART_PACKS.md)) still apply; this one ties them together.

In game, **MAIN MENU > GUIDE** explains the same systems to players. Its pages read the live data tables, so numbers there always match the rules.

## 1. Design pillars

1. **A handheld RPG you can live in.** A 160×144 screen, four-shade art modes, short text pages, and menus that sit over the map, like a Pokémon game.
2. **D&D 5e at the core, MMO on top.** Attacks, saves, spell slots and class features follow the 5e SRD through class level 20. Levels 21–720, gear, guilds and world systems are MMO layers that never break bounded accuracy.
3. **Many small loops.** Every session should offer a quick goal: a bounty, a world quest, an amitoi coming home, a boonstone to defend, or a masterwork rank.
4. **Readable rules.** Every system has a pure, testable core exported on `globalThis.GBQ*`, and in-game text is generated from the same data.

## 2. Architecture

| Layer | Where | Notes |
|---|---|---|
| Rules data | `src/data_rules.js`, `src/jobs_data.js`, `src/data_world.js`, `src/aspects_data.js` | Classes, races, spells, buffs, regions, aspects. Plain objects. |
| Rules engine | `src/rules.js` (derive, levelling, monsters), `src/combat.js` (Battle) | `derive(c)` turns a character into final stats. Everything else adds to it through hooks. |
| Systems | one file per system in `src/` | Each wraps a global function or prototype and exports a pure core for tests. |
| UI | `src/engine.js` (draw primitives), `src/scenes_*.js`, `src/ui_dark.js`, `src/ui_mmo.js` | Themes swap colours and frames; layouts are data in `MMO_LAYOUT`. |
| Build | `tools/build.cjs` | Concatenates `src/` in `ORDER` into `dist/gbquest.html` with every asset embedded. |
| Server | `backend/server.cjs` | Accounts, cloud saves, realm chat, trading, admin, audit and debug logs. |

### Extension pattern

Systems never edit each other. A new system:

1. Defines pure rules at the top of its file and exports them on `globalThis.GBQ<Name>`.
2. Inside `if (typeof window !== 'undefined')`, wraps a hook. The common hooks are:
   - `armorSetBonus(c)`: add substats.
   - `Battle.prototype.setupEffects`, `applyDamage`, `abilities`, `finish`: combat.
   - `makeMonster` and `rollEncounter`: foes.
   - `MainMenu.prototype.items` and `update`: a menu entry.
   - `window.LOOP_HOOKS`: timers checked every 30 frames.
3. Joins `ORDER` in `tools/build.cjs` after the systems it depends on.
4. Adds tests in `tests/` that load the file into a `vm` context.

Top-level names share one global scope, so check for collisions before adding one:

```bash
grep -lE "^(const|let|var|function|class) NAME\b" src/*.js
```

## 3. Characters

### 3.1 Classes and jobs

There are 27 classes: the 16 original classes plus 11 jobs (RONIN, SHINOBI, BLADEDANCER, WYRMLANCER, CORSAIR, BEASTCALLER, PUPPETEER, DREADKNIGHT, VOIDHUNTER, SCALESAGE and STORMCALLER). Each has a hit die, a primary ability, two saves, armour and weapon proficiencies, an optional casting stat, class features by level, two subclasses and a role (tank, healer or dps).

- **Job change** (`src/jobs.js`) works in towns. Each job snapshots its own fields (`JOB_FIELDS`): level, XP, base attributes, subclass, talents, skills, arts, hotbar and loadouts. Gear is shared, and armour the new job can't wear goes to the bag.
- **Support job** unlocks at main level 18 and works at `min(own level, floor(main / 2))`. It grants `SUPPORT_TRAITS`, which add substats every 10 support levels up to caps, plus the new jobs' abilities up to the support level.
- **Job abilities** can each be used once per battle. They are data in `JOB_ABILITIES`; the effects are in `jobFns`.

### 3.2 Races

There are 15 races. Each has ability score increases and named traits. The six newest races also add passive substats through `raceBonus`, and two have racial abilities: WAR STOMP and GIFT OF LIGHT.

### 3.3 Levels 1–720

| Range | Gains |
|---|---|
| 1–20 | The 5e table: features, proficiency bonus, ability score increases at levels 4, 8, 12, 16 and 19, and a subclass at 3. Talent points at 5, 10, 15 and 20. |
| 21–720 | Ascension: attribute and substat points every level, mythic boons on a cadence. |
| 1–720 | Spell levels follow `SPELL_UNLOCK` = 1, 12, 46, 102, 181, 282, 406, 552, 720. `spellCasterLevel(L)` maps a character level onto the 5e caster level used for the slot tables. |

### 3.4 Necromancer army

`src/necro_army.js`. The army grows from 2 minions at level 1 to 9 at level 28, raised in the order W W M W W M W W G (six warriors, two mages, one golem). The Book of the Dead picks a variant per minion type, or SACRIFICE gives up that type for a stat bonus. RAISE DEAD can be used once per battle. Minions share the 12-member party limit.

## 4. Combat

`src/combat.js`.

- **Turn order:** d20 initiative decides who goes first.
- **Attacks and saves:**
  - Attacks roll d20 + bonus against armour class. A natural 20 is a critical hit.
  - Saves roll d20 + save bonus against a difficulty class (DC).
- **Damage:** `applyDamage` applies resistances, vulnerabilities, block, temporary HP, barriers and threat, then calls proc hooks.

Damage flows through several layers, in order:

1. Weapon or spell dice, plus the attribute modifier and substats such as `dmg` and the element bonuses.
2. Aspect multipliers (`src/d4_gear.js`): every `dmg` aspect whose condition holds adds its value, and the total is applied once.
3. Resistances and damage reduction on the target, including `hit/reduce` aspects (capped at 75%).
4. Procs after the hit: gear tier procs, aspect procs and kill effects, and reflection. Proc damage is flagged `opt.proc` so it never procs again.

Status effects are `BUFFS` (good and bad) plus `CONDITIONS`. Monster AI casts on every third turn, picks targets by threat, and is drawn toward golems that taunt.

**Monster modifiers:**

| Modifier | Where | Who gets it | Effect |
|---|---|---|---|
| Monster jobs | `src/jobs.js` | 35% of humanoid, giant, fey, fiend and undead foes | HEXER, GUARDIAN, ARCHER, BRUTE or MENDER |
| Night | `src/tnl_systems.js` | All foes at night | +15% HP, +10% damage, +25% XP and gold |
| Nocturnal elites | `src/tnl_systems.js` | 5% of night encounters | Tougher elite with better rewards |
| Rares | `src/world_quests.js` | One per zone per day | Named rare elite |
| Invaders | `src/world_quests.js` | One zone every 4 hours | Tougher invaders in that zone |
| Conquest bonus | `src/guild_war.js` | Foes in regions your guild holds | +10% XP and gold |

## 5. Gear

| System | File | Summary |
|---|---|---|
| Rarity | `src/items.js` | 9 tiers from POOR to DIVINE; more affixes and higher "plus" at higher tiers. |
| Affixes | `src/gen.js` | Substat lines, capped by `SUBSTATS[k].max`. |
| Greater affixes | `src/d4_gear.js` | 6% per affix to roll 1.5×; ancestral and better items always get one. |
| Aspects | `src/aspects_data.js`, `src/d4_gear.js` | 164 data-driven powers on legendary and better items; see §5.1. |
| Occultist | `src/d4_gear.js` | Extract to the codex, imprint, temper (2 lines), masterwork (12 ranks, +5% per rank, ranks 4/8/12 crit for +25%). |
| Gems | `src/gems.js`, `src/extras.js` | 9 types × 9 tiers, 1–4 sockets by item level, drops (2%, 10% elite, 35% boss), gem cutter (buy T1–3, cut 3→1). |
| Runes | `src/runes.js` | 9 families × 9 tiers, separate sockets, Rune Forge. |
| Durability | `src/durability.js` | Wear per battle and on death, repair, crafting quality. |
| Heirlooms | `src/heirlooms.js` | Account-wide set usable from level 1. |
| Trinkets | `src/trinkets.js` | Two slots with buffs at the start of battle. |
| Weapon mastery | `src/tnl_systems.js` | 9 weapon families, levels 1–30, ranks ADEPT, EXPERT and MASTER. |

### 5.1 Aspect families

Every aspect is a spec `{ name, kind, cat, lo, hi, e }`. The engine knows six effect types:

| `e.t` | When it fires | What it does |
|---|---|---|
| `dmg` | Your outgoing hit, if `when` holds | +v% damage. `when` can be: lowhp, fullhp, elite, crowd, crit, first, selfhigh, selflow, phys, spell, `el:<type>`, `cond:<debuff>`, `buff:<buff>`. |
| `proc` | Each hit, at chance `p` (or v% if `pv`) | Inflict a debuff, add bonus elemental damage, chain to another foe, heal, barrier, or buff yourself. |
| `kill` | When your hit kills | Explode for v% of the foe's max HP, buff for v rounds, heal, or barrier. |
| `start` | Battle setup | Buff for v rounds, or a barrier of v% max HP. |
| `hit` | When you are struck | Reduce damage (always, lowhp, elite, barrier, `el:<type>`), reflect v%, or curse the attacker. |
| `stat` | Always | Substats scaled by v. |

The aspect families are:

| Family | Count | Examples |
|---|---|---|
| Original aspects | 16 | EXECUTIONER, STORMSHARD, CORPSEBURST, BULWARK |
| Per element (10 elements) | 5 each | BRAND, FANG, BURST, ARC, WARD |
| Per debuff (12 debuffs) | 2 each | an inflict aspect (for example HEMORRHAGE) and an exploit aspect (HEMORRHAGE HUNTER) |
| Debuff SHELLs | 6 | curse the attacker |
| Per buff (9 buffs) | 4 each | REAPER (on kill), HERALD (battle start), SURGE (on hit), FURY (while active) |
| Fight conditions | 7 | |
| Defence | 9 | |
| Passive stats | 16 | |

To add an aspect, add one `add(...)` line in `src/aspects_data.js`. Its text, the codex browser, the guide and the effects all follow automatically.

## 6. World

- **Regions and biomes** (`src/data_world.js`): a capital, wild regions with sub-zones, 9 biomes with their own monster families and weather.
- **Day and night** (`src/tnl_systems.js`): the game clock runs one game hour per real minute. Night (21:00–5:00) changes foes and darkens the screen, and the HUD shows a sun or moon.
- **NPC AI** (`src/npc_ai.js`):
  - Each NPC has a personality from its name, a home tile and a leash: 1 tile for service NPCs, 3–4 for townsfolk.
  - A utility AI scores eight actions (work, wander, socialize, greet, shelter, sleep, return, idle) by time of day, rain, how close the hero is and how far the NPC is from home.
  - NPCs remember the hero (`G.npcMem`).
- **Morphs:** WOLF FORM is a pseudo-mount (`MOUNT_BY_ID.morph_wolf`). SWIM FORM makes water tiles passable in `Field.blocked`.
- **Instances** (`src/rooms.js`):
  - Grid layouts: entrance, main path, side rooms and the boss arena, with guardian seals on the boss door.
  - `tidyMap` cleans each floor: doors only in real doorways, wall decor only on visible wall faces, and stairs always reachable.
  - Stepping onto stairs prompts at once, and `safeSpot` keeps arrivals out of walls and water.

## 7. Content loops

| Loop | Cadence | Reward |
|---|---|---|
| Bounties, login rewards, season pass | Daily and weekly | Gold, XP, season XP |
| World quests, rares, invasions | Daily / every 4 hours | Gold, XP, items, epic drop |
| Keystones | Repeatable | Timed dungeon runs with affixes, vault |
| Amitoi expeditions | 15 min, 1 h, 4 h | Gold, materials, gear, pet levels |
| Conquest | 30 min counterattacks, 2 h sieges | Region bonus, tax, castle buff and title |
| The Spire | 100 floors | Floor records, boss loot |
| Weapon mastery, masterwork, codex | Long term | Permanent power |

## 8. Guilds and conquest

`src/guild_prog.js`, `src/guild_war.js`.

- **Guilds:** guilds level 1–25 and unlock perks along the way. They also get a shared bank and weekly guild quests.
- **Boonstones:** one per wild region, starting with an AI guild (`startingOwner`).
  - A challenge is three waves: two of defenders, then the Stone Warden.
  - Taxes build up for up to 7 days.
- **Castle siege:** possible once your guild holds 3 stones. It has three stages: GATE, COURTYARD and CASTLE LORD.
- **AI counterattacks:** they arrive as `G.conquest.threat` with a 20-minute defence window.
- **Moving to real players:** these are single-player stand-ins. For real guild-versus-guild play, `G.conquest` ownership would move to the server, and `challengeWaves` would stay as the PvE fallback.

## 9. Interface

- **Themes:**

| Theme | Look |
|---|---|
| 8-BIT MMO (default) | Handheld panels with a rounded double border |
| CRIMSON | MU style: black stone, red frames, gold trim |
| CLASSIC | Original look |
| SANCTUM / DIABLO IV | Dark bronze |

- **8-BIT MMO and CRIMSON layout** (`MMO_LAYOUT`):
  - Unit frame and party frames at the top left.
  - Minimap at the top right (click to zoom, double-click for the world map).
  - Hotbar between the HP and MP orbs at the bottom.
  - Toasts and banners in the middle band.
  - The START menu opens over the map, with a hero card and a help line.
  - WoW-style title bars on full-screen pages.
- **Art modes:** PIXEL PACKS (default), NES and CLASSIC. Switching swaps sprites by name (`src/pack_art.js`).
- **Text:** the 6×9 font is ASCII only. `text()` maps common Unicode characters to look-alikes. A row highlighted in shade 1 forces shade-1 text on top of it to shade 3, so selected rows stay readable.
- **Floating text:** off by default. Screen chat, bubbles and name tags are toggles in CHAT SETTINGS.

## 10. Testing

- `npm test` runs `node:test` over `tests/`. Each system's pure core is loaded in a `vm` context and checked: tables, formulas, edge cases and caps.
- In-game checks run in headless Chromium against `dist/gbquest.html`: battles, menus, maps and screenshots.

## 11. Open questions and next steps

1. **Balance pass for 1–720:** aspect values, mastery steps, night multipliers and conquest difficulty need playtesting together, because they stack.
2. **Server authority:** conquest ownership, trading and aspect rolls should move server-side before a public realm.
3. **Information density:** the guide and tooltips are text-only. Item comparison and an aspect tooltip in battle would help.
4. **Content volume:** more aspect families (for example per class or per weapon family), unique items that carry two aspects, and seasonal aspects.
5. **Accessibility:** remappable gamepads are done (KEY BINDINGS). Text scaling is still limited by the fixed screen size.
