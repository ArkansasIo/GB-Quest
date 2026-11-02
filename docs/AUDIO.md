# Audio

Lost Kingdom of Shadowbane Chronicles has two complete sound engines. Switch between them in **SETTINGS > AUDIO** (`CHIP 4CH` / `64-BIT`), or press START inside the **SOUND TEST**. Both play the same 24 tracks and the same SFX names, so game code never needs to know which engine is active.

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
