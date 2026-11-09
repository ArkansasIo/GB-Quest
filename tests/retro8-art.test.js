import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = n => fs.existsSync(new URL(`../assets/${n}.png`, import.meta.url));
const slug = s => s.toLowerCase().replace(/[^a-z]/g, '');

function families() {
  const src = read('src/data_world.js');
  const start = src.indexOf('const FAMILIES');
  const body = src.slice(start, src.indexOf('};', start) + 2).replace('const FAMILIES =', 'globalThis.FAMILIES =');
  const c = {}; c.globalThis = c; vm.runInNewContext(body, c);
  return c.FAMILIES;
}

test('retro 8-bit: every bestiary subtype has all seven variant sprites and three boss sprites', () => {
  const F = families();
  let subs = 0;
  for (const fam of Object.values(F)) for (const [sub] of fam.sub) {
    subs++;
    for (const v of ['base', 'ember', 'frost', 'venom', 'shadow', 'gilded', 'ash']) assert.ok(has(`r8m_${slug(sub)}_${v}`), `r8m_${slug(sub)}_${v}`);
    for (const k of [0, 1, 2]) assert.ok(has(`r8b_${slug(sub)}_${k}`), `r8b_${slug(sub)}_${k}`);
  }
  assert.ok(subs >= 50, 'all subtypes counted');
});

test('retro 8-bit: every overworld tile the zone renderer can ask for exists in all six palettes', () => {
  const gen = read('src/gen.js');
  const keys = new Set(['cobble']);
  const gt = /const GT_KEY = \{([\s\S]*?)\};/.exec(gen)[1];
  for (const [, v] of gt.matchAll(/:\s*'([^']+)'/g)) for (const f of ['0', '1']) keys.add(v.replace('%f', f));
  for (let m = 0; m < 16; m++) { keys.add(`road${m}`); keys.add(`water${m}_0`); keys.add(`water${m}_1`); }
  for (const g of ['green', 'sand', 'snow', 'swamp', 'lava', 'mystic']) for (const k of keys) assert.ok(has(`gt_r8${g}_${k}`), `gt_r8${g}_${k}`);
});

test('retro 8-bit: art mode is wired into the ART setting, monster lookup and the world renderer', () => {
  assert.match(read('src/art.js'), /S\.art === 'retro'/);
  assert.match(read('src/art.js'), /function retroWorldTile/);
  assert.match(read('src/scenes_world.js'), /retroWorldTile\(tile\)/);
  assert.match(read('src/scenes_menu.js'), /'RETRO 8-BIT'/);
});
