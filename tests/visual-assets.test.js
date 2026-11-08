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

test('itch.io workflow generates all six F-rank animation sets before packaging', () => {
  const workflow = read('.github/workflows/itch-html5.yml');
  for (const archetype of ['warrior', 'mage', 'ranger', 'rogue', 'cleric', 'summoner']) {
    assert.match(workflow, new RegExp('\\b' + archetype + '\\b'));
  }
  assert.match(workflow, /report\["total_frames"\] == 2448/);
  assert.match(workflow, /pip install Pillow/);
  assert.match(workflow, /npm run build:itch/);
});

test('asset repair workflow persists generated HD64 character frames and equipment into source assets', () => {
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

test('6,000-image HD64 atlases include every generated asset and runtime can resolve by stable ID', () => {
  const builder = read('tools/build_pack6000_atlases.py');
  const runtime = read('src/hd64_catalog.js');
  const build = read('tools/build.cjs');
  const itch = read('tools/build-itch.cjs');
  const boot = read('client/main.js');
  const pack = read('src/asset_pack.js');
  assert.match(builder, /EXPECTED = 6000/);
  assert.ok(builder.includes('atlas_index.json'));
  assert.match(builder, /PAGE_SIZE = 100/);
  assert.match(runtime, /GBQ_6000_ASSET_INDEX/);
  assert.match(runtime, /GBQ_6000_ATLASES/);
  assert.match(runtime, /GBQ6000Assets/);
  assert.ok(runtime.includes('function draw('));
  assert.match(build, /GBQ_6000_ASSET_INDEX/);
  assert.match(build, /GBQ_6000_ATLASES/);
  assert.match(build, /hd64_catalog/);
  assert.match(itch, /GBQ_6000_ASSET_INDEX/);
  assert.ok(boot.includes('GBQ6000Assets.load'));
  assert.match(pack, /asset6000For/);
  assert.match(pack, /get6000/);
});

test('full 6,000-image build creates atlases before validation', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['assets:build:6000'], 'npm run assets:generate:6000 && python tools/build_pack6000_atlases.py && npm run assets:validate:6000');
  assert.ok(pkg.scripts['check:syntax'].includes('src/hd64_catalog.js'));
  assert.ok(pkg.scripts['check:syntax'].includes('tools/build_pack6000_atlases.py'));
});

test('GitHub Actions generates and uploads the complete 6,000-image source catalog', () => {
  const workflow = read('.github/workflows/asset-catalog-6000.yml');
  assert.match(workflow, /npm run assets:build:6000/);
  assert.match(workflow, /npm run assets:zip:6000/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /GB-Quest-6000-HD64-Asset-Pack/);
  assert.match(workflow, /retention-days: 30/);
});

test('6,000-image runtime asset helpers use the global catalog without window-only assumptions', () => {
  const pack = read('src/asset_pack.js');
  assert.match(pack, /asset6000For:/);
  assert.match(pack, /get6000:/);
  assert.match(pack, /warm6000:/);
  assert.ok(pack.includes('globalThis.GBQ6000Assets'));
});

test('existing itch.io pull-request workflow generates and uploads the 6,000-image pack', () => {
  const workflow = read('.github/workflows/itch-html5.yml');
  assert.match(workflow, /npm run check:syntax/);
  assert.match(workflow, /npm run assets:build:6000/);
  assert.match(workflow, /npm run assets:zip:6000/);
  assert.match(workflow, /npm run build:itch/);
  assert.match(workflow, /GB-Quest-6000-HD64-Asset-Pack/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
});

test('game shell has one metadata set and readable responsive text and viewport sizing', () => {
  const shell = read('client/shell.html');
  const build = read('tools/build.cjs');
  const pokemon = read('client/theme-pokemon.css');
  assert.equal((shell.match(/<meta charset=/g) || []).length, 1);
  assert.equal((shell.match(/name="viewport"/g) || []).length, 1);
  assert.doesNotMatch(build, /<head><meta charset=/);
  assert.match(shell, /--gbq-sidebar-width/);
  assert.match(shell, /max-height:min\(42dvh,340px\)/);
  assert.match(shell, /overflow-wrap:anywhere/);
  assert.match(pokemon, /FINAL GAME TEXT \+ HUD SCALE/);
  assert.match(pokemon, /font:700 10px\/1\.25 Arial,sans-serif !important/);
});


test('HUD shortcuts open detailed tabbed submenu pages with safe live game data', () => {
  const hud = read('src/player_hud.js');
  const styles = read('client/player-hud.css');
  for (const key of ['character','inventory','skills','talents','crafting','journal','guild','market','collection']) {
    assert.match(hud, new RegExp(key + ':\\{title:'));
  }
  assert.match(hud, /data-gbq-detail/);
  assert.match(hud, /data-detail-tab/);
  assert.match(hud, /function detailRows\(/);
  assert.match(hud, /function openDetailPage\(/);
  assert.match(hud, /function closeDetailPage\(/);
  assert.match(hud, /esc\(row\.label\)/);
  assert.match(styles, /\.gbq-detail-window/);
  assert.match(styles, /\.gbq-detail-grid/);
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /\.gbq-detail-page\[hidden\]/);
});


test('expanded HUD submenu pages cover armoury, heirlooms, mounts, bestiary, reputation and settings', () => {
  const hud = read('src/player_hud.js');
  for (const key of ['armoury','heirlooms','mounts','bestiary','reputation','settings']) {
    assert.match(hud, new RegExp(key + ':\\{title:'));
    assert.match(hud, new RegExp("action==='" + key + "'"));
  }
  assert.match(hud, /button\('Armoury','armoury'/);
  assert.match(hud, /button\('Heirlooms','heirlooms'/);
  assert.match(hud, /button\('Mounts','mounts'/);
  assert.match(hud, /button\('Bestiary','bestiary'/);
  assert.match(hud, /button\('Reputation','reputation'/);
  assert.match(hud, /button\('Settings','settings'/);
});


test('world player and monster sprites use crisp proportions, outlines and grounded shadows', () => {
  const world = read('src/scenes_world.js');
  assert.match(world, /function worldMonsterFrame\(/);
  assert.match(world, /function drawWorldShadow\(/);
  assert.match(world, /WORLD_MONSTER_FRAMES = new WeakMap/);
  assert.match(world, /Keep the original 16x16 walker crisp and centred/);
  assert.match(world, /worldMonsterFrame\(sprH\(monsterArt\(B\), 28\), 28\)/);
  assert.match(world, /worldMonsterFrame\(sprH\(s, p\.boss \? 27 : 22\)/);
  assert.match(world, /drawWorldShadow\(px - cx/);
  assert.match(world, /drawWorldShadow\(ex \+ T \/ 2/);
});
