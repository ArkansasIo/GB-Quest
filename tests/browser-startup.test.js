import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('browser boot renders a title scene and schedules the game loop without waiting for assets', () => {
  const main = read('client/main.js');
  const browserStart = main.slice(main.indexOf('if (!desktop) {'), main.indexOf('    (async () => {'));
  assert.match(browserStart, /push\(new Title\(\)\)/);
  assert.match(browserStart, /render\(\)/);
  assert.match(browserStart, /requestAnimationFrame\(loop\)/);
  assert.ok(browserStart.indexOf('requestAnimationFrame(loop)') < browserStart.indexOf('NET.init()'),
    'the render loop must start before attempting the realm connection');
});

test('browser boot catches scene, realm, and saved-session startup failures', () => {
  const main = read('client/main.js');
  const browserStart = main.slice(main.indexOf('if (!desktop) {'), main.indexOf('    (async () => {'));
  assert.match(browserStart, /catch \(error\)/);
  assert.match(browserStart, /fallbackTitle\.enter = \(\) => \{\}/);
  assert.match(browserStart, /NET\.init\(\)\)\.catch/);
  assert.match(browserStart, /Saved session.*Could not restore/s);
});

test('title music is optional and cannot prevent the title scene from entering', () => {
  const world = read('src/scenes_world.js');
  const title = world.slice(world.indexOf('class Title {'), world.indexOf('// ================================================================ SAVE SLOTS'));
  assert.match(title, /enter\(\) \{ try \{ Music\.play\('title'\); \} catch/);
  assert.match(title, /resume\(\) \{ try \{ Music\.play\('title'\); \} catch/);
});

test('the branded boot overlay remains visible until the asset loader settles', () => {
  const main = read('client/main.js');
  const shell = read('client/shell.html');
  assert.match(main, /const loading = loadAssets\([\s\S]*?finishBoot\(\)/);
  assert.match(main, /document\.body\.classList\.add\('ready', 'boot-complete'\)/);
  assert.match(shell, /body\.boot-complete \.game-start-fallback \{ opacity:0; visibility:hidden; pointer-events:none; \}/);
});


test('title scene removes the outer browser shell and expands the game viewport', () => {
  const engine = read('src/engine.js');
  const shell = read('client/shell.html');
  assert.match(engine, /classList\.toggle\('title-screen',[\s\S]*constructor\?\.name === 'Title'/);
  assert.match(shell, /body\.title-screen \.build-info,[\s\S]*body\.title-screen \.game-viewport > #chatShow \{ display:none !important; \}/);
  assert.match(shell, /body\.title-screen \.game-viewport \{[\s\S]*aspect-ratio:160 \/ 144/);
  assert.match(shell, /body\.title-screen \.game-viewport > #lcd \{[\s\S]*width:100% !important/);
});
