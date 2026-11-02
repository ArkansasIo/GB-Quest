// LOST KINGDOM OF SHADOWBANE CHRONICLES — rules data. A d20 system modelled on the 5th-edition SRD mechanics,
// with original names and lore for the world of AELMOOR.
'use strict';

const ABILS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SKILLS = {
  athletics: 'STR', acrobatics: 'DEX', stealth: 'DEX', sleight: 'DEX',
  arcana: 'INT', history: 'INT', investigation: 'INT', nature: 'INT', religion: 'INT',
  animal: 'WIS', insight: 'WIS', medicine: 'WIS', perception: 'WIS', survival: 'WIS',
  deception: 'CHA', intimidation: 'CHA', performance: 'CHA', persuasion: 'CHA',
};
const SKILL_NAME = { athletics: 'ATHLETICS', acrobatics: 'ACROBATICS', stealth: 'STEALTH', sleight: 'SLEIGHT', arcana: 'ARCANA',
  history: 'HISTORY', investigation: 'INVESTIGATE', nature: 'NATURE', religion: 'RELIGION', animal: 'ANIMALS', insight: 'INSIGHT',
  medicine: 'MEDICINE', perception: 'PERCEPTION', survival: 'SURVIVAL', deception: 'DECEPTION', intimidation: 'INTIMIDATE',
  performance: 'PERFORM', persuasion: 'PERSUASION' };
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const MAX_LEVEL = 20;
const PARAGON_XP = 40000; // XP per paragon point after level 20
const CR_XP = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
  23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
const DMG_TYPES = ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'lightning', 'thunder', 'poison', 'acid', 'necrotic', 'radiant', 'force', 'psychic'];

// ---------------------------------------------------------------- spell schools (renamed)
const SCHOOLS = {
  aegis: { name: 'AEGIS', desc: 'Wards, shields and banishment.' },
  calling: { name: 'CALLING', desc: 'Summoning, healing light and conjured things.' },
  omen: { name: 'OMEN', desc: 'Foresight, marks and hidden truths.' },
  thrall: { name: 'THRALL', desc: 'Charms, sleep and commands of the mind.' },
  storm: { name: 'STORM', desc: 'Raw elemental force: fire, ice, lightning.' },
  veil: { name: 'VEIL', desc: 'Illusions, fear and invisibility.' },
  grave: { name: 'GRAVE', desc: 'Life and death, rot and return.' },
  flux: { name: 'FLUX', desc: 'Changing matter, speed and shape.' },
};

// ---------------------------------------------------------------- conditions
const CONDITIONS = {
  poisoned: { name: 'POISONED', attackDis: true, checkDis: true },
  frightened: { name: 'FRIGHTENED', attackDis: true },
  blinded: { name: 'BLINDED', attackDis: true, attackedAdv: true },
  prone: { name: 'PRONE', attackDis: true, attackedAdv: true, standUp: true },
  restrained: { name: 'RESTRAINED', attackDis: true, attackedAdv: true, dexSaveDis: true },
  stunned: { name: 'STUNNED', skip: true, attackedAdv: true, failStrDex: true },
  paralyzed: { name: 'PARALYZED', skip: true, attackedAdv: true, failStrDex: true, autoCrit: true },
  asleep: { name: 'ASLEEP', skip: true, attackedAdv: true, autoCrit: true, wakeOnDmg: true },
  charmed: { name: 'CHARMED', noAttack: true },
  dominated: { name: 'DOMINATED', turncoat: true },
  invisible: { name: 'INVISIBLE', attackAdv: true, attackedDis: true, endOnAttack: true },
  silenced: { name: 'SILENCED', noSpells: true },
  banished: { name: 'BANISHED', skip: true, untargetable: true },
  dodging: { name: 'DODGING', attackedDis: true },
  marked: { name: 'MARKED' },
  hexed: { name: 'HEXED' },
  outlined: { name: 'OUTLINED', attackedAdv: true, noInvis: true },
  cursed: { name: 'NO HEALING', noHeal: true },
  reckless: { name: 'RECKLESS', attackedAdv: true },
  beast: { name: 'BEASTSHAPE', skip: true },
};

// ---------------------------------------------------------------- species
const SPECIES = {
  hearthkin: { name: 'HEARTHKIN', asi: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, traits: ['versatile'], desc: 'Common folk of the river towns. +1 to all abilities, extra skill.' },
  thornelf: { name: 'THORNELF', asi: { DEX: 2, WIS: 1 }, traits: ['keen', 'feyblood'], desc: 'Long-lived forest kin. Keen senses; resist charm and sleep.' },
  stonekin: { name: 'STONEKIN', asi: { CON: 2, STR: 1 }, traits: ['stoneblood'], res: ['poison'], desc: 'Mountain delvers. Resist poison; advantage on poison saves.' },
  wispling: { name: 'WISPLING', asi: { DEX: 2, CHA: 1 }, traits: ['lucky', 'brave'], desc: 'Small and lucky. Reroll natural 1s; advantage vs fear.' },
  emberborn: { name: 'EMBERBORN', asi: { CHA: 2, INT: 1 }, traits: ['emberbolt'], res: ['fire'], desc: 'Touched by old fire. Resist fire; know EMBERDART.' },
  burrowkin: { name: 'BURROWKIN', asi: { INT: 2, CON: 1 }, traits: ['cunning'], desc: 'Clever tunnel folk. Advantage on INT/WIS/CHA saves against magic.' },
  twinblood: { name: 'TWINBLOOD', asi: { CHA: 2, DEX: 1, CON: 1 }, traits: ['feyblood', 'versatile'], desc: 'Born of two peoples. Resist charm; an extra skill.' },
  tuskborn: { name: 'TUSKBORN', asi: { STR: 2, CON: 1 }, traits: ['relentless'], desc: 'Fierce and hardy. Once per rest, drop to 1 HP instead of 0.' },
  drakkin: { name: 'DRAKKIN', asi: { STR: 2, CHA: 1 }, traits: ['breath'], res: ['fire'], desc: 'Dragon-blooded. Fire breath once per rest; resist fire.' },
};

const BACKGROUNDS = {
  soldier: { name: 'SOLDIER', skills: ['athletics', 'intimidation'], gold: 15, desc: 'You served in the Lantern Guard.' },
  scholar: { name: 'SCHOLAR', skills: ['arcana', 'history'], gold: 10, desc: 'You studied in the Ardenhold archives.' },
  wanderer: { name: 'WANDERER', skills: ['survival', 'perception'], gold: 10, desc: 'You grew up on the open road.' },
  urchin: { name: 'URCHIN', skills: ['stealth', 'sleight'], gold: 8, desc: 'You learned the alleys of Ardenhold.' },
  acolyte: { name: 'ACOLYTE', skills: ['religion', 'insight'], gold: 12, desc: 'You tended the Lantern shrines.' },
  envoy: { name: 'ENVOY', skills: ['persuasion', 'deception'], gold: 20, desc: 'You spoke for a noble house.' },
};

const FEATS = {
  tough: { name: 'TOUGH', desc: '+2 max HP per level.' },
  alert: { name: 'ALERT', desc: '+5 initiative; cannot be surprised.' },
  lucky: { name: 'LUCKY', desc: '3 rerolls per long rest (auto on misses/fails).' },
  resilient: { name: 'RESILIENT', desc: 'Proficiency in CON saves.' },
  warcaster: { name: 'WAR CASTER', desc: 'Advantage on concentration saves.' },
  sharpshot: { name: 'SHARPSHOOTER', desc: '+2 to hit with ranged weapons.' },
};

// ---------------------------------------------------------------- caster slot tables
const FULL_SLOTS = [ // [lvl] -> slots for spell levels 1..9
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const PACT_SLOTS = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];

