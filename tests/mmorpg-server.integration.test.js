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
      GBQ_ALLOWED_ORIGINS: 'https://game.example.test',
      GBQ_WS_AUTH_TIMEOUT_MS: '500',
      GBQ_WS_HEARTBEAT_MS: '5000'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  let socket, secondSocket, duplicateSocket, unauthenticatedSocket;
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

    const progressionPool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try {
      const levels = await progressionPool.query(`SELECT
        gbq_level_for_xp(0)::int AS level_zero,
        gbq_level_for_xp(300)::int AS level_two,
        gbq_level_for_xp(355000)::int AS level_twenty,
        gbq_level_for_xp(385902)::int AS level_twenty_one,
        gbq_level_for_xp(9223372036854775807)::int AS level_cap`);
      assert.deepEqual(Object.values(levels.rows[0]), [1, 2, 20, 21, 720]);
    } finally { await progressionPool.end(); }


    const preflight = await fetch(base + '/api/login', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://game.example.test',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://game.example.test');
    assert.match(preflight.headers.get('access-control-allow-methods') || '', /POST/);
    const blockedOrigin = await fetch(base + '/health', { headers: { origin: 'https://attacker.invalid' } });
    assert.equal(blockedOrigin.status, 403);


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
      body: JSON.stringify({ name: 'Hero' + crypto.randomBytes(4).toString('hex'), class: 'strider', species: 'thornelf', background: 'scholar' })
    });
    assert.equal(create.status, 201);
    const { character } = await create.json();
    assert.equal(character.class, 'strider');
    assert.equal(character.species, 'thornelf');
    assert.equal(character.background, 'scholar');
    const secondCreate = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: 'Recip' + crypto.randomBytes(4).toString('hex'), class: 'chaplain' })
    });
    assert.equal(secondCreate.status, 201);
    const { character: recipientCharacter } = await secondCreate.json();


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
    const equippedTrade = await fetch(base + `/api/characters/${character.id}/trades`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ toCharacterId: recipientCharacter.id, itemId: 'rusty_sword', quantity: 1 })
    });
    assert.equal(equippedTrade.status, 409);
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

    // Unauthenticated sockets are closed quickly instead of consuming server resources indefinitely.
    unauthenticatedSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const unauthenticatedClose = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Unauthenticated socket was not timed out')), 3000);
      unauthenticatedSocket.once('close', (code, reason) => { clearTimeout(timer); resolve({ code, reason: reason.toString() }); });
    });
    assert.equal(unauthenticatedClose.code, 4408);

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
      throw new Error(`Timed out waiting for ${type}; received: ${JSON.stringify(messages)}`);
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

    // A second account enters the same realm and zone. Both clients must receive
    // the same authoritative presence, movement and chat events.
    const secondUsername = 'mp' + crypto.randomBytes(5).toString('hex');
    const secondRegister = await fetch(base + '/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: secondUsername, password: 'integration-password-456' })
    });
    assert.equal(secondRegister.status, 201);
    const secondAccount = await secondRegister.json();
    const multiplayerCreate = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + secondAccount.token },
      body: JSON.stringify({ name: 'Multi' + crypto.randomBytes(4).toString('hex'), class: 'warden', realmId: character.realm_id })
    });
    assert.equal(multiplayerCreate.status, 201);
    const secondCharacter = (await multiplayerCreate.json()).character;

    secondSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const secondMessages = [];
    secondSocket.on('message', data => { try { secondMessages.push(JSON.parse(data.toString())); } catch {} });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Second WebSocket open timed out')), 5000);
      secondSocket.once('open', () => { clearTimeout(timer); resolve(); });
      secondSocket.once('error', error => { clearTimeout(timer); reject(error); });
    });
    const waitForSecond = async type => {
      for (let i = 0; i < 100; i++) {
        const index = secondMessages.findIndex(message => message.type === type);
        if (index >= 0) return secondMessages.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Second client timed out waiting for ${type}; received: ${secondMessages.map(m => m.type).join(', ')}`);
    };
    const sendSecond = (sequence, type, payload) => secondSocket.send(JSON.stringify({ sequence, type, payload }));
    sendSecond(1, 'authenticate', { token: secondAccount.token });
    assert.equal((await waitForSecond('authenticated')).payload.account.id, secondAccount.account.id);
    sendSecond(2, 'character.select', { characterId: secondCharacter.id });
    const secondSnapshot = await waitForSecond('zone.snapshot');
    assert.ok(secondSnapshot.payload.players.some(player => player.id === character.id), 'second player snapshot includes first player');
    const joined = await waitFor('presence.joined');
    assert.equal(joined.payload.id, secondCharacter.id);

    sendSecond(3, 'movement.input', { dx: 1, dy: 0 });
    const secondMoved = await waitForSecond('movement.accepted');
    assert.equal(secondMoved.payload.characterId, secondCharacter.id);
    const remoteMove = await waitFor('presence.moved');
    assert.equal(remoteMove.payload.characterId, secondCharacter.id);
    assert.equal(remoteMove.payload.x, secondMoved.payload.x);

    sendSecond(4, 'chat.send', { text: 'Hello from player two' });
    const remoteChat = await waitFor('chat.message');
    assert.equal(remoteChat.payload.text, 'Hello from player two');
    assert.equal(remoteChat.payload.characterId, secondCharacter.id);

    sendSecond(5, 'chat.send', { channel: 'trade', text: 'must not leak into zone chat' });
    assert.equal((await waitForSecond('error')).payload.code, 'unsupported_chat_channel');

    // Persistent party lifecycle: leader creates, invites a same-realm player,
    // invitee accepts, and party chat is delivered only to party members.
    send(6, 'party.create', {});
    const partyCreated = await waitFor('party.snapshot');
    const partyId = partyCreated.payload.party.id;
    assert.equal(partyCreated.payload.party.members.length, 1);
    send(7, 'party.invite', { to: secondCharacter.name });
    assert.equal((await waitFor('party.invite_sent')).payload.invitation.toCharacterId, secondCharacter.id);
    const invitation = await waitForSecond('party.invited');
    sendSecond(6, 'party.accept', { invitationId: invitation.payload.id });
    const partyUpdateForLeader = await waitFor('party.updated');
    assert.equal(partyUpdateForLeader.payload.party.members.length, 2);
    const partyUpdateForMember = await waitForSecond('party.updated');
    assert.equal(partyUpdateForMember.payload.party.id, partyId);
    // Respect the server's 1.2-second per-character chat throttle after the zone-chat case above.
    await new Promise(resolve => setTimeout(resolve, 1250));
    sendSecond(7, 'chat.send', { channel: 'party', text: 'Party channel online' });
    const partyChat = await waitFor('chat.message');
    assert.equal(partyChat.payload.channel, 'party');
    assert.equal(partyChat.payload.text, 'Party channel online');

    send(8, 'party.kick', { characterId: secondCharacter.id });
    assert.equal((await waitForSecond('party.kicked')).payload.partyId, partyId);
    const partyAfterKick = await waitFor('party.updated');
    assert.equal(partyAfterKick.payload.party.members.length, 1);


    // Guilds persist separately from parties, with officer permissions and guild-only chat.
    send(9, 'guild.create', { name: 'Test Guild ' + crypto.randomBytes(3).toString('hex') });
    const guildCreated=await waitFor('guild.snapshot');
    const guildId=guildCreated.payload.guild.id;
    assert.equal(guildCreated.payload.guild.members.length,1);
    send(10, 'guild.invite', { to: secondCharacter.name });
    const guildInvite=await waitForSecond('guild.invited');
    assert.equal((await waitFor('guild.invite_sent')).payload.invitation.id,guildInvite.payload.id);
    sendSecond(8,'guild.accept',{invitationId:guildInvite.payload.id});
    const guildUpdate=await waitFor('guild.updated');
    assert.equal(guildUpdate.payload.guild.members.length,2);
    assert.equal((await waitForSecond('guild.updated')).payload.guild.id,guildId);
    send(11,'guild.rank',{characterId:secondCharacter.id,rank:'officer'});
    const promoted=await waitForSecond('guild.updated');
    assert.equal(promoted.payload.guild.members.find(x=>x.characterId===secondCharacter.id).rank,'officer');
    await waitFor('guild.updated');
    await new Promise(resolve=>setTimeout(resolve,1250));
    sendSecond(9,'chat.send',{channel:'guild',text:'Guild chat works'});
    assert.equal((await waitFor('chat.message')).payload.text,'Guild chat works');
    sendSecond(10,'guild.leave',{});
    assert.equal((await waitForSecond('guild.left')).payload.guildId,guildId);
    assert.equal((await waitFor('guild.updated')).payload.guild.members.length,1);

    // The same character cannot be controlled by two live sockets at once.
    duplicateSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const duplicateMessages = [];
    duplicateSocket.on('message', data => { try { duplicateMessages.push(JSON.parse(data.toString())); } catch {} });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Duplicate WebSocket open timed out')), 5000);
      duplicateSocket.once('open', () => { clearTimeout(timer); resolve(); });
      duplicateSocket.once('error', error => { clearTimeout(timer); reject(error); });
    });
    const waitForDuplicate = async type => {
      for (let i = 0; i < 100; i++) {
        const index = duplicateMessages.findIndex(message => message.type === type);
        if (index >= 0) return duplicateMessages.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Duplicate client timed out waiting for ${type}`);
    };
    duplicateSocket.send(JSON.stringify({ sequence: 1, type: 'authenticate', payload: { token } }));
    await waitForDuplicate('authenticated');
    duplicateSocket.send(JSON.stringify({ sequence: 2, type: 'character.select', payload: { characterId: character.id } }));
    assert.equal((await waitForDuplicate('error')).payload.code, 'character_already_online');

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
    let sequence = 12, defeated = false;
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
    let wallet = await walletResponse.json();
    assert.ok(wallet.gold >= 25);
    const bankBefore = await fetch(base + `/api/characters/${character.id}/bank`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(bankBefore.status, 200);
    assert.equal((await bankBefore.json()).bankGold, '0');
    const deposit = await fetch(base + `/api/characters/${character.id}/bank/deposit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: 10 })
    });
    assert.equal(deposit.status, 200);
    const deposited = await deposit.json();
    assert.equal(deposited.amount, '10');
    assert.equal(deposited.bankGold, '10');
    const withdraw = await fetch(base + `/api/characters/${character.id}/bank/withdraw`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: 4 })
    });
    assert.equal(withdraw.status, 200);
    const withdrawn = await withdraw.json();
    assert.equal(withdrawn.bankGold, '6');
    assert.equal(BigInt(withdrawn.gold), BigInt(deposited.gold) + 4n);
    const overdraft = await fetch(base + `/api/characters/${character.id}/bank/withdraw`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: 99 })
    });
    assert.equal(overdraft.status, 409);
    const invalidDeposit = await fetch(base + `/api/characters/${character.id}/bank/deposit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: 0 })
    });
    assert.equal(invalidDeposit.status, 400);
    const bankAfter = await fetch(base + `/api/characters/${character.id}/bank`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal((await bankAfter.json()).bankGold, '6');
    const bankAuditPool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try {
      const audit = await bankAuditPool.query(
        'SELECT action,amount FROM bank_transactions WHERE character_id=$1 ORDER BY id DESC LIMIT 2',
        [character.id]
      );
      assert.deepEqual(audit.rows.map(row => [row.action, String(row.amount)]), [['withdraw', '4'], ['deposit', '10']]);
    } finally { await bankAuditPool.end(); }
    const vendorListResponse = await fetch(base + '/api/vendors', {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(vendorListResponse.status, 200);
    const vendorList = await vendorListResponse.json();
    assert.ok(vendorList.vendors.some(vendor => vendor.id === 'aelmoor_general'));
    const vendorResponse = await fetch(base + '/api/vendors/aelmoor_general', {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(vendorResponse.status, 200);
    const vendor = await vendorResponse.json();
    assert.ok(vendor.items.some(item => item.item_id === 'minor_potion'));
    const buyResponse = await fetch(base + `/api/characters/${character.id}/vendor/buy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ vendorId: 'aelmoor_general', itemId: 'minor_potion', quantity: 1 })
    });
    assert.equal(buyResponse.status, 200);
    const buy = await buyResponse.json();
    assert.equal(buy.totalGold, '18');
    const afterBuyInventory = await (await fetch(base + `/api/characters/${character.id}/inventory`, {
      headers: { authorization: 'Bearer ' + token }
    })).json();
    const potionStack = afterBuyInventory.items.find(item => item.item_id === 'minor_potion');
    assert.equal(potionStack.quantity, 5);
    const sellResponse = await fetch(base + `/api/characters/${character.id}/vendor/sell`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ vendorId: 'aelmoor_general', itemId: 'minor_potion', inventoryId: potionStack.inventory_id, quantity: 1 })
    });
    assert.equal(sellResponse.status, 200);
    const sell = await sellResponse.json();
    assert.equal(sell.totalGold, '6');
    assert.equal(Number(sell.gold), Number(buy.gold) + 6);
    const insufficient = await fetch(base + `/api/characters/${character.id}/vendor/buy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ vendorId: 'aelmoor_general', itemId: 'minor_potion', quantity: 99 })
    });
    assert.equal(insufficient.status, 409);
    const invalidZone = await fetch(base + `/api/characters/${character.id}/vendor/buy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ vendorId: 'unknown_vendor', itemId: 'minor_potion', quantity: 1 })
    });
    assert.equal(invalidZone.status, 404);
    const senderWalletBeforeTrade = await (await fetch(base + `/api/characters/${character.id}/wallet`, {
      headers: { authorization: 'Bearer ' + token }
    })).json();
    const recipientWalletBeforeTrade = await (await fetch(base + `/api/characters/${recipientCharacter.id}/wallet`, {
      headers: { authorization: 'Bearer ' + token }
    })).json();
    const createTrade = await fetch(base + `/api/characters/${character.id}/trades`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ toCharacterId: recipientCharacter.id, itemId: 'minor_potion', quantity: 1, goldAmount: 5 })
    });
    assert.equal(createTrade.status, 201);
    const trade = (await createTrade.json()).trade;
    assert.equal(trade.status, 'pending');
    const tradeList = await fetch(base + `/api/characters/${recipientCharacter.id}/trades`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(tradeList.status, 200);
    assert.ok((await tradeList.json()).trades.some(entry => entry.id === trade.id));
    const acceptTrade = await fetch(base + `/api/trades/${trade.id}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({})
    });
    assert.equal(acceptTrade.status, 200);
    assert.equal((await acceptTrade.json()).status, 'completed');
    const senderWalletAfterTrade = await (await fetch(base + `/api/characters/${character.id}/wallet`, {
      headers: { authorization: 'Bearer ' + token }
    })).json();
    const recipientWalletAfterTrade = await (await fetch(base + `/api/characters/${recipientCharacter.id}/wallet`, {
      headers: { authorization: 'Bearer ' + token }
    })).json();
    assert.equal(senderWalletAfterTrade.gold, senderWalletBeforeTrade.gold - 5);
    assert.equal(recipientWalletAfterTrade.gold, recipientWalletBeforeTrade.gold + 5);
    const senderInventoryAfterTrade = await (await fetch(base + `/api/characters/${character.id}/inventory`, {
      headers: { authorization: 'Bearer ' + token }
    })).json();
    const recipientInventoryAfterTrade = await (await fetch(base + `/api/characters/${recipientCharacter.id}/inventory`, {
      headers: { authorization: 'Bearer ' + token }
    })).json();
    assert.equal(senderInventoryAfterTrade.items.find(item => item.item_id === 'minor_potion').quantity, 3);
    assert.equal(recipientInventoryAfterTrade.items.find(item => item.item_id === 'minor_potion').quantity, 6);
    const cancelOffer = await fetch(base + `/api/characters/${character.id}/trades`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ toCharacterId: recipientCharacter.id, goldAmount: 3 })
    });
    assert.equal(cancelOffer.status, 201);
    const cancelId = (await cancelOffer.json()).trade.id;
    const cancelResponse = await fetch(base + `/api/trades/${cancelId}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({})
    });
    assert.equal(cancelResponse.status, 200);
    assert.equal((await cancelResponse.json()).status, 'cancelled');
    const expiringOfferResponse = await fetch(base + `/api/characters/${character.id}/trades`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ toCharacterId: recipientCharacter.id, goldAmount: 2 })
    });
    assert.equal(expiringOfferResponse.status, 201);
    const expiringOfferId = (await expiringOfferResponse.json()).trade.id;
    const expirePool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try {
      await expirePool.query("UPDATE player_trade_offers SET expires_at=now()-interval '1 second' WHERE id=$1", [expiringOfferId]);
    } finally { await expirePool.end(); }
    const expiredAccept = await fetch(base + `/api/trades/${expiringOfferId}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({})
    });
    assert.equal(expiredAccept.status, 410);

    const tradeAuditPool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try {
      const audit = await tradeAuditPool.query(
        'SELECT item_id,quantity,gold_amount FROM player_trade_transactions WHERE offer_id=$1',
        [trade.id]
      );
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0].item_id, 'minor_potion');
      assert.equal(Number(audit.rows[0].quantity), 1);
      assert.equal(String(audit.rows[0].gold_amount), '5');
    } finally { await tradeAuditPool.end(); }

  } finally {
    for (const liveSocket of [socket, secondSocket, duplicateSocket, unauthenticatedSocket]) if (liveSocket && liveSocket.readyState < 2) liveSocket.close();
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000).unref();
    });
  }
});
