'use strict';
const crypto = require('node:crypto');
const { currentSeasonId, recordSeasonProgress } = require('./mmorpg-season-routes.cjs');

const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9_-]{2,48}$/i;
const DIFFICULTIES = new Set(['story', 'normal', 'heroic', 'mythic']);

async function handleInstanceRequest({ req, res, url, pool, accountFor, readBody, json }) {
  const characterRoute = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/instances$/i);
  const instanceLeave = url.pathname.match(/^\/api\/instances\/([0-9a-f-]{36})\/leave$/i);
  const instanceComplete = url.pathname.match(/^\/api\/instances\/([0-9a-f-]{36})\/complete$/i);
  const readyStart = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/ready-checks$/i);
  const readyRespond = url.pathname.match(/^\/api\/ready-checks\/([0-9a-f-]{36})\/respond$/i);
  const readyGet = url.pathname.match(/^\/api\/ready-checks\/([0-9a-f-]{36})$/i);
  if (!characterRoute && !instanceLeave && !instanceComplete && !readyStart && !readyRespond && !readyGet) return false;

  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (characterRoute && req.method === 'GET') {
    const characterId = characterRoute[1];
    const owned = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
    if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    const result = await pool.query(`SELECT i.id,i.dungeon_id,i.difficulty,i.status,i.seed,i.created_at,i.expires_at,
      im.entered_at,im.character_id,c.name AS character_name,c.level
      FROM dungeon_instance_members mine
      JOIN dungeon_instances i ON i.id=mine.instance_id
      JOIN dungeon_instance_members im ON im.instance_id=i.id
      JOIN characters c ON c.id=im.character_id
      WHERE mine.character_id=$1 AND i.status='active' AND i.expires_at>now()
      ORDER BY i.created_at DESC`, [characterId]);
    const first = result.rows[0];
    json(res, 200, { instance: first ? {
      id: first.id, dungeonId: first.dungeon_id, difficulty: first.difficulty, status: first.status,
      seed: Number(first.seed), createdAt: first.created_at, expiresAt: first.expires_at,
      members: result.rows.map(row => ({ characterId: row.character_id, name: row.character_name, level: row.level, enteredAt: row.entered_at }))
    } : null });
    return true;
  }

  if (characterRoute && req.method === 'POST') {
    const characterId = characterRoute[1], body = await readBody(req);
    const dungeonId = String(body.dungeonId || '').trim();
    const difficulty = String(body.difficulty || 'normal');
    if (!SLUG.test(dungeonId) || !DIFFICULTIES.has(difficulty)) { json(res, 400, { error: 'invalid_dungeon_or_difficulty' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const character = await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, account.id]);
      if (!character.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const party = await tx.query('SELECT p.id,p.realm_id,p.leader_character_id FROM party_members pm JOIN parties p ON p.id=pm.party_id WHERE pm.character_id=$1 FOR UPDATE OF p', [characterId]);
      let members = [characterId], partyId = null;
      if (party.rowCount) {
        partyId = party.rows[0].id;
        if (party.rows[0].leader_character_id !== characterId) { await tx.query('ROLLBACK'); json(res, 403, { error: 'party_leader_required' }); return true; }
        const roster = await tx.query('SELECT character_id FROM party_members WHERE party_id=$1 ORDER BY joined_at FOR UPDATE', [partyId]);
        members = roster.rows.map(row => row.character_id);
        if (members.length > 5) { await tx.query('ROLLBACK'); json(res, 409, { error: 'dungeon_party_limit_exceeded' }); return true; }
      }
      const active = await tx.query(`SELECT character_id FROM dungeon_instance_members
        WHERE character_id=ANY($1::uuid[]) AND instance_id IN
          (SELECT id FROM dungeon_instances WHERE status='active' AND expires_at>now()) LIMIT 1`, [members]);
      if (active.rowCount) { await tx.query('ROLLBACK'); json(res, 409, { error: 'member_already_in_instance', characterId: active.rows[0].character_id }); return true; }
      const id = crypto.randomUUID(), seed = crypto.randomInt(1, 2147483647);
      await tx.query(`INSERT INTO dungeon_instances(id,realm_id,dungeon_id,party_id,difficulty,status,seed,expires_at)
        VALUES($1,$2,$3,$4,$5,'active',$6,now()+interval '2 hours')`,
        [id, character.rows[0].realm_id, dungeonId, partyId, difficulty, seed]);
      for (const memberId of members) await tx.query('INSERT INTO dungeon_instance_members(instance_id,character_id) VALUES($1,$2)', [id, memberId]);
      await tx.query('COMMIT');
      json(res, 201, { instance: { id, realmId: character.rows[0].realm_id, dungeonId, partyId, difficulty, seed, status: 'active', memberIds: members, expiresInSeconds: 7200 } });
      return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (instanceLeave && req.method === 'POST') {
    const instanceId = instanceLeave[1], body = await readBody(req), characterId = String(body.characterId || '');
    if (!UUID.test(characterId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owned = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, account.id]);
      if (!owned.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const membership = await tx.query(`SELECT im.instance_id FROM dungeon_instance_members im
        JOIN dungeon_instances i ON i.id=im.instance_id
        WHERE im.instance_id=$1 AND im.character_id=$2 AND i.status='active' FOR UPDATE OF i`, [instanceId, characterId]);
      if (!membership.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'instance_membership_not_found' }); return true; }
      await tx.query('DELETE FROM dungeon_instance_members WHERE instance_id=$1 AND character_id=$2', [instanceId, characterId]);
      await tx.query('COMMIT'); json(res, 200, { left: true, instanceId, characterId }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (instanceComplete && req.method === 'POST') {
    const instanceId = instanceComplete[1], body = await readBody(req);
    const characterId = String(body.characterId || ''), status = String(body.status || 'completed');
    if (!UUID.test(characterId) || !['completed', 'failed', 'closed'].includes(status)) { json(res, 400, { error: 'invalid_completion_request' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const result = await tx.query(`UPDATE dungeon_instances i SET status=$1
        WHERE i.id=$2 AND i.status='active' AND EXISTS (
          SELECT 1 FROM dungeon_instance_members im JOIN characters c ON c.id=im.character_id
          WHERE im.instance_id=i.id AND im.character_id=$3 AND c.account_id=$4
        ) AND (i.party_id IS NULL OR EXISTS (
          SELECT 1 FROM parties p WHERE p.id=i.party_id AND p.leader_character_id=$3
        )) RETURNING i.id,i.status,i.expires_at`, [status, instanceId, characterId, account.id]);
      if (!result.rowCount) { await tx.query('ROLLBACK'); json(res, 403, { error: 'instance_leader_required_or_not_active' }); return true; }
      if (status === 'completed') {
        const members = await tx.query('SELECT character_id FROM dungeon_instance_members WHERE instance_id=$1 ORDER BY character_id', [instanceId]);
        const seasonId = currentSeasonId();
        for (const member of members.rows) {
          await recordSeasonProgress(tx, member.character_id, seasonId, 'chapter_3', 1);
          await recordSeasonProgress(tx, member.character_id, seasonId, 'chapter_11', 1);
        }
      }
      await tx.query('COMMIT');
      json(res, 200, { instance: result.rows[0] }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (readyStart && req.method === 'POST') {
    const characterId = readyStart[1], tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owned = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, account.id]);
      if (!owned.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const party = await tx.query('SELECT p.id,p.leader_character_id FROM party_members pm JOIN parties p ON p.id=pm.party_id WHERE pm.character_id=$1 FOR UPDATE OF p', [characterId]);
      if (!party.rowCount) { await tx.query('ROLLBACK'); json(res, 409, { error: 'party_required' }); return true; }
      if (party.rows[0].leader_character_id !== characterId) { await tx.query('ROLLBACK'); json(res, 403, { error: 'party_leader_required' }); return true; }
      const id = crypto.randomUUID();
      await tx.query("INSERT INTO ready_checks(id,party_id,started_by,expires_at) VALUES($1,$2,$3,now()+interval '30 seconds')", [id, party.rows[0].id, characterId]);
      await tx.query('COMMIT'); json(res, 201, { readyCheck: { id, partyId: party.rows[0].id, expiresInSeconds: 30 } }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (readyGet && req.method === 'GET') {
    const viewerId = String(url.searchParams.get('characterId') || '');
    if (!UUID.test(viewerId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const result = await pool.query(`SELECT rc.id,rc.party_id,rc.started_by,rc.expires_at,pm.character_id,c.name,
      COALESCE(rr.ready,false) AS ready,rr.responded_at
      FROM ready_checks rc JOIN party_members pm ON pm.party_id=rc.party_id
      JOIN characters c ON c.id=pm.character_id
      LEFT JOIN ready_check_responses rr ON rr.ready_check_id=rc.id AND rr.character_id=pm.character_id
      JOIN characters owner ON owner.id=$2 AND owner.account_id=$3
      WHERE rc.id=$1 AND EXISTS (SELECT 1 FROM party_members mine WHERE mine.party_id=rc.party_id AND mine.character_id=$2)
      ORDER BY pm.joined_at`, [readyGet[1], viewerId, account.id]);
    if (!result.rowCount) { json(res, 404, { error: 'ready_check_not_found' }); return true; }
    const first = result.rows[0];
    json(res, 200, { readyCheck: { id: first.id, partyId: first.party_id, startedBy: first.started_by, expiresAt: first.expires_at,
      members: result.rows.map(row => ({ characterId: row.character_id, name: row.name, ready: row.ready, respondedAt: row.responded_at })) } });
    return true;
  }

  if (readyRespond && req.method === 'POST') {
    const id = readyRespond[1], body = await readBody(req), characterId = String(body.characterId || ''), ready = body.ready;
    if (!UUID.test(characterId) || typeof ready !== 'boolean') { json(res, 400, { error: 'invalid_ready_response' }); return true; }
    const result = await pool.query(`INSERT INTO ready_check_responses(ready_check_id,character_id,ready)
      SELECT rc.id,$2,$3 FROM ready_checks rc
      JOIN party_members pm ON pm.party_id=rc.party_id AND pm.character_id=$2
      JOIN characters c ON c.id=pm.character_id AND c.account_id=$4
      WHERE rc.id=$1 AND rc.expires_at>now()
      ON CONFLICT(ready_check_id,character_id) DO UPDATE SET ready=EXCLUDED.ready,responded_at=now()
      RETURNING ready_check_id,character_id,ready,responded_at`, [id, characterId, ready, account.id]);
    if (!result.rowCount) { json(res, 404, { error: 'ready_check_expired_or_membership_missing' }); return true; }
    json(res, 200, { response: result.rows[0] }); return true;
  }

  json(res, 405, { error: 'method_not_allowed' }); return true;
}
module.exports = { handleInstanceRequest };
