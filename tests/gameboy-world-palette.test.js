import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/scenes_world.js'), 'utf8');

test('overworld terrain, actors and effects are quantized to the four original Game Boy greens', () => {
  assert.match(source, /function applyGameBoyWorldPalette/);
  for (const shade of ['[15, 56, 15]', '[48, 98, 48]', '[139, 172, 15]', '[155, 188, 15]']) {
    assert.ok(source.includes(shade), `missing Game Boy palette shade: ${shade}`);
  }
  assert.match(source, /luminance < 64 \? 0 : luminance < 128 \? 1 : luminance < 192 \? 2 : 3/);
  assert.match(source, /FX\.draw\(cx, cy\);\s*applyGameBoyWorldPalette\(0, 0, W, H\)/);
});

test('world atlas uses the same four-shade palette while keeping atlas chrome outside it', () => {
  assert.match(source, /applyGameBoyWorldPalette\(0, 12, W, 97\)/);
  assert.match(source, /applyGameBoyWorldPalette\(0, 12, W, 97\);[\s\S]*?fill\(0, 0, W, 12, 3\)/);
});
