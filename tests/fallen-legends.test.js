import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const load = () => {
  const c = { Math, Object, Array, String, Number, globalThis: null }; c.globalThis = c;
  vm.runInNewContext(src('d4_affixes.js'), c); vm.runInNewContext(src('fallen_legends.js'), c);
  return { A: c.GBQAffixes, L: c.GBQFallenLegends };
};
const gearSource = ['data_rules.js', 'items.js', 'armory.js', 'gear_catalog.js'].map(src).join('\n');
const world = src('data_world.js');
const baseExists = (kind, base) => kind === 'wondrous'
  ? new RegExp(`id: '${base}'|\\b${base}: '`).test(gearSource)
  : new RegExp(`\\b${base}: (WPN|ARM|\\{)`).test(gearSource);
const raidExists = id => world.includes(`'${id}'`) || (/^rd_x\d+$/.test(id) && world.includes(`id: '${id.slice(3)}'`));

test('fallen legends: unique ids that do not collide with the original named items', () => {
  const { L } = load();
  const ids = L.FALLEN_LEGENDS.map(n => n.id);
  assert.ok(ids.length >= 40, `named items (${ids.length})`);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids');
  const original = new Set([...src('items.js').matchAll(/id: '(n_[a-z0-9_]+)'/g)].map(m => m[1]));
  for (const id of ids) assert.ok(!original.has(id), `${id} is new`);
  for (const kind of ['weapon', 'armor', 'wondrous']) assert.ok(L.FALLEN_LEGENDS.some(n => n.kind === kind), `has ${kind}`);
});

test('fallen legends: every base, affix and drop source is real', () => {
  const { A, L } = load();
  for (const n of L.FALLEN_LEGENDS) {
    assert.ok(baseExists(n.kind, n.base), `${n.id}: base ${n.base} exists`);
    assert.ok(n.rarity >= 4 && n.rarity <= 8, `${n.id}: rarity`);
    assert.ok(n.lore && n.lore.length <= 64, `${n.id}: short lore`);
    assert.ok(n.name.length <= 30, `${n.id}: name fits`);
    for (const [k, v] of n.affixes) { assert.ok(A.AFFIXES[k], `${n.id}: affix ${k}`); assert.ok(v > 0, `${n.id}: ${k} value`); }
    const s = n.src;
    if (s.raid) assert.ok(raidExists(s.raid), `${n.id}: raid ${s.raid}`);
    if (s.act) assert.ok(s.act >= 1 && s.act <= 12, `${n.id}: act`);
    if (s.tower) assert.equal(s.tower % 5, 0, `${n.id}: tower boss floor`);
    if (s.cat) assert.ok(['world', 'dungeon', 'trial'].includes(s.cat), `${n.id}: pool`);
  }
});

test('fallen legends: three-piece sets match their pieces', () => {
  const { A, L } = load();
  for (const [id, set] of Object.entries(L.FALLEN_LEGEND_SETS)) {
    assert.equal(set.pieces.length, 3, `${id}: three pieces`);
    for (const p of set.pieces) assert.equal(L.FALLEN_LEGENDS.find(n => n.id === p)?.setId, id, `${p} belongs to ${id}`);
    for (const [k] of [...set.two, ...set.three]) assert.ok(A.AFFIXES[k], `${id}: bonus ${k}`);
  }
});

test('fallen legends: loaded after items, armory and affixes in the page and the build', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const at = f => html.indexOf(`src="src/${f}.js"`);
  assert.ok(at('fallen_legends') > at('d4_affixes') && at('d4_affixes') > at('armory') && at('armory') > at('items'));
  const order = fs.readFileSync(new URL('../tools/build.cjs', import.meta.url), 'utf8').match(/const ORDER = \[([^\]]+)\]/)[1];
  assert.ok(order.indexOf("'fallen_legends'") > order.indexOf("'d4_affixes'"));
});
