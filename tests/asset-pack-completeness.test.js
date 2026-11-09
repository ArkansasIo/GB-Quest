import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { needs, IMAGES } from './support/needs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = file => fs.existsSync(path.join(root, file));

test('optional reference art packs are not required for the distributable game', () => {
  // Third-party reference sheets are intentionally excluded from source control.
  // If a developer supplies licensed source packs locally, the slicer can build them.
  for (const manifest of ['assets_pack/manifest.json', 'assets_pack/ui/manifest.json']) {
    if (!exists(manifest)) continue;
    const entries = JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8'));
    assert.ok(Array.isArray(entries), manifest + ' must contain an array');
    for (const entry of entries) {
      assert.ok(entry.file && entry.px, manifest + ' entries must identify source and pixel files');
    }
  }
});

test('runtime catalog is derived from files that are actually present', { skip: needs(IMAGES) }, () => {
  const assetsDir = path.join(root, 'assets');
  const actual = fs.readdirSync(assetsDir).filter(name => name.endsWith('.png')).map(name => name.slice(0, -4)).sort();
  assert.ok(actual.length > 0, 'base game PNG catalog must not be empty');
  const build = fs.readFileSync(path.join(root, 'tools/build.cjs'), 'utf8');
  assert.match(build, /readdirSync\(path\.join\(ROOT, 'assets'\)\)/, 'build must enumerate real assets instead of trusting a stale manifest');
});
