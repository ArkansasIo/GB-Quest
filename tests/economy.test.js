import test from "node:test";
import assert from "node:assert/strict";
import {
  EconomyError, ensureEconomy, grantGold, grantItem, createListing, buyListing,
  cancelListing, claimProceeds, expireListings, getPlayerEconomy,
} from "../backend/economy.cjs";

const db = () => ({});
const expectCode = (code, fn) => assert.throws(fn, error => error instanceof EconomyError && error.code === code);

test("listing escrows a server-owned item and charges a listing deposit", () => {
  const state = db();
  grantGold(state, "seller-1", 10_000);
  grantItem(state, "seller-1", { uid: "item-001", templateId: "iron-sword", quantity: 1 });
  const result = createListing(state, {
    sellerId: "seller-1", itemUid: "item-001", price: 2_000,
    listingId: "listing-001", idempotencyKey: "list-request-001", now: 1000,
  });
  assert.equal(result.walletGold, 9_900);
  assert.equal(result.listing.deposit, 100);
  assert.equal(result.listing.item.templateId, "iron-sword");
  assert.deepEqual(getPlayerEconomy(state, "seller-1").inventory, []);
  assert.equal(Object.keys(ensureEconomy(state).listings).length, 1);
});

test("purchase atomically transfers escrowed item and credits seller proceeds once", () => {
  const state = db();
  grantGold(state, "seller-1", 10_000);
  grantItem(state, "seller-1", { uid: "item-002", templateId: "steel-axe", quantity: 1 });
  grantGold(state, "buyer-1", 5_000);
  createListing(state, { sellerId: "seller-1", itemUid: "item-002", price: 2_000, listingId: "listing-002", idempotencyKey: "list-request-002", now: 1000 });
  const args = { buyerId: "buyer-1", listingId: "listing-002", idempotencyKey: "buy-request-001", now: 2000 };
  const first = buyListing(state, args);
  const retry = buyListing(state, args);
  assert.deepEqual(retry, first);
  assert.equal(getPlayerEconomy(state, "buyer-1").gold, 3_000);
  assert.equal(getPlayerEconomy(state, "buyer-1").inventory[0].uid, "item-002");
  assert.equal(getPlayerEconomy(state, "seller-1").proceedsGold, 1_900);
  assert.equal(getPlayerEconomy(state, "seller-1").gold, 9_900);
  assert.equal(claimProceeds(state, { sellerId: "seller-1", idempotencyKey: "claim-request-01" }).gold, 1_900);
  assert.equal(getPlayerEconomy(state, "seller-1").gold, 11_800);
  expectCode("LISTING_NOT_FOUND", () => buyListing(state, { ...args, idempotencyKey: "buy-request-002" }));
});

test("seller cannot buy own listing and failed transactions do not mutate balances", () => {
  const state = db();
  grantGold(state, "seller-1", 1_000);
  grantItem(state, "seller-1", { uid: "item-003", templateId: "oak-bow", quantity: 1 });
  createListing(state, { sellerId: "seller-1", itemUid: "item-003", price: 100, listingId: "listing-003", idempotencyKey: "list-request-003", now: 1000 });
  expectCode("OWN_LISTING", () => buyListing(state, { buyerId: "seller-1", listingId: "listing-003", idempotencyKey: "self-buy-0001", now: 2000 }));
  assert.equal(getPlayerEconomy(state, "seller-1").gold, 995);
  assert.equal(getPlayerEconomy(state, "seller-1").inventory.length, 0);
});

test("only the listing owner can cancel; cancellation returns item but not the deposit", () => {
  const state = db();
  grantGold(state, "seller-1", 1_000);
  grantGold(state, "seller-2", 1_000);
  grantItem(state, "seller-1", { uid: "item-004", templateId: "healing-ring", quantity: 1 });
  createListing(state, { sellerId: "seller-1", itemUid: "item-004", price: 500, listingId: "listing-004", idempotencyKey: "list-request-004", now: 1000 });
  expectCode("LISTING_NOT_OWNED", () => cancelListing(state, { sellerId: "seller-2", listingId: "listing-004", idempotencyKey: "cancel-request-01", now: 2000 }));
  const cancelled = cancelListing(state, { sellerId: "seller-1", listingId: "listing-004", idempotencyKey: "cancel-request-02", now: 2000 });
  assert.equal(cancelled.depositRefunded, false);
  assert.equal(getPlayerEconomy(state, "seller-1").inventory[0].uid, "item-004");
  assert.equal(getPlayerEconomy(state, "seller-1").gold, 975);
});

test("expired listings return escrowed items to the seller inventory", () => {
  const state = db();
  grantGold(state, "seller-1", 1_000);
  grantItem(state, "seller-1", { uid: "item-005", templateId: "moonstone", quantity: 2 });
  createListing(state, { sellerId: "seller-1", itemUid: "item-005", price: 500, listingId: "listing-005", idempotencyKey: "list-request-005", now: 1000, hours: 1 });
  assert.equal(expireListings(state, 3_601_001), 1);
  assert.equal(getPlayerEconomy(state, "seller-1").inventory[0].quantity, 2);
  assert.equal(Object.keys(ensureEconomy(state).listings).length, 0);
});

test("idempotency keys cannot be reused for a different payload and item UIDs are globally unique", () => {
  const state = db();
  grantGold(state, "seller-1", 1_000);
  grantItem(state, "seller-1", { uid: "item-006", templateId: "bronze-shield", quantity: 1 });
  expectCode("IDEMPOTENCY_CONFLICT", () => createListing(state, {
    sellerId: "seller-1", itemUid: "item-006", price: 100, listingId: "listing-006",
    idempotencyKey: "same-request-001", now: 1000,
  }) && createListing(state, {
    sellerId: "seller-1", itemUid: "item-006", price: 200, listingId: "listing-007",
    idempotencyKey: "same-request-001", now: 1000,
  }));
  expectCode("ITEM_UID_EXISTS", () => grantItem(state, "seller-2", { uid: "item-006", templateId: "bronze-shield", quantity: 1 }));
});
