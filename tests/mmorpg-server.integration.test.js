import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

const enabled = !!process.env.GBQ_TEST_DATABASE_URL;

test('PostgreSQL MMO service supports accounts, characters, authenticated zones and authoritative play', { skip: !enabled }, async () => {
  const { WebSocket } = await import('ws');
  const port = 18788;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['backend/mmorpg-server.cjs'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: process.env.GBQ_TEST_DATABASE_URL,
      GBQ_TOKEN_SECRET: 'integration-test-secret-'.padEnd(48, 'x'),
      GBQ_ALLOWED_ORIGINS: 'https://game.example.test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  let socket;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) throw new Error('MMO server exited: ' + logs);
      try {
        const response = await fetch(base + '/health');
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(ready, true, 'MMO server did not become healthy: ' + logs);

    const username = 'it' + crypto.randomBytes(5).toString('hex');
    const register = await fetch(base + '/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: 'integration-password-123' })
    });
    assert.equal(register.status, 201);
    const { token, account } = await register.json();
    assert.ok(token && account.id);

    const create = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: 'Integration Hero', class: 'ranger' })
    });
    assert.equal(create.status, 201);
    const { character } = await create.json();
    assert.equal(character.class, 'ranger');

    socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages = [];
    socket.addEventListener('message', event => {
      try { messages.push(JSON.parse(event.data.toString())); } catch {}
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket open timed out')), 5000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', error => { clearTimeout(timer); reject(error); }, { once: true });
    });
    const waitFor = async type => {
      for (let i = 0; i < 80; i++) {
        const index = messages.findIndex(message => message.type === type);
        if (index >= 0) return messages.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(`Timed out waiting for ${type}; received: ${messages.map(m => m.type).join(', ')}`);
    };
    const send = (sequence, type, payload) => socket.send(JSON.stringify({ sequence, type, payload }));

    send(1, 'authenticate', { token });
    const authenticated = await waitFor('authenticated');
    assert.equal(authenticated.payload.account.id, account.id);
    send(2, 'character.select', { characterId: character.id });
    const snapshot = await waitFor('zone.snapshot');
    assert.equal(snapshot.payload.self.id, character.id);
    assert.ok(snapshot.payload.mobs.length >= 1);

    send(3, 'movement.input', { dx: 1, dy: 0 });
    const moved = await waitFor('movement.accepted');
    assert.equal(moved.payload.x, 9);
    send(4, 'chat.send', { text: 'Integration test online' });
    const chat = await waitFor('chat.message');
    assert.equal(chat.payload.text, 'Integration test online');

    send(5, 'combat.intent', { targetId: '00000000-0000-4000-8000-000000000001' });
    const combat = await waitFor('combat.resolved');
    assert.ok(combat.payload.damage >= 1);
    assert.equal(combat.payload.targetId, '00000000-0000-4000-8000-000000000001');
  } finally {
    if (socket) socket.close();
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000).unref();
    });
  }
});
