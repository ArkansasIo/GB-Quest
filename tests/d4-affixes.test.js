import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const load = () => { const c = { Math, Object, Array, String, Number, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('d4_affixes.js'), c); return c.GBQAffixes; };
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

test('affix catalog: every family of a Diablo IV-style list, each with a name that fits the screen', () => {
  const A = load();
  assert.ok(A.AFFIX_IDS.length >= 80, `full list (${A.AFFIX_IDS.length})`);
  assert.equal(new Set(A.AFFIX_IDS).size, A.AFFIX_IDS.length, 'no duplicate keys');
  for (const cat of A.AFFIX_CATS) assert.ok(A.AFFIX_IDS.some(k => A.AFFIXES[k].cat === cat), `has ${cat} affixes`);
  for (const k of A.AFFIX_IDS) {
    const a = A.AFFIXES[k];
    assert.ok(a.name.length <= 14, `${k} name fits: ${a.name}`);
    assert.ok(a.kk > 0 && a.max > 0 && a.desc, k);
    assert.ok(['%', ''].includes(a.unit), k);
  }
  for (const k of ['crit', 'critdmg', 'dmg', 'hp', 'acb', 'resist', 'fire', 'cold', 'lightning', 'necrotic', 'radiant', 'mf', 'gf', 'xp']) assert.ok(A.AFFIXES[k], `old affix ${k} kept`);
  for (const k of ['strength', 'allStats', 'overpower', 'dmgElite', 'dmgVuln', 'dr', 'drElite', 'resFire', 'resPoison', 'lifeOnHit', 'lifeOnKill', 'cdr', 'moveSpeed', 'luckyHit', 'lhStun', 'lhExecute']) assert.ok(A.AFFIXES[k], `has ${k}`);
});

test('slot pools: weapon, off-hand, all 7 armour categories and jewelry', () => {
  const A = load();
  assert.deepEqual([...A.ARMOUR_CATEGORY_GROUPS], ['head', 'back', 'armor', 'hands', 'waist', 'legs', 'feet']);
  for (const g of ['weapon', 'offhand', ...A.ARMOUR_CATEGORY_GROUPS, 'jewelry']) {
    const pool = A.SLOT_GROUPS[g].pool;
    assert.ok(pool.length >= 7, `${g} can fill a divine item's 7 lines`);
    assert.equal(new Set(pool).size, pool.length, `${g} pool has no repeats`);
    for (const k of pool) assert.ok(A.AFFIXES[k], `${g}: ${k} is defined`);
  }
  assert.ok(A.SLOT_GROUPS.weapon.pool.includes('dmgElite') && !A.SLOT_GROUPS.weapon.pool.includes('block'), 'weapons roll offense');
  assert.ok(A.SLOT_GROUPS.feet.pool.includes('moveSpeed'), 'boots roll movement speed');
  assert.ok(A.SLOT_GROUPS.hands.pool.includes('lhStun') && A.SLOT_GROUPS.hands.pool.includes('crit'), 'gloves roll lucky hits and crit');
  assert.ok(A.SLOT_GROUPS.offhand.pool.includes('block'), 'shields roll block');
  for (const k of A.AFFIX_IDS) assert.ok(Object.values(A.SLOT_GROUPS).some(g => g.pool.includes(k)), `${k} can roll somewhere`);
  assert.equal(A.groupForSlot('ring2'), 'jewelry'); assert.equal(A.groupForSlot('neck'), 'jewelry'); assert.equal(A.groupForSlot('trinket1'), 'jewelry');
  assert.equal(A.groupForSlot('head'), 'head'); assert.equal(A.groupForSlot('offhand'), 'offhand'); assert.equal(A.groupForSlot('weapon'), 'weapon');
});

test('rolling: distinct affixes from the slot pool, on the gen.js value curve, within caps', () => {
  const A = load();
  const rolled = A.rollSlotAffixes('feet', 7, 300, 8, seq([0.1, 0.5, 0.9, 0.3, 0.7]));
  assert.equal(rolled.length, 7);
  assert.equal(new Set(rolled.map(r => r[0])).size, 7, 'no repeated affix on one item');
  for (const [k, v] of rolled) { assert.ok(A.SLOT_GROUPS.feet.pool.includes(k), k); assert.ok(v >= 1 && v <= A.AFFIXES[k].max, `${k}=${v}`); }
  assert.equal(A.affixValue('dmg', 60, 5, 1), Math.round(3 * (1 + 60 / 12) * (0.6 + 5 * 0.25)), 'same curve as gen.js');
  assert.ok(A.affixValue('dmgElite', 600, 8, 1) > A.affixValue('dmgElite', 10, 3, 0), 'higher level and rarity roll higher');
  assert.equal(A.affixValue('dr', 720, 8, 1), A.AFFIXES.dr.max, 'capped per line');
  assert.equal(A.affixValue('lhExecute', 1, 0, 0), 1, 'never below 1');
  // weighting: single-school resistances and lucky hits can't crowd an item
  assert.ok(A.affixWeight('resFire') < 1 && A.affixWeight('lhStun') < 1 && A.affixWeight('resist') === 1 && A.affixWeight('dmg') === 1);
  let s = 12345; const lcg = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  let res = 0; for (let i = 0; i < 2000; i++) res += A.rollSlotAffixes('feet', 5, 300, 6, lcg).filter(([k]) => A.RES_KEYS.includes(k) && k !== 'resist').length;
  assert.ok(res / 2000 < 1.2, `boots average under ~1 single resistance (${(res / 2000).toFixed(2)})`);
});

test('effect rules: reductions, resistances, conditional damage and core stats', () => {
  const A = load();
  assert.equal(A.reductionPct({ dr: 10, drElite: 15, drMelee: 5 }, { elite: true }), 25);
  assert.equal(A.reductionPct({ dr: 40, drElite: 40 }, { elite: true }), A.TOTAL_CAPS.dr, 'damage reduction is capped');
  assert.equal(A.resistFor({ resFire: 30 }, 'fire'), 30); assert.equal(A.resistFor({ resFire: 30 }, 'cold'), 0);
  assert.equal(A.resistFor({ resShock: 90 }, 'lightning'), A.TOTAL_CAPS.res);
  assert.equal(A.outgoingPct({ dmgElite: 20, dmgInjured: 30, dmgSpell: 10 }, { elite: true, injured: true }), 50);
  assert.equal(A.outgoingPct({ dmgElite: 20 }, {}), 0, 'conditional damage needs its condition');
  assert.deepEqual({ ...A.coreBonus({ strength: 5, allStats: 2 }) }, { STR: 7, DEX: 2, CON: 2, INT: 2, WIS: 2, CHA: 2, LCK: 2, WIL: 2, SPD: 2 });
  assert.equal(A.coreBonus({ strength: 90 }).STR, A.TOTAL_CAPS.core);
  assert.equal(A.lhRounds('lhStun', 0), 1); assert.equal(A.lhRounds('lhBurn', 100), 4);
});
