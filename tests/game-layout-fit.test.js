import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = fs.readFileSync(path.join(root, 'client/shell.html'), 'utf8');

test('desktop game overlays stay within the native 160:144 LCD bounds', () => {
  assert.match(shell, /\.game-viewport\s*\{[\s\S]*?aspect-ratio:\s*160\s*\/\s*144/);
  assert.match(shell, /\.game-viewport\s*>\s*\.gbq-player-hud\s*\{[\s\S]*?inset:\s*0\s*!important/);
  assert.match(shell, /body\.chat-on \.game-viewport\s*>\s*\.gbq-player-hud\s*\{\s*right:\s*0\s*!important/);
});

test('desktop realm chat is moved outside the game viewport into the reserved side panel', () => {
  assert.match(shell, /\.game-viewport\s*>\s*\.chat\s*\{[\s\S]*?position:\s*fixed\s*!important/);
  assert.match(shell, /\.game-viewport\s*>\s*\.chat\s*\{[\s\S]*?right:\s*10px\s*!important/);
  assert.match(shell, /\.game-viewport\s*>\s*#chatShow\s*\{[\s\S]*?position:\s*fixed/);
});

test('full-window mode keeps the same LCD bounds and reserves room for chat', () => {
  assert.match(shell, /body\.full-window-mode \.game-client,[\s\S]*?padding:\s*12px\s+314px\s+12px\s+12px/);
});
