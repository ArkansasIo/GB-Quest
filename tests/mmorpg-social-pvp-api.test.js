import test from 'node:test';
import assert from 'node:assert/strict';
import { GBQuestMMOApi } from '../src/mmorpg/net/mmorpg-api.js';

test('MMORPG API exposes authenticated social, mail and PvP endpoints', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    WebSocketImpl: class {},
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
  });
  api.token = 'realm-token';
  await api.friends('character-1');
  await api.requestFriend('character-1', 'character-2');
  await api.respondFriendRequest('request-1', 'accept');
  await api.blocks('character-1');
  await api.blockCharacter('character-1', 'character-2');
  await api.unblockCharacter('character-1', 'character-2');
  await api.mail('character-1');
  await api.sendMail('character-1', 'character-2', 'Hello', 'Welcome to Aelmoor');
  await api.markMailRead('mail-1');
  await api.joinPvpQueue('character-1');
  await api.forfeitPvpMatch('match-1');
  await api.pvpQueueStatus('character-1');
  await api.leavePvpQueue('character-1');
  await api.pvpMatch('match-1');
  assert.deepEqual(calls.map(call => [new URL(call.url).pathname, call.options.method || 'GET']), [
    ['/api/characters/character-1/friends','GET'],
    ['/api/characters/character-1/friends/request','POST'],
    ['/api/friend-requests/request-1/accept','POST'],
    ['/api/characters/character-1/blocks','GET'],
    ['/api/characters/character-1/blocks','POST'],
    ['/api/characters/character-1/blocks/character-2','DELETE'],
    ['/api/characters/character-1/mail','GET'],
    ['/api/characters/character-1/mail','POST'],
    ['/api/mail/mail-1/read','POST'],
    ['/api/pvp/queue','POST'],
    ['/api/pvp/matches/match-1/forfeit','POST'],
    ['/api/pvp/queue/character-1','GET'],
    ['/api/pvp/queue/character-1','DELETE'],
    ['/api/pvp/matches/match-1','GET']
  ]);
  assert.ok(calls.every(call => call.options.headers.authorization === 'Bearer realm-token'));
  assert.deepEqual(JSON.parse(calls[9].options.body), { characterId: 'character-1' });
  assert.throws(() => api.respondFriendRequest('request-1', 'remove'), /accept or decline/);
});
