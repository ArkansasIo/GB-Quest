import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
// loads the world data and zone generator, then the underworld module with a stub Field so the browser wiring runs
const load = (() => {
  let ctx = null;
  return () => {
    if (ctx) return ctx;
    const c = { console }; c.globalThis = c; c.window = c; vm.createContext(c);
    for (const f of ['data_rules', 'jobs_data', 'data_world', 'gen']) vm.runInContext(src(`${f}.js`), c, { filename: f });
    vm.runInContext('var Field = class { interactAt() {} reload() {} };', c);
    vm.runInContext(src('underworld.js'), c, { filename: 'underworld' });
    return (ctx = c);
  };
})();
const run = code => vm.runInContext(code, load());
const reachFrom = (m, ZW, ZH, WALKABLE) => {
  const seen = new Set([m.hub[1] * ZW + m.hub[0]]), q = [m.hub];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * ZW + nx;
      if (nx < 0 || ny < 0 || nx >= ZW || ny >= ZH || seen.has(k) || !WALKABLE.has(m.rows[ny][nx])) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return (x, y) => seen.has(y * ZW + x);
};

test('kingdoms: every region belongs to exactly one realm, capitals are hubs', () => {
  const UW = run('GBQUnderworld'), regions = run('REGIONS');
  assert.ok(UW.kingdoms.length >= 26);
  assert.equal(new Set(UW.kingdoms.map(k => k.id)).size, UW.kingdoms.length, 'unique ids');
  const owner = {};
  for (const k of UW.kingdoms) {
    assert.ok(k.name && k.ruler && k.desc, `${k.id} described`);
    assert.ok(k.regions.includes(k.capital), `${k.id} capital inside its realm`);
    for (const r of k.regions) { assert.ok(!owner[r], `${r} held once`); owner[r] = k.id; }
  }
  for (const r of regions) assert.ok(owner[r.id], `${r.id} has a kingdom`);
});

test('underground: zones sit under the overworld, link only within their region, and are all connected', () => {
  const ZW = run('ZW'), ZH = run('ZH'), WALKABLE = run('WALKABLE'), UW = run('GBQUnderworld');
  assert.ok(UW.under.length >= 100, `cave zones (${UW.under.length})`);
  assert.equal(run('ZONES').length, 210, 'overworld zone list unchanged');
  for (const z of UW.under) {
    const above = run(`ZONE_BY_ID[${JSON.stringify(z.above)}]`);
    assert.ok(above && !above.under, `${z.id} has a zone above`);
    assert.equal(run(`ZONE_BY_ID[${JSON.stringify(z.id)}]`), z, `${z.id} registered`);
    assert.deepEqual([z.fx, z.fy], [above.fx, above.fy], `${z.id} under its zone`);
    assert.ok(z.name.length <= 22 && z.lvl[0] <= z.lvl[1] && z.lvl[1] <= 720, `${z.id} name and levels`);
    assert.ok(run(`spawnTable(${JSON.stringify(z.biome)}, ${z.lvl[0]}).length`) > 0, `${z.id} has monsters`);
    const m = run(`buildZone(ZONE_BY_ID[${JSON.stringify(z.id)}])`), ok = reachFrom(m, ZW, ZH, WALKABLE);
    for (const [side, e] of Object.entries(m.exits)) {
      const to = run(`ZONE_BY_ID[${JSON.stringify(e.to)}]`);
      assert.ok(to.under && to.region === z.region, `${z.id} ${side} stays underground in its region`);
      assert.ok(ok(e.x, e.y), `${z.id} ${side} exit reachable`);
    }
    if (m.poi.ascend) assert.ok(ok(m.poi.ascend.x, m.poi.ascend.y + 1) && m.rows[m.poi.ascend.y][m.poi.ascend.x] === 'C', `${z.id} climb reachable`);
    for (const [x, y] of m.nodes) assert.ok(ok(x, y), `${z.id} node reachable`);
  }
});

test('underground: each cave mouth leads to a cave whose climb leads back', () => {
  const ZW = run('ZW'), ZH = run('ZH'), WALKABLE = run('WALKABLE'), UW = run('GBQUnderworld');
  for (const zid of Object.values(UW.entrances)) {
    const m = run(`buildZone(ZONE_BY_ID[${JSON.stringify(zid)}])`);
    assert.ok(m.poi.cave, `${zid} has a cave mouth`);
    assert.equal(m.rows[m.poi.cave.y][m.poi.cave.x], 'C');
    assert.ok(reachFrom(m, ZW, ZH, WALKABLE)(m.poi.cave.x, m.poi.cave.y + 1), `${zid} cave mouth reachable`);
    const below = run(`buildZone(ZONE_BY_ID[${JSON.stringify(m.poi.cave.to)}])`);
    assert.equal(below.poi.ascend && below.poi.ascend.to, zid, `${zid} climb returns here`);
  }
});

test('settlements: villages get buildings, capitals build as cities, names are unique', () => {
  const UW = run('GBQUnderworld'), defs = run('SETTLEMENT_DEFS');
  for (const zid of UW.villageZones) assert.ok(run(`buildZone(ZONE_BY_ID[${JSON.stringify(zid)}]).buildings.length`) > 0, `${zid} village built`);
  for (const k of UW.kingdoms) {
    if (run(`ZONE_BY_ID[${JSON.stringify(k.capital)}].town`)) continue;
    const b = run(`buildZone(ZONE_BY_ID[${JSON.stringify(k.capital)}]).buildings`);
    assert.ok(b.length >= 6 && b.every(x => x.kind === 'CITY'), `${k.capital} is a city`);
  }
  const names = Object.values(defs).map(d => d.name);
  assert.equal(new Set(names).size, names.length, 'settlement names unique');
});

test('underworld: loaded after the zone generator and the field scene', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), at = f => html.indexOf(`src="src/${f}.js"`);
  assert.ok(at('underworld') > at('gen') && at('underworld') > at('scenes_world') && at('underworld') > at('buildings'));
  const order = fs.readFileSync(new URL('../tools/build.cjs', import.meta.url), 'utf8').match(/const ORDER = \[([^\]]+)\]/)[1];
  assert.ok(order.indexOf("'underworld'") > order.indexOf("'scenes_world'"));
});
