import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/secret_world.js', import.meta.url), 'utf8');
const zoneIds = ['ardenhold','elderwood','hollowmere','thornwood','greypeak','sandspire','saltreach','emberwaste','frostmarch','verdantdeep','ashenbarrows','silverhaven','duskmoor', ...Array.from({length:43},(_,i)=>'frontier_'+i)];
function api() {
  const context = { globalThis: {}, Date, WALKABLE: new Set(['.']), ZONES: zoneIds.map((id,i)=>({id,lvl:[Math.max(1,i+1),Math.max(4,i+4)]})),
    hashStr: s => [...s].reduce((a,c)=>Math.imul(a ^ c.charCodeAt(0),16777619) >>> 0,2166136261), saveGame: () => true };
  vm.runInNewContext(source, context);
  return context.globalThis.GBQSecretWorld;
}
const openMap = () => ({ rows: Array.from({length:20},()=>'.'.repeat(30)), poi:{}, bosses:[], nodes:[], exits:{} });
test('secret world positions are deterministic and locations are level gated', () => {
  const a = api(), map = openMap(), def = a.definitions.find(x=>x.zone==='hollowmere'), p1=a.position(def,map), p2=a.position(def,map);
  assert.deepEqual(JSON.parse(JSON.stringify(p1)), JSON.parse(JSON.stringify(p2)));
  assert.equal(a.at({lvl:1}, {id:'hollowmere'}, map, p1.x,p1.y), null);
  assert.equal(a.at({lvl:10}, {id:'hollowmere'}, map, p1.x,p1.y).id, def.id);
});
test('catalog contains exactly 100 unique secrets spread across the world zones', () => {
  const a=api(), entries=a.definitions, ids=new Set(entries.map(x=>x.id)), zones=new Set(entries.map(x=>x.zone));
  assert.equal(entries.length,100);
  assert.equal(ids.size,100);
  assert.ok(zones.size >= 40, 'secrets should span at least 40 zones');
  for (const e of entries) {
    assert.ok(zoneIds.includes(e.zone), 'unknown zone: '+e.zone);
    assert.ok(e.name && e.hint && e.minLvl >= 1);
  }
});
test('multiple secrets in one zone receive distinct deterministic coordinates', () => {
  const a=api(), map=openMap(), entries=a.definitions.filter(x=>x.zone==='hollowmere'), points=entries.map(x=>a.position(x,map));
  assert.ok(entries.length >= 2);
  assert.equal(new Set(points.map(p=>p.x+','+p.y)).size, points.length);
});
test('secret rewards are one-time and recorded in the discovery journal', () => {
  const a=api(), state={gold:0,bossTokens:0,inv:{},stats:{}}, def=a.definitions.find(x=>x.type==='cache');
  assert.equal(a.grant(state,def,{gold:3200,sigils:2,potions:3}),true);
  assert.equal(a.grant(state,def,{gold:3200,sigils:2,potions:3}),false);
  assert.equal(state.gold,3200);
  assert.equal(state.bossTokens,2);
  assert.equal(state.inv.potion,3);
  assert.equal(state.stats.secretFinds,1);
  assert.equal(a.summary(state).discovered,1);
});
test('catalog supports secret NPCs, caches, dungeons, portals and bosses', () => {
  const a=api(), types=new Set(a.definitions.map(x=>x.type));
  for (const type of ['npc','cache','dungeon','developer','portal','boss']) assert.ok(types.has(type));
  assert.equal(a.summary({}).discovered,0);
});
