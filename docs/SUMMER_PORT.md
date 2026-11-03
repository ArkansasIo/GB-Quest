# GB-Quest on Summer Engine (Godot 4) — prototype port

`summer-prototype/` is a separate Godot 4 project that plays GB-Quest at **640×576 (the 160×144 screen at 4×)**. It reads all of its game data and images from the browser game, so the browser game stays the production baseline and the single source of truth (see `CLAUDE.md`). Nothing in `src/`, `dist/`, the Electron app or the server was changed by the port.

## Set up

From the repository root (Windows: use `npm.cmd` / `npx.cmd` in PowerShell, or Command Prompt):

```
npm install
npm install --no-save playwright   # the exporter drives the built game in headless Chromium
npx playwright install chromium
node tools/build.cjs          # builds dist/gbquest.html
node tools/export_godot.cjs   # exports data + art into summer-prototype/
```

Then open `summer-prototype/project.godot` in Summer Engine or the Godot 4.3 editor and press Play (or `summer.cmd run summer-prototype` once Summer's CLI is set up).

`export_godot.cjs` loads the built game in headless Chromium (Playwright) and writes:

| Output | Contents |
|---|---|
| `data/game.json` | 68 rule tables (CHAPTERS, ACTS, ARC_BOSSES, RECIPES, AFFIX_POOL/AFFIX_K, ASPECT_TEXT, SUPPORT_TRAITS added for stage 4; SLOTS, GEM_*, TEMPER_*, MW_*, RAID/TRIAL/WORLD_BOSSES for stage 5); zones also carry gathering nodes and world-boss spots: CLASSES, SPECIES, SPELLS, BUFFS, ITEMS, BESTIARY (with art), BOSSES, ASPECT_SPECS, XP, MONSTER_LEVELS, BIOMES, SPELL_UNLOCK… |
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
- Gear: each class starts with its browser-game kit (weapon, armour, shield). Weapon dice, finesse/ranged DEX, armour AC with the 5e DEX caps, shields and rarity pluses (POOR to DIVINE) drive the battle maths. Monsters drop weapons and armour (better rarity at higher levels); the vendor sells class-usable ARMS around your level and buys gear back at half price.
- Dungeons: all 38 dungeons from DUNGEONS. Face the keep door in each region's far zone and press A. Each run is 3 floors built from rooms and corridors in the dungeon's tile theme (dungeon, temple, ice, lava, void, crypt) with torches, visible monster packs from the theme's families, a hidden cache (gold + gear) and a floor boss from the browser game's dungeon-boss list guarding the stairs down (3x HP, more XP and gold, a sure drop at +2 rarity, no running). Clearing floor 3 awards a clear bonus (bigger the first time) and returns you to the door. Saving inside a dungeon saves at its entrance.
- Affixes and aspects: uncommon and better gear rolls 1-5 affixes from AFFIX_POOL with the browser formula (6% greater affixes at 1.5x; ancestral and divine always have one); legendary and better rolls one of the 164 aspects. In battle: crit range, crit damage, damage %, elemental %, lifesteal, haste (extra swing), dodge, block, resist, thorns, max HP, armour, accuracy, healing, magic/gold/XP find; aspects fire on damage conditions (low/full HP foes, bosses, crits, first hit, elements, conditions, buffs, your HP), lucky-hit procs (chains, bonus damage, heals, barriers, conditions, buffs), kills, battle start (barriers, buffs) and when hit (damage reduction, reflection, curses). Twelve conditions and nine buffs show as tags under the HP boxes.
- Job abilities: the 11 job classes get SKILL in battle (each ability once a battle). Support jobs open at level 18 (CHARACTER > JOB or a town TRAINER) and add the other class's traits, growing every 10 levels.
- Story: all 50 chapters of CHAPTERS across 12 acts (talk, kill, explore, gather, travel, dungeon, boss), with the act's arc boss guarding the last floor of the region dungeon in its chapter, chapter rewards from the browser formula and a goal tracker along the bottom of the field.
- Crafting: monsters drop materials by family and level (MATS tab in the bag); alchemists, weaponsmiths, armorers, blacksmiths and craft masters brew potions and forge gear from RECIPES; skill rises with each craft.
- Mounts: stablemasters sell the stable mounts (level 15+); START > MOUNT rides (faster steps, not in dungeons).
- CHARACTER page: STATS, SUBSTATS, ASPECTS, QUEST and JOB tabs. Bag item INFO (START) lists affixes and the aspect.
- Accessories: 52 wondrous items (head, neck, ear, back, hands, waist, legs, feet, two rings, two trinkets) drop beside weapons and armour and add AC, resistance, haste, damage, accuracy or HP by their plus, plus their own affixes and aspects. The GEAR tab lists all 15 slots.
- Gems and sockets (src/gems.js): weapons and armour have one socket per 180 item levels (max 4); nine gem types in tiers 1-9 drop from monsters (bosses most often) and add their stat. Bag > START opens the item menu: INFO, SOCKET GEM, REMOVE GEMS, TEMPER, MASTERWORK.
- Tempering and masterwork (src/d4_gear.js) in towns for gold and scrap: up to 2 tempered affixes from the offensive, defensive and utility pools; 12 masterwork ranks at +5% affixes each, with a 25% critical boost to one affix at ranks 4, 8 and 12.
- World bosses: the 89 world bosses stand in their zones (5x HP, sure drop) and return 400 steps after they fall.
- Gathering: every wild zone's herb, ore, wood, hide, salvage, relic, fiber and bone nodes show as icons; step on one to gather (respawn after 250 steps).
- Raids: all 17 raids from their doors (one floor per raid boss, 4-6 bosses at 4x HP, 3x clear bonus, 25% chance of a raid mount).
- Trials: the Trials Master runs all 6 trials (rush, timed, solo, frail, waves, mirror) with an epic+ reward the first time.
- Side quests (SIDE_TEMPLATES): the warden in every wild zone offers one at a time (cull, gather, fish or the zone's world boss); carry up to 3, they pay out on completion and show on CHARACTER > QUEST.
- Fishing: face water and press A, wait for the bite and press A again (skill widens the window); catches small fish, silverfin, sand eel or an old boot.
- Cooking and consumables: inns cook RECIPES' food from fish and herbs, alchemists brew elixirs; START > ITEMS eats food (heal, WELL FED: battles open with REGEN), battle > ITEM uses healing food and buff elixirs (MIGHT).
- Relics and artifacts: two more gear slots for the 42 relics (30% from world bosses, 20% on a first dungeon clear) and 42 artifacts (every raid clear); curators pay for each new find and show the collection.
- Extract and imprint (src/d4_gear.js): in towns, extract an item's aspect into your codex (keeping the best value) and imprint codex aspects onto rare or better gear.
- Dungeon doors and traps: doorways at room mouths; 3+ hidden traps per floor (DEX save against a DC that grows with level and floor, spikes stay visible once found).
- Flight: riding a flying raid mount in the wilds crosses water, trees and rocks.
- Town smiths (blacksmith, armorsmith, weaponsmith) sell ARMS and buy gear; road wardens have a line.
- GEAR & BAG pages (LEFT/RIGHT tabs, A equips or puts away; two-handed weapons and shields swap each other out; items your class can't use are greyed).
- START menu: status (with weapon and armour), gear & bag, potion, save, save & quit. Save/load to `user://gbquest_save.json`.
- Controls: arrows, Z/Space = A, X/Esc = B, Enter = START.

## Not ported yet (planned stages)

Housing, guilds and conquest, the bounty board, talents, pets and companions, the arena, PvP, necromancer army, NPC AI, guilds and conquest, the MMO HUD themes, multiplayer, audio.

## Verified

Run headless under xvfb with `tools/capture.tscn` (screenshots plus play checks):

```
CHECK battle finished=true turns=3 lvl=1 xp=125 hp=12
CHECK exit elderwood -> elderwood_s1 at (1, 12)
CHECK save=true load=true
CHECK start gear weapon=longbrand armor=chainhauberk shield=buckler ac=18 hit=+5 dice=1d8
CHECK equip knife -> weapon=knife hit=+8 note=Equipped KNIFE +3.
CHECK shield ac 18 -> 23
CHECK sell gold 100 -> 205 bag 7 -> 6
CHECK save=true load=true gear_kept=true
CHECK dungeon door ahead=dg_elderwood
CHECK dungeon GOBLIN KEEP 1F floor=0 mobs=9 boss=THOM THE PALE pos=(5, 5)
CHECK floor 1 cleared -> now GOBLIN KEEP 2F
CHECK floor 2 cleared -> now GOBLIN KEEP 3F
CHECK floor 3 cleared -> now ELDERWOOD FAR REACH
CHECK after clear zone=elderwood_s3 cleared=["dg_elderwood"] lvl=12 bag=5
CHECK quest start goal=Talk to the ELDER in Elderwood village.
CHECK quest after elder: ["CHAPTER COMPLETE: A SPARK IN THE ASH", "+3300 XP  +60 G"] | chapter=1 goal=Defeat foes in ELDERWOOD (0/6).
CHECK kill chapter done after 6 kills -> chapter=2 goal=Discover areas of ELDERWOOD (0/3). mats={ "bone_dust": 3, "hide": 1 }
CHECK legendary LONGBRAND +4 af=["+14 THORNS", "+1 ACCURACY", "+21% HEALING", "+37% GOLD FIND"] aspect=FROSTBITE: Hits have 19% to inflict FROSTBITTEN.
CHECK equipped legendary: aspects=1 hit=+11 ac=16 hpmax=44
CHECK craft HEALING DRAUGHT -> ["Brewed HEALING DRAUGHT: +1 potion.", "ALCHEMY skill 2."] potions 3 -> 4 skill=2
CHECK craft weapon CRUDE WEAPON -> ["Crafted MAUL +1!", "WEAPONSMITHING skill 2."]
CHECK support job warden at 30: hp stat=18 block=3
CHECK mount=steed_brown mounted=true step=0.088
CHECK legendary battle finished=true
CHECK save=true load=true chapter=2 mount=steed_brown
CHECK accessory RING +3 slot=["ring1"] stat=RING +6% RESIST ALL ac 18->18 hp 204->204
CHECK sockets ilvl400=3 ilvl1=1
CHECK socket ruby_t3 dmg 0 -> 3 sockets=["ruby_t3", "", ""]
CHECK temper tm=[["xp", 31]] masterwork rank=4 crits=[1] affixes [["leech", 17], ["thorns", 82], ["gf", 227]] -> [["leech", 20], ["thorns", 123], ["gf", 272], ["xp", 31]]
CHECK world bosses in elderwood_s1: ["ULAR BONEREAVER@13,9"]
CHECK gather peacebloom at (10, 7): 0 -> 2, ready again=false
CHECK world boss hp=65 (x5)
CHECK world boss down: mobs=0 wbk={ "boss_262": 1 }
CHECK raid door at sandspire_s3 ahead=rd_crypt
CHECK raid bosses=["OROM VOIDBORN(x4)", "SILAX VOIDBORN(x4)", "SKAUK OF THE PIT(x4)", "AZAX THE ELDER(x4)"] cleared=["rd_crypt"] zone=sandspire_s3
CHECK trial fights=5 won={ "tr_gauntlet": true }
CHECK save=true load=true gems={ ... } acc=["armor", "ring1", "shield", "weapon"]
CHECK side done: ["SIDE QUEST DONE: CULL"] gold 100 -> 150 active=0
CHECK water ahead in elderwood at (12, 8): true
CHECK fishing: fish=6 skill=7
CHECK cook: ["Made TRAIL RATION. (START > ITEMS)", "COOKING skill 2."] items={ "ration": 1 }
CHECK eat: ["You use TRAIL RATION.", "WELL FED: battles open with REGEN."] fed_until=300 steps=0
CHECK battle opens with buffs={ "regen": 3 } options=["ATTACK", "POTION x3", "ITEM", "RUN"]
CHECK after ITEM might: buffs={ "regen": 2, "might": 2 }
CHECK walk onto water: on foot=false flying=true
CHECK equipped relic+artifact: ["weapon", "armor", "relic", "artifact"]
CHECK curator: [..., "RELICS 1/42  ARTIFACTS 1/42", "For 2 new finds: 2600 G."] gold 155 -> 2755
CHECK extract: codex={ "savage": 40 } leg in bag=false
CHECK imprint: KNIFE +2 now has { "id": "savage", "v": 40 }
CHECK dungeon doors=14 traps=3 first trap -> ["A hidden trap! You leap clear. (DEX 17 vs DC 11)"] tile=gd_dungeon_spikes
CHECK save=true load=true codex=1 found=2
```

Rolls are random, so item names and values differ from run to run.
