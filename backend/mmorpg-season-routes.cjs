'use strict';

const STAT_KEYS = Object.freeze(['kills','quests']);
const JOURNEY = Object.freeze([
  { id:'chapter_1', name:'A Spark in the Dark', stat:'kills', target:50, reward:{tokens:30,xp:250,gold:200} },
  { id:'chapter_2', name:'Voices of the Realm', stat:'quests', target:3, reward:{tokens:35,xp:275,gold:250} },
  { id:'chapter_3', name:'The Threat Revealed', stat:'kills', target:100, reward:{tokens:40,xp:300,gold:300} },
  { id:'chapter_4', name:'A Greater Cause', stat:'quests', target:5, reward:{tokens:45,xp:325,gold:350} },
  { id:'chapter_5', name:'Frontier Pressure', stat:'kills', target:150, reward:{tokens:50,xp:350,gold:400} },
  { id:'chapter_6', name:'Help the Settlements', stat:'quests', target:8, reward:{tokens:55,xp:375,gold:450} },
  { id:'chapter_7', name:'Break Their Lines', stat:'kills', target:200, reward:{tokens:60,xp:400,gold:500} },
  { id:'chapter_8', name:'A Realm United', stat:'quests', target:10, reward:{tokens:65,xp:425,gold:550} },
  { id:'chapter_9', name:'Into the Wilds', stat:'kills', target:250, reward:{tokens:70,xp:450,gold:600} },
  { id:'chapter_10', name:'Supply the Vanguard', stat:'quests', target:12, reward:{tokens:75,xp:475,gold:650} },
  { id:'chapter_11', name:'The Final Push', stat:'kills', target:300, reward:{tokens:80,xp:500,gold:700} },
  { id:'chapter_12', name:'The Season’s End', stat:'quests', target:15, reward:{tokens:100,xp:750,gold:1000} }
]);
const WEEKLY = Object.freeze([
  {id:'weekly_hunt',name:'Frontier Hunter',stat:'kills',target:100,reward:{tokens:50,xp:350,gold:500}},
  {id:'weekly_story',name:'Realm Helper',stat:'quests',target:5,reward:{tokens:50,xp:350,gold:500}},
  {id:'weekly_veteran',name:'Veteran Slayer',stat:'kills',target:300,reward:{tokens:100,xp:700,gold:1000}}
]);

