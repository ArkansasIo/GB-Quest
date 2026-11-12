'use strict';
const crypto=require('node:crypto');
const UUID=/^[0-9a-f-]{36}$/i;
const ENCOUNTER=/^[a-z0-9_-]{2,48}$/i;
const DIFFICULTIES=new Set(['story','normal','heroic','mythic']);
function safeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
async function handleRaidEncounterRequest({req,res,url,pool,readBody,json,internalSecret}){
 const match=url.pathname.match(/^\/api\/internal\/raids\/([0-9a-f-]{36})\/encounters\/([a-z0-9_-]{2,48})\/complete$/i);
 if(!match)return false;
 if(req.method!=='POST'){json(res,405,{error:'method_not_allowed'});return true;}
 if(!internalSecret||!safeEqual(String(req.headers['x-gbq-internal-secret']||''),internalSecret)){
  json(res,401,{error:'internal_authentication_required'});return true;
 }
 const raidGroupId=match[1],encounterId=match[2],body=await readBody(req);
 const difficulty=String(body.difficulty||'normal');
 if(!DIFFICULTIES.has(difficulty)){json(res,400,{error:'invalid_raid_difficulty'});return true;}
 const tx=await pool.connect();
 try{
  await tx.query('BEGIN');
  const raid=await tx.query("SELECT id,realm_id,raid_size FROM raid_groups WHERE id=$1 AND status='active' FOR UPDATE",[raidGroupId]);
  if(!raid.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'active_raid_not_found'});return true;}
  const members=await tx.query('SELECT character_id FROM raid_group_members WHERE raid_group_id=$1 ORDER BY character_id FOR UPDATE',[raidGroupId]);
  if(!members.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'raid_has_no_members'});return true;}
  const memberIds=members.rows.map(row=>row.character_id);
  const completionId=crypto.randomUUID();
  const completion=await tx.query(`INSERT INTO raid_encounter_completions
    (id,raid_group_id,encounter_id,difficulty,reset_at,member_count)
    VALUES($1,$2,$3,$4,now()+interval '7 days',$5)
    ON CONFLICT(raid_group_id,encounter_id,difficulty) DO NOTHING
    RETURNING id,completed_at,reset_at`,[completionId,raidGroupId,encounterId,difficulty,memberIds.length]);
  if(!completion.rowCount){await tx.query('ROLLBACK');json(res,409,{error:'encounter_already_completed'});return true;}
  await tx.query(`INSERT INTO raid_lockouts(character_id,raid_id,difficulty,reset_at,completed_at)
    SELECT member_id,$2,$3,$4,$5 FROM unnest($1::uuid[]) AS member_id
    ON CONFLICT(character_id,raid_id,difficulty) DO UPDATE
      SET reset_at=GREATEST(raid_lockouts.reset_at,EXCLUDED.reset_at),
          completed_at=GREATEST(raid_lockouts.completed_at,EXCLUDED.completed_at)`,
    [memberIds,encounterId,difficulty,completion.rows[0].reset_at,completion.rows[0].completed_at]);
  await tx.query('COMMIT');
  json(res,200,{completion:{id:completion.rows[0].id,raidGroupId,encounterId,difficulty,completedAt:completion.rows[0].completed_at,resetAt:completion.rows[0].reset_at,memberCount:memberIds.length}});
  return true;
 }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error;}finally{tx.release();}
}
module.exports={handleRaidEncounterRequest};
