import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine = fs.readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');

test('runtime sprite scaling uses nearest-neighbour filtering for pixel art', () => {
  const match = engine.match(/function scaled\(img, w, h\) \{([\s\S]*?)\n\}/);
  assert.ok(match, 'shared sprite scaler should remain available');
  assert.match(match[1], /imageSmoothingEnabled\s*=\s*false/,
    'resized actor and tileset sprites must not use bilinear interpolation');
  assert.doesNotMatch(match[1], /imageSmoothingEnabled\s*=\s*\(?\s*w\s*!==/,
    'filtering must stay disabled when source and destination sizes differ');
});
