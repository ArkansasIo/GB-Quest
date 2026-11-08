#!/usr/bin/env node
'use strict';
// Dedicated authoritative MMORPG service for GB Quest.
// HTTP: health, account registration/login, character CRUD.
// WSS: authenticated sessions, zone snapshots, movement, combat intents and chat.
const http = require('node:http');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { WebSocketServer, WebSocket } = require('ws');
const { isAllowedOrigin, createAuthLimiter } = require('./mmorpg-security.cjs');

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;
const TOKEN_SECRET = process.env.GBQ_TOKEN_SECRET;
const ALLOWED_ORIGINS = new Set((process.env.GBQ_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean));
const MAX_MESSAGE = 8192;
const TOKEN_TTL = 30 * 24 * 60 * 60;
const WORLD = Object.freeze({ width: 256, height: 256, tileSize: 16 });
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) throw new Error('GBQ_TOKEN_SECRET must contain at least 32 characters');

const pool = new Pool({ connectionString: DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 10), ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : undefined });
const now = () => Math.floor(Date.now() / 1000);
const b64 = value => Buffer.from(value).toString('base64url');
const sign = value => crypto.createHmac('sha256', TOKEN_SECRET).update(value).digest('base64url');
function issueToken(accountId) {
  const payload = b64(JSON.stringify({ sub: accountId, exp: now() + TOKEN_TTL, iss: 'gbquest-mmorpg' }));
  return payload + '.' + sign(payload);
}
function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = Buffer.from(sign(parts[0]));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return p.iss === 'gbquest-mmorpg' && p.exp > now() && typeof p.sub === 'string' ? p : null;
  } catch { return null; }
}
const scrypt = (password, salt) => new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key)));
const json = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(data)); };
async function readBody(req, max = 16384) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw Object.assign(new Error('body_too_large'), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('invalid_json'), { status: 400 }); }
}
function originAllowed(req) { return isAllowedOrigin(req.headers.origin, ALLOWED_ORIGINS); }
async function accountFor(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = verifyToken(token);
  if (!claims) return null;
  const result = await pool.query('SELECT id, username FROM accounts WHERE id=$1 AND disabled=false', [claims.sub]);
  return result.rowCount ? { ...result.rows[0], token } : null;
}
const sessions = new Map(); // accountId -> Set<WebSocket>
const socketState = new WeakMap();
function send(ws, type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, sequence: ++socketState.get(ws).outSequence, payload, serverTimestamp: Date.now() }));
}
function broadcastZone(zoneId, type, payload, except = null) {
  for (const [ws, state] of activeSockets) if (state.authenticated && state.zoneId === zoneId && ws !== except) send(ws, type, payload);
}
const activeSockets = new Map();
const authLimiter = createAuthLimiter();
const authThrottled = ip => authLimiter.blocked(ip);
const recordAuthFailure = ip => authLimiter.fail(ip);
setInterval(() => authLimiter.sweep(), 600000).unref();
function attachSocket(ws, req) {
  const ip = req?.socket?.remoteAddress || 'unknown';
  const state = { authenticated: false, account: null, character: null, zoneId: null, x: 8, y: 8, inSequence: 0, outSequence: 0, lastMove: 0, lastChat: 0, lastAttack: 0, ip };
  socketState.set(ws, state); activeSockets.set(ws, state);
  send(ws, 'hello', { protocol: 'gbquest-mmorpg-v1', authRequired: true, world: WORLD });
  ws.on('message', async raw => {
    try {
      if (raw.length > MAX_MESSAGE) return ws.close(1009, 'message too large');
      const msg = JSON.parse(raw.toString());
      if (!msg || typeof msg.type !== 'string' || !Number.isSafeInteger(msg.sequence) || !msg.payload || typeof msg.payload !== 'object' || Array.isArray(msg.payload)) return send(ws, 'error', { code: 'invalid_message' });
      if (msg.sequence <= state.inSequence) return send(ws, 'error', { code: 'stale_sequence' });
      state.inSequence = msg.sequence;
      if (!state.authenticated) {
        if (authThrottled(state.ip)) return ws.close(4429, 'authentication rate limited');
        if (msg.type !== 'authenticate') return ws.close(4401, 'authenticate first');
        const claims = verifyToken(msg.payload.token);
        if (!claims) { recordAuthFailure(state.ip); return ws.close(4401, 'invalid token'); }
        const acct = await pool.query('SELECT id, username FROM accounts WHERE id=$1 AND disabled=false', [claims.sub]);
        if (!acct.rowCount) { recordAuthFailure(state.ip); return ws.close(4401, 'account unavailable'); }
        authLimiter.clear(state.ip);
        state.account = acct.rows[0]; state.authenticated = true;
        const chars = await pool.query('SELECT id,name,class,level,zone_id,x,y,hp,max_hp,mp,max_mp FROM characters WHERE account_id=$1 ORDER BY created_at', [state.account.id]);
        send(ws, 'authenticated', { account: state.account, characters: chars.rows });
        return;
      }
      if (msg.type === 'character.select') {
        const id = String(msg.payload.characterId || '');
        const result = await pool.query('SELECT id,name,class,level,zone_id,x,y,hp,max_hp,mp,max_mp FROM characters WHERE id=$1 AND account_id=$2', [id, state.account.id]);
        if (!result.rowCount) return send(ws, 'error', { code: 'character_not_found' });
        const previous = state.zoneId;
        state.character = result.rows[0]; state.zoneId = state.character.zone_id; state.x = state.character.x; state.y = state.character.y;
        if (previous) broadcastZone(previous, 'presence.left', { characterId: state.character.id }, ws);
        const players = [...activeSockets.entries()].filter(([other, s]) => other !== ws && s.authenticated && s.zoneId === state.zoneId && s.character).map(([, s]) => ({ id: s.character.id, name: s.character.name, level: s.character.level, x: s.x, y: s.y }));
        const mobs = await pool.query('SELECT id,name,level,x,y,hp,max_hp FROM world_mobs WHERE zone_id=$1 AND alive=true ORDER BY id', [state.zoneId]);
        send(ws, 'zone.snapshot', { zoneId: state.zoneId, self: { ...state.character, x: state.x, y: state.y }, players, mobs: mobs.rows });
        broadcastZone(state.zoneId, 'presence.joined', { id: state.character.id, name: state.character.name, level: state.character.level, x: state.x, y: state.y }, ws);
        return;
      }
      if (!state.character) return send(ws, 'error', { code: 'select_character_first' });
      if (msg.type === 'ping') return send(ws, 'pong', { clientTime: msg.payload.clientTime || null });
      if (msg.type === 'movement.input') {
        const t = Date.now(); if (t - state.lastMove < 80) return;
        state.lastMove = t;
        const dx = Math.max(-1, Math.min(1, Math.trunc(Number(msg.payload.dx) || 0)));
        const dy = Math.max(-1, Math.min(1, Math.trunc(Number(msg.payload.dy) || 0)));
        if (!dx && !dy) return;
        const nx = Math.max(0, Math.min(WORLD.width - 1, state.x + dx));
        const ny = Math.max(0, Math.min(WORLD.height - 1, state.y + dy));
        state.x = nx; state.y = ny;
        await pool.query('UPDATE characters SET x=$1,y=$2,updated_at=now() WHERE id=$3', [nx, ny, state.character.id]);
        const update = { characterId: state.character.id, x: nx, y: ny, zoneId: state.zoneId };
        send(ws, 'movement.accepted', update); broadcastZone(state.zoneId, 'presence.moved', update, ws);
        return;
      }
      if (msg.type === 'combat.intent') {
        const t = Date.now(); if (t - state.lastAttack < 650) return send(ws, 'error', { code: 'action_rate_limited' });
        state.lastAttack = t;
        const targetId = String(msg.payload.targetId || '');
        const tx = await pool.connect();
        let event, reward = null;
        try {
          await tx.query('BEGIN');
          const target = await tx.query('SELECT id,name,hp,max_hp,level,zone_id,x,y FROM world_mobs WHERE id=$1 AND zone_id=$2 AND alive=true FOR UPDATE', [targetId, state.zoneId]);
          if (!target.rowCount) { await tx.query('ROLLBACK'); return send(ws, 'error', { code: 'target_unavailable' }); }
          const mob = target.rows[0];
          const distance = Math.abs(state.x - Number(mob.x)) + Math.abs(state.y - Number(mob.y));
          if (distance > 3) { await tx.query('ROLLBACK'); return send(ws, 'error', { code: 'target_out_of_range' }); }
          const damage = Math.max(1, Math.min(999, 4 + state.character.level * 2 + crypto.randomInt(0, 7)));
          const hp = Math.max(0, mob.hp - damage);
          await tx.query('UPDATE world_mobs SET hp=$1,alive=$2,respawn_at=CASE WHEN $2 THEN NULL ELSE now()+interval \'60 seconds\' END,updated_at=now() WHERE id=$3', [hp, hp > 0, mob.id]);
          event = { targetId: mob.id, targetName: mob.name, damage, hp, maxHp: mob.max_hp, defeated: hp === 0, by: state.character.id };
          if (hp === 0) {
            const xp = Math.max(1, Number(mob.level) * 12);
            const progress = await tx.query('UPDATE characters SET xp=xp+$1,level=LEAST(100,level+CASE WHEN xp+$1 >= level*level*100 THEN 1 ELSE 0 END),updated_at=now() WHERE id=$2 RETURNING xp,level', [xp, state.character.id]);
            state.character.level = progress.rows[0].level;
            reward = { xp, totalXp: Number(progress.rows[0].xp), level: progress.rows[0].level, gold: 0, source: mob.id };
          }
          await tx.query('COMMIT');
        } catch (error) {
          await tx.query('ROLLBACK').catch(() => {});
          throw error;
        } finally { tx.release(); }
        broadcastZone(state.zoneId, 'combat.resolved', event);
        if (reward) send(ws, 'loot.reward', reward);
        return;
      }
      if (msg.type === 'chat.send') {
        const t = Date.now(); if (t - state.lastChat < 1200) return send(ws, 'error', { code: 'chat_rate_limited' });
        state.lastChat = t;
        const text = String(msg.payload.text || '').trim();
        if (!text || text.length > 180 || /[\u0000-\u001f\u007f]/.test(text)) return send(ws, 'error', { code: 'invalid_chat' });
        broadcastZone(state.zoneId, 'chat.message', { characterId: state.character.id, name: state.character.name, text, channel: 'zone', at: Date.now() });
        return;
      }
      return send(ws, 'error', { code: 'unsupported_message', messageType: msg.type });
    } catch (error) {
      console.error('MMO socket handler error:', error.message);
      send(ws, 'error', { code: 'server_error' });
    }
  });
  ws.on('close', () => {
    activeSockets.delete(ws);
    if (state.zoneId && state.character) broadcastZone(state.zoneId, 'presence.left', { characterId: state.character.id });
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' }); return res.end(); }
  if (!originAllowed(req)) return json(res, 403, { error: 'origin_not_allowed' });
  if (url.pathname === '/health' && req.method === 'GET') {
    try { await pool.query('SELECT 1'); return json(res, 200, { ok: true, service: 'gbquest-mmorpg', websocket: '/ws', database: 'connected' }); }
    catch { return json(res, 503, { ok: false, service: 'gbquest-mmorpg', database: 'unavailable' }); }
  }
  try {
    if (url.pathname === '/api/register' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown'; if (authThrottled(ip)) return json(res, 429, { error: 'too_many_auth_attempts' });
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username) || password.length < 10 || password.length > 72) return json(res, 400, { error: 'username_3_16_and_password_10_72_required' });
      const salt = crypto.randomBytes(16); const hash = await scrypt(password, salt);
      const id = crypto.randomUUID();
      try { await pool.query('INSERT INTO accounts(id,username,password_salt,password_hash) VALUES($1,$2,$3,$4)', [id, username, salt, hash]); }
      catch (e) { if (e.code === '23505') return json(res, 409, { error: 'username_taken' }); throw e; }
      return json(res, 201, { token: issueToken(id), account: { id, username } });
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown'; if (authThrottled(ip)) return json(res, 429, { error: 'too_many_auth_attempts' });
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const result = await pool.query('SELECT id,username,password_salt,password_hash,disabled FROM accounts WHERE lower(username)=lower($1)', [username]);
      if (!result.rowCount || result.rows[0].disabled) { await scrypt(password.slice(0, 72), crypto.randomBytes(16)); recordAuthFailure(ip); return json(res, 401, { error: 'invalid_credentials' }); }
      const acct = result.rows[0], candidate = await scrypt(password, acct.password_salt);
      if (candidate.length !== acct.password_hash.length || !crypto.timingSafeEqual(candidate, acct.password_hash)) { recordAuthFailure(ip); return json(res, 401, { error: 'invalid_credentials' }); }
      authLimiter.clear(ip);
      return json(res, 200, { token: issueToken(acct.id), account: { id: acct.id, username: acct.username } });
    }
    if (url.pathname === '/api/me' && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const chars = await pool.query('SELECT id,name,class,level,zone_id,x,y,hp,max_hp,mp,max_mp,xp FROM characters WHERE account_id=$1 ORDER BY created_at', [acct.id]);
      return json(res, 200, { account: { id: acct.id, username: acct.username }, characters: chars.rows });
    }
    if (url.pathname === '/api/characters' && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), name = String(body.name || '').trim(), cls = String(body.class || 'adventurer');
      if (!/^[A-Za-z][A-Za-z0-9 _-]{2,15}$/.test(name) || !['warrior','mage','ranger','cleric','rogue','adventurer'].includes(cls)) return json(res, 400, { error: 'invalid_character' });
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        // Serialize character creation per account so parallel requests cannot bypass the three-character cap.
        const accountLock = await tx.query('SELECT id FROM accounts WHERE id=$1 AND disabled=false FOR UPDATE', [acct.id]);
        if (!accountLock.rowCount) { await tx.query('ROLLBACK'); return json(res, 401, { error: 'unauthorized' }); }
        const count = await tx.query('SELECT count(*)::int AS n FROM characters WHERE account_id=$1', [acct.id]);
        if (count.rows[0].n >= 3) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'character_limit_reached' }); }
        const id = crypto.randomUUID();
        const result = await tx.query('INSERT INTO characters(id,account_id,name,class) VALUES($1,$2,$3,$4) RETURNING id,name,class,level,zone_id,x,y,hp,max_hp,mp,max_mp,xp', [id, acct.id, name, cls]);
        await tx.query(`INSERT INTO character_inventory(character_id,item_id,quantity)
          VALUES ($1,'rusty_sword',1),($1,'traveler_tunic',1),($1,'minor_potion',5)`, [id]);
        await tx.query('COMMIT');
        return json(res, 201, { character: result.rows[0] });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    if (url.pathname === '/api/characters' && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const result = await pool.query('SELECT id,name,class,level,zone_id,x,y,hp,max_hp,mp,max_mp,xp FROM characters WHERE account_id=$1 ORDER BY created_at', [acct.id]);
      return json(res, 200, { characters: result.rows });
    }
    const inventoryMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/inventory$/i);
    if (inventoryMatch && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const characterId = inventoryMatch[1];
      const owned = await pool.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2', [characterId, acct.id]);
      if (!owned.rowCount) return json(res, 404, { error: 'character_not_found' });
      const result = await pool.query(`
        SELECT ci.id AS inventory_id, ci.item_id, ic.name, ic.description, ic.item_type,
               ic.equip_slot, ic.level_required, ic.stats, ci.quantity,
               (ce.inventory_id IS NOT NULL) AS equipped
        FROM character_inventory ci
        JOIN item_catalog ic ON ic.id=ci.item_id
        LEFT JOIN character_equipment ce ON ce.inventory_id=ci.id AND ce.character_id=ci.character_id
        WHERE ci.character_id=$1 ORDER BY ic.item_type, ic.name`, [characterId]);
      return json(res, 200, { characterId, items: result.rows });
    }
    const equipMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/equip$/i);
    if (equipMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req);
      const characterId = equipMatch[1], inventoryId = String(body.inventoryId || '');
      if (!/^[0-9a-f-]{36}$/i.test(inventoryId)) return json(res, 400, { error: 'invalid_inventory_id' });
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const owned = await tx.query('SELECT level FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, acct.id]);
        if (!owned.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'character_not_found' }); }
        const item = await tx.query(`SELECT ci.id,ic.equip_slot,ic.level_required
          FROM character_inventory ci JOIN item_catalog ic ON ic.id=ci.item_id
          WHERE ci.id=$1 AND ci.character_id=$2 FOR UPDATE OF ci`, [inventoryId, characterId]);
        if (!item.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'inventory_item_not_found' }); }
        const entry = item.rows[0];
        if (!entry.equip_slot) { await tx.query('ROLLBACK'); return json(res, 400, { error: 'item_not_equippable' }); }
        if (owned.rows[0].level < entry.level_required) { await tx.query('ROLLBACK'); return json(res, 403, { error: 'level_requirement_not_met' }); }
        await tx.query(`INSERT INTO character_equipment(character_id,slot,inventory_id)
          VALUES($1,$2,$3) ON CONFLICT(character_id,slot)
          DO UPDATE SET inventory_id=EXCLUDED.inventory_id,equipped_at=now()`, [characterId, entry.equip_slot, inventoryId]);
        const equipped = await tx.query('SELECT slot,inventory_id FROM character_equipment WHERE character_id=$1 ORDER BY slot', [characterId]);
        await tx.query('COMMIT');
        return json(res, 200, { equipped: equipped.rows });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    const unequipMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/unequip$/i);
    if (unequipMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), slot = String(body.slot || '');
      if (!['main_hand','off_hand','head','chest','legs','feet','hands','accessory'].includes(slot)) return json(res, 400, { error: 'invalid_equipment_slot' });
      const result = await pool.query(`DELETE FROM character_equipment ce USING characters c
        WHERE ce.character_id=c.id AND c.id=$1 AND c.account_id=$2 AND ce.slot=$3 RETURNING ce.slot`, [unequipMatch[1], acct.id, slot]);
      if (!result.rowCount) return json(res, 404, { error: 'equipped_item_not_found' });
      return json(res, 200, { unequipped: result.rows[0].slot });
    }
    return json(res, 404, { error: 'not_found' });
  } catch (error) { console.error('MMO HTTP error:', error.message); return json(res, error.status || 500, { error: error.status ? error.message : 'internal_server_error' }); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://localhost').pathname !== '/ws' || !originAllowed(req)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => { wss.emit('connection', ws, req); });
});
wss.on('connection', (ws, req) => attachSocket(ws, req));
const respawnTimer = setInterval(async () => {
  try {
    const result = await pool.query("UPDATE world_mobs SET hp=max_hp,alive=true,respawn_at=NULL,updated_at=now() WHERE alive=false AND respawn_at IS NOT NULL AND respawn_at<=now() RETURNING id,zone_id,name,level,x,y,hp,max_hp");
    for (const mob of result.rows) broadcastZone(mob.zone_id, 'world.mob_spawned', { mob });
  } catch (error) { console.error('Mob respawn worker failed:', error.message); }
}, 10000);
respawnTimer.unref();
server.listen(PORT, HOST, () => console.log('GB Quest authoritative MMO service listening on ' + HOST + ':' + PORT));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); process.exit(0); });
