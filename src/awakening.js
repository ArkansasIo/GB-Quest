'use strict';
(() => { // own scope: the game loads every module as a classic script sharing one global scope
// ================================================================ AWAKENING: post-cap class evolution (MAIN MENU > AWAKENING)
// Class features stop at level 20; AWAKENING is what each class grows into across the ascension levels.
//   * CLASS AWAKENING: five tiers, unlocked at hero level 60 / 150 / 270 / 420 / 600 and paid for in gold.
//       Every tier adds the class's own substats. Tier I unlocks the class's AWAKENED ULTIMATE (once per
//       battle). Tier III adds a battle-start buff. Tier V empowers both (longer buff, bigger ultimate).
//   * Three AWAKENING TRACKS (ranks 0-10) are bought with AWAKENING POINTS (AP):
//       TALENT  - every learned talent's bonuses +10% per rank.
//       SPELL   - +3% elemental and healing power per rank, +1 spell DC/attack at ranks 4/7/10,
//                 +1 top-level spell slot at ranks 5 and 10 (pact casters +1 pact slot at 10).
//       ABILITY - +1.5% crit and +5% crit damage per rank, +1 class resource charge at ranks 3/6/9,
//                 +1 use of each active skill per battle at ranks 5 and 10, ultimate +1 power per rank.
//   * AP: 2 per class tier, plus 1 per 20 hero levels past 60 (43 at level 720). Ranks 1-4 cost 1 AP,
//     5-7 cost 2, 8-10 cost 3 (19 per track, 57 for all three): not every track can be maxed.
//     A track can go no higher than 2x the class tier.
//   * GOD-TIER TALENTS (class tier III+): four pantheons - WAR, ARCANA, LIFE, SHADOW - of five ranks each,
//     bought with DIVINITY POINTS (DP): 1 per 30 levels past 270, +2 at tier IV, +3 at tier V (20 at 720).
//     Ranks cost 1/1/2/2/3 DP (9 per pantheon, 36 for all). Rank 5 of a pantheon is its GOD CAPSTONE,
//     and a hero may hold only ONE capstone: you choose your god.
//   * Tracks and god talents reset for gold; class tiers are permanent.
// Pure rules are exported as GBQAwakening for tests; the game wiring runs only inside the game.

const AWAKEN_TIERS = [
  { n: 1, lvl: 60, gold: 2000, name: 'I' },
  { n: 2, lvl: 150, gold: 8000, name: 'II' },
  { n: 3, lvl: 270, gold: 25000, name: 'III' },
  { n: 4, lvl: 420, gold: 60000, name: 'IV' },
  { n: 5, lvl: 600, gold: 150000, name: 'V' },
];
const AWAKEN_MAX_TIER = AWAKEN_TIERS.length, TRACK_MAX = 10;
const TRACKS = {
  talent: { name: 'TALENT', desc: 'Learned talent bonuses +10% per rank.' },
  spell: { name: 'SPELL', desc: '+3% elemental and healing power per rank. +1 DC/attack at 4/7/10. +1 top slot at 5 and 10.' },
  ability: { name: 'ABILITY', desc: '+1.5% crit, +5% crit damage per rank. +1 resource at 3/6/9. +1 skill use at 5 and 10.' },
};
const TRACK_IDS = Object.keys(TRACKS);

// ult kinds: strike (weapon blow, `hits` blows), nova (all foes, save for half), bolt (one foe, spell attack),
// mend (heal all allies by % of max HP), guard (party buffs), summon (spirit wolves)
const AWAKEN_CLASSES = {
  warden: { name: 'IRONCLAD SENTINEL', per: { acb: 1, block: 3, hpPct: 3 }, start: 'fortify',
    ult: { kind: 'guard', name: 'BULWARK OATH', buffs: ['fortify', 'bless'], rounds: 3, sfx: 'buff' }, desc: 'An unbreakable wall. The party stands behind its oath.' },
  berserker: { name: 'WORLDBREAKER', per: { dmg: 5, leech: 1, critdmg: 6 }, start: 'might',
    ult: { kind: 'strike', name: 'CATACLYSM', self: 'frenzy', sfx: 'roar' }, desc: 'Rage that splits mountains and feeds on the wound.' },
  vanguard: { name: 'ARBITER OF DAWN', per: { acb: 1, radiant: 6, resist: 2 }, start: 'bless',
    ult: { kind: 'nova', name: 'JUDGEMENT', dt: 'radiant', save: 'CON', school: 'aegis' }, desc: 'Oath made law. Light passes sentence on every foe.' },
  strider: { name: 'STORMRANGER', per: { crit: 2, hit: 1, dmg: 3 }, start: 'focus',
    ult: { kind: 'nova', name: 'ARROW STORM', dt: 'piercing', save: 'DEX', school: 'storm' }, desc: 'The hunt becomes a tempest of arrows.' },
  shade: { name: 'NIGHTBLADE', per: { crit: 3, critdmg: 8, dodge: 2 }, start: 'trueveil',
    ult: { kind: 'strike', name: 'DEATHMARK', mark: 'vulnerable', sfx: 'veil_cast' }, desc: 'Marks a victim, then ends it from the dark.' },
  ascetic: { name: 'ENLIGHTENED FIST', per: { haste: 3, dodge: 2, hit: 1 }, start: 'haste',
    ult: { kind: 'strike', name: 'HUNDRED PALMS', hits: 3, sfx: 'buff' }, desc: 'Stillness so complete the body moves faster than sight.' },
  arcanist: { name: 'ARCHMAGUS', per: { fire: 5, cold: 5, lightning: 5 }, start: 'focus',
    ult: { kind: 'nova', name: 'ASTRAL RUIN', dt: 'force', save: 'DEX', school: 'storm' }, desc: 'Master of all eight schools. The sky itself answers.' },
  wildblood: { name: 'DRACOSOVEREIGN', per: { fire: 8, critdmg: 6, crit: 1 }, start: 'might',
    ult: { kind: 'nova', name: 'WYRMFIRE', dt: 'fire', save: 'DEX', school: 'flux' }, desc: 'The dragon in the blood wakes fully.' },
  pactbound: { name: 'VOIDSWORN', per: { necrotic: 8, leech: 1, hit: 1 }, start: 'focus',
    ult: { kind: 'bolt', name: "PATRON'S MAW", dt: 'necrotic', school: 'omen', mark: 'doomed' }, desc: 'The patron looks through your eyes and bites.' },
  cantor: { name: 'MAESTRO ETERNAL', per: { heal: 6, resist: 2, haste: 2 }, start: 'bless',
    ult: { kind: 'guard', name: 'GRAND OPUS', buffs: ['inspired', 'haste'], rounds: 2, sfx: 'charm' }, desc: 'A song the whole party moves to.' },
  chaplain: { name: 'LANTERN SAINT', per: { heal: 8, radiant: 4, resist: 2 }, start: 'regen',
    ult: { kind: 'mend', name: 'LANTERN MIRACLE', pct: 30, buff: 'fortify' }, desc: 'The Lantern burns through you for everyone you shelter.' },
  verdant: { name: 'ELDER GROVE', per: { heal: 6, hpPct: 3, thorns: 4 }, start: 'thornskin',
    ult: { kind: 'mend', name: 'WORLDTREE BLOOM', pct: 22, buff: 'regen' }, desc: 'Roots under the whole battlefield.' },
  necromancer: { name: 'LICH ASCENDANT', per: { necrotic: 8, leech: 2, hpPct: 2 }, start: 'fortify',
    ult: { kind: 'nova', name: 'GRAVE TIDE', dt: 'necrotic', save: 'CON', school: 'grave', mark: 'weakened' }, desc: 'Death answers to you now, not the other way.' },
  summoner: { name: 'VEILCALLER', per: { dmg: 3, heal: 3, resist: 2 }, start: 'bless',
    ult: { kind: 'summon', name: 'SPIRIT LEGION', count: 2, sfx: 'growl' }, desc: 'The veil opens and a pack comes through.' },
  sunwarden: { name: 'DAWNBRINGER', per: { radiant: 6, heal: 4, acb: 1 }, start: 'regen',
    ult: { kind: 'mend', name: 'NOONTIDE', pct: 24, buff: 'bless' }, desc: 'Noon light that heals friends and blinds the dark.' },
  runeblade: { name: 'RUNELORD', per: { cold: 6, resist: 2, dmg: 3 }, start: 'fortify',
    ult: { kind: 'strike', name: 'RUNIC REQUIEM', mark: 'frostbite', sfx: 'shock' }, desc: 'Every rune on the armour sings at once.' },
  // jobs (src/jobs_data.js)
  ronin: { name: 'KENSEI', per: { crit: 2, critdmg: 8, hit: 1 }, start: 'focus',
    ult: { kind: 'strike', name: 'VOID CUT', mark: 'bleeding', sfx: 'buff' }, desc: 'One stroke, so perfect the air forgets it happened.' },
  shinobi: { name: 'SHADOW SHOGUN', per: { dodge: 3, crit: 2, dmg: 3 }, start: 'trueveil',
    ult: { kind: 'strike', name: 'THOUSAND STARS', hits: 2, mark: 'bleeding', sfx: 'veil_cast' }, desc: 'A storm of shuriken from a hundred false images.' },
  bladedancer: { name: 'EVERDANCER', per: { dodge: 2, heal: 5, haste: 2 }, start: 'haste',
    ult: { kind: 'mend', name: 'ENDLESS WALTZ', pct: 20, buff: 'haste' }, desc: 'The dance never ends, and neither do your friends.' },
  wyrmlancer: { name: 'SKYWYRM LORD', per: { dmg: 4, critdmg: 6, acb: 1 }, start: 'might',
    ult: { kind: 'strike', name: 'DRAGONFALL', mark: 'sundered', sfx: 'roar' }, desc: 'Rider and wyvern fall from the sky as one spear.' },
  corsair: { name: 'DREAD ADMIRAL', per: { crit: 2, fire: 4, gf: 5 }, start: 'focus',
    ult: { kind: 'nova', name: 'BROADSIDE', dt: 'fire', save: 'DEX', school: 'flux' }, desc: 'Every phantom cannon on the phantom fleet fires.' },
  beastcaller: { name: 'PRIMAL KHAN', per: { hpPct: 3, dmg: 3, leech: 1 }, start: 'fortify',
    ult: { kind: 'summon', name: 'WILD STAMPEDE', count: 2, sfx: 'growl' }, desc: 'The whole wild answers one call.' },
  puppeteer: { name: 'GRAND ARTIFICER', per: { acb: 1, block: 3, resist: 2 }, start: 'fortify',
    ult: { kind: 'guard', name: 'IRON COLOSSUS', buffs: ['fortify', 'thornskin'], rounds: 3, sfx: 'buff' }, desc: 'The automaton unfolds into a fortress of brass.' },
  dreadknight: { name: 'DEATHLESS LORD', per: { leech: 2, resist: 2, necrotic: 5 }, start: 'fortify',
    ult: { kind: 'strike', name: 'SOUL REAPER', mark: 'weakened', sfx: 'shock' }, desc: 'The grave let you go. Now it collects through you.' },
  voidhunter: { name: 'VOIDSEER', per: { crit: 2, hit: 1, critdmg: 6 }, start: 'foresight',
    ult: { kind: 'strike', name: 'ABYSSAL HUNT', hits: 2, mark: 'vulnerable', sfx: 'veil_cast' }, desc: 'Sightless eyes that see every weakness in the void.' },
  scalesage: { name: 'ELDER WYRMSAGE', per: { fire: 6, heal: 5, hpPct: 2 }, start: 'bless',
    ult: { kind: 'mend', name: 'EMERALD BREATH', pct: 24, buff: 'fortify' }, desc: 'Dragon breath of emerald light that knits the living.' },
  stormcaller: { name: 'STORM SOVEREIGN', per: { lightning: 8, heal: 4, haste: 2 }, start: 'bless',
    ult: { kind: 'nova', name: 'SKYFATHER WRATH', dt: 'lightning', save: 'DEX', school: 'storm', mark: 'shocked' }, desc: 'The totems become the storm itself.' },
};

// ---------------------------------------------------------------- god-tier talents
// each pantheon: five ranks; rank 5 is the capstone (`start`: a battle-start buff, `ultPower`: ultimate power)
const GOD_TIER_MIN = 3, GOD_RANKS = 5;
const GOD_PANTHEONS = {
  war: { name: 'WAR', god: 'KARRATH THE UNBOWED', ranks: [
    { name: 'GODFORGED ARMS', mods: { dmg: 8 } },
    { name: 'BATTLE HYMN', mods: { hit: 2, crit: 3 } },
    { name: 'TITAN SINEW', mods: { dmg: 12, critdmg: 15 } },
    { name: 'UNBROKEN LINE', mods: { resist: 6, hpPct: 6 } },
    { name: 'GODSLAYER', mods: { dmg: 25, critdmg: 40 }, start: 'might', capstone: 'Battles open MIGHTY (3 rnds). +25% damage, +40% crit damage.' },
  ] },
  arcana: { name: 'ARCANA', god: 'VESHA OF THE EIGHT STARS', ranks: [
    { name: 'STARBORN MIND', mods: { fire: 6, cold: 6, lightning: 6 } },
    { name: 'SPELLWEAVE', mods: { necrotic: 6, radiant: 6, crit: 2 } },
    { name: 'ASTRAL FONT', mods: { fire: 10, cold: 10, lightning: 10 } },
    { name: 'TIME SLIP', mods: { haste: 8 } },
    { name: 'APOTHEOSIS', mods: { fire: 20, cold: 20, lightning: 20, necrotic: 20, radiant: 20 }, start: 'focus', ultPower: 3, capstone: 'Battles open FOCUSED (3 rnds). +20% all elements, ultimate +3 power.' },
  ] },
  life: { name: 'LIFE', god: 'AMARA THE EVERBLOOM', ranks: [
    { name: 'DIVINE VIGOR', mods: { hpPct: 6 } },
    { name: 'GRACE', mods: { heal: 10 } },
    { name: 'SANCTUARY', mods: { resist: 5, acb: 1 } },
    { name: 'EVERBLOOM', mods: { heal: 15, leech: 2 } },
    { name: 'IMMORTAL', mods: { hpPct: 15, heal: 25, resist: 8 }, start: 'regen', capstone: 'Battles open REGENERATING (3 rnds). +15% HP, +25% healing, +8% resist.' },
  ] },
  shadow: { name: 'SHADOW', god: 'NYX WHO WALKS UNSEEN', ranks: [
    { name: 'VEILSTEP', mods: { dodge: 4 } },
    { name: 'NIGHT EYES', mods: { crit: 4 } },
    { name: 'BLOOD MOON', mods: { leech: 3, critdmg: 20 } },
    { name: 'UMBRAL CLOAK', mods: { dodge: 5, necrotic: 10 } },
    { name: 'GOD OF KNIVES', mods: { crit: 10, critdmg: 50, dodge: 5 }, start: 'trueveil', capstone: 'Battles open VEILED (3 rnds). +10% crit, +50% crit damage, +5% dodge.' },
  ] },
};
const GOD_IDS = Object.keys(GOD_PANTHEONS);
const godRankCost = rank => [0, 1, 1, 2, 2, 3][rank] || 0;
const godSpentOn = rank => { let n = 0; for (let r = 1; r <= rank; r++) n += godRankCost(r); return n; };
const dpTotal = (tier, lvl) => (tier >= GOD_TIER_MIN ? Math.floor(Math.max(0, (Number(lvl) || 0) - 270) / 30) + (tier >= 4 ? 2 : 0) + (tier >= 5 ? 3 : 0) : 0);
const dpSpent = a => GOD_IDS.reduce((n, g) => n + godSpentOn(a.god[g] || 0), 0);
const dpFree = (a, lvl) => dpTotal(a.tier, lvl) - dpSpent(a);
const godCapstone = a => GOD_IDS.find(g => (a.god[g] || 0) >= GOD_RANKS) || null;
function godBlock(a, lvl, g) {
  if (!GOD_PANTHEONS[g]) return 'Unknown pantheon.';
  if (a.tier < GOD_TIER_MIN) return `Reach class tier ${AWAKEN_TIERS[GOD_TIER_MIN - 1].name}.`;
  const r = a.god[g] || 0;
  if (r >= GOD_RANKS) return 'Pantheon complete.';
  if (r + 1 === GOD_RANKS) { const cap = godCapstone(a); if (cap && cap !== g) return `You already serve ${GOD_PANTHEONS[cap].god}.`; }
  if (dpFree(a, lvl) < godRankCost(r + 1)) return `Needs ${godRankCost(r + 1)} DP.`;
  return null;
}
function godSub(a) {
  const s = {};
  if (a.tier < GOD_TIER_MIN) return s;
  for (const g of GOD_IDS) for (let r = 0; r < (a.god[g] || 0); r++) for (const [k, v] of Object.entries(GOD_PANTHEONS[g].ranks[r].mods)) s[k] = (s[k] || 0) + v;
  return s;
}
const godCapDef = a => { const g = godCapstone(a); return g ? GOD_PANTHEONS[g].ranks[GOD_RANKS - 1] : null; };

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
// a clean awakening record (old or hand-edited saves are repaired)
function normAwaken(a) {
  const o = a && typeof a === 'object' ? a : {}, r = o.ranks && typeof o.ranks === 'object' ? o.ranks : {}, gd = o.god && typeof o.god === 'object' ? o.god : {};
  const tier = clampInt(o.tier, 0, AWAKEN_MAX_TIER), ranks = {}, god = {};
  for (const t of TRACK_IDS) ranks[t] = clampInt(r[t], 0, Math.min(TRACK_MAX, tier * 2));
  let capTaken = false;
  for (const g of GOD_IDS) {
    let v = tier >= GOD_TIER_MIN ? clampInt(gd[g], 0, GOD_RANKS) : 0;
    if (v >= GOD_RANKS) { if (capTaken) v = GOD_RANKS - 1; capTaken = true; }
    god[g] = v;
  }
  return { tier, ranks, god };
}
// the highest tier a hero of this level may hold
const tierCapForLevel = lvl => AWAKEN_TIERS.filter(t => (Number(lvl) || 0) >= t.lvl).length;
const nextTier = tier => AWAKEN_TIERS[clampInt(tier, 0, AWAKEN_MAX_TIER)] || null;
// AP earned: 2 per tier + 1 per 20 levels past 60 (only once awakened)
const apTotal = (tier, lvl) => (tier > 0 ? 2 * tier + Math.floor(Math.max(0, (Number(lvl) || 0) - 60) / 20) : 0);
const rankCost = rank => (rank <= 4 ? 1 : rank <= 7 ? 2 : 3); // cost of buying this rank
const trackSpent = rank => { let n = 0; for (let r = 1; r <= rank; r++) n += rankCost(r); return n; };
const apSpent = a => TRACK_IDS.reduce((n, t) => n + trackSpent(a.ranks[t] || 0), 0);
const apFree = (a, lvl) => apTotal(a.tier, lvl) - apSpent(a);
const trackCap = tier => Math.min(TRACK_MAX, 2 * tier);
const resetCost = a => 500 * (apSpent(a) + 2 * dpSpent(a)) * Math.max(1, a.tier);
// can this track be raised one rank? -> null when yes, else the reason
function raiseBlock(a, lvl, track) {
  if (!TRACKS[track]) return 'Unknown track.';
  if (a.tier < 1) return 'Awaken your class first.';
  const r = a.ranks[track] || 0;
  if (r >= TRACK_MAX) return 'Track is at maximum rank.';
  if (r >= trackCap(a.tier)) return `Class tier ${AWAKEN_TIERS[a.tier - 1].name} caps tracks at rank ${trackCap(a.tier)}.`;
  if (apFree(a, lvl) < rankCost(r + 1)) return `Needs ${rankCost(r + 1)} AP.`;
  return null;
}
// can the class awaken one more tier? -> null when yes, else the reason
function tierBlock(a, lvl, gold) {
  const t = nextTier(a.tier); if (!t) return 'Fully awakened.';
  if ((Number(lvl) || 0) < t.lvl) return `Reach level ${t.lvl}.`;
  if ((Number(gold) || 0) < t.gold) return `Needs ${t.gold} G.`;
  return null;
}
const ELEMS = ['fire', 'cold', 'lightning', 'necrotic', 'radiant'];
// substats from awakening. talentMods: the summed mods of the hero's learned talents.
function awakenSub(a, cls, talentMods) {
  const s = {}, add = (k, v) => { if (v) s[k] = Math.round(((s[k] || 0) + v) * 100) / 100; };
  const def = AWAKEN_CLASSES[cls]; if (!def || a.tier < 1) return s;
  for (const [k, v] of Object.entries(def.per)) add(k, v * a.tier);
  const tr = a.ranks.talent || 0;
  if (tr) for (const [k, v] of Object.entries(talentMods || {})) add(k, v * 0.1 * tr);
  const sr = a.ranks.spell || 0;
  if (sr) { for (const e of ELEMS) add(e, 3 * sr); add('heal', 3 * sr); }
  const ar = a.ranks.ability || 0;
  if (ar) { add('crit', 1.5 * ar); add('critdmg', 5 * ar); }
  for (const [k, v] of Object.entries(godSub(a))) add(k, v);
  return s;
}
const spellDcBonus = a => [4, 7, 10].filter(r => (a.ranks.spell || 0) >= r).length;
const spellSlotBonus = a => [5, 10].filter(r => (a.ranks.spell || 0) >= r).length;
const resourceBonus = a => [3, 6, 9].filter(r => (a.ranks.ability || 0) >= r).length;
const skillUsesPerBattle = a => 1 + [5, 10].filter(r => (a.ranks.ability || 0) >= r).length;
const startBuffRounds = a => (a.tier >= 5 ? 3 : a.tier >= 3 ? 2 : 0);
// ultimate power: tier plus ability rank (plus the ARCANA capstone)
const ultPower = a => { const cap = godCapDef(a); return a.tier + (a.ranks.ability || 0) + ((cap && cap.ultPower) || 0); };
// numbers for an ultimate at a given power and hero level
function ultNumbers(kind, power, lvl, base) {
  const L = Math.floor(Math.max(0, Number(lvl) || 0) / 40);
  if (kind === 'strike') return { dice: `${3 + 2 * Math.min(5, power) + Math.max(0, power - 5) + L}d10` };
  if (kind === 'nova' || kind === 'bolt') return { dice: `${(kind === 'bolt' ? 4 : 2) + Math.floor(power / 2)}d10` };
  if (kind === 'mend') return { pct: Math.min(80, (base || 20) + 3 * power) };
  if (kind === 'summon') return { count: Math.min(4, (base || 2) + (power >= 10 ? 2 : power >= 5 ? 1 : 0)) };
  if (kind === 'guard') return { rounds: (base || 2) + (power >= 10 ? 2 : power >= 5 ? 1 : 0) };
  return {};
}
function ultDesc(cls, a, lvl) {
  const def = AWAKEN_CLASSES[cls]; if (!def) return '';
  const u = def.ult, n = ultNumbers(u.kind, Math.max(1, ultPower(a)), lvl, u.pct || u.count || u.rounds);
  if (u.kind === 'strike') return `${u.name}: ${u.hits || 1} weapon blow${(u.hits || 1) > 1 ? 's' : ''} +${n.dice}${u.mark ? `, marks ${u.mark}` : ''}.`;
  if (u.kind === 'nova') return `${u.name}: all foes, ${u.save} save, ${n.dice} ${u.dt} (scales with level).`;
  if (u.kind === 'bolt') return `${u.name}: one foe, ${n.dice} ${u.dt}${u.mark ? `, ${u.mark}` : ''}.`;
  if (u.kind === 'mend') return `${u.name}: party heals ${n.pct}% max HP, ${u.buff}.`;
  if (u.kind === 'summon') return `${u.name}: call ${n.count} spirit wolves.`;
  if (u.kind === 'guard') return `${u.name}: party ${u.buffs.join(' + ')} for ${n.rounds} rounds.`;
  return u.name;
}

if (typeof globalThis !== 'undefined') globalThis.GBQAwakening = {
  AWAKEN_TIERS, AWAKEN_MAX_TIER, TRACK_MAX, TRACKS, TRACK_IDS, AWAKEN_CLASSES, normAwaken, tierCapForLevel, nextTier, apTotal, rankCost, trackSpent,
  apSpent, apFree, trackCap, resetCost, raiseBlock, tierBlock, awakenSub, spellDcBonus, spellSlotBonus, resourceBonus, skillUsesPerBattle,
  startBuffRounds, ultPower, ultNumbers, ultDesc,
  GOD_TIER_MIN, GOD_RANKS, GOD_PANTHEONS, GOD_IDS, godRankCost, dpTotal, dpSpent, dpFree, godCapstone, godBlock, godSub,
};

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof derive === 'function' && typeof gearAffixes === 'function' && typeof Battle !== 'undefined') {
  const AW = c => (c.awaken = normAwaken(c.awaken));
  const awOf = c => (c && c.awaken ? normAwaken(c.awaken) : null);
  const talentModsOf = c => { const s = {}; if (typeof TALENT_TREES === 'undefined') return s; for (const tree of TALENT_TREES) for (const t of tree.nodes) if (c.talents && c.talents.includes(t.id)) for (const k in t.mods) s[k] = (s[k] || 0) + t.mods[k]; return s; };
  const buffName = id => (BUFFS[id] ? BUFFS[id].name : String(id).toUpperCase());

  // stats: class tier substats + track bonuses + god talents
  { const ga0 = gearAffixes; gearAffixes = function (c) {
      const s = ga0.apply(this, arguments), a = awOf(c); if (!a || a.tier < 1) return s;
      for (const [k, v] of Object.entries(awakenSub(a, c.cls, talentModsOf(c)))) s[k] = (s[k] || 0) + v;
      return s;
    }; }
  // spell DC / attack
  { const d0 = derive; derive = function (c) {
      const D = d0.apply(this, arguments), a = awOf(c);
      if (a && D && D.spell) { const b = spellDcBonus(a); if (b) D.spell = Object.assign({}, D.spell, { dc: D.spell.dc + b, atk: D.spell.atk + b }); }
      return D;
    }; }
  // class resources and spell slots
  if (typeof resMax === 'function') { const r0 = resMax; resMax = function (c, D) {
      const r = r0.apply(this, arguments), a = awOf(c); if (!a || a.tier < 1) return r;
      const rb = resourceBonus(a);
      if (rb) for (const k of ['rage', 'inspire', 'channel', 'wild', 'surge', 'wind', 'indomitable', 'breath', 'subpower']) if (typeof r[k] === 'number') r[k] += rb;
      if (rb) for (const k of ['ki', 'sp']) if (typeof r[k] === 'number') r[k] += 2 * rb;
      if (typeof r.layhands === 'number' && a.ranks.ability) r.layhands = Math.round(r.layhands * (1 + 0.1 * a.ranks.ability));
      const sb = spellSlotBonus(a);
      if (sb && Array.isArray(r.slots) && r.slots.length) { r.slots = r.slots.slice(); r.slots[r.slots.length - 1] += sb; }
      if (typeof r.pact === 'number' && (a.ranks.spell || 0) >= 10) r.pact += 1;
      return r;
    }; }
  // battle-start buffs: class tier III+ and the god capstone
  { const se0 = Battle.prototype.setupEffects; Battle.prototype.setupEffects = function () {
      se0.apply(this, arguments);
      for (const u of this.party) {
        if (!isChar(u)) continue; const a = awOf(u.ch), def = AWAKEN_CLASSES[u.ch.cls]; if (!a || !def) continue;
        const n = startBuffRounds(a);
        if (n && BUFFS[def.start]) { addEffect(u, { id: def.start, rounds: n }); if (typeof chatLog === 'function') chatLog('combat', 'AWAKENING', `${u.ch.name} awakens: ${buffName(def.start)} for ${n} rounds.`); }
        const cap = godCapDef(a);
        if (cap && BUFFS[cap.start]) { addEffect(u, { id: cap.start, rounds: 3 }); if (typeof chatLog === 'function') chatLog('combat', 'GOD TALENT', `${u.ch.name}: ${cap.name} (${buffName(cap.start)}).`); }
      }
    }; }
  // the ultimate, and extra active-skill uses
  function ultimate(b, u, a) {
    const c = u.ch, ul = AWAKEN_CLASSES[c.cls].ult, n = ultNumbers(ul.kind, Math.max(1, ultPower(a)), c.lvl, ul.pct || ul.count || ul.rounds);
    const banner = b.say(`${c.name} unleashes ${ul.name}!`, () => { if (SFX[ul.sfx || 'buff']) SFX[ul.sfx || 'buff'](); });
    const allies = () => b.party.filter(m => isChar(m) && !m.ch.dead);
    if (ul.kind === 'strike') return t => {
      let steps = [banner];
      if (ul.mark) steps.push(b.say(`${t.name} is marked: ${buffName(ul.mark)}.`, () => addEffect(t, { id: ul.mark, rounds: 3, src: u.id })));
      if (ul.self) steps.push(b.say(`${c.name} is ${buffName(ul.self)}!`, () => addEffect(u, { id: ul.self, rounds: 3 })));
      for (let i = 0; i < (ul.hits || 1); i++) steps = steps.concat(b.weaponAttack(u, t, { single: true, skillBonus: n.dice }));
      return steps;
    };
    if (ul.kind === 'nova' || ul.kind === 'bolt') return t => {
      const foes = ul.kind === 'nova' ? b.enemiesOf(u) : [t];
      const sp = { id: 'awk_' + c.cls, name: ul.name, school: ul.school || 'storm', lvl: 0, t: ul.kind === 'nova' ? 'enemies' : 'enemy', eff: 'dmg', dice: n.dice, dt: ul.dt };
      if (ul.kind === 'nova') Object.assign(sp, { save: ul.save, half: true }); else sp.atk = true;
      let steps = b.castSpell(u, sp, foes);
      if (ul.mark) steps = steps.concat([b.say(`Foes are ${buffName(ul.mark)}.`, () => foes.forEach(f => { if (alive(f)) addEffect(f, { id: ul.mark, rounds: 3, src: u.id }); }))]);
      return steps;
    };
    if (ul.kind === 'mend') return () => [banner, b.say(`The party is restored (${n.pct}% HP).`, () => { allies().forEach(m => { b.heal(m, Math.max(1, Math.round(maxHpOf(m) * n.pct / 100))); if (BUFFS[ul.buff]) addEffect(m, { id: ul.buff, rounds: 3 }); }); SFX.heal(); })];
    if (ul.kind === 'guard') return () => [banner, b.say(`The party is ${ul.buffs.map(buffName).join(' and ')}.`, () => allies().forEach(m => ul.buffs.forEach(x => { if (BUFFS[x]) addEffect(m, { id: x, rounds: n.rounds }); })))];
    if (ul.kind === 'summon') return () => [banner, b.say(`${n.count} spirit wolves answer the call!`, () => { for (let i = 0; i < n.count && b.party.length < 12; i++) b.addSummon(u, 'wolf'); })];
    return () => [banner];
  }
  { const ab0 = Battle.prototype.abilities; Battle.prototype.abilities = function (u) {
      const list = ab0.apply(this, arguments), c = u && u.ch, a = awOf(c);
      if (!c || c.ai || !a || a.tier < 1 || !AWAKEN_CLASSES[c.cls]) return list;
      // extra uses of once-per-battle active skills (ABILITY rank 5 and 10)
      const maxUses = skillUsesPerBattle(a);
      if (maxUses > 1) {
        this.awkSkill = this.awkSkill || {};
        for (const e of list) {
          if (!/^skill_/.test(e.id)) continue;
          const skill = e.id.slice(6), done = this.awkSkill[skill] || 0, fn = e.fn;
          e.cost = done >= maxUses ? 'USED' : `${maxUses - done}/${maxUses}`;
          if (done < maxUses) { this.skillUses.delete(skill); e.ok = e.ok || done > 0; } else e.ok = false;
          e.fn = (...args) => { const r = fn(...args); this.awkSkill[skill] = (this.awkSkill[skill] || 0) + 1; if (this.awkSkill[skill] < maxUses) this.skillUses.delete(skill); return r; };
        }
      }
      // the awakened ultimate
      this.awkUlt = this.awkUlt || new Set();
      const ul = AWAKEN_CLASSES[c.cls].ult, used = this.awkUlt.has(u.id), fn = ultimate(this, u, a);
      list.unshift({ id: 'awk_ult', name: ul.name.slice(0, 15), cost: used ? 'USED' : 'ULT', ok: !used, bonus: false,
        fn: t => { this.awkUlt.add(u.id); return fn(t); }, target: ul.kind === 'strike' || ul.kind === 'bolt' ? 'enemy' : undefined });
      return list;
    }; }

  // ---------------------------------------------------------------- menu (MAIN MENU > AWAKENING)
  const hasNews = () => {
    if (!G || !AWAKEN_CLASSES[G.cls]) return false; const a = normAwaken(G.awaken);
    return !tierBlock(a, G.lvl, G.gold) || (a.tier > 0 && TRACK_IDS.some(t => !raiseBlock(a, G.lvl, t))) || GOD_IDS.some(g => !godBlock(a, G.lvl, g));
  };
  const statName = k => (typeof SUBSTATS !== 'undefined' && SUBSTATS[k] ? SUBSTATS[k].name : k === 'hpPct' ? 'MAX HP' : k.toUpperCase());
  const statUnit = k => (typeof SUBSTATS !== 'undefined' && SUBSTATS[k] ? SUBSTATS[k].unit : k === 'hpPct' ? '%' : '');
  const modsText = mods => Object.entries(mods).map(([k, v]) => `+${v}${statUnit(k)} ${statName(k)}`).join(', ');
  function classInfo(a) {
    const def = AWAKEN_CLASSES[G.cls], t = nextTier(a.tier), cur = a.tier ? AWAKEN_TIERS[a.tier - 1].name : 'DORMANT';
    return [`${def.name}: ${def.desc}`, `TIER ${cur}. EACH TIER: ${modsText(def.per)}.`, `I: ${ultDesc(G.cls, Object.assign({}, a, { tier: Math.max(1, a.tier) }), G.lvl)}`,
      `III: battle start ${buffName(def.start)} (2 rnds, 3 at V).`, t ? `NEXT: TIER ${t.name} at level ${t.lvl}, ${t.gold} G.` : 'FULLY AWAKENED.'];
  }
  function classMenu() {
    const a = AW(G), t = nextTier(a.tier), why = tierBlock(a, G.lvl, G.gold);
    choose([t ? `AWAKEN ${t.name} ${t.gold}G` : 'FULLY AWAKENED', 'DETAILS', 'BACK'], i => {
      if (i === 1) return say(classInfo(a), classMenu);
      if (i !== 0 || !t) return awakeningMenu();
      if (why) { SFX.error(); return say(why, classMenu); }
      G.gold -= t.gold; a.tier = t.n; G.awaken = a; saveGame();
      toast('AWAKENING', `${AWAKEN_CLASSES[G.cls].name} ${t.name}`.slice(0, 22), 'item_key', 'act_complete');
      const lines = [`Your ${CLASSES[G.cls].name} power awakens: ${AWAKEN_CLASSES[G.cls].name} ${t.name}!`, a.tier === 1 ? `New ultimate: ${ultDesc(G.cls, a, G.lvl)}` : `+2 AP. Tracks now reach rank ${trackCap(a.tier)}.`];
      if (a.tier === GOD_TIER_MIN) lines.push('The gods take notice. GOD TALENTS are open.');
      say(lines, awakeningMenu);
    }, `${AWAKEN_CLASSES[G.cls].name} ${a.tier ? 'TIER ' + AWAKEN_TIERS[a.tier - 1].name : 'DORMANT'}`);
  }
  function trackMenu(track) {
    const a = AW(G), r = a.ranks[track], why = raiseBlock(a, G.lvl, track);
    choose([r < TRACK_MAX ? `RAISE TO ${r + 1} (${rankCost(r + 1)} AP)` : 'MAX RANK', 'DETAILS', 'BACK'], i => {
      if (i === 1) return say([`${TRACKS[track].name} AWAKENING rank ${r}/${TRACK_MAX}.`, TRACKS[track].desc, `Cap at class tier ${a.tier}: rank ${trackCap(a.tier)}.`], () => trackMenu(track));
      if (i !== 0) return awakeningMenu();
      if (why) { SFX.error(); return say(why, () => trackMenu(track)); }
      a.ranks[track] = r + 1; G.awaken = a;
      if (typeof resMax === 'function' && G.res) { const m = resMax(G); for (const k in m) if (typeof m[k] === 'number' && typeof G.res[k] === 'number' && m[k] > G.res[k]) G.res[k] = m[k]; }
      saveGame(); SFX.confirm();
      trackMenu(track);
    }, `${TRACKS[track].name} R${r}/${TRACK_MAX}  AP ${apFree(a, G.lvl)}`);
  }
  function pantheonMenu(g) {
    const a = AW(G), P0 = GOD_PANTHEONS[g], r = a.god[g], why = godBlock(a, G.lvl, g), nx = P0.ranks[r];
    choose([nx ? `${nx.name.slice(0, 14)} ${godRankCost(r + 1)}DP` : 'COMPLETE', 'DETAILS', 'BACK'], i => {
      if (i === 1) return say([`${P0.name}: ${P0.god}. Rank ${r}/${GOD_RANKS}.`, ...P0.ranks.map((x, k) => `${k + 1}${k < r ? '*' : ' '} ${x.name}: ${x.capstone || modsText(x.mods)}`), 'Only one god capstone (rank 5) may be held.'], () => pantheonMenu(g));
      if (i !== 0) return godMenu();
      if (why) { SFX.error(); return say(why, () => pantheonMenu(g)); }
      a.god[g] = r + 1; G.awaken = a; saveGame();
      if (a.god[g] === GOD_RANKS) { toast('GOD TALENT', nx.name, 'item_key', 'act_complete'); return say([`${P0.god} grants you ${nx.name}.`, nx.capstone], godMenu); }
      SFX.confirm(); pantheonMenu(g);
    }, `${P0.name} ${r}/${GOD_RANKS}  DP ${dpFree(a, G.lvl)}`);
  }
  function godMenu() {
    const a = AW(G);
    if (a.tier < GOD_TIER_MIN) return say([`GOD TALENTS open at class tier ${AWAKEN_TIERS[GOD_TIER_MIN - 1].name} (level ${AWAKEN_TIERS[GOD_TIER_MIN - 1].lvl}).`, 'Four pantheons. Divinity points come with levels and higher tiers.'], awakeningMenu);
    const cap = godCapstone(a);
    choose([...GOD_IDS.map(g => `${GOD_PANTHEONS[g].name} ${a.god[g]}/${GOD_RANKS}${cap === g ? ' *' : ''}`), 'BACK'], i => {
      if (i >= 0 && i < GOD_IDS.length) return pantheonMenu(GOD_IDS[i]);
      awakeningMenu();
    }, `GOD TALENTS  DP ${dpFree(a, G.lvl)}/${dpTotal(a.tier, G.lvl)}${cap ? '  GOD: ' + GOD_PANTHEONS[cap].name : ''}`);
  }
  function awakeningMenu() {
    if (!G || !AWAKEN_CLASSES[G.cls]) return say('This class cannot awaken.');
    const a = AW(G), first = AWAKEN_TIERS[0];
    if (a.tier < 1 && G.lvl < first.lvl) return say([`AWAKENING opens at level ${first.lvl}.`, `Your ${CLASSES[G.cls].name} will become the ${AWAKEN_CLASSES[G.cls].name}.`, AWAKEN_CLASSES[G.cls].desc]);
    const opts = ['CLASS AWAKENING', ...TRACK_IDS.map(t => `${TRACKS[t].name} R${a.ranks[t]}/${TRACK_MAX}`), 'GOD TALENTS', 'RESET POINTS', 'BACK'];
    const iGod = TRACK_IDS.length + 1, iReset = iGod + 1;
    choose(opts, i => {
      if (i === 0) return classMenu();
      if (i >= 1 && i <= TRACK_IDS.length) return trackMenu(TRACK_IDS[i - 1]);
      if (i === iGod) return godMenu();
      if (i === iReset) {
        const cost = resetCost(a); if (!apSpent(a) && !dpSpent(a)) return say('No points spent.', awakeningMenu);
        return choose([`RESET FOR ${cost}G`, 'CANCEL'], k => {
          if (k !== 0) return awakeningMenu();
          if (G.gold < cost) { SFX.error(); return say(`Needs ${cost} G.`, awakeningMenu); }
          G.gold -= cost; for (const t of TRACK_IDS) a.ranks[t] = 0; for (const g of GOD_IDS) a.god[g] = 0; G.awaken = a; saveGame();
          say(`All AP and DP refunded.`, awakeningMenu);
        }, 'Refund every track rank and god talent?');
      }
    }, `${AWAKEN_CLASSES[G.cls].name.slice(0, 17)} ${a.tier ? AWAKEN_TIERS[a.tier - 1].name : '-'} AP ${apFree(a, G.lvl)}/${apTotal(a.tier, G.lvl)}`);
  }
  window.awakeningMenu = awakeningMenu;
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { AWAKENING: 'Class tiers, ultimates, talent/spell/ability tracks and god talents.' });
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.findIndex(x => x.startsWith('GROWTH')) + 1; L.splice(at > 0 ? at : 0, 0, hasNews() ? 'AWAKENING (!)' : 'AWAKENING'); return L; };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () { if (P('a') && (this.items()[this.i] || '').replace(' (!)', '') === 'AWAKENING') { SFX.select(); return awakeningMenu(); } return u0.apply(this, arguments); };
  }
}
})();
