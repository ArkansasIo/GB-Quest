import test from 'node:test';
import assert from 'node:assert/strict';
import { GBQuestMMOApi } from '../src/mmorpg/net/mmorpg-api.js';

test('MMORPG API exposes competitive queues and notification inbox',async()=>{
  const calls=[];
  const api=new GBQuestMMOApi({
    baseUrl:'https://realm.example.test',WebSocketImpl:class{},
    fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({ok:true})};}
  });
  api.token='realm-token';
  await api.notifications(25);
  await api.markNotificationRead('notice-1');
  await api.joinCompetitiveQueue('character-1','arena_2v2');
  await api.competitiveQueueStatus('character-1');
  await api.leaveCompetitiveQueue('character-1');
  await api.competitiveMatch('match-1');
  assert.deepEqual(calls.map(c=>[new URL(c.url).pathname,c.options.method||'GET']),[
    ['/api/notifications','GET'],
    ['/api/notifications/notice-1/read','POST'],
    ['/api/competitive/queue','POST'],
    ['/api/competitive/queue/character-1','GET'],
    ['/api/competitive/queue/character-1','DELETE'],
    ['/api/competitive/matches/match-1','GET']
  ]);
  assert.equal(new URL(calls[0].url).searchParams.get('limit'),'25');
  assert.deepEqual(JSON.parse(calls[2].options.body),{characterId:'character-1',mode:'arena_2v2'});
  assert.ok(calls.every(c=>c.options.headers.authorization==='Bearer realm-token'));
  assert.throws(()=>api.joinCompetitiveQueue('character-1','unsupported'),/Unsupported competitive mode/);
});
