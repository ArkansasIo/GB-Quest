import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const index = new Set(JSON.parse(fs.readFileSync('assets/index.json', 'utf8')));
const source = fs.readFileSync('src/asset_pack.js', 'utf8');
const context = {};
vm.runInNewContext(source, context, { filename: 'src/asset_pack.js' });
const pack = context.GBQAssetPack;

test('every runtime asset-pack mapping resolves to an indexed image', () => {
  assert.ok(pack, 'GBQAssetPack registry was not exposed');
  const ids = new Set();
  for (const mapping of [pack.AP_ITEM_ART, pack.AP_GEM_ART, pack.AP_MONSTERS]) {
    for (const value of Object.values(mapping)) {
      for (const id of Array.isArray(value) ? value : [value]) {
        if (id) ids.add(id);
      }
    }
  }
  for (const id of pack.AP_PORTRAITS) ids.add(id);
  for (const id of ['ap_scene_boss_fight', 'ap_scene_city', 'ap_scene_dungeon', 'ap_scene_wilderness']) ids.add(id);

  const missing = [...ids].filter(id => !index.has(id));
  assert.deepEqual(missing, [], `unindexed runtime art IDs: ${missing.join(', ')}`);
  assert.ok(ids.size > 0, 'asset registry unexpectedly contains no IDs');
});
