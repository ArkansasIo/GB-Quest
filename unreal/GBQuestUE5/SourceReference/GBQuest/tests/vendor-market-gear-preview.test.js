import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vendor = fs.readFileSync(new URL('../src/scenes_world.js', import.meta.url), 'utf8');
const market = fs.readFileSync(new URL('../src/market.js', import.meta.url), 'utf8');

test('vendor gear purchases show a stat and cost preview before spending gold', () => {
  assert.match(vendor, /function previewVendorGear\(item, price, onBuy\)/);
  assert.match(vendor, /const slot = itemSlot\(item\), current = derive\(G\), eq = \{ \.\.\.G\.eq, \[slot\]: item \}/);
  assert.match(vendor, /const target = derive\(\{ \.\.\.G, eq \}\)/);
  assert.match(vendor, /'CURRENT GOLD ' \+ fmt\(G\.gold\) \+ ' · AFTER '/);
  assert.match(vendor, /'AC ' \+ current\.ac/);
  assert.match(vendor, /'ATK ' \+ current\.weapon\.hit/);
  assert.match(vendor, /'DMG ' \+ current\.weapon\.dice/);
  assert.match(vendor, /'CRIT ' \+ current\.crit/);
  assert.match(vendor, /'DODGE ' \+ current\.dodge/);
  assert.match(vendor, /'BLOCK ' \+ current\.block/);
  assert.match(vendor, /onBuy\(\)/);
  assert.match(vendor, /previewVendorGear\(it, price/);
  assert.match(vendor, /previewVendorGear\(item, price/);
});

test('auction gear purchases preview character impact before calling Market.buy', () => {
  assert.match(market, /if \(!e\.stack && e\.item\)/);
  assert.match(market, /const item = e\.item, slot = itemSlot\(item\), current = derive\(G\), eq = \{ \.\.\.G\.eq, \[slot\]: item \}/);
  assert.match(market, /const target = derive\(\{ \.\.\.G, eq \}\)/);
  assert.match(market, /'SELLER ' \+ \(e\.sellerName \|\| 'A SELLER'\)/);
  assert.match(market, /'AC ' \+ current\.ac/);
  assert.match(market, /'ATK ' \+ current\.weapon\.hit/);
  assert.match(market, /'CRIT ' \+ current\.crit/);
  assert.match(market, /'HASTE ' \+ current\.haste/);
  assert.match(market, /run\(Market\.buy\(e\)/);
  assert.match(market, /'CANCEL'/);
});
