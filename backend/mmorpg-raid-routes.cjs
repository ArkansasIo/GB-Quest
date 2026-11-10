'use strict';
const crypto = require('node:crypto');
const UUID = /^[0-9a-f-]{36}$/i;
const ROLES = new Set(['tank','healer','damage','support']);
const SIZES = new Set([10,20,40]);

async function handleRaidRequest({ req, res, url, pool, accountFor, readBody, json }) {
  const character = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/raid-group$/i);
  const invite = url.pathname.match(/^\/api\/raids\/([0-9a-f-]{36})\/invites$/i);
  const accept = url.pathname.match(/^\/api\/raid-invites\/([0-9a-f-]{36})\/accept$/i);
  const role = url.pathname.match(/^\/api\/raids\/([0-9a-f-]{36})\/members\/([0-9a-f-]{36})\/role$/i);
  const transfer = url.pathname.match(/^\/api\/raids\/([0-9a-f-]{36})\/transfer$/i);
  const disband = url.pathname.match(/^\/api\/raids\/([0-9a-f-]{36})$/i);
  if (!character && !invite && !accept && !role && !transfer && !disband) return false;
  const account = await accountFor(req);
  if (!account) { json(res,401,{error:'unauthorized'}); return true; }

  if (character && req.method === 'GET') {
    const id=character[1];
    const owned=await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2',[id,account.id]);
    if(!owned.rowCount){json(res,404,{error:'character_not_found'});return true;}
    const q=await pool.query(`SELECT r.id,r.realm_id,r.name,r.raid_size,r.leader_character_id,r.status,
      m.character_id,m.role,m.joined_at,c.name AS character_name,c.level,c.zone_id
      FROM raid_group_members mine JOIN raid_groups r ON r.id=mine.raid_group_id
      JOIN raid_group_members m ON m.raid_group_id=r.id JOIN characters c ON c.id=m.character_id
      WHERE mine.character_id=$1 AND r.status='active' ORDER BY m.joined_at`,[id]);
    const first=q.rows[0];
    json(res,200,{raid:first?{id:first.id,realmId:first.realm_id,name:first.name,raidSize:first.raid_size,leaderCharacterId:first.leader_character_id,status:first.status,members:q.rows.map(m=>({characterId:m.character_id,name:m.character_name,level:m.level,zoneId:m.zone_id,role:m.role,joinedAt:m.joined_at}))}:null});
    return true;
  }

  if (character && req.method === 'POST') {
    const id=character[1],body=await readBody(req),name=String(body.name||'').trim(),size=Number(body.raidSize||10);
    if(name.length>40||!/^[A-Za-z0-9 _-]*$/.test(name)||!SIZES.has(size)){json(res,400,{error:'invalid_raid_group'});return true;}
    const tx=await pool.connect();
    try{
      await tx.query('BEGIN');
      const ch=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[id,account.id]);
      if(!ch.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      const exists=await tx.query('SELECT 1 FROM raid_group_members WHERE character_id=$1',[id]);
      if(exists.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'already_in_raid'});return true;}
      const raidId=crypto.randomUUID();
      await tx.query("INSERT INTO raid_groups(id,realm_id,leader_character_id,name,raid_size) VALUES($1,$2,$3,$4,$5)",[raidId,ch.rows[0].realm_id,id,name,size]);
      await tx.query("INSERT INTO raid_group_members(raid_group_id,character_id,role) VALUES($1,$2,'damage')",[raidId,id]);
      await tx.query('COMMIT');
      json(res,201,{raid:{id:raidId,realmId:ch.rows[0].realm_id,name,raidSize:size,leaderCharacterId:id,members:[{characterId:id,role:'damage'}]}});return true;
    }catch(e){await tx.query('ROLLBACK').catch(()=>{});if(e.code==='23505'){json(res,409,{error:'already_in_raid'});return true;}throw e;}finally{tx.release();}
  }

  if (invite && req.method === 'POST') {
    const raidId=invite[1],body=await readBody(req),actor=String(body.inviterCharacterId||''),targetId=String(body.inviteeCharacterId||'');
    if(!UUID.test(actor)||!UUID.test(targetId)){json(res,400,{error:'invalid_character_id'});return true;}
    const tx=await pool.connect();
    try{
      await tx.query('BEGIN');
      const raid=await tx.query("SELECT id,realm_id,leader_character_id,raid_size FROM raid_groups WHERE id=$1 AND status='active' FOR UPDATE",[raidId]);
      if(!raid.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'raid_not_found'});return true;}
      const owner=await tx.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2',[actor,account.id]);
      if(!owner.rowCount||raid.rows[0].leader_character_id!==actor){await tx.query('ROLLBACK');json(res,403,{error:'raid_leader_required'});return true;}
      const target=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1',[targetId]);
      if(!target.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'invitee_not_found'});return true;}
      if(target.rows[0].realm_id!==raid.rows[0].realm_id){await tx.query('ROLLBACK');json(res,409,{error:'cross_realm_raid'});return true;}
      const count=await tx.query('SELECT count(*)::int AS n FROM raid_group_members WHERE raid_group_id=$1',[raidId]);
      if(count.rows[0].n>=raid.rows[0].raid_size){await tx.query('ROLLBACK');json(res,409,{error:'raid_full'});return true;}
      const member=await tx.query('SELECT 1 FROM raid_group_members WHERE character_id=$1',[targetId]);
      if(member.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'invitee_already_in_raid'});return true;}
      const pending=await tx.query("SELECT 1 FROM raid_invites WHERE raid_group_id=$1 AND invitee_character_id=$2 AND status='pending' AND expires_at>now()",[raidId,targetId]);
      if(pending.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'invite_already_pending'});return true;}
      const id=crypto.randomUUID();
      await tx.query("INSERT INTO raid_invites(id,raid_group_id,inviter_character_id,invitee_character_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '60 seconds')",[id,raidId,actor,targetId]);
      await tx.query('COMMIT');json(res,201,{invite:{id,raidGroupId:raidId,inviteeCharacterId:targetId,expiresInSeconds:60}});return true;
    }catch(e){await tx.query('ROLLBACK').catch(()=>{});if(e.code==='23505'){json(res,409,{error:'invite_already_pending_or_member'});return true;}throw e;}finally{tx.release();}
  }

  if (accept && req.method === 'POST') {
    const inviteId=accept[1],body=await readBody(req),id=String(body.characterId||'');
    if(!UUID.test(id)){json(res,400,{error:'invalid_character_id'});return true;}
    const tx=await pool.connect();
    try{
      await tx.query('BEGIN');
      const ch=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[id,account.id]);
      if(!ch.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      const inv=await tx.query("SELECT * FROM raid_invites WHERE id=$1 FOR UPDATE",[inviteId]);
      if(!inv.rowCount||inv.rows[0].invitee_character_id!==id){await tx.query('ROLLBACK');json(res,404,{error:'raid_invite_not_found'});return true;}
      const i=inv.rows[0];
      if(i.status!=='pending'){await tx.query('ROLLBACK');json(res,409,{error:'raid_invite_not_pending'});return true;}
      if(new Date(i.expires_at).getTime()<=Date.now()){await tx.query("UPDATE raid_invites SET status='expired' WHERE id=$1",[inviteId]);await tx.query('COMMIT');json(res,410,{error:'raid_invite_expired'});return true;}
      const raid=await tx.query("SELECT id,realm_id,raid_size FROM raid_groups WHERE id=$1 AND status='active' FOR UPDATE",[i.raid_group_id]);
      if(!raid.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'raid_not_found'});return true;}
      if(raid.rows[0].realm_id!==ch.rows[0].realm_id){await tx.query('ROLLBACK');json(res,409,{error:'cross_realm_raid'});return true;}
      const count=await tx.query('SELECT count(*)::int AS n FROM raid_group_members WHERE raid_group_id=$1',[i.raid_group_id]);
      if(count.rows[0].n>=raid.rows[0].raid_size){await tx.query('ROLLBACK');json(res,409,{error:'raid_full'});return true;}
      const member=await tx.query('SELECT 1 FROM raid_group_members WHERE character_id=$1',[id]);
      if(member.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'already_in_raid'});return true;}
      await tx.query("INSERT INTO raid_group_members(raid_group_id,character_id,role) VALUES($1,$2,'damage')",[i.raid_group_id,id]);
      await tx.query("UPDATE raid_invites SET status='accepted' WHERE id=$1",[inviteId]);
      const roster=await tx.query('SELECT m.character_id,c.name,c.level,c.zone_id,m.role FROM raid_group_members m JOIN characters c ON c.id=m.character_id WHERE m.raid_group_id=$1 ORDER BY m.joined_at',[i.raid_group_id]);
      await tx.query('COMMIT');json(res,200,{raid:{id:i.raid_group_id,realmId:raid.rows[0].realm_id,raidSize:raid.rows[0].raid_size,members:roster.rows.map(m=>({characterId:m.character_id,name:m.name,level:m.level,zoneId:m.zone_id,role:m.role}))}});return true;
    }catch(e){await tx.query('ROLLBACK').catch(()=>{});if(e.code==='23505'){json(res,409,{error:'already_in_raid'});return true;}throw e;}finally{tx.release();}
  }

  if (role && req.method === 'POST') {
    const raidId=role[1],targetId=role[2],body=await readBody(req),actor=String(body.actorCharacterId||''),value=String(body.role||'');
    if(!UUID.test(actor)||!ROLES.has(value)){json(res,400,{error:'invalid_raid_role_request'});return true;}
    const tx=await pool.connect();
    try{
      await tx.query('BEGIN');
      const raid=await tx.query("SELECT id,realm_id,leader_character_id FROM raid_groups WHERE id=$1 AND status='active' FOR UPDATE",[raidId]);
      if(!raid.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'raid_not_found'});return true;}
      const owner=await tx.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2',[actor,account.id]);
      if(!owner.rowCount||raid.rows[0].leader_character_id!==actor){await tx.query('ROLLBACK');json(res,403,{error:'raid_leader_required'});return true;}
      const updated=await tx.query('UPDATE raid_group_members SET role=$1 WHERE raid_group_id=$2 AND character_id=$3 RETURNING character_id,role',[value,raidId,targetId]);
      if(!updated.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'raid_member_not_found'});return true;}
      await tx.query('COMMIT');json(res,200,{member:updated.rows[0]});return true;
    }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
  }

  if (transfer && req.method === 'POST') {
    const raidId=transfer[1],body=await readBody(req),actor=String(body.actorCharacterId||''),target=String(body.targetCharacterId||'');
    if(!UUID.test(actor)||!UUID.test(target)){json(res,400,{error:'invalid_character_id'});return true;}
    const tx=await pool.connect();
    try{
      await tx.query('BEGIN');
      const raid=await tx.query("SELECT id,leader_character_id FROM raid_groups WHERE id=$1 AND status='active' FOR UPDATE",[raidId]);
      if(!raid.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'raid_not_found'});return true;}
      const owner=await tx.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2',[actor,account.id]);
      if(!owner.rowCount||raid.rows[0].leader_character_id!==actor){await tx.query('ROLLBACK');json(res,403,{error:'raid_leader_required'});return true;}
      const targetMember=await tx.query('SELECT 1 FROM raid_group_members WHERE raid_group_id=$1 AND character_id=$2',[raidId,target]);
      if(!targetMember.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'raid_member_not_found'});return true;}
      await tx.query('UPDATE raid_groups SET leader_character_id=$1 WHERE id=$2',[target,raidId]);
      await tx.query('COMMIT');json(res,200,{transferred:true,leaderCharacterId:target});return true;
    }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
  }

  if (character && req.method === 'DELETE') {
    const id=character[1],tx=await pool.connect();
    try{
      await tx.query('BEGIN');
      const owned=await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[id,account.id]);
      if(!owned.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      const member=await tx.query('SELECT r.id,r.leader_character_id FROM raid_group_members m JOIN raid_groups r ON r.id=m.raid_group_id WHERE m.character_id=$1 AND r.status='active' FOR UPDATE OF r',[id]);
      if(!member.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'not_in_raid'});return true;}
      if(member.rows[0].leader_character_id===id){await tx.query('ROLLBACK');json(res,409,{error:'transfer_leadership_before_leaving'});return true;}
      await tx.query('DELETE FROM raid_group_members WHERE raid_group_id=$1 AND character_id=$2',[member.rows[0].id,id]);
      await tx.query("UPDATE raid_invites SET status='cancelled' WHERE raid_group_id=$1 AND invitee_character_id=$2 AND status='pending'",[member.rows[0].id,id]);
      await tx.query('COMMIT');json(res,200,{left:true,raidGroupId:member.rows[0].id});return true;
    }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
  }

  if (disband && req.method === 'DELETE') {
    const raidId=disband[1],actor=String(url.searchParams.get('characterId')||'');
    if(!UUID.test(actor)){json(res,400,{error:'invalid_character_id'});return true;}
    const tx=await pool.connect();
    try{
      await tx.query('BEGIN');
      const raid=await tx.query("SELECT id,leader_character_id FROM raid_groups WHERE id=$1 AND status='active' FOR UPDATE",[raidId]);
      if(!raid.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'raid_not_found'});return true;}
      const owner=await tx.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2',[actor,account.id]);
      if(!owner.rowCount||raid.rows[0].leader_character_id!==actor){await tx.query('ROLLBACK');json(res,403,{error:'raid_leader_required'});return true;}
      await tx.query("UPDATE raid_groups SET status='disbanded' WHERE id=$1",[raidId]);
      await tx.query("UPDATE raid_invites SET status='cancelled' WHERE raid_group_id=$1 AND status='pending'",[raidId]);
      await tx.query('DELETE FROM raid_group_members WHERE raid_group_id=$1',[raidId]);
      await tx.query('COMMIT');json(res,200,{disbanded:true,raidGroupId:raidId});return true;
    }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
  }
  json(res,405,{error:'method_not_allowed'});return true;
}
module.exports={handleRaidRequest};
