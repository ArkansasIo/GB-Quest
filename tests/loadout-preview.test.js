import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/loadouts.js', import.meta.url), 'utf8');

test('loadout selection previews defensive and offensive stats before confirmation', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  for (const label of ['AC ', 'ATTACK ', 'DAMAGE ', 'HP ']) assert.ok(source.includes(label));
  assert.ok(source.includes("choose(['APPLY LOADOUT', 'CANCEL']"));
  assert.ok(source.includes('return say(preview.lines, () => choose'));
});

test('loadout preview reports unavailable pieces and does not apply until confirmed', () => {
  assert.ok(source.includes("if (missing.length) lines.push(('MISSING: ' + missing.join(', '))"));
  assert.ok(source.includes("'CRIT ' + current.crit + '% → ' + target.crit + '%'"));
  assert.ok(source.includes("'DODGE ' + current.dodge + '% → ' + target.dodge + '%'"));
  assert.ok(source.includes("'BLOCK ' + current.block + '% → ' + target.block + '%'"));
  assert.ok(source.includes("'LEECH ' + current.leech + '% → ' + target.leech + '%'"));
  assert.ok(source.includes("'HASTE ' + current.haste + '% → ' + target.haste + '%'"));
  assert.ok(source.includes("'RESIST ' + current.resistAll + '% → ' + target.resistAll + '%'"));
  assert.ok(source.includes("'ELEMENTS F' + current.elem.fire"));
  assert.ok(source.includes("'SUBSTATS HIT ' + (current.sub.hit || 0)"));
  assert.ok(source.includes("const sourceLines = []"));
  assert.ok(source.includes("mods.push(k.toUpperCase() + ' '"));
  assert.ok(source.includes("gemAffixes(it)"));
  assert.ok(source.includes("runeAffixes(it)"));
  assert.ok(source.includes("tierImplicit(it)"));
  assert.ok(source.includes("'--- EQUIPPED ITEM BONUS SOURCES ---'"));
  assert.ok(source.includes("SLOT_NAME[slot] || slot"));


  assert.ok(source.includes("if (action !== 0) return setsMenu()"));
  assert.ok(source.includes('applySet(set, preview.plan)'));
  assert.ok(source.indexOf("if (action !== 0) return setsMenu()") < source.indexOf('applySet(set, preview.plan)'));
});

test('preview builds a separate equipment map without mutating live equipment', () => {
  assert.ok(source.includes('eq = { ...G.eq }'));
  assert.ok(source.includes('derive({ ...G, eq })'));
  assert.ok(source.includes('const current = derive(G), target = derive({ ...G, eq })'));
});
