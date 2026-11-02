#!/usr/bin/env node
// ================================================================ GB QUEST REALM SERVER
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
const DATA_DIR = process.env.GBQ_DATA || path.join(__dirname, 'data'), DB_FILE = path.join(DATA_DIR, 'realm.json');
const TOKEN_DAYS = 30, MAX_BODY = 64 * 1024, MAX_SAVE = 1024 * 1024, SLOTS = 3;
const TOPICS = new Set(['srv_join', 'srv_char', 'srv_battle', 'srv_turn', 'srv_act', 'srv_end', 'chat']);

// ---------------------------------------------------------------- storage
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { accounts: {}, sessions: {}, saves: {}, heroes: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { /* first run */ }
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
  const acct = Object.values(db.accounts).find(a => a.id === s.uid); return acct ? { token: tok, acct } : null;
}
// login throttling: 10 failures per 10 minutes per ip and per username
const fails = new Map();
const throttled = key => { const f = fails.get(key); return f && f.n >= 10 && Date.now() - f.t < 600e3; };
const fail = key => { const f = fails.get(key); if (!f || Date.now() - f.t > 600e3) fails.set(key, { n: 1, t: Date.now() }); else f.n++; };
const publicAcct = a => ({ id: a.id, name: a.name, created: a.created });

// ---------------------------------------------------------------- live realm (SSE)
const clients = new Map(); // peer -> { res, uid, name, presence }
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
const STATIC = { '/': 'dist/gbquest.html', '/fullscreen': 'dist/gbquest-fullscreen.html', '/atlas': 'dist/atlas.html', '/dist/atlas.html': 'dist/atlas.html' };

// ---------------------------------------------------------------- routes
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`), p = url.pathname, ip = req.socket.remoteAddress || '?';
  try {
    if (req.method === 'GET' && STATIC[p]) return serveFile(res, STATIC[p], 'text/html; charset=utf-8');
    if (!p.startsWith('/api/')) { res.writeHead(404, SEC); return res.end('Not found'); }

    if (p === '/api/health') return json(res, 200, { ok: true, game: 'GB QUEST', realm: process.env.REALM || 'LOCAL REALM', players: clients.size, accounts: Object.keys(db.accounts).length });

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
      fails.delete('u:' + key);
      acct.lastLogin = Date.now(); const token = newToken(); db.sessions[token] = { uid: acct.id, exp: Date.now() + TOKEN_DAYS * 864e5 }; save();
      return json(res, 200, { token, account: publicAcct(acct) });
    }

    const sess = sessionFor(req, url);
    if (!sess) return json(res, 401, { error: 'Log in first.' });
    const uid = sess.acct.id;

    if (p === '/api/logout' && req.method === 'POST') { delete db.sessions[sess.token]; save(); return json(res, 200, { ok: true }); }
    if (p === '/api/me') return json(res, 200, { account: publicAcct(sess.acct), slots: Object.keys(db.saves[uid] || {}) });
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
        if (!state || typeof state !== 'object' || typeof state.name !== 'string' || !state.cls) return json(res, 400, { error: 'Not a GB Quest save.' });
        mine[slot] = { state, saved: Date.now(), meta: { name: String(state.name).slice(0, 12), lvl: +state.lvl || 1, cls: String(state.cls).slice(0, 16) } }; save();
        return json(res, 200, { ok: true, saved: mine[slot].saved });
      }
      if (req.method === 'DELETE') { delete mine[slot]; save(); return json(res, 200, { ok: true }); }
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
      for (const [pid, o] of clients) if (pid !== peer) send(o.res, 'msg', { topic, peer, data });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'No such endpoint.' });
  } catch (e) {
    return json(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code === 413 ? 'Too large.' : e.code === 400 ? 'Bad request.' : 'Server error.' });
  }
});
server.listen(PORT, HOST, () => console.log(`GB QUEST realm server on http://${HOST}:${PORT}  (accounts: ${Object.keys(db.accounts).length})`));
module.exports = server;
