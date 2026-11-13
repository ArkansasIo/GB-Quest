import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handleSeasonRequest, validSeasonId, seasonalObjectivesForMobRank } = require('../backend/mmorpg-season-routes.cjs');
const characterId = '11111111-1111-4111-8111-111111111111';

function harness({ method = 'GET', action = '', body = {}, progress = null, claimedAt = null, secret = 'internal-test-secret' } = {}) {
  const response = { status: 200, body: null }, calls = [];
  const tx = { query: async (sql, args) => {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT id FROM characters')) return { rowCount: 1, rows: [{ id: characterId }] };
    if (sql.startsWith('SELECT progress,target,claimed_at')) return progress === null ? { rowCount: 0, rows: [] } :
      { rowCount: 1, rows: [{ progress, target: 60, claimed_at: claimedAt }] };
    if (sql.includes('RETURNING tokens,renown')) return { rowCount: 1, rows: [{ tokens: 30, renown: 100 }] };
    return { rowCount: 1, rows: [] };
  }, release() {} };
  const pool = {
    query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT id FROM characters')) return { rowCount: 1, rows: [{ id: characterId }] };
      if (sql.startsWith('SELECT tokens,renown')) return { rowCount: 0, rows: [] };
      if (sql.startsWith('SELECT objective_id,progress,target,claimed_at')) return { rowCount: 0, rows: [] };
      if (sql.startsWith('INSERT INTO character_season_objectives')) return { rowCount: 1, rows: [{ progress: 4, target: 60 }] };
      return { rowCount: 1, rows: [] };
    },
    connect: async () => tx
  };
  return {
    calls, response, res: response, pool, req: { method, headers: { 'x-gbq-internal-secret': secret } },
    url: new URL('https://realm.test/api/characters/' + characterId + '/season' + (action ? '/' + action : '')),
    accountFor: async () => ({ id: 'account-1' }), readBody: async () => body,
    json(res, status, data) { res.status = status; res.body = data; },
    internalSecret: 'internal-test-secret'
  };
}

test('season IDs are restricted to known quarterly keys', () => {
  assert.equal(validSeasonId('Y2027_emberfall'), true);
  assert.equal(validSeasonId('Y2027_frostwake'), true);
  assert.equal(validSeasonId('Y2027_unknown'), false);
  assert.equal(validSeasonId('Y1800_emberfall'), false);
  assert.equal(validSeasonId('../emberfall'), false);
});

test('internal progress writes reject an incorrect secret', async () => {
  const h = harness({ method: 'POST', action: 'progress', body: { seasonId: 'Y2027_emberfall', objectiveId: 'chapter_1', amount: 4 }, secret: 'wrong' });
  assert.equal(await handleSeasonRequest(h), true);
  assert.equal(h.response.status, 403);
  assert.equal(h.response.body.error, 'internal_auth_required');
});

test('internal progress is bounded and capped at the server objective target', async () => {
  const h = harness({ method: 'POST', action: 'progress', body: { seasonId: 'Y2027_emberfall', objectiveId: 'chapter_1', amount: 4 } });
  assert.equal(await handleSeasonRequest(h), true);
  assert.equal(h.response.status, 200);
  assert.equal(h.response.body.progress, 4);
  assert.equal(h.response.body.target, 60);
  assert.ok(h.calls.some(call => call.sql.includes('LEAST(character_season_objectives.target')));
});

test('GET returns all server-defined objectives and an empty wallet for a new season', async () => {
  const h = harness(); h.url.searchParams.set('seasonId', 'Y2027_emberfall');
  assert.equal(await handleSeasonRequest(h), true);
  assert.equal(h.response.status, 200);
  assert.equal(h.response.body.wallet.tokens, 0);
  assert.equal(h.response.body.objectives.length, 12);
  assert.equal(h.response.body.objectives[0].target, 60);
});

test('completed objective claims use fixed rewards and one database transaction', async () => {
  const h = harness({ method: 'POST', action: 'claim', body: { seasonId: 'Y2027_emberfall', objectiveId: 'chapter_1', tokens: 999999 }, progress: 60 });
  assert.equal(await handleSeasonRequest(h), true);
  assert.equal(h.response.status, 200);
  assert.deepEqual(h.response.body.reward, { tokens: 30, renown: 100, gold: 200 });
  assert.ok(h.calls.some(call => call.sql === 'BEGIN'));
  assert.ok(h.calls.some(call => call.sql === 'COMMIT'));
  assert.ok(h.calls.some(call => call.sql.startsWith('UPDATE characters SET gold=gold+')));
});

test('incomplete objectives cannot be claimed', async () => {
  const h = harness({ method: 'POST', action: 'claim', body: { seasonId: 'Y2027_emberfall', objectiveId: 'chapter_1' }, progress: 20 });
  assert.equal(await handleSeasonRequest(h), true);
  assert.equal(h.response.status, 409);
  assert.equal(h.response.body.error, 'season_objective_incomplete');
  assert.ok(h.calls.some(call => call.sql === 'ROLLBACK'));
});

test('claimed objectives cannot be claimed twice', async () => {
  const h = harness({ method: 'POST', action: 'claim', body: { seasonId: 'Y2027_emberfall', objectiveId: 'chapter_1' }, progress: 60, claimedAt: '2027-01-01T00:00:00Z' });
  assert.equal(await handleSeasonRequest(h), true);
  assert.equal(h.response.status, 409);
  assert.equal(h.response.body.error, 'season_reward_already_claimed');
});

test('seasonal mob rank mapping does not infer elites or bosses from names or levels', () => {
  assert.deepEqual(seasonalObjectivesForMobRank('normal'), []);
  assert.deepEqual(seasonalObjectivesForMobRank('elite'), ['chapter_2']);
  assert.deepEqual(seasonalObjectivesForMobRank('world_boss'), ['chapter_5','chapter_12']);
  assert.deepEqual(seasonalObjectivesForMobRank('unknown'), []);
});
