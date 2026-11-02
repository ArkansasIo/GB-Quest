# GB Quest: Lanterns of Aelmoor

**A Game Boy–style MMORPG with d20 rules — by ArkansasIo**
Version 2.0.0 (build B2026.11.01)

A 160×144 handheld RPG running in the browser. You can play in DMG green, Game Boy Color, Pocket or full colour palettes.

It combines:

- 5e-style tabletop rules: d20 rolls, ability scores, armour class, saving throws, spell slots and death saves.
- An MMO shell modelled on World of Warcraft: quests, loot rarity, dungeons, raids, an auction house, guilds, mounts and live players.
- A Diablo-style campaign: acts, chapters, waypoints and renown.

All art comes from the original asset sheet in `src_sheet/sheet.png`, or is generated from it.

## Play

- **Single file:** open `dist/gbquest.html` in any browser.
- **Dev build:** run `python3 -m http.server` in this folder, then open `http://localhost:8000`.
  The dev build loads `src/*.js` and `assets/*.png` directly.

**Controls**

| Input | Keyboard | Action |
|---|---|---|
| D-pad | Arrows / WASD | Move, navigate menus |
| A | Z / Space | Talk, act, confirm |
| B | X / Esc | Back; mount or dismount in the field |
| START | Enter | Main menu |
| SELECT | Shift / Tab | World map; toggles auto-battle in combat |

On phones, use the on-screen buttons.

## What's in the game

| System | Details |
|---|---|
| Rules | 9 attributes (STR DEX CON INT WIS CHA LCK WIL SPD), proficiency, AC, saves, 18 skills, advantage and disadvantage, crits, death saves, short and long rests, hit dice, concentration, attunement (3 items) |
| Characters | 6 species, 6 backgrounds, 12 classes with 24 subclasses, ability score increases or feats at levels 4/8/12/16/19 |
| Levels | 1–720. Levels 1–20 follow class progression. Levels 21–720 are ascension levels: +1 attribute and +2 substat points per level, plus a mythic boon every 50 levels |
| Magic | 59 spells, cantrips to level 9, across 8 renamed schools: Aegis, Calling, Omen, Thrall, Storm, Veil, Grave, Flux. Full, half and pact casters, plus mystic arcana |
| Combat | Initiative, multiattack, 20 conditions, 30 buffs and debuffs, 13 damage types, resistances, threat and tanking, legendary actions and resistances, recharge abilities, boss phases (enrage, summon, shield, curse and more), AI companions |
| Gear | 17 weapons, 11 armours, wondrous items. Six rarities (poor to legendary) with +1/+2/+3 bonuses and Diablo-style substat affixes |
| World | Continent of Aelmoor: 28 regions split into 90 zones across 9 biomes and 36 sub-biomes, with weather, waypoints, a parchment world map and a capital city hub |
| Story | Written prologue, 12 acts, 50 chapters, and 6 generated side quests per zone |
| Bestiary | 400 creatures (14 types, 55 subtypes, 7 elemental variants, elites) |
| Bosses | 350: 12 arc bosses, 177 world bosses, 66 dungeon, 45 raid, 30 trial and 20 tower bosses |
| Endgame | 22 dungeons, 9 raids (12 players), 6 trials, the 100-floor Spire, 9 difficulty tiers (Story to Apocalypse), 5 expansions covering levels 40–720 |
| MMO features | Auction house, mail, bank, guilds, reputation with 5 factions, arena with honor and rating, need/greed loot rolls, mounts, pets, a hearthstone, 36 achievements, a simulated realm with NPC players and chat |
| Professions | Herbalism, Alchemy, Fishing (timing minigame), Cooking |
| Multiplayer | 1, 4 or 12 player modes. When the page is shared, live players appear on the map with chat. A built-in host server lets friends fight in your party: the host runs each battle and guests take their own turns. A realm leaderboard is shared between players. |
| Audio | 4-channel chip synth (2 pulse, wave, noise), 103 sound effects and 24 procedural music tracks, with a sound test screen |
| Engine | Fixed 60 fps, scene stack, sprite and palette pipeline (DMG dithering, GBC 4-colour palettes per sprite), physics bodies and particles, save slots, autosave, live-update snapshots |

## Files

```
src_sheet/sheet.png        original asset sheet
tools/extract_assets.py    slices the sheet into assets/*.png
tools/gen_assets.py        biome tilesets, monster variants, class looks, pixel icons
tools/gen_gbtiles.py       crisp 16x16 Game Boy pixel art: terrain for 9 biomes (auto-tiled roads
                           and shores, animated water), buildings, 6 dungeon themes, map objects,
                           and walking sprites for 12 classes + 8 NPC looks
tools/make_font.py         6x9 bitmap font
tools/build.py             builds index.html, dist/gbquest.html and assets/index.json
src/data_rules.js          d20 rules: classes, species, spells, weapons, armour, monsters
src/data_world.js          attributes, buffs, difficulty, zones, story, bosses, expansions
src/gen.js                 RNG, dice, bestiary, bosses, zone/dungeon/tower generators, loot
src/engine.js              renderer, palettes, text, input, audio, physics, scenes
src/rules.js               character derivation, checks, rests, levelling, monster stat blocks
src/combat.js              the battle engine
src/systems.js             saves, quests, achievements, professions, realm, multiplayer
src/scenes_world.js        boot, title, creation, field, services, instances, map
src/scenes_menu.js         menus, sheets, bag, equipment, settings, sound test
src/main.js                entry point
```

Rebuild after any change:

```
python3 tools/extract_assets.py && python3 tools/gen_assets.py   # only if the sheet changes
python3 tools/gen_gbtiles.py                                     # Game Boy pixel tiles and sprites
python3 tools/build.py
```

## Roadmap

- C++23 + SDL2 desktop port of the full game.
- Game Boy Color ROM (RGBDS assembly) of a core version that fits real hardware.

## Legal

All names, lore and story are original to GB Quest.

The rules engine models mechanics from the System Reference Document 5.1 by Wizards of the Coast LLC, which is available under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/legalcode). No book text is reproduced.
