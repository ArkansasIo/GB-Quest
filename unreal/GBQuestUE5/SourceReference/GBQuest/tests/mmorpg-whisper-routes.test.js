import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handleWhisperRequest } = require('../backend/mmorpg-whisper-routes.cjs');

function harness({ owned = true, peer = true } = {}) {
  const calls = [];
  const pool = { query: async (sql, args) => {
    calls.push({ sql, args });
    if (sql.includes('SELECT id,realm_id FROM characters')) return { rowCount: owned ? 1 : 0, rows: owned ? [{ id:'sender', realm_id:'moonfall' }] : [] };
    if (sql.includes('SELECT id FROM characters')) return { rowCount: peer ? 1 : 0, rows: peer ? [{ id:'peer' }] : [] };
    if (sql.includes('SELECT id, sender_character_id')) return { rowCount: 1, rows: [{ id:'m1', senderCharacterId:'peer', recipientCharacterId:'sender', message:'hello', createdAt:new Date(), readAt:null }] };
    return { rowCount: 0, rows: [] };
  }};
  const response = { status: 200, body: null };
  const res = { writeHead(status) { response.status = status; }, end(body) { response.body = JSON.parse(body); } };
  const accountFor = async () => ({ id:'account-1' });
  const req = { method:'GET' };
  const url = new URL('https://game.test/api/characters/11111111-1111-4111-8111-111111111111/whispers?with=22222222-2222-4222-8222-222222222222');
  return { calls, response, pool, res, req, url, accountFor };
}

test('whisper history is account-owned and constrained to the same realm', async () => {
  const h = harness();
  assert.equal(await handleWhisperRequest(h), true);
  assert.equal(h.response.status, 200);
  assert.equal(h.response.body.messages[0].message, 'hello');
  assert.equal(h.calls.length, 4);
  assert.match(h.calls[1].sql, /realm_id/);
  assert.match(h.calls[2].sql, /read_at IS NULL/);
});

test('whisper history rejects characters outside the account', async () => {
  const h = harness({ owned:false });
  await handleWhisperRequest(h);
  assert.equal(h.response.status, 404);
  assert.equal(h.response.body.error, 'character_not_found');
});

test('whisper history rejects peers outside the selected realm', async () => {
  const h = harness({ peer:false });
  await handleWhisperRequest(h);
  assert.equal(h.response.status, 404);
  assert.equal(h.response.body.error, 'same_realm_character_not_found');
});
