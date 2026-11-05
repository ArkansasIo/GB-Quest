import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUIPMENT_SLOTS, createEquipment, equipItem, unequipItem, canEquipItem, calculateGearStats
} from "../../src/mmorpg/systems/equipment.js";

const loadout = () => ({ level: 20, classId: "warrior", raceId: "human", equipment: createEquipment() });
const gear = (slot, extra = {}) => ({ id: slot, slot, stats: { armor: 2 }, ...extra });

test("equipment exposes sixteen stable slots and equips compatible items", () => {
  const character = loadout();
  assert.equal(EQUIPMENT_SLOTS.length, 16);
  const result = equipItem(character, gear("head"));
  assert.equal(result.ok, true);
  assert.equal(character.equipment.head.id, "head");
  assert.deepEqual(calculateGearStats(character), { armor: 2 });
});

test("equipment rejects invalid slots, slot mismatches, level and broken gear", () => {
  const character = loadout();
  assert.equal(equipItem(character, gear("unknown")).reason, "invalid_slot");
  assert.equal(equipItem(character, gear("chest"), "head").reason, "slot_mismatch");
  assert.equal(equipItem(character, gear("head", { requiredLevel: 21 })).reason, "level_too_low");
  assert.equal(equipItem(character, gear("head", { durability: 0 })).reason, "broken_item");
});

test("two-handed weapons displace offhand gear and block offhand equipment", () => {
  const character = loadout();
  const shield = gear("offHand", { itemType: "shield" });
  assert.equal(equipItem(character, shield).ok, true);
  const greatsword = gear("mainHand", { template: { properties: ["two-handed"] } });
  const equipped = equipItem(character, greatsword);
  assert.equal(equipped.ok, true);
  assert.equal(equipped.displaced[0].item, shield);
  assert.equal(character.equipment.offHand, null);
  assert.equal(canEquipItem(character, shield).reason, "main_hand_requires_both_hands");
  assert.equal(equipItem(character, shield).reason, "main_hand_requires_both_hands");
});

test("one-handed main hand supports offhand and unequip returns the item", () => {
  const character = loadout();
  const sword = gear("mainHand");
  const shield = gear("offHand");
  assert.equal(equipItem(character, sword).ok, true);
  assert.equal(equipItem(character, shield).ok, true);
  assert.equal(unequipItem(character, "offHand").item, shield);
  assert.equal(unequipItem(character, "offHand").reason, "empty_slot");
});

test("class and race restrictions are checked and invalid stats cannot enter totals", () => {
  const character = loadout();
  assert.equal(equipItem(character, gear("head", { allowedClasses: ["mage"] })).reason, "class_restricted");
  assert.equal(equipItem(character, gear("head", { allowedRaces: ["elf"] })).reason, "race_restricted");
  character.equipment.head = gear("head", { stats: { armor: Infinity } });
  assert.throws(() => calculateGearStats(character), /finite numbers/i);
});
