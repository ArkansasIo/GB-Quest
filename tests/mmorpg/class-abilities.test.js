import test from "node:test";
import assert from "node:assert/strict";
import { createClassAbilityCatalog } from "../../src/mmorpg/systems/class-abilities.js";

const records = [
  { id: "fighter.power-strike", name: "Power Strike", classId: "fighter", level: 3, actionCost: "action", effects: [{ type: "damage", dice: "1d8" }] },
  { id: "fighter.second-wind", name: "Second Wind", classId: "fighter", level: 1, actionCost: "bonusAction", effects: [{ type: "healing", dice: "1d10" }] },
  { id: "rogue.quick-step", name: "Quick Step", classId: "rogue", level: 2, actionCost: "bonusAction", effects: [{ type: "condition", condition: "poisoned" }] }
];

test("class ability catalog indexes and filters authored records", () => {
  const catalog = createClassAbilityCatalog(records);
  assert.equal(catalog.size, 3);
  assert.equal(catalog.get("fighter.power-strike").name, "Power Strike");
  assert.equal(catalog.get("missing"), null);
  assert.deepEqual(catalog.list({ classId: "fighter" }).map(item => item.id), [
    "fighter.power-strike", "fighter.second-wind"
  ]);
  assert.deepEqual(catalog.list({ level: 1 }).map(item => item.id), ["fighter.second-wind"]);
  assert.deepEqual(catalog.list({ actionCost: "bonusAction", query: "wind" }).map(item => item.id), ["fighter.second-wind"]);
});

test("catalog rejects duplicate IDs and invalid ability definitions", () => {
  assert.throws(() => createClassAbilityCatalog([records[0], records[0]]), /duplicate/i);
  assert.throws(() => createClassAbilityCatalog([{ id: "bad", effects: [{ type: "teleport" }] }]), /unsupported ability effect/i);
  assert.throws(() => createClassAbilityCatalog({}), /array/i);
});

test("catalog records are isolated from caller mutation", () => {
  const source = structuredClone(records);
  const catalog = createClassAbilityCatalog(source);
  source[0].name = "Changed";
  assert.equal(catalog.get("fighter.power-strike").name, "Power Strike");
  assert.throws(() => catalog.list({ limit: 0 }), /positive integer/i);
});
