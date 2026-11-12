import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync(new URL('../client/shell.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../client/main.js', import.meta.url), 'utf8');

test('boot screen identifies the game, expansion, engine and developer', () => {
  assert.match(shell, /id="bootloader"/);
  assert.match(shell, /LOST KINGDOM OF SHADOWBANE CHRONICLES/);
  assert.match(shell, /LANTERNS OF AELMOOR/);
  assert.match(shell, /ARKANSAS-IO GAME ENGINE/);
  assert.match(shell, /DEVELOPED BY ARKANSASIO/);
});

test('boot screen exposes accessible loading progress and completes after asset loading', () => {
  assert.match(shell, /role="progressbar"/);
  assert.match(shell, /id="bootProgressFill"/);
  assert.match(main, /updateBoot\(p\)/);
  assert.match(main, /finishBoot\(\)/);
  assert.match(main, /boot-complete/);
});
