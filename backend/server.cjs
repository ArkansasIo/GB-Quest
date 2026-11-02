#!/usr/bin/env node
// ================================================================ LOST KINGDOM OF SHADOWBANE CHRONICLES REALM SERVER
// A small, dependency-free game server (Node 18+). It:
//   - serves the game client (dist/gbquest.html, /fullscreen, /atlas) on the same origin
//   - runs accounts: register / login / logout, scrypt-hashed passwords, session tokens
//   - stores cloud saves (3 slots per account) and the realm leaderboard
//   - relays live play: presence, chat, and the host-server battle topics (srv_*), using
//     Server-Sent Events for server->client and small JSON POSTs for client->server
//
//   node server/server.cjs                 -> http://127.0.0.1:8787
//   PORT=9000 HOST=0.0.0.0 node server/server.cjs   (LAN play; put it behind HTTPS for the internet)
//
// Data lives in server/data/realm.json (written atomically). Delete it to reset the realm.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.GBQ_DATA || path.join(ROOT, 'server', 'data'), DB_FILE = path.join(DATA_DIR, 'realm.json');
const ADMIN_ACCOUNT_ID = String(process.env.GBQ_ADMIN_ID || '').toLowerCase();
const TOKEN_DAYS = 30, MAX_BODY = 64 * 1024, MAX_SAVE = 1024 * 1024, SLOTS = 3;
const TOPICS = new Set(['srv_join', 'srv_char', 'srv_battle', 'srv_turn', 'srv_act', 'srv_end', 'chat', 'trade']);

// ---------------------------------------------------------------- storage
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { accounts: {}, sessions: {}, saves: {}, heroes: {}, market: {}, proceeds: {}, friendships: {}, friendRequests: {}, inviteCodes: {}, bans: {}, adminAudit: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { /* first run */ }
db.friendships ||= {}; db.friendRequests ||= {}; db.inviteCodes ||= {};
db.bans ||= {}; db.adminAudit ||= [];
let dirty = false;
const save = () => { dirty = true; };
setInterval(() => {
  if (!dirty) return; dirty = false;
  const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE);
}, 1000).unref();
const flush = () => { if (dirty) { fs.writeFileSync(DB_FILE, JSON.stringify(db)); dirty = false; } };
process.on('SIGINT', () => { flush(); process.exit(0); }); process.on('SIGTERM', () => { flush(); process.exit(0); });

// ---------------------------------------------------------------- accounts
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
const validName = n => typeof n === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(n);
const validPw = p => typeof p === 'string' && p.length >= 8 && p.length <= 72;
const newToken = () => crypto.randomBytes(32).toString('hex');
function sessionFor(req, url) {
  const h = req.headers.authorization || '', tok = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  if (!tok || !/^[0-9a-f]{64}$/.test(tok)) return null;
  const s = db.sessions[tok]; if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[tok]; save(); return null; }
  const acct = Object.values(db.accounts).find(a => a.id === s.uid); return acct && !db.bans[acct.id] ? { token: tok, acct } : null;
}
// login throttling: 10 failures per 10 minutes per ip and per username
const fails = new Map();
const throttled = key => { const f = fails.get(key); return f && f.n >= 10 && Date.now() - f.t < 600e3; };
const fail = key => { const f = fails.get(key); if (!f || Date.now() - f.t > 600e3) fails.set(key, { n: 1, t: Date.now() }); else f.n++; };
const publicAcct = a => ({ id: a.id, name: a.name, created: a.created });
const isAdmin = acct => !!ADMIN_ACCOUNT_ID && acct.id.toLowerCase() === ADMIN_ACCOUNT_ID;
const REALMS = [
  { id: 'ardenhold', name: 'Ardenhold', type: 'Roleplay', status: 'online' },
  { id: 'ironreach', name: 'Ironreach', type: 'PvE', status: 'online' },
  { id: 'moonfall', name: 'Moonfall', type: 'PvE', status: 'online' },
  { id: 'stormwake', name: 'Stormwake', type: 'PvP', status: 'online' },
  { id: 'dawnspire', name: 'Dawnspire', type: 'Roleplay', status: 'online' },
  { id: 'emberwild', name: 'Emberwild', type: 'PvE', status: 'online' },
  { id: 'frostmarch', name: 'Frostmarch', type: 'PvP', status: 'online' },
  { id: 'starhaven', name: 'Starhaven', type: 'Seasonal', status: 'online' },
  { id: 'shadowfen', name: 'Shadowfen', type: 'Roleplay', status: 'online' },
];
function friendIds(uid) { return db.friendships[uid] || (db.friendships[uid] = []); }
function accountById(id) { return Object.values(db.accounts).find(a => a.id === id); }
function publicFriend(uid) {
  const acct = accountById(uid); if (!acct) return null;
  const online = [...clients.values()].some(c => c.uid === uid);
  return { id: acct.id, name: acct.name, online };
}

