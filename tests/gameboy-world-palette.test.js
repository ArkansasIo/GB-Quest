import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/scenes_world.js'), 'utf8');

test('overworld terrain and actors use the classic monochrome Game Boy palette', () => {
  assert.match(source, /four-tone green LCD look/);
  assert.match(source, /ctx\.filter\s*=\s*'grayscale\(1\) sepia\(1\) saturate\(1\.7\) hue-rotate\(43deg\) contrast\(1\.08\)'/);
  assert.match(source, /FX\.draw\(cx, cy\);\s*ctx\.restore\(\); \/\/ keep the classic palette confined to world art and actors/);
});

test('world atlas map art uses the Game Boy palette without recoloring its UI labels', () => {
  assert.match(source, /same original Game Boy LCD palette/);
  assert.match(source, /ctx\.restore\(\); \/\/ preserve the normal UI palette for atlas labels and controls/);
});
