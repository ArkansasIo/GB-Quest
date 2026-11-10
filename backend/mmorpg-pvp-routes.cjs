'use strict';
const crypto = require('node:crypto');
const UUID = /^[0-9a-f-]{36}$/i;
function calculateEloDelta(ratingA, ratingB, scoreA, k = 32) {
  if (![ratingA, ratingB, scoreA, k].every(Number.isFinite) || ratingA < 0 || ratingB < 0 || ![0, 1].includes(scoreA) || k <= 0) throw new TypeError('invalid_elo_input');
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const deltaA = Math.round(k * (scoreA - expectedA));
  return { deltaA, deltaB: -deltaA };
}

async function handlePvpRequest({ req, res, url, pool, accountFor, readBody, json }) {
  const challenges = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/pvp-challenges$/i);
  const accept = url.pathname.match(/^\/api\/pvp-matches\/([0-9a-f-]{36})\/accept$/i);
  const decline = url.pathname.match(/^\/api\/pvp-matches\/([0-9a-f-]{36})\/decline$/i);
  const cancel = url.pathname.match(/^\/api\/pvp-matches\/([0-9a-f-]{36})\/cancel$/i);
  const forfeit = url.pathname.match(/^\/api\/pvp-matches\/([0-9a-f-]{36})\/forfeit$/i);
  const matchView = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/pvp-matches$/i);
  if (!challenges && !accept && !decline && !cancel && !matchView && !forfeit) return false;
  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (matchView && req.method === 'GET') {
    await pool.query("UPDATE pvp_matches SET status='cancelled',ended_at=now() WHERE status='queued' AND created_at<=now()-interval '2 minutes'");
    const characterId = matchView[1];
    const owner = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
    if (!owner.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    const result = await pool.query(`SELECT id,realm_id,mode,status,team_a,team_b,rating_delta,started_at,ended_at,created_at
      FROM pvp_matches WHERE (team_a @> $1::jsonb OR team_b @> $1::jsonb)
      ORDER BY created_at DESC LIMIT 50`, [JSON.stringify([characterId])]);
    json(res, 200, { matches: result.rows.map(row => ({ id: row.id, realmId: row.realm_id, mode: row.mode, status: row.status, teamA: row.team_a, teamB: row.team_b, ratingDelta: row.rating_delta, startedAt: row.started_at, endedAt: row.ended_at, createdAt: row.created_at })) });
    return true;
  }

  if (challenges && req.method === 'POST') {
    const challengerId = challenges[1], body = await readBody(req), targetId = String(body.targetCharacterId || '');
    if (!UUID.test(targetId) || targetId === challengerId) { json(res, 400, { error: 'invalid_pvp_target' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await tx.query("UPDATE pvp_matches SET status='cancelled',ended_at=now() WHERE status='queued' AND created_at<=now()-interval '2 minutes'");
      const players = await tx.query('SELECT id,realm_id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[challengerId, targetId]]);
      const challenger = players.rows.find(row => row.id === challengerId), target = players.rows.find(row => row.id === targetId);
      const owner = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [challengerId, account.id]);
      if (!challenger || !owner.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'challenger_not_found' }); return true; }
      if (!target) { await tx.query('ROLLBACK'); json(res, 404, { error: 'target_not_found' }); return true; }
      if (challenger.realm_id !== target.realm_id) { await tx.query('ROLLBACK'); json(res, 409, { error: 'cross_realm_pvp' }); return true; }
      const blocked = await tx.query("SELECT 1 FROM player_friends WHERE status='blocked' AND ((character_id=$1 AND friend_character_id=$2) OR (character_id=$2 AND friend_character_id=$1))", [challengerId, targetId]);
      if (blocked.rowCount) { await tx.query('ROLLBACK'); json(res, 403, { error: 'pvp_blocked' }); return true; }
      const busy = await tx.query(`SELECT id FROM pvp_matches WHERE status IN ('queued','active')
        AND (team_a @> $1::jsonb OR team_b @> $1::jsonb OR team_a @> $2::jsonb OR team_b @> $2::jsonb)
        LIMIT 1`, [JSON.stringify([challengerId]), JSON.stringify([targetId])]);
      if (busy.rowCount) { await tx.query('ROLLBACK'); json(res, 409, { error: 'player_already_in_pvp_match' }); return true; }
      const id = crypto.randomUUID();
      await tx.query("INSERT INTO pvp_matches(id,realm_id,mode,status,team_a,team_b) VALUES($1,$2,'duel','queued',$3::jsonb,$4::jsonb)", [id, challenger.realm_id, JSON.stringify([challengerId]), JSON.stringify([targetId])]);
      await tx.query('COMMIT'); json(res, 201, { challenge: { id, mode: 'duel', status: 'queued', challengerCharacterId: challengerId, targetCharacterId: targetId, expiresInSeconds: 120 } }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if ((accept || decline) && req.method === 'POST') {
    const matchId = (accept || decline)[1], body = await readBody(req), characterId = String(body.characterId || '');
    if (!UUID.test(characterId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owner = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, account.id]);
      if (!owner.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const match = await tx.query("SELECT * FROM pvp_matches WHERE id=$1 AND mode='duel' AND status='queued' AND created_at>now()-interval '2 minutes' FOR UPDATE", [matchId]);
      if (!match.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'pvp_challenge_unavailable' }); return true; }
      const row = match.rows[0], challenger = row.team_a?.[0], target = row.team_b?.[0];
      if (accept && target !== characterId) { await tx.query('ROLLBACK'); json(res, 403, { error: 'pvp_challenge_target_required' }); return true; }
      if (decline && target !== characterId && challenger !== characterId) { await tx.query('ROLLBACK'); json(res, 403, { error: 'pvp_challenge_participant_required' }); return true; }
      const status = accept ? 'active' : 'cancelled';
      const updated = await tx.query('UPDATE pvp_matches SET status=$1,started_at=CASE WHEN $1=\'active\' THEN now() ELSE NULL END,ended_at=CASE WHEN $1=\'cancelled\' THEN now() ELSE NULL END WHERE id=$2 RETURNING id,status,started_at,ended_at', [status, matchId]);
      await tx.query('COMMIT'); json(res, 200, { match: updated.rows[0] }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (cancel && req.method === 'POST') {
    const matchId = cancel[1], body = await readBody(req), characterId = String(body.characterId || '');
    if (!UUID.test(characterId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const result = await pool.query(`UPDATE pvp_matches p SET status='cancelled',ended_at=now()
      WHERE p.id=$1 AND p.status='queued'
      AND (p.team_a @> $2::jsonb OR p.team_b @> $2::jsonb)
      AND EXISTS (SELECT 1 FROM characters c WHERE c.id=$3 AND c.account_id=$4)
      RETURNING p.id,p.status,p.ended_at`, [matchId, JSON.stringify([characterId]), characterId, account.id]);
    if (!result.rowCount) { json(res, 404, { error: 'pvp_challenge_not_cancellable' }); return true; }
    json(res, 200, { match: result.rows[0] }); return true;
  }


  if (forfeit && req.method === 'POST') {
    const matchId = forfeit[1], body = await readBody(req), characterId = String(body.characterId || '');
    if (!UUID.test(characterId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owner = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
      if (!owner.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const match = await tx.query("SELECT * FROM pvp_matches WHERE id=$1 AND mode='duel' AND status='active' FOR UPDATE", [matchId]);
      if (!match.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'active_duel_not_found' }); return true; }
      const row = match.rows[0], teamA = row.team_a?.[0], teamB = row.team_b?.[0];
      if (characterId !== teamA && characterId !== teamB) { await tx.query('ROLLBACK'); json(res, 403, { error: 'pvp_participant_required' }); return true; }
      const winner = characterId === teamA ? teamB : teamA;
      const players = [teamA, teamB].sort();
      for (const id of players) await tx.query("INSERT INTO pvp_ratings(character_id,bracket) VALUES($1,'duel') ON CONFLICT DO NOTHING", [id]);
      const ratings = await tx.query("SELECT character_id,rating FROM pvp_ratings WHERE bracket='duel' AND character_id=ANY($1::uuid[]) ORDER BY character_id FOR UPDATE", [players]);
      if (ratings.rowCount !== 2) { await tx.query('ROLLBACK'); json(res, 409, { error: 'pvp_rating_state_invalid' }); return true; }
      const ra = Number(ratings.rows.find(x => x.character_id === teamA).rating);
      const rb = Number(ratings.rows.find(x => x.character_id === teamB).rating);
      const teamAWon = characterId === teamB;
      const { deltaA, deltaB } = calculateEloDelta(ra, rb, teamAWon ? 1 : 0);
      const deltas = { [teamA]: deltaA, [teamB]: deltaB };
      await tx.query("UPDATE pvp_ratings SET rating=GREATEST(0,rating+$1),wins=wins+$2,losses=losses+$3,updated_at=now() WHERE character_id=$4 AND bracket='duel'", [deltaA, teamAWon ? 1 : 0, teamAWon ? 0 : 1, teamA]);
      await tx.query("UPDATE pvp_ratings SET rating=GREATEST(0,rating+$1),wins=wins+$2,losses=losses+$3,updated_at=now() WHERE character_id=$4 AND bracket='duel'", [deltaB, teamAWon ? 0 : 1, teamAWon ? 1 : 0, teamB]);
      await tx.query("UPDATE pvp_matches SET status='completed',ended_at=now(),rating_delta=$1::jsonb WHERE id=$2", [JSON.stringify(deltas), matchId]);
      await tx.query('COMMIT'); json(res, 200, { completed: true, matchId, winnerCharacterId: winner, ratingDelta: deltas }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  json(res, 405, { error: 'method_not_allowed' }); return true;
}
module.exports = { handlePvpRequest, calculateEloDelta };
