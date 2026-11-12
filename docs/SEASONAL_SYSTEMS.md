# GB Quest Seasonal Systems

## Annual calendar

The live game year is divided into four consecutive calendar quarters. Each season begins at 00:00 local time on the first day of its quarter and ends when the next quarter begins.

| Quarter | Season | Theme | Seasonal currency | Keystone affix at +10 |
|---|---|---|---|---|
| January–March | Emberfall | Ash, flame and ancient forges | Ember Sigils | Cinderbound |
| April–June | Frostwake | Winter, ice and northern hunts | Frost Marks | Permafrost |
| July–September | Greentide | Worldroot, wild growth and corruption | Bloom Seals | Overgrown |
| October–December | Suncrown | Solar relics, storms and eclipse | Solar Crests | Eclipsed |

The existing 50-tier free season pass remains the reward track. Its season identifier rolls over with the same quarterly calendar.

## Season Journey

Each season has a 12-chapter story journey. Chapters progress from the character's saved statistics and must be completed in order. Objectives cover kills, elites, dungeons, quests, world bosses, raids, trials, crafting and keystone runs. Claiming a chapter grants gold, seasonal currency and season-pass XP.

## Weekly seasonal quests

Three deterministic weekly objectives are selected from a pool of nine. Objectives cover combat, dungeons, raids, trials, quests, world bosses, crafting and keystones. The weekly baseline is captured when the objectives roll, and unclaimed objectives expire at the weekly reset.

Each completed weekly objective grants 50 seasonal currency, 350 season-pass XP and 500 gold.

## Monthly events

Each three-month season has three monthly event themes. The event calendar changes on the first day of each month. Event caches can be claimed once per event month after defeating a world boss during that month.

## Renown and seasonal currency

Seasonal objectives grant currency and renown. Renown has 20 levels with claimable milestone rewards. The seasonal vendor offers upgrade materials, rift keys, a legendary relic and a seasonal title. Currency, renown, story progress, weekly objectives and event claims are stored in the character save and reset when the next season begins.

## Seasonal keystone affixes

At keystone level +10 and above, the weekly keystone affix rotation gains one seasonal affix:
- Cinderbound: increased enemy health and damage; enemies begin Mighty.
- Permafrost: increased enemy health; enemies begin Fortified.
- Overgrown: increased enemy health; enemies begin with Thornskin.
- Eclipsed: increased enemy health and damage; enemies begin Hasted.

Existing fortified/tyrannical and rotating weekly affixes remain active.

## Seasonal rank

The season journey displays a personal activity score and rank: Initiate, Adventurer, Champion, Veteran or Paragon. This is a local character score, not a server-wide competitive leaderboard.

## Persistence and multiplayer note

The current implementation stores seasonal progress in the character save. It does not yet make seasonal quest claims, currency balances, event participation or leaderboard scores authoritative in the PostgreSQL MMO backend. A production multiplayer deployment should move those operations to server-validated account/character records before enabling cross-realm rewards or a public leaderboard.
