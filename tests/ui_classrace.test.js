import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/ui_classrace.js');

const ui = globalThis.GBQClassRaceUI;

test('class identity palette covers all 27 playable classes', () => {
  assert.ok(ui);
  assert.equal(Object.keys(ui.classes).length, 27);
  for (const [id, rgb] of Object.entries(ui.classes)) {
    assert.match(id, /^[a-z]+$/);
    assert.equal(rgb.length, 3);
    assert.ok(rgb.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255));
  }
});

test('race heritage palette covers all 15 playable races', () => {
  assert.equal(Object.keys(ui.races).length, 15);
  for (const [id, rgb] of Object.entries(ui.races)) {
    assert.match(id, /^[a-z]+$/);
    assert.equal(rgb.length, 3);
    assert.ok(rgb.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255));
  }
});

test('all class and race accents are visually distinct within their own sets', () => {
  const key = rgb => rgb.join(',');
  assert.equal(new Set(Object.values(ui.classes).map(key)).size, 27);
  assert.equal(new Set(Object.values(ui.races).map(key)).size, 15);
});
