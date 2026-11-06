import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const menu = fs.readFileSync(new URL('../src/scenes_menu.js', import.meta.url), 'utf8');
const vendor = fs.readFileSync(new URL('../src/scenes_world.js', import.meta.url), 'utf8');
const market = fs.readFileSync(new URL('../src/market.js', import.meta.url), 'utf8');

test('inventory inspection exposes gear identity, set, condition, sockets and attunement', () => {
  const start = menu.indexOf('function itemInspectText(it)');
  const end = menu.indexOf('\nfunction itemDesc(it)', start);
  assert.ok(start >= 0 && end > start, 'item inspection helper exists');
  const helper = menu.slice(start, end);
  for (const marker of ['IL', 'setId', 'setPieces', 'maxDur', 'gemSocketCapacity', 'runeSocketCapacity', 'it.sockets', 'it.runeSockets', 'it.attune', 'it.aclass']) {
    assert.ok(helper.includes(marker), 'inspection includes ' + marker);
  }
});

test('vendor gear preview includes rarity, item level, set, durability, sockets and attunement', () => {
  const start = vendor.indexOf('function previewVendorGear(item, price, onBuy)');
  const end = vendor.indexOf('\nfunction vendorMenu()', start);
  assert.ok(start >= 0 && end > start);
  const helper = vendor.slice(start, end);
  for (const marker of ['RARITY[item.rarity]', 'item.ilvl', 'setId', 'item.maxDur', 'gemSocketCapacity', 'runeSocketCapacity', 'item.sockets', 'item.runeSockets', 'item.attune']) {
    assert.ok(helper.includes(marker), 'vendor preview includes ' + marker);
  }
});

test('auction gear preview includes rarity, item level, set, durability, sockets and attunement', () => {
  const start = market.indexOf('if (!e.stack && e.item)');
  const end = market.indexOf("if (this.tab === 2)", start);
  assert.ok(start >= 0 && end > start);
  const helper = market.slice(start, end);
  for (const marker of ['RARITY[item.rarity]', 'item.ilvl', 'setId', 'item.maxDur', 'gemSocketCapacity', 'runeSocketCapacity', 'item.sockets', 'item.runeSockets', 'item.attune']) {
    assert.ok(helper.includes(marker), 'auction preview includes ' + marker);
  }
});
