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

test('retro 8-bit: every dungeon tile key exists for all six dungeon themes', () => {
  const keys = new Set(['wall', 'walltop', 'door']);
  for (const src of [read('src/gen.js'), read('src/rooms.js')]) {
    for (const block of src.matchAll(/GD_KEY(?: = |, )\{([^}]*)\}/g)) for (const [, v] of block[1].matchAll(/:\s*'([^']+)'/g)) for (const f of ['0', '1']) keys.add(v.replace('%f', f));
  }
  assert.ok(keys.size > 20, 'dungeon keys parsed');
  for (const t of ['dungeon', 'crypt', 'ice', 'lava', 'temple', 'void']) for (const k of keys) assert.ok(has(`gd_r8${t}_${k}`), `gd_r8${t}_${k}`);
});

test('retro 8-bit: art mode is wired into the ART setting, monster lookup and the world renderer', () => {
  assert.match(read('src/art.js'), /S\.art === 'retro'/);
  assert.match(read('src/art.js'), /function retroWorldTile/);
  assert.match(read('src/scenes_world.js'), /retroWorldTile\(tile\)/);
  assert.match(read('src/scenes_menu.js'), /'RETRO 8-BIT'/);
});

test('retro 8-bit and AELMOOR HD: every townsfolk role has open and blink frames in both sets', () => {
  const src = read('src/npc_art.js');
  const roles = new Set();
  for (const name of ['NPC_SVC_ROLE', 'NPC_PROF_ROLE']) {
    const body = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`).exec(src)[1];
    for (const [, v] of body.matchAll(/:\s*'([a-z]+)'/g)) roles.add(v);
  }
  for (const [, v] of /const NPC_NAME_ROLE = \[([\s\S]*?)\];/.exec(src)[1].matchAll(/'([a-z]+)'\]/g)) roles.add(v);
  for (const [, v] of /const NPC_FOLK = \[([^\]]*)\]/.exec(src)[1].matchAll(/'([a-z]+)'/g)) roles.add(v);
  assert.ok(roles.size >= 40, 'roles parsed: ' + roles.size);
  for (const r of roles) for (const p of ['r8n', 'r9n']) for (const k of [0, 1]) assert.ok(has(`${p}_${r}_${k}`), `${p}_${r}_${k}`);
});

test('AELMOOR HD: monsters, bosses and the title backdrop exist, and the mode is in the ART cycle', () => {
  const F = families();
  for (const fam of Object.values(F)) for (const [sub] of fam.sub) {
    for (const v of ['base', 'ember', 'frost', 'venom', 'shadow', 'gilded', 'ash']) assert.ok(has(`r9m_${slug(sub)}_${v}`), `r9m_${slug(sub)}_${v}`);
    for (const k of [0, 1, 2]) assert.ok(has(`r9b_${slug(sub)}_${k}`), `r9b_${slug(sub)}_${k}`);
  }
  assert.ok(has('r9_title'));
  assert.match(read('src/scenes_menu.js'), /'AELMOOR HD'/);
  assert.match(read('src/scenes_world.js'), /S\.art === 'aelmoor' && IMG\.r9_title/);
  assert.match(read('src/npc_art.js'), /retroNpcArt\(role, blink\)/);
});

test('retro 8-bit and AELMOOR HD: item icons for every equipment category slot and consumable', () => {
  const art = read('src/art.js');
  const cats = new Set(['sword', 'shield', 'lightarmor', 'mediumarmor', 'heavyarmor', 'helmet', 'ring']);
  for (const name of ['WEAPON_ART', 'WONDROUS_ART']) for (const [, v] of new RegExp(`const ${name} = \\{([^}]*)\\}`).exec(art)[1].matchAll(/:\s*'([a-z]+)'/g)) cats.add(v);
  const keys = [...(/const ITEM_ART = \{([\s\S]*?)\};/.exec(art)[1].matchAll(/(\w+):\s*\[/g))].map(m => m[1]);
  assert.ok(keys.length > 25, 'consumables parsed');
  for (const p of ['r8', 'r9']) {
    for (const c of cats) for (let s = 0; s <= 10; s++) assert.ok(has(`${p}i_${c}_${s}`), `${p}i_${c}_${s}`);
    for (const k of keys) assert.ok(has(`${p}c_${k}`), `${p}c_${k}`);
  }
  assert.match(read('tools/build.cjs'), /'pack_art', 'retro_art'/);
});

test('title screen uses the Lanterns of Aelmoor key art with the live menu over it', () => {
  assert.ok(has('title_aelmoor') && has('title_aelmoor_hi'), 'title art generated by tools/make_title_art.py');
  const world = read('src/scenes_world.js');
  assert.match(world, /if \(IMG\.title_aelmoor\) return this\.drawKeyArt\(\)/);
  assert.match(world, /this\.keep = \[/);
  assert.match(read('src/video64.js'), /IMG\.title_aelmoor_hi/);
  assert.match(read('client/shell.html'), /body\.title-screen #gbq-player-hud/);
});
