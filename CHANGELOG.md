# Changelog

All notable changes to Lost Kingdom of Shadowbane Chronicles. Versions follow `MAJOR.MINOR.PATCH`; builds are dated `BYYYY.MM.DD`.

## Unreleased

### Added
- **Realm audit log** (`audit.log`): a hash-chained, append-only record of sign-ins (including failures and throttling), registrations, password changes, staff actions, denied staff access, cloud saves and marketplace trades. Each entry records the account, IP, outcome and request ID. The control plane's **Audit log** tab can filter, verify and export it.
- **Realm debug log** (`debug.log`): a leveled server log that records every 500 with its stack trace, slow requests and storage failures. Every request is logged at `debug`. Every response carries `X-Request-Id`. Root and admin can view it, search it and change its level in the new **Debug log** tab.
- See [backend/README.md](backend/README.md#audit-and-debug-logs).
- **Heirlooms** (MENU > HEIRLOOMS): **LANTERNBORN HEIRLOOMS**, a set that belongs to the account rather than one hero. The jewellery, trinkets and merchant purchase are described below.
  - **Who can use it:** once a piece is bought, every hero in every save slot can summon and equip it from level 1. **SUMMON FULL SET** equips all pieces and moves replaced gear to the bag.
  - **Scaling:** item level follows the wearer's level from 1 to 720. Heirlooms are +1 at level 1, rising to +3 by level 481. Their stats stay below epic drops of the same level.
  - **Class fit:** the chest matches the hero's heaviest armour (plate, mail, jerkin or robe). The weapon comes in six styles (blade, mace, staff, bow, dagger, knuckles); each class gets a suggested style, and the style can be changed at any time.
  - **Set bonus:** 2 pieces give +10% XP; 4 add +10% XP, resistance and level-scaled HP; 6 add damage and healing; 9 add XP, gold find, magic find and crit. The amulet and cloak each add a fixed +5% XP.
  - **Soulbound:** heirlooms can't be listed on the auction house, traded or salvaged, and they sell for 0 G. Each hero holds one copy of each piece, and a lost or returned piece can be summoned again.
  - **Storage:** the collection is kept in this browser's storage, so it is shared by every save slot on the device.

- **Earrings slot and two trinket slots** (paper doll: the column beside the portrait). New earring bases (earrings, ear cuff, drop earrings) and eight trinket types drop as loot. Each trinket gives its wearer a buff when a battle starts, lasting longer at rare and legendary; the effect is logged in combat chat.
- **Heirloom jewellery, trinkets and vendor:** LANTERNBORN HEIRLOOMS grows to 14 pieces with two rings, earrings and two trinkets (war horn and lucky coin), plus 12- and 14-piece set bonuses.
  - **Buying:** pieces are bought once per account at any merchant (**MERCHANT > HEIRLOOMS**): 750 G to 2,500 G each, or 17,400 G for the whole set. Every hero on the account can then summon them for free.
  - **Existing collections:** the nine pieces unlocked by the first heirloom release stay unlocked.
  - **Bonus cap:** the built-in save, initiative and accuracy bonuses of all heirloom pieces combined are capped at +1 to +3, rising with level.

- **Challenges** (MENU > CHALLENGES): daily and weekly **bounty board**, **weekly vault** (choose 1 of up to 3 items, unlocked by 1/4/8 dungeon clears), **login streak** (7-day reward cycle) and a quarterly **season pass** (50 tiers, season titles, legendary trinket at tier 50). Progress is counted from the hero's existing statistics.
- **Keystones** (CHALLENGES > KEYSTONES): Mythic+-style timed dungeon runs.
  - **Scaling and affixes:** foes gain +8% HP and damage per key level, plus the week's affixes.
  - **Timer:** shown in the field's top-left corner.
  - **Results:** a timed run upgrades the key by +1 to +3 and earns a bonus chest. A late, failed or abandoned run drops the key a level.
  - **Rotation:** the key moves to a new dungeon after every run.
- **Rested XP** from time away and long rests doubles XP until spent; a **wardrobe** (MENU > WARDROBE) collects appearances for transmog; **gear score** is shown on the paper doll.

- **WoW-style chat:**
  - **Layout:** the panel is docked bottom-left above the action bar, see-through, with WoW-shaped tabs.
  - **Tabs:** GENERAL, COMBAT LOG, LOOT, WHISPERS, WORLD and GUILD by default. You can add, rename and delete tabs and choose each tab's channels; the active tab is remembered.
  - **Channel switches:** world chat (1. General), Trade, Local Defense, LFG, joined channels, adventurer chatter, or all chat. A muted channel is neither shown nor sendable.
  - **Where to set them:** **SETTINGS > CHAT SETTINGS** (in game), the panel's ⚙ menu, `/chatoff`, `/chaton`, `/leave 1-4` and `/join general`.

- **Admin account from your own account:**
  - **In game:** on a realm with no admin, **ONLINE > ACCOUNT > CLAIM REALM ADMIN** makes your account root. This only works from the server's own computer, never through a proxy, and only once.
  - **Command line:** `npm run admin -- create|promote|demote|list` manages staff accounts while the server is stopped.
  - **Developer mode:** root and admin accounts get it automatically. The account screen shows your role and an **ADMIN CONTROL** entry.

- **Durability and repair:** gear wears in battle and on death, broken gear gives no stats, REPAIR ALL at merchants and repair kits. **Crafting quality** rolls Standard, Fine, Superior or Masterwork (up to +35%) by skill.
- **Guild progression:** guild XP and 25 levels, 11 perks, a shared guild bank (3 tabs plus a gold vault), weekly guild quests and a guild log.
- **World quests:** 4 daily quests near your level, a daily rare elite per zone with epic loot, and 4-hour zone invasions with a chest for 15 invader kills.
- **Loadouts:** dual specialization (level 10, 500 G), 5 saved equipment sets and pinned action-bar order per spec.

### Fixed
- Server errors were returned as "Server error." without being logged anywhere.
- A request body of `null`, an array or a bare value crashed routes with a 500; it now returns 400.
- A failed write of `realm.json` threw inside a timer and could stop the server; it is now logged and retried.
- The in-game GM console's **AUDIT LOG** showed the oldest of the last 100 entries instead of the newest.

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
