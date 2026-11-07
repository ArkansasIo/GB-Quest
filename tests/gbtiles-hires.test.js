import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'tools/gen_gbtiles.py'), 'utf8');

test('high-resolution pixel exports preserve the logical 16px grid', () => {
  assert.match(source, /HI_SCALES\s*=\s*\(4,\s*6\)/);
  assert.match(source, /Image\.Resampling\.NEAREST/);
  assert.match(source, /assets_hd\/gbtiles/);
  assert.match(source, /"logical_size":\s*\[N,\s*N\]/);
  assert.match(source, /"scaling":\s*"nearest-neighbor"/);
  assert.match(source, /"alpha":\s*"preserved"/);
});

test('all generated terrain, dungeon, prop and character art uses shared high-res export path', () => {
  assert.match(source, /for k, img in tiles\.items\(\): save\(/);
  assert.match(source, /save\(f"gd_\{t\}_\{k\}", img\)/);
  assert.match(source, /for k, img in \{.*obj_herb/s);
  assert.match(source, /for fr in HERO: save\(/);
  assert.match(source, /HI_MANIFEST\[name\]/);
});
