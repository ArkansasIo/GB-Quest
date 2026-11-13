import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {seasonFor,weekStart,renownLevel,recordSeasonActivity,handleSeasonRequest}=require('../backend/mmorpg-season-routes.cjs');

test('season calendar uses UTC quarter boundaries',()=>{
 const s=seasonFor(new Date('2027-04-01T00:00:00.000Z'));
 assert.equal(s.id,'Y2027_frostwake');assert.equal(s.start,'2027-04-01');assert.equal(s.end,'2027-07-01');
});
test('weekly reset key is the UTC Monday',()=>{
 assert.equal(weekStart(new Date('2027-01-06T12:00:00Z')),'2027-01-04');
});
test('renown levels clamp to the configured 20-tier cap',()=>{
 assert.equal(renownLevel(0),0);assert.equal(renownLevel(499),4);assert.equal(renownLevel(2000),20);assert.equal(renownLevel(99999),20);
});
test('activity recorder accepts only bounded server-side counters',async()=>{
 const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return{rowCount:1,rows:[]};}};
 await recordSeasonActivity(db,'character-1',{kills:2,quests:1,cheat:999999,killsTooMany:999999});
 assert.equal(calls.length,3);assert.ok(calls[1].sql.includes('jsonb_set'));assert.deepEqual(calls[1].args.slice(2),['kills',2]);
});
test('season endpoint rejects unauthenticated requests and non-owned characters',async()=>{
 const response={status:0,body:null},res={writeHead(s){response.status=s;},end(v){response.body=JSON.parse(v);}};
 const base={req:{method:'GET'},res,url:new URL('https://game.test/api/characters/11111111-1111-4111-8111-111111111111/season'),
  pool:{query:async()=>({rowCount:0,rows:[]})},accountFor:async()=>null,json(r,s,b){r.writeHead(s);r.end(JSON.stringify(b));}};
 assert.equal(await handleSeasonRequest(base),true);assert.equal(response.status,401);
});

function routeHarness({method='GET',body={},rowOverrides={}}={}) {
 const response={status:0,body:null},calls=[];
 const row={character_id:'11111111-1111-4111-8111-111111111111',season_id:seasonFor().id,
  season_start:seasonFor().start,season_end:seasonFor().end,stats:{kills:50,quests:0},
  journey_chapter:1,journey_base:{},weekly_start:weekStart(),weekly_base:{},weekly_claimed:[],
  claimed_renown:[],currency:0,season_xp:0,renown:0,...rowOverrides};
 const res={writeHead(s){response.status=s;},end(v){response.body=JSON.parse(v);}};
 const tx={query:async(sql,args)=>{calls.push({sql,args});
  if(sql.startsWith('SELECT id FROM characters'))return{rowCount:1,rows:[{id:row.character_id}]};
  if(sql.startsWith('SELECT * FROM character_season_progress'))return{rowCount:1,rows:[{...row}]};
  if(sql.includes('SET journey_chapter=')){row.journey_chapter+=1;row.journey_base={...row.stats};return{rowCount:1,rows:[]};}
  if(sql.includes('SET weekly_claimed=')){row.weekly_claimed=[...row.weekly_claimed,args[2]];return{rowCount:1,rows:[]};}
  if(sql.includes('SET claimed_renown=')){row.claimed_renown=[...row.claimed_renown,args[2]];return{rowCount:1,rows:[]};}
  if(sql.startsWith('UPDATE characters SET gold='))return{rowCount:1,rows:[]};
  if(sql.includes('SET currency=LEAST')){row.currency+=args[0];row.season_xp+=args[1];row.renown+=args[0];return{rowCount:1,rows:[{...row}]};}
  return{rowCount:1,rows:[]};
 },release(){}};
 const pool={query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT id FROM characters'))return{rowCount:1,rows:[{id:row.character_id}]};return{rowCount:1,rows:[]};},connect:async()=>tx};
 const req={method,async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}};
 return{response,calls,row,res,req,pool,url:new URL('https://game.test/api/characters/'+row.character_id+'/season'+(method==='POST'?'/claim':'')),
  accountFor:async()=>({id:'account-1'}),json(r,s,data){r.writeHead(s);r.end(JSON.stringify(data));}};
}
test('season GET returns persisted server counters and current weekly objectives',async()=>{
 const h=routeHarness();
 assert.equal(await handleSeasonRequest(h),true);
 assert.equal(h.response.status,200);
 assert.equal(h.response.body.stats.kills,50);
 assert.equal(h.response.body.journey.current.id,'chapter_1');
 assert.equal(h.response.body.weekly.quests.length,3);
});
test('journey reward claim is server-validated and advances exactly one chapter',async()=>{
 const h=routeHarness({method:'POST',body:{type:'journey',id:'chapter_1'}});
 assert.equal(await handleSeasonRequest(h),true);
 assert.equal(h.response.status,200);
 assert.equal(h.response.body.claimed.reward.tokens,30);
 assert.equal(h.response.body.currency,30);
 assert.equal(h.response.body.journey.chapter,2);
 assert.ok(h.calls.some(x=>x.sql.startsWith('UPDATE characters SET gold=')));
});
test('journey claim rejects an incomplete objective without granting currency',async()=>{
 const h=routeHarness({method:'POST',body:{type:'journey',id:'chapter_1'},rowOverrides:{stats:{kills:49,quests:0}}});
 assert.equal(await handleSeasonRequest(h),true);
 assert.equal(h.response.status,409);
 assert.equal(h.response.body.error,'season_objective_incomplete');
 assert.equal(h.row.currency,0);
});
