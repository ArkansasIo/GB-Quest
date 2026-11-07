import test from 'node:test';
import assert from 'node:assert/strict';
import { GBQuestMMOApi } from '../src/mmorpg/net/mmorpg-api.js';

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
  const api = new GBQuestMMOApi({
    baseUrl: 'https://realm.example.test',
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })
  });
  api.token = 'invalid';
  await assert.rejects(api.me(), error => error.status === 401 && error.code === 'unauthorized');
});
