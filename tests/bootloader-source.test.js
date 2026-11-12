import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync(new URL('../client/shell.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../client/main.js', import.meta.url), 'utf8');

test('boot screen identifies the game, expansion, engine and developer', () => {
  assert.match(shell, /id="gbq-boot-screen"/);
  assert.match(shell, /Lost Kingdom of ShadowBane Chronicles/);
  assert.match(shell, /Lanterns of Aelmoor/);
  assert.match(shell, /ARKANSAS - IO ENGINE · v2\.5\.0/);
  assert.match(shell, /Developed by/);\n  assert.match(shell, /ARKANSASIO/);
});

test('boot screen exposes accessible loading progress and completes after asset loading', () => {
  assert.match(shell, /role="progressbar"/);\n  assert.match(shell, /id="gbq-boot-retry"/);
  assert.match(shell, /id="bootProgressFill"/);
  assert.match(main, /updateBoot\(p\)/);
  assert.match(main, /finishBoot\(\)/);
  assert.match(main, /boot-complete/);
});
