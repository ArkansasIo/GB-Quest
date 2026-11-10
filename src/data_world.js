// LOST KINGDOM OF SHADOWBANE CHRONICLES — world data for AELMOOR: attributes, buffs, difficulty, zones, story,
// creature families, boss naming, quests, factions, achievements, music.
'use strict';

// ================================================================ 9 attributes, stats, substats
// The six classic scores plus LUCK, WILL and SPEED. Modifier = floor((score-10)/2).
const ATTRS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'LCK', 'WIL', 'SPD'];
const ATTR_DESC = {
  STR: 'Melee hits, carrying, ATHLETICS.', DEX: 'Aim, AC, initiative, finesse.', CON: 'Hit points, endurance, concentration.',
  INT: 'Arcane power, lore, investigation.', WIS: 'Divine power, perception, insight.', CHA: 'Presence, pacts, persuasion.',
  LCK: 'Crit chance, rerolls, magic find.', WIL: 'Resist conditions, death saves.', SPD: 'Initiative, extra turns, fleeing.',
};
// substats come from gear affixes and ascension points (all in %, except flat ones)
const SUBSTATS = {
  crit: { name: 'CRIT CHANCE', unit: '%', max: 50 }, critdmg: { name: 'CRIT DAMAGE', unit: '%', max: 300 },
  dodge: { name: 'DODGE', unit: '%', max: 40 }, block: { name: 'BLOCK', unit: '%', max: 40 },
  leech: { name: 'LIFESTEAL', unit: '%', max: 20 }, haste: { name: 'HASTE', unit: '%', max: 50 },
  dmg: { name: 'DAMAGE', unit: '%', max: 500 }, heal: { name: 'HEALING', unit: '%', max: 200 },
  resist: { name: 'RESIST ALL', unit: '%', max: 60 }, thorns: { name: 'THORNS', unit: '', max: 9999 },
  mf: { name: 'MAGIC FIND', unit: '%', max: 400 }, gf: { name: 'GOLD FIND', unit: '%', max: 400 },
  xp: { name: 'XP BONUS', unit: '%', max: 200 }, hp: { name: 'MAX HP', unit: '', max: 99999 },
  acb: { name: 'ARMOUR', unit: '', max: 30 }, hit: { name: 'ACCURACY', unit: '', max: 30 },
  fire: { name: 'FIRE DMG', unit: '%', max: 300 }, cold: { name: 'COLD DMG', unit: '%', max: 300 },
  lightning: { name: 'SHOCK DMG', unit: '%', max: 300 }, necrotic: { name: 'SHADOW DMG', unit: '%', max: 300 },
  radiant: { name: 'HOLY DMG', unit: '%', max: 300 },
};
const AFFIX_POOL = ['crit', 'critdmg', 'dodge', 'block', 'leech', 'haste', 'dmg', 'heal', 'resist', 'thorns', 'mf', 'gf', 'xp', 'hp', 'acb', 'hit', 'fire', 'cold', 'lightning', 'necrotic', 'radiant'];

// ================================================================ level system 1-720
const LEVEL_CAP = 720;
const CLASS_LEVEL_CAP = 20; // class features stop at 20; levels 21+ are ASCENSION levels
// SPELL LEVELS 1-9 ACROSS 1-720: the character level a full caster first casts each spell level (5e: 1,3,5..17).
// The curve is quadratic, so early spell levels come quickly and 9th level spells arrive at 720.
const SPELL_UNLOCK = [1, 12, 46, 102, 181, 282, 406, 552, 720];
const SPELL_UNLOCK_5E = [1, 3, 5, 7, 9, 11, 13, 15, 17];
// 5e caster level (1-17) a character level stands for in the slot tables: straight lines between the unlock points
function spellCasterLevel(L) {
  L = Math.max(1, Math.min(LEVEL_CAP, Math.floor(Number(L) || 1)));
  for (let k = 1; k < SPELL_UNLOCK.length; k++) if (L < SPELL_UNLOCK[k]) {
    const a = SPELL_UNLOCK[k - 1], b = SPELL_UNLOCK[k];
    return SPELL_UNLOCK_5E[k - 1] + Math.floor((L - a) * (SPELL_UNLOCK_5E[k] - SPELL_UNLOCK_5E[k - 1]) / (b - a));
  }
  return SPELL_UNLOCK_5E[SPELL_UNLOCK_5E.length - 1];
}
function xpForLevel(l) { // total XP needed to reach level l
  if (l <= 20) return XP_TABLE[l - 1];
  const a = l - 20; return 355000 + Math.round(30000 * a + 900 * a * a + 2.2 * a * a * a);
}
const ASCENSION = { attrPerLevel: 1, subPerLevel: 2, boonEvery: 50 };
// Four talent points arrive at levels 5, 10, 15 and 20.
// Each path is a four-step progression with readable, stack-free bonuses.
const TALENT_TREES = [
  { id: 'vanguard', name: 'VANGUARD', nodes: [
    { id: 'vanguard_vitality', name: 'HARDENED', level: 5, desc: '+10 maximum HP.', mods: { hp: 10 } },
    { id: 'vanguard_guard', name: 'IRON GUARD', level: 10, requires: 'vanguard_vitality', desc: '+2 armour.', mods: { acb: 2 } },
    { id: 'vanguard_endure', name: 'ENDURE', level: 15, requires: 'vanguard_guard', desc: '+5% resistance to all damage.', mods: { resist: 5 } },
    { id: 'vanguard_fortress', name: 'FORTRESS', level: 20, requires: 'vanguard_endure', desc: '+10% maximum HP.', mods: { hpPct: 10 } },
  ] },
  { id: 'ranger', name: 'RANGER', nodes: [
    { id: 'ranger_aim', name: 'STEADY AIM', level: 5, desc: '+2 weapon accuracy.', mods: { hit: 2 } },
    { id: 'ranger_footwork', name: 'QUICK FOOTWORK', level: 10, requires: 'ranger_aim', desc: '+3% dodge chance.', mods: { dodge: 3 } },
    { id: 'ranger_critical', name: 'FIND THE GAP', level: 15, requires: 'ranger_footwork', desc: '+3% critical chance.', mods: { crit: 3 } },
    { id: 'ranger_haste', name: 'SWIFT STRIKE', level: 20, requires: 'ranger_critical', desc: '+5% haste.', mods: { haste: 5 } },
  ] },
  { id: 'arcanist', name: 'ARCANIST', nodes: [
    { id: 'arcanist_flame', name: 'EMBER LORE', level: 5, desc: '+10% fire damage.', mods: { fire: 10 } },
    { id: 'arcanist_storm', name: 'STORM LORE', level: 10, requires: 'arcanist_flame', desc: '+10% lightning damage.', mods: { lightning: 10 } },
    { id: 'arcanist_focus', name: 'ARCANE FOCUS', level: 15, requires: 'arcanist_storm', desc: '+5% damage.', mods: { dmg: 5 } },
    { id: 'arcanist_mending', name: 'WELLSPRING', level: 20, requires: 'arcanist_focus', desc: '+10% healing.', mods: { heal: 10 } },
  ] },
];
const MYTHIC_BOONS = [
  { id: 'b_vigor', name: 'MYTHIC VIGOR', desc: '+10% max HP', sub: { hp: 0, hpPct: 10 } },
  { id: 'b_fury', name: 'MYTHIC FURY', desc: '+15% damage', sub: { dmg: 15 } },
  { id: 'b_ward', name: 'MYTHIC WARD', desc: '+2 AC', sub: { acb: 2 } },
  { id: 'b_fortune', name: 'MYTHIC FORTUNE', desc: '+50% magic find', sub: { mf: 50 } },
  { id: 'b_swift', name: 'MYTHIC SPEED', desc: '+10% haste', sub: { haste: 10 } },
  { id: 'b_edge', name: 'MYTHIC EDGE', desc: '+5% crit', sub: { crit: 5 } },
  { id: 'b_mend', name: 'MYTHIC MENDING', desc: '+25% healing', sub: { heal: 25 } },
];

// ================================================================ buffs & debuffs
// mods: substat/attr deltas while active. tick: per-turn dmg/heal (as % max HP or dice). stack: max stacks
const BUFFS = {
  // buffs
  bless: { name: 'BLESSED', good: true, mods: { hit: 2, saves: 2 }, desc: '+1d4 attacks and saves.' },
  haste: { name: 'HASTED', good: true, mods: { acb: 2, extraAttack: 1, haste: 25 } },
  regen: { name: 'REGENERATING', good: true, tick: { healPct: 6 } },
  fortify: { name: 'FORTIFIED', good: true, mods: { resist: 25 } },
  might: { name: 'MIGHTY', good: true, mods: { dmg: 15 } },
  fed: { name: 'WELL FED', good: true, mods: { hp: 0, hpPct: 10, saves: 1 } },
  inspired: { name: 'INSPIRED', good: true, mods: { hit: 3, saves: 3 }, oneShot: true },
  rage: { name: 'RAGING', good: true, mods: { dmgFlat: 2, resistPhys: 50 } },
  barrier: { name: 'BARRIER', good: true, shield: true },
  ac: { name: 'WARDED', good: true, mods: { acb: 0 } },
  mirror: { name: 'MIRRORED', good: true, mirror: true },
  host: { name: 'SPIRIT HOST', good: true, aura: true },
  trueveil: { name: 'VEILED', good: true, mods: { attackAdv: 1, attackedDis: 1 } },
  foresight: { name: 'FORESIGHT', good: true, mods: { attackAdv: 1, attackedDis: 1, saveAdv: 1 } },
  frenzy: { name: 'FRENZIED', good: true, mods: { haste: 30, dmg: 10 }, stack: 3 },
  focus: { name: 'FOCUSED', good: true, mods: { crit: 15 } },
  thornskin: { name: 'THORNSKIN', good: true, mods: { thorns: 6 } },
  wildshape: { name: 'BEASTSHAPE', good: true, shield: true },
  // debuffs
  burning: { name: 'BURNING', tick: { dice: '1d6', type: 'fire' }, stack: 5 },
  bleeding: { name: 'BLEEDING', tick: { dice: '1d4', type: 'slashing' }, stack: 5 },
  venom: { name: 'ENVENOMED', tick: { dice: '1d6', type: 'poison' }, stack: 5 },
  frostbite: { name: 'FROSTBITTEN', mods: { haste: -25, acb: -1 }, stack: 3 },
  shocked: { name: 'SHOCKED', mods: { dodge: -10 }, takenPct: 10 },
  weakened: { name: 'WEAKENED', mods: { dmg: -25 } },
  vulnerable: { name: 'VULNERABLE', takenPct: 25 },
  sundered: { name: 'SUNDERED', mods: { acb: -2 }, stack: 3 },
  slowed: { name: 'SLOWED', mods: { haste: -50, acb: -2 } },
  doomed: { name: 'DOOMED', mods: { saves: -2, hit: -2 } },
  bane: { name: 'BANED', mods: { hit: -2, saves: -2 } },
};

// ================================================================ difficulty 1-9 (applies to world, dungeons, raids, trials, tower)
const DIFFICULTY = [
  { n: 1, name: 'STORY', lvl: 0, hp: 0.7, dmg: 0.6, xp: 0.8, loot: 0.8 },
  { n: 2, name: 'NORMAL', lvl: 0, hp: 1, dmg: 1, xp: 1, loot: 1 },
  { n: 3, name: 'HARD', lvl: 2, hp: 1.25, dmg: 1.15, xp: 1.25, loot: 1.25, req: 10 },
  { n: 4, name: 'VETERAN', lvl: 6, hp: 1.5, dmg: 1.3, xp: 1.5, loot: 1.5, req: 20 },
  { n: 5, name: 'NIGHTMARE', lvl: 15, hp: 1.8, dmg: 1.5, xp: 2, loot: 2, req: 40 },
  { n: 6, name: 'TORMENT I', lvl: 40, hp: 2.2, dmg: 1.75, xp: 2.5, loot: 2.5, req: 100 },
  { n: 7, name: 'TORMENT II', lvl: 100, hp: 2.7, dmg: 2.0, xp: 3, loot: 3, req: 200 },
  { n: 8, name: 'TORMENT III', lvl: 220, hp: 3.3, dmg: 2.4, xp: 4, loot: 3.5, req: 350 },
  { n: 9, name: 'APOCALYPSE', lvl: 400, hp: 4.0, dmg: 3.0, xp: 5, loot: 4.5, req: 500 },
];

// ================================================================ play modes
const PLAY_MODES = [
  { id: 'solo', name: '1 PLAYER', size: 1, desc: 'Solo with optional NPC companions.' },
  { id: 'party', name: '4 PLAYER', size: 4, desc: 'Party of 4: friends in your room, AI fills the rest.' },
  { id: 'raid', name: '12 PLAYER', size: 12, desc: 'Raid of 12: real players plus AI raiders.' },
];

