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
      : { character: { id: 'char-1', name: 'Aelwyn', class: 'ranger' } };
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

test('MMORPG API exposes realm discovery and supports selecting a realm at character creation', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ regions: [], realms: [], character: { id: 'char-2' } }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'realm-token';
  await api.regions();
  await api.realms();
  await api.realms('hydaelyn');
  await api.createCharacter('Aelwyn', 'ranger', 'ardenhold');
  assert.deepEqual(calls.map(call => call.url), [
    'https://realm.example.test/api/regions',
    'https://realm.example.test/api/realms',
    'https://realm.example.test/api/realms?region=hydaelyn',
    'https://realm.example.test/api/characters'
  ]);
  assert.deepEqual(JSON.parse(calls[3].options.body), {
    name: 'Aelwyn', class: 'ranger', realmId: 'ardenhold'
  });
  assert.equal(calls[0].options.headers.authorization, 'Bearer realm-token');
});

test('MMORPG API exposes world population and capacity dashboard data', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ onlinePlayers: 12, capacity: 9000, regions: [], zones: [] }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'realm-token';
  const status = await api.worldStatus();
  await api.worldStatus({ refresh: true });
  assert.equal(status.capacity, 9000);
  assert.deepEqual(calls.map(call => call.url), [
    'https://realm.example.test/api/world/status',
    'https://realm.example.test/api/world/status?refresh=1'
  ]);
});

test('MMORPG API retrieves authenticated realm and zone chat history', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ channel: 'zone', messages: [] }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'chat-session-token';
  await api.chatHistory('character-1');
  await api.chatHistory('character-1', 'realm', 25);
  assert.deepEqual(calls.map(call => call.url), [
    'https://realm.example.test/api/characters/character-1/chat?channel=zone&limit=50',
    'https://realm.example.test/api/characters/character-1/chat?channel=realm&limit=25'
  ]);
  assert.equal(calls[0].options.headers.authorization, 'Bearer chat-session-token');
});

test('MMORPG API exposes opt-in reconnect and remembers the selected character', () => {
  class FakeSocket {
    constructor(url) { this.url = url; this.handlers = {}; this.readyState = 0; this.sent = []; }
    addEventListener(name, callback) { this.handlers[name] = callback; }
    emit(name, value) { this.handlers[name]?.(value); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
  }
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    WebSocketImpl: FakeSocket,
    autoReconnect: true,
    reconnectDelayMs: 25,
    maxReconnectDelayMs: 500
  });
  api.token = 'session-token';
  api.connect();
  const socket = api.multiplayer.socket;
  socket.readyState = 1;
  socket.emit('open');
  assert.equal(socket.sent[0].type, 'authenticate');
  socket.emit('message', { data: JSON.stringify({ type: 'authenticated', sequence: 1, payload: {} }) });
  const characterId = '11111111-1111-4111-8111-111111111111';
  api.selectCharacter(characterId);
  assert.equal(socket.sent[1].type, 'character.select');
  assert.equal(api.multiplayer.selectedCharacterId, characterId);
  api.logout();
});

test('MMORPG API exposes party role assignment and guild rank management', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ updated: true }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'social-session-token';
  await api.setPartyRole('party-1', 'leader-1', 'member-2', 'healer');
  await api.setGuildMemberRank('guild-1', 'leader-1', 'member-2', 'officer');
  assert.deepEqual(calls.map(call => call.url), [
    'https://realm.example.test/api/parties/party-1/members/member-2/role',
    'https://realm.example.test/api/guilds/guild-1/members/member-2/rank'
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.body), { actorCharacterId: 'leader-1', role: 'healer' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { actorCharacterId: 'leader-1', rank: 'officer' });
  assert.equal(calls[0].options.headers.authorization, 'Bearer social-session-token');
});


