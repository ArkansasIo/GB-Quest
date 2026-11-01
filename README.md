# GB Quest

A small Game Boy–style RPG built entirely from the supplied asset sheet
(`src_sheet/sheet.png`). 160×144 screen, 4-shade LCD palette (or the sheet's
original colours), square-wave sound, 60 fps.

## Play

- **Single file:** open `dist/gbquest.html` in any browser (all art inlined).
- **Dev version:** serve the folder and open `index.html`
  (`python3 -m http.server` then visit http://localhost:8000). It loads
  `src/*.js` and the PNGs in `assets/`, so edits show on reload.

Controls: arrows/WASD move · Z/Space = A · X/Esc = B · Enter = START ·
Shift = SELECT (map). On phones use the on-screen D-pad and buttons.

## The game

Wake by the castle, visit the OLD MAN in the village (he gives you the key),
gather 10 herbs, cross the river to the GOBLIN KEEP, beat the GOBLIN KING and
bring the LOST RELIC home.

Screens from the sheet that are implemented: main menu, inventory, item use,
status, equipment, quests, map, settings, battle (encounter / turn / action
result), level up — plus title, overworld, dungeon, shop, ending.

Systems: random encounters by terrain (plains / forest / dungeon), 15 enemies
+ boss, 3 skills, poison, crits/dodges, drops, gold shop, chests, gear slots
(weapon, shield, helm, armor, boots), levelling, castle rest + save
(localStorage), settings (volume, music, brightness, contrast, LCD/colour
palette, A/B swap, reset save).

## Files

```
src_sheet/sheet.png      the original asset sheet
tools/extract_assets.py  slices the sheet into assets/*.png (+ manifest.json)
tools/make_font.py       builds assets/font_6x9.png (X11 6x9 bitmap font)
tools/build.py           writes index.html and dist/gbquest.html
assets/                  146 sliced sprites, tiles, icons, effects
src/data.js              maps, tiles, items, enemies, quests, music
src/game.js              engine + every scene
src/shell.html           the handheld frame (HTML/CSS + touch controls)
```

Rebuild after changing anything:

```
python3 tools/extract_assets.py   # only if the sheet changes (needs Pillow, numpy, scipy)
python3 tools/build.py
```

Swap any PNG in `assets/` for your own art — sprites are scaled and
palette-quantised at runtime, so sizes don't need to match exactly.
