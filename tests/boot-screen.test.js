import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const boot = fs.readFileSync(new URL('../src/boot_screen.js', import.meta.url), 'utf8');

test('boot screen includes the GB Quest crest and complete project branding', () => {
  assert.match(html, /id="gbq-boot-screen"/);
  assert.match(html, /GB QUEST/);
  assert.match(html, /Lost Kingdom of ShadowBane Chronicles/);
  assert.match(html, /Lanterns of Aelmoor/);
  assert.match(html, /ARKANSAS - IO ENGINE · v2\.5\.0/);
  assert.match(html, /Developed by/);
  assert.match(html, /ARKANSASIO/);
  assert.match(html, /gbq-boot-logo-title/);
});

test('boot screen exposes accessible loading progress and retry control', () => {
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuemin="0"/);
  assert.match(html, /aria-valuemax="100"/);
  assert.match(html, /id="gbq-boot-retry"/);
  assert.match(boot, /retry\.addEventListener\('click'/);
});

test('boot screen waits for page load and the engine first frame before fading', () => {
  assert.match(boot, /pageLoaded = document\.readyState === 'complete'/);
  assert.match(boot, /firstFrame = document\.body\.classList\.contains\('game-rendered'\)/);
  assert.match(boot, /if \(finished \|\| !pageLoaded \|\| !firstFrame\) return/);
  assert.match(boot, /root\.classList\.add\('is-hidden'\)/);
  assert.ok(html.indexOf('<script src="src/debug.js"></script>') < html.indexOf('<script src="src/boot_screen.js"></script>'));
});

test('boot screen respects reduced-motion preference', () => {
  assert.match(html, /prefers-reduced-motion:reduce/);
});
