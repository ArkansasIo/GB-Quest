import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scenes_menu.js', import.meta.url), 'utf8');

test('equipment screen reports set-piece progress and optional durability safely', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /const setId = selected && \(selected\.setId \|\| selected\.set \|\| selected\.template\?\.setId \|\| selected\.template\?\.set\)/);
  assert.match(source, /const setPieces = setId \? Object\.values\(G\.eq\)\.filter/);
  assert.match(source, /SET \\$\{String\(setId\)/);
  assert.match(source, /Number\.isFinite\(it\.durability\)/);
  assert.match(source, /DUR \\$\{Math\.max\(0, Math\.min\(100/);
  assert.match(source, /DURABILITY N\/A/);
  assert.match(source, /ATTUNED/);
});
