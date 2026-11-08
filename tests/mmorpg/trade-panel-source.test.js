import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [source, styles, hud, build, shell, page] = await Promise.all([
  readFile(new URL('../../client/mmorpg-trade.js', import.meta.url), 'utf8'),
  readFile(new URL('../../client/trade-panel.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/player_hud.js', import.meta.url), 'utf8'),
  readFile(new URL('../../tools/build.cjs', import.meta.url), 'utf8'),
  readFile(new URL('../../client/shell.html', import.meta.url), 'utf8'),
  readFile(new URL('../../index.html', import.meta.url), 'utf8')
]);

test('MMO trading overlay parses as standalone browser JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  assert.doesNotMatch(source, /^\s*import\s/m);
});

test('trading overlay exposes authenticated character and player trade workflows', () => {
  for (const route of ['/api/register', '/api/login', '/api/me', '/api/characters', '/trades', '/accept', '/cancel', '/inventory', '/wallet', '/bank', '/bank/deposit', '/bank/withdraw']) {
    assert.ok(source.includes(route), 'missing MMO route: ' + route);
  }
  for (const feature of ['data-login', 'data-register', 'data-create-character', 'data-connect', 'data-recipient', 'data-send-offer', 'data-accept', 'data-cancel', 'data-bank-action']) {
    assert.ok(source.includes(feature), 'missing trading UI control: ' + feature);
  }
  assert.match(source, /zone\.snapshot/);
  assert.match(source, /presence\.joined/);
  assert.match(source, /presence\.left/);
});

test('trading overlay enforces secure remote API and WebSocket transports', () => {
  assert.match(source, /Remote MMO realms must use HTTPS/);
  assert.match(source, /Secure WSS is required for remote realms/);
  assert.match(source, /localhost\|127/);
  assert.match(source, /Timed out authenticating with the realm/);
});

test('trading panel styles and script are bundled into the one-file itch release', () => {
  assert.match(shell, /client\/trade-panel\.css/);
  assert.match(build, /'player_hud', 'mmorpg-trade', 'debug'/);
  assert.match(build, /name === 'mmorpg-trade' \? 'client\/mmorpg-trade\.js'/);
  assert.match(build, /client\/trade-panel\.css/);
  assert.match(page, /client\/mmorpg-trade\.js/);
  assert.ok(/client\/trade-panel\.css/.test(page) || page.includes('.gbq-trade-overlay'), 'trading stylesheet is linked or inlined');
});

test('HUD exposes the Trading action and delegates to the realm panel', () => {
  assert.match(hud, /button\('Trading','trading'/);
  assert.match(hud, /window\.GBQMMOTrade\.open\(\)/);
  assert.match(styles, /gbq-trade-overlay/);
  assert.match(styles, /@media\(max-width:560px\)/);
});

test('bank tab exposes server-backed deposit and withdrawal forms', () => {
  assert.match(source, /data-tab=\"bank\"/);
  assert.match(source, /data-bank-action=\"deposit\"/);
  assert.match(source, /data-bank-action=\"withdraw\"/);
  assert.match(source, /state\.api\.bank\(state\.selected\.id\)/);
  assert.match(source, /state\.api\.depositBank/);
  assert.match(source, /state\.api\.withdrawBank/);
});
