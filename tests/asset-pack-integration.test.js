import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasRuntimeAsset, runtimeAssetNames } from './runtime-assets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('pixel-pack index resolves every runtime sprite in the shipped asset index', () => {
  const source = read('src/pack_index.js');
  const match = source.match(/const PACK_INDEX = (\{[\s\S]*\});\s*$/);
  assert.ok(match, 'generated PACK_INDEX declaration is missing');
  const pack = JSON.parse(match[1]);
  const shipped = runtimeAssetNames();
  const referenced = [
    ...Object.values(pack.items).flat(),
    ...Object.values(pack.monsters).flat(),
    ...Object.values(pack.alias),
  ];
  const missing = [...new Set(referenced)].filter(name => !shipped.has(name) || !hasRuntimeAsset(name));
  assert.deepEqual(missing, [], 'pack_index references sprites absent from assets/index.json');
});

test('new adventurer and enemy sprite files are shipped and routed by class or family', () => {
  const source = read('src/asset_pack.js');
  const names = [
    'custom_character_iron_vanguard', 'custom_character_moon_ranger', 'custom_character_ember_mage', 'custom_character_dawn_priest',
    'custom_enemy_ash_wyrm', 'custom_enemy_mire_wisp', 'custom_enemy_crystal_titan', 'custom_enemy_bone_stalker',
  ];
  const shipped = runtimeAssetNames();
  const missing = names.filter(name => !shipped.has(name) || !hasRuntimeAsset(name) || !fs.existsSync(path.join(root, 'assets', name + '.png')));
  assert.deepEqual(missing, [], 'custom sprites must exist locally and in the built runtime asset index');
  for (const name of names) assert.ok(source.includes(name), `custom sprite is not routed in asset_pack.js: ${name}`);
  for (const cls of ['vanguard', 'strider', 'arcanist', 'chaplain']) assert.ok(source.includes(cls), `missing class route: ${cls}`);
});

test('asset pack and pixel pack runtime scripts are loaded after the core art pipeline', () => {
  const build = read('tools/build.cjs');
  const orderStart = build.indexOf('const ORDER = [');
  const orderEnd = build.indexOf('];', orderStart);
  assert.ok(orderStart >= 0 && orderEnd > orderStart, 'builder script order is missing');
  const loadOrder = build.slice(orderStart, orderEnd);
  const names = ['art', 'asset_pack', 'pack_index', 'pack_art', 'mount_data'];
  const positions = names.map(name => loadOrder.indexOf(`'${name}'`));
  assert.ok(positions.every(position => position >= 0), 'one or more art scripts are not included in the build');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'art scripts are loaded in dependency order');
  const indexPath = path.join(root, 'index.html');
  if (fs.existsSync(indexPath)) assert.match(read('index.html'), /dist\/gbquest\.html|src\/asset_pack\.js/);
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
