import test from "node:test";
import assert from "node:assert/strict";
import { getRepairQuote, repairEquipment, repairAllEquipment } from "../../src/mmorpg/systems/repair.js";

const loadout = () => ({
  equipment: {
    head: { id: "helm", itemLevel: 15, durability: 20, maxDurability: 100 },
    mainHand: { id: "sword", itemLevel: 5, durability: 0, maxDurability: 80 },
    chest: { id: "robe", durability: 100, maxDurability: 100 },
    ring1: null
  }
});

test("repair quote totals damaged gear and scales by item level", () => {
  const quote = getRepairQuote(loadout());
  assert.equal(quote.itemCount, 2);
  assert.equal(quote.totalCost, 240);
  assert.deepEqual(quote.repairs.map(x => x.slot), ["head", "mainHand"]);
});

test("single-item repair restores durability and rejects insufficient funds", () => {
  const character = loadout();
  assert.deepEqual(repairEquipment(character, "head", 10), {
    ok: false, reason: "insufficient_funds", cost: 160
  });
  assert.equal(character.equipment.head.durability, 20);
  const result = repairEquipment(character, "head", 160);
  assert.equal(result.ok, true);
  assert.equal(character.equipment.head.durability, 100);
});

test("repair all is atomic when budget is short and repairs all eligible slots otherwise", () => {
  const character = loadout();
  const rejected = repairAllEquipment(character, 239);
  assert.equal(rejected.ok, false);
  assert.equal(character.equipment.head.durability, 20);
  assert.equal(character.equipment.mainHand.durability, 0);

  const repaired = repairAllEquipment(character, 240);
  assert.equal(repaired.ok, true);
  assert.equal(repaired.repaired, 2);
  assert.equal(character.equipment.head.durability, 100);
  assert.equal(character.equipment.mainHand.durability, 80);
});

test("invalid loadouts, budgets and slots are handled explicitly", () => {
  assert.throws(() => getRepairQuote(null), /loadout/i);
  assert.equal(repairEquipment(loadout(), "unknown").reason, "invalid_slot");
  assert.equal(repairAllEquipment(loadout(), -1).reason, "invalid_budget_or_rate");
});
