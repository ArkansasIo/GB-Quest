'use strict';

const crypto = require('node:crypto');

const MARKET_FEE_BPS = 500;
const LISTING_DEPOSIT_BPS = 500;
const DEFAULT_LISTING_HOURS = 12;
const MAX_LISTING_HOURS = 48;
const MAX_ACTIVE_LISTINGS = 20;
const MAX_PRICE = 1_000_000_000;
const MAX_GOLD = Number.MAX_SAFE_INTEGER;

class EconomyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EconomyError';
    this.code = code;
  }
}

const fail = (code, message) => { throw new EconomyError(code, message); };
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail('INVALID_' + label.toUpperCase(), `${label} must be an integer from ${min} to ${max}.`);
  }
  return value;
};
const textId = (value, label) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,96}$/.test(value)) {
    fail('INVALID_' + label.toUpperCase(), `Invalid ${label}.`);
  }
  return value;
};

function ensureEconomy(db) {
  if (!db || typeof db !== 'object') fail('INVALID_DATABASE', 'A database object is required.');
  db.economy ||= { players: {}, listings: {}, idempotency: {} };
  db.economy.players ||= {};
  db.economy.listings ||= {};
  db.economy.idempotency ||= {};
  db.economy.trades ||= {};
  return db.economy;
}

function playerFor(db, accountId, create = false) {
  const id = textId(accountId, 'account id');
  const economy = ensureEconomy(db);
  if (!economy.players[id] && create) economy.players[id] = { gold: 0, inventory: {}, proceedsGold: 0 };
  const player = economy.players[id];
  if (!player) fail('PLAYER_NOT_FOUND', 'The player has no server-side economy record.');
  player.inventory ||= {};
  player.gold = Number.isSafeInteger(player.gold) && player.gold >= 0 ? player.gold : 0;
  player.proceedsGold = Number.isSafeInteger(player.proceedsGold) && player.proceedsGold >= 0 ? player.proceedsGold : 0;
  return player;
}

function idempotent(db, accountId, key, action, payload, operation) {
  const economy = ensureEconomy(db);
  const actor = textId(accountId, 'account id');
  if (typeof key !== 'string' || key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    fail('INVALID_IDEMPOTENCY_KEY', 'An idempotency key of 8–128 safe characters is required.');
  }
  const recordKey = actor + ':' + key;
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ action, payload })).digest('hex');
  const prior = economy.idempotency[recordKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'This idempotency key was already used for a different request.');
    return clone(prior.result);
  }
  const result = operation();
  economy.idempotency[recordKey] = { fingerprint, result: clone(result), createdAt: Date.now() };
  return clone(result);
}

// These grant functions are for trusted server-side gameplay/reward handlers only.
// Never expose them as routes accepting player-supplied item or currency values.
function grantGold(db, accountId, amount) {
  const value = integer(amount, 1, MAX_GOLD, 'gold amount');
  const player = playerFor(db, accountId, true);
  if (player.gold > MAX_GOLD - value) fail('GOLD_OVERFLOW', 'The wallet balance limit would be exceeded.');
  player.gold += value;
  return { gold: player.gold };
}

function grantItem(db, accountId, item) {
  if (!item || typeof item !== 'object') fail('INVALID_ITEM', 'A server-generated item is required.');
  const uid = textId(item.uid, 'item uid');
  const templateId = textId(item.templateId, 'item template id');
  const quantity = integer(item.quantity, 1, 999, 'item quantity');
  const economy = ensureEconomy(db);
  for (const player of Object.values(economy.players)) {
    if (player.inventory && player.inventory[uid]) fail('ITEM_UID_EXISTS', 'That item UID already exists.');
  }
  for (const listing of Object.values(economy.listings)) {
    if (listing.item && listing.item.uid === uid) fail('ITEM_UID_EXISTS', 'That item UID already exists.');
  }
  const player = playerFor(db, accountId, true);
  player.inventory[uid] = { uid, templateId, quantity };
  return clone(player.inventory[uid]);
}

function expireListings(db, now = Date.now()) {
  integer(now, 0, Number.MAX_SAFE_INTEGER, 'timestamp');
  const economy = ensureEconomy(db);
  let returned = 0;
  for (const [id, listing] of Object.entries(economy.listings)) {
    if (listing.expiresAt > now) continue;
    const seller = playerFor(db, listing.sellerId, true);
    seller.inventory[listing.item.uid] = clone(listing.item);
    delete economy.listings[id];
    returned++;
  }
  return returned;
}