test('recoverSession restores durable panels in parallel and preserves partial successes', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/inventory')) return { ok: false, status: 503, json: async () => ({ error: 'inventory_unavailable' }) };
      return { ok: true, status: 200, json: async () => ({ endpoint: url }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'recovery-token';
  const result = await api.recoverSession('char-1', { chatLimit: 20 });
  assert.equal(calls.length, 13);
  assert.equal(result.characterId, 'char-1');
  assert.equal(result.resources.profile.endpoint, 'https://realm.example.test/api/characters/char-1/profile');
  assert.equal(result.resources.inventory, undefined);
  assert.equal(result.resources.party.endpoint, 'https://realm.example.test/api/characters/char-1/party');
  assert.equal(result.resources.raidGroup.endpoint, 'https://realm.example.test/api/characters/char-1/raid-group');
  assert.equal(result.resources.zoneChat.endpoint, 'https://realm.example.test/api/characters/char-1/chat?channel=zone&limit=20');
  assert.deepEqual(result.errors, [{ resource: 'inventory', message: 'inventory_unavailable', status: 503 }]);
  assert.ok(calls.every(call => call.options.headers.authorization === 'Bearer recovery-token'));
});

test('recoverSession validates character ID before issuing requests', async () => {
  const api = new GBQuestMMOApi({ baseUrl: 'https://realm.example.test', fetchImpl: async () => { throw new Error('should_not_fetch'); } });
  await assert.rejects(api.recoverSession('  '), TypeError);
});


test('MMORPG API exposes persistent raid group operations', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => { calls.push({url,options}); return {ok:true,status:200,json:async()=>({raid:{id:'raid-1'}})}; },
    WebSocketImpl: class {}
  });
  api.token='raid-token';
  await api.createRaidGroup('char-1',{name:'Nightfall',raidSize:20});
  await api.raidGroup('char-1');
  await api.inviteToRaid('raid-1','char-1','char-2');
  await api.acceptRaidInvite('invite-1','char-2');
  await api.setRaidRole('raid-1','char-1','char-2','healer');
  await api.transferRaidLeadership('raid-1','char-1','char-2');
  await api.leaveRaid('char-2');
  await api.disbandRaid('raid-1','char-2');
  assert.deepEqual(calls.map(x=>x.url),[
    'https://realm.example.test/api/characters/char-1/raid-group',
    'https://realm.example.test/api/characters/char-1/raid-group',
    'https://realm.example.test/api/raids/raid-1/invites',
    'https://realm.example.test/api/raid-invites/invite-1/accept',
    'https://realm.example.test/api/raids/raid-1/members/char-2/role',
    'https://realm.example.test/api/raids/raid-1/transfer',
    'https://realm.example.test/api/characters/char-2/raid-group',
    'https://realm.example.test/api/raids/raid-1?characterId=char-2'
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.body),{name:'Nightfall',raidSize:20});
  assert.equal(calls[0].options.headers.authorization,'Bearer raid-token');
});

test('MMORPG API loads persistent character profile and allocates server-owned attributes', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({
        character: { id: 'char-1', level: 3, talent_points: 2 },
        inventory: [], quests: [], equipment: [],
        talentPoints: 1, allocatedAttributes: { str: 1 }
      }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'progression-token';
  const profile = await api.characterProfile('char-1');
  const allocation = await api.allocateAttribute('char-1', 'str', 1);
  assert.equal(profile.character.id, 'char-1');
  assert.equal(allocation.talentPoints, 1);
  assert.deepEqual(calls.map(call => call.url), [
    'https://realm.example.test/api/characters/char-1/profile',
    'https://realm.example.test/api/characters/char-1/attributes'
  ]);
  assert.deepEqual(JSON.parse(calls[1].options.body), { attribute: 'str', points: 1 });
  assert.ok(calls.every(call => call.options.headers.authorization === 'Bearer progression-token'));
});

test('MMORPG API exposes class talent trees, specialization choice and node unlocks', async () => {
  const calls = [];
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ specializations: [], unlocked: 'ranger_hunter_node_00' }) };
    },
    WebSocketImpl: class {}
  });
  api.token = 'talent-session-token';
  await api.talentTrees('ranger');
  await api.chooseSpecialization('char-1', 'ranger_hunter');
  await api.unlockTalent('char-1', 'ranger_hunter_node_00');
  assert.deepEqual(calls.map(call => call.url), [
    'https://realm.example.test/api/talents?class=ranger',
    'https://realm.example.test/api/characters/char-1/specialization',
    'https://realm.example.test/api/characters/char-1/talents/ranger_hunter_node_00/unlock'
  ]);
  assert.deepEqual(JSON.parse(calls[1].options.body), { specializationId: 'ranger_hunter' });
  assert.deepEqual(JSON.parse(calls[2].options.body), {});
  assert.ok(calls.every(call => call.options.headers.authorization === 'Bearer talent-session-token'));
});
