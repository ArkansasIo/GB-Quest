import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

const enabled = !!process.env.GBQ_TEST_DATABASE_URL;

test('PostgreSQL MMO service supports accounts, characters, authenticated zones and authoritative play', { skip: !enabled }, async () => {
  const { WebSocket } = await import('ws');
  const { Pool } = await import('pg');
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

    const inventoryResponse = await fetch(base + `/api/characters/${character.id}/inventory`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(inventoryResponse.status, 200);
    const inventory = await inventoryResponse.json();
    assert.equal(inventory.items.length, 3);
    const sword = inventory.items.find(item => item.item_id === 'rusty_sword');
    assert.ok(sword && sword.quantity === 1 && sword.equipped === false);
    const equip = await fetch(base + `/api/characters/${character.id}/equip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ inventoryId: sword.inventory_id })
    });
    assert.equal(equip.status, 200);
    assert.equal((await equip.json()).equipped[0].slot, 'main_hand');
    const potion = inventory.items.find(item => item.item_id === 'minor_potion');
    const rejectPotion = await fetch(base + `/api/characters/${character.id}/equip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ inventoryId: potion.inventory_id })
    });
    assert.equal(rejectPotion.status, 400);
    const testPool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try { await testPool.query('UPDATE characters SET hp=50 WHERE id=$1', [character.id]); }
    finally { await testPool.end(); }
    const usePotion = await fetch(base + `/api/characters/${character.id}/use-item`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ inventoryId: potion.inventory_id })
    });
    assert.equal(usePotion.status, 200);
    const potionResult = await usePotion.json();
    assert.equal(potionResult.resources.hp, 80);
    assert.equal(potionResult.remaining, 4);
    const unequip = await fetch(base + `/api/characters/${character.id}/unequip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ slot: 'main_hand' })
    });
    assert.equal(unequip.status, 200);

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

    const questListResponse = await fetch(base + `/api/characters/${character.id}/quests`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(questListResponse.status, 200);
    const questList = await questListResponse.json();
    assert.equal(questList.quests[0].id, 'first_slime');
    assert.equal(questList.quests[0].status, 'available');
    const acceptQuest = await fetch(base + `/api/characters/${character.id}/quests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ questId: 'first_slime' })
    });
    assert.equal(acceptQuest.status, 201);
    let sequence = 5, defeated = false;
    for (let attempt = 0; attempt < 8 && !defeated; attempt++) {
      send(sequence++, 'combat.intent', { targetId: '00000000-0000-4000-8000-000000000001' });
      const combat = await waitFor('combat.resolved');
      assert.ok(combat.payload.damage >= 1);
      assert.equal(combat.payload.targetId, '00000000-0000-4000-8000-000000000001');
      defeated = combat.payload.defeated;
      if (!defeated) await new Promise(resolve => setTimeout(resolve, 700));
    }
    assert.equal(defeated, true, 'Training Slime should be defeated by the test character');
    const reward = await waitFor('loot.reward');
    assert.equal(reward.payload.completedQuests.length, 1);
    assert.equal(reward.payload.completedQuests[0].id, 'first_slime');
    assert.ok(reward.payload.gold >= 25);
    const finalQuestsResponse = await fetch(base + `/api/characters/${character.id}/quests`, {
      headers: { authorization: 'Bearer ' + token }
    });
    const finalQuests = await finalQuestsResponse.json();
    assert.equal(finalQuests.quests[0].status, 'completed');
    const walletResponse = await fetch(base + `/api/characters/${character.id}/wallet`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(walletResponse.status, 200);
    const wallet = await walletResponse.json();
    assert.ok(wallet.gold >= 25);
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
