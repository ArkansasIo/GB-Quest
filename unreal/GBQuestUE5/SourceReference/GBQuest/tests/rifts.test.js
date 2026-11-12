import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/rifts.js', import.meta.url), 'utf8');
function load() { const c = { Math, Number, String, Object, Array, Date, globalThis: null }; c.globalThis = c; vm.runInNewContext(source, c); return c.GBQRifts; }

test('greater rift scaling grows with level', () => {
  const A = load();
  const m1 = A.grMult(1), m10 = A.grMult(10), m50 = A.grMult(50);
  assert.equal(m1.hp, 1); assert.equal(m1.dmg, 1); assert.equal(m1.lvlBonus, 0);
  assert.ok(m10.hp > m1.hp && m50.hp > m10.hp && m50.dmg > m10.dmg);
  assert.equal(m50.lvlBonus, 10);
  assert.deepEqual({ ...A.grMult(9999) }, { ...A.grMult(A.GR_MAX) });
});

test('timer result unlocks 3, 2, 1 or 0 levels', () => {
  const A = load(), T = A.GR_TIME;
  assert.equal(A.grResult(T * 0.5).unlock, 3);
  assert.equal(A.grResult(T * 0.7).unlock, 2);
  assert.equal(A.grResult(T * 0.95).unlock, 1);
  const late = A.grResult(T * 1.2); assert.equal(late.unlock, 0); assert.equal(late.timed, false);
});

test('progress per foe, rewards and unlocked level', () => {
  const A = load();
  assert.equal(A.foeProgress({}), 5); assert.equal(A.foeProgress({ elite: true }), 18); assert.equal(A.foeProgress({ boss: true }), 30);
  const n = A.riftRewards('normal', 1, 20); assert.equal(n.keys, 1); assert.ok(n.gold > 0 && n.stones >= 1);
  const g5 = A.riftRewards('greater', 5, 40), g30 = A.riftRewards('greater', 30, 40), late = A.riftRewards('greater', 30, 40, false);
  assert.ok(g30.gold > g5.gold && g30.stones > g5.stones && g30.rarity > g5.rarity);
  assert.ok(late.gold < g30.gold && late.rarity <= 3);
  assert.equal(A.maxUnlocked(0), 1); assert.equal(A.maxUnlocked(12), 13); assert.equal(A.maxUnlocked(999), A.GR_MAX);
});

test('leaderboard keeps the 10 best: level first, then time', () => {
  const A = load(); let b = [];
  for (let i = 0; i < 14; i++) b = A.addToBoard(b, { level: i % 7, time: 600 - i });
  assert.equal(b.length, 10);
  for (let i = 1; i < b.length; i++) assert.ok(b[i - 1].level > b[i].level || (b[i - 1].level === b[i].level && b[i - 1].time <= b[i].time));
  assert.equal(A.fmtTime(905), '15:05');
  const r = A.normRift({ keys: '2', best: 7, board: 'x' }); assert.equal(r.keys, 2); assert.equal(r.board.length, 0); assert.equal(r.active, null);
});
