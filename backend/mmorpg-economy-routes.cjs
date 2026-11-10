'use strict';
const crypto = require('node:crypto');
const UUID = /^[0-9a-f-]{36}$/i;
const ITEM_ID = /^[a-z0-9_-]{1,48}$/i;
const MAX_ATTACHMENTS = 5;
const MAX_GOLD = 2000000000;

function parseAttachments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) return null;
  const seen = new Set(), out = [];
  for (const item of value) {
    const itemId = String(item?.itemId || '');
    const quantity = Number(item?.quantity);
    if (!ITEM_ID.test(itemId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 || seen.has(itemId)) return null;
    seen.add(itemId); out.push({ itemId, quantity });
  }
  return out;
}

async function handleMailRequest({ req, res, url, pool, accountFor, readBody, json }) {
  const inbox = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/mail$/i);
  const send = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/mail\/send$/i);
  const claim = url.pathname.match(/^\/api\/mail\/([0-9a-f-]{36})\/claim$/i);
  if (!inbox && !send && !claim) return false;
  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (inbox && req.method === 'GET') {
    const characterId = inbox[1], owned = await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [characterId, account.id]);
    if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
    const result = await pool.query(`SELECT m.id,m.subject,m.body,m.attachments,m.gold,m.claimed_at,m.expires_at,m.created_at,
      s.name AS sender_name FROM player_mail m LEFT JOIN characters s ON s.id=m.sender_character_id
      WHERE m.recipient_character_id=$1 AND m.expires_at>now()
      ORDER BY m.created_at DESC LIMIT 100`, [characterId]);
    json(res, 200, { mail: result.rows.map(row => ({ id: row.id, subject: row.subject, body: row.body, attachments: row.attachments, gold: Number(row.gold), claimed: !!row.claimed_at, claimedAt: row.claimed_at, expiresAt: row.expires_at, createdAt: row.created_at, senderName: row.sender_name })) });
    return true;
  }

  if (send && req.method === 'POST') {
    const senderId = send[1], body = await readBody(req), recipientId = String(body.recipientCharacterId || '');
    const subject = String(body.subject || '').trim(), message = String(body.body || '');
    const gold = Number(body.gold || 0), attachments = parseAttachments(body.attachments);
    if (!UUID.test(recipientId) || recipientId === senderId || subject.length > 80 || message.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(subject + message) || !Number.isSafeInteger(gold) || gold < 0 || gold > MAX_GOLD || !attachments) {
      json(res, 400, { error: 'invalid_mail_payload' }); return true;
    }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const chars = await tx.query('SELECT id,realm_id,gold FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[senderId, recipientId]]);
      const sender = chars.rows.find(row => row.id === senderId), recipient = chars.rows.find(row => row.id === recipientId);
      const owned = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [senderId, account.id]);
      if (!sender || !owned.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'sender_not_found' }); return true; }
      if (!recipient) { await tx.query('ROLLBACK'); json(res, 404, { error: 'recipient_not_found' }); return true; }
      if (sender.realm_id !== recipient.realm_id) { await tx.query('ROLLBACK'); json(res, 409, { error: 'cross_realm_mail' }); return true; }
      if (Number(sender.gold) < gold) { await tx.query('ROLLBACK'); json(res, 409, { error: 'insufficient_gold' }); return true; }
      for (const item of attachments) {
        const removed = await tx.query('UPDATE character_inventory SET quantity=quantity-$1 WHERE character_id=$2 AND item_id=$3 AND quantity>=$1 RETURNING quantity', [item.quantity, senderId, item.itemId]);
        if (!removed.rowCount) { await tx.query('ROLLBACK'); json(res, 409, { error: 'mail_attachment_unavailable', itemId: item.itemId }); return true; }
        if (Number(removed.rows[0].quantity) === 0) await tx.query('DELETE FROM character_inventory WHERE character_id=$1 AND item_id=$2', [senderId, item.itemId]);
      }
      if (gold) await tx.query('UPDATE characters SET gold=gold-$1,updated_at=now() WHERE id=$2', [gold, senderId]);
      const id = crypto.randomUUID();
      await tx.query(`INSERT INTO player_mail(id,realm_id,sender_character_id,recipient_character_id,subject,body,attachments,gold,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,now()+interval '30 days')`,
        [id, sender.realm_id, senderId, recipientId, subject, message, JSON.stringify(attachments), gold]);
      await tx.query('COMMIT'); json(res, 201, { mail: { id, recipientCharacterId: recipientId, subject, gold, attachments, expiresInDays: 30 } }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (claim && req.method === 'POST') {
    const mailId = claim[1], body = await readBody(req), characterId = String(body.characterId || '');
    if (!UUID.test(characterId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owner = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [characterId, account.id]);
      if (!owner.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const mail = await tx.query('SELECT id,realm_id,attachments,gold FROM player_mail WHERE id=$1 AND recipient_character_id=$2 AND claimed_at IS NULL AND expires_at>now() FOR UPDATE', [mailId, characterId]);
      if (!mail.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'mail_unavailable_or_already_claimed' }); return true; }
      const m = mail.rows[0], items = Array.isArray(m.attachments) ? m.attachments : [];
      const catalog = await tx.query('SELECT id,max_stack FROM item_catalog WHERE id=ANY($1::varchar[])', [items.map(x => x.itemId)]);
      const maxById = new Map(catalog.rows.map(x => [x.id, Number(x.max_stack)]));
      if (catalog.rowCount !== items.length) { await tx.query('ROLLBACK'); json(res, 409, { error: 'mail_attachment_catalog_missing' }); return true; }
      for (const item of items) {
        const existing = await tx.query('SELECT quantity FROM character_inventory WHERE character_id=$1 AND item_id=$2 FOR UPDATE', [characterId, item.itemId]);
        const current = existing.rowCount ? Number(existing.rows[0].quantity) : 0;
        if (current + Number(item.quantity) > maxById.get(item.itemId)) { await tx.query('ROLLBACK'); json(res, 409, { error: 'inventory_stack_limit', itemId: item.itemId }); return true; }
      }
      for (const item of items) await tx.query(`INSERT INTO character_inventory(character_id,item_id,quantity) VALUES($1,$2,$3)
        ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=character_inventory.quantity+EXCLUDED.quantity`, [characterId, item.itemId, item.quantity]);
      if (Number(m.gold)) await tx.query('UPDATE characters SET gold=gold+$1,updated_at=now() WHERE id=$2', [m.gold, characterId]);
      await tx.query('UPDATE player_mail SET claimed_at=now() WHERE id=$1', [mailId]);
      await tx.query('COMMIT'); json(res, 200, { claimed: true, gold: Number(m.gold), attachments: items }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  json(res, 405, { error: 'method_not_allowed' }); return true;
}

async function handleAuctionRequest({ req, res, url, pool, accountFor, readBody, json }) {
  const create = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/auctions$/i);
  const buy = url.pathname.match(/^\/api\/auctions\/([0-9a-f-]{36})\/buy$/i);
  const cancel = url.pathname.match(/^\/api\/auctions\/([0-9a-f-]{36})\/cancel$/i);
  if (!create && !buy && !cancel && url.pathname !== '/api/auctions') return false;
  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }

  if (url.pathname === '/api/auctions' && req.method === 'GET') {
    const realmId = String(url.searchParams.get('realmId') || ''), itemId = String(url.searchParams.get('itemId') || '');
    if (!/^[a-z0-9_-]{2,24}$/i.test(realmId) || (itemId && !ITEM_ID.test(itemId))) { json(res, 400, { error: 'invalid_auction_filter' }); return true; }
    const result = await pool.query(`SELECT a.id,a.item_id,i.name AS item_name,a.quantity,a.buyout_gold,a.expires_at,
      c.name AS seller_name FROM auction_listings a JOIN item_catalog i ON i.id=a.item_id
      JOIN characters c ON c.id=a.seller_character_id
      WHERE a.realm_id=$1 AND a.status='active' AND a.expires_at>now() AND ($2='' OR a.item_id=$2)
      ORDER BY a.buyout_gold,a.created_at LIMIT 100`, [realmId, itemId]);
    json(res, 200, { listings: result.rows.map(row => ({ id: row.id, itemId: row.item_id, itemName: row.item_name, quantity: row.quantity, buyoutGold: Number(row.buyout_gold), expiresAt: row.expires_at, sellerName: row.seller_name })) });
    return true;
  }

  if (create && req.method === 'POST') {
    const sellerId = create[1], body = await readBody(req), itemId = String(body.itemId || '');
    const quantity = Number(body.quantity), buyout = Number(body.buyoutGold), duration = Number(body.durationHours || 24);
    if (!ITEM_ID.test(itemId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999 || !Number.isSafeInteger(buyout) || buyout < 1 || buyout > MAX_GOLD || ![12,24,48].includes(duration)) { json(res, 400, { error: 'invalid_auction_listing' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const seller = await tx.query('SELECT id,realm_id,gold FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [sellerId, account.id]);
      if (!seller.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const item = await tx.query('SELECT max_stack FROM item_catalog WHERE id=$1', [itemId]);
      if (!item.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'item_not_found' }); return true; }
      if (quantity > Number(item.rows[0].max_stack)) { await tx.query('ROLLBACK'); json(res, 400, { error: 'quantity_exceeds_stack_limit' }); return true; }
      const deposit = Math.max(1, Math.ceil(buyout * 0.02));
      if (Number(seller.rows[0].gold) < deposit) { await tx.query('ROLLBACK'); json(res, 409, { error: 'insufficient_listing_deposit' }); return true; }
      const removed = await tx.query('UPDATE character_inventory SET quantity=quantity-$1 WHERE character_id=$2 AND item_id=$3 AND quantity>=$1 RETURNING quantity', [quantity, sellerId, itemId]);
      if (!removed.rowCount) { await tx.query('ROLLBACK'); json(res, 409, { error: 'item_quantity_unavailable' }); return true; }
      if (Number(removed.rows[0].quantity) === 0) await tx.query('DELETE FROM character_inventory WHERE character_id=$1 AND item_id=$2', [sellerId, itemId]);
      await tx.query('UPDATE characters SET gold=gold-$1,updated_at=now() WHERE id=$2', [deposit, sellerId]);
      const id = crypto.randomUUID();
      await tx.query(`INSERT INTO auction_listings(id,realm_id,seller_character_id,item_id,quantity,buyout_gold,deposit_gold,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,now()+($8::text||' hours')::interval)`, [id, seller.rows[0].realm_id, sellerId, itemId, quantity, buyout, deposit, duration]);
      await tx.query('COMMIT'); json(res, 201, { listing: { id, itemId, quantity, buyoutGold: buyout, depositGold: deposit, expiresInHours: duration } }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (buy && req.method === 'POST') {
    const listingId = buy[1], body = await readBody(req), buyerId = String(body.characterId || '');
    if (!UUID.test(buyerId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const buyer = await tx.query('SELECT id,realm_id,gold FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [buyerId, account.id]);
      if (!buyer.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const listing = await tx.query('SELECT * FROM auction_listings WHERE id=$1 AND status=\'active\' AND expires_at>now() FOR UPDATE', [listingId]);
      if (!listing.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'listing_unavailable' }); return true; }
      const row = listing.rows[0], price = Number(row.buyout_gold);
      if (row.seller_character_id === buyerId) { await tx.query('ROLLBACK'); json(res, 409, { error: 'cannot_buy_own_listing' }); return true; }
      if (row.realm_id !== buyer.rows[0].realm_id) { await tx.query('ROLLBACK'); json(res, 409, { error: 'cross_realm_auction' }); return true; }
      if (Number(buyer.rows[0].gold) < price) { await tx.query('ROLLBACK'); json(res, 409, { error: 'insufficient_gold' }); return true; }
      const catalog = await tx.query('SELECT max_stack FROM item_catalog WHERE id=$1', [row.item_id]);
      const inventory = await tx.query('SELECT quantity FROM character_inventory WHERE character_id=$1 AND item_id=$2 FOR UPDATE', [buyerId, row.item_id]);
      const total = (inventory.rowCount ? Number(inventory.rows[0].quantity) : 0) + Number(row.quantity);
      if (!catalog.rowCount || total > Number(catalog.rows[0].max_stack)) { await tx.query('ROLLBACK'); json(res, 409, { error: 'buyer_inventory_stack_limit' }); return true; }
      await tx.query('UPDATE characters SET gold=gold-$1,updated_at=now() WHERE id=$2', [price, buyerId]);
      const fee = Math.floor(price * 0.05), proceeds = price - fee;
      await tx.query('UPDATE characters SET gold=gold+$1,updated_at=now() WHERE id=$2', [proceeds + Number(row.deposit_gold), row.seller_character_id]);
      await tx.query(`INSERT INTO character_inventory(character_id,item_id,quantity) VALUES($1,$2,$3)
        ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=character_inventory.quantity+EXCLUDED.quantity`, [buyerId, row.item_id, row.quantity]);
      await tx.query("UPDATE auction_listings SET status='sold',buyer_character_id=$1 WHERE id=$2", [buyerId, listingId]);
      await tx.query(`INSERT INTO economy_ledger(realm_id,character_id,counterparty_character_id,event_type,amount,reference_id)
        VALUES($1,$2,$3,'auction_purchase',-$4,$5),($1,$3,$2,'auction_sale',$6,$5)`,
        [row.realm_id, buyerId, row.seller_character_id, price, listingId, proceeds]);
      await tx.query('COMMIT'); json(res, 200, { purchased: true, listingId, itemId: row.item_id, quantity: row.quantity, paidGold: price, sellerReceivedGold: proceeds }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  if (cancel && req.method === 'POST') {
    const listingId = cancel[1], body = await readBody(req), sellerId = String(body.characterId || '');
    if (!UUID.test(sellerId)) { json(res, 400, { error: 'invalid_character_id' }); return true; }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      const owner = await tx.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [sellerId, account.id]);
      if (!owner.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'character_not_found' }); return true; }
      const listing = await tx.query("SELECT * FROM auction_listings WHERE id=$1 AND seller_character_id=$2 AND status='active' FOR UPDATE", [listingId, sellerId]);
      if (!listing.rowCount) { await tx.query('ROLLBACK'); json(res, 404, { error: 'listing_not_cancellable' }); return true; }
      const row = listing.rows[0], catalog = await tx.query('SELECT max_stack FROM item_catalog WHERE id=$1', [row.item_id]);
      const current = await tx.query('SELECT quantity FROM character_inventory WHERE character_id=$1 AND item_id=$2 FOR UPDATE', [sellerId, row.item_id]);
      if (!catalog.rowCount || (current.rowCount ? Number(current.rows[0].quantity) : 0) + Number(row.quantity) > Number(catalog.rows[0].max_stack)) { await tx.query('ROLLBACK'); json(res, 409, { error: 'inventory_stack_limit' }); return true; }
      await tx.query(`INSERT INTO character_inventory(character_id,item_id,quantity) VALUES($1,$2,$3)
        ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=character_inventory.quantity+EXCLUDED.quantity`, [sellerId, row.item_id, row.quantity]);
      await tx.query('UPDATE characters SET gold=gold+$1,updated_at=now() WHERE id=$2', [row.deposit_gold, sellerId]);
      await tx.query("UPDATE auction_listings SET status='cancelled' WHERE id=$1", [listingId]);
      await tx.query('COMMIT'); json(res, 200, { cancelled: true, listingId, returnedItemId: row.item_id, quantity: row.quantity, refundedDeposit: Number(row.deposit_gold) }); return true;
    } catch (error) { await tx.query('ROLLBACK').catch(() => {}); throw error; }
    finally { tx.release(); }
  }

  json(res, 405, { error: 'method_not_allowed' }); return true;
}
module.exports = { handleMailRequest, handleAuctionRequest };
