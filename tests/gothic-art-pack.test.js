import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packSource = readFileSync(new URL('../src/gothic_art_pack.js', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../src/ui_mmo.js', import.meta.url), 'utf8');
const assetIndex = JSON.parse(readFileSync(new URL('../assets/index.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../assets_gothic/asset-manifest.json', import.meta.url), 'utf8'));
const skillAtlasPng = readFileSync(new URL('../assets/gothic_skills_atlas.png', import.meta.url));

test('Gothic art registry covers the requested categories', () => {
  for (const category of ['characters','monsters','weapons','armor','skills','biomes','dungeons','items','world','ui','gothicUi','expansion']) {
    assert.ok(packSource.includes(category + ': {'), 'missing category: ' + category);
  }
});

test('composite atlas panels remain marked as non-animation-ready', () => {
  assert.ok(packSource.includes('frameReady: false'));
  assert.ok(packSource.includes('partial-runtime-integration'));
});

test('all six source sheets remain catalogued', () => {
  assert.equal(manifest.sourceSheets.length, 6);
});

test('extracted Gothic skill atlas is loaded by the runtime asset index', () => {
  assert.ok(assetIndex.includes('gothic_skills_atlas'));
  assert.ok(packSource.includes('assets/gothic_skills_atlas.png'));
  assert.equal(manifest.runtimeSprites[0].count, 24);
});

test('Gothic hotbar draws stable skill-specific atlas cells', () => {
  assert.ok(uiSource.includes('IMG.gothic_skills_atlas'));
  assert.ok(uiSource.includes('const iconIndex = (hash >>> 0) % 24'));
  assert.ok(uiSource.includes('Math.floor(iconIndex / 8) * 36'));
});

test('committed skill atlas is a valid 256x108 PNG', () => {
  assert.equal(skillAtlasPng.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(skillAtlasPng.readUInt32BE(16), 256);
  assert.equal(skillAtlasPng.readUInt32BE(20), 108);
});
