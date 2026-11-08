import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/boss_rewards.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQBossRewards; }
test('boss categories have explicit rune drop chances and family pools', () => {
  const api = load();
  for (const cat of ['world', 'dungeon', 'trial', 'tower', 'arc', 'raid']) {
    assert.ok(api.BOSS_RUNE_DROP_CHANCE[cat] > 0 && api.BOSS_RUNE_DROP_CHANCE[cat] <= 1);
    assert.ok(api.BOSS_RUNE_FAMILIES[cat].length > 0);
  }
});
test('boss rune drops are deterministic, tiered by level and capped at tier nine', () => {
  const api = load();
  assert.deepEqual(Array.from(api.rollBossRuneDrops({ cat: 'world' }, 1, () => 0)), ['might_r1']);
  assert.deepEqual(Array.from(api.rollBossRuneDrops({ cat: 'raid' }, 720, () => 0)), ['flame_r9', 'flame_r9']);
  assert.deepEqual(Array.from(api.rollBossRuneDrops({ cat: 'raid' }, 720, () => 0.99)), []);
  assert.deepEqual(Array.from(api.rollBossRuneDrops(null, 100, () => 0)), []);
});
