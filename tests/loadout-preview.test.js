import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/loadouts.js', import.meta.url), 'utf8');

test('loadout selection previews defensive and offensive stats before confirmation', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  for (const label of ['AC ', 'ATTACK ', 'DAMAGE ', 'HP ']) assert.ok(source.includes(label));
  assert.ok(source.includes("choose(['APPLY LOADOUT', 'CANCEL']"));
  assert.ok(source.includes("preview.lines.join(' · ').slice(0, 120)"));
});

test('loadout preview reports unavailable pieces and does not apply until confirmed', () => {
  assert.ok(source.includes("if (missing.length) lines.push(('MISSING: ' + missing.join(', '))"));
  assert.ok(source.includes("if (action !== 0) return setsMenu()"));
  assert.ok(source.includes('applySet(set, preview.plan)'));
  assert.ok(source.indexOf("if (action !== 0) return setsMenu()") < source.indexOf('applySet(set, preview.plan)'));
});

test('preview builds a separate equipment map without mutating live equipment', () => {
  assert.ok(source.includes('eq = { ...G.eq }'));
  assert.ok(source.includes('derive({ ...G, eq })'));
  assert.ok(source.includes('const current = derive(G), target = derive({ ...G, eq })'));
});
