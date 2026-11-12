import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handlePartyRequest } = require('../backend/mmorpg-party-routes.cjs');
const { handleGuildRequest } = require('../backend/mmorpg-guild-routes.cjs');

function responseHarness() {
  const result = { status: 200, body: null };
  const res = { writeHead(status) { result.status = status; }, end(body) { result.body = JSON.parse(body); } };
  return { result, res };
}
function txPool(queryHandler) {
  const calls = [];
  const tx = { query: async (sql,args=[]) => { calls.push({sql,args}); return queryHandler(sql,args); }, release() {} };
  return { calls, connect: async () => tx, query: tx.query };
}
const acct = async () => ({ id: 'account-1' });
const readBody = async req => req.body;
const partyId = '11111111-1111-4111-8111-111111111111';
const guildId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const targetId = '44444444-4444-4444-8444-444444444444';

test('party role assignment requires the party leader and returns the updated roster', async () => {
  const pool = txPool((sql) => {
    if (sql.startsWith('SELECT id,realm_id,leader_character_id FROM parties')) return { rowCount:1, rows:[{id:partyId,realm_id:'ardenhold',leader_character_id:actorId}] };
    if (sql.startsWith('SELECT id FROM characters')) return { rowCount:1, rows:[{id:actorId}] };
    if (sql.startsWith('UPDATE party_members')) return { rowCount:1, rows:[{character_id:targetId,role:'healer'}] };
    if (sql.includes('SELECT pm.character_id,c.name')) return { rowCount:2, rows:[{character_id:actorId,name:'Leader',level:10,zone_id:'town',role:'damage'},{character_id:targetId,name:'Healer',level:9,zone_id:'town',role:'healer'}] };
    return { rowCount:0, rows:[] };
  });
  const h=responseHarness(), req={method:'POST',body:{actorCharacterId:actorId,role:'healer'}};
  const url=new URL('https://game.test/api/parties/'+partyId+'/members/'+targetId+'/role');
  assert.equal(await handlePartyRequest({req,res:h.res,url,pool,accountFor:acct,readBody,json:(res,status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));}}),true);
  assert.equal(h.result.status,200);
  assert.equal(h.result.body.party.members[1].role,'healer');
  assert.ok(pool.calls.some(c=>c.sql==='COMMIT'));
});

test('party role assignment rejects non-leaders', async () => {
  const pool=txPool(sql=>sql.startsWith('SELECT id,realm_id,leader_character_id FROM parties')
    ? {rowCount:1,rows:[{id:partyId,realm_id:'ardenhold',leader_character_id:targetId}]}
    : {rowCount:1,rows:[{id:actorId}]});
  const h=responseHarness(),req={method:'POST',body:{actorCharacterId:actorId,role:'tank'}};
  const url=new URL('https://game.test/api/parties/'+partyId+'/members/'+targetId+'/role');
  await handlePartyRequest({req,res:h.res,url,pool,accountFor:acct,readBody,json:(res,status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));}});
  assert.equal(h.result.status,403);
  assert.equal(h.result.body.error,'party_leader_required');
});

test('guild rank assignment rejects attempts to overwrite the guild leader rank', async () => {
  const pool=txPool(sql=>sql.startsWith('SELECT id,leader_character_id FROM guilds')
    ? {rowCount:1,rows:[{id:guildId,leader_character_id:actorId}]}
    : {rowCount:0,rows:[]});
  const h=responseHarness(),req={method:'POST',body:{actorCharacterId:actorId,rank:'leader'}};
  const url=new URL('https://game.test/api/guilds/'+guildId+'/members/'+targetId+'/rank');
  await handleGuildRequest({req,res:h.res,url,pool,accountFor:acct,readBody,json:(res,status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));}});
  assert.equal(h.result.status,400);
  assert.equal(h.result.body.error,'invalid_guild_rank_request');
});
