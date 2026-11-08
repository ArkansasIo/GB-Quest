import test from "node:test";
import assert from "node:assert/strict";
import { validateAttackRequest } from "../server.js";

test("native attack request accepts a bounded attack", () => {
  const attack = {
    naturalRoll: 12,
    abilityScore: 18,
    proficiency: 3,
    bonus: 1,
    targetArmorClass: 18,
  };
  assert.equal(validateAttackRequest(attack), attack);
});

test("native attack request rejects missing and invalid values", () => {
  assert.throws(() => validateAttackRequest(null), TypeError);
  assert.throws(() => validateAttackRequest({}), RangeError);
  assert.throws(() => validateAttackRequest({
    naturalRoll: 21,
    abilityScore: 18,
    proficiency: 3,
    bonus: 1,
    targetArmorClass: 18,
  }), /naturalRoll/);
});
