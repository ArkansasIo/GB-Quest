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