// ---------------------------------------------------------------- classes
// features: [level, id]. caster: full | half | pact | null
const CLASSES = {
  warden: { name: 'WARDEN', hd: 10, primary: 'STR', saves: ['STR', 'CON'], armor: ['light', 'medium', 'heavy', 'shield'], weapons: 'martial', caster: null,
    skills: ['athletics', 'perception'], gear: ['longbrand', 'chainhauberk', 'buckler'], role: 'tank',
    features: [[1, 'style_def'], [1, 'secondwind'], [2, 'surge'], [5, 'extra1'], [9, 'indomitable'], [11, 'extra2'], [17, 'surge2'], [20, 'extra3']],
    subs: [{ id: 'champion', name: 'CHAMPION', keys: { critRange: 1 }, desc: 'Crit on 19-20.' }, { id: 'tactician', name: 'TACTICIAN', keys: { maneuver: 1 }, desc: '+1d8 on first hit each turn (4/rest).' }],
    desc: 'Masters of arms and armour. Second wind, action surge, many attacks.' },
  berserker: { name: 'BERSERKER', hd: 12, primary: 'STR', saves: ['STR', 'CON'], armor: ['light', 'medium', 'shield'], weapons: 'martial', caster: null,
    skills: ['athletics', 'survival'], gear: ['widesword', 'hidecoat'], role: 'tank',
    features: [[1, 'rage'], [1, 'unarmored_con'], [2, 'reckless'], [5, 'extra1'], [9, 'brutal']],
    subs: [{ id: 'frenzy', name: 'FRENZY', keys: { frenzy: 1 }, desc: 'Extra attack while raging.' }, { id: 'totem', name: 'TOTEM', keys: { totem: 1 }, desc: 'Resist all damage while raging.' }],
    desc: 'Fury made flesh. Rage halves weapon damage taken.' },
  vanguard: { name: 'VANGUARD', hd: 10, primary: 'STR', saves: ['WIS', 'CHA'], armor: ['light', 'medium', 'heavy', 'shield'], weapons: 'martial', caster: 'half', cast: 'CHA',
    skills: ['religion', 'persuasion'], gear: ['ironhammer', 'chainhauberk', 'buckler'], role: 'tank',
    features: [[1, 'layhands'], [2, 'style_def'], [2, 'smite'], [5, 'extra1'], [6, 'aura'], [11, 'brightsmite']],
    subs: [{ id: 'devotion', name: 'DEVOTION', keys: { sacred: 1 }, desc: '+CHA to hit (channel, 1/rest).' }, { id: 'vengeance', name: 'VENGEANCE', keys: { vow: 1 }, desc: 'Advantage vs your sworn foe.' }],
    desc: 'Oathsworn knights. Smite with spell slots, heal by touch.' },
  strider: { name: 'STRIDER', hd: 10, primary: 'DEX', saves: ['STR', 'DEX'], armor: ['light', 'medium', 'shield'], weapons: 'martial', caster: 'half', cast: 'WIS',
    skills: ['survival', 'stealth'], gear: ['greatbow', 'scalevest'], role: 'dps',
    features: [[1, 'favored'], [2, 'style_arch'], [5, 'extra1']],
    subs: [{ id: 'hunter', name: 'HUNTER', keys: { colossus: 1 }, desc: '+1d8 vs wounded foes.' }, { id: 'beastmaster', name: 'BEASTMASTER', keys: { wolf: 1 }, desc: 'A wolf fights beside you.' }],
    desc: 'Wilderness hunters. Bows, marks and nature magic.' },
  shade: { name: 'SHADE', hd: 8, primary: 'DEX', saves: ['DEX', 'INT'], armor: ['light'], weapons: 'finesse', caster: null,
    skills: ['stealth', 'sleight', 'acrobatics', 'perception'], expertise: ['stealth', 'perception'], gear: ['needleblade', 'quilted'], role: 'dps',
    features: [[1, 'sneak'], [2, 'cunning'], [5, 'uncanny'], [7, 'evasion'], [11, 'reliable']],
    subs: [{ id: 'thief', name: 'THIEF', keys: { fasthands: 1 }, desc: 'Use items as a bonus action.' }, { id: 'assassin', name: 'ASSASSIN', keys: { assassinate: 1 }, desc: 'Auto-crit foes that have not acted.' }],
    desc: 'Knives in the dark. Sneak attack and slippery tricks.' },
  ascetic: { name: 'ASCETIC', hd: 8, primary: 'DEX', saves: ['STR', 'DEX'], armor: [], weapons: 'simple', caster: null,
    skills: ['acrobatics', 'insight'], gear: ['walkstaff'], role: 'dps',
    features: [[1, 'martial'], [1, 'unarmored_wis'], [2, 'ki'], [5, 'extra1'], [5, 'stunning'], [7, 'evasion']],
    subs: [{ id: 'openhand', name: 'OPEN HAND', keys: { openhand: 1 }, desc: 'Flurry knocks foes prone.' }, { id: 'shadow', name: 'SHADOW', keys: { shadowstart: 1 }, desc: 'Begin fights unseen.' }],
    desc: 'Monks of the still mind. Fists, ki and stunning blows.' },
  arcanist: { name: 'ARCANIST', hd: 6, primary: 'INT', saves: ['INT', 'WIS'], armor: [], weapons: 'simple', caster: 'full', cast: 'INT',
    skills: ['arcana', 'history'], gear: ['walkstaff'], role: 'dps',
    features: [[1, 'recovery']],
    subs: [{ id: 'evoker', name: 'EVOKER', keys: { evoker: 1 }, desc: '+INT to STORM spell damage.' }, { id: 'abjurer', name: 'ABJURER', keys: { ward: 1 }, desc: 'Arcane ward of temp HP each fight.' }],
    desc: 'Scholars of the eight schools. The widest spell list.' },
  wildblood: { name: 'WILDBLOOD', hd: 6, primary: 'CHA', saves: ['CON', 'CHA'], armor: [], weapons: 'simple', caster: 'full', cast: 'CHA',
    skills: ['arcana', 'intimidation'], gear: ['knife'], role: 'dps',
    features: [[2, 'sorcery'], [3, 'quicken']],
    subs: [{ id: 'draconic', name: 'DRACONIC', keys: { draconic: 1 }, desc: 'AC 13+DEX, +CHA fire damage.' }, { id: 'surge', name: 'WILD SURGE', keys: { wildsurge: 1 }, desc: 'Spells may surge with bonus effects.' }],
    desc: 'Magic in the blood. Sorcery points bend spells.' },
  pactbound: { name: 'PACTBOUND', hd: 8, primary: 'CHA', saves: ['WIS', 'CHA'], armor: ['light'], weapons: 'simple', caster: 'pact', cast: 'CHA',
    skills: ['arcana', 'deception'], gear: ['knife', 'quilted'], role: 'dps',
    features: [[1, 'hexbolt'], [2, 'agonizing'], [11, 'arcanum']],
    subs: [{ id: 'fiend', name: 'FIEND PACT', keys: { fiend: 1 }, desc: 'Temp HP when you kill.' }, { id: 'archfey', name: 'ARCHFEY', keys: { feypresence: 1 }, desc: 'Charm all foes (1/rest).' }],
    desc: 'Bargainers with strange patrons. Few slots, back each short rest.' },
  cantor: { name: 'CANTOR', hd: 8, primary: 'CHA', saves: ['DEX', 'CHA'], armor: ['light'], weapons: 'simple', caster: 'full', cast: 'CHA',
    skills: ['performance', 'persuasion', 'insight'], gear: ['needleblade', 'quilted'], role: 'healer',
    features: [[1, 'inspire'], [2, 'restsong'], [2, 'jack']],
    subs: [{ id: 'lore', name: 'LORE', keys: { cutting: 1 }, desc: 'Cutting words blunt enemy hits.' }, { id: 'valor', name: 'VALOR', keys: { valor: 1 }, desc: 'Extra attack at level 6.' }],
    desc: 'Songweavers. Inspire allies, heal, and charm.' },
  chaplain: { name: 'CHAPLAIN', hd: 8, primary: 'WIS', saves: ['WIS', 'CHA'], armor: ['light', 'medium', 'shield'], weapons: 'simple', caster: 'full', cast: 'WIS',
    skills: ['religion', 'medicine'], gear: ['knobmace', 'scalevest', 'buckler'], role: 'healer',
    features: [[2, 'channel'], [5, 'destroyundead']],
    subs: [{ id: 'life', name: 'LIFE', keys: { lifedomain: 1 }, desc: 'Heals restore +2+slot level.' }, { id: 'tempest', name: 'TEMPEST', keys: { tempest: 1 }, desc: 'Max lightning/thunder damage (channel).' }],
    desc: 'Priests of the Lantern. Healing, wards, and turning the dead.' },
  verdant: { name: 'VERDANT', hd: 8, primary: 'WIS', saves: ['INT', 'WIS'], armor: ['light', 'medium', 'shield'], weapons: 'simple', caster: 'full', cast: 'WIS',
    skills: ['nature', 'animal'], gear: ['walkstaff', 'hidecoat'], role: 'healer',
    features: [[2, 'wildshape']],
    subs: [{ id: 'moon', name: 'MOON', keys: { moon: 1 }, desc: 'Stronger beast shapes.' }, { id: 'land', name: 'LAND', keys: { landrecover: 1 }, desc: 'Recover slots on short rest.' }],
    desc: 'Keepers of the green. Beast shapes and nature spells.' },
  necromancer: { name: 'NECROMANCER', hd: 6, primary: 'INT', saves: ['INT', 'WIS'], armor: [], weapons: 'simple', caster: 'full', cast: 'INT',
    skills: ['arcana', 'medicine'], gear: ['walkstaff'], role: 'dps', features: [[1, 'recovery']],
    subs: [{ id: 'gravecaller', name: 'GRAVECALLER', keys: { fiend: 1 }, desc: 'Claim vitality when you defeat an enemy.' }, { id: 'boneweaver', name: 'BONEWEAVER', keys: { ward: 1 }, desc: 'Gain a protective arcane ward each fight.' }],
    desc: 'Wield grave magic, drain life, and command the power of death.' },
  summoner: { name: 'SUMMONER', hd: 8, primary: 'CHA', saves: ['CON', 'CHA'], armor: ['light'], weapons: 'simple', caster: 'full', cast: 'CHA',
    skills: ['arcana', 'animal'], gear: ['walkstaff', 'quilted'], role: 'dps', features: [[1, 'recovery']],
    subs: [{ id: 'spiritcaller', name: 'SPIRITCALLER', keys: { wolf: 1 }, desc: 'Call a spirit companion to fight at your side.' }, { id: 'wardbinder', name: 'WARDBINDER', keys: { ward: 1 }, desc: 'Protect yourself with a ward at the start of battle.' }],
    desc: 'Bind spirits and call allies from beyond the veil.' },
  sunwarden: { name: 'SUNWARDEN', hd: 10, primary: 'WIS', saves: ['WIS', 'CHA'], armor: ['light', 'medium', 'shield'], weapons: 'martial', caster: 'half', cast: 'WIS',
    skills: ['religion', 'athletics'], gear: ['ironhammer', 'scalevest', 'buckler'], role: 'healer', features: [[1, 'layhands'], [5, 'extra1']],
    subs: [{ id: 'dawnkeeper', name: 'DAWNKEEPER', keys: { lifedomain: 1 }, desc: 'Restore more health with healing spells.' }, { id: 'sunstriker', name: 'SUNSTRIKER', keys: { sacred: 1 }, desc: 'Invoke sacred power to empower your weapon.' }],
    desc: 'Guardians of the dawn who heal allies and burn foes with radiant light.' },
  runeblade: { name: 'RUNEBLADE', hd: 10, primary: 'STR', saves: ['STR', 'CON'], armor: ['light', 'medium', 'heavy'], weapons: 'martial', caster: 'half', cast: 'CHA',
    skills: ['athletics', 'intimidation'], gear: ['widesword', 'chainhauberk'], role: 'tank', features: [[1, 'rage'], [5, 'extra1']],
    subs: [{ id: 'bloodrune', name: 'BLOOD RUNE', keys: { totem: 1 }, desc: 'Withstand damage through dark runic power.' }, { id: 'frostbrand', name: 'FROST BRAND', keys: { maneuver: 1 }, desc: 'Unleash a practiced runic strike.' }],
    desc: 'A rune-armored death knight who mixes martial strength with dark magic.' },
};
const CLASS_ORDER = ['warden', 'berserker', 'vanguard', 'strider', 'shade', 'ascetic', 'arcanist', 'wildblood', 'pactbound', 'cantor', 'chaplain', 'verdant', 'necromancer', 'summoner', 'sunwarden', 'runeblade'];
const FEATURE_NAME = {
  style_def: 'DEFENSE STYLE', style_arch: 'ARCHERY STYLE', secondwind: 'SECOND WIND', surge: 'ACTION SURGE', surge2: 'ACTION SURGE x2',
  extra1: 'EXTRA ATTACK', extra2: 'EXTRA ATTACK x2', extra3: 'EXTRA ATTACK x3', indomitable: 'INDOMITABLE', rage: 'RAGE',
  unarmored_con: 'UNARMORED DEF', unarmored_wis: 'UNARMORED DEF', reckless: 'RECKLESS ATTACK', brutal: 'BRUTAL CRITICAL',
  layhands: 'LAY ON HANDS', smite: 'SMITING STRIKE', aura: 'AURA OF WARDING', brightsmite: 'BRIGHT SMITE', favored: 'FAVORED FOE',
  sneak: 'SNEAK ATTACK', cunning: 'CUNNING ACTION', uncanny: 'UNCANNY DODGE', evasion: 'EVASION', reliable: 'RELIABLE TALENT',
  martial: 'MARTIAL ARTS', ki: 'KI', stunning: 'STUNNING STRIKE', recovery: 'ARCANE RECOVERY', sorcery: 'SORCERY POINTS',
  quicken: 'QUICKEN SPELL', hexbolt: 'HEXBOLT', agonizing: 'AGONIZING BLAST', arcanum: 'MYSTIC ARCANUM', inspire: 'INSPIRATION',
  restsong: 'SONG OF REST', jack: 'JACK OF TRADES', channel: 'CHANNEL DIVINITY', destroyundead: 'DESTROY UNDEAD', wildshape: 'BEASTSHAPE',
};
const ACTIVE_SKILLS = [
  { id: 'power_strike', name: 'POWER STRIKE', effect: 'strike', level: 3, classes: ['warden', 'berserker', 'vanguard', 'strider', 'shade', 'ascetic', 'sunwarden', 'runeblade'], desc: 'Once per battle, make a weapon attack with bonus damage.' },
  { id: 'rally', name: 'BATTLE RALLY', effect: 'rally', level: 6, classes: ['warden', 'berserker', 'vanguard', 'cantor', 'chaplain', 'sunwarden', 'runeblade'], desc: 'Once per battle, inspire the party for its next attack and saving throw.' },
  { id: 'field_mend', name: 'FIELD MEND', effect: 'mend', level: 9, classes: ['vanguard', 'cantor', 'chaplain', 'verdant', 'sunwarden'], desc: 'Once per battle, restore health to an ally.' },
  { id: 'shadowstep', name: 'SHADOW STEP', effect: 'shadow', level: 12, classes: ['strider', 'shade', 'ascetic', 'pactbound', 'verdant', 'necromancer', 'summoner', 'runeblade'], desc: 'Once per battle, vanish briefly and avoid incoming attacks.' },
  { id: 'arcane_burst', name: 'ARCANE BURST', effect: 'arcane', level: 3, classes: ['arcanist', 'wildblood', 'pactbound', 'necromancer', 'summoner'], desc: 'Once per battle, launch a scaling force bolt using your spell attack.' },
  { id: 'spirit_call', name: 'SPIRIT CALL', effect: 'summon', level: 6, classes: ['strider', 'verdant', 'summoner'], desc: 'Once per battle, call a spirit wolf to fight beside you.' },
  { id: 'sunflare', name: 'SUNFLARE', effect: 'sun', level: 9, classes: ['vanguard', 'chaplain', 'sunwarden'], desc: 'Once per battle, blast an enemy with scaling radiant light.' },
  { id: 'warding_aura', name: 'WARDING AURA', effect: 'ward', level: 12, classes: ['arcanist', 'wildblood', 'pactbound', 'necromancer', 'summoner'], desc: 'Once per battle, fortify the party against incoming damage.' },
];
const PASSIVE_SKILLS = [
  { id: 'vitality', name: 'VITALITY', level: 3, classes: ['warden', 'berserker', 'vanguard', 'ascetic', 'chaplain', 'verdant', 'sunwarden', 'runeblade'], desc: '+10% maximum health.' },
  { id: 'precision', name: 'PRECISION', level: 6, classes: ['warden', 'strider', 'shade', 'runeblade'], desc: '+1 weapon hit and spell attack.' },
  { id: 'arcane_focus', name: 'ARCANE FOCUS', level: 9, classes: ['arcanist', 'wildblood', 'pactbound', 'cantor', 'necromancer', 'summoner'], desc: '+5% damage from weapon and spell attacks.' },
  { id: 'resilience', name: 'RESILIENCE', level: 12, classes: ['vanguard', 'arcanist', 'wildblood', 'chaplain', 'necromancer', 'sunwarden'], desc: '+1 to all saving throws.' },
  { id: 'swift', name: 'SWIFTNESS', level: 15, classes: ['strider', 'shade', 'ascetic', 'pactbound', 'verdant', 'summoner'], desc: '+2 initiative and +5 dodge.' },
  { id: 'healing_hands', name: 'HEALING HANDS', level: 6, classes: ['vanguard', 'cantor', 'chaplain', 'verdant', 'sunwarden'], desc: '+10% healing from your abilities and spells.' },
  { id: 'ferocity', name: 'FEROCITY', level: 9, classes: ['berserker', 'shade', 'runeblade'], desc: '+5% damage dealt.' },
  { id: 'nature_lore', name: 'NATURE LORE', level: 6, classes: ['strider', 'verdant', 'summoner'], desc: '+2 to Nature and Animal Handling checks.' },
];

