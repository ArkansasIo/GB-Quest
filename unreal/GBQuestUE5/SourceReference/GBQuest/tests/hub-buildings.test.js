import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Hub buildings: every wild region hub is a village or a town with real buildings (src/gen.js placeHubBuildings, src/buildings.js).
const ctx = { console, window: {} };
ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data_rules.js', 'jobs_data.js', 'data_world.js', 'gen.js']) vm.runInContext(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
const hubs = JSON.parse(vm.runInContext(`JSON.stringify(ZONES.filter(z => !z.town && !z.hand && z.id === z.region).map(z => {
  const m = buildZone(z); return { id: z.id, kind: hubSettlementKind(z), rows: m.rows, hub: m.hub, buildings: m.buildings, exits: m.exits, poi: m.poi, nodes: m.nodes, bosses: m.bosses };
}))`, ctx));
const WALK = new Set(JSON.parse(vm.runInContext('JSON.stringify([...WALKABLE])', ctx)));
const NEED = { VILLAGE: ['inn', 'vendor', 'shrine'], TOWN: ['inn', 'vendor', 'blacksmith', 'stable', 'mail', 'bank', 'shrine'] };

test('every wild region hub has its village or town buildings', () => {
  assert.equal(hubs.length, 50 + 21, '50 original hubs and 21 in expansions 14-20');
  assert.ok(hubs.filter(h => h.kind === 'TOWN').length >= 22);
  let total = 0;
  for (const h of hubs) {
    const svcs = h.buildings.map(b => b.svc);
    for (const s of NEED[h.kind]) assert.ok(svcs.includes(s), `${h.id} (${h.kind}) has no ${s}`);
    total += h.buildings.length;
  }
  assert.ok(total >= 500, `only ${total} buildings`);
});

test('each building is a solid 2x2 footprint with a reachable door and a known sprite', () => {
  const sprites = new Set(fs.readdirSync(new URL('../assets/', import.meta.url)).filter(f => f.startsWith('ap_buildings_')).map(f => f.slice(0, -4)));
  for (const h of hubs) {
    const at = (x, y) => (h.rows[y] || '')[x];
    const seen = new Set([h.hub + '']), q = [h.hub];
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = [x + dx, y + dy] + ''; if (!seen.has(k) && WALK.has(at(x + dx, y + dy))) { seen.add(k); q.push([x + dx, y + dy]); } } }
    for (const b of h.buildings) {
      for (const [x, y] of [[b.x, b.y - 1], [b.x + 1, b.y - 1], [b.x, b.y], [b.x + 1, b.y]]) assert.equal(at(x, y), 'B', `${h.id} ${b.name}`);
      assert.ok(seen.has([b.x, b.y + 1] + '') || seen.has([b.x + 1, b.y + 1] + ''), `${h.id} ${b.name}: door cut off from the hub`);
      assert.ok(sprites.has(b.spr), `${h.id} ${b.name}: missing sprite ${b.spr}`);
    }
    const tiles = (h.rows.join('').match(/B/g) || []).length;
    assert.equal(tiles, h.buildings.length * 4, `${h.id}: stray building tiles`);
  }
});

test('buildings never cover an exit, entrance, waypoint, node or boss', () => {
  for (const h of hubs) {
    const at = (x, y) => (h.rows[y] || '')[x];
    const spots = [...Object.values(h.exits).map(e => [e.x, e.y]), ...Object.values(h.poi).map(p => [p.x, p.y]), ...h.nodes, ...h.bosses.map(b => [b.x, b.y])];
    for (const [x, y] of spots) assert.notEqual(at(x, y), 'B', `${h.id}: something at ${x},${y} is under a building`);
    if (h.poi.dungeon) assert.equal(at(h.poi.dungeon.x, h.poi.dungeon.y), 'k');
    if (h.poi.raid) assert.equal(at(h.poi.raid.x, h.poi.raid.y), 'R');
  }
});

test('placement is deterministic and the rest of the map comes from the same seed as before', () => {
  const again = JSON.parse(vm.runInContext(`JSON.stringify(buildZone(ZONE_BY_ID['${hubs[3].id}']))`, ctx));
  assert.deepEqual(again.buildings, hubs[3].buildings);
  const gen = fs.readFileSync(new URL('../src/gen.js', import.meta.url), 'utf8');
  assert.match(gen, /RNG\('buildings-' \+ z\.id\)/, 'buildings use their own seed');
  assert.ok(gen.indexOf('placeHubBuildings(z, g, hub') > gen.indexOf("BOSSES.filter(b => b.cat === 'world' && b.where === z.id)"), 'placed after nodes and bosses');
});

test('the game draws and opens the buildings', () => {
  const src = fs.readFileSync(new URL('../src/buildings.js', import.meta.url), 'utf8');
  for (const fn of ['buildingAt', 'useBuilding', 'drawBuilding', 'shrinePray', 'millBread']) assert.match(src, new RegExp(`function ${fn}\\b`));
  assert.match(fs.readFileSync(new URL('../src/scenes_world.js', import.meta.url), 'utf8'), /e\.kind === 'building'/);
  assert.match(fs.readFileSync(new URL('../tools/build.cjs', import.meta.url), 'utf8'), /'towns', 'buildings'/);
});
