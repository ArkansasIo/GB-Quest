'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['tank', 'healer', 'damage']);

async function readGroup(db, groupId) {
  const group = await db.query(
    `SELECT g.id,g.realm_id,g.dungeon_id,d.name AS dungeon_name,g.status,g.instance_id,g.created_at
       FROM dungeon_match_groups g JOIN dungeon_catalog d ON d.id=g.dungeon_id WHERE g.id=$1`,
    [groupId]
  );
  if (!group.rowCount) return null;
  const members = await db.query(
    `SELECT m.character_id,c.name,m.role,c.level
       FROM dungeon_match_members m JOIN characters c ON c.id=m.character_id
      WHERE m.group_id=$1 ORDER BY CASE m.role WHEN 'tank' THEN 1 WHEN 'healer' THEN 2 ELSE 3 END,m.joined_at,m.character_id`,
    [groupId]
  );
  const row = group.rows[0];
  return {
    id: row.id, realmId: row.realm_id, dungeonId: row.dungeon_id,
    dungeonName: row.dungeon_name, status: row.status, instanceId: row.instance_id,
    createdAt: row.created_at,
    members: members.rows.map(member => ({
      characterId: member.character_id, name: member.name,
      role: member.role, level: member.level
    }))
  };
}

async function tryFormGroup(tx, realmId, dungeonId) {
  // Serialize formation for a realm/dungeon pair. Row locks prevent one player
  // from being consumed by two simultaneous matchmaking requests.
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [realmId, dungeonId]);
  await tx.query("UPDATE dungeon_queue_entries SET status='expired' WHERE realm_id=$1 AND dungeon_id=$2 AND status='queued' AND expires_at<=now()", [realmId, dungeonId]);
  const candidates = await tx.query(
    `SELECT id,character_id,role FROM dungeon_queue_entries
      WHERE realm_id=$1 AND dungeon_id=$2 AND status='queued' AND expires_at>now()
      ORDER BY created_at,id LIMIT 100 FOR UPDATE SKIP LOCKED`,
    [realmId, dungeonId]
  );
  const chosen = [];
  for (const role of ['tank', 'healer']) {
    const candidate = candidates.rows.find(row => row.role === role && !chosen.some(item => item.id === row.id));
    if (!candidate) return null;
    chosen.push(candidate);
  }
  for (let i = 0; i < 3; i++) {
    const candidate = candidates.rows.find(row => row.role === 'damage' && !chosen.some(item => item.id === row.id));
    if (!candidate) return null;
    chosen.push(candidate);
  }
  const created = await tx.query(
    'INSERT INTO dungeon_match_groups(realm_id,dungeon_id) VALUES($1,$2) RETURNING id',
    [realmId, dungeonId]
  );
  const groupId = created.rows[0].id;
  const ids = chosen.map(row => row.id);
  await tx.query(
    `UPDATE dungeon_queue_entries SET status='matched',group_id=$2,matched_at=now()
      WHERE id=ANY($1::uuid[]) AND status='queued'`,
    [ids, groupId]
  );
  await tx.query(
    `INSERT INTO dungeon_match_members(group_id,queue_entry_id,character_id,role)
      SELECT $1,id,character_id,role FROM dungeon_queue_entries WHERE id=ANY($2::uuid[])`,
    [groupId, ids]
  );
  return groupId;
}

