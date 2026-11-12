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
    const curvePool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try {
      const curve = await curvePool.query(`SELECT gbq_xp_for_level(2)::text AS level2,
        gbq_xp_for_level(21)::text AS level21,gbq_xp_for_level(720)::text AS level720`);
      assert.deepEqual(curve.rows[0], { level2: '300', level21: '380250', level720: '140355000' });
    } finally { await curvePool.end(); }

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
      body: JSON.stringify({ name: 'Hero' + crypto.randomBytes(4).toString('hex'), class: 'ranger' })
    });
    assert.equal(create.status, 201);
    const { character } = await create.json();
    assert.equal(character.class, 'ranger');
    const secondCreate = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: 'Recip' + crypto.randomBytes(4).toString('hex'), class: 'cleric' })
    });
    assert.equal(secondCreate.status, 201);
    const { character: recipientCharacter } = await secondCreate.json();


    const profileResponse = await fetch(base + `/api/characters/${character.id}/profile`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(profileResponse.status, 200);
    const initialProfile = await profileResponse.json();
    assert.equal(initialProfile.character.id, character.id);
    assert.equal(initialProfile.character.realm_id, character.realm_id);
    assert.equal(initialProfile.inventory.length, 3);
    assert.ok(Array.isArray(initialProfile.quests));
    assert.equal(initialProfile.character.talent_points, 0);
    const progressionPool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try { await progressionPool.query('UPDATE characters SET talent_points=2,xp=299 WHERE id=$1', [character.id]); }
    finally { await progressionPool.end(); }
    const allocateAttribute = await fetch(base + `/api/characters/${character.id}/attributes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ attribute: 'dex', points: 2 })
    });
    assert.equal(allocateAttribute.status, 200);
    const allocated = await allocateAttribute.json();
    assert.equal(allocated.talentPoints, 0);
    assert.equal(allocated.allocatedAttributes.dex, 2);
    const overspendAttribute = await fetch(base + `/api/characters/${character.id}/attributes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ attribute: 'con', points: 1 })
    });
    assert.equal(overspendAttribute.status, 409);
    assert.equal((await overspendAttribute.json()).error, 'insufficient_talent_points');

    const talentCatalogResponse = await fetch(base + '/api/talents?class=ranger');
    assert.equal(talentCatalogResponse.status, 200);
    const talentCatalog = await talentCatalogResponse.json();
    assert.equal(talentCatalog.specializations.length, 3);
    assert.equal(talentCatalog.specializations[0].nodes.length, 73);
    const chooseSpec = await fetch(base + `/api/characters/${character.id}/specialization`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ specializationId: 'ranger_hunter' })
    });
    assert.equal(chooseSpec.status, 200);
    const wrongClassSpec = await fetch(base + `/api/characters/${character.id}/specialization`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ specializationId: 'warrior_vanguard' })
    });
    assert.equal(wrongClassSpec.status, 400);
    const talentPointPool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
    try { await talentPointPool.query('UPDATE characters SET talent_points=1 WHERE id=$1', [character.id]); }
    finally { await talentPointPool.end(); }
    const unlockTalent = await fetch(base + `/api/characters/${character.id}/talents/ranger_hunter_node_00/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({})
    });
    assert.equal(unlockTalent.status, 200, JSON.stringify(await unlockTalent.clone().json()));
    assert.equal((await unlockTalent.json()).talentPoints, 0);
    const duplicateTalent = await fetch(base + `/api/characters/${character.id}/talents/ranger_hunter_node_00/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({})
    });
    assert.equal(duplicateTalent.status, 409);
    assert.equal((await duplicateTalent.json()).error, 'insufficient_talent_points');

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
    send(sequence++, 'combat.intent', { targetId: '00000000-0000-4000-8000-000000000001', abilityNodeId: 'not_unlocked_talent' });
    const rejectedAbility = await waitFor('error');
    assert.equal(rejectedAbility.payload.code, 'ability_not_unlocked_or_not_active');
    await new Promise(resolve => setTimeout(resolve, 700));
    for (let attempt = 0; attempt < 8 && !defeated; attempt++) {
      send(sequence++, 'combat.intent', { targetId: '00000000-0000-4000-8000-000000000001', ...(attempt === 0 ? { abilityNodeId: 'ranger_hunter_node_00' } : {}) });
      const combat = await waitFor('combat.resolved');
      if (attempt === 0) {
        assert.equal(combat.payload.ability.id, 'ranger_hunter_node_00');
        assert.equal(combat.payload.manaSpent, 5);
        const cooldownPool = new Pool({ connectionString: process.env.GBQ_TEST_DATABASE_URL });
        try {
          const cooldown = await cooldownPool.query(
            'SELECT ready_at FROM character_talent_cooldowns WHERE character_id=$1 AND node_id=$2',
            [character.id, 'ranger_hunter_node_00']
          );
          assert.equal(cooldown.rowCount, 1);
          assert.ok(new Date(cooldown.rows[0].ready_at).getTime() > Date.now());
        } finally { await cooldownPool.end(); }
        if (!combat.payload.defeated) {
          await new Promise(resolve => setTimeout(resolve, 700));
          send(sequence++, 'combat.intent', { targetId: '00000000-0000-4000-8000-000000000001', abilityNodeId: 'ranger_hunter_node_00' });
          const cooldownError = await waitFor('error');
          assert.equal(cooldownError.payload.code, 'ability_on_cooldown');
          assert.ok(cooldownError.payload.retryAfterSeconds >= 1);
          await new Promise(resolve => setTimeout(resolve, 700));
        }
      }
      assert.ok(combat.payload.damage >= 10, 'ranger DEX allocation should increase authoritative damage');
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
    const progressedProfile = await fetch(base + `/api/characters/${character.id}/profile`, {
      headers: { authorization: 'Bearer ' + token }
    });
    assert.equal(progressedProfile.status, 200);
    const progressed = await progressedProfile.json();
    assert.equal(progressed.character.level, 2);
    assert.equal(progressed.character.talent_points, 1);
    assert.equal(progressed.character.xp, '346');
    assert.equal(progressed.character.specialization_id, 'ranger_hunter');
    assert.equal(progressed.talents.length, 1);
    assert.equal(progressed.talents[0].node_id, 'ranger_hunter_node_00');
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
    if (socket) socket.close();
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000).unref();
    });
  }
});
