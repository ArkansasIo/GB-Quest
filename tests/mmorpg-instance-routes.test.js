import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {handleInstanceRequest}=require('../backend/mmorpg-instance-routes.cjs');
const instanceId='11111111-1111-4111-8111-111111111111';
const leaderId='22222222-2222-4222-8222-222222222222';
const memberId='33333333-3333-4333-8333-333333333333';

function harness(status='completed') {
 const state={status:0,body:null},calls=[];
 const res={writeHead(s){state.status=s;},end(v){state.body=JSON.parse(v);}};
 const tx={query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('UPDATE dungeon_instances'))return{rowCount:1,rows:[{id:instanceId,status,expires_at:'2026-11-13T10:00:00Z'}]};
  if(sql.startsWith('SELECT character_id FROM dungeon_instance_members'))return{rowCount:2,rows:[{character_id:leaderId},{character_id:memberId}]};
  if(sql.startsWith('INSERT INTO character_season_objectives'))return{rowCount:1,rows:[{progress:1,target:2}]};
  return{rowCount:1,rows:[]};
 },release(){}};
 const pool={connect:async()=>tx};
 const req={method:'POST'};
 const url=new URL('https://realm.test/api/instances/'+instanceId+'/complete');
 return{state,calls,res,req,url,pool,accountFor:async()=>({id:'account-1'}),readBody:async()=>({characterId:leaderId,status}),
  json(r,s,b){r.writeHead(s);r.end(JSON.stringify(b));}};
}

test('completed dungeon awards both seasonal dungeon objectives to every instance member atomically',async()=>{
 const h=harness('completed');
 assert.equal(await handleInstanceRequest(h),true);
 assert.equal(h.state.status,200);
 const updates=h.calls.filter(x=>x.sql.startsWith('INSERT INTO character_season_objectives'));
 assert.equal(updates.length,4);
 assert.deepEqual(updates.map(x=>x.args[0]),[leaderId,leaderId,memberId,memberId]);
 assert.deepEqual(updates.map(x=>x.args[2]),['chapter_3','chapter_11','chapter_3','chapter_11']);
 assert.ok(h.calls.some(x=>x.sql==='COMMIT'));
});

test('failed or closed dungeon does not award seasonal completion progress',async()=>{
 const h=harness('failed');
 await handleInstanceRequest(h);
 assert.equal(h.state.status,200);
 assert.equal(h.calls.some(x=>x.sql.startsWith('INSERT INTO character_season_objectives')),false);
});
