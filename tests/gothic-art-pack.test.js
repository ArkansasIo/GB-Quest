import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packSource = readFileSync(new URL('../src/gothic_art_pack.js', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../src/ui_mmo.js', import.meta.url), 'utf8');
const assetIndex = JSON.parse(readFileSync(new URL('../assets/index.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../assets_gothic/asset-manifest.json', import.meta.url), 'utf8'));

test('Gothic art registry covers the requested categories', () => {
  for (const category of ['characters','monsters','weapons','armor','skills','biomes','dungeons','items','world','ui','gothicUi','expansion']) {
    assert.match(packSource, new RegExp(category + ': \\{'));
  }
});

test('composite atlas panels remain marked as non-animation-ready', () => {
  assert.match(packSource, /frameReady: false/);
  assert.match(packSource, /partial-runtime-integration/);
});

test('all six source sheets remain catalogued', () => {
  assert.equal(manifest.sourceSheets.length, 6);
});

test('extracted Gothic skill atlas is loaded by the runtime asset index', () => {
  assert.ok(assetIndex.includes('gothic_skills_atlas'));
  assert.match(packSource, /assets\\/gothic_skills_atlas\\.png/);
  assert.equal(manifest.runtimeSprites[0].count, 24);
});

test('Gothic hotbar draws stable skill-specific atlas cells', () => {
  assert.match(uiSource, /IMG\\.gothic_skills_atlas/);
  assert.match(uiSource, /const iconIndex = \\(hash >>> 0\\) % 24/);
  assert.match(uiSource, /Math\\.floor\\(iconIndex \\/ 8\\) \\* 36/);
});
