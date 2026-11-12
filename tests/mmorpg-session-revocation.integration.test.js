import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

// Server-side session revocation (migration 017). Needs PostgreSQL with backend/migrations applied:
//   GBQ_TEST_DATABASE_URL=postgres://... node --test tests/mmorpg-session-revocation.integration.test.js
const enabled = !!process.env.GBQ_TEST_DATABASE_URL;
const SECRET = 'revocation-test-secret-'.padEnd(48, 'x');

// A token in the pre-017 format (no "tv" claim), signed the way the server signs tokens.
function legacyToken(accountId) {
  const payload = Buffer.from(JSON.stringify({ sub: accountId, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'gbquest-mmorpg' })).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

test('logout and password change revoke earlier MMO tokens; pre-revocation tokens stay valid until then', { skip: !enabled }, async () => {
  const { WebSocket } = await import('ws');
  const port = 18791, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['backend/mmorpg-server.cjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: process.env.GBQ_TEST_DATABASE_URL, GBQ_TOKEN_SECRET: SECRET },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', c => { logs += c; }); child.stderr.on('data', c => { logs += c; });
  const post = (path, token, body = {}) => fetch(base + path, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body)
  });
  const me = token => fetch(base + '/api/me', { headers: { authorization: 'Bearer ' + token } }).then(r => r.status);
  // Opens a socket, authenticates, and resolves with how the server answered: 'authenticated' or the close code.
  const authenticate = token => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('socket timeout')); }, 5000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'authenticate', sequence: 1, payload: { token } })));
    ws.on('message', raw => { const m = JSON.parse(raw); if (m.type === 'authenticated') { clearTimeout(timer); resolve({ result: 'authenticated', ws }); } });
    ws.on('close', code => { clearTimeout(timer); resolve({ result: code, ws }); });
    ws.on('error', () => {});
  });
  try {
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      if (child.exitCode !== null) throw new Error('MMO server exited: ' + logs);
      try { ready = (await fetch(base + '/health')).ok; } catch {}
      if (!ready) await new Promise(r => setTimeout(r, 250));
    }
    assert.equal(ready, true, 'MMO server did not become healthy: ' + logs);

    const username = 'rv' + crypto.randomBytes(5).toString('hex'), password = 'first-password-123';
    const register = await post('/api/register', null, { username, password });
    assert.equal(register.status, 201);
    const { token: first, account } = await register.json();
    const second = (await (await post('/api/login', null, { username, password })).json()).token;
    const legacy = legacyToken(account.id);
    assert.equal(await me(first), 200);
    assert.equal(await me(second), 200);
    assert.equal(await me(legacy), 200, 'tokens issued before migration 017 (no tv claim) keep working');

    // a live socket on this instance is closed when the account signs out
    const live = await authenticate(second);
    assert.equal(live.result, 'authenticated');
    const closed = new Promise(r => live.ws.on('close', code => r(code)));

    const logout = await post('/api/logout', first);
    assert.equal(logout.status, 200);
    assert.equal(await closed, 4401);
    assert.equal(await me(first), 401, 'the signing-out token is revoked');
    assert.equal(await me(second), 401, 'other sessions are revoked');
    assert.equal(await me(legacy), 401, 'pre-017 tokens are revoked too');
    assert.equal((await authenticate(second)).result, 4401, 'a revoked token cannot open a realm socket');
    assert.equal((await post('/api/logout', first)).status, 401);

    // signing in again works and issues a token for the new version
    const third = (await (await post('/api/login', null, { username, password })).json()).token;
    const fourth = (await (await post('/api/login', null, { username, password })).json()).token;
    assert.equal(await me(third), 200);

    // password change: wrong current password is refused; success revokes other sessions and returns a new token
    assert.equal((await post('/api/password', third, { oldPassword: 'wrong-password-000', newPassword: 'second-password-456' })).status, 401);
    assert.equal((await post('/api/password', third, { oldPassword: password, newPassword: 'short' })).status, 400);
    const changed = await post('/api/password', third, { oldPassword: password, newPassword: 'second-password-456' });
    assert.equal(changed.status, 200);
    const fresh = (await changed.json()).token;
    assert.equal(await me(fresh), 200);
    assert.equal(await me(third), 401);
    assert.equal(await me(fourth), 401);
    assert.equal((await post('/api/login', null, { username, password })).status, 401, 'old password no longer works');
    assert.equal((await post('/api/login', null, { username, password: 'second-password-456' })).status, 200);
  } finally {
    child.kill('SIGTERM');
    await new Promise(r => child.once('exit', r));
  }
});