async function handleDungeonQueueRequest({ req, res, pool, accountFor, json, readBody }) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/dungeons/catalog' && req.method === 'GET') {
    const result = await pool.query(
      'SELECT id,name,min_level AS "minLevel",max_level AS "maxLevel",party_size AS "partySize" FROM dungeon_catalog WHERE enabled=true ORDER BY id'
    );
    json(res, 200, { dungeons: result.rows });
    return true;
  }

  const joinPath = url.pathname === '/api/dungeons/queue' && req.method === 'POST';
  const queuePath = url.pathname.match(/^\/api\/dungeons\/queue\/([0-9a-f-]{36})$/i);
  const groupPath = url.pathname.match(/^\/api\/dungeons\/groups\/([0-9a-f-]{36})$/i);
  const groupActionPath = url.pathname.match(/^\/api\/dungeons\/groups\/([0-9a-f-]{36})\/(start|complete)$/i);
  if (!joinPath && !queuePath && !groupPath && !groupActionPath) return false;

  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (joinPath) {
    const body = await readBody(req);
    const characterId = String(body.characterId || '');
    const dungeonId = String(body.dungeonId || '');
    const role = String(body.role || '').toLowerCase();
    if (!UUID.test(characterId) || !/^[a-z0-9-]{1,64}$/.test(dungeonId) || !ROLES.has(role)) {
      json(res, 400, { error: 'invalid_dungeon_queue_request' }); return true;
    }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const character = await tx.query(
        'SELECT id,realm_id,level FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',
        [characterId, account.id]
      );
      if (!character.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const dungeon = await tx.query(
        'SELECT id,name,min_level,max_level FROM dungeon_catalog WHERE id=$1 AND enabled=true',
        [dungeonId]
      );
      if (!dungeon.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'dungeon_not_found' }); return true; }
      const hero = character.rows[0], target = dungeon.rows[0];
      if (hero.level < target.min_level || hero.level > target.max_level) {
        await tx.query('ROLLBACK');
        json(res, 409, { error: 'dungeon_level_ineligible', minLevel: target.min_level, maxLevel: target.max_level, characterLevel: hero.level });
        return true;
      }
      await tx.query("UPDATE dungeon_queue_entries SET status='expired' WHERE character_id=$1 AND status='queued' AND expires_at<=now()", [characterId]);
      const active = await tx.query(
        "SELECT id,status,group_id FROM dungeon_queue_entries WHERE character_id=$1 AND status IN ('queued','matched') FOR UPDATE",
        [characterId]
      );
      if (active.rowCount) {
        await tx.query('ROLLBACK');
        json(res, 409, { error: 'character_already_queued', status: active.rows[0].status, groupId: active.rows[0].group_id });
        return true;
      }
      const inserted = await tx.query(
        `INSERT INTO dungeon_queue_entries(character_id,account_id,realm_id,dungeon_id,role,character_level)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at,expires_at`,
        [characterId, account.id, hero.realm_id, dungeonId, role, hero.level]
      );
      const groupId = await tryFormGroup(tx, hero.realm_id, dungeonId);
      await tx.query('COMMIT');
      if (groupId) {
        json(res, 201, { status: 'matched', queueEntryId: inserted.rows[0].id, group: await readGroup(pool, groupId) });
      } else {
        json(res, 201, {
          status: 'queued', queueEntryId: inserted.rows[0].id,
          dungeonId, dungeonName: target.name, role, realmId: hero.realm_id,
          createdAt: inserted.rows[0].created_at, expiresAt: inserted.rows[0].expires_at,
          roleCounts: await getRoleCounts(pool, hero.realm_id, dungeonId)
        });
      }
      return true;
    } catch (error) {
      await tx.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') { json(res, 409, { error: 'character_already_queued' }); return true; }
      throw error;
    } finally { tx.release(); }
  }

  if (queuePath && req.method === 'GET') {
    const characterId = queuePath[1];
    const owned = await pool.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
    if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    await pool.query("UPDATE dungeon_queue_entries SET status='expired' WHERE character_id=$1 AND status='queued' AND expires_at<=now()", [characterId]);
    const result = await pool.query(
      `SELECT q.id,q.status,q.role,q.realm_id,q.dungeon_id,d.name AS dungeon_name,q.created_at,q.expires_at,q.group_id
         FROM dungeon_queue_entries q JOIN dungeon_catalog d ON d.id=q.dungeon_id
        WHERE q.character_id=$1 AND q.status IN ('queued','matched')
        ORDER BY q.created_at DESC LIMIT 1`,
      [characterId]
    );
    if (!result.rowCount) { json(res, 200, { status: 'not_queued' }); return true; }
    const row = result.rows[0];
    if (row.status === 'matched') {
      json(res, 200, { status: 'matched', group: await readGroup(pool, row.group_id) });
    } else {
      json(res, 200, {
        status: 'queued', queueEntryId: row.id, role: row.role, realmId: row.realm_id,
        dungeonId: row.dungeon_id, dungeonName: row.dungeon_name, createdAt: row.created_at, expiresAt: row.expires_at,
        roleCounts: await getRoleCounts(pool, row.realm_id, row.dungeon_id)
      });
    }
    return true;
  }

  if (queuePath && req.method === 'DELETE') {
    const characterId = queuePath[1];
    await pool.query("UPDATE dungeon_queue_entries SET status='expired' WHERE character_id=$1 AND status='queued' AND expires_at<=now()", [characterId]);
    const result = await pool.query(
      `UPDATE dungeon_queue_entries SET status='cancelled',cancelled_at=now()
        WHERE character_id=$1 AND account_id=$2 AND status='queued' RETURNING id`,
      [characterId, account.id]
    );
    if (!result.rowCount) {
      const owned = await pool.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
      if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
      const active = await pool.query(
        "SELECT status FROM dungeon_queue_entries WHERE character_id=$1 AND status='matched' ORDER BY matched_at DESC LIMIT 1",
        [characterId]
      );
      json(res, active.rowCount ? 409 : 404, { error: active.rowCount ? 'already_matched' : 'queue_entry_not_found' });
      return true;
    }
    json(res, 200, { status: 'cancelled', queueEntryId: result.rows[0].id });
    return true;
  }

  if (groupActionPath && req.method === 'POST') {
    const groupId = groupActionPath[1], action = groupActionPath[2].toLowerCase();
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const membership = await tx.query(
        `SELECT m.role,g.status FROM dungeon_match_members m
          JOIN characters c ON c.id=m.character_id
          JOIN dungeon_match_groups g ON g.id=m.group_id
         WHERE m.group_id=$1 AND c.account_id=$2 FOR UPDATE OF g,m`,
        [groupId, account.id]
      );
      if (!membership.rowCount) {
        await tx.query('ROLLBACK'); json(res, 404, { error: 'dungeon_group_not_found' }); return true;
      }
      if (membership.rows[0].role !== 'tank') {
        await tx.query('ROLLBACK'); json(res, 403, { error: 'dungeon_group_leader_required' }); return true;
      }
      const expected = action === 'start' ? 'formed' : 'started';
      if (membership.rows[0].status !== expected) {
        await tx.query('ROLLBACK');
        json(res, 409, { error: 'invalid_dungeon_group_state', status: membership.rows[0].status, expected });
        return true;
      }
      if (action === 'start') {
        await tx.query("UPDATE dungeon_match_groups SET status='started',started_at=now() WHERE id=$1", [groupId]);
      } else {
        await tx.query("UPDATE dungeon_match_groups SET status='completed',completed_at=now() WHERE id=$1", [groupId]);
        await tx.query("UPDATE dungeon_queue_entries SET status='completed' WHERE group_id=$1 AND status='matched'", [groupId]);
      }
      await tx.query('COMMIT');
      json(res, 200, { group: await readGroup(pool, groupId) });
      return true;
    } catch (error) {
      await tx.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { tx.release(); }
  }

  if (groupPath && req.method === 'GET') {
    const groupId = groupPath[1];
    const membership = await pool.query(
      'SELECT 1 FROM dungeon_match_members m JOIN characters c ON c.id=m.character_id WHERE m.group_id=$1 AND c.account_id=$2',
      [groupId, account.id]
    );
    if (!membership.rowCount) { json(res, 404, { error: 'dungeon_group_not_found' }); return true; }
    json(res, 200, { group: await readGroup(pool, groupId) });
    return true;
  }

  json(res, 405, { error: 'method_not_allowed' });
  return true;
}

async function getRoleCounts(pool, realmId, dungeonId) {
  const result = await pool.query(
    `SELECT role,count(*)::integer AS count FROM dungeon_queue_entries
      WHERE realm_id=$1 AND dungeon_id=$2 AND status='queued' AND expires_at>now() GROUP BY role`,
    [realmId, dungeonId]
  );
  return Object.fromEntries(['tank','healer','damage'].map(role => [role, Number(result.rows.find(row => row.role === role)?.count || 0)]));
}

module.exports = { handleDungeonQueueRequest };
