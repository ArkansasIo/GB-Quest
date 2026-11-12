import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handleSocialPvpRequest } = require('../backend/mmorpg-social-pvp-routes.cjs');

function response() {
  return { status: 0, body: null, writeHead(status) { this.status = status; }, end(value) { this.body = JSON.parse(value); } };
}
const accountFor = async () => ({ id: 'account-1' });
const json = (res, status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
const readBody = async req => req.body || {};

test('social/PvP router ignores unrelated paths', async () => {
  const res = response();
  const handled = await handleSocialPvpRequest({
    req: { url: '/health', method: 'GET' }, res, pool: {}, accountFor, json, readBody
  });
  assert.equal(handled, false);
});

test('friend request rejects malformed target IDs before opening a transaction', async () => {
  const res = response();
  let connects = 0;
  const handled = await handleSocialPvpRequest({
    req: { url: '/api/characters/11111111-1111-4111-8111-111111111111/friends/request', method: 'POST', body: { targetCharacterId: 'not-a-uuid' } },
    res, pool: { connect: async () => { connects++; throw new Error('must not connect'); } }, accountFor, json, readBody
  });
  assert.equal(handled, true);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_friend_target');
  assert.equal(connects, 0);
});

test('PvP queue rejects malformed character IDs without database writes', async () => {
  const res = response();
  let connects = 0;
  const handled = await handleSocialPvpRequest({
    req: { url: '/api/pvp/queue', method: 'POST', body: { characterId: 'bad-id' } },
    res, pool: { connect: async () => { connects++; throw new Error('must not connect'); } }, accountFor, json, readBody
  });
  assert.equal(handled, true);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_pvp_queue_request');
  assert.equal(connects, 0);
});

test('social/PvP routes require an authenticated account', async () => {
  const res = response();
  const handled = await handleSocialPvpRequest({
    req: { url: '/api/characters/11111111-1111-4111-8111-111111111111/friends', method: 'GET' },
    res, pool: {}, accountFor: async () => null, json, readBody
  });
  assert.equal(handled, true);
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'unauthorized');
});
