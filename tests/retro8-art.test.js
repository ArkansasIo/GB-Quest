import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { needs, IMAGES } from './support/needs.js';

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

test('retro 8-bit: every bestiary subtype has all seven variant sprites and three boss sprites', { skip: needs(IMAGES) }, () => {
  const F = families();
  let subs = 0;
  for (const fam of Object.values(F)) for (const [sub] of fam.sub) {
    subs++;
    for (const v of ['base', 'ember', 'frost', 'venom', 'shadow', 'gilded', 'ash']) assert.ok(has(`r8m_${slug(sub)}_${v}`), `r8m_${slug(sub)}_${v}`);
    for (const k of [0, 1, 2]) assert.ok(has(`r8b_${slug(sub)}_${k}`), `r8b_${slug(sub)}_${k}`);
  }
  assert.ok(subs >= 50, 'all subtypes counted');
});

test('retro 8-bit: every overworld tile the zone renderer can ask for exists in all six palettes', { skip: needs(IMAGES) }, () => {
  const gen = read('src/gen.js');
  const keys = new Set(['cobble']);
  const gt = /const GT_KEY = \{([\s\S]*?)\};/.exec(gen)[1];
  for (const [, v] of gt.matchAll(/:\s*'([^']+)'/g)) for (const f of ['0', '1']) keys.add(v.replace('%f', f));
  for (let m = 0; m < 16; m++) { keys.add(`road${m}`); keys.add(`water${m}_0`); keys.add(`water${m}_1`); }
  for (const g of ['green', 'sand', 'snow', 'swamp', 'lava', 'mystic']) for (const k of keys) assert.ok(has(`gt_r8${g}_${k}`), `gt_r8${g}_${k}`);
});

