'use strict';
(() => { // own scope: the game loads every module as a classic script sharing one global scope
// ================================================================ WEAPON SKILL, MASTERY AND THE CIRCLE BOARD
// A Throne-and-Liberty-style weapon progression for all 15 weapon families (MAIN MENU > MASTERY).
//   * WEAPON SKILL 1-720   Every win with a weapon family equipped raises its weapon skill. Skill unlocks the
//                          family's six WEAPON ARTS (at 1 / 120 / 240 / 360 / 480 / 600) and sets the mastery cap.
//   * MASTERY 1-200        A separate grind. The cap is weapon skill / 3.6 (skill 720 = mastery 200). Mastery XP
//                          comes from wins too, with big shares from elites and bosses; XP earned while capped is
//                          banked up to one level's worth.
//   * MASTERY POINTS       One point per mastery level (200 at the cap), spent on that weapon's CIRCLE BOARD.
//   * CIRCLE BOARD         A free hub and six branches around it. Branch n opens at mastery 1 / 40 / 80 / 120 /
//                          160 / 200. Each branch has four rings: an inner ring (4 stat nodes, 5 ranks), a middle
//                          ring (3 stronger nodes, 5 ranks; needs 6 points in the branch), a deep ring (2 nodes,
//                          3 ranks at 2 points each; needs 14) and a CAPSTONE (5 points; needs 24) that upgrades
//                          one of the weapon's arts. A branch takes 52 points and the board 312, so 200 points
//                          force choices. Respecs are free up to 10 points spent, then cost a little gold.
//   * MASTERY TRAITS       Each branch carries a trait that switches on when the branch opens and grows with
//                          mastery level (full value at 200). Six traits per weapon.
//   * CLASS WEAPONS        Every class has a signature weapon: +25% skill and mastery XP with that family and a
//                          unique SIGNATURE ART at weapon skill 300.
// Board, trait and capstone bonuses apply only while a weapon of that family is equipped.
// Pure rules are exported as GBQWeaponMastery for tests; the game wiring runs only inside the game.

const WM_SKILL_MAX = 720;
const WM_MASTERY_MAX = 200;
const WM_SKILL_PER_MASTERY = 3.6;
const WM_BRANCH_UNLOCK = [1, 40, 80, 120, 160, 200];
const WM_ART_UNLOCK = [1, 120, 240, 360, 480, 600];
const WM_SIGNATURE_UNLOCK = 300;
const WM_SIGNATURE_XP = 1.25;
const WM_FREE_RESPEC = 10;
// rings: [nodes, max rank, cost per rank, branch points needed, stat multiplier]
const WM_RINGS = [
  { name: 'INNER', nodes: 4, max: 5, cost: 1, need: 0, mult: 1 },
  { name: 'MIDDLE', nodes: 3, max: 5, cost: 1, need: 6, mult: 1.6 },
  { name: 'DEEP', nodes: 2, max: 3, cost: 2, need: 14, mult: 2.4 },
  { name: 'CAPSTONE', nodes: 1, max: 1, cost: 5, need: 24, mult: 0 },
];
// value one rank of an inner node gives
const WM_STEP = { crit: 0.4, critdmg: 2, dodge: 0.4, block: 0.4, leech: 0.15, haste: 0.8, dmg: 2, heal: 2.5, resist: 0.5, thorns: 6, hp: 12, acb: 0.3, hit: 0.3,
  fire: 3, cold: 3, lightning: 3, necrotic: 3, radiant: 3, mf: 2, gf: 2, xp: 1 };

// branch themes: inner (4), middle (3) and deep (2) node stats, and the trait's stats at mastery 200
const elemTheme = el => ({ inner: [el, 'dmg', 'crit', 'hit'], mid: [el, 'critdmg', 'haste'], deep: [el, 'crit'], trait: [[el, 40], ['crit', 2]] });
const WM_THEMES = {
  precision: { inner: ['hit', 'crit', 'dmg', 'hp'], mid: ['crit', 'critdmg', 'hit'], deep: ['crit', 'critdmg'], trait: [['hit', 4], ['crit', 5]] },
  guard: { inner: ['block', 'acb', 'resist', 'hp'], mid: ['block', 'hp', 'thorns'], deep: ['block', 'resist'], trait: [['block', 6], ['acb', 2]] },
  bleed: { inner: ['critdmg', 'dmg', 'crit', 'leech'], mid: ['critdmg', 'leech', 'dmg'], deep: ['critdmg', 'leech'], trait: [['critdmg', 35], ['leech', 2]] },
  tempo: { inner: ['haste', 'dodge', 'crit', 'hit'], mid: ['haste', 'dodge', 'crit'], deep: ['haste', 'dodge'], trait: [['haste', 10], ['dodge', 3]] },
  vigor: { inner: ['hp', 'resist', 'heal', 'acb'], mid: ['hp', 'heal', 'resist'], deep: ['hp', 'resist'], trait: [['hp', 450], ['resist', 5]] },
  power: { inner: ['dmg', 'critdmg', 'hit', 'crit'], mid: ['dmg', 'critdmg', 'crit'], deep: ['dmg', 'critdmg'], trait: [['dmg', 30], ['critdmg', 20]] },
  thorns: { inner: ['thorns', 'acb', 'hp', 'block'], mid: ['thorns', 'resist', 'hp'], deep: ['thorns', 'block'], trait: [['thorns', 300], ['acb', 2]] },
  healing: { inner: ['heal', 'hp', 'resist', 'radiant'], mid: ['heal', 'leech', 'haste'], deep: ['heal', 'hp'], trait: [['heal', 35], ['hp', 200]] },
  drain: { inner: ['necrotic', 'leech', 'dmg', 'crit'], mid: ['necrotic', 'leech', 'critdmg'], deep: ['leech', 'necrotic'], trait: [['leech', 4], ['necrotic', 30]] },
  evasion: { inner: ['dodge', 'haste', 'crit', 'resist'], mid: ['dodge', 'crit', 'critdmg'], deep: ['dodge', 'crit'], trait: [['dodge', 6], ['crit', 3]] },
  fortune: { inner: ['mf', 'gf', 'xp', 'crit'], mid: ['mf', 'gf', 'crit'], deep: ['mf', 'xp'], trait: [['mf', 40], ['gf', 40]] },
  fire: elemTheme('fire'), cold: elemTheme('cold'), lightning: elemTheme('lightning'), necrotic: elemTheme('necrotic'), radiant: elemTheme('radiant'),
};

// ---------------------------------------------------------------- weapon families
// branch: [theme, branch name, trait name, capstone name, art index the capstone upgrades, art changes, capstone text]
// art changes: hits/cd/bonus add to the art; rider, stun, prone, execute, all, selfBuff, drain, heal, dice replace.
// arts: physical { cd, bonus: [dice, die, +1 die per N levels], hits, all, rider, stun, prone, execute, selfBuff }
//       casting  { cd, atk | save (+half), dice, dt, all, rider, drain, heal }
const P_ = (name, o, desc) => Object.assign({ name, kind: 'physical', desc }, o);
const C_ = (name, o, desc) => Object.assign({ name, kind: 'casting', desc }, o);
const WM_FAMILIES = {
  sword: { name: 'SWORD', desc: 'Balanced steel: accuracy, crits and a guard.',
    branches: [
      ['precision', 'EDGE', 'BLADE DISCIPLINE', 'RIPOSTE MASTER', 0, { hits: 1 }, 'SWORD STRIKE hits twice.'],
      ['guard', 'PARRY', 'GUARDED STANCE', 'PERFECT GUARD', 2, { selfBuff: 'fortify' }, 'GUARD BREAK also FORTIFIES you.'],
      ['bleed', 'WOUND', 'OPEN WOUNDS', 'HEMORRHAGE', 1, { bonus: 1, cd: -1 }, 'LACERATE: +1 die and 1 round less cooldown.'],
      ['tempo', 'MOMENTUM', 'BLADE FLOW', 'BLADE DANCE', 3, { hits: 1 }, 'BLADE FLURRY strikes four times.'],
      ['vigor', 'VALOR', 'KNIGHTLY VALOR', 'RALLYING STEEL', 4, { selfBuff: 'bless' }, 'VALIANT ARC BLESSES you.'],
      ['power', 'SOVEREIGN', 'SOVEREIGN BLADE', 'KINGSLAYER', 5, { bonus: 2, stun: true }, 'SOVEREIGN CUT: +2 dice and can STUN.'],
    ],
    arts: [P_('SWORD STRIKE', { cd: 2, bonus: [1, 8, 12] }, 'A clean, practised cut.'), P_('LACERATE', { cd: 3, bonus: [1, 6, 12], rider: 'bleeding' }, 'A slicing cut that leaves the foe BLEEDING.'),
      P_('GUARD BREAK', { cd: 4, bonus: [1, 8, 15], rider: 'sundered' }, 'Beat aside the foe\'s guard: SUNDERED.'), P_('BLADE FLURRY', { cd: 4, hits: 3, bonus: [0, 6, 0] }, 'Three fast strokes.'),
      P_('VALIANT ARC', { cd: 5, all: true, bonus: [2, 6, 18] }, 'A wide arc through every foe.'), P_('SOVEREIGN CUT', { cd: 7, bonus: [6, 10, 20], execute: true }, 'A finishing stroke; doubled below half health.')] },
  axe: { name: 'AXE', desc: 'Brutal chops: crit damage, bleeding and fury.',
    branches: [
      ['bleed', 'GORE', 'BUTCHER\'S EYE', 'ARTERIAL CHOP', 0, { rider: 'bleeding' }, 'HEW leaves the foe BLEEDING.'],
      ['power', 'HEADSMAN', 'HEADSMAN\'S WEIGHT', 'BEHEAD', 5, { bonus: 2 }, 'EXECUTIONER: +2 dice.'],
      ['tempo', 'FRENZY', 'BLOOD RUSH', 'WHIRLING AXES', 3, { all: true }, 'DOUBLE CHOP hits every foe.'],
      ['vigor', 'HIDE', 'THICK HIDE', 'UNBOWED', 2, { selfBuff: 'fortify' }, 'SPLITTING BLOW FORTIFIES you.'],
      ['drain', 'REAVER', 'REAVER\'S THIRST', 'BLOODLETTING', 1, { cd: -1, bonus: 1 }, 'GASH: +1 die, 1 round less cooldown.'],
      ['precision', 'WOODSMAN', 'WOODSMAN\'S AIM', 'TIMBER', 4, { prone: true }, 'CLEAVING STORM knocks foes PRONE.'],
    ],
    arts: [P_('HEW', { cd: 2, bonus: [1, 10, 12] }, 'A heavy downward chop.'), P_('GASH', { cd: 3, bonus: [1, 8, 12], rider: 'weakened' }, 'A deep gash: the foe is WEAKENED.'),
      P_('SPLITTING BLOW', { cd: 4, bonus: [2, 8, 15], rider: 'sundered' }, 'Split the foe\'s armour: SUNDERED.'), P_('DOUBLE CHOP', { cd: 4, hits: 2, bonus: [1, 8, 18] }, 'Two hard chops.'),
      P_('CLEAVING STORM', { cd: 5, all: true, bonus: [2, 8, 18], rider: 'bleeding' }, 'Every foe is cut and BLEEDING.'), P_('EXECUTIONER', { cd: 7, bonus: [6, 12, 20], execute: true }, 'Doubled on foes below half health.')] },
  mace: { name: 'MACE', desc: 'Holy crushing weight: damage, armour and radiance.',
    branches: [
      ['power', 'CRUSH', 'CRUSHING WEIGHT', 'BONEBREAKER', 0, { stun: true }, 'SMASH can STUN.'],
      ['radiant', 'SANCTUM', 'HOLY ORDER', 'CONSECRATE', 4, { heal: '3d8' }, 'HALLOWED RING also heals the party.'],
      ['guard', 'BULWARK', 'IRON FAITH', 'SHIELD OF FAITH', 2, { selfBuff: 'barrier' }, 'ARMOUR CRACKER raises a BARRIER.'],
      ['healing', 'MERCY', 'MERCIFUL HAND', 'LAYING ON', 1, { heal: '2d10' }, 'BLESSED BLOW also heals the party.'],
      ['thorns', 'PENANCE', 'PENITENT SPIKES', 'HAIR SHIRT', 3, { hits: 1 }, 'PUMMEL strikes three times.'],
      ['vigor', 'PILGRIM', 'PILGRIM\'S ROAD', 'UNBREAKABLE', 5, { bonus: 2 }, 'JUDGEMENT HAMMER: +2 dice.'],
    ],
    arts: [P_('SMASH', { cd: 2, bonus: [1, 8, 12] }, 'A crushing blow.'), C_('BLESSED BLOW', { cd: 3, save: 'CON', dice: '2d8', dt: 'radiant' }, 'CON save: holy force.'),
      P_('ARMOUR CRACKER', { cd: 4, bonus: [1, 10, 15], rider: 'sundered' }, 'Dent the foe\'s armour: SUNDERED.'), P_('PUMMEL', { cd: 4, hits: 2, bonus: [1, 6, 18] }, 'Two quick hits.'),
      C_('HALLOWED RING', { cd: 5, save: 'CON', half: true, all: true, dice: '3d8', dt: 'radiant' }, 'CON save, half: a ring of light hits every foe.'), P_('JUDGEMENT HAMMER', { cd: 7, bonus: [5, 10, 20], stun: true }, 'A divine blow that can STUN.')] },
  hammer: { name: 'HAMMER', desc: 'Huge swings: damage, crit damage and knockdowns.',
    branches: [
      ['power', 'MIGHT', 'TITAN\'S GRIP', 'EARTHQUAKE', 4, { bonus: 2 }, 'GROUND POUND: +2 dice.'],
      ['guard', 'ANVIL', 'ANVIL STANCE', 'IRON WALL', 2, { selfBuff: 'barrier' }, 'BULWARK SLAM raises a BARRIER.'],
      ['thorns', 'FORGE', 'FORGE SPARKS', 'MOLTEN CORE', 0, { rider: 'burning' }, 'HAMMER BLOW sets the foe BURNING.'],
      ['lightning', 'THUNDER', 'THUNDERHEAD', 'STORM HAMMER', 1, { rider: 'shocked', all: true }, 'THUNDERCLAP hits every foe and SHOCKS.'],
      ['vigor', 'STONE', 'STONE BODY', 'MOUNTAIN', 3, { selfBuff: 'fortify' }, 'TREMOR FORTIFIES you.'],
      ['precision', 'CRATER', 'CRATER MAKER', 'WORLDBREAKER', 5, { stun: true }, 'COLOSSUS can STUN.'],
    ],
    arts: [P_('HAMMER BLOW', { cd: 2, bonus: [1, 10, 12] }, 'One huge swing.'), C_('THUNDERCLAP', { cd: 3, save: 'CON', dice: '2d8', dt: 'thunder', rider: 'shocked' }, 'CON save: a boom that SHOCKS.'),
      P_('BULWARK SLAM', { cd: 4, bonus: [1, 8, 15], prone: true }, 'Knock the foe PRONE.'), P_('TREMOR', { cd: 4, all: true, bonus: [1, 8, 18], rider: 'slowed' }, 'Every foe is SLOWED.'),
      P_('GROUND POUND', { cd: 5, all: true, bonus: [2, 10, 18], prone: true }, 'Every foe is knocked PRONE.'), P_('COLOSSUS', { cd: 7, bonus: [7, 12, 20], rider: 'sundered' }, 'A giant\'s blow: SUNDERED.')] },
  dagger: { name: 'DAGGER', desc: 'Quick and deadly: crits, poison and evasion.',
    branches: [
      ['precision', 'VITALS', 'KILLER\'S EYE', 'HEARTSEEKER', 0, { bonus: 2 }, 'STAB: +2 dice.'],
      ['bleed', 'SERRATE', 'SERRATED EDGE', 'SLASHED TENDONS', 1, { rider: 'slowed', hits: 1 }, 'TWIN CUT strikes three times and SLOWS.'],
      ['evasion', 'SHADOWSTEP', 'SHADOW STEP', 'VANISH', 3, { selfBuff: 'mirror' }, 'SMOKE STRIKE cloaks you in MIRROR images.'],
      ['drain', 'VENOM', 'VENOM GLANDS', 'VIPER KISS', 2, { rider: 'venom', cd: -1 }, 'POISON DART: VENOM, 1 round less cooldown.'],
      ['tempo', 'QUICKSILVER', 'QUICKSILVER', 'BLINK STRIKES', 4, { hits: 2 }, 'FAN OF KNIVES: +2 hits.'],
      ['fortune', 'CUTPURSE', 'CUTPURSE', 'MARKED FOR DEATH', 5, { rider: 'doomed' }, 'ASSASSINATE leaves the foe DOOMED.'],
    ],
    arts: [P_('STAB', { cd: 2, bonus: [1, 6, 10] }, 'A quick stab.'), P_('TWIN CUT', { cd: 3, hits: 2, bonus: [0, 6, 0], rider: 'bleeding' }, 'Two cuts that leave the foe BLEEDING.'),
      C_('POISON DART', { cd: 4, atk: true, dice: '3d6', dt: 'poison', rider: 'venom' }, 'Spell attack: a poisoned dart (VENOM).'), P_('SMOKE STRIKE', { cd: 4, bonus: [2, 6, 15], rider: 'weakened' }, 'Strike from smoke: WEAKENED.'),
      P_('FAN OF KNIVES', { cd: 5, all: true, hits: 2, bonus: [0, 6, 0] }, 'Two knives into every foe.'), P_('ASSASSINATE', { cd: 7, bonus: [6, 8, 15], execute: true }, 'Doubled on foes below half health.')] },
  polearm: { name: 'POLEARM', desc: 'Reach and control: damage, block and sweeps.',
    branches: [
      ['precision', 'REACH', 'LONG REACH', 'IMPALER', 0, { hits: 1 }, 'THRUST strikes twice.'],
      ['guard', 'PHALANX', 'PHALANX', 'SPEAR WALL', 2, { selfBuff: 'fortify' }, 'BRACE AND STRIKE FORTIFIES you.'],
      ['power', 'HALBERD', 'HALBERDIER', 'HOOK AND PULL', 1, { prone: true }, 'SWEEP knocks foes PRONE.'],
      ['tempo', 'DRAGOON', 'DRAGOON LEAP', 'SKYFALL', 3, { all: true }, 'LEAPING LANCE hits every foe.'],
      ['radiant', 'SUNLANCE', 'SUNLIT TIP', 'DAWNPIERCE', 4, { rider: 'burning' }, 'PIERCING LINE sets foes BURNING.'],
      ['vigor', 'SENTINEL', 'SENTINEL\'S WATCH', 'HOLD THE LINE', 5, { bonus: 2, stun: true }, 'DRAGON\'S TOOTH: +2 dice and can STUN.'],
    ],
    arts: [P_('THRUST', { cd: 2, bonus: [1, 8, 12] }, 'A long thrust.'), P_('SWEEP', { cd: 3, all: true, bonus: [0, 8, 15] }, 'Sweep every foe.'),
      P_('BRACE AND STRIKE', { cd: 4, bonus: [1, 10, 15], rider: 'slowed' }, 'Set and strike: SLOWED.'), P_('LEAPING LANCE', { cd: 4, bonus: [2, 8, 15], prone: true }, 'Fall from above: PRONE.'),
      P_('PIERCING LINE', { cd: 5, all: true, bonus: [2, 8, 18], rider: 'sundered' }, 'Pierce through every foe: SUNDERED.'), P_('DRAGON\'S TOOTH', { cd: 7, bonus: [6, 10, 20], execute: true }, 'Doubled on foes below half health.')] },
  staff: { name: 'STAFF', desc: 'Arcane focus: elemental power and healing.',
    branches: [
      ['fire', 'PYRE', 'PYROMANCY', 'INFERNO', 1, { all: true }, 'FIREBALL CAST hits every foe.'],
      ['cold', 'RIME', 'CRYOMANCY', 'ABSOLUTE ZERO', 2, { rider: 'slowed', dice: '5d8' }, 'FROST NOVA: 5d8 and SLOWS.'],
      ['lightning', 'STORM', 'STORMCALLING', 'CHAIN STORM', 3, { cd: -1 }, 'LIGHTNING ARC: 1 round less cooldown.'],
      ['healing', 'GROVE', 'MENDING', 'RENEWAL', 4, { heal: '4d8' }, 'SANCTUARY heals more (4d8).'],
      ['tempo', 'FLUX', 'ARCANE FLUX', 'TIME WARP', 0, { cd: -1, hits: 1 }, 'STAFF STRIKE strikes twice, 1 round less cooldown.'],
      ['power', 'ARCHMAGE', 'ARCHMAGE', 'SPELL SURGE', 5, { rider: 'vulnerable' }, 'METEOR leaves foes VULNERABLE.'],
    ],
    arts: [P_('STAFF STRIKE', { cd: 2, bonus: [1, 6, 12] }, 'A sharp rap with the staff.'), C_('FIREBALL CAST', { cd: 3, save: 'DEX', half: true, dice: '3d6', dt: 'fire', rider: 'burning' }, 'DEX save, half: BURNING.'),
      C_('FROST NOVA', { cd: 4, save: 'CON', half: true, all: true, dice: '3d6', dt: 'cold', rider: 'frostbite' }, 'CON save, half: FROSTBITE on every foe.'), C_('LIGHTNING ARC', { cd: 4, atk: true, dice: '4d8', dt: 'lightning', rider: 'shocked' }, 'Spell attack: SHOCKED.'),
      C_('SANCTUARY', { cd: 5, save: 'WIS', half: true, all: true, dice: '2d6', dt: 'radiant', heal: '3d8' }, 'WIS save, half: light that heals the party.'), C_('METEOR', { cd: 7, save: 'DEX', half: true, all: true, dice: '6d10', dt: 'fire', rider: 'burning' }, 'DEX save, half: a meteor on every foe.')] },
  wand: { name: 'WAND', desc: 'Channelled curses and holy light.',
    branches: [
      ['necrotic', 'HEX', 'HEXCRAFT', 'WITHERING HEX', 1, { rider: 'doomed' }, 'CURSE BOLT DOOMS the foe.'],
      ['radiant', 'LIGHT', 'LIGHTBEARER', 'RADIANCE', 2, { all: true }, 'HOLY RAY hits every foe.'],
      ['drain', 'SIPHON', 'SIPHONING', 'SOUL TAP', 3, { drain: 0.6 }, 'LIFE SIPHON drains more (60%).'],
      ['healing', 'MEND', 'MENDER', 'GREATER RENEW', 4, { heal: '4d8' }, 'MENDING WAVE heals more (4d8).'],
      ['precision', 'FOCUS', 'FOCUSED CHANNEL', 'OVERCHANNEL', 0, { dice: '4d10' }, 'WAND BOLT deals 4d10.'],
      ['evasion', 'MIRAGE', 'MIRAGE', 'SPREADING BLIGHT', 5, { rider: 'vulnerable' }, 'DOOM CHANNEL leaves foes VULNERABLE.'],
    ],
    arts: [C_('WAND BOLT', { cd: 2, atk: true, dice: '2d10', dt: 'force' }, 'Spell attack: a bolt of force.'), C_('CURSE BOLT', { cd: 3, atk: true, dice: '2d10', dt: 'necrotic', rider: 'bane' }, 'Spell attack: the foe is BANED.'),
      C_('HOLY RAY', { cd: 4, atk: true, dice: '4d8', dt: 'radiant', rider: 'weakened' }, 'Spell attack: WEAKENED.'), C_('LIFE SIPHON', { cd: 4, atk: true, dice: '3d8', dt: 'necrotic', drain: 0.4 }, 'Spell attack: heal 40% of the damage.'),
      C_('MENDING WAVE', { cd: 5, save: 'WIS', half: true, all: true, dice: '2d6', dt: 'radiant', heal: '3d8' }, 'WIS save, half: heals the party.'), C_('DOOM CHANNEL', { cd: 7, save: 'WIS', half: true, all: true, dice: '6d8', dt: 'necrotic', rider: 'doomed' }, 'WIS save, half: DOOMS every foe.')] },
  bow: { name: 'BOW', desc: 'Range and precision: accuracy, crits and volleys.',
    branches: [
      ['precision', 'MARKSMAN', 'DEADEYE', 'BULLSEYE', 0, { bonus: 2 }, 'AIMED SHOT: +2 dice.'],
      ['tempo', 'SKIRMISH', 'SKIRMISHER', 'FREE ARROW', 1, { hits: 1 }, 'QUICK SHOT fires three arrows.'],
      ['evasion', 'KITE', 'KITING', 'WIND WALK', 2, { selfBuff: 'haste' }, 'PINNING SHOT HASTES you.'],
      ['bleed', 'BROADHEAD', 'BROADHEADS', 'BARBED VOLLEY', 4, { rider: 'bleeding' }, 'RAIN OF ARROWS leaves foes BLEEDING.'],
      ['fire', 'FLAMEARROW', 'FIRE ARROWS', 'BLAZING QUIVER', 3, { all: true }, 'FLAME ARROW hits every foe.'],
      ['power', 'LONGSHOT', 'LONGSHOT', 'HEART ARROW', 5, { stun: true }, 'SNIPER\'S MARK can STUN.'],
    ],
    arts: [P_('AIMED SHOT', { cd: 2, bonus: [1, 8, 12] }, 'A careful shot.'), P_('QUICK SHOT', { cd: 3, hits: 2, bonus: [0, 6, 0] }, 'Two fast arrows.'),
      P_('PINNING SHOT', { cd: 4, bonus: [1, 8, 15], rider: 'slowed' }, 'Pin the foe: SLOWED.'), C_('FLAME ARROW', { cd: 4, atk: true, dice: '4d8', dt: 'fire', rider: 'burning' }, 'Spell attack: BURNING.'),
      P_('RAIN OF ARROWS', { cd: 5, all: true, bonus: [2, 8, 18] }, 'A volley on every foe.'), P_('SNIPER\'S MARK', { cd: 7, bonus: [6, 10, 18], execute: true, rider: 'vulnerable' }, 'VULNERABLE; doubled below half health.')] },
  crossbow: { name: 'CROSSBOW', desc: 'Heavy bolts: big crit damage and armour piercing.',
    branches: [
      ['power', 'HEAVY BOLT', 'HEAVY DRAW', 'SIEGE BOLT', 0, { bonus: 2 }, 'BOLT: +2 dice.'],
      ['precision', 'SIGHTS', 'IRON SIGHTS', 'TRUE SIGHT', 2, { rider: 'vulnerable' }, 'PIERCING BOLT leaves the foe VULNERABLE.'],
      ['bleed', 'SERRATED', 'SERRATED BOLTS', 'RIPPER', 1, { rider: 'bleeding' }, 'TWIN BOLTS leave the foe BLEEDING.'],
      ['lightning', 'ARC', 'ARC BOLTS', 'TESLA COIL', 3, { all: true }, 'SHOCK BOLT hits every foe.'],
      ['fortune', 'BOUNTY', 'BOUNTY HUNTER', 'WANTED', 4, { rider: 'doomed' }, 'BOLT STORM DOOMS foes.'],
      ['guard', 'PAVISE', 'PAVISE', 'FORTIFIED NEST', 5, { selfBuff: 'fortify' }, 'BALLISTA SHOT FORTIFIES you.'],
    ],
    arts: [P_('BOLT', { cd: 2, bonus: [1, 10, 12] }, 'A heavy bolt.'), P_('TWIN BOLTS', { cd: 3, hits: 2, bonus: [0, 8, 0] }, 'Two bolts at once.'),
      P_('PIERCING BOLT', { cd: 4, bonus: [2, 8, 15], rider: 'sundered' }, 'Punch through armour: SUNDERED.'), C_('SHOCK BOLT', { cd: 4, atk: true, dice: '4d8', dt: 'lightning', rider: 'shocked' }, 'Spell attack: SHOCKED.'),
      P_('BOLT STORM', { cd: 5, all: true, bonus: [2, 8, 18] }, 'Bolts into every foe.'), P_('BALLISTA SHOT', { cd: 7, bonus: [7, 12, 20], execute: true }, 'Doubled on foes below half health.')] },
  thrown: { name: 'THROWN', desc: 'Knives, axes and stars: speed and luck.',
    branches: [
      ['tempo', 'FLICK', 'QUICK HANDS', 'ENDLESS SUPPLY', 1, { hits: 2 }, 'KNIFE VOLLEY: +2 throws.'],
      ['precision', 'RICOCHET', 'TRICK SHOT', 'RICOCHET', 0, { all: true }, 'TOSS bounces to every foe.'],
      ['fortune', 'GAMBLER', 'GAMBLER\'S LUCK', 'JACKPOT', 5, { bonus: 2 }, 'STARFALL: +2 dice.'],
      ['fire', 'FIREBRAND', 'FIREBRANDS', 'CINDER STORM', 2, { all: true }, 'FIRE FLASK hits every foe.'],
      ['evasion', 'ACROBAT', 'ACROBAT', 'BACKFLIP', 3, { selfBuff: 'haste' }, 'HAMSTRING TOSS HASTES you.'],
      ['bleed', 'SHURIKEN', 'STAR BLADES', 'THOUSAND STARS', 4, { rider: 'bleeding' }, 'BLADE CYCLONE leaves foes BLEEDING.'],
    ],
    arts: [P_('TOSS', { cd: 2, bonus: [1, 6, 12] }, 'A quick throw.'), P_('KNIFE VOLLEY', { cd: 3, hits: 3, bonus: [0, 4, 0] }, 'Three knives.'),
      C_('FIRE FLASK', { cd: 4, save: 'DEX', half: true, dice: '3d8', dt: 'fire', rider: 'burning' }, 'DEX save, half: BURNING.'), P_('HAMSTRING TOSS', { cd: 4, bonus: [1, 8, 15], rider: 'slowed' }, 'Aimed low: SLOWED.'),
      P_('BLADE CYCLONE', { cd: 5, all: true, hits: 2, bonus: [0, 6, 0] }, 'Two blades into every foe.'), P_('STARFALL', { cd: 7, all: true, bonus: [4, 8, 20] }, 'A shower of steel on every foe.')] },
  scythe: { name: 'SCYTHE', desc: 'Reaping: crit damage, shadow and lifesteal.',
    branches: [
      ['drain', 'REAP', 'REAPER', 'SOUL REAP', 1, { all: true }, 'HARVEST hits every foe.'],
      ['necrotic', 'GRAVE', 'GRAVE TOUCH', 'TOMB CHILL', 2, { rider: 'frostbite' }, 'DEATH\'S EDGE leaves FROSTBITE.'],
      ['bleed', 'CRESCENT', 'CRESCENT MOON', 'BLOOD MOON', 0, { rider: 'bleeding', hits: 1 }, 'REAPING CUT strikes twice and BLEEDS.'],
      ['power', 'DOOM', 'DOOMBRINGER', 'FINAL HOUR', 5, { bonus: 2 }, 'GRIM HARVEST: +2 dice.'],
      ['evasion', 'WRAITH', 'WRAITHFORM', 'PHANTOM', 3, { selfBuff: 'mirror' }, 'SPECTRAL SWEEP brings MIRROR images.'],
      ['vigor', 'UNDYING', 'UNDYING', 'DEATHLESS', 4, { drain: 0.5 }, 'SOUL HARVEST drains more (50%).'],
    ],
    arts: [P_('REAPING CUT', { cd: 2, bonus: [1, 8, 12] }, 'A curved, reaping cut.'), P_('HARVEST', { cd: 3, bonus: [1, 8, 15], rider: 'weakened' }, 'Reap the foe: WEAKENED.'),
      C_('DEATH\'S EDGE', { cd: 4, atk: true, dice: '4d8', dt: 'necrotic', drain: 0.3 }, 'Spell attack: heal 30% of the damage.'), P_('SPECTRAL SWEEP', { cd: 4, all: true, bonus: [1, 8, 18] }, 'Sweep every foe.'),
      C_('SOUL HARVEST', { cd: 5, save: 'CON', half: true, all: true, dice: '3d8', dt: 'necrotic', drain: 0.3 }, 'CON save, half: drain every foe.'), P_('GRIM HARVEST', { cd: 7, bonus: [6, 12, 20], execute: true }, 'Doubled on foes below half health.')] },
  grimoire: { name: 'GRIMOIRE', desc: 'Spellbook: every school of magic.',
    branches: [
      ['fire', 'EMBER PAGE', 'EMBER SCRIPT', 'BURNING TEXT', 0, { rider: 'burning' }, 'PAGE BOLT sets the foe BURNING.'],
      ['cold', 'FROST PAGE', 'FROST SCRIPT', 'WINTER CHAPTER', 1, { all: true }, 'ICE GLYPH hits every foe.'],
      ['lightning', 'STORM PAGE', 'STORM SCRIPT', 'THUNDER VERSE', 2, { rider: 'shocked', cd: -1 }, 'RUNE BLAST: SHOCKS, 1 round less cooldown.'],
      ['radiant', 'HOLY PAGE', 'HOLY SCRIPT', 'ILLUMINATED', 3, { heal: '3d8' }, 'WORD OF POWER also heals the party.'],
      ['necrotic', 'SHADOW PAGE', 'SHADOW SCRIPT', 'FORBIDDEN TEXT', 4, { drain: 0.4 }, 'BINDING CIRCLE drains 40%.'],
      ['power', 'TOME', 'TOMEKEEPER', 'LAST CHAPTER', 5, { dice: '10d10' }, 'APOCRYPHA deals 10d10.'],
    ],
    arts: [C_('PAGE BOLT', { cd: 2, atk: true, dice: '2d10', dt: 'force' }, 'Spell attack: a torn page of force.'), C_('ICE GLYPH', { cd: 3, save: 'DEX', half: true, dice: '3d8', dt: 'cold', rider: 'frostbite' }, 'DEX save, half: FROSTBITE.'),
      C_('RUNE BLAST', { cd: 4, save: 'DEX', half: true, all: true, dice: '3d8', dt: 'lightning' }, 'DEX save, half: every foe.'), C_('WORD OF POWER', { cd: 4, save: 'WIS', dice: '4d8', dt: 'psychic', rider: 'bane' }, 'WIS save: BANED.'),
      C_('BINDING CIRCLE', { cd: 5, save: 'CON', half: true, all: true, dice: '3d10', dt: 'necrotic', rider: 'slowed' }, 'CON save, half: SLOWS every foe.'), C_('APOCRYPHA', { cd: 7, atk: true, dice: '8d10', dt: 'force', rider: 'vulnerable' }, 'Spell attack: VULNERABLE.')] },
  fist: { name: 'FIST', desc: 'Martial arts: speed, dodge and combos.',
    branches: [
      ['tempo', 'COMBO', 'FLOWING COMBO', 'ENDLESS COMBO', 1, { hits: 2 }, 'RAPID FISTS: +2 hits.'],
      ['evasion', 'WIND', 'WIND STEP', 'EMPTY BODY', 2, { selfBuff: 'mirror' }, 'DEFLECT AND COUNTER brings MIRROR images.'],
      ['power', 'IRON FIST', 'IRON FIST', 'QUIVERING PALM', 5, { execute: true }, 'DRAGON STRIKE doubles below half health.'],
      ['vigor', 'BREATH', 'INNER BREATH', 'DIAMOND SOUL', 3, { selfBuff: 'regen' }, 'SPINNING KICK starts REGEN.'],
      ['precision', 'PRESSURE', 'PRESSURE POINTS', 'NERVE STRIKE', 0, { stun: true }, 'PALM STRIKE can STUN.'],
      ['lightning', 'SPARK', 'SPARK FISTS', 'STORM FISTS', 4, { rider: 'shocked' }, 'SHOCKWAVE SHOCKS foes.'],
    ],
    arts: [P_('PALM STRIKE', { cd: 2, bonus: [1, 6, 12] }, 'An open-palm strike.'), P_('RAPID FISTS', { cd: 3, hits: 3, bonus: [0, 4, 0] }, 'Three fast punches.'),
      P_('DEFLECT AND COUNTER', { cd: 4, bonus: [1, 8, 15], selfBuff: 'haste' }, 'Counter and HASTE yourself.'), P_('SPINNING KICK', { cd: 4, all: true, bonus: [1, 6, 18], prone: true }, 'Every foe is knocked PRONE.'),
      P_('SHOCKWAVE', { cd: 5, all: true, bonus: [2, 8, 18], stun: true }, 'A burst that can STUN every foe.'), P_('DRAGON STRIKE', { cd: 7, hits: 3, bonus: [2, 8, 20] }, 'Three dragon-fast strikes.')] },
  totem: { name: 'TOTEM', desc: 'Elemental totems: the five elements, wards and healing.',
    branches: [
      ['fire', 'FLAME', 'FLAME SPIRIT', 'WILDFIRE', 1, { all: true }, 'EMBER PULSE hits every foe.'],
      ['cold', 'FROST', 'FROST SPIRIT', 'PERMAFROST', 2, { rider: 'slowed', all: true }, 'FROST BIND hits every foe and SLOWS.'],
      ['lightning', 'STORM', 'STORM SPIRIT', 'THUNDERHEAD', 0, { rider: 'shocked', cd: -1 }, 'TOTEM BOLT SHOCKS, 1 round less cooldown.'],
      ['guard', 'EARTH', 'EARTH SPIRIT', 'BEDROCK', 3, { selfBuff: 'fortify', bonus: 2 }, 'STONE SLAM: +2 dice and FORTIFIES you.'],
      ['healing', 'SPIRIT', 'ANCESTOR SPIRIT', 'SPIRIT WALK', 4, { heal: '5d8' }, 'SPIRIT LINK heals more (5d8).'],
      ['vigor', 'ELDER', 'ELDER TOTEM', 'PRIMAL AVATAR', 5, { rider: 'vulnerable' }, 'ELEMENTAL FURY leaves foes VULNERABLE.'],
    ],
    arts: [C_('TOTEM BOLT', { cd: 2, atk: true, dice: '2d8', dt: 'lightning' }, 'Spell attack: a bolt from the totem.'), C_('EMBER PULSE', { cd: 3, save: 'DEX', half: true, dice: '3d6', dt: 'fire', rider: 'burning' }, 'DEX save, half: BURNING.'),
      C_('FROST BIND', { cd: 4, save: 'CON', dice: '3d8', dt: 'cold', rider: 'frostbite' }, 'CON save: FROSTBITE.'), P_('STONE SLAM', { cd: 4, bonus: [1, 8, 15], selfBuff: 'barrier' }, 'Strike with the totem and raise a BARRIER.'),
      C_('SPIRIT LINK', { cd: 5, save: 'WIS', half: true, all: true, dice: '2d6', dt: 'radiant', heal: '3d8' }, 'WIS save, half: spirits strike every foe and heal the party.'), C_('ELEMENTAL FURY', { cd: 7, save: 'DEX', half: true, all: true, dice: '6d8', dt: 'lightning', rider: 'shocked' }, 'DEX save, half: every foe SHOCKED.')] },
};
const WM_FAMS = Object.keys(WM_FAMILIES);

// ---------------------------------------------------------------- class signature weapons
const WM_CLASS_WEAPONS = {
  warden: { fam: 'sword', weapon: 'OATHBRAND', art: P_('OATHBOUND STRIKE', { cd: 5, bonus: [4, 10, 15], selfBuff: 'fortify' }, 'A sworn blow that FORTIFIES you.') },
  runeblade: { fam: 'sword', weapon: 'RUNEBRAND', art: P_('RUNIC SEVER', { cd: 5, bonus: [3, 10, 15], rider: 'doomed' }, 'A rune-cut that DOOMS the foe.') },
  berserker: { fam: 'axe', weapon: 'BLOODREAVER', art: P_('RAMPAGE', { cd: 6, all: true, hits: 2, bonus: [1, 10, 20] }, 'Two wild swings at every foe.') },
  vanguard: { fam: 'hammer', weapon: 'BULWARK MAUL', art: P_('AEGIS SLAM', { cd: 6, all: true, bonus: [3, 8, 18], prone: true, selfBuff: 'barrier' }, 'Every foe PRONE; you gain a BARRIER.') },
  strider: { fam: 'bow', weapon: 'WINDSTRING', art: P_('HUNTER\'S VOLLEY', { cd: 6, all: true, hits: 2, bonus: [1, 8, 20], rider: 'slowed' }, 'Two arrows into every foe: SLOWED.') },
  shade: { fam: 'dagger', weapon: 'NIGHTFANG', art: P_('UMBRAL ASSASSINATE', { cd: 6, bonus: [5, 8, 12], execute: true, rider: 'weakened' }, 'WEAKENED; doubled below half health.') },
  ascetic: { fam: 'fist', weapon: 'STILLWATER WRAPS', art: P_('HUNDRED PALMS', { cd: 6, hits: 6, bonus: [0, 6, 30], stun: true }, 'Six palms that can STUN.') },
  arcanist: { fam: 'staff', weapon: 'STARWEAVE STAFF', art: C_('ARCANE CATACLYSM', { cd: 6, save: 'DEX', half: true, all: true, dice: '6d10', dt: 'force', rider: 'vulnerable' }, 'DEX save, half: every foe VULNERABLE.') },
  verdant: { fam: 'staff', weapon: 'ELDERBRANCH', art: C_('GROVE\'S EMBRACE', { cd: 6, save: 'CON', half: true, all: true, dice: '4d8', dt: 'piercing', rider: 'slowed', heal: '4d8' }, 'CON save, half: thorns SLOW foes, the party heals.') },
  wildblood: { fam: 'thrown', weapon: 'CINDERSHARDS', art: C_('WILDFIRE BARRAGE', { cd: 6, save: 'DEX', half: true, all: true, dice: '5d8', dt: 'fire', rider: 'burning' }, 'DEX save, half: every foe BURNING.') },
  pactbound: { fam: 'wand', weapon: 'PACTWAND', art: C_('ELDRITCH COLLAPSE', { cd: 6, atk: true, dice: '6d10', dt: 'force', rider: 'doomed', drain: 0.3 }, 'Spell attack: DOOMED, heal 30%.') },
  cantor: { fam: 'crossbow', weapon: 'SONGBOLT', art: C_('CRESCENDO BOLT', { cd: 6, save: 'WIS', dice: '5d8', dt: 'psychic', rider: 'bane', heal: '3d8' }, 'WIS save: BANED; the party heals.') },
  chaplain: { fam: 'mace', weapon: 'SANCTUS', art: C_('BENEDICTION', { cd: 6, save: 'CON', half: true, all: true, dice: '4d8', dt: 'radiant', heal: '4d10' }, 'CON save, half: holy light; the party heals.') },
  sunwarden: { fam: 'polearm', weapon: 'DAWNSPEAR', art: P_('SOLAR PIKE', { cd: 6, bonus: [4, 10, 15], rider: 'burning', selfBuff: 'bless' }, 'BURNING foe; you are BLESSED.') },
  necromancer: { fam: 'scythe', weapon: 'GRAVEHARVEST', art: C_('REAP SOULS', { cd: 6, save: 'CON', half: true, all: true, dice: '5d8', dt: 'necrotic', drain: 0.4 }, 'CON save, half: drain 40% from every foe.') },
  summoner: { fam: 'grimoire', weapon: 'CODEX OF CALLING', art: C_('LEGION INVOCATION', { cd: 6, atk: true, all: true, dice: '4d10', dt: 'force', rider: 'vulnerable', heal: '2d8' }, 'Spell attack on every foe: VULNERABLE; the party heals.') },
  // jobs (jobs_data.js)
  ronin: { fam: 'sword', weapon: 'MOONLIT KATANA', art: P_('IAIJUTSU', { cd: 6, bonus: [6, 10, 15], execute: true }, 'One perfect draw-cut; doubled below half health.') },
  shinobi: { fam: 'thrown', weapon: 'SHADOW SHURIKEN', art: P_('SHURIKEN STORM', { cd: 6, all: true, hits: 3, bonus: [0, 6, 0], rider: 'bleeding' }, 'Three stars into every foe: BLEEDING.') },
  bladedancer: { fam: 'fist', weapon: 'RIBBON WRAPS', art: C_('BLADE WALTZ', { cd: 6, save: 'DEX', half: true, all: true, dice: '3d8', dt: 'piercing', rider: 'slowed', heal: '4d8' }, 'DEX save, half: foes SLOWED; the party heals.') },
  wyrmlancer: { fam: 'polearm', weapon: 'WYVERNFANG LANCE', art: P_('SKYFALL DIVE', { cd: 6, all: true, bonus: [3, 10, 18], prone: true }, 'Dive from the sky: every foe PRONE.') },
  corsair: { fam: 'crossbow', weapon: 'PHANTOM FLINTLOCK', art: C_('BROADSIDE', { cd: 6, save: 'DEX', half: true, all: true, dice: '5d8', dt: 'fire', rider: 'burning' }, 'DEX save, half: every foe BURNING.') },
  beastcaller: { fam: 'axe', weapon: 'WILDHEART HATCHET', art: P_('PACK HUNT', { cd: 6, hits: 3, bonus: [1, 8, 20], rider: 'bleeding' }, 'Three strikes with the pack: BLEEDING.') },
  puppeteer: { fam: 'hammer', weapon: 'GEARWORK MAUL', art: P_('PISTON SLAM', { cd: 6, bonus: [4, 10, 15], stun: true, selfBuff: 'barrier' }, 'Can STUN; you gain a BARRIER.') },
  dreadknight: { fam: 'scythe', weapon: 'DREADREAPER', art: C_('GRAVE GRIP', { cd: 6, atk: true, dice: '5d10', dt: 'necrotic', rider: 'slowed', drain: 0.5 }, 'Spell attack: SLOWED, heal 50%.') },
  voidhunter: { fam: 'dagger', weapon: 'VOID WARGLAIVES', art: C_('EYE OF THE VOID', { cd: 6, save: 'DEX', half: true, all: true, dice: '5d8', dt: 'force', rider: 'vulnerable' }, 'DEX save, half: every foe VULNERABLE.') },
  scalesage: { fam: 'grimoire', weapon: 'DRAGONSCALE CODEX', art: C_('DRAGON BREATH', { cd: 6, save: 'DEX', half: true, all: true, dice: '5d8', dt: 'fire', rider: 'burning', heal: '3d8' }, 'DEX save, half: BURNING foes; the party heals.') },
  stormcaller: { fam: 'totem', weapon: 'THUNDERHEAD TOTEM', art: C_('STORM TOTEM', { cd: 6, save: 'DEX', half: true, all: true, dice: '5d8', dt: 'lightning', rider: 'shocked', heal: '3d8' }, 'DEX save, half: foes SHOCKED; the party heals.') },
};

// ---------------------------------------------------------------- arts
const wmArtId = (fam, i) => `wm_${fam}_${i}`;
const wmSigId = cls => `wm_sig_${cls}`;
// every weapon art as a combat-art definition (arts.js format)
const WM_ARTS = {};
for (const fam of WM_FAMS) WM_FAMILIES[fam].arts.forEach((a, i) => { WM_ARTS[wmArtId(fam, i)] = Object.assign({ id: wmArtId(fam, i), g: 'weapon', lvl: WM_ART_UNLOCK[i], fam, wsl: WM_ART_UNLOCK[i] }, a); });
for (const [cls, s] of Object.entries(WM_CLASS_WEAPONS)) WM_ARTS[wmSigId(cls)] = Object.assign({ id: wmSigId(cls), g: 'weapon', lvl: WM_SIGNATURE_UNLOCK, fam: s.fam, wsl: WM_SIGNATURE_UNLOCK, cls, sig: true }, s.art);
// apply capstone changes to an art (returns a copy)
function wmModArt(a, mods) {
  if (!mods || !mods.length) return a;
  const o = Object.assign({}, a, { bonus: a.bonus ? a.bonus.slice() : a.bonus });
  for (const m of mods) for (const [k, v] of Object.entries(m)) {
    if (k === 'hits') o.hits = (o.hits || 1) + v;
    else if (k === 'cd') o.cd = Math.max(1, o.cd + v);
    else if (k === 'bonus') { if (o.kind === 'physical') { o.bonus = (o.bonus || [0, 6, 0]).slice(); o.bonus[0] += v; } }
    else o[k] = v;
  }
  return o;
}

// ---------------------------------------------------------------- progress
const wmNew = () => ({ sl: 1, sx: 0, ml: 1, mx: 0, board: {} });
function wmNorm(st) {
  st = st && typeof st === 'object' ? st : wmNew();
  st.sl = Math.max(1, Math.min(WM_SKILL_MAX, Math.floor(Number(st.sl) || 1)));
  st.ml = Math.max(1, Math.min(wmMasteryCap(st.sl), Math.floor(Number(st.ml) || 1)));
  st.sx = Math.max(0, Number(st.sx) || 0); st.mx = Math.max(0, Number(st.mx) || 0);
  if (!st.board || typeof st.board !== 'object') st.board = {};
  return st;
}
const wmSkillXpFor = L => Math.round(30 + 4 * L + 0.02 * L * L);                 // skill L -> L+1
const wmMasteryXpFor = L => Math.round(60 * Math.pow(L, 1.35));                   // mastery L -> L+1
const wmMasteryCap = sl => Math.max(1, Math.min(WM_MASTERY_MAX, Math.floor(sl / WM_SKILL_PER_MASTERY)));
function wmAddSkillXp(st, xp) {
  let ups = 0; st.sx += Math.max(0, xp);
  while (st.sl < WM_SKILL_MAX && st.sx >= wmSkillXpFor(st.sl)) { st.sx -= wmSkillXpFor(st.sl); st.sl++; ups++; }
  if (st.sl >= WM_SKILL_MAX) st.sx = 0;
  return ups;
}
// mastery levels only up to the cap that weapon skill allows; extra XP is banked up to one level's worth
function wmAddMasteryXp(st, xp) {
  let ups = 0; st.mx += Math.max(0, xp);
  const cap = wmMasteryCap(st.sl);
  while (st.ml < cap && st.mx >= wmMasteryXpFor(st.ml)) { st.mx -= wmMasteryXpFor(st.ml); st.ml++; ups++; }
  if (st.ml >= WM_MASTERY_MAX) st.mx = 0;
  else if (st.ml >= cap) st.mx = Math.min(st.mx, wmMasteryXpFor(st.ml));
  return ups;
}
// XP for one won battle. foes: [{ lvl, elite, boss }]
function wmBattleXp(foes, heroLvl, sig) {
  let skill = 0, mastery = 0;
  for (const f of foes || []) {
    const L = Math.max(1, Math.floor(Number(f.lvl) || heroLvl || 1)), mult = f.boss ? 6 : f.elite ? 3 : 1;
    skill += (20 + L * 2) * mult;
    mastery += (6 + L) * (f.boss ? 20 : f.elite ? 5 : 1);
  }
  const k = sig ? WM_SIGNATURE_XP : 1;
  return { skill: Math.round(skill * k), mastery: Math.round(mastery * k) };
}
const wmRank = ml => ml >= 200 ? 'GRANDMASTER' : ml >= 160 ? 'MASTER' : ml >= 120 ? 'EXPERT' : ml >= 80 ? 'ADEPT' : ml >= 40 ? 'JOURNEYMAN' : 'NOVICE';

// ---------------------------------------------------------------- circle board
// node ids: b<branch>r<ring>n<node>; hub is free and always taken
function wmNodes(fam) {
  const F = WM_FAMILIES[fam]; if (!F) return [];
  const out = [];
  F.branches.forEach((br, b) => {
    const T = WM_THEMES[br[0]], stats = [T.inner, T.mid, T.deep];
    WM_RINGS.forEach((R, r) => {
      for (let n = 0; n < R.nodes; n++) {
        const node = { id: `b${b}r${r}n${n}`, branch: b, ring: r, n, max: R.max, cost: R.cost };
        if (r < 3) { node.stat = stats[r][n]; node.per = WM_STEP[node.stat] * R.mult; }
        else { node.cap = true; node.name = br[3]; node.art = br[4]; node.mods = br[5]; node.desc = br[6]; }
        out.push(node);
      }
    });
  });
  return out;
}
const WM_NODE_CACHE = {};
const wmNodesOf = fam => (WM_NODE_CACHE[fam] ||= wmNodes(fam));
const wmNode = (fam, id) => wmNodesOf(fam).find(n => n.id === id);
const wmSpent = board => Object.entries(board || {}).reduce((s, [id, r]) => { const m = /^b\d+r(\d)n\d+$/.exec(id); return m ? s + (WM_RINGS[+m[1]].cost * (r || 0)) : s; }, 0);
const wmBranchSpent = (board, b) => Object.entries(board || {}).reduce((s, [id, r]) => { const m = /^b(\d+)r(\d)n\d+$/.exec(id); return m && +m[1] === b ? s + WM_RINGS[+m[2]].cost * (r || 0) : s; }, 0);
const wmPoints = st => Math.max(0, st.ml - wmSpent(st.board));
const wmBranchOpen = (ml, b) => ml >= WM_BRANCH_UNLOCK[b];
function wmCanSpend(st, fam, id) {
  const node = wmNode(fam, id); if (!node) return { ok: false, why: 'No such node.' };
  const rank = st.board[id] || 0;
  if (rank >= node.max) return { ok: false, why: 'Already at max rank.' };
  if (!wmBranchOpen(st.ml, node.branch)) return { ok: false, why: `Branch opens at mastery ${WM_BRANCH_UNLOCK[node.branch]}.` };
  const need = WM_RINGS[node.ring].need;
  if (wmBranchSpent(st.board, node.branch) < need) return { ok: false, why: `Spend ${need} points in this branch first.` };
  if (wmPoints(st) < node.cost) return { ok: false, why: node.cost > 1 ? `Needs ${node.cost} points.` : 'No points left.' };
  return { ok: true };
}
function wmSpend(st, fam, id) { const c = wmCanSpend(st, fam, id); if (c.ok) st.board[id] = (st.board[id] || 0) + 1; return c; }
const wmRespecCost = (st, heroLvl) => { const s = wmSpent(st.board); return s <= WM_FREE_RESPEC ? 0 : s * Math.max(5, Math.ceil((heroLvl || 1) / 2)); };
function wmRespec(st) { st.board = {}; }
// a board that no longer fits (old saves, admin tools lowering mastery) drops unknown or closed nodes and
// clamps ranks; if it still spends more than it has, it is refunded in full
function wmTrim(st, fam) {
  for (const id of Object.keys(st.board)) {
    const n = wmNode(fam, id), r = Math.floor(Number(st.board[id]) || 0);
    if (!n || r <= 0 || !wmBranchOpen(st.ml, n.branch)) delete st.board[id]; else st.board[id] = Math.min(n.max, r);
  }
  if (wmSpent(st.board) > st.ml) st.board = {};
  return st;
}

// ---------------------------------------------------------------- bonuses
const wmMerge = list => { const o = {}; for (const [k, v] of list) o[k] = (o[k] || 0) + v; return Object.entries(o).map(([k, v]) => [k, Math.floor(v)]).filter(([, v]) => v > 0); };
function wmBoardStats(fam, board) {
  const out = [];
  for (const n of wmNodesOf(fam)) { const r = board[n.id] || 0; if (r && n.stat) out.push([n.stat, Math.max(1, n.per * r)]); }
  return wmMerge(out);
}
// the six traits: [{ name, branch, open, stats }]
function wmTraits(fam, ml) {
  const F = WM_FAMILIES[fam]; if (!F) return [];
  return F.branches.map((br, b) => {
    const open = wmBranchOpen(ml, b), share = Math.min(1, ml / WM_MASTERY_MAX);
    return { name: br[2], branch: b, theme: br[0], unlock: WM_BRANCH_UNLOCK[b], open, stats: WM_THEMES[br[0]].trait.map(([k, v]) => [k, open ? Math.max(1, Math.floor(v * share)) : 0]), full: WM_THEMES[br[0]].trait };
  });
}
function wmTraitStats(fam, ml) { return wmMerge(wmTraits(fam, ml).filter(t => t.open).flatMap(t => t.stats)); }
// capstones taken: art index -> [mods]
function wmCapMods(fam, board) {
  const out = {};
  for (const n of wmNodesOf(fam)) if (n.cap && board[n.id]) (out[n.art] ||= []).push(n.mods);
  return out;
}
// everything a family gives while equipped
function wmBonus(st, fam) {
  if (!WM_FAMILIES[fam] || !st) return [];
  return wmMerge([...wmBoardStats(fam, st.board || {}), ...wmTraitStats(fam, st.ml || 1)]);
}
// arts usable with this family, upgraded by capstones
function wmArtsFor(st, fam, cls) {
  if (!WM_FAMILIES[fam] || !st) return [];
  const mods = wmCapMods(fam, st.board || {});
  const list = WM_ART_UNLOCK.map((need, i) => st.sl >= need ? wmModArt(WM_ARTS[wmArtId(fam, i)], mods[i]) : null).filter(Boolean);
  const sig = WM_CLASS_WEAPONS[cls];
  if (sig && sig.fam === fam && st.sl >= WM_SIGNATURE_UNLOCK) list.push(WM_ARTS[wmSigId(cls)]);
  return list;
}
// convert the old 1-30 mastery (tnl_systems.js) into weapon skill, once
const wmFromOldMastery = lvl => 1 + Math.max(0, Math.min(29, (Math.floor(lvl) || 1) - 1)) * 8;

const GBQWeaponMastery = { WM_SKILL_MAX, WM_MASTERY_MAX, WM_SKILL_PER_MASTERY, WM_BRANCH_UNLOCK, WM_ART_UNLOCK, WM_SIGNATURE_UNLOCK, WM_SIGNATURE_XP, WM_FREE_RESPEC, WM_RINGS, WM_STEP, WM_THEMES,
  WM_FAMILIES, WM_FAMS, WM_CLASS_WEAPONS, WM_ARTS, wmArtId, wmSigId, wmModArt, wmNew, wmNorm, wmSkillXpFor, wmMasteryXpFor, wmMasteryCap, wmAddSkillXp, wmAddMasteryXp,
  wmBattleXp, wmRank, wmNodes: wmNodesOf, wmNode, wmSpent, wmBranchSpent, wmPoints, wmBranchOpen, wmCanSpend, wmSpend, wmRespecCost, wmRespec, wmTrim, wmBoardStats, wmTraits,
  wmTraitStats, wmCapMods, wmBonus, wmArtsFor, wmFromOldMastery };
if (typeof globalThis !== 'undefined') globalThis.GBQWeaponMastery = GBQWeaponMastery;

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Battle !== 'undefined' && typeof derive === 'function') {
  const isHero = c => typeof G !== 'undefined' && G && c === G;
  const famOf = it => {
    if (!it || it.kind !== 'weapon') return null;
    const w = typeof WEAPONS !== 'undefined' && WEAPONS[it.base];
    const f = (w && w.fam) || (typeof WEAPON_ART !== 'undefined' && WEAPON_ART[it.base]) || 'sword';
    return WM_FAMILIES[f] ? f : 'sword';
  };
  const curFam = () => G && G.eq ? famOf(G.eq.weapon) : null;
  // per-family progress, created on first use; the old 1-30 mastery becomes starting weapon skill once
  function wmState(fam) {
    const all = (G.wm ||= {});
    if (!G.wmMigrated) {
      G.wmMigrated = true;
      for (const [f, old] of Object.entries(G.mastery || {})) if (WM_FAMILIES[f] && old && old.lvl > 1) { const st = wmNorm(all[f]); st.sl = Math.max(st.sl, wmFromOldMastery(old.lvl)); all[f] = st; }
    }
    if (!all[fam]) all[fam] = wmNew();
    return wmTrim(wmNorm(all[fam]), fam);
  }
  const sigOf = () => WM_CLASS_WEAPONS[G.cls];
  const statLine = list => list.length ? list.map(([s, v]) => `${((typeof SUBSTATS !== 'undefined' && SUBSTATS[s]) || { name: s.toUpperCase() }).name} +${v}`).join(', ') : 'nothing yet';

  // ------------------------------------------------ stats while the family is equipped
  { const sb0 = armorSetBonus; armorSetBonus = function (c) {
      const out = sb0.apply(this, arguments);
      try { if (isHero(c)) { const f = famOf(c.eq && c.eq.weapon); if (f) out.push(...wmBonus(wmState(f), f)); } } catch (e) { console.warn('weapon mastery stats', e); }
      return out;
    }; }

  // ------------------------------------------------ weapon arts join the combat arts
  Object.assign(ART_BY_ID, WM_ARTS);
  const heroWeaponArts = c => { const f = famOf(c.eq && c.eq.weapon); return f ? wmArtsFor(wmState(f), f, c.cls) : []; };
  { const a0 = artsFor; artsFor = function (c) { const L = a0.apply(this, arguments); try { if (isHero(c)) L.push(...heroWeaponArts(c)); } catch (e) { console.warn('weapon arts', e); } return L; }; }
  { const l0 = artLoadout; artLoadout = function (c) {
      const L = l0.apply(this, arguments);
      if (!isHero(c)) return L;
      const now = Object.fromEntries(heroWeaponArts(c).map(a => [a.id, a]));      // capstone-upgraded copies
      return L.map(a => now[a.id] || a);
    }; }
  if (typeof ArtsScene !== 'undefined') {                                         // show weapon skill needed, not a level
    const d0 = ArtsScene.prototype.draw; ArtsScene.prototype.draw = function () {
      d0.apply(this, arguments);
      const L = this.list();
      L.slice(this.top, this.top + 7).forEach((a, j) => { if (a.g !== 'weapon') return; const i = this.top + j, y = 14 + j * 11; fill(112, y - 1, 47, 10, i === this.i ? 1 : 0); textR(a.sig ? 'CLASS WPN' : `${(WM_FAMILIES[a.fam] || { name: '' }).name.slice(0, 4)} ${a.wsl}`, 157, y, a.sig ? 'gold' : 'orange'); });
    };
  }

  // ------------------------------------------------ XP from won battles
  { const f0 = Battle.prototype.finish; Battle.prototype.finish = function (result) {
      try {
        const fam = curFam();
        if (result === 'win' && G && !this.noRewards && fam) {
          const st = wmState(fam), sig = sigOf(), isSig = !!(sig && sig.fam === fam);
          const xp = wmBattleXp((this.foes || []).map(f => ({ lvl: f.lvl, elite: f.elite, boss: f.boss })), G.lvl, isSig);
          const s0 = st.sl, m0 = st.ml, su = wmAddSkillXp(st, xp.skill), mu = wmAddMasteryXp(st, xp.mastery), F = WM_FAMILIES[fam];
          if (su) {
            const art = WM_ART_UNLOCK.findIndex(l => l > s0 && l <= st.sl), sigNew = isSig && s0 < WM_SIGNATURE_UNLOCK && st.sl >= WM_SIGNATURE_UNLOCK;
            if (sigNew) toast(`${sig.weapon} AWAKENS`, `Class art: ${sig.art.name}`, 'pp_xp', 'levelup');
            else if (art >= 0) toast(`${F.name} SKILL ${st.sl}`, `New art: ${F.arts[art].name}`, 'pp_xp', 'levelup');
            else if (Math.floor(st.sl / 10) > Math.floor(s0 / 10)) toast(`${F.name} SKILL ${st.sl}`, `Mastery cap ${wmMasteryCap(st.sl)}`, 'pp_xp', 'levelup');
          }
          if (mu) {
            const br = WM_BRANCH_UNLOCK.findIndex(l => l > m0 && l <= st.ml);
            toast(`${F.name} MASTERY ${st.ml}`, br >= 0 ? `Branch open: ${F.branches[br][1]}` : `+${mu} board point${mu > 1 ? 's' : ''}`, 'pp_xp', 'levelup');
          }
          if ((su || mu) && typeof chatLog === 'function') chatLog('xp', 'MASTERY', `${F.name}: skill ${st.sl}/${WM_SKILL_MAX}, mastery ${st.ml}/${wmMasteryCap(st.sl)} (${wmRank(st.ml)}).`);
        }
      } catch (e) { console.warn('weapon mastery xp', e); }
      return f0.apply(this, arguments);
    }; }

  // ------------------------------------------------ circle board screen
  const RING_R = [18, 29, 40, 50], RING_SPREAD = [[-22.5, -7.5, 7.5, 22.5], [-16, 0, 16], [-8, 8], [0]];
  const CX = 80, CY = 63;
  const nodePos = n => { const a = (-90 + n.branch * 60 + RING_SPREAD[n.ring][n.n]) * Math.PI / 180; return [Math.round(CX + Math.cos(a) * RING_R[n.ring]), Math.round(CY + Math.sin(a) * RING_R[n.ring])]; };
  const dot = (x, y, c) => fill(x, y, 1, 1, c);
  function line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i += 2) dot(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); }
  class WmBoardScene {
    constructor(fam) { this.opaque = true; this.fam = fam; this.b = 0; this.k = 0; this.msg = ''; this.page = 0; }
    get st() { return wmState(this.fam); }
    nodesOf(b) { return wmNodesOf(this.fam).filter(n => n.branch === b); }
    cur() { return this.nodesOf(this.b)[this.k]; }
    update() {
      if (P('b')) { SFX.back(); removeScene(this); return; }
      if (P('select')) { this.page = 1 - this.page; SFX.page(); }
      if (nav('left')) { this.b = (this.b + 5) % 6; this.k = Math.min(this.k, 9); SFX.cursor(); this.msg = ''; }
      if (nav('right')) { this.b = (this.b + 1) % 6; SFX.cursor(); this.msg = ''; }
      if (nav('up')) { this.k = (this.k + 9) % 10; SFX.cursor(); this.msg = ''; }
      if (nav('down')) { this.k = (this.k + 1) % 10; SFX.cursor(); this.msg = ''; }
      if (P('a') && this.page === 0) {
        const n = this.cur(), r = wmSpend(this.st, this.fam, n.id);
        if (r.ok) { SFX.confirm(); this.msg = n.cap ? `${n.name} TAKEN` : 'RANK UP'; saveGame(); } else { SFX.error(); this.msg = r.why.toUpperCase(); }
        this.msgOk = r.ok;
      }
    }
    draw() {
      const st = this.st, F = WM_FAMILIES[this.fam], br = F.branches[this.b];
      fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
      textC(`${F.name} BOARD  PTS ${wmPoints(st)}/${st.ml}`, 80, 1, 'gold');
      if (this.page === 1) return this.drawBranch(st, F, br);
      // rings and spokes
      for (const R of RING_R) for (let d = 0; d < 360; d += 8) { const a = d * Math.PI / 180; dot(Math.round(CX + Math.cos(a) * R), Math.round(CY + Math.sin(a) * R), 1); }
      for (let b = 0; b < 6; b++) { const a = (-90 + b * 60) * Math.PI / 180; line(CX, CY, Math.round(CX + Math.cos(a) * RING_R[3]), Math.round(CY + Math.sin(a) * RING_R[3]), wmBranchOpen(st.ml, b) ? 2 : 1); }
      fill(CX - 3, CY - 3, 7, 7, 'gold'); fill(CX - 1, CY - 1, 3, 3, 0);
      for (const n of wmNodesOf(this.fam)) {
        const [x, y] = nodePos(n), r = st.board[n.id] || 0, s = n.cap ? 5 : 3, h = s >> 1;
        const open = wmBranchOpen(st.ml, n.branch) && wmBranchSpent(st.board, n.branch) >= WM_RINGS[n.ring].need;
        fill(x - h, y - h, s, s, r >= n.max ? 'green' : r > 0 ? 'gold' : open ? 3 : 1);
        if (n.cap && !r) fill(x - 1, y - 1, 3, 3, 0);
      }
      const n = this.cur(), [x, y] = nodePos(n), s = n.cap ? 9 : 7, h = s >> 1;
      if ((frameN >> 4) % 2 === 0) { fill(x - h, y - h, s, 1, 'red'); fill(x - h, y + h, s, 1, 'red'); fill(x - h, y - h, 1, s, 'red'); fill(x + h, y - h, 1, s, 'red'); }
      // node details
      frame(0, 116, 160, 28);
      const rank = st.board[n.id] || 0;
      const title = n.cap ? n.name : ((typeof SUBSTATS !== 'undefined' && SUBSTATS[n.stat]) || { name: n.stat.toUpperCase() }).name;
      text(`${br[1]}: ${title}`.slice(0, 21), 3, 118, wmBranchOpen(st.ml, this.b) ? 'gold' : 1); textR(`${rank}/${n.max}`, 157, 118, rank >= n.max ? 'green' : 2);
      text((n.cap ? n.desc : `${WM_RINGS[n.ring].name} +${Math.round(n.per * 100) / 100}/RANK ${n.cost}PT`).slice(0, 26), 3, 126, 3);
      const can = wmCanSpend(st, this.fam, n.id);
      text((this.msg || (can.ok ? 'A: SPEND  SELECT: BRANCH' : can.why.toUpperCase())).slice(0, 26), 3, 134, this.msg ? (this.msgOk ? 'green' : 'red') : can.ok ? 1 : 'red');
    }
    drawBranch(st, F, br) {
      const t = wmTraits(this.fam, st.ml)[this.b], open = wmBranchOpen(st.ml, this.b);
      textC(`< BRANCH ${this.b + 1}: ${br[1]} >`, 80, 15, open ? 'gold' : 2);
      text(open ? `OPEN. ${wmBranchSpent(st.board, this.b)} OF 52 PTS SPENT` : `OPENS AT MASTERY ${WM_BRANCH_UNLOCK[this.b]}`, 5, 27, open ? 'green' : 'red');
      text(`TRAIT: ${t.name}`.slice(0, 25), 5, 41, 'gold');
      text(wrap(`Now: ${statLine(t.stats.filter(([, v]) => v > 0))}`, 25).slice(0, 2).join('\n'), 5, 50, 3);
      text(wrap(`At 200: ${statLine(t.full)}`, 25).slice(0, 2).join('\n'), 5, 68, 2);
      text(`CAPSTONE: ${br[3]}`.slice(0, 25), 5, 86, 'gold');
      text(wrap(br[6], 25).slice(0, 2).join('\n'), 5, 95, 3);
      text('RINGS NEED 0/6/14/24 PTS', 5, 115, 1);
      text('LEFT/RIGHT: BRANCH', 5, 125, 1); text('SELECT: BOARD  B: BACK', 5, 134, 1);
    }
  }

  // ------------------------------------------------ menus
  function wmFamilyMenu(fam) {
    const st = wmState(fam), F = WM_FAMILIES[fam], sig = sigOf(), isSig = sig && sig.fam === fam;
    const cost = wmRespecCost(st, G.lvl);
    choose(['CIRCLE BOARD', 'TRAITS', 'WEAPON ARTS', `RESPEC${wmSpent(st.board) ? cost ? ` ${fmt(cost)}G` : ' (FREE)' : ''}`, 'BACK'], k => {
      if (k === 0) { SFX.select(); push(new WmBoardScene(fam)); return; }
      if (k === 1) return say(wmTraits(fam, st.ml).map(t => `${t.name} (${t.open ? 'ON' : `MASTERY ${t.unlock}`}): ${statLine(t.open ? t.stats : t.full)}${t.open ? '' : ' at 200'}.`), () => wmFamilyMenu(fam));
      if (k === 2) {
        const arts = wmArtsFor(st, fam, G.cls), have = new Set(arts.map(a => a.id));
        const lines = F.arts.map((a, i) => `${a.name} (SKILL ${WM_ART_UNLOCK[i]})${have.has(wmArtId(fam, i)) ? '' : ' LOCKED'}: ${a.desc}`);
        if (isSig) lines.push(`${sig.weapon} CLASS ART ${sig.art.name} (SKILL ${WM_SIGNATURE_UNLOCK})${have.has(wmSigId(G.cls)) ? '' : ' LOCKED'}: ${sig.art.desc}`);
        lines.push('Equip them in MENU > COMBAT ARTS while this weapon is in hand.');
        return say(lines, () => wmFamilyMenu(fam));
      }
      if (k === 3) {
        if (!wmSpent(st.board)) return say('Nothing to refund.', () => wmFamilyMenu(fam));
        return choose(['YES', 'NO'], y => {
          if (y !== 0) return wmFamilyMenu(fam);
          if ((G.gold || 0) < cost) return say(`You need ${fmt(cost)} gold.`, () => wmFamilyMenu(fam));
          G.gold -= cost; wmRespec(st); saveGame(); SFX.confirm(); say(`${F.name} board refunded: ${st.ml} points.`, () => wmFamilyMenu(fam));
        }, `Refund all ${wmSpent(st.board)} points for ${cost ? fmt(cost) + ' gold' : 'free'}?`);
      }
      wmMenu();
    }, `${isSig ? '+' : ''}${F.name} SKILL ${st.sl}${st.sl < WM_SKILL_MAX ? ` (${Math.floor(100 * st.sx / wmSkillXpFor(st.sl))}%)` : ''}. MASTERY ${st.ml}/${wmMasteryCap(st.sl)}, ${wmPoints(st)} PT${wmPoints(st) === 1 ? '' : 'S'} FREE.`);
  }
  function wmMenu() {
    const cur = curFam(), sig = sigOf();
    const fams = WM_FAMS.slice().sort((a, b) => (b === cur) - (a === cur) || (sig && (b === sig.fam) - (a === sig.fam)) || 0);
    choose([...fams.map(f => { const st = (G.wm && G.wm[f]) ? wmState(f) : null; return `${f === cur ? '*' : sig && f === sig.fam ? '+' : ' '}${WM_FAMILIES[f].name} S${st ? st.sl : 1} M${st ? st.ml : 1}`.slice(0, 22); }), 'CLASS WEAPON', 'BACK'], k => {
      if (k >= 0 && k < fams.length) return wmFamilyMenu(fams[k]);
      if (k === fams.length) return say(sig ? [`${CLASSES[G.cls].name} CLASS WEAPON: ${sig.weapon}, a ${WM_FAMILIES[sig.fam].name}.`, `+25% weapon skill and mastery XP with every ${WM_FAMILIES[sig.fam].name}.`, `At ${WM_FAMILIES[sig.fam].name} skill ${WM_SIGNATURE_UNLOCK}: ${sig.art.name}. ${sig.art.desc}`] : 'Your class has no signature weapon.', wmMenu);
    }, `WEAPON MASTERY. * IN HAND, + CLASS WEAPON${cur ? `. NOW: ${WM_FAMILIES[cur].name}` : ''}`);
  }
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { MASTERY: 'Weapon skill, mastery and circle boards.' });
  if (typeof MainMenu !== 'undefined') {                                          // the MASTERY entry already exists (tnl_systems.js)
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () {
      if (P('a') && (this.items()[this.i] || '') === 'MASTERY') { SFX.select(); return wmMenu(); }
      return u0.apply(this, arguments);
    };
  }
  window.GBQWeaponMasteryUI = { wmMenu, WmBoardScene, wmState };
}
})();
