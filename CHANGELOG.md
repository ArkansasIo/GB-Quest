# Changelog

All notable changes to Lost Kingdom of Shadowbane Chronicles. Versions follow `MAJOR.MINOR.PATCH`; builds are dated `BYYYY.MM.DD`.

## 2.1.1 — B2026.11.01

### Added
- **Debug panel** (F9, SETTINGS > DEBUG PANEL, or `#debug`), with:
  - live state, pause and frame stepping, game speed
  - god mode, levels, gold, loot, warp, reveal map, waypoints
  - no encounters, collision view, time of day
  - battle win/lose, mode toggles, state copy, self-check, error log
- **Automated sweep** (`tests/sweep.py`, `npm run sweep`): plays every class, zone, menu, service, instance, render mode, save slot and audio engine, plus random-input monkey runs, with state and screen-text invariants. See [docs/DEBUGGING.md](docs/DEBUGGING.md).

### Fixed
- Holding a direction into a door or NPC kept re-opening its menu.
- The standalone HTML files had no viewport meta, so on phones the full-screen build's touch pad sat off-screen.
- Instances whose definition had no `lvl` spawned `NaN`-stat monsters.

### Performance
- 64-bit video frame time is down from about 13 ms to about 4 ms.

## 2.1.0 — B2026.11.01

### Added
- **Atlas of Valendria** (`dist/atlas.html`): an interactive SVG map over the painted world map, with:
  - 90 zones, 101 roads and 42 sea lanes
  - dungeon, raid, boss and waypoint icons
  - search, layer toggles and a level-band filter
  - details for every zone: roads, instances, bosses and mechanics, side quests, herbs, story chapters
  - a route planner
  - phone layout
- The atlas is **embedded in the game**: the ATLAS button or the M key opens it, with a "you are here" marker, visited and unknown zones, and SHOW ON GAME MAP.
- **Roads and sea lanes on the in-game world map**: gold once both ends are visited.
- **Full-screen window build** (`dist/gbquest-fullscreen.html`): aspect-locked LCD, 1:1 pixel scaling, full-screen toggle (F), overlay touch pad, overlay chat (C).
- **64-bit audio engine** (`src/audio64.js`):
  - stereo, reverb, echo and compressor
  - 13 synthesized instruments and a 7-piece drum kit
  - all 24 tracks re-arranged with A/B sections
  - every SFX upgraded, 36 hand-layered versions, 8 new 64-bit-only sounds
- **64-bit video mode** (`src/video64.js`): Scale4x smoothing at 640×576, full colour, a day/night cycle, dynamic lights, bloom, vignette and camera pulses.
- **Engine systems**: `Events` bus, `Tween` with easing, `Cam`, game `Clock`, `Profiler` overlay (F3).
- **64-bit asset atlases** (`assets_hd64/`, `tools/gen_hd64.py`): 2,236 sprites at 4× with smoothing, light ramp, rim light and outline.
- **Documentation**:
  - GDD, architecture, UML (11 diagrams), audio, graphics, multiplayer, build and controls docs
  - generated story, character, content and world references (`tools/gen_docs.cjs`)
  - CONTRIBUTING and this changelog

### Changed
- The framebuffer is now off-screen, and `present()` shows it on the LCD, which makes post-processing possible.
- The settings list scrolls. Left and right change values without moving the cursor.
- The sound test shows the active engine and switches it with START.

## 2.0.0 — B2026.11.01
- 5e-style rules with original lore; 9 species, 12 classes and 24 subclasses; levels 1–720
- 90 zones, 400 creatures, 350 bosses, 22 dungeons, 9 raids, 6 trials, a 100-floor tower, 5 expansions, 9 difficulty tiers
- 12 acts and 50 chapters, side quests, professions, auction house, guilds, reputation, arena, achievements
- 1-, 4- and 12-player modes, live presence and chat, built-in host server, realm leaderboard
- GBC colour, 103 SFX and 24 tracks, Game Boy pixel tiles, the VALENDRIA world map, the NES-style art pack

## 1.0.0
- The original single-file Game Boy RPG (kept in `legacy/`).
