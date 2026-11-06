import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/scenes_world.js'), 'utf8');

test('overworld rendering preserves its original full-color pixel art', () => {
  assert.doesNotMatch(source, /applyGameBoyWorldPalette|ORIGINAL GAME BOY WORLD PALETTE/);
  assert.match(source, /#527b70/);
  assert.match(source, /#355c50/);
  assert.match(source, /#5c9fc4/);
});

test('world atlas retains its original map colors without LCD quantization', () => {
  assert.doesNotMatch(source, /applyGameBoyWorldPalette/);
  assert.match(source, /class WorldMap/);
  assert.match(source, /fill\(ox \+ x \* s, oy \+ y \* s, s, s, c\)/);
});
