'use strict';
const crypto=require('node:crypto');
async function handleGuildRequest({req,res,url,pool,accountFor,readBody,json}){
 const member=url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/guild$/i);
 const invite=url.pathname.match(/^\/api\/guilds\/([0-9a-f-]{36})\/invites$/i);
 const accept=url.pathname.match(/^\/api\/guild-invites\/([0-9a-f-]{36})\/accept$/i);
 const motd=url.pathname.match(/^\/api\/guilds\/([0-9a-f-]{36})\/motd$/i);
 if(!member&&!invite&&!accept&&!motd)return false;
 const acct=await accountFor(req);if(!acct){json(res,401,{error:'unauthorized'});return true;}
 if(member&&req.method==='GET'){
  const id=member[1],owned=await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2',[id,acct.id]);
  if(!owned.rowCount){json(res,404,{error:'character_not_found'});return true;}
  const q=await pool.query(`SELECT g.id,g.realm_id,g.name,g.motd,g.leader_character_id,gm.rank,gm.joined_at,
    c.id AS member_id,c.name AS member_name,c.level
    FROM guild_members self JOIN guilds g ON g.id=self.guild_id
    JOIN guild_members gm ON gm.guild_id=g.id JOIN characters c ON c.id=gm.character_id
    WHERE self.character_id=$1 ORDER BY gm.joined_at`,[id]);
  json(res,200,{guild:q.rowCount?{id:q.rows[0].id,realmId:q.rows[0].realm_id,name:q.rows[0].name,motd:q.rows[0].motd,leaderCharacterId:q.rows[0].leader_character_id,members:q.rows.map(x=>({characterId:x.member_id,name:x.member_name,level:x.level,rank:x.rank,joinedAt:x.joined_at}))}:null});
  return true;
 }
 if(member&&req.method==='POST'){
  const id=member[1],body=await readBody(req),name=String(body.name||'').trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9 _-]{2,31}$/.test(name)){json(res,400,{error:'invalid_guild_name'});return true;}
  const tx=await pool.connect();
  try{
   await tx.query('BEGIN');
   const ch=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[id,acct.id]);
   if(!ch.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
   const exists=await tx.query('SELECT 1 FROM guild_members WHERE character_id=$1',[id]);
   if(exists.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'already_in_guild'});return true;}
   const gid=crypto.randomUUID();
   await tx.query('INSERT INTO guilds(id,realm_id,name,name_key,leader_character_id) VALUES($1,$2,$3,$4,$5)',[gid,ch.rows[0].realm_id,name,name.toLowerCase(),id]);
   await tx.query("INSERT INTO guild_members(guild_id,character_id,rank) VALUES($1,$2,'leader')",[gid,id]);
   await tx.query('COMMIT');json(res,201,{guild:{id:gid,realmId:ch.rows[0].realm_id,name,leaderCharacterId:id,members:[{characterId:id,rank:'leader'}]}});return true;
  }catch(e){await tx.query('ROLLBACK').catch(()=>{});if(e.code==='23505'){json(res,409,{error:'guild_name_taken_or_character_already_guilded'});return true;}throw e;}finally{tx.release();}
 }
 if(invite&&req.method==='POST'){
  const guildId=invite[1],body=await readBody(req),actor=String(body.inviterCharacterId||''),targetId=String(body.inviteeCharacterId||'');
  if(!/^[0-9a-f-]{36}$/i.test(actor)||!/^[0-9a-f-]{36}$/i.test(targetId)){json(res,400,{error:'invalid_character_id'});return true;}
  const tx=await pool.connect();
  try{
   await tx.query('BEGIN');
   const g=await tx.query('SELECT id,realm_id FROM guilds WHERE id=$1 FOR UPDATE',[guildId]);
   if(!g.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'guild_not_found'});return true;}
   const a=await tx.query(`SELECT gm.rank FROM guild_members gm JOIN characters c ON c.id=gm.character_id
     JOIN guild_permissions gp ON gp.rank=gm.rank AND gp.permission='invite'
     WHERE gm.guild_id=$1 AND gm.character_id=$2 AND c.account_id=$3`,[guildId,actor,acct.id]);
   if(!a.rowCount){await tx.query('ROLLBACK');json(res,403,{error:'guild_invite_permission_required'});return true;}
   const target=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1',[targetId]);
   if(!target.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'invitee_not_found'});return true;}
   if(target.rows[0].realm_id!==g.rows[0].realm_id){await tx.query('ROLLBACK');json(res,409,{error:'cross_realm_guild'});return true;}
   const inGuild=await tx.query('SELECT 1 FROM guild_members WHERE character_id=$1',[targetId]);
   if(inGuild.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'invitee_already_in_guild'});return true;}
   const id=crypto.randomUUID();
   await tx.query("INSERT INTO guild_invites(id,guild_id,inviter_character_id,invitee_character_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '24 hours')",[id,guildId,actor,targetId]);
   await tx.query('COMMIT');json(res,201,{invite:{id,guildId,inviteeCharacterId:targetId,expiresInHours:24}});return true;
  }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
 }
 if(accept&&req.method==='POST'){
  const id=accept[1],body=await readBody(req),characterId=String(body.characterId||'');
  if(!/^[0-9a-f-]{36}$/i.test(characterId)){json(res,400,{error:'invalid_character_id'});return true;}
  const tx=await pool.connect();
  try{
   await tx.query('BEGIN');
   const ch=await tx.query('SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[characterId,acct.id]);
   if(!ch.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
   const inv=await tx.query('SELECT * FROM guild_invites WHERE id=$1 FOR UPDATE',[id]);
   if(!inv.rowCount||inv.rows[0].invitee_character_id!==characterId){await tx.query('ROLLBACK');json(res,404,{error:'invite_not_found'});return true;}
   const i=inv.rows[0];
   if(i.status!=='pending'){await tx.query('ROLLBACK');json(res,409,{error:'invite_not_pending'});return true;}
   if(new Date(i.expires_at).getTime()<=Date.now()){await tx.query("UPDATE guild_invites SET status='expired' WHERE id=$1",[id]);await tx.query('COMMIT');json(res,410,{error:'invite_expired'});return true;}
   const g=await tx.query('SELECT id,realm_id FROM guilds WHERE id=$1 FOR UPDATE',[i.guild_id]);
   if(!g.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'guild_not_found'});return true;}
   if(g.rows[0].realm_id!==ch.rows[0].realm_id){await tx.query('ROLLBACK');json(res,409,{error:'cross_realm_guild'});return true;}
   await tx.query("INSERT INTO guild_members(guild_id,character_id,rank) VALUES($1,$2,'recruit')",[i.guild_id,characterId]);
   await tx.query("UPDATE guild_invites SET status='accepted' WHERE id=$1",[id]);
   await tx.query('COMMIT');json(res,200,{joined:true,guildId:i.guild_id});return true;
  }catch(e){await tx.query('ROLLBACK').catch(()=>{});if(e.code==='23505'){json(res,409,{error:'already_in_guild'});return true;}throw e;}finally{tx.release();}
 }
 if(member&&req.method==='DELETE'){
  const id=member[1],tx=await pool.connect();
  try{
   await tx.query('BEGIN');
   const ch=await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[id,acct.id]);
   if(!ch.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
   const gm=await tx.query('SELECT guild_id,rank FROM guild_members WHERE character_id=$1 FOR UPDATE',[id]);
   if(!gm.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'not_in_guild'});return true;}
   if(gm.rows[0].rank==='leader'){await tx.query('ROLLBACK');json(res,409,{error:'leader_must_transfer_or_disband'});return true;}
   await tx.query('DELETE FROM guild_members WHERE character_id=$1',[id]);
   await tx.query('COMMIT');json(res,200,{left:true,guildId:gm.rows[0].guild_id});return true;
  }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
 }
 if(motd&&req.method==='POST'){
  const body=await readBody(req),actor=String(body.characterId||''),message=String(body.motd||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(actor)||message.length>180){json(res,400,{error:'invalid_motd_request'});return true;}
  const result=await pool.query(`UPDATE guilds g SET motd=$1 FROM guild_members gm JOIN characters c ON c.id=gm.character_id
   WHERE g.id=$2 AND gm.guild_id=g.id AND gm.character_id=$3 AND c.account_id=$4 AND gm.rank IN ('leader','officer')
   RETURNING g.id,g.motd`,[message,motd[1],actor,acct.id]);
  if(!result.rowCount){json(res,403,{error:'guild_motd_permission_required'});return true;}
  json(res,200,{guildId:result.rows[0].id,motd:result.rows[0].motd});return true;
 }
 json(res,405,{error:'method_not_allowed'});return true;
}
module.exports={handleGuildRequest};
