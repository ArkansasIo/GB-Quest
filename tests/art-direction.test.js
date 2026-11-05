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
