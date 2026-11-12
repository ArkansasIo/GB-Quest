import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadAccountGateway(fetchImpl) {
  const window = { CLASSES: { warden: { role: 'tank' }, arcanist: { role: 'caster' } } };
  vm.runInNewContext(fs.readFileSync(new URL('../client/mmorpg-account.js', import.meta.url), 'utf8'), {
    window, fetch: fetchImpl, location: { origin: 'https://game.example.test' }, document: {}
  });
  return window.GBQMMOAccount;
}

test('online character creation sends the selected realm and the hero\'s job', async () => {
  const calls = [];
  const api = loadAccountGateway(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 201, json: async () => ({
      character: { id: 'char-1', name: 'Aelwyn', class: 'warden', realm_id: 'ardenhold' }
    }) };
  });
  const character = await api.createCharacter({
    baseUrl: 'https://realm.example.test', token: 'session-token',
    account: { id: 'account-1', username: 'HeroOne' },
    realm: { id: 'ardenhold', name: 'Ardenhold' }
  }, 'Aelwyn', 'warden');
  assert.equal(character.id, 'char-1');
  assert.equal(calls[0].url, 'https://realm.example.test/api/characters');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer session-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    name: 'Aelwyn', class: 'warden', realmId: 'ardenhold'
  });
});

test('an older realm server that only knows legacy classes gets the closest one', async () => {
  const bodies = [];
  const api = loadAccountGateway(async (_url, options) => {
    const body = JSON.parse(options.body); bodies.push(body);
    if (body.class === 'arcanist') return { ok: false, status: 400, json: async () => ({ error: 'invalid_character' }) };
    return { ok: true, status: 201, json: async () => ({ character: { id: 'char-2', name: 'Aelwyn', class: body.class } }) };
  });
  const character = await api.createCharacter({ baseUrl: 'https://old.example.test', token: 't', account: { id: 'a' }, realm: { id: 'ardenhold' } }, 'Aelwyn', 'arcanist');
  assert.deepEqual(bodies.map(b => b.class), ['arcanist', 'mage']);
  assert.equal(character.class, 'mage');
});

test('online character creation sends caster jobs as themselves and preserves server validation errors', async () => {
  let body;
  const api = loadAccountGateway(async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: false, status: 409, json: async () => ({ error: 'name_taken' }) };
  });
  await assert.rejects(api.createCharacter({
    baseUrl: 'https://realm.example.test', token: 'token',
    account: { id: 'account-1', username: 'HeroOne' },
    realm: { id: 'moonfall', name: 'Moonfall' }
  }, 'Aelwyn', 'arcanist'), error => error.status === 409 && error.code === 'name_taken');
  assert.equal(body.class, 'arcanist');
  assert.equal(body.realmId, 'moonfall');
});

test('online character creation refuses to run without an authenticated realm session', async () => {
  const api = loadAccountGateway(async () => { throw new Error('fetch should not run'); });
  await assert.rejects(api.createCharacter(null, 'Aelwyn', 'warden'), /Sign in and select a realm/);
});
