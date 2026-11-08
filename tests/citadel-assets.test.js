import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const families = [
  ['weapons', 'weapons_catalog.json', 6],
  ['armor', 'armor_catalog.json', 6],
  ['shields', 'shields_catalog.json', 4],
];

test('CITADEL equipment catalogs resolve every SVG source', () => {
  for (const [folder, catalogName, expectedCount] of families) {
    const catalogPath = path.join(root, 'assets_citadel', catalogName);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    assert.equal(catalog.category, folder);
    assert.equal(catalog.entries.length, expectedCount);
    const ids = new Set();
    for (const entry of catalog.entries) {
      assert.ok(entry.id && !ids.has(entry.id), `duplicate or empty ${folder} id: ${entry.id}`);
      ids.add(entry.id);
      const sourcePath = path.join(root, entry.src);
      assert.ok(fs.existsSync(sourcePath), `missing SVG: ${entry.src}`);
      const svg = fs.readFileSync(sourcePath, 'utf8');
      assert.match(svg, /^<svg\b/);
      assert.match(svg, /<title\b/);
      assert.match(svg, /viewBox="0 0 520 560"/);
    }
  }
});

test('CITADEL runtime strips the SVG extension from embedded asset IDs', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'engine.js'), 'utf8');
  assert.ok(source.includes("replace(/\\.svg$/i, '')"), 'embedded SVG extension parser is incorrect');
  for (const [kind, catalogName] of [
    ['weapons', 'weapons_catalog.json'],
    ['armor', 'armor_catalog.json'],
    ['shields', 'shields_catalog.json'],
  ]) {
    assert.ok(source.includes(catalogName), `runtime does not load ${kind}`);
    assert.ok(source.includes(`GBQ_CITADEL_${kind.toUpperCase()}`), `runtime does not expose ${kind}`);
  }
});