function createListing(db, {
  sellerId, itemUid, price, idempotencyKey, now = Date.now(),
  hours = DEFAULT_LISTING_HOURS, listingId = crypto.randomBytes(12).toString('hex'),
}) {
  const amount = integer(price, 1, MAX_PRICE, 'price');
  const timestamp = integer(now, 0, Number.MAX_SAFE_INTEGER, 'timestamp');
  const duration = integer(hours, 1, MAX_LISTING_HOURS, 'listing hours');
  const uid = textId(itemUid, 'item uid');
  const id = textId(listingId, 'listing id');
  return idempotent(db, sellerId, idempotencyKey, 'market.list', { itemUid: uid, price: amount, now: timestamp, hours: duration, listingId: id }, () => {
    expireListings(db, timestamp);
    const economy = ensureEconomy(db);
    const seller = playerFor(db, sellerId);
    if (Object.keys(economy.listings).filter(key => economy.listings[key].sellerId === sellerId).length >= MAX_ACTIVE_LISTINGS) {
      fail('LISTING_LIMIT', 'The active listing limit has been reached.');
    }
    if (economy.listings[id]) fail('LISTING_ID_EXISTS', 'That listing ID already exists.');
    const item = seller.inventory[uid];
    if (!item) fail('ITEM_NOT_OWNED', 'The item is not in the seller inventory.');
    const deposit = Math.max(1, Math.floor(amount * LISTING_DEPOSIT_BPS / 10_000));
    if (seller.gold < deposit) fail('INSUFFICIENT_GOLD', 'The seller cannot pay the listing deposit.');
    seller.gold -= deposit;
    delete seller.inventory[uid];
    const listing = {
      id, sellerId, item: clone(item), price: amount, deposit,
      createdAt: timestamp, expiresAt: timestamp + duration * 60 * 60 * 1000,
    };
    economy.listings[id] = listing;
    return { listing, walletGold: seller.gold };
  });
}

function buyListing(db, { buyerId, listingId, idempotencyKey, now = Date.now() }) {
  const id = textId(listingId, 'listing id');
  const timestamp = integer(now, 0, Number.MAX_SAFE_INTEGER, 'timestamp');
  return idempotent(db, buyerId, idempotencyKey, 'market.buy', { listingId: id, now: timestamp }, () => {
    expireListings(db, timestamp);
    const economy = ensureEconomy(db);
    const listing = economy.listings[id];
    if (!listing) fail('LISTING_NOT_FOUND', 'That listing is no longer available.');
    if (listing.sellerId === buyerId) fail('OWN_LISTING', 'A seller cannot buy their own listing.');
    const buyer = playerFor(db, buyerId);
    if (buyer.gold < listing.price) fail('INSUFFICIENT_GOLD', 'The buyer wallet has insufficient gold.');
    const seller = playerFor(db, listing.sellerId, true);
    const sellerCredit = Math.floor(listing.price * (10_000 - MARKET_FEE_BPS) / 10_000);
    if (seller.proceedsGold > MAX_GOLD - sellerCredit) fail('GOLD_OVERFLOW', 'The seller proceeds limit would be exceeded.');
    if (buyer.inventory[listing.item.uid]) fail('ITEM_UID_EXISTS', 'The buyer already owns this item UID.');
    buyer.gold -= listing.price;
    buyer.inventory[listing.item.uid] = clone(listing.item);
    seller.proceedsGold += sellerCredit;
    delete economy.listings[id];
    return { listingId: id, item: clone(listing.item), buyerGold: buyer.gold, sellerCredit, marketFee: listing.price - sellerCredit };
  });
}

function cancelListing(db, { sellerId, listingId, idempotencyKey, now = Date.now() }) {
  const id = textId(listingId, 'listing id');
  const timestamp = integer(now, 0, Number.MAX_SAFE_INTEGER, 'timestamp');
  return idempotent(db, sellerId, idempotencyKey, 'market.cancel', { listingId: id, now: timestamp }, () => {
    expireListings(db, timestamp);
    const economy = ensureEconomy(db);
    const listing = economy.listings[id];
    if (!listing || listing.sellerId !== sellerId) fail('LISTING_NOT_OWNED', 'The listing does not belong to this seller or has expired.');
    const seller = playerFor(db, sellerId);
    seller.inventory[listing.item.uid] = clone(listing.item);
    delete economy.listings[id];
    return { listingId: id, returnedItem: clone(listing.item), walletGold: seller.gold, depositRefunded: false };
  });
}

