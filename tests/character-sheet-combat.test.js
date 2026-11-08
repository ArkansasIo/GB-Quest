import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scenes_menu.js', import.meta.url), 'utf8');

test('character sheet exposes a dedicated combat page without duplicating combat calculations', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /'FEATURES', 'COMBAT'/);
  assert.match(source, /this\.page = \(this\.page \+ 5\) % 6/);
  assert.match(source, /this\.page = \(this\.page \+ 1\) % 6/);
  assert.match(source, /const weapon = D\.weapon \|\| \{\}/);
  for (const label of ['WEAPON', 'DAMAGE DICE', 'DAMAGE BONUS', 'ATTACK HIT', 'ATTACKS \/ TURN', 'ARMOR CLASS', 'INITIATIVE', 'CRITICAL RANGE', 'CRITICAL CHANCE', 'CRITICAL DAMAGE', 'DODGE', 'BLOCK', 'LIFESTEAL', 'HASTE']) {
    assert.ok(source.includes(label), 'missing combat sheet metric: ' + label);
  }
  assert.match(source, /rows\.slice\(this\.scroll % rows\.length\)/);
});
