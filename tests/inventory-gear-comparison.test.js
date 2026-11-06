import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/scenes_menu.js', import.meta.url), 'utf8');

test('bag gear menu exposes comparison without replacing existing actions', () => {
  assert.match(source, /\['EQUIP', 'COMPARE', 'SELL ' \+ e\.value \+ 'G', 'LIST ON AUCTION', 'DROP', 'BACK'\]/);
  assert.match(source, /if \(k === 1\) \{ showGearComparison\(e\); \}/);
  assert.match(source, /if \(k === 2\) \{ G\.bag\.splice/);
  assert.match(source, /if \(k === 3\) \{ Market\.post/);
  assert.match(source, /if \(k === 4\) \{ G\.bag\.splice/);
});

test('gear comparison derives target stats from a copied equipment map', () => {
  assert.match(source, /function showGearComparison\(it\)/);
  assert.match(source, /const slot = itemSlot\(it\), current = derive\(G\), eq = \{ \.\.\.G\.eq, \[slot\]: it \}/);
  assert.match(source, /const target = derive\(\{ \.\.\.G, eq \}\)/);
  assert.match(source, /'AC ' \+ current\.ac \+ ' → ' \+ target\.ac/);
  assert.match(source, /'ATK ' \+ current\.weapon\.hit/);
  assert.match(source, /'DMG ' \+ current\.weapon\.dice/);
  assert.match(source, /'CRIT ' \+ current\.crit/);
  assert.match(source, /'DODGE ' \+ current\.dodge/);
  assert.match(source, /'BLOCK ' \+ current\.block/);
  assert.match(source, /'LEECH ' \+ current\.leech/);
  assert.match(source, /'HASTE ' \+ current\.haste/);
  assert.match(source, /'RESIST ' \+ current\.resistAll/);
  assert.match(source, /say\(rows, \(\) => \{\}\)/);
});

test('gear comparison includes affix, gem, rune and tier sources', () => {
  assert.match(source, /mods\.push\('AFFIX ' \+ k\.toUpperCase\(\)/);
  assert.match(source, /gemAffixes\(it\)/);
  assert.match(source, /runeAffixes\(it\)/);
  assert.match(source, /tierImplicit\(it\)/);
});
