import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handleCompetitiveRequest } = require('../backend/mmorpg-competitive-routes.cjs');

function response() {
  return { status: 0, body: null, writeHead(status) { this.status=status; }, end(value) { this.body=JSON.parse(value); } };
}
const json=(res,status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
const readBody=async req=>req.body||{};

test('competitive router ignores unrelated routes',async()=>{
  const res=response();
  assert.equal(await handleCompetitiveRequest({req:{url:'/health',method:'GET'},res,pool:{},accountFor:async()=>({id:'a'}),json,readBody}),false);
});

test('competitive queue rejects unsupported modes before connecting to PostgreSQL',async()=>{
  const res=response();let connects=0;
  const handled=await handleCompetitiveRequest({
    req:{url:'/api/competitive/queue',method:'POST',body:{characterId:'11111111-1111-4111-8111-111111111111',mode:'ranked_5v5'}},
    res,pool:{connect:async()=>{connects++;throw new Error('unexpected connection');}},
    accountFor:async()=>({id:'account-1'}),json,readBody
  });
  assert.equal(handled,true);assert.equal(res.status,400);
  assert.equal(res.body.error,'invalid_competitive_queue_request');assert.equal(connects,0);
});

test('competitive routes require an authenticated account',async()=>{
  const res=response();
  const handled=await handleCompetitiveRequest({
    req:{url:'/api/notifications',method:'GET'},res,pool:{},accountFor:async()=>null,json,readBody
  });
  assert.equal(handled,true);assert.equal(res.status,401);assert.equal(res.body.error,'unauthorized');
});
