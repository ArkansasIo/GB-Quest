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
  assert.match(pack.fieldArtFor('gh_npc_merchant_down0'), /^actor_npc_\d{3}$/);
  assert.match(pack.fieldArtFor('gh_warden_down0'), /^actor_character_\d{3}$/);
  assert.match(pack.fieldArtFor('mt_steed_brown'), /^ap_mounts_/);
  assert.equal(pack.fieldArtFor('au_menu_icons_000'), null);
});

test('character, NPC, mount, equipment, and portrait helpers use their matching collections', () => {
  assert.match(pack.characterFor({ cls: 'warden', species: 'hearthkin' }), /^actor_character_\d{3}$/);
  assert.match(pack.npcFor({ name: 'Mira', svc: 'vendor' }), /^actor_npc_\d{3}$/);
  assert.match(pack.mountFor({ id: 'steed_brown', family: 'steed' }), /^ap_mounts_/);
  assert.match(pack.equipmentFor({ kind: 'weapon', base: 'longsword', name: 'Longsword' }), /^ap_weapons_/);
  assert.match(pack.equipmentFor({ kind: 'armor', base: 'chain', name: 'Chain mail', slot: 'chest' }), /^ap_armor_/);
  assert.match(pack.equipmentFor({ kind: 'wondrous', base: 'ring', name: 'Ring' }), /^ap_items_/);
  assert.match(pack.portraitFor('Mira'), /^ap_portraits_/);
});

test('custom class sprites resolve only when available and new enemies join their families', () => {
  const previous = globalThis.IMG;
  globalThis.IMG = Object.fromEntries(Object.values(pack.AP_CLASS_ART).map(name => [name, {}]));
  try {
    assert.equal(pack.characterFor({ cls: 'vanguard' }), 'custom_character_iron_vanguard');
    assert.equal(pack.characterFor({ cls: 'strider' }), 'custom_character_moon_ranger');
    assert.equal(pack.characterFor({ cls: 'arcanist' }), 'custom_character_ember_mage');
    assert.equal(pack.characterFor({ cls: 'chaplain' }), 'custom_character_dawn_priest');
    globalThis.IMG = {};
    assert.equal(pack.characterFor({ cls: 'vanguard' }), null, 'missing custom and pixel sprites should fall through safely');
  } finally {
    if (previous === undefined) delete globalThis.IMG;
    else globalThis.IMG = previous;
  }
  assert.ok(pack.AP_MONSTERS.dragon.includes('custom_enemy_ash_wyrm'));
  assert.ok(pack.AP_MONSTERS.elemental.includes('custom_enemy_mire_wisp'));
  assert.ok(pack.AP_MONSTERS.construct.includes('custom_enemy_crystal_titan'));
  assert.ok(pack.AP_MONSTERS.undead.includes('custom_enemy_bone_stalker'));
});

test('pixel actor sets cover every role and family-specific boss art resolves deterministically', () => {
  const expected = { characters: 43, npcs: 33, enemies: 19, monsters: 24 };
  for (const [category, count] of Object.entries(expected)) {
    const sprites = pack.AP_ACTOR_SPRITES[category];
    assert.equal(sprites.length, count, `${category} sprite coverage`);
    assert.equal(new Set(sprites).size, count, `${category} sprite names should be unique`);
    assert.ok(sprites.every(name => /^actor_(character|npc|enemy|monster)_\d{3}$/.test(name)));
  }
  const families = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'];
  for (const family of families) {
    const selected = pack.apMonsterArt(family, 'stable-subtype');
    assert.ok(pack.AP_MONSTERS[family].includes(selected), `${family} should resolve to its pixel-art family pool`);
  }
  const boss = { id: 'aelmoor-test-boss', fam: 'celestial' };
  const sprite = pack.bossArtFor(boss);
  assert.ok(pack.AP_MONSTERS.celestial.includes(sprite));
  assert.equal(pack.bossArtFor(boss), sprite, 'boss sprite selection should be stable');
});

test('battle scenes select the pack background by encounter context', () => {
  assert.equal(pack.apSceneFor('field', [], false, false), 'ap_scene_wilderness');
  assert.equal(pack.apSceneFor('field', [{ boss: true }], false, false), 'ap_scene_boss_fight');
  assert.equal(pack.apSceneFor('dungeon', [], true, false), 'ap_scene_dungeon');
  assert.equal(pack.apSceneFor('arena', [], false, true), 'ap_scene_city');
  assert.equal(pack.nextBattleBg('painted'), 'scenes');
});
