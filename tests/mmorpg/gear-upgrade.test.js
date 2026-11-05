import test from "node:test";
import assert from "node:assert/strict";
import { createInventory, addItem, countItem } from "../../src/mmorpg/systems/inventory.js";
import { createWallet } from "../../src/mmorpg/systems/economy.js";
import { MAX_GEAR_UPGRADE, quoteGearUpgrade, upgradeGear } from "../../src/mmorpg/systems/gear-upgrade.js";

function setup(level = 1) {
  const inventory = createInventory({ capacity: 10, maxWeight: 100 });
  addItem(inventory, { id: "material:upgrade-stone", stackable: true, weight: 0 }, 100);
  addItem(inventory, { id: "material:arcane-dust", stackable: true, weight: 0 }, 20);
  return {
    item: { instanceId: "sword-1", itemLevel: 10, stats: { attackPower: 100, strength: 20 }, upgradeLevel: level },
    inventory, wallet: createWallet(10_000_000)
  };
}

test("upgrade quotes scale costs and stats and enforce the cap", () => {
  const item = { itemLevel: 10, stats: { attackPower: 10 } };
  assert.deepEqual(quoteGearUpgrade(item).materials, [{ id: "material:upgrade-stone", quantity: 1 }]);
  assert.equal(quoteGearUpgrade(item).goldCopper, 1000);
  const fifth = quoteGearUpgrade({ ...item, upgradeLevel: 4 });
  assert.equal(fifth.nextLevel, 5);
  assert.deepEqual(fifth.materials, [
    { id: "material:upgrade-stone", quantity: 5 },
    { id: "material:arcane-dust", quantity: 1 }
  ]);
  assert.equal(quoteGearUpgrade({ ...item, upgradeLevel: MAX_GEAR_UPGRADE }).reason, "upgrade_cap");
});

test("successful upgrades consume materials and update stats from the original baseline", () => {
  const state = setup();
  const first = upgradeGear(state.item, { ...state, random: () => 0 });
  assert.equal(first.ok, true);
  assert.equal(state.item.upgradeLevel, 2);
  assert.deepEqual(state.item.stats, { attackPower: 110, strength: 22 });
  assert.deepEqual(state.item.baseUpgradeStats, { attackPower: 100, strength: 20 });
  const second = upgradeGear(state.item, { ...state, random: () => 0 });
  assert.equal(second.ok, true);
  assert.deepEqual(state.item.stats, { attackPower: 115, strength: 23 });
  assert.equal(countItem(state.inventory, "material:upgrade-stone"), 95);
});

test("failed upgrade consumes quoted resources but does not alter item stats or level", () => {
  const state = setup(10);
  const before = structuredClone(state.item);
  const result = upgradeGear(state.item, { ...state, random: () => 0.99 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "upgrade_failed");
  assert.equal(result.consumed, true);
  assert.equal(state.item.upgradeLevel, before.upgradeLevel);
  assert.deepEqual(state.item.stats, before.stats);
  assert.equal(countItem(state.inventory, "material:upgrade-stone"), 89);
  assert.ok(state.wallet.copper < 10_000_000);
});

test("missing materials, funds, or invalid random values fail before resource consumption", () => {
  const state = setup();
  const stones = countItem(state.inventory, "material:upgrade-stone");
  state.inventory.items = state.inventory.items.filter(x => x.id !== "material:upgrade-stone");
  assert.equal(upgradeGear(state.item, { ...state, random: () => 0 }).reason, "insufficient_materials");
  assert.equal(state.wallet.copper, 10_000_000);
  assert.equal(countItem(state.inventory, "material:upgrade-stone"), 0);
  assert.equal(stones, 100);

  const other = setup();
  other.wallet.copper = 0;
  assert.equal(upgradeGear(other.item, { ...other, random: () => 0 }).reason, "insufficient_funds");
  assert.equal(countItem(other.inventory, "material:upgrade-stone"), 100);
  assert.throws(() => upgradeGear(other.item, { ...other, wallet: setup().wallet, random: () => 1 }), /\[0, 1\)/);
});

test("invalid item state and material-free upgrade caps are safely rejected", () => {
  assert.throws(() => quoteGearUpgrade({ itemLevel: 0 }), /item level/i);
  const state = setup(MAX_GEAR_UPGRADE);
  assert.equal(upgradeGear(state.item, { ...state, random: () => 0 }).reason, "upgrade_cap");
  assert.equal(countItem(state.inventory, "material:upgrade-stone"), 100);
});