// ================================================================ the continent of AELMOOR
// grid position on the world map (gx, gy), biome tileset, level band, act
const REGIONS = [
  { id: 'ardenhold', name: 'ARDENHOLD', biome: 'coast', lvl: [1, 720], act: 0, gx: 2, gy: 2, town: true, desc: 'The last free city, hub of the realm.' },
  { id: 'elderwood', name: 'ELDERWOOD', biome: 'meadow', lvl: [1, 4], act: 1, gx: 1, gy: 2, hand: true, exitPos: { E: [31, 8] }, desc: 'Green hills and quiet villages.' },
  { id: 'hollowmere', name: 'HOLLOWMERE', biome: 'marsh', lvl: [4, 7], act: 2, gx: 1, gy: 3, desc: 'Sunken fens where lanterns drowned.' },
  { id: 'thornwood', name: 'THORNWOOD', biome: 'jungle', lvl: [6, 9], act: 3, gx: 0, gy: 2, desc: 'An old forest turned cruel.' },
  { id: 'greypeak', name: 'GREYPEAK PASS', biome: 'snow', lvl: [8, 11], act: 4, gx: 1, gy: 1, desc: 'Stonekin halls under icy peaks.' },
  { id: 'sandspire', name: 'SANDSPIRE', biome: 'badlands', lvl: [10, 13], act: 5, gx: 3, gy: 3, desc: 'Red dunes over a buried crypt.' },
  { id: 'saltreach', name: 'SALTREACH COAST', biome: 'coast', lvl: [12, 15], act: 6, gx: 3, gy: 2, desc: 'Wrecks, smugglers and sea-things.' },
  { id: 'emberwaste', name: 'EMBERWASTE', biome: 'volcanic', lvl: [14, 17], act: 7, gx: 4, gy: 3, desc: 'Rivers of fire beneath ash skies.' },
  { id: 'frostmarch', name: 'FROSTMARCH', biome: 'snow', lvl: [16, 19], act: 8, gx: 2, gy: 1, desc: 'A frozen kingdom ruled by a queen of rime.' },
  { id: 'verdantdeep', name: 'VERDANT DEEP', biome: 'jungle', lvl: [18, 22], act: 9, gx: 0, gy: 3, desc: 'Vine-choked temples of a lost people.' },
  { id: 'ashenbarrows', name: 'ASHEN BARROWS', biome: 'dusk', lvl: [20, 26], act: 10, gx: 3, gy: 1, desc: 'Tombs of the old kings, stirring.' },
  { id: 'silverhaven', name: 'SILVERHAVEN', biome: 'crystal', lvl: [24, 30], act: 11, gx: 4, gy: 1, desc: 'Crystal towers of the far elves.' },
  { id: 'duskmoor', name: 'DUSKMOOR', biome: 'dusk', lvl: [28, 40], act: 12, gx: 4, gy: 0, desc: 'The shadowed land where the sun forgot to rise.' },
];
// biome -> encounter families and terrain recipe
const BIOMES = {
  meadow: { tiles: 'world', fam: ['beast', 'humanoid', 'ooze'], water: 0.18, forest: 0.25, mount: 0.12 },
  coast: { tiles: 'b_coast', fam: ['beast', 'humanoid', 'monstrosity'], water: 0.4, forest: 0.1, mount: 0.08, sand: 0.25 },
  marsh: { tiles: 'b_marsh', fam: ['ooze', 'plant', 'undead', 'beast'], water: 0.35, forest: 0.3, mount: 0.05 },
  jungle: { tiles: 'b_jungle', fam: ['beast', 'plant', 'fey', 'monstrosity'], water: 0.2, forest: 0.5, mount: 0.08 },
  snow: { tiles: 'b_snow', fam: ['giant', 'dragon', 'beast', 'elemental'], water: 0.15, forest: 0.22, mount: 0.25 },
  badlands: { tiles: 'b_badlands', fam: ['undead', 'construct', 'monstrosity', 'humanoid'], water: 0.06, forest: 0.05, mount: 0.18, sand: 0.5 },
  volcanic: { tiles: 'b_volcanic', fam: ['fiend', 'elemental', 'dragon', 'construct'], water: 0.22, forest: 0.08, mount: 0.25 },
  dusk: { tiles: 'b_dusk', fam: ['undead', 'fiend', 'aberration'], water: 0.15, forest: 0.25, mount: 0.18 },
  crystal: { tiles: 'b_crystal', fam: ['fey', 'celestial', 'construct', 'elemental'], water: 0.25, forest: 0.2, mount: 0.15 },
  forest: { tiles: 'b_forest', fam: ['beast', 'plant', 'fey', 'humanoid'], water: 0.16, forest: 0.58, mount: 0.12 },
  deepforest: { tiles: 'b_deepforest', fam: ['beast', 'plant', 'fey', 'aberration'], water: 0.22, forest: 0.72, mount: 0.08 },
  hills: { tiles: 'b_hills', fam: ['beast', 'humanoid', 'giant'], water: 0.12, forest: 0.22, mount: 0.28 },
  mountains: { tiles: 'b_mountains', fam: ['giant', 'dragon', 'elemental', 'construct'], water: 0.08, forest: 0.06, mount: 0.72 },
  desert: { tiles: 'b_desert', fam: ['beast', 'monstrosity', 'undead', 'elemental'], water: 0.02, forest: 0.02, mount: 0.2, sand: 0.78 },
  oasis: { tiles: 'b_oasis', fam: ['beast', 'plant', 'fey'], water: 0.48, forest: 0.3, mount: 0.04, sand: 0.28 },
  savanna: { tiles: 'b_savanna', fam: ['beast', 'humanoid', 'monstrosity'], water: 0.08, forest: 0.12, mount: 0.16 },
  steppe: { tiles: 'b_steppe', fam: ['beast', 'humanoid', 'giant'], water: 0.06, forest: 0.08, mount: 0.18 },
  ruins: { tiles: 'b_ruins', fam: ['undead', 'construct', 'aberration'], water: 0.08, forest: 0.16, mount: 0.12 },
  corruption: { tiles: 'b_corruption', fam: ['undead', 'fiend', 'aberration'], water: 0.18, forest: 0.28, mount: 0.2 },
  aether: { tiles: 'b_aether', fam: ['celestial', 'fey', 'elemental'], water: 0.24, forest: 0.18, mount: 0.22 },
  mushroom: { tiles: 'b_mushroom', fam: ['plant', 'ooze', 'fey'], water: 0.28, forest: 0.46, mount: 0.06 },
  ocean: { tiles: 'b_ocean', fam: ['beast', 'elemental', 'monstrosity'], water: 0.76, forest: 0, mount: 0.04 },
  river: { tiles: 'b_river', fam: ['beast', 'plant', 'monstrosity'], water: 0.52, forest: 0.2, mount: 0.08 },
  frozen: { tiles: 'b_frozen', fam: ['giant', 'dragon', 'undead', 'elemental'], water: 0.24, forest: 0.08, mount: 0.42 },
  sky: { tiles: 'b_sky', fam: ['celestial', 'dragon', 'elemental', 'aberration'], water: 0.18, forest: 0.16, mount: 0.5 },
};
const ZONE_AREAS = ['GLADE', 'CROSSING', 'HOLLOW', 'RIDGE', 'RUINS', 'WATCH', 'FORD', 'BARROW', 'SPRING', 'CAMP', 'SHRINE', 'GATE'];

// ================================================================ creature families -> 400 generated monsters
// each subtype: [name, sprite base, dmg type, role] ; variants add element tint + resist
const FAMILIES = {
  beast: { name: 'BEAST', sub: [['WOLF', 'enemy_bigbat', 'piercing', 'pack'], ['BAT', 'enemy_bat', 'piercing', 'swift'], ['SERPENT', 'enemy_lizard', 'poison', 'venom'], ['BOAR', 'enemy_orc', 'piercing', 'brute'], ['SPIDER', 'enemy_lizard', 'poison', 'venom'], ['HAWK', 'enemy_bat', 'slashing', 'swift'], ['BEAR', 'enemy_goblinking', 'slashing', 'brute']] },
  humanoid: { name: 'HUMANOID', sub: [['GOBLIN', 'enemy_goblin', 'slashing', 'skirm'], ['ORC', 'enemy_orc', 'slashing', 'brute'], ['BANDIT', 'villager_4', 'slashing', 'skirm'], ['APOSTATE', 'elder_4', 'necrotic', 'caster'], ['FENFOLK', 'enemy_lizard', 'piercing', 'skirm'], ['HEXER', 'enemy_imp', 'fire', 'caster'], ['SENTRY', 'enemy_spearorc', 'piercing', 'guard']] },
  undead: { name: 'UNDEAD', sub: [['SKELETON', 'enemy_skeleton', 'slashing', 'guard'], ['ZOMBIE', 'enemy_zombie', 'bludgeoning', 'brute'], ['GHOUL', 'enemy_ghoul', 'slashing', 'skirm'], ['WRAITH', 'enemy_wraith', 'necrotic', 'caster'], ['BONEHULK', 'enemy_skeleton', 'bludgeoning', 'brute']] },
  fiend: { name: 'FIEND', sub: [['IMP', 'enemy_imp', 'fire', 'caster'], ['HELLHOUND', 'enemy_bigbat', 'fire', 'pack'], ['TORMENTOR', 'enemy_goblinking', 'slashing', 'brute'], ['SHADE', 'enemy_wraith', 'necrotic', 'caster']] },
  fey: { name: 'FEY', sub: [['SPRITE', 'enemy_bat', 'psychic', 'swift'], ['THORNLING', 'enemy_imp', 'piercing', 'skirm'], ['HAG', 'elder_5', 'psychic', 'caster'], ['SATYR', 'enemy_goblin', 'bludgeoning', 'skirm']] },
  elemental: { name: 'ELEMENTAL', sub: [['MEPHIT', 'enemy_imp', 'fire', 'swift'], ['GEODE', 'enemy_gargoyle', 'bludgeoning', 'guard'], ['GALE', 'enemy_wraith', 'lightning', 'caster'], ['MAGMIN', 'enemy_slime', 'fire', 'brute']] },
  construct: { name: 'CONSTRUCT', sub: [['GARGOYLE', 'enemy_gargoyle', 'slashing', 'guard'], ['GOLEM', 'enemy_gargoyle', 'bludgeoning', 'brute'], ['ANIMATED ARMOUR', 'hero_3', 'slashing', 'guard']] },
  dragon: { name: 'DRAGON', sub: [['WYRMLING', 'enemy_lizard', 'fire', 'brute'], ['DRAKE', 'enemy_lizard', 'slashing', 'skirm'], ['WYVERN', 'enemy_bigbat', 'poison', 'venom']] },
  giant: { name: 'GIANT', sub: [['OGRE', 'enemy_goblinking', 'bludgeoning', 'brute'], ['TROLL', 'enemy_goblinking', 'slashing', 'brute'], ['FROST GIANT', 'enemy_spearorc', 'cold', 'brute']] },
  ooze: { name: 'OOZE', sub: [['SLIME', 'enemy_slime', 'acid', 'brute'], ['JELLY', 'enemy_goldslime', 'acid', 'guard'], ['PUDDING', 'enemy_slime', 'acid', 'brute']] },
  aberration: { name: 'ABERRATION', sub: [['GAZER', 'enemy_gargoyle', 'psychic', 'caster'], ['MINDWORM', 'enemy_lizard', 'psychic', 'caster'], ['VOIDSPAWN', 'enemy_wraith', 'force', 'brute']] },
  monstrosity: { name: 'MONSTROSITY', sub: [['CHIMERA', 'enemy_goblinking', 'fire', 'brute'], ['BASILISK', 'enemy_lizard', 'poison', 'guard'], ['HARPY', 'enemy_bigbat', 'slashing', 'swift'], ['CRAB', 'enemy_slime', 'bludgeoning', 'guard']] },
  plant: { name: 'PLANT', sub: [['BLIGHT', 'enemy_zombie', 'piercing', 'skirm'], ['MYCONID', 'enemy_slime', 'poison', 'caster'], ['TREANT', 'enemy_goblinking', 'bludgeoning', 'brute']] },
  celestial: { name: 'CELESTIAL', sub: [['LANTERN SPIRIT', 'enemy_wraith', 'radiant', 'caster'], ['HALO KNIGHT', 'hero_2', 'radiant', 'guard']] },
};
// element variants (tint suffix in assets e_<tint>_<enemy>)
const VARIANTS = [
  { id: '', name: '', tint: null }, { id: 'ember', name: 'EMBER', tint: 'ember', dt: 'fire', res: 'fire' },
  { id: 'frost', name: 'RIME', tint: 'frost', dt: 'cold', res: 'cold' }, { id: 'venom', name: 'BLIGHTED', tint: 'venom', dt: 'poison', res: 'poison' },
  { id: 'shadow', name: 'DUSK', tint: 'shadow', dt: 'necrotic', res: 'necrotic' }, { id: 'gilded', name: 'GILDED', tint: 'gilded', dt: 'radiant', res: 'radiant' },
  { id: 'ash', name: 'ASHEN', tint: 'ash', dt: 'fire', res: 'fire' },
];
const RANKS = [
  { id: 'whelp', name: '', hp: 0.6, dmg: 0.6, lvl: -1 }, { id: 'normal', name: '', hp: 1, dmg: 1, lvl: 0 },
  { id: 'brute', name: 'BRUTE', hp: 1.5, dmg: 1.2, lvl: 1 }, { id: 'elite', name: 'ELITE', hp: 2.2, dmg: 1.4, lvl: 2, elite: true },
];
const ROLE_PROFILE = { pack: { hp: 0.8, dmg: 1.0, ac: 0, multi: 1 }, swift: { hp: 0.7, dmg: 0.9, ac: 1, multi: 2 }, venom: { hp: 0.9, dmg: 0.9, ac: 0, multi: 1, cond: 'venom' },
  brute: { hp: 1.3, dmg: 1.2, ac: -1, multi: 1 }, skirm: { hp: 0.9, dmg: 1.0, ac: 1, multi: 2 }, caster: { hp: 0.75, dmg: 1.2, ac: -1, multi: 1, ranged: true }, guard: { hp: 1.2, dmg: 0.9, ac: 2, multi: 2 } };
