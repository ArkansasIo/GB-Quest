// GB QUEST — world data for AELMOOR: attributes, buffs, difficulty, zones, story,
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
function xpForLevel(l) { // total XP needed to reach level l
  if (l <= 20) return XP_TABLE[l - 1];
  const a = l - 20; return 355000 + Math.round(30000 * a + 900 * a * a + 2.2 * a * a * a);
}
const ASCENSION = { attrPerLevel: 1, subPerLevel: 2, boonEvery: 50 };
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
  game: 'SHADOWBANE CHRONICLES',
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
  version: '2.1.1',
  build: 'B2026.11.01',
  studio: 'ArkansasIo',
  year: 2026,
};

const EXPANSION_STORIES = BUILD.expansions.map((name, index) => {
  const stories = [
    { subtitle: 'THE SEA TAKES WHAT WAS BURIED', art: 'nm_dragon_0', threat: 'A drowned throne stirs beneath the Shattered Isles.', hook: 'Follow the lanterns below the waves, before the tide forgets the shore.' },
    { subtitle: 'THE DEEP REMEMBERS', art: 'px_skull', threat: 'The Sunken Depths answer every prayer with a voice from the dark.', hook: 'Descend through drowned cities and discover what the abyss kept alive.' },
    { subtitle: 'A KINGDOM ABOVE THE CLOUDS', art: 'px_waypoint', threat: 'The sky roads fracture as a storm gathers over the floating isles.', hook: 'Climb beyond the clouds and decide who rules the winds.' },
    { subtitle: 'THE FIRE BENEATH THE WORLD', art: 'nm_dragon_1', threat: 'A wound of flame opens, and ancient things crawl into the light.', hook: 'Cross the Emberfell frontier and silence the heart of the rift.' },
    { subtitle: 'WHEN THE LAST LIGHT FAILS', art: 'px_rune', threat: 'The first lantern goes dark. The long night begins again.', hook: 'Seek the dawn beyond the edge of the known world.' },
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
const PROFS = { herb: 'HERBALISM', alch: 'ALCHEMY', fish: 'FISHING', cook: 'COOKING' };
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
  { prof: 'alch', name: 'HEALING DRAUGHT', skill: 1, needs: { peacebloom: 2 }, makes: 'potion' },
  { prof: 'alch', name: 'ANTITOXIN', skill: 10, needs: { peacebloom: 1, sandroot: 1 }, makes: 'antitoxin' },
  { prof: 'alch', name: 'ETHER', skill: 30, needs: { sandroot: 2, peacebloom: 1 }, makes: 'ether' },
  { prof: 'alch', name: 'ELIXIR OF MIGHT', skill: 45, needs: { sandroot: 2, frostbloom: 1 }, makes: 'might' },
  { prof: 'alch', name: 'GREATER DRAUGHT', skill: 60, needs: { frostbloom: 2, sandroot: 1 }, makes: 'greater' },
  { prof: 'alch', name: 'SUPERIOR DRAUGHT', skill: 85, needs: { frostbloom: 4 }, makes: 'superior' },
  { prof: 'cook', name: 'GRILLED FISH', skill: 1, needs: { small_fish: 1 }, makes: 'grilled' },
  { prof: 'cook', name: 'TRAIL RATION', skill: 10, needs: { small_fish: 1, peacebloom: 1 }, makes: 'ration' },
  { prof: 'cook', name: 'HERO FEAST', skill: 50, needs: { big_fish: 2, eel: 1 }, makes: 'feast' },
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
  { n: 1, id: 'x1', name: 'SHATTERED ISLES', lvl: [40, 120], biomes: ['coast', 'jungle', 'marsh'], raid: 'THE DROWNED THRONE', theme: 'temple', desc: 'Islands torn from the sea floor.' },
  { n: 2, id: 'x2', name: 'THE SUNKEN DEPTHS', lvl: [120, 240], biomes: ['marsh', 'crystal', 'dusk'], raid: 'ABYSSAL CHOIR', theme: 'ice', desc: 'Cities beneath the waves.' },
  { n: 3, id: 'x3', name: 'SKYREACH', lvl: [240, 360], biomes: ['snow', 'crystal', 'meadow'], raid: 'THRONE OF WINDS', theme: 'void', desc: 'Floating isles above the clouds.' },
  { n: 4, id: 'x4', name: 'THE ABYSSAL RIFT', lvl: [360, 540], biomes: ['volcanic', 'dusk', 'badlands'], raid: 'HEART OF THE RIFT', theme: 'lava', desc: 'A wound in the world, bleeding fiends.' },
  { n: 5, id: 'x5', name: 'ETERNAL DAWN', lvl: [540, 720], biomes: ['crystal', 'coast', 'snow'], raid: 'THE FIRST LANTERN', theme: 'crypt', desc: 'Beyond the sunrise, the gods wait.' },
];
const EXP_ZONE_NAMES = [
  ['CORAL STRAND', 'WRECKWOOD', 'MANGROVE MAZE'], ['PEARL TRENCH', 'GLIMMER REEF', 'BLACK FATHOM'],
  ['CLOUDHOLM', 'GLASS PEAKS', 'WINDMEADOW'], ['CINDER RIFT', 'HOWLING GAP', 'SCAR PLAINS'], ['DAWNSHORE', 'HALO FIELDS', 'LAST PEAK'],
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

// ================================================================ the world map of DUNIA: where each region sits on src_sheet/world_map.png
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
};
function zonePin(z) {
  const p = REGION_PINS[z.region] || [0.5, 0.5, ''];
  const sibs = ZONES.filter(o => o.region === z.region), i = sibs.indexOf(z);
  const off = sibs.length > 3 && !REGIONS.find(r => r.id === z.region).exp ? [[0, 0], [0.028, 0], [0, 0.04], [0.028, 0.04]][i] : [i * 0.026, 0];
  return [p[0] + off[0] - 0.012, p[1] + off[1] - 0.016];
}
function continentOf(z) { const p = REGION_PINS[z.region] || [0.5, 0.5]; return p[0] < 0.38 ? 'THE WEST ISLES' : p[1] < 0.5 ? 'NORTH KARRA' : 'SOUTH KARRA'; }
