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
  assert.ok(/client\/player-hud\.css/.test(page) || page.includes('.gbq-hud-map-art'), 'HUD stylesheet is linked or inlined');
  assert.ok(/src\/player_hud\.js/.test(page) || page.includes('window.GBQPlayerHUD'), 'HUD script is linked or inlined');
});

test('player HUD exposes the requested live gameplay panels', () => {
  for (const key of ['data-hud-hp', 'data-hud-mp', 'data-hud-xp', 'data-hud-party-list', 'data-hud-quests', 'data-hud-gold']) {
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

test('player HUD has no bottom bar: the shortcut row and action hotbar were removed', () => {
  assert.doesNotMatch(source, /gbq-hud-bottom|data-hud-hotbar|gbq-hud-shortcuts/);
});

test('player HUD minimap supports zoom, player centering, and marker inspection', () => {
  assert.match(source, /data-map-zoom="in"/);
  assert.match(source, /data-map-zoom="out"/);
  assert.match(source, /data-map-zoom="center"/);
  assert.match(source, /function onMapClick\(event\)/);
  assert.match(source, /latestMapData\?\.entities/);
  assert.match(source, /mapZoom=mode==='center'\?1/);
  assert.match(styles, /\.gbq-hud-map-tools button/);
});


test('player HUD hardens navigation, quest filtering, and progression values', () => {
  assert.match(source, /questSource\.filter\(q => q && \(q\.active !== false\) && !q\.done && !q\.completed\)/);
  assert.match(source, /Number\(window\.xpForLevel\(level\)\) \|\| 0/);
  assert.match(source, /That menu is unavailable right now/);
  assert.match(source, /typeof combat\.entries === 'function'/);
});

test('player HUD controls expose visible keyboard focus and touch sizing', () => {
  assert.match(styles, /\.gbq-hud-map-art:focus-visible/);
  assert.match(styles, /min-width:25px/);
  assert.match(styles, /\.gbq-hud-hotbar button:focus-visible/);
});

test('player HUD shows live derived combat and equipped gear metrics', () => {
  for (const key of ['data-hud-ac', 'data-hud-attack', 'data-hud-hit', 'data-hud-ilvl', 'data-hud-gear-count']) {
    assert.ok(source.includes(key), `missing combat profile binding: ${key}`);
  }
  assert.match(source, /const equipped = g\.eq && typeof g\.eq === 'object'/);
  assert.match(source, /derived\.weapon/);
  assert.match(source, /averageItemLevel/);
  assert.match(styles, /\.gbq-hud-stat-grid/);
});

test('player HUD renders all nine live attributes and their derived modifiers', () => {
  for (const attribute of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'LCK', 'WIL', 'SPD']) {
    assert.match(source, new RegExp('data-hud-attr="' + attribute + '"'));
  }
  assert.match(source, /derived\.A && typeof derived\.A === 'object'/);
  assert.match(source, /derived\.M && typeof derived\.M === 'object'/);
  assert.match(source, /data-hud-attr/);
  assert.match(styles, /\.gbq-hud-attribute-grid/);
});

test('player HUD displays weapon damage dice plus its signed additive modifier', () => {
  assert.match(source, /const weaponDice = String\(derived\.weapon\?\.dice \|\| '1d1'\)/);
  assert.match(source, /weaponModifier > 0 \? weaponDice \+ ' \+ ' \+ weaponModifier/);
  assert.match(source, /weaponModifier < 0 \? weaponDice \+ ' − ' \+ Math\.abs\(weaponModifier\)/);
  assert.match(source, /setText\('\[data-hud-attack\]', weaponDamage\)/);
  assert.match(source, /WEAPON DMG/);
});


test('standalone release includes runtime HD64 artwork in the player HUD', async () => {
  const [build, shell] = await Promise.all([
    readFile(new URL('../tools/build.cjs', import.meta.url), 'utf8'),
    readFile(new URL('../client/shell.html', import.meta.url), 'utf8')
  ]);
  assert.match(build, /'main'[\s\S]*?'player_hud'[\s\S]*?'debug'/);
  assert.match(shell, /client\/player-hud\.css/);
  assert.match(source, /function hudSpriteData\(name\)/);
  assert.match(source, /np_class_/);
  assert.match(source, /au_menu_icons_/);
  assert.match(source, /au_skill_icons_/);
});


test('player HUD text remains readable and long labels do not clip', () => {
  assert.match(styles, /font-size:clamp\(10px/);
  assert.match(styles, /overflow-wrap:anywhere/);
  assert.match(styles, /max-height:calc\(100% - 154px\)/);
  assert.match(styles, /max-width:100%/);
  assert.match(source, /Character portrait/);
  assert.match(source, /GOLD/);
  assert.match(source, /GEMS/);
});

test('player HUD avoids narrow-screen shortcut collisions and honors reduced motion', () => {
  assert.match(styles, /@media \(max-width:1100px\)/);
  assert.match(styles, /\.gbq-hud-shortcuts \{ display:none; \}/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /image-rendering:pixelated/);
});

test('menu shortcut keys are implemented (field only) and avoid the keys the game already uses', () => {
  for (const k of ['b:', 'i:', 'u:', 'p:', 'l:', 't:', 'g:', 'o:', 'h:', 'n:']) assert.ok(source.includes(k + ' () => new'), k);
  assert.match(source, /topScene\(\) instanceof Field/);
  assert.doesNotMatch(source, /\b[cmfwasdzjxk]: \(\) => new/);
});