function seasonFor(date = new Date()) {
  const year=date.getUTCFullYear(), quarter=Math.floor(date.getUTCMonth()/3);
  const ids=['emberfall','frostwake','greentide','suncrown'];
  const names=['EMBERFALL','FROSTWAKE','GREENTIDE','SUNCROWN'];
  const start=new Date(Date.UTC(year,quarter*3,1));
  const end=new Date(Date.UTC(year,quarter*3+3,1));
  return {id:'Y'+year+'_'+ids[quarter],name:names[quarter],year,quarter:quarter+1,
    start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
function weekStart(date = new Date()) {
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
  return d.toISOString().slice(0,10);
}
function cleanStats(value) {
  const source=value&&typeof value==='object'?value:{};
  return Object.fromEntries(STAT_KEYS.map(key=>[key,Math.max(0,Number(source[key])||0)]));
}
function progress(def,stats,base) {
  return Math.min(def.target,Math.max(0,(Number(stats[def.stat])||0)-(Number(base[def.stat])||0)));
}
function renownLevel(points) { return Math.min(20,Math.floor(Math.max(0,Number(points)||0)/100)); }
function normalizeArray(value) { return Array.isArray(value)?value:[]; }

async function ensureSeasonRow(db,characterId,season,week) {
  await db.query(`INSERT INTO character_season_progress(character_id,season_id,season_start,season_end,weekly_start)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(character_id,season_id) DO NOTHING`,
    [characterId,season.id,season.start,season.end,week]);
  let result=await db.query('SELECT * FROM character_season_progress WHERE character_id=$1 AND season_id=$2 FOR UPDATE',[characterId,season.id]);
  let row=result.rows[0];
  if(row.weekly_start.toISOString?.().slice(0,10)!==week && String(row.weekly_start).slice(0,10)!==week) {
    result=await db.query(`UPDATE character_season_progress SET weekly_start=$3,weekly_base=stats,weekly_claimed='[]'::jsonb,updated_at=now()
      WHERE character_id=$1 AND season_id=$2 RETURNING *`,[characterId,season.id,week]);
    row=result.rows[0];
  }
  return row;
}
function toPublic(row,season) {
  const stats=cleanStats(row.stats),base=cleanStats(row.journey_base),weeklyBase=cleanStats(row.weekly_base);
  const chapter=JOURNEY[Math.min(12,Math.max(1,Number(row.journey_chapter)||1))-1]||null;
  return {season,stats,currency:Number(row.currency),seasonXp:Number(row.season_xp),renown:Number(row.renown),
    renownLevel:renownLevel(row.renown),journey:{chapter:row.journey_chapter,complete:!chapter,
      current:chapter?{...chapter,progress:progress(chapter,stats,base),complete:progress(chapter,stats,base)>=chapter.target}:null},
    weekly:{starts:String(row.weekly_start).slice(0,10),quests:WEEKLY.map(q=>({...q,progress:progress(q,stats,weeklyBase),
      complete:progress(q,stats,weeklyBase)>=q.target,claimed:normalizeArray(row.weekly_claimed).includes(q.id)}))},
    claimedRenown:normalizeArray(row.claimed_renown)};
}
async function recordSeasonActivity(db,characterId,activity={}) {
  const season=seasonFor(),week=weekStart();
  await db.query(`INSERT INTO character_season_progress(character_id,season_id,season_start,season_end,weekly_start)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(character_id,season_id) DO NOTHING`,
    [characterId,season.id,season.start,season.end,week]);
  for(const key of STAT_KEYS) {
    const amount=Math.max(0,Math.min(100000,Math.floor(Number(activity[key])||0)));
    if(amount) await db.query(`UPDATE character_season_progress SET stats=jsonb_set(stats,ARRAY[$3],to_jsonb(COALESCE((stats->>$3)::integer,0)+$4),true),updated_at=now()
      WHERE character_id=$1 AND season_id=$2`,[characterId,season.id,key,amount]);
  }
}
async function handleSeasonRequest({req,res,url,pool,accountFor,json}) {
  const match=url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/season(?:\/(claim))?$/i);
  if(!match) return false;
  const account=await accountFor(req);
  if(!account){json(res,401,{error:'unauthorized'});return true;}
  const characterId=match[1],season=seasonFor(),week=weekStart();
  if(req.method==='GET'&&!match[2]) {
    const owned=await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2',[characterId,account.id]);
    if(!owned.rowCount){json(res,404,{error:'character_not_found'});return true;}
    const tx=await pool.connect();
    try { await tx.query('BEGIN'); const row=await ensureSeasonRow(tx,characterId,season,week); await tx.query('COMMIT'); json(res,200,{characterId,...toPublic(row,season)}); }
    catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error;} finally{tx.release();}
    return true;
  }
  if(req.method==='POST'&&match[2]) {
    const body=await requireBody(req);
    const type=String(body.type||''),id=String(body.id||'');
    if(!['journey','weekly','renown'].includes(type)){json(res,400,{error:'invalid_season_claim'});return true;}
    const tx=await pool.connect();
    try {
      await tx.query('BEGIN');
      const owned=await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE',[characterId,account.id]);
      if(!owned.rowCount){await tx.query('ROLLBACK');json(res,404,{error:'character_not_found'});return true;}
      const row=await ensureSeasonRow(tx,characterId,season,week);
      const stats=cleanStats(row.stats),journeyBase=cleanStats(row.journey_base),weeklyBase=cleanStats(row.weekly_base);
      let reward=null;
      if(type==='journey') {
        const chapter=JOURNEY[Math.min(12,Math.max(1,Number(row.journey_chapter)||1))-1];
        if(!chapter||id!==chapter.id){await tx.query('ROLLBACK');json(res,409,{error:'journey_chapter_not_current'});return true;}
        if(progress(chapter,stats,journeyBase)<chapter.target){await tx.query('ROLLBACK');json(res,409,{error:'season_objective_incomplete'});return true;}
        reward=chapter.reward;
        await tx.query(`UPDATE character_season_progress SET journey_chapter=journey_chapter+1,journey_base=stats WHERE character_id=$1 AND season_id=$2`,[characterId,season.id]);
      } else if(type==='weekly') {
        const quest=WEEKLY.find(q=>q.id===id),claimed=normalizeArray(row.weekly_claimed);
        if(!quest||claimed.includes(id)){await tx.query('ROLLBACK');json(res,409,{error:'weekly_reward_unavailable'});return true;}
        if(progress(quest,stats,weeklyBase)<quest.target){await tx.query('ROLLBACK');json(res,409,{error:'season_objective_incomplete'});return true;}
        reward=quest.reward;
        await tx.query(`UPDATE character_season_progress SET weekly_claimed=weekly_claimed||to_jsonb($3::text) WHERE character_id=$1 AND season_id=$2`,[characterId,season.id,id]);
      } else {
        const tier=Number(id),claimed=normalizeArray(row.claimed_renown);
        if(!Number.isInteger(tier)||tier<1||tier>20||tier>renownLevel(row.renown)||claimed.includes(tier)){await tx.query('ROLLBACK');json(res,409,{error:'renown_reward_unavailable'});return true;}
        reward={tokens:tier%5===0?100:25,xp:tier%5===0?500:150,gold:tier%5===0?1500:250,renown:0};
        await tx.query(`UPDATE character_season_progress SET claimed_renown=claimed_renown||to_jsonb($3::integer) WHERE character_id=$1 AND season_id=$2`,[characterId,season.id,tier]);
      }
      await tx.query('UPDATE characters SET gold=gold+$1,updated_at=now() WHERE id=$2',[reward.gold,characterId]);
      const updated=await tx.query(`UPDATE character_season_progress SET currency=LEAST(999999,currency+$1),season_xp=season_xp+$2,renown=renown+$3,updated_at=now()
        WHERE character_id=$4 AND season_id=$5 RETURNING *`,[reward.tokens,reward.xp,reward.renown===undefined?reward.tokens:reward.renown,characterId,season.id]);
      await tx.query('COMMIT');
      json(res,200,{claimed:{type,id,reward},...toPublic(updated.rows[0],season)});
      return true;
    } catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error;} finally{tx.release();}
  }
  json(res,405,{error:'method_not_allowed'});return true;
}
async function requireBody(req) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>4096)throw Object.assign(new Error('body_too_large'),{status:413});chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('invalid_json'),{status:400});}
}
module.exports={handleSeasonRequest,recordSeasonActivity,seasonFor,weekStart,renownLevel,JOURNEY,WEEKLY};
