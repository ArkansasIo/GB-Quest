import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handleCollectionRequest } = require('../backend/mmorpg-collection-routes.cjs');

const characterId = '11111111-1111-4111-8111-111111111111';
function harness({ state = null, body = {}, method = 'GET', path = '/collections' } = {}) {
  const calls = [];
  const response = { status: 200, body: null };
  const res = { writeHead(status) { response.status = status; }, end(value) { response.body = JSON.parse(value); } };
  const tx = { query: async (sql, args) => {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT id FROM characters')) return { rowCount: 1, rows: [{ id: characterId }] };
    if (sql.startsWith('SELECT state FROM character_collections')) return { rowCount: state ? 1 : 0, rows: state ? [{ state }] : [] };
    return { rowCount: 1, rows: [] };
  }, release() {} };
  const pool = {
    query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT id FROM characters')) return { rowCount: 1, rows: [{ id: characterId }] };
      if (sql.startsWith('SELECT state FROM character_collections')) return { rowCount: state ? 1 : 0, rows: state ? [{ state }] : [] };
      return { rowCount: 0, rows: [] };
    },
    connect: async () => tx
  };
  return {
    calls, response, res, pool, req: { method },
    url: new URL('https://game.test/api/characters/' + characterId + '/collections' + path),
    accountFor: async () => ({ id: 'account-1' }),
    readBody: async () => body,
    json(responseObject, status, data) {
      responseObject.writeHead(status, { 'content-type': 'application/json' });
      responseObject.end(JSON.stringify(data));
    }
  };
}

test('collection endpoint returns an empty, stable collection state for a new character', async () => {
  const h = harness();
  assert.equal(await handleCollectionRequest(h), true);
  assert.equal(h.response.status, 200);
  assert.deepEqual(h.response.body.collections.mounts, []);
  assert.equal(h.response.body.collections.points, 0);
});

test('collection activation persists only entries already owned by the character', async () => {
  const h = harness({
    method: 'POST', path: '/activate',
    body: { category: 'mounts', entryId: 'mount:warhorse' },
    state: { mounts: ['mount:warhorse'], pets: [], titles: [], appearances: [], achievements: [], points: 0 }
  });
  assert.equal(await handleCollectionRequest(h), true);
  assert.equal(h.response.status, 200);
  assert.deepEqual(h.response.body.active, { category: 'mounts', entryId: 'mount:warhorse' });
  assert.ok(h.calls.some(call => call.sql.includes('INSERT INTO character_collections')));
});

test('collection activation rejects an entry that is not unlocked', async () => {
  const h = harness({ method: 'POST', path: '/activate', body: { category: 'mounts', entryId: 'mount:locked' } });
  assert.equal(await handleCollectionRequest(h), true);
  assert.equal(h.response.status, 409);
  assert.equal(h.response.body.error, 'collection_entry_not_unlocked');
});
