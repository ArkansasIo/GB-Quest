import test from "node:test";
import assert from "node:assert/strict";
import { createSpellSlotProgressionCatalog } from "../../src/mmorpg/rules/spell-slot-progression.js";

const fullCasterRows = Array.from({ length: 20 }, (_, index) => index === 0 ? [] : [Math.min(4, index + 1), ...Array(Math.min(8, Math.floor(index / 2))).fill(0)]);

test("spell slot progression returns defensive level rows from authored data", () => {
  const catalog = createSpellSlotProgressionCatalog([{
    classId: "wizard", castingType: "full", levels: fullCasterRows
  }]);
  assert.equal(catalog.size, 1);
  assert.equal(catalog.get("wizard").castingType, "full");
  const first = catalog.getSlots("wizard", 2);
  assert.deepEqual(first.slots, [2]);
  first.slots[0] = 99;
  assert.deepEqual(catalog.getSlots("wizard", 2).slots, [2]);
});

test("catalog distinguishes casting types and pact metadata without deriving tables", () => {
  const levels = Array.from({ length: 20 }, () => []);
  const catalog = createSpellSlotProgressionCatalog([
    { classId: "paladin", castingType: "half", levels },
    { classId: "warlock", castingType: "pact", levels, pact: { slotsByLevel: [{ level: 1, slots: 1, slotLevel: 1 }] } },
    { classId: "fighter", castingType: "none", levels }
  ]);
  assert.equal(catalog.getSlots("paladin", 5).castingType, "half");
  assert.deepEqual(catalog.getSlots("warlock", 1).pact, { slotsByLevel: [{ level: 1, slots: 1, slotLevel: 1 }] });
  assert.equal(catalog.getSlots("fighter", 20).castingType, "none");
});

test("slot progression rejects unknown classes, invalid levels and malformed tables", () => {
  const empty = Array.from({ length: 20 }, () => []);
  const catalog = createSpellSlotProgressionCatalog([{ classId: "wizard", castingType: "full", levels: empty }]);
  assert.equal(catalog.getSlots("missing", 1), null);
  assert.throws(() => catalog.getSlots("wizard", 0), /between 1 and 20/i);
  assert.throws(() => createSpellSlotProgressionCatalog([{ classId: "bad", castingType: "full", levels: [[]] }]), /exactly 20/i);
  assert.throws(() => createSpellSlotProgressionCatalog([{ classId: "bad", castingType: "unknown", levels: empty }]), /unsupported casting type/i);
  assert.throws(() => createSpellSlotProgressionCatalog([{ classId: "bad", castingType: "full", levels: [...empty.slice(0, 19), [5]] }]), /invalid spell slot row/i);
  assert.throws(() => createSpellSlotProgressionCatalog([{ classId: "bad", castingType: "full", levels: empty }, { classId: "bad", castingType: "full", levels: empty }]), /duplicate/i);
});
