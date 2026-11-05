'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pack = require('../src/gothic_art_pack.js');

test('Gothic replacement pack maps all requested game art categories', () => {
  for (const category of ['characters','monsters','weapons','armor','skills','biomes','dungeons','items','world','ui','gothicUi','expansion']) {
    assert.ok(pack.categories[category], 'missing category: ' + category);
    assert.match(pack.categories[category].atlas, /^assets_gothic\/.+\.png$/);
  }
});

test('composite atlas panels are not falsely marked as animation-ready', () => {
  for (const entry of Object.values(pack.categories)) assert.equal(entry.frameReady, false);
  assert.equal(pack.status, 'staging');
});

test('all six supplied source sheets are retained in the registry', () => {
  assert.equal(pack.sourceSheets.length, 6);
  assert.ok(pack.sourceSheets.every(p => p.startsWith('assets_gothic/')));
});

test('runtime skill atlas is registered and sliced as a 8x3 grid', () => {
  const fs = require('node:fs');
  const index = require('../assets/index.json');
  const source = fs.readFileSync(require.resolve('../src/ui_mmo.js'), 'utf8');
  assert.ok(index.includes('gothic_skills_atlas'));
  assert.match(source, /IMG\\.gothic_skills_atlas/);
  assert.match(source, /iconIndex % 8/);
  assert.match(source, /Math\\.floor\\(iconIndex \\/ 8\\) \\* 36/);
});
