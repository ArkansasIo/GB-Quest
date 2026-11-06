import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = path => fs.existsSync(new URL('../' + path, import.meta.url));

test('new HD art collections are indexed and present as PNG assets', () => {
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


test('itch.io package includes generated HD animation frames, equipment, and visual mappings', () => {
  const build = read('tools/build-itch.cjs');
  assert.match(build, /assets_hd64[\\\\/]animations/);
  assert.match(build, /assets_hd64[\\\\/]equipment/);
  assert.match(build, /equipment-catalog-visual-map\.json/);
  assert.match(build, /fs\.cpSync/);
  assert.match(build, /animation_manifest\.json/);
  assert.match(build, /equipment_manifest\.json/);
  assert.match(build, /assets_hd64\\/animations\\/frames/);
});

test('itch.io workflow generates all six F-rank animation sets before packaging', () => {
  const workflow = read('.github/workflows/itch-html5.yml');
  for (const archetype of ['warrior', 'mage', 'ranger', 'rogue', 'cleric', 'summoner']) {
    assert.match(workflow, new RegExp('\\\\b' + archetype + '\\\\b'));
  }
  assert.match(workflow, /report\["total_frames"\] == 2448/);
  assert.match(workflow, /pip install Pillow/);
  assert.match(workflow, /npm run build:itch/);
});
