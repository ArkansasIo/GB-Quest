import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('release builder embeds the Shadows of the Abyss theme', () => {
  const build = read('tools/build.cjs');
  assert.match(build, /rd\('client\/theme-shadows\.css'\)/);
  assert.match(build, /<body class="theme-shadows theme-pokemon">/);
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

test('classic Pokemon-era interface is embedded in browser and itch.io builds', () => {
  const build = read('tools/build.cjs');
  const theme = read('client/theme-pokemon.css');
  const shell = read('client/shell.html');
  assert.match(build, /rd\('client\/theme-pokemon\.css'\)/);
  assert.match(build, /theme-shadows theme-pokemon/);
  assert.match(shell, /client\/theme-pokemon\.css/);
  assert.match(theme, /--pk-paper:#f8f8ef/);
  assert.match(theme, /gbq-hud-panel/);
  assert.match(theme, /image-rendering:pixelated/);
});


test('classic Pokémon interface is the default across gameplay and release builders', () => {
  const build = read('tools/build.cjs');
  const pythonBuild = read('tools/build.py');
  const itchBuild = read('tools/build-itch.cjs');
  const gameTheme = read('src/ui_mmo.js');
  const theme = read('client/theme-pokemon.css');
  const world = read('src/scenes_world.js');
  assert.ok(build.includes("rd('client/theme-pokemon.css')"));
  assert.ok(build.includes('body class="theme-shadows theme-pokemon"'));
  assert.ok(build.includes('<!doctype html>'));
  assert.ok(pythonBuild.includes('"build.cjs"'));
  assert.ok(itchBuild.includes("'POKEMON CLASSIC'"));
  assert.ok(gameTheme.includes("mmo: 'POKEMON CLASSIC'"));
  assert.ok(gameTheme.includes("S.uiTheme = 'mmo'"));
  assert.ok(theme.includes('body.theme-pokemon .device'));
  assert.ok(theme.includes('body.theme-pokemon .round'));
  assert.ok(world.includes('LANTERNS OF AELMOOR'));
  assert.ok(!world.includes('LATNTERNS OF AELMOOR'));
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
