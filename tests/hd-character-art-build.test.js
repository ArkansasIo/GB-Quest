import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('browser build includes HD character art runtime before world-scene consumers', () => {
  const builder = fs.readFileSync(path.join(root, 'tools/build.cjs'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const orderMatch = builder.match(/ORDER = \[([^\]]+)\]/);
  assert.ok(orderMatch, 'build script ORDER list is missing');
  const order = [...orderMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const runtime = order.indexOf('hd_character_art');
  const world = order.indexOf('scenes_world');
  assert.ok(runtime >= 0, 'HD character art runtime must be bundled');
  assert.ok(world >= 0, 'world scene module must be bundled');
  assert.ok(runtime < world, 'HD runtime must load before world scene consumers');

  const devRuntime = html.indexOf('<script src="src/hd_character_art.js"></script>');
  const devWorld = html.indexOf('<script src="src/scenes_world.js"></script>');
  assert.ok(devRuntime >= 0, 'development HTML must load the HD runtime');
  assert.ok(devWorld >= 0, 'development HTML must load world scenes');
  assert.ok(devRuntime < devWorld, 'development HTML must load HD runtime before world scenes');
});

test('both generated browser releases contain the HD character runtime', () => {
  const builder = fs.readFileSync(path.join(root, 'tools/build.py'), 'utf8');
  assert.match(builder, /hd_character_art/);
  assert.match(builder, /dist', 'gbquest\.html/);
  assert.match(builder, /dist', 'gbquest-fullscreen\.html/);
});
