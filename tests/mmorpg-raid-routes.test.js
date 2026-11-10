import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {handleRaidRequest}=require('../backend/mmorpg-raid-routes.cjs');
function harness(){
 const state={status:200,body:null};
 const res={writeHead(status){state.status=status;},end(body){state.body=JSON.parse(body);}};
 return {state,res,json:(r,status,data)=>{r.writeHead(status);r.end(JSON.stringify(data));}};
}
function poolFor(handler){
 const calls=[];
 const tx={query:async(sql,args=[])=>{calls.push({sql,args});return handler(sql,args);},release(){}};
 return {calls,connect:async()=>tx,query:tx.query};
}
const accountFor=async()=>({id:'account-1'});
const readBody=async req=>req.body;
const raidId='11111111-1111-4111-8111-111111111111';
const leaderId='22222222-2222-4222-8222-222222222222';
const memberId='33333333-3333-4333-8333-333333333333';

test('raid group creation validates size and creates leader membership transactionally',async()=>{
 const pool=poolFor(sql=>{
  if(sql.startsWith('SELECT id,realm_id FROM characters'))return {rowCount:1,rows:[{id:leaderId,realm_id:'ardenhold'}]};
  if(sql.startsWith('SELECT 1 FROM raid_group_members'))return {rowCount:0,rows:[]};
  return {rowCount:1,rows:[]};
 });
 const h=harness(),url=new URL('https://game.test/api/characters/'+leaderId+'/raid-group');
 const handled=await handleRaidRequest({req:{method:'POST',body:{name:'Nightfall',raidSize:20}},res:h.res,url,pool,accountFor,readBody,json:h.json});
 assert.equal(handled,true);assert.equal(h.state.status,201);
 assert.equal(h.state.body.raid.raidSize,20);assert.equal(h.state.body.raid.leaderCharacterId,leaderId);
 assert.ok(pool.calls.some(x=>x.sql.startsWith('INSERT INTO raid_group_members')));
 assert.ok(pool.calls.some(x=>x.sql==='COMMIT'));
});

test('raid group creation rejects unsupported raid sizes before database writes',async()=>{
 let connected=false;
 const pool={connect:async()=>{connected=true;throw new Error('should_not_connect');},query:async()=>{throw new Error('should_not_query');}};
 const h=harness();
 await handleRaidRequest({req:{method:'POST',body:{raidSize:15}},res:h.res,url:new URL('https://game.test/api/characters/'+leaderId+'/raid-group'),pool,accountFor,readBody,json:h.json});
 assert.equal(h.state.status,400);assert.equal(h.state.body.error,'invalid_raid_group');assert.equal(connected,false);
});

test('raid invitations are leader-only and enforce same-realm capacity',async()=>{
 const pool=poolFor(sql=>{
  if(sql.startsWith('SELECT id,realm_id,leader_character_id,raid_size'))return {rowCount:1,rows:[{id:raidId,realm_id:'ardenhold',leader_character_id:leaderId,raid_size:10}]};
  if(sql.startsWith('SELECT 1 FROM characters'))return {rowCount:1,rows:[{id:leaderId}]};
  if(sql.startsWith('SELECT id,realm_id FROM characters'))return {rowCount:1,rows:[{id:memberId,realm_id:'ardenhold'}]};
  if(sql.startsWith('SELECT count(*)'))return {rowCount:1,rows:[{n:1}]};
  if(sql.startsWith('SELECT 1 FROM raid_group_members'))return {rowCount:0,rows:[]};
  if(sql.startsWith('SELECT 1 FROM raid_invites'))return {rowCount:0,rows:[]};
  return {rowCount:1,rows:[]};
 });
 const h=harness();
 await handleRaidRequest({req:{method:'POST',body:{inviterCharacterId:leaderId,inviteeCharacterId:memberId}},res:h.res,url:new URL('https://game.test/api/raids/'+raidId+'/invites'),pool,accountFor,readBody,json:h.json});
 assert.equal(h.state.status,201);assert.equal(h.state.body.invite.expiresInSeconds,60);
 assert.ok(pool.calls.some(x=>x.sql.startsWith('INSERT INTO raid_invites')));
});

test('raid invitation rejects a non-leader actor',async()=>{
 const pool=poolFor(sql=>{
  if(sql.startsWith('SELECT id,realm_id,leader_character_id,raid_size'))return {rowCount:1,rows:[{id:raidId,realm_id:'ardenhold',leader_character_id:memberId,raid_size:10}]};
  if(sql.startsWith('SELECT 1 FROM characters'))return {rowCount:1,rows:[{id:leaderId}]};
  return {rowCount:0,rows:[]};
 });
 const h=harness();
 await handleRaidRequest({req:{method:'POST',body:{inviterCharacterId:leaderId,inviteeCharacterId:memberId}},res:h.res,url:new URL('https://game.test/api/raids/'+raidId+'/invites'),pool,accountFor,readBody,json:h.json});
 assert.equal(h.state.status,403);assert.equal(h.state.body.error,'raid_leader_required');
});


test('raid lockout endpoint requires character ownership and returns only unexpired records',async()=>{
 const calls=[];
 const pool={query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT id FROM characters'))return {rowCount:1,rows:[{id:leaderId}]};return {rowCount:1,rows:[{raid_id:'vault_of_ashes',difficulty:'heroic',reset_at:'2030-01-01T00:00:00Z',completed_at:'2026-11-09T12:00:00Z'}]};}};
 const h=harness();
 await handleRaidRequest({req:{method:'GET'},res:h.res,url:new URL('https://game.test/api/characters/'+leaderId+'/raid-lockouts'),pool,accountFor,readBody,json:h.json});
 assert.equal(h.state.status,200);
 assert.equal(h.state.body.lockouts[0].raidId,'vault_of_ashes');
 assert.ok(calls[1].sql.includes('reset_at>now()'));
});
