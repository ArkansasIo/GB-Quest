import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('browser build includes HD character art runtime before world-scene consumers', () => {
  const builder = fs.readFileSync(path.join(root, 'tools/build.cjs'), 'utf8');
  const indexPath = path.join(root, 'index.html');
  const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const orderMatch = builder.match(/const ORDER = \[([^\]]+)\]/);
  assert.ok(orderMatch, 'canonical build script ORDER list is missing');
  const order = [...orderMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const runtime = order.indexOf('hd_character_art');
  const world = order.indexOf('scenes_world');
  assert.ok(runtime >= 0, 'HD character art runtime must be bundled');
  assert.ok(world >= 0, 'world scene module must be bundled');
  assert.ok(runtime < world, 'HD runtime must load before world scene consumers');

  const devRuntime = html.indexOf('<script src="src/hd_character_art.js"></script>');
  const devWorld = html.indexOf('<script src="src/scenes_world.js"></script>');
  if (devRuntime >= 0 || devWorld >= 0) {
    assert.ok(devRuntime >= 0, 'development HTML must load the HD runtime');
    assert.ok(devWorld >= 0, 'development HTML must load world scenes');
    assert.ok(devRuntime < devWorld, 'development HTML must load HD runtime before world scenes');
  } else if (html) {
    assert.match(html, /dist\/gbquest\.html/, 'asset-free development entrypoint must open the self-contained bundle');
  }
});

test('both generated browser releases contain the HD character runtime', () => {
  const builder = fs.readFileSync(path.join(root, 'tools/build.cjs'), 'utf8');
  assert.match(builder, /'hd_character_art'/);
  assert.match(builder, /'gbquest\.html'/);
  assert.match(builder, /'gbquest-fullscreen\.html'/);
});
