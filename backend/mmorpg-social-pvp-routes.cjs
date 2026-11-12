'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cleanText = (value, max) => typeof value === 'string' ? Array.from(value.trim()).filter(ch => { const code = ch.charCodeAt(0); return code >= 32 && code !== 127; }).join('').slice(0, max) : '';
const orderedPair = (a, b) => a < b ? [a, b] : [b, a];

async function ownedCharacter(pool, characterId, accountId, lock = false) {
  return pool.query(
    'SELECT id,realm_id,level,name FROM characters WHERE id=$1 AND account_id=$2' + (lock ? ' FOR UPDATE' : ''),
    [characterId, accountId]
  );
}

async function handleSocialPvpRequest({ req, res, pool, accountFor, json, readBody }) {
  const url = new URL(req.url, 'http://localhost');
  const friendList = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/friends$/i);
  const friendRequest = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/friends\/request$/i);
  const friendAction = url.pathname.match(/^\/api\/friend-requests\/([0-9a-f-]{36})\/(accept|decline)$/i);
  const blockList = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/blocks$/i);
  const blockDelete = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/blocks\/([0-9a-f-]{36})$/i);
  const mailList = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/mail$/i);
  const mailRead = url.pathname.match(/^\/api\/mail\/([0-9a-f-]{36})\/read$/i);
  const pvpQueue = url.pathname === '/api/pvp/queue' && req.method === 'POST';
  const pvpStatus = url.pathname.match(/^\/api\/pvp\/queue\/([0-9a-f-]{36})$/i);
  const pvpMatch = url.pathname.match(/^\/api\/pvp\/matches\/([0-9a-f-]{36})$/i);
  const pvpForfeit = url.pathname.match(/^\/api\/pvp\/matches\/([0-9a-f-]{36})\/forfeit$/i);
  const recognized = friendList || friendRequest || friendAction || blockList || blockDelete ||
    mailList || mailRead || pvpQueue || pvpStatus || pvpMatch || pvpForfeit;
  if (!recognized) return false;

  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (friendList && req.method === 'GET') {
    const characterId = friendList[1];
    const owner = await ownedCharacter(pool, characterId, account.id);
    if (!owner.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    const result = await pool.query(
      `SELECT f.id,f.status,f.requested_by,f.created_at,f.accepted_at,
        CASE WHEN f.character_low_id=$1 THEN f.character_high_id ELSE f.character_low_id END AS "characterId",
        c.name,c.level
       FROM character_friendships f
       JOIN characters c ON c.id=CASE WHEN f.character_low_id=$1 THEN f.character_high_id ELSE f.character_low_id END
       WHERE f.character_low_id=$1 OR f.character_high_id=$1
       ORDER BY f.created_at DESC`, [characterId]);
    json(res, 200, { friendships: result.rows });
    return true;
  }

  if (friendRequest && req.method === 'POST') {
    const characterId = friendRequest[1], body = await readBody(req);
    const targetId = String(body.targetCharacterId || '');
    if (!UUID.test(targetId) || targetId === characterId) { json(res, 400, { error: 'invalid_friend_target' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owners = await tx.query(
        'SELECT id,realm_id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [[characterId,targetId]]);
      const sender = owners.rows.find(row => row.id === characterId);
      const target = owners.rows.find(row => row.id === targetId);
      if (!sender || sender.realm_id !== target?.realm_id || !await ownsInAccount(tx, characterId, account.id)) {
        await tx.query('ROLLBACK'); json(res, 404, { error: 'character_or_target_not_found' }); return true;
      }
      const blocked = await tx.query(
        'SELECT 1 FROM character_blocks WHERE (character_id=$1 AND blocked_character_id=$2) OR (character_id=$2 AND blocked_character_id=$1)',
        [characterId,targetId]);
      if (blocked.rowCount) { await tx.query('ROLLBACK'); json(res, 409, { error: 'friend_request_blocked' }); return true; }
      const [low,high] = orderedPair(characterId,targetId);
      const existing = await tx.query(
        'SELECT id,status,requested_by FROM character_friendships WHERE character_low_id=$1 AND character_high_id=$2 FOR UPDATE',
        [low,high]);
      if (existing.rowCount) {
        const row = existing.rows[0];
        if (row.status === 'accepted') { await tx.query('ROLLBACK'); json(res, 200, { friendship: row, alreadyFriends: true }); return true; }
        if (row.requested_by === targetId) {
          const accepted = await tx.query(
            "UPDATE character_friendships SET status='accepted',accepted_at=now() WHERE id=$1 RETURNING id,status,requested_by",
            [row.id]);
          await tx.query('COMMIT'); json(res, 200, { friendship: accepted.rows[0], accepted: true }); return true;
        }
        await tx.query('ROLLBACK'); json(res, 409, { error: 'friend_request_already_pending' }); return true;
      }
      const created = await tx.query(
        'INSERT INTO character_friendships(character_low_id,character_high_id,requested_by) VALUES($1,$2,$3) RETURNING id,status,requested_by',
        [low,high,characterId]);
      await tx.query('COMMIT'); json(res, 201, { friendship: created.rows[0] }); return true;
    } catch (error) {
      await tx.query('ROLLBACK').catch(() => {}); throw error;
    } finally { tx.release(); }
  }

  if (friendAction && req.method === 'POST') {
    const requestId = friendAction[1], action = friendAction[2];
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const request = await tx.query('SELECT * FROM character_friendships WHERE id=$1 FOR UPDATE',[requestId]);
      if (!request.rowCount) { await tx.query('ROLLBACK'); json(res,404,{error:'friend_request_not_found'}); return true; }
      const row=request.rows[0], recipient=row.requested_by===row.character_low_id?row.character_high_id:row.character_low_id;
      const owner=await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2',[recipient,account.id]);
      if (!owner.rowCount) { await tx.query('ROLLBACK'); json(res,404,{error:'friend_request_not_found'}); return true; }
      if (row.status!=='pending') { await tx.query('ROLLBACK'); json(res,409,{error:'friend_request_not_pending'}); return true; }
      if (action==='accept') {
        await tx.query("UPDATE character_friendships SET status='accepted',accepted_at=now() WHERE id=$1",[requestId]);
      } else {
        await tx.query('DELETE FROM character_friendships WHERE id=$1',[requestId]);
      }
      await tx.query('COMMIT'); json(res,200,{requestId,status:action==='accept'?'accepted':'declined'}); return true;
    } catch(error) { await tx.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { tx.release(); }
  }

  if (blockList && req.method === 'GET') {
    const owner=await ownedCharacter(pool,blockList[1],account.id);
    if(!owner.rowCount){json(res,404,{error:'character_not_found'});return true;}
    const result=await pool.query(
      'SELECT b.blocked_character_id AS "characterId",c.name,b.created_at FROM character_blocks b JOIN characters c ON c.id=b.blocked_character_id WHERE b.character_id=$1 ORDER BY b.created_at DESC',
      [blockList[1]]);
    json(res,200,{blocks:result.rows}); return true;
  }
  if (blockList && req.method === 'POST') {
    const characterId=blockList[1],body=await readBody(req),targetId=String(body.targetCharacterId||'');
    if(!UUID.test(targetId)||targetId===characterId){json(res,400,{error:'invalid_block_target'});return true;}
    const owner=await ownedCharacter(pool,characterId,account.id);
    const target=await pool.query('SELECT id,realm_id FROM characters WHERE id=$1',[targetId]);
    if(!owner.rowCount||!target.rowCount||owner.rows[0].realm_id!==target.rows[0].realm_id){json(res,404,{error:'character_or_target_not_found'});return true;}
    await pool.query('INSERT INTO character_blocks(character_id,blocked_character_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[characterId,targetId]);
    await pool.query('DELETE FROM character_friendships WHERE (character_low_id=$1 AND character_high_id=$2) OR (character_low_id=$2 AND character_high_id=$1)',[characterId,targetId]);
    json(res,201,{blocked:true,characterId:targetId}); return true;
  }
  if (blockDelete && req.method === 'DELETE') {
    const owner=await ownedCharacter(pool,blockDelete[1],account.id);
    if(!owner.rowCount){json(res,404,{error:'character_not_found'});return true;}
    const removed=await pool.query('DELETE FROM character_blocks WHERE character_id=$1 AND blocked_character_id=$2 RETURNING blocked_character_id',[blockDelete[1],blockDelete[2]]);
    json(res,200,{blocked:false,removed:!!removed.rowCount}); return true;
  }

  if (mailList && (req.method === 'GET' || req.method === 'POST')) {
    const characterId=mailList[1],owner=await ownedCharacter(pool,characterId,account.id);
    if(!owner.rowCount){json(res,404,{error:'character_not_found'});return true;}
    if(req.method==='GET') {
      const result=await pool.query(
        'SELECT id,sender_character_id AS "senderCharacterId",subject,body,created_at AS "createdAt",read_at AS "readAt",expires_at AS "expiresAt" FROM character_mail WHERE recipient_character_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT 100',
        [characterId]);
      json(res,200,{mail:result.rows}); return true;
    }
    const body=await readBody(req),recipientId=String(body.recipientCharacterId||'');
    const subject=cleanText(body.subject,80),message=cleanText(body.body,2000);
    if(!UUID.test(recipientId)||recipientId===characterId||!subject||!message){json(res,400,{error:'invalid_mail'});return true;}
    const recipient=await pool.query('SELECT id,realm_id FROM characters WHERE id=$1',[recipientId]);
    if(!recipient.rowCount||recipient.rows[0].realm_id!==owner.rows[0].realm_id){json(res,404,{error:'recipient_not_found'});return true;}
    const blocked=await pool.query(
      'SELECT 1 FROM character_blocks WHERE (character_id=$1 AND blocked_character_id=$2) OR (character_id=$2 AND blocked_character_id=$1)',
      [characterId,recipientId]);
    if(blocked.rowCount){json(res,409,{error:'mail_blocked'});return true;}
    const sent=await pool.query(
      'INSERT INTO character_mail(realm_id,sender_character_id,recipient_character_id,subject,body) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at,expires_at',
      [owner.rows[0].realm_id,characterId,recipientId,subject,message]);
    json(res,201,{message:sent.rows[0]}); return true;
  }
  if(mailRead&&req.method==='POST') {
    const updated=await pool.query(
      'UPDATE character_mail m SET read_at=COALESCE(read_at,now()) FROM characters c WHERE m.id=$1 AND m.recipient_character_id=c.id AND c.account_id=$2 AND m.expires_at>now() RETURNING m.id,m.read_at',
      [mailRead[1],account.id]);
    if(!updated.rowCount){json(res,404,{error:'mail_not_found'});return true;}
    json(res,200,{mail:updated.rows[0]}); return true;
  }

  if(pvpQueue) {
    const body=await readBody(req),characterId=String(body.characterId||''),mode='duel';
    const rating=1000;
    if(!UUID.test(characterId)){json(res,400,{error:'invalid_pvp_queue_request'});return true;}
    const tx=await pool.connect();
    try {
      await tx.query('BEGIN');
      const hero=await tx.query('SELECT c.id,c.realm_id,c.level,COALESCE(r.rating,1000)::int AS rating FROM characters c LEFT JOIN pvp_character_ratings r ON r.character_id=c.id WHERE c.id=$1 AND c.account_id=$2 FOR UPDATE OF c',[characterId,account.id]);
      if(!hero.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      await tx.query("UPDATE pvp_queue_entries SET status='expired' WHERE character_id=$1 AND status='queued' AND expires_at<=now()",[characterId]);
      const active=await tx.query("SELECT id,status,match_id FROM pvp_queue_entries WHERE character_id=$1 AND status IN ('queued','matched') FOR UPDATE",[characterId]);
      if(active.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'already_in_pvp_queue',status:active.rows[0].status,matchId:active.rows[0].match_id});return true;}
      const inserted=await tx.query(
        "INSERT INTO pvp_queue_entries(character_id,account_id,realm_id,mode,rating) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at,expires_at",
        [characterId,account.id,hero.rows[0].realm_id,mode,hero.rows[0].rating]);
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[hero.rows[0].realm_id,mode]);
      const opponent=await tx.query(
        "SELECT q.id,q.character_id,q.rating FROM pvp_queue_entries q WHERE q.realm_id=$1 AND q.mode=$2 AND q.status='queued' AND q.expires_at>now() AND q.character_id<>$3 AND q.rating BETWEEN $4 AND $5 AND NOT EXISTS(SELECT 1 FROM characters own WHERE own.id=q.character_id AND own.account_id=$6) AND NOT EXISTS(SELECT 1 FROM character_blocks b WHERE (b.character_id=q.character_id AND b.blocked_character_id=$3) OR (b.character_id=$3 AND b.blocked_character_id=q.character_id)) ORDER BY q.created_at,q.id LIMIT 1 FOR UPDATE SKIP LOCKED",
        [hero.rows[0].realm_id,mode,characterId,Math.max(0,hero.rows[0].rating-300),Math.min(5000,hero.rows[0].rating+300),account.id]);
      if(!opponent.rowCount){await tx.query('COMMIT');json(res,201,{queue:{id:inserted.rows[0].id,status:'queued',expiresAt:inserted.rows[0].expires_at}});return true;}
      const match=await tx.query("INSERT INTO pvp_matches(realm_id,mode) VALUES($1,$2) RETURNING id,instance_id,status",[hero.rows[0].realm_id,mode]);
      const matchId=match.rows[0].id,other=opponent.rows[0];
      await tx.query("UPDATE pvp_queue_entries SET status='matched',match_id=$1 WHERE id=ANY($2::uuid[])",[matchId,[inserted.rows[0].id,other.id]]);
      await tx.query("INSERT INTO pvp_match_members(match_id,character_id,queue_entry_id,rating_at_match) VALUES($1,$2,$3,$4),($1,$5,$6,$7)",
        [matchId,characterId,inserted.rows[0].id,hero.rows[0].rating,other.character_id,other.id,other.rating]);
      await tx.query('COMMIT');
      json(res,201,{queue:{id:inserted.rows[0].id,status:'matched',matchId},match:{id:matchId,instanceId:match.rows[0].instance_id,mode,realmId:hero.rows[0].realm_id}});
      return true;
    } catch(error) { await tx.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { tx.release(); }
  }
  if(pvpStatus&&req.method==='GET') {
    const owner=await ownedCharacter(pool,pvpStatus[1],account.id);
    if(!owner.rowCount){json(res,404,{error:'character_not_found'});return true;}
    const result=await pool.query(
      "SELECT q.id,q.status,q.match_id AS \"matchId\",q.created_at AS \"createdAt\",q.expires_at AS \"expiresAt\",m.instance_id AS \"instanceId\" FROM pvp_queue_entries q LEFT JOIN pvp_matches m ON m.id=q.match_id WHERE q.character_id=$1 AND q.status IN ('queued','matched') ORDER BY q.created_at DESC LIMIT 1",
      [pvpStatus[1]]);
    json(res,200,{queue:result.rows[0]||null});return true;
  }
  if(pvpStatus&&req.method==='DELETE') {
    const removed=await pool.query(
      "UPDATE pvp_queue_entries q SET status='cancelled' FROM characters c WHERE q.character_id=$1 AND q.status='queued' AND c.id=q.character_id AND c.account_id=$2 RETURNING q.id",
      [pvpStatus[1],account.id]);
    const owner=await ownedCharacter(pool,pvpStatus[1],account.id);
    if(!owner.rowCount){json(res,404,{error:'character_not_found'});return true;}
    json(res,200,{cancelled:!!removed.rowCount});return true;
  }
  if(pvpForfeit&&req.method==='POST') {
    const tx=await pool.connect();
    try {
      await tx.query('BEGIN');
      const match=await tx.query("SELECT id,status FROM pvp_matches WHERE id=$1 FOR UPDATE",[pvpForfeit[1]]);
      if(!match.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'pvp_match_not_found'});return true;}
      if(match.rows[0].status!=='matched'){await tx.query('ROLLBACK');json(res,409,{error:'pvp_match_not_active'});return true;}
      const members=await tx.query(
        'SELECT mm.character_id,mm.rating_at_match,c.account_id FROM pvp_match_members mm JOIN characters c ON c.id=mm.character_id WHERE mm.match_id=$1 ORDER BY mm.character_id FOR UPDATE OF mm,c',
        [pvpForfeit[1]]);
      const forfeiter=members.rows.find(member=>member.account_id===account.id);
      if(!forfeiter||members.rowCount!==2){await tx.query('ROLLBACK');json(res,404,{error:'pvp_match_not_found'});return true;}
      const winner=members.rows.find(member=>member.character_id!==forfeiter.character_id);
      const expectedForfeiter=1/(1+Math.pow(10,(Number(winner.rating_at_match)-Number(forfeiter.rating_at_match))/400));
      const forfeiterDelta=Math.round(32*(0-expectedForfeiter));
      const winnerDelta=Math.round(32*(1-(1-expectedForfeiter)));
      await tx.query(
        'INSERT INTO pvp_character_ratings(character_id,rating,updated_at) VALUES($1,GREATEST(0,$2+$3),now()),($4,LEAST(5000,$5+$6),now()) ON CONFLICT(character_id) DO UPDATE SET rating=EXCLUDED.rating,updated_at=now()',
        [forfeiter.character_id,forfeiter.rating_at_match,forfeiterDelta,winner.character_id,winner.rating_at_match,winnerDelta]);
      await tx.query("UPDATE pvp_matches SET status='forfeited',winner_character_id=$2,completed_at=now() WHERE id=$1",[pvpForfeit[1],winner.character_id]);
      await tx.query("UPDATE pvp_queue_entries SET status='completed' WHERE match_id=$1",[pvpForfeit[1]]);
      await tx.query('COMMIT');
      json(res,200,{matchId:pvpForfeit[1],status:'forfeited',winnerCharacterId:winner.character_id,forfeitedBy:forfeiter.character_id});
      return true;
    } catch(error) { await tx.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { tx.release(); }
  }
  if(pvpMatch&&req.method==='GET') {
    const result=await pool.query(
      'SELECT m.id,m.realm_id AS "realmId",m.mode,m.status,m.instance_id AS "instanceId",m.created_at AS "createdAt",mm.character_id AS "characterId",c.name,c.level,mm.rating_at_match AS rating FROM pvp_matches m JOIN pvp_match_members mm ON mm.match_id=m.id JOIN characters c ON c.id=mm.character_id WHERE m.id=$1 AND EXISTS(SELECT 1 FROM pvp_match_members mine JOIN characters owned ON owned.id=mine.character_id WHERE mine.match_id=m.id AND owned.account_id=$2) ORDER BY mm.joined_at,mm.character_id',
      [pvpMatch[1],account.id]);
    if(!result.rowCount){json(res,404,{error:'pvp_match_not_found'});return true;}
    const first=result.rows[0];
    json(res,200,{match:{id:first.id,realmId:first.realmId,mode:first.mode,status:first.status,instanceId:first.instanceId,createdAt:first.createdAt,members:result.rows.map(row=>({characterId:row.characterId,name:row.name,level:row.level,rating:row.rating}))}});
    return true;
  }
  json(res,405,{error:'method_not_allowed'});
  return true;
}

async function ownsInAccount(tx, characterId, accountId) {
  const result=await tx.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2',[characterId,accountId]);
  return !!result.rowCount;
}

module.exports = { handleSocialPvpRequest };