// ---------------------------------------------------------------- live realm (SSE)
const clients = new Map(); // peer -> { res, uid, name, presence }
const chatWindows = new Map();
const peerList = () => [...clients.entries()].map(([peer, c]) => ({ peer, presence: c.presence || {}, kind: 'viewer', name: c.name }));
function send(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcastPeers(left = []) {
  const list = peerList();
  for (const [peer, c] of clients) send(c.res, 'peers', { peers: list.map(p => ({ ...p, sameTab: p.peer === peer })), left: left.map(p => ({ peer: p })) });
}
setInterval(() => { for (const c of clients.values()) c.res.write(': ping\n\n'); }, 25000).unref();

// ---------------------------------------------------------------- http helpers
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC }); res.end(JSON.stringify(obj)); }
function body(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
    req.on('error', reject);
  });
}
function serveFile(res, file, type) {
  fs.readFile(path.join(ROOT, file), (e, buf) => {
    if (e) { res.writeHead(404, SEC); return res.end('Not built yet: run python3 tools/build.py'); }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...SEC }); res.end(buf);
  });
}
const STATIC = { '/': 'dist/gbquest.html', '/fullscreen': 'dist/gbquest-fullscreen.html', '/atlas': 'dist/atlas.html', '/dist/atlas.html': 'dist/atlas.html', '/admin': 'admin/controlplane.html', '/admin/': 'admin/controlplane.html', '/admin/controlplane.js': 'admin/controlplane.js' };

