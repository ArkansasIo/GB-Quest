import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const metadata = JSON.parse(read('game-metadata.json'));
const world = read('src/data_world.js');
const shell = read('client/shell.html');
const entry = read('index.html');
const readme = read('README.md');
const gdd = read('docs/GDD.md');

test('package, game metadata and runtime build identify the same release', () => {
  assert.equal(metadata.version, pkg.version);
  assert.ok(world.includes("version: '" + pkg.version + "'"));
  const build = world.match(/build:\\s*'([^']+)'/);
  assert.ok(build, 'runtime build identifier exists');
  assert.ok(readme.includes('Version ' + pkg.version + ' (build ' + build[1] + ')'));
  assert.ok(gdd.includes('**Version** | ' + pkg.version + ' (build ' + build[1] + ')'));
});

test('development and source-shell UI display the current game version', () => {
  const versionLabel = 'CHRONICLES</strong> v' + pkg.version + '</span>';
  assert.ok(shell.includes(versionLabel), 'source shell displays current version');
  assert.ok(entry.includes(versionLabel), 'development entry point displays current version');
});
