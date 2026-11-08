import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/gems.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQGems; }

test('gem catalog exposes nine families and nine tiers each', () => {
  const gems = load();
  assert.equal(Object.keys(gems.GEM_TYPES).length, 9);
  for (const type of Object.keys(gems.GEM_TYPES)) for (let tier = 1; tier <= 9; tier++) assert.ok(gems.gemDefinition(type + '_t' + tier));
  assert.equal(gems.gemDefinition('ruby_t10'), null);
  assert.equal(gems.gemDefinition('unknown_t1'), null);
});

test('socket capacity scales with item level and excludes wondrous gear', () => {
  const gems = load();
  assert.equal(gems.gemSocketCapacity({ kind: 'weapon', ilvl: 1 }), 1);
  assert.equal(gems.gemSocketCapacity({ kind: 'armor', ilvl: 180 }), 1);
  assert.equal(gems.gemSocketCapacity({ kind: 'weapon', ilvl: 181 }), 2);
  assert.equal(gems.gemSocketCapacity({ kind: 'armor', ilvl: 540 }), 3);
  assert.equal(gems.gemSocketCapacity({ kind: 'weapon', ilvl: 720 }), 4);
  assert.equal(gems.gemSocketCapacity({ kind: 'wondrous', ilvl: 720 }), 0);
});

test('inserting and extracting gems is immutable and validates occupied sockets', () => {
  const gems = load(), item = { kind: 'weapon', ilvl: 400, sockets: [null, null, null] };
  const inserted = gems.insertGem(item, 'ruby_t3', 1);
  assert.equal(inserted.ok, true);
  assert.deepEqual(Array.from(inserted.item.sockets), [null, 'ruby_t3', null]);
  assert.deepEqual(Array.from(item.sockets), [null, null, null]);
  assert.equal(gems.insertGem(inserted.item, 'ruby_t2', 1).ok, false);
  const removed = gems.extractGem(inserted.item, 1);
  assert.equal(removed.gem, 'ruby_t3');
  assert.deepEqual(Array.from(removed.item.sockets), [null, null, null]);
});

test('character gem inventory consumes on socket and refunds on extraction', () => {
  const gems = load(), character = { gems: {} }, item = { kind: 'armor', ilvl: 720 };
  assert.equal(gems.addGemToInventory(character, 'amethyst_t4', 2), true);
  const socketed = gems.socketGemFromInventory(character, item, 'amethyst_t4', 0);
  assert.equal(socketed.ok, true);
  assert.equal(character.gems.amethyst_t4, 1);
  const unsocketed = gems.unsocketGemToInventory(character, socketed.item, 0);
  assert.equal(unsocketed.ok, true);
  assert.equal(character.gems.amethyst_t4, 2);
  assert.equal(gems.socketGemFromInventory(character, item, 'amethyst_t4', 0).ok, true);
});

test('socketed gems resolve to supported stat modifiers', () => {
  const gems = load(), item = { kind: 'weapon', ilvl: 720, sockets: ['ruby_t2', 'emerald_t3', null, 'onyx_t1'] };
  const stats = gems.gemAffixes(item);
  assert.equal(stats.dmg, 2);
  assert.equal(stats.hit, 3);
  assert.equal(stats.crit, 1);
});
