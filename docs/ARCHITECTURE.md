# Architecture

Lost Kingdom of Shadowbane Chronicles is plain JavaScript with no framework, no bundler and no runtime dependencies. `tools/build.py` concatenates the modules in a fixed order into one HTML file that runs anywhere. Diagrams are in [UML.md](UML.md).

Repository boundaries: `client/` owns the browser shell and boot entry, `src/` owns game runtime modules, `backend/` owns the MMORPG realm service, `store/` owns catalog and purchase policy, and `admin/` owns the restricted control-plane page. `server/server.cjs` remains a compatibility launcher; `server.js` is a separate local native-rules HTTP bridge.

## Module map

| # | Module | Lines of responsibility |
|---|---|---|
| 1 | `src/data_rules.js` | static d20 data: abilities, skills, XP table, schools, conditions, species, backgrounds, feats, slot tables, classes, weapons, armour, wondrous items, rarities, spells, unique monsters |
| 2 | `src/data_world.js` | world data: 9 attributes, substats, affixes, levels 1–720, ascension, buffs, difficulty, play modes, regions, biomes, families, story (prologue, acts, chapters, side quests), factions, items, recipes, achievements, expansions, zone split, map pins |
| 3 | `src/gen.js` | seeded RNG and dice; bestiary (400) and boss (350) generators; zone/city/harbor/instance generators; auto-tiling; side quests; loot |
| 4 | `src/engine.js` | framebuffer, palettes, sprite pipeline, text and UI kit, input, chip audio (SFX bank + procedural music), physics and particles, scene stack, transitions, main loop, `present()` |
| 5 | `src/audio64.js` | 64-bit audio engine: master bus, reverb, echo, synth voice, instruments, drum kit, arrangements, compositions, SFX upgrades |
| 6 | `src/video64.js` | 64-bit video: Scale4x, lighting, bloom, vignette; engine systems Events, Tween, Cam, Clock, Profiler |
| 7 | `src/rules.js` | character derivation (`derive`), checks, rests, equipment, XP, monster stat blocks (`makeMonster`), adventurers |
| 8 | `src/combat.js` | the `Battle` scene: initiative, turns, AI, spells, weapons, damage, conditions, legendary actions, remote actions |
| 9 | `src/systems.js` | game state `G`, saves, inventory, party, encounters, quests, achievements, professions, realm simulation, `NET` multiplayer |
| 10 | `src/art.js` | NES-style art mapping for monsters, items, spells, portraits, battle backdrops |
| 11 | `src/scenes_world.js` | Boot, Title, creation, `Field` (overworld), services, instances, loot rolls, fishing, `WorldMap`, level-up, remote battle view, credits |
| 12 | `src/scenes_menu.js` | `ListScene` base and every menu: main menu, bag, equipment, sheet, spellbook, growth, quests, crafting, achievements, bestiary, reputation, social, auction, bank, settings, sound test |
| 13 | `client/main.js` | boot, chat form, hot snapshot, `NET.init`, autosave, debug hooks `window.GBQ`, embedded Atlas overlay |
| 14 | `src/debug.js` | debug panel (F9), error recorder, god mode, collision overlay, self-check |
| â€” | `backend/server.cjs` | MMORPG account, realm, persistence, multiplayer and admin API |
| â€” | `store/catalog.cjs` | server-owned store catalog and checkout policy |
| â€” | `admin/controlplane.html` | restricted account and realm operations UI |
| — | `client/shell.html` | handheld device chrome, touch controls, chat panel, build strip |
| — | `client/fullscreen.html` | full-screen window overrides and toolbar |
| — | `atlas/atlas_template.html` | the interactive Atlas of Valendria (SVG) |

Load order matters because modules share one global scope. Data comes first, then generators, then the engine, then the 64-bit layers (which only hook into the engine at call time), then rules and scenes, and `main` last.

## Runtime model

