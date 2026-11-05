import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [source, styles, page] = await Promise.all([
  readFile(new URL('../src/player_hud.js', import.meta.url), 'utf8'),
  readFile(new URL('../client/player-hud.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('player HUD source parses as browser JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(source));
});

test('player HUD is included in the browser game', () => {
  assert.match(page, /client\/player-hud\.css/);
  assert.match(page, /src\/player_hud\.js/);
});

test('player HUD exposes the requested live gameplay panels', () => {
  for (const key of ['data-hud-hp', 'data-hud-mp', 'data-hud-xp', 'data-hud-party-list', 'data-hud-quests', 'data-hud-hotbar', 'data-hud-gold']) {
    assert.ok(source.includes(key), `missing HUD binding: ${key}`);
  }
  assert.match(source, /window\.GBQPlayerHUD/);
});

test('player HUD stylesheet supports desktop and mobile layouts', () => {
  assert.match(styles, /@media\(max-width:900px\)/);
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /pointer-events:none/);
});

test('player HUD uses authoritative combat and field map bridges', () => {
  assert.match(source, /GBQCombatHotbar/);
  assert.match(source, /GBQWorldMapMini/);
  assert.match(source, /drawMiniMap\(mapData\)/);
});
