import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Loads the core track recipes and SFX bank from engine.js, then src/audio_library.js, the way the game does.
const engine = fs.readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const ctx = { console };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext('const N = m => 440 * Math.pow(2, (m - 69) / 12);'
  + engine.slice(engine.indexOf('const arp ='), engine.indexOf('const SFX = new Proxy'))
  + '\nconst SFX_NAMES = Object.keys(SFX_BANK);\n'
  + engine.slice(engine.indexOf('const SCALES'), engine.indexOf('const JINGLES'))
  + '\nconst ARR64 = {};', ctx);
const coreTracks = Object.keys(vm.runInContext('TRACKS', ctx)).length, coreSfx = Object.keys(vm.runInContext('SFX_BANK', ctx)).length;
vm.runInContext(fs.readFileSync(new URL('../src/audio_library.js', import.meta.url), 'utf8'), ctx);
const TRACKS = vm.runInContext('TRACKS', ctx), SCALES = vm.runInContext('SCALES', ctx), ARR64 = vm.runInContext('ARR64', ctx);
const SFX_BANK = vm.runInContext('SFX_BANK', ctx), SFX_NAMES = vm.runInContext('SFX_NAMES', ctx), M = ctx.GBQMusic;
const INSTRUMENTS = new Set(['strings', 'pad', 'brass', 'flute', 'harp', 'piano', 'bell', 'choir', 'organ', 'synth', 'bass', 'slap']);

test('the library adds 80 named tracks to the 24 core ones, without replacing any', () => {
  assert.equal(coreTracks, 24);
  assert.equal(M.count, 80);
  assert.equal(Object.keys(TRACKS).length, 104);
  assert.equal(new Set(Object.values(M.NAMES)).size, 80, 'track names are unique');
});

test('every new track has a valid recipe and a 64-bit arrangement', () => {
  for (const id of Object.keys(M.NAMES)) {
    const t = TRACKS[id], a = ARR64[id];
    assert.ok(t.bpm >= 60 && t.bpm <= 200, `${id} bpm`);
    assert.ok(t.root >= 40 && t.root <= 72, `${id} root`);
    assert.ok(SCALES[t.scale], `${id} scale ${t.scale}`);
    assert.ok(t.prog.length >= 4 && t.prog.every(d => Number.isInteger(d) && d >= 0 && d <= 6), `${id} progression`);
    assert.ok(/^[khs.]{16}$/.test(t.drums), `${id} drum pattern`);
    assert.ok(a && INSTRUMENTS.has(a.lead) && INSTRUMENTS.has(a.pad) && INSTRUMENTS.has(a.bass) && (!a.counter || INSTRUMENTS.has(a.counter)), `${id} arrangement`);
  }
});

test('every region, expansion, dungeon theme and raid has music where it plays', () => {
  const regions = ['ardenhold', 'elderwood', 'hollowmere', 'thornwood', 'greypeak', 'sandspire', 'saltreach', 'emberwaste', 'frostmarch', 'verdantdeep', 'ashenbarrows', 'silverhaven', 'duskmoor'];
  for (const r of regions) {
    assert.equal(M.zoneMusic({ region: r }, 'field'), 'ow_' + r);
  }
  for (let x = 1; x <= 13; x++) assert.equal(M.zoneMusic({ exp: x, region: 'x' }, 'field'), 'ow_x' + x);
  assert.equal(M.zoneMusic({ town: true, region: 'ardenhold' }, 'town'), 'ow_ardenhold', "the capital's towns play its theme");
  assert.equal(M.zoneMusic({ town: true, region: 'elsewhere' }, 'town'), 'town');
  for (const th of ['crypt', 'ice', 'lava', 'temple', 'void']) assert.equal(M.roomMusic('dungeon', { theme: th }, 'dungeon'), 'dg_' + th);
  assert.equal(M.roomMusic('dungeon', { theme: 'dungeon' }, 'dungeon'), 'dungeon');
  for (const r of ['crypt', 'forge', 'palace', 'dusk']) assert.equal(M.roomMusic('raid', { id: 'rd_' + r }, 'raid'), 'raid_' + r);
});

test('battles pick the area, boss, elite, arena, trial and instance tracks', () => {
  vm.runInContext('var G = null, ZONE_BY_ID = {};', ctx);
  const set = (g, z) => { vm.runInContext(`G = ${JSON.stringify(g)}; ZONE_BY_ID = ${JSON.stringify(z)};`, ctx); };
  const zones = { elderwood: { region: 'elderwood' }, x4_0: { exp: 4, region: 'x4' } };
  set({ map: 'elderwood', inst: null }, zones);
  assert.equal(M.battleMusic('battle', { kind: 'field', foes: [{}] }), 'bt_elderwood');
  assert.equal(M.battleMusic('battle', { kind: 'field', foes: [{ elite: true }] }), 'elite');
  assert.equal(M.battleMusic('boss', { kind: 'field', foes: [{ boss: true }] }), 'boss', 'base-region bosses keep the core boss track');
  assert.equal(M.battleMusic('arcboss', { kind: 'field', foes: [{ boss: true }] }), 'arcboss', 'story finales keep their track');
  set({ map: 'x4_0', inst: null }, zones);
  assert.equal(M.battleMusic('battle', { kind: 'field', foes: [{}] }), 'bt_x4');
  assert.equal(M.battleMusic('boss', { kind: 'field', foes: [{ boss: true }] }), 'boss_x4');
  assert.equal(M.battleMusic('boss', { kind: 'arena', foes: [{}] }), 'arena');
  assert.equal(M.battleMusic('boss', { kind: 'trial', foes: [{}] }), 'trial');
  set({ map: 'x4_0', inst: { kind: 'raid' } }, zones);
  assert.equal(M.battleMusic('boss', { kind: 'raid', foes: [{ boss: true }] }), 'raid_boss');
  assert.equal(M.battleMusic('battle', { kind: 'raid', foes: [{}] }), 'battle', 'trash fights inside instances keep the core battle track');
  set({ map: 'x4_0', inst: { kind: 'tower' } }, zones);
  assert.equal(M.battleMusic('boss', { kind: 'tower', foes: [{ boss: true }] }), 'tower_boss');
  set({ map: 'x4_0', inst: { kind: 'dungeon' } }, zones);
  assert.equal(M.battleMusic('boss', { kind: 'dungeon', foes: [{ boss: true }] }), 'dungeon_boss');
});

test('15 new sound effects with valid chip notes, listed in the sound test', () => {
  assert.equal(coreSfx, 103);
  assert.equal(M.sfx.length, 15);
  for (const k of M.sfx) {
    assert.ok(SFX_NAMES.includes(k), `${k} is listed in the sound test`);
    for (const n of SFX_BANK[k]) {
      assert.ok('pqstwn'.includes(n[0]), `${k} wave`);
      assert.ok(n.slice(1, 5).every(v => Number.isFinite(v) && v >= 0), `${k} note values`);
    }
  }
});

test('each new sound effect is played by the game', () => {
  const src = fs.readdirSync(new URL('../src/', import.meta.url)).filter(f => f.endsWith('.js') && f !== 'audio_library.js')
    .map(f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
  for (const k of M.sfx) assert.match(src, new RegExp(`SFX\\.${k}\\b`), `nothing plays SFX.${k}`);
  const build = fs.readFileSync(new URL('../tools/build.cjs', import.meta.url), 'utf8');
  assert.match(build, /'audio64', 'audio_library'/, 'the library loads after both sound engines');
});
