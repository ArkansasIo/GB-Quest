import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { needs, IMAGES } from './support/needs.js';

// Expansions 14-20 (src/data_world.js, expansion wave 4): seven worlds with maps, regions, dungeons, a raid, a campaign and music.
const ctx = { console, window: {} };
ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data_rules.js', 'jobs_data.js', 'data_world.js', 'gen.js']) vm.runInContext(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
const get = n => JSON.parse(vm.runInContext(`JSON.stringify(${n})`, ctx));
const EXP = get('EXPANSIONS'), NEW = EXP.filter(x => x.v === 4), ZONES = get('ZONES'), DUNGEONS = get('DUNGEONS'), RAIDS = get('RAIDS');
const BOSSES = get('BOSSES'), CAMPAIGNS = get('EXPANSION_CAMPAIGNS'), STORIES = get('EXPANSION_STORIES'), PINS = get('REGION_PINS'), BUILD = get('BUILD');
const asset = n => fs.existsSync(new URL(`../assets/${n}.png`, import.meta.url));

test('20 expansions: the original 13 unchanged, then 14-20 as worlds of their own', () => {
  assert.equal(EXP.length, 20);
  assert.deepEqual(EXP.map(x => x.n), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(EXP.slice(0, 13).map(x => x.name), ['ETERNAL ODYSSEY', 'DRAGONFIRE REALM', 'EMBERFELL SAGA', "WIZARD'S DOMINION", 'PLAGUEBORN LEGACY', 'CRYSTALIZED REALMS', 'FROSTSONG DYNASTY', 'ARCANE ASCENSION', 'BLOODMOON CONSPIRACY', 'DRAGONSPIRE ODYSSEY', 'WHISPERS OF VALHALLA', 'NIGHTSHADE CHRONICLES', 'MYTHICAL MEADOWLANDS']);
  assert.equal(NEW.length, 7);
  assert.equal(BUILD.expansions.length, 20);
  assert.equal(new Set(EXP.map(x => x.name)).size, 20);
  for (const x of NEW) {
    assert.ok(x.world && x.lvl[0] >= 1 && x.lvl[1] <= 720 && x.lvl[0] < x.lvl[1], x.id);
    assert.equal(BUILD.expansions[x.n - 1].toUpperCase(), x.name);
  }
});

test('each new expansion has 8 zones in 3 regions, apart from the original grid', () => {
  for (const x of NEW) {
    const zs = ZONES.filter(z => z.exp === x.n);
    assert.equal(zs.length, 8, x.id);
    assert.ok(zs.every(z => z.v === 4 && z.lvl[0] >= x.lvl[0] && z.lvl[1] <= x.lvl[1]), x.id);
    for (let i = 0; i < 3; i++) assert.ok(PINS[`${x.id}_${i}`], `${x.id}_${i} has a map pin`);
  }
  const old = ZONES.filter(z => !z.v), fresh = ZONES.filter(z => z.v === 4);
  assert.equal(old.length, 154, 'the original 154 zones are all still there');
  for (const z of fresh) assert.ok(!old.some(o => Math.abs(o.fx - z.fx) + Math.abs(o.fy - z.fy) === 1), `${z.id} borders an original zone`);
  const m = vm.runInContext(`buildZone(ZONE_BY_ID['x14_0'])`, ctx);
  assert.ok(m.buildings.length >= 7, 'the first region of each new expansion is a town');
});

test('4 dungeons and a raid per new expansion, with bosses from their own seed', () => {
  for (const x of NEW) {
    const ds = DUNGEONS.filter(d => d.exp === x.n);
    assert.equal(ds.length, 4, x.id);
    assert.ok(RAIDS.some(r => r.id === 'rd_' + x.id && r.zone === `${x.id}_2`), x.id);
    for (const d of ds) assert.equal(BOSSES.filter(b => b.where === d.id).length, 3, d.id);
    assert.equal(BOSSES.filter(b => b.where === 'rd_' + x.id).length, 5);
    for (const z of ZONES.filter(z => z.exp === x.n)) assert.equal(BOSSES.filter(b => b.cat === 'world' && b.where === z.id).length, 2, z.id);
  }
  const gen = fs.readFileSync(new URL('../src/gen.js', import.meta.url), 'utf8');
  assert.ok(gen.indexOf("RNG('bosses-v4')") > gen.indexOf("RNG('bosses-v3')"));
  assert.match(gen, /const wild = ZONES\.filter\(z => !z\.town && !z\.v\)/, 'new zones stay out of the original world-boss fill');
});

test('campaigns, stories and music for every expansion', () => {
  assert.equal(CAMPAIGNS.length, 20);
  assert.equal(STORIES.length, 20);
  for (const x of EXP) {
    const c = CAMPAIGNS[x.n - 1];
    assert.equal(c.exp, x.n);
    assert.ok(DUNGEONS.some(d => d.id === c.steps[2].target) && RAIDS.some(r => r.id === c.steps[3].target), `${x.id} campaign targets exist`);
    assert.ok(STORIES[x.n - 1].threat && STORIES[x.n - 1].hook, x.id);
  }
  const lib = fs.readFileSync(new URL('../src/audio_library.js', import.meta.url), 'utf8');
  for (const x of NEW) for (const k of ['ow_', 'bt_', 'boss_']) assert.match(lib, new RegExp(`\\['${k}${x.id}',`), `${k}${x.id}`);
});

test('every expansion has its emblem, and every world its painted map', { skip: needs(IMAGES) }, () => {
  for (const x of EXP) {
    assert.ok(asset(`exp_icon_${x.n}`), `exp_icon_${x.n}`);
    if (x.world) assert.ok(asset(`gm_x${x.n}`) && asset(`gm_x${x.n}_s`), `map for ${x.id}`);
  }
});
