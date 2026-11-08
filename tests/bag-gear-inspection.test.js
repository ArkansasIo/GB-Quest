import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scenes_menu.js', import.meta.url), 'utf8');

test('bag gear inspection compares a candidate against its currently equipped slot', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /function itemInspectText\(it\)/);
  assert.match(source, /const slot = itemSlot\(it\), equipped = G\.eq\[slot\]/);
  assert.match(source, /itemScore\(G, it\) - itemScore\(G, equipped\)/);
  assert.match(source, /UPGRADE \+\$\{delta\}/);
  assert.match(source, /DOWNGRADE \$\{delta\}/);
  assert.match(source, /SIDEGRADE/);
  assert.match(source, /this\.tab === 0 \? itemInspectText\(e\) : ITEMS\[e\]\.desc/);
});