const LORE_BITS = {
  beast: 'It hunts by scent and moonlight.', humanoid: 'It serves a warband that answers to a crown of rust.',
  undead: 'It remembers a name, but not its own.', fiend: 'It crawled up from the ember rifts.', fey: 'It keeps bargains, but never fair ones.',
  elemental: 'A storm given hunger.', construct: 'Built for a war long finished.', dragon: 'Young, proud and very hungry.',
  giant: 'It counts villages the way you count coins.', ooze: 'It digests anything that stays still.',
  aberration: 'It thinks thoughts from outside the sky.', monstrosity: 'A creature stitched from nightmares.',
  plant: 'Roots that learned to walk.', celestial: 'A guardian whose oath has curdled.',
};

// ================================================================ bosses: 350 generated + handmade arc bosses
const BOSS_SYL = { a: ['GR', 'VA', 'MOR', 'KH', 'ZE', 'TH', 'BRA', 'SKA', 'OR', 'UL', 'DRE', 'NYX', 'AZ', 'FEL', 'RAK', 'SIL'], b: ['UK', 'EL', 'ATH', 'ORN', 'IX', 'AR', 'OTH', 'ESS', 'UL', 'YN', 'AX', 'OM'] };
const BOSS_TITLES = ['THE UNBROKEN', 'OF THE PIT', 'THE HOLLOW', 'BONEREAVER', 'THE DROWNED', 'STORMCALLER', 'THE GILDED', 'NIGHTMAW', 'THE PALE', 'IRONHIDE', 'THE ASHEN', 'SKYRENDER', 'THE WEEPING', 'DOOMSPEAKER', 'THE ELDER', 'VOIDBORN'];
const BOSS_MECHS = ['enrage', 'summon', 'aoe', 'drain', 'shield', 'phase', 'reflect', 'curse', 'regen', 'frenzy'];
const BOSS_MECH_DESC = { enrage: 'Enrages at 30% HP.', summon: 'Calls minions.', aoe: 'Sweeping attacks hit everyone.', drain: 'Heals from wounds dealt.',
  shield: 'Raises a barrier.', phase: 'Grows stronger at half HP.', reflect: 'Thorns punish attackers.', curse: 'Curses heroes.', regen: 'Regenerates.', frenzy: 'Attacks faster over time.' };
// act (arc) bosses — handmade
const ARC_BOSSES = [
  { act: 1, id: 'goblinking', title: 'KING OF THE KEEP' }, { act: 2, id: 'troll', title: 'THE MIRE MOTHER', name: 'GRANDMA SILT' },
  { act: 3, id: 'jungler', title: 'THE THORN CROWN', name: 'BRIARQUEEN' }, { act: 4, id: 'frostwyrm', title: 'PEAK TYRANT', name: 'KHALVORN' },
  { act: 5, id: 'sandscourge', title: 'DUNE DEVOURER', name: 'THE RED MAW' }, { act: 6, id: 'captain', title: 'SCOURGE OF THE SALT', name: 'CAPTAIN VERRA' },
  { act: 7, id: 'emberlord', title: 'LORD OF EMBERS' }, { act: 8, id: 'frostqueen', title: 'QUEEN OF RIME' },
  { act: 9, id: 'crystalgolem', title: 'TEMPLE WARDEN', name: 'OLD IDOL' }, { act: 10, id: 'lichlord', title: 'LICH OF THE BARROWS' },
  { act: 11, id: 'voidwraith', title: 'THE BETRAYER', name: 'LADY SERRIN' }, { act: 12, id: 'duskking', title: 'END OF DAYS' },
];

// ================================================================ instances
const DUNGEONS = REGIONS.filter(z => !z.town).map((z, i) => ({ id: 'dg_' + z.id, zone: z.id, name: ['GOBLIN KEEP', 'DROWNED LANTERN', 'BRIAR HOLLOW', 'STONEKIN DEEP', 'BONE CRYPT', 'WRECKERS COVE', 'MOLTEN FORGE', 'RIME PALACE', 'IDOL TEMPLE', 'KINGS BARROW', 'CRYSTAL VAULT', 'DUSK CITADEL'][i],
  theme: ['dungeon', 'temple', 'temple', 'ice', 'crypt', 'dungeon', 'lava', 'ice', 'temple', 'crypt', 'void', 'void'][i], lvl: z.lvl[1] + 1, size: 4 }));
const RAIDS = [
  { id: 'rd_crypt', name: 'THE BONE CRYPT', theme: 'crypt', lvl: 14, bosses: 4, zone: 'sandspire' },
  { id: 'rd_forge', name: 'HEART OF EMBERS', theme: 'lava', lvl: 18, bosses: 5, zone: 'emberwaste' },
  { id: 'rd_palace', name: 'THE RIME THRONE', theme: 'ice', lvl: 22, bosses: 5, zone: 'frostmarch' },
  { id: 'rd_dusk', name: 'THE LONG NIGHT', theme: 'void', lvl: 40, bosses: 6, zone: 'duskmoor' },
];
const TRIALS = [
  { id: 'tr_gauntlet', name: 'GAUNTLET OF STEEL', rule: 'rush', desc: '5 bosses back to back, no rests.', lvl: 10 },
  { id: 'tr_clock', name: 'TRIAL OF HOURS', rule: 'timed', desc: 'Win within 12 rounds.', lvl: 15 },
  { id: 'tr_alone', name: 'TRIAL OF SOLITUDE', rule: 'solo', desc: 'No companions allowed.', lvl: 12 },
  { id: 'tr_frail', name: 'TRIAL OF GLASS', rule: 'frail', desc: 'You have half HP.', lvl: 18 },
  { id: 'tr_horde', name: 'TRIAL OF THE HORDE', rule: 'waves', desc: '10 waves of foes.', lvl: 20 },
  { id: 'tr_mirror', name: 'TRIAL OF MIRRORS', rule: 'mirror', desc: 'Fight copies of heroes.', lvl: 25 },
];
const TOWER = { name: 'SPIRE OF A HUNDRED', floors: 100, bossEvery: 10, miniEvery: 5, baseLvl: 3, perFloor: 7 };
const WORLD_EVENTS = [
  { id: 'lantern-watch', name: 'LANTERN WATCH', desc: 'Defend the road lanterns from a raiding force.', zone: 'elderwood', lvl: 2, boss: 'goblinking', periodMinutes: 180, offsetMinutes: 20, durationMinutes: 35, rewardGold: 50 },
  { id: 'mire-bloom', name: 'MIRE BLOOM', desc: 'Stop the mire from swallowing the old causeway.', zone: 'hollowmere', lvl: 6, boss: 'troll', periodMinutes: 240, offsetMinutes: 65, durationMinutes: 40, rewardGold: 90 },
  { id: 'thornwake', name: 'THORNWAKE', desc: 'Drive the thorn-crowned guardian from the forest path.', zone: 'thornwood', lvl: 8, boss: 'jungler', periodMinutes: 300, offsetMinutes: 110, durationMinutes: 40, rewardGold: 120 },
  { id: 'frostfall', name: 'FROSTFALL', desc: 'Rouse the pass wardens and turn back the peak tyrant.', zone: 'greypeak', lvl: 10, boss: 'frostwyrm', periodMinutes: 360, offsetMinutes: 170, durationMinutes: 45, rewardGold: 160 },
  { id: 'glass-tide', name: 'GLASS TIDE', desc: 'Break the dune devourer’s hold over the caravan road.', zone: 'sandspire', lvl: 12, boss: 'sandscourge', periodMinutes: 240, offsetMinutes: 145, durationMinutes: 35, rewardGold: 200 },
  { id: 'last-lantern', name: 'THE LAST LANTERN', desc: 'Answer the call from the edge of the long night.', zone: 'duskmoor', lvl: 30, boss: 'duskking', periodMinutes: 480, offsetMinutes: 300, durationMinutes: 50, rewardGold: 500 },
];

// ================================================================ story: prologue, 12 acts, 50 chapters
const PROLOGUE = [
  'Long ago, the eight schools of magic were bound into a single book: the EMBER CODEX.',
  'Its light was kept in a thousand lanterns across AELMOOR, and while they burned, no dark thing could cross the land.',
  'This was the LANTERN PACT. For three hundred years, it held.',
  'Then the sun set over DUSKMOOR, and did not rise again.',
  'Out of that long night came a king with no shadow. Lanterns guttered. Old tombs cracked. Goblins grew bold.',
  'The CODEX was torn into twelve pages and scattered, each claimed by a tyrant who would keep the dark.',
  'You wake in ELDERWOOD with ash on your hands and a single lantern still burning beside you.',
  'The village ELDER says it chose you. You are not sure what that means. But the light is warm, and the road is open.',
];

// ================================================================ build info & studio
const BUILD = {
  game: 'LOST KINGDOM OF SHADOWBANE CHRONICLES',
  gameLines: ['LOST KINGDOM OF', 'SHADOWBANE CHRONICLES'],
  gameShort: 'SHADOWBANE CHRONICLES',
  subtitle: 'LANTERNS OF AELMOOR',
  expansions: [
    'Eternal Odyssey',
    'Dragonfire Realm',
    'Emberfell Saga',
    "Wizard's Dominion",
    'Plagueborn Legacy',
    'Crystalized Realms',
    'Frostsong Dynasty',
    'Arcane Ascension',
    'Bloodmoon Conspiracy',
    'Dragonspire Odyssey',
    'Whispers of Valhalla',
    'Nightshade Chronicles',
    'Mythical Meadowlands',
  ],
  version: '2.2.0',
  build: 'B2026.11.09',
  studio: 'ArkansasIo',
  engine: 'ARKANSAS - IO',
  engineVersion: '2.5.0',
  engineBuildId: 'ARKIO-20261101-001',
  engineBuildNumber: 1,
  year: 2026,
};

