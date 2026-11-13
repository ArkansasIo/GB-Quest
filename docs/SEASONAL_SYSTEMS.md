# GB Quest Seasonal Systems

## Annual calendar

The live game year is divided into four consecutive UTC calendar quarters. Each season begins at 00:00 UTC on the first day of its quarter and ends when the next quarter begins.

| Quarter | Season | Theme | Seasonal currency | Keystone affix at +10 |
|---|---|---|---|---|
| January–March | Emberfall | Ash, flame and ancient forges | Ember Sigils | Cinderbound |
| April–June | Frostwake | Winter, ice and northern hunts | Frost Marks | Permafrost |
| July–September | Greentide | Worldroot, wild growth and corruption | Bloom Seals | Overgrown |
| October–December | Suncrown | Solar relics, storms and eclipse | Solar Crests | Eclipsed |

The existing 50-tier free season pass remains part of the client game. Its presentation follows the quarterly season calendar.

## Season Journey

Each season has a 12-chapter story journey. The client presentation covers kills, elites, dungeons, quests, world bosses, raids, trials, crafting and keystone runs. The PostgreSQL MMO service now owns the 12 objective definitions, progress records, one-time reward claims, seasonal token wallet and renown wallet.

The server-side objective catalogue currently defines:

| Chapter | Objective | Target | Authoritative event wired |
|---|---|---:|---|
| 1 | Defeat enemies | 60 | Mob defeat |
| 2 | Defeat elites | 8 | Pending elite classification |
| 3 | Complete dungeons | 2 | Dungeon completion |
| 4 | Complete quests | 5 | Quest completion |
| 5 | Defeat world bosses | 1 | Pending world-boss classification |
| 6 | Complete a raid encounter | 1 | Raid encounter completion |
| 7 | Complete trials | 2 | Pending trial completion hook |
| 8 | Craft items | 12 | Pending crafting completion hook |
| 9 | Complete keystone runs | 2 | Pending keystone completion hook |
| 10 | Defeat enemies | 250 | Mob defeat |
| 11 | Complete dungeons | 6 | Dungeon completion |
| 12 | Defeat world bosses | 3 | Pending world-boss classification |

Progress is recorded by trusted server code, not client-submitted counters. Dungeon completion credits each instance member in the same transaction as the completion status update. Raid encounter completion credits every current raid member in the same transaction as the completion record and lockouts. Mob defeats and quest completions are recorded in the authoritative combat transaction.

## Weekly seasonal quests

The browser game presents three deterministic weekly objectives selected from a pool of nine. The local weekly baseline and claims remain part of the client save. They are not yet a PostgreSQL-backed weekly quest ledger.

## Monthly events

Each three-month season has three monthly event themes. The event calendar changes on the first day of each month. Event caches can be claimed once per event month after defeating a world boss during that month. Monthly event claims are still client-save state; server-authoritative event participation and cache claims remain future work.

## Renown and seasonal currency

Server-side chapter claims grant a fixed reward defined by the backend catalogue. The reward settlement credits the character's seasonal token wallet, renown wallet and gold in a single transaction. Renown milestone claims are protected against duplicate claims. The browser seasonal vendor, item grants and seasonal title unlocks are still presentation/client-save features and must not be treated as authoritative MMO entitlements until server endpoints are added.

## Seasonal keystone affixes

At keystone level +10 and above, the weekly keystone affix rotation gains one seasonal affix:
- Cinderbound: increased enemy health and damage; enemies begin Mighty.
- Permafrost: increased enemy health; enemies begin Fortified.
- Overgrown: increased enemy health; enemies begin with Thornskin.
- Eclipsed: increased enemy health and damage; enemies begin Hasted.

Existing fortified/tyrannical and rotating weekly affixes remain active.

## Seasonal rank

The season journey displays a personal activity score and rank: Initiate, Adventurer, Champion, Veteran or Paragon. This is a local character score, not a server-wide competitive leaderboard.

## Persistence and multiplayer API

The authoritative MMO API is documented in the [seasonal progression pull request](https://github.com/ArkansasIo/GB-Quest/pull/44):

- `GET /api/characters/:characterId/season?seasonId=Y2027_emberfall` returns the seasonal wallet and all server-defined objective records.
- `POST /api/characters/:characterId/season/claim` claims a completed objective using fixed server rewards.
- `POST /api/characters/:characterId/season/progress` is an internal-only progress hook protected by `GBQ_INTERNAL_SECRET`. Never expose that secret in browser code.

Apply migration `018_seasonal_progression.sql` with `npm run mmorpg:migrate` before deploying the MMO service. Back up PostgreSQL first. The client seasonal UI may remain useful for presentation, but server currency, objective progress and reward eligibility must come from the authoritative API.
