import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

// Regions and realms on the authoritative MMO server. Needs PostgreSQL with backend/migrations applied:
//   GBQ_TEST_DATABASE_URL=postgres://... node --test tests/mmorpg-realms.integration.test.js
const enabled = !!process.env.GBQ_TEST_DATABASE_URL;

test('regions list realms; realms keep separate worlds, names and chat', { skip: !enabled }, async () => {
  const { WebSocket } = await import('ws');
  const port = 18789, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['backend/mmorpg-server.cjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: process.env.GBQ_TEST_DATABASE_URL,
      GBQ_TOKEN_SECRET: 'realm-test-secret-'.padEnd(48, 'x'), GBQ_ALLOWED_ORIGINS: 'https://game.example.test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', c => { logs += c; }); child.stderr.on('data', c => { logs += c; });
  const sockets = [];
  try {
    for (let i = 0; i < 60 && child.exitCode === null; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
    const post = (path, body, token) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    const account = async () => { const r = await post('/api/register', { username: 'rl' + crypto.randomBytes(5).toString('hex'), password: 'realm-password-123' }); assert.equal(r.status, 201, logs); return (await r.json()).token; };

    // public region list: 3 regions, 9 realms, live population and load
    const regions = (await (await fetch(base + '/api/regions')).json()).regions;
    assert.deepEqual(regions.map(r => r.tag), ['NA', 'EU', 'AP']);
    const realms = regions.flatMap(r => r.realms);
    assert.equal(realms.length, 9);
    for (const r of realms) { assert.ok(['PvE', 'PvP', 'Roleplay', 'Seasonal'].includes(r.type)); assert.ok(r.maxPlayers > 0 && r.population >= 0 && r.load); }
    assert.ok(realms.find(r => r.id === 'stormwake').pvp);
    const eu = (await (await fetch(base + '/api/realms?region=lordeon')).json()).realms;
    assert.deepEqual(eu.map(r => r.id).sort(), ['frostmarch', 'moonfall', 'stormwake']);

    // characters are created on a realm; names are unique per realm, not across realms
    const a = await account(), b = await account(), name = 'Rl' + crypto.randomBytes(3).toString('hex');
    const ca = await post('/api/characters', { name, class: 'mage', realmId: 'moonfall' }, a);
    assert.equal(ca.status, 201); const charA = (await ca.json()).character; assert.equal(charA.realm_id, 'moonfall');
    assert.equal((await post('/api/characters', { name: name.toUpperCase(), class: 'rogue', realmId: 'moonfall' }, b)).status, 409);
    const cbOther = await post('/api/characters', { name, class: 'rogue', realmId: 'emberwild' }, b);
    assert.equal(cbOther.status, 201); const charBOther = (await cbOther.json()).character;
    const cb = await post('/api/characters', { name: 'Mate' + crypto.randomBytes(2).toString('hex'), class: 'cleric', realmId: 'moonfall' }, b);
    assert.equal(cb.status, 201); const charB = (await cb.json()).character;
    assert.equal((await post('/api/characters', { name: 'Nowhere', class: 'mage', realmId: 'atlantis' }, a)).status, 400);
    // per-realm cap: 3 on one realm
    for (let i = 0; i < 2; i++) assert.equal((await post('/api/characters', { name: 'Alt' + i + crypto.randomBytes(2).toString('hex'), class: 'mage', realmId: 'moonfall' }, a)).status, 201);
    assert.equal((await post('/api/characters', { name: 'Alt9' + crypto.randomBytes(2).toString('hex'), class: 'mage', realmId: 'moonfall' }, a)).status, 409);
    const mine = await (await fetch(base + '/api/regions', { headers: { authorization: 'Bearer ' + a } })).json();
    assert.equal(mine.regions.flatMap(r => r.realms).find(r => r.id === 'moonfall').characters, 3);

    // sockets
    const open = async token => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = [], seq = { n: 0 };
      ws.addEventListener('message', e => { try { messages.push(JSON.parse(e.data.toString())); } catch {} });
      await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
      sockets.push(ws);
      const c = { ws, messages,
        send: (type, payload) => ws.send(JSON.stringify({ sequence: ++seq.n, type, payload })),
        waitFor: async (type, pred = () => true) => { for (let i = 0; i < 80; i++) { const k = messages.findIndex(m => m.type === type && pred(m.payload)); if (k >= 0) return messages.splice(k, 1)[0].payload; await new Promise(r => setTimeout(r, 50)); } throw new Error(`no ${type}: ${messages.map(m => m.type + (m.payload && m.payload.code ? ':' + m.payload.code : '')).join(', ')}`); },
        none: async (type, ms = 600) => { await new Promise(r => setTimeout(r, ms)); return !messages.some(m => m.type === type); } };
      c.send('authenticate', { token }); const auth = await c.waitFor('authenticated'); assert.equal(auth.realms.length, 9);
      return c;
    };
    const A = await open(a); A.send('character.select', { characterId: charA.id });
    const snapA = await A.waitFor('zone.snapshot'); assert.equal(snapA.realm.id, 'moonfall'); assert.equal(snapA.mobs.length, 3);
    // B on another realm: different monsters, and A does not see B arrive
    const Bx = await open(b); Bx.send('character.select', { characterId: charBOther.id });
    const snapBx = await Bx.waitFor('zone.snapshot'); assert.equal(snapBx.realm.id, 'emberwild');
    assert.ok(snapBx.mobs.every(m => !snapA.mobs.some(n => n.id === m.id)), 'each realm has its own monsters');
    assert.ok(await A.none('presence.joined'));
    // switch B to the moonfall character: now A sees B join
    Bx.send('character.select', { characterId: charB.id });
    const snapB = await Bx.waitFor('zone.snapshot'); assert.equal(snapB.realm.id, 'moonfall');
    assert.ok(snapB.players.some(p => p.id === charA.id));
    await A.waitFor('presence.joined', p => p.id === charB.id);
    // population shows the two players on moonfall
    const live = (await (await fetch(base + '/api/realms?region=lordeon')).json()).realms.find(r => r.id === 'moonfall');
    assert.equal(live.population, 2);
    // chat: realm channel reaches the realm; whisper reaches one player by name; unknown name errors
    A.send('chat.send', { text: 'hello realm', channel: 'realm' });
    const rc = await Bx.waitFor('chat.message', m => m.text === 'hello realm'); assert.equal(rc.channel, 'realm');
    await new Promise(r => setTimeout(r, 1300));
    A.send('chat.send', { text: 'psst', channel: 'whisper', to: charB.name.toLowerCase() });
    const wb = await Bx.waitFor('chat.message', m => m.text === 'psst'); assert.equal(wb.channel, 'whisper'); assert.equal(wb.to, charB.name);
    await new Promise(r => setTimeout(r, 1300));
    A.send('chat.send', { text: 'anyone', channel: 'whisper', to: 'Nobody' + crypto.randomBytes(2).toString('hex') });
    assert.equal((await A.waitFor('error', p => p.code === 'whisper_target_offline')).code, 'whisper_target_offline');
  } finally {
    for (const s of sockets) try { s.close(); } catch {}
    child.kill('SIGTERM');
  }
});
