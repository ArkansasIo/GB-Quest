'use strict';
// ================================================================ AUDIO LIBRARY: 80 more tracks and 16 more sound effects
// Adds 80 original tracks to the 24 core ones (TRACKS in engine.js, ARR64 in audio64.js), so both sound engines play
// them: the chip engine composes each from its recipe, the 64-bit engine arranges it with the instruments below.
// Every track has a place in the game (see the selectors at the end):
//   26 region themes      exploring each of the 13 base regions (Ardenhold: its towns) and 13 expansions   ow_<region>, ow_x1..x13
//   26 battle themes      ordinary fights in each of those areas                          bt_<region>, bt_x1..x13
//   13 expansion bosses   boss fights in each expansion                                    boss_x1..x13
//    5 dungeon themes     crypt / ice / lava / temple / void dungeons                      dg_<theme>
//    4 raid themes        each raid                                                        raid_<id>
//    6 special battles    elite, arena, trial, tower boss, dungeon boss, raid boss
// Recipe fields: bpm, root (MIDI note), scale (SCALES), prog (chord degrees), drums (16 steps: k kick, s snare, h hat).
(() => {
  if (typeof TRACKS === 'undefined') return;
  // 64-bit arrangements by mood: lead / counter-melody / pad / bass instruments plus percussion options
  const A = {
    heroic: { lead: 'brass', counter: 'harp', pad: 'strings', bass: 'bass', cstyle: 'arp', crash: true },
    pastoral: { lead: 'flute', counter: 'harp', pad: 'pad', bass: 'bass', cstyle: 'arp', shaker: true },
    harbor: { lead: 'flute', counter: 'piano', pad: 'pad', bass: 'slap', cstyle: 'arp', shaker: true },
    mystic: { lead: 'bell', counter: 'harp', pad: 'choir', bass: 'bass', cstyle: 'echo' },
    eerie: { lead: 'synth', counter: 'bell', pad: 'choir', bass: 'bass', cstyle: 'echo' },
    tribal: { lead: 'flute', counter: 'piano', pad: 'pad', bass: 'slap', cstyle: 'arp', shaker: true, toms: true },
    frost: { lead: 'bell', counter: 'harp', pad: 'strings', bass: 'bass', cstyle: 'echo' },
    desert: { lead: 'synth', counter: 'harp', pad: 'pad', bass: 'bass', cstyle: 'arp', toms: true },
    fire: { lead: 'synth', counter: 'organ', pad: 'strings', bass: 'bass', cstyle: 'arp', toms: true, timp: true },
    sacred: { lead: 'choir', counter: 'organ', pad: 'strings', bass: 'bass', cstyle: 'echo', timp: true },
    battle: { lead: 'synth', counter: 'brass', pad: 'strings', bass: 'slap', cstyle: 'arp', crash: true, toms: true },
    epic: { lead: 'brass', counter: 'choir', pad: 'strings', bass: 'bass', cstyle: 'arp', crash: true, timp: true, toms: true },
    dread: { lead: 'organ', counter: 'choir', pad: 'strings', bass: 'bass', cstyle: 'echo', timp: true, crash: true },
  };
  // [id, display name, bpm, root, scale, prog, drums, arrangement]
  const L = [
    // ---- base region themes (13)
    ['ow_ardenhold', 'ARDENHOLD: HARBOUR OF KINGS', 112, 62, 'major', [0, 3, 4, 5, 3, 0, 4, 4], 'k..hs.h.k..hs.h.', 'harbor'],
    ['ow_elderwood', 'ELDERWOOD MEADOWS', 120, 60, 'major', [0, 4, 5, 3], 'k.h.s.h.k.h.s.h.', 'pastoral'],
    ['ow_hollowmere', 'HOLLOWMERE MIST', 88, 57, 'dorian', [0, 3, 0, 6], 'k.......s...h...', 'eerie'],
    ['ow_thornwood', 'THORNWOOD CANOPY', 126, 59, 'penta', [0, 3, 2, 4], 'k.hhs.hhk.hks.hh', 'tribal'],
    ['ow_greypeak', 'GREYPEAK PASS', 96, 62, 'mixo', [0, 6, 3, 4], 'k...h...s...h.h.', 'heroic'],
    ['ow_sandspire', 'SANDSPIRE DUNES', 108, 57, 'harmonic', [0, 1, 0, 5], 'k..k..s.k..k..s.', 'desert'],
    ['ow_saltreach', 'SALTREACH TIDES', 114, 64, 'mixo', [0, 3, 6, 0], 'k..hs.h.k.hhs.h.', 'harbor'],
    ['ow_emberwaste', 'EMBERWASTE ASHFALL', 132, 52, 'phrygian', [0, 1, 6, 0], 'kkh.s.h.kkh.s.hs', 'fire'],
    ['ow_frostmarch', 'FROSTMARCH VIGIL', 86, 64, 'minor', [0, 5, 2, 6], 'k.......h...s...', 'frost'],
    ['ow_verdantdeep', 'VERDANT DEEP', 118, 60, 'dorian', [0, 4, 3, 6], 'k.hhs.h.k.hhs.hh', 'tribal'],
    ['ow_ashenbarrows', 'ASHEN BARROWS', 78, 50, 'harmonic', [0, 5, 4, 0], 'k.......s.......', 'dread'],
    ['ow_silverhaven', 'SILVERHAVEN LIGHTS', 102, 67, 'lydian', [0, 1, 4, 3], '....h.......h...', 'mystic'],
    ['ow_duskmoor', 'DUSKMOOR LONG NIGHT', 82, 49, 'phrygian', [0, 5, 1, 4], 'k.......s...h...', 'eerie'],
    // ---- expansion themes (13)
    ['ow_x1', 'ETERNAL ODYSSEY', 116, 62, 'mixo', [0, 4, 6, 3, 0, 4, 3, 4], 'k..hs.h.k.hhs.h.', 'heroic'],
    ['ow_x2', 'DRAGONFIRE REALM', 124, 55, 'harmonic', [0, 5, 4, 0], 'k.h.s.hkk.h.s.hs', 'fire'],
    ['ow_x3', 'EMBERFELL SAGA', 104, 60, 'dorian', [0, 6, 3, 4], 'k...h.h.s...h.h.', 'frost'],
    ['ow_x4', "WIZARD'S DOMINION", 98, 57, 'lydian', [0, 1, 5, 4], 'k...h...s...h...', 'mystic'],
    ['ow_x5', 'PLAGUEBORN LEGACY', 84, 53, 'phrygian', [0, 1, 5, 0], 'k.......s..h....', 'eerie'],
    ['ow_x6', 'CRYSTALIZED REALMS', 110, 68, 'lydian', [0, 4, 1, 5], '..h...h...h...h.', 'mystic'],
    ['ow_x7', 'FROSTSONG DYNASTY', 92, 63, 'minor', [0, 3, 5, 6], 'k...h...s...h...', 'frost'],
    ['ow_x8', 'ARCANE ASCENSION', 120, 64, 'lydian', [0, 1, 3, 4, 0, 1, 5, 4], 'k.h.s.h.k.h.s.h.', 'sacred'],
    ['ow_x9', 'BLOODMOON CONSPIRACY', 90, 51, 'harmonic', [0, 5, 1, 4], 'k..k....s...h...', 'dread'],
    ['ow_x10', 'DRAGONSPIRE ODYSSEY', 128, 55, 'mixo', [0, 6, 5, 4], 'kkh.s.h.k.h.s.hh', 'epic'],
    ['ow_x11', 'WHISPERS OF VALHALLA', 100, 57, 'dorian', [0, 3, 6, 4], 'k...k...s...h...', 'epic'],
    ['ow_x12', 'NIGHTSHADE CHRONICLES', 86, 52, 'minor', [0, 5, 6, 4], 'k.......s.h.....', 'eerie'],
    ['ow_x13', 'MYTHICAL MEADOWLANDS', 124, 65, 'major', [0, 3, 4, 0, 5, 3, 4, 4], 'k.h.s.h.k.h.s.h.', 'pastoral'],
    // ---- base region battles (13)
    ['bt_ardenhold', 'BATTLE: HARBOUR SKIRMISH', 160, 57, 'minor', [0, 5, 6, 4], 'k.hhs.hhk.hhs.hs', 'battle'],
    ['bt_elderwood', 'BATTLE: BRIGANDS OF ELDERWOOD', 164, 59, 'dorian', [0, 3, 6, 4], 'k.hhs.hhk.hks.hh', 'battle'],
    ['bt_hollowmere', 'BATTLE: SOMETHING IN THE MERE', 152, 55, 'phrygian', [0, 1, 0, 5], 'k..hs.hhk..hs.hs', 'battle'],
    ['bt_thornwood', 'BATTLE: THORNS AND FANGS', 170, 57, 'penta', [0, 2, 3, 4], 'kkhhs.hhk.hhs.hh', 'tribal'],
    ['bt_greypeak', 'BATTLE: AVALANCHE', 166, 60, 'minor', [0, 6, 5, 4], 'k.hhs.hhkkhhs.hs', 'battle'],
    ['bt_sandspire', 'BATTLE: SCORPION SANDS', 168, 55, 'harmonic', [0, 1, 6, 5], 'k.hks.hhk.hks.hs', 'desert'],
    ['bt_saltreach', 'BATTLE: WRECKERS', 162, 62, 'dorian', [0, 6, 3, 4], 'k.hhs.hhk.hhs.hs', 'battle'],
    ['bt_emberwaste', 'BATTLE: MAGMA STRIDE', 176, 52, 'phrygian', [0, 1, 0, 6], 'kkhhs.hhkkhhs.ss', 'fire'],
    ['bt_frostmarch', 'BATTLE: WHITEOUT', 158, 64, 'harmonic', [0, 5, 4, 0], 'k.hhs.h.k.hhs.hs', 'frost'],
    ['bt_verdantdeep', 'BATTLE: DEEP ROOTS', 168, 58, 'dorian', [0, 4, 6, 3], 'k.hhs.hhkkhhs.hh', 'tribal'],
    ['bt_ashenbarrows', 'BATTLE: RESTLESS DEAD', 156, 50, 'harmonic', [0, 1, 5, 4], 'k.h.s.hhk.h.s.ss', 'dread'],
    ['bt_silverhaven', 'BATTLE: SHARDSTORM', 172, 64, 'lydian', [0, 1, 4, 5], 'k.hhs.hhk.hhs.hs', 'battle'],
    ['bt_duskmoor', 'BATTLE: MOONLESS HUNT', 164, 49, 'phrygian', [0, 5, 1, 6], 'k.hhs.hhkkhhs.hs', 'dread'],
    // ---- expansion battles (13)
    ['bt_x1', 'BATTLE: ODYSSEY CLASH', 168, 57, 'mixo', [0, 6, 5, 4], 'k.hhs.hhk.hhs.hs', 'battle'],
    ['bt_x2', 'BATTLE: DRAGONFIRE', 178, 55, 'harmonic', [0, 1, 5, 4], 'kkhhs.hhkkhhs.ss', 'fire'],
    ['bt_x3', 'BATTLE: EMBERFELL', 164, 57, 'dorian', [0, 3, 6, 4], 'k.hhs.hhk.hks.hh', 'battle'],
    ['bt_x4', 'BATTLE: SPELLWRIGHT DUEL', 172, 60, 'lydian', [0, 1, 4, 3], 'k.hhs.hhk.hhs.hs', 'mystic'],
    ['bt_x5', 'BATTLE: PLAGUE HORDE', 160, 50, 'phrygian', [0, 1, 6, 5], 'k.hks.hhk.hks.ss', 'dread'],
    ['bt_x6', 'BATTLE: PRISM BREAK', 174, 64, 'lydian', [0, 4, 1, 5], 'k.hhs.hhkkhhs.hs', 'battle'],
    ['bt_x7', 'BATTLE: FROSTSONG', 162, 59, 'minor', [0, 5, 6, 4], 'k.hhs.h.k.hhs.hs', 'frost'],
    ['bt_x8', 'BATTLE: ASCENDANT', 176, 62, 'dorian', [0, 6, 3, 4], 'kkhhs.hhk.hhs.hs', 'epic'],
    ['bt_x9', 'BATTLE: BLOODMOON', 166, 51, 'harmonic', [0, 5, 1, 4], 'k.hhs.hhkkhhs.ss', 'dread'],
    ['bt_x10', 'BATTLE: SPIRE ASSAULT', 180, 55, 'minor', [0, 6, 5, 4], 'kkhhs.hhkkhhs.ss', 'epic'],
    ['bt_x11', 'BATTLE: SHIELDWALL', 164, 57, 'dorian', [0, 3, 4, 0], 'k.k.s.hhk.k.s.hs', 'epic'],
    ['bt_x12', 'BATTLE: NIGHTSHADE', 160, 52, 'phrygian', [0, 1, 5, 6], 'k.hhs.hhk.hhs.hs', 'eerie'],
    ['bt_x13', 'BATTLE: WILD MEADOW', 170, 60, 'mixo', [0, 4, 6, 3], 'k.hhs.hhk.hhs.hh', 'battle'],
    // ---- expansion bosses (13)
    ['boss_x1', 'BOSS: TIDE-SWORN TITAN', 182, 52, 'harmonic', [0, 1, 0, 4], 'kkhhs.hhkkhhs.ss', 'epic'],
    ['boss_x2', 'BOSS: THE FIRST FLAME', 186, 50, 'phrygian', [0, 1, 6, 0], 'kkskkskskkskksss', 'fire'],
    ['boss_x3', 'BOSS: EMBERFELL MONARCH', 178, 53, 'harmonic', [0, 5, 1, 4], 'kkhhs.hhkkhhs.ss', 'epic'],
    ['boss_x4', 'BOSS: ARCHMAGE ETERNAL', 176, 55, 'lydian', [0, 1, 5, 1], 'kkhhs.hhkkhhs.ss', 'sacred'],
    ['boss_x5', 'BOSS: PLAGUE HERALD', 172, 48, 'phrygian', [0, 1, 5, 6], 'kkskkskskkskksss', 'dread'],
    ['boss_x6', 'BOSS: CRYSTAL SOVEREIGN', 184, 57, 'lydian', [0, 4, 1, 5], 'kkhhs.hhkkhhs.ss', 'epic'],
    ['boss_x7', 'BOSS: THE FROST EMPEROR', 176, 52, 'harmonic', [0, 5, 4, 0], 'kkhhs.hhkkhhs.ss', 'frost'],
    ['boss_x8', 'BOSS: THE ASCENDED ONE', 188, 55, 'harmonic', [0, 1, 4, 5], 'kkskkskskkskksss', 'sacred'],
    ['boss_x9', 'BOSS: CRIMSON REGENT', 180, 49, 'harmonic', [0, 1, 0, 6], 'kkskkskskkskksss', 'dread'],
    ['boss_x10', 'BOSS: SPIREWYRM', 190, 52, 'phrygian', [0, 1, 6, 5], 'kkskkskskkskksss', 'epic'],
    ['boss_x11', 'BOSS: JARL OF THE LAST HALL', 178, 50, 'dorian', [0, 6, 3, 4], 'kkhhs.hhkkhhs.ss', 'epic'],
    ['boss_x12', 'BOSS: QUEEN OF NIGHTSHADE', 174, 49, 'phrygian', [0, 1, 5, 4], 'kkhhs.hhkkhhs.ss', 'dread'],
    ['boss_x13', 'BOSS: THE ELDER STAG', 182, 55, 'mixo', [0, 6, 5, 4], 'kkhhs.hhkkhhs.ss', 'epic'],
    // ---- dungeon themes (5; plain dungeons keep the core "dungeon" track)
    ['dg_crypt', 'DUNGEON: BONE HALLS', 92, 50, 'harmonic', [0, 5, 1, 4], 'k...h...s...h...', 'dread'],
    ['dg_ice', 'DUNGEON: FROZEN VAULTS', 88, 62, 'minor', [0, 6, 5, 2], 'k.......h.......', 'frost'],
    ['dg_lava', 'DUNGEON: MOLTEN DEPTHS', 112, 52, 'phrygian', [0, 1, 0, 6], 'k..k..s.k..k..s.', 'fire'],
    ['dg_temple', 'DUNGEON: SUNKEN TEMPLE', 96, 57, 'dorian', [0, 3, 6, 4], 'k...h.h.s...h.h.', 'sacred'],
    ['dg_void', 'DUNGEON: BETWEEN STARS', 84, 55, 'lydian', [0, 1, 5, 4], '....h.......h...', 'eerie'],
    // ---- raids (4)
    ['raid_crypt', 'RAID: THE BONE CRYPT', 96, 48, 'harmonic', [0, 1, 5, 4], 'k.k.s...k.k.s.s.', 'dread'],
    ['raid_forge', 'RAID: HEART OF EMBERS', 104, 50, 'phrygian', [0, 1, 6, 0], 'k.k.s...k.k.s.s.', 'fire'],
    ['raid_palace', 'RAID: THE RIME THRONE', 90, 55, 'harmonic', [0, 5, 4, 0], 'k.k.s...k.k.s.s.', 'frost'],
    ['raid_dusk', 'RAID: THE LONG NIGHT', 88, 46, 'phrygian', [0, 1, 5, 6], 'k.k.s...k.k.s.s.', 'dread'],
    // ---- special battles (6)
    ['elite', 'BATTLE: ELITE FOE', 174, 55, 'harmonic', [0, 1, 5, 4], 'kkhhs.hhk.hhs.ss', 'battle'],
    ['arena', 'ARENA: CROWD ROARS', 170, 60, 'mixo', [0, 6, 3, 4], 'k.k.s.hhk.k.s.hs', 'epic'],
    ['trial', 'TRIAL OF CHAMPIONS', 176, 57, 'dorian', [0, 3, 6, 4], 'kkhhs.hhkkhhs.hs', 'epic'],
    ['tower_boss', 'TOWER: GUARDIAN OF THE FLOOR', 180, 55, 'minor', [0, 5, 6, 4], 'kkhhs.hhkkhhs.ss', 'epic'],
    ['dungeon_boss', 'DUNGEON BOSS', 178, 52, 'harmonic', [0, 1, 0, 4], 'kkhhs.hhkkhhs.ss', 'dread'],
    ['raid_boss', 'RAID BOSS', 186, 50, 'phrygian', [0, 1, 5, 6], 'kkskkskskkskksss', 'epic'],
  ];
  const NAMES = {};
  for (const [id, name, bpm, root, scale, prog, drums, arr] of L) {
    if (TRACKS[id]) continue; // never replace a core track
    TRACKS[id] = { bpm, root, scale, prog, drums };
    if (typeof ARR64 !== 'undefined') ARR64[id] = Object.assign({}, A[arr]);
    NAMES[id] = name;
  }

  // ---------------------------------------------------------------- which track plays where
  const has = id => !!TRACKS[id];
  // overworld map of a zone: its region's or expansion's theme (towns keep the town track)
  function zoneMusic(z, fallback) {
    if (!z) return fallback;
    if (z.town) return z.region === 'ardenhold' && has('ow_ardenhold') ? 'ow_ardenhold' : fallback; // the capital's own theme
    const id = z.exp ? 'ow_x' + z.exp : 'ow_' + z.region;
    return has(id) ? id : fallback;
  }
  // dungeon / raid / tower map
  function roomMusic(kind, def, fallback) {
    if (kind === 'raid' && def && has('raid_' + String(def.id).replace(/^rd_/, ''))) return 'raid_' + String(def.id).replace(/^rd_/, '');
    if (kind === 'dungeon' && def && def.theme && def.theme !== 'dungeon' && has('dg_' + def.theme)) return 'dg_' + def.theme;
    return fallback;
  }
  // a battle asked for a generic track ('battle', 'boss'): pick the one for where and what it is
  function battleMusic(requested, battle) {
    const kind = battle && battle.kind, foes = (battle && battle.foes) || [];
    if (requested === 'arcboss' || (requested !== 'battle' && requested !== 'boss')) return requested; // story finales and custom tracks stay
    if (kind === 'arena' && has('arena')) return 'arena';
    if (kind === 'trial' && has('trial')) return 'trial';
    const g = typeof G !== 'undefined' ? G : null, inst = g && g.inst;
    const boss = requested === 'boss' || foes.some(f => f.boss);
    if (inst) {
      if (!boss) return requested;
      if (inst.kind === 'tower') return 'tower_boss';
      if (inst.kind === 'raid') return 'raid_boss';
      return 'dungeon_boss';
    }
    const z = g && typeof ZONE_BY_ID !== 'undefined' ? ZONE_BY_ID[g.map] : null;
    if (boss) return z && z.exp && has('boss_x' + z.exp) ? 'boss_x' + z.exp : requested;
    if (foes.some(f => f.elite)) return 'elite';
    const area = z ? (z.exp ? 'bt_x' + z.exp : 'bt_' + z.region) : null;
    return area && has(area) ? area : requested;
  }
  // ---------------------------------------------------------------- 16 more sound effects
  // Chip notes [wave, startHz, endHz, seconds, volume, delay] (p/q pulse, s square, t triangle, w saw, n noise); the
  // 64-bit engine upgrades them automatically (audio64.js play64). Each replaces a generic UI sound at a big moment.
  const later = (notes, d) => notes.map(n => { const c = n.slice(); c[5] = (c[5] || 0) + d; return c; });
  const NEW_SFX = {
    quest_new: arp('p', [76, 81, 88], 0.06),                                                       // a quest is accepted (towns)
    awaken: [['t', 220, 880, 0.5, 0.06]].concat(later(arp('s', [72, 79, 84, 91, 96], 0.07, 0.06), 0.35)), // gear awakens
    reforge: [['n', 3000, 800, 0.08, 0.07], ['s', 300, 300, 0.06, 0.05, 0.09], ['n', 3000, 800, 0.08, 0.06, 0.18], ['p', 1200, 1600, 0.1, 0.04, 0.27]],
    mount: [['q', 1800, 2400, 0.18, 0.04], ['q', 2400, 1800, 0.15, 0.04, 0.2]].concat([0.45, 0.6, 0.75, 0.9].map(d => ['n', 800, 600, 0.04, 0.06, d])), // whistle, hooves
    gamble: arp('q', [84, 86, 88, 89, 91], 0.03, 0.04).concat(later(arp('p', [88, 95], 0.05), 0.18)),
    jackpot: arp('s', [72, 76, 79, 84, 88, 91, 96, 100], 0.06, 0.06).concat([['n', 9000, 6000, 0.6, 0.03, 0.1]]),
    rift_open: [['w', 80, 600, 0.6, 0.06], ['t', 1200, 300, 0.5, 0.05, 0.1], ['n', 9000, 2000, 0.4, 0.03, 0.05]],
    rift_close: [['w', 600, 80, 0.5, 0.06], ['t', 300, 1200, 0.4, 0.05, 0.1]].concat(later(arp('t', [72, 79, 84], 0.08, 0.06), 0.5)),
    extract: [['t', 1500, 300, 0.3, 0.06], ['n', 5000, 1500, 0.2, 0.04, 0.05]],                    // aspect pulled into the codex
    imprint: [['t', 300, 1500, 0.3, 0.06]].concat(later(arp('p', [84, 91], 0.06, 0.05), 0.3)),      // aspect set into gear
    temper: [['s', 1800, 1700, 0.03, 0.07], ['n', 6000, 3000, 0.08, 0.05], ['s', 1800, 1700, 0.03, 0.06, 0.22], ['n', 6000, 3000, 0.08, 0.04, 0.22], ['t', 600, 600, 0.3, 0.05, 0.4]], // anvil
    perk_learn: arp('t', [67, 72, 76, 79], 0.06, 0.06),
    talent_learn: arp('s', [72, 79, 84], 0.06, 0.06).concat([['t', 1600, 1600, 0.3, 0.04, 0.2]]),
    heirloom_unlock: arp('t', [60, 67, 72, 76, 79, 84], 0.08, 0.06).concat([['t', 2093, 2093, 0.6, 0.04, 0.5]]),
    rune_fuse: [['q', 400, 1600, 0.25, 0.05], ['n', 7000, 4000, 0.2, 0.03, 0.1]].concat(later(arp('t', [84, 88], 0.06, 0.05), 0.3)),
  };
  const sfxAdded = [];
  if (typeof SFX_BANK !== 'undefined') for (const k in NEW_SFX) if (!SFX_BANK[k]) { SFX_BANK[k] = NEW_SFX[k]; sfxAdded.push(k); if (typeof SFX_NAMES !== 'undefined') SFX_NAMES.push(k); }

  const api = { NAMES, count: Object.keys(NAMES).length, sfx: sfxAdded, zoneMusic, roomMusic, battleMusic, trackName: id => NAMES[id] || String(id).toUpperCase() };
  if (typeof window !== 'undefined') window.GBQMusic = api;
  if (typeof globalThis !== 'undefined') globalThis.GBQMusic = api;
})();
