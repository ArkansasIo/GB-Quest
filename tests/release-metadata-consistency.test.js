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
  assert.match(world, new RegExp("version:\\s*'" + pkg.version.replaceAll('.', '\\\\.') + "'"));
  const build = world.match(/build:\\s*'([^']+)'/);
  assert.ok(build, 'runtime build identifier exists');
  assert.match(readme, new RegExp('Version ' + pkg.version.replaceAll('.', '\\\\.') + ' \\(build ' + build[1] + '\\)'));
  assert.ok(gdd.includes('**Version** | ' + pkg.version + ' (build ' + build[1] + ')'));
});

test('development and source-shell UI display the current game version', () => {
  const versionLabel = new RegExp('CHRONICLES</strong> v' + pkg.version.replaceAll('.', '\\\\.') + '</span>');
  assert.match(shell, versionLabel);
  assert.match(entry, versionLabel);
});