// ---------------------------------------------------------------- routes
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`), p = url.pathname, ip = req.socket.remoteAddress || '?';
  try {
    if (req.method === 'GET' && STATIC[p]) return serveFile(res, STATIC[p], p.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    if (!p.startsWith('/api/')) { res.writeHead(404, SEC); return res.end('Not found'); }

    if (p === '/api/health') return json(res, 200, { ok: true, game: 'LOST KINGDOM OF SHADOWBANE CHRONICLES', realm: process.env.REALM || 'LOCAL REALM', players: clients.size, accounts: Object.keys(db.accounts).length, realms: REALMS });
    if (p === '/api/realms' && req.method === 'GET') return json(res, 200, { realms: REALMS });
    if (p === '/api/store/catalog' && req.method === 'GET') return json(res, 200, require('../store/catalog.cjs').getCatalog());

    if (p === '/api/register' && req.method === 'POST') {
      const { username, password } = await body(req);
      if (!validName(username)) return json(res, 400, { error: 'Username: 3-16 letters, digits or _.' });
      if (!validPw(password)) return json(res, 400, { error: 'Password: 8-72 characters.' });
      const key = username.toLowerCase(); if (db.accounts[key]) return json(res, 409, { error: 'That name is taken.' });
      if (throttled('reg:' + ip)) return json(res, 429, { error: 'Too many attempts. Try later.' });
      fail('reg:' + ip); // count registrations per ip too
      const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(password, salt)).toString('hex');
      const acct = { id: crypto.randomUUID(), name: username, salt, hash, created: Date.now(), lastLogin: Date.now() };
      db.accounts[key] = acct; const token = newToken(); db.sessions[token] = { uid: acct.id, exp: Date.now() + TOKEN_DAYS * 864e5 }; save();
      return json(res, 201, { token, account: publicAcct(acct) });
    }
    if (p === '/api/login' && req.method === 'POST') {
      const { username, password } = await body(req);
      const key = String(username || '').toLowerCase();
      if (throttled('ip:' + ip) || throttled('u:' + key)) return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
      const acct = db.accounts[key];
      const salt = acct ? acct.salt : '00', want = acct ? Buffer.from(acct.hash, 'hex') : Buffer.alloc(64);
      const got = await scrypt(String(password || ''), salt); // always hash, so timing does not reveal which names exist
      if (!acct || !crypto.timingSafeEqual(got, want)) { fail('ip:' + ip); fail('u:' + key); return json(res, 401, { error: 'Wrong name or password.' }); }
      if (db.bans[acct.id]) return json(res, 403, { error: 'This account is suspended.' });
      fails.delete('u:' + key);
      acct.lastLogin = Date.now(); const token = newToken(); db.sessions[token] = { uid: acct.id, exp: Date.now() + TOKEN_DAYS * 864e5 }; save();
      return json(res, 200, { token, account: publicAcct(acct) });
    }

    const sess = sessionFor(req, url);
    if (!sess) return json(res, 401, { error: 'Log in first.' });
    const uid = sess.acct.id;

    if (p === '/api/store/checkout' && req.method === 'POST') return json(res, 503, { error: 'Checkout is disabled until a payment provider and server-side fulfillment are configured.' });

    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(sess.acct)) return json(res, 403, { error: 'Admin access is not enabled for this account.' });
      if (p === '/api/admin/overview' && req.method === 'GET') return json(res, 200, { realm: process.env.REALM || 'LOCAL REALM', online: clients.size, accounts: Object.keys(db.accounts).length, bans: Object.keys(db.bans).length, activeListings: Object.keys(db.market || {}).length, activeInvites: Object.values(db.inviteCodes).filter(i => i.expiresAt > Date.now()).length });
      if (p === '/api/admin/players' && req.method === 'GET') return json(res, 200, { players: Object.values(db.accounts).map(a => ({ id: a.id, name: a.name, created: a.created, lastLogin: a.lastLogin || null, online: [...clients.values()].some(c => c.uid === a.id), banned: !!db.bans[a.id] })).sort((a, b) => b.created - a.created).slice(0, 200) });
      if (p === '/api/admin/audit' && req.method === 'GET') return json(res, 200, { entries: db.adminAudit.slice(-100).reverse() });
      const banMatch = p.match(/^\/api\/admin\/players\/([0-9a-f-]{36})\/(ban|unban)$/i);
      if (banMatch && req.method === 'POST') {
        const targetId = banMatch[1], action = banMatch[2].toLowerCase(), target = accountById(targetId);
        if (!target) return json(res, 404, { error: 'Account not found.' });
        if (targetId === uid) return json(res, 400, { error: 'You cannot suspend your own admin account.' });
        if (action === 'ban') {
          const input = await body(req), reason = String(input.reason || 'Admin action').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 160);
          db.bans[targetId] = { reason, at: Date.now(), by: sess.acct.name };
          for (const token of Object.keys(db.sessions)) if (db.sessions[token].uid === targetId) delete db.sessions[token];
          for (const [peer, live] of clients) if (live.uid === targetId) { live.res.end(); clients.delete(peer); }
          broadcastPeers();
        } else delete db.bans[targetId];
        db.adminAudit.push({ at: Date.now(), actor: sess.acct.name, action, target: target.name });
        if (db.adminAudit.length > 1000) db.adminAudit.splice(0, db.adminAudit.length - 1000);
        save(); return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: 'No such admin operation.' });
    }

    if (p === '/api/logout' && req.method === 'POST') { delete db.sessions[sess.token]; save(); return json(res, 200, { ok: true }); }
    if (p === '/api/me') return json(res, 200, { account: publicAcct(sess.acct), slots: Object.keys(db.saves[uid] || {}) });
    if (p === '/api/friends' && req.method === 'GET') {
      const friends = friendIds(uid).map(publicFriend).filter(Boolean);
      const requests = (db.friendRequests[uid] || []).map(id => publicFriend(id)).filter(Boolean);
      return json(res, 200, { friends, requests });
    }
    if (p === '/api/friends/request' && req.method === 'POST') {
      const { username } = await body(req), key = String(username || '').toLowerCase(), target = db.accounts[key];
      if (!target) return json(res, 404, { error: 'Account not found.' });
      if (target.id === uid) return json(res, 400, { error: 'You cannot add yourself.' });
      const friends = friendIds(uid), targetFriends = friendIds(target.id);
      if (friends.includes(target.id)) return json(res, 409, { error: 'Already friends.' });
      const incoming = db.friendRequests[uid] || [];
      if (incoming.includes(target.id)) { db.friendRequests[uid] = incoming.filter(id => id !== target.id); if (!friends.includes(target.id)) friends.push(target.id); if (!targetFriends.includes(uid)) targetFriends.push(uid); save(); return json(res, 200, { ok: true, accepted: true }); }
      const outgoing = db.friendRequests[target.id] || (db.friendRequests[target.id] = []);
      if (!outgoing.includes(uid)) outgoing.push(uid);
      save(); return json(res, 200, { ok: true, pending: true });
    }
    if (p === '/api/friends/accept' && req.method === 'POST') {
      const { accountId } = await body(req), fromId = String(accountId || ''), incoming = db.friendRequests[uid] || [];
      if (!incoming.includes(fromId) || !accountById(fromId)) return json(res, 404, { error: 'Friend request not found.' });
      db.friendRequests[uid] = incoming.filter(id => id !== fromId);
      const mine = friendIds(uid), theirs = friendIds(fromId); if (!mine.includes(fromId)) mine.push(fromId); if (!theirs.includes(uid)) theirs.push(uid);
      save(); return json(res, 200, { ok: true });
    }
    if (p === '/api/friends/remove' && req.method === 'POST') {
      const { accountId } = await body(req), other = String(accountId || '');
      db.friendships[uid] = friendIds(uid).filter(id => id !== other);
      if (db.friendships[other]) db.friendships[other] = db.friendships[other].filter(id => id !== uid);
      db.friendRequests[uid] = (db.friendRequests[uid] || []).filter(id => id !== other);
      db.friendRequests[other] = (db.friendRequests[other] || []).filter(id => id !== uid);
      save(); return json(res, 200, { ok: true });
    }
    if (p === '/api/invites' && req.method === 'POST') {
      const { peer } = await body(req), client = clients.get(String(peer || ''));
      if (!client || client.uid !== uid) return json(res, 403, { error: 'Connect to the realm first.' });
      for (const [code, invite] of Object.entries(db.inviteCodes)) if (invite.expiresAt <= Date.now()) delete db.inviteCodes[code];
      if (Object.values(db.inviteCodes).filter(invite => invite.uid === uid).length >= 5) return json(res, 429, { error: 'You already have five active invite codes.' });
      let code; do { code = crypto.randomBytes(6).toString('hex').toUpperCase(); } while (db.inviteCodes[code]);
      db.inviteCodes[code] = { uid, peer, expiresAt: Date.now() + 15 * 60e3 };
      save(); return json(res, 201, { code, expiresAt: db.inviteCodes[code].expiresAt });
    }
    const inviteMatch = p.match(/^\/api\/invites\/([A-F0-9]{12})$/);
    if (inviteMatch && req.method === 'GET') {
      const invite = db.inviteCodes[inviteMatch[1]];
      if (!invite || invite.expiresAt <= Date.now()) { if (invite) delete db.inviteCodes[inviteMatch[1]]; return json(res, 404, { error: 'Invite code expired or invalid.' }); }
      if (!clients.has(invite.peer)) return json(res, 410, { error: 'That player is no longer online.' });
      const owner = publicFriend(invite.uid);
      return json(res, 200, { peer: invite.peer, host: owner && owner.name, expiresAt: invite.expiresAt });
    }
    if (p === '/api/password' && req.method === 'POST') {
      const { oldPassword, newPassword } = await body(req);
      const got = await scrypt(String(oldPassword || ''), sess.acct.salt);
      if (!crypto.timingSafeEqual(got, Buffer.from(sess.acct.hash, 'hex'))) return json(res, 401, { error: 'Current password is wrong.' });
      if (!validPw(newPassword)) return json(res, 400, { error: 'Password: 8-72 characters.' });
      sess.acct.salt = crypto.randomBytes(16).toString('hex'); sess.acct.hash = (await scrypt(newPassword, sess.acct.salt)).toString('hex');
      for (const t in db.sessions) if (db.sessions[t].uid === uid && t !== sess.token) delete db.sessions[t]; // log out other devices
      save(); return json(res, 200, { ok: true });
    }

    // cloud saves: /api/saves (list) and /api/saves/0..2 (get / put / delete)
    if (p === '/api/saves' && req.method === 'GET') {
      const s = db.saves[uid] || {};
      return json(res, 200, { slots: Array.from({ length: SLOTS }, (_, i) => s[i] ? { slot: i, name: s[i].meta.name, lvl: s[i].meta.lvl, cls: s[i].meta.cls, saved: s[i].saved } : null) });
    }
    const m = p.match(/^\/api\/saves\/([0-2])$/);
    if (m) {
      const slot = +m[1], mine = db.saves[uid] || (db.saves[uid] = {});
      if (req.method === 'GET') return mine[slot] ? json(res, 200, { slot, state: mine[slot].state, saved: mine[slot].saved }) : json(res, 404, { error: 'Empty slot.' });
      if (req.method === 'PUT') {
        const { state } = await body(req, MAX_SAVE);
        if (!state || typeof state !== 'object' || typeof state.name !== 'string' || !state.cls) return json(res, 400, { error: 'Not a Lost Kingdom of Shadowbane Chronicles save.' });
        mine[slot] = { state, saved: Date.now(), meta: { name: String(state.name).slice(0, 12), lvl: +state.lvl || 1, cls: String(state.cls).slice(0, 16) } }; save();
        return json(res, 200, { ok: true, saved: mine[slot].saved });
      }
      if (req.method === 'DELETE') { delete mine[slot]; save(); return json(res, 200, { ok: true }); }
    }

    // trading hub (auction house): the server holds listings, takes the 5% cut and pays sellers
    //   GET /api/market            active listings
    //   POST /api/market           { item | stack:{id,n}, price, hours } -> list (deposit is charged client-side)
    //   POST /api/market/buy       { id } -> { listing } (buyer pays client-side; seller is credited here)
    //   POST /api/market/cancel    { id } -> { listing } back to the seller
    //   GET /api/market/claim      -> { gold, returned:[listings] } proceeds and expired listings
    if (p.startsWith('/api/market')) {
      const now = Date.now(); db.market = db.market || {}; db.proceeds = db.proceeds || {};
      for (const [id, l] of Object.entries(db.market)) if (l.expires < now) { (db.proceeds[l.seller] ||= { gold: 0, returned: [] }).returned.push(l); delete db.market[id]; }
      if (p === '/api/market' && req.method === 'GET') return json(res, 200, { listings: Object.values(db.market).sort((a, b) => b.ts - a.ts).slice(0, 300) });
      if (p === '/api/market' && req.method === 'POST') {
        const b = await body(req, 16384), price = Math.floor(+b.price);
        if (!Number.isFinite(price) || price < 1 || price > 1e9) return json(res, 400, { error: 'Bad price.' });
        const item = b.item && typeof b.item === 'object' ? b.item : null, stack = b.stack && typeof b.stack.id === 'string' ? { id: b.stack.id.slice(0, 40), n: Math.max(1, Math.min(999, Math.floor(+b.stack.n) || 1)) } : null;
        if (!item === !stack) return json(res, 400, { error: 'List one item or one stack.' });
        if (Object.values(db.market).filter(l => l.seller === uid).length >= 20) return json(res, 400, { error: 'You already have 20 listings.' });
        const id = crypto.randomBytes(8).toString('hex'), hours = Math.max(1, Math.min(48, +b.hours || 12));
        db.market[id] = { id, seller: uid, sellerName: String(b.sellerName || sess.acct.name).slice(0, 12), item, stack, price, ts: now, expires: now + hours * 3600e3 };
        save(); return json(res, 200, { ok: true, id });
      }
      if (p === '/api/market/buy' && req.method === 'POST') {
        const { id } = await body(req), l = db.market[id];
        if (!l) return json(res, 404, { error: 'That listing is gone.' });
        if (l.seller === uid) return json(res, 400, { error: 'That is your own listing.' });
        delete db.market[id]; (db.proceeds[l.seller] ||= { gold: 0, returned: [] }).gold += Math.floor(l.price * 0.95);
        save(); return json(res, 200, { ok: true, listing: l });
      }
      if (p === '/api/market/cancel' && req.method === 'POST') {
        const { id } = await body(req), l = db.market[id];
        if (!l || l.seller !== uid) return json(res, 404, { error: 'Not your listing.' });
        delete db.market[id]; save(); return json(res, 200, { ok: true, listing: l });
      }
      if (p === '/api/market/claim' && req.method === 'GET') {
        const pr = db.proceeds[uid] || { gold: 0, returned: [] }; delete db.proceeds[uid]; save();
        return json(res, 200, pr);
      }
    }

    // leaderboard
    if (p === '/api/heroes' && req.method === 'GET') return json(res, 200, { heroes: Object.values(db.heroes).sort((a, b) => b.lvl - a.lvl || b.ach - a.ach).slice(0, 50) });
    if (p === '/api/hero' && req.method === 'PUT') {
      const h = await body(req);
      db.heroes[uid] = { name: String(h.name || sess.acct.name).slice(0, 12), cls: String(h.cls || '').slice(0, 16), lvl: Math.max(1, Math.min(720, +h.lvl || 1)), ach: +h.ach || 0, tower: Math.min(100, +h.tower || 0), rating: +h.rating || 1000, ch: +h.ch || 0, account: sess.acct.name, ts: Date.now() };
      save(); return json(res, 200, { ok: true });
    }

    // live realm: one event stream per tab, plus presence and topic posts
    if (p === '/api/stream' && req.method === 'GET') {
      const peer = crypto.randomBytes(6).toString('hex');
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', ...SEC });
      res.write('retry: 3000\n\n');
      clients.set(peer, { res, uid, name: sess.acct.name, presence: {} });
      send(res, 'hello', { peer, account: publicAcct(sess.acct) });
      broadcastPeers();
      req.on('close', () => { clients.delete(peer); broadcastPeers([peer]); });
      return;
    }
    if (p === '/api/presence' && req.method === 'POST') {
      const { peer, presence } = await body(req); const c = clients.get(peer);
      if (!c || c.uid !== uid) return json(res, 403, { error: 'Not your connection.' });
      c.presence = presence && typeof presence === 'object' ? presence : {}; broadcastPeers();
      return json(res, 200, { ok: true });
    }
    if (p === '/api/emit' && req.method === 'POST') {
      const { peer, topic, data } = await body(req); const c = clients.get(peer);
      if (!c || c.uid !== uid) return json(res, 403, { error: 'Not your connection.' });
      if (!TOPICS.has(topic)) return json(res, 400, { error: 'Unknown topic.' });
      if (topic === 'chat') {
        const channel = String(data && data.channel || '').toLowerCase();
        const channels = new Set(['say', 'yell', 'party', 'guild', 'whisper', 'world', 'trade', 'lfg', 'emote']);
        const message = typeof (data && data.text) === 'string' ? data.text.trim() : '';
        if (!channels.has(channel) || !message || message.length > 180 || /[\u0000-\u001F\u007F]/.test(message)) return json(res, 400, { error: 'Invalid chat message.' });
        const now = Date.now(), times = (chatWindows.get(uid) || []).filter(t => t > now - 10000);
        if (times.length >= 5) return json(res, 429, { error: 'Chat rate limit reached.' });
        times.push(now); chatWindows.set(uid, times);
        const group = (pid, player) => player.presence && player.presence.j || player.presence && player.presence.h && pid || null;
        const myGroup = group(peer, c);
        if (channel === 'party' && !myGroup) return json(res, 400, { error: 'Join or host a party first.' });
        if (channel === 'guild' && !c.presence.g) return json(res, 400, { error: 'Join a guild first.' });
        let target = null;
        if (channel === 'whisper') {
          target = clients.get(String(data.to || ''));
          if (!target || target === c) return json(res, 404, { error: 'Whisper target is not online.' });
        }
        const safeData = { channel, text: message, name: String(c.presence.n || c.name).slice(0, 24), to: channel === 'whisper' ? String(data.to) : '', from: peer };
        for (const [pid, dest] of clients) {
          if (pid === peer) continue;
          const presence = dest.presence || {}, source = c.presence || {};
          if (channel === 'whisper' && pid !== data.to) continue;
          if ((channel === 'say' || channel === 'yell') && (String(presence.z || '') !== String(source.z || ''))) continue;
          if (channel === 'say' && Math.abs((+presence.x || 0) - (+source.x || 0)) + Math.abs((+presence.y || 0) - (+source.y || 0)) > 12) continue;
          if (channel === 'party' && (!myGroup || group(pid, dest) !== myGroup)) continue;
          if (channel === 'guild' && presence.g !== source.g) continue;
          send(dest.res, 'msg', { topic, peer, data: safeData });
        }
        return json(res, 200, { ok: true });
      }
      for (const [pid, o] of clients) if (pid !== peer) send(o.res, 'msg', { topic, peer, data });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'No such endpoint.' });
  } catch (e) {
    return json(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code === 413 ? 'Too large.' : e.code === 400 ? 'Bad request.' : 'Server error.' });
  }
});
server.listen(PORT, HOST, () => console.log(`LOST KINGDOM OF SHADOWBANE CHRONICLES realm server on http://${HOST}:${PORT}  (accounts: ${Object.keys(db.accounts).length})`));
module.exports = server;
