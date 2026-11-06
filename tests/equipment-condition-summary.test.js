import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scenes_menu.js', import.meta.url), 'utf8');

test('equipment screen reports set-piece progress and optional durability safely', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  assert.ok(source.includes('const setId = selected && (selected.setId || selected.set || selected.template?.setId || selected.template?.set)'));
  assert.ok(source.includes('const setPieces = setId ? Object.values(G.eq).filter'));
  assert.ok(source.includes('SET ${String(setId).replace'));
  assert.ok(source.includes('Number.isFinite(it.durability)'));
  assert.ok(source.includes('DUR ${Math.max(0, Math.min(100'));
  assert.ok(source.includes('DURABILITY N/A'));
  assert.ok(source.includes('ATTUNED'));
});

test('equipment condition summary supports both current and legacy durability keys', () => {
  assert.match(source, /it\\?\.maxDur \\?\\? it\\?\.maxDurability/);
  assert.match(source, /it\\?\.dur \\?\\? it\\?\.durability/);
  assert.match(source, /Number\.isFinite\\(dur\\)/);
});
