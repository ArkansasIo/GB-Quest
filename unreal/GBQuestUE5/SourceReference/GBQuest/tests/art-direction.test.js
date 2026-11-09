import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('release builder embeds the Shadows of the Abyss theme', () => {
  const build = read('tools/build.cjs');
  assert.match(build, /rd\('client\/theme-shadows\.css'\)/);
  assert.match(build, /<body class="theme-shadows">/);
});

test('dark-fantasy theme defines accessible focus and responsive states', () => {
  const css = read('client/theme-shadows.css');
  assert.match(css, /\.theme-shadows \.round:focus-visible/);
  assert.match(css, /\.theme-shadows \.pill:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)/);
});

test('asset migration manifest preserves production asset contracts', () => {
  const manifest = JSON.parse(read('docs/art-direction/ASSET_MIGRATION_MANIFEST.json'));
  assert.equal(manifest.design, 'Shadows of the Abyss');
  assert.equal(manifest.migrationRules.preserveExistingAssetIds, true);
  assert.equal(manifest.migrationRules.preserveAtlasCoordinatesAndFrameOrder, true);
  assert.equal(manifest.sourceSheets.length, 4);
});

test('Pokémon branding and theme assets are excluded from browser and itch.io builds', () => {
  const build = read('tools/build.cjs');
  const itchBuild = read('tools/build-itch.cjs');
  const gameTheme = read('src/ui_mmo.js');
  const shell = read('client/shell.html');
  const menu = read('src/scenes_menu.js');
  assert.doesNotMatch(build, /pokemon/i);
  assert.doesNotMatch(itchBuild, /pokemon/i);
  assert.doesNotMatch(gameTheme, /pokemon/i);
  assert.doesNotMatch(shell, /pokemon/i);
  assert.doesNotMatch(menu, /pokemon/i);
  assert.match(gameTheme, /mmo: 'HANDHELD CLASSIC'/);
  assert.match(gameTheme, /tnl: 'TNL HANDHELD'/);
  assert.match(build, /body class="theme-shadows"/);
  assert.ok(!fs.existsSync(path.join(root, 'client/theme-pokemon.css')));
});

test('Python compatibility build and full-source package instructions stay valid', () => {
  const pythonBuild = read('tools/build.py');
  const sourcePackage = read('tools/package-itch-source.py');
  const buildDocs = read('docs/BUILD.md');
  assert.ok(pythonBuild.includes('"build_atlas.py"'));
  assert.ok(pythonBuild.includes('"build.cjs"'));
  assert.match(buildDocs, /canonical runtime bundler/);
  assert.doesNotMatch(sourcePackage, /npm ci/);
  assert.match(sourcePackage, /npm install/);
  assert.doesNotMatch(sourcePackage, /using the lockfile/);
});
