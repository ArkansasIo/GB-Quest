#!/usr/bin/env node
'use strict';
// Dedicated authoritative MMORPG service for GB Quest.
// HTTP: health, account registration/login, character CRUD.
// WSS: authenticated sessions, zone snapshots, movement, combat intents and chat.
// REGIONS & REALMS (WoW-style): GET /api/regions and /api/realms list each region's realms with live population.
// A character is created on one realm; each realm is its own copy of the world: players only see, fight beside
// and chat with others on the same realm. Chat channels: zone, realm, whisper (by name, same realm).
const http = require('node:http');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { WebSocketServer, WebSocket } = require('ws');
const { isAllowedOrigin, createCorsHeaders, createAuthLimiter, createRequestLimiter } = require('./mmorpg-security.cjs');
const { handlePartyRequest } = require('./mmorpg-party-routes.cjs');
const { handleGuildRequest } = require('./mmorpg-guild-routes.cjs');
const { handleInstanceRequest } = require('./mmorpg-instance-routes.cjs');
const { handleRaidRequest } = require('./mmorpg-raid-routes.cjs');
const { handleRaidEncounterRequest } = require('./mmorpg-raid-encounter-routes.cjs');
const { handleFriendRequest } = require('./mmorpg-friend-routes.cjs');
const { handleMailRequest, handleAuctionRequest } = require('./mmorpg-economy-routes.cjs');
const { handlePvpRequest } = require('./mmorpg-pvp-routes.cjs');
const { handleWhisperRequest } = require('./mmorpg-whisper-routes.cjs');

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;
const TOKEN_SECRET = process.env.GBQ_TOKEN_SECRET;
const INTERNAL_SECRET = process.env.GBQ_INTERNAL_SECRET || '';
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
const json = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' }); res.end(JSON.stringify(data)); };
async function readBody(req, max = 16384) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw Object.assign(new Error('body_too_large'), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('invalid_json'), { status: 400 }); }
}
function originAllowed(req) { return isAllowedOrigin(req.headers.origin, ALLOWED_ORIGINS); }
async function accountFor(req) {
  const ip = req.socket?.remoteAddress || 'unknown';
  if (authThrottled(ip)) return null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = verifyToken(token);
  if (!claims) { recordAuthFailure(ip); return null; }
  const result = await pool.query('SELECT id, username FROM accounts WHERE id=$1 AND disabled=false', [claims.sub]);
  if (!result.rowCount) { recordAuthFailure(ip); return null; }
  authLimiter.clear(ip);
  return { ...result.rows[0], token };
}
const sessions = new Map(); // accountId -> Set<WebSocket>
const socketState = new WeakMap();
const SERVER_INSTANCE_ID = process.env.GBQ_SERVER_INSTANCE_ID || crypto.randomUUID();
const PRESENCE_TTL_SECONDS = Math.max(30, Number(process.env.GBQ_PRESENCE_TTL_SECONDS || 45));
const WORLD_EVENT_CHANNEL = 'gbquest_world_events';
const socketIds = new WeakMap();
function socketId(ws) {
  let id = socketIds.get(ws);
  if (!id) { id = crypto.randomUUID(); socketIds.set(ws, id); }
  return id;
}
function publishWorldEvent(scope, realmId, zoneId, type, payload, characterId = null) {
  const event = JSON.stringify({ origin: SERVER_INSTANCE_ID, scope, realmId, zoneId, type, payload, characterId });
  if (Buffer.byteLength(event) > 7800) return;
  pool.query('SELECT pg_notify($1, $2)', [WORLD_EVENT_CHANNEL, event])
    .catch(error => console.error('World event publish failed:', error.message));
}
function deliverWorldEvent(event) {
  for (const [ws, state] of activeSockets) {
    if (!state.authenticated || !state.character) continue;
    if (event.scope === 'realm' && state.realmId === event.realmId) send(ws, event.type, event.payload);
    if (event.scope === 'zone' && state.realmId === event.realmId && state.zoneId === event.zoneId) send(ws, event.type, event.payload);
    if (event.scope === 'character' && state.realmId === event.realmId && state.character.id === event.characterId) send(ws, event.type, event.payload);
  }
}
async function persistPresence(ws, state) {
  if (!state.authenticated || !state.character || !state.realmId) return;
  await pool.query(`INSERT INTO world_presence(socket_id,server_instance_id,character_id,realm_id,zone_id,expires_at)
    VALUES($1,$2,$3,$4,$5,now()+($6 * interval '1 second'))
    ON CONFLICT(socket_id) DO UPDATE SET server_instance_id=EXCLUDED.server_instance_id,
    character_id=EXCLUDED.character_id,realm_id=EXCLUDED.realm_id,zone_id=EXCLUDED.zone_id,
    expires_at=EXCLUDED.expires_at,updated_at=now()`,
    [socketId(ws), SERVER_INSTANCE_ID, state.character.id, state.realmId, state.zoneId || 'unknown', PRESENCE_TTL_SECONDS]);
}
async function removePresence(ws) {
  const id = socketIds.get(ws);
  if (id) await pool.query('DELETE FROM world_presence WHERE socket_id=$1', [id]).catch(error => console.error('Presence cleanup failed:', error.message));
}
async function claimRealmPresence(ws, state, realm) {
  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['gbquest:realm-capacity:' + realm.id]);
    const count = await tx.query('SELECT count(*)::int AS n FROM world_presence WHERE realm_id=$1 AND expires_at>now() AND socket_id<>$2', [realm.id, socketId(ws)]);
    const population = count.rows[0].n;
    if (population >= realm.max_players) {
      await tx.query('ROLLBACK');
      return { allowed: false, population };
    }
    await tx.query(`INSERT INTO world_presence(socket_id,server_instance_id,character_id,realm_id,zone_id,expires_at)
      VALUES($1,$2,$3,$4,$5,now()+($6 * interval '1 second'))
      ON CONFLICT(socket_id) DO UPDATE SET server_instance_id=EXCLUDED.server_instance_id,
      character_id=EXCLUDED.character_id,realm_id=EXCLUDED.realm_id,zone_id=EXCLUDED.zone_id,
      expires_at=EXCLUDED.expires_at,updated_at=now()`,
      [socketId(ws), SERVER_INSTANCE_ID, state.character.id, realm.id, state.zoneId || 'unknown', PRESENCE_TTL_SECONDS]);
    await tx.query('COMMIT');
    return { allowed: true, population: population + 1 };
  } catch (error) {
    await tx.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { tx.release(); }
}
function send(ws, type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, sequence: ++socketState.get(ws).outSequence, payload, serverTimestamp: Date.now() }));
}
function broadcastZone(realmId, zoneId, type, payload, except = null) {
  for (const [ws, state] of activeSockets) if (state.authenticated && state.character && state.realmId === realmId && state.zoneId === zoneId && ws !== except) send(ws, type, payload);
  publishWorldEvent('zone', realmId, zoneId, type, payload);
}
function broadcastRealm(realmId, type, payload, except = null) {
  for (const [ws, state] of activeSockets) if (state.authenticated && state.character && state.realmId === realmId && ws !== except) send(ws, type, payload);
  publishWorldEvent('realm', realmId, null, type, payload);
}
// ---------------------------------------------------------------- regions & realms
let REALM_CACHE = { regions: [], realms: [], at: 0 };
async function realmData(force) {
  if (!force && Date.now() - REALM_CACHE.at < 30000 && REALM_CACHE.realms.length) return REALM_CACHE;
  const [regions, realms] = await Promise.all([
    pool.query('SELECT id,name,tag,timezone,status FROM regions ORDER BY sort_order,id'),
    pool.query('SELECT id,region_id,name,realm_type,max_players,status,recommended FROM realms ORDER BY sort_order,id'),
  ]);
  REALM_CACHE = { regions: regions.rows, realms: realms.rows, at: Date.now() };
  return REALM_CACHE;
}
const realmPopulation = realmId => { let n = 0; for (const [, s] of activeSockets) if (s.authenticated && s.character && s.realmId === realmId) n++; return n; };
const realmLoad = (pop, max) => pop >= max ? 'FULL' : pop >= max * 0.75 ? 'HIGH' : pop >= max * 0.35 ? 'MEDIUM' : 'LOW';

