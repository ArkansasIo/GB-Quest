import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {handleRaidEncounterRequest}=require('../backend/mmorpg-raid-encounter-routes.cjs');
const raidId='11111111-1111-4111-8111-111111111111';
const secret='0123456789abcdef0123456789abcdef';
function harness(){const state={status:200,body:null};const res={writeHead(s){state.status=s;},end(b){state.body=JSON.parse(b);}};return {state,res,json:(r,s,d)=>{r.writeHead(s);r.end(JSON.stringify(d));}};}
function poolFor(handler){const calls=[];const tx={query:async(sql,args=[])=>{calls.push({sql,args});return handler(sql,args);},release(){}};return {calls,connect:async()=>tx};}
const base={method:'POST',headers:{'x-gbq-internal-secret':secret},body:{difficulty:'heroic'}};
const readBody=async req=>req.body;

test('raid completion endpoint rejects requests without trusted internal secret',async()=>{
 const h=harness();let connected=false;
 const pool={connect:async()=>{connected=true;throw new Error('must_not_connect');}};
 await handleRaidEncounterRequest({req:{...base,headers:{}},res:h.res,url:new URL('https://game.test/api/internal/raids/'+raidId+'/encounters/ash_titan/complete'),pool,readBody,json:h.json,internalSecret:secret});
 assert.equal(h.state.status,401);assert.equal(connected,false);
});

test('trusted raid encounter completion issues lockouts to every current member atomically',async()=>{
 const ids=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
 const pool=poolFor(sql=>{
  if(sql.startsWith('SELECT id,realm_id,raid_size'))return {rowCount:1,rows:[{id:raidId,realm_id:'ardenhold',raid_size:10}]};
  if(sql.startsWith('SELECT character_id FROM raid_group_members'))return {rowCount:2,rows:ids.map(character_id=>({character_id}))};
  if(sql.startsWith('INSERT INTO raid_encounter_completions'))return {rowCount:1,rows:[{id:'completion-1',completed_at:'2026-11-09T12:00:00Z',reset_at:'2026-11-16T12:00:00Z'}]};
  return {rowCount:2,rows:[]};
 });
 const h=harness();
 await handleRaidEncounterRequest({req:base,res:h.res,url:new URL('https://game.test/api/internal/raids/'+raidId+'/encounters/ash_titan/complete'),pool,readBody,json:h.json,internalSecret:secret});
 assert.equal(h.state.status,200);assert.equal(h.state.body.completion.memberCount,2);
 const issue=pool.calls.find(x=>x.sql.includes('INSERT INTO raid_lockouts'));
 assert.deepEqual(issue.args[0],ids);assert.equal(issue.args[1],'ash_titan');assert.equal(issue.args[2],'heroic');
 assert.ok(pool.calls.some(x=>x.sql==='COMMIT'));
});

test('duplicate encounter completion cannot issue another reward or lockout event',async()=>{
 const pool=poolFor(sql=>{
  if(sql.startsWith('SELECT id,realm_id,raid_size'))return {rowCount:1,rows:[{id:raidId,realm_id:'ardenhold',raid_size:10}]};
  if(sql.startsWith('SELECT character_id FROM raid_group_members'))return {rowCount:1,rows:[{character_id:'22222222-2222-4222-8222-222222222222'}]};
  if(sql.startsWith('INSERT INTO raid_encounter_completions'))return {rowCount:0,rows:[]};
  return {rowCount:0,rows:[]};
 });
 const h=harness();
 await handleRaidEncounterRequest({req:base,res:h.res,url:new URL('https://game.test/api/internal/raids/'+raidId+'/encounters/ash_titan/complete'),pool,readBody,json:h.json,internalSecret:secret});
 assert.equal(h.state.status,409);assert.equal(h.state.body.error,'encounter_already_completed');
 assert.equal(pool.calls.some(x=>x.sql.includes('INSERT INTO raid_lockouts')),false);
});
