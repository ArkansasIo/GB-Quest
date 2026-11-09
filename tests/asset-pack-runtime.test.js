import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/asset_pack.js';
import '../src/ui_mmo.js';

const pack = globalThis.GBQAssetPack;

test('asset pack deterministically resolves every main image category', () => {
  for (const [category, count] of Object.entries(pack.AP_COUNTS)) {
    assert.ok(count > 0, `${category} should have images`);
    const first = pack.apPick(category, 'same identity');
    assert.match(first, new RegExp(`^ap_${category}_\\d{3}$`), `${category} should resolve to its pack`);
    assert.equal(pack.apPick(category, 'same identity'), first, `${category} selection should be stable`);
  }
});

test('asset pack deterministically resolves UI-kit image categories', () => {
  for (const [category, count] of Object.entries(pack.AU_COUNTS)) {
    assert.ok(count > 0, `${category} should have images`);
    const first = pack.apPick(category, 'same identity', 'au_');
    assert.match(first, new RegExp(`^au_${category}_\\d{3}$`), `${category} should resolve to the UI kit`);
    assert.equal(pack.apPick(category, 'same identity', 'au_'), first, `${category} selection should be stable`);
  }
});

test('UI-kit helpers resolve menu, system and context-specific item artwork', () => {
  assert.match(pack.menuIconFor('CHARACTER'), /^au_menu_icons_\d{3}$/);
  assert.match(pack.systemIconFor('graphics'), /^au_system_icons_\d{3}$/);
  assert.match(pack.uiItemFor('inventory_items', 'potion'), /^au_inventory_items_\d{3}$/);
  assert.match(pack.uiItemFor('storage_items', 'longsword'), /^au_storage_items_\d{3}$/);
  assert.match(pack.uiItemFor('shop_items', 'ether'), /^au_shop_items_\d{3}$/);
  assert.equal(pack.uiItemFor('unknown', 'potion'), null);
});

test('Aelmoor is an available UI theme with its own pixel palette', () => {
  const ui = globalThis.GBQUiMmo;
  assert.ok(ui.MMO_THEMES.includes('aelmoor'));
  assert.equal(ui.MMO_THEME_NAME.aelmoor, 'AELMOOR');
  assert.deepEqual(ui.AELMOOR_GB[0], [8, 10, 28]);
});

test('world sprite families route to semantically matching pack art', () => {
  assert.match(pack.fieldArtFor('gt_meadow_ground'), /^ap_terrain_/);
  assert.match(pack.fieldArtFor('gt_meadow_tree'), /^ap_environment_/);
  assert.match(pack.fieldArtFor('gt_meadow_house'), /^ap_buildings_/);
  assert.match(pack.fieldArtFor('gd_dungeon_wall'), /^ap_dungeon_/);
  assert.match(pack.fieldArtFor('go_chest'), /^ap_map_elements_/);
  assert.match(pack.fieldArtFor('gh_npc_merchant_down0'), /^ap_npcs_/);
  assert.match(pack.fieldArtFor('gh_warden_down0'), /^ap_characters_/);
  assert.match(pack.fieldArtFor('mt_steed_brown'), /^ap_mounts_/);
  assert.equal(pack.fieldArtFor('au_menu_icons_000'), null);
});

test('character, NPC, mount, equipment, and portrait helpers use their matching collections', () => {
  assert.match(pack.characterFor({ cls: 'warden', species: 'hearthkin' }), /^ap_characters_/);
  assert.match(pack.npcFor({ name: 'Mira', svc: 'vendor' }), /^ap_npcs_/);
  assert.match(pack.mountFor({ id: 'steed_brown', family: 'steed' }), /^ap_mounts_/);
  assert.match(pack.equipmentFor({ kind: 'weapon', base: 'longsword', name: 'Longsword' }), /^ap_weapons_/);
  assert.match(pack.equipmentFor({ kind: 'armor', base: 'chain', name: 'Chain mail', slot: 'chest' }), /^ap_armor_/);
  assert.match(pack.equipmentFor({ kind: 'wondrous', base: 'ring', name: 'Ring' }), /^ap_items_/);
  assert.match(pack.portraitFor('Mira'), /^ap_portraits_/);
});

test('battle scenes select the pack background by encounter context', () => {
  assert.equal(pack.apSceneFor('field', [], false, false), 'ap_scene_wilderness');
  assert.equal(pack.apSceneFor('field', [{ boss: true }], false, false), 'ap_scene_boss_fight');
  assert.equal(pack.apSceneFor('dungeon', [], true, false), 'ap_scene_dungeon');
  assert.equal(pack.apSceneFor('arena', [], false, true), 'ap_scene_city');
  assert.equal(pack.nextBattleBg('painted'), 'scenes');
});
