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
    seller.proceedsGold = 0;
    if (seller.gold > MAX_GOLD - gold) fail('GOLD_OVERFLOW', 'The wallet balance limit would be exceeded.');
    seller.gold += gold;
    return { gold, walletGold: seller.gold };
  });
}

function getPlayerEconomy(db, accountId) {
  const player = playerFor(db, accountId);
  return { gold: player.gold, inventory: clone(Object.values(player.inventory)), proceedsGold: player.proceedsGold };
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
};
