import test from "node:test";
import assert from "node:assert/strict";
import { inspectGear } from "../../src/mmorpg/systems/gear-inspection.js";

test("a stronger low-level candidate can be an upgrade over equipped gear", () => {
  const equipped = { itemLevel: 20, rarity: 2, stats: { AttackPower: 20 } };
  const candidate = { itemLevel: 10, rarity: 1, stats: { AttackPower: 40 } };
  const result = inspectGear(candidate, equipped);
  assert.equal(result.isUpgradeByScore, true);
  assert.ok(result.upgradeDelta > 0);
});

test("a higher item level does not hide a weaker stat budget", () => {
  const equipped = { itemLevel: 20, rarity: 2, stats: { AttackPower: 100 } };
  const candidate = { itemLevel: 40, rarity: 3, stats: { AttackPower: 10 } };
  const result = inspectGear(candidate, equipped);
  assert.equal(result.isUpgradeByScore, false);
  assert.ok(result.upgradeDelta < 0);
});

test("no equipped item makes inspectable gear an upgrade", () => {
  assert.equal(inspectGear({ stats: { Armor: 1 } }).isUpgradeByScore, true);
});