function claimProceeds(db, { sellerId, idempotencyKey }) {
  return idempotent(db, sellerId, idempotencyKey, 'market.claim', {}, () => {
    const seller = playerFor(db, sellerId);
    const gold = seller.proceedsGold;
    if (seller.gold > MAX_GOLD - gold) fail('GOLD_OVERFLOW', 'The wallet balance limit would be exceeded.');
    seller.proceedsGold = 0;
    seller.gold += gold;
    return { gold, walletGold: seller.gold };
  });
}

function getPlayerEconomy(db, accountId) {
  const player = playerFor(db, accountId);
  return { gold: player.gold, inventory: clone(Object.values(player.inventory)), proceedsGold: player.proceedsGold };
}


function tradeFor(db, tradeId) {
  const id = textId(tradeId, 'trade id');
  const trade = ensureEconomy(db).trades[id];
  if (!trade) fail('TRADE_NOT_FOUND', 'That trade session does not exist.');
  return trade;
}

function startTrade(db, { initiatorId, targetId, idempotencyKey, now = Date.now(), tradeId = crypto.randomBytes(12).toString('hex') }) {
  const initiator = textId(initiatorId, 'initiator id');
  const target = textId(targetId, 'target id');
  const id = textId(tradeId, 'trade id');
  const timestamp = integer(now, 0, Number.MAX_SAFE_INTEGER, 'timestamp');
  if (initiator === target) fail('INVALID_TRADE_PARTICIPANTS', 'A player cannot trade with themselves.');
  return idempotent(db, initiator, idempotencyKey, 'trade.start', { target, now: timestamp, tradeId: id }, () => {
    const economy = ensureEconomy(db);
    playerFor(db, initiator);
    playerFor(db, target);
    if (economy.trades[id]) fail('TRADE_ID_EXISTS', 'That trade ID already exists.');
    const trade = {
      id, participants: [initiator, target], status: 'open', createdAt: timestamp,
      offers: {
        [initiator]: { itemUids: [], gold: 0, locked: false, confirmed: false },
        [target]: { itemUids: [], gold: 0, locked: false, confirmed: false },
      },
    };
    economy.trades[id] = trade;
    return { tradeId: id, status: trade.status, participants: trade.participants.slice() };
  });
}

function setTradeOffer(db, { accountId, tradeId, itemUids, gold = 0, idempotencyKey }) {
  const actor = textId(accountId, 'account id');
  const id = textId(tradeId, 'trade id');
  if (!Array.isArray(itemUids) || itemUids.length > 6) fail('INVALID_TRADE_ITEMS', 'A trade offer may contain up to six item UIDs.');
  const uids = itemUids.map(uid => textId(uid, 'item uid'));
  if (new Set(uids).size !== uids.length) fail('DUPLICATE_TRADE_ITEM', 'An item may only appear once in an offer.');
  const amount = integer(gold, 0, MAX_GOLD, 'trade gold');
  return idempotent(db, actor, idempotencyKey, 'trade.offer', { tradeId: id, itemUids: uids, gold: amount }, () => {
    const trade = tradeFor(db, id);
    if (!trade.participants.includes(actor)) fail('NOT_TRADE_PARTICIPANT', 'The account is not part of this trade.');
    if (trade.status !== 'open') fail('TRADE_NOT_OPEN', 'The trade offer can no longer be changed.');
    const player = playerFor(db, actor);
    if (amount > player.gold) fail('INSUFFICIENT_GOLD', 'The offered gold is not in the wallet.');
    for (const uid of uids) if (!player.inventory[uid]) fail('ITEM_NOT_OWNED', 'Every offered item must be in the account inventory.');
    trade.offers[actor] = { itemUids: uids, gold: amount, locked: false, confirmed: false };
    return { tradeId: id, offer: clone(trade.offers[actor]) };
  });
}

function lockTradeOffer(db, { accountId, tradeId, idempotencyKey }) {
  const actor = textId(accountId, 'account id');
  const id = textId(tradeId, 'trade id');
  return idempotent(db, actor, idempotencyKey, 'trade.lock', { tradeId: id }, () => {
    const trade = tradeFor(db, id);
    if (!trade.participants.includes(actor)) fail('NOT_TRADE_PARTICIPANT', 'The account is not part of this trade.');
    if (trade.status !== 'open') fail('TRADE_NOT_OPEN', 'The trade is no longer accepting locks.');
    const player = playerFor(db, actor);
    const offer = trade.offers[actor];
    if (player.gold < offer.gold || offer.itemUids.some(uid => !player.inventory[uid])) {
      fail('TRADE_OFFER_CHANGED', 'The offered items or gold are no longer available.');
    }
    offer.locked = true;
    if (trade.participants.every(pid => trade.offers[pid].locked)) trade.status = 'locked';
    return { tradeId: id, status: trade.status, locked: true };
  });
}

