# Feature status

What is in the game today, what is still missing, and the trade-offs of building each missing piece. Last updated with commit `43cefdf`.

## In the game

| Area | What exists |
|---|---|
| Core | 160×144 browser engine, 64-bit video mode, chip and 64-bit audio, desktop build, debug panel, bug sweep and 166 tests |
| Rules | d20 / 5e-style attributes, saves, proficiency, 16 classes with subclasses, species, backgrounds, feats, levels 1-720 with paragon |
| Combat | turn-based and realtime modes, 36 combat arts (physical and casting), tier powers, companions with stances, clean battle scenes |
| World | Valendria (base game + expansions 1-5) and 8 expansion worlds with their own maps: 154 zones, dungeons, raids, tower, trials, world bosses, weather and waypoints |
| Creatures | 400 bestiary creatures, plus 300 evolution-line creatures across the 14 creature types |
| Gear | 12 equipment slots, rarity 1-9, 23 gear tiers, 4 armour classes with sets, 14 weapon subclasses, named items, loot tables, stash |
| Economy | 18 professions with perk trees, 90 raw materials, 207 tiered blueprints, trainers in every settlement, curator, auction house, direct trade |
| Social / online | offline, page room and realm server modes, accounts, cloud saves, chat, PvP, guild and leaderboard basics |
| Collection | 120 mounts, pets, titles, achievements, reputation, housing |
| UI | SANCTUM dark UI with life/resource orbs, atlas, expansion maps, character creator |

## Not built yet

| Feature | Pros | Cons |
|---|---|---|
| **Story cinematics** (prologue and campaign) | Gives the campaign weight; reuses the portraits and maps | Script writing per chapter; small screen limits how much fits |
| **MySQL schema and seed data** (id, number, name for everything) | Real server persistence, admin tools, analytics; seed exports document every catalogue | A second source of truth to keep in sync; needs a migration and versioning plan |
| **Class and subclass redesign** (more SRD-style subclasses) | Build variety; matches 5e expectations | Big balance surface; needs new spells and features per subclass |
| **Higher-detail item and monster art** | The biggest visual upgrade, since the NES art is the weakest asset | Large volume (1,000+ sprites); quality varies when generated procedurally |
| **Server-authoritative trading and combat** | Stops cheating in shared realms | Rewrites trust-on-client systems; more server code to host |
| **Guild halls, guild banks, guild raids** | Long-term social glue | Needs reliable shared storage and permissions |
| **Matchmaking and group finder across real players** | Real group content online | Needs enough concurrent players; queue and timeout logic |
| **Seasonal content and battle pass** | Reasons to return; endgame loop | Ongoing content cost; must avoid pay-to-win |
| **Atlas for the 8 new worlds** | One reference for every world | The atlas UI is built around a single map; needs a world switcher |
| **Voice and music per expansion** | Each world feels distinct | 32+ new tracks to compose and store |
| **Localization** (other languages) | Reaches more players | Every string needs extracting; the 6×9 font is ASCII only |
| **Accessibility** (remappable pad, colour-blind palette, text scaling) | More players can play | Text scaling is hard on a fixed 160×144 screen |

**Legal note:** before any public or commercial release, check the "Shadowbane" trademark and keep the SRD 5.2 attribution in the credits.
