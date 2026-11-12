import test from 'node:test';
import assert from 'node:assert/strict';
import { GBQuestMMOApi } from '../src/mmorpg/net/mmorpg-api.js';
import { MultiplayerClient } from '../src/mmorpg/net/multiplayer-client.js';

test('MMORPG API authenticates and sends bearer credentials to character endpoints', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const payload = url.endsWith('/api/register')
      ? { token: 'signed-session-token', account: { id: 'acct-1', username: 'HeroOne' } }
      : { character: { id: 'char-1', name: 'Aelwyn', class: 'strider' } };
    return { ok: true, status: 200, json: async () => payload };
  };
  const api = new GBQuestMMOApi({ baseUrl: 'https://realm.example.test', fetchImpl, WebSocketImpl: class {} });
  const registered = await api.register('HeroOne', 'a-long-test-password');
  assert.equal(registered.account.username, 'HeroOne');
  await api.createCharacter('Aelwyn', 'ranger');
  assert.equal(calls[0].options.headers.authorization, undefined);
  assert.equal(calls[1].options.headers.authorization, 'Bearer signed-session-token');
  assert.equal(calls[1].options.credentials, 'omit');
});

test('MMORPG API rejects non-HTTPS remote origins and reports API errors', async () => {
  assert.throws(() => new GBQuestMMOApi({ baseUrl: 'ftp://realm.example.test' }), /HTTPS/);
  assert.throws(() => new GBQuestMMOApi({ baseUrl: 'http://realm.example.test' }), /HTTPS/);
  assert.doesNotThrow(() => new GBQuestMMOApi({ baseUrl: 'http://localhost:8788' }));
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })
  });
  api.token = 'invalid';
  await assert.rejects(api.me(), error => error.status === 401 && error.code === 'unauthorized');
});

test('MMORPG API exposes authenticated player trade operations', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'realm-token';
  await api.trades('character-1');
  await api.createTrade('character-1', 'character-2', { itemId: 'minor_potion', quantity: 2, goldAmount: 7 });
  await api.acceptTrade('trade-1');
  await api.cancelTrade('trade-2');
  assert.deepEqual(calls.map(call => call.url), [
    'https://realm.example.test/api/characters/character-1/trades',
    'https://realm.example.test/api/characters/character-1/trades',
    'https://realm.example.test/api/trades/trade-1/accept',
    'https://realm.example.test/api/trades/trade-2/cancel'
  ]);
  assert.equal(calls[0].options.headers.authorization, 'Bearer realm-token');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    itemId: 'minor_potion', quantity: 2, goldAmount: 7, toCharacterId: 'character-2'
  });
});

test('multiplayer transport permits ws only on loopback development hosts', () => {
  class FakeSocket {
    constructor(url) { this.url = url; this.handlers = {}; this.readyState = 0; }
    addEventListener(name, callback) { this.handlers[name] = callback; }
    close() { this.readyState = 3; }
  }
  const client = new MultiplayerClient({ WebSocketImpl: FakeSocket });
  client.connect('ws://localhost:8788/ws', 'token');
  assert.equal(client.socket.url, 'ws://localhost:8788/ws');
  client.disconnect();
  assert.throws(() => client.connect('ws://realm.example.test/ws', 'token'), /wss/);
});

test('MMORPG API supports region selection, realm-scoped characters and persistent whispers', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'realm-token';
  await api.regions();
  await api.realms('lordeon');
  await api.createCharacter('Aelwyn', 'strider', 'moonfall', 'thornelf', 'scholar');
  await api.characters('moonfall');
  await api.whispers('character-1', { withCharacterId: 'character-2', limit: 25 });
  await api.sendWhisper('character-1', 'character-2', 'Meet at the gate');
  assert.equal(calls[0].url, 'https://realm.example.test/api/regions');
  assert.equal(calls[0].options.headers.authorization, undefined);
  assert.equal(calls[1].url, 'https://realm.example.test/api/realms?region=lordeon');
  assert.deepEqual(JSON.parse(calls[2].options.body), { name: 'Aelwyn', class: 'strider', realmId: 'moonfall', species: 'thornelf', background: 'scholar' });
  assert.equal(calls[3].url, 'https://realm.example.test/api/characters?realm=moonfall');
  assert.equal(calls[4].url, 'https://realm.example.test/api/characters/character-1/whispers?with=character-2&limit=25');
  assert.deepEqual(JSON.parse(calls[5].options.body), { toCharacterId: 'character-2', text: 'Meet at the gate' });
  assert.equal(calls[5].options.headers.authorization, 'Bearer realm-token');
});

test('MMORPG API exposes persistent dungeon matchmaking and group lifecycle operations', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'realm-token';
  await api.dungeonCatalog();
  await api.joinDungeonQueue('character-1', 'map-instance-01', 'tank');
  await api.dungeonQueueStatus('character-1');
  await api.leaveDungeonQueue('character-1');
  await api.dungeonGroup('group-1');
  await api.startDungeonGroup('group-1');
  await api.completeDungeonGroup('group-1');
  assert.deepEqual(calls.map(call => [call.url, call.options.method || 'GET']), [
    ['https://realm.example.test/api/dungeons/catalog', 'GET'],
    ['https://realm.example.test/api/dungeons/queue', 'POST'],
    ['https://realm.example.test/api/dungeons/queue/character-1', 'GET'],
    ['https://realm.example.test/api/dungeons/queue/character-1', 'DELETE'],
    ['https://realm.example.test/api/dungeons/groups/group-1', 'GET'],
    ['https://realm.example.test/api/dungeons/groups/group-1/start', 'POST'],
    ['https://realm.example.test/api/dungeons/groups/group-1/complete', 'POST']
  ]);
  assert.equal(calls[0].options.headers.authorization, undefined);
  assert.equal(calls[1].options.headers.authorization, 'Bearer realm-token');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    characterId: 'character-1', dungeonId: 'map-instance-01', role: 'tank'
  });
});