const EXPANSION_STORIES = BUILD.expansions.map((name, index) => {
  const stories = [
    { subtitle: 'THE SEA TAKES WHAT WAS BURIED', art: 'nm_dragon_0', threat: 'A drowned throne stirs beneath the Shattered Isles.', hook: 'Follow the lanterns below the waves, before the tide forgets the shore.' },
    { subtitle: 'DRAGONFIRE BELOW THE TIDE', art: 'nm_dragon_0', threat: 'A dragon sleeps beneath the Sunken Depths, bound by the Abyssal Choir.', hook: 'Descend through drowned cities, break the choir’s hold, and face the fire below.' },
    { subtitle: 'EMBERFELL IN THE SKY', art: 'px_waypoint', threat: 'Embers from a lost sky-forge ignite the cloud roads and split the floating isles.', hook: 'Climb through the storm, find Emberfell’s forge, and choose who commands its flame.' },
    { subtitle: 'THE WIZARDS’ RIFT', art: 'nm_dragon_1', threat: 'The Dominion’s magisters tore a hole in the world and cannot control what answers.', hook: 'Cross the rift frontier, confront the conclave, and seal the breach they opened.' },
    { subtitle: 'THE PLAGUE OF THE FIRST LIGHT', art: 'px_rune', threat: 'A blight spreads from the First Lantern, dimming the dawn wherever its light falls.', hook: 'Carry the lantern through the Halo Fields and discover what poisoned its flame.' },
    { subtitle: 'THE CRYSTAL REMEMBERS', art: 'px_gem', threat: 'A living crystal begins to repeat the voices of the dead.', hook: 'Enter the mirrored realm and find which reflection is yours.' },
    { subtitle: 'WINTER HAS A CROWN', art: 'px_skull', threat: 'An old dynasty wakes beneath the unbroken ice.', hook: 'Cross the frostbound court before the cold claims every name.' },
    { subtitle: 'ASCEND, OR BE UNMADE', art: 'px_rune', threat: 'A tower of spell-light rises where no tower stood before.', hook: 'Master the arcane trials and learn what waits at the summit.' },
    { subtitle: 'THE MOON KNOWS YOUR SECRET', art: 'px_symbol', threat: 'Under a blood-red moon, allies begin to vanish without a trace.', hook: 'Unmask the conspiracy before the next eclipse.' },
    { subtitle: 'THE SPIRE CALLS THE WORTHY', art: 'nm_dragon_2', threat: 'A dragon guards the road to a city carved into the clouds.', hook: 'Scale the Dragonspire and carry its oldest secret back to earth.' },
    { subtitle: 'THE OLD GODS ARE LISTENING', art: 'px_waypoint', threat: 'A forgotten song travels north, waking heroes from another age.', hook: 'Answer the call and choose what the legends leave behind.' },
    { subtitle: 'DARKNESS LEARNS YOUR NAME', art: 'enemy_wraith', threat: 'The shadows begin to move before their owners do.', hook: 'Hunt the first shade before night takes root in every heart.' },
    { subtitle: 'A WORLD LEFT TO GROW WILD', art: 'px_tower', threat: 'Beyond the old roads, a green horizon hides a new beginning.', hook: 'Discover the meadowlands and decide what kind of world can grow.' },
  ];
  return Object.freeze({ name, n: index + 1, ...stories[index] });
});
const ACTS = [
  { n: 1, name: 'THE LANTERN DIMS', zone: 'elderwood' }, { n: 2, name: 'MIRE AND MEMORY', zone: 'hollowmere' },
  { n: 3, name: 'THE THORN CROWN', zone: 'thornwood' }, { n: 4, name: 'STONE AND STORM', zone: 'greypeak' },
  { n: 5, name: 'SANDS OF THE SPIRE', zone: 'sandspire' }, { n: 6, name: 'SALT AND SAIL', zone: 'saltreach' },
  { n: 7, name: 'THE EMBER THRONE', zone: 'emberwaste' }, { n: 8, name: "WINTER'S HEART", zone: 'frostmarch' },
  { n: 9, name: 'THE GREEN DEEP', zone: 'verdantdeep' }, { n: 10, name: 'ASHES OF KINGS', zone: 'ashenbarrows' },
  { n: 11, name: 'THE SILVER HAVEN', zone: 'silverhaven' }, { n: 12, name: 'THE LONG DUSK', zone: 'duskmoor' },
];
// chapter: [act, title, objective, intro line]. objective types: talk:npc | explore:N | kill:N | dungeon | boss | gather:N | travel:zone
const CHAPTERS = [
  [1, 'A SPARK IN THE ASH', 'talk:elder', 'The Elder waits at the village shrine.'], [1, 'GREEN MENACE', 'kill:6', 'Goblins raid the carts. Drive them back.'],
  [1, 'THE KEEPER\'S ROAD', 'explore:3', 'Scout the wilds of Elderwood.'], [1, 'GATES OF THE KEEP', 'dungeon', 'Storm the Goblin Keep.'], [1, 'KING GRUK', 'boss', 'Face the King of the Keep and claim the first page.'],
  [2, 'INTO THE FEN', 'travel:hollowmere', 'Follow the drowned lantern-light south.'], [2, 'THE MISSING CHILDREN', 'kill:8', 'Something takes the fenfolk children at night.'],
  [2, 'DROWNED LANTERN', 'dungeon', 'Descend into the flooded shrine.'], [2, 'THE MIRE MOTHER', 'boss', 'Grandma Silt holds the second page.'],
  [3, 'BRIARS', 'travel:thornwood', 'The forest to the west has closed its paths.'], [3, 'FEY BARGAINS', 'talk:zone', 'Speak with the warden of the wood.'],
  [3, 'BRIAR HOLLOW', 'dungeon', 'Cut your way into the hollow.'], [3, 'THE THORN CROWN', 'boss', 'Break the Briarqueen\'s crown.'],
  [4, 'COLD ROAD', 'travel:greypeak', 'Climb into Greypeak Pass.'], [4, 'STONEKIN OATHS', 'gather:5', 'Gather frostbloom for the stonekin healers.'],
  [4, 'STONEKIN DEEP', 'dungeon', 'Clear the lost halls.'], [4, 'PEAK TYRANT', 'boss', 'Khalvorn the wyrm guards the fourth page.'],
  [5, 'RED HORIZON', 'travel:sandspire', 'Cross into the badlands.'], [5, 'NOMAD SIGNS', 'explore:3', 'Learn the dunes from the nomads.'],
  [5, 'THE BONE CRYPT', 'dungeon', 'Enter the crypt beneath the spire.'], [5, 'THE RED MAW', 'boss', 'Slay the Dune Devourer.'],
  [6, 'SALT WIND', 'travel:saltreach', 'Ride to the coast.'], [6, 'WRECKERS', 'kill:10', 'Smugglers lure ships to the rocks.'],
  [6, 'WRECKERS COVE', 'dungeon', 'Raid the hidden cove.'], [6, 'CAPTAIN VERRA', 'boss', 'The Scourge of the Salt has the sixth page.'],
  [7, 'ASHFALL', 'travel:emberwaste', 'Into the land of fire.'], [7, 'FORGE WHISPERS', 'explore:3', 'Find the old forges.'],
  [7, 'MOLTEN FORGE', 'dungeon', 'Brave the forge.'], [7, 'LORD OF EMBERS', 'boss', 'Pyrrhax burns with the seventh page.'],
  [8, 'WHITE SILENCE', 'travel:frostmarch', 'North, into the endless snow.'], [8, 'FROZEN HEARTS', 'kill:10', 'The queen\'s soldiers hunt survivors.'],
  [8, 'RIME PALACE', 'dungeon', 'Break into the palace.'], [8, 'QUEEN OF RIME', 'boss', 'Isvara\'s heart is the eighth page.'],
  [9, 'GREEN DARK', 'travel:verdantdeep', 'Into the deep jungle.'], [9, 'THE LOST PEOPLE', 'gather:6', 'Collect idol shards.'],
  [9, 'IDOL TEMPLE', 'dungeon', 'Wake the temple.'], [9, 'THE OLD IDOL', 'boss', 'The temple warden guards the ninth page.'],
  [10, 'BARROW WIND', 'travel:ashenbarrows', 'The old kings stir.'], [10, 'GRAVE GOODS', 'kill:12', 'Put the restless dead down.'],
  [10, 'KINGS BARROW', 'dungeon', 'Descend to the kings.'], [10, 'VAEL MORROW', 'boss', 'The lich who tore the Codex.'],
  [11, 'SILVER SHORE', 'travel:silverhaven', 'Sail to the crystal haven.'], [11, 'A FRIEND\'S FACE', 'talk:zone', 'Lady Serrin welcomes you... too warmly.'],
  [11, 'CRYSTAL VAULT', 'dungeon', 'Uncover the vault.'], [11, 'THE BETRAYER', 'boss', 'Serrin reveals her pact with the dusk.'],
  [12, 'NO MORE DAWN', 'travel:duskmoor', 'Walk into the long night.'], [12, 'LAST LANTERNS', 'explore:3', 'Light the final lanterns.'],
  [12, 'DUSK CITADEL', 'dungeon', 'Storm the citadel.'], [12, 'THE DUSK KING', 'boss', 'End the long night.'],
  [12, 'DAWN', 'talk:elder', 'Return the Codex. The sun rises.'],
];
// side quest templates (per zone, generated): {verb, obj, count}
const SIDE_TEMPLATES = [
  ['CULL', 'kill', 'Thin out the {fam} near the {area}.'], ['GATHER', 'gather', 'Collect {n} herbs for the {npc}.'],
  ['SCOUT', 'explore', 'Map the {area} and report back.'], ['BOUNTY', 'elite', 'A dangerous {fam} roams. Hunt it.'],
  ['LOST PACK', 'find', 'Find a lost pack near the {area}.'], ['PERSUADE', 'check', 'Talk a frightened {npc} into returning home.'],
  ['FISH', 'fish', 'Catch {n} fish for the camp.'], ['WORLD BOSS', 'worldboss', 'A world boss has been sighted: {boss}.'],
];
const NPC_FIRST = ['ALDA', 'BRAM', 'CORA', 'DUNN', 'ESME', 'FARO', 'GILA', 'HOBB', 'IRIS', 'JORN', 'KAYA', 'LOTT', 'MIRA', 'NED', 'OSWIN', 'PELL', 'QUIN', 'ROWE', 'SABA', 'TOV', 'URSA', 'VIK', 'WYNN', 'YARA'];
const NPC_ROLE = ['SCOUT', 'HERBALIST', 'SMITH', 'HUNTER', 'PRIEST', 'TRADER', 'GUARD', 'FISHER'];

