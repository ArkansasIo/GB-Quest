import test from "node:test";
import assert from "node:assert/strict";
import { createWallet, transferCurrency, quoteVendorPrice } from "../../src/mmorpg/systems/economy.js";

test("wallets accept only non-negative safe copper balances", () => {
  assert.deepEqual(createWallet(125), { copper: 125 });
  assert.throws(() => createWallet(-1), /safe copper/);
  assert.throws(() => createWallet(Number.MAX_SAFE_INTEGER + 1), /safe copper/);
});

test("currency transfers are atomic and reject invalid wallets and amounts", () => {
  const seller = createWallet(100);
  const buyer = createWallet(20);
  assert.deepEqual(transferCurrency(seller, buyer, 30), { ok: true, balance: 70 });
  assert.deepEqual([seller.copper, buyer.copper], [70, 50]);
  assert.deepEqual(transferCurrency(seller, buyer, 0), { ok: false, reason: "invalid_amount" });
  assert.deepEqual(transferCurrency(seller, buyer, 100), { ok: false, reason: "insufficient_funds" });
  assert.deepEqual(transferCurrency(seller, seller, 1), { ok: false, reason: "invalid_wallet" });
  assert.deepEqual([seller.copper, buyer.copper], [70, 50]);
});

test("currency transfer rejects recipient overflow without debiting sender", () => {
  const sender = createWallet(10);
  const recipient = createWallet(Number.MAX_SAFE_INTEGER);
  assert.deepEqual(transferCurrency(sender, recipient, 1), { ok: false, reason: "balance_overflow" });
  assert.deepEqual([sender.copper, recipient.copper], [10, Number.MAX_SAFE_INTEGER]);
});

test("vendor quotes validate quantity, discount and safe integer price", () => {
  assert.equal(quoteVendorPrice({ priceCopper: 100 }, 3, 0.1), 270);
  assert.equal(quoteVendorPrice({ priceCopper: 100 }, 1, 1), 0);
  assert.throws(() => quoteVendorPrice({ priceCopper: -1 }), /price/);
  assert.throws(() => quoteVendorPrice({ priceCopper: 100 }, 0), /Quantity/);
  assert.throws(() => quoteVendorPrice({ priceCopper: 100 }, 1, 1.1), /discount/);
  assert.throws(() => quoteVendorPrice({ priceCopper: Number.MAX_SAFE_INTEGER }, 2), /safe copper/);
});
