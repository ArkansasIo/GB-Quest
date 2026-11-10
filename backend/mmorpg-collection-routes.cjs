'use strict';
const CATEGORIES = new Set(['mounts','pets','titles','appearances','achievements']);
const ACTIVE_FIELDS = Object.freeze({ mounts:'activeMount', pets:'activePet', titles:'activeTitle' });
const EMPTY = Object.freeze({ mounts:[], pets:[], titles:[], appearances:[], achievements:[], activeMount:null, activePet:null, activeTitle:null, points:0 });
function normalize(state) {
  const value = state && typeof state === 'object' ? state : {};
  const out = { ...EMPTY, ...value };
  for (const category of CATEGORIES) if (!Array.isArray(out[category])) out[category] = [];
  out.points = Number.isSafeInteger(out.points) && out.points >= 0 ? out.points : 0;
  return out;
}
async function handleCollectionRequest({req,res,url,pool,accountFor,readBody,json}) {
  const match = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/collections(?:\/(activate))?$/i);
  if (!match) return false;
  const account = await accountFor(req);
  if (!account) { json(res,401,{error:'unauthorized'}); return true; }
  const characterId = match[1];
  const owned = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2',[characterId,account.id]);
  if (!owned.rowCount) { json(res,404,{error:'character_not_found'}); return true; }
  if (req.method === 'GET' && !match[2]) {
    const result = await pool.query('SELECT state FROM character_collections WHERE character_id=$1',[characterId]);
    json(res,200,{characterId,collections:normalize(result.rows[0]?.state)});
    return true;
  }
  if (req.method === 'POST' && match[2] === 'activate') {
    const body = await readBody(req);
    const category = String(body.category || ''), entryId = String(body.entryId || '');
    const field = ACTIVE_FIELDS[category];
    if (!field || !/^[a-z0-9][a-z0-9._:-]{0,95}$/i.test(entryId)) { json(res,400,{error:'invalid_collection_selection'}); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const locked = await tx.query('SELECT state FROM character_collections WHERE character_id=$1 FOR UPDATE',[characterId]);
      const state = normalize(locked.rows[0]?.state);
      if (!state[category].some(entry => (typeof entry === 'string' ? entry : entry?.id) === entryId)) {
        await tx.query('ROLLBACK'); json(res,409,{error:'collection_entry_not_unlocked'}); return true;
      }
      state[field] = entryId;
      await tx.query(`INSERT INTO character_collections(character_id,state,updated_at) VALUES($1,$2::jsonb,now())
        ON CONFLICT(character_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()`,[characterId,JSON.stringify(state)]);
      await tx.query('COMMIT');
      json(res,200,{characterId,active:{category,entryId},collections:state}); return true;
    } catch(error) { await tx.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { tx.release(); }
  }
  json(res,405,{error:'method_not_allowed'}); return true;
}
module.exports={handleCollectionRequest};