- **Fixed timestep.** `loop()` runs `tick()` at 60 Hz, up to 4 catch-up steps, and calls `render()` once per animation frame.
- **Scene stack.** `scenes[]`: only the top scene updates. Rendering starts at the highest opaque scene and draws everything above it, so dialogs and menus overlay the field. `push`, `pop`, `removeScene`, `reset` and `topScene` manage it.
- **Framebuffer.** All drawing goes to an off-screen 160×144 canvas (`cv`/`ctx`). `present()` copies it to the visible `#lcd` canvas, either 1:1 (Game Boy mode) or through `present64()`: Scale4x, then lighting, bloom and vignette at 640×576.
- **Input.** Keyboard, d-pad, touch buttons and swap-A/B all feed `pressed`/`held`. `P(b)` means pressed this tick; `nav(b)` adds key repeat. A typing guard blocks game keys while the chat box has focus.
- **Audio.** `SFX.name()` goes through a proxy. In chip mode it plays `play(SFX_BANK[name])`; in 64-bit mode it plays `sfx64(name)`. `Music.play(id)` picks a track, and `Music.tick()` schedules about 250 ms ahead on the WebAudio clock. Every SFX call also emits an `Events` `sfx` event, which the camera uses for impact zoom pulses.
- **State.** All persistent player state lives in one object `G`. Saves write `gbq2_slot1..3` to `localStorage`, using `slimChar`/`unslimChar` for companions. Autosave runs on zone changes and on a timer.
- **Determinism.** Every generator is seeded from stable strings (`RNG('zone-' + id)`), so the 90 zones, 400 creatures, 350 bosses, side quests and music are identical on every machine and need no data files. The same property lets the Atlas export the world by running the generators.

## Data flow: from data to a fight

```
REGIONS ─split─▶ ZONES ─buildZone()─▶ {rows, gfx, exits, poi, bosses}
                                     │
FAMILIES × VARIANTS ─▶ BESTIARY ─spawnTable(zone)─▶ rollEncounter() ─▶ makeMonster(src, L, diff)
                                                                          │
newCharacter() ─▶ G ─buildParty()─▶ partyMember() ──────────────▶ new Battle(party, foes)
```

## Rendering pipeline (sprites)

`spr(name, w, h, opts)` resolves an asset by palette mode:

1. **DMG** (green, pocket, sunset, amber, ocean): luminance quantiles mapped to 4 shades with ordered dithering. Pixel-art families (`gt_ gd_ go_ gh_ gm_`) use fixed thresholds and no dither.
2. **GBC**: a per-sprite median-cut to 4 colours, snapped to RGB555, like a real GBC object palette.
3. **Full colour**: the original pixels. This is also what 64-bit video mode uses.

Results are cached per (name, size, mode, flip). `clearCaches()` empties the cache when the palette changes. See [GRAPHICS](GRAPHICS.md).

## Builds

| Output | What |
|---|---|
| `index.html` | dev build: loads `src/*.js` and `assets/*.png` (serve the folder over http) |
| `dist/gbquest.html` | single self-contained file (all assets as data URIs, atlas embedded) |
| `dist/gbquest-fullscreen.html` | same game, full-screen window layout |
| `dist/atlas.html` | standalone interactive atlas |
| `assets_hd64/` | 64-bit sprite atlases for the desktop port and modding |

See [BUILD](BUILD.md).

## Extension points

- **New zone or region:** add it to `REGIONS` (and `REGION_PINS` for the map). `splitRegions` creates the sub-zones, and roads are carved automatically from grid neighbours.
- **New creature family:** add it to `FAMILIES` with subtypes `[name, sprite, damage type, role]`. Variants and elites are generated.
- **New boss mechanic:** add a key to the boss `mechs` and handle it in `Battle.monsterTurn`/`legendaryAction`.
- **New SFX:** add an entry to `SFX_BANK` (chip). It is upgraded automatically in 64-bit mode, or you can add a layered recipe to `SFX64`.
- **New music track:** add it to `TRACKS` (bpm, root, scale, progression, drum pattern) and to `ARR64` (instruments).
- **New light source:** call `Light64.add(x, y, radius, 'r,g,b', alpha)` from a scene's `draw()`.
- **Engine events:** `Events.on('sfx', fn)` today. Add `Events.emit(...)` at any other moment you need to observe.
