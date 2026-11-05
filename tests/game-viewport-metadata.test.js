import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('game metadata declares the HTML5 entry point and native viewport dimensions', () => {
  const config = JSON.parse(read('game-metadata.json'));
  assert.equal(config.runtime, 'html5');
  assert.equal(config.entryPoint, 'index.html');
  assert.equal(config.java.jarRequired, false);
  assert.equal(config.java.jarClassName, null);
  assert.equal(config.viewport.width, 160);
  assert.equal(config.viewport.height, 144);
  assert.equal(config.browser.fullscreenEntryPoint, 'dist/gbquest-fullscreen.html');
});

test('fullscreen browser source fills the viewport and preserves the game aspect ratio', () => {
  const source = read('client/fullscreen.html');
  assert.match(source, /html, body \\{ width: 100%; height: 100%;/);
  assert.match(source, /inset: 0 !important; width: 100vw !important; height: 100dvh !important/);
  assert.match(source, /aspect-ratio: 160 \\/ 144/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /fullscreenRequiresUserGesture/ === true ? /requestFullscreen/ : /requestFullscreen/);
});

test('build pipeline emits the full-window browser artifact', () => {
  const build = read('tools/build.cjs');
  assert.match(build, /client\\/fullscreen\\.html/);
  assert.match(build, /gbquest-fullscreen\\.html/);
});
