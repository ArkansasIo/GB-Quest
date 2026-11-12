'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES = Object.freeze({ arena_2v2: 4, arena_3v3: 6, battleground_10v10: 20 });

async function handleCompetitiveRequest({ req, res, pool, accountFor, json, readBody }) {
  const url = new URL(req.url, 'http://localhost');
  const noticeList = url.pathname === '/api/notifications';
  const noticeRead = url.pathname.match(/^\/api\/notifications\/([0-9a-f-]{36})\/read$/i);
  const queueCreate = url.pathname === '/api/competitive/queue' && req.method === 'POST';
  const queueState = url.pathname.match(/^\/api\/competitive\/queue\/([0-9a-f-]{36})$/i);
  const matchState = url.pathname.match(/^\/api\/competitive\/matches\/([0-9a-f-]{36})$/i);
  const recognized = noticeList || noticeRead || queueCreate || queueState || matchState;
  if (!recognized) return false;
  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (noticeList && req.method === 'GET') {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 50));
    const result = await pool.query(
      'SELECT id,event_type AS "eventType",payload,created_at AS "createdAt",read_at AS "readAt" FROM player_notifications WHERE account_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT $2',
      [account.id, limit]);
    json(res, 200, { notifications: result.rows }); return true;
  }
  if (noticeRead && req.method === 'POST') {
    const result = await pool.query(
      'UPDATE player_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND account_id=$2 AND expires_at>now() RETURNING id,read_at AS "readAt"',
      [noticeRead[1], account.id]);
    if (!result.rowCount) json(res, 404, { error: 'notification_not_found' });
    else json(res, 200, { notification: result.rows[0] });
    return true;
  }

  if (queueCreate) {
    const body = await readBody(req);
    const characterId = String(body.characterId || '');
    const mode = String(body.mode || '');
    if (!UUID.test(characterId) || !Object.hasOwn(MODES, mode)) {
      json(res, 400, { error: 'invalid_competitive_queue_request' }); return true;
    }
    const needed = MODES[mode], tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const hero = await tx.query(
        'SELECT c.id,c.realm_id,COALESCE(r.rating,1000)::int AS rating FROM characters c LEFT JOIN pvp_character_ratings r ON r.character_id=c.id WHERE c.id=$1 AND c.account_id=$2 FOR UPDATE OF c',
        [characterId, account.id]);
      if (!hero.rowCount) { await tx.query('ROLLBACK'); json(res,404,{error:'character_not_found'}); return true; }
      await tx.query("UPDATE competitive_queue_entries SET status='expired' WHERE character_id=$1 AND status='queued' AND expires_at<=now()",[characterId]);
      const active = await tx.query("SELECT id,status,match_id FROM competitive_queue_entries WHERE character_id=$1 AND status IN ('queued','matched') FOR UPDATE",[characterId]);
      if (active.rowCount) { await tx.query('ROLLBACK'); json(res,409,{error:'already_in_competitive_queue',status:active.rows[0].status,matchId:active.rows[0].match_id}); return true; }
      const rating = hero.rows[0].rating;
      const inserted = await tx.query(
        'INSERT INTO competitive_queue_entries(character_id,account_id,realm_id,mode,rating) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at,expires_at',
        [characterId,account.id,hero.rows[0].realm_id,mode,rating]);
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[hero.rows[0].realm_id,mode]);
      const candidates = await tx.query(
        "SELECT q.id,q.character_id,q.account_id,q.rating FROM competitive_queue_entries q WHERE q.realm_id=$1 AND q.mode=$2 AND q.status='queued' AND q.expires_at>now() AND q.character_id<>$3 AND q.rating BETWEEN $4 AND $5 AND NOT EXISTS(SELECT 1 FROM competitive_queue_entries own WHERE own.id=q.id AND own.account_id=$6) AND q.id=(SELECT q0.id FROM competitive_queue_entries q0 WHERE q0.account_id=q.account_id AND q0.realm_id=q.realm_id AND q0.mode=q.mode AND q0.status='queued' AND q0.expires_at>now() ORDER BY q0.created_at,q0.id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM character_blocks b WHERE (b.character_id=q.character_id AND b.blocked_character_id=$3) OR (b.character_id=$3 AND b.blocked_character_id=q.character_id)) ORDER BY q.created_at,q.id LIMIT $7 FOR UPDATE SKIP LOCKED",
        [hero.rows[0].realm_id,mode,characterId,Math.max(0,rating-500),Math.min(5000,rating+500),account.id,needed-1]);
      if (candidates.rowCount < needed-1) {
        await tx.query('COMMIT');
        json(res,201,{queue:{id:inserted.rows[0].id,status:'queued',mode,expiresAt:inserted.rows[0].expires_at},requiredPlayers:needed});
        return true;
      }
      const entries = [{id:inserted.rows[0].id,character_id:characterId,account_id:account.id,rating},...candidates.rows];
      const match = await tx.query("INSERT INTO competitive_matches(realm_id,mode) VALUES($1,$2) RETURNING id,instance_id,status",[hero.rows[0].realm_id,mode]);
      const matchId = match.rows[0].id;
      for (let i=0;i<entries.length;i++) {
        const entry=entries[i], team=i < needed/2 ? 1 : 2;
        await tx.query("UPDATE competitive_queue_entries SET status='matched',match_id=$1 WHERE id=$2",[matchId,entry.id]);
        await tx.query('INSERT INTO competitive_match_members(match_id,character_id,queue_entry_id,team,rating_at_match) VALUES($1,$2,$3,$4,$5)',[matchId,entry.character_id,entry.id,team,entry.rating]);
        await tx.query(
          "INSERT INTO player_notifications(account_id,character_id,event_type,payload) VALUES($1,$2,'competitive.match_found',$3::jsonb)",
          [entry.account_id,entry.character_id,JSON.stringify({matchId,mode,instanceId:match.rows[0].instance_id,team})]);
      }
      await tx.query('COMMIT');
      json(res,201,{queue:{id:inserted.rows[0].id,status:'matched',mode,matchId},match:{id:matchId,instanceId:match.rows[0].instance_id,mode,players:needed}});
      return true;
    } catch(error) { await tx.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { tx.release(); }
  }

  if (queueState && (req.method==='GET' || req.method==='DELETE')) {
    const characterId=queueState[1];
    const owner=await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2',[characterId,account.id]);
    if(!owner.rowCount){json(res,404,{error:'character_not_found'});return true;}
    if(req.method==='DELETE') {
      const result=await pool.query("UPDATE competitive_queue_entries SET status='cancelled' WHERE character_id=$1 AND account_id=$2 AND status='queued' RETURNING id",[characterId,account.id]);
      json(res,200,{cancelled:!!result.rowCount});return true;
    }
    const result=await pool.query("SELECT id,mode,status,match_id AS \"matchId\",created_at AS \"createdAt\",expires_at AS \"expiresAt\" FROM competitive_queue_entries WHERE character_id=$1 AND account_id=$2 AND status IN ('queued','matched') ORDER BY created_at DESC LIMIT 1",[characterId,account.id]);
    json(res,200,{queue:result.rows[0]||null});return true;
  }
  if (matchState && req.method==='GET') {
    const result=await pool.query(
      'SELECT m.id,m.mode,m.status,m.instance_id AS "instanceId",m.created_at AS "createdAt",m.started_at AS "startedAt",json_agg(json_build_object(\'characterId\',c.id,\'name\',c.name,\'team\',mm.team,\'rating\',mm.rating_at_match) ORDER BY mm.team,mm.joined_at) AS players FROM competitive_matches m JOIN competitive_match_members mm ON mm.match_id=m.id JOIN characters c ON c.id=mm.character_id WHERE m.id=$1 GROUP BY m.id HAVING bool_or(c.account_id=$2)',
      [matchState[1],account.id]);
    if(!result.rowCount) json(res,404,{error:'match_not_found'});
    else json(res,200,{match:result.rows[0]});
    return true;
  }
  return false;
}

module.exports = { handleCompetitiveRequest };
