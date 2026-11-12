# Audio

Lost Kingdom of Shadowbane Chronicles has two complete sound engines. Switch between them in **SETTINGS > AUDIO** (`CHIP 4CH` / `64-BIT`), or press START inside the **SOUND TEST**. Both play the same 104 tracks (24 core + 80 in the music library below) and the same SFX names, so game code never needs to know which engine is active.

| | Chip 4CH (`engine.js`) | 64-bit (`audio64.js`) |
|---|---|---|
| Model | Game Boy APU: 2 pulse (12.5/25/50% duty), wave (triangle/saw), LFSR noise | 64-bit-console style: 8 music voices, stereo |
| Signal chain | voice → gain → output | voice → filters (LP/HP/BP) → stereo pan → bus (music/sfx) → **reverb send** (2.4 s convolver) + **echo send** (280 ms feedback delay) → master → **compressor** |
| Instruments | square, pulse 25, pulse 12, triangle, saw, noise | strings, pad, brass, flute (+ breath noise), harp, piano, FM bell, choir (formant), organ (drawbars), synth lead, bass, slap bass, timpani |
| Drums | noise bursts | kick (sine pitch-drop + click), snare (band-passed noise + body), closed and open hat, tom, crash, shaker |
| SFX | 103 | 103 upgraded automatically, 36 hand-layered versions, and 8 sounds unique to 64-bit (111 in the sound test) |
| Music | 1 pattern per track: lead, harmony, bass, drums | A and B sections ×2: legato lead, triad pad, arpeggio or echo counter-melody, walking bass, timpani hits, crashes, tom fills |

## Using sound in code

```js
SFX.levelup();          // any name from the bank; unknown names fall back to "cursor"
Music.play('boss');     // switch track (no-op if it is already playing)
Music.stop();
play([['p', 880, 440, 0.2, 0.06]]);   // raw chip notes: [wave, f0, f1, dur, vol, delay]
```

Volumes `S.vol` and `S.music` run from 0 to 6, with 3 as the default. Audio starts on the first user input, because browsers require a gesture.

## Sound effects (103 + 8)

| Group | Count | Names |
|---|---|---|
| UI | 12 | cursor, select, back, error, open, close, page, type, confirm, toggle, buy, sell |
| Combat | 25 | swing, hit_slash, hit_pierce, hit_blunt, crit, miss, block, dodge, shieldup, hurt, hurt_big, monster_die, boss_die, heal, revive, death, ds_ok, ds_fail, stabilize, flee, ambush, initiative, nat20, nat1, thorns |
| Spells | 16 | aegis_cast/hit, calling_cast/hit, omen_cast/hit, thrall_cast/hit, storm_cast/hit, veil_cast/hit, grave_cast/hit, flux_cast/hit |
| Status | 10 | poison, burn, freeze, shock, stun, sleep, charm, fear, bless, buff |
| Items & world | 20 | pickup, coin, chest, door, stairs, step_grass, step_sand, step_stone, step_snow, splash, cast_line, bite, reel, gather, craft, eat, drink, equip, scroll, waypoint |
| Events | 12 | levelup, quest_accept, quest_done, achievement, discover, boss_appear, world_boss, act_complete, lfg_ready, whisper, mail, auction |
| Creatures | 8 | growl, screech, hiss, roar, gurgle, moan, chitter, howl |
| **64-bit only** | 8 | thunder, sword_draw, magic_charge, portal, bell_toll, wind, fanfare, heartbeat |

**Upgrade rules** (`play64`): noise becomes band-passed white noise with a sweep. Triangle becomes sine plus triangle an octave up, with reverb and echo. Pulse, square and saw become two detuned oscillators plus a sine sub-octave through a key-tracked low-pass. Every voice gets a small random stereo spread.

## Music (24 tracks)