// ---------------------------------------------------------------- weapons (renamed, SRD-style mechanics)
// props: f finesse, l light, h heavy, 2 two-handed, v versatile die, r ranged, t thrown, reach
const WEAPONS = {
  cudgel: { name: 'CUDGEL', dmg: '1d4', type: 'bludgeoning', cat: 'simple', props: 'l', icon: 'px_mace', cost: 1 },
  knife: { name: 'KNIFE', dmg: '1d4', type: 'piercing', cat: 'simple', props: 'flt', icon: 'item_dagger', cost: 2 },
  hatchet: { name: 'HATCHET', dmg: '1d6', type: 'slashing', cat: 'simple', props: 'lt', icon: 'px_axe', cost: 5 },
  shortspear: { name: 'SHORTSPEAR', dmg: '1d6', type: 'piercing', cat: 'simple', props: 'tv', vdmg: '1d8', icon: 'px_spear', cost: 1 },
  walkstaff: { name: 'WALKSTAFF', dmg: '1d6', type: 'bludgeoning', cat: 'simple', props: 'v', vdmg: '1d8', icon: 'px_staff', cost: 1, focus: true },
  knobmace: { name: 'KNOBMACE', dmg: '1d6', type: 'bludgeoning', cat: 'simple', props: '', icon: 'px_mace', cost: 5 },
  huntbow: { name: 'HUNTBOW', dmg: '1d6', type: 'piercing', cat: 'simple', props: 'r2', icon: 'px_bow', cost: 25 },
  boltcaster: { name: 'BOLTCASTER', dmg: '1d8', type: 'piercing', cat: 'simple', props: 'r2', icon: 'px_bow', cost: 25 },
  longbrand: { name: 'LONGBRAND', dmg: '1d8', type: 'slashing', cat: 'martial', props: 'v', vdmg: '1d10', icon: 'item_iron_sword', cost: 15 },
  widesword: { name: 'WIDESWORD', dmg: '2d6', type: 'slashing', cat: 'martial', props: 'h2', icon: 'item_steel_sword', cost: 50 },
  needleblade: { name: 'NEEDLEBLADE', dmg: '1d8', type: 'piercing', cat: 'martial', props: 'f', icon: 'item_iron_sword', cost: 25 },
  crescent: { name: 'CRESCENT', dmg: '1d6', type: 'slashing', cat: 'martial', props: 'fl', icon: 'item_dagger', cost: 25 },
  cleaver: { name: 'CLEAVER', dmg: '1d8', type: 'slashing', cat: 'martial', props: 'v', vdmg: '1d10', icon: 'px_axe', cost: 10 },
  stonemaul: { name: 'STONEMAUL', dmg: '2d6', type: 'bludgeoning', cat: 'martial', props: 'h2', icon: 'px_hammer', cost: 10 },
  poleblade: { name: 'POLEBLADE', dmg: '1d10', type: 'slashing', cat: 'martial', props: 'h2', icon: 'px_spear', cost: 20 },
  ironhammer: { name: 'IRONHAMMER', dmg: '1d8', type: 'bludgeoning', cat: 'martial', props: 'v', vdmg: '1d10', icon: 'px_hammer', cost: 15 },
  greatbow: { name: 'GREATBOW', dmg: '1d8', type: 'piercing', cat: 'martial', props: 'rh2', icon: 'px_bow', cost: 50 },
};
// armour: base AC, dexMax (null = full), type
const ARMORS = {
  quilted: { name: 'QUILTED LEATHER', ac: 11, dexMax: null, type: 'light', icon: 'item_leather_armor', cost: 10 },
  studded: { name: 'STUDDED HIDE', ac: 12, dexMax: null, type: 'light', icon: 'item_leather_armor', cost: 45 },
  hidecoat: { name: 'HIDE COAT', ac: 12, dexMax: 2, type: 'medium', icon: 'item_leather_armor', cost: 10 },
  scalevest: { name: 'SCALE VEST', ac: 14, dexMax: 2, type: 'medium', icon: 'icon_0_2', stealthDis: true, cost: 50 },
  cuirass: { name: 'STEEL CUIRASS', ac: 14, dexMax: 2, type: 'medium', icon: 'icon_0_2', cost: 400 },
  warplate: { name: 'WARPLATE', ac: 15, dexMax: 2, type: 'medium', icon: 'icon_0_2', stealthDis: true, cost: 750 },
  linkedmail: { name: 'LINKED MAIL', ac: 14, dexMax: 0, type: 'heavy', icon: 'icon_0_2', stealthDis: true, cost: 30 },
  chainhauberk: { name: 'CHAIN HAUBERK', ac: 16, dexMax: 0, type: 'heavy', icon: 'icon_0_2', stealthDis: true, str: 13, cost: 75 },
  splintward: { name: 'SPLINTWARD', ac: 17, dexMax: 0, type: 'heavy', icon: 'icon_0_2', stealthDis: true, str: 15, cost: 200 },
  fullplate: { name: 'FULL PLATE', ac: 18, dexMax: 0, type: 'heavy', icon: 'icon_0_2', stealthDis: true, str: 15, cost: 1500 },
  buckler: { name: 'BUCKLER', ac: 2, type: 'shield', icon: 'icon_0_1', cost: 10 },
};
// wondrous items for the head, back, hands, waist, legs, feet, neck and ring slots. bonus: ac, save, hp, abil, hit, init
const WONDROUS = [
  // head
  { id: 'circlet', name: 'CIRCLET', slot: 'head', icon: 'item_cap', bonus: 'save' },
  { id: 'helm', name: 'WARDHELM', slot: 'head', icon: 'item_iron_helm', bonus: 'ac' },
  { id: 'mask', name: 'DREAD MASK', slot: 'head', icon: 'item_goblin_mask', bonus: 'abil' },
  // back
  { id: 'cloak', name: 'CLOAK', slot: 'back', icon: 'icon_0_2', bonus: 'save' },
  { id: 'mantle', name: 'MANTLE', slot: 'back', icon: 'icon_0_2', bonus: 'ac' },
  // hands
  { id: 'gloves', name: 'GLOVES', slot: 'hands', icon: 'icon_0_1', bonus: 'hit' },
  { id: 'gauntlets', name: 'GAUNTLETS', slot: 'hands', icon: 'icon_0_1', bonus: 'ac' },
  // waist
  { id: 'belt', name: 'BELT', slot: 'waist', icon: 'icon_1_4', bonus: 'hp' },
  { id: 'girdle', name: 'GIRDLE', slot: 'waist', icon: 'icon_1_4', bonus: 'abil' },
  // legs
  { id: 'leggings', name: 'LEGGINGS', slot: 'legs', icon: 'icon_0_2', bonus: 'init' },
  { id: 'greaves', name: 'GREAVES', slot: 'legs', icon: 'icon_0_2', bonus: 'ac' },
  // feet
  { id: 'boots', name: 'BOOTS', slot: 'feet', icon: 'item_boots', bonus: 'init' },
  { id: 'sabatons', name: 'SABATONS', slot: 'feet', icon: 'item_boots', bonus: 'ac' },
  // neck
  { id: 'amulet', name: 'AMULET', slot: 'neck', icon: 'px_orb', bonus: 'hp' },
  { id: 'pendant', name: 'PENDANT', slot: 'neck', icon: 'px_orb', bonus: 'save' },
  // rings (either ring slot)
  { id: 'ring', name: 'RING', slot: 'ring', icon: 'icon_0_5', bonus: 'save' },
  { id: 'charm', name: 'SIGNET', slot: 'ring', icon: 'icon_0_5', bonus: 'abil' },
  { id: 'band', name: 'BAND', slot: 'ring', icon: 'icon_0_5', bonus: 'hit' },
];
const RARITY = [
  { id: 'poor', name: 'POOR', plus: -1, tag: '.', color: '#9d9d9d', gbc: 1, value: 0.3 },
  { id: 'common', name: 'COMMON', plus: 0, tag: ' ', color: '#ffffff', gbc: 3, value: 1 },
  { id: 'uncommon', name: 'UNCOMMON', plus: 1, tag: '+', color: '#1eff00', gbc: 4, value: 5 },
  { id: 'rare', name: 'RARE', plus: 2, tag: '*', color: '#0070dd', gbc: 5, value: 20, attune: true },
  { id: 'veryrare', name: 'VERY RARE', plus: 3, tag: '#', color: '#a335ee', gbc: 6, value: 80, attune: true },
  { id: 'legendary', name: 'LEGENDARY', plus: 3, tag: '!', color: '#ff8000', gbc: 7, value: 300, attune: true },
];
const LEGENDARY_WEAPON = [
  { name: 'EMBERTONGUE', base: 'longbrand', extra: '2d6', etype: 'fire' }, { name: 'FROSTBRAND', base: 'widesword', extra: '1d8', etype: 'cold' },
  { name: 'STORMPIERCE', base: 'greatbow', extra: '1d10', etype: 'lightning' }, { name: 'DAWNMAUL', base: 'stonemaul', extra: '2d8', etype: 'radiant' },
  { name: 'WHISPER', base: 'needleblade', extra: '2d6', etype: 'necrotic' }, { name: 'STAFF OF AGES', base: 'walkstaff', extra: '1d6', etype: 'force', spell: 2 },
];
const MAX_ATTUNE = 3;
// 12 equipment slots (paper doll: left column, right column)
const SLOTS = ['head', 'neck', 'armor', 'back', 'hands', 'weapon', 'waist', 'legs', 'feet', 'ring1', 'ring2', 'offhand'];
const SLOT_NAME = { weapon: 'MAIN HAND', offhand: 'OFF HAND', armor: 'CHEST', head: 'HEAD', back: 'CLOAK', hands: 'HANDS', waist: 'WAIST', legs: 'LEGS', feet: 'FEET', neck: 'NECK', ring1: 'RING 1', ring2: 'RING 2' };
const SLOT_ICON = { weapon: 'icon_0_0', offhand: 'icon_0_1', armor: 'icon_0_2', head: 'icon_3_0', back: 'icon_0_2', hands: 'icon_0_1', waist: 'icon_1_4', legs: 'icon_0_2', feet: 'item_boots', neck: 'px_orb', ring1: 'icon_0_5', ring2: 'icon_0_5' };
const SLOT_COLS = [['head', 'neck', 'armor', 'back', 'hands', 'weapon'], ['waist', 'legs', 'feet', 'ring1', 'ring2', 'offhand']];

