import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Walking slides the hero 16 px between tiles at the mount's speed (src/scenes_world.js Field.update).
// A speed that does not divide 16 (WOLF FORM runs at 5) used to overshoot and bounce around the tile forever.
const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const stepLine = src('scenes_world.js').split('\n').find(l => l.includes('this.ox -=') && l.includes('this.walk += sp'));
const step = new Function('sp', `${stepLine.trim()}`);

const framesToLand = (sp, dx, dy) => {
  const s = { ox: -dx * 16, oy: -dy * 16, walk: 0 };
  for (let n = 1; n <= 64; n++) { step.call(s, sp); if (!s.ox && !s.oy) return n; }
  return Infinity;
};

test('every step lands on the tile at any speed, in any direction', () => {
  assert.ok(stepLine, 'step line found');
  for (let sp = 1; sp <= 16; sp++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    assert.equal(framesToLand(sp, dx, dy), Math.ceil(16 / sp), `speed ${sp} towards ${dx},${dy}`);
});

test('WOLF FORM speed and every mount speed finish a step', () => {
  const speeds = new Set([...src('mount_data.js').matchAll(/"speed":(\d+(?:\.\d+)?)/g)].map(m => +m[1]));
  const wolf = src('tnl_systems.js').match(/morph_wolf = \{[^}]*speed: (\d+)/);
  assert.ok(wolf, 'wolf form defined');
  speeds.add(+wolf[1]); speeds.add(2); speeds.add(4); // walking and the default mount
  for (const sp of speeds) assert.ok(Number.isFinite(framesToLand(sp, 1, 0)), `speed ${sp}`);
});

test('the swim water line follows the hero while they slide between tiles', () => {
  assert.match(src('tnl_systems.js'), /G\.x \* 16 \+ \(this\.ox \|\| 0\) - this\.cam\[0\]/);
});
