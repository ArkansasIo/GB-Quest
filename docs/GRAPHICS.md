# Graphics

## Display modes

| Setting | Values | Effect |
|---|---|---|
| **VIDEO** | GAME BOY · 64-BIT | presentation: 160×144 1:1, or 640×576 Scale4x with lighting (see below) |
| **PALETTE** | GBC, DMG, POCKET, SUNSET, AMBER, OCEAN, FULL COLOR | how sprites are reduced to colours |
| **TILES** | PIXEL · PAINTED | crisp 16×16 Game Boy tiles (`gt_*`), or the painted biome tilesets from the original sheet |
| **ART** | NES · CLASSIC | NES-style monster, item and portrait art (`nm_ ne_ np_`), or the original sheet sprites |
| **BRIGHTNESS / CONTRAST** | 0–6 | CSS filter on the LCD |

## Sprite pipeline (`spr`)

```
asset PNG ──▶ scale to w×h ──▶ palette mode?
                                ├─ DMG family: luminance quantiles → 4 shades (+ ordered dither; pixel-art families use fixed thresholds 78/128/182)
                                ├─ GBC: median-cut to 4 colours → snap to RGB555
                                └─ FULL: original colours
                        ──▶ flip / rotate / ghost ──▶ cache
```

## 64-bit video mode (`src/video64.js`)

Per frame, after the scenes draw the 160×144 framebuffer:

1. **Scale4x.** Two EPX/Scale2x passes on a `Uint32Array`. This rounds diagonals and keeps hard edges, so pixel art looks smooth without blur.
2. **Grade.** `saturate(1.18) contrast(1.06)`. The palette is forced to full colour while the mode is on, and the previous palette is restored when you switch back.
3. **Lighting**, in field scenes only:
   - Ambient darkness follows `Clock.hour` (one in-game day is 24 real minutes): day 0, dawn and dusk ramp, night 0.55. The tint is navy at night, rose at dusk and violet at dawn. Dungeons and instances are always dark (0.62).
   - Lights are cut out of the darkness with radial gradients, then a coloured additive glow is drawn on top. Lights come from the player lantern (with flicker), waypoints (blue), dungeon gates (amber), raid gates (red), unopened chests (gold) and uncleared pulls (red).
4. **Bloom.** A thresholded, blurred copy of the framebuffer, composited with `screen` at 16%.
5. **Vignette.**
6. **Camera pulse.** `Cam.pulse()` zooms on crits, natural 20s, level-ups, boss appearances and boss deaths (driven by `Events`).
7. **Profiler** (F3 or backtick): FPS, frame cost, scene and physics body counts, current modes and in-game time.

## 64-bit asset set (`assets_hd64/`)

`python3 tools/gen_hd64.py` re-renders every sprite family at 4× with the same Scale4x smoothing as the live mode. It also adds a top-left light ramp, a saturation boost, a rim light on top edges and a dark outline. Sprites are packed into atlas pages of at most 2048×4096:

| Family | Prefix | Sprites |
|---|---|---|
| monsters | `nm_` | 383 |
| equipment | `ne_` | 681 |
| portraits | `np_` | 29 |
| walkers | `gh_` | 120 |
| tiles | `gt_` | 675 |
| dungeon_tiles | `gd_` | 84 |
| objects | `go_` | 8 |
| battle | `b_` | 256 |

Each family has `<family>_<page>.png` pages and `<family>.json` (`{ name: [page, x, y, w, h] }`). `preview.png` is a contact sheet. The desktop port and mods can use these directly.

## Asset tools

| Tool | Output |
|---|---|
| `tools/extract_assets.py` | slices `src_sheet/sheet.png` into `assets/*.png` |
| `tools/gen_assets.py` | biome tilesets, monster variants, class looks, pixel icons |
| `tools/gen_gbtiles.py` | 16×16 Game Boy terrain for 25 biome families (including forest, deep forest, hills, mountains, snow, desert, oasis, swamp, jungle, savanna, steppe, volcanic, ruins, corruption, aether, crystal, mushroom, coast, ocean, river, frozen and sky), 16-way auto-tiled roads and shores, animated water, buildings, 6 dungeon themes, objects and walkers |
| `tools/make_font.py` | 6×9 bitmap font |
| `tools/make_worldmap.py` | VALENDRIA map at 320 px and 160 px, 32 colours |
| `tools/slice_sheets.py` | NES-style monster, equipment and portrait sheets, plus `assets/nes_index.json` |
| `tools/gen_hd64.py` | the 64-bit atlases above |
| `tools/build_atlas.py` | `dist/atlas.html` |

## Map rendering

- **In game (`WorldMap`):** the overview uses `gm_dunia_s`, and the detail view uses `gm_dunia` with a smoothed camera. Roads are dotted lines between connected zone pins: gold when you have visited both ends, dark otherwise. Sea lanes are blue dashes. Pins are red for towns, blue for waypoints, light for visited zones and dark for unknown ones. A blinking marker shows where you are.
- **Atlas (`dist/atlas.html`):** an SVG over the painted map. Roads are drawn as cased dashed curves and sea lanes as dotted curves, with zone pins coloured by biome, icons for dungeons, raids, bosses and waypoints, region and continent labels, search, layer toggles, a level-band filter, a details panel and a BFS route planner. Labels and strokes stay a constant screen size at any zoom.

## BLACKBIRD UI theme

`src/ui_mmo.js` adds BlackBird as the default MMO layout theme. Its dark leather panel texture, metal title bars, vitals and XP frames, equipment-slot icons, active-window borders, hotbar, battle frames, and inventory panels are converted from the user-provided BlackBird 1.1.8.1 archive into `assets/bb_*.png`. The theme uses the existing 160×144 canvas layout and remains selectable in `SETTINGS > UI THEME`.

## SANCTUM UI theme

`src/ui_dark.js`. This is an alternate dark interface, in the style of a modern dark action RPG. Switch it in `SETTINGS > UI THEME` (SANCTUM or CLASSIC).

- **Shades:** the four UI shades are remapped to near-black, dark bronze, tan and bone white. Every existing menu, dialog and list follows automatically.
- **Panels** (`frame()`): black fill, a bronze border with an inner dark line, and gold studs at the corners and centre.
- **Bars** (`bar()`): a dark trough with a coloured fill and a highlight line.
- **Menu header** (`hdr()`): a dark top bar showing the clock, level in gold, network status and gold.
- **Field HUD:**
  - a red **life orb** on the left that flashes below 30% health
  - a blue **resource orb** on the right showing spell slots, ki, rage and other class resources as a fraction of their maximum
  - the 4 equipped **combat arts** in the middle, red for physical and blue for casting
  - a gold **XP bar**
  - a top bar with level, name and gold
- **Page shell** (`client/shell.html`, `client/fullscreen.html`): black and blood-red background, bronze-trimmed panels and buttons, Cinzel serif headings, a gold glow around the screen, and the chat lifted above the HUD.

The single-tone palettes (DMG, POCKET, SUNSET, AMBER and OCEAN) keep the classic Game Boy look.


## SHADOWS HD artwork integration

The default browser shell theme uses the master art catalog as a subtle device finish and layers the new UI mockup catalog into the bezel at low opacity. `tools/build.cjs` replaces both artwork tokens with embedded PNG data URIs before producing the single-file browser build. This keeps the itch.io HTML5 export self-contained instead of relying on loose artwork files.
