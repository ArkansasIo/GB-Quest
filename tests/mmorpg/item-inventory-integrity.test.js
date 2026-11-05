import test from "node:test";
import assert from "node:assert/strict";
import { createItemInstance, bindItem, damageDurability, repairItem } from "../../src/mmorpg/systems/itemization.js";
import { createInventory, addItem, removeItem, countItem } from "../../src/mmorpg/systems/inventory.js";

test("generated gear instances receive distinct identifiers unless a seed is supplied", () => {
  const first = createItemInstance("Longsword");
  const second = createItemInstance("Longsword");
  assert.notEqual(first.instanceId, second.instanceId);
  assert.equal(createItemInstance("Longsword", { randomSeed: "fixed" }).instanceId, "fixed");
});

test("item creation rejects unsafe quantities, invalid durability and non-finite stats", () => {
  assert.throws(() => createItemInstance("Longsword", { quantity: Number.MAX_SAFE_INTEGER + 1 }), /quantity/i);
  assert.throws(() => createItemInstance("Longsword", { maxDurability: 0 }), /durability/i);
  assert.throws(() => createItemInstance("Longsword", { stats: { strength: Infinity } }), /finite/i);
});

test("binding modes enforce character ownership and valid triggers", () => {
  const item = createItemInstance("Longsword", { bind: "bind_on_equip" });
  assert.equal(bindItem(item, "hero-a", "pickup").bound, false);
  assert.equal(bindItem(item, "hero-a", "equip").bound, true);
  assert.deepEqual(bindItem(item, "hero-b", "equip"), { ok: false, reason: "already_bound" });
  assert.throws(() => bindItem(item, "hero-a", "trade"), /trigger/i);
});

test("durability and repair reject corrupted states without mutating them", () => {
  const item = createItemInstance("Longsword");
  item.durability = 150;
  assert.throws(() => damageDurability(item, 1), /durability state/i);
  assert.equal(item.durability, 150);
  item.durability = 50;
  item.template.priceCopper = Number.MAX_SAFE_INTEGER;
  assert.throws(() => repairItem(item, 1000), /safe copper/i);
  assert.equal(item.durability, 50);
});

test("inventory creation validates limits and additions are atomic", () => {
  assert.throws(() => createInventory({ capacity: -1 }), /capacity/i);
  assert.throws(() => createInventory({ maxWeight: Infinity }), /weight/i);
  const inventory = createInventory({ capacity: 2, maxWeight: 5 });
  assert.deepEqual(addItem(inventory, { id: "ore", weight: 2 }, 2), { ok: true, quantity: 2 });
  assert.deepEqual(addItem(inventory, { id: "ore", weight: 2 }, 2), { ok: true, quantity: 4 });
  assert.deepEqual(addItem(inventory, { id: "ore", weight: 2 }, 1), { ok: false, reason: "overweight" });
  assert.equal(countItem(inventory, "ore"), 4);
  assert.deepEqual(addItem(inventory, { id: "sword", weight: 1, stackable: false }, 1), { ok: true, quantity: 1 });
  assert.deepEqual(addItem(inventory, { id: "sword", weight: 1, stackable: false }, 1), { ok: false, reason: "not_stackable" });
  assert.deepEqual(addItem(inventory, { id: "shield", weight: 1 }, 1), { ok: false, reason: "slots_full" });
});

test("inventory removal validates positive safe quantities and preserves stock on failure", () => {
  const inventory = createInventory();
  addItem(inventory, { id: "potion", weight: 0.1 }, 3);
  assert.deepEqual(removeItem(inventory, "potion", 2), { ok: true, remaining: 1 });
  assert.deepEqual(removeItem(inventory, "potion", 2), { ok: false, reason: "insufficient_quantity" });
  assert.deepEqual(removeItem(inventory, "potion", 0), { ok: false, reason: "invalid_request" });
  assert.equal(countItem(inventory, "potion"), 1);
});