let WORLD_STATUS_CACHE = { at: 0, value: null };
async function worldStatus(force = false) {
  if (!force && WORLD_STATUS_CACHE.value && Date.now() - WORLD_STATUS_CACHE.at < 15000) return WORLD_STATUS_CACHE.value;
  const rd = await realmData();
  const [presence, totals, peak] = await Promise.all([
    pool.query(`SELECT realm_id,zone_id,count(*)::int AS players FROM world_presence WHERE expires_at>now() GROUP BY realm_id,zone_id`),
    pool.query('SELECT (SELECT count(*)::int FROM accounts WHERE disabled=false) AS accounts, (SELECT count(*)::int FROM characters) AS characters'),
    pool.query('SELECT peak_concurrent, peak_at FROM world_population_peak WHERE id=true')
  ]);
  const liveByRealm = new Map(), liveByZone = new Map();
  for (const row of presence.rows) {
    liveByRealm.set(row.realm_id, (liveByRealm.get(row.realm_id) || 0) + row.players);
    liveByZone.set(row.realm_id + ':' + row.zone_id, row.players);
  }
  const realms = rd.realms.map(r => ({
    id: r.id, name: r.name, regionId: r.region_id, type: r.realm_type, status: r.status,
    onlinePlayers: liveByRealm.get(r.id) || 0, capacity: r.max_players,
    utilization: Math.round(((liveByRealm.get(r.id) || 0) / r.max_players) * 1000) / 10
  }));
  const regions = rd.regions.map(region => {
    const list = realms.filter(r => r.regionId === region.id);
    return { id: region.id, name: region.name, tag: region.tag, status: region.status,
      onlinePlayers: list.reduce((n, r) => n + r.onlinePlayers, 0),
      capacity: list.filter(r => r.status === 'online').reduce((n, r) => n + r.capacity, 0),
      realms: list };
  });
  const onlinePlayers = realms.reduce((n, r) => n + r.onlinePlayers, 0);
  const capacity = realms.filter(r => r.status === 'online').reduce((n, r) => n + r.capacity, 0);
  const zonePopulation = [...liveByZone.entries()].map(([key, players]) => {
    const [realmId, zoneId] = key.split(':');
    return { realmId, zoneId, onlinePlayers: players };
  }).sort((a, b) => b.onlinePlayers - a.onlinePlayers);
  const currentPeak = Number(peak.rows[0]?.peak_concurrent || 0);
  const peakConcurrent = Math.max(currentPeak, onlinePlayers);
  if (onlinePlayers > currentPeak) {
    await pool.query(`INSERT INTO world_population_peak(id,peak_concurrent,peak_at) VALUES(true,$1,now())
      ON CONFLICT(id) DO UPDATE SET peak_concurrent=GREATEST(world_population_peak.peak_concurrent,EXCLUDED.peak_concurrent),
      peak_at=CASE WHEN EXCLUDED.peak_concurrent > world_population_peak.peak_concurrent THEN EXCLUDED.peak_at ELSE world_population_peak.peak_at END`, [onlinePlayers]);
  }
  const value = {
    generatedAt: new Date().toISOString(), scope: 'all_instances_shared_presence',
    onlinePlayers, capacity, utilization: capacity ? Math.round((onlinePlayers / capacity) * 1000) / 10 : 0,
    peakConcurrent, peakAt: peak.rows[0]?.peak_at || null,
    registeredAccounts: totals.rows[0].accounts, characters: totals.rows[0].characters,
    regions, zones: zonePopulation,
    scaling: { mode: 'postgres_shared_presence', distributedPresence: true, eventBus: 'postgresql_listen_notify', instanceId: SERVER_INSTANCE_ID, note: 'Counts and zone/realm events are shared across service instances through PostgreSQL presence leases and LISTEN/NOTIFY. PostgreSQL NOTIFY is best-effort transient delivery, not a durable message queue.' }
  };
  WORLD_STATUS_CACHE = { at: Date.now(), value };
  return value;
}

