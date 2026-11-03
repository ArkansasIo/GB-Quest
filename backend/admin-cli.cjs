#!/usr/bin/env node
// ================================================================ REALM ADMIN CLI
// Manage staff accounts in the realm data file while the realm server is STOPPED
// (a running server keeps its own copy in memory and would overwrite these edits).
//
//   npm run admin -- list                               accounts and their roles
//   npm run admin -- create <name> <password> [role]    new account (role: root|admin|moderator|player, default root)
//   npm run admin -- promote <name> [role]              give an existing account a role (default root)
//   npm run admin -- demote <name>                      back to player
//
// Uses the same data file as the server (GBQ_DATA, default server/data/realm.json). Every change is
// written to the audit log. Add --force to skip the "server is running" check.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), http = require('http');
const { createAuditLog } = require('./logs.cjs');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.GBQ_DATA || path.join(ROOT, 'server', 'data'), DB_FILE = path.join(DATA_DIR, 'realm.json');
const LOG_DIR = process.env.GBQ_LOG_DIR || path.join(DATA_DIR, 'logs');
const PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '127.0.0.1';
const ROLES = ['root', 'admin', 'moderator', 'player'];
const validName = n => typeof n === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(n);
const validPw = p => typeof p === 'string' && p.length >= 8 && p.length <= 72;
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
const fail = msg => { console.error('error: ' + msg); process.exit(1); };

function serverRunning() {
  return new Promise(resolve => {
    const req = http.get({ host: HOST === '0.0.0.0' ? '127.0.0.1' : HOST, port: PORT, path: '/api/health', timeout: 1500 }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}
function loadDb() {
  let db = {}; try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') fail(`cannot read ${DB_FILE}: ${e.message}`); }
  db.accounts ||= {}; db.sessions ||= {}; db.staffRoles ||= {};
  return db;
}
function saveDb(db) { fs.mkdirSync(DATA_DIR, { recursive: true }); const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
const roleOf = (db, a) => {
  const env = String(process.env.GBQ_ROOT_ID || '').toLowerCase(), envAdmin = String(process.env.GBQ_ADMIN_ID || '').toLowerCase();
  if (env && a.id.toLowerCase() === env) return 'root (GBQ_ROOT_ID)';
  if (envAdmin && a.id.toLowerCase() === envAdmin) return 'admin (GBQ_ADMIN_ID)';
  return db.staffRoles[a.id] || 'player';
};

async function main() {
  const args = process.argv.slice(2), force = args.includes('--force'), [cmd, ...rest] = args.filter(a => a !== '--force');
  if (!cmd || cmd === 'help' || cmd === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 13).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return; }
  if (cmd !== 'list' && !force && await serverRunning()) fail(`the realm server is running on ${HOST}:${PORT}. Stop it first (it would overwrite this change), or claim admin in game: ONLINE > ACCOUNT > CLAIM REALM ADMIN.`);
  const db = loadDb(), audit = createAuditLog({ dir: LOG_DIR }), who = `cli:${process.env.USER || process.env.USERNAME || 'local'}`;
  const find = name => db.accounts[String(name || '').toLowerCase()] || fail(`no account named "${name}". Use: npm run admin -- list`);
  if (cmd === 'list') {
    const rows = Object.values(db.accounts).map(a => [a.name, roleOf(db, a), a.id]);
    if (!rows.length) return console.log(`No accounts yet in ${DB_FILE}.`);
    for (const [n, r, id] of rows) console.log(`${n.padEnd(17)} ${r.padEnd(22)} ${id}`);
    return;
  }
  if (cmd === 'create') {
    const [name, password, role = 'root'] = rest;
    if (!validName(name)) fail('name: 3-16 letters, digits or _');
    if (!validPw(password)) fail('password: 8-72 characters');
    if (!ROLES.includes(role)) fail(`role: ${ROLES.join(', ')}`);
    if (db.accounts[name.toLowerCase()]) fail('that name is taken (use promote)');
    const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(password, salt)).toString('hex');
    const acct = { id: crypto.randomUUID(), name, salt, hash, created: Date.now(), lastLogin: null };
    db.accounts[name.toLowerCase()] = acct; if (role !== 'player') db.staffRoles[acct.id] = role;
    saveDb(db); audit.record({ action: 'admin.account.create', actor: who, target: name, details: { role, via: 'cli' } });
    return console.log(`Created ${role} account ${name}. Start the server and sign in at /admin or in game (ONLINE > ACCOUNT).`);
  }
  if (cmd === 'promote' || cmd === 'demote') {
    const acct = find(rest[0]), role = cmd === 'demote' ? 'player' : (rest[1] || 'root');
    if (!ROLES.includes(role)) fail(`role: ${ROLES.join(', ')}`);
    if (role === 'player') delete db.staffRoles[acct.id]; else db.staffRoles[acct.id] = role;
    saveDb(db); audit.record({ action: 'admin.staff.role', actor: who, target: acct.name, details: { role, via: 'cli' } });
    return console.log(`${acct.name} is now ${role}.`);
  }
  fail(`unknown command "${cmd}". Use: list, create, promote, demote`);
}
main().catch(e => fail(e.message));
