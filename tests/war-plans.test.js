import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/war_plans.js', import.meta.url), 'utf8');
function load() {
  const context = { Math, Number, String, Object, Array, Date, Set, Map, JSON, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.GBQWarPlans;
}

test('catalogue contains 72 unique activities: 24 dungeons, 24 trials and 24 raids', () => {
  const A = load();
  assert.equal(A.validateActivityCatalogue(), true);
  assert.deepEqual({ ...A.activityCounts() }, { dungeon: 24, trial: 24, raid: 24 });
  assert.equal(new Set(A.ACTIVITIES.map(x => x.id)).size, 72);
  assert.equal(new Set(A.ACTIVITIES.map(x => x.name)).size, 72);
  for (const activity of A.ACTIVITIES) {
    assert.ok(activity.boss);
    assert.ok(activity.mechanic);
    assert.ok(activity.stages >= 3 && activity.stages <= 5);
  }
});

test('war plan deterministically contains one dungeon, one trial and one raid', () => {
  const A = load(), first = A.createWarPlan('season-1', 2), second = A.createWarPlan('season-1', 2);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
  assert.equal(first.nodes.length, 3);
  assert.deepEqual([...first.nodes.map(n => A.BY_ID[n.activityId].type)], ['dungeon', 'trial', 'raid']);
  assert.equal(A.nextPlanNode(first).id, 'node_1');
});

test('plan nodes must be completed in order and cannot be completed twice', () => {
  const A = load(); let plan = A.createWarPlan('progression');
  assert.equal(A.completePlanNode(plan, 'node_2').ok, false);
  for (const id of ['node_1', 'node_2', 'node_3']) {
    const result = A.completePlanNode(plan, id);
    assert.equal(result.ok, true);
    plan = result.plan;
  }
  assert.equal(A.nextPlanNode(plan), null);
  assert.equal(A.completePlanNode(plan, 'node_3').ok, false);
  assert.equal(plan.completed.length, 3);
});

test('seals clamp to tier 1-100 and deterministically roll a valid affix', () => {
  const A = load(), low = A.rollSeal(-5, 'seed'), high = A.rollSeal(999, 'seed');
  assert.equal(low.tier, 1);
  assert.equal(high.tier, 100);
  assert.equal(low.affix, high.affix);
  assert.ok(A.SEAL_AFFIXES.some(a => a.id === low.affix));
  assert.ok(A.sealPower(100).hp > A.sealPower(50).hp);
  assert.ok(A.sealPower(100).dmg > A.sealPower(50).dmg);
});

test('normalization discards malformed seals and unknown completion ids', () => {
  const A = load(), clean = A.normalizeWarPlans({
    plan: A.createWarPlan('safe'),
    seals: [{ id: 'ok', tier: 10, affix: 'emberbound' }, { id: 'bad', tier: 101 }],
    equippedSeal: 'bad',
    completedIds: ['dungeon_01', 'unknown']
  });
  assert.equal(clean.seals.length, 1);
  assert.equal(clean.equippedSeal, null);
  assert.deepEqual([...clean.completedIds], ['dungeon_01']);
  assert.equal(A.normalizeWarPlans(null).plan.nodes.length, 3);
});

test('activity reward scaling increases from dungeon to trial to raid', () => {
  const A = load(), dungeon = A.BY_ID.dungeon_01, trial = A.BY_ID.trial_01, raid = A.BY_ID.raid_01;
  assert.ok(A.sealReward(trial, 20, 1).gold > A.sealReward(dungeon, 20, 1).gold);
  assert.ok(A.sealReward(raid, 20, 1).gold > A.sealReward(trial, 20, 1).gold);
  assert.ok(A.sealReward(raid, 20, 1).shards > A.sealReward(dungeon, 20, 1).shards);
});
