import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/gear_catalog.js', import.meta.url), 'utf8');
const context = { WEAPONS: {}, ARMORS: {} };
vm.runInNewContext(source, context, { filename: 'src/gear_catalog.js' });

test('Aelmoor catalog registers all original weapon and armour bases', () => {
  assert.equal(Object.keys(context.WEAPONS).length, 16);
  assert.equal(Object.keys(context.ARMORS).length, 12);
  assert.equal(context.GBQGearCatalog.weaponCount, 16);
  assert.equal(context.GBQGearCatalog.armourCount, 12);
});

test('expanded gear names and identifiers are unique', () => {
  const ids = [...Object.keys(context.WEAPONS), ...Object.keys(context.ARMORS)];
  assert.equal(new Set(ids).size, ids.length);
  const names = [
    ...Object.values(context.WEAPONS).map(item => item.name),
    ...Object.values(context.ARMORS).map(item => item.name)
  ];
  assert.equal(new Set(names).size, names.length);
});

test('armour weight classes map to the existing armory classes', () => {
  const expected = {
    dawnforged: 'plate', graveveil: 'cloth', frostbound: 'mail',
    ashentyrant: 'plate', voidstalker: 'leather', stormcaller: 'cloth',
    thornheart: 'leather', ironclad: 'plate', starfall_robe: 'cloth',
    eclipse: 'plate', emberguard: 'mail', moonwoven: 'cloth'
  };
  for (const [id, aclass] of Object.entries(expected)) {
    assert.equal(context.ARMORS[id].aclass, aclass, id);
  }
});
