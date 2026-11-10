'use strict';
const crypto = require('node:crypto');
const UUID = /^[0-9a-f-]{36}$/i;

async function handleFriendRequest({ req, res, url, pool, accountFor, readBody, json }) {
  const listRoute = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/friends$/i);
  const blockRoute = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/blocks$/i);
  const acceptRoute = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/friends\/([0-9a-f-]{36})\/accept$/i);
  const relationRoute = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/friends\/([0-9a-f-]{36})$/i);
  if (!listRoute && !blockRoute && !acceptRoute && !relationRoute) return false;
  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (listRoute && req.method === 'GET') {
    const characterId = listRoute[1];
    const owned = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
    if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    const result = await pool.query(`SELECT f.friend_character_id,c.name,c.level,c.zone_id,f.status,f.created_at
      FROM player_friends f JOIN characters c ON c.id=f.friend_character_id
      WHERE f.character_id=$1 ORDER BY f.status,c.name`, [characterId]);
    json(res, 200, { friends: result.rows.map(row => ({ characterId: row.friend_character_id, name: row.name, level: row.level, zoneId: row.zone_id, status: row.status, createdAt: row.created_at })) });
    return true;
  }

  if ((listRoute && req.method === 'POST') || (blockRoute && req.method === 'POST')) {
    const characterId = (listRoute || blockRoute)[1], body = await readBody(req);
    const targetId = String(body.targetCharacterId || '');
    if (!UUID.test(targetId) || targetId === characterId) { json(res, 400, { error: 'invalid_friend_target' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const chars = await tx.query('SELECT id,realm_id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[characterId, targetId]]);
      const own = chars.rows.find(row => row.id === characterId);
      const target = chars.rows.find(row => row.id === targetId);
      if (!own || own.account_id && own.account_id !== account.id) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const ownership = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
      if (!ownership.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      if (!target) { await tx.query('ROLLBACK'); json(res, 404, { error: 'target_not_found' }); return true; }
      if (own.realm_id !== target.realm_id) { await tx.query('ROLLBACK'); json(res, 409, { error: 'cross_realm_friendship' }); return true; }
      if (blockRoute) {
        await tx.query('DELETE FROM player_friends WHERE character_id=$1 AND friend_character_id=$2', [targetId, characterId]);
        await tx.query("INSERT INTO player_friends(character_id,friend_character_id,status) VALUES($1,$2,'blocked') ON CONFLICT(character_id,friend_character_id) DO UPDATE SET status='blocked',created_at=now()", [characterId, targetId]);
        await tx.query('COMMIT'); json(res, 200, { blocked: true, characterId, targetCharacterId: targetId }); return true;
      }
      const blocked = await tx.query("SELECT 1 FROM player_friends WHERE status='blocked' AND ((character_id=$1 AND friend_character_id=$2) OR (character_id=$2 AND friend_character_id=$1))", [characterId, targetId]);
      if (blocked.rowCount) { await tx.query('ROLLBACK'); json(res, 409, { error: 'friendship_blocked' }); return true; }
      const reverse = await tx.query("SELECT status FROM player_friends WHERE character_id=$1 AND friend_character_id=$2 FOR UPDATE", [targetId, characterId]);
      const status = reverse.rowCount && reverse.rows[0].status === 'pending' ? 'accepted' : 'pending';
      await tx.query("INSERT INTO player_friends(character_id,friend_character_id,status) VALUES($1,$2,$3) ON CONFLICT(character_id,friend_character_id) DO UPDATE SET status=EXCLUDED.status,created_at=now()", [characterId, targetId, status]);
      if (status === 'accepted') await tx.query("UPDATE player_friends SET status='accepted' WHERE character_id=$1 AND friend_character_id=$2", [targetId, characterId]);
      await tx.query('COMMIT'); json(res, 201, { requested: status === 'pending', accepted: status === 'accepted', targetCharacterId: targetId }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (acceptRoute && req.method === 'POST') {
    const characterId = acceptRoute[1], friendId = acceptRoute[2], tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owned = await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, account.id]);
      if (!owned.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const pending = await tx.query("SELECT c.realm_id FROM player_friends f JOIN characters c ON c.id=f.character_id WHERE f.character_id=$2 AND f.friend_character_id=$1 AND f.status='pending' FOR UPDATE", [characterId, friendId]);
      if (!pending.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'friend_request_not_found' }); return true; }
      if (pending.rows[0].realm_id !== owned.rows[0].realm_id) { await tx.query('ROLLBACK'); json(res, 409, { error: 'cross_realm_friendship' }); return true; }
      await tx.query("UPDATE player_friends SET status='accepted' WHERE (character_id=$1 AND friend_character_id=$2) OR (character_id=$2 AND friend_character_id=$1)", [characterId, friendId]);
      await tx.query('COMMIT'); json(res, 200, { accepted: true, characterId, friendCharacterId: friendId }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (relationRoute && req.method === 'DELETE') {
    const characterId = relationRoute[1], friendId = relationRoute[2];
    const owned = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
    if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    await pool.query('DELETE FROM player_friends WHERE (character_id=$1 AND friend_character_id=$2) OR (character_id=$2 AND friend_character_id=$1)', [characterId, friendId]);
    json(res, 200, { removed: true, characterId, friendCharacterId: friendId }); return true;
  }

  json(res, 405, { error: 'method_not_allowed' }); return true;
}
module.exports = { handleFriendRequest };
