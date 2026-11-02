import test from "node:test";
import assert from "node:assert/strict";
import { createInventory, addItem, countItem } from "../../src/mmorpg/systems/inventory.js";
import { acceptTrade, cancelTrade, createTrade, updateTradeOffer } from "../../src/mmorpg/systems/trading.js";
import {
  acceptFriendRequest, createSocialState, ignorePlayer, removeFriend,
  requestFriend, sendChatMessage, unignorePlayer
} from "../../src/mmorpg/systems/social.js";

function player(capacity = 10, copper = 0) {
  return { inventory: createInventory({ capacity }), wallet: { copper } };
}

test("trade settles items and currency only after both participants accept", () => {
  const trade = createTrade("a", "b");
  const a = player(10, 500);
  const b = player(10, 100);
  addItem(a.inventory, { id: "gear:torch", stackable: true, weight: 1 }, 3);
  addItem(b.inventory, { id: "gear:rope", stackable: true, weight: 5 }, 1);
  const states = { a, b };

  assert.equal(updateTradeOffer(trade, "a", { items: [{ itemId: "gear:torch", quantity: 2 }], currencyCopper: 100 }).ok, true);
  assert.equal(updateTradeOffer(trade, "b", { items: [{ itemId: "gear:rope", quantity: 1 }], currencyCopper: 20 }).ok, true);
  assert.equal(acceptTrade(trade, "a", states).status, "waiting_for_partner");
  assert.equal(trade.status, "open");
  assert.equal(acceptTrade(trade, "b", states).status, "completed");
  assert.equal(countItem(a.inventory, "gear:torch"), 1);
  assert.equal(countItem(a.inventory, "gear:rope"), 1);
  assert.equal(countItem(b.inventory, "gear:rope"), 0);
  assert.equal(countItem(b.inventory, "gear:torch"), 2);
  assert.equal(a.wallet.copper, 420);
  assert.equal(b.wallet.copper, 180);
  assert.equal(acceptTrade(trade, "a", states).reason, "trade_unavailable");
});

test("failed trade leaves inventory, wallets and trade state unchanged", () => {
  const trade = createTrade("a", "b");
  const a = player(10, 100);
  const b = player(0, 100);
  addItem(a.inventory, { id: "gear:torch", stackable: true, weight: 1 }, 1);
  updateTradeOffer(trade, "a", { items: [{ itemId: "gear:torch", quantity: 1 }], currencyCopper: 25 });
  updateTradeOffer(trade, "b", { currencyCopper: 30 });
  acceptTrade(trade, "a", { a, b });
  assert.deepEqual(acceptTrade(trade, "b", { a, b }), {
    ok: false, reason: "slots_full", itemId: "gear:torch"
  });
  assert.equal(trade.status, "open");
  assert.deepEqual(trade.accepted, []);
  assert.equal(countItem(a.inventory, "gear:torch"), 1);
  assert.equal(countItem(b.inventory, "gear:torch"), 0);
  assert.equal(a.wallet.copper, 100);
  assert.equal(b.wallet.copper, 100);
  assert.deepEqual(updateTradeOffer(trade, "a", { items: [{ itemId: "gear:torch", quantity: 1 }, { itemId: "gear:torch", quantity: 1 }] }), {
    ok: false, reason: "invalid_offer_item"
  });
  assert.equal(cancelTrade(trade, "b").status, "cancelled");
});

test("friend requests, ignores and chat throttling enforce social preferences", () => {
  const social = createSocialState();
  assert.equal(requestFriend(social, "alice", "bob").ok, true);
  assert.deepEqual(acceptFriendRequest(social, "bob", "alice"), { ok: true, friends: true });
  assert.equal(sendChatMessage(social, { senderId: "alice", channel: "whisper", recipientId: "bob", text: "Hello" }, { now: 100 }).ok, true);
  for (let i = 1; i < 5; i++) {
    assert.equal(sendChatMessage(social, { senderId: "alice", text: `hello ${i}` }, { now: 100 + i }).ok, true);
  }
  assert.equal(sendChatMessage(social, { senderId: "alice", text: "too many" }, { now: 105 }).reason, "rate_limited");
  assert.equal(ignorePlayer(social, "bob", "alice").ok, true);
  assert.equal(sendChatMessage(social, { senderId: "bob", channel: "whisper", recipientId: "alice", text: "Blocked" }, { now: 110 }).reason, "recipient_unavailable");
  assert.equal(requestFriend(social, "alice", "bob").reason, "relationship_blocked");
  unignorePlayer(social, "bob", "alice");
  assert.equal(requestFriend(social, "alice", "bob").ok, true);
  removeFriend(social, "bob", "alice");
  assert.equal(sendChatMessage(social, { senderId: "alice", channel: "whisper", recipientId: "bob", text: "No longer friends" }, { now: 120 }).reason, "recipient_not_friend");
});

test("social chat validates input and player identifiers", () => {
  const social = createSocialState();
  assert.equal(sendChatMessage(social, { senderId: "user", text: "  " }).reason, "invalid_message");
  assert.equal(sendChatMessage(social, { senderId: "user", text: `x${"a".repeat(120)}` }).reason, "invalid_message");
  assert.equal(sendChatMessage(social, { senderId: "user", text: "hello\nworld" }).reason, "invalid_message");
  assert.throws(() => requestFriend(social, "__proto__", "user"), /valid player id/);
  assert.equal(sendChatMessage(social, { senderId: "user", channel: "unknown", text: "hello" }).reason, "invalid_channel");
  assert.throws(() => sendChatMessage(social, { senderId: "user", text: "hello" }, { maxMessages: 0 }), /Chat limits/);
});
