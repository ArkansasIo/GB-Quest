# Debugging

## In-game debug panel

Open it with **F9**, with **SETTINGS > DEBUG PANEL**, or by adding `#debug` to the page link. The panel docks beside the screen and can be dragged by its header.

| Section | Controls |
|---|---|
| State | live scene stack, hero, level and XP, HP and AC, gold, zone id, tile, instance and floor, party, ghost flag, video/audio/palette/tiles/art modes, game time, frame counter, FPS |
| Run | **pause**, **step 1 / step 10** frames, game speed 0.25×–4× |
| Hero | **god mode** (HP locked to max, party kept above half), heal all, +1/+10/+100 levels, +10K gold, +5 items (uncommon to legendary), +potions, un-ghost |
| World | warp to any of the 90 zones, reveal map, all waypoints, no encounters, **collision view** (red = blocked, blue = zone exits, green = you), open the atlas, time-of-day override (0–24 h; drives 64-bit lighting) |
| Battle | start an encounter, fight the zone boss, instant win, instant lose, toggle auto-battle |
| Modes | 64-bit video, 64-bit audio, profiler overlay (also F3), next palette |
| Data | save now, copy the full state JSON (also printed to the console), **self-check** (zone exits, boss levels, bestiary entries, hero stats), clear log |
| Log | every uncaught error, unhandled promise rejection, `console.error` and `console.warn`, recorded even while the panel is closed |

## Automated sweep

```sh
npm run sweep            # or: python3 tests/sweep.py [dist/gbquest.html]
```

The sweep plays the real build in headless Chromium in about 15–20 seconds. It covers:

- the boot, title, prologue and character creation screens
- all 12 classes at levels 1, 5, 20 and 120 in auto-battles
- all 90 zones (travelling and walking each one), plus the world map at every zoom
- every main-menu screen and all 16 town services, with input
- every dungeon, raid and trial, and tower floors 1/5/10/50/100
- all 56 palette × video × tiles × art combinations
- save/load in all 3 slots, and both audio engines (every SFX and track)
- the settings screen, the sound test, the atlas, a party wipe into ghost state
- 6 "monkey" runs of 6,000 random button presses each

After every step it checks these invariants:

- no `NaN`, `Infinity` or `undefined` anywhere in the game state
- derived stats are finite
- HP stays between 0 and the maximum
- no on-screen text contains `undefined`, `NaN`, `null` or `[object`

The process exits non-zero on any failure, error or bad text.

## Debug hooks

`window.GBQ` exposes the main entry points for scripts: `newGame`, `enterWorld`, `startBattle`, `rollEncounter`, `travelTo`, `enterInstance`, `saveGame`, `loadSlot`, `openAtlas`, `tick`, `render` and more. Because the game uses one global scope, `page.evaluate` in Playwright can also reach `G`, `scenes`, `Battle`, `Field` and every other top-level name directly.

## Bugs fixed by the 2.1.1 pass

| Bug | Cause | Fix |
|---|---|---|
| Menus re-opened while holding a direction into a door or NPC | the bump re-fired every 20 frames while held | fires once per contact |
| Touch pad off-screen in the standalone full-screen file on phones | the built files had no viewport meta | the shell now declares charset and viewport |
| Instance monsters with `NaN` level, HP and AC when an instance definition lacked `lvl` | `def.lvl + floor * perFloor` | falls back to `baseLvl`, then 1 |
| 64-bit video at about 13 ms per frame | a CSS filter and a blur on full-size canvases, plus an extra full-size copy | grade and bright-pass done in JS at 160×144, frame written straight to the LCD, vignette cached: about 4 ms |
