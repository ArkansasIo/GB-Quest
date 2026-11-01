import test from "node:test";
import assert from "node:assert/strict";
import { abilityModifier, proficiencyBonus, rollD20, rollCheck } from "../../src/mmorpg/rules/d20.js";

test("ability modifiers follow floor((score - 10) / 2)", () => {
  assert.equal(abilityModifier(8), -1);
  assert.equal(abilityModifier(10), 0);
  assert.equal(abilityModifier(15), 2);
  assert.equal(abilityModifier(20), 5);
});

test("proficiency bonus scales across levels 1-20", () => {
  assert.equal(proficiencyBonus(1), 2);
  assert.equal(proficiencyBonus(5), 3);
  assert.equal(proficiencyBonus(9), 4);
  assert.equal(proficiencyBonus(13), 5);
  assert.equal(proficiencyBonus(17), 6);
  assert.throws(() => proficiencyBonus(21), RangeError);
});

test("d20 roll is bounded from 1 through 20", () => {
  assert.equal(rollD20(() => 0), 1);
  assert.equal(rollD20(() => 0.999999), 20);
});

test("check combines die, ability and proficiency", () => {
  const result = rollCheck({
    ability: "str", score: 16, proficient: true, level: 5, bonus: 1
  }, () => 0.5);
  assert.equal(result.die, 11);
  assert.equal(result.modifier, 7);
  assert.equal(result.total, 18);
});

test("advantage keeps the higher die and disadvantage the lower", () => {
  const values = [0.1, 0.8];
  let i = 0;
  const advantage = rollCheck({ ability: "dex", score: 10, advantage: 1 }, () => values[i++]);
  assert.equal(advantage.die, 17);
  i = 0;
  const disadvantage = rollCheck({ ability: "dex", score: 10, advantage: -1 }, () => values[i++]);
  assert.equal(disadvantage.die, 3);
});