// ================================================================ factions, achievements, professions
const FACTIONS = { lantern: 'LANTERN PACT', nomad: 'SAND NOMADS', stonekin: 'STONEKIN', fey: 'THORN COURT', haven: 'SILVERHAVEN' };
const REP_TIERS = [[0, 'NEUTRAL'], [300, 'FRIENDLY'], [900, 'HONORED'], [2100, 'REVERED'], [4000, 'EXALTED']];
const PROF_CAP = 720;
const PROFS = {
  herb: 'HERBALISM', mining: 'ORE MINING', forestry: 'FORESTRY', hidecraft: 'HIDECRAFT', fish: 'FISHING',
  salvaging: 'SALVAGING', relic: 'RELIC SURVEY', cultivation: 'CULTIVATION', beast_lore: 'BEAST LORE',
  alch: 'ALCHEMY', cook: 'COOKING', blacksmith: 'BLACKSMITHING', armorsmith: 'ARMORSMITHING', weaponsmith: 'WEAPONSMITHING'
};
const PROFESSION_TREES = {
  herb: { yield: 'DEEP ROOTS', efficiency: 'GENTLE HARVEST', mastery: 'FIELD LORE' },
  mining: { yield: 'RICH VEINS', efficiency: 'CAREFUL STRIKES', mastery: 'STONE LORE' },
  forestry: { yield: 'SUSTAINABLE CUT', efficiency: 'WOODCRAFT', mastery: 'FOREST LORE' },
  hidecraft: { yield: 'CLEAN SKINNING', efficiency: 'LIGHT TOUCH', mastery: 'HIDE LORE' },
  alch: { yield: 'BATCH BREWING', efficiency: 'REAGENT SAVER', mastery: 'ALCHEMICAL THEORY' },
  fish: { yield: 'FULL NETS', efficiency: 'PATIENT HAND', mastery: 'WATER LORE' },
  salvaging: { yield: 'USEFUL PARTS', efficiency: 'QUICK SORT', mastery: 'SALVAGER LORE' },
  relic: { yield: 'HIDDEN CACHE', efficiency: 'GENTLE EXTRACTION', mastery: 'ANCIENT LORE' },
  cultivation: { yield: 'ABUNDANT CROP', efficiency: 'SOIL CARE', mastery: 'GROWER LORE' },
  beast_lore: { yield: 'FIELD DRESSING', efficiency: 'CLEAN CUTS', mastery: 'BEAST LORE' },
  cook: { yield: 'HEARTH FEAST', efficiency: 'PANTRY SAVER', mastery: 'SEASONING ARTS' },
  blacksmith: { yield: 'FORGE OUTPUT', efficiency: 'MATERIAL SAVER', mastery: 'TEMPERING LORE' },
  armorsmith: { yield: 'ARMOR BATCHES', efficiency: 'FIT ECONOMY', mastery: 'ARMOR MASTERY' },
  weaponsmith: { yield: 'WEAPON BATCHES', efficiency: 'STEEL ECONOMY', mastery: 'WEAPON MASTERY' },
};
const PROFESSION_QUESTS = {
  herb: { sideName: 'THE FIELD GUIDE', sideText: 'Gather herbs for the town apothecary.', action: 'gather', sideCount: 20, orderText: 'Gather a bundle of herbs for local healers.', orderCount: 5, xp: 1200, gold: 180, skill: 3, item: 'peacebloom' },
  mining: { sideName: 'THE DEEP VEIN', sideText: 'Mine ore for the city forge.', action: 'gather', sideCount: 20, orderText: 'Deliver ore to the local smith.', orderCount: 5, xp: 1400, gold: 200, skill: 3, item: 'iron_ore' },
  forestry: { sideName: 'TIMBER FOR THE WATCH', sideText: 'Gather timber and resin for the road wardens.', action: 'gather', sideCount: 20, orderText: 'Bring gathered wood to the carpenter.', orderCount: 5, xp: 1300, gold: 190, skill: 3, item: 'sap' },
  hidecraft: { sideName: 'HIDE FOR THE ROAD', sideText: 'Prepare field hides for the traveling outfitters.', action: 'gather', sideCount: 20, orderText: 'Gather usable hides for the leatherworker.', orderCount: 5, xp: 1400, gold: 200, skill: 3, item: 'hide' },
  alch: { sideName: 'A CLEARER MIXTURE', sideText: 'Brew draughts for the traveling medics.', action: 'craft', sideCount: 12, orderText: 'Complete alchemy work for the clinic.', orderCount: 3, xp: 1500, gold: 220, skill: 3, item: 'antitoxin' },
  fish: { sideName: 'THE OLD FISHER', sideText: 'Bring a generous catch to the harbor.', action: 'fish', sideCount: 20, orderText: 'Catch fish for the harbor kitchen.', orderCount: 5, xp: 1200, gold: 180, skill: 3, item: 'ration' },
  salvaging: { sideName: 'SCRAP INTO STEEL', sideText: 'Recover useful metal from forgotten camps.', action: 'gather', sideCount: 20, orderText: 'Collect reusable scrap for the blacksmith.', orderCount: 5, xp: 1300, gold: 190, skill: 3, item: 'scrap' },
  relic: { sideName: 'FRAGMENTS OF THE PAST', sideText: 'Survey ruins and recover old relic pieces.', action: 'gather', sideCount: 20, orderText: 'Find relic fragments for the archivist.', orderCount: 5, xp: 1600, gold: 250, skill: 3, item: 'relic_fragment' },
  cultivation: { sideName: 'THE COMMUNITY GARDEN', sideText: 'Gather field fiber for the town growers.', action: 'gather', sideCount: 20, orderText: 'Harvest useful fibers for local crafters.', orderCount: 5, xp: 1200, gold: 180, skill: 3, item: 'field_fiber' },
  beast_lore: { sideName: "TRACKER'S NOTES", sideText: 'Study signs of beasts and recover field samples.', action: 'gather', sideCount: 20, orderText: 'Bring beast samples to the naturalist.', orderCount: 5, xp: 1500, gold: 220, skill: 3, item: 'bone_dust' },
  cook: { sideName: 'THE FEAST TABLE', sideText: 'Prepare meals for the road wardens.', action: 'craft', sideCount: 12, orderText: 'Cook provisions for a passing party.', orderCount: 3, xp: 1500, gold: 220, skill: 3, item: 'ration' },
  blacksmith: { sideName: 'THE HEARTHGUARD OATH', sideText: 'Reinforce equipment for the town watch.', action: 'reinforce', sideCount: 10, orderText: 'Temper equipment brought in by adventurers.', orderCount: 2, xp: 2200, gold: 350, skill: 3, item: 'scrap' },
  armorsmith: { sideName: 'A SAFE RETURN', sideText: 'Trade armor with the frontier patrol.', action: 'trade', sideCount: 15, orderText: 'Complete armor orders for local travelers.', orderCount: 3, xp: 2200, gold: 350, skill: 3, item: 'iron_ore' },
  weaponsmith: { sideName: 'STEEL FOR THE ROAD', sideText: 'Trade weapons with the frontier patrol.', action: 'trade', sideCount: 15, orderText: 'Complete weapon orders for local travelers.', orderCount: 3, xp: 2200, gold: 350, skill: 3, item: 'iron_ore' },
};
const ITEMS = {
  potion: { name: 'HEALING DRAUGHT', icon: 'item_health_potion', type: 'use', heal: '2d4+2', combat: true, price: 25, desc: 'Heal 2d4+2.' },
  greater: { name: 'GREATER DRAUGHT', icon: 'item_elixir', type: 'use', heal: '4d4+4', combat: true, price: 75, desc: 'Heal 4d4+4.' },
  superior: { name: 'SUPERIOR DRAUGHT', icon: 'item_tonic', type: 'use', heal: '8d4+8', combat: true, price: 250, desc: 'Heal 8d4+8.' },
  supreme: { name: 'SUPREME DRAUGHT', icon: 'item_tonic', type: 'use', heal: '10d4+20', combat: true, price: 800, desc: 'Heal 10d4+20.' },
  ether: { name: 'ETHER', icon: 'item_mana_potion', type: 'use', slot: 1, combat: true, price: 60, desc: 'Restore a spell slot.' },
  antitoxin: { name: 'ANTITOXIN', icon: 'item_antidote', type: 'use', cure: true, combat: true, price: 15, desc: 'Cure poisons and venom.' },
  ration: { name: 'TRAIL RATION', icon: 'px_ration', type: 'use', buff: 'fed', price: 5, desc: 'Food. WELL FED buff.' },
  campkit: { name: 'CAMP KIT', icon: 'px_tent', type: 'camp', price: 20, desc: 'Take a long rest in the wild.' },
  might: { name: 'ELIXIR OF MIGHT', icon: 'item_ether', type: 'use', buff: 'might', combat: true, price: 60, desc: '+15% damage.' },
  scroll_flame: { name: 'SCROLL: FLAME FAN', icon: 'item_scroll', type: 'scroll', spell: 'flamefan', combat: true, price: 50, desc: 'Cast FLAME FAN once.' },
  scroll_mend: { name: 'SCROLL: MENDING', icon: 'item_scroll', type: 'scroll', spell: 'mend', combat: true, price: 40, desc: 'Cast MENDING TOUCH once.' },
  scroll_dawn: { name: 'SCROLL: DAWN', icon: 'item_scroll', type: 'scroll', spell: 'dawn', combat: true, price: 400, desc: 'Revive an ally.' },
  hearthstone: { name: 'HEARTHSTONE', icon: 'px_waypoint', type: 'hearth', price: 0, desc: 'Return to your inn.' },
  peacebloom: { name: 'PEACEBLOOM', icon: 'item_herb', type: 'mat', price: 2, desc: 'Herb. Alchemy.' },
  field_fiber: { name: 'FIELD FIBER', icon: 'ne_reagent_0', type: 'mat', price: 4, desc: 'Cultivated fiber used by crafters.' },
  relic_fragment: { name: 'RELIC FRAGMENT', icon: 'ne_relic_0', type: 'mat', price: 12, desc: 'A recovered piece of an ancient relic.' },
  fish_stew: { name: 'FISHERMAN STEW', icon: 'px_fishcooked', type: 'use', heal: '4d6', buff: 'fed', price: 18, desc: 'A hearty fish stew. Restores 4d6 HP and leaves you well fed.' },
  herb_roast: { name: 'HERB ROAST', icon: 'px_ration', type: 'use', heal: '5d6', buff: 'fed', price: 24, desc: 'A fragrant roast with gathered herbs. Restores 5d6 HP and leaves you well fed.' },
  silverfin_plate: { name: 'SILVERFIN PLATE', icon: 'px_fishcooked', type: 'use', heal: '6d6', buff: 'fed', price: 35, desc: 'A rich silverfin meal. Restores 6d6 HP and leaves you well fed.' },
  eel_skewers: { name: 'SPICED EEL SKEWERS', icon: 'px_fishcooked', type: 'use', heal: '7d6', buff: 'fed', price: 42, desc: 'Hot spiced eel. Restores 7d6 HP and leaves you well fed.' },
  travelers_feast: { name: "TRAVELER'S FEAST", icon: 'px_ration', type: 'use', heal: '10d6', buff: 'fed', price: 70, desc: 'A generous feast for the road. Restores 10d6 HP and leaves you well fed.' },
  sandroot: { name: 'SANDROOT', icon: 'px_sandroot', type: 'mat', price: 5, desc: 'Herb. Alchemy.' },
  frostbloom: { name: 'FROSTBLOOM', icon: 'item_herb', type: 'mat', price: 8, desc: 'Cold herb. Alchemy.' },
  small_fish: { name: 'SMALL FISH', icon: 'px_fish', type: 'mat', price: 2, desc: 'Raw fish. Cooking.' },
  big_fish: { name: 'SILVERFIN', icon: 'px_fish', type: 'mat', price: 8, desc: 'Raw fish. Cooking.' },
  eel: { name: 'SAND EEL', icon: 'px_eel', type: 'mat', price: 6, desc: 'Raw eel. Cooking.' },
  grilled: { name: 'GRILLED FISH', icon: 'px_fishcooked', type: 'use', heal: '3d6', buff: 'fed', price: 10, desc: 'Food: 3d6 heal, WELL FED.' },
  feast: { name: 'HERO FEAST', icon: 'px_ration', type: 'use', heal: '8d6', buff: 'fed', price: 40, desc: 'Food: 8d6 heal, WELL FED.' },
  old_boot: { name: 'OLD BOOT', icon: 'item_boots', type: 'junk', price: 1, desc: 'Junk.' },
  goblin_token: { name: 'GOBLIN TOKEN', icon: 'px_token', type: 'junk', price: 3, desc: 'Junk. Sell it.' },
  old_bone: { name: 'OLD BONE', icon: 'px_bone', type: 'junk', price: 4, desc: 'Junk. Sell it.' },
  slimegel: { name: 'SLIME GEL', icon: 'item_antidote', type: 'junk', price: 2, desc: 'Junk.' },
  gold_dust: { name: 'GOLD DUST', icon: 'item_coin', type: 'junk', price: 25, desc: 'Sells well.' },
  coinpurse: { name: 'COIN PURSE', icon: 'item_coin', type: 'junk', price: 15, desc: 'Sells well.' },
  idol_shard: { name: 'IDOL SHARD', icon: 'px_gem', type: 'junk', price: 10, desc: 'Glowing stone.' },
  codex_page: { name: 'CODEX PAGE', icon: 'item_spellbook', type: 'key', desc: 'A page of the Ember Codex.' },
  tower_key: { name: 'SPIRE SIGIL', icon: 'px_tower', type: 'key', desc: 'Opens the Spire of a Hundred.' },
};
const RECIPES = [
  { id: 'healing_draught', prof: 'alch', name: 'HEALING DRAUGHT', skill: 1, needs: { peacebloom: 2 }, makes: 'potion' },
  { id: 'antitoxin', prof: 'alch', name: 'ANTITOXIN', skill: 10, needs: { peacebloom: 1, sandroot: 1 }, makes: 'antitoxin' },
  { id: 'ether', prof: 'alch', name: 'ETHER', skill: 30, needs: { sandroot: 2, peacebloom: 1 }, makes: 'ether' },
  { id: 'elixir_might', prof: 'alch', name: 'ELIXIR OF MIGHT', skill: 45, needs: { sandroot: 2, frostbloom: 1 }, makes: 'might' },
  { id: 'greater_draught', prof: 'alch', name: 'GREATER DRAUGHT', skill: 60, needs: { frostbloom: 2, sandroot: 1 }, makes: 'greater' },
  { id: 'superior_draught', prof: 'alch', name: 'SUPERIOR DRAUGHT', skill: 85, needs: { frostbloom: 4 }, makes: 'superior' },
  { id: 'grilled_fish', prof: 'cook', name: 'GRILLED FISH', skill: 1, needs: { small_fish: 1 }, makes: 'grilled' },
  { id: 'trail_ration', prof: 'cook', name: 'TRAIL RATION', skill: 1, needs: { small_fish: 1, peacebloom: 1 }, makes: 'ration' },
  { id: 'fish_stew', prof: 'cook', name: 'FISHERMAN STEW', skill: 5, needs: { small_fish: 2, peacebloom: 1 }, makes: 'fish_stew' },
  { id: 'herb_roast', prof: 'cook', name: 'HERB ROAST', skill: 15, needs: { small_fish: 1, sandroot: 2 }, makes: 'herb_roast' },
  { id: 'silverfin_plate', prof: 'cook', name: 'SILVERFIN PLATE', skill: 30, needs: { big_fish: 2, peacebloom: 1 }, makes: 'silverfin_plate' },
  { id: 'eel_skewers', prof: 'cook', name: 'SPICED EEL SKEWERS', skill: 50, needs: { eel: 2, sandroot: 1 }, makes: 'eel_skewers' },
  { id: 'hero_feast', prof: 'cook', name: 'HERO FEAST', skill: 75, needs: { big_fish: 2, eel: 1 }, makes: 'feast' },
  { id: 'travelers_feast', prof: 'cook', name: "TRAVELER'S FEAST", skill: 100, needs: { big_fish: 3, eel: 2, frostbloom: 1 }, makes: 'travelers_feast' },
];
const HERB_BY_BIOME = { meadow: 'peacebloom', coast: 'peacebloom', marsh: 'peacebloom', jungle: 'peacebloom', snow: 'frostbloom', badlands: 'sandroot', volcanic: 'sandroot', dusk: 'frostbloom', crystal: 'frostbloom' };

