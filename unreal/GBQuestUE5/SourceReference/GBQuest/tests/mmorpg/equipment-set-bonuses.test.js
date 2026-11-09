import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUIPMENT_SET_BONUSES, getEquipmentSetBonuses, aggregateEquipmentStats,
  calculateCharacterGearProfile
} from "../../src/mmorpg/systems/gear-stats.js";

const piece = (setId, stats = {}, durability = 100) => ({ setId, stats, durability });

test("two-piece and three-piece legendary bonuses unlock at their thresholds", () => {
  const equipment = {
    head: piece("crypt_warden"),
    chest: piece("crypt_warden"),
    legs: piece("crypt_warden")
  };
  const result = getEquipmentSetBonuses(equipment);
  assert.equal(result.active.length, 1);
  assert.equal(result.active[0].name, "Crypt Warden");
  assert.equal(result.active[0].equippedPieces, 3);
  assert.deepEqual(result.active[0].unlockedBonuses, {
    2: { armor: 18, vitality: 4 },
    3: { maxHealth: 180, resistance: 12 }
  });
  assert.deepEqual(result.stats, { armor: 18, vitality: 4, maxHealth: 180, resistance: 12 });
  assert.deepEqual(Object.keys(EQUIPMENT_SET_BONUSES).sort(), [
    "crypt_warden", "forgefire", "long_night", "rime_throne"
  ]);
});

test("set bonuses stack across sets and broken pieces do not count", () => {
  const equipment = {
    head: piece("forgefire"),
    chest: piece("forgefire"),
    legs: piece("rime_throne"),
    feet: piece("rime_throne", {}, 0),
    ring1: piece("not_a_real_set")
  };
  const result = getEquipmentSetBonuses(equipment);
  assert.deepEqual(result.active.map(x => x.setId).sort(), ["forgefire"]);
  assert.deepEqual(result.stats, { strength: 5, fireResistance: 10 });
});

test("set bonuses enter character gear and derived-stat calculations", () => {
  const character = {
    attributes: { strength: 10, constitution: 10, vitality: 10 },
    equipment: {
      head: piece("crypt_warden", { armor: 4 }),
      chest: piece("crypt_warden", { vitality: 2 })
    }
  };
  const profile = calculateCharacterGearProfile(character);
  assert.equal(profile.gear.armor, 22);
  assert.equal(profile.gear.vitality, 6);
  assert.equal(profile.derived.maxHealth, 340);
  assert.equal(profile.setBonuses.active[0].equippedPieces, 2);
});

test("equipment aggregation preserves ordinary gear stats alongside set bonuses", () => {
  const totals = aggregateEquipmentStats({
    mainHand: piece("forgefire", { attackPower: 12 }),
    offHand: piece("forgefire", { armor: 8 })
  });
  assert.deepEqual(totals, {
    attackPower: 12, armor: 8, strength: 5, fireResistance: 10
  });
});
