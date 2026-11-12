import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('boot screen includes the game crest, title, engine and developer credits', () => {
  const shell = read('client/shell.html');
  assert.match(shell, /id="gbq-boot-screen"/);
  assert.match(shell, /GB QUEST/);
  assert.match(shell, /Lost Kingdom of ShadowBane Chronicles/);
  assert.match(shell, /Lanterns of Aelmoor/);
  assert.match(shell, /ARKANSAS - IO ENGINE · v2\.5\.0/);
  assert.match(shell, /Developed by/);
  assert.match(shell, /ARKANSASIO/);
});

test('boot screen has accessible progress and a retry control', () => {
  const shell = read('client/shell.html');
  const script = read('src/boot_screen.js');
  assert.match(shell, /role="progressbar"/);
  assert.match(shell, /aria-valuemin="0"/);
  assert.match(shell, /aria-valuemax="100"/);
  assert.match(shell, /id="gbq-boot-retry"/);
  assert.match(script, /retry\.addEventListener\('click'/);
});

test('boot screen waits for page load and the engine first frame before fading', () => {
  const script = read('src/boot_screen.js');
  assert.match(script, /pageLoaded = document\.readyState === 'complete'/);
  assert.match(script, /firstFrame = document\.body\.classList\.contains\('game-rendered'\)/);
  assert.match(script, /if \(finished \|\| !pageLoaded \|\| !firstFrame\) return/);
  assert.match(script, /root\.classList\.add\('is-hidden'\)/);
});
