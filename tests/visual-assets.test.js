import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { needs, IMAGES } from './support/needs.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = path => fs.existsSync(new URL('../' + path, import.meta.url));

test('new HD art collections are indexed and present as PNG assets', { skip: needs(IMAGES) }, () => {
  const names = JSON.parse(read('assets/index.json'));
  for (const name of ['gbq_master_catalog', 'gbq_ui_mockup_catalog']) {
    assert.ok(names.includes(name), name + ' must be in the asset catalog');
    assert.ok(exists('assets/' + name + '.png'), name + ' PNG must exist');
  }
});

test('Shadows shell layers the new UI mockup artwork into the bezel', () => {
  const css = read('client/theme-shadows.css');
  assert.match(css, /GBQ_UI_MOCKUP/);
  assert.match(css, /\.theme-shadows \.bezel::after/);
  assert.match(css, /pointer-events:none/);
});

test('standalone browser build embeds both catalog images as data URIs', () => {
  const build = read('tools/build.cjs');
  assert.match(build, /GBQ_MASTER_CATALOG/);
  assert.match(build, /GBQ_UI_MOCKUP/);
  assert.match(build, /gbq_master_catalog\.png/);
  assert.match(build, /gbq_ui_mockup_catalog\.png/);
  assert.match(build, /data:image\/png;base64,/);
});

test('itch.io release gate verifies artwork is embedded in the playable HTML', () => {
  const build = read('tools/build-itch.cjs');
  assert.match(build, /gbq_master_catalog/);
  assert.match(build, /gbq_ui_mockup_catalog/);
  assert.match(build, /GBQ_HD64_ATLASES/);
  assert.match(build, /Unresolved artwork placeholder/);
  assert.match(build, /embeddedPngs/);
});


test('itch.io package embeds generated HD animation frames, equipment, and visual mappings in one HTML file', () => {
  const build = read('tools/build-itch.cjs');
  const runtime = read('src/hd_character_art.js');
  assert.ok(build.includes('assets_hd64/animations/frames'));
  assert.ok(build.includes('assets_hd64/equipment'));
  assert.ok(build.includes('equipment-catalog-visual-map.json'));
  assert.ok(build.includes('animation_manifest.json'));
  assert.ok(build.includes('equipment_manifest.json'));
  assert.ok(build.includes('GBQ_HD64_PACK'));
  assert.ok(build.includes('data:image/png;base64,'));
  assert.ok(build.includes('MAX_FILES = 1000'));
  assert.ok(runtime.includes('GBQ_HD64_PACK'));
  assert.ok(runtime.includes('packedUrl || url'));
});

test('itch.io workflow generates all six F-rank animation sets before packaging', { skip: needs('.github/workflows/itch-html5.yml') }, () => {
  const workflow = read('.github/workflows/itch-html5.yml');
  for (const archetype of ['warrior', 'mage', 'ranger', 'rogue', 'cleric', 'summoner']) {
    assert.match(workflow, new RegExp('\\b' + archetype + '\\b'));
  }
  assert.match(workflow, /report\["total_frames"\] == 2448/);
  assert.match(workflow, /pip install Pillow/);
  assert.match(workflow, /python tools\/build_atlas\.py/);
  assert.match(workflow, /npm run build:itch/);
});

test('asset repair workflow persists generated HD64 character frames and equipment into source assets', { skip: needs('.github/workflows/repair-game-assets.yml') }, () => {
  const workflow = read('.github/workflows/repair-game-assets.yml');
  assert.match(workflow, /build_animation_manifest\.py/);
  assert.match(workflow, /generate_character_sprite_pack\.py/);
  assert.match(workflow, /generate_equipment_layers\.py/);
  assert.match(workflow, /validate_equipment_visual_map\.py/);
  assert.match(workflow, /total_frames.*2448/);
  assert.match(workflow, /git add assets assets_pack assets_hd assets_hd64/);
});

test('world renderer consumes asynchronous HD character frames with classic fallback', () => {
  const world = read('src/scenes_world.js');
  assert.match(world, /function hdWorldFrame\(/);
  assert.match(world, /presenter\.request\(character/);
  assert.match(world, /const portrait = hdFrame \|\| packFrame \|\| gearWalker \|\| worldPortrait/);
  assert.match(world, /HD character frame unavailable; using classic sprite/);
});
