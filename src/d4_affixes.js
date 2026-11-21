'use strict';
// ================================================================ ACTION-RPG AFFIXES: A FULL DIABLO IV-STYLE AFFIX LIST, ROLLED BY GEAR SLOT
// Every piece of gear rolls its affixes from the pool of its own slot, the way modern action RPGs do:
//   WEAPON, OFF-HAND (shields), the 7 ARMOUR CATEGORIES (HELM, CLOAK, CHEST, GLOVES, BELT, LEGGINGS, BOOTS)
//   and JEWELRY (amulets, earrings, rings, trinkets, artifacts, relics).
// The list covers every affix family:
//   CORE STATS      strength, dexterity, constitution, intelligence, wisdom, charisma, luck, willpower, speed, all stats
//   OFFENSIVE       damage, crit chance/damage, overpower, damage vs elites / injured / healthy / crowd controlled /
//                   vulnerable / burning / poisoned / bleeding / chilled / stunned foes, melee, ranged, attack, spell,
//                   damage over time, physical, poison and every elemental school, attack speed (haste), accuracy
//   DEFENSIVE       max life, max life %, armour, damage reduction (all, vs elites, melee, ranged, burning and poisoned
//                   foes, while injured, while fortified), dodge, block, thorns, life on hit / on kill / per round,
//                   healing received, barrier generation, crowd control reduction, lifesteal
//   RESISTANCES     resist all, fire, cold, shock, poison, shadow, holy, arcane
//   UTILITY         cooldown reduction, resource generation, movement speed, crowd control duration, lucky hit
//                   chance, magic find, gold find, XP, healing
//   LUCKY HIT       chance on hit to stun, chill, slow, make vulnerable, burn, poison, bleed, weaken, blind, heal or execute
// Old affixes keep their keys, so every existing save, gem, temper recipe and named item stays valid. Pure rules
// are exported as GBQAffixes for tests; the browser build registers the new affixes in SUBSTATS and wires their effects.