test('retro 8-bit: every dungeon tile key exists for all six dungeon themes', { skip: needs(IMAGES) }, () => {
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

test('retro 8-bit and AELMOOR HD: every townsfolk role has open and blink frames in both sets', { skip: needs(IMAGES) }, () => {
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

test('AELMOOR HD: monsters, bosses and the title backdrop exist, and the mode is in the ART cycle', { skip: needs(IMAGES) }, () => {
  const F = families();
  for (const fam of Object.values(F)) for (const [sub] of fam.sub) {
    for (const v of ['base', 'ember', 'frost', 'venom', 'shadow', 'gilded', 'ash']) assert.ok(has(`r9m_${slug(sub)}_${v}`), `r9m_${slug(sub)}_${v}`);
    for (const k of [0, 1, 2]) assert.ok(has(`r9b_${slug(sub)}_${k}`), `r9b_${slug(sub)}_${k}`);
  }
  assert.ok(has('r9_title'));
  assert.match(read('src/scenes_menu.js'), /'AELMOOR HD'/);
  assert.match(read('src/scenes_world.js'), /S\.art === 'aelmoor' && IMG\.r9_title/);
  assert.match(read("src/npc_art.js"), /retroNpcArt\(role, blink, e\.name\)/);
});

test('retro 8-bit and AELMOOR HD: item icons for every equipment category slot and consumable', { skip: needs(IMAGES) }, () => {
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

test('title screen uses the Lanterns of Aelmoor key art with the live menu over it', { skip: needs(IMAGES) }, () => {
  assert.ok(has('title_aelmoor') && has('title_aelmoor_hi'), 'title art generated by tools/make_title_art.py');
  const world = read('src/scenes_world.js');
  assert.match(world, /if \(IMG\.title_aelmoor\) return this\.drawKeyArt\(\)/);
  assert.match(world, /this\.keep = \[/);
  assert.match(read('src/video64.js'), /IMG\.title_aelmoor_hi/);
  assert.match(read('client/shell.html'), /body\.title-screen #gbq-player-hud/);
});

test('Lanterns of Aelmoor key art: every sprite the AELMOOR index names exists, and lookups use it', { skip: needs(IMAGES) }, () => {
  const c = {}; c.globalThis = c; vm.runInNewContext(read('src/keyart_index.js'), c); const K = c.KEYART;
  const names = [...Object.values(K.monsters), ...Object.values(K.equip).flat(), ...Object.values(K.consumables), ...Object.values(K.npc), ...K.npcPool,
    ...Object.values(K.effects), ...K.portraits, ...K.cutscenes];
  assert.ok(names.length > 100, 'index populated');
  for (const n of names) assert.ok(has(n), n);
  for (const base of new Set(Object.values(K.monsters))) for (const v of ['ember', 'frost', 'venom', 'shadow', 'gilded', 'ash']) assert.ok(has(`${base}_${v}`), `${base}_${v}`);
  for (const key of K.town) for (const g of ['green', 'sand', 'snow', 'swamp', 'lava', 'mystic']) assert.ok(has(`gt_ka${g}_${key}`), `gt_ka${g}_${key}`);
  assert.ok(!has('ka_monsters_00') && !has('ka_mounts_02'), 'look-alikes of other companies\' famous characters stay out');
  const art = read('src/art.js');
  for (const hook of ['KEYART.monsters', 'KEYART.equip', 'KEYART.consumables', 'KEYART.town', 'KEYART.effects', 'KEYART.npc']) assert.ok(art.includes(hook), hook);
});

test('settings list pairs every item with its own value (the Aelmoor OPTIONS screen reads the same list)', () => {
  const src = read('src/scenes_menu.js');
  assert.match(src, /v\.splice\(1, 0, '>'\); v\.splice\(this\.items\(\)\.indexOf\('ABOUT'\), 0, '>'\);/);
  const menus = read('src/menus_aelmoor.js');
  for (const s of ['class AelOptions', 'class AelLoad', 'class AelCredits', 'class AelQuit', 'class AelNewGame', 'class AelClassSelect', 'class AelSummary']) assert.ok(menus.includes(s), s);
  assert.match(read('src/scenes_world.js'), /new AM\.AelOptions\(\)/);
});

test('8-bit item sheet: every icon the RETRO index names exists, the key-art world map is wired, no monster/UI rows sliced', { skip: needs(IMAGES) }, () => {
  const c = {}; c.globalThis = c; vm.runInNewContext(read('src/itemsheet_index.js'), c); const K = c.ITEMSHEET;
  const names = [...Object.values(K.equip).flat(), ...Object.values(K.consumables)];
  assert.ok(names.length > 150, 'item sheet indexed');
  for (const n of names) {
    assert.ok(has(n), n);
    const png = fs.readFileSync(new URL(`../assets/${n}.png`, import.meta.url));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [16, 16], `${n} is a true 16x16 8-bit icon`);
  }
  assert.ok(!fs.readdirSync(new URL('../assets/', import.meta.url)).some(f => /^ki_(dragons|undead|oozes|slimes|ui)/.test(f)), 'no creature or UI rows');
  assert.match(read('src/art.js'), /ITEMSHEET\.equip\[cat\]/);
  assert.match(read('src/scenes_world.js'), /ka_worldmap_01/);
});

test('FULL DETAIL redesign: heroes for every class and species, townsfolk, monsters, bosses and field props exist and are wired', { skip: needs(IMAGES) }, () => {
  const rules = read('src/data_rules.js');
  const classes = [...(/const CLASSES = \{([\s\S]*?)\n\};/.exec(rules)[1].matchAll(/^  ([a-z]+): \{/gm))].map(m => m[1]);
  const species = [...(/const SPECIES = \{([\s\S]*?)\n\};/.exec(rules)[1].matchAll(/^  ([a-z]+): \{/gm))].map(m => m[1]);
  assert.ok(classes.length >= 16 && species.length >= 9, 'classes and species parsed');
  for (const c of classes) for (const sp of species) for (const d of ['down', 'up', 'side']) for (const f of [0, 1]) {
    const n = sp === 'hearthkin' ? `fdw_${c}_${d}${f}` : `fdw_${c}_${sp}_${d}${f}`;
    assert.ok(has(n), n);
  }
  const F = families();
  for (const fam of Object.values(F)) for (const [sub] of fam.sub) {
    for (const v of ['base', 'ember', 'frost', 'venom', 'shadow', 'gilded', 'ash']) assert.ok(has(`fdm_${slug(sub)}_${v}`), `fdm_${slug(sub)}_${v}`);
    for (const k of [0, 1, 2]) assert.ok(has(`fdb_${slug(sub)}_${k}`), `fdb_${slug(sub)}_${k}`);
  }
  for (const r of ['guard', 'merchant', 'innkeeper', 'blacksmith', 'realmstone']) for (const k of [0, 1]) assert.ok(has(`fdn_${r}_${k}`));
  for (const k of ['tree', 'pine', 'rock', 'inn', 'shop', 'temple', 'keep', 'wall', 'gate']) assert.ok(has(`gt_fdmeadow_${k}`) && has(`gt_fdcoast_${k}`), k);
  const art = read('src/art.js');
  for (const fn of ['function fdMonsterArt', 'function fdWorldTile', 'function fdWalker', 'function fdNpcArt']) assert.ok(art.includes(fn), fn);
  assert.match(read('src/scenes_world.js'), /fdWalker\(G, G\.dir/);
  assert.match(read('src/npc_art.js'), /fdNpcArt\(role, blink\)/);
});
