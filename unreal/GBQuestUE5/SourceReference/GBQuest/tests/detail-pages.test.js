import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/detail_pages.js', import.meta.url), 'utf8');
function load() { const c = { Math, Number, String, Object, Array, globalThis: null }; c.globalThis = c; vm.runInNewContext(source, c); return c.GBQDetails; }

test('breakdown groups sources in order and adds OTHER so parts sum to the real total', () => {
  const A = load();
  const b = A.breakdown([
    { source: 'gem', stat: 'crit', value: 2 }, { source: 'affix', stat: 'crit', value: 3 }, { source: 'affix', stat: 'crit', value: 1 },
    { source: 'awaken', stat: 'fire', value: 9 }, { source: 'set', stat: 'dodge', value: 0 },
  ], { crit: 10, fire: 9, haste: 4 });
  assert.equal(b.crit.parts.map(p => p[0]).join(), 'affix,gem,other');
  assert.equal(b.crit.parts.map(p => p[1]).join(), '4,2,4');
  assert.equal(b.crit.total, 10);
  assert.equal(b.fire.parts.length, 1);
  assert.equal(b.haste.parts.map(p => p.join(':')).join(), 'other:4');
  assert.equal(b.dodge, undefined);
  for (const o of Object.values(b)) assert.ok(Math.abs(o.parts.reduce((s, p) => s + p[1], 0) - o.total) < 0.01);
});

test('every source has a display name; pct clamps', () => {
  const A = load();
  for (const s of A.SOURCE_ORDER) assert.ok(A.SOURCE_NAME[s]);
  assert.equal(A.pct(5, 10), 50); assert.equal(A.pct(20, 10), 100); assert.equal(A.pct(-1, 10), 0); assert.equal(A.pct(1, 0), 100);
});