| Track | BPM | Key / mode | 64-bit lead · counter · pad · bass | Extras |
|---|---|---|---|---|
| boot | 120 | C major | bell · — · strings · bass | jingle |
| title | 108 | C lydian | brass · harp · strings · bass | crash |
| character | 96 | D dorian | flute · harp · pad · bass | |
| prologue | 72 | A minor | choir · bell · strings · bass | timpani |
| town | 104 | C major | flute · piano · pad · slap | shaker |
| field | 132 | D major | brass · harp · strings · bass | crash |
| coast | 116 | E mixolydian | flute · harp · pad · slap | shaker |
| marsh | 90 | A dorian | synth · bell · choir · bass | echo counter |
| jungle | 124 | B pentatonic | flute · piano · pad · slap | shaker, toms |
| snow | 84 | E minor | bell · harp · strings · bass | echo counter |
| desert | 112 | A harmonic minor | synth · harp · pad · bass | toms |
| volcano | 140 | E phrygian | brass · organ · choir · bass | timpani, crash |
| dusk | 80 | D harmonic minor | choir · bell · pad · bass | echo counter |
| crystal | 100 | G lydian | bell · harp · pad · bass | |
| dungeon | 100 | E minor | organ · bell · choir · bass | timpani |
| raid | 92 | D phrygian | brass · strings · choir · bass | timpani, crash |
| tower | 118 | G dorian | synth · harp · strings · bass | crash |
| battle | 168 | A minor | brass · strings · pad · bass | crash, toms |
| boss | 180 | E harmonic minor | brass · organ · choir · bass | timpani, crash, toms |
| arcboss | 176 | D phrygian | choir · brass · strings · bass | timpani, crash, toms |
| victory | 140 | C major | brass fanfare + strings + timpani | jingle |
| defeat | 70 | A minor | strings + choir | jingle |
| inn | 76 | C major | piano · harp · pad · bass | |
| credits | 112 | D major | flute · harp · strings · slap | crash, shaker |

Compositions are generated from the track definition with a seeded RNG (`composeTrack` for chip, `compose64` for 64-bit), so each track is the same every time and no audio files ship.

## Adding sounds

1. **Chip SFX:** add `name: [[wave, f0, f1, dur, vol, delay], ...]` to `SFX_BANK` in `engine.js`.
2. **64-bit SFX:** optionally add a layered recipe to `SFX64` in `audio64.js`, using instruments (`['harp', {f, at, dur, vol}]`), drums (`['k', {vol}]`) or raw voices (`['v', {...voice64 options}]`).
3. **Track:** add it to `TRACKS` (bpm, root MIDI note, scale, chord progression in scale degrees, 16-step drum string `k s h .`) and to `ARR64`.

## Music library (80 more tracks, src/audio_library.js)

Both engines play these too. The game picks them by place: each base region and expansion has an exploring theme and a battle theme, each expansion a boss theme, and dungeons, raids and special fights have their own (see `GBQMusic.zoneMusic`, `roomMusic` and `battleMusic`). They are listed in the **SOUND TEST** with the core tracks.

