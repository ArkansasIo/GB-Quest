# GB-Quest on Summer Engine (Godot 4) — prototype port

`summer-prototype/` is a separate Godot 4 project that plays GB-Quest at **640×576 (the 160×144 screen at 4×)**. It reads all of its game data and images from the browser game, so the browser game stays the production baseline and the single source of truth (see `CLAUDE.md`). Nothing in `src/`, `dist/`, the Electron app or the server was changed by the port.

## Set up

From the repository root (Windows: use `npm.cmd` / `npx.cmd` in PowerShell, or Command Prompt):

```
npm install
node tools/build.cjs          # builds dist/gbquest.html
node tools/export_godot.cjs   # exports data + art into summer-prototype/
```

Then open `summer-prototype/project.godot` in Summer Engine or the Godot 4.3 editor and press Play (or `summer.cmd run summer-prototype` once Summer's CLI is set up).

`export_godot.cjs` loads the built game in headless Chromium (Playwright) and writes:

| Output | Contents |
|---|---|
| `data/game.json` | 36 rule tables: CLASSES, SPECIES, SPELLS, BUFFS, ITEMS, BESTIARY (with art), BOSSES, ASPECT_SPECS, XP, MONSTER_LEVELS, BIOMES, SPELL_UNLOCK… |
| `data/zones.json` | 154 zones/towns with 406 NPCs: tile rows (pack-aliased art), walk mask, exits, hub, level range |
| `data/sprites.json` | 5,077 sprite names → `[file, x, y, w, h]` in the 4× art |
| `art/` (gitignored) | `assets_hd64/` sheets plus 568 single 4× PNGs |

`art/` is regenerated rather than committed, because it is derived from `assets/` and from third-party packs whose raw files stay out of git.

## What is ported

- Title (NEW GAME / CONTINUE), race list with portraits, 27-class grid, name.
- Overworld: every exported zone and town, tile camera, walking animation, NPCs, zone exits that land on the matching return exit, banner, HUD (portrait, HP, XP, gold, SAFE / level range).
- NPCs: inn (rest + save), vendor (potions), elder dialogue; other services show a placeholder line.
- Random encounters by biome monster family and zone level.
- Turn-based battle in the handheld layout: d20 + bonus vs AC, natural-20 crits, class spells with saves and half damage, potions, run, XP, level-ups (1–720, spell levels on the 1–720 curve), gold, defeat respawn.
- START menu: status, potion, save, save & quit. Save/load to `user://gbquest_save.json`.
- Controls: arrows, Z/Space = A, X/Esc = B, Enter = START.

## Not ported yet (planned stages)

Inventory and gear slots, item affixes and the 164 aspects, jobs and support jobs, dungeons and floors, quests and the campaign, crafting, gems, mounts, necromancer army, NPC AI, guilds and conquest, the MMO HUD themes, multiplayer, audio.

## Verified

Run headless under xvfb with `tools/capture.tscn` (screenshots plus play checks):

```
CHECK battle finished=true turns=3 lvl=1 xp=125 hp=12
CHECK exit elderwood -> elderwood_s1 at (1, 12)
CHECK save=true load=true
```