function confirmTrade(db, { accountId, tradeId, idempotencyKey, now = Date.now() }) {
  const actor = textId(accountId, 'account id');
  const id = textId(tradeId, 'trade id');
  const timestamp = integer(now, 0, Number.MAX_SAFE_INTEGER, 'timestamp');
  return idempotent(db, actor, idempotencyKey, 'trade.confirm', { tradeId: id, now: timestamp }, () => {
    const trade = tradeFor(db, id);
    if (!trade.participants.includes(actor)) fail('NOT_TRADE_PARTICIPANT', 'The account is not part of this trade.');
    if (trade.status === 'completed') return clone(trade.result);
    if (trade.status !== 'locked') fail('TRADE_NOT_LOCKED', 'Both players must lock their offers before confirming.');
    trade.offers[actor].confirmed = true;
    if (!trade.participants.every(pid => trade.offers[pid].confirmed)) {
      return { tradeId: id, status: 'awaiting_confirmation' };
    }

    const [aId, bId] = trade.participants;
    const a = playerFor(db, aId), b = playerFor(db, bId);
    const offerA = trade.offers[aId], offerB = trade.offers[bId];
    if (a.gold < offerA.gold || b.gold < offerB.gold ||
        offerA.itemUids.some(uid => !a.inventory[uid]) ||
        offerB.itemUids.some(uid => !b.inventory[uid])) {
      trade.status = 'cancelled';
      trade.cancelReason = 'offer_changed';
      fail('TRADE_OFFER_CHANGED', 'An offer changed before settlement; the trade was cancelled.');
    }
    const aNext = a.gold - offerA.gold + offerB.gold;
    const bNext = b.gold - offerB.gold + offerA.gold;
    if (!Number.isSafeInteger(aNext) || !Number.isSafeInteger(bNext) || aNext < 0 || bNext < 0) {
      fail('GOLD_OVERFLOW', 'The trade would exceed a wallet balance limit.');
    }

    // Validate the entire swap before mutating either inventory or wallet.
    const itemsA = offerA.itemUids.map(uid => clone(a.inventory[uid]));
    const itemsB = offerB.itemUids.map(uid => clone(b.inventory[uid]));
    for (const uid of offerA.itemUids) delete a.inventory[uid];
    for (const uid of offerB.itemUids) delete b.inventory[uid];
    for (const item of itemsA) b.inventory[item.uid] = item;
    for (const item of itemsB) a.inventory[item.uid] = item;
    a.gold = aNext;
    b.gold = bNext;
    trade.status = 'completed';
    trade.completedAt = timestamp;
    trade.result = {
      tradeId: id, status: 'completed',
      transferred: {
        [aId]: { itemsReceived: itemsB.length, goldReceived: offerB.gold },
        [bId]: { itemsReceived: itemsA.length, goldReceived: offerA.gold },
      },
    };
    return clone(trade.result);
  });
}

function cancelTrade(db, { accountId, tradeId, idempotencyKey }) {
  const actor = textId(accountId, 'account id');
  const id = textId(tradeId, 'trade id');
  return idempotent(db, actor, idempotencyKey, 'trade.cancel', { tradeId: id }, () => {
    const trade = tradeFor(db, id);
    if (!trade.participants.includes(actor)) fail('NOT_TRADE_PARTICIPANT', 'The account is not part of this trade.');
    if (trade.status === 'completed') fail('TRADE_ALREADY_COMPLETED', 'A completed trade cannot be cancelled.');
    if (trade.status === 'cancelled') return { tradeId: id, status: 'cancelled' };
    trade.status = 'cancelled';
    trade.cancelledBy = actor;
    return { tradeId: id, status: 'cancelled' };
  });
}

module.exports = {
  EconomyError,
  ensureEconomy,
  grantGold,
  grantItem,
  createListing,
  buyListing,
  cancelListing,
  claimProceeds,
  expireListings,
  getPlayerEconomy,
  startTrade,
  setTradeOffer,
  lockTradeOffer,
  confirmTrade,
  cancelTrade,
};