const ACHIEVEMENTS = [
  ['a_kill1', 'FIRST BLOOD', 'Win a battle.', s => s.kills >= 1], ['a_kill100', 'CENTURION', 'Defeat 100 foes.', s => s.kills >= 100],
  ['a_kill1000', 'WARLORD', 'Defeat 1000 foes.', s => s.kills >= 1000], ['a_lvl5', 'BLOODED', 'Reach level 5.', (s, g) => g.lvl >= 5],
  ['a_lvl20', 'HERO OF AELMOOR', 'Reach level 20.', (s, g) => g.lvl >= 20], ['a_lvl100', 'ASCENDANT', 'Reach level 100.', (s, g) => g.lvl >= 100],
  ['a_lvl720', 'MYTHIC', 'Reach level 720.', (s, g) => g.lvl >= 720], ['a_act1', 'ACT I', 'Finish Act 1.', (s, g) => g.chapter > 5],
  ['a_act6', 'HALFWAY HOME', 'Finish Act 6.', (s, g) => g.chapter > 25], ['a_story', 'DAWNBRINGER', 'Finish the story.', (s, g) => g.chapter >= 50],
  ['a_crit', 'NATURAL 20', 'Roll a natural 20.', s => s.nat20 >= 1], ['a_fumble', 'NATURAL 1', 'Roll a natural 1.', s => s.nat1 >= 1],
  ['a_death', 'DEATH SAVES', 'Survive by death saves.', s => s.stabilized >= 1], ['a_died', 'FALL DAMAGE', 'Die once.', s => s.deaths >= 1],
  ['a_rare', 'RARE HUNTER', 'Kill an elite.', s => s.elites >= 1], ['a_wboss', 'WORLD SHAKER', 'Kill a world boss.', s => s.worldBosses >= 1],
  ['a_arc', 'ARC BREAKER', 'Kill an arc boss.', s => s.arcBosses >= 1], ['a_dungeon', 'DELVER', 'Clear a dungeon.', s => s.dungeons >= 1],
  ['a_raid', 'RAIDER', 'Clear a raid.', s => s.raids >= 1], ['a_trial', 'TRIED', 'Complete a trial.', s => s.trials >= 1],
  ['a_tower10', 'CLIMBER', 'Reach tower floor 10.', (s, g) => g.towerBest >= 10], ['a_tower50', 'HIGH CLIMBER', 'Reach tower floor 50.', (s, g) => g.towerBest >= 50],
  ['a_tower100', 'SPIRE CONQUEROR', 'Clear floor 100.', (s, g) => g.towerBest >= 100], ['a_diff5', 'NIGHTMARE', 'Win on difficulty 5.', s => s.diff5 >= 1],
  ['a_diff9', 'APOCALYPSE', 'Win on difficulty 9.', s => s.diff9 >= 1], ['a_bestiary50', 'NATURALIST', 'Record 50 creatures.', (s, g) => Object.keys(g.bestiary).length >= 50],
  ['a_bestiary400', 'BESTIARY COMPLETE', 'Record all 400 creatures.', (s, g) => Object.keys(g.bestiary).length >= 400],
  ['a_collector', 'CREATURE COLLECTOR', 'Record 100 evolution-line creatures.', (s, g) => Object.keys(g.bestiary).filter(k => k.startsWith('cc_')).length >= 100],
  ['a_collector300', 'LIVING ATLAS', 'Record all 300 evolution-line creatures.', (s, g) => Object.keys(g.bestiary).filter(k => k.startsWith('cc_')).length >= 300],
  ['a_fish', 'ANGLER', 'Catch 10 fish.', s => s.fish >= 10], ['a_craft', 'ARTISAN', 'Craft 10 items.', s => s.crafted >= 10],
  ['a_gold', 'TYCOON', 'Earn 10000 gold.', s => s.goldEarned >= 10000], ['a_legend', 'LEGENDARY!', 'Loot a legendary.', s => s.legendaries >= 1],
  ['a_spell9', 'ARCHMAGE', 'Cast a 9th-level spell.', s => s.spell9 >= 1], ['a_party', 'FELLOWSHIP', 'Fight in a party of 4.', s => s.party4 >= 1],
  ['a_raid12', 'TWELVE STRONG', 'Fight in a raid of 12.', s => s.party12 >= 1], ['a_waypoints', 'WAYFARER', 'Unlock 8 waypoints.', (s, g) => Object.keys(g.waypoints).length >= 8],
  ['a_exalted', 'EXALTED', 'Reach Exalted with a faction.', (s, g) => Object.values(g.rep).some(v => v >= 4000)],
].map(([id, name, desc, test]) => ({ id, name, desc, test }));

// ================================================================ realm simulation (fake players)
const SIM_NAMES = ['LEEROYY', 'THRALLZ', 'ZUGZUG', 'MOONFIRE', 'SHADOWMN', 'HEALBOT', 'TANKARD', 'PWNSTAR', 'ELUNARA', 'GRIMBEARD', 'KAZRAK',
  'PIXELORA', 'BOOMKIN', 'NOOBSLAYR', 'SILVERHND', 'DOTSY', 'ARGENT', 'MOGWAI', 'FROSTBITE', 'STABBYMC', 'LOOTGOBLN', 'SPELLSWRD', 'NAT20', 'CRITBOI'];
const GUILD_NAMES = ['PIXEL PIONEERS', 'DOT MATRIX', 'EIGHT BIT', 'THE LCD', 'LANTERN KEEPERS'];
const CHAT_LINES = [
  ['General', 'anyone know where the slimes are?'], ['Trade', 'WTS healing draughts 20g'], ['LFG', 'LF tank GOBLIN KEEP'],
  ['General', 'nat 20 on the king lets gooo'], ['Trade', 'WTB SANDROOT x10'], ['General', 'world boss up in Hollowmere!!'],
  ['LFG', 'LFM BONE CRYPT raid need heals'], ['General', 'gz on 20!'], ['Trade', 'selling LEGENDARY EMBERTONGUE pst'],
  ['General', 'is wildblood good?'], ['General', 'died to a dusk bat lol'], ['LFG', 'tower floor 40 need 2'],
  ['General', 'what difficulty for leveling?'], ['Trade', 'LF alchemist, mats provided'], ['General', 'anyone wanna duel?'],
];
const NAME_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NAME_POOLS = {
  hearthkin: ['ARIN', 'BRYN', 'CALE', 'DESS', 'EDRIC', 'GWEN', 'HALE', 'MIRA', 'TOMAS', 'ELSA', 'ROWAN', 'NELL'],
  thornelf: ['AELIR', 'SYLWEN', 'THALEN', 'ILYRA', 'FAELAN', 'NIMRA', 'LORIEL', 'VAEL', 'SERETH', 'ELOWEN'],
  stonekin: ['BRAKKA', 'DURREK', 'HELGA', 'KORMAK', 'RUNA', 'TORVI', 'BALDUR', 'GRETA', 'ODRIK', 'SIGNA'],
  wispling: ['PIP', 'TANSY', 'WREN', 'MILO', 'POPPY', 'BIXBY', 'FENNA', 'LARK', 'TUCK', 'MOSS'],
  emberborn: ['ASHA', 'CINDRA', 'EMBRIC', 'KAELIS', 'PYRA', 'SOLEN', 'VEXA', 'ZAREK', 'IGNA', 'TOREN'],
  burrowkin: ['NIBBS', 'TOCK', 'FIZZWICK', 'DORLA', 'QUILL', 'SPROCKET', 'MABBLE', 'TINK', 'GIMBLE', 'ROOTA'],
  twinblood: ['ELIAN', 'SERA', 'KAIDEN', 'MAREN', 'ORREN', 'LYSA', 'DARIEN', 'IVY', 'CORIN', 'TALIA'],
  tuskborn: ['GRASH', 'UGRA', 'KRUL', 'MOGHA', 'THARG', 'ZUGA', 'BROKK', 'RASHKA', 'DURGA', 'VORN'],
  drakkin: ['RHAEZ', 'KORVATH', 'SYTHA', 'DRAVEN', 'ZORA', 'VERITH', 'KHAAL', 'ISSRA', 'ARDEX', 'NYRA'],
};
const POINT_BUY = { budget: 27, min: 8, max: 15, cost: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 } };

// ================================================================ expansions (endgame, levels 40-720)
const EXPANSIONS = [
  { n: 1, id: 'x1', name: 'ETERNAL ODYSSEY', lvl: [40, 120], biomes: ['coast', 'jungle', 'marsh'], raid: 'THE DROWNED THRONE', theme: 'temple', desc: 'Sail the Shattered Isles and reclaim the throne below the waves.' },
  { n: 2, id: 'x2', name: 'DRAGONFIRE REALM', lvl: [120, 240], biomes: ['marsh', 'crystal', 'dusk'], raid: 'ABYSSAL CHOIR', theme: 'ice', desc: 'Cities beneath the waves answer the call of an ancient dragon.' },
  { n: 3, id: 'x3', name: 'EMBERFELL SAGA', lvl: [240, 360], biomes: ['snow', 'crystal', 'meadow'], raid: 'THRONE OF WINDS', theme: 'void', desc: 'A kingdom above the clouds faces a storm without end.' },
  { n: 4, id: 'x4', name: "WIZARD'S DOMINION", lvl: [360, 540], biomes: ['volcanic', 'dusk', 'badlands'], raid: 'HEART OF THE RIFT', theme: 'lava', desc: 'Cross the Emberfell frontier and seal its burning rift.' },
  { n: 5, id: 'x5', name: 'PLAGUEBORN LEGACY', lvl: [540, 720], biomes: ['crystal', 'coast', 'snow'], raid: 'THE FIRST LANTERN', theme: 'crypt', desc: 'The last light falters; seek the dawn beyond the known world.' },
  // expansions 6-13 are worlds of their own, each with its own painted map (assets/gm_x<N>.png)
  { n: 6, id: 'x6', name: 'CRYSTALIZED REALMS', lvl: [100, 220], biomes: ['crystal', 'coast', 'dusk'], raid: 'THE MIRROR CROWN', theme: 'temple', desc: 'A living crystal repeats the dead.', world: true },
  { n: 7, id: 'x7', name: 'FROSTSONG DYNASTY', lvl: [160, 300], biomes: ['snow', 'crystal', 'badlands'], raid: 'THE RIME DYNASTY', theme: 'ice', desc: 'An old crown wakes under the ice.', world: true },
  { n: 8, id: 'x8', name: 'ARCANE ASCENSION', lvl: [220, 380], biomes: ['crystal', 'meadow', 'volcanic'], raid: 'THE SPELL-LIGHT SPIRE', theme: 'void', desc: 'Floating isles of spell-light.', world: true },
  { n: 9, id: 'x9', name: 'BLOODMOON CONSPIRACY', lvl: [300, 460], biomes: ['dusk', 'marsh', 'badlands'], raid: 'THE ECLIPSE COURT', theme: 'crypt', desc: 'Under a red moon, allies vanish.', world: true },
  { n: 10, id: 'x10', name: 'DRAGONSPIRE ODYSSEY', lvl: [380, 540], biomes: ['volcanic', 'snow', 'badlands'], raid: 'THE DRAGONSPIRE', theme: 'lava', desc: 'A dragon guards the cloud city.', world: true },
  { n: 11, id: 'x11', name: 'WHISPERS OF VALHALLA', lvl: [460, 620], biomes: ['snow', 'coast', 'meadow'], raid: 'HALL OF ECHOING SHIELDS', theme: 'ice', desc: 'Old heroes wake to a northern song.', world: true },
  { n: 12, id: 'x12', name: 'NIGHTSHADE CHRONICLES', lvl: [540, 700], biomes: ['dusk', 'jungle', 'marsh'], raid: 'THE FIRST SHADE', theme: 'void', desc: 'Shadows move before their owners.', world: true },
  { n: 13, id: 'x13', name: 'MYTHICAL MEADOWLANDS', lvl: [600, 720], biomes: ['meadow', 'jungle', 'coast'], raid: 'THE GREEN HORIZON', theme: 'temple', desc: 'A wild green world, left to grow.', world: true },
];
const EXP_ZONE_NAMES = [
  ['CORAL STRAND', 'WRECKWOOD', 'MANGROVE MAZE'], ['PEARL TRENCH', 'GLIMMER REEF', 'BLACK FATHOM'],
  ['CLOUDHOLM', 'GLASS PEAKS', 'WINDMEADOW'], ['CINDER RIFT', 'HOWLING GAP', 'SCAR PLAINS'], ['DAWNSHORE', 'HALO FIELDS', 'LAST PEAK'],
  ['PRISM COAST', 'GLASSWATER BAY', 'ECHO MIRE'], ['RIMEHOLD', 'SHARDWIND PASS', 'FROSTSCAR WASTE'], ['SPELLGROVE', 'LEYMEADOW', 'CINDER ARCANUM'],
  ['CRIMSON MOOR', 'LEECH FEN', 'RED DUNES'], ['WYRMFIRE CALDERA', 'SKYPEAK', 'SCORCHED PLAINS'], ['FJORDHOLM', 'SHIELD COAST', 'MEAD HALLS'],
  ['GLOOMHAVEN WOODS', 'NIGHTVINE JUNGLE', 'SHADE MARSH'], ['GREENHEART VALE', 'WILDROOT JUNGLE', 'SUNSHORE'],
];
EXPANSIONS.forEach((x, xi) => x.biomes.forEach((b, i) => {
  const span = (x.lvl[1] - x.lvl[0]) / 3;
  REGIONS.push({ id: `${x.id}_${i}`, name: EXP_ZONE_NAMES[xi][i], biome: b, lvl: [Math.round(x.lvl[0] + span * i), Math.round(x.lvl[0] + span * (i + 1))],
    act: 0, exp: x.n, gx: 5 + xi, gy: i, ex: i, desc: x.desc });
}));
EXPANSIONS.forEach(x => {
  RAIDS.push({ id: 'rd_' + x.id, name: x.raid, theme: x.theme, lvl: x.lvl[1] - 10, bosses: 5, zone: `${x.id}_2`, exp: x.n });
  [0, 1].forEach(i => DUNGEONS.push({ id: `dg_${x.id}_${i}`, zone: `${x.id}_${i}`, name: `${EXP_ZONE_NAMES[x.n - 1][i]} DEPTHS`, theme: x.theme, lvl: x.lvl[0] + (i + 1) * 30, size: 4, exp: x.n }));
});
// Persistent campaign objectives per expansion, driven by normal travel, combat, and instance events.
const EXPANSION_CAMPAIGNS = EXPANSIONS.map((x, i) => Object.freeze({
  exp: x.n, title: x.name, icon: `exp_icon_${x.n}`, intro: EXPANSION_STORIES[i].hook,
  beats: [
    EXPANSION_STORIES[i].threat,
    EXPANSION_STORIES[i].hook,
    `The trail leads into ${EXP_ZONE_NAMES[i][1]}, where the old defenses still hold.`,
    `${x.raid} is the source of the upheaval. End it, and the frontier may heal.`,
  ],
  epilogue: `${x.name} is safe for now. ${x.raid} can threaten it no longer.`,
  steps: [
    { kind: 'arrive', zone: `${x.id}_0`, title: `Reach ${EXP_ZONE_NAMES[i][0]}` },
    { kind: 'slay', target: 12, title: `Defeat 12 foes across ${x.name}` },
    { kind: 'dungeon', target: `dg_${x.id}_1`, title: `Clear ${EXP_ZONE_NAMES[i][1]} DEPTHS` },
    { kind: 'raid', target: `rd_${x.id}`, title: `Defeat ${x.raid}` },
  ],
  reward: { xp: Math.round(x.lvl[1] * 18), gold: x.lvl[1] * 25 },
}));