| Track | Name | BPM | Key / mode | 64-bit lead · counter · pad · bass |
|---|---|---|---|---|
| ow_ardenhold | ARDENHOLD: HARBOUR OF KINGS | 112 | D major | flute · piano · pad · slap |
| ow_elderwood | ELDERWOOD MEADOWS | 120 | C major | flute · harp · pad · bass |
| ow_hollowmere | HOLLOWMERE MIST | 88 | A dorian | synth · bell · choir · bass |
| ow_thornwood | THORNWOOD CANOPY | 126 | B pentatonic | flute · piano · pad · slap |
| ow_greypeak | GREYPEAK PASS | 96 | D mixolydian | brass · harp · strings · bass |
| ow_sandspire | SANDSPIRE DUNES | 108 | A harmonic minor | synth · harp · pad · bass |
| ow_saltreach | SALTREACH TIDES | 114 | E mixolydian | flute · piano · pad · slap |
| ow_emberwaste | EMBERWASTE ASHFALL | 132 | E phrygian | synth · organ · strings · bass |
| ow_frostmarch | FROSTMARCH VIGIL | 86 | E minor | bell · harp · strings · bass |
| ow_verdantdeep | VERDANT DEEP | 118 | C dorian | flute · piano · pad · slap |
| ow_ashenbarrows | ASHEN BARROWS | 78 | D harmonic minor | organ · choir · strings · bass |
| ow_silverhaven | SILVERHAVEN LIGHTS | 102 | G lydian | bell · harp · choir · bass |
| ow_duskmoor | DUSKMOOR LONG NIGHT | 82 | C# phrygian | synth · bell · choir · bass |
| ow_x1 | ETERNAL ODYSSEY | 116 | D mixolydian | brass · harp · strings · bass |
| ow_x2 | DRAGONFIRE REALM | 124 | G harmonic minor | synth · organ · strings · bass |
| ow_x3 | EMBERFELL SAGA | 104 | C dorian | bell · harp · strings · bass |
| ow_x4 | WIZARD'S DOMINION | 98 | A lydian | bell · harp · choir · bass |
| ow_x5 | PLAGUEBORN LEGACY | 84 | F phrygian | synth · bell · choir · bass |
| ow_x6 | CRYSTALIZED REALMS | 110 | Ab lydian | bell · harp · choir · bass |
| ow_x7 | FROSTSONG DYNASTY | 92 | Eb minor | bell · harp · strings · bass |
| ow_x8 | ARCANE ASCENSION | 120 | E lydian | choir · organ · strings · bass |
| ow_x9 | BLOODMOON CONSPIRACY | 90 | Eb harmonic minor | organ · choir · strings · bass |
| ow_x10 | DRAGONSPIRE ODYSSEY | 128 | G mixolydian | brass · choir · strings · bass |
| ow_x11 | WHISPERS OF VALHALLA | 100 | A dorian | brass · choir · strings · bass |
| ow_x12 | NIGHTSHADE CHRONICLES | 86 | E minor | synth · bell · choir · bass |
| ow_x13 | MYTHICAL MEADOWLANDS | 124 | F major | flute · harp · pad · bass |
| bt_ardenhold | BATTLE: HARBOUR SKIRMISH | 160 | A minor | synth · brass · strings · slap |
| bt_elderwood | BATTLE: BRIGANDS OF ELDERWOOD | 164 | B dorian | synth · brass · strings · slap |
| bt_hollowmere | BATTLE: SOMETHING IN THE MERE | 152 | G phrygian | synth · brass · strings · slap |
| bt_thornwood | BATTLE: THORNS AND FANGS | 170 | A pentatonic | flute · piano · pad · slap |
| bt_greypeak | BATTLE: AVALANCHE | 166 | C minor | synth · brass · strings · slap |
| bt_sandspire | BATTLE: SCORPION SANDS | 168 | G harmonic minor | synth · harp · pad · bass |
| bt_saltreach | BATTLE: WRECKERS | 162 | D dorian | synth · brass · strings · slap |
| bt_emberwaste | BATTLE: MAGMA STRIDE | 176 | E phrygian | synth · organ · strings · bass |
| bt_frostmarch | BATTLE: WHITEOUT | 158 | E harmonic minor | bell · harp · strings · bass |
| bt_verdantdeep | BATTLE: DEEP ROOTS | 168 | Bb dorian | flute · piano · pad · slap |
| bt_ashenbarrows | BATTLE: RESTLESS DEAD | 156 | D harmonic minor | organ · choir · strings · bass |
| bt_silverhaven | BATTLE: SHARDSTORM | 172 | E lydian | synth · brass · strings · slap |
| bt_duskmoor | BATTLE: MOONLESS HUNT | 164 | C# phrygian | organ · choir · strings · bass |
| bt_x1 | BATTLE: ODYSSEY CLASH | 168 | A mixolydian | synth · brass · strings · slap |
| bt_x2 | BATTLE: DRAGONFIRE | 178 | G harmonic minor | synth · organ · strings · bass |
| bt_x3 | BATTLE: EMBERFELL | 164 | A dorian | synth · brass · strings · slap |
| bt_x4 | BATTLE: SPELLWRIGHT DUEL | 172 | C lydian | bell · harp · choir · bass |
| bt_x5 | BATTLE: PLAGUE HORDE | 160 | D phrygian | organ · choir · strings · bass |
| bt_x6 | BATTLE: PRISM BREAK | 174 | E lydian | synth · brass · strings · slap |
| bt_x7 | BATTLE: FROSTSONG | 162 | B minor | bell · harp · strings · bass |
| bt_x8 | BATTLE: ASCENDANT | 176 | D dorian | brass · choir · strings · bass |
| bt_x9 | BATTLE: BLOODMOON | 166 | Eb harmonic minor | organ · choir · strings · bass |
| bt_x10 | BATTLE: SPIRE ASSAULT | 180 | G minor | brass · choir · strings · bass |
| bt_x11 | BATTLE: SHIELDWALL | 164 | A dorian | brass · choir · strings · bass |
| bt_x12 | BATTLE: NIGHTSHADE | 160 | E phrygian | synth · bell · choir · bass |
| bt_x13 | BATTLE: WILD MEADOW | 170 | C mixolydian | synth · brass · strings · slap |
| boss_x1 | BOSS: TIDE-SWORN TITAN | 182 | E harmonic minor | brass · choir · strings · bass |
| boss_x2 | BOSS: THE FIRST FLAME | 186 | D phrygian | synth · organ · strings · bass |
| boss_x3 | BOSS: EMBERFELL MONARCH | 178 | F harmonic minor | brass · choir · strings · bass |
| boss_x4 | BOSS: ARCHMAGE ETERNAL | 176 | G lydian | choir · organ · strings · bass |
| boss_x5 | BOSS: PLAGUE HERALD | 172 | C phrygian | organ · choir · strings · bass |
| boss_x6 | BOSS: CRYSTAL SOVEREIGN | 184 | A lydian | brass · choir · strings · bass |
| boss_x7 | BOSS: THE FROST EMPEROR | 176 | E harmonic minor | bell · harp · strings · bass |
| boss_x8 | BOSS: THE ASCENDED ONE | 188 | G harmonic minor | choir · organ · strings · bass |
| boss_x9 | BOSS: CRIMSON REGENT | 180 | C# harmonic minor | organ · choir · strings · bass |
| boss_x10 | BOSS: SPIREWYRM | 190 | E phrygian | brass · choir · strings · bass |
| boss_x11 | BOSS: JARL OF THE LAST HALL | 178 | D dorian | brass · choir · strings · bass |
| boss_x12 | BOSS: QUEEN OF NIGHTSHADE | 174 | C# phrygian | organ · choir · strings · bass |
| boss_x13 | BOSS: THE ELDER STAG | 182 | G mixolydian | brass · choir · strings · bass |
| dg_crypt | DUNGEON: BONE HALLS | 92 | D harmonic minor | organ · choir · strings · bass |
| dg_ice | DUNGEON: FROZEN VAULTS | 88 | D minor | bell · harp · strings · bass |
| dg_lava | DUNGEON: MOLTEN DEPTHS | 112 | E phrygian | synth · organ · strings · bass |
| dg_temple | DUNGEON: SUNKEN TEMPLE | 96 | A dorian | choir · organ · strings · bass |
| dg_void | DUNGEON: BETWEEN STARS | 84 | G lydian | synth · bell · choir · bass |
| raid_crypt | RAID: THE BONE CRYPT | 96 | C harmonic minor | organ · choir · strings · bass |
| raid_forge | RAID: HEART OF EMBERS | 104 | D phrygian | synth · organ · strings · bass |
| raid_palace | RAID: THE RIME THRONE | 90 | G harmonic minor | bell · harp · strings · bass |
| raid_dusk | RAID: THE LONG NIGHT | 88 | Bb phrygian | organ · choir · strings · bass |
| elite | BATTLE: ELITE FOE | 174 | G harmonic minor | synth · brass · strings · slap |
| arena | ARENA: CROWD ROARS | 170 | C mixolydian | brass · choir · strings · bass |
| trial | TRIAL OF CHAMPIONS | 176 | A dorian | brass · choir · strings · bass |
| tower_boss | TOWER: GUARDIAN OF THE FLOOR | 180 | G minor | brass · choir · strings · bass |
| dungeon_boss | DUNGEON BOSS | 178 | E harmonic minor | organ · choir · strings · bass |
| raid_boss | RAID BOSS | 186 | D phrygian | brass · choir · strings · bass |

## Sound effects added with the library (15)

| Name | Plays when |
|---|---|
| quest_new | a town quest is accepted |
| awaken | gear awakens |
| reforge | an awakening path is reforged |
| mount | a mount is summoned |
| gamble | the gambler sells a common or rare item |
| jackpot | the gambler rolls a legendary |
| rift_open | a rift opens |
| rift_close | a rift is completed |
| extract | an aspect is extracted into the codex |
| imprint | an aspect is imprinted on gear |
| temper | gear is tempered |
| perk_learn | a profession perk is learned |
| talent_learn | a talent is learned |
| heirloom_unlock | heirlooms are unlocked |
| rune_fuse | runes are fused |
