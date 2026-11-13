'use strict';
const crypto = require('node:crypto');
const SEASONS = new Set(['emberfall', 'frostwake', 'greentide', 'suncrown']);
const OBJECTIVES = Object.freeze(Array.from({ length: 12 }, (_, i) => Object.freeze({
  id: 'chapter_' + (i + 1),
  target: [60, 8, 2, 5, 1, 1, 2, 12, 2, 250, 6, 3][i],
  reward: Object.freeze({ tokens: 30 + i * 5, renown: 100 + i * 25, gold: 200 + i * 50 })
})));
const BY_ID = new Map(OBJECTIVES.map(item => [item.id, item]));
function currentSeasonId(date = new Date()) {
  const suffix = ['emberfall', 'frostwake', 'greentide', 'suncrown'][Math.floor(date.getUTCMonth() / 3)];
  return 'Y' + date.getUTCFullYear() + '_' + suffix;
}
async function recordSeasonProgress(db, characterId, seasonId, objectiveId, amount = 1) {
  const objective = BY_ID.get(objectiveId);
  if (!objective || !validSeasonId(seasonId) || !Number.isSafeInteger(amount) || amount < 1 || amount > 10000) {
    throw new TypeError('invalid_authoritative_season_progress');
  }
  const result = await db.query(
    'INSERT INTO character_season_objectives(character_id,season_id,objective_id,progress,target) ' +
    'VALUES($1,$2,$3,LEAST($4::integer,$5::integer),$5::integer) ' +
    'ON CONFLICT(character_id,season_id,objective_id) DO UPDATE ' +
    'SET progress=LEAST(character_season_objectives.target,character_season_objectives.progress+EXCLUDED.progress),updated_at=now() ' +
    'RETURNING progress,target',
    [characterId, seasonId, objectiveId, amount, objective.target]
  );
  return { progress: Number(result.rows[0].progress), target: Number(result.rows[0].target) };
}
function validSeasonId(value) {
  const match = typeof value === 'string' && /^Y(\d{4})_([a-z]+)$/.exec(value);
  return Boolean(match && Number(match[1]) >= 2020 && Number(match[1]) <= 2200 && SEASONS.has(match[2]));
}
function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function handleSeasonRequest({ req, res, url, pool, accountFor, readBody, json, internalSecret = '' }) {
  const match = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/season(?:\/(progress|claim))?$/i);
  if (!match) return false;
  const characterId = match[1], action = match[2] || '';
  if (action === 'progress') {
    if (req.method !== 'POST') { json(res, 405, { error: 'method_not_allowed' }); return true; }
    if (!safeEqual(req.headers['x-gbq-internal-secret'], internalSecret)) {
      json(res, 403, { error: 'internal_auth_required' }); return true;
    }
    const body = await readBody(req);
    const seasonId = String(body.seasonId || ''), objectiveId = String(body.objectiveId || '');
    const amount = body.amount === undefined ? 1 : body.amount, objective = BY_ID.get(objectiveId);
    if (!validSeasonId(seasonId) || !objective || !Number.isSafeInteger(amount) || amount < 1 || amount > 10000) {
      json(res, 400, { error: 'invalid_season_progress' }); return true;
    }
    const owned = await pool.query('SELECT id FROM characters WHERE id=$1', [characterId]);
    if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    const result = await recordSeasonProgress(pool, characterId, seasonId, objectiveId, amount);
    json(res, 200, { characterId, seasonId, objectiveId, progress: result.progress, target: result.target });
    return true;
  }

  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }
  if (req.method === 'GET' && !action) {
    const seasonId = String(url.searchParams.get('seasonId') || '');
    if (!validSeasonId(seasonId)) { json(res, 400, { error: 'invalid_season_id' }); return true; }
    const owned = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
    if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    const [wallet, progress] = await Promise.all([
      pool.query('SELECT tokens,renown FROM character_season_wallets WHERE character_id=$1 AND season_id=$2', [characterId, seasonId]),
      pool.query('SELECT objective_id,progress,target,claimed_at FROM character_season_objectives WHERE character_id=$1 AND season_id=$2', [characterId, seasonId])
    ]);
    const rows = new Map(progress.rows.map(row => [row.objective_id, row]));
    json(res, 200, {
      characterId, seasonId,
      wallet: wallet.rowCount ? { tokens: Number(wallet.rows[0].tokens), renown: Number(wallet.rows[0].renown) } : { tokens: 0, renown: 0 },
      objectives: OBJECTIVES.map(item => {
        const row = rows.get(item.id);
        return { id: item.id, target: item.target, progress: row ? Number(row.progress) : 0, claimed: Boolean(row && row.claimed_at), reward: item.reward };
      })
    });
    return true;
  }
  if (req.method === 'POST' && action === 'claim') {
    const body = await readBody(req);
    const seasonId = String(body.seasonId || ''), objectiveId = String(body.objectiveId || ''), objective = BY_ID.get(objectiveId);
    if (!validSeasonId(seasonId) || !objective) { json(res, 400, { error: 'invalid_season_reward' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owned = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, account.id]);
      if (!owned.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const current = await tx.query(
        'SELECT progress,target,claimed_at FROM character_season_objectives WHERE character_id=$1 AND season_id=$2 AND objective_id=$3 FOR UPDATE',
        [characterId, seasonId, objectiveId]
      );
      if (!current.rowCount || Number(current.rows[0].progress) < objective.target) {
        await tx.query('ROLLBACK'); json(res, 409, { error: 'season_objective_incomplete' }); return true;
      }
      if (current.rows[0].claimed_at) {
        await tx.query('ROLLBACK'); json(res, 409, { error: 'season_reward_already_claimed' }); return true;
      }
      await tx.query('UPDATE character_season_objectives SET claimed_at=now(),updated_at=now() WHERE character_id=$1 AND season_id=$2 AND objective_id=$3',
        [characterId, seasonId, objectiveId]);
      const reward = objective.reward;
      const wallet = await tx.query(
        'INSERT INTO character_season_wallets(character_id,season_id,tokens,renown) VALUES($1,$2,$3,$4) ' +
        'ON CONFLICT(character_id,season_id) DO UPDATE SET tokens=character_season_wallets.tokens+EXCLUDED.tokens,' +
        'renown=character_season_wallets.renown+EXCLUDED.renown,updated_at=now() RETURNING tokens,renown',
        [characterId, seasonId, reward.tokens, reward.renown]
      );
      await tx.query('UPDATE characters SET gold=gold+$1,updated_at=now() WHERE id=$2', [reward.gold, characterId]);
      await tx.query('COMMIT');
      json(res, 200, { characterId, seasonId, objectiveId, reward,
        wallet: { tokens: Number(wallet.rows[0].tokens), renown: Number(wallet.rows[0].renown) } });
      return true;
    } catch (error) {
      await tx.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { tx.release(); }
  }
  json(res, 405, { error: 'method_not_allowed' });
  return true;
}
module.exports = { handleSeasonRequest, OBJECTIVES, validSeasonId, currentSeasonId, recordSeasonProgress };