// hand-made starting zone
const ELDERWOOD_MAP = [
  'MMMMMMMMMMNNMMMMMMMMMMMMNNMMMMMM',
  'MN.TTTTDD..MMMMM..FFFFFFFF..MNMM',
  'M..TTDDDT...MMM..FFDDDDFFF.K..MM',
  'M.P.TTTT......M.FFDDTTDDF..k...M',
  'M......,,.........FFFFFF...|.P.M',
  'M..A........wwvv...........|...M',
  'M..a........w~~v...TTT.....|...M',
  'M..|...P....w~~v..TTDT.....|...M',
  'M..|hhhhhhhhh===hhhhhhhhhhhXhhhh',
  'M..|.........~~~..........,....M',
  'M..|.........~~~.......,....P..M',
  'M..|....,....~~~....P......TT..M',
  'M"SSS"".....~~~...........TTDT.M',
  'M"SHSJS.....~~...,,.....TTDDDT.M',
  'M"SSSSSS....~~.........TTDDDDTTM',
  'M"SrS"qS...~~~.......P.TTTDDTT.M',
  'M"SSSSSS..~~~~.........TTTTT...M',
  'M"""""""..~~~~~...,,...........M',
  'MP...,,...wvvwv.......P....P...M',
  'M..P.....................,,....M',
  'M.....TTT....P.....NN.......P..M',
  'M....TTDTT.........MMN..TTT....M',
  'MNN..TTTT....MM...MMMM.TTDT..NNM',
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
];

// ================================================================ 90 zones: regions split into sub-zones
const SUB_BIOMES = {
  meadow: ['ROLLING HILLS', 'FLOWER FIELDS', 'OLD ORCHARD', 'RIVERLANDS'], coast: ['SALT FLATS', 'TIDE CAVES', 'DUNE BEACH', 'CLIFF COAST'],
  marsh: ['PEAT BOG', 'MIST FEN', 'SUNKEN WOOD', 'REED SEA'], jungle: ['CANOPY', 'VINE TANGLE', 'FERN GULLY', 'RAIN BASIN'],
  snow: ['TUNDRA', 'GLACIER', 'PINE TAIGA', 'ICE CRAGS'], badlands: ['RED MESA', 'BONE DUNES', 'DRY GORGE', 'SALT PAN'],
  volcanic: ['ASH PLAINS', 'LAVA FIELDS', 'CINDER CONES', 'OBSIDIAN RIDGE'], dusk: ['GLOOM MOOR', 'GRAVE HILLS', 'SHADE WOOD', 'NIGHT MIRE'],
  crystal: ['PRISM GROVE', 'GLASS SHORE', 'SHARD FIELDS', 'STARLIT LAKE'],
};
const SUB_SUFFIX = ['', 'EAST', 'SOUTH', 'FAR REACH'];
const ZONES = [];
(function splitRegions() {
  REGIONS.forEach(rg => {
    let cells;
    if (rg.town) cells = [[rg.gx * 2, rg.gy * 2], [rg.gx * 2 + 1, rg.gy * 2]];
    else if (rg.exp) { const bx = 10 + (rg.exp - 1) * 3, w = rg.ex === 2 ? 2 : 3; cells = Array.from({ length: w }, (_, i) => [bx + i, rg.ex]); }
    else cells = [[rg.gx * 2, rg.gy * 2], [rg.gx * 2 + 1, rg.gy * 2], [rg.gx * 2, rg.gy * 2 + 1], [rg.gx * 2 + 1, rg.gy * 2 + 1]];
    const span = (rg.lvl[1] - rg.lvl[0]) / cells.length;
    cells.forEach(([fx, fy], i) => {
      const subs = SUB_BIOMES[rg.biome] || SUB_BIOMES.meadow;
      ZONES.push({ id: i === 0 ? rg.id : `${rg.id}_s${i}`, region: rg.id, name: rg.town ? (i ? 'HARBOR WARD' : rg.name) : (rg.name + (SUB_SUFFIX[i] ? ' ' + SUB_SUFFIX[i] : '')).slice(0, 22),
        sub: rg.town ? (i ? 'DOCKS' : 'CITY') : subs[i % subs.length], biome: rg.biome, lvl: rg.town ? rg.lvl : [Math.round(rg.lvl[0] + span * i), Math.round(rg.lvl[0] + span * (i + 1))],
        fx, fy, town: rg.town, hand: rg.hand && i === 0, exitPos: i === 0 ? rg.exitPos : null, act: rg.act, exp: rg.exp, last: i === cells.length - 1, desc: rg.desc });
    });
  });
})();
const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
const regionLastZone = rid => ZONES.filter(z => z.region === rid).pop();

// ================================================================ the world map of VALENDRIA: where each region sits on src_sheet/world_map.png
// [x, y] as fractions of the map image, plus the place name painted there
const REGION_PINS = {
  ardenhold: [0.71, 0.44, 'IKLISTZEFON'], elderwood: [0.70, 0.20, 'PLAINS OF STRIFE'], hollowmere: [0.57, 0.43, 'WETLANDS'],
  thornwood: [0.74, 0.29, 'THE BLACKWOOD'], greypeak: [0.67, 0.06, 'WHITECHAPEL PEAKS'], sandspire: [0.71, 0.63, 'CANYON OF WOE'],
  saltreach: [0.46, 0.42, 'GOLDSTAR COAST'], emberwaste: [0.12, 0.29, "VUL'KEN"], frostmarch: [0.56, 0.15, 'HYLONIA'],
  verdantdeep: [0.89, 0.87, 'EMERALD JUNGLE'], ashenbarrows: [0.16, 0.47, 'DREAD WASTES'], silverhaven: [0.92, 0.37, "TEL'LAYL"],
  duskmoor: [0.53, 0.62, 'SWAMP OF SORROW'],
  x1_0: [0.36, 0.18, 'NORTHERN ISLES'], x1_1: [0.33, 0.61, 'WESTERN ISLES'], x1_2: [0.42, 0.83, 'SOUTHERN ISLES'],
  x2_0: [0.73, 0.53, 'CRYSTAL LAKE'], x2_1: [0.66, 0.37, 'CRYSTAL RIVER'], x2_2: [0.27, 0.47, 'HATCHERY'],
  x3_0: [0.87, 0.11, 'ESTATE THORNHAART'], x3_1: [0.84, 0.25, 'REOTHIAN GLADES'], x3_2: [0.82, 0.38, 'CREEK OF LIFE'],
  x4_0: [0.08, 0.38, 'ASHLANDS'], x4_1: [0.51, 0.73, 'REDROCK'], x4_2: [0.91, 0.72, "KRON'MAR"],
  x5_0: [0.77, 0.76, 'DESERT OF ESRAH N'], x5_1: [0.68, 0.87, 'DESERT OF ESRAH S'], x5_2: [0.19, 0.38, 'DRAENIN'],
  x6_0: [0.28, 0.42, 'PRISM COAST'], x6_1: [0.64, 0.33, 'GLASSWATER'], x6_2: [0.7, 0.7, 'ECHO MIRE'],
  x7_0: [0.48, 0.26, 'RIMEHOLD'], x7_1: [0.3, 0.62, 'SHARDWIND'], x7_2: [0.72, 0.64, 'FROSTSCAR'],
  x8_0: [0.32, 0.3, 'SPELLGROVE'], x8_1: [0.42, 0.6, 'LEYMEADOW'], x8_2: [0.76, 0.62, 'ARCANUM'],
  x9_0: [0.34, 0.38, 'CRIMSON MOOR'], x9_1: [0.55, 0.62, 'LEECH FEN'], x9_2: [0.72, 0.4, 'RED DUNES'],
  x10_0: [0.36, 0.62, 'CALDERA'], x10_1: [0.68, 0.3, 'SKYPEAK'], x10_2: [0.62, 0.62, 'SCORCHLANDS'],
  x11_0: [0.32, 0.3, 'FJORDHOLM'], x11_1: [0.7, 0.48, 'SHIELD COAST'], x11_2: [0.48, 0.72, 'MEAD HALLS'],
  x12_0: [0.42, 0.34, 'GLOOMHAVEN'], x12_1: [0.7, 0.62, 'NIGHTVINE'], x12_2: [0.36, 0.62, 'SHADE MARSH'],
  x13_0: [0.4, 0.38, 'GREENHEART'], x13_1: [0.64, 0.58, 'WILDROOT'], x13_2: [0.3, 0.66, 'SUNSHORE'],
};
function zonePin(z) {
  const p = REGION_PINS[z.region] || [0.5, 0.5, ''];
  const sibs = ZONES.filter(o => o.region === z.region), i = sibs.indexOf(z);
  const off = sibs.length > 3 && !REGIONS.find(r => r.id === z.region).exp ? [[0, 0], [0.028, 0], [0, 0.04], [0.028, 0.04]][i] : [i * 0.026, 0];
  return [p[0] + off[0] - 0.012, p[1] + off[1] - 0.016];
}
// which painted map a zone lives on: 0 = VALENDRIA (base game + expansions 1-5), else the expansion number
const worldOf = z => { const x = z && z.exp ? EXPANSIONS.find(e => e.n === z.exp) : null; return x && x.world ? x.n : 0; };
const worldName = n => n ? EXPANSIONS.find(e => e.n === n).name : 'VALENDRIA';
const worldImg = (n, small) => n ? `gm_x${n}${small ? '_s' : ''}` : (small ? 'gm_dunia_s' : 'gm_dunia');
function continentOf(z) { if (worldOf(z)) return worldName(worldOf(z)); const p = REGION_PINS[z.region] || [0.5, 0.5]; return p[0] < 0.38 ? 'THE WEST ISLES' : p[1] < 0.5 ? 'NORTH KARRA' : 'SOUTH KARRA'; }

