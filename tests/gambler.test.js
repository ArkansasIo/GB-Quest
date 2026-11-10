import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/gambler.js', import.meta.url), 'utf8');
function load() { const c = { Math, Number, String, Object, Array, RegExp, globalThis: null }; c.globalThis = c; vm.runInNewContext(source, c); return c.GBQGambler; }

test('odds sum to 1 and rarities respect the level gates', () => {
  const A = load();
  assert.ok(Math.abs(A.GAMBLE_ODDS.reduce((s, [, p]) => s + p, 0) - 1) < 1e-9);
  assert.equal(A.gambleRarity(0.001, 50), 6);   // mythic at 50
  assert.equal(A.gambleRarity(0.001, 10), 5);   // a mythic roll steps down to legendary below 40
  assert.equal(A.gambleRarity(0.001, 1), 3);    // ...and to rare at level 1
  assert.equal(A.gambleRarity(0.02, 20), 5);
  assert.equal(A.gambleRarity(0.99, 20), 2);
  for (let i = 0; i < 200; i++) { const r = A.gambleRarity(i / 200, 3); assert.ok(r >= 2 && r <= 3, 'level 3 gets uncommon or rare only'); }
});

test('pity: the 20th gamble without a legendary is legendary', () => {
  const A = load();
  assert.equal(A.gambleRarity(0.99, 20, A.PITY - 1), A.LEGENDARY);
  assert.equal(A.gambleRarity(0.99, 20, A.PITY - 2), 2);
  assert.equal(A.gambleRarity(0.99, 5, A.PITY - 1), 2); // no legendary before its level gate
});

test('cost scales every 20 levels', () => {
  const A = load();
  assert.equal(A.gambleCost(10, 1), 10); assert.equal(A.gambleCost(10, 20), 20); assert.equal(A.gambleCost(10, 100), 60);
});

test('loot filter keeps protected items and filters only below the threshold', () => {
  const A = load(), f = { level: 'rare', action: 'sell' };
  const it = (rarity, extra = {}) => ({ kind: 'weapon', rarity, ...extra });
  assert.equal(A.filterDecision(it(1), { level: 'off' }), 'keep');
  assert.equal(A.filterDecision(it(1), f), 'sell');
  assert.equal(A.filterDecision(it(2), f), 'sell');
  assert.equal(A.filterDecision(it(3), f), 'keep');
  assert.equal(A.filterDecision(it(4), f), 'keep');
  assert.equal(A.filterDecision(it(1, { fav: true }), f), 'keep');
  assert.equal(A.filterDecision(it(1, { heirloom: true }), f), 'keep');
  assert.equal(A.filterDecision(it(1, { awk: { stars: 1 } }), f), 'keep');
  assert.equal(A.filterDecision({ kind: 'wondrous', base: 'relic_03', rarity: 2 }, f), 'keep');
  assert.equal(A.filterDecision({ kind: 'use', rarity: 0 }, f), 'keep');
  assert.equal(A.filterDecision(it(1), { level: 'common' }), 'keep');
  assert.equal(A.filterDecision(it(0), { level: 'common' }), 'salvage');
  const n = A.normFilter({ level: 'bogus', action: 'eat', count: '3' }); assert.equal(n.level, 'off'); assert.equal(n.action, 'salvage'); assert.equal(n.count, 3);
});
