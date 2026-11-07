import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const art = fs.readFileSync(new URL('../src/art.js', import.meta.url), 'utf8');

test('armor artwork lookup tolerates missing or unknown armor records', () => {
  assert.match(art, /typeof ARMORS !== 'undefined' && ARMORS \? ARMORS\[item\.base\] : null/);
  assert.match(art, /function armorArtCategory\(item\)/);
  assert.match(art, /return tierPick\(armorArtCategory\(it\), it\.rarity, it\.base\)/);
  assert.doesNotMatch(art, /ARMORS\[it\.base\]\.type/);
});

test('item art tier selection has safe defaults for missing rarity and empty collections', () => {
  assert.match(art, /if \(!L\.length\) return null/);
  assert.match(art, /Number\.isFinite\(Number\(rarity\)\)/);
  assert.match(art, /return L\[i\] \|\| L\[0\] \|\| null/);
  assert.match(art, /if \(!it \|\| !artOn\(\)\) return null/);
});
