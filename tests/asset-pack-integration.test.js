import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('pixel-pack index resolves every runtime sprite in the shipped asset index', () => {
  const source = read('src/pack_index.js');
  const match = source.match(/const PACK_INDEX = (\{[\s\S]*\});\s*$/);
  assert.ok(match, 'generated PACK_INDEX declaration is missing');
  const pack = JSON.parse(match[1]);
  const shipped = new Set(JSON.parse(read('assets/index.json')));
  const referenced = [
    ...Object.values(pack.items).flat(),
    ...Object.values(pack.monsters).flat(),
    ...Object.values(pack.alias),
  ];
  const missing = [...new Set(referenced)].filter(name => !shipped.has(name));
  assert.deepEqual(missing, [], 'pack_index references sprites absent from assets/index.json');
});

test('asset pack and pixel pack runtime scripts are loaded after the core art pipeline', () => {
  const html = read('index.html');
  const scripts = [
    'src/art.js',
    'src/asset_pack.js',
    'src/pack_index.js',
    'src/pack_art.js',
    'src/mount_data.js',
  ];
  const positions = scripts.map(script => html.indexOf('<script src="' + script + '"></script>'));
  assert.ok(positions.every(position => position >= 0), 'one or more art scripts are not included in index.html');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'art scripts are loaded in dependency order');
});

test('pixel pack mode preserves classic fallback and exposes all generated world aliases', () => {
  const runtime = read('src/pack_art.js');
  assert.match(runtime, /classic:\s*'nes',\s*nes:\s*'packs',\s*packs:\s*'classic'/);
  assert.match(runtime, /IMG\[pk\]/, 'pack aliases must only replace sprites when their image loaded');
  assert.match(runtime, /ORIG\[old\]/, 'original sprites must be restored when pack mode is disabled');
  const source = read('src/pack_index.js');
  for (const prefix of ['gh_npc_', 'gt_meadow_', 'gt_coast_', 'gt_marsh_', 'gt_jungle_', 'gt_snow_', 'gt_badlands_', 'gt_volcanic_', 'gt_dusk_', 'gd_dungeon_']) {
    assert.ok(source.includes(prefix), 'missing generated alias family: ' + prefix);
  }
});

test('asset pack integration provides fallback-aware item, monster, scene and UI art hooks', () => {
  const source = read('src/asset_pack.js');
  for (const token of ['AP_ITEM_ART', 'AP_GEM_ART', 'AP_MONSTERS', 'AP_PORTRAITS', 'apSceneFor', 'drawBattleBackdrop', 'drawItemCell']) {
    assert.ok(source.includes(token), 'missing asset pack integration hook: ' + token);
  }
  assert.match(source, /if \(!im\) return d0\.apply/);
});

test('optional reference art is guarded by runtime asset availability', () => {
  const source = read('src/asset_pack.js');
  assert.match(source, /typeof IMG === 'undefined' \|\| IMG\[name\]/);
  assert.match(source, /if \(!im\) return d0\.apply/);
  assert.match(source, /packed && IMG\[packed\]/);
});
