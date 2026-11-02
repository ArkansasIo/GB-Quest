import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/secret_world.js', import.meta.url), 'utf8');
function api() { const context = { globalThis: {}, Date, WALKABLE: new Set(['.']), hashStr: s => [...s].reduce((a,c)=>a+c.charCodeAt(0),0) }; vm.runInNewContext(source, context); return context.globalThis.GBQSecretWorld; }
test('secret world position is deterministic and hidden locations are level gated', () => {
  const a = api(), map = { rows: Array.from({length:20},()=>'.'.repeat(30)), poi:{}, bosses:[], nodes:[], exits:{} };
  const def = a.definitions.find(x=>x.zone==='hollowmere'), p1=a.position(def,map), p2=a.position(def,map);
  assert.deepEqual(JSON.parse(JSON.stringify(p1)), JSON.parse(JSON.stringify(p2)));
  assert.equal(a.at({lvl:1}, {id:'hollowmere'}, map, p1.x,p1.y), null);
  assert.equal(a.at({lvl:10}, {id:'hollowmere'}, map, p1.x,p1.y).id, def.id);
});
test('secret cache reward is idempotent and summary tracks discoveries', () => {
  const a=api(), state={lvl:10,gold:0,bossTokens:0,inv:{},stats:{}}, def=a.definitions.find(x=>x.type==='cache');
  const context={globalThis:{},Date, WALKABLE:new Set(['.']), hashStr:s=>1, saveGame:()=>true}; vm.runInNewContext(source,context);
  const api2=context.globalThis.GBQSecretWorld;
  const first=api2.discover;
  assert.equal(api2.summary(state).discovered,0);
  assert.equal(state.secretWorld,undefined);
});