function realmView(r, counts = {}) {
  const population = realmPopulation(r.id);
  return { id: r.id, regionId: r.region_id, name: r.name, type: r.realm_type, pvp: r.realm_type === 'PvP', status: r.status,
    maxPlayers: r.max_players, population, load: r.status === 'online' ? realmLoad(population, r.max_players) : r.status.toUpperCase(),
    recommended: !!r.recommended, characters: counts[r.id] || 0 };
}
async function characterCounts(accountId) {
  if (!accountId) return {};
  const q = await pool.query('SELECT realm_id, count(*)::int AS n FROM characters WHERE account_id=$1 GROUP BY realm_id', [accountId]);
  return Object.fromEntries(q.rows.map(r => [r.realm_id, r.n]));
}
// optional sign-in for the public realm list (adds "characters on this realm" without failing when signed out)
async function optionalAccount(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const claims = verifyToken(header.slice(7)); if (!claims) return null;
  const r = await pool.query('SELECT id FROM accounts WHERE id=$1 AND disabled=false', [claims.sub]);
  return r.rowCount ? r.rows[0] : null;
}
const CHAR_COLS = 'id,name,class,level,realm_id,zone_id,x,y,hp,max_hp,mp,max_mp,talent_points,allocated_attributes,specialization_id';
const PER_REALM_CHARACTERS = 3, PER_ACCOUNT_CHARACTERS = 12;
const activeSockets = new Map();
const authLimiter = createAuthLimiter();
const requestLimiter = createRequestLimiter({
  limit: Number(process.env.GBQ_API_WRITE_LIMIT || 90),
  windowMs: Number(process.env.GBQ_API_WRITE_WINDOW_MS || 60000)
});
const authThrottled = ip => authLimiter.blocked(ip);
const recordAuthFailure = ip => authLimiter.fail(ip);
setInterval(() => authLimiter.sweep(), 600000).unref();
setInterval(() => requestLimiter.sweep(), 60000).unref();
function attachSocket(ws, req) {
  const ip = req?.socket?.remoteAddress || 'unknown';
  const state = { authenticated: false, account: null, character: null, realmId: null, zoneId: null, x: 8, y: 8, inSequence: 0, outSequence: 0, lastMove: 0, lastChat: 0, lastAttack: 0, ip };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
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
        const chars = await pool.query(`SELECT ${CHAR_COLS} FROM characters WHERE account_id=$1 ORDER BY created_at`, [state.account.id]);
        const rd = await realmData(), counts = await characterCounts(state.account.id);
        send(ws, 'authenticated', { account: state.account, characters: chars.rows, regions: rd.regions, realms: rd.realms.map(r => realmView(r, counts)) });
        return;
      }
      if (msg.type === 'character.select') {
        const id = String(msg.payload.characterId || '');
        const result = await pool.query(`SELECT ${CHAR_COLS} FROM characters WHERE id=$1 AND account_id=$2`, [id, state.account.id]);
        if (!result.rowCount) return send(ws, 'error', { code: 'character_not_found' });
        const ch = result.rows[0], rd = await realmData(), realm = rd.realms.find(r => r.id === ch.realm_id);
        if (!realm) return send(ws, 'error', { code: 'realm_not_found', realmId: ch.realm_id });
        if (realm.status !== 'online') return send(ws, 'error', { code: 'realm_unavailable', realmId: realm.id, status: realm.status });
        const switchingWithin = state.realmId === realm.id && state.character;
        const previous = state.character ? { realmId: state.realmId, zoneId: state.zoneId, character: state.character, x: state.x, y: state.y } : null;
        state.character = ch; state.realmId = ch.realm_id; state.zoneId = ch.zone_id; state.x = ch.x; state.y = ch.y;
        const admission = await claimRealmPresence(ws, state, realm);
        if (!admission.allowed) {
          state.character = previous?.character || null;
          state.realmId = previous?.realmId || null; state.zoneId = previous?.zoneId || null;
          state.x = previous?.x ?? 8; state.y = previous?.y ?? 8;
          return send(ws, 'error', { code: 'realm_full', realmId: realm.id, population: admission.population, maxPlayers: realm.max_players });
        }
        if (previous) broadcastZone(previous.realmId, previous.zoneId, 'presence.left', { characterId: previous.character.id }, ws);
        const sharedPlayers = await pool.query(`SELECT DISTINCT ON (p.character_id) p.character_id AS id,c.name,c.level,c.x,c.y
          FROM world_presence p JOIN characters c ON c.id=p.character_id
          WHERE p.realm_id=$1 AND p.zone_id=$2 AND p.expires_at>now() AND p.socket_id<>$3
          ORDER BY p.character_id,p.updated_at DESC`, [state.realmId, state.zoneId, socketId(ws)]);
        const players = sharedPlayers.rows;
        const mobs = await pool.query('SELECT id,name,level,x,y,hp,max_hp FROM world_mobs WHERE realm_id=$1 AND zone_id=$2 AND alive=true ORDER BY id', [state.realmId, state.zoneId]);
        send(ws, 'zone.snapshot', { realm: realmView(realm), zoneId: state.zoneId, self: { ...state.character, x: state.x, y: state.y }, players, mobs: mobs.rows });
        broadcastZone(state.realmId, state.zoneId, 'presence.joined', { id: state.character.id, name: state.character.name, level: state.character.level, x: state.x, y: state.y }, ws);
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
        send(ws, 'movement.accepted', update); broadcastZone(state.realmId, state.zoneId, 'presence.moved', update, ws);
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
          const target = await tx.query('SELECT id,spawn_id,name,hp,max_hp,level,zone_id,x,y FROM world_mobs WHERE id=$1 AND realm_id=$2 AND zone_id=$3 AND alive=true FOR UPDATE', [targetId, state.realmId, state.zoneId]);
          if (!target.rowCount) { await tx.query('ROLLBACK'); return send(ws, 'error', { code: 'target_unavailable' }); }
          const mob = target.rows[0];
          const distance = Math.abs(state.x - Number(mob.x)) + Math.abs(state.y - Number(mob.y));
          if (distance > 3) { await tx.query('ROLLBACK'); return send(ws, 'error', { code: 'target_out_of_range' }); }
          const primaryAttribute = ({ warrior: 'str', mage: 'int', ranger: 'dex', cleric: 'wis', rogue: 'dex', adventurer: 'con' })[state.character.class] || 'str';
          const primaryBonus = Math.min(50, Math.max(0, Number(state.character.allocated_attributes?.[primaryAttribute] || 0)) * 2);
          const damage = Math.max(1, Math.min(999, 4 + state.character.level * 2 + primaryBonus + crypto.randomInt(0, 7)));
          const hp = Math.max(0, mob.hp - damage);
          await tx.query('UPDATE world_mobs SET hp=$1,alive=$2,respawn_at=CASE WHEN $2 THEN NULL ELSE now()+interval \'60 seconds\' END,updated_at=now() WHERE id=$3', [hp, hp > 0, mob.id]);
          event = { targetId: mob.id, targetName: mob.name, damage, hp, maxHp: mob.max_hp, defeated: hp === 0, by: state.character.id };
          if (hp === 0) {
            const xp = Math.max(1, Number(mob.level) * 12);
            const baseGold = Number(mob.level) * 5 + crypto.randomInt(0, Number(mob.level) * 3 + 1);
            const progress = await tx.query(`UPDATE characters SET xp=xp+$1,
              level=LEAST(720,level+CASE WHEN xp+$1 >= level*level*100 THEN 1 ELSE 0 END),
              talent_points=LEAST(1000,talent_points+CASE WHEN xp+$1 >= level*level*100 THEN 1 ELSE 0 END),
              gold=gold+$2,updated_at=now() WHERE id=$3 RETURNING xp,level,gold`, [xp, baseGold, state.character.id]);
            state.character.level = progress.rows[0].level;
            const questUpdates = await tx.query(`UPDATE character_quests cq
              SET objective_progress=LEAST(q.objective_required,cq.objective_progress+1),
                  status=CASE WHEN cq.objective_progress+1>=q.objective_required THEN 'completed' ELSE 'active' END,
                  completed_at=CASE WHEN cq.objective_progress+1>=q.objective_required THEN now() ELSE NULL END
              FROM quest_catalog q
              WHERE cq.quest_id=q.id AND cq.character_id=$1 AND cq.status='active'
                AND q.active=true AND q.objective_type='kill_mob' AND q.objective_target_id=$2
              RETURNING q.id,q.name,q.reward_xp,q.reward_gold,cq.objective_progress,cq.status`,
              [state.character.id, mob.spawn_id || mob.id]);
            let questXp = 0, questGold = 0;
            const completedQuests = questUpdates.rows.filter(row => row.status === 'completed');
            for (const quest of completedQuests) {
              questXp += Number(quest.reward_xp);
              questGold += Number(quest.reward_gold);
            }
            if (questXp || questGold) {
              const questPayout = await tx.query(`UPDATE characters SET xp=xp+$1,gold=gold+$2,
                level=LEAST(100,level+CASE WHEN xp+$1 >= level*level*100 THEN 1 ELSE 0 END),
                talent_points=LEAST(1000,talent_points+CASE WHEN xp+$1 >= level*level*100 THEN 1 ELSE 0 END),updated_at=now()
                WHERE id=$3 RETURNING xp,level,gold`, [questXp, questGold, state.character.id]);
              progress.rows[0] = questPayout.rows[0];
              state.character.level = questPayout.rows[0].level;
            }
            const itemDrops = [];
            if (mob.id === '00000000-0000-4000-8000-000000000001' && crypto.randomInt(100) < 35) {
              const dropped = await tx.query(`INSERT INTO character_inventory(character_id,item_id,quantity)
                VALUES($1,'slime_gel',1)
                ON CONFLICT(character_id,item_id) DO UPDATE
                SET quantity=LEAST(99,character_inventory.quantity+1)
                RETURNING item_id,quantity`, [state.character.id]);
              itemDrops.push({ itemId: 'slime_gel', quantity: 1, stackQuantity: dropped.rows[0].quantity });
            }
            reward = {
              xp: xp + questXp, baseXp: xp, totalXp: Number(progress.rows[0].xp),
              level: progress.rows[0].level, gold: baseGold + questGold,
              totalGold: Number(progress.rows[0].gold), itemDrops, completedQuests,
              questUpdates: questUpdates.rows, source: mob.id
            };
          }
          await tx.query('COMMIT');
        } catch (error) {
          await tx.query('ROLLBACK').catch(() => {});
          throw error;
        } finally { tx.release(); }
        broadcastZone(state.realmId, state.zoneId, 'combat.resolved', event);
        if (reward) send(ws, 'loot.reward', reward);
        return;
      }
      if (msg.type === 'chat.send') {
        const t = Date.now(); if (t - state.lastChat < 1200) return send(ws, 'error', { code: 'chat_rate_limited' });
        state.lastChat = t;
        const text = String(msg.payload.text || '').trim();
        if (!text || text.length > 180 || /[\u0000-\u001f\u007f]/.test(text)) return send(ws, 'error', { code: 'invalid_chat' });
        const channel = ['zone', 'realm', 'whisper'].includes(msg.payload.channel) ? msg.payload.channel : 'zone';
        const message = { characterId: state.character.id, name: state.character.name, text, channel, realmId: state.realmId, zoneId: state.zoneId, at: Date.now() };
        if (channel === 'realm' || channel === 'zone') {
          const saved = await pool.query(`INSERT INTO world_chat_messages(realm_id,zone_id,channel,sender_character_id,message)
            VALUES($1,$2,$3,$4,$5) RETURNING id,created_at`,
            [state.realmId, channel === 'zone' ? state.zoneId : null, channel, state.character.id, text]);
          message.id = saved.rows[0].id;
          message.at = new Date(saved.rows[0].created_at).getTime();
          if (channel === 'realm') { broadcastRealm(state.realmId, 'chat.message', message); return; }
        }
        if (channel === 'whisper') {
          const to = String(msg.payload.to || '').trim();
          if (!/^[a-z0-9 _-]{3,24}$/i.test(to)) return send(ws, 'error', { code: 'invalid_whisper_target' });
          // Resolve by realm, not online presence: offline recipients can read persisted history later.
          const recipient = await pool.query(
            'SELECT id,name FROM characters WHERE realm_id=$1 AND lower(name)=lower($2) LIMIT 1',
            [state.realmId, to]
          );
          if (!recipient.rowCount) return send(ws, 'error', { code: 'whisper_target_not_found', to });
          const targetCharacter = recipient.rows[0];
          if (targetCharacter.id === state.character.id) return send(ws, 'error', { code: 'cannot_whisper_self' });
          const blocked = await pool.query(
            "SELECT 1 FROM player_friends WHERE status='blocked' AND ((character_id=$1 AND friend_character_id=$2) OR (character_id=$2 AND friend_character_id=$1)) LIMIT 1",
            [state.character.id, targetCharacter.id]
          );
          if (blocked.rowCount) return send(ws, 'error', { code: 'whisper_blocked' });
          const saved = await pool.query(
            `INSERT INTO player_whispers(realm_id,sender_character_id,recipient_character_id,message)
             VALUES($1,$2,$3,$4) RETURNING id,created_at`,
            [state.realmId, state.character.id, targetCharacter.id, text]
          );
          const w = { ...message, id: saved.rows[0].id, at: new Date(saved.rows[0].created_at).getTime(),
            to: targetCharacter.name, recipientCharacterId: targetCharacter.id, channel: 'whisper' };
          const local = [...activeSockets.entries()].find(([, targetState]) =>
            targetState.authenticated && targetState.character?.id === targetCharacter.id && targetState.realmId === state.realmId);
          if (local && local[0] !== ws) send(local[0], 'chat.message', w);
          else if (!local) publishWorldEvent('character', state.realmId, null, 'chat.message', w, targetCharacter.id);
          send(ws, 'chat.message', w);
          return;
        }
        broadcastZone(state.realmId, state.zoneId, 'chat.message', message);
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
    removePresence(ws);
    if (state.zoneId && state.character) broadcastZone(state.realmId, state.zoneId, 'presence.left', { characterId: state.character.id });
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const cors = createCorsHeaders(req.headers.origin, ALLOWED_ORIGINS);
  if (!cors) return json(res, 403, { error: 'origin_not_allowed' });
  for (const [name, value] of Object.entries(cors)) res.setHeader(name, value);
  if (req.method === 'OPTIONS') {
    const requestedMethod = String(req.headers['access-control-request-method'] || '').toUpperCase();
    const requestedHeaders = String(req.headers['access-control-request-headers'] || '')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if ((requestedMethod && !['GET', 'POST', 'DELETE'].includes(requestedMethod)) ||
        requestedHeaders.some(header => !['authorization', 'content-type'].includes(header))) {
      return json(res, 403, { error: 'cors_preflight_not_allowed' });
    }
    res.writeHead(204);
    return res.end();
  }
  if (url.pathname.startsWith('/api/') && ['POST', 'DELETE'].includes(req.method) &&
      !['/api/login', '/api/register'].includes(url.pathname)) {
    const ip = req.socket?.remoteAddress || 'unknown';
    const rate = requestLimiter.consume(ip + ':api-write');
    res.setHeader('x-ratelimit-limit', String(Number(process.env.GBQ_API_WRITE_LIMIT || 90)));
    res.setHeader('x-ratelimit-remaining', String(rate.remaining));
    if (!rate.allowed) {
      res.setHeader('retry-after', String(rate.retryAfter));
      return json(res, 429, { error: 'api_write_rate_limited', retryAfter: rate.retryAfter });
    }
  }
  if (url.pathname === '/health' && req.method === 'GET') {
    try { await pool.query('SELECT 1'); return json(res, 200, { ok: true, service: 'gbquest-mmorpg', websocket: '/ws', database: 'connected' }); }
    catch { return json(res, 503, { ok: false, service: 'gbquest-mmorpg', database: 'unavailable' }); }
  }
  try {
    if (await handlePartyRequest({ req, res, url, pool, accountFor, readBody, json })) return;
    if (await handleGuildRequest({ req, res, url, pool, accountFor, readBody, json })) return;
    if (await handleInstanceRequest({ req, res, url, pool, accountFor, readBody, json })) return;
    if (await handleFriendRequest({ req, res, url, pool, accountFor, readBody, json })) return;
    if (await handleMailRequest({ req, res, url, pool, accountFor, readBody, json })) return;
    if (await handleAuctionRequest({ req, res, url, pool, accountFor, readBody, json })) return;
    if (await handlePvpRequest({ req, res, url, pool, accountFor, readBody, json })) return;
    if (await handleWhisperRequest({ req, res, url, pool, accountFor, json })) return;
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
      const chars = await pool.query(`SELECT ${CHAR_COLS},xp FROM characters WHERE account_id=$1 ORDER BY created_at`, [acct.id]);
      return json(res, 200, { account: { id: acct.id, username: acct.username }, characters: chars.rows });
    }
    if (url.pathname === '/api/characters' && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), name = String(body.name || '').trim(), cls = String(body.class || 'adventurer');
      const rd = await realmData(), realmId = String(body.realmId || body.realm || rd.realms[0]?.id || 'ardenhold'), realm = rd.realms.find(r => r.id === realmId);
      if (!realm) return json(res, 400, { error: 'unknown_realm', realmId });
      if (realm.status !== 'online') return json(res, 409, { error: 'realm_unavailable', realmId, status: realm.status });
      if (!/^[A-Za-z][A-Za-z0-9 _-]{2,15}$/.test(name) || !['warrior','mage','ranger','cleric','rogue','adventurer'].includes(cls)) return json(res, 400, { error: 'invalid_character' });
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        // Serialize character creation per account so parallel requests cannot bypass the three-character cap.
        const accountLock = await tx.query('SELECT id FROM accounts WHERE id=$1 AND disabled=false FOR UPDATE', [acct.id]);
        if (!accountLock.rowCount) { await tx.query('ROLLBACK'); return json(res, 401, { error: 'unauthorized' }); }
        const count = await tx.query('SELECT count(*)::int AS n, count(*) FILTER (WHERE realm_id=$2)::int AS here FROM characters WHERE account_id=$1', [acct.id, realmId]);
        if (count.rows[0].here >= PER_REALM_CHARACTERS || count.rows[0].n >= PER_ACCOUNT_CHARACTERS) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'character_limit_reached', perRealm: PER_REALM_CHARACTERS, perAccount: PER_ACCOUNT_CHARACTERS }); }
        const taken = await tx.query('SELECT 1 FROM characters WHERE realm_id=$1 AND lower(name)=lower($2)', [realmId, name]);
        if (taken.rowCount) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'name_taken', realmId }); }
        const id = crypto.randomUUID();
        const result = await tx.query(`INSERT INTO characters(id,account_id,name,class,realm_id) VALUES($1,$2,$3,$4,$5) RETURNING ${CHAR_COLS},xp`, [id, acct.id, name, cls, realmId]);
        await tx.query(`INSERT INTO character_inventory(character_id,item_id,quantity)
          VALUES ($1,'rusty_sword',1),($1,'traveler_tunic',1),($1,'minor_potion',5)`, [id]);
        await tx.query('COMMIT');
        return json(res, 201, { character: result.rows[0] });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        if (error && error.code === '23505') return json(res, 409, { error: 'name_taken', realmId }); // unique (realm, name) race
        throw error;
      } finally { tx.release(); }
    }
    if (url.pathname === '/api/characters' && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const realm = url.searchParams.get('realm');
      const result = realm
        ? await pool.query(`SELECT ${CHAR_COLS},xp FROM characters WHERE account_id=$1 AND realm_id=$2 ORDER BY created_at`, [acct.id, realm])
        : await pool.query(`SELECT ${CHAR_COLS},xp FROM characters WHERE account_id=$1 ORDER BY created_at`, [acct.id]);
      return json(res, 200, { characters: result.rows });
    }
    const profileMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/profile$/i);
    if (profileMatch && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const characterId = profileMatch[1];
      const owned = await pool.query(`SELECT c.id,c.name,c.class,c.level,c.xp,c.realm_id,c.zone_id,c.x,c.y,
        c.hp,c.max_hp,c.mp,c.max_mp,c.gold,c.bank_gold,c.talent_points,c.allocated_attributes,
        c.unlocked_talents,c.created_at,c.updated_at,r.name AS realm_name
        FROM characters c JOIN realms r ON r.id=c.realm_id
        WHERE c.id=$1 AND c.account_id=$2`, [characterId, acct.id]);
      if (!owned.rowCount) return json(res, 404, { error: 'character_not_found' });
    if (url.pathname === '/api/talents' && req.method === 'GET') {
      const classId = String(url.searchParams.get('class') || '').toLowerCase();
      if (!['warrior','mage','ranger','cleric','rogue','adventurer'].includes(classId)) {
        return json(res, 400, { error: 'invalid_class' });
      }
      const trees = await pool.query(`SELECT s.id,s.class_id,s.name,s.role,s.description,
        COALESCE(json_agg(json_build_object('id',n.id,'index',n.node_index,'branch',n.branch,
          'type',n.node_type,'name',n.name,'description',n.description,'requiredLevel',n.required_level,
          'pointCost',n.point_cost,'effect',n.effect,'prerequisiteId',n.prerequisite_id)
          ORDER BY n.node_index) FILTER (WHERE n.id IS NOT NULL),'[]'::json) AS nodes
        FROM mmorpg_talent_specializations s LEFT JOIN mmorpg_talent_nodes n ON n.specialization_id=s.id
        WHERE s.class_id=$1 GROUP BY s.id ORDER BY s.name`, [classId]);
      return json(res, 200, { class: classId, specializations: trees.rows });
    }
    const specializationMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/specialization$/i);
    if (specializationMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), specializationId = String(body.specializationId || '');
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const chosen = await tx.query(`SELECT s.id,s.class_id,s.name FROM mmorpg_talent_specializations s
          JOIN characters c ON c.class=s.class_id
          WHERE s.id=$1 AND c.id=$2 AND c.account_id=$3`, [specializationId, specializationMatch[1], acct.id]);
        if (!chosen.rowCount) {
          const owned = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [specializationMatch[1], acct.id]);
          await tx.query('ROLLBACK');
          return json(res, owned.rowCount ? 400 : 404, { error: owned.rowCount ? 'specialization_class_mismatch' : 'character_not_found' });
        }
        const current = await tx.query('SELECT specialization_id FROM characters WHERE id=$1 FOR UPDATE', [specializationMatch[1]]);
        if (current.rows[0].specialization_id && current.rows[0].specialization_id !== specializationId) {
          const learned = await tx.query('SELECT 1 FROM character_talent_unlocks WHERE character_id=$1 LIMIT 1', [specializationMatch[1]]);
          if (learned.rowCount) {
            await tx.query('ROLLBACK');
            return json(res, 409, { error: 'specialization_locked', message: 'A specialization cannot be changed after learning talents.' });
          }
        }
        await tx.query('UPDATE characters SET specialization_id=$1,updated_at=now() WHERE id=$2', [specializationId, specializationMatch[1]]);
        await tx.query('COMMIT');
        return json(res, 200, { specialization: chosen.rows[0] });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    const talentUnlockMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/talents\/([a-z0-9_]{1,80})\/unlock$/i);
    if (talentUnlockMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const [, characterId, nodeId] = talentUnlockMatch;
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const result = await tx.query(`SELECT c.level,c.talent_points,c.specialization_id,n.id,n.required_level,
          n.point_cost,n.prerequisite_id,n.name,s.class_id
          FROM characters c JOIN mmorpg_talent_specializations s ON s.id=c.specialization_id
          JOIN mmorpg_talent_nodes n ON n.specialization_id=s.id
          WHERE c.id=$1 AND c.account_id=$2 AND n.id=$3 FOR UPDATE OF c`, [characterId, acct.id, nodeId]);
        if (!result.rowCount) {
          const owned = await tx.query('SELECT id,specialization_id FROM characters WHERE id=$1 AND account_id=$2', [characterId, acct.id]);
          await tx.query('ROLLBACK');
          return json(res, owned.rowCount ? 409 : 404, { error: owned.rowCount ? 'specialization_not_selected_or_node_mismatch' : 'character_not_found' });
        }
        const node = result.rows[0];
        if (Number(node.level) < Number(node.required_level)) {
          await tx.query('ROLLBACK');
          return json(res, 409, { error: 'talent_level_requirement', requiredLevel: node.required_level, level: node.level });
        }
        if (Number(node.talent_points) < Number(node.point_cost)) {
          await tx.query('ROLLBACK');
          return json(res, 409, { error: 'insufficient_talent_points', talentPoints: node.talent_points, pointCost: node.point_cost });
        }
        if (node.prerequisite_id) {
          const prerequisite = await tx.query('SELECT 1 FROM character_talent_unlocks WHERE character_id=$1 AND node_id=$2', [characterId, node.prerequisite_id]);
          if (!prerequisite.rowCount) {
            await tx.query('ROLLBACK');
            return json(res, 409, { error: 'talent_prerequisite_locked', prerequisiteId: node.prerequisite_id });
          }
        }
        const inserted = await tx.query('INSERT INTO character_talent_unlocks(character_id,node_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING node_id', [characterId, nodeId]);
        if (!inserted.rowCount) {
          await tx.query('ROLLBACK');
          return json(res, 409, { error: 'talent_already_unlocked' });
        }
        const spent = await tx.query('UPDATE characters SET talent_points=talent_points-$1,updated_at=now() WHERE id=$2 RETURNING talent_points', [node.point_cost, characterId]);
        await tx.query('COMMIT');
        return json(res, 200, { unlocked: nodeId, name: node.name, talentPoints: spent.rows[0].talent_points });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
      const [inventory, quests, equipment] = await Promise.all([
        pool.query(`SELECT ci.id AS inventory_id,ci.item_id,ic.name,ic.description,ic.item_type,
          ic.equip_slot,ic.level_required,ic.stats,ci.quantity,
          (ce.inventory_id IS NOT NULL) AS equipped
          FROM character_inventory ci JOIN item_catalog ic ON ic.id=ci.item_id
          LEFT JOIN character_equipment ce ON ce.inventory_id=ci.id AND ce.character_id=ci.character_id
          WHERE ci.character_id=$1 ORDER BY ic.item_type,ic.name`, [characterId]),
        pool.query(`SELECT cq.quest_id,q.name,q.description,cq.status,cq.objective_progress,
          q.objective_required,q.reward_xp,q.reward_gold,cq.accepted_at,cq.completed_at
          FROM character_quests cq JOIN quest_catalog q ON q.id=cq.quest_id
          WHERE cq.character_id=$1 ORDER BY cq.accepted_at DESC`, [characterId]),
        pool.query('SELECT slot,inventory_id,equipped_at FROM character_equipment WHERE character_id=$1 ORDER BY slot', [characterId])
      ]);
      return json(res, 200, { character: owned.rows[0], inventory: inventory.rows, quests: quests.rows, equipment: equipment.rows });
    }
    const attributeMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/attributes$/i);
    if (attributeMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), attribute = String(body.attribute || '').toLowerCase();
      const points = Number(body.points === undefined ? 1 : body.points);
      if (!['str','dex','con','int','wis','vit'].includes(attribute) ||
          !Number.isSafeInteger(points) || points < 1 || points > 20) {
        return json(res, 400, { error: 'invalid_attribute_allocation' });
      }
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const result = await tx.query(`UPDATE characters
          SET talent_points=talent_points-$1,
              allocated_attributes=jsonb_set(allocated_attributes,ARRAY[$2],
                to_jsonb(COALESCE((allocated_attributes->>$2)::integer,0)+$1),true),
              updated_at=now()
          WHERE id=$3 AND account_id=$4 AND talent_points >= $1
            AND COALESCE((allocated_attributes->>$2)::integer,0)+$1 <= 100
          RETURNING talent_points,allocated_attributes`, [points, attribute, attributeMatch[1], acct.id]);
        if (!result.rowCount) {
          const owned = await tx.query('SELECT talent_points,allocated_attributes FROM characters WHERE id=$1 AND account_id=$2', [attributeMatch[1], acct.id]);
          await tx.query('ROLLBACK');
          if (!owned.rowCount) return json(res, 404, { error: 'character_not_found' });
          const current = Number(owned.rows[0].allocated_attributes?.[attribute] || 0);
          return json(res, 409, { error: current + points > 100 ? 'attribute_cap_reached' : 'insufficient_talent_points',
            talentPoints: owned.rows[0].talent_points, allocatedAttributes: owned.rows[0].allocated_attributes });
        }
        await tx.query('COMMIT');
        return json(res, 200, { talentPoints: result.rows[0].talent_points, allocatedAttributes: result.rows[0].allocated_attributes });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    if (url.pathname === '/api/world/status' && req.method === 'GET') {
      return json(res, 200, await worldStatus(url.searchParams.get('refresh') === '1'));
    }
    if (url.pathname === '/api/regions' && req.method === 'GET') {
      const rd = await realmData(), acct = await optionalAccount(req), counts = await characterCounts(acct && acct.id);
      return json(res, 200, { regions: rd.regions.map(g => ({ ...g, realms: rd.realms.filter(r => r.region_id === g.id).map(r => realmView(r, counts)) })) });
    }
    if (url.pathname === '/api/realms' && req.method === 'GET') {
      const rd = await realmData(), acct = await optionalAccount(req), counts = await characterCounts(acct && acct.id), region = url.searchParams.get('region');
      return json(res, 200, { realms: rd.realms.filter(r => !region || r.region_id === region).map(r => realmView(r, counts)) });
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
    const useItemMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/use-item$/i);
    if (useItemMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), inventoryId = String(body.inventoryId || '');
      if (!/^[0-9a-f-]{36}$/i.test(inventoryId)) return json(res, 400, { error: 'invalid_inventory_id' });
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const character = await tx.query('SELECT id,hp,max_hp,mp,max_mp FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [useItemMatch[1], acct.id]);
        if (!character.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'character_not_found' }); }
        const item = await tx.query(`SELECT ci.id,ci.item_id,ci.quantity,ic.item_type,ic.stats
          FROM character_inventory ci JOIN item_catalog ic ON ic.id=ci.item_id
          WHERE ci.id=$1 AND ci.character_id=$2 FOR UPDATE OF ci`, [inventoryId, character.rows[0].id]);
        if (!item.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'inventory_item_not_found' }); }
        const entry = item.rows[0];
        if (entry.item_type !== 'consumable') { await tx.query('ROLLBACK'); return json(res, 400, { error: 'item_not_consumable' }); }
        const heal = Math.max(0, Math.min(1000, Number(entry.stats?.heal) || 0));
        const restoreMp = Math.max(0, Math.min(1000, Number(entry.stats?.restoreMp) || 0));
        if (!heal && !restoreMp) { await tx.query('ROLLBACK'); return json(res, 400, { error: 'item_has_no_usable_effect' }); }
        const current = character.rows[0];
        if ((!heal || Number(current.hp) >= Number(current.max_hp)) && (!restoreMp || Number(current.mp) >= Number(current.max_mp))) {
          await tx.query('ROLLBACK'); return json(res, 409, { error: 'resources_already_full' });
        }
        const updated = await tx.query(`UPDATE characters SET hp=LEAST(max_hp,hp+$1),mp=LEAST(max_mp,mp+$2),updated_at=now()
          WHERE id=$3 RETURNING hp,max_hp,mp,max_mp`, [heal, restoreMp, current.id]);
        if (entry.quantity === 1) await tx.query('DELETE FROM character_inventory WHERE id=$1', [entry.id]);
        else await tx.query('UPDATE character_inventory SET quantity=quantity-1 WHERE id=$1', [entry.id]);
        await tx.query('COMMIT');
        return json(res, 200, { consumed: entry.item_id, remaining: entry.quantity - 1, resources: updated.rows[0] });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    if (url.pathname === '/api/vendors' && req.method === 'GET') {
      const vendors = await pool.query(`SELECT v.id,v.name,v.zone_id,COUNT(vs.item_id)::int AS catalogue_size
        FROM npc_vendors v LEFT JOIN vendor_stock vs ON vs.vendor_id=v.id
        WHERE v.active=true GROUP BY v.id ORDER BY v.name`);
      return json(res, 200, { vendors: vendors.rows });
    }
    const vendorMatch = url.pathname.match(/^\/api\/vendors\/([a-z0-9_-]{1,48})$/i);
    if (vendorMatch && req.method === 'GET') {
      const vendor = await pool.query(`SELECT v.id,v.name,v.zone_id,ic.id AS item_id,ic.name AS item_name,
        ic.description,ic.item_type,ic.max_stack,ic.level_required,ic.stats,vs.buy_price,vs.sell_price,vs.stock
        FROM npc_vendors v JOIN vendor_stock vs ON vs.vendor_id=v.id
        JOIN item_catalog ic ON ic.id=vs.item_id
        WHERE v.id=$1 AND v.active=true ORDER BY ic.name`, [vendorMatch[1]]);
      if (!vendor.rowCount) return json(res, 404, { error: 'vendor_not_found' });
      return json(res, 200, { vendor: { id: vendor.rows[0].id, name: vendor.rows[0].name, zoneId: vendor.rows[0].zone_id },
        items: vendor.rows.map(({id,name,zone_id,...item}) => item) });
    }
    const vendorTradeMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/vendor\/(buy|sell)$/i);
    if (vendorTradeMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), vendorId = String(body.vendorId || ''), itemId = String(body.itemId || '');
      const quantity = Number(body.quantity);
      if (!/^[a-z0-9_-]{1,48}$/i.test(vendorId) || !/^[a-z0-9_-]{1,48}$/i.test(itemId) ||
          !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
        return json(res, 400, { error: 'invalid_trade_request' });
      }
      const action = vendorTradeMatch[2].toLowerCase(), characterId = vendorTradeMatch[1];
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const character = await tx.query('SELECT id,gold,zone_id,level FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, acct.id]);
        if (!character.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'character_not_found' }); }
        const vendor = await tx.query('SELECT id,zone_id FROM npc_vendors WHERE id=$1 AND active=true FOR SHARE', [vendorId]);
        if (!vendor.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'vendor_not_found' }); }
        if (vendor.rows[0].zone_id !== character.rows[0].zone_id) {
          await tx.query('ROLLBACK'); return json(res, 403, { error: 'vendor_not_in_character_zone' });
        }
        const listing = await tx.query(`SELECT vs.buy_price,vs.sell_price,vs.stock,ic.max_stack,ic.level_required
          FROM vendor_stock vs JOIN item_catalog ic ON ic.id=vs.item_id
          WHERE vs.vendor_id=$1 AND vs.item_id=$2 FOR UPDATE OF vs`, [vendorId,itemId]);
        if (!listing.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'item_not_sold_here' }); }
        const price = BigInt(action === 'buy' ? listing.rows[0].buy_price : listing.rows[0].sell_price);
        if (price <= 0n) { await tx.query('ROLLBACK'); return json(res, 400, { error: 'item_not_tradeable' }); }
        const total = price * BigInt(quantity);
        if (action === 'buy') {
          const item = listing.rows[0];
          if (item.stock !== null && Number(item.stock) < quantity) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'vendor_out_of_stock' }); }
          if (total > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(character.rows[0].gold) < total) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'insufficient_gold' }); }
          if (Number(character.rows[0].level) < Number(item.level_required)) { await tx.query('ROLLBACK'); return json(res, 403, { error: 'level_requirement_not_met' }); }
          const existing = await tx.query('SELECT id,quantity FROM character_inventory WHERE character_id=$1 AND item_id=$2 FOR UPDATE', [characterId,itemId]);
          if (existing.rowCount && Number(existing.rows[0].quantity)+quantity > Number(item.max_stack)) {
            await tx.query('ROLLBACK'); return json(res, 409, { error: 'inventory_stack_limit' });
          }
          
          if (item.stock !== null) await tx.query('UPDATE vendor_stock SET stock=stock-$1 WHERE vendor_id=$2 AND item_id=$3', [quantity,vendorId,itemId]);
          if (existing.rowCount) await tx.query('UPDATE character_inventory SET quantity=quantity+$1 WHERE id=$2', [quantity,existing.rows[0].id]);
          else await tx.query('INSERT INTO character_inventory(character_id,item_id,quantity) VALUES($1,$2,$3)', [characterId,itemId,quantity]);
          const wallet = await tx.query('UPDATE characters SET gold=gold-$1,updated_at=now() WHERE id=$2 RETURNING gold', [total.toString(),characterId]);
          await tx.query(`INSERT INTO economy_transactions(character_id,vendor_id,item_id,action,quantity,unit_price,gold_delta)
            VALUES($1,$2,$3,'buy',$4,$5,$6)`, [characterId,vendorId,itemId,quantity,price.toString(),(-total).toString()]);
          await tx.query('COMMIT');
          return json(res, 200, { action,itemId,quantity,totalGold:total.toString(),gold:Number(wallet.rows[0].gold) });
        }
        const inventoryId = String(body.inventoryId || '');
        if (!/^[0-9a-f-]{36}$/i.test(inventoryId)) { await tx.query('ROLLBACK'); return json(res, 400, { error: 'invalid_inventory_id' }); }
        const inventory = await tx.query(`SELECT ci.id,ci.quantity,ci.item_id FROM character_inventory ci
          WHERE ci.id=$1 AND ci.character_id=$2 AND ci.item_id=$3 FOR UPDATE`, [inventoryId,characterId,itemId]);
        if (!inventory.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'inventory_item_not_found' }); }
        if (Number(inventory.rows[0].quantity) < quantity) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'insufficient_item_quantity' }); }
        const equipped = await tx.query('SELECT 1 FROM character_equipment WHERE inventory_id=$1', [inventoryId]);
        if (equipped.rowCount) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'unequip_item_before_selling' }); }
        if (Number(character.rows[0].gold) + Number(total) > Number.MAX_SAFE_INTEGER) {
          await tx.query('ROLLBACK'); return json(res, 409, { error: 'wallet_limit_exceeded' });
        }
        if (Number(inventory.rows[0].quantity) === quantity) await tx.query('DELETE FROM character_inventory WHERE id=$1', [inventoryId]);
        else await tx.query('UPDATE character_inventory SET quantity=quantity-$1 WHERE id=$2', [quantity,inventoryId]);
        const wallet = await tx.query('UPDATE characters SET gold=gold+$1,updated_at=now() WHERE id=$2 RETURNING gold', [total.toString(),characterId]);
        await tx.query(`INSERT INTO economy_transactions(character_id,vendor_id,item_id,action,quantity,unit_price,gold_delta)
          VALUES($1,$2,$3,'sell',$4,$5,$6)`, [characterId,vendorId,itemId,quantity,price.toString(),total.toString()]);
        await tx.query('COMMIT');
        return json(res, 200, { action,itemId,quantity,totalGold:total.toString(),gold:Number(wallet.rows[0].gold) });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    const questMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/quests$/i);
    if (questMatch && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const characterId = questMatch[1];
      const owned = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, acct.id]);
      if (!owned.rowCount) return json(res, 404, { error: 'character_not_found' });
      const result = await pool.query(`SELECT q.id,q.name,q.description,q.objective_type,q.objective_target_id,
        m.name AS target_name,q.objective_required,COALESCE(cq.objective_progress,0) AS objective_progress,
        COALESCE(cq.status,'available') AS status,q.reward_xp,q.reward_gold
        FROM quest_catalog q JOIN world_mobs m ON m.id=q.objective_target_id
        LEFT JOIN character_quests cq ON cq.quest_id=q.id AND cq.character_id=$1
        WHERE q.active=true ORDER BY q.id`, [characterId]);
      return json(res, 200, { characterId, quests: result.rows });
    }
    if (questMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), questId = String(body.questId || '');
      if (!/^[a-z0-9_-]{1,48}$/i.test(questId)) return json(res, 400, { error: 'invalid_quest_id' });
      const accepted = await pool.query(`INSERT INTO character_quests(character_id,quest_id,status)
        SELECT c.id,q.id,'active' FROM characters c CROSS JOIN quest_catalog q
        WHERE c.id=$1 AND c.account_id=$2 AND q.id=$3 AND q.active=true
        ON CONFLICT(character_id,quest_id) DO NOTHING
        RETURNING character_id,quest_id,status,objective_progress`, [questMatch[1], acct.id, questId]);
      if (accepted.rowCount) return json(res, 201, { quest: accepted.rows[0] });
      const existing = await pool.query(`SELECT cq.quest_id,cq.status,cq.objective_progress
        FROM character_quests cq JOIN characters c ON c.id=cq.character_id
        WHERE cq.character_id=$1 AND c.account_id=$2 AND cq.quest_id=$3`, [questMatch[1], acct.id, questId]);
      if (existing.rowCount) return json(res, 409, { error: 'quest_already_accepted', quest: existing.rows[0] });
      const owned = await pool.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2', [questMatch[1], acct.id]);
      if (!owned.rowCount) return json(res, 404, { error: 'character_not_found' });
      return json(res, 404, { error: 'quest_not_found' });
    }
    const characterTradesMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/trades$/i);
    if (characterTradesMatch && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const characterId = characterTradesMatch[1];
      const owned = await pool.query('SELECT 1 FROM characters WHERE id=$1 AND account_id=$2', [characterId, acct.id]);
      if (!owned.rowCount) return json(res, 404, { error: 'character_not_found' });
      await pool.query("UPDATE player_trade_offers SET status='expired' WHERE status='pending' AND expires_at<=now() AND (from_character_id=$1 OR to_character_id=$1)", [characterId]);
      const result = await pool.query(`SELECT t.id,t.from_character_id,t.to_character_id,t.item_id,ic.name AS item_name,
        t.quantity,t.gold_amount,t.status,t.created_at,t.expires_at,
        sf.name AS from_name,st.name AS to_name
        FROM player_trade_offers t
        JOIN characters sf ON sf.id=t.from_character_id
        JOIN characters st ON st.id=t.to_character_id
        LEFT JOIN item_catalog ic ON ic.id=t.item_id
        WHERE t.from_character_id=$1 OR t.to_character_id=$1
        ORDER BY t.created_at DESC LIMIT 50`, [characterId]);
      return json(res, 200, { trades: result.rows });
    }
    const tradeActionMatch = url.pathname.match(/^\/api\/trades\/([0-9a-f-]{36})\/(accept|cancel)$/i);
    if (tradeActionMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const action = tradeActionMatch[2].toLowerCase(), tradeId = tradeActionMatch[1];
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const offerResult = await tx.query('SELECT * FROM player_trade_offers WHERE id=$1 FOR UPDATE', [tradeId]);
        if (!offerResult.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'trade_not_found' }); }
        const offer = offerResult.rows[0];
        const participant = await tx.query('SELECT id,account_id FROM characters WHERE id=ANY($1::uuid[]) AND account_id=$2',
          [[offer.from_character_id,offer.to_character_id],acct.id]);
        if (!participant.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'trade_not_found' }); }
        if (offer.status !== 'pending') { await tx.query('ROLLBACK'); return json(res, 409, { error: 'trade_not_pending' }); }
        if (action === 'cancel') {
          await tx.query("UPDATE player_trade_offers SET status='cancelled' WHERE id=$1", [tradeId]);
          await tx.query('COMMIT');
          return json(res, 200, { tradeId,status:'cancelled' });
        }
        if (!participant.rows.some(row => row.id === offer.to_character_id)) {
          await tx.query('ROLLBACK'); return json(res, 403, { error: 'only_recipient_can_accept' });
        }
        if (new Date(offer.expires_at).getTime() <= Date.now()) {
          await tx.query("UPDATE player_trade_offers SET status='expired' WHERE id=$1", [tradeId]);
          await tx.query('COMMIT');
          return json(res, 410, { error: 'trade_expired' });
        }
        const locked = await tx.query('SELECT id,gold,zone_id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
          [[offer.from_character_id,offer.to_character_id]]);
        const sender = locked.rows.find(row => row.id === offer.from_character_id);
        const recipient = locked.rows.find(row => row.id === offer.to_character_id);
        if (!sender || !recipient) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'character_not_found' }); }
        if (sender.zone_id !== recipient.zone_id) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'characters_not_in_same_zone' }); }
        const goldAmount = BigInt(offer.gold_amount);
        const senderGold = BigInt(sender.gold), recipientGold = BigInt(recipient.gold);
        if (senderGold < goldAmount) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'sender_insufficient_gold' }); }
        if (recipientGold + goldAmount > BigInt(Number.MAX_SAFE_INTEGER)) {
          await tx.query('ROLLBACK'); return json(res, 409, { error: 'recipient_wallet_limit_exceeded' });
        }
        if (offer.item_id) {
          const source = await tx.query('SELECT id,quantity FROM character_inventory WHERE character_id=$1 AND item_id=$2 FOR UPDATE',
            [offer.from_character_id,offer.item_id]);
          if (!source.rowCount || Number(source.rows[0].quantity) < Number(offer.quantity)) {
            await tx.query('ROLLBACK'); return json(res, 409, { error: 'sender_insufficient_items' });
          }
          const equipped = await tx.query('SELECT 1 FROM character_equipment WHERE inventory_id=$1', [source.rows[0].id]);
          if (equipped.rowCount) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'unequip_item_before_trading' }); }
          const catalogue = await tx.query('SELECT max_stack FROM item_catalog WHERE id=$1', [offer.item_id]);
          const destination = await tx.query('SELECT id,quantity FROM character_inventory WHERE character_id=$1 AND item_id=$2 FOR UPDATE',
            [offer.to_character_id,offer.item_id]);
          const currentQuantity = destination.rowCount ? Number(destination.rows[0].quantity) : 0;
          if (currentQuantity + Number(offer.quantity) > Number(catalogue.rows[0].max_stack)) {
            await tx.query('ROLLBACK'); return json(res, 409, { error: 'recipient_inventory_stack_limit' });
          }
          if (Number(source.rows[0].quantity) === Number(offer.quantity)) {
            await tx.query('DELETE FROM character_inventory WHERE id=$1', [source.rows[0].id]);
          } else {
            await tx.query('UPDATE character_inventory SET quantity=quantity-$1 WHERE id=$2', [offer.quantity,source.rows[0].id]);
          }
          if (destination.rowCount) {
            await tx.query('UPDATE character_inventory SET quantity=quantity+$1 WHERE id=$2', [offer.quantity,destination.rows[0].id]);
          } else {
            await tx.query('INSERT INTO character_inventory(character_id,item_id,quantity) VALUES($1,$2,$3)',
              [offer.to_character_id,offer.item_id,offer.quantity]);
          }
        }
        if (goldAmount > 0n) {
          await tx.query('UPDATE characters SET gold=gold-$1,updated_at=now() WHERE id=$2', [goldAmount.toString(),offer.from_character_id]);
          await tx.query('UPDATE characters SET gold=gold+$1,updated_at=now() WHERE id=$2', [goldAmount.toString(),offer.to_character_id]);
        }
        await tx.query("UPDATE player_trade_offers SET status='completed',completed_at=now() WHERE id=$1", [tradeId]);
        await tx.query(`INSERT INTO player_trade_transactions(offer_id,from_character_id,to_character_id,item_id,quantity,gold_amount)
          VALUES($1,$2,$3,$4,$5,$6)`, [tradeId,offer.from_character_id,offer.to_character_id,offer.item_id,offer.quantity,goldAmount.toString()]);
        await tx.query('COMMIT');
        return json(res, 200, { tradeId,status:'completed',itemId:offer.item_id,quantity:Number(offer.quantity),goldAmount:goldAmount.toString() });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    const createTradeMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/trades$/i);
    if (createTradeMatch && req.method === 'POST') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), senderId = createTradeMatch[1];
      const recipientId = String(body.toCharacterId || ''), itemId = body.itemId ? String(body.itemId) : null;
      const quantity = itemId ? Number(body.quantity) : 0, goldAmount = body.goldAmount === undefined ? 0 : body.goldAmount;
      if (!/^[0-9a-f-]{36}$/i.test(recipientId) || recipientId === senderId ||
          (itemId && !/^[a-z0-9_-]{1,48}$/i.test(itemId)) ||
          !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99 ||
          !Number.isSafeInteger(goldAmount) || goldAmount < 0 || goldAmount > 1000000000 ||
          (!itemId && quantity !== 0) || (!itemId && goldAmount === 0) || (itemId && quantity < 1)) {
        return json(res, 400, { error: 'invalid_trade_offer' });
      }
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const chars = await tx.query('SELECT id,account_id,gold,zone_id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
          [[senderId,recipientId]]);
        const sender = chars.rows.find(row => row.id === senderId && row.account_id === acct.id);
        const recipient = chars.rows.find(row => row.id === recipientId);
        if (!sender) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'character_not_found' }); }
        if (!recipient) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'recipient_not_found' }); }
        if (sender.zone_id !== recipient.zone_id) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'characters_not_in_same_zone' }); }
        const pendingOffers = await tx.query("SELECT count(*)::integer AS total FROM player_trade_offers WHERE status='pending' AND expires_at>now() AND (from_character_id=$1 OR to_character_id=$1 OR from_character_id=$2 OR to_character_id=$2)", [senderId,recipientId]);
        if (Number(pendingOffers.rows[0].total) >= 20) { await tx.query('ROLLBACK'); return json(res, 429, { error: 'too_many_pending_trade_offers' }); }
        if (BigInt(sender.gold) < BigInt(goldAmount)) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'sender_insufficient_gold' }); }
        if (itemId) {
          const item = await tx.query('SELECT ci.id,ci.quantity FROM character_inventory ci WHERE ci.character_id=$1 AND ci.item_id=$2 FOR UPDATE',
            [senderId,itemId]);
          if (!item.rowCount || Number(item.rows[0].quantity) < quantity) {
            await tx.query('ROLLBACK'); return json(res, 409, { error: 'sender_insufficient_items' });
          }
          const equipped = await tx.query('SELECT 1 FROM character_equipment WHERE inventory_id=$1', [item.rows[0].id]);
          if (equipped.rowCount) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'unequip_item_before_trading' }); }
        }
        const offer = await tx.query(`INSERT INTO player_trade_offers(from_character_id,to_character_id,item_id,quantity,gold_amount)
          VALUES($1,$2,$3,$4,$5) RETURNING id,status,expires_at`, [senderId,recipientId,itemId,quantity,String(goldAmount)]);
        await tx.query('COMMIT');
        return json(res, 201, { trade: { id:offer.rows[0].id,fromCharacterId:senderId,toCharacterId:recipientId,
          itemId,quantity,goldAmount:String(goldAmount),status:offer.rows[0].status,expiresAt:offer.rows[0].expires_at } });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    const bankMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/bank(?:\/(deposit|withdraw))?$/i);
    if (bankMatch && req.method === 'GET' && !bankMatch[2]) {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const result = await pool.query('SELECT id,gold,bank_gold FROM characters WHERE id=$1 AND account_id=$2', [bankMatch[1], acct.id]);
      if (!result.rowCount) return json(res, 404, { error: 'character_not_found' });
      return json(res, 200, { characterId: result.rows[0].id, gold: String(result.rows[0].gold), bankGold: String(result.rows[0].bank_gold) });
    }
    if (bankMatch && req.method === 'POST' && bankMatch[2]) {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req), amount = body.amount;
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) return json(res, 400, { error: 'invalid_bank_amount' });
      const action = bankMatch[2].toLowerCase(), characterId = bankMatch[1], value = BigInt(amount);
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const character = await tx.query('SELECT id,gold,bank_gold FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, acct.id]);
        if (!character.rowCount) { await tx.query('ROLLBACK'); return json(res, 404, { error: 'character_not_found' }); }
        const gold = BigInt(character.rows[0].gold), bankGold = BigInt(character.rows[0].bank_gold);
        let nextGold = gold, nextBank = bankGold;
        if (action === 'deposit') {
          if (gold < value) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'insufficient_wallet_gold' }); }
          if (bankGold + value > BigInt(Number.MAX_SAFE_INTEGER)) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'bank_limit_exceeded' }); }
          nextGold -= value; nextBank += value;
        } else {
          if (bankGold < value) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'insufficient_bank_gold' }); }
          if (gold + value > BigInt(Number.MAX_SAFE_INTEGER)) { await tx.query('ROLLBACK'); return json(res, 409, { error: 'wallet_limit_exceeded' }); }
          nextGold += value; nextBank -= value;
        }
        const updated = await tx.query('UPDATE characters SET gold=$1,bank_gold=$2,updated_at=now() WHERE id=$3 RETURNING gold,bank_gold',
          [nextGold.toString(), nextBank.toString(), characterId]);
        await tx.query('INSERT INTO bank_transactions(character_id,action,amount,gold_after,bank_gold_after) VALUES($1,$2,$3,$4,$5)',
          [characterId, action, value.toString(), nextGold.toString(), nextBank.toString()]);
        await tx.query('COMMIT');
        return json(res, 200, { action, amount: value.toString(), gold: String(updated.rows[0].gold), bankGold: String(updated.rows[0].bank_gold) });
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { tx.release(); }
    }
    const chatHistoryMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/chat$/i);
    if (chatHistoryMatch && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const owned = await pool.query('SELECT id,realm_id,zone_id FROM characters WHERE id=$1 AND account_id=$2', [chatHistoryMatch[1], acct.id]);
      if (!owned.rowCount) return json(res, 404, { error: 'character_not_found' });
      const channel = url.searchParams.get('channel') === 'realm' ? 'realm' : 'zone';
      const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
      const args = channel === 'realm' ? [owned.rows[0].realm_id, limit] : [owned.rows[0].realm_id, owned.rows[0].zone_id, limit];
      const result = await pool.query(channel === 'realm'
        ? `SELECT m.id,m.channel,m.realm_id,m.zone_id,m.sender_character_id AS "characterId",c.name,m.message AS text,m.created_at AS "createdAt"
           FROM world_chat_messages m JOIN characters c ON c.id=m.sender_character_id
           WHERE m.realm_id=$1 AND m.channel='realm' ORDER BY m.created_at DESC LIMIT $2`
        : `SELECT m.id,m.channel,m.realm_id,m.zone_id,m.sender_character_id AS "characterId",c.name,m.message AS text,m.created_at AS "createdAt"
           FROM world_chat_messages m JOIN characters c ON c.id=m.sender_character_id
           WHERE m.realm_id=$1 AND m.zone_id=$2 AND m.channel='zone' ORDER BY m.created_at DESC LIMIT $3`, args);
      return json(res, 200, { channel, messages: result.rows.reverse().map(row => ({ ...row, at: new Date(row.createdAt).getTime() })) });
    }
    const walletMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/wallet$/i);
    if (walletMatch && req.method === 'GET') {
      const acct = await accountFor(req); if (!acct) return json(res, 401, { error: 'unauthorized' });
      const result = await pool.query('SELECT id,gold FROM characters WHERE id=$1 AND account_id=$2', [walletMatch[1], acct.id]);
      if (!result.rowCount) return json(res, 404, { error: 'character_not_found' });
      return json(res, 200, { characterId: result.rows[0].id, gold: Number(result.rows[0].gold) });
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
const presenceHeartbeat = setInterval(async () => {
  try {
    await pool.query('DELETE FROM world_presence WHERE expires_at<=now()');
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
    for (const [ws, state] of activeSockets) if (ws.readyState === WebSocket.OPEN && state.authenticated && state.character) await persistPresence(ws, state);
  } catch (error) { console.error('Presence heartbeat failed:', error.message); }
}, 15000);
presenceHeartbeat.unref();
const worldListenerPromise = pool.connect().then(async client => {
  client.on('notification', message => {
    if (message.channel !== WORLD_EVENT_CHANNEL) return;
    try {
      const event = JSON.parse(message.payload);
      if (event.origin !== SERVER_INSTANCE_ID) deliverWorldEvent(event);
    } catch (error) { console.error('Invalid world event notification:', error.message); }
  });
  client.on('error', error => console.error('World event listener error:', error.message));
  await client.query('LISTEN ' + WORLD_EVENT_CHANNEL);
  return client;
}).catch(error => { console.error('World event listener unavailable:', error.message); return null; });
const respawnTimer = setInterval(async () => {
  try {
    const result = await pool.query("UPDATE world_mobs SET hp=max_hp,alive=true,respawn_at=NULL,updated_at=now() WHERE alive=false AND respawn_at IS NOT NULL AND respawn_at<=now() RETURNING id,realm_id,zone_id,name,level,x,y,hp,max_hp");
    for (const { realm_id, ...mob } of result.rows) broadcastZone(realm_id, mob.zone_id, 'world.mob_spawned', { mob });
  } catch (error) { console.error('Mob respawn worker failed:', error.message); }
}, 10000);
respawnTimer.unref();
server.listen(PORT, HOST, () => console.log('GB Quest authoritative MMO service listening on ' + HOST + ':' + PORT));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { clearInterval(presenceHeartbeat); await pool.query('DELETE FROM world_presence WHERE server_instance_id=$1', [SERVER_INSTANCE_ID]).catch(() => {}); const worldListener = await worldListenerPromise; if (worldListener) { await worldListener.query('UNLISTEN *').catch(() => {}); worldListener.release(); } await new Promise(resolve => server.close(resolve)); await pool.end(); process.exit(0); });
