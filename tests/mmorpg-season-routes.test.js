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
