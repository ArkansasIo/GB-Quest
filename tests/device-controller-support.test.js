import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [engine, settings, options, shell] = await Promise.all([
  readFile(new URL('../src/engine.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/scenes_menu.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/menus_aelmoor.js', import.meta.url), 'utf8'),
  readFile(new URL('../client/shell.html', import.meta.url), 'utf8')
]);

test('device input engine source parses', () => {
  assert.doesNotThrow(() => new vm.Script(engine));
});

test('mobile touch controls have auto, on and off preferences', () => {
  assert.match(engine, /touchControls: 'auto'/);
  assert.match(engine, /S\.touchControls === 'on'/);
  assert.match(engine, /S\.touchControls === 'auto' && coarsePointer/);
  assert.match(engine, /applyInputPreferences\(\)/);
  assert.match(settings, /'MOBILE CONTROLS'/);
  assert.match(options, /\['MOBILE', 'MOBILE CONTROLS'\]/);
});

test('DualSense uses standard Gamepad API face, menu, d-pad and left-stick inputs', () => {
  assert.match(engine, /navigator\.getGamepads/);
  assert.match(engine, /gamepadconnected/);
  assert.match(engine, /gamepaddisconnected/);
  assert.match(engine, /dualsense\|054c\|sony/i);
  assert.match(engine, /a: standard && down\(0\)/);
  assert.match(engine, /b: standard && down\(1\)/);
  assert.match(engine, /select: standard && down\(8\)/);
  assert.match(engine, /start: standard && down\(9\)/);
  assert.match(engine, /axes\[0\]/);
  assert.match(engine, /axes\[1\]/);
  assert.match(engine, /S\.gamepadEnabled === false/);
});

test('Aelmoor and classic options expose mobile and PS5 controller settings', () => {
  assert.match(settings, /'PS5 CONTROLLER'/);
  assert.match(options, /\['DUALSENSE', 'PS5 CONTROLLER'\]/);
  assert.match(options, /GBQ_GAMEPAD_STATUS/);
});

test('mobile control surfaces remain accessible in the responsive browser shell', () => {
  assert.match(shell, /id="dpad"/);
  assert.match(shell, /data-btn="a"/);
  assert.match(shell, /data-btn="b"/);
  assert.match(shell, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(shell, /env\(safe-area-inset-bottom/);
});
