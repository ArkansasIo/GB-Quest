import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/boss_progression.js', import.meta.url), 'utf8');
function api() { const context = { globalThis: {}, Date }; vm.runInNewContext(source, context); return context.globalThis.GBQBossProgression; }

test('boss first clear pays category tokens and gold exactly once', () => {
  const p = api(), state = { gold: 0, bossKills: {} }, boss = { id: 'boss_raid_1', cat: 'raid', lvl: 240 };
  const first = p.record(state, boss, 1000), second = p.record(state, boss, 2000);
  assert.equal(first.firstClear, true);
  assert.deepEqual(JSON.parse(JSON.stringify(first.reward)), { tokens: 6, gold: 6500, rank: 'C' });
  assert.equal(second.firstClear, false);
  assert.equal(second.reward, null);
  assert.equal(state.bossTokens, 6);
  assert.equal(state.gold, 6500);
  assert.equal(state.bossProgress.clears.boss_raid_1.kills, 2);
});

test('boss ranks cover F through SSS and summary counts all catalog entries', () => {
  const p = api();
  assert.deepEqual([1, 41, 81, 121, 201, 301, 421, 541, 641].map(lvl => p.rank({ lvl })), ['F','E','D','C','B','A','S','SS','SSS']);
  const state = {};
  p.record(state, { id: 'a', cat: 'world', lvl: 10 }, 10);
  const summary = p.summary(state, [{ id: 'a', name: 'A', cat: 'world', lvl: 10 }, { id: 'b', name: 'B', cat: 'arc', lvl: 700 }]);
  assert.equal(summary.total, 2);
  assert.equal(summary.cleared, 1);
  assert.equal(summary.remaining, 1);
});

test('named discoveries persist as collection counts', () => {
  const p = api(), state = {};
  assert.equal(p.discoverNamed(state, 'n_voidedge'), true);
  assert.equal(p.discoverNamed(state, 'n_voidedge'), true);
  assert.equal(state.bossProgress.named.n_voidedge, 2);
});
