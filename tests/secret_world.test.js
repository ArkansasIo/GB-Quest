import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/secret_world.js', import.meta.url), 'utf8');
function api() {
  const context = { globalThis: {}, Date, WALKABLE: new Set(['.']), hashStr: s => [...s].reduce((a,c)=>a+c.charCodeAt(0),0), saveGame: () => true };
  vm.runInNewContext(source, context);
  return context.globalThis.GBQSecretWorld;
}
test('secret world positions are deterministic and locations are level gated', () => {
  const a = api(), map = { rows: Array.from({length:20},()=>'.'.repeat(30)), poi:{}, bosses:[], nodes:[], exits:{} };
  const def = a.definitions.find(x=>x.zone==='hollowmere'), p1=a.position(def,map), p2=a.position(def,map);
  assert.deepEqual(JSON.parse(JSON.stringify(p1)), JSON.parse(JSON.stringify(p2)));
  assert.equal(a.at({lvl:1}, {id:'hollowmere'}, map, p1.x,p1.y), null);
  assert.equal(a.at({lvl:10}, {id:'hollowmere'}, map, p1.x,p1.y).id, def.id);
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
test('secret catalog includes NPC, cache, dungeon, developer room, portal and hidden boss', () => {
  const a=api(), types=a.definitions.map(x=>x.type);
  for (const type of ['npc','cache','dungeon','developer','portal','boss']) assert.ok(types.includes(type));
  assert.equal(a.summary({}).discovered,0);
});
