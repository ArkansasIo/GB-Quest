import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/gear_awaken.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, Error, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQGearAwaken; }
const STATS = ['crit', 'critdmg', 'dodge', 'block', 'leech', 'haste', 'dmg', 'heal', 'resist', 'thorns', 'hp', 'acb', 'hit', 'fire', 'cold', 'lightning', 'necrotic', 'radiant'];
const sword = (rarity, ilvl = 30, awk) => ({ kind: 'weapon', rarity, ilvl, awk });
const plate = (rarity, ilvl = 30, awk) => ({ kind: 'armor', rarity, ilvl, awk });
const rich = { awk_stone: 999, shard: 999, ember: 99 };

test('every weapon and armour path uses known stats and has both traits', () => {
  const A = load();
  assert.ok(Object.keys(A.GA_PATHS.weapon).length >= 5 && Object.keys(A.GA_PATHS.armor).length >= 5);
  for (const fam of ['weapon', 'armor']) for (const [id, p] of Object.entries(A.GA_PATHS[fam])) {
    for (const [k] of [...p.per, ...p.t3.stats, ...p.t5.stats]) assert.ok(STATS.includes(k), `${fam}.${id} stat ${k}`);
    assert.ok(p.name.length <= 8, `${id} name fits the menu`);
    assert.ok(p.t3.name && p.t5.name && p.desc);
  }
});

test('only weapons and armour can be awakened', () => {
  const A = load();
  assert.equal(A.gaCanAwaken(sword(3)), true);
  assert.equal(A.gaCanAwaken(plate(3)), true);
  assert.equal(A.gaCanAwaken({ kind: 'wondrous', rarity: 5 }), false);
  assert.match(A.gaBlock({ kind: 'wondrous', rarity: 5 }, 100, rich, 1e9), /Only weapons and armour/);
});

test('star cap follows rarity and hero level gates each star', () => {
  const A = load();
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(r => A.gaCap(sword(r))), [1, 1, 2, 3, 4, 5]);
  assert.match(A.gaBlock(sword(2, 30, { stars: 2, path: 'ember' }), 100, rich, 1e9), /at most/);
  assert.match(A.gaBlock(sword(5, 30, { stars: 1, path: 'ember' }), 5, rich, 1e9), /hero level 10/);
  assert.equal(A.gaBlock(sword(5, 30, { stars: 1, path: 'ember' }), 10, rich, 1e9), null);
  assert.match(A.gaBlock(sword(5, 30, { stars: 5, path: 'ember' }), 720, rich, 1e9), /Fully awakened/);
});

test('costs rise per star and need shards from III and an ember at V', () => {
  const A = load(), it = sword(5, 30);
  const c = [1, 2, 3, 4, 5].map(n => A.gaCost(it, n));
  for (let i = 1; i < 5; i++) assert.ok(c[i].gold > c[i - 1].gold && c[i].stone > c[i - 1].stone);
  assert.deepEqual(c.map(x => x.shard), [0, 0, 1, 2, 3]);
  assert.deepEqual(c.map(x => x.ember), [0, 0, 0, 0, 1]);
  assert.match(A.gaBlock(it, 100, { awk_stone: 0 }, 1e9), /awakening stones/);
  assert.match(A.gaBlock(it, 100, rich, 0), /G\.$/);
});

test('stats grow with stars and unlock traits at III and V', () => {
  const A = load();
  const at = n => Object.fromEntries(A.gaStats(sword(5, 30, { stars: n, path: 'ember' })));
  assert.equal(A.gaStats(sword(5, 30, { stars: 0 })).length, 0);
  assert.ok(at(1).dmg > 0 && at(1).fire > 0);
  assert.ok(at(2).fire > at(1).fire && at(2).dmg > at(1).dmg);
  assert.equal(at(2).crit, undefined); assert.ok(at(3).crit >= 3);      // KINDLED at III
  assert.equal(at(4).critdmg, undefined); assert.ok(at(5).critdmg > 0); // INFERNO HEART at V
  const arm = Object.fromEntries(A.gaStats(plate(5, 30, { stars: 4, path: 'bulwark' })));
  assert.ok(arm.hp > 0 && arm.block > 0 && arm.acb >= 3); // +1 at II, +1 at IV, +1 BASTION at III
  // higher item level scales the level-scaled stats
  const lo = Object.fromEntries(A.gaStats(sword(5, 10, { stars: 3, path: 'ember' }))), hi = Object.fromEntries(A.gaStats(sword(5, 300, { stars: 3, path: 'ember' })));
  assert.ok(hi.fire > lo.fire && hi.dmg > lo.dmg);
});

test('first star needs a path; later stars keep it', () => {
  const A = load();
  assert.throws(() => A.gaNext(sword(5)), /valid path/);
  assert.throws(() => A.gaNext(sword(5), 'bulwark'), /valid path/); // armour path on a weapon
  const s1 = A.gaNext(sword(5), 'storm'); assert.deepEqual({ ...s1 }, { stars: 1, path: 'storm' });
  const s2 = A.gaNext(sword(5, 30, s1), 'ember'); assert.deepEqual({ ...s2 }, { stars: 2, path: 'storm' });
  assert.equal(A.gaSpentStones(sword(5, 30, { stars: 3, path: 'storm' })), 1 + 3 + 5);
});
