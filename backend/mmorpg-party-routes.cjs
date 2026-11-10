'use strict';
const crypto = require('node:crypto');

async function handlePartyRequest({ req, res, url, pool, accountFor, readBody, json }) {
  const memberRoute = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/party$/i);
  const inviteRoute = url.pathname.match(/^\/api\/parties\/([0-9a-f-]{36})\/invites$/i);
  const acceptRoute = url.pathname.match(/^\/api\/party-invites\/([0-9a-f-]{36})\/accept$/i);
  if (!memberRoute && !inviteRoute && !acceptRoute) return false;

  const acct = await accountFor(req);
  if (!acct) { json(res,401,{error:'unauthorized'}); return true; }

  if (memberRoute && req.method === 'GET') {
    const characterId = memberRoute[1];
    const owned = await pool.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2',[characterId,acct.id]);
    if (!owned.rowCount) { json(res,404,{error:'character_not_found'}); return true; }
    const result = await pool.query(`SELECT p.id AS party_id,p.realm_id,p.name,p.leader_character_id,
      pm.character_id,pm.role,pm.joined_at,c.name AS character_name,c.level,c.zone_id
      FROM party_members pm JOIN parties p ON p.id=pm.party_id
      JOIN characters c ON c.id=pm.character_id
      WHERE pm.party_id=(SELECT party_id FROM party_members WHERE character_id=$1)
      ORDER BY pm.joined_at`,[characterId]);
    json(res,200,{party:result.rowCount?{id:result.rows[0].party_id,realmId:result.rows[0].realm_id,name:result.rows[0].name,leaderCharacterId:result.rows[0].leader_character_id,members:result.rows.map(r=>({characterId:r.character_id,name:r.character_name,level:r.level,zoneId:r.zone_id,role:r.role,joinedAt:r.joined_at}))}:null});
    return true;
  }

  if (memberRoute && req.method === 'POST') {
    const characterId=memberRoute[1], body=await readBody(req), name=String(body.name||'').trim();
    if (name && !/^[A-Za-z0-9 _-]{3,32}$/.test(name)) { json(res,400,{error:'invalid_party_name'}); return true; }
    const tx=await pool.connect();
    try {
      await tx.query('BEGIN');
      const character=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[characterId,acct.id]);
      if(!character.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      const existing=await tx.query('SELECT party_id FROM party_members WHERE character_id=$1',[characterId]);
      if(existing.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'already_in_party'});return true;}
      const id=crypto.randomUUID();
      await tx.query('INSERT INTO parties(id,realm_id,leader_character_id,name) VALUES($1,$2,$3,$4)',[id,character.rows[0].realm_id,characterId,name||null]);
      await tx.query("INSERT INTO party_members(party_id,character_id,role) VALUES($1,$2,'damage')",[id,characterId]);
      await tx.query('COMMIT');
      json(res,201,{party:{id,realmId:character.rows[0].realm_id,name:name||null,leaderCharacterId:characterId,members:[{characterId,role:'damage'}]}});
      return true;
    } catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;} finally{tx.release();}
  }

  if (inviteRoute && req.method === 'POST') {
    const partyId=inviteRoute[1], body=await readBody(req), inviteeId=String(body.inviteeCharacterId||'');
    if(!/^[0-9a-f-]{36}$/i.test(inviteeId)){json(res,400,{error:'invalid_invitee'});return true;}
    const tx=await pool.connect();
    try {
      await tx.query('BEGIN');
      const party=await tx.query('SELECT id,realm_id,leader_character_id FROM parties WHERE id=$1 FOR UPDATE',[partyId]);
      if(!party.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'party_not_found'});return true;}
      const inviter=await tx.query('SELECT c.id,c.realm_id,pm.role FROM characters c JOIN party_members pm ON pm.character_id=c.id WHERE c.id=$1 AND c.account_id=$2 AND pm.party_id=$3',[body.inviterCharacterId,acct.id,partyId]);
      if(!inviter.rowCount){await tx.query('ROLLBACK');json(res,403,{error:'not_party_member'});return true;}
      const target=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1',[inviteeId]);
      if(!target.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'invitee_not_found'});return true;}
      if(target.rows[0].realm_id!==party.rows[0].realm_id){await tx.query('ROLLBACK');json(res,409,{error:'cross_realm_party'});return true;}
      const count=await tx.query('SELECT count(*)::int AS n FROM party_members WHERE party_id=$1',[partyId]);
      if(count.rows[0].n>=5){await tx.query('ROLLBACK');json(res,409,{error:'party_full'});return true;}
      const already=await tx.query('SELECT 1 FROM party_members WHERE character_id=$1',[inviteeId]);
      if(already.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'invitee_already_in_party'});return true;}
      const pending=await tx.query("SELECT 1 FROM party_invites WHERE party_id=$1 AND invitee_character_id=$2 AND status='pending' AND expires_at>now()",[partyId,inviteeId]);
      if(pending.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'invite_already_pending'});return true;}
      const inviteId=crypto.randomUUID();
      await tx.query("INSERT INTO party_invites(id,party_id,inviter_character_id,invitee_character_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '60 seconds')",[inviteId,partyId,inviter.rows[0].id,inviteeId]);
      await tx.query('COMMIT');
      json(res,201,{invite:{id:inviteId,partyId,inviteeCharacterId:inviteeId,expiresInSeconds:60}});
      return true;
    } catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;} finally{tx.release();}
  }

  if (acceptRoute && req.method === 'POST') {
    const inviteId=acceptRoute[1], body=await readBody(req), characterId=String(body.characterId||'');
    if(!/^[0-9a-f-]{36}$/i.test(characterId)){json(res,400,{error:'invalid_character_id'});return true;}
    const tx=await pool.connect();
    try {
      await tx.query('BEGIN');
      const character=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[characterId,acct.id]);
      if(!character.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      const invite=await tx.query("SELECT * FROM party_invites WHERE id=$1 FOR UPDATE",[inviteId]);
      if(!invite.rowCount||invite.rows[0].invitee_character_id!==characterId){await tx.query('ROLLBACK');json(res,404,{error:'invite_not_found'});return true;}
      const i=invite.rows[0];
      if(i.status!=='pending'){await tx.query('ROLLBACK');json(res,409,{error:'invite_not_pending'});return true;}
      if(new Date(i.expires_at).getTime()<=Date.now()){await tx.query("UPDATE party_invites SET status='expired' WHERE id=$1",[inviteId]);await tx.query('COMMIT');json(res,410,{error:'invite_expired'});return true;}
      const party=await tx.query('SELECT id,realm_id FROM parties WHERE id=$1 FOR UPDATE',[i.party_id]);
      if(!party.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'party_not_found'});return true;}
      if(party.rows[0].realm_id!==character.rows[0].realm_id){await tx.query('ROLLBACK');json(res,409,{error:'cross_realm_party'});return true;}
      const count=await tx.query('SELECT count(*)::int AS n FROM party_members WHERE party_id=$1',[i.party_id]);
      if(count.rows[0].n>=5){await tx.query('ROLLBACK');json(res,409,{error:'party_full'});return true;}
      const membership=await tx.query('SELECT 1 FROM party_members WHERE character_id=$1',[characterId]);
      if(membership.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'already_in_party'});return true;}
      await tx.query("INSERT INTO party_members(party_id,character_id,role) VALUES($1,$2,'damage')",[i.party_id,characterId]);
      await tx.query("UPDATE party_invites SET status='accepted' WHERE id=$1",[inviteId]);
      const members=await tx.query('SELECT pm.character_id,c.name,c.level,c.zone_id,pm.role FROM party_members pm JOIN characters c ON c.id=pm.character_id WHERE pm.party_id=$1 ORDER BY pm.joined_at',[i.party_id]);
      await tx.query('COMMIT');
      json(res,200,{party:{id:i.party_id,realmId:party.rows[0].realm_id,members:members.rows.map(m=>({characterId:m.character_id,name:m.name,level:m.level,zoneId:m.zone_id,role:m.role}))}});
      return true;
    } catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;} finally{tx.release();}
  }
  if (memberRoute && req.method === 'DELETE') {
    const characterId=memberRoute[1],tx=await pool.connect();
    try {
      await tx.query('BEGIN');
      const owned=await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[characterId,acct.id]);
      if(!owned.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      const membership=await tx.query('SELECT p.id,p.leader_character_id FROM party_members pm JOIN parties p ON p.id=pm.party_id WHERE pm.character_id=$1 FOR UPDATE OF p',[characterId]);
      if(!membership.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'not_in_party'});return true;}
      const p=membership.rows[0];await tx.query('DELETE FROM party_members WHERE character_id=$1',[characterId]);
      const remaining=await tx.query('SELECT character_id FROM party_members WHERE party_id=$1 ORDER BY joined_at',[p.id]);
      if(!remaining.rowCount) await tx.query('DELETE FROM parties WHERE id=$1',[p.id]);
      else if(p.leader_character_id===characterId) await tx.query('UPDATE parties SET leader_character_id=$1 WHERE id=$2',[remaining.rows[0].character_id,p.id]);
      await tx.query('COMMIT');json(res,200,{left:true,partyDisbanded:!remaining.rowCount,newLeader:remaining.rows[0]?.character_id||null});return true;
    } catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;} finally{tx.release();}
  }
  json(res,405,{error:'method_not_allowed'});return true;
}
module.exports={handlePartyRequest};