// [key, name (fits the 160px screen), unit, scale k, per-line cap, category, description]
// k is the same per-affix scale gen.js uses (AFFIX_K): value = k * (1 + ilvl/12) * (0.6 + rarity*0.25) * (0.7..1.0)
const AFFIX_DEFS = [
  // ---- core stats
  ['strength', 'STRENGTH', '', 0.12, 25, 'CORE', '+STR: melee hit, damage and athletics.'],
  ['dexterity', 'DEXTERITY', '', 0.12, 25, 'CORE', '+DEX: armour class, finesse and ranged hits.'],
  ['constitution', 'CONSTITUTION', '', 0.12, 25, 'CORE', '+CON: hit points and concentration.'],
  ['intelligence', 'INTELLIGENCE', '', 0.12, 25, 'CORE', '+INT: arcane spell power.'],
  ['wisdom', 'WISDOM', '', 0.12, 25, 'CORE', '+WIS: divine spell power and healing.'],
  ['charisma', 'CHARISMA', '', 0.12, 25, 'CORE', '+CHA: pact and bardic power.'],
  ['luck', 'LUCK', '', 0.1, 20, 'CORE', '+LCK: crit chance and magic find.'],
  ['willpower', 'WILLPOWER', '', 0.1, 20, 'CORE', '+WIL: resist conditions.'],
  ['speed', 'SPEED', '', 0.1, 20, 'CORE', '+SPD: initiative, haste and dodge.'],
  ['allStats', 'ALL STATS', '', 0.06, 12, 'CORE', '+every ability score.'],
  // ---- offensive (existing keys first)
  ['dmg', 'DAMAGE', '%', 3, 500, 'OFFENSIVE', 'More damage with every attack and spell.'],
  ['crit', 'CRIT CHANCE', '%', 1.2, 50, 'OFFENSIVE', 'Chance to land a critical hit.'],
  ['critdmg', 'CRIT DAMAGE', '%', 5, 300, 'OFFENSIVE', 'Extra damage on critical hits.'],
  ['haste', 'HASTE', '%', 1.2, 50, 'OFFENSIVE', 'Attack speed: extra turns and initiative.'],
  ['hit', 'ACCURACY', '', 0.2, 30, 'OFFENSIVE', 'Bonus to attack rolls and spell DCs.'],
  ['fire', 'FIRE DMG', '%', 4, 300, 'OFFENSIVE', 'More fire damage.'],
  ['cold', 'COLD DMG', '%', 4, 300, 'OFFENSIVE', 'More cold damage.'],
  ['lightning', 'SHOCK DMG', '%', 4, 300, 'OFFENSIVE', 'More lightning damage.'],
  ['necrotic', 'SHADOW DMG', '%', 4, 300, 'OFFENSIVE', 'More shadow damage.'],
  ['radiant', 'HOLY DMG', '%', 4, 300, 'OFFENSIVE', 'More holy damage.'],
  ['physDmg', 'PHYSICAL DMG', '%', 4, 300, 'OFFENSIVE', 'More slashing, piercing and bludgeoning damage.'],
  ['poisonDmg', 'POISON DMG', '%', 4, 300, 'OFFENSIVE', 'More poison and acid damage.'],
  ['overpower', 'OVERPOWER DMG', '%', 6, 500, 'OFFENSIVE', 'Overpowering hits (5% of hits deal 1.5x) deal this much more.'],
  ['dmgElite', 'VS ELITES', '%', 3.5, 300, 'OFFENSIVE', 'More damage to elites and bosses.'],
  ['dmgInjured', 'VS INJURED', '%', 3.5, 300, 'OFFENSIVE', 'More damage to foes under 35% HP.'],
  ['dmgHealthy', 'VS HEALTHY', '%', 3.5, 300, 'OFFENSIVE', 'More damage to foes over 80% HP.'],
  ['dmgCC', 'VS CONTROLLED', '%', 3.5, 300, 'OFFENSIVE', 'More damage to stunned, slowed, chilled, prone or held foes.'],
  ['dmgVuln', 'VS VULNERABLE', '%', 3.5, 300, 'OFFENSIVE', 'More damage to vulnerable or shocked foes.'],
  ['dmgBurning', 'VS BURNING', '%', 3.5, 300, 'OFFENSIVE', 'More damage to burning foes.'],
  ['dmgPoisoned', 'VS POISONED', '%', 3.5, 300, 'OFFENSIVE', 'More damage to poisoned foes.'],
  ['dmgBleeding', 'VS BLEEDING', '%', 3.5, 300, 'OFFENSIVE', 'More damage to bleeding foes.'],
  ['dmgChilled', 'VS CHILLED', '%', 3.5, 300, 'OFFENSIVE', 'More damage to chilled or slowed foes.'],
  ['dmgStunned', 'VS STUNNED', '%', 3.5, 300, 'OFFENSIVE', 'More damage to stunned, paralyzed or sleeping foes.'],
  ['dmgMelee', 'MELEE DMG', '%', 3.5, 300, 'OFFENSIVE', 'More damage with melee attacks.'],
  ['dmgRanged', 'RANGED DMG', '%', 3.5, 300, 'OFFENSIVE', 'More damage with ranged attacks.'],
  ['dmgAttack', 'ATTACK DMG', '%', 3, 300, 'OFFENSIVE', 'More damage with weapon attacks and skills.'],
  ['dmgSpell', 'SPELL DMG', '%', 3, 300, 'OFFENSIVE', 'More damage with spells.'],
  ['dmgDot', 'DMG OVER TIME', '%', 3.5, 300, 'OFFENSIVE', 'Burning, poison and bleeding on foes tick harder.'],
  // ---- defensive
  ['hp', 'MAX HP', '', 5, 99999, 'DEFENSIVE', 'More hit points.'],
  ['hpPct', 'MAX HP %', '%', 0.5, 40, 'DEFENSIVE', 'More hit points, as a percentage.'],
  ['acb', 'ARMOUR', '', 0.2, 30, 'DEFENSIVE', 'Raises armour class.'],
  ['dodge', 'DODGE', '%', 0.8, 40, 'DEFENSIVE', 'Chance to avoid attacks.'],
  ['block', 'BLOCK', '%', 1.2, 40, 'DEFENSIVE', 'Chance to halve an attack.'],
  ['thorns', 'THORNS', '', 2, 9999, 'DEFENSIVE', 'Damages melee attackers.'],
  ['leech', 'LIFESTEAL', '%', 0.4, 20, 'DEFENSIVE', 'Heal for part of the damage you deal.'],
  ['dr', 'DMG REDUCTION', '%', 0.25, 12, 'DEFENSIVE', 'Take less damage from everything.'],
  ['drElite', 'DR VS ELITES', '%', 0.4, 20, 'DEFENSIVE', 'Take less damage from elites and bosses.'],
  ['drMelee', 'DR VS MELEE', '%', 0.4, 20, 'DEFENSIVE', 'Take less damage from melee attacks.'],
  ['drRanged', 'DR VS RANGED', '%', 0.4, 20, 'DEFENSIVE', 'Take less damage from ranged attacks and spells.'],
  ['drBurning', 'DR VS BURNING', '%', 0.4, 20, 'DEFENSIVE', 'Take less damage from burning foes.'],
  ['drPoisoned', 'DR VS POISON', '%', 0.4, 20, 'DEFENSIVE', 'Take less damage from poisoned foes.'],
  ['drInjured', 'DR WHILE HURT', '%', 0.4, 20, 'DEFENSIVE', 'Take less damage while under 35% HP.'],
  ['drFortified', 'DR FORTIFIED', '%', 0.4, 20, 'DEFENSIVE', 'Take less damage while you have a barrier or are fortified.'],
  ['lifeOnHit', 'LIFE ON HIT', '', 1.5, 99999, 'DEFENSIVE', 'Heal this much each time you hit.'],
  ['lifeOnKill', 'LIFE ON KILL', '', 4, 99999, 'DEFENSIVE', 'Heal this much each time you kill.'],
  ['lifeRegen', 'LIFE / TURN', '', 1.2, 99999, 'DEFENSIVE', 'Heal this much at the start of each of your turns.'],
  ['healRecv', 'HEAL RECEIVED', '%', 1.2, 100, 'DEFENSIVE', 'Healing on you is stronger.'],
  ['barrierGen', 'BARRIER GEN', '%', 1.5, 150, 'DEFENSIVE', 'Barriers you gain are stronger.'],
  ['ccReduce', 'CC REDUCTION', '%', 0.8, 50, 'DEFENSIVE', 'Stuns, slows and other conditions on you end sooner.'],
  // ---- resistances
  ['resist', 'RESIST ALL', '%', 1.2, 60, 'RESISTANCE', 'Take less damage of every kind.'],
  ['resFire', 'FIRE RESIST', '%', 0.8, 40, 'RESISTANCE', 'Take less fire damage.'],
  ['resCold', 'COLD RESIST', '%', 0.8, 40, 'RESISTANCE', 'Take less cold damage.'],
  ['resShock', 'SHOCK RESIST', '%', 0.8, 40, 'RESISTANCE', 'Take less lightning and thunder damage.'],
  ['resPoison', 'POISON RESIST', '%', 0.8, 40, 'RESISTANCE', 'Take less poison and acid damage.'],
  ['resShadow', 'SHADOW RESIST', '%', 0.8, 40, 'RESISTANCE', 'Take less shadow damage.'],
  ['resHoly', 'HOLY RESIST', '%', 0.8, 40, 'RESISTANCE', 'Take less holy damage.'],
  ['resArcane', 'ARCANE RESIST', '%', 0.8, 40, 'RESISTANCE', 'Take less force and psychic damage.'],
  // ---- utility
  ['cdr', 'COOLDOWN RED', '%', 0.5, 30, 'UTILITY', 'Shorter real-time cooldowns; turn-based: a chance each turn to ready used skills.'],
  ['resGen', 'RESOURCE GEN', '%', 0.6, 40, 'UTILITY', 'Chance on kill to restore a spell slot, rage, ki or other class resource.'],
  ['moveSpeed', 'MOVE SPEED', '%', 0.8, 50, 'UTILITY', 'Act sooner: +1 initiative per 4%.'],
  ['ccDur', 'CC DURATION', '%', 1.5, 100, 'UTILITY', 'Conditions from your lucky hits last longer (+1 round per 50%).'],
  ['luckyHit', 'LUCKY HIT', '%', 0.6, 40, 'UTILITY', 'Raises the chance of every lucky hit effect.'],
  ['heal', 'HEALING', '%', 3, 200, 'UTILITY', 'Your heals are stronger.'],
  ['mf', 'MAGIC FIND', '%', 4, 400, 'UTILITY', 'Better item rarity from loot.'],
  ['gf', 'GOLD FIND', '%', 5, 400, 'UTILITY', 'More gold from loot.'],
  ['xp', 'XP BONUS', '%', 1.5, 200, 'UTILITY', 'More experience.'],
  // ---- lucky hit: chance on hit
  ['lhStun', 'LUCKY: STUN', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to stun the foe.'],
  ['lhChill', 'LUCKY: CHILL', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to chill (frostbite) the foe.'],
  ['lhSlow', 'LUCKY: SLOW', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to slow the foe.'],
  ['lhVuln', 'LUCKY: VULN', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to make the foe vulnerable.'],
  ['lhBurn', 'LUCKY: BURN', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to set the foe burning.'],
  ['lhPoison', 'LUCKY: POISON', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to envenom the foe.'],
  ['lhBleed', 'LUCKY: BLEED', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to make the foe bleed.'],
  ['lhWeaken', 'LUCKY: WEAKEN', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to weaken the foe.'],
  ['lhBlind', 'LUCKY: BLIND', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to blind the foe.'],
  ['lhHeal', 'LUCKY: HEAL', '%', 0.3, 20, 'LUCKY HIT', 'Chance on hit to heal 4% of your max HP.'],
  ['lhExecute', 'LUCKY: EXECUTE', '%', 0.15, 10, 'LUCKY HIT', 'Chance on hit to slay a non-boss foe under 20% HP.'],
];
const AFFIXES = Object.fromEntries(AFFIX_DEFS.map(([k, name, unit, kk, max, cat, desc]) => [k, { k, name, unit, kk, max, cat, desc }]));
const AFFIX_IDS = AFFIX_DEFS.map(d => d[0]);
const AFFIX_CATS = ['CORE', 'OFFENSIVE', 'DEFENSIVE', 'RESISTANCE', 'UTILITY', 'LUCKY HIT'];
const RES_KEYS = ['resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane'];
const LH_KEYS = ['lhStun', 'lhChill', 'lhSlow', 'lhVuln', 'lhBurn', 'lhPoison', 'lhBleed', 'lhWeaken', 'lhBlind', 'lhHeal', 'lhExecute'];
const CORE_ATTR = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA', luck: 'LCK', willpower: 'WIL', speed: 'SPD' };

// ---------------------------------------------------------------- slot pools (weapon, off-hand, 7 armour categories, jewelry)
const SLOT_GROUPS = {
  weapon: { name: 'WEAPON', pool: ['dmg', 'critdmg', 'crit', 'overpower', 'dmgElite', 'dmgInjured', 'dmgHealthy', 'dmgCC', 'dmgVuln', 'dmgBurning', 'dmgPoisoned', 'dmgBleeding', 'dmgChilled', 'dmgStunned', 'dmgDot', 'dmgMelee', 'dmgRanged', 'dmgAttack', 'dmgSpell', 'physDmg', 'poisonDmg', 'fire', 'cold', 'lightning', 'necrotic', 'radiant', 'strength', 'dexterity', 'intelligence', 'wisdom', 'charisma', 'allStats', 'haste', 'hit', 'leech', 'lifeOnKill', 'luckyHit', 'lhExecute', 'lhVuln', 'lhBurn', 'lhPoison', 'lhBleed'] },
  offhand: { name: 'OFF-HAND', pool: ['block', 'dr', 'drElite', 'drMelee', 'drRanged', 'hp', 'hpPct', 'acb', 'thorns', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'barrierGen', 'cdr', 'luckyHit', 'lhStun', 'dmgElite', 'dmgCC', 'strength', 'constitution', 'intelligence', 'wisdom'] },
  head: { name: 'HELM', pool: ['hp', 'hpPct', 'acb', 'cdr', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'barrierGen', 'healRecv', 'ccReduce', 'lifeRegen', 'intelligence', 'wisdom', 'willpower', 'allStats', 'crit', 'mf', 'xp'] },
  back: { name: 'CLOAK', pool: ['dodge', 'hp', 'acb', 'thorns', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'drRanged', 'ccReduce', 'moveSpeed', 'dexterity', 'charisma', 'luck', 'mf', 'gf'] },
  armor: { name: 'CHEST', pool: ['hp', 'hpPct', 'acb', 'dr', 'drElite', 'drMelee', 'drRanged', 'drBurning', 'drPoisoned', 'drInjured', 'drFortified', 'thorns', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'lifeRegen', 'healRecv', 'barrierGen', 'strength', 'constitution', 'allStats'] },
  hands: { name: 'GLOVES', pool: ['crit', 'critdmg', 'haste', 'hit', 'overpower', 'dmgAttack', 'dmgSpell', 'dmgVuln', 'dmgCC', 'lifeOnHit', 'luckyHit', 'ccDur', 'lhStun', 'lhChill', 'lhSlow', 'lhVuln', 'lhBurn', 'lhPoison', 'lhBleed', 'lhWeaken', 'lhBlind', 'lhHeal', 'acb', 'strength', 'dexterity', 'intelligence'] },
  waist: { name: 'BELT', pool: ['hp', 'hpPct', 'lifeRegen', 'lifeOnKill', 'healRecv', 'resGen', 'cdr', 'dmgDot', 'barrierGen', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'constitution', 'willpower', 'gf', 'xp'] },
  legs: { name: 'LEGGINGS', pool: ['hp', 'acb', 'dr', 'drInjured', 'drMelee', 'drFortified', 'drPoisoned', 'drBurning', 'dodge', 'thorns', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'lifeRegen', 'constitution', 'strength', 'dexterity'] },
  feet: { name: 'BOOTS', pool: ['moveSpeed', 'dodge', 'ccReduce', 'resGen', 'haste', 'hp', 'acb', 'drRanged', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'dexterity', 'speed', 'luck', 'mf', 'gf'] },
  jewelry: { name: 'JEWELRY', pool: ['crit', 'critdmg', 'dmg', 'overpower', 'fire', 'cold', 'lightning', 'necrotic', 'radiant', 'physDmg', 'poisonDmg', 'dmgVuln', 'dmgCC', 'dmgElite', 'resist', 'resFire', 'resCold', 'resShock', 'resPoison', 'resShadow', 'resHoly', 'resArcane', 'allStats', 'luckyHit', 'lifeOnHit', 'leech', 'cdr', 'resGen', 'hpPct', 'heal', 'mf', 'gf', 'xp'] },
};
// the 7 armour categories, as armory.js names them
const ARMOUR_CATEGORY_GROUPS = ['head', 'back', 'armor', 'hands', 'waist', 'legs', 'feet'];
const groupForSlot = slot => {
  const s = String(slot || '').replace(/[0-9]+$/, '');
  if (s === 'weapon' || s === 'offhand' || ARMOUR_CATEGORY_GROUPS.includes(s)) return s;
  return 'jewelry'; // neck, ear, ring, trinket, artifact, relic and anything new
};
// one affix value, on the same curve as gen.js makeItem
function affixValue(k, ilvl, rarity, roll) {
  const A = AFFIXES[k]; if (!A) return 0;
  const lvl = Math.max(1, Math.min(720, Math.floor(Number(ilvl) || 1))), rar = Math.max(0, Math.min(8, Math.floor(Number(rarity) || 0)));
  const v = A.kk * (1 + lvl / 12) * (0.6 + rar * 0.25) * (0.7 + Math.max(0, Math.min(1, Number(roll) || 0)) * 0.3);
  return Math.min(A.max, Math.max(1, Math.round(v)));
}
// roll weight: the seven single-school resistances share about two lines' worth of chance, and the eleven
// lucky-hit effects count half, so one family can't crowd a whole item
const affixWeight = k => (RES_KEYS.includes(k) && k !== 'resist' ? 0.3 : LH_KEYS.includes(k) ? 0.5 : 1);
// n distinct affixes from a slot group's pool, weighted; rng() returns 0..1
function rollSlotAffixes(group, n, ilvl, rarity, rng) {
  const pool = (SLOT_GROUPS[group] || SLOT_GROUPS.jewelry).pool.slice(), out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const total = pool.reduce((t, k) => t + affixWeight(k), 0);
    let x = rng() * total, j = 0;
    while (j < pool.length - 1 && x >= affixWeight(pool[j])) { x -= affixWeight(pool[j]); j++; }
    const k = pool.splice(j, 1)[0]; out.push([k, affixValue(k, ilvl, rarity, rng())]);
  }
  return out;
}
// caps on summed totals (per hero)
const TOTAL_CAPS = { dr: 60, res: 75, ccReduce: 75, cdr: 50, core: 40, luckyHit: 100, moveSpeed: 100 };
// summed damage-reduction percentage from a hero's substats, given which conditions hold
function reductionPct(s, when) {
  let r = s.dr || 0;
  if (when.elite) r += s.drElite || 0; if (when.melee) r += s.drMelee || 0; if (when.ranged) r += s.drRanged || 0;
  if (when.burning) r += s.drBurning || 0; if (when.poisoned) r += s.drPoisoned || 0; if (when.injured) r += s.drInjured || 0; if (when.fortified) r += s.drFortified || 0;
  return Math.min(TOTAL_CAPS.dr, Math.max(0, r));
}
const RES_FOR_TYPE = { fire: 'resFire', cold: 'resCold', lightning: 'resShock', thunder: 'resShock', poison: 'resPoison', acid: 'resPoison', necrotic: 'resShadow', radiant: 'resHoly', force: 'resArcane', psychic: 'resArcane' };
const resistFor = (s, type) => Math.min(TOTAL_CAPS.res, Math.max(0, s[RES_FOR_TYPE[type]] || 0));
// summed outgoing bonus damage percentage, given which conditions hold
function outgoingPct(s, when) {
  let m = 0;
  if (when.elite) m += s.dmgElite || 0; if (when.injured) m += s.dmgInjured || 0; if (when.healthy) m += s.dmgHealthy || 0;
  if (when.cc) m += s.dmgCC || 0; if (when.vuln) m += s.dmgVuln || 0; if (when.burning) m += s.dmgBurning || 0;
  if (when.poisoned) m += s.dmgPoisoned || 0; if (when.bleeding) m += s.dmgBleeding || 0; if (when.chilled) m += s.dmgChilled || 0; if (when.stunned) m += s.dmgStunned || 0;
  if (when.melee) m += s.dmgMelee || 0; if (when.ranged) m += s.dmgRanged || 0; if (when.attack) m += s.dmgAttack || 0; if (when.spell) m += s.dmgSpell || 0;
  if (when.phys) m += s.physDmg || 0; if (when.poison) m += s.poisonDmg || 0;
  return m;
}
// ability score bonuses from substats (allStats adds to each), capped per ability
function coreBonus(s) {
  const out = {}; for (const [k, a] of Object.entries(CORE_ATTR)) { const v = (s[k] || 0) + (s.allStats || 0); if (v) out[a] = Math.min(TOTAL_CAPS.core, v); }
  return out;
}
const lhRounds = (k, ccDur) => (k === 'lhStun' ? 1 : 2) + Math.floor(Math.max(0, ccDur || 0) / 50);
const OVERPOWER_CHANCE = 5, OVERPOWER_MULT = 1.5;

if (typeof globalThis !== 'undefined') globalThis.GBQAffixes = { AFFIXES, AFFIX_IDS, AFFIX_CATS, SLOT_GROUPS, ARMOUR_CATEGORY_GROUPS, RES_KEYS, LH_KEYS, CORE_ATTR, TOTAL_CAPS, groupForSlot, affixValue, affixWeight, rollSlotAffixes, reductionPct, resistFor, outgoingPct, coreBonus, lhRounds, OVERPOWER_CHANCE, OVERPOWER_MULT };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof makeItem === 'function' && typeof SUBSTATS !== 'undefined' && typeof Battle !== 'undefined') {
  // ------------------------------------------------ register every new affix so menus, tooltips and detail pages can name it
  for (const A of Object.values(AFFIXES)) {
    if (!SUBSTATS[A.k]) SUBSTATS[A.k] = { name: A.name, unit: A.unit, max: A.max, cat: A.cat, desc: A.desc };
    else { SUBSTATS[A.k].cat = SUBSTATS[A.k].cat || A.cat; SUBSTATS[A.k].desc = SUBSTATS[A.k].desc || A.desc; }
    if (typeof AFFIX_K !== 'undefined' && AFFIX_K[A.k] == null) AFFIX_K[A.k] = A.kk;
  }
  const GEAR = ['weapon', 'armor', 'wondrous'];
  const slotOf = it => { try { return typeof itemSlot === 'function' ? itemSlot(it) : it.slot; } catch (e) { return it.slot; } };
  window.affixGroupOf = it => groupForSlot(slotOf(it));
  // ------------------------------------------------ new gear rolls its affixes from its slot's pool (same count and curve as before)
  { const mk0 = makeItem; makeItem = function (opts) {
      const it = mk0.apply(this, arguments);
      try {
        if (it && GEAR.includes(it.kind) && !it.d4a) {
          const n = (it.affixes || []).length;
          if (n) it.affixes = rollSlotAffixes(groupForSlot(slotOf(it)), n, it.ilvl, it.rarity, R);
          it.d4a = 1;
        }
      } catch (e) { /* keep the original affixes */ }
      return it;
    }; }
  const isHero = u => !!u && typeof isChar === 'function' && isChar(u);
  const subOf = u => (isHero(u) ? derive(u.ch).sub : null) || {};
  const frac = u => { const m = Math.max(1, maxHpOf(u)); return hpOf(u) / m; };
  const has = (u, ...ids) => !!u && ids.some(id => hasEff(u, id));
  const CC_IDS = ['stunned', 'paralyzed', 'asleep', 'restrained', 'prone', 'frightened', 'charmed', 'slowed', 'frostbite'];
  const CC_ON_HERO = ['stunned', 'paralyzed', 'asleep', 'restrained', 'prone', 'frightened', 'charmed', 'blinded', 'slowed', 'frostbite', 'poisoned', 'silenced'];
  const PHYS = ['slashing', 'piercing', 'bludgeoning'];
  // ------------------------------------------------ core stats from gear (ability scores) and movement speed (initiative)
  { const d0 = derive; derive = function (c) {
      if (!c || !c.eq || !c.ascAttr) return d0.apply(this, arguments);
      const s = {};
      for (const slot of (typeof SLOTS !== 'undefined' ? SLOTS : Object.keys(c.eq))) { const it = c.eq[slot]; if (it && it.affixes) for (const [k, v] of it.affixes) if (CORE_ATTR[k] || k === 'allStats') s[k] = (s[k] || 0) + v; }
      const bonus = coreBonus(s), keys = Object.keys(bonus);
      let D;
      if (keys.length) {
        const asc = c.ascAttr, merged = Object.assign({}, asc); for (const a of keys) merged[a] = (merged[a] || 0) + bonus[a];
        c.ascAttr = merged; try { D = d0.apply(this, arguments); } finally { c.ascAttr = asc; }
      } else D = d0.apply(this, arguments);
      try {
        const ms = Math.min(TOTAL_CAPS.moveSpeed, (D.sub && D.sub.moveSpeed) || 0); if (ms) D.init += Math.floor(ms / 4);
        D.gearCore = bonus;
      } catch (e) { /* derive stays as it was */ }
      return D;
    }; }
  // ------------------------------------------------ damage: conditional bonuses out, reductions and resistances in, then on-hit effects
  { const ad0 = Battle.prototype.applyDamage; Battle.prototype.applyDamage = function (src, tgt, amt, type, opt = {}) {
      let a = amt;
      try {
        if (amt > 0 && tgt) {
          if (isHero(src) && tgt.side === 'foe') {
            const s = subOf(src), f = frac(tgt);
            const when = {
              elite: !!(tgt.elite || tgt.boss), injured: f < 0.35, healthy: f >= 0.8, cc: has(tgt, ...CC_IDS), vuln: has(tgt, 'vulnerable', 'shocked'),
              burning: has(tgt, 'burning'), poisoned: has(tgt, 'venom', 'poisoned'), bleeding: has(tgt, 'bleeding'), chilled: has(tgt, 'frostbite', 'slowed'), stunned: has(tgt, 'stunned', 'paralyzed', 'asleep'),
              melee: !!opt.attack && !opt.ranged, ranged: !!opt.ranged, attack: !!opt.attack, spell: !!opt.magic && !opt.proc, phys: PHYS.includes(type), poison: type === 'poison' || type === 'acid',
            };
            const m = outgoingPct(s, when); if (m) a = a * (1 + m / 100);
            if (!opt.proc && !opt.tick && R() * 100 < OVERPOWER_CHANCE) { a = a * (OVERPOWER_MULT + (s.overpower || 0) / 100); this.note(tgt, 'OVERPOWER'); }
          } else if (!src && opt.tick && tgt.side === 'foe') {
            let dot = 0; for (const u of this.party || []) if (isHero(u) && hpOf(u) > 0) dot = Math.max(dot, subOf(u).dmgDot || 0);
            if (dot) a = a * (1 + dot / 100);
          }
          if (isHero(tgt)) {
            const s = subOf(tgt);
            const red = reductionPct(s, { elite: !!(src && (src.elite || src.boss)), melee: !!(src && opt.attack && !opt.ranged), ranged: !!(src && (opt.ranged || opt.magic)), burning: has(src, 'burning'), poisoned: has(src, 'venom', 'poisoned'), injured: frac(tgt) < 0.35, fortified: has(tgt, 'barrier', 'fortify') });
            const res = resistFor(s, type);
            a = a * (1 - red / 100) * (1 - res / 100);
          }
          a = Math.max(1, Math.round(a));
        }
      } catch (e) { a = amt; }
      const wasAlive = !!tgt && hpOf(tgt) > 0;
      const dealt = ad0.call(this, src, tgt, a, type, opt);
      try {
        if (dealt > 0 && isHero(src) && tgt && tgt.side === 'foe' && !opt.proc && !opt.tick) {
          const s = subOf(src), mhp = Math.max(1, maxHpOf(src));
          if (s.lifeOnHit && hpOf(src) > 0) this.heal(src, s.lifeOnHit);
          const luck = 1 + Math.min(TOTAL_CAPS.luckyHit, s.luckyHit || 0) / 100;
          const COND = { lhStun: 'stunned', lhChill: 'frostbite', lhSlow: 'slowed', lhVuln: 'vulnerable', lhBurn: 'burning', lhPoison: 'venom', lhBleed: 'bleeding', lhWeaken: 'weakened', lhBlind: 'blinded' };
          for (const k of LH_KEYS) {
            const v = s[k]; if (!v || R() * 100 >= v * luck) continue;
            if (COND[k]) { if (tgt.hp > 0 && !(tgt.condImm || []).includes(COND[k])) { addEffect(tgt, { id: COND[k], rounds: lhRounds(k, s.ccDur), lvl: src.ch.lvl || 1 }); this.note(tgt, (CONDITIONS[COND[k]] || BUFFS[COND[k]] || { name: COND[k] }).name); } }
            else if (k === 'lhHeal' && hpOf(src) > 0) this.heal(src, Math.max(1, Math.round(mhp * 0.04)));
            else if (k === 'lhExecute' && tgt.hp > 0 && !tgt.boss && frac(tgt) < 0.2) { this.note(tgt, 'EXECUTE'); this.applyDamage(src, tgt, hpOf(tgt), type, { proc: true }); }
          }
        }
        if (wasAlive && tgt && hpOf(tgt) <= 0 && isHero(src) && tgt.side === 'foe') {
          const s = subOf(src);
          if (s.lifeOnKill && hpOf(src) > 0) this.heal(src, s.lifeOnKill);
          if (s.resGen && R() * 100 < Math.min(100, s.resGen)) restoreResource(src.ch);
        }
      } catch (e) { /* the hit itself already landed */ }
      return dealt;
    }; }
  // one charge of a spent class resource comes back (lowest spell slot first, then pact, ki, sorcery, rage, ...)
  function restoreResource(c) {
    if (!c || !c.res || typeof resMax !== 'function') return false;
    const mx = resMax(c);
    if (Array.isArray(c.res.slots) && Array.isArray(mx.slots)) for (let i = 0; i < mx.slots.length; i++) if ((c.res.slots[i] || 0) < mx.slots[i]) { c.res.slots[i] = (c.res.slots[i] || 0) + 1; return true; }
    for (const k of ['pact', 'ki', 'sp', 'rage', 'channel', 'inspire', 'wild', 'surge', 'wind']) if (typeof mx[k] === 'number' && (c.res[k] || 0) < mx[k]) { c.res[k] = (c.res[k] || 0) + 1; return true; }
    return false;
  }
  window.restoreGearResource = restoreResource;
  // ------------------------------------------------ healing received
  { const h0 = Battle.prototype.heal; Battle.prototype.heal = function (u, amt) {
      try { if (isHero(u) && amt > 0) { const hr = Math.min(100, subOf(u).healRecv || 0); if (hr) amt = Math.round(amt * (1 + hr / 100)); } } catch (e) { /* plain heal */ }
      return h0.call(this, u, amt);
    }; }
  // ------------------------------------------------ barrier generation and crowd control reduction on heroes
  if (typeof addEffect === 'function') { const ae0 = addEffect; addEffect = function (u, e) {
      try {
        if (u && e && isHero(u)) {
          const s = subOf(u);
          if (e.id === 'barrier' && e.pool > 0 && s.barrierGen) {
            const cur = effOf(u, 'barrier'), base = (cur && cur.pool) || 0, add = e.pool - base;
            if (add > 0) e = Object.assign({}, e, { pool: Math.round(base + add * (1 + Math.min(150, s.barrierGen) / 100)) });
          } else if (CC_ON_HERO.includes(e.id) && e.rounds > 1 && e.rounds < 90 && s.ccReduce) {
            e = Object.assign({}, e, { rounds: Math.max(1, Math.round(e.rounds * (1 - Math.min(TOTAL_CAPS.ccReduce, s.ccReduce) / 100))) });
          }
        }
      } catch (err) { /* apply as given */ }
      return ae0.call(this, u, e);
    }; }
  // ------------------------------------------------ life per turn, and turn-based cooldown reduction
  { const st0 = Battle.prototype.startTurn; Battle.prototype.startTurn = function (u) {
      const steps = st0.apply(this, arguments);
      try {
        if (Array.isArray(steps) && isHero(u) && u.ch.hp > 0) {
          const s = subOf(u);
          if (s.lifeRegen && hpOf(u) < maxHpOf(u)) this.heal(u, s.lifeRegen);
          const cdr = Math.min(TOTAL_CAPS.cdr, s.cdr || 0);
          if (cdr && this.skillUses && this.skillUses.size && R() * 100 < cdr / 3) { this.skillUses.clear(); steps.push(this.say(`${u.name}'s skills are ready again!`)); }
        }
      } catch (e) { /* turn goes on */ }
      return steps;
    }; }
  // ------------------------------------------------ real-time cooldown reduction
  if (typeof Battle.prototype.useHotbar === 'function') { const uh0 = Battle.prototype.useHotbar; Battle.prototype.useHotbar = function () {
      const before = this.rt && this.rt.cooldowns ? Object.assign({}, this.rt.cooldowns) : null;
      const r = uh0.apply(this, arguments);
      try {
        if (before && isHero(this.actor)) {
          const cdr = Math.min(TOTAL_CAPS.cdr, subOf(this.actor).cdr || 0), cd = this.rt.cooldowns;
          if (cdr) for (const id in cd) if (cd[id] > (before[id] || 0)) cd[id] = Math.max(1, Math.round(cd[id] * (1 - cdr / 100)));
        }
      } catch (e) { /* cooldowns stay */ }
      return r;
    }; }
}