// ================================================================ SETTLEMENTS: cities, towns & villages as sub-zones
// Each base region has at most one city (region hub), one town (first sub-zone), and villages in the rest.
// Ardenhold is the sole full city; every other region has a town or village depending on its act tier.
// Format: { kind, name, amenities[], desc }
// kind: 'city' | 'town' | 'village'
// amenities: services available (inn, market, blacksmith, stable, healer, library, dock, guild, arena, shrine)
const SETTLEMENT_DEFS = {
  // --- Ardenhold (the city) ---
  ardenhold:  { kind: 'city',    name: 'ARDENHOLD',       amenities: ['inn','market','blacksmith','stable','healer','library','dock','guild','arena','shrine'], desc: 'The last free city of Aelmoor. All trades, guilds and the Grand Lantern Temple.' },
  // --- Elderwood ---
  elderwood:  { kind: 'town',    name: 'MILLHAVEN',        amenities: ['inn','market','blacksmith','stable','healer','shrine'],          desc: 'A prosperous mill-town at the edge of the great green hills.' },
  elderwood_s1: { kind: 'village', name: 'BLOOMWICK',      amenities: ['inn','healer','shrine'],                                         desc: 'A flower-farming hamlet famous for its honey mead.' },
  elderwood_s2: { kind: 'village', name: 'HARROW\'S END',  amenities: ['inn','market'],                                                  desc: 'A quiet farming settlement at the edge of the old orchard.' },
  elderwood_s3: { kind: 'village', name: 'RIVERGATE',      amenities: ['inn','stable','healer'],                                         desc: 'A fishing village where the river bends south.' },
  // --- Hollowmere ---
  hollowmere:  { kind: 'town',   name: 'BOGLUND',          amenities: ['inn','market','healer','shrine'],                                desc: 'A stilted town above the peat bogs, known for its lantern-fisher guild.' },
  hollowmere_s1: { kind: 'village', name: 'MISTFEN',       amenities: ['inn','healer'],                                                  desc: 'Half the village is built on floating reed-rafts.' },
  hollowmere_s2: { kind: 'village', name: 'SUNKHOLD',      amenities: ['inn','shrine'],                                                  desc: 'Named for the old watchtower that sank into the fens.' },
  hollowmere_s3: { kind: 'village', name: 'REEDFALL',      amenities: ['inn','market'],                                                  desc: 'Reed-cutters and herb-pickers eke out a living on the marsh edge.' },
  // --- Thornwood ---
  thornwood:   { kind: 'town',   name: 'BARKMORE',         amenities: ['inn','market','blacksmith','healer','shrine'],                   desc: 'A fortified logging town hemmed in by hostile vines.' },
  thornwood_s1: { kind: 'village', name: 'TANGLEVAST',     amenities: ['inn','healer'],                                                  desc: 'Hunters who know every safe path through the canopy.' },
  thornwood_s2: { kind: 'village', name: 'FERNLOW',        amenities: ['inn','shrine'],                                                  desc: 'An isolated hamlet; its people light fires to keep the jungle back.' },
  thornwood_s3: { kind: 'village', name: 'RAINMERE',       amenities: ['inn','market'],                                                  desc: 'Built beneath a great waterfall, perpetually damp.' },
  // --- Greypeak ---
  greypeak:    { kind: 'town',   name: 'STONEHOLT',        amenities: ['inn','market','blacksmith','stable','healer','shrine'],          desc: 'A dwarven-built pass-town, trades in ore and mountain pelts.' },
  greypeak_s1: { kind: 'village', name: 'GLACIERWATCH',   amenities: ['inn','healer'],                                                  desc: 'A watchtower garrison turned hamlet, always cold.' },
  greypeak_s2: { kind: 'village', name: 'TAIGAHOLLOW',    amenities: ['inn','market'],                                                  desc: 'Trappers and ice-fishers who never venture above the tree line.' },
  greypeak_s3: { kind: 'village', name: 'ICECRAG',        amenities: ['inn','shrine'],                                                  desc: 'A hermit community clinging to the highest crags.' },
  // --- Sandspire ---
  sandspire:   { kind: 'town',   name: 'DUSTHAVEN',        amenities: ['inn','market','blacksmith','healer','shrine'],                   desc: 'A red-walled caravan hub that charges steep water-prices.' },
  sandspire_s1: { kind: 'village', name: 'MESA CAMP',     amenities: ['inn','market'],                                                  desc: 'A temporary dig-camp that became permanent.' },
  sandspire_s2: { kind: 'village', name: 'BONEDUNE',      amenities: ['inn','shrine'],                                                  desc: 'Relic-pickers living in crypt-side tents.' },
  sandspire_s3: { kind: 'village', name: 'DRYSALT',       amenities: ['inn','healer'],                                                  desc: 'Named for the salt flats that shimmer at noon.' },
  // --- Saltreach ---
  saltreach:   { kind: 'town',   name: 'TIDEWATCH',        amenities: ['inn','market','blacksmith','stable','healer','dock','shrine'],   desc: 'A harbour town with a sea-captain\'s guild and a raucous fish market.' },
  saltreach_s1: { kind: 'village', name: 'TIDECAVE OUTPOST', amenities: ['inn','healer'],                                              desc: 'A cave-mouth settlement used by deep-divers and kelp-harvesters.' },
  saltreach_s2: { kind: 'village', name: 'DUNEWHISTLE',   amenities: ['inn','market'],                                                  desc: 'Smuggler families who pretend to be salt-miners.' },
  saltreach_s3: { kind: 'village', name: 'CLIFFGATE',     amenities: ['inn','shrine'],                                                  desc: 'Rope-bridges and goat-paths connect this clifftop hamlet.' },
  // --- Emberwaste ---
  emberwaste:  { kind: 'town',   name: 'ASHFORD',          amenities: ['inn','market','blacksmith','healer'],                            desc: 'A soot-stained town in a volcanic caldera, fiend-warded walls.' },
  emberwaste_s1: { kind: 'village', name: 'LAVAPOND',     amenities: ['inn','shrine'],                                                  desc: 'Built around a cooling lava pool, warm all year round.' },
  emberwaste_s2: { kind: 'village', name: 'CINDERPOST',   amenities: ['inn','market'],                                                  desc: 'Relay-riders who carry messages across the ash wastes.' },
  emberwaste_s3: { kind: 'village', name: 'OBSIDIAN RISE',amenities: ['inn','healer'],                                                  desc: 'Obsidian-cutters whose blades are prized across the realm.' },
  // --- Frostmarch ---
  frostmarch:  { kind: 'town',   name: 'RIMEGATE',         amenities: ['inn','market','blacksmith','stable','healer','shrine'],          desc: 'A frost-stone citadel that stands against the rime-queen\'s cold.' },
  frostmarch_s1: { kind: 'village', name: 'TUNDRAPOST',   amenities: ['inn','healer'],                                                  desc: 'Scout-rangers who watch for ice-giant movements.' },
  frostmarch_s2: { kind: 'village', name: 'GLACIEREDGE',  amenities: ['inn','market'],                                                  desc: 'Ice-sculptors and frost-fishers on the glacier\'s lip.' },
  frostmarch_s3: { kind: 'village', name: 'SNOWVEIL',     amenities: ['inn','shrine'],                                                  desc: 'Almost invisible in a blizzard; the locals like it that way.' },
  // --- Verdant Deep ---
  verdantdeep: { kind: 'town',   name: 'LEAFWARD',         amenities: ['inn','market','healer','shrine'],                                desc: 'A treehouse-town of the Deep Wardens, shaped from living wood.' },
  verdantdeep_s1: { kind: 'village', name: 'CANOPYREST',  amenities: ['inn','healer'],                                                  desc: 'Vine-bridges connect the platform homes in the upper canopy.' },
  verdantdeep_s2: { kind: 'village', name: 'FERN HAVEN',  amenities: ['inn','shrine'],                                                  desc: 'Verdant monks who tend the ancient fern-gardens.' },
  verdantdeep_s3: { kind: 'village', name: 'RAINPOOL',    amenities: ['inn','market'],                                                  desc: 'Named for the sacred rain-pool at its heart.' },
  // --- Ashen Barrows ---
  ashenbarrows: { kind: 'town',  name: 'GRAVEMOOR',        amenities: ['inn','market','healer','shrine'],                                desc: 'A walled town of tomb-keepers surrounded by the old king\'s barrows.' },
  ashenbarrows_s1: { kind: 'village', name: 'DUSKHOLLOW',  amenities: ['inn','shrine'],                                                 desc: 'Mourners who tend the oldest graves and sell relic-maps.' },
  ashenbarrows_s2: { kind: 'village', name: 'SHADEVALE',   amenities: ['inn','healer'],                                                 desc: 'The trees here never drop their leaves; they turn grey instead.' },
  ashenbarrows_s3: { kind: 'village', name: 'NIGHTMIRE CAMP', amenities: ['inn','market'],                                             desc: 'Undead-hunters who make camp near the necromantic ley-lines.' },
  // --- Silverhaven ---
  silverhaven:  { kind: 'town',  name: 'CRYSTALSPIRE',     amenities: ['inn','market','healer','library','shrine'],                     desc: 'A far-elf citadel of crystal towers, open to friendly mortals.' },
  silverhaven_s1: { kind: 'village', name: 'PRISMSHORE',   amenities: ['inn','healer'],                                                 desc: 'Glassworkers on the crystal lake\'s edge.' },
  silverhaven_s2: { kind: 'village', name: 'SHARDFIELD',   amenities: ['inn','market'],                                                 desc: 'Gem-pickers who work the shattered crystal plains.' },
  silverhaven_s3: { kind: 'village', name: 'STARLIT VALE', amenities: ['inn','shrine'],                                                 desc: 'A meditation village where the stars are reflected in every pool.' },
  // --- Duskmoor ---
  duskmoor:    { kind: 'town',   name: 'SHADOWFEN',         amenities: ['inn','market','healer','shrine'],                               desc: 'The only walled settlement on the moor, torches burn day and night.' },
  duskmoor_s1: { kind: 'village', name: 'GLOOMWATCH',      amenities: ['inn','healer'],                                                 desc: 'Watchers who track undead migrations across the moor.' },
  duskmoor_s2: { kind: 'village', name: 'GRAVEHILLS POST', amenities: ['inn','shrine'],                                                 desc: 'A relay-post for brave couriers crossing the barrow-country.' },
  duskmoor_s3: { kind: 'village', name: 'NIGHTVINE REST',  amenities: ['inn','market'],                                                 desc: 'Herbalists who harvest gloom-herbs found only on moonless nights.' },
};
// Amenity icons and descriptions for the world-map info panel
const AMENITY_INFO = {
  inn:        { icon: '🏠', label: 'INN',         desc: 'Rest, recover HP, and hear local rumours.' },
  market:     { icon: '🛒', label: 'MARKET',      desc: 'Buy potions, rations and general supplies.' },
  blacksmith: { icon: '⚒',  label: 'SMITHY',      desc: 'Repair and upgrade equipment.' },
  stable:     { icon: '🐎', label: 'STABLE',      desc: 'Mount services and fast travel.' },
  healer:     { icon: '✚',  label: 'HEALER',      desc: 'Cure ailments and revive fallen allies.' },
  library:    { icon: '📖', label: 'LIBRARY',     desc: 'Research lore and buy skill scrolls.' },
  dock:       { icon: '⚓', label: 'DOCK',        desc: 'Sea-routes and fishing licences.' },
  guild:      { icon: '⚔',  label: 'GUILD HALL',  desc: 'Arena challenges and faction contracts.' },
  arena:      { icon: '🏟', label: 'ARENA',       desc: 'Ranked combat and gladiatorial prizes.' },
  shrine:     { icon: '🕯',  label: 'SHRINE',      desc: 'Set your hearthstone and receive a blessing.' },
};
// Look up the settlement definition for a zone (returns null for unsettled zones)
function zoneSettlement(z) {
  if (!z) return null;
  return SETTLEMENT_DEFS[z.id] || null;
}
// Ordered list of all base-game zone ids that have settlements (for the world-map browse)
const SETTLED_ZONE_IDS = Object.keys(SETTLEMENT_DEFS);
