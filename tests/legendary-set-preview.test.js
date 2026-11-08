import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const armory = fs.readFileSync(new URL('../src/armory.js', import.meta.url), 'utf8');
const menu = fs.readFileSync(new URL('../src/scenes_menu.js', import.meta.url), 'utf8');
const vendor = fs.readFileSync(new URL('../src/scenes_world.js', import.meta.url), 'utf8');
const market = fs.readFileSync(new URL('../src/market.js', import.meta.url), 'utf8');

test('legendary set preview compares current and projected equipment counts', () => {
  const start = armory.indexOf('function legendarySetPreview(c, candidate = null)');
  const end = armory.indexOf('\nconst canWearClass', start);
  assert.ok(start >= 0 && end > start, 'set preview helper exists');
  const helper = armory.slice(start, end);
  for (const marker of ['legendarySetCounts(c)', 'projectedEq', 'itemSlot(candidate)', 'currentPieces', 'projectedPieces', 'newlyUnlocked', '[2, 3]', 'definition.two', 'definition.three']) {
    assert.ok(helper.includes(marker), 'set preview includes ' + marker);
  }
});

test('gear inspection reports active, locked and newly unlocked set thresholds', () => {
  assert.match(menu, /function legendarySetPreviewLines\(item\)/);
  assert.match(menu, /legendarySetPreview\(G, item\)/);
  assert.match(menu, /NEWLY UNLOCKED/);
  assert.match(menu, /rows\.push\(\.\.\.legendarySetPreviewLines\(it\)\)/);
});

test('vendor and auction previews include set threshold bonuses before confirmation', () => {
  assert.match(vendor, /\.\.\.legendarySetPreview\(G, item\)\.flatMap/);
  assert.match(market, /\.\.\.legendarySetPreview\(G, item\)\.flatMap/);
  assert.match(vendor, /t\.newlyUnlocked \? 'NEW'/);
  assert.match(market, /t\.newlyUnlocked \? 'NEW'/);
});