// ---------------------------------------------------------------- spells
// t: target enemy|enemies|ally|allies|self. eff: dmg|heal|cond|buff|summon|revive|kill|cleanse
// atk: spell attack; save: ability (half on success if half). scale: extra dice per upcast level or cantrip tier
const SPELLS = [
  // cantrips
  { id: 'emberdart', name: 'EMBERDART', school: 'storm', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: '1d10', dt: 'fire', cls: ['arcanist', 'wildblood'], desc: 'Spell attack, 1d10 fire.' },
  { id: 'rimetouch', name: 'RIMETOUCH', school: 'storm', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: '1d8', dt: 'cold', cls: ['arcanist', 'wildblood', 'verdant'], desc: 'Spell attack, 1d8 cold.' },
  { id: 'hexbolt', name: 'HEXBOLT', school: 'storm', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: '1d10', dt: 'force', beams: true, cls: ['pactbound'], desc: '1-4 beams of 1d10 force.' },
  { id: 'gravechill', name: 'GRAVECHILL', school: 'grave', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: '1d8', dt: 'necrotic', cond: 'cursed', dur: 1, cls: ['arcanist', 'wildblood', 'pactbound', 'chaplain', 'necromancer', 'runeblade'], desc: '1d8 necrotic; no healing.' },
  { id: 'brand', name: 'SACRED BRAND', school: 'storm', lvl: 0, t: 'enemy', eff: 'dmg', save: 'DEX', dice: '1d8', dt: 'radiant', cls: ['chaplain', 'sunwarden'], desc: 'DEX save, 1d8 radiant.' },
  { id: 'thornlash', name: 'THORNLASH', school: 'flux', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: '1d6', dt: 'piercing', cls: ['verdant'], desc: 'Spell attack, 1d6 piercing.' },
  { id: 'mocksong', name: 'MOCKSONG', school: 'thrall', lvl: 0, t: 'enemy', eff: 'dmg', save: 'WIS', dice: '1d4', dt: 'psychic', cond: 'frightened', dur: 1, cls: ['cantor'], desc: 'WIS save, 1d4 psychic + disadv.' },
  { id: 'wardspark', name: 'WARDSPARK', school: 'aegis', lvl: 0, t: 'self', eff: 'buff', buff: 'ac', val: 2, dur: 1, cls: ['arcanist', 'wildblood', 'pactbound', 'cantor'], desc: '+2 AC for a round.' },
  { id: 'sparklife', name: 'SPARK OF LIFE', school: 'calling', lvl: 0, t: 'ally', eff: 'heal', dice: '1d4', cls: ['chaplain', 'verdant'], desc: 'Restore 1d4 HP to an ally.' },
  { id: 'guidance', name: 'GUIDING EYE', school: 'omen', lvl: 0, t: 'ally', eff: 'buff', buff: 'bless', dur: 1, cls: ['chaplain', 'cantor', 'verdant', 'arcanist'], desc: 'Grant +1d4 to next attack or save.' },
  { id: 'shadowdart', name: 'SHADOW DART', school: 'veil', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: '1d8', dt: 'psychic', cls: ['cantor', 'arcanist', 'pactbound'], desc: 'Spell attack, 1d8 psychic.' },
  // level 1
  { id: 'mend', name: 'MENDING TOUCH', school: 'calling', lvl: 1, t: 'ally', eff: 'heal', dice: '1d8', mod: true, scale: '1d8', cls: ['chaplain', 'cantor', 'verdant', 'vanguard', 'strider'], desc: 'Heal 1d8+mod.' },
  { id: 'quickmend', name: 'QUICK MEND', school: 'calling', lvl: 1, t: 'ally', eff: 'heal', dice: '1d4', mod: true, scale: '1d4', bonus: true, cls: ['chaplain', 'cantor', 'verdant'], desc: 'Bonus action. Heal 1d4+mod.' },
  { id: 'darts', name: 'MAGIC DARTS', school: 'storm', lvl: 1, t: 'enemy', eff: 'dmg', auto: true, dice: '3d4+3', dt: 'force', scale: '1d4+1', cls: ['arcanist', 'wildblood', 'summoner'], desc: 'Never misses. 3d4+3 force.' },
  { id: 'thunderwave', name: 'THUNDER WAVE', school: 'storm', lvl: 1, t: 'enemies', eff: 'dmg', save: 'CON', half: true, dice: '2d8', dt: 'thunder', scale: '1d8', cls: ['arcanist', 'wildblood', 'cantor', 'verdant'], desc: 'All foes, CON save, 2d8.' },
  { id: 'flamefan', name: 'FLAME FAN', school: 'storm', lvl: 1, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '3d6', dt: 'fire', scale: '1d6', cls: ['arcanist', 'wildblood'], desc: 'All foes, DEX save, 3d6 fire.' },
  { id: 'forceward', name: 'WARD OF FORCE', school: 'aegis', lvl: 1, t: 'self', eff: 'buff', buff: 'ac', val: 5, dur: 1, bonus: true, cls: ['arcanist', 'wildblood'], desc: '+5 AC until next turn.' },
  { id: 'drowse', name: 'DROWSE', school: 'thrall', lvl: 1, t: 'enemies', eff: 'sleep', dice: '5d8', scale: '2d8', cls: ['arcanist', 'wildblood', 'cantor'], desc: '5d8 HP worth of foes fall asleep.' },
  { id: 'huntmark', name: 'BRAND OF THE HUNT', school: 'omen', lvl: 1, t: 'enemy', eff: 'cond', cond: 'marked', dur: 10, bonus: true, conc: true, cls: ['strider', 'pactbound'], desc: '+1d6 damage vs target.' },
  { id: 'bless', name: 'BLESSING CHANT', school: 'thrall', lvl: 1, t: 'allies', eff: 'buff', buff: 'bless', dur: 10, conc: true, cls: ['chaplain', 'vanguard'], desc: 'Party +1d4 to hit and saves.' },
  { id: 'roots', name: 'GRASPING ROOTS', school: 'calling', lvl: 1, t: 'enemies', eff: 'cond', save: 'STR', cond: 'restrained', dur: 3, conc: true, cls: ['verdant', 'strider'], desc: 'STR save or restrained.' },
  { id: 'faerie', name: 'FAERIE GLOW', school: 'omen', lvl: 1, t: 'enemies', eff: 'cond', save: 'DEX', cond: 'outlined', dur: 10, conc: true, cls: ['verdant', 'cantor'], desc: 'DEX save or attacks vs have adv.' },
  { id: 'dread', name: 'WHISPERED DREAD', school: 'veil', lvl: 1, t: 'enemy', eff: 'cond', save: 'WIS', cond: 'frightened', dur: 3, cls: ['cantor', 'pactbound', 'arcanist'], desc: 'WIS save or frightened.' },
  // level 2
  { id: 'rays', name: 'SCORCHING TRIPLET', school: 'storm', lvl: 2, t: 'enemy', eff: 'dmg', atk: true, rays: 3, dice: '2d6', dt: 'fire', cls: ['arcanist', 'wildblood'], desc: 'Three rays, 2d6 fire each.' },
  { id: 'still', name: 'STILLNESS', school: 'thrall', lvl: 2, t: 'enemy', eff: 'cond', save: 'WIS', cond: 'paralyzed', dur: 3, saveEnd: true, conc: true, cls: ['arcanist', 'wildblood', 'cantor', 'chaplain', 'verdant', 'pactbound'], desc: 'WIS save or paralyzed.' },
  { id: 'cloak', name: 'VANISHING CLOAK', school: 'veil', lvl: 2, t: 'self', eff: 'cond', cond: 'invisible', dur: 10, cls: ['arcanist', 'wildblood', 'cantor', 'pactbound'], desc: 'Invisible until you attack.' },
  { id: 'mace', name: 'SPECTRAL MACE', school: 'storm', lvl: 2, t: 'self', eff: 'summon', summon: 'mace', bonus: true, cls: ['chaplain', 'summoner'], desc: 'A floating mace strikes each turn.' },
  { id: 'moonshaft', name: 'LUNAR SHAFT', school: 'storm', lvl: 2, t: 'enemy', eff: 'dmg', save: 'CON', half: true, dice: '2d10', dt: 'radiant', scale: '1d10', cls: ['verdant'], desc: 'CON save, 2d10 radiant.' },
  { id: 'mirror', name: 'MIRROR SELVES', school: 'veil', lvl: 2, t: 'self', eff: 'buff', buff: 'mirror', val: 3, dur: 10, cls: ['arcanist', 'wildblood', 'pactbound'], desc: 'Three images soak attacks.' },
  { id: 'restore', name: 'LESSER RESTORE', school: 'aegis', lvl: 2, t: 'ally', eff: 'cleanse', cls: ['chaplain', 'cantor', 'verdant', 'vanguard', 'strider'], desc: 'End one condition.' },
  { id: 'augury', name: 'OMEN OF RUIN', school: 'omen', lvl: 2, t: 'enemy', eff: 'cond', save: 'WIS', cond: 'marked', dur: 5, bonus: true, conc: true, cls: ['cantor', 'strider', 'arcanist'], desc: 'WIS save or marked for extra damage.' },
  { id: 'barkskin', name: 'IRON BARK', school: 'flux', lvl: 2, t: 'self', eff: 'buff', buff: 'ac', val: 4, dur: 10, conc: true, cls: ['verdant', 'strider'], desc: '+4 AC for 10 rounds.' },
  { id: 'lifetap', name: 'LIFE SIPHON', school: 'grave', lvl: 2, t: 'enemy', eff: 'dmg', save: 'CON', half: true, dice: '3d6', dt: 'necrotic', scale: '1d6', cls: ['arcanist', 'pactbound', 'wildblood', 'chaplain', 'necromancer', 'runeblade'], desc: 'CON save, 3d6 necrotic.' },
  // level 3
  { id: 'sunorb', name: 'SUNBURST ORB', school: 'storm', lvl: 3, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '8d6', dt: 'fire', scale: '1d6', cls: ['arcanist', 'wildblood'], desc: 'All foes, DEX save, 8d6 fire.' },
  { id: 'lance', name: 'LIGHTNING LANCE', school: 'storm', lvl: 3, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '8d6', dt: 'lightning', scale: '1d6', cls: ['arcanist', 'wildblood'], desc: 'All foes, DEX save, 8d6.' },
  { id: 'dawn', name: 'SECOND DAWN', school: 'grave', lvl: 3, t: 'ally', eff: 'revive', cls: ['chaplain', 'vanguard', 'sunwarden'], desc: 'Revive a fallen ally at 1 HP.' },
  { id: 'unweave', name: 'UNWEAVE', school: 'aegis', lvl: 3, t: 'enemy', eff: 'cond', cond: 'silenced', dur: 2, cls: ['arcanist', 'wildblood', 'pactbound'], desc: 'Target cannot cast for 2 turns.' },
  { id: 'quicken', name: 'QUICKEN', school: 'flux', lvl: 3, t: 'ally', eff: 'buff', buff: 'haste', dur: 10, conc: true, cls: ['arcanist', 'wildblood'], desc: '+2 AC and an extra attack.' },
  { id: 'host', name: 'SPIRIT HOST', school: 'calling', lvl: 3, t: 'self', eff: 'buff', buff: 'host', dice: '3d8', dt: 'radiant', dur: 10, conc: true, cls: ['chaplain', 'summoner'], desc: 'Spirits sear all foes each turn.' },
  { id: 'chorus', name: 'CHORUS OF MENDING', school: 'calling', lvl: 3, t: 'allies', eff: 'heal', dice: '1d4', mod: true, bonus: true, cls: ['chaplain', 'cantor'], desc: 'Bonus: heal all 1d4+mod.' },
  { id: 'dreadwave', name: 'DREADWAVE', school: 'veil', lvl: 3, t: 'enemies', eff: 'cond', save: 'WIS', cond: 'frightened', dur: 3, conc: true, cls: ['arcanist', 'wildblood', 'cantor', 'pactbound'], desc: 'All foes WIS save or frightened.' },
  { id: 'calllightning', name: 'CALL LIGHTNING', school: 'calling', lvl: 3, t: 'enemy', eff: 'dmg', save: 'DEX', half: true, dice: '3d10', dt: 'lightning', scale: '1d10', cls: ['verdant'], desc: 'DEX save, 3d10 lightning.' },
  { id: 'truesight', name: 'CLARITY TRANCE', school: 'omen', lvl: 3, t: 'self', eff: 'buff', buff: 'foresight', dur: 5, conc: true, cls: ['arcanist', 'chaplain', 'cantor'], desc: 'Heightened perception and advantage on saves.' },
  // level 4
  { id: 'wither', name: 'WITHERING', school: 'grave', lvl: 4, t: 'enemy', eff: 'dmg', save: 'CON', half: true, dice: '8d8', dt: 'necrotic', scale: '1d8', cls: ['arcanist', 'wildblood', 'verdant', 'pactbound', 'necromancer', 'runeblade'], desc: 'CON save, 8d8 necrotic.' },
  { id: 'beastshape', name: 'BEASTSHAPE', school: 'flux', lvl: 4, t: 'enemy', eff: 'cond', save: 'WIS', cond: 'beast', dur: 2, conc: true, cls: ['arcanist', 'wildblood', 'cantor', 'verdant'], desc: 'WIS save or turned into a newt.' },
  { id: 'hail', name: 'HAILFALL', school: 'storm', lvl: 4, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '6d8', dt: 'cold', cls: ['arcanist', 'wildblood', 'verdant'], desc: 'All foes, DEX save, 6d8 cold.' },
  { id: 'exile', name: 'EXILE', school: 'aegis', lvl: 4, t: 'enemy', eff: 'cond', save: 'CHA', cond: 'banished', dur: 3, conc: true, cls: ['arcanist', 'wildblood', 'chaplain', 'vanguard', 'pactbound'], desc: 'CHA save or banished.' },
  { id: 'trueveil', name: 'TRUE VEIL', school: 'veil', lvl: 4, t: 'self', eff: 'buff', buff: 'trueveil', dur: 10, conc: true, cls: ['arcanist', 'wildblood', 'cantor'], desc: 'Invisible even when attacking.' },
  // level 5
  { id: 'frostcone', name: 'FROST CONE', school: 'storm', lvl: 5, t: 'enemies', eff: 'dmg', save: 'CON', half: true, dice: '8d8', dt: 'cold', scale: '1d8', cls: ['arcanist', 'wildblood'], desc: 'All foes, CON save, 8d8 cold.' },
  { id: 'greatchorus', name: 'GREATER CHORUS', school: 'calling', lvl: 5, t: 'allies', eff: 'heal', dice: '3d8', mod: true, cls: ['chaplain', 'cantor', 'verdant'], desc: 'Heal all 3d8+mod.' },
  { id: 'recall', name: 'RECALL SOUL', school: 'grave', lvl: 5, t: 'ally', eff: 'revive', full: true, cls: ['chaplain', 'cantor', 'vanguard', 'sunwarden'], desc: 'Revive an ally at half HP.' },
  { id: 'yoke', name: 'MIND YOKE', school: 'thrall', lvl: 5, t: 'enemy', eff: 'cond', save: 'WIS', cond: 'dominated', dur: 3, conc: true, cls: ['arcanist', 'wildblood', 'cantor'], desc: 'WIS save or it fights for you.' },
  { id: 'pillar', name: 'PILLAR OF DAWN', school: 'storm', lvl: 5, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '8d6', dt: 'radiant', cls: ['chaplain', 'sunwarden'], desc: 'All foes, DEX save, 8d6 radiant.' },
  { id: 'bastion', name: 'DAWN BASTION', school: 'aegis', lvl: 5, t: 'allies', eff: 'buff', buff: 'barrier', val: 30, dur: 5, conc: true, cls: ['chaplain', 'vanguard', 'arcanist'], desc: '30 HP barrier shields all allies.' },
  { id: 'threadcount', name: 'FATE WEAVE', school: 'omen', lvl: 5, t: 'enemies', eff: 'cond', save: 'CHA', cond: 'marked', dur: 5, cls: ['cantor', 'arcanist', 'chaplain'], desc: 'CHA save: all foes take +2d8 radiant.' },
  { id: 'timestop', name: 'TEMPORAL DRIFT', school: 'flux', lvl: 5, t: 'self', eff: 'buff', buff: 'haste', dur: 3, bonus: true, cls: ['arcanist', 'wildblood'], desc: 'Bends time: extra speed and attacks for 3 rounds.' },
  // level 6-9
  { id: 'stormchain', name: 'STORMCHAIN', school: 'storm', lvl: 6, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '10d8', dt: 'lightning', cls: ['arcanist', 'wildblood'], desc: 'All foes, 10d8 lightning.' },
  { id: 'greatmend', name: 'GREAT MENDING', school: 'calling', lvl: 6, t: 'ally', eff: 'heal', dice: '70', cleanse: true, cls: ['chaplain', 'verdant'], desc: 'Heal 70 and cleanse.' },
  { id: 'unmake', name: 'UNMAKE', school: 'flux', lvl: 6, t: 'enemy', eff: 'dmg', save: 'DEX', dice: '10d6+40', dt: 'force', cls: ['arcanist', 'wildblood'], desc: 'DEX save, 10d6+40 force.' },
  { id: 'deathring', name: 'DEATH RING', school: 'grave', lvl: 6, t: 'enemies', eff: 'dmg', save: 'CON', half: true, dice: '8d6', dt: 'necrotic', cls: ['arcanist', 'wildblood', 'pactbound', 'necromancer'], desc: 'All foes, 8d6 necrotic.' },
  { id: 'doomfinger', name: 'DOOM FINGER', school: 'grave', lvl: 7, t: 'enemy', eff: 'dmg', save: 'CON', half: true, dice: '7d8+30', dt: 'necrotic', cls: ['arcanist', 'wildblood', 'pactbound', 'necromancer'], desc: 'CON save, 7d8+30 necrotic.' },
  { id: 'starshard', name: 'STAR SHARD', school: 'storm', lvl: 7, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '12d6', dt: 'fire', cls: ['arcanist', 'wildblood'], desc: 'All foes, 12d6 fire.' },
  { id: 'renewal', name: 'RENEWAL', school: 'flux', lvl: 7, t: 'ally', eff: 'heal', dice: '4d8+15', regen: true, cls: ['chaplain', 'verdant', 'cantor'], desc: 'Heal 4d8+15, regenerate.' },
  { id: 'spellward', name: 'AURA OF WARDING', school: 'aegis', lvl: 7, t: 'allies', eff: 'buff', buff: 'ac', val: 5, dur: 5, conc: true, cls: ['chaplain', 'vanguard', 'arcanist'], desc: '+5 AC barrier protects party.' },
  { id: 'phantom', name: 'PHANTOM PARADE', school: 'veil', lvl: 7, t: 'enemies', eff: 'cond', save: 'WIS', cond: 'frightened', dur: 3, conc: true, cls: ['cantor', 'arcanist', 'pactbound'], desc: 'All foes WIS save or terrified.' },
  { id: 'noonflare', name: 'NOON FLARE', school: 'storm', lvl: 8, t: 'enemies', eff: 'dmg', save: 'CON', half: true, dice: '12d6', dt: 'radiant', cond: 'blinded', dur: 2, cls: ['chaplain', 'verdant', 'arcanist', 'wildblood', 'sunwarden'], desc: 'All foes, 12d6 radiant + blind.' },
  { id: 'wordstill', name: 'WORD OF STILLNESS', school: 'thrall', lvl: 8, t: 'enemy', eff: 'cond', cond: 'stunned', maxHp: 150, dur: 2, cls: ['arcanist', 'wildblood', 'cantor', 'pactbound'], desc: 'Stun a foe under 150 HP.' },
  { id: 'prismatic', name: 'PRISMATIC AEGIS', school: 'aegis', lvl: 8, t: 'self', eff: 'buff', buff: 'ac', val: 8, dur: 10, cls: ['arcanist'], desc: '+8 AC and immune to lower magic.' },
  { id: 'soulexchange', name: 'SOUL REAP', school: 'grave', lvl: 8, t: 'enemies', eff: 'dmg', save: 'CON', half: true, dice: '10d8', dt: 'necrotic', scale: '1d8', cls: ['arcanist', 'pactbound', 'chaplain', 'necromancer'], desc: 'All foes, 10d8 necrotic.' },
  { id: 'metamorph', name: 'TRUE TRANSMUTE', school: 'flux', lvl: 8, t: 'enemy', eff: 'cond', save: 'WIS', cond: 'beast', dur: 5, conc: true, cls: ['arcanist', 'verdant'], desc: 'WIS save or permanently polymorphed.' },
  { id: 'skyfall', name: 'SKYFALL', school: 'storm', lvl: 9, t: 'enemies', eff: 'dmg', save: 'DEX', half: true, dice: '40d6', dt: 'fire', cls: ['arcanist', 'wildblood'], desc: 'All foes, 40d6 fire and stone.' },
  { id: 'wordend', name: 'WORD OF ENDING', school: 'thrall', lvl: 9, t: 'enemy', eff: 'kill', maxHp: 100, cls: ['arcanist', 'wildblood', 'cantor', 'pactbound'], desc: 'Slay a foe under 100 HP.' },
  { id: 'worldsong', name: 'WORLDSONG', school: 'calling', lvl: 9, t: 'allies', eff: 'heal', dice: '200', cleanse: true, cls: ['chaplain'], desc: 'Heal all fully, cleanse.' },
  { id: 'foresight', name: 'FORESIGHT', school: 'omen', lvl: 9, t: 'ally', eff: 'buff', buff: 'foresight', dur: 20, cls: ['arcanist', 'cantor', 'verdant', 'pactbound'], desc: 'Advantage on everything.' },
];

