import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const exists = file => fs.existsSync(path.join(root, file));
const installedName = (entry, prefix) => {
  if (entry.panel === 'scenes') return prefix + 'scene_' + entry.name;
  return prefix + entry.name;
};

test('reference asset pack source and pixel variants are complete', () => {
  const manifest = readJson('assets_pack/manifest.json');
  assert.equal(manifest.length, 535, 'unexpected reference asset pack size');
  for (const entry of manifest) {
    assert.ok(exists('assets_pack/' + entry.file), 'missing source cutout: ' + entry.file);
    assert.ok(exists('assets_pack/' + entry.px), 'missing pixel variant: ' + entry.px);
  }
});

test('reference UI kit source and pixel variants are complete', () => {
  const manifest = readJson('assets_pack/ui/manifest.json');
  assert.equal(manifest.length, 151, 'unexpected UI kit size');
  for (const entry of manifest) {
    assert.ok(exists('assets_pack/ui/' + entry.file), 'missing UI source cutout: ' + entry.file);
    assert.ok(exists('assets_pack/ui/' + entry.px), 'missing UI pixel variant: ' + entry.px);
  }
});

test('all reference pixel assets are installed in the runtime asset catalog', () => {
  const main = readJson('assets_pack/manifest.json');
  const ui = readJson('assets_pack/ui/manifest.json');
  const shipped = new Set(readJson('assets/index.json'));
  const missing = [];
  for (const entry of main) {
    const name = installedName(entry, 'ap_');
    if (!shipped.has(name) || !exists('assets/' + name + '.png')) missing.push(name);
  }
  for (const entry of ui) {
    const name = installedName(entry, 'au_');
    if (!shipped.has(name) || !exists('assets/' + name + '.png')) missing.push(name);
  }
  assert.deepEqual(missing, [], 'reference pack assets missing from runtime: ' + missing.join(', '));
});
