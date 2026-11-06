import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/loadouts.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const loadouts = context.GBQLoadouts;

test('equipment set snapshots retain stable item uids by slot', () => {
  const snapshot = loadouts.setFromEq({
    weapon: { uid: 11, name: 'Sword' },
    armor: { uid: 12, name: 'Mail' },
    offhand: null
  });
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), { weapon: 11, armor: 12 });
});

test('equipment set plan locates pieces across equipped, bag and bank inventories', () => {
  const plan = loadouts.planSet(
    { weapon: 11, armor: 12, ring1: 13, neck: 14 },
    { weapon: { uid: 11 }, ring2: { uid: 13 } },
    [{ uid: 12 }],
    [{ uid: 14 }]
  );
  assert.equal(plan.weapon.where, 'worn');
  assert.equal(plan.armor.where, 'bag');
  assert.equal(plan.ring1.where, 'eq');
  assert.equal(plan.neck.where, 'bank');
});

test('loadout manager exposes save, overwrite, rename and delete set actions', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  for (const action of ['SAVE CURRENT GEAR', 'OVERWRITE A SET', 'RENAME A SET', 'DELETE A SET']) {
    assert.ok(source.includes(action), `missing action: ${action}`);
  }
  for (const name of ['DAMAGE', 'TANK', 'HEALER', 'DUNGEON', 'RAID', 'PVP', 'FARM']) {
    assert.ok(source.includes(name), `missing preset name: ${name}`);
  }
});
