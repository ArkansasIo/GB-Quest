import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/runes.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQRunes; }
test('rune catalog has nine families and nine tiers each', () => {
  const api = load(); assert.equal(Object.keys(api.RUNE_TYPES).length, 9);
  for (const type of Object.keys(api.RUNE_TYPES)) for (let tier = 1; tier <= 9; tier++) assert.ok(api.runeDefinition(type + '_r' + tier));
  assert.equal(api.runeDefinition('flame_r10'), null);
});
test('rune sockets scale from one to three and reject unsupported items', () => {
  const api = load(); assert.equal(api.runeSocketCapacity({ kind: 'weapon', ilvl: 1 }), 1);
  assert.equal(api.runeSocketCapacity({ kind: 'armor', ilvl: 240 }), 1);
  assert.equal(api.runeSocketCapacity({ kind: 'weapon', ilvl: 241 }), 2);
  assert.equal(api.runeSocketCapacity({ kind: 'armor', ilvl: 481 }), 3);
  assert.equal(api.runeSocketCapacity({ kind: 'wondrous', ilvl: 720 }), 0);
});
test('rune insertion and extraction preserve source item and validate occupied slots', () => {
  const api = load(), item = { kind: 'weapon', ilvl: 500 };
  const inserted = api.insertRune(item, 'flame_r4', 1);
  assert.equal(inserted.ok, true); assert.equal(item.runeSockets, undefined);
  assert.deepEqual(Array.from(inserted.item.runeSockets), [null, 'flame_r4', null]);
  assert.equal(api.insertRune(inserted.item, 'ward_r1', 1).ok, false);
  const removed = api.extractRune(inserted.item, 1); assert.equal(removed.rune, 'flame_r4');
});
test('rune inventory consumes only after successful socketing and refunds extraction', () => {
  const api = load(), character = { runes: {} }, item = { kind: 'armor', ilvl: 720 };
  api.addRuneToInventory(character, 'vigor_r2', 2);
  const added = api.socketRuneFromInventory(character, item, 'vigor_r2', 0);
  assert.equal(added.ok, true); assert.equal(character.runes.vigor_r2, 1);
  api.unsocketRuneToInventory(character, added.item, 0); assert.equal(character.runes.vigor_r2, 2);
});
test('rune sockets aggregate deterministic modifiers', () => {
  const api = load(), item = { kind: 'weapon', ilvl: 720, runeSockets: ['flame_r2', 'might_r3', 'shadow_r1'] };
  const stats = api.runeAffixes(item); assert.equal(stats.fire, 4); assert.equal(stats.dmg, 3); assert.equal(stats.crit, 1);
});
