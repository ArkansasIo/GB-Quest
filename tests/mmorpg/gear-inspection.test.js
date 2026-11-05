import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateGearStats, compareGearStats, calculateGearScore, inspectGear,
  quoteVendorPurchase, quoteVendorSale
} from "../../src/mmorpg/systems/gear-inspection.js";

const equipped = {
  rarity: 2, itemLevel: 20,
  baseStats: [{ statId: "Armor", value: 12 }],
  subStats: [{ statId: "Vitality", value: 4 }, { statId: "CriticalChance", value: 2, isPercent: true }]
};

test("aggregates base stats and rolled substats without losing stat identity", () => {
  assert.deepEqual(aggregateGearStats(equipped), { Armor: 12, CriticalChance: 2, Vitality: 4 });
});

test("compares candidate stats against equipped gear and reports losses too", () => {
  const rows = compareGearStats({ baseStats: [{ statId: "Armor", value: 18 }] }, equipped);
  assert.deepEqual(rows.find(x => x.statId === "Armor"), {
    statId: "Armor", candidateValue: 18, equippedValue: 12, difference: 6, isPercent: false
  });
  assert.equal(rows.find(x => x.statId === "Vitality").difference, -4);
});

test("inspection returns affix details, greater affixes and level restrictions", () => {
  const result = inspectGear({
    itemLevel: 30, requiredLevel: 40, rarity: 4,
    baseStats: [{ statId: "Armor", value: 20 }],
    subStats: [{ statId: "Haste", value: 5, greaterAffix: true }],
    affixes: ["of_the_bear"], specialEffect: "Gain a barrier on elite kill."
  }, equipped, { characterLevel: 25 });
  assert.equal(result.canEquip, false);
  assert.equal(result.restriction, "Requires level 40");
  assert.equal(result.subStats[0].greaterAffix, true);
  assert.equal(result.specialEffect, "Gain a barrier on elite kill.");
  assert.equal(result.comparison.find(x => x.statId === "Armor").difference, 8);
});

test("gear score is deterministic and candidate score compares against equipped score", () => {
  const item = { itemLevel: 10, rarity: 1, stats: { AttackPower: 20 } };
  assert.equal(calculateGearScore(item), calculateGearScore(item));
  assert.equal(inspectGear(item, equipped).isUpgradeByScore, true);
});

test("vendor purchase quotes enforce stock, level and wallet before purchase", () => {
  const item = { name: "Runed Blade", vendorValue: 100, requiredLevel: 10 };
  assert.deepEqual(quoteVendorPurchase(item, { characterLevel: 5, availableGold: 1000 }).reason, "level_too_low");
  assert.equal(quoteVendorPurchase(item, { characterLevel: 10, availableGold: 1000, stock: 0 }).reason, "out_of_stock");
  assert.equal(quoteVendorPurchase(item, { characterLevel: 10, availableGold: 1000 }).price, 125);
});

test("vendor sale quotes use the configured resale multiplier", () => {
  assert.equal(quoteVendorSale({ vendorValue: 200 }, { sellMultiplier: 0.4 }).price, 80);
  assert.equal(quoteVendorSale({ vendorValue: 0 }).canSell, false);
});
