import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ranks = JSON.parse(fs.readFileSync(new URL('../data/progression/ranks.json', import.meta.url), 'utf8'));
const tiles = JSON.parse(fs.readFileSync(new URL('../world/catalog/tile-system.json', import.meta.url), 'utf8'));

test('adventurer rank ladder contains F through SSS in ascending order', () => {
  assert.deepEqual(ranks.order, ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
  assert.equal(ranks.ranks.length, 9);
  assert.equal(new Set(ranks.ranks.map(rank => rank.id)).size, 9);
  assert.deepEqual(ranks.ranks.map(rank => rank.scoreMin), [...ranks.ranks.map(rank => rank.scoreMin)].sort((a, b) => a - b));
  for (const rank of ranks.ranks) {
    assert.match(rank.color, /^#[0-9A-F]{6}$/i);
    assert.match(rank.asset, /^rk_(f|e|d|c|b|a|s|ss|sss)\.png$/);
  }
});

test('rank ladder remains separate from item rarity and character level', () => {
  assert.match(ranks.separation.itemRarity, /nine rarity tiers/i);
  assert.match(ranks.separation.characterLevel, /1-720/);
});

test('tile system defines layered 16px tiles and all 16 cardinal autotile masks', () => {
  assert.deepEqual(tiles.nativeTileSize, [16, 16]);
  assert.equal(tiles.autotile.variants, 16);
  assert.deepEqual(tiles.autotile.bits, { north: 1, east: 2, south: 4, west: 8 });
  assert.ok(tiles.layers.length >= 8);
  assert.ok(tiles.requiredCategories.includes('terrain'));
  assert.ok(tiles.requiredCategories.includes('combat effects'));
  assert.ok(tiles.requiredCategories.includes('ui map markers'));
  assert.ok(tiles.biomes.length >= 8);
  assert.ok(tiles.dungeonThemes.length >= 6);
});
