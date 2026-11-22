import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = () => { const c = { Math, Object, Array, String, Number, globalThis: null }; c.globalThis = c; vm.runInNewContext(fs.readFileSync(new URL('../src/cities.js', import.meta.url), 'utf8'), c); return c.GBQCities; };

test('cities: six districts per city, harbor on the coast and slums inland', () => {
  const C = load();
  assert.equal(C.DISTRICT_COUNT, 6);
  const coast = C.cityPlan('saltreach', 'SALTREACH', 'coast'), inland = C.cityPlan('greypeak', 'GREYPEAK', 'snow');
  assert.equal(coast.length, 5, 'five district zones besides the market');
  assert.deepEqual(Array.from(coast, d => d.key), ['craft', 'temple', 'noble', 'harbor', 'castle']);
  assert.deepEqual(Array.from(inland, d => d.key), ['craft', 'temple', 'noble', 'slums', 'castle']);
  assert.equal(coast[0].name, 'SALTREACH CRAFT ROW'); assert.equal(coast[0].id, 'city_saltreach_1');
  for (const d of [...coast, ...inland]) assert.ok(d.name.length <= 24 && d.buildings.length >= 6, d.id);
});

test('cities: every district link is two-way and the whole city is connected', () => {
  const C = load();
  const plan = C.cityPlan('ardenhold', 'ARDENHOLD', 'coast'), byId = Object.fromEntries(plan.map(d => [d.id, d]));
  for (const d of plan) for (const [side, to] of Object.entries(d.links)) {
    assert.ok(byId[to], `${d.id} ${side} leads to a district`);
    assert.equal(byId[to].links[C.OPPOSITE[side]], d.id, `${d.id} ${side} has a way back`);
  }
  const seen = new Set([plan[0].id]), q = [plan[0]];
  while (q.length) for (const to of Object.values(q.pop().links)) if (!seen.has(to)) { seen.add(to); q.push(byId[to]); }
  assert.equal(seen.size, 5, 'all districts reachable from CRAFT ROW (which holds the gate to the market)');
});

test('cities: the new services are all used, and every district grid is walled with roads to each exit', () => {
  const C = load();
  const used = new Set(C.DISTRICTS.flatMap(d => d.buildings.map(b => b[0])));
  for (const svc of C.NEW_SERVICES) assert.ok(used.has(svc), `${svc} has a building`);
  for (const theme of ['craft', 'temple', 'noble', 'harbor', 'slums', 'castle']) {
    const g = C.districtGrid(theme, 'seed-' + theme, 32, 24);
    assert.equal(g.length, 24); assert.ok(g.every(r => r.length === 32));
    assert.ok(g[0].every(c => c === 'M') && g[23].every(c => c === 'M'), `${theme} outer border`);
    // the main roads run through the inner wall where the exits are (EXIT_POS N/S at x=16, W/E at y=12)
    assert.equal(g[1][16], '|'); assert.equal(g[12][1], 'h'); assert.equal(g[12][30], 'h');
    assert.ok(g.flat().filter(c => c === '"').length > 150, `${theme} has room for buildings`);
  }
  assert.deepEqual(C.districtGrid('noble', 'x', 32, 24), C.districtGrid('noble', 'x', 32, 24), 'deterministic');
});
