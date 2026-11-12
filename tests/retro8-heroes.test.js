import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { needs, IMAGES } from './support/needs.js';

// RETRO 8-BIT heroes and buildings (tools/gen_retro8_heroes.py): a 16x16 walker for every job and 32x32 town buildings.
const ctx = { console, window: {} };
ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data_rules.js', 'jobs_data.js']) vm.runInContext(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
const JOBS = Object.keys(JSON.parse(vm.runInContext('JSON.stringify(CLASSES)', ctx)));
const size = n => { const b = fs.readFileSync(new URL(`../assets/${n}.png`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const BUILDINGS = ['inn', 'store', 'smithy', 'stable', 'post', 'bank', 'shrine', 'mill', 'house0', 'house1', 'house2', 'house3'];

test('the generator designs every job in the game', () => {
  const gen = fs.readFileSync(new URL('../tools/gen_retro8_heroes.py', import.meta.url), 'utf8');
  for (const job of JOBS) assert.match(gen, new RegExp(`'${job}':\\s*\\(`), `${job} has no retro design`);
});

test('every job walks down, up and sideways in two steps (16x16)', { skip: needs(IMAGES) }, () => {
  for (const job of JOBS) for (const d of ['down', 'up', 'side']) for (const f of [0, 1]) assert.deepEqual(size(`r8h_${job}_${d}${f}`), [16, 16], `r8h_${job}_${d}${f}`);
});

test('every town building has a 32x32 retro sprite', { skip: needs(IMAGES) }, () => {
  for (const k of BUILDINGS) assert.deepEqual(size(`r8bld_${k}`), [32, 32], k);
});

test('RETRO 8-BIT mode draws heroes, followers, other players and buildings with them', () => {
  const art = fs.readFileSync(new URL('../src/art.js', import.meta.url), 'utf8');
  assert.match(art, /function retroWalker\(/);
  const world = fs.readFileSync(new URL('../src/scenes_world.js', import.meta.url), 'utf8');
  assert.equal((world.match(/retroWalker\(/g) || []).length, 3, 'player, follower and other players');
  const bld = fs.readFileSync(new URL('../src/buildings.js', import.meta.url), 'utf8');
  for (const k of BUILDINGS.filter(k => !k.startsWith('house'))) assert.ok(bld.includes(`'${k}'`), k);
  assert.match(bld, /r8bld_/);
});
