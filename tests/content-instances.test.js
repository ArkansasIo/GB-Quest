import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The instance catalogue: 76 dungeons, 28 raids, 16 trials and 18 towers (src/data_world.js, content wave 3).
const ctx = { console, window: {} };
ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data_rules.js', 'jobs_data.js', 'data_world.js']) vm.runInContext(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
const get = n => vm.runInContext(n, ctx);
const DUNGEONS = get('DUNGEONS'), RAIDS = get('RAIDS'), TRIALS = get('TRIALS'), TOWERS = get('TOWERS'), REGIONS = get('REGIONS'), BUFFS = get('BUFFS'), CONDITIONS = get('CONDITIONS');
const THEMES = new Set(['dungeon', 'temple', 'ice', 'crypt', 'lava', 'void']);

test('76 dungeons, 28 raids, 16 trials and 18 towers, each with a unique id', () => {
  assert.equal(DUNGEONS.length, 76);
  assert.equal(RAIDS.length, 28);
  assert.equal(TRIALS.length, 16);
  assert.equal(TOWERS.length, 18);
  for (const list of [DUNGEONS, RAIDS, TRIALS, TOWERS]) assert.equal(new Set(list.map(x => x.id)).size, list.length);
  for (const list of [DUNGEONS, RAIDS, TRIALS, TOWERS]) assert.equal(new Set(list.map(x => x.name)).size, list.length, 'names are unique');
});

test('the original content comes first and is unchanged in order (saves and boss ids depend on it)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(DUNGEONS.slice(0, 12).map(d => d.name))), ['GOBLIN KEEP', 'DROWNED LANTERN', 'BRIAR HOLLOW', 'STONEKIN DEEP', 'BONE CRYPT', 'WRECKERS COVE', 'MOLTEN FORGE', 'RIME PALACE', 'IDOL TEMPLE', 'KINGS BARROW', 'CRYSTAL VAULT', 'DUSK CITADEL']);
  assert.equal(DUNGEONS.filter(d => !d.v).length, 38);
  assert.equal(RAIDS.filter(d => !d.v).length, 17);
  assert.equal(TRIALS.filter(d => !d.v).length, 6);
  assert.ok(DUNGEONS.slice(0, 38).every(d => !d.v) && RAIDS.slice(0, 17).every(d => !d.v) && TRIALS.slice(0, 6).every(t => !t.v), 'new content is appended');
  assert.equal(TOWERS[0], get('TOWER'), 'the SPIRE OF A HUNDRED is still tower #1');
  assert.equal(TOWERS[0].floors, 100);
});

test('every dungeon and raid sits in a real region, with a known theme and a level within 1-720', () => {
  const regions = new Set(REGIONS.map(r => r.id));
  for (const d of DUNGEONS) { assert.ok(regions.has(d.zone), d.id); assert.ok(THEMES.has(d.theme), d.id); assert.ok(d.lvl >= 1 && d.lvl + 2 <= 720, d.id); }
  for (const r of RAIDS) { assert.ok(regions.has(r.zone), r.id); assert.ok(THEMES.has(r.theme), r.id); assert.ok(r.bosses >= 3 && r.lvl + 2 * (r.bosses - 1) <= 720, r.id); }
});

test('every trial has a rule; the new ones use real combat effects', () => {
  for (const t of TRIALS) { assert.ok(t.rule && t.desc && t.lvl >= 1, t.id); }
  for (const t of TRIALS.filter(t => t.v)) {
    const fx = [...(t.partyFx || []), ...(t.foeFx || [])].map(x => (Array.isArray(x) ? x[0] : x));
    for (const id of fx) assert.ok(BUFFS[id] || CONDITIONS[id], `${t.id}: ${id} is not a known effect`);
    assert.ok(fx.length || t.foeHp > 1 || t.pair || t.stages || t.noRest || t.size, `${t.id} changes nothing`);
  }
  assert.equal(new Set(TRIALS.map(t => t.rule)).size, 16, 'each trial has its own rule');
});

test('towers climb within the level cap and resolve by id', () => {
  const towerSpec = get('towerSpec');
  for (const t of TOWERS) {
    assert.ok(t.floors >= 30 && t.floors <= 100, t.id);
    assert.ok(t.baseLvl + t.floors * t.perFloor <= 720, `${t.id} tops out above 720`);
    assert.ok(t.themes.length && t.themes.every(th => THEMES.has(th)), t.id);
    assert.equal(towerSpec({ towerId: t.id }), t);
  }
  assert.equal(towerSpec({ id: 'tower' }), get('TOWER'));
  assert.equal(towerSpec(null), get('TOWER'));
});

test('gen.js builds bosses for new content after the original 350, from its own seed', () => {
  const gen = fs.readFileSync(new URL('../src/gen.js', import.meta.url), 'utf8');
  const worldFill = gen.indexOf('BOSSES.length < 350'), wave3 = gen.indexOf("RNG('bosses-v3')");
  assert.ok(worldFill > 0 && wave3 > worldFill, 'content wave 3 bosses come after the world-boss fill');
  assert.match(gen, /DUNGEONS\.filter\(d => !d\.v\)/);
  assert.match(gen, /for \(const tw of TOWERS\) if \(tw\.v\)/);
});