// ---------------------------------------------------------------- monsters
// a: attacks [name, toHit, dice, type, extra]; multi = attacks per turn; abil scores; tr = traits
const MONSTERS = {
  // CR 1/8 - 1 (Elderwood, Hollowmere)
  bogslime: { name: 'BOG SLIME', spr: 'enemy_slime', cr: 0.125, ac: 8, hp: '3d8+3', ab: [12, 6, 14, 2, 6, 1], a: [['PSEUDOPOD', 3, '1d6+1', 'bludgeoning']], res: ['acid'], type: 'ooze', drop: 'slimegel' },
  marshgob: { name: 'MARSH GOBLIN', spr: 'enemy_goblin', cr: 0.25, ac: 13, hp: '2d6', ab: [8, 14, 10, 10, 8, 8], a: [['CRESCENT', 4, '1d6+2', 'slashing']], tr: ['nimble'], type: 'humanoid', drop: 'goblin_token' },
  duskbat: { name: 'DUSK BAT', spr: 'enemy_bat', cr: 0.125, ac: 12, hp: '1d6+2', ab: [4, 15, 11, 2, 12, 4], a: [['BITE', 4, '1d4+2', 'piercing']], type: 'beast' },
  bandit: { name: 'ROAD BANDIT', spr: 'villager_4', cr: 0.125, ac: 12, hp: '2d8+2', ab: [11, 12, 12, 10, 10, 10], a: [['CRESCENT', 3, '1d6+1', 'slashing']], type: 'humanoid', drop: 'coinpurse' },
  cultist: { name: 'LANTERN APOSTATE', spr: 'elder_4', cr: 0.125, ac: 12, hp: '2d8', ab: [11, 12, 10, 10, 11, 10], a: [['KNIFE', 3, '1d4+1', 'piercing']], type: 'humanoid' },
  hollowing: { name: 'HOLLOW-WING', spr: 'enemy_bigbat', cr: 0.25, ac: 13, hp: '4d10', ab: [15, 16, 11, 2, 12, 6], a: [['BITE', 4, '1d6+2', 'piercing']], type: 'beast' },
  hexer: { name: 'GOBLIN HEXER', spr: 'enemy_imp', cr: 0.5, ac: 13, hp: '4d6', ab: [8, 14, 10, 12, 10, 14], a: [['HEX RAY', 4, '2d6', 'fire']], ranged: true, type: 'humanoid', drop: 'goblin_token' },
  brute: { name: 'TUSKED BRUTE', spr: 'enemy_orc', cr: 0.5, ac: 13, hp: '2d8+6', ab: [16, 12, 16, 7, 11, 10], a: [['GREATAXE', 5, '1d12+3', 'slashing']], type: 'humanoid' },
  fenscale: { name: 'FENSCALE', spr: 'enemy_lizard', cr: 0.5, ac: 15, hp: '4d8+4', ab: [15, 10, 13, 7, 12, 7], multi: 2, a: [['BITE', 4, '1d6+2', 'piercing'], ['SPEAR', 4, '1d6+2', 'piercing', { cond: 'poisoned', save: 'CON', dc: 11 }]], type: 'humanoid' },
  ghoul: { name: 'DUNE GHOUL', spr: 'enemy_ghoul', cr: 1, ac: 12, hp: '5d8', ab: [13, 15, 10, 7, 10, 6], a: [['CLAWS', 4, '2d4+2', 'slashing', { cond: 'paralyzed', save: 'CON', dc: 10, dur: 1 }]], imm: ['poison'], type: 'undead' },
  ooze: { name: 'GILDED OOZE', spr: 'enemy_goldslime', cr: 1, ac: 14, hp: '6d8+12', ab: [14, 8, 15, 2, 6, 1], a: [['SLAM', 4, '2d6+2', 'bludgeoning']], res: ['acid'], type: 'ooze', drop: 'gold_dust' },
  wolf: { name: 'GREY WOLF', spr: 'e_ash_hollowing', cr: 0.25, ac: 13, hp: '2d8+2', ab: [12, 15, 12, 3, 12, 6], a: [['BITE', 4, '2d4+2', 'piercing', { cond: 'prone', save: 'STR', dc: 11 }]], tr: ['pack'], type: 'beast' },
  // CR 2-5
  sentry: { name: 'KEEP SENTRY', spr: 'enemy_spearorc', cr: 2, ac: 16, hp: '6d8+12', ab: [16, 12, 14, 8, 11, 9], multi: 2, a: [['SPEAR', 5, '1d8+3', 'piercing']], type: 'humanoid' },
  warchanter: { name: 'WARCHANTER', spr: 'e_ember_imp', cr: 2, ac: 13, hp: '6d6+6', ab: [10, 14, 12, 12, 13, 16], a: [['FLAME HEX', 5, '3d6', 'fire']], spells: ['dread'], ranged: true, type: 'humanoid' },
  captain: { name: 'BANDIT CAPTAIN', spr: 'hero_3', cr: 2, ac: 15, hp: '10d8+20', ab: [15, 16, 14, 14, 11, 14], multi: 3, a: [['CRESCENT', 5, '1d6+3', 'slashing']], type: 'humanoid', drop: 'coinpurse' },
  sandbone: { name: 'SANDBONE', spr: 'enemy_skeleton', cr: 2, ac: 14, hp: '6d8+12', ab: [14, 14, 15, 6, 8, 5], multi: 2, a: [['SCIMITAR', 4, '1d6+2', 'slashing']], vuln: ['bludgeoning'], imm: ['poison'], type: 'undead', drop: 'old_bone' },
  dead: { name: 'RAVENOUS DEAD', spr: 'enemy_zombie', cr: 2, ac: 8, hp: '9d8+27', ab: [13, 6, 16, 3, 6, 5], a: [['SLAM', 4, '1d8+2', 'bludgeoning', { cond: 'poisoned', save: 'CON', dc: 12 }]], imm: ['poison'], tr: ['fortitude'], type: 'undead' },
  gargoyle: { name: 'SPIRE GARGOYLE', spr: 'enemy_gargoyle', cr: 2, ac: 15, hp: '7d8+21', ab: [15, 11, 16, 6, 11, 7], multi: 2, a: [['CLAW', 4, '1d6+2', 'slashing']], res: ['bph'], type: 'construct' },
  icegob: { name: 'RIME GOBLIN', spr: 'e_frost_goblin', cr: 1, ac: 14, hp: '6d6+6', ab: [10, 15, 12, 10, 8, 8], multi: 2, a: [['ICE SPEAR', 4, '1d6+2', 'cold']], res: ['cold'], type: 'humanoid' },
  emberimp: { name: 'EMBER IMP', spr: 'e_ember_imp', cr: 3, ac: 14, hp: '8d8+16', ab: [8, 16, 14, 12, 12, 14], a: [['FIRE BOLT', 6, '3d8', 'fire']], imm: ['fire'], ranged: true, type: 'fiend' },
  troll: { name: 'BOG TROLL', spr: 'e_venom_goblinking', cr: 5, ac: 15, hp: '8d10+40', ab: [18, 13, 20, 7, 9, 7], multi: 3, a: [['BITE', 7, '1d6+4', 'piercing'], ['CLAW', 7, '2d6+4', 'slashing']], tr: ['regen'], vuln: ['fire'], type: 'giant' },
  wraith: { name: 'DUST WRAITH', spr: 'enemy_wraith', cr: 5, ac: 13, hp: '9d8+27', ab: [6, 16, 16, 12, 14, 15], a: [['LIFE DRAIN', 6, '4d8+3', 'necrotic', { drain: true }]], res: ['bph'], imm: ['poison', 'necrotic'], type: 'undead' },
  frostwyrm: { name: 'FROST WYRMLING', spr: 'e_frost_lizard', cr: 4, ac: 17, hp: '10d8+30', ab: [17, 10, 17, 10, 11, 12], multi: 2, a: [['BITE', 5, '2d6+3', 'piercing'], ['FROST BREATH', 0, '5d8', 'cold', { save: 'CON', dc: 13, aoe: true, recharge: 5 }]], imm: ['cold'], type: 'dragon' },
  jungler: { name: 'VINE STALKER', spr: 'e_venom_lizard', cr: 3, ac: 15, hp: '8d8+16', ab: [15, 16, 14, 6, 14, 7], multi: 2, a: [['FANG', 5, '1d8+3', 'piercing', { cond: 'poisoned', save: 'CON', dc: 13 }]], type: 'beast' },
  crystalgolem: { name: 'CRYSTAL GOLEM', spr: 'e_frost_gargoyle', cr: 6, ac: 17, hp: '11d10+44', ab: [19, 9, 18, 3, 10, 1], multi: 2, a: [['SLAM', 7, '2d8+4', 'bludgeoning']], imm: ['poison', 'psychic'], res: ['bph'], tr: ['magicres'], type: 'construct' },
  // CR 6-13
  ashghoul: { name: 'ASH GHAST', spr: 'e_ash_ghoul', cr: 6, ac: 14, hp: '12d8+24', ab: [16, 17, 14, 11, 10, 8], multi: 2, a: [['CLAWS', 6, '2d6+3', 'slashing', { cond: 'paralyzed', save: 'CON', dc: 13, dur: 1 }]], imm: ['poison'], type: 'undead' },
  bonecolossus: { name: 'BONE COLOSSUS', spr: 'e_ash_skeleton', cr: 8, ac: 16, hp: '15d10+60', ab: [21, 9, 19, 5, 10, 6], multi: 2, a: [['GREATCLUB', 8, '3d8+5', 'bludgeoning']], vuln: ['bludgeoning'], imm: ['poison'], type: 'undead' },
  shadowknight: { name: 'DUSK KNIGHT', spr: 'e_shadow_spearorc', cr: 9, ac: 18, hp: '16d8+48', ab: [20, 11, 16, 12, 13, 15], multi: 3, a: [['DARK BLADE', 9, '2d6+5', 'slashing', { extra: '2d8', etype: 'necrotic' }]], res: ['necrotic'], type: 'humanoid' },
  voidwraith: { name: 'VOID WRAITH', spr: 'e_shadow_wraith', cr: 10, ac: 15, hp: '18d8+54', ab: [8, 18, 17, 14, 16, 17], multi: 2, a: [['VOID TOUCH', 9, '4d10', 'necrotic', { drain: true }]], spells: ['dreadwave'], res: ['bph'], imm: ['poison', 'necrotic'], type: 'undead' },
  lavagolem: { name: 'MAGMA BRUTE', spr: 'e_ember_gargoyle', cr: 11, ac: 17, hp: '17d10+85', ab: [22, 9, 20, 3, 11, 1], multi: 2, a: [['MOLTEN FIST', 10, '3d10+6', 'fire']], imm: ['fire', 'poison'], vuln: ['cold'], type: 'construct' },
  // rare elites
  razorfang: { name: 'RAZORFANG', spr: 'e_gilded_lizard', cr: 3, ac: 15, hp: '10d8+20', ab: [17, 14, 15, 8, 12, 8], multi: 2, a: [['BITE', 6, '1d8+3', 'piercing', { cond: 'poisoned', save: 'CON', dc: 13 }]], rare: true, scale: 1.25, type: 'beast' },
  sandscourge: { name: 'SANDSCOURGE', spr: 'enemy_goldslime', cr: 6, ac: 15, hp: '14d10+42', ab: [19, 8, 17, 2, 8, 1], multi: 2, a: [['ENGULF', 7, '3d8+4', 'acid']], rare: true, scale: 1.7, type: 'ooze' },
  // bosses (legendary: actions per round; abilities by name)
  grimtusk: { name: 'GRIMTUSK', spr: 'enemy_spearorc', cr: 4, ac: 17, hp: '12d8+36', ab: [18, 12, 16, 9, 11, 12], multi: 2, a: [['WAR SPEAR', 6, '2d6+4', 'piercing'], ['SKULL SMASH', 0, '4d10', 'bludgeoning', { save: 'STR', dc: 14, recharge: 5, aoe: true }]], boss: true, scale: 1.2, type: 'humanoid' },
  goblinking: { name: 'KING GRUK', spr: 'enemy_goblinking', cr: 5, ac: 17, hp: '15d8+45', ab: [19, 14, 16, 12, 12, 16], multi: 3, a: [['IRON CLEAVER', 7, '1d10+4', 'slashing']], boss: true, legendary: 2, summon: 'marshgob', scale: 1.15, type: 'humanoid' },
  matriarch: { name: 'STONE MATRIARCH', spr: 'enemy_gargoyle', cr: 12, ac: 18, hp: '20d10+80', ab: [22, 10, 19, 8, 14, 10], multi: 3, a: [['CLAW', 10, '2d8+6', 'slashing'], ['STONE GAZE', 0, '4d8', 'bludgeoning', { save: 'CON', dc: 17, cond: 'restrained', aoe: true, recharge: 5 }]], res: ['bph'], boss: true, legendary: 3, scale: 1.35, type: 'construct' },
  lichlord: { name: 'VAEL MORROW', spr: 'enemy_wraith', cr: 17, ac: 17, hp: '22d8+110', ab: [11, 16, 20, 21, 14, 18], multi: 2, a: [['CHILL TOUCH', 12, '3d6+5', 'cold', { cond: 'paralyzed', save: 'CON', dc: 18, dur: 1 }]], spells: ['deathring', 'dreadwave', 'stormchain', 'wordstill'], imm: ['poison', 'necrotic'], res: ['bph', 'cold'], tr: ['magicres', 'legres'], boss: true, legendary: 3, summon: 'sandbone', scale: 1.4, type: 'undead' },
  emberlord: { name: 'PYRRHAX', spr: 'e_ember_goblinking', cr: 14, ac: 19, hp: '18d12+90', ab: [24, 10, 22, 12, 14, 16], multi: 3, a: [['FLAME AXE', 11, '3d8+7', 'fire'], ['FIRESTORM', 0, '10d6', 'fire', { save: 'DEX', dc: 18, aoe: true, recharge: 5 }]], imm: ['fire'], boss: true, legendary: 3, scale: 1.4, type: 'fiend' },
  frostqueen: { name: 'QUEEN ISVARA', spr: 'e_frost_wraith', cr: 15, ac: 18, hp: '20d10+100', ab: [18, 16, 20, 18, 16, 20], multi: 2, a: [['ICE LANCE', 11, '4d10', 'cold'], ['BLIZZARD', 0, '9d8', 'cold', { save: 'CON', dc: 18, aoe: true, recharge: 5 }]], imm: ['cold'], tr: ['legres'], boss: true, legendary: 3, scale: 1.4, type: 'fey' },
  duskking: { name: 'THE DUSK KING', spr: 'e_shadow_goblinking', cr: 22, ac: 21, hp: '28d12+168', ab: [26, 14, 24, 20, 18, 24], multi: 3, a: [['NIGHTFALL', 14, '4d10+8', 'necrotic', { drain: true }], ['ECLIPSE', 0, '16d6', 'necrotic', { save: 'CON', dc: 21, aoe: true, recharge: 5 }]], spells: ['dreadwave', 'wordstill', 'deathring'], imm: ['necrotic', 'poison'], res: ['bph'], tr: ['magicres', 'legres'], boss: true, legendary: 3, summon: 'shadowknight', scale: 1.5, type: 'fiend' },
};
