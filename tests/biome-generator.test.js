import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = fs.readFileSync(path.join(root, 'tools/gen_gbtiles.py'), 'utf8');

test('Game Boy tile generator defines the expanded biome families', () => {
  const block = generator.match(/BIOME\s*=\s*\{([\s\S]*?)\n\}/);
  assert.ok(block, 'BIOME palette map must exist');
  const keys = [...block[1].matchAll(/^\s*'([a-z]+)'\s*:/gm)].map(match => match[1]);
  const required = [
    'meadow', 'coast', 'marsh', 'jungle', 'snow', 'badlands', 'volcanic', 'dusk', 'crystal',
    'forest', 'deepforest', 'hills', 'mountains', 'desert', 'oasis', 'savanna', 'steppe',
    'ruins', 'corruption', 'aether', 'mushroom', 'ocean', 'river', 'frozen', 'sky'
  ];
  for (const biome of required) assert.ok(keys.includes(biome), 'missing biome palette: ' + biome);
  assert.equal(keys.length, 25, 'expected exactly 25 stable biome IDs');
});

test('biome generator emits the full shared terrain and transition contract', () => {
  assert.match(generator, /for b in BIOME:/);
  assert.match(generator, /for m in range\(16\):/);
  assert.match(generator, /water\(b, m, f\)/);
  for (const key of ['grass', 'meadow', 'cobble', 'ground', 'sand', 'tree', 'pine', 'rock', 'peak', 'bridge0', 'house', 'inn', 'shop', 'temple']) {
    assert.ok(generator.includes("'" + key + "'"), 'missing generated terrain family: ' + key);
  }
});
